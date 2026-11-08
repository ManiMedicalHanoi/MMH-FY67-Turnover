/* Dự trù NPP — file Excel cho từng NPP (ExcelJS, chạy trên máy, không qua máy chủ) · v1.0 · 08/11/2026
   Xuất: mỗi NPP 1 file, chỉ số của NPP đó. Sheet:
     HƯỚNG DẪN · LÊN DỰ TRÙ (nhập dự kiến các tháng + dự trù tháng T, đề xuất tự tính bằng công thức) ·
     TÌNH HÌNH (đến hết tháng T−1: dự trù / đặt hàng / chưa đặt / cảnh báo) · THEO THÁNG (từng mã từng tháng) · DATA + _MMH (ẩn)
   Nhập: file app xuất (ký hiệu MMH_DUTRU_APP_V1 ở sheet ẩn _MMH) hoặc file Excel cũ của menu Sheet (MMH_DUTRU_NPP_V1)
     ⇒ xem trước thay đổi + cảnh báo ⇒ ghi vào file gốc qua hàng đợi của app (dtSave). */
(function(){
"use strict";
var SIG="MMH_DUTRU_APP_V1", SIG_OLD="MMH_DUTRU_NPP_V1", NBLANK=60, FIRST=7;
var NAVY="FF003047", BLUE="FF3A5CAA", HEAD="FFCFE2F3", IN="FFFFF2CC", SG="FFE9F2FF", LINE="FFC9D3E0", MUT="FF667085";
var LVC={ "Cao":["FFFDECEA","FFC62828"], "Theo dõi":["FFFFF4E5","FFB45309"], "Ổn":["FFE8F5E9","FF2E7D32"], "Chưa dự trù":["FFEEF3FC","FF3A5CAA"], "Không có đơn 6 tháng":["FFF6EFE1","FF6B4E16"] };
var A;   // api của app.js

function font(sz,b,col){ return { name:"Aptos", size:sz||10, bold:!!b, color:{argb:col||"FF1A2433"} }; }
function fill(c){ return { type:"pattern", pattern:"solid", fgColor:{argb:c} }; }
var BORDER={ top:{style:"thin",color:{argb:LINE}}, left:{style:"thin",color:{argb:LINE}}, bottom:{style:"thin",color:{argb:LINE}}, right:{style:"thin",color:{argb:LINE}} };
function colL(n){ var s=""; while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); } return s; }
function lvName(x){ return x.dead ? "Không có đơn 6 tháng" : A.LV[x.lv][0]; }
function safe(s){ return String(s).normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/đ/g,"d").replace(/Đ/g,"D").replace(/[^A-Za-z0-9]+/g,"-").replace(/^-+|-+$/g,""); }
function hanOf(T){ var st=A.D.set, m=A.addM(T,1-st.lead); return String(st.hanDay).padStart(2,"0")+"/"+A.lbl(m); }

/* ═════════ XUẤT ═════════ */
function build(ni, T, han){
  var keepT=A.S.T, keepD=A.S.draft; A.S.T=T; A.S.draft={};
  try{ return build0(ni,T,han); } finally { A.S.T=keepT; A.S.draft=keepD; }
}
function build0(ni, T, han){
  var D=A.D, st=D.set, o=A.I.n[ni], npp=D.npps[ni], cm=st.cm, mids=A.range(cm, A.addM(T,-1)), Tm1=A.addM(T,-1);
  var wb=new ExcelJS.Workbook(); wb.creator="MMH · App Dự trù NPP"; wb.created=new Date();
  var shHD=wb.addWorksheet("HƯỚNG DẪN",{views:[{showGridLines:false}]});
  var shP=wb.addWorksheet("LÊN DỰ TRÙ",{properties:{tabColor:{argb:"FFFFE100"}}, views:[{state:"frozen", xSplit:2, ySplit:FIRST-1, showGridLines:false}]});
  var shS=wb.addWorksheet("TÌNH HÌNH",{views:[{state:"frozen", xSplit:2, ySplit:4, showGridLines:false}]});
  var shM=wb.addWorksheet("THEO THÁNG",{views:[{state:"frozen", xSplit:2, ySplit:5, showGridLines:false}]});
  var shD=wb.addWorksheet("DATA",{state:"veryHidden"});
  var shX=wb.addWorksheet("_MMH",{state:"veryHidden"});

  /* danh sách mã: đang hoạt động (đứng đầu, điền sẵn) + mọi mã danh mục (để NPP thêm) */
  var act=A.activeCodes(o, T).filter(function(c){ return A.CAT[c]; });
  var allC=Object.keys(A.CAT).filter(function(c){ return !A.CAT[c].extra || o.codes[c]; });
  var info={};
  allC.forEach(function(c){
    var r=A.planCalc(o,c), x=A.calc(o,c,Tm1), x0=A.calc(o,c,A.addM(cm,-1));
    info[c]={ r:r, x:x, x0:x0, lv:lvName(x0), hint:A.hintOf(x0, A.addM(cm,-1)) };
  });
  act.sort(function(a,b){ var ga=A.CAT[a].group, gb=A.CAT[b].group; return ga.localeCompare(gb,"vi") || a.localeCompare(b); });

  /* DATA: mã | tên | nhóm | TB | mức | chưa đặt hết cm−1 | dự trù từng tháng giữa | đã đặt tháng cm | lưu ý */
  var dHead=["Mã hàng","Tên hàng","Nhóm","TB đặt/tháng","Mức","Chưa đặt hết "+A.lbl(A.addM(cm,-1))].concat(mids.map(function(m){ return "Dự trù "+A.lbl(m); })).concat(["Đã đặt "+A.lbl(cm),"Lưu ý"]);
  shD.addRow(dHead);
  allC.forEach(function(c){ var it=A.CAT[c], f=info[c];
    shD.addRow([it.code, it.name, it.group, Math.round(f.x0.avg), f.lv, f.r.p0].concat(mids.map(function(m){ return A.g(o,"dt",c,m); })).concat([A.g(o,"tt",c,cm), f.hint])); });
  shD.getColumn(1).numFmt="@";
  var dN=allC.length+1, DR="DATA!$A$2:$"+colL(dHead.length)+"$"+dN, DCOL={}; dHead.forEach(function(h,i){ DCOL[h]=i+1; });
  wb.definedNames.add("DATA!$A$2:$A$"+dN, "DS_MA");

  /* LÊN DỰ TRÙ */
  var ws=shP, cols=[], dk={}, c0=1;
  function col(key, head, w, kind){ cols.push({key:key, head:head, w:w, kind:kind||"", n:c0}); return c0++; }
  var cCode=col("code","Mã hàng ▼",14,"code"), cName=col("name","Tên hàng",30,"lk"), cGrp=col("grp","Nhóm",13,"lk"), cAvg=col("avg","TB đặt / tháng\n(6 tháng)",10,"lk"),
      cLv=col("lv","Mức hiện tại",13,"lk"), cP0=col("p0","Chưa đặt hàng đến hết "+A.lbl(A.addM(cm,-1)),13,"lk");
  var cDT={}, cTT=0;
  mids.forEach(function(m){
    cDT[m]=col("dt"+m,"Dự trù "+A.lbl(m)+"\n(đã gửi)",11,"lk");
    if(m===cm) cTT=col("tt","Đã đặt "+A.lbl(m)+"\n(đến ngày xuất file)",12,"lk");
    dk[m]=col("dk"+m,"ĐẶT HÀNG DỰ KIẾN "+A.lbl(m)+"\n(nhập)",13,"in");
  });
  dk[T]=col("dk"+T,"ĐẶT HÀNG DỰ KIẾN "+A.lbl(T)+"\n(nhập)",13,"in");
  var cPT=col("pt","Dự trù chưa đặt hàng dự kiến đến hết "+A.lbl(Tm1),14,"f"), cSG=col("sg","DỰ TRÙ ĐỀ XUẤT "+A.lbl(T),13,"sg"),
      cDTT=col("dtt","SỐ DỰ TRÙ "+A.lbl(T)+"\n(nhập)",13,"in"), cAF=col("af","Còn chưa đặt hàng sau "+A.lbl(T),13,"f"),
      cCK=col("ck","Kiểm tra",34,"f"), cHint=col("hint","Lưu ý của MMH",46,"lk");
  var lastC=c0-1, HR=FIRST-1;
  ws.getCell(1,1).value="LÊN DỰ TRÙ THÁNG "+A.lbl(T)+" – "+npp; ws.getCell(1,1).font=font(16,true,NAVY);
  ws.getCell(2,1).value="Tháng gửi: "+A.lbl(cm)+"   |   Dự trù cho tháng "+A.lbl(T)+"   |   Hạn gửi MMH: "+han; ws.getCell(2,1).font=font(12,true,BLUE);
  ws.getCell(3,1).value="Đơn hàng thực tế cập nhật đến hết "+(o.lastAct?A.lbl(o.lastAct):"—")+". Bước 1: nhập ĐẶT HÀNG DỰ KIẾN (nhu cầu thật) các tháng "+A.lbl(cm)+" → "+A.lbl(T)+". Bước 2: xem DỰ TRÙ ĐỀ XUẤT (tự tính). Bước 3: nhập SỐ DỰ TRÙ "+A.lbl(T)+". Cột vàng là ô nhập.";
  ws.getCell(3,1).font=font(10,false,MUT);
  ws.getCell(4,1).value="Đề xuất = dự kiến "+A.lbl(T)+" − dự trù chưa đặt hàng dự kiến đến hết "+A.lbl(Tm1)+". Dự trù cao hơn đề xuất ⇒ phần dư thành hàng chờ chưa lấy. Thêm mã: chọn mã ▼ ở ô trống cột A cuối danh sách. Nếu bảng chưa hiện số: bấm \"Enable Editing\".";
  ws.getCell(4,1).font=font(10,false,MUT);
  cols.forEach(function(k){ var cl=ws.getCell(HR,k.n); cl.value=k.head; cl.font=font(10,true,k.kind==="in"?"FF7A5A00":NAVY);
    cl.fill=fill(k.kind==="in"?"FFFFE699":(k.kind==="sg"?"FFD6E6FF":HEAD)); cl.alignment={wrapText:true, vertical:"middle", horizontal:"center"}; cl.border=BORDER; ws.getColumn(k.n).width=k.w; });
  ws.getRow(HR).height=58;
  var NR=act.length+NBLANK, R1=FIRST, RN=FIRST+NR-1;
  function lk(r, head){ return { formula:'IF($A'+r+'="","",IFERROR(VLOOKUP($A'+r+','+DR+','+DCOL[head]+',FALSE),""))' }; }
  for(var i=0;i<NR;i++){
    var r=R1+i, c=act[i], f=c?info[c]:null, row=ws.getRow(r);
    var a=function(n){ return colL(n)+r; };
    row.getCell(cCode).value=c?A.CAT[c].code:null; row.getCell(cCode).numFmt="@";
    var fv=function(cell, head, res){ var v=lk(r,head); if(c) v.result=res; row.getCell(cell).value=v; };
    fv(cName,"Tên hàng",c&&A.CAT[c].name); fv(cGrp,"Nhóm",c&&A.CAT[c].group); fv(cAvg,"TB đặt/tháng",f&&Math.round(f.x0.avg)); fv(cLv,"Mức",f&&f.lv); fv(cP0,"Chưa đặt hết "+A.lbl(A.addM(cm,-1)),f&&f.r.p0);
    mids.forEach(function(m){ fv(cDT[m],"Dự trù "+A.lbl(m),c&&A.g(o,"dt",c,m)); if(m===cm) fv(cTT,"Đã đặt "+A.lbl(cm),c&&A.g(o,"tt",c,cm));
      row.getCell(dk[m]).value=c&&A.has(o,"dk",c,m)?A.g(o,"dk",c,m):null; });
    row.getCell(dk[T]).value=c&&A.has(o,"dk",c,T)?A.g(o,"dk",c,T):null;
    row.getCell(cDTT).value=c&&A.has(o,"dt",c,T)?A.g(o,"dt",c,T):null;
    /* chuỗi dự trù chưa đặt hàng: p = MAX(0, p + dự trù − đặt hàng), tháng 09 về 0 */
    var p=(cm%100===9)?"0":"N("+a(cP0)+")";
    mids.forEach(function(m){ var dh=m===cm?"MAX(N("+a(cTT)+"),N("+a(dk[m])+"))":"N("+a(dk[m])+")"; p="MAX(0,"+(m%100===9?"0":p)+"+N("+a(cDT[m])+")-"+dh+")"; });
    var pT=(T%100===9)?"0":a(cPT);
    row.getCell(cPT).value={ formula:'IF($A'+r+'="","",'+p+')', result:c?f.r.pT1:undefined };
    row.getCell(cSG).value={ formula:'IF(OR($A'+r+'="",'+a(dk[T])+'=""),"",MAX(0,'+a(dk[T])+'-'+pT+'))', result:c&&f.r.dx!==null?f.r.dx:undefined };
    row.getCell(cAF).value={ formula:'IF(OR($A'+r+'="",AND('+a(cDTT)+'="",'+a(dk[T])+'="")),"",MAX(0,'+pT+'+N('+a(cDTT)+')-N('+a(dk[T])+')))' };
    row.getCell(cCK).value={ formula:'IF($A'+r+'="",IF('+a(cDTT)+'="","","Chưa chọn mã hàng."),IF(ISNA(MATCH($A'+r+',DS_MA,0)),"Mã không có trong danh mục – chọn lại. ","")&IF(COUNTIF($A$'+R1+':$A$'+RN+',$A'+r+')>1,"Mã bị chọn 2 lần. ","")&'+
      'IF(AND(ISNUMBER('+a(cDTT)+'),ISNUMBER('+a(cSG)+')),IF('+a(cDTT)+'>'+a(cSG)+',"Cao hơn đề xuất "&('+a(cDTT)+'-'+a(cSG)+')&": phần dư thành hàng chờ. ",""),"")&'+
      'IF(AND(N('+a(cDTT)+')>0,OR('+a(cLv)+'="Cao",'+a(cLv)+'="Không có đơn 6 tháng")),"Mã đang cảnh báo: nên đặt hết hàng đã dự trù trước. ",""))' };
    fv(cHint,"Lưu ý",f&&f.hint);
    cols.forEach(function(k){ var cl=row.getCell(k.n); cl.border=BORDER; cl.font=font(10, k.kind==="sg"||k.kind==="code");
      if(k.kind==="in"){ cl.fill=fill(IN); cl.protection={locked:false}; }
      if(k.kind==="sg") cl.fill=fill(SG);
      if(k.n>=cAvg && k.n!==cLv && k.n!==cCK && k.n!==cHint) cl.numFmt="#,##0;-#,##0;\"-\"";
      if(k.n===cCK||k.n===cHint) cl.alignment={wrapText:true, vertical:"top"}; });
    if(!c){ row.getCell(cCode).fill=fill(IN); row.getCell(cCode).protection={locked:false}; }
    row.getCell(cCode).dataValidation={ type:"list", allowBlank:true, formulae:["DS_MA"], showErrorMessage:true, errorTitle:"Mã hàng", error:"Chọn mã trong danh sách ▼" };
    [dk[T],cDTT].concat(mids.map(function(m){ return dk[m]; })).forEach(function(n){ row.getCell(n).dataValidation={ type:"whole", operator:"greaterThanOrEqual", allowBlank:true, formulae:[0], showErrorMessage:true, errorTitle:"Số lượng", error:"Nhập số nguyên ≥ 0" }; });
    if(f && LVC[f.lv]){ var lc=row.getCell(cLv); lc.fill=fill(LVC[f.lv][0]); lc.font=font(10,true,LVC[f.lv][1]); }
  }
  ws.getCell(5,1).value={ formula:'"Đã nhập dự trù "&COUNT('+colL(cDTT)+R1+':'+colL(cDTT)+RN+')&" mã, tổng "&SUM('+colL(cDTT)+R1+':'+colL(cDTT)+RN+')&". Cao hơn đề xuất: "&SUMPRODUCT(--(ISNUMBER('+colL(cDTT)+R1+':'+colL(cDTT)+RN+')),--(ISNUMBER('+colL(cSG)+R1+':'+colL(cSG)+RN+')),--('+colL(cDTT)+R1+':'+colL(cDTT)+RN+'>'+colL(cSG)+R1+':'+colL(cSG)+RN+'))&" mã."' };
  ws.getCell(5,1).font=font(11,true,NAVY);
  ws.autoFilter={ from:{row:HR,column:1}, to:{row:RN,column:lastC} };

  /* TÌNH HÌNH đến hết T−1 */
  var hs=["Mã hàng","Tên hàng","Nhóm","Dự trù từ "+A.lbl(A.fy0(Tm1)),"Đặt hàng thực tế","Đặt hàng dự kiến","Đã / sẽ đặt","Dự trù chưa đặt hàng","% chưa đặt","Mức","≈ tháng đặt hàng","Lưu ý"];
  shS.getCell(1,1).value="TÌNH HÌNH DỰ TRÙ – ĐẶT HÀNG ĐẾN HẾT "+A.lbl(Tm1)+" – "+npp; shS.getCell(1,1).font=font(15,true,NAVY);
  shS.getCell(2,1).value="Kỳ từ tháng 09. Tháng đã có đơn thực tế dùng số thực tế; các tháng còn lại dùng đặt hàng dự kiến. Dự trù chưa đặt hàng = hàng MMH đã chuẩn bị theo dự trù mà NPP chưa lấy (cộng dồn)."; shS.getCell(2,1).font=font(10,false,MUT);
  hs.forEach(function(h,i){ var cl=shS.getCell(4,i+1); cl.value=h; cl.font=font(10,true,NAVY); cl.fill=fill(HEAD); cl.border=BORDER; cl.alignment={wrapText:true, vertical:"middle", horizontal:"center"}; });
  shS.getRow(4).height=34;
  var sRows=act.map(function(c){ return info[c]; }).sort(function(a,b){ return (b.x.lv==="high")-(a.x.lv==="high") || b.x.p-a.x.p; });
  act.slice().sort(function(a,b){ return info[b].x.p-info[a].x.p; }).forEach(function(c, i){
    var x=info[c].x, it=A.CAT[c], lv=lvName(x), row=shS.getRow(5+i);
    [it.code, it.name, it.group, x.sdt, x.stt, x.sdk, x.sdh, x.p, x.sdt?x.p/x.sdt:null, lv, isFinite(x.cover)&&x.cover?Math.round(x.cover*10)/10:(x.cover===Infinity?"không có đơn":null), A.hintOf(x,Tm1)].forEach(function(v,j){
      var cl=row.getCell(j+1); cl.value=v; cl.border=BORDER; cl.font=font(10, j===0); if(j>=3&&j<=7) cl.numFmt="#,##0;-#,##0;\"-\""; if(j===8) cl.numFmt="0%"; if(j===11) cl.alignment={wrapText:true, vertical:"top"}; });
    if(LVC[lv]){ var lc=row.getCell(10); lc.fill=fill(LVC[lv][0]); lc.font=font(10,true,LVC[lv][1]); }
  });
  [13,30,13,12,12,12,12,13,9,14,10,60].forEach(function(w,i){ shS.getColumn(i+1).width=w; });
  void sRows;

  /* THEO THÁNG: từng mã × tháng (dự trù · đặt hàng · chưa đặt) */
  var ms=A.range(A.fy0(Tm1), T);
  shM.getCell(1,1).value="THEO THÁNG – "+npp+" (D = dự trù · Đ = đặt hàng thực tế / dự kiến · C = dự trù chưa đặt hàng cộng dồn)"; shM.getCell(1,1).font=font(13,true,NAVY);
  shM.getCell(2,1).value="Tháng có chữ \"dự kiến\": chưa có đơn thực tế, dùng đặt hàng dự kiến."; shM.getCell(2,1).font=font(10,false,MUT);
  var hr1=shM.getRow(4), hr2=shM.getRow(5);
  hr1.getCell(1).value="Mã hàng"; hr1.getCell(2).value="Tên hàng";
  ms.forEach(function(m,k){ var c1=3+k*3; shM.mergeCells(4,c1,4,c1+2); var src=(m<cm && m<=o.lastAct)?"thực tế":"dự kiến";
    hr1.getCell(c1).value=A.lbl(m)+" · "+src; ["D","Đ","C"].forEach(function(t,j){ hr2.getCell(c1+j).value=t; }); });
  [hr1,hr2].forEach(function(hr){ for(var j=1;j<=2+ms.length*3;j++){ var cl=hr.getCell(j); cl.font=font(10,true,NAVY); cl.fill=fill(HEAD); cl.border=BORDER; cl.alignment={horizontal:"center", vertical:"middle"}; } });
  act.forEach(function(c,i){ var se=A.series(o,c,ms[0],T), row=shM.getRow(6+i); row.getCell(1).value=A.CAT[c].code; row.getCell(2).value=A.CAT[c].name;
    se.forEach(function(s,k){ var c1=3+k*3; [s.dt,s.dh,s.p].forEach(function(v,j){ var cl=row.getCell(c1+j); cl.value=v||null; cl.numFmt="#,##0"; cl.border=BORDER; cl.font=font(10,j===2,j===2&&v?"FFD9480F":undefined); }); });
    row.getCell(1).font=font(10,true); });
  shM.getColumn(1).width=13; shM.getColumn(2).width=28; for(var j=3;j<=2+ms.length*3;j++) shM.getColumn(j).width=7;

  /* HƯỚNG DẪN */
  var hd=[["HƯỚNG DẪN GỬI DỰ TRÙ THÁNG "+A.lbl(T),16,true,NAVY],["Nhà phân phối: "+npp+"   |   Hạn gửi MMH: "+han,12,true,BLUE],["",10],
    ["CÁC BƯỚC",11,true,NAVY],
    ["1.  Mở sheet LÊN DỰ TRÙ. Danh sách có sẵn các mã đang dự trù / đặt hàng của "+npp+".",11],
    ["2.  Nhập ĐẶT HÀNG DỰ KIẾN (nhu cầu thật) cho các tháng "+A.lbl(cm)+" → "+A.lbl(T)+" ở các cột vàng. Số đã có là dự kiến đang lưu ở MMH — sửa nếu nhu cầu thay đổi.",11],
    ["3.  Xem cột DỰ TRÙ ĐỀ XUẤT "+A.lbl(T)+" (tự tính) = dự kiến "+A.lbl(T)+" − dự trù chưa đặt hàng dự kiến đến hết "+A.lbl(Tm1)+".",11],
    ["4.  Nhập SỐ DỰ TRÙ "+A.lbl(T)+" (cột vàng). Mã không dự trù để trống. Cột Kiểm tra báo khi số cao hơn đề xuất hoặc mã đang cảnh báo.",11],
    ["5.  Thêm mã khác: chọn mã ▼ ở ô vàng trống cột A cuối danh sách.",11],
    ["6.  Xem tình hình từng mã: sheet TÌNH HÌNH (đến hết "+A.lbl(Tm1)+") và THEO THÁNG.",11],
    ["7.  Lưu file (.xlsx) và gửi lại MMH trước hạn. Vui lòng không đổi tên / xoá sheet.",11],["",10],
    ["THUẬT NGỮ",11,true,NAVY],
    ["Dự trù (cố định): số NPP gửi cho tháng thứ "+st.lead+" kế tiếp; MMH chuẩn bị hàng theo số này, NPP cam kết lấy hết.",10],
    ["Đặt hàng dự kiến: nhu cầu đặt hàng thật nhìn từ hôm nay, cập nhật bất cứ lúc nào.",10],
    ["Đặt hàng thực tế: các đơn đã đặt (một tháng có thể đặt nhiều lần).",10],
    ["Dự trù chưa đặt hàng: phần đã dự trù mà chưa đặt hàng, cộng dồn từ tháng 09 — hàng đang chờ NPP lấy.",10],["",10],
    ["CẢNH BÁO (theo tỷ lệ dự trù chưa đặt hàng / tổng dự trù từ đầu kỳ)",11,true,NAVY],
    ["Cao: từ "+A.pct(st.high)+" trở lên — nên đặt hết phần đã dự trù trước, hạn chế dự trù thêm.",10,false,"FFC62828"],
    ["Theo dõi: "+A.pct(st.watch)+"–"+A.pct(st.high)+" — cân nhắc giảm dự trù.",10,false,"FFB45309"],
    ["Ổn: dưới "+A.pct(st.watch)+" — có thể dự trù theo đề xuất.",10,false,"FF2E7D32"],
    ["Chưa dự trù: có đặt hàng nhưng chưa gửi dự trù — nên dự trù để MMH chuẩn bị hàng.",10,false,BLUE],
    ["Không có đơn 6 tháng: còn dự trù chưa đặt mà 6 tháng gần nhất không đặt mã này — trao đổi với MMH trước khi dự trù.",10,false,"FF6B4E16"]];
  hd.forEach(function(x,i){ var cl=shHD.getCell(i+1,2); cl.value=x[0]; cl.font=font(x[1],x[2],x[3]); });
  shHD.getColumn(1).width=3; shHD.getColumn(2).width=130;

  /* _MMH: nhận diện khi nhập lại */
  var meta=[["Ký hiệu",SIG],["Nhà phân phối",npp],["Tháng dự trù",T],["Tháng gửi",cm],["Tạo lúc",new Date().toLocaleString("vi-VN")],["Người tạo",(A.D.me&&A.D.me.pic)||""],
    ["Bản đồ cột",JSON.stringify({sheet:"LÊN DỰ TRÙ", first:R1, code:cCode, dk:Object.keys(dk).reduce(function(a2,m){ a2[m]=dk[m]; return a2; },{}), dt:cDTT})]];
  meta.forEach(function(kv,i){ shX.getCell(i+1,1).value=kv[0]; shX.getCell(i+1,2).value=kv[1]; });
  return wb;
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
      var ws=wb.getWorksheet(map.sheet)||wb.worksheets.filter(function(w){ return /^LÊN DỰ TRÙ/.test(w.name); })[0];
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
  var m=A.modal('<h3>Excel cho nhà phân phối</h3><p class="sub">Mỗi NPP một file riêng, chỉ có số của NPP đó — NPP không thấy số của NPP khác. NPP nhập đặt hàng dự kiến + dự trù rồi gửi lại; MMH nhập file vào đây, số được ghi thẳng vào file gốc.</p>'+
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
      setTimeout(function(){ try{ var wb=build(ni,T,han), nm=fname(npp,T);
        download(wb,nm).then(function(){ A.log("Xuất file Excel", npp, nm+" · dự trù "+A.lbl(T)+" · hạn "+han, 1); next(); }, function(e){ msg.textContent="Lỗi: "+e.message; }); }catch(e){ msg.textContent="Lỗi: "+e.message; console.error(e); } }, 30); })();
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
