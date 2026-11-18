from pathlib import Path

import joblib
import pandas as pd
import xgboost

ART = Path(__file__).resolve().parent / "artifacts"

def load_model():
    skeleton = ART / "stack_skeleton.pkl"
    if skeleton.exists():
        m = joblib.load(skeleton)
        x = xgboost.XGBClassifier()
        x.load_model(str(ART / "xgb_part.ubj"))
        i = [n for n, _ in m.estimators].index("xgb")
        m.estimators_[i] = x
        m.named_estimators_["xgb"] = x
        return m

    return joblib.load(ART / "stacking_model.pkl")

model = load_model()
d = pd.read_csv(ART / "demo_transactions.csv")
f = [c for c in d.columns if c not in ("Actual_Class", "Txn_ID", "Amount_raw", "Time_raw")]
p = model.predict_proba(d[f])[:, 1]

print("frauds flagged:", (p[d.Actual_Class == 1] >= 0.5).sum(), "of", (d.Actual_Class == 1).sum())
print("genuine flagged:", (p[d.Actual_Class == 0] >= 0.5).sum(), "of", (d.Actual_Class == 0).sum())

import sklearn, numpy, scipy
print(sklearn.__version__, xgboost.__version__, numpy.__version__, scipy.__version__)
print(p[d.Actual_Class == 1][:5].round(4))