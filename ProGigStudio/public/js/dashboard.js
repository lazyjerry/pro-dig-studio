document.addEventListener("DOMContentLoaded", () => {
  init()
});

async function init() {
  /* 先向後端要設定 */
  const cfg = await fetch("/api/config").then(r => (r.ok ? r.json() : null));
  if (!cfg) {
    alert("無法載入設定，請重登入");
    location.href = "/logout";
    return;
  }
  console.log("config", cfg);
  /* 把設定塞進表單欄位 */
  fillPage("notes",   cfg.notes);
  setVal("openai-token",    cfg.openai?.token);

  /* Extra 頁面 */
  if (Array.isArray(cfg.extra)) {
    cfg.extra.forEach(p =>
      addExtraPage(p.label ?? "未命名", p.url, p.token ?? "")
    );
  }

  /* 預設載入第一頁（報價單） */
  loadIframe("https://goblinapp.com/");

  /* 綁定既有 UI 事件 */
  bindUIEvents();
}

/* ---------- 工具 ---------- */
function fillPage(key, obj = {}) {
  console.log(key, obj);
  setVal(`${key}-url`, obj.url);
  setVal(`${key}-token`, obj.token);
   const el = document.getElementById(`${key}-page`);
   if (el){
    //添加 data-url 和 data-token 屬性
    el.setAttribute("data-url", obj.url);
    el.setAttribute("data-token", obj.token);
   }
}

function setVal(id, value = "") {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function getPageObj(key) {
  return {
    url: document.getElementById(`${key}-url`).value,
    token: document.getElementById(`${key}-token`).value,
  };
}


// Load iframe function
function loadIframe(rawUrl, token64 = "") {

  // 1) 若無 token => 照舊用 GET
  if (!token64) {
    iframe.classList.add("loading");
    iframe.src = rawUrl;
    iframe.onload = () => iframe.classList.remove("loading");
    return;
  }

  // 2) 有 token => 動態產生表單 POST
  const form = document.createElement("form");
  form.method = "POST";
  form.action = rawUrl;
  form.target = "contentFrame";   // 必須對應 iframe.name
  form.style.display = "none";

  const field = document.createElement("input");
  field.type = "hidden";
  field.name = "token";           // 伺服器端要讀取此欄位
  field.value = token64;          // 內容為 base64("token:"+password)
  form.appendChild(field);

  document.body.appendChild(form);

  iframe.classList.add("loading");
  form.submit();                  // 送 POST，回應會顯示在 iframe
  form.remove();

  iframe.onload = () => iframe.classList.remove("loading");
}

function getExtrasFromDOM() {
  const arr = [];
  document.querySelectorAll("#extra-pages-container a[data-url]").forEach((a) => {
    arr.push({
      label: a.textContent.trim(),
      url: a.getAttribute("data-url"),
      token: a.getAttribute("data-token") || "",
    });
  });
  return arr;
}

// Add extra page function
function addExtraPage(label, url, token = "") {
  const pageId = "extra-page-" + Date.now();

  /* === 1. 建立 DOM === */
  const container = document.createElement("div");
  container.id = pageId;
  container.innerHTML = `
    <div class="flex items-center justify-between group">
      <a href="#" data-url="${url}" data-token="${token}"
         class="menu-item flex items-center p-2 pl-3 text-gray-700 hover:text-gray-900 w-full rounded">
        <i class="fas fa-external-link-alt mr-3 text-sm"></i>
        <span class="truncate">${label}</span>
      </a>
      <button class="delete-page opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-2 mr-1"
              data-id="${pageId}">
        <i class="fas fa-trash-alt text-sm"></i>
      </button>
    </div>`;
  extraPagesContainer.appendChild(container);

  /* === 2. 點選載入 iframe === */
  const link = container.querySelector("a");
  link.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".menu-item").forEach((el) => el.classList.remove("active"));
    link.classList.add("active");
    loadIframe(link.dataset.url);
    iframeContainer.classList.remove("hidden");
    settingsPanel.classList.add("hidden");
  });

  /* === 3. 刪除按鈕 === */
  container.querySelector(".delete-page").addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("確定要刪除此頁面嗎？")) return;

    extraPagesContainer.removeChild(container);
    try {
      await saveConfigSilent();
    } catch (err) {
      alert("刪除失敗，請稍後再試");
      console.error(err);
      // ⬇︎ 復原畫面
      extraPagesContainer.appendChild(container);
    }
  });

  /* === 4. 新增後立刻同步後端 === */
  (async () => {
    try {
      await saveConfigSilent();
    } catch (err) {
      alert("新增失敗，請稍後再試");
      console.error(err);
      extraPagesContainer.removeChild(container); // 復原
    }
  })();
}


/* ---------- 共用：把目前表單存回後端 ---------- */
async function saveConfigSilent() {
  const cfg = buildConfigFromForm(); // 取現有函式
  console.log("saveConfigSilent", cfg);
  const r = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cfg),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.error || "SERVER_ERROR");
  }
}

function buildConfigFromForm() {
  /* ---------- 組 config 物件 ---------- */
    const cfg = {
      
      notes: { url: $("notes-url").value, token: $("notes-token").value },
      openai: { token: $("openai-token").value },

      // 收集所有 extra
      extra: getExtrasFromDOM(),
    };
    return cfg;
}

const $ = (id) => document.getElementById(id);

// 綁定事件
function bindUIEvents() {

  // Load default page
  loadIframe("https://goblinapp.com/");

  // Menu item click handler
  menuItems.forEach((item) => {
    item.addEventListener("click", function (e) {
      e.preventDefault();

      // Remove active class from all items
      document.querySelectorAll(".menu-item").forEach((el) => {
        el.classList.remove("active");
      });

      // Add active class to clicked item
      this.classList.add("active");

      // Load the URL in iframe
      const url = this.getAttribute("data-url");
      const token = this.getAttribute("data-token");
      loadIframe(url,token);

      // Show iframe container and hide settings panel
      iframeContainer.classList.remove("hidden");
      settingsPanel.classList.add("hidden");
    });
  });

  // Settings button click handler
  settingsBtn.addEventListener("click", function (e) {
    e.preventDefault();

    // Remove active class from all items
    document.querySelectorAll(".menu-item").forEach((el) => {
      el.classList.remove("active");
    });

    // Add active class to settings button
    this.classList.add("active");

    // Hide iframe container and show settings panel
    iframeContainer.classList.add("hidden");
    settingsPanel.classList.remove("hidden");
  });

  // Add page button click handler
  addPageBtn.addEventListener("click", function () {
    addPageModal.classList.remove("hidden");
  });

  // Close modal button click handler
  closeModal.addEventListener("click", function () {
    addPageModal.classList.add("hidden");
  });

  // Cancel add page button click handler
  cancelAddPage.addEventListener("click", function () {
    addPageModal.classList.add("hidden");
  });

  // Confirm add page button click handler
  confirmAddPage.addEventListener("click", function () {
    const label = document.getElementById("page-label").value;
    const url = document.getElementById("page-url").value;
    const token = document.getElementById("page-token").value;

    if (label && url) {
      addExtraPage(label, url, token);
      addPageModal.classList.add("hidden");

      // Clear inputs
      document.getElementById("page-label").value = "";
      document.getElementById("page-url").value = "";
      document.getElementById("page-token").value = "";
    } else {
      alert("請填寫所有必要欄位");
    }
  });

  // 送出設定表單
  settingsForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    // 取現有函式
    const cfg = buildConfigFromForm();

    /* ---------- PUT /api/config ---------- */
    try {
      await saveConfigSilent();
      alert("設定已儲存");
      // 如需重新載入：location.reload();
    } catch (err) {
      console.error(err);
      alert("儲存失敗： " + err.message);
    }
    // End of settings form submit handler
  });
  // 監聽 iframe 載入完成事件
}