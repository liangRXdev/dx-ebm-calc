/* dx-ebm-calc 計算引擎（純函式，無 DOM 依賴）
 *
 * 同時支援瀏覽器（掛在 window.DxEbm）與 Node（module.exports）以便測試。
 * 統計方法與來源：
 *   - LR+ = sens/(1−spec)、LR− = (1−sens)/spec（Deeks & Altman, BMJ 2004;329:168）
 *   - LR 之 95% CI：log 法（Simel, Samsa & Matchar, J Clin Epidemiol 1991;44:763）
 *   - 比例（sens/spec/PPV/NPV）之 95% CI：Wilson score
 *   - 零格：任一格為 0 時四格皆 +0.5（Haldane），僅作用於 LR 與其 CI
 *   - LR 白話分級：Jaeschke/Guyatt/Sackett JAMA 1994；McGee J Gen Intern Med 2002
 *   - Bayes：post-test odds = pre-test odds × LR
 *   - Fagan nomogram（Fagan, NEJM 1975;293:257）：左軸顛倒 log-odds、中軸 ½·ln(LR)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DxEbm = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const z = 1.96; // 95% CI

  // ── 輸入解析 ──
  // 欄位值（字串或數字）→ 數字。空白回 NaN 但不算錯誤（尚未填）；
  // 不合法（非數字、負值、人數非整數、百分比超出 0–100）回 NaN 並由呼叫端列出錯誤。
  const isBlank = (v) => v == null || String(v).trim() === '';
  function parseCount(v) {
    if (isBlank(v)) return NaN;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 ? n : NaN;
  }
  // 百分比 → 比例 0–1
  function parsePct(v) {
    if (isBlank(v)) return NaN;
    const n = Number(v);
    return n >= 0 && n <= 100 ? n / 100 : NaN;
  }
  const badInput = (v, parsed) => !isBlank(v) && Number.isNaN(parsed);

  // ── 顯示格式 ──
  const pct = (v) => isFinite(v) ? (v * 100).toFixed(1) + '%' : '—';
  // LR 或 odds 為 +∞（如 spec = 100%）時明確標示 ∞，不與「無法計算」的 — 混淆
  const num = (v, d = 2) => v === Infinity ? '∞' : isFinite(v) ? v.toFixed(d) : '—';

  // 比例的 Wilson score 95% CI
  function wilson(x, n) {
    if (n === 0) return [NaN, NaN];
    const p = x / n;
    const d = 1 + z * z / n;
    const c = p + z * z / (2 * n);
    const s = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));
    // 夾回 [0, 1]：x = 0 或 x = n 時理論端點恰為 0／1，浮點誤差會產生 -1e-17
    return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
  }

  // 零格時四格皆 +0.5（Haldane），供 LR 計算用
  function correctCounts(k) {
    let { tp, fp, fn, tn } = k;
    if (tp === 0 || fp === 0 || fn === 0 || tn === 0) {
      tp += 0.5; fp += 0.5; fn += 0.5; tn += 0.5;
    }
    return { tp, fp, fn, tn };
  }

  const NAN2 = () => [NaN, NaN];
  const emptyCounts = (errors) => ({
    mode: 'counts', total: NaN, prev: NaN, sens: NaN, spec: NaN, ppv: NaN, npv: NaN, acc: NaN,
    lrPos: NaN, lrNeg: NaN, sensCI: NAN2(), specCI: NAN2(), lrPosCI: NAN2(), lrNegCI: NAN2(), errors,
  });

  // ── 2×2 人數 → 指標 ──
  // 四格須皆為 ≥0 整數；任一格空白或不合法 → 全部指標為 NaN（顯示「—」）
  function fromCounts(raw) {
    const keys = ['tp', 'fp', 'fn', 'tn'];
    const v = {};
    const errors = [];
    keys.forEach((k) => {
      v[k] = parseCount(raw[k]);
      if (badInput(raw[k], v[k])) errors.push(`${k.toUpperCase()} 須為 ≥ 0 的整數`);
    });
    if (keys.some((k) => Number.isNaN(v[k]))) return emptyCounts(errors);
    const { tp, fp, fn, tn } = v;
    const total = tp + fp + fn + tn;
    const sens = tp / (tp + fn);
    const spec = tn / (tn + fp);
    const ppv  = tp / (tp + fp);
    const npv  = tn / (tn + fn);
    const acc  = (tp + tn) / total;
    const prev = (tp + fn) / total;
    // LR 是否有定義：須有有病者與無病者（整欄為 0 → sens 或 spec 無定義），
    // 且原式非 0/0（無人陽性 → LR+ 不定；無人陰性 → LR− 不定）。
    // 這些情形不以 +0.5 校正「補」出數值。
    if (tp + fn === 0) errors.push('TP + FN = 0（無有病者）：敏感度與 LR 無法計算');
    if (fp + tn === 0) errors.push('FP + TN = 0（無無病者）：特異度與 LR 無法計算');
    const cols = tp + fn > 0 && fp + tn > 0;
    const posOk = cols && tp + fp > 0;
    const negOk = cols && fn + tn > 0;
    const c = correctCounts({ tp, fp, fn, tn }); // 校正後避免除以 0
    const lrPos = posOk ? (c.tp / (c.tp + c.fn)) / (c.fp / (c.fp + c.tn)) : NaN;
    const lrNeg = negOk ? (c.fn / (c.tp + c.fn)) / (c.tn / (c.fp + c.tn)) : NaN;
    const sePos = Math.sqrt(1 / c.tp - 1 / (c.tp + c.fn) + 1 / c.fp - 1 / (c.fp + c.tn));
    const seNeg = Math.sqrt(1 / c.fn - 1 / (c.fn + c.tp) + 1 / c.tn - 1 / (c.tn + c.fp));
    return {
      mode: 'counts', total, prev, sens, spec, ppv, npv, acc, lrPos, lrNeg,
      sensCI: wilson(tp, tp + fn),
      specCI: wilson(tn, tn + fp),
      lrPosCI: [Math.exp(Math.log(lrPos) - z * sePos), Math.exp(Math.log(lrPos) + z * sePos)],
      lrNegCI: [Math.exp(Math.log(lrNeg) - z * seNeg), Math.exp(Math.log(lrNeg) + z * seNeg)],
      errors,
    };
  }

  // ── 直接輸入 sens/spec（百分比）→ LR±；PPV/NPV/CI 需原始人數，故為 NaN/null ──
  function fromSensSpec(sensPct, specPct) {
    const sens = parsePct(sensPct);
    const spec = parsePct(specPct);
    const errors = [];
    if (badInput(sensPct, sens)) errors.push('敏感度須介於 0–100%');
    if (badInput(specPct, spec)) errors.push('特異度須介於 0–100%');
    return {
      mode: 'ss', total: NaN, prev: NaN, sens, spec, ppv: NaN, npv: NaN, acc: NaN,
      lrPos: sens / (1 - spec),
      lrNeg: (1 - sens) / spec,
      sensCI: null, specCI: null, lrPosCI: null, lrNegCI: null,
      errors,
    };
  }

  // ── LR 白話強度說明（Jaeschke/Guyatt/Sackett JAMA 1994；McGee 2002）──
  // NaN（無法計算）→ —；+∞ 照門檻落在「強」(LR+) 或「異常」(LR−)
  function interpretPos(lr) {
    if (Number.isNaN(lr)) return { txt: '—', cls: 'muted' };
    if (lr < 1)   return { txt: '⚠ 異常：LR+ <1 表示陽性反而降低疾病可能，請檢查 2×2 方向', cls: 'warn' };
    if (lr < 2)   return { txt: '很弱：陽性結果幾乎不改變判斷', cls: 'muted' };
    if (lr < 5)   return { txt: '弱：小幅提高疾病可能，常需搭配其他證據', cls: 'muted' };
    if (lr < 10)  return { txt: '中等：明顯提高疾病可能', cls: 'good' };
    return { txt: '強：大幅提高疾病可能，足以 rule-in', cls: 'good' };
  }
  function interpretNeg(lr) {
    if (Number.isNaN(lr)) return { txt: '—', cls: 'muted' };
    if (lr > 1)    return { txt: '⚠ 異常：LR− >1 表示陰性反而提高疾病可能，請檢查 2×2 方向', cls: 'warn' };
    if (lr > 0.5)  return { txt: '很弱：陰性結果幾乎不改變判斷', cls: 'muted' };
    if (lr > 0.2)  return { txt: '弱：小幅降低疾病可能，常需搭配其他證據', cls: 'muted' };
    if (lr > 0.1)  return { txt: '中等：明顯降低疾病可能', cls: 'good' };
    return { txt: '強：大幅降低疾病可能，足以 rule-out', cls: 'good' };
  }

  // ── Bayes 更新：pre-test（百分比）× LR → post-test ──
  // 以 post = p·LR / (p·LR + 1 − p) 計算（與 odds 版等價），避免 p = 100% 或 LR = ∞
  // 時出現 ∞/∞。0·∞ 型（p = 0 且 LR = ∞；p = 100% 且 LR = 0）數學上不定 → NaN。
  const odds = (p) => p / (1 - p);
  function postProb(pPre, lr) {
    if (!(pPre >= 0 && pPre <= 1) || !(lr >= 0)) return NaN;
    if (lr === Infinity) return pPre > 0 ? 1 : NaN;
    if (lr === 0) return pPre < 1 ? 0 : NaN;
    const a = pPre * lr;
    return a / (a + 1 - pPre);
  }
  function bayes(pretestPct, lr) {
    const pPre = parsePct(pretestPct);
    const pPost = postProb(pPre, lr);
    const error = badInput(pretestPct, pPre) ? '檢驗前機率須介於 0–100%' : '';
    return { pPre, preOdds: odds(pPre), postOdds: odds(pPost), pPost, error };
  }

  // ── Fagan nomogram 幾何 ──
  // 數學基礎：logit(post) = logit(pre) + ln(LR)。
  // 左軸用「顛倒的 log-odds」、中軸 LR 放在水平中點且以 ½·ln(LR) 定位，
  // 兩端點連線必通過正確的 LR 刻度（幾何中點 = 兩端平均）。
  const NOMO = { W: 320, H: 430, top: 42, bot: 400, s: 26, xL: 60, xM: 160, xR: 260 };
  NOMO.C = (NOMO.top + NOMO.bot) / 2;
  const NOMO_P_MIN = 0.001, NOMO_P_MAX = 0.999;
  const logit = (p) => Math.log(p / (1 - p));
  const expit = (x) => 1 / (1 + Math.exp(-x));
  const nomoClamp = (p) => Math.min(NOMO_P_MAX, Math.max(NOMO_P_MIN, p));
  const leftY  = (p) => NOMO.C + NOMO.s * logit(nomoClamp(p));  // 顛倒
  const rightY = (p) => NOMO.C - NOMO.s * logit(nomoClamp(p));
  const lrY    = (v) => NOMO.C - (NOMO.s / 2) * Math.log(v);
  // 反函數（座標 → 機率 / LR），供測試驗證來回一致
  const probFromLeftY  = (y) => expit((y - NOMO.C) / NOMO.s);
  const probFromRightY = (y) => expit((NOMO.C - y) / NOMO.s);
  const lrFromY        = (y) => Math.exp((NOMO.C - y) / (NOMO.s / 2));

  // 連線三點的 y 座標；任一值非有限則不畫線（回傳 null）
  function nomoPoints(pPre, lr, pPost) {
    if (!(isFinite(pPre) && isFinite(pPost) && isFinite(lr))) return null;
    return { ay: leftY(pPre), my: lrY(lr), by: rightY(pPost) };
  }

  // ── 檢驗庫 ──
  const isPrognostic = (t) => /預後|mortality/i.test((t && t.target) || '');

  // 載入檢驗時要帶入的輸入值（百分比字串與結果方向）
  function presetFromTest(t) {
    return {
      mode: 'ss',
      sensPct: (t.sens * 100).toFixed(1),
      specPct: (t.spec * 100).toFixed(1),
      pretestPct: isFinite(t.pretestTypical) ? (t.pretestTypical * 100).toFixed(1) : null,
      result: t.category === 'rule-out' ? 'neg' : 'pos',
      prognostic: isPrognostic(t),
    };
  }

  // ── 白話結果總結 ──
  // s：fromCounts/fromSensSpec 的結果；b：bayes 結果加 useNeg；test：載入的檢驗或 null
  function summaryText(s, b, test) {
    const ip = interpretPos(s.lrPos), ineg = interpretNeg(s.lrNeg);
    const target = (test && test.target) || '目標疾病';
    const d = deltaParts(b.pPre, b.pPost);
    const dirWord = d.dir === 'up' ? '提高' : '降低';

    let verdict;
    if (!isFinite(b.pPost)) {
      verdict = '（請先輸入資料）';
    } else if (b.useNeg) {
      const strength = s.lrNeg <= 0.1 ? '屬強力排除證據' : s.lrNeg <= 0.2 ? '屬中等排除證據' : '排除力有限，須綜合其他資訊';
      verdict = `陰性結果（LR− ${num(s.lrNeg, 3)}）將「${target}」的可能性由 ${pct(b.pPre)} 降至 ${pct(b.pPost)}，${strength}。`;
    } else {
      const strength = s.lrPos >= 10 ? '屬強力支持診斷' : s.lrPos >= 5 ? '屬中等支持' : '支持力有限，須綜合其他資訊';
      verdict = `陽性結果（LR+ ${num(s.lrPos)}）將「${target}」的可能性由 ${pct(b.pPre)} 提高至 ${pct(b.pPost)}，${strength}。`;
    }

    const L = [];
    L.push('【診斷檢驗 EBM 結果摘要】');
    L.push('檢驗：' + (test ? `${test.nameZh}（${test.target}）` : '自訂輸入'));
    L.push(`敏感度 ${pct(s.sens)}、特異度 ${pct(s.spec)}`);
    L.push(`LR+ = ${num(s.lrPos)}（${ip.txt}）`);
    L.push(`LR− = ${num(s.lrNeg, 3)}（${ineg.txt}）`);
    L.push('');
    L.push(`貝氏更新（檢驗結果：${b.useNeg ? '陰性' : '陽性'}）`);
    L.push(`　檢驗前機率 ${pct(b.pPre)} → 檢驗後機率 ${pct(b.pPost)}` +
      (d.dir ? `（${dirWord} ${d.abs} 個百分點）` : ''));
    L.push('');
    L.push('判讀：' + verdict);
    if (test) L.push('來源：' + test.source);
    L.push('');
    L.push('※ 教學／實證練習用，非臨床決策依據。');
    return L.join('\n');
  }

  // Bayes 鏈下方的變化說明（純文字部分）
  // 無法計算時 dir 為空字串、abs 為 —
  function deltaParts(pPre, pPost) {
    const diff = (pPost - pPre) * 100;
    if (!isFinite(diff)) return { dir: '', arrow: '', abs: '—' };
    return { dir: diff >= 0 ? 'up' : 'down', arrow: diff >= 0 ? '▲' : '▼', abs: Math.abs(diff).toFixed(1) };
  }

  return {
    z, parseCount, parsePct, pct, num, wilson, correctCounts, fromCounts, fromSensSpec,
    interpretPos, interpretNeg, postProb, bayes, deltaParts,
    NOMO, logit, leftY, rightY, lrY, probFromLeftY, probFromRightY, lrFromY, nomoPoints,
    isPrognostic, presetFromTest, summaryText,
  };
});
