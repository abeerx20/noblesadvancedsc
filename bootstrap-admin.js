import { FieldValue } from "firebase-admin/firestore";
import { db } from "../src/config/firebase.js";

const required = ["BOOTSTRAP_UID", "ADMIN_EMAIL", "ADMIN_NAME_AR", "ADMIN_NAME_EN", "ADMIN_EMPLOYEE_NUMBER"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  console.error(`إعدادات مطلوبة: ${missing.join(", ")}`);
  process.exit(1);
}

const uid = process.env.BOOTSTRAP_UID;
const permissions = [
  "view_students", "view_all_students", "manage_students", "view_attendance", "manage_attendance", "enter_attendance", "attendance_override",
  "view_schedules", "view_all_schedules", "manage_schedules", "request_leave", "manage_leave_requests", "request_training", "manage_training_requests",
  "issue_work_assignments", "view_all_work_assignments", "request_assets", "manage_assets", "request_loans", "manage_loans", "manage_employees",
  "manage_permissions", "manage_announcements", "view_reports", "upload_files", "request_support", "manage_support", "request_materials", "request_suggestions"
];

const access = { active: true };
permissions.forEach((permission) => { access[permission] = true; });

await db.runTransaction(async (transaction) => {
  const employeeRef = db.collection("employees").doc(uid);
  const accessRef = db.collection("accessControl").doc(uid);
  transaction.set(employeeRef, {
    authUid: uid,
    email: process.env.ADMIN_EMAIL.trim().toLowerCase(),
    nameAr: process.env.ADMIN_NAME_AR.trim(),
    nameEn: process.env.ADMIN_NAME_EN.trim(),
    employeeNumber: process.env.ADMIN_EMPLOYEE_NUMBER.trim(),
    role: "system_admin",
    status: "active",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  transaction.set(accessRef, { ...access, updatedBy: "bootstrap", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
});

console.info("تم إنشاء ملف مسؤولة النظام وصلاحيات الاختبار بنجاح.");

