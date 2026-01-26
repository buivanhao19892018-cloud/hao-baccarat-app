/*  Hào Baccarat — C6 GOD MODE
    - Lưu localStorage
    - Bead Plate (72) + Big Road (6 rows)
    - Stats sâu + cảnh báo nhiễu/bẫy
    - Export/Import JSON + Journal
*/
const KEY = "hao_baccarat_c6_godmode_v1";

const state = load() || {
  shoeId: new Date().toISOString(),
  history: [],          // {x:'B'|'P'|'T', t:ms}
  note: ""
};

const $ = (id) => document.getElementById(id);

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

/* ---------- Core actions ---------- */
function addResult(x) {
  state.history.push({ x, t: Date.now() });
  save();
  render();
}

function undo() {
  state.history.pop();
  save();
  render();
}

function resetAll() {
  if (!confirm("Reset toàn bộ lịch sử ván?")) return;
  state.history = [];
  save();
  render();
}

function newShoe() {
  if (!confirm("New shoe: giữ ghi chú, xoá lịch sử ván?")) return;
  state.shoeId = new Date().toISOString();
  state.history = [];
  save();
  render();
}

function clearLocal() {
  if (!confirm("Xoá dữ liệu lưu máy (localStorage)?")) return;
  localStorage.removeItem(KEY);
  location.reload();
}

/* ---------- Export / Import ---------- */
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hao-baccarat-${state.shoeId.replace(/[:.]/g,"-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || !Array.isArray(data.history)) throw new Error("Bad file");
      state.shoeId = data.shoeId || new Date().toISOString();
      state.history = data.history;
      state.note = data.note || "";
      save();
      render();
      alert("Import OK!");
    } catch (e) {
      alert("File import không hợp lệ.");
    }
  };
  reader.readAsText(file);
}

/* ---------- Metrics ---------- */
function onlyBP(arr) {
  return arr.filter(r => r.x === "B" || r.x === "P").map(r => r.x);
}

function lastN(arr, n) {
  return arr.slice(Math.max(0, arr.length - n));
}

function streakInfo(bpArr) {
  if (bpArr.length === 0) return { now: "-", max: 0 };
  let max = 1, cur = 1;
  for (let i = 1; i < bpArr.length; i++) {
    if (bpArr[i] === bpArr[i-1]) cur++;
    else cur = 1;
    if (cur > max) max = cur;
  }
  // current streak
  let now = 1;
  for (let i = bpArr.length - 1; i > 0; i--) {
    if (bpArr[i] === bpArr[i-1]) now++;
    else break;
  }
  return { now: `${bpArr[bpArr.length-1]} × ${now}`, max };
}

function alternationRate(bpArr) {
  if (bpArr.length < 2) return 0;
  let alt = 0;
  for (let i = 1; i < bpArr.length; i++) if (bpArr[i] !== bpArr[i-1]) alt++;
  return alt / (bpArr.length - 1); // 0..1
}

function tieRate(histArr) {
  if (histArr.length === 0) return 0;
  const t = histArr.filter(r => r.x === "T").length;
  return t / histArr.length; // 0..1
}

function entropyBP(bpArr) {
  // Shannon entropy for B/P distribution (0..1)
  if (bpArr.length === 0) return 0;
  const b = bpArr.filter(x => x === "B").length / bpArr.length;
  const p = 1 - b;
  const H = (q) => (q <= 0 ? 0 : -q * Math.log2(q));
  const h = H(b) + H(p); // max 1 when 50/50
  return Math.min(1, h);
}

function markov(bpArr) {
  // transitions: BB, BP, PB, PP
  const m = { BB:0, BP:0, PB:0, PP:0 };
  if (bpArr.length < 2) return m;
  for (let i = 1; i < bpArr.length; i++) {
    const k = bpArr[i-1] + bpArr[i];
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function markovText(m) {
  const bb = m.BB || 0, bp = m.BP || 0, pb = m.PB || 0, pp = m.PP || 0;
  const fromB = bb + bp;
  const fromP = pb + pp;
  const pBB = fromB ? (bb/fromB) : 0;
  const pBP = fromB ? (bp/fromB) : 0;
  const pPB = fromP ? (pb/fromP) : 0;
  const pPP = fromP ? (pp/fromP) : 0;

  const fmt = (x)=> (x*100).toFixed(1)+"%";
  return [
    `From B → B: ${fmt(pBB)} | From B → P: ${fmt(pBP)}`,
    `From P → B: ${fmt(pPB)} | From P → P: ${fmt(pPP)}`,
    `Counts: BB=${bb}, BP=${bp}, PB=${pb}, PP=${pp}`
  ].join("\n");
}

function scoreEngine(hist) {
  // “Pro trader style”: đo cấu trúc + nhiễu, không hứa hẹn win.
  const bp = onlyBP(hist);
  const hist20 = lastN(hist, 20);
  const bp20 = onlyBP(hist20);

  const alt = alternationRate(bp20);      // 0..1
  const tr  = tieRate(hist20);            // 0..1
  const ent = entropyBP(bp20);            // 0..1
  const { now, max } = streakInfo(bp20);

  // volatility proxy: nhiều đổi nhịp + entropy cao => nhiễu
  const noise = 0.55*alt + 0.45*ent;      // 0..1
  // structure proxy: streak vừa phải + alt vừa phải => “có dạng”
  const structure = 1 - Math.abs(alt - 0.55); // peak near 0.55
  const tiePenalty = Math.min(1, tr / 0.25);  // tie >25% coi là nhiễu mạnh

  // base score
  let score = 60;

  // dữ liệu ít -> kéo về trung tính
  if (hist.length < 12) score -= 8;
  if (hist.length < 6) score -= 12;

  // noise giảm điểm
  score -= 18 * noise;

  // tie giảm điểm
  score -= 12 * tiePenalty;

  // structure tăng nhẹ (không quá tay)
  score += 10 * structure;

  // streak quá dài => cảnh báo “đuối/đảo chiều”
  const lastChar = bp20[bp20.length-1];
  let curStreak = 1;
  for (let i = bp20.length - 1; i > 0; i--) {
    if (bp20[i] === bp20[i-1]) curStreak++;
    else break;
  }
  if (curStreak >= 5) score -= 10; // risk: late streak

  // clamp
  score = Math.max(0, Math.min(100, Math.round(score)));

  // tag + explain
  let tag = "TRUNG TÍNH";
  if (score >= 75) tag = "ỔN ĐỊNH";
  if (score >= 85) tag = "RÕ NHỊP";
  if (score <= 45) tag = "NHIỄU";
  if (score <= 30) tag = "RẤT NHIỄU";

  const explain = [];
  if (hist.length < 12) explain.push("Dữ liệu còn ít → ưu tiên quan sát thêm.");
  explain.push(`Alt20=${Math.round(alt*100)}% · Tie20=${Math.round(tr*100)}% · Entropy(B/P)≈${Math.round(ent*100)}%`);
  explain.push(`Streak: ${now} · Longest(20): ${max}`);

  const warn = [];
  if (tr >= 0.20) warn.push("Tie nhiều → không kết luận đổi cầu vội.");
  if (noise >= 0.70) warn.push("Nhịp đảo + phân bố 50/50 → nhiễu cao, dễ bẫy.");
  if (curStreak >= 5) warn.push("Bệt dài → cuối bệt dễ ‘gãy’, cân nhắc chờ xác nhận.");
  if (hist.length >= 20 && score >= 80) warn.push("Có dạng, nhưng vẫn ưu tiên vào nhỏ + kỷ luật Undo/Reset khi lệch nhịp.");

  return { score, tag, explain: explain.join(" "), warn: warn.join(" · ") };
}

/* ---------- Road rendering ---------- */
function renderBead(hist) {
  const bead = $("bead");
  bead.innerHTML = "";
  const show = lastN(hist, 72);
  for (const r of show) {
    const d = document.createElement("div");
    d.className = "cell " + (r.x === "B" ? "b" : r.x === "P" ? "p" : "t");
    d.title = new Date(r.t).toLocaleTimeString();
    d.textContent = r.x;
    bead.appendChild(d);
  }
}

function buildBigRoad(hist) {
  // Standard-ish big road, 6 rows; tie doesn't move position (we mark tie count on cell).
  const bp = hist.filter(r => r.x === "B" || r.x === "P" || r.x === "T").map(r => r.x);
  const rows = 6;

  // each cell: {x:'B'|'P', ties:n}
  const grid = []; // grid[col][row]
  let col = 0, row = 0;
  let last = null;

  const ensure = (c)=> { if (!grid[c]) grid[c] = Array(rows).fill(null); };

  for (const x of bp) {
    if (x === "T") {
      // add tie marker to current cell
      if (last && grid[col] && grid[col][row]) grid[col][row].ties = (grid[col][row].ties || 0) + 1;
      continue;
    }

    if (last === null) {
      ensure(col);
      grid[col][row] = { x, ties: 0 };
      last = x;
      continue;
    }

    if (x === last) {
      // try go down
      if (row + 1 < rows && grid[col][row+1] === null) {
        row++;
      } else {
        // go right (stay same row)
        col++;
      }
    } else {
      // new color -> new column, reset row
      col++;
      row = 0;
    }

    ensure(col);
    // collision: if occupied, push right until free (common big-road behavior)
    while (grid[col][row] !== null) {
      col++;
      ensure(col);
    }
    grid[col][row] = { x, ties: 0 };
    last = x;
  }

  return grid;
}

function renderBigRoad(grid) {
  const root = $("bigroad");
  root.innerHTML = "";

  const rows = 6;
  // measure columns to show (cap for mobile)
  const cols = Math.min(grid.length, 40);

  for (let r = 0; r < rows; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "brRow";
    for (let c = Math.max(0, grid.length - cols); c < grid.length; c++) {
      const cell = document.createElement("div");
      cell.className = "brCell";
      const v = grid[c]?.[r] || null;
      if (v) {
        cell.classList.add(v.x === "B" ? "b" : "p");
        cell.textContent = v.ties ? `${v.x}${v.ties}` : v.x;
      } else {
        cell.textContent = "";
      }
      rowEl.appendChild(cell);
    }
    root.appendChild(rowEl);
  }
}

/* ---------- History list ---------- */
function renderHistory(hist) {
  const root = $("history");
  root.innerHTML = "";
  if (hist.length === 0) {
    root.innerHTML = `<div class="muted">Chưa có lịch sử. Bấm Banker/Player/Tie để bắt đầu.</div>`;
    return;
  }
  const list = document.createElement("div");
  list.className = "hList";

  hist.slice().reverse().forEach((r, idxRev) => {
    const idx = hist.length - 1 - idxRev;
    const item = document.createElement("div");
    item.className = "hItem " + (r.x === "B" ? "b" : r.x === "P" ? "p" : "t");
    item.innerHTML = `<b>${r.x}</b> <span>${new Date(r.t).toLocaleTimeString()}</span>`;
    item.onclick = () => {
      if (!confirm(`Xoá ván #${idx+1} (${r.x}) ?`)) return;
      state.history.splice(idx, 1);
      save();
      render();
    };
    list.appendChild(item);
  });

  root.appendChild(list);
}

/* ---------- Stats panel ---------- */
function renderStats(hist) {
  const bp = onlyBP(hist);
  const hist20 = lastN(hist, 20);
  const bp20 = onlyBP(hist20);

  const b = bp.filter(x => x === "B").length;
  const p = bp.filter(x => x === "P").length;
  const t = hist.filter(r => r.x === "T").length;

  const altAll = alternationRate(bp);
  const alt20 = alternationRate(bp20);
  const tieAll = tieRate(hist);
  const tie20 = tieRate(hist20);
  const ent20 = entropyBP(bp20);

  const m = markov(bp20);

  const cards = [
    ["Tổng ván", String(hist.length)],
    ["B / P / T", `${b} / ${p} / ${t}`],
    ["Alt rate (all B/P)", `${Math.round(altAll*100)}%`],
    ["Alt rate (last 20)", `${Math.round(alt20*100)}%`],
    ["Tie rate (all)", `${Math.round(tieAll*100)}%`],
    ["Tie rate (last 20)", `${Math.round(tie20*100)}%`],
    ["Entropy B/P (last 20)", `${Math.round(ent20*100)}%`],
    ["Markov BB/BP/PB/PP", `${m.BB||0}/${m.BP||0}/${m.PB||0}/${m.PP||0}`],
  ];

  const grid = $("statsGrid");
  grid.innerHTML = "";
  for (const [k,v] of cards) {
    const el = document.createElement("div");
    el.className = "statCard";
    el.innerHTML = `<div class="k">${k}</div><div class="v">${v}</div>`;
    grid.appendChild(el);
  }

  $("markov").textContent = markovText(m);
}

/* ---------- Main render ---------- */
function render() {
  // counts
  const bCount = state.history.filter(r => r.x === "B").length;
  const pCount = state.history.filter(r => r.x === "P").length;
  const tCount = state.history.filter(r => r.x === "T").length;

  $("bCount").textContent = bCount;
  $("pCount").textContent = pCount;
  $("tCount").textContent = tCount;
  $("total").textContent = state.history.length;

  // streak
  const bp = onlyBP(state.history);
  const { now, max } = streakInfo(lastN(bp, 20));
  $("streakNow").textContent = now;
  $("streakMax").textContent = max ? String(max) : "-";

  // last20 quick
  const hist20 = lastN(state.history, 20);
  const alt20 = alternationRate(onlyBP(hist20));
  const tie20 = tieRate(hist20);
  $("alt20").textContent = state.history.length < 2 ? "-" : `${Math.round(alt20*100)}%`;
  $("tie20").textContent = state.history.length < 1 ? "-" : `${Math.round(tie20*100)}%`;

  // score
  const s = scoreEngine(state.history);
  $("score").textContent = s.score;
  $("tag").textContent = s.tag;
  $("explain").textContent = s.explain;
  $("warn").textContent = s.warn;

  // roads
  renderBead(state.history);
  const big = buildBigRoad(state.history);
  renderBigRoad(big);

  // history & stats
  renderHistory(state.history);
  renderStats(state.history);

  // note
  $("note").value = state.note || "";
}

/* ---------- Tabs ---------- */
function setupTabs() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      document.querySelectorAll(".tabBody").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      const name = btn.getAttribute("data-tab");
      $("tab-" + name).classList.add("active");
    });
  });
}

/* ---------- Wire UI ---------- */
function boot() {
  $("btnB").onclick = () => addResult("B");
  $("btnP").onclick = () => addResult("P");
  $("btnT").onclick = () => addResult("T");
  $("btnU").onclick = () => undo();
  $("btnR").onclick = () => resetAll();
  $("btnNewShoe").onclick = () => newShoe();
  $("btnExport").onclick = () => exportJSON();
  $("btnClearLS").onclick = () => clearLocal();

  $("fileImport").addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importJSON(f);
    e.target.value = "";
  });

  $("note").addEventListener("input", (e) => {
    state.note = e.target.value;
    save();
  });

  // keyboard shortcuts (PC)
  window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT")) return;
    const k = e.key.toLowerCase();
    if (k === "b") addResult("B");
    if (k === "p") addResult("P");
    if (k === "t") addResult("T");
    if (k === "z") undo();
  });

  setupTabs();
  render();
}
boot();
