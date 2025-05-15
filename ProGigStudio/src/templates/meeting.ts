import { Context } from "hono";

import pdfHTML from "./meeting.html"; // 引入報價單範本

const handleMeeting = async (c: Context) => {
	// --- 1. 取得表單資料 --------------------------------------------------------
	// 先複製 raw Request，再呼叫 .formData()，可避免 body stream 已讀取完畢
	const formData = await c.req.raw.clone().formData();

	// 取得表單資料
	const data = formData.get("data") || "{}";

	// 將 pdf.html 內的 __FORM_DATA__ 佔位字串替換為實際 JSON
	const replaced = pdfHTML.replace("__FORM_DATA__", data);

	return replaced;
};

export default handleMeeting;
