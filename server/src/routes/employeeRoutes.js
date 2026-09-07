import { Router } from "express";
import * as controller from "../controllers/employeeController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { accessUpdateSchema, employeeSchema, idParamSchema, limitQuerySchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const employeeRoutes = Router();
employeeRoutes.use(authenticate);
employeeRoutes.get("/", requirePermission("manage_employees", "manage_permissions", "view_all_schedules", "manage_schedules", "issue_work_assignments"), validate(limitQuerySchema, "query"), asyncHandler(controller.index));
employeeRoutes.post("/", requireRole("system_admin", "principal", "admin"), requirePermission("manage_employees"), validate(employeeSchema), asyncHandler(controller.create));
employeeRoutes.get("/:id/access", requireRole("system_admin"), requirePermission("manage_permissions"), validate(idParamSchema, "params"), asyncHandler(controller.access));
employeeRoutes.patch("/:id/access", requireRole("system_admin"), requirePermission("manage_permissions"), validate(idParamSchema, "params"), validate(accessUpdateSchema), asyncHandler(controller.updatePermissions));
