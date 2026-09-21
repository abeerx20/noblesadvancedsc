import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { AppError } from "../utils/AppError.js";
import { publicDocument } from "../utils/text.js";
import { notifyEmployee } from "./notificationService.js";

const schoolDays = ["sunday", "monday", "tuesday", "wednesday", "thursday"];
const dayAliases = {
    الأحد: "sunday",
    الاثنين: "monday",
    الثلاثاء: "tuesday",
    الأربعاء: "wednesday",
    الخميس: "thursday"
};

function normalizeDay(value) {
    return dayAliases[String(value ?? "").trim()] ?? String(value ?? "").trim().toLowerCase();
}

function normalizeName(value) {
    return String(value ?? "").replace(/\s+/g, "").trim();
}

function dateRange(from, to) {
    const dates = [];
    const parseDate = (value) => {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").replaceAll("/", "-"));
        if (!match) return null;
        const result = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
        return result.getUTCFullYear() === Number(match[1]) && result.getUTCMonth() === Number(match[2]) - 1 && result.getUTCDate() === Number(match[3]) ? result : null;
    };
    const current = parseDate(from);
    const end = parseDate(to);
    if (!current || !end) return dates;
    while (current <= end) {
        dates.push({ value: [current.getUTCFullYear(), String(current.getUTCMonth() + 1).padStart(2, "0"), String(current.getUTCDate()).padStart(2, "0")].join("-"), day: schoolDays[current.getUTCDay() - 0] });
        current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates.filter((item) => item.day);
}

function dayName(dateValue) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue ?? "").replaceAll("/", "-"));
    if (!parts) return "";
    const date = new Date(Date.UTC(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12));
    if (Number.isNaN(date.getTime())) return "";
    const dayIndex = date.getUTCDay();
    return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][dayIndex];
}

function assignmentKey(absenceReportId, scheduleId) {
    return `${absenceReportId}_${scheduleId}`;
}

export async function listCoverage(from, to) {
    const [absenceSnapshot, scheduleSnapshot, employeeSnapshot, assignmentSnapshot] = await Promise.all([
        db.collection("absenceReports").limit(500).get(),
        db.collection("teacherSchedule").limit(500).get(),
        db.collection("employees").limit(500).get(),
        db.collection("teacherCoverage").where("date", ">=", from).where("date", "<=", to).limit(500).get()
    ]);
    const dates = new Set(dateRange(from, to).map((item) => item.value));
    const employees = employeeSnapshot.docs.map(publicDocument).filter((item) => item.status !== "inactive");
    const employeeByUid = new Map(employees.map((item) => [item.authUid ?? item.id, item]));
    const employeeByName = new Map(employees.map((item) => [normalizeName(item.nameAr), item]));
    const employeeByEmail = new Map(employees.map((item) => [String(item.email ?? "").toLowerCase(), item]));
    const schedules = scheduleSnapshot.docs
        .map(publicDocument)
        .filter((item) => item.active !== false);
    const schedulesByTeacherAndDate = new Map();
    schedules.forEach((schedule) => {
        const teacher = employeeByUid.get(schedule.teacherUid)
            ?? employeeByName.get(normalizeName(schedule.teacherName))
            ?? employeeByEmail.get(String(schedule.teacherEmail ?? "").toLowerCase());
        if (!teacher) return;
        const teacherUid = teacher.authUid ?? teacher.id;
        dateRange(from, to).forEach((date) => {
            if (date.day !== normalizeDay(schedule.day)) return;
            const key = `${teacherUid}:${date.value}`;
            const rows = schedulesByTeacherAndDate.get(key) ?? [];
            rows.push({ ...schedule, teacherUid, date: date.value });
            schedulesByTeacherAndDate.set(key, rows);
        });
    });
    const assignments = new Map(assignmentSnapshot.docs.map((doc) => [doc.id, publicDocument(doc)]));
    const rows = [];
    absenceSnapshot.docs.map(publicDocument)
        .filter((item) => dates.has(item.date) && item.status !== "مرفوض")
        .forEach((absence) => {
            const absentTeacher = employeeByUid.get(absence.employeeUid);
            const teacherSchedules = schedulesByTeacherAndDate.get(`${absence.employeeUid}:${absence.date}`) ?? [];
            teacherSchedules.forEach((schedule) => {
                const assignment = assignments.get(assignmentKey(absence.id, schedule.id));
                const substitute = employeeByUid.get(assignment?.substituteUid);
                rows.push({
                    id: assignment?.id ?? assignmentKey(absence.id, schedule.id),
                    date: absence.date,
                    day: dayName(absence.date),
                    absenceReportId: absence.id,
                    scheduleId: schedule.id,
                    blockType: schedule.blockType,
                    periodNumber: schedule.periodNumber ?? null,
                    periodName: schedule.periodName,
                    subject: schedule.subject ?? "",
                    classId: schedule.classId ?? "",
                    location: schedule.location ?? "",
                    startTime: schedule.startTime,
                    endTime: schedule.endTime,
                    absentTeacherUid: absence.employeeUid,
                    absentTeacherName: absence.employeeName ?? absentTeacher?.nameAr ?? "—",
                    assigned: Boolean(assignment),
                    substituteUid: assignment?.substituteUid ?? "",
                    substituteName: assignment?.substituteName ?? substitute?.nameAr ?? "",
                    status: assignment?.status ?? "جديد",
                    notes: assignment?.notes ?? ""
                });
            });
        });
    return {
        rows: rows.sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`)),
        substitutes: employees
            .filter((employee) => employee.authUid ?? employee.id)
            .map((employee) => ({ uid: employee.authUid ?? employee.id, nameAr: employee.nameAr }))
            .sort((a, b) => String(a.nameAr).localeCompare(String(b.nameAr), "ar"))
    };
}

export async function assignCoverage(user, data) {
    const absenceSnapshot = await db.collection("absenceReports").doc(data.absenceReportId).get();
    if (!absenceSnapshot.exists || absenceSnapshot.data()?.date !== data.date) {
        throw new AppError(404, "ABSENCE_REPORT_NOT_FOUND", "بلاغ غياب الموظفة غير موجود لهذا التاريخ.");
    }
    const scheduleSnapshot = await db.collection("teacherSchedule").doc(data.scheduleId).get();
    if (!scheduleSnapshot.exists || scheduleSnapshot.data()?.teacherUid !== absenceSnapshot.data()?.employeeUid) {
        throw new AppError(404, "SCHEDULE_NOT_FOUND", "الحصة أو المناوبة غير مرتبطة بالمعلمة الغائبة.");
    }
    const substituteSnapshot = await db.collection("employees").doc(data.substituteUid).get();
    if (!substituteSnapshot.exists || substituteSnapshot.data()?.status === "inactive") {
        throw new AppError(404, "SUBSTITUTE_NOT_FOUND", "المعلمة البديلة غير موجودة أو غير نشطة.");
    }
    const substitute = publicDocument(substituteSnapshot);
    const absence = publicDocument(absenceSnapshot);
    const schedule = publicDocument(scheduleSnapshot);
    const id = assignmentKey(data.absenceReportId, data.scheduleId);
    await db.collection("teacherCoverage").doc(id).set({
        ...data,
        absentTeacherUid: absence.employeeUid,
        absentTeacherName: absence.employeeName,
        blockType: schedule.blockType,
        periodNumber: schedule.periodNumber ?? null,
        periodName: schedule.periodName,
        subject: schedule.subject ?? "",
        classId: schedule.classId ?? "",
        location: schedule.location ?? "",
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        substituteName: substitute.nameAr,
        status: data.status ?? "مكلف",
        acknowledgedAt: null,
        assignedBy: user.uid,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp()
    }, { merge: true });
    await notifyEmployee({
        recipientUid: data.substituteUid,
        type: "teacher_coverage",
        title: "تكليف انتظار جديد",
        message: `تم تكليفك بتغطية ${schedule.subject ?? schedule.periodName} يوم ${data.date}.`,
        coverageId: id,
        date: data.date
    });
    return id;
}

export async function listMyCoverage(user, from, to) {
    const snapshot = await db.collection("teacherCoverage")
        .where("substituteUid", "==", user.uid)
        .where("date", ">=", from)
        .where("date", "<=", to)
        .limit(200)
        .get();
    return snapshot.docs.map(publicDocument).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
}

export async function acknowledgeCoverage(user, id) {
    const ref = db.collection("teacherCoverage").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.substituteUid !== user.uid) {
        throw new AppError(404, "COVERAGE_NOT_FOUND", "تكليف الانتظار غير موجود.");
    }
    await ref.update({ acknowledgedAt: FieldValue.serverTimestamp(), status: "مؤكد", updatedAt: FieldValue.serverTimestamp() });
    const managers = await db.collection("employees").limit(200).get();
    await Promise.all(managers.docs
        .map(publicDocument)
        .filter((employee) => ["principal", "vice_principal", "admin", "system_admin"].includes(employee.role))
        .map((employee) => notifyEmployee({
            recipientUid: employee.authUid ?? employee.id,
            type: "teacher_coverage_acknowledged",
            title: "تم الاطلاع على تكليف الانتظار",
            message: `${snapshot.data().substituteName ?? "المعلمة البديلة"} اطلعت على تكليف الانتظار.`,
            coverageId: id
        })));
}

export async function createCoverageAbsence(user, data) {
    const employeeDocId = data.employeeUid;
    let employeeSnapshot = await db.collection("employees").doc(employeeDocId).get();
    if (!employeeSnapshot.exists) {
        const authSnapshot = await db.collection("employees").where("authUid", "==", employeeDocId).limit(1).get();
        employeeSnapshot = authSnapshot.empty ? null : authSnapshot.docs[0];
    }
    if (!employeeSnapshot || employeeSnapshot.data()?.status === "inactive") {
        throw new AppError(404, "EMPLOYEE_NOT_FOUND", "المعلمة المحددة غير موجودة أو غير نشطة.");
    }
    const employee = publicDocument(employeeSnapshot);
    const employeeUidForRecord = employeeSnapshot.id;
    const ref = await db.collection("absenceReports").add({
        employeeUid: employeeUidForRecord,
        employeeName: employee.nameAr,
        employeeNumber: employee.employeeNumber ?? "—",
        absenceType: data.absenceType,
        date: data.date,
        reason: data.reason,
        status: "قيد المراجعة",
        submittedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        createdBy: user.uid
    });
    return ref.id;
}

export async function updateCoverage(user, id, data) {
    const ref = db.collection("teacherCoverage").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new AppError(404, "COVERAGE_NOT_FOUND", "تكليف الانتظار غير موجود.");
    const changes = { ...data, updatedBy: user.uid, updatedAt: FieldValue.serverTimestamp() };
    if (data.substituteUid) {
        const substituteSnapshot = await db.collection("employees").doc(data.substituteUid).get();
        if (!substituteSnapshot.exists) throw new AppError(404, "SUBSTITUTE_NOT_FOUND", "المعلمة البديلة غير موجودة.");
        changes.substituteName = publicDocument(substituteSnapshot).nameAr;
    }
    await ref.update(changes);
}
