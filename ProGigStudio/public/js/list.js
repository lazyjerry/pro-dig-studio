/* -----------------------------------------------------------
 * 1. 基本設定與 jQuery 物件
 * --------------------------------------------------------- */
const config = { itemsPerPage: 100 };

// 主要節點
const $tableBody      = $("#table-body");
const $loading        = $("#loading");
const $paginationInfo = $("#pagination-info");
const $addBtn         = $("#add-btn");
const $searchBtn      = $("#search-btn");
const $resetBtn       = $("#reset-btn");
const $nameSearch     = $("#name-search");
const $startDate      = $("#start-date");
const $endDate        = $("#end-date");

/* -----------------------------------------------------------
 * 2. 全域狀態
 * --------------------------------------------------------- */
let currentPage  = 1;
let totalPages   = 1;
let currentData  = [];
let isLoading    = false;
let hasMore      = true;

/* -----------------------------------------------------------
 * 3. 初始化
 * --------------------------------------------------------- */
async function init() {
  

  /* ▼ 事件綁定 ▼ */
  $addBtn   .on("click", doEventAdd);
  $searchBtn.on("click", handleSearch);
  $resetBtn .on("click", handleReset);

  /* 無限捲動 */
  $(window).on("scroll", handleScroll);

  /* 載入初始資料 */
  await loadData();
}

/* -----------------------------------------------------------
 * 4. 載入資料 (fetch)
 * --------------------------------------------------------- */
async function loadData(page = 1, searchParams = null) {
  if (isLoading) return;
  isLoading = true;
  $loading.removeClass("hidden");

  const jsonArgs = searchParams ?? buildCurrentSearch(page);
  const qs = new URLSearchParams(jsonArgs).toString();

  try {
    const res  = await fetch(`${API_BASE}?${qs}`);
    if (!res.ok) throw new Error("LOAD_FAIL");
    const list = await res.json();

    hasMore      = list.length === config.itemsPerPage; // 少於1頁 => 沒下一頁
    currentData  = page === 1 ? list : currentData.concat(list);
    currentPage  = page;
    totalPages   = hasMore ? page + 1 : page;

    renderTable(currentData);
    updatePaginationInfo();
  } catch (err) {
    console.error(err);
    alert("讀取失敗，請稍後再試");
  } finally {
    isLoading = false;
    $loading.addClass("hidden");
  }
}

/* -----------------------------------------------------------
 * 5. 渲染表格
 * --------------------------------------------------------- */
function renderTable(data) {
  $tableBody.empty();

  if (!data.length) {
    $tableBody.append(`
      <tr>
        <td colspan="5" class="px-6 py-4 text-center text-gray-500">
          沒有找到任何資料
        </td>
      </tr>
    `);
    return;
  }

  data.forEach(item => {
    const formatted = formatDateTime(item.created_at);

    const $row = $(`
      <tr class="fade-in hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.id}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatted}</td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button class="edit-btn text-indigo-600 hover:text-indigo-900 mr-2 inline-flex items-center" data-id="${item.id}">
            <i class="fas fa-edit mr-1"></i> 編輯
          </button>
          <button class="delete-btn text-red-600 hover:text-red-900 mr-2 inline-flex items-center" data-id="${item.id}">
            <i class="fas fa-trash mr-1"></i> 刪除
          </button>
        </td>
      </tr>
    `);

    $tableBody.append($row);
  });

  /* 綁定動態列內按鈕 */
  $tableBody.find(".edit-btn").off("click").on("click", function () {
    dataEditEvent(Number($(this).data("id")));
  });
  $tableBody.find(".delete-btn").off("click").on("click", function () {
    handleDelete(Number($(this).data("id")));
  });
}

/* -----------------------------------------------------------
 * 6. 分頁資訊
 * --------------------------------------------------------- */
function updatePaginationInfo() {
  const totalItems   = currentData.length;
  const showingItems = Math.min(currentPage * config.itemsPerPage, totalItems);
  $paginationInfo.text(`顯示 1 到 ${showingItems} 筆資料，共 ${totalItems} 筆`);
}

/* -----------------------------------------------------------
 * 7. 搜尋 / 重置 / 新增 / 編輯 / 刪除
 * --------------------------------------------------------- */
async function handleSearch() {
  currentPage = 1;
  hasMore     = true;
  await loadData(1, buildCurrentSearch(1));
}

async function handleReset() {
  $nameSearch.val("");
  $startDate .val("");
  $endDate   .val("");
  currentPage = 1;
  hasMore     = true;
  await loadData(1);
}

function doEventAdd() {
  location.href = `/${DATA_TYPE}/detail`;
}
function dataEditEvent(id) {
  location.href = `/${DATA_TYPE}/detail?id=${id}`;
}

async function handleDelete(id) {
  if (!confirm("確定要刪除此筆資料嗎？")) return;
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("DEL_FAIL");
    currentPage = 1;            // 重新讀第一頁
    await loadData();
  } catch {
    alert("刪除失敗");
  }
}

/* -----------------------------------------------------------
 * 8. 無限捲動
 * --------------------------------------------------------- */
async function handleScroll() {
  if (!hasMore || isLoading) return;

  const nearBottom =
    $(window).scrollTop() + $(window).height() >= $(document).height() - 100;

  if (nearBottom) {
    currentPage += 1;
    await loadData(currentPage, buildCurrentSearch(currentPage));
  }
}

/* -----------------------------------------------------------
 * 9. 組搜尋參數
 * --------------------------------------------------------- */
function buildCurrentSearch(page = 1) {
  const params = {};

  const n = $nameSearch.val().trim();
  if (n) params.name = n;

  if ($startDate.val()) params.startDate = toUTCStringNoTZ(new Date($startDate.val()));
  if ($endDate  .val()) params.endDate   = toUTCStringNoTZ(new Date($endDate  .val()));

  params.type        = DATA_TYPE;
  params.currentPage = Math.max(page - 1, 0);
  params.limit       = config.itemsPerPage;

  return params;
}

/* -----------------------------------------------------------
 * 10. 就緒
 * --------------------------------------------------------- */
// $(init);   // 等同於 document.addEventListener("DOMContentLoaded", init);
$(document).ready(function(){
  /* ▼ flatpickr 日期時間選擇器 ▼ */
  flatpickr(".datepicker", {
    dateFormat : "Y-m-d H:i",
    enableTime : true,
    time_24hr  : true,
    locale     : "zh_tw",
    allowInput : true,
    altFormat  : "Y年m月d日 H:i",
  });
  init();
});