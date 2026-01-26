/* =========================
   Hào Baccarat — C4 PRO
   - Roads: Bead, Big Road (Tie mark), Big Eye, Small, Cockroach
   - Export/Import, Offline (SW), PWA install
   NOTE: tracking/visualization only (not prediction).
========================= */

const KEY = "hao_baccarat_c4_history_v1";

/** history item: { x:'B'|'P'|'T', t:number } */
let history = load();

function load(){
  try{ return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch{ return []; }
}
function save(){
  localStorage.setItem(KEY, JSON.stringify(history));
}

const $ = (id)=>document.getElementById(id);

function toast(msg){
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(()=>el.classList.remove("show"), 1200);
}

/* ---------- buttons ---------- */
$("btnB").onclick = ()=>add("B");
$("btnP").onclick = ()=>add("P");
$("btnT").onclick = ()=>add("T");
$("btnUndo").onclick = undo;
$("btnReset").onclick = resetAll;

document.addEventListener("keydown",(e)=>{
  const k = e.key.toLowerCase();
  if(k==="b") add("B");
  if(k==="p") add("P");
  if(k==="t") add("T");
  if(k==="z") undo();
});

$("toggleGrid").onchange = render;
$("toggleCompact").onchange = render;
$("historyLimit").onchange = render;

/* ---------- modal ---------- */
let modalMode = "export";
$("btnExport").onclick = ()=>openModal("export");
$("btnImport").onclick = ()=>openModal("import");
$("modalClose").onclick = closeModal;
$("btnCopy").onclick = copyModal;
$("btnPaste").onclick = pasteModal;
$("btnApply").onclick = applyModal;

function openModal(mode){
  modalMode = mode;
  $("modal").classList.remove("hidden");
  $("modalTitle").textContent = mode === "export" ? "Export lịch sử" : "Import lịch sử";
  $("modalHint").textContent =
    mode === "export"
      ? "Copy đoạn này để lưu/đổi máy. Không chia sẻ công khai nếu bạn không muốn lộ lịch sử."
      : "Dán đoạn Export vào ô rồi Apply.";
  if(mode==="export"){
    $("modalText").value = exportData();
    $("btnApply").style.display = "none";
  }else{
    $("modalText").value = "";
    $("btnApply").style.display = "inline-flex";
  }
}
function closeModal(){ $("modal").classList.add("hidden"); }
async function copyModal(){
  const text = $("modalText").value.trim();
  if(!text) return toast("Trống.");
  try{
    await navigator.clipboard.writeText(text);
    toast("Đã copy.");
  }catch{
    toast("Không copy được (trình duyệt chặn).");
  }
}
async function pasteModal(){
  try{
    const t = await navigator.clipboard.readText();
    $("modalText").value = t || "";
    toast("Đã dán.");
  }catch{
    toast("Không dán được (trình duyệt chặn).");
  }
}
function applyModal(){
  if(modalMode!=="import") return;
  const raw = $("modalText").value.trim();
  if(!raw) return toast("Chưa dán dữ liệu.");
  const ok = importData(raw);
  if(ok){
    closeModal();
    toast("Import OK.");
    render();
  }else{
    toast("Import lỗi. Dữ liệu không đúng.");
  }
}

/* ---------- core actions ---------- */
function add(x){
  history.push({ x, t: Date.now() });
  save();
  render();
}
function undo(){
  if(history.length===0) return;
  history.pop();
  save();
  render();
}
function resetAll(){
  if(!confirm("Reset toàn bộ lịch sử?")) return;
  history = [];
  save();
  render();
}
function removeAt(indexFromEnd){
  // UI shows latest first; indexFromEnd is in that list
  const idx = history.length - 1 - indexFromEnd;
  if(idx<0 || idx>=history.length) return;
  history.splice(idx,1);
  save();
  render();
}

/* =========================
   Stats helpers
========================= */
function lastN(arr,n){ return arr.length<=n ? arr.slice() : arr.slice(arr.length-n); }

function countAll(arr){
  let b=0,p=0,t=0;
  for(const it of arr){
    if(it.x==="B") b++;
    else if(it.x==="P") p++;
    else t++;
  }
  return {b,p,t,total:arr.length};
}

function bpOnly(arr){ return arr.filter(it=>it.x==="B"||it.x==="P"); }

function streak(arr){
  const bp = bpOnly(arr);
  if(bp.length===0) return {side:"-",len:0,text:"-"};
  const last = bp[bp.length-1].x;
  let len=1;
  for(let i=bp.length-2;i>=0;i--){
    if(bp[i].x===last) len++;
    else break;
  }
  return {side:last,len,text:`${last} x${len}`};
}

function longestStreak(arr){
  const bp = bpOnly(arr);
  if(bp.length===0) return {side:"-",len:0,text:"-"};
  let bestSide = bp[0].x, best=1;
  let curSide = bp[0].x, cur=1;
  for(let i=1;i<bp.length;i++){
    if(bp[i].x===curSide) cur++;
    else { curSide=bp[i].x; cur=1; }
    if(cur>best){ best=cur; bestSide=curSide; }
  }
  return {side:bestSide,len:best,text:`${bestSide} x${best}`};
}

function altRateBP(arr){
  const bp = arr.map(it=>it.x);
  if(bp.length<2) return {pct:0,text:"-"};
  let alt=0;
  for(let i=1;i<bp.length;i++) if(bp[i]!==bp[i-1]) alt++;
  const pct = Math.round(alt/(bp.length-1)*100);
  return {pct,text:`${pct}% (đổi ${alt}/${bp.length-1})`};
}

function tieRate(arr){
  if(arr.length===0) return {pct:0,text:"-"};
  const t = arr.filter(it=>it.x==="T").length;
  const pct = Math.round(t/arr.length*100);
  return {pct,text:`${pct}% (${t}/${arr.length})`};
}

function lastBPText(arr){
  const bp = bpOnly(arr).map(it=>it.x);
  if(bp.length===0) return "-";
  const last = lastN(bp,20);
  const b = last.filter(x=>x==="B").length;
  const p = last.filter(x=>x==="P").length;
  return `B:${b} • P:${p} • Tổng:${last.length}`;
}

/* =========================
   Road builders (Big Road + Derived)
   - Big Road ignores Tie placements, but ties attach to last Big cell
========================= */

function buildBigRoadWithTies(arr){
  // Big road cells: {v:'B'|'P', tie:number}
  const seq = [];
  let tiePending = 0;

  // convert history -> B/P cells, ties attached to previous B/P cell
  for(const it of arr){
    if(it.x==="T"){
      tiePending++;
      continue;
    }
    // B/P
    seq.push({ v: it.x, tie: tiePending });
    tiePending = 0;
  }
  // if ties occur at very beginning with no B/P yet, we ignore them visually
  // (could also show tie on bead only)

  const cols = []; // each col is array len 6, cell or null
  let c=0,r=0;

  function ensureCol(i){
    if(!cols[i]) cols[i] = Array(6).fill(null);
  }
  if(seq.length===0) return {cols, seq};

  ensureCol(0);
  cols[0][0] = seq[0];
  c=0; r=0;

  for(let i=1;i<seq.length;i++){
    const cur = seq[i];
    const prev = seq[i-1];

    if(cur.v === prev.v){
      // same side: go down if possible else go right keeping row
      if(r<5 && cols[c][r+1]===null){
        r++;
        cols[c][r] = cur;
      }else{
        c++;
        ensureCol(c);
        cols[c][r] = cur;
      }
    }else{
      // change: new column, row = 0
      c++;
      r=0;
      ensureCol(c);
      cols[c][r] = cur;
    }
  }
  return { cols, seq };
}

/**
 * Build derived road sequence (R/B) based on Big Road placements.
 * Standard-ish practical rules:
 * For each Big Road placement at (col=c, row=r) in bigCols:
 *  - Skip until enough reference columns exist.
 *  - If r==0 (new column): compare length of previous column and the reference column:
 *      len(prevCol) == len(refCol) => Red else Blue
 *  - If r>0 (continuation): compare presence at (refColIndex, r):
 *      exists => Red else Blue
 *
 * offset: 1=BigEye(ref col = c-2 for r==0, and c-1 for r>0?) -> we generalize using:
 *   For r==0: compare (c-1) vs (c-1-offset)
 *   For r>0: compare presence at (c-offset, r)
 * Using offset 2 for BigEye, 3 for Small, 4 for Cockroach (works well visually).
 */
function colLen(col){
  let n=0;
  for(let r=0;r<6;r++) if(col[r]) n++;
  return n;
}

function buildDerivedSeq(bigCols, offset){
  const seq = [];
  for(let c=0;c<bigCols.length;c++){
    for(let r=0;r<6;r++){
      if(!bigCols[c]?.[r]) continue;

      if(r===0){
        const a = c-1;
        const b = c-1-offset;
        if(a<0 || b<0) continue;
        const color = (colLen(bigCols[a]) === colLen(bigCols[b])) ? "R" : "B";
        seq.push(color);
      }else{
        const ref = c-offset;
        if(ref<0) continue;
        const color = bigCols[ref]?.[r] ? "R" : "B";
        seq.push(color);
      }
    }
  }
  return seq;
}

function buildRoadFromColorSeq(seq){
  // place colors like Big Road placement (6 rows)
  const cols = [];
  let c=0,r=0;

  function ensureCol(i){
    if(!cols[i]) cols[i] = Array(6).fill(null);
  }
  if(seq.length===0) return cols;

  ensureCol(0);
  cols[0][0] = seq[0];
  c=0;r=0;

  for(let i=1;i<seq.length;i++){
    const cur = seq[i];
    const prev = seq[i-1];

    if(cur===prev){
      if(r<5 && cols[c][r+1]===null){
        r++;
        cols[c][r]=cur;
      }else{
        c++;
        ensureCol(c);
        cols[c][r]=cur;
      }
    }else{
      c++;
      r=0;
      ensureCol(c);
      cols[c][r]=cur;
    }
  }
  return cols;
}

function buildBead(arr){
  // 72 items, 6 rows fill downward then next col
  const last = lastN(arr,72);
  const cols = [];
  let c=0,r=0;
  cols[c]=Array(6).fill(null);
  for(const it of last){
    cols[c][r]=it.x;
    r++;
    if(r>=6){ r=0; c++; cols[c]=Array(6).fill(null); }
  }
  return cols;
}

/* =========================
   Render matrices
========================= */
function renderMatrix(el, cols, palette, opts={}){
  const maxCols = 70;
  const slice = cols.length>maxCols ? cols.slice(cols.length-maxCols) : cols;

  const gridOn = $("toggleGrid").checked;
  const compact = $("toggleCompact").checked;

  el.classList.toggle("compact", compact);
  el.innerHTML="";

  for(let c=0;c<slice.length;c++){
    const col = slice[c] || Array(6).fill(null);
    for(let r=0;r<6;r++){
      const v = col[r];
      const div = document.createElement("div");
      div.className = "cell";
      if(gridOn) div.classList.add("gridOn");
      if(compact) div.classList.add("compact");

      if(v){
        const cls = palette[v];
        if(cls) div.classList.add(cls);
      }

      // tie mark for big road cells
      if(opts.big && v && typeof v === "object"){
        // v = {v:'B'|'P', tie:n}
        const cls = palette[v.v];
        if(cls) div.classList.add(cls);
        if(v.tie && v.tie>0){
          div.classList.add("tieMark");
          div.dataset.t = `x${v.tie}`;
        }
      }

      el.appendChild(div);
    }
  }
}

/* =========================
   Export/Import
========================= */
function exportData(){
  // small & safe package
  const payload = {
    v:1,
    created: Date.now(),
    items: history
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function importData(raw){
  try{
    const json = decodeURIComponent(escape(atob(raw)));
    const payload = JSON.parse(json);
    if(!payload || !Array.isArray(payload.items)) return false;

    // validate items
    const items = payload.items
      .filter(it=>it && (it.x==="B"||it.x==="P"||it.x==="T") && typeof it.t==="number")
      .map(it=>({x:it.x,t:it.t}));

    history = items;
    save();
    return true;
  }catch{
    return false;
  }
}

/* =========================
   PWA install + SW
========================= */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt",(e)=>{
  e.preventDefault();
  deferredPrompt = e;
  $("btnInstall").disabled = false;
});
$("btnInstall").onclick = async ()=>{
  if(!deferredPrompt) return toast("Nếu không hiện, hãy 'Add to Home screen' trong menu trình duyệt.");
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
};

if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
}

/* =========================
   Render all
========================= */
function render(){
  const {b,p,t,total} = countAll(history);
  $("bCount").textContent = b;
  $("pCount").textContent = p;
  $("tCount").textContent = t;
  $("total").textContent = total;

  const st = streak(history);
  const lg = longestStreak(history);
  $("streak").textContent = st.text;
  $("longest").textContent = lg.text;

  $("last20bp").textContent = lastBPText(history);
  $("tie20").textContent = tieRate(lastN(history,20)).text;
  $("alt20").textContent = altRateBP(lastN(bpOnly(history),20)).text;

  // history list (latest first)
  const limit = parseInt($("historyLimit").value,10);
  if(history.length===0){
    $("history").textContent = "Chưa có lịch sử.";
  }else{
    const last = (limit===9999) ? history.slice().reverse() : lastN(history,limit).slice().reverse();
    $("history").innerHTML = last.map((it,idx)=>{
      const x = it.x;
      const dotCls = x==="B" ? "b" : x==="P" ? "p" : "t";
      const time = new Date(it.t).toLocaleTimeString("vi-VN",{hour:"2-digit",minute:"2-digit"});
      return `
        <span class="tag" onclick="removeAt(${idx})" title="Chạm để xoá ván này">
          <span class="badgeDot ${dotCls}"></span>
          <b>${x}</b>
          <span class="time">${time}</span>
        </span>
      `;
    }).join("");
  }

  // roads
  const bead = buildBead(history);
  renderMatrix($("bead"), bead, {B:"cB",P:"cP",T:"cT"});

  const bigPack = buildBigRoadWithTies(history);
  // big cols contain objects -> use opts.big
  renderMatrix($("big"), bigPack.cols, {B:"cB",P:"cP"}, {big:true});

  // derived roads
  const eyeSeq = buildDerivedSeq(bigPack.cols, 2);
  const smallSeq = buildDerivedSeq(bigPack.cols, 3);
  const cockSeq = buildDerivedSeq(bigPack.cols, 4);

  const eye = buildRoadFromColorSeq(eyeSeq);
  const small = buildRoadFromColorSeq(smallSeq);
  const cock = buildRoadFromColorSeq(cockSeq);

  renderMatrix($("eye"), eye, {R:"cRed",B:"cBlue"});
  renderMatrix($("small"), small, {R:"cRed",B:"cBlue"});
  renderMatrix($("cock"), cock, {R:"cRed",B:"cBlue"});
}

render();
