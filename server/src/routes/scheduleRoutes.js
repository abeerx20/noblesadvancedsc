import { Router } from "express";
import * as controller from "../controllers/scheduleController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema, scheduleQuerySchema, scheduleSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const scheduleRoutes = Router();
const scheduleManagementRoles = [
  "principal",
  "vice_principal",
  "admin",
  "system_admin",
  "schedule_admin",
  "upper_management"
];

scheduleRoutes.use(authenticate);
scheduleRoutes.get("/", requirePermission("view_schedules", "view_all_schedules", "manage_schedules"), validate(scheduleQuerySchema, "query"), asyncHandler(controller.index));
scheduleRoutes.post("/", requireRole(...scheduleManagementRoles), requirePermission("manage_schedules"), validate(scheduleSchema), asyncHandler(controller.create));
scheduleRoutes.patch(
  "/:id",
  requireRole(...scheduleManagementRoles),
  requirePermission("manage_schedules"),
  validate(idParamSchema, "params"),
  validate(scheduleSchema),
  asyncHandler(controller.update)
);

scheduleRoutes.delete("/:id", requireRole(...scheduleManagementRoles), requirePermission("manage_schedules"), validate(idParamSchema, "params"), asyncHandler(controller.remove));
