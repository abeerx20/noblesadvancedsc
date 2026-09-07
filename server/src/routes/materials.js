// routes/materials.js - ✅ مثال على استخدام middleware المصادقة
import express from "express";
import { verifyFirebaseToken, requireRole } from "../middleware/auth.js";
import * as materialsController from "../controllers/materials.js";

const router = express.Router();

/**
 * ✅ POST /api/v1/requests/materials
 * يتطلب:
 * 1. Firebase token صحيح
 * 2. صلاحيات معينة (مثلاً معلم أو إداري)
 */
router.post(
    "/requests/materials",
    verifyFirebaseToken, // ✅ التحقق من التوكن أولاً
    requireRole(["teacher", "admin"]), // ✅ التحقق من الدور
    materialsController.createMaterialRequest // ✅ معالج الطلب
);

/**
 * ✅ GET /api/v1/requests/materials
 */
router.get(
    "/",
    verifyFirebaseToken,
    materialsController.getMaterials
);

router.get(
    "/:id",
    verifyFirebaseToken,
    materialsController.getMaterialById
);
/**
 * ✅ PUT /api/v1/requests/materials/:id
 */

// ✅ تحديث مادة
// PATCH /api/v1/materials/:id

materialsRoutes.patch("/:id", async (req, res, next) => {
    try {

        const {
            nameAr,
            materialDesc,
            code,
            materialCode,
            units,
            quantityDesc
        } = req.body;

        const material = await materialService.update(
            req.params.id,
            {
                nameAr,
                materialDesc,
                code,
                materialCode,
                units,
                quantityDesc
            }
        );

        res.json({
            success: true,
            message: "تم تحديث المادة بنجاح",
            data: material
        });

    } catch (error) {
        next(error);
    }
});
/**
 * ✅ DELETE /api/v1/requests/materials/:id
 */
router.delete(
    "/requests/materials/:id",
    verifyFirebaseToken,
    requireRole(["admin"]),
    materialsController.deleteMaterial
);

export default router;