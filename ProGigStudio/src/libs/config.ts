// lib/config.ts
// config.ts 只負責「組態存取與驗證」；若將來有 UI 設定、匯入匯出，也在這個檔案擴充。
import { isValidUrl } from "./common";
import { Context } from "hono";

type Bindings = {
	JOFFICE_AUTH_KV: KVNamespace;
};

export async function loadConfig(c: Context) {
	const raw = await c.env.JOFFICE_AUTH_KV.get("config");
	console.log("loadConfig", raw);
	return raw
		? JSON.parse(raw)
		: {
				allowRegistration: true,
				extra: [
					{ label: "SEO檢查工具", url: "https://seo.jlab-app.cloud", token: "" },
					{ label: "螢幕檢查工具", url: "https://screen-size-detector.jlab-app.cloud", token: "" },
					{ label: "iLovePDF", url: "https://www.ilovepdf.com/zh-tw", token: "newWindows" },
					{ label: "IT-TOOLS", url: "https://it-tool.jerryzheli.com", token: "" },
				],
		  };
}

export async function saveConfig(c: Context, cfg: unknown) {
	// 儲存 config
	console.log("saveConfig", cfg);
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
