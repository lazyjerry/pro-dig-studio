/**
 * 將本地 Date 物件 → "YYYY-MM-DD HH:MM.000"（UTC）
 * 例：台灣 2025-05-14 21:00  → "2025-05-14 13:00.000"
 */
function toUTCStringNoTZ(date) {
  const pad = n => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}.000`
  );
}

/* ---------- 私有 utilities ---------- */

// 1. 把任何輸入「安全地」轉成本地 Date 物件
function _parseToDate(value) {
  // Date 物件
  if (value instanceof Date) return value;

  // Unix timeStamp（毫秒）
  if (typeof value === 'number') return new Date(value);

  // 字串
  if (typeof value === 'string') {
    // 若已帶 Z 或 ±HH:MM → 交給原生 Date 解析
    if (/(?:Z|[+\-]\d{2}:\d{2})$/.test(value)) return new Date(value);

    // 沒有時區資訊：**一律視為 UTC** 再轉成本地
    const [d = '', t = '00:00:00'] = value.split(/[\sT]/);
    const [Y, M, D] = d.split('-').map(Number);
    const [h = 0, m = 0, s = 0] = t.split(':').map(Number);
    return new Date(Date.UTC(Y, M - 1, D, h, m, s));
  }

  // 其他：盡量 new Date；失敗回 null
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

// 2. 將 Date 物件格式化成 "yyyy-MM-dd HH:mm"
function _formatDate(date) {
  if (!(date instanceof Date) || isNaN(date)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    date.getFullYear() + '-' +
    pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + ' ' +
    pad(date.getHours()) + ':' +
    pad(date.getMinutes())
  );
}

/* ---------- 保留的公開 API ---------- */

// 取得「本地」時間字串
function getLocalTime(input) {
  return _formatDate(_parseToDate(input));
}

// 把「UTC 字串」轉成本地時間字串（沿用原本語意）
function formatDateTime(utcString) {
  return _formatDate(_parseToDate(utcString));
}
