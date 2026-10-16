# پل «کلاس زنده» (kelas-bridge v1)

<div dir="rtl">

این سند قرارداد ارتباط یک درس «کلاس زنده» با **سایت میزبان** است؛ یعنی صفحه‌ای که درس را داخل `<iframe>` نمایش می‌دهد، مثل یک سامانهٔ آموزشی. این پل از نسخهٔ **1.1.0** موتور در دسترس است؛ نسخهٔ **1.2.0** شناسنامهٔ ایستا، `contentMode` و خلاصهٔ نهایی را اضافه می‌کند (بخش «موتور ۱٫۲» در پایین).

نمونهٔ اجرایی: [`07-bridge-demo.html`](../07-bridge-demo.html)

## وضعیت نسخهٔ ۱٫۲٫۱

قرارداد فنی اتصال در [PYAMOOZ_CONTENT_CONTRACT.md](PYAMOOZ_CONTENT_CONTRACT.md) و راهنمای تولید در [AUTHORING_GUIDE.md](AUTHORING_GUIDE.md) است. کاربرگ با layout برابر worksheet از همین پل استفاده می‌کند. بازی‌ها پل جداگانهٔ pyamooz-game v1 از SDK واقعی میزبان دارند. init تکراری فعالیت را از نو نمی‌سازد؛ custom باید کارهای async را با api.onDispose کنار بگذارد. هر فعالیت تعاملی id ثابت دارد و خطای metadata ساخت را متوقف می‌کند.

## اصول

- **فایل درس مستقل می‌ماند.** بدون میزبان، مثل قبل کار می‌کند و پیشرفت را در `localStorage` نگه می‌دارد.
- **سازگار با iframe ایزوله:** با `sandbox="allow-scripts"` و بدون `allow-same-origin` کار می‌کند؛ یعنی مبدأ درس `null` است. ارتباط فقط از راه `postMessage` است و درس هیچ درخواست شبکه‌ای نمی‌فرستد (سازگار با `connect-src 'none'`).
- همهٔ پیام‌ها این شکل را دارند: `{ ns: 'kelas', v: 1, kind: … }`
- **درس فقط از `window.parent` پیام می‌پذیرد.** میزبان هم باید فقط پیام‌هایی را بپذیرد که `event.source === iframe.contentWindow` باشد.
- **درس هیچ اطلاعات هویتی نمی‌فرستد.** نام واردشده در صفحهٔ شروع، محلی است. هویت را میزبان می‌داند و خودش به رویدادها وصل می‌کند.

## درس ← میزبان

| `kind` | زمان ارسال | محتوا |
|---|---|---|
| `hello` | پس از بارگذاری، و در پاسخ به `ping` | `engine`، `session`، `storage` (آیا `localStorage` در دسترس است)، `caps`، `lesson` (شناسه، نسخه، عنوان، `maxStars`، اهداف، مراحل، **فرهنگ بدفهمی‌ها `tags`**، و **کاتالوگ اسلایدها `items`**) |
| `event` | هر تعامل | `type`، `ts`، `seq`، `session`، `lesson`، `mode`، `slide`، `data` |
| `state` | حدود ۸۰۰ میلی‌ثانیه پس از هر تغییر، فقط اگر میزبان `persist: true` داده باشد | وضعیت کامل برای ادامهٔ درس (به‌صورت شیء مبهم ذخیره شود) |
| `summary` | در پاسخ به فرمان `summary`؛ و از ۱٫۲ پس از پایان درس (بخش «موتور ۱٫۲») | خلاصهٔ کارکرد |

هر عضو کاتالوگ `items` این فیلدها را دارد: `id`، `idx`، `type`، `stage`، `gated`، `scored`، `q` (متن ساده)، `qhash` (برای تشخیص تغییر محتوا)، `tags` (بدفهمی‌های ممکن)، و `options` (برای چندگزینه‌ای و نظرسنجی).

> **شناسهٔ پایدار:** اگر اسلاید `id` داشته باشد، همان به کار می‌رود؛ وگرنه `s{شماره}`. برای درس‌هایی که بعد از انتشار ویرایش می‌شوند، **به هر اسلاید سنجیده‌شده `id` ثابت بدهید** تا داده‌های قبلی و بعدی قابل مقایسه بمانند. تغییر `qhash` یعنی متن پرسش عوض شده است.

## انواع رویداد (`event.type`)

| نوع | `data` |
|---|---|
| `session.start` | `resume`، `restart`، `embedded`، `hostPersist`، `storage`، `learner` |
| `session.pause` / `session.resume` | پنهان یا آشکار شدن صفحه |
| `session.restart` | `previous` (خلاصهٔ قبلی) |
| `slide.view` | `item`، `type`، `stage`، `index`، `from`، `prevDwellMs` (زمان ماندن در اسلاید قبل؛ حداکثر ۱۰ دقیقه) |
| `item.attempt` | `item`، `type`، `correct`، `attempt`، `hints`، `tags` (بدفهمی‌های این پاسخ)، `response` (`option` / `value` / `wrongItems` و `placement` / `order`)، `latencyMs` |
| `item.complete` | `item`، `stars`، `attempts`، `hints`، `latencyMs` |
| `item.done` | کامل شدن فعالیت‌های بی‌نمره یا نمایش پاسخ (`how`) |
| `item.reveal` / `item.explore` / `item.reset` | کارهای معلم در حالت ارائه |
| `item.tag` | بدفهمی‌ای که یک فعالیت سفارشی ثبت کرده |
| `hint.open` | `item`، `level`، `auto`، `attempts` |
| `steps.reveal` | `item`، `step`، `afterThink`، `latencyMs` |
| `poll.answer` / `poll.tally` | پاسخ فردی / شمارش رأی کلاس |
| `stage.complete` | `stage` |
| `badge.award` | `badge` |
| `self.assess` | `objective`، `level`، `of` |
| `reflect.submit` | `text` (حداکثر ۲۰۰۰ نویسه)، `length` |
| `report.copy` | — |
| `brand.open` / `brand.click` / `brand.copy` | باز شدن کارت امضا (دکمهٔ 🎓)، کلیک روی `target` (`site`، `channel`، `phone`، `qr`) در `where` (`end`، `menu`، `start`)، کپی نشانی‌ها. در iframe بدون `allow-popups` پیوندها باز نمی‌شوند؛ میزبان می‌تواند با این رویداد خودش نشانی را باز کند. |
| `lesson.complete` | خلاصهٔ کامل: ستاره، درصد، نشان‌ها، بدفهمی‌ها، خودارزیابی، زمان، و وضعیت هر اسلاید |
| `mode.change`، `class.think`، `class.timer` | رویدادهای کلاس در حالت ارائه |
| `custom.*` | داده‌ای که فعالیت‌های سفارشی با `api.emit()` می‌فرستند |
| `host.connected` | `persist`، `resumed` |

## میزبان ← درس

| `kind` | کاربرد |
|---|---|
| `ping` | درخواست ارسال دوبارهٔ `hello` |
| `init` | `{ persist: bool, learner: { id, name }, state?: object, mode?: 'student' \| 'present' }`؛ اگر درس هنوز شروع نشده باشد، `state` بارگذاری می‌شود و گزینهٔ «ادامه» ظاهر می‌شود. |
| `command` | `{ command: 'goto', slide: n }` · `{ command: 'mode', mode }` · `{ command: 'summary' }` |

## نمونهٔ کد میزبان

```js
const frame = document.querySelector('iframe');
addEventListener('message', (e) => {
  if (e.source !== frame.contentWindow) return;
  const m = e.data;
  if (!m || m.ns !== 'kelas' || m.v !== 1) return;
  if (m.kind === 'hello') {
    frame.contentWindow.postMessage({ ns: 'kelas', v: 1, kind: 'init', persist: true,
      learner: { id: 'u42' }, state: loadSavedState() }, '*');
  }
  if (m.kind === 'state') saveState(m.state);   // حداکثر اندازه را کنترل کنید
  if (m.kind === 'event') queueForServer(m);    // دسته‌ای و با محدودیت نرخ بفرستید
});
```

## موتور ۱٫۲

درس‌های ساخته‌شده با ۱٫۱ بدون تغییر اجرا می‌شوند؛ پوستهٔ پیام‌ها همان `{ ns: 'kelas', v: 1 }` است.

### شناسنامهٔ ایستا (`kz-meta`)

build برای هر درسی که `id` معتبر (`^[a-z0-9][a-z0-9-]{0,63}$`) دارد، دقیقاً یک بلوک
`<script type="application/json" id="kz-meta">` در `<head>` می‌گذارد تا میزبان **بدون اجرای JavaScript** درس را بشناسد.
سازنده: [`_src/kz-meta.js`](../_src/kz-meta.js) (فایل محتوا را در Node با DOM ساختگی اجرا می‌کند و شیء `LESSON` را می‌خواند). درس بدون `id` معتبر، HTML ساده و بدون شناسنامه می‌ماند و build هشدار می‌دهد؛ `id` تکراری اسلاید build را متوقف می‌کند.

فیلدها: `kz` (همیشه ۱)، `engine`، `id`، `version`، `title`، `subtitle`، `grade`، `subject`، `duration`، `durationMinutes`، `contentMode`، `licenseNumber`، `objectives`، `concepts`، `prerequisites`، `stages` (`id`، `title`)، `maxStars`، `misconceptions` (`tag`، `title`، `review` از `LESSON.tags`) و `items`.
هر عضو `items` همان قواعد کاتالوگ موتور را دارد: `id`، `idx`، `type`، `stage`، `gated`، `scored`، `q` (متن ساده، حداکثر ۱۶۰ نویسه؛ هر برچسب HTML یک فاصله می‌شود) و `tags`.
میزبان سازگاری ذخیره را از ترتیب `idx`/`id`/`type` حساب می‌کند؛ جابه‌جایی یا افزودن اسلاید، ادامهٔ قبلی را نامعتبر می‌کند.

فیلدهای تازهٔ شیء `LESSON`:

| فیلد | معنا |
|---|---|
| `version` | عدد صحیح مثبت نسخهٔ محتوا؛ با هر تغییر خروجی منتشرشده یکی بیشتر شود |
| `contentMode` | `syllabus` (پیش‌فرض: سرفصل‌محور، بیان و مثال از خودمان) یا `textbook-licensed` (مطابق کتاب؛ فقط با `licenseNumber`) |
| `durationMinutes`، `concepts`، `prerequisites` | برای کاتالوگ میزبان |
| `id` در هر اسلاید سنجیده‌شده | شناسهٔ پایدار؛ بدون آن موتور در کنسول هشدار می‌دهد و میزبان گزارش نسخه‌ها را قابل مقایسه نمی‌داند |

### تغییرات پیام‌ها

- `hello.lesson.contentMode` و `event.lesson.engine` (هر رویداد نسخهٔ موتور را با خود دارد).
- خلاصه (`summary()`) فیلدهای `selfComplete`، `completed` و `contentMode` را هم دارد. `pct` درصد نمره است، نه درصد پیمودن؛ `tries` شمار پاسخ‌های نادرست است.
- **خلاصهٔ نهایی:** `lesson.complete` هنگام ورود به اسلاید پایان، پیش از خودارزیابی، فرستاده می‌شود. پس از کامل‌شدن خودارزیابی (`reason: 'self'`)، ثبت تأمل (`'reflect'`) و ترک صفحه (`'leave'`) رویداد `lesson.summary` و **پیام مستقل** `{ kind: 'summary', session, lesson, summary }` فرستاده می‌شوند. هر خلاصه جای قبلی را می‌گیرد؛ `summary.final` وقتی `true` است که خودارزیابی کامل شده باشد (یا درس هدفی نداشته باشد) و `summary.reflect` متن تأمل است. پس از «شروع دوباره»، خلاصهٔ معوقِ نوبت قبلی فرستاده نمی‌شود.
- در نمایهٔ `academic` با `renderEnd` سفارشی، خودارزیابی پیش‌فرض نمایش داده نمی‌شود؛ خلاصهٔ چنین درسی فقط هنگام ترک صفحه فرستاده می‌شود و اگر درس هدف داشته باشد `final: false` است.

## «کد گزارش» (برای کلاس‌های آفلاین)

دکمهٔ «کپی گزارش» در انتهای متن یک خط `🔑 کد گزارش: KZ1.…` اضافه می‌کند: یک JSON فشرده که با base64url رمزگذاری شده است.

```json
{ "k":"KZ", "v":1, "l":"شناسهٔ درس", "lv":1, "s":ستاره, "m":سقف, "b":[نشان‌ها], "t":{بدفهمی: تعداد},
  "a":{هدف: سطح}, "i":{"شناسهٔ اسلاید":[انجام‌شده, تلاش‌های نادرست, راهنما, ستاره]}, "d":ثانیه, "ts":زمان }
```

دانش‌آموزی که درس را آفلاین (از پیام‌رسان) انجام داده، متن را برای معلم می‌فرستد و سامانه می‌تواند کد را بخواند. با `reportCode: false` در شیء `LESSON` این خط حذف می‌شود.

## ملاحظات امنیت و حریم خصوصی برای میزبان

- داده‌های درس از سمت کاربر می‌آیند و **قابل جعل‌اند.** برای تحلیل آموزشی مناسب‌اند، نه برای نمره‌ی رسمی یا صدور گواهی.
- برای `state` سقف اندازه (مثلاً ۲۵۶ کیلوبایت) و برای رویدادها محدودیت نرخ بگذارید.
- متن `reflect.submit` نوشتهٔ آزاد دانش‌آموز است: هنگام نمایش escape کنید و با آن مثل دادهٔ شخصی رفتار کنید.
- دادهٔ خام را فقط تا جای لازم نگه دارید و گزارش‌ها را از داده‌های تجمیعی بسازید.

</div>
