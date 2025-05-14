document.addEventListener("DOMContentLoaded", async function () {

  // 初始化 flatpickr
  flatpickr(".datepicker", { dateFormat: "Y-m-d H:i", enableTime: true, time_24hr: true, locale: "zh_tw", allowInput: true });

  // 首次抓取並渲染日誌
  loadLogs(false, 0 );
  
  // 新增工作項目
  document.getElementById("add-work-item").addEventListener("click", addWorkItemField);

  // 重設表單
  document.getElementById("reset-form").addEventListener("click", () => {
    if(!confirm("確定要重設表單嗎？")){
      return;
    }
    resetForm();
  });

  
  document.getElementById("refresh-page").addEventListener("click", () => {
    if(!confirm("確定要刷新頁面嗎？")){
      return;
    }
    this.location.reload();
  });


  // 清除搜尋欄位
  document.querySelectorAll(".clear-search").forEach((button) => {
    button.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      document.getElementById(targetId).value = "";
      this.style.display = "none";
    });
  });

  // 輸入時顯示清除按鈕
  document.querySelectorAll(".search-field input").forEach((input) => {
    input.addEventListener("input", function () {
      const clearBtn = this.parentElement.querySelector(".clear-search");
      clearBtn.style.display = this.value.trim() ? "block" : "none";
    });
  });

  // 儲存工作日誌
  document.getElementById("save-work-log").addEventListener("click", saveWorkLog);

  // 關閉詳情 Modal
  document.getElementById("close-modal").addEventListener("click", () => {
    document.getElementById("log-modal").classList.add("hidden");
  });

  document.getElementById("cancel-delete").addEventListener("click", () => {
    document.getElementById("delete-confirm-modal").classList.add("hidden");
  });
  

  document.getElementById("delete-log").addEventListener("click", function () {
    const logId = parseInt(this.dataset.logId);
    const log = workLogs.find((l) => l.id === logId);
    document.getElementById("confirm-delete").dataset.logId = logId;
    console.log("logId",logId);
    document.getElementById("delete-confirm-title").textContent = log.title;
    document.getElementById("delete-confirm-modal").classList.remove("hidden");
  });

  // 刪除確認
  document.getElementById("confirm-delete").addEventListener("click", confirmDeleteLog);

  window.addEventListener("scroll", () => {
    // 如果已無更多，就不用檢查
    if (!hasMore) return;
  
    // 判斷是否滑到底部（可微調 threshold）
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 100;
    if (nearBottom) {
      loadLogs(true);  // 載入更多、append
    }
  });

  // 搜尋
  document.getElementById("search-btn").addEventListener("click", () => {
    // 取得欄位值
    const title = document.getElementById("search-title").value.trim();
    const content = document.getElementById("search-content").value.trim();
    const date = document.getElementById("search-date").value.trim();
  
    // 更新搜尋狀態
    currentSearch = { title, content, date };
    // 重置分頁
    offset = 0;
    hasMore = true;
  
    // 清除現有列表並載入新結果
    loadLogs(false, 0);
  });
});



