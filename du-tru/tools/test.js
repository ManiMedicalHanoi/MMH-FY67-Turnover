/* Kiểm thử app Dự trù NPP với máy chủ giả lập.
   Chạy (ở thư mục gốc repo):  python3 -m http.server 8790 &   rồi   NODE_PATH=$(npm root -g) node du-tru/tools/test.js [thư mục ảnh]
   Kiểm: đăng nhập sẵn ⇒ Tổng quan; luật tính (dự trù chưa đặt hàng, đề xuất); Lên dự trù ⇒ lưu ⇒ máy chủ nhận; xuất Excel ⇒ nhập lại ⇒ xem trước. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const M = require('./mock.js');
const URL0 = process.env.DT_URL || 'http://localhost:8790/du-tru/';
const SHOTS = process.argv[2] || '';
let fails = 0;
function ok(c, msg) { console.log((c ? '✔ ' : '✘ ') + msg); if (!c) fails++; }

(async () => {
  const b = await chromium.launch();
  const st = M.makeState();
  const page = await M.newPage(b, st, { dpr: SHOTS ? 2 : 1 });
  await page.goto(URL0);
  await page.waitForSelector('.flow .v');
  ok(await page.locator('.tab').count() >= 4, 'có các tab');
  const h2 = await page.locator('h2').first().innerText();
  ok(/đến hết 01\/2027/.test(h2), 'mặc định xem tình hình đến hết 01/2027 (tháng trước tháng đang nhận dự trù): ' + h2);
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '1_tong_quan.png'), fullPage: false });

  /* luật tính: so với tính tay trên dữ liệu thô */
  const chk = await page.evaluate(() => {
    const A = window.DT_DEBUG(), o = A.I.n[0], codes = A.activeCodes(o, 202701);
    let bad = 0, n = 0;
    codes.forEach(c => {
      let p = 0;
      for (let m = 202609; m <= 202701; m = A.addM(m, 1)) {
        const dt = A.g(o, 'dt', c, m), tt = A.g(o, 'tt', c, m), dk = A.g(o, 'dk', c, m);
        const dh = (m < A.D.set.cm && m <= o.lastAct) ? tt : Math.max(tt, dk);
        p = Math.max(0, p + dt - dh);
      }
      const x = A.calc(o, c, 202701); n++; if (x.p !== p) bad++;
      const r = A.planCalc(o, c); const dkT = A.g(o, 'dk', c, 202702);
      if (A.has(o, 'dk', c, 202702) && r.dx !== Math.max(0, dkT - p)) bad++;
    });
    return { n, bad };
  });
  ok(chk.n > 20 && chk.bad === 0, `luật tính khớp tính tay (${chk.n} mã, sai ${chk.bad})`);

  /* Mã hàng: lọc Cao */
  await page.click('[data-tab="codes"]');
  await page.waitForSelector('.pc');
  const nCards = await page.locator('.pc').count();
  ok(nCards > 10, 'thẻ mã hàng: ' + nCards);
  ok(await page.locator('.pc img').count() > 5, 'có ảnh sản phẩm');
  await page.click('[data-lv="high"]');
  const nHigh = await page.locator('.pc').count();
  ok(nHigh > 0 && nHigh < nCards, 'lọc Cao: ' + nHigh);
  if (SHOTS) { await page.click('[data-lv=""]'); await page.screenshot({ path: path.join(SHOTS, '2_ma_hang.png') }); }
  await page.locator('.pc').first().click();
  await page.waitForSelector('#drawer:not([hidden]) .tbl');
  ok(await page.locator('#drawer .hint').count() === 1, 'ngăn chi tiết mã có lời khuyên');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '3_chi_tiet.png') });
  await page.click('#drawer [data-x]');

  /* Lên dự trù: dùng đề xuất + sửa dự kiến ⇒ lưu ⇒ máy chủ nhận */
  await page.click('[data-tab="plan"]');
  await page.waitForSelector('.plan');
  const rowsPlan = await page.locator('.plan tr[data-c]').count();
  ok(rowsPlan > 10, 'bảng lên dự trù: ' + rowsPlan + ' mã');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '4_len_du_tru.png') });
  const first = page.locator('.plan tr[data-c]').first();
  const code = await first.getAttribute('data-c');
  const dkT = first.locator('.qin[data-s="dk"][data-m="202702"]');
  await dkT.fill('500'); await dkT.press('Enter');
  const sg = await first.locator('[data-k="dx"]').innerText();
  ok(/\d/.test(sg), 'đề xuất cập nhật ngay khi sửa dự kiến: ' + sg.trim());
  await page.click('#pfill');
  const nCh = await page.locator('.qin.ch').count();
  ok(nCh > 2, 'điền theo đề xuất: ' + nCh + ' ô đổi');
  const before = st.saves || 0;
  await page.click('#psave');
  await page.waitForFunction(() => !document.querySelector('#chip-q') || document.querySelector('#chip-q').hidden, null, { timeout: 15000 });
  ok((st.saves || 0) > before, 'máy chủ nhận lệnh lưu');
  ok(st.dk.some(r => r[1] === 202702 && r[3] === code && r[5] === 500 || String(r[3]).toUpperCase() === code && r[1] === 202702 && r[5] === 500), 'dự kiến 02/2027 = 500 đã ghi vào file gốc giả');
  ok(st.dt.some(r => r[1] === 202702), 'dự trù 02/2027 đã ghi');

  /* Đặt hàng thực tế: thêm 1 dòng */
  await page.click('[data-tab="orders"]');
  await page.waitForSelector('#oc');
  await page.fill('#oc', st.cat[0][0] + ' · ' + st.cat[0][1]);
  await page.fill('#oq', '12');
  await page.click('#oadd');
  await page.click('#osave');
  await page.waitForTimeout(1500);
  ok(st.tt.some(r => r[3] === st.cat[0][0] && r[5] === 12 && r[1] === 202611), 'thêm đơn thực tế 12');
  ok((st.linesCalls || 0) >= 1 && await page.locator('[data-del]').count() > 0, 'các lần đặt hàng tải riêng khi mở tab (dtLines)');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '5_dat_hang.png') });

  /* Excel: xuất ⇒ đọc lại ⇒ xem trước */
  await page.click('#b-xl');
  await page.waitForSelector('#xGo');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '6_excel.png') });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#xGo')]);
  const xf = path.join(process.env.TMPDIR || '/tmp', dl.suggestedFilename());
  await dl.saveAs(xf);
  ok(fs.statSync(xf).size > 10000, 'tải file Excel ' + dl.suggestedFilename());
  /* NPP sửa file: đổi 1 dự trù + 1 dự kiến (bằng ExcelJS trong trang) rồi nhập lại */
  const buf = fs.readFileSync(xf).toString('base64');
  const res = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bin);
    const meta = JSON.parse(wb.getWorksheet('_MMH').getCell('B7').value);
    const ws = wb.getWorksheet('LÊN DỰ TRÙ');
    ws.getCell(meta.first, meta.dt).value = 777;
    ws.getCell(meta.first + 1, meta.dk['202702']).value = 333;
    const out = await wb.xlsx.writeBuffer();
    const file = new File([out], 'tra_lai.xlsx');
    const R = await window.DTXL.parse(window.DT_DEBUG(), file);
    window.__R = R;
    return { err: R.errors, ch: R.ch.map(x => [x.s, x.m, x.q]), nOps: R.ops.length, sumT: R.sumT };
  }, buf);
  ok(res.err.length === 0, 'nhập lại không lỗi ' + JSON.stringify(res.err.slice(0, 2)));
  ok(res.ch.some(x => x[0] === 'dt' && x[2] === 777) && res.ch.some(x => x[0] === 'dk' && x[2] === 333), 'nhận ra 2 ô NPP sửa: ' + JSON.stringify(res.ch.slice(0, 4)));
  await page.keyboard.press('Escape');

  /* Tất cả NPP */
  await page.click('[data-npp="-1"]'); await page.click('[data-tab="ov"]');
  await page.waitForSelector('.nppc');
  ok(await page.locator('.nppc').count() === 3, 'tổng quan mọi NPP: 3 thẻ NPP');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, '7_tat_ca.png'), fullPage: true });

  /* Lần đầu mở: tự hiện Hướng dẫn */
  const pgd = await M.newPage(b, M.makeState(), { guide: true, dpr: SHOTS ? 2 : 1 });
  const t0 = Date.now(); await pgd.goto(URL0); await pgd.waitForSelector('.flow .v'); console.log('  (mở app với máy chủ giả: ' + (Date.now() - t0) + ' ms)');
  await pgd.waitForSelector('.guide .gsteps');
  ok(true, 'lần đầu mở ⇒ tự hiện Hướng dẫn (Ai làm gì mỗi tháng)');
  if (SHOTS) await pgd.screenshot({ path: path.join(SHOTS, '9_huong_dan.png') });
  await pgd.click('[data-g="where"]'); await pgd.waitForSelector('.gdl');
  if (SHOTS) await pgd.screenshot({ path: path.join(SHOTS, '10_nhin_vao_dau.png') });
  await pgd.click('.mbox [data-x]');
  ok(await pgd.locator('.tipbar').count() === 1, 'dòng giải thích đầu Tổng quan');
  await pgd.click('[data-tipx="ov"]'); await pgd.reload(); await pgd.waitForSelector('.flow .v');
  ok(await pgd.locator('.tipbar').count() === 0, 'bấm Ẩn ⇒ không hiện lại');

  /* Điện thoại */
  const pm = await M.newPage(b, M.makeState(), { viewport: { width: 390, height: 844 }, dpr: SHOTS ? 2 : 1 });
  await pm.goto(URL0); await pm.waitForSelector('.flow .v');
  const ow = await pm.evaluate(() => document.documentElement.scrollWidth);
  ok(ow <= 392, 'điện thoại không tràn ngang: ' + ow);
  if (SHOTS) await pm.screenshot({ path: path.join(SHOTS, '8_dien_thoai.png') });

  /* Chưa đăng nhập ⇒ màn đăng nhập; không có quyền ⇒ báo */
  const pg = await M.newPage(b, M.makeState(), { login: false });
  await pg.goto(URL0); await pg.waitForSelector('#lg-email');
  ok(true, 'chưa đăng nhập ⇒ màn đăng nhập email');
  const st2 = M.makeState({ me: { pic: 'Viet', local: 'viet', level: 'staff', admin: false } }); st2.acl = [];
  const pn = await M.newPage(b, st2); await pn.goto(URL0); await pn.waitForSelector('.gate');
  ok(/Chưa có quyền/.test(await pn.locator('.gate').innerText()), 'không có quyền ⇒ báo chưa được cấp quyền');

  await b.close();
  console.log(fails ? `\n${fails} kiểm tra lỗi` : '\nTất cả kiểm tra đạt');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
