// 毫秒級 sleep 函式
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 取 logs，append 或 replace
async function loadLogs(append = false,delayTime = 0) {
  
  if (isLoading || (!hasMore)) return;
  isLoading = true;

  if (delayTime > 0) {
    // delayTime 以秒為單位，轉成毫秒
    await sleep(delayTime * 1 * 500);
  }

  if (!append) {
    // 重設不添加的行為
    offset = 0;
  }

  try {

    let searchDate = '';
    if(currentSearch.date){
      const localStart = new Date(currentSearch.date);
      searchDate = toUTCStringNoTZ(localStart);
    }
    // 組 URL search params
    const params = new URLSearchParams({
      limit: limit,
      offset: offset,
      // 只有非空才加入
      ...(currentSearch.title && { searchTitle: currentSearch.title }),
      ...(currentSearch.content && { searchContent: currentSearch.content }),
      ...(currentSearch.date && { searchDate: searchDate })
    });

    const res = await fetch(`/logs?${params.toString()}`);
    if (!res.ok) throw new Error("Network error");
    const data = await res.json();

    // 沒拿到足夠筆，就表示已經到底
    if (data.length < limit) hasMore = false;

    // 處理並存入 workLogs
    const newLogs = data.map(log => ({
      id: log.id,
      title: log.name,
      date: log.created_at,
      items: JSON.parse(log.content)
    }));

    if (append) {
      workLogs = workLogs.concat(newLogs);
    } else {
      workLogs = newLogs;
    }
    offset += newLogs.length;  // 更新 offset

    console.log("loadLogs offset",offset);

    resetForm();          // 重設表單
    renderWorkLogs(append, newLogs);          // 重繪列表
  } catch (err) {
    console.error(err);
    showToast("讀取工作紀錄失敗", "error");
  } finally {
    isLoading = false;
  }
}

// 新增工作項目欄位
function addWorkItemField() {
  const container = document.getElementById("work-items-container");
  const template = document.querySelector(".work-item").cloneNode(true);
  template.querySelectorAll("input, textarea").forEach(i => i.value = "");
  container.appendChild(template);
  template.querySelector(".remove-item").addEventListener("click", () => {
    if (container.children.length > 1) container.removeChild(template);
    else alert("至少需要一個工作項目");
  });
}

// 重設表單
function resetForm() {
  // 清除工作項目欄位
  const container = document.getElementById("work-items-container");
  while (container.children.length > 1) container.removeChild(container.lastChild);
  const firstItem = container.firstElementChild;
  firstItem.querySelectorAll("input, textarea").forEach(i => i.value = "");
  $(firstItem.querySelector(".item-status")).val(null).trigger("change");
  document.getElementById("work-title").value = "";

  initWorkTitle();
}

function initWorkTitle(){
  const now = new Date();
  // 取得 YYYY-MM-DD HH:mm 格式
  const formatted = getLocalTime(now);
  let title = formatted+" 工作日誌";
  document.getElementById("work-title").value = title;
}

// 儲存工作日誌
async function saveWorkLog() {
  const title = document.getElementById("work-title").value.trim();
  const itemsEls = document.querySelectorAll(".work-item");
  if (!title) return showToast("請填寫工作名稱", "warning");

  const workItems = [];
  let hasError = false;
  itemsEls.forEach(item => {
    const name = item.querySelector(".item-name").value.trim();
    const description = item.querySelector(".item-description").value.trim();
    const status = $(item.querySelector(".item-status")).val();
    if (!name || !description || !status) hasError = true;
    else workItems.push({ name, description, status });
  });
  if (hasError) return showToast("請填寫所有工作項目的完整資訊", "error");

  if(!confirm("確定要儲存工作紀錄嗎？送出後無法更改！")){
    return
  }

  try {
    const res = await fetch('/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: title, content: JSON.stringify(workItems) })
    });
    if (!res.ok) throw new Error('Create failed');
    showToast("工作紀錄已儲存", "success");
    resetForm();
    hasMore = true; // 重設 hasMore 
    loadLogs(false,1);
  } catch (err) {
    console.error(err);
    showToast("儲存失敗，請稍後再試", "error");
  }
}

// 確認刪除紀錄
async function confirmDeleteLog() {
  const logId = parseInt( $("#confirm-delete").attr("data-logId") );
  const title = $("#confirm-delete").attr("data-title");
  const input = document.getElementById("delete-confirm-input").value.trim();
  const log = workLogs.find(l => l.id === logId);
  // console.log("confirmDeleteLog", logId);
  // console.log("confirmDeleteLog", title);
  if (input !== title){
    return toast("輸入的工作名稱不匹配，請重新輸入");
  }

  try {
    const res = await fetch(`/logs/${logId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast("工作紀錄已刪除", "success");
    document.getElementById("delete-confirm-modal").classList.add("hidden");
    document.getElementById("log-modal").classList.add("hidden");
    
    document.getElementById(`log-elem-${logId}`).classList.add("hidden");
    
  } catch (err) {
    console.error(err);
    showToast("刪除失敗，請稍後再試", "error");
  }
}


// Escape HTML to prevent XSS and injection
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/\n/g, "<br/>");
  
}

function subEscapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;").replace(/\n/g, "  ");;
}

/**
 * @param {boolean} append - 是否要 append（true: 只插入 newLogs；false: 重新渲染所有 workLogs）
 * @param {Array} newLogs  - loadLogs 解析出的新資料陣列
 */
function renderWorkLogs(append = false, newLogs = []) {
  const container = document.getElementById("work-logs-container");

  // 如果不是 append，就清空並渲染整個 workLogs
  if (!append) {
    container.innerHTML = "";
    if (workLogs.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8">
          <i class="fas fa-inbox text-4xl text-gray-400 mb-2"></i>
          <p class="text-gray-500">目前沒有工作紀錄</p>
        </div>
      `;
      return;
    }
    // 作為第一輪完整渲染時，newLogs 也是整個 workLogs
    newLogs = workLogs;
  }

  // 只對 newLogs 做 append
  newLogs.forEach((log) => {
    const logElement = document.createElement("div");
    logElement.className = "border border-gray-200 rounded-lg p-4 log-card bg-white";
    logElement.dataset.logId = log.id;

    const uniqueStatuses = [...new Set(log.items.map(i => i.status))];
    const statusesHtml = uniqueStatuses
      .map(status => {
        const classes = getStatusColorClass(status);
        return `<span class="px-2 py-1 text-xs rounded-full ${classes}">${subEscapeHtml(status)}</span>`;
      })
      .join("");

    const itemsHtml = log.items
      .map(item => `
        <div class="flex items-start">
          <span class="text-gray-500 mr-2">•</span>
          <span class="truncate">${subEscapeHtml(item.name)}: ${subEscapeHtml(item.description)}</span>
        </div>
      `)
      .join("");

    const formatted = getLocalTime(log.date);
    
    logElement.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <h3 class="text-lg font-medium text-blue-600"><span class="text-yellow-800">${log.id} - </span>${subEscapeHtml(log.title)}</h3>
        <span class="text-sm text-gray-500">${formatted}</span>
      </div>
      <div class="flex flex-wrap gap-2 mb-3">${statusesHtml}</div>
      <div class="text-gray-600 text-sm space-y-1 mb-3">${itemsHtml}</div>
      <div class="flex justify-between items-center text-sm">
        <span class="text-gray-500">共 ${log.items.length} 個工作項目</span>
        <button class="text-blue-500 hover:text-blue-700 view-details" data-log-id="${log.id}">
          <i class="fas fa-eye mr-1"></i> 查看詳情
        </button>
      </div>
    `;
    logElement.id=`log-elem-${log.id}`;
    container.appendChild(logElement);

    // 只為這一筆綁定 listener
    logElement.querySelector(".view-details").addEventListener("click", e => {
      e.stopPropagation();
      showLogDetails(log.id);
    });
  });
}

// Show log details in modal
function showLogDetails(logId) {
  const log = workLogs.find((l) => l.id === logId);
  if (!log) return;

  // 取得 YYYY-MM-DD HH:mm 格式
  const formatted = getLocalTime(log.date);
  

  document.getElementById("modal-title").textContent = log.title;
  document.getElementById("modal-date").textContent = `紀錄時間: ${formatted}`;
  document.getElementById("delete-log").dataset.logId = logId;

  // Render statuses
  const statusesContainer = document.getElementById("modal-statuses");
  statusesContainer.innerHTML = "";
  [...new Set(log.items.map((item) => item.status))].forEach((status) => {
    const span = document.createElement("span");
    span.className = `px-3 py-1 text-sm rounded-full ${getStatusColorClass(status)}`;
    span.textContent = status;
    statusesContainer.appendChild(span);
  });

  // Render items with safe newlines
  const itemsContainer = document.getElementById("modal-items");
  itemsContainer.innerHTML = "";
  log.items.forEach((item) => {
    const itemElement = document.createElement("div");
    itemElement.className = "border border-gray-200 rounded-lg p-4 bg-gray-50 mb-3";

    // Escape and convert newlines to <br>
    const safeDesc = escapeHtml(item.description).replace(/\n/g, "<br>");

    itemElement.innerHTML = `
      <div class="flex justify-between items-start mb-2">
        <h4 class="font-medium text-gray-800">${escapeHtml(item.name)}</h4>
        <span class="px-2 py-1 text-xs rounded-full ${getStatusColorClass(item.status)}">${escapeHtml(item.status)}</span>
      </div>
      <p class="text-gray-700">${safeDesc}</p>
    `;

    itemsContainer.appendChild(itemElement);
  });

  document.getElementById("log-modal").classList.remove("hidden");
}

// Helper to get status color classes
function getStatusColorClass(status) {
  switch (status) {
    case "進行中": return "bg-blue-100 text-blue-800";
    case "已完成": return "bg-green-100 text-green-800";
    case "審核中": return "bg-yellow-100 text-yellow-800";
    case "擱置": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}


// ----- 隨機產生一筆測試資料並填入表單 ------
function autoFillRandomData() {
  // 先重設表單
  resetForm();

  // 隨機標題
  const titles = [
    "前端功能開發：會員登入流程",
    "後端 API 優化：訂單查詢",
    "資料庫維護：每日備份任務",
    "使用者測試：新手引導頁面",
    "安全性掃描：漏洞自動化報告",
    "UI 調整：深色模式完善",
    "效能測試：壓力測試報表"
  ];
  const title = titles[Math.floor(Math.random() * titles.length)];
  document.getElementById("work-title").value = title;

  // 紀錄時間設成當下本地時間到分
  const now = new Date();
  const formatted = getLocalTime(now); // 假設已提供 YYYY-MM-DD HH:mm
  const dateNote = document.querySelector(".mb-6 p");
  if (dateNote) dateNote.textContent = `紀錄時間：${formatted}`;

  // 產生隨機 2–5 個工作項目
  const itemCount = Math.floor(Math.random() * 4) + 2;
  for (let i = 0; i < itemCount - 1; i++) {
    addWorkItemField();
  }

  // 狀態可選清單
  const statuses = ["尚未開始", "進行中", "已完成", "審核中", "擱置"];

  // 描述範本
  const descriptions = [
    "撰寫 API 文件，並加入範例回應格式。",
    "完成前端表單驗證，包含必填欄位與格式檢查。",
    "測試環境布署，確認所有服務正常運行。",
    "根據性能分析結果，進行 SQL index 優化。",
    "撰寫單元測試，覆蓋率至少達到 80%。",
    "更新套件依賴，並修復相容性問題。"
  ];

  // 填入每個 work-item（只填名稱、描述、狀態）
  document.querySelectorAll(".work-item").forEach((itemEl, idx) => {
    // 隨機名稱
    itemEl.querySelector(".item-name").value = `測試項目 ${idx + 1}`;

    // 隨機描述（兩行）
    const descLines = [
      descriptions[Math.floor(Math.random() * descriptions.length)],
      descriptions[Math.floor(Math.random() * descriptions.length)]
    ];
    itemEl.querySelector(".item-description").value = descLines.join("\n");

    // 隨機狀態
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const statusEl = itemEl.querySelector(".item-status");
    if (statusEl) statusEl.value = status;
  });
}