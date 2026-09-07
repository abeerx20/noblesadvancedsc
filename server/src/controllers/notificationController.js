import { listNotifications, markNotificationRead } from "../services/notificationService.js";

export async function index(req, res) {
    res.json({ success: true, data: await listNotifications(req.user) });
}

export async function markRead(req, res) {
    await markNotificationRead(req.user, req.params.id);
    res.json({ success: true, message: "تم تحديث التنبيه." });
}
