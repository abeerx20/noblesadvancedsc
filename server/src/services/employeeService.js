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

export async function resolveEmployeeDocument(targetId, firestoreDb = db) {
  const value = String(targetId ?? "").trim();
  if (!value) return null;

  const direct = await firestoreDb.collection("employees").doc(value).get();
  if (direct.exists) return direct;

  const byAuthUid = await firestoreDb.collection("employees").where("authUid", "==", value).limit(1).get();
  if (!byAuthUid.empty) return byAuthUid.docs[0];

  if (value.includes("@")) {
    const byEmail = await firestoreDb.collection("employees").where("email", "==", value.toLowerCase()).limit(1).get();
    if (!byEmail.empty) return byEmail.docs[0];
  }

  const byEmployeeNumber = await firestoreDb.collection("employees").where("employeeNumber", "==", value).limit(1).get();
  if (!byEmployeeNumber.empty) return byEmployeeNumber.docs[0];

  return null;
}

export async function getEmployeeByUid(uid) {
  const employeeDoc = await resolveEmployeeDocument(uid);
  if (!employeeDoc) throw new AppError(404, "EMPLOYEE_NOT_FOUND", "الموظفة المحددة غير موجودة أو غير مرتبطة بحساب.");
  return compatibleEmployee(employeeDoc);
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
      status: employee.status,
      password: employee.password ?? "",
      hasPassword: Boolean(employee.password || employee.authUid)
    }))
    .sort((a, b) => String(a.nameAr ?? "").localeCompare(String(b.nameAr ?? ""), "ar"));
}

export async function createEmployee(data, actor) {
  const { password, ...employeeData } = data;
  if (actor.employee?.role === "resource_user" && password) {
    throw new AppError(403, "ACCOUNT_CREATION_FORBIDDEN", "مسؤولة الموارد تضيف بيانات الموظفة فقط، وإنشاء المستخدم والصلاحيات متاح لمسؤولة النظام.");
  }
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
    let createdUser;
    try {
      createdUser = await auth.createUser({
        email: employeeData.email,
        password,
        displayName: employeeData.nameAr || employeeData.nameEn,
        phoneNumber: employeeData.phone ? `+966${String(employeeData.phone).replace(/^0+/, "")}` : undefined
      });
    } catch (error) {
      const messages = {
        "auth/email-already-exists": "يوجد حساب مستخدم بهذا البريد الإلكتروني مسبقًا.",
        "auth/invalid-phone-number": "رقم الجوال غير صالح.",
        "auth/phone-number-already-exists": "رقم الجوال مرتبط بحساب آخر.",
        "auth/invalid-password": "كلمة المرور غير صالحة.",
        "auth/invalid-email": "البريد الإلكتروني غير صالح."
      };
      const message = messages[error.code];
      if (message) throw new AppError(409, "AUTH_ACCOUNT_EXISTS", message);
      throw error;
    }
    authUid = createdUser.uid;
  }

  const documentId = authUid ?? db.collection("employees").doc().id;
  const existingDocument = await db.collection("employees").doc(documentId).get();
  if (existingDocument.exists) throw new AppError(409, "DUPLICATE_EMPLOYEE", "يوجد ملف مرتبط بمعرّف تسجيل الدخول مسبقًا.");
  await db.collection("employees").doc(documentId).set({
    ...employeeData,
    ...(password ? { password } : {}),
    status: normalizedStatus,
    ...(authUid ? { authUid } : {}),
    createdBy: actor.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await db.collection("accessControl").doc(documentId).set({
    active: normalizedStatus === "active",
    ...(employeeData.role === "upper_management" ? {
      view_students: true, view_all_students: true, manage_students: true, view_attendance: true, manage_attendance: true, enter_attendance: true,
      manage_absence: true, attendance_override: true, view_schedules: true, view_all_schedules: true, manage_schedules: true, view_substitution_assignments: true,
      request_leave: true, manage_leave_requests: true, manage_leave_hr_requests: true, request_training: true, manage_training_requests: true,
      issue_work_assignments: true, view_all_work_assignments: true, request_assets: true, manage_assets: true, request_loans: true, manage_loans: true,
      manage_employees: true, manage_announcements: true, request_materials: true, manage_materials: true, manage_invoices: true,
      request_suggestions: true, request_support: true, manage_support: true, request_absence: true, request_community: true, manage_community: true
    } : employeeData.role === "resource_user" ? {
      manage_employees: true,
      manage_leave_requests: true,
      manage_absence: true,
      manage_leave_hr_requests: true,
      manage_assets: true,
      manage_loans: true,
      manage_materials: true,
      manage_invoices: true
    } : {}),
    updatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return documentId;
}

export async function updateAccess(actor, targetUid, changes) {
  if (actor.uid === targetUid) {
    throw new AppError(403, "SELF_PERMISSION_CHANGE_FORBIDDEN", "لا يمكنك تغيير صلاحيات حسابك بنفسك.");
  }
  const mapped = await resolveEmployeeDocument(targetUid);
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
  const employeeDoc = await resolveEmployeeDocument(targetUid);
  const employee = employeeDoc?.data();
  const defaults = employee?.role === "upper_management" ? {
    view_students: true, view_all_students: true, manage_students: true, view_attendance: true, manage_attendance: true, enter_attendance: true,
    manage_absence: true, attendance_override: true, view_schedules: true, view_all_schedules: true, manage_schedules: true, view_substitution_assignments: true,
    request_leave: true, manage_leave_requests: true, manage_leave_hr_requests: true, request_training: true, manage_training_requests: true,
    issue_work_assignments: true, view_all_work_assignments: true, request_assets: true, manage_assets: true, request_loans: true, manage_loans: true,
    manage_employees: true, manage_announcements: true, request_materials: true, manage_materials: true, manage_invoices: true,
    request_suggestions: true, request_support: true, manage_support: true, request_absence: true, request_community: true, manage_community: true
  } : employee?.role === "resource_user" ? {
    manage_employees: true,
    manage_leave_requests: true,
    manage_absence: true,
    manage_leave_hr_requests: true,
    manage_assets: true,
    manage_loans: true,
    manage_materials: true,
    manage_invoices: true
  } : {};
  return snapshot.exists ? { uid: targetUid, ...defaults, ...snapshot.data() } : { uid: targetUid, active: false, ...defaults };
}

export async function resetEmployeePassword(actor, targetId, newPassword) {
  if (!newPassword || newPassword.trim().length < 6) {
    throw new AppError(400, "INVALID_PASSWORD", "كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
  }

  const employeeDoc = await resolveEmployeeDocument(targetId);
  if (!employeeDoc) throw new AppError(404, "EMPLOYEE_NOT_FOUND", "لا يوجد موظفة لهذا المعرف.");

  const employee = employeeDoc.data();
  const email = employee.email;
  if (!email) throw new AppError(400, "MISSING_EMAIL", "لا يوجد بريد إلكتروني مرتبطة بهذه الموظفة لإعادة تعيين كلمة المرور.");

  let authUid = employee.authUid;
  if (!authUid) {
    try {
      const user = await auth.getUserByEmail(email);
      authUid = user.uid;
    } catch {
      // No linked auth user exists yet; this is the legacy-case migration path.
    }
  }

  if (!authUid) {
    const createdUser = await auth.createUser({
      email,
      password: newPassword.trim(),
      displayName: employee.nameAr || employee.nameEn || email,
      phoneNumber: employee.phone ? `+966${String(employee.phone).replace(/^0+/, "")}` : undefined
    });
    authUid = createdUser.uid;
  } else {
    await auth.updateUser(authUid, { password: newPassword.trim() });
  }

  await employeeDoc.ref.update({
    authUid,
    updatedAt: FieldValue.serverTimestamp()
  });

  await db.collection("accessControl").doc(employeeDoc.id).set({
    updatedBy: actor.uid,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function deleteEmployee(actor, targetId) {
  const employeeDoc = await resolveEmployeeDocument(targetId);
  if (!employeeDoc) throw new AppError(404, "EMPLOYEE_NOT_FOUND", "لا يوجد موظفة لهذا المعرف.");

  const employee = employeeDoc.data();
  const authUid = employee.authUid;

  if (authUid && actor.uid === authUid) {
    throw new AppError(403, "SELF_DELETE_FORBIDDEN", "لا يمكنك حذف حسابك الشخصي من هذا القسم.");
  }

  if (authUid) {
    try {
      await auth.deleteUser(authUid);
    } catch {
      // Ignore auth deletion failures so the local employee record is still handled.
    }
  }

  const documentId = employeeDoc.id;
  await employeeDoc.ref.delete();
  await db.collection("accessControl").doc(documentId).delete().catch(() => { });
}
