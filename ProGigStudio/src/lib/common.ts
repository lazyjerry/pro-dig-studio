// lib/common.ts
import { Context } from "hono";
import { getCookie } from "hono/cookie";
import { verifyJwt } from "./jwt";

type Bindings = {
	JOFFICE_AUTH_KV: KVNamespace;
	JWT_SECRET: string;
};

/* ---------- 驗證 URL ---------- */
export function isValidUrl(str: unknown): str is string {
	try {
		if (typeof str !== "string") return false;
		new URL(str);
		return true;
	} catch {
		return false;
	}
}

/* ---------- 解析 JSON ---------- */
export async function parseJson<T = unknown>(c: Context): Promise<[null | T, null | string]> {
	try {
		const data = (await c.req.json()) as T;
		return [data, null];
	} catch {
		return [null, "INVALID_JSON"];
	}
}

/* ---------- 取出已驗證使用者 ---------- */
export async function requireAuth(
	c: Context<{ Bindings: Bindings }>
): Promise<null | { username: string; sessionId: string }> {
	const token = getCookie(c, "session");
	if (!token) return null;

	const payload = await verifyJwt(token, c.env.JWT_SECRET);
	if (!payload) return null;

	// 確認 session 仍有效
	const exists = await c.env.JOFFICE_AUTH_KV.get(`sess:${payload.sessionId}`);
	if (!exists) return null;

	return payload as { username: string; sessionId: string };
}

/* ---------- 讀／寫全域 Config ---------- */
export async function loadConfig(c: Context<{ Bindings: Bindings }>) {
	const raw = await c.env.JOFFICE_AUTH_KV.get("config");
	return raw ? JSON.parse(raw) : { allowRegistration: true };
}

export async function saveConfig(c: Context<{ Bindings: Bindings }>, cfg: unknown) {
	await c.env.JOFFICE_AUTH_KV.put("config", JSON.stringify(cfg));
}
