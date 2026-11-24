"use strict";
/* Investments: what you own across every account, gains, allocation, contribution room and dividends.
   Storage, sign-in, the Pixora passcode and encrypted sync come from pixora-kit.js.
   This app tracks; it doesn't advise. Room numbers start from what your CRA account shows. */
var I=InvestCore,K=PixoraKit,esc=K.esc;
var S=null,tab="overview",openAcct=null,importRows=null,importTo=null;
var TYPE={},CLS={};I.TYPES.forEach(function(t){TYPE[t[0]]=t[1];});I.CLASSES.forEach(function(c){CLS[c[0]]=c[1];});
var CLSCOL={ca:"#c0392b",us:"#1f4fa8",intl:"#7d3cb8",global:"#0f8a8a",bond:"#2e8b57",cash:"#8a8f98",crypto:"#d4a017",other:"#5f6b7a"};
function $(s){return document.querySelector(s);}
function z(n){return String(n).padStart(2,"0");}
function today(){var d=new Date();return d.getFullYear()+"-"+z(d.getMonth()+1)+"-"+z(d.getDate());}
function year(){return new Date().getFullYear();}
function rid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
var fm=new Intl.NumberFormat("en-CA",{style:"currency",currency:"CAD"});
function money(v){return fm.format(v||0).replace("CA","");}
function pct(v){return (v>0?"+":"")+(Math.round(v*10)/10)+"%";}
function num(v){v=String(v==null?"":v).replace(/[$,\s]/g,"");var x=parseFloat(v);return isFinite(x)?x:null;}
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
  if(!S.accounts.length)return h+'<div class="empty"><p>Add your accounts (TFSA, RRSP, FHSA, non-registered, savings) and what you hold in them. Bring in a CSV from your broker, or type them in.</p><div class="row"><button class="btn p" data-act="newacct">Add an account</button></div>'+
    '<p class="note">Nothing here is connected to your broker or bank. It only knows what you enter, and it\'s encrypted before it leaves this phone.</p></div>';
  h+='<section class="card"><p class="eyebrow">Total value</p><p class="big">'+money(t.value)+'</p>'+
    '<p class="'+(t.gain>=0?"pos":"neg")+'" style="font-weight:600">'+(t.gain>=0?"+":"")+money(t.gain)+' ('+pct(t.gainPct)+') vs what you paid</p>'+spark()+
    (t.stale?'<p class="note">'+t.stale+' price'+(t.stale===1?" is":"s are")+' over a week old. <button class="add" data-act="tab" data-t="accounts">Update prices</button></p>':"")+'</section>';
  var cls=Object.keys(t.byClass).filter(function(k){return t.byClass[k]>0;}).sort(function(a,b){return t.byClass[b]-t.byClass[a];});
  if(cls.length){
    h+='<section class="card"><h2>What you own</h2><div class="bar" role="img" aria-label="Allocation">'+cls.map(function(k){return '<i style="width:'+(100*t.byClass[k]/t.value).toFixed(2)+'%;background:'+CLSCOL[k]+'"></i>';}).join("")+'</div>';
    cls.forEach(function(k){h+=ln(CLS[k],money(t.byClass[k])+" · "+Math.round(100*t.byClass[k]/t.value)+"%");});h+='</section>';
  }
  h+='<section class="card"><h2>By account type</h2>';
  Object.keys(t.byType).sort(function(a,b){return t.byType[b]-t.byType[a];}).forEach(function(k){h+=ln(TYPE[k],money(t.byType[k]));});h+='</section>';
  var r=I.room(S,year()),dv=I.dividends(S,year());
  h+='<section class="card"><h2>'+year()+' so far</h2>'+ln("Dividends",money(dv.total));
  ["tfsa","rrsp","fhsa"].forEach(function(k){if(r[k])h+=ln(TYPE[k]+" room left",money(r[k].left),r[k].left<0?"neg":"");});
  if(!Object.keys(r).length)h+='<p class="note">Add your contribution room under Room &amp; income to see what\'s left this year.</p>';
  return h+'</section><p class="note">Values use the prices you last entered or imported, and '+S.usdcad+' CAD per USD (change it in Settings). This app tracks; it isn\'t financial advice.</p>';
}
function accounts(){
  var t=I.totals(S),h=header("Investments","Accounts",'<button class="btn p s" data-act="newacct">Add account</button>');
  h+='<div class="row"><button class="btn q s" data-act="import">Import from broker CSV</button><button class="btn q s" data-act="prices">Update prices</button></div>';
  if(!S.accounts.length)return h+'<div class="empty"><p>No accounts yet.</p></div>';
  S.accounts.forEach(function(a){
    var at=t.byAccount[a.id]||{value:0,cost:0},g=at.value-at.cost;
    h+='<section class="card"><div class="dayhead"><h2>'+esc(a.name)+'</h2><button class="btn q s" data-act="editacct" data-id="'+a.id+'">Edit</button></div>'+
      '<p class="note">'+esc(TYPE[a.type])+(a.inst?" · "+esc(a.inst):"")+(a.cur==="USD"?" · USD":"")+'</p>'+
      ln("Value",money(at.value))+ln("Gain",(g>=0?"+":"")+money(g)+(at.cost?" ("+pct(100*g/at.cost)+")":""),g>=0?"pos":"neg");
    a.holdings.slice().sort(function(x,y){return I.hValue(y,S.usdcad)-I.hValue(x,S.usdcad);}).forEach(function(x){
      var v=I.hValue(x,S.usdcad),c=x.cost,gg=v-c;
      h+='<div class="hold" data-act="hold" data-a="'+a.id+'" data-id="'+x.id+'"><span><b>'+esc(x.sym||x.name)+'</b> <span class="note">'+esc(x.sym?x.name:"")+'</span><br><span class="note">'+x.units+' × '+(x.cur==="USD"?"US$":"$")+x.price+(x.priceAt?" · "+esc(x.priceAt):"")+'</span></span>'+
        '<span class="v">'+money(v)+'<br><span class="small '+(gg>=0?"pos":"neg")+'">'+(gg>=0?"+":"")+money(gg)+'</span></span></div>';
    });
    if(a.cashBal)h+=ln("Cash in account",money(a.cashBal*(a.cur==="USD"?S.usdcad:1)));
    h+='<div class="row"><button class="add" data-act="newhold" data-a="'+a.id+'">+ Add a holding</button></div></section>';
  });
  return h;
}
function roomView(){
  var y=year(),r=I.room(S,y),dv=I.dividends(S,y),h=header("Investments","Room & income");
  h+='<section class="card"><h2>Contribution room, '+y+'</h2><p class="note">Enter the room your CRA account (My Account) shows for January 1, '+y+'. Then log each contribution and withdrawal here and the app keeps count. The CRA\'s own figure can lag behind recent activity.</p>';
  ["tfsa","rrsp","fhsa"].forEach(function(k){
    var x=r[k],start=S.room[k]&&S.room[k][y];
    h+='<div style="border-top:1px solid var(--line);padding-top:10px;display:flex;flex-direction:column;gap:6px"><div class="dayhead"><h3>'+TYPE[k]+'</h3><button class="btn q s" data-act="setroom" data-k="'+k+'">'+(x?"Change":"Set room")+'</button></div>';
    if(x){
      h+=ln("Room on Jan 1",money(x.start))+ln("Contributed",money(x.contributed))+ln("Left this year",money(x.left),x.left<0?"neg":"");
      if(x.left<0)h+='<p class="small neg" style="font-weight:600">That\'s '+money(-x.left)+' over. '+(k==="rrsp"?"Over-contributions above the $2,000 buffer are taxed 1% a month.":"Over-contributions are taxed 1% a month until withdrawn.")+' Check your CRA account.</p>';
      if(k==="tfsa"&&x.withdrawn)h+='<p class="note">'+money(x.backJan1)+' withdrawn this year comes back as room on January 1, '+(y+1)+'.</p>';
    }else h+='<p class="note">'+(k==="tfsa"?"2026 adds $7,000.":k==="rrsp"?"2026 adds 18% of your 2025 earned income, up to $33,810.":"$8,000 a year after you open one, $40,000 lifetime.")+'</p>';
    h+='</div>';
  });
  h+='<div class="row"><button class="btn p s" data-act="newmove">Log a contribution or withdrawal</button></div>';
  var mv=S.moves.filter(function(m){return m.date.slice(0,4)===String(y);}).sort(function(a,b){return b.date.localeCompare(a.date);});
  mv.slice(0,30).forEach(function(m){h+='<div class="hold" data-act="delmove" data-id="'+m.id+'"><span>'+esc(TYPE[m.type])+' · '+(m.kind==="in"?"contribution":"withdrawal")+'<br><span class="note">'+esc(m.date)+(m.note?" · "+esc(m.note):"")+' · tap to remove</span></span><span class="v '+(m.kind==="in"?"":"neg")+'">'+(m.kind==="in"?"":"−")+money(m.amount)+'</span></div>';});
  h+='</section><section class="card"><div class="dayhead"><h2>Dividends, '+y+'</h2><button class="btn q s" data-act="newdiv">Log a dividend</button></div>'+ln("Total",money(dv.total));
  Object.keys(dv.by).sort(function(a,b){return dv.by[b]-dv.by[a];}).forEach(function(k){h+=ln(k,money(dv.by[k]));});
  return h+'</section><p class="note">Limits used: TFSA $7,000 for 2026; RRSP 18% of earned income up to $33,810 for 2026; FHSA $8,000 a year, $40,000 lifetime. This is a tracker, not tax advice.</p>';
}
function settings(){
  var h='<button class="btn q s" data-act="tab" data-t="overview" style="align-self:flex-start">← Back</button><h1>Settings</h1>';
  h+='<section class="card"><h2>US dollar rate</h2><p class="note">Used to show US holdings in Canadian dollars. Update it now and then.</p><div class="row"><input type="text" inputmode="decimal" id="usd" value="'+S.usdcad+'" style="width:120px"><span class="note">CAD per 1 USD</span><button class="btn q s" data-act="saveusd">Save</button></div></section>';
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
function opts(list,sel){return list.map(function(x){return '<option value="'+x[0]+'"'+(x[0]===sel?" selected":"")+'>'+esc(x[1])+'</option>';}).join("");}
function acctDialog(a){
  var isNew=!a;a=a||{id:rid(),name:"",type:"tfsa",inst:"",cur:"CAD",cashBal:0,holdings:[]};
  dlg('<h2>'+(isNew?"Add an account":"Edit account")+'</h2><label class="f">Name<input type="text" id="a-name" maxlength="60" value="'+esc(a.name)+'" placeholder="Wealthsimple TFSA"></label>'+
    '<div class="two"><label class="f">Type<select id="a-type">'+opts(I.TYPES,a.type)+'</select></label><label class="f">Currency<select id="a-cur">'+opts([["CAD","CAD"],["USD","USD"]],a.cur)+'</select></label></div>'+
    '<div class="two"><label class="f">Where<input type="text" id="a-inst" maxlength="40" value="'+esc(a.inst)+'" placeholder="Questrade, TD, EQ Bank"></label><label class="f">Cash in it<input type="text" inputmode="decimal" id="a-cash" value="'+(a.cashBal||"")+'"></label></div>'+
    '<p class="note">For a savings account, just enter its balance as cash.</p><div class="row"><button class="btn p" data-act="saveacct" data-id="'+a.id+'" data-new="'+(isNew?1:0)+'">Save</button><button class="btn q" data-act="close">Cancel</button>'+
    (isNew?"":'<button class="btn d" data-act="delacct" data-id="'+a.id+'">Delete</button>')+'</div>');
}
function holdDialog(a,x){
  var isNew=!x;x=x||{id:rid(),sym:"",name:"",units:"",cost:"",price:"",cur:a.cur,cls:""};
  dlg('<h2>'+(isNew?"Add a holding":"Edit holding")+'</h2><p class="note">'+esc(a.name)+'</p><div class="two"><label class="f">Symbol<input type="text" id="h-sym" maxlength="16" value="'+esc(x.sym)+'" placeholder="XEQT.TO" autocapitalize="characters"></label><label class="f">Name<input type="text" id="h-name" maxlength="80" value="'+esc(x.name)+'"></label></div>'+
    '<div class="two"><label class="f">Units<input type="text" inputmode="decimal" id="h-units" value="'+x.units+'"></label><label class="f">Total paid, in CAD<input type="text" inputmode="decimal" id="h-cost" value="'+x.cost+'"></label></div>'+
    '<div class="two"><label class="f">Price now<input type="text" inputmode="decimal" id="h-price" value="'+x.price+'"></label><label class="f">Currency<select id="h-cur">'+opts([["CAD","CAD"],["USD","USD"]],x.cur)+'</select></label></div>'+
    '<label class="f">Kind<select id="h-cls"><option value="">Guess from the symbol</option>'+opts(I.CLASSES,x.cls)+'</select></label>'+
    '<div class="row"><button class="btn p" data-act="savehold" data-a="'+a.id+'" data-id="'+x.id+'" data-new="'+(isNew?1:0)+'">Save</button><button class="btn q" data-act="close">Cancel</button>'+(isNew?"":'<button class="btn d" data-act="delhold" data-a="'+a.id+'" data-id="'+x.id+'">Delete</button>')+'</div>');
}
function pricesDialog(){
  var rows=[];S.accounts.forEach(function(a){a.holdings.forEach(function(x){rows.push([a,x]);});});
  if(!rows.length){toast("Add holdings first.");return;}
  dlg('<h2>Update prices</h2><p class="note">Type today\'s price for each. Same symbol in several accounts updates together.</p>'+
    rows.filter(function(r,i){return rows.findIndex(function(q){return (q[1].sym||q[1].name)===(r[1].sym||r[1].name);})===i;}).map(function(r){var x=r[1];
      return '<label class="f">'+esc(x.sym||x.name)+' <small>last '+(x.cur==="USD"?"US$":"$")+x.price+(x.priceAt?" on "+esc(x.priceAt):"")+'</small><input type="text" inputmode="decimal" data-psym="'+esc(x.sym||x.name)+'" placeholder="'+x.price+'"></label>';}).join("")+
    '<div class="row"><button class="btn p" data-act="saveprices">Save prices</button><button class="btn q" data-act="close">Cancel</button></div>');
}
function importDialog(){
  dlg('<h2>Import from your broker</h2><p class="note">In your broker\'s website, export holdings or positions as CSV (Wealthsimple, Questrade, TD, RBC, CIBC, BMO and most others can). The file is read on this phone only.</p>'+
    '<input type="file" id="i-file" accept=".csv,text/csv,text/plain"><label class="f">Or paste it<textarea id="i-text" placeholder="Symbol,Quantity,Book value,Market price…"></textarea></label>'+
    '<div class="row"><button class="btn p" data-act="readcsv">Read it</button><button class="btn q" data-act="close">Cancel</button></div><div id="i-out"></div>');
  $("#i-file").addEventListener("change",function(){var f=this.files[0];if(!f)return;var r=new FileReader();r.onload=function(){$("#i-text").value=String(r.result);};r.readAsText(f);});
}
function showImport(p){
  var o=$("#i-out");if(!p.ok){o.innerHTML='<p class="small neg" style="font-weight:600">'+esc(p.why)+'</p>';return;}
  importRows=p.rows;
  o.innerHTML='<p class="small" style="font-weight:600">Found '+p.rows.length+' holding'+(p.rows.length===1?"":"s")+'.</p>'+p.rows.slice(0,40).map(function(r){return ln((r.sym||r.name)+" · "+r.units,(r.price!=null?(r.cur==="USD"?"US$":"$")+r.price:"no price")+(r.cost!=null?" · cost "+money(r.cost):""));}).join("")+
    '<label class="f">Put them in<select id="i-acct">'+S.accounts.map(function(a){return '<option value="'+a.id+'"'+(a.id===importTo?" selected":"")+'>'+esc(a.name)+'</option>';}).join("")+'<option value="_new">A new account</option></select></label>'+
    '<label class="check" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="i-replace" checked> Replace that account\'s holdings (an export is a full snapshot)</label>'+
    '<div class="row"><button class="btn p" data-act="doimport">Import</button></div>';
}

/* ---------- events ---------- */
document.addEventListener("click",function(e){
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
    hx.sym=sym.slice(0,16);hx.name=$("#h-name").value.trim().slice(0,80);hx.units=units;hx.cost=num($("#h-cost").value)||0;hx.cur=$("#h-cur").value;
    if(price!=null&&price!==hx.price){hx.price=price;hx.priceAt=today();}else if(hx.price==null)hx.price=0;
    hx.cls=$("#h-cls").value||I.guessClass(hx.sym,hx.cur);
    if(b.dataset.new==="1"){ac2.holdings.push(hx);K.track("holding_add");}save();closeDlg();render();
  }
  else if(a==="delhold"){var ac3=acct(b.dataset.a);ac3.holdings=ac3.holdings.filter(function(x){return x.id!==id;});save();closeDlg();render();}
  else if(a==="prices")pricesDialog();
  else if(a==="saveprices"){var c=0;document.querySelectorAll("[data-psym]").forEach(function(inp){var p=num(inp.value);if(p==null)return;S.accounts.forEach(function(ac){ac.holdings.forEach(function(x){if((x.sym||x.name)===inp.dataset.psym){x.price=p;x.priceAt=today();c++;}});});});
    save();closeDlg();render();toast(c?"Prices updated.":"Nothing changed.");if(c)K.track("prices_update");}
  else if(a==="import")importDialog();
  else if(a==="readcsv")showImport(I.parseHoldings($("#i-text").value));
  else if(a==="doimport"){
    var to=$("#i-acct").value,ac4=to==="_new"?null:acct(to);
    if(!ac4){ac4={id:rid(),name:importRows[0].acct||"Imported account",type:/tfsa/i.test(importRows[0].acct)?"tfsa":/rrsp/i.test(importRows[0].acct)?"rrsp":/fhsa/i.test(importRows[0].acct)?"fhsa":"nonreg",inst:"",cur:"CAD",cashBal:0,holdings:[]};S.accounts.push(ac4);}
    if($("#i-replace").checked)ac4.holdings=[];
    importRows.forEach(function(r){
      var ex=ac4.holdings.filter(function(x){return x.sym&&x.sym===r.sym;})[0]||{id:rid()};
      ex.sym=r.sym;ex.name=r.name;ex.units=r.units;ex.cost=r.cost||ex.cost||0;ex.cur=r.cur;if(r.price!=null){ex.price=r.price;ex.priceAt=today();}else ex.price=ex.price||0;ex.cls=ex.cls||I.guessClass(r.sym,r.cur);
      if(ac4.holdings.indexOf(ex)<0)ac4.holdings.push(ex);
    });
    save();closeDlg();tab="accounts";render();toast("Imported "+importRows.length+" holdings.");K.track("csv_import");importRows=null;
  }
  else if(a==="setroom"){var k=b.dataset.k,y=year(),cur=S.room[k]&&S.room[k][y];
    dlg('<h2>'+TYPE[k]+' room on Jan 1, '+y+'</h2><p class="note">'+(k==="rrsp"?"Your RRSP deduction limit from your latest Notice of Assessment or CRA account.":k==="tfsa"?"From your CRA account. It includes "+y+"'s $7,000 and any unused room from past years.":"From your CRA account: this year's $8,000 plus any carried-forward room.")+'</p>'+
      '<label class="f">Room<input type="text" inputmode="decimal" id="r-val" value="'+(cur==null?"":cur)+'"></label><div class="row"><button class="btn p" data-act="saveroom" data-k="'+k+'">Save</button><button class="btn q" data-act="close">Cancel</button></div>');}
  else if(a==="saveroom"){var v=num($("#r-val").value),k2=b.dataset.k;S.room[k2]=S.room[k2]||{};if(v==null)delete S.room[k2][year()];else S.room[k2][year()]=v;save();closeDlg();render();K.track("room_set");}
  else if(a==="newmove")dlg('<h2>Contribution or withdrawal</h2><div class="two"><label class="f">Account type<select id="m-type">'+opts([["tfsa","TFSA"],["rrsp","RRSP"],["fhsa","FHSA"]],"tfsa")+'</select></label><label class="f">What<select id="m-kind">'+opts([["in","Contribution"],["out","Withdrawal"]],"in")+'</select></label></div>'+
      '<div class="two"><label class="f">Amount<input type="text" inputmode="decimal" id="m-amt"></label><label class="f">Date<input type="date" id="m-date" value="'+today()+'"></label></div><label class="f">Note<input type="text" id="m-note" maxlength="80"></label>'+
      '<div class="row"><button class="btn p" data-act="savemove">Save</button><button class="btn q" data-act="close">Cancel</button></div>');
  else if(a==="savemove"){var amt=num($("#m-amt").value);if(!amt){toast("Enter the amount.");return;}S.moves.push({id:rid(),date:$("#m-date").value||today(),type:$("#m-type").value,kind:$("#m-kind").value,amount:Math.abs(amt),note:$("#m-note").value.trim().slice(0,80)});save();closeDlg();render();K.track("move_log");}
  else if(a==="delmove"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.querySelector(".note").textContent="Tap again to remove";return;}S.moves=S.moves.filter(function(m){return m.id!==id;});save();render();}
  else if(a==="newdiv")dlg('<h2>Log a dividend</h2><div class="two"><label class="f">Symbol<input type="text" id="d-sym" maxlength="16" autocapitalize="characters"></label><label class="f">Amount<input type="text" inputmode="decimal" id="d-amt"></label></div>'+
      '<div class="two"><label class="f">Currency<select id="d-cur">'+opts([["CAD","CAD"],["USD","USD"]],"CAD")+'</select></label><label class="f">Date<input type="date" id="d-date" value="'+today()+'"></label></div><div class="row"><button class="btn p" data-act="savediv">Save</button><button class="btn q" data-act="close">Cancel</button></div>');
  else if(a==="savediv"){var da=num($("#d-amt").value);if(!da){toast("Enter the amount.");return;}S.divs.push({id:rid(),date:$("#d-date").value||today(),sym:$("#d-sym").value.trim().toUpperCase().slice(0,16),amount:Math.abs(da),cur:$("#d-cur").value});save();closeDlg();render();K.track("dividend_log");}
  else if(a==="saveusd"){var u=num($("#usd").value);if(!u||u<0.5||u>3){toast("That rate looks off.");return;}S.usdcad=u;save();toast("Saved.");}
  else if(a==="delall"){if(b.dataset.armed!=="1"){b.dataset.armed="1";b.textContent="Tap again: delete everything in Investments";return;}
    tab="overview";K.deleteAppData().then(function(){render();toast("Your Investments data is deleted. Your Pixora login still works.");}).catch(function(){toast("Couldn't delete. Check the connection.");});}
  else if(a==="feedback"){if(window.PixoraFeedback)PixoraFeedback.open("invest","Investments");}
  else if(a==="join")K.joinAccount();
  else if(a==="signout")K.signOut();
  else if(a==="close")closeDlg();
});
$("#tabs").addEventListener("click",function(e){var b=e.target.closest("[data-tab]");if(!b)return;tab=b.dataset.tab;render();K.track("tab_"+tab);});

K.boot({
  app:"invest",title:"Investments",version:"invest-v1",blurb:"Everything you own across every account, in one place.",
  clean:I.clean,
  onOpen:function(s){S=s;if(S.accounts.length){I.snap(S,today());}render();},
  onRemote:function(s){S=s;if(!$("#dlg").open)render();},
  onStatus:function(t){var st=$("#st");if(st)st.textContent=t;},
  onGate:function(shown){$("#app").hidden=shown;$("#tabs").hidden=shown;},
  /* For Pixora Today: total value, change over about a week, room left. */
  summary:function(s){
    if(!s.accounts.length)return null;
    var t=I.totals(s),wk=null;for(var i=s.snaps.length-1;i>=0;i--){if(I.daysBetween(s.snaps[i].d,today())>=7){wk=s.snaps[i];break;}}
    var r=I.room(s,year()),room={};Object.keys(r).forEach(function(k){room[k]=r[k].left;});
    return {d:today(),value:t.value,gain:t.gain,gainPct:t.gainPct,week:wk?Math.round((t.value-wk.v)*100)/100:null,room:room,stale:t.stale};
  }
});
