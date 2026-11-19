'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const SESSION_SECONDS = 24 * 60 * 60;
const COOKIE_NAME = 'campus_session';
const TOKEN_OPTIONS = { algorithm: 'HS256', issuer: 'mgimo-campus', audience: 'campus-student' };

async function openDatabase(filename) {
  const connection = await open({ filename, driver: sqlite3.Database });
  await connection.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;');
  return connection;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function readText(body, key, min, max) {
  if (typeof body[key] !== 'string') throw httpError(400, `Заполните поле ${key}.`);
  const value = body[key].trim();
  if (value.length < min || value.length > max) throw httpError(400, `Поле ${key} должно содержать от ${min} до ${max} символов.`);
  return value;
}

function validateCredentials(body, registration) {
  const username = registration ? readText(body, 'username', 3, 80) : body.username;
  if (typeof username !== 'string' || !username.length || username.length > 1024) throw httpError(400, 'Проверьте формат логина.');
  const password = body.password;
  if (typeof password !== 'string' || password.length < (registration ? 10 : 1) || Buffer.byteLength(password, 'utf8') > (registration ? 72 : 4096)) {
    throw httpError(400, registration ? 'Пароль должен содержать не менее 10 символов и занимать не более 72 байт UTF-8.' : 'Проверьте формат пароля.');
  }
  return { username, password };
}

async function createApp(options = {}) {
  const secret = options.secret || process.env.JWT_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) throw new Error('Задайте JWT_SECRET длиной не менее 32 байт. Для первого запуска выполните npm run setup.');
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT || 3000);
  const appOrigin = new URL(options.origin || process.env.APP_ORIGIN || `http://localhost:${port}`).origin;
  if (production && !appOrigin.startsWith('https://')) throw new Error('В production задайте APP_ORIGIN с https://.');
  const filename = path.resolve(__dirname, options.filename || process.env.DB_PATH || 'university.db');
  const db = await openDatabase(filename);
  await db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'admin'))
    );
    CREATE TABLE IF NOT EXISTS student_profiles (
      user_id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      faculty TEXT,
      direction TEXT,
      course_year INTEGER,
      study_group TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
  `);
  const dummyHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
  app.use(helmet({
    contentSecurityPolicy: { directives: {
      defaultSrc: ["'self'"], scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'], connectSrc: ["'self'"],
      objectSrc: ["'none'"], formAction: ["'self'"], frameAncestors: ["'none'"],
      upgradeInsecureRequests: production ? [] : null
    } },
    strictTransportSecurity: production
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: '32kb' }));
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      if (req.get('origin') && req.get('origin') !== appOrigin) return next(httpError(403, 'Недопустимый источник запроса.'));
      if (req.get('sec-fetch-site') === 'cross-site') return next(httpError(403, 'Межсайтовый запрос отклонён.'));
      if (!req.is('application/json')) return next(httpError(415, 'Ожидается JSON.'));
    }
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: 'Слишком много попыток. Повторите через 15 минут.' }
  });
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'strict', path: '/' };
  app.use(['/api', '/login', '/register', '/profile', '/logout'], (req, res, next) => {
    res.set('Cache-Control', 'no-store'); next();
  });

  async function issueSession(user, req, res) {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = Math.floor(Date.now() / 1000);
    await db.run('DELETE FROM auth_sessions WHERE expires_at <= ?', now);
    await db.run('INSERT INTO auth_sessions(id, user_id, expires_at) VALUES (?, ?, ?)', sessionId, user.id, now + SESSION_SECONDS);
    const token = jwt.sign({ userId: user.id, role: user.role }, secret, {
      ...TOKEN_OPTIONS, subject: String(user.id), jwtid: sessionId, expiresIn: SESSION_SECONDS
    });
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_SECONDS * 1000 });
    // Сохраняем формат /login для существующих клиентов с Bearer-токеном.
    return req.path === '/login' ? { token, userId: user.id, role: user.role } : { userId: user.id, role: user.role };
  }

  async function authenticate(req, res, next) {
    const authorization = req.get('authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : req.cookies[COOKIE_NAME];
    if (!token) throw httpError(401, 'Войдите в кабинет.');
    let claims;
    try {
      claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: TOKEN_OPTIONS.issuer, audience: TOKEN_OPTIONS.audience });
    } catch { throw httpError(401, 'Сессия истекла. Войдите снова.'); }
    const user = await db.get(`SELECT users.id, users.username, users.role FROM users
      JOIN auth_sessions ON auth_sessions.user_id = users.id
      WHERE auth_sessions.id = ? AND users.id = ? AND auth_sessions.expires_at > ?`,
      claims.jti, claims.userId, Math.floor(Date.now() / 1000));
    if (!user) throw httpError(401, 'Сессия завершена. Войдите снова.');
    req.user = user;
    req.sessionId = claims.jti;
    next();
  }

  // Public registration disabled by campus update.
  app.all(['/api/register', '/register'], (req, res) => {
    res.status(403).json({ error: 'Самостоятельная регистрация закрыта. Используйте выданные логин и пароль.' });
  });

  app.post(['/api/login', '/login'], authLimit, async (req, res) => {
    const { username, password } = validateCredentials(req.body || {}, false);
    const user = await db.get('SELECT id, username, password_hash, role FROM users WHERE username = ?', username);
    const valid = await bcrypt.compare(password, user?.password_hash || dummyHash);
    if (!user || !valid) throw httpError(401, 'Неверный логин или пароль.');
    res.json(await issueSession(user, req, res));
  });

  app.get('/api/me', authenticate, async (req, res) => {
    const profile = await db.get('SELECT * FROM student_profiles WHERE user_id = ?', req.user.id);
    res.json({ user: req.user, profile: profile || null });
  });

  app.get(['/api/profile/:id', '/profile/:id'], authenticate, async (req, res) => {
    if (!/^[1-9]\d*$/.test(req.params.id)) throw httpError(400, 'Некорректный ID профиля.');
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id)) throw httpError(400, 'Некорректный ID профиля.');
    if (req.user.role !== 'admin' && req.user.id !== id) throw httpError(403, 'Вы можете просматривать только свой профиль.');
    const profile = await db.get('SELECT * FROM student_profiles WHERE user_id = ?', id);
    if (!profile) throw httpError(404, 'Профиль не найден.');
    res.json(profile);
  });

  app.post(['/api/logout', '/logout'], authenticate, async (req, res) => {
    await db.run('DELETE FROM auth_sessions WHERE id = ?', req.sessionId);
    res.clearCookie(COOKIE_NAME, cookieOptions);
    res.json({ message: 'Вы вышли из кабинета.' });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Метод API не найден.' }));
  app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    if (status >= 500) console.error('Ошибка запроса', error.code || error.name);
    res.status(status).json({ error: status >= 500 ? 'Ошибка сервера. Попробуйте позже.' : error.message });
  });
  return { app, db };
}

async function main() {
  const { app, db } = await createApp();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '127.0.0.1';
  const server = app.listen(port, host, () => console.log(`Кабинет запущен: ${process.env.APP_ORIGIN || `http://localhost:${port}`}`));
  function shutdown() { server.close(() => db.close().then(() => process.exit(0))); }
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { createApp };
