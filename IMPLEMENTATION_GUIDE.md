# دليل التطبيق الفوري - صفحة العهد المحسّنة
## خطوات عملية من خبير Full Stack

---

## 🚀 الخطوة 1: النسخ واللصق (Copy & Paste)

### 1.1 أضف CSS الجديد لـ `portal.css` أو ملف منفصل

```html
<!-- في employee-portal.html، أضف هذا السطر بعد السطر 8 -->
<link rel="stylesheet" href="assets/css/assets-table-improved.css">
<link rel="stylesheet" href="assets/css/dialogs-improved.css">
```

### 1.2 أضف dialogs للـ HTML

أضف هذا الكود **قبل `</body>`** وبعد `<div id="portal">`:

```html
<!-- Asset Management Dialogs -->

<!-- Dialog: تحديث الحالة -->
<dialog id="statusDialog" class="modal-dialog" role="alertdialog" aria-labelledby="statusDialogTitle">
  <form method="dialog" class="modal-form">
    <div class="modal-header">
      <h2 id="statusDialogTitle">تحديث حالة العهدة</h2>
      <button type="button" class="modal-close" aria-label="إغلاق النافذة">
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <div class="modal-body">
      <p class="asset-info">
        <strong>العهدة:</strong> <span id="statusAssetName">--</span>
      </p>
      <div class="form-group">
        <label for="statusSelect" class="form-label">الحالة الجديدة:</label>
        <select id="statusSelect" class="form-control" required>
          <option value="">-- اختر الحالة --</option>
          <option value="نشطة">🟢 نشطة</option>
          <option value="مسترجعة">🟡 مسترجعة</option>
          <option value="تالفة">🔴 تالفة</option>
        </select>
      </div>
      <div class="form-group">
        <label for="statusNotes" class="form-label">ملاحظات (اختياري):</label>
        <textarea id="statusNotes" class="form-control" rows="3"
                  placeholder="أضف أي ملاحظات إضافية..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" value="cancel" class="btn btn-secondary">إلغاء</button>
      <button type="submit" value="save" class="btn btn-primary">حفظ التغييرات</button>
    </div>
  </form>
</dialog>

<!-- Dialog: تعديل العهدة -->
<dialog id="editDialog" class="modal-dialog" role="dialog" aria-labelledby="editDialogTitle">
  <form method="dialog" class="modal-form">
    <div class="modal-header">
      <h2 id="editDialogTitle">تعديل بيانات العهدة</h2>
      <button type="button" class="modal-close" aria-label="إغلاق النافذة">
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="editAssetName" class="form-label">اسم العهدة:</label>
        <input type="text" id="editAssetName" class="form-control"
               required placeholder="أدخل اسم العهدة">
      </div>
      <div class="form-group">
        <label for="editAssetDescription" class="form-label">الوصف:</label>
        <textarea id="editAssetDescription" class="form-control" rows="3"
                  placeholder="وصف العهدة (اختياري)"></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" value="cancel" class="btn btn-secondary">إلغاء</button>
      <button type="submit" value="save" class="btn btn-primary">حفظ التعديلات</button>
    </div>
  </form>
</dialog>

<!-- Dialog: تأكيد الحذف -->
<dialog id="deleteDialog" class="modal-dialog modal-danger" role="alertdialog" aria-labelledby="deleteDialogTitle">
  <form method="dialog" class="modal-form">
    <div class="modal-header">
      <h2 id="deleteDialogTitle">تأكيد حذف العهدة</h2>
      <button type="button" class="modal-close" aria-label="إغلاق النافذة">
        <span aria-hidden="true">×</span>
      </button>
    </div>
    <div class="modal-body">
      <div class="alert alert-danger" role="alert">
        <span class="alert-icon" aria-hidden="true">⚠️</span>
        <div>
          <p class="alert-title">تحذير!</p>
          <p class="alert-message">
            هل أنتِ متأكدة من حذف العهدة <strong id="deleteAssetName">--</strong>؟
          </p>
          <p class="alert-hint">هذا الإجراء لا يمكن التراجع عنه.</p>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button type="button" value="cancel" class="btn btn-secondary">إلغاء</button>
      <button type="submit" value="confirm" class="btn btn-danger">نعم، احذفيها</button>
    </div>
  </form>
</dialog>

<!-- Dialog: النجاح -->
<dialog id="successDialog" class="modal-dialog modal-success" role="alertdialog" aria-labelledby="successDialogTitle">
  <form method="dialog" class="modal-form">
    <div class="modal-body">
      <div class="success-icon" aria-hidden="true">✓</div>
      <h2 id="successDialogTitle">نجح!</h2>
      <p id="successMessage">تم تنفيذ العملية بنجاح.</p>
    </div>
    <div class="modal-footer">
      <button type="submit" value="ok" class="btn btn-primary">حسناً</button>
    </div>
  </form>
</dialog>

<!-- Dialog: الخطأ -->
<dialog id="errorDialog" class="modal-dialog modal-error" role="alertdialog" aria-labelledby="errorDialogTitle">
  <form method="dialog" class="modal-form">
    <div class="modal-body">
      <div class="error-icon" aria-hidden="true">!</div>
      <h2 id="errorDialogTitle">خطأ</h2>
      <p id="errorMessage">حدث خطأ أثناء تنفيذ العملية.</p>
    </div>
    <div class="modal-footer">
      <button type="submit" value="ok" class="btn btn-secondary">حسناً</button>
    </div>
  </form>
</dialog>
```

---

## 🚀 الخطوة 2: استبدال الـ JavaScript

### 2.1 الطريقة الأولى: استبدال الدوال فقط (سهل)

في ملف `portal.js`، استبدل **السطور 3309-3455** كاملة بهذا:

```javascript
// ============================================================
// Asset Dialog Manager
// ============================================================

class AssetDialog {
  constructor() {
    this.statusDialog = document.getElementById('statusDialog');
    this.editDialog = document.getElementById('editDialog');
    this.deleteDialog = document.getElementById('deleteDialog');
    this.successDialog = document.getElementById('successDialog');
    this.errorDialog = document.getElementById('errorDialog');
    this.initEventHandlers();
  }

  initEventHandlers() {
    // Close buttons
    [this.statusDialog, this.editDialog, this.deleteDialog].forEach(dialog => {
      if (dialog) {
        const closeBtn = dialog.querySelector('.modal-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => dialog.close('cancel'));
        }
      }
    });
  }

  async showStatusDialog(asset) {
    document.getElementById('statusAssetName').textContent = asset.assetName;
    document.getElementById('statusSelect').value = asset.status || '';
    document.getElementById('statusNotes').value = '';

    return new Promise((resolve) => {
      const form = this.statusDialog.querySelector('form');
      const handleSubmit = (e) => {
        e.preventDefault();
        const result = {
          status: document.getElementById('statusSelect').value,
          notes: document.getElementById('statusNotes').value
        };
        cleanup();
        resolve(result);
      };

      const cleanup = () => {
        form.removeEventListener('submit', handleSubmit);
        this.statusDialog.removeEventListener('close', handleClose);
      };

      const handleClose = () => cleanup();

      form.addEventListener('submit', handleSubmit);
      this.statusDialog.addEventListener('close', handleClose, { once: true });
      this.statusDialog.showModal();
    });
  }

  async showEditDialog(asset) {
    document.getElementById('editAssetName').value = asset.assetName || '';
    document.getElementById('editAssetDescription').value = asset.description || '';

    return new Promise((resolve) => {
      const form = this.editDialog.querySelector('form');
      const handleSubmit = (e) => {
        e.preventDefault();
        const result = {
          assetName: document.getElementById('editAssetName').value,
          description: document.getElementById('editAssetDescription').value
        };
        cleanup();
        resolve(result);
      };

      const cleanup = () => {
        form.removeEventListener('submit', handleSubmit);
        this.editDialog.removeEventListener('close', handleClose);
      };

      const handleClose = () => cleanup();

      form.addEventListener('submit', handleSubmit);
      this.editDialog.addEventListener('close', handleClose, { once: true });
      this.editDialog.showModal();
    });
  }

  async showDeleteDialog(asset) {
    document.getElementById('deleteAssetName').textContent = asset.assetName;

    return new Promise((resolve) => {
      const form = this.deleteDialog.querySelector('form');
      const handleSubmit = (e) => {
        e.preventDefault();
        cleanup();
        resolve(true);
      };

      const cleanup = () => {
        form.removeEventListener('submit', handleSubmit);
        this.deleteDialog.removeEventListener('close', handleClose);
      };

      const handleClose = () => cleanup();

      form.addEventListener('submit', handleSubmit);
      this.deleteDialog.addEventListener('close', handleClose, { once: true });
      this.deleteDialog.showModal();
    });
  }

  async showSuccess(message) {
    document.getElementById('successMessage').textContent = message;
    return new Promise((resolve) => {
      this.successDialog.addEventListener('close', () => resolve(), { once: true });
      this.successDialog.showModal();
    });
  }

  async showError(message) {
    document.getElementById('errorMessage').textContent = message;
    return new Promise((resolve) => {
      this.errorDialog.addEventListener('close', () => resolve(), { once: true });
      this.errorDialog.showModal();
    });
  }
}

const assetDialog = new AssetDialog();

// ============================================================
// Improved Asset Functions
// ============================================================

async function updateAssetStatus(item) {
  try {
    const result = await assetDialog.showStatusDialog(item);
    if (result.status) {
      await api.patch(`/requests/asset/${item.id}`, {
        status: result.status,
        notes: result.notes
      });
      await assetDialog.showSuccess('تم تحديث حالة العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    await assetDialog.showError('خطأ: ' + (error.message || 'فشل تحديث الحالة'));
  }
}

async function editAsset(item) {
  try {
    const result = await assetDialog.showEditDialog(item);
    if (result.assetName) {
      await api.patch(`/requests/asset/${item.id}`, result);
      await assetDialog.showSuccess('تم تحديث بيانات العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    await assetDialog.showError('خطأ: ' + (error.message || 'فشل التعديل'));
  }
}

async function deleteAsset(item) {
  try {
    const confirmed = await assetDialog.showDeleteDialog(item);
    if (confirmed) {
      await api.delete(`/requests/asset/${item.id}`);
      await assetDialog.showSuccess('تم حذف العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    await assetDialog.showError('خطأ: ' + (error.message || 'فشل الحذف'));
  }
}

// ============================================================
// Improved Table Display
// ============================================================

async function loadEmployeeAssets(config) {
  try {
    const wrap = document.querySelector("#requestTable");
    wrap.innerHTML = '<div class="empty-state">جاري التحميل...</div>';
    const allAssets = (await api.get(config.path)).data || [];
    const employeeAssets = allAssets.filter(item =>
      item.employeeUid === state.me?.uid || item.submittedBy === state.me?.uid
    );
    displayAssetsTableImproved(employeeAssets, config, wrap, false);
  } catch (error) {
    showError(error);
  }
}

async function loadAllAssets(config) {
  try {
    const wrap = document.querySelector("#requestTable");
    wrap.innerHTML = '<div class="empty-state">جاري التحميل...</div>';
    const allAssets = (await api.get(config.path)).data || [];
    displayAssetsTableImproved(allAssets, config, wrap, true);
  } catch (error) {
    showError(error);
  }
}

function displayAssetsTableImproved(assets, config, wrap, isAdmin = false) {
  wrap.replaceChildren();

  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "لا توجد عهد";
    empty.setAttribute("role", "status");
    wrap.append(empty);
    return;
  }

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "table-wrapper";

  const table = document.createElement("table");
  table.setAttribute("role", "table");

  const head = document.createElement("thead");
  const trh = document.createElement("tr");

  config.columns.forEach((col) => {
    const th = document.createElement("th");
    th.textContent = col;
    th.setAttribute("scope", "col");
    trh.append(th);
  });

  if (isAdmin) {
    const th = document.createElement("th");
    th.textContent = "الإجراءات";
    th.setAttribute("scope", "col");
    trh.append(th);
  }

  head.append(trh);

  const body = document.createElement("tbody");
  assets.forEach((item) => {
    const tr = document.createElement("tr");
    config.row(item).forEach((cell) => tr.append(createCell(cell)));

    if (isAdmin) {
      const td = document.createElement("td");
      td.className = "action-cell";

      const actionButtons = document.createElement("div");
      actionButtons.className = "action-buttons";

      const statusBtn = document.createElement("button");
      statusBtn.className = "icon-button";
      statusBtn.innerHTML = "📝";
      statusBtn.title = "تحديث الحالة";
      statusBtn.setAttribute("aria-label", `تحديث حالة العهدة: ${item.assetName}`);
      statusBtn.addEventListener("click", () => updateAssetStatus(item));

      const editBtn = document.createElement("button");
      editBtn.className = "icon-button";
      editBtn.innerHTML = "✏️";
      editBtn.title = "تعديل البيانات";
      editBtn.setAttribute("aria-label", `تعديل بيانات العهدة: ${item.assetName}`);
      editBtn.addEventListener("click", () => editAsset(item));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "icon-button danger";
      deleteBtn.innerHTML = "🗑️";
      deleteBtn.title = "حذف العهدة";
      deleteBtn.setAttribute("aria-label", `حذف العهدة: ${item.assetName}`);
      deleteBtn.addEventListener("click", () => deleteAsset(item));

      actionButtons.append(statusBtn, editBtn, deleteBtn);
      td.append(actionButtons);
      tr.append(td);
    }

    body.append(tr);
  });

  table.append(head, body);
  tableWrapper.append(table);
  wrap.append(tableWrapper);
}
```

### 2.2 الطريقة الثانية: ملف منفصل (احترافي)

أنشئ ملف جديد `assets/js/asset-dialogs.js` ثم:

```html
<!-- في employee-portal.html، أضف هذا السطر قبل script الأخير (السطر 65) -->
<script type="module" src="assets/js/asset-dialogs.js"></script>
```

والصق محتوى الملف `assets-dialogs-improved.js` فيه.

---

## ✅ الخطوة 3: التحقق من التطبيق

### 3.1 اختبر الـ Dialogs

1. افتح صفحة الاستعلام عن العهد
2. انقر على أي زر إجراء (📝 أو ✏️ أو 🗑️)
3. تأكد من ظهور Dialog جميل بدلاً من prompt القديم

### 3.2 اختبر على الهاتف

1. افتح الصفحة على هاتفك
2. تأكد من أن الأزرار تعرض أيقونات فقط
3. تأكد من أن الجدول يدعم horizontal scroll إذا لزم الأمر

### 3.3 اختبر Accessibility

استخدم قارئ شاشة (NVDA على Windows أو VoiceOver على Mac):
- تأكد من أن جميع الأزرار لها أسماء واضحة (aria-label)
- تأكد من أن Dialogs لها أدوار صحيحة (role)

---

## 📋 Checklist النهائي

- [ ] تم نسخ CSS الجديد (assets-table-improved.css و dialogs-improved.css)
- [ ] تم إضافة links في HTML
- [ ] تم نسخ dialogs HTML كاملة
- [ ] تم استبدال دوال الـ JavaScript
- [ ] تم اختبار على Desktop (Chrome, Firefox, Safari)
- [ ] تم اختبار على Tablet (iPad)
- [ ] تم اختبار على Mobile (iPhone, Android)
- [ ] تم اختبار keyboard navigation (Tab, Enter, ESC)
- [ ] تم اختبار مع قارئ الشاشة
- [ ] تم التأكد من أن جميع الوظائف تعمل

---

## 🎯 النتائج المتوقعة

**قبل التحسين:**
- ❌ أزرار عمودية ضخمة
- ❌ استخدام prompt قديمة
- ❌ غير responsive على الهاتف
- ❌ تجربة مستخدم سيئة

**بعد التحسين:**
- ✅ أزرار أفقية أنيقة
- ✅ dialogs احترافية وجميلة
- ✅ responsive على جميع الأجهزة
- ✅ تجربة مستخدم ممتازة
- ✅ معايير accessibility محسّنة

---

## 💡 نصائح إضافية

### إذا واجهت مشاكل:

**المشكلة:** Dialogs لا تظهر
**الحل:** تأكد من:
- وجود `id` صحيح في HTML
- تحميل JavaScript قبل استدعاء dialogs
- عدم وجود خطأ في console

**المشكلة:** الأزرار في الجداول لا تعمل
**الحل:** تأكد من:
- استخدام `addEventListener` بدلاً من `onclick`
- عدم استدعاء `preventDefault()`
- وجود `api` object

**المشكلة:** Dialogs تبدو سيئة
**الحل:** تأكد من:
- تحميل CSS الجديد
- عدم تضارب CSS مع portal.css
- تعطيل CSS cache في المتصفح (Ctrl+Shift+Delete)

---

## 🚀 التطوير المستقبلي

### المرحلة التالية:

1. **إضافة Animations:**
```css
@keyframes slideIn {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
```

2. **تحسين الأداء:**
- استخدام Event Delegation
- Lazy loading للجداول الكبيرة
- Pagination

3. **تحسينات UX:**
- Confirmation animations
- Loading states
- Toast notifications

---

**استعداد؟ ابدأ بالخطوة 1 الآن!** 🚀

