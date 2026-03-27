import { useState, useEffect } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy
} from "firebase/firestore";

// ─── CONSTANTS ───────────────────────────────────────────────────
const CARD_TYPES = ["Giveaway Cards","First-Timer Cards","Insurance Cards","Chaser Cards"];
const BREAKERS   = ["Dev","Dre","Krystal"];
const USAGE_TYPES = ["Giveaway","First-Timer Pack","Insurance Pull","Chaser Pull"];
const SOURCES    = ["Discord","Facebook","Other"];
const PAYMENT_METHODS = ["Cash","Venmo","PayPal","Zelle","Other"];

const TARGETS = {
  "Giveaway Cards":    { monthly:2000, buffer:500  },
  "First-Timer Cards": { monthly:200,  buffer:50   },
  "Insurance Cards":   { monthly:2000, buffer:1000 },
  "Chaser Cards":      { monthly:275,  buffer:70   },
};

const CC = {
  "Giveaway Cards":    { bg:"#D6F4E3", text:"#1A6B3A", border:"#2E7D52" },
  "First-Timer Cards": { bg:"#FCE8F3", text:"#8B1A5A", border:"#9d174d" },
  "Insurance Cards":   { bg:"#E8F0FB", text:"#1B4F8A", border:"#1e3a8a" },
  "Chaser Cards":      { bg:"#FFF0CC", text:"#8B5E00", border:"#92400e" },
};

const BC = {
  Dev:     { bg:"#EEF0FB", text:"#2C3E7A", border:"#3730a3" },
  Dre:     { bg:"#F3EAF9", text:"#6B2D8B", border:"#6b21a8" },
  Krystal: { bg:"#E0F7F4", text:"#0D6E6E", border:"#115e59" },
};

// ─── HELPERS ─────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function getZone(pct) {
  if (!pct || isNaN(pct)) return null;
  if (pct < 0.65)  return { label:"🟢 Green",  color:"#166534", bg:"#D6F4E3" };
  if (pct <= 0.70) return { label:"🟡 Yellow", color:"#92400e", bg:"#FFF9DB" };
  return                   { label:"🔴 Red",    color:"#991b1b", bg:"#FEE2E2" };
}

// ─── STYLES ──────────────────────────────────────────────────────
const S = {
  card: { background:"#FFFFFF", border:"1px solid #F0E0E8", borderRadius:12, padding:"18px 20px", boxShadow:"0 2px 12px rgba(232,49,122,0.06)" },
  inp:  { background:"#FFFFFF", border:"1px solid #F0D0DC", borderRadius:7, padding:"8px 12px", color:"#111827", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  lbl:  { fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, display:"block", marginBottom:5 },
  th:   { padding:"9px 14px", background:"#FFF0F5", color:"#1A1A2E", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, textAlign:"left", whiteSpace:"nowrap", borderBottom:"1px solid #E5E7EB" },
  td:   { padding:"8px 14px", borderBottom:"1px solid #FFE8F0", fontSize:13, color:"#111827" },
};

// ─── MICRO COMPONENTS ────────────────────────────────────────────
function SectionLabel({ t }) {
  return (
    <div style={{ fontSize:10, fontWeight:800, color:"#E8317A", textTransform:"uppercase", letterSpacing:2.5, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ width:14, height:2, background:"#E8317A", borderRadius:1, boxShadow:"0 0 8px rgba(232,49,122,0.6)" }} />{t}
    </div>
  );
}

function Badge({ children, bg="#FFF0F5", color="#6B7280" }) {
  return <span style={{ background:bg, color, border:`1px solid ${color}33`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{children}</span>;
}

function ZoneBadge({ pct }) {
  const z = getZone(pct);
  if (!z) return <span style={{ color:"#D1D5DB", fontSize:11 }}>—</span>;
  const cls = pct >= 0.70 ? "zone-red" : pct >= 0.65 ? "zone-yellow" : "";
  return <span className={cls} style={{ background:z.bg, color:z.color, border:`1px solid ${z.color}33`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-block" }}>{z.label} · {(pct*100).toFixed(1)}%</span>;
}

function Btn({ children, onClick, variant="gold", disabled, style }) {
  const V = {
    gold:  { bg:"#E8317A", c:"#1a1a00", b:"#D4A434" },
    green: { bg:"#166534", c:"#ffffff", b:"#14532d", shadow:"0 0 16px rgba(22,101,52,0.3)" },
    red:   { bg:"#FEE2E2", c:"#991b1b", b:"#fca5a5" },
    ghost: { bg:"#FFF0F5", c:"#6B7280", b:"#F0D0DC" },
    red:   { bg:"#FEE2E2", c:"#991b1b", b:"#fca5a5" },
  };
  const v = V[variant] || V.gold;
  return (
    <button onClick={onClick} disabled={disabled} style={{ background:v.bg, color:v.c, border:`1.5px solid ${v.b}`, borderRadius:8, padding:"8px 18px", fontSize:12, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, fontFamily:"inherit", whiteSpace:"nowrap", ...style }}>
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return <div style={{ display:"flex", flexDirection:"column", gap:4 }}><label style={S.lbl}>{label}</label>{children}</div>;
}

function TextInput({ label, value, onChange, type="text", placeholder }) {
  return (
    <Field label={label}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={S.inp} />
    </Field>
  );
}

function SelectInput({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...S.inp, color:value?"#111827":"#9CA3AF", cursor:"pointer" }}>
        <option value="">Select...</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}

function EmptyRow({ msg, cols=10 }) {
  return <tr><td colSpan={cols}><div className="empty-state"><div style={{ fontSize:32, marginBottom:8 }}>📭</div><div style={{ fontSize:13, color:"#D1D5DB" }}>{msg}</div></div></td></tr>;
}

// ─── LOGIN SCREEN ─────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [error, setError] = useState(null);

  async function handleLogin() {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch(e) {
      setError("Login failed. Please try again.");
    }
  }

  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F8F8F8", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif" }}>
      <div style={{ background:"#FFFFFF", borderRadius:16, padding:"48px 40px", boxShadow:"0 4px 40px rgba(232,49,122,0.15)", textAlign:"center", maxWidth:380, width:"100%" }}>
        <div style={{ fontSize:40, fontWeight:900, color:"#000000", letterSpacing:4, marginBottom:4 }}>BAZOOKA</div>
        <div style={{ fontSize:11, color:"#E8317A", marginBottom:32, fontWeight:700, textTransform:"uppercase", letterSpacing:3 }}>Inventory Tracker</div>
        <button onClick={handleLogin} style={{ display:"flex", alignItems:"center", gap:12, background:"#FFFFFF", border:"2px solid #F0D0DC", borderRadius:10, padding:"12px 24px", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:14, color:"#374151", width:"100%", justifyContent:"center", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          Sign in with Google
        </button>
        {error && <div style={{ marginTop:16, color:"#991b1b", fontSize:12 }}>{error}</div>}
        <div style={{ marginTop:20, fontSize:11, color:"#D1D5DB" }}>Access restricted to authorized Bazooka team members</div>
      </div>
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────
function Dashboard({ inventory, breaks }) {
  const usedIds = new Set(breaks.map(b => b.inventoryId));
  const stats = {};
  CARD_TYPES.forEach(ct => { stats[ct] = { total:0, used:0, invested:0, market:0 }; });
  inventory.forEach(c => {
    const s = stats[c.cardType]; if (!s) return;
    s.total++; s.invested += (c.costPerCard||0); s.market += (c.marketValue||0);
    if (usedIds.has(c.id)) s.used++;
  });
  const totInv = Object.values(stats).reduce((a,b) => a+b.invested, 0);
  const totMkt = Object.values(stats).reduce((a,b) => a+b.market,   0);
  const oPct   = totMkt > 0 ? totInv/totMkt : null;
  const oz     = getZone(oPct);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[
          { l:"Cards in Inventory", v:inventory.length,          c:"#000000" },
          { l:"Total Invested",     v:`$${totInv.toFixed(2)}`,   c:"#000000" },
          { l:"Portfolio Zone",     v:oz?oz.label:"No data",     c:oz?.color||"#9CA3AF" },
        ].map(({ l, v, c }) => (
          <div key={l} style={{ ...S.card, textAlign:"center", boxShadow:"0 2px 20px rgba(232,49,122,0.08)" }} className="stat-card count-up">
            <div style={{ fontSize:26, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
            <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <SectionLabel t="Inventory by Card Type" />
        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
          {CARD_TYPES.map(ct => {
            const d = stats[ct]; const { buffer } = TARGETS[ct]; const cc = CC[ct];
            const avail = d.total - d.used;
            const pct   = d.market > 0 ? d.invested/d.market : null;
            const ok    = avail >= buffer; const warn = avail >= buffer*0.5;
            const sc    = ok?"#166534":warn?"#92400e":"#991b1b";
            const sl    = ok?"✅ Stocked":warn?"⚠️ Low":"🚨 Critical";
            return (
              <div key={ct} style={{ background:cc.bg, border:`1px solid ${cc.border}44`, borderRadius:9, padding:"10px 14px", display:"grid", gridTemplateColumns:"1fr 65px 65px 65px 65px 160px 110px", alignItems:"center", gap:6 }}>
                <span style={{ fontWeight:700, color:cc.text, fontSize:13 }}>{ct}</span>
                {[{ v:d.total, l:"stock" },{ v:d.used, l:"used", c:"#991b1b" },{ v:avail, l:"avail", c:sc }].map(({ v, l, c:c2 }) => (
                  <div key={l} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:c2||cc.text }}>{v}</div>
                    <div style={{ fontSize:9, color:"#9CA3AF" }}>{l}</div>
                  </div>
                ))}
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontSize:13, color:"#9CA3AF" }}>{buffer}</div>
                  <div style={{ fontSize:9, color:"#D1D5DB" }}>min</div>
                </div>
                <ZoneBadge pct={pct} />
                <span className={!ok&&!warn?"status-critical":""} style={{ background:ok?"#D6F4E3":warn?"#FFF9DB":"#FEE2E2", color:sc, border:`1px solid ${sc}33`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-block" }}>{sl}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <SectionLabel t="Portfolio Health" />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:12 }}>
          {[
            { l:"Total Invested",    v:`$${totInv.toFixed(2)}`, c:"#000000" },
            { l:"Total Market Value",v:`$${totMkt.toFixed(2)}`, c:"#92400e" },
            { l:"Blended Buy %",     v:oPct?(oPct*100).toFixed(1)+"%":"—", c:oz?.color||"#9CA3AF" },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:26, fontWeight:900, color:c }}>{v}</div>
            </div>
          ))}
        </div>
        {oz && (
          <div style={{ padding:"10px 16px", borderRadius:8, background:oz.bg, border:`1px solid ${oz.color}44`, textAlign:"center" }}>
            <span style={{ fontWeight:700, color:oz.color, fontSize:13 }}>
              Portfolio {oz.label}{oPct<0.65?" — Healthy":oPct<=0.70?" — Watch blended rate":" — Review purchases"}
            </span>
          </div>
        )}
      </div>

      <div style={S.card}>
        <SectionLabel t="Buying Zone Reference" />
        {[
          { z:"🟢 Green",  p:"Under 65%", a:"Buy independently — no approval needed",          bg:"#D6F4E3", c:"#166534" },
          { z:"🟡 Yellow", p:"65–70%",    a:"Flag before buying — check in first",              bg:"#FFF9DB", c:"#92400e" },
          { z:"🔴 Red",    p:"Over 70%",  a:"Pass or renegotiate — explicit approval required", bg:"#FEE2E2", c:"#991b1b" },
        ].map(({ z, p, a, bg, c }) => (
          <div key={z} style={{ display:"grid", gridTemplateColumns:"110px 80px 1fr", gap:10, padding:"8px 12px", background:bg, border:`1px solid ${c}22`, borderRadius:7, marginBottom:4, alignItems:"center" }}>
            <span style={{ fontWeight:800, color:c, fontSize:12 }}>{z}</span>
            <span style={{ color:c, fontSize:11 }}>{p}</span>
            <span style={{ color:"#6B7280", fontSize:11 }}>{a}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LOT COMP ─────────────────────────────────────────────────────
function LotComp({ onAccept }) {
  const [seller,     setSeller]  = useState({ name:"", contact:"", date:"", source:"", payment:"" });
  const [lotPct,     setLotPct]  = useState("");
  const [finalOffer, setFOffer]  = useState("");
  const [custView,   setCustView]= useState(false);
  const [rows,       setRows]    = useState(() =>
    Array.from({ length:8 }, () => ({ id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true }))
  );

  // Core calculations
  const pctNum    = parseFloat(lotPct) / 100 || 0.60;
  const included  = rows.filter(r => r.name && r.include);
  const totalMkt  = included.reduce((s,r) => s + (parseFloat(r.mktVal)||0) * (parseInt(r.qty)||1), 0);
  const calcOffer = totalMkt * pctNum;
  const offerAmt  = parseFloat(finalOffer) || 0;
  const dispOffer = offerAmt > 0 ? offerAmt : calcOffer;
  const lotZone   = totalMkt > 0 ? getZone(dispOffer / totalMkt) : null;
  const totalCards = included.reduce((s,r) => s + (parseInt(r.qty)||1), 0);

  function upd(id, f, v) { setRows(p => p.map(r => r.id===id ? {...r,[f]:v} : r)); }
  function addRow() { setRows(p => [...p, { id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true }]); }

  function doAccept() {
    if (included.length === 0) return;
    const cards = [];
    included.forEach(r => {
      const qty = parseInt(r.qty) || 1;
      const mv  = parseFloat(r.mktVal) || 0;
      const costPerCard = totalCards > 0 ? dispOffer / totalCards : 0;
      for (let i = 0; i < qty; i++) {
        cards.push({
          id:uid(), cardName:r.name, cardType:r.cardType,
          marketValue: mv,
          lotTotalPaid: dispOffer,
          cardsInLot: totalCards,
          costPerCard: costPerCard,
          buyPct: mv > 0 ? costPerCard / mv : null,
          date:    seller.date || new Date().toLocaleDateString(),
          source:  seller.source,
          seller:  seller.name,
          payment: seller.payment,
          dateAdded: new Date().toISOString(),
        });
      }
    });
    onAccept(cards, seller);
  }

  // ── CUSTOMER VIEW ──────────────────────────────────────────────
  if (custView) return (
    <div>
      <div style={{ marginBottom:14 }}>
        <Btn onClick={() => setCustView(false)} variant="ghost">← Back to Builder</Btn>
      </div>
      <div style={{ background:"#FFFFFF", border:"2px solid #E8317A55", borderRadius:16, overflow:"hidden", maxWidth:680, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ background:"#1A1A2E", padding:"28px 32px", textAlign:"center" }}>
          <div style={{ fontSize:32, fontWeight:900, color:"#FFFFFF", letterSpacing:4, marginBottom:6 }}>BAZOOKA</div>
          <div style={{ fontSize:11, color:"#9CA3AF", fontStyle:"italic", letterSpacing:1 }}>Bo Jackson Battle Arena · Lot Purchase Offer</div>
        </div>
        <div style={{ padding:"14px 24px", borderBottom:"1px solid #F0E0E8", display:"grid", gridTemplateColumns:"1fr 1fr", background:"#FAFAFA" }}>
          <div><span style={{ color:"#9CA3AF", fontSize:11 }}>Prepared for: </span><strong style={{ color:"#111827" }}>{seller.name||"—"}</strong></div>
          <div style={{ textAlign:"right" }}><span style={{ color:"#9CA3AF", fontSize:11 }}>Date: </span><strong style={{ color:"#111827" }}>{seller.date||new Date().toLocaleDateString()}</strong></div>
        </div>
        <div style={{ padding:"8px 24px 0" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr>{["#","Card Name","Card Type","Qty","Value/Card","Offer/Card"].map(h =>
                <th key={h} style={{ padding:"8px 10px", borderBottom:"2px solid #F0E0E8", color:"#9CA3AF", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, textAlign:"left" }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {included.length === 0
                ? <EmptyRow msg="No cards added." cols={6}/>
                : included.map((r,i) => {
                    const mv  = parseFloat(r.mktVal)||0;
                    const qty = parseInt(r.qty)||1;
                    const cc  = CC[r.cardType]||{bg:"#FFF0F5",text:"#6B7280"};
                    return (
                      <tr key={r.id} style={{ borderBottom:"1px solid #FFF0F5" }}>
                        <td style={{ padding:"8px 10px", color:"#D1D5DB", fontSize:11, width:32, textAlign:"center" }}>{i+1}</td>
                        <td style={{ padding:"8px 10px", fontWeight:700, color:"#111827" }}>{r.name}</td>
                        <td style={{ padding:"8px 10px" }}><Badge bg={cc.bg} color={cc.text}>{r.cardType||"—"}</Badge></td>
                        <td style={{ padding:"8px 10px", color:"#6B7280", textAlign:"center" }}>{qty}</td>
                        <td style={{ padding:"8px 10px", color:"#92400e", fontWeight:600 }}>${mv.toFixed(2)}</td>
                        <td style={{ padding:"8px 10px", color:"#166534", fontWeight:700 }}>${(mv*pctNum).toFixed(2)}</td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
        <div style={{ padding:"16px 24px", borderTop:"2px solid #F0E0E8", marginTop:8 }}>
          {[["Total Cards", totalCards],["Total Market Value", `$${totalMkt.toFixed(2)}`]].map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #FFF0F5" }}>
              <span style={{ color:"#6B7280", fontSize:13 }}>{l}</span>
              <span style={{ color:"#111827", fontWeight:700 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, padding:"14px 20px", background:"#1A1A2E", borderRadius:10 }}>
            <span style={{ color:"#E8317A", fontWeight:800, fontSize:16 }}>Bazooka's Offer</span>
            <span style={{ color:"#FFFFFF", fontWeight:900, fontSize:22 }}>${dispOffer.toFixed(2)}</span>
          </div>
          <div style={{ marginTop:12, textAlign:"center", color:"#9CA3AF", fontSize:11, fontStyle:"italic" }}>
            This offer is valid for 7 days. Thank you for bringing your collection to Bazooka!
          </div>
        </div>
      </div>
    </div>
  );

  // ── BUILDER VIEW ───────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Seller Info */}
      <div style={S.card}>
        <SectionLabel t="Seller Information" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <TextInput label="Seller Name"     value={seller.name}    onChange={v=>setSeller(p=>({...p,name:v}))} />
          <TextInput label="Contact"         value={seller.contact} onChange={v=>setSeller(p=>({...p,contact:v}))} />
          <TextInput label="Date" type="date" value={seller.date}   onChange={v=>setSeller(p=>({...p,date:v}))} />
          <SelectInput label="Source"         value={seller.source}  onChange={v=>setSeller(p=>({...p,source:v}))}  options={SOURCES} />
          <SelectInput label="Payment Method" value={seller.payment} onChange={v=>setSeller(p=>({...p,payment:v}))} options={PAYMENT_METHODS} />
        </div>
      </div>

      {/* Lot Controls */}
      <div style={S.card}>
        <SectionLabel t="Lot-Level Controls" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, alignItems:"end" }}>
          <div>
            <label style={S.lbl}>Lot Buy % (blank = 60% default)</label>
            <input type="number" value={lotPct} onChange={e=>setLotPct(e.target.value)} placeholder="60"
              style={{ ...S.inp, fontWeight:700 }}/>
          </div>
          <div>
            <label style={S.lbl}>Calculated Offer (at {(pctNum*100).toFixed(0)}%)</label>
            <div style={{ ...S.inp, color:"#166534", fontWeight:800, fontSize:15 }}>${calcOffer.toFixed(2)}</div>
          </div>
          <div>
            <label style={S.lbl}>Lot Zone</label>
            <div style={{ ...S.inp, background:lotZone?.bg||"#F9FAFB", border:`1.5px solid ${lotZone?.color||"#D1D5DB"}`, color:lotZone?.color||"#9CA3AF", fontWeight:700 }}>
              {lotZone ? lotZone.label : "Enter cards to see zone"}
            </div>
          </div>
        </div>
      </div>

      {/* Card Table */}
      <div style={S.card}>
        <SectionLabel t="Cards in This Lot" />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
            <thead>
              <tr>{["#","Card Name","Card Type","Qty","Value/Card ($)","Total Value ($)","Offer/Card ($)","Card Zone","Include"].map(h=>
                <th key={h} style={S.th}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {rows.map((r,i) => {
                const mv      = parseFloat(r.mktVal) || 0;
                const qty     = parseInt(r.qty) || 1;
                const total   = mv * qty;
                const offer   = mv * pctNum;
                const cardZone= mv > 0 ? getZone(pctNum) : null;
                return (
                  <tr key={r.id} style={{ background:i%2===0?"#FFFFFF":"#FFF5F8", opacity:r.include?1:0.35 }}>
                    <td style={{ ...S.td, color:"#D1D5DB", width:32, textAlign:"center" }}>{i+1}</td>
                    <td style={{ ...S.td, width:180 }}>
                      <input value={r.name} onChange={e=>upd(r.id,"name",e.target.value)} placeholder="Card name..."
                        style={{ ...S.inp, padding:"5px 8px", fontSize:12 }}/>
                    </td>
                    <td style={{ ...S.td, width:150 }}>
                      <select value={r.cardType} onChange={e=>upd(r.id,"cardType",e.target.value)}
                        style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:r.cardType?"#111827":"#9CA3AF", cursor:"pointer" }}>
                        <option value="">Type...</option>
                        {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
                      </select>
                    </td>
                    <td style={{ ...S.td, width:65 }}>
                      <input type="number" value={r.qty} onChange={e=>upd(r.id,"qty",e.target.value)}
                        placeholder="1" min="1"
                        style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:"#1B4F8A", width:55 }}/>
                    </td>
                    <td style={{ ...S.td, width:100 }}>
                      <input type="number" value={r.mktVal} onChange={e=>upd(r.id,"mktVal",e.target.value)}
                        placeholder="0.00"
                        style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:"#92400e", width:80 }}/>
                    </td>
                    <td style={{ ...S.td, color:"#92400e", fontWeight:700, width:100 }}>${total.toFixed(2)}</td>
                    <td style={{ ...S.td, color:"#166534", fontWeight:700, width:100 }}>${offer.toFixed(2)}</td>
                    <td style={{ ...S.td, width:120 }}>
                      {cardZone ? <Badge bg={cardZone.bg} color={cardZone.color}>{cardZone.label}</Badge> : <span style={{color:"#D1D5DB"}}>—</span>}
                    </td>
                    <td style={{ ...S.td, textAlign:"center", width:60 }}>
                      <input type="checkbox" checked={r.include} onChange={e=>upd(r.id,"include",e.target.checked)}
                        style={{ cursor:"pointer", width:15, height:15 }}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:10 }}><Btn onClick={addRow} variant="ghost">+ Add Row</Btn></div>
      </div>

      {/* Final Offer */}
      <div style={{ ...S.card, border:"2px solid #E8317A33" }}>
        <SectionLabel t="Final Offer" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, alignItems:"end", marginBottom:16 }}>
          <div>
            <label style={S.lbl}>Your Final Offer ($) — leave blank to use calculated</label>
            <input type="number" value={finalOffer} onChange={e=>setFOffer(e.target.value)}
              placeholder={calcOffer > 0 ? `$${calcOffer.toFixed(2)} (auto)` : "0.00"}
              style={{ ...S.inp, fontWeight:700, fontSize:14 }}/>
          </div>
          <div>
            <label style={S.lbl}>Lot Zone (offer ÷ market value)</label>
            <div style={{ ...S.inp, background:lotZone?.bg||"#F9FAFB", border:`2px solid ${lotZone?.color||"#E8317A"}`, color:lotZone?.color||"#9CA3AF", fontWeight:900, fontSize:14 }}>
              {lotZone ? lotZone.label : totalMkt > 0 ? "Enter offer above" : "Add cards first"}
            </div>
          </div>
          <div>
            <label style={S.lbl}>Est. Margin (internal)</label>
            <div style={{ ...S.inp, color:"#6B2D8B", fontWeight:700 }}>
              {dispOffer > 0 && totalMkt > 0 ? `$${(totalMkt - dispOffer).toFixed(2)}` : "—"}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={()=>setCustView(true)} variant="ghost">👁 Customer View</Btn>
          <Btn onClick={doAccept} disabled={included.length===0} variant="green" style={{ position:"relative", overflow:"hidden" }}>
            ✅ Accept Offer — Import {totalCards} card{totalCards!==1?"s":""} to Inventory
          </Btn>
        </div>
      </div>
    </div>
  );
}


// ─── INVENTORY ────────────────────────────────────────────────────
function Inventory({ inventory, breaks, onRemove, onBulkRemove }) {
  const [search,   setSearch]   = useState("");
  const [typeF,    setTypeF]    = useState("");
  const [selected, setSelected] = useState(new Set());

  const usedIds  = new Set(breaks.map(b => b.inventoryId));
  const filtered = inventory.filter(c => {
    const mn = c.cardName?.toLowerCase().includes(search.toLowerCase());
    const mt = !typeF || c.cardType===typeF;
    return mn && mt;
  });

  function toggleSelect(id) {
    setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(selected.size===filtered.length ? new Set() : new Set(filtered.map(c=>c.id)));
  }
  function handleBulkDelete() {
    if (selected.size===0) return;
    if (window.confirm(`Delete ${selected.size} card${selected.size!==1?"s":""}? This cannot be undone.`)) {
      onBulkRemove([...selected]);
      setSelected(new Set());
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={S.card}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search card name..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
          <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{ ...S.inp, width:"auto", minWidth:160, color:typeF?"#111827":"#9CA3AF", cursor:"pointer" }}>
            <option value="">All Types</option>
            {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
          </select>
          <span style={{ color:"#9CA3AF", fontSize:12, whiteSpace:"nowrap" }}>{filtered.length} cards</span>
          {selected.size>0 && (
            <button onClick={handleBulkDelete} style={{ background:"#FEE2E2", color:"#991b1b", border:"1.5px solid #fca5a5", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              🗑 Delete {selected.size} selected
            </button>
          )}
        </div>
      </div>
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", minWidth:920 }}>
            <thead>
              <tr>
                <th style={{ ...S.th, width:40, textAlign:"center" }}>
                  <input type="checkbox" checked={filtered.length>0&&selected.size===filtered.length} onChange={toggleAll} style={{ cursor:"pointer" }}/>
                </th>
                {["Card Name","Type","Market Value","Lot Paid","Payment","Source","Seller","Date","Status",""].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.length===0 ? <EmptyRow msg="No cards yet — accept a lot comp to add cards." cols={10}/> :
                filtered.map((c,i) => {
                  const used=usedIds.has(c.id);
                  const isSel=selected.has(c.id);
                  const cc=CC[c.cardType]||{bg:"#FFF0F5",text:"#6B7280"};
                  return (
                    <tr key={c.id} style={{ background:isSel?"#FFF0F5":i%2===0?"#FFFFFF":"#FFF5F8", opacity:used?0.45:1, transition:"background 0.15s ease" }} className="inv-row">
                      <td style={{ ...S.td, textAlign:"center" }}>
                        <input type="checkbox" checked={isSel} onChange={()=>toggleSelect(c.id)} style={{ cursor:"pointer" }}/>
                      </td>
                      <td style={{ ...S.td, fontWeight:700 }}>{c.cardName}</td>
                      <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge></td>
                      <td style={{ ...S.td, color:"#92400e", fontWeight:700 }}>${(c.marketValue||0).toFixed(2)}</td>
                      <td style={{ ...S.td, color:"#6B7280" }}>${(c.lotTotalPaid||0).toFixed(2)}</td>
                      <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.payment||"—"}</td>
                      <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.source||"—"}</td>
                      <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.seller||"—"}</td>
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:11 }}>{c.date||"—"}</td>
                      <td style={S.td}><Badge bg={used?"#FEE2E2":"#D6F4E3"} color={used?"#991b1b":"#166534"}>{used?"Used":"Available"}</Badge></td>
                      <td style={S.td}><button onClick={()=>onRemove(c.id)} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:14, padding:2 }}>✕</button></td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── BREAK LOG ────────────────────────────────────────────────────
function BreakLog({ inventory, breaks, onAdd, onBulkAdd }) {
  const [breaker,  setBreaker]  = useState("");
  const [date,     setDate]     = useState(new Date().toISOString().split("T")[0]);
  const [cardId,   setCardId]   = useState("");
  const [usage,    setUsage]    = useState("");
  const [notes,    setNotes]    = useState("");
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSel,  setBulkSel]  = useState(new Set());

  const usedIds   = new Set(breaks.map(b => b.inventoryId));
  const available = inventory.filter(c => !usedIds.has(c.id));
  const selCard   = inventory.find(c => c.id===cardId);

  function handleAdd() {
    if (!breaker||!cardId) return;
    onAdd({ id:uid(), date, breaker, inventoryId:cardId, cardName:selCard?.cardName||"", cardType:selCard?.cardType||"", usage, notes, dateAdded:new Date().toISOString() });
    setCardId(""); setUsage(""); setNotes("");
  }

  function toggleBulkCard(id) {
    setBulkSel(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  }

  function handleBulkLog() {
    if (!breaker || bulkSel.size===0) return;
    const entries = [...bulkSel].map(id => {
      const card = inventory.find(c=>c.id===id);
      return { id:uid(), date, breaker, inventoryId:id, cardName:card?.cardName||"", cardType:card?.cardType||"", usage, notes, dateAdded:new Date().toISOString() };
    });
    onBulkAdd(entries);
    setBulkSel(new Set());
  }

  const sum = {};
  BREAKERS.forEach(b => { sum[b]={total:0}; CARD_TYPES.forEach(ct=>{sum[b][ct]=0;}); });
  breaks.forEach(b => { if(sum[b.breaker]){sum[b.breaker].total++; if(b.cardType)sum[b.breaker][b.cardType]++;} });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={S.card}>
        <SectionLabel t="Log Card Out" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12 }}>
          <SelectInput label="Breaker"    value={breaker} onChange={setBreaker} options={BREAKERS}/>
          <TextInput   label="Date" type="date" value={date} onChange={setDate}/>
          <SelectInput label="Usage Type" value={usage}   onChange={setUsage}   options={USAGE_TYPES}/>
        </div>
        <div style={{ marginBottom:12 }}>
          <Field label="Card (select from available inventory)">
            <select value={cardId} onChange={e=>setCardId(e.target.value)} style={{ ...S.inp, color:cardId?"#111827":"#9CA3AF", cursor:"pointer" }}>
              <option value="">Select a card...</option>
              {CARD_TYPES.map(ct => {
                const ctCards = available.filter(c => c.cardType===ct);
                if (ctCards.length===0) return null;
                return (
                  <optgroup key={ct} label={ct}>
                    {ctCards.map(c => <option key={c.id} value={c.id}>{c.cardName} — ${(c.marketValue||0).toFixed(2)}</option>)}
                  </optgroup>
                );
              })}
            </select>
          </Field>
        </div>
        {selCard && (
          <div style={{ marginBottom:12, padding:"10px 14px", background:"#FFF5F8", borderRadius:8, display:"flex", gap:14, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ color:"#6B7280", fontSize:12 }}>Card: <strong style={{ color:"#111827" }}>{selCard.cardName}</strong></span>
            <Badge bg={CC[selCard.cardType]?.bg} color={CC[selCard.cardType]?.text}>{selCard.cardType}</Badge>
            <span style={{ color:"#6B7280", fontSize:12 }}>Value: <strong style={{ color:"#92400e" }}>${(selCard.marketValue||0).toFixed(2)}</strong></span>
          </div>
        )}
        <div style={{ display:"flex", gap:10, alignItems:"end" }}>
          <div style={{ flex:1 }}><TextInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="e.g. Break #2"/></div>
          <Btn onClick={handleAdd} disabled={!breaker||!cardId} variant="green">Log Card Out</Btn>
          <Btn onClick={()=>{setBulkMode(p=>!p);setBulkSel(new Set());}} variant="ghost">{bulkMode?"Cancel Bulk":"Bulk Log Out"}</Btn>
        </div>

        {bulkMode && (
          <div style={{ marginTop:16, borderTop:"1px solid #F0D0DC", paddingTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>Select cards to log out in bulk</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:8, maxHeight:280, overflowY:"auto", marginBottom:12 }}>
              {available.map(c => {
                const cc=CC[c.cardType]||{bg:"#FFF0F5",text:"#6B7280"};
                const isSel=bulkSel.has(c.id);
                return (
                  <div key={c.id} onClick={()=>toggleBulkCard(c.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:isSel?"#FFF0F5":"#FAFAFA", border:`1.5px solid ${isSel?"#E8317A":"#F0D0DC"}`, borderRadius:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={isSel} onChange={()=>toggleBulkCard(c.id)} style={{ cursor:"pointer" }}/>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:"#111827" }}>{c.cardName}</div>
                      <Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
            {bulkSel.size > 0 && (
              <Btn onClick={handleBulkLog} disabled={!breaker} variant="green">
                ✅ Log Out {bulkSel.size} Card{bulkSel.size!==1?"s":""}
              </Btn>
            )}
          </div>
        )}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {BREAKERS.map(b => {
          const bc=BC[b]; const s=sum[b];
          return (
            <div key={b} style={{ ...S.card, border:`1px solid ${bc.border}44` }}>
              <div style={{ fontWeight:900, fontSize:16, color:bc.text, marginBottom:10 }}>{b}</div>
              <div style={{ fontSize:24, fontWeight:900, color:bc.text, marginBottom:10 }}>{s.total} <span style={{ fontSize:11, color:"#9CA3AF", fontWeight:400 }}>cards used</span></div>
              {CARD_TYPES.map(ct => (
                <div key={ct} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #FFE8F0" }}>
                  <span style={{ fontSize:11, color:"#9CA3AF" }}>{ct}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:CC[ct]?.text }}>{s[ct]}</span>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 0" }}><SectionLabel t="Break History"/></div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Date","Breaker","Card Name","Card Type","Usage","Notes"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {breaks.length===0 ? <EmptyRow msg="No breaks logged yet." cols={6}/> :
                [...breaks].reverse().map((b,i) => {
                  const bc=BC[b.breaker]||{bg:"#FFF0F5",text:"#6B7280"};
                  const cc=CC[b.cardType]||{bg:"#FFF0F5",text:"#6B7280"};
                  return (
                    <tr key={b.id} style={{ background:i%2===0?"#FFFFFF":"#FFF5F8", transition:"background 0.15s ease" }} className="break-row">
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:11 }}>{b.date}</td>
                      <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{b.breaker}</Badge></td>
                      <td style={{ ...S.td, fontWeight:700 }}>{b.cardName}</td>
                      <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{b.cardType}</Badge></td>
                      <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{b.usage||"—"}</td>
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:12 }}>{b.notes||"—"}</td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────
// ── GLOBAL STYLES ────────────────────────────────────────────────
const GlobalStyles = () => {
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }

      /* Smooth page transitions */
      .tab-content { animation: fadeSlideUp 0.25s ease forwards; }
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Toast slide in */
      .toast { animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      @keyframes toastIn {
        from { opacity: 0; transform: translateY(20px) scale(0.95); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Table row hover */
      .inv-row:hover { background: #FFF0F5 !important; transition: background 0.15s ease; }
      .break-row:hover { background: #FFF0F5 !important; transition: background 0.15s ease; }

      /* Button lift */
      .btn-lift { transition: transform 0.15s ease, box-shadow 0.15s ease !important; }
      .btn-lift:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(232,49,122,0.25) !important; }
      .btn-lift:active:not(:disabled) { transform: translateY(0px); }

      /* Nav tab hover */
      .nav-tab { transition: color 0.15s ease, background 0.15s ease !important; }
      .nav-tab:hover { color: #E8317A !important; background: rgba(232,49,122,0.08) !important; }

      /* Card hover */
      .stat-card { transition: transform 0.2s ease, box-shadow 0.2s ease !important; }
      .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 28px rgba(232,49,122,0.12) !important; }

      /* Zone badge pulse on red */
      .zone-red { animation: pulsRed 2s ease-in-out infinite; }
      @keyframes pulsRed {
        0%, 100% { box-shadow: 0 0 0 0 rgba(153,27,27,0.3); }
        50%       { box-shadow: 0 0 0 6px rgba(153,27,27,0); }
      }

      /* Zone badge pulse on yellow */
      .zone-yellow { animation: pulsYellow 2.5s ease-in-out infinite; }
      @keyframes pulsYellow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(146,64,14,0.3); }
        50%       { box-shadow: 0 0 0 5px rgba(146,64,14,0); }
      }

      /* Critical status pulse */
      .status-critical { animation: pulsCritical 1.5s ease-in-out infinite; }
      @keyframes pulsCritical {
        0%, 100% { box-shadow: 0 0 0 0 rgba(153,27,27,0.4); }
        50%       { box-shadow: 0 0 0 8px rgba(153,27,27,0); }
      }

      /* Accept offer shimmer */
      .btn-accept { position: relative; overflow: hidden; }
      .btn-accept::after {
        content: '';
        position: absolute; top: 0; left: -100%;
        width: 60%; height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        animation: shimmer 2.5s ease-in-out infinite;
      }
      @keyframes shimmer {
        0%   { left: -100%; }
        100% { left: 200%; }
      }

      /* Number count up */
      .count-up { animation: countPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      @keyframes countPop {
        from { transform: scale(0.7); opacity: 0; }
        to   { transform: scale(1);   opacity: 1; }
      }

      /* Row fade out on delete */
      .row-deleting { animation: fadeOut 0.3s ease forwards; }
      @keyframes fadeOut {
        from { opacity: 1; transform: translateX(0); }
        to   { opacity: 0; transform: translateX(-20px); }
      }

      /* Pink glow on BAZOOKA nav */
      .nav-bazooka {
        text-shadow: 0 0 20px rgba(232,49,122,0.6), 0 0 40px rgba(232,49,122,0.3);
        transition: text-shadow 0.3s ease;
      }
      .nav-bazooka:hover {
        text-shadow: 0 0 30px rgba(232,49,122,0.9), 0 0 60px rgba(232,49,122,0.5);
      }

      /* Checkbox animation */
      input[type="checkbox"] { cursor: pointer; accent-color: #E8317A; transform-origin: center; transition: transform 0.15s ease; }
      input[type="checkbox"]:checked { transform: scale(1.15); }

      /* Input focus glow */
      input:focus, select:focus { 
        outline: none !important; 
        border-color: #E8317A !important; 
        box-shadow: 0 0 0 3px rgba(232,49,122,0.12) !important;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      /* Section label bar animation */
      .section-bar { transition: width 0.3s ease; }

      /* Scrollbar styling */
      ::-webkit-scrollbar { width: 6px; height: 6px; }
      ::-webkit-scrollbar-track { background: #fff; }
      ::-webkit-scrollbar-thumb { background: #F0D0DC; border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: #E8317A; }

      /* Empty state */
      .empty-state { 
        padding: 60px 0; text-align: center; color: #D1D5DB;
        animation: fadeSlideUp 0.4s ease forwards;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
};

export default function App() {
  const [tab,       setTab]       = useState("dashboard");
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [breaks,    setBreaks]    = useState([]);
  const [toast,     setToast]     = useState(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // Firestore listeners — only when logged in
  useEffect(() => {
    if (!user) return;
    const invUnsub = onSnapshot(
      query(collection(db, "inventory"), orderBy("dateAdded","asc")),
      snap => setInventory(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    const brkUnsub = onSnapshot(
      query(collection(db, "breaks"), orderBy("dateAdded","asc")),
      snap => setBreaks(snap.docs.map(d => ({ id:d.id, ...d.data() })))
    );
    return () => { invUnsub(); brkUnsub(); };
  }, [user]);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3500); }

  async function handleAccept(cards) {
    for (const card of cards) {
      await setDoc(doc(db,"inventory",card.id), card);
    }
    showToast(`✅ ${cards.length} card${cards.length!==1?"s":""} added to inventory`);
    setTab("inventory");
  }

  async function handleRemove(id) {
    await deleteDoc(doc(db,"inventory",id));
  }

  async function handleBulkRemove(ids) {
    for (const id of ids) { await deleteDoc(doc(db,"inventory",id)); }
    showToast(`🗑 ${ids.length} card${ids.length!==1?"s":""} deleted`);
  }

  async function handleAddBreak(b) {
    await setDoc(doc(db,"breaks",b.id), b);
    showToast(`✅ ${b.cardName} logged out by ${b.breaker}`);
  }

  async function handleBulkAddBreak(entries) {
    for (const b of entries) { await setDoc(doc(db,"breaks",b.id), b); }
    showToast(`✅ ${entries.length} cards logged out by ${entries[0]?.breaker}`);
  }

  async function handleSignOut() {
    await signOut(auth);
    setInventory([]);
    setBreaks([]);
    setTab("dashboard");
  }

  const isMob = window.innerWidth < 768;
  const TABS = [
    { id:"dashboard", label: isMob ? "📊" : "📊 Dashboard" },
    { id:"comp",      label: isMob ? "🧮" : "🧮 Lot Comp"   },
    { id:"inventory", label: isMob ? "📦" : "📦 Inventory"  },
    { id:"breaks",    label: isMob ? "🎯" : "🎯 Break Log"  },
  ];

  if (!authReady) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#FFFFFF", color:"#1A1A2E", fontSize:18, fontWeight:700, fontFamily:"'Trebuchet MS',sans-serif" }}>
      Loading...
    </div>
  );

  if (!user) return <LoginScreen />;

  return (
    <div style={{ background:"#FFFFFF", minHeight:"100vh", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", color:"#111827" }}>
      <GlobalStyles />
      <div style={{ background:"#000000", padding:"0 12px", position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 20px rgba(232,49,122,0.2), 0 1px 0 rgba(232,49,122,0.4)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", gap:20 }}>
          <div style={{ padding:"13px 0", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <span style={{ fontSize:20, fontWeight:900, color:"#E8317A", letterSpacing:2 }} className="nav-bazooka">BAZOOKA</span>
            <span style={{ fontSize:10, color:"#666666", borderLeft:"1px solid #333333", paddingLeft:10, textTransform:"uppercase", letterSpacing:1 }}>BoBA Tracker</span>
          </div>
          <nav style={{ display:"flex", gap:2, flex:1 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} style={{ background:tab===t.id?"#2a2a4a":"transparent", border:"none", color:tab===t.id?"#E8317A":"#888888", padding:"10px 14px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:tab===t.id?700:400, fontFamily:"inherit", borderBottom:tab===t.id?"2px solid #E8317A":"2px solid transparent", textShadow:tab===t.id?"0 0 12px rgba(232,49,122,0.5)":"none", transition:"all 0.1s" }}>
                {t.label}
              </button>
            ))}
          </nav>
          <div style={{ display:"flex", alignItems:"center", gap:12, flexShrink:0 }}>
            <span style={{ color:"#9CA3AF", fontSize:11 }}>{inventory.length} cards</span>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              {user.photoURL && <img src={user.photoURL} alt="" style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #E8317A", boxShadow:"0 0 8px rgba(232,49,122,0.4)" }}/>}
              {window.innerWidth >= 768 && <span style={{ color:"#9CA3AF", fontSize:11 }}>{user.displayName?.split(" ")[0]}</span>}
              <button onClick={handleSignOut} style={{ background:"transparent", border:"1px solid #444444", color:"#999999", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"20px" }} key={tab} className="tab-content">
        {tab==="dashboard" && <Dashboard inventory={inventory} breaks={breaks}/>}
        {tab==="comp"      && <LotComp   onAccept={handleAccept}/>}
        {tab==="inventory" && <Inventory inventory={inventory} breaks={breaks} onRemove={handleRemove} onBulkRemove={handleBulkRemove}/>}
        {tab==="breaks"    && <BreakLog  inventory={inventory} breaks={breaks} onAdd={handleAddBreak} onBulkAdd={handleBulkAddBreak}/>}
      </div>

      {toast && (
        <div className="toast" style={{ position:"fixed", bottom:20, right:20, background:"#166534", color:"#ffffff", padding:"12px 18px", borderRadius:10, fontWeight:700, fontSize:13, boxShadow:"0 4px 24px rgba(0,0,0,0.2)", zIndex:999 }}>
          {toast}
        </div>
      )}
    </div>
  );
}
