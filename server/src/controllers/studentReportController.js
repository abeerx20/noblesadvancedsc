import { createStudentReport } from "../services/studentReportService.js";

export async function create(req, res) {
    const id = await createStudentReport(req.body, req.user);
    res.status(201).json({ success: true, data: { id }, message: "تم اعتماد التقرير وحفظه." });
}
