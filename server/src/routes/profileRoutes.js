import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const profileRoutes = Router();

export function serializeProfile(user) {
  const employee = user.employee;
  return {
    uid: user.uid,
    email: user.email,
    userType: user.userType,
    employee: employee ? {
      id: employee.id,
      nameAr: employee.nameAr,
      nameEn: employee.nameEn,
      nationalId: employee.nationalId,
      employeeNumber: employee.employeeNumber ?? employee.employeeId ?? employee.number ?? "—",
      role: employee.role,
      department: employee.department,
      email: employee.email,
      phone: employee.phone,
      hireDate: employee.hireDate,
      employmentType: employee.employmentType,
      employmentStatus: employee.employmentStatus,
      qualification: employee.qualification,
      specialization: employee.specialization,
      status: employee.status
    } : undefined,
    parent: user.parent ? {
      id: user.parent.id,
      nameAr: user.parent.nameAr ?? user.parent.fullName,
      nationalId: user.parent.nationalId ?? user.parent.idNumber ?? user.parent.identityNumber ?? null,
      studentIds: user.parent.studentIds ?? []
    } : undefined,
    permissions: user.permissions
  };
}

profileRoutes.get("/me", authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    data: serializeProfile(req.user)
  });
}));
