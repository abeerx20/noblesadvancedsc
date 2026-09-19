import multer from "multer";
import { Router } from "express";
import * as controller from "../controllers/parentAdminController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { parentSchema } from "../validators/schemas.js";
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

export const parentAdminRoutes = Router();
parentAdminRoutes.use(authenticate, requireRole("system_admin"));
parentAdminRoutes.get("/", asyncHandler(controller.index));
parentAdminRoutes.post("/", validate(parentSchema), asyncHandler(controller.create));
parentAdminRoutes.post("/import/preview", excelUpload.single("file"), asyncHandler(controller.previewImport));
parentAdminRoutes.post("/import/commit", excelUpload.single("file"), asyncHandler(controller.commitImport));