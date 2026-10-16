'use strict';
// ساخت بازی: node build.cjs [my-game]
const fs = require('node:fs'), path = require('node:path');
const {gamePlan, compileGame} = require('./engine/games/build');
const id = process.argv[2] || 'my-game';
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) throw Error('شناسهٔ بازی نامعتبر است.');
const job = gamePlan({only: [id]})[id];
if (!job) throw Error('پوشهٔ content/' + id + ' با manifest.json پیدا نشد.');
const html = compileGame(job), file = path.join(__dirname, id + '.html');
fs.writeFileSync(file, html, 'utf8');
console.log('ساخت موفق: ' + file + ' · نسخهٔ ' + job.manifest.version);
console.log('این بررسی ساخت است؛ بازی کردن و ذخیره و ادامه در مرورگر و گوشی جداگانه آزموده می‌شوند.');
