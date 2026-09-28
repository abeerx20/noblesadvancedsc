import test from "node:test";
import assert from "node:assert/strict";
import { classSchema, employeeSchema, parentLoginSchema, parentUpdateSchema, scheduleQuerySchema, scheduleSchema, studentSchema } from "../src/validators/schemas.js";

const base = { fullName: "محمد أحمد علي سالم", classId: "class_a", active: true };

test("يقبل فصل روضة مختلطًا", () => {
  assert.equal(studentSchema.safeParse({ ...base, stage: "kindergarten", grade: "KG2", gender: "mixed" }).success, true);
});

test("يقبل نموذج إضافة فصل بدون اسم ويولد الاسم تلقائيًا", () => {
  assert.equal(classSchema.safeParse({
    stage: "primary",
    grade: "Grade1",
    section: "101",
    gender: "female",
    active: true
  }).success, true);
});

test("يقبل الجنس المختلط عند إضافة طالب للمرحلة الابتدائية", () => {
  assert.equal(studentSchema.safeParse({ ...base, stage: "primary", grade: "Grade1", gender: "mixed" }).success, true);
});

test("يرفض صفًا لا يتوافق مع المرحلة", () => {
  assert.equal(studentSchema.safeParse({ ...base, stage: "primary", grade: "KG1", gender: "male" }).success, false);
});

test("يعتمد نطاق جدول المستخدم افتراضيًا ويرفض نطاقًا مجهولًا", () => {
  assert.equal(scheduleQuerySchema.parse({}).scope, "mine");
  assert.equal(scheduleQuerySchema.safeParse({ scope: "all" }).success, true);
  assert.equal(scheduleQuerySchema.safeParse({ scope: "everyone" }).success, false);
});

test("يقبل حصة دراسية بدون اسم حصة صريح ويستبدله بالمادة", () => {
  assert.equal(scheduleSchema.safeParse({
    blockType: "class",
    day: "sunday",
    periodNumber: 1,
    periodName: "",
    startTime: "08:00",
    endTime: "08:40",
    teacherUid: "teacher_1",
    subject: "رياضيات",
    classId: "class_1"
  }).success, true);
});

test("allows period eight and rejects period nine", () => {
  const schedule = {
    blockType: "class",
    day: "sunday",
    startTime: "08:00",
    endTime: "08:40",
    teacherUid: "teacher_1",
    subject: "رياضيات",
    classId: "class_1"
  };

  assert.equal(scheduleSchema.safeParse({ ...schedule, periodNumber: 8 }).success, true);
  assert.equal(scheduleSchema.safeParse({ ...schedule, periodNumber: 9 }).success, false);
});

test("يقبل معرّفات الجدول التي تحتوي فواصل صالحة ضمن معرّفات Firebase", () => {
  const schedule = {
    blockType: "class",
    day: "sunday",
    startTime: "08:00",
    endTime: "08:40",
    teacherUid: "google.com:teacher.1",
    subject: "رياضيات",
    classId: "grade.1:101"
  };
  assert.equal(scheduleSchema.safeParse(schedule).success, true);
  assert.equal(scheduleQuerySchema.safeParse({ scope: "all", teacherUid: schedule.teacherUid, classId: schedule.classId }).success, true);
});

const validEmployee = {
  nameAr: "عبير صالح شقير السحيمي",
  nameEn: "Abeer Salah Alsuahimi",
  nationalId: "1234567890",
  email: "employee@nas.edu.sa",
  phone: "0500000000",
  employeeNumber: "T001",
  role: "teacher",
  department: "القسم الأكاديمي",
  hireDate: "2026-08-01",
  employmentType: "full_time",
  employmentStatus: "active",
  qualification: "بكالوريوس",
  specialization: "تقنية معلومات",
  status: "active"
};

test("يتحقق من اكتمال ملف الموظفة وصحة رقم الهوية", () => {
  assert.equal(employeeSchema.safeParse(validEmployee).success, true);
  assert.equal(employeeSchema.safeParse({ ...validEmployee, nationalId: "123" }).success, false);
});

test("يرفض حقن صلاحيات ضمن ملف الموظفة", () => {
  assert.equal(employeeSchema.safeParse({ ...validEmployee, manage_employees: true }).success, false);
});

test("يتحقق من رقم هوية ولي الأمر وكلمة المرور", () => {
  assert.equal(parentLoginSchema.safeParse({ nationalId: "1234567890", password: "Parent@123" }).success, true);
  assert.equal(parentLoginSchema.safeParse({ nationalId: "12345", password: "Parent@123" }).success, false);
  assert.equal(parentLoginSchema.safeParse({ nationalId: "1234567890", password: "" }).success, false);
});

test("يتحقق من بيانات تعديل ولي الأمر دون قبول حقول إضافية", () => {
  const parent = { nameAr: "ولي الأمر", nationalId: "1234567890", email: "parent@example.com", phone: "0500000000" };
  assert.equal(parentUpdateSchema.safeParse(parent).success, true);
  assert.equal(parentUpdateSchema.safeParse({ ...parent, nationalId: "12345" }).success, false);
  assert.equal(parentUpdateSchema.safeParse({ ...parent, isAdmin: true }).success, false);
});
