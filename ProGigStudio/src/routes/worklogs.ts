// lib/worklogs.ts
import { Hono } from "hono";
import { requireAuth } from "../libs/common"; // 仍沿用你的共用驗證

type Bindings = {
	WORKLOG_DB: D1Database;
};

export const worklogRouter = new Hono<{ Bindings: Bindings }>();

/* ---------- 身分驗證 (共用 middleware) ---------- */
worklogRouter.use(async (c, next) => {
	if (!(await requireAuth(c))) return c.json({ ok: false, error: "UNAUTHENTICATED" }, 401);
	await next();
});

/* ---------- 1. Create ---------- */
worklogRouter.post("/", async (c) => {
	const { name, content } = await c.req.json();
	const { lastInsertRowID } = await c.env.WORKLOG_DB.prepare(
		`INSERT INTO logs (name, content, created_at, updated_at)
              VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
	)
		.bind(name, content)
		.run();
	return c.json({ id: lastInsertRowID });
});

/* ---------- 2. Read (list + search + paging) ---------- */
worklogRouter.get("/", async (c) => {
	const db = c.env.WORKLOG_DB;
	const limit = parseInt(c.req.query("limit") || "3", 10);
	const offset = parseInt(c.req.query("offset") || "0", 10);
	const title = c.req.query("searchTitle")?.trim();
	const content = c.req.query("searchContent")?.trim();
	const date = c.req.query("searchDate")?.trim();

	let sql = `SELECT * FROM logs`;
	const binds: (string | number)[] = [];
	const where: string[] = [];

	if (title) {
		where.push(`name    LIKE ?`);
		binds.push(`%${title}%`);
	}
	if (content) {
		where.push(`content LIKE ?`);
		binds.push(`%${content}%`);
	}
	if (date) {
		where.push(`created_at <= ?`);
		binds.push(`${date}%`);
	}

	if (where.length) sql += " WHERE " + where.join(" AND ");
	sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
	binds.push(limit, offset);

	const { results } = await db
		.prepare(sql)
		.bind(...binds)
		.all();
	return c.json(results);
});

/* ---------- 3. Read One ---------- */
worklogRouter.get("/:id", async (c) => {
	const id = c.req.param("id");
	const row = await c.env.WORKLOG_DB.prepare("SELECT * FROM logs WHERE id = ?").bind(id).first();
	if (!row) return c.text("Not found", 404);
	return c.json(row);
});

/* ---------- 4. Delete ---------- */
worklogRouter.delete("/:id", async (c) => {
	const id = c.req.param("id");
	await c.env.WORKLOG_DB.prepare("DELETE FROM logs WHERE id = ?").bind(id).run();
	return c.json({ success: true });
});

export default worklogRouter;
