import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const CURRENCY = ""; // set a symbol such as "€" if you want one
const get = (p) => fetch(API + p).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
const post = (p, body) => fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  .then(async (r) => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.status); return r.json(); });
const tone = { High: "bad", Medium: "mid", Low: "ok" };
const money = (n) => CURRENCY + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const Badge = ({ b }) => <span className={"badge " + tone[b]}>{b.toUpperCase()}</span>;

function Live({ data }) {
  const [t, setT] = useState(0);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 1), 3500); return () => clearInterval(id); }, []);
  const feed = data ? data.feed : [];
  const rows = feed.length ? Array.from({ length: 5 }, (_, k) => feed[(t + k) % feed.length]) : [];
  const k = data ? data.kpi : null;
  return (
    <div className="card live">
      <div className="lh"><span className="pill"><i /> LIVE PREVIEW</span><b>Payment monitor</b><small>{k ? k.monitored : 0} payments scanned</small></div>
      {rows.map((r, n) => (
        <div className={"lrow " + tone[r.band]} key={n}>
          <span className="av">TX</span>
          <div><b>{r.ref}</b><small>Amount {money(r.amount)}, {r.time}</small></div>
          <div className="ls"><b>{Math.round(r.score)}</b><Badge b={r.band} /></div>
        </div>
      ))}
      <div className="lstats">
        <div><b className="bad">{k ? k.high : 0}</b>HIGH RISK</div><div><b className="mid">{k ? k.medium : 0}</b>MEDIUM</div>
        <div><b className="ok">{k ? k.low : 0}</b>APPROVED</div><div><b>{k ? k.avg : 0}</b>AVG SCORE</div>
      </div>
    </div>
  );
}

function Home({ data, go }) {
  return (
    <>
      <section className="hero">
        <div>
          <p className="eyebrow">CARD PAYMENT PROTECTION</p>
          <h1>Stop card fraud <em>before it costs you.</em></h1>
          <p className="lead">SmartShield gives every card payment a risk score and tells your team what to do with it: approve, verify or block.</p>
          <ul className="checks">
            <li>A clear risk score from 0 to 100 for every payment</li>
            <li>One recommended action for each: approve, verify or block</li>
            <li>The signals behind every alert, so your team can act with confidence</li>
          </ul>
          <button className="btn" onClick={() => go("dash")}>Open dashboard</button>{" "}
          <a className="btn ghost" href="#how">How it works</a>
        </div>
        <Live data={data} />
      </section>

      <section id="features" className="sec">
        <h2>Built for the payments that matter</h2>
        <div className="three">
          <div className="card"><span className="num">01</span><h3>Risk scoring</h3><p>Each payment gets a score from 0 to 100, so your team sees at a glance which ones need attention.</p></div>
          <div className="card"><span className="num">02</span><h3>Clear decisions</h3><p>Low risk is approved. Medium risk is sent for extra verification. High risk is blocked and reviewed.</p></div>
          <div className="card"><span className="num">03</span><h3>Explained alerts</h3><p>Every alert lists the signals that raised or lowered its risk, so no decision is a black box.</p></div>
        </div>
      </section>

      <section id="how" className="sec">
        <h2>How it works</h2>
        <div className="three">
          <div className="card"><span className="num">1</span><h3>Connect</h3><p>Send payment details to SmartShield as they happen.</p></div>
          <div className="card"><span className="num">2</span><h3>Score</h3><p>Each payment is checked and given a risk score and a recommended action.</p></div>
          <div className="card"><span className="num">3</span><h3>Act</h3><p>Review alerts in the dashboard, with the signals behind each one.</p></div>
        </div>
      </section>

      <section className="cta"><h2>See it on live-style payment traffic</h2><button className="btn" onClick={() => go("dash")}>Open dashboard</button></section>
      <footer className="foot">&copy; 2026 SmartShield. All rights reserved.</footer>
    </>
  );
}

const Back = ({ back }) => <button className="back" onClick={back} aria-label="Go back">&larr;</button>;

function Side({ k, view, go, setTab }) {
  const link = (v, label) => <a className={view === v ? "on" : ""} onClick={() => go(v)}>{label}</a>;
  return (
    <aside className="side">
      <div className="brand">Smart<span>Shield</span></div>
      <p className="cap">MONITORING</p>
      {link("dash", "Dashboard")}{link("analytics", "Analytics")}{link("analyze", "Risk analyzer")}{link("log", "Activity log")}
      <p className="cap">ALERTS</p>
      {[["High", "bad"], ["Medium", "mid"], ["Low", "ok"]].map(([b, t]) => (
        <a key={b} onClick={() => { setTab(b); go("dash"); }}><i className={"dot " + t} /> {b} risk <b>{k[b.toLowerCase()]}</b></a>
      ))}
    </aside>
  );
}

function Assess({ score, band, action }) {
  return (<>
    <div className={"assess " + tone[band]}><span>Risk score</span><b>{Math.round(score)}<small> / 100</small></b>
      <div className="rb"><div style={{ width: score + "%" }} /></div><strong>{band} risk</strong></div>
    <p className="action">Recommended action: <b>{action}</b></p>
  </>);
}

const Signals = ({ list }) => list.length === 0 ? null : (<><p className="cap">RISK SIGNALS</p>
  <div className="chips">{list.map((s) => <span key={s.label} className={s.raises ? "bad" : "ok"}>{s.label} {s.raises ? "raises" : "lowers"} risk</span>)}</div></>);

function Dashboard({ data, tab, setTab, go, back }) {
  const [sel, setSel] = useState(null);
  const [sig, setSig] = useState({ index: null, list: [] });
  const rows = data ? data.rows.filter((r) => tab === "All" || r.band === tab) : [];
  useEffect(() => { if (rows.length && !rows.some((r) => r.index === sel)) setSel(rows[0].index); }, [tab, data]);
  useEffect(() => {
    if (sel == null) return;
    let live = true;
    get(`/api/transaction/${sel}`).then((d) => live && setSig({ index: sel, list: d.signals })).catch(() => live && setSig({ index: sel, list: [] }));
    return () => { live = false; };
  }, [sel]);
  if (!data) return <p className="mut pad">Loading payments…</p>;
  const k = data.kpi, cur = rows.find((r) => r.index === sel), signals = sig.index === sel ? sig.list : [];
  return (
    <div className="app">
      <Side k={k} view="dash" go={go} setTab={setTab} />
      <main className="main">
        <div className="top"><div className="ttl"><Back back={back} /><div><h2>Fraud monitoring</h2><p className="mut">Payment activity and risk alerts</p></div></div><span className="env">Demo environment</span></div>
        <div className="kpis">
          <div className="card"><span>Payments monitored</span><b>{k.monitored}</b></div>
          <div className="card"><span>High risk</span><b className="bad">{k.high}</b></div>
          <div className="card"><span>Medium risk</span><b className="mid">{k.medium}</b></div>
          <div className="card"><span>Average risk score</span><b>{k.avg}</b></div>
        </div>
        <div className="work">
          <div className="card">
            <div className="tabs">{["All", "High", "Medium", "Low"].map((t) => <button key={t} className={t === tab ? "on" : ""} onClick={() => setTab(t)}>{t === "All" ? "All" : t + " risk"}</button>)}</div>
            <div className="tablewrap">
              <table>
                <thead><tr><th>Payment</th><th>Risk score</th><th>Amount</th><th>Level</th></tr></thead>
                <tbody>{rows.map((r) => (
                  <tr key={r.index} className={r.index === sel ? "sel" : ""} onClick={() => setSel(r.index)}>
                    <td><b>{r.ref}</b><small>{r.time}</small></td>
                    <td><div className="rb"><div className={tone[r.band]} style={{ width: r.score + "%" }} /></div>{Math.round(r.score)}</td>
                    <td>{money(r.amount)}</td><td><Badge b={r.band} /></td>
                  </tr>))}</tbody>
              </table>
              {rows.length === 0 && <p className="mut">No payments at this level.</p>}
            </div>
            <p className="mut small">Showing {rows.length} of {k.monitored} payments.</p>
          </div>
          <div className="card">
            <h3>Payment analysis</h3>
            {cur && (<>
              <Assess score={cur.score} band={cur.band} action={cur.action} />
              <dl><dt>Payment</dt><dd>{cur.ref}</dd><dt>Amount</dt><dd>{money(cur.amount)}</dd><dt>Time</dt><dd>{cur.time}</dd></dl>
              <Signals list={signals} />
            </>)}
          </div>
        </div>
      </main>
    </div>
  );
}

function Analyzer({ data, setTab, go, back }) {
  const [amount, setAmount] = useState("");
  const [hour, setHour] = useState(12);
  const [unusual, setUnusual] = useState(0);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const k = data ? data.kpi : { high: 0, medium: 0, low: 0 };
  const level = unusual < 34 ? "Typical" : unusual < 67 ? "Somewhat unusual" : "Very unusual";
  const run = async (e) => {
    e.preventDefault();
    const a = parseFloat(amount);
    if (!(a >= 0)) { setErr("Enter a valid amount."); return; }
    setErr(""); setBusy(true);
    try { setRes(await post("/api/analyze", { amount: a, hour: Number(hour), unusual: unusual / 100 })); }
    catch (x) { setErr(String(x.message || x)); setRes(null); }
    setBusy(false);
  };
  return (
    <div className="app">
      <Side k={k} view="analyze" go={go} setTab={setTab} />
      <main className="main">
        <div className="top"><div className="ttl"><Back back={back} /><div><h2>Risk analyzer</h2><p className="mut">Check the risk of a payment before you approve it</p></div></div><span className="env">Demo environment</span></div>
        <div className="analyze" style={{ marginTop: 20 }}>
          <form className="card" onSubmit={run}>
            <h3>Payment details</h3>
            <label className="field"><span>Amount</span><input type="number" min="0" step="0.01" placeholder="e.g. 250.00" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="field"><span>Time of day</span>
              <select value={hour} onChange={(e) => setHour(e.target.value)}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}</select></label>
            <label className="field"><span>Customer behaviour: <em>{level}</em></span>
              <input type="range" min="0" max="100" value={unusual} onChange={(e) => setUnusual(Number(e.target.value))} /></label>
            <p className="mut small">Behaviour signals normally come from the card network. Here the slider sets how closely the customer's activity matches typical or suspicious patterns seen in monitored payments.</p>
            {err && <p className="bad">{err}</p>}
            <button className="btn" disabled={busy}>{busy ? "Analyzing…" : "Analyze risk"}</button>
          </form>
          <div className="card">
            <h3>Analysis result</h3>
            {!res && <p className="mut">Enter an amount and press Analyze risk.</p>}
            {res && (<>
              <Assess score={res.score} band={res.band} action={res.action} />
              <p className="mut small">Logged in the activity log as {res.id}.</p>
              <p className="mut">This amount is larger than {res.amount_percentile}% of monitored payments.</p>
              <Signals list={res.signals} />
              <p className="mut small">Quick screening from amount, time and the behaviour level above. Real payments are scored with their full signal data.</p>
            </>)}
          </div>
        </div>
      </main>
    </div>
  );
}

const PageHead = ({ back, title, sub }) => (
  <div className="top"><div className="ttl"><Back back={back} /><div><h2>{title}</h2><p className="mut">{sub}</p></div></div><span className="env">Demo environment</span></div>
);

function Chart({ buckets }) {
  const W = 720, H = 250, P = { l: 36, r: 12, t: 12, b: 28 };
  const max = Math.max(3, ...buckets.map((b) => Math.max(b.high, b.medium)));
  const x = (i) => P.l + (i * (W - P.l - P.r)) / (buckets.length - 1);
  const y = (v) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = (key) => buckets.map((b, i) => [x(i), y(b[key])]).reduce((d, [px, py], i, arr) =>
    i === 0 ? `M${px},${py}` : `${d} C${(arr[i - 1][0] + px) / 2},${arr[i - 1][1]} ${(arr[i - 1][0] + px) / 2},${py} ${px},${py}`, "");
  const step = Math.ceil(max / 4), ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart">
      <defs><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff5a5f" stopOpacity=".35" /><stop offset="1" stopColor="#ff5a5f" stopOpacity="0" /></linearGradient></defs>
      {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="#2a2860" strokeDasharray="3 4" /><text x={P.l - 8} y={y(t) + 4} textAnchor="end" fill="#9a9cc8" fontSize="11">{t}</text></g>)}
      <path d={`${line("high")} L${x(buckets.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#gr)" />
      <path d={line("high")} fill="none" stroke="#ff5a5f" strokeWidth="3" />
      <path d={line("medium")} fill="none" stroke="#ffb020" strokeWidth="3" />
      {buckets.map((b, i) => i % 2 === 0 && <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fill="#9a9cc8" fontSize="11">{b.label}</text>)}
    </svg>
  );
}

function Analytics({ data, setTab, go, back }) {
  const [range, setRange] = useState("all");
  if (!data) return <p className="mut pad">Loading analytics…</p>;
  const span = range === "all" ? 172800 : 86400, start = range === "d2" ? 86400 : 0;
  const inR = data.feed.filter((r) => r.seconds >= start && r.seconds < start + span);
  const high = inR.filter((r) => r.band === "High"), med = inR.filter((r) => r.band === "Medium");
  const buckets = Array.from({ length: 12 }, (_, i) => {
    const a = start + (i * span) / 12, b = a + span / 12, g = inR.filter((r) => r.seconds >= a && r.seconds < b);
    const hh = String(Math.floor((a % 86400) / 3600)).padStart(2, "0") + ":00";
    return { high: g.filter((r) => r.band === "High").length, medium: g.filter((r) => r.band === "Medium").length, label: range === "all" ? `D${Math.floor(a / 86400) + 1} ${hh}` : hh };
  });
  const spots = [["Under 10", 0, 10], ["10 to 100", 10, 100], ["100 to 1,000", 100, 1000], ["1,000 and above", 1000, Infinity]].map(([name, lo, hi]) => {
    const g = inR.filter((r) => r.amount >= lo && r.amount < hi), h = g.filter((r) => r.band === "High").length;
    return { name, count: g.length, high: h, share: g.length ? (h / g.length) * 100 : 0 };
  }).sort((p, q) => q.share - p.share);
  const rate = inR.length ? ((high.length / inR.length) * 100).toFixed(1) : "0.0";
  return (
    <div className="app">
      <Side k={data.kpi} view="analytics" go={go} setTab={setTab} />
      <main className="main">
        <div className="top"><div className="ttl"><Back back={back} /><div><h2>Fraud analytics</h2><p className="mut">Payment risk patterns across {inR.length} monitored payments</p></div></div>
          <div className="rtabs">{[["d1", "Day 1"], ["d2", "Day 2"], ["all", "Both days"]].map(([v, l]) => <button key={v} className={range === v ? "on" : ""} onClick={() => setRange(v)}>{l}</button>)}</div></div>
        <div className="kpis five">
          <div className="card hot"><span>Value blocked</span><b className="bad">{money(high.reduce((s, r) => s + r.amount, 0))}</b></div>
          <div className="card"><span>Blocked</span><b>{high.length}</b></div>
          <div className="card"><span>Under review</span><b className="mid">{med.length}</b></div>
          <div className="card"><span>Alert rate</span><b>{rate}%</b></div>
          <div className="card"><span>Avg scoring time</span><b className="ok">{data.kpi.avg_ms}<small> ms</small></b></div>
        </div>
        <div className="an">
          <div className="card"><div className="top"><div><h3>Detection timeline</h3><p className="mut small">Blocked and under-review payments over time</p></div>
            <div className="legend"><span><i style={{ background: "#ff5a5f" }} />Blocked</span><span><i style={{ background: "#ffb020" }} />Under review</span></div></div>
            <Chart buckets={buckets} /></div>
          <div className="card"><div className="top"><h3>Risk by amount</h3><a className="lnk" onClick={() => { setTab("High"); go("dash"); }}>View high risk</a></div>
            {spots.map((s) => (
              <div key={s.name} className={"spot " + (s.share >= 30 ? "hot" : s.share >= 10 ? "warm" : "")}>
                <div><b>{s.name}</b><small className="mut">{s.high} of {s.count} payments high risk</small></div>
                <b className={s.share >= 30 ? "bad" : s.share >= 10 ? "mid" : "ok"}>{s.share.toFixed(0)}%</b>
              </div>))}
          </div>
        </div>
      </main>
    </div>
  );
}

const PAGE = 25;
const stamp = (t) => new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" });

function ActivityLog({ data, setTab, go, back }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [risk, setRisk] = useState("");
  const [q, setQ] = useState("");
  const [qIn, setQIn] = useState("");
  const [err, setErr] = useState("");
  const params = (extra) => new URLSearchParams({ risk, q, ...extra }).toString();
  useEffect(() => {
    get(`/api/activity?${params({ limit: PAGE, offset: page * PAGE })}`)
      .then((d) => { setItems(d.items); setTotal(d.total); setErr(""); })
      .catch(() => setErr("Could not load the activity log."));
  }, [page, risk, q]);
  const exportCsv = async () => {
    const d = await get(`/api/activity?${params({ limit: 100000, offset: 0 })}`);
    const head = ["Transaction ID", "Timestamp", "Amount", "Predicted class", "Fraud probability (%)", "Risk category", "Recommended action", "Source"];
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [head, ...d.items.map((r) => [r.id, r.timestamp, r.amount, r.predicted_class, r.probability, r.risk, r.action, r.source])].map((r) => r.map(esc).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "activity-log.csv";
    a.click();
  };
  const from = total ? page * PAGE + 1 : 0, to = Math.min(total, (page + 1) * PAGE);
  return (
    <div className="app">
      <Side k={data ? data.kpi : { high: 0, medium: 0, low: 0 }} view="log" go={go} setTab={setTab} />
      <main className="main">
        <PageHead back={back} title="Activity log" sub="A record of every analysed transaction" />
        <div className="card" style={{ marginTop: 20 }}>
          <div className="toolbar">
            <div className="tabs" style={{ margin: 0 }}>{[["", "All"], ["High", "High risk"], ["Medium", "Medium risk"], ["Low", "Low risk"]].map(([v, l]) => <button key={l} className={risk === v ? "on" : ""} onClick={() => { setRisk(v); setPage(0); }}>{l}</button>)}</div>
            <form onSubmit={(e) => { e.preventDefault(); setQ(qIn); setPage(0); }}><input placeholder="Search transaction ID" value={qIn} onChange={(e) => setQIn(e.target.value)} /></form>
            <span className="sp" /><button className="sbtn" onClick={exportCsv}>Export CSV</button>
          </div>
          {err && <p className="bad">{err}</p>}
          <div className="tablewrap" style={{ maxHeight: 620 }}>
            <table>
              <thead><tr><th>Transaction ID</th><th>Timestamp</th><th>Amount</th><th>Predicted class</th><th>Fraud probability</th><th>Risk category</th><th>Recommended action</th></tr></thead>
              <tbody>{items.map((r, n) => (
                <tr key={r.id + n}>
                  <td><b>{r.id}</b><small>{r.source}</small></td><td>{stamp(r.timestamp)}</td><td>{money(r.amount)}</td>
                  <td><span className={r.predicted_class === "Fraud" ? "bad" : "ok"}>{r.predicted_class}</span></td>
                  <td>{r.probability.toFixed(1)}%</td><td><Badge b={r.risk} /></td><td>{r.action}</td>
                </tr>))}</tbody>
            </table>
            {items.length === 0 && !err && <p className="mut">No records match.</p>}
          </div>
          <div className="pager">
            <button className="sbtn" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
            <span>{from} to {to} of {total}</span>
            <button className="sbtn" disabled={to >= total} onClick={() => setPage(page + 1)}>Next</button>
          </div>
          <p className="mut small">Records are append-only: entries cannot be edited or deleted here. Fraud probability is the model's score for the payment, not a calibrated chance.</p>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [stack, setStack] = useState(["home"]);
  const view = stack[stack.length - 1];
  const go = (v) => setStack((s) => (s[s.length - 1] === v ? s : [...s, v]));
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  const [tab, setTab] = useState("All");
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => { get("/api/overview").then(setData).catch(() => setErr(`Could not reach the backend on ${API}. Start it with: uvicorn main:app --reload`)); }, []);
  return (
    <>
      {view === "home" && (
        <nav className="nav"><div className="brand">Smart<span>Shield</span></div>
          <a href="#features">Features</a><a href="#how">How it works</a><a onClick={() => go("dash")}>Dashboard</a><a onClick={() => go("analyze")}>Risk analyzer</a>
          <span className="sp" /><button className="btn" onClick={() => go("dash")}>Open dashboard</button></nav>
      )}
      {err && <p className="err">{err}</p>}
      {view === "home" && <Home data={data} go={go} />}
      {view === "dash" && <Dashboard data={data} tab={tab} setTab={setTab} go={go} back={back} />}
      {view === "analyze" && <Analyzer data={data} setTab={setTab} go={go} back={back} />}
      {view === "analytics" && <Analytics data={data} setTab={setTab} go={go} back={back} />}
      {view === "log" && <ActivityLog data={data} setTab={setTab} go={go} back={back} />}
    </>
  );
}
