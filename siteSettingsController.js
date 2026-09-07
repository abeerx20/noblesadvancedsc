import { getSiteSettings, updateSiteSettings } from "../services/siteSettingsService.js";

export async function index(_req, res) {
    res.json({ success: true, data: await getSiteSettings() });
}

export async function update(req, res) {
    const settings = await updateSiteSettings(req.user, req.body);
    res.json({ success: true, data: settings, message: "تم حفظ إعدادات الموقع." });
}
