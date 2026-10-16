// Compatibility entry point: node _src/build.js [--only=05-template.html]
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const KZ = require('./kz-meta');
const {escapeHtml, inlineScript, read, contained, validatePackage, writeOutputs} = require('./build-common');
const ROOT = path.resolve(__dirname, '..');
const S = (f) => read(contained(__dirname, f));
const has = (...names) => names.every((name) => fs.existsSync(contained(__dirname, name)));

function lessonPlan() {
  const jobs = {};
  const add = (output, title, sources, css = [], body = null, kind = 'lesson') => {
    jobs[output] = {kind, title, sources, css, body};
  };
  add('index.html', 'کلاس زنده — درس، کاربرگ و بازی تعاملی', [], [], 'index-page.html', 'tool');
  add('01-workshop.html', 'یک فایل، یک کلاس زنده — کارگاه', ['toolkit.js', 'workshop.js']);
  add('02-lesson-fractions.html', 'قنادی آقای کسری — مقایسهٔ کسرها', ['lesson-fractions.js']);
  add('03-lesson-density.html', 'راز شناوری — چگالی', ['lesson-density.js']);
  if (has('fraction-lab.js', 'lesson-fraction-add-sub.js', 'fraction-lab.css')) add('08-lesson-fraction-add-sub.html', 'آزمایشگاه نوشیدنی رنگین', ['fraction-lab.js', 'lesson-fraction-add-sub.js'], ['fraction-lab.css']);
  if (has('medical-model.js', 'term-popover.js', 'medical-activities.js', 'lesson-medical.js', 'medical.css')) add('09-medical-terminology.html', 'از اصطلاح تا تصویر — زبان پزشکی', ['medical-model.js', 'term-popover.js', 'medical-activities.js', 'lesson-medical.js'], ['medical.css']);
  add('04-prompt-kit.html', 'جعبه‌ابزار کلاس زنده', ['toolkit.js', 'kit-page.js'], [], null, 'tool');
  add('05-template.html', 'قالب کلاس زنده', ['template.js']);
  add('07-bridge-demo.html', 'میزبان نمونهٔ کلاس زنده', ['bridge-demo.js'], [], 'bridge-demo-body.html', 'host');
  add('worksheets/worksheet-template.html', 'کاربرگ تعاملی — حالت‌های ماده', ['worksheet-template.js'], [], null, 'worksheet');
  add('worksheets/police-day.html', 'با پلیس آشنا شویم — کاربرگ روز پلیس', ['police-day/art.js', 'police-day/activities.js', 'police-day/lesson.js'], ['police-day/style.css'], null, 'worksheet');
  if (has('bagh-sedaha/audio-data.js', 'bagh-sedaha/model.js', 'bagh-sedaha/activities.js', 'bagh-sedaha/lesson.js', 'bagh-sedaha/style.css')) add('worksheets/bagh-sedaha.html', 'باغ صداها — کاربرگ شنیداری آ و ب', ['bagh-sedaha/audio-data.js', 'bagh-sedaha/model.js', 'bagh-sedaha/activities.js', 'bagh-sedaha/lesson.js'], ['bagh-sedaha/style.css'], null, 'worksheet');
  const names = ['comparison', 'logic', 'conditions', 'functions', 'return', 'shipping-practice'];
  if (has('js-section2.js', 'js-code-lab.js', 'js-code-lab.css')) names.forEach((name, i) => add('جاوا اسکریپت/' + String(i + 7).padStart(2, '0') + '-' + name + '.html', 'جاوااسکریپت — درس ' + (i + 7), ['code-interpreter.js', 'js-code-lab.js', 'js-section2.js', {code: 'var LESSON = JSSection2.make(' + (i + 7) + ');'}], ['js-code-lab.css']));
  if (has('js-course-index.html', 'js-course-index.css')) add('جاوا اسکریپت/index.html', 'جاوااسکریپت — تصمیم‌گیری و تابع', [], ['js-course-index.css'], 'js-course-index.html', 'tool');
  const optional = [
    ['06-proposal.html', 'فلسفه، تعاملی می‌شود', ['proposal.js']],
    ['riazi6/01-kashi-va-adad.html', 'کارگاه کاشی و عدد', ['riazi6/lesson01.js'], ['riazi6/riazi6.css']],
    ['riazi6/02-ramz-3-va-9.html', 'رمز ۳ و ۹', ['riazi6/lesson02.js'], ['riazi6/riazi6.css']],
    ['motaleat5/05-jamiat-iran.html', 'جمعیت ایران', ['motaleat5/lesson05.js']],
    ['falsafe12/01-hast-va-chist.html', 'هست و چیست', ['falsafe12/lesson01.js']],
  ];
  optional.forEach(([out, title, src, styles = []]) => { if (has(...src, ...styles)) add(out, title, src, styles); });
  ['avvalin-dastoor', 'noe-meghdarha', 'kar-ba-matn', 'amalgarha-va-moghayese', 'tasmim-giri', 'tekrar', 'arayeha', 'tavabe', 'arayeha-modern', 'ashya'].forEach((name, i) => {
    const source = 'javascript/lesson' + String(i + 1).padStart(2, '0') + '.js';
    if (has('console-lab.js', source)) add('javascript/' + String(i + 1).padStart(2, '0') + '-' + name + '.html', 'جاوااسکریپت از صفر — درس ' + (i + 1), ['code-interpreter.js', 'console-lab.js', source]);
  });
  /* درس ۱۱ خارج از حلقهٔ بالاست چون دو فایل ارائه است، نه یک درس تعاملی. */
  [['lesson11a.js', '11-dom-1-safhe.html', 'جاوااسکریپت از صفر — درس ۱۱ بخش ۱: صفحه را به دست بگیر'],
   ['lesson11b.js', '11-dom-2-royedad.html', 'جاوااسکریپت از صفر — درس ۱۱ بخش ۲: صفحه جواب می‌دهد']].forEach(([file, out, title]) => {
    if (has('console-lab.js', 'javascript/' + file)) add('javascript/' + out, title, ['code-interpreter.js', 'console-lab.js', 'javascript/' + file]);
  });
  ['farman-dast-kist', 'hayajanam-chi-miguyad', 'dadgah-tatil'].forEach((name, i) => {
    const source = 'omid/lesson' + String(i + 1).padStart(2, '0') + '.js';
    if (has('omid/_kit.js', 'omid/omid.css', source)) add('omid/' + String(i + 1).padStart(2, '0') + '-' + name + '.html', 'امید از همین‌جا — جلسهٔ ' + (i + 1), ['omid/_kit.js', source], ['omid/omid.css']);
  });
  for (const [name, title] of [['insights', 'بارش فکری پنل یادگیری'], ['plan', 'برنامهٔ اجرایی'], ['catalog', 'ویترین و داشبورد']]) {
    const prefix = {insights: '01-learning-insights', plan: '02-execution-plan', catalog: '03-catalog-dashboard'}[name];
    if (has('planning/' + name + '.js', 'planning/' + name + '-body.html')) add('_planning/' + prefix + '.html', title, ['planning/' + name + '.js'], [], 'planning/' + name + '-body.html', 'tool');
  }
  const directory = path.join(ROOT, 'content');
  if (fs.existsSync(directory)) for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    if (!entry.isDirectory()) continue;
    const base = path.join(directory, entry.name), definition = path.join(base, 'content.json');
    if (!fs.existsSync(definition)) continue;
    const spec = JSON.parse(read(definition));
    if (!['lesson', 'worksheet'].includes(spec.kind) || !KZ.ID_RE.test(spec.id) || spec.id !== entry.name) throw Error(definition + ': نوع یا شناسهٔ محتوا نامعتبر است.');
    const modules = spec.modules || [];
    if (!Array.isArray(modules) || modules.some((name) => !['code-lab', 'console-lab'].includes(name))) throw Error(definition + ': ماژول ناشناخته؛ code-lab یا console-lab مجاز است.');
    const sharedSources = modules.length ? ['code-interpreter.js'] : [];
    if (modules.includes('code-lab')) sharedSources.push('js-code-lab.js');
    if (modules.includes('console-lab')) sharedSources.push('console-lab.js');
    jobs['content/' + spec.id + '.html'] = {kind: spec.kind, expectedId: spec.id, title: spec.title, base, sources: [spec.source || 'lesson.js'], css: spec.css || [], sharedSources, sharedCss: modules.includes('code-lab') ? ['js-code-lab.css'] : []};
  }
  return jobs;
}

function compileLesson(job, output) {
  const isLesson = ['lesson', 'worksheet'].includes(job.kind);
  const source = (name) => job.base ? read(contained(job.base, name)) : S(name);
  const scripts = (job.sharedSources || []).map(S).concat(job.sources.map((entry) => typeof entry === 'string' ? source(entry) : entry.code));
  let meta = '';
  if (isLesson) {
    const L = KZ.loadLesson(scripts);
    if (!L || !Array.isArray(L.slides) || !L.slides.length || L.slides.filter((s) => s && s.type === 'end').length !== 1 || L.slides[L.slides.length - 1]?.type !== 'end') throw Error(output + ': محتوا باید فعالیت و دقیقاً یک پایان در آخر داشته باشد.');
    if (job.expectedId && L.id !== job.expectedId) throw Error(output + ': شناسهٔ منبع و content.json باید یکسان باشند.');
    if (job.kind === 'worksheet' && L.layout !== 'worksheet') throw Error(output + ': layout کاربرگ باید worksheet باشد.');
    meta = KZ.block(KZ.metaFor(L, (S('engine.js').match(/var ENGINE_VERSION = '([^']+)'/) || [])[1]));
    scripts.push(S('brand.js'), S('brand-qr.js'), S('engine.js'));
    if (job.sources.includes('lesson-medical.js')) scripts.push('TermPopover.init(MedicalModel.terms);');
  } else if (job.sources.includes('toolkit.js')) scripts.unshift(S('brand.js'), S('brand-qr.js'));
  const font = fs.readFileSync(path.join(ROOT, 'fonts/Vazirmatn-Variable.woff2')).toString('base64');
  const css = '@font-face{font-family:Vazirmatn;src:url(data:font/woff2;base64,' + font + ') format("woff2");font-weight:100 900;font-display:swap}\n' + S('engine.css') + '\n' + S('brand.css') + '\n' + (job.sharedCss || []).map(S).concat(job.css.map(source)).join('\n');
  const html = '<!doctype html>\n<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + escapeHtml(job.title) + '</title>' + meta + '<style>\n' + css + '\n</style></head><body>' + (job.body ? source(job.body) : '<div id="app"></div>') + '\n' + scripts.map((code) => '<script>\n' + inlineScript(code) + '\n</script>').join('\n') + '\n</body></html>\n';
  // Tools and the sample host intentionally contain a frame; they are never uploadable lessons.
  return isLesson ? validatePackage(html, output) : html;
}

function buildLessons({only = null, kind = null, outputRoot = ROOT, write = true} = {}) {
  const plan = lessonPlan(), outputs = {};
  if (only) for (const name of only) if (!Object.hasOwn(plan, name)) throw Error('خروجی ناشناخته: ' + name);
  for (const [name, job] of Object.entries(plan)) if ((!only || only.includes(name)) && (!kind || job.kind === kind)) outputs[name] = compileLesson(job, name);
  if (!Object.keys(outputs).length) throw Error('هیچ محتوایی با این انتخاب پیدا نشد.');
  if (write) writeOutputs(outputRoot, outputs);
  return outputs;
}
if (require.main === module) {
  const only = process.argv.find((value) => value.startsWith('--only='))?.slice(7).split(',') || null;
  const output = process.argv.find((value) => value.startsWith('--out='))?.slice(6) || ROOT;
  for (const [name, html] of Object.entries(buildLessons({only, outputRoot: path.resolve(output)}))) console.log(name + ' · ' + Buffer.byteLength(html) + ' bytes');
}
module.exports = {ROOT, lessonPlan, compileLesson, buildLessons};
