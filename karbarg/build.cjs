'use strict';
// ساخت کاربرگ: node build.cjs [worksheet.html]
const fs = require('node:fs'), path = require('node:path');
const {compileLesson} = require('./engine/build');
const file = process.argv[2] || 'worksheet.html';
if (!/^worksheet(?:-[a-z0-9]+)?\.html$/.test(file)) throw Error('نام خروجی باید worksheet.html یا worksheet-نام.html باشد.');
const html = compileLesson({kind: 'worksheet', title: 'کاربرگ پای‌آموز', base: __dirname, sources: ['lesson.js'], css: ['worksheet.css']}, file);
fs.writeFileSync(path.join(__dirname, file), html, 'utf8');
console.log('ساخت موفق: ' + path.join(__dirname, file));
console.log('این بررسی ساخت است؛ صحت آموزشی و رفتار در مرورگر و گوشی جداگانه آزموده می‌شوند.');
