/* dx-ebm-calc 引擎測試（純 Node，無外部依賴）
 * 執行：node engine.test.js
 * A 段為 characterization（鎖住抽出前 index.html 行內程式 @9a6c4fe 的輸出）；
 * B 段起為教科書／手算值，期望值註明來源。容差 tol。
 */
const E = require('./engine.js');

let pass = 0, fail = 0;
function approx(name, got, want, tol) {
  tol = tol == null ? 1e-3 : tol;
  const ok = Math.abs(got - want) <= tol;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${fmt(got)} want=${fmt(want)}`);
  ok ? pass++ : fail++;
}
function eq(name, got, want) {
  const ok = Object.is(got, want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${show(got, ok)} want=${show(want, ok)}`);
  ok ? pass++ : fail++;
}
// 長字串（白話總結）通過時只印開頭，失敗時印完整 JSON 以便比對
function show(x, ok) {
  if (typeof x !== 'string') return String(x);
  return ok && x.length > 40 ? JSON.stringify(x.slice(0, 40)) + '…' : JSON.stringify(x);
}
function fmt(x) { return typeof x === 'number' ? (isFinite(x) ? x.toFixed(4) : String(x)) : String(x); }

// ══ A. Characterization：抽出前行內程式的輸出（@9a6c4fe 實跑取得）══

// ── A1. 預設範例 2×2：TP 80 / FP 30 / FN 20 / TN 70 ──
(() => {
  const r = E.fromCounts({ tp: '80', fp: '30', fn: '20', tn: '70' });
  eq('A1 total', r.total, 200);
  approx('A1 prev', r.prev, 0.5, 1e-9);
  approx('A1 sens', r.sens, 0.8, 1e-9);
  approx('A1 spec', r.spec, 0.7, 1e-9);
  approx('A1 PPV', r.ppv, 0.727273, 1e-6);
  approx('A1 NPV', r.npv, 0.777778, 1e-6);
  approx('A1 acc', r.acc, 0.75, 1e-9);
  approx('A1 LR+', r.lrPos, 2.666667, 1e-6);
  approx('A1 LR−', r.lrNeg, 0.285714, 1e-6);
  approx('A1 sens CI lo', r.sensCI[0], 0.711169, 1e-6);
  approx('A1 sens CI hi', r.sensCI[1], 0.866634, 1e-6);
  approx('A1 spec CI lo', r.specCI[0], 0.604150, 1e-6);
  approx('A1 spec CI hi', r.specCI[1], 0.781052, 1e-6);
  approx('A1 LR+ CI lo', r.lrPosCI[0], 1.946053, 1e-6);
  approx('A1 LR+ CI hi', r.lrPosCI[1], 3.654120, 1e-6);
  approx('A1 LR− CI lo', r.lrNegCI[0], 0.189147, 1e-6);
  approx('A1 LR− CI hi', r.lrNegCI[1], 0.431582, 1e-6);
})();

// ── A2. 預設範例的 Bayes 與白話總結（逐字鎖定）──
(() => {
  const r = E.fromCounts({ tp: 80, fp: 30, fn: 20, tn: 70 });
  const b = E.bayes('30', r.lrPos);
  approx('A2 preOdds', b.preOdds, 0.428571, 1e-6);
  approx('A2 postOdds', b.postOdds, 1.142857, 1e-6);
  approx('A2 pPost', b.pPost, 0.533333, 1e-6);
  eq('A2 summary', E.summaryText(r, Object.assign({ useNeg: false }, b), null),
    '【診斷檢驗 EBM 結果摘要】\n檢驗：自訂輸入\n敏感度 80.0%、特異度 70.0%\n' +
    'LR+ = 2.67（弱：小幅提高疾病可能，常需搭配其他證據）\n' +
    'LR− = 0.286（弱：小幅降低疾病可能，常需搭配其他證據）\n\n' +
    '貝氏更新（檢驗結果：陽性）\n　檢驗前機率 30.0% → 檢驗後機率 53.3%（提高 23.3 個百分點）\n\n' +
    '判讀：陽性結果（LR+ 2.67）將「目標疾病」的可能性由 30.0% 提高至 53.3%，支持力有限，須綜合其他資訊。\n\n' +
    '※ 教學／實證練習用，非臨床決策依據。');
})();

// ── A3. 單一零格（FP=0 → spec 100%）：四格 +0.5 後 LR 仍為有限值 ──
(() => {
  const r = E.fromCounts({ tp: 10, fp: 0, fn: 5, tn: 20 });
  approx('A3 spec', r.spec, 1, 1e-12);
  approx('A3 LR+ (校正後)', r.lrPos, 27.5625, 1e-4);
  approx('A3 LR− (校正後)', r.lrNeg, 0.352134, 1e-6);
  approx('A3 LR+ CI lo', r.lrPosCI[0], 1.741817, 1e-6);
  approx('A3 LR+ CI hi', r.lrPosCI[1], 436.148817, 1e-5);
})();

// ── A4. 直接輸入 sens/spec ──
(() => {
  const r = E.fromSensSpec('80', '70');
  approx('A4 LR+', r.lrPos, 2.666667, 1e-6);
  approx('A4 LR−', r.lrNeg, 0.285714, 1e-6);
  eq('A4 PPV 無', r.ppv, NaN);
  eq('A4 NPV 無', r.npv, NaN);
  eq('A4 prev 無', r.prev, NaN);
  eq('A4 sens CI 無', r.sensCI, null);
  eq('A4 LR+ CI 無', r.lrPosCI, null);
})();

// ── A5. 載入檢驗：rule-out → 陰性、其餘 → 陽性；帶入 pretestTypical ──
(() => {
  const T = require('./tests.json').tests;
  const by = (id) => T.find((t) => t.id === id);
  const o = E.presetFromTest(by('ottawa-ankle'));
  eq('A5 Ottawa result', o.result, 'neg');
  eq('A5 Ottawa sens', o.sensPct, '97.6');
  eq('A5 Ottawa spec', o.specPct, '31.5');
  eq('A5 Ottawa pretest', o.pretestPct, '15.0');
  eq('A5 D-dimer result', E.presetFromTest(by('ddimer-pe')).result, 'neg');
  eq('A5 RADT result', E.presetFromTest(by('radt-gas')).result, 'pos');
  eq('A5 BNP result', E.presetFromTest(by('bnp-hf')).result, 'pos');
  const lac = E.presetFromTest(by('lactate-sepsis-mortality'));
  eq('A5 Lactate 預後', lac.prognostic, true);
  eq('A5 Lactate result', lac.result, 'pos');
  eq('A5 Lactate pretest', lac.pretestPct, '30.0');
  eq('A5 預後只有 Lactate', T.filter(E.isPrognostic).map((t) => t.id).join(), 'lactate-sepsis-mortality');
  T.forEach((t) => eq(`A5 ${t.id} result`, E.presetFromTest(t).result, t.category === 'rule-out' ? 'neg' : 'pos'));
})();

// ── A6. LR 白話分級門檻（Jaeschke 1994 / McGee 2002；與 index.html 原文案一致）──
(() => {
  eq('A6 LR+ 10 強', E.interpretPos(10).txt.slice(0, 1), '強');
  eq('A6 LR+ 9.99 中', E.interpretPos(9.99).txt.slice(0, 2), '中等');
  eq('A6 LR+ 5 中', E.interpretPos(5).txt.slice(0, 2), '中等');
  eq('A6 LR+ 4.99 弱', E.interpretPos(4.99).txt.slice(0, 1), '弱');
  eq('A6 LR+ 2 弱', E.interpretPos(2).txt.slice(0, 1), '弱');
  eq('A6 LR+ 1.99 很弱', E.interpretPos(1.99).txt.slice(0, 2), '很弱');
  eq('A6 LR+ 0.9 異常', E.interpretPos(0.9).cls, 'warn');
  eq('A6 LR− 0.1 強', E.interpretNeg(0.1).txt.slice(0, 1), '強');
  eq('A6 LR− 0.11 中', E.interpretNeg(0.11).txt.slice(0, 2), '中等');
  eq('A6 LR− 0.2 中', E.interpretNeg(0.2).txt.slice(0, 2), '中等');
  eq('A6 LR− 0.21 弱', E.interpretNeg(0.21).txt.slice(0, 1), '弱');
  eq('A6 LR− 0.5 弱', E.interpretNeg(0.5).txt.slice(0, 1), '弱');
  eq('A6 LR− 0.51 很弱', E.interpretNeg(0.51).txt.slice(0, 2), '很弱');
  eq('A6 LR− 1.1 異常', E.interpretNeg(1.1).cls, 'warn');
})();

// ══ B. 教科書／手算 ══

// ── B1. Altman & Bland, BMJ 1994;308:1552 / 309:102（肝掃描 vs 病理）──
// 異常掃描：病理異常 231、正常 32；正常掃描：病理異常 27、正常 54
// 原文：sens 231/258 = 0.895、spec 54/86 = 0.628、PPV 231/263 = 0.878、NPV 54/81 = 0.667
// 手算：LR+ = 0.8953/(1−0.6279) = 2.406；LR− = (1−0.8953)/0.6279 = 0.1667
// Simel log 法：SE(lnLR+) = √(1/231 − 1/258 + 1/32 − 1/86) = 0.14169 → 1.823–3.176
//               SE(lnLR−) = √(1/27 − 1/258 + 1/54 − 1/86) = 0.20055 → 0.1126–0.2467
(() => {
  const r = E.fromCounts({ tp: 231, fp: 32, fn: 27, tn: 54 });
  approx('B1 sens', r.sens, 0.895, 5e-4);
  approx('B1 spec', r.spec, 0.628, 5e-4);
  approx('B1 PPV', r.ppv, 0.878, 5e-4);
  approx('B1 NPV', r.npv, 0.667, 5e-4);
  approx('B1 LR+', r.lrPos, 2.406, 5e-4);
  approx('B1 LR−', r.lrNeg, 0.1667, 1e-4);
  approx('B1 LR+ CI lo', r.lrPosCI[0], 1.823, 1e-3);
  approx('B1 LR+ CI hi', r.lrPosCI[1], 3.176, 1e-3);
  approx('B1 LR− CI lo', r.lrNegCI[0], 0.1126, 1e-4);
  approx('B1 LR− CI hi', r.lrNegCI[1], 0.2467, 1e-4);
})();

// ── B2. Wilson score：Newcombe, Stat Med 1998;17:857, Table I（method 3）──
// 81/263 → 0.2553–0.3662；15/148 → 0.0624–0.1605；1/29 → 0.0061–0.1718
(() => {
  const a = E.wilson(81, 263), b = E.wilson(15, 148), c = E.wilson(1, 29);
  approx('B2 81/263 lo', a[0], 0.2553, 1e-4);
  approx('B2 81/263 hi', a[1], 0.3662, 1e-4);
  approx('B2 15/148 lo', b[0], 0.0624, 1e-4);
  approx('B2 15/148 hi', b[1], 0.1605, 1e-4);
  approx('B2 1/29 lo', c[0], 0.0061, 1e-4);
  approx('B2 1/29 hi', c[1], 0.1718, 1e-4);
})();

// ── B3. LR 由 sens/spec 推算（Deeks & Altman BMJ 2004 公式）──
// sens 0.90 / spec 0.95 → LR+ = 0.90/0.05 = 18；LR− = 0.10/0.95 = 0.10526
(() => {
  const r = E.fromSensSpec('90', '95');
  approx('B3 LR+', r.lrPos, 18, 1e-9);
  approx('B3 LR−', r.lrNeg, 0.105263, 1e-6);
})();

// ── B4. 勝算版 Bayes（手算）──
// pre 40%：odds 0.6667 × LR 10 = 6.667 → post 6.667/7.667 = 0.8696
// pre 40%：odds 0.6667 × LR 0.1 = 0.06667 → post 0.0625
(() => {
  const up = E.bayes('40', 10), dn = E.bayes('40', 0.1);
  approx('B4 preOdds', up.preOdds, 0.666667, 1e-6);
  approx('B4 post (LR 10)', up.pPost, 0.869565, 1e-6);
  approx('B4 post (LR 0.1)', dn.pPost, 0.0625, 1e-9);
})();

// ── B5. pre → post → pre 來回一致（post 再乘 1/LR 應回到 pre）──
(() => {
  [0.01, 0.2, 0.5, 0.83, 0.99].forEach((p) => [0.05, 0.4, 1, 3.7, 25].forEach((lr) => {
    const post = E.bayes(String(p * 100), lr).pPost;
    const back = E.bayes(String(post * 100), 1 / lr).pPost;
    approx(`B5 roundtrip p=${p} LR=${lr}`, back, p, 1e-9);
  }));
})();

// ── B6. Fagan nomogram 幾何：機率 ↔ 座標來回一致、三點共線 ──
(() => {
  const N = E.NOMO;
  approx('B6 C', N.C, 221, 1e-12);
  approx('B6 leftY(50%) = 中線', E.leftY(0.5), N.C, 1e-12);
  approx('B6 rightY(50%) = 中線', E.rightY(0.5), N.C, 1e-12);
  approx('B6 lrY(1) = 中線', E.lrY(1), N.C, 1e-12);
  // 左軸顛倒：機率愈高 y 愈大（愈下方）；右軸相反
  eq('B6 左軸顛倒', E.leftY(0.9) > E.leftY(0.1), true);
  eq('B6 右軸正向', E.rightY(0.9) < E.rightY(0.1), true);
  [0.005, 0.1, 0.3, 0.7, 0.95].forEach((p) => {
    approx(`B6 左軸來回 p=${p}`, E.probFromLeftY(E.leftY(p)), p, 1e-12);
    approx(`B6 右軸來回 p=${p}`, E.probFromRightY(E.rightY(p)), p, 1e-12);
  });
  [0.01, 0.2, 1, 5, 100].forEach((v) => approx(`B6 LR 軸來回 ${v}`, E.lrFromY(E.lrY(v)), v, 1e-9));
  // 共線：xM 為 xL、xR 中點，故 LR 點的 y 必為兩端 y 的平均
  [[0.3, 2.67], [0.15, 0.08], [0.6, 12], [0.02, 0.5]].forEach(([p, lr]) => {
    const post = E.bayes(String(p * 100), lr).pPost;
    const pts = E.nomoPoints(p, lr, post);
    approx(`B6 共線 p=${p} LR=${lr}`, pts.my, (pts.ay + pts.by) / 2, 1e-9);
  });
  // 刻度範圍（0.1%–99.9%、LR 0.001–1000）落在軸上
  [0.001, 1000].forEach((v) => eq(`B6 LR 刻度 ${v} 在軸內`, E.lrY(v) >= N.top && E.lrY(v) <= N.bot, true));
})();

// ══ C. 極端值（每段對應一個修正；拿掉修正會紅）══

// ── C1. LR = ∞／0 與 pre-test 0%／100% ──
// sens = spec = 100% → LR+ = 1/0 = ∞、LR− = 0；post = p·LR/(p·LR + 1 − p) 的極限
(() => {
  const r = E.fromSensSpec('100', '100');
  eq('C1 LR+ = ∞', r.lrPos, Infinity);
  eq('C1 LR− = 0', r.lrNeg, 0);
  eq('C1 num(∞) 標示 ∞', E.num(Infinity), '∞');
  eq('C1 LR+ ∞ 分級＝強', E.interpretPos(Infinity).txt.slice(0, 1), '強');
  eq('C1 LR− ∞ 分級＝異常', E.interpretNeg(Infinity).cls, 'warn');
  eq('C1 pre 30% × ∞ → 100%', E.bayes('30', Infinity).pPost, 1);
  eq('C1 pre 0% × ∞ → 不定', E.bayes('0', Infinity).pPost, NaN);
  eq('C1 pre 100% × 2 → 100%', E.bayes('100', 2).pPost, 1);
  eq('C1 pre 100% odds = ∞', E.bayes('100', 2).preOdds, Infinity);
  eq('C1 pre 0% × 2 → 0%', E.bayes('0', 2).pPost, 0);
  eq('C1 pre 30% × 0 → 0%', E.bayes('30', 0).pPost, 0);
  eq('C1 pre 100% × 0 → 不定', E.bayes('100', 0).pPost, NaN);
  const d = E.deltaParts(NaN, 0.3);
  eq('C1 delta 不定 → —', d.abs, '—');
  const b = Object.assign({ useNeg: false }, E.bayes('30', r.lrPos));
  const txt = E.summaryText(r, b, null);
  eq('C1 總結無 NaN', /NaN|Infinity/.test(txt), false);
  eq('C1 總結標示 LR+ ∞', txt.includes('LR+ = ∞'), true);
  eq('C1 總結 post 100%', txt.includes('檢驗後機率 100.0%'), true);
})();

// ── C2. 輸入驗證：空白、負值、小數、非數字、百分比超出 0–100 ──
// 重現（修正前）：清除全部後四格空白 → 被當 0、+0.5 校正後顯示 LR± = 1.00（CI 0.06–15.99）；
// TP = −5 → sens 166.7%、LR− −0.889 卻分級為「強：rule-out」；sens 150% → LR− −0.714 亦同
(() => {
  const blank = E.fromCounts({ tp: '', fp: '', fn: '', tn: '' });
  eq('C2 全空白 LR+ —', blank.lrPos, NaN);
  eq('C2 全空白 LR− —', blank.lrNeg, NaN);
  eq('C2 全空白 LR+ CI —', blank.lrPosCI[0], NaN);
  eq('C2 全空白 不算錯誤', blank.errors.length, 0);
  const oneBlank = E.fromCounts({ tp: '80', fp: '30', fn: '', tn: '70' });
  eq('C2 單格空白 sens —', oneBlank.sens, NaN);
  eq('C2 單格空白 LR+ —', oneBlank.lrPos, NaN);
  const neg = E.fromCounts({ tp: '-5', fp: '3', fn: '2', tn: '9' });
  eq('C2 負值 sens —', neg.sens, NaN);
  eq('C2 負值 LR− —', neg.lrNeg, NaN);
  eq('C2 負值 錯誤訊息', neg.errors.some((m) => m.includes('TP')), true);
  const dec = E.fromCounts({ tp: '2.5', fp: '3', fn: '2', tn: '9' });
  eq('C2 小數人數 LR+ —', dec.lrPos, NaN);
  eq('C2 小數人數 錯誤訊息', dec.errors.some((m) => m.includes('TP')), true);
  eq('C2 非數字 —', E.fromCounts({ tp: 'abc', fp: 3, fn: 2, tn: 9 }).sens, NaN);
  eq('C2 0 為合法', E.fromCounts({ tp: '0', fp: '3', fn: '2', tn: '9' }).sens, 0);
  eq('C2 數字型別仍可用', E.fromCounts({ tp: 80, fp: 30, fn: 20, tn: 70 }).sens, 0.8);

  const over = E.fromSensSpec('150', '70');
  eq('C2 sens 150% LR− —', over.lrNeg, NaN);
  eq('C2 sens 150% 錯誤訊息', over.errors.some((m) => m.includes('敏感度')), true);
  eq('C2 sens −10% LR+ —', E.fromSensSpec('-10', '70').lrPos, NaN);
  eq('C2 spec 101% LR+ —', E.fromSensSpec('80', '101').lrPos, NaN);
  const ssBlank = E.fromSensSpec('', '70');
  eq('C2 sens 空白 LR+ —', ssBlank.lrPos, NaN);
  eq('C2 sens 空白 不算錯誤', ssBlank.errors.length, 0);
  eq('C2 sens 0% 合法', E.fromSensSpec('0', '70').lrPos, 0);

  eq('C2 pre-test 空白 → —', E.bayes('', 2).pPost, NaN);
  eq('C2 pre-test 150% → —', E.bayes('150', 2).pPost, NaN);
  eq('C2 pre-test −1% → —', E.bayes('-1', 2).pPost, NaN);
  eq('C2 pre-test 150% 錯誤訊息', /檢驗前機率/.test(E.bayes('150', 2).error), true);
  eq('C2 pre-test 空白 不算錯誤', E.bayes('', 2).error, '');
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
