/* Test of the Forecast Report (Word) tab — fcrep/fcrep.js
   NODE_PATH=$(npm root -g) node tools/fcrep/test.js [--fixture tools/fcrep/sample.json] [--shots <dir>] [--out <dir>]
   · serves the repo over http, fakes the Apps Script backend (script.google.com) with the fixture
   · checks the table (groups, numbers, marks), editing + draft, the .docx parts, copy for e-mail
   · --out keeps the downloaded .docx; --shots saves screenshots 1440 px and 390 px */
const path = require("path"), fs = require("fs"), http = require("http");
const { chromium } = require("playwright");
const ROOT = path.resolve(__dirname, "../..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FIX = path.resolve(arg("--fixture", path.join(__dirname, "sample.json")));
const SHOTS = arg("--shots", ""), OUT = arg("--out", "");
const JSZip = require(path.join(ROOT, "vendor/jszip.min.js"));

function payloadFrom(spec) {
  const K = (n) => Math.round((+n || 0) * 1000);
  const versions = spec.versions.map((V) => {
    const cos = {};
    let G = { b: 0, f: 0, lf: 0 };
    V.segs.forEach((s) => {
      const co = cos[s.co] || (cos[s.co] = { code: s.co, name: s.co === "t" ? "Thailand" : "Viet Nam and others", total: null, segments: [], _s: { b: 0, f: 0, lf: 0 } });
      const t = { b: 0, f: 0, lf: 0 };
      const dists = s.dists.map(([name, b, lf, f, e]) => {
        t.b += b; t.f += f; t.lf += lf;
        return { name, b: K(b), f: K(f), vsb: K(f - b), pct: b ? Math.round((f - b) / b * 100) + "%" : "", lf: K(lf), vlf: K(f - lf), e };
      });
      co.segments.push({ name: s.seg, total: { b: K(t.b), f: K(t.f), vsb: K(t.f - t.b), pct: "", lf: K(t.lf), vlf: K(t.f - t.lf), e: s.e }, distributors: dists });
      ["b", "f", "lf"].forEach((k) => { co._s[k] += t[k]; G[k] += t[k]; });
    });
    const countries = ["t", "v"].filter((c) => cos[c]).map((c) => {
      const co = cos[c], s = co._s; delete co._s;
      co.total = { b: K(s.b), f: K(s.f), vsb: K(s.f - s.b), pct: "", lf: K(s.lf), vlf: K(s.f - s.lf), e: "" };
      return co;
    });
    countries.push({ code: "g", name: "Grand Total", total: { b: K(G.b), f: K(G.f), vsb: K(G.f - G.b), pct: "", lf: K(G.lf), vlf: K(G.f - G.lf), e: (V.grand || {}).e || "" }, segments: [] });
    return { v: V.v, ft: V.ft, tFct: V.tFct, sc: V.sc, fy: spec.fy, l: "", t: "", p: "", countries };
  });
  return { ok: false, versions, fy: spec.fy };
}

function serve() {
  const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".md": "text/plain" };
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
  const spec = JSON.parse(fs.readFileSync(FIX, "utf8"));
  const payload = payloadFrom(spec);
  const srv = await serve(), base = "http://127.0.0.1:" + srv.address().port + "/";
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.route(/script\.google(usercontent)?\.com/, (route) => {
    const u = new URL(route.request().url()), cb = u.searchParams.get("callback"), act = u.searchParams.get("action");
    const body = act === "getTurnoverData" ? payload : { ok: false };
    route.fulfill({ status: 200, contentType: "application/javascript", body: cb ? cb + "(" + JSON.stringify(body) + ")" : JSON.stringify(body) });
  });
  // CDN (chart.js…) is often blocked in test machines: serve from --cdn <node_modules> (npm i chart.js@4.4.0 chartjs-plugin-datalabels@2.2.0)
  const CDN = arg("--cdn", process.env.FCR_CDN || "");
  await page.route(/cdn\.jsdelivr\.net\/npm\//, (route) => {
    const m = /\/npm\/((?:@[^/]+\/)?[^@/]+)@[^/]+\/(.+)$/.exec(route.request().url());
    let f = m && CDN ? path.join(CDN, m[1], m[2]) : "";
    if (f && !fs.existsSync(f) && /\.min\.js$/.test(f)) f = f.replace(/\.min\.js$/, ".js");
    if (f && fs.existsSync(f)) return route.fulfill({ status: 200, contentType: "application/javascript", body: fs.readFileSync(f) });
    if (/chart\.umd/.test(route.request().url())) return route.fulfill({ status: 200, contentType: "application/javascript",
      body: "window.Chart=function(){this.destroy=function(){};this.update=function(){};this.data={datasets:[]};this.options={};};Chart.register=function(){};Chart.defaults={font:{},plugins:{legend:{labels:{}},tooltip:{}},scale:{grid:{},ticks:{}}};" });
    route.fulfill({ status: 200, contentType: "application/javascript", body: /datalabels/.test(route.request().url()) ? "window.ChartDataLabels={};" : "" });
  });
  await page.addInitScript(() => { try { localStorage.setItem("mmh_tab", "fcr"); } catch (e) {} });
  await page.goto(base + "index.html");
  await page.waitForSelector("#fcr-paper .fcr-tb", { timeout: 30000 });
  await page.waitForTimeout(800);

  console.log("Table");
  const rows = await page.$$eval("#fcr-paper .fcr-sec:first-child .fcr-tb:first-of-type tbody tr", (t) => t.map((r) => [...r.children].map((c) => c.classList.contains("x")
    ? [...c.querySelectorAll(".fcr-ln")].map((l) => ((l.querySelector(".fcr-mk") || {}).textContent || "").replace("\u00B7", "") + " " + l.querySelector(".fcr-tx").textContent).map((x) => x.trim()).join("\n")
    : c.innerText.trim())));
  const names = rows.map((r) => r[0]);
  check(names.slice(0, 6).join("|") === "G1 TH/MM Surgical|G2 TH Dental/MMG|G3 VN Surgical|G4 VN/LA/KH/MM Dental|G5 VN/LA/KH/MM MMG|G6 VN Eyeless", "6 groups in template order: " + names.join(" · "));
  check(names[names.length - 1].startsWith("Total"), "last row = Total");
  const g = (code) => rows.find((r) => r[0].startsWith(code));
  // latest Q1 Single: G1 b 390 lf 205 f 205
  check(g("G1").slice(1, 6).join(" ") === "390 205 205 0 -185", "G1 numbers " + g("G1").slice(1, 6).join(" "));
  check(g("G2").slice(1, 6).join(" ") === "73 55 58 +3 -15", "G2 = TH Dental + TH MMG " + g("G2").slice(1, 6).join(" "));
  const T = rows[rows.length - 1].slice(1, 6).map((s) => +s.replace(/[,+]/g, ""));
  const sum = (i) => rows.slice(0, -1).reduce((a, r) => a + +r[i].replace(/[,+]/g, ""), 0);
  check(T[0] === sum(1) && T[2] === sum(3) && T[1] === sum(2), "Total = sum of rows");
  check(/❌ Product registration/.test(g("G1")[6]) && /❌ Hospitals could not/.test(g("G1")[6]) && /✅ Novatec \+5/.test(g("G1")[6]), "G1 auto marks ✅/❌");
  check(/✅ Prompt Dent \+3/.test(g("G2")[6]) && /❌ Prompt Dent still has high inventory/.test(g("G2")[6]), "G2 one distributor, two marks");
  check(/➡️ Follow up with RA every week/.test(g("G1")[6]), "follow-up line kept with its arrow (not turned into a check / cross)");
  check(/➡️ Follow up: check SPI stock/.test(g("G4")[6]), "line starting with Follow up: gets the arrow");
  check(/^No change from the previous forecast/.test(g("G1")[6].trim()), "G1 auto headline when vs. Prev. = 0");
  check(/Q1 total is unchanged/.test(rows[rows.length - 1][6]) && /G1 TH\/MM Surgical/.test(rows[rows.length - 1][6]), "Total auto sentence: " + rows[rows.length - 1][6].slice(0, 90));
  const sgn = await page.$eval("#fcr-paper tbody tr:nth-child(2) td:nth-child(5)", (e) => getComputedStyle(e).color);
  check(sgn === "rgb(30, 123, 52)", "positive vs. Prev. in green");
  const notes = await page.$$eval(".fcr-chk .fcr-ni", (n) => n.map((x) => x.innerText));
  check(notes.length > 0, "checks panel: " + notes.length + " item(s)");

  console.log("Edit + draft");
  await page.click('#fcr-paper .fcr-tx[data-g="G6"][data-i="0"]');
  await page.keyboard.press("End");
  await page.keyboard.type(" Next order in December.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Second line typed by hand.");
  await page.click(".fcr-t");
  await page.waitForTimeout(400);
  await page.click('#fcr-paper .fcr-mk[data-g="G6"][data-i="1"]');      // none → ✅
  await page.waitForTimeout(300);
  let g6 = await page.$eval('#fcr-paper tr:nth-child(6) td.x', (e) => e.innerText);
  check(/Next order in December\./.test(g6) && /✅\s*Second line typed by hand/.test(g6), "edited G6: " + g6.replace(/\n/g, " / "));
  check(await page.$('#fcr-paper tr.ed') !== null, "edited row tagged");
  await page.reload();
  await page.waitForSelector("#fcr-paper .fcr-tb");
  g6 = await page.$eval('#fcr-paper tr:nth-child(6) td.x', (e) => e.innerText);
  check(/Second line typed by hand/.test(g6), "draft kept after reload");

  console.log("Word file");
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, "fcr_1440.png"), fullPage: false }); }
  const [dl] = await Promise.all([page.waitForEvent("download"), page.click("#fcr-dl")]);
  const fn = dl.suggestedFilename();
  check(/^MMH_FY\d+_Forecast_Explanation_Q1_Single_v20261110\.docx$/.test(fn), "file name " + fn);
  const fp = await dl.path(), buf = fs.readFileSync(fp);
  if (OUT) { fs.mkdirSync(OUT, { recursive: true }); fs.copyFileSync(fp, path.join(OUT, fn)); }
  const z = await JSZip.loadAsync(buf);
  const doc = await z.file("word/document.xml").async("string");
  ["[Content_Types].xml", "_rels/.rels", "word/_rels/document.xml.rels", "word/styles.xml", "word/footer1.xml"].forEach((p) => check(!!z.file(p), "part " + p));
  check(doc.includes("Unit: K USD") && doc.includes("G1 TH/MM Surgical") && doc.includes("Prev. Fcst") && doc.includes("vs. Budget"), "document has unit, groups, template headers");
  check(doc.includes("Second line typed by hand") && doc.includes("✅ "), "edits + marks in the Word file");
  check(doc.includes("\u27A1\uFE0F ") && doc.includes("Follow up with RA"), "arrow mark in the Word file");
  check(doc.includes('w:orient="landscape"') && doc.includes("<w:tblHeader/>"), "landscape, header row repeats");
  check((doc.match(/<w:tr>/g) || []).length >= 8, "rows in Word table");

  console.log("Options: Single + Cumulative, detail, movers, portrait");
  await page.click('#fcr-body [data-sc="Cumulative"]');
  await page.waitForSelector("#fcr-paper .fcr-sec:nth-child(3)");
  await page.check("#fcr-o-detail"); await page.check("#fcr-o-movers");
  await page.click('#fcr-body [data-or="p"]');
  await page.waitForTimeout(300);
  const secs = await page.$$eval("#fcr-paper .fcr-sec .fcr-t", (t) => t.map((x) => x.innerText));
  check(secs.length === 2 && /Cumulative/.test(secs[1]), "two sections: " + secs.join(" | "));
  const parts = await page.evaluate(() => window.FCR.parts());
  const d2 = parts["word/document.xml"];
  check(d2.includes('<w:br w:type="page"/>') && d2.includes("Detail by distributor") && d2.includes("Key movers by distributor") && !d2.includes('w:orient="landscape"'), "page break, appendix, movers, portrait");
  check(/YTD Q1 is on the previous forecast/.test(d2), "Cumulative total uses the sheet Grand Total text");

  console.log("Compare with an older version");
  await page.click('#fcr-body [data-sc="Cumulative"]');
  await page.selectOption("#fcr-cmp", "20261020");
  await page.waitForTimeout(300);
  const sub = await page.$eval(".fcr-s", (e) => e.innerText);
  check(/version 20\/10\/2026/.test(sub), "subtitle names the compared version: " + sub);
  const g4 = await page.$$eval("#fcr-paper .fcr-sec:first-child .fcr-tb:first-of-type tbody tr", (t) => [...t[3].children].slice(1, 6).map((c) => c.innerText.trim()).join(" "));
  check(g4 === "1,030 1,030 1,021 -9 -9", "G4 vs version 20/10: " + g4);

  console.log("Period = month, type Actual, Other row");
  await page.selectOption("#fcr-ft", "202610");
  await page.waitForTimeout(300);
  const mrows = await page.$$eval("#fcr-paper tbody tr td.gn", (t) => t.map((x) => x.innerText));
  check(mrows.some((n) => /^Other/.test(n)), "Other row for TH Eyeless: " + mrows.join(" · "));
  check(/Oct 2026/.test(await page.$eval(".fcr-t", (e) => e.innerText)), "month title");

  console.log("Copy for e-mail");
  await page.click("#fcr-copy");
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  check(/Group\tBudget\tPrev\. Fcst/.test(clip), "clipboard text has the table");

  if (SHOTS) {
    await page.selectOption("#fcr-ft", "Q1");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, "fcr_1440_full.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, "fcr_390.png"), fullPage: false });
  }
  check(!errs.filter((e) => /fcr|FCR/.test(e)).length, "no page errors from the module " + errs.join(" | ").slice(0, 300));
  await br.close(); srv.close();
  console.log(fails ? "\n" + fails + " check(s) FAILED" : "\nAll checks passed");
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
