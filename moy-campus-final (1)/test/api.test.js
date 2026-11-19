'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { createApp } = require('../server');

test('регистрация, старая база, разделение профилей и выход', async t => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'campus-api-'));
  const filename = path.join(directory, 'existing.db');
  // Имитируем базу, созданную исходным кодом пользователя.
  const existing = await open({ filename, driver: sqlite3.Database });
  await existing.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('student','admin')));
    CREATE TABLE student_profiles(user_id INTEGER PRIMARY KEY, full_name TEXT NOT NULL, faculty TEXT,
    direction TEXT, course_year INTEGER, study_group TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE);`);
  await existing.run('INSERT INTO users VALUES(1, ?, ?, ?)', 'old_student', await bcrypt.hash('ExistingPassword123', 10), 'student');
  await existing.run('INSERT INTO student_profiles VALUES(1, ?, ?, ?, ?, ?)', 'Иванов Иван', 'Факультет', 'Направление', 2, 'Г-2');
  await existing.close();
  const { app, db } = await createApp({ filename, secret:'testing-secret-with-at-least-thirty-two-bytes', origin:'http://localhost:3000' });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await db.close();await rm(directory, { recursive:true, force:true });
  });
  async function request(route, options={}) {
    const response=await fetch(base+route, { ...options, headers:{'Content-Type':'application/json',...options.headers} });
    return { status:response.status, body:await response.json(), headers:response.headers };
  }
  const payload = username => ({ username,password:'StudentPassword123',full_name:'Студент '+username,faculty:'МО',direction:'Международные отношения',course_year:3,study_group:'МО-3',role:'admin' });
  const post = (route, body, headers={}) => request(route,{method:'POST',body:JSON.stringify(body),headers});
  assert.equal((await request('/api/me')).status,401);
  assert.equal((await post('/api/register',{username:'bad'})).status,403);
  assert.equal((await post('/api/register',payload('crosssite'),{Origin:'https://attacker.example'})).status,403);
  const oldLogin=await post('/login',{username:'old_student',password:'ExistingPassword123'});
  assert.equal(oldLogin.status,200);
  const oldBearer={Authorization:'Bearer '+oldLogin.body.token};
  assert.equal((await request('/profile/1',{headers:oldBearer})).body.full_name,'Иванов Иван');
  assert.equal((await post('/api/login',{username:"' OR 1=1 --",password:'StudentPassword123'})).status,401);
  assert.equal((await post('/register',payload('new_student'))).status,403);
  const hash = await bcrypt.hash('StudentPassword123', 10);
  for (const username of ['parallel0', 'parallel1']) {
    const user = await db.run('INSERT INTO users(username,password_hash,role) VALUES(?,?,?)', username, hash, 'student');
    await db.run('INSERT INTO student_profiles(user_id,full_name) VALUES(?,?)', user.lastID, 'Студент '+username);
  }
  const login=await post('/api/login',{username:'parallel0',password:'StudentPassword123'});
  assert.equal(login.status,200);
  assert.equal(login.body.role,'student');
  assert.equal(login.body.token,undefined);
  const cookie=login.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);
  const cookieHeader={Cookie:cookie.split(';')[0]};
  const me=await request('/api/me',{headers:cookieHeader});
  assert.equal(me.body.profile.full_name,'Студент parallel0');
  assert.equal(me.body.user.password_hash,undefined);
  assert.equal((await request('/profile/1',{headers:cookieHeader})).status,403);
  assert.equal((await request('/profile/1abc',{headers:oldBearer})).status,400);
  assert.equal((await fetch(base+'/.env')).status,404);
  const secondLogin=await post('/login',{username:'parallel1',password:'StudentPassword123'});
  const secondBearer={Authorization:'Bearer '+secondLogin.body.token};
  assert.equal((await request('/profile/'+me.body.user.id,{headers:secondBearer})).status,403);
  assert.equal((await post('/api/logout',{},cookieHeader)).status,200);
  assert.equal((await request('/api/me',{headers:cookieHeader})).status,401);
  assert.equal((await request('/api/me',{headers:secondBearer})).status,200);
  assert.equal((await post('/logout',{},oldBearer)).status,200);
  assert.equal((await request('/profile/1',{headers:oldBearer})).status,401);
  const orphan=await db.get('SELECT COUNT(*) AS count FROM users LEFT JOIN student_profiles ON users.id=student_profiles.user_id WHERE student_profiles.user_id IS NULL');
  assert.equal(orphan.count,0);
  const html=await fetch(base+'/');assert.equal(html.status,200);assert.match(await html.text(),/app.js/);
});

test('сервер требует секрет и HTTPS в production', async () => {
  await assert.rejects(createApp({secret:'short'}),/JWT_SECRET/);
  await assert.rejects(createApp({secret:'a'.repeat(40),production:true,origin:'http://localhost:3000'}),/https/);
});
