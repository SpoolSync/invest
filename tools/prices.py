#!/usr/bin/env python3
"""Daily closing prices for Pixora Investments.

Writes prices.json: {"d": close date, "at": when fetched, "fx": {"USDCAD": rate},
"p": {"XEQT.TO": [price, "C"|"U"|"I"|"G"], ...}} (CAD, USD, INR or GBP; London pence become pounds).
Also writes funds-in.json (every Indian mutual fund's latest NAV, by ISIN and AMFI scheme code) and
funds-in-names.json (names for searching), from AMFI's public daily file. The app downloads the whole file and matches holdings on the
phone, so nobody learns what anyone holds. Public market data only. Runs on GitHub Actions (see
.github/workflows/prices.yml); needs no keys.
"""
import csv, io, json, sys, time, urllib.request, datetime, os

UA = {"User-Agent": "Mozilla/5.0 (compatible; pixora-prices/1.0; +https://spoolsync.github.io/invest/)"}
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "prices.json")

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
                return r.read()
        except Exception as e:
            last = e
            time.sleep(1.5 * (i + 1))
    raise last

def symbols():
    out = []
    for line in open(os.path.join(HERE, "symbols.txt")):
        line = line.split("#", 1)[0].strip()
        out += line.split()
    try:  # the S&P 500, from a maintained public list
        raw = get("https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv").decode()
        for row in csv.DictReader(io.StringIO(raw)):
            s = (row.get("Symbol") or "").strip().replace(".", "-")
            if s: out.append(s)
    except Exception as e:
        print("S&P 500 list unavailable:", e, file=sys.stderr)
    seen, uniq = set(), []
    for s in out:
        if s not in seen: seen.add(s); uniq.append(s)
    return uniq

def quote(sym):
    j = json.loads(get("https://query1.finance.yahoo.com/v8/finance/chart/%s?range=5d&interval=1d" % urllib.request.quote(sym)))
    m = j["chart"]["result"][0]["meta"]
    p, cur, t = m.get("regularMarketPrice"), m.get("currency"), m.get("regularMarketTime")
    # London prices are usually quoted in pence ("GBp"); store pounds.
    if cur in ("GBp", "GBX") and p: p, cur = float(p) / 100, "GBP"
    code = {"CAD": "C", "USD": "U", "INR": "I", "GBP": "G"}.get(cur)
    if not p or not code: return None
    return round(float(p), 4), code, t

FUNDS = os.path.join(HERE, "..", "funds-in.json")
NAMES = os.path.join(HERE, "..", "funds-in-names.json")
def funds():
    """AMFI's NAVAll.txt: Scheme Code;ISIN Div Payout/ISIN Growth;ISIN Div Reinvestment;Scheme Name;NAV;Date"""
    raw = ""
    for url in ("https://portal.amfiindia.com/spages/NAVAll.txt", "https://www.amfiindia.com/spages/NAVAll.txt"):
        try:
            raw = get(url).decode("utf-8", "replace")
            if max(raw.count(";"), raw.count("|"), raw.count(",")) > 5000: break
            print("AMFI", url, "gave", len(raw), "bytes, not the NAV list", file=sys.stderr)
        except Exception as e:
            print("AMFI", url, "failed:", e, file=sys.stderr)
    nav, names, latest = {}, [], ""
    # Read each line by the shape of its parts, not their position, so a column change at AMFI
    # doesn't break it: ISINs start with INF, the scheme code is the leading number, the date is a date,
    # the NAV is the number that isn't the code, and the name is the text parts in order
    # (scheme, plan, option).
    def as_date(t):
        for f in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%d %b %Y"):
            try: return datetime.datetime.strptime(t, f).date().isoformat()
            except ValueError: pass
        return None
    shown = 0
    for line in raw.splitlines():
        sep = ";" if line.count(";") >= 3 else ("|" if line.count("|") >= 3 else ("," if line.count(",") >= 3 else None))
        if not sep: continue
        p = [x.strip().strip('"') for x in line.split(sep)]
        isins = [x for x in p if len(x) == 12 and x.startswith("INF")]
        d = next((as_date(x) for x in p if as_date(x)), None)
        code = next((x for x in p if x.isdigit() and 4 <= len(x) <= 7), None)
        v = None
        for x in p:
            if x == code or x in isins: continue
            try:
                f = float(x.replace(",", ""))
                if f > 0 and not x.isdigit() or (f > 0 and x.isdigit() and x != code and len(x) < 4): v = round(f, 4); break
            except ValueError: pass
        texts = [x for x in p if x not in isins and x != code and not as_date(x) and not x.replace(".", "", 1).replace(",", "").isdigit() and x not in ("-", "")]
        name = " - ".join(texts)[:140]  # scheme, plan and option may be separate columns
        if shown < 3 and (isins or code):
            print("AMFI sample:", line[:160]); shown += 1
        if not d or v is None or not (isins or code) or not name: continue
        if d > latest: latest = d
        if code: nav[code] = v
        for i2 in isins: nav[i2] = v
        names.append([isins[0] if isins else code, name])
    if len(names) < 1000:
        print("AMFI file start:", repr(raw[:600]), file=sys.stderr)
        raise RuntimeError("only %d funds" % len(names))
    names.sort(key=lambda x: x[1].lower())
    with open(FUNDS, "w") as f: json.dump({"d": latest, "n": nav}, f, separators=(",", ":"))
    with open(NAMES, "w") as f: json.dump({"d": latest, "f": names}, f, separators=(",", ":"), ensure_ascii=False)
    print("wrote %d fund NAVs (%d schemes) for %s" % (len(nav), len(names), latest))

def main():
    try: funds()
    except Exception as e: print("fund NAVs failed:", e, file=sys.stderr)
    syms = symbols()
    print("fetching", len(syms), "symbols")
    prices, latest, fails = {}, 0, []
    for i, s in enumerate(syms):
        try:
            q = quote(s)
            if q:
                prices[s] = [q[0], q[1]]
                latest = max(latest, q[2] or 0)
            else:
                fails.append(s)
        except Exception as e:
            fails.append(s)
        time.sleep(0.15)
    fx = None
    try:
        fx = quote("CAD=X")[0]  # CAD per 1 USD
    except Exception as e:
        print("fx failed:", e, file=sys.stderr)
    # Travel and family currencies, each as CAD per 1 unit (used by Split Log for foreign expenses).
    rates = {}
    for c in "USD EUR GBP INR AUD NZD MXN JPY CNY HKD SGD AED CHF SEK NOK DKK PLN KRW THB PHP VND IDR MYR BRL ZAR TRY EGP MAD DOP JMD CRC COP PEN CLP ARS ILS SAR QAR PKR LKR BDT NPR KES NGN".split():
        try:
            q = json.loads(get("https://query1.finance.yahoo.com/v8/finance/chart/%sCAD=X?range=5d&interval=1d" % c))["chart"]["result"][0]["meta"].get("regularMarketPrice")
            if q and q > 0: rates[c] = round(float(q), 8)
        except Exception:
            pass
        time.sleep(0.1)
    if len(prices) < 50:
        print("too few prices (%d); keeping the previous file" % len(prices), file=sys.stderr)
        sys.exit(1)
    d = datetime.datetime.fromtimestamp(latest, datetime.timezone(datetime.timedelta(hours=-5))).date().isoformat() if latest else datetime.date.today().isoformat()
    data = {"d": d, "at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%MZ"), "fx": dict({"USDCAD": fx} if fx else {}, **{"CAD": rates}), "p": dict(sorted(prices.items()))}
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print("wrote %d prices for %s, USDCAD %s, %d currencies; %d failed: %s" % (len(prices), d, fx, len(rates), len(fails), " ".join(fails[:80])))

if __name__ == "__main__":
    main()
