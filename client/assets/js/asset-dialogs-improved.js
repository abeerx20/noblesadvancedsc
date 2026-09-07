/**
 * تحسينات نموذج الحوار للعهد
 * استبدال prompt/confirm بـ HTML5 Dialog Elements
 * من منظور خبير 20 سنة تطوير
 */

// ============================================================
// 1. إعداد Dialogs العامة
// ============================================================

class AssetDialog {
  constructor() {
    this.statusDialog = null;
    this.editDialog = null;
    this.deleteDialog = null;
    this.successDialog = null;
    this.errorDialog = null;
    this.currentAsset = null;
    this.initDialogs();
  }

  /**
   * تهيئة جميع الـ Dialogs
   */
  initDialogs() {
    this.createStatusDialog();
    this.createEditDialog();
    this.createDeleteDialog();
    this.createSuccessDialog();
    this.createErrorDialog();
  }

  /**
   * إنشاء Dialog لتحديث الحالة
   */
  createStatusDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'statusDialog';
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'statusDialogTitle');

    dialog.innerHTML = `
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
                      placeholder="أضف أي ملاحظات إضافية حول الحالة..."></textarea>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" value="cancel" class="btn btn-secondary">إلغاء</button>
          <button type="submit" value="save" class="btn btn-primary">حفظ التغييرات</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.statusDialog = dialog;

    // معالج الـ Close Button
    dialog.querySelector('.modal-close').addEventListener('click', () => {
      dialog.close('cancel');
    });

    // معالج ESC key
    dialog.addEventListener('cancel', () => {
      dialog.close('cancel');
    });
  }

  /**
   * إنشاء Dialog لتعديل العهدة
   */
  createEditDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'editDialog';
    dialog.className = 'modal-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-labelledby', 'editDialogTitle');

    dialog.innerHTML = `
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

          <div class="form-group">
            <label for="editAssetCategory" class="form-label">الفئة:</label>
            <select id="editAssetCategory" class="form-control" required>
              <option value="">-- اختر الفئة --</option>
              <option value="أجهزة">🖥️ أجهزة</option>
              <option value="أثاث">🪑 أثاث</option>
              <option value="مواد">📦 مواد</option>
              <option value="كتب">📚 كتب</option>
              <option value="أخرى">📌 أخرى</option>
            </select>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" value="cancel" class="btn btn-secondary">إلغاء</button>
          <button type="submit" value="save" class="btn btn-primary">حفظ التعديلات</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.editDialog = dialog;

    dialog.querySelector('.modal-close').addEventListener('click', () => {
      dialog.close('cancel');
    });

    dialog.addEventListener('cancel', () => {
      dialog.close('cancel');
    });
  }

  /**
   * إنشاء Dialog لتأكيد الحذف
   */
  createDeleteDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'deleteDialog';
    dialog.className = 'modal-dialog modal-danger';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'deleteDialogTitle');

    dialog.innerHTML = `
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
    `;

    document.body.appendChild(dialog);
    this.deleteDialog = dialog;

    dialog.querySelector('.modal-close').addEventListener('click', () => {
      dialog.close('cancel');
    });

    dialog.addEventListener('cancel', () => {
      dialog.close('cancel');
    });
  }

  /**
   * إنشاء Dialog النجاح
   */
  createSuccessDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'successDialog';
    dialog.className = 'modal-dialog modal-success';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'successDialogTitle');

    dialog.innerHTML = `
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
    `;

    document.body.appendChild(dialog);
    this.successDialog = dialog;

    dialog.addEventListener('cancel', () => {
      dialog.close('ok');
    });
  }

  /**
   * إنشاء Dialog الخطأ
   */
  createErrorDialog() {
    const dialog = document.createElement('dialog');
    dialog.id = 'errorDialog';
    dialog.className = 'modal-dialog modal-error';
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-labelledby', 'errorDialogTitle');

    dialog.innerHTML = `
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
    `;

    document.body.appendChild(dialog);
    this.errorDialog = dialog;

    dialog.addEventListener('cancel', () => {
      dialog.close('ok');
    });
  }

  /**
   * فتح Dialog تحديث الحالة
   */
  showStatusDialog(asset) {
    this.currentAsset = asset;
    document.getElementById('statusAssetName').textContent = asset.assetName;
    document.getElementById('statusSelect').value = asset.status || '';
    document.getElementById('statusNotes').value = '';

    return new Promise((resolve) => {
      const form = this.statusDialog.querySelector('form');
      const closeHandler = () => {
        form.removeEventListener('submit', submitHandler);
        this.statusDialog.removeEventListener('close', closeHandler);
      };

      const submitHandler = (e) => {
        e.preventDefault();
        const result = {
          status: document.getElementById('statusSelect').value,
          notes: document.getElementById('statusNotes').value
        };
        closeHandler();
        resolve(result);
      };

      form.addEventListener('submit', submitHandler);
      this.statusDialog.addEventListener('close', closeHandler);
      this.statusDialog.showModal();
    });
  }

  /**
   * فتح Dialog التعديل
   */
  showEditDialog(asset) {
    this.currentAsset = asset;
    document.getElementById('editAssetName').value = asset.assetName || '';
    document.getElementById('editAssetDescription').value = asset.description || '';
    document.getElementById('editAssetCategory').value = asset.category || '';

    return new Promise((resolve) => {
      const form = this.editDialog.querySelector('form');
      const closeHandler = () => {
        form.removeEventListener('submit', submitHandler);
        this.editDialog.removeEventListener('close', closeHandler);
      };

      const submitHandler = (e) => {
        e.preventDefault();
        const result = {
          assetName: document.getElementById('editAssetName').value,
          description: document.getElementById('editAssetDescription').value,
          category: document.getElementById('editAssetCategory').value
        };
        closeHandler();
        resolve(result);
      };

      form.addEventListener('submit', submitHandler);
      this.editDialog.addEventListener('close', closeHandler);
      this.editDialog.showModal();
    });
  }

  /**
   * فتح Dialog تأكيد الحذف
   */
  showDeleteDialog(asset) {
    this.currentAsset = asset;
    document.getElementById('deleteAssetName').textContent = asset.assetName;

    return new Promise((resolve) => {
      const form = this.deleteDialog.querySelector('form');
      const closeHandler = () => {
        form.removeEventListener('submit', submitHandler);
        this.deleteDialog.removeEventListener('close', closeHandler);
      };

      const submitHandler = (e) => {
        e.preventDefault();
        closeHandler();
        resolve(true);
      };

      form.addEventListener('submit', submitHandler);
      this.deleteDialog.addEventListener('close', closeHandler);
      this.deleteDialog.showModal();
    });
  }

  /**
   * عرض رسالة النجاح
   */
  async showSuccess(message) {
    document.getElementById('successMessage').textContent = message;
    return new Promise((resolve) => {
      this.successDialog.addEventListener('close', () => {
        resolve();
      }, { once: true });
      this.successDialog.showModal();
    });
  }

  /**
   * عرض رسالة الخطأ
   */
  async showError(message) {
    document.getElementById('errorMessage').textContent = message;
    return new Promise((resolve) => {
      this.errorDialog.addEventListener('close', () => {
        resolve();
      }, { once: true });
      this.errorDialog.showModal();
    });
  }
}

// ============================================================
// 2. تهيئة Dialog Manager
// ============================================================

const assetDialog = new AssetDialog();

// ============================================================
// 3. دوال محسّنة لمعالجة العهد
// ============================================================

/**
 * تحديث حالة العهدة (بدلاً من prompt)
 */
async function updateAssetStatus(item) {
  try {
    const result = await assetDialog.showStatusDialog(item);

    if (result.status) {
      // إرسال التحديث إلى الخادم
      await api.patch(`/requests/asset/${item.id}`, {
        status: result.status,
        notes: result.notes
      });

      await assetDialog.showSuccess('تم تحديث حالة العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    console.error('Error updating asset:', error);
    await assetDialog.showError('حدث خطأ: ' + (error.message || 'فشل تحديث الحالة'));
  }
}

/**
 * تعديل بيانات العهدة (بدلاً من prompt)
 */
async function editAsset(item) {
  try {
    const result = await assetDialog.showEditDialog(item);

    if (result.assetName) {
      await api.patch(`/requests/asset/${item.id}`, result);

      await assetDialog.showSuccess('تم تحديث بيانات العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    console.error('Error editing asset:', error);
    await assetDialog.showError('حدث خطأ: ' + (error.message || 'فشل التعديل'));
  }
}

/**
 * حذف العهدة (بدلاً من confirm)
 */
async function deleteAsset(item) {
  try {
    const confirmed = await assetDialog.showDeleteDialog(item);

    if (confirmed) {
      await api.delete(`/requests/asset/${item.id}`);

      await assetDialog.showSuccess('تم حذف العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    console.error('Error deleting asset:', error);
    await assetDialog.showError('حدث خطأ: ' + (error.message || 'فشل الحذف'));
  }
}

/**
 * تحسين displayAssetsTable للاستخدام الجديد
 */
function displayAssetsTableImproved(assets, config, wrap, isAdmin = false) {

  if (!wrap) {
    console.error("displayAssetsTableImproved: wrap is missing");
    return;
  }

  wrap.replaceChildren();

  if (!assets.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'لا توجد عهد';
    empty.setAttribute('role', 'status');
    empty.setAttribute('aria-live', 'polite');
    wrap.append(empty);
    return;
  }

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.setAttribute('role', 'table');

  const head = document.createElement('thead');
  const trh = document.createElement('tr');

  config.columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col;
    th.setAttribute('role', 'columnheader');
    th.setAttribute('scope', 'col');
    trh.append(th);
  });

  // إضافة عمود الإجراءات للإدارة فقط
  if (isAdmin) {
    const th = document.createElement('th');
    th.textContent = 'الإجراءات';
    th.setAttribute('role', 'columnheader');
    th.setAttribute('scope', 'col');
    trh.append(th);
  }

  head.append(trh);

  const body = document.createElement('tbody');
  assets.forEach((item) => {
    const tr = document.createElement('tr');
    tr.setAttribute('role', 'row');

    config.row(item).forEach((cell) => tr.append(createCell(cell)));

    // إضافة أزرار الإجراءات للإدارة (محسّنة)
    if (isAdmin) {
      const td = document.createElement('td');
      td.className = 'action-cell';

      const actionButtons = document.createElement('div');
      actionButtons.className = 'action-buttons';

      // زر تحديث الحالة
      const statusBtn = document.createElement('button');
      statusBtn.className = 'icon-button';
      statusBtn.innerHTML = '📝';
      statusBtn.title = 'تحديث الحالة';
      statusBtn.setAttribute('aria-label', `تحديث حالة العهدة: ${item.assetName}`);
      statusBtn.addEventListener('click', () => updateAssetStatus(item));

      // زر تعديل
      const editBtn = document.createElement('button');
      editBtn.className = 'icon-button';
      editBtn.innerHTML = '✏️';
      editBtn.title = 'تعديل البيانات';
      editBtn.setAttribute('aria-label', `تعديل بيانات العهدة: ${item.assetName}`);
      editBtn.addEventListener('click', () => editAsset(item));

      // زر حذف
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'icon-button danger';
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.title = 'حذف العهدة';
      deleteBtn.setAttribute('aria-label', `حذف العهدة: ${item.assetName}`);
      deleteBtn.addEventListener('click', () => deleteAsset(item));

      // إضافة الأزرار بدون <br>
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

// ============================================================
// 4. Export للاستخدام في ملف portal.js الرئيسي
// ============================================================

export { assetDialog, displayAssetsTableImproved, updateAssetStatus, editAsset, deleteAsset };
