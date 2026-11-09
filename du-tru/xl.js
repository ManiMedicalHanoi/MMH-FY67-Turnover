/* Dự trù NPP — file Excel cho từng NPP (ExcelJS, chạy trên máy, không qua máy chủ) · v1.2 · 09/11/2026
   Xuất (v1.2, người dùng: file cũ màu mè, khó hiểu, bỏ sheet hướng dẫn): mỗi NPP 1 file, chỉ số của NPP đó, 2 sheet:
     DỰ TRÙ <T> — 1 dòng cách làm + tiêu đề cột theo bước ① đặt hàng dự kiến (nhập) ② đề xuất (công thức) ③ dự trù (nhập) + Kiểm tra;
       chỉ 2 màu (vàng = ô nhập, xám = tiêu đề), sheet khoá không mật khẩu — chỉ ô vàng nhập được.
     TÌNH HÌNH ĐẾN <T−1> — từng mã: dự trù đã gửi / đặt hàng / dự trù tích lũy / mức / gợi ý.
     DATA + _MMH (ẩn): số tham chiếu + bản đồ cột để nhập lại.
   Nhập: file app xuất (ký hiệu MMH_DUTRU_APP_V1 ở sheet ẩn _MMH) hoặc file Excel cũ của menu Sheet (MMH_DUTRU_NPP_V1)
     ⇒ xem trước thay đổi + cảnh báo ⇒ ghi vào file gốc qua hàng đợi của app (dtSave). */
(function(){
"use strict";
var SIG="MMH_DUTRU_APP_V1", SIG_OLD="MMH_DUTRU_NPP_V1", NBLANK=60, HR1=7, HR2=8;
var NAVY="FF003047", INK="FF1A2433", HEAD="FFF2F4F7", IN="FFFFF7D6", INH="FFFCEBB0", LINE="FFD0D5DD", MUT="FF667085";
var A;   // api của app.js

function font(sz,b,col){ return { name:"Aptos", size:sz||10, bold:!!b, color:{argb:col||"FF1A2433"} }; }
function fill(c){ return { type:"pattern", pattern:"solid", fgColor:{argb:c} }; }
var BORDER={ top:{style:"thin",color:{argb:LINE}}, left:{style:"thin",color:{argb:LINE}}, bottom:{style:"thin",color:{argb:LINE}}, right:{style:"thin",color:{argb:LINE}} };
function colL(n){ var s=""; while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }
function lvName(x){ return x.dead ? A.LV.dead[0] : A.LV[x.lv][0]; }
function safe(s){ return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }
function hanOf(T){ var st=A.D.set, m=A.addM(T,1-st.lead); return String(st.hanDay).padStart(2,"0")+"/"+A.lbl(m); }

/* ═════════ XUẤT ═════════ */
function build(ni, T, han){
  var keepT=A.S.T, keepD=A.S.draft; A.S.T=T; A.S.draft={};
  try{ return build0(ni,T,han); } finally { A.S.T=keepT; A.S.draft=keepD; }
}
function build0(ni, T, han){
  var D=A.D, st=D.set, o=A.I.n[ni], npp=D.npps[ni], cm=st.cm, mids=A.range(cm, A.addM(T,-1)), Tm1=A.addM(T,-1), prev=A.addM(cm,-1);
  var wb=new ExcelJS.Workbook(); wb.creator="MMH · App Dự trù NPP"; wb.created=new Date();
  var shName="DỰ TRÙ "+A.lbl(T).replace("/","-"), sName="TÌNH HÌNH ĐẾN "+A.lbl(Tm1).replace("/","-");
  var ws=wb.addWorksheet(shName,{views:[{state:"frozen", xSplit:2, ySplit:HR2, showGridLines:false}], pageSetup:{orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:0, paperSize:9}});
  var shS=wb.addWorksheet(sName,{views:[{state:"frozen", xSplit:2, ySplit:4, showGridLines:false}], pageSetup:{orientation:"landscape", fitToPage:true, fitToWidth:1, fitToHeight:0, paperSize:9}});
  var shD=wb.addWorksheet("DATA",{state:"veryHidden"});
  var shX=wb.addWorksheet("_MMH",{state:"veryHidden"});

  /* mã: đang hoạt động (điền sẵn, xếp theo nhóm) + mọi mã danh mục (để NPP thêm) */
  var act=A.activeCodes(o, T).filter(function(c){ return A.CAT[c]; });
  var allC=Object.keys(A.CAT).filter(function(c){ return !A.CAT[c].extra || o.codes[c]; });
  var info={};
  allC.forEach(function(c){ var r=A.planCalc(o,c), x0=A.calc(o,c,prev); info[c]={ r:r, x0:x0, x:A.calc(o,c,Tm1), lv:lvName(x0) }; });
  act.sort(function(a,b){ var ga=A.CAT[a].group, gb=A.CAT[b].group; return ga.localeCompare(gb,"vi") || a.localeCompare(b); });

  /* DATA (ẩn): mã | tên | nhóm | TB | mức | tích lũy hết cm−1 | dự trù đã gửi từng tháng giữa | đã đặt tháng cm */
  var dHead=["code","name","group","avg","lv","p0"].concat(mids.map(function(m){ return "dt"+m; })).concat(["tt"]);
  shD.addRow(dHead);
  allC.forEach(function(c){ var it=A.CAT[c], f=info[c];
    shD.addRow([it.code, it.name, it.group, Math.round(f.x0.avg), f.lv, f.r.p0].concat(mids.map(function(m){ return A.g(o,"dt",c,m); })).concat([A.g(o,"tt",c,cm)])); });
  shD.getColumn(1).numFmt="@";
  var dN=allC.length+1, DR="DATA!$A$2:$"+colL(dHead.length)+"$"+dN, DCOL={}; dHead.forEach(function(h,i){ DCOL[h]=i+1; });
  wb.definedNames.add("DATA!$A$2:$A$"+dN, "DS_MA");

  /* cột của sheet nhập */
  var cols=[], c0=1, grp=[];
  function col(head, w, kind, g){ cols.push({head:head, w:w, kind:kind||"", n:c0, g:g}); return c0++; }
  var cCode=col("Mã hàng",14,"code","Sản phẩm"), cName=col("Tên hàng",32,"lk","Sản phẩm"), cGrp=col("Nhóm",13,"lk","Sản phẩm");
  var cAvg=col("Đặt TB / tháng\n(6 tháng)",11,"lk","Tham khảo"), cP0=col("Dự trù tích lũy\nđến hết "+A.lbl(prev),13,"lk","Tham khảo");
  var dk={};
  mids.concat([T]).forEach(function(m){ dk[m]=col(A.lbl(m)+(m===cm?"\n(cả tháng)":""),11,"in","① ĐẶT HÀNG DỰ KIẾN (nhập)"); });
  var cPT=col("Dự trù tích lũy\ndự kiến đến hết "+A.lbl(Tm1),14,"f","Kết quả tính"), cSG=col("② ĐỀ XUẤT\ndự trù "+A.lbl(T),13,"sg","Kết quả tính");
  var cDTT=col("③ DỰ TRÙ\n"+A.lbl(T)+" (nhập)",13,"in","③ DỰ TRÙ (nhập)"), cCK=col("Kiểm tra",30,"ck","Kiểm tra");
  var lastC=c0-1;
  /* cột phụ (ẩn): dự trù đã gửi từng tháng giữa, đã đặt tháng này, mức */
  var hDT={}; mids.forEach(function(m){ hDT[m]=c0++; }); var hTT=c0++, hLV=c0++;

  /* đầu trang */
  var r1=ws.getRow(1); r1.getCell(1).value="DỰ TRÙ THÁNG "+A.lbl(T)+" · "+npp; r1.getCell(1).font=font(15,true,NAVY); r1.height=24;
  ws.getCell(2,1).value="Hạn gửi MMH: "+han+"   ·   Đơn đặt hàng thực tế cập nhật đến tháng "+(o.lastAct?A.lbl(o.lastAct):"—")+"   ·   Kỳ tính từ tháng 09";
  ws.getCell(2,1).font=font(10,false,MUT);
  ws.getCell(3,1).value={ richText:[
    {font:font(10.5,true,INK), text:"Cách làm:  "},
    {font:font(10.5,false,INK), text:"① sửa ĐẶT HÀNG DỰ KIẾN (nhu cầu thật từng tháng)   →   ② xem ĐỀ XUẤT (tự tính)   →   ③ nhập DỰ TRÙ "+A.lbl(T)+".   "},
    {font:font(10.5,true,INK), text:"Chỉ nhập ô vàng."},
    {font:font(10.5,false,INK), text:" Thêm mã: chọn mã ▼ ở ô vàng trống cột A cuối bảng."}]};
  ws.getCell(4,1).value="Dự trù tích lũy = phần đã dự trù nhưng chưa đặt hàng, cộng dồn. Đề xuất = đặt hàng dự kiến "+A.lbl(T)+" − dự trù tích lũy dự kiến đến hết "+A.lbl(Tm1)+" (không âm).";
  ws.getCell(4,1).font=font(10,false,MUT);
  /* tiêu đề 2 tầng */
  var g1=ws.getRow(HR1), g2=ws.getRow(HR2), i0=0, vert={};
  while(i0<cols.length){ var k=cols[i0], j0=i0; while(j0+1<cols.length && cols[j0+1].g===k.g) j0++;
    if(j0===i0){ vert[k.n]=1; ws.mergeCells(HR1,k.n,HR2,k.n); }          /* cột lẻ: gộp 2 tầng tiêu đề */
    else ws.mergeCells(HR1,cols[i0].n,HR1,cols[j0].n);
    var gc=g1.getCell(k.n); gc.value=j0===i0?k.head:k.g; gc.font=font(10,true,NAVY); gc.alignment={horizontal:"center", vertical:"middle", wrapText:true};
    for(var q=i0;q<=j0;q++){ var x=g1.getCell(cols[q].n); x.fill=fill(cols[q].kind==="in"?INH:HEAD); x.border=BORDER; }
    i0=j0+1; }
  cols.forEach(function(k){ ws.getColumn(k.n).width=k.w; if(vert[k.n]) return; var cl=g2.getCell(k.n); cl.value=k.head; cl.font=font(10,true,NAVY); cl.fill=fill(k.kind==="in"?INH:HEAD);
    cl.alignment={wrapText:true, vertical:"middle", horizontal:k.n<=cGrp?"left":"center"}; cl.border=BORDER; });
  g1.height=20; g2.height=44;
  [hTT,hLV].concat(mids.map(function(m){ return hDT[m]; })).forEach(function(n){ ws.getColumn(n).hidden=true; });

  /* dòng mã */
  var NR=act.length+NBLANK, R1=HR2+1, RN=R1+NR-1;
  function lk(r, key){ return 'IF($A'+r+'="","",IFERROR(VLOOKUP($A'+r+','+DR+','+DCOL[key]+',FALSE),""))'; }
  function nlk(r, key){ return 'N(IFERROR(VLOOKUP($A'+r+','+DR+','+DCOL[key]+',FALSE),0))'; }
  for(var i=0;i<NR;i++){
    var r=R1+i, c=act[i], f=c?info[c]:null, row=ws.getRow(r);
    var a=function(n){ return colL(n)+r; };
    var setF=function(n, fml, res){ row.getCell(n).value= c&&res!==undefined&&res!==null ? {formula:fml, result:res} : {formula:fml}; };
    row.getCell(cCode).value=c?A.CAT[c].code:null; row.getCell(cCode).numFmt="@";
    setF(cName, lk(r,"name"), c&&A.CAT[c].name); setF(cGrp, lk(r,"group"), c&&A.CAT[c].group);
    setF(cAvg, lk(r,"avg"), f&&Math.round(f.x0.avg)); setF(cP0, lk(r,"p0"), f&&f.r.p0);
    mids.forEach(function(m){ setF(hDT[m], nlk(r,"dt"+m), c?A.g(o,"dt",c,m):undefined); row.getCell(dk[m]).value=c&&A.has(o,"dk",c,m)?A.g(o,"dk",c,m):null; });
    setF(hTT, nlk(r,"tt"), c?A.g(o,"tt",c,cm):undefined); setF(hLV, lk(r,"lv"), f&&f.lv);
    row.getCell(dk[T]).value=c&&A.has(o,"dk",c,T)?A.g(o,"dk",c,T):null;
    row.getCell(cDTT).value=c&&A.has(o,"dt",c,T)&&A.g(o,"dt",c,T)?A.g(o,"dt",c,T):null;
    /* dự trù tích lũy: p = MAX(0, p + dự trù − đặt hàng) qua từng tháng giữa; tháng 09 về 0; tháng này = MAX(đã đặt, dự kiến) */
    var p=(cm%100===9)?"0":"N("+a(cP0)+")";
    mids.forEach(function(m){ var dh=m===cm?"MAX("+a(hTT)+",N("+a(dk[m])+"))":"N("+a(dk[m])+")"; p="MAX(0,"+(m%100===9?"0":p)+"+"+a(hDT[m])+"-"+dh+")"; });
    var pT=(T%100===9)?"0":a(cPT);
    setF(cPT, 'IF($A'+r+'="","",'+p+')', f?f.r.pT1:undefined);
    setF(cSG, 'IF(OR($A'+r+'="",'+a(dk[T])+'=""),"",MAX(0,'+a(dk[T])+'-'+pT+'))', f&&f.r.dx!==null?f.r.dx:undefined);
    row.getCell(cCK).value={ formula:'IF($A'+r+'="",IF('+a(cDTT)+'="","","Chưa chọn mã"),IF(ISNA(MATCH($A'+r+',DS_MA,0)),"Mã không có trong danh mục",'+
      'IF(COUNTIF($A$'+R1+':$A$'+RN+',$A'+r+')>1,"Mã bị chọn 2 lần",'+
      'IF(AND(ISNUMBER('+a(cDTT)+'),ISNUMBER('+a(cSG)+'),N('+a(cDTT)+')>N('+a(cSG)+')),"Cao hơn đề xuất "&('+a(cDTT)+'-'+a(cSG)+'),'+
      'IF(AND(N('+a(cDTT)+')>0,OR('+a(hLV)+'="'+A.LV.high[0]+'",'+a(hLV)+'="'+A.LV.dead[0]+'")),"Mã đang "&LOWER('+a(hLV)+'),"")))))' };
    cols.forEach(function(k){ var cl=row.getCell(k.n); cl.border=BORDER; cl.font=font(10, k.kind==="sg"||k.kind==="code", k.kind==="ck"?"FFB42318":(k.kind==="sg"?NAVY:undefined));
      if(k.kind==="in"){ cl.fill=fill(IN); cl.protection={locked:false}; }
      if(k.n>=cAvg && k.kind!=="ck") cl.numFmt=k.kind==="in"?"#,##0":"#,##0;-#,##0;\"–\"";
      if(k.kind==="ck") cl.alignment={vertical:"middle", wrapText:false};
      if(k.n===cName) cl.alignment={vertical:"middle", wrapText:false}; });
    if(!c){ row.getCell(cCode).fill=fill(IN); row.getCell(cCode).protection={locked:false};
      row.getCell(cCode).dataValidation={ type:"list", allowBlank:true, formulae:["DS_MA"], showErrorMessage:true, errorTitle:"Mã hàng", error:"Chọn mã trong danh sách ▼" }; }
    [dk[T],cDTT].concat(mids.map(function(m){ return dk[m]; })).forEach(function(n){ row.getCell(n).dataValidation={ type:"whole", operator:"greaterThanOrEqual", allowBlank:true, formulae:[0], showErrorMessage:true, errorTitle:"Số lượng", error:"Nhập số nguyên ≥ 0" }; });
  }
  var L=function(n){ return colL(n)+R1+":"+colL(n)+RN; };
  ws.getCell(5,1).value={ formula:'"Đã nhập dự trù: "&COUNT('+L(cDTT)+')&" mã · tổng "&SUM('+L(cDTT)+')&"   ·   cao hơn đề xuất: "&SUMPRODUCT(--(ISNUMBER('+L(cDTT)+')),--(ISNUMBER('+L(cSG)+')),--('+L(cDTT)+'>'+L(cSG)+'))&" mã"' };
  ws.getCell(5,1).font=font(10.5,true,NAVY);
  ws.autoFilter={ from:{row:HR2,column:1}, to:{row:RN,column:lastC} };

  /* TÌNH HÌNH đến hết T−1 */
  var hs=["Mã hàng","Tên hàng","Nhóm","Dự trù đã gửi","Đặt hàng thực tế","Đặt hàng dự kiến","Dự trù tích lũy","% tích lũy","Mức","Gợi ý"];
  shS.getCell(1,1).value="TÌNH HÌNH DỰ TRÙ ĐẾN HẾT "+A.lbl(Tm1)+" · "+npp; shS.getCell(1,1).font=font(15,true,NAVY); shS.getRow(1).height=24;
  shS.getCell(2,1).value="Từ "+A.lbl(A.fy0(Tm1))+". Tháng đã có đơn tính theo đơn thực tế, tháng chưa có đơn tính theo đặt hàng dự kiến. Dự trù tích lũy = đã dự trù nhưng chưa đặt hàng, cộng dồn.";
  shS.getCell(2,1).font=font(10,false,MUT);
  hs.forEach(function(h,i){ var cl=shS.getCell(4,i+1); cl.value=h; cl.font=font(10,true,NAVY); cl.fill=fill(HEAD); cl.border=BORDER; cl.alignment={wrapText:true, vertical:"middle", horizontal:i<3?"left":"center"}; });
  shS.getRow(4).height=30;
  act.slice().sort(function(a2,b2){ return info[b2].x.p-info[a2].x.p; }).forEach(function(c, i){
    var x=info[c].x, it=A.CAT[c], lv=lvName(x), row=shS.getRow(5+i), act2=x.dead?"Trao đổi với MMH trước khi dự trù thêm":x.lv==="high"?"Đặt hết phần tích lũy, giảm dự trù":x.lv==="watch"?"Cân nhắc giảm dự trù":x.lv==="none"?"Nên gửi dự trù":"";
    [it.code, it.name, it.group, x.sdt, x.stt, x.sdk, x.p, x.sdt?x.p/x.sdt:null, lv, act2].forEach(function(v,j){
      var cl=row.getCell(j+1); cl.value=v===0?null:v; cl.border=BORDER; cl.font=font(10, j===0||j===6, (j===8||j===9)&&(x.lv==="high"||x.dead)?"FFB42318":undefined);
      if(j>=3&&j<=6) cl.numFmt="#,##0"; if(j===7) cl.numFmt="0%"; });
  });
  [13,32,13,13,13,13,13,10,18,34].forEach(function(w,i){ shS.getColumn(i+1).width=w; });
  shS.autoFilter={ from:{row:4,column:1}, to:{row:4+Math.max(1,act.length),column:hs.length} };

  /* _MMH: nhận diện khi nhập lại */
  var meta=[["Ký hiệu",SIG],["Nhà phân phối",npp],["Tháng dự trù",T],["Tháng gửi",cm],["Tạo lúc",new Date().toLocaleString("vi-VN")],["Người tạo",(A.D.me&&A.D.me.pic)||""],
    ["Bản đồ cột",JSON.stringify({sheet:shName, first:R1, code:cCode, dk:Object.keys(dk).reduce(function(a2,m){ a2[m]=dk[m]; return a2; },{}), dt:cDTT, v:2})]];
  meta.forEach(function(kv,i){ shX.getCell(i+1,1).value=kv[0]; shX.getCell(i+1,2).value=kv[1]; });
  wb.views=[{activeTab:0}];
  /* khoá sheet (không mật khẩu): chỉ ô vàng nhập được; vẫn lọc / đổi độ rộng cột được */
  return Promise.all([
    ws.protect("", { selectLockedCells:true, selectUnlockedCells:true, formatColumns:true, formatRows:true, autoFilter:true, sort:false }),
    shS.protect("", { selectLockedCells:true, selectUnlockedCells:true, formatColumns:true, formatRows:true, autoFilter:true, sort:true })
  ]).then(function(){ return wb; });
}
function download(wb, name){
  return wb.xlsx.writeBuffer().then(function(buf){
    var blob=new Blob([buf],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}), u=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=u; a.download=name; document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); }, 2000);
    return blob.size;
  });
}
function fname(npp,T){ var d=new Date(); return d.getFullYear()+String(d.getMonth()+1).padStart(2,"0")+String(d.getDate()).padStart(2,"0")+"_MMH_DuTru_"+T+"_"+safe(npp)+".xlsx"; }

/* ═════════ NHẬP ═════════ */
function cv(cell){ var v=cell&&cell.value; if(v==null) return null; if(typeof v==="object"){ if(v.richText) return v.richText.map(function(t){ return t.text; }).join(""); if("result" in v) return v.result; if(v.text) return v.text; if(v instanceof Date) return v; return null; } return v; }
function numOf(v){ if(v==null||v==="") return null; if(typeof v==="number") return v; var s=String(v).trim().replace(/\s/g,""); if(s==="") return null;
  if(/^-?\d{1,3}([.,]\d{3})+$/.test(s)) return +s.replace(/[.,]/g,""); if(/^-?\d+([.,]\d+)?$/.test(s)) return +s.replace(",","."); return NaN; }
function ymOf(v){ var s=String(v==null?"":v).trim(), m=s.match(/^(\d{4})(\d{2})$/); if(m) return +s; m=s.match(/^(\d{1,2})\/(\d{4})$/); if(m) return +m[2]*100+ +m[1]; return null; }
function parse(file){
  return file.arrayBuffer().then(function(buf){ var wb=new ExcelJS.Workbook(); return wb.xlsx.load(buf).then(function(){ return wb; }); }).then(function(wb){
    var R={ name:file.name, errors:[], warnings:[], infos:[], rows:[] }, D=A.D;
    var meta=null, old=null;
    wb.worksheets.forEach(function(ws){
      if(String(cv(ws.getCell("A1"))||"").trim()==="Ký hiệu"){ var s=String(cv(ws.getCell("B1"))||"").trim(); if(s===SIG) meta=ws; else if(s===SIG_OLD) old=ws; }
    });
    if(!meta && !old) throw new Error("File không phải file dự trù do MMH xuất (không thấy dữ liệu nhận diện).");
    var kv={}, ms=meta||old; for(var r=1;r<=12;r++){ var k=String(cv(ms.getCell(r,1))||"").trim(); if(k) kv[k]=cv(ms.getCell(r,2)); }
    R.npp=String(kv["Nhà phân phối"]||"").trim(); R.T=ymOf(kv["Tháng dự trù"]); R.cm=ymOf(kv["Tháng gửi"]); R.kind=meta?"app":"old";
    if(!R.npp||!R.T) throw new Error("File thiếu tên nhà phân phối hoặc tháng dự trù.");
    R.ni=-1; D.npps.forEach(function(n,i){ if(A.K(n)===A.K(R.npp)) R.ni=i; });
    if(R.ni<0) throw new Error("NPP \""+R.npp+"\" trong file không có trong danh sách bạn được xem / sửa.");
    var lines={};   // mã ⇒ {dk:{m:q}, dt:q, rows:[]}
    function put(code, s, m, q, rowNo){
      var c=A.K(code); if(!c) return;
      if(!A.CAT[c] || A.CAT[c].extra){ if(q!==null) R.errors.push("Dòng "+rowNo+": mã \""+code+"\" không có trong danh mục."); return; }
      var L=lines[c]=lines[c]||{dk:{}, dt:null, rows:[]}; if(L.rows.indexOf(rowNo)<0) L.rows.push(rowNo);
      if(q===null) return;
      if(typeof q!=="number"||isNaN(q)){ R.errors.push("Dòng "+rowNo+": mã "+A.CAT[c].code+": số lượng không phải là số."); return; }
      if(q<0||q%1){ R.errors.push("Dòng "+rowNo+": mã "+A.CAT[c].code+": số lượng phải là số nguyên ≥ 0."); return; }
      if(s==="dt"){ if(L.dt!==null){ R.warnings.push("Mã "+A.CAT[c].code+" có ở nhiều dòng — số dự trù được cộng dồn."); L.dt+=q; } else L.dt=q; }
      else { if(L.dk[m]!==undefined){ R.warnings.push("Mã "+A.CAT[c].code+" có ở nhiều dòng — dự kiến "+A.lbl(m)+" được cộng dồn."); L.dk[m]+=q; } else L.dk[m]=q; }
    }
    if(meta){
      var map; try{ map=JSON.parse(kv["Bản đồ cột"]); }catch(e){ throw new Error("File thiếu bản đồ cột — có thể đã bị sửa cấu trúc."); }
      var ws=wb.getWorksheet(map.sheet)||wb.worksheets.filter(function(w){ return /^(LÊN )?DỰ TRÙ/.test(w.name); })[0];
      if(!ws) throw new Error("Không thấy sheet LÊN DỰ TRÙ.");
      for(var rr=map.first; rr<=ws.rowCount; rr++){
        var code=cv(ws.getCell(rr,map.code)); code=code==null?"":String(code).split(" · ")[0].trim();
        var any=false;
        Object.keys(map.dk).forEach(function(m){ var q=numOf(cv(ws.getCell(rr,map.dk[m]))); if(q!==null){ any=true; if(code) put(code,"dk",+m,q,rr); } });
        var qd=numOf(cv(ws.getCell(rr,map.dt))); if(qd!==null){ any=true; if(code) put(code,"dt",0,qd,rr); }
        if(!code && any) R.warnings.push("Dòng "+rr+": có số nhưng chưa chọn mã — bỏ qua.");
        else if(code && !any) put(code,"dt",0,null,rr);
      }
    } else {
      var inp=null, hr=0, cc=0, cq=0;
      wb.worksheets.forEach(function(w){ if(inp||w===old) return; w.eachRow(function(row,rn){ if(inp) return; row.eachCell(function(cell,cn){ if(inp) return;
        if(/^Mã hàng( \(chọn trong danh sách\))?$/.test(String(cv(cell)||"").trim())){ for(var c2=cn+1;c2<=cn+30;c2++){ if(/^(SỐ )?DỰ TRÙ .*\(nhập\)/.test(String(cv(row.getCell(c2))||"").trim())){ inp=w; hr=rn; cc=cn; cq=c2; return; } } } }); }); });
      if(!inp) throw new Error("Không tìm thấy bảng nhập (cột \"Mã hàng\" và \"SỐ DỰ TRÙ\").");
      for(var r2=hr+1;r2<=inp.rowCount;r2++){ var lb=String(cv(inp.getCell(r2,cc))||"").trim(), q2=numOf(cv(inp.getCell(r2,cq)));
        if(!lb && q2===null) continue; if(!lb){ R.warnings.push("Dòng "+r2+": có số nhưng chưa chọn mã — bỏ qua."); continue; } put(lb.split(" · ")[0].trim(),"dt",0,q2,r2); }
      R.infos.push("File Excel mẫu cũ (menu trên Sheet): chỉ có số dự trù, không có đặt hàng dự kiến.");
    }
    R.lines=lines; return diff(R);
  });
}
/* so với file gốc ⇒ thay đổi + cảnh báo. Dự trù tháng T: thay TOÀN BỘ dự trù T của NPP bằng số trong file (mã để trống / 0 ⇒ bỏ). Dự kiến: chỉ ô có số. */
function diff(R){
  var D=A.D, st=D.set, o=A.I.n[R.ni], T=R.T, ops=[], ch=[], admin=D.access&&D.access.admin;
  if(T<st.fromDT && !admin) R.errors.push("File dự trù cho tháng "+A.lbl(T)+" — tháng này đã chốt (đang nhận dự trù từ "+A.lbl(st.fromDT)+"). Liên hệ Admin nếu cần sửa.");
  if(R.cm && R.cm<st.cm) R.warnings.push("File được xuất tháng "+A.lbl(R.cm)+" (cũ hơn tháng hiện tại "+A.lbl(st.cm)+") — số dự kiến các tháng đã qua bị bỏ qua.");
  var dr={};
  Object.keys(R.lines).forEach(function(c){ var L=R.lines[c];
    Object.keys(L.dk).forEach(function(m){ m=+m; if(m<st.cm) return; var q=L.dk[m], old=A.has(o,"dk",c,m)?A.g(o,"dk",c,m):null;
      if(q!==old){ ops.push({s:"dk", npp:D.npps[R.ni], m:m, code:A.CAT[c].code, q:q}); dr["dk|"+c+"|"+m]=q; ch.push({c:c, s:"dk", m:m, old:old, q:q}); } }); });
  var inFile={};
  Object.keys(R.lines).forEach(function(c){ var q=R.lines[c].dt; if(q) inFile[c]=q; });
  var curT={}; Object.keys(o.dt).forEach(function(c){ if(A.has(o,"dt",c,T) && A.g(o,"dt",c,T)) curT[c]=A.g(o,"dt",c,T); });
  Object.keys(inFile).forEach(function(c){ if(inFile[c]!==curT[c]){ ops.push({s:"dt", npp:D.npps[R.ni], m:T, code:A.CAT[c].code, q:inFile[c]}); dr["dt|"+c+"|"+T]=inFile[c]; ch.push({c:c, s:"dt", m:T, old:curT[c]==null?null:curT[c], q:inFile[c]}); } });
  Object.keys(curT).forEach(function(c){ if(!inFile[c]){ ops.push({s:"dt", npp:D.npps[R.ni], m:T, code:A.CAT[c].code, q:null}); dr["dt|"+c+"|"+T]=null; ch.push({c:c, s:"dt", m:T, old:curT[c], q:null, drop:true}); } });
  /* đề xuất theo dự kiến MỚI trong file */
  var keepS=A.S.T, keepD=A.S.draft; A.S.T=T; A.S.draft=dr;
  var nOver=0, nHigh=0, sum=0;
  ch.forEach(function(x){ if(x.s!=="dt"||x.q==null) return; var r=A.planCalc(o,x.c); x.dx=r.dx; x.lv=r.x; if(r.dx!==null && x.q>r.dx){ nOver++; x.over=x.q-r.dx; } if(r.x.lv==="high"||r.x.dead) { nHigh++; x.hi=true; } });
  Object.keys(inFile).forEach(function(c){ sum+=inFile[c]; });
  A.S.T=keepS; A.S.draft=keepD;
  R.ops=ops; R.ch=ch; R.nOver=nOver; R.nHigh=nHigh; R.sumT=sum; R.nT=Object.keys(inFile).length; R.nOld=Object.keys(curT).length;
  return R;
}

/* ═════════ HỘP THOẠI ═════════ */
function open(api){
  A=api; var D=A.D, st=D.set, can=D.access&&D.access.edit, cur=A.S.npp<0?0:A.S.npp;
  var tOpts=A.range(A.addM(st.fromDT,-1), A.addM(st.cm,st.lead)).filter(function(m){ return m>st.cm; });
  var m=A.modal('<h3>Excel cho nhà phân phối</h3><p class="sub">Mỗi NPP một file riêng, chỉ có số của NPP đó. NPP sửa đặt hàng dự kiến, nhập dự trù (ô vàng) rồi gửi lại; MMH nhập file vào đây, số được ghi thẳng vào file gốc.</p>'+
    '<div class="grid" style="grid-template-columns:1fr 1fr;gap:14px"><div class="card"><h3>1. Xuất file cho NPP</h3>'+
    '<div class="fld"><label>Nhà phân phối</label><div>'+D.npps.map(function(n,i){ return '<label style="margin-right:12px;white-space:nowrap"><input type="checkbox" data-xn="'+i+'"'+(i===cur?" checked":"")+'> '+A.esc(n)+'</label>'; }).join("")+'</div></div>'+
    '<div class="fld"><label>Dự trù cho tháng</label><select class="inp" id="xT">'+tOpts.map(function(t){ return '<option value="'+t+'"'+(t===A.S.T?" selected":"")+'>'+A.lbl(t)+(t<st.fromDT?" (đã chốt)":"")+'</option>'; }).join("")+'</select></div>'+
    '<div class="fld"><label>Hạn gửi MMH</label><input class="inp" id="xH" value="'+hanOf(A.S.T)+'"></div>'+
    '<button class="btn pri" id="xGo" type="button">Tải file Excel</button><div class="sm mut" id="xMsg" style="margin-top:6px"></div></div>'+
    '<div class="card"><h3>2. Nhập file NPP gửi lại</h3>'+(can?'<label class="drop" id="xDrop"><input type="file" id="xFile" accept=".xlsx" hidden>Kéo thả file .xlsx vào đây<br>hoặc <b style="color:var(--pri)">bấm để chọn file</b></label><p class="sm mut">Nhận file app này xuất và file Excel mẫu cũ (menu trên Sheet). Kiểm tra lỗi, xem trước thay đổi rồi mới ghi.</p>':'<div class="note">Tài khoản chỉ xem — không nhập được file.</div>')+'</div></div>');
  var xT=m.querySelector("#xT"); xT.onchange=function(){ m.querySelector("#xH").value=hanOf(+xT.value); };
  m.querySelector("#xGo").onclick=function(){
    var sel=[].slice.call(m.querySelectorAll("[data-xn]")).filter(function(x){ return x.checked; }).map(function(x){ return +x.dataset.xn; });
    if(!sel.length){ m.querySelector("#xMsg").textContent="Chọn ít nhất 1 NPP."; return; }
    var T=+xT.value, han=m.querySelector("#xH").value.trim(), msg=m.querySelector("#xMsg"), i=0;
    (function next(){ if(i>=sel.length){ msg.textContent="Đã tải "+sel.length+" file."; return; }
      var ni=sel[i++], npp=D.npps[ni]; msg.textContent="Đang tạo file "+npp+"…";
      setTimeout(function(){ try{ var nm=fname(npp,T);
        build(ni,T,han).then(function(wb){ return download(wb,nm); }).then(function(){ A.log("Xuất file Excel", npp, nm+" · dự trù "+A.lbl(T)+" · hạn "+han, 1); next(); }, function(e){ msg.textContent="Lỗi: "+e.message; }); }catch(e){ msg.textContent="Lỗi: "+e.message; console.error(e); } }, 30); })();
  };
  if(can){
    var drop=m.querySelector("#xDrop"), fi=m.querySelector("#xFile");
    drop.ondragover=function(e){ e.preventDefault(); drop.classList.add("on"); }; drop.ondragleave=function(){ drop.classList.remove("on"); };
    drop.ondrop=function(e){ e.preventDefault(); drop.classList.remove("on"); var f=e.dataTransfer.files[0]; if(f) go(f); };
    fi.onchange=function(){ if(fi.files[0]) go(fi.files[0]); };
  }
  function go(f){ drop.innerHTML="Đang đọc "+A.esc(f.name)+"…"; parse(f).then(preview, function(e){ drop.innerHTML='<span style="color:var(--hi)">'+A.esc(e.message)+'</span><br>Chọn file khác'; drop.appendChild(fi); console.error(e); }); }
}
function preview(R){
  var D=A.D, o=A.I.n[R.ni], bad=R.errors.length>0;
  var rows=R.ch.slice().sort(function(a,b){ return (a.s===b.s?0:a.s==="dt"?-1:1) || (b.hi?1:0)-(a.hi?1:0) || (b.over||0)-(a.over||0) || a.c.localeCompare(b.c); });
  var h='<h3>Nhập file: '+A.esc(R.name)+'</h3><p class="sub">'+A.esc(D.npps[R.ni])+' · dự trù tháng <b>'+A.lbl(R.T)+'</b>: '+R.nT+' mã, tổng <b>'+A.n0(R.sumT)+'</b> (file gốc đang có '+R.nOld+' mã) · '+R.ch.filter(function(x){ return x.s==="dk"; }).length+' ô đặt hàng dự kiến thay đổi</p>';
  if(R.errors.length) h+='<div class="note err" style="margin-bottom:8px"><b>'+R.errors.length+' lỗi — cần NPP sửa trước khi nhập:</b><br>'+R.errors.slice(0,30).map(A.esc).join("<br>")+'</div>';
  if(R.nHigh||R.nOver) h+='<div class="note wa" style="margin-bottom:8px">'+(R.nOver?R.nOver+' mã dự trù cao hơn đề xuất (phần dư thành hàng chờ). ':'')+(R.nHigh?R.nHigh+' mã đang cảnh báo Cao / không có đơn 6 tháng vẫn dự trù.':'')+'</div>';
  if(R.warnings.length) h+='<div class="note" style="margin-bottom:8px">'+R.warnings.slice(0,20).map(A.esc).join("<br>")+'</div>';
  if(R.infos.length) h+='<p class="sm mut">'+R.infos.map(A.esc).join(" ")+'</p>';
  h+='<div class="tw" style="max-height:46vh"><table class="tbl"><tr><th>Mã</th><th>Nội dung</th><th class="r">Đang có</th><th class="r">Trong file</th><th class="r">Đề xuất</th><th>Lưu ý</th></tr>'+
    rows.map(function(x){ var it=A.CAT[x.c]; return '<tr><td><b>'+A.esc(it.code)+'</b><span class="mini">'+A.esc(it.name)+'</span></td><td>'+(x.s==="dt"?"Dự trù "+A.lbl(x.m):"Dự kiến "+A.lbl(x.m))+'</td><td class="r num">'+(x.old==null?"–":A.n0(x.old))+'</td><td class="r num"><b>'+(x.q==null?'<span style="color:var(--hi)">bỏ</span>':A.n0(x.q))+'</b></td><td class="r num">'+(x.s==="dt"&&x.dx!=null?A.n0(x.dx):"")+'</td><td class="sm">'+
      (x.over?'<span style="color:var(--wa)">cao hơn đề xuất '+A.n0(x.over)+'</span> ':'')+(x.hi?A.pill(x.lv.dead?"dead":x.lv.lv):'')+(x.drop?'<span class="mut">không còn trong file</span>':'')+'</td></tr>'; }).join("")+
    (rows.length?'':'<tr><td colspan="6" class="mut">Không có gì khác so với file gốc.</td></tr>')+'</table></div>'+
    '<div class="row" style="margin-top:12px"><button class="btn" data-x="1" type="button">Đóng</button>'+(!bad&&R.ops.length?'<button class="btn pri" id="xCommit" type="button">Ghi '+R.ops.length+' thay đổi vào file gốc</button>':'')+'</div>';
  var m=A.modal(h);
  var b=m.querySelector("#xCommit");
  if(b) b.onclick=function(){ A.queue(R.ops, "Nhập file Excel "+R.name); A.log("Nhập file Excel", D.npps[R.ni], R.name+" · dự trù "+A.lbl(R.T)+": "+R.nT+" mã, tổng "+R.sumT+" · "+R.ops.length+" ô thay đổi", R.ops.length); A.closeModal(); A.toast("Đã nhận file — đang ghi "+R.ops.length+" thay đổi vào file gốc."); };
  void o;
}
window.DTXL={ open:open, build:function(api,ni,T,han){ A=api; return build(ni,T,han); }, parse:function(api,file){ A=api; return parse(file); } };
})();
