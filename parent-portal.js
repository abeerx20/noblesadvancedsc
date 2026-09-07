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
    studyPlans: [
        { studentName: "ليان خالد العتيبي", subjects: ["اللغة العربية", "الرياضيات", "العلوم", "الدراسات الاجتماعية", "اللغة الإنجليزية"] },
        { studentName: "سلمان خالد العتيبي", subjects: ["المهارات الأساسية", "التربية الإسلامية", "اللغة الإنجليزية", "الفنون", "التربية البدنية"] },
        { studentName: "نورة خالد العتيبي", subjects: ["اللغة العربية", "الرياضيات", "العلوم", "اللغة الإنجليزية", "التربية الإسلامية"] }
    ],
    reports: [
        { studentName: "ليان خالد العتيبي", subject: "اللغة العربية", score: "94", status: "ممتاز" },
        { studentName: "سلمان خالد العتيبي", subject: "المهارات الأساسية", score: "88", status: "متقدم" },
        { studentName: "نورة خالد العتيبي", subject: "الرياضيات", score: "91", status: "ممتاز" }
    ]
};

function setPage(title, description, body) {
    content.innerHTML = `<section class="content-card page-card"><nav class="portal-breadcrumb" aria-label="مسار الصفحة"><span>مستندات</span><span aria-hidden="true">/</span><strong>${title}</strong></nav><div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div><button id="pageBackButton" class="btn btn-secondary btn-small no-print" type="button">رجوع</button></div><div id="pageNotice" class="notice" role="alert" aria-live="polite"></div>${body}</section>`;
    document.querySelector("#pageBackButton")?.addEventListener("click", () => { location.hash = "children"; });
}

function table(headings, rows, values) {
    if (!rows.length) return `<div class="empty-state">لا توجد بيانات مرتبطة بالحساب.</div>`;
    const head = headings.map((heading) => `<th>${heading}</th>`).join("");
    const body = rows.map((row) => `<tr>${values(row).map((value) => createCell(value).outerHTML).join("")}</tr>`).join("");
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
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

function reportPage(title, rows, children) {
    const options = children.map((child) => `<option value="${child.fullName}">${child.fullName}</option>`).join("");
    const renderReports = (selected = "all") => rows.filter((row) => selected === "all" || row.studentName === selected).map((row) => `<article class="skill-parent-report"><div class="skill-parent-header"><strong>${row.studentName}</strong><span>${row.subject} | الدرجة: ${row.score} | ${row.status}</span></div>${row.id ? `<form class="skill-parent-feedback" data-report-id="${row.id}"><label><input type="checkbox" required> تم الاطلاع على التقرير</label><textarea required minlength="1" maxlength="2000" placeholder="اكتب تعليق ولي الأمر"></textarea><button class="btn btn-small" type="submit">إرسال الإقرار والتعليق</button></form>` : ""}</article>`).join("") || `<div class="empty-state">لا توجد تقارير لهذه الفترة.</div>`;
    setPage(title, "راجعي التقرير ثم اكتبي التعليق وأكدي الاطلاع لإرساله.", `<div class="field" style="max-width: 360px"><label for="studentFilter">الطالب</label><select id="studentFilter"><option value="all">كل الأبناء</option>${options}</select></div><div id="reportResults" class="skill-parent-stack">${renderReports()}</div>`);
    const bindForms = () => document.querySelectorAll(".skill-parent-feedback").forEach((form) => form.addEventListener("submit", async (event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; const button = event.currentTarget.querySelector("button"); button.disabled = true; try { const result = await api.patch(`/parent/reports/${form.dataset.reportId}/feedback`, { comment: form.querySelector("textarea").value.trim(), acknowledged: true }); setNotice(document.querySelector("#pageNotice"), "success", result.message); form.replaceChildren(); form.innerHTML = "تم إرسال الإقرار والتعليق."; } catch (error) { setNotice(document.querySelector("#pageNotice"), "error", error.message); button.disabled = false; } }));
    bindForms();
    document.querySelector("#studentFilter").addEventListener("change", (event) => { document.querySelector("#reportResults").innerHTML = renderReports(event.target.value); bindForms(); });
}

const documentPages = {
    reports: ["التقارير", "تقارير الطلاب حسب الفترة الدراسية.", `<nav class="student-services-list" aria-label="فترات تقارير الطلاب"><a class="student-service-link" href="#reports-period-1"><span>تقارير الطلاب - الفترة الأولى</span><span aria-hidden="true">→</span></a><a class="student-service-link" href="#reports-period-2"><span>تقارير الطلاب - الفترة الثانية</span><span aria-hidden="true">→</span></a><a class="student-service-link" href="#reports-period-3"><span>تقارير الطلاب - الفترة الثالثة</span><span aria-hidden="true">→</span></a><a class="student-service-link" href="#attendance"><span>الغياب والحضور</span><span aria-hidden="true">→</span></a></nav>`],
    plans: ["الخطط الدراسية", "الخطط الدراسية المعتمدة لأبنائك.", `<nav class="student-services-list" aria-label="روابط الخطط الدراسية"><a class="student-service-link" href="#current-plan"><span>الخطة الدراسية للعام الحالي</span><span aria-hidden="true">→</span></a></nav>`],
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

function renderStudyPlan() {
    const rows = demoData.studyPlans.map((plan) => [plan.studentName, plan.subjects.join("، "), "الفصل الدراسي الأول 1448هـ"]);
    setPage("الخطة الدراسية للعام الحالي", "المواد الدراسية المعتمدة لأبنائك في الفصل الدراسي الأول.", table(["الطالب", "المواد الدراسية", "الفترة"], rows, (row) => row));
}

function renderSidebar() {
    const nav = document.querySelector("#parentSidebarMenu");
    nav.innerHTML = `<a class="side-home" href="#children"><span class="side-home-icon" aria-hidden="true"></span><span>الرئيسية</span></a><section class="menu-group"><button class="menu-group-button" type="button" aria-expanded="false"><span class="menu-group-icon" aria-hidden="true"></span><span class="menu-group-title">مستندات</span><span class="menu-group-arrow" aria-hidden="true"></span></button><div class="menu-items"><span class="menu-subtitle">مستندات ولي الأمر</span><a class="menu-link" href="#reports">التقارير</a><a class="menu-link" href="#plans">الخطط الدراسية</a><a class="menu-link" href="#calendar">التقويم الدراسي</a></div></section>`;
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
        const routeName = location.hash.replace(/^#/, "") || "children";
        if (routeName === "attendance") {
            const rows = demoMode ? demoData.attendance : (await api.get("/parent/attendance")).data;
            setPage("الحضور والغياب", "متابعة حالة الحضور اليومية.", table(["الطالب", "التاريخ", "الفصل", "الحالة"], rows, (row) => [row.studentName, row.date, row.className, attendanceLabels[row.status] ?? row.status]));
        } else if (routeName === "announcements") {
            const rows = demoMode ? demoData.announcements : (await api.get("/announcements")).data;
            setPage("الإعلانات", "آخر أخبار وتنبيهات المدرسة.", table(["العنوان", "الإعلان"], rows, (row) => [row.title, row.body]));
        } else if (["reports-period-1", "reports-period-2", "reports-period-3"].includes(routeName)) {
            const period = routeName.slice(-1);
            const rows = demoMode ? demoData.reports : (await api.get(`/parent/reports?period=${period}`)).data;
            const periodLabel = { 1: "الأولى", 2: "الثانية", 3: "الثالثة" }[period];
            const children = demoMode ? demoData.children : (await api.get("/parent/children")).data;
            reportPage(`تقارير الطلاب - الفترة ${periodLabel}`, rows, children);
        } else if (["reports", "plans", "current-plan", "calendar"].includes(routeName)) {
            if (routeName === "calendar") renderAcademicCalendar();
            else if (routeName === "current-plan") renderStudyPlan();
            else {
                const [title, description, body] = documentPages[routeName];
                setPage(title, description, body);
            }
        } else if (routeName === "support") {
            setPage("الدعم الفني", "التواصل مع دعم المدرسة.", `<form id="supportForm" class="form-grid"><div class="field"><label for="supportSubject">العنوان</label><input id="supportSubject" required minlength="3" maxlength="160"></div><div class="field span-2"><label for="supportDescription">وصف الطلب</label><textarea id="supportDescription" required minlength="10" maxlength="2000"></textarea></div><div class="form-actions span-2"><button class="btn" type="submit">إرسال الطلب</button></div></form>`);
            document.querySelector("#supportForm").addEventListener("submit", (event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; setNotice(document.querySelector("#pageNotice"), "success", demoMode ? "تم استلام الطلب التجريبي بنجاح." : "تم إرسال الطلب بنجاح."); event.currentTarget.reset(); });
        } else {
            const rows = demoMode ? demoData.children : (await api.get("/parent/children")).data;
            setPage("بوابة ولي الأمر", "بيانات الأبناء والخدمات المرتبطة بهم.", table(["اسم الطالب", "الصف", "المرحلة"], rows, (row) => [row.fullName, gradeLabels[row.grade] ?? row.grade, row.stage === "primary" ? "الابتدائي" : "رياض الأطفال"]));
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
