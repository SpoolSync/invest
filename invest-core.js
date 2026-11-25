/* Investments: the logic with no screen code, so it can be tested on its own.
   Works for Canada, the US, the UK and India: account types, contribution limits and the home currency follow
   the person's Pixora country. Prices come from a public daily file matched on the phone, so nothing
   about anyone's holdings ever leaves the phone unencrypted. */
(function(root){
"use strict";
/* Every account type the app knows. Each country shows its own; data from any country stays readable. */
var TYPES=[
  ["tfsa","TFSA"],["rrsp","RRSP"],["fhsa","FHSA"],["resp","RESP"],["lira","LIRA"],["nonreg","Non-registered"],
  ["k401","401(k)"],["roth401k","Roth 401(k)"],["ira","Traditional IRA"],["roth","Roth IRA"],["hsa","HSA"],["p529","529 plan"],["brokerage","Brokerage (taxable)"],
  ["isa","Stocks & Shares ISA"],["cashisa","Cash ISA"],["lisa","Lifetime ISA"],["sipp","SIPP / personal pension"],["wpp","Workplace pension"],["gia","General investment account"],["jisa","Junior ISA"],
  ["demat","Demat (stocks, ETFs)"],["mf","Mutual funds"],["ppf","PPF"],["epf","EPF / VPF"],["nps","NPS"],["fd","Fixed deposit"],["ssy","Sukanya Samriddhi"],
  ["cash","Cash / savings"],["crypto","Crypto"],["other","Other"]];
var CLASSES=[["ca","Canadian stocks"],["us","US stocks"],["uk","UK stocks"],["in","Indian stocks"],["intl","International stocks"],["global","All-in-one / global"],["bond","Bonds / debt"],["gold","Gold"],["cash","Cash"],["crypto","Crypto"],["other","Other"]];
/* What each country sees and tracks.
   track: types with a yearly contribution limit the app keeps count of.
   fy: "apr" for India's April-March financial year, otherwise the calendar year. */
var COUNTRY={
  CA:{cur:"CAD",types:["tfsa","rrsp","fhsa","resp","lira","nonreg","cash","crypto","other"],classes:["ca","us","intl","global","bond","gold","cash","crypto","other"],track:["tfsa","rrsp","fhsa"],fy:"cal",def:"tfsa",
    fill:{"global:100":"One all-in-one ETF","us:45,ca:25,intl:20,bond:10":"90/10","us:35,ca:25,intl:20,bond:20":"80/20","us:25,ca:20,intl:15,bond:40":"60/40"}},
  US:{cur:"USD",types:["k401","roth401k","ira","roth","hsa","p529","brokerage","cash","crypto","other"],classes:["us","intl","global","bond","gold","cash","crypto","other"],track:["k401","ira","hsa"],fy:"cal",def:"roth",
    fill:{"global:100":"One all-in-one fund","us:60,intl:30,bond:10":"90/10","us:55,intl:25,bond:20":"80/20","us:40,intl:20,bond:40":"60/40"}},
  GB:{cur:"GBP",types:["isa","cashisa","lisa","sipp","wpp","gia","jisa","cash","crypto","other"],classes:["uk","us","intl","global","bond","gold","cash","crypto","other"],track:["isa","cashisa","lisa","pension"],fy:"apr6",def:"isa",
    fill:{"global:100":"One all-in-one fund","uk:20,us:45,intl:25,bond:10":"90/10","uk:20,us:40,intl:20,bond:20":"80/20","uk:15,us:30,intl:15,bond:40":"60/40"}},
  IN:{cur:"INR",types:["demat","mf","ppf","epf","nps","fd","ssy","cash","crypto","other"],classes:["in","us","intl","bond","gold","cash","crypto","other"],track:["ppf","taxsave"],fy:"apr",def:"mf",
    fill:{"in:70,us:10,bond:10,gold:10":"Equity-heavy","in:55,us:10,bond:25,gold:10":"Balanced","in:35,bond:50,gold:15":"Conservative"}}
};
/* Yearly limits, checked Nov 2026.
   Canada (CRA): TFSA $7,000 for 2026; RRSP 18% of earned income up to $33,810 (2026) / $35,390 (2027); FHSA $8,000 a year, $40,000 lifetime.
   US (IRS): 401(k) $24,500 (2026) / $25,500 (2027); IRA $7,500 (2026 and 2027, traditional and Roth combined);
     HSA $4,400 self-only / $8,750 family (2026), $4,500 / $9,000 (2027). Catch-up amounts for 50+ (55+ for HSA) are extra.
   UK (HMRC/GOV.UK): ISA allowance £20,000 a tax year across all ISAs; Lifetime ISA £4,000 within it;
     cash ISAs £12,000 for under-65s from 6 April 2027; pension annual allowance £60,000 (all contributions, including employer and tax relief).
   India: PPF Rs 1.5 lakh per financial year; tax-saving investments under section 123 (80C before April 2026)
     Rs 1.5 lakh, old tax regime only. */
var LIMITS={tfsa:{2024:7000,2025:7000,2026:7000},rrsp:{2024:31560,2025:32490,2026:33810,2027:35390},fhsa:{year:8000,life:40000},
  k401:{2025:23500,2026:24500,2027:25500},ira:{2025:7000,2026:7500,2027:7500},hsa:{2025:4300,2026:4400,2027:4500},hsaFamily:{2025:8550,2026:8750,2027:9000},
  ppf:{any:150000},taxsave:{any:150000},
  isa:{any:20000},lisa:{any:4000},cashisa:{2024:20000,2025:20000,2026:20000,2027:12000,2028:12000,2029:12000,2030:12000},pension:{any:60000}};
var TRACK_LABEL={isa:"ISA allowance (all ISAs)",cashisa:"Cash ISA",lisa:"Lifetime ISA",pension:"Pension annual allowance",tfsa:"TFSA",rrsp:"RRSP",fhsa:"FHSA",k401:"401(k)",ira:"IRA (traditional + Roth)",hsa:"HSA",ppf:"PPF",taxsave:"Tax-saving (sec. 123 / 80C)"};
var ALL_TRACK=["tfsa","rrsp","fhsa","k401","ira","hsa","ppf","taxsave","isa","cashisa","lisa","pension"];
function n(v){v=Number(v);return isFinite(v)?v:0;}
function r2(v){return Math.round(v*100)/100;}
function country(state){var c=state&&state.country;if(COUNTRY[c])return c;var PC=root.PixoraCountry;return PC?PC.get():"CA";}
function base(state){return COUNTRY[country(state)].cur;}
/* Currencies are kept as "how many Canadian dollars one unit is worth" (that's what the daily file has),
   so any currency converts to any home currency. */
var CADPER={CAD:1,USD:1.38,INR:0.0157,EUR:1.5,GBP:1.8};
var CURS=["CAD","USD","GBP","INR","EUR"];
function cadPer(state,c){if(c==="CAD")return 1;if(c==="USD")return n(state.usdcad)||CADPER.USD;var f=state.fxc&&n(state.fxc[c]);return f>0?f:(CADPER[c]||1);}
/* Value of 1 unit of currency c in the home currency. */
function rate(state,c){var b=base(state);c=c||b;return c===b?1:cadPer(state,c)/cadPer(state,b);}
/* Value of one holding in the home currency. */
function hValue(h,state){return n(h.units)*n(h.price)*rate(state||{},h.cur);}
function isoToday(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
/* Book cost is entered in the home currency at the time (in Canada, the way brokers report ACB);
   costCur remembers which, so switching country later still converts it correctly. */
function hCost(h,state){return n(h.cost)*rate(state||{},h.costCur||"CAD");}
function totals(state){
  var t={value:0,cost:0,byType:{},byClass:{},byAccount:{},stale:0};
  (state.accounts||[]).forEach(function(a){
    var cash=n(a.cashBal)*rate(state,a.cur),av=cash,ac=cash;
    (a.holdings||[]).forEach(function(h){var v=hValue(h,state),c=hCost(h,state);av+=v;ac+=c;t.byClass[h.cls||"other"]=(t.byClass[h.cls||"other"]||0)+v;if(h.priceAt&&daysBetween(h.priceAt,state.today||isoToday())>7)t.stale++;});
    if(cash)t.byClass.cash=(t.byClass.cash||0)+cash;
    t.value+=av;t.cost+=ac;t.byType[a.type]=(t.byType[a.type]||0)+av;t.byAccount[a.id]={value:r2(av),cost:r2(ac)};
  });
  t.value=r2(t.value);t.cost=r2(t.cost);t.gain=r2(t.value-t.cost);t.gainPct=t.cost?r2(100*t.gain/t.cost):0;
  return t;
}
function daysBetween(a,b){var p=a.split("-"),q=b.split("-");return Math.round((Date.UTC(+q[0],+q[1]-1,+q[2])-Date.UTC(+p[0],+p[1]-1,+p[2]))/86400000);}
/* The contribution year a date falls in: the calendar year, or for India the financial year
   (April to March), named by the year it starts in (FY 2026-27 is 2026). */
function period(state,date){var y=+String(date).slice(0,4),m=+String(date).slice(5,7),d=+String(date).slice(8,10),fy=COUNTRY[country(state)].fy;
  if(fy==="apr")return m<4?y-1:y;
  if(fy==="apr6")return m<4||(m===4&&d<6)?y-1:y;   // UK tax year: 6 April to 5 April
  return y;}
function periodNow(state,today){return period(state,today||isoToday());}
function periodLabel(state,p){var fy=COUNTRY[country(state)].fy;return fy==="apr"?"FY "+p+"-"+String(p+1).slice(2):fy==="apr6"?p+"/"+String(p+1).slice(2):String(p);}
/* The limit the app assumes when the person hasn't entered their own room. Canada uses the room from
   the CRA account (it carries forward), so there's no default there. */
function defaultRoom(state,k,p){
  var L=LIMITS[k];if(!L)return null;
  if(k==="hsa"&&state.hsaFamily)L=LIMITS.hsaFamily;
  if(L.any!=null)return L.any;
  if(k==="tfsa"||k==="rrsp"||k==="fhsa")return null;
  return L[p]!=null?L[p]:null;
}
/* Room left in a contribution year for each tracked type: the room entered (or the standard limit),
   minus contributions logged in that year. TFSA withdrawals come back next January 1.
   In India, PPF deposits also count toward the tax-saving total. In the UK, money paid into any ISA
   (cash, Lifetime or stocks and shares) counts toward the £20,000 allowance. */
function room(state,p){
  var out={},R=state.room||{};
  COUNTRY[country(state)].track.forEach(function(k){
    var start=R[k]&&R[k][p],dflt=false;
    if(start==null||start===""){start=defaultRoom(state,k,p);dflt=true;}
    if(start==null)return;
    var put=0,took=0;
    (state.moves||[]).forEach(function(m){if((m.type!==k&&!(k==="taxsave"&&m.type==="ppf")&&!(k==="isa"&&(m.type==="cashisa"||m.type==="lisa")))||period(state,m.date)!==p)return;if(m.kind==="in")put+=n(m.amount);else if(m.kind==="out")took+=n(m.amount);});
    out[k]={start:n(start),contributed:r2(put),withdrawn:r2(took),left:r2(n(start)-put),backJan1:k==="tfsa"?r2(took):0,standard:dflt};
  });
  return out;
}
/* The last day contributions can count for a contribution year, as an ISO date. */
function deadline(state,k,p){
  var c=country(state);
  if(c==="CA"&&k==="rrsp"){var d=new Date(p+1,0,1);d.setDate(d.getDate()+59);return iso(d);}
  if(c==="US"&&(k==="ira"||k==="hsa"))return taxDay(p+1);
  if(c==="US"&&k==="k401")return p+"-12-31";
  if(c==="IN")return (p+1)+"-03-31";
  if(c==="GB")return (p+1)+"-04-05";
  return p+"-12-31";
}
function iso(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
/* US filing day: April 15, moved to the next weekday when it lands on a weekend. */
function taxDay(y){var d=new Date(y,3,15);while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1);return iso(d);}
function dividends(state,year){var t=0,by={};(state.divs||[]).forEach(function(d){if(String(d.date).slice(0,4)!==String(year))return;var v=n(d.amount)*rate(state,d.cur);t+=v;by[d.sym||"?"]=(by[d.sym||"?"]||0)+v;});return {total:r2(t),by:by};}

/* ---------- broker CSV ---------- */
function csvRows(text){
  var rows=[],row=[],f="",q=false,i,c;text=String(text||"").replace(/^﻿/,"");
  for(i=0;i<text.length;i++){c=text[i];
    if(q){if(c==='"'){if(text[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
    else if(c==='"')q=true;else if(c===","||c===";"||c==="\t"){row.push(f);f="";}
    else if(c==="\n"||c==="\r"){if(c==="\r"&&text[i+1]==="\n")i++;row.push(f);rows.push(row);row=[];f="";}
    else f+=c;}
  if(f!==""||row.length){row.push(f);rows.push(row);}
  return rows.filter(function(r){return r.some(function(x){return String(x).trim();});});
}
var COLS={sym:/^(symbol|ticker|security symbol|stock symbol|code|instrument|trading symbol|isin|scheme code)$/i,name:/^(name|description|security|security name|security description|holding|scheme name|fund name|scheme|company name|stock name)$/i,
  units:/^(quantity|qty|qty\.|shares|units|position|quantity held|quantity available|balance units)$/i,cost:/^(book value|book cost|total cost|cost basis|book value \(cad\)|book value \(cdn\)|average cost total|total book value|cost|invested|invested value|invested amount|buy value)$/i,
  avg:/^(average cost|avg cost|average price|avg price|average cost per share|acb per share|avg\. cost|avg\. price|average buy price|avg nav|average nav)$/i,price:/^(price|market price|last price|current price|last|ltp|nav|current nav|close price|closing price)$/i,
  value:/^(market value|value|current value|market value \(cad\)|total market value|cur\. val|present value)$/i,cur:/^(currency|market currency|curr|security currency|market price currency|price currency)$/i,acct:/^(account|account number|account type|account name)$/i};
function num(s){s=String(s==null?"":s).replace(/[$,\s]/g,"").replace(/^\((.*)\)$/,"-$1").replace(/CAD|USD|INR|GBP|Rs\.?|₹|£/gi,"");var v=parseFloat(s);return isFinite(v)?v:null;}
/* Finds the header row and returns holdings: [{sym,name,units,cost,price,cur,acct}] plus what was understood. */
function parseHoldings(text,defCur){defCur=CURS.indexOf(defCur)>=0?defCur:"CAD";
  var rows=csvRows(text),hi=-1,map={};
  for(var i=0;i<Math.min(rows.length,15);i++){
    var m={};rows[i].forEach(function(h,j){var t=String(h).trim(),t2=t.replace(/\s*\((cad|cdn|usd|gbp|gbx|inr|eur|£|\$|₹)\)\s*$/i,"");for(var k in COLS)if(m[k]==null&&(COLS[k].test(t)||COLS[k].test(t2)))m[k]=j;});
    if((m.sym!=null||m.name!=null)&&m.units!=null){hi=i;map=m;break;}
  }
  if(hi<0)return {ok:false,why:"Couldn't find columns for the symbol and quantity. Export \"holdings\" or \"positions\" from your broker as CSV."};
  var out=[];
  rows.slice(hi+1).forEach(function(r){
    function g(k){return map[k]!=null?r[map[k]]:null;}
    var units=num(g("units")),sym=String(g("sym")||"").trim().toUpperCase(),name=String(g("name")||"").trim();
    if(units==null||units===0||(!sym&&!name))return;
    if(/^(total|cash|subtotal)/i.test(sym||name)&&!units)return;
    var price=num(g("price")),value=num(g("value")),cost=num(g("cost")),avg=num(g("avg"));
    if(price==null&&value!=null)price=value/units;
    if(cost==null&&avg!=null)cost=avg*units;
    var cc=String(g("cur")||"").toUpperCase(),cur=/USD/.test(cc)?"USD":/INR/.test(cc)?"INR":/GBP|GBX|£/.test(cc)?"GBP":/CAD|CDN/.test(cc)?"CAD":defCur;
    out.push({sym:sym.slice(0,20),name:name.slice(0,80),units:units,cost:cost==null?null:r2(cost),price:price==null?null:Math.round(price*10000)/10000,cur:cur,acct:String(g("acct")||"").trim().slice(0,40)});
  });
  return {ok:out.length>0,rows:out,found:Object.keys(map),why:out.length?"":"The file had the right columns but no holdings in it."};
}
/* Guess an asset class from the symbol: .TO / .V / -CT are Canadian listings. */
function guessClass(sym,cur){
  var s=String(sym||"").toUpperCase();
  if(/^(GOLDBEES|GOLDIETF|HDFCGOLD|SETFGOLD|GOLD1|AXISGOLD|SGB|GLD|IAU|CGL|MNT|PHYS|SILVERBEES)/.test(s.replace(/^(NSE|BSE):/,"").replace(/\..*$/,"")))return "gold";
  if(/^(LIQUIDBEES|LIQUIDCASE|LIQUIDETF)/.test(s.replace(/\..*$/,"")))return "cash";
  if(/^(MON100|MAFANG|MASPTOP50|HNGSNGBEES|NASDAQ100)/.test(s.replace(/\..*$/,"")))return "us";
  var lse=s.replace(/^LSE:/,"").replace(/\.L$/,"");
  if(/\.L$|^LSE:/.test(s)||cur==="GBP"){
    if(/^(VWRL|VWRP|SWDA|HMWO|FWRG|VHVG|SSAC|IWRD|XDWD|ACWI|LGGG)$/.test(lse))return "global";
    if(/^(VUSA|VUAG|CSP1|CSPX|IUSA|EQQQ|CNDX|XNAQ|SPXP|IITU|IUIT)$/.test(lse))return "us";
    if(/^(VEVE|VFEM|EMIM|VFEG|VJPN|VERX|VEUR|IJPN|XMME)$/.test(lse))return "intl";
    if(/^(IGLT|VGOV|SLXX|VAGP|IGLS|INXG|AGBP|VECP|IBTS|GLTS)$/.test(lse))return "bond";
    if(/^(SGLN|IGLN|PHGP|SGLD)$/.test(lse))return "gold";
    if(/^(CSH2|XSTR|ERNS)$/.test(lse))return "cash";
    return "uk";
  }
  if(/\.(NS|BO)$|^(NSE|BSE):|^INF[A-Z0-9]{9}$|^\d{6}$/.test(s)||cur==="INR")return "in";
  if(/BTC|ETH|SOL|DOGE|-USD$/.test(s)&&!/\.(TO|V|NE)$/.test(s))return "crypto";
  if(/^(XBB|ZAG|VAB|ZDB|XSB|ZFL|VSB|BND|AGG|TLT|IEF|SHY)/.test(s.replace(/\..*$/,"")))return "bond";
  if(/^(CASH|PSA|HISA|CSAV|ZMMK|MNY)/.test(s.replace(/\..*$/,"")))return "cash";
  if(/^(XEF|VIU|ZEA|IEFA|VEA|VXUS|XEC|VEE|ZEM|EEM|IEMG)/.test(s.replace(/\..*$/,"")))return "intl";
  /* Canadian-listed ETFs that hold US or global stocks */
  if(/^(VFV|ZSP|XUS|XSP|HXS|VSP|ZQQ|QQC|XQQ|HXQ|ZNQ|VUN|VUS|XUU|ZUE|TEC|XEQT|VEQT|ZEQT|VGRO|XGRO|VBAL|XBAL|ZGRO|ZBAL)$/.test(s.replace(/\..*$/,"")))return /^(XEQT|VEQT|ZEQT|VGRO|XGRO|VBAL|XBAL|ZGRO|ZBAL)$/.test(s.replace(/\..*$/,""))?"global":"us";
  if(/\.(TO|V|NE|CN)$|-CT$/.test(s))return "ca";
  return cur==="USD"?"us":"ca";
}
/* Kind of an Indian mutual fund from its scheme name. */
function fundClass(name){
  var s=String(name||"");
  if(/overnight|liquid|money market/i.test(s))return "cash";
  if(/gold|silver/i.test(s))return "gold";
  if(/nasdaq|s&p 500|us equity|u\.s\.|global|overseas|international|world|fang|greater china|japan|emerging/i.test(s))return /nasdaq|s&p|us equity|u\.s\.|fang/i.test(s)?"us":"intl";
  if(/debt|bond|gilt|credit|duration|corporate|banking (and|&) psu|floater|income fund|fixed maturity|treasury|g-sec|sdl|savings fund/i.test(s)&&!/hybrid|balanced|equity savings|multi asset/i.test(s))return "bond";
  return "in";
}
/* An Indian mutual fund: ISIN (INF...) or AMFI scheme code (6 digits). */
function isFund(sym){return /^INF[A-Z0-9]{9}$|^\d{6}$/.test(String(sym||"").trim().toUpperCase());}
function clean(s){
  s=s&&typeof s==="object"?s:{};
  function str(v,k){return String(v==null?"":v).slice(0,k);}
  function cur(c,d){return CURS.indexOf(c)>=0?c:d;}
  var ty=TYPES.map(function(t){return t[0];}),cl=CLASSES.map(function(c){return c[0];});
  var out={ts:+s.ts||0,usdcad:n(s.usdcad)>0.5&&n(s.usdcad)<3?n(s.usdcad):1.38,fxc:{},hsaFamily:!!s.hsaFamily,autoPrices:s.autoPrices!==false,targets:{},accounts:[],moves:[],divs:[],room:{},snaps:[]};
  if(s.country&&COUNTRY[s.country]){out.country=s.country;out.countryAt=+s.countryAt||0;}
  if(s.fxc&&typeof s.fxc==="object")CURS.forEach(function(c){var v=n(s.fxc[c]);if(v>0&&c!=="CAD"&&c!=="USD")out.fxc[c]=v;});
  var home=base(out);
  (Array.isArray(s.accounts)?s.accounts:[]).slice(0,60).forEach(function(a){if(!a||!a.id)return;
    out.accounts.push({id:str(a.id,24),name:str(a.name,60)||"Account",type:ty.indexOf(a.type)>=0?a.type:"other",inst:str(a.inst,40),cur:cur(a.cur,home),cashBal:n(a.cashBal),
      holdings:(Array.isArray(a.holdings)?a.holdings:[]).slice(0,300).filter(function(h){return h&&h.id;}).map(function(h){return {id:str(h.id,24),sym:str(h.sym,20),name:str(h.name,80),units:n(h.units),cost:n(h.cost),price:n(h.price),priceAt:/^\d{4}-\d{2}-\d{2}$/.test(h.priceAt)?h.priceAt:"",cur:cur(h.cur,home),costCur:cur(h.costCur,"CAD"),cls:cl.indexOf(h.cls)>=0?h.cls:"other",auto:h.auto?1:0};})});});
  (Array.isArray(s.moves)?s.moves:[]).slice(0,3000).forEach(function(m){if(m&&m.id&&/^\d{4}-\d{2}-\d{2}$/.test(m.date)&&ALL_TRACK.indexOf(m.type)>=0)out.moves.push({id:str(m.id,24),date:m.date,type:m.type,kind:m.kind==="out"?"out":"in",amount:Math.abs(n(m.amount)),acct:str(m.acct,24),note:str(m.note,80)});});
  (Array.isArray(s.divs)?s.divs:[]).slice(0,5000).forEach(function(d){if(d&&d.id&&/^\d{4}-\d{2}-\d{2}$/.test(d.date))out.divs.push({id:str(d.id,24),date:d.date,sym:str(d.sym,20),amount:Math.abs(n(d.amount)),cur:cur(d.cur,home),acct:str(d.acct,24)});});
  if(s.room&&typeof s.room==="object")ALL_TRACK.forEach(function(k){var y=s.room[k];if(y&&typeof y==="object"){out.room[k]={};Object.keys(y).forEach(function(yr){if(/^\d{4}$/.test(yr)&&y[yr]!==""&&y[yr]!=null)out.room[k][yr]=n(y[yr]);});}});
  (Array.isArray(s.snaps)?s.snaps:[]).slice(-800).forEach(function(x){if(x&&/^\d{4}-\d{2}-\d{2}$/.test(x.d))out.snaps.push({d:x.d,v:r2(n(x.v)),c:r2(n(x.c))});});
  if(s.targets&&typeof s.targets==="object")Object.keys(s.targets).forEach(function(k){var v=n(s.targets[k]);if(v>0&&v<=100&&cl.indexOf(k)>=0)out.targets[k]=v;});
  return out;
}
/* One snapshot a day of total value, for the history line. */
function snap(state,day){var t=totals(state),last=state.snaps[state.snaps.length-1];if(last&&last.d===day){last.v=t.value;last.c=t.cost;}else state.snaps.push({d:day,v:t.value,c:t.cost});if(state.snaps.length>800)state.snaps.splice(0,state.snaps.length-800);}
/* ---- automatic prices ----
   prices.json maps Yahoo-style symbols to [price, "C" (CAD) | "U" (USD)]. The phone downloads the whole file and
   matches here, so what someone holds never leaves the phone. */
function candidates(sym,cur,cls){
  var s=String(sym||"").trim().toUpperCase().replace(/\s+/g,"");if(!s)return [];
  var lp=/^LSE:(.+)$/.exec(s);if(lp)return [lp[1].replace(/\./g,"-")+".L"];
  var pre=/^(NSE|BSE):(.+)$/.exec(s);if(pre)return pre[1]==="NSE"?[pre[2]+".NS",pre[2]+".BO"]:[pre[2]+".BO",pre[2]+".NS"];
  var m=/^(.+?)[.:-](TO|TSX|NE|NEO|V|TSXV|CN|CSE|US|U|NS|NSE|BO|BSE|L|LSE|LN)$/.exec(s),base=m?m[1]:s,ex=m?m[2]:"";
  var b=base.replace(/\./g,"-");
  if(cls==="crypto"||/^(BTC|ETH|SOL|LTC|DOGE|XRP|ADA)$/.test(b))return cur==="USD"?[b+"-USD",b+"-CAD"]:cur==="INR"?[b+"-INR"]:cur==="GBP"?[b+"-GBP",b+"-USD"]:[b+"-CAD",b+"-USD"];
  if(ex==="L"||ex==="LSE"||ex==="LN"||cur==="GBP")return [b+".L"];
  if(ex==="NS"||ex==="NSE")return [base+".NS",base+".BO"];
  if(ex==="BO"||ex==="BSE")return [base+".BO",base+".NS"];
  if(cur==="INR")return [base+".NS",base+".BO"];
  if(ex==="TO"||ex==="TSX")return [b+".TO"];
  if(ex==="NE"||ex==="NEO")return [b+".NE",b+".TO"];
  if(ex==="V"||ex==="TSXV")return [b+".V"];
  if(ex==="CN"||ex==="CSE")return [b+".CN"];
  if(ex==="US"||ex==="U")return [b];
  return cur==="USD"?[b,b+".TO"]:[b+".TO",b+".NE",b];
}
var WANT={CAD:"C",USD:"U",INR:"I",GBP:"G"};
/* file: prices.json. funds (optional): the Indian mutual fund NAV file {d, n:{ISIN or scheme code: NAV}}. */
function applyPrices(state,file,opt){
  opt=opt||{};var out={updated:0,matched:0,fx:false,unmatched:[]},funds=opt.funds;
  var okFile=file&&file.p&&/^\d{4}-\d{2}-\d{2}$/.test(file.d),okFunds=funds&&funds.n&&/^\d{4}-\d{2}-\d{2}$/.test(funds.d);
  if(!okFile&&!okFunds)return out;
  (state.accounts||[]).forEach(function(a){(a.holdings||[]).forEach(function(h){
    if(!h.sym)return;
    var hit=null,d=null;
    if(isFund(h.sym)){if(okFunds&&funds.n[h.sym.trim().toUpperCase()]>0){hit=[funds.n[h.sym.trim().toUpperCase()]];d=funds.d;}}
    else if(okFile){var want=WANT[h.cur]||"C";candidates(h.sym,h.cur,h.cls).some(function(c){var q=file.p[c];if(q&&q[1]===want){hit=q;return true;}return false;});d=file.d;}
    if(!hit){out.unmatched.push(h.sym);return;}
    out.matched++;
    if(h.priceAt&&h.priceAt>d)return;          // typed in by hand after that close: keep it
    if(h.price===hit[0]&&h.priceAt===d)return;
    h.price=hit[0];h.priceAt=d;h.auto=1;out.updated++;
  });});
  if(okFile&&opt.fx!==false&&file.fx){
    var fx=+file.fx.USDCAD;
    if(fx>0.5&&fx<3&&state.usdcad!==Math.round(fx*10000)/10000){state.usdcad=Math.round(fx*10000)/10000;out.fx=true;}
    var C=file.fx.CAD||{};state.fxc=state.fxc||{};
    CURS.forEach(function(c){if(c==="CAD"||c==="USD")return;var v=+C[c];if(v>0&&state.fxc[c]!==v){state.fxc[c]=v;out.fx=true;}});
  }
  return out;
}
/* ---- target mix ----
   targets: {class: percent}. Arithmetic only: how far each kind is from the person's own targets, and how
   new money could be split to move toward them without selling anything. */
function rebalance(state,cash){
  var t=totals(state),tg=state.targets||{},keys=Object.keys(tg).filter(function(k){return n(tg[k])>0;});
  var sum=keys.reduce(function(a,k){return a+n(tg[k]);},0);if(!sum)return null;
  cash=Math.max(0,n(cash));
  var all={};keys.concat(Object.keys(t.byClass)).forEach(function(k){all[k]=1;});
  var after=t.value+cash,rows=Object.keys(all).map(function(k){var now=t.byClass[k]||0,pct=n(tg[k])/sum*100;
    return {cls:k,now:now,nowPct:t.value?now/t.value*100:0,target:pct,want:after*pct/100,gap:after*pct/100-now,buy:0};});
  var need=rows.reduce(function(a,r){return a+Math.max(0,r.gap);},0),left=cash;
  if(cash>0){
    if(need>0){rows.forEach(function(r){if(r.gap>0)r.buy=Math.min(r.gap,cash*r.gap/need);});}
    left=cash-rows.reduce(function(a,r){return a+r.buy;},0);
    if(left>0.005)rows.forEach(function(r){r.buy+=left*r.target/100;});
  }
  rows.forEach(function(r){r.buy=Math.round(r.buy*100)/100;r.drift=Math.round((r.nowPct-r.target)*10)/10;
    var best=null;(state.accounts||[]).forEach(function(a){(a.holdings||[]).forEach(function(h){if(h.cls===r.cls){var v=hValue(h,state);if(!best||v>best.v)best={sym:h.sym||h.name,v:v};}});});r.example=best&&best.sym;});
  rows.sort(function(a,b){return b.target-a.target||b.now-a.now;});
  return {rows:rows,total:t.value,cash:cash,maxDrift:Math.max.apply(null,rows.map(function(r){return Math.abs(r.drift);}))};
}
var api={COUNTRY:COUNTRY,CURS:CURS,TRACK_LABEL:TRACK_LABEL,country:country,base:base,rate:rate,period:period,periodNow:periodNow,periodLabel:periodLabel,deadline:deadline,defaultRoom:defaultRoom,isFund:isFund,fundClass:fundClass,rebalance:rebalance,applyPrices:applyPrices,candidates:candidates,TYPES:TYPES,CLASSES:CLASSES,LIMITS:LIMITS,totals:totals,room:room,dividends:dividends,parseHoldings:parseHoldings,csvRows:csvRows,guessClass:guessClass,clean:clean,snap:snap,hValue:hValue,daysBetween:daysBetween};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.InvestCore=api;
})(typeof self!=="undefined"?self:this);
