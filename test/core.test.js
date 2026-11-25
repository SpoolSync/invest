var I=require("../invest-core.js"),assert=require("assert"),n=0;function t(a,f){f();n++;console.log("ok  "+a);}
var s=I.clean({usdcad:1.4,accounts:[
  {id:"a1",name:"TFSA",type:"tfsa",holdings:[{id:"h1",sym:"XEQT.TO",units:100,cost:2800,price:33.5,cur:"CAD",cls:"ca"},{id:"h2",sym:"VFV.TO",units:10,cost:1200,price:150,cur:"CAD",cls:"us"}],cashBal:50},
  {id:"a2",name:"US",type:"nonreg",cur:"USD",holdings:[{id:"h3",sym:"AAPL",units:5,cost:800,price:200,cur:"USD",cls:"us"}]}],
  moves:[{id:"m1",date:"2026-02-01",type:"tfsa",kind:"in",amount:3000},{id:"m2",date:"2026-06-01",type:"tfsa",kind:"out",amount:500},{id:"m3",date:"2025-06-01",type:"tfsa",kind:"in",amount:9999}],
  room:{tfsa:{"2026":7000}},divs:[{id:"d1",date:"2026-03-01",sym:"XEQT",amount:40},{id:"d2",date:"2026-04-01",sym:"AAPL",amount:10,cur:"USD"}]});
t("totals in CAD with USD converted",function(){
  var x=I.totals(s);
  assert.strictEqual(x.value,3350+1500+50+5*200*1.4);assert.strictEqual(x.cost,2800+1200+50+800);
  assert.strictEqual(x.byType.tfsa,4900);assert.strictEqual(Math.round(x.byClass.us),1500+1400);
});
t("room: this year's contributions only; TFSA withdrawals return Jan 1",function(){
  var r=I.room(s,2026);assert.deepStrictEqual(r.tfsa,{start:7000,contributed:3000,withdrawn:500,left:4000,backJan1:500,standard:false});assert.ok(!r.rrsp);
});
t("dividends this year in CAD",function(){assert.deepStrictEqual(I.dividends(s,2026),{total:54,by:{XEQT:40,AAPL:14}});});
t("reads a Wealthsimple-style CSV",function(){
  var csv='Account Name,Account Type,Symbol,Name,Quantity,Market Price,Market Value,Book Value (CAD),Market Currency\n"TFSA","TFSA",XEQT,"iShares Core Equity",120.5,"33.10","3,988.55","3,500.00",CAD\n"TFSA","TFSA",AAPL,Apple,2,201.5,403,350,USD\n';
  var p=I.parseHoldings(csv);assert.ok(p.ok);assert.strictEqual(p.rows.length,2);
  assert.deepStrictEqual(p.rows[0],{sym:"XEQT",name:"iShares Core Equity",units:120.5,cost:3500,price:33.1,cur:"CAD",acct:"TFSA"});
  assert.strictEqual(p.rows[1].cur,"USD");
});
t("reads a Questrade-style CSV with average cost and a preamble",function(){
  var csv='Positions as of Nov 21\n\nSymbol;Description;Quantity;Average Price;Current Price;Currency\nENB.TO;Enbridge;40;50.25;61.1;CAD\nTotal;;;;;\n';
  var p=I.parseHoldings(csv);assert.ok(p.ok);assert.strictEqual(p.rows.length,1);assert.strictEqual(p.rows[0].cost,2010);assert.strictEqual(p.rows[0].price,61.1);
});
t("explains a file it can't read",function(){var p=I.parseHoldings("date,amount\n2026-01-01,5");assert.ok(!p.ok);assert.ok(/symbol and quantity/.test(p.why));});
t("guesses asset classes",function(){assert.strictEqual(I.guessClass("XEQT.TO","CAD"),"global");assert.strictEqual(I.guessClass("AAPL","USD"),"us");assert.strictEqual(I.guessClass("ZAG.TO"),"bond");assert.strictEqual(I.guessClass("XEF.TO"),"intl");assert.strictEqual(I.guessClass("BTC-USD"),"crypto");});
t("daily snapshot replaces today's",function(){var x=I.clean({});I.snap(x,"2026-11-20");I.snap(x,"2026-11-21");I.snap(x,"2026-11-21");assert.strictEqual(x.snaps.length,2);});
t("import reads price currency; ETFs get the right kind",function(){
  var p=I.parseHoldings("Account Name,Symbol,Name,Quantity,Book Value (CAD),Market Price,Market Price Currency\nTFSA,AAPL,Apple,10,2500,228.5,USD\nTFSA,VFV,Vanguard,4,520,152.3,CAD");
  assert.strictEqual(p.rows[0].cur,"USD");assert.strictEqual(I.guessClass("VFV","CAD"),"us");assert.strictEqual(I.guessClass("XEQT.TO","CAD"),"global");assert.strictEqual(I.guessClass("RY.TO","CAD"),"ca");
});
t("symbol candidates",function(){
  assert.deepStrictEqual(I.candidates("XEQT","CAD"),["XEQT.TO","XEQT.NE","XEQT"]);
  assert.deepStrictEqual(I.candidates("xeqt.to","CAD"),["XEQT.TO"]);
  assert.deepStrictEqual(I.candidates("RCI.B","CAD"),["RCI-B.TO","RCI-B.NE","RCI-B"]);
  assert.deepStrictEqual(I.candidates("BRK.B","USD"),["BRK-B","BRK-B.TO"]);
  assert.deepStrictEqual(I.candidates("BTC","CAD","crypto"),["BTC-CAD","BTC-USD"]);
});
t("prices apply on the phone, by currency, without overriding newer typed prices",function(){
  var st=I.clean({usdcad:1.38,accounts:[{id:"a",name:"T",type:"tfsa",holdings:[
    {id:"1",sym:"XEQT",units:10,cost:300,price:30,priceAt:"2026-11-01",cur:"CAD"},
    {id:"2",sym:"AAPL",units:2,cost:400,price:200,priceAt:"",cur:"USD"},
    {id:"3",sym:"TD",units:5,cost:400,price:90,priceAt:"2026-11-30",cur:"CAD"},
    {id:"4",sym:"SHOP",units:1,cost:100,price:100,priceAt:"",cur:"CAD"},
    {id:"5",sym:"ZZZZ",units:1,cost:1,price:1,priceAt:"",cur:"CAD"}]}]});
  var f={d:"2026-11-24",fx:{USDCAD:1.4012},p:{"XEQT.TO":[36.5,"C"],"AAPL":[230,"U"],"TD.TO":[95,"C"],"TD":[68,"U"],"SHOP":[150,"U"],"SHOP.TO":[210,"C"]}};
  var r=I.applyPrices(st,f),h=st.accounts[0].holdings;
  assert.strictEqual(h[0].price,36.5);assert.strictEqual(h[0].priceAt,"2026-11-24");
  assert.strictEqual(h[1].price,230);
  assert.strictEqual(h[2].price,90,"typed later stays");
  assert.strictEqual(h[3].price,210,"CAD holding gets the TSX listing");
  assert.deepStrictEqual(r.unmatched,["ZZZZ"]);assert.strictEqual(r.updated,3);assert.strictEqual(st.usdcad,1.4012);assert.ok(r.fx);
  var r2=I.applyPrices(st,f);assert.strictEqual(r2.updated,0,"idempotent");
});
t("target mix: drift and where new money goes, no selling",function(){
  var st=I.clean({usdcad:1.4,targets:{us:50,ca:30,bond:20},accounts:[{id:"a",name:"T",type:"tfsa",holdings:[
    {id:"1",sym:"VFV",units:10,cost:1000,price:120,cur:"CAD",cls:"us"},{id:"2",sym:"XIC",units:10,cost:300,price:30,cur:"CAD",cls:"ca"},{id:"3",sym:"ZAG",units:10,cost:150,price:15,cur:"CAD",cls:"bond"}]}]});
  var r=I.rebalance(st,600),by={};r.rows.forEach(function(x){by[x.cls]=x;});
  assert.strictEqual(r.total,1650);assert.strictEqual(by.us.drift,22.7);
  assert.strictEqual(Math.round(by.us.buy+by.ca.buy+by.bond.buy),600);assert.strictEqual(by.us.buy,0,"over target gets nothing");
  assert.ok(by.ca.buy>by.bond.buy);assert.strictEqual(by.ca.example,"XIC");
  var r2=I.rebalance(st,5000),b2={};r2.rows.forEach(function(x){b2[x.cls]=x;});assert.strictEqual(Math.round(b2.us.buy+b2.ca.buy+b2.bond.buy),5000);
  assert.strictEqual(I.rebalance(I.clean({}),100),null);
});
/* ---- United States and India ---- */
t("US: totals in USD; IRA, 401(k) and HSA use the IRS limits; IRA deadline is tax day",function(){
  var s=I.clean({country:"US",usdcad:1.4,accounts:[{id:"a",name:"Roth",type:"roth",holdings:[{id:"h",sym:"VTI",units:10,cost:2500,price:300,cls:"us"},{id:"h2",sym:"XEQT.TO",units:10,cost:200,price:35,cur:"CAD",cls:"global"}]}],
    moves:[{id:"m1",date:"2026-03-01",type:"ira",kind:"in",amount:5000},{id:"m2",date:"2026-01-15",type:"k401",kind:"in",amount:1000}]});
  assert.strictEqual(s.accounts[0].cur,"USD");assert.strictEqual(s.accounts[0].holdings[0].cur,"USD");
  assert.strictEqual(I.totals(s).value,3000+Math.round(350/1.4*100)/100);
  var r=I.room(s,2026);assert.strictEqual(r.ira.left,2500);assert.ok(r.ira.standard);assert.strictEqual(r.k401.left,23500);assert.strictEqual(r.hsa.start,4400);
  assert.strictEqual(I.room(s,2027).k401.start,25500);
  s.hsaFamily=true;assert.strictEqual(I.room(s,2026).hsa.start,8750);
  assert.strictEqual(I.deadline(s,"ira",2026),"2027-04-15");assert.strictEqual(I.deadline(s,"ira",2028),"2029-04-16");
  assert.ok(!I.room(s,2026).tfsa);
});
t("India: rupees, April-March year, PPF counts toward tax-saving",function(){
  var s=I.clean({country:"IN",accounts:[{id:"a",name:"Zerodha",type:"demat",holdings:[{id:"h",sym:"RELIANCE",units:10,cost:12000,price:1300,cls:"in"}]}],
    moves:[{id:"m1",date:"2026-03-20",type:"ppf",kind:"in",amount:150000},{id:"m2",date:"2026-04-02",type:"ppf",kind:"in",amount:50000},{id:"m3",date:"2026-06-01",type:"taxsave",kind:"in",amount:40000}]});
  assert.strictEqual(s.accounts[0].holdings[0].cur,"INR");assert.strictEqual(I.totals(s).value,13000);
  assert.strictEqual(I.period(s,"2026-03-20"),2025);assert.strictEqual(I.period(s,"2026-04-02"),2026);assert.strictEqual(I.periodLabel(s,2026),"FY 2026-27");
  var r=I.room(s,2026);assert.strictEqual(r.ppf.left,100000);assert.strictEqual(r.taxsave.contributed,90000);assert.strictEqual(r.taxsave.left,60000);
  assert.strictEqual(I.room(s,2025).ppf.left,0);assert.strictEqual(I.deadline(s,"ppf",2026),"2027-03-31");
});
t("India: NSE/BSE symbols and mutual funds by ISIN or scheme code get prices",function(){
  assert.deepStrictEqual(I.candidates("RELIANCE","INR"),["RELIANCE.NS","RELIANCE.BO"]);assert.deepStrictEqual(I.candidates("NSE:TCS","INR"),["TCS.NS","TCS.BO"]);assert.deepStrictEqual(I.candidates("500325.BO","INR"),["500325.BO","500325.NS"]);
  var s=I.clean({country:"IN",accounts:[{id:"a",name:"x",type:"demat",holdings:[{id:"1",sym:"TCS",units:2,price:1},{id:"2",sym:"INF879O01027",units:100,price:1},{id:"3",sym:"122639",units:5,price:1},{id:"4",sym:"AAPL",cur:"USD",units:1,price:1}]}]});
  var r=I.applyPrices(s,{d:"2026-11-24",p:{"TCS.NS":[3500,"I"],"AAPL":[230,"U"]},fx:{USDCAD:1.4,CAD:{INR:0.0158,USD:1.4}}},{funds:{d:"2026-11-21",n:{"INF879O01027":85.5,"122639":85.5}}});
  assert.strictEqual(r.updated,4);var h=s.accounts[0].holdings;assert.strictEqual(h[0].price,3500);assert.strictEqual(h[1].price,85.5);assert.strictEqual(h[1].priceAt,"2026-11-21");
  assert.strictEqual(s.fxc.INR,0.0158);assert.strictEqual(Math.round(I.rate(s,"USD")*100)/100,88.61);
  assert.strictEqual(I.guessClass("GOLDBEES.NS","INR"),"gold");assert.strictEqual(I.guessClass("INF879O01027","INR"),"in");assert.strictEqual(I.guessClass("MON100.NS","INR"),"us");
});
t("India: reads a Zerodha-style holdings CSV in rupees",function(){
  var p=I.parseHoldings("Instrument,Qty.,Avg. cost,LTP,Cur. val,P&L\nRELIANCE,10,1200.5,1300,13000,995\nNIFTYBEES,50,250,280,14000,1500\n","INR");
  assert.ok(p.ok);assert.strictEqual(p.rows.length,2);assert.strictEqual(p.rows[0].cur,"INR");assert.strictEqual(p.rows[0].cost,12005);assert.strictEqual(p.rows[1].price,280);
});
t("switching country keeps purchase costs right",function(){
  var s=I.clean({country:"IN",fxc:{INR:0.016},usdcad:1.4,accounts:[{id:"a",name:"x",type:"demat",holdings:[{id:"h",sym:"TCS",units:1,price:1000,cost:800,costCur:"INR"}]}]});
  assert.strictEqual(I.totals(s).gain,200);s.country="US";var t=I.totals(s);assert.strictEqual(t.value,Math.round(1000*0.016/1.4*100)/100);assert.strictEqual(t.gain,Math.round(200*0.016/1.4*100)/100);
});
t("old Canadian data still reads the same",function(){var s=I.clean({usdcad:1.38,accounts:[{id:"a",name:"T",type:"tfsa",cur:"CAD",holdings:[{id:"h",sym:"AAPL",units:1,price:100,cur:"USD"}]}]});assert.strictEqual(I.base(s),"CAD");assert.strictEqual(I.totals(s).value,138);});
console.log(n+" tests passed");
