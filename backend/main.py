"""
FraudSentinel — Backend API (FastAPI)
======================================
Détection d'anomalies en temps réel sur des transactions financières.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional
import asyncio
import random
import math
import time
import json
import jwt
import hashlib
from datetime import datetime, timedelta
from collections import deque

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY = "fraudsentinel-secret-2024"
ALGORITHM = "HS256"

app = FastAPI(title="FraudSentinel API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# ── In-memory state (remplace par PostgreSQL en prod) ─────────────────────────
transactions_history: deque = deque(maxlen=500)
anomalies_log: list = []
connected_clients: list = []
attack_mode_active: bool = False

# Utilisateurs demo
USERS = {
    "admin": hashlib.sha256("admin123".encode()).hexdigest(),
    "analyst": hashlib.sha256("analyst123".encode()).hexdigest(),
}

# ── Modèles Pydantic ──────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class Transaction(BaseModel):
    amount: float
    merchant: str
    country: str
    user_id: str
    transaction_type: str  # "purchase", "transfer", "withdrawal"
    hour: int  # 0-23

class AttackRequest(BaseModel):
    mode: str  # "flood", "high_amount", "foreign", "off_hours"
    intensity: int = 5  # 1-10


# ── Auth ──────────────────────────────────────────────────────────────────────
def create_token(username: str) -> str:
    payload = {
        "sub": username,
        "exp": datetime.utcnow() + timedelta(hours=8),
        "iat": datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expiré")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


# ── Moteur de scoring d'anomalie ──────────────────────────────────────────────
def compute_risk_score(tx: dict) -> dict:
    """
    Calcule un score de risque de 0 à 100 basé sur des règles métier.
    En production : remplacer par le modèle ML (voir ml/model.py).
    """
    score = 0
    flags = []

    # Règle 1 : montant élevé
    if tx["amount"] > 5000:
        score += 35
        flags.append("HIGH_AMOUNT")
    elif tx["amount"] > 2000:
        score += 15
        flags.append("MEDIUM_AMOUNT")

    # Règle 2 : heure inhabituelle (22h-6h)
    hour = tx.get("hour", 12)
    if hour >= 22 or hour <= 6:
        score += 25
        flags.append("OFF_HOURS")

    # Règle 3 : pays à risque
    risky_countries = ["RU", "CN", "NG", "KP", "IR"]
    if tx.get("country") in risky_countries:
        score += 30
        flags.append("FOREIGN_COUNTRY")

    # Règle 4 : type de transaction à risque
    if tx.get("transaction_type") == "transfer" and tx["amount"] > 1000:
        score += 10
        flags.append("LARGE_TRANSFER")

    # Règle 5 : mode attaque injecte du bruit
    if attack_mode_active:
        score += random.randint(20, 40)
        flags.append("ATTACK_SIMULATION")

    score = min(score, 100)

    if score >= 70:
        level = "CRITICAL"
    elif score >= 40:
        level = "WARNING"
    else:
        level = "NORMAL"

    return {"score": score, "level": level, "flags": flags}


# ── Générateur de transactions simulées ───────────────────────────────────────
def generate_transaction(force_anomaly: bool = False) -> dict:
    merchants = ["Amazon", "Carrefour", "SNCF", "Apple", "Zara", "Fnac", "PayPal", "Binance"]
    countries = ["FR", "US", "DE", "GB", "ES", "IT", "RU", "CN", "NG"]
    users = [f"USR_{i:04d}" for i in range(1, 51)]
    tx_types = ["purchase", "transfer", "withdrawal"]

    if force_anomaly:
        amount = random.uniform(3000, 15000)
        country = random.choice(["RU", "CN", "NG", "KP"])
        hour = random.choice([0, 1, 2, 3, 23, 22])
    else:
        amount = random.expovariate(1/200)  # distribution réaliste
        amount = min(amount, 500) + random.uniform(0, 50)
        country = random.choices(countries, weights=[60,15,8,5,4,3,2,2,1])[0]
        hour = random.randint(8, 21)

    tx = {
        "id": f"TX_{int(time.time()*1000)}_{random.randint(100,999)}",
        "timestamp": datetime.utcnow().isoformat(),
        "amount": round(amount, 2),
        "merchant": random.choice(merchants),
        "country": country,
        "user_id": random.choice(users),
        "transaction_type": random.choice(tx_types),
        "hour": hour,
    }

    risk = compute_risk_score(tx)
    tx.update(risk)
    return tx


# ── WebSocket broadcast ───────────────────────────────────────────────────────
async def broadcast(data: dict):
    disconnected = []
    for ws in connected_clients:
        try:
            await ws.send_json(data)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        connected_clients.remove(ws)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.post("/auth/login")
def login(req: LoginRequest):
    hashed = hashlib.sha256(req.password.encode()).hexdigest()
    if req.username not in USERS or USERS[req.username] != hashed:
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    token = create_token(req.username)
    return {"token": token, "username": req.username}


@app.get("/transactions")
def get_transactions(limit: int = 50, user=Depends(verify_token)):
    return list(transactions_history)[-limit:]


@app.get("/anomalies")
def get_anomalies(user=Depends(verify_token)):
    return anomalies_log[-100:]


@app.get("/stats")
def get_stats(user=Depends(verify_token)):
    txs = list(transactions_history)
    if not txs:
        return {"total": 0, "anomalies": 0, "critical": 0, "avg_score": 0}
    total = len(txs)
    anomalies = sum(1 for t in txs if t["level"] != "NORMAL")
    critical = sum(1 for t in txs if t["level"] == "CRITICAL")
    avg_score = sum(t["score"] for t in txs) / total
    total_amount = sum(t["amount"] for t in txs)
    return {
        "total": total,
        "anomalies": anomalies,
        "critical": critical,
        "avg_score": round(avg_score, 1),
        "anomaly_rate": round(anomalies / total * 100, 1),
        "total_amount": round(total_amount, 2),
        "attack_mode": attack_mode_active,
    }


@app.post("/transaction/analyze")
def analyze_transaction(tx: Transaction, user=Depends(verify_token)):
    """Analyse manuelle d'une transaction."""
    data = tx.dict()
    data["id"] = f"TX_MANUAL_{int(time.time())}"
    data["timestamp"] = datetime.utcnow().isoformat()
    risk = compute_risk_score(data)
    data.update(risk)
    transactions_history.append(data)
    if data["level"] != "NORMAL":
        anomalies_log.append(data)
    return data


@app.post("/attack")
async def trigger_attack(req: AttackRequest, user=Depends(verify_token)):
    """Mode attaque : injecte un burst de transactions suspectes."""
    global attack_mode_active
    attack_mode_active = True

    injected = []
    count = req.intensity * 3

    for _ in range(count):
        tx = generate_transaction(force_anomaly=True)
        transactions_history.append(tx)
        anomalies_log.append(tx)
        injected.append(tx)
        await broadcast({"type": "transaction", "data": tx})
        await asyncio.sleep(0.05)

    attack_mode_active = False
    await broadcast({"type": "attack_end", "data": {"injected": count}})

    return {"message": f"{count} transactions suspectes injectées", "mode": req.mode}


@app.get("/model/metrics")
def get_model_metrics(user=Depends(verify_token)):
    """Métriques du modèle de détection (simulées — branche vers sklearn en prod)."""
    return {
        "accuracy": 0.943,
        "precision": 0.912,
        "recall": 0.887,
        "f1_score": 0.899,
        "auc_roc": 0.971,
        "confusion_matrix": {
            "true_positive": 887,
            "false_positive": 86,
            "true_negative": 8924,
            "false_negative": 113,
        },
        "model_type": "Rule-based + Isolation Forest",
        "last_trained": "2024-11-01T08:00:00",
        "training_samples": 10000,
    }


# ── WebSocket temps réel ──────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.append(ws)
    try:
        # Envoie les 20 dernières transactions au nouveau client
        recent = list(transactions_history)[-20:]
        for tx in recent:
            await ws.send_json({"type": "transaction", "data": tx})

        # Stream de transactions en temps réel
        while True:
            tx = generate_transaction(force_anomaly=random.random() < 0.12)
            transactions_history.append(tx)
            if tx["level"] != "NORMAL":
                anomalies_log.append(tx)
            await broadcast({"type": "transaction", "data": tx})
            await asyncio.sleep(random.uniform(0.8, 2.5))
    except WebSocketDisconnect:
        connected_clients.remove(ws) if ws in connected_clients else None


@app.get("/health")
def health():
    return {"status": "ok", "clients": len(connected_clients), "attack_mode": attack_mode_active}
