import test from "node:test";
import assert from "node:assert/strict";
import { classSchema, employeeSchema, scheduleQuerySchema, studentSchema } from "../src/validators/schemas.js";

const base = { fullName: "محمد أحمد علي سالم", classId: "class_a", active: true };

test("يقبل فصل روضة مختلطًا", () => {
  assert.equal(studentSchema.safeParse({ ...base, stage: "kindergarten", grade: "KG2", gender: "mixed" }).success, true);
});

test("يقبل نموذج إضافة فصل بدون اسم ويولد الاسم تلقائيًا", () => {
  assert.equal(classSchema.safeParse({
    stage: "primary",
    grade: "Grade1",
    section: "أ",
    gender: "male",
    active: true
  }).success, true);
});

test("يرفض دمج البنين والبنات في الابتدائي", () => {
  assert.equal(studentSchema.safeParse({ ...base, stage: "primary", grade: "Grade1", gender: "mixed" }).success, false);
});

test("يرفض صفًا لا يتوافق مع المرحلة", () => {
  assert.equal(studentSchema.safeParse({ ...base, stage: "primary", grade: "KG1", gender: "male" }).success, false);
});

test("يعتمد نطاق جدول المستخدم افتراضيًا ويرفض نطاقًا مجهولًا", () => {
  assert.equal(scheduleQuerySchema.parse({}).scope, "mine");
  assert.equal(scheduleQuerySchema.safeParse({ scope: "all" }).success, true);
  assert.equal(scheduleQuerySchema.safeParse({ scope: "everyone" }).success, false);
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
