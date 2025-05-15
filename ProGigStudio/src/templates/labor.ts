import { Context } from "hono";

import pdfHTML from "./labor.html"; // 引入報價單範本

// ——— helper ———
/// 將 {{key}} 佔位符替換成對應值
function templateReplace(tpl: string, vars: Record<string, string | number>): string {
	return Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{{${k}}}`, String(v)), tpl);
}

// --- helper: 值 → 中文顯示文字 ------------------------------------------
const mapResident: Record<string, string> = {
	resident: "本國籍",
	nonResidentTW: "本國籍但未在台居住",
	foreign183: "外國籍在台滿183天",
	foreignNot183: "外國籍在台未滿183天",
};
const mapIdType: Record<string, string> = {
	idcard: "身分證",
	arc: "居留證",
	passport: "護照",
};
const mapPayMethod: Record<string, string> = {
	check: "支票",
	bank: "匯款",
	cash: "現金",
};
const mapCheckReceive: Record<string, string> = {
	pickup: "親領",
	registered: "掛號",
};

const handleLabor = async (c: Context) => {
	// 1. 取得表單資料
	const formData = await c.req.raw.clone().formData();
	const raw = Object.fromEntries(formData.entries()) as Record<string, string>;

	// 2. 轉換為人類可讀文字 (若前端已映射則保持原值)
	const view = {
		...raw,
		residentType: mapResident[raw.residentType] ?? raw.residentType ?? "",
		idType: mapIdType[raw.idType] ?? raw.idType ?? "",
		payMethod: mapPayMethod[raw.payMethod] ?? raw.payMethod ?? "",
		checkReceive: mapCheckReceive[raw.checkReceive] ?? raw.checkReceive ?? "",
		skipNHI: raw.skipNHI === "true" ? "是" : "否",
	};

	// 3. 其他動態欄位
	const quoteNumber = raw.formNumber || `${Date.now()}`;
	const today = (() => {
		const d = new Date();
		return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
	})();

	const formJSON = encodeURIComponent(JSON.stringify(raw));

	// 4. 套用模板
	const html = templateReplace(pdfHTML, {
		...view,
		quoteNumber,
		formJSON,
		today,
	});

	return html;
};

export default handleLabor;
