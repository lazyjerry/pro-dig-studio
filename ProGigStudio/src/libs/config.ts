// lib/config.ts
// config.ts 只負責「組態存取與驗證」；若將來有 UI 設定、匯入匯出，也在這個檔案擴充。
import { isValidUrl } from "./common";
import { Context } from "hono";

type Bindings = {
	JOFFICE_AUTH_KV: KVNamespace;
};

export async function loadConfig(c: Context) {
	const raw = await c.env.JOFFICE_AUTH_KV.get("config");
	return raw ? JSON.parse(raw) : { allowRegistration: true };
}

export async function saveConfig(c: Context, cfg: unknown) {
	// 儲存 config
	await c.env.JOFFICE_AUTH_KV.put("config", JSON.stringify(cfg));
}

export async function setAllowRegistration(c: Context, allow: boolean) {
	const cfg = await loadConfig(c);
	cfg.allowRegistration = allow;
	await saveConfig(c, cfg);
}

export async function getAllowRegistration(c: Context) {
	const cfg = await loadConfig(c);
	return cfg.allowRegistration;
}

/* ---------------- 驗證 ---------------- */
export function validateConfig(payload: any): string | null {
	/* ---------- (a) allowRegistration ---------- */
	if ("allowRegistration" in payload && typeof payload.allowRegistration !== "boolean") {
		return "allowRegistration must be boolean";
	}

	/* ---------- (b) 固定 5 頁面，可省略 ---------- */
	const pages = ["notes"] as const;

	for (const key of pages) {
		if (!(key in payload)) continue; // 缺少就跳過

		const p = payload[key];
		// 結構必須是物件
		if (typeof p !== "object" || p === null) {
			delete payload[key];
			continue;
		}

		// URL 檢查：若無或無效 → 整頁移除
		if (!p.url || !isValidUrl(p.url)) {
			delete payload[key];
			continue;
		}

		// TOKEN 必須為字串；若無 / 空字串則移除 token 欄
		if ("token" in p && typeof p.token !== "string") {
			delete p.token;
		}
	}

	/* ---------- (c) extra：陣列可省略 ---------- */
	if ("extra" in payload) {
		if (!Array.isArray(payload.extra)) {
			delete payload.extra;
		} else {
			payload.extra = payload.extra.filter((item: any) => {
				if (typeof item !== "object" || item === null) return false;
				if (!item.url || !isValidUrl(item.url)) return false;
				if ("token" in item && typeof item.token !== "string") delete item.token;
				if ("label" in item && typeof item.label !== "string") delete item.label;
				return true; // 保留有效項目
			});
			if (payload.extra.length === 0) delete payload.extra;
		}
	}
	/* ---------- (e) openai：可省略 ---------- */
	if ("openai" in payload) {
		if (typeof payload.openai !== "object" || typeof payload.openai.token !== "string" || !payload.openai.token) {
			delete payload.openai;
		}
	}
	return null; // 通過
}
