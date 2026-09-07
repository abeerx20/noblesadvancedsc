import { z } from "zod";

const clean = (min, max, label) => z.string()
  .trim()
  .min(min, `${label} مطلوب.`)
  .max(max, `${label} أطول من الحد المسموح.`)
  .transform((value) => value.replace(/\s+/g, " "));

const id = z.string().trim().min(1, "المعرّف مطلوب.").max(180, "المعرّف أطول من الحد المسموح.").regex(/^[\p{L}\p{N}_-]+$/u, "المعرّف غير صالح.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ غير صالح.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "الوقت غير صالح.");
const optionalUrl = z.union([
  z.literal(""),
  z.url("رابط المرفق غير صالح."),
  z.string().regex(/^uploads\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+$/, "مسار المرفق غير صالح.")
]).optional();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100)
}).catchall(z.string().max(180).optional());

export const studentSchema = z.object({
  fullName: clean(4, 120, "اسم الطالب"),
  stage: z.enum(["kindergarten", "primary"], { error: "المرحلة مطلوبة." }),
  grade: z.enum(["KG1", "KG2", "KG3", "Grade1", "Grade2", "Grade3"], { error: "الصف مطلوب." }),
  classId: id,
  gender: z.enum(["mixed", "male", "female"], { error: "الجنس مطلوب." }),
  guardianName: clean(3, 120, "اسم ولي الأمر").optional(),
  guardianPhone: z.string().trim().regex(/^(?:9665\d{8}|05\d{8})$/, "رقم الجوال غير صالح.").optional().or(z.literal("")),
  nationalId: z.string().trim().regex(/^\d{10}$/, "رقم الهوية يجب أن يتكون من 10 أرقام.").optional().or(z.literal("")),
  serialNumber: z.coerce.number().int().positive().optional(),
  active: z.boolean().default(true)
}).superRefine((value, ctx) => {
  if (value.stage === "kindergarten" && value.gender !== "mixed") {
    ctx.addIssue({ code: "custom", path: ["gender"], message: "فصول رياض الأطفال تستخدم خيار مختلط." });
  }
  if (value.stage === "primary" && value.gender === "mixed") {
    ctx.addIssue({ code: "custom", path: ["gender"], message: "يجب فصل البنين والبنات في المرحلة الابتدائية." });
  }
  if (value.stage === "kindergarten" && !value.grade.startsWith("KG")) {
    ctx.addIssue({ code: "custom", path: ["grade"], message: "الصف لا يتوافق مع مرحلة رياض الأطفال." });
  }
  if (value.stage === "primary" && !value.grade.startsWith("Grade")) {
    ctx.addIssue({ code: "custom", path: ["grade"], message: "الصف لا يتوافق مع المرحلة الابتدائية." });
  }
});

export const classSchema = z.object({
  name: z.union([z.literal(""), clean(1, 80, "اسم الفصل")]).optional().transform((value) => value ?? ""),
  stage: z.enum(["kindergarten", "primary"]),
  grade: z.enum(["KG1", "KG2", "KG3", "Grade1", "Grade2", "Grade3"]),
  section: clean(1, 20, "الشعبة"),
  gender: z.enum(["mixed", "male", "female"]),
  active: z.boolean().default(true)
}).superRefine((value, ctx) => {
  if (value.stage === "primary" && value.gender === "mixed") {
    ctx.addIssue({ code: "custom", path: ["gender"], message: "لا يمكن أن يكون الفصل الابتدائي مختلطًا." });
  }
  if (value.stage === "kindergarten" && value.gender !== "mixed") {
    ctx.addIssue({ code: "custom", path: ["gender"], message: "اختاري مختلط لرياض الأطفال." });
  }
});

const attendanceEntry = z.object({
  studentId: id,
  status: z.enum(["present", "excused", "unexcused", "late"])
});

export const attendanceSchema = z.object({
  classId: id,
  date,
  weekNumber: z.coerce.number().int().min(1).max(53),
  entries: z.array(attendanceEntry).min(1, "لا توجد حالات طلاب للحفظ.").max(100)
});

export const attendanceQuerySchema = z.object({
  classId: id.optional(),
  date: date.optional(),
  teacherUid: id.optional(),
  status: z.enum(["present", "excused", "unexcused", "late"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

export const attendanceEligibilitySchema = z.object({ classId: id, date });
export const attendanceEntriesSchema = z.object({ entries: z.array(attendanceEntry).min(1).max(100) });

export const studentQuerySchema = z.object({
  classId: id.optional(),
  stage: z.enum(["kindergarten", "primary"]).optional(),
  grade: z.enum(["KG1", "KG2", "KG3", "Grade1", "Grade2", "Grade3"]).optional(),
  gender: z.enum(["mixed", "male", "female"]).optional(),
  search: z.string().trim().max(120).optional(),
  approvedOnly: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

export const studentRosterSchema = z.object({
  fullName: clean(4, 120, "اسم الطالب"),
  classId: id,
  subject: clean(1, 80, "المادة"),
  gender: z.enum(["male", "female"], { error: "جنس الطالب مطلوب." }),
  guardianPhone: z.string().trim().regex(/^(?:9665\d{8}|05\d{8})$/, "رقم الجوال غير صالح.").optional().or(z.literal("")),
  nationalId: z.string().trim().regex(/^\d{10}$/, "رقم الهوية يجب أن يتكون من 10 أرقام.").optional().or(z.literal(""))
}).strict();

export const studentRosterQuerySchema = z.object({
  classId: id,
  subject: clean(1, 80, "المادة"),
  status: z.enum(["draft", "active", "deferred"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100)
});

export const studentRosterStatusSchema = z.object({
  status: z.enum(["draft", "active", "deferred"], { error: "حالة القيد غير صالحة." })
}).strict();

export const scheduleQuerySchema = z.object({
  scope: z.enum(["mine", "all"]).default("mine"),
  teacherUid: id.optional(),
  classId: id.optional(),
  day: z.enum(["sunday", "monday", "tuesday", "wednesday", "thursday"]).optional()
}).strict();

export const limitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  scope: z.enum(["mine", "all"]).optional()
});

export const leaveQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  scope: z.enum(["mine", "all", "manager", "hr"]).default("mine")
});

export const scheduleSchema = z.object({
  blockType: z.enum(["class", "break"]),
  day: z.enum(["sunday", "monday", "tuesday", "wednesday", "thursday"]),
  periodNumber: z.coerce.number().int().min(1).max(12).optional(),
  periodName: clean(1, 40, "اسم الحصة أو الفترة"),
  startTime: time,
  endTime: time,
  teacherUid: id,
  subject: clean(1, 80, "المادة").optional(),
  classId: id.optional(),
  location: clean(1, 80, "المكان").optional()
}).strict().superRefine((value, ctx) => {
  if (value.blockType === "class" && (!value.classId || !value.subject || !value.periodNumber)) {
    ctx.addIssue({ code: "custom", path: ["classId"], message: "الفصل والمادة ورقم الحصة مطلوبة للحصة الدراسية." });
  }
  if (value.blockType === "break" && (value.classId || value.subject || value.periodNumber)) {
    ctx.addIssue({ code: "custom", path: ["blockType"], message: "المناوبة لا تقبل بيانات الفصل أو المادة أو رقم الحصة." });
  }
});

export const leaveSchema = z.object({
  leaveType: z.enum(["sick", "emergency", "maternity", "nursing_hour", "marriage", "bereavement", "unpaid"]),
  startDate: date,
  endDate: date,
  attachmentUrl: optionalUrl,
  notes: clean(0, 500, "الملاحظات").optional()
}).superRefine((value, ctx) => {
  if (["sick", "maternity", "nursing_hour", "marriage", "bereavement"].includes(value.leaveType) && !value.attachmentUrl) {
    ctx.addIssue({ code: "custom", path: ["attachmentUrl"], message: "المرفق مطلوب لهذا النوع من الإجازات." });
  }
});

export const leaveExtensionSchema = z.object({
  parentLeaveId: id,
  endDate: date,
  notes: clean(0, 500, "الملاحظات").optional()
});

export const permissionSchema = z.object({
  date,
  exitTime: time,
  returnTime: time.optional().or(z.literal("")),
  reason: clean(3, 500, "السبب"),
  attachmentUrl: optionalUrl
});

export const absenceReportSchema = z.object({
  absenceType: z.enum(["sick", "emergency", "personal", "other"]),
  date,
  reason: clean(3, 500, "السبب"),
  attachmentUrl: optionalUrl
});

export const trainingSchema = z.object({
  courseName: clean(3, 160, "اسم الدورة"),
  provider: clean(2, 160, "الجهة المقدمة"),
  activityType: z.enum(["course", "workshop", "conference", "seminar", "other"]),
  specialization: clean(2, 160, "المجال أو التخصص"),
  startDate: date,
  endDate: date,
  attendanceType: z.enum(["in_person", "online"]),
  hours: z.coerce.number().positive().max(1000),
  certificateUrl: z.string().url("رابط الشهادة غير صحيح.").refine((value) => /^https?:\/\//i.test(value), "رابط الشهادة غير صحيح."),
  notes: clean(0, 500, "الملاحظات").optional()
});
export const trainingAttendanceSchema = z.object({
  activityType: z.enum(["course", "workshop", "meeting", "conference"]),
  activityName: clean(3, 160, "اسم الفعالية"),
  field: clean(2, 160, "المجال").optional(),
  startDate: date,
  endDate: date,
  departureTime: time,
  hours: z.coerce.number().positive().max(1000),
  location: clean(2, 300, "المكان"),
  imageUrl: optionalUrl,
  notes: clean(0, 500, "الملاحظات").optional()
}).refine((value) => value.endDate >= value.startDate, "تاريخ النهاية يجب ألا يسبق تاريخ البداية.");

export const trainingCourseSchema = z.object({
  courseName: clean(3, 160, "اسم الدورة"),
  field: clean(2, 160, "مجال الدورة"),
  startDate: date,
  endDate: date,
  departureTime: time,
  location: clean(2, 300, "مكان الدورة"),
  description: clean(3, 1000, "وصف الدورة")
}).refine((value) => value.endDate >= value.startDate, "تاريخ النهاية يجب ألا يسبق تاريخ البداية.");

export const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  decisionNote: clean(3, 500, "ملاحظة القرار"),
  approvedAmount: z.coerce.number().positive().optional(),
  installments: z.coerce.number().int().positive().max(120).optional(),
  installmentAmount: z.coerce.number().positive().optional(),
  firstInstallmentDueDate: date.optional(),
  disbursedAt: date.optional()
});

export const assignmentSchema = z.object({
  assignmentType: clean(2, 100, "نوع التكليف"),
  assigneeUid: id,
  actingForUid: id.optional().or(z.literal("")),
  jobTitle: clean(2, 100, "المسمى الوظيفي"),
  tasks: z.array(clean(3, 300, "المهمة")).min(1, "يجب إضافة مهمة واحدة على الأقل.").max(20, "الحد الأعلى عشرون مهمة."),
  startDate: date,
  endDate: date,
  reason: clean(3, 500, "سبب التكليف"),
  location: clean(2, 120, "مكان التكليف"),
  notes: clean(0, 500, "الملاحظات").optional(),
  issuer: clean(2, 120, "جهة الإصدار")
});

export const assignmentIdSchema = z.object({ id });
export const certificateSchema = z.object({
  type: z.enum(["salary", "employment"]),
  employeeUid: id,
  salary: z.coerce.number().nonnegative().max(1000000).optional(),
  jobTitle: clean(2, 120, "المسمى الوظيفي"),
  issuer: clean(2, 160, "جهة الإصدار"),
  notes: clean(0, 1000, "ملاحظات").optional()
});



export const assetRequestSchema = z.object({
  assetName: clean(2, 160, "اسم العهدة"),
  reason: clean(3, 500, "السبب"),
  notes: clean(0, 500, "الملاحظات").optional()
});

export const assignedAssetSchema = z.object({
  assetName: clean(2, 160, "اسم العهدة"),
  assetNumber: clean(1, 60, "رقم العهدة").optional(),
  employeeUid: id,
  assignedAt: date,
  notes: clean(0, 500, "الملاحظات").optional()
});

export const assetUpdateSchema = z.object({
  assetName: clean(2, 160, "اسم العهدة").optional(),
  status: z.enum(["نشطة", "مسترجعة", "تالفة"]).optional(),
  returnedAt: date.optional()
}).refine((value) => Object.keys(value).length > 0, "يجب إدخال تعديل واحد على الأقل.")
  .refine((value) => value.status !== "مسترجعة" || value.returnedAt, "تاريخ استلام العهدة مطلوب عند إرجاعها.");

export const loanInquirySchema = z.object({
  amount: z.coerce.number().positive().max(1000000),
  reason: clean(3, 500, "السبب"),
  attachmentUrl: optionalUrl
});

export const loanUpdateSchema = z.object({
  status: z.enum(["تم الصرف", "قيد السداد", "مسددة"]).optional(),
  disbursedAt: date.optional(),
  paidInstallments: z.coerce.number().int().min(0).optional()
});

export const announcementSchema = z.object({
  title: clean(3, 160, "عنوان الإعلان"),
  body: clean(3, 2000, "نص الإعلان"),
  active: z.boolean().default(true),
  expiresAt: date.optional()
});

export const siteSettingsSchema = z.object({
  academicYear: clean(4, 20, "العام الدراسي"),
  semester: z.enum(["الفصل الدراسي الأول", "الفصل الدراسي الثاني"]),
  hijriYear: clean(4, 20, "السنة الهجرية")
});

export const accessUpdateSchema = z.object({
  active: z.boolean().optional(),
  view_students: z.boolean().optional(),
  view_all_students: z.boolean().optional(),
  manage_students: z.boolean().optional(),
  view_attendance: z.boolean().optional(),
  manage_attendance: z.boolean().optional(),
  enter_attendance: z.boolean().optional(),
  attendance_override: z.boolean().optional(),
  view_schedules: z.boolean().optional(),
  view_all_schedules: z.boolean().optional(),
  manage_schedules: z.boolean().optional(),
  request_leave: z.boolean().optional(),
  manage_leave_requests: z.boolean().optional(),
  manage_leave_hr_requests: z.boolean().optional(),
  request_training: z.boolean().optional(),
  manage_training_requests: z.boolean().optional(),
  issue_work_assignments: z.boolean().optional(),
  view_all_work_assignments: z.boolean().optional(),
  request_assets: z.boolean().optional(),
  manage_assets: z.boolean().optional(),
  request_loans: z.boolean().optional(),
  manage_loans: z.boolean().optional(),
  manage_employees: z.boolean().optional(),
  manage_permissions: z.boolean().optional(),
  manage_announcements: z.boolean().optional(),
  request_materials: z.boolean().optional(),
  manage_materials: z.boolean().optional(),
  request_suggestions: z.boolean().optional(),
  request_support: z.boolean().optional(),
  manage_support: z.boolean().optional()
}).strict();

export const employeeSchema = z.object({
  nameAr: clean(3, 120, "الاسم العربي"),
  nameEn: z.string().trim().min(3).max(120),
  nationalId: z.string().trim().regex(/^\d{10}$/, "رقم الهوية يجب أن يتكون من 10 أرقام."),
  email: z.email("البريد الإلكتروني غير صالح.").transform((value) => value.toLowerCase()),
  password: z.string().trim().min(6).max(128).optional(),
  phone: z.string().trim().regex(/^(?:9665\d{8}|05\d{8})$/, "رقم الجوال غير صالح."),
  employeeNumber: clean(1, 30, "الرقم الوظيفي"),
  role: z.enum(["teacher", "principal", "vice_principal", "hr", "it", "it_teacher", "admin", "registrar", "accountant", "counselor", "doctor", "system_admin", "schedule_admin", "upper_management"]),
  department: clean(2, 100, "القسم"),
  hireDate: date,
  employmentType: z.enum(["full_time", "part_time", "contract"], { error: "نوع العقد مطلوب." }),
  employmentStatus: z.enum(["active", "on_leave", "suspended", "terminated"], { error: "الحالة الوظيفية مطلوبة." }),
  qualification: clean(2, 120, "المؤهل العلمي"),
  specialization: clean(2, 120, "التخصص"),
  status: z.enum(["active", "inactive"]).default("active"),
  authUid: id.optional()
}).strict();

export const parentSchema = z.object({
  nameAr: clean(3, 120, "اسم ولي الأمر"),
  nationalId: z.string().trim().regex(/^\d{10}$/, "رقم الهوية يجب أن يتكون من 10 أرقام."),
  email: z.email("البريد الإلكتروني غير صالح.").transform((value) => value.toLowerCase()),
  password: z.string().trim().min(6).max(128),
  phone: z.string().trim().regex(/^(?:9665\d{8}|05\d{8})$/, "رقم الجوال غير صالح."),
  studentIds: z.array(id).min(1, "اختاري ابنًا واحدًا على الأقل.").max(20).transform((ids) => [...new Set(ids)]),
  status: z.enum(["active", "inactive"]).default("active")
}).strict();

export const parentReportFeedbackSchema = z.object({
  comment: clean(1, 2000, "تعليق ولي الأمر"),
  acknowledged: z.literal(true)
}).strict();

export const studentReportSchema = z.object({
  studentId: id,
  period: z.coerce.number().int().min(1).max(3),
  subject: clean(2, 120, "المادة"),
  score: z.union([z.string().trim().max(30), z.number()]).optional(),
  status: z.enum(["قيد المراجعة", "معتمد", "محتاج تعديل"]),
  teacherUid: id.optional(),
  teacherName: clean(2, 120, "اسم المعلمة").optional(),
  className: clean(1, 120, "الفصل").optional(),
  skills: z.array(z.object({ name: clean(1, 160, "اسم المهارة"), level: clean(1, 80, "التقييم"), note: z.string().trim().max(2000).optional() }).strict()).max(100)
}).strict();

export const communityPartnershipSchema = z.object({
  partnerName: clean(2, 160, "اسم الجهة"),
  partnerType: z.enum(["government", "private", "nonprofit", "individual", "other"]),
  contactName: clean(2, 100, "اسم التواصل").optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.email().optional(),
  field: clean(2, 120, "مجال الشراكة"),
  description: clean(5, 2000, "وصف الشراكة"),
  status: z.enum(["active", "ended"]).default("active"),
  beneficiaries: z.number().int().min(0).max(1000000).default(0)
}).strict();

export const idParamSchema = z.object({ id });
export const supportTicketSchema = z.object({
  category: z.enum(["technical", "account", "academic", "other"]),
  subject: clean(3, 160, "عنوان الطلب"),
  description: clean(10, 2000, "وصف المشكلة"),
  department: clean(2, 120, "القسم").optional(),
  priority: z.enum(["منخفضة", "متوسطة", "عالية", "عاجلة"]).default("متوسطة"),
  attachmentUrl: optionalUrl
});
export const supportUpdateSchema = z.object({
  status: z.enum(["جديدة", "قيد المعالجة", "بانتظار الموظف", "تم الحل", "مغلقة"]).optional(),
  comment: clean(1, 2000, "التعليق").optional(),
  assigneeUid: id.optional(),
  escalated: z.boolean().optional(),
  attachmentUrl: optionalUrl
}).refine((value) => Object.keys(value).length > 0, "يجب إدخال تحديث واحد على الأقل.");
export const suggestionSchema = z.object({
  type: z.enum(["suggestion", "complaint"]),
  text: clean(3, 2000, "التفاصيل"),
  destination: z.enum(["manager", "hr", "support"])
});
export const suggestionQuerySchema = leaveQuerySchema.extend({
  destination: z.enum(["manager", "hr", "support"]).optional()
});
export const decisionParamSchema = z.object({
  type: z.enum(["leave", "training", "training-course", "training-attendance", "permission", "absence", "asset", "loan", "material", "community", "suggestion"]),
  id
});
