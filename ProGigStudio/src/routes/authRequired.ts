// routes/authRequired.ts
import type { MiddlewareHandler } from "hono";
import { isAuthenticated } from "../libs/common";

const authRequired: MiddlewareHandler = async (c, next) => {
	if (!(await isAuthenticated(c))) return c.redirect("/auth.html");
	await next();
};

export default authRequired;
