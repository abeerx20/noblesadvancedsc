import { Router } from "express";
import * as controller from "../controllers/coverageController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission, requireRole } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { coverageAbsenceSchema, coverageQuerySchema, coverageSchema, coverageUpdateSchema, idParamSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const coverageRoutes = Router();
const managementRoles = ["principal", "vice_principal", "admin", "system_admin", "schedule_admin", "upper_management"];
coverageRoutes.use(authenticate);
coverageRoutes.get("/mine", requirePermission("view_substitution_assignments"), validate(coverageQuerySchema, "query"), asyncHandler(controller.mine));
coverageRoutes.patch("/:id/acknowledge", requirePermission("view_substitution_assignments"), validate(idParamSchema, "params"), asyncHandler(controller.acknowledge));
coverageRoutes.get("/", requireRole(...managementRoles), requirePermission("manage_schedules"), validate(coverageQuerySchema, "query"), asyncHandler(controller.index));
coverageRoutes.post("/absences", requireRole(...managementRoles), requirePermission("manage_schedules"), validate(coverageAbsenceSchema), asyncHandler(controller.createAbsence));
coverageRoutes.post("/", requireRole(...managementRoles), requirePermission("manage_schedules"), validate(coverageSchema), asyncHandler(controller.assign));
coverageRoutes.patch("/:id", requireRole(...managementRoles), requirePermission("manage_schedules"), validate(idParamSchema, "params"), validate(coverageUpdateSchema), asyncHandler(controller.update));
