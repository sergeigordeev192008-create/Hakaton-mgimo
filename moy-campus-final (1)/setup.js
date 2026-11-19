'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const filename = path.join(__dirname, '.env');
if (fs.existsSync(filename)) {
  console.log('.env уже существует. Настройки сохранены.');
} else {
  fs.writeFileSync(filename, `PORT=3000\nHOST=127.0.0.1\nAPP_ORIGIN=http://localhost:3000\nDB_PATH=./university.db\nJWT_SECRET=${crypto.randomBytes(48).toString('hex')}\nNODE_ENV=development\n`, { mode: 0o600, flag: 'wx' });
  console.log('.env создан. Поместите существующий university.db рядом с server.js и выполните npm start.');
}
