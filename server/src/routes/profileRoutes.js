import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const profileRoutes = Router();

profileRoutes.get("/me", authenticate, asyncHandler(async (req, res) => {
  const employee = req.user.employee;
  res.json({
    success: true,
    data: {
      uid: req.user.uid,
      email: req.user.email,
      userType: req.user.userType,
      employee: {
        id: employee.id,
        nameAr: employee.nameAr,
        nameEn: employee.nameEn,
        nationalId: employee.nationalId,
        employeeNumber: employee.employeeNumber,
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
      },
      parent: req.user.parent ? {
        id: req.user.parent.id,
        nameAr: req.user.parent.nameAr ?? req.user.parent.fullName,
        studentIds: req.user.parent.studentIds ?? []
      } : undefined,
      permissions: req.user.permissions
    }
  });
}));
