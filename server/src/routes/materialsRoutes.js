// routes/materialsRoutes.js
import { Router } from "express";
import { materialService } from "../services/materialService.js";

export const materialsRoutes = Router();

// ✅ جلب جميع المواد
// GET /api/v1/materials
// ✅ تحديث مادة
// PUT /api/v1/materials/:id

materialsRoutes.put("/:id", async (req, res, next) => {
    try {

        const {
            itemNumber,
            code,
            nameAr,
            quantityDescription,
            units
        } = req.body;
        const material = await materialService.update(
            req.params.id,
            {
                itemNumber: req.body.itemNumber,
                code: req.body.code,
                nameAr: req.body.nameAr,
                quantityDescription: req.body.quantityDescription,
                units: req.body.units
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

// ✅ جلب مادة واحدة
// GET /api/v1/materials/:id
materialsRoutes.get("/:id", async (req, res, next) => {
    try {
        const material = await materialService.getById(req.params.id);

        if (!material) {
            return res.status(404).json({
                success: false,
                error: {
                    code: "NOT_FOUND",
                    message: "المادة غير موجودة"
                }
            });
        }

        res.json({ success: true, data: material });
    } catch (error) {
        next(error);
    }
});

// ✅ إضافة مادة جديدة
// POST /api/v1/materials
materialsRoutes.post("/", async (req, res, next) => {
    try {
        const { name, code, unit, category } = req.body;

        if (!name || !code) {
            return res.status(400).json({
                success: false,
                error: {
                    code: "MISSING_FIELDS",
                    message: "الاسم والكود مطلوبان"
                }
            });
        }

        const newMaterial = await materialService.create({
            name,
            code,
            unit,
            category
        });

        res.status(201).json({
            success: true,
            message: "تم إضافة المادة بنجاح",
            data: newMaterial
        });

    } catch (error) {
        next(error);
    }
});

// ✅ تحديث مادة
// PATCH /api/v1/materials/:id

// ✅ تحديث مادة
// PATCH /api/v1/materials/:id

materialsRoutes.put("/:id", async (req, res, next) => {
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
            message: "تم التحديث من updateMaterial API"
        });

    } catch (error) {
        next(error);
    }
});

// ✅ حذف مادة
// DELETE /api/v1/materials/:id

materialsRoutes.delete("/:id", async (req, res, next) => {
    try {

        await materialService.delete(req.params.id);

        res.json({
            success: true,
            message: "تم حذف المادة بنجاح"
        });

    } catch (error) {
        next(error);
    }
});