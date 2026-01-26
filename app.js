const KEY = "hao_baccarat_c6_percent_last20_v1";

let history = load() || []; // {x:'B'|'P'|'T', t:number}

function save() {
  localStorage.setItem(KEY, JSON.stringify(history));
}
function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

function lastN(arr, n) {
  return arr.slice(Math.max(0, arr.length - n));
}
function pct(n, d) {
  if (!d) return "-";
  return (n * 100 / d).toFixed(0) + "%";
}
function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function addResult(x) {
  if (!['B','P','T'].includes(x)) return;
  history.push({ x, t: Date.now() });
  save();
  render();
}
function undo() {
  history.pop();
  save();
  render();
}
function resetAll() {
  if (!confirm("Reset toàn bộ lịch sử?")) return;
  history = [];
  save();
  render();
}

/** ======= ANALYTICS: “AI đứng giữa đưa %” (Last 20) ======= **/

function count(arr) {
  let B=0,P=0,T=0;
  for (const it of arr) {
    if (it.x === 'B') B++;
    else if (it.x === 'P') P++;
    else if (it.x === 'T') T++;
  }
  return {B,P,T,total:arr.length, bpTotal:B+P};
}

function bpSeq(arr) {
  return arr.filter(it => it.x==='B' || it.x==='P').map(it => it.x);
}

function alternationRate(bp) {
  if (bp.length < 2) return 0;
  let alt = 0;
  for (let i=1;i<bp.length;i++) if (bp[i] !== bp[i-1]) alt++;
  return alt / (bp.length - 1); // 0..1
}

function entropyBP(bp) {
  // Shannon entropy, max 1 when 50/50
  if (!bp.length) return 0;
  const n = bp.length;
  const b = bp.filter(x=>x==='B').length / n;
  const p = 1 - b;
  const H = (q)=> (q<=0 ? 0 : -q*Math.log2(q));
  return H(b) + H(p); // 0..1
}

function streakLen(bp) {
  if (!bp.length) return 0;
  let s = 1;
  for (let i=bp.length-1;i>0;i--) {
    if (bp[i] === bp[i-1]) s++;
    else break;
  }
  return s;
}

function computeLast20() {
  const h20 = lastN(history, 20);
  const c20 = count(h20);
  const bp20 = bpSeq(h20);

  // % theo B/P (bỏ tie)
  const bPct = c20.bpTotal ? (c20.B * 100 / c20.bpTotal) : 0;
  const pPct = c20.bpTotal ? (c20.P * 100 / c20.bpTotal) : 0;

  // tie %
  const tPct = c20.total ? (c20.T * 100 / c20.total) : 0;

  // EDGE = chênh lệch tuyệt đối giữa B% và P% (theo B/P)
  const edge = Math.abs(bPct - pPct);

  // NOISE: combo (đảo nhịp + entropy cao + tie cao)
  const alt = alternationRate(bp20);         // 0..1
  const ent = entropyBP(bp20);               // 0..1 (1 = rất cân bằng)
  const tie = c20.total ? (c20.T / c20.total) : 0; // 0..1

  // noise scale 0..100
  let noise = 0;
  noise += 45 * alt;                         // đảo nhiều => nhiễu
  noise += 35 * ent;                         // cân 50/50 => nhiễu
  noise += 20 * Math.min(1, tie/0.25);       // tie >25% => rất nhiễu
  noise = clamp(Math.round(noise), 0, 100);

  // CONFIDENCE: mạnh khi edge cao và noise thấp, có phạt “streak cuối bệt”
  const st = streakLen(bp20);                // streak gần nhất
  let conf = 50;
  conf += clamp(edge, 0, 30) * 1.2;          // edge tối đa tính 30%
  conf -= noise * 0.8;                       // noise kéo xuống mạnh
  if (st >= 6) conf -= 10;                   // cuối bệt -> rủi ro đảo
  if (c20.total < 12) conf -= 8;             // dữ liệu ít
  conf = clamp(Math.round(conf), 0, 100);

  return { c20, bPct, pPct, tPct, edge, noise, conf, alt, ent, st };// Hào Baccarat — B (Rhythm Engine PRO)
// Ghi lịch sử + đọc nhịp (Last20 / Entropy / Noise / Phase)
// localStorage + Export/Import
// (Tool quan sát, không phải "dự đoán chắc")

const KEY = "hao_baccarat_B_v1";

const $ = (id) => document.getElementById(id);

const state = loadState() ?? {
  shoeId: 1,
  results: [],        // 'B' | 'P' | 'T'
  journal: ""
};

bindUI();
renderAll();

// ---------- UI bindings ----------
function bindUI(){
  $("btnB").addEventListener("click", () => add("B"));
  $("btnP").addEventListener("click", () => add("P"));
  $("btnT").addEventListener("click", () => add("T"));
  $("btnU").addEventListener("click", undo);
  $("btnR").addEventListener("click", resetAll);
  $("btnNew").addEventListener("click", newShoe);

  $("btnExport").addEventListener("click", doExport);
  $("fileImport").addEventListener("change", doImport);
  $("btnClear").addEventListener("click", clearStorage);

  $("historyLimit").addEventListener("change", renderHistory);

  $("journal").addEventListener("input", (e) => {
    state.journal = e.target.value || "";
    saveState();
  });

  // Tabs
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const t = btn.dataset.tab;
      ["history","notes","help"].forEach(name => {
        $("tab-" + name).classList.toggle("hide", name !== t);
      });
    });
  });

  // Keyboard (PC)
  window.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    if (k === "b") add("B");
    if (k === "p") add("P");
    if (k === "t") add("T");
    if (k === "z") undo();
  });
}

// ---------- Core actions ----------
function add(x){
  state.results.push(x);
  saveState();
  renderAll();
}

function undo(){
  if (!state.results.length) return;
  state.results.pop();
  saveState();
  renderAll();
}

function resetAll(){
  if (!confirm("Reset toàn bộ ván trong shoe hiện tại?")) return;
  state.results = [];
  saveState();
  renderAll();
}

function newShoe(){
  if (state.results.length && !confirm("Tạo shoe mới? (Shoe hiện tại sẽ được reset)")) return;
  state.shoeId = (state.shoeId || 1) + 1;
  state.results = [];
  saveState();
  renderAll();
}

// ---------- Metrics ----------
function counts(arr){
  let b=0,p=0,t=0;
  for (const x of arr){
    if (x==="B") b++;
    else if (x==="P") p++;
    else if (x==="T") t++;
  }
  return {b,p,t,total:arr.length};
}

function bpOnly(arr){
  return arr.filter(x => x==="B" || x==="P");
}

function lastN(arr, n){
  return arr.slice(Math.max(0, arr.length - n));
}

function pct(num, den){
  if (!den) return 0;
  return Math.round((num/den)*100);
}

function entropyBP(bpArr){
  // Normalized entropy of B/P distribution: 0..1 => 0..100%
  // H = -sum p log2 p, max=1 when p=0.5
  const c = counts(bpArr);
  const n = c.b + c.p;
  if (n <= 0) return 0;
  const pB = c.b / n;
  const pP = c.p / n;
  let H = 0;
  if (pB > 0) H += -pB * Math.log2(pB);
  if (pP > 0) H += -pP * Math.log2(pP);
  // max is 1 for 2 outcomes
  return Math.round((H / 1) * 100);
}

function alternationRate(bpArr){
  // % đổi nhịp trong chuỗi B/P (0..100)
  if (bpArr.length <= 1) return 0;
  let changes = 0;
  for (let i=1;i<bpArr.length;i++){
    if (bpArr[i] !== bpArr[i-1]) changes++;
  }
  return Math.round((changes / (bpArr.length - 1)) * 100);
}

function streakInfo(bpArr){
  // current streak and longest streak in B/P
  if (!bpArr.length) return {curSide:"-",curLen:0,longSide:"-",longLen:0};

  // current
  let curSide = bpArr[bpArr.length-1];
  let curLen = 1;
  for (let i=bpArr.length-2;i>=0;i--){
    if (bpArr[i] === curSide) curLen++;
    else break;
  }

  // longest
  let longLen = 1, longSide = bpArr[0];
  let runLen = 1, runSide = bpArr[0];
  for (let i=1;i<bpArr.length;i++){
    if (bpArr[i] === runSide) runLen++;
    else {
      if (runLen > longLen){ longLen = runLen; longSide = runSide; }
      runSide = bpArr[i];
      runLen = 1;
    }
  }
  if (runLen > longLen){ longLen = runLen; longSide = runSide; }

  return {curSide,curLen,longSide,longLen};
}

function noiseScore({entropy, alt, tieRate, sampleBP}){
  // 0..100 : entropy high + alt high + tie high => noisy
  // sample small => add noise penalty
  let n = 0;
  n += entropy * 0.45;
  n += alt * 0.40;
  n += tieRate * 0.15;

  // small sample penalty (bp < 8 is shaky)
  if (sampleBP < 8) n += (8 - sampleBP) * 6;

  return clamp(Math.round(n), 0, 100);
}

function confidenceScore({noise, sampleBP}){
  // 0..100 : inverse of noise, plus maturity bonus by sample size
  let c = 100 - noise;

  // maturity bonus (bp grows => confidence stabilizes)
  if (sampleBP >= 8) c += 4;
  if (sampleBP >= 12) c += 6;
  if (sampleBP >= 20) c += 8;

  return clamp(Math.round(c), 0, 100);
}

function phaseDetect({sampleBP, noise, alt, curStreakLen, entropy}){
  if (sampleBP < 8) return {phase:"DỮ LIỆU ÍT", hint:"Nhập thêm 8–12 ván B/P để đọc nhịp rõ hơn."};

  if (noise >= 70) return {phase:"NHIỄU / TRAP", hint:"Noise cao. Ưu tiên quan sát, tránh “đuổi nhịp”."};

  if (curStreakLen >= 4 && alt <= 45 && entropy <= 60){
    return {phase:"TREND (BÁM)", hint:"Có streak + alt thấp. Nhịp đang bám, nhưng vẫn canh gãy nhịp."};
  }

  if (alt >= 65 && entropy >= 70){
    return {phase:"CHOPPY (ĐẢO)", hint:"Đổi nhịp nhiều + entropy cao. Đừng ép theo 1 phía."};
  }

  return {phase:"TRUNG TÍNH", hint:"Nhịp vừa phải. Chờ thêm 1–2 ván để xác nhận."};
}

function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

// ---------- Render ----------
function renderAll(){
  $("shoeId").textContent = String(state.shoeId || 1);
  $("journal").value = state.journal || "";

  const c = counts(state.results);
  $("bCount").textContent = c.b;
  $("pCount").textContent = c.p;
  $("tCount").textContent = c.t;
  $("total").textContent  = c.total;

  // overall % (including ties)
  $("bPct").textContent = pct(c.b, c.total) + "%";
  $("pPct").textContent = pct(c.p, c.total) + "%";
  $("tPct").textContent = pct(c.t, c.total) + "%";

  // BP-only %
  const bp = bpOnly(state.results);
  const cbp = counts(bp);
  $("bpTotal").textContent = cbp.total;
  $("bpPct").textContent = `B ${pct(cbp.b, cbp.total)}% · P ${pct(cbp.p, cbp.total)}%`;

  // Last 20 window (based on full results)
  const last20 = lastN(state.results, 20);
  const last20bp = bpOnly(last20);
  const last20c = counts(last20bp);

  const alt = alternationRate(last20bp);
  const tie20 = counts(last20).t;
  const tieRate20 = pct(tie20, last20.length);

  $("last20Line").textContent =
    last20bp.length
      ? `B:${last20c.b} • P:${last20c.p} • Tổng:${last20bp.length}`
      : "-";

  $("last20Meta").textContent =
    `B:${last20c.b} · P:${last20c.p} · Alt:${alt}% · Tie(20):${tieRate20}%`;

  // Streak info (on bpOnly overall)
  const si = streakInfo(bp);
  $("streakLine").textContent =
    si.curLen ? `${si.curSide} x${si.curLen}` : "-";
  $("longestLine").textContent =
    si.longLen ? `Longest: ${si.longSide} x${si.longLen}` : "Longest: -";

  // Entropy / Noise (use last20bp for short-term rhythm)
  const ent = entropyBP(last20bp);
  $("entropy").textContent = ent + "%";
  $("entropyBar").style.width = ent + "%";

  const noise = noiseScore({
    entropy: ent,
    alt,
    tieRate: tieRate20,
    sampleBP: last20bp.length
  });
  $("noise").textContent = noise + "%";
  $("noiseBar").style.width = noise + "%";

  // Confidence + phase
  const conf = confidenceScore({noise, sampleBP: last20bp.length});
  $("confidence").textContent = conf;

  const ph = phaseDetect({
    sampleBP: last20bp.length,
    noise,
    alt,
    curStreakLen: streakInfo(last20bp).curLen,
    entropy: ent
  });

  $("phaseBadge").textContent = ph.phase;
  $("hint").textContent = ph.hint;

  // History
  renderHistory();
}

function renderHistory(){
  const limit = parseInt($("historyLimit").value || "200", 10);
  const el = $("history");
  el.innerHTML = "";

  const arr = state.results.slice(-limit).reverse(); // newest first
  if (!arr.length){
    el.innerHTML = `<div class="tiny">Chưa có lịch sử. Bấm Banker/Player/Tie để bắt đầu.</div>`;
    return;
  }

  arr.forEach((x, idx) => {
    const realIndex = state.results.length - 1 - idx; // index in original array
    const pill = document.createElement("div");
    pill.className = "pill";
    const dot = document.createElement("span");
    dot.className = "dot " + (x==="B"?"b":x==="P"?"p":"t");
    const txt = document.createElement("b");
    txt.textContent = x;
    const sm = document.createElement("small");
    sm.textContent = `#${realIndex+1}`;

    pill.appendChild(dot);
    pill.appendChild(txt);
    pill.appendChild(sm);

    pill.addEventListener("click", () => {
      if (!confirm(`Xóa ván #${realIndex+1} (${x})?`)) return;
      state.results.splice(realIndex, 1);
      saveState();
      renderAll();
    });

    el.appendChild(pill);
  });
}

// ---------- Storage / Export / Import ----------
function saveState(){
  localStorage.setItem(KEY, JSON.stringify(state));
}

function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    return null;
  }
}

function clearStorage(){
  if (!confirm("Xóa toàn bộ dữ liệu lưu máy?")) return;
  localStorage.removeItem(KEY);
  location.reload();
}

function doExport(){
  const payload = {
    version: "B_v1",
    exportedAt: new Date().toISOString(),
    data: state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `hao-baccarat_B_export_shoe${state.shoeId}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 500);
}

function doImport(e){
  const f = e.target.files?.[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const json = JSON.parse(String(reader.result || "{}"));
      const d = json.data || json;
      if (!d || !Array.isArray(d.results)) throw new Error("Sai định dạng");
      if (!confirm("Import sẽ ghi đè dữ liệu hiện tại. Tiếp tục?")) return;
      state.shoeId = d.shoeId || 1;
      state.results = d.results || [];
      state.journal = d.journal || "";
      saveState();
      renderAll();
    }catch(err){
      alert("Import lỗi: " + err.message);
    }finally{
      e.target.value = "";
    }
  };
  reader.readAsText(f);
}
}

/** ======= UI ======= **/

function setText(id, v) {
  const el = document.getElementById(id);
  if (el) el.textContent = v;
}

function render() {
  const c = count(history);
  setText("bCount", c.B);
  setText("pCount", c.P);
  setText("tCount", c.T);
  setText("total", c.total);

  const m = computeLast20();

  // hiển thị %
  setText("bpB20", c.total ? (m.c20.bpTotal ? `${m.bPct.toFixed(0)}%` : "-") : "-");
  setText("bpP20", c.total ? (m.c20.bpTotal ? `${m.pPct.toFixed(0)}%` : "-") : "-");
  setText("t20",  c.total ? `${m.tPct.toFixed(0)}%` : "-");

  // EDGE + NOISE
  if (m.c20.bpTotal) {
    const winner = m.bPct >= m.pPct ? "B" : "P";
    setText("edge20", `${winner} +${m.edge.toFixed(0)}%`);
  } else {
    setText("edge20", "-");
  }
  setText("noise20", `${m.noise}%`);

  // CONFIDENCE
  setText("conf", c.total ? String(m.conf) : "--");

  // giải thích ngắn, không phán kèo
  const explainEl = document.getElementById("explain20");
  if (explainEl) {
    if (history.length < 6) {
      explainEl.textContent = "Dữ liệu ít → ưu tiên quan sát thêm. (Tính theo 20 ván gần nhất)";
    } else {
      explainEl.textContent =
        `Last20: B=${m.c20.B}, P=${m.c20.P}, T=${m.c20.T} • Alt=${Math.round(m.alt*100)}% • Entropy=${m.ent.toFixed(2)} • Streak=${m.st} • Confidence=${m.conf}/100`;
    }
  }
}

window.addResult = addResult;
window.undo = undo;
window.resetAll = resetAll;

render();
