import { Router } from "express";
import * as controller from "../controllers/studentReportController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { studentReportSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const studentReportRoutes = Router();
studentReportRoutes.use(authenticate, requireRole("system_admin", "principal", "vice_principal", "admin"));
studentReportRoutes.post("/", validate(studentReportSchema), asyncHandler(controller.create));
