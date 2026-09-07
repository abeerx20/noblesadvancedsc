import { Router } from "express";
import * as controller from "../controllers/parentController.js";
import { authenticate } from "../middleware/authenticate.js";
import { requirePermission } from "../middleware/authorize.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema, parentReportFeedbackSchema } from "../validators/schemas.js";

export const parentRoutes = Router();
parentRoutes.use(authenticate);
parentRoutes.get("/children", requirePermission("view_own_children"), asyncHandler(controller.children));
parentRoutes.get("/attendance", requirePermission("view_own_attendance"), asyncHandler(controller.attendance));
parentRoutes.get("/reports", requirePermission("view_own_children"), asyncHandler(controller.reports));
parentRoutes.patch("/reports/:id/feedback", requirePermission("view_own_children"), validate(idParamSchema, "params"), validate(parentReportFeedbackSchema), asyncHandler(controller.acknowledgeReport));

