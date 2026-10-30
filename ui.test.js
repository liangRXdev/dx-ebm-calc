/* dx-ebm-calc UI 黏合層測試（純 Node，無外部依賴）
 * 執行：node ui.test.js
 * 以極簡假 DOM 在 vm 中執行 index.html 的 <script>（含 engine.js），
 * 驗證事件串接後的畫面狀態：載入檢驗、切換模式、清除全部是否殘留舊值；
 * 並以隨機輸入檢查所有輸出區塊不出現 NaN／Infinity、nomogram 不出界。
 * 只模擬本頁用到的 DOM API；改 index.html 用到新 API 時需同步補上。
 */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

let pass = 0, fail = 0;
function eq(name, got, want) {
  const ok = Object.is(got, want);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
  ok ? pass++ : fail++;
}

// ── 假 DOM ──
function makeApp() {
  const dir = __dirname;
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const els = {}, listeners = {};
  const defaults = {};
  for (const m of html.matchAll(/<input id="([^"]+)"[^>]*value="([^"]*)"/g)) defaults[m[1]] = m[2];
  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    const id = m[1];
    els[id] = {
      id, value: defaults[id] ?? (id === 'resultSel' ? 'pos' : ''), innerHTML: '', textContent: '',
      style: { display: /id="[^"]+"[^>]*style="display:none/.test(html.slice(m.index, m.index + 120)) ? 'none' : '' },
      addEventListener: (ev, fn) => { (listeners[id + ':' + ev] = listeners[id + ':' + ev] || []).push(fn); },
      querySelectorAll: () => [], insertAdjacentHTML() {}, classList: { add() {}, toggle() {} },
    };
  }
  let mode = 'counts';
  const radios = ['counts', 'ss'].map((v) => ({
    value: v,
    get checked() { return mode === v; }, set checked(x) { if (x) mode = v; },
    addEventListener: (ev, fn) => { (listeners['mode:' + ev] = listeners['mode:' + ev] || []).push(fn); },
  }));
  const document = {
    getElementById: (id) => els[id],
    querySelector: (sel) => sel.includes(':checked')
      ? radios.find((r) => r.checked)
      : radios.find((r) => sel.includes(`value=${r.value}`)),
    querySelectorAll: (sel) => (sel.includes('name=mode') ? radios : []),
    createElement: () => ({ style: {}, focus() {}, select() {} }),
    body: { appendChild() {}, removeChild() {} },
    execCommand: () => false,
  };
  const testsJson = JSON.parse(fs.readFileSync(path.join(dir, 'tests.json'), 'utf8'));
  const ctx = {
    document, navigator: {}, setTimeout, clearTimeout, console,
    fetch: () => Promise.resolve({ json: () => testsJson }),
  };
  ctx.window = Object.assign({ addEventListener() {} }, ctx);
  ctx.self = ctx.window;
  vm.createContext(ctx);
  const re = /<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    vm.runInContext(m[1] ? fs.readFileSync(path.join(dir, m[1]), 'utf8') : m[2], ctx); // engine.js 的 UMD 掛在 self（= window）
  }
  const fire = (key) => (listeners[key] || []).forEach((f) => f.call(els[key.split(':')[0]]));
  return {
    els, testsJson,
    mode: () => mode,
    setMode(v) { mode = v; fire('mode:change'); },
    set(id, v) { els[id].value = String(v); fire(id + ':input'); fire(id + ':change'); },
    click(id) { fire(id + ':click'); },
    out: () => ['results', 'chain', 'delta', 'nomo'].map((k) => els[k].innerHTML).join('\n') + '\n' + els.summary.textContent,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

(async () => {
  // ── U1. 載入檢驗：rule-out 選陰性、帶入 pretestTypical、預後類標示 ──
  {
    const A = makeApp(); await tick();
    const T = A.testsJson.tests;
    const iOttawa = T.findIndex((t) => t.id === 'ottawa-ankle');
    A.set('testLoader', iOttawa);
    eq('U1 Ottawa 切到 sens/spec 模式', A.mode(), 'ss');
    eq('U1 Ottawa 結果＝陰性', A.els.resultSel.value, 'neg');
    eq('U1 Ottawa pretest', A.els.pretest.value, '15.0');
    eq('U1 Ottawa sens', A.els.sensIn.value, '97.6');
    eq('U1 總結標示檢驗', A.els.summary.textContent.includes('渥太華腳踝規則'), true);
    A.set('testLoader', T.findIndex((t) => t.id === 'radt-gas'));
    eq('U1 RADT 結果＝陽性', A.els.resultSel.value, 'pos');
    A.set('testLoader', T.findIndex((t) => t.id === 'lactate-sepsis-mortality'));
    eq('U1 Lactate 資訊卡標預後', A.els.testInfo.innerHTML.includes('預後／非診斷'), true);
    eq('U1 Lactate 總結含預後字樣', A.els.summary.textContent.includes('預後'), true);
  }

  // ── U2. 載入檢驗後切回 2×2 模式：不得沿用檢驗名稱與出處 ──
  // 重現（修正前）：載入 Ottawa → 切「2×2 人數」→ 畫面改用 2×2 的 80/30/20/70 計算，
  // 但資訊卡仍顯示 Ottawa，總結寫「檢驗：渥太華腳踝規則」並附 Ottawa 出處
  {
    const A = makeApp(); await tick();
    A.set('testLoader', 0);
    A.setMode('counts');
    eq('U2 總結不再掛檢驗名', A.els.summary.textContent.includes('渥太華'), false);
    eq('U2 總結不附出處', A.els.summary.textContent.includes('來源：'), false);
    eq('U2 資訊卡隱藏', A.els.testInfo.style.display, 'none');
    eq('U2 選單回到手動', A.els.testLoader.value, '');
    // 切回 sens/spec 模式本身不應改變已載入的檢驗
    A.set('testLoader', 0);
    A.setMode('ss');
    eq('U2 ss→ss 保留檢驗', A.els.summary.textContent.includes('渥太華'), true);
  }

  // ── U3. 清除全部：無殘留數值、無 NaN ──
  {
    const A = makeApp(); await tick();
    A.set('testLoader', 0);
    A.click('clearAllBtn');
    const s = A.els.summary.textContent;
    eq('U3 回到 2×2 模式', A.mode(), 'counts');
    eq('U3 總結＝請先輸入', s.includes('（請先輸入資料）'), true);
    eq('U3 總結 LR+ —', s.includes('LR+ = —'), true);
    eq('U3 無 NaN', /NaN|Infinity/.test(A.out()), false);
    eq('U3 nomogram 無連線', A.els.nomo.innerHTML.includes('<circle'), false);
  }

  // ── U4. 隨機輸入：任何輸出區塊不出現 NaN／Infinity，nomogram 座標在圖內 ──
  {
    const A = makeApp(); await tick();
    const vals = ['', '0', '1', '5', '20', '80', '100', '-3', '2.5', 'abc', '1e3', '99.9', '150', '0.1'];
    let seed = 11;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    let bad = 0, outOfBox = 0, n = 0;
    for (let i = 0; i < 3000; i++) {
      const act = Math.floor(rnd() * 9);
      if (act < 4) A.set(pick(['tp', 'fp', 'fn', 'tn']), pick(vals));
      else if (act === 4) A.set(pick(['sensIn', 'specIn', 'pretest']), pick(vals));
      else if (act === 5) A.setMode(pick(['counts', 'ss']));
      else if (act === 6) A.set('resultSel', pick(['pos', 'neg']));
      else if (act === 7) A.set('testLoader', pick(['', '0', '4', '9', '10']));
      else A.click(pick(['loadExample', 'clearBtn', 'clearAllBtn', 'usePrev']));
      n++;
      if (/NaN|Infinity|undefined/.test(A.out())) bad++;
      const svg = A.els.nomo.innerHTML;
      for (const c of svg.matchAll(/<(?:circle|line)[^>]*?(?:cy|y1|y2)="([^"]+)"/g)) {
        const y = Number(c[1]);
        if (!(y >= 0 && y <= 430)) { outOfBox++; break; }
      }
    }
    eq(`U4 ${n} 次操作無 NaN/Infinity`, bad, 0);
    eq(`U4 ${n} 次操作 nomogram 不出界`, outOfBox, 0);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
