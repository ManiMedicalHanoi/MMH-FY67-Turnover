/* ════════════════════════════════════════════════════════════════════
   MMH Turnover · v10.2 — EXPLANATION theo khung MANI HQ   exfmt/exedit.js
   ────────────────────────────────────────────────────────────────────
   · exCell(t, v, co, sg, d): ô Explanation của tab Explanations — dòng
     "… Total" (t.fr = 1 từ backend, Ver ≥ 20261127) hiện theo khung
       ■ Results · ■ Key Factors · ■ Market and Competitor situation ·
       ■ Outlook and Actions Going Forward · ■ Requests to Other Departments
     + nút Edit (dòng Single có số dòng Sheet t.r).
   · EXE.open(id): hộp sửa — mỗi mục 1 danh sách dòng, mỗi dòng 1 dấu
     ✅ Positive · ❌ Negative · ➡️ Follow up · – (không dấu); dán chữ có
     tiêu đề ⇒ tự chia đúng mục. Results do hệ thống tính (không sửa).
     Lưu ⇒ backend exSave (JSONP; chữ dài ⇒ exPart từng khúc) ⇒ máy chủ
     ghi lại ô theo khung chuẩn (EXF, GIỐNG HỆT backend MMH_ExplFormat.gs).
     Nháp giữ trên máy (localStorage mmh_exe_draft) tới khi lưu được.
   Backend: mmh-backend ▸ turnover ▸ MMH_ExplSave.gs (gõ thẳng trên Sheet
   cũng được chuẩn hoá bằng simple trigger onEdit).
   ════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var EXE_URL = "https://script.google.com/a/macros/manimedicalhanoi.com/s/AKfycbz26knlK_GE2mYlszlx947QWSLvfScrHFeB86XkaPWfDhKHi49cnVfCXS_kPUpkX2Fgww/exec";
  var LSD = "mmh_exe_draft";
  var MKS = [["+", "✅", "Positive factor"], ["-", "❌", "Negative factor"], ["f", "➡️", "Follow up action"], ["", "–", "No mark"]];
  var HINT = {
    key: "What drove the result this period",
    mkt: "Customers, tenders, competitors' prices / products / stock",
    out: "What happens next and what we will do",
    req: "What we need from RA, Supply chain, Marketing, HQ…"
  };
  var REG = {}, NID = 0, CUR = null;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function E() { return window.EXF; }
  function loadD() { try { return JSON.parse(localStorage.getItem(LSD) || "{}") || {}; } catch (e) { return {}; } }
  function saveD(o) { try { localStorage.setItem(LSD, JSON.stringify(o)); } catch (e) {} }

  /* ── display ─────────────────────────────────────────────────────── */
  function lineHtml(l) {
    var mk = l.m ? '<span class="exf-mk">' + E().MK[l.m] + "</span>" : '<span class="exf-dot">–</span>';
    return '<div class="exf-ln m' + (l.m === "+" ? "p" : l.m === "-" ? "n" : l.m === "f" ? "f" : "0") + '">' + mk + "<span>" + esc(l.t) + "</span></div>";
  }
  function frameHtml(text) {
    var o = E().parse(text), h = '<div class="exf">';
    h += '<div class="exf-res">' + (o.res.length ? o.res.map(function (s) {
      var i = s.indexOf(":");
      return "<div>" + (i > 0 ? "<b>" + esc(s.slice(0, i)) + "</b>" + esc(s.slice(i)) : esc(s)) + "</div>";
    }).join("") : '<div class="exf-none">Results are filled in by the system</div>') + "</div>";
    E().WRITE.forEach(function (k) {
      h += '<div class="exf-h">' + esc(E().secTitle(k)) + "</div>";
      h += o[k].length ? o[k].map(lineHtml).join("") : '<div class="exf-none">—</div>';
    });
    return h + "</div>";
  }
  function plainHtml(text) {
    var t = String(text || "").trim();
    if (!t) return "";
    return '<div class="exf exf-plain">' + t.split(/\r?\n/).filter(function (s) { return s.trim(); }).map(function (s) {
      var l = E().mark(s); return l.m ? lineHtml(l) : '<div class="exf-ln m0"><span>' + esc(s.trim()) + "</span></div>";
    }).join("") + "</div>";
  }

  window.exCell = function (t, v, co, sg, d) {
    t = t || {};
    var txt = t.e || "", ex = E();
    var frame = !!(ex && !d && (t.fr || ex.parse(txt).framed));
    var body = !ex ? (txt ? esc(txt) : "") : (frame ? frameHtml(txt) : plainHtml(txt));
    if (!body) body = '<span class="ex-empty">— no explanation —</span>';
    var can = ex && t.r && (v.sc || "Single") !== "Cumulative" && co && co.code !== "g";
    if (!can) return body;
    var id = "x" + (++NID);
    REG[id] = { v: v, co: co, sg: sg, d: d || null, t: t, frame: frame };
    return body + '<button class="exe-btn" data-exe="' + id + '" onclick="event.stopPropagation();EXE.open(\'' + id + '\')" title="Write / edit this explanation (saved to the sheet)">✎ Edit</button>';
  };

  /* ── editor model ────────────────────────────────────────────────── */
  function keyOf(R) { return [R.v.fy, R.v.v, R.v.ft, R.v.tFct, R.v.sc, R.co.code, R.sg ? R.sg.name : "", R.d ? R.d.name : ""].join("|"); }
  function modelFrom(R, text) {
    var o = E().parse(text);
    if (!R.frame) {                                    // distributor / older version: one list of lines
      var L = [];
      String(text || "").split(/\r?\n/).forEach(function (s) { if (s.trim()) L.push(E().mark(s)); });
      return { frame: false, res: [], lines: L };
    }
    var M = { frame: true, res: o.res, key: o.key, mkt: o.mkt, out: o.out, req: o.req };
    E().WRITE.forEach(function (k) { if (!M[k].length) M[k].push({ m: "", t: "" }); });   // empty section ⇒ one box ready to type
    return M;
  }
  function textOf(M) {
    if (M.frame) return E().render(M, M.res);
    return M.lines.filter(function (l) { return String(l.t).trim(); }).map(function (l) { return (l.m ? E().MK[l.m] + " " : "") + l.t.trim(); }).join("\n");
  }
  function secs(M) { return M.frame ? E().WRITE : ["lines"]; }

  function title(R) {
    var cty = R.co.code === "t" ? "Thailand/Myanmar" : "Vietnam/Lao/Cambodia";
    return cty + " · " + (R.sg ? R.sg.name : "") + (R.d ? " · " + R.d.name : " Total");
  }

  window.EXE = {
    open: function (id) {
      var R = REG[id]; if (!R || !E()) return;
      var k = keyOf(R), D = loadD(), dr = D[k];
      CUR = { R: R, k: k, M: modelFrom(R, dr ? dr.text : R.t.e), draft: !!dr, busy: false };
      paint();
    },
    close: function () {
      var el = document.getElementById("exe-ov"); if (el) el.remove();
      document.removeEventListener("keydown", onKey, true);
      CUR = null;
    },
    /* test hooks */
    _cur: function () { return CUR; }, _text: function () { return CUR ? textOf(CUR.M) : ""; },
    frameHtml: frameHtml
  };
  function onKey(e) { if (e.key === "Escape" && CUR && !CUR.busy) { e.preventDefault(); EXE.close(); } }

  function paint() {
    var C = CUR, R = C.R, M = C.M;
    var ov = document.getElementById("exe-ov");
    if (!ov) {
      ov = document.createElement("div"); ov.id = "exe-ov"; ov.className = "exe-ov";
      ov.addEventListener("mousedown", function (e) { if (e.target === ov && !CUR.busy) EXE.close(); });
      document.body.appendChild(ov);
      document.addEventListener("keydown", onKey, true);
    }
    var vlbl = (R.v.t || R.v.ft || "") + " · ver " + (R.v.v || "") + (R.v.tFct ? " · " + R.v.tFct : "");
    var h = '<div class="exe-box" role="dialog" aria-label="Edit explanation">'
      + '<div class="exe-hd"><div><div class="exe-tt">' + esc(title(R)) + '</div><div class="exe-st">' + esc(vlbl) + "</div></div>"
      + '<button class="exe-x" onclick="EXE.close()" title="Close (Esc)">×</button></div>'
      + '<div class="exe-bd">';
    if (C.draft) h += '<div class="exe-note">Unsaved draft from this device restored. <a href="#" data-act="drop">Discard draft</a></div>';
    if (M.frame) {
      h += '<div class="exe-sec"><div class="exe-sh">Results <span>calculated by the system</span></div><div class="exe-res">'
        + (M.res.length ? M.res.map(function (s) { return "<div>" + esc(s) + "</div>"; }).join("") : "<div>Monthly and Cumulative results are added when you save.</div>")
        + "</div></div>";
    }
    secs(M).forEach(function (k) {
      var L = M.frame ? M[k] : M.lines;
      h += '<div class="exe-sec" data-sec="' + k + '"><div class="exe-sh">' + esc(M.frame ? E().secTitle(k) : "Explanation")
        + (M.frame ? " <span>" + esc(HINT[k]) + "</span>" : "") + "</div>";
      L.forEach(function (l, i) {
        h += '<div class="exe-ln" data-sec="' + k + '" data-i="' + i + '"><div class="exe-mks">'
          + MKS.map(function (m) { return '<button class="exe-mk' + (l.m === m[0] ? " on" : "") + " k" + (m[0] === "+" ? "p" : m[0] === "-" ? "n" : m[0] === "f" ? "f" : "0") + '" data-mk="' + m[0] + '" title="' + m[2] + '">' + m[1] + "</button>"; }).join("")
          + '</div><textarea rows="1" spellcheck="true" placeholder="Write one point…">' + esc(l.t) + "</textarea>"
          + '<button class="exe-del" data-act="del" title="Remove line">×</button></div>';
      });
      h += '<button class="exe-add" data-act="add" data-sec="' + k + '">+ Add line</button></div>';
    });
    h += '<details class="exe-pv"><summary>Preview as saved in the sheet</summary><pre id="exe-pre"></pre></details>'
      + "</div>"
      + '<div class="exe-ft"><span id="exe-msg" class="exe-msg"></span>'
      + '<button class="exe-b2" onclick="EXE.close()">Cancel</button>'
      + '<button class="exe-b1" id="exe-save">Save to sheet</button></div></div>';
    ov.innerHTML = h;
    wire(ov);
    grow(ov);
    pv();
  }

  function listOf(k) { return CUR.M.frame ? CUR.M[k] : CUR.M.lines; }
  function wire(ov) {
    ov.querySelectorAll(".exe-ln").forEach(function (row) {
      var k = row.getAttribute("data-sec"), i = +row.getAttribute("data-i");
      var ta = row.querySelector("textarea");
      ta.addEventListener("input", function () {
        var v = ta.value;
        if (/\n/.test(v)) { splitInto(k, i, v); return; }
        listOf(k)[i].t = v; autoH(ta); keep();
      });
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); addAt(k, i + 1); }
        if (e.key === "Backspace" && !ta.value && listOf(k).length > 0) { e.preventDefault(); listOf(k).splice(i, 1); keep(); paint(); focusAt(k, Math.max(0, i - 1)); }
      });
      row.querySelectorAll(".exe-mk").forEach(function (b) {
        b.addEventListener("click", function () { listOf(k)[i].m = b.getAttribute("data-mk"); keep(); paint(); });
      });
      row.querySelector(".exe-del").addEventListener("click", function () { listOf(k).splice(i, 1); keep(); paint(); });
    });
    ov.querySelectorAll(".exe-add").forEach(function (b) { b.addEventListener("click", function () { addAt(b.getAttribute("data-sec"), listOf(b.getAttribute("data-sec")).length); }); });
    var dr = ov.querySelector('[data-act="drop"]');
    if (dr) dr.addEventListener("click", function (e) {
      e.preventDefault(); var D = loadD(); delete D[CUR.k]; saveD(D);
      CUR.M = modelFrom(CUR.R, CUR.R.t.e); CUR.draft = false; paint();
    });
    document.getElementById("exe-save").addEventListener("click", save);
  }
  function addAt(k, i) {
    var L = listOf(k), prev = L[i - 1];
    L.splice(i, 0, { m: prev && k !== "lines" ? prev.m : "", t: "" });
    keep(); paint(); focusAt(k, i);
  }
  function focusAt(k, i) {
    var el = document.querySelector('.exe-ln[data-sec="' + k + '"][data-i="' + i + '"] textarea');
    if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
  }
  /* pasted / typed several lines ⇒ split; text with headings ⇒ goes to the right sections */
  function splitInto(k, i, v) {
    var M = CUR.M;
    if (M.frame && /(key\s*factors|market\s*(and|&)\s*competitor|outlook|requests?\s*to)/i.test(v)) {
      var o = E().parse("■ " + E().secTitle(k) + "\n" + v);          // lines before the first heading stay in this section
      M[k].splice(i, 1);
      E().WRITE.forEach(function (s) { M[s] = M[s].concat(o[s]); });
    } else {
      var parts = v.split(/\r?\n/).filter(function (s, j) { return s.trim() || j === 0; }).map(function (s) { return E().mark(s); });
      var L = listOf(k), keepM = L[i].m;
      if (parts.length && !parts[0].m) parts[0].m = keepM;
      Array.prototype.splice.apply(L, [i, 1].concat(parts));
    }
    keep(); paint(); focusAt(k, i);
  }
  function autoH(ta) { ta.style.height = "auto"; ta.style.height = Math.min(220, ta.scrollHeight + 2) + "px"; }
  function grow(ov) { ov.querySelectorAll("textarea").forEach(autoH); }
  function pv() { var p = document.getElementById("exe-pre"); if (p) p.textContent = textOf(CUR.M); }
  function keep() {
    var D = loadD(); D[CUR.k] = { text: textOf(CUR.M), at: Date.now() }; saveD(D); pv();
  }
  function msg(s, bad) { var m = document.getElementById("exe-msg"); if (m) { m.textContent = s || ""; m.className = "exe-msg" + (bad ? " bad" : ""); } }

  /* ── save ────────────────────────────────────────────────────────── */
  function jsonp(params, cb, tmo) {
    var name = "exe_cb_" + Date.now() + "_" + Math.floor(Math.random() * 1e5), s = document.createElement("script"), done = false;
    var timer = setTimeout(function () { fin({ ok: false, code: "TIMEOUT", error: "No answer from the server (timeout)." }); }, tmo || 45000);
    function fin(r) { if (done) return; done = true; clearTimeout(timer); try { delete window[name]; } catch (e) { window[name] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); cb(r); }
    window[name] = function (r) { fin(r || { ok: false }); };
    s.onerror = function () { fin({ ok: false, code: "NET", error: "Could not reach the server. Check that you are signed in with your company Google account." }); };
    var q = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    s.src = (window.EXE_URL || EXE_URL) + "?" + q + "&callback=" + name + "&_t=" + Date.now();
    document.body.appendChild(s);
  }
  function chunks(text, max) {
    var out = [], cur = "", len = 0;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i], n = encodeURIComponent(ch).length;
      if (/[\ud800-\udbff]/.test(ch) && i + 1 < text.length) { ch += text[++i]; n = encodeURIComponent(ch).length; }
      if (len + n > max && cur) { out.push(cur); cur = ""; len = 0; }
      cur += ch; len += n;
    }
    if (cur || !out.length) out.push(cur);
    return out;
  }
  function save() {
    var C = CUR; if (!C || C.busy) return;
    var R = C.R, text = textOf(C.M);
    var base = { action: "exSave", row: R.t.r, fy: R.v.fy || "", ver: R.v.v, ft: R.v.ft || "", tfct: R.v.tFct || "", sc: R.v.sc || "Single",
      cty: R.co.code, seg: R.sg ? R.sg.name : "", dist: R.d ? R.d.name : "", rid: "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) };
    C.busy = true;
    var btn = document.getElementById("exe-save"); if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
    msg("");
    var parts = chunks(text, 1600);
    function finish(r) {
      C.busy = false;
      if (btn) { btn.disabled = false; btn.textContent = "Save to sheet"; }
      if (!r || !r.ok) { msg((r && r.error) || "Not saved — try again.", true); return; }
      var D = loadD(); delete D[C.k]; saveD(D);
      R.t.e = r.text; if (r.fr) R.t.fr = 1;
      EXE.close();
      try { if (typeof renderExpContent === "function") renderExpContent(); } catch (e) {}
      try { if (typeof showToast === "function") showToast("Explanation saved to the sheet", "success"); } catch (e) {}
    }
    if (parts.length === 1) { base.text = text; jsonp(base, finish); return; }
    var pid = base.rid, i = 0;
    (function next() {
      if (i >= parts.length) { base.pid = pid; base.pn = parts.length; jsonp(base, finish); return; }
      msg("Sending " + (i + 1) + "/" + parts.length + "…");
      jsonp({ action: "exPart", pid: pid, i: i, d: parts[i] }, function (r) { if (!r || !r.ok) { finish(r); return; } i++; next(); }, 30000);
    })();
  }

  /* ── styles ──────────────────────────────────────────────────────── */
  var css = ""
    + ".exf{display:flex;flex-direction:column;gap:1px;white-space:normal}"
    + ".exf-res{background:var(--bg);border:1px solid var(--br);border-radius:6px;padding:5px 8px;margin-bottom:4px;font-size:11.5px;color:var(--t2)}"
    + ".exf-res b{color:var(--t1);font-weight:700}"
    + ".exf-h{font-size:10.5px;font-weight:800;letter-spacing:.3px;text-transform:uppercase;color:var(--t1);margin-top:5px}"
    + ".exf-h:before{content:'■ ';color:var(--B)}"
    + ".exf-ln{display:flex;gap:6px;align-items:flex-start;padding-left:2px}"
    + ".exf-mk{flex:0 0 auto;width:18px;text-align:center}.exf-dot{flex:0 0 auto;width:18px;text-align:center;color:var(--t3)}"
    + ".exf-plain .exf-ln.m0{padding-left:0}"
    + ".exf-none{color:var(--t3);font-size:11.5px;padding-left:24px}"
    + ".exe-btn{margin-top:6px;font:inherit;font-size:11.5px;font-weight:700;color:var(--B);background:transparent;border:1px solid var(--br);border-radius:6px;padding:2px 10px;cursor:pointer}"
    + ".exe-btn:hover{background:var(--bg);border-color:var(--B)}"
    + ".exe-ov{position:fixed;inset:0;background:rgba(20,32,48,.38);z-index:9000;display:flex;align-items:flex-start;justify-content:center;padding:4vh 12px;overflow:auto}"
    + ".exe-box{background:var(--sf);color:var(--t1);border:1px solid var(--br);border-radius:12px;width:min(760px,100%);max-height:92vh;display:flex;flex-direction:column;font-family:var(--ff);box-shadow:0 10px 40px rgba(0,0,0,.18)}"
    + ".exe-hd{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:14px 18px 10px;border-bottom:1px solid var(--br)}"
    + ".exe-tt{font-size:16px;font-weight:800}.exe-st{font-size:12px;color:var(--t2)}"
    + ".exe-x{font:inherit;font-size:22px;line-height:1;border:0;background:transparent;color:var(--t2);cursor:pointer;padding:0 4px}"
    + ".exe-bd{padding:10px 18px;overflow:auto;flex:1}"
    + ".exe-note{background:#FFF8E1;border:1px solid #F0D98A;color:#6B5316;border-radius:8px;padding:6px 10px;font-size:12.5px;margin-bottom:8px}"
    + ".exe-sec{margin:10px 0 14px}"
    + ".exe-sh{font-size:13px;font-weight:800;margin-bottom:6px}.exe-sh:before{content:'■ ';color:var(--B)}"
    + ".exe-sh span{font-weight:400;color:var(--t3);font-size:12px;margin-left:6px}"
    + ".exe-res{background:var(--bg);border:1px solid var(--br);border-radius:8px;padding:7px 10px;font-size:12.5px;color:var(--t2)}"
    + ".exe-ln{display:flex;gap:6px;align-items:flex-start;margin-bottom:6px}"
    + ".exe-mks{display:flex;gap:2px;flex:0 0 auto;padding-top:3px}"
    + ".exe-mk{font:inherit;font-size:13px;width:28px;height:28px;border:1px solid var(--br);border-radius:6px;background:var(--sf);cursor:pointer;opacity:.45;padding:0}"
    + ".exe-mk.on{opacity:1;border-color:var(--B);background:var(--bg);box-shadow:inset 0 0 0 1px var(--B)}"
    + ".exe-mk.k0{color:var(--t2);font-weight:700}"
    + ".exe-ln textarea{flex:1;font:inherit;font-size:13.5px;color:var(--t1);background:var(--sf);border:1px solid #C3CDD8;border-radius:6px;padding:6px 8px;resize:none;min-height:34px;line-height:1.45}"
    + ".exe-ln textarea:focus{outline:none;border-color:var(--B);box-shadow:0 0 0 3px rgba(91,135,184,.15)}"
    + ".exe-del{font:inherit;font-size:18px;line-height:1;border:0;background:transparent;color:var(--t3);cursor:pointer;padding:6px 4px}"
    + ".exe-del:hover{color:#B3261E}"
    + ".exe-add{font:inherit;font-size:12.5px;font-weight:700;color:var(--B);background:transparent;border:1px dashed var(--br);border-radius:6px;padding:4px 12px;cursor:pointer;margin-left:120px}"
    + ".exe-pv summary{cursor:pointer;font-size:12.5px;color:var(--t2)}"
    + ".exe-pv pre{white-space:pre-wrap;font-family:var(--ff);font-size:12.5px;background:var(--bg);border:1px solid var(--br);border-radius:8px;padding:8px 10px;margin-top:6px}"
    + ".exe-ft{display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:10px 18px;border-top:1px solid var(--br)}"
    + ".exe-msg{flex:1;font-size:12.5px;color:var(--t2)}.exe-msg.bad{color:#B3261E;font-weight:600}"
    + ".exe-b1,.exe-b2{font:inherit;font-size:13.5px;font-weight:700;border-radius:8px;padding:7px 16px;cursor:pointer}"
    + ".exe-b1{background:var(--B);color:#fff;border:1px solid var(--B)}.exe-b1:disabled{opacity:.6;cursor:wait}"
    + ".exe-b2{background:transparent;color:var(--t1);border:1px solid var(--br)}"
    + "@media (max-width:640px){.exe-ln{flex-wrap:wrap}.exe-mks{order:2}.exe-ln textarea{flex:1 1 100%}.exe-add{margin-left:0}.exe-ov{padding:0}.exe-box{border-radius:0;max-height:100vh;min-height:100vh}}";
  var st = document.createElement("style"); st.id = "exe-css"; st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();
