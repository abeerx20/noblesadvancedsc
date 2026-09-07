import { Router } from "express";
import * as controller from "../controllers/attendanceController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { attendanceEligibilitySchema, attendanceEntriesSchema, attendanceQuerySchema, attendanceSchema, idParamSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const attendanceRoutes = Router();
attendanceRoutes.use(authenticate);
attendanceRoutes.get("/eligibility", requirePermission("enter_attendance", "manage_attendance", "attendance_override"), validate(attendanceEligibilitySchema, "query"), asyncHandler(controller.eligibility));
attendanceRoutes.get("/", requirePermission("view_attendance", "manage_attendance"), validate(attendanceQuerySchema, "query"), asyncHandler(controller.index));
attendanceRoutes.post("/", requirePermission("enter_attendance", "manage_attendance", "attendance_override"), validate(attendanceSchema), asyncHandler(controller.create));
attendanceRoutes.put("/:id", requirePermission("manage_attendance"), validate(idParamSchema, "params"), validate(attendanceEntriesSchema), asyncHandler(controller.update));

