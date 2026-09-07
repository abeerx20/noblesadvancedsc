import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/fileController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) return callback(new AppError(422, "UNSUPPORTED_FILE_TYPE", "المسموح فقط: PDF أو JPG أو PNG."));
    callback(null, true);
  }
});

export const fileRoutes = Router();
fileRoutes.use(authenticate);
fileRoutes.post("/", requirePermission("upload_files", "request_training"), upload.single("file"), asyncHandler(controller.upload));
fileRoutes.get("/download", asyncHandler(controller.download));
