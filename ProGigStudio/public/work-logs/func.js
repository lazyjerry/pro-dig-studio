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
  const logId = parseInt(this.dataset.logId);
  const input = document.getElementById("delete-confirm-input").value.trim();
  const log = workLogs.find(l => l.id === logId);
  
  if (input !== log.title){
    return toast("輸入的工作名稱不匹配，請重新輸入");
  }

  try {
    const res = await fetch(`/logs/${logId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    showToast("工作紀錄已刪除", "success");
    document.getElementById("delete-confirm-modal").classList.add("hidden");
    document.getElementById("log-modal").classList.add("hidden");
    
    loadLogs(false,1);
  } catch (err) {
    console.error(err);
    showToast("刪除失敗，請稍後再試", "error");
  }
}

// ---- UI Helper Functions ----
// Show toast notification
function showToast(message, type) {
  const toast = document.createElement("div");
  let bgColor = "bg-blue-500";

  if (type === "success") {
    bgColor = "bg-green-500";
  } else if (type === "error") {
    bgColor = "bg-red-500";
  } else if (type === "warning") {
    bgColor = "bg-yellow-500";
  }

  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg text-white ${bgColor} shadow-lg flex items-center`;
  toast.innerHTML = `
            <i class="fas ${
              type === "success"
                ? "fa-check-circle"
                : type === "error"
                ? "fa-exclamation-circle"
                : "fa-info-circle"
            } mr-2"></i>
            ${message}
        `;

  document.body.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.classList.add("opacity-0", "transition-opacity", "duration-300");
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
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
    "客戶會議回顧",
    "Bug 修復檢討",
    "新功能需求討論",
    "性能優化測試",
    "版本發布準備"
  ];
  const title = titles[Math.floor(Math.random() * titles.length)];
  document.getElementById("work-title").value = title;

  // **將紀錄時間設成當下本地時間（到分）**
  const now = new Date();
  // 取得 YYYY-MM-DD HH:mm 格式
  const formatted = getLocalTime(now);
  // 更新顯示
  const dateNote = document.querySelector(".mb-6 p");
  if (dateNote) dateNote.textContent = `紀錄時間: ${formatted}`;


  // 產生隨機 1–3 個工作項目
  const count = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < count - 1; i++) {
    addWorkItemField();
  }

  const statuses = ["尚未開始", "進行中", "已完成", "審核中", "擱置"];
  const descriptions = [
    ` 臣亮言：先帝創業未半，而中道崩殂。\n今天下三分，益州疲弊，此誠危急存亡之秋也。\n然侍衛之臣，不懈於內；忠志之士，忘身於外者，蓋追先帝之殊遇，欲報之於陛下也。\n誠宜開張聖聽，以光先帝遺德，恢弘志士之氣；不宜妄自菲薄，引喻失義，以塞忠諫之路也。\n宮中府中，俱為體，陟罰臧否，不宜異同。\n若有作姦犯科，及為忠善者，宜付有司，論其刑賞，以昭陛下平明之治，不宜篇私，使內外異法也。\n侍中、侍郎郭攸之、費褘、董允等，此皆良實，志慮忠純，是以先帝簡拔以遺陛下。\n愚以為宮中之事，事無大小，悉以咨之，然後施行，必能裨補闕漏，有所廣益。\n將軍向寵，性行淑均，曉暢軍事，試用於昔日，先帝稱之曰「能」，是以眾議舉寵為督。\n愚以為營中之事，悉以咨之，必能使行陣和睦，優劣得所。\n親賢臣，遠小人，此先漢所以興隆也；親小人，遠賢臣，此後漢所以傾頹也。\n先帝在時，每與臣論此事，未嘗不歎息痛恨於桓、靈也。\n侍中、尚書、長史；參軍，此悉貞良死節之臣也，願陛下親之信之，則漢室之隆，可計日而待也。`,
    `臣受命之日，寢不安席，食不甘味。\n思惟北征，宜先入南，故五月渡瀘，深入不毛，并日而食。\n臣非不自惜也，顧王業不可偏安於蜀都，故冒危難，以奉先帝之遺意。\n而議者謂為非計。\n今賊適疲於西，又務於東。\n兵法乘勞，此進趨之時也。`,
    `夫難平者，事也。\n昔先帝敗軍於楚，當此時，曹操拊手，謂天下已定。\n然後先帝東連吳越，西取巴蜀，舉兵北征，夏侯授首：此操之失計，而漢事將成也。\n然後吳更違盟，關羽毀敗，秭歸蹉跌，曹丕稱帝。\n凡事如是，難可逆料。\n臣鞠躬盡瘁，死而後已。\n至於成敗利鈍，非臣之明所能逆睹也。`,
    `臣本布衣，躬耕於南陽，苟全性命於亂世，不求聞達於諸侯。\n先帝不以臣卑鄙，猥自枉屈，三顧臣於草廬之中，諮臣以當世之事，由是感激，遂許先帝以驅馳。\n後值傾覆，受任於敗軍之際，奉命於危難之間，爾來二十有一年矣！先帝知臣謹慎，故臨崩寄臣以大事也。\n受命以來，夙夜憂勤，恐託付不效，以傷先帝之明。\n故五月渡瀘，深入不毛。\n今南方已定，兵甲已足，當獎率三軍，北定中原，庶竭駑鈍，攘除奸凶，興復漢室，還於舊都；此臣所以報先帝而忠陛下之職分也。\n至於斟酌損益，進盡忠言，則攸之、褘、允之任也。\n願陛下託臣以討賊興復之效；不效，則治臣之罪，以告先帝之靈。\n若無興德之言，則戮允等，以彰其慢。\n陛下亦宜自課，以諮諏善道，察納雅言，深追先帝遺詔，臣不勝受恩感激。\n今當遠離，臨表涕零，不知所云。`,
    `先帝慮漢賊不兩立，王業不偏安，故託臣以討賊也。\n以先帝之明，量臣之才，固知臣伐賊，才弱敵彊也。\n然不伐賊，王業亦亡；惟坐而待亡，孰與伐之？是故託臣而弗疑也。`
  ]
  document.querySelectorAll(".work-item").forEach((item, idx) => {
    // 隨機名稱與描述
    item.querySelector(".item-name").value = `測試項目 ${idx + 1}`;
    const des = statuses[Math.floor(Math.random() * statuses.length)];
    item.querySelector(".item-description").value = `這是第 ${idx + 1} 項的隨機描述。\n` + descriptions[Math.floor(Math.random() * descriptions.length)];   
    // 隨機狀態
    const sel = $(item.querySelector(".item-status"));
    const st = statuses[Math.floor(Math.random() * statuses.length)];
    sel.val(st).trigger("change");
  });
}