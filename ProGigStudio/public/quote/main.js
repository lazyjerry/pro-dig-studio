// 設定日期預設值：後天及後 14 天
function setDefaultDates() {
  const today = new Date();
  today.setDate(today.getDate() + 2);
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  $("#dateInput").val(todayStr);

  const deadline = new Date(today);
  deadline.setDate(deadline.getDate() + 14);
  const yyyy2 = deadline.getFullYear();
  const mm2 = String(deadline.getMonth() + 1).padStart(2, "0");
  const dd2 = String(deadline.getDate()).padStart(2, "0");
  const deadlineStr = `${yyyy2}-${mm2}-${dd2}`;
  $("#deadlineInput").val(deadlineStr);
}

// 產生報價單編號：格式 EST + (最後兩位年份 + 月日小時分鐘 + 隨機一位數)
function generateQuoteNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 10); // 隨機一位數
  return "EST" + yy + mm + dd + hh + min + rand;
}

// 新增品項（描述 + 數量 / 單價 / 刪除）
function addRow() {
  // 取出模板裡的 HTML 字串
  const templateHtml = $("#itemTemplate").html();
  // 加到表格 <tbody>
  $("#itemsTable tbody").append(templateHtml);
  // 新增完後即刻重新計算
  updateTotals();
}

// 刪除品項（包含描述那一行 + 數值那一行）
function removeRow(button) {
  const $btn = $(button);
  // 數量/單價那一行
  const $rowNumbers = $btn.closest("tr");
  // 描述那一行在它上面
  const $rowDesc = $rowNumbers.prev("tr");

  // 至少保留一組品項
  if ($("#itemsTable tbody tr").length > 2) {
    $rowDesc.remove();
    $rowNumbers.remove();
    updateTotals();
  } else {
    alert("至少需保留一個品項");
  }
}

// 計算小計、稅金、總計
function updateTotals() {
  let subtotal = 0;

  $("input[name='itemQuantity']").each(function (index) {
    const qty = parseInt($(this).val()) || 0;
    const price =
      parseInt($("input[name='itemUnitPrice']").eq(index).val()) || 0;
    subtotal += qty * price;
  });

  const taxPercent = parseInt($("#taxPercent").val()) || 0;
  const tax = Math.floor((subtotal * taxPercent) / 100);
  const total = subtotal + tax;

  $("#subtotalDisplay").text(subtotal);
  $("#taxDisplay").text(tax);
  $("#totalDisplay").text(total);

   const jsonStr = getJsonByForm();
  document.getElementById("dataField").value = jsonStr;

  _saveData();
}

// 事件：若輸入框 blur 時發現為空，就改成 "0"
function handleBlurSetZero() {
  if ($(this).val().trim() === "") {
    $(this).val("0");
  }
  updateTotals();
}

// 事件：若輸入框 blur 時發現為空，就改成 "1"
function handleBlurSetOne() {
  if ($(this).val().trim() === "" || $(this).val().trim() === "0") {
    $(this).val("1");
  }
  updateTotals();
}

// 預設假資料（新假資料）
function getDefaultFakeData() {
  return {
    logoUrl: "https://jerryzheli.com/assets_files/img/J.png",
    providerName: "乙方示例公司",
    providerContact: "地址：台中市西區示例路 10 號\n電話：04-1234567",
    customerName: "甲方示例企業",
    customerContact: "地址：高雄市前鎮區示例路 20 號\n電話：07-7654321",
    taxPercent: 5,
    remarks: `1.該份報價附屬於事先簽署的合作合約之中，若無則僅供確認記錄留存，請勿蓋章、回簽。
2.單價不含稅與支付平台手續費用。發票稅為總價 5%，其餘手續費用另記。
3.頭款與其他款項需另行確認，並於頭款支付完成後開始執行。
4.尾款支付期為於結案後 7 天內，或於執行前另外約定，遲延給付一日 0.1% 違約金。
5.我方得以於不涉及甲方營業秘密原則下，保留該作品作為作品集展示之權利。
6.如規格有異動，需調整報價請另行提出。`,
    items: [
      { desc: "雲端伺服器架設[優惠]", qty: 1, price: 0 },
      { desc: "購買網域/DNS一年份、代管", qty: 1, price: 1000 },
      { desc: "管理端功能實作", qty: 1, price: 100000 },
      { desc: "客戶端實作", qty: 1, price: 150000 },
    ],
  };
}

// 自動填入預設假資料
function autofillForm() {
  const data = getDefaultFakeData();

  // 填入左側基本資料
  $("#logoUrl").val(data.logoUrl);
  $("#providerName").val(data.providerName);
  $("#providerContact").val(data.providerContact);
  $("#customerName").val(data.customerName);
  $("#customerContact").val(data.customerContact);
  $("#taxPercent").val(data.taxPercent);
  $("#remarks").val(data.remarks);

  // 先清空品項表格
  $("#itemsTable tbody").empty();

  // 依據資料 新增多筆品項
  data.items.forEach(function (item) {
    // 1) 拿到模板字串
    const templateHtml = $("#itemTemplate").html();
    // 2) parseHTML 後包成 jQuery 物件
    const $cloned = $($.parseHTML(templateHtml));

    // 3) 填入品項資料
    $cloned
      .filter(".descRow")
      .find('textarea[name="itemDescription"]')
      .val(item.desc);

    $cloned
      .filter(".numberRow")
      .find('input[name="itemQuantity"]')
      .val(item.qty);

    $cloned
      .filter(".numberRow")
      .find('input[name="itemUnitPrice"]')
      .val(item.price);

    // 4) 加到表格
    $("#itemsTable tbody").append($cloned);
  });

  // 最後更新合計
  updateTotals();
}

function _saveData(){
  // 保存
  const jsonStr = getJsonByForm();
  const name = $("#quoteNumber").val();
  saveData("編號-" + name, jsonStr,function(success){
    if(success){
      // 有保存就不存本地
      removeAllFields();  
    }  
  });
}

// 匯出 JSON => 產生檔案
function exportFormJSON() {
  const jsonStr = getJsonByForm();
  // 準備下載檔名
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");
  const dateTimeStr = `${yyyy}_${mm}_${dd}_${hh}_${min}_${sec}`;
  const blob = new Blob([jsonStr], {
    type: "application/json;charset=utf-8",
  });
  saveAs(blob, `quoteData_${dateTimeStr}.json`);

  _saveData();
}

// 匯入 JSON
function importFormJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = JSON.parse(e.target.result);
      fillFormData(data);
      alert("匯入成功！表單已更新。");
    } catch (error) {
      alert("JSON 格式錯誤或無法解析。");
    }
  };
  reader.readAsText(file);
  // reset input value
  event.target.value = "";
}

// 讀取當前表單 (quoteForm) 轉成物件再轉成字串
function getJsonByForm() {
  const formData = {
    logoUrl: $("#logoUrl").val(),
    providerName: $("#providerName").val(),
    providerContact: $("#providerContact").val(),
    customerName: $("#customerName").val(),
    customerContact: $("#customerContact").val(),
    quoteNumber: $("#quoteNumber").val(),
    date: $("#dateInput").val(),
    deadline: $("#deadlineInput").val(),
    taxPercent: $("#taxPercent").val(),
    remarks: $("#remarks").val(),
    items: [],
  };
  // 取得所有品項
  $("#itemsTable tbody tr.descRow").each(function (index) {
    const desc = $(this).find("textarea[name='itemDescription']").val();
    const qty = parseInt(
      $(this).next(".numberRow").find("input[name='itemQuantity']").val(),
      10
    );
    const price = parseInt(
      $(this)
        .next(".numberRow")
        .find("input[name='itemUnitPrice']")
        .val(),
      10
    );
    formData.items.push({ desc, qty, price });
  });
  // 轉成 JSON
  return JSON.stringify(formData, null, 2);
}

// 將 JSON 內容填回表單
function fillFormData(data) {
  $("#logoUrl").val(data.logoUrl || "");
  $("#providerName").val(data.providerName || "");
  $("#providerContact").val(data.providerContact || "");
  $("#customerName").val(data.customerName || "");
  $("#customerContact").val(data.customerContact || "");
  $("#quoteNumber").val(data.quoteNumber || "");
  $("#dateInput").val(data.date || "");
  $("#deadlineInput").val(data.deadline || "");
  $("#taxPercent").val(data.taxPercent || 0);
  $("#remarks").val(data.remarks || "");

  // 清空現有的items
  $("#itemsTable tbody").empty();
  // 新增
  if (Array.isArray(data.items)) {
    data.items.forEach((item) => {
      const templateHtml = $("#itemTemplate").html();
      const $cloned = $($.parseHTML(templateHtml));

      $cloned
        .filter(".descRow")
        .find("textarea[name='itemDescription']")
        .val(item.desc);
      $cloned
        .filter(".numberRow")
        .find("input[name='itemQuantity']")
        .val(item.qty);
      $cloned
        .filter(".numberRow")
        .find("input[name='itemUnitPrice']")
        .val(item.price);

      $("#itemsTable tbody").append($cloned);
    });
  }
  updateTotals();


}


function removeAllFields() {
  localStorage.removeItem(LS_PREFIX);
}

// 還原所有欄位的值
async function restoreAllFields() {

  // 如果有帶 ?id=xx 則取資料返回
  const id = getItemID()
  let jonsStr = '';
  
  if(id && id > 0){
    jonsStr = await readData(id);
  }else{
    jonsStr = localStorage.getItem(LS_PREFIX);
  }
  if(jonsStr && '' != jonsStr){
    const data = JSON.parse(jonsStr);
    if (data) {
      fillFormData(data);
    }
  }
}

// 取得 config 的 callback
const configCallback = function (result){
   $("#logoUrl").val(result.logoUrl);
}

$(document).ready(function () { 
  
  getConfig(configCallback);
  // 預設日期
  setDefaultDates();

  // 報價單編號沒填就自動產生一個
  if (!$("#quoteNumber").val()) {
    $("#quoteNumber").val(generateQuoteNumber());
  }
  const itemId = getItemID();
  const quoteNum =  $("#quoteNumber").val();
  if(itemId){
    $("#quoteNumberLabel").text(`請快樂的編輯報價。ID：${itemId}, 編號：${quoteNum}`);
  }else{
    $("#quoteNumberLabel").text(`恭喜有一份新報價！編號：${quoteNum}`);
  }

  // 一開始先新增一筆空的項目
  addRow();

  // 1) 手動更新「稅金百分比」時立即計算
  $("#taxPercent").on("input", updateTotals);

  // 2) 若稅率失焦點、且值為空 => 0
  $("#taxPercent").on("blur", handleBlurSetZero);

  // 3) 對 #itemsTable 委派監聽 => 當子層的 itemQuantity / itemUnitPrice 在 input 時，立即計算
  $("#itemsTable").on(
    "input",
    'input[name="itemQuantity"], input[name="itemUnitPrice"]',
    updateTotals
  );

  // 4) 若單價失焦點 & 值為空 => 設成 0
  $("#itemsTable").on(
    "blur",
    'input[name="itemUnitPrice"]',
    handleBlurSetZero
  );

  // 4) 若數量、單價失焦點 & 值為空 => 設成 0
  $("#itemsTable").on(
    "blur",
    'input[name="itemQuantity"]',
    handleBlurSetOne
  );

  // 綁定「新增品項」按鈕
  $("#addItemButton").on("click", addRow);

  // 綁定「刷新」按鈕
  $("#refreshButton").on("click", function () {
    updateTotals();
    alert("已重新計算小計、稅金和總計。");
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

  // 監聽表單送出事件
  $("#quoteForm").on("submit", function (e) {
    // 送出前再次更新
    updateTotals();

    // 顯示 confirm
    const confirmed = confirm(
      "小計：" +
        $("#subtotalDisplay").text() +
        "\n稅金：" +
        $("#taxDisplay").text() +
        "\n總計：" +
        $("#totalDisplay").text() +
        "\n\n是否確認送出？"
    );
    if (!confirmed) {
      e.preventDefault(); // 使用者按下「取消」，阻止送出
    } else {
      removeAllFields();
      console.log("SUBMIT");
    }
  });
});


// 頁面載入後
$(document).ready(function () {
  restoreAllFields();

  $("#quoteForm").on(
    "input blur change",
    "input, textarea, select",
    function (e) {
      console.log("SAVE");
      const jsonStr = getJsonByForm();
      localStorage.setItem(LS_PREFIX, jsonStr);
    }
  );
});
