(() => {
  // ===== VERSION (đổi số này mỗi lần update để dễ biết đã lên bản mới) =====
  const APP_VERSION = "ULTRA_AI_V3_1.0.0";

  // ===== STORAGE =====
  const KEY = "hao_baccarat_ultra_v3_state";
  const defaultState = () => ({
    version: APP_VERSION,
    shoe: 1,
    hands: [], // {t, res:'B'|'P'|'T', cards:{b:[..],p:[..]}, flags:{bPair,pPair,bNat,pNat}}
  });

  const load = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const st = JSON.parse(raw);
      if (!st || !Array.isArray(st.hands)) return defaultState();
      // keep older data even if version changes
      return { ...defaultState(), ...st };
    } catch {
      return defaultState();
    }
  };

  const save = () => localStorage.setItem(KEY, JSON.stringify(state));

  let state = load();

  // ===== DOM =====
  const $ = (id) => document.getElementById(id);

  const els = {
    cntB: $("cntB"),
    cntP: $("cntP"),
    cntT: $("cntT"),
    shoeNo: $("shoeNo"),
    totalHands: $("totalHands"),

    btnB: $("btnB"),
    btnP: $("btnP"),
    btnT: $("btnT"),
    btnUndo: $("btnUndo"),
    btnReset: $("btnReset"),
    btnNewShoe: $("btnNewShoe"),

    b1: $("b1"), b2: $("b2"), b3: $("b3"),
    p1: $("p1"), p2: $("p2"), p3: $("p3"),
    bTotal: $("bTotal"), pTotal: $("pTotal"),
    bPair: $("bPair"), pPair: $("pPair"),
    bNat: $("bNat"), pNat: $("pNat"),

    aiAction: $("aiAction"),
    aiPhase: $("aiPhase"),
    aiLean: $("aiLean"),
    aiTrap: $("aiTrap"),
    kConf: $("kConf"),
    kNoise: $("kNoise"),
    kEdge: $("kEdge"),
    confTxt: $("confTxt"),
    noiseTxt: $("noiseTxt"),
    edgeTxt: $("edgeTxt"),
    confBar: $("confBar"),
    noiseBar: $("noiseBar"),
    edgeBar: $("edgeBar"),
    aiNote: $("aiNote"),

    last12: $("last12"),
    last30: $("last30"),
    last50: $("last50"),
    altRate: $("altRate"),
    pairRate: $("pairRate"),
    natRate: $("natRate"),

    btnExport: $("btnExport"),
    btnImport: $("btnImport"),
    fileImport: $("fileImport"),

    history: $("history"),
    histLimit: $("histLimit"),
  };

  // ===== CARD VALUE MAP =====
  // Baccarat point: A=1,2..9 as is, 10/J/Q/K = 0
  const CARD_OPTS = [
    { v: "",  label: "—" },
    { v: "A", label: "A(1)" },
    { v: "2", label: "2" },
    { v: "3", label: "3" },
    { v: "4", label: "4" },
    { v: "5", label: "5" },
    { v: "6", label: "6" },
    { v: "7", label: "7" },
    { v: "8", label: "8" },
    { v: "9", label: "9" },
    { v: "0", label: "10/J/Q/K(0)" },
  ];

  const pointOf = (c) => {
    if (!c) return null;
    if (c === "A") return 1;
    if (c === "0") return 0;
    const n = Number(c);
    if (!Number.isFinite(n)) return null;
    return n;
  };

  const sumPointsMod10 = (arr) => {
    const pts = arr.map(pointOf).filter((x) => x !== null);
    if (pts.length === 0) return 0;
    const s = pts.reduce((a, b) => a + b, 0);
    return s % 10;
  };

  const detectPair2 = (a, b) => (!!a && !!b && a === b);

  const detectNatural = (twoCardsArr, third) => {
    // "Long Bảo" = Natural 8 or 9 using first 2 cards and no 3rd card chosen
    if (!twoCardsArr[0] || !twoCardsArr[1]) return false;
    if (third) return false;
    const t = sumPointsMod10(twoCardsArr.slice(0, 2));
    return t === 8 || t === 9;
  };

  // ===== POPULATE SELECTS =====
  const fillSelect = (sel) => {
    sel.innerHTML = "";
    for (const o of CARD_OPTS) {
      const opt = document.createElement("option");
      opt.value = o.v;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
  };

  [els.b1, els.b2, els.b3, els.p1, els.p2, els.p3].forEach(fillSelect);

  // ===== CURRENT INPUT (cards) =====
  const getCardInput = () => {
    const b = [els.b1.value, els.b2.value, els.b3.value].filter(x => x !== "");
    const p = [els.p1.value, els.p2.value, els.p3.value].filter(x => x !== "");
    const flags = {
      bPair: detectPair2(els.b1.value, els.b2.value),
      pPair: detectPair2(els.p1.value, els.p2.value),
      bNat: detectNatural([els.b1.value, els.b2.value], els.b3.value),
      pNat: detectNatural([els.p1.value, els.p2.value], els.p3.value),
    };
    return { b, p, flags };
  };

  const updateCardPreview = () => {
    const { b, p, flags } = getCardInput();
    els.bTotal.textContent = String(sumPointsMod10(b));
    els.pTotal.textContent = String(sumPointsMod10(p));
    els.bPair.textContent = flags.bPair ? "YES" : "NO";
    els.pPair.textContent = flags.pPair ? "YES" : "NO";
    els.bNat.textContent  = flags.bNat ? "YES (8/9)" : "NO";
    els.pNat.textContent  = flags.pNat ? "YES (8/9)" : "NO";
  };

  [els.b1, els.b2, els.b3, els.p1, els.p2, els.p3].forEach(s => {
    s.addEventListener("change", updateCardPreview);
  });

  // ===== ADD HAND =====
  const addHand = (res) => {
    const now = Date.now();
    const ci = getCardInput();
    state.hands.push({
      t: now,
      res,
      cards: { b: ci.b, p: ci.p },
      flags: ci.flags,
      shoe: state.shoe,
    });
    save();
    render();
  };

  const undo = () => {
    state.hands.pop();
    save();
    render();
  };

  const resetAll = () => {
    if (!confirm("RESET sẽ xoá toàn bộ lịch sử. Chắc chắn?")) return;
    state = defaultState();
    save();
    render();
  };

  const newShoe = () => {
    state.shoe += 1;
    save();
    render();
  };

  // ===== STATS HELPERS =====
  const lastN = (arr, n) => arr.slice(Math.max(0, arr.length - n));

  const stripBP = (hands) => hands
    .map(h => h.res)
    .filter(r => r === "B" || r === "P"); // ignore ties for BP analysis

  const count = (hands) => {
    let B=0,P=0,T=0;
    for (const h of hands) {
      if (h.res==="B") B++;
      else if (h.res==="P") P++;
      else T++;
    }
    return {B,P,T,total:hands.length};
  };

  const altRateBP = (seqBP) => {
    if (seqBP.length < 2) return 0;
    let alt = 0;
    for (let i=1;i<seqBP.length;i++) if (seqBP[i] !== seqBP[i-1]) alt++;
    return alt / (seqBP.length - 1);
  };

  const longestStreakBP = (seqBP) => {
    let best=0, cur=0, curSide=null;
    for (const x of seqBP) {
      if (x === curSide) cur++;
      else { curSide = x; cur = 1; }
      if (cur > best) best = cur;
    }
    return best;
  };

  // Binary entropy for p(B)
  const entropy01 = (p) => {
    if (p <= 0 || p >= 1) return 0;
    return -(p*Math.log2(p) + (1-p)*Math.log2(1-p)); // 0..1
  };

  // Wilson interval width -> confidence proxy
  const wilsonCenter = (k, n, z=1.0) => {
    // returns center estimate for p
    if (n === 0) return 0.5;
    const phat = k/n;
    const denom = 1 + (z*z)/n;
    const center = (phat + (z*z)/(2*n)) / denom;
    return center;
  };

  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ===== "AI" (OBSERVATION ENGINE) =====
  const analyze = () => {
    const hands = state.hands;
    const bpAll = stripBP(hands);

    const w12 = stripBP(lastN(hands, 12));
    const w30 = stripBP(lastN(hands, 30));
    const w50 = stripBP(lastN(hands, 50));

    const cntAll = count(hands);
    const cntBP30 = { B: w30.filter(x=>x==="B").length, P: w30.filter(x=>x==="P").length, n: w30.length };
    const cntBP12 = { B: w12.filter(x=>x==="B").length, P: w12.filter(x=>x==="P").length, n: w12.length };

    const pB30 = cntBP30.n ? cntBP30.B / cntBP30.n : 0.5;
    const pB12 = cntBP12.n ? cntBP12.B / cntBP12.n : 0.5;

    const e30 = entropy01(pB30); // 0..1
    const alt30 = altRateBP(w30); // 0..1

    // Noise: blend of entropy + high alternation (đảo) + low sample penalty
    const samplePenalty = cntBP30.n < 12 ? 0.25 : 0;
    const noise = clamp( (e30*0.55 + alt30*0.45) + samplePenalty, 0, 1 );

    // Confidence: more sample + clearer lean + lower noise
    const leanMag = Math.abs(pB30 - 0.5) * 2; // 0..1
    const nFactor = clamp(cntBP30.n / 50, 0, 1); // 0..1
    const conf = clamp( (nFactor*0.45 + leanMag*0.45 + (1-noise)*0.10), 0, 1 );

    // Edge (obs): deviation scaled by sqrt(n), capped
    const edgeRaw = (pB30 - 0.5) * 2; // -1..1
    const edge = clamp(edgeRaw * Math.sqrt(Math.max(1, cntBP30.n))/3, -1, 1); // -1..1

    // Trap detection: high noise or high alternation & low lean
    let trap = "—";
    if (cntBP30.n < 12) trap = "DATA LOW";
    else if (noise > 0.72) trap = "NOISE HIGH";
    else if (alt30 > 0.68 && leanMag < 0.18) trap = "ĐẢO NHIỀU";
    else if (longestStreakBP(w30) >= 6 && alt30 < 0.35) trap = "DỄ ĐU DÂY";
    else trap = "OK";

    // Phase (simple)
    let phase = "CÂN";
    if (cntBP30.n < 12) phase = "DỮ LIỆU ÍT";
    else if (noise > 0.72) phase = "NHIỄU";
    else if (leanMag < 0.12) phase = "CÂN";
    else phase = "LỆCH";

    // Lean
    let lean = "NONE";
    if (cntBP30.n >= 12) {
      if (pB30 > 0.55) lean = "BANKER";
      else if (pB30 < 0.45) lean = "PLAYER";
      else lean = "NONE";
    }

    // Action: WAIT / OBSERVE / SKIP (no betting instruction)
    let action = "WAIT";
    let note = "Chưa đủ dữ liệu. Nhập thêm ván để AI phân tích nhịp.";
    if (cntBP30.n >= 12) {
      if (trap !== "OK") {
        action = "SKIP";
        note = `Cảnh báo: ${trap}. Nên quan sát thêm, tránh quyết định vội.`;
      } else if (conf >= 0.62 && lean !== "NONE" && noise <= 0.60) {
        action = "OBSERVE";
        note = `Nhịp tương đối rõ (Last30). Lean nghiêng về ${lean}. Đây là thống kê quan sát, không đảm bảo kết quả.`;
      } else {
        action = "WAIT";
        note = `Nhịp chưa đủ rõ hoặc còn nhiễu. Ưu tiên chờ thêm dữ liệu.`;
      }
    }

    return {
      cntAll,
      w12, w30, w50,
      pB12, pB30,
      alt30,
      noise, conf, edge,
      phase, lean, trap, action, note
    };
  };

  // ===== PAIR / NAT RATE =====
  const calcPairNatRates = (hands) => {
    if (hands.length === 0) return { pair:0, nat:0 };
    let pairCount=0, natCount=0;
    for (const h of hands) {
      if (h.flags?.bPair) pairCount++;
      if (h.flags?.pPair) pairCount++;
      if (h.flags?.bNat) natCount++;
      if (h.flags?.pNat) natCount++;
    }
    // each hand can contribute up to 2 sides
    const denom = hands.length * 2;
    return { pair: pairCount/denom, nat: natCount/denom };
  };

  // ===== RENDER =====
  const fmtPct = (x) => `${Math.round(x*100)}%`;

  const renderHistory = () => {
    const limit = Number(els.histLimit.value || 200);
    const hands = lastN(state.hands, limit);
    els.history.innerHTML = "";

    for (let i = hands.length - 1; i >= 0; i--) {
      const h = hands[i];
      const node = document.createElement("div");
      node.className = "item";

      const tag = document.createElement("span");
      tag.className = "tag " + (h.res==="B" ? "tagB" : h.res==="P" ? "tagP" : "tagT");
      tag.textContent = h.res;

      const meta = document.createElement("span");
      meta.className = "meta";
      const d = new Date(h.t);
      const hh = String(d.getHours()).padStart(2,"0");
      const mm = String(d.getMinutes()).padStart(2,"0");

      const f = h.flags || {};
      const extras = [];
      if (f.bPair) extras.push("B-Pair");
      if (f.pPair) extras.push("P-Pair");
      if (f.bNat) extras.push("B-Nat");
      if (f.pNat) extras.push("P-Nat");
      meta.textContent = `${hh}:${mm} • Shoe ${h.shoe}` + (extras.length ? ` • ${extras.join(",")}` : "");

      node.appendChild(tag);
      node.appendChild(meta);

      // tap to delete exact this entry
      node.addEventListener("click", () => {
        const globalIndex = state.hands.length - (hands.length - i);
        if (globalIndex >= 0 && globalIndex < state.hands.length) {
          if (!confirm("Xoá ván này?")) return;
          state.hands.splice(globalIndex, 1);
          save();
          render();
        }
      });

      els.history.appendChild(node);
    }
  };

  const render = () => {
    // counts
    const c = count(state.hands);
    els.cntB.textContent = c.B;
    els.cntP.textContent = c.P;
    els.cntT.textContent = c.T;
    els.totalHands.textContent = c.total;
    els.shoeNo.textContent = state.shoe;

    // analysis
    const a = analyze();

    // lastN strings
    const showBP = (seq) => {
      const B = seq.filter(x=>x==="B").length;
      const P = seq.filter(x=>x==="P").length;
      return seq.length ? `B:${B} • P:${P} • n:${seq.length}` : "—";
    };
    els.last12.textContent = showBP(a.w12);
    els.last30.textContent = showBP(a.w30);
    els.last50.textContent = showBP(a.w50);

    // alt
    els.altRate.textContent = a.w30.length ? fmtPct(a.alt30) : "—";

    // pair/nat
    const pn = calcPairNatRates(state.hands);
    els.pairRate.textContent = c.total ? fmtPct(pn.pair) : "—";
    els.natRate.textContent  = c.total ? fmtPct(pn.nat) : "—";

    // AI
    els.aiAction.textContent = a.action;
    els.aiPhase.textContent  = a.phase;
    els.aiLean.textContent   = a.lean;
    els.aiTrap.textContent   = a.trap;

    const confPct = clamp(a.conf,0,1);
    const noisePct = clamp(a.noise,0,1);
    const edgePct = (a.edge); // -1..1

    els.kConf.textContent = fmtPct(confPct);
    els.kNoise.textContent = fmtPct(noisePct);
    els.kEdge.textContent = `${Math.round(edgePct*100)}%`;

    els.confTxt.textContent = fmtPct(confPct);
    els.noiseTxt.textContent = fmtPct(noisePct);
    els.edgeTxt.textContent = `${Math.round(edgePct*100)}%`;

    els.confBar.style.width = `${Math.round(confPct*100)}%`;
    els.noiseBar.style.width = `${Math.round(noisePct*100)}%`;
    els.edgeBar.style.width = `${Math.round((edgePct+1)*50)}%`; // center at 50%

    els.aiNote.textContent = a.note;

    updateCardPreview();
    renderHistory();
  };

  // ===== EXPORT / IMPORT =====
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hao-baccarat-ultra-v3_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importJSON = (file) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const obj = JSON.parse(String(fr.result || "{}"));
        if (!obj || !Array.isArray(obj.hands)) throw new Error("Invalid file");
        state = { ...defaultState(), ...obj };
        save();
        render();
        alert("IMPORT OK");
      } catch (e) {
        alert("File không đúng định dạng.");
      }
    };
    fr.readAsText(file);
  };

  // ===== EVENTS =====
  els.btnB.addEventListener("click", () => addHand("B"));
  els.btnP.addEventListener("click", () => addHand("P"));
  els.btnT.addEventListener("click", () => addHand("T"));
  els.btnUndo.addEventListener("click", undo);
  els.btnReset.addEventListener("click", resetAll);
  els.btnNewShoe.addEventListener("click", newShoe);

  els.btnExport.addEventListener("click", exportJSON);
  els.btnImport.addEventListener("click", () => els.fileImport.click());
  els.fileImport.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) importJSON(f);
    els.fileImport.value = "";
  });

  els.histLimit.addEventListener("change", renderHistory);

  // ===== PWA / SW =====
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(()=>{});
    });
  }

  // initial
  render();
})();
