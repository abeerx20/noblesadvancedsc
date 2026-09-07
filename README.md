# نظام مدارس النبلاء المتقدمة – MyNas

مشروع Full-Stack جديد من الصفر، بواجهة عربية RTL وباك إند Node.js وExpress، مع Firebase Authentication وFirestore. صُممت العمليات الحساسة لتُنفّذ في الخادم بعد التحقق من هوية المستخدمة وصلاحياتها، ولا يعتمد النظام على الدور أو البريد المخزن في المتصفح لمنح الوصول.

## ما يحتويه المشروع

- الموقع الرسمي للمدرسة.
- تسجيل دخول الموظفات وأولياء الأمور عبر Firebase Authentication.
- بوابة MyNas التي تعرض الخدمات بحسب نوع الحساب والصلاحيات.
- بوابة موظفة ديناميكية داخل صفحة واحدة.
- قوائم طلاب مستقلة لكل مادة وفصل، مع مسودات واعتماد وتأجيل.
- استيراد Excel بمعاينة المقبول والمرفوض قبل الحفظ، وتصدير القوائم المعتمدة.
- منع دمج البنين والبنات في المرحلة الابتدائية.
- حضور وغياب مرتبط بمعلمة الحصة الأولى، مع منع التكرار اليومي.
- جدول دراسي يمنع التعارض الحقيقي ويسمح بتلاصق الحصص.
- الإجازات والاستئذان والدورات والتكليفات والعهد والسلف.
- إدارة الموظفات والصلاحيات، مع منع تغيير المستخدمة لصلاحياتها بنفسها.
- بوابة ولي الأمر لبيانات الأبناء وسجلات حضورهم فقط.
- طلبات الدعم الفني والمرفقات الخاصة.
- سجل عمليات `auditLogs` للعمليات المهمة.
- قواعد Firestore وStorage تمنع الوصول المباشر من المتصفح؛ جميع البيانات تمر عبر API.

## التشغيل المحلي

المتطلبات: Node.js 20 أو أحدث، ومشروع Firebase مفعّل فيه Authentication وFirestore.

1. افتحي مجلد المشروع في VS Code.
2. انسخي `.env.example` إلى ملف جديد اسمه `.env`.
3. أدخلي بيانات Firebase Admin في `.env`. لا تضعي هذه البيانات داخل ملفات `client`.
4. افتحي `client/assets/js/firebase-config.js` وأدخلي قيم تطبيق الويب الموجودة في Firebase Console.
5. ثبتي الحزم وشغّلي النظام:

```bash
npm install
npm run dev
```

6. افتحي في المتصفح:

```text
http://localhost:3000
```

فحص اتصال الباك إند:

```text
http://localhost:3000/api/v1/health
```

لا حاجة إلى Live Server في هذا المسار؛ Express يشغّل الفرونت إند والباك إند معًا. إذا استُخدم Live Server على المنفذ 5500، فالواجهة تختار تلقائيًا `http://localhost:3000/api/v1`، وCORS يسمح فقط بالعناوين المحلية المحددة في `.env`.

## إنشاء أول حساب مسؤولة للنظام

1. أنشئي حساب الموظفة في Firebase Authentication وخذي قيمة `uid`.
2. أضيفي مؤقتًا إلى `.env`:

```text
BOOTSTRAP_UID=Firebase_UID
ADMIN_EMAIL=employee@nas.edu.sa
ADMIN_NAME_AR=الاسم العربي الرباعي
ADMIN_NAME_EN=English Full Name
ADMIN_EMPLOYEE_NUMBER=1001
```

3. شغّلي:

```bash
npm run bootstrap:admin
```

السكربت ينشئ `employees/{uid}` و`accessControl/{uid}` من بيئة الخادم الموثوقة. بعد نجاحه، احذفي متغيرات bootstrap من `.env` واتركي بيانات Firebase Admin فقط.

## نشر قواعد Firebase

بعد تسجيل الدخول إلى Firebase CLI واختيار المشروع الصحيح:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

القواعد الحالية تقفل الوصول المباشر بالكامل لأن المشروع يستخدم الباك إند في كل عمليات البيانات. Firebase Admin SDK على الخادم لا يخضع لقواعد العميل.

## قوالب Excel

- `templates/students-class-template.xlsx`: لاستيراد قائمة مادة وفصل محددين. يجب تحديد جنس كل طالب صراحةً.
- `templates/students-school-template.xlsx`: للاستيراد الشامل، ويجب أن يحتوي كل صف على المرحلة والصف والشعبة والجنس.

تقبل العملية 500 طالب كحد أقصى وملفًا بحجم 2 ميغابايت. تعرض المعاينة الصفوف المقبولة والمرفوضة وأسباب الرفض، ثم تُحفظ الصفوف المقبولة كمسودات لا تظهر للمعلمة حتى تعتمدها الإدارة.

## المجموعات المستخدمة

يحافظ المشروع على الأسماء المطلوبة: `employees`, `accessControl`, `students`, `academicClasses`, `attendance`, `teacherSchedule`, `leaveRequests`, `trainingRequests`, `parents`, `announcements`, `supportTickets`.

ويضيف مجموعات الوحدات الإدارية التي لا يوجد لها اسم سابق محدد: `studentEnrollments`, `permissionRequests`, `workAssignments`, `assetRequests`, `loanInquiries`, `auditLogs`. يحتفظ `students` بملف الطالب الأساسي، بينما يحتفظ `studentEnrollments` بعضويته في المادة والفصل؛ لذلك حذف القيد لا يحذف الملف الأساسي.

وثائق الموظفات والحسابات ترتبط بـ Firebase `uid` من خلال معرّف الوثيقة أو حقل `authUid`. وثيقة الصلاحيات تكون دائمًا `accessControl/{uid}`.

## بنية المشروع

```text
client/                 الواجهات وملفات CSS وJavaScript
server/src/config/      إعدادات البيئة وFirebase
server/src/middleware/  المصادقة والصلاحيات والتحقق والأخطاء
server/src/routes/      عناوين API
server/src/controllers/ استقبال الطلب وإعادة الاستجابة
server/src/services/    قواعد العمل والوصول إلى Firestore
server/src/validators/  مخططات التحقق من البيانات
server/test/            اختبارات القواعد المهمة
templates/              قوالب استيراد الطلاب
```

## اختبارات الجودة

```bash
npm test
npm run check
npm audit --omit=dev
```

الاختبارات الحالية تغطي تلاصق الحصص، التعارض الحقيقي، حساب مدة الإجازة، وقواعد المرحلة والجنس للطلاب. يلزم قبل النشر إجراء اختبارات تكامل على مشروع Firebase تجريبي، واختبار كل صلاحية بحساب مستقل.

## ضوابط الأمان المطبقة

- التحقق من Firebase ID Token في كل مسار محمي.
- قراءة الصلاحيات من `accessControl/{uid}` في الخادم.
- عدم قبول الدور أو uid الحساس من المتصفح لتحديد صاحبة العملية.
- منع تعديل الصلاحيات ذاتيًا ومنع اعتماد الموظفة لطلبها.
- Zod للتحقق النهائي من البيانات، وحدود لحجم JSON والملفات.
- Helmet وسياسة Content Security Policy وتقييد CORS.
- Rate limiting وعدم إظهار stack traces للمستخدمة.
- استخدام `textContent` عند عرض بيانات المستخدم، وعدم إدخالها في `innerHTML`.
- تخزين المرفقات بصورة خاصة وإعطاء رابط مؤقت بعد فحص الملكية أو صلاحية الإدارة.
- حذف قيد الطالب من المادة والفصل حذفًا منطقيًا مع إبقاء ملفه الأساسي وسجل التدقيق.

## قبل الإنتاج

- استبدلي علامة `NAS` بالشعار الرسمي دون تغيير أبعاد منطقة الشعار.
- ضعي نطاق الإنتاج الحقيقي في `ALLOWED_ORIGINS` بعد نشره فقط.
- استخدمي مدير أسرار في منصة الاستضافة بدل رفع ملف `.env` إلى Git.
- اربطي نطاق API الحقيقي بعد نشر الخادم؛ لا تضعي `https://api.nas.edu.sa/api/v1` أثناء التطوير المحلي.
- اختبري حسابات المعلمة والمديرة ومسؤولة النظام وولي الأمر على بيانات تجريبية قبل إدخال البيانات الفعلية.

## مراجع رسمية

- Firebase: التحقق من ID Tokens في الخادم: https://firebase.google.com/docs/auth/admin/verify-id-tokens
- Firebase: Security Rules وAdmin SDK: https://firebase.google.com/docs/firestore/security/rules-conditions
- Express: ممارسات الأمان في الإنتاج: https://expressjs.com/en/advanced/best-practice-security.html
- OWASP: التحقق من المدخلات: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP: منع XSS: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
