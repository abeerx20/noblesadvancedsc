import multer from "multer";
import { Router } from "express";
import * as controller from "../controllers/employeeController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { accessUpdateSchema, employeeSchema, idParamSchema, limitQuerySchema, passwordResetSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const excelUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (_req, file, callback) => {
        const validExtension = file.originalname.toLowerCase().endsWith(".xlsx");
        const validMime = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"].includes(file.mimetype);
        if (!validExtension || !validMime) return callback(new AppError(422, "INVALID_EXCEL_FILE", "يجب اختيار ملف Excel صالح بصيغة xlsx."));
        callback(null, true);
    }
});

export const employeeRoutes = Router();
employeeRoutes.use(authenticate);
employeeRoutes.get("/", requirePermission("manage_employees", "manage_permissions", "view_all_schedules", "manage_schedules", "issue_work_assignments"), validate(limitQuerySchema, "query"), asyncHandler(controller.index));
employeeRoutes.post("/", requireRole("system_admin", "principal", "admin", "resource_user", "upper_management"), requirePermission("manage_employees"), validate(employeeSchema), asyncHandler(controller.create));
employeeRoutes.post("/import/preview", requireRole("system_admin", "principal", "admin", "resource_user"), requirePermission("manage_employees"), excelUpload.single("file"), asyncHandler(controller.previewImport));
employeeRoutes.post("/import/commit", requireRole("system_admin", "principal", "admin", "resource_user"), requirePermission("manage_employees"), excelUpload.single("file"), asyncHandler(controller.commitImport));
employeeRoutes.get("/:id/access", requireRole("system_admin", "resource_user"), requirePermission("manage_permissions"), validate(idParamSchema, "params"), asyncHandler(controller.access));
employeeRoutes.patch("/:id/password", requireRole("system_admin", "principal", "admin", "upper_management"), requirePermission("manage_employees"), validate(idParamSchema, "params"), validate(passwordResetSchema), asyncHandler(controller.resetPassword));
employeeRoutes.delete("/:id", requireRole("system_admin", "principal", "admin", "resource_user", "upper_management"), requirePermission("manage_employees"), validate(idParamSchema, "params"), asyncHandler(controller.remove));
employeeRoutes.patch("/:id/access", requireRole("system_admin", "resource_user"), requirePermission("manage_permissions"), validate(idParamSchema, "params"), validate(accessUpdateSchema), asyncHandler(controller.updatePermissions));
