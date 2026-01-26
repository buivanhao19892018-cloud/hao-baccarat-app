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

  return { c20, bPct, pPct, tPct, edge, noise, conf, alt, ent, st };
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
