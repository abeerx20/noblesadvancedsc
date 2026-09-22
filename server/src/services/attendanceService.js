import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { getClassOrThrow } from "./classService.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument, safeDocumentId } from "../utils/text.js";
import { weekdayKey } from "../utils/time.js";

async function firstPeriodTeacher(classId, date) {
  const snapshot = await db.collection("teacherSchedule")
    .where("classId", "==", classId)
    .limit(300)
    .get();
  const day = weekdayKey(date);
  const firstPeriod = snapshot.docs.find((document) => {
    const schedule = document.data();
    return schedule.day === day
      && Number(schedule.periodNumber) === 1
      && schedule.active === true;
  });
  return firstPeriod?.data() ?? null;
}

function attendanceOpensAtNine() {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
    hour: "2-digit",
    hour12: false
  }).format(new Date()));
  return hour >= 9;
}

export async function attendanceEligibility(user, classId, date) {
  if (!attendanceOpensAtNine()) {
    return { allowed: false, reason: "إدخال الغياب متاح ابتداءً من الساعة 9:00 صباحًا.", subject: null };
  }
  await getClassOrThrow(classId);
  const override = user.permissions.includes("manage_attendance") || user.permissions.includes("attendance_override");
  if (override) {
    const teacher = await firstPeriodTeacher(classId, date);
    return { allowed: true, reason: null, subject: teacher?.subject ?? null };
  }
  const teacher = await firstPeriodTeacher(classId, date);
  return {
    allowed: teacher?.teacherUid === user.uid,
    subject: teacher?.subject ?? null,
    reason: teacher?.teacherUid === user.uid
      ? null
      : teacher
        ? "إدخال الغياب متاح لمعلمة الحصة الأولى فقط."
        : "لم تُسند الحصة الأولى لهذا الفصل في اليوم المحدد."
  };
}

export async function saveAttendance(user, data) {
  const eligibility = await attendanceEligibility(user, data.classId, data.date);
  if (!eligibility.allowed) throw new AppError(403, "ATTENDANCE_NOT_ALLOWED", eligibility.reason);

  const classSnapshot = await getClassOrThrow(data.classId);
  const studentIds = data.entries.map((entry) => entry.studentId);
  if (new Set(studentIds).size !== studentIds.length) {
    throw new AppError(422, "DUPLICATE_ATTENDANCE_ENTRY", "توجد حالة مكررة لأحد الطلاب.");
  }

  const students = await db.collection("students").where("classId", "==", data.classId).limit(100).get();
  const allowedStudents = new Set(students.docs.filter((doc) => doc.data().active !== false).map((doc) => doc.id));
  if (studentIds.length !== allowedStudents.size || studentIds.some((id) => !allowedStudents.has(id))) {
    throw new AppError(422, "INVALID_CLASS_STUDENTS", "قائمة الطلاب لا تطابق طلاب الفصل الحاليين. أعيدي تحميل الصفحة.");
  }

  const recordId = safeDocumentId(`${data.date}_${data.classId}`);
  const ref = db.collection("attendance").doc(recordId);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists) {
      throw new AppError(409, "DUPLICATE_ATTENDANCE", "تم تسجيل غياب هذا الفصل في التاريخ نفسه مسبقًا.");
    }
    transaction.create(ref, {
      ...data,
      subject: eligibility.subject,
      className: classSnapshot.name,
      teacherUid: user.uid,
      teacherName: user.employee.nameAr,
      submittedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp()
    });
  });
  await notifyLinkedParents({ ...data, id: recordId, className: classSnapshot.name }, data.entries, []);
  return recordId;
}

export async function listAttendance(filters) {
  const snapshot = await db.collection("attendance").limit(500).get();
  let records = snapshot.docs.map(publicDocument);
  if (filters.classId) records = records.filter((record) => record.classId === filters.classId);
  if (filters.date) records = records.filter((record) => record.date === filters.date);
  if (filters.teacherUid) records = records.filter((record) => record.teacherUid === filters.teacherUid);
  if (filters.status) records = records.filter((record) => record.entries?.some((entry) => entry.status === filters.status));
  const studentIds = [...new Set(records.flatMap((record) => (record.entries ?? []).map((entry) => entry.studentId)))];
  const studentSnapshots = await Promise.all(studentIds.map((studentId) => db.collection("students").doc(studentId).get()));
  const studentNames = new Map(studentSnapshots.filter((student) => student.exists).map((student) => [student.id, student.data().fullName]));
  return records
    .flatMap((record) => (record.entries ?? []).map((entry) => ({
      id: record.id,
      date: record.date,
      classId: record.classId,
      className: record.className,
      teacherName: record.teacherName,
      weekNumber: record.weekNumber,
      entries: record.entries ?? [],
      studentId: entry.studentId,
      studentName: studentNames.get(entry.studentId) ?? "طالب غير مسجل",
      status: entry.status
    })))
    .filter((record) => !filters.status || record.status === filters.status)
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))
    .slice(0, filters.limit);
}

export async function updateAttendance(user, recordId, entries) {
  const ref = db.collection("attendance").doc(recordId);
  const existing = await ref.get();
  if (!existing.exists) throw new AppError(404, "ATTENDANCE_NOT_FOUND", "سجل الغياب غير موجود.");
  const record = { id: recordId, ...existing.data() };
  await ref.update({ entries, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() });
  await notifyLinkedParents(record, entries, record.entries ?? []);
}

async function notifyLinkedParents(record, entries, previousEntries) {
  const previous = new Map(previousEntries.map((entry) => [entry.studentId, entry.status]));
  const alerts = entries.filter((entry) => ["excused", "unexcused", "late"].includes(entry.status)
    && previous.get(entry.studentId) !== entry.status);
  if (!alerts.length) return;

  const students = await Promise.all(alerts.map((entry) => db.collection("students").doc(entry.studentId).get()));
  const studentNames = new Map(students.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.id, snapshot.data().fullName]));
  const parentQueries = await Promise.all(alerts.map((entry) => db.collection("parents").where("studentIds", "array-contains", entry.studentId).limit(50).get()));
  const batch = db.batch();
  alerts.forEach((entry, index) => {
    const statusLabel = { excused: "غائب بعذر", unexcused: "غائب دون عذر", late: "متأخر" }[entry.status];
    parentQueries[index].docs.forEach((parent) => {
      const recipientUid = parent.data().authUid ?? parent.id;
      if (!recipientUid) return;
      batch.set(db.collection("notifications").doc(), {
        recipientUid,
        type: "attendance_alert",
        title: `تنبيه حضور: ${studentNames.get(entry.studentId) ?? "الطالب"}`,
        message: `تم تسجيل حالة الطالب ${statusLabel} بتاريخ ${record.date} في ${record.className ?? "الفصل"}.`,
        studentId: entry.studentId,
        attendanceId: record.id,
        status: entry.status,
        read: false,
        createdAt: FieldValue.serverTimestamp()
      });
    });
  });
  await batch.commit();
}
