/* Investments: the logic with no screen code, so it can be tested on its own.
   Prices are entered by hand or from a broker CSV: there is no free live price feed for Canadian listings,
   and none is used, so nothing about your holdings ever leaves the phone unencrypted. */
(function(root){
"use strict";
var TYPES=[["tfsa","TFSA"],["rrsp","RRSP"],["fhsa","FHSA"],["resp","RESP"],["lira","LIRA"],["nonreg","Non-registered"],["cash","Cash / savings"],["crypto","Crypto"],["other","Other"]];
var CLASSES=[["ca","Canadian stocks"],["us","US stocks"],["intl","International stocks"],["global","All-in-one / global"],["bond","Bonds"],["cash","Cash"],["crypto","Crypto"],["other","Other"]];
/* Annual limits (CRA). TFSA 2026: $7,000. RRSP 2026: $33,810 (18% of last year's earned income up to this). FHSA: $8,000 a year, $40,000 lifetime. */
var LIMITS={tfsa:{2024:7000,2025:7000,2026:7000},rrsp:{2024:31560,2025:32490,2026:33810,2027:35390},fhsa:{year:8000,life:40000}};
function n(v){v=Number(v);return isFinite(v)?v:0;}
function r2(v){return Math.round(v*100)/100;}
/* Value of one holding in CAD. */
function hValue(h,usd){return n(h.units)*n(h.price)*(h.cur==="USD"?n(usd)||1:1);}
function isoToday(){var d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
/* Book cost is kept in Canadian dollars, the way brokers report ACB. */
function hCost(h){return n(h.cost);}
function totals(state){
  var usd=n(state.usdcad)||1.38,t={value:0,cost:0,byType:{},byClass:{},byAccount:{},stale:0};
  (state.accounts||[]).forEach(function(a){
    var av=n(a.cashBal)*(a.cur==="USD"?usd:1),ac=av;
    (a.holdings||[]).forEach(function(h){var v=hValue(h,usd),c=hCost(h,usd);av+=v;ac+=c;t.byClass[h.cls||"other"]=(t.byClass[h.cls||"other"]||0)+v;if(h.priceAt&&daysBetween(h.priceAt,state.today||isoToday())>7)t.stale++;});
    if(n(a.cashBal))t.byClass.cash=(t.byClass.cash||0)+n(a.cashBal)*(a.cur==="USD"?usd:1);
    t.value+=av;t.cost+=ac;t.byType[a.type]=(t.byType[a.type]||0)+av;t.byAccount[a.id]={value:r2(av),cost:r2(ac)};
  });
  t.value=r2(t.value);t.cost=r2(t.cost);t.gain=r2(t.value-t.cost);t.gainPct=t.cost?r2(100*t.gain/t.cost):0;
  return t;
}
function daysBetween(a,b){var p=a.split("-"),q=b.split("-");return Math.round((Date.UTC(+q[0],+q[1]-1,+q[2])-Date.UTC(+p[0],+p[1]-1,+p[2]))/86400000);}
/* Room left this calendar year for each registered type, from the room you entered for Jan 1 (from your CRA account),
   minus contributions logged this year. TFSA withdrawals come back next January 1, not this year. */
function room(state,year){
  var out={},R=state.room||{};
  ["tfsa","rrsp","fhsa"].forEach(function(k){
    var start=R[k]&&R[k][year];if(start==null||start==="")return;
    var put=0,took=0;
    (state.moves||[]).forEach(function(m){if(m.type!==k||String(m.date).slice(0,4)!==String(year))return;if(m.kind==="in")put+=n(m.amount);else if(m.kind==="out")took+=n(m.amount);});
    out[k]={start:n(start),contributed:r2(put),withdrawn:r2(took),left:r2(n(start)-put),backJan1:k==="tfsa"?r2(took):0};
  });
  return out;
}
function dividends(state,year){var t=0,by={};(state.divs||[]).forEach(function(d){if(String(d.date).slice(0,4)!==String(year))return;var v=n(d.amount)*(d.cur==="USD"?n(state.usdcad)||1.38:1);t+=v;by[d.sym||"?"]=(by[d.sym||"?"]||0)+v;});return {total:r2(t),by:by};}

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
var COLS={sym:/^(symbol|ticker|security symbol|stock symbol|code)$/i,name:/^(name|description|security|security name|security description|holding)$/i,
  units:/^(quantity|qty|shares|units|position|quantity held)$/i,cost:/^(book value|book cost|total cost|cost basis|book value \(cad\)|book value \(cdn\)|average cost total|total book value|cost)$/i,
  avg:/^(average cost|avg cost|average price|avg price|average cost per share|acb per share)$/i,price:/^(price|market price|last price|current price|last)$/i,
  value:/^(market value|value|current value|market value \(cad\)|total market value)$/i,cur:/^(currency|market currency|curr|security currency|market price currency|price currency)$/i,acct:/^(account|account number|account type|account name)$/i};
function num(s){s=String(s==null?"":s).replace(/[$,\s]/g,"").replace(/^\((.*)\)$/,"-$1").replace(/CAD|USD/gi,"");var v=parseFloat(s);return isFinite(v)?v:null;}
/* Finds the header row and returns holdings: [{sym,name,units,cost,price,cur,acct}] plus what was understood. */
function parseHoldings(text){
  var rows=csvRows(text),hi=-1,map={};
  for(var i=0;i<Math.min(rows.length,15);i++){
    var m={};rows[i].forEach(function(h,j){var t=String(h).trim();for(var k in COLS)if(m[k]==null&&COLS[k].test(t))m[k]=j;});
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
    var cur=String(g("cur")||"").toUpperCase().indexOf("USD")>=0?"USD":"CAD";
    out.push({sym:sym.slice(0,16),name:name.slice(0,80),units:units,cost:cost==null?null:r2(cost),price:price==null?null:Math.round(price*10000)/10000,cur:cur,acct:String(g("acct")||"").trim().slice(0,40)});
  });
  return {ok:out.length>0,rows:out,found:Object.keys(map),why:out.length?"":"The file had the right columns but no holdings in it."};
}
/* Guess an asset class from the symbol: .TO / .V / -CT are Canadian listings. */
function guessClass(sym,cur){
  var s=String(sym||"").toUpperCase();
  if(/BTC|ETH|SOL|DOGE|-USD$/.test(s)&&!/\.(TO|V|NE)$/.test(s))return "crypto";
  if(/^(XBB|ZAG|VAB|ZDB|XSB|ZFL|VSB|BND|AGG|TLT|IEF|SHY)/.test(s.replace(/\..*$/,"")))return "bond";
  if(/^(CASH|PSA|HISA|CSAV|ZMMK|MNY)/.test(s.replace(/\..*$/,"")))return "cash";
  if(/^(XEF|VIU|ZEA|IEFA|VEA|VXUS|XEC|VEE|ZEM|EEM|IEMG)/.test(s.replace(/\..*$/,"")))return "intl";
  /* Canadian-listed ETFs that hold US or global stocks */
  if(/^(VFV|ZSP|XUS|XSP|HXS|VSP|ZQQ|QQC|XQQ|HXQ|ZNQ|VUN|VUS|XUU|ZUE|TEC|XEQT|VEQT|ZEQT|VGRO|XGRO|VBAL|XBAL|ZGRO|ZBAL)$/.test(s.replace(/\..*$/,"")))return /^(XEQT|VEQT|ZEQT|VGRO|XGRO|VBAL|XBAL|ZGRO|ZBAL)$/.test(s.replace(/\..*$/,""))?"global":"us";
  if(/\.(TO|V|NE|CN)$|-CT$/.test(s))return "ca";
  return cur==="USD"?"us":"ca";
}
function clean(s){
  s=s&&typeof s==="object"?s:{};
  function str(v,k){return String(v==null?"":v).slice(0,k);}
  var ty=TYPES.map(function(t){return t[0];}),cl=CLASSES.map(function(c){return c[0];});
  var out={ts:+s.ts||0,usdcad:n(s.usdcad)>0.5&&n(s.usdcad)<3?n(s.usdcad):1.38,accounts:[],moves:[],divs:[],room:{},snaps:[]};
  (Array.isArray(s.accounts)?s.accounts:[]).slice(0,60).forEach(function(a){if(!a||!a.id)return;
    out.accounts.push({id:str(a.id,24),name:str(a.name,60)||"Account",type:ty.indexOf(a.type)>=0?a.type:"other",inst:str(a.inst,40),cur:a.cur==="USD"?"USD":"CAD",cashBal:n(a.cashBal),
      holdings:(Array.isArray(a.holdings)?a.holdings:[]).slice(0,300).filter(function(h){return h&&h.id;}).map(function(h){return {id:str(h.id,24),sym:str(h.sym,16),name:str(h.name,80),units:n(h.units),cost:n(h.cost),price:n(h.price),priceAt:/^\d{4}-\d{2}-\d{2}$/.test(h.priceAt)?h.priceAt:"",cur:h.cur==="USD"?"USD":"CAD",cls:cl.indexOf(h.cls)>=0?h.cls:"other"};})});});
  (Array.isArray(s.moves)?s.moves:[]).slice(0,3000).forEach(function(m){if(m&&m.id&&/^\d{4}-\d{2}-\d{2}$/.test(m.date)&&["tfsa","rrsp","fhsa"].indexOf(m.type)>=0)out.moves.push({id:str(m.id,24),date:m.date,type:m.type,kind:m.kind==="out"?"out":"in",amount:Math.abs(n(m.amount)),acct:str(m.acct,24),note:str(m.note,80)});});
  (Array.isArray(s.divs)?s.divs:[]).slice(0,5000).forEach(function(d){if(d&&d.id&&/^\d{4}-\d{2}-\d{2}$/.test(d.date))out.divs.push({id:str(d.id,24),date:d.date,sym:str(d.sym,16),amount:Math.abs(n(d.amount)),cur:d.cur==="USD"?"USD":"CAD",acct:str(d.acct,24)});});
  if(s.room&&typeof s.room==="object")["tfsa","rrsp","fhsa"].forEach(function(k){var y=s.room[k];if(y&&typeof y==="object"){out.room[k]={};Object.keys(y).forEach(function(yr){if(/^\d{4}$/.test(yr)&&y[yr]!==""&&y[yr]!=null)out.room[k][yr]=n(y[yr]);});}});
  (Array.isArray(s.snaps)?s.snaps:[]).slice(-800).forEach(function(x){if(x&&/^\d{4}-\d{2}-\d{2}$/.test(x.d))out.snaps.push({d:x.d,v:r2(n(x.v)),c:r2(n(x.c))});});
  return out;
}
/* One snapshot a day of total value, for the history line. */
function snap(state,day){var t=totals(state),last=state.snaps[state.snaps.length-1];if(last&&last.d===day){last.v=t.value;last.c=t.cost;}else state.snaps.push({d:day,v:t.value,c:t.cost});if(state.snaps.length>800)state.snaps.splice(0,state.snaps.length-800);}
var api={TYPES:TYPES,CLASSES:CLASSES,LIMITS:LIMITS,totals:totals,room:room,dividends:dividends,parseHoldings:parseHoldings,csvRows:csvRows,guessClass:guessClass,clean:clean,snap:snap,hValue:hValue,daysBetween:daysBetween};
if(typeof module!=="undefined"&&module.exports)module.exports=api;else root.InvestCore=api;
})(typeof self!=="undefined"?self:this);
