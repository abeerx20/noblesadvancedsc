# رفع المشروع إلى GitHub

## قبل الرفع

- لا ترفعي ملف `.env` أو أي ملف Service Account.
- انسخي `.env.example` إلى `.env` على جهاز التشغيل فقط.
- بيانات `client/assets/js/firebase-config.js` خاصة بتطبيق الويب ويمكن أن تظهر في الواجهة، أما مفتاح Firebase Admin فيبقى داخل `.env` فقط.

## أول رفع للمستودع

من داخل مجلد المشروع شغّلي:

```bash
git init
git add .
git commit -m "Initial MyNas school system"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

استبدلي `USERNAME/REPOSITORY` بعنوان مستودع GitHub الخاص بك.

## التشغيل بعد تنزيل المشروع

```bash
npm ci
copy .env.example .env
npm run dev
```

بعدها افتحي:

```text
http://localhost:3000
```

عدّلي `.env` وأضيفي إعدادات Firebase Admin قبل استخدام الخدمات المحمية.

## التحقق قبل كل رفع

```bash
npm run check
npm test
```

تم إعداد GitHub Actions في `.github/workflows/ci.yml` لتشغيل الفحص والاختبارات تلقائيًا عند كل `push` أو `pull request`.
