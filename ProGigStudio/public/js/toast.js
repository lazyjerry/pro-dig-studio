function showToast(message, type = "info") {
  toastr.options = {
    closeButton: true,            // 顯示關閉按鈕
    debug: false,
    newestOnTop: true,
    progressBar: true,            // 顯示進度條
    positionClass: "toast-bottom-right",
    preventDuplicates: false,
    onclick: null,
    showDuration: "300",
    hideDuration: "1000",
    timeOut: "2500",              // 2.5 秒自動關閉
    extendedTimeOut: "1000",
    showEasing: "swing",
    hideEasing: "linear",
    showMethod: "fadeIn",
    hideMethod: "fadeOut"
  };
  // 根據 type 呼叫對應的方法
  toastr[type](message);
}
