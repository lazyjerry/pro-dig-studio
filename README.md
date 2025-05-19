# 接案仔 OFFICE

一個基於 Cloudflare Workers、D1、KV、Secret 及 Hono 的全端伺服器專案「接案仔 OFFICE」，主要實作流程從專案初始化、環境設定到部署上線，並示範如何結合 Cloudflare 生態系統來快速開發與運維。

## 目錄

- [螢幕截圖檔案列表](#螢幕截圖檔案列表)
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

## 螢幕截圖檔案列表

以下為 `截圖/` 資料夾中所有檔案的 Markdown 連結列表：

- [列表頁面](截圖/列表頁面.png)
- [勞報單](截圖/勞報單.png)
- [報價單](截圖/報價單.png)
- [外部連結 1](截圖/外部連結1.png)
- [工作日誌](截圖/工作日誌.png)
- [會議記錄](截圖/會議記錄.png)
- [登入](截圖/登入.png)
- [筆記本](截圖/筆記本.png)
- [註冊](截圖/註冊.png)
- [首頁](截圖/首頁.png)

## 功能概述

- 無密碼 WebAuthn 認證
- 支援註冊（一人）與登入（綁定註冊帳號）流程
- JWT + Cookie Session 管理
- 報價單、會議記錄、勞報單等 HTML／PDF 範本
- 前端一鍵 JSON 匯入匯出、PDF 下載
- 工作日誌（Worklog）CRUD
- 筆記本功能
- 可編輯筆記內容、上傳／下載 JSON、即時字數統計、一鍵複製
- 側邊欄可動態新增、開啟或移除外部連結（如 SEO 工具、iLovePDF 等）
- 無法嵌入 iframe 外部連結可設定另開新頁面

## 技術棧

- 使用 **Cloudflare Workers** 作為邊緣伺服器
- **D1** 實作 SQL 資料庫儲存
- **KV** 暫存快速存取資料
- **Secret** 用於儲存敏感憑證
- **Hono** 框架負責路由與中介層
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
ProGigStudio/
├── src/                       # 原始程式碼
│   ├── index.ts               # Hono 應用入口
│   ├── libs/                  # 共用工具函式
│   │   ├── jwt.ts             # JWT 簽發與驗證
│   │   ├── config.ts          # 組態讀寫與驗證
│   │   └── common.ts          # Cookie、Auth 中介、JSON 解析
│   ├── routes/                # 各路由模組
│   │   ├── authRequired.ts    # 驗證中介
│   │   ├── worklogs.ts        # Worklog CRUD API
│   │   └── data.ts            # 通用資料 CRUD API
│   └── templates/             # 動態文件 (HTML + TS)
│       ├── meeting.html
│       ├── meeting.ts
│       ├── labour.html
│       └── labour.ts
├── public/                    # 靜態資源
│   ├── auth.html
│   ├── dashboard.html
│   ├── 404.html
│   └── logo.png
├── migrations/                # D1 資料庫初始化 SQL
│   └── init.sql
├── wrangler.toml              # Wrangler 設定 (Bindings、環境...)
├── package.json               # npm 依賴與指令
├── tsconfig.json              # TypeScript 設定
└── .gitignore                 # Git 忽略清單
```

## 環境設定

### 1. D1 資料庫

```bash
wrangler d1 create WORKLOG_DB
```

在 `wrangler.toml` 加入：

```toml
[bindings]
d1_databases = [ { binding = "DB", database_name = "接案仔OFFICE_DB" } ]
```

### 2. KV 命名空間

```bash
wrangler kv:namespace create "JOFFICE_AUTH_KV"
```

在 `wrangler.jsonc` 修改：

```bash
"kv_namespaces": [
		{
			"binding": "JOFFICE_AUTH_KV",
			"id": "得到的ID"
		}
	],
```

### 3. Secret 設定

```bash
#產生隨機密鑰
openssl rand -base64 32
# 添加
wrangler secret put JWT_SECRET
```

在 `index.ts` 中可透過 `c.env.JWT_SECRET` 讀取。

## 撰寫程式碼結構

### Hono 應用骨架

```ts
import { Hono } from "hono";
const app = new Hono();

// 註冊 KV、D1、Secret
app.get("/", (c) => c.text("Hello 接案仔OFFICE!"));

export default app;
```

框架細節請參考[官網](https://hono.dev/)

### 路由設計範例

- **GET /** 主頁
- **POST /data** 寫入 D1
- **GET /data/\:id** 從 D1 讀取
- **GET /cache/\:key** KV 讀取

```ts
app.post("/data", async (c) => {
	const db = c.env.DB;
	const { name, content } = await c.req.json();
	const result = await db.prepare(`INSERT INTO items (name, content) VALUES (?, ?)`).bind(name, content).run();
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
   wrangler deploy
   ```

部署完成後，透過對應的 Workers URL 即可存取服務。

## 常見問題

- **無法取得 `last_row_id`？**<br>請確認 D1 回傳 `result.meta.last_row_id` 而非 `lastInsertRowID`。
- **KV 讀寫失敗？**<br>檢查 `wrangler.toml` 的 namespace ID 是否正確。
- **Secret 未生效？**<br>重新 `wrangler secret put`，並確認 `c.env.SECRET_NAME` 無誤。

---

感謝使用「[接案仔 OFFICE](https://github.com/lazyjerry/pro-dig-studio)」，祝開發順利！

## LICENSE

本專案採用 MIT License ■ 詳細內容請見 [LICENSE](https://github.com/lazyjerry/pro-dig-studio/blob/master/ProGigStudio/LICENSE) 檔案。
