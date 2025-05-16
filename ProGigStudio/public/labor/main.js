// ====== 共用 ======
const addComma = (n) => Number(n || 0).toLocaleString("zh-TW");

// ====== 自動產生表單編號：YYYYMMDD-NNNN ======
(function genFormNumber() {
	const d = new Date();
	const num =
		d.getFullYear() +
		String(d.getMonth() + 1).padStart(2, "0") +
		String(d.getDate()).padStart(2, "0") +
		"-" +
		String(Date.now()).slice(-4);
	$("#formNumber").text(num);
	$("#formNumberDisplay").val(num);
})();

// ====== 主計算 ======
function updateCalculations() {
	const income = Number($("#incomeAmount").val() || 0);
	const type = $("#incomeType").val();
	const residentType = $('input[name="residentType"]:checked').val();
	const skipNHI = $("#skipNHI").prop("checked");

	let tax = 0,
		nhi = 0;

	// — 扣繳稅 —
	if (type === "50") {
		if (income > 88501) tax = income * 0.05;
	} else if (["92", "9A", "9B"].includes(type)) {
		tax = ["resident", "foreign183"].includes(residentType) ? income * 0.1 : income * 0.2;
	}
	if (tax <= 2000) tax = 0; // 稅額≤2,000 免扣

	// — 二代健保 —
	if (!skipNHI && income > 28590) nhi = income * 0.0211;

	const net = income - tax - nhi;

	$("#taxDeduct").text(addComma(Math.round(tax)));
	$("#nhiDeduct").text(addComma(Math.round(nhi)));
	$("#netPay").text(addComma(Math.round(net)));

	// 金額重新計算的時候也儲存
	// const baseData = getAllValue();
	// _saveData(baseData);
}

// ====== UI 切換 ======
function togglePaymentOptions() {
	const m = $('input[name="payMethod"]:checked').val();
	$("#checkOptions,#bankOptions,#cashOptions").addClass("hidden");
	if (m === "check") $("#checkOptions").removeClass("hidden");
	if (m === "bank") $("#bankOptions").removeClass("hidden");
	if (m === "cash") $("#cashOptions").removeClass("hidden");
}

function toggleMailAddress() {
	const isReg = $('input[name="checkReceive"]:checked').val() === "registered";
	$("#mailAddrBox").toggleClass("hidden", !isReg);
	$("#mailAddr").prop("required", isReg);
}

// 取得所有欄位資料
function getAllValue() {
  const get   = (sel) => $(sel).val();                 // 快捷
  const getTx = (sel) => $(sel).text().trim();
  const chk   = (sel) => $(sel).prop('checked');

  const data = {
    formNumber : getTx('#formNumber') || get('#formNumberDisplay'),
    companyName: get('#companyName'),
    personName : get('#personName'),
    residentType: $('input[name="residentType"]:checked').val() || null,
    idType     : $('input[name="idType"]:checked').val() || null,
    idNumber   : get('#idNumber') || null,
    addrReg    : get('#addrReg')  || null,
    addrComm   : get('#addrComm') || '同戶籍地址',
    phone      : get('#phone')    || null,

    incomeTypeCode : get('#incomeType'),
    incomeTypeName : $('#incomeType option:selected').text(),
    incomeAmount   : Number(get('#incomeAmount') || 0),
    skipNHI        : chk('#skipNHI'),

    taxDeduct : Number(getTx('#taxDeduct').replace(/,/g,'')),
    nhiDeduct : Number(getTx('#nhiDeduct').replace(/,/g,'')),
    netPay    : Number(getTx('#netPay').replace(/,/g,'')),
  };

  // 付款方式
  data.payMethod = $('input[name="payMethod"]:checked').val() || '';
  if (data.payMethod === 'check') {
    Object.assign(data, {
      checkReceive: $('input[name="checkReceive"]:checked').val() || '',
      mailAddr    : get('#mailAddr') || '',
    });
  } else if (data.payMethod === 'bank') {
    Object.assign(data, {
      bankName   : get('#bankName'),
      bankBranch : get('#bankBranch'),
      bankAccount: get('#bankAccount'),
      bankHolder : get('#bankHolder'),
    });
  }

  return data;
}

// ====== 下載 PDF ======
function handleDownload(e) {
	e.preventDefault();
	updateCalculations();
	if (!$("#formNumber").text()) {
		// 若無編號即時產生
		const d = new Date(),
			seq = String(Date.now()).slice(-4);
		$("#formNumber").text(
			d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0") + "-" + seq
		);
	}
	const $form = $("<form>", { method: "POST", action: `${API_BASE}/pdf?type=labor`, target: "_blank" });

	const baseData = getAllValue();
	_saveData(baseData);

	const addField = (k, v = "") =>
		$("<input>", {
			type: "hidden",
			name: k,
			value: v,
		}).appendTo($form);

	/* ---------- 3. 分批 (或一次) addField ---------- */
	// ── 方法 A：一次全部跑完
	$.each(baseData, (k, v) => addField(k, v));

	$("body").append($form);
	$form[0].submit();
	$form.remove();
}

// ====== 自動儲存／還原 ======
function initFieldPersistence(formSel = "#payoutForm") {
	const $form = $(formSel);
	if (!$form.length) return;

	// --- 還原 ---

	// --- 即時寫入 ---
	$form.on("input blur change", "input,select", function () {
		const key = LS_PREFIX + (this.id || this.name);
		if (!key) return;

		if (this.type === "radio") {
			if (this.checked) localStorage.setItem(key, this.value);
		} else if (this.type === "checkbox") {
			localStorage.setItem(key, this.checked ? this.value : "");
		} else {
			localStorage.setItem(key, $(this).val());
		}
	});
}


/**
 * 依 getAllValue() 的結果回填表單
 * @param {Object|string} data  JSON 物件或 JSON 字串
 * @param {string} formSel      目標表單 selector（預設 #payoutForm）
 */
function fillFormByJSON (data, formSel = '#payoutForm') {
  if (!data) return;
  if (typeof data === 'string') data = JSON.parse(data);

  const $form = $(formSel);
  if (!$form.length) return;

  /* ---------- 1. 一般 <input>/<select>/<textarea> ---------- */
  const setVal = (sel, v) => { if (v !== undefined) $(sel).val(v); };

  setVal('#companyName',  data.companyName);
  setVal('#personName',   data.personName);
  setVal('#idNumber',     data.idNumber);
  setVal('#addrReg',      data.addrReg);
  setVal('#addrComm',     data.addrComm);
  setVal('#phone',        data.phone);
  setVal('#incomeType',   data.incomeTypeCode || data.incomeType);
  setVal('#incomeAmount', data.incomeAmount);
  setVal('#bankName',     data.bankName);
  setVal('#bankBranch',   data.bankBranch);
  setVal('#bankAccount',  data.bankAccount);
  setVal('#bankHolder',   data.bankHolder);
  setVal('#mailAddr',     data.mailAddr);

  /* ---------- 2. 文字／只讀欄位 & 計算結果 ---------- */
  if (data.formNumber) {
    $('#formNumber').text(data.formNumber);
    $('#formNumberDisplay').val(data.formNumber);
  }
  if (data.taxDeduct !== undefined) $('#taxDeduct').text(addComma(data.taxDeduct));
  if (data.nhiDeduct !== undefined) $('#nhiDeduct').text(addComma(data.nhiDeduct));
  if (data.netPay   !== undefined)  $('#netPay').text(addComma(data.netPay));

  /* ---------- 3. Radio / Checkbox ---------- */
  const checkRadio = (name, val) => val != null && $(`input[name="${name}"][value="${val}"]`).prop('checked', true);
  checkRadio('residentType', data.residentType);
  checkRadio('idType',       data.idType);
  checkRadio('payMethod',    data.payMethod);
  checkRadio('checkReceive', data.checkReceive);

  $('#skipNHI').prop('checked', !!data.skipNHI);
  $('#cashConfirm').prop('checked', !!data.cashConfirm);

  /* ---------- 4. 依付款方式 / 掛號地址 重新顯示區塊 ---------- */
  if (typeof togglePaymentOptions === 'function') togglePaymentOptions();
  if (typeof toggleMailAddress   === 'function') toggleMailAddress();

  /* ---------- 5. 最終重新計算 ---------- */
  if (typeof updateCalculations  === 'function') updateCalculations();
}

// 恢復
async function restoreFormData(formSel = "#payoutForm") {
	const $form = $(formSel);
	if (!$form.length) return;

	const id = getItemID()
  if(id && id > 0){
    const jsonStr = await readData(id);
		// console.log("restoreFormData jonsStr",jsonStr);
		fillFormByJSON(jsonStr, formSel)

  }else{
		$form.find("input,select").each(function () {
			const key = LS_PREFIX + (this.id || this.name);
			const val = localStorage.getItem(key);
			if (val === null) return;
			if (this.type === "radio" || this.type === "checkbox") {
				this.checked = this.value === val;
			} else {
				$(this).val(val);
			}
		});

	}
	togglePaymentOptions();
	toggleMailAddress();
	updateCalculations();
}

// === 手動保存 =====
function mSave(){
	updateCalculations();
	_saveData();
}

// ====== 隨機填充（Demo） ======
function autofillForm() {
	const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
	const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

	$("#companyName").val(r(["測驗股份有限公司", "雲端數位工作室", "範例科技股份有限公司", "伍壹柒數位工作室"]));
	$("#personName").val(r(["王小明", "陳淑芬", "林大衛", "張雅婷", "李惠美"]));
	$("#idNumber").val(r(["A123456789", "B987654321", "F223344556"]));
	$("#addrReg").val(r(["台北市中正區重慶南路一段122號", "新北市板橋區文化路100號", "高雄市前鎮區中山二路5號"]));
	$("#addrComm").val(r(["", "台北市萬華區華西街129號", "台中市中區三民路二段87號", "高雄市三民區建興路391號"]));
	$("#phone").val(r(["0911222333", "0987654321", "0922333444"]));

	$(`input[name="residentType"][value="${r(["resident", "nonResidentTW", "foreign183", "foreignNot183"])}"]`).prop(
		"checked",
		true
	);
	$(`input[name="idType"][value="${r(["idcard", "arc", "passport"])}"]`).prop("checked", true);

	$("#incomeType").val(
		r(
			$("#incomeType")
				.children()
				.map((_, o) => o.value)
				.get()
		)
	);
	$("#incomeAmount").val(ri(24000, 500000));
	$("#skipNHI").prop("checked", Math.random() < 0.3);

	const pay = r(["check", "bank", "cash"]);
	$(`input[name="payMethod"][value="${pay}"]`).prop("checked", true).trigger("change");

	if (pay === "check") {
		const rec = r(["pickup", "registered"]);
		$(`input[name="checkReceive"][value="${rec}"]`).prop("checked", true).trigger("change");
		if (rec === "registered") $("#mailAddr").val(r(["台北市信義路1段1號", "桃園市中正路99號"]));
	} else if (pay === "bank") {
		$("#bankName").val(r(["台灣銀行", "台北富邦銀行", "玉山銀行"]));
		$("#bankBranch").val(r(["中山分行", "板橋分行", "文化分行"]));
		$("#bankAccount").val(ri(100000000000, 999999999999).toString());
		$("#bankHolder").val(r(["王小明", "張雅婷", "李惠美"]));
	} else {
		$("#cashConfirm").prop("checked", true);
	}
	updateCalculations();
}



// ====== 事件繫結 ======
$(async function () {
	// 全表計算
	$("#payoutForm").on("input change", "input,select", updateCalculations);
	$("#calcBtn").on("click", mSave);

	// UI 切換
	$(document)
		.on("change", 'input[name="payMethod"]', togglePaymentOptions)
		.on("change", 'input[name="checkReceive"]', toggleMailAddress);

	// 下載
	$("#downloadBtn").on("click", handleDownload);

	// 初始
	updateCalculations();
	togglePaymentOptions();

	// 自動儲存 / 還原
	initFieldPersistence("#payoutForm");
	await restoreFormData("#payoutForm");
	let json = getAllValue();
	_saveData(json);
});

function _saveData(json){
	
	const companyName = $("#companyName").val();
	const formNumberDisplay = $("#formNumberDisplay").val();
	saveData(`${formNumberDisplay}-${companyName}`, JSON.stringify(json), function(success){
		if(success){
			// localStorage 移除所有 LS_PREFIX 開頭的 item
			Object.keys(localStorage).forEach(key => {
				if (key.startsWith(LS_PREFIX)) {
					localStorage.removeItem(key);
				}
			});
		}
	});

}

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

/* ---------------------------------------------------
 * 下載：將整張表單完整匯出為 JSON
 * 參數 formSelector 目前僅用於產生檔名，可依需要自行擴充
 * --------------------------------------------------- */
function exportFormJSON(formSelector = '#payoutForm') {
  // 1. 取得所有欄位資料（依照你現有的 getAllValue）
  const data = getAllValue();
	_saveData(data);

  // 2. 轉字串並存成 Blob
  const jsonStr = JSON.stringify(data, null, 2);
  const blob    = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });

  // 3. 設定檔名：若有 formNumber 用它，否則用 timestamp
  const filename =
    (data.formNumber ? `勞報單_${data.formNumber}.json`
                      : `勞報單_${Date.now()}.json`);

  // 4. 建立隱藏 <a> 觸發下載
  const $a = $('<a>', {
    href: URL.createObjectURL(blob),
    download: filename
  }).appendTo('body');

  $a[0].click();
  $a.remove();
  URL.revokeObjectURL($a.attr('href'));
}

/* ---------------------------------------------------
 * 匯入：讀入 JSON 並回填到表單
 * --------------------------------------------------- */
function importFormJSON(json, formSelector = '#payoutForm') {
  if (!json) return;

  // 接受字串或物件
  const data = (typeof json === 'string') ? JSON.parse(json) : json;
  fillFormByJSON(data, formSelector);

	const baseData = getAllValue();
	_saveData(baseData);
}


/* ======= 輔助：檔案匯入按鈕 sample =======
   <input type="file" id="jsonFileInput"
          accept=".json"
          class="hidden"
          onchange="handleJSONFile(this)">
-------------------------------------------*/
function handleJSONFile(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => importFormJSON(reader.result);   // 讀完直接回填
  reader.readAsText(file, 'utf-8');
}