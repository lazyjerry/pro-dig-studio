// src/index.ts
import { Hono, Context, Next } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { server as webauthn } from "@passwordless-id/webauthn";
import { createJwt, verifyJwt } from "./libs/jwt";
import { nanoid } from "nanoid";
import { loadConfig, saveConfig, validateConfig, setAllowRegistration, getAllowRegistration } from "./libs/config";
import { parseJson, requireAuth, isAuthenticated } from "./libs/common";
import worklogRouter from "./routes/worklogs";
import authRequired from "./routes/authRequired"; // 引入驗證中介軟體
import dataRouter from "./routes/data";

const { randomChallenge, verifyRegistration, verifyAuthentication } = webauthn;

type Bindings = {
	WORKLOG_DB: D1Database;
	JOFFICE_AUTH_KV: KVNamespace;
	JWT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const RP_NAME = "ProGigStudio";

/* ---------- 註冊行為 ---------- */

/* ---------- 註冊：Options ---------- */
app.post("/webauthn/register/options", async (c) => {
	const allowRegistration = await getAllowRegistration(c);
	if (!allowRegistration) return c.json({ ok: false }, 400);

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
	const allowRegistration = await getAllowRegistration(c);
	if (!allowRegistration) return c.json({ ok: false }, 400);

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

	await setAllowRegistration(c, false); // 註冊後關閉註冊功能
	return c.json({ ok: registrationParsed !== null });
});

/* ---------- 登入行為 ---------- */

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

	// 準備 authenticator 物件（第二參數）
	const authenticator = {
		id: stored.credentialID, // ★ 必須叫 id
		publicKey: stored.credentialPublicKey, // ★ 函式內部用 publicKey
		counter: stored.counter,
		algorithm: stored.algorithm, // 非必需，但有就傳
	};

	// options（第三參數）
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

/* ---------- 登出 ---------- */
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

/* ---------- 全域組態：讀取 ---------- */

// 取得不用登入的組態
app.get("/config", async (c) => {
	// 身分驗證
	const auth = await isAuthenticated(c);

	let cfg = await loadConfig(c);

	cfg = { allowRegistration: cfg.allowRegistration, isAuthenticated: auth }; // 只回傳 allowRegistration
	let obj = c.json(cfg);
	return obj;
});

// 取得需要登入的組態
app.get("/api/config", async (c) => {
	// 身分驗證
	const auth = await requireAuth(c);
	if (!auth) return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);

	let cfg = await loadConfig(c);

	cfg.username = auth.username; // 取得使用者名稱
	const currentUrl = new URL(c.req.url);
	cfg.logoUrl = `${currentUrl.origin}/logo.png`;

	let obj = c.json(cfg);

	return obj;
});

app.put("/api/config", async (c) => {
	// 身分驗證
	const auth = await requireAuth(c);
	if (!auth) return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);

	// 解析 JSON
	const [payload, jsonErr] = await parseJson<any>(c);
	if (jsonErr) return c.json({ ok: false, error: jsonErr }, 400);

	// 手動驗證（抽成工具亦可）
	// const err = validateConfig(payload);
	// if (err) return c.json({ ok: false, error: err }, 400);

	// 儲存
	await saveConfig(c, payload);
	return c.json({ ok: true });
});

/* ---------- 驗證登入 ---------- */
/* --- 保護多個路徑 --- */
[
	"/", // 根目錄
	"/dashboard", // dashboard 及子路由
	"/api/*", // 所有 API
	"/logs/*", // worklogs
].forEach((p) => app.use(p, authRequired));

app.get("/", (c) => c.redirect("/dashboard"));

// 404
app.notFound((c) => c.redirect("/404.html"));

/* ---- 路由掛載位置，放在 authRequired 之後即可 ---- */
app.route("/logs", worklogRouter); // 自動支援 /logs 與 /logs/*

app.route("/api/data", dataRouter);

export default app;
