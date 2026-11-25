#!/usr/bin/env python3
"""Daily closing prices for Pixora Investments.

Writes prices.json: {"d": close date, "at": when fetched, "fx": {"USDCAD": rate},
"p": {"XEQT.TO": [price, "C"|"U"|"I"], ...}} (CAD, USD or INR).
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
    code = {"CAD": "C", "USD": "U", "INR": "I"}.get(cur)
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
            if raw.count(";") > 5000: break
            print("AMFI", url, "gave", len(raw), "bytes, not the NAV list", file=sys.stderr)
        except Exception as e:
            print("AMFI", url, "failed:", e, file=sys.stderr)
    nav, names, latest = {}, [], ""
    for line in raw.splitlines():
        p = line.split(";")
        if len(p) < 6 or not p[0].strip().isdigit(): continue
        code, isin1, isin2, name, v, d = [x.strip() for x in p[:6]]
        try: v = round(float(v), 4)
        except ValueError: continue
        if v <= 0: continue
        try: d = datetime.datetime.strptime(d, "%d-%b-%Y").date().isoformat()
        except ValueError: continue
        if d > latest: latest = d
        nav[code] = v
        for i in (isin1, isin2):
            if len(i) == 12 and i.startswith("INF"): nav[i] = v
        key = isin1 if len(isin1) == 12 and isin1.startswith("INF") else (isin2 if len(isin2) == 12 and isin2.startswith("INF") else code)
        names.append([key, name])
    if len(names) < 1000: raise RuntimeError("only %d funds" % len(names))
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
