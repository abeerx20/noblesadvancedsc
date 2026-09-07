import { FieldValue } from "firebase-admin/firestore";
import { auth, db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";

function compatibleEmployee(snapshot) {
  const employee = publicDocument(snapshot);
  if (!employee) return null;
  return {
    ...employee,
    nameAr: employee.nameAr ?? employee.fullName ?? employee.name ?? employee.email ?? "موظفة غير مسماة",
    nameEn: employee.nameEn ?? "",
    employeeNumber: employee.employeeNumber ?? employee.employeeId ?? "—",
    status: employee.status ?? "active"
  };
}

export async function getEmployeeByUid(uid) {
  const direct = await db.collection("employees").doc(uid).get();
  if (direct.exists) return compatibleEmployee(direct);
  const query = await db.collection("employees").where("authUid", "==", uid).limit(1).get();
  if (query.empty) throw new AppError(404, "EMPLOYEE_NOT_FOUND", "الموظفة المحددة غير موجودة أو غير مرتبطة بحساب.");
  return compatibleEmployee(query.docs[0]);
}

export async function listEmployees(limit = 200) {
  const snapshot = await db.collection("employees").limit(limit).get();
  return snapshot.docs
    .map(compatibleEmployee)
    .map((employee) => ({
      id: employee.id,
      authUid: employee.authUid,
      nameAr: employee.nameAr,
      nameEn: employee.nameEn,
      email: employee.email,
      employeeNumber: employee.employeeNumber,
      role: employee.role,
      status: employee.status
    }))
    .sort((a, b) => String(a.nameAr ?? "").localeCompare(String(b.nameAr ?? ""), "ar"));
}

export async function createEmployee(data, actor) {
  const { password, ...employeeData } = data;
  const normalizedStatus = employeeData.status === "inactive" ? "inactive" : "active";
  const protectedRoles = new Set(["principal", "vice_principal", "admin", "system_admin", "schedule_admin", "upper_management"]);
  if (actor.employee?.role !== "system_admin" && protectedRoles.has(employeeData.role)) {
    throw new AppError(403, "ROLE_ASSIGNMENT_FORBIDDEN", "لا يمكنك إنشاء موظفة بهذا الدور.");
  }
  const [emailDuplicate, nationalIdDuplicate, numberDuplicate, authUidDuplicate] = await Promise.all([
    db.collection("employees").where("email", "==", employeeData.email).limit(1).get(),
    db.collection("employees").where("nationalId", "==", employeeData.nationalId).limit(1).get(),
    db.collection("employees").where("employeeNumber", "==", employeeData.employeeNumber).limit(1).get(),
    employeeData.authUid
      ? db.collection("employees").where("authUid", "==", employeeData.authUid).limit(1).get()
      : Promise.resolve({ empty: true })
  ]);
  if (!emailDuplicate.empty) throw new AppError(409, "DUPLICATE_EMPLOYEE", "يوجد ملف موظفة بهذا البريد مسبقًا.");
  if (!nationalIdDuplicate.empty) throw new AppError(409, "DUPLICATE_EMPLOYEE", "يوجد ملف موظفة برقم الهوية مسبقًا.");
  if (!numberDuplicate.empty) throw new AppError(409, "DUPLICATE_EMPLOYEE", "يوجد ملف موظفة بالرقم الوظيفي مسبقًا.");
  if (!authUidDuplicate.empty) throw new AppError(409, "DUPLICATE_EMPLOYEE", "معرّف تسجيل الدخول مرتبط بموظفة أخرى.");

  let authUid = employeeData.authUid;
  if (!authUid && password) {
    const createdUser = await auth.createUser({
      email: employeeData.email,
      password,
      displayName: employeeData.nameAr || employeeData.nameEn,
      phoneNumber: employeeData.phone ? `+966${String(employeeData.phone).replace(/^0+/, "")}` : undefined
    });
    authUid = createdUser.uid;
  }

  const documentId = authUid ?? db.collection("employees").doc().id;
  const existingDocument = await db.collection("employees").doc(documentId).get();
  if (existingDocument.exists) throw new AppError(409, "DUPLICATE_EMPLOYEE", "يوجد ملف مرتبط بمعرّف تسجيل الدخول مسبقًا.");
  await db.collection("employees").doc(documentId).set({
    ...employeeData,
    status: normalizedStatus,
    ...(authUid ? { authUid } : {}),
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await db.collection("accessControl").doc(documentId).set({
    active: normalizedStatus === "active",
    updatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return documentId;
}

export async function updateAccess(actor, targetUid, changes) {
  if (actor.uid === targetUid) {
    throw new AppError(403, "SELF_PERMISSION_CHANGE_FORBIDDEN", "لا يمكنك تغيير صلاحيات حسابك بنفسك.");
  }
  const employee = await db.collection("employees").doc(targetUid).get();
  const mapped = employee.exists
    ? employee
    : (await db.collection("employees").where("authUid", "==", targetUid).limit(1).get()).docs[0];
  if (!mapped) throw new AppError(404, "EMPLOYEE_NOT_FOUND", "لا يوجد حساب موظفة مرتبط بالمعرّف المحدد.");

  if (Object.prototype.hasOwnProperty.call(changes, "active")) {
    const nextStatus = changes.active === true ? "active" : "inactive";
    await mapped.ref.update({
      status: nextStatus,
      updatedAt: FieldValue.serverTimestamp()
    });
  }

  await db.collection("accessControl").doc(targetUid).set({
    ...changes,
    updatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function getAccess(targetUid) {
  const snapshot = await db.collection("accessControl").doc(targetUid).get();
  return snapshot.exists ? { uid: targetUid, ...snapshot.data() } : { uid: targetUid, active: false };
}
