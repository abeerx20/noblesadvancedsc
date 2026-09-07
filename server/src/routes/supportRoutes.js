import { Router } from "express";
import * as controller from "../controllers/supportController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { supportTicketSchema, supportUpdateSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const supportRoutes = Router();
supportRoutes.use(authenticate);
supportRoutes.get("/", requirePermission("request_support", "manage_support"), asyncHandler(controller.index));
supportRoutes.post("/", requirePermission("request_support", "manage_support"), validate(supportTicketSchema), asyncHandler(controller.create));
supportRoutes.get("/:id", requirePermission("request_support", "manage_support"), asyncHandler(controller.details));
supportRoutes.patch("/:id", requirePermission("manage_support"), validate(supportUpdateSchema), asyncHandler(controller.update));

