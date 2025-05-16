# 接案仔 OFFICE

一個基於 Cloudflare Workers、D1、KV、Secret 及 Hono 的全端伺服器專案「接案仔 OFFICE」，主要實作流程從專案初始化、環境設定到部署上線，並示範如何結合 Cloudflare 生態系統來快速開發與運維。

## 目錄

- [功能概述](#功能概述)
- [技術棧](#技術棧)
- [先決需求](#先決需求)
- [專案初始化](#專案初始化)
- [環境設定](#環境設定)

  - [1. D1 資料庫](#1-d1-資料庫)
  - [2. KV 命名空間](#2-kv-命名空間)
  - [3. Secret 設定](#3-secret-設定)

- [撰寫程式碼結構](#撰寫程式碼結構)

  - [Hono 應用骨架](#hono-應用骨架)
  - [路由設計範例](#路由設計範例)

- [本機測試與部署](#本機測試與部署)
- [常見問題](#常見問題)

## 功能概述

- 使用 **Cloudflare Workers** 作為邊緣伺服器
- **D1** 實作 SQL 資料庫儲存
- **KV** 暫存快速存取資料
- **Secret** 用於儲存敏感憑證
- **Hono** 框架負責路由與中介層

## 技術棧

- **語言**：TypeScript
- **框架**：Hono
- **Database**：Cloudflare D1 (SQLite 兼容)
- **Cache**：Cloudflare KV Namespace
- **部署工具**：Wrangler

## 先決需求

1. 安裝 [Node.js (>=14)](https://nodejs.org/)
2. 安裝 [wrangler](https://developers.cloudflare.com/workers/wrangler/)

   ```bash
   npm install -g wrangler
   ```

3. 已有 Cloudflare 帳號，並且有權限新增 Workers、D1、KV、Secret

## 專案初始化

```bash
# 建立新專案
wrangler init 接案仔OFFICE --template hono
cd 接案仔OFFICE
npm install hono
```

專案結構預設：

```
接案仔OFFICE/
├─ src/
│  ├─ index.ts      # 進入點
│  └─ routes/       # 路由模組
├─ wrangler.toml    # Wrangler 設定
└─ package.json
```

## 環境設定

### 1. D1 資料庫

```bash
wrangler d1 create 接案仔OFFICE_DB
```

在 `wrangler.toml` 加入：

```toml
[bindings]
d1_databases = [ { binding = "DB", database_name = "接案仔OFFICE_DB" } ]
```

### 2. KV 命名空間

```bash
wrangler kv:namespace create "JOFFICE_CACHE"
```

在 `wrangler.toml` 加入：

```toml
[bindings]
kv_namespaces = [ { binding = "CACHE", id = "<剛剛產生的ID>" } ]
```

### 3. Secret 設定

```bash
wrangler secret put API_KEY
```

在 `index.ts` 中可透過 `c.env.API_KEY` 讀取。

## 撰寫程式碼結構

### Hono 應用骨架

```ts
import { Hono } from 'hono';
const app = new Hono();

// 註冊 KV、D1、Secret
app.get('/', (c) => c.text('Hello 接案仔OFFICE!'));

export default app;
```

### 路由設計範例

- **GET /** 主頁
- **POST /data** 寫入 D1
- **GET /data/\:id** 從 D1 讀取
- **GET /cache/\:key** KV 讀取

```ts
app.post('/data', async (c) => {
  const db = c.env.DB;
  const { name, content } = await c.req.json();
  const result = await db.prepare(`INSERT INTO items (name, content) VALUES (?, ?)`)
    .bind(name, content)
    .run();
  return c.json({ id: result.meta.last_row_id });
});
```

## 本機測試與部署

1. 本機啟動

   ```bash
   wrangler dev
   ```

2. 部署至 Cloudflare

   ```bash
   wrangler publish
   ```

部署完成後，透過對應的 Workers URL 即可存取服務。

## 常見問題

- **無法取得 `last_row_id`？**<br>請確認 D1 回傳 `result.meta.last_row_id` 而非 `lastInsertRowID`。
- **KV 讀寫失敗？**<br>檢查 `wrangler.toml` 的 namespace ID 是否正確。
- **Secret 未生效？**<br>重新 `wrangler secret put`，並確認 `c.env.SECRET_NAME` 無誤。

---

感謝使用「接案仔 OFFICE」，祝開發順利！

## LICENSE

本專案採用 MIT License ■ 詳細內容請見 [LICENSE](LICENSE) 檔案。
