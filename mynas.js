import { api } from "./api.js";
import { logout } from "./firebase-client.js";
import { setNotice } from "./ui.js";

const roleLabels = {
  teacher: "معلمة", principal: "مديرة المدرسة", vice_principal: "وكيلة", hr: "الموارد البشرية",
  it: "تقنية المعلومات", it_teacher: "تقنية المعلومات", admin: "إدارية", registrar: "القبول والتسجيل",
  accountant: "المحاسبة", doctor: "طبيبة", system_admin: "مسؤولة النظام",
  schedule_admin: "مسؤولة الجداول", upper_management: "الإدارة العليا"
};
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const demoParent = new URLSearchParams(location.search).get("parent") === "1";

const services = [
  { title: "بوابة الموظفة", description: "الخدمات الأكاديمية والإدارية والذاتية", href: "employee-portal.html", icon: "assets/icons/portal.svg", permission: null },
  { title: "Microsoft Outlook ", description: "المراسلة عبر البريد الوظيفي", href: "https://outlook.office.com/mail/", icon: "assets/icons/outlook.svg", permission: null, external: true },
  { title: "الدعم الفني", description: "رفع ومتابعة طلبات الدعم", href: "employee-portal.html#support", icon: "assets/icons/support.svg", permission: null },
  { title: "Microsoft Teams", description: "الاجتماعات والفصول الافتراضية", href: "https://teams.microsoft.com/", icon: "assets/icons/teams.svg", permission: null, external: true },
  { title: "Microsoft Bookings", description: "إدارة المواعيد عبر Microsoft Bookings", href: "https://outlook.office.com/bookings/", icon: "assets/icons/bookings.svg", permission: null, external: true }
];
const parentServices = [
  { title: "بوابة ولي الأمر", description: "بيانات الأبناء والحضور والإعلانات", href: "parent-portal.html#children", icon: "assets/icons/portal.svg", permission: null },
  { title: "Microsoft Outlook", description: "المراسلة عبر البريد الإلكتروني", href: "https://outlook.office.com/mail/", icon: "assets/icons/outlook.svg", permission: null, external: true },
  { title: "الدعم الفني", description: "التواصل مع دعم المدرسة", href: "parent-portal.html#support", icon: "assets/icons/support.svg", permission: null },
  { title: "Microsoft Bookings", description: "إدارة المواعيد عبر Microsoft Bookings", href: "https://outlook.office.com/bookings/", icon: "assets/icons/bookings.svg", permission: null, external: true }
];

function addService(grid, service) {
  const link = document.createElement("a");
  link.className = "service-card page-card";
  link.href = service.href;
  if (service.external) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
  const icon = document.createElement("span");
  icon.className = "service-card-icon";

  const iconImage = document.createElement("img"); iconImage.src = service.icon; iconImage.alt = ""; icon.append(iconImage);
  const body = document.createElement("div");
  const heading = document.createElement("h2"); heading.textContent = service.title;
  const description = document.createElement("p"); description.textContent = service.description;
  body.append(heading, description); link.append(icon, body); grid.append(link);
}

async function init() {
  try {
    let data;
    if (demoMode && demoParent) {
      data = { userType: "parent", permissions: ["view_own_children", "view_own_attendance", "request_support"] };
      document.querySelector("#welcomeName").textContent = "بوابة ولي الأمر";
      document.querySelector("#semesterText").textContent = "الفصل الدراسي الحالي";
    } else {
      data = (await api.get("/me")).data;
      const firstName = data.employee.nameAr?.split(" ")[0] ?? "";
      document.querySelector("#welcomeName").textContent = `مرحبًا بكِ، ${firstName}`;
    }
    const isParent = data.userType === "parent";

    try {
      if (demoMode && demoParent) throw new Error("demo");
      const settings = (await api.get("/site-settings")).data;
      document.querySelector("#semesterText").textContent = `${settings.semester} ${settings.academicYear ?? ""}`.trim();
    } catch {
      document.querySelector("#semesterText").textContent = "الفصل الدراسي الحالي";
    }

    const granted = new Set(data.permissions);
    const grid = document.querySelector("#servicesGrid");
    (isParent ? parentServices : services).filter((service) => !service.permission || granted.has(service.permission)).forEach((service) => {
      if (demoMode && demoParent) service.href = service.href.replace("parent-portal.html", "parent-portal.html?demo=1");
      addService(grid, service);
    });
  } catch (error) {
    setNotice(document.querySelector("#pageNotice"), "error", error.message);
  }
}

document.querySelector("#logoutButton").addEventListener("click", async () => {
  await logout();
  window.location.replace("login.html");
});

init();
