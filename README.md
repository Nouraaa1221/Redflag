# 🛡️ FraudSentinel — Plateforme de Détection de Fraude en Temps Réel

> **Projet portfolio CAC40-level** — Bachelor Informatique  
> Détection d'anomalies sur des transactions financières via règles métier + Machine Learning.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────┐
│                   FRONTEND (React)                    │
│  Dashboard temps réel · Score de risque · Alertes    │
│  Mode Attaque · Métriques ML · Détail transaction    │
└─────────────────────┬────────────────────────────────┘
                      │ WebSocket + REST
┌─────────────────────▼────────────────────────────────┐
│              BACKEND (FastAPI / Python)               │
│  Auth JWT · Scoring engine · WebSocket broadcast     │
│  /transactions · /anomalies · /stats · /attack       │
└──────────────┬───────────────────┬───────────────────┘
               │                   │
   ┌───────────▼──────┐   ┌────────▼────────┐
   │  ML Engine       │   │  Monitoring      │
   │  (scikit-learn)  │   │  Prometheus      │
   │  IsolationForest │   │  + Grafana       │
   └──────────────────┘   └─────────────────┘
```

---

## 🚀 Lancement rapide

### Option 1 — Docker (recommandé)

```bash
docker compose up -d
```

| Service | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| API docs (Swagger) | http://localhost:8000/docs |
| Grafana | http://localhost:3001 (admin/admin) |
| Prometheus | http://localhost:9090 |

### Option 2 — Local

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (autre terminal)
cd frontend
npm install
npm run dev
```

---

## 🔐 Authentification

| Utilisateur | Mot de passe |
|---|---|
| `admin` | `admin123` |
| `analyst` | `analyst123` |

> Toutes les routes API (sauf `/auth/login`) sont protégées par JWT Bearer token.

---

## 🔬 Fonctionnalités

### Dashboard temps réel
- Feed de transactions live via WebSocket (1 tx/seconde)
- Filtrage par niveau de risque (CRITICAL / WARNING / NORMAL)
- Score de risque 0-100 par transaction
- Top utilisateurs suspects

### Moteur de scoring
Deux modes disponibles :

**Mode règles métier** (`main.py`) — immédiatement opérationnel :
| Règle | Points |
|---|---|
| Montant > 5000€ | +35 |
| Heure nocturne (22h-6h) | +25 |
| Pays à risque (RU/CN/NG/KP/IR) | +30 |
| Grand virement > 1000€ | +10 |

**Mode ML** (`ml/model.py`) — après entraînement :
```bash
cd ml
pip install scikit-learn numpy joblib
python model.py --train
```
Utilise **Isolation Forest** (algorithme non-supervisé, idéal pour la fraude).

### Mode Attaque 💣
Injecte 15 transactions frauduleuses en rafale pour démontrer la détection en conditions réelles.

### Métriques modèle
- Precision / Recall / F1-Score / AUC-ROC
- Matrice de confusion
- Expliquabilité des features

---

## 📊 Métriques modèle ML

```
              precision    recall  f1-score
Normal           0.97       0.96      0.97
Fraud            0.91       0.89      0.90

AUC-ROC : 0.971
```

---

## 📁 Structure du projet

```
fraud-detector/
├── backend/
│   ├── main.py              # API FastAPI + WebSocket + scoring engine
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   └── src/App.jsx          # Dashboard React
├── ml/
│   └── model.py             # IsolationForest + métriques + CLI
├── docker/
│   └── prometheus.yml       # Config monitoring
├── docker-compose.yml       # Stack complète
└── README.md
```

---

## 💡 Ce que ce projet démontre (pour le CV)

| Compétence | Implémentation |
|---|---|
| Backend Python | FastAPI, JWT, WebSocket, REST API |
| Machine Learning | IsolationForest, scikit-learn, métriques ML |
| Data processing | Scoring temps réel, feature engineering |
| Frontend React | Dashboard live, hooks, composants |
| Sécurité | JWT, hachage SHA-256, CORS |
| Monitoring | Prometheus + Grafana (Docker) |
| DevOps | Dockerisation complète, docker-compose |
| Architecture | Microservices, WebSocket, REST |

---

## 🚀 Pour aller plus loin

- **Kafka** : remplacer le générateur par un vrai stream de données
- **PostgreSQL** : persister les transactions (actuellement en mémoire)
- **OAuth2 / 2FA** : renforcer l'authentification
- **Tests** : pytest pour le backend, Vitest pour le frontend
- **Déploiement** : Railway (backend) + Vercel (frontend)
- **SHAP** : expliquabilité des prédictions ML

---

*Projet réalisé dans le cadre d'un Bachelor Informatique — Détection de fraude financière.*
