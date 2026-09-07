import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";
import { notifyEmployee } from "./notificationService.js";

async function childSnapshots(user) {
  const ids = Array.isArray(user.parent.studentIds) ? user.parent.studentIds.filter((id) => typeof id === "string").slice(0, 20) : [];
  if (!ids.length) return [];
  return db.getAll(...ids.map((id) => db.collection("students").doc(id)));
}

export async function listOwnChildren(user) {
  const snapshots = await childSnapshots(user);
  return snapshots.filter((snapshot) => snapshot.exists && snapshot.data().active !== false).map((snapshot) => {
    const student = publicDocument(snapshot);
    return { id: student.id, fullName: student.fullName, stage: student.stage, grade: student.grade, classId: student.classId, gender: student.gender };
  });
}

export async function listOwnAttendance(user) {
  const children = await listOwnChildren(user);
  const results = [];
  for (const child of children) {
    const snapshot = await db.collection("attendance").where("classId", "==", child.classId).limit(100).get();
    snapshot.docs.forEach((doc) => {
      const record = publicDocument(doc);
      const entry = record.entries?.find((item) => item.studentId === child.id);
      if (entry) results.push({ id: `${record.id}-${child.id}`, studentId: child.id, studentName: child.fullName, date: record.date, className: record.className, status: entry.status });
    });
  }
  return results.sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 200);
}

export async function listOwnReports(user, period) {
  const childIds = Array.isArray(user.parent.studentIds) ? user.parent.studentIds.filter((id) => typeof id === "string").slice(0, 10) : [];
  if (!childIds.length) return [];
  const snapshot = await db.collection("studentReports").where("studentId", "in", childIds).limit(500).get();
  const names = new Map((await listOwnChildren(user)).map((child) => [child.id, child.fullName]));
  return snapshot.docs.filter((doc) => Number(doc.data().period) === period).map((doc) => {
    const report = publicDocument(doc);
    return { id: report.id, studentId: report.studentId, studentName: names.get(report.studentId) ?? "—", subject: report.subject ?? "—", score: report.score ?? "—", status: report.status ?? "—", parentFeedback: report.parentFeedback ?? null };
  });
}

export async function acknowledgeOwnReport(user, reportId, comment) {
  const reportRef = db.collection("studentReports").doc(reportId);
  const reportSnapshot = await reportRef.get();
  if (!reportSnapshot.exists) throw new AppError(404, "REPORT_NOT_FOUND", "التقرير غير موجود.");
  const childIds = Array.isArray(user.parent.studentIds) ? user.parent.studentIds : [];
  if (!childIds.includes(reportSnapshot.data().studentId)) throw new AppError(403, "REPORT_ACCESS_DENIED", "لا يمكنك تحديث هذا التقرير.");
  const report = reportSnapshot.data();
  await reportRef.update({ parentFeedback: { comment, acknowledged: true, acknowledgedAt: FieldValue.serverTimestamp(), acknowledgedBy: user.uid } });
  const managers = await db.collection("employees").where("role", "in", ["principal", "system_admin"]).limit(50).get();
  const recipients = new Set(managers.docs.filter((doc) => doc.data().status !== "inactive").map((doc) => doc.data().authUid ?? doc.id));
  const teacherUids = [
    report.teacherUid,
    ...(Array.isArray(report.teacherUids) ? report.teacherUids : []),
    ...(Array.isArray(report.subjects) ? report.subjects.map((subject) => subject.teacherUid) : []),
    ...(Array.isArray(report.items) ? report.items.map((item) => item.teacherUid) : [])
  ].filter(Boolean);
  teacherUids.forEach((teacherUid) => recipients.add(teacherUid));
  await Promise.all([...recipients].map((recipientUid) => notifyEmployee({
    recipientUid,
    type: "parent_report_feedback",
    title: "إقرار وتعليق ولي أمر",
    message: `أرسل ولي الأمر تعليقًا على تقرير الطالب رقم ${report.studentId}${report.subject ? ` في مادة ${report.subject}` : ""}.`,
    reportId,
    studentId: report.studentId,
    parentUid: user.uid
  })));
}

