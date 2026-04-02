# 🛡️ Redflag — Plateforme de Détection de Fraude en Temps Réel


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

---

## 🚀 Évolutions prévues

Pour transformer ce prototype en une solution de production industrielle, les axes de développement suivants sont identifiés :

* **Persistance SQL (PostgreSQL) :** Migration du stockage actuel "en mémoire" vers une base de données relationnelle pour assurer l'historisation et la traçabilité des transactions à long terme.
* **Intégration de Kafka :** Mise en place d'un bus de messages pour gérer l'ingestion de flux de données à très haute fréquence et passer d'un simulateur à un flux de production réel.
* **Reporting de Conformité :** Génération automatique de rapports périodiques résumant les alertes critiques et les statistiques d'anomalies par zone géographique.
* **Audit Trail & Logs :** Journalisation immuable de toutes les actions d'administration et des modifications de seuils de scoring pour répondre aux exigences de sécurité bancaire.
* **Authentification Multi-Facteurs (MFA) :** Renforcement de la sécurité des accès au dashboard pour les profils "Analyste" et "Administrateur".

---
