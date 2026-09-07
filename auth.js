// middleware/auth.js
import admin from "firebase-admin";
import { AppError } from "../utils/AppError.js";

/**
 * ✅ التحقق من صحة Firebase Token
 * يجب إرسال التوكن في header Authorization: Bearer <token>
 */
export const verifyFirebaseToken = async (req, res, next) => {
    try {
        const authHeader = req.get("Authorization");

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            throw new AppError(
                401,
                "NO_TOKEN",
                "التوكن مفقود. يرجى إرسال Authorization header مع Bearer token"
            );
        }

        const token = authHeader.slice(7); // إزالة "Bearer " من البداية

        // التحقق من التوكن مع Firebase
        const decodedToken = await admin.auth().verifyIdToken(token);

        // حفظ معلومات المستخدم في الطلب
        req.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            customClaims: decodedToken.custom_claims || {}
        };

        next();
    } catch (error) {
        console.error("🔴 Firebase Token Verification Error:", error.message);

        // معالجة الأخطاء المختلفة
        if (error.code === "auth/id-token-expired") {
            return next(new AppError(401, "TOKEN_EXPIRED", "التوكن انتهت صلاحيته"));
        }

        if (error.code === "auth/invalid-id-token") {
            return next(new AppError(401, "INVALID_TOKEN", "التوكن غير صحيح"));
        }

        return next(new AppError(401, "AUTH_FAILED", "فشل التحقق من التوكن"));
    }
};

/**
 * ✅ التحقق من الصلاحيات
 * مثال: يجب أن يكون المستخدم معلم أو إداري
 */
export const requireRole = (allowedRoles = []) => {
    return (req, res, next) => {
        if (!req.user) {
            return next(new AppError(401, "NOT_AUTHENTICATED", "يجب تسجيل الدخول أولاً"));
        }

        const userRole = req.user.customClaims?.role;

        if (!userRole || !allowedRoles.includes(userRole)) {
            return next(
                new AppError(
                    403,
                    "INSUFFICIENT_PERMISSIONS",
                    `ليس لديك صلاحيات كافية. الأدوار المسموحة: ${allowedRoles.join(", ")}`
                )
            );
        }

        next();
    };
};

/**
 * ✅ التحقق من صلاحيات المستخدم على مورد معين
 */
export const canAccessResource = async (req, res, next) => {
    try {
        // هنا يمكنك إضافة منطق للتحقق من ملكية المورد
        // مثلاً: التحقق من أن المستخدم هو صاحب البيانات

        const userId = req.user.uid;
        const resourceId = req.params.id;

        // يمكنك عمل استعلام للقاعدة للتحقق من الملكية
        // const resource = await db.collection("resources").doc(resourceId).get();
        // if (resource.data().ownerId !== userId) { throw error }

        next();
    } catch (error) {
        next(new AppError(403, "ACCESS_DENIED", "ليس لديك صلاحيات للوصول لهذا المورد"));
    }
};