import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.FIREBASE_PROJECT_ID = "test-project";

const { scheduleSchema, studentRosterSchema } = await import("../src/validators/schemas.js");
const {
  findDuplicateStudentField,
  studentDuplicateKeys,
  validateStudentGenderForClass
} = await import("../src/services/studentRosterService.js");
const { requirePermission, requireRole } = await import("../src/middleware/authorize.js");
const { updateAccess } = await import("../src/services/employeeService.js");

const validRosterStudent = {
  fullName: "محمد أحمد علي سالم",
  classId: "grade1_a_boys",
  subject: "الرياضيات",
  gender: "male",
  nationalId: "1234567890",
  guardianPhone: "0500000000"
};

test("يرفض حقن الحالة أو الصلاحيات ضمن بيانات الطالب", () => {
  assert.equal(studentRosterSchema.safeParse({
    ...validRosterStudent,
    status: "active",
    manage_students: true
  }).success, false);
});

test("يقبل طفلًا أو طفلة في فصل روضة مختلط مع جنس صريح", () => {
  const kindergarten = { stage: "kindergarten", gender: "mixed" };
  assert.doesNotThrow(() => validateStudentGenderForClass(kindergarten, "male"));
  assert.doesNotThrow(() => validateStudentGenderForClass(kindergarten, "female"));
});

test("يرفض إضافة طالبة إلى فصل بنين ابتدائي", () => {
  const primaryBoys = { stage: "primary", gender: "male" };
  assert.throws(
    () => validateStudentGenderForClass(primaryBoys, "female"),
    (error) => error.status === 422 && error.code === "PRIMARY_GENDER_MISMATCH"
  );
});

test("يطبع رقم جوال ولي الأمر بصيغة موحدة قبل فحص التكرار", () => {
  assert.equal(
    studentDuplicateKeys({ fullName: "محمد أحمد", guardianPhone: "966500000000" }).guardianPhone,
    "0500000000"
  );
});

test("يكشف تكرار الاسم أو الهوية أو جوال ولي الأمر", () => {
  const existing = [{
    id: "student-1",
    fullName: "مُحَمَّد أحمد علي سالم",
    nationalId: "1234567890",
    guardianPhone: "0500000000",
    active: true
  }];
  assert.equal(findDuplicateStudentField(
    { fullName: "محمد أحمد علي سالم", nationalId: "", guardianPhone: "" },
    existing
  ), "fullName");
  assert.equal(findDuplicateStudentField(
    { fullName: "طالب آخر", nationalId: "1234567890", guardianPhone: "" },
    existing
  ), "nationalId");
  assert.equal(findDuplicateStudentField(
    { fullName: "طالب آخر", nationalId: "", guardianPhone: "966500000000" },
    existing
  ), "guardianPhone");
});

test("حارس الصلاحيات يعتمد صلاحيات الخادم ويرفض غير المخول", () => {
  const guard = requirePermission("manage_students");
  let receivedError;
  guard({ user: { permissions: ["view_students"] } }, {}, (error) => { receivedError = error; });
  assert.equal(receivedError.status, 403);
  assert.equal(receivedError.code, "FORBIDDEN");
});

test("إدارة الجداول تتطلب دورًا إداريًا إضافة إلى الصلاحية", () => {
  const guard = requireRole("principal", "admin", "system_admin", "schedule_admin");
  let teacherError;
  guard({ user: { employee: { role: "teacher" }, permissions: ["manage_schedules"] } }, {}, (error) => {
    teacherError = error;
  });
  assert.equal(teacherError.status, 403);

  let adminError;
  guard({ user: { employee: { role: "principal" }, permissions: ["manage_schedules"] } }, {}, (error) => {
    adminError = error;
  });
  assert.equal(adminError, undefined);
});

test("يرفض جدول الحصص حقن اسم المعلمة أو حالة السجل من المتصفح", () => {
  const result = scheduleSchema.safeParse({
    blockType: "class",
    day: "sunday",
    periodNumber: 1,
    periodName: "الحصة الأولى",
    startTime: "07:30",
    endTime: "08:15",
    teacherUid: "teacher-uid",
    subject: "الرياضيات",
    classId: "grade1-a",
    teacherName: "اسم مزور",
    active: false
  });
  assert.equal(result.success, false);
});

test("لا يستطيع المستخدم تعديل صلاحيات حسابه بنفسه", async () => {
  await assert.rejects(
    updateAccess({ uid: "same-user" }, "same-user", { manage_students: true }),
    (error) => error.status === 403 && error.code === "SELF_PERMISSION_CHANGE_FORBIDDEN"
  );
});
