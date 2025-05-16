// toast.js  — 不含任何 TS 型別標註
const JQUERY_VERSION = "3.6.0";
const TOASTR_VERSION = "2.1.4";

const CDN = {
  jquery   : `https://code.jquery.com/jquery-${JQUERY_VERSION}.min.js`,
  toastrJs : `https://cdnjs.cloudflare.com/ajax/libs/toastr.js/${TOASTR_VERSION}/toastr.min.js`,
  toastrCss: `https://cdnjs.cloudflare.com/ajax/libs/toastr.js/${TOASTR_VERSION}/toastr.min.css`,
};

let loader = null; // 共用 Promise，避免重複下載

function ensureToastr() {
  if (window.toastr) return Promise.resolve(window.toastr);
  if (loader) return loader;

  loader = (async () => {
    if (!window.jQuery)              await loadScript(CDN.jquery);
    if (![...document.styleSheets].some(s => s.href?.includes("toastr"))) {
      const link = document.createElement("link");
      link.rel  = "stylesheet";
      link.href = CDN.toastrCss;
      document.head.appendChild(link);
    }
    await loadScript(CDN.toastrJs);
    return window.toastr;
  })();

  return loader;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src   = src;
    s.async = true;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error(src + " 無法載入"));
    document.head.appendChild(s);
  });
}

/**
 * toast("訊息文字", "success" | "info" | "warning" | "error", { timeOut: 3000 })
 */
function toast(message, type = "info", opts = {}) {
  ensureToastr()
    .then(t => {
      Object.assign(t.options, opts);
      (t[type] || t.info)(message);
    })
    .catch(() => alert(message)); // 後援：資源載入失敗
}

// 全域與 ES Module 兩用
window.toast = toast;
export { toast };