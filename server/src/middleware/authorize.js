import { AppError } from "../utils/AppError.js";
export function requirePermission(...requiredPermissions) {
  return function permissionGuard(req, _res, next) {

    console.log("USER =", req.user);
    console.log("PERMISSIONS =", req.user?.permissions);
    console.log("REQUIRED =", requiredPermissions);

    const granted = new Set(req.user?.permissions ?? []);
    // النظامي: system_admin يتجاوز الصلاحيات الوظيفية فقط بعد التحقق من هوية Firebase
    if (["system_admin", "upper_management"].includes(req.user?.employee?.role)) return next();

    if (!requiredPermissions.some((permission) => granted.has(permission))) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "لا توجد لديك صلاحية لتنفيذ هذه العملية."
        )
      );
    }

    next();
  };
}

export function requireAllPermissions(...requiredPermissions) {
  return function allPermissionsGuard(req, _res, next) {
    if (["system_admin", "upper_management"].includes(req.user?.employee?.role)) return next();
    const granted = new Set(req.user?.permissions ?? []);
    if (!requiredPermissions.every((permission) => granted.has(permission))) {
      return next(new AppError(403, "FORBIDDEN", "لا توجد لديك الصلاحيات الكافية لتنفيذ هذه العملية."));
    }
    next();
  };
}

export function requireRole(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    const role = req.user?.employee?.role;
    const inheritedAdminRole = role === "upper_management" && (allowedRoles.includes("admin") || allowedRoles.includes("system_admin"));
    if (!role || (!allowedRoles.includes(role) && !inheritedAdminRole)) {
      return next(new AppError(403, "FORBIDDEN", "لا توجد لديك صلاحية لتنفيذ هذه العملية."));
    }
    next();
  };
}
