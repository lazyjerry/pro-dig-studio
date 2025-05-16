/* -----------------------------------------------------------
 * jQuery 等同 DOMContentLoaded：$(async function () { ... })
 * --------------------------------------------------------- */
$(async function () {
  /* ---------- flatpickr 日期時間選擇器 ---------- */
  flatpickr(".datepicker", {
    dateFormat: "Y-m-d H:i",
    enableTime: true,
    time_24hr: true,
    locale: "zh_tw",
    allowInput: true,
    altFormat: "Y年m月d日 H:i",
  });

  /* ---------- 首次載入工作日誌 ---------- */
  loadLogs(false, 0);

  /* ---------- 表單與按鈕事件 ---------- */
  $("#add-work-item").on("click", addWorkItemField);

  $("#reset-form").on("click", () => {
    if (confirm("確定要重設表單嗎？")) resetForm();
  });

  $("#refresh-page").on("click", () => {
    if (confirm("確定要刷新頁面嗎？")) location.reload();
  });

  /* ---------- 搜尋欄位清除按鈕 ---------- */
  $(".clear-search").on("click", function () {
    const targetId = $(this).data("target"); // 讀取 data-target
    $("#" + targetId).val("");
    $(this).hide();
  });

  /* 輸入時切換清除按鈕可見 */
  $(".search-field input").on("input", function () {
    const $clearBtn = $(this).siblings(".clear-search");
    $clearBtn.toggle($(this).val().trim().length > 0);
  });

  /* ---------- 儲存、Modal 與刪除 ---------- */
  $("#save-work-log").on("click", saveWorkLog);

  $("#close-modal").on("click", () => $("#log-modal").addClass("hidden"));
  $("#cancel-delete").on("click", () => $("#delete-confirm-modal").addClass("hidden"));

  $("#delete-log").on("click", function () {
    const logId = Number($(this).data("logId"));
    const log   = workLogs.find((l) => l.id === logId);

    $("#confirm-delete").data("logId", logId);
    $("#delete-confirm-title").text(log.title);
    $("#delete-confirm-modal").removeClass("hidden");
  });

  $("#confirm-delete").on("click", confirmDeleteLog);

  /* ---------- 無限卷軸載入 ---------- */
  $(window).on("scroll", () => {
    if (!hasMore) return; // 已無更多資料
    const nearBottom =
      $(window).scrollTop() + $(window).height() >= $(document).height() - 100;
    if (nearBottom) loadLogs(true); // append 模式
  });

  /* ---------- 搜尋 ---------- */
  $("#search-btn").on("click", () => {
    currentSearch = {
      title  : $("#search-title").val().trim(),
      content: $("#search-content").val().trim(),
      date   : $("#search-date").val().trim(),
    };
    offset = 0;
    hasMore = true;
    loadLogs(false, 0); // 重新查詢
  });

  /* ---------- 自動填入假資料（連點五次） ---------- */
  $("#test").on("click", function () {
    window.autofillClickCount = (window.autofillClickCount || 0) + 1;

    if (window.autofillClickCount < 5) return;

    if (!confirm("您已點擊五次，是否確認填入預設假資料？")) {
      window.autofillClickCount = 0;
      return;
    }
    window.autofillClickCount = 0;
    autoFillRandomData();
  });
});