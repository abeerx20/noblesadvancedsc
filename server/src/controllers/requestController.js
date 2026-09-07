import {
  createAssignment,
  acknowledgeAssignment,
  createLeave,
  createLeaveExtension,
  createPermissionRequest,
  createSimpleOwnedRequest,
  createSuggestion,
  createAssignedAsset,
  updateAssignedAsset,
  deleteAssignedAsset,
  updateLoan,
  createTraining,
  createTrainingAttendance,
  createTrainingCourse,
  decideRequest,
  listAssignments,
  listOwned,
  listLeaveRequests,
  decideLeave,
  markAbsenceReportViewed,
  markAbsenceReportManagedViewed,
  listCertificates,
  createCertificate as createCertificateRecord,
  getEmployeeRequestStatistics
} from "../services/requestService.js";
import { writeAudit } from "../services/auditService.js";
import { db } from "../config/firebase.js";
import * as XLSX from "xlsx";


console.log("REQUEST CONTROLLER LOADED");
const has = (user, permission) => user.permissions.includes(permission);

async function created(req, res, entityType, creator) {
  const id = await creator();
  await writeAudit({ req, action: "create", entityType, entityId: id });
  res.status(201).json({ success: true, data: { id }, message: "تم إرسال الطلب بنجاح." });
}

export const createLeaveRequest = (req, res) => created(req, res, "leaveRequest", () => createLeave(req.user, req.body));
export const createLeaveExtensionRequest = (req, res) => created(req, res, "leaveExtension", () => createLeaveExtension(req.user, req.body));
export const createTrainingRequest = (req, res) => created(req, res, "trainingRequest", () => createTraining(req.user, req.body));
export const createTrainingAttendanceRequest = (req, res) => created(req, res, "trainingAttendanceRequest", () => createTrainingAttendance(req.user, req.body));
export const createTrainingCourseRequest = (req, res) => created(req, res, "trainingCourseRequest", () => createTrainingCourse(req.user, req.body));
export const createPermission = (req, res) => created(req, res, "permissionRequest", () => createPermissionRequest(req.user, req.body));
export const createAbsenceReport = (req, res) => created(req, res, "absenceReport", () => createSimpleOwnedRequest("absenceReports", req.user, req.body));
export async function markAbsenceReportAsViewed(req, res) {
  await markAbsenceReportViewed(req.user, req.params.id);
  res.json({ success: true, message: "تم تسجيل اطلاع الموظفة على البلاغ." });
}
export async function markAbsenceReportAsManagedViewed(req, res) {
  await markAbsenceReportManagedViewed(req.user, req.params.id);
  res.json({ success: true, message: "تم تسجيل اطلاع إدارة الغياب على البلاغ." });
}
export const createSuggestionRequest = (req, res) => created(req, res, "suggestionRequest", () => createSuggestion(req.user, req.body));
export const createAsset = (req, res) => created(req, res, "assetRequest", () => createSimpleOwnedRequest("assetRequests", req.user, req.body));
export const createAssignedAssetRequest = (req, res) => created(req, res, "assetRequest", () => createAssignedAsset(req.user, req.body));
export async function updateAssignedAssetRequest(req, res) {
  await updateAssignedAsset(req.params.id, req.body);
  res.json({ success: true, message: "تم تحديث بيانات العهدة بنجاح." });
}
export async function deleteAssignedAssetRequest(req, res) {
  await deleteAssignedAsset(req.params.id);
  res.json({ success: true, message: "تم حذف العهدة بنجاح." });
}
export async function updateLoanRequest(req, res) {
  const changes = { ...req.body };
  if (changes.status === "تم الصرف" && !changes.disbursedAt) changes.disbursedAt = new Date().toISOString().slice(0, 10);
  await updateLoan(req.params.id, changes);
  res.json({ success: true, message: "تم تحديث متابعة السلفة." });
}

export const createMaterialRequest = (req, res) => {

  console.log("🔥 CREATE MATERIAL REQUEST CALLED");

  return created(req, res, "materialRequest", () =>
    createSimpleOwnedRequest("materialRequests", req.user, req.body)
  );
};



export const createLoan = (req, res) => created(req, res, "loanInquiry", () => createSimpleOwnedRequest("loanInquiries", req.user, req.body));



export async function leaveIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const scope = ["all", "manager", "hr"].includes(query.scope) ? query.scope : "mine";
  res.json({ success: true, data: await listLeaveRequests(req.user, scope, Number(query.limit ?? 100)) });
}

export async function trainingIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const administrativeRoles = new Set(["system_admin", "principal", "vice_principal", "admin"]);
  const canViewAll = has(req.user, "manage_training_requests") && administrativeRoles.has(req.user.employee?.role) && query.scope !== "mine";
  res.json({ success: true, data: await listOwned("trainingRequests", req.user, canViewAll, Number(query.limit ?? 100)) });
}

export async function trainingCourseIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const canViewAll = has(req.user, "manage_training_requests") && query.scope !== "mine";
  res.json({ success: true, data: await listOwned("trainingCourseRequests", req.user, canViewAll, Number(query.limit ?? 100)) });
}

export async function permissionIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  res.json({ success: true, data: await listOwned("permissionRequests", req.user, has(req.user, "manage_leave_requests"), Number(query.limit ?? 100)) });
}
export async function absenceReportIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const canViewAll = (has(req.user, "manage_absence") || has(req.user, "manage_leave_requests") || req.user.employee?.role === "system_admin") && query.scope !== "mine";
  res.json({ success: true, data: await listOwned("absenceReports", req.user, canViewAll, Number(query.limit ?? 100)) });
}
export async function suggestionIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const canViewAll = (has(req.user, "manage_support") || req.user.employee?.role === "system_admin") && query.scope !== "mine";
  let records = await listOwned("suggestionRequests", req.user, canViewAll, Number(query.limit ?? 100));
  if (query.destination) records = records.filter((record) => record.destination === query.destination);
  res.json({ success: true, data: records });
}
export const createCommunityRequest = (req, res) =>
  created(req, res, "communityRequest", () =>
    createSimpleOwnedRequest(
      "communityRequests",
      req.user,
      req.body
    )
  );

export async function communityIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const canViewAll = (has(req.user, "manage_community") || req.user.employee?.role === "system_admin") && query.scope !== "mine";

  res.json({
    success: true,
    data: await listOwned(
      "communityRequests",
      req.user,
      canViewAll,
      Number(query.limit ?? 100)
    )
  });
}


export async function assetIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  res.json({ success: true, data: await listOwned("assetRequests", req.user, has(req.user, "manage_assets"), Number(query.limit ?? 100)) });
}

export async function loanIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const canViewAll = (has(req.user, "manage_loans") || req.user.employee?.role === "system_admin") && query.scope !== "mine";
  res.json({ success: true, data: await listOwned("loanInquiries", req.user, canViewAll, Number(query.limit ?? 100)) });
}

export async function employeeRequestStatistics(_req, res) {
  res.json({ success: true, data: await getEmployeeRequestStatistics() });
}

export async function decide(req, res) {
  const collections = {
    leave: "leaveRequests",
    training: "trainingRequests",
    "training-course": "trainingCourseRequests",
    "training-attendance": "trainingAttendanceRequests",
    permission: "permissionRequests",
    absence: "absenceReports",
    asset: "assetRequests",
    loan: "loanInquiries",
    material: "materialRequests",
    community: "communityRequests"

    , suggestion: "suggestionRequests"
  };

  if (req.params.type === "leave") await decideLeave(req.user, req.params.id, req.body);
  else await decideRequest(collections[req.params.type], req.user, req.params.id, req.body);
  await writeAudit({ req, action: req.body.status, entityType: req.params.type, entityId: req.params.id });
  res.json({ success: true, message: "تم تسجيل القرار بنجاح." });
}

export async function createWorkAssignment(req, res) {
  const id = await createAssignment(req.user, req.body);
  await writeAudit({ req, action: "create", entityType: "workAssignment", entityId: id, summary: { assigneeUid: req.body.assigneeUid } });
  res.status(201).json({ success: true, data: { id }, message: "تم إصدار التكليف بنجاح." });
}

export async function assignmentIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  const mayViewAll = has(req.user, "view_all_work_assignments") || has(req.user, "issue_work_assignments");
  const all = mayViewAll && query.scope !== "mine";
  res.json({ success: true, data: await listAssignments(req.user, all, Number(query.limit ?? 100)) });
}

export async function acknowledgeWorkAssignment(req, res) {
  await acknowledgeAssignment(req.user, req.params.id);
  await writeAudit({ req, action: "acknowledge", entityType: "workAssignment", entityId: req.params.id });
  res.json({ success: true, message: "تم تسجيل اطلاعك على خطاب التكليف." });
}


export async function certificateIndex(req, res) {
  const all = req.user.employee?.role === "system_admin";
  res.json({ success: true, data: await listCertificates(req.user, all) });
}

export async function createCertificate(req, res) {
  const id = await createCertificateRecord(req.user, req.body);
  await writeAudit({ req, action: "create", entityType: "employeeCertificate", entityId: id, summary: { type: req.body.type, employeeUid: req.body.employeeUid } });
  res.status(201).json({ success: true, data: { id }, message: "تم إضافة الخطاب بنجاح وسيظهر للموظفة." });
}

export async function materialIndex(req, res) {
  const query = req.validated?.query ?? req.query;
  res.json({ success: true, data: await listOwned("materialRequests", req.user, has(req.user, "manage_materials"), Number(query.limit ?? 100)) });
}


export async function getMaterials(req, res, next) {
  try {
    console.log("getMaterials called");

    const snapshot = await db.collection("materials").get();
    const materials = [];

    snapshot.forEach(doc => {


      const material = {
        id: doc.id,
        ...doc.data()
      };

      if (
        !material.nameAr ||
        !material.code ||
        !material.units
      ) {
        return;
      }

      materials.push(material);
    });

    res.json({
      success: true,
      data: materials
    });

  } catch (error) {
    console.error("GET MATERIALS ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
// إضافة مادة جديدة
export async function addMaterial(req, res, next) {
  try {
    const {
      nameAr,
      code,
      units,
      itemNumber,
      quantityDescription
    } = req.body;

    // التحقق من تكرار رمز المادة
    const existingCode = await db
      .collection("materials")
      .where("code", "==", code)
      .limit(1)
      .get();

    if (!existingCode.empty) {
      return res.status(400).json({
        error: {
          message: "رمز المادة موجود مسبقاً."
        }
      });
    }

    // التحقق من تكرار اسم المادة
    const existingName = await db
      .collection("materials")
      .where("nameAr", "==", nameAr)
      .limit(1)
      .get();

    if (!existingName.empty) {
      return res.status(400).json({
        error: {
          message: "اسم المادة موجود مسبقاً."
        }
      });
    }

    // التحقق من تكرار رقم المادة
    if (itemNumber) {
      const existingNumber = await db
        .collection("materials")
        .where("itemNumber", "==", itemNumber)
        .limit(1)
        .get();

      if (!existingNumber.empty) {
        return res.status(400).json({
          error: {
            message: "رقم المادة موجود مسبقاً."
          }
        });
      }
    }

    const newMaterial = {
      nameAr: nameAr || "",
      code: code || "",
      units: units || "",
      itemNumber: itemNumber || "",
      quantityDescription: quantityDescription || "",
      createdAt: new Date()
    };

    const doc = await db
      .collection("materials")
      .add(newMaterial);

    return res.status(201).json({
      success: true,
      data: {
        id: doc.id
      },
      message: "تمت إضافة المادة بنجاح"
    });

  } catch (error) {
    next(error);
  }
}
// تحديث مادة
export async function updateMaterial(req, res, next) {
  try {

    const { id } = req.params;

    const {
      itemNumber,
      code,
      nameAr,
      quantityDescription,
      units
    } = req.body;


    if (
      !itemNumber?.trim() ||
      !code?.trim() ||
      !nameAr?.trim() ||
      !quantityDescription?.trim() ||
      !units?.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "يجب تعبئة جميع الحقول"
      });
    }

    if (!nameAr || !code) {
      return res.status(400).json({
        success: false,
        message: "يرجى تعبئة وصف المادة ورمز المادة"
      });
    }

    await db
      .collection("materials")
      .doc(id)
      .update({
        itemNumber: itemNumber || "",
        code: code || "",
        nameAr: nameAr || "",
        quantityDescription: quantityDescription || "",
        units: units || "",
        updatedAt: new Date()
      });

    res.json({
      success: true,
      message: "تم تحديث المادة بنجاح"
    });

  } catch (error) {
    next(error);
  }
}



// حذف مادة
export async function deleteMaterial(req, res, next) {
  try {
    const { id } = req.params;

    console.log("DELETE ID:", id);

    const docRef = db.collection("materials").doc(id);
    const docSnap = await docRef.get();

    console.log("DOC EXISTS:", docSnap.exists);
    console.log("DOC DATA:", docSnap.data());

    if (!docSnap.exists) {
      return res.status(404).json({
        success: false,
        message: "المادة غير موجودة"
      });
    }

    await docRef.delete();

    console.log("DELETE SUCCESS:", id);

    res.json({
      success: true,
      message: "تم حذف المادة بنجاح"
    });

  } catch (error) {
    console.error(error);
    next(error);
  }
}
// استيراد مواد من Excel


export async function importMaterials(req, res, next) {
  try {
    console.log("========== IMPORT MATERIALS ==========");

    let fileBuffer = null;

    // express-fileupload
    if (req.files?.file?.data) {
      fileBuffer = req.files.file.data;
    }

    // multer
    if (!fileBuffer && req.file?.buffer) {
      fileBuffer = req.file.buffer;
    }

    if (!fileBuffer) {
      return res.status(400).json({
        error: {
          message: "لم يتم استلام الملف من الخادم"
        }
      });
    }

    const workbook = XLSX.read(fileBuffer, {
      type: "buffer"
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        error: {
          message: "ملف Excel فارغ"
        }
      });
    }

    const sheet = workbook.Sheets[sheetName];

    const data = XLSX.utils.sheet_to_json(sheet, {
      defval: ""
    });

    if (!data.length) {
      return res.status(400).json({
        error: {
          message: "لا توجد بيانات داخل الملف"
        }
      });
    }

    const batch = db.batch();
    let count = 0;

    const seenCodes = new Set();

    for (const row of data) {

      const keys = Object.keys(row);

      const materialDesc =
        row["وصف المادة"] ||
        row["اسم المادة"] ||
        row[keys[1]] ||
        "";

      const materialCode =
        row["رمز المادة"] ||
        row["الكود"] ||
        row["رمز"] ||
        row[keys[2]] ||
        "";

      // رقم المادة قد يختلف اسم العمود في ملفات Excel (مسافات مخفية أو تسمية مختلفة)
      const materialNumber =
        row["رقم المادة"] ||
        row["رقم الماده"] ||
        row["رقم"] ||
        row["رقم المادة "] ||
        row[keys[0]] ||
        "";

      if (!materialDesc || !materialCode) {
        continue;
      }

      const code = String(materialCode).trim();

      // تكرار داخل الملف نفسه
      if (seenCodes.has(code)) {
        return res.status(400).json({
          error: {
            message: `الملف يحتوي رمز مادة مكرر: ${code} `
          }
        });
      }

      seenCodes.add(code);

      // تكرار داخل قاعدة البيانات
      const existing = await db
        .collection("materials")
        .where("code", "==", code)
        .limit(1)
        .get();

      if (!existing.empty) {
        duplicateCount++;
        continue;
      }
      const docRef = db.collection("materials").doc();

      batch.set(docRef, {
        nameAr: String(materialDesc).trim(),
        code,
        itemNumber: String(materialNumber).trim(),
        quantityDescription: String(row["وصف الكمية"] || "").trim(),
        units: String(row["الوحدة"] || "").trim(),
        createdAt: new Date()
      });

      count++;
    }


    if (count === 0) {
      return res.json({
        success: true,
        data: {
          count: 0,
          message: "جميع المواد الموجودة في الملف مسجلة مسبقاً."
        }
      });
    }

    await batch.commit();

    return res.json({
      success: true,
      data: {
        count,
        duplicateCount,
        message: `تم استيراد ${count} مادة وتجاهل ${duplicateCount} مادة مكررة`
      }
    });

  } catch (error) {
    console.error("IMPORT MATERIALS ERROR:", error);
    next(error);
  }
}

