"use strict";
/* Investments: what you own across every account, gains, allocation, contribution room and dividends.
   Storage, sign-in, the Pixora passcode and encrypted sync come from pixora-kit.js.
   This app tracks; it doesn't advise. Works for Canada, the US and India (Settings > Country). */
var I=InvestCore,K=PixoraKit,esc=K.esc,PC=window.PixoraCountry;
var priceFile=null,fundFile=null,priceT=0;
/* Daily closing prices (see tools/prices.py): the whole file comes down and is matched here on the phone. */
async function refreshPrices(force){
  if(!S||!S.autoPrices||!S.accounts.length)return;
  if(!force&&Date.now()-priceT<30*60e3)return;priceT=Date.now();
  try{var r=await fetch("prices.json",{cache:"no-cache"});if(!r.ok)return;priceFile=await r.json();}catch(e){return;}
  /* Indian mutual fund NAVs come in a separate file, fetched only by people who hold funds. */
  if(S.accounts.some(function(a){return a.holdings.some(function(h){return I.isFund(h.sym);});})){try{var f=await fetch("funds-in.json",{cache:"no-cache"});if(f.ok)fundFile=await f.json();}catch(e){}}
  var res=I.applyPrices(S,priceFile,{funds:fundFile});
  if(res.updated||res.fx){save();K.track("prices_auto");}
  if(!$("#dlg").open)render();
  return res;
}
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")refreshPrices();});
var S=null,tab="overview",openAcct=null,importRows=null,importTo=null;
var TYPE={},CLS={};I.TYPES.forEach(function(t){TYPE[t[0]]=t[1];});I.CLASSES.forEach(function(c){CLS[c[0]]=c[1];});Object.keys(I.TRACK_LABEL).forEach(function(k){if(!TYPE[k])TYPE[k]=I.TRACK_LABEL[k];});
var CLSCOL={ca:"#c0392b",us:"#1f4fa8",in:"#e07b1a",intl:"#7d3cb8",global:"#0f8a8a",bond:"#2e8b57",gold:"#b8860b",cash:"#8a8f98",crypto:"#d4a017",other:"#5f6b7a"};
function C(){return I.country(S);}
function CP(){return I.COUNTRY[C()];}
function home(){return I.base(S);}
function $(s){return document.querySelector(s);}
function z(n){return String(n).padStart(2,"0");}
function today(){var d=new Date();return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());}
function year(){return new Date().getFullYear();}
/* The contribution year now: the calendar year, or India's April-March financial year. */
function pnow(){return I.periodNow(S,today());}
function rid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
/* Money in the home currency and the person's own format (lakh grouping in India). */
function money(v){return PC.money(v||0,{country:C(),cur:home()});}
/* A price in the holding's own currency, marked when it isn't the home one. */
function priceIn(v,cur){var x=+v||0;return PC.money(x,{country:C(),cur:cur||home(),dec:x&&Math.abs(x)<1?4:2});}
function day(iso,opt){return PC.date(iso,opt||{month:"short",day:"numeric"},C());}
function pct(v){return (v>0?"+":"")+(Math.round(v*10)/10)+"%";}
function num(v){v=String(v==null?"":v).replace(/[$,\s₹]/g,"").replace(/^Rs\.?/i,"");var x=parseFloat(v);return isFinite(x)?x:null;}
var tt=null;function toast(m){var t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(function(){t.hidden=true;},3500);}
function save(){I.snap(S,today());K.save(S);}
function acct(id){return S.accounts.filter(function(a){return a.id===id;})[0];}

/* ---------- screens ---------- */
function render(){
  var app=$("#app");app.hidden=false;$("#tabs").hidden=false;
  document.querySelectorAll("#tabs button").forEach(function(b){b.setAttribute("aria-current",b.dataset.tab===tab?"page":"false");});
  app.innerHTML=tab==="overview"?overview():tab==="accounts"?accounts():tab==="room"?roomView():settings();
  window.scrollTo(0,0);
}
function header(eb,title,right){
  return '<header class="top"><div><p class="eyebrow">'+esc(eb)+'</p><h1>'+esc(title)+'</h1></div><div class="row">'+(right||"")+'<button class="btn q s" data-act="settings">Settings</button></div></header>'+
    '<button class="status" id="st" data-act="settings">'+esc(K.status())+'</button>';
}
function ln(k,v,cls){return '<div class="ln"><span>'+esc(k)+'</span><span class="lead"></span><span class="v '+(cls||"")+'">'+esc(v)+'</span></div>';}
function spark(){
  var p=S.snaps.slice(-180);if(p.length<2)return '<p class="note">The history line starts filling in from today, one point a day you open the app.</p>';
  var min=Math.min.apply(null,p.map(function(x){return x.v;})),max=Math.max.apply(null,p.map(function(x){return x.v;})),W=600,H=70,span=max-min||1;
  var pts=p.map(function(x,i){return (i*(W/(p.length-1))).toFixed(1)+","+(H-4-(x.v-min)/span*(H-8)).toFixed(1);}).join(" ");
  return '<svg class="spark" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" role="img" aria-label="Total value over the last '+p.length+' days"><polyline fill="none" stroke="var(--accent)" stroke-width="2.5" vector-effect="non-scaling-stroke" points="'+pts+'"/></svg>'+
    '<p class="note">'+esc(p[0].d)+' to today · low '+money(min)+' · high '+money(max)+'</p>';
}
function overview(){
  var t=I.totals(S),h=header("Investments","Overview");
  if(!S.accounts.length)return h+'<div class="empty"><p>Add your accounts ('+esc(C()==="US"?"401(k), IRA, Roth IRA, HSA, brokerage, savings":C()==="IN"?"demat, mutual funds, PPF, EPF, NPS, fixed deposits":"TFSA, RRSP, FHSA, non-registered, savings")+') and what you hold in them. Bring in a CSV from your broker, or type them in.</p><p class="note">Not in '+esc(PC.info(C()).name)+'? Change the country in <button class="add" data-act="settings">Settings</button>.</p><div class="row"><button class="btn p" data-act="newacct">Add an account</button></div>'+
    '<p class="note">Nothing here is connected to your broker or bank. It only knows what you enter, and it\'s encrypted before it leaves this phone.</p></div>';
  h+='<section class="card"><p class="eyebrow">Total value</p><p class="big">'+money(t.value)+'</p>'+
    '<p class="'+(t.gain>=0?"pos":"neg")+'" style="font-weight:600">'+(t.gain>=0?"+":"")+money(t.gain)+' ('+pct(t.gainPct)+') vs what you paid</p>'+spark()+
    (priceFile&&S.autoPrices?'<p class="note">Prices from the '+esc(day(priceFile.d))+' close, updated automatically.</p>':"")+
    (t.stale?'<p class="note">'+t.stale+' price'+(t.stale===1?" is":"s are")+' over a week old. <button class="add" data-act="tab" data-t="accounts">Update prices</button></p>':"")+'</section>';
  var cls=Object.keys(t.byClass).filter(function(k){return t.byClass[k]>0;}).sort(function(a,b){return t.byClass[b]-t.byClass[a];});
  if(cls.length){
    h+='<section class="card"><h2>What you own</h2><div class="bar" role="img" aria-label="Allocation">'+cls.map(function(k){return '<i style="width:'+(100*t.byClass[k]/t.value).toFixed(2)+'%;background:'+CLSCOL[k]+'"></i>';}).join("")+'</div>';
    cls.forEach(function(k){h+=ln(CLS[k],money(t.byClass[k])+" · "+Math.round(100*t.byClass[k]/t.value)+"%");});h+='</section>';
  }
  h+=targetCard();
  h+='<section class="card"><h2>By account type</h2>';
  Object.keys(t.byType).sort(function(a,b){return t.byType[b]-t.byType[a];}).forEach(function(k){h+=ln(TYPE[k],money(t.byType[k]));});h+='</section>';
  var p=pnow(),r=I.room(S,p),dv=I.dividends(S,year());
  h+='<section class="card"><h2>'+year()+' so far</h2>'+ln("Dividends",money(dv.total));
  if(Object.keys(r).length)h+='<p class="note" style="margin-top:6px">Contribution room, '+esc(I.periodLabel(S,p))+'</p>';
  CP().track.forEach(function(k){if(r[k])h+=ln(I.TRACK_LABEL[k]+" left",money(r[k].left),r[k].left<0?"neg":"");});
  if(!Object.keys(r).length)h+='<p class="note">Add your contribution room under Room &amp; income to see what\'s left this year.</p>';
  return h+'</section><p class="note">Values use the latest prices and '+esc(rateNote())+'. This app tracks; it isn\'t financial advice.</p>';
}
/* The exchange rates in use, e.g. "1 USD = 1.40 CAD". */
function usedCurs(){var u={};S.accounts.forEach(function(a){if(a.cur!==home())u[a.cur]=1;a.holdings.forEach(function(x){if(x.cur!==home())u[x.cur]=1;});});return Object.keys(u);}
function rateNote(){var u=usedCurs();if(!u.length)return "your home currency, "+home();return u.map(function(c){var r=I.rate(S,c);return "1 "+c+" = "+(r<0.1?r.toFixed(4):r.toFixed(2))+" "+home();}).join(", ");
}
var addCash="";
/* Target mix: the person's own split by kind of investment, how far off they are, and how new money
   could be split to move toward it without selling. Arithmetic on their targets, not advice. */
function targetCard(){
  var r=I.rebalance(S,num(addCash)||0);
  if(!r)return '<section class="card"><h2>Target mix</h2><p class="note">Set the split you want, like 60% stocks and 40% bonds, and see how far off you are and where new money would bring you back.</p><div class="row"><button class="btn q s" data-act="targets">Set a target mix</button></div></section>';
  var h='<section class="card"><div class="dayhead"><h2>Target mix</h2><button class="add" data-act="targets">Change</button></div>';
  h+='<p class="note">'+(r.maxDrift<=5?"Within 5 points of your targets everywhere.":"Off by up to "+Math.round(r.maxDrift)+" points.")+'</p>';
  r.rows.forEach(function(x){var off=x.drift;
    h+='<div class="ln"><span>'+esc(CLS[x.cls]||x.cls)+'</span><span class="lead"></span><span class="v">'+Math.round(x.nowPct)+'% now · '+Math.round(x.target)+'% target'+(Math.abs(off)>=1?' <b class="'+(Math.abs(off)>5?"neg":"")+'">('+(off>0?"+":"")+off+')</b>':"")+'</span></div>';});
  h+='<div class="row" style="margin-top:8px"><label class="note" for="addcash">Adding</label><input type="text" inputmode="decimal" id="addcash" value="'+esc(addCash)+'" placeholder="'+esc(C()==="IN"?"₹10,000":"$500")+'" style="width:110px"><span class="note">to put it where it brings you closest</span></div>';
  if(r.cash>0){h+='<div id="split">';r.rows.filter(function(x){return x.buy>=1;}).forEach(function(x){h+='<div class="ln"><span>'+esc(CLS[x.cls]||x.cls)+(x.example?' <span class="note">(like '+esc(x.example)+')</span>':"")+'</span><span class="lead"></span><span class="v pos">'+money(x.buy)+'</span></div>';});h+='</div>';}
  return h+'<p class="note">This is arithmetic on your own targets, not advice. Mind each account\'s contribution room.</p></section>';
}
function accounts(){
  var t=I.totals(S),h=header("Investments","Accounts",'<button class="btn p s" data-act="newacct">Add account</button>');
  h+='<div class="row"><button class="btn q s" data-act="import">Import from broker CSV</button><button class="btn q s" data-act="prices">Update prices</button></div>';
  if(!S.accounts.length)return h+'<div class="empty"><p>No accounts yet.</p></div>';
  S.accounts.forEach(function(a){
    var at=t.byAccount[a.id]||{value:0,cost:0},g=at.value-at.cost;
    h+='<section class="card"><div class="dayhead"><h2>'+esc(a.name)+'</h2><button class="btn q s" data-act="editacct" data-id="'+a.id+'">Edit</button></div>'+
      '<p class="note">'+esc(TYPE[a.type])+(a.inst?" · "+esc(a.inst):"")+(a.cur!==home()?" · "+a.cur:"")+'</p>'+
      ln("Value",money(at.value))+ln("Gain",(g>=0?"+":"")+money(g)+(at.cost?" ("+pct(100*g/at.cost)+")":""),g>=0?"pos":"neg");
    a.holdings.slice().sort(function(x,y){return I.hValue(y,S)-I.hValue(x,S);}).forEach(function(x){
      var v=I.hValue(x,S),c=x.cost*I.rate(S,x.costCur),gg=v-c;
      h+='<div class="hold" data-act="hold" data-a="'+a.id+'" data-id="'+x.id+'"><span><b>'+esc(x.sym||x.name)+'</b> <span class="note">'+esc(x.sym?x.name:"")+'</span><br><span class="note">'+x.units+' × '+esc(priceIn(x.price,x.cur))+(x.priceAt?" · "+esc(day(x.priceAt)):"")+(x.auto?" · auto":"")+'</span></span>'+
        '<span class="v">'+money(v)+'<br><span class="small '+(gg>=0?"pos":"neg")+'">'+(gg>=0?"+":"")+money(gg)+'</span></span></div>';
    });
    if(a.cashBal)h+=ln("Cash in account",money(a.cashBal*I.rate(S,a.cur)));
    h+='<div class="row"><button class="add" data-act="newhold" data-a="'+a.id+'">+ Add a holding</button></div></section>';
  });
  return h;
}
/* What each tracked limit means, per country. Figures checked November 2026; the person's own room wins. */
var ROOMTXT={
  tfsa:{set:"From your CRA account. It includes this year's $7,000 and any unused room from past years.",none:"2026 adds $7,000.",over:"Over-contributions are taxed 1% a month until withdrawn. Check your CRA account."},
  rrsp:{set:"Your RRSP deduction limit from your latest Notice of Assessment or CRA account.",none:"2026 adds 18% of your 2025 earned income, up to $33,810.",over:"Over-contributions above the $2,000 buffer are taxed 1% a month. Check your CRA account."},
  fhsa:{set:"From your CRA account: this year's $8,000 plus any carried-forward room.",none:"$8,000 a year after you open one, $40,000 lifetime.",over:"Over-contributions are taxed 1% a month until withdrawn."},
  k401:{set:"Your own deferral limit, if different (catch-up adds $8,000 at 50+ for 2026, $8,500 for 2027).",std:"Using the IRS limit: $24,500 for 2026, $25,500 for 2027. Employer matching doesn't count toward it.",over:"Ask your plan to return excess deferrals before tax day, or they're taxed twice."},
  ira:{set:"Your own limit, if different (50+ can add $1,100).",std:"Using the IRS limit: $7,500 for 2026 and 2027, traditional and Roth together. Roth eligibility depends on income.",over:"Excess IRA contributions are taxed 6% a year until removed."},
  hsa:{set:"Your own limit, if different (55+ can add $1,000).",std:"Using the IRS limit for self-only coverage: $4,400 for 2026, $4,500 for 2027. Needs a high-deductible health plan.",over:"Excess HSA contributions are taxed 6% a year until removed."},
  ppf:{set:"Normally ₹1.5 lakh. Deposits above it earn no interest.",std:"₹1.5 lakh per financial year (April to March), at least ₹500 to keep it active.",over:"Deposits above ₹1.5 lakh earn no interest and aren't tax-saving."},
  taxsave:{set:"Normally ₹1.5 lakh.",std:"Old tax regime only: PPF, ELSS, EPF, life insurance and home loan principal together, up to ₹1.5 lakh (section 123, 80C before April 2026). PPF deposits you log count here too. The default new regime doesn't give this deduction.",over:"Anything above ₹1.5 lakh doesn't save more tax."}
};
function roomView(){
  var c=C(),p=pnow(),r=I.room(S,p),dv=I.dividends(S,year()),h=header("Investments","Room & income");
  var intro=c==="CA"?"Enter the room your CRA account (My Account) shows for January 1, "+p+". Then log each contribution and withdrawal here and the app keeps count. The CRA's own figure can lag behind recent activity.":
    c==="US"?"The app starts from the IRS limits for "+p+". Log each contribution (not your employer's match) and it keeps count. Change a limit if catch-up contributions apply to you.":
    "India's contribution year is the financial year, April to March. Log each deposit and the app keeps count against the limits.";
  h+='<section class="card"><h2>Contribution room, '+esc(I.periodLabel(S,p))+'</h2><p class="note">'+esc(intro)+'</p>';
  CP().track.forEach(function(k){
    var x=r[k],T=ROOMTXT[k];
    h+='<div style="border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:6px"><div class="dayhead"><h3>'+esc(I.TRACK_LABEL[k])+'</h3><button class="btn q s" data-act="setroom" data-k="'+k+'">'+(x&&!x.standard?"Change":c==="CA"?"Set room":"Use my own limit")+'</button></div>';
    if(x){
      h+=ln(c==="CA"?"Room on Jan 1":"Limit",money(x.start))+ln(c==="IN"&&k==="taxsave"?"Counted so far":"Contributed",money(x.contributed))+ln("Left",money(x.left),x.left<0?"neg":"");
      if(x.left<0)h+='<p class="small neg" style="font-weight:600">That\'s '+money(-x.left)+' over. '+esc(T.over)+'</p>';
      if(x.standard&&T.std)h+='<p class="note">'+esc(T.std)+'</p>';
      var dl=I.deadline(S,k,p);
      if(k==="rrsp"||c!=="CA")h+='<p class="note">'+(c==="US"&&k==="k401"?"Payroll contributions for "+p+" must come out of a paycheck by "+esc(day(dl,{month:"long",day:"numeric",year:"numeric"}))+".":"Contributions until "+esc(day(dl,{month:"long",day:"numeric",year:"numeric"}))+" count toward "+esc(I.periodLabel(S,p))+(c==="CA"?"'s tax return":"")+".")+'</p>';
      if(k==="tfsa"&&x.withdrawn)h+='<p class="note">'+money(x.backJan1)+' withdrawn this year comes back as room on January 1, '+(p+1)+'.</p>';
      if(k==="hsa")h+='<label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-act="hsafamily"'+(S.hsaFamily?" checked":"")+'> Family coverage ($8,750 for 2026, $9,000 for 2027)</label>';
    }else h+='<p class="note">'+esc(T.none||T.std)+'</p>';
    h+='</div>';
  });
  if(c==="US"&&p===year()){var nx=I.room(S,p+1);h+='<p class="note">'+(p+1)+' limits: 401(k) '+money(nx.k401.start)+', IRA '+money(nx.ira.start)+', HSA '+money(nx.hsa.start)+'.</p>';}
  h+='<div class="row"><button class="btn p s" data-act="newmove">Log a contribution or withdrawal</button></div>';
  var mv=S.moves.filter(function(m){return I.period(S,m.date)===p;}).sort(function(a,b){return b.date.localeCompare(a.date);});
  mv.slice(0,30).forEach(function(m){h+='<div class="hold" data-act="delmove" data-id="'+m.id+'"><span>'+esc(I.TRACK_LABEL[m.type]||TYPE[m.type])+' · '+(m.kind==="in"?"contribution":"withdrawal")+'<br><span class="note">'+esc(day(m.date))+(m.note?" · "+esc(m.note):"")+' · tap to remove</span></span><span class="v '+(m.kind==="in"?"":"neg")+'">'+(m.kind==="in"?"":"−")+money(m.amount)+'</span></div>';});
  h+='</section><section class="card"><div class="dayhead"><h2>Dividends, '+year()+'</h2><button class="btn q s" data-act="newdiv">Log a dividend</button></div>'+ln("Total",money(dv.total));
  Object.keys(dv.by).sort(function(a,b){return dv.by[b]-dv.by[a];}).forEach(function(k){h+=ln(k,money(dv.by[k]));});
  return h+'</section><p class="note">'+(c==="CA"?"Limits used: TFSA $7,000 for 2026; RRSP 18% of earned income up to $33,810 for 2026; FHSA $8,000 a year, $40,000 lifetime.":c==="US"?"Limits from the IRS, checked November 2026.":"Limits checked November 2026. Which tax regime suits you depends on your income and deductions.")+' This is a tracker, not tax advice.</p>';
}
function settings(){
  var h='<button class="btn q s" data-act="tab" data-t="overview" style="align-self:flex-start">← Back</button><h1>Settings</h1>';
  h+=PC.picker("Sets your home currency, account types and contribution limits here, and the country-specific parts of every Pixora app.");
  h+='<section class="card"><h2>Automatic prices</h2><p class="note">Each weekday evening Pixora saves closing prices for popular Canadian, US and Indian (NSE) stocks and ETFs, crypto, and every Indian mutual fund\'s NAV in public files. Your phone downloads the whole file and matches your holdings itself, so nobody, not even Pixora, learns what you own. Holdings it can\'t match keep the price you type.</p>'+
    '<label style="display:flex;gap:8px;align-items:center;min-height:44px"><input type="checkbox" data-act="autoprices"'+(S.autoPrices?" checked":"")+'> Update prices and exchange rates automatically</label></section>';
  h+='<section class="card"><h2>Exchange rates</h2><p class="note">Holdings in other currencies are shown in '+home()+'. Now: '+esc(rateNote())+'.</p>'+
    (home()==="CAD"?'<div class="row"><input type="text" inputmode="decimal" id="usd" value="'+S.usdcad+'" style="width:120px"><span class="note">CAD per 1 USD</span><button class="btn q s" data-act="saveusd">Save</button></div>':"")+'</section>';
  h+='<section class="card"><h2>Your copy</h2><p class="small muted">Download everything in Investments as a file you keep, and bring it back here or on a new phone. It\'s a plain file, not encrypted, so keep it somewhere private.</p><div class="row"><button class="btn" data-act="export">Download a copy</button><label class="btn q" style="cursor:pointer">Restore from a copy<input type="file" id="restore" accept=".json,application/json" hidden></label></div></section>';
  h+='<section class="card"><h2>Ideas or problems?</h2><p class="small muted">Tell Sachin what would make Investments better or what went wrong. Nothing from your data is sent.</p><div class="row"><button class="btn" data-act="feedback">Send feedback</button></div></section>';
  h+='<section class="card"><h2>Account</h2>'+(K.local?'<p class="small">On this phone only.</p><div class="row"><button class="btn" data-act="join">Sign in or create a Pixora account</button></div>':
    '<p class="small">Signed in as '+esc(K.email||"")+'. Everything is encrypted on this phone before it syncs. Nobody else can read it, not even Pixora. Nothing connects to your broker or bank.</p><div class="row"><button class="btn q" data-act="signout">Sign out</button></div>')+'</section>';
  h+='<section class="card"><h2>Delete my Investments data</h2><p class="note">Deletes your accounts, holdings, room and dividends from this phone'+(K.local?"":" and your Pixora account")+'. Your Pixora login and other apps aren\'t affected. To delete the Pixora login itself, email pixora3dstudios@gmail.com.</p><div class="row"><button class="btn d" data-act="delall">Delete my Investments data</button></div></section>';
  return h;
}

/* ---------- dialogs ---------- */
function dlg(html){var d=$("#dlg");d.innerHTML='<div class="form">'+html+'</div>';if(!d.open)d.showModal();return d;}
function closeDlg(){var d=$("#dlg");if(d.open)d.close();d.innerHTML="";}
$("#dlg").addEventListener("cancel",function(e){e.preventDefault();closeDlg();});
function curOpts(sel){var list=[home()].concat(["CAD","USD","INR"].filter(function(x){return x!==home();}));if(sel&&list.indexOf(sel)<0)list.push(sel);return opts(list.map(function(x){return [x,x];}),sel||home());}
function opts(list,sel){return list.map(function(x){return '<option value="'+x[0]+'"'+(x[0]===sel?" selected":"")+'>'+esc(x[1])+'</option>';}).join("");}
function acctDialog(a){
  var isNew=!a;a=a||{id:rid(),name:"",type:CP().def,inst:"",cur:home(),cashBal:0,holdings:[]};
  var c=C(),ex=c==="US"?["Fidelity Roth IRA","Fidelity, Vanguard, Schwab"]:c==="IN"?["Zerodha demat","Zerodha, Groww, SBI, HDFC Bank"]:["Wealthsimple TFSA","Questrade, TD, EQ Bank"];
  dlg('<h2>'+(isNew?"Add an account":"Edit account")+'</h2><label class="f">Name<input type="text" id="a-name" maxlength="60" value="'+esc(a.name)+'" placeholder="'+esc(ex[0])+'"></label>'+
    '<div class="two"><label class="f">Type<select id="a-type">'+opts(I.TYPES.filter(function(t){return CP().types.indexOf(t[0])>=0||t[0]===a.type;}),a.type)+'</select></label><label class="f">Currency<select id="a-cur">'+curOpts(a.cur)+'</select></label></div>'+
    '<div class="two"><label class="f">Where<input type="text" id="a-inst" maxlength="40" value="'+esc(a.inst)+'" placeholder="'+esc(ex[1])+'"></label><label class="f">Cash in it<input type="text" inputmode="decimal" id="a-cash" value="'+(a.cashBal||"")+'"></label></div>'+
    '<p class="note">For a savings account, just enter its balance as cash.</p><div class="row"><button class="btn p" data-act="saveacct" data-id="'+a.id+'" data-new="'+(isNew?1:0)+'">Save</button><button class="btn q" data-act="close">Cancel</button>'+
    (isNew?"":'<button class="btn d" data-act="delacct" data-id="'+a.id+'">Delete</button>')+'</div>');
}
function holdDialog(a,x){
  var isNew=!x;x=x||{id:rid(),sym:"",name:"",units:"",cost:"",price:"",cur:a.cur,cls:""};
  var c=C(),ph=c==="US"?"VTI":c==="IN"?"RELIANCE":"XEQT.TO";
  dlg('<h2>'+(isNew?"Add a holding":"Edit holding")+'</h2><p class="note">'+esc(a.name)+'</p>'+
    (c==="IN"?'<label class="f">Find a mutual fund<input type="search" id="h-fund" placeholder="e.g. parag parikh flexi cap direct" autocomplete="off"></label><div id="h-fundres"></div>':"")+
    '<div class="two"><label class="f">Symbol'+(c==="IN"?" or fund ISIN":"")+'<input type="text" id="h-sym" maxlength="20" value="'+esc(x.sym)+'" placeholder="'+ph+'" autocapitalize="characters"></label><label class="f">Name<input type="text" id="h-name" maxlength="80" value="'+esc(x.name)+'"></label></div>'+
    '<div class="two"><label class="f">Units<input type="text" inputmode="decimal" id="h-units" value="'+x.units+'"></label><label class="f">Total paid, in '+home()+'<input type="text" inputmode="decimal" id="h-cost" value="'+(x.cost&&x.costCur&&x.costCur!==home()?Math.round(x.cost*I.rate(S,x.costCur)*100)/100:x.cost)+'"></label></div>'+
    '<div class="two"><label class="f">Price now'+(c==="IN"?" (or NAV)":"")+'<input type="text" inputmode="decimal" id="h-price" value="'+x.price+'"></label><label class="f">Currency<select id="h-cur">'+curOpts(x.cur)+'</select></label></div>'+
    '<label class="f">Kind<select id="h-cls"><option value="">Guess from the symbol</option>'+opts(I.CLASSES.filter(function(k){return CP().classes.indexOf(k[0])>=0||k[0]===x.cls;}),x.cls)+'</select></label>'+
    (c==="IN"?'<p class="note">NSE symbols get prices automatically (add .BO for BSE). Mutual funds get the daily NAV when the symbol is the fund\'s ISIN or AMFI scheme code.</p>':"")+
    '<div class="row"><button class="btn p" data-act="savehold" data-a="'+a.id+'" data-id="'+x.id+'" data-new="'+(isNew?1:0)+'">Save</button><button class="btn q" data-act="close">Cancel</button>'+(isNew?"":'<button class="btn d" data-act="delhold" data-a="'+a.id+'" data-id="'+x.id+'">Delete</button>')+'</div>');
}
function pricesDialog(){
  var rows=[];S.accounts.forEach(function(a){a.holdings.forEach(function(x){rows.push([a,x]);});});
  if(!rows.length){toast("Add holdings first.");return;}
  dlg('<h2>Update prices</h2>'+(S.autoPrices?'<div class="row"><button class="btn p" data-act="getprices">Get the latest closing prices</button></div><p class="note">':'<p class="note">')+'Type today\'s price for each. Same symbol in several accounts updates together.</p>'+
    rows.filter(function(r,i){return rows.findIndex(function(q){return (q[1].sym||q[1].name)===(r[1].sym||r[1].name);})===i;}).map(function(r){var x=r[1];
      return '<label class="f">'+esc(x.sym||x.name)+' <small>last '+esc(priceIn(x.price,x.cur))+(x.priceAt?" on "+esc(day(x.priceAt)):"")+'</small><input type="text" inputmode="decimal" data-psym="'+esc(x.sym||x.name)+'" placeholder="'+x.price+'"></label>';}).join("")+
    '<div class="row"><button class="btn p" data-act="saveprices">Save prices</button><button class="btn q" data-act="close">Cancel</button></div>');
}
function importDialog(){
  dlg('<h2>Import from your broker</h2><p class="note">In your broker\'s website, export holdings or positions as CSV ('+esc(C()==="US"?"Fidelity, Vanguard, Schwab, Robinhood":C()==="IN"?"Zerodha Console, Groww, Upstox, ICICI Direct":"Wealthsimple, Questrade, TD, RBC, CIBC, BMO")+' and most others can). The file is read on this phone only.</p>'+
    '<input type="file" id="i-file" accept=".csv,text/csv,text/plain"><label class="f">Or paste it<textarea id="i-text" placeholder="Symbol,Quantity,Book value,Market price…"></textarea></label>'+
    '<div class="row"><button class="btn p" data-act="readcsv">Read it</button><button class="btn q" data-act="close">Cancel</button></div><div id="i-out"></div>');
  $("#i-file").addEventListener("change",function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(){$("#i-text").value=String(r.result);};r.readAsText(f);});
}
function showImport(p){
  var o=$("#i-out");if(!p.ok){o.innerHTML='<p class="small neg" style="font-weight:600">'+esc(p.why)+'</p>';return;}
  importRows=p.rows;
  o.innerHTML='<p class="small" style="font-weight:600">Found '+p.rows.length+' holding'+(p.rows.length===1?"":"s")+'.</p>'+p.rows.slice(0,40).map(function(r){return ln((r.sym||r.name)+" · "+r.units,(r.price!=null?priceIn(r.price,r.cur):"no price")+(r.cost!=null?" · cost "+money(r.cost):""));}).join("")+
    '<label class="f">Put them in<select id="i-acct">'+S.accounts.map(function(a){return '<option value="'+a.id+'"'+(a.id===importTo?" selected":"")+'>'+esc(a.name)+'</option>';}).join("")+'<option value="_new">A new account</option></select></label>'+
    '<label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="i-replace" checked> Replace that account\'s holdings (an export is a full snapshot)</label>'+
    '<div class="row"><button class="btn p" data-act="doimport">Import</button></div>';
}

/* ---------- events ---------- */
document.addEventListener("click",async function(e){
  var b=e.target.closest("[data-act]");if(!b||b.tagName==="SELECT"||b.tagName==="INPUT")return;
  var a=b.dataset.act,id=b.dataset.id;
  if(a==="tab"){tab=b.dataset.t;render();}
  else if(a==="settings"){tab="settings";render();}
  else if(a==="newacct")acctDialog(null);
  else if(a==="editacct")acctDialog(acct(id));
  else if(a==="saveacct"){
    var nm=$("#a-name").value.trim();if(!nm){toast("Give it a name.");return;}
    var x=acct(id)||{id:id,holdings:[]};x.name=nm.slice(0,60);x.type=$("#a-type").value;x.cur=$("#a-cur").value;x.inst=$("#a-inst").value.trim().slice(0,40);x.cashBal=num($("#a-cash").value)||0;
    var isNew=b.dataset.new==="1";if(isNew){importTo=x.id;S.accounts.push(x);K.track("account_add");}save();closeDlg();tab="accounts";render();
    if(isNew&&x.type!=="cash")dlg('<h2>What\'s in '+esc(x.name)+'?</h2><p class="note">Add the stocks, ETFs or funds you hold there so the totals mean something. Fastest is a CSV from your broker\'s website; typing a few in works too.</p>'+
      '<div style="display:flex;flex-direction:column;gap:8px"><button class="btn p" data-act="import">Import a CSV from my broker</button><button class="btn" data-act="newhold" data-a="'+x.id+'">Type in a holding</button><button class="btn q" data-act="close">Later</button></div>');
  }
  else if(a==="delacct"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again: delete it and its holdings";return;}S.accounts=S.accounts.filter(function(x){return x.id!==id;});save();closeDlg();render();}
  else if(a==="newhold")holdDialog(acct(b.dataset.a),null);
  else if(a==="hold"){var ac=acct(b.dataset.a);holdDialog(ac,ac.holdings.filter(function(x){return x.id===id;})[0]);}
  else if(a==="savehold"){
    var ac2=acct(b.dataset.a),sym=$("#h-sym").value.trim().toUpperCase(),units=num($("#h-units").value);
    if(!sym&&!$("#h-name").value.trim()){toast("Add a symbol or name.");return;}if(units==null){toast("Add how many units.");return;}
    var hx=ac2.holdings.filter(function(x){return x.id===id;})[0]||{id:id};
    var price=num($("#h-price").value);
    hx.sym=sym.slice(0,20);hx.name=$("#h-name").value.trim().slice(0,80);hx.units=units;hx.cost=num($("#h-cost").value)||0;hx.costCur=home();hx.cur=$("#h-cur").value;
    if(price!=null&&price!==hx.price){hx.price=price;hx.priceAt=today();hx.auto=0;}else if(hx.price==null)hx.price=0;
    hx.cls=$("#h-cls").value||I.guessClass(hx.sym,hx.cur);
    if(b.dataset.new==="1"){ac2.holdings.push(hx);K.track("holding_add");}save();closeDlg();render();
  }
  else if(a==="delhold"){var ac3=acct(b.dataset.a);ac3.holdings=ac3.holdings.filter(function(x){return x.id!==id;});save();closeDlg();render();}
  else if(a==="prices")pricesDialog();
  else if(a==="pickfund"){$("#h-sym").value=b.dataset.sym;$("#h-name").value=b.dataset.name.slice(0,80);$("#h-cur").value="INR";var kc=$("#h-cls"),g=I.fundClass(b.dataset.name);if(kc&&kc.querySelector('option[value="'+g+'"]'))kc.value=g;$("#h-fundres").innerHTML="";$("#h-fund").value="";$("#h-units").focus();K.track("fund_pick");}
  else if(a==="targets"){
    var tg=S.targets||{};
    dlg('<h2>Target mix</h2><p class="note">Your own split. It needs to add up to 100%.</p>'+I.CLASSES.filter(function(c){return CP().classes.indexOf(c[0])>=0||tg[c[0]];}).map(function(c){return '<label class="f">'+esc(c[1])+'<input type="text" inputmode="decimal" data-tg="'+c[0]+'" value="'+(tg[c[0]]||"")+'" placeholder="0"></label>';}).join("")+
      '<p class="note" id="tg-sum"></p><p class="note">Quick fill: '+Object.keys(CP().fill).map(function(v){return '<button class="add" data-act="tgfill" data-v="'+v+'">'+esc(CP().fill[v])+'</button>';}).join(" · ")+'</p>'+
      '<div class="row"><button class="btn p" data-act="savetargets">Save</button><button class="btn q" data-act="close">Cancel</button>'+(Object.keys(tg).length?'<button class="btn d" data-act="cleartargets">Remove targets</button>':"")+'</div>');
    var sumf=function(){var t=0;document.querySelectorAll("[data-tg]").forEach(function(el){t+=num(el.value)||0;});$("#tg-sum").textContent="Adds up to "+Math.round(t*10)/10+"%"+(Math.abs(t-100)>0.05?" (needs to be 100)":" ✓");};
    document.querySelectorAll("[data-tg]").forEach(function(el){el.addEventListener("input",sumf);});sumf();
  }
  else if(a==="tgfill"){document.querySelectorAll("[data-tg]").forEach(function(el){el.value="";});b.dataset.v.split(",").forEach(function(p){var kv=p.split(":"),el=document.querySelector('[data-tg="'+kv[0]+'"]');if(el)el.value=kv[1];});document.querySelector("[data-tg]").dispatchEvent(new Event("input"));}
  else if(a==="savetargets"){var nt={},tot=0;document.querySelectorAll("[data-tg]").forEach(function(el){var v=num(el.value);if(v>0){nt[el.dataset.tg]=v;tot+=v;}});
    if(Math.abs(tot-100)>0.05){toast("Targets need to add up to 100%.");return;}S.targets=nt;save();closeDlg();render();K.track("targets_set");}
  else if(a==="cleartargets"){S.targets={};save();closeDlg();render();}
  else if(a==="getprices"){b.disabled=true;var res=await refreshPrices(true);closeDlg();render();
    toast(!res?"Couldn't get prices. Check the connection.":res.matched?(res.updated?"Updated "+res.updated+(res.updated===1?" price":" prices")+".":"Prices are already up to date.")+(res.unmatched.length?" Not found: "+res.unmatched.slice(0,4).join(", ")+(res.unmatched.length>4?"…":""):""):"None of your symbols are in the daily list. Type prices in, or check the symbols.");}
  else if(a==="saveprices"){var c=0;document.querySelectorAll("[data-psym]").forEach(function(inp){var p=num(inp.value);if(p==null)return;S.accounts.forEach(function(ac){ac.holdings.forEach(function(x){if((x.sym||x.name)===inp.dataset.psym){x.price=p;x.priceAt=today();x.auto=0;c++;}});});});
    save();closeDlg();render();toast(c?"Prices updated.":"Nothing changed.");if(c)K.track("prices_update");}
  else if(a==="import")importDialog();
  else if(a==="readcsv")showImport(I.parseHoldings($("#i-text").value,home()));
  else if(a==="doimport"){
    var to=$("#i-acct").value,ac4=to==="_new"?null:acct(to);
    if(!ac4){var an=importRows[0].acct||"",gt=/tfsa/i.test(an)?"tfsa":/rrsp/i.test(an)?"rrsp":/fhsa/i.test(an)?"fhsa":/roth/i.test(an)?"roth":/ira/i.test(an)?"ira":/401/i.test(an)?"k401":/hsa/i.test(an)?"hsa":C()==="IN"?(importRows.every(function(r){return I.isFund(r.sym);})?"mf":"demat"):C()==="US"?"brokerage":"nonreg";
      ac4={id:rid(),name:an||"Imported account",type:gt,inst:"",cur:home(),cashBal:0,holdings:[]};S.accounts.push(ac4);}
    if($("#i-replace").checked)ac4.holdings=[];
    importRows.forEach(function(r){
      var ex=ac4.holdings.filter(function(x){return x.sym&&x.sym===r.sym;})[0]||{id:rid()};
      ex.sym=r.sym;ex.name=r.name;ex.units=r.units;ex.cost=r.cost||ex.cost||0;ex.costCur=home();ex.cur=r.cur;if(r.price!=null){ex.price=r.price;ex.priceAt=today();}else ex.price=ex.price||0;ex.cls=ex.cls||I.guessClass(r.sym,r.cur);
      if(ac4.holdings.indexOf(ex)<0)ac4.holdings.push(ex);
    });
    save();closeDlg();tab="accounts";render();toast("Imported "+importRows.length+" holdings.");K.track("csv_import");importRows=null;
  }
  else if(a==="setroom"){var k=b.dataset.k,y=pnow(),cur=S.room[k]&&S.room[k][y];
    dlg('<h2>'+esc(I.TRACK_LABEL[k])+(C()==="CA"?' room on Jan 1, '+y:', '+esc(I.periodLabel(S,y)))+'</h2><p class="note">'+esc(ROOMTXT[k].set)+(C()!=="CA"?" Leave it empty to use the standard limit.":"")+'</p>'+
      '<label class="f">'+(C()==="CA"?"Room":"Limit")+'<input type="text" inputmode="decimal" id="r-val" value="'+(cur==null?"":cur)+'" placeholder="'+(I.defaultRoom(S,k,y)||"")+'"></label><div class="row"><button class="btn p" data-act="saveroom" data-k="'+k+'">Save</button><button class="btn q" data-act="close">Cancel</button></div>');}
  else if(a==="saveroom"){var v=num($("#r-val").value),k2=b.dataset.k;S.room[k2]=S.room[k2]||{};if(v==null)delete S.room[k2][pnow()];else S.room[k2][pnow()]=v;save();closeDlg();render();K.track("room_set");}
  else if(a==="newmove")dlg('<h2>Contribution or withdrawal</h2><div class="two"><label class="f">For<select id="m-type">'+opts(CP().track.map(function(k){return [k,I.TRACK_LABEL[k]];}),CP().track[0])+'</select></label><label class="f">What<select id="m-kind">'+opts([["in","Contribution"],["out","Withdrawal"]],"in")+'</select></label></div>'+
      '<div class="two"><label class="f">Amount<input type="text" inputmode="decimal" id="m-amt"></label><label class="f">Date<input type="date" id="m-date" value="'+today()+'"></label></div><label class="f">Note<input type="text" id="m-note" maxlength="80"></label>'+
      '<div class="row"><button class="btn p" data-act="savemove">Save</button><button class="btn q" data-act="close">Cancel</button></div>');
  else if(a==="savemove"){var amt=num($("#m-amt").value);if(!amt){toast("Enter the amount.");return;}S.moves.push({id:rid(),date:$("#m-date").value||today(),type:$("#m-type").value,kind:$("#m-kind").value,amount:Math.abs(amt),note:$("#m-note").value.trim().slice(0,80)});save();closeDlg();render();K.track("move_log");}
  else if(a==="delmove"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.querySelector(".note").textContent="Tap again to remove";return;}S.moves=S.moves.filter(function(m){return m.id!==id;});save();render();}
  else if(a==="newdiv")dlg('<h2>Log a dividend</h2><div class="two"><label class="f">Symbol<input type="text" id="d-sym" maxlength="16" autocapitalize="characters"></label><label class="f">Amount<input type="text" inputmode="decimal" id="d-amt"></label></div>'+
      '<div class="two"><label class="f">Currency<select id="d-cur">'+curOpts(home())+'</select></label><label class="f">Date<input type="date" id="d-date" value="'+today()+'"></label></div><div class="row"><button class="btn p" data-act="savediv">Save</button><button class="btn q" data-act="close">Cancel</button></div>');
  else if(a==="savediv"){var da=num($("#d-amt").value);if(!da){toast("Enter the amount.");return;}S.divs.push({id:rid(),date:$("#d-date").value||today(),sym:$("#d-sym").value.trim().toUpperCase().slice(0,16),amount:Math.abs(da),cur:$("#d-cur").value});save();closeDlg();render();K.track("dividend_log");}
  else if(a==="saveusd"){var u=num($("#usd").value);if(!u||u<0.5||u>3){toast("That rate looks off.");return;}S.usdcad=u;save();toast("Saved.");}
  else if(a==="delall"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again: delete everything in Investments";return;}
    tab="overview";K.deleteAppData().then(function(){render();toast("Your Investments data is deleted. Your Pixora login still works.");}).catch(function(){toast("Couldn't delete. Check the connection.");});}
  else if(a==="export")K.exportCopy();
  else if(a==="feedback"){if(window.PixoraFeedback)PixoraFeedback.open("invest","Investments");}
  else if(a==="join")K.joinAccount();
  else if(a==="signout")K.signOut();
  else if(a==="close")closeDlg();
});
$("#tabs").addEventListener("click",function(e){var b=e.target.closest("[data-tab]");if(!b)return;tab=b.dataset.tab;render();K.track("tab_"+tab);});

K.boot({
  app:"invest",title:"Investments",version:"invest-v1",blurb:"Everything you own across every account, in one place.",
  clean:I.clean,
  onOpen:function(s){S=s;setTimeout(function(){refreshPrices(true);},300);if(S.accounts.length){I.snap(S,today());}render();},
  onRemote:function(s){S=s;if(!$("#dlg").open)render();},
  onCountry:function(s){S=s;closeDlg();render();toast("Now set for "+PC.info(C()).name+". Amounts show in "+home()+".");},
  onStatus:function(t){var st=$("#st");if(st)st.textContent=t;},
  onGate:function(shown){$("#app").hidden=shown;$("#tabs").hidden=shown;},
  /* For Pixora Today: total value, change over about a week, room left. */
  summary:function(s){
    if(!s.accounts.length)return null;
    var t=I.totals(s),wk=null;for(var i=s.snaps.length-1;i>=0;i--){if(I.daysBetween(s.snaps[i].d,today())>=7){wk=s.snaps[i];break;}}
    var p=I.periodNow(s,today()),r=I.room(s,p),room={},dl={};Object.keys(r).forEach(function(k){room[k]=r[k].left;dl[k]=I.deadline(s,k,p);});
    return {d:today(),c:I.country(s),cur:I.base(s),value:t.value,gain:t.gain,gainPct:t.gainPct,week:wk?Math.round((t.value-wk.v)*100)/100:null,room:room,deadlines:dl,period:I.periodLabel(s,p),stale:t.stale};
  }
});

document.addEventListener("change",function(e){
  if(e.target.id!=="restore"||!e.target.files[0])return;
  var f=e.target.files[0],r=new FileReader();e.target.value="";
  r.onload=function(){
    if(!confirm("Replace what's in Investments now with this copy? What's here now is replaced."))return;
    try{K.restoreCopy(String(r.result));toast("Restored from your copy.");}
    catch(x){toast(x&&x.code==="wrongapp"?"That copy is from "+(x.app||"another app")+", not Investments.":"That file isn't a Investments copy.");}
  };r.readAsText(f);
});

document.addEventListener("change",function(e){
  if(e.target.dataset&&e.target.dataset.act==="hsafamily"){S.hsaFamily=e.target.checked;save();render();return;}
  if(e.target.dataset&&e.target.dataset.act==="autoprices"){S.autoPrices=e.target.checked;save();K.track(S.autoPrices?"autoprices_on":"autoprices_off");if(S.autoPrices)refreshPrices(true);}
});

/* Indian mutual fund search: the names file (about 1 MB, compressed in transit) comes down once, only when someone searches. */
var fundNames=null,fundQ=0;
async function fundSearch(q){
  var box=$("#h-fundres");if(!box)return;q=q.trim().toLowerCase();if(q.length<3){box.innerHTML="";return;}
  var my=++fundQ;
  if(!fundNames){box.innerHTML='<p class="note">Loading the fund list…</p>';try{var r=await fetch("funds-in-names.json");fundNames=(await r.json()).f;}catch(e){box.innerHTML='<p class="note">Couldn\'t load the fund list. Type the ISIN instead.</p>';return;}}
  if(my!==fundQ)return;
  function find(w){var hits=[];for(var i=0;i<fundNames.length&&hits.length<8;i++){var nm=fundNames[i][1].toLowerCase();if(w.every(function(x){return nm.indexOf(x)>=0;}))hits.push(fundNames[i]);}return hits;}
  var w=q.split(/\s+/),hits=find(w);
  if(!hits.length){var core=w.filter(function(x){return !/^(plan|fund|option|scheme|the|of|-)$/.test(x);});if(core.length)hits=find(core);}
  if(!hits.length){var core2=w.filter(function(x){return !/^(plan|fund|option|scheme|the|of|-|direct|regular|growth|idcw|dividend)$/.test(x);});if(core2.length)hits=find(core2);}
  box.innerHTML=hits.length?hits.map(function(f){return '<button class="add" style="display:block;text-align:left;padding:6px 0" data-act="pickfund" data-sym="'+esc(f[0])+'" data-name="'+esc(f[1])+'">'+esc(f[1])+'</button>';}).join(""):'<p class="note">No fund matches. Try fewer words.</p>';
}
document.addEventListener("input",function(e){
  if(e.target.id==="h-fund"){clearTimeout(window._fs);var v=e.target.value;window._fs=setTimeout(function(){fundSearch(v);},200);return;}
  if(e.target.id==="addcash"){addCash=e.target.value;var pos=e.target.selectionStart;clearTimeout(window._ac);window._ac=setTimeout(function(){render();var el=$("#addcash");if(el){el.focus();try{el.setSelectionRange(pos,pos);}catch(x){}}K.track("targets_cash");},400);}
});
