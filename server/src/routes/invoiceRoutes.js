import { Router } from "express";
import multer from "multer";
import * as controller from "../controllers/invoiceController.js";
import { authenticate } from "../middleware/authenticate.js";
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

export const invoiceRoutes = Router();
invoiceRoutes.use(authenticate);
invoiceRoutes.get("/", asyncHandler(controller.index));
invoiceRoutes.post("/", upload.single("file"), asyncHandler(controller.create));