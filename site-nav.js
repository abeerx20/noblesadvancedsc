document.addEventListener('DOMContentLoaded', () => {
    const printHeader = document.createElement('section');
    printHeader.className = 'official-print-header';
    printHeader.setAttribute('aria-label', 'رأس الصفحة الرسمي');
    printHeader.innerHTML = `
        <div class="official-print-ministry">
            <img src="assets/images/moe-logo.png" alt="وزارة التعليم">
            <div><strong>المملكة العربية السعودية</strong><span>وزارة التعليم</span></div>
        </div>
        <img class="official-print-school-logo" src="assets/images/logocopy.png" alt="مدارس النبلاء المتقدمة الأهلية">
        <div class="official-print-meta">
            <strong>مدارس النبلاء المتقدمة الأهلية</strong>
            <div><span>رقم القرار: __________</span><span>التاريخ: ___ / ___ / _____</span></div>
        </div>`;
    document.body.prepend(printHeader);

    const menuToggle = document.getElementById('menuToggle');
    const closeMenu = document.getElementById('closeMenu');
    const navbar = document.getElementById('navbar');
    const backdrop = document.getElementById('menuBackdrop');

    function setMenuState(open) {
        if (!navbar) return;
        navbar.classList.toggle('open', open);
        if (backdrop) backdrop.classList.toggle('show', open);
        document.body.classList.toggle('menu-open', open);
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', () => setMenuState(true));
    }

    if (closeMenu) {
        closeMenu.addEventListener('click', () => setMenuState(false));
    }

    if (backdrop) {
        backdrop.addEventListener('click', () => setMenuState(false));
    }
});
