/* Test of v10.2 Explanation editor (exfmt/exedit.js) — HQ layout
   NODE_PATH=$(npm root -g) node tools/exfmt/test.js [--shots <dir>]
   · serves the repo over http, fakes the Apps Script backend (getTurnoverData + exSave / exPart)
   · the fake exSave answers like the real one: EXF.render(EXF.parse(text), system result lines) */
const path = require("path"), fs = require("fs"), http = require("http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "../..");
const EXF = require(path.join(ROOT, "exfmt/exfmt.js"));
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg("--shots", "");

const RES = ["Monthly Result for Nov 2026: Sales 32.4K USD / YoY -12% / vs. Budget -48%", "Cumulative Result (Sep–Nov 2026): Sales 44.1K USD / YoY +5% / vs. Budget -30%"];
const TPL = "■ Results\n" + RES.join("\n") + "\n■ Key Factors\n■ Market and Competitor situation\n■ Outlook and Actions Going Forward\n■ Requests to Other Departments";
let ROW = 100;
const N = (b, f, e, extra) => Object.assign({ b, f, vsb: f - b, pct: b ? Math.round((f - b) / b * 100) + "%" : "", lf: f, vlf: 0, e, r: ROW++ }, extra || {});
function seg(name, e, dists) { return { name, total: N(60000, 32000, e, { fr: 1 }), distributors: dists.map(([n, b, f, de]) => Object.assign({ name: n }, N(b, f, de))) }; }
const versions = [
  { v: "20261116", ft: "202611", tFct: "Forecast", sc: "Single", fy: "FY68", l: "", t: "Forecast Nov-26 (KUSD)", p: "Q1",
    countries: [{ code: "t", name: "Thailand", total: N(1, 1, ""), segments: [{ name: "Dental", total: N(50000, 40000, "keeping information"), distributors: [] }] }] },
  { v: "20261127", ft: "202611", tFct: "Actual", sc: "Single", fy: "FY68", l: "", t: "Actual Nov-26 (KUSD)", p: "Q1",
    countries: [
      { code: "t", name: "Thailand", total: N(379385, 164475, "Not Requirement"), segments: [
        seg("Dental", TPL, [["DDI", 34000, 19985, "(+) DDI got new tender\n-> check stock"], ["VRP DENT", 8559, 0, ""]]),
        seg("MMG", TPL, []), seg("Surgical", TPL, [["AFTA-INNOTECH", 316826, 132114, "❌ registration delay"]]) ] },
      { code: "v", name: "Viet Nam and others", total: N(506255, 601085, ""), segments: [
        seg("Dental", TPL, []), seg("Eyeless", TPL, []), seg("MMG", TPL, []), seg("Surgical", TPL, []) ] },
      { code: "g", name: "Grand Total", total: N(885640, 765560, "Not Requirement"), segments: [] } ] },
  { v: "20261127", ft: "202611", tFct: "Actual", sc: "Cumulative", fy: "FY68", l: "", t: "Cumulative Nov-26 (KUSD)", p: "Q1",
    countries: [{ code: "t", name: "Thailand", total: N(1, 1, ""), segments: [{ name: "Dental", total: N(63400, 44100, ""), distributors: [] }] }] }
];
const payload = { ok: false, fy: "FY68", versions };

function serve() {
  const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg" };
  return new Promise((ok) => {
    const s = http.createServer((q, r) => {
      const p = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]));
      fs.readFile(p.endsWith("/") ? p + "index.html" : p, (e, b) => {
        if (e) { r.writeHead(404); return r.end(); }
        r.writeHead(200, { "content-type": types[path.extname(p)] || "application/octet-stream" }); r.end(b);
      });
    }).listen(0, () => ok(s));
  });
}
let fails = 0;
const check = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fails++; };

(async () => {
  const srv = await serve(), base = "http://127.0.0.1:" + srv.address().port + "/";
  const br = await chromium.launch();
  const saves = [], parts = {}, hosts = [];
  let failNext = false;
  async function setup(ctx) {
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.route(/script\.google(usercontent)?\.com/, (route) => {
      const u = new URL(route.request().url()), cb = u.searchParams.get("callback"), act = u.searchParams.get("action");
      hosts.push(u.pathname.split("/s/")[1].slice(0, 12) + ":" + act);
      let body = { ok: false };
      if (act === "getTurnoverData") body = payload;
      else if (act === "exPart") { parts[u.searchParams.get("pid") + "_" + u.searchParams.get("i")] = u.searchParams.get("d"); body = { ok: true }; }
      else if (act === "exSave") {
        const p = Object.fromEntries(u.searchParams.entries());
        let text = p.text || "";
        if (p.pid) { text = ""; for (let i = 0; i < +p.pn; i++) text += parts[p.pid + "_" + i]; }
        saves.push(Object.assign({}, p, { text, urlLen: route.request().url().length }));
        if (failNext) { failNext = false; body = { ok: false, code: "BUSY", error: "The sheet is busy — try again in a moment." }; }
        else body = { ok: true, row: +p.row, fr: p.dist ? 0 : 1, text: p.dist ? EXF.marksOnly(text) : EXF.render(EXF.parse(text), RES) };
      }
      route.fulfill({ status: 200, contentType: "application/javascript", body: cb ? cb + "(" + JSON.stringify(body) + ")" : JSON.stringify(body) });
    });
    await page.route(/cdn\.jsdelivr\.net\/npm\//, (route) => {
      if (/chart\.umd/.test(route.request().url())) return route.fulfill({ status: 200, contentType: "application/javascript",
        body: "window.Chart=function(){this.destroy=function(){};this.update=function(){};this.data={datasets:[]};this.options={};};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}},tooltip:{}},scale:{grid:{},ticks:{}}};" });
      route.fulfill({ status: 200, contentType: "application/javascript", body: /datalabels/.test(route.request().url()) ? "window.ChartDataLabels={};" : "" });
    });
    await page.route(/fonts\.(googleapis|gstatic)\.com|flagcdn|unpkg|cdnjs/, (r) => r.fulfill({ status: 200, body: "" }));
    await page.addInitScript(() => { try { localStorage.setItem("mmh_tab", "exp"); } catch (e) {} });
    await page.goto(base + "index.html");
    await page.waitForSelector("#exp-content .exf", { timeout: 30000 }).catch(async (e) => { console.log("errors:", errs); throw e; });
    await page.waitForTimeout(500);
    return { page, errs };
  }

  const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 } });
  const { page, errs } = await setup(ctx);
  console.log("Display");
  check(hosts.some((h) => h.startsWith("AKfycbz26knl:getTurnoverData")), "reads from the managed deployment");
  const heads = await page.$$eval("#exp-content .exp-seg-row .exf:not(.exf-plain)", (x) => x.length);
  check(heads === 7, "7 segment totals (latest version) shown in the HQ layout: " + heads);
  const h1 = await page.$eval("#exp-content .exp-seg-row .exf", (e) => e.innerText);
  check(/Monthly Result for Nov 2026/.test(h1) && /KEY FACTORS/i.test(h1) && /REQUESTS TO OTHER DEPARTMENTS/i.test(h1) && !/XXXX/.test(h1), "results + 4 headings, no template placeholders");
  const old = await page.$$eval("#exp-content .exp-seg-row .ex-txt", (x) => x.map((e) => e.innerText).filter((t) => /keeping information/.test(t)));
  check(old.length === 1 && !/Key Factors/i.test(old[0]), "older version keeps its free text (no layout)");
  const btns = await page.$$eval(".exe-btn", (x) => x.length);
  check(btns >= 7 + 3, "Edit buttons on Single totals + distributors: " + btns);
  const cumBtn = await page.$$eval(".exp-ver-card", (cards) => cards.filter((c) => /YTD Cumulative/.test(c.innerText)).map((c) => c.querySelectorAll(".exe-btn").length));
  check(cumBtn.length === 1 && cumBtn[0] === 0, "no Edit on the Cumulative card");
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "exp_1440.png") }); }

  console.log("Edit a segment total");
  await page.click(".exp-seg-row .exe-btn");
  await page.waitForSelector("#exe-ov .exe-box");
  check(await page.$$eval("#exe-ov .exe-sec[data-sec]", (x) => x.map((e) => e.getAttribute("data-sec")).join(",")) === "key,mkt,out,req", "editor has the 4 sections");
  await page.click('#exe-ov .exe-ln[data-sec="key"][data-i="0"] textarea');
  await page.keyboard.type("DDI won the provincial tender");
  await page.click('#exe-ov .exe-ln[data-sec="key"][data-i="0"] .exe-mk[data-mk="+"]');
  await page.click('#exe-ov .exe-ln[data-sec="key"][data-i="0"] textarea');
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("VRP DENT no order yet");
  await page.click('#exe-ov .exe-ln[data-sec="key"][data-i="1"] .exe-mk[data-mk="-"]');
  // paste text with headings into Market → goes to the right sections
  await page.$eval('#exe-ov .exe-ln[data-sec="mkt"] textarea', (t) => { t.value = "Komet cut price 10%\nOutlook and actions going forward:\n-> visit 5 key accounts\nRequests to other departments: RA to renew DDI license"; t.dispatchEvent(new Event("input")); });
  await page.waitForTimeout(200);
  const txt = await page.evaluate(() => EXE._text());
  check(/■ Key Factors\n✅ DDI won the provincial tender\n❌ VRP DENT no order yet\n■ Market and Competitor situation\n- Komet cut price 10%\n■ Outlook and Actions Going Forward\n➡️ visit 5 key accounts\n■ Requests to Other Departments\n- RA to renew DDI license/.test(txt), "model → HQ text:\n" + txt);
  check((await page.$eval("#exe-pre", (e) => e.textContent)) === txt, "preview = text saved to the sheet");
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "exe_1440.png") });
  failNext = true;
  await page.click("#exe-save");
  await page.waitForSelector(".exe-msg.bad");
  check(await page.$("#exe-ov") !== null && /busy/.test(await page.$eval(".exe-msg", (e) => e.textContent)), "server error ⇒ dialog stays open with the message");
  await page.click("#exe-save");
  await page.waitForSelector("#exe-ov", { state: "detached" });
  const s1 = saves[saves.length - 1];
  check(s1.ver === "20261127" && s1.ft === "202611" && s1.sc === "Single" && s1.cty === "t" && s1.seg === "Dental" && s1.dist === "" && +s1.row > 0, "exSave keys: " + [s1.row, s1.ver, s1.ft, s1.sc, s1.cty, s1.seg].join(" · "));
  check(hosts.filter((h) => /:exSave$/.test(h)).every((h) => h.startsWith("AKfycbz26knl")), "writes go to the managed deployment");
  const shown = await page.$eval("#exp-content .exp-seg-row .exf", (e) => e.innerText);
  check(/DDI won the provincial tender/.test(shown) && /visit 5 key accounts/.test(shown), "row updated right after saving");
  check(await page.evaluate(() => !localStorage.getItem("mmh_exe_draft") || localStorage.getItem("mmh_exe_draft") === "{}"), "draft cleared after save");

  console.log("Distributor line editor");
  await page.click(".exp-seg-row[onclick] .ex-id");                 // expand Thailand Dental distributors
  await page.click(".exp-dist-row .exe-btn");
  await page.waitForSelector("#exe-ov .exe-box");
  check(await page.$$eval("#exe-ov .exe-ln", (x) => x.length) === 2, "distributor text → 2 lines");
  check(await page.$eval('#exe-ov .exe-ln[data-i="0"] .exe-mk.on', (e) => e.getAttribute("data-mk")) === "+", "(+) read as ✅");
  await page.click("#exe-save");
  await page.waitForSelector("#exe-ov", { state: "detached" });
  const s2 = saves[saves.length - 1];
  check(s2.dist === "DDI" && s2.text === "✅ DDI got new tender\n➡️ check stock", "distributor saved: " + JSON.stringify(s2.text));

  console.log("Long text ⇒ parts");
  await page.click(".exp-seg-row:nth-of-type(1) .exe-btn").catch(() => page.click(".exp-seg-row .exe-btn"));
  await page.waitForSelector("#exe-ov .exe-box");
  await page.evaluate(() => { const c = EXE._cur(); for (let i = 0; i < 40; i++) c.M.out.push({ m: "f", t: "Theo dõi đơn hàng của nhà phân phối và báo cáo hằng tuần — dòng " + i }); });
  await page.click("#exe-save");
  await page.waitForSelector("#exe-ov", { state: "detached" });
  const s3 = saves[saves.length - 1];
  check(!!s3.pid && +s3.pn > 1 && /dòng 39/.test(s3.text) && saves.every((x) => x.urlLen < 7500), "sent in " + s3.pn + " parts, every URL < 7500 chars");

  console.log("Draft kept on this device");
  await page.click(".exp-seg-row .exe-btn");
  await page.click('#exe-ov .exe-add[data-sec="req"]');
  await page.keyboard.type("Draft line not saved");
  await page.keyboard.press("Escape");
  await page.click(".exp-seg-row .exe-btn");
  check(/Draft line not saved/.test(await page.evaluate(() => EXE._text())) && await page.$("#exe-ov .exe-note") !== null, "draft restored when opening again");
  await page.click('#exe-ov [data-act="drop"]');
  check(!/Draft line not saved/.test(await page.evaluate(() => EXE._text())), "discard draft");
  await page.keyboard.press("Escape");
  check(errs.length === 0, "no page errors " + errs.join(" | "));

  console.log("Phone 390 px");
  const m = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const { page: pm } = await setup(m);
  await pm.click(".exp-seg-row .exe-btn");
  await pm.waitForSelector("#exe-ov .exe-box");
  const bw = await pm.$eval("#exe-ov .exe-box", (e) => e.getBoundingClientRect().width);
  const over = await pm.evaluate(() => document.querySelector("#exe-ov .exe-bd").scrollWidth > document.querySelector("#exe-ov .exe-bd").clientWidth + 1);
  check(bw <= 390 && !over, "editor fits the phone (" + bw + " px, no side scroll)");
  if (SHOTS) await pm.screenshot({ path: path.join(SHOTS, "exe_390.png") });

  await br.close(); srv.close();
  console.log(fails ? "\n" + fails + " FAILED" : "\nAll checks passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
