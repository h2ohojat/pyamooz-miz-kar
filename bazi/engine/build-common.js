'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MAX_HTML = 5 * 1024 * 1024;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const inlineScript = (code) => String(code).replace(/<\/script/gi, '<\\/script');
const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');

function contained(root, relative) {
  const destination = path.resolve(root, relative);
  const part = path.relative(root, destination);
  if (!part || part.startsWith('..' + path.sep) || part === '..' || path.isAbsolute(part)) throw Error('مسیر خارج از پوشهٔ محتوا مجاز نیست: ' + relative);
  return destination;
}

function validatePackage(html, name) {
  if (Buffer.byteLength(html) > MAX_HTML) throw Error(name + ': حجم فایل بیشتر از ۵ MiB است.');
  if (!/^<!doctype html>/i.test(html) || !/<html\b[^>]*\blang="fa"[^>]*\bdir="rtl"/i.test(html)) throw Error(name + ': بسته باید HTML کامل فارسی و راست‌به‌چپ باشد.');
  if (/<iframe\b/i.test(html) || /\b(?:eval\s*\(|new\s+Function\s*\()/.test(html)) throw Error(name + ': قاب داخلی یا اجرای پویای کد با CSP میزبان سازگار نیست.');
  if (/\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\s*\(|sendBeacon\s*\()/.test(html)) throw Error(name + ': درخواست شبکه در محتوا مجاز نیست.');
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, '$1$2');
  if (/\b(?:src|poster)\s*=\s*["'](?!data:|blob:|#)[^"']+/i.test(markup) || /<link\b[^>]*\bhref=\s*["'](?!data:|blob:|#)/i.test(markup)) throw Error(name + ': دارایی بیرونی باید داخل فایل جاسازی شود.');
  if (/url\(\s*["']?(?:https?:|\/\/|\.\.?\/)/i.test(html)) throw Error(name + ': CSS به دارایی بیرونی وابسته است.');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\btype=["']application\/json["']/i.test(match[1])) { JSON.parse(match[2]); continue; }
    new vm.Script(match[2], {filename: name});
  }
  return html;
}

/** Validate the whole selected set before writing even its first file. */
function writeOutputs(root, outputs, {immutable = []} = {}) {
  for (const [name, html] of Object.entries(outputs)) {
    const file = contained(root, name);
    if (immutable.includes(name) && fs.existsSync(file) && fs.readFileSync(file, 'utf8') !== html) throw Error(name + ': خروجی این نسخه موجود است؛ version را افزایش دهید.');
  }
  for (const [name, html] of Object.entries(outputs)) {
    const file = contained(root, name);
    fs.mkdirSync(path.dirname(file), {recursive: true});
    if (fs.existsSync(file) && read(file) === html) continue;
    const temporary = file + '.building-' + process.pid;
    try { fs.writeFileSync(temporary, html, {encoding: 'utf8', flag: 'wx'}); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
}

module.exports = {MAX_HTML, contained, escapeHtml, inlineScript, read, validatePackage, writeOutputs};
