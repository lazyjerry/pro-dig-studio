/* ──────────────────────────────
   1. logs 相關結構
   ────────────────────────────── */
CREATE TABLE IF NOT EXISTS logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,                 -- 你的新欄位
  content    TEXT NOT NULL,                 -- 工作內容
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 每次 UPDATE 自動刷新 updated_at
CREATE TRIGGER IF NOT EXISTS trg_logs_updated_at
AFTER UPDATE ON logs
FOR EACH ROW
BEGIN
  UPDATE logs
  SET    updated_at = CURRENT_TIMESTAMP
  WHERE  id = OLD.id;
END;

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs (created_at);
CREATE INDEX IF NOT EXISTS idx_logs_name       ON logs (name);
CREATE INDEX IF NOT EXISTS idx_logs_content    ON logs (content);

/* ──────────────────────────────
   2. data 相關結構
   ────────────────────────────── */
CREATE TABLE IF NOT EXISTS data (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  type       TEXT NOT NULL,                 -- 資料型別
  name       TEXT NOT NULL,              -- 資料名稱
  info       TEXT,                 -- JSON資訊  
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 型別＋時間的複合索引（DESC 只影響查詢排序，不影響索引自身）
CREATE INDEX IF NOT EXISTS idx_data_type_created_at ON data (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_type_name       ON data (type, name);

-- 每次 UPDATE 自動刷新 updated_at
CREATE TRIGGER IF NOT EXISTS trg_data_updated_at
AFTER UPDATE ON data
FOR EACH ROW
BEGIN
  UPDATE data
  SET    updated_at = CURRENT_TIMESTAMP
  WHERE  id = OLD.id;
END;