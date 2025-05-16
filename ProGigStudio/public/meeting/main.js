/* Quill 工具列 */
const quillOptions = {
	theme: "snow",
	modules: {
		toolbar: [
			[{ header: [1, 2, 3, false] }],
			["bold", "italic", "underline"],
			["link"],
			[{ list: "ordered" }, { list: "bullet" }],
		],
	},
};

const plannedContentEditor = new Quill("#plannedContentEditor", quillOptions);
const discussionEditor = new Quill("#discussionEditor", quillOptions);
const notesEditor = new Quill("#notesEditor", quillOptions);
const completedEditor = new Quill("#completedEditor", quillOptions);
const todoEditor = new Quill("#todoEditor", quillOptions);

/* 調整高度函式：delta 為 +10 / -10 等等 */
function adjustEditorHeight(editorId, delta) {
	// 用 jQuery 選擇器取代 document.querySelector
	const $container = $("#" + editorId);
	if (!$container.length) return; // 如果找不到元素就直接 return

	// 透過 jQuery 的 css() 取得高度
	let currentHeight = parseInt($container.css("height"), 10);

	let newHeight = currentHeight + delta;
	// 設定最小高度 150px
	if (newHeight < 150) {
		newHeight = 150;
	}

	// 透過 jQuery 的 css() 設定新高度
	$container.css("height", newHeight + "px");
}

/* Tag 輸入: 出席人 / 列席 / 紀錄 */
function setupTagInput(inputId, tagsContainerId) {
	console.log(inputId, tagsContainerId);
	const input = document.getElementById(inputId);
	const container = document.getElementById(tagsContainerId);
	input.addEventListener("keydown", function (e) {
		if (e.key === "Enter" && input.value.trim() !== "") {
			e.preventDefault();

			addTag(input.value.trim(), container);
			input.value = "";
			saveFormData();
		}
	});
}

//新增標籤 addTag
function addTag(text, container) {
	const $container = $(container); // 保證拿到 jQuery 物件

	// 建立 <span class="tag">文字<button>x</button></span>
	const $tag = $("<span/>", { class: "tag" }).text(text);
	const $btn = $("<button/>")
		.text("x")
		.on("click", () => {
			$tag.remove(); // 移除整個 <span>
			saveFormData(); // 即時儲存
		});

	$tag.append($btn);
	$container.append($tag);
}

// 將表單資料存入 localStorage
function saveFormData(remote = false) {
	const data = {
		// ------- 文字／日期欄位 -------
		mainTitle: $("#mainTitle").val(),
		subTitle: $("#subTitle").val(),
		meetingInfo: $("#meetingInfo").val(),
		startDate: $("#startDate").val(),
		startTime: $("#startTime").val(),
		endDate: $("#endDate").val(),
		endTime: $("#endTime").val(),
		location: $("#location").val(),

		// ------- 標籤內容（取子元素的第一個文字節點） -------
		attendees: $("#attendeesTags > .tag")
			.map(function () {
				return $(this).contents().first().text();
			})
			.get(),
		observers: $("#observersTags > .tag")
			.map(function () {
				return $(this).contents().first().text();
			})
			.get(),
		recordSelect: $("#recordSelectTags > .tag")
			.map(function () {
				return $(this).contents().first().text();
			})
			.get(),

		// ------- Quill 內容 -------
		plannedContent: plannedContentEditor.root.innerHTML,
		discussion: discussionEditor.root.innerHTML,
		notes: notesEditor.root.innerHTML,
		completed: completedEditor.root.innerHTML,
		todo: todoEditor.root.innerHTML,
	};

	const jsonStr = JSON.stringify(data);
	// 需要同步到遠端伺服器時（remote = true）
	if (remote) {
		  saveData(data.mainTitle, jsonStr,function(success){
        // 遠端保存後移除
        if(success){
          localStorage.removeItem(LS_PREFIX);
        }
      });
	}else{
    localStorage.setItem(LS_PREFIX, jsonStr);
  }
}

/* 還原表單資料（jQuery 版） */
function restoreFormData(saved = "") {
	if (!saved) saved = localStorage.getItem(LS_PREFIX) || "";
	if (!saved) return;

	try {
		const data = JSON.parse(saved);

		/* 基本欄位 */
		$("#mainTitle").val(data.mainTitle || "");
		$("#subTitle").val(data.subTitle || "");
		$("#meetingInfo").val(data.meetingInfo || "");
		$("#location").val(data.location || "");
		$("#startDate").val(data.startDate || "");
		$("#startTime").val(data.startTime || "");
		$("#endDate").val(data.endDate || "");
		$("#endTime").val(data.endTime || "");

		/* 會議成員標籤 */
		const $attendees = $("#attendeesTags").empty();
		const $observers = $("#observersTags").empty();
		const $recordSel = $("#recordSelectTags").empty();

		(data.attendees || []).forEach((tag) => addTag(tag, $attendees[0]));
		(data.observers || []).forEach((tag) => addTag(tag, $observers[0]));
		(data.recordSelect || []).forEach((tag) => addTag(tag, $recordSel[0]));

		/* 還原 Quill 內容 */
		plannedContentEditor.clipboard.dangerouslyPasteHTML(data.plannedContent || "");
		discussionEditor.clipboard.dangerouslyPasteHTML(data.discussion || "");
		notesEditor.clipboard.dangerouslyPasteHTML(data.notes || "");
		completedEditor.clipboard.dangerouslyPasteHTML(data.completed || "");
		todoEditor.clipboard.dangerouslyPasteHTML(data.todo || "");
	} catch (err) {
		console.error("restoreFormData 時發生錯誤：", err);
		alert("無法還原資料，可能 JSON 格式不正確。");
	}
}

// 副標題預設值
function setDefaultSubtitle() {
	const $subTitle = $("#subTitle");
	if (!$subTitle.val()) {
		const today = new Date().toISOString().slice(0, 10);
		$subTitle.val(`${today} 會議紀錄`);
	}
}

/* 匯出 JSON：附帶時間戳 */
function exportJSON() {
	const data = localStorage.getItem(LS_PREFIX);
	if (!data) {
		alert("尚無資料可匯出，請先填寫表單或使用填充功能。");
		return;
	}

  saveFormData(true);
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hour = String(now.getHours()).padStart(2, "0");
	const minute = String(now.getMinutes()).padStart(2, "0");
	const second = String(now.getSeconds()).padStart(2, "0");
	const dateTimeStr = `${year}_${month}_${day}_${hour}_${minute}_${second}`;
	const blob = new Blob([data], { type: "application/json;charset=utf-8" });
	saveAs(blob, `meetingFormData_${dateTimeStr}.json`);

  localStorage.removeItem(LS_PREFIX);
}

/* 匯入 JSON */
function importJSON(event) {
	const file = event.target.files[0];
	if (!file) return;
	const reader = new FileReader();
	reader.onload = function (e) {
		try {
			const importedData = JSON.parse(e.target.result);
			localStorage.setItem(LS_PREFIX, JSON.stringify(importedData));
			restoreFormData();
			saveFormData(true);
			alert("JSON 匯入成功，表單內容已更新。");
		} catch (err) {
			console.error(err);
			alert("匯入失敗，檔案格式可能有誤。");
		}
	};
	reader.readAsText(file);
	event.target.value = "";
}

/* ==== 假資料填充函式（含亂數） ==== */
function autofillForm() {
	/* ---------- 一些簡單的亂數工具 ---------- */
	const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
	const pickOne = (arr) => arr[rand(0, arr.length - 1)];
	const pickMany = (arr, n) => {
		const copy = [...arr];
		const out = [];
		while (out.length < n && copy.length) {
			const idx = rand(0, copy.length - 1);
			out.push(copy.splice(idx, 1)[0]);
		}
		return out;
	};
	const today = new Date();

	/* ---------- 樣本資料池 ---------- */
	const titleWords = ["第一季", "上半年", "年度", "重點", "策略"];
	const topicWords = ["業務檢討", "產品發表", "市場分析", "內部培訓", "技術分享"];
	const locations = ["台北總公司會議室3", "高雄分部簡報室", "新竹研發中心 1F", "線上 Zoom"];
	const namesPool = [
		"王小明",
		"李大仁",
		"陳怡君",
		"林志玲",
		"張國榮",
		"水果奶奶",
		"謝金燕",
		"周杰倫",
		"郭台銘",
		"盧秀燕",
		"五月天阿信",
		"隋棠",
	];

	/* ---------- 隨機產出表單欄位 ---------- */
	const mainTitle = `${today.getFullYear()}${pickOne(titleWords)}${pickOne(topicWords)}會議`;
	$("#mainTitle").val(mainTitle);

	const subTitle = `${today.toISOString().slice(0, 10)} ${pickOne(topicWords)}紀錄`;
	$("#subTitle").val(subTitle);

	$("#meetingInfo").val(`針對 ${today.getFullYear()} 年度${pickOne(topicWords)}進行全面討論與檢討。`);
	$("#location").val(pickOne(locations));

	/* 起迄時間隨機往後 3‒14 天 */
	const startDay = new Date(today);
	startDay.setDate(today.getDate() + rand(3, 14));
	const endDay = new Date(startDay);
	endDay.setHours(startDay.getHours() + 3);

	const fmtDate = (d) => d.toISOString().slice(0, 10);
	const fmtTime = (d) => d.toTimeString().slice(0, 5);

	$("#startDate").val(fmtDate(startDay));
	$("#startTime").val(fmtTime(startDay));
	$("#endDate").val(fmtDate(endDay));
	$("#endTime").val(fmtTime(endDay));

	/* ---------- 會議成員 ---------- */
	const $attendees = $("#attendeesTags").empty();
	const $observers = $("#observersTags").empty();
	const $recordSel = $("#recordSelectTags").empty();

	pickMany(namesPool, rand(3, 5)).forEach((n) => addTag(n, $attendees[0]));
	pickMany(namesPool, rand(2, 4)).forEach((n) => addTag(n, $observers[0]));
	addTag(pickOne(namesPool), $recordSel[0]);

	/* ---------- 富文字內容 ---------- */
	plannedContentEditor.clipboard.dangerouslyPasteHTML(`
    <p><strong>預計議題：</strong></p>
    <ol>
      <li>市場趨勢分析：預測未來季度市場動向與競爭策略。</li>
      <li>銷售數據檢討：回顧上季度銷售表現，找出成功與不足之處。</li>
      <li>產品開發進度：各部門報告產品研發進度，討論技術挑戰。</li>
      <li>客戶回饋整理：彙整主要客戶意見，分析改進方向。</li>
    </ol>
  `);

	discussionEditor.clipboard.dangerouslyPasteHTML(`
    <p><strong>討論重點：</strong></p>
    <ol>
      <li>調整銷售策略以應對市場變化，增加新客戶開發。</li>
      <li>改進產品設計，提升使用者體驗。</li>
      <li>客戶服務品質提升措施，並定期回訪重點客戶。</li>
    </ol>
  `);

	notesEditor.clipboard.dangerouslyPasteHTML(`
    <p><strong>注意事項：</strong></p>
    <ol>
      <li>資源分配需經管理層確認，避免重複投資。</li>
      <li>數據準確性需進一步核對，各部門報告請附上原始資料。</li>
      <li>建議進行市場調研，了解競爭對手動態。</li>
    </ol>
  `);

	completedEditor.clipboard.dangerouslyPasteHTML(`
    <p><strong>已完成項目：</strong></p>
    <ol>
      <li>各部門初步報告已提交，初步數據已整理。</li>
      <li>前期數據分析報告整理完畢，重點問題已標註。</li>
      <li>跨部門協作方案已確定，具體執行細節待定。</li>
    </ol>
  `);

	todoEditor.clipboard.dangerouslyPasteHTML(`
    <p><strong>待辦事項：</strong></p>
    <ol>
      <li>修正產品細節，完善功能測試。</li>
      <li>完善客戶服務流程，提升回應速度。</li>
      <li>更新市場調研報告，提供競爭對手分析。</li>
    </ol>
  `);

	saveFormData();
}

/* 初始化 Flatpickr */
flatpickr("#startDate", {});
flatpickr("#endDate", {});
flatpickr("#startTime", { enableTime: true, noCalendar: true, dateFormat: "H:i" });
flatpickr("#endTime", { enableTime: true, noCalendar: true, dateFormat: "H:i" });

setupTagInput("attendeesInput", "attendeesTags");
setupTagInput("observersInput", "observersTags");
setupTagInput("recordSelect", "recordSelectTags");

/* 監聽 Quill 編輯器內容改變，及時存到 LocalStorage */
plannedContentEditor.on("text-change", function () {
	saveFormData();
});
discussionEditor.on("text-change", function () {
	saveFormData();
});
notesEditor.on("text-change", function () {
	saveFormData();
});
completedEditor.on("text-change", function () {
	saveFormData();
});
todoEditor.on("text-change", function () {
	saveFormData();
});

/* 表單送出 */
$("#meetingForm").on("submit", function (e) {
	// 依舊可取得事件物件，如需 e.preventDefault() 可自行加入
	saveFormData(true); // 儲存表單
	setDefaultSubtitle(); // 設定預設副標題

	// 從 localStorage 取出資料並寫回隱藏欄位
	const data = localStorage.getItem(LS_PREFIX);
	$("#dataField").val(data); // jQuery 的 .val() 等同於 DOM 的 .value
	localStorage.removeItem(LS_PREFIX);

	// 不呼叫 e.preventDefault()，讓表單照常送出
});

$(document).ready(async function () {
  const id = getItemID()
  let jonsStr = '';
  if(id && id > 0){
    jonsStr = await readData(id);
  }
	restoreFormData(jonsStr);
	setDefaultSubtitle();
  const itemId = getItemID();
  if(itemId){
    $("#numberLabel").text(`保持清醒，保持理智。ID：${itemId}`);
  }
});

// 綁定「自動填入假資料」按鈕
$("#test").on("click", function () {
	window.autofillClickCount = (window.autofillClickCount || 0) + 1;
	if (window.autofillClickCount < 5) {
		return;
	} else {
		if (!confirm("您已點擊五次，是否確認填入預設假資料？")) {
			window.autofillClickCount = 0;
			return;
		}
		window.autofillClickCount = 0;
		autofillForm();
	}
});
