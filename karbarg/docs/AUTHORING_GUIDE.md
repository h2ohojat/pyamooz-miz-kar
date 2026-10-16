# ساخت درس، کاربرگ و بازی با موتور یکپارچهٔ پای‌آموز

نسخهٔ ابزار: ۱٫۰٫۰؛ موتور درس/کاربرگ: ۱٫۲٫۱؛ پل‌های درس و بازی: نسخهٔ ۱.
نویسنده: OpenAI Codex، مبتنی بر GPT-6، به درخواست مالک، ۲۰۲۶-۱۰-۰۲.

ابتدا AGENTS.md و PYAMOOZ_CONTENT_CONTRACT.md را بخوانید. اعتبار الزام از تصمیم مالک برای حفظ ذخیره و گزارش دانش‌آموز می‌آید. هر محتوا باید منبع، شناسهٔ ثابت و نسخهٔ مشخص داشته باشد.

## انتخاب قالب

| هدف | منبع | قرارداد میزبان |
| --- | --- | --- |
| درس با نمایش مرحله‌ای | `content/<id>/lesson.js` و `content.json` | `kz-meta` و `kelas v1` |
| کاربرگ چندتمرینی در یک صفحه | همان LESSON با `layout: 'worksheet'` | همان قرارداد درس؛ از پنل درس بارگذاری می‌شود |
| بازی با دور، توقف و رکورد | `content/<id>/manifest.json`، `index.html`، `game.js` | `pyamooz-game-meta` و `pyamooz-game v1` |

این‌ها یک ابزار ساخت و بررسی و منابع مشترک دارند. جدا بودن پیام و گزارش بازی از درس، بخشی از سازگاری با سایت است. کلاس، route یا جدول اختصاصی برای معرفی محتوای تازه ساخته نمی‌شود.

## ساخت محتوای تازه

از پوشهٔ همین مخزن:

```text
node _src/content.js new lesson my-lesson "درس من"
node _src/content.js new worksheet my-worksheet "کاربرگ من"
node _src/content.js new game my-game "بازی من"
node _src/content.js list
```

هر فرمان new پوشه‌ای مستقل می‌سازد و پوشهٔ موجود را بازنویسی نمی‌کند. game از نمونهٔ حافظه آغاز می‌شود؛ قواعد، طرح، معیارها و راهنمای آن را با بازی خودتان جایگزین کنید. worksheet از قالب تمرین حالت‌های ماده آغاز می‌شود. نمونهٔ آماده به‌معنی تکمیل محتوای آموزشی تازه نیست.

فقط منبع را ویرایش کنید؛ فایل HTML خروجی را دستی تغییر ندهید. برای محتوای انتشار‌یافته، `version` را افزایش دهید. `id` درس/بازی و فعالیت‌های موجود ثابت می‌مانند. تغییر ناسازگار state بازی، `stateSchemaVersion` تازه می‌خواهد.

```text
node _src/content.js check --kind=worksheet --only=content/my-worksheet.html
node _src/content.js build --kind=worksheet --only=content/my-worksheet.html
node _src/content.js build --kind=lesson --only=content/my-lesson.html
node _src/content.js build --kind=game --only=my-game
node _src/content.js build
```

check خروجی نمی‌نویسد. ساخت منتخب، منبع سایر درس‌ها را اجرا نمی‌کند. ابتدا همهٔ فایل‌های منتخب بررسی می‌شوند؛ خطای شناسنامه، وابستگی ممنوع یا JavaScript نامعتبر پیش از نوشتن خروجی متوقف می‌کند. فایل‌های نسخه‌دار بازی immutable هستند؛ همان نسخه با محتوای متفاوت بازنویسی نمی‌شود. `games/<id>.html` فقط میانبر پیش‌نمایش محلی است؛ فایل تحویل، `games/<id>-v<version>.html` است.

سازگاری فرمان‌های قبلی حفظ است:

```text
node _src/build.js --only=05-template.html
node _src/games/build.js --only=kimiagar
```

## API درس و کاربرگ

نوع‌های موجود: content، steps، mcq، input، sort، order، poll، custom و end. کاربرگ یک end در آخر دارد؛ نمایش گزارش نهایی پس از تکمیل فعالیت‌ها و انتخاب کاربر است. ورود به کاربرگ، ثبت پایان نیست.

در custom:

```js
render: function (host, api) {
  var state = api.state;
  // ورودی ناقص، وضعیت تصادفی و مرحلهٔ داخلی را داخل state نگه دارید.
  var input = api.h('input', {'aria-label': 'پاسخ'});
  input.value = state.draft || '';
  input.addEventListener('input', function () {
    state.draft = input.value;
    api.save();
  });
  host.appendChild(input);
  // برای timer/worker/listener بیرونی: api.onDispose(cleanup).
  // پاسخ async پیش از تغییر UI/state: api.isActive() را بررسی کند.
}
```

api.right، api.wrong و api.done مسیر رسمی تکمیل‌اند. api.save تأیید ثبت سرور نیست؛ میزبان شبکه، receipt، revision و هویت را مدیریت می‌کند. state نباید DOM، تابع، Promise یا AudioContext داشته باشد.

مفسر `KelasCode` مخصوص زیرمجموعهٔ آموزشی است: مقدارها، متغیر، عملگر، شرط کوتاه، if/else، حلقه، تابع معمولی و return، آرایه و متدهای محدود رشته/آرایه. موتور کامل JavaScript، DOM، شبکه، import، class، async یا بسته‌های npm نیست. ساختار خارج از زیرمجموعه باید خطای روشن بدهد. تعداد گام، عمق فراخوانی، حجم رشته/آرایه و مهلت Worker محدودند؛ اجرای کد دانش‌آموز از eval یا Function پویا استفاده نمی‌کند.

## API بازی

مرجع پیاده‌سازی SDK: `pyamooz/resources/games/shared` در مخزن پای‌آموز. نسخهٔ مصرف‌شده در این مخزن با commit و SHA-256 در `_src/games/sdk-lock.json` مشخص است. کپی مشترک را دستی تغییر ندهید و SDK تازه نسازید.

```text
node _src/sync-host.js D:\pyamooz_2
```

این فرمان فقط کپی سازنده را از منابع میزبان هماهنگ می‌کند؛ سایت، بانک و فایل واردشده را تغییر نمی‌دهد. پس از تغییر SDK/سبک، نسخهٔ بازی‌های بازتولیدشده افزایش یابد. قبل از هماهنگ‌سازی، تغییرات منبع و نسخه‌ها را بررسی کنید.

API واقعی: `createGameBridge({manifest, restore, snapshot, pause, preferences, status})`، سپس save، finish(outcome, metrics, elapsedMs)، stop، resume و destroy. مقدار snapshot باید وضعیت کامل دور باشد. pause(true) هم تعامل و هم ساعت را متوقف کند. رسیدن به یک milestone پایان دور نیست؛ finish فقط در پایان واقعی یا رهاکردن آگاهانهٔ دور اجرا شود.

الگوهای نمونه در `_src/games/`: memory-fixture، game-2048، sudoku، kimiagar و ramz-ostad. فایل‌های قدیمی `_src/games/*.html` به‌عنوان سابقه حفظ شده‌اند؛ build جدید از پوشه‌های دارای manifest استفاده می‌کند.

## تحویل به پای‌آموز

بستهٔ بازی را با ابزار واقعی سایت بررسی کنید:

```text
cd D:\pyamooz_2\pyamooz
php artisan pyamooz:check-game D:\alavi\games\my-game-v1.html
```

درس و کاربرگ از پنل درس، بازی از پنل بازی بارگذاری می‌شوند. بارگذاری اولیه پیش‌نویس است. بررسی ایستا فقط ساختار را تأیید می‌کند؛ پیش‌نمایش واقعی، ذخیره/ادامه، ورودی نیمه‌تمام، توقف، پایان و خودارزیابی، قطع اتصال، دو تب/پروفایل، موبایل و کاهش حرکت جداگانه بررسی شوند. انتشار عمومی با مالک است.

```text
node --test _src/*.test.js
node _src/test.js
```

پرامپت‌ساز `04-prompt-kit.html` نوع درس، کاربرگ یا بازی را انتخاب می‌کند و همین قرارداد را به سازنده یادآوری می‌کند. همیشه اجرای آزمون را در گزارش بخواهید؛ وجود فایل یا JSON جای آن را نمی‌گیرد.

هماهنگی بین Windows و Linux: خواندن منبع و کپی SDK با پایان‌خط LF انجام می‌شود و checksum قفل SDK روی همین کپی استاندارد است. فایل نسخه‌دار بازی با بایت‌های متفاوت بازنویسی نمی‌شود، حتی اگر تفاوت فقط پایان‌خط باشد.

برای فعالیت کدنویسی تازه، در content.json فیلد modules را برابر ["code-lab"] قرار دهید؛ JSCodeLab.render(host, api, spec) و CSS آن خودکار جاسازی می‌شوند. برای کنسول مأموریتی قدیمی، ["console-lab"] و consoleLab(host, api, options) در دسترس‌اند. در صورت انتخاب هر دو، مفسر فقط یک‌بار جاسازی می‌شود. ماژول ناشناخته رد می‌شود؛ نیازی به کپی مفسر یا تغییر build.js ندارید.
