/* Bùi Hào — Baccarat • ULTRA AI V3 • WHITE PRO
   Build 3.1.0
   Tool chỉ để ghi nhận + lọc nhịp/nhiễu. Không có “chắc thắng”.
*/

const BUILD = "3.1.0";
const LS_KEY = "bh_baccarat_ultra_v3_whitepro";

const $ = (id)=>document.getElementById(id);

const state = {
  shoe: 1,
  history: [], // { r:'B'|'P'|'T', shoe, ts, meta?: { bTotal,pTotal,delta, pairB,pairP, naturalB,naturalP } }
};

function nowTs(){ return Date.now(); }

function save(){
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}
function load(){
  const raw = localStorage.getItem(LS_KEY);
  if(!raw) return;
  try{
    const obj = JSON.parse(raw);
    if(obj && typeof obj === "object"){
      state.shoe = obj.shoe || 1;
      state.history = Array.isArray(obj.history) ? obj.history : [];
    }
  }catch{}
}

function setText(id, txt){
  const el = $(id);
  if(el) el.textContent = txt;
}

function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

function pctFill(id, v){
  v = clamp(Math.round(v), 0, 100);
  setText(id.replace("bar","k"), v);
  const el = $(id);
  if(el) el.style.width = v + "%";
}

function countBP(hist){
  let B=0,P=0,T=0;
  for(const x of hist){
    if(x.r==="B") B++;
    else if(x.r==="P") P++;
    else if(x.r==="T") T++;
  }
  return {B,P,T, total: hist.length};
}

function lastN(arr, n){
  return arr.slice(Math.max(0, arr.length - n));
}

function chopAndStreak(hist){
  const seq = hist.filter(x=>x.r==="B"||x.r==="P").map(x=>x.r);
  if(seq.length < 2) return { chopRate:null, streak:null, last:null };
  let chops = 0;
  for(let i=1;i<seq.length;i++){
    if(seq[i] !== seq[i-1]) chops++;
  }
  const chopRate = Math.round((chops/(seq.length-1))*100);
  let streak=1;
  for(let i=seq.length-1;i>0;i--){
    if(seq[i]===seq[i-1]) streak++;
    else break;
  }
  return { chopRate, streak, last: seq[seq.length-1] };
}

// ---------- CARD / POINTS ----------
const CARD_OPTS = ["—","A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function populateSelect(sel){
  sel.innerHTML = "";
  for(const v of CARD_OPTS){
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    sel.appendChild(opt);
  }
}

function cardPoint(v){
  if(!v || v==="—") return null;
  if(v==="A") return 1;
  if(v==="10" || v==="J" || v==="Q" || v==="K") return 0;
  const n = parseInt(v,10);
  return Number.isFinite(n) ? n : null;
}

function calcHandTotal(vals){
  let sum=0, cnt=0;
  for(const v of vals){
    const p = cardPoint(v);
    if(p===null) continue;
    sum += p; cnt++;
  }
  if(cnt===0) return { total:null, count:0 };
  return { total:(sum%10), count:cnt };
}

function isPair2(v1, v2){
  if(!v1 || !v2 || v1==="—" || v2==="—") return false;
  return v1 === v2;
}

function isNatural(total){
  return total===8 || total===9;
}

function getCardVals(){
  const bVals = [ $("b1").value, $("b2").value, $("b3").value ];
  const pVals = [ $("p1").value, $("p2").value, $("p3").value ];
  return { bVals, pVals };
}

function computeCardMeta(){
  const {bVals,pVals} = getCardVals();
  const bt = calcHandTotal(bVals);
  const pt = calcHandTotal(pVals);

  const pairB = isPair2(bVals[0], bVals[1]);
  const pairP = isPair2(pVals[0], pVals[1]);

  const naturalB = (bt.total!==null) ? isNatural(bt.total) : false;
  const naturalP = (pt.total!==null) ? isNatural(pt.total) : false;

  const delta = (bt.total===null || pt.total===null) ? null : Math.abs(bt.total - pt.total);

  const hasAny = (bt.count>0 || pt.count>0);

  return {
    hasAny,
    bTotal: bt.total, bCount: bt.count,
    pTotal: pt.total, pCount: pt.count,
    delta,
    pairB, pairP,
    naturalB, naturalP
  };
}

function updateCardUI(){
  const m = computeCardMeta();

  const bTot = (m.bTotal===null) ? "—" : String(m.bTotal);
  const pTot = (m.pTotal===null) ? "—" : String(m.pTotal);

  setText("bInfo", `Tổng: ${bTot} • Pair(2 lá): ${m.pairB ? "YES" : "NO"} • Long Bảo: ${m.naturalB ? "YES" : "NO"}`);
  setText("pInfo", `Tổng: ${pTot} • Pair(2 lá): ${m.pairP ? "YES" : "NO"} • Long Bảo: ${m.naturalP ? "YES" : "NO"}`);

  // live preview (chưa lưu ván)
  updateLiveUI({
    history: state.history,
    lastDelta: m.hasAny ? m.delta : null,
    lastPoints: m.hasAny ? m : null
  });
}

function resetCardInputs(){
  for(const id of ["b1","b2","b3","p1","p2","p3"]){
    $(id).value = "—";
  }
  updateCardUI();
}

// ---------- LIVE UI ----------
function classifyDelta(delta){
  if(delta===null) return "—";
  if(delta<=2) return "YẾU (nhiễu)";
  if(delta<=4) return "TRUNG BÌNH";
  return "MẠNH";
}

function liveModeFromDeltas(deltas){
  if(deltas.length < 4) return { mode:"DỮ LIỆU ÍT", noise:null };
  const strong = deltas.filter(d=>d>=4).length;
  const weak   = deltas.filter(d=>d<=2).length;
  const noise = Math.round((weak / deltas.length) * 100);
  let mode = "TRUNG TÍNH";
  if(strong >= Math.ceil(deltas.length*0.5) && noise <= 40) mode = "NHỊP MẠNH";
  if(noise >= 60) mode = "NHIỄU / BẪY";
  return { mode, noise };
}

function updateLiveUI({history, lastDelta, lastPoints}){
  const hist = history || [];
  if(lastPoints){
    setText("liveLast", `P:${lastPoints.pTotal ?? "—"} (${lastPoints.pCount} lá) • B:${lastPoints.bTotal ?? "—"} (${lastPoints.bCount} lá)`);
  }else{
    const last = hist[hist.length-1];
    setText("liveLast", last ? `KQ: ${last.r}` : "—");
  }
  setText("liveDelta", (typeof lastDelta==="number") ? `Δ=${lastDelta} → ${classifyDelta(lastDelta)}` : "—");

  const deltas = lastN(hist, 12).map(x=>x.meta?.delta).filter(d=>typeof d==="number");
  const m = liveModeFromDeltas(deltas);
  setText("liveMode", `MODE: ${m.mode}${(m.noise!==null)?` • Noise≈${m.noise}%`:""}`);

  const rp = chopAndStreak(lastN(hist, 30));
  if(rp.chopRate===null){
    setText("liveRoad","—");
  }else{
    const chopTxt = rp.chopRate >= 60 ? "ĐẢO NHIỀU" : (rp.chopRate <= 40 ? "BỆT NHIỀU" : "LẪN");
    const streakTxt = rp.streak >= 4 ? "BỆT DÀI" : (rp.streak >= 2 ? "BỆT NGẮN" : "ĐẢO");
    setText("liveRoad", `Chop=${rp.chopRate}% (${chopTxt}) • Streak=${rp.streak} (${streakTxt}) • Last=${rp.last}`);
  }
}

// ---------- AI STATUS ----------
function computeWindowStats(n){
  const w = lastN(state.history, n);
  const c = countBP(w);
  const nonTie = w.filter(x=>x.r==="B"||x.r==="P").map(x=>x.r);
  let chops=0;
  for(let i=1;i<nonTie.length;i++) if(nonTie[i]!==nonTie[i-1]) chops++;
  const chopRate = nonTie.length>=2 ? Math.round((chops/(nonTie.length-1))*100) : null;
  return { n, ...c, chopRate };
}

function decideAI(){
  const total = state.history.length;
  const w12 = computeWindowStats(12);
  const w30 = computeWindowStats(30);
  const w50 = computeWindowStats(50);

  setText("bLast12", (w12.total? `B:${w12.B} • P:${w12.P} • T:${w12.T}` : "—"));
  setText("bLast30", (w30.total? `B:${w30.B} • P:${w30.P} • T:${w30.T}` : "—"));
  setText("bLast50", (w50.total? `B:${w50.B} • P:${w50.P} • T:${w50.T}` : "—"));

  const rp = chopAndStreak(lastN(state.history, 60));
  if(rp.chopRate===null) setText("bChop","—");
  else setText("bChop", `Chop=${rp.chopRate}% • Streak=${rp.streak} • Last=${rp.last}`);

  // noise proxy: chopRate + delta weak-rate
  const deltas = lastN(state.history, 20).map(x=>x.meta?.delta).filter(d=>typeof d==="number");
  const weak = deltas.filter(d=>d<=2).length;
  const noiseFromDelta = deltas.length ? Math.round((weak/deltas.length)*100) : 50;
  const noiseFromChop = (rp.chopRate===null) ? 50 : rp.chopRate;
  const noise = Math.round((noiseFromDelta*0.6 + noiseFromChop*0.4));

  // lean proxy: weighted diff
  const diff12 = w12.B - w12.P;
  const diff30 = w30.B - w30.P;
  const diff50 = w50.B - w50.P;
  const weighted = diff12*0.45 + diff30*0.35 + diff50*0.20;

  let lean = "NONE";
  if(weighted >= 2) lean = "BANKER";
  else if(weighted <= -2) lean = "PLAYER";

  // confidence proxy
  let conf = 50;
  conf += Math.min(18, Math.abs(Math.round(weighted))*4);
  conf -= Math.round(noise*0.25);
  conf = clamp(conf, 15, 85);

  // edge proxy = (conf - 50) - noise offset
  let edge = Math.round((conf - 50) - (noise - 50)*0.35);
  edge = clamp(edge, -50, 50);

  // phase (simple)
  let phase = "DỮ LIỆU ÍT";
  if(total >= 12 && noise >= 60) phase = "NHIỄU / ĐẢO";
  else if(total >= 12 && rp.streak >= 4 && noise <= 45) phase = "BỆT ỔN";
  else if(total >= 12 && rp.streak <= 2 && noise <= 55) phase = "TRUNG TÍNH";

  // decision label (không khuyến nghị cược)
  let decision = "WAIT";
  let reason = "Thiếu xác nhận";
  if(total < 8){
    decision = "WAIT";
    reason = "Cần thêm dữ liệu";
  }else{
    if(noise >= 65){
      decision = "NOISE";
      reason = "Bàn nhiễu / dễ bẫy";
    }else if(conf >= 62 && lean !== "NONE"){
      decision = `LEAN ${lean}`;
      reason = `Lean rõ + noise thấp`;
    }else{
      decision = "WAIT";
      reason = "Chưa đủ lực";
    }
  }

  setText("aiDecision", decision);
  setText("aiPhase", `PHASE: ${phase}`);
  setText("aiLean", `LEAN: ${lean}`);
  setText("aiReason", `REASON: ${reason}`);

  setText("kConf", String(conf));
  setText("kNoise", String(noise));
  setText("kEdge", String(edge));

  if($("barConf")) $("barConf").style.width = conf + "%";
  if($("barNoise")) $("barNoise").style.width = noise + "%";
  // edge: map -50..50 => 0..100
  const edgeFill = Math.round((edge + 50));
  if($("barEdge")) $("barEdge").style.width = edgeFill + "%";
}

function updateStatsUI(){
  const c = countBP(state.history);
  setText("sB", String(c.B));
  setText("sP", String(c.P));
  setText("sT", String(c.T));
  setText("sShoe", String(state.shoe));
  setText("sTotal", String(c.total));
}

// ---------- HISTORY UI ----------
function fmtTime(ts){
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2,"0");
  const mm = String(d.getMinutes()).padStart(2,"0");
  const ss = String(d.getSeconds()).padStart(2,"0");
  return `${hh}:${mm}:${ss}`;
}

function metaLine(x){
  const m = x.meta || {};
  const bits = [];
  if(typeof m.pTotal==="number" && typeof m.bTotal==="number"){
    bits.push(`P${m.pTotal}-B${m.bTotal}`);
  }
  if(typeof m.delta==="number"){
    bits.push(`Δ${m.delta}`);
  }
  if(m.pairP) bits.push("PairP");
  if(m.pairB) bits.push("PairB");
  if(m.naturalP) bits.push("NatP");
  if(m.naturalB) bits.push("NatB");
  return bits.length ? bits.join(" • ") : "—";
}

function renderHistory(){
  const box = $("history");
  box.innerHTML = "";
  if(state.history.length===0){
    const empty = document.createElement("div");
    empty.className = "box";
    empty.innerHTML = `<div class="boxTitle">Chưa có ván nào</div><div class="boxText">Bấm BANKER/PLAYER/TIE để thêm.</div>`;
    box.appendChild(empty);
    return;
  }

  state.history.slice().reverse().forEach((x, idxFromEnd)=>{
    const idx = state.history.length - 1 - idxFromEnd;

    const item = document.createElement("div");
    item.className = "hItem";
    item.title = "Tap để xoá ván này";

    const left = document.createElement("div");
    left.className = "hLeft";

    const badge = document.createElement("div");
    badge.className = `hBadge ${x.r}`;
    badge.textContent = x.r;

    const meta = document.createElement("div");
    meta.className = "hMeta";
    const top = document.createElement("div");
    top.className = "hTop";
    top.textContent = `Shoe ${x.shoe} • ${fmtTime(x.ts)}`;
    const sub = document.createElement("div");
    sub.className = "hSub";
    sub.textContent = metaLine(x);
    meta.appendChild(top);
    meta.appendChild(sub);

    left.appendChild(badge);
    left.appendChild(meta);

    const right = document.createElement("div");
    right.className = "hRight";
    right.textContent = "tap để xoá";

    item.appendChild(left);
    item.appendChild(right);

    item.addEventListener("click", ()=>{
      state.history.splice(idx,1);
      save();
      refreshAll();
    });

    box.appendChild(item);
  });
}

// ---------- ACTIONS ----------
function pushResult(r){
  // meta từ input lá (nếu có)
  const cm = computeCardMeta();
  const meta = cm.hasAny ? cm : null;

  const rec = { r, shoe: state.shoe, ts: nowTs() };
  if(meta){
    rec.meta = {
      bTotal: meta.bTotal, pTotal: meta.pTotal,
      delta: meta.delta,
      pairB: meta.pairB, pairP: meta.pairP,
      naturalB: meta.naturalB, naturalP: meta.naturalP
    };
  }

  state.history.push(rec);
  save();

  // update live theo ván vừa ra
  updateLiveUI({
    history: state.history,
    lastDelta: meta?.delta ?? null,
    lastPoints: meta ?? null
  });

  // reset input lá để tránh “dính ván”
  resetCardInputs();

  refreshAll();
}

function undo(){
  if(state.history.length===0) return;
  state.history.pop();
  save();
  refreshAll();
}

function resetAll(){
  if(!confirm("RESET: xoá toàn bộ lịch sử trong shoe hiện tại?")) return;
  state.history = [];
  save();
  refreshAll();
}

function newShoe(){
  if(!confirm("NEW SHOE: sang shoe mới (tăng số shoe) và xoá lịch sử?")) return;
  state.shoe += 1;
  state.history = [];
  save();
  refreshAll();
}

function refreshAll(){
  updateStatsUI();
  decideAI();
  renderHistory();

  // cập nhật live dựa trên last meta (nếu có)
  const last = state.history[state.history.length-1];
  if(last?.meta){
    updateLiveUI({
      history: state.history,
      lastDelta: last.meta.delta ?? null,
      lastPoints: {
        pTotal:last.meta.pTotal, bTotal:last.meta.bTotal,
        pCount: (typeof last.meta.pTotal==="number") ? 2 : 0,
        bCount: (typeof last.meta.bTotal==="number") ? 2 : 0
      }
    });
  }else{
    updateLiveUI({ history: state.history, lastDelta:null, lastPoints:null });
  }
}

// ---------- INIT ----------
function init(){
  setText("build", BUILD);
  load();

  // selects
  for(const id of ["b1","b2","b3","p1","p2","p3"]){
    populateSelect($(id));
    $(id).addEventListener("change", updateCardUI);
  }
  resetCardInputs();

  // buttons
  $("btnB").addEventListener("click", ()=>pushResult("B"));
  $("btnP").addEventListener("click", ()=>pushResult("P"));
  $("btnT").addEventListener("click", ()=>pushResult("T"));
  $("btnU").addEventListener("click", undo);
  $("btnR").addEventListener("click", resetAll);
  $("btnN").addEventListener("click", newShoe);

  refreshAll();
}

document.addEventListener("DOMContentLoaded", init);
