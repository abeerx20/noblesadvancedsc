import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";
import { publicDocument } from "../utils/text.js";
import { randomUUID } from "node:crypto";
import { notifyEmployee } from "./notificationService.js";

const statuses = ["جديدة", "قيد المعالجة", "بانتظار الموظف", "تم الحل", "مغلقة"];

function normalizeTicket(snapshot) {
  const ticket = publicDocument(snapshot);
  return { ...ticket, status: ticket.status === "مفتوح" ? "جديدة" : ticket.status, ticketNumber: ticket.ticketNumber ?? snapshot.id };
}

export async function createTicket(user, data) {
  const ticketNumber = `HD-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const ref = await db.collection("supportTickets").add({
    ...data,
    ticketNumber,
    requesterUid: user.uid,
    requesterType: user.userType,
    requesterName: user.employee.nameAr,
    requesterEmail: user.email,
    department: data.department ?? user.employee.department ?? "غير محدد",
    priority: data.priority ?? "متوسطة",
    status: "جديدة",
    supportEmployeeUid: "",
    comments: [],
    timeline: [{ action: "إنشاء التذكرة", byUid: user.uid, byName: user.employee.nameAr, at: new Date().toISOString() }],
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  return ref.id;
}

export async function listTickets(user, filters = {}) {
  let query = db.collection("supportTickets");
  if (!user.permissions.includes("manage_support")) query = query.where("requesterUid", "==", user.uid);
  const snapshot = await query.limit(100).get();
  return snapshot.docs.map(normalizeTicket).filter((ticket) => Object.entries(filters).every(([key, value]) => !value || String(ticket[key] ?? "").toLowerCase().includes(String(value).toLowerCase())));
}

export async function getTicket(user, ticketId) {
  const snapshot = await db.collection("supportTickets").doc(ticketId).get();
  if (!snapshot.exists) return null;
  const ticket = normalizeTicket(snapshot);
  if (!user.permissions.includes("manage_support") && ticket.requesterUid !== user.uid) return null;
  return ticket;
}

export async function updateTicket(user, ticketId, changes) {
  const ref = db.collection("supportTickets").doc(ticketId);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const current = normalizeTicket(snapshot);
  const timeline = [...(current.timeline ?? [])];
  const comments = [...(current.comments ?? [])];
  if (changes.comment) comments.push({ text: changes.comment, byUid: user.uid, byName: user.employee.nameAr, at: new Date().toISOString() });
  timeline.push({ action: changes.status ? `تغيير الحالة إلى ${changes.status}` : changes.comment ? "إضافة تعليق" : changes.escalated ? "تصعيد التذكرة" : "تحديث التذكرة", byUid: user.uid, byName: user.employee.nameAr, at: new Date().toISOString() });
  const update = { updatedAt: FieldValue.serverTimestamp(), timeline, comments };
  ["status", "assigneeUid", "attachmentUrl", "escalated"].forEach((key) => { if (changes[key] !== undefined) update[key === "assigneeUid" ? "supportEmployeeUid" : key] = changes[key]; });
  await ref.update(update);
  if (current.requesterUid && (changes.comment || changes.status || changes.assigneeUid)) {
    await notifyEmployee({
      recipientUid: current.requesterUid,
      type: "support_update",
      title: "تحديث على طلب الدعم",
      message: changes.comment ?? (changes.status ? `حالة الطلب: ${changes.status}` : "تم تحديث طلب الدعم."),
      supportTicketId: ticketId
    });
  }
  return getTicket(user, ticketId);
}

export function ticketStats(tickets) {
  const now = Date.now();
  return {
    total: tickets.length,
    new: tickets.filter((ticket) => ticket.status === "جديدة").length,
    inProgress: tickets.filter((ticket) => ticket.status === "قيد المعالجة").length,
    closed: tickets.filter((ticket) => ticket.status === "مغلقة").length,
    overdue: tickets.filter((ticket) => !["تم الحل", "مغلقة"].includes(ticket.status) && now - new Date(ticket.createdAt ?? 0).getTime() > 3 * 86400000).length
  };
}

