/* Dự trù NPP — app nhánh của Turnover cho nhân sự MMH (v1.0 · 08/11/2026)
   Dữ liệu: file gốc "Dự trù NPP Dashboard" qua web app (mmh-backend ▸ du-tru-npp/WebApp.gs):
     dt = 1 Dự trù cố định (NPP gửi cho tháng T = tháng hiện tại + 3, cam kết lấy hết)
     tt = 2 Đặt hàng thực tế (MMH cập nhật, nhiều lần / tháng)
     dk = 3 Đặt hàng dự kiến (nhu cầu nhìn từ bây giờ, sửa bất cứ lúc nào)
   Luật tính (giống sheet SUM / LÊN DỰ TRÙ): xem hàm calc() và hộp "Cách tính". */
(function(){
"use strict";
var API = window.DT_API || "";
var TRAINING_HUB = "https://script.google.com/macros/s/AKfycbwsX4cQEoH4LNlmcNfe8qWIM9K6EiDEXy7PjhP9bHY2citL6xHn5L1unsAlQJHyL9EP/exec";
var LS_TK = "mmh_tk", LS_MAIL = "mmh_last_email", LS_OB = "dt_outbox_v1", LS_UI = "dt_ui_v1", IDB_KEY = "boot";

/* ═════════ TIỆN ÍCH ═════════ */
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function n0(x){ x=Math.round(+x||0); return (x<0?"−":"")+String(Math.abs(x)).replace(/\B(?=(\d{3})+(?!\d))/g,"."); }
function nz(x){ return x ? n0(x) : "–"; }
function pct(x){ return isFinite(x) ? Math.round(x*100)+"%" : "–"; }
function money(v){ v=+v||0; var a=Math.abs(v), s=v<0?"−":"";
  if(a>=1e9) return s+(a/1e9).toFixed(a>=1e10?1:2).replace(".",",").replace(/,0+$/,"")+" tỷ";
  if(a>=1e6) return s+Math.round(a/1e6)+" tr"; if(a>=1e3) return s+Math.round(a/1e3)+" k"; return s+n0(a); }
function addM(ym,k){ var i=Math.floor(ym/100)*12+(ym%100-1)+k; return Math.floor(i/12)*100+(i%12)+1; }
function lbl(ym){ return ym ? String(ym%100).padStart(2,"0")+"/"+Math.floor(ym/100) : ""; }
function lblS(ym){ return ym ? "T"+(ym%100)+"/"+String(Math.floor(ym/100)).slice(2) : ""; }
function fy0(ym){ return (ym%100>=9 ? Math.floor(ym/100) : Math.floor(ym/100)-1)*100+9; }
function fyName(ym){ var y=Math.floor(fy0(ym)/100)+1; return "FY"+(y-1959); }
function range(a,b){ var o=[]; for(var m=a; m<=b; m=addM(m,1)) o.push(m); return o; }
function K(c){ return String(c==null?"":c).trim().toUpperCase(); }
function nk(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/đ/g,"d"); }
function rid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function toast(t,ms){ var e=$("toast"); e.textContent=t; e.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(function(){ e.hidden=true; }, ms||3200); }
function qs(o){ return Object.keys(o).map(function(k){ return encodeURIComponent(k)+"="+encodeURIComponent(o[k]==null?"":o[k]); }).join("&"); }

/* ═════════ MẠNG ═════════ */
function jsonp(url, ms){
  return new Promise(function(res, rej){
    var cb="__dt"+Math.random().toString(36).slice(2), s=document.createElement("script"), done=false;
    var to=setTimeout(function(){ fin(); rej(new Error("hết giờ")); }, ms||45000);
    function fin(){ done=true; clearTimeout(to); try{ delete window[cb]; }catch(_){ window[cb]=undefined; } s.remove(); }
    window[cb]=function(d){ if(done) return; fin(); res(d); };
    s.onerror=function(){ if(done) return; fin(); rej(new Error("không tải được")); };
    s.src=url+(url.indexOf("?")<0?"?":"&")+"callback="+cb; document.head.appendChild(s);
  });
}
/* đọc bằng fetch KHÔNG kèm cookie Google trước (máy đăng nhập nhiều tài khoản Google thì thẻ <script> bị chuyển sang trang chọn tài khoản), lỗi ⇒ JSONP */
function getJSON(url, ms){
  var ctl=window.AbortController?new AbortController():null, to=setTimeout(function(){ if(ctl) ctl.abort(); }, ms||45000);
  return fetch(url,{redirect:"follow", credentials:"omit", signal:ctl?ctl.signal:undefined}).then(function(r){ clearTimeout(to); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
    .catch(function(){ clearTimeout(to); return jsonp(url, ms); });
}
function post(body){
  return fetch(API,{ method:"POST", body:JSON.stringify(body), headers:{"Content-Type":"text/plain;charset=utf-8"}, redirect:"follow", credentials:"omit" })
    .then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); });
}
var IDB=(function(){
  var dbp=null;
  function db(){ if(!dbp) dbp=new Promise(function(res,rej){ try{ var r=indexedDB.open("du_tru_npp",1); r.onupgradeneeded=function(){ r.result.createObjectStore("kv"); }; r.onsuccess=function(){ res(r.result); }; r.onerror=function(){ rej(r.error); }; }catch(e){ rej(e); } }); return dbp; }
  return {
    get:function(k){ return db().then(function(d){ return new Promise(function(res){ try{ var q=d.transaction("kv").objectStore("kv").get(k); q.onsuccess=function(){ res(q.result||null); }; q.onerror=function(){ res(null); }; }catch(_){ res(null); } }); }).catch(function(){ return null; }); },
    set:function(k,v){ return db().then(function(d){ return new Promise(function(res){ try{ var t=d.transaction("kv","readwrite"); t.objectStore("kv").put(v,k); t.oncomplete=function(){ res(true); }; t.onerror=function(){ res(false); }; }catch(_){ res(false); } }); }).catch(function(){ return false; }); },
    del:function(k){ return db().then(function(d){ try{ d.transaction("kv","readwrite").objectStore("kv").delete(k); }catch(_){} }).catch(function(){}); }
  };
})();

/* ═════════ ĐĂNG NHẬP (phiên email công ty — dùng chung Report Hub / CRM / Tender Map) ═════════ */
var lg={step:"email", email:"", busy:false, err:""};
function auth(){ try{ var o=JSON.parse(localStorage.getItem(LS_TK)||"null"); if(!o||!o.tk||!o.user||!o.user.pic) return null; if(o.exp && Date.now()>o.exp) return null; return o; }catch(_){ return null; } }
function tk(){ var a=auth(); return a?a.tk:""; }
function hub(action, p){ return getJSON(TRAINING_HUB+"?"+qs(Object.assign({action:action}, p||{})), 30000); }
function gate(){
  var em=lg.email; if(!em){ try{ em=localStorage.getItem(LS_MAIL)||""; }catch(_){} }
  $("tabs").innerHTML=""; $("tnpp").innerHTML=""; $("tmon").innerHTML="";
  $("main").innerHTML='<div class="gate"><h2>Dự trù nhà phân phối</h2><p class="sub">Theo dõi dự trù · đặt hàng dự kiến · đặt hàng thực tế của từng NPP, cảnh báo dự trù chưa đặt hàng. Dành cho nhân sự MMH — đăng nhập bằng email công ty (đã đăng nhập Report Hub / CRM trên trình duyệt này thì vào thẳng).</p>'+
    (lg.step==="email"
      ? '<div class="row"><input class="inp" style="flex:1" id="lg-email" type="email" autocomplete="email" placeholder="ten@manimedicalhanoi.com" value="'+esc(em)+'"><button class="btn pri" id="lg-go" type="button"'+(lg.busy?" disabled":"")+'>'+(lg.busy?"Đang gửi…":"Gửi mã")+'</button></div>'
      : '<p class="sm">Mã 6 số đã gửi tới <b>'+esc(lg.email)+'</b>.</p><div class="row"><input class="inp" style="flex:1" id="lg-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 số"><button class="btn pri" id="lg-go" type="button"'+(lg.busy?" disabled":"")+'>'+(lg.busy?"Đang kiểm tra…":"Đăng nhập")+'</button></div><p class="sm"><button class="lnk" id="lg-back" type="button">Đổi email</button></p>')+
    '<div class="lgerr">'+esc(lg.err)+'</div></div>';
  var go=$("lg-go"), inp=$("lg-email")||$("lg-code");
  go.onclick=lg.step==="email"?lgSend:lgVerify;
  inp.onkeydown=function(e){ if(e.key==="Enter") go.click(); };
  if($("lg-back")) $("lg-back").onclick=function(){ lg.step="email"; lg.err=""; gate(); };
  setTimeout(function(){ try{ inp.focus(); }catch(_){} }, 30);
}
function lgSend(){
  var v=String(($("lg-email")||{}).value||"").trim().toLowerCase().replace(/\s+/g,"");
  if(v && v.indexOf("@")<0) v+="@manimedicalhanoi.com";
  lg.email=v;
  if(!/^[a-z0-9._%+\-]+@(mani\.inc|manimedicalhanoi\.com)$/.test(v)){ lg.err="Nhập email công ty: …@manimedicalhanoi.com hoặc …@mani.inc"; gate(); return; }
  try{ localStorage.setItem(LS_MAIL, v); }catch(_){}
  lg.busy=true; lg.err=""; gate();
  hub("rhAuthStart",{email:v}).then(function(d){ lg.busy=false;
    if(d && (d.ok || d.code==="WAIT")){ lg.step="code"; lg.err=d.ok?"":(d.error||""); } else lg.err=(d&&d.error)||"Chưa gửi được mã.";
    gate(); },function(e){ lg.busy=false; lg.err="Không kết nối được máy chủ đăng nhập ("+e.message+")."; gate(); });
}
function lgVerify(){
  var code=String(($("lg-code")||{}).value||"").replace(/\D/g,"");
  if(code.length!==6){ lg.err="Nhập đủ 6 số trong email."; gate(); return; }
  lg.busy=true; lg.err=""; gate();
  hub("rhAuthVerify",{email:lg.email, code:code}).then(function(d){ lg.busy=false;
    if(d && d.ok && d.token && d.user){ try{ localStorage.setItem(LS_TK, JSON.stringify({tk:d.token, exp:d.exp, user:d.user, at:Date.now()})); }catch(_){} lg={step:"email",email:lg.email,busy:false,err:""}; start(); return; }
    lg.err=(d&&d.error)||"Mã chưa đúng."; gate(); },function(e){ lg.busy=false; lg.err=e.message; gate(); });
}
function userChip(){
  var a=auth(), u=$("uchip"); if(!a){ u.innerHTML=""; return; }
  var n=a.user.pic||"", ini=n.split(/\s+/).map(function(w){ return w[0]; }).join("").slice(-2).toUpperCase();
  u.innerHTML='<button class="uchip" type="button" id="uc-b" title="'+esc(a.user.email||"")+'"><i>'+esc(ini)+'</i>'+esc(n)+'</button>';
  $("uc-b").onclick=function(){ modal('<h3>Tài khoản</h3><p>'+esc(n)+(D&&D.me?' · '+esc(roleName()):'')+'</p><p class="sm mut">Đăng xuất ở đây thì Report Hub / CRM / Tender Map trên trình duyệt này cũng phải đăng nhập lại.</p><div class="row"><button class="btn" data-x="1" type="button">Đóng</button><button class="btn pri" id="lo" type="button">Đăng xuất</button></div>');
    $("lo").onclick=function(){ try{ localStorage.removeItem(LS_TK); }catch(_){} IDB.del(IDB_KEY); closeModal(); D=null; gate(); userChip(); }; };
}
function roleName(){ var a=D&&D.access; if(!a) return ""; return a.admin?"Admin":(a.edit?"Xem + sửa":"Chỉ xem")+(a.all?" · mọi NPP":" · "+D.npps.join(", ")); }

/* ═════════ DỮ LIỆU ═════════ */
var D=null, I=null, CAT={}, GROUPS=[], OB=[], obBusy=false;
var S={ tab:"ov", npp:0, M:0, T:0, unit:"v", q:"", grp:"", lv:"", sort:"risk", all:false, lim:120, om:0, draft:{}, planQ:"", planOnly:"" };
try{ var u0=JSON.parse(localStorage.getItem(LS_UI)||"{}"); ["tab","unit","sort"].forEach(function(k){ if(u0[k]) S[k]=u0[k]; }); if(u0.nppName) S._nppName=u0.nppName; }catch(_){}
try{ OB=JSON.parse(localStorage.getItem(LS_OB)||"[]")||[]; }catch(_){ OB=[]; }
function saveUi(){ try{ localStorage.setItem(LS_UI, JSON.stringify({tab:S.tab, unit:S.unit, sort:S.sort, nppName:S.npp>=0&&D?D.npps[S.npp]:"*"})); }catch(_){} }

function load(force){
  if(!API){ $("main").innerHTML='<div class="note err">App chưa được nối máy chủ (DT_API trống). Liên hệ Admin.</div>'; return Promise.resolve(); }
  var t=tk(); if(!t){ gate(); return Promise.resolve(); }
  var p0 = (!D && !force) ? IDB.get(IDB_KEY).then(function(c){ if(c && c.ok && !D){ use(c, true); } }) : Promise.resolve();
  return p0.then(function(){
    if(!D) $("main").innerHTML='<div class="boot">Đang đọc file dự trù…</div>';
    return getJSON(API+"?"+qs({action:"dtBoot", tk:t}), 60000);
  }).then(function(d){
    if(d && d.ok){ use(d, false); IDB.set(IDB_KEY, d); return; }
    if(d && d.code==="AUTH"){ if(/hết hạn|không hợp lệ|đăng xuất|bị khoá|RH_Users|danh sách người dùng/i.test(d.error||"")){ try{ localStorage.removeItem(LS_TK); }catch(_){} } lg.err=d.error||""; gate(); return; }
    if(d && d.code==="NOACCESS"){ IDB.del(IDB_KEY); D=null; $("main").innerHTML='<div class="gate"><h2>Chưa có quyền</h2><p>'+esc(d.error)+'</p></div>'; return; }
    throw new Error((d&&d.error)||"dữ liệu lạ");
  }).catch(function(e){
    if(D){ toast("Chưa đọc được bản mới ("+e.message+") — đang xem bản lưu trên máy."); return; }
    $("main").innerHTML='<div class="note err">Không đọc được dữ liệu dự trù ('+esc(e.message)+'). <button class="lnk" id="rt" type="button">Thử lại</button></div>';
    $("rt").onclick=function(){ load(true); };
  });
}

function use(d, cached){
  D=d; D.cached=cached;
  CAT={}; var gs={};
  (d.cat.list||[]).forEach(function(r){ CAT[K(r[0])]={code:String(r[0]), name:r[1]||"", group:r[2]||"Khác", price:+r[3]||0}; gs[r[2]||"Khác"]=1; });
  D.hasPrice=Object.keys(CAT).some(function(k){ return CAT[k].price>0; });
  if(!D.hasPrice) S.unit="q";
  OB.forEach(function(o){ applyOps(o.ops, true); });
  index();
  Object.keys(I.groups).forEach(function(g){ gs[g]=1; });
  GROUPS=Object.keys(gs).sort(function(a,b){ return a.localeCompare(b,"vi"); });
  var st=D.set;
  if(!S.M) S.M=addM(st.fromDT,-1);
  if(!S.T) S.T=st.fromDT;
  if(!S.om) S.om=st.cm;
  if(S._nppName){ var ix=S._nppName==="*"?-1:D.npps.indexOf(S._nppName); S.npp=(ix<0 && (S._nppName!=="*"||D.npps.length<2))?0:ix; S._nppName=null; }
  if(S.npp>=D.npps.length) S.npp=0;
  $("ver").textContent="v"+(window.DT_VER||"");
  userChip(); header(); render(); obChip(); obRun();
}

/* raw rows ⇒ chỉ mục theo NPP: dt/dk/tt[mã][tháng] = SL, đơn thực tế từng dòng, tháng có đơn thực tế gần nhất */
function index(){
  I={ n:D.npps.map(function(){ return { dt:{}, dk:{}, tt:{}, lines:[], lastAct:0, codes:{} }; }), groups:{} };
  function add(o, s, r){ var c=K(r[2]); if(!CAT[c]) CAT[c]={code:String(r[2]), name:"", group:"Khác", price:0, extra:true};
    var t=o[s][c]=o[s][c]||{}; t[r[1]]=(t[r[1]]||0)+(+r[3]||0); o.codes[c]=1; I.groups[CAT[c].group]=1; }
  D.dt.forEach(function(r){ var o=I.n[r[0]]; if(o) add(o,"dt",r); });
  D.dk.forEach(function(r){ var o=I.n[r[0]]; if(o) add(o,"dk",r); });
  D.tt.forEach(function(r){ var o=I.n[r[0]]; if(!o) return; add(o,"tt",r); o.lines.push({m:r[1], code:K(r[2]), q:+r[3]||0, row:r[4], day:r[5]||"", note:r[6]||"", tmp:r[7]||""});
    if((+r[3]||0)>0 && r[1]>o.lastAct) o.lastAct=r[1]; });
}
function g(o,s,c,m){ var t=o[s][c]; return t ? (t[m]||0) : 0; }
function has(o,s,c,m){ var t=o[s][c]; return !!(t && t[m]!==undefined); }

/* ═════════ CÁCH TÍNH ═════════
   Đặt hàng dùng để tính của tháng m (dh):
     m đã qua (m < tháng hiện tại) và đã có đơn thực tế của NPP đến tháng đó ⇒ đơn THỰC TẾ;
     còn lại (tháng hiện tại, tháng tới, tháng đã qua chưa cập nhật đơn) ⇒ max(thực tế, DỰ KIẾN).
   Dự trù chưa đặt hàng cộng dồn (p): p = max(0, p + dự trù − dh); về 0 đầu kỳ (tháng 09).
   Mức cảnh báo tại tháng xem M: tỷ lệ p ÷ Σ dự trù từ đầu kỳ ⇒ Cao ≥ ngưỡng CAO · Theo dõi ≥ ngưỡng THEO DÕI · Ổn;
     chưa gửi dự trù mà có đặt hàng ⇒ Chưa dự trù. "Không có đơn 6 tháng": còn dự trù chưa đặt mà 6 tháng gần nhất không có đơn thực tế.
   Đề xuất dự trù tháng T = max(0, dự kiến T − p đến hết T−1). */
function dhOf(o,c,m,dr){
  var tt=g(o,"tt",c,m), dk=val(o,"dk",c,m,dr), cm=D.set.cm;
  if(m<cm && m<=o.lastAct) return {v:tt, src:"tt", tt:tt, dk:dk};
  var v=Math.max(tt,dk);
  return {v:v, src: v===0?"":(tt>=dk?"tt":"dk"), tt:tt, dk:dk, tmp:m<cm};
}
function val(o,s,c,m,dr){ if(dr){ var k=s+"|"+c+"|"+m; if(dr.hasOwnProperty(k)) return dr[k]==null?0:dr[k]; } return g(o,s,c,m); }
/* chuỗi tháng từ đầu kỳ của `from` đến `to` (qua tháng 09 thì về 0) */
function series(o,c,from,to,dr){
  var out=[], p=0, sdt=0, sdh=0, stt=0, sdk=0;
  range(fy0(from), to).forEach(function(m){
    if(m%100===9){ p=0; sdt=0; sdh=0; stt=0; sdk=0; }
    var dt=val(o,"dt",c,m,dr), h=dhOf(o,c,m,dr);
    p=Math.max(0, p+dt-h.v); sdt+=dt; sdh+=h.v; if(h.src==="tt") stt+=h.v; else sdk+=h.v;
    out.push({m:m, dt:dt, tt:h.tt, dk:h.dk, dh:h.v, src:h.src, tmp:h.tmp, p:p, sdt:sdt, sdh:sdh, stt:stt, sdk:sdk});
  });
  return out;
}
function avgOf(o,c){
  var st=D.set, end=Math.min(o.lastAct||addM(st.cm,-1), addM(st.cm,-1)), s=0;
  for(var k=0;k<st.tbN;k++) s+=g(o,"tt",c,addM(end,-k));
  return s/st.tbN;
}
function calc(o,c,M,dr){
  var se=series(o,c,M,M,dr), L=se[se.length-1]||{p:0,sdt:0,sdh:0,stt:0,sdk:0}, st=D.set, avg=avgOf(o,c);
  var lv, r=L.sdt?L.p/L.sdt:0;
  if(!L.sdt && !L.sdh) lv="idle";
  else if(!L.sdt) lv="none";
  else if(r>=st.high) lv="high";
  else if(r>=st.watch) lv="watch";
  else lv="ok";
  var dead=L.p>0 && avg===0;
  return { c:c, se:se, p:L.p, sdt:L.sdt, sdh:L.sdh, stt:L.stt, sdk:L.sdk, r:r, lv:lv, dead:dead, avg:avg, cover: avg>0 ? L.p/avg : (L.p>0?Infinity:0) };
}
var LV={ high:["Cao","lv-high"], watch:["Theo dõi","lv-watch"], ok:["Ổn","lv-ok"], none:["Chưa dự trù","lv-none"], idle:["Chưa phát sinh","lv-idle"], dead:["Không có đơn 6 tháng","lv-dead"] };
function pill(lv){ var x=LV[lv]||LV.idle; return '<span class="pill '+x[1]+'">'+x[0]+'</span>'; }
function rank(x){ return ({high:5, watch:4, none:3, ok:1, idle:0})[x.lv]+(x.dead?1.5:0); }
function hintOf(x, M){
  var st=D.set, m=lbl(M);
  if(x.lv==="idle") return "Mã chưa có dự trù / đặt hàng trong kỳ. Chỉ dự trù khi có kế hoạch bán chắc chắn.";
  if(x.dead) return "Còn "+n0(x.p)+" dự trù chưa đặt hàng nhưng "+st.tbN+" tháng gần nhất không có đơn thực tế: trao đổi với NPP trước khi nhận thêm dự trù mã này.";
  if(x.lv==="high") return "Đến hết "+m+" còn "+n0(x.p)+" dự trù chưa đặt hàng ("+pct(x.r)+" số đã dự trù"+(isFinite(x.cover)&&x.cover?", ≈ "+x.cover.toFixed(1).replace(".",",")+" tháng đặt hàng":"")+"): NPP nên đặt hết phần đã dự trù trước, hạn chế dự trù thêm.";
  if(x.lv==="watch") return "Còn "+n0(x.p)+" dự trù chưa đặt hàng ("+pct(x.r)+"): cân nhắc giảm dự trù các tháng tới.";
  if(x.lv==="none") return "Đã đặt "+n0(x.sdh)+" nhưng chưa gửi dự trù: nên dự trù để MMH chuẩn bị hàng.";
  return "Dự trù và đặt hàng khớp nhau ("+pct(x.r)+" chưa đặt).";
}
/* phạm vi NPP đang xem */
function scope(){ return S.npp<0 ? D.npps.map(function(_,i){ return i; }) : [S.npp]; }
function activeCodes(o, M){
  var a=fy0(M), b=Math.max(M, addM(D.set.cm, D.set.lead)), lo=addM(Math.min(a, addM(D.set.cm,-6)),0), out=[];
  Object.keys(o.codes).forEach(function(c){
    var hit=false;
    ["dt","dk","tt"].some(function(s){ var t=o[s][c]; if(!t) return false; for(var m in t){ if(+m>=lo && +m<=b && t[m]) { hit=true; return true; } } return false; });
    if(hit) out.push(c);
  });
  return out;
}
function priceOf(c){ return (CAT[c]&&CAT[c].price)||0; }
function U(q,c){ return S.unit==="v" ? q*priceOf(c) : q; }
function fmtU(v){ return S.unit==="v" ? money(v) : n0(v); }
function unitName(){ return S.unit==="v" ? "giá trị (VND, theo đơn giá DANH MỤC)" : "số lượng"; }

/* ═════════ ẢNH SẢN PHẨM ═════════ */
var DIA=null; fetch("img/dia/list.json").then(function(r){ return r.json(); }).then(function(l){ DIA={}; l.forEach(function(m){ DIA[m]=1; }); if(D) render(); }).catch(function(){ DIA={}; });
var GIMG=[
  [/^DIA-?BURS/i,"diaburs"],[/^K-?FILES/i,"kfiles"],[/^H-?FILES/i,"hfiles"],[/^ENGINE/i,"engine"],[/^PEESO/i,"peeso"],[/REAMERS/i,"reamers"],[/JIZAI/i,"jizai"],
  [/GATES/i,"gates"],[/CARBIDE/i,"carbide"],[/^MI STAIN/i,"mi"],[/HARD STAIN/i,"hardss"],[/FLARE/i,"flare"],[/^RT FILES/i,"rt"],[/^D FINDER/i,"dfinder"],
  [/GLIDE/i,"glide"],[/BARBED/i,"barbed"],[/SQUARE/i,"square"],[/^U-?FILES/i,"ufiles"],[/SUPER FILES/i,"super"],[/SURGICAL BURS/i,"surgical"],
  [/IPR/i,"ipr"],[/COMPOSITE|FLO-?V|BULK|NANO|MICRO/i,"composite"],[/BOND/i,"bond"],[/GINGIVA/i,"bl_gingiva"],[/BLEACH OFFICE/i,"bl_office"],[/AFTER BLEACH/i,"bl_after"],
  [/BLEACH/i,"bleach"],[/SUTURE|NYLON|SILK|PGA|POLYPROP/i,"sutures"],[/SPREADER|PLUGGER|PASTE CARR|FILE/i,"handfiles"]
];
function imgOf(c){
  var it=CAT[c]||{}, name=String(it.name||""), grp=String(it.group||"");
  if(/DIA-?BURS/i.test(grp+" "+name) && DIA){
    var m=name.replace(/DIA-?BURS/i,"").trim().split(/\s+/)[0]||"", base=m.replace(/(EF|SF|SC|F|C|M)$/,"");
    var cands=[base, base.replace(/-S{1,2}(\d)/,"-$1"), base.replace(/^([A-Z]+)(\d)/,"$1-$2"), base.replace(/^([A-Z]+)(\d)/,"$1-$2").replace(/(EF|F)$/,"")];
    for(var i=0;i<cands.length;i++) if(DIA[cands[i]]) return {src:"img/dia/"+cands[i]+".webp", dia:true};
  }
  var s=grp+" "+name;
  for(var j=0;j<GIMG.length;j++) if(GIMG[j][0].test(s)) return {src:"img/g/"+GIMG[j][1]+".webp"};
  return null;
}
function pimg(c, cls){
  var im=imgOf(c);
  if(!im) return '<div class="pimg '+(cls||"")+'"><div class="ph">'+esc((CAT[c]&&CAT[c].group)||"")+'</div></div>';
  return '<div class="pimg '+(im.dia?"dia ":"")+(cls||"")+'"><img loading="lazy" alt="" src="'+im.src+'"></div>';
}
function gimg(grp){
  for(var j=0;j<GIMG.length;j++) if(GIMG[j][0].test(grp)) return '<div class="pimg"><img loading="lazy" alt="" src="img/g/'+GIMG[j][1]+'.webp"></div>';
  return '<div class="pimg"><div class="ph">'+esc(grp.slice(0,10))+'</div></div>';
}

/* ═════════ KHUNG: NPP · THÁNG XEM · TAB ═════════ */
function header(){
  var h="";
  if(D.npps.length>1) h+='<button class="seg'+(S.npp<0?" on":"")+'" data-npp="-1" type="button">Tất cả NPP</button>';
  D.npps.forEach(function(n,i){ h+='<button class="seg'+(S.npp===i?" on":"")+'" data-npp="'+i+'" type="button">'+esc(n)+'</button>'; });
  $("tnpp").innerHTML=h;
  $("tnpp").onclick=function(e){ var b=e.target.closest("[data-npp]"); if(!b) return; S.npp=+b.dataset.npp; S.lim=120; saveUi(); header(); render(); };
  var st=D.set, a=fy0(addM(st.cm,-12)), b=addM(st.cm, st.lead+6), opts=range(a,b).map(function(m){ return '<option value="'+m+'"'+(m===S.M?" selected":"")+'>'+lbl(m)+(m===st.cm?" · tháng này":"")+'</option>'; }).join("");
  $("tmon").innerHTML='<span>Tình hình đến hết</span><div class="mstep"><button type="button" data-mv="-1" title="Tháng trước">‹</button><select id="msel">'+opts+'</select><button type="button" data-mv="1" title="Tháng sau">›</button></div>';
  $("msel").onchange=function(){ S.M=+this.value; header(); render(); };
  $("tmon").querySelectorAll("[data-mv]").forEach(function(x){ x.onclick=function(){ var m=addM(S.M,+x.dataset.mv); if(m<a||m>b) return; S.M=m; header(); render(); }; });
  var nCao=0; scope().forEach(function(i){ var o=I.n[i]; activeCodes(o,S.M).forEach(function(c){ var x=calc(o,c,S.M); if(x.lv==="high"||x.dead) nCao++; }); });
  var tabs=[["ov","Tổng quan"],["codes","Mã hàng"+(nCao?'<span class="bd">'+nCao+'</span>':"")],["plan","Lên dự trù "+lbl(S.T)],["orders","Đặt hàng thực tế"]];
  if(D.access && D.access.admin) tabs.push(["acl","Phân quyền"]);
  $("tabs").innerHTML=tabs.map(function(t){ return '<button class="tab'+(S.tab===t[0]?" on":"")+'" data-tab="'+t[0]+'" type="button">'+t[1]+'</button>'; }).join("")+
    '<span class="tstat">'+(D.cached?"Bản lưu trên máy · ":"")+"Cập nhật "+esc(D.at||"")+' · <button class="lnk" id="reload" type="button">Tải lại</button></span>';
  $("tabs").onclick=function(e){ var b=e.target.closest("[data-tab]"); if(b){ S.tab=b.dataset.tab; saveUi(); header(); render(); window.scrollTo(0,0); } };
  $("reload").onclick=function(){ load(true); };
  $("b-xl").onclick=function(){ XL.open(); };
  $("b-help").onclick=help;
}
function render(){
  if(!D) return;
  closeTip();
  var v=S.tab;
  if(v==="codes") vCodes(); else if(v==="plan") vPlan(); else if(v==="orders") vOrders(); else if(v==="acl") vAcl(); else vOv();
}

/* ═════════ TỔNG QUAN ═════════ */
function agg(idxs, M, months){
  var A={ sdt:0, stt:0, sdk:0, sdh:0, p:0, n:{high:0,watch:0,ok:0,none:0,idle:0,dead:0}, rows:[], groups:{}, mon:{} };
  months.forEach(function(m){ A.mon[m]={dt:0, tt:0, dk:0, p:0, tmp:false}; });
  var end=months[months.length-1];
  idxs.forEach(function(i){
    var o=I.n[i];
    activeCodes(o,M).forEach(function(c){
      var x=calc(o,c,M); x.i=i;
      A.sdt+=U(x.sdt,c); A.stt+=U(x.stt,c); A.sdk+=U(x.sdk,c); A.sdh+=U(x.sdh,c); A.p+=U(x.p,c);
      A.n[x.lv]++; if(x.dead) A.n.dead++;
      A.rows.push(x);
      var gname=(CAT[c]&&CAT[c].group)||"Khác", G=A.groups[gname]=A.groups[gname]||{sdt:0,sdh:0,p:0,n:0,hi:0};
      G.sdt+=U(x.sdt,c); G.sdh+=U(x.sdh,c); G.p+=U(x.p,c); G.n++; if(x.lv==="high"||x.dead) G.hi++;
      series(o,c,months[0],end).forEach(function(s){ var t=A.mon[s.m]; if(!t) return; t.dt+=U(s.dt,c); if(s.src==="tt") t.tt+=U(s.dh,c); else t.dk+=U(s.dh,c); t.p+=U(s.p,c); if(s.tmp&&s.dh) t.tmp=true; });
    });
  });
  return A;
}
function vOv(){
  var st=D.set, M=S.M, f0=fy0(M), months=range(f0, addM(f0,11)), A=agg(scope(),M,months), nm=S.npp<0?"tất cả NPP":D.npps[S.npp];
  var lastAct=Math.max.apply(null, scope().map(function(i){ return I.n[i].lastAct||0; }));
  var r=A.sdt? A.p/A.sdt : 0, lvAll=!A.sdt?"idle":(r>=st.high?"high":(r>=st.watch?"watch":"ok"));
  var h='<div class="split"><div><h2>Tình hình '+esc(nm)+' đến hết '+lbl(M)+'</h2><p class="sub">Kỳ '+fyName(M)+' từ '+lbl(f0)+' · tính theo '+unitName()+' · đơn thực tế đã nhập đến tháng '+(lastAct?lbl(lastAct):"—")+
    (M>=st.cm?' · từ '+lbl(Math.max(st.cm, lastAct?addM(lastAct,1):st.cm))+' trở đi dùng đặt hàng dự kiến':'')+'</p></div>'+
    (D.hasPrice?'<div class="chips"><button class="chipf'+(S.unit==="v"?" on":"")+'" data-u="v" type="button">Giá trị</button><button class="chipf'+(S.unit==="q"?" on":"")+'" data-u="q" type="button">Số lượng</button></div>':'')+'</div>';
  var tot=A.sdh+A.sdt||1;
  h+='<div class="grid g4">'+
    flowCard("① Dự trù cố định","var(--dt)",A.sdt,"NPP đã gửi từ "+lbl(f0)+" đến "+lbl(M))+
    flowCard("② Đặt hàng thực tế","var(--tt)",A.stt,"Đơn đã đặt (MMH cập nhật)")+
    flowCard("③ Đặt hàng dự kiến","var(--fc)",A.sdk,"Các tháng chưa có đơn thực tế")+
    '<div class="card flow pen"><div class="lb"><i style="background:var(--pen)"></i>Dự trù chưa đặt hàng</div><div class="v num">'+fmtU(A.p)+'</div><div class="vv">'+pct(r)+' số đã dự trù · '+pill(lvAll)+'</div>'+
      '<div class="gauge"><div class="gbar"><span style="left:0;width:'+Math.min(100,A.sdh/Math.max(A.sdt,A.sdh,1)*100)+'%;background:var(--tt)"></span>'+
      (A.p?'<span style="left:'+Math.min(100,A.sdh/Math.max(A.sdt,A.sdh,1)*100)+'%;width:'+Math.min(100,A.p/Math.max(A.sdt,A.sdh,1)*100)+'%;background:var(--pen);opacity:.85"></span>':'')+
      '</div><div class="glab"><span>đã / sẽ đặt</span><span>chưa đặt</span></div></div></div>'+
  '</div>';
  h+='<div class="grid g2" style="margin-top:12px"><div class="card chart"><div class="split"><h3>Theo tháng · '+fyName(M)+'</h3><span class="sm mut">Rê chuột vào cột để xem số</span></div>'+chartSvg(months, A.mon, M)+
    '<div class="legend"><span><i style="background:var(--dt)"></i>Dự trù</span><span><i style="background:var(--tt)"></i>Đặt hàng thực tế</span><span><i style="background:repeating-linear-gradient(45deg,var(--fc),var(--fc) 2px,#fff 2px,#fff 4px);border:1px solid var(--fc)"></i>Đặt hàng dự kiến</span><span><i style="background:var(--pen);height:3px"></i>Dự trù chưa đặt hàng cộng dồn (nét đứt: dự báo sau tháng đang xem)</span></div></div>';
  h+='<div class="card"><h3>Cần chú ý đến hết '+lbl(M)+'</h3><div class="chips" style="margin-bottom:10px">'+
    [["high","Cao"],["dead","Không có đơn 6 tháng"],["watch","Theo dõi"],["none","Chưa dự trù"],["ok","Ổn"]].map(function(t){ return '<button class="chipf" data-go="'+t[0]+'" type="button">'+pill(t[0])+'<b>'+A.n[t[0]]+'</b> mã</button>'; }).join("")+'</div>';
  var top=A.rows.filter(function(x){ return x.p>0 && (x.lv==="high"||x.lv==="watch"||x.dead); }).sort(function(a,b){ return U(b.p,b.c)-U(a.p,a.c); }).slice(0,8);
  h+= top.length ? '<table class="tbl"><tr><th></th><th>Mã</th><th class="r">Chưa đặt</th><th class="r">%</th><th class="r">≈ tháng</th></tr>'+top.map(function(x){
      return '<tr class="click" data-code="'+esc(x.c)+'" data-i="'+x.i+'"><td class="tiny">'+pimg(x.c)+'</td><td><b>'+esc(CAT[x.c].code)+'</b><span class="mini">'+esc(CAT[x.c].name)+(S.npp<0?" · "+esc(D.npps[x.i]):"")+'</span></td><td class="r num">'+fmtU(U(x.p,x.c))+'</td><td class="r">'+pct(x.r)+'</td><td class="r">'+cov(x)+'</td></tr>'; }).join("")+'</table>'
    : '<div class="note">Không có mã nào còn nhiều dự trù chưa đặt hàng.</div>';
  h+='</div></div>';
  if(S.npp<0 && D.npps.length>1){
    h+='<h3 style="margin-top:16px">Từng nhà phân phối</h3><div class="grid g4">'+D.npps.map(function(n,i){
      var B=agg([i],M,[M]), rr=B.sdt?B.p/B.sdt:0, lvv=!B.sdt?"idle":(rr>=st.high?"high":(rr>=st.watch?"watch":"ok"));
      return '<div class="card nppc" data-npp2="'+i+'"><div class="split"><b>'+esc(n)+'</b>'+pill(lvv)+'</div><div class="kv" style="grid-template-columns:1fr 1fr"><div><small>Dự trù</small><b>'+fmtU(B.sdt)+'</b></div><div><small>Đã / sẽ đặt</small><b>'+fmtU(B.sdh)+'</b></div><div><small>Chưa đặt</small><b style="color:var(--pen)">'+fmtU(B.p)+'</b></div><div><small>Mã Cao</small><b>'+(B.n.high+B.n.dead)+'</b></div></div><div class="sm mut">'+(D.files&&D.files[n]?'File NPP: đồng bộ '+esc(D.files[n].synced||"—"):'')+'</div></div>';
    }).join("")+'</div>';
  }
  var gl=Object.keys(A.groups).map(function(k){ var G=A.groups[k]; G.k=k; return G; }).sort(function(a,b){ return b.p-a.p || b.sdt-a.sdt; });
  h+='<div class="card" style="margin-top:12px"><div class="split"><h3>Theo nhóm sản phẩm</h3><span class="sm mut">Thanh xanh = đã / sẽ đặt · cam = dự trù chưa đặt hàng</span></div>'+
    gl.map(function(G){ var mx=Math.max(G.sdt,G.sdh,1), rr=G.sdt?G.p/G.sdt:0;
      return '<div class="grp" data-grp="'+esc(G.k)+'">'+gimg(G.k)+'<div><div class="gn">'+esc(G.k)+' <span class="mut sm">· '+G.n+' mã'+(G.hi?' · <span style="color:var(--hi)">'+G.hi+' cảnh báo</span>':'')+'</span></div>'+
        '<div class="hb"><span style="width:'+(Math.min(G.sdh,G.sdt)/mx*100)+'%;background:var(--tt)"></span><span style="width:'+(G.p/mx*100)+'%;background:var(--pen)"></span></div></div>'+
        '<div class="r sm num" style="text-align:right"><b>'+fmtU(G.p)+'</b> <span class="mut">/ '+fmtU(G.sdt)+'</span><br><span class="mut">'+pct(rr)+' chưa đặt</span></div></div>'; }).join("")+'</div>';
  $("main").innerHTML=h;
  var mn=$("main");
  mn.querySelectorAll("[data-u]").forEach(function(b){ b.onclick=function(){ S.unit=b.dataset.u; saveUi(); render(); }; });
  mn.querySelectorAll("[data-go]").forEach(function(b){ b.onclick=function(){ S.tab="codes"; S.lv=b.dataset.go; header(); render(); }; });
  mn.querySelectorAll("[data-grp]").forEach(function(b){ b.onclick=function(){ S.tab="codes"; S.grp=b.dataset.grp; S.lv=""; header(); render(); }; });
  mn.querySelectorAll("[data-npp2]").forEach(function(b){ b.onclick=function(){ S.npp=+b.dataset.npp2; header(); render(); }; });
  mn.querySelectorAll("tr[data-code]").forEach(function(b){ b.onclick=function(){ detail(+b.dataset.i, b.dataset.code); }; });
  bindChartTips();
}
function flowCard(t,col,v,sub){ return '<div class="card flow"><div class="lb"><i style="background:'+col+'"></i>'+t+'</div><div class="v num">'+fmtU(v)+'</div><div class="vv">'+sub+'</div></div>'; }
function cov(x){ if(x.cover===Infinity) return '<span style="color:var(--dead)">không đơn</span>'; return x.cover ? x.cover.toFixed(1).replace(".",",") : "–"; }

/* biểu đồ tháng: cột dự trù (navy) cạnh cột đặt hàng (thực tế đặc + dự kiến kẻ sọc), đường dự trù chưa đặt hàng */
var TIPS=[];
function chartSvg(months, mon, M, opt){
  opt=opt||{}; var W=opt.w||760, H=opt.h||250, L=54, R=10, T=12, B=36, n=months.length, cw=(W-L-R)/n, bw=Math.min(18, cw*0.32);
  var mx=1; months.forEach(function(m){ var t=mon[m]; mx=Math.max(mx, t.dt, t.tt+t.dk, t.p); });
  var nice=niceMax(mx), y=function(v){ return T+(H-T-B)*(1-v/nice); }, cm=D.set.cm;
  var s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Biểu đồ theo tháng"><defs><pattern id="hz" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><rect width="2.2" height="5" fill="#9DB5E4"/></pattern></defs>';
  for(var k=0;k<=4;k++){ var v=nice*k/4, yy=y(v); s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#EEF1F5"/><text x="'+(L-6)+'" y="'+(yy+4)+'" text-anchor="end" font-size="10.5" fill="#98A2B3">'+(S.unit==="v"?money(v):n0(v))+'</text>'; }
  TIPS=[];
  var pts=[];
  months.forEach(function(m,i){
    var t=mon[m], x0=L+i*cw, cx=x0+cw/2;
    if(m===M) s+='<rect x="'+x0+'" y="'+T+'" width="'+cw+'" height="'+(H-T-B)+'" fill="#F0F7FF"/>';
    if(m===cm) s+='<line x1="'+x0+'" x2="'+x0+'" y1="'+T+'" y2="'+(H-B)+'" stroke="#98A2B3" stroke-dasharray="3 3"/><text x="'+(x0+3)+'" y="'+(T+9)+'" font-size="10" fill="#98A2B3">hôm nay</text>';
    var xa=cx-bw-1, xb=cx+1;
    if(t.dt) s+='<rect x="'+xa+'" y="'+y(t.dt)+'" width="'+bw+'" height="'+(y(0)-y(t.dt))+'" rx="2" fill="#003047"/>';
    if(t.tt) s+='<rect x="'+xb+'" y="'+y(t.tt)+'" width="'+bw+'" height="'+(y(0)-y(t.tt))+'" rx="2" fill="#3A5CAA"/>';
    if(t.dk) s+='<rect x="'+xb+'" y="'+y(t.tt+t.dk)+'" width="'+bw+'" height="'+(y(t.tt)-y(t.tt+t.dk))+'" rx="2" fill="url(#hz)" stroke="#9DB5E4"/>';
    pts.push([cx, y(t.p)]);
    s+='<text x="'+cx+'" y="'+(H-B+15)+'" text-anchor="middle" font-size="11" fill="'+(m===M?"#003047":"#667085")+'" font-weight="'+(m===M?"700":"400")+'">'+lblS(m)+'</text>';
    TIPS.push({x0:x0, w:cw, m:m, t:t});
    s+='<rect class="hit" data-ti="'+i+'" x="'+x0+'" y="'+T+'" width="'+cw+'" height="'+(H-T-B+20)+'" fill="transparent"/>';
  });
  /* đường dự trù chưa đặt hàng: đến tháng cuối còn số liệu; sau tháng đang xem = dự báo (nét đứt) */
  var lastI=-1; months.forEach(function(m,i){ var t=mon[m]; if(t.dt||t.tt||t.dk) lastI=i; });
  var mi=months.indexOf(M); if(mi<0) mi=months.length-1;
  var solid=pts.slice(0, Math.min(mi, lastI)+1), dash=pts.slice(Math.min(mi, lastI), lastI+1);
  if(solid.length>1) s+='<polyline points="'+solid.map(function(p){ return p[0]+","+p[1]; }).join(" ")+'" fill="none" stroke="#D9480F" stroke-width="2.2" stroke-linejoin="round"/>';
  if(dash.length>1) s+='<polyline points="'+dash.map(function(p){ return p[0]+","+p[1]; }).join(" ")+'" fill="none" stroke="#D9480F" stroke-width="2" stroke-dasharray="5 4"/>';
  pts.slice(0,lastI+1).forEach(function(p,i){ s+='<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+(i===mi?4:2.6)+'" fill="'+(i>mi?"#fff":"#D9480F")+'" stroke="#D9480F" stroke-width="1.5"/>'; });
  return s+'</svg>';
}
function niceMax(v){ var e=Math.pow(10,Math.floor(Math.log10(v))), f=v/e; return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*e; }
var tipEl=null;
function closeTip(){ if(tipEl){ tipEl.remove(); tipEl=null; } }
function bindChartTips(root){
  (root||document).querySelectorAll("svg .hit").forEach(function(r){
    var tips=TIPS;
    r.onmousemove=function(e){ var o=tips[+r.dataset.ti]; if(!o) return; if(!tipEl){ tipEl=document.createElement("div"); tipEl.className="tip"; document.body.appendChild(tipEl); }
      var t=o.t; tipEl.innerHTML='<b>'+lbl(o.m)+'</b>'+(o.m===D.set.cm?' · tháng hiện tại':'')+'<br>Dự trù: <b>'+fmtU(t.dt)+'</b><br>Đặt hàng thực tế: <b>'+fmtU(t.tt)+'</b><br>Đặt hàng dự kiến: <b>'+fmtU(t.dk)+'</b>'+(t.tmp?' <span class="mut">(tháng đã qua, chưa cập nhật đơn — tạm tính)</span>':'')+'<br>Dự trù chưa đặt hàng cuối tháng: <b style="color:var(--pen)">'+fmtU(t.p)+'</b>';
      tipEl.style.left=Math.min(e.clientX+14, innerWidth-300)+"px"; tipEl.style.top=(e.clientY+14)+"px"; };
    r.onmouseleave=closeTip;
  });
}

/* ═════════ MÃ HÀNG ═════════ */
function codeRows(){
  var M=S.M, out=[];
  scope().forEach(function(i){
    var o=I.n[i], list=S.all ? Object.keys(CAT).filter(function(c){ return !CAT[c].extra || o.codes[c]; }) : activeCodes(o,M);
    list.forEach(function(c){ var x=calc(o,c,M); x.i=i; out.push(x); });
  });
  return out;
}
function vCodes(){
  var rows=codeRows(), cnt={high:0,watch:0,ok:0,none:0,idle:0,dead:0};
  rows.forEach(function(x){ cnt[x.lv]++; if(x.dead) cnt.dead++; });
  var q=nk(S.q).trim();
  var f=rows.filter(function(x){ var it=CAT[x.c];
    if(S.grp && it.group!==S.grp) return false;
    if(S.lv==="dead"){ if(!x.dead) return false; } else if(S.lv && x.lv!==S.lv) return false;
    if(q && nk(it.code+" "+it.name).indexOf(q)<0) return false; return true; });
  var sorters={ risk:function(a,b){ return rank(b)-rank(a) || U(b.p,b.c)-U(a.p,a.c); }, pend:function(a,b){ return U(b.p,b.c)-U(a.p,a.c); },
    dt:function(a,b){ return U(b.sdt,b.c)-U(a.sdt,a.c); }, code:function(a,b){ return a.c.localeCompare(b.c); } };
  f.sort(sorters[S.sort]||sorters.risk);
  var h='<div class="bar"><input class="inp" id="cq" placeholder="Tìm mã / tên…" value="'+esc(S.q)+'" style="width:220px">'+
    '<select class="inp" id="cg"><option value="">Mọi nhóm</option>'+GROUPS.map(function(gname){ return '<option'+(gname===S.grp?" selected":"")+'>'+esc(gname)+'</option>'; }).join("")+'</select>'+
    '<select class="inp" id="cs"><option value="risk">Xếp: rủi ro trước</option><option value="pend">Chưa đặt nhiều nhất</option><option value="dt">Dự trù nhiều nhất</option><option value="code">Theo mã</option></select>'+
    '<label class="sm mut"><input type="checkbox" id="call"'+(S.all?" checked":"")+'> Cả mã chưa phát sinh</label>'+
    '<span class="sm mut" style="margin-left:auto">Tình hình đến hết <b>'+lbl(S.M)+'</b> · '+f.length+' mã</span></div>';
  h+='<div class="chips" style="margin-bottom:12px"><button class="chipf'+(!S.lv?" on":"")+'" data-lv="" type="button">Tất cả <b>'+rows.length+'</b></button>'+
    ["high","dead","watch","none","ok"].concat(S.all?["idle"]:[]).map(function(k){ return '<button class="chipf'+(S.lv===k?" on":"")+'" data-lv="'+k+'" type="button">'+pill(k)+' <b>'+cnt[k]+'</b></button>'; }).join("")+'</div>';
  h+='<div class="cards">'+f.slice(0,S.lim).map(cardHtml).join("")+'</div>';
  if(f.length>S.lim) h+='<div class="more"><button class="btn" id="more" type="button">Xem thêm '+Math.min(120,f.length-S.lim)+' mã</button></div>';
  if(!f.length) h+='<div class="note">Không có mã nào khớp bộ lọc.</div>';
  $("main").innerHTML=h;
  $("cq").oninput=function(){ S.q=this.value; S.lim=120; clearTimeout(vCodes._t); vCodes._t=setTimeout(function(){ vCodes(); var e=$("cq"); e.focus(); e.setSelectionRange(e.value.length,e.value.length); },200); };
  $("cg").onchange=function(){ S.grp=this.value; S.lim=120; vCodes(); };
  $("cs").value=S.sort; $("cs").onchange=function(){ S.sort=this.value; saveUi(); vCodes(); };
  $("call").onchange=function(){ S.all=this.checked; S.lim=120; vCodes(); };
  $("main").querySelectorAll("[data-lv]").forEach(function(b){ b.onclick=function(){ S.lv=b.dataset.lv; S.lim=120; vCodes(); }; });
  $("main").querySelectorAll(".pc").forEach(function(b){ b.onclick=function(){ detail(+b.dataset.i, b.dataset.code); }; });
  if($("more")) $("more").onclick=function(){ S.lim+=120; vCodes(); };
}
function cardHtml(x){
  var it=CAT[x.c], mx=Math.max(x.sdt, x.sdh, 1), done=Math.min(x.sdh, x.sdt);
  var cls=x.dead&&x.lv!=="ok"?"dead":x.lv;
  return '<div class="pc l-'+cls+'" data-code="'+esc(x.c)+'" data-i="'+x.i+'">'+pimg(x.c)+
    '<div style="min-width:0"><div class="hd"><div style="min-width:0"><div class="cd">'+esc(it.code)+'</div><div class="nm" title="'+esc(it.name)+'">'+esc(it.name||"(chưa có trong DANH MỤC)")+'</div><div class="gp">'+esc(it.group)+(S.npp<0?" · "+esc(D.npps[x.i]):"")+'</div></div>'+
    pill(x.lv)+'</div>'+
    '<div class="nums"><div><small>Dự trù</small><b>'+nz(x.sdt)+'</b></div><div><small>Đã / sẽ đặt</small><b>'+nz(x.sdh)+'</b></div><div><small>Chưa đặt</small><b style="color:'+(x.p?"var(--pen)":"inherit")+'">'+nz(x.p)+'</b></div></div>'+
    '<div class="pb"><span style="width:'+(done/mx*100)+'%;background:var(--tt)"></span><span style="width:'+(x.p/mx*100)+'%;background:var(--pen)"></span>'+(x.sdh>x.sdt?'<span style="width:'+((x.sdh-x.sdt)/mx*100)+'%;background:#9DB5E4"></span>':'')+'</div>'+
    '<div class="ft">'+(x.p?pct(x.r)+' chưa đặt · ':'')+(x.avg?'TB '+n0(x.avg)+'/tháng':(x.dead?'<b style="color:var(--dead)">Không có đơn '+D.set.tbN+' tháng</b>':'chưa có đơn '+D.set.tbN+' tháng'))+(x.p&&isFinite(x.cover)?' · ≈ '+x.cover.toFixed(1).replace(".",",")+' tháng':'')+'</div></div></div>';
}

/* ═════════ CHI TIẾT 1 MÃ ═════════ */
function detail(i, c){
  var o=I.n[i], it=CAT[c], st=D.set, M=S.M, x=calc(o,c,M);
  var end=Math.max(addM(fy0(M),11), addM(st.cm, st.lead+1)), f0=fy0(M);
  var se=series(o,c,f0,end), mon={}; se.forEach(function(s){ mon[s.m]={dt:s.dt, tt:s.src==="tt"?s.dh:0, dk:s.src==="tt"?0:s.dh, p:s.p, tmp:s.tmp&&s.dh>0}; });
  var unit0=S.unit; S.unit="q";
  var cht=chartSvg(range(f0,addM(f0,11)), mon, M, {w:700,h:220});
  S.unit=unit0;
  var cls=x.dead&&x.lv!=="ok"?"dead":x.lv, can=D.access&&D.access.edit, lastD=Math.max(M, st.fromDT);
  se.forEach(function(s){ if(s.dt||s.tt||s.dk) lastD=Math.max(lastD,s.m); }); se=se.filter(function(s){ return s.m<=lastD; });
  var h='<button class="x" data-x="1" type="button" aria-label="Đóng">×</button><div class="dhd">'+pimg(c)+'<div><div class="mut sm">'+esc(D.npps[i])+' · '+esc(it.group)+'</div><h2 style="margin:2px 0">'+esc(it.code)+'</h2><div>'+esc(it.name)+'</div><div style="margin-top:5px">'+pill(x.lv)+' '+(x.dead?pill("dead"):"")+(it.price?' <span class="sm mut">Đơn giá '+n0(it.price)+'</span>':'')+'</div></div></div>'+
    '<div class="kv"><div><small>Dự trù '+lbl(f0)+'–'+lbl(M)+'</small><b>'+n0(x.sdt)+'</b></div><div><small>Đã / sẽ đặt</small><b>'+n0(x.sdh)+'</b></div><div><small>Chưa đặt hết '+lbl(M)+'</small><b style="color:var(--pen)">'+n0(x.p)+'</b></div><div><small>TB đặt / tháng ('+st.tbN+'T)</small><b>'+n0(x.avg)+'</b></div></div>'+
    '<div class="hint l-'+cls+'">'+esc(hintOf(x,M))+'</div><div class="chart">'+cht+'</div>'+
    '<div class="tw" style="margin-top:10px"><table class="tbl"><tr><th>Tháng</th><th class="r">Dự trù</th><th class="r">Thực tế</th><th class="r">Dự kiến</th><th class="r">Dùng để tính</th><th class="r">Chưa đặt (cộng dồn)</th></tr>'+
    se.map(function(s){ var cur=s.m===M; return '<tr'+(cur?' style="background:#F0F7FF;font-weight:600"':'')+'><td>'+lbl(s.m)+(s.m===st.cm?' <span class="mini" style="display:inline">· tháng này</span>':'')+(s.m===st.fromDT?' <span class="mini" style="display:inline">· đang nhận dự trù</span>':'')+'</td><td class="r num">'+nz(s.dt)+'</td><td class="r num">'+nz(s.tt)+'</td><td class="r num">'+nz(s.dk)+'</td><td class="r num">'+nz(s.dh)+(s.dh?' <span class="mini" style="display:inline">'+(s.src==="tt"?"thực tế":"dự kiến"+(s.tmp?" · tạm":""))+'</span>':'')+'</td><td class="r num" style="color:'+(s.p?"var(--pen)":"inherit")+'">'+nz(s.p)+'</td></tr>'; }).join("")+'</table></div>';
  if(can){
    var ms=range(st.cm, addM(st.cm, st.lead+2));
    h+='<h3 style="margin-top:14px">Sửa nhanh</h3><p class="sub">Đặt hàng dự kiến sửa được từ tháng hiện tại; dự trù chỉ nhận tháng chưa chốt (từ '+lbl(st.fromDT)+'). Lưu ghi thẳng vào file gốc.</p><div class="tw"><table class="tbl"><tr><th></th>'+ms.map(function(m){ return '<th class="r">'+lbl(m)+'</th>'; }).join("")+'</tr>'+
      '<tr><td>Đặt hàng dự kiến</td>'+ms.map(function(m){ return '<td class="r"><input class="qin" data-s="dk" data-m="'+m+'" value="'+(has(o,"dk",c,m)?g(o,"dk",c,m):"")+'" inputmode="numeric"></td>'; }).join("")+'</tr>'+
      '<tr><td>Dự trù cố định</td>'+ms.map(function(m){ var lock=m<st.fromDT && !D.access.admin; return '<td class="r"><input class="qin" data-s="dt" data-m="'+m+'" value="'+(has(o,"dt",c,m)?g(o,"dt",c,m):"")+'" inputmode="numeric"'+(lock?' disabled title="Tháng đã chốt dự trù"':'')+'></td>'; }).join("")+'</tr></table></div>'+
      '<div class="row" style="margin-top:10px"><button class="btn pri" id="dsave" type="button">Lưu thay đổi</button><span class="sm mut" id="dmsg"></span></div>';
  }
  var dr=$("drawer"); dr.innerHTML=h; dr.hidden=false; dr.scrollTop=0;
  dr.querySelector("[data-x]").onclick=function(){ dr.hidden=true; closeTip(); };
  bindChartTips(dr);
  if(can) $("dsave").onclick=function(){
    var ops=[];
    dr.querySelectorAll(".qin:not([disabled])").forEach(function(inp){ var s=inp.dataset.s, m=+inp.dataset.m, v=inp.value.trim().replace(/[.,\s]/g,""), q=v===""?null:+v;
      if(q!==null && (!isFinite(q)||q<0)) return; var old=has(o,s,c,m)?g(o,s,c,m):null; if(old!==q) ops.push({s:s, npp:D.npps[i], m:m, code:it.code, q:q}); });
    if(!ops.length){ $("dmsg").textContent="Không có gì thay đổi."; return; }
    queue(ops, "Sửa mã "+it.code); dr.hidden=true; toast("Đã lưu "+ops.length+" ô — đang ghi vào file gốc.");
  };
}
document.addEventListener("keydown",function(e){ if(e.key==="Escape"){ if(!$("modal").hidden) closeModal(); else if(!$("drawer").hidden){ $("drawer").hidden=true; closeTip(); } } });

/* ═════════ LÊN DỰ TRÙ THÁNG T ═════════ */
function planMonths(){ var st=D.set; return { cm:st.cm, T:S.T, mids:range(st.cm, addM(S.T,-1)) }; }
function planRows(o){
  var P=planMonths(), lo=addM(P.cm,-6), set={};
  Object.keys(o.codes).forEach(function(c){ ["dt","dk","tt"].forEach(function(s){ var t=o[s][c]; if(t) for(var m in t){ if(+m>=lo && +m<=P.T && t[m]) set[c]=1; } }); });
  Object.keys(S.draft).forEach(function(k){ if(k==="_npp") return; var p=k.split("|"); set[p[1]]=1; });
  (S.planAdd||[]).forEach(function(c){ set[c]=1; });
  return Object.keys(set);
}
function planCalc(o,c){
  var P=planMonths(), dr=S.draft, Tm1=addM(P.T,-1);
  var se=series(o,c,Tm1,Tm1,dr), L=se[se.length-1]||{p:0};
  var pT1 = (P.T%100===9) ? 0 : L.p;
  var p0s=series(o,c,addM(P.cm,-1),addM(P.cm,-1),dr), p0=(P.cm%100===9)?0:((p0s[p0s.length-1]||{}).p||0);
  var dkT=val(o,"dk",c,P.T,dr), hasDk=dr.hasOwnProperty("dk|"+c+"|"+P.T) ? dr["dk|"+c+"|"+P.T]!=null : has(o,"dk",c,P.T);
  var dx=hasDk ? Math.max(0, dkT-pT1) : null;
  var hasDt=dr.hasOwnProperty("dt|"+c+"|"+P.T) ? dr["dt|"+c+"|"+P.T]!=null : has(o,"dt",c,P.T), dtT=val(o,"dt",c,P.T,dr);
  var after=Math.max(0, pT1+dtT-dkT);
  return { p0:p0, pT1:pT1, dkT:dkT, hasDk:hasDk, dx:dx, dtT:dtT, hasDt:hasDt, after:after, x:calc(o,c,addM(P.cm,-1),dr) };
}
function vPlan(){
  var st=D.set;
  if(S.npp<0){ $("main").innerHTML='<div class="note">Chọn 1 nhà phân phối ở thanh trên để lên dự trù.</div>'; return; }
  if(+S.draft._npp!==S.npp) S.draft={_npp:S.npp};
  var o=I.n[S.npp], P=planMonths(), can=D.access&&D.access.edit, lockT=P.T<st.fromDT && !(D.access&&D.access.admin);
  var tOpts=range(addM(st.fromDT,-1), addM(st.cm, st.lead)).filter(function(m){ return m>st.cm; });
  var han=String(st.hanDay).padStart(2,"0")+"/"+lbl(addM(P.T,1-st.lead));
  var codes=planRows(o), q=nk(S.planQ).trim();
  var rows=codes.map(function(c){ var r=planCalc(o,c); r.c=c; return r; }).filter(function(r){ var it=CAT[r.c];
    if(q && nk(it.code+" "+it.name).indexOf(q)<0) return false;
    if(S.planOnly==="sg" && !(r.dx>0)) return false;
    if(S.planOnly==="warn" && !(r.x.lv==="high"||r.x.dead||(r.hasDt&&r.dx!==null&&r.dtT>r.dx))) return false;
    if(S.grp && it.group!==S.grp) return false; return true; });
  rows.sort(function(a,b){ var ga=CAT[a.c].group, gb=CAT[b.c].group; return ga.localeCompare(gb,"vi") || a.c.localeCompare(b.c); });
  var h='<div class="split"><div><h2>Lên dự trù tháng '+lbl(P.T)+' · '+esc(D.npps[S.npp])+'</h2><p class="sub">Hạn NPP gửi: '+han+(P.T<st.fromDT?' · <b style="color:var(--hi)">tháng này đã chốt dự trù</b>':' · đang nhận dự trù')+' · tháng hiện tại '+lbl(P.cm)+'</p></div>'+
    '<div class="row"><span class="sm mut">Tháng dự trù</span><select class="inp" id="pT">'+tOpts.map(function(m){ return '<option value="'+m+'"'+(m===P.T?" selected":"")+'>'+lbl(m)+(m<st.fromDT?" (đã chốt)":"")+'</option>'; }).join("")+'</select></div></div>';
  h+='<div class="steps"><div class="step"><b><em>1</em>Cập nhật đặt hàng dự kiến</b>Nhu cầu thực tế từng tháng '+lbl(P.cm)+' → '+lbl(P.T)+' (ô vàng). Dự kiến là "góc nhìn từ bây giờ", sửa bất cứ lúc nào.</div>'+
    '<div class="step"><b><em>2</em>Xem dự trù đề xuất</b>Đề xuất '+lbl(P.T)+' = dự kiến '+lbl(P.T)+' − dự trù chưa đặt hàng dự kiến đến hết '+lbl(addM(P.T,-1))+'.</div>'+
    '<div class="step"><b><em>3</em>Nhập dự trù '+lbl(P.T)+'</b>Ô vàng cột cuối, hoặc bấm "Theo đề xuất". Cột "Còn chưa đặt" về 0 là dự trù khớp nhu cầu.</div></div>';
  h+='<div class="bar"><input class="inp" id="pq" placeholder="Tìm mã / tên…" value="'+esc(S.planQ)+'" style="width:200px"><select class="inp" id="pg"><option value="">Mọi nhóm</option>'+GROUPS.map(function(gname){ return '<option'+(gname===S.grp?" selected":"")+'>'+esc(gname)+'</option>'; }).join("")+'</select>'+
    '<div class="chips"><button class="chipf'+(!S.planOnly?" on":"")+'" data-po="" type="button">Mọi mã</button><button class="chipf'+(S.planOnly==="sg"?" on":"")+'" data-po="sg" type="button">Có đề xuất</button><button class="chipf'+(S.planOnly==="warn"?" on":"")+'" data-po="warn" type="button">Cần chú ý</button></div>'+
    (can&&!lockT?'<button class="btn" id="pfill" type="button">Điền dự trù theo đề xuất (mã chưa nhập)</button>':'')+
    (can?'<input class="inp" id="padd" list="padd-l" placeholder="+ Thêm mã khác…" style="width:220px"><datalist id="padd-l"></datalist>':'')+'</div>';
  var mids=P.mids;
  h+='<div class="tw" style="max-height:calc(100vh - 330px)"><table class="tbl plan"><tr><th></th><th>Mã hàng</th><th class="r">TB đặt / tháng</th><th class="r">Chưa đặt đến hết '+lbl(addM(P.cm,-1))+'</th>'+
    mids.map(function(m){ return '<th class="r">Dự trù '+lbl(m)+'<br><span class="mut">đã gửi</span></th><th class="r in">Dự kiến '+lbl(m)+(m===P.cm?'<br><span class="mut">đã đặt / dự kiến</span>':'')+'</th>'; }).join("")+
    '<th class="r in">Dự kiến '+lbl(P.T)+'</th><th class="r">Chưa đặt dự kiến đến hết '+lbl(addM(P.T,-1))+'</th><th class="r sg">Đề xuất dự trù '+lbl(P.T)+'</th><th class="r in">DỰ TRÙ '+lbl(P.T)+'</th><th class="r">Còn chưa đặt sau '+lbl(P.T)+'</th><th>Cảnh báo</th></tr>';
  var ro=!can;
  h+=rows.map(function(r){ var c=r.c, it=CAT[c];
    return '<tr data-c="'+esc(c)+'"><td class="tiny">'+pimg(c)+'</td><td class="nm"><b>'+esc(it.code)+'</b><span class="mini">'+esc(it.name)+'</span></td><td class="r num">'+nz(Math.round(r.x.avg))+'</td><td class="r num">'+nz(r.p0)+'</td>'+
      mids.map(function(m){ var tt=g(o,"tt",c,m); return '<td class="r num">'+nz(val(o,"dt",c,m,S.draft))+'</td><td class="r in">'+(m===P.cm&&tt?'<span class="mini">đã đặt '+n0(tt)+'</span>':'')+qin("dk",c,m,o,ro)+'</td>'; }).join("")+
      '<td class="r in">'+qin("dk",c,P.T,o,ro)+'</td>'+planCells(r,o,can,lockT,ro)+'</tr>';
  }).join("")+'</table></div>';
  if(!rows.length) h+='<div class="note" style="margin-top:8px">Chưa có mã nào. '+(can?'Thêm mã ở ô "+ Thêm mã khác…".':'')+'</div>';
  h+='<div class="sticky-ft" id="pft">'+planFoot(o,codes,P,can)+'</div>';
  $("main").innerHTML=h;
  var mn=$("main");
  $("pT").onchange=function(){ S.T=+this.value; S.draft={_npp:S.npp}; header(); vPlan(); };
  $("pq").oninput=function(){ S.planQ=this.value; clearTimeout(vPlan._t); vPlan._t=setTimeout(function(){ vPlan(); var e=$("pq"); e.focus(); e.setSelectionRange(e.value.length,e.value.length); },250); };
  $("pg").onchange=function(){ S.grp=this.value; vPlan(); };
  mn.querySelectorAll("[data-po]").forEach(function(b){ b.onclick=function(){ S.planOnly=b.dataset.po; vPlan(); }; });
  mn.querySelectorAll(".qin").forEach(function(inp){
    inp.onchange=function(){ var v=inp.value.trim().replace(/[.,\s]/g,""), q=v===""?null:+v; if(q!==null&&(!isFinite(q)||q<0)){ inp.value=""; q=null; }
      var s0=inp.dataset.s, c=inp.dataset.c, m=+inp.dataset.m, k=s0+"|"+c+"|"+m, base=has(o,s0,c,m)?g(o,s0,c,m):null;
      if(q===base) delete S.draft[k]; else S.draft[k]=q;
      inp.classList.toggle("ch", S.draft.hasOwnProperty(k));
      planRowUpdate(o,c,can,lockT,ro); $("pft").innerHTML=planFoot(o,codes,P,can); bindFoot(); };
    inp.onkeydown=function(e){ if(e.key==="Enter"){ e.preventDefault(); var all=[].slice.call(mn.querySelectorAll(".qin:not([disabled])")), i=all.indexOf(inp);
      inp.dispatchEvent(new Event("change")); var nx=all[i+1]; if(nx){ nx.focus(); nx.select(); } } };
  });
  mn.onclick=function(e){ var b=e.target.closest("[data-use]"); if(!b) return; var c=b.dataset.use, r=planCalc(o,c); S.draft["dt|"+c+"|"+P.T]=r.dx||null;
    var inp=mn.querySelector('.qin[data-s="dt"][data-c="'+cssq(c)+'"]'); if(inp){ inp.value=r.dx||""; inp.classList.add("ch"); }
    planRowUpdate(o,c,can,lockT,ro); $("pft").innerHTML=planFoot(o,codes,P,can); bindFoot(); };
  function bindFoot(){
    if($("pundo")) $("pundo").onclick=function(){ S.draft={_npp:S.npp}; S.planAdd=[]; vPlan(); };
    if($("psave")) $("psave").onclick=function(){
      var ops=[]; Object.keys(S.draft).forEach(function(k){ if(k==="_npp") return; var p=k.split("|"); ops.push({s:p[0], npp:D.npps[S.npp], m:+p[2], code:CAT[p[1]].code, q:S.draft[k]}); });
      if(!ops.length) return;
      queue(ops, "Lên dự trù "+lbl(P.T)); S.draft={_npp:S.npp}; S.planAdd=[]; toast("Đã lưu "+ops.length+" ô — đang ghi vào file gốc.");
    };
  }
  bindFoot();
  if($("pfill")) $("pfill").onclick=function(){ var n=0; codes.forEach(function(c){ var r=planCalc(o,c); if(!r.hasDt && r.dx){ S.draft["dt|"+c+"|"+P.T]=r.dx; n++; } }); toast(n?"Đã điền đề xuất cho "+n+" mã — xem lại rồi bấm Lưu.":"Không có mã nào cần điền."); vPlan(); };
  if($("padd")){
    var dl=$("padd-l"), have={}; codes.forEach(function(c){ have[c]=1; });
    dl.innerHTML=Object.keys(CAT).filter(function(c){ return !have[c]; }).slice(0,3000).map(function(c){ return '<option value="'+esc(CAT[c].code+" · "+CAT[c].name)+'">'; }).join("");
    $("padd").onchange=function(){ var c=K(this.value.split(" · ")[0]); if(!CAT[c]){ toast("Mã không có trong danh mục."); return; } S.planAdd=(S.planAdd||[]).concat([c]); S.planQ=""; vPlan(); };
  }
}
function cssq(s){ return String(s).replace(/["\\]/g,"\\$&"); }
function planCells(r,o,can,lockT,ro){
  var P=planMonths(), c=r.c, warn=[];
  if(r.x.dead) warn.push(pill("dead")); else if(r.x.lv==="high"||r.x.lv==="watch") warn.push(pill(r.x.lv));
  if(r.hasDt && r.dx!==null && r.dtT>r.dx) warn.push('<span class="sm" style="color:var(--wa)">cao hơn đề xuất '+n0(r.dtT-r.dx)+'</span>');
  if(r.hasDt && !r.hasDk) warn.push('<span class="sm mut">chưa có dự kiến '+lbl(P.T)+'</span>');
  return '<td class="r num" data-k="pT1">'+nz(r.pT1)+'</td><td class="r sg num" data-k="dx">'+(r.dx===null?'<span class="mut" title="Chưa có dự kiến tháng '+lbl(P.T)+'">–</span>':n0(r.dx))+
    (can&&!lockT&&r.dx!==null&&r.dx!==r.dtT?' <button class="lnk sm" data-use="'+esc(c)+'" type="button">dùng</button>':'')+'</td>'+
    '<td class="r in" data-k="dtin">'+qin("dt",c,P.T,o,ro||lockT, r.dx!==null&&r.hasDt&&r.dtT>r.dx)+'</td><td class="r num" data-k="after" style="color:'+(r.after?"var(--pen)":"inherit")+'">'+(r.hasDt||r.hasDk?nz(r.after):"–")+'</td><td data-k="warn">'+warn.join(" ")+'</td>';
}
function planRowUpdate(o,c,can,lockT,ro){
  var tr=document.querySelector('.plan tr[data-c="'+cssq(c)+'"]'); if(!tr) return;
  var r=planCalc(o,c); r.c=c;
  var tmp=document.createElement("tbody"); tmp.innerHTML='<tr>'+planCells(r,o,can,lockT,ro)+'</tr>';
  ["pT1","dx","after","warn"].forEach(function(k){ var a=tr.querySelector('[data-k="'+k+'"]'), b=tmp.querySelector('[data-k="'+k+'"]'); if(a&&b){ a.innerHTML=b.innerHTML; a.style.cssText=b.style.cssText; } });
  var inp=tr.querySelector('[data-k="dtin"] .qin'); if(inp) inp.classList.toggle("over", r.dx!==null&&r.hasDt&&r.dtT>r.dx);
}
function planFoot(o,codes,P,can){
  var nCh=Object.keys(S.draft).filter(function(k){ return k!=="_npp"; }).length, sumT=0, sumV=0, nT=0, nOver=0, nHigh=0;
  codes.forEach(function(c){ var r=planCalc(o,c); if(r.hasDt&&r.dtT){ nT++; sumT+=r.dtT; sumV+=r.dtT*priceOf(c); if(r.dx!==null&&r.dtT>r.dx) nOver++; if(r.x.lv==="high"||r.x.dead) nHigh++; } });
  return '<span>Dự trù '+lbl(P.T)+': <b>'+nT+'</b> mã · <b class="num">'+n0(sumT)+'</b>'+(D.hasPrice?' · '+money(sumV):'')+'</span><span class="sm">'+(nOver?'<span style="color:var(--wa)">'+nOver+' mã cao hơn đề xuất</span> · ':'')+(nHigh?'<span style="color:var(--hi)">'+nHigh+' mã đang cảnh báo Cao vẫn dự trù</span>':'')+'</span>'+
    '<span class="sp">'+(nCh?'<button class="btn" id="pundo" type="button">Bỏ thay đổi</button>':'')+(can?'<button class="btn pri" id="psave" type="button"'+(nCh?'':' disabled')+'>Lưu '+(nCh?nCh+' ô ':'')+'vào file gốc</button>':'<span class="sm mut">Tài khoản chỉ xem</span>')+'</span>';
}
function qin(s,c,m,o,dis,over){
  var k=s+"|"+c+"|"+m, ch=S.draft.hasOwnProperty(k), v=ch?S.draft[k]:(has(o,s,c,m)?g(o,s,c,m):null), past=s==="dk"&&m<D.set.cm&&!(D.access&&D.access.admin);
  return '<input class="qin'+(ch?" ch":"")+(over?" over":"")+'" data-s="'+s+'" data-c="'+esc(c)+'" data-m="'+m+'" value="'+(v==null?"":v)+'" inputmode="numeric"'+(dis||past?" disabled":"")+'>';
}

/* ═════════ ĐẶT HÀNG THỰC TẾ ═════════ */
function vOrders(){
  var st=D.set;
  if(S.npp<0){ $("main").innerHTML='<div class="note">Chọn 1 nhà phân phối ở thanh trên.</div>'; return; }
  var o=I.n[S.npp], m=S.om, can=D.access&&D.access.edit, codes={};
  o.lines.forEach(function(l){ if(l.m===m) codes[l.code]=1; });
  Object.keys(o.dk).forEach(function(c){ if(o.dk[c][m]) codes[c]=1; });
  Object.keys(o.dt).forEach(function(c){ if(o.dt[c][m]) codes[c]=1; });
  var list=Object.keys(codes).map(function(c){ var x=calc(o,c,m), tt=g(o,"tt",c,m), dk=g(o,"dk",c,m), dt=g(o,"dt",c,m); return {c:c, tt:tt, dk:dk, dt:dt, x:x}; })
    .sort(function(a,b){ return (b.dk-b.tt)-(a.dk-a.tt) || a.c.localeCompare(b.c); });
  var lines=o.lines.filter(function(l){ return l.m===m; }).sort(function(a,b){ return String(b.day).localeCompare(String(a.day)) || b.row-a.row; });
  var opts=range(addM(st.cm,-12), addM(st.cm,1)).map(function(x){ return '<option value="'+x+'"'+(x===m?" selected":"")+'>'+lbl(x)+(x===st.cm?" · tháng này":"")+'</option>'; }).join("");
  var tT=0, tK=0, tD=0; list.forEach(function(r){ tT+=r.tt; tK+=r.dk; tD+=r.dt; });
  var h='<div class="split"><div><h2>Đặt hàng thực tế · '+esc(D.npps[S.npp])+'</h2><p class="sub">Mỗi lần NPP đặt hàng = 1 dòng. Đơn thực tế của tháng đã qua thay cho đặt hàng dự kiến khi tính dự trù chưa đặt hàng.</p></div>'+
    '<div class="row"><span class="sm mut">Tháng</span><select class="inp" id="om">'+opts+'</select></div></div>';
  h+='<div class="grid g4" style="margin-bottom:12px">'+flowCardQ("Dự trù tháng "+lbl(m),"var(--dt)",tD)+flowCardQ("Đặt hàng dự kiến","var(--fc)",tK)+flowCardQ("Đã đặt (thực tế)","var(--tt)",tT)+
    '<div class="card flow"><div class="lb">Tiến độ so với dự kiến</div><div class="v num">'+(tK?pct(tT/tK):"–")+'</div><div class="vv">'+lines.length+' lần đặt trong tháng</div></div></div>';
  if(can) h+='<div class="card" style="margin-bottom:12px"><h3>Thêm đơn đặt hàng</h3><div class="row"><input class="inp" id="oc" list="oc-l" placeholder="Mã hàng (gõ để tìm)" style="width:280px"><datalist id="oc-l"></datalist>'+
    '<input class="inp" id="oq" placeholder="Số lượng" inputmode="numeric" style="width:110px"><input class="inp" id="od" type="date" value="'+esc(D.today||"")+'" style="width:150px"><input class="inp" id="on" placeholder="Ghi chú (số đơn…)" style="width:200px">'+
    '<button class="btn" id="oadd" type="button">+ Thêm dòng</button></div><div id="obuf" style="margin-top:8px"></div></div>';
  h+='<div class="grid g2"><div class="tw"><table class="tbl"><tr><th></th><th>Mã</th><th class="r">Dự trù</th><th class="r">Dự kiến</th><th class="r">Đã đặt</th><th class="r">Còn theo dự kiến</th><th>Mức đến hết '+lbl(m)+'</th></tr>'+
    list.map(function(r){ var it=CAT[r.c]; return '<tr class="click" data-code="'+esc(r.c)+'"><td class="tiny">'+pimg(r.c)+'</td><td><b>'+esc(it.code)+'</b><span class="mini">'+esc(it.name)+'</span></td><td class="r num">'+nz(r.dt)+'</td><td class="r num">'+nz(r.dk)+'</td><td class="r num"><b>'+nz(r.tt)+'</b></td><td class="r num">'+(r.dk>r.tt?n0(r.dk-r.tt):"–")+'</td><td>'+pill(r.x.lv)+'</td></tr>'; }).join("")+
    (list.length?'':'<tr><td colspan="7" class="mut">Chưa có dự trù / dự kiến / đơn tháng này.</td></tr>')+'</table></div>';
  h+='<div class="tw"><table class="tbl"><tr><th>Ngày / lần đặt</th><th>Mã</th><th class="r">SL</th><th>Ghi chú</th><th></th></tr>'+
    lines.map(function(l){ return '<tr><td>'+esc(l.day||"—")+'</td><td><b>'+esc(CAT[l.code].code)+'</b><span class="mini">'+esc(CAT[l.code].name)+'</span></td><td class="r num">'+n0(l.q)+'</td><td class="sm mut" style="max-width:220px">'+esc(l.note)+'</td><td>'+(can&&l.row?'<button class="lnk sm" data-del="'+l.row+'" type="button">Xoá</button>':(l.tmp?'<span class="mini">đang ghi</span>':''))+'</td></tr>'; }).join("")+
    (lines.length?'':'<tr><td colspan="5" class="mut">Chưa có đơn nào trong tháng.</td></tr>')+'</table></div></div>';
  $("main").innerHTML=h;
  $("om").onchange=function(){ S.om=+this.value; vOrders(); };
  $("main").querySelectorAll("tr[data-code]").forEach(function(b){ b.onclick=function(){ detail(S.npp, b.dataset.code); }; });
  $("main").querySelectorAll("[data-del]").forEach(function(b){ b.onclick=function(){ var l=o.lines.filter(function(x){ return x.row===+b.dataset.del; })[0]; if(!l) return;
    confirmBox("Xoá dòng đặt hàng "+CAT[l.code].code+" · "+n0(l.q)+" ("+(l.day||lbl(l.m))+")?", function(){ queue([{s:"tt", op:"del", npp:D.npps[S.npp], m:l.m, code:CAT[l.code].code, q:l.q, row:l.row}], "Xoá đơn thực tế"); vOrders(); }); }; });
  if(can){
    var buf=[];
    $("oc-l").innerHTML=Object.keys(CAT).slice(0,3000).map(function(c){ return '<option value="'+esc(CAT[c].code+" · "+CAT[c].name)+'">'; }).join("");
    function paint(){ $("obuf").innerHTML=buf.length?'<table class="tbl"><tr><th>Mã</th><th class="r">SL</th><th>Ngày</th><th>Ghi chú</th><th></th></tr>'+buf.map(function(b,i){ return '<tr><td>'+esc(b.code)+' <span class="mini" style="display:inline">'+esc(CAT[K(b.code)].name)+'</span></td><td class="r">'+n0(b.q)+'</td><td>'+esc(b.day)+'</td><td>'+esc(b.note)+'</td><td><button class="lnk sm" data-rm="'+i+'" type="button">bỏ</button></td></tr>'; }).join("")+'</table><div class="row" style="margin-top:8px"><button class="btn pri" id="osave" type="button">Lưu '+buf.length+' dòng vào file gốc</button></div>':"";
      $("obuf").querySelectorAll("[data-rm]").forEach(function(b){ b.onclick=function(){ buf.splice(+b.dataset.rm,1); paint(); }; });
      if($("osave")) $("osave").onclick=function(){ queue(buf.map(function(b){ return {s:"tt", op:"add", npp:D.npps[S.npp], m:b.m, code:b.code, q:b.q, day:b.day, note:b.note}; }), "Thêm đơn thực tế"); toast("Đã lưu "+buf.length+" dòng."); buf=[]; vOrders(); }; }
    $("oadd").onclick=function(){
      var c=K(($("oc").value||"").split(" · ")[0]), q=+String($("oq").value||"").replace(/[.,\s]/g,""), d=$("od").value;
      if(!CAT[c]){ toast("Chọn mã trong danh mục."); return; } if(!(q>0)){ toast("Nhập số lượng."); return; }
      var ym=d?(+d.slice(0,4)*100+ +d.slice(5,7)):m, day=d?d.slice(8,10)+"/"+d.slice(5,7)+"/"+d.slice(0,4):"";
      buf.push({code:CAT[c].code, q:q, m:ym, day:day, note:$("on").value.trim()}); $("oc").value=""; $("oq").value=""; $("oc").focus(); paint();
    };
  }
}
function flowCardQ(t,col,v){ return '<div class="card flow"><div class="lb"><i style="background:'+col+'"></i>'+t+'</div><div class="v num">'+n0(v)+'</div></div>'; }

/* ═════════ PHÂN QUYỀN (Admin) ═════════ */
var ACL=null;
function vAcl(){
  if(!ACL){ $("main").innerHTML='<div class="boot">Đang đọc phân quyền…</div>';
    getJSON(API+"?"+qs({action:"dtAccess", tk:tk()})).then(function(d){ if(d&&d.ok){ ACL=d; vAcl(); } else $("main").innerHTML='<div class="note err">'+esc((d&&d.error)||"Không đọc được.")+'</div>'; },
      function(e){ $("main").innerHTML='<div class="note err">'+esc(e.message)+'</div>'; }); return; }
  var rows=ACL.rows.map(function(r){ return {who:r.who, npps:r.npps, role:r.role, note:r.note}; });
  function paint(){
    var h='<h2>Phân quyền app Dự trù NPP</h2><p class="sub">Admin · Giám đốc · Trưởng bộ phận luôn xem + sửa mọi NPP. Người khác chỉ thấy NPP được cấp ở đây (lưu ở sheet "PHÂN QUYỀN APP" của file gốc). Nhà phân phối không đăng nhập app — mỗi NPP chỉ nhận file của chính mình.</p>'+
      '<datalist id="ppl">'+(ACL.people||[]).map(function(p){ return '<option value="'+esc(p.pic)+'">'+esc([p.dept,p.title].filter(Boolean).join(" · "))+'</option>'; }).join("")+'<option value="*">Mọi nhân sự</option></datalist>'+
      '<div class="tw"><table class="tbl"><tr><th>Người dùng</th><th>NPP được xem</th><th>Quyền</th><th>Ghi chú</th><th></th></tr>'+rows.map(function(r,i){
        var sel=/^(all|\*|tất cả)$/i.test(r.npps)?ACL.npps.slice():r.npps.split(/[,;]/).map(function(s){ return s.trim(); });
        return '<tr data-i="'+i+'"><td><input class="inp" list="ppl" data-f="who" value="'+esc(r.who)+'" style="width:170px"></td><td>'+ACL.npps.map(function(n){ var on=sel.some(function(s){ return K(s)===K(n); }); return '<label class="sm" style="margin-right:10px;white-space:nowrap"><input type="checkbox" data-n="'+esc(n)+'"'+(on?" checked":"")+'> '+esc(n)+'</label>'; }).join("")+'</td>'+
          '<td><select class="inp" data-f="role"><option value="view">Xem</option><option value="edit"'+(r.role==="edit"?" selected":"")+'>Xem + sửa</option></select></td><td><input class="inp" data-f="note" value="'+esc(r.note)+'"></td><td><button class="lnk sm" data-rm="'+i+'" type="button">Xoá</button></td></tr>'; }).join("")+
      '</table></div><div class="row" style="margin-top:10px"><button class="btn" id="aadd" type="button">+ Thêm người</button><button class="btn pri" id="asave" type="button">Lưu phân quyền</button><span class="sm mut" id="amsg"></span></div>';
    $("main").innerHTML=h;
    function grab(){ $("main").querySelectorAll("tr[data-i]").forEach(function(tr){ var r=rows[+tr.dataset.i]; r.who=tr.querySelector('[data-f="who"]').value.trim(); r.role=tr.querySelector('[data-f="role"]').value; r.note=tr.querySelector('[data-f="note"]').value.trim();
      var ns=[].slice.call(tr.querySelectorAll("[data-n]")).filter(function(x){ return x.checked; }).map(function(x){ return x.dataset.n; }); r.npps=ns.length===ACL.npps.length?"ALL":ns.join(", "); }); }
    $("aadd").onclick=function(){ grab(); rows.push({who:"", npps:"", role:"view", note:""}); paint(); };
    $("main").querySelectorAll("[data-rm]").forEach(function(b){ b.onclick=function(){ grab(); rows.splice(+b.dataset.rm,1); paint(); }; });
    $("asave").onclick=function(){ grab(); $("amsg").textContent="Đang lưu…";
      post({action:"dtAccessSave", tk:tk(), rows:rows.filter(function(r){ return r.who && r.npps; })}).then(function(d){ if(d&&d.ok){ ACL=d; toast("Đã lưu phân quyền."); vAcl(); } else $("amsg").textContent=(d&&d.error)||"Lỗi"; },function(e){ $("amsg").textContent=e.message; }); };
  }
  paint();
}

/* ═════════ HÀNG ĐỢI GHI (hiện ngay, ghi nền theo thứ tự, lỗi mạng tự thử lại cùng rid) ═════════ */
function applyOps(ops, overlay){
  ops.forEach(function(op){
    var ni=D.npps.indexOf(op.npp); if(ni<0) return;
    if(op.s==="tt"){
      if(op.op==="del"){ D.tt=D.tt.filter(function(r){ return !(r[0]===ni && r[4]===op.row); }); }
      else if(!overlay || !op._done) D.tt.push([ni, op.m, op.code, op.q, 0, op.day||"", op.note||"", "tmp"]);
      return;
    }
    var arr=D[op.s], k=K(op.code);
    D[op.s]=arr.filter(function(r){ return !(r[0]===ni && r[1]===op.m && K(r[2])===k); });
    if(op.q!==null && op.q!==undefined && !(op.s==="dt" && op.q===0)) D[op.s].push([ni, op.m, op.code, op.q, 0, "", ""]);
  });
}
function queue(ops, why){
  var job={rid:rid(), ops:ops, why:why, at:Date.now(), err:""};
  OB.push(job); saveOB();
  applyOps(ops,false); index(); header(); render(); obChip(); obRun();
}
function saveOB(){ try{ localStorage.setItem(LS_OB, JSON.stringify(OB)); }catch(_){} }
function obChip(){
  var e=$("chip-q"); if(!OB.length){ e.hidden=true; return; }
  var bad=OB.filter(function(j){ return j.err && j.fatal; }).length;
  e.hidden=false; e.className="qchip"+(bad?" err":"");
  e.textContent=bad?("Chưa ghi được "+bad+" thay đổi — bấm để xem"):("Đang ghi "+OB.length+" thay đổi vào file gốc…");
  e.onclick=function(){ modal('<h3>Thay đổi đang chờ ghi</h3>'+OB.map(function(j,i){ return '<div class="note'+(j.fatal?" err":"")+'" style="margin:6px 0"><b>'+esc(j.why||"Lưu")+'</b> · '+j.ops.length+' ô'+(j.err?'<br>'+esc(j.err):'')+(j.fatal?'<div class="row" style="margin-top:6px"><button class="btn sm" data-retry="'+i+'" type="button">Thử lại</button><button class="btn sm" data-drop="'+i+'" type="button">Bỏ</button></div>':'')+'</div>'; }).join("")+'<div class="row"><button class="btn" data-x="1" type="button">Đóng</button></div>');
    document.querySelectorAll("[data-retry]").forEach(function(b){ b.onclick=function(){ var j=OB[+b.dataset.retry]; j.fatal=false; j.err=""; saveOB(); closeModal(); obChip(); obRun(); }; });
    document.querySelectorAll("[data-drop]").forEach(function(b){ b.onclick=function(){ OB.splice(+b.dataset.drop,1); saveOB(); closeModal(); obChip(); load(true); }; }); };
}
function obRun(){
  if(obBusy || !OB.length || !API || !tk()) return;
  var j=OB.filter(function(x){ return !x.fatal; })[0]; if(!j) return;
  obBusy=true;
  post({action:"dtSave", tk:tk(), rid:j.rid, ops:j.ops, why:j.why}).then(function(d){
    obBusy=false;
    if(d && d.ok){
      OB=OB.filter(function(x){ return x!==j; }); saveOB();
      if(d.skipped && d.skipped.length){ j.err="Máy chủ bỏ qua "+d.skipped.length+" ô: "+d.skipped.slice(0,3).join("; "); toast(j.err, 7000); }
      obChip(); if(!OB.length) load(true); else obRun(); return;
    }
    if(d && d.code==="BUSY"){ j.err=d.error; obChip(); setTimeout(obRun, 5000); return; }
    j.err=(d&&d.error)||"Lỗi không rõ"; j.fatal=true; saveOB(); obChip();
    if(d && d.code==="AUTH"){ lg.err=d.error; }
  },function(e){ obBusy=false; j.err="Mất kết nối ("+e.message+") — tự thử lại."; j.tries=(j.tries||0)+1; saveOB(); obChip(); setTimeout(obRun, Math.min(60000, 2000*Math.pow(2, j.tries))); });
}
window.addEventListener("online", obRun);

/* ═════════ HỘP THOẠI ═════════ */
function modal(html){ var m=$("modal"); m.innerHTML='<div class="mbox"><button class="x" data-x="1" type="button" aria-label="Đóng">×</button>'+html+'</div>'; m.hidden=false;
  m.querySelectorAll("[data-x]").forEach(function(b){ b.onclick=closeModal; }); m.onclick=function(e){ if(e.target===m) closeModal(); }; return m; }
function closeModal(){ $("modal").hidden=true; $("modal").innerHTML=""; }
function confirmBox(t, ok){ modal('<h3>Xác nhận</h3><p>'+esc(t)+'</p><div class="row"><button class="btn" data-x="1" type="button">Huỷ</button><button class="btn pri" id="cf-ok" type="button">Đồng ý</button></div>'); $("cf-ok").onclick=function(){ closeModal(); ok(); }; }
function help(){
  var st=D?D.set:{watch:.1,high:.2,lead:3,hanDay:5,tbN:6};
  modal('<h3>Cách tính</h3>'+
    '<p><b>3 nguồn số liệu</b> (file gốc "Dự trù NPP Dashboard"):</p><ol class="sm"><li><b>Dự trù cố định</b> — hằng tháng NPP gửi cho tháng thứ '+st.lead+' kế tiếp (hạn ngày '+String(st.hanDay).padStart(2,"0")+'). Số cố định: MMH chuẩn bị hàng, NPP cam kết lấy hết.</li>'+
    '<li><b>Đặt hàng thực tế</b> — MMH cập nhật; NPP đặt nhiều lần trong tháng, mỗi lần 1 dòng.</li><li><b>Đặt hàng dự kiến</b> — nhu cầu thật nhìn từ bây giờ, sửa bất cứ lúc nào cho tháng hiện tại trở đi.</li></ol>'+
    '<p><b>Đặt hàng dùng để tính</b> mỗi tháng: tháng đã qua có đơn thực tế ⇒ thực tế; tháng hiện tại và các tháng tới ⇒ số lớn hơn giữa thực tế và dự kiến.</p>'+
    '<p><b>Dự trù chưa đặt hàng</b> (cộng dồn từ tháng 09): mỗi tháng = max(0, còn tháng trước + dự trù − đặt hàng). Đây là hàng MMH đã chuẩn bị mà NPP chưa lấy.</p>'+
    '<p><b>Cảnh báo</b> tại tháng đang xem = dự trù chưa đặt hàng ÷ tổng dự trù từ đầu kỳ: <span class="pill lv-high">Cao</span> ≥ '+pct(st.high)+' · <span class="pill lv-watch">Theo dõi</span> '+pct(st.watch)+'–'+pct(st.high)+' · <span class="pill lv-ok">Ổn</span> dưới '+pct(st.watch)+' · <span class="pill lv-none">Chưa dự trù</span> có đặt hàng mà chưa gửi dự trù · <span class="pill lv-dead">Không có đơn 6 tháng</span> còn dự trù chưa đặt mà '+st.tbN+' tháng không có đơn.</p>'+
    '<p><b>Đề xuất dự trù tháng T</b> = max(0, dự kiến tháng T − dự trù chưa đặt hàng dự kiến đến hết tháng T−1). Dự trù đúng đề xuất ⇒ hết tháng T không còn hàng chờ.</p>'+
    '<p class="sm mut">"≈ tháng" = dự trù chưa đặt ÷ số đặt trung bình '+st.tbN+' tháng gần nhất: hàng chờ đủ cho bao nhiêu tháng nữa. Ngưỡng, lead time lấy ở sheet CÀI ĐẶT của file gốc.</p>'+
    '<div class="row"><button class="btn pri" data-x="1" type="button">Đã hiểu</button></div>');
}

/* ═════════ EXCEL CHO NPP (tải thư viện khi cần) ═════════ */
var XL={ open:function(){ if(!D) return; loadXL().then(function(){ window.DTXL.open(api()); }, function(e){ toast("Không tải được bộ tạo Excel ("+e.message+")."); }); } };
function loadXL(){ if(window.DTXL && window.ExcelJS) return Promise.resolve();
  function sc(src){ return new Promise(function(res,rej){ var s=document.createElement("script"); s.src=src; s.onload=res; s.onerror=function(){ rej(new Error(src)); }; document.head.appendChild(s); }); }
  return (window.ExcelJS?Promise.resolve():sc("vendor/exceljs.min.js")).then(function(){ return window.DTXL?null:sc("xl.js?v="+(window.DT_VER||"")); }); }
/* hàm cho xl.js */
function api(){ return { D:D, I:I, CAT:CAT, S:S, K:K, g:g, has:has, val:val, calc:calc, series:series, avgOf:avgOf, activeCodes:activeCodes, planCalc:planCalc,
  addM:addM, lbl:lbl, range:range, fy0:fy0, n0:n0, pct:pct, esc:esc, money:money, pill:pill, LV:LV, hintOf:hintOf, modal:modal, closeModal:closeModal, toast:toast, queue:queue,
  log:function(what,npp,detail,n){ return post({action:"dtLog", tk:tk(), what:what, npp:npp, detail:detail, n:n}).catch(function(){}); } }; }
window.DT_DEBUG=function(){ return api(); };

/* ═════════ KHỞI ĐỘNG ═════════ */
function start(){ if(!tk()){ gate(); return; } userChip(); load(); }
start();
})();
