import { api, apiFetch, downloadFile } from "./api.js";
import { logout } from "./firebase-client.js";
import { clearNotice, createCell, fillSelect, formatDate, setNotice, submitSafely } from "./ui.js";
import {
  confirmDelete,
  confirmSave,
  confirmAction,
  showSuccess,
  showErrorModal
} from "./modal.js";

const content = document.querySelector("#mainContent");
const portal = document.querySelector("#portal");
const mobileMenuButton = document.querySelector("#mobileMenuButton");
const state = {
  me: null,
  permissions: new Set(),
  classes: null,
  employees: null,
  currentStudents: [],
  rosterOptions: null,
  rosterEdit: null,
  rosterImport: null,
  classEdit: null,
  studentEdit: null,
  assignmentPreview: null,
  notifications: [],
  notificationTimer: null
};

const labels = {
  role: {
    teacher: "معلمة", principal: "مديرة المدرسة", vice_principal: "وكيلة", hr: "الموارد البشرية", it: "تقنية المعلومات",
    it_teacher: "تقنية المعلومات", admin: "إدارية", registrar: "القبول والتسجيل", accountant: "المحاسبة",
    doctor: "طبيبة", system_admin: "مسؤولة النظام", schedule_admin: "مسؤولة الجداول", upper_management: "الإدارة العليا"
  },
  grade: { KG1: "المستوى الأول", KG2: "المستوى الثاني", KG3: "المستوى الثالث", Grade1: "الأول ابتدائي", Grade2: "الثاني ابتدائي", Grade3: "الثالث ابتدائي" },
  gender: { mixed: "مختلط", male: "بنين", female: "بنات" },
  attendance: { present: "حاضر", excused: "غائب بعذر", unexcused: "غائب دون عذر", late: "متأخر" },
  day: { sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء", wednesday: "الأربعاء", thursday: "الخميس" },
  leave: { sick: "مرضية", emergency: "اضطرارية", maternity: "وضع", nursing_hour: "ساعة الأمومة", marriage: "زواج", bereavement: "وفاة", unpaid: "بدون راتب", exam: "اختبار" }
};

const menuGroups = [
  {
    key: "academic",
    title: "أكاديمي",
    sections: [
      {
        title: "شؤون الطلاب والفصول",
        items: [
          {
            route: "students",
            label: "قوائم الطلاب",
            any: ["view_students", "manage_students"]
          }
        ]
      },
      {
        title: "الحضور والغياب",
        items: [
          {
            route: "attendance",
            label: "إدخال الغياب",
            any: [
              "enter_attendance",
              "attendance_override",
              "view_attendance",
              "manage_attendance"
            ]
          }
        ]
      },
      {
        title: "الجداول",
        items: [
          {
            route: "schedule",
            label: "الجدول الدراسي",
            any: [
              "view_schedules",
              "view_all_schedules",
              "manage_schedules"
            ]
          }
        ]
      },
      {
        title: "التقارير",
        items: [
          {
            route: "reports",
            label: "التقارير",
            any: ["view_students", "manage_students", "enter_attendance", "manage_attendance", "view_schedules"]
          }
        ]
      }
    ]
  },


  {
    key: "administrative",
    title: "إداري",
    sections: [
      {
        title: "الملف الوظيفي",
        items: [
          { route: "employee-data", label: "بيانات الموظفة" },
          { route: "performance", label: "الأداء الوظيفي" }
        ]
      },
      {
        title: "التكليف",
        items: [
          { route: "assignments", label: "تكليف بالعمل" }
        ]
      },
      {
        title: "التطوير المهني",
        items: [
          { route: "training", label: "التدريب", any: ["request_training", "manage_training_requests"] }
        ]
      },
      {
        title: "النماذج والاستعلامات",
        items: [
          { route: "forms", label: "النماذج" },
          { route: "assets", label: "الاستعلام عن العهد", any: ["request_assets", "manage_assets"] },
          { route: "loans", label: "الاستعلام عن السلف", any: ["request_loans", "manage_loans"] }
        ]
      },
      {
        title: "إدارة النظام",
        items: [
          { route: "site-settings", label: "إعدادات الموقع", roles: ["system_admin", "principal", "vice_principal", "admin", "upper_management"], any: ["manage_announcements"], roleAny: ["system_admin"] },
          {
            route: "employees",
            label: "إدارة الموظفات والصلاحيات",
            roles: ["system_admin", "principal", "admin"],
            any: ["manage_employees"]
          },
          {
            route: "employee-permissions",
            label: "صلاحيات الموظفات",
            roles: ["system_admin"],
            any: ["manage_permissions"]
          },
          {
            route: "parents",
            label: "إدارة أولياء الأمور",
            roles: ["system_admin"]
          }
        ]
      }
    ]
  },
  {
    key: "self-service", title: "خدمات ذاتية", sections: [
      {
        title: "طلباتي", items: [
          { route: "leave", label: "الإجازات", any: ["request_leave", "manage_leave_requests", "manage_leave_hr_requests"], roleAny: ["hr"] },
          { route: "permission", label: "الاستئذان", any: ["request_leave", "manage_leave_requests"] },
          { route: "approvals", label: "الموافقات على الطلبات", roles: ["system_admin", "principal", "vice_principal", "admin", "upper_management"], any: ["manage_leave_requests", "manage_training_requests"], roleAny: ["system_admin"] },
          { route: "materials", label: "طلب المواد", any: ["request_assets", "manage_assets", "request_materials", "manage_materials"] },
          { route: "absence-report", label: "تبليغ الغياب", any: ["request_absence", "request_leave", "manage_absence", "manage_leave_requests"] },
          { route: "suggestions-complaints", label: "الاقتراحات والشكاوي", any: ["request_suggestions", "request_support", "manage_support"] },
          { route: "training-course", label: "دورة تدريبية", any: ["request_training", "manage_training_requests"] },
          { route: "community", label: "الشراكة المجتمعية" },
        ]
      },
      {
        title: "المساندة", items: [
          { route: "invoices", label: "رفع الفواتير" },
          { route: "support", label: "الدعم الفني", any: ["request_support", "manage_support"] }
        ]
      }
    ]
  }
];

function has(permission) {
  return state.permissions.has(permission);
}

function hasRole(...roles) {
  return roles.includes(state.me?.employee?.role);
}

function canSee(item) {
  const roleAllowed =
    !item.roles ||
    item.roles.includes(state.me?.employee?.role);

  const permissionAllowed =
    !item.any ||
    item.any.some(has) ||
    item.roleAny?.includes(state.me?.employee?.role);

  return roleAllowed && permissionAllowed;
}

function currentRoute() { return window.location.hash.replace(/^#/, "") || "dashboard"; }
const studentPageRoutes = new Set(["student-list", "student-management", "student-add", "student-upload", "student-review", "classes"]);
const parentRouteByPage = Object.freeze({
  "forms-salary": "forms",
  "forms-employment": "forms",
  "forms-management": "forms",
  "forms-my-requests": "forms",
  "student-list": "students",
  "student-management": "students",
  "student-add": "students",
  "student-upload": "students",
  "student-review": "students",
  classes: "students",
  "attendance-entry": "attendance",
  "attendance-monitor": "attendance",
  "schedule-my": "schedule",
  "schedule-all": "schedule",
  "schedule-manage": "schedule",
  "employee-data-view": "employee-data",
  "employee-add": "employee-data",
  "employee-account-add": "employee-data",
  "employee-accounts": "employee-data",
  "employee-permissions": "employee-data",
  employees: "employee-data",
  "parent-add": "parents",
  "parent-list": "parents"
  , "assignment-issue": "assignments"
  , "assignment-my": "assignments"
  , "training-admin": "training"
  , "training-certificates": "training"
  , "training-self": "training-self"
  , "training-add": "training"
  , "training-my": "training"
  , "training-manage": "training"
  , "training-course-request": "training-course"
  , "training-course-history": "training-course"
  , "training-course-manage": "training-course"
  , assets: "assets"
  , "asset-my": "assets"
  , "asset-manage": "assets"
  , materials: "materials"
  , "material-request": "materials"
  , "material-manage": "materials"
  , "materials-add": "materials"
  , "materials-my": "materials"
  , "materials-manage": "materials"
  , "materials-manage-requests": "materials"
  , "material-upload": "materials"
  , community: "community",
  "community-add": "community",
  "community-my": "community",
  "community-manage": "community",
  "suggestions-employee": "suggestions-complaints",
  "suggestions-history": "suggestions-complaints",
  "suggestions-manage": "suggestions-complaints",
  reports: "reports",
  "skill-add": "reports",
  "skill-entry": "reports",
  "skill-approval": "reports",
  "skill-parent": "reports",
  "support-employee": "support",
  "support-history": "support",
  "support-manage": "support",
  "leave-request": "leave",
  "leave-history": "leave",
  "leave-extension": "leave",
  "leave-manager": "leave",
  "leave-hr": "leave",
  "absence-report-self": "absence-report",
  "absence-report-history": "absence-report",
  "absence-report-manage": "absence-report",
  "permission-self": "permission",
  "permission-history": "permission",
  "permission-manage": "permission",

});
const studentBreadcrumbs = {
  students: ["أكاديمي", "شؤون الطلاب والفصول", "قوائم الطلاب"],
  "student-list": ["أكاديمي", "شؤون الطلاب والفصول", "قوائم الطلاب", "عرض قوائم الطلاب"],
  "student-management": ["أكاديمي", "شؤون الطلاب والفصول", "قوائم الطلاب", "إدارة الطلاب"],
  "student-add": ["أكاديمي", "شؤون الطلاب والفصول", "قوائم الطلاب", "إضافة طالب"],
  "student-upload": ["أكاديمي", "شؤون الطلاب والفصول", "قوائم الطلاب", "رفع ملف Excel"],
  "student-review": ["أكاديمي", "شؤون الطلاب والفصول", "قوائم الطلاب", "المسودات والاعتماد"],
  classes: ["أكاديمي", "شؤون الطلاب والفصول", "قوائم الطلاب", "إدارة الفصول"],
  reports: ["أكاديمي", "التقارير", "التقارير"],
  "skill-add": ["أكاديمي", "التقارير", "إضافة مهارة"],
  "skill-entry": ["أكاديمي", "التقارير", "إدخال الدرجات"],
  "skill-approval": ["أكاديمي", "التقارير", "تقارير المدير"],
  "skill-parent": ["أكاديمي", "التقارير", "التقييمات المعتمدة"]
};
const scheduleBreadcrumbs = {
  schedule: ["أكاديمي", "الجداول", "الجدول الدراسي"],
  "schedule-my": ["أكاديمي", "الجداول", "الجدول الدراسي", "عرض الجدول الدراسي"],
  "schedule-all": ["أكاديمي", "الجداول", "الجدول الدراسي", "عرض جميع الجداول الدراسية"],
  "schedule-manage": ["أكاديمي", "الجداول", "الجدول الدراسي", "إدارة الجدول الدراسي"]
};
const administrativeBreadcrumbs = {
  "employee-data": ["إداري", "الخدمات الإدارية", "بيانات الموظفة"],
  "employee-data-view": ["إداري", "الخدمات الإدارية", "بيانات الموظفة", "عرض بياناتي الوظيفية"],
  "employee-add": ["إداري", "الخدمات الإدارية", "بيانات الموظفة", "إضافة موظفة وإدخال بياناتها"],
  employees: ["إداري", "إدارة النظام", "إدارة الموظفات والصلاحيات"]
  , assignments: ["إداري", "التكليف", "تكليف بالعمل"]
  , "assignment-issue": ["إداري", "التكليف", "تكليف بالعمل", "إصدار تكليف"]
  , "assignment-my": ["إداري", "التكليف", "تكليف بالعمل", "عرض تكليفاتي"]
  , training: ["إداري", "التطوير المهني", "التدريب"]
  , "training-admin": ["إداري", "التطوير المهني", "التدريب"]
  , "training-certificates": ["إداري", "التطوير المهني", "التدريب"]
  , "training-self": ["خدمات ذاتية", "دورة تدريبية"]
  , "training-add": ["إداري", "التطوير المهني", "التدريب", "رفع شهادة تدريبية"]
  , "training-my": ["إداري", "التطوير المهني", "التدريب", "سجل تدريباتي"]
  , "training-manage": ["إداري", "التطوير المهني", "التدريب", "سجل شهادات الموظفات"]
  , assets: ["إداري", "النماذج والاستعلامات", "العهد"]
  , "asset-my": ["إداري", "النماذج والاستعلامات", "العهد", "الاستعلام عن العهدة"]
  , "asset-manage": ["إداري", "النماذج والاستعلامات", "العهد", "إدارة العهدة"]
  , materials: ["إداري", "النماذج والاستعلامات", "طلب المواد"]
  , "material-request": ["إداري", "النماذج والاستعلامات", "طلب المواد", "طلب مواد جديد"]
  , "material-manage": ["إداري", "النماذج والاستعلامات", "طلب المواد", "إدارة الطلبات"]

};

function setSidebarOpen(open) {
  portal.classList.toggle("sidebar-open", open);
  mobileMenuButton.setAttribute("aria-expanded", String(open));
}

function setupDateInputs(root) {
  root.querySelectorAll('input[type="date"], input[type="datetime-local"], input[type="month"]').forEach((input) => {
    if (input.dataset.dateInputReady) return;
    input.dataset.dateInputReady = "true";
    input.dataset.dateInputType = input.type;
    input.setAttribute("placeholder", "يوم/شهر/سنة");
    input.setAttribute("lang", "ar");
    input.setAttribute("dir", "rtl");
    input.style.textAlign = "right";
    input.type = "text";
    input.inputMode = "numeric";
    input.addEventListener("focus", () => {
      input.type = input.dataset.dateInputType;
      input.setAttribute("lang", "en-GB");
      input.setAttribute("dir", "ltr");
      input.style.textAlign = "right";
    });
    input.addEventListener("blur", () => {
      if (!input.value) {
        input.type = "text";
        input.setAttribute("lang", "ar");
        input.setAttribute("dir", "rtl");
        input.style.textAlign = "right";
      }
    });
  });
}

function page(title, description, body) {
  const routeName = currentRoute();
  const routeLocation = menuGroups
    .flatMap((group) => group.sections.flatMap((section) => section.items.map((item) => ({ group: group.title, section: section.title, item }))))
    .find((entry) => entry.item.route === routeName);
  const breadcrumbItems = studentBreadcrumbs[routeName]
    ?? scheduleBreadcrumbs[routeName]
    ?? administrativeBreadcrumbs[routeName]
    ?? (routeLocation ? [routeLocation.group, routeLocation.section, routeLocation.item.label] : ["الرئيسية"]);
  const breadcrumbContent = breadcrumbItems.map((item, index) => {
    const separator = index ? '<span aria-hidden="true">/</span>' : "";
    const label = index === breadcrumbItems.length - 1 ? `<strong>${item}</strong>` : `<span>${item}</span>`;
    return `${separator}${label}`;
  }).join("");
  const breadcrumb = `<nav class="portal-breadcrumb" aria-label="مسار الصفحة">${breadcrumbContent}</nav>`;
  const backButton = routeName === "dashboard"
    ? ""
    : '<button id="pageBackButton" class="btn btn-secondary btn-small no-print" type="button">رجوع</button>';
  content.innerHTML = `<section class="content-card page-card">${breadcrumb}<div class="page-heading"><div><h1>${title}</h1><p>${description}</p></div>${backButton}</div><div id="pageNotice" class="notice" role="alert" aria-live="polite"></div>${body}</section>`;
  setupDateInputs(content);
  document.querySelector("#pageBackButton")?.addEventListener("click", () => {
    const linksContainer = document.querySelector("#linksContainer");

    if (linksContainer && linksContainer.style.display === "none") {
      linksContainer.style.display = "block";
      clearNotice(document.querySelector("#pageNotice"));

      const contentContainer = document.querySelector("#contentContainer");
      if (contentContainer) {
        contentContainer.innerHTML = "";
      }

      return;
    }
    if (routeName === "student-add") state.rosterEdit = null;

    if (routeName.startsWith("forms")) {
      state.certificates = null;
    }

    window.location.hash = parentRouteByPage[routeName] ?? "dashboard";
  });


  content.focus();
}

async function printPortalPage(button = null) {
  if (button?.disabled) return;
  if (button) button.disabled = true;

  const printImages = [...document.querySelectorAll(".official-print-header img")];
  await Promise.all(printImages.map(async (image) => {
    if (!image.complete) {
      try {
        await image.decode();
      } catch {
        // Continue printing if a browser cannot decode an optional logo.
      }
    }
  }));

  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const finish = () => {
    if (button) button.disabled = false;
    window.removeEventListener("afterprint", finish);
  };
  window.addEventListener("afterprint", finish, { once: true });
  window.print();
}

function showError(error) {
  const notice = document.querySelector("#pageNotice");
  if (notice) setNotice(notice, "error", error.message ?? "تعذر إكمال العملية.");
}

function renderMenu() {
  const nav = document.querySelector("#sidebarMenu");
  nav.replaceChildren();
  const home = document.createElement("a"); home.className = "side-home"; home.href = "#dashboard";
  const homeIcon = document.createElement("span"); homeIcon.className = "side-home-icon"; homeIcon.setAttribute("aria-hidden", "true");
  const homeLabel = document.createElement("span"); homeLabel.textContent = "الرئيسية";
  home.append(homeIcon, homeLabel); nav.append(home);
  menuGroups.forEach((group, groupIndex) => {
    const visibleSections = group.sections
      .map((section) => ({ ...section, items: section.items.filter(canSee) }))
      .filter((section) => section.items.length);
    if (!visibleSections.length) return;
    const wrapper = document.createElement("section"); wrapper.className = `menu-group menu-group-${group.key}`;
    const button = document.createElement("button"); button.className = "menu-group-button"; button.type = "button";
    const itemsId = `menu-group-${groupIndex}`;
    button.setAttribute("aria-controls", itemsId);
    button.setAttribute("aria-expanded", "false");
    const icon = document.createElement("span"); icon.className = "menu-group-icon"; icon.setAttribute("aria-hidden", "true");
    const title = document.createElement("span"); title.className = "menu-group-title"; title.textContent = group.title;
    const arrow = document.createElement("span"); arrow.className = "menu-group-arrow"; arrow.setAttribute("aria-hidden", "true");
    button.append(icon, title, arrow);
    const items = document.createElement("div"); items.className = "menu-items"; items.id = itemsId;
    visibleSections.forEach((section) => {
      const subtitle = document.createElement("span"); subtitle.className = "menu-subtitle"; subtitle.textContent = section.title; items.append(subtitle);
      section.items.forEach((item) => {
        const link = document.createElement("a"); link.className = "menu-link"; link.href = `#${item.route}`; link.textContent = item.label; items.append(link);
      });
    });
    button.addEventListener("click", () => {
      document.querySelectorAll(".menu-group.open").forEach((open) => {
        if (open !== wrapper) {
          open.classList.remove("open");
          open.querySelector(".menu-group-button")?.setAttribute("aria-expanded", "false");
        }
      });
      wrapper.classList.toggle("open");
      const isOpen = wrapper.classList.contains("open");
      button.setAttribute("aria-expanded", String(isOpen));
      document.querySelector(".side-home")?.classList.toggle("active", !isOpen && currentRoute() === "dashboard");
    });
    wrapper.append(button, items); nav.append(wrapper);
  });
}

function markRoute(route) {
  let activeGroup = null;
  const dashboardActive = route === "dashboard";
  document.querySelector(".side-home")?.classList.toggle("active", dashboardActive);

  const allLinks = document.querySelectorAll(".menu-link");
  console.log("ًں“‹ Total menu links found:", allLinks.length);

  allLinks.forEach((link) => {
    const href = link.getAttribute("href");
    const active = href === `#${route}`;
    link.classList.toggle("active", active);
    if (active) {
      console.log("✓ Active link found:", href, "→", link.textContent.trim());
      activeGroup = link.closest(".menu-group");
    }
  });

  document.querySelectorAll(".menu-group").forEach((group) => {
    const open = activeGroup ? group === activeGroup : false;
    group.classList.toggle("open", open);
    const button = group.querySelector(".menu-group-button");
    button?.setAttribute("aria-expanded", String(open));
    if (open)
      console.log("ًں“‚ Opened menu group");
  });
  setSidebarOpen(false);
}

async function loadClasses() {
  if (!state.classes) state.classes = (await api.get("/academic-classes")).data;
  return state.classes;
}

async function loadEmployees() {
  if (!state.employees) state.employees = (await api.get("/employees?limit=200")).data;
  return state.employees;
}

function classLabel(item) { return `${labels.grade[item.grade] ?? item.grade} - ${item.section} - ${labels.gender[item.gender] ?? item.gender}`; }
function localDate() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
function weekNumber(dateValue) {
  const date = new Date(`${dateValue}T12:00:00Z`); const first = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - first) / 86400000) + first.getUTCDay() + 1) / 7);
}

function notificationDate(value) {
  if (!value) return "الآن";
  return formatDate(String(value).slice(0, 10));
}

function renderNotifications() {
  const list = document.querySelector("#notificationList");
  const count = document.querySelector("#notificationCount");
  if (!list || !count) return;
  const unread = state.notifications.filter((item) => !item.read).length;
  count.textContent = String(unread);
  count.classList.toggle("hidden", unread === 0);
  list.replaceChildren();
  if (!state.notifications.length) {
    const empty = document.createElement("span");
    empty.className = "notification-empty";
    empty.textContent = "لا توجد تنبيهات جديدة.";
    list.append(empty);
    return;
  }
  state.notifications.slice(0, 20).forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `notification-item${item.read ? " read" : ""}`;
    const title = document.createElement("strong");
    title.textContent = item.title ?? "تنبيه جديد";
    const message = document.createElement("span");
    message.textContent = item.message || "لديكِ تحديث جديد.";
    const date = document.createElement("small");
    date.textContent = notificationDate(item.createdAt);
    button.append(title, message, date);
    button.addEventListener("click", async () => {
      if (!item.read) {
        try { await api.patch(`/notifications/${encodeURIComponent(item.id)}/read`, {}); } catch { return; }
        item.read = true;
        renderNotifications();
      }
    });
    list.append(button);
  });
}

async function loadNotifications() {
  try {
    state.notifications = (await api.get("/notifications")).data ?? [];
    renderNotifications();
  } catch {
    state.notifications = [];
  }
}

function setupNotifications() {
  const button = document.querySelector("#notificationButton");
  const panel = document.querySelector("#notificationPanel");
  if (!button || !panel) return;
  button.addEventListener("click", () => {
    const open = panel.classList.toggle("hidden");
    button.setAttribute("aria-expanded", String(!open));
  });
  loadNotifications();
  state.notificationTimer = window.setInterval(loadNotifications, 30000);
}

async function renderDashboard() {
  page("بوابة الموظفة", "مساحة موحّدة للوصول إلى خدماتك الأكاديمية والإدارية.", `
    <section class="dashboard-welcome" aria-labelledby="dashboardWelcomeTitle">
      <div>
        <span class="dashboard-eyebrow">مرحبًا بكِ</span>
        <h2 id="dashboardWelcomeTitle">يوم عمل منظّم يبدأ من هنا</h2>
        <p>اختاري الخدمة المطلوبة من القائمة أو من اختصارات الوصول السريع.</p>
      </div>
      <span class="account-status"><span aria-hidden="true"></span>الحساب نشط</span>
    </section>
 
    <section class="employee-overview" aria-labelledby="employeeOverviewTitle">
      <div class="section-heading">
        <div>
          <span>الملف الوظيفي</span>
          <h2 id="employeeOverviewTitle">بيانات الموظفة</h2>
        </div>
        <span class="data-privacy">بيانات مرتبطة بحسابك فقط</span>
      </div>
      <dl class="employee-data-grid">
        <div class="employee-data-primary">
          <dt>اسم الموظفة بالعربية</dt>
          <dd id="dashEmployeeName">—</dd>
        </div>
        <div>
          <dt>الاسم بالإنجليزية</dt>
          <dd id="dashEmployeeNameEn" dir="ltr">—</dd>
        </div>
        <div>
          <dt>الرقم الوظيفي</dt>
          <dd id="dashNumber">—</dd>
        </div>
        <div>
          <dt>المسمى الوظيفي</dt>
          <dd id="dashRole">—</dd>
        </div>
        <div>
          <dt>البريد الإلكتروني الرسمي</dt>
          <dd id="dashEmail" dir="ltr">—</dd>
        </div>
      </dl>
    </section>
 
    <section class="quick-section" aria-labelledby="quickLinksTitle">
      <div class="section-heading">
        <div>
          <span>اختصاراتك</span>
          <h2 id="quickLinksTitle">وصول سريع</h2>
        </div>
      </div>
      <div id="quickLinks" class="quick-grid"></div>  
    </section>`);

  const employeeOverview = content.querySelector(".employee-overview");
  const contentCard = content.querySelector(".content-card");

  if (employeeOverview && contentCard) {
    contentCard.prepend(employeeOverview);
  }

  const employee = state.me.employee;
  document.querySelector("#dashEmployeeName").textContent = employee.nameAr;
  document.querySelector("#dashEmployeeName").textContent = employee.nameAr;
  document.querySelector("#dashEmployeeNameEn").textContent = employee.nameEn || "غير مسجل";
  document.querySelector("#dashNumber").textContent = employee.employeeNumber;
  document.querySelector("#dashRole").textContent = labels.role[employee.role] ?? employee.role;
  document.querySelector("#dashEmail").textContent = state.me.email ?? "—";
  const quick = [
    ["attendance", "إدخال الغياب", "تسجيل حالات طلاب الحصة الأولى", ["enter_attendance", "manage_attendance"]],
    ["leave", "طلب إجازة", "إرسال طلب ومتابعة حالته", ["request_leave"]],
    ["schedule", "جدولي الدراسي", "عرض الحصص والمناوبات", ["view_schedules", "manage_schedules"]],
  ];
  const grid = document.querySelector("#quickLinks");
  quick.filter((item) => item[3].some(has)).forEach(([route, title, description]) => {
    const link = document.createElement("a"); link.className = "quick-link"; link.href = `#${route}`; link.dataset.route = route;
    const icon = document.createElement("span"); icon.className = "quick-link-icon"; icon.setAttribute("aria-hidden", "true");
    const body = document.createElement("span"); body.className = "quick-link-body";
    const strong = document.createElement("strong"); strong.textContent = title;
    const descriptionText = document.createElement("span"); descriptionText.textContent = description;
    const arrow = document.createElement("span"); arrow.className = "quick-link-arrow"; arrow.textContent = "→"; arrow.setAttribute("aria-hidden", "true");
    body.append(strong, descriptionText); link.append(icon, body, arrow); grid.append(link);
  });
}

function gradeOptions(stage) {
  return stage === "kindergarten" ? [["KG1", "المستوى الأول"], ["KG2", "المستوى الثاني"], ["KG3", "المستوى الثالث"]]
    : stage === "primary" ? [["Grade1", "الأول ابتدائي"], ["Grade2", "الثاني ابتدائي"], ["Grade3", "الثالث ابتدائي"]] : [];
}

function bindClassCascade(prefix, classes) {
  const stage = document.querySelector(`#${prefix}Stage`); const grade = document.querySelector(`#${prefix}Grade`);
  const gender = document.querySelector(`#${prefix}Gender`); const classSelect = document.querySelector(`#${prefix}Class`);
  function refreshGrades() { fillSelect(grade, gradeOptions(stage.value), (x) => x[0], (x) => x[1], "اختاري الصف"); refreshClasses(); }
  function refreshClasses() {
    const filtered = classes.filter((item) => (!stage.value || item.stage === stage.value) && (!grade.value || item.grade === grade.value) && (!gender.value || item.gender === gender.value));
    fillSelect(classSelect, filtered, (x) => x.id, classLabel, "اختاري الشعبة");
  }
  stage.addEventListener("change", () => {
    gender.value = ""; gender.replaceChildren(new Option("اختاري الجنس", ""));
    if (stage.value === "kindergarten") gender.append(new Option("مختلط", "mixed"));
    if (stage.value === "primary") { gender.append(new Option("بنين", "male"), new Option("بنات", "female")); }
    refreshGrades();
  });
  grade.addEventListener("change", refreshClasses); gender.addEventListener("change", refreshClasses);
}

function studentHubLink(route, title, description) {
  return `<a class="student-service-link" href="#${route}" data-route="${route}" aria-label="${title}: ${description}"><span>${title}</span><span aria-hidden="true">→</span></a>`;
}

function skillPeriodOptions(selected = "الفترة الأولى") {
  const periods = ["الفترة الأولى", "الفترة الثانية", "الفترة الثالثة", "الفترة الرابعة"];
  return periods.map((period) => `<option value="${period}" ${period === selected ? "selected" : ""}>${period}</option>`).join("");
}

function appendSkillRow(container, values = { name: "", period: "الفترة الأولى" }) {
  const row = document.createElement("div");
  row.className = "skill-row";
  row.innerHTML = `
    <div class="field">
      <label>اسم المهارة</label>
      <input type="text" value="${values.name}" placeholder="اكتب اسم المهارة" autocomplete="off">
    </div>
    <div class="field">
      <label>الفترة</label>
      <select>${skillPeriodOptions(values.period)}</select>
    </div>
    <button type="button" class="btn btn-secondary btn-small skill-add-inline" aria-label="إضافة مهارة">+</button>
    <button type="button" class="btn btn-danger btn-small skill-remove-inline" aria-label="حذف المهارة">−</button>
  `;

  const addButton = row.querySelector(".skill-add-inline");
  const removeButton = row.querySelector(".skill-remove-inline");
  addButton.addEventListener("click", () => appendSkillRow(container, { name: "", period: "الفترة الأولى" }));
  removeButton.addEventListener("click", () => {
    if (container.querySelectorAll(".skill-row").length > 1) row.remove();
  });

  container.append(row);
}

function renderReportsHub() {
  const links = [];

  if (hasRole("teacher", "system_admin")) {
    links.push(studentHubLink("skill-add", "إضافة مهارة", "إضافة مهارات المعلمة حسب الصف والشعبة والفترة"));
    links.push(studentHubLink("skill-entry", "إدخال الدرجات", "اختيار الصف والشعبة والطالب ثم تسجيل التقييم"));
  }

  if (hasRole("principal", "vice_principal", "admin", "system_admin")) {
    links.push(studentHubLink("skill-approval", "تقارير المدير", "مراجعة التقارير المعتمدة أو إعادة التعديل"));
  }

  if (hasRole("parent") || has("view_students")) {
    links.push(studentHubLink("skill-parent", "التقييمات المعتمدة", "عرض المهارات المعتمدة للطلاب"));
  }

  if (!links.length) {
    throw new Error("لا توجد صلاحية الوصول إلى التقارير الأكاديمية.");
  }

  page("التقارير", "إدارة المهارات والتقييمات الأكاديمية.", `
    <nav class="student-services-list" aria-label="روابط التقارير">
      ${links.join("")}
    </nav>
  `);
}

function renderSkillAddPage() {
  page("إضافة مهارة", "ضيفي المهارة مع تحديد الفترة، ويمكنك إضافة أكثر من مهارة في نفس النموذج.", `
    <form id="skillCatalogForm" class="report-form">
      <div id="skillRows" class="skill-rows"></div>
      <div class="form-actions">
        <button type="submit" class="btn">حفظ المهارات</button>
      </div>
    </form>
  `);

  const rows = document.querySelector("#skillRows");
  appendSkillRow(rows, { name: "", period: "الفترة الأولى" });

  document.querySelector("#skillCatalogForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const records = [];
    rows.querySelectorAll(".skill-row").forEach((row) => {
      const name = row.querySelector("input").value.trim();
      const period = row.querySelector("select").value;
      if (name) {
        records.push({ name, period, createdBy: state.me?.employee?.nameAr || "المعلمة" });
      }
    });

    if (!records.length) {
      setNotice(document.querySelector("#pageNotice"), "error", "اكتبي اسمًا على الأقل لمهارة واحدة.");
      return;
    }

    const existing = JSON.parse(localStorage.getItem("nas-skill-catalog") || "[]");
    const merged = [...existing, ...records];
    localStorage.setItem("nas-skill-catalog", JSON.stringify(merged));
    setNotice(document.querySelector("#pageNotice"), "success", "تم حفظ المهارات بنجاح.");
    rows.replaceChildren();
    appendSkillRow(rows, { name: "", period: "الفترة الأولى" });
  });
}

async function renderSkillEntryPage() {
  const classes = await loadClasses();
  const allSkills = JSON.parse(localStorage.getItem("nas-skill-catalog") || "[]");

  page("إدخال الدرجات", "اختاري الصف والشعبة واسم الطالب ثم سجل التقييم لكل مهارة.", `
    <div class="form-grid skill-entry-grid">
      <div class="field">
        <label for="skillEntryTeacher">اسم المعلمة</label>
        <input id="skillEntryTeacher" type="text" value="${state.me?.employee?.nameAr || ""}" readonly>
      </div>
      <div class="field">
        <label for="skillEntrySubject">اسم المادة</label>
        <select id="skillEntrySubject"><option value="">اختاري المادة</option></select>
      </div>
      <div class="field">
        <label for="skillEntryGrade">الصف</label>
        <select id="skillEntryGrade"><option value="">اختاري الصف</option></select>
      </div>
      <div class="field">
        <label for="skillEntryClass">الشعبة</label>
        <select id="skillEntryClass" disabled><option value="">اختاري الشعبة</option></select>
      </div>
      <div class="field">
        <label for="skillEntryStudent">اسم الطالب</label>
        <select id="skillEntryStudent" disabled><option value="">اختاري الطالب</option></select>
      </div>
    </div>
    <div id="skillEntryTable" class="table-wrap"></div>
    <div class="form-actions">
      <button id="saveSkillScores" class="btn" type="button">حفظ التقييم</button>
    </div>
  `);

  const teacherInput = document.querySelector("#skillEntryTeacher");
  const subjectSelect = document.querySelector("#skillEntrySubject");
  const gradeSelect = document.querySelector("#skillEntryGrade");
  const classSelect = document.querySelector("#skillEntryClass");
  const studentSelect = document.querySelector("#skillEntryStudent");
  const tableWrap = document.querySelector("#skillEntryTable");

  const skillSubjects = ["لغتي", "رياضيات", "علوم", "إسلامي"];
  fillSelect(subjectSelect, skillSubjects, (x) => x, (x) => x, "اختاري المادة");

  fillSelect(gradeSelect, [...new Set(classes.map((item) => item.grade))], (x) => x, (x) => labels.grade[x] ?? x, "اختاري الصف");

  const refreshClasses = () => {
    const filtered = classes.filter((item) => item.grade === gradeSelect.value);
    fillSelect(classSelect, filtered, (x) => x.id, (x) => `${x.section} - ${labels.gender[x.gender] ?? x.gender}`, "اختاري الشعبة");
    classSelect.disabled = !filtered.length;
    studentSelect.disabled = true;
    studentSelect.replaceChildren(new Option("اختاري الطالب", ""));
    tableWrap.innerHTML = "<div class=\"empty-state\">اختاري الطالب لعرض جدول المهارات.</div>";
  };

  const refreshStudents = async () => {
    const selectedClass = classes.find((item) => item.id === classSelect.value);
    if (!selectedClass) return;
    try {
      const students = (await api.get(`/students?classId=${encodeURIComponent(selectedClass.id)}&approvedOnly=true&limit=200`)).data;
      fillSelect(studentSelect, students, (x) => x.id, (x) => x.fullName, "اختاري الطالب");
      studentSelect.disabled = !students.length;
      if (!students.length) {
        tableWrap.innerHTML = "<div class=\"empty-state\">لا يوجد طلاب في هذا الفصل.</div>";
      } else {
        renderSkillGradeRows(
          tableWrap,
          allSkills,
          students,
          studentSelect
        );
      }
    } catch (error) {
      showError(error);
    }
  };

  gradeSelect.addEventListener("change", refreshClasses);
  classSelect.addEventListener("change", refreshStudents);
  studentSelect.addEventListener("change", () => renderSkillGradeRows(tableWrap, allSkills, [], studentSelect));

  document.querySelector("#saveSkillScores").addEventListener("click", () => {
    const studentId = studentSelect.value;
    const studentName = studentSelect.selectedOptions[0]?.text || "";
    const teacherName = teacherInput.value.trim() || state.me?.employee?.nameAr || "";
    const subjectName = subjectSelect.value;

    if (!studentId || !studentName) {
      setNotice(document.querySelector("#pageNotice"), "error", "اختاري الطالب أولاً.");
      return;
    }

    if (!subjectName) {
      setNotice(document.querySelector("#pageNotice"), "error", "اختاري اسم المادة أولاً.");
      subjectSelect.focus();
      return;
    }

    const rows = [...tableWrap.querySelectorAll(".skill-score-row")];
    const payload = {
      id: `skill-${Date.now()}`,
      date: new Date().toLocaleDateString("ar-SA"),
      teacherName,
      teacherUid: state.me?.uid,
      subjectName,
      studentId,
      studentName,
      className: classSelect.selectedOptions[0]?.text || "",
      status: "قيد المراجعة",
      skills: rows.map((row) => ({
        name: row.dataset.skillName,
        period: row.dataset.skillPeriod,
        level: row.querySelector("select[data-role='score']").value,
        note: row.querySelector("textarea").value.trim()
      }))
    };

    const existing = JSON.parse(localStorage.getItem("nas-skill-reports") || "[]");
    existing.push(payload);
    localStorage.setItem("nas-skill-reports", JSON.stringify(existing));
    setNotice(document.querySelector("#pageNotice"), "success", "تم إرسال التقرير للمديرة للمراجعة.");
  });

  if (!allSkills.length) {
    tableWrap.innerHTML = "<div class=\"empty-state\">لا توجد مهارات مسجلة بعد. أضفِ مهارة أولاً من صفحة \"إضافة مهارة\".</div>";
  }
}

function renderSkillGradeRows(tableWrap, allSkills, students, studentSelect) {
  if (!allSkills.length) {
    tableWrap.innerHTML = "<div class=\"empty-state\">لا توجد مهارات مسجلة بعد.</div>";
    return;
  }

  if (!studentSelect.value) {
    tableWrap.innerHTML = "<div class=\"empty-state\">اختاري الطالب لعرض جدول المهارات.</div>";
    return;
  }

  const rows = allSkills.map((skill, index) => `
    <tr class="skill-score-row" data-skill-name="${skill.name}" data-skill-period="${skill.period}">
      <td>${index + 1}</td>
      <td>${skill.name}</td>
      <td>
        <select data-role="score">
          <option value="اتقن">اتقن</option>
          <option value="متقدم">متقدم</option>
          <option value="لم يتقن">لم يتقن</option>
        </select>
      </td>
      <td>
        <textarea rows="2" placeholder="ملاحظات المعلمة"></textarea>
      </td>
    </tr>
  `).join("");

  tableWrap.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>م</th>
            <th>اسم المهارة</th>
            <th>التقييم</th>
            <th>ملاحظات المعلمة</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderSkillApprovalPage() {
  const reports = JSON.parse(localStorage.getItem("nas-skill-reports") || "[]");
  const pending = reports.filter((item) => item.status === "قيد المراجعة");

  page("تقارير المدير", "مراجعة تقييمات المعلمات ثم اعتمادها أو إعادة التعديل.", `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>اسم الطالب</th>
            <th>الفصل</th>
            <th>التاريخ</th>
            <th>عدد المهارات</th>
            <th>الإجراء</th>
          </tr>
        </thead>
        <tbody>
          ${pending.length ? pending.map((item) => `
            <tr>
              <td>${item.studentName}</td>
              <td>${item.className}</td>
              <td>${item.date}</td>
              <td>${item.skills.length}</td>
              <td>
                <div class="skill-approval-actions">
                  <button type="button" class="btn btn-small" data-approve-skill="${item.id}">اعتماد</button>
                  <button type="button" class="btn btn-danger btn-small" data-reject-skill="${item.id}">إعادة التعديل</button>
                </div>
              </td>
            </tr>
          `).join("") : `<tr><td colspan="5"><div class="empty-state">لا توجد تقارير قيد المراجعة.</div></td></tr>`}
        </tbody>
      </table>
    </div>
  `);

  document.querySelectorAll("[data-approve-skill]").forEach((button) => {
    button.addEventListener("click", async () => {
      const reportsList = JSON.parse(localStorage.getItem("nas-skill-reports") || "[]");
      const target = reportsList.find((item) => item.id === button.dataset.approveSkill);
      if (!target) return;
      button.disabled = true;
      try {
        const periodMap = { "الفترة الأولى": 1, "الفترة الثانية": 2, "الفترة الثالثة": 3 };
        await api.post("/student-reports", {
          studentId: target.studentId,
          period: periodMap[target.skills[0]?.period] ?? 1,
          subject: target.subjectName,
          status: "معتمد",
          teacherUid: target.teacherUid,
          teacherName: target.teacherName,
          className: target.className,
          skills: target.skills.map((skill) => ({ name: skill.name, level: skill.level, note: skill.note || "" }))
        });
        target.status = "معتمد";
        target.approvedAt = new Date().toISOString();
        target.sentToParent = true;
        localStorage.setItem("nas-skill-reports", JSON.stringify(reportsList));
        setNotice(document.querySelector("#pageNotice"), "success", "تم اعتماد التقرير وحفظه ليظهر لولي الأمر.");
        renderSkillApprovalPage();
      } catch (error) {
        button.disabled = false;
        setNotice(document.querySelector("#pageNotice"), "error", error.message);
      }
    });
  });

  document.querySelectorAll("[data-reject-skill]").forEach((button) => {
    button.addEventListener("click", () => {
      const reportsList = JSON.parse(localStorage.getItem("nas-skill-reports") || "[]");
      const target = reportsList.find((item) => item.id === button.dataset.rejectSkill);
      if (!target) return;
      target.status = "محتاج تعديل";
      localStorage.setItem("nas-skill-reports", JSON.stringify(reportsList));
      renderSkillApprovalPage();
    });
  });
}

function renderSkillParentPage() {
  const reports = JSON.parse(localStorage.getItem("nas-skill-reports") || "[]");
  const approved = reports.filter((item) => item.status === "معتمد");

  page("التقييمات المعتمدة", "عرض تقييمات الأبناء بعد اعتماد المديرة.", `
    <div class="skill-parent-stack">
      ${approved.length ? approved.map((item) => `
        <div class="skill-parent-report">
          <div class="skill-parent-header">
            <div><strong>اسم الطالب:</strong> ${item.studentName}</div>
            <div><strong>الفصل:</strong> ${item.className}</div>
            <div><strong>التاريخ:</strong> ${item.date}</div>
            <div><strong>المعلمة:</strong> ${item.teacherName || "—"}</div>
            <div><strong>المادة:</strong> ${item.subjectName || "—"}</div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>المهارة</th>
                  <th>التقييم</th>
                  <th>الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                ${item.skills.map((skill) => `
                  <tr>
                    <td>${skill.name}</td>
                    <td>${skill.level}</td>
                    <td>${skill.note || "—"}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <form class="skill-parent-feedback" data-report-id="${item.id}">
            <label for="parentComment-${item.id}">تعليق ولي الأمر</label>
            <textarea id="parentComment-${item.id}" rows="3" placeholder="اكتب تعليقك هنا...">${item.parentReply?.comment || ""}</textarea>

            <label class="checkbox-row">
              <input type="checkbox" ${item.parentReply?.acknowledged ? "checked" : ""}>
              <span>تم الاطلاع على التقرير</span>
            </label>

            <div class="form-actions">
              <button type="submit" class="btn btn-small">إرسال</button>
            </div>
          </form>
        </div>
      `).join("") : `<div class="empty-state">لا توجد تقارير معتمدة حتى الآن.</div>`}
    </div>
  `);

  document.querySelectorAll(".skill-parent-feedback").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const reportId = form.dataset.reportId;
      const checkbox = form.querySelector("input[type='checkbox']");
      const textarea = form.querySelector("textarea");

      if (!checkbox.checked) {
        setNotice(document.querySelector("#pageNotice"), "error", "يرجى تأكيد أنه تم الاطلاع على التقرير قبل الإرسال.");
        return;
      }

      const reportsList = JSON.parse(localStorage.getItem("nas-skill-reports") || "[]");
      const target = reportsList.find((item) => item.id === reportId);
      if (!target) return;

      target.parentReply = {
        comment: textarea.value.trim(),
        acknowledged: true,
        sentAt: new Date().toISOString()
      };
      target.parentReplySentTo = ["مديرة", "معلمة"];
      target.parentViewedAt = new Date().toISOString();
      localStorage.setItem("nas-skill-reports", JSON.stringify(reportsList));
      setNotice(document.querySelector("#pageNotice"), "success", "تم إرسال تعليق ولي الأمر إلى المديرة والمعلمة.");
      renderSkillParentPage();
    });
  });
}

async function renderStudents() {
  const managerLinks = has("manage_students")
    ? [
      studentHubLink("student-management", "إدارة الطلاب", "عرض وتعديل وحذف طلاب كل شعبة"),
      studentHubLink("student-add", "إضافة طالب", "إضافة طالب جديد إلى المسودات"),
      studentHubLink("student-upload", "رفع ملف Excel", "معاينة الملف ثم حفظ المقبول"),
      studentHubLink("classes", "إدارة الفصول", "تعريف الصفوف والشعب")
    ].join("")
    : "";
  page("قوائم الطلاب", "اختاري الخدمة المطلوبة.", `
    <nav class="student-services-list" aria-label="خدمات قوائم الطلاب">
      ${studentHubLink("student-list", "عرض قوائم الطلاب", "عرض القائمة المعتمدة والطباعة والتصدير")}
      ${managerLinks}
    </nav>`);
}

async function renderStudentList() {
  page(
    "قوائم الطلاب",
    "",
    `
      <div class="filters">
        <div class="field">
          <label for="rosterSubject">المادة</label>
          <select id="rosterSubject">
            <option value="">اختاري المادة</option>
          </select>
        </div>
 
        <div class="field">
          <label for="rosterGrade">الصف</label>
          <select id="rosterGrade">
            <option value="">اختاري الصف</option>
          </select>
        </div>
 
        <div class="field">
          <label for="rosterClass">الشعبة</label>
          <select id="rosterClass">
            <option value="">اختاري الشعبة</option>
          </select>
        </div>
      </div>
 
      <div class="toolbar roster-list-actions no-print">
        <button
          id="loadRoster"
          class="btn btn-small"
          type="button"
        >
          عرض القائمة
        </button>
 
        <button
          id="printRoster"
          class="btn btn-secondary btn-small"
          type="button"
        >
          طباعة
        </button>

        <button
          id="saveRosterPdf"
          class="btn btn-secondary btn-small"
          type="button"
        >
          حفظ PDF
        </button>
 
        <button
          id="exportRoster"
          class="btn btn-secondary btn-small"
          type="button"
        >
          تصدير Excel
        </button>
      </div>
 
      <div id="rosterTable" class="table-wrap">
        <div class="empty-state">
          اختاري المادة والصف والشعبة لعرض الطلاب.
        </div>
      </div>
    `
  );

  await bindRosterSelectors("roster", {
    requireExistingOption: true
  });

  document
    .querySelector("#loadRoster")
    .addEventListener("click", loadApprovedRoster);

  document
    .querySelector("#printRoster")
    .addEventListener("click", (event) => printPortalPage(event.currentTarget));

  document
    .querySelector("#saveRosterPdf")
    .addEventListener("click", (event) => printPortalPage(event.currentTarget));

  document
    .querySelector("#exportRoster")
    .addEventListener("click", exportApprovedRoster);
}

async function renderStudentManagement() {
  if (!has("manage_students")) throw new Error("لا تملكين صلاحية إدارة الطلاب.");
  page("إدارة الطلاب", "اختاري الشعبة لعرض جميع الطلاب وتعديل بياناتهم أو حذفهم.", `
    <div class="filters">
      <div class="field"><label for="manageStudentClass">الشعبة</label><select id="manageStudentClass"><option value="">اختاري الشعبة</option></select></div>
    </div>
    <div id="managedStudentsTable" class="table-wrap"><div class="empty-state">اختاري الشعبة لعرض الطلاب.</div></div>
  `);
  const classes = await loadClasses();
  fillSelect(document.querySelector("#manageStudentClass"), classes, (item) => item.id, classLabel, "اختاري الشعبة");
  document.querySelector("#manageStudentClass").addEventListener("change", loadManagedStudents);
}

async function loadManagedStudents() {
  const classId = value("manageStudentClass");
  const wrap = document.querySelector("#managedStudentsTable");
  if (!classId) {
    wrap.innerHTML = '<div class="empty-state">اختاري الشعبة لعرض الطلاب.</div>';
    return;
  }
  try {
    const rows = (await api.get(`/students?classId=${encodeURIComponent(classId)}&limit=200`)).data;
    wrap.replaceChildren();
    if (!rows.length) {
      wrap.innerHTML = '<div class="empty-state">لا يوجد طلاب في هذه الشعبة.</div>';
      return;
    }
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>م</th><th>اسم الطالب الرباعي</th><th>الجنس</th><th>الإجراءات</th></tr></thead>";
    const body = document.createElement("tbody");
    rows.forEach((student, index) => {
      const row = document.createElement("tr");
      row.append(createCell(student.serialNumber ?? index + 1), createCell(student.fullName), createCell(labels.gender[student.gender] ?? student.gender));
      const actions = document.createElement("td");
      actions.className = "roster-actions";
      actions.append(actionButton("تعديل", "btn-secondary", () => {
        renderManagedStudentEdit(student);
      }), document.createTextNode(" "), actionButton("حذف", "btn-danger", () => deleteManagedStudent(student)));
      row.append(actions);
      body.append(row);
    });
    table.append(table.querySelector("thead"), body);
    wrap.append(table);
  } catch (error) {
    showError(error);
  }
}

async function deleteManagedStudent(student) {
  if (!await confirmAction(`حذف الطالب «${student.fullName}»؟`, "تأكيد الحذف", "حذف")) return;
  try {
    const result = await api.delete(`/students/${encodeURIComponent(student.id)}`);
    setNotice(document.querySelector("#pageNotice"), "success", result.message);
    await loadManagedStudents();
  } catch (error) {
    showError(error);
  }
}

async function renderManagedStudentEdit(student) {
  page("تعديل بيانات الطالب", "تعديل البيانات الأساسية للطالب داخل شعبته الحالية.", `
    <form id="managedStudentEditForm" class="form-grid student-entry-form" novalidate>
      <div class="field"><label for="managedStudentName">اسم الطالب الرباعي</label><input id="managedStudentName" required minlength="4" maxlength="120" value="${student.fullName.replaceAll('"', "&quot;")}"></div>
      <div class="form-actions span-2">
        <button class="btn btn-small" type="submit">حفظ</button>
        <button id="cancelManagedStudentEdit" class="btn btn-secondary btn-small" type="button">إلغاء</button>
      </div>
    </form>
  `);
  document.querySelector("#cancelManagedStudentEdit").addEventListener("click", renderStudentManagement);
  document.querySelector("#managedStudentEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const button = event.currentTarget.querySelector("button[type=submit]");
    const academicClass = (await loadClasses()).find((item) => item.id === student.classId);
    if (!academicClass) return setNotice(document.querySelector("#pageNotice"), "error", "لا يمكن العثور على شعبة الطالب.");
    await submitSafely(button, async () => {
      try {
        const result = await api.put(`/students/${encodeURIComponent(student.id)}`, {
          fullName: value("managedStudentName"),
          stage: academicClass.stage,
          grade: academicClass.grade,
          classId: academicClass.id,
          gender: academicClass.gender,
          active: true
        });
        setNotice(document.querySelector("#pageNotice"), "success", result.message);
        await renderStudentManagement();
      } catch (error) {
        showError(error);
      }
    });
  });
}
async function rosterContext() {
  const classes = await loadClasses();
  if (!state.rosterOptions) state.rosterOptions = (await api.get("/student-rosters/options")).data;
  const allowedClassIds = new Set(state.rosterOptions.map((item) => item.classId));
  const visibleClasses = has("manage_students") || has("view_all_students")
    ? classes
    : classes.filter((item) => allowedClassIds.has(item.id));
  return { classes: visibleClasses, options: state.rosterOptions };
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "ar"));
}

async function bindRosterSelectors(prefix, { requireExistingOption = false } = {}) {
  const { classes, options } = await rosterContext();
  const subject = document.querySelector(`#${prefix}Subject`);
  const grade = document.querySelector(`#${prefix}Grade`);
  const classSelect = document.querySelector(`#${prefix}Class`);
  const normalizeSubject = (item) => String(item ?? "").trim().toLocaleLowerCase("ar");
  const subjects = uniqueValues(options.map((item) => item.subject));
  fillSelect(subject, subjects, (x) => x, (x) => x, "اختاري المادة");
  grade.replaceChildren(new Option("اختاري الصف", ""));
  classSelect.replaceChildren(new Option("اختاري الشعبة", ""));

  function assignmentsForSelectedSubject() {
    if (!subject.value) return [];
    const selectedSubject = normalizeSubject(subject.value);
    return options.filter((item) => normalizeSubject(item.subject) === selectedSubject);
  }

  function classesForSelectedSubject() {
    const classIds = new Set(assignmentsForSelectedSubject().map((item) => item.classId));
    return classes.filter((item) => classIds.has(item.id));
  }

  function refreshGrades() {
    const matchingClasses = classesForSelectedSubject();
    const grades = uniqueValues(matchingClasses.map((item) => item.grade));
    fillSelect(grade, grades, (x) => x, (x) => labels.grade[x] ?? x, "اختاري الصف");
    refreshClasses();
  }

  function refreshClasses() {
    if (!subject.value || !grade.value) {
      classSelect.replaceChildren(new Option("اختاري الشعبة", ""));
      return;
    }
    const matching = classesForSelectedSubject()
      .filter((item) => item.grade === grade.value);
    fillSelect(classSelect, matching, (x) => x.id, classLabel, "اختاري الشعبة");
  }

  subject.addEventListener("change", refreshGrades);
  grade.addEventListener("change", refreshClasses);
  return { classes, options };
}

function selectedRosterScope(prefix) {
  const classId = value(`${prefix}Class`);
  const subject = value(`${prefix}Subject`);
  if (!classId || !subject) {
    setNotice(document.querySelector("#pageNotice"), "error", "اختاري المادة والصف والشعبة أولًا.");
    return null;
  }
  return { classId, subject };
}

async function loadApprovedRoster() {
  const scope = selectedRosterScope("roster");
  if (!scope) return;
  try {
    const query = new URLSearchParams({ ...scope, status: "active", limit: "200" });
    state.currentStudents = (await api.get(`/student-rosters?${query}`)).data;
    drawApprovedRoster(state.currentStudents);
  } catch (error) { showError(error); }
}

function drawApprovedRoster(rows) {
  const wrap = document.querySelector("#rosterTable");
  wrap.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "لا يوجد طلاب معتمدون في هذه المادة والشعبة.";
    wrap.append(empty);
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  head.innerHTML = "<tr><th>م</th><th>اسم الطالب</th><th>الصف والشعبة</th><th>الجنس</th></tr>";
  const body = document.createElement("tbody");
  const selectedClass = state.classes.find((item) => item.id === value("rosterClass"));
  const sortedRows = [...rows].sort((a, b) =>
    String(a.fullName).localeCompare(String(b.fullName), "ar", { sensitivity: "base" })
  );
  sortedRows.forEach((student, index) => {
    const row = document.createElement("tr");
    row.append(
      createCell(index + 1),
      createCell(student.fullName),
      createCell(selectedClass ? classLabel(selectedClass) : labels.grade[student.grade] ?? student.grade),
      createCell(labels.gender[student.gender] ?? student.gender)
    );
    body.append(row);
  });
  table.append(head, body);
  wrap.append(table);
}

async function exportApprovedRoster() {
  const scope = selectedRosterScope("roster");
  if (!scope) return;
  try {
    const query = new URLSearchParams(scope);
    await downloadFile(`/student-rosters/export?${query}`, `قائمة-الطلاب-${scope.subject}.xlsx`);
  } catch (error) { showError(error); }
}

async function renderStudentAdd() {
  if (!has("manage_students")) throw new Error("لا تملكين صلاحية إدارة قوائم الطلاب.");
  let editing = state.rosterEdit;
  page(editing ? "تعديل طالب" : "إضافة طالب", "يُحفظ الطالب في المسودات ولا يظهر للمعلمة قبل الاعتماد.", `
    <form id="rosterStudentForm" class="form-grid student-entry-form" novalidate>
      <div class="field"><label for="addFullName">اسم الطالب الرباعي</label><input id="addFullName" required minlength="4" maxlength="120"></div>
      <div class="field"><label for="addGrade">الصف</label><select id="addGrade" required><option value="">اختاري الصف</option></select></div>
      <div class="field"><label for="addClass">الشعبة</label><select id="addClass" required><option value="">اختاري الشعبة</option></select></div>
      <div class="field"><label for="addGender">الجنس</label><select id="addGender" required><option value="">اختاري الجنس</option></select></div>
      <div class="field"><label for="addSubject">المادة</label><select id="addSubject" required><option value="">اختاري المادة</option></select></div>
      <div class="form-actions span-2">
        <button id="saveRosterStudent" class="btn btn-small" type="submit">حفظ</button>
        ${editing ? '<button id="cancelRosterEdit" class="btn btn-secondary btn-small" type="button">إلغاء التعديل</button>' : ""}
      </div>
    </form>
    <div class="subsection">
      <h2>الطلاب المضافون</h2>
      <div id="addRosterTable" class="table-wrap">
        <div class="empty-state">اختاري الصف والشعبة والمادة لعرض الطلاب المضافين.</div>
      </div>
    </div>`);
  const { classes, options } = await rosterContext();
  const grade = document.querySelector("#addGrade");
  const classSelect = document.querySelector("#addClass");
  const genderSelect = document.querySelector("#addGender");
  const subjectSelect = document.querySelector("#addSubject");
  fillSelect(grade, uniqueValues(classes.map((item) => item.grade)), (x) => x, (x) => labels.grade[x] ?? x, "اختاري الصف");

  function selectedClass() {
    return classes.find((item) => item.grade === grade.value && item.section === classSelect.value && item.gender === genderSelect.value);
  }

  function refreshSubjects() {
    const selected = selectedClass();
    if (!selected) {
      subjectSelect.replaceChildren(new Option("اختاري المادة", ""));
      return;
    }
    const subjects = uniqueValues(
      options
        .filter((item) => item.classId === selected.id)
        .map((item) => item.subject)
    );
    fillSelect(subjectSelect, subjects, (x) => x, (x) => x, "اختاري المادة");
  }

  function refreshGenders() {
    const genders = uniqueValues(classes
      .filter((item) => item.grade === grade.value && item.section === classSelect.value)
      .map((item) => item.gender));
    fillSelect(genderSelect, genders, (x) => x, (x) => labels.gender[x] ?? x, "اختاري الجنس");
    refreshSubjects();
  }

  function refreshClasses() {
    const sections = uniqueValues(classes
      .filter((item) => item.grade === grade.value)
      .map((item) => item.section));
    fillSelect(
      classSelect,
      sections,
      (x) => x,
      (x) => x,
      "اختاري الشعبة"
    );
    refreshGenders();
  }

  grade.addEventListener("change", refreshClasses);
  classSelect.addEventListener("change", refreshGenders);
  genderSelect.addEventListener("change", refreshSubjects);
  subjectSelect.addEventListener("change", () => {
    loadInlineRosterEntries(selectedClass()?.id, subjectSelect.value, "#addRosterTable");
  });

  if (editing) {
    const selectedClass = classes.find((item) => item.id === editing.classId);
    grade.value = selectedClass?.grade ?? editing.grade;
    refreshClasses();
    classSelect.value = selectedClass?.section ?? "";
    refreshGenders();
    genderSelect.value = editing.gender;
    refreshSubjects();
    subjectSelect.value = editing.subject;
    document.querySelector("#addFullName").value = editing.fullName;
    document.querySelector("#cancelRosterEdit").addEventListener("click", () => {
      state.rosterEdit = null;
      renderStudentAdd();
    });
    await loadInlineRosterEntries(selectedClass?.id, subjectSelect.value, "#addRosterTable");
  }

  document.querySelector("#rosterStudentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const button = document.querySelector("#saveRosterStudent");
    const targetClass = selectedClass();
    if (!targetClass) return setNotice(document.querySelector("#pageNotice"), "error", "اختاري الصف والشعبة والجنس بشكل صحيح.");
    const data = {
      fullName: value("addFullName"),
      classId: targetClass.id,
      subject: value("addSubject"),
      gender: value("addGender")
    };
    await submitSafely(button, async () => {
      try {
        const result = editing
          ? await api.put(`/student-rosters/${editing.enrollmentId}`, data)
          : await api.post("/student-rosters", data);
        editing = null;
        state.rosterEdit = null;
        state.rosterOptions = null;
        setNotice(document.querySelector("#pageNotice"), "success", result.message);
        document.querySelector("#addFullName").value = "";
        document.querySelector("#addGender").value = "";
        document.querySelector("#cancelRosterEdit")?.remove();
        await loadInlineRosterEntries(data.classId, data.subject, "#addRosterTable");
      } catch (error) { showError(error); }
    });
  });
}

async function renderStudentUpload() {
  if (!has("manage_students")) throw new Error("لا تملكين صلاحية رفع قوائم الطلاب.");
  state.rosterImport = null;
  page("رفع ملف Excel", "عايني الصفوف المقبولة والمرفوضة قبل الحفظ في المسودات.", `
    <form id="rosterUploadForm" class="form-grid roster-upload-form" novalidate>
      <div class="field"><label for="uploadGrade">الصف</label><select id="uploadGrade" required><option value="">اختاري الصف</option></select></div>
      <div class="field"><label for="uploadClass">الشعبة</label><select id="uploadClass" required><option value="">اختاري الشعبة</option></select></div>
      <div class="field"><label for="uploadSubject">المادة</label><input id="uploadSubject" list="uploadSubjects" required maxlength="80" autocomplete="off"><datalist id="uploadSubjects"></datalist></div>
      <div class="field"><label for="rosterExcelFile">اختيار ملف Excel</label><input id="rosterExcelFile" type="file" accept=".xlsx" required></div>
      <div class="form-actions span-2">
        <button id="downloadStudentTemplate" class="btn btn-secondary btn-small" type="button">تحميل قالب Excel</button>
        <button id="previewRosterFile" class="btn btn-secondary btn-small" type="submit">معاينة الملف</button>
        <button id="saveRosterFile" class="btn btn-small hidden" type="button">حفظ</button>
      </div>
    </form>
    <div id="rosterImportPreview" class="subsection hidden"><h2>نتيجة المعاينة</h2><div id="rosterImportSummary"></div><div id="rosterImportAccepted" class="table-wrap"></div><div id="rosterImportRejected" class="table-wrap"></div></div>
    <div class="subsection">
      <h2>الطلاب المحفوظون</h2>
      <div id="uploadRosterTable" class="table-wrap">
        <div class="empty-state">اختاري الصف والشعبة والمادة لعرض الطلاب المحفوظين.</div>
      </div>
    </div>`);
  const { classes, options } = await rosterContext();
  const grade = document.querySelector("#uploadGrade");
  const classSelect = document.querySelector("#uploadClass");
  fillSelect(grade, uniqueValues(classes.map((item) => item.grade)), (x) => x, (x) => labels.grade[x] ?? x, "اختاري الصف");
  grade.addEventListener("change", () => {
    fillSelect(classSelect, classes.filter((item) => item.grade === grade.value), (x) => x.id, classLabel, "اختاري الشعبة");
  });
  classSelect.addEventListener("change", () => {
    loadInlineRosterEntries(classSelect.value, value("uploadSubject"), "#uploadRosterTable");
  });
  uniqueValues(options.map((item) => item.subject)).forEach((item) => document.querySelector("#uploadSubjects").append(new Option(item)));
  document.querySelector("#uploadSubject").addEventListener("change", () => {
    loadInlineRosterEntries(classSelect.value, value("uploadSubject"), "#uploadRosterTable");
  });
  document.querySelector("#downloadStudentTemplate").addEventListener("click", () => {
    const link = document.createElement("a");
    link.href = "/templates/students-school-template.xlsx";
    link.download = "students-school-template.xlsx";
    link.target = "_blank";
    document.body.append(link);
    link.click();
    link.remove();
  });
  document.querySelector("#rosterUploadForm").addEventListener("submit", previewRosterFile);
  document.querySelector("#saveRosterFile").addEventListener("click", saveRosterFile);
}

function rosterUploadBody() {
  const file = document.querySelector("#rosterExcelFile").files[0];
  const body = new FormData();
  body.append("classId", value("uploadClass"));
  body.append("subject", value("uploadSubject"));
  body.append("file", file);
  return body;
}

async function previewRosterFile(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const button = document.querySelector("#previewRosterFile");
  await submitSafely(button, async () => {
    try {
      const result = await apiFetch("/student-rosters/import/preview", { method: "POST", body: rosterUploadBody() });
      state.rosterImport = result.data;
      document.querySelector("#rosterImportPreview").classList.remove("hidden");
      document.querySelector("#saveRosterFile").classList.toggle("hidden", !result.data.accepted.length);
      document.querySelector("#rosterImportSummary").textContent = `مقبول: ${result.data.accepted.length} — مرفوض: ${result.data.rejected.length}`;
      renderSimpleTable("#rosterImportAccepted", ["الصف", "اسم الطالب", "الجنس"], result.data.accepted, (x) => [x.row, x.fullName, labels.gender[x.gender] ?? x.gender]);
      renderSimpleTable("#rosterImportRejected", ["الصف", "اسم الطالب", "سبب الرفض"], result.data.rejected, (x) => [x.row, x.fullName, x.reason]);
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
    } catch (error) { showError(error); }
  });
}

async function saveRosterFile() {
  if (!state.rosterImport?.accepted?.length) return;
  const button = document.querySelector("#saveRosterFile");
  const classId = value("uploadClass");
  const subject = value("uploadSubject");
  await submitSafely(button, async () => {
    try {
      const result = await apiFetch("/student-rosters/import/commit", { method: "POST", body: rosterUploadBody() });
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      state.rosterImport = null;
      state.rosterOptions = null;
      button.classList.add("hidden");
      await loadInlineRosterEntries(classId, subject, "#uploadRosterTable");
    } catch (error) { showError(error); }
  });
}

async function loadInlineRosterEntries(classId, subject, selector) {
  const wrap = document.querySelector(selector);
  if (!wrap) return;
  if (!classId || !subject) {
    wrap.innerHTML = '<div class="empty-state">اختاري الصف والشعبة والمادة لعرض الطلاب.</div>';
    return;
  }
  try {
    const query = new URLSearchParams({ classId, subject, limit: "200" });
    const rows = (await api.get(`/student-rosters?${query}`)).data;
    const reload = () => loadInlineRosterEntries(classId, subject, selector);
    drawRosterReview(rows, {
      selector,
      classId,
      subject,
      reload,
      emptyMessage: "لا يوجد طلاب مضافون لهذه المادة والشعبة."
    });
  } catch (error) { showError(error); }
}

async function renderStudentReview() {
  if (!has("manage_students")) throw new Error("لا تملكين صلاحية اعتماد قوائم الطلاب.");
  page("المسودات والاعتماد", "راجعي الطلاب قبل إظهارهم للمعلمات، أو أجّلي القيد أو احذفيه من المادة والشعبة.", `
    <div class="filters">
      <div class="field"><label for="reviewSubject">المادة</label><select id="reviewSubject"><option value="">اختاري المادة</option></select></div>
      <div class="field"><label for="reviewGrade">الصف</label><select id="reviewGrade"><option value="">اختاري الصف</option></select></div>
      <div class="field"><label for="reviewClass">الشعبة</label><select id="reviewClass"><option value="">اختاري الشعبة</option></select></div>
      <div class="field"><label for="reviewStatus">الحالة</label><select id="reviewStatus"><option value="draft">مسودة</option><option value="deferred">مؤجل</option><option value="active">معتمد</option></select></div>
    </div>
    <div class="toolbar">
      <button id="loadRosterReview" class="btn btn-small" type="button">عرض القائمة</button>
    </div>
    <div id="rosterReviewTable" class="table-wrap"><div class="empty-state">اختاري المادة والصف والشعبة لعرض الطلاب.</div></div>`);
  await bindRosterSelectors("review", { requireExistingOption: true });
  document.querySelector("#loadRosterReview").addEventListener("click", loadRosterReview);
}

async function loadRosterReview() {
  const scope = selectedRosterScope("review");
  if (!scope) return;
  try {
    const query = new URLSearchParams({ ...scope, status: value("reviewStatus"), limit: "200" });
    const rows = (await api.get(`/student-rosters?${query}`)).data;
    drawRosterReview(rows, {
      classId: scope.classId,
      subject: scope.subject,
      reload: loadRosterReview
    });
  } catch (error) { showError(error); }
}

function drawRosterReview(rows, options = {}) {
  const selector = options.selector ?? "#rosterReviewTable";
  const classId = options.classId ?? value("reviewClass");
  const subject = options.subject ?? value("reviewSubject");
  const reload = options.reload ?? loadRosterReview;
  const wrap = document.querySelector(selector);
  if (!wrap) return;
  wrap.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = options.emptyMessage ?? "لا توجد سجلات بهذه الحالة.";
    wrap.append(empty);
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  head.innerHTML = "<tr><th>م</th><th>اسم الطالب</th><th>الجنس</th><th>الحالة</th><th>الإجراءات</th></tr>";
  const body = document.createElement("tbody");
  const sortedRows = [...rows].sort((a, b) =>
    String(a.fullName).localeCompare(String(b.fullName), "ar", { sensitivity: "base" })
  );
  sortedRows.forEach((student, index) => {
    const row = document.createElement("tr");
    row.append(
      createCell(index + 1),
      createCell(student.fullName),
      createCell(labels.gender[student.gender] ?? student.gender),
      createCell({ draft: "مسودة", active: "معتمد", deferred: "مؤجل" }[student.status] ?? student.status)
    );
    const actions = document.createElement("td");
    actions.className = "no-print roster-actions";
    if (student.status === "active") {
      actions.textContent = "—";
      row.append(actions);
      body.append(row);
      return;
    }
    const edit = actionButton("تعديل", "btn-secondary", () => {
      state.rosterEdit = { ...student, classId, subject };
      window.location.hash = "student-add";
    });
    const approve = actionButton("اعتماد", "", () => updateRosterStatus(student.enrollmentId, "active", reload));
    const defer = actionButton("تأجيل", "btn-secondary", () => updateRosterStatus(student.enrollmentId, "deferred", reload));
    const remove = actionButton("حذف", "btn-danger", () => deleteRosterEnrollment(student, reload));
    actions.append(edit, document.createTextNode(" "), approve, document.createTextNode(" "), defer, document.createTextNode(" "), remove);
    row.append(actions);
    body.append(row);
  });
  table.append(head, body);
  wrap.append(table);
}

function actionButton(title, style, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `btn btn-small ${style}`.trim();
  button.textContent = title;
  button.addEventListener("click", handler);
  return button;
}

async function updateRosterStatus(id, status, reload = loadRosterReview) {
  try {
    const result = await api.patch(`/student-rosters/${id}/status`, { status });
    setNotice(document.querySelector("#pageNotice"), "success", result.message);
    await reload();
  } catch (error) { showError(error); }
}

async function deleteRosterEnrollment(student, reload = loadRosterReview) {
  if (!await confirmAction(`حذف ${student.fullName} من هذه المادة والشعبة فقط؟ لن يُحذف ملفه الأساسي.`, "تأكيد الحذف", "حذف")) return;
  try {
    const result = await api.delete(`/student-rosters/${student.enrollmentId}`);
    setNotice(document.querySelector("#pageNotice"), "success", result.message);
    await reload();
  } catch (error) { showError(error); }
}

async function renderClasses() {
  if (!has("manage_students")) throw new Error("لا تملكين صلاحية إدارة الفصول.");
  state.classEdit = null;
  page("إدارة الفصول", "تعريف المراحل والصفوف والشعب التي تُستخدم في القوائم والغياب والجداول.", `
    <form id="classForm" class="form-grid class-management-form">
      <div class="field"><label for="classStage">المرحلة</label><select id="classStage" required><option value="">اختاري المرحلة</option><option value="kindergarten">رياض الأطفال</option><option value="primary">الابتدائي</option></select></div>
      <div class="field"><label for="classGrade">الصف</label><select id="classGrade" required><option value="">اختاري الصف</option></select></div>
      <div class="field"><label for="classGender">الجنس</label><select id="classGender" required><option value="">اختاري الجنس</option></select></div>
      <div class="field"><label for="classSection">الشعبة</label><input id="classSection" required maxlength="20" placeholder="مثال: أ"></div>
      <div class="form-actions span-2">
        <button id="saveClass" class="btn" type="submit">حفظ الفصل</button>
        <button id="cancelClassEdit" class="btn btn-secondary hidden" type="button">إلغاء التعديل</button>
      </div>
    </form>
    <div class="subsection"><h2>الفصول النشطة</h2><div id="classesTable" class="table-wrap"></div></div>`);

  const form = document.querySelector("#classForm");
  const stage = document.querySelector("#classStage");
  const grade = document.querySelector("#classGrade");
  const gender = document.querySelector("#classGender");

  const syncStageFields = () => {
    fillSelect(grade, gradeOptions(stage.value), (x) => x[0], (x) => x[1], "اختاري الصف");
    gender.replaceChildren();
    const initial = document.createElement("option");
    initial.value = "";
    initial.textContent = "اختاري الجنس";
    gender.append(initial);

    if (stage.value === "kindergarten") {
      const option = document.createElement("option");
      option.value = "mixed";
      option.textContent = "مختلط";
      gender.append(option);
      gender.value = "mixed";
    }

    if (stage.value === "primary") {
      const male = document.createElement("option");
      male.value = "male";
      male.textContent = "بنين";
      const female = document.createElement("option");
      female.value = "female";
      female.textContent = "بنات";
      gender.append(male, female);
      if (!gender.value) gender.value = "male";
    }
  };

  const resetEditor = () => {
    state.classEdit = null;
    form.reset();
    syncStageFields();
    document.querySelector("#saveClass").textContent = "حفظ الفصل";
    document.querySelector("#cancelClassEdit").classList.add("hidden");
  };

  stage.addEventListener("change", syncStageFields);
  document.querySelector("#cancelClassEdit").addEventListener("click", resetEditor);
  syncStageFields();
  drawClasses(await loadClasses());

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;

    const stageValue = value("classStage");
    const gradeValue = value("classGrade");
    const sectionValue = value("classSection");
    const genderValue = value("classGender");
    const autoName = `${stageValue === "kindergarten" ? "رياض الأطفال" : "الابتدائي"} - ${gradeValue || "-"} - ${sectionValue || "غير محدد"} - ${genderValue === "mixed" ? "مختلط" : genderValue === "male" ? "بنين" : genderValue === "female" ? "بنات" : "-"}`;

    const payload = {
      name: autoName,
      stage: stageValue,
      grade: gradeValue,
      section: sectionValue,
      gender: genderValue,
      active: true
    };

    const button = document.querySelector("#saveClass");
    await submitSafely(button, async () => {
      try {
        const result = state.classEdit
          ? await api.put(`/academic-classes/${encodeURIComponent(state.classEdit.id)}`, payload)
          : await api.post("/academic-classes", payload);
        setNotice(document.querySelector("#pageNotice"), "success", result.message);
        resetEditor();
        state.classes = null;
        drawClasses(await loadClasses());
      } catch (error) { showError(error); }
    });
  });
}

function drawClasses(rows) {
  const wrap = document.querySelector("#classesTable");
  wrap.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "لا توجد فصول نشطة.";
    wrap.append(empty);
    return;
  }
  const table = document.createElement("table");
  const head = document.createElement("thead");
  head.innerHTML = "<tr><th>اسم الفصل</th><th>المرحلة</th><th>الصف</th><th>الشعبة</th><th>الجنس</th><th class=\"no-print\">الإجراءات</th></tr>";
  const body = document.createElement("tbody");
  rows.forEach((academicClass) => {
    const row = document.createElement("tr");
    row.append(
      createCell(academicClass.name),
      createCell(academicClass.stage === "primary" ? "الابتدائي" : "رياض الأطفال"),
      createCell(labels.grade[academicClass.grade] ?? academicClass.grade),
      createCell(academicClass.section),
      createCell(labels.gender[academicClass.gender] ?? academicClass.gender)
    );
    const actions = document.createElement("td");
    actions.className = "no-print";
    const edit = actionButton("تعديل", "btn-secondary", () => startClassEdit(academicClass));
    const remove = actionButton("حذف", "btn-danger", () => removeAcademicClass(academicClass));
    actions.append(edit, document.createTextNode(" "), remove);
    row.append(actions);
    body.append(row);
  });
  table.append(head, body);
  wrap.append(table);
}

function startClassEdit(academicClass) {
  state.classEdit = academicClass;
  const stage = document.querySelector("#classStage");
  stage.value = academicClass.stage;
  stage.dispatchEvent(new Event("change"));
  document.querySelector("#classGrade").value = academicClass.grade;
  document.querySelector("#classGender").value = academicClass.gender;
  document.querySelector("#classSection").value = academicClass.section;
  document.querySelector("#saveClass").textContent = "حفظ التعديل";
  document.querySelector("#cancelClassEdit").classList.remove("hidden");
  document.querySelector("#classForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function removeAcademicClass(academicClass) {
  const confirmed = await confirmAction(
    `حذف الفصل «${academicClass.name}»؟ إذا كان مرتبطًا بطلاب أو جداول قديمة، سيتم إلغاء ربطه ثم حذفه.`,
    "تأكيد الحذف",
    "حذف"
  );
  if (!confirmed) return;
  try {
    const result = await api.delete(`/academic-classes/${encodeURIComponent(academicClass.id)}?force=true`);
    setNotice(document.querySelector("#pageNotice"), "success", result.message);
    if (state.classEdit?.id === academicClass.id) {
      state.classEdit = null;
      document.querySelector("#classForm").reset();
      document.querySelector("#classStage").dispatchEvent(new Event("change"));
      document.querySelector("#saveClass").textContent = "حفظ الفصل";
      document.querySelector("#cancelClassEdit").classList.add("hidden");
    }
    state.classes = null;
    drawClasses(await loadClasses());
  } catch (error) { showError(error); }
}

async function renderAttendancePortal() {
  const links = [];

  if (
    hasRole("teacher", "system_admin") &&
    (has("enter_attendance") || has("attendance_override"))
  ) {
    links.push(
      studentHubLink(
        "attendance-entry",
        "إدخال الغياب",
        "تسجيل غياب طلاب الحصة الأولى"
      )
    );
  }

  if (
    hasRole("principal", "vice_principal", "admin", "system_admin") &&
    (has("view_attendance") || has("manage_attendance"))
  ) {
    links.push(
      studentHubLink(
        "attendance-monitor",
        "متابعة الغياب",
        "متابعة سجلات الغياب المرسلة"
      )
    );
  }

  page("إدخال الغياب", "اختاري الخدمة المطلوبة.", `
    <nav class="student-services-list" aria-label="خدمات الحضور والغياب">
      ${links.join("")}
    </nav>
  `);
}


async function renderAttendance() {
  page("إدخال الغياب", "تتاح العملية لمعلمة الحصة الأولى أو للمستخدمة المخولة.", `
    <aside class="attendance-warning"><strong>تنبيه</strong><span>يرجى التأكد من صحة بيانات الغياب ومراجعتها قبل الإرسال، فالالتزام برفع الغياب في الوقت المحدد مسؤولية.</span></aside>
    <section class="attendance-data-section"><h2>بيانات الغياب</h2>
      <div class="form-grid attendance-entry-grid">
        <div class="field"><label>اسم المعلمة</label><input id="attendanceTeacher" readonly></div>
        <div class="field"><label for="attendanceDate">التاريخ</label><input id="attendanceDate" type="date" required></div>
        <div class="field"><label>الوقت</label><input id="attendanceTime" readonly></div>
        <div class="field"><label>رقم الأسبوع</label><input id="attendanceWeek" readonly></div>
        <div class="field"><label for="attendanceGrade">الصف</label><select id="attendanceGrade" required><option value="">اختاري الصف</option></select></div>
        <div class="field"><label for="attendanceSection">الشعبة</label><select id="attendanceSection" required disabled><option value="">اختاري الشعبة</option></select></div>
        <div class="field"><label for="attendanceGender">الجنس</label><select id="attendanceGender" required disabled><option value="">اختاري الجنس</option></select></div>
        <div class="field"><label for="attendanceSubject">المادة</label><input id="attendanceSubject" readonly placeholder="تظهر تلقائيًا من الحصة الأولى"></div>
      </div>
    </section>
    <label id="allPresentWrap" class="attendance-all-present hidden no-print"><input id="allPresent" type="checkbox"> <span>جميع الطلاب حاضرين</span></label>
    <form id="attendanceForm" class="attendance-table-section"><div id="attendanceStudents" class="attendance-list"><div class="empty-state">اختاري الصف والشعبة والجنس لعرض الطلاب.</div></div><div class="form-actions no-print"><button id="saveAttendance" class="btn btn-small hidden" type="submit">إرسال</button></div></form>`);
  const classes = await loadClasses();
  const grade = document.querySelector("#attendanceGrade"); const section = document.querySelector("#attendanceSection"); const gender = document.querySelector("#attendanceGender");
  fillSelect(grade, uniqueValues(classes.map((item) => item.grade)), (x) => x, (x) => labels.grade[x] ?? x, "اختاري الصف");
  const selectedClass = () => classes.find((item) => item.grade === grade.value && item.section === section.value && item.gender === gender.value);
  const clearStudents = () => { document.querySelector("#attendanceStudents").innerHTML = '<div class="empty-state">اختاري الصف والشعبة والجنس لعرض الطلاب.</div>'; document.querySelector("#allPresentWrap").classList.add("hidden"); document.querySelector("#saveAttendance").classList.add("hidden"); };
  const refreshGender = () => { const values = uniqueValues(classes.filter((item) => item.grade === grade.value && item.section === section.value).map((item) => item.gender)); fillSelect(gender, values, (x) => x, (x) => labels.gender[x] ?? x, "اختاري الجنس"); gender.disabled = !values.length; clearStudents(); };
  const refreshSection = () => { const values = grade.value ? ["أ", "ب", "ج"] : []; fillSelect(section, values, (x) => x, (x) => x, "اختاري الشعبة"); section.disabled = !values.length; refreshGender(); };
  grade.addEventListener("change", refreshSection); section.addEventListener("change", refreshGender); gender.addEventListener("change", () => { if (selectedClass()) loadAttendanceStudents(); else clearStudents(); });
  document.querySelector("#attendanceTeacher").value = state.me.employee.nameAr; document.querySelector("#attendanceDate").value = localDate();
  document.querySelector("#attendanceTime").value = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  const updateWeek = () => { document.querySelector("#attendanceWeek").value = weekNumber(document.querySelector("#attendanceDate").value); };
  updateWeek(); document.querySelector("#attendanceDate").addEventListener("change", updateWeek);
  document.querySelector("#allPresent").addEventListener("change", (event) => {
    const allPresent = event.currentTarget.checked;
    document.querySelectorAll(".attendance-status").forEach((radio) => {
      radio.disabled = allPresent && radio.value !== "present";
      if (allPresent && radio.value === "present") radio.checked = true;
    });
  });
  document.querySelector("#attendanceForm").addEventListener("submit", saveAttendance);
}

async function loadAttendanceStudents() {
  const classes = await loadClasses();
  const selected = classes.find((item) => item.grade === value("attendanceGrade") && item.section === value("attendanceSection") && item.gender === value("attendanceGender"));
  const classId = selected?.id; const date = document.querySelector("#attendanceDate").value;
  if (!classId || !date) return setNotice(document.querySelector("#pageNotice"), "error", "اختاري الفصل والتاريخ.");
  try {
    const eligible = (await api.get(`/attendance/eligibility?classId=${encodeURIComponent(classId)}&date=${date}`)).data;
    document.querySelector("#attendanceSubject").value = eligible.subject ?? "";
    if (!eligible.allowed) return setNotice(document.querySelector("#pageNotice"), "error", eligible.reason);
    const students = (await api.get(`/students?classId=${encodeURIComponent(classId)}&approvedOnly=true&limit=100`)).data;
    const list = document.querySelector("#attendanceStudents"); list.replaceChildren();
    if (students.length) {
      const header = document.createElement("div"); header.className = "attendance-row attendance-row-header";
      ["م", "اسم الطالب الرباعي", "حاضر", "غائب"].forEach((text, index) => { const cell = document.createElement("span"); cell.className = ["attendance-serial", "attendance-name", "attendance-present", "attendance-absent"][index]; cell.textContent = text; header.append(cell); });
      list.append(header);
    }
    students.forEach((student, index) => {
      const row = document.createElement("div"); row.className = "attendance-row"; row.dataset.studentId = student.id;
      const serial = document.createElement("span"); serial.className = "attendance-serial"; serial.textContent = String(index + 1);
      const name = document.createElement("strong"); name.className = "attendance-name"; name.textContent = student.fullName;
      row.append(serial, name);
      const allPresent = document.querySelector("#allPresent")?.checked;
      ["present", "unexcused"].forEach((status) => { const radio = document.createElement("input"); radio.type = "radio"; radio.name = `attendance-${student.id}`; radio.value = status; radio.className = `attendance-status attendance-${status === "present" ? "present" : "absent"}`; radio.required = true; radio.disabled = allPresent && status !== "present"; radio.checked = allPresent && status === "present"; radio.setAttribute("aria-label", `${status === "present" ? "حاضر" : "غائب"} - ${student.fullName}`); row.append(radio); });
      list.append(row);
    });
    document.querySelector("#allPresentWrap").classList.toggle("hidden", !students.length); document.querySelector("#saveAttendance").classList.toggle("hidden", !students.length);
    if (!students.length) list.innerHTML = `<div class="empty-state">لا يوجد طلاب نشطون في الفصل المحدد.</div>`;
  } catch (error) { showError(error); }
}

async function saveAttendance(event) {
  event.preventDefault(); const button = document.querySelector("#saveAttendance");
  const rows = [...document.querySelectorAll(".attendance-row[data-student-id]")];
  if (rows.some((row) => !row.querySelector(".attendance-status:checked"))) return setNotice(document.querySelector("#pageNotice"), "error", "حددي حالة جميع الطلاب قبل الإرسال.");
  const classes = await loadClasses(); const selected = classes.find((item) => item.grade === value("attendanceGrade") && item.section === value("attendanceSection") && item.gender === value("attendanceGender"));
  if (!selected) return setNotice(document.querySelector("#pageNotice"), "error", "اختاري الصف والشعبة والجنس.");
  const data = { classId: selected.id, date: document.querySelector("#attendanceDate").value, weekNumber: Number(document.querySelector("#attendanceWeek").value), entries: rows.map((row) => ({ studentId: row.dataset.studentId, status: row.querySelector(".attendance-status:checked").value })) };
  await submitSafely(button, async () => { try { const result = await api.post("/attendance", data); setNotice(document.querySelector("#pageNotice"), "success", result.message); } catch (error) { showError(error); } });
}

async function renderAttendanceMonitor() {
  page("متابعة الغياب", "عرض السجلات المسجلة والبحث بالتاريخ والفصل.", `<div class="filters"><div class="field"><label for="monitorDate">التاريخ</label><input id="monitorDate" type="date"></div><div class="field"><label for="monitorClass">الفصل</label><select id="monitorClass"><option value="">كل الفصول</option></select></div><div class="field"><label for="monitorStatus">الحالة</label><select id="monitorStatus"><option value="">كل الحالات</option><option value="present">حاضر</option><option value="excused">غائب بعذر</option><option value="unexcused">غائب دون عذر</option><option value="late">متأخر</option></select></div></div><div class="toolbar"><button id="loadAttendanceRecords" class="btn btn-small" type="button">بحث</button><button class="btn btn-secondary btn-small no-print" type="button" id="printAttendance">طباعة</button><button class="btn btn-secondary btn-small no-print" type="button" id="saveAttendancePdf">حفظ PDF</button></div><div id="attendanceRecords" class="table-wrap"><div class="empty-state">اضغطي بحث لعرض السجلات.</div></div>`);
  fillSelect(document.querySelector("#monitorClass"), await loadClasses(), (x) => x.id, classLabel, "كل الفصول");
  document.querySelector("#printAttendance").addEventListener("click", (event) => printPortalPage(event.currentTarget));
  document.querySelector("#saveAttendancePdf").addEventListener("click", (event) => printPortalPage(event.currentTarget));
  document.querySelector("#loadAttendanceRecords").addEventListener("click", async () => {
    try {
      const query = new URLSearchParams();["date", "classId", "status"].forEach((key, index) => { const value = document.querySelector(["#monitorDate", "#monitorClass", "#monitorStatus"][index]).value; if (value) query.set(key, value); });
      const rows = (await api.get(`/attendance?${query}`)).data; renderSimpleTable("#attendanceRecords", ["التاريخ", "الفصل", "المعلمة", "الأسبوع", "عدد الطلاب"], rows, (item) => [item.date, item.className, item.teacherName, item.weekNumber, item.entries?.length ?? 0]);
    } catch (error) { showError(error); }
  });
}

function renderSimpleTable(selector, headings, rows, values) {
  const wrap = document.querySelector(selector); wrap.replaceChildren();
  if (!rows.length) { const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "لا توجد بيانات مطابقة."; wrap.append(empty); return; }
  const table = document.createElement("table"); const head = document.createElement("thead"); const headRow = document.createElement("tr"); headings.forEach((heading) => { const th = document.createElement("th"); th.textContent = heading; headRow.append(th); }); head.append(headRow);
  const body = document.createElement("tbody"); rows.forEach((item) => { const tr = document.createElement("tr"); values(item).forEach((value) => tr.append(createCell(value))); body.append(tr); }); table.append(head, body); wrap.append(table);
}

async function renderSchedule() {
  const links = [];

  if (has("view_schedules") && hasRole("teacher", "it_teacher", "system_admin")) {
    links.push(
      studentHubLink(
        "schedule-my",
        "عرض الجدول الدراسي",
        "عرض جدولك الدراسي وجدول المناوبات الخاص بكِ"
      )
    );
  }

  if (canViewAllSchedulesPage()) {
    links.push(
      studentHubLink(
        "schedule-all",
        "عرض جميع الجداول الدراسية",
        "جدول موحّد لجميع المعلمات مع إمكانية التصفية"
      )
    );
  }

  if (canManageSchedulePage()) {
    links.push(
      studentHubLink(
        "schedule-manage",
        "إدارة الجدول الدراسي",
        "ترتيب حصص المعلمات والمناوبات وإدارتها"
      )
    );
  }

  if (!links.length) {
    throw new Error("لا تملكين صلاحية الوصول إلى الجداول.");
  }

  page(
    "الجدول الدراسي",
    "اختاري الخدمة المطلوبة.",
    `
      <nav
        class="student-services-list"
        aria-label="خدمات الجدول الدراسي"
      >
        ${links.join("")}
      </nav>
    `
  );
}

function canManageSchedulePage() {
  return has("manage_schedules") && hasRole(
    "principal",
    "vice_principal",
    "admin",
    "system_admin",
    "schedule_admin",
    "upper_management"
  );
}

function canViewAllSchedulesPage() {
  return (has("view_all_schedules") || has("manage_schedules")) && hasRole(
    "principal",
    "vice_principal",
    "admin",
    "system_admin",
    "schedule_admin",
    "upper_management"
  );
}

function scheduleTeacherOptions(employees) {
  const teachingRoles = new Set([
    "teacher",
    "it_teacher",
    "system_admin",
    "معلمة",
    "مسؤولة النظام"
  ]);
  const inactiveStatuses = new Set(["inactive", "غير نشط", "موقوف"]);
  return employees.filter((employee) =>
    !inactiveStatuses.has(employee.status)
    && teachingRoles.has(employee.role)
  );
}

function setScheduleSelectOptions(select, values, label, placeholder) {
  select.replaceChildren(new Option(placeholder, ""));
  values.forEach((item) => select.append(new Option(label(item), item)));
  select.disabled = values.length === 0;
}

const stageSubjectMap = {
  primary: ["لغتي", "رياضيات", "علوم", "اللغة الانجليزية", "الدراسات الاسلامية", "التربية البدنية", "المهارات الحياتيه", "التربية الفنية", "القرآن الكريم", "مبرمج صغير"],
  kindergarten: ["لغة عربية", "حساب", "عملي", "تربية إسلامية", "تربية بدنية", "فن", "موسيقى", "حاسوب"]
};

function getStageForClass(classes, grade) {
  const classWithGrade = classes.find((item) => item.grade === grade);
  return classWithGrade?.stage ?? "primary";
}

function setupScheduleClassSelectors(classes) {
  const grade = document.querySelector("#classScheduleGrade");
  const section = document.querySelector("#classScheduleSection");
  const gender = document.querySelector("#classScheduleGender");
  const subject = document.querySelector("#classScheduleSubject");
  const unique = (items) => [...new Set(items)];

  setScheduleSelectOptions(
    grade,
    unique(classes.map((item) => item.grade)),
    (item) => labels.grade[item] ?? item,
    "اختاري الصف"
  );

  const refreshGender = () => {
    const matching = classes.filter((item) => item.grade === grade.value && item.section === section.value);
    const values = unique(matching.map((item) => item.gender));
    setScheduleSelectOptions(gender, values, (item) => labels.gender[item] ?? item, "اختاري الجنس");
    if (values.length === 1) {
      gender.value = values[0];
      gender.disabled = true;
    }
  };

  const refreshSubjects = () => {
    const stage = getStageForClass(classes, grade.value);
    const subjectsForStage = stageSubjectMap[stage] ?? [];
    setScheduleSelectOptions(subject, subjectsForStage, (item) => item, "اختاري المادة");
  };

  grade.addEventListener("change", () => {
    const values = unique(classes.filter((item) => item.grade === grade.value).map((item) => item.section));
    setScheduleSelectOptions(section, values, (item) => item, "اختاري الفصل");
    setScheduleSelectOptions(gender, [], (item) => item, "اختاري الجنس");
    refreshSubjects();
  });
  section.addEventListener("change", refreshGender);
}

function selectedScheduleClass(classes) {
  const grade = value("classScheduleGrade");
  const section = value("classScheduleSection");
  const gender = document.querySelector("#classScheduleGender")?.value ?? "";
  return classes.find((item) => item.grade === grade && item.section === section && item.gender === gender);
}

async function fetchScheduleRows(scope = "mine", teacherUid = "") {
  const query = new URLSearchParams();
  query.set("scope", scope);
  if (teacherUid) query.set("teacherUid", teacherUid);
  const rows = (await api.get(`/schedules?${query.toString()}`)).data;
  return Array.isArray(rows) ? rows : [];
}

async function renderMySchedule() {
  if (!(has("view_schedules") && hasRole("teacher", "it_teacher", "system_admin"))) {
    throw new Error("عرض جدول المعلمة متاح للمعلمة المخولة فقط.");
  }
  await renderScheduleViewer({
    title: "عرض الجدول الدراسي",
    description: "عرض جدولك الدراسي وجدول المناوبات المرتبط بحسابك فقط.",
    scope: "mine",
    showTeacherFilter: false
  });
}

async function renderAllSchedules() {
  if (!canViewAllSchedulesPage()) {
    throw new Error("عرض جداول المعلمات متاح للإدارة المخولة فقط.");
  }
  await renderScheduleViewer({
    title: "عرض جميع الجداول الدراسية",
    description: "جدول موحّد لجميع المعلمات مع اسم المعلمة والمادة والفصل.",
    scope: "all",
    showTeacherFilter: true
  });
}

async function renderScheduleViewer({ title, description, scope, showTeacherFilter }) {
  page(title, description, `
    <div class="schedule-tabs no-print" role="tablist" aria-label="نوع الجدول">
      <button class="schedule-tab active" type="button" data-schedule-view="class" role="tab" aria-selected="true">الحصص الدراسية</button>
      <button class="schedule-tab" type="button" data-schedule-view="break" role="tab" aria-selected="false">المناوبات</button>
    </div>
    ${showTeacherFilter ? `<div class="schedule-view-filter no-print"><div class="field"><label for="scheduleViewTeacher">المعلمة</label><select id="scheduleViewTeacher"><option value="">جميع المعلمات</option></select></div></div>` : ""}
    <div class="table-wrap"><div id="scheduleGrid" class="schedule-grid" data-schedule-scope="${scope}"></div></div>
    <div class="toolbar schedule-view-actions no-print"><button id="printSchedule" class="btn btn-secondary btn-small" type="button">طباعة</button><button id="saveSchedulePdf" class="btn btn-secondary btn-small" type="button">حفظ PDF</button></div>
  `);

  if (showTeacherFilter) {
    const employees = scheduleTeacherOptions(await loadEmployees());
    fillSelect(document.querySelector("#scheduleViewTeacher"), employees, (item) => item.authUid ?? item.id, (item) => item.nameAr, "جميع المعلمات");
    document.querySelector("#scheduleViewTeacher").addEventListener("change", () => loadAndDrawSchedule());
  }
  document.querySelectorAll("[data-schedule-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-schedule-view]").forEach((item) => {
        const selected = item === button;
        item.classList.toggle("active", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      loadAndDrawSchedule();
    });
  });
  document.querySelector("#printSchedule").addEventListener("click", (event) => printPortalPage(event.currentTarget));
  document.querySelector("#saveSchedulePdf").addEventListener("click", (event) => printPortalPage(event.currentTarget));
  await loadAndDrawSchedule();
}

async function loadAndDrawSchedule() {
  try {
    const type = document.querySelector("[data-schedule-view].active")?.dataset.scheduleView ?? "class";
    const teacherUid = document.querySelector("#scheduleViewTeacher")?.value ?? "";
    const scope = document.querySelector("#scheduleGrid")?.dataset.scheduleScope ?? "mine";
    const [rows, classes] = await Promise.all([fetchScheduleRows(scope, teacherUid), loadClasses()]);
    const classNames = new Map(classes.map((item) => [item.id, classLabel(item)]));
    const grid = document.querySelector("#scheduleGrid");
    grid.replaceChildren();
    grid.classList.toggle("schedule-grid-empty", !rows.some((item) => item.blockType === type));

    Object.entries(labels.day).forEach(([key, title]) => {
      const day = document.createElement("section");
      day.className = "schedule-day";
      const heading = document.createElement("h3");
      heading.textContent = title;
      day.append(heading);
      const items = rows.filter((item) => item.day === key && item.blockType === type);
      if (!items.length) {
        const empty = document.createElement("small");
        empty.textContent = "لا توجد سجلات";
        day.append(empty);
      }
      items.forEach((item) => {
        const block = document.createElement("div");
        block.className = "schedule-block";
        block.style.borderRightColor = item.teacherColor ?? "#0f6b55";
        const strong = document.createElement("strong");
        strong.textContent = item.subject ?? item.periodName;
        const detail = document.createElement("span");
        const className = item.classId ? classNames.get(item.classId) : item.location;
        detail.textContent = [
          item.periodNumber ? `الحصة ${item.periodNumber}` : item.periodName,
          `\u2066${item.startTime} - ${item.endTime}\u2069`,
          item.teacherName,
          className
        ].filter(Boolean).join(" • ");
        block.append(strong, detail);
        day.append(block);
      });
      grid.append(day);
    });
  } catch (error) {
    showError(error);
  }
}

async function renderScheduleManage() {
  if (!canManageSchedulePage()) {
    throw new Error("إدارة الجدول متاحة للإدارة المخولة فقط.");
  }

  page("إدارة الجدول الدراسي", "ترتيب حصص المعلمات ومناوباتهن مع منع تعارض الأوقات.", `
    <div class="schedule-tabs no-print" role="tablist" aria-label="صفحة إدارة الجدول">
      <button class="schedule-tab active" type="button" data-schedule-section="entry" role="tab" aria-selected="true">إضافة</button>
      <button class="schedule-tab" type="button" data-schedule-section="records" role="tab" aria-selected="false">الحصص المسجلة</button>
    </div>

    <div id="scheduleEntryPanel">
      <div class="schedule-tabs no-print" role="tablist" aria-label="إدارة نوع الجدول">
        <button class="schedule-tab active" type="button" data-schedule-manage="class" role="tab" aria-selected="true">الحصص الدراسية</button>
        <button class="schedule-tab" type="button" data-schedule-manage="break" role="tab" aria-selected="false">المناوبات</button>
      </div>

      <section id="scheduleClassPanel" class="schedule-manage-panel">
      <h2>إضافة حصة دراسية</h2>
      <form id="scheduleClassForm" class="form-grid schedule-form" novalidate>
        <div class="field"><label for="classScheduleTeacher">المعلمة</label><select id="classScheduleTeacher" required><option value="">اختاري المعلمة</option></select></div>
        <div class="field"><label for="classScheduleDay">اليوم</label><select id="classScheduleDay" required><option value="">اختاري اليوم</option><option value="sunday">الأحد</option><option value="monday">الاثنين</option><option value="tuesday">الثلاثاء</option><option value="wednesday">الأربعاء</option><option value="thursday">الخميس</option></select></div>
        <div class="field"><label for="classScheduleGrade">الصف</label><select id="classScheduleGrade" required><option value="">اختاري الصف</option></select></div>
        <div class="field"><label for="classScheduleSection">الفصل</label><select id="classScheduleSection" required disabled><option value="">اختاري الفصل</option></select></div>
        <div class="field"><label for="classScheduleGender">الجنس</label><select id="classScheduleGender" required disabled><option value="">اختاري الجنس</option></select></div>
        <div class="field"><label for="classPeriodNumber">رقم الحصة</label><input id="classPeriodNumber" type="number" min="1" max="12" required></div>
        <div class="field"><label for="classScheduleSubject">المادة</label><select id="classScheduleSubject" required><option value="">اختاري المادة</option></select></div>
        <div class="field"><label for="classPeriodName">اسم الحصة</label><input id="classPeriodName" maxlength="40" placeholder="مثال: الحصة الأولى" required></div>
        <div class="field"><label for="classStartTime">وقت البداية</label><input id="classStartTime" type="time" min="07:30" max="14:30" required></div>
        <div class="field"><label for="classEndTime">وقت النهاية</label><input id="classEndTime" type="time" min="07:30" max="14:30" required></div>
        <div class="field"><label for="classScheduleLocation">المكان (اختياري)</label><input id="classScheduleLocation" maxlength="80"></div>
<div class="form-actions">
  <button id="saveClassSchedule" class="btn btn-small" type="submit">حفظ</button>
  <button id="cancelClassScheduleEdit" class="btn btn-secondary btn-small hidden" type="button">إلغاء </button>
</div>      </form>
      </section>

      <section id="scheduleBreakPanel" class="schedule-manage-panel hidden">
      <h2>إضافة مناوبة</h2>
      <form id="scheduleBreakForm" class="form-grid schedule-form" novalidate>
        <div class="field"><label for="breakScheduleTeacher">المعلمة</label><select id="breakScheduleTeacher" required><option value="">اختاري المعلمة</option></select></div>
        <div class="field"><label for="breakScheduleDay">اليوم</label><select id="breakScheduleDay" required><option value="">اختاري اليوم</option><option value="sunday">الأحد</option><option value="monday">الاثنين</option><option value="tuesday">الثلاثاء</option><option value="wednesday">الأربعاء</option><option value="thursday">الخميس</option></select></div>
        <div class="field"><label for="breakPeriodName">اسم المناوبة</label><input id="breakPeriodName" maxlength="40" placeholder="مثال: مناوبة الصباح" required></div>
        <div class="field"><label for="breakLocation">المكان</label><input id="breakLocation" maxlength="80" required></div>
        <div class="field"><label for="breakStartTime">وقت البداية</label><input id="breakStartTime" type="time" min="07:30" max="14:30" required></div>
        <div class="field"><label for="breakEndTime">وقت النهاية</label><input id="breakEndTime" type="time" min="07:30" max="14:30" required></div>
<div class="form-actions">
  <button id="saveBreakSchedule" class="btn btn-small" type="submit">حفظ</button>
  <button id="cancelBreakScheduleEdit" class="btn btn-secondary btn-small hidden" type="button">إلغاء </button>
</div>      </form>
      </section>
    </div>

    <section id="scheduleRecordsPanel" class="subsection hidden">
      <h2 id="managedScheduleTitle">الحصص المسجلة</h2>
      <div id="managedScheduleTable" class="table-wrap"><div class="empty-state">جارٍ التحميل...</div></div>
    </section>
  `);

  const [employees, classes] = await Promise.all([loadEmployees(), loadClasses()]);
  const teachers = scheduleTeacherOptions(employees);

  ["#classScheduleTeacher", "#breakScheduleTeacher"].forEach((selector) => {
    fillSelect(document.querySelector(selector), teachers, (item) => item.authUid ?? item.id, (item) => item.nameAr, "اختاري المعلمة");
  });
  setupScheduleClassSelectors(classes);

  document.querySelector("#scheduleClassForm").addEventListener("submit", (event) => saveSchedule(event, "class"));
  document.querySelector("#scheduleBreakForm").addEventListener("submit", (event) => saveSchedule(event, "break"));
  document.querySelector("#cancelClassScheduleEdit").addEventListener("click", () => resetScheduleEdit("class"));
  document.querySelector("#cancelBreakScheduleEdit").addEventListener("click", () => resetScheduleEdit("break"));
  document.querySelectorAll("[data-schedule-section]").forEach((button) => {
    button.addEventListener("click", () => setScheduleManageSection(button.dataset.scheduleSection));
  });
  document.querySelectorAll("[data-schedule-manage]").forEach((button) => {
    button.addEventListener("click", () => setScheduleManageTab(button.dataset.scheduleManage));
  });
  await loadManagedScheduleRows("class");
}

function setScheduleManageSection(section) {
  document.querySelectorAll("[data-schedule-section]").forEach((button) => {
    const selected = button.dataset.scheduleSection === section;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  document.querySelector("#scheduleEntryPanel").classList.toggle("hidden", section !== "entry");
  document.querySelector("#scheduleRecordsPanel").classList.toggle("hidden", section !== "records");
}

async function setScheduleManageTab(type) {
  document.querySelectorAll("[data-schedule-manage]").forEach((button) => {
    const selected = button.dataset.scheduleManage === type;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  });
  document.querySelector("#scheduleClassPanel").classList.toggle("hidden", type !== "class");
  document.querySelector("#scheduleBreakPanel").classList.toggle("hidden", type !== "break");
  document.querySelector("#managedScheduleTitle").textContent = type === "class" ? "الحصص المسجلة" : "المناوبات المسجلة";
  await loadManagedScheduleRows(type);
}


function resetScheduleEdit(blockType) {
  const isClass = blockType === "class";

  const form = document.querySelector(
    isClass ? "#scheduleClassForm" : "#scheduleBreakForm"
  );

  const saveButton = document.querySelector(
    isClass ? "#saveClassSchedule" : "#saveBreakSchedule"
  );

  const cancelButton = document.querySelector(
    isClass ? "#cancelClassScheduleEdit" : "#cancelBreakScheduleEdit"
  );

  form.reset();
  delete form.dataset.editingId;

  saveButton.textContent = "حفظ";
  cancelButton.classList.add("hidden");
}

async function saveSchedule(event, blockType) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const isClass = blockType === "class";
  const teacherSelect = document.querySelector(isClass ? "#classScheduleTeacher" : "#breakScheduleTeacher");
  const employee = state.employees.find((item) => (item.authUid ?? item.id) === teacherSelect.value);
  if (!employee) {
    return setNotice(document.querySelector("#pageNotice"), "error", "اختاري معلمة مرتبطة بملف موظفة صالح.");
  }

  const academicClass = isClass ? selectedScheduleClass(state.classes ?? []) : null;
  if (isClass && !academicClass) {
    return setNotice(document.querySelector("#pageNotice"), "error", "اختاري الصف والفصل والجنس من الفصول النشطة.");
  }

  const data = isClass
    ? {
      blockType,
      day: value("classScheduleDay"),
      teacherUid: employee.authUid ?? employee.id,
      classId: academicClass.id,
      periodNumber: Number(value("classPeriodNumber")),
      periodName: value("classPeriodName"),
      subject: value("classScheduleSubject"),
      location: value("classScheduleLocation") || undefined,
      startTime: value("classStartTime"),
      endTime: value("classEndTime")
    }
    : {
      blockType,
      day: value("breakScheduleDay"),
      teacherUid: employee.authUid ?? employee.id,
      periodName: value("breakPeriodName"),
      location: value("breakLocation"),
      startTime: value("breakStartTime"),
      endTime: value("breakEndTime")
    };

  const button = document.querySelector(isClass ? "#saveClassSchedule" : "#saveBreakSchedule");
  const editingId = form.dataset.editingId;
  await submitSafely(button, async () => {
    try {
      const result = editingId
        ? await api.patch(`/schedules/${encodeURIComponent(editingId)}`, data)
        : await api.post("/schedules", data);
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      resetScheduleEdit(blockType);
      await loadManagedScheduleRows(blockType);
    } catch (error) {
      showError(error);
    }
  });
}


function beginScheduleEdit(item, blockType, classes) {
  const isClass = blockType === "class";
  const form = document.querySelector(
    isClass ? "#scheduleClassForm" : "#scheduleBreakForm"
  );

  form.dataset.editingId = item.id;

  document.querySelector(
    isClass ? "#saveClassSchedule" : "#saveBreakSchedule"
  ).textContent = "حفظ التعديل";

  document.querySelector(
    isClass
      ? "#cancelClassScheduleEdit"
      : "#cancelBreakScheduleEdit"
  ).classList.remove("hidden");

  if (isClass) {
    document.querySelector("#classScheduleTeacher").value = item.teacherUid;
    document.querySelector("#classScheduleDay").value = item.day;
    document.querySelector("#classPeriodNumber").value = item.periodNumber;
    document.querySelector("#classScheduleSubject").value = item.subject ?? "";
    document.querySelector("#classPeriodName").value = item.periodName;
    document.querySelector("#classStartTime").value = item.startTime;
    document.querySelector("#classEndTime").value = item.endTime;
    document.querySelector("#classScheduleLocation").value = item.location ?? "";

    const selectedClass = classes.find(
      (academicClass) => academicClass.id === item.classId
    );

    if (selectedClass) {
      const grade = document.querySelector("#classScheduleGrade");
      const section = document.querySelector("#classScheduleSection");
      const gender = document.querySelector("#classScheduleGender");

      grade.value = selectedClass.grade;
      grade.dispatchEvent(new Event("change"));

      section.value = selectedClass.section;
      section.dispatchEvent(new Event("change"));

      gender.value = selectedClass.gender;
    }
  } else {
    document.querySelector("#breakScheduleTeacher").value = item.teacherUid;
    document.querySelector("#breakScheduleDay").value = item.day;
    document.querySelector("#breakPeriodName").value = item.periodName;
    document.querySelector("#breakLocation").value = item.location ?? "";
    document.querySelector("#breakStartTime").value = item.startTime;
    document.querySelector("#breakEndTime").value = item.endTime;
  }

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function loadManagedScheduleRows(blockType) {
  try {
    const [rows, classes] = await Promise.all([fetchScheduleRows("all"), loadClasses()]);
    const classNames = new Map(classes.map((item) => [item.id, classLabel(item)]));
    const filtered = rows.filter((item) => item.blockType === blockType);
    const wrap = document.querySelector("#managedScheduleTable");
    wrap.replaceChildren();
    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = blockType === "class" ? "لا توجد حصص مسجلة." : "لا توجد مناوبات مسجلة.";
      wrap.append(empty);
      return;
    }

    const table = document.createElement("table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["اليوم", "المعلمة", blockType === "class" ? "المادة" : "المناوبة", "الفصل/المكان", "الوقت", "الإجراء"].forEach((title) => {
      const th = document.createElement("th");
      th.textContent = title;
      headRow.append(th);
    });
    head.append(headRow);
    const body = document.createElement("tbody");
    filtered.forEach((item) => {
      const row = document.createElement("tr");
      [
        labels.day[item.day] ?? item.day,
        item.teacherName,
        item.subject ?? item.periodName,
        item.classId ? classNames.get(item.classId) : item.location,
        `${item.startTime} - ${item.endTime}`
      ].forEach((cellValue) => row.append(createCell(cellValue ?? "—")));
      const actionCell = document.createElement("td");

      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "btn btn-secondary btn-small no-print";
      editButton.textContent = "تعديل";
      editButton.addEventListener("click", () => {
        beginScheduleEdit(item, blockType, classes);
      });

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-danger btn-small no-print";
      removeButton.textContent = "حذف";
      removeButton.addEventListener("click", () => {
        removeScheduleRow(item, blockType);
      });

      actionCell.append(editButton, removeButton);
      row.append(actionCell);
      body.append(row);
    });
    table.append(head, body);
    wrap.append(table);
  } catch (error) {
    showError(error);
  }
}

async function removeScheduleRow(item, blockType) {
  if (!await confirmAction(`حذف ${blockType === "class" ? "الحصة" : "المناوبة"} المحددة؟`, "تأكيد الحذف", "حذف")) return;
  try {
    const result = await api.delete(`/schedules/${encodeURIComponent(item.id)}`);
    setNotice(document.querySelector("#pageNotice"), "success", result.message);
    await loadManagedScheduleRows(blockType);
  } catch (error) {
    showError(error);
  }
}

function canManageTrainingPage() {
  return has("manage_training_requests") && hasRole("system_admin", "principal", "vice_principal", "admin");
}

function renderTrainingCourseHub() {
  const links = [];
  if (has("request_training") || hasRole("system_admin")) {
    links.push(studentHubLink("training-course-request", "تقديم طلب", "طلب حضور دورة أو مؤتمر أو ورشة تدريبية."));
    links.push(studentHubLink("training-course-history", "سجل طلباتي", "متابعة حالة الطلب وسبب الرفض إن وجد."));
  }
  if (has("manage_training_requests") || hasRole("system_admin")) {
    links.push(studentHubLink("training-course-manage", "إدارة الطلبات", "اعتماد الطلب أو رفضه مع ذكر السبب."));
  }
  page("دورة تدريبية", "اختاري الخدمة المطلوبة.", `<nav class="student-services-list" aria-label="خدمات الدورة التدريبية">${links.join("")}</nav>`);
}

async function renderTrainingCourseRequest() {
  await renderRequestPage("training-course");
}

async function renderTrainingCourseHistory() {
  page("سجل طلباتي", "متابعة طلبات الدورات التدريبية وحالاتها.", '<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>');
  await loadRequestRows({ ...requestPages["training-course"], path: "/requests/training-courses?scope=mine&limit=200" }, "training-course-history");
}

async function renderTrainingCourseManage() {
  if (!(has("manage_training_requests") || hasRole("system_admin"))) throw new Error("إدارة طلبات الدورات متاحة للإدارة المخولة فقط.");
  page("إدارة طلبات الدورات التدريبية", "مراجعة طلبات الموظفات واتخاذ القرار.", '<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>');
  await loadRequestRows({ ...requestPages["training-course"], path: "/requests/training-courses?scope=all&limit=200", columns: ["الموظفة", ...requestPages["training-course"].columns], row: (item) => [item.employeeName || "—", ...requestPages["training-course"].row(item)] }, "training-course-manage");
}


function renderTrainingHub() {
  const links = [];
  if (has("request_training")) {
    links.push(studentHubLink("training-add", "رفع شهادة تدريبية", "توثيق دورة أو ورشة حضرتِها بالفعل"));
    links.push(studentHubLink("training-my", "سجل طلباتي", "عرض التدريبات والشهادات التي أضفتِها"));
  }
  if (canManageTrainingPage()) links.push(studentHubLink("training-manage", "شهادات الموظفات", "عرض سجل الدورات والشهادات المرفوعة"));
  page("الشهادات التدريبية", "اختاري الخدمة المطلوبة.", `<nav class="student-services-list" aria-label="خدمات الشهادات التدريبية">${links.join("")}</nav>`);
}

async function renderTrainingAdd() {
  if (!has("request_training")) throw new Error("لا توجد لديك صلاحية لإضافة شهادة تدريبية.");
  page("شهادة تدريبية", "وثقي دورة أو ورشة حضرتِها وأرفقي شهادة الحضور.", `<form id="trainingCertificateForm" class="form-grid training-entry-form" novalidate><div class="field"><label for="courseName">اسم الدورة / الورشة</label><input id="courseName" required minlength="3" maxlength="160"></div><div class="field"><label for="activityType">نوع التدريب</label><select id="activityType" required><option value="">اختاري</option><option value="course">دورة</option><option value="workshop">ورشة</option><option value="conference">مؤتمر</option><option value="seminar">ندوة</option><option value="other">أخرى</option></select></div><div class="field"><label for="provider">الجهة المنظمة</label><input id="provider" required minlength="2" maxlength="160"></div><div class="field"><label for="startDate">تاريخ بداية التدريب</label><input id="startDate" type="date" required></div><div class="field"><label for="endDate">تاريخ نهاية التدريب</label><input id="endDate" type="date" required></div><div class="field"><label for="hours">عدد الساعات التدريبية</label><input id="hours" type="number" min="0.5" max="1000" step="0.5" required></div><div class="field"><label for="attendanceType">مكان التدريب</label><select id="attendanceType" required><option value="">اختاري</option><option value="in_person">حضوري</option><option value="online">عن بُعد</option></select></div><div class="field"><label for="location">موقع التدريب</label><input id="location" required maxlength="300"></div><div class="field"><label for="specialization">مجال التدريب</label><input id="specialization" required maxlength="160"></div><div class="field"><label for="trainingCertificate">رفع الشهادة التدريبية</label><input id="trainingCertificate" type="file" accept=".pdf,.jpg,.jpeg,.png" required><span class="field-hint">PDF أو JPG أو PNG، بحد أقصى 5 ميغابايت.</span></div><div class="field"><label for="trainingAttachments">مرفقات إضافية (اختياري)</label><input id="trainingAttachments" type="file" accept=".pdf,.jpg,.jpeg,.png" multiple><span class="field-hint">يمكن اختيار أكثر من ملف، بحد أقصى 5 ميغابايت لكل ملف.</span></div><div class="field span-2"><label for="courseDescription">وصف مختصر للتدريب</label><textarea id="courseDescription" required minlength="3" maxlength="1000"></textarea></div><div class="form-actions span-2"><button id="saveTrainingCertificate" class="btn btn-small" type="submit">إضافة التدريب</button></div></form><h2>سجل تدريباتي</h2><div id="myTrainingTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>`);
  document.querySelector("#trainingCertificateForm").addEventListener("submit", saveTrainingCertificate);
  document.querySelector("#trainingCertificate")?.closest(".field")?.remove();
  document.querySelector("#trainingAttachments")?.closest(".field")?.remove();
  const certificateField = document.createElement("div");
  certificateField.className = "field span-2";
  certificateField.innerHTML = '<label for="certificateUrl">رابط شهادة الدورة</label><input id="certificateUrl" type="url" placeholder="https://..." required maxlength="2000"><span class="field-hint">يجب أن يبدأ الرابط بـ http:// أو https://.</span>';
  document.querySelector("#trainingCertificateForm #saveTrainingCertificate")?.closest(".form-actions")?.before(certificateField);
  document.querySelector("#courseDescription")?.closest(".field")?.remove();
  document.querySelector("#location")?.closest(".field")?.remove();
  document.querySelector("#trainingAttachments")?.closest(".field")?.remove();
  document.querySelector("#myTrainingTable")?.previousElementSibling?.remove();
  document.querySelector("#myTrainingTable")?.remove();
}

async function saveTrainingCertificate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  if (value("endDate") < value("startDate")) return setNotice(document.querySelector("#pageNotice"), "error", "تاريخ النهاية يجب ألا يسبق تاريخ البداية.");
  const certificateUrl = value("certificateUrl").trim();
  try { const parsedUrl = new URL(certificateUrl); if (!/^https?:$/.test(parsedUrl.protocol)) throw new Error(); } catch { return setNotice(document.querySelector("#pageNotice"), "error", "رابط الشهادة غير صحيح."); }
  const button = document.querySelector("#saveTrainingCertificate");
  await submitSafely(button, async () => {
    try {
      const payload = { courseName: value("courseName"), provider: value("provider"), activityType: value("activityType"), specialization: value("specialization"), startDate: value("startDate"), endDate: value("endDate"), attendanceType: value("attendanceType"), hours: Number(value("hours")), certificateUrl };
      const result = await api.post("/requests/training", payload);
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      form.reset();
    } catch (error) {
      showError(error);
    }
  });
}

async function openTrainingCertificate(path) {
  window.open(path, "_blank", "noopener,noreferrer");
}

function showTrainingDetails(item) {
  const dialog = document.createElement("dialog");
  dialog.className = "training-details-dialog";
  dialog.dir = "rtl";
  dialog.innerHTML = `<div class="training-details-modal"><div class="training-details-header"><h3>تفاصيل التدريب</h3><button type="button" class="training-details-close" aria-label="إغلاق">×</button></div><div class="training-details-grid"><div><span>اسم الموظفة</span><strong>${item.employeeName || "—"}</strong></div><div><span>اسم الدورة / الورشة</span><strong>${item.courseName || "—"}</strong></div><div><span>الجهة المنظمة</span><strong>${item.provider || "—"}</strong></div><div><span>نوع التدريب</span><strong>${item.activityType || "—"}</strong></div><div><span>تاريخ التدريب</span><strong>${item.startDate || "—"} — ${item.endDate || "—"}</strong></div><div><span>عدد الساعات</span><strong>${item.hours || "—"}</strong></div><div><span>طريقة الحضور</span><strong>${item.attendanceType || "—"}</strong></div><div><span>مجال التدريب</span><strong>${item.specialization || "—"}</strong></div></div><div class="training-details-actions"><button type="button" class="btn btn-secondary training-details-close">إغلاق</button></div></div>`;
  document.body.append(dialog);
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  dialog.querySelectorAll(".training-details-close").forEach((button) => button.addEventListener("click", close));
  dialog.addEventListener("cancel", close, { once: true });
  dialog.showModal();
}

function drawTrainingTable(selector, rows, management) {
  const wrap = document.querySelector(selector);
  wrap.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = management ? "لا توجد شهادات مرفوعة." : "لم تضيفي تدريبات حتى الآن.";
    wrap.append(empty);
    return;
  }
  const headings = management
    ? ["الموظفة", "اسم التدريب", "الجهة المنظمة", "التاريخ", "الساعات", "حالة الطلب", "ملاحظة القرار", "الشهادة", "عرض التفاصيل", "الإجراء"]
    : ["اسم التدريب", "الجهة المنظمة", "التاريخ", "عدد الساعات", "حالة التوثيق", "ملاحظة القرار", "عرض الشهادة"];
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  headings.forEach((heading) => {
    const header = document.createElement("th");
    header.textContent = heading;
    headerRow.append(header);
  });
  thead.append(headerRow);
  const tbody = document.createElement("tbody");
  rows.forEach((item) => {
    const row = document.createElement("tr");
    const values = management
      ? [item.employeeName, item.courseName, item.provider, `${item.startDate} — ${item.endDate}`, item.hours, item.status]
      : [item.courseName, item.provider, `${item.startDate} — ${item.endDate}`, item.hours, item.status];
    values.forEach((valueToShow) => row.append(createCell(valueToShow ?? "—")));
    row.append(createCell(item.decisionNote || "—"));
    const certificateCell = document.createElement("td");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary btn-small";
    const certificateUrl = item.certificateUrl || item.attachmentUrl || "";
    button.textContent = /^https?:\/\//i.test(certificateUrl) ? (management ? "عرض الشهادة" : "عرض الشهادة") : "الرابط غير صحيح";
    button.disabled = !/^https?:\/\//i.test(certificateUrl);
    button.addEventListener("click", () => openTrainingCertificate(certificateUrl));
    certificateCell.append(button);
    row.append(certificateCell);
    if (management) {
      const detailsCell = document.createElement("td");
      const detailsButton = document.createElement("button");
      detailsButton.type = "button";
      detailsButton.className = "btn btn-secondary btn-small";
      detailsButton.textContent = "عرض التفاصيل";
      detailsButton.addEventListener("click", () => showTrainingDetails(item));
      detailsCell.append(detailsButton);
      row.append(detailsCell);

      const actionCell = document.createElement("td");
      actionCell.className = "training-actions";
      if (item.status === "قيد المراجعة") {
        const approveButton = document.createElement("button");
        approveButton.type = "button";
        approveButton.className = "btn btn-small";
        approveButton.textContent = "اعتماد التدريب";
        approveButton.addEventListener("click", () => decideTrainingCertificate(item.id, "approved"));
        const rejectButton = document.createElement("button");
        rejectButton.type = "button";
        rejectButton.className = "btn btn-danger btn-small";
        rejectButton.textContent = "رفض التدريب";
        rejectButton.addEventListener("click", () => decideTrainingCertificate(item.id, "rejected"));
        actionCell.append(approveButton, rejectButton);
      } else {
        actionCell.textContent = "—";
      }
      row.append(actionCell);
    }
    tbody.append(row);
  });
  table.append(thead, tbody);
  wrap.append(table);
}

async function renderTrainingMy() {
  if (!has("request_training")) throw new Error("لا توجد لديك صلاحية لعرض سجل التدريبات.");
  page("سجل طلباتي", "التدريبات والشهادات التي أضفتِها.", `<div id="myTrainingTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>`);
  try { drawTrainingTable("#myTrainingTable", (await api.get("/requests/training?scope=mine&limit=200")).data, false); } catch (error) { showError(error); }
}

async function renderTrainingManage() {
  if (!canManageTrainingPage()) throw new Error("إدارة شهادات التدريب متاحة للإدارة المخولة فقط.");
  page("التدريب", "سجل تدريبات الموظفات والشهادات المرفوعة.", `<div id="managedTrainingTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>`);
  await loadManagedTraining();
}

function renderTrainingLegacy() {
  return canManageTrainingPage() ? renderTrainingManage() : renderTrainingAdd();
}

async function loadManagedTraining() {
  try { drawTrainingTable("#managedTrainingTable", (await api.get("/requests/training?scope=all&limit=200")).data, true); } catch (error) { showError(error); }
}

async function decideTrainingCertificate(id, status) {
  const note = await requestTrainingDecisionNote(status);
  if (status === "rejected" && (!note || note.trim().length < 3)) return;
  try { const result = await api.patch(`/requests/training/${id}/decision`, { status, decisionNote: note?.trim() || "تم اعتماد التدريب" }); setNotice(document.querySelector("#pageNotice"), "success", result.message); await loadManagedTraining(); } catch (error) { showError(error); }
}

function requestTrainingDecisionNote(status) {
  const isRejected = status === "rejected";
  const dialog = document.createElement("dialog");
  dialog.className = "training-note-dialog";
  dialog.innerHTML = `
    <div class="material-modal">
      <h4>${isRejected ? "سبب رفض التدريب" : "ملاحظة اعتماد التدريب"}</h4>
      <label for="trainingDecisionNote">${isRejected ? "اكتبي سبب الرفض:" : "اكتبي ملاحظة الاعتماد (اختياري):"}</label>
      <textarea id="trainingDecisionNote" rows="3" ${isRejected ? "required" : ""}></textarea>
      <div class="material-modal-actions">
        <button type="button" class="btn-cancel">إلغاء</button>
        <button type="button" class="${isRejected ? "btn-reject" : "btn-save"}">${isRejected ? "رفض التدريب" : "اعتماد التدريب"}</button>
      </div>
    </div>
  `;
  document.body.appendChild(dialog);

  return new Promise((resolve) => {
    const noteInput = dialog.querySelector("#trainingDecisionNote");
    const closeDialog = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };

    dialog.querySelector(".btn-cancel").addEventListener("click", () => closeDialog(null));
    dialog.querySelector(".material-modal-actions button:last-child").addEventListener("click", () => {
      if (isRejected && noteInput.value.trim().length < 3) {
        noteInput.focus();
        return;
      }
      closeDialog(noteInput.value);
    });
    dialog.addEventListener("cancel", () => closeDialog(null), { once: true });
    dialog.showModal();
    noteInput.focus();
  });
}

const requestPages = {
  leave: { title: "الإجازات", description: "تقديم الإجازة ومتابعة قرارات المديرة والموارد البشرية.", path: "/requests/leave", createPermission: "request_leave", managePermission: "manage_leave_requests", attachment: false, fields: `<div class="field"><label for="leaveType">نوع الإجازة</label><select id="leaveType" required><option value="">اختاري النوع</option><option value="sick">مرضية</option><option value="emergency">اضطرارية</option><option value="maternity">أمومة</option><option value="nursing_hour">ساعة رضاعة</option><option value="marriage">زواج</option><option value="bereavement">وفاة من الدرجة الأولى</option><option value="unpaid">بدون راتب</option></select></div><div class="field"><label for="startDate">تاريخ البداية</label><input id="startDate" type="date" required></div><div class="field"><label for="endDate">تاريخ النهاية</label><input id="endDate" type="date" required></div><div class="field"><label for="leaveDuration">مدة الإجازة</label><input id="leaveDuration" readonly placeholder="تحسب تلقائيًا"></div><div class="field span-2"><label for="requestAttachment">رابط المرفق (اختياري)</label><input id="requestAttachment" type="url" placeholder="https://..."><span class="field-hint">أضيفي رابط المستند حسب نوع الإجازة.</span></div><div class="field"><label for="requestNotes">ملاحظات اختيارية</label><input id="requestNotes" maxlength="500"></div>`, data: () => ({ leaveType: value("leaveType"), startDate: value("startDate"), endDate: value("endDate"), attachmentUrl: value("requestAttachment"), notes: value("requestNotes") }), columns: ["نوع الإجازة", "من", "إلى", "المدة", "الحالة", "قرار المديرة", "سبب رفض المديرة", "قرار الموارد البشرية", "سبب رفض الموارد البشرية"], row: (x) => [labels.leave[x.leaveType] ?? x.leaveType, x.startDate, x.endDate, x.durationDays, x.status, x.managerDecision || "—", x.managerDecision === "رفض" ? x.managerDecisionNote : "—", x.hrDecision || "—", x.hrDecision === "رفض" ? x.hrDecisionNote : "—"] },
  permission: { title: "الاستئذان", description: "إرسال طلب استئذان ومتابعة حالته.", path: "/requests/permission", createPermission: "request_leave", managePermission: "manage_leave_requests", attachment: true, fields: `<div class="field"><label for="requestDate">التاريخ</label><input id="requestDate" type="date" required></div><div class="field"><label for="exitTime">وقت الخروج</label><input id="exitTime" type="time" required></div><div class="field"><label for="returnTime">وقت العودة (اختياري)</label><input id="returnTime" type="time"></div><div class="field"><label for="requestReason">السبب</label><input id="requestReason" required maxlength="500"></div>`, data: () => ({ date: value("requestDate"), exitTime: value("exitTime"), returnTime: value("returnTime"), reason: value("requestReason") }), columns: ["التاريخ", "الخروج", "العودة", "السبب", "الحالة", "ملاحظة القرار"], row: (x) => [x.date, x.exitTime, x.returnTime, x.reason, x.status, x.decisionNote || "—"] },
  "training-course": { title: "دورة تدريبية", description: "تقديم طلب حضور دورة أو مؤتمر أو ورشة تدريبية.", path: "/requests/training-courses", createPermission: "request_training", managePermission: "manage_training_requests", fields: `<div class="field"><label for="courseName">اسم الدورة</label><input id="courseName" required maxlength="160"></div><div class="field"><label for="field">مجال الدورة</label><input id="field" required maxlength="160"></div><div class="field"><label for="startDate">تاريخ البداية</label><input id="startDate" type="date" required></div><div class="field"><label for="endDate">تاريخ الانتهاء</label><input id="endDate" type="date" required></div><div class="field"><label for="departureTime">وقت الخروج</label><input id="departureTime" type="time" required></div><div class="field"><label for="location">مكان الدورة</label><input id="location" required maxlength="300"></div><div class="field span-2"><label for="description">وصف الدورة</label><textarea id="description" required minlength="3" maxlength="1000"></textarea></div>`, data: () => ({ courseName: value("courseName"), field: value("field"), startDate: value("startDate"), endDate: value("endDate"), departureTime: value("departureTime"), location: value("location"), description: value("description") }), columns: ["اسم الدورة", "المجال", "التاريخ", "وقت الخروج", "المكان", "الحالة", "سبب القرار"], row: (x) => [x.courseName, x.field, `${x.startDate} — ${x.endDate}`, x.departureTime, x.location, x.status, x.decisionNote || "—"] },
  "absence-report": {
    title: "تبليغ الغياب", description: "إرسال بلاغ غياب ومتابعة حالته.", path: "/requests/absence-report", createPermission: "request_absence", managePermission: "manage_absence", attachment: true,
    fields: `<div class="field"><label for="absenceType">نوع الغياب</label><select id="absenceType" required><option value="">اختاري النوع</option><option value="sick">غياب مرضي</option><option value="emergency">غياب اضطراري</option><option value="personal">ظرف شخصي</option><option value="other">سبب آخر</option></select></div><div class="field"><label for="absenceDate">تاريخ الغياب</label><input id="absenceDate" type="date" required></div><div class="field span-2"><label for="absenceReason">سبب الغياب</label><textarea id="absenceReason" maxlength="500" minlength="3" required></textarea></div>`,
    data: () => ({ absenceType: value("absenceType"), date: value("absenceDate"), reason: value("absenceReason") }),
    columns: ["نوع الغياب", "التاريخ", "السبب", "حالة الاطلاع", "وقت الإرسال", "وقت الاطلاع"], row: (x) => [({ sick: "غياب مرضي", emergency: "غياب اضطراري", personal: "ظرف شخصي", other: "سبب آخر" }[x.absenceType] ?? x.absenceType), x.date, x.reason, x.managerViewedAt ? "تم الاطلاع" : "لم يتم الاطلاع", formatDateTime(x.submittedAt), formatDateTime(x.managerViewedAt)]
  },
  "suggestions-complaints": {
    title: "الاقتراحات والشكاوي", description: "إرسال اقتراح أو شكوى ومتابعة الرد.", path: "/requests/suggestions-complaints?scope=all&limit=200", createPermission: "request_suggestions", managePermission: "manage_support",
    createPath: "/requests/suggestions-complaints",
    fields: `<div class="field"><label for="suggestionType">النوع</label><select id="suggestionType" required><option value="suggestion">اقتراح</option><option value="complaint">شكوى</option></select></div><div class="field"><label for="suggestionDestination">الجهة</label><select id="suggestionDestination" required><option value="">اختاري الجهة</option><option value="manager">المديرة</option><option value="hr">الموارد البشرية</option><option value="support">الدعم الفني</option></select></div><div class="field span-2"><label for="suggestionText">التفاصيل</label><textarea id="suggestionText" required minlength="3" maxlength="2000"></textarea></div>`,
    data: () => ({ type: value("suggestionType"), destination: value("suggestionDestination"), text: value("suggestionText") }),
    columns: ["النوع", "الجهة", "التفاصيل", "الحالة", "ملاحظة القرار"], row: (x) => [x.type === "complaint" ? "شكوى" : "اقتراح", { manager: "المديرة", hr: "الموارد البشرية", support: "الدعم الفني" }[x.destination] ?? x.destination, x.text, x.status, x.decisionNote || "—"]
  },

  community: {
    title: "الشراكة المجتمعية",
    description: "إرسال طلب أو مبادرة للشراكة المجتمعية.",
    path: "/requests/community",
    createPermission: "request_community",
    managePermission: "manage_community",

    fields: `
    <div class="field">
      <label for="organizationName">اسم الجهة</label>
      <input id="organizationName" required>
    </div>

    <div class="field">
      <label for="organizationType">نوع الجهة</label>
      <input id="organizationType" required>
    </div>

    <div class="field">
      <label for="contactName">اسم المسؤول</label>
      <input id="contactName" required>
    </div>

    <div class="field">
      <label for="mobile">رقم الجوال</label>
      <input id="mobile" required>
    </div>
<div class="field">
  <label for="email">البريد الإلكتروني</label>
  <input id="email" type="email" required>
</div>

<div class="field">
  <label for="initiativeDescription">وصف المبادرة</label>
  <textarea id="initiativeDescription" required></textarea>
</div>

    <div class="field">
      <label for="startDate">تاريخ البداية</label>
      <input id="startDate" type="date" required>
    </div>

    <div class="field">
      <label for="endDate">تاريخ النهاية</label>
      <input id="endDate" type="date" required>
    </div>

 

    <div class="field">
      <label for="attachment">المرفقات</label>
      <input id="attachment" type="file">
    </div>

    <div class="field span-2">
      <label>
        <input id="agreement" type="checkbox" required>
        أقر بصحة البيانات المدخلة
      </label>
    </div>
  `,

    data: () => ({
      organizationName: value("organizationName"),
      organizationType: value("organizationType"),
      contactName: value("contactName"),
      mobile: value("mobile"),
      email: value("email"),
      initiativeDescription: value("initiativeDescription"),
      startDate: value("startDate"),
      endDate: value("endDate"),
      city: value("city"),
      attachment: value("attachment")
    }),

    columns: [
      "اسم الجهة",
      "اسم المسؤول",
      "رقم الجوال",
      "تاريخ البداية",
      "الحالة",
      "ملاحظة القرار"
    ],

    row: (x) => [
      x.organizationName,
      x.contactName,
      x.mobile,
      x.startDate,
      x.status,
      x.decisionNote || "—"
    ]
  },

  assets: { title: "العهد", description: "الاستعلام عن بيانات العهدة المسندة إليك", path: "/requests/assets", createPermission: null, managePermission: "manage_assets", isViewOnly: true, columns: ["اسم العهدة", "الرقم", "اسم الموظف", "تاريخ التسليم", "تاريخ الإرجاع", "الحالة"], row: (x) => [x.assetName, x.assetNumber || "—", x.employeeName || "—", x.assignedAt || formatDate(x.createdAt), x.returnedAt || "—", x.status || "نشطة"] },

  loans: { title: "الاستعلام عن السلف", description: "متابعة طلبات السلف ومراجعتها.", path: "/requests/loans", createPermission: null, managePermission: "manage_loans", isViewOnly: true, columns: ["المبلغ المطلوب", "السبب", "الحالة", "المبلغ المعتمد", "قيمة القسط", "تاريخ الصرف", "الأقساط المسددة", "الأقساط المتبقية"], row: (x) => [x.amount, x.reason, x.status, x.approvedAmount || "—", x.installmentAmount || "—", x.disbursedAt || "—", x.paidInstallments || 0, x.installments ? Math.max(x.installments - (x.paidInstallments || 0), 0) : "—"] },

  materials: {
    title: "طلب المواد",
    description: "إرسال طلب للحصول على مواد ومتابعة حالته.",
    path: "/requests/materials",
    createPermission: "request_materials",
    managePermission: "manage_materials",
    attachment: false,
    isViewOnly: false,
    fields: `
<div class="material-request-form">

    <div class="field">
        <label for="materialNumber">رقم المادة</label>
        <input id="materialNumber" readonly>
    </div>

    <div class="field">
        <label for="materialCode">رمز المادة</label>
        <input id="materialCode" readonly>
    </div>

    <div class="field span-2">
        <label for="materialDesc">اسم المادة</label>
        <input id="materialDesc" readonly>
    </div>

    <div class="field">
        <label for="quantityDesc">الكمية المطلوبة</label>
        <input id="quantityDesc">
    </div>

    <div class="field">
        <label for="unitDesc">الوحدة</label>
        <input id="unitDesc" readonly>
    </div>

</div>

<div class="field span-2">
  <a href="#" id="showMaterialsLink">
عرض قائمة المواد المتاحة 
 </a>
</div>

<div id="materialsTableContainer"></div>

<div id="selectedMaterialsContainer"></div>

<div id="requestTable"></div>
    
  
    `,

    data: () => ({
      items: [
        {
          materialNumber: value("materialNumber"),
          materialCode: value("materialCode"),
          materialDesc: value("materialDesc"),
          quantityDesc: value("quantityDesc"),
          unitDesc: value("unitDesc")
        }
      ],
      notes: value("notes")
    }),
    columns: [
      "رقم المادة",
      "رمز المادة",
      "اسم المادة",
      "الكمية",
      "الوحدة",
      "الحالة",
      "سبب الرفض",
      "تاريخ الطلب"
    ],

    row: (x) => [
      x.items?.[0]?.materialNumber || "—",
      x.items?.[0]?.materialCode || "—",
      x.items?.[0]?.materialDesc || "—",
      x.items?.[0]?.quantityDesc || "—",
      x.items?.[0]?.unitDesc || "—",
      x.status,
      x.decisionNote || "—",
      formatDate(x.submittedAt)
    ]
  },

  support: { title: "الدعم الفني", description: "إرسال طلب دعم ومتابعة حالته.", path: "/support-tickets", createPermission: "request_support", managePermission: "manage_support", fields: `<div class="field"><label for="supportCategory">نوع الطلب</label><select id="supportCategory" required><option value="">اختاري النوع</option><option value="technical">مشكلة تقنية</option><option value="account">الحساب والدخول</option><option value="academic">خدمة أكاديمية</option><option value="other">أخرى</option></select></div><div class="field"><label for="supportPriority">الأولوية</label><select id="supportPriority" required><option value="منخفضة">منخفضة</option><option value="متوسطة" selected>متوسطة</option><option value="عالية">عالية</option><option value="عاجلة">عاجلة</option></select></div><div class="field"><label for="supportDepartment">القسم</label><input id="supportDepartment" required minlength="2" maxlength="120"></div><div class="field"><label for="supportSubject">العنوان</label><input id="supportSubject" required minlength="3" maxlength="160"></div><div class="field span-2"><label for="supportDescription">وصف المشكلة</label><textarea id="supportDescription" required minlength="10" maxlength="2000"></textarea></div>`, data: () => ({ category: value("supportCategory"), priority: value("supportPriority"), department: value("supportDepartment"), subject: value("supportSubject"), description: value("supportDescription") }), columns: ["رقم التذكرة", "المشكلة", "الحالة", "الأولوية", "تاريخ البلاغ"], row: (x) => [x.ticketNumber, x.subject, x.status, x.priority, formatDate(x.createdAt)] }
};

function value(id) { return document.querySelector(`#${id}`)?.value?.trim() ?? ""; }

function formatDateTime(valueToFormat) {
  if (!valueToFormat) return "—";
  const normalizedValue = typeof valueToFormat === "object"
    ? valueToFormat.toDate?.() ?? (valueToFormat._seconds ? new Date(valueToFormat._seconds * 1000) : valueToFormat)
    : valueToFormat;
  const date = new Date(normalizedValue);
  return Number.isNaN(date.getTime()) ? String(valueToFormat) : new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

async function renderRequestPage(key, overrides = {}, viewKey = key) {
  const config = { ...requestPages[key], ...overrides };
  const canCreate = true;  // ط£ظˆ: has(config.createPermission) || true; 
  const isViewOnly = config.isViewOnly ?? false;
  //  const isViewOnly = config.isViewOnly; // طµظپط­ط© ط§ط³طھط¹ظ„ط§ظ… ظپظ‚ط·
  const attachmentField = config.attachment && has("upload_files") ? `<div class="field span-2"><label for="requestAttachment">المرفق (اختياري)</label><input id="requestAttachment" type="file" accept=".pdf,.jpg,.jpeg,.png"><span class="field-hint">PDF أو JPG أو PNG، بحد أقصى 5 ميغابايت.</span></div>` : "";

  // ط¥ط°ط§ ظƒط§ظ†طھ طµظپط­ط© ط¹ط±ط¶ ظپظ‚ط· (ط±ط§ط¨ط·ظٹظ† ظ„ظ„ظ…ظˆط¸ظپط© ظˆط§ظ„ط¥ط¯ط§ط±ط©)
  if (isViewOnly) {

    const employeeTitle = key === "materials"
      ? "طلب مواد"
      : key === "loans"
        ? "سجل طلبات السلف"
        : "الاستعلام عن العهدة";

    const adminTitle = key === "materials"
      ? "إدارة المواد"
      : key === "loans"
        ? "إدارة طلبات السلف"
        : "إدارة العهدة";

    const linksHTML = `
      <nav class="student-services-list" >

<a href="#" id="employeeLink" class="student-service-link">
<div>${employeeTitle}</div>
    <span>→</span>
</a>

<a href="#" id="adminLink" class="student-service-link">
<div>${adminTitle}</div>
    <span>→</span>
</a>

</nav >
      `;
    // ط¥ط¶ط§ظپط© hover effect
    setTimeout(() => {
      document.querySelectorAll(".service-link").forEach(link => {
        link.addEventListener("mouseover", function () {
          this.style.backgroundColor = "#f5f5f5";
        });
        link.addEventListener("mouseout", function () {
          this.style.backgroundColor = "transparent";
        });
      });
    }, 100);
    page(
      config.title,
      config.description,
      `
      <div id = "linksContainer">
        ${linksHTML}
  </div >

      <div id="contentContainer"></div>
    `
    );
    // ط­ط¯ط« ط§ظ„ظ…ظˆط¸ظپط©
    document.querySelector("#employeeLink")?.addEventListener("click", async (e) => {
      e.preventDefault();
      document.querySelector("#linksContainer").style.display = "none";

      document.querySelector("#contentContainer").innerHTML = `
   
      <div class="subsection">
          <h2>${key === "loans" ? "الاستعلام عن السلف" : "الاستعلام عن العهدة"}</h2>
        <div id="requestTable" class="table-wrap">
          <div class="empty-state">جارٍ التحميل...</div>
        </div>
      </div>
    `;
      document.querySelector("#pageBackButton")?.addEventListener("click", (e) => {
        e.preventDefault();

        document.querySelector("#linksContainer").style.display = "block";
        document.querySelector("#contentContainer").innerHTML = "";
      });

      if (key === "materials") {

        const requestTable =
          document.querySelector("#requestTable");

        if (requestTable) {
          await loadMaterialRequests(config, false);
        }

      } else if (key === "loans") {
        await renderLoanEmployee(config);
      } else {

        await loadEmployeeAssets(config);

      }
    });

    // ط­ط¯ط« ط§ظ„ط¥ط¯ط§ط±ط©

    document.querySelector("#adminLink")?.addEventListener("click", async (e) => {
      e.preventDefault();

      document.querySelector("#linksContainer").style.display = "none";

      document.querySelector("#contentContainer").innerHTML = `
    <div class="subsection">
      <h2>${key === "loans" ? "إدارة طلبات السلف" : "إدارة العهدة"}</h2>
      ${key === "assets" ? '<button id="addAssetButton" class="btn btn-small" type="button">إضافة عهدة</button>' : ""}
      <div id="requestTable" class="table-wrap">
        <div class="empty-state">جارٍ التحميل...</div>
      </div>
    </div>
  `;
      document.querySelector("#pageBackButton")?.addEventListener("click", (e) => {
        e.preventDefault();

        document.querySelector("#linksContainer").style.display = "block";
        document.querySelector("#contentContainer").innerHTML = "";
      });

      document.querySelector("#addAssetButton")?.addEventListener("click", async () => {
        const asset = await showCreateAssetDialog();
        if (!asset) return;
        try {
          await api.post("/requests/assets/manage", asset);
          setNotice(document.querySelector("#pageNotice"), "success", "تمت إضافة العهدة وإسنادها للموظفة.");
          await loadAllAssets(config);
        } catch (error) {
          showError(error);
        }
      });

      if (key === "loans") {
        await loadRequestRows(
          { ...config, path: "/requests/loans?scope=all&limit=200" },
          "loans-manage"
        );
      } else {
        await loadAllAssets(config);
      }
    });
  } else {
    // طµظپط­ط© ط§ظ„ط·ظ„ط¨ ط§ظ„ط¹ط§ط¯ظٹط©
    page(config.title, config.description, `${canCreate ? `<form id="requestForm" class="form-grid" novalidate>${config.fields}${attachmentField}<div class="form-actions span-2"><button id="sendRequest" class="btn" type="submit">إرسال الطلب</button></div></form>` : ""}${viewKey === "suggestions-history" ? '<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>' : ""} 
     </div>`);

    document.querySelector("#showMaterialsLink")
      ?.addEventListener("click", async (e) => {
        e.preventDefault();

        await loadMaterialsLookupTable();
      });
    if (canCreate) {

      document.querySelector("#requestForm").addEventListener("submit", async (event) => {

        event.preventDefault();

        const form = event.currentTarget;

        if (!form.reportValidity()) return;

        const button = document.querySelector("#sendRequest");

        await submitSafely(button, async () => {

          try {

            const payload = config.data();

            const file = document.querySelector("#requestAttachment")?.files?.[0];

            if (file) {
              const body = new FormData();
              body.append("file", file);

              const uploaded = await apiFetch("/files", {
                method: "POST",
                body
              });

              payload.attachmentUrl = uploaded.data.attachmentUrl;
            }

            const result = await api.post(config.createPath ?? config.path, payload);

            setNotice(
              document.querySelector("#pageNotice"),
              "success",
              result.message
            );

            form.reset();

            if (document.querySelector("#requestTable")) await loadRequestRows(config, viewKey);
          } catch (error) {
            showError(error);
          }

        }); // ط¥ط؛ظ„ط§ظ‚ submitSafely

      }); // ط¥ط؛ظ„ط§ظ‚ requestForm submit

    } // ط¥ط؛ظ„ط§ظ‚ if (canCreate)

  } // ط¥ط؛ظ„ط§ظ‚ else

} // ط¥ط؛ظ„ط§ظ‚ async function renderRequestPage

function leaveLink(route, title, description) {
  return studentHubLink(route, title, description);
}

function renderSuggestionsHub() {
  const links = [];
  if (has("request_suggestions") || hasRole("system_admin")) links.push(studentHubLink("suggestions-employee", "للموظفة", "إرسال اقتراح أو شكوى للجهة المختصة."));
  if (has("request_suggestions") || hasRole("system_admin")) links.push(studentHubLink("suggestions-history", "سجل طلباتي", "متابعة الاقتراحات والشكاوى التي أرسلتِها."));
  if (has("manage_support") || hasRole("system_admin")) links.push(studentHubLink("suggestions-manage", "للإدارة", "مراجعة الطلبات حسب الجهة المختصة."));
  page("الاقتراحات والشكاوى", "اختاري نوع الخدمة.", `<nav class="student-services-list" aria-label="خدمات الاقتراحات والشكاوى">${links.join("")}</nav>`);
}

function renderSupportHub() {
  const links = [];
  if (has("request_support") || hasRole("system_admin")) links.push(studentHubLink("support-employee", "رفع مشكلة", "إرسال بلاغ للدعم الفني."));
  if (has("request_support") || hasRole("system_admin")) links.push(studentHubLink("support-history", "سجل مشاكلي", "متابعة البلاغات التي أرسلتِها."));
  if (has("manage_support") || hasRole("system_admin")) links.push(studentHubLink("support-manage", "متابعة المشاكل", "عرض بلاغات الموظفات ومتابعتها."));
  page("الدعم الفني", "اختاري نوع الخدمة.", `<nav class="student-services-list" aria-label="خدمات الدعم الفني">${links.join("")}</nav>`);
}

async function renderSupportEmployee() {
  await renderRequestPage("support", {}, "support-employee");
}

async function renderInvoices() {
  page("رفع الفواتير", "ارفعي فواتير المشتريات أو المصروفات المرتبطة بالعمل واحتفظي بسجلها.", `<form id="invoiceForm" class="form-grid" novalidate><div class="field"><label for="invoiceSupplier">اسم المورد</label><input id="invoiceSupplier" required maxlength="160"></div><div class="field"><label for="invoiceNumber">رقم الفاتورة</label><input id="invoiceNumber" required maxlength="80"></div><div class="field"><label for="invoiceDate">تاريخ الفاتورة</label><input id="invoiceDate" type="date" required></div><div class="field"><label for="invoiceAmount">المبلغ</label><input id="invoiceAmount" inputmode="decimal" min="0" step="0.01" placeholder="اختياري"></div><div class="field span-2"><label for="invoiceFile">ملف الفاتورة</label><input id="invoiceFile" type="file" accept=".pdf,.jpg,.jpeg,.png" required><span class="field-hint">PDF أو JPG أو PNG، بحد أقصى 5 ميغابايت.</span></div><div class="field span-2"><label for="invoiceNotes">ملاحظات (اختياري)</label><textarea id="invoiceNotes" maxlength="500"></textarea></div><div class="form-actions span-2"><button id="uploadInvoiceButton" class="btn" type="submit">رفع الفاتورة</button></div></form><h2>الفواتير المرفوعة</h2><div id="invoiceTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>`);
  const renderRows = (invoices) => {
    const table = document.querySelector("#invoiceTable");
    if (!invoices.length) { table.innerHTML = '<div class="empty-state">لا توجد فواتير مرفوعة.</div>'; return; }
    table.innerHTML = `<table><thead><tr><th>المورد</th><th>رقم الفاتورة</th><th>التاريخ</th><th>المبلغ</th><th>الحالة</th><th>الملف</th></tr></thead><tbody>${invoices.map((invoice) => `<tr>${[invoice.supplierName, invoice.invoiceNumber, invoice.invoiceDate, invoice.amount || "—", invoice.status].map((item) => createCell(item).outerHTML).join("")}<td><button class="btn btn-small" type="button" data-invoice-path="${encodeURIComponent(invoice.filePath)}">تنزيل</button></td></tr>`).join("")}</tbody></table>`;
    table.querySelectorAll("[data-invoice-path]").forEach((button) => button.addEventListener("click", async () => { try { await downloadFile(`/files/download?path=${button.dataset.invoicePath}`, "invoice"); } catch (error) { showError(error); } }));
  };
  const loadInvoices = async () => renderRows((await api.get("/invoices")).data);
  await loadInvoices();
  document.querySelector("#invoiceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const button = document.querySelector("#uploadInvoiceButton");
    await submitSafely(button, async () => {
      const body = new FormData();
      body.append("supplierName", value("invoiceSupplier"));
      body.append("invoiceNumber", value("invoiceNumber"));
      body.append("invoiceDate", value("invoiceDate"));
      body.append("amount", value("invoiceAmount"));
      body.append("notes", value("invoiceNotes"));
      body.append("file", document.querySelector("#invoiceFile").files[0]);
      const result = await apiFetch("/invoices", { method: "POST", body });
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      event.currentTarget.reset();
      await loadInvoices();
    });
  });
}

async function renderSupportHistory() {
  page("سجل مشاكلي", "متابعة البلاغات التي أرسلتِها.", '<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>');
  await loadRequestRows({ ...requestPages.support, path: "/support-tickets" }, "support-history");
}

async function renderSupportManage() {
  page("متابعة مشاكل الدعم الفني", "إدارة التذاكر ومتابعة حالتها وإجراءاتها.", `<div class="support-dashboard"><div id="supportStats" class="support-stats"></div><form id="supportFilters" class="form-grid"><div class="field"><label for="filterTicketNumber">رقم التذكرة</label><input id="filterTicketNumber"></div><div class="field"><label for="filterRequesterName">الموظفة</label><input id="filterRequesterName"></div><div class="field"><label for="filterDepartment">القسم</label><input id="filterDepartment"></div><div class="field"><label for="filterStatus">الحالة</label><select id="filterStatus"><option value="">كل الحالات</option><option>جديدة</option><option>قيد المعالجة</option><option>بانتظار الموظف</option><option>تم الحل</option><option>مغلقة</option></select></div><div class="field"><label for="filterPriority">الأولوية</label><select id="filterPriority"><option value="">كل الأولويات</option><option>منخفضة</option><option>متوسطة</option><option>عالية</option><option>عاجلة</option></select></div><div class="field"><label for="filterDate">التاريخ</label><input id="filterDate" type="date"></div><div class="form-actions span-2"><button class="btn" type="submit">بحث وتصفية</button></div></form><div id="supportTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div><div id="supportDetails"></div></div>`);
  document.querySelector("#supportFilters").addEventListener("submit", (event) => { event.preventDefault(); loadSupportDashboard(); });
  await loadSupportDashboard();
}

async function loadSupportDashboard() {
  const params = new URLSearchParams();
  [["ticketNumber", "filterTicketNumber"], ["requesterName", "filterRequesterName"], ["department", "filterDepartment"], ["status", "filterStatus"], ["priority", "filterPriority"], ["createdAt", "filterDate"]].forEach(([key, id]) => { const valueText = value(id); if (valueText) params.set(key, valueText); });
  const response = await api.get(`/support-tickets?${params}`);
  const stats = response.stats ?? {};
  document.querySelector("#supportStats").innerHTML = [["total", "إجمالي التذاكر"], ["new", "الجديدة"], ["inProgress", "قيد المعالجة"], ["closed", "المغلقة"], ["overdue", "المتأخرة"]].map(([key, label]) => `<div class="support-stat"><strong>${stats[key] ?? 0}</strong><span>${label}</span></div>`).join("");
  const table = document.querySelector("#supportTable");
  if (!response.data.length) { table.innerHTML = '<div class="empty-state">لا توجد تذاكر مطابقة.</div>'; return; }
  table.innerHTML = `<table><thead><tr><th>رقم التذكرة</th><th>المشكلة</th><th>الموظفة</th><th>القسم</th><th>الأولوية</th><th>الحالة</th><th>تاريخ البلاغ</th><th>موظف الدعم</th><th>التفاصيل</th></tr></thead><tbody>${response.data.map((ticket) => `<tr><td>${ticket.ticketNumber}</td><td>${ticket.subject}</td><td>${ticket.requesterName}</td><td>${ticket.department}</td><td>${ticket.priority}</td><td>${ticket.status}</td><td>${formatDate(ticket.createdAt)}</td><td>${ticket.supportEmployeeUid || "—"}</td><td><button class="btn btn-small" data-ticket-id="${ticket.id}">فتح</button></td></tr>`).join("")}</tbody></table>`;
  table.querySelectorAll("[data-ticket-id]").forEach((button) => button.addEventListener("click", () => showSupportDetails(button.dataset.ticketId)));
}

async function showSupportDetails(ticketId) {
  const ticket = (await api.get(`/support-tickets/${ticketId}`)).data;
  const details = document.querySelector("#supportDetails");
  const comments = (ticket.comments ?? []).map((comment) => `<p><strong>${comment.byName}</strong> (${formatDate(comment.at)}): ${comment.text}</p>`).join("");
  const commentsSection = comments ? `<h3>المحادثات والتحديثات</h3><div>${comments}</div>` : "";
  details.innerHTML = `<section class="support-ticket-details"><h2>${ticket.ticketNumber}: ${ticket.subject}</h2><p><strong>وصف المشكلة:</strong> ${ticket.description}</p><p><strong>الموظفة:</strong> ${ticket.requesterName} | <strong>القسم:</strong> ${ticket.department} | <strong>الأولوية:</strong> ${ticket.priority}</p><p><strong>المرفق:</strong> ${ticket.attachmentUrl ? `<a href="${ticket.attachmentUrl}" target="_blank" rel="noopener">عرض المرفق</a>` : "لا يوجد"}</p>${commentsSection}<h3>السجل الزمني</h3><ol>${(ticket.timeline ?? []).map((event) => `<li>${event.action} - ${event.byName} - ${formatDate(event.at)}</li>`).join("")}</ol><form id="supportUpdateForm" class="form-grid"><div class="field"><label for="supportStatus">الحالة</label><select id="supportStatus"><option>جديدة</option><option>قيد المعالجة</option><option>بانتظار الموظف</option><option>تم الحل</option><option>مغلقة</option></select></div><div class="field"><label for="supportAssignee">موظف الدعم UID</label><input id="supportAssignee" value="${ticket.supportEmployeeUid || ""}"></div><div class="field span-2"><label for="supportComment">إضافة تعليق أو طلب معلومات</label><textarea id="supportComment" minlength="1"></textarea></div><div class="field span-2"><label><input id="supportEscalated" type="checkbox" ${ticket.escalated ? "checked" : ""}> تصعيد التذكرة</label></div><div class="form-actions span-2"><button class="btn" type="submit">حفظ التحديث</button></div></form></section>`;
  document.querySelector("#supportStatus").value = ticket.status;
  document.querySelector("#supportUpdateForm").addEventListener("submit", async (event) => { event.preventDefault(); const result = await api.patch(`/support-tickets/${ticketId}`, { status: value("supportStatus"), assigneeUid: value("supportAssignee") || undefined, comment: value("supportComment") || undefined, escalated: document.querySelector("#supportEscalated").checked }); setNotice(document.querySelector("#pageNotice"), "success", result.message); await loadSupportDashboard(); await showSupportDetails(ticketId); });
}

async function renderSuggestionsEmployee() {
  await renderRequestPage("suggestions-complaints", {}, "suggestions-employee");
}

async function renderSuggestionsHistory() {
  page("سجل طلباتي", "متابعة الاقتراحات والشكاوى التي أرسلتِها.", '<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>');
  await loadRequestRows({ ...requestPages["suggestions-complaints"], path: "/requests/suggestions-complaints?scope=mine&limit=200" }, "suggestions-history");
}

async function renderSuggestionsManage() {
  page("إدارة الاقتراحات والشكاوى", "مراجعة الطلبات المحالة حسب الجهة المختصة.", '<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>');
  await loadRequestRows({ ...requestPages["suggestions-complaints"], path: "/requests/suggestions-complaints?scope=all&limit=200" }, "suggestions-manage");
}

async function renderLeaveHub() {
  const links = [];
  if (has("request_leave")) {
    links.push(leaveLink("leave-request", "طلب إجازة – الموظفة", "اختيار النوع والتواريخ وإرفاق المستندات."));
    links.push(leaveLink("leave-history", "سجل طلباتي – الموظفة", "متابعة قرارات المديرة والموارد البشرية."));
    links.push(leaveLink("leave-extension", "تمديد الإجازة – الموظفة", "طلب تمديد إجازة معتمدة."));
  }
  if (has("manage_leave_requests")) links.push(leaveLink("leave-manager", "طلبات الإجازات – المديرة", "مراجعة الطلبات وإرسالها للموارد البشرية."));
  if (has("manage_leave_hr_requests") || hasRole("hr", "system_admin")) links.push(leaveLink("leave-hr", "طلبات الإجازات – الموارد البشرية", "اعتماد القرار النهائي أو رفضه."));
  page("الإجازات", "اختاري الخدمة المطلوبة.", `<nav class="student-services-list" aria-label="خدمات الإجازات">${links.join("")}</nav>`);
}

function addLeaveDurationListener() {
  const start = document.querySelector("#startDate");
  const end = document.querySelector("#endDate");
  const duration = document.querySelector("#leaveDuration");
  if (!start || !end || !duration) return;
  const update = () => {
    const startDate = new Date(`${start.value}T00:00:00`);
    const endDate = new Date(`${end.value}T00:00:00`);
    const days = start.value && end.value ? Math.round((endDate - startDate) / 86400000) + 1 : 0;
    duration.value = days > 0 ? `${days} يوم` : "";
  };
  start.addEventListener("input", update);
  end.addEventListener("input", update);
}

function addLeaveAttachmentListener() {
  const type = document.querySelector("#leaveType");
  const attachment = document.querySelector("#requestAttachment");
  const label = document.querySelector('label[for="requestAttachment"]');
  if (!type || !attachment || !label) return;
  const requiredTypes = new Set(["sick", "maternity", "nursing_hour", "marriage", "bereavement"]);
  const update = () => {
    const required = requiredTypes.has(type.value);
    attachment.required = required;
    label.textContent = required ? "المرفق (مطلوب لهذا النوع)" : "المرفق (اختياري)";
  };
  type.addEventListener("change", update);
  update();
}

async function renderLeaveRequest() {
  await renderRequestPage("leave");
  addLeaveDurationListener();
  addLeaveAttachmentListener();
}

async function renderLeaveHistory() {
  page("سجل طلباتي", "جميع مراحل طلبات الإجازة وقراراتها.", `<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>`);
  await loadRequestRows({ ...requestPages.leave, path: "/requests/leave?scope=mine&limit=200" }, "leave-history");
}

async function renderLeaveExtension() {
  page("تمديد الإجازة", "اختاري إجازة معتمدة وحددي تاريخ النهاية الجديد.", `<form id="leaveExtensionForm" class="form-grid" novalidate><div class="field span-2"><label for="extensionLeave">الإجازة المعتمدة</label><select id="extensionLeave" required><option value="">جاري التحميل...</option></select></div><div class="field"><label for="extensionEndDate">تاريخ النهاية الجديد</label><input id="extensionEndDate" type="date" required></div><div class="field"><label for="extensionDuration">مدة التمديد</label><input id="extensionDuration" readonly></div><div class="field span-2"><label for="extensionNotes">ملاحظات اختيارية</label><input id="extensionNotes" maxlength="500"></div><div class="form-actions span-2"><button id="sendExtension" class="btn" type="submit">إرسال طلب التمديد</button></div></form><div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>`);
  const rows = (await api.get("/requests/leave?scope=mine&limit=200")).data.filter((item) => ["معتمد", "تمديد معتمد"].includes(item.status));
  const select = document.querySelector("#extensionLeave");
  select.replaceChildren(new Option("اختاري الإجازة", ""), ...rows.map((item) => new Option(`${labels.leave[item.leaveType] ?? item.leaveType} (${item.startDate} إلى ${item.endDate})`, item.id)));
  const updateDuration = () => {
    const item = rows.find((row) => row.id === select.value);
    const endDate = new Date(`${document.querySelector("#extensionEndDate").value}T00:00:00`);
    const baseDate = item && new Date(`${item.endDate}T00:00:00`);
    const days = item && document.querySelector("#extensionEndDate").value ? Math.round((endDate - baseDate) / 86400000) : 0;
    document.querySelector("#extensionDuration").value = days > 0 ? `${days} يوم` : "";
  };
  select.addEventListener("change", updateDuration);
  document.querySelector("#extensionEndDate").addEventListener("input", updateDuration);
  document.querySelector("#leaveExtensionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    await submitSafely(document.querySelector("#sendExtension"), async () => {
      const result = await api.post("/requests/leave/extension", { parentLeaveId: select.value, endDate: value("extensionEndDate"), notes: value("extensionNotes") });
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      event.currentTarget.reset();
      await loadRequestRows({ ...requestPages.leave, path: "/requests/leave?scope=mine&limit=200" }, "leave-history");
    });
  });
  await loadRequestRows({ ...requestPages.leave, path: "/requests/leave?scope=mine&limit=200" }, "leave-history");
}

async function renderLeaveQueue(scope) {
  const isHr = scope === "hr";
  const config = { ...requestPages.leave, managePermission: isHr ? "manage_leave_hr_requests" : "manage_leave_requests", path: "/requests/leave?scope=all&limit=200", filter: (item) => item.status === (isHr ? "بانتظار الموارد البشرية" : "بانتظار المديرة"), columns: ["الموظفة", ...requestPages.leave.columns], row: (item) => [item.employeeName || "—", ...requestPages.leave.row(item)] };
  page(isHr ? "طلبات الإجازات – الموارد البشرية" : "طلبات الإجازات – المديرة", isHr ? "مراجعة قرار المديرة واتخاذ القرار النهائي." : "مراجعة الطلب ثم إحالته للموارد البشرية.", `<div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>`);
  await loadRequestRows(config, isHr ? "leave-hr" : "leave-manager");
}

async function renderPermissionHub() {
  const links = [];
  if (has("request_leave")) {
    links.push(studentHubLink("permission-self", "تقديم استئذان", "إرسال طلب استئذان ومتابعة حالته"));
    links.push(studentHubLink("permission-history", "سجل طلبات الاستئذان", "عرض الطلبات السابقة وحالاتها"));
  }
  if (has("manage_leave_requests")) {
    links.push(studentHubLink("permission-manage", "إدارة الاستئذان", "عرض الطلبات وقبولها أو رفضها"));
  }
  page("الاستئذان", "اختاري الخدمة المطلوبة.", `<nav class="student-services-list" aria-label="خدمات الاستئذان">${links.join("")}</nav>`);
}

async function renderPermissionEmployee() {
  await renderRequestPage("permission");
}

async function renderPermissionHistory() {
  page("سجل طلبات الاستئذان", "متابعة الطلبات السابقة وحالاتها وملاحظات القرارات.", `
    <div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `);
  await loadRequestRows({ ...requestPages.permission, path: "/requests/permission?scope=mine&limit=200" }, "permission-my");
}

async function renderPermissionManage() {
  if (!has("manage_leave_requests")) throw new Error("إدارة الاستئذان متاحة للإدارة المخولة فقط.");
  page("إدارة الاستئذان", "عرض طلبات الاستئذان ومراجعتها واتخاذ القرار.", `
    <div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `);
  await loadRequestRows({ ...requestPages.permission, path: "/requests/permission?scope=all&limit=200" }, "permission-manage");
}

async function renderAbsenceHub() {
  const links = [];
  if (has("request_absence") || has("request_leave")) {
    links.push(studentHubLink("absence-report-self", "تبليغ غياب", "إرسال بلاغ غياب مع تحديد النوع والتاريخ والسبب"));
    links.push(studentHubLink("absence-report-history", "سجل طلباتي", "عرض بلاغات الغياب السابقة وحالاتها"));
  }
  if (has("manage_absence") || has("manage_leave_requests")) {
    links.push(studentHubLink("absence-report-manage", "إدارة تبليغ الغياب", "عرض بلاغات الموظفات ومراجعتها"));
  }
  page("تبليغ الغياب", "اختاري الخدمة المطلوبة.", `<nav class="student-services-list" aria-label="خدمات تبليغ الغياب">${links.join("")}</nav>`);
}

async function renderAbsenceReportEmployee() {
  await renderRequestPage("absence-report");
}

async function renderAbsenceReportHistory() {
  page("سجل طلباتي", "متابعة بلاغات الغياب السابقة وحالاتها.", `
    <div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `);
  await loadRequestRows({ ...requestPages["absence-report"], path: "/requests/absence-report?scope=mine&limit=200" }, "absence-report-history");
}

async function renderAbsenceReportManage() {
  if (!(has("manage_absence") || has("manage_leave_requests"))) throw new Error("إدارة تبليغ الغياب متاحة للإدارة المخولة فقط.");
  page("إدارة تبليغ الغياب", "عرض بلاغات الغياب ومراجعتها واتخاذ القرار.", `
    <div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
  `);
  const config = requestPages["absence-report"];
  await loadRequestRows({
    ...config,
    path: "/requests/absence-report?scope=all&limit=200",
    columns: ["الموظفة", "نوع الغياب", "التاريخ", "السبب", "وقت الإرسال", "اطلاع الإدارة", "وقت اطلاع الإدارة"],
    row: (item) => [item.employeeName || "—", ({ sick: "غياب مرضي", emergency: "غياب اضطراري", personal: "ظرف شخصي", other: "سبب آخر" }[item.absenceType] ?? item.absenceType), item.date, item.reason, formatDateTime(item.submittedAt), item.managerViewedAt ? "تم الاطلاع" : "لم يتم الاطلاع", formatDateTime(item.managerViewedAt)]
  }, "absence-report-manage");
}

async function loadRequestRows(config, key) {

  try {
    let rows = (await api.get(config.path)).data;
    if (config.filter) rows = rows.filter(config.filter);

    console.log("REQUEST ROWS:", rows);

    const wrap = document.querySelector("#requestTable");

    if (!wrap) {
      console.error("requestTable not found");
      return;
    }

    wrap.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "لا توجد طلبات حتى الآن.";
      wrap.append(empty); return;
    }
    const canDecide =
      (has(config.managePermission) || (key.startsWith("absence-report") && has("manage_leave_requests")) || (key === "leave-hr" && hasRole("hr")) || hasRole("system_admin")) &&
      !["permission", "permission-my", "absence-report-history", "absence-report-manage", "leave-history", "leave-extension", "suggestions-history", "support-history", "support-manage", "training-course-history"].includes(key) &&
      key !== "support" &&
      key !== "materials-my" &&
      key !== "community-my" &&
      key !== "loans-my";
    const table = document.createElement("table");
    const head = document.createElement("thead");
    const trh = document.createElement("tr");[...config.columns, ...(canDecide ? ["الإجراء"] : [])].forEach((x) => {
      const th = document.createElement("th");
      th.textContent = x; trh.append(th);
    }); head.append(trh); const body = document.createElement("tbody");
    table.classList.toggle("absence-report-table", key.startsWith("absence-report"));
    table.classList.toggle("absence-report-table-manager", key === "absence-report-manage");
    rows.forEach((item) => {
      const tr = document.createElement("tr");
      config.row(item).forEach((x, index) => {
        if (key === "absence-report-manage" && index === 5) {
          const cell = document.createElement("td");
          const label = document.createElement("label");
          label.className = `absence-view-status ${item.managerViewedAt ? "is-viewed" : "is-unviewed"}`;
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = Boolean(item.managerViewedAt);
          checkbox.setAttribute("aria-label", "تأكيد اطلاع إدارة الغياب");
          const text = document.createElement("span");
          text.textContent = item.managerViewedAt ? "تم الاطلاع" : "لم يتم الاطلاع";
          checkbox.addEventListener("change", async () => {
            if (!checkbox.checked) {
              checkbox.checked = true;
              return;
            }
            try {
              await api.patch(`/requests/absence-report/${encodeURIComponent(item.id)}/manager-viewed`, {});
              item.managerViewedAt = new Date().toISOString();
              label.className = "absence-view-status is-viewed";
              text.textContent = "تم الاطلاع";
              const viewedTimeCell = tr.querySelector(".absence-manager-viewed-time");
              if (viewedTimeCell) viewedTimeCell.textContent = formatDateTime(item.managerViewedAt);
            } catch (error) {
              checkbox.checked = false;
              showError(error);
            }
          });
          label.append(checkbox, text);
          cell.append(label);
          tr.append(cell);
          return;
        }
        const cell = createCell(x);
        if (key === "absence-report-history" && index === 3) {
          cell.classList.add(item.managerViewedAt ? "absence-viewed-status" : "absence-unviewed-status");
        }
        if (key === "absence-report-manage" && index === 6) cell.classList.add("absence-manager-viewed-time");
        tr.append(cell);
      });
      if (canDecide) {
        const td = document.createElement("td");
        const actionButtons = document.createElement("div");
        actionButtons.className = "action-buttons";
        if (["قيد المراجعة", "بانتظار المديرة", "بانتظار الموارد البشرية"].includes(item.status) && (item.employeeUid !== state.me.uid || hasRole("system_admin"))) {
          ["approved", "rejected"].forEach((decision) => {
            const button = document.createElement("button");
            button.className = `btn ${decision === "rejected" ? "btn-danger" : ""} btn-small`;
            button.textContent = decision === "approved" ? "اعتماد" : "رفض";
            button.addEventListener("click", () =>
              decideRequest(
                key === "assets" ? "asset" :
                  key.startsWith("loans") ? "loan" :
                    key.startsWith("community") ? "community" :
                      key.startsWith("suggestions") ? "suggestion" :
                        key.startsWith("leave-") ? "leave" :
                          key.startsWith("permission") ? "permission" :
                            key.startsWith("absence-report") ? "absence" :
                              key.startsWith("training-course") ? "training-course" : key,
                item.id,
                decision,
                config,
                key
              ));
            actionButtons.append(button);
          });
        } else if (key === "loans-manage" && ["معتمد", "تم الصرف", "قيد السداد"].includes(item.status)) {
          const disburseButton = document.createElement("button");
          disburseButton.className = "btn btn-small";
          disburseButton.textContent = "تسجيل الصرف";
          disburseButton.disabled = item.status !== "معتمد";
          disburseButton.addEventListener("click", () => updateLoanTracking(item, "disburse", config, key));
          const paymentButton = document.createElement("button");
          paymentButton.className = "btn btn-small";
          paymentButton.textContent = "تسجيل قسط";
          paymentButton.disabled = item.status === "معتمد";
          paymentButton.addEventListener("click", () => updateLoanTracking(item, "payment", config, key));
          actionButtons.append(disburseButton, paymentButton);
        } else if (item.status !== "قيد المراجعة") actionButtons.textContent = "—";
        td.append(actionButtons);
        tr.append(td);
      }
      body.append(tr);
    });
    table.append(head, body);
    wrap.append(table);
    if (["loans-my", "loans-manage"].includes(key)) renderLoanInstallmentTable(rows, wrap);
  } catch (error) { showError(error); }
}

function renderLoanInstallmentTable(rows, wrap) {
  const approvedLoans = rows.filter((loan) => ["معتمد", "تم الصرف", "قيد السداد", "مسددة"].includes(loan.status) && loan.installmentSchedule?.length);
  if (!approvedLoans.length) return;
  const section = document.createElement("section");
  section.className = "loan-installments-section";
  const title = document.createElement("h2");
  title.textContent = "تفاصيل الأقساط";
  section.append(title);
  approvedLoans.forEach((loan) => {
    const subtitle = document.createElement("h3");
    subtitle.textContent = `السلفة المعتمدة: ${loan.approvedAmount || loan.amount}`;
    section.append(subtitle);
    const table = document.createElement("table");
    table.innerHTML = `<thead><tr><th>رقم القسط</th><th>تاريخ الاستحقاق</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>${loan.installmentSchedule.map((installment) => `<tr><td>${installment.number}</td><td>${installment.dueDate}</td><td>${installment.amount || loan.installmentAmount}</td><td>${installment.status}</td></tr>`).join("")}</tbody>`;
    section.append(table);
  });
  wrap.after(section);
}

async function renderLoanEmployee(config) {
  const container = document.querySelector("#contentContainer");
  container.innerHTML = `
    <div class="subsection">
      <h2>تقديم طلب سلفة</h2>
      <form id="loanRequestForm" class="form-grid" novalidate>
        <div class="field"><label for="loanAmount">المبلغ المطلوب</label><input id="loanAmount" type="number" min="1" step="0.01" required></div>
        <div class="field"><label for="loanAttachment">مستند مؤيد (اختياري)</label><input id="loanAttachment" type="file" accept=".pdf,.jpg,.jpeg,.png"></div>
        <div class="field span-2"><label for="loanReason">سبب طلب السلفة</label><textarea id="loanReason" minlength="3" maxlength="500" required></textarea></div>
        <div class="form-actions span-2"><button class="btn" type="submit">إرسال طلب السلفة</button></div>
      </form>
      <h2>متابعة طلباتي</h2>
      <div id="requestTable" class="table-wrap"><div class="empty-state">جاري التحميل...</div></div>
    </div>
  `;
  document.querySelector("#loanRequestForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const button = form.querySelector("button[type=submit]");
    await submitSafely(button, async () => {
      const payload = {
        amount: Number(value("loanAmount")),
        reason: value("loanReason")
      };
      const file = document.querySelector("#loanAttachment").files[0];
      if (file) {
        const body = new FormData();
        body.append("file", file);
        payload.attachmentUrl = (await apiFetch("/files", { method: "POST", body })).data.attachmentUrl;
      }
      const result = await api.post(config.path, payload);
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      form.reset();
      await loadRequestRows({ ...config, path: "/requests/loans?scope=mine&limit=200" }, "loans-my");
    });
  });
  await loadRequestRows({ ...config, path: "/requests/loans?scope=mine&limit=200" }, "loans-my");
}

// ============================================================
// ظ…ط±ط§ط­ظ„ ط·ظ„ط¨ ط§ظ„ظ…ظˆط§ط¯
// ============================================================
// ط¯ط§ظ„ط© ظ„طھط­ظ…ظٹظ„ ط·ظ„ط¨ط§طھ ط§ظ„ظ…ظˆط§ط¯
async function loadMaterialRequests(config, canManage) {

  try {
    const rows = (await api.get(config.path)).data;
    const wrap = document.querySelector("#requestTable");

    if (!wrap) {
      console.error("requestTable not found");
      return;
    }

    wrap.replaceChildren();

    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "لا توجد طلبات حتى الآن.";
      wrap.append(empty);
      return;
    }

    const table = document.createElement("table");
    const head = document.createElement("thead");
    const trh = document.createElement("tr");

    [...config.columns, ...(canManage ? ["الإجراء"] : [])].forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      trh.append(th);
    });
    head.append(trh);

    const body = document.createElement("tbody");
    rows.forEach((item) => {

      const tr = document.createElement("tr");

      config.row(item).forEach((cell) => {
        tr.append(createCell(cell));
      });

      if (canManage) {

        const actionCell = document.createElement("td");

        if (item.status === "قيد المراجعة") {

          const approveBtn = document.createElement("button");
          approveBtn.type = "button";
          approveBtn.className = "btn btn-small";
          approveBtn.textContent = "اعتماد";

          approveBtn.addEventListener("click", async () => {
            await decideMaterialRequest(
              item.id,
              "approved",
              config
            );
          });

          const rejectBtn = document.createElement("button");
          rejectBtn.type = "button";
          rejectBtn.className = "btn btn-small btn-danger";
          rejectBtn.textContent = "رفض";

          rejectBtn.addEventListener("click", async () => {
            await decideMaterialRequest(
              item.id,
              "rejected",
              config
            );
          });

          actionCell.append(
            approveBtn,
            document.createTextNode(" "),
            rejectBtn
          );

        } else {

          actionCell.textContent = "تمت المعالجة";

        }

        tr.append(actionCell);

      }

      body.append(tr);

    });


    table.append(head, body);
    wrap.append(table);
  } catch (error) {
    showError(error);
  }
}

// ط¯ط§ظ„ط© ظ„طھط­ظ…ظٹظ„ ط¬ط¯ظˆظ„ ط§ظ„ظ…ظˆط§ط¯
async function loadMaterialsTable() {
  try {
    const wrap = document.querySelector("#materialsTable");

    if (!wrap) {
      console.error("Element #materialsTable not found");
      return;
    }

    // ط¥ط¶ط§ظپط© ظ…ط¤ط´ط± طھط­ظ…ظٹظ„ ظ…ط¤ظ‚طھ
    wrap.innerHTML = '<div class="empty-state">جاري التحميل...</div>';

    const response = await api.get("/requests/materials-list?_=" + Date.now());

    const materials = response.data;

    console.table(materials.slice(0, 5));
    console.log(
      "بعد التعديل من الجدول:",
      materials[0] || null
    );
    console.log("FIRST MATERIAL =",
      JSON.stringify(materials[0], null, 2));

    // ظ…ط³ط­ ظ…ط­طھظˆظ‰ ط§ظ„طھط­ظ…ظٹظ„
    wrap.innerHTML = "";

    console.log(
      "إعادة رسم الجدول بالقيم:",
      materials[0]?.nameAr || ""
    );

    // ط¥ط°ط§ ظƒط§ظ†طھ ظ„ط§ طھظˆط¬ط¯ ظ…ظˆط§ط¯
    if (!materials || materials.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "لا توجد مواد حتى الآن.";
      wrap.append(empty);
      return;
    }

    const table = document.createElement("table");
    const head = document.createElement("thead");
    const trh = document.createElement("tr");
    [
      "م",
      "رقم المادة",
      "رمز المادة",
      "وصف المادة",
      "وصف الكمية",
      "الوحدة",
      "الإجراء"
    ].forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      trh.append(th);
    });
    head.append(trh);

    const body = document.createElement("tbody");

    materials.forEach((material, index) => {
      console.log("MATERIAL OBJECT =", material);

      // ط§ظ„طھط£ظƒط¯ ظ…ظ† ظˆط¬ظˆط¯ ط¬ظ…ظٹط¹ ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ظ…ط·ظ„ظˆط¨ط©
      const itemNumber = material.itemNumber || material.materialNumber || "";
      const code = material.code || material.materialCode || "";
      const nameAr = material.nameAr || material.materialDesc || "";
      const quantityDescription = material.quantityDescription || material.quantityDesc || "";
      const units = material.units || "";
      const materialId = material.firestoreId || material.id;

      const tr = document.createElement("tr");
      tr.innerHTML = `
  <td>${index + 1}</td>
  <td>${itemNumber}</td>
  <td>${code}</td>
  <td>${nameAr}</td>
  <td>${quantityDescription}</td>
  <td>${units}</td>
  <td>
    <div class="material-action-buttons">
    <button class="btn btn-small edit-material-btn" type="button">
      تعديل
    </button>
    <button class="btn btn-small btn-danger delete-material-btn" type="button">
      حذف
    </button>
    </div>
  </td>
`;

      body.append(tr);

      const editBtn = tr.querySelector('.edit-material-btn');
      editBtn.addEventListener('click', () => {
        editMaterialModal(
          materialId,
          itemNumber,
          code,
          nameAr,
          quantityDescription,
          units
        );
      });

      const deleteBtn = tr.querySelector('.delete-material-btn');
      deleteBtn.addEventListener('click', () => {
        deleteMaterialConfirm(materialId);
      });
    });

    table.append(head, body);
    wrap.append(table);
    console.log("TABLE HTML:", wrap.innerHTML);
  } catch (error) {
    console.error(error);
    console.error(error.stack);
    showError(error);
  }
}


async function renderMaterialsManageRequests() {

  page(
    "إدارة طلبات المواد",
    "مراجعة واعتماد أو رفض طلبات المواد.",
    `
        <div id ="requestTable" class="table-wrap">
          <div class="empty-state">
            جاري التحميل...
          </div>
      </div>
        `
  );

  await loadMaterialRequests(
    requestPages.materials,
    true
  );
}




async function loadMaterialsLookupTable() {
  try {
    const response = await api.get("/requests/materials-list");
    const materials = Array.isArray(response?.data)
      ? response.data
      : [];

    const wrap = document.querySelector("#materialsTableContainer");

    if (!Array.isArray(materials)) {
      console.error("materials is not an array:", materials);
      return;
    }

    if (!wrap) {
      console.error("materialsTableContainer not found in page");
      return;
    }

    wrap.replaceChildren();

    const table = document.createElement("table");

    table.innerHTML = `
        <thead >
        <tr>
          <th>رقم المادة</th>
          <th>رمز المادة</th>
          <th>اسم المادة</th>
          <th>الوحدة</th>
          <th>اختيار</th>
        </tr>
      </thead >
        <tbody>
          ${(materials || []).map(material => `
 <tr>
  <td>${material.itemNumber || ""}</td>
  <td>${material.code || ""}</td>
  <td>${material.nameAr || ""}</td>
  <td>${material.units || ""}</td>
  <td>
    <button
      type="button"
      class="btn-small select-material-btn"
      data-number="${material.itemNumber || ''}"
      data-code="${material.code || ''}"
      data-desc="${material.nameAr || ''}"
      data-unit="${material.units || ''}">
      اختيار
    </button>
  </td>
</tr>
      `).join("")}
        </tbody>
      `;

    wrap.append(table);

    table.addEventListener("click", (e) => {

      const button = e.target.closest(".select-material-btn");

      if (!button) return;

      document.querySelector("#materialNumber").value =
        button.dataset.number || "";

      document.querySelector("#materialCode").value =
        button.dataset.code || "";

      document.querySelector("#materialDesc").value =
        button.dataset.desc || "";

      document.querySelector("#unitDesc").value =
        button.dataset.unit || "";


    });


  } catch (error) {
    showError(error);
  }
}


function selectMaterial(
  number,
  code,
  desc,
  unit
) {

  document.querySelector("#materialNumber").value = number;
  document.querySelector("#materialCode").value = code;
  document.querySelector("#materialDesc").value = desc;
  document.querySelector("#unitDesc").value = unit;
}

window.selectMaterial = selectMaterial;
// طھط¹ط¯ظٹظ„ ظ…ط§ط¯ط©

async function editMaterialModal(
  id,
  itemNumber,
  code,
  nameAr,
  quantityDescription,
  units
) {

  try {
    const dialog = document.createElement("dialog");

    dialog.innerHTML = `
<div class="material-modal">

  <h4>تعديل المادة</h4>

  <label>رقم المادة (للقراءة فقط)</label>
  <input
    id="materialNumber"
    type="text"
    value="${itemNumber || ''}"
    readonly
  >

  <label>رمز المادة <span class="required">*</span></label>
  <input
    id="materialCode"
    type="text"
    value="${code || ''}"
    placeholder="أدخل رمز المادة"
  >

  <label>وصف المادة <span class="required">*</span></label>
  <input
    id="materialName"
    type="text"
    value="${nameAr || ''}"
    placeholder="أدخل وصف المادة"
  >

  <label>وصف الكمية (اختياري)</label>
  <input
    id="quantityDescription"
    type="text"
    value="${quantityDescription || ''}"
    placeholder="مثل: 500 غرام"
  >

  <label>الوحدة <span class="required">*</span></label>
  <input
    id="materialUnit"
    type="text"
    value="${units || ''}"
    placeholder="أدخل الوحدة"
  >

  <div class="material-modal-actions">
    <button type="button" id="cancelBtn" class="btn-cancel">
      إلغاء
    </button>

    <button type="button" id="saveBtn" class="btn-save">
      حفظ التعديلات
    </button>
  </div>

</div>
`;

    document.body.appendChild(dialog);

    dialog.showModal();

    const result = await new Promise((resolve) => {

      dialog.querySelector("#cancelBtn").onclick = () => {
        dialog.close();
        resolve(null);
      };

      dialog.querySelector("#saveBtn").onclick = () => {

        resolve({
          itemNumber: dialog.querySelector("#materialNumber").value.trim(),
          code: dialog.querySelector("#materialCode").value.trim(),
          nameAr: dialog.querySelector("#materialName").value.trim(),
          quantityDescription: dialog.querySelector("#quantityDescription").value.trim(),
          units: dialog.querySelector("#materialUnit").value.trim()
        });

        dialog.close();
      };

    });

    dialog.remove();

    if (!result) return;

    const {
      itemNumber: newItemNumber,
      code: newCode,
      nameAr: newNameAr,
      quantityDescription: newQuantityDescription,
      units: newUnits
    } = result;

    // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ط¥ط¬ط¨ط§ط±ظٹط© (ط±ظ‚ظ… ط§ظ„ظ…ط§ط¯ط© ظٹظ…ظƒظ† ط£ظ† ظٹظƒظˆظ† ظ…ظˆط¬ظˆط¯ط§ظ‹ ظ…ظ† ظ‚ط¨ظ„)
    if (!newCode || !newNameAr || !newUnits) {
      alert("يرجى تعبئة جميع الحقول الإجبارية (الرمز، الوصف، الوحدة)");
      return;
    }

    const payload = {
      itemNumber: newItemNumber, // ط§ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط±ظ‚ظ… ط§ظ„ظ…ط§ط¯ط© ط§ظ„ظ…ظˆط¬ظˆط¯
      code: newCode,
      nameAr: newNameAr,
      quantityDescription: newQuantityDescription,
      units: newUnits
    };

    console.log("SENDING UPDATE:", JSON.stringify(payload, null, 2));

    await api.put(`/materials/${id}`, payload);

    setNotice(
      document.querySelector("#pageNotice"),
      "success",
      "تم تحديث المادة بنجاح"
    );

    await loadMaterialsTable();

  } catch (error) {

    console.error(error);
    showError(error);

  }
}

// ط­ط°ظپ ظ…ط§ط¯ط©
async function deleteMaterialConfirm(id) {

  const confirmed = await showDeleteModal();

  if (!confirmed) return;

  try {
    await api.delete(`/requests/materials/${id}`);

    setNotice(
      document.querySelector("#pageNotice"),
      "success",
      "تم حذف المادة بنجاح"
    );

    await loadMaterialsTable();

  } catch (error) {

    showError(error);

  }
}

function showDeleteModal() {
  return new Promise((resolve) => {

    const overlay = document.createElement("div");

    overlay.innerHTML = `
      <div class="custom-modal">
        <div class="custom-modal-box">
          <h3>تأكيد الحذف</h3>
          <p>هل تريد حذف هذه المادة؟</p>

          <div class="custom-modal-actions">
            <button class="cancel-btn">إلغاء</button>
            <button class="delete-btn">حذف</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector(".cancel-btn").onclick = () => {
      overlay.remove();
      resolve(false);
    };

    overlay.querySelector(".delete-btn").onclick = () => {
      overlay.remove();
      resolve(true);
    };
  });
}

async function decideMaterialRequest(id, status, config) {

  console.log("ID =", id);
  console.log("STATUS =", status);


  let note = "";

  if (status === "rejected") {

    const dialog = document.createElement("dialog");

    dialog.innerHTML = `
    <div class="material-modal">

      <h4>رفض الطلب</h4>

      <label>سبب الرفض</label>

      <textarea
        id="rejectReason"
        rows="4"
        placeholder="اكتبي سبب الرفض"></textarea>

        <div
  id="rejectError"
  class="form-error hidden">
  الرجاء كتابة سبب الرفض.
</div>

      <div class="material-modal-actions">

        <button
          type="button"
          id="cancelRejectBtn"
          class="btn-cancel">
          إلغاء
        </button>

        <button
          type="button"
          id="confirmRejectBtn"
          class="btn-danger">
          تأكيد الرفض
        </button>

      </div>

    </div>
  `;

    document.body.appendChild(dialog);

    dialog.showModal();

    note = await new Promise(resolve => {

      document.querySelector("#cancelRejectBtn")
        .addEventListener("click", () => {

          dialog.close();
          dialog.remove();

          resolve(null);

        });

      document.querySelector("#confirmRejectBtn")
        .addEventListener("click", () => {

          const value = document
            .querySelector("#rejectReason")
            .value
            .trim();

          const errorBox =
            document.querySelector("#rejectError");

          if (value.length < 3) {

            errorBox.textContent =
              "الرجاء كتابة سبب الرفض.";

            errorBox.classList.remove("hidden");

            return;
          }

          errorBox.classList.add("hidden");

          dialog.close();
          dialog.remove();

          resolve(value);

        });

    });

    if (!note) {
      return;
    }

  } else {

    note = "تم اعتماد الطلب";

  }
  const payload = {
    status,
    decisionNote: note
  };

  try {

    const result = await api.patch(
      `/requests/material/${id}/decision`,
      payload
    );

    setNotice(
      document.querySelector("#pageNotice"),
      "success",
      result.message
    );

    await loadMaterialRequests(
      config,
      true
    );

  } catch (error) {
    showError(error);
  }
}

// ط¯ط§ظ„ط© ط§ظ„ط¨ط­ط« ط¹ظ† ط§ظ„ط¹ظ‡ط¯ط©

function requestRejectionReason() {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "request-rejection-dialog";
    dialog.innerHTML = `
      <div class="material-modal">
        <h4>رفض الطلب</h4>
        <label for="communityRejectReason">سبب الرفض</label>
        <textarea id="communityRejectReason" rows="4" placeholder="اكتبي سبب الرفض"></textarea>
        <div id="communityRejectError" class="form-error hidden">الرجاء كتابة سبب الرفض.</div>
        <div class="material-modal-actions">
          <button type="button" class="btn-cancel">إلغاء</button>
          <button type="button" class="btn-danger">تأكيد الرفض</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelector(".btn-cancel").addEventListener("click", () => close(null));
    dialog.querySelector(".btn-danger").addEventListener("click", () => {
      const note = dialog.querySelector("#communityRejectReason").value.trim();
      if (note.length < 3) {
        dialog.querySelector("#communityRejectError").classList.remove("hidden");
        return;
      }
      close(note);
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      close(null);
    }, { once: true });
    dialog.showModal();
    dialog.querySelector("#communityRejectReason").focus();
  });
}

async function decideRequest(type, id, status, config, key) {
  if (type === "loan") {
    const decision = await requestLoanDecision(status);
    if (!decision) return;
    try {
      const result = await api.patch(`/requests/loan/${id}/decision`, decision);
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      await loadRequestRows(config, key);
    } catch (error) {
      showError(error);
    }
    return;
  }
  const note = status === "rejected"
    ? await requestRejectionReason()
    : "تم اعتماد الطلب";
  if (!note) return;
  try { const result = await api.patch(`/requests/${type}/${id}/decision`, { status, decisionNote: note.trim() }); setNotice(document.querySelector("#pageNotice"), "success", result.message); await loadRequestRows(config, key); } catch (error) { showError(error); }
}

function requestLoanDecision(status) {
  if (status === "rejected") {
    return requestRejectionReason().then((decisionNote) => decisionNote ? { status, decisionNote } : null);
  }
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <div class="material-modal">
        <h3>اعتماد طلب السلفة</h3>
        <label for="approvedLoanAmount">مبلغ السلفة المعتمد</label>
        <input id="approvedLoanAmount" type="number" min="1" step="0.01" required>
        <label for="loanInstallments">عدد الأقساط</label>
        <input id="loanInstallments" type="number" min="1" max="120" required>
        <label for="loanInstallmentAmount">قيمة القسط</label>
        <input id="loanInstallmentAmount" type="number" min="1" step="0.01" required>
        <label for="firstInstallmentDueDate">تاريخ استحقاق أول قسط</label>
        <input id="firstInstallmentDueDate" type="date" required>
        <div class="material-modal-actions">
          <button type="button" class="btn-cancel">إلغاء</button>
          <button type="button" class="btn-save">اعتماد الطلب</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelector(".btn-cancel").addEventListener("click", () => close(null));
    dialog.querySelector(".btn-save").addEventListener("click", () => {
      const amount = Number(dialog.querySelector("#approvedLoanAmount").value);
      const installments = Number(dialog.querySelector("#loanInstallments").value);
      const installmentAmount = Number(dialog.querySelector("#loanInstallmentAmount").value);
      const firstInstallmentDueDate = dialog.querySelector("#firstInstallmentDueDate").value;
      if (!amount || !installments || !installmentAmount || !firstInstallmentDueDate) return;
      close({ status, decisionNote: "تم اعتماد الطلب", approvedAmount: amount, installments, installmentAmount, firstInstallmentDueDate });
    });
    dialog.showModal();
    dialog.querySelector("#approvedLoanAmount").focus();
  });
}

async function updateLoanTracking(item, action, config, key) {
  try {
    let payload;
    if (action === "disburse") {
      payload = { status: "تم الصرف", disbursedAt: localDate() };
    } else {
      payload = { status: "قيد السداد", paidInstallments: (item.paidInstallments || 0) + 1 };
    }
    await api.patch(`/requests/loan/${item.id}`, payload);
    setNotice(document.querySelector("#pageNotice"), "success", "تم تحديث متابعة السلفة.");
    await loadRequestRows(config, key);
  } catch (error) {
    showError(error);
  }
}

function requestPaidInstallments(currentValue) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <div class="material-modal">
        <h3>تسجيل قسط</h3>
        <label for="paidInstallments">عدد الأقساط المسددة</label>
        <input id="paidInstallments" type="number" min="0" step="1" value="${currentValue}" required>
        <div class="material-modal-actions">
          <button type="button" class="btn-cancel">إلغاء</button>
          <button type="button" class="btn-save">حفظ</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelector(".btn-cancel").addEventListener("click", () => close(null));
    dialog.querySelector(".btn-save").addEventListener("click", () => {
      const value = Number(dialog.querySelector("#paidInstallments").value);
      if (!Number.isInteger(value) || value < 0) return;
      close(value);
    });
    dialog.showModal();
    dialog.querySelector("#paidInstallments").focus();
  });
}

async function renderAssignments() {
  const links = [studentHubLink("assignment-my", "عرض تكليفاتي", "عرض خطابات التكليف المرسلة إلى حسابك")];
  if (has("issue_work_assignments")) {
    links.unshift(studentHubLink("assignment-issue", "إصدار تكليف بالعمل", "إنشاء خطاب رسمي ومعاينته قبل الإرسال"));
  }

  page("تكليف بالعمل", "اختاري الخدمة المطلوبة.", `<nav class="student-services-list" aria-label="خدمات التكليف">${links.join("")}</nav>`);
}

async function renderAssignmentIssue() {
  if (!has("issue_work_assignments")) throw new Error("لا توجد لديك صلاحية لإصدار التكليفات.");

  page("إصدار تكليف بالعمل", "أدخلي البيانات ثم عايني الخطاب قبل إرساله.", `
    <form id="assignmentForm" class="form-grid assignment-entry-form" novalidate>
      <div class="field"><label for="assignee">الموظفة المكلفة</label><select id="assignee" required><option value="">اختاري الموظفة</option></select></div>
      <div class="field"><label for="actingFor">نيابة عن الموظفة (اختياري)</label><select id="actingFor"><option value="">لا يوجد</option></select></div>
      <div class="field"><label for="assignmentType">نوع التكليف</label><input id="assignmentType" required maxlength="100"></div>
      <div class="field"><label for="jobTitle">المسمى المكلفة به</label><input id="jobTitle" required maxlength="100"></div>
      <div class="field"><label for="assignmentLocation">مكان التكليف</label><input id="assignmentLocation" required maxlength="120"></div>
      <div class="field"><label for="issuer">جهة الإصدار</label><input id="issuer" required maxlength="120" value="مديرة المدرسة"></div>
      <div class="field"><label for="startDate">من تاريخ</label><input id="startDate" type="date" required></div>
      <div class="field"><label for="endDate">إلى تاريخ</label><input id="endDate" type="date" required></div>
      <div class="field span-2"><label for="assignmentReason">سبب التكليف</label><input id="assignmentReason" required minlength="3" maxlength="500"></div>
      <fieldset class="assignment-tasks-field span-2">
        <legend>المهام المسندة</legend>
        <div id="assignmentTaskRows"></div>
        <button id="addAssignmentTask" class="btn btn-secondary btn-small" type="button">إضافة مهمة</button>
        <span class="field-hint">مهمة واحدة على الأقل، وبحد أقصى 20 مهمة.</span>
      </fieldset>
      <div class="field span-2"><label for="assignmentNotes">ملاحظات (اختياري)</label><textarea id="assignmentNotes" maxlength="500" rows="2"></textarea></div>
      <div class="form-actions span-2"><button class="btn btn-secondary btn-small" type="submit">معاينة الخطاب</button></div>
    </form>
    <section id="assignmentPreview" class="assignment-preview-wrap hidden" aria-live="polite"></section>
    <div class="subsection">
      <h2>التكليفات المرسلة</h2>
      <div id="assignmentTable" class="table-wrap"><div class="empty-state">جارٍ التحميل...</div></div>
    </div>`);

  const employees = await loadEmployees();
  const assigneeSelect = document.querySelector("#assignee");
  const actingForSelect = document.querySelector("#actingFor");

  if (assigneeSelect) fillSelect(assigneeSelect, employees, (x) => x.authUid ?? x.id, (x) => x.nameAr, "اختاري الموظفة");
  if (actingForSelect) fillSelect(actingForSelect, employees, (x) => x.authUid ?? x.id, (x) => x.nameAr, "لا يوجد");

  addAssignmentTaskRow();
  document.querySelector("#addAssignmentTask")?.addEventListener("click", () => addAssignmentTaskRow());
  document.querySelector("#assignmentForm")?.addEventListener("submit", previewAssignment);
  await loadAssignments(true);
} function assignmentFormData() {
  const tasks = [...document.querySelectorAll(".assignment-task-input")].map((input) => input.value.trim()).filter(Boolean);
  return { assignmentType: value("assignmentType"), assigneeUid: value("assignee"), actingForUid: value("actingFor"), jobTitle: value("jobTitle"), tasks, startDate: value("startDate"), endDate: value("endDate"), reason: value("assignmentReason"), location: value("assignmentLocation"), notes: value("assignmentNotes"), issuer: value("issuer") };
}

function addAssignmentTaskRow(task = "") {
  const rows = document.querySelector("#assignmentTaskRows");
  if (!rows || rows.children.length >= 20) return;
  const row = document.createElement("div"); row.className = "assignment-task-row";
  const input = document.createElement("input"); input.type = "text"; input.className = "assignment-task-input"; input.required = true; input.minLength = 3; input.maxLength = 300; input.placeholder = "اكتبي المهمة المسندة"; input.value = task;
  const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn btn-secondary btn-small"; remove.textContent = "حذف";
  remove.addEventListener("click", () => { if (rows.children.length > 1) row.remove(); else { input.value = ""; input.focus(); } });
  row.append(input, remove); rows.append(row);
}

function buildOfficialAssignmentLetter(item, { preview = false } = {}) {
  const article = document.createElement("article");
  article.className = `assignment-letter${preview ? "" : " assignment-letter-record"}`;

  const printHeader = document.createElement("div");
  printHeader.className = "assignment-print-header";
  const logo = document.createElement("img");
  logo.src = "assets/images/logocopy.png";
  logo.alt = "مدارس النبلاء المتقدمة";
  const schoolName = document.createElement("span");
  schoolName.textContent = "Nobles Advanced school";
  printHeader.append(logo, schoolName);
  article.append(printHeader);

  const header = document.createElement("header"); header.className = "assignment-letter-header";
  const authority = document.createElement("p"); authority.textContent = "إدارة التعليم بمنطقة المدينة المنورة";
  const school = document.createElement("p"); school.textContent = "مدارس النبلاء المتقدمة";
  header.append(authority, school);

  const title = document.createElement("h2"); title.textContent = "تكليف";
  const meta = document.createElement("div"); meta.className = "assignment-letter-meta";
  const number = document.createElement("span"); number.textContent = `رقم الخطاب: ${item.assignmentNumber ?? (preview ? "يُنشأ بعد الإرسال" : "—")} `;
  const issueDate = document.createElement("span"); issueDate.textContent = `تاريخ الإصدار: ${item.issueDate ?? new Date().toLocaleDateString("ar-SA")} `;
  meta.append(number, issueDate);

  const recipient = document.createElement("p"); recipient.className = "assignment-letter-recipient";
  recipient.textContent = `تُكلَّف الموظفة / ${item.assigneeName ?? "—"}، الرقم الوظيفي / ${item.assigneeEmployeeNumber ?? "—"} `;
  const body = document.createElement("p"); body.className = "assignment-letter-body";
  body.textContent = `بناءً على مقتضيات العمل، تُكلَّف بالعمل بمسمى «${item.jobTitle}»${item.actingForName ? ` نيابةً عن الموظفة/ ${item.actingForName}` : ""}، في ${item.location}، خلال الفترة من ${item.startDate} إلى ${item.endDate}، وذلك بسبب: ${item.reason}.`;
  const responsibility = document.createElement("p"); responsibility.className = "assignment-letter-body";
  responsibility.textContent = "وتُمنح الصلاحيات اللازمة في حدود مهام التكليف، وتكون مسؤولة عن تنفيذ الأعمال المسندة إليها خلال مدة التكليف.";
  const acceptance = document.createElement("p"); acceptance.className = "assignment-letter-acceptance";
  acceptance.textContent = "قبلتُ التكليف، ومستعدة للتنفيذ";

  article.append(header, title, meta, recipient, body);
  if (Array.isArray(item.tasks) && item.tasks.length) {
    const tasksTitle = document.createElement("h3"); tasksTitle.className = "assignment-letter-tasks-title"; tasksTitle.textContent = "المهام المسندة:";
    const tasksList = document.createElement("ol"); tasksList.className = "assignment-letter-tasks";
    item.tasks.forEach((task) => { const entry = document.createElement("li"); entry.textContent = task; tasksList.append(entry); });
    article.append(tasksTitle, tasksList);
  }
  article.append(responsibility);
  if (item.notes) { const notes = document.createElement("p"); notes.className = "assignment-letter-notes"; notes.textContent = `ملاحظات: ${item.notes} `; article.append(notes); }
  article.append(acceptance);

  const signatures = document.createElement("footer"); signatures.className = "assignment-letter-signatures";
  const employeeSignature = document.createElement("div");
  const employeeLabel = document.createElement("strong"); employeeLabel.textContent = "إقرار الموظفة المكلفة";
  const employeeStatus = document.createElement("span");
  employeeStatus.textContent = item.acknowledgedAt ? `تم الإقرار إلكترونيًا: ${formatDate(item.acknowledgedAt)} ` : "التوقيع: __________________";
  employeeSignature.append(employeeLabel, employeeStatus);
  const managerSignature = document.createElement("div");
  const managerLabel = document.createElement("strong"); managerLabel.textContent = item.issuer ?? "مديرة المدرسة";
  const managerLine = document.createElement("span"); managerLine.textContent = "الاسم والتوقيع: __________________";
  managerSignature.append(managerLabel, managerLine);
  signatures.append(employeeSignature, managerSignature); article.append(signatures);
  return article;
}

function previewAssignment(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity())
    return;
  const data = assignmentFormData();
  if (!data.tasks.length) return setNotice(document.querySelector("#pageNotice"), "error", "أضيفي مهمة واحدة على الأقل قبل المعاينة.");
  if (data.endDate < data.startDate) return setNotice(document.querySelector("#pageNotice"), "error", "تاريخ نهاية التكليف يجب ألا يسبق تاريخ البداية.");
  if (data.actingForUid && data.actingForUid === data.assigneeUid) return setNotice(document.querySelector("#pageNotice"), "error", "لا يمكن تكليف الموظفة بالنيابة عن نفسها.");
  const assignee = state.employees.find((x) => (x.authUid ?? x.id) === data.assigneeUid);
  const actingFor = state.employees.find((x) => (x.authUid ?? x.id) === data.actingForUid);
  state.assignmentPreview = data;
  const wrap = document.querySelector("#assignmentPreview");
  if (!wrap) return setNotice(document.querySelector("#pageNotice"), "error", "تعذر فتح معاينة التكليف في هذه الصفحة.");
  wrap.replaceChildren(); wrap.classList.remove("hidden");
  const letter = buildOfficialAssignmentLetter({ ...data, assigneeName: assignee?.nameAr, assigneeEmployeeNumber: assignee?.employeeNumber, actingForName: actingFor?.nameAr }, { preview: true });
  const actions = document.createElement("div"); actions.className = "form-actions no-print";
  const edit = document.createElement("button"); edit.type = "button"; edit.className = "btn btn-secondary btn-small"; edit.textContent = "تعديل البيانات"; edit.addEventListener("click", () => { wrap.classList.add("hidden"); document.querySelector("#assignmentForm").scrollIntoView({ behavior: "smooth" }); });
  const send = document.createElement("button"); send.type = "button"; send.id = "confirmAssignment"; send.className = "btn btn-small"; send.textContent = "تأكيد وإرسال"; send.addEventListener("click", sendAssignment);
  actions.append(edit, send); wrap.append(letter, actions); wrap.scrollIntoView({ behavior: "smooth" });
}

async function sendAssignment() {
  const button = document.querySelector("#confirmAssignment");
  if (!state.assignmentPreview || !button) return;
  await submitSafely(button, async () => {
    try {
      const result = await api.post("/requests/assignments", state.assignmentPreview);
      setNotice(document.querySelector("#pageNotice"), "success", result.message + " وسيظهر الخطاب في حساب الموظفة.");
      state.assignmentPreview = null;
      document.querySelector("#assignmentForm")?.reset();
      document.querySelector("#assignmentPreview")?.classList.add("hidden");
      await loadAssignments(true);
    } catch (error) {
      showError(error);
    }
  });
}

async function renderMyAssignments() {
  page("عرض تكليفاتي", "خطابات التكليف الرسمية المرسلة إلى حسابك.", `<div id="assignmentLetters"><div class="empty-state">جارٍ التحميل...</div></div>`);
  await loadAssignments(false);
}

function renderAssignmentLetter(item, canAcknowledge) {
  const article = buildOfficialAssignmentLetter(item);
  const actions = document.createElement("div"); actions.className = "form-actions no-print";
  const print = document.createElement("button"); print.type = "button"; print.className = "btn btn-secondary btn-small"; print.textContent = "طباعة"; print.addEventListener("click", () => printAssignmentLetter(article, print));
  const savePdf = document.createElement("button"); savePdf.type = "button"; savePdf.className = "btn btn-secondary btn-small"; savePdf.textContent = "حفظ PDF"; savePdf.addEventListener("click", () => printAssignmentLetter(article, savePdf));
  actions.append(print, savePdf);
  if (canAcknowledge && !item.acknowledgedAt) {
    const ack = document.createElement("button"); ack.type = "button"; ack.className = "btn btn-small"; ack.textContent = "اطلعت على التكليف"; ack.addEventListener("click", async () => {
      try {
        const result = await api.patch(`/requests/assignments/${item.id}/acknowledge`, {}); setNotice(document.querySelector("#pageNotice"), "success", result.message); await loadAssignments(false);
      } catch (error) { showError(error); }
    }); actions.append(ack);
  }
  else if (canAcknowledge) { const status = document.createElement("span"); status.className = "assignment-status"; status.textContent = "تم الاطلاع"; actions.append(status); }
  article.append(actions); return article;
}

async function printAssignmentLetter(article, button) {
  if (!article || button.disabled) return;
  document.body.classList.add("printing-assignment");
  const logo = article.querySelector(".assignment-print-header img");
  try {
    if (logo && !logo.complete) await logo.decode();
  } catch {
    // Continue printing even if the optional logo cannot be decoded.
  }
  await printPortalPage(button);
  document.body.classList.remove("printing-assignment");
}

async function loadAssignments(managerView) { try { const rows = (await api.get(`/requests/assignments?scope=${managerView ? "all" : "mine"}`)).data; if (managerView) { renderSimpleTable("#assignmentTable", ["رقم الخطاب", "الموظفة", "التكليف", "المدة", "الحالة"], rows, (x) => [x.assignmentNumber ?? "—", x.assigneeName, x.jobTitle, `${x.startDate} - ${x.endDate}`, x.acknowledgedAt ? "تم الاطلاع" : "تم الإرسال"]); return; } const wrap = document.querySelector("#assignmentLetters"); wrap.replaceChildren(); if (!rows.length) { const empty = document.createElement("div"); empty.className = "empty-state"; empty.textContent = "لا توجد تكليفات مرسلة إليكِ حتى الآن."; wrap.append(empty); return; } rows.forEach((item) => wrap.append(renderAssignmentLetter(item, true))); } catch (error) { showError(error); } }

async function renderApprovals() {
  if (!hasRole("system_admin", "principal", "vice_principal", "admin", "upper_management")) {
    throw new Error("لوحة الإحصائيات متاحة لكِ وللإدارة فقط.");
  }
  page("لوحة إحصائيات الطلبات", "اختاري الموظفة لعرض ملخص طلباتها وتنبيهاتها.", `<div class="approval-filter"><div class="field"><label for="approvalEmployee">اسم الموظفة</label><select id="approvalEmployee"><option value="">اختاري الموظفة</option></select></div></div><div id="approvalStats" class="approval-dashboard hidden"></div>`);
  try {
    const rows = (await api.get("/requests/statistics")).data;
    const employeeSelect = document.querySelector("#approvalEmployee");
    fillSelect(employeeSelect, rows, (item) => item.employeeUid, (item) => `${item.employeeName} - ${item.employeeNumber}`, "اختاري الموظفة");
    const dashboard = document.querySelector("#approvalStats");
    const draw = (item) => {
      dashboard.classList.toggle("hidden", !item);
      if (!item) return;
      const leave = item.byType.leave ?? 0;
      const permission = item.byType.permission ?? 0;
      const absence = item.byType.absence ?? 0;
      const other = Object.entries(item.byType).filter(([type]) => !["leave", "permission", "absence"].includes(type)).reduce((sum, [, count]) => sum + count, 0);
      const total = leave + permission + absence + other;
      const typeParts = [["إجازات", leave, "#74b894"], ["استئذان", permission, "#a8d8bd"], ["غياب", absence, "#4d9a78"], ["طلبات أخرى", other, "#d5eadc"]];
      const statusParts = [["قيد المراجعة", item.pending, "#74b894"], ["المعتمد", item.approved, "#4d9a78"], ["المرفوض", item.rejected, "#8fc9a9"], ["غير مصنف", Math.max(total - item.pending - item.approved - item.rejected, 0), "#dceee3"]];
      const gradient = (parts) => { let start = 0; return parts.map(([, value, color]) => { const end = total ? start + (value / total) * 360 : start; const segment = `${color} ${start}deg ${end}deg`; start = end; return segment; }).join(", "); };
      const legend = (parts) => parts.map(([label, value, color]) => `<li><span class="chart-key" style="background:${color}"></span><span>${label}</span><strong>${value}</strong></li>`).join("");
      dashboard.innerHTML = `<div class="approval-cards"><div class="approval-card"><span class="approval-card-icon">◉</span><span>إجمالي الطلبات</span><strong>${item.total}</strong><small>طلب</small></div><div class="approval-card"><span class="approval-card-icon">✓</span><span>الإجازات</span><strong>${leave}</strong><small>طلب</small></div><div class="approval-card"><span class="approval-card-icon">◷</span><span>الغياب</span><strong>${absence}</strong><small>طلب</small></div><div class="approval-card"><span class="approval-card-icon">•••</span><span>طلبات أخرى</span><strong>${other}</strong><small>طلب</small></div><div class="approval-card"><span class="approval-card-icon">⌛</span><span>قيد المراجعة</span><strong>${item.pending}</strong><small>طلب</small></div></div><section class="approval-table-section"><h2>تفصيل الطلبات حسب الموظفة</h2><div class="stats-dashboard"><table><thead><tr><th>الموظفة</th><th>الإجمالي</th><th>الإجازات</th><th>الاستئذان</th><th>الغياب</th><th>طلبات أخرى</th><th>قيد المراجعة</th><th>المعتمد</th><th>المرفوض</th><th>مقروء</th><th>غير مقروء</th></tr></thead><tbody><tr>${[item.employeeName, item.total, leave, permission, absence, other, item.pending, item.approved, item.rejected, item.read, item.unread].map((value) => `<td>${value}</td>`).join("")}</tr></tbody></table></div></section><div class="approval-charts"><section class="approval-chart"><h2>نوع الطلب</h2><div class="donut-chart" style="background:conic-gradient(${gradient(typeParts)})"><span><strong>${total}</strong><small>الإجمالي</small></span></div><ul>${legend(typeParts)}</ul></section><section class="approval-chart"><h2>حالة الطلبات</h2><div class="donut-chart" style="background:conic-gradient(${gradient(statusParts)})"><span><strong>${total}</strong><small>الإجمالي</small></span></div><ul>${legend(statusParts)}</ul></section></div>`;
    };
    employeeSelect.addEventListener("change", () => draw(rows.find((item) => item.employeeUid === employeeSelect.value)));
  } catch (error) { showError(error); }
}

function renderEmployeeData() {
  const links = [
    studentHubLink(
      "employee-data-view",
      "عرض بياناتي الوظيفية",
      "عرض البيانات الوظيفية المرتبطة بحسابك فقط"
    )
  ];
  if (hasRole("system_admin", "principal", "admin") && has("manage_employees")) {
    links.push(
      studentHubLink(
        "employee-add",
        "إضافة موظفة وإدخال بياناتها",
        "إنشاء ملف موظفة جديد وربطه بحسابها"
      )
    );
  }
  page("بيانات الموظفة", "اختاري الخدمة المطلوبة.", `
    <nav class="student-services-list" aria-label="خدمات بيانات الموظفة">
      ${links.join("")}
    </nav>
  `);
}

function renderEmployeeDataView() {
  const employee = state.me?.employee;
  if (!employee) throw new Error("تعذر تحميل بيانات الموظفة المرتبطة بالحساب.");
  page("عرض بياناتي الوظيفية", "بيانات وظيفية مرتبطة بحسابك فقط.", `
    <div id="ownEmployeeProfile"></div>
  `);
  drawEmployeeProfile("#ownEmployeeProfile", employee, state.me.email);
}

function drawEmployeeProfile(selector, employee, accountEmail = "") {
  const wrap = document.querySelector(selector);
  if (!wrap) return;
  const employmentTypes = { full_time: "دوام كامل", part_time: "دوام جزئي", contract: "عقد" };
  const employmentStatuses = { active: "على رأس العمل", on_leave: "في إجازة", suspended: "موقوفة", terminated: "منتهية الخدمة" };
  const fields = [
    ["الاسم باللغة العربية", employee.nameAr],
    ["الاسم باللغة الإنجليزية", employee.nameEn, "ltr"],
    ["رقم الهوية الوطنية", employee.nationalId, "ltr"],
    ["الرقم الوظيفي", employee.employeeNumber, "ltr"],
    ["المسمى الوظيفي", labels.role[employee.role] ?? employee.role],
    ["القسم", employee.department],
    ["البريد الإلكتروني الرسمي", accountEmail || employee.email, "ltr"],
    ["رقم الجوال", employee.phone, "ltr"],
    ["تاريخ المباشرة", employee.hireDate, "ltr"],
    ["نوع العقد", employmentTypes[employee.employmentType] ?? employee.employmentType],
    ["الحالة الوظيفية", employmentStatuses[employee.employmentStatus] ?? employee.employmentStatus],
    ["المؤهل العلمي", employee.qualification],
    ["التخصص", employee.specialization]
  ];
  const list = document.createElement("dl");
  list.className = "employee-profile-lines";
  list.setAttribute("aria-label", "البيانات الوظيفية");
  fields.forEach(([title, fieldValue, direction]) => {
    const row = document.createElement("div");
    row.className = "employee-profile-line";
    const term = document.createElement("dt");
    term.textContent = title;
    const description = document.createElement("dd");
    description.textContent = fieldValue || "غير مسجل";
    if (direction) description.dir = direction;
    row.append(term, description);
    list.append(row);
  });
  wrap.replaceChildren(list);
}

function renderPerformance() {
  page("الأداء الوظيفي", "عرض بيانات الأداء الوظيفي المرتبطة بحسابك.", `
    <div class="empty-state">لا توجد بيانات أداء وظيفي متاحة حاليًا.</div>
  `);
}


function renderCertificateLetter(item) {

  const article = document.createElement("article");

  article.className = "official-letter page-card";

  const title =
    item.type === "salary"
      ? "شهادة تعريف بالراتب"
      : "شهادة تعريف موظف على رأس العمل";

  article.innerHTML = `
<div class="letter-header">
 
    <div class="letter-logos">
 
        <div class="moe-logo">
            <img src="assets/images/moe-logo.png" alt="شعار وزارة التعليم">
        </div>
 
        <div class="school-logo">
            <img src="assets/images/logo3.png" alt="شعار مدارس النبلاء المتقدمة">
        </div>
 
    </div>
 
<h2 class="certificate-title">
        ${item.type === "salary"
      ? "تعريف بالراتب"
      : "تعريف موظف على رأس العمل"
    }
    </h2>
 
 
 
    <table class="certificate-table">
 
        <tr>
            <th>الاسم</th>
            <td>${item.employeeName ?? "—"}</td>
 
            <th>رقم الخطاب</th>
            <td>${item.letterNumber ?? "—"}</td>
        </tr>
 
        <tr>
            <th>الرقم الوظيفي</th>
            <td>${item.employeeNumber ?? "—"}</td>
 
            <th>تاريخ الإصدار</th>
            <td>${item.issueDate ?? "—"}</td>
        </tr>
 
        <tr>
            <th>المسمى الوظيفي</th>
            <td>${item.roleLabel ?? "—"}</td>
 
            <th>جهة العمل</th>
            <td>مدارس النبلاء المتقدمة</td>
        </tr>
 
        <tr>
            <th>الحالة الوظيفية</th>
            <td colspan="3">
                على رأس العمل
            </td>
        </tr>
 
    </table>
 
</div>
  
 
 
    <div class="letter-content">
 
      <p>السلام عليكم ورحمة الله وبركاته</p>
 
      <p><strong>إلى من يهمه الأمر</strong></p>
 
      <p>
        تشهد مدارس النبلاء المتقدمة بأن الموظفة الموضحة بياناتها أعلاه
        تعمل لديها حتى تاريخ إصدار هذه الشهادة.
      </p>
 
      <p>
        وقد أعطيت هذه الشهادة بناءً على طلبها دون أدنى مسؤولية
        على جهة الإصدار إلا فيما ورد أعلاه.
      </p>
 
      <p>
        وتقبلوا خالص التحية والتقدير.
      </p>
 
    </div>
 
    <div class="letter-footer">
 
      <div class="signature-box">
        <span>الختم الرسمي</span>
      </div>
 
      <div class="signature-box">
        <span>التوقيع</span>
      </div>
 
      <div class="signature-box">
        <span>مديرة المدرسة</span>
      </div>
 
    </div>
 
    <div class="print-actions">
 
      <button
        class="btn print-letter"
        type="button"
      >
        طباعة الخطاب
      </button>
 
    </div>
 
  `;

  article
    .querySelector(".print-letter")
    .addEventListener(
      "click",
      (event) => printPortalPage(event.currentTarget)
    );

  return article;
}


async function renderAdministrativeForms() {

  const isSystemAdmin = hasRole("system_admin");
  const hash = window.location.hash;

  const renderOnlySection = (title, description, contentBuilder) => {
    page(
      title,
      description,
      `
    <section id="formsContent" class="subsection" aria-live="polite">
      <div class="empty-state">
        جارٍ تحميل النماذج...
      </div>
    </section>
  `
    );

    const area = document.querySelector("#formsContent");
    if (area) contentBuilder(area);
  };


  const renderSection = (currentHash) => {

    const rows = state.certificates ?? [];

    if (currentHash === "#forms-my-requests") {

      renderOnlySection(
        "سجل طلباتي",
        "متابعة حالة طلبات الخطابات.",

        (area) => {

          const requests = JSON.parse(
            localStorage.getItem("certificateRequests") || "[]"
          );

          if (!requests.length) {

            area.innerHTML = `
    <div class="empty-state" >
      لا توجد طلبات حتى الآن.
          </div >
    `;
            area
              .querySelectorAll('[data-action="view-letter"]')
              .forEach((button) => {

                button.addEventListener("click", () => {

                  const request = requests.find(
                    item =>
                      item.id === Number(button.dataset.id)
                  );

                  if (!request) return;

                  area.innerHTML = "";

                  area.append(
                    renderCertificateLetter(request)
                  );

                });

              });


            return;
          }

          area.innerHTML = `
    <div class="table-wrap" >
 
      <table>
 
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>نوع الخطاب</th>
            <th>رقم الخطاب</th>
            <th>التاريخ</th>
            <th>الحالة</th>
            <th>سبب الرفض</th>
            <th>الإجراء</th>
          </tr>
        </thead>
 
        <tbody>
 
          ${requests.map(item => `
<tr>
  <td>${item.id}</td>
 
  <td>${item.type}</td>
 
  <td>${item.letterNumber ?? "-"}</td>
 
  <td>${item.date}</td>
 
  <td>${item.status}</td>
 
  <td>${item.rejectionReason ?? "-"}</td>
 
  <td>
    ${item.status === "معتمد"
              ? `
          <button
            class="btn btn-small"
            data-id="${item.id}"
            data-action="view-letter">
            عرض الخطاب
          </button>
        `
              : "-"
            }
  </td>
</tr>
`).join("")}
 
        </tbody>
 
      </table>
 
        </div >
    `;


          area
            .querySelectorAll('[data-action="view-letter"]')
            .forEach((button) => {

              button.addEventListener("click", () => {

                const request = requests.find(
                  item =>
                    item.id === Number(button.dataset.id)
                );

                if (!request) return;

                area.innerHTML = "";

                area.append(
                  renderCertificateLetter(request)
                );

              });

            });

        }
      );

      return;
    }

    if (currentHash === "#forms-management" && isSystemAdmin) {

      renderOnlySection(
        "طلبات الخطابات",
        "اعتماد أو رفض طلبات الخطابات.",

        (area) => {

          const requests = JSON.parse(
            localStorage.getItem("certificateRequests") || "[]"
          );

          area.innerHTML = `
    <div class="table-wrap" >
 
      <table>
 
        <thead>
          <tr>
            <th>رقم الطلب</th>
            <th>الموظفة</th>
            <th>نوع الخطاب</th>
            <th>رقم الخطاب</th>
            <th>التاريخ</th>
            <th>الحالة</th>
            <th>سبب الرفض</th>
            <th>تاريخ القرار</th>
            <th>بواسطة</th>
            <th>الإجراء</th>
 
          </tr>
        </thead>
 
        <tbody>
 
          ${requests.map(item => `
<tr>
  <td>${item.id}</td>
  <td>${item.employeeName}</td>
  <td>${item.type}</td>
  <td>${item.letterNumber ?? "-"}</td>
  <td>${item.date}</td>
 
  <td>${item.status}</td>
 
  <td>${item.rejectionReason ?? "-"}</td>
 
  <td>${item.decisionDate ?? "-"}</td>
 
  <td>${item.decisionBy ?? "-"}</td>
 
  <td>
 
<div id="actions-${item.id}">
 
${item.status === "قيد المراجعة"
              ? `
  <button
    class="btn btn-small"
    data-id="${item.id}"
    data-action="approve">
    إصدار الخطاب
  </button>
<div
  id="issue-box-${item.id}"
  style="display:none;margin-top:8px;">
 
  <input
    id="letter-number-${item.id}"
    type="text"
    placeholder="رقم الخطاب">
 
  <br><br>
 
  <button
    class="btn btn-small"
    data-id="${item.id}"
    data-action="save-issue">
    حفظ وإصدار
  </button>
 
  <button
    class="btn"
    data-id="${item.id}"
    data-action="cancel-issue">
    رجوع
  </button>
 
</div>
 
  <button
    class="btn btn-danger btn-small"
    data-id="${item.id}"
    data-action="reject">
    رفض
  </button>
 
  <div
    id="reject-box-${item.id}"
    style="display:none;margin-top:8px;">
 
    <textarea
      id="reject-reason-${item.id}"
      placeholder="اكتبي سبب الرفض"
      rows="3"></textarea>
 
    <br>
 
    <button
      class="btn btn-danger"
      data-id="${item.id}"
      data-action="save-reject">
      حفظ الرفض
    </button>
 
    <button
      class="btn"
      data-id="${item.id}"
      data-action="cancel-reject">
      رجوع
    </button>
 
  </div>
`
              : item.status === "معتمد"
                ? `
 <button
  class="btn btn-small"
  data-id="${item.id}"
  data-action="view-letter">
  عرض الخطاب
</button>
`
                : `
  <span style="color:#c62828;font-weight:bold;">
    تم رفض الطلب
  </span>
`
            }
 
</div>
</td>
 
  </tr>
`).join("")}
 
        </tbody>
 
      </table>
 
        </div >
    `;


        }
      );


      document.querySelectorAll("[data-action]").forEach((button) => {

        button.addEventListener("click", () => {

          console.log(button.dataset.action);

          console.log("action =", button.dataset.action);
          const requests = JSON.parse(
            localStorage.getItem("certificateRequests") || "[]"
          );

          const id = Number(button.dataset.id);

          const request = requests.find(
            item => item.id === id
          );

          if (!request) return;

          if (button.dataset.action === "view-letter") {

            renderOnlySection(
              "عرض الخطاب",
              "الخطاب الرسمي",

              (area) => {

                area.innerHTML = "";

                area.append(
                  renderCertificateLetter(request)
                );

              }
            );

            return;
          }

          if (button.dataset.action === "save-reject") {

            const reasonInput =
              document.querySelector(
                `#reject-reason-${button.dataset.id}`);


            const reason =
              reasonInput?.value?.trim();




            if (!reason) {
              return;
            }

            request.status = "مرفوض";

            request.rejectionReason = reason;
            request.decisionDate =
              new Date().toLocaleDateString("ar-SA");

            request.decisionBy =
              "مسؤولة النظام";

            localStorage.setItem(
              "certificateRequests",
              JSON.stringify(requests)
            );

            renderSection("#forms-management");

            return;
          }

          if (button.dataset.action === "reject") {
            const rejectBox =
              document.querySelector(
                `#reject-box-${button.dataset.id}`
                  ``);

            if (rejectBox) {
              rejectBox.style.display = "block";
            }

            return;
          }


          if (button.dataset.action === "approve") {


            const issueBox =
              document.querySelector(
                `#issue-box-${button.dataset.id}`
              );

            if (issueBox) {
              issueBox.style.display = "block";
            }

            return;
          }

          if (button.dataset.action === "save-issue") {

            const letterInput =
              document.querySelector(
                `#letter-number-${button.dataset.id}`);

            const letterNumber =
              letterInput?.value?.trim();

            if (!letterNumber) {
              return;
            }

            request.status = "معتمد";

            request.letterNumber =
              letterNumber;

            request.issueDate =
              new Date().toLocaleDateString("ar-SA");

            request.decisionDate =
              new Date().toLocaleDateString("ar-SA");

            request.decisionBy =
              "مسؤولة النظام";

            localStorage.setItem(
              "certificateRequests",
              JSON.stringify(requests)
            );

            renderSection("#forms-management");

            return;
          }

          if (button.dataset.action === "cancel-issue") {

            const issueBox =
              document.querySelector(
                `#issue - box - ${button.dataset.id} `
              );

            if (issueBox) {
              issueBox.style.display = "none";
            }

            return;
          }
          localStorage.setItem(
            "certificateRequests",
            JSON.stringify(requests)
          );

          renderSection("#forms-management");

        });

      });


      return;
    }


    if (
      currentHash === "#forms-salary" ||
      currentHash === "#forms-employment"
    ) {

      renderOnlySection(
        currentHash === "#forms-salary"
          ? "طلب تعريف راتب"
          : "طلب تعريف موظف على رأس العمل",

        "مراجعة البيانات قبل إرسال الطلب.",

        (area) => renderCertificateRequestForm(
          area,
          currentHash === "#forms-salary"
            ? "salary"
            : "employment"
        )
      );

      return;
    }


    const type = currentHash === "#forms-employment"
      ? "employment"
      : "salary";


    const title = type === "employment"
      ? "تعريف موظف على رأس العمل"
      : "تعريف راتب";


    const matches = rows.filter((x) => x.type === type);


    renderOnlySection(
      title,
      "عرض النموذج المعتمد.",
      (area) => {

        if (!matches.length) {
          area.innerHTML = `
    <div class="empty-state" >
      لا يوجد نموذج متاح حاليًا.
            </div >
    `;
          return;
        }


        matches.forEach((item) => {
          area.append(renderCertificateLetter(item));
        });

      }
    );
  };


  // ط¹ط±ط¶ طµظپط­ط© ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ط±ط¦ظٹط³ظٹط© ظپظ‚ط·
  if (!hash || !hash.startsWith("#forms-")) {

    const links = [
      studentHubLink(
        "forms-salary",
        "طلب تعريف راتب",
        "إرسال طلب خطاب تعريف راتب"
      ),

      studentHubLink(
        "forms-employment",
        "طلب تعريف موظف على رأس العمل",
        "إرسال طلب خطاب على رأس العمل"
      ),

      studentHubLink(
        "forms-my-requests",
        "سجل طلباتي",
        "متابعة حالة طلبات الخطابات"
      )
    ];

    if (isSystemAdmin) {
      links.push(
        studentHubLink(
          "forms-management",
          "طلبات الخطابات",
          "اعتماد أو رفض طلبات الخطابات"
        )
      );
    }

    page(
      "النماذج",
      "النماذج الإدارية المعتمدة للموظفة.",
      `
    <nav class="student-services-list" aria-label="روابط النماذج">
      ${links.join("")}
    </nav>
 
    <section id="formsContent" class="subsection" aria-live="polite">
      <div class="empty-state">
        اختاري نوع النموذج.
      </div>
    </section>
  `
    );
  }


  try {

    state.certificates =
      (await api.get("/requests/certificates")).data;


    if (isSystemAdmin && !state.employees) {
      state.employees =
        (await api.get("/employees?limit=200")).data;
    }

  } catch (error) {

    showError(error);
    return;

  }


  // ط¥ط°ط§ ظپطھط­ ط§ظ„ظ…ط³طھط®ط¯ظ… ظ†ظ…ظˆط°ط¬ ظ…ط¹ظٹظ†
  if (window.location.hash.startsWith("#forms-")) {
    renderSection(window.location.hash);
  }

}

function renderCertificateRequestForm(area, type) {

  const employee = state.me?.employee;

  const today = new Date();

  const dayName = today.toLocaleDateString("ar-SA", {
    weekday: "long"
  });

  area.innerHTML = `
    <div class="form-grid" >
 
      <div class="field">
        <label>اسم الموظفة</label>
        <input value="${employee?.nameAr ?? ""}" readonly>
      </div>
 
      <div class="field">
        <label>الرقم الوظيفي</label>
        <input value="${employee?.employeeNumber ?? ""}" readonly>
      </div>
 
      <div class="field">
        <label>المسمى الوظيفي</label>
        <input value="${employee?.role ?? ""}" readonly>
      </div>
 
 
      <div class="field">
        <label>التاريخ</label>
        <input value="${today.toLocaleDateString('ar-SA')}" readonly>
      </div>
 
      <div class="field">
        <label>اليوم</label>
        <input value="${dayName}" readonly>
      </div>
 
      <div class="form-actions span-2">
<button id="requestCertificateBtn" class="btn" type="button">
          ${type === "salary"
      ? "طلب خطاب تعريف راتب"
      : "طلب خطاب على رأس العمل"}
        </button>
      </div>
 
    </div >
    `;


  document.querySelector("#requestCertificateBtn")
    ?.addEventListener("click", () => {

      const requests = JSON.parse(
        localStorage.getItem("certificateRequests") || "[]"
      );

      console.log(
        "employee",
        state.me.employee
      );
      requests.push({
        id: Date.now(),

        employeeName: state.me.employee.nameAr,

        employeeNumber:
          state.me.employee.employeeNumber,

        role:
          state.me.employee.role,

        roleLabel:
          labels.role[state.me.employee.role]
          ?? state.me.employee.role,

        type:
          type === "salary"
            ? "تعريف راتب"
            : "تعريف موظف على رأس العمل",

        date:
          new Date().toLocaleDateString("ar-SA"),

        status:
          "قيد المراجعة"
      });

      localStorage.setItem(
        "certificateRequests",
        JSON.stringify(requests)
      );

      setNotice(
        document.querySelector("#pageNotice"),
        "success",
        "تم إرسال الطلب بنجاح."
      );

    });


}

function renderCertificateManager(area) {
  if (!state.employees) state.employees = [];
  const employeeOptions = state.employees
    .filter(e => e.authUid && e.authUid.trim())
    .map((e) =>
      `< option value = "${String(e.authUid).replaceAll('"', ' & quot; ')}">
       ${String(e.nameAr)}
     </option > `
    )
    .join("");
  area.innerHTML = `< form id = "certificateForm" class="form-grid" novalidate >
    <div class="field"><label for="certificateType">نوع الخطاب</label><select id="certificateType" required><option value="salary">تعريف راتب</option><option value="employment">تعريف موظف على رأس العمل</option></select></div>
    <div class="field"><label for="certificateEmployee">الموظفة</label><select id="certificateEmployee" required><option value="">اختاري الموظفة</option>${employeeOptions}</select></div>
    <div class="field"><label for="certificateJobTitle">المسمى الوظيفي</label><input id="certificateJobTitle" maxlength="120" required></div>
    <div class="field" id="salaryField"><label for="certificateSalary">الراتب الشهري</label><input id="certificateSalary" type="number" min="0" max="1000000" step="0.01"></div>
    <div class="field"><label for="certificateIssuer">جهة الإصدار</label><input id="certificateIssuer" value="إدارة المدرسة" maxlength="160" required></div>
    <div class="field span-2"><label for="certificateNotes">ملاحظات (اختياري)</label><textarea id="certificateNotes" maxlength="1000"></textarea></div>
    <div class="form-actions span-2"><button class="btn" type="submit">إضافة الخطاب</button></div>
  </form > `;
  const type = document.querySelector("#certificateType");
  const salaryField = document.querySelector("#salaryField");
  const syncSalary = () => salaryField.classList.toggle("hidden", type.value !== "salary");
  type.addEventListener("change", syncSalary); syncSalary();
  document.querySelector("#certificateForm").addEventListener("submit", async (event) => {

    event.preventDefault();

    clearNotice(document.querySelector('#pageNotice'));
    if (!event.currentTarget.reportValidity()) {
      setNotice(document.querySelector('#pageNotice'), 'error', 'الرجاء التأكد من تعبئة جميع الحقول المطلوبة.');
      return;
    }
    const employeeUid = document.querySelector("#certificateEmployee").value;
    const typeValue = document.querySelector("#certificateType").value;
    const jobTitle = document.querySelector("#certificateJobTitle").value.trim();
    const issuer = document.querySelector("#certificateIssuer").value.trim();
    const salary = document.querySelector("#certificateSalary").value.trim();

    if (
      !employeeUid ||
      !typeValue ||
      !jobTitle ||
      !issuer ||
      (typeValue === "salary" && !salary)
    ) {
      setNotice(
        document.querySelector("#pageNotice"),
        "error",
        "الرجاء التأكد من تعبئة جميع الحقول المطلوبة."
      );
      return;
    }

    const button = event.currentTarget.querySelector("button[type=submit]");

    await submitSafely(button, async () => {

      console.log("employeeUid:", employeeUid);
      const employee = state.employees.find((e) => (e.authUid ?? e.id) === employeeUid);
      try {
        const result = await api.post("/requests/certificates", {
          type: type.value,
          employeeUid,
          salary: document.querySelector("#certificateSalary").value || undefined,
          jobTitle: document.querySelector("#certificateJobTitle").value,
          issuer: document.querySelector("#certificateIssuer").value,
          notes: document.querySelector("#certificateNotes").value
        });

        setNotice(
          document.querySelector("#pageNotice"),
          "success",
          result.message || "تم إرسال النموذج بنجاح"
        );

        state.certificates = (await api.get("/requests/certificates")).data;
        document.querySelector("#certificateForm")?.reset();
        syncSalary();

        if (employee) {
          document.querySelector("#certificateJobTitle").value =
            labels.role[employee.role] ?? "";
        }

      } catch (error) {
        setNotice(
          document.querySelector("#pageNotice"),
          "error",
          error.message || "فشل إرسال النموذج"
        );
      }
    });
  });
}

const permissionLabels = {
  view_students: "عرض الطلاب", manage_students: "إدارة الطلاب", enter_attendance: "إدخال الغياب", view_attendance: "متابعة الغياب", manage_attendance: "إدارة الغياب", attendance_override: "تجاوز قيد الحصة الأولى", view_schedules: "عرض الجدول", view_all_schedules: "عرض جميع الجداول", manage_schedules: "إدارة الجداول", request_leave: "تقديم إجازة واستئذان", manage_leave_requests: "مراجعة الإجازات – المديرة", manage_leave_hr_requests: "اعتماد الإجازات – الموارد البشرية", request_training: "تقديم دورة", manage_training_requests: "اعتماد الدورات", issue_work_assignments: "إصدار تكليف", view_all_work_assignments: "عرض جميع التكاليف", request_assets: "طلب عهدة", manage_assets: "إدارة العهد", request_loans: "استعلام سلفة", manage_loans: "إدارة السلف", manage_employees: "إدارة الموظفات", manage_permissions: "إدارة الصلاحيات", manage_announcements: "إدارة الإعلانات", upload_files: "رفع المرفقات"
};

async function renderEmployeeManagementPage(mode) {
  const canAddEmployee = hasRole("system_admin", "principal", "admin") && has("manage_employees");
  const canManagePermissions = hasRole("system_admin") && has("manage_permissions");
  const addMode = mode === "add";
  const accountAddMode = mode === "account-add";
  const accountsMode = mode === "accounts";
  if ((addMode || accountAddMode) && !canAddEmployee) {
    throw new Error("إضافة بيانات الموظفات متاحة للإدارة المخولة فقط.");
  }
  if (mode === "permissions" && !canManagePermissions) {
    throw new Error("إدارة صلاحيات الموظفات متاحة لمسؤولة النظام المخولة فقط.");
  }
  const accountForm = `<form id="employeeAccountForm" class="form-grid employee-entry-form"><div class="field"><label for="accountEmployeeName">اسم الموظفة</label><input id="accountEmployeeName" required minlength="3" maxlength="120" placeholder="اكتبي اسم الموظفة"></div><div class="field"><label for="accountEmployeeEmail">اسم المستخدم / البريد الإلكتروني</label><input id="accountEmployeeEmail" type="email" required maxlength="160" dir="ltr" placeholder="example@school.com"></div><div class="field"><label for="accountEmployeePassword">كلمة المرور</label><div class="portal-password-wrap"><input id="accountEmployeePassword" type="password" minlength="6" maxlength="128" required dir="ltr" placeholder="كلمة المرور"><button id="accountEmployeePasswordToggle" class="portal-password-toggle" type="button" aria-label="إظهار كلمة المرور" aria-pressed="false">👁</button></div></div><div class="field"><label for="accountEmployeeNumber">الرقم الوظيفي</label><input id="accountEmployeeNumber" required maxlength="30" placeholder="مثال: T001"></div><div class="field"><label for="accountEmployeeRole">المسمى الوظيفي</label><select id="accountEmployeeRole" required><option value="">اختاري المسمى</option><option value="teacher">معلمة</option><option value="principal">مديرة المدرسة</option><option value="vice_principal">وكيلة</option><option value="hr">الموارد البشرية</option><option value="it_teacher">تقنية المعلومات</option><option value="admin">إدارية</option><option value="registrar">القبول والتسجيل</option><option value="accountant">المحاسبة</option><option value="doctor">طبيبة</option><option value="system_admin">مسؤولة النظام</option><option value="schedule_admin">مسؤولة الجداول</option><option value="upper_management">الإدارة العليا</option></select></div><div class="form-actions span-2"><button id="saveEmployeeAccount" class="btn" type="submit">حفظ الحساب</button></div></form>`;
  if (accountsMode) {
    page("حسابات الموظفات", "عرض حسابات الدخول التي تمت إضافتها.", `<div id="employeeAccountsTable" class="table-wrap"><div class="empty-state">جارٍ تحميل الحسابات...</div></div>`);
    try {
      const employees = await loadEmployees();
      renderSimpleTable("#employeeAccountsTable", ["الموظفة", "الرقم الوظيفي", "اسم المستخدم", "كلمة المرور", "حالة الحساب"], employees, (employee) => [employee.nameAr, employee.employeeNumber, employee.email || "غير مسجل", "••••••••", employee.status === "inactive" ? "غير نشطة" : "نشطة"]);
    } catch (error) {
      showError(error);
    }
    return;
  }
  const employeeForm = `<form id = "employeeForm" class="form-grid employee-entry-form" ><div class="field"><label for="employeeNameAr">اسم الموظفة</label><input id="employeeNameAr" required minlength="3" maxlength="120" placeholder="اكتبي اسم الموظفة"></div><div class="field"><label for="employeeNameEn">الاسم الإنجليزي</label><input id="employeeNameEn" required minlength="3" maxlength="120" dir="ltr" placeholder="Employee Name"></div><div class="field"><label for="employeeEmail">البريد الإلكتروني</label><input id="employeeEmail" type="email" required maxlength="160" dir="ltr"></div><div class="field"><label for="employeePassword">كلمة المرور</label><div class="portal-password-wrap"><input id="employeePassword" type="password" minlength="6" maxlength="128" required dir="ltr"><button id="employeePasswordToggle" class="portal-password-toggle" type="button" aria-label="إظهار كلمة المرور" aria-pressed="false">👁</button></div></div><div class="field"><label for="employeeNumberInput">رقمها الوظيفي</label><input id="employeeNumberInput" required maxlength="30" placeholder="مثال: T001"></div><div class="field"><label for="employeeRoleInput">الدور</label><select id="employeeRoleInput" required><option value="">اختاري الدور</option><option value="teacher">معلمة</option><option value="principal">مديرة المدرسة</option><option value="vice_principal">وكيلة</option><option value="hr">الموارد البشرية</option><option value="it_teacher">تقنية المعلومات</option><option value="admin">إدارية</option><option value="registrar">القبول والتسجيل</option><option value="accountant">المحاسبة</option><option value="doctor">طبيبة</option><option value="system_admin">مسؤولة النظام</option><option value="schedule_admin">مسؤولة الجداول</option><option value="upper_management">الإدارة العليا</option></select></div><div class="field"><label for="employeeAuthUid">Firebase UID (إن وُجد)</label><input id="employeeAuthUid" maxlength="180" dir="ltr"><span class="field-hint">يُستخدم لربط ملف الموظفة بحساب تسجيل الدخول.</span></div><div class="form-actions span-2"><button id="saveEmployee" class="btn" type="submit">حفظ ملف الموظفة</button></div></form > `;
  const permissionsPanel = `
    <div>
      <div class="field"><label for="permissionEmployee">اختاري الموظفة</label><select id="permissionEmployee"><option value="">اختاري الموظفة</option></select></div>

      <div id="permissionsArea" class="subsection">
        <div class="empty-state">اختاري الموظفة لعرض صلاحياتها.</div>
      </div>
    </div>
  `;
  page(
    accountAddMode ? "إضافة حساب موظفة" : addMode ? "إضافة موظفة وإدخال بياناتها" : "إدارة صلاحيات الموظفات",
    accountAddMode ? "أضيفي اسم المستخدم وكلمة المرور للموظفة." : addMode ? "أدخلي البيانات الوظيفية لإنشاء ملف الموظفة." : "اختاري الموظفة ثم حددي الصلاحيات المطلوبة.",
    accountAddMode ? accountForm : addMode ? employeeForm : permissionsPanel
  );
  [
    ["employeePassword", "employeePasswordToggle"],
    ["accountEmployeePassword", "accountEmployeePasswordToggle"]
  ].forEach(([inputId, buttonId]) => {
    const input = document.querySelector(`#${inputId}`);
    const button = document.querySelector(`#${buttonId}`);
    button?.addEventListener("click", () => {
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.textContent = visible ? "👁" : "🙈";
      button.setAttribute("aria-label", visible ? "إظهار كلمة المرور" : "إخفاء كلمة المرور");
      button.setAttribute("aria-pressed", String(!visible));
    });
  });
  if (accountAddMode) {
    const roleSelect = document.querySelector("#accountEmployeeRole");
    if (!hasRole("system_admin")) {
      ["principal", "vice_principal", "admin", "system_admin", "schedule_admin", "upper_management"].forEach((role) => {
        roleSelect.querySelector(`option[value = "${role}"]`)?.remove();
      });
    }
    document.querySelector("#employeeAccountForm").addEventListener("submit", saveEmployeeAccount);
  } else if (addMode) {
    const form = document.querySelector("#employeeForm");
    if (!hasRole("system_admin")) {
      const roleSelect = document.querySelector("#employeeRoleInput");
      ["principal", "vice_principal", "admin", "system_admin", "schedule_admin", "upper_management"].forEach((role) => {
        roleSelect.querySelector(`option[value = "${role}"]`)?.remove();
      });
    }
    form.querySelector(".form-actions").insertAdjacentHTML("beforebegin", `
    <div class="field" ><label for="employeeNationalId">رقم الهوية الوطنية</label><input id="employeeNationalId" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required dir="ltr"></div>
      <div class="field"><label for="employeePhone">رقم الجوال</label><input id="employeePhone" type="tel" maxlength="12" required dir="ltr"></div>
      <div class="field"><label for="employeeDepartment">القسم</label><input id="employeeDepartment" maxlength="100" required></div>
      <div class="field"><label for="employeeHireDate">تاريخ المباشرة</label><input id="employeeHireDate" type="date" required></div>
      <div class="field"><label for="employeeEmploymentType">نوع العقد</label><select id="employeeEmploymentType" required><option value="">اختاري النوع</option><option value="full_time">دوام كامل</option><option value="part_time">دوام جزئي</option><option value="contract">عقد</option></select></div>
      <div class="field"><label for="employeeEmploymentStatus">الحالة الوظيفية</label><select id="employeeEmploymentStatus" required><option value="">اختاري الحالة</option><option value="active">على رأس العمل</option><option value="on_leave">في إجازة</option><option value="suspended">موقوفة</option><option value="terminated">منتهية الخدمة</option></select></div>
      <div class="field"><label for="employeeQualification">المؤهل العلمي</label><input id="employeeQualification" maxlength="120" required></div>
      <div class="field"><label for="employeeSpecialization">التخصص</label><input id="employeeSpecialization" maxlength="120" required></div>
  `);
    form.addEventListener("submit", saveEmployee);
  } else {
    const permissionEmployee = document.querySelector("#permissionEmployee");
    if (!permissionEmployee) return;
    const employees = await loadEmployees();
    fillSelect(permissionEmployee, employees.filter((x) => (x.authUid ?? x.id) !== state.me.uid), (x) => x.authUid ?? x.id, (x) => `${x.nameAr} - ${x.employeeNumber}`, "اختاري الموظفة");
    permissionEmployee.addEventListener("change", loadPermissionEditor);
  }
}

async function renderEmployeeAdd() {
  await renderEmployeeManagementPage("add");
}

function renderEmployeeManagementHub() {
  if (!hasRole("system_admin", "principal", "admin") || !has("manage_employees")) {
    throw new Error("إدارة الموظفات متاحة للإدارة المخولة فقط.");
  }
  const links = [
    studentHubLink("employee-account-add", "إضافة حساب للموظفة", "إضافة اسم المستخدم وكلمة المرور"),
    studentHubLink("employee-accounts", "عرض حسابات الموظفات", "عرض الحسابات التي تمت إضافتها")
  ];
  page("إدارة الموظفات والصلاحيات", "اختاري الخدمة المطلوبة.", `<nav class="student-services-list" aria-label="خدمات إدارة الموظفات">${links.join("")}</nav>`);
}

async function renderEmployeeAccountAdd() {
  await renderEmployeeManagementPage("account-add");
}

async function renderEmployeeAccounts() {
  await renderEmployeeManagementPage("accounts");
}

async function renderEmployees() {
  renderEmployeeManagementHub();
}

async function renderEmployeePermissions() {
  await renderEmployeeManagementPage("permissions");
}

function renderParentManagement() {
  if (!hasRole("system_admin")) throw new Error("إدارة أولياء الأمور متاحة لمسؤولة النظام فقط.");
  const links = [
    studentHubLink("parent-add", "إضافة ولي أمر", "تسجيل بيانات ولي الأمر وربط أبنائه"),
    studentHubLink("parent-list", "عرض أولياء الأمور", "عرض عدد الأبناء المرتبطين بكل ولي أمر")
  ];
  page("إدارة أولياء الأمور", "إضافة أولياء الأمور وربط الأبناء بحساباتهم.", `<nav class="student-services-list" aria-label="خدمات إدارة أولياء الأمور">${links.join("")}</nav>`);
}

async function renderParentAdd() {
  if (!hasRole("system_admin")) throw new Error("إضافة ولي أمر متاحة لمسؤولة النظام فقط.");
  page("إضافة ولي أمر", "سجلي بيانات ولي الأمر ثم ابحثي عن أبنائه المسجلين.", `<form id="parentForm" class="form-grid"><div class="field"><label for="parentName">اسم ولي الأمر</label><input id="parentName" required minlength="3" maxlength="120"></div><div class="field"><label for="parentNationalId">رقم الهوية</label><input id="parentNationalId" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" required></div><div class="field"><label for="parentPhone">رقم الجوال</label><input id="parentPhone" inputmode="tel" required></div><div class="field"><label for="parentEmail">البريد الإلكتروني</label><input id="parentEmail" type="email" required dir="ltr"></div><div class="field"><label for="parentPassword">كلمة المرور</label><input id="parentPassword" type="password" minlength="6" maxlength="128" required dir="ltr"></div><fieldset class="field span-2 parent-children-field"><legend>أبناء ولي الأمر</legend><p class="field-hint">لا تظهر أسماء الطلاب تلقائيًا. ابحثي عن كل ابن بالاسم أو الرقم، ثم أضيفيه بعد التأكد من بياناته.</p><div class="parent-student-search"><input id="parentStudentSearch" placeholder="اسم الطالب أو رقم الطالب" autocomplete="off"><button id="parentStudentSearchButton" class="btn btn-secondary" type="button">بحث</button></div><p id="parentStudentsStatus" class="field-hint">لم تتم إضافة أي أبناء بعد.</p><div id="parentStudents" class="parent-student-list"></div></fieldset><div class="form-actions span-2"><button class="btn" type="submit">حفظ ولي الأمر</button></div></form>`);
  const studentsArea = document.querySelector("#parentStudents");
  const selectedStudents = new Map();
  async function searchStudents() {
    const search = document.querySelector("#parentStudentSearch").value.trim();
    if (search.length < 2) { setNotice(document.querySelector("#pageNotice"), "error", "اكتبي اسم الطالب أو رقمه للبحث."); return; }
    document.querySelector("#parentStudentsStatus").textContent = "جارٍ البحث...";
    try {
      const [studentsResult, classesResult] = await Promise.all([api.get(`/students?limit=50&search=${encodeURIComponent(search)}`), api.get("/academic-classes?limit=200")]);
      const classes = new Map((classesResult.data ?? []).map((item) => [item.id, item]));
      const students = studentsResult.data ?? [];
      studentsArea.replaceChildren();
      document.querySelector("#parentStudentsStatus").textContent = students.length ? "تأكدي من بيانات الطالب ثم اضغطي إضافة." : "لا توجد نتائج مطابقة.";
      students.forEach((student) => {
        const academicClass = classes.get(student.classId);
        const label = document.createElement("label"); label.className = "parent-student-choice";
        label.innerHTML = `<input name="parentChildren" type="checkbox" value="${student.id}"><span><strong>${student.fullName}</strong><small>${student.grade ?? "—"} / ${academicClass?.section ?? "الشعبة غير محددة"}</small></span>`;
        label.querySelector("input").addEventListener("change", (event) => { if (event.target.checked) selectedStudents.set(student.id, student); else selectedStudents.delete(student.id); });
        studentsArea.append(label);
      });
    } catch (error) { document.querySelector("#parentStudentsStatus").textContent = "تعذر تنفيذ البحث."; setNotice(document.querySelector("#pageNotice"), "error", error.message); }
  }
  document.querySelector("#parentStudentSearchButton").addEventListener("click", searchStudents);
  document.querySelector("#parentStudentSearch").addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); searchStudents(); } });
  document.querySelector("#parentForm").addEventListener("submit", async (event) => { event.preventDefault(); if (!event.currentTarget.reportValidity()) return; if (!selectedStudents.size) { setNotice(document.querySelector("#pageNotice"), "error", "ابحثي وأضيفي ابنًا واحدًا على الأقل بعد التأكد من بياناته."); return; } const button = event.currentTarget.querySelector("button[type=submit]"); button.disabled = true; try { const result = await api.post("/parent-admin", { nameAr: document.querySelector("#parentName").value, nationalId: document.querySelector("#parentNationalId").value, phone: document.querySelector("#parentPhone").value, email: document.querySelector("#parentEmail").value, password: document.querySelector("#parentPassword").value, studentIds: [...selectedStudents.keys()] }); setNotice(document.querySelector("#pageNotice"), "success", result.message); event.currentTarget.reset(); selectedStudents.clear(); studentsArea.replaceChildren(); document.querySelector("#parentStudentsStatus").textContent = "تم الحفظ. ابحثي لإضافة ولي أمر آخر."; } catch (error) { setNotice(document.querySelector("#pageNotice"), "error", error.message); } finally { button.disabled = false; } });
}

async function renderParentList() {
  if (!hasRole("system_admin")) throw new Error("عرض أولياء الأمور متاح لمسؤولة النظام فقط.");
  page("أولياء الأمور", "عرض أولياء الأمور وعدد الأبناء المرتبطين بكل حساب.", `<div id="parentsTable" class="table-wrap"><div class="empty-state">جارٍ تحميل البيانات...</div></div>`);
  const area = document.querySelector("#parentsTable");
  try { const parents = (await api.get("/parent-admin?limit=500")).data; area.innerHTML = parents.length ? `<table><thead><tr><th>ولي الأمر</th><th>البريد</th><th>الجوال</th><th>عدد الأبناء</th></tr></thead><tbody>${parents.map((parent) => `<tr><td>${parent.nameAr}</td><td dir="ltr">${parent.email}</td><td dir="ltr">${parent.phone}</td><td>${parent.studentCount}</td></tr>`).join("")}</tbody></table>` : '<div class="empty-state">لا يوجد أولياء أمور مسجلون.</div>'; } catch (error) { area.innerHTML = `<div class="notice notice-error visible">${error.message}</div>`; }
}

async function renderSiteSettings() {
  if (!hasRole("system_admin", "principal", "vice_principal", "admin", "upper_management")) throw new Error("إعدادات الموقع متاحة للإدارة فقط.");
  page("إعدادات الموقع", "تعديل العام الدراسي والفصل الدراسي والسنة الهجرية ونشر الإعلانات.", `
    <section class="settings-section"><h2>إعدادات العام الدراسي</h2><form id="siteSettingsForm" class="form-grid">
      <div class="field"><label for="academicYear">العام الدراسي</label><input id="academicYear" maxlength="20" required placeholder="مثال: 1447 - 1448"></div>
      <div class="field"><label for="hijriYear">السنة الهجرية</label><input id="hijriYear" maxlength="20" required placeholder="مثال: 1447"></div>
      <div class="field"><label for="semester">الفصل الدراسي</label><select id="semester" required><option value="الفصل الدراسي الأول">الفصل الدراسي الأول</option><option value="الفصل الدراسي الثاني">الفصل الدراسي الثاني</option></select></div>
      <div class="form-actions span-2"><button class="btn" type="submit">حفظ إعدادات العام</button></div>
    </form></section>
    <section class="settings-section"><h2>نشر إعلان</h2><form id="announcementForm" class="form-grid">
      <div class="field span-2"><label for="announcementTitle">عنوان الإعلان</label><input id="announcementTitle" maxlength="160" required></div>
      <div class="field span-2"><label for="announcementBody">نص الإعلان</label><textarea id="announcementBody" maxlength="2000" required></textarea></div>
      <div class="field"><label for="announcementExpires">تاريخ انتهاء الإعلان (اختياري)</label><input id="announcementExpires" type="date"></div>
      <div class="form-actions span-2"><button class="btn" type="submit">نشر الإعلان</button></div>
    </form></section>
    <section class="settings-section"><h2>الإعلانات المنشورة</h2><div id="publishedAnnouncements" class="published-announcements"><div class="empty-state">جارٍ التحميل...</div></div></section>`);
  try {
    const settings = (await api.get("/site-settings")).data;
    document.querySelector("#academicYear").value = settings.academicYear ?? "";
    document.querySelector("#hijriYear").value = settings.hijriYear ?? "";
    document.querySelector("#semester").value = settings.semester ?? "الفصل الدراسي الثاني";
  } catch {
    document.querySelector("#academicYear").value = "1447 - 1448";
    document.querySelector("#hijriYear").value = "1447";
    document.querySelector("#semester").value = "الفصل الدراسي الثاني";
  }
  const announcementsArea = document.querySelector("#publishedAnnouncements");
  try {
    const announcements = (await api.get("/announcements")).data;
    announcementsArea.replaceChildren();
    if (!announcements.length) {
      announcementsArea.innerHTML = '<div class="empty-state">لا توجد إعلانات منشورة.</div>';
    } else {
      announcements.forEach((announcement) => {
        const item = document.createElement("article");
        item.className = "published-announcement";
        const details = document.createElement("div");
        const title = document.createElement("strong");
        title.textContent = announcement.title;
        const body = document.createElement("p");
        body.textContent = announcement.body;
        details.append(title, body);
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "btn btn-danger btn-small";
        remove.textContent = "حذف";
        remove.addEventListener("click", async () => {
          if (!await confirmAction(`حذف الإعلان «${announcement.title}»؟`, "تأكيد الحذف", "حذف")) return;
          try {
            const result = await api.delete(`/announcements/${encodeURIComponent(announcement.id)}`);
            setNotice(document.querySelector("#pageNotice"), "success", result.message);
            item.remove();
            document.querySelector("#tickerText").textContent = "لا توجد إعلانات جديدة.";
          } catch (error) { showError(error); }
        });
        item.append(details, remove);
        announcementsArea.append(item);
      });
    }
  } catch { announcementsArea.innerHTML = '<div class="empty-state">تعذر تحميل الإعلانات.</div>'; }
  document.querySelector("#siteSettingsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await api.put("/site-settings", { academicYear: value("academicYear"), semester: value("semester"), hijriYear: value("hijriYear") });
      document.querySelector("#semesterText").textContent = `${result.data.semester} - ${result.data.academicYear} هـ`;
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
    } catch (error) { showError(error); }
  });
  document.querySelector("#announcementForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      const expiresAt = value("announcementExpires");
      const result = await api.post("/announcements", { title: value("announcementTitle"), body: value("announcementBody"), active: true, ...(expiresAt ? { expiresAt } : {}) });
      setNotice(document.querySelector("#pageNotice"), "success", result.message);
      form.reset();
    } catch (error) { showError(error); }
  });
}

async function saveEmployee(event) {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const button = document.querySelector("#saveEmployee");
  const data = {
    nameAr: value("employeeNameAr"),
    nameEn: value("employeeNameEn"),
    nationalId: value("employeeNationalId"),
    email: value("employeeEmail").toLowerCase(),
    password: value("employeePassword"),
    phone: value("employeePhone"),
    employeeNumber: value("employeeNumberInput"),
    role: value("employeeRoleInput"),
    department: value("employeeDepartment"),
    hireDate: value("employeeHireDate"),
    employmentType: value("employeeEmploymentType"),
    employmentStatus: value("employeeEmploymentStatus"),
    qualification: value("employeeQualification"),
    specialization: value("employeeSpecialization"),
    status: "active"
  };
  if (value("employeeAuthUid")) data.authUid = value("employeeAuthUid");
  await submitSafely(button, async () => { try { const result = await api.post("/employees", data); setNotice(document.querySelector("#pageNotice"), "success", result.message); event.currentTarget.reset(); state.employees = null; } catch (error) { showError(error); } });
}

async function saveEmployeeAccount(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const button = document.querySelector("#saveEmployeeAccount");
  await submitSafely(button, async () => {
    try {
      const result = await api.post("/employees", {
        nameAr: value("accountEmployeeName"),
        nameEn: value("accountEmployeeName"),
        nationalId: `9${Date.now().toString().slice(-9)}`,
        email: value("accountEmployeeEmail").toLowerCase(),
        password: value("accountEmployeePassword"),
        phone: "0500000000",
        employeeNumber: value("accountEmployeeNumber"),
        role: value("accountEmployeeRole"),
        department: "غير محدد",
        hireDate: new Date().toISOString().slice(0, 10),
        employmentType: "full_time",
        employmentStatus: "active",
        qualification: "غير محدد",
        specialization: "غير محدد",
        status: "active"
      });
      setNotice(document.querySelector("#pageNotice"), "success", `${result.message} احفظي كلمة المرور في مكان آمن.`);
      form.reset();
      state.employees = null;
    } catch (error) {
      showError(error);
    }
  });
}

async function loadPermissionEditor() {
  const uid = value("permissionEmployee"); if (!uid) return; const area = document.querySelector("#permissionsArea");
  try {
    const access = (await api.get(`/employees/${encodeURIComponent(uid)}/access`)).data; area.replaceChildren(); const form = document.createElement("form"); form.id = "permissionsForm";
    const grid = document.createElement("div"); grid.className = "checkbox-grid";
    [["active", "الحساب نشط"], ...Object.entries(permissionLabels).filter(([key]) => key !== "upload_files")].forEach(([key, title]) => { const label = document.createElement("label"); label.className = "check-item"; const input = document.createElement("input"); input.type = "checkbox"; input.name = key; input.checked = access[key] === true; const span = document.createElement("span"); span.textContent = title; label.append(input, span); grid.append(label); });
    const actions = document.createElement("div"); actions.className = "form-actions"; const save = document.createElement("button"); save.type = "submit"; save.className = "btn"; save.textContent = "حفظ الصلاحيات"; actions.append(save); form.append(grid, actions); area.append(form);
    form.addEventListener("submit", async (event) => {
      event.preventDefault(); const body = {}; form.querySelectorAll("input[type=checkbox]").forEach((input) => { body[input.name] = input.checked; }); await submitSafely(save, async () => {
        try { const result = await api.patch(`/employees/${uid}/access`, body); setNotice(document.querySelector("#pageNotice"), "success", result.message); } catch (error) { showError(error); }
      });
    });
  } catch (error) { showError(error); }
}

async function route() {
  const name = currentRoute();
  console.log("ًں”„ Route changed to:", name);
  markRoute(name);

  // ط§ظ„ظ†ظ…ط§ط°ط¬ ط§ظ„ظپط±ط¹ظٹط© طھط¨ظ‚ظ‰ ط¯ط§ط®ظ„ طµظپط­ط© ط§ظ„ظ†ظ…ط§ط°ط¬ ظˆظ„ط§ طھط¹ظˆط¯ ظ„ظ„طµظپط­ط© ط§ظ„ط±ط¦ظٹط³ظٹط©
  if (name.startsWith("forms-")) {
    await renderAdministrativeForms();
    return;
  }

  const routes = {
    dashboard: renderDashboard,
    students: renderStudents,
    reports: renderReportsHub,
    "skill-add": renderSkillAddPage,
    "skill-entry": renderSkillEntryPage,
    "skill-approval": renderSkillApprovalPage,
    "skill-parent": renderSkillParentPage,
    "student-list": renderStudentList,
    "student-management": renderStudentManagement,
    "student-add": renderStudentAdd,
    "student-upload": renderStudentUpload,
    "student-review": renderStudents,
    classes: renderClasses,
    attendance: renderAttendancePortal,
    "attendance-entry": renderAttendance,
    "attendance-monitor": renderAttendanceMonitor,
    schedule: renderSchedule,
    "schedule-my": renderMySchedule,
    "schedule-all": renderAllSchedules,
    "schedule-manage": renderScheduleManage,
    leave: renderLeaveHub,
    "leave-request": renderLeaveRequest,
    "leave-history": renderLeaveHistory,
    "leave-extension": renderLeaveExtension,
    "leave-manager": () => renderLeaveQueue("manager"),
    "leave-hr": () => renderLeaveQueue("hr"),
    permission: renderPermissionHub,
    "permission-self": renderPermissionEmployee,
    "permission-history": renderPermissionHistory,
    "permission-manage": renderPermissionManage,
    "absence-report": renderAbsenceHub,
    "absence-report-self": renderAbsenceReportEmployee,
    "absence-report-history": renderAbsenceReportHistory,
    "absence-report-manage": renderAbsenceReportManage,
    training: renderTrainingHub,
    "training-course": renderTrainingCourseHub,
    "training-course-request": renderTrainingCourseRequest,
    "training-course-history": renderTrainingCourseHistory,
    "training-course-manage": renderTrainingCourseManage,
    "training-certificates": renderTrainingHub,
    "training-admin": renderTrainingManage,
    "training-self": renderTrainingAdd,
    "training-add": renderTrainingAdd,
    "training-my": renderTrainingMy,
    "training-manage": renderTrainingManage,
    assets: () => renderRequestPage("assets"),
    loans: () => renderRequestPage("loans"),
    materials: renderMaterialsHub,
    "materials-add": () => renderRequestPage("materials"),
    "materials-my": renderMaterialsMy,
    "materials-list": renderMaterialsList,
    "materials-manage-requests": renderMaterialsManageRequests,
    "materials-manage": renderMaterialsManage,

    community: renderCommunityHub,
    "community-add": () => renderRequestPage("community"),
    "community-my": renderCommunityMy,
    "community-manage": renderCommunityManage,
    "suggestions-complaints": renderSuggestionsHub,
    "suggestions-employee": renderSuggestionsEmployee,
    "suggestions-history": renderSuggestionsHistory,
    "suggestions-manage": renderSuggestionsManage,

    support: renderSupportHub,
    "support-employee": renderSupportEmployee,
    "support-history": renderSupportHistory,
    "support-manage": renderSupportManage,
    invoices: renderInvoices,
    "employee-data": renderEmployeeData,
    "employee-data-view": renderEmployeeDataView,
    "employee-add": renderEmployeeAdd,
    "employee-account-add": renderEmployeeAccountAdd,
    "employee-accounts": renderEmployeeAccounts,
    "employee-permissions": renderEmployeePermissions,
    performance: renderPerformance,
    forms: renderAdministrativeForms,
    assignments: renderAssignments,
    "assignment-issue": renderAssignmentIssue,
    "assignment-my": renderMyAssignments,
    approvals: renderApprovals,
    employees: renderEmployees,
    parents: renderParentManagement,
    "parent-add": renderParentAdd,
    "parent-list": renderParentList,
    "site-settings": renderSiteSettings
  };
  const handler = routes[name] ?? renderDashboard;
  try { await handler(); } catch (error) { page("تعذر فتح الخدمة", "حدثت مشكلة أثناء تحميل الصفحة.", ""); showError(error); }
}

async function init() {
  try {
    state.me = (await api.get("/me")).data; state.permissions = new Set(state.me.permissions);
    renderMenu();
    setupNotifications();
    try {
      const settings = (await api.get("/site-settings")).data;
      document.querySelector("#semesterText").textContent = `${settings.semester} - ${settings.academicYear} هـ`;
    } catch {
      document.querySelector("#semesterText").textContent = "إعدادات العام الدراسي";
    }
    try { const announcements = (await api.get("/announcements")).data; document.querySelector("#tickerText").textContent = announcements.length ? announcements.map((x) => x.title).join(" • ") : "لا توجد إعلانات جديدة."; } catch { document.querySelector("#tickerText").textContent = "لا توجد إعلانات متاحة."; }
    await route();
  } catch (error) {
    content.replaceChildren();
    const section = document.createElement("section"); section.className = "content-card page-card";
    const notice = document.createElement("div"); notice.className = "notice visible notice-error"; notice.textContent = error.message;
    section.append(notice); content.append(section);
  }
}

window.addEventListener("hashchange", route);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setSidebarOpen(false);
});
mobileMenuButton.addEventListener("click", () => setSidebarOpen(!portal.classList.contains("sidebar-open")));
document.querySelector("#sidebarBackdrop").addEventListener("click", () => setSidebarOpen(false));
document.querySelector("#logoutButton").addEventListener("click", async () => { await logout(); window.location.replace("login.html"); });

init();

// ============================================================
// Asset Dialog Manager - ظ†ط¸ط§ظ… ظ…ط­ط³ظ‘ظ† ظ„ظ„ظ€ Dialogs
// ============================================================

class AssetDialogManager {
  constructor() {
    this.statusDialog = null;
    this.editDialog = null;
    this.deleteDialog = null;
    this.successDialog = null;
    this.errorDialog = null;
    this.currentAsset = null;
    this.initDialogs();
  }

  initDialogs() {
    this.createStatusDialog();
    this.createEditDialog();
    this.createDeleteDialog();
    this.createSuccessDialog();
    this.createErrorDialog();
    this.attachCloseHandlers();
  }

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
          <button type="button" class="modal-close" aria-label="إغلاق النافذة">×</button>
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
            <label for="returnedAt" class="form-label">تاريخ استلام العهدة من الموظفة:</label>
            <input id="returnedAt" class="form-control" type="date">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('statusDialog').close('cancel')">إلغاء</button>
          <button type="submit" class="btn btn-primary">حفظ التغييرات</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.statusDialog = dialog;
  }

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
          <button type="button" class="modal-close" aria-label="إغلاق النافذة">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="editAssetName" class="form-label">اسم العهدة:</label>
            <input type="text" id="editAssetName" class="form-control" required placeholder="أدخل اسم العهدة">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('editDialog').close('cancel')">إلغاء</button>
          <button type="submit" class="btn btn-primary">حفظ التعديلات</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.editDialog = dialog;
  }

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
          <button type="button" class="modal-close" aria-label="إغلاق النافذة">×</button>
        </div>
        <div class="modal-body">
          <div class="alert alert-danger" role="alert">
            <span aria-hidden="true">⚠️</span>
            <div>
              <p class="alert-title">تحذير!</p>
              <p class="alert-message">هل أنتِ متأكدة من حذف العهدة <strong id="deleteAssetName">--</strong>؟</p>
              <p class="alert-hint">هذا الإجراء لا يمكن التراجع عنه.</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
       <button type="button"class="btn btn-secondary cancel-delete-btn">
    إلغاء</button>
          <button type="submit" class="btn btn-danger">نعم، احذفيها</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.deleteDialog = dialog;
  }

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
          <button type="submit" class="btn btn-primary">حسناً</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.successDialog = dialog;
  }

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
          <button type="submit" class="btn btn-secondary">حسناً</button>
        </div>
      </form>
    `;

    document.body.appendChild(dialog);
    this.errorDialog = dialog;
  }

  attachCloseHandlers() {
    // dialogs with close buttons (أ— button)
    [this.statusDialog, this.editDialog, this.deleteDialog].forEach(dialog => {
      const closeBtn = dialog.querySelector('.modal-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => dialog.close('cancel'));
      }
    });

    // Success and error dialogs - close when button is clicked
    if (this.successDialog) {
      const successBtn = this.successDialog.querySelector('button[type="submit"]');
      if (successBtn) {
        successBtn.addEventListener('click', () => this.successDialog.close());
      }
    }

    if (this.errorDialog) {
      const errorBtn = this.errorDialog.querySelector('button[type="submit"]');
      if (errorBtn) {
        errorBtn.addEventListener('click', () => this.errorDialog.close());
      }
    }
  }

  async showStatusDialog(asset) {
    document.getElementById('statusAssetName').textContent = asset.assetName;
    document.getElementById('statusSelect').value = asset.status || '';
    document.getElementById('returnedAt').value = asset.returnedAt || '';

    return new Promise((resolve) => {
      const form = this.statusDialog.querySelector('form');
      const handleSubmit = (e) => {
        e.preventDefault();
        const result = {
          status: document.getElementById('statusSelect').value,
          returnedAt: document.getElementById('returnedAt').value
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

    return new Promise((resolve) => {
      const form = this.editDialog.querySelector('form');
      const handleSubmit = (e) => {
        e.preventDefault();
        const result = {
          assetName: document.getElementById('editAssetName').value
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

const assetDialogManager = new AssetDialogManager();

// ============================================================
// ط¯ظˆط§ظ„ ط¹ط±ط¶ ط¹ظ‡ظˆط¯ ط§ظ„ظ…ظˆط¸ظپط© ط§ظ„ظ…ط­ط³ظ‘ظ†ط©
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

async function showCreateAssetDialog() {
  const employees = await loadEmployees();
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <div class="material-modal">
        <h3>إضافة عهدة</h3>
        <label for="newAssetName">اسم العهدة</label>
        <input id="newAssetName" required maxlength="160" placeholder="مثال: جهاز لابتوب">
        <label for="newAssetNumber">رقم العهدة</label>
        <input id="newAssetNumber" maxlength="60" placeholder="اختياري">
        <label for="newAssetEmployee">الموظفة المستلمة</label>
        <select id="newAssetEmployee" required></select>
        <label for="newAssetAssignedAt">تاريخ تسليم العهدة</label>
        <input id="newAssetAssignedAt" type="date" required>
        <label for="newAssetNotes">ملاحظات</label>
        <textarea id="newAssetNotes" rows="3" maxlength="500"></textarea>
        <div class="material-modal-actions">
          <button type="button" class="btn-cancel">إلغاء</button>
          <button type="button" class="btn-save">حفظ العهدة</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialog);
    const employeeSelect = dialog.querySelector("#newAssetEmployee");
    employeeSelect.append(new Option("اختاري الموظفة", ""));
    employees.filter((employee) => employee.status === "active").forEach((employee) => {
      employeeSelect.append(new Option(employee.nameAr, employee.authUid ?? employee.id));
    });
    const close = (value) => {
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    dialog.querySelector(".btn-cancel").addEventListener("click", () => close(null));
    dialog.querySelector(".btn-save").addEventListener("click", () => {
      const assetName = dialog.querySelector("#newAssetName").value.trim();
      const employeeUid = employeeSelect.value;
      if (assetName.length < 2 || !employeeUid) return;
      close({
        assetName,
        assetNumber: dialog.querySelector("#newAssetNumber").value.trim(),
        employeeUid,
        assignedAt: dialog.querySelector("#newAssetAssignedAt").value,
        notes: dialog.querySelector("#newAssetNotes").value.trim()
      });
    });
    dialog.showModal();
    dialog.querySelector("#newAssetName").focus();
  });
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

  if (!wrap) {
    console.error("displayAssetsTableImproved: wrap is missing");
    return;
  }

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
      statusBtn.innerHTML = "ًں“‌";
      statusBtn.title = "تحديث الحالة";
      statusBtn.setAttribute("aria-label", `تحديث حالة العهدة: ${item.assetName}`);
      statusBtn.addEventListener("click", () => updateAssetStatus(item));

      const editBtn = document.createElement("button");
      editBtn.className = "icon-button";
      editBtn.textContent = "تعديل";
      editBtn.title = "تعديل البيانات";
      editBtn.setAttribute("aria-label", `تعديل بيانات العهدة: ${item.assetName}`);
      editBtn.addEventListener("click", () => editAsset(item));

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "icon-button danger";
      deleteBtn.innerHTML = "ًں—‘ï¸ڈ";
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

// ============================================================
// ط¯ظˆط§ظ„ ظ…ط¹ط§ظ„ط¬ط© ط§ظ„ط¹ظ…ظ„ظٹط§طھ - ط¨ط¯ظ„ط§ظ‹ ظ…ظ† prompt ظˆ confirm
// ============================================================

async function updateAssetStatus(item) {
  try {
    const result = await assetDialogManager.showStatusDialog(item);

    if (result.status) {
      await api.patch(`/requests/asset/${item.id}`, { status: result.status, ...(result.returnedAt ? { returnedAt: result.returnedAt } : {}) });
      await assetDialogManager.showSuccess('تم تحديث حالة العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    await assetDialogManager.showError('ط®ط·ط£: ' + (error.message || 'فشل تحديث الحالة'));
  }
}

async function editAsset(item) {
  try {
    const result = await assetDialogManager.showEditDialog(item);

    if (result.assetName) {
      await api.patch(`/requests/asset/${item.id}`, { assetName: result.assetName });
      await assetDialogManager.showSuccess('تم تحديث بيانات العهدة بنجاح');
      loadAllAssets(requestPages.assets);
    }
  } catch (error) {
    await assetDialogManager.showError('ط®ط·ط£: ' + (error.message || 'فشل التعديل'));
  }
}

// ط¯ط§ظ„ط© ظ„طھط­ظ…ظٹظ„ ط§ظ„ظ…ظˆط§ط¯ ظ„ظ„ظ…ظˆط¸ظپط©
async function loadEmployeeMaterials(config) {
  try {
    const rows = (await api.get(config.path)).data;
    const wrap = document.querySelector("#requestTable");

    if (!wrap) {
      console.error("Element #requestTable not found");
      return;
    }

    wrap.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "لا توجد طلبات حتى الآن.";
      wrap.append(empty);
      return;
    }

    const table = document.createElement("table");
    const head = document.createElement("thead");
    const trh = document.createElement("tr");

    config.columns.forEach((col) => {
      const th = document.createElement("th");
      th.textContent = col;
      trh.append(th);
    });
    head.append(trh);

    const body = document.createElement("tbody");
    rows.forEach((item) => {
      const tr = document.createElement("tr");
      config.row(item).forEach((cell) => {
        tr.append(createCell(cell));
      });
      body.append(tr);
    });

    table.append(head, body);
    wrap.append(table);
  } catch (error) {
    console.error(error);
    console.error(error.stack);
    showError(error);
  }
}

// ط¯ط§ظ„ط© ظ„ط¥ط¯ط§ط±ط© ط§ظ„ظ…ظˆط§ط¯ (ط¥ط¶ط§ظپط©/طھط­ط¯ظٹط«/ط­ط°ظپ)
async function renderAdminMaterials() {
  const canManage = has("manage_materials");
  if (!canManage) {
    showError(new Error("ليس لديك صلاحية"));
    return;
  }

  document.querySelector("#contentContainer").innerHTML = `
    <div class="subsection">
      <h2>إضافة مادة جديدة</h2>
      <form id="addMaterialForm" class="form-grid">
        <div class="field"><label for="matName">اسم المادة</label><input id="matName" required></div>
        <div class="field"><label for="matCode">الكود</label><input id="matCode" required></div>
        <div class="field"><label for="matQty">الكمية</label><input id="matQty" type="number" required></div>
        <div class="field"><label for="matUnit">الوحدة</label><input id="matUnit" required></div>
        <div class="form-actions span-2">
          <button type="submit" class="btn">إضافة مادة</button>
        </div>
      </form>
    </div>

    <div class="subsection">
      <h2>استيراد من Excel</h2>
      <form id="importForm" class="form-grid">
        <div class="field span-2">
          <label for="excelFile">اختر ملف Excel</label>
          <input id="excelFile" type="file" accept=".xlsx,.xls" required>
          <span class="field-hint">صيغة: المادة، الكود، الكمية، الوحدة</span>
        </div>
        <div class="form-actions span-2">
          <button type="submit" class="btn">استيراد</button>
        </div>
      </form>
    </div>

    <div class="subsection">
      <h2>المواد الموجودة</h2>
      <div id="materialsTable" class="table-wrap">
        <div class="empty-state">جارٍ التحميل...</div>
      </div>
    </div>
  `;

  // ظ…ط¹ط§ظ„ط¬ ط¥ط¶ط§ظپط© ظ…ط§ط¯ط©
  document.querySelector("#addMaterialForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;

    const button = e.target.querySelector("button");
    await submitSafely(button, async () => {

      const payload = {
        nameAr: document.querySelector("#matName").value,
        code: document.querySelector("#matCode").value,
        quantity: Number(document.querySelector("#matQty").value),
        units: document.querySelector("#matUnit").value
      };

      const result = await api.post("/materials", payload);

      setNotice(
        document.querySelector("#pageNotice"),
        "success",
        "تمت إضافة المادة بنجاح"
      );

      form.reset();

      await loadMaterialsTable();
    });
  });

  // ظ…ط¹ط§ظ„ط¬ ط§ط³طھظٹط±ط§ط¯ Excel
  document.querySelector("#importForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = document.querySelector("#excelFile").files[0];
    if (!file) return;

    const button = e.target.querySelector("button");
    await submitSafely(button, async () => {
      const body = new FormData();
      body.append("file", file);
      const result = await apiFetch("/materials/import", { method: "POST", body });
      setNotice(document.querySelector("#pageNotice"),
        "success", result.message);
      e.target.reset();
      await loadMaterialsTable();
    });
  });

  if (document.querySelector("#materialsTable")) {
    await loadMaterialsTable();
  }
}

function renderMaterialsHub() {

  console.log("manage_materials =", has("manage_materials"));

  const links = [];

  // ظ„ظ„ط¬ظ…ظٹط¹
  links.push(
    studentHubLink(
      "materials-add",
      "إنشاء طلب مواد",
      "إنشاء طلب جديد للمواد"
    )
  );

  links.push(
    studentHubLink(
      "materials-my",
      "سجل طلباتي",
      "عرض طلبات المواد السابقة"
    )
  );

  // ظ„ظ„ط¥ط¯ط§ط±ط© ظپظ‚ط·
  if (has("manage_materials") || hasRole("system_admin")) {


    links.push(
      studentHubLink(
        "materials-manage-requests",
        "إدارة الطلبات",
        "اعتماد ومتابعة طلبات المواد"
      )
    );

    links.push(
      studentHubLink(
        "materials-manage",
        "إدارة المواد",
        "إضافة وتعديل المواد واستيراد ملف Excel"
      )
    );

  }

  page(
    "طلب المواد",
    "اختاري الخدمة المطلوبة.",
    `
      <nav
        class="student-services-list"
        aria-label="خدمات طلب المواد"
      >
        ${links.join("")}
      </nav>
    `
  );
}
async function renderMaterialsMy() {

  page(
    "سجل طلباتي",
    "عرض طلبات المواد السابقة.",
    `
      <div id="requestTable" class="table-wrap">
      <div class="empty-state">جارٍ التحميل...</div>
      </div>
    `
  );

  await loadRequestRows(
    requestPages.materials,
    "materials-my"
  );
}


async function renderMaterialsList() {

  page(
    "قائمة المواد المتاحة",
    "عرض جميع المواد المتوفرة.",
    `
      <div id="materialsTableContainer" class="table-wrap">
        <div class="empty-state">
          جاري التحميل...
        </div>
      </div>
    `
  );

  await loadMaterialsLookupTable();
}
async function renderMaterialsManage() {

  page(
    "إدارة المواد",
    "إضافة وتعديل وحذف المواد واستيراد ملف Excel.",
    `

  <div class="materials-toolbar">

  <div class="materials-search">
    <input
      id="materialSearch"
      class="form-control"
      placeholder=" البحث برمز المادة أو اسم المادة">
  </div>

  <div class="form-actions">
    <button
      id="addMaterialButton"
      class="btn">
      إضافة مادة
    </button>

    <button
      id="importMaterialsButton"
      class="btn btn-secondary">
      استيراد Excel
    </button>
  </div>

</div>


</div>


<div id="materialsTable" class="table-wrap">
  <!-- سيتم ملء الجدول من loadMaterialsTable -->
</div>
    `
  );

  document
    .querySelector("#materialUploadForm")
    ?.addEventListener("submit", previewMaterialFile);

  await loadMaterialsTable();
  document.getElementById("addMaterialButton")?.addEventListener("click", () => {
    addMaterialModal();
  });

  document
    .getElementById("importMaterialsButton")
    ?.addEventListener("click", () => {
      importMaterialsExcel();
    });

  document.getElementById("materialSearch").addEventListener("input", (e) => {
    const value = e.target.value.toLowerCase();
    document.querySelectorAll("#materialsTable tbody tr").forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(value)
        ? ""
        : "none";
    });

  });

}

async function addMaterialModal() {

  const dialog = document.createElement("dialog");

  dialog.innerHTML = `
    <div class="material-modal">

      <h4>إضافة مادة جديدة</h4>

      <label>اسم المادة <span class="required">*</span></label>
      <input id="materialName" type="text" placeholder="أدخل اسم المادة">

      <label>رقم المادة <span class="required">*</span></label>
<input id="materialNumber" type="text" placeholder="أدخل رقم المادة">

      <label>رمز المادة <span class="required">*</span></label>
      <input id="materialCode" type="text" placeholder="أدخل رمز المادة">

      <label>الوحدة <span class="required">*</span></label>
      <input id="materialUnit" type="text" placeholder="أدخل الوحدة (مثل: كيس، لتر، علبة)">

      <label>وصف الكمية (اختياري)</label>
      <input id="quantityDescription" type="text" placeholder="مثل: 500 غرام">

      <div class="material-modal-actions">
        <button type="button" id="cancelBtn" class="btn-cancel">
          إلغاء
        </button>

        <button type="button" id="saveBtn" class="btn-save">
          إضافة
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(dialog);
  dialog.showModal();

  document.getElementById("cancelBtn").onclick = () => {
    dialog.close();
    dialog.remove();
  };

  document.getElementById("saveBtn").onclick = async () => {

    const name = document.getElementById("materialName").value.trim();
    const itemNumber = document
      .getElementById("materialNumber")
      .value
      .trim();
    const code = document.getElementById("materialCode").value.trim();
    const unit = document.getElementById("materialUnit").value.trim();
    const quantityDesc = document.getElementById("quantityDescription").value.trim();

    // ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط§ظ„ط­ظ‚ظˆظ„ ط§ظ„ط¥ط¬ط¨ط§ط±ظٹط©
    if (!name || !itemNumber || !code || !unit) {
      alert("يرجى تعبئة جميع الحقول الإجبارية (رقم المادة، اسم المادة، رمز المادة، الوحدة)"); return;
    }

    try {
      // طھظˆظ„ظٹط¯ ط±ظ‚ظ… ظ…ط§ط¯ط© طھظ„ظ‚ط§ط¦ظٹ ظپط±ظٹط¯

      const payload = {
        nameAr: name,
        code: code,
        units: unit,
        itemNumber: itemNumber, // ط¥ط¶ط§ظپط© ط±ظ‚ظ… ط§ظ„ظ…ط§ط¯ط© ط§ظ„طھظ„ظ‚ط§ط¦ظٹ
        quantityDescription: quantityDesc || "" // ط¥ط±ط³ط§ظ„ ظˆطµظپ ط§ظ„ظƒظ…ظٹط© ط¥ظ† ظˆظڈط¬ط¯
      };

      console.log(
        "ADD PAYLOAD =",
        JSON.stringify(payload, null, 2)
      );
      await api.post("/requests/materials/manage", payload);
      dialog.close();
      dialog.remove();

      setNotice(
        document.querySelector("#pageNotice"),
        "success",
        "تمت إضافة المادة بنجاح"
      );

      await loadMaterialsTable();

    } catch (error) {

      console.error("ADD ERROR:", error);

      showError(error);

    }
  };
}

async function importMaterialsExcel() {

  const input = document.createElement("input");

  input.type = "file";
  input.accept = ".xlsx,.xls";

  input.onchange = async () => {

    const file = input.files[0];

    if (!file) return;

    const formData = new FormData();

    formData.append("file", file);

    console.log(
      "FILE CHECK",
      formData.get("file")
    );

    try {

      const response = await apiFetch(
        "/requests/materials/import",
        {
          method: "POST",
          body: formData
        }
      );

      console.log("IMPORT RESPONSE =", response);

      setNotice(
        document.querySelector("#pageNotice"),
        "success",
        response?.data?.message || "تم الاستيراد بنجاح"
      );

      await loadMaterialsTable();

      const reloadResponse = await api.get(
        "/requests/materials-list?_=" + Date.now()
      );

      console.log(
        "AFTER IMPORT =",
        reloadResponse.data
      );

    } catch (error) {

      console.error("IMPORT ERROR =", error);

      if (error?.response) {
        console.error(
          "SERVER RESPONSE =",
          error.response
        );
      }

      showError(error);

    }

  };

  input.click();

}
async function previewMaterialFile(event) {

  event.preventDefault();

  await importMaterialsExcel();

}
// ط§ظ„ط´ط±ط§ظƒط© ط§ظ„ظ…ط¬طھظ…ط¹ظٹط©

async function renderCommunityMy() {

  page(
    "سجل طلباتي",
    "عرض طلبات الشراكة السابقة.",
    `
      <div id="requestTable" class="table-wrap">
        <div class="empty-state">جارٍ التحميل...</div>
      </div>
    `
  );

  await loadRequestRows(
    { ...requestPages.community, path: "/requests/community?scope=mine&limit=200" },
    "community-my"
  );
}

async function renderCommunityManage() {

  page(
    "إدارة طلبات الشراكة",
    "مراجعة واعتماد طلبات الشراكة.",
    `
      <div id="requestTable" class="table-wrap">
        <div class="empty-state">جارٍ التحميل...</div>
      </div>
    `
  );

  await loadRequestRows(
    { ...requestPages.community, path: "/requests/community?scope=all&limit=200" },
    "community-manage"
  );
}

function renderCommunityHub() {

  const links = [];

  links.push(
    studentHubLink(
      "community-add",
      "تقديم طلب شراكة",
      "تسجيل شراكة مجتمعية جديدة"
    )
  );

  links.push(
    studentHubLink(
      "community-my",
      "سجل طلباتي",
      "عرض طلبات الشراكة السابقة"
    )
  );

  if (
    has("manage_community") ||
    hasRole("system_admin")
  ) {

    links.push(
      studentHubLink(
        "community-manage",
        "إدارة طلبات الشراكة",
        "مراجعة واعتماد طلبات الشراكة"
      )
    );

  }

  page(
    "الشراكة المجتمعية",
    "اختاري الخدمة المطلوبة.",
    `
      <nav
        class="student-services-list"
        aria-label="خدمات الشراكة المجتمعية">
        ${links.join("")}
      </nav>
    `
  );

}
