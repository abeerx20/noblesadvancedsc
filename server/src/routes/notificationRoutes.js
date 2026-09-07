import { Router } from "express";
import * as controller from "../controllers/notificationController.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const notificationRoutes = Router();
notificationRoutes.use(authenticate);
notificationRoutes.get("/", asyncHandler(controller.index));
notificationRoutes.patch("/:id/read", validate(idParamSchema, "params"), asyncHandler(controller.markRead));
