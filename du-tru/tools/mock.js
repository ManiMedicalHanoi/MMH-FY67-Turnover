/* Máy chủ giả lập cho app Dự trù NPP (Playwright: page.route(/script\.google\.com/)). DỮ LIỆU GIẢ — mã / tên hàng lấy từ danh mục
   công khai (catalog_sample.json), số lượng sinh ngẫu nhiên có hạt giống, tên NPP giả. Không đưa số thật vào repo công khai.
   Tình huống: mã dự trù dư nhiều (Cao), mã 6 tháng không có đơn, mã đặt mà chưa dự trù, mã khớp. */
const CATS = require('./catalog_sample.json');
const PRICE = { 'DIA-BURS': 52000, 'K-FILES': 88000, 'H-FILES': 88000, 'REAMERS': 88000, 'JIZAI': 690000, 'Composite': 245000, 'Bond': 520000, 'Bleaching': 610000,
  'CARBIDE BURS': 61000, 'GATES DRILLS': 98000, 'PEESO REAMERS': 98000 };
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function addM(ym, k) { const i = Math.floor(ym / 100) * 12 + (ym % 100 - 1) + k; return Math.floor(i / 12) * 100 + (i % 12) + 1; }

function makeState(opt = {}) {
  const cm = opt.cm || 202611, npps = opt.npps || ['NPP MẪU BẮC', 'NPP MẪU NAM', 'NPP MẪU TRUNG'];
  const r = rnd(opt.seed || 11);
  const cat = CATS.map(c => [c[0], c[1], c[2], Math.round((PRICE[c[2]] || 120000) * (0.8 + r() * 0.5) / 1000) * 1000]);
  const dt = [], tt = [], dk = [];
  const lastAct = opt.lastAct || addM(cm, -1), T = addM(cm, 3);
  npps.forEach((n, ni) => {
    cat.forEach((c, ci) => {
      const u = r();
      if (u > (ni === 0 ? 0.55 : 0.3)) return;                          // mã NPP này không bán
      const base = Math.max(2, Math.round((5 + r() * 60) * (c[2] === 'DIA-BURS' ? 1.6 : 1)));
      const kind = r();                                                  // tình huống
      const sc = kind < 0.16 ? 'over' : kind < 0.24 ? 'dead' : kind < 0.32 ? 'none' : kind < 0.42 ? 'watch' : 'ok';
      for (let m = 202603; m <= T; m = addM(m, 1)) {
        const need = Math.round(base * (0.7 + r() * 0.6));
        let res = sc === 'none' ? 0 : sc === 'over' ? Math.round(need * 1.7) : sc === 'watch' ? Math.round(need * 1.18) : need;
        if (m >= 202609 && m < T && res && sc !== 'none') dt.push([n, m, addM(m, -3), c[0], c[1], res, 'mẫu']);
        if (m <= lastAct) { const act = sc === 'dead' && m > addM(lastAct, -6) ? 0 : need;
          if (act) { const k = 1 + Math.floor(r() * 3); for (let j = 0; j < k; j++) tt.push([n, m, `${String(5 + j * 9).padStart(2, '0')}/${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}`, c[0], c[1], Math.max(1, Math.round(act / k)), 'Đơn mẫu']); } }
        if (m === cm && sc !== 'dead') tt.push([n, m, `03/${String(m % 100).padStart(2, '0')}/${Math.floor(m / 100)}`, c[0], c[1], Math.round(need * 0.4), 'Đơn mẫu']);
        if (m >= 202609 && m <= addM(T, (r() < 0.6 ? 0 : 1))) dk.push([n, m, '', c[0], c[1], sc === 'dead' ? 0 : need, '']);
      }
    });
  });
  return { cm, npps, cat, dt, tt, dk, T, lead: 3, logs: [], acl: [{ who: 'Minh Trang', npps: 'NPP MẪU BẮC', role: 'view', note: 'mẫu' }],
    me: opt.me || { pic: 'Giang', local: 'mmh.product', level: 'admin', admin: true }, day: opt.day || 8, rids: {} };
}

/* như máy chủ v1.1: mảng phẳng [iNPP, iMã, tháng − m0, SL] cộng theo NPP + tháng + mã */
function pack(st, sheet, allow, m0, codes, ix) {
  const sum = {}, out = [], base = Math.floor(m0 / 100) * 12 + (m0 % 100 - 1);
  st[sheet].forEach(r => { const k = allow.indexOf(r[0]); if (k < 0 || r[1] < m0) return;
    let ci = ix[String(r[3]).toUpperCase()]; if (ci === undefined) { ci = ix[String(r[3]).toUpperCase()] = codes.length; codes.push([r[3], r[4] || '', 'Khác', 0]); }
    const mo = Math.floor(r[1] / 100) * 12 + (r[1] % 100 - 1) - base, kk = k + '|' + ci + '|' + mo;
    if (kk in sum) out[sum[kk] + 3] += r[5]; else { sum[kk] = out.length; out.push(k, ci, mo, r[5]); } });
  return out;
}
function boot(st) {
  const fromDT = addM(st.cm, st.lead - (st.day <= 5 ? 1 : 0));
  const allow = st.me.admin ? st.npps : st.npps.filter(n => (st.acl.find(a => a.who === st.me.pic) || { npps: '' }).npps.split(/,\s*/).includes(n));
  if (!allow.length) return { ok: false, code: 'NOACCESS', error: 'Tài khoản chưa được cấp quyền xem dự trù NPP. Liên hệ Admin.' };
  return { ok: true, v: '1.0 · mock', me: st.me, access: { all: allow.length === st.npps.length, edit: !!st.me.admin || !!st.edit, admin: !!st.me.admin }, npps: allow,
    at: '08/11/2026 09:00', today: '2026-11-08',
    set: { cm: st.cm, lead: st.lead, T: addM(st.cm, st.lead), fromDT, day: st.day, hanDay: 5, watch: 0.1, high: 0.2, tbN: 6 },
    head: { dt: ['Nhà phân phối', 'Tháng', 'Tháng gửi', 'Mã hàng', 'Tên hàng', 'Số lượng', 'Ghi chú'], tt: ['Nhà phân phối', 'Tháng', 'Ngày đặt', 'Mã hàng', 'Tên hàng', 'Số lượng', 'Ghi chú'],
      dk: ['Nhà phân phối', 'Tháng', 'Cập nhật', 'Mã hàng', 'Tên hàng', 'Số lượng', 'Ghi chú'] },
    ...(() => { const codes = st.cat.slice(), ix = {}; codes.forEach((c, i) => { ix[String(c[0]).toUpperCase()] = i; });
      const m0 = 202509, o = { fmt: 2, m0, dt: pack(st, 'dt', allow, m0, codes, ix), dk: pack(st, 'dk', allow, m0, codes, ix), tt: pack(st, 'tt', allow, m0, codes, ix) };
      o.cat = { list: codes, nCat: st.cat.length, head: ['Mã hàng', 'Tên hàng', 'Nhóm hàng', 'Đơn giá'], price: 'Đơn giá' }; return o; })(),
    files: {}, sheetUrl: '' };
}
function save(st, p) {
  if (p.rid && st.rids[p.rid]) return st.rids[p.rid];
  const res = { ok: true, n: { dt: 0, dk: 0, tt: 0 }, skipped: [], added: [] };
  (p.ops || []).forEach(o => {
    if (o.s === 'tt') {
      if (o.op === 'del') { const i = o.row - 2, r = st.tt[i]; if (r && r[0] === o.npp && r[3] === o.code) { st.tt.splice(i, 1); res.n.tt++; } else res.skipped.push('tt dòng đổi'); return; }
      st.tt.push([o.npp, o.m, o.day || '', o.code, '', o.q, o.note || '']); res.n.tt++; return;
    }
    const arr = st[o.s];
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i][0] === o.npp && arr[i][1] === o.m && String(arr[i][3]).toUpperCase() === String(o.code).toUpperCase()) arr.splice(i, 1);
    if (o.q !== null && o.q !== undefined && !(o.s === 'dt' && o.q === 0)) arr.push([o.npp, o.m, '', o.code, '', o.q, 'App']);
    res.n[o.s]++;
  });
  st.saves = (st.saves || 0) + 1;
  if (p.rid) st.rids[p.rid] = res;
  return res;
}
/* gắn vào page Playwright */
async function attach(page, st) {
  await page.route(/script\.google\.com/, async route => {
    const req = route.request(), u = new URL(req.url());
    let p = Object.fromEntries(u.searchParams);
    if (req.method() === 'POST') { try { Object.assign(p, JSON.parse(req.postData() || '{}')); } catch (e) {} }
    let out;
    if (p.action === 'dtBoot') out = boot(st);
    else if (p.action === 'dtSave') out = save(st, p);
    else if (p.action === 'dtLines') { st.linesCalls = (st.linesCalls || 0) + 1; out = { ok: true, npp: p.npp, m: +p.m, lines: st.tt.map((r, i) => [i + 2, r[3], r[5], r[2], r[6]]).filter((x, i) => st.tt[i][0] === p.npp && st.tt[i][1] === +p.m) }; }
    else if (p.action === 'dtLog') { st.logs.push(p); out = { ok: true }; }
    else if (p.action === 'dtAccess') out = { ok: true, rows: st.acl.map((a, i) => ({ row: i + 2, ...a })), people: [{ pic: 'Minh Trang' }, { pic: 'Thuong' }, { pic: 'Viet' }], npps: st.npps };
    else if (p.action === 'dtAccessSave') { st.acl = p.rows; out = { ok: true, rows: st.acl, people: [{ pic: 'Minh Trang' }], npps: st.npps }; }
    else if (p.action === 'rhAuthStart') out = { ok: true };
    else if (p.action === 'rhAuthVerify') out = p.code === '123456' ? { ok: true, token: 'tok.mock', exp: Date.now() + 864e5, user: { pic: 'Giang', email: 'mmh.product@manimedicalhanoi.com' } } : { ok: false, error: 'Mã chưa đúng.' };
    else out = { ok: true };
    const body = p.callback ? `${p.callback}(${JSON.stringify(out)})` : JSON.stringify(out);
    await route.fulfill({ status: 200, contentType: p.callback ? 'application/javascript' : 'application/json', body, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
}
const API = 'https://script.google.com/macros/s/MOCK_DUTRU/exec';
async function newPage(browser, st, opt = {}) {
  const ctx = await browser.newContext({ viewport: opt.viewport || { width: 1440, height: 900 }, deviceScaleFactor: opt.dpr || 1, acceptDownloads: true, locale: 'vi-VN' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.addInitScript(([api, login]) => {
    window.DT_API = api;
    if (!login || login === 'guide') {} else localStorage.setItem('dt_guide_v1', '1');
    if (login) localStorage.setItem('mmh_tk', JSON.stringify({ tk: 'tok.mock', exp: Date.now() + 864e5, user: { pic: 'Giang', email: 'mmh.product@manimedicalhanoi.com' } }));
  }, [API, opt.guide ? 'guide' : opt.login !== false]);
  await attach(page, st);
  return page;
}
module.exports = { makeState, attach, newPage, addM, API };
