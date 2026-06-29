# 診斷檢驗 EBM 計算器

> Diagnostic Test EBM Calculator — 梁哲嘉藥師

互動式診斷檢驗實證計算器：由 2×2 表或 sens/spec 算出概似比 (LR)，以勝算版貝氏定理更新檢驗前→後機率，並用互動 Fagan nomogram 視覺化。教學與實證讀書會雙用，繁體中文。

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Click%20Here-blue?style=for-the-badge)](https://liangrxdev.github.io/dx-ebm-calc/)

## 功能

- **指標計算**：由 2×2 人數或直接輸入 sens/spec → 敏感度、特異度、PPV、NPV、準確度、LR+、LR−（2×2 模式附 95% CI）
- **LR 白話分級**：依 LR 大小自動標示「強／中／弱 rule-in / rule-out」（Jaeschke/McGee 標準）
- **Bayes 更新**：pre-test → post-test probability，逐步顯示 odds 鏈
- **互動 Fagan nomogram**：拖曳左軸即時更新，圖上標示前/後機率
- **常見檢驗 LR 速查庫**（`tests.json`）：16 筆附原始文獻出處，分「診斷／預後」載入
- **白話結果總結**：一鍵複製（給病歷／教學）、清除全部

## 技術

- 單檔 `index.html`（vanilla JS + SVG，無框架、無相依套件）
- 資料：`tests.json`（檢驗速查庫，單一來源、可擴充）
- 風格：與個人臨床工具集 (pharmacy-portal) 一致的 MUJI 配色

## 方法學參考

- 概似比與診斷檢驗：Deeks JJ, Altman DG. *BMJ* 2004;329:168-9
- LR 強度分級：Jaeschke/Guyatt/Sackett *JAMA* 1994；McGee *J Gen Intern Med* 2002
- Fagan nomogram：Fagan TJ. *NEJM* 1975;293:257
- 各檢驗 sens/spec 出處詳見 `tests.json` 每筆 `source` 欄位

## 計算公式

- LR+ = sens/(1−spec)；LR− = (1−sens)/spec
- post-test odds = pre-test odds × LR；odds = p/(1−p)
- 95% CI：LR 用 log 法 (Simel 1991)、比例用 Wilson score；零格加 0.5 連續性校正

## 免責

本工具為**教學／實證練習用，非臨床決策依據**。檢驗 LR 隨研究族群與 cutoff 而變，臨床請回原文確認。

## License

MIT
