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
  var r=I.room(s,2026);assert.deepStrictEqual(r.tfsa,{start:7000,contributed:3000,withdrawn:500,left:4000,backJan1:500});assert.ok(!r.rrsp);
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
console.log(n+" tests passed");
