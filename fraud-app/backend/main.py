import datetime as dt
import sqlite3
import threading
import time
from contextlib import closing
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import xgboost
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ART = Path(__file__).parent / "artifacts"
def load_model():
    skeleton = ART / "stack_skeleton.pkl"
    if not skeleton.exists():
        return joblib.load(ART / "stacking_model.pkl")
    m = joblib.load(skeleton)
    x = xgboost.XGBClassifier()
    x.load_model(str(ART / "xgb_part.ubj"))
    i = [n for n, _ in m.estimators].index("xgb")
    m.estimators_[i] = x
    m.named_estimators_["xgb"] = x
    return m


model = load_model()
raw = pd.read_csv(ART / "demo_transactions.csv")
EXTRA = [c for c in ("Actual_Class", "Txn_ID", "Amount_raw", "Time_raw") if c in raw.columns]
FEATURES = [c for c in raw.columns if c not in EXTRA]

# Demo traffic: every genuine payment plus a small share of fraud, so the feed looks like real traffic
if "Actual_Class" in raw:
    fraud = raw[raw["Actual_Class"] == 1]
    demo = pd.concat([raw[raw["Actual_Class"] == 0], fraud.sample(min(15, len(fraud)), random_state=3)])
else:
    demo = raw
demo = demo.reset_index(drop=True)
probs = model.predict_proba(demo[FEATURES])[:, 1]

# Used only when the original Amount/Time columns are missing: undo the standard scaling
AMOUNT_MEAN, AMOUNT_STD = 88.349619, 250.11967
TIME_MEAN, TIME_STD = 94813.859575, 47488.0626

ACTION = {"High": "Block and send for review", "Medium": "Ask for extra verification", "Low": "Approve"}
booster = None
try:
    booster = model.named_estimators_["xgb"].get_booster()
except Exception:
    pass

app = FastAPI(title="SmartShield API")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


def band(p):
    return "High" if p >= 0.5 else "Medium" if p >= 0.2 else "Low"


def row(i):
    r, p = demo.iloc[i], float(probs[i])
    amount = float(r["Amount_raw"]) if "Amount_raw" in demo else max(0.0, round(float(r["Amount_scaled"]) * AMOUNT_STD + AMOUNT_MEAN, 2))
    secs = float(r["Time_raw"]) if "Time_raw" in demo else float(r["Time_scaled"]) * TIME_STD + TIME_MEAN
    secs = max(0.0, secs)
    d, rem = divmod(int(secs), 86400)
    tid = int(r["Txn_ID"]) if "Txn_ID" in demo else i
    return {"index": i, "ref": f"TXN-{tid:06d}", "amount": amount, "seconds": secs,
            "time": f"Day {d + 1}, {rem // 3600:02d}:{rem % 3600 // 60:02d}",
            "score": round(p * 100, 1), "band": band(p), "action": ACTION[band(p)]}


def signals_for(frame):
    if booster is None:
        return []
    try:
        c = booster.predict(xgboost.DMatrix(frame[FEATURES]), pred_contribs=True)[0][:-1]
        out = []
        for j in np.argsort(-np.abs(c))[:4]:
            n = FEATURES[j]
            label = "Transaction amount" if n == "Amount_scaled" else "Transaction timing" if n == "Time_scaled" else "Signal " + n[1:]
            out.append({"label": label, "raises": bool(c[j] > 0)})
        return out
    except Exception:
        return []


def signals(i):
    return signals_for(demo.iloc[[i]])


# ---- Scoring time and the append-only activity log (audit trail) ----
def _latency():
    x = demo[FEATURES].iloc[[0]]
    model.predict_proba(x)
    t = time.perf_counter()
    for _ in range(10):
        model.predict_proba(x)
    return round((time.perf_counter() - t) / 10 * 1000, 1)


LATENCY_MS = _latency()
DB = Path(__file__).parent / "activity.db"
_lock = threading.Lock()


def sql(query, args=(), write=False):
    with _lock, closing(sqlite3.connect(DB)) as con:
        rows = con.execute(query, args).fetchall()
        if write:
            con.commit()
        return rows


sql("CREATE TABLE IF NOT EXISTS activity (id INTEGER PRIMARY KEY AUTOINCREMENT, txn_id TEXT, ts TEXT, amount REAL, "
    "predicted TEXT, probability REAL, band TEXT, action TEXT, source TEXT)", write=True)


def log_event(prefix, amount, p, source, txn_id=None):
    n = sql("SELECT COUNT(*) FROM activity WHERE source = ?", (source,))[0][0] + 1
    txn_id = txn_id or f"{prefix}-{n:06d}"
    sql("INSERT INTO activity (txn_id, ts, amount, predicted, probability, band, action, source) VALUES (?,?,?,?,?,?,?,?)",
        (txn_id, dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), float(amount),
         "Fraud" if p >= 0.5 else "Legitimate", round(p * 100, 1), band(p), ACTION[band(p)], source), write=True)
    return txn_id


if not sql("SELECT 1 FROM activity WHERE source = 'Monitored feed' LIMIT 1"):  # first start: record the monitored payments once
    for r in sorted((row(i) for i in range(len(demo))), key=lambda r: r["seconds"]):
        log_event("TXN", r["amount"], float(probs[r["index"]]), "Monitored feed", r["ref"])


class PredictIn(BaseModel):
    features: dict[str, float]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/api/overview")
def overview():
    rows = [row(i) for i in range(len(demo))]
    bands = [r["band"] for r in rows]
    return {
        "kpi": {"monitored": len(rows), "high": bands.count("High"), "medium": bands.count("Medium"),
                "low": bands.count("Low"), "avg": round(float(probs.mean()) * 100, 1), "avg_ms": LATENCY_MS},
        "rows": sorted(rows, key=lambda r: -r["score"]),
        "feed": sorted(rows, key=lambda r: r["seconds"]),
    }


@app.get("/api/transaction/{i}")
def transaction(i: int):
    if not 0 <= i < len(demo):
        raise HTTPException(404, "No such transaction")
    return {**row(i), "signals": signals(i)}


@app.post("/predict")
def predict(body: PredictIn):
    missing = [f for f in FEATURES if f not in body.features]
    if missing:
        raise HTTPException(422, f"Missing features: {missing}")
    p = float(model.predict_proba(pd.DataFrame([[body.features[f] for f in FEATURES]], columns=FEATURES))[0, 1])
    log_event("API", max(0.0, body.features["Amount_scaled"] * AMOUNT_STD + AMOUNT_MEAN), p, "API")
    return {"score": round(p * 100, 1), "band": band(p), "action": ACTION[band(p)]}


# ---- Risk analyzer: amount and time are real inputs; customer-behaviour signals come from typical or suspicious profiles ----
SIGNAL_COLS = [c for c in FEATURES if c not in ("Amount_scaled", "Time_scaled")]
typical = demo.loc[probs < 0.2, SIGNAL_COLS].median()
suspicious = demo.loc[probs >= 0.5, SIGNAL_COLS].median() if (probs >= 0.5).any() else typical
amounts = np.array([row(i)["amount"] for i in range(len(demo))])


class AnalyzeIn(BaseModel):
    amount: float
    hour: int = 12
    unusual: float = 0.0


@app.post("/api/analyze")
def analyze(body: AnalyzeIn):
    if not 0 <= body.amount <= 1_000_000:
        raise HTTPException(422, "Enter an amount between 0 and 1,000,000")
    u = min(max(body.unusual, 0.0), 1.0)
    vals = (typical + u * (suspicious - typical)).to_dict()
    vals["Amount_scaled"] = (body.amount - AMOUNT_MEAN) / AMOUNT_STD
    vals["Time_scaled"] = (min(max(body.hour, 0), 23) * 3600 - TIME_MEAN) / TIME_STD
    frame = pd.DataFrame([vals])[FEATURES]
    p = float(model.predict_proba(frame)[0, 1])
    ref = log_event("ANL", body.amount, p, "Risk analyzer")
    return {"id": ref, "score": round(p * 100, 1), "band": band(p), "action": ACTION[band(p)],
            "signals": signals_for(frame), "amount_percentile": round(float((amounts < body.amount).mean() * 100), 1)}


@app.get("/api/activity")
def activity(limit: int = 25, offset: int = 0, risk: str = "", q: str = ""):
    where, args = [], []
    if risk in ("High", "Medium", "Low"):
        where.append("band = ?")
        args.append(risk)
    if q.strip():
        where.append("txn_id LIKE ?")
        args.append(f"%{q.strip()}%")
    clause = (" WHERE " + " AND ".join(where)) if where else ""
    total = sql("SELECT COUNT(*) FROM activity" + clause, tuple(args))[0][0]
    rows = sql("SELECT txn_id, ts, amount, predicted, probability, band, action, source FROM activity" + clause +
               " ORDER BY id DESC LIMIT ? OFFSET ?", tuple(args) + (min(max(limit, 1), 100000), max(offset, 0)))
    keys = ["id", "timestamp", "amount", "predicted_class", "probability", "risk", "action", "source"]
    return {"total": total, "items": [dict(zip(keys, r)) for r in rows]}
