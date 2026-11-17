/* ════════════════════════════════════════════════════════════════════
   MMH Turnover · v10.0 — FORECAST REPORT (Word)            fcrep/fcrep.js
   ────────────────────────────────────────────────────────────────────
   Source: sheet "Forecast Explanation Input" (backend getExplanations,
   already inside getTurnoverData ⇒ window.VERSIONS_DATA). Nothing new on
   the server.

   Layout = the management template:
     Group | Budget | Prev. Fcst | New Fcst | vs. Prev. | vs. Budget | Explanation
     G1 TH/MM Surgical … G6 VN Eyeless + Total, unit K USD,
     explanation = segment text + distributor lines marked ✅ / ❌.

   · Pick the period (Explaination time), Single / Cumulative (one or both
     ⇒ one table each), type, version (latest by default) and what to
     compare with (the sheet's "Lastest forecast/Actual" or an older version).
   · The preview is the document: explanation lines can be edited, marks
     toggled (✅ / ❌ / none), lines added / removed. Edits are kept on this
     device per version (localStorage mmh_fcr_draft) until "Reset edits".
   · Checks: gaps without explanation, total ≠ sheet Grand Total, fallback
     of the previous forecast.
   · Export: .docx (JSZip, vendor/jszip.min.js loaded on demand),
     copy table for e-mail (HTML), optional notes, key movers and
     detail by distributor.
   Test: NODE_PATH=$(npm root -g) node tools/fcrep/test.js [--shots <dir>]
   ════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var GROUPS = [
    { code: "G1", name: "TH/MM Surgical",     keys: ["t|Surgical"] },
    { code: "G2", name: "TH Dental/MMG",      keys: ["t|Dental", "t|MMG"] },
    { code: "G3", name: "VN Surgical",        keys: ["v|Surgical"] },
    { code: "G4", name: "VN/LA/KH/MM Dental", keys: ["v|Dental"] },
    { code: "G5", name: "VN/LA/KH/MM MMG",    keys: ["v|MMG"] },
    { code: "G6", name: "VN Eyeless",         keys: ["v|Eyeless"] }
  ];
  var OTHER = { code: "Other", name: "Other", keys: [] };
  var DIST_ORDER = ["AFTA-INNOTECH", "INNOTECH", "MAHACHAK", "NOVATEC", "AV", "DDI", "DEVA", "PROMPT DENT", "VRP DENT",
    "HUNG VI", "ICARE", "AN TAM", "MHI", "BAO LINH", "UDOM", "NAM DUNG", "VIET THAI", "SPI", "MECI", "ENT",
    "MEDTRONICAM", "CPT", "USM"];
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MK = { "+": "✅", "-": "❌", "": "" };          // ✅ ❌

  var LS = "mmh_fcr", LSD = "mmh_fcr_draft";
  var O = load(LS, {}) || {};
  O.sc = O.sc && O.sc.length ? O.sc : ["Single"];
  O.cmp = O.cmp || "sheet";
  O.ver = O.ver || "latest";
  O.orient = O.orient === "p" ? "p" : "l";
  O.marks = O.marks !== false;
  O.dname = !!O.dname;
  O.detail = !!O.detail;
  O.movers = !!O.movers;
  O.other = O.other !== false;
  O.thr = +O.thr > 0 ? +O.thr : 5;
  var DR = load(LSD, {}) || {};
  var CUR = null;          // last built report {secs, key}

  function load(k, d) { try { var j = JSON.parse(localStorage.getItem(k) || "null"); return j == null ? d : j; } catch (e) { return d; } }
  function save() { try { localStorage.setItem(LS, JSON.stringify(O)); } catch (e) {} }
  function saveDr() {
    try {
      var ks = Object.keys(DR);
      if (ks.length > 40) ks.sort(function (a, b) { return (DR[a]._at || 0) - (DR[b]._at || 0); }).slice(0, ks.length - 40).forEach(function (k) { delete DR[k]; });
      localStorage.setItem(LSD, JSON.stringify(DR));
    } catch (e) {}
  }
  function h(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function $(id) { return document.getElementById(id); }
  function vers() { return Array.isArray(window.VERSIONS_DATA) ? window.VERSIONS_DATA : []; }
  function fyName() { var v = vers()[0]; if (v && v.fy) return String(v.fy); try { return typeof FYN === "function" ? FYN() : "FY"; } catch (e) { return "FY"; } }
  function nf(n) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n); }
  function sg(n) { return n > 0 ? "+" + nf(n) : (n < 0 ? "-" + nf(-n) : "0"); }
  function tone(n) { return n > 0 ? "p" : (n < 0 ? "n" : "z"); }
  function toneC(n) { return n > 0 ? "up" : (n < 0 ? "dn" : "zr"); }
  function cmpVer(a, b) {
    var x = String(a || ""), y = String(b || "");
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) return (+x) - (+y);
    return x < y ? -1 : (x > y ? 1 : 0);
  }

  /* ── labels ─────────────────────────────────────────────────────── */
  function fyNum(fy) { var m = /(\d{2})/.exec(String(fy || fyName())); return m ? +m[1] : 67; }
  function verLbl(v) { var s = String(v || ""); return /^\d{8}$/.test(s) ? s.slice(6, 8) + "/" + s.slice(4, 6) + "/" + s.slice(0, 4) : s; }
  function ftShort(ft) {
    var s = String(ft || "");
    if (/^\d{6}$/.test(s)) return MON[+s.slice(4, 6) - 1] + "-" + s.slice(2, 4);
    return s || "FY";
  }
  function ftLong(ft, fy) {
    var s = String(ft || "");
    if (/^\d{6}$/.test(s)) return MON[+s.slice(4, 6) - 1] + " " + s.slice(0, 4);
    var q = /^Q([1-4])$/i.exec(s);
    if (q) {
      var y0 = 2025 + (fyNum(fy) - 67), m0 = 8 + 3 * (+q[1] - 1);           // Sep = index 8
      var a = new Date(y0, m0, 1), b = new Date(y0, m0 + 2, 1);
      return "Q" + q[1] + " (" + MON[a.getMonth()] + (a.getFullYear() !== b.getFullYear() ? " " + a.getFullYear() : "") + " – " + MON[b.getMonth()] + " " + b.getFullYear() + ")";
    }
    return s || "Full year";
  }
  function ftSortKey(ft) {
    var s = String(ft || "");
    if (/^\d{6}$/.test(s)) return "2" + s;
    var q = /^Q([1-4])$/i.exec(s); if (q) return "1" + q[1];
    return "0" + s;
  }

  /* ── pick version ───────────────────────────────────────────────── */
  function lists() {
    var V = vers(), ft = {}, sc = {}, tf = {};
    V.forEach(function (v) { ft[v.ft || ""] = 1; sc[v.sc || "Single"] = 1; tf[v.tFct || ""] = 1; });
    var fts = Object.keys(ft).sort(function (a, b) { return ftSortKey(a) < ftSortKey(b) ? -1 : 1; });
    return { ft: fts, sc: Object.keys(sc), tf: Object.keys(tf) };
  }
  function pool(ft, sc, tf) {
    return vers().filter(function (v) { return (v.ft || "") === ft && (v.sc || "Single") === sc && (v.tFct || "") === tf; })
      .sort(function (a, b) { return cmpVer(a.v, b.v); });
  }
  function defaults() {
    var L = lists(), V = vers();
    if (!V.length) return;
    if (O.ft == null || L.ft.indexOf(O.ft) < 0) {
      // newest version decides the default period
      var nv = V.slice().sort(function (a, b) { return cmpVer(a.v, b.v); }).pop();
      O.ft = nv ? (nv.ft || "") : L.ft[L.ft.length - 1];
    }
    if (O.tf == null || L.tf.indexOf(O.tf) < 0) {
      var tfs = L.tf.filter(function (t) { return vers().some(function (v) { return (v.ft || "") === O.ft && (v.tFct || "") === t; }); });
      O.tf = tfs.indexOf("Forecast") >= 0 ? "Forecast" : (tfs[0] != null ? tfs[0] : L.tf[0]);
    }
    var scs = L.sc.filter(function (s) { return pool(O.ft, s, O.tf).length; });
    O.sc = O.sc.filter(function (s) { return scs.indexOf(s) >= 0; });
    if (!O.sc.length && scs.length) O.sc = [scs.indexOf("Single") >= 0 ? "Single" : scs[0]];
  }
  function verOf(sc) {
    var P = pool(O.ft, sc, O.tf);
    if (!P.length) return null;
    if (O.ver !== "latest") { var hit = P.filter(function (v) { return String(v.v) === String(O.ver); })[0]; if (hit) return hit; }
    return P[P.length - 1];
  }

  /* ── numbers per segment ────────────────────────────────────────── */
  function cells(v) {
    var C = {}, gt = null;
    (v && v.countries || []).forEach(function (co) {
      if (co.code === "g") { gt = co.total; return; }
      (co.segments || []).forEach(function (s) {
        var t = s.total, ds = s.distributors || [];
        var sum = function (k) { return ds.reduce(function (a, d) { return a + (+d[k] || 0); }, 0); };
        C[co.code + "|" + s.name] = {
          co: co.code, seg: s.name,
          b: t ? +t.b || 0 : sum("b"), f: t ? +t.f || 0 : sum("f"),
          lf: t ? +t.lf || 0 : sum("lf"), vlf: t ? +t.vlf || 0 : sum("vlf"),
          e: t ? t.e || "" : "", dists: ds
        };
      });
    });
    return { C: C, gt: gt };
  }
  function unitDiv(v) {
    var x = cells(v), m = x.gt ? Math.abs(+x.gt.b || 0) + Math.abs(+x.gt.f || 0) : 0;
    if (!m) Object.keys(x.C).forEach(function (k) { m += Math.abs(x.C[k].b) + Math.abs(x.C[k].f); });
    return m >= 20000 ? 1000 : 1;        // sheet in USD ⇒ show K USD
  }
  function groupOf(key) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].keys.indexOf(key) >= 0) return GROUPS[i];
    return OTHER;
  }
  function distRank(n) { var i = DIST_ORDER.indexOf(String(n || "").toUpperCase().trim()); return i < 0 ? 999 : i; }

  /* ── explanation text → lines ───────────────────────────────────── */
  var RE_POS_MK = /^(✅|✔️?|☑️?|🟢|➕)\s*/;
  var RE_NEG_MK = /^(❌|❎|✖️?|✗|⛔|🔴|➖)\s*/;
  var RE_NEG_W = /\b(less|lower|decreas\w*|delay\w*|wait\w*|could not|couldn't|cannot|can't|not yet|terminat\w*|high inventory|low sell|drop\w*|lost|loss|cancel\w*|postpon\w*|shortage|out of stock|slow\w*|fewer|reduc\w*|below|fail\w*|declin\w*|behind|stopp?ed)\b/i;
  var RE_POS_W = /\b(more|higher|increas\w*|strong\w*|new tenders?|won|win\w*|stocking|additional|grow\w*|above|ahead|exceed\w*|recover\w*|improv\w*|launch\w*)\b/i;
  function splitLines(txt) {
    return String(txt || "").split(/\r?\n|\u2028/).map(function (s) { return s.replace(/^\s*(?:[-•*·▪●]\s+|\d+[.)]\s+)/, "").trim(); })
      .filter(function (s) { return s && !/^not\s*requirement$/i.test(s); });
  }
  function ownMark(s) {
    if (RE_POS_MK.test(s)) return { m: "+", t: s.replace(RE_POS_MK, "").trim() };
    if (RE_NEG_MK.test(s)) return { m: "-", t: s.replace(RE_NEG_MK, "").trim() };
    return null;
  }
  function guessMark(s, d) {
    var p = /(^|[\s(])\+\s?\d/.test(s), n = /(^|[\s(])[-−–]\s?\d/.test(s);
    if (p !== n) return p ? "+" : "-";
    var wp = RE_POS_W.test(s), wn = RE_NEG_W.test(s);
    if (wp !== wn) return wp ? "+" : "-";
    if (d) { if (d.dB) return d.dB > 0 ? "+" : "-"; if (d.dP) return d.dP > 0 ? "+" : "-"; }
    return "";
  }
  function headLines(txt) {
    return splitLines(txt).map(function (s) { var o = ownMark(s); return o || { m: "", t: s }; });
  }
  function distLines(d) {
    var nm = String(d.name || "");
    return splitLines(d.e).map(function (s) {
      var o = ownMark(s), t = o ? o.t : s;
      if (O.dname && nm && t.toLowerCase().indexOf(nm.toLowerCase().split(/[\s-]/)[0]) < 0) t = nm + ": " + t;
      return { m: o ? o.m : (O.marks ? guessMark(t, d) : ""), t: t };
    });
  }

  /* ── build one section (one version × Single/Cumulative) ────────── */
  function build(sc) {
    var v = verOf(sc);
    if (!v) return null;
    var div = unitDiv(v), X = cells(v), notes = [];
    var K = function (n) { return Math.round((+n || 0) / div); };

    // previous forecast source
    var prevV = null, mode = O.cmp;
    var older = pool(O.ft, sc, O.tf).filter(function (x) { return cmpVer(x.v, v.v) < 0; });
    if (mode !== "sheet") {
      prevV = older.filter(function (x) { return String(x.v) === String(mode); })[0] || older[older.length - 1] || null;
      if (!prevV) { mode = "sheet"; notes.push({ k: "warn", t: "No older version for this period — previous forecast taken from the sheet column “Lastest forecast/Actual”." }); }
    }
    var sheetHasLf = Object.keys(X.C).some(function (k) { return X.C[k].lf || X.C[k].vlf; }) || (X.gt && (+X.gt.lf || +X.gt.vlf));
    if (mode === "sheet" && !sheetHasLf && older.length) {
      prevV = older[older.length - 1]; mode = String(prevV.v);
      notes.push({ k: "info", t: "The sheet has no “Lastest forecast/Actual” for this version — compared with version " + verLbl(prevV.v) + " instead." });
    }
    var P = prevV ? cells(prevV).C : null;
    var pdiv = prevV ? unitDiv(prevV) : div;
    var prevOfDist = function (key, name) {
      if (!P) return null;
      var c = P[key]; if (!c) return 0;
      var d = c.dists.filter(function (x) { return String(x.name).toUpperCase() === String(name).toUpperCase(); })[0];
      return d ? (+d.f || 0) / pdiv * div : 0;
    };

    var rows = {}, order = GROUPS.concat([OTHER]);
    order.forEach(function (g) { rows[g.code] = { code: g.code, name: g.name, b: 0, f: 0, p: 0, segs: [], dists: [], head: [], body: [] }; });
    Object.keys(X.C).forEach(function (key) {
      var c = X.C[key], g = groupOf(key), r = rows[g.code];
      var prev = P ? (P[key] ? (+P[key].f || 0) / pdiv * div : 0) : (c.lf || (c.f - c.vlf));
      r.b += c.b; r.f += c.f; r.p += prev; r.segs.push((c.co === "t" ? "TH " : "VN ") + c.seg);
      headLines(c.e).forEach(function (l) { r.head.push(l); });
      c.dists.slice().sort(function (a, b) { return distRank(a.name) - distRank(b.name) || String(a.name).localeCompare(String(b.name)); })
        .forEach(function (d) {
          var dp = P ? prevOfDist(key, d.name) : (+d.lf || ((+d.f || 0) - (+d.vlf || 0)));
          var o = { name: d.name, seg: c.seg, co: c.co, B: K(d.b), N: K(d.f), P: K(dp), e: d.e || "" };
          o.dP = o.N - o.P; o.dB = o.N - o.B;
          r.dists.push(o);
          distLines(Object.assign({}, d, { dB: o.dB, dP: o.dP })).forEach(function (l) { r.body.push(l); });
        });
    });

    var out = [];
    order.forEach(function (g) {
      var r = rows[g.code];
      if (g === OTHER && (!O.other || (!r.segs.length))) return;
      if (!r.segs.length && g !== OTHER) { r.missing = true; }
      r.B = K(r.b); r.N = K(r.f); r.P = K(r.p); r.dP = r.N - r.P; r.dB = r.N - r.B;
      var auto = r.head.concat(r.body);
      if (!r.head.length && !r.dP && r.segs.length) auto.unshift({ m: "", t: "No change from the previous forecast.", auto: 1 });
      r.auto = auto;
      out.push(r);
    });

    var T = { code: "Total", name: "Total", B: 0, N: 0, P: 0 };
    out.forEach(function (r) { T.B += r.B; T.N += r.N; T.P += r.P; });
    T.dP = T.N - T.P; T.dB = T.N - T.B;
    var gtLines = X.gt ? headLines(X.gt.e) : [];
    if (!gtLines.length) gtLines = [{ m: "", t: totalText(T, out, v), auto: 1 }];
    T.auto = gtLines;
    if (X.gt) {
      var gB = K(X.gt.b), gN = K(X.gt.f);
      if (Math.abs(gB - T.B) > 1 || Math.abs(gN - T.N) > 1)
        notes.push({ k: "warn", t: "Sum of the groups (Budget " + nf(T.B) + " · New " + nf(T.N) + ") differs from the sheet Grand Total (Budget " + nf(gB) + " · New " + nf(gN) + "). Check rows outside G1–G6 or the Country report / Segment of the sheet rows." });
    }
    var s = String(v.v || "");
    if (/^\d{8}$/.test(s)) {
      var d = new Date(), today = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
      if (+s > today) notes.push({ k: "warn", t: "Version " + verLbl(s) + " is dated in the future." });
    }

    var key = [fyName(), O.ft, sc, O.tf, v.v, mode].join("|");
    var dr = DR[key] || {};
    out.concat([T]).forEach(function (r) {
      r.edited = !!dr[r.code];
      r.lines = dr[r.code] ? dr[r.code].map(function (l) { return { m: l.m || "", t: l.t || "" }; }) : r.auto.map(function (l) { return { m: l.m, t: l.t, auto: l.auto }; });
    });
    var miss = [];
    out.forEach(function (r) {
      var big = Math.abs(r.dP) >= O.thr || (Math.abs(r.dB) >= O.thr && Math.abs(r.dB) >= 0.1 * Math.abs(r.B));
      var real = r.lines.filter(function (l) { return !l.auto && l.t; }).length;
      if (big && !real) miss.push({ k: "miss", t: r.code + " " + r.name + ": vs. Prev. " + sg(r.dP) + ", vs. Budget " + sg(r.dB) + " — no explanation." });
      var txt = r.lines.map(function (l) { return l.t; }).join(" ").toLowerCase();
      r.dists.forEach(function (d) {
        if (Math.abs(d.dP) < O.thr || d.e) return;
        var w = String(d.name).toLowerCase().split(/[\s-]/)[0];
        if (txt.indexOf(w) < 0) miss.push({ k: "miss", t: r.code + " · " + d.name + ": vs. Prev. " + sg(d.dP) + " — not explained." });
      });
    });
    return {
      sc: sc, v: v, prevV: prevV, mode: mode, key: key, div: div, rows: out, T: T,
      notes: notes.concat(miss), title: titleOf(v, sc), sub: subOf(v, prevV, mode)
    };
  }
  function totalText(T, rows, v) {
    var p = (v.sc === "Cumulative" ? "YTD " : "") + ftShort(v.ft);
    var s = p + " total is " + (T.dP === 0 ? "unchanged" : (T.dP > 0 ? "up " + nf(T.dP) : "down " + nf(-T.dP))) + " vs. the previous forecast.";
    if (T.dB) {
      var g = rows.filter(function (r) { return T.dB < 0 ? r.dB < 0 : r.dB > 0; }).sort(function (a, b) { return Math.abs(b.dB) - Math.abs(a.dB); })[0];
      if (g) s += (T.dB < 0 ? " The gap vs. budget (" + sg(T.dB) + ") comes mainly from " : " Above budget by " + sg(T.dB) + ", mainly from ") + g.code + " " + g.name + " (" + sg(g.dB) + ").";
    }
    return s;
  }
  function titleOf(v, sc) {
    return "Forecast Explanation — " + (v.fy || fyName()) + " · " + ftLong(v.ft, v.fy) + (sc === "Cumulative" ? " · Cumulative (YTD)" : "");
  }
  function subOf(v, pv, mode) {
    return (v.tFct || "Forecast") + " version " + verLbl(v.v) + " · Prev. Fcst = " +
      (pv ? "version " + verLbl(pv.v) : "“Lastest forecast/Actual” in the sheet");
  }
  function movers(sec) {
    var all = [];
    sec.rows.forEach(function (r) { r.dists.forEach(function (d) { if (d.dP || d.dB) all.push(Object.assign({ g: r.code }, d)); }); });
    var byP = all.filter(function (d) { return d.dP; }).sort(function (a, b) { return Math.abs(b.dP) - Math.abs(a.dP); }).slice(0, 6);
    var byB = all.filter(function (d) { return d.dB; }).sort(function (a, b) { return Math.abs(b.dB) - Math.abs(a.dB); }).slice(0, 6);
    return { p: byP, b: byB };
  }

  /* ── UI ─────────────────────────────────────────────────────────── */
  function opt(v, t, cur) { return '<option value="' + h(v) + '"' + (String(v) === String(cur) ? " selected" : "") + ">" + h(t) + "</option>"; }
  function render() {
    var root = $("fcr-body"); if (!root) return;
    var V = vers();
    if (!V.length) {
      root.innerHTML = '<div class="card"><div class="cb fcr-empty">No forecast explanation in the sheet for ' + h(fyName()) +
        ' yet.<br><span>Sheet “Forecast Explanation Input”: each row needs FY, Ver, Explaination time, Single/Culmulative, Country report, Segment and the numbers.</span>' +
        (window.LAST_VERSIONS_ERROR ? '<br><code>' + h(window.LAST_VERSIONS_ERROR) + '</code>' : "") + "</div></div>";
      return;
    }
    defaults();
    var L = lists();
    var secs = O.sc.map(build).filter(Boolean);
    CUR = { secs: secs };
    var first = secs[0];
    var older = first ? pool(O.ft, first.sc, O.tf).filter(function (x) { return cmpVer(x.v, first.v.v) < 0; }).reverse() : [];
    var verList = O.sc.length ? pool(O.ft, O.sc[0], O.tf).slice().reverse() : [];

    var ctl = '<div class="card fcr-ctl"><div class="fcr-row">'
      + '<label>Period<select id="fcr-ft">' + L.ft.map(function (f) { return opt(f, ftLong(f), O.ft); }).join("") + "</select></label>"
      + '<div class="fcr-lb">Basis<div class="fcr-seg">' + ["Single", "Cumulative"].map(function (s) {
          var has = pool(O.ft, s, O.tf).length;
          return '<button class="' + (O.sc.indexOf(s) >= 0 ? "on" : "") + '"' + (has ? "" : " disabled") + ' data-sc="' + s + '">' + (s === "Single" ? "Single" : "Cumulative") + "</button>";
        }).join("") + "</div></div>"
      + (L.tf.length > 1 ? '<label>Type<select id="fcr-tf">' + L.tf.map(function (t) { return opt(t, t || "(blank)", O.tf); }).join("") + "</select></label>" : "")
      + '<label>Version<select id="fcr-ver">' + opt("latest", "Latest" + (verList[0] ? " · " + verLbl(verList[0].v) : ""), O.ver) + verList.map(function (v) { return opt(v.v, verLbl(v.v), O.ver); }).join("") + "</select></label>"
      + '<label>Prev. Fcst from<select id="fcr-cmp">' + opt("sheet", "Sheet column “Lastest forecast”", O.cmp) + older.map(function (v) { return opt(v.v, "Version " + verLbl(v.v), O.cmp); }).join("") + "</select></label>"
      + '<div class="fcr-act"><button class="fcr-btn pri" id="fcr-dl"' + (secs.length ? "" : " disabled") + '>Download Word (.docx)</button>'
      + '<button class="fcr-btn" id="fcr-copy"' + (secs.length ? "" : " disabled") + '>Copy table for e-mail</button></div>'
      + "</div></div>";

    var paper = secs.length ? secs.map(secHtml).join('<div class="fcr-pgsep"></div>') : '<div class="fcr-empty">No version for this choice.</div>';
    var side = sideHtml(secs);
    root.innerHTML = ctl + '<div class="fcr-main"><div class="fcr-paper' + (O.orient === "p" ? " pt" : "") + '" id="fcr-paper">' + paper + "</div>" + side + "</div>";
    wire();
  }
  function secHtml(s, si) {
    var H = '<div class="fcr-sec" data-si="' + si + '"><div class="fcr-t">' + h(s.title) + '</div><div class="fcr-s">' + h(s.sub) + "</div>"
      + '<div class="fcr-u">Unit: K USD</div>' + tableHtml(s, si, true);
    if (O.notes && O.notes.trim()) H += '<div class="fcr-h2">Notes</div>' + O.notes.trim().split(/\n/).map(function (l) { return '<p class="fcr-np">' + h(l) + "</p>"; }).join("");
    if (O.movers) {
      var m = movers(s);
      H += '<div class="fcr-h2">Key movers by distributor</div>' + moverHtml(m);
    }
    if (O.detail) H += '<div class="fcr-h2">Detail by distributor</div>' + detailHtml(s);
    return H + "</div>";
  }
  function numTd(n, cls) { return '<td class="n ' + (cls || "") + '">' + nf(n) + "</td>"; }
  function gTd(n) { return '<td class="n g ' + toneC(n) + '">' + sg(n) + "</td>"; }
  function linesHtml(r, si, edit) {
    var L = r.lines.length ? r.lines : [];
    var x = L.map(function (l, i) {
      return '<div class="fcr-ln' + (l.auto ? " auto" : "") + '">'
        + (edit ? '<button class="fcr-mk m' + (l.m === "+" ? "p" : l.m === "-" ? "n" : "0") + '" data-si="' + si + '" data-g="' + r.code + '" data-i="' + i + '" title="Mark: ✅ / ❌ / none">' + (MK[l.m] || "·") + "</button>" : (l.m ? '<span class="fcr-em">' + MK[l.m] + "</span> " : ""))
        + '<span class="fcr-tx"' + (edit ? ' contenteditable="true" spellcheck="false" data-si="' + si + '" data-g="' + r.code + '" data-i="' + i + '"' : "") + ">" + h(l.t) + "</span></div>";
    }).join("");
    if (edit) x += '<button class="fcr-add" data-si="' + si + '" data-g="' + r.code + '">+ line</button>';
    return x;
  }
  function tableHtml(s, si, edit) {
    var H = '<table class="fcr-tb"><thead><tr><th class="l">Group</th><th>Budget</th><th>Prev.<br>Fcst</th><th>New<br>Fcst</th><th>vs.<br>Prev.</th><th>vs.<br>Budget</th><th class="l x">Explanation</th></tr></thead><tbody>';
    s.rows.forEach(function (r) {
      H += '<tr' + (r.edited ? ' class="ed"' : "") + '><td class="l gn">' + h(r.code === "Other" ? r.name : r.code + " " + r.name) + "</td>" + numTd(r.B, "b") + numTd(r.P) + numTd(r.N) + gTd(r.dP) + gTd(r.dB)
        + '<td class="l x">' + linesHtml(r, si, edit) + "</td></tr>";
    });
    var T = s.T;
    H += '<tr class="tt' + (T.edited ? " ed" : "") + '"><td class="l gn">Total</td>' + numTd(T.B) + numTd(T.P) + numTd(T.N) + gTd(T.dP) + gTd(T.dB) + '<td class="l x">' + linesHtml(T, si, edit) + "</td></tr>";
    return H + "</tbody></table>";
  }
  function moverHtml(m) {
    var row = function (d) { return "<tr><td class=\"l\">" + h(d.name) + "</td><td class=\"l\">" + h(d.g) + "</td>" + numTd(d.P) + numTd(d.N) + gTd(d.dP) + gTd(d.dB) + "</tr>"; };
    var ids = {}, list = m.p.concat(m.b).filter(function (d) { var k = d.g + d.name; if (ids[k]) return false; ids[k] = 1; return true; });
    if (!list.length) return '<p class="fcr-np">No change by distributor.</p>';
    return '<table class="fcr-tb sm"><thead><tr><th class="l">Distributor</th><th class="l">Group</th><th>Prev.<br>Fcst</th><th>New<br>Fcst</th><th>vs.<br>Prev.</th><th>vs.<br>Budget</th></tr></thead><tbody>' + list.map(row).join("") + "</tbody></table>";
  }
  function detailHtml(s) {
    var H = '<table class="fcr-tb sm"><thead><tr><th class="l">Group / Distributor</th><th>Budget</th><th>Prev.<br>Fcst</th><th>New<br>Fcst</th><th>vs.<br>Prev.</th><th>vs.<br>Budget</th><th class="l x">Explanation (sheet)</th></tr></thead><tbody>';
    s.rows.forEach(function (r) {
      if (!r.dists.length) return;
      H += '<tr class="gh"><td class="l" colspan="7">' + h(r.code === "Other" ? r.name : r.code + " " + r.name) + "</td></tr>";
      r.dists.forEach(function (d) {
        H += '<tr><td class="l">' + h(d.name) + (r.segs.length > 1 ? ' <span class="fcr-sg">' + h(d.seg) + "</span>" : "") + "</td>" + numTd(d.B) + numTd(d.P) + numTd(d.N) + gTd(d.dP) + gTd(d.dB) + '<td class="l x">' + h(splitLines(d.e).join(" · ")) + "</td></tr>";
      });
    });
    return H + "</tbody></table>";
  }
  function sideHtml(secs) {
    var notes = [];
    secs.forEach(function (s) { s.notes.forEach(function (n) { notes.push({ k: n.k, t: (secs.length > 1 ? "[" + s.sc + "] " : "") + n.t }); }); });
    var anyAuto = secs.some(function (s) { return s.rows.concat([s.T]).some(function (r) { return r.lines.some(function (l) { return l.auto; }); }); });
    var anyEd = secs.some(function (s) { return s.rows.concat([s.T]).some(function (r) { return r.edited; }); });
    var ck = function (id, on, t) { return '<label class="fcr-ck"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + "> " + t + "</label>"; };
    return '<div class="fcr-side">'
      + '<div class="card"><div class="ch"><div class="ct">Before sending</div></div><div class="cb fcr-chk">'
      + (notes.length ? notes.map(function (n) { return '<div class="fcr-ni ' + n.k + '">' + h(n.t) + "</div>"; }).join("") : '<div class="fcr-ni ok">Every group with a change has an explanation.</div>')
      + (anyAuto ? '<div class="fcr-ni info">Lines in <i>italics</i> were written automatically from the numbers — read them before sending.</div>' : "")
      + '<div class="fcr-hint">Click a text line to edit it · Enter = new line · the mark button cycles ✅ / ❌ / none. Edits stay on this device for this version.</div>'
      + (anyEd ? '<button class="fcr-btn sm" id="fcr-reset">Reset edits to the sheet text</button>' : "")
      + "</div></div>"
      + '<div class="card"><div class="ch"><div class="ct">Document</div></div><div class="cb fcr-opts">'
      + '<div class="fcr-lb">Page<div class="fcr-seg"><button data-or="l" class="' + (O.orient === "l" ? "on" : "") + '">Landscape</button><button data-or="p" class="' + (O.orient === "p" ? "on" : "") + '">Portrait</button></div></div>'
      + ck("fcr-o-marks", O.marks, "Auto ✅ / ❌ on distributor lines")
      + ck("fcr-o-dname", O.dname, "Add distributor name when a line does not mention it")
      + ck("fcr-o-other", O.other, "Row “Other” for segments outside G1–G6")
      + ck("fcr-o-movers", O.movers, "Key movers by distributor")
      + ck("fcr-o-detail", O.detail, "Detail by distributor (appendix)")
      + '<label class="fcr-lb">Flag gaps without explanation from<span class="fcr-thr"><input type="number" min="1" step="1" id="fcr-o-thr" value="' + O.thr + '"> K USD</span></label>'
      + '<label class="fcr-lb">Notes under the table<textarea id="fcr-o-notes" rows="3" placeholder="Optional — e.g. actions agreed, next update date">' + h(O.notes || "") + "</textarea></label>"
      + "</div></div></div>";
  }

  /* ── events ─────────────────────────────────────────────────────── */
  var tmr = null;
  function rerender() { var y = window.scrollY; render(); window.scrollTo(0, y); }
  function secAt(si) { return CUR && CUR.secs[+si]; }
  function rowOf(s, g) { return g === "Total" ? s.T : s.rows.filter(function (r) { return r.code === g; })[0]; }
  function commit(s, r) {
    var d = DR[s.key] || (DR[s.key] = {});
    d[r.code] = r.lines.map(function (l) { return { m: l.m, t: l.t }; });
    d._at = Date.now(); r.edited = true;
    saveDr();
  }
  function wire() {
    var on = function (id, ev, fn) { var el = $(id); if (el) el.addEventListener(ev, fn); };
    on("fcr-ft", "change", function () { O.ft = this.value; O.ver = "latest"; O.cmp = "sheet"; O.tf = null; save(); render(); });
    on("fcr-tf", "change", function () { O.tf = this.value; O.ver = "latest"; O.cmp = "sheet"; save(); render(); });
    on("fcr-ver", "change", function () { O.ver = this.value; O.cmp = "sheet"; save(); render(); });
    on("fcr-cmp", "change", function () { O.cmp = this.value; save(); render(); });
    on("fcr-dl", "click", function () { exportDocx(); });
    on("fcr-copy", "click", function () { copyMail(); });
    on("fcr-reset", "click", function () {
      if (!CUR) return;
      CUR.secs.forEach(function (s) { delete DR[s.key]; }); saveDr(); rerender();
    });
    document.querySelectorAll("#fcr-body [data-sc]").forEach(function (b) {
      b.addEventListener("click", function () {
        var s = b.getAttribute("data-sc"), i = O.sc.indexOf(s);
        if (i >= 0) { if (O.sc.length > 1) O.sc.splice(i, 1); } else O.sc.push(s);
        O.sc.sort(function (a, b) { return (a === "Single" ? 0 : 1) - (b === "Single" ? 0 : 1); });
        save(); render();
      });
    });
    document.querySelectorAll("#fcr-body [data-or]").forEach(function (b) {
      b.addEventListener("click", function () { O.orient = b.getAttribute("data-or"); save(); rerender(); });
    });
    [["fcr-o-marks", "marks"], ["fcr-o-dname", "dname"], ["fcr-o-other", "other"], ["fcr-o-movers", "movers"], ["fcr-o-detail", "detail"]].forEach(function (p) {
      on(p[0], "change", function () { O[p[1]] = this.checked; save(); rerender(); });
    });
    on("fcr-o-thr", "change", function () { O.thr = Math.max(1, +this.value || 5); save(); rerender(); });
    on("fcr-o-notes", "input", function () {
      O.notes = this.value; save();
      clearTimeout(tmr); tmr = setTimeout(function () {
        var a = document.activeElement && document.activeElement.id, pos = a === "fcr-o-notes" ? $("fcr-o-notes").selectionStart : null;
        rerender();
        if (a === "fcr-o-notes") { var t = $("fcr-o-notes"); t.focus(); try { t.setSelectionRange(pos, pos); } catch (e) {} }
      }, 700);
    });
    var paper = $("fcr-paper"); if (!paper) return;
    paper.addEventListener("click", function (e) {
      var mk = e.target.closest(".fcr-mk"), add = e.target.closest(".fcr-add");
      if (mk) {
        var s = secAt(mk.dataset.si), r = rowOf(s, mk.dataset.g), l = r.lines[+mk.dataset.i];
        l.m = l.m === "+" ? "-" : (l.m === "-" ? "" : "+"); l.auto = 0;
        commit(s, r); rerender();
      } else if (add) {
        var s2 = secAt(add.dataset.si), r2 = rowOf(s2, add.dataset.g);
        r2.lines.push({ m: "", t: "" }); commit(s2, r2); rerender();
        focusLine(add.dataset.si, add.dataset.g, r2.lines.length - 1);
      }
    });
    paper.addEventListener("keydown", function (e) {
      var t = e.target; if (!t.classList || !t.classList.contains("fcr-tx")) return;
      var s = secAt(t.dataset.si), r = rowOf(s, t.dataset.g), i = +t.dataset.i;
      if (e.key === "Enter") {
        e.preventDefault(); r.lines[i].t = t.textContent.trim(); r.lines[i].auto = 0;
        r.lines.splice(i + 1, 0, { m: "", t: "" }); commit(s, r); rerender(); focusLine(t.dataset.si, t.dataset.g, i + 1);
      } else if (e.key === "Backspace" && !t.textContent) {
        e.preventDefault(); r.lines.splice(i, 1); commit(s, r); rerender(); if (i > 0) focusLine(t.dataset.si, t.dataset.g, i - 1, true);
      }
    });
    paper.addEventListener("focusout", function (e) {
      var t = e.target; if (!t.classList || !t.classList.contains("fcr-tx")) return;
      var s = secAt(t.dataset.si), r = rowOf(s, t.dataset.g), i = +t.dataset.i, l = r.lines[i];
      if (!l) return;
      var v = t.textContent.replace(/\s+/g, " ").trim();
      var em = ownMark(v); if (em) { l.m = em.m; v = em.t; }
      if (v === l.t && !em) return;
      l.t = v; l.auto = 0;
      if (!v) r.lines.splice(i, 1);
      commit(s, r);
      setTimeout(function () { var a = document.activeElement; if (!a || !a.classList || !a.classList.contains("fcr-tx")) rerender(); }, 250);
    });
  }
  function focusLine(si, g, i, end) {
    var el = document.querySelector('#fcr-paper .fcr-tx[data-si="' + si + '"][data-g="' + g + '"][data-i="' + i + '"]');
    if (!el) return;
    el.focus();
    if (end) { var r = document.createRange(); r.selectNodeContents(el); r.collapse(false); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  }

  /* ── copy for e-mail ────────────────────────────────────────────── */
  function mailHtml(secs) {
    var C = { p: "#1E7B34", n: "#C00000", z: "#222" };
    var th = function (t, l) { return '<th style="font:bold 12px Aptos,Calibri,Arial;color:#222;text-align:' + (l ? "left" : "right") + ';padding:6px 8px;border-bottom:2px solid #222;vertical-align:bottom">' + t + "</th>"; };
    var td = function (t, s) { return '<td style="font:12.5px Aptos,Calibri,Arial;color:#222;padding:6px 8px;vertical-align:top;border-bottom:1px solid #D9D9D9;' + (s || "") + '">' + t + "</td>"; };
    return secs.map(function (s) {
      var H = '<p style="font:bold 15px Aptos,Calibri,Arial;color:#003047;margin:14px 0 2px">' + h(s.title) + "</p>"
        + '<p style="font:12px Aptos,Calibri,Arial;color:#666;margin:0 0 6px">' + h(s.sub) + " · Unit: K USD</p>"
        + '<table cellspacing="0" cellpadding="0" style="border-collapse:collapse;max-width:980px"><tr>'
        + th("Group", 1) + th("Budget") + th("Prev.<br>Fcst") + th("New<br>Fcst") + th("vs.<br>Prev.") + th("vs.<br>Budget") + th("Explanation", 1) + "</tr>";
      s.rows.concat([s.T]).forEach(function (r) {
        var tt = r.code === "Total", b = tt ? "font-weight:bold;" : "", top = tt ? "border-top:2px solid #222;" : "";
        var ex = r.lines.filter(function (l) { return l.t; }).map(function (l) { return (l.m ? MK[l.m] + " " : "") + h(l.t); }).join("<br>");
        H += "<tr>" + td(h(tt ? "Total" : (r.code === "Other" ? r.name : r.code + " " + r.name)), b + top + "white-space:nowrap")
          + td(nf(r.B), "text-align:right;" + b + top) + td(nf(r.P), "text-align:right;" + b + top) + td(nf(r.N), "text-align:right;" + b + top)
          + td(sg(r.dP), "text-align:right;font-weight:bold;color:" + C[tone(r.dP)] + ";" + top) + td(sg(r.dB), "text-align:right;font-weight:bold;color:" + C[tone(r.dB)] + ";" + top)
          + td(ex, b + top + "min-width:360px") + "</tr>";
      });
      return H + "</table>";
    }).join("") + (O.notes && O.notes.trim() ? '<p style="font:12.5px Aptos,Calibri,Arial;color:#222">' + h(O.notes.trim()).replace(/\n/g, "<br>") + "</p>" : "");
  }
  function mailText(secs) {
    return secs.map(function (s) {
      var L = [s.title, s.sub + " · Unit: K USD", ["Group", "Budget", "Prev. Fcst", "New Fcst", "vs. Prev.", "vs. Budget", "Explanation"].join("\t")];
      s.rows.concat([s.T]).forEach(function (r) {
        L.push([r.code === "Total" ? "Total" : r.code + " " + r.name, r.B, r.P, r.N, sg(r.dP), sg(r.dB),
          r.lines.filter(function (l) { return l.t; }).map(function (l) { return (l.m ? MK[l.m] + " " : "") + l.t; }).join(" ")].join("\t"));
      });
      return L.join("\n");
    }).join("\n\n");
  }
  function toast(msg, bad) {
    document.querySelectorAll(".fcr-toast").forEach(function (o) { o.remove(); });
    var t = document.createElement("div"); t.className = "fcr-toast" + (bad ? " bad" : ""); t.textContent = msg;
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 2600);
  }
  function copyMail() {
    if (!CUR || !CUR.secs.length) return;
    var html = mailHtml(CUR.secs), text = mailText(CUR.secs);
    var done = function () { toast("Table copied — paste it into Outlook / Gmail."); };
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]).then(done, fallback);
        return;
      }
    } catch (e) {}
    fallback();
    function fallback() {
      var d = document.createElement("div"); d.style.cssText = "position:fixed;left:-9999px;top:0"; d.innerHTML = html; document.body.appendChild(d);
      var r = document.createRange(); r.selectNodeContents(d); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
      var ok = false; try { ok = document.execCommand("copy"); } catch (e) {}
      s.removeAllRanges(); d.remove();
      ok ? done() : toast("Could not copy — use Download Word instead.", 1);
    }
  }

  /* ── DOCX ───────────────────────────────────────────────────────── */
  function loadZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise(function (ok, no) {
      var s = document.createElement("script"); s.src = (window.FCR_ZIP_URL || "vendor/jszip.min.js");
      s.onload = function () { window.JSZip ? ok(window.JSZip) : no(new Error("JSZip")); };
      s.onerror = function () { no(new Error("Could not load vendor/jszip.min.js")); };
      document.head.appendChild(s);
    });
  }
  function x(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); }
  var COL = { ink: "222222", navy: "003047", grey: "6B7785", line: "D9D9D9", pos: "1E7B34", neg: "C00000" };
  function run(t, o) {
    o = o || {};
    var pr = "";
    if (o.emoji) pr += '<w:rFonts w:ascii="Segoe UI Emoji" w:hAnsi="Segoe UI Emoji" w:cs="Segoe UI Emoji" w:eastAsia="Segoe UI Emoji"/>';
    if (o.b) pr += "<w:b/><w:bCs/>";
    if (o.i) pr += "<w:i/><w:iCs/>";
    if (o.c) pr += '<w:color w:val="' + o.c + '"/>';
    if (o.sz) pr += '<w:sz w:val="' + o.sz + '"/><w:szCs w:val="' + o.sz + '"/>';
    return "<w:r>" + (pr ? "<w:rPr>" + pr + "</w:rPr>" : "") + '<w:t xml:space="preserve">' + x(t) + "</w:t></w:r>";
  }
  function par(runs, o) {
    o = o || {};
    var pp = '<w:spacing w:before="' + (o.before || 0) + '" w:after="' + (o.after || 0) + '" w:line="' + (o.line || 252) + '" w:lineRule="auto"/>';
    if (o.jc) pp += '<w:jc w:val="' + o.jc + '"/>';
    if (o.keep) pp += "<w:keepNext/>";
    return "<w:p><w:pPr>" + pp + "</w:pPr>" + (runs || "") + "</w:p>";
  }
  function brk() { return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; }
  function cell(w, paras, o) {
    o = o || {};
    var b = "";
    if (o.top) b += '<w:top w:val="single" w:sz="' + o.top + '" w:space="0" w:color="' + COL.ink + '"/>';
    b += '<w:bottom w:val="single" w:sz="' + (o.bot || 4) + '" w:space="0" w:color="' + (o.bot ? COL.ink : COL.line) + '"/>';
    var pr = '<w:tcW w:w="' + w + '" w:type="dxa"/>' + (o.span ? '<w:gridSpan w:val="' + o.span + '"/>' : "") + "<w:tcBorders>" + b + "</w:tcBorders>"
      + (o.fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + o.fill + '"/>' : "") + '<w:vAlign w:val="' + (o.va || "top") + '"/>';
    return "<w:tc><w:tcPr>" + pr + "</w:tcPr>" + paras + "</w:tc>";
  }
  function table(widths, head, rows) {
    var tw = widths.reduce(function (a, b) { return a + b; }, 0);
    var X = '<w:tbl><w:tblPr><w:tblW w:w="' + tw + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>'
      + '<w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders>'
      + '<w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar>'
      + '<w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>' + widths.map(function (w) { return '<w:gridCol w:w="' + w + '"/>'; }).join("") + "</w:tblGrid>";
    X += '<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' + head.map(function (c, i) {
      return cell(widths[i], par(run(c.t, { b: 1, c: COL.ink }), { jc: c.l ? "left" : "right", keep: 1 }), { bot: 12, va: "bottom" });
    }).join("") + "</w:tr>";
    rows.forEach(function (r) { X += "<w:tr><w:trPr><w:cantSplit/></w:trPr>" + r + "</w:tr>"; });
    return X + "</w:tbl>";
  }
  function numCell(w, n, o) { return cell(w, par(run(nf(n), { b: o && o.b }), { jc: "right" }), o); }
  function gapCell(w, n, o) { var t = tone(n); return cell(w, par(run(sg(n), { b: 1, c: t === "p" ? COL.pos : t === "n" ? COL.neg : COL.ink }), { jc: "right" }), o); }
  function explCell(w, lines, o) {
    var L = lines.filter(function (l) { return l.t; });
    var ps = L.length ? L.map(function (l, i) {
      return par((l.m ? run(MK[l.m] + " ", { emoji: 1 }) : "") + run(l.t, { b: o && o.b }), { after: i < L.length - 1 ? 30 : 0 });
    }).join("") : par("");
    return cell(w, ps, o);
  }
  function widthsFor(total, kind) {
    var base = kind === "main" ? [2150, 920, 920, 920, 900, 920] : (kind === "mov" ? [2600, 920, 920, 920, 900, 920] : [2300, 900, 900, 900, 880, 900]);
    if (kind === "mov") return base;
    var used = base.reduce(function (a, b) { return a + b; }, 0);
    return base.concat([Math.max(2400, total - used)]);
  }
  function mainTable(s, W) {
    var w = widthsFor(W, "main"), head = [{ t: "Group", l: 1 }, { t: "Budget" }, { t: "Prev. Fcst" }, { t: "New Fcst" }, { t: "vs. Prev." }, { t: "vs. Budget" }, { t: "Explanation", l: 1 }];
    var rows = s.rows.map(function (r) {
      return cell(w[0], par(run(r.code === "Other" ? r.name : r.code + " " + r.name))) + numCell(w[1], r.B) + numCell(w[2], r.P) + numCell(w[3], r.N)
        + gapCell(w[4], r.dP) + gapCell(w[5], r.dB) + explCell(w[6], r.lines);
    });
    var T = s.T, o = { top: 12, b: 1 };
    rows.push(cell(w[0], par(run("Total", { b: 1 })), o) + numCell(w[1], T.B, o) + numCell(w[2], T.P, o) + numCell(w[3], T.N, o)
      + gapCell(w[4], T.dP, o) + gapCell(w[5], T.dB, o) + explCell(w[6], T.lines, o));
    return table(w, head, rows);
  }
  function moverTable(s) {
    var m = movers(s), ids = {}, list = m.p.concat(m.b).filter(function (d) { var k = d.g + d.name; if (ids[k]) return false; ids[k] = 1; return true; });
    if (!list.length) return par(run("No change by distributor.", { c: COL.grey }));
    var w = widthsFor(0, "mov");
    return table(w, [{ t: "Distributor", l: 1 }, { t: "Group", l: 1 }, { t: "Prev. Fcst" }, { t: "New Fcst" }, { t: "vs. Prev." }, { t: "vs. Budget" }],
      list.map(function (d) { return cell(w[0], par(run(d.name))) + cell(w[1], par(run(d.g))) + numCell(w[2], d.P) + numCell(w[3], d.N) + gapCell(w[4], d.dP) + gapCell(w[5], d.dB); }));
  }
  function detailTable(s, W) {
    var w = widthsFor(W, "det"), rows = [];
    s.rows.forEach(function (r) {
      if (!r.dists.length) return;
      rows.push(cell(W, par(run(r.code === "Other" ? r.name : r.code + " " + r.name, { b: 1, c: COL.navy }), { keep: 1 }), { span: 7, fill: "F2F5F8" }));
      r.dists.forEach(function (d) {
        rows.push(cell(w[0], par(run(d.name) + (r.segs.length > 1 ? run("  " + d.seg, { c: COL.grey, sz: 16 }) : ""))) + numCell(w[1], d.B) + numCell(w[2], d.P) + numCell(w[3], d.N)
          + gapCell(w[4], d.dP) + gapCell(w[5], d.dB) + explCell(w[6], splitLines(d.e).map(function (t) { return { m: "", t: t }; })));
      });
    });
    return table(w, [{ t: "Group / Distributor", l: 1 }, { t: "Budget" }, { t: "Prev. Fcst" }, { t: "New Fcst" }, { t: "vs. Prev." }, { t: "vs. Budget" }, { t: "Explanation (sheet)", l: 1 }], rows);
  }
  function docXml(secs) {
    var land = O.orient !== "p", pw = land ? 16838 : 11906, ph = land ? 11906 : 16838, mar = 850, W = pw - 2 * mar;
    var B = "";
    secs.forEach(function (s, i) {
      if (i) B += brk();
      B += par(run(s.title, { b: 1, c: COL.navy, sz: 30 }), { after: 40 });
      B += par(run(s.sub, { c: COL.grey, sz: 18 }), { after: 120 });
      B += par(run("Unit: K USD", { c: COL.ink, sz: 18 }), { after: 60, keep: 1 });
      B += mainTable(s, W);
      if (O.notes && O.notes.trim()) {
        B += par(run("Notes", { b: 1, c: COL.navy, sz: 22 }), { before: 240, after: 60, keep: 1 });
        O.notes.trim().split(/\n/).forEach(function (l) { B += par(run(l), { after: 40 }); });
      }
      if (O.movers) { B += par(run("Key movers by distributor", { b: 1, c: COL.navy, sz: 22 }), { before: 240, after: 60, keep: 1 }) + moverTable(s); }
      if (O.detail) { B += par(run("Detail by distributor", { b: 1, c: COL.navy, sz: 22 }), { before: 240, after: 60, keep: 1 }) + detailTable(s, W); }
    });
    var d = new Date(), stamp = ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear() + " " + ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
    B += par(run("Source: MMH Turnover · sheet “Forecast Explanation Input” · exported " + stamp, { c: COL.grey, sz: 16 }), { before: 200 });
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
      + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>'
      + B + '<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="' + pw + '" w:h="' + ph + '"' + (land ? ' w:orient="landscape"' : "") + "/>"
      + '<w:pgMar w:top="' + mar + '" w:right="' + mar + '" w:bottom="' + mar + '" w:left="' + mar + '" w:header="425" w:footer="425" w:gutter="0"/></w:sectPr></w:body></w:document>';
  }
  function parts(secs) {
    var W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    var title = secs[0] ? secs[0].title : "Forecast Explanation";
    var now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    return {
      "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
        + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
        + '<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>'
        + '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
        + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
        + '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>',
      "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
        + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
      "word/_rels/document.xml.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
        + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>'
        + '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
      "word/styles.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="' + W + '"><w:docDefaults><w:rPrDefault><w:rPr>'
        + '<w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos" w:eastAsia="Aptos"/><w:color w:val="222222"/><w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="en-US"/></w:rPr></w:rPrDefault>'
        + '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="252" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
        + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
        + '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        + '<w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:rPr><w:color w:val="6B7785"/><w:sz w:val="16"/></w:rPr></w:style></w:styles>',
      "word/settings.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:settings xmlns:w="' + W + '"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>',
      "word/footer1.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="' + W + '"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr>'
        + '<w:r><w:t xml:space="preserve">MMH · ' + x(title) + ' · Internal · Page </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>'
        + '<w:r><w:t xml:space="preserve"> / </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>',
      "docProps/core.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
        + "<dc:title>" + x(title) + "</dc:title><dc:creator>MMH Turnover</dc:creator>"
        + '<dcterms:created xsi:type="dcterms:W3CDTF">' + now + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + now + "</dcterms:modified></cp:coreProperties>",
      "docProps/app.xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>MMH Turnover</Application></Properties>',
      "word/document.xml": docXml(secs)
    };
  }
  function fileName(secs) {
    var s = secs[0], v = s ? String(s.v.v || "") : "";
    return ["MMH", (s && s.v.fy) || fyName(), "Forecast_Explanation", ftShort(O.ft).replace(/[^\w-]/g, ""), secs.map(function (z) { return z.sc; }).join("+"), v ? "v" + v : ""].filter(Boolean).join("_") + ".docx";
  }
  function exportDocx() {
    if (!CUR || !CUR.secs.length) return;
    var a = document.activeElement; if (a && a.blur) a.blur();
    var secs = CUR.secs, btn = $("fcr-dl");
    if (btn) { btn.disabled = true; btn.textContent = "Preparing…"; }
    return loadZip().then(function (Z) {
      var z = new Z(), P = parts(secs);
      Object.keys(P).forEach(function (k) { z.file(k, P[k]); });
      return z.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
    }).then(function (blob) {
      var u = URL.createObjectURL(blob), el = document.createElement("a");
      el.href = u; el.download = fileName(secs); document.body.appendChild(el); el.click(); el.remove();
      setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
      toast("Word file downloaded: " + fileName(secs));
    }).catch(function (e) { toast("Export failed: " + (e && e.message || e), 1); })
      .then(function () { if (btn) { btn.disabled = false; btn.textContent = "Download Word (.docx)"; } });
  }

  /* ── mount ──────────────────────────────────────────────────────── */
  function mount() {
    if ($("sec-fcr")) return;
    var exp = $("sec-exp");
    var sec = document.createElement("div");
    sec.className = "sec"; sec.id = "sec-fcr";
    sec.innerHTML = '<div class="sh"><div class="sl">Forecast Report</div><div class="sp">Budget · previous forecast · new forecast · explanation by group — export to Word</div></div><div id="fcr-body"></div>';
    if (exp && exp.parentNode) exp.parentNode.insertBefore(sec, exp.nextSibling);
    var nt = $("nt-exp");
    if (nt && !$("nt-fcr")) {
      var n = document.createElement("div"); n.className = "nt"; n.id = "nt-fcr"; n.textContent = "📄 Forecast Report";
      n.setAttribute("onclick", "goTab('fcr')"); nt.parentNode.insertBefore(n, nt.nextSibling);
    }
    var bn = $("bn-exp");
    if (bn && !$("bn-fcr")) {
      var b = document.createElement("button"); b.className = "bn"; b.id = "bn-fcr"; b.setAttribute("onclick", "goTab('fcr')");
      b.innerHTML = '<span class="bn-ic">📄</span><span class="bn-tx">Report</span>'; bn.parentNode.insertBefore(b, bn.nextSibling);
    }
    // shortcut from the Explanations tab
    var sh = exp && exp.querySelector(".sh");
    if (sh && !$("fcr-from-exp")) {
      var k = document.createElement("button"); k.className = "dl-btn"; k.id = "fcr-from-exp"; k.textContent = "📄 Forecast report (Word)";
      k.style.marginLeft = "8px"; k.setAttribute("onclick", "goTab('fcr')"); sh.appendChild(k);
    }
    if (window.TAB_RENDER) window.TAB_RENDER.fcr = function () { render(); };
    var _sb = window.syncBottomNav;
    if (typeof _sb === "function") window.syncBottomNav = function (t) {
      if (t !== "fcr") { var f = $("bn-fcr"); if (f) f.classList.remove("on"); return _sb.apply(this, arguments); }
      document.querySelectorAll(".btmnav .bn").forEach(function (b) { b.classList.toggle("on", b.id === "bn-fcr"); });
    };
    var _go = window.goTab;
    if (typeof _go === "function") window.goTab = function (t) {
      var r = _go.apply(this, arguments);
      if (t === "fcr") { try { render(); } catch (e) { console.warn("fcr", e); } }
      return r;
    };
    // versions arrive with every data load (applyLiveData ⇒ rEXP), even when the turnover rows fail
    var _rx = window.rEXP;
    if (typeof _rx === "function") window.rEXP = function () {
      var r = _rx.apply(this, arguments);
      if (window.S && S.tab === "fcr") { try { render(); } catch (e) { console.warn("fcr", e); } }
      return r;
    };
    var _ra = window.renderAll;
    if (typeof _ra === "function") window.renderAll = function () {
      var r = _ra.apply(this, arguments);
      if (window.S && S.tab === "fcr") { try { render(); } catch (e) { console.warn("fcr", e); } }
      return r;
    };
  }
  mount();

  window.FCR = {
    render: render, build: build, exportDocx: exportDocx, copyMail: copyMail,
    parts: function () { return CUR ? parts(CUR.secs) : null; }, current: function () { return CUR; },
    opts: O, fileName: function () { return CUR ? fileName(CUR.secs) : ""; }
  };
})();
