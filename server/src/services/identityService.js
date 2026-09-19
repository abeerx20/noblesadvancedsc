import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { normalizeEmail, publicDocument } from "../utils/text.js";

async function findEmployee(uid, email) {
  const direct = await db.collection("employees").doc(uid).get();
  if (direct.exists) return direct;

  const byUid = await db.collection("employees").where("authUid", "==", uid).limit(1).get();
  if (!byUid.empty) return byUid.docs[0];

  if (email) {
    const byEmail = await db.collection("employees")
      .where("email", "==", normalizeEmail(email))
      .limit(1)
      .get();
    if (!byEmail.empty) return byEmail.docs[0];
  }

  return null;
}

async function findParent(uid, email) {
  const direct = await db.collection("parents").doc(uid).get();
  if (direct.exists) return direct;
  const byUid = await db.collection("parents").where("authUid", "==", uid).limit(1).get();
  if (!byUid.empty) return byUid.docs[0];
  if (email) {
    const byEmail = await db.collection("parents").where("email", "==", normalizeEmail(email)).limit(1).get();
    if (!byEmail.empty) return byEmail.docs[0];
  }
  return null;
}

function activeStatus(value) {
  return value === "active" || value === "نشط" || value === true;
}

function normalizeRole(value) {
  return {
    "الإدارة العليا": "upper_management",
    "الموارد البشرية والمالية": "resource_user",
    "الموارد البشرية": "hr"
  }[value] ?? value;
}

export async function loadIdentity(decodedToken) {
  const [employeeSnapshot, accessSnapshot] = await Promise.all([
    findEmployee(decodedToken.uid, decodedToken.email),
    db.collection("accessControl").doc(decodedToken.uid).get()
  ]);

  if (!employeeSnapshot) {
    const parentSnapshot = await findParent(decodedToken.uid, decodedToken.email);
    if (!parentSnapshot) throw new AppError(403, "PROFILE_NOT_FOUND", "لا يوجد ملف مستخدم مرتبط بهذا الحساب.");
    const parent = publicDocument(parentSnapshot);
    if (!activeStatus(parent.status)) throw new AppError(403, "ACCOUNT_INACTIVE", "الحساب غير نشط. يرجى التواصل مع المدرسة.");
    return {
      uid: decodedToken.uid,
      email: normalizeEmail(decodedToken.email ?? parent.email),
      userType: "parent",
      parent,
      employee: { id: parent.id, nameAr: parent.nameAr ?? parent.fullName, nameEn: parent.nameEn ?? "", employeeNumber: "—", role: "parent", status: parent.status },
      permissions: ["view_own_children", "view_own_attendance", "request_support"],
      access: {}
    };
  }
  if (!accessSnapshot.exists) {
    throw new AppError(403, "ACCESS_PROFILE_NOT_FOUND", "لم تُضبط صلاحيات هذا الحساب بعد.");
  }

  const employee = { ...publicDocument(employeeSnapshot), role: normalizeRole(publicDocument(employeeSnapshot).role) };
  const access = accessSnapshot.data();
  if (!activeStatus(employee.status) || access.active !== true) {
    throw new AppError(403, "ACCOUNT_INACTIVE", "الحساب غير نشط. يرجى التواصل مع مسؤولة النظام.");
  }

  const permissions = Object.entries(access)
    .filter(([key, value]) => key !== "active" && !(employee.role === "resource_user" && key === "manage_permissions") && value === true)
    .map(([key]) => key);
  if (employee.role === "upper_management") {
    permissions.push(
      "view_students", "view_all_students", "manage_students", "view_attendance", "manage_attendance", "enter_attendance",
      "manage_absence", "attendance_override", "view_schedules", "view_all_schedules", "manage_schedules", "view_substitution_assignments",
      "request_leave", "manage_leave_requests", "manage_leave_hr_requests", "request_training", "manage_training_requests",
      "issue_work_assignments", "view_all_work_assignments", "request_assets", "manage_assets", "request_loans", "manage_loans",
      "manage_employees", "manage_announcements", "request_materials", "manage_materials", "manage_invoices",
      "request_suggestions", "request_support", "manage_support", "request_absence", "request_community", "manage_community"
    );
  }
  if (employee.role === "resource_user") {
    permissions.push("manage_employees", "manage_leave_requests", "manage_absence", "manage_leave_hr_requests", "manage_assets", "manage_loans", "manage_materials", "manage_invoices");
  }
  if (!permissions.includes("request_support")) permissions.push("request_support");

  return {
    uid: decodedToken.uid,
    email: normalizeEmail(decodedToken.email ?? employee.email),
    userType: "employee",
    employee,
    permissions,
    access
  };
}
