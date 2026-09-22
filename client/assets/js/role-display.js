const ROLE_TITLES = {
    teacher: "معلمة",
    principal: "مديرة",
    vice_principal: "وكيلة",
    hr: "الموارد البشرية",
    resource_user: "الموارد البشرية والمالية",
    it: "تقنية المعلومات",
    it_teacher: "تقنية المعلومات",
    admin: "إدارية",
    registrar: "القبول والتسجيل",
    accountant: "المحاسبة",
    doctor: "طبيبة",
    system_admin: "مسؤولة النظام",
    schedule_admin: "مسؤولة الجداول",
    upper_management: "الإدارة العليا"
};

function normalizeRoleKey(role) {
    if (role == null || role === "") return "";
    return String(role).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function getRoleTitle(role) {
    if (!role) return "";
    const normalized = normalizeRoleKey(role);
    if (!normalized) return "";
    return ROLE_TITLES[normalized] ?? String(role).trim();
}
