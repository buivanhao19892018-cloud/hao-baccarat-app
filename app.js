// ULTRA AI V3 • WHITE PRO
const BUILD = "3.0.0";
document.getElementById("build").textContent = BUILD;

const LS_KEY = "hao_baccarat_ultra_ai_v3_white_pro";

const state = loadState() || {
  shoe: 1,
  seq: [], // 'B' | 'P' | 'T' (T không tính vào B/P core)
  cards: {
    b: [null, null, null],
    p: [null, null, null],
  }
};

const $ = (id)=>document.getElementById(id);

// Buttons
$("btnB").onclick = ()=> addOutcome("B");
$("btnP").onclick = ()=> addOutcome("P");
$("btnT").onclick = ()=> addOutcome("T");
$("btnU").onclick = ()=> undo();
$("btnR").onclick = ()=> resetAll();
$("btnN").onclick = ()=> newShoe();

// Card selects
const cardOptions = buildCardOptions();
initSelect("b1"); initSelect("b2"); initSelect("b3");
initSelect("p1"); initSelect("p2"); initSelect("p3");

["b1","b2","b3","p1","p2","p3"].forEach(id=>{
  $(id).addEventListener("change", ()=>{
    const v = $(id).value || null;
    if(id[0]==="b") state.cards.b[Number(id[1])-1] = v;
    if(id[0]==="p") state.cards.p[Number(id[1])-1] = v;
    save();
    renderCards();
  });
});

function initSelect(id){
  const sel = $(id);
  sel.innerHTML = "";
  cardOptions.forEach(opt=>{
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    sel.appendChild(o);
  });
}

function buildCardOptions(){
  const opts = [{value:"", label:"—"}];
  const ranks = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
  // Suit không cần, chỉ rank đủ để tính điểm
  ranks.forEach(r => opts.push({value:r, label:r}));
  return opts;
}

function addOutcome(x){
  state.seq.push(x);
  save();
  renderAll();
}

function undo(){
  state.seq.pop();
  save();
  renderAll();
}

function resetAll(){
  if(!confirm("Reset toàn bộ dữ liệu (shoe + lịch sử)?")) return;
  state.shoe = 1;
  state.seq = [];
  state.cards = { b:[null,null,null], p:[null,null,null] };
  save();
  renderAll();
}

function newShoe(){
  state.shoe += 1;
  state.seq = [];
  // giữ cards như tuỳ chọn (nhưng mình cũng reset cho sạch)
  state.cards = { b:[null,null,null], p:[null,null,null] };
  save();
  renderAll();
}

function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}

function renderAll(){
  renderStats();
  renderHistory();
  renderCards();
  renderAI();
}
function renderStats(){
  const b = state.seq.filter(x=>x==="B").length;
  const p = state.seq.filter(x=>x==="P").length;
  const t = state.seq.filter(x=>x==="T").length;

  $("sB").textContent = b;
  $("sP").textContent = p;
  $("sT").textContent = t;
  $("sShoe").textContent = state.shoe;
  $("sTotal").textContent = state.seq.length;
}

function renderHistory(){
  const h = $("history");
  h.innerHTML = "";
  state.seq.slice().reverse().forEach((x, idxRev)=>{
    const idx = state.seq.length - 1 - idxRev;
    const div = document.createElement("div");
    div.className = "hItem " + (x==="B" ? "hB" : x==="P" ? "hP" : "hT");
    div.textContent = `${x} • #${idx+1}`;
    div.title = "Chạm để xoá ván này";
    div.onclick = ()=>{
      state.seq.splice(idx,1);
      save();
      renderAll();
    };
    h.appendChild(div);
  });
}

function renderCards(){
  // set selects current value
  ["b1","b2","b3"].forEach((id,i)=> $(id).value = state.cards.b[i] || "");
  ["p1","p2","p3"].forEach((id,i)=> $(id).value = state.cards.p[i] || "");

  const bRes = evalHand(state.cards.b);
  const pRes = evalHand(state.cards.p);

  $("bInfo").textContent = `Tổng: ${bRes.total} • Pair(2 lá): ${bRes.pair2 ? "YES" : "NO"} • Long Bảo: ${bRes.natural ? "YES" : "NO"}`;
  $("pInfo").textContent = `Tổng: ${pRes.total} • Pair(2 lá): ${pRes.pair2 ? "YES" : "NO"} • Long Bảo: ${pRes.natural ? "YES" : "NO"}`;
}

// Baccarat values: A=1, 2-9 as is, 10/J/Q/K = 0
function rankValue(r){
  if(!r) return 0;
  if(r==="A") return 1;
  if(["10","J","Q","K"].includes(r)) return 0;
  const n = Number(r);
  return Number.isFinite(n) ? n : 0;
}

function evalHand(arr){
  const r1 = arr[0], r2 = arr[1], r3 = arr[2];
  const v1 = rankValue(r1), v2 = rankValue(r2), v3 = rankValue(r3);
  const two = (v1 + v2) % 10;
  const total = (two + v3) % 10;
  const pair2 = (!!r1 && !!r2 && r1 === r2);
  const natural = (!!r1 && !!r2 && (two === 8 || two === 9)); // Natural 8/9 (Long Bảo)
  return { total, pair2, natural };
}

/* =========================
   AI GOD CORE
   =========================
   Ý tưởng:
   - Không dự đoán "ván tới", mà đọc bàn: Trend/Chop/Noise/Phase
   - Decision: PLAY (lean B/P), WAIT, SKIP (bàn bẫy)
*/

function renderAI(){
  const seqBP = state.seq.filter(x=>x==="B"||x==="P");
  const n = seqBP.length;

  // windows
  const w12 = lastWindow(seqBP, 12);
  const w30 = lastWindow(seqBP, 30);
  const w50 = lastWindow(seqBP, 50);

  const s12 = summarize(w12);
  const s30 = summarize(w30);
  const s50 = summarize(w50);

  $("bLast12").textContent = fmtBP(s12);
  $("bLast30").textContent = fmtBP(s30);
  $("bLast50").textContent = fmtBP(s50);

  const chop = alternationRate(w30);      // 0..1
  const streak = longestStreak(w30);      // integer
  const curStreak = currentStreak(w30);   // integer & side
  $("bChop").textContent = `Alt: ${(chop*100).toFixed(0)}% • Longest: ${streak.len}${streak.side} • Now: ${curStreak.len}${curStreak.side}`;

  // entropy & noise proxy
  const ent = entropyBinary(s30.b, s30.p);          // 0..1 (max near 0.5 split)
  const noise = clamp01(0.55*chop + 0.35*ent + 0.10*volatility(w30)); // 0..1

  // lean & edge proxy (not real EV, just "signal strength")
  const leanScore = weightedLeanScore(s12, s30, s50, curStreak, chop);
  const lean = leanScore > 0 ? "B" : leanScore < 0 ? "P" : "NONE";
  const signal = Math.abs(leanScore); // 0..1
  const edgeProxy = clamp01(signal*(1-noise)); // 0..1

  // phase classify
  const phase = classifyPhase(n, noise, curStreak, chop);

  // confidence
  // - tăng khi signal mạnh, noise thấp, streak rõ
  const conf = clamp01( 0.15 + 0.60*edgeProxy + 0.20*clamp01((curStreak.len-1)/5) - 0.10*clamp01((chop-0.65)/0.35) );

  // decision rules
  let decision = "WAIT";
  let reason = "dữ liệu/nhịp chưa rõ";

  if(n < 8){
    decision = "WAIT";
    reason = "dữ liệu ít (<8 ván B/P)";
  } else {
    // SKIP: noise quá cao hoặc chop cực cao, dễ bẫy
    if(noise > 0.62 || chop > 0.78){
      decision = "SKIP";
      reason = "nhiễu cao / chop gắt → dễ bẫy";
    } else {
      // PLAY: cần conf >= 0.62 và edgeProxy đủ
      if(conf >= 0.62 && edgeProxy >= 0.22){
        decision = (lean==="B" ? "PLAY BANKER" : lean==="P" ? "PLAY PLAYER" : "WAIT");
        reason = lean==="NONE" ? "nhịp có nhưng chưa nghiêng cửa" : "nhịp rõ + nhiễu thấp";
      } else {
        // WAIT when borderline
        decision = "WAIT";
        reason = "chưa đủ ngưỡng (conf/edge)";
      }
    }
  }

  // Update UI
  $("aiDecision").textContent = decision;
  $("aiPhase").textContent = `PHASE: ${phase}`;
  $("aiLean").textContent = `LEAN: ${lean}`;
  $("aiReason").textContent = `REASON: ${reason}`;

  setKpi("kConf","barConf", conf);
  setKpi("kNoise","barNoise", noise);
  setKpi("kEdge","barEdge", edgeProxy);

  // Color the big decision subtly
  const el = $("aiDecision");
  el.style.borderColor = "#e5e7eb";
  el.style.background = "#ffffff";
  if(decision.includes("BANKER")){
    el.style.borderColor = "rgba(22,163,74,.35)";
    el.style.background = "rgba(22,163,74,.06)";
  } else if(decision.includes("PLAYER")){
    el.style.borderColor = "rgba(37,99,235,.35)";
    el.style.background = "rgba(37,99,235,.06)";
  } else if(decision==="SKIP"){
    el.style.borderColor = "rgba(239,68,68,.35)";
    el.style.background = "rgba(239,68,68,.06)";
  } else {
    el.style.borderColor = "rgba(245,158,11,.35)";
    el.style.background = "rgba(245,158,11,.05)";
  }
}

function setKpi(numId, barId, x01){
  const pct = Math.round(clamp01(x01)*100);
  $(numId).textContent = pct;
  $(barId).style.width = pct + "%";
  // keep neutral (no custom colors), but still readable by default
}

function lastWindow(arr, k){
  return arr.slice(Math.max(0, arr.length-k));
}
function summarize(arr){
  const b = arr.filter(x=>x==="B").length;
  const p = arr.filter(x=>x==="P").length;
  return { b, p, n: arr.length };
}
function fmtBP(s){
  if(s.n===0) return "—";
  const bb = Math.round((s.b/s.n)*100);
  const pp = Math.round((s.p/s.n)*100);
  return `B ${s.b} (${bb}%) • P ${s.p} (${pp}%)`;
}

function alternationRate(arr){
  if(arr.length<2) return 0;
  let alt=0, m=0;
  for(let i=1;i<arr.length;i++){
    if(arr[i]!==arr[i-1]) alt++;
    m++;
  }
  return m? alt/m : 0;
}

function longestStreak(arr){
  let bestLen=0, bestSide="—";
  let curLen=0, curSide=null;
  for(const x of arr){
    if(x===curSide){ curLen++; }
    else { curSide=x; curLen=1; }
    if(curLen>bestLen){ bestLen=curLen; bestSide=curSide; }
  }
  return {len: bestLen, side: bestSide||"—"};
}
function currentStreak(arr){
  if(arr.length===0) return {len:0, side:"—"};
  let side = arr[arr.length-1];
  let len=1;
  for(let i=arr.length-2;i>=0;i--){
    if(arr[i]===side) len++;
    else break;
  }
  return {len, side};
}

// Entropy for binary split: 0..1 (0 when all same; 1 near 50/50)
function entropyBinary(b,p){
  const n = b+p;
  if(n===0) return 0;
  const pb=b/n, pp=p/n;
  const h = (pb>0?-pb*Math.log2(pb):0) + (pp>0?-pp*Math.log2(pp):0);
  // max entropy for 2 outcomes = 1
  return clamp01(h/1);
}

// volatility proxy: how often 2-step pattern changes
function volatility(arr){
  if(arr.length<4) return 0;
  let changes=0, base=0;
  for(let i=3;i<arr.length;i++){
    const a = arr[i-3]+arr[i-2];
    const b = arr[i-1]+arr[i];
    if(a!==b) changes++;
    base++;
  }
  return base? changes/base : 0;
}

// Weighted lean score: +B, -P (0..1)
function weightedLeanScore(s12,s30,s50,curStreak,chop){
  // smooth proportions with pseudo counts to avoid overreact
  const p12 = smoothProp(s12.b, s12.p, 2); // 0..1
  const p30 = smoothProp(s30.b, s30.p, 2);
  const p50 = smoothProp(s50.b, s50.p, 2);

  // baseline signal: weighted by recency
  const base = 0.55*(p12-0.5) + 0.30*(p30-0.5) + 0.15*(p50-0.5);

  // streak boost (if streak >=3 and chop not too high)
  let boost = 0;
  if(curStreak.len>=3 && chop < 0.65){
    boost = 0.08 * Math.min(4, curStreak.len-2) * (curStreak.side==="B" ? 1 : -1);
  }

  // chop penalty (too choppy reduces lean)
  const penalty = 0.10 * clamp01((chop-0.55)/0.35) * Math.sign(base || 1);

  const score = base + boost - penalty;
  // squash to -1..1
  return clamp(score, -0.9, 0.9);
}

function smoothProp(b,p,alpha){
  const n=b+p;
  if(n===0) return 0.5;
  // add alpha to both sides
  return (b+alpha)/(n+2*alpha);
}

function classifyPhase(n, noise, curStreak, chop){
  if(n < 8) return "DỮ LIỆU ÍT";
  if(noise > 0.62 || chop > 0.78) return "TRAP / BREAKDOWN";
  if(curStreak.len >= 4 && noise < 0.52 && chop < 0.62) return "TREND / FLOW";
  if(curStreak.len >= 2 && noise < 0.60) return "FORMATION";
  return "RANDOM / NHIỄU";
}

function clamp01(x){ return Math.max(0, Math.min(1, x)); }
function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

// Initial render
renderAll();
