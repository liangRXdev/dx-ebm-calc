# dx-ebm-calc — 專案規則

診斷檢驗 EBM 計算器（2×2 → LR → Fagan nomogram）。單檔 vanilla JS + SVG，無框架、無相依套件，部署於 GitHub Pages。`tx-ebm-calc` 是治療端姊妹作。

**定位：教學與實證讀書會用，非臨床決策依據。** 任何新增功能的文案都要守住這個界線。

---

## 架構

- `index.html` — 整個應用，CSS 與 JS 皆行內（`<script>` 在 276–637 行）
- `tests.json` — 常見檢驗 LR 速查庫，資料單一來源
- `sw.js` — PWA shell 快取（`CACHE = 'dx-ebm-calc-v2'`）
- 無 `_headers`、無 CSP（GH Pages 不控標頭）——與 pharmacy-portal 不同，改行內 script **不需**重算 hash

## 會咬人的地方

**改動 shell 檔案（index.html / tests.json / manifest / icons）→ 必須升 `sw.js` 的 `CACHE` 版本號**（`-v2` → `-v3`），否則使用者拿到舊快取。新增同源靜態檔要同步加入 `SHELL` 陣列。

需在瀏覽器實測時用本機靜態伺服器跑 `localhost:8731`（tx-ebm-calc 用 8732，刻意區隔避免 SW scope 打架）。作者本機有 `.serve.js`，已 gitignore、不在 repo 內。

Fagan nomogram 圖面**刻意設計為唯讀**（手機誤觸的教訓），新增圖表互動前先確認是否違反這個決策。

## tests.json 的資料紀律

`meta.schema` 已定義完整欄位語意，新增檢驗時照著填。硬性要求：

- **每筆必附 `source` 與 `sourceUrl`**，不可只寫數值
- `sens` / `spec` 為主要欄位；`lrPos` / `lrNeg` 多由 sens/spec 推算，**若與原文 pooled LR 不同必須註明**
- `threshold`（陽性定義）與 `population`（適用族群）不可省——LR 隨族群與 cutoff 而變，缺這兩欄的數值會誤導
- 改動後同步更新 `meta.lastUpdated`

## 方法學來源

計算與分級的依據已列在 README（Deeks/Altman BMJ 2004、Jaeschke JAMA 1994、McGee 2002、Fagan NEJM 1975）。修改公式或分級門檻時，一併更新 README 的對應引用。

## 樣式慣例

- 字型：`Noto Sans TC` 內文、`JetBrains Mono` 等寬（存於 CSS 變數 `--mono`，用 `var(--mono)` 引用，勿寫死字型名）
- CSS class 用 kebab-case + 空格分隔 modifier（`btn solid`、`box final`、`cell-tp`），非 BEM
- 配色沿用 pharmacy-portal 的 MUJI 色系，與工具集其他頁面保持一致
