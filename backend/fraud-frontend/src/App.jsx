import { useState, useEffect, useRef, useCallback } from "react";

// ── Mock data generator (simule le WebSocket sans backend) ────────────────────
const MERCHANTS = ["Amazon", "Carrefour", "SNCF", "Apple", "Zara", "Fnac", "PayPal", "Binance"];
const COUNTRIES = ["FR","FR","FR","FR","US","DE","GB","RU","CN","NG"];
const TX_TYPES = ["purchase","purchase","purchase","transfer","withdrawal"];
const USERS = Array.from({length:20}, (_,i) => `USR_${String(i+1).padStart(4,'0')}`);

let txCounter = 1000;
function generateTx(forceAnomaly = false) {
  const id = `TX_${++txCounter}`;
  const amount = forceAnomaly
    ? Math.random() * 12000 + 3000
    : Math.random() < 0.05 ? Math.random() * 3000 + 500 : Math.random() * 300 + 10;
  const hour = forceAnomaly
    ? [0,1,2,3,22,23][Math.floor(Math.random()*6)]
    : Math.floor(Math.random()*14)+7;
  const country = forceAnomaly
    ? ["RU","CN","NG","KP"][Math.floor(Math.random()*4)]
    : COUNTRIES[Math.floor(Math.random()*COUNTRIES.length)];
  const txType = TX_TYPES[Math.floor(Math.random()*TX_TYPES.length)];

  let score = 0; const flags = [];
  if (amount > 5000) { score += 35; flags.push("HIGH_AMOUNT"); }
  else if (amount > 2000) { score += 15; flags.push("MEDIUM_AMOUNT"); }
  if (hour >= 22 || hour <= 6) { score += 25; flags.push("OFF_HOURS"); }
  if (["RU","CN","NG","KP","IR"].includes(country)) { score += 30; flags.push("FOREIGN_COUNTRY"); }
  if (txType === "transfer" && amount > 1000) { score += 10; flags.push("LARGE_TRANSFER"); }
  score = Math.min(score + (forceAnomaly ? Math.floor(Math.random()*20) : 0), 100);

  const level = score >= 70 ? "CRITICAL" : score >= 40 ? "WARNING" : "NORMAL";
  return { id, timestamp: new Date().toISOString(), amount: Math.round(amount*100)/100,
    merchant: MERCHANTS[Math.floor(Math.random()*MERCHANTS.length)],
    country, user_id: USERS[Math.floor(Math.random()*USERS.length)],
    transaction_type: txType, hour, score, level, flags };
}

// ── Sparkline mini-chart ──────────────────────────────────────────────────────
function Sparkline({ data, color }) {
  if (!data.length) return null;
  const w = 80, h = 28;
  const max = Math.max(...data, 1);
  const pts = data.map((v,i) => {
    const x = (i/(data.length-1||1))*w;
    const y = h - (v/max)*h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
    </svg>
  );
}

// ── Risk badge ────────────────────────────────────────────────────────────────
function RiskBadge({ level, score }) {
  const cfg = {
    CRITICAL: { bg: "#ff2d55", text: "#fff", glow: "0 0 8px #ff2d5580" },
    WARNING:  { bg: "#ff9f0a", text: "#000", glow: "0 0 8px #ff9f0a60" },
    NORMAL:   { bg: "#30d158", text: "#000", glow: "none" },
  }[level];
  return (
    <span style={{
      background: cfg.bg, color: cfg.text, padding: "2px 8px",
      borderRadius: 4, fontSize: 11, fontWeight: 700,
      boxShadow: cfg.glow, fontFamily: "'JetBrains Mono', monospace",
      letterSpacing: "0.03em"
    }}>
      {level} · {score}
    </span>
  );
}

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score }) {
  const r = 28, circ = 2*Math.PI*r;
  const color = score>=70?"#ff2d55":score>=40?"#ff9f0a":"#30d158";
  const dash = (score/100)*circ;
  return (
    <svg width={72} height={72} style={{transform:"rotate(-90deg)"}}>
      <circle cx={36} cy={36} r={r} fill="none" stroke="#1c1c1e" strokeWidth={6}/>
      <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{transition:"stroke-dasharray 0.4s ease"}}/>
      <text x={36} y={40} textAnchor="middle"
        style={{fill:color,fontSize:14,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",
          transform:"rotate(90deg)",transformOrigin:"36px 36px"}}>
        {score}
      </text>
    </svg>
  );
}

// ── Bar chart for score distribution ─────────────────────────────────────────
function ScoreDistChart({ transactions }) {
  const bins = Array(10).fill(0);
  transactions.forEach(t => { bins[Math.min(Math.floor(t.score/10),9)]++; });
  const max = Math.max(...bins, 1);
  const labels = ["0","10","20","30","40","50","60","70","80","90"];
  const colors = bins.map((_,i) => i>=7?"#ff2d55":i>=4?"#ff9f0a":"#30d158");
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:4,height:60,padding:"0 4px"}}>
      {bins.map((v,i) => (
        <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <div style={{width:"100%",height: v ? Math.max((v/max)*52,2) : 0,
            background:colors[i],borderRadius:"2px 2px 0 0",
            transition:"height 0.4s ease", minHeight: v ? 2 : 0}}/>
          <span style={{fontSize:8,color:"#48484a",fontFamily:"'JetBrains Mono',monospace"}}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function FraudSentinel() {
  const [transactions, setTransactions] = useState([]);
  const [attackActive, setAttackActive] = useState(false);
  const [attackCountdown, setAttackCountdown] = useState(0);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [selectedTx, setSelectedTx] = useState(null);
  const [isLive, setIsLive] = useState(true);
  const [alertPulse, setAlertPulse] = useState(false);
  const intervalRef = useRef(null);
  const listRef = useRef(null);

  const addTransaction = useCallback((tx) => {
    setTransactions(prev => {
      const next = [tx, ...prev].slice(0, 200);
      return next;
    });
    setScoreHistory(prev => [...prev.slice(-39), tx.score]);
    if (tx.level === "CRITICAL") {
      setAlertPulse(true);
      setTimeout(() => setAlertPulse(false), 600);
    }
  }, []);

  useEffect(() => {
    // Pre-populate
    const initial = Array.from({length:30}, (_,i) => generateTx(Math.random()<0.1));
    initial.forEach(t => {
      setTransactions(prev => [...prev, t]);
      setScoreHistory(prev => [...prev.slice(-39), t.score]);
    });
  }, []);

  useEffect(() => {
    if (!isLive) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      addTransaction(generateTx(Math.random() < 0.08));
    }, 1200);
    return () => clearInterval(intervalRef.current);
  }, [isLive, addTransaction]);

  const triggerAttack = async () => {
    if (attackActive) return;
    setAttackActive(true);
    setAttackCountdown(15);
    const timer = setInterval(() => setAttackCountdown(p => { if(p<=1){clearInterval(timer);return 0;}return p-1; }), 1000);
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 200));
      addTransaction(generateTx(true));
    }
    setTimeout(() => setAttackActive(false), 15000);
  };

  const stats = {
    total: transactions.length,
    critical: transactions.filter(t=>t.level==="CRITICAL").length,
    warning: transactions.filter(t=>t.level==="WARNING").length,
    normal: transactions.filter(t=>t.level==="NORMAL").length,
    avgScore: transactions.length ? Math.round(transactions.reduce((a,t)=>a+t.score,0)/transactions.length) : 0,
    anomalyRate: transactions.length ? Math.round((transactions.filter(t=>t.level!=="NORMAL").length/transactions.length)*100) : 0,
    totalAmount: transactions.reduce((a,t)=>a+t.amount,0),
  };

  const filtered = transactions.filter(t => filter==="ALL" || t.level===filter);

  const S = {
    app: { minHeight:"100vh", background:"#000", color:"#f2f2f7",
      fontFamily:"'SF Pro Display', -apple-system, sans-serif", padding:0 },
    header: { background:"#0a0a0a", borderBottom:"1px solid #1c1c1e",
      padding:"16px 24px", display:"flex", alignItems:"center", justifyContent:"space-between",
      position:"sticky", top:0, zIndex:100 },
    logo: { display:"flex", alignItems:"center", gap:10 },
    logoIcon: { width:32, height:32, background:"#ff2d55",
      borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:16, boxShadow:"0 0 16px #ff2d5540" },
    logoText: { fontSize:18, fontWeight:700, letterSpacing:"-0.02em" },
    logoBadge: { fontSize:10, color:"#636366", fontFamily:"'JetBrains Mono',monospace",
      background:"#1c1c1e", padding:"2px 6px", borderRadius:4 },
    liveBtn: { display:"flex", alignItems:"center", gap:6, padding:"6px 14px",
      borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:600,
      fontFamily:"inherit", transition:"all 0.2s" },
    grid: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, padding:"20px 24px 0" },
    card: { background:"#0a0a0a", border:"1px solid #1c1c1e", borderRadius:12, padding:"16px 18px" },
    cardLabel: { fontSize:11, color:"#636366", fontWeight:500, textTransform:"uppercase",
      letterSpacing:"0.08em", marginBottom:6, fontFamily:"'JetBrains Mono',monospace" },
    cardValue: { fontSize:28, fontWeight:700, letterSpacing:"-0.02em", lineHeight:1 },
    main: { display:"grid", gridTemplateColumns:"1fr 340px", gap:12, padding:"12px 24px 24px" },
    panel: { background:"#0a0a0a", border:"1px solid #1c1c1e", borderRadius:12, overflow:"hidden" },
    panelHeader: { padding:"12px 16px", borderBottom:"1px solid #1c1c1e",
      display:"flex", alignItems:"center", justifyContent:"space-between" },
    panelTitle: { fontSize:12, fontWeight:600, textTransform:"uppercase",
      letterSpacing:"0.08em", color:"#8e8e93", fontFamily:"'JetBrains Mono',monospace" },
    txRow: { display:"grid", gridTemplateColumns:"90px 80px 1fr 60px 70px 100px",
      gap:8, padding:"9px 16px", borderBottom:"1px solid #111",
      fontSize:12, alignItems:"center", cursor:"pointer", transition:"background 0.1s" },
    txRowHeader: { display:"grid", gridTemplateColumns:"90px 80px 1fr 60px 70px 100px",
      gap:8, padding:"8px 16px", borderBottom:"1px solid #1c1c1e",
      fontSize:10, color:"#48484a", fontFamily:"'JetBrains Mono',monospace",
      textTransform:"uppercase", letterSpacing:"0.06em" },
    filterBar: { display:"flex", gap:4, padding:"10px 16px", borderBottom:"1px solid #1c1c1e" },
    filterBtn: { padding:"4px 10px", borderRadius:6, border:"1px solid #1c1c1e",
      cursor:"pointer", fontSize:11, fontWeight:600, fontFamily:"'JetBrains Mono',monospace",
      transition:"all 0.15s" },
    attackBtn: { padding:"8px 16px", background:"#ff2d55", color:"#fff",
      border:"none", borderRadius:8, cursor:"pointer", fontSize:12, fontWeight:700,
      fontFamily:"inherit", transition:"all 0.2s", letterSpacing:"0.02em" },
    modal: { position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center" },
    modalCard: { background:"#0a0a0a", border:"1px solid #2c2c2e", borderRadius:16,
      padding:24, width:400, maxWidth:"90vw" },
  };

  return (
    <div style={S.app}>
      {/* HEADER */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🛡</div>
          <div>
            <div style={S.logoText}>FraudSentinel</div>
            <div style={S.logoBadge}>REAL-TIME ANOMALY DETECTION</div>
          </div>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {attackActive && (
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",
              background:"#1a0008",border:"1px solid #ff2d55",borderRadius:8,
              fontSize:11,color:"#ff2d55",fontFamily:"'JetBrains Mono',monospace",
              animation:"pulse 1s infinite"}}>
              ⚠ ATTACK MODE ACTIVE · {attackCountdown}s
            </div>
          )}
          <button
            onClick={triggerAttack}
            disabled={attackActive}
            style={{...S.attackBtn, opacity:attackActive?0.4:1}}>
            💣 SIMULATE ATTACK
          </button>
          <button
            onClick={() => setIsLive(p=>!p)}
            style={{...S.liveBtn,
              background: isLive?"#0d2f17":"#1c1c1e",
              color: isLive?"#30d158":"#636366",
              border: `1px solid ${isLive?"#30d15840":"#2c2c2e"}`}}>
            <span style={{width:6,height:6,borderRadius:"50%",
              background:isLive?"#30d158":"#636366",
              boxShadow:isLive?"0 0 6px #30d158":"none",
              animation:isLive?"pulse 1.5s infinite":"none"}}/>
            {isLive?"LIVE":"PAUSED"}
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={S.grid}>
        <div style={{...S.card, borderColor: alertPulse?"#ff2d5540":"#1c1c1e",
          boxShadow: alertPulse?"0 0 20px #ff2d5520":"none", transition:"all 0.3s"}}>
          <div style={S.cardLabel}>Critical Alerts</div>
          <div style={{...S.cardValue, color:"#ff2d55"}}>{stats.critical}</div>
          <Sparkline data={scoreHistory.map(s=>s>=70?1:0)} color="#ff2d55"/>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}>Transactions</div>
          <div style={{...S.cardValue, color:"#f2f2f7"}}>{stats.total}</div>
          <Sparkline data={scoreHistory} color="#0a84ff"/>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}>Anomaly Rate</div>
          <div style={{...S.cardValue, color: stats.anomalyRate>15?"#ff9f0a":"#30d158"}}>
            {stats.anomalyRate}%
          </div>
          <Sparkline data={scoreHistory.map(s=>s>=40?1:0)} color="#ff9f0a"/>
        </div>
        <div style={S.card}>
          <div style={S.cardLabel}>Avg Risk Score</div>
          <div style={{...S.cardValue, color: stats.avgScore>=40?"#ff9f0a":"#30d158"}}>
            {stats.avgScore}
          </div>
          <ScoreDistChart transactions={transactions.slice(0,50)}/>
        </div>
      </div>

      {/* MAIN GRID */}
      <div style={S.main}>
        {/* LEFT: Transaction feed */}
        <div style={S.panel}>
          <div style={S.panelHeader}>
            <span style={S.panelTitle}>Live Transaction Feed</span>
            <span style={{fontSize:11,color:"#48484a",fontFamily:"'JetBrains Mono',monospace"}}>
              {filtered.length} events
            </span>
          </div>
          <div style={S.filterBar}>
            {["ALL","CRITICAL","WARNING","NORMAL"].map(f => (
              <button key={f} onClick={()=>setFilter(f)} style={{
                ...S.filterBtn,
                background: filter===f ? (f==="CRITICAL"?"#ff2d55":f==="WARNING"?"#ff9f0a":f==="NORMAL"?"#30d158":"#2c2c2e") : "transparent",
                color: filter===f ? (f==="ALL"?"#f2f2f7":"#000") : "#636366",
                borderColor: filter===f ? "transparent" : "#2c2c2e",
              }}>
                {f}
                <span style={{marginLeft:4,opacity:0.7}}>
                  {f==="ALL"?transactions.length:f==="CRITICAL"?stats.critical:f==="WARNING"?stats.warning:stats.normal}
                </span>
              </button>
            ))}
          </div>
          <div style={S.txRowHeader}>
            <span>TIME</span><span>ID</span><span>MERCHANT</span>
            <span>AMOUNT</span><span>COUNTRY</span><span>RISK</span>
          </div>
          <div ref={listRef} style={{maxHeight:420,overflowY:"auto"}}>
            {filtered.slice(0,80).map((tx,i) => (
              <div key={tx.id} onClick={()=>setSelectedTx(tx)}
                style={{...S.txRow,
                  background: i===0&&tx.level==="CRITICAL" ? "#1a0008" : "transparent",
                  borderLeftWidth: tx.level==="CRITICAL"?2:0,
                  borderLeftStyle:"solid",
                  borderLeftColor:"#ff2d55",
                }}>
                <span style={{color:"#48484a",fontFamily:"'JetBrains Mono',monospace",fontSize:10}}>
                  {new Date(tx.timestamp).toLocaleTimeString()}
                </span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",color:"#636366",fontSize:10}}>
                  {tx.id.slice(-6)}
                </span>
                <span style={{fontWeight:500}}>{tx.merchant}</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",
                  color: tx.amount>2000?"#ff9f0a":tx.amount>500?"#f2f2f7":"#636366"}}>
                  €{tx.amount.toLocaleString()}
                </span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11}}>
                  <span style={{
                    color:["RU","CN","NG","KP","IR"].includes(tx.country)?"#ff2d55":"#636366",
                    fontWeight:["RU","CN","NG","KP","IR"].includes(tx.country)?700:400
                  }}>{tx.country}</span>
                </span>
                <RiskBadge level={tx.level} score={tx.score}/>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Recent anomalies */}
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>🚨 Anomaly Log</span>
            </div>
            <div style={{maxHeight:200,overflowY:"auto"}}>
              {transactions.filter(t=>t.level!=="NORMAL").slice(0,20).map(tx => (
                <div key={tx.id} onClick={()=>setSelectedTx(tx)}
                  style={{padding:"8px 14px",borderBottom:"1px solid #111",cursor:"pointer",
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:12,fontWeight:600}}>{tx.merchant}</div>
                    <div style={{fontSize:10,color:"#636366",fontFamily:"'JetBrains Mono',monospace"}}>
                      €{tx.amount.toLocaleString()} · {tx.country}
                    </div>
                  </div>
                  <RiskBadge level={tx.level} score={tx.score}/>
                </div>
              ))}
            </div>
          </div>

          {/* Model metrics */}
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>🧠 Model Metrics</span>
            </div>
            <div style={{padding:"12px 16px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[
                {label:"Precision","value":"91.2%",color:"#0a84ff"},
                {label:"Recall","value":"88.7%",color:"#30d158"},
                {label:"F1-Score","value":"89.9%",color:"#ff9f0a"},
                {label:"AUC-ROC","value":"97.1%",color:"#bf5af2"},
              ].map(m => (
                <div key={m.label} style={{background:"#111",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:10,color:"#48484a",fontFamily:"'JetBrains Mono',monospace",
                    textTransform:"uppercase",marginBottom:2}}>{m.label}</div>
                  <div style={{fontSize:18,fontWeight:700,color:m.color}}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{padding:"0 16px 12px",fontSize:10,color:"#48484a",
              fontFamily:"'JetBrains Mono',monospace"}}>
              Model: IsolationForest · 200 estimators<br/>
              Trained on 10,000 samples
            </div>
          </div>

          {/* Top flagged users */}
          <div style={S.panel}>
            <div style={S.panelHeader}>
              <span style={S.panelTitle}>⚡ Top Flagged Users</span>
            </div>
            <div style={{padding:"8px 0"}}>
              {Object.entries(
                transactions.filter(t=>t.level!=="NORMAL")
                  .reduce((acc,t)=>{acc[t.user_id]=(acc[t.user_id]||0)+1;return acc;},{})
              ).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([uid,count]) => (
                <div key={uid} style={{padding:"6px 16px",display:"flex",
                  justifyContent:"space-between",alignItems:"center",
                  borderBottom:"1px solid #111"}}>
                  <span style={{fontSize:12,fontFamily:"'JetBrains Mono',monospace",color:"#aeaeb2"}}>{uid}</span>
                  <span style={{fontSize:11,color:"#ff2d55",fontWeight:700,
                    fontFamily:"'JetBrains Mono',monospace"}}>{count} flags</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TRANSACTION DETAIL MODAL */}
      {selectedTx && (
        <div style={S.modal} onClick={()=>setSelectedTx(null)}>
          <div style={S.modalCard} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
              <div>
                <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>{selectedTx.merchant}</div>
                <div style={{fontSize:11,color:"#636366",fontFamily:"'JetBrains Mono',monospace"}}>
                  {selectedTx.id}
                </div>
              </div>
              <ScoreRing score={selectedTx.score}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"Amount",value:`€${selectedTx.amount.toLocaleString()}`},
                {label:"Country",value:selectedTx.country},
                {label:"User",value:selectedTx.user_id},
                {label:"Type",value:selectedTx.transaction_type},
                {label:"Hour",value:`${selectedTx.hour}:00`},
                {label:"Status",value:selectedTx.level},
              ].map(row => (
                <div key={row.label} style={{background:"#111",borderRadius:8,padding:"8px 10px"}}>
                  <div style={{fontSize:10,color:"#48484a",fontFamily:"'JetBrains Mono',monospace",
                    textTransform:"uppercase",marginBottom:2}}>{row.label}</div>
                  <div style={{fontSize:13,fontWeight:600}}>{row.value}</div>
                </div>
              ))}
            </div>
            {selectedTx.flags.length > 0 && (
              <div>
                <div style={{fontSize:10,color:"#48484a",fontFamily:"'JetBrains Mono',monospace",
                  textTransform:"uppercase",marginBottom:6}}>Triggered Rules</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {selectedTx.flags.map(f => (
                    <span key={f} style={{background:"#1a0008",border:"1px solid #ff2d5540",
                      color:"#ff2d55",padding:"3px 8px",borderRadius:4,fontSize:10,
                      fontFamily:"'JetBrains Mono',monospace",fontWeight:600}}>{f}</span>
                  ))}
                </div>
              </div>
            )}
            <button onClick={()=>setSelectedTx(null)}
              style={{marginTop:20,width:"100%",padding:"10px",background:"#1c1c1e",
                border:"1px solid #2c2c2e",borderRadius:8,color:"#aeaeb2",
                cursor:"pointer",fontFamily:"inherit",fontSize:13}}>
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0a0a0a; }
        ::-webkit-scrollbar-thumb { background: #2c2c2e; border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
