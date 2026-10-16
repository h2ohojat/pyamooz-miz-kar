'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {contained, read, validatePackage, writeOutputs} = require('../build-common');
const {validateManifest} = require('./manifest');
const ROOT = path.resolve(__dirname, '../..');

function gamePlan({only = null} = {}) {
  const jobs = {};
  for (const directory of [__dirname, path.join(ROOT, 'content')]) {
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (only && !only.includes(entry.name)) continue;
      const base = path.join(directory, entry.name), file = path.join(base, 'manifest.json');
      if (!entry.isDirectory() || !fs.existsSync(file)) continue;
      const manifest = validateManifest(JSON.parse(read(file)));
      if (manifest.id !== entry.name || jobs[manifest.id]) throw Error(file + ': شناسهٔ پوشه و بازی باید یکسان و یکتا باشد.');
      jobs[manifest.id] = {base, manifest};
    }
  }
  return jobs;
}

function checkSdkLock() {
  const lock = JSON.parse(read(path.join(__dirname, 'sdk-lock.json')));
  for (const [name, digest] of Object.entries(lock.files)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(contained(__dirname, name))).digest('hex');
    if (actual !== digest) throw Error(name + ': SDK یا توکن‌های مرجع تغییر کرده‌اند؛ از sync-host.js استفاده کنید.');
  }
  return lock;
}

function compileGame({base, manifest}) {
  checkSdkLock();
  const inline = (file) => read(file).replace(/^import .+;\s*$/gm, '').replace(/^export /gm, '');
  const font = fs.readFileSync(path.join(ROOT, 'fonts/Vazirmatn-Variable.woff2')).toString('base64');
  const replace = {
    '<!--@META@-->': '<script type="application/json" id="pyamooz-game-meta">' + JSON.stringify(manifest).replace(/</g, '\\u003c') + '</script>',
    '/*@FONT@*/': '@font-face{font-family:Vazirmatn;src:url(data:font/woff2;base64,' + font + ') format("woff2");font-weight:100 900;font-display:swap}',
    '/*@SDK@*/': ['protocol.js', 'sdk.js'].map((name) => inline(path.join(__dirname, 'shared', name))).join('\n'),
    '/*@GAME@*/': inline(path.join(base, 'game.js')),
    '/*@TOKENS@*/': read(path.join(__dirname, 'shared/tokens.css')),
    '/*@STYLE@*/': read(path.join(__dirname, 'shared/style.css')),
    '/*@UI@*/': inline(path.join(__dirname, 'shared/ui.js')),
    '/*@LEGACY@*/': inline(path.join(__dirname, 'shared/legacy-clock.js')),
  };
  let html = read(path.join(base, 'index.html'));
  if (html.includes('/*@LOGIC@*/')) replace['/*@LOGIC@*/'] = inline(path.join(base, 'logic.js'));
  for (const marker of ['<!--@META@-->', '/*@FONT@*/', '/*@SDK@*/', '/*@GAME@*/']) if (html.split(marker).length !== 2) throw Error(manifest.id + ': دقیقاً یک جایگزین لازم است: ' + marker);
  for (const [marker, source] of Object.entries(replace)) {
    if (html.split(marker).length > 2) throw Error(manifest.id + ': جایگزین تکراری: ' + marker);
    html = html.replace(marker, () => source);
  }
  if (/\/\*@\w+@\*\/|<!--@\w+@-->/.test(html)) throw Error(manifest.id + ': جایگزین ناشناخته باقی مانده است.');
  return validatePackage(html, manifest.id);
}

function buildGames({only = null, outputRoot = ROOT, write = true} = {}) {
  const plan = gamePlan({only}), outputs = {}, immutable = [];
  if (only) for (const id of only) if (!Object.hasOwn(plan, id)) throw Error('بازی ناشناخته: ' + id);
  for (const [id, job] of Object.entries(plan)) {
    if (only && !only.includes(id)) continue;
    const html = compileGame(job), versioned = 'games/' + id + '-v' + job.manifest.version + '.html';
    outputs[versioned] = html;
    outputs['games/' + id + '.html'] = html;
    immutable.push(versioned);
  }
  if (!Object.keys(outputs).length) throw Error('هیچ بازی‌ای انتخاب نشد.');
  if (write) writeOutputs(outputRoot, outputs, {immutable});
  return {outputs, immutable};
}
if (require.main === module) {
  const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7).split(',').map((name) => name.replace(/\.html$/, '')) || null;
  const outputRoot = path.resolve(process.argv.find((arg) => arg.startsWith('--out='))?.slice(6) || ROOT);
  for (const [file, html] of Object.entries(buildGames({only, outputRoot}).outputs)) console.log(file + ' · ' + Buffer.byteLength(html) + ' bytes');
}
module.exports = {ROOT, gamePlan, checkSdkLock, compileGame, buildGames};
