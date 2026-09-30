import { api } from "./api.js";
import { logout } from "./firebase-client.js";
import { createCell, setNotice } from "./ui.js";

const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const content = document.querySelector("#parentMainContent");
const portal = document.querySelector("#parentPortal");
const attendanceLabels = { present: "حاضر", excused: "غائب بعذر", unexcused: "غائب دون عذر", late: "متأخر" };
const gradeLabels = { KG1: "الروضة الأولى", KG2: "الروضة الثانية", KG3: "الروضة الثالثة", Grade1: "الأول الابتدائي", Grade2: "الثاني الابتدائي", Grade3: "الثالث الابتدائي" };
const demoData = {
    children: [{ fullName: "ليان خالد العتيبي", grade: "Grade3", stage: "primary" }, { fullName: "سلمان خالد العتيبي", grade: "KG3", stage: "kindergarten" }, { fullName: "نورة خالد العتيبي", grade: "Grade1", stage: "primary" }],
    attendance: [{ studentName: "ليان خالد العتيبي", date: "2026-09-03", className: "ثالث ابتدائي / أ", status: "present" }, { studentName: "سلمان خالد العتيبي", date: "2026-09-03", className: "روضة ثالثة / ب", status: "late" }, { studentName: "نورة خالد العتيبي", date: "2026-09-03", className: "أول ابتدائي / أ", status: "excused" }],
    announcements: [{ title: "العودة إلى المدرسة", body: "نرحب بطلابنا ونذكّر بأهمية الحضور المبكر." }],
    reports: [
        { studentName: "ليان خالد العتيبي", subject: "اللغة العربية", score: "94", status: "ممتاز" },
        { studentName: "سلمان خالد العتيبي", subject: "المهارات الأساسية", score: "88", status: "متقدم" },
        { studentName: "نورة خالد العتيبي", subject: "الرياضيات", score: "91", status: "ممتاز" }
    ]
};

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>\"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function setPage(title, description, body) {
    content.innerHTML = `<section class="content-card page-card"><nav class="portal-breadcrumb" aria-label="مسار الصفحة"><span>مستندات</span><span aria-hidden="true">/</span><strong>${title}</strong></nav><div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><button id="pageBackButton" class="btn btn-secondary btn-small no-print" type="button">رجوع</button></div><div id="pageNotice" class="notice" role="alert" aria-live="polite"></div>${body}</section>`;
    document.querySelector("#pageBackButton")?.addEventListener("click", () => {
        location.hash = "children";
    });
}

function renderParentDashboard(parent, children) {
    const parentName = parent?.nameAr || "ولي الأمر";
    const parentId = parent?.nationalId || "—";
    const cards = [
        { href: "#reports", label: "التقارير", text: "متابعة تقارير الأبناء" },
        { href: "#attendance", label: "الحضور والغياب", text: "رؤية الحضور اليومي" },
        { href: "#plans", label: "الخطط الدراسية", text: "عرض الخطة الدراسية" },
        { href: "#calendar", label: "التقويم الدراسي", text: "مواعيد الفصول والإجازات" },
        { href: "#support", label: "الدعم الفني", text: "إرسال طلب دعم" }
    ].map((item) => `
        <a href="${item.href}" style="display:block;border:1px solid #dfe8e4;border-radius:12px;padding:16px 18px;text-decoration:none;background:#fff;color:#0f3a34;box-shadow:0 8px 18px rgba(6,66,54,.04);transition:transform .15s ease, box-shadow .15s ease;">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px;">
                <span style="display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:#edf7f4;color:#0d766a;font-weight:400;">→</span>
                <span style="font-size:12px;color:#0d766a;background:#edf7f4;padding:6px 10px;border-radius:999px;">الوصول</span>
            </div>
            <strong style="display:block;font-size:14px;font-weight:400;margin-bottom:5px;">${item.label}</strong>
            <span style="font-size:11px;color:#4b5d5a;line-height:1.6;">${item.text}</span>
        </a>
    `).join("");

    setPage("بوابة ولي الأمر", "بيانات ولي الأمر ووصول سريع إلى الخدمات.", `
        <section class="dashboard-welcome" aria-labelledby="parentWelcomeTitle">
            <div>
                <span class="dashboard-eyebrow">مرحبًا بك</span>
                <h2 id="parentWelcomeTitle">أهلاً وسهلاً في بوابة ولي الأمر</h2>
                <p>يمكنك متابعة أبنائك، تقاريرهم، حضورهم، والخدمات المدرسية من مكان واحد.</p>
            </div>
            <span class="account-status"><span aria-hidden="true"></span>الحساب نشط</span>
        </section>

        <section class="employee-overview" aria-labelledby="parentOverviewTitle">
            <div class="section-heading">
                <div>
                    <span>الملف الشخصي</span>
                    <h2 id="parentOverviewTitle">بيانات ولي الأمر</h2>
                </div>
                <span class="data-privacy">معلومات مرتبطة بحسابك فقط</span>
            </div>
            <dl class="employee-data-grid">
                <div class="employee-data-primary">
                    <dt>اسم ولي الأمر</dt>
                    <dd>${escapeHtml(parentName)}</dd>
                </div>
                <div>
                    <dt>رقم الهوية</dt>
                    <dd>${escapeHtml(parentId)}</dd>
                </div>
                <div>
                    <dt>عدد الأبناء</dt>
                    <dd>${children.length}</dd>
                </div>
                <div>
                    <dt>حالة الحساب</dt>
                    <dd>نشط</dd>
                </div>
            </dl>
        </section>

        <section class="quick-section" aria-labelledby="parentQuickTitle" style="margin-top:18px;">
            <div class="section-heading">
                <div>
                    <span>اختصاراتك</span>
                    <h2 id="parentQuickTitle">الوصول السريع</h2>
                </div>
            </div>
            <div class="quick-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;">${cards}</div>
        </section>
    `);
}

function table(headings, rows, values) {
    if (!rows.length) return `<div class="empty-state">لا توجد بيانات مرتبطة بالحساب.</div>`;
    const head = headings.map((heading) => `<th>${heading}</th>`).join("");
    const body = rows.map((row) => `<tr>${values(row).map((value) => createCell(value).outerHTML).join("")}</tr>`).join("");
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

function parentAttendancePage(rows, children) {
    setPage("الحضور والغياب", "اختاري الابن والتاريخ لمراجعة سجل الحضور.", `
        <form id="parentAttendanceSearchForm" class="parent-attendance-search">
            <div class="field"><label for="attendanceStudentFilter">الابن</label><select id="attendanceStudentFilter" required><option value="">اختاري الابن</option></select></div>
            <div class="field"><label for="attendanceDateFilter">التاريخ</label><input id="attendanceDateFilter" type="date" required></div>
            <button class="btn" type="submit">بحث</button>
        </form>
        <div id="parentAttendanceResults" class="parent-attendance-results" hidden></div>
    `);

    const studentFilter = document.querySelector("#attendanceStudentFilter");
    const dateFilter = document.querySelector("#attendanceDateFilter");
    const results = document.querySelector("#parentAttendanceResults");
    children.forEach((child) => studentFilter.add(new Option(child.fullName, child.id ?? child.fullName)));

    const renderRows = (event) => {
        event?.preventDefault();
        const selectedStudent = studentFilter.value;
        const selectedDate = dateFilter.value;
        const filteredRows = rows.filter((row) => {
            const rowStudent = row.studentId ?? row.studentName;
            return rowStudent === selectedStudent
                && (!selectedDate || row.date === selectedDate);
        });
        results.innerHTML = filteredRows.length
            ? table(["الطالب", "التاريخ", "الفصل", "الحالة"], filteredRows, (row) => [row.studentName, row.date, row.className, attendanceLabels[row.status] ?? row.status])
            : `<div class="empty-state">لا توجد سجلات حضور وغياب مطابقة للاختيار.</div>`;
        results.hidden = false;
    };

    document.querySelector("#parentAttendanceSearchForm").addEventListener("submit", renderRows);
}

function studentScopedPage(title, description, rows, headings, values, children) {
    const options = children.map((child) => `<option value="${child.fullName}">${child.fullName}</option>`).join("");
    setPage(title, description, `<div class="field" style="max-width: 360px"><label for="studentFilter">الطالب</label><select id="studentFilter"><option value="all">كل الأبناء</option>${options}</select></div><div id="studentResults">${table(headings, rows, values)}</div>`);
    document.querySelector("#studentFilter").addEventListener("change", (event) => {
        const selected = event.target.value;
        const filtered = selected === "all" ? rows : rows.filter((row) => row.studentName === selected);
        document.querySelector("#studentResults").innerHTML = table(headings, filtered, values);
    });
}

function renderParentReportsHub(children) {
    setPage("التقارير", "اختاري الابن لعرض روابط تقاريره بحسب مرحلته.", `
        <div class="field" style="max-width: 360px">
            <label for="reportStudentFilter">الابن</label>
            <select id="reportStudentFilter" required><option value="">اختاري الابن</option></select>
        </div>
        <nav id="parentReportLinks" class="student-services-list" aria-label="روابط التقارير"></nav>
        <div id="parentReportHint" class="empty-state">اختاري الابن أولًا لعرض روابط تقاريره.</div>
    `);

    const studentFilter = document.querySelector("#reportStudentFilter");
    const links = document.querySelector("#parentReportLinks");
    const hint = document.querySelector("#parentReportHint");
    children.forEach((child) => studentFilter.add(new Option(child.fullName, child.id ?? child.fullName)));

    studentFilter.addEventListener("change", () => {
        const child = children.find((item) => (item.id ?? item.fullName) === studentFilter.value);
        links.replaceChildren();
        if (!child) {
            hint.textContent = children.length ? "اختاري الابن أولًا لعرض روابط تقاريره." : "لا يوجد أبناء مرتبطون بهذا الحساب.";
            hint.classList.remove("hidden");
            return;
        }

        const isKindergarten = /kindergarten|روض|kg/i.test(`${child.stage ?? ""} ${child.grade ?? ""}`);
        const reportKind = isKindergarten ? "المرحلة" : "الفترة";
        ["الأولى", "الثانية", "الثالثة"].forEach((ordinal, index) => {
            const link = document.createElement("a");
            link.className = "student-service-link";
            link.href = `#reports-period-${index + 1}?student=${encodeURIComponent(child.id ?? child.fullName)}`;
            const label = document.createElement("span");
            label.textContent = `تقرير ${reportKind} ${ordinal}`;
            const arrow = document.createElement("span");
            arrow.setAttribute("aria-hidden", "true");
            arrow.textContent = "→";
            link.append(label, arrow);
            links.append(link);
        });
        hint.classList.add("hidden");
    });
}

function reportPage(title, rows, children, selectedChild = null) {
    const reportRows = selectedChild
        ? rows.filter((row) => row.studentId ? row.studentId === selectedChild.id : row.studentName === selectedChild.fullName)
        : rows;
    const options = children.map((child) => `<option value="${escapeHtml(child.fullName)}">${escapeHtml(child.fullName)}</option>`).join("");
    const renderReports = (selected = "all") => {
        const filteredReports = reportRows.filter((row) => selected === "all" || row.studentName === selected);
        if (!filteredReports.length) return `<div class="empty-state">لا توجد تقارير لهذه الفترة.</div>`;
        const reportRowsHtml = filteredReports.map((row, index) => {
            const detailsId = `parentReportDetails${index}`;
            const skills = (Array.isArray(row.skills) ? row.skills : []).map((skill) => `
                <tr><td>${escapeHtml(skill.name)}</td><td>${escapeHtml(skill.level)}</td><td>${escapeHtml(skill.note || "—")}</td></tr>
            `).join("");
            const reportDetails = `
                <div><strong>الحالة:</strong> ${escapeHtml(row.status)} <span> | </span><strong>الدرجة:</strong> ${escapeHtml(row.score)}</div>
                <div><strong>الفصل:</strong> ${escapeHtml(row.className || "—")} <span> | </span><strong>المعلمة:</strong> ${escapeHtml(row.teacherName || "—")}</div>
                ${skills ? `<div class="table-wrap"><table><thead><tr><th>المهارة</th><th>التقييم</th><th>ملاحظات</th></tr></thead><tbody>${skills}</tbody></table></div>` : `<p class="empty-state">لا توجد تفاصيل مهارات مسجلة لهذا التقرير.</p>`}
                ${row.parentFeedback?.acknowledged
                    ? `<p class="field-hint">تم الإقرار بالاطلاع${row.parentFeedback.comment ? `: ${escapeHtml(row.parentFeedback.comment)}` : ""}</p>`
                    : row.id ? `<form class="skill-parent-feedback" data-report-id="${escapeHtml(row.id)}"><label><input type="checkbox" required> تم الاطلاع على التقرير</label><label for="parentReportComment${index}">تعليق ولي الأمر <span aria-hidden="true">(مطلوب)</span></label><textarea id="parentReportComment${index}" required aria-required="true" minlength="1" maxlength="2000" placeholder="اكتب تعليق ولي الأمر"></textarea><button class="btn btn-small" type="submit">إرسال الإقرار والتعليق</button></form>` : ""}
            `;
            return `<tbody><tr><td>${escapeHtml(row.studentName)}</td><td>${escapeHtml(row.subject)}</td><td><button class="btn btn-secondary btn-small" type="button" data-parent-report-toggle="${detailsId}" aria-label="عرض تقرير ${escapeHtml(row.subject)}" title="عرض التقرير" aria-expanded="false">عرض التقرير</button></td></tr><tr id="${detailsId}" hidden><td colspan="3"><div class="skill-parent-report">${reportDetails}</div></td></tr></tbody>`;
        }).join("");
        return `<div class="table-wrap"><table><thead><tr><th>اسم الطالب</th><th>اسم المادة</th><th>التقرير</th></tr></thead>${reportRowsHtml}</table></div>`;
    };
    const studentFilter = selectedChild
        ? `<p class="field-hint">التقرير خاص بالابن: ${escapeHtml(selectedChild.fullName)}</p>`
        : `<div class="field" style="max-width: 360px"><label for="studentFilter">الطالب</label><select id="studentFilter"><option value="all">كل الأبناء</option>${options}</select></div>`;
    setPage(title, "راجعي التقرير ثم اكتبي التعليق وأكدي الاطلاع لإرساله.", `${studentFilter}<div id="reportResults" class="skill-parent-stack">${renderReports(selectedChild?.fullName ?? "all")}</div>`);
    const bindReportToggles = () => document.querySelectorAll("[data-parent-report-toggle]").forEach((button) => button.addEventListener("click", () => {
        const details = document.getElementById(button.dataset.parentReportToggle);
        if (!details) return;
        const shouldOpen = details.hidden;
        if (shouldOpen) {
            document.querySelectorAll("[data-parent-report-toggle]").forEach((otherButton) => {
                if (otherButton === button) return;
                const otherDetails = document.getElementById(otherButton.dataset.parentReportToggle);
                if (otherDetails) otherDetails.hidden = true;
                otherButton.setAttribute("aria-expanded", "false");
                otherButton.setAttribute("aria-label", `عرض تقرير ${otherButton.closest("tr")?.cells[1]?.textContent ?? ""}`);
                otherButton.title = "عرض التقرير";
                otherButton.textContent = "عرض التقرير";
            });
        }
        details.hidden = !shouldOpen;
        button.setAttribute("aria-expanded", String(shouldOpen));
        button.setAttribute("aria-label", shouldOpen ? "إغلاق التقرير" : `عرض تقرير ${button.closest("tr")?.cells[1]?.textContent ?? ""}`);
        button.title = shouldOpen ? "إغلاق التقرير" : "عرض التقرير";
        button.textContent = shouldOpen ? "×" : "عرض التقرير";
    }));
    const bindForms = () => document.querySelectorAll(".skill-parent-feedback").forEach((form) => form.addEventListener("submit", async (event) => { event.preventDefault(); const textarea = form.querySelector("textarea"); if (!textarea.value.trim()) { textarea.setCustomValidity("تعليق ولي الأمر مطلوب."); textarea.reportValidity(); textarea.focus(); textarea.setCustomValidity(""); return; } if (!form.reportValidity()) return; const button = form.querySelector("button"); button.disabled = true; try { const result = await api.patch(`/parent/reports/${form.dataset.reportId}/feedback`, { comment: textarea.value.trim(), acknowledged: true }); setNotice(document.querySelector("#pageNotice"), "success", result.message); form.replaceChildren(); form.innerHTML = "تم إرسال الإقرار والتعليق."; } catch (error) { setNotice(document.querySelector("#pageNotice"), "error", error.message); button.disabled = false; } }));
    bindReportToggles();
    bindForms();
    document.querySelector("#studentFilter")?.addEventListener("change", (event) => { document.querySelector("#reportResults").innerHTML = renderReports(event.target.value); bindReportToggles(); bindForms(); });
}

const documentPages = {
    plans: ["الخطط الدراسية", "الخطط الدراسية المعتمدة لأبنائك.", `<nav class="student-services-list" aria-label="روابط الخطط الدراسية"><div class="student-service-link" aria-disabled="true"><span>الخطة الدراسية للعام الحالي</span><span aria-hidden="true">→</span></div></nav>`],
    calendar: ["التقويم الدراسي", "مواعيد الفصول والاختبارات والإجازات.", `<nav class="student-services-list" aria-label="روابط التقويم الدراسي"><a class="student-service-link" href="#calendar"><span>التقويم الدراسي 2026</span><span aria-hidden="true">→</span></a><a class="student-service-link" href="#calendar"><span>مواعيد الاختبارات والإجازات</span><span aria-hidden="true">→</span></a></nav>`]
};

function renderAcademicCalendar() {
    const hijriFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
    const gregorianFormatter = new Intl.DateTimeFormat("ar-SA", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
    const weekdayFormatter = new Intl.DateTimeFormat("ar-SA", { weekday: "long", timeZone: "UTC" });
    const shortHijriFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    const shortGregorianFormatter = new Intl.DateTimeFormat("ar-SA", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
    const tasks = {
        1: ["تمهيد واستقبال الطلاب", "تمهيد واستقبال الطلاب", "تمهيد واستقبال الطلاب", "تمهيد واستقبال الطلاب", "تمهيد واستقبال الطلاب"],
        2: ["", "خطة الإخلاء", "", "", ""],
        3: ["", "", "رحلة طلاب", "", ""],
        4: ["", "الاحتفال باليوم الوطني", "", "إجازة اليوم الوطني", "إجازة اليوم الوطني"],
        6: ["", "يوم المعلم", "", "", ""],
        8: ["توزيع تقارير", "", "", "", ""],
        10: ["اليوم العالمي للطفل", "", "رحلة", "", ""],
        12: ["توزيع التقارير", "", "", "", ""],
        13: ["إجازة الخريف (من 10/6 إلى 18/6)", "إجازة الخريف", "إجازة الخريف", "إجازة الخريف", "إجازة الخريف"],
        14: ["العودة للدراسة 19/6", "", "", "", ""],
        15: ["اليوم العالمي للغة العربية", "رحلة", "", "", ""],
        16: ["توزيع التقارير", "", "", "", ""],
        18: ["اختبارات نهاية الفصل الدراسي الأول", "اختبارات نهاية الفصل الدراسي الأول", "اختبارات نهاية الفصل الدراسي الأول", "اختبارات نهاية الفصل الدراسي الأول", "اختبارات نهاية الفصل الدراسي الأول"]
    };
    const weeks = Array.from({ length: 18 }, (_, index) => {
        const start = new Date(Date.UTC(2026, 7, 30 + index * 7));
        const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6);
        const weekNumber = index + 1;
        const weekTasks = tasks[weekNumber] ?? [];
        const isFullWeek = weekTasks.length === 5 && weekTasks.every((task) => task && task === weekTasks[0]);
        const days = isFullWeek
            ? `<div class="calendar-task-span"><span>الأحد - الخميس</span><em>${weekTasks[0]}</em></div>`
            : Array.from({ length: 5 }, (_, dayIndex) => { const day = new Date(start); day.setUTCDate(day.getUTCDate() + dayIndex); const task = weekTasks[dayIndex] ?? ""; return `<div class="calendar-day-row"><span>${weekdayFormatter.format(day)}</span><b>${shortHijriFormatter.format(day)}</b><em>${task}</em><b>${shortGregorianFormatter.format(day)}</b></div>`; }).join("");
        return `<article class="calendar-week-card"><header><span>الأسبوع</span><strong>${index + 1}</strong></header><div class="calendar-day-heading"><span>اليوم</span><span>هجري</span><span>المهام</span><span>ميلادي</span></div>${days}</article>`;
    }).join("");
    setPage("التقويم الدراسي", "18 أسبوعًا دراسيًا تبدأ في 17/03/1448هـ الموافق 30/08/2026م.", `<section class="calendar-board" dir="rtl"><div class="calendar-board-title"><strong>توزيع الأسابيع الدراسية</strong><span>الفصل الدراسي الأول | 1448هـ - 2026م</span></div><div class="calendar-week-grid">${weeks}</div></section>`);
}

function renderSidebar() {
    const nav = document.querySelector("#parentSidebarMenu");
    nav.innerHTML = `<a class="side-home" href="#children"><span class="side-home-icon" aria-hidden="true"></span><span>الرئيسية</span></a><section class="menu-group"><button class="menu-group-button" type="button" aria-expanded="false"><span class="menu-group-icon" aria-hidden="true"></span><span class="menu-group-title">مستندات</span><span class="menu-group-arrow" aria-hidden="true"></span></button><div class="menu-items"><span class="menu-subtitle">مستندات ولي الأمر</span><a class="menu-link" href="#reports">التقارير</a><a class="menu-link" href="#attendance">الحضور والغياب</a><a class="menu-link" href="#plans">الخطط الدراسية</a><a class="menu-link" href="#calendar">التقويم الدراسي</a></div></section>`;
    const group = nav.querySelector(".menu-group");
    const button = group.querySelector(".menu-group-button");
    button.addEventListener("click", () => { group.classList.toggle("open"); button.setAttribute("aria-expanded", String(group.classList.contains("open"))); });
}

async function route() {
    try {
        if (!demoMode) {
            const me = (await api.get("/me")).data;
            if (me.userType !== "parent") throw new Error("هذه الصفحة مخصصة لولي الأمر.");
        }
        const [routeName = "children", routeQuery = ""] = location.hash.replace(/^#/, "").split("?");
        const routeParams = new URLSearchParams(routeQuery);
        if (routeName === "attendance") {
            const rows = demoMode ? demoData.attendance : (await api.get("/parent/attendance")).data;
            const children = demoMode ? demoData.children : (await api.get("/parent/children")).data;
            parentAttendancePage(rows, children);
        } else if (routeName === "announcements") {
            const rows = demoMode ? demoData.announcements : (await api.get("/announcements")).data;
            setPage("الإعلانات", "آخر أخبار وتنبيهات المدرسة.", table(["العنوان", "الإعلان"], rows, (row) => [row.title, row.body]));
        } else if (["reports-period-1", "reports-period-2", "reports-period-3"].includes(routeName)) {
            const period = routeName.slice(-1);
            const rows = demoMode ? demoData.reports : (await api.get(`/parent/reports?period=${period}`)).data;
            const children = demoMode ? demoData.children : (await api.get("/parent/children")).data;
            const selectedChildKey = routeParams.get("student");
            const selectedChild = children.find((child) => String(child.id ?? child.fullName) === selectedChildKey);
            const periodLabel = { 1: "الأولى", 2: "الثانية", 3: "الثالثة" }[period];
            const isKindergarten = selectedChild && /kindergarten|روض|kg/i.test(`${selectedChild.stage ?? ""} ${selectedChild.grade ?? ""}`);
            const reportKind = isKindergarten ? "المرحلة" : "الفترة";
            reportPage(selectedChild ? `تقرير ${reportKind} ${periodLabel}` : `تقارير الطلاب - الفترة ${periodLabel}`, rows, children, selectedChild);
        } else if (["reports", "plans", "current-plan", "calendar"].includes(routeName)) {
            if (routeName === "calendar") renderAcademicCalendar();
            else if (routeName === "current-plan") content.replaceChildren();
            else if (routeName === "reports") {
                const children = demoMode ? demoData.children : (await api.get("/parent/children")).data;
                renderParentReportsHub(children);
            }
            else {
                const [title, description, body] = documentPages[routeName];
                setPage(title, description, body);
            }
        } else if (routeName === "support") {
            setPage("الدعم الفني", "التواصل مع دعم المدرسة.", `<form id="supportForm" class="form-grid"><div class="field"><label for="supportSubject">العنوان</label><input id="supportSubject" required minlength="3" maxlength="160"></div><div class="field span-2"><label for="supportDescription">وصف الطلب</label><textarea id="supportDescription" required minlength="10" maxlength="2000"></textarea></div><div class="form-actions span-2"><button class="btn" type="submit">إرسال الطلب</button></div></form>`);
            document.querySelector("#supportForm").addEventListener("submit", (event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; setNotice(document.querySelector("#pageNotice"), "success", demoMode ? "تم استلام الطلب التجريبي بنجاح." : "تم إرسال الطلب بنجاح."); event.currentTarget.reset(); });
        } else {
            const rows = demoMode ? demoData.children : (await api.get("/parent/children")).data;
            const me = demoMode ? { parent: { nameAr: "ولي الأمر", nationalId: "1234567890" } } : (await api.get("/me")).data;
            renderParentDashboard(me?.parent || { nameAr: "ولي الأمر", nationalId: "—" }, rows);
        }
        document.querySelectorAll(".menu-link").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === `#${routeName}` || (routeName.startsWith("reports-period-") && link.getAttribute("href") === "#reports")));
        document.querySelector(".side-home")?.classList.toggle("active", routeName === "children");
    } catch (error) {
        content.innerHTML = `<div class="content-card page-card"><div id="pageNotice" class="notice" role="alert"></div></div>`;
        setNotice(document.querySelector("#pageNotice"), "error", error.message);
    }
}

renderSidebar();
window.addEventListener("hashchange", route);
document.querySelector("#mobileMenuButton").addEventListener("click", () => { const open = !portal.classList.contains("sidebar-open"); portal.classList.toggle("sidebar-open", open); document.querySelector("#mobileMenuButton").setAttribute("aria-expanded", String(open)); });
document.querySelector("#sidebarBackdrop").addEventListener("click", () => portal.classList.remove("sidebar-open"));
document.querySelector("#logoutButton").addEventListener("click", async () => { await logout(); location.replace("login.html"); });
route();
