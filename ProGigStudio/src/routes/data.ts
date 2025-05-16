/**
 * 資料管理 API
 * ----------------------------------------
 *  GET    /api/data            依條件分頁查詢
 *  POST   /api/data            新增
 *  GET    /api/data/:id        讀單筆
 *  PUT    /api/data/:id        更新
 *  DELETE /api/data/:id        刪除
 *
 *  欄位：id  | type | name | info | created_at | updated_at
 */

import { Hono } from "hono";
import { requireAuth } from "../libs/common";

import handleQuote from "../templates/quote"; // 引入報價單範本
import handleMeeting from "../templates/meeting"; // 引入會議記錄
import handleLabor from "../templates/labor"; // 引入勞報單

type Bindings = {
	WORKLOG_DB: D1Database;
};

const router = new Hono<{ Bindings: Bindings }>();

/* ---------- 允許的類型 ---------- */
const ALLOW_TYPES = ["labor", "quote", "meeting"] as const;
const validType = (t?: string): t is string => !!t && ALLOW_TYPES.includes(t as any);

/* ---------- 全域登入驗證 ---------- */
router.use(async (c, next) => {
	if (!(await requireAuth(c))) return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);
	await next();
});

/* ---------- 產生列印用 PDF 頁 ---------- */
router.post("/pdf", async (c) => {
	const type = c.req.query("type");
	if (!validType(type)) return c.json({ ok: false, error: `INVALID_TYPE. ${type}` }, 400);
	let html = "";
	if ("quote" == type) {
		html = await handleQuote(c);
	} else if ("meeting" == type) {
		html = await handleMeeting(c);
	} else if ("labor" == type) {
		html = await handleLabor(c);
	}

	return new Response(html, {
		headers: { "Content-Type": "text/html; charset=utf-8" },
	});
});

export default router;

/* ---------- 列表 / 查詢 ---------- */
router.get("/", async (c) => {
	const db = c.env.WORKLOG_DB;

	const type = c.req.query("type")?.trim();
	const name = c.req.query("name")?.trim();
	const start = c.req.query("startDate")?.trim(); // YYYY-MM-DDTHH:mm
	const end = c.req.query("endDate")?.trim();
	const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 100);
	const offset = Math.max(parseInt(c.req.query("currentPage") || "0", 10) * limit, 0);

	console.log("type", type);
	console.log("name", name);
	console.log("start", start);
	console.log("end", end);
	console.log("limit", limit);
	console.log("offset", offset);

	let sql = "SELECT id,name,created_at FROM data";
	const binds: (string | number)[] = [];
	const where: string[] = [];

	if (validType(type)) {
		where.push("type = ?");
		binds.push(type);
	}
	if (name) {
		where.push("name LIKE ?");
		binds.push(`%${name}%`);
	}
	if (start) {
		where.push("created_at >= ?");
		binds.push(start);
	}
	if (end) {
		where.push("created_at <= ?");
		binds.push(end);
	}

	if (where.length) sql += " WHERE " + where.join(" AND ");
	sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
	binds.push(limit, offset);

	const { results } = await db
		.prepare(sql)
		.bind(...binds)
		.all();
	return c.json(results);
});

/* ---------- 新增 ---------- */
router.post("/", async (c) => {
	const { type, name, info } = await c.req.json<{ type?: string; name?: string; info?: string }>();

	if (!validType(type)) return c.json({ ok: false, error: `INVALID_TYPE. ${type}` }, 400);
	if (!name?.trim()) return c.json({ ok: false, error: "NAME_REQUIRED" }, 400);

	const result = await c.env.WORKLOG_DB.prepare(
		`INSERT INTO data (type, name, info, created_at, updated_at)
              VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
	)
		.bind(type, name.trim(), info || "")
		.run();

	const lastInsertRowID = result.meta.last_row_id; // ← 正確的位置
	console.log("SAVE", lastInsertRowID);

	return c.json({ ok: true, id: lastInsertRowID });
});

/* ---------- 讀設定 ---------- */
router.get("/config", async (c) => {
	const currentUrl = new URL(c.req.url);
	let obj = c.json({ logoUrl: `${currentUrl.origin}/logo.png` });
	return obj;
});

/* ---------- 讀單筆 ---------- */
router.get("/:id{[0-9]+}", async (c) => {
	const id = c.req.param("id");
	const row = await c.env.WORKLOG_DB.prepare("SELECT info FROM data WHERE id = ?").bind(id).first();
	if (!row) return c.text("Not found", 404);
	// console.log("row", c.json(row));
	return c.json(row);
});

/* ---------- 更新 ---------- */
router.put("/:id{[0-9]+}", async (c) => {
	const id = c.req.param("id");
	const { type, name, info } = await c.req.json<{ type?: string; name?: string; info?: string }>();

	if (type && !validType(type)) return c.json({ ok: false, error: `INVALID_TYPE. ${type}` }, 400);
	if (!name?.trim()) return c.json({ ok: false, error: "NAME_REQUIRED" }, 400);

	await c.env.WORKLOG_DB.prepare(
		`UPDATE data
                 SET type = ?, name = ?, info = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?`
	)
		.bind(type || "default", name.trim(), info || "", id)
		.run();

	return c.json({ ok: true });
});

/* ---------- 刪除 ---------- */
router.delete("/:id", async (c) => {
	const id = c.req.param("id");
	await c.env.WORKLOG_DB.prepare("DELETE FROM data WHERE id = ?").bind(id).run();
	return c.json({ ok: true });
});
