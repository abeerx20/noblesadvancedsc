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

  const employee = publicDocument(employeeSnapshot);
  const access = accessSnapshot.data();
  if (!activeStatus(employee.status) || access.active !== true) {
    throw new AppError(403, "ACCOUNT_INACTIVE", "الحساب غير نشط. يرجى التواصل مع مسؤولة النظام.");
  }

  const permissions = Object.entries(access)
    .filter(([key, value]) => key !== "active" && value === true)
    .map(([key]) => key);
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
