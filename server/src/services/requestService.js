import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";
import { inclusiveDays, toMinutes } from "../utils/time.js";
import { getEmployeeByUid } from "./employeeService.js";
import { notifyEmployee as createNotification } from "./notificationService.js";

const managerRoles = new Set(["principal", "vice_principal", "admin"]);

async function notifyLeaveRecipients(requestId, recipientType, request) {
  const employees = await db.collection("employees").limit(500).get();
  const recipients = employees.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((employee) => employee.status === "active")
    .filter((employee) => recipientType === "manager"
      ? managerRoles.has(employee.role)
      : employee.role === "hr")
    .map((employee) => employee.authUid ?? employee.id)
    .filter((uid) => uid && uid !== request.employeeUid);

  if (!recipients.length) return;

  const batch = db.batch();
  recipients.forEach((recipientUid) => {
    const notificationRef = db.collection("notifications").doc();
    batch.set(notificationRef, {
      recipientUid,
      type: "leave_request",
      title: recipientType === "manager" ? "طلب إجازة جديد بانتظار المراجعة" : "طلب إجازة محال من المديرة",
      leaveRequestId: requestId,
      employeeName: request.employeeName,
      startDate: request.startDate,
      endDate: request.endDate,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

async function notifyEmployee(requestId, recipientUid, title, request) {
  const notificationRef = db.collection("notifications").doc();
  await notificationRef.set({
    recipientUid,
    type: "leave_decision",
    title,
    leaveRequestId: requestId,
    status: request.status,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  });
}

async function notifySuggestionRecipients(requestId, request) {
  const roleByDestination = { manager: new Set(["principal", "vice_principal", "admin"]), hr: new Set(["hr"]), support: new Set(["it", "it_teacher"]) };
  const roles = roleByDestination[request.destination];
  if (!roles) return;
  const employees = await db.collection("employees").limit(500).get();
  const recipients = employees.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((employee) => employee.status === "active" && roles.has(employee.role))
    .map((employee) => employee.authUid ?? employee.id)
    .filter(Boolean);
  if (!recipients.length) return;
  const batch = db.batch();
  recipients.forEach((recipientUid) => {
    batch.set(db.collection("notifications").doc(), {
      recipientUid,
      type: "suggestion_request",
      title: request.type === "complaint" ? "شكوى جديدة بانتظار المراجعة" : "اقتراح جديد بانتظار المراجعة",
      suggestionRequestId: requestId,
      destination: request.destination,
      employeeName: request.employeeName,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

async function notifyRequestManagers(requestId, request, type, title) {
  const managers = await db.collection("employees").limit(500).get();
  const recipients = managers.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((employee) => employee.status === "active" && ["principal", "vice_principal", "admin", "system_admin"].includes(employee.role))
    .map((employee) => employee.authUid ?? employee.id)
    .filter(Boolean)
    .filter((uid) => uid !== request.employeeUid);

  if (!recipients.length) return;

  const batch = db.batch();
  recipients.forEach((recipientUid) => {
    batch.set(db.collection("notifications").doc(), {
      recipientUid,
      type,
      title,
      requestId,
      employeeName: request.employeeName,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
}

export async function createLeave(user, data) {
  const durationDays = inclusiveDays(data.startDate, data.endDate);
  const request = {
    ...data,
    employeeUid: user.uid,
    employeeId: user.employee.id,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    durationDays,
    requestKind: "leave",
    status: "بانتظار المديرة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  };
  const ref = await db.collection("leaveRequests").add(request);
  await notifyLeaveRecipients(ref.id, "manager", request);
  return ref.id;
}

export async function createSuggestion(user, data) {
  const request = {
    ...data,
    employeeUid: user.uid,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    employeeEmail: user.email,
    status: "قيد المراجعة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  };
  const ref = await db.collection("suggestionRequests").add(request);
  await notifySuggestionRecipients(ref.id, request);
  return ref.id;
}

export async function createLeaveExtension(user, data) {
  const parentSnapshot = await db.collection("leaveRequests").doc(data.parentLeaveId).get();
  if (!parentSnapshot.exists || parentSnapshot.data().employeeUid !== user.uid) {
    throw new AppError(404, "LEAVE_NOT_FOUND", "الإجازة غير موجودة.");
  }
  const parent = parentSnapshot.data();
  if (!["معتمد", "تمديد معتمد"].includes(parent.status) || data.endDate <= parent.endDate) {
    throw new AppError(422, "INVALID_LEAVE_EXTENSION", "يجب أن يكون تاريخ النهاية الجديد بعد نهاية الإجازة المعتمدة.");
  }
  const request = {
    requestKind: "extension",
    parentLeaveId: data.parentLeaveId,
    leaveType: parent.leaveType,
    startDate: parent.endDate,
    endDate: data.endDate,
    durationDays: inclusiveDays(parent.endDate, data.endDate),
    notes: data.notes ?? "",
    employeeUid: user.uid,
    employeeId: user.employee.id,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    status: "بانتظار المديرة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  };
  const ref = await db.collection("leaveRequests").add(request);
  await notifyLeaveRecipients(ref.id, "manager", request);
  return ref.id;
}

export async function createPermissionRequest(user, data) {
  if (data.returnTime && toMinutes(data.returnTime) < toMinutes(data.exitTime)) {
    throw new AppError(422, "INVALID_PERMISSION_TIME", "لا يمكن أن يسبق وقت العودة وقت الخروج.");
  }
  const ref = await db.collection("permissionRequests").add({
    ...data,
    employeeUid: user.uid,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    status: "قيد المراجعة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  });
  await notifyRequestManagers(ref.id, { employeeUid: user.uid, employeeName: user.employee.nameAr }, "permission_request", "طلب جديد: إذن/استئذان بانتظار المراجعة");
  return ref.id;
}

export async function createTraining(user, data) {
  inclusiveDays(data.startDate, data.endDate);
  const ref = await db.collection("trainingRequests").add({
    ...data,
    employeeUid: user.uid,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    status: "قيد المراجعة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  });
  await notifyRequestManagers(ref.id, { employeeUid: user.uid, employeeName: user.employee.nameAr }, "training_request", "طلب تدريب جديد بانتظار المراجعة");
  return ref.id;
}

export async function createTrainingAttendance(user, data) {
  const ref = await db.collection("trainingAttendanceRequests").add({
    ...data,
    employeeUid: user.uid,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    status: "قيد المراجعة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function createTrainingCourse(user, data) {
  const ref = await db.collection("trainingCourseRequests").add({
    ...data,
    employeeUid: user.uid,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    status: "قيد المراجعة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  });
  await notifyRequestManagers(ref.id, { employeeUid: user.uid, employeeName: user.employee.nameAr }, "training_course_request", "طلب دورة/ورشة جديدة بانتظار المراجعة");
  return ref.id;
}

export async function listOwned(collectionName, user, canViewAll, limit = 100) {
  let query = db.collection(collectionName);
  if (!canViewAll) query = query.where("employeeUid", "==", user.uid);
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map(publicDocument).sort((a, b) => String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")));
}

export async function listLeaveRequests(user, scope, limit = 100) {
  const canViewAll = scope !== "mine" && (user.employee?.role === "hr" || user.permissions.some((permission) => ["manage_leave_requests", "manage_leave_hr_requests"].includes(permission)));
  let query = db.collection("leaveRequests");
  if (!canViewAll) query = query.where("employeeUid", "==", user.uid);
  const snapshot = await query.limit(limit).get();
  let records = snapshot.docs.map(publicDocument);
  if (scope === "manager") records = records.filter((record) => record.status === "بانتظار المديرة");
  if (scope === "hr") records = records.filter((record) => record.status === "بانتظار الموارد البشرية");
  return records.sort((a, b) => String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")));
}

export async function decideLeave(user, requestId, decision) {
  const ref = db.collection("leaveRequests").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError(404, "REQUEST_NOT_FOUND", "الطلب غير موجود.");
  const record = snapshot.data();
  const isHr = user.employee?.role === "hr" || user.employee?.role === "system_admin" || user.permissions.includes("manage_leave_hr_requests");
  const isManager = user.employee?.role === "principal" || user.employee?.role === "vice_principal" || user.employee?.role === "admin" || user.employee?.role === "system_admin" || user.permissions.includes("manage_leave_requests");
  if (record.employeeUid === user.uid) throw new AppError(403, "SELF_APPROVAL_FORBIDDEN", "لا يمكن للموظفة اعتماد طلبها بنفسها.");
  if (record.status === "بانتظار المديرة" && isManager && user.employee?.role !== "hr") {
    await ref.update({
      status: "بانتظار الموارد البشرية",
      managerDecision: decision.status === "approved" ? "موافقة" : "رفض",
      managerDecisionNote: decision.decisionNote,
      managerDecisionBy: user.uid,
      managerDecisionAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await notifyLeaveRecipients(requestId, "hr", record);
    return;
  }
  if (record.status === "بانتظار الموارد البشرية" && isHr) {
    const status = decision.status === "approved" ? "معتمد" : "مرفوض";
    await ref.update({
      status,
      hrDecision: decision.status === "approved" ? "اعتماد" : "رفض",
      hrDecisionNote: decision.decisionNote,
      hrDecisionBy: user.uid,
      hrDecisionAt: FieldValue.serverTimestamp(),
      decisionNote: decision.decisionNote,
      decidedBy: user.uid,
      decidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    await notifyEmployee(requestId, record.employeeUid, status === "معتمد" ? "تم اعتماد طلب إجازتك" : "تم رفض طلب إجازتك", { status });
    return;
  }
  throw new AppError(409, "INVALID_LEAVE_STAGE", "لا يمكن اتخاذ هذا القرار في المرحلة الحالية.");
}

export async function decideRequest(collectionName, user, requestId, decision) {
  const ref = db.collection(collectionName).doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError(404, "REQUEST_NOT_FOUND", "الطلب غير موجود.");
  const record = snapshot.data();
  console.log(record);
  // if (record.employeeUid === user.uid) {
  //   throw new AppError(403, "SELF_APPROVAL_FORBIDDEN", "لا يمكن للموظفة اعتماد أو رفض طلبها بنفسها.");
  // }
  if (record.status !== "قيد المراجعة") {
    throw new AppError(409, "REQUEST_ALREADY_DECIDED", "تم اتخاذ قرار في هذا الطلب مسبقًا.");
  }
  const installmentSchedule = collectionName === "loanInquiries" && decision.status === "approved"
    ? Array.from({ length: decision.installments }, (_, index) => {
      const dueDate = new Date(`${decision.firstInstallmentDueDate}T12:00:00`);
      dueDate.setMonth(dueDate.getMonth() + index);
      return { number: index + 1, dueDate: dueDate.toISOString().slice(0, 10), amount: decision.installmentAmount, status: "غير مسدد" };
    })
    : undefined;
  await ref.update({
    status: decision.status === "approved" ? "معتمد" : "مرفوض",
    decisionNote: decision.decisionNote,
    ...(decision.status === "approved" ? {
      approvedAmount: decision.approvedAmount,
      installments: decision.installments,
      installmentAmount: decision.installmentAmount,
      firstInstallmentDueDate: decision.firstInstallmentDueDate,
      paidInstallments: 0,
      installmentSchedule
    } : {}),
    decidedBy: user.uid,
    decidedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await createNotification({
    recipientUid: record.employeeUid,
    type: "request_decision",
    title: decision.status === "approved" ? "تم اعتماد طلبك" : "تم رفض طلبك",
    message: decision.decisionNote ?? "تم تحديث حالة طلبك.",
    requestId,
    requestCollection: collectionName,
    status: decision.status === "approved" ? "معتمد" : "مرفوض"
  });
}

export async function createAssignment(user, data) {
  inclusiveDays(data.startDate, data.endDate);
  const employee = await getEmployeeByUid(data.assigneeUid);
  const actingFor = data.actingForUid ? await getEmployeeByUid(data.actingForUid) : null;
  if (data.actingForUid && data.actingForUid === data.assigneeUid) {
    throw new AppError(422, "INVALID_ACTING_EMPLOYEE", "لا يمكن تكليف الموظفة بالنيابة عن نفسها.");
  }
  const ref = db.collection("workAssignments").doc();
  const notificationRef = db.collection("notifications").doc();
  const assignmentNumber = `WA-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const payload = {
    ...data,
    assigneeName: employee.nameAr,
    assigneeEmployeeNumber: employee.employeeNumber,
    assigneeEmployeeId: employee.id,
    actingForUid: actingFor ? data.actingForUid : "",
    actingForName: actingFor?.nameAr ?? "",
    issuedByUid: user.uid,
    issuedByName: user.employee.nameAr,
    assignmentNumber,
    issueDate: new Date().toISOString().slice(0, 10),
    status: "sent",
    viewedAt: null,
    acknowledgedAt: null,
    createdAt: FieldValue.serverTimestamp()
  };
  const batch = db.batch();
  batch.set(ref, payload);
  batch.set(notificationRef, {
    recipientUid: data.assigneeUid,
    type: "work_assignment",
    title: "لديكِ خطاب تكليف جديد",
    assignmentId: ref.id,
    read: false,
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();
  return ref.id;
}

export async function listAssignments(user, all, limit = 100) {
  let query = db.collection("workAssignments");
  if (!all) query = query.where("assigneeUid", "==", user.uid);
  const snapshot = await query.limit(limit).get();
  return snapshot.docs.map(publicDocument).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export async function acknowledgeAssignment(user, assignmentId) {
  const ref = db.collection("workAssignments").doc(assignmentId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) throw new AppError(404, "ASSIGNMENT_NOT_FOUND", "خطاب التكليف غير موجود.");
    const record = snapshot.data();
    if (record.assigneeUid !== user.uid) {
      throw new AppError(403, "ASSIGNMENT_ACCESS_FORBIDDEN", "لا يمكنك الاطلاع على تكليف يخص موظفة أخرى.");
    }
    if (!record.acknowledgedAt) {
      transaction.update(ref, {
        status: "acknowledged",
        viewedAt: record.viewedAt ?? FieldValue.serverTimestamp(),
        acknowledgedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });
  const notices = await db.collection("notifications")
    .where("recipientUid", "==", user.uid)
    .where("assignmentId", "==", assignmentId)
    .limit(10).get();
  if (!notices.empty) {
    const batch = db.batch();
    notices.docs.forEach((doc) => batch.update(doc.ref, { read: true, readAt: FieldValue.serverTimestamp() }));
    await batch.commit();
  }
}

export async function createSimpleOwnedRequest(collectionName, user, data) {
  const ref = await db.collection(collectionName).add({
    ...data,
    employeeUid: user.uid,
    employeeName: user.employee.nameAr,
    employeeNumber: user.employee.employeeNumber,
    employeeEmail: user.email,
    status: "قيد المراجعة",
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function markAbsenceReportViewed(user, requestId) {
  const ref = db.collection("absenceReports").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.employeeUid !== user.uid) {
    throw new AppError(404, "ABSENCE_REPORT_NOT_FOUND", "بلاغ الغياب غير موجود.");
  }
  if (!snapshot.data()?.employeeViewedAt) {
    await ref.update({ employeeViewedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  }
}

export async function markAbsenceReportManagedViewed(user, requestId) {
  const canManage = user.permissions.includes("manage_absence")
    || user.permissions.includes("manage_leave_requests")
    || user.employee?.role === "system_admin";
  if (!canManage) throw new AppError(403, "FORBIDDEN", "لا توجد لديك صلاحية متابعة بلاغات الغياب.");
  const ref = db.collection("absenceReports").doc(requestId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError(404, "ABSENCE_REPORT_NOT_FOUND", "بلاغ الغياب غير موجود.");
  if (!snapshot.data()?.managerViewedAt) {
    await ref.update({ managerViewedAt: FieldValue.serverTimestamp(), managerViewedBy: user.uid, updatedAt: FieldValue.serverTimestamp() });
  }
}

export async function createAssignedAsset(user, data) {
  const employee = await getEmployeeByUid(data.employeeUid);
  const ref = await db.collection("assetRequests").add({
    assetName: data.assetName,
    assetNumber: data.assetNumber ?? "",
    notes: data.notes ?? "",
    employeeUid: employee.authUid ?? employee.id,
    employeeName: employee.nameAr,
    employeeNumber: employee.employeeNumber,
    status: "نشطة",
    assignedByUid: user.uid,
    assignedByName: user.employee?.nameAr ?? user.email,
    assignedAt: data.assignedAt,
    submittedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp()
  });
  await createNotification({
    recipientUid: employee.authUid ?? employee.id,
    type: "asset_assigned",
    title: "تم تسجيل عهدة جديدة باسمك",
    message: data.assetName,
    assetRequestId: ref.id
  });
  return ref.id;
}

export async function updateAssignedAsset(id, data) {
  await db.collection("assetRequests").doc(id).update({
    ...data,
    updatedAt: FieldValue.serverTimestamp()
  });
}

export async function deleteAssignedAsset(id) {
  await db.collection("assetRequests").doc(id).delete();
}

export async function updateLoan(id, data) {
  const ref = db.collection("loanInquiries").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new AppError(404, "REQUEST_NOT_FOUND", "طلب السلفة غير موجود.");
  const current = snapshot.data();
  const changes = { ...data };
  if (changes.paidInstallments !== undefined && current.installments && changes.paidInstallments >= current.installments) {
    changes.status = "مسددة";
  }
  if (changes.paidInstallments !== undefined && current.installmentSchedule) {
    changes.installmentSchedule = current.installmentSchedule.map((installment, index) => ({
      ...installment,
      status: index < changes.paidInstallments ? "تم السداد" : "غير مسدد"
    }));
  }
  await ref.update({
    ...changes,
    updatedAt: FieldValue.serverTimestamp()
  });
}


export async function createCertificate(user, data) {
  if (data.type === "salary" && data.salary === undefined) {
    throw new AppError(422, "SALARY_REQUIRED", "الراتب مطلوب في تعريف الراتب.");
  }
  const employee = await getEmployeeByUid(data.employeeUid);
  const payload = {
    type: data.type,
    employeeUid: data.employeeUid,
    employeeId: employee.id,
    employeeName: employee.nameAr,
    employeeNumber: employee.employeeNumber,
    jobTitle: data.jobTitle,
    issuer: data.issuer,
    salary: data.type === "salary" ? Number(data.salary ?? 0) : null,
    notes: data.notes ?? "",
    issuedByUid: user.uid,
    issuedByName: user.employee.nameAr,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
  const ref = await db.collection("employeeCertificates").add(payload);
  await createNotification({
    recipientUid: data.employeeUid,
    type: "certificate_issued",
    title: "تم إصدار خطاب لكِ",
    message: data.type === "salary" ? "تعريف راتب" : "تعريف موظفة على رأس العمل",
    certificateId: ref.id
  });
  return ref.id;
}

export async function listCertificates(user, all = false) {
  let query = db.collection("employeeCertificates");
  if (!all) query = query.where("employeeUid", "==", user.uid);
  const snapshot = await query.limit(100).get();
  return snapshot.docs.map(publicDocument).sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export async function getEmployeeRequestStatistics() {
  const collections = [
    ["leaveRequests", "leave"],
    ["permissionRequests", "permission"],
    ["absenceReports", "absence"],
    ["trainingRequests", "training"],
    ["trainingCourseRequests", "trainingCourse"],
    ["trainingAttendanceRequests", "trainingAttendance"],
    ["assetRequests", "asset"],
    ["loanInquiries", "loan"],
    ["materialRequests", "material"],
    ["communityRequests", "community"],
    ["suggestionRequests", "suggestion"],
    ["supportTickets", "support"],
    ["workAssignments", "assignment"],
    ["employeeCertificates", "certificate"]
  ];
  const [employeesSnapshot, ...collectionSnapshots] = await Promise.all([
    db.collection("employees").limit(500).get(),
    ...collections.map(([collection]) => db.collection(collection).limit(1000).get()),
    db.collection("notifications").limit(5000).get()
  ]);
  const notificationSnapshot = collectionSnapshots.pop();
  const stats = new Map(employeesSnapshot.docs.map((snapshot) => {
    const employee = { id: snapshot.id, ...snapshot.data() };
    const uid = employee.authUid ?? employee.id;
    return [uid, {
      employeeUid: uid,
      employeeName: employee.nameAr ?? employee.fullName ?? "موظفة غير مسماة",
      employeeNumber: employee.employeeNumber ?? "—",
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      read: 0,
      unread: 0,
      byType: {}
    }];
  }));
  const ensure = (uid) => {
    if (!uid) return null;
    if (!stats.has(uid)) stats.set(uid, {
      employeeUid: uid, employeeName: "موظفة غير مسماة", employeeNumber: "—",
      total: 0, pending: 0, approved: 0, rejected: 0, read: 0, unread: 0, byType: {}
    });
    return stats.get(uid);
  };
  collectionSnapshots.forEach((snapshot, index) => {
    const [, type] = collections[index];
    snapshot.docs.forEach((document) => {
      const record = document.data();
      const employeeUid = type === "assignment" ? record.assigneeUid : type === "support" ? record.requesterUid : record.employeeUid;
      const item = ensure(employeeUid);
      if (!item) return;
      item.total += 1;
      item.byType[type] = (item.byType[type] ?? 0) + 1;
      if (["قيد المراجعة", "بانتظار المديرة", "بانتظار الموارد البشرية", "جديدة", "قيد المعالجة"].includes(record.status)) item.pending += 1;
      if (["معتمد", "تم الحل", "مغلقة", "acknowledged"].includes(record.status)) item.approved += 1;
      if (["مرفوض", "مرفوضة"].includes(record.status)) item.rejected += 1;
    });
  });
  notificationSnapshot.docs.forEach((document) => {
    const item = ensure(document.data().recipientUid);
    if (!item) return;
    if (document.data().read) item.read += 1;
    else item.unread += 1;
  });
  return [...stats.values()].sort((a, b) => a.employeeName.localeCompare(b.employeeName, "ar"));
}
