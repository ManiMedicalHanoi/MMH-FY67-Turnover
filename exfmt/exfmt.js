/* ════════════════════════════════════════════════════════════════════
   EXF v1.0 — EXPLANATION FORMAT (MANI HQ, 11/2026)              exfmt.js
   ────────────────────────────────────────────────────────────────────
   GIỐNG HỆT 2 nơi (sửa 1 nơi chép sang nơi kia):
     · MMH-FY67-Turnover ▸ exfmt/exfmt.js       (app)
     · mmh-backend ▸ backends/turnover/MMH_ExplFormat.gs (backend)
   Pure functions only (no Sheet / DOM).

   Segment Total rows (Single, Ver ≥ EXF.FROM_VER) are always written in
   one layout, whatever the input (app editor, typing in the Sheet, paste):

     ■ Results
     Monthly Result for Nov 2026: Sales 32.4K USD / YoY -12% / vs. Budget -48%
     Cumulative Result (Sep–Nov 2026): Sales 44.1K USD / YoY +5% / vs. Budget -30%
     ■ Key Factors
     ✅ positive factor
     ❌ negative factor
     ■ Market and Competitor situation
     - neutral line
     ■ Outlook and Actions Going Forward
     ➡️ follow up action
     ■ Requests to Other Departments
     - …

   Result lines are made by the system (numbers), the 4 sections are
   written by people. Lines before any heading (old free text) go to
   Key Factors. Mark variants (+) ✔ 👍 (-) ✖ 👎 -> => 👉 … become ✅ ❌ ➡️.
   ════════════════════════════════════════════════════════════════════ */
var EXF = (function () {
  "use strict";

  var FROM_VER = "20261127";                 // first version written in the HQ layout
  var SECS = [
    { k: "res", t: "Results",                           re: /^results?\s*(?::|$)/i },
    { k: "key", t: "Key Factors",                       re: /^key\s*factors?\s*(?::|-|$)/i },
    { k: "mkt", t: "Market and Competitor situation",   re: /^market\s*(?:and|&|\/)\s*competitors?(?:\s*situations?)?\s*(?::|-|$)/i },
    { k: "out", t: "Outlook and Actions Going Forward", re: /^outlook(?:\s*(?:and|&|\/)\s*actions?(?:\s*going\s*forward)?)?\s*(?::|-|$)/i },
    { k: "req", t: "Requests to Other Departments",     re: /^requests?(?:\s*to\s*(?:other\s*)?departments?)?\s*(?::|-|$)/i }
  ];
  var WRITE = ["key", "mkt", "out", "req"];  // sections people write
  var MK = { "+": "✅", "-": "❌", "f": "➡️" };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  var RE_HEADPFX = /^[\s■□▪▫◾◼◆◇●○•*#]+|^\s*\d+[.)]\s+/;
  var RE_RESLINE = /^(?:monthly|quarterly|cumulative|single|yearly|fy)\s+results?\b/i;
  var RE_HOLDER  = /XXXX|±\s*XX\s*%|\[month\]/i;
  var RE_BULLET  = /^\s*(?:[-–—]\s+|[•*·▪▫●○◦]\s*|\d+[.)]\s+)/;
  var MARKS = [
    { m: "+", re: /^(?:✅|✔️|✔|☑️|☑|✓|👍|\(\+\)|\[\+\]|\+(?=\s))\s*/ },
    { m: "-", re: /^(?:❌|❎|✖️|✖|✗|✘|👎|\(-\)|\[-\]|\(−\)|\[−\])\s*/ },
    { m: "f", re: /^(?:➡️|➡|→|⇒|=>|->|-->|▶️|▶|►|👉)\s*/ }
  ];

  function str(v) { return v == null ? "" : String(v); }

  /* one line → { m: "+"|"-"|"f"|"", t } */
  function mark(s) {
    s = str(s).replace(/\u00a0/g, " ").trim();
    for (var guard = 0; guard < 3; guard++) {
      var hit = false;
      for (var i = 0; i < MARKS.length; i++) {
        var r = MARKS[i].re.exec(s);
        if (r) return { m: MARKS[i].m, t: s.slice(r[0].length).replace(RE_BULLET, "").trim() };
      }
      var b = RE_BULLET.exec(s);
      if (b && b[0].length) { s = s.slice(b[0].length).trim(); hit = true; }
      if (!hit) break;
    }
    return { m: "", t: s };
  }

  function headOf(line) {
    var h = str(line).replace(RE_HEADPFX, "").replace(RE_HEADPFX, "").trim();
    for (var i = 0; i < SECS.length; i++) {
      var r = SECS[i].re.exec(h);
      if (r) return { k: SECS[i].k, rest: h.slice(r[0].length).replace(/^[\s:–—-]+/, "").trim() };
    }
    return null;
  }

  function empty() { return { res: [], key: [], mkt: [], out: [], req: [], framed: false }; }

  /* free text → sections */
  function parse(text) {
    var o = empty();
    var t = str(text).replace(/\r\n?/g, "\n").replace(/\u2028/g, "\n");
    if (!t.trim() || /^not\s*requirement\s*$/i.test(t.trim())) return o;
    var cur = null;
    t.split("\n").forEach(function (raw) {
      var line = raw.replace(/\u00a0/g, " ").trim();
      if (!line) return;
      var h = headOf(line);
      if (h) {
        o.framed = true; cur = h.k;
        if (h.rest) pushLine(o, cur, h.rest);
        return;
      }
      var plain = line.replace(RE_HEADPFX, "").trim();
      if (RE_RESLINE.test(plain)) { o.framed = true; if (!RE_HOLDER.test(plain)) o.res.push(plain); return; }
      if (RE_HOLDER.test(line)) return;                       // HQ template placeholder
      pushLine(o, cur, line);
    });
    return o;
  }
  function pushLine(o, k, line) {
    if (!k || k === "res") k = "key";                         // text before any heading / under Results
    var l = mark(line);
    if (l.t || l.m) o[k].push(l);
  }

  function lineText(l) { return (l.m ? MK[l.m] + " " : "- ") + str(l.t).trim(); }

  /* sections → canonical text. resLines: array (system lines) or null = keep parsed ones */
  function render(o, resLines) {
    o = o || empty();
    var out = ["■ Results"];
    (resLines || o.res || []).forEach(function (s) { if (str(s).trim()) out.push(str(s).trim()); });
    WRITE.forEach(function (k) {
      out.push("■ " + secTitle(k));
      (o[k] || []).forEach(function (l) { if (str(l.t).trim()) out.push(lineText(l)); });
    });
    return out.join("\n");
  }
  function secTitle(k) { for (var i = 0; i < SECS.length; i++) if (SECS[i].k === k) return SECS[i].t; return k; }

  /* only normalise marks (distributor rows / old versions) — never adds headings or "- " */
  function marksOnly(text) {
    var t = str(text);
    if (!t.trim() || /^not\s*requirement\s*$/i.test(t.trim())) return t;
    return t.replace(/\r\n?/g, "\n").split("\n").map(function (raw) {
      var line = raw.replace(/\s+$/, "");
      if (!line.trim()) return "";
      var l = mark(line);
      return l.m ? MK[l.m] + " " + l.t : line.trim();
    }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  /* ── numbers → result lines ───────────────────────────────────── */
  function kusd(v) {
    v = +v || 0;
    var k = Math.round(v / 100) / 10, a = Math.abs(k).toFixed(1).split(".");
    a[0] = a[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (k < 0 ? "-" : "") + a.join(".") + "K USD";
  }
  function pct(a, b) {
    a = +a || 0; b = +b || 0;
    if (!b) return "n/a";
    var p = Math.round((a / b - 1) * 100);
    return (p > 0 ? "+" : "") + p + "%";
  }
  function monLbl(key) {
    key = str(key);
    var mi = parseInt(key.slice(4, 6), 10) - 1;
    return (mi >= 0 && mi < 12 ? MON[mi] : key.slice(4, 6)) + " " + key.slice(0, 4);
  }
  /* p = { ft, fy, tFct, single:{v,b,ly}, cum:{v,b,ly,from,to} } */
  function results(p) {
    var ft = str(p.ft).trim(), L = [];
    if (!ft) return L;
    var fc = /forecast/i.test(str(p.tFct)) ? " (Forecast)" : "";
    var s = p.single, c = p.cum;
    var head = /^Q[1-4]$/i.test(ft) ? "Quarterly Result for " + ft.toUpperCase() + (p.fy ? " " + p.fy : "")
             : /^\d{6}$/.test(ft) ? "Monthly Result for " + monLbl(ft)
             : "Result for " + ft;
    if (s) L.push(head + fc + ": Sales " + kusd(s.v) + " / YoY " + pct(s.v, s.ly) + " / vs. Budget " + pct(s.v, s.b));
    if (c) {
      var rng = c.from && c.to ? " (" + (c.from === c.to ? monLbl(c.to)
        : (c.from.slice(0, 4) === c.to.slice(0, 4) ? monLbl(c.from).slice(0, 3) : monLbl(c.from)) + "–" + monLbl(c.to)) + ")" : "";
      L.push("Cumulative Result" + rng + ": Sales " + kusd(c.v) + " / YoY " + pct(c.v, c.ly) + " / vs. Budget " + pct(c.v, c.b));
    }
    return L;
  }

  /* ── which rows use the HQ layout ─────────────────────────────── */
  function verNum(v) { var s = str(v).replace(/\.0+$/, "").trim(); return /^\d{8}$/.test(s) ? s : ""; }
  /* r = { ver, sc, country, segment, distributor, from? } */
  function isFrame(r) {
    var v = verNum(r.ver), from = verNum(r.from) || FROM_VER;
    if (!v || v < from) return false;
    if (/^cu/i.test(str(r.sc).trim())) return false;              // Cumulative row: text lives on the Single row
    var cty = str(r.country).trim(), seg = str(r.segment).trim(), dist = str(r.distributor).trim();
    if (!cty || /total$/i.test(cty) || /^grand/i.test(cty)) return false;
    if (!seg) return false;
    if (dist && !/total$/i.test(dist)) return false;
    return true;
  }
  function segClean(s) { return str(s).replace(/\s*total\s*$/i, "").trim(); }

  return {
    FROM_VER: FROM_VER, SECS: SECS, WRITE: WRITE, MK: MK,
    mark: mark, parse: parse, render: render, marksOnly: marksOnly, lineText: lineText, secTitle: secTitle,
    results: results, kusd: kusd, pct: pct, monLbl: monLbl, isFrame: isFrame, segClean: segClean, verNum: verNum,
    canon: function (text, resLines) { return render(parse(text), resLines); }
  };
})();
if (typeof module !== "undefined" && module.exports) module.exports = EXF;
