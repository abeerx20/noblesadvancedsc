import { createTicket, getTicket, listTickets, ticketStats, updateTicket } from "../services/supportService.js";
import { writeAudit } from "../services/auditService.js";

export async function index(req, res) {
  const filters = Object.fromEntries(["ticketNumber", "requesterName", "department", "status", "priority", "category"].map((key) => [key, req.query[key]]));
  const tickets = await listTickets(req.user, filters);
  res.json({ success: true, data: tickets, stats: ticketStats(tickets) });
}

export async function details(req, res) {
  const ticket = await getTicket(req.user, req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: { message: "التذكرة غير موجودة أو لا تملك صلاحية عرضها." } });
  res.json({ success: true, data: ticket });
}

export async function update(req, res) {
  const ticket = await updateTicket(req.user, req.params.id, req.body);
  if (!ticket) return res.status(404).json({ success: false, error: { message: "التذكرة غير موجودة." } });
  await writeAudit({ req, action: "update", entityType: "supportTicket", entityId: req.params.id });
  res.json({ success: true, data: ticket, message: "تم تحديث التذكرة بنجاح." });
}

export async function create(req, res) {
  const id = await createTicket(req.user, req.body);
  await writeAudit({ req, action: "create", entityType: "supportTicket", entityId: id });
  res.status(201).json({ success: true, data: { id }, message: "تم إرسال طلب الدعم بنجاح." });
}

