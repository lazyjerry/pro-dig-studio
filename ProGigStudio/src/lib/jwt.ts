/* eslint-disable @typescript-eslint/consistent-type-imports */

const encoder = new TextEncoder();

/* ---------- 工具 ---------- */
const b64u = (buf: ArrayBuffer): string =>
	btoa(String.fromCharCode(...new Uint8Array(buf)))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

async function sign(data: string, secret: string) {
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
		"sign",
	]);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
	return b64u(sig);
}

/* ---------- 型別 ---------- */
export interface JwtPayload {
	/** 使用者識別 */
	sub: string;
	/** 到期時間 (Unix 秒) */
	exp: number;
	/** 任意自訂欄位 */
	[claim: string]: unknown;
}

/* ---------- 產生 JWT（預設 7 天） ---------- */
export async function createJwt(
	payload: Omit<JwtPayload, "exp"> & { exp?: number },
	secret: string,
	maxAgeSec = 60 * 60 * 24 * 7
): Promise<string> {
	const header = b64u(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));

	// 若外部沒指定 exp，就用 maxAgeSec 自動補上
	const exp = payload.exp ?? Math.floor(Date.now() / 1000) + maxAgeSec;
	const fullPayload: JwtPayload = { ...payload, exp };

	const payloadB64 = b64u(encoder.encode(JSON.stringify(fullPayload)));
	const signature = await sign(`${header}.${payloadB64}`, secret);
	return `${header}.${payloadB64}.${signature}`;
}

/* ---------- 驗證 JWT ---------- */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
	const [h, p, sig] = token.split(".");
	if (!h || !p || !sig) return null;

	const validSig = await sign(`${h}.${p}`, secret);
	if (sig !== validSig) return null;

	const payload: JwtPayload = JSON.parse(
		new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)))
	);
	if (payload.exp < Math.floor(Date.now() / 1000)) return null;
	return payload;
}
