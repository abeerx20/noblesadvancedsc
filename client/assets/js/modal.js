export function confirmAction(message, title = "تأكيد العملية", confirmText = "حسناً") {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
        <div class="material-modal" dir="rtl">
            <h3>${title}</h3>
            <p class="material-modal-message">${message}</p>
            <div class="material-modal-actions">
                <button type="button" class="btn btn-secondary modal-cancel">إلغاء</button>
                <button type="button" class="btn modal-confirm">${confirmText}</button>
            </div>
        </div>
    `;
    document.body.append(dialog);

    return new Promise((resolve) => {
        const close = (confirmed) => {
            dialog.close();
            dialog.remove();
            resolve(confirmed);
        };
        dialog.querySelector(".modal-cancel").addEventListener("click", () => close(false));
        dialog.querySelector(".modal-confirm").addEventListener("click", () => close(true));
        dialog.addEventListener("cancel", (event) => {
            event.preventDefault();
            close(false);
        }, { once: true });
        dialog.showModal();
    });
}

export async function confirmDelete(message) {
    const result = await Swal.fire({
        title: "تأكيد الحذف",
        text: message,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "حذف",
        cancelButtonText: "إلغاء",
        confirmButtonColor: "#dc2626"
    });
    return result.isConfirmed;
}

export async function confirmSave(message) {
    const result = await Swal.fire({
        title: "تأكيد الحفظ",
        text: message,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "حفظ",
        cancelButtonText: "إلغاء"
    });

    return result.isConfirmed;
}

export function showSuccess(message) {
    return Swal.fire({
        icon: "success",
        title: "نجاح",
        text: message,
        confirmButtonText: "حسناً"
    });
}

export function showErrorModal(message) {
    return Swal.fire({
        icon: "error",
        title: "خطأ",
        text: message,
        confirmButtonText: "إغلاق"
    });
}