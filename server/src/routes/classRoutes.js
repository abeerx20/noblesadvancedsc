import { Router } from "express";
import * as controller from "../controllers/classController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { classSchema, idParamSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const classRoutes = Router();
classRoutes.use(authenticate);
classRoutes.get("/", requirePermission("view_students", "manage_students", "enter_attendance", "view_schedules", "manage_schedules"), asyncHandler(controller.index));
classRoutes.post("/", requirePermission("manage_students"), validate(classSchema), asyncHandler(controller.create));
classRoutes.put("/:id", requirePermission("manage_students"), validate(idParamSchema, "params"), validate(classSchema), asyncHandler(controller.update));
classRoutes.delete("/:id", requirePermission("manage_students"), validate(idParamSchema, "params"), asyncHandler(controller.remove));
