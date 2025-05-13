// src/index.ts
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { server as webauthn } from "@passwordless-id/webauthn";
import { createJwt, verifyJwt } from "./lib/jwt";
import { nanoid } from "nanoid";

const { randomChallenge, verifyRegistration, verifyAuthentication } = webauthn;

type Bindings = {
	JOFFICE_AUTH_KV: KVNamespace;
	JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const RP_NAME = "ProGigStudio";

/* ---------- 註冊：Options ---------- */
app.post("/webauthn/register/options", async (c) => {
	const { username } = await c.req.json<{ username: string }>();
	const RP_ID = new URL(c.req.url).hostname;

	const challenge = randomChallenge();
	await c.env.JOFFICE_AUTH_KV.put(`reg:${username}`, challenge, { expirationTtl: 60 });

	const opts: PublicKeyCredentialCreationOptions = {
		challenge,
		rp: { id: RP_ID, name: RP_NAME },
		user: {
			id: new TextEncoder().encode(username),
			name: username,
			displayName: username,
		},
		pubKeyCredParams: [
			{ type: "public-key", alg: -7 },
			{ type: "public-key", alg: -257 },
		],
		authenticatorSelection: { userVerification: "preferred" },
		timeout: 60000,
		attestation: "none",
	};
	return c.json(opts);
});

/* ---------- 註冊：Verify ---------- */
app.post("/webauthn/register/verify", async (c) => {
	const { username, credential } = await c.req.json<{ username: string; credential: unknown }>();

	const challenge = await c.env.JOFFICE_AUTH_KV.get(`reg:${username}`);
	if (!challenge) return c.json({ ok: false }, 400);

	const params = {
		challenge,
		origin: new URL(c.req.url).origin,
		rpId: new URL(c.req.url).hostname,
	};

	const registrationParsed = await verifyRegistration(credential, params);
	if (!registrationParsed) return c.json({ ok: false }, 400);

	await c.env.JOFFICE_AUTH_KV.put(
		`cred:${username}`,
		JSON.stringify({
			credentialID: registrationParsed.credential.id,
			credentialPublicKey: registrationParsed.credential.publicKey,
			counter: registrationParsed.authenticator.counter,
			algorithm: registrationParsed.credential.algorithm, // 若要驗簽時分流 ES256/RS256
		})
	);

	return c.json({ ok: registrationParsed !== null });
});

/* ---------- 登入：Options ---------- */
app.post("/webauthn/login/options", async (c) => {
	const { username } = await c.req.json<{ username: string }>();

	const storedRaw = await c.env.JOFFICE_AUTH_KV.get(`cred:${username}`);
	const stored = storedRaw ? JSON.parse(storedRaw) : null;

	const challenge = randomChallenge();
	await c.env.JOFFICE_AUTH_KV.put(`auth:${username}`, challenge, { expirationTtl: 60 });

	const opts: PublicKeyCredentialRequestOptions = {
		rpId: new URL(c.req.url).hostname,
		challenge,
		allowCredentials: stored ? [{ id: stored.credentialID, type: "public-key" }] : [],
		userVerification: "preferred",
		timeout: 60000,
	};
	return c.json(opts);
});

/* ---------- 登入：Verify ---------- */
app.post("/webauthn/login/verify", async (c) => {
	const { username, credential } = await c.req.json<{ username: string; credential: unknown }>();

	const challenge = await c.env.JOFFICE_AUTH_KV.get(`auth:${username}`);
	const storedRaw = await c.env.JOFFICE_AUTH_KV.get(`cred:${username}`);

	if (!challenge || !storedRaw) return c.json({ ok: false }, 400);

	const stored = JSON.parse(storedRaw);

	// ➊ 準備 authenticator 物件（第二參數）
	const authenticator = {
		id: stored.credentialID, // ★ 必須叫 id
		publicKey: stored.credentialPublicKey, // ★ 函式內部用 publicKey
		counter: stored.counter,
		algorithm: stored.algorithm, // 非必需，但有就傳
	};

	// ➋ options（第三參數）
	const options = {
		challenge,
		origin: new URL(c.req.url).origin,
		rpId: new URL(c.req.url).hostname,
		userVerified: true, // 如需強制 UV 再開
	};

	const authenticationInfo = await verifyAuthentication(credential, authenticator, options);
	console.log("authenticationInfo", authenticationInfo);

	if (authenticationInfo) {
		stored.counter = authenticationInfo.newCounter;
		await c.env.JOFFICE_AUTH_KV.put(`cred:${username}`, JSON.stringify(stored));

		const sessionId = nanoid(24); // 生成隨機字串
		await c.env.JOFFICE_AUTH_KV.put(`sess:${sessionId}`, username, { expirationTtl: 60 * 60 * 24 }); // 24h

		const token = await createJwt(
			{ username, sessionId }, // ★ 把兩個欄位放進 payload
			c.env.JWT_SECRET
		);
		setCookie(c, "session", token, { httpOnly: true, secure: true, sameSite: "Lax" });
		return c.json({ ok: true });
	}
	return c.json({ ok: false });
});

app.get("/logout", async (c) => {
	const token = getCookie(c, "session");
	if (token) {
		const payload = await verifyJwt(token, c.env.JWT_SECRET);
		if (payload) {
			await c.env.JOFFICE_AUTH_KV.delete(`sess:${payload.sessionId}`);
		}
	}
	// 清掉 Cookie
	setCookie(c, "session", "", { maxAge: 0, path: "/" });
	return c.redirect("/auth.html");
});

// /* ---- 用戶狀態 ---- */
// /** 讀取 */
// app.get("/api/state", async (c) => {
// 	const user = c.get("user") as string; // middleware 早就 set 好

// 	const raw = await c.env.JOFFICE_AUTH_KV.get(`state:${user}`);
// 	if (!raw) return c.json({ ok: true, state: null }); // 首次登入

// 	return c.json({ ok: true, state: JSON.parse(raw) });
// });

// /** 保存 */
// app.put("/api/state", async (c) => {
// 	const user = c.get("user") as string;
// 	const state = await c.req.json(); // 不需驗證欄位，全部原樣存
// 	await c.env.JOFFICE_AUTH_KV.put(`state:${user}`, JSON.stringify(state));
// 	return c.json({ ok: true });
// });

/* ---------- 全域組態：讀取 ---------- */
app.get("/api/config", async (c) => {
	/**
	 * 建議固定用單一 key 儲存，例如 "config"
	 * 也可以改成 "config:global" 之類的名稱
	 */
	const raw = await c.env.JOFFICE_AUTH_KV.get("config");

	// 若 KV 尚未設定，給一份預設值（可自行調整）
	if (!raw) {
		const defaultConfig = { allowRegistration: true };
		return c.json(defaultConfig);
	}

	// 正常讀取
	try {
		return c.json(JSON.parse(raw));
	} catch {
		// 格式壞掉時回傳 500，前端可透過狀態判斷
		return c.json({ ok: false, error: "CONFIG_PARSE_ERROR" }, 500);
	}
});

function isValidUrl(str: unknown): str is string {
	try {
		if (typeof str !== "string") return false;
		// new URL 會丟錯誤代表不是合法 URL
		new URL(str);
		return true;
	} catch {
		return false;
	}
}

app.put("/api/config", async (c) => {
	// 1) 基本身分驗證
	const user = c.get("user") as string | undefined;
	if (!user) return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);

	// 2) 解析 JSON
	let payload: any;
	try {
		payload = await c.req.json();
	} catch {
		return c.json({ ok: false, error: "INVALID_JSON" }, 400);
	}

	// 3) === 手動驗證開始 ==================================

	// (a) allowRegistration：可省略或必為 boolean
	if ("allowRegistration" in payload && typeof payload.allowRegistration !== "boolean") {
		return c.json({ ok: false, error: "allowRegistration must be boolean" }, 400);
	}

	// (b) 固定 5 個頁面
	const pages = ["quote", "meeting", "worklog", "invoice", "notes"] as const;
	for (const key of pages) {
		if (!(key in payload)) return c.json({ ok: false, error: `missing ${key}` }, 400);

		const page = payload[key];
		if (typeof page !== "object" || page === null) return c.json({ ok: false, error: `${key} must be object` }, 400);
		if (!isValidUrl(page.url)) return c.json({ ok: false, error: `${key}.url invalid` }, 400);
		if ("token" in page && typeof page.token !== "string")
			return c.json({ ok: false, error: `${key}.token invalid` }, 400);
	}

	// (c) extra：可有多筆
	if ("extra" in payload) {
		if (!Array.isArray(payload.extra)) return c.json({ ok: false, error: "extra must be an array" }, 400);

		for (const [i, item] of payload.extra.entries()) {
			if (typeof item !== "object" || item === null)
				return c.json({ ok: false, error: `extra[${i}] must be object` }, 400);
			if (!isValidUrl(item.url)) return c.json({ ok: false, error: `extra[${i}].url invalid` }, 400);
			if ("token" in item && typeof item.token !== "string")
				return c.json({ ok: false, error: `extra[${i}].token invalid` }, 400);
			if ("label" in item && typeof item.label !== "string")
				return c.json({ ok: false, error: `extra[${i}].label invalid` }, 400);
		}
	}

	// (d) db
	if ("db" in payload) {
		if (typeof payload.db !== "object" || !isValidUrl(payload.db.url) || typeof payload.db.password !== "string") {
			return c.json({ ok: false, error: "db invalid" }, 400);
		}
	}

	// (e) login：只收 password
	if ("login" in payload) {
		if (typeof payload.login !== "object" || typeof payload.login.password !== "string") {
			return c.json({ ok: false, error: "login.password invalid" }, 400);
		}
		// 強制刪掉多餘欄位（如 username）
		delete payload.login.username;
	}

	// (f) openai
	if ("openai" in payload) {
		if (typeof payload.openai !== "object" || typeof payload.openai.token !== "string") {
			return c.json({ ok: false, error: "openai.token invalid" }, 400);
		}
	}

	// 4) === 驗證通過，寫入 KV ==============================
	await c.env.JOFFICE_AUTH_KV.put("config", JSON.stringify(payload));

	return c.json({ ok: true });
});

/* ---------- 保護 ProGigStudio ---------- */
app.use("/*", async (c, next) => {
	const token = getCookie(c, "session");
	if (!token) return c.redirect("/auth.html");

	const payload = await verifyJwt(token, c.env.JWT_SECRET);
	if (!payload) return c.redirect("/auth.html");

	// ★ 再去 KV 查 sessionId 是否存在
	const exists = await c.env.JOFFICE_AUTH_KV.get(`sess:${payload.sessionId}`);
	if (!exists) return c.redirect("/auth.html");

	// 如果你想把使用者資訊掛在 ctx 上給之後的 handler 用：
	c.set("user", payload.username);

	await next();
});

app.get("/", (c) => {
	return c.redirect("/dasboard.html");
});

export default app;
