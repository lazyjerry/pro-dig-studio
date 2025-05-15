// 配置設定
const config = {
  itemsPerPage: 100,
};
// DOM元素
const tableBody = document.getElementById("table-body");
const loading = document.getElementById("loading");
const paginationInfo = document.getElementById("pagination-info");
const addBtn = document.getElementById("add-btn");
const searchBtn = document.getElementById("search-btn");
const resetBtn = document.getElementById("reset-btn");
const nameSearch = document.getElementById("name-search");
const startDate = document.getElementById("start-date");
const endDate = document.getElementById("end-date");

// 狀態變數
let currentPage = 1;
let totalPages = 1;
let currentData = [];
let isEditing = false;
let editingId = null;
let isLoading = false;
let hasMore = true;

// 初始化
async function init() {
  // 綁定事件
  addBtn.addEventListener("click", doEventAdd);
  searchBtn.addEventListener("click", handleSearch);
  resetBtn.addEventListener("click", handleReset);

  // 無限滾動
  window.addEventListener("scroll", await handleScroll);
  await handleScroll();
  // 載入初始資料
  await loadData();
}

// 載入資料
async function loadData(page = 1, searchParams = null) {
  if (isLoading) return;
  isLoading = true;
  loading.classList.remove("hidden");

  /* -------- 組 query -------- */
  const jsonArgs = searchParams ? searchParams : buildCurrentSearch(page);

  console.log("jsonArgs", jsonArgs);
  const qs = new URLSearchParams(jsonArgs).toString();

  try {
    const res = await fetch(`${API_BASE}?` + qs);
    if (!res.ok) throw new Error("LOAD_FAIL");
    const list = await res.json(); // [{id, type, name, info, created_at}]
    /* ------- 更新 hasMore 狀態 ------- */
    // console.log("list.length", list.length);
    // console.log("config.itemsPerPage", config.itemsPerPage);
    if (list.length < config.itemsPerPage) {
      hasMore = false; // 表示已到最後一頁
    }

    /* 後端一次只回傳本頁，故不用 slice */
    currentData = page === 1 ? list : currentData.concat(list);
    currentPage = page;
    totalPages = list.length < config.itemsPerPage ? page : page + 1; // 粗估
    renderTable(currentData);
    updatePaginationInfo();
  } catch (err) {
    alert("讀取失敗，請稍後再試");
    console.error(err);
  } finally {
    isLoading = false;
    loading.classList.add("hidden");
  }
}

// 渲染表格
function renderTable(data) {
  tableBody.innerHTML = "";

  if (data.length === 0) {
    tableBody.innerHTML = `
                  <tr>
                      <td colspan="5" class="px-6 py-4 text-center text-gray-500">沒有找到任何資料</td>
                  </tr>
              `;
    return;
  }

  data.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "fade-in hover:bg-gray-50";
    // console.log(item);
    // 格式化日期
    const formattedDate = formatDateTime(item.created_at);

    row.innerHTML = `
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.id}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.name}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedDate}</td>
                  <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button class="edit-btn text-indigo-600 hover:text-indigo-900 mr-2 inline-flex items-center" data-id="${item.id}">
                          <i class="fas fa-edit mr-1"></i> 編輯
                      </button>
                      <button class="delete-btn text-red-600 hover:text-red-900 mr-2 inline-flex items-center" data-id="${item.id}">
                          <i class="fas fa-trash mr-1"></i> 刪除
                      </button>

                  </td>
              `;

    tableBody.appendChild(row);
  });

  // 綁定按鈕事件
  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => dataEditEvent(parseInt(btn.dataset.id)));
  });

  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      handleDelete(parseInt(btn.dataset.id));
    });
  });
}

// 格式化日期時間
function formatDateTime(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 更新分頁資訊
function updatePaginationInfo() {
  const totalItems = currentData.length;
  const showingItems = Math.min(currentPage * config.itemsPerPage, totalItems);

  paginationInfo.textContent = `顯示 1 到 ${showingItems} 筆資料，共 ${totalItems} 筆`;
}

// 處理搜尋
async function handleSearch() {
  currentPage = 1;
  const searchParams = buildCurrentSearch(currentPage);

  hasMore = true;
  await loadData(currentPage, searchParams);
}

// 處理重置
async function handleReset() {
  nameSearch.value = "";
  startDate.value = "";
  endDate.value = "";
  currentPage = 1;
  hasMore = true;
  await loadData(currentPage);
}

// 打開新增模態框
function doEventAdd() {
  location.href = `/${DATA_TYPE}/detail`;
}

// 打開編輯模態框
function dataEditEvent(id) {
  location.href = `/${DATA_TYPE}/detail?id=${id}`;
}

// 處理刪除
async function handleDelete(id) {
  if (!confirm("確定要刪除此筆資料嗎？")) return;
  try {
    const res = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("DEL_FAIL");
    /* 成功後重新載入第一頁 */
    currentPage = 1;
    await loadData();
  } catch {
    alert("刪除失敗");
  }
}

// 處理滾動
async function handleScroll() {
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;

  if (scrollTop + clientHeight >= scrollHeight - 100) {
    // 到底
    // console.log("scroll to bottom", scrollTop + clientHeight >= scrollHeight - 100);
    // console.log("isLoading", isLoading);
    console.log("hasMore", hasMore);
    if (
      !isLoading && // 不是讀取中
      hasMore // ★ 還有下一頁
    ) {
      currentPage = currentPage + 1;
      await loadData(currentPage, buildCurrentSearch(currentPage)); // 讀下一頁

      console.log("handleScroll currentPage", currentPage);
    }
  }
}

/**
 * 讀取目前畫面上的搜尋欄位，回傳給 loadData 的參數物件
 * - 會自動忽略空值
 */
function buildCurrentSearch(page = 1) {
  const params = {};

  const n = nameSearch.value.trim();
  if (n) params.name = n;

  if (startDate.value) params.startDate = startDate.value; // YYYY‑MM‑DDTHH:mm
  if (endDate.value) params.endDate = endDate.value;

  params.type = DATA_TYPE; // 類型
  params.currentPage = Math.max(page - 1, 0); // 當前頁數
  params.limit = config.itemsPerPage;
  // console.log("params", params);
  return params; // 可能是 {}、或含 name / startDate / endDate 任意組合
}

// 初始化應用
document.addEventListener("DOMContentLoaded", init);