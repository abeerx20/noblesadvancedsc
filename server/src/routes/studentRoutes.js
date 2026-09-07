import { Router } from "express";
import * as controller from "../controllers/studentController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema, studentQuerySchema, studentSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import multer from "multer";
import { AppError } from "../utils/AppError.js";

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!file.originalname.toLowerCase().endsWith(".xlsx")) return callback(new AppError(422, "INVALID_EXCEL_FILE", "يجب اختيار ملف Excel بصيغة xlsx."));
    callback(null, true);
  }
});

export const studentRoutes = Router();
studentRoutes.use(authenticate);
studentRoutes.get("/", requirePermission("view_students", "manage_students", "enter_attendance", "manage_attendance", "attendance_override"), validate(studentQuerySchema, "query"), asyncHandler(controller.index));
studentRoutes.get("/export", requirePermission("view_students", "manage_students"), validate(studentQuerySchema.pick({ classId: true }).required(), "query"), asyncHandler(controller.exportClass));
studentRoutes.post("/import", requirePermission("manage_students"), excelUpload.single("file"), asyncHandler(controller.importClass));
studentRoutes.post("/import-school", requirePermission("manage_students"), excelUpload.single("file"), asyncHandler(controller.importSchool));
studentRoutes.post("/", requirePermission("manage_students"), validate(studentSchema), asyncHandler(controller.create));
studentRoutes.put("/:id", requirePermission("manage_students"), validate(idParamSchema, "params"), validate(studentSchema), asyncHandler(controller.update));
studentRoutes.delete("/:id", requirePermission("manage_students"), validate(idParamSchema, "params"), asyncHandler(controller.remove));
