/* ULTRA PRO v4 — Analytics Engine (descriptive, no betting promises) */

const KEY = "hao_baccarat_ultra_v4";

const $ = (id) => document.getElementById(id);

let state = loadState();

function nowTs(){ return new Date().toISOString(); }

function defaultState(){
  return {
    version: 4,
    shoe: 1,
    hands: [] // {r:'B'|'P'|'T', ts, meta:{bp,pp,n8,n9, bcards[], pcards[]}}
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(KEY);
    if(!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if(!parsed || !parsed.hands) return defaultState();
    return parsed;
  }catch(e){
    return defaultState();
  }
}

function save(){
  localStorage.setItem(KEY, JSON.stringify(state));
}

function addResult(r){
  state.hands.push({ r, ts: nowTs(), shoe: state.shoe, meta:{} });
  save();
  renderAll();
}

function undo(){
  state.hands.pop();
  save();
  renderAll();
}

function resetShoe(){
  // reset only current shoe hands?
  state.hands = [];
  save();
  renderAll();
}

function newShoe(){
  state.shoe += 1;
  state.hands.push({ r: "—", ts: nowTs(), shoe: state.shoe, meta:{ marker:true } });
  // marker just to separate; not counted
  save();
  renderAll();
}

function clearAll(){
  state = defaultState();
  save();
  renderAll();
}

function getValidHands(){
  return state.hands.filter(h => h.r === "B" || h.r === "P" || h.r === "T");
}

function countAll(){
  const hands = getValidHands();
  const B = hands.filter(x=>x.r==="B").length;
  const P = hands.filter(x=>x.r==="P").length;
  const T = hands.filter(x=>x.r==="T").length;
  return {B,P,T,total:hands.length};
}

function sliceLast(n){
  const hands = getValidHands();
  return hands.slice(-n);
}

function pct(x, total){
  if(!total) return 0;
  return Math.round((x/total)*100);
}

function altRate(hands){
  // alternation on B/P only, ignore T
  const seq = hands.filter(h => h.r==="B" || h.r==="P").map(h=>h.r);
  if(seq.length <= 1) return 0;
  let alt=0;
  for(let i=1;i<seq.length;i++){
    if(seq[i] !== seq[i-1]) alt++;
  }
  return Math.round((alt/(seq.length-1))*100);
}

function longestStreak(hands){
  let best = {r:"", len:0};
  let cur = {r:"", len:0};
  for(const h of hands){
    if(h.r==="T") continue;
    if(h.r === cur.r){
      cur.len++;
    }else{
      cur = {r:h.r, len:1};
    }
    if(cur.len > best.len) best = {...cur};
  }
  return best;
}

function entropyBP(hands){
  // entropy of B/P distribution (ignore T)
  const bp = hands.filter(h=>h.r==="B"||h.r==="P");
  const n = bp.length;
  if(n===0) return 0;
  const b = bp.filter(h=>h.r==="B").length;
  const p = n-b;
  const pb = b/n, pp = p/n;
  const H = (x)=> x<=0 ? 0 : -x*Math.log2(x);
  const ent = H(pb)+H(pp); // 0..1
  return ent; // 0 pure, 1 max
}

function biasLastN(hands){
  // bias toward B or P in last N (ignore T) as absolute diff %
  const bp = hands.filter(h=>h.r==="B"||h.r==="P");
  const n = bp.length;
  if(n===0) return {lean:"NONE", bias:0, b:0, p:0, n:0};
  const b = bp.filter(h=>h.r==="B").length;
  const p = n-b;
  const d = b-p;
  const bias = Math.round((Math.abs(d)/n)*100);
  const lean = d>0 ? "BANKER" : d<0 ? "PLAYER" : "NONE";
  return {lean, bias, b, p, n};
}

function noiseIndex(hands){
  // simple noise: high alternation + high entropy => noisy
  const ent = entropyBP(hands);      // 0..1
  const alt = altRate(hands)/100;    // 0..1
  const noise = Math.round(((ent*0.6 + alt*0.4) * 100));
  return {noise, ent: Math.round(ent*100), alt: Math.round(alt*100)};
}

function confidenceIndex(last30){
  // confidence: inverse of noise, plus bias presence
  const n = noiseIndex(last30).noise; // 0..100
  const b = biasLastN(last30).bias;   // 0..100
  const conf = Math.max(0, Math.min(100, Math.round((100 - n)*0.7 + b*0.3)));
  return conf;
}

function aiEngine(){
  const last12 = sliceLast(12);
  const last30 = sliceLast(30);

  const total = getValidHands().length;

  if(total < 6){
    return {state:"WAIT", explain:"Chưa đủ dữ liệu → ưu tiên quan sát." , conf:0, ent:0, bias:0, noise:0, alt:0};
  }

  const b30 = biasLastN(last30);
  const nz = noiseIndex(last30);
  const conf = confidenceIndex(last30);

  // state (descriptive)
  let st = "WAIT";
  let explain = "Mẫu chưa rõ hoặc nhiễu cao → quan sát thêm.";

  if(nz.noise <= 45 && conf >= 55 && b30.bias >= 18){
    st = `LEAN ${b30.lean}`;
    explain = `Last30 lệch về ${b30.lean} (${b30.b}-${b30.p}), nhiễu thấp hơn.`;
  } else if(nz.noise >= 65){
    st = "NOISY";
    explain = "Nhiễu cao (đảo nhiều/entropy cao) → dễ lạc nhịp.";
  } else if(b30.bias <= 10){
    st = "BALANCED";
    explain = "Cân tương đối → chưa có lệch rõ.";
  }

  return {
    state: st,
    explain,
    conf,
    ent: nz.ent,
    bias: b30.bias,
    noise: nz.noise,
    alt: nz.alt
  };
}

function parseCards(s){
  // accept "9,0,6" or "9 0 6"
  if(!s) return [];
  return s
    .split(/[, ]+/)
    .map(x=>x.trim())
    .filter(Boolean)
    .map(x=>{
      // allow A as 1? baccarat: A=1, 0=0, 10/J/Q/K=0 (optional)
      const u = x.toUpperCase();
      if(u==="A") return 1;
      if(u==="J"||u==="Q"||u==="K"||u==="10") return 0;
      const n = parseInt(u,10);
      if(Number.isNaN(n)) return null;
      // baccarat value: 0-9, 10.. treated as 0
      if(n>=10) return 0;
      if(n<0) return null;
      return n;
    })
    .filter(x=>x!==null);
}

function baccaratPoint(cards){
  const sum = cards.reduce((a,b)=>a+b,0);
  return sum % 10;
}

function autoFlagsFromCards(bcards, pcards){
  // pair detection requires knowing first two cards ranks; we only have values. We'll treat "pair" only if user ticks.
  // Natural: if two cards total 8 or 9
  const b2 = bcards.slice(0,2);
  const p2 = pcards.slice(0,2);
  const bp = b2.length===2 ? baccaratPoint(b2) : null;
  const pp = p2.length===2 ? baccaratPoint(p2) : null;
  return {
    n8: (bp===8 || pp===8),
    n9: (bp===9 || pp===9),
    bPoint: bcCardsOk(bcards) ? baccaratPoint(bcards) : null,
    pPoint: bcCardsOk(pcards) ? baccaratPoint(pcards) : null
  };
}

function bcCardsOk(arr){ return Array.isArray(arr) && arr.length>=2; }

function attachDetailsToLast(){
  const hands = getValidHands();
  if(hands.length===0){
    alert("Chưa có ván nào để gắn chi tiết.");
    return;
  }
  const idx = state.hands.map((h,i)=>({h,i})).filter(x=>x.h.r==="B"||x.h.r==="P"||x.h.r==="T").slice(-1)[0].i;

  const bp = $("xBP").checked;
  const pp = $("xPP").checked;
  const n8 = $("xN8").checked;
  const n9 = $("xN9").checked;
  const bc = parseCards($("inBcards").value);
  const pc = parseCards($("inPcards").value);

  const auto = autoFlagsFromCards(bc, pc);

  state.hands[idx].meta = {
    bp, pp,
    n8: n8 || auto.n8,
    n9: n9 || auto.n9,
    bc, pc,
    bPoint: auto.bPoint,
    pPoint: auto.pPoint
  };

  save();
  renderAll();
}

function clearDetailInputs(){
  $("xBP").checked=false;
  $("xPP").checked=false;
  $("xN8").checked=false;
  $("xN9").checked=false;
  $("inBcards").value="";
  $("inPcards").value="";
}

function renderHeaderStats(){
  const c = countAll();
  $("sB").innerText = c.B;
  $("sP").innerText = c.P;
  $("sT").innerText = c.T;
  $("sTotal").innerText = c.total;
}

function setBar(idFill, idVal, v){
  const vv = Math.max(0, Math.min(100, v));
  $(idFill).style.width = vv + "%";
  $(idVal).innerText = vv + "%";
}

function renderAI(){
  const ai = aiEngine();
  $("aiState").innerText = ai.state;
  $("aiExplain").innerText = ai.explain;

  $("mBias").innerText = ai.bias + "%";
  $("mNoise").innerText = ai.noise + "%";
  $("mAlt").innerText = ai.alt + "%";

  setBar("barConf","barConfVal", ai.conf);
  setBar("barEnt","barEntVal", ai.ent);
}

function renderBead(){
  const hands = getValidHands();
  const pane = $("pane-bead");
  const max = 12*6; // 72
  const last = hands.slice(-max);

  const grid = document.createElement("div");
  grid.className = "road beadGrid road";

  for(let i=0;i<max;i++){
    const d = document.createElement("div");
    d.className = "dot empty";
    const h = last[i];
    if(h){
      if(h.r==="B") d.className = "dot b";
      if(h.r==="P") d.className = "dot p";
      if(h.r==="T") d.className = "dot t";
    }
    grid.appendChild(d);
  }
  pane.innerHTML = "";
  pane.appendChild(grid);
}

function buildBigRoadCols(hands){
  // Simple Big Road: columns of streaks for B/P; T ignored in placement (counted separately in history)
  const seq = hands.filter(h=>h.r==="B"||h.r==="P").map(h=>h.r);
  const cols = [];
  let curCol = [];
  let cur = null;
  for(const r of seq){
    if(r===cur){
      curCol.push(r);
    }else{
      if(curCol.length) cols.push(curCol);
      cur = r;
      curCol = [r];
    }
  }
  if(curCol.length) cols.push(curCol);
  return cols;
}

function renderBigRoad(){
  const hands = getValidHands();
  const pane = $("pane-big");
  const cols = buildBigRoadCols(hands);

  const maxCols = 20;
  const rows = 6;

  const grid = document.createElement("div");
  grid.className = "road bigGrid road";

  // draw column-major into a 20x6 grid
  for(let r=0;r<rows;r++){
    for(let c=0;c<maxCols;c++){
      const d = document.createElement("div");
      d.className = "dot empty";
      const col = cols[c];
      if(col && col[r]){
        d.className = col[r]==="B" ? "dot b" : "dot p";
      }
      grid.appendChild(d);
    }
  }

  pane.innerHTML = "";
  pane.appendChild(grid);
}

function renderHistory(){
  const hands = getValidHands();
  const pane = $("pane-list");
  pane.innerHTML = "";

  const wrap = document.createElement("div");

  for(let i=hands.length-1;i>=0;i--){
    const h = hands[i];
    const item = document.createElement("div");
    item.className = "histItem";

    const left = document.createElement("div");
    const pill = document.createElement("span");
    pill.className = "pill " + (h.r==="B"?"b":h.r==="P"?"p":"t");
    pill.textContent = h.r==="B" ? "BANKER" : h.r==="P" ? "PLAYER" : "TIE";

    const meta = h.meta || {};
    const flags = [];
    if(meta.bp) flags.push("BP");
    if(meta.pp) flags.push("PP");
    if(meta.n8) flags.push("N8");
    if(meta.n9) flags.push("N9");
    if(meta.bPoint!=null || meta.pPoint!=null){
      flags.push(`B${meta.bPoint ?? "?"}-P${meta.pPoint ?? "?"}`);
    }

    left.appendChild(pill);
    if(flags.length){
      const f = document.createElement("span");
      f.className = "pill g";
      f.style.marginLeft = "8px";
      f.textContent = flags.join(" • ");
      left.appendChild(f);
    }

    const right = document.createElement("div");
    right.style.color = "#666";
    right.style.fontWeight = "900";
    right.style.fontSize = "12px";
    right.textContent = new Date(h.ts).toLocaleString();

    item.appendChild(left);
    item.appendChild(right);
    wrap.appendChild(item);
  }

  pane.appendChild(wrap);
}

function renderDumpText(text){
  $("dump").value = text || "";
}

function doExport(){
  const txt = JSON.stringify(state, null, 2);
  renderDumpText(txt);
  const blob = new Blob([txt], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "hao-baccarat-ultra-v4.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function doCopy(){
  const txt = JSON.stringify(state, null, 2);
  renderDumpText(txt);
  try{
    await navigator.clipboard.writeText(txt);
    alert("Đã copy JSON.");
  }catch(e){
    alert("Không copy được. Bạn copy thủ công trong ô JSON.");
  }
}

function doImportFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const obj = JSON.parse(reader.result);
      if(!obj || !obj.hands) throw new Error("bad");
      state = obj;
      save();
      renderAll();
      alert("Import OK.");
    }catch(e){
      alert("File JSON không hợp lệ.");
    }
  };
  reader.readAsText(file);
}

function setTab(tab){
  document.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("on", t.dataset.tab===tab);
  });
  ["bead","big","list"].forEach(k=>{
    $("pane-"+k).classList.toggle("hidden", k!==tab);
  });
}

function renderAll(){
  renderHeaderStats();
  renderAI();
  renderBead();
  renderBigRoad();
  renderHistory();
}

function bind(){
  $("btnB").onclick = ()=>addResult("B");
  $("btnP").onclick = ()=>addResult("P");
  $("btnT").onclick = ()=>addResult("T");

  $("btnUndo").onclick = undo;
  $("btnReset").onclick = ()=>{ if(confirm("Reset ván của shoe hiện tại?")) resetShoe(); };
  $("btnNewShoe").onclick = ()=>{ if(confirm("Tạo shoe mới?")) newShoe(); };

  $("btnAttach").onclick = attachDetailsToLast;
  $("btnClearDetail").onclick = clearDetailInputs;

  $("btnExport").onclick = doExport;
  $("btnCopy").onclick = doCopy;

  $("fileImport").addEventListener("change", (e)=>{
    const f = e.target.files?.[0];
    if(f) doImportFile(f);
    e.target.value = "";
  });

  $("btnClearAll").onclick = ()=>{ if(confirm("Xóa toàn bộ dữ liệu?")) clearAll(); };

  document.querySelectorAll(".tab").forEach(t=>{
    t.onclick = ()=>setTab(t.dataset.tab);
  });

  // PWA install
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    $("btnInstall").hidden = false;
  });
  $("btnInstall").onclick = async ()=>{
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $("btnInstall").hidden = true;
  };
}

bind();
renderAll();
