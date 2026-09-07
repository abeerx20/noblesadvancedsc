import multer from "multer";
import { Router } from "express";
import * as controller from "../controllers/studentRosterController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  idParamSchema,
  studentRosterQuerySchema,
  studentRosterSchema,
  studentRosterStatusSchema
} from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const validExtension = file.originalname.toLowerCase().endsWith(".xlsx");
    const validMime = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/octet-stream"
    ].includes(file.mimetype);
    if (!validExtension || !validMime) {
      return callback(new AppError(422, "INVALID_EXCEL_FILE", "يجب اختيار ملف Excel صالح بصيغة xlsx."));
    }
    callback(null, true);
  }
});

export const studentRosterRoutes = Router();
studentRosterRoutes.use(authenticate);
studentRosterRoutes.get("/options", requirePermission("view_students", "view_all_students", "manage_students"), asyncHandler(controller.options));
studentRosterRoutes.get("/export", requirePermission("view_students", "view_all_students", "manage_students"), validate(studentRosterQuerySchema, "query"), asyncHandler(controller.exportRoster));
studentRosterRoutes.get("/", requirePermission("view_students", "view_all_students", "manage_students"), validate(studentRosterQuerySchema, "query"), asyncHandler(controller.index));
studentRosterRoutes.post("/import/preview", requirePermission("manage_students"), excelUpload.single("file"), asyncHandler(controller.previewImport));
studentRosterRoutes.post("/import/commit", requirePermission("manage_students"), excelUpload.single("file"), asyncHandler(controller.commitImport));
studentRosterRoutes.post("/", requirePermission("manage_students"), validate(studentRosterSchema), asyncHandler(controller.create));
studentRosterRoutes.put("/:id", requirePermission("manage_students"), validate(idParamSchema, "params"), validate(studentRosterSchema), asyncHandler(controller.update));
studentRosterRoutes.patch("/:id/status", requirePermission("manage_students"), validate(idParamSchema, "params"), validate(studentRosterStatusSchema), asyncHandler(controller.updateStatus));
studentRosterRoutes.delete("/:id", requirePermission("manage_students"), validate(idParamSchema, "params"), asyncHandler(controller.remove));
