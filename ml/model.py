# ml/model.py - script pour le scoring des transactions
# A lancer avec --train pour generer le modele joblib
# TODO: verifier si on peut ajouter le pays d'origine du compte dans le futur

import argparse
import numpy as np
import json
from datetime import datetime

try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import (
        classification_report, confusion_matrix,
        roc_auc_score, precision_recall_curve
    )
    from sklearn.model_selection import train_test_split
    import joblib
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("⚠️  sklearn non installé. Lance : pip install scikit-learn joblib numpy")


# ── Génération de données d'entraînement simulées

def generate_training_data(n_samples: int = 10000):
    """
    Génère un dataset réaliste de transactions.
    Features : amount, hour, is_foreign_country, is_large_transfer, day_of_week
    """
    np.random.seed(42)

    # Transactions normales (90%)
    n_normal = int(n_samples * 0.90)
    normal = np.column_stack([
        np.random.exponential(150, n_normal),          # amount
        np.random.randint(8, 22, n_normal),            # hour (jour ouvré)
        np.random.choice([0, 1], n_normal, p=[0.95, 0.05]),  # is_foreign
        np.random.choice([0, 1], n_normal, p=[0.90, 0.10]),  # is_large_transfer
        np.random.randint(0, 7, n_normal),             # day_of_week
    ])
    y_normal = np.zeros(n_normal)

    # Transactions frauduleuses (10%)
    n_fraud = n_samples - n_normal
    fraud = np.column_stack([
        np.random.uniform(2000, 20000, n_fraud),       # montant élevé
        np.random.choice([0,1,2,3,22,23], n_fraud),    # heure nocturne
        np.random.choice([0, 1], n_fraud, p=[0.40, 0.60]),   # pays étranger
        np.random.choice([0, 1], n_fraud, p=[0.50, 0.50]),   # gros transfert
        np.random.randint(0, 7, n_fraud),
    ])
    y_fraud = np.ones(n_fraud)

    X = np.vstack([normal, fraud])
    y = np.concatenate([y_normal, y_fraud])

    # Shuffle
    idx = np.random.permutation(len(X))
    return X[idx], y[idx]




def extract_features(transaction: dict) -> np.ndarray:
    """
    Extrait les features d'une transaction pour le modèle.
    Compatible avec le format de main.py.
    """
    risky_countries = {"RU", "CN", "NG", "KP", "IR"}
    hour = transaction.get("hour", 12)
    amount = transaction.get("amount", 0)
    country = transaction.get("country", "FR")
    tx_type = transaction.get("transaction_type", "purchase")

    features = np.array([[
        amount,
        hour,
        1 if country in risky_countries else 0,
        1 if (tx_type == "transfer" and amount > 1000) else 0,
        datetime.now().weekday(),
    ]])
    return features


# ── Entraînement 

def train_model():
    if not SKLEARN_AVAILABLE:
        return

    print("🧠 Génération des données d'entraînement...")
    X, y = generate_training_data(10000)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Normalisation
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Isolation Forest — entraîné uniquement sur les données normales
    print("🌲 Entraînement Isolation Forest...")
    X_normal = X_train_scaled[y_train == 0]
    model = IsolationForest(
        n_estimators=200,
        contamination=0.10,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_normal)

    # Évaluation
    print("\n📊 Évaluation du modèle :")
    y_pred_raw = model.predict(X_test_scaled)
    y_pred = (y_pred_raw == -1).astype(int)  # -1 = anomalie → 1

    print(classification_report(y_test, y_pred, target_names=["Normal", "Fraud"]))
    print("Matrice de confusion :")
    print(confusion_matrix(y_test, y_pred))

    # Score d'anomalie pour ROC-AUC
    anomaly_scores = -model.score_samples(X_test_scaled)
    auc = roc_auc_score(y_test, anomaly_scores)
    print(f"AUC-ROC : {auc:.4f}")

    # Sauvegarde
    joblib.dump(model, "model.joblib")
    joblib.dump(scaler, "scaler.joblib")

    metrics = {
        "auc_roc": round(auc, 4),
        "model_type": "IsolationForest",
        "n_estimators": 200,
        "trained_at": datetime.now().isoformat(),
        "training_samples": len(X_train),
    }
    with open("model_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    print("\n✅ Modèle sauvegardé : model.joblib")
    return model, scaler


# ── Prédiction ( Note a moi meme : oublie pas de revenir sur ce point)

def predict(transaction: dict, model=None, scaler=None) -> dict:
    """
    Prédit le score de risque d'une transaction.
    Retourne un dict compatible avec le format de main.py.
    """
    if not SKLEARN_AVAILABLE:
        return {"score": 0, "level": "NORMAL", "flags": ["ML_UNAVAILABLE"]}

    try:
        if model is None:
            model = joblib.load("model.joblib")
            scaler = joblib.load("scaler.joblib")
    except FileNotFoundError:
        return {"score": 0, "level": "NORMAL", "flags": ["MODEL_NOT_TRAINED"]}

    features = extract_features(transaction)
    features_scaled = scaler.transform(features)

    # Score d'anomalie (plus élevé = plus suspect)
    raw_score = -model.score_samples(features_scaled)[0]

    # Normalise entre 0 et 100
    score = int(min(max((raw_score - 0.1) / 0.5 * 100, 0), 100))

    if score >= 70:
        level = "CRITICAL"
    elif score >= 40:
        level = "WARNING"
    else:
        level = "NORMAL"

    return {"score": score, "level": level, "flags": ["ML_PREDICTION"], "ml_raw": round(raw_score, 4)}


# ── CLI 

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FraudSentinel ML")
    parser.add_argument("--train", action="store_true", help="Entraîne le modèle")
    parser.add_argument("--eval", action="store_true", help="Évalue sur données de test")
    args = parser.parse_args()

    if args.train or args.eval:
        train_model()
    else:
        # Demo
        test_tx = {"amount": 8500, "hour": 2, "country": "RU", "transaction_type": "transfer"}
        print("Transaction test :", test_tx)
        print("Résultat :", predict(test_tx))
