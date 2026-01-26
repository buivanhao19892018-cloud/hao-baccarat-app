const KEY = "hao_baccarat_history_v1";
let history = JSON.parse(localStorage.getItem(KEY) || "[]");

function save() {
  localStorage.setItem(KEY, JSON.stringify(history));
}

function addResult(x) {
  history.push({ x, t: Date.now() }); // x: 'B'|'P'|'T'
  save();
  render();
}

function resetAll() {
  if (!confirm("Reset toàn bộ lịch sử?")) return;
  history = [];
  save();
  render();
}

function stats() {
  const total = history.length;
  const b = history.filter(i => i.x === "B").length;
  const p = history.filter(i => i.x === "P").length;
  const t = history.filter(i => i.x === "T").length;

  // bệt hiện tại (bỏ qua Tie)
  let streak = 0, streakSide = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const x = history[i].x;
    if (x === "T") continue;
    if (streakSide === null) { streakSide = x; streak = 1; }
    else if (x === streakSide) streak++;
    else break;
  }

  return { total, b, p, t, streak, streakSide };
}

// phát hiện ping-pong trong N ván gần nhất (bỏ tie)
function isPingPong(N = 8) {
  const arr = history.map(i => i.x).filter(x => x !== "T");
  const last = arr.slice(-N);
  if (last.length < 6) return false;
  for (let i = 1; i < last.length; i++) {
    if (last[i] === last[i - 1]) return false;
  }
  return true;
}

function aiSignal() {
  const s = stats();
  if (s.total < 6) return "Chưa đủ dữ liệu. Nhập thêm 6–10 ván để AI đọc cầu.";

  if (isPingPong(8)) {
    return "TÍN HIỆU: Cầu đảo 1-1 (ping-pong). Ưu tiên bắt nhịp đảo, giảm gấp thếp.";
  }

  if (s.streakSide && s.streak >= 4) {
    return `TÍN HIỆU: Bệt ${s.streakSide === "B" ? "Banker" : "Player"} x ${s.streak}. Ưu tiên theo bệt, chờ xác nhận trước khi bắt đảo.`;
  }

  // cảnh báo sau tie
  const last = history[history.length - 1]?.x;
  if (last === "T") {
    return "TÍN HIỆU: Vừa ra Tie. Không vội kết luận đổi cầu. Chờ 1 ván xác nhận.";
  }

  return "TÍN HIỆU: Cầu trung tính. Ưu tiên quan sát 2–3 ván để xác định bệt/đảo rõ hơn.";
}

function render() {
  const s = stats();
  document.getElementById("total").textContent = s.total;
  document.getElementById("bCount").textContent = s.b;
  document.getElementById("pCount").textContent = s.p;
  document.getElementById("tCount").textContent = s.t;

  document.getElementById("streak").textContent =
    s.streakSide ? `${s.streakSide} x ${s.streak}` : "—";

  document.getElementById("signal").textContent = aiSignal();

  const list = document.getElementById("history");
  list.innerHTML = history.slice().reverse().slice(0, 30).map(i => {
    const x = i.x === "B" ? "Banker" : i.x === "P" ? "Player" : "Tie";
    return `<div class="row">${x}</div>`;
  }).join("");
}

window.addEventListener("load", render);
