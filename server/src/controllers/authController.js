import { createParentLoginToken } from "../services/parentLoginService.js";

export async function parentLogin(req, res) {
    const customToken = await createParentLoginToken(req.validated.body);
    res.json({ success: true, data: { customToken } });
}