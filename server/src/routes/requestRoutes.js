import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/requestController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  assetRequestSchema,
  assignedAssetSchema,
  assetUpdateSchema,
  assignmentSchema,
  certificateSchema,
  assignmentIdSchema,
  absenceReportSchema,
  decisionParamSchema,
  decisionSchema,
  idParamSchema,
  leaveSchema,
  leaveExtensionSchema,
  leaveQuerySchema,
  suggestionQuerySchema,
  limitQuerySchema,
  loanInquirySchema,
  loanUpdateSchema,
  permissionSchema,
  trainingSchema,
  trainingCourseSchema,
  trainingAttendanceSchema,
  suggestionSchema
} from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

export const requestRoutes = Router();
requestRoutes.use(authenticate);
const materialImportUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const leaveAccess = (req, _res, next) => {
  const allowed = req.user?.employee?.role === "hr" || req.user?.permissions?.some((permission) => ["request_leave", "manage_leave_requests", "manage_leave_hr_requests"].includes(permission));
  if (!allowed) return next(new AppError(403, "FORBIDDEN", "لا توجد لديك صلاحية للوصول إلى طلبات الإجازات."));
  next();
};

requestRoutes.get("/leave", leaveAccess, validate(leaveQuerySchema, "query"), asyncHandler(controller.leaveIndex));
requestRoutes.post("/leave", requirePermission("request_leave"), validate(leaveSchema), asyncHandler(controller.createLeaveRequest));
requestRoutes.post("/leave/extension", requirePermission("request_leave"), validate(leaveExtensionSchema), asyncHandler(controller.createLeaveExtensionRequest));
requestRoutes.get("/training", requirePermission("request_training", "manage_training_requests"), validate(limitQuerySchema, "query"), asyncHandler(controller.trainingIndex));
requestRoutes.post("/training", requirePermission("request_training"), validate(trainingSchema), asyncHandler(controller.createTrainingRequest));
requestRoutes.get("/training-courses", requirePermission("request_training", "manage_training_requests"), validate(limitQuerySchema, "query"), asyncHandler(controller.trainingCourseIndex));
requestRoutes.post("/training-courses", requirePermission("request_training"), validate(trainingCourseSchema), asyncHandler(controller.createTrainingCourseRequest));
requestRoutes.get("/training-attendance", requirePermission("request_training", "manage_training_requests"), validate(limitQuerySchema, "query"), asyncHandler(controller.trainingAttendanceIndex));
requestRoutes.post("/training-attendance", requirePermission("request_training"), validate(trainingAttendanceSchema), asyncHandler(controller.createTrainingAttendanceRequest));
requestRoutes.get("/permission", requirePermission("request_leave", "manage_leave_requests"), validate(limitQuerySchema, "query"), asyncHandler(controller.permissionIndex));
requestRoutes.post("/permission", requirePermission("request_leave"), validate(permissionSchema), asyncHandler(controller.createPermission));
requestRoutes.get("/absence-report", requirePermission("request_absence", "request_leave", "manage_absence", "manage_leave_requests"), validate(limitQuerySchema, "query"), asyncHandler(controller.absenceReportIndex));
requestRoutes.post("/absence-report", requirePermission("request_absence", "request_leave"), validate(absenceReportSchema), asyncHandler(controller.createAbsenceReport));
requestRoutes.patch("/absence-report/:id/viewed", requirePermission("request_absence", "request_leave"), validate(idParamSchema, "params"), asyncHandler(controller.markAbsenceReportAsViewed));
requestRoutes.patch("/absence-report/:id/manager-viewed", requirePermission("manage_absence", "manage_leave_requests"), validate(idParamSchema, "params"), asyncHandler(controller.markAbsenceReportAsManagedViewed));
requestRoutes.get("/suggestions-complaints", requirePermission("request_suggestions", "manage_support"), validate(suggestionQuerySchema, "query"), asyncHandler(controller.suggestionIndex));
requestRoutes.post("/suggestions-complaints", requirePermission("request_suggestions"), validate(suggestionSchema), asyncHandler(controller.createSuggestionRequest));
requestRoutes.get("/assets", requirePermission("request_assets", "manage_assets"), validate(limitQuerySchema, "query"), asyncHandler(controller.assetIndex));
requestRoutes.post("/assets", requirePermission("request_assets"), validate(assetRequestSchema), asyncHandler(controller.createAsset));
requestRoutes.post("/assets/manage", requireRole("system_admin", "admin"), requirePermission("manage_assets"), validate(assignedAssetSchema), asyncHandler(controller.createAssignedAssetRequest));
requestRoutes.patch("/asset/:id", requireRole("system_admin", "admin"), requirePermission("manage_assets"), validate(assetUpdateSchema), asyncHandler(controller.updateAssignedAssetRequest));
requestRoutes.delete("/asset/:id", requireRole("system_admin", "admin"), requirePermission("manage_assets"), asyncHandler(controller.deleteAssignedAssetRequest));
// أضفه هنا (بعد test-materials)
// requestRoutes.get("/test-materials", (_req, res) => { res.json({ ok: true }); });
// ✅ أضف هالسطر الجديد:
requestRoutes.get("/materials", validate(limitQuerySchema, "query"), asyncHandler(controller.materialIndex));
requestRoutes.post("/materials", asyncHandler(controller.createMaterialRequest));
// بعد الـ materials routes الموجودة أضف:
requestRoutes.get("/test-materials", (req, res) => {
  console.log("TEST MATERIAL ROUTE WORKS"); res.json({ ok: true });
});
requestRoutes.get("/materials-list", asyncHandler(controller.getMaterials));
requestRoutes.post("/materials/manage", requireRole("system_admin", "admin"), asyncHandler(controller.addMaterial));
requestRoutes.patch("/materials/:id", requireRole("system_admin", "admin"), asyncHandler(controller.updateMaterial));
requestRoutes.delete("/materials/:id", requireRole("system_admin", "admin"), asyncHandler(controller.deleteMaterial));
requestRoutes.post("/materials/import", requireRole("system_admin", "admin"), materialImportUpload.single("file"), asyncHandler(controller.importMaterials));

requestRoutes.get(
  "/community",
  requirePermission("request_community", "manage_community"),
  validate(limitQuerySchema, "query"),
  asyncHandler(controller.communityIndex)
);

requestRoutes.post(
  "/community",
  requirePermission("request_community"),
  asyncHandler(controller.createCommunityRequest)
);


requestRoutes.get("/loans", requirePermission("request_loans", "manage_loans"), validate(limitQuerySchema, "query"), asyncHandler(controller.loanIndex));
requestRoutes.post("/loans", requirePermission("request_loans"), validate(loanInquirySchema), asyncHandler(controller.createLoan));
requestRoutes.patch("/loan/:id", requireRole("system_admin", "admin"), requirePermission("manage_loans"), validate(loanUpdateSchema), asyncHandler(controller.updateLoanRequest));
requestRoutes.get("/assignments", validate(limitQuerySchema, "query"), asyncHandler(controller.assignmentIndex));
requestRoutes.get(
  "/statistics",
  requireRole("system_admin", "principal", "vice_principal", "admin", "upper_management"),
  (req, _res, next) => {
    if (req.user.employee?.role === "system_admin" || req.user.permissions.some((permission) => ["manage_leave_requests", "manage_training_requests"].includes(permission))) return next();
    next(new AppError(403, "FORBIDDEN", "لا توجد لديك صلاحية عرض إحصائيات الطلبات."));
  },
  asyncHandler(controller.employeeRequestStatistics)
);
requestRoutes.post("/assignments", requirePermission("issue_work_assignments"), validate(assignmentSchema), asyncHandler(controller.createWorkAssignment));
requestRoutes.patch("/assignments/:id/acknowledge", validate(assignmentIdSchema, "params"), asyncHandler(controller.acknowledgeWorkAssignment));
requestRoutes.get("/certificates", asyncHandler(controller.certificateIndex));
requestRoutes.post("/certificates", requireRole("system_admin"), validate(certificateSchema), asyncHandler(controller.createCertificate));
requestRoutes.patch(
  "/:type/:id/decision",
  validate(decisionParamSchema, "params"),
  (req, _res, next) => {
    const required = {
      leave: "manage_leave_requests",
      permission: "manage_leave_requests",
      absence: "manage_absence",
      training: "manage_training_requests",
      "training-course": "manage_training_requests",
      "training-attendance": "manage_training_requests",
      asset: "manage_assets",
      loan: "manage_loans",
      material: "manage_materials",
      community: "manage_community",
      suggestion: "manage_support"
    }[req.params.type];
    const canManageAbsence = req.params.type === "absence" && req.user.permissions.some((permission) => ["manage_absence", "manage_leave_requests"].includes(permission));
    const canManageLeaveHr = req.params.type === "leave" && (req.user.permissions.includes("manage_leave_hr_requests") || req.user.employee?.role === "hr");
    if (req.user.employee?.role !== "system_admin" && !req.user.permissions.includes(required) && !canManageAbsence && !canManageLeaveHr) return next(new AppError(403, "FORBIDDEN", "لا توجد لديك صلاحية لاتخاذ قرار في هذا الطلب."));
    if (req.params.type === "training" && !["system_admin", "principal", "vice_principal", "admin"].includes(req.user.employee?.role)) {
      return next(new AppError(403, "FORBIDDEN", "إدارة شهادات التدريب متاحة للإدارة المخولة فقط."));
    }
    next();
  },
  validate(decisionSchema),
  asyncHandler(controller.decide)
);



