import { useState, useEffect } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";

const CARD_TYPES = ["Giveaway/Standard Cards","First-Timer Cards","Chaser Cards"];
const BREAKERS = ["Dev","Dre","Krystal"];
const USAGE_TYPES = ["Giveaway/Standard","First-Timer Pack","Chaser Pull"];
const SOURCES = ["Discord","Facebook","Other"];
const PAYMENT_METHODS = ["Cash","Venmo","PayPal","Zelle","Other"];
const ROLES = {
  "devin":   { role:"Admin",       label:"CEO",                color:"#E8317A", bg:"#FFF0F5" },
  "derrik":  { role:"Admin",       label:"CFO",                color:"#E8317A", bg:"#FFF0F5" },
  "dre":     { role:"Streamer",    label:"Streamer",           color:"#6B2D8B", bg:"#F3EAF9" },
  "krystal": { role:"Streamer",    label:"Streamer",           color:"#0D6E6E", bg:"#E0F7F4" },
  "john":    { role:"Procurement", label:"Procurement Mgr",    color:"#1B4F8A", bg:"#E8F0FB" },
  "jake":    { role:"Shipping",    label:"Shipping/Logistics", color:"#8B5E00", bg:"#FFF0CC" },
};
const TARGETS = {
  "Giveaway/Standard Cards": { monthly:4000, buffer:500 },
  "First-Timer Cards":       { monthly:200,  buffer:50  },
  "Chaser Cards":            { monthly:275,  buffer:70  },
};
const CC = {
  "Giveaway/Standard Cards": { bg:"#D6F4E3", text:"#1A6B3A", border:"#2E7D52" },
  "First-Timer Cards":       { bg:"#FCE8F3", text:"#8B1A5A", border:"#9d174d" },
  "Chaser Cards":            { bg:"#FFF0CC", text:"#8B5E00", border:"#92400e" },
};
const BC = {
  Dev:     { bg:"#EEF0FB", text:"#2C3E7A", border:"#3730a3" },
  Dre:     { bg:"#F3EAF9", text:"#6B2D8B", border:"#6b21a8" },
  Krystal: { bg:"#E0F7F4", text:"#0D6E6E", border:"#115e59" },
};
const CAN_DELETE        = ["Admin"];
const CAN_LOG_BREAKS    = ["Admin","Streamer","Procurement"];
const CAN_VIEW_LOT_COMP = ["Admin","Procurement"];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function getUserRole(user) {
  if (!user) return { role:"Viewer", label:"Viewer", color:"#9CA3AF", bg:"#F3F4F6" };
  const name = (user.displayName||"").toLowerCase();
  const email = (user.email||"").toLowerCase();
  for (const [key, val] of Object.entries(ROLES)) {
    if (name.includes(key) || email.includes(key)) return val;
  }
  return { role:"Viewer", label:"Viewer", color:"#9CA3AF", bg:"#F3F4F6" };
}
function getZone(pct) {
  if (!pct || isNaN(pct)) return null;
  if (pct < 0.65)  return { label:"🟢 Green",  color:"#166534", bg:"#D6F4E3" };
  if (pct <= 0.70) return { label:"🟡 Yellow", color:"#92400e", bg:"#FFF9DB" };
  return                   { label:"🔴 Red",    color:"#991b1b", bg:"#FEE2E2" };
}

const S = {
  card: { background:"#FFFFFF", border:"1px solid #F0E0E8", borderRadius:12, padding:"18px 20px", boxShadow:"0 2px 12px rgba(232,49,122,0.06)" },
  inp:  { background:"#FFFFFF", border:"1px solid #F0D0DC", borderRadius:7, padding:"8px 12px", color:"#111827", fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
  lbl:  { fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, display:"block", marginBottom:5 },
  th:   { padding:"9px 14px", background:"#FFF0F5", color:"#1A1A2E", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, textAlign:"left", whiteSpace:"nowrap", borderBottom:"1px solid #E5E7EB" },
  td:   { padding:"8px 14px", borderBottom:"1px solid #FFE8F0", fontSize:13, color:"#111827" },
};

function SectionLabel({ t }) {
  return (
    <div style={{ fontSize:10, fontWeight:800, color:"#1A1A2E", textTransform:"uppercase", letterSpacing:2.5, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
      <div style={{ width:14, height:2, background:"#E8317A", borderRadius:1, boxShadow:"0 0 8px rgba(232,49,122,0.6)" }} />{t}
    </div>
  );
}
function Badge({ children, bg="#F3F4F6", color="#374151" }) {
  return <span style={{ background:bg, color, border:`1px solid ${color}33`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{children}</span>;
}
function ZoneBadge({ pct }) {
  const z = getZone(pct);
  if (!z) return <span style={{ color:"#D1D5DB", fontSize:11 }}>—</span>;
  const cls = pct >= 0.70 ? "zone-red" : pct >= 0.65 ? "zone-yellow" : "";
  return <span className={cls} style={{ background:z.bg, color:z.color, border:`1px solid ${z.color}33`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-block" }}>{z.label} · {(pct*100).toFixed(1)}%</span>;
}
function Btn({ children, onClick, variant="gold", disabled, style:extra }) {
  const V = {
    gold:  { bg:"#E8317A", c:"#ffffff", b:"#c41e5a" },
    green: { bg:"#166534", c:"#ffffff", b:"#14532d" },
    ghost: { bg:"#F3F4F6", c:"#6B7280", b:"#E5E7EB" },
    red:   { bg:"#FEE2E2", c:"#991b1b", b:"#fca5a5" },
  };
  const v = V[variant]||V.gold;
  return (
    <button onClick={onClick} disabled={disabled} className="btn-lift" style={{ background:v.bg, color:v.c, border:`1.5px solid ${v.b}`, borderRadius:8, padding:"8px 18px", fontSize:12, fontWeight:700, cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, fontFamily:"inherit", whiteSpace:"nowrap", ...extra }}>
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
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={S.inp}/>
    </Field>
  );
}
function SelectInput({ label, value, onChange, options }) {
  return (
    <Field label={label}>
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ ...S.inp, color:value?"#111827":"#9CA3AF", cursor:"pointer" }}>
        <option value="">Select...</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}
function EmptyRow({ msg, cols=10 }) {
  return <tr><td colSpan={cols} style={{ padding:"48px 0", textAlign:"center", color:"#D1D5DB", fontSize:13 }}>{msg}</td></tr>;
}
function AccessDenied({ msg }) {
  return (
    <div style={{ ...S.card, textAlign:"center", padding:"60px 40px" }}>
      <div style={{ fontSize:40, marginBottom:12 }}>🔒</div>
      <div style={{ fontSize:18, fontWeight:700, color:"#111827", marginBottom:8 }}>Access Restricted</div>
      <div style={{ fontSize:13, color:"#9CA3AF" }}>{msg}</div>
    </div>
  );
}

function GlobalStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      .tab-content { animation: fadeSlideUp 0.25s ease forwards; }
      @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      .toast { animation: toastIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      @keyframes toastIn { from { opacity:0; transform:translateY(20px) scale(0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
      .inv-row:hover { background: #FFF0F5 !important; }
      .break-row:hover { background: #FFF0F5 !important; }
      .btn-lift { transition: transform 0.15s ease, box-shadow 0.15s ease !important; }
      .btn-lift:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(232,49,122,0.25) !important; }
      .nav-tab { transition: color 0.15s ease, background 0.15s ease !important; }
      .nav-tab:hover { color: #E8317A !important; background: rgba(232,49,122,0.08) !important; }
      .zone-red { animation: pulsRed 2.5s ease-in-out infinite; }
      @keyframes pulsRed { 0%,100% { box-shadow:0 0 0 0 rgba(153,27,27,0.4); } 50% { box-shadow:0 0 0 6px rgba(153,27,27,0); } }
      .zone-yellow { animation: pulsYellow 2.5s ease-in-out infinite; }
      @keyframes pulsYellow { 0%,100% { box-shadow:0 0 0 0 rgba(146,64,14,0.3); } 50% { box-shadow:0 0 0 5px rgba(146,64,14,0); } }
      .status-critical { animation: pulsCritical 2.5s ease-in-out infinite; }
      @keyframes pulsCritical { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,0.7); } 50% { box-shadow:0 0 0 6px rgba(220,38,38,0.1),0 0 12px 4px rgba(220,38,38,0.3); } }
      .nav-bazooka { text-shadow:0 0 20px rgba(232,49,122,0.6),0 0 40px rgba(232,49,122,0.3); transition:text-shadow 0.3s ease; }
      .nav-bazooka:hover { text-shadow:0 0 30px rgba(232,49,122,0.9),0 0 60px rgba(232,49,122,0.5); }
      input[type="checkbox"] { cursor:pointer; accent-color:#E8317A; }
      input:focus, select:focus { outline:none !important; border-color:#E8317A !important; box-shadow:0 0 0 3px rgba(232,49,122,0.12) !important; }
      ::-webkit-scrollbar { width:6px; height:6px; }
      ::-webkit-scrollbar-track { background:#fff; }
      ::-webkit-scrollbar-thumb { background:#F0D0DC; border-radius:3px; }
      ::-webkit-scrollbar-thumb:hover { background:#E8317A; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);
  return null;
}

function LoginScreen() {
  const [error, setError] = useState(null);
  async function handleLogin() {
    try { await signInWithPopup(auth, googleProvider); }
    catch { setError("Login failed. Please try again."); }
  }
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F8F8F8", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif" }}>
      <div style={{ background:"#FFFFFF", borderRadius:16, padding:"48px 40px", boxShadow:"0 4px 40px rgba(232,49,122,0.15)", textAlign:"center", maxWidth:380, width:"100%" }}>
        <div style={{ fontSize:40, fontWeight:900, color:"#000000", letterSpacing:4, marginBottom:4 }}>BAZOOKA</div>
        <div style={{ fontSize:11, color:"#E8317A", marginBottom:32, fontWeight:700, textTransform:"uppercase", letterSpacing:3 }}>Inventory Tracker</div>
        <button onClick={handleLogin} style={{ display:"flex", alignItems:"center", gap:12, background:"#000000", border:"2px solid #000000", borderRadius:10, padding:"12px 24px", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:14, color:"#FFFFFF", width:"100%", justifyContent:"center" }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          Sign in with Google
        </button>
        {error && <div style={{ marginTop:16, color:"#991b1b", fontSize:12 }}>{error}</div>}
        <div style={{ marginTop:20, fontSize:11, color:"#D1D5DB" }}>Access restricted to Bazooka team members</div>
      </div>
    </div>
  );
}

function Dashboard({ inventory, breaks, user }) {
  const usedIds = new Set(breaks.map(b => b.inventoryId));
  const stats = {};
  CARD_TYPES.forEach(ct => { stats[ct] = { total:0, used:0, invested:0, market:0 }; });
  inventory.forEach(c => {
    const s = stats[c.cardType]; if (!s) return;
    s.total++; s.invested += (c.costPerCard||0); s.market += (c.marketValue||0);
    if (usedIds.has(c.id)) s.used++;
  });
  const totInv = Object.values(stats).reduce((a,b) => a+b.invested, 0);
  const totMkt = Object.values(stats).reduce((a,b) => a+b.market, 0);
  const oPct   = totMkt > 0 ? totInv/totMkt : null;
  const oz     = getZone(oPct);
  const usedCount  = [...usedIds].length;
  const availCount = inventory.length - usedCount;

  const runway = {};
  CARD_TYPES.forEach(ct => {
    const avail = stats[ct].total - stats[ct].used;
    const ctBreaks = breaks.filter(b => b.cardType === ct);
    if (ctBreaks.length === 0) { runway[ct] = 999; return; }
    const earliest = ctBreaks.reduce((mn, b) => { const d = new Date(b.dateAdded||b.date); return d < mn ? d : mn; }, new Date());
    const days = Math.max(1, Math.floor((new Date() - earliest) / 86400000));
    runway[ct] = Math.floor(avail / (ctBreaks.length / days));
  });

  const alerts = CARD_TYPES.filter(ct => (stats[ct].total - stats[ct].used) < TARGETS[ct].buffer);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ ...S.card, border: alerts.length > 0 ? "2px solid #FCA5A5" : "2px solid #D6F4E3" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <SectionLabel t="Inventory Health Check" />
          <span style={{ fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20, background:alerts.length===0?"#D6F4E3":alerts.length<=2?"#FFF9DB":"#FEE2E2", color:alerts.length===0?"#166534":alerts.length<=2?"#92400e":"#991b1b" }}>
            {alerts.length===0 ? "✅ All Good" : `🚨 ${alerts.length} Critical`}
          </span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
          {[
            { l:"Total Cards",    v:inventory.length, c:"#111827" },
            { l:"Available",      v:availCount,       c:"#166534" },
            { l:"Used",           v:usedCount,        c:"#991b1b" },
            { l:"Portfolio Zone", v:oz?oz.label:"No data", c:oz?.color||"#9CA3AF" },
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:"#FAFAFA", border:"1px solid #F0E0E8", borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:c, marginBottom:2 }}>{v}</div>
              <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>
        {alerts.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#991b1b", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🚨 Restock Needed</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {alerts.map(ct => {
                const avail = stats[ct].total - stats[ct].used;
                const cc = CC[ct];
                return <div key={ct} style={{ background:cc.bg, border:`1.5px solid ${cc.border}`, borderRadius:8, padding:"8px 14px" }}>
                  <span style={{ fontWeight:700, color:cc.text, fontSize:12 }}>{ct}</span>
                  <span style={{ fontSize:11, color:cc.text, marginLeft:8 }}>{avail} left / {TARGETS[ct].buffer} min</span>
                </div>;
              })}
            </div>
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {CARD_TYPES.map(ct => {
            const cc = CC[ct];
            const avail = stats[ct].total - stats[ct].used;
            const days = runway[ct];
            const pace = TARGETS[ct].monthly > 0 ? stats[ct].used / TARGETS[ct].monthly : 0;
            const runC  = days >= 14 ? "#166534" : days >= 7 ? "#92400e" : "#991b1b";
            const runBg = days >= 14 ? "#D6F4E3" : days >= 7 ? "#FFF9DB" : "#FEE2E2";
            return (
              <div key={ct} style={{ background:"#FFFFFF", border:"1px solid #F0E0E8", borderRadius:9, padding:"10px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontWeight:700, color:cc.text, fontSize:13 }}>{ct}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"#9CA3AF" }}>{avail} avail</span>
                    <span style={{ background:runBg, color:runC, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:5 }}>
                      {days >= 999 ? "No usage yet" : `~${days}d runway`}
                    </span>
                    <span style={{ fontSize:11, color:"#9CA3AF" }}>Pace: {(pace*100).toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height:5, background:"#F0E0E8", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${Math.min(pace*100,100)}%`, background:pace>=1?"#991b1b":pace>=0.7?"#92400e":"#166534", borderRadius:3 }}/>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginTop:14 }}>
          {[
            { l:"Total Market Value", v:`$${totMkt.toFixed(2)}`, c:"#92400e" },
            { l:"Total Invested",     v:`$${totInv.toFixed(2)}`, c:"#6B2D8B" },
            { l:"Cards Used (Total)", v:usedCount,               c:"#991b1b" },
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:"#FAFAFA", border:"1px solid #F0E0E8", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:900, color:c, marginBottom:2 }}>{v}</div>
              <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <SectionLabel t="Inventory by Card Type" />
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {CARD_TYPES.map(ct => {
            const d = stats[ct]; const { buffer } = TARGETS[ct]; const cc = CC[ct];
            const avail = d.total - d.used;
            const pct   = d.market > 0 ? d.invested/d.market : null;
            const ok = avail >= buffer; const warn = avail >= buffer*0.5;
            const sc = ok?"#166534":warn?"#92400e":"#991b1b";
            const sl = ok?"✅ Stocked":warn?"⚠️ Low":"🚨 Critical";
            return (
              <div key={ct} style={{ background:cc.bg, border:`1px solid ${cc.border}44`, borderRadius:9, padding:"12px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <span style={{ fontWeight:700, color:cc.text, fontSize:14, minWidth:180 }}>{ct}</span>
                <div style={{ display:"flex", alignItems:"center", gap:20, flex:1, justifyContent:"center" }}>
                  {[{v:d.total,l:"stock"},{v:d.used,l:"used",c:"#991b1b"},{v:avail,l:"avail",c:sc}].map(({v,l,c:c2}) => (
                    <div key={l} style={{ textAlign:"center", minWidth:50 }}>
                      <div style={{ fontSize:22, fontWeight:900, color:c2||cc.text }}>{v}</div>
                      <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
                    </div>
                  ))}
                  <div style={{ textAlign:"center", minWidth:50 }}>
                    <div style={{ fontSize:14, color:"#9CA3AF", fontWeight:600 }}>{buffer}</div>
                    <div style={{ fontSize:9, color:"#D1D5DB", textTransform:"uppercase", letterSpacing:1 }}>min</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <ZoneBadge pct={pct} />
                  <span className={!ok&&!warn?"status-critical":""} style={{ background:ok?"#D6F4E3":warn?"#FFF9DB":"#FEE2E2", color:sc, border:`1px solid ${sc}33`, borderRadius:5, padding:"4px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-block" }}>{sl}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <SectionLabel t="Team Activity" />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          {BREAKERS.map(b => {
            const bc = BC[b];
            const bBreaks = breaks.filter(x => x.breaker === b);
            const bInv    = inventory.filter(x => x.addedBy?.toLowerCase().includes(b.toLowerCase()));
            const last    = bBreaks.length > 0 ? [...bBreaks].sort((a,z) => new Date(z.dateAdded)-new Date(a.dateAdded))[0] : null;
            const isYou   = user?.displayName?.toLowerCase().includes(b.toLowerCase());
            return (
              <div key={b} style={{ ...S.card, border:`1.5px solid ${bc.border}44`, background:bc.bg+"44", position:"relative" }}>
                {isYou && <div style={{ position:"absolute", top:10, right:10, fontSize:10, fontWeight:700, color:bc.text, background:bc.bg, border:`1px solid ${bc.border}`, borderRadius:10, padding:"2px 8px" }}>You</div>}
                <div style={{ fontWeight:900, fontSize:16, color:bc.text, marginBottom:10 }}>{b}</div>
                {[["Cards logged out",bBreaks.length],["Added to inventory",bInv.length],["Last break",last?new Date(last.dateAdded).toLocaleDateString():"—"]].map(([l,v]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F0E0E8" }}>
                    <span style={{ fontSize:11, color:"#9CA3AF" }}>{l}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:bc.text }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div style={S.card}>
        <SectionLabel t="Portfolio Health" />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:12 }}>
          {[
            { l:"Total Invested",     v:`$${totInv.toFixed(2)}`, c:"#6B2D8B" },
            { l:"Total Market Value", v:`$${totMkt.toFixed(2)}`, c:"#92400e" },
            { l:"Blended Buy %",      v:oPct?(oPct*100).toFixed(1)+"%":"—", c:oz?.color||"#9CA3AF" },
          ].map(({l,v,c}) => (
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:26, fontWeight:900, color:c }}>{v}</div>
            </div>
          ))}
        </div>
        {oz && <div style={{ padding:"10px 16px", borderRadius:8, background:oz.bg, border:`1px solid ${oz.color}44`, textAlign:"center" }}>
          <span style={{ fontWeight:700, color:oz.color, fontSize:13 }}>Portfolio {oz.label}{oPct<0.65?" — Healthy":oPct<=0.70?" — Watch blended rate":" — Review purchases"}</span>
        </div>}
      </div>

      <div style={S.card}>
        <SectionLabel t="Buying Zone Reference" />
        {[
          { z:"🟢 Green",  p:"Under 65%", a:"Buy independently — no approval needed",          bg:"#D6F4E3", c:"#166534" },
          { z:"🟡 Yellow", p:"65–70%",    a:"Flag before buying — check in first",              bg:"#FFF9DB", c:"#92400e" },
          { z:"🔴 Red",    p:"Over 70%",  a:"Pass or renegotiate — explicit approval required", bg:"#FEE2E2", c:"#991b1b" },
        ].map(({z,p,a,bg,c}) => (
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

function LotComp({ onAccept, onSaveComp, onDeleteComp, comps, user, userRole }) {
  const [compMode,     setCompMode]     = useState("builder");
  const [seller,       setSeller]       = useState({ name:"", contact:"", date:"", source:"", payment:"" });
  const [lotPct,       setLotPct]       = useState("");
  const [finalOffer,   setFOffer]       = useState("");
  const [custView,     setCustView]     = useState(false);
  const [rows,         setRows]         = useState(() => Array.from({ length:8 }, () => ({ id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true })));
  const [quickCards,   setQuickCards]   = useState("");
  const [quickMktVal,  setQuickMktVal]  = useState("");
  const [quickPct,     setQuickPct]     = useState("");
  const [quickOffer,   setQuickOffer]   = useState("");
  const [counterOffer,        setCounterOffer]        = useState("");
  const [loadedCompId,        setLoadedCompId]        = useState(null);
  const [loadedCompHadCards,  setLoadedCompHadCards]  = useState(true);

  const pctNum    = parseFloat(lotPct)/100 || 0.60;
  const included  = rows.filter(r => r.name && r.include);
  const totalMkt  = included.reduce((s,r) => s + (parseFloat(r.mktVal)||0)*(parseInt(r.qty)||1), 0);
  const calcOffer = totalMkt * pctNum;
  const offerAmt  = parseFloat(finalOffer) || 0;
  const dispOffer = offerAmt > 0 ? offerAmt : calcOffer;
  const lotZone   = totalMkt > 0 ? getZone(dispOffer/totalMkt) : null;
  const totalCards = included.reduce((s,r) => s+(parseInt(r.qty)||1), 0);
  const quickTotal     = (parseFloat(quickMktVal)||0) * (parseInt(quickCards)||0);
  const quickCalcOffer = quickTotal * (parseFloat(quickPct)/100 || 0.60);
  const quickOfferAmt  = parseFloat(quickOffer) || quickCalcOffer;
  const quickZone      = quickTotal > 0 ? getZone(quickOfferAmt/quickTotal) : null;
  const counterAmt     = parseFloat(counterOffer) || 0;
  const counterZone    = totalMkt > 0 && counterAmt > 0 ? getZone(counterAmt/totalMkt) : null;

  function upd(id,f,v) { setRows(p => p.map(r => r.id===id ? {...r,[f]:v} : r)); }
  function addRow() { setRows(p => [...p, { id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true }]); }

  function loadComp(comp) {
    setSeller({ name:comp.seller||"", contact:comp.contact||"", date:comp.date||"", source:comp.source||"", payment:comp.payment||"" });
    const hasCards = comp.cards && comp.cards.length > 0;
    setRows(hasCards
      ? comp.cards.map(c => ({ id:uid(), name:c.name||"", cardType:c.cardType||"", mktVal:String(c.mktVal||""), qty:String(c.qty||1), include:true }))
      : Array.from({ length:8 }, () => ({ id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true }))
    );
    setFOffer(comp.offer ? String(comp.offer) : "");
    setLoadedCompId(comp.id);
    setLoadedCompHadCards(hasCards);
    setCompMode("builder");
    setTimeout(() => { const el = document.getElementById("comp-builder-top"); if (el) el.scrollIntoView({ behavior:"smooth", block:"start" }); }, 100);
  }

  function saveComp(status) {
    onSaveComp({
      seller:seller.name, contact:seller.contact, date:seller.date||new Date().toLocaleDateString(),
      source:seller.source, payment:seller.payment, totalCards, totalMarket:totalMkt,
      offer:dispOffer, blendedPct:totalMkt>0?dispOffer/totalMkt:0,
      zone:lotZone?.label||"—", status,
      cards:included.map(r=>({ name:r.name, cardType:r.cardType, qty:parseInt(r.qty)||1, mktVal:parseFloat(r.mktVal)||0 }))
    });
  }

  function doAccept() {
    if (included.length === 0) return;
    const cards = [];
    included.forEach(r => {
      const qty = parseInt(r.qty)||1;
      const mv  = parseFloat(r.mktVal)||0;
      const costPerCard = totalCards > 0 ? dispOffer/totalCards : 0;
      for (let i=0; i<qty; i++) {
        cards.push({ id:uid(), cardName:r.name, cardType:r.cardType, marketValue:mv, lotTotalPaid:dispOffer, cardsInLot:totalCards, costPerCard, buyPct:mv>0?costPerCard/mv:null, date:seller.date||new Date().toLocaleDateString(), source:seller.source, seller:seller.name, payment:seller.payment, dateAdded:new Date().toISOString() });
      }
    });
    onAccept(cards, seller, user);
  }

  if (custView) return (
    <div>
      <div style={{ marginBottom:14 }}><Btn onClick={()=>setCustView(false)} variant="ghost">← Back to Builder</Btn></div>
      <div style={{ background:"#FFFFFF", border:"2px solid #E8317A55", borderRadius:16, overflow:"hidden", maxWidth:680, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ background:"#1A1A2E", padding:"28px 32px", textAlign:"center" }}>
          <div style={{ fontSize:32, fontWeight:900, color:"#FFFFFF", letterSpacing:4, marginBottom:6 }}>BAZOOKA</div>
          <div style={{ fontSize:11, color:"#9CA3AF", fontStyle:"italic" }}>Bo Jackson Battle Arena · Lot Purchase Offer</div>
        </div>
        <div style={{ padding:"14px 24px", borderBottom:"1px solid #F0E0E8", display:"grid", gridTemplateColumns:"1fr 1fr", background:"#FAFAFA" }}>
          <div><span style={{ color:"#9CA3AF", fontSize:11 }}>Prepared for: </span><strong>{seller.name||"—"}</strong></div>
          <div style={{ textAlign:"right" }}><span style={{ color:"#9CA3AF", fontSize:11 }}>Date: </span><strong>{seller.date||new Date().toLocaleDateString()}</strong></div>
        </div>
        <div style={{ padding:"8px 24px 0" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["#","Card Name","Card Type","Qty","Value/Card","Offer/Card"].map(h=><th key={h} style={{ padding:"8px 10px", borderBottom:"2px solid #F0E0E8", color:"#9CA3AF", fontSize:10, fontWeight:700, textTransform:"uppercase", textAlign:"left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {included.length===0 ? <EmptyRow msg="No cards added." cols={6}/> :
                included.map((r,i) => {
                  const mv = parseFloat(r.mktVal)||0;
                  const cc = CC[r.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                  return (
                    <tr key={r.id} style={{ borderBottom:"1px solid #FFF0F5" }}>
                      <td style={{ padding:"8px 10px", color:"#D1D5DB", fontSize:11, width:32, textAlign:"center" }}>{i+1}</td>
                      <td style={{ padding:"8px 10px", fontWeight:700 }}>{r.name}</td>
                      <td style={{ padding:"8px 10px" }}><Badge bg={cc.bg} color={cc.text}>{r.cardType||"—"}</Badge></td>
                      <td style={{ padding:"8px 10px", color:"#6B7280", textAlign:"center" }}>{parseInt(r.qty)||1}</td>
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
          {[["Total Cards",totalCards],["Total Market Value",`$${totalMkt.toFixed(2)}`]].map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #FFF0F5" }}>
              <span style={{ color:"#6B7280", fontSize:13 }}>{l}</span>
              <span style={{ color:"#111827", fontWeight:700 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, padding:"14px 20px", background:"#1A1A2E", borderRadius:10 }}>
            <span style={{ color:"#E8317A", fontWeight:800, fontSize:16 }}>Bazooka's Offer</span>
            <span style={{ color:"#FFFFFF", fontWeight:900, fontSize:22 }}>${dispOffer.toFixed(2)}</span>
          </div>
          <div style={{ marginTop:12, textAlign:"center", color:"#9CA3AF", fontSize:11, fontStyle:"italic" }}>This offer is valid for 7 days. Thank you for bringing your collection to Bazooka!</div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={S.card}>
        <div style={{ display:"flex", gap:8 }}>
          {[["builder","🧮 Builder"],["quick","⚡ Quick Mode"],["history","📋 History"]].map(([mode,label]) => (
            <button key={mode} onClick={()=>setCompMode(mode)} style={{ background:compMode===mode?"#1A1A2E":"transparent", color:compMode===mode?"#E8317A":"#9CA3AF", border:`1.5px solid ${compMode===mode?"#E8317A":"#E5E7EB"}`, borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
          ))}
        </div>
      </div>

      {compMode==="quick" && (
        <div style={S.card}>
          <SectionLabel t="Quick Lot Comp" />
          <p style={{ fontSize:12, color:"#9CA3AF", marginBottom:16 }}>Enter total cards + avg market value per card for an instant offer.</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:16 }}>
            <div><label style={S.lbl}>Total Cards</label><input type="number" value={quickCards} onChange={e=>setQuickCards(e.target.value)} placeholder="0" style={S.inp}/></div>
            <div><label style={S.lbl}>Avg Value/Card ($)</label><input type="number" value={quickMktVal} onChange={e=>setQuickMktVal(e.target.value)} placeholder="0.00" style={S.inp}/></div>
            <div><label style={S.lbl}>Buy % (blank=60%)</label><input type="number" value={quickPct} onChange={e=>setQuickPct(e.target.value)} placeholder="60" style={S.inp}/></div>
            <div><label style={S.lbl}>Your Final Offer ($)</label><input type="number" value={quickOffer} onChange={e=>setQuickOffer(e.target.value)} placeholder={quickCalcOffer.toFixed(2)} style={S.inp}/></div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {[
              { l:"Total Market Value", v:`$${quickTotal.toFixed(2)}`,     c:"#92400e" },
              { l:"Calculated Offer",   v:`$${quickCalcOffer.toFixed(2)}`, c:"#166534" },
              { l:"Your Offer",         v:`$${quickOfferAmt.toFixed(2)}`,  c:"#6B2D8B" },
              { l:"Lot Zone",           v:quickZone?quickZone.label:"—",   c:quickZone?.color||"#9CA3AF" },
            ].map(({l,v,c}) => (
              <div key={l} style={{ background:"#F9FAFB", border:"1px solid #F0D0DC", borderRadius:10, padding:"12px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
                <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {compMode==="history" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {(!comps||comps.length===0)
            ? <div style={{ ...S.card, textAlign:"center", padding:"60px", color:"#D1D5DB" }}>No comps saved yet.</div>
            : comps.map(c => {
                const z = getZone(c.blendedPct);
                return (
                  <div key={c.id} style={{ ...S.card, border:`1px solid ${z?.color||"#F0D0DC"}33` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div>
                        <span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>{c.seller||"Unknown"}</span>
                        <span style={{ color:"#9CA3AF", fontSize:12, marginLeft:10 }}>{c.date}</span>
                        <span style={{ color:"#9CA3AF", fontSize:12, marginLeft:10 }}>by {c.savedBy}</span>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ background:c.status==="accepted"?"#D6F4E3":c.status==="passed"?"#FEE2E2":"#FFF9DB", color:c.status==="accepted"?"#166534":c.status==="passed"?"#991b1b":"#92400e", borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                          {c.status==="accepted"?"✅ Accepted":c.status==="passed"?"❌ Passed":"💾 Saved"}
                        </span>
                        {z && <span style={{ background:z.bg, color:z.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{z.label}</span>}
                        <button onClick={()=>loadComp(c)} style={{ background:"#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>📥 Load into Builder</button>
                        {CAN_DELETE.includes(userRole?.role) && <button onClick={()=>{ if(window.confirm("Delete this comp?")) onDeleteComp(c.id); }} style={{ background:"#FEE2E2", color:"#991b1b", border:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑</button>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>Cards: <strong style={{color:"#111827"}}>{c.totalCards}</strong></span>
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>Market: <strong style={{color:"#92400e"}}>${(c.totalMarket||0).toFixed(2)}</strong></span>
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>Offer: <strong style={{color:"#6B2D8B"}}>${(c.offer||0).toFixed(2)}</strong></span>
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>Blended: <strong style={{color:z?.color||"#111827"}}>{((c.blendedPct||0)*100).toFixed(1)}%</strong></span>
                      <span style={{ fontSize:11, color: c.cards&&c.cards.length>0 ? "#166534" : "#92400e", fontWeight:700 }}>
                        {c.cards&&c.cards.length>0 ? `✓ ${c.cards.length} card detail${c.cards.length!==1?"s":""} saved` : "⚠ No card details — can re-import manually"}
                      </span>
                    </div>
                  </div>
                );
              })
          }
        </div>
      )}

      {compMode==="builder" && <>
        {loadedCompId && (
          <div id="comp-builder-top" style={{ background: loadedCompHadCards ? "#D6F4E3" : "#FFF9DB", border: `1.5px solid ${loadedCompHadCards ? "#2E7D52" : "#92400e"}`, borderRadius:10, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>{loadedCompHadCards ? "✅" : "⚠️"}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color: loadedCompHadCards ? "#166534" : "#92400e" }}>
                  {loadedCompHadCards ? "Comp loaded — ready to edit and import" : "Comp loaded — no card data saved"}
                </div>
                <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>
                  {loadedCompHadCards ? "All seller info, cards, and offer amount restored. Hit Accept & Import to add to inventory." : "Seller info and offer restored, but this comp was saved without per-card details. Add cards manually below."}
                </div>
              </div>
            </div>
            <button onClick={()=>setLoadedCompId(null)} style={{ background:"transparent", border:"none", color:"#9CA3AF", cursor:"pointer", fontSize:18, lineHeight:1 }}>✕</button>
          </div>
        )}
        <div id="comp-builder-top" style={S.card}>
          <SectionLabel t="Seller Information" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            <TextInput label="Seller Name"      value={seller.name}    onChange={v=>setSeller(p=>({...p,name:v}))} />
            <TextInput label="Contact"          value={seller.contact} onChange={v=>setSeller(p=>({...p,contact:v}))} />
            <TextInput label="Date" type="date" value={seller.date}    onChange={v=>setSeller(p=>({...p,date:v}))} />
            <SelectInput label="Source"         value={seller.source}  onChange={v=>setSeller(p=>({...p,source:v}))}  options={SOURCES} />
            <SelectInput label="Payment Method" value={seller.payment} onChange={v=>setSeller(p=>({...p,payment:v}))} options={PAYMENT_METHODS} />
          </div>
        </div>

        <div style={S.card}>
          <SectionLabel t="Lot-Level Controls" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, alignItems:"end" }}>
            <TextInput label="Buy % Override (blank = 60%)" value={lotPct} onChange={setLotPct} placeholder="60" />
            <div><label style={S.lbl}>Calculated Offer</label><div style={{ ...S.inp, color:"#166534", fontWeight:800, fontSize:15 }}>${calcOffer.toFixed(2)}</div></div>
            <div><label style={S.lbl}>Lot Zone</label><div style={{ ...S.inp, background:lotZone?.bg||"#F9FAFB", border:`1.5px solid ${lotZone?.color||"#D1D5DB"}`, color:lotZone?.color||"#9CA3AF", fontWeight:700 }}>{lotZone?lotZone.label:"Enter cards to see zone"}</div></div>
          </div>
        </div>

        <div style={S.card}>
          <SectionLabel t="Cards in This Lot" />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:700 }}>
              <thead><tr>{["#","Card Name","Card Type","Qty","Value/Card ($)","Total Value ($)","Offer/Card ($)","Zone","✓"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r,i) => {
                  const mv  = parseFloat(r.mktVal)||0;
                  const qty = parseInt(r.qty)||1;
                  const cz  = mv > 0 ? getZone(pctNum) : null;
                  return (
                    <tr key={r.id} style={{ background:i%2===0?"#FFFFFF":"#FFF5F8", opacity:r.include?1:0.35 }}>
                      <td style={{ ...S.td, color:"#D1D5DB", width:32, textAlign:"center" }}>{i+1}</td>
                      <td style={{ ...S.td, width:180 }}><input value={r.name} onChange={e=>upd(r.id,"name",e.target.value)} placeholder="Card name..." style={{ ...S.inp, padding:"5px 8px", fontSize:12 }}/></td>
                      <td style={{ ...S.td, width:155 }}>
                        <select value={r.cardType} onChange={e=>upd(r.id,"cardType",e.target.value)} style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:r.cardType?"#111827":"#9CA3AF", cursor:"pointer" }}>
                          <option value="">Type...</option>
                          {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
                        </select>
                      </td>
                      <td style={{ ...S.td, width:70 }}><input type="number" value={r.qty} onChange={e=>upd(r.id,"qty",e.target.value)} placeholder="1" min="1" style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:"#1B4F8A", width:55 }}/></td>
                      <td style={{ ...S.td, width:110 }}><input type="number" value={r.mktVal} onChange={e=>upd(r.id,"mktVal",e.target.value)} placeholder="0.00" style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:"#92400e", width:80 }}/></td>
                      <td style={{ ...S.td, color:"#92400e", fontWeight:700 }}>${(mv*qty).toFixed(2)}</td>
                      <td style={{ ...S.td, color:"#166534", fontWeight:700 }}>${(mv*pctNum).toFixed(2)}</td>
                      <td style={S.td}>{cz?<Badge bg={cz.bg} color={cz.color}>{cz.label}</Badge>:<span style={{color:"#D1D5DB"}}>—</span>}</td>
                      <td style={{ ...S.td, textAlign:"center" }}><input type="checkbox" checked={r.include} onChange={e=>upd(r.id,"include",e.target.checked)}/></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop:10 }}><Btn onClick={addRow} variant="ghost">+ Add Row</Btn></div>
        </div>

        <div style={{ ...S.card, border:"2px solid #E8317A33" }}>
          <SectionLabel t="Final Offer" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, alignItems:"end", marginBottom:16 }}>
            <div>
              <label style={S.lbl}>Final Offer ($) — blank uses calculated</label>
              <input type="number" value={finalOffer} onChange={e=>setFOffer(e.target.value)} placeholder={`${calcOffer.toFixed(2)} (auto)`} style={{ ...S.inp, fontWeight:700, fontSize:15 }}/>
            </div>
            <div><label style={S.lbl}>Lot Zone</label><div style={{ ...S.inp, background:lotZone?.bg||"#F9FAFB", border:`2px solid ${lotZone?.color||"#E8317A"}`, color:lotZone?.color||"#9CA3AF", fontWeight:900, fontSize:14 }}>{lotZone?lotZone.label:"—"}</div></div>
            <div><label style={S.lbl}>Est. Margin</label><div style={{ ...S.inp, color:"#6B2D8B", fontWeight:700 }}>{dispOffer>0&&totalMkt>0?`$${(totalMkt-dispOffer).toFixed(2)}`:"—"}</div></div>
          </div>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
            <Btn onClick={()=>setCustView(true)} variant="ghost">👁 Customer View</Btn>
            <Btn onClick={()=>saveComp("saved")} variant="ghost">💾 Save Comp</Btn>
            <Btn onClick={()=>saveComp("passed")} variant="ghost">❌ Pass on Lot</Btn>
            <Btn onClick={()=>{saveComp("accepted");doAccept();}} disabled={included.length===0} variant="green">✅ Accept & Import {totalCards} card{totalCards!==1?"s":""}</Btn>
          </div>
          <div style={{ borderTop:"1px solid #F0D0DC", paddingTop:16 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>Counter Offer Calculator</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
              <div><label style={S.lbl}>Seller's Counter ($)</label><input type="number" value={counterOffer} onChange={e=>setCounterOffer(e.target.value)} placeholder="0.00" style={S.inp}/></div>
              <div><label style={S.lbl}>Counter Zone</label><div style={{ ...S.inp, background:counterZone?.bg||"#F9FAFB", border:`1.5px solid ${counterZone?.color||"#E5E7EB"}`, color:counterZone?.color||"#9CA3AF", fontWeight:700 }}>{counterZone?counterZone.label:totalMkt>0?"Enter counter":"Add cards first"}</div></div>
              <div><label style={S.lbl}>Counter Buy %</label><div style={{ ...S.inp, color:"#6B2D8B", fontWeight:700 }}>{counterAmt>0&&totalMkt>0?`${((counterAmt/totalMkt)*100).toFixed(1)}%`:"—"}</div></div>
              <div><label style={S.lbl}>vs Your Offer</label><div style={{ ...S.inp, color:counterAmt>dispOffer?"#991b1b":"#166534", fontWeight:700 }}>{counterAmt>0&&dispOffer>0?`$${Math.abs(counterAmt-dispOffer).toFixed(2)} ${counterAmt>dispOffer?"over":"under"}`:"—"}</div></div>
            </div>
          </div>
        </div>
      </>}
    </div>
  );
}

function Inventory({ inventory, breaks, onRemove, onBulkRemove, user, userRole }) {
  const [search,   setSearch]   = useState("");
  const [typeF,    setTypeF]    = useState("");
  const [selected, setSelected] = useState(new Set());
  const [invTab,   setInvTab]   = useState("cards");
  const usedIds  = new Set(breaks.map(b => b.inventoryId));
  const filtered = inventory.filter(c => {
    const mn = c.cardName?.toLowerCase().includes(search.toLowerCase());
    const mt = !typeF || c.cardType===typeF;
    return mn && mt;
  });
  function toggleSelect(id) { setSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function toggleAll() { setSelected(selected.size===filtered.length ? new Set() : new Set(filtered.map(c=>c.id))); }
  function handleBulkDelete() {
    if (selected.size===0) return;
    if (window.confirm(`Delete ${selected.size} card${selected.size!==1?"s":""}? Cannot be undone.`)) { onBulkRemove([...selected]); setSelected(new Set()); }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={S.card}>
        <div style={{ display:"flex", gap:8, marginBottom:4 }}>
          {[["cards","📦 Cards"],["lots","🗂 Lot History"],["aging","⏰ Aging"]].map(([id,label]) => (
            <button key={id} onClick={()=>setInvTab(id)} style={{ background:invTab===id?"#1A1A2E":"transparent", color:invTab===id?"#E8317A":"#9CA3AF", border:`1.5px solid ${invTab===id?"#E8317A":"#E5E7EB"}`, borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
          ))}
        </div>

        {invTab==="lots" && (() => {
          const lots = {};
          inventory.forEach(c => {
            const key = `${c.seller||"Unknown"}__${c.date||"Unknown"}`;
            if (!lots[key]) lots[key] = { seller:c.seller||"Unknown", date:c.date||"Unknown", source:c.source||"—", payment:c.payment||"—", lotPaid:c.lotTotalPaid||0, cards:[], addedBy:c.addedBy||"—" };
            lots[key].cards.push(c);
          });
          const lotList = Object.values(lots).sort((a,b) => new Date(b.date)-new Date(a.date));
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:12 }}>
              {lotList.length===0 ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"40px 0" }}>No lots yet</div> :
                lotList.map((lot,i) => {
                  const usedInLot = lot.cards.filter(c=>usedIds.has(c.id)).length;
                  return (
                    <div key={i} style={{ border:"1px solid #F0D0DC", borderRadius:10, padding:"14px 18px", background:"#FAFAFA" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                        <div><span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>{lot.seller}</span><span style={{ color:"#9CA3AF", fontSize:12, marginLeft:10 }}>{lot.date}</span></div>
                        <div style={{ display:"flex", gap:8 }}><span style={{ fontSize:12, color:"#6B7280" }}>{lot.source} · {lot.payment}</span><span style={{ fontWeight:700, color:"#6B2D8B" }}>${lot.lotPaid.toFixed(2)}</span></div>
                      </div>
                      <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:8 }}>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>Total: <strong style={{color:"#111827"}}>{lot.cards.length}</strong></span>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>Available: <strong style={{color:"#166534"}}>{lot.cards.length-usedInLot}</strong></span>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>Used: <strong style={{color:"#991b1b"}}>{usedInLot}</strong></span>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>Added by: <strong style={{color:"#111827"}}>{lot.addedBy}</strong></span>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {CARD_TYPES.map(ct => { const count=lot.cards.filter(c=>c.cardType===ct).length; if(!count) return null; const cc=CC[ct]; return <span key={ct} style={{ background:cc.bg, color:cc.text, border:`1px solid ${cc.border}44`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{ct}: {count}</span>; })}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          );
        })()}

        {invTab==="aging" && (() => {
          const agingCards = inventory.filter(c => {
            if (usedIds.has(c.id)) return false;
            const d = c.dateAdded ? Math.floor((new Date()-new Date(c.dateAdded))/86400000) : null;
            return d !== null && d >= 30;
          }).sort((a,b) => new Date(a.dateAdded)-new Date(b.dateAdded));
          return (
            <div style={{ marginTop:12 }}>
              {agingCards.length===0
                ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"40px 0" }}>🎉 No aging cards!</div>
                : agingCards.map(c => {
                    const d   = Math.floor((new Date()-new Date(c.dateAdded))/86400000);
                    const cc  = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                    const urg = d>=90?{bg:"#FEE2E2",color:"#991b1b"}:d>=60?{bg:"#FEF3C7",color:"#92400e"}:{bg:"#F9FAFB",color:"#6B7280"};
                    return (
                      <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:urg.bg, border:`1px solid ${urg.color}22`, borderRadius:8, marginBottom:6 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontWeight:700, color:"#111827" }}>{c.cardName}</span>
                          <Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge>
                        </div>
                        <span style={{ fontWeight:700, color:urg.color, fontSize:13 }}>{d} days in stock</span>
                      </div>
                    );
                  })
              }
            </div>
          );
        })()}
      </div>

      {invTab==="cards" && <>
        <div style={S.card}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search card name..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{ ...S.inp, width:"auto", minWidth:160, color:typeF?"#111827":"#9CA3AF", cursor:"pointer" }}>
              <option value="">All Types</option>
              {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
            </select>
            <span style={{ color:"#9CA3AF", fontSize:12 }}>{filtered.length} cards</span>
            {selected.size>0 && CAN_DELETE.includes(userRole?.role) && (
              <button onClick={handleBulkDelete} style={{ background:"#FEE2E2", color:"#991b1b", border:"1.5px solid #fca5a5", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑 Delete {selected.size} selected</button>
            )}
          </div>
        </div>
        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width:40, textAlign:"center" }}><input type="checkbox" checked={filtered.length>0&&selected.size===filtered.length} onChange={toggleAll}/></th>
                  {["Card Name","Type","Market Value","Lot Paid","Payment","Source","Seller","Date","Added By","Status",""].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 ? <EmptyRow msg="No cards yet — accept a lot comp to add cards." cols={12}/> :
                  filtered.map((c,i) => {
                    const used  = usedIds.has(c.id);
                    const isSel = selected.has(c.id);
                    const cc    = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                    const daysIn = c.dateAdded ? Math.floor((new Date()-new Date(c.dateAdded))/86400000) : null;
                    const isAging = !used && daysIn !== null && daysIn >= 60;
                    return (
                      <tr key={c.id} className="inv-row" style={{ background:isSel?"#FFF0F5":i%2===0?"#FFFFFF":"#FFF5F8", opacity:used?0.45:1 }}>
                        <td style={{ ...S.td, textAlign:"center" }}><input type="checkbox" checked={isSel} onChange={()=>toggleSelect(c.id)}/></td>
                        <td style={{ ...S.td, fontWeight:700 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {c.cardName}
                            {isAging && <span style={{ background:"#FEF3C7", color:"#92400e", border:"1px solid #FDE68A", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>⏰ {daysIn}d</span>}
                          </div>
                        </td>
                        <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge></td>
                        <td style={{ ...S.td, color:"#92400e", fontWeight:700 }}>${(c.marketValue||0).toFixed(2)}</td>
                        <td style={{ ...S.td, color:"#6B7280" }}>${(c.lotTotalPaid||0).toFixed(2)}</td>
                        <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.payment||"—"}</td>
                        <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.source||"—"}</td>
                        <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.seller||"—"}</td>
                        <td style={{ ...S.td, color:"#9CA3AF", fontSize:11 }}>{c.date||"—"}</td>
                        <td style={{ ...S.td, color:"#9CA3AF", fontSize:12 }}>{c.addedBy||"—"}</td>
                        <td style={S.td}><Badge bg={used?"#FEE2E2":"#D6F4E3"} color={used?"#991b1b":"#166534"}>{used?"Used":"Available"}</Badge></td>
                        <td style={S.td}>{CAN_DELETE.includes(userRole?.role) && <button onClick={()=>onRemove(c.id)} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:14 }}>✕</button>}</td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </div>
  );
}

function BreakLog({ inventory, breaks, onAdd, onBulkAdd, user }) {
  const userName       = user?.displayName?.split(" ")[0] || "";
  const matchedBreaker = BREAKERS.find(b => userName.toLowerCase().includes(b.toLowerCase())) || "";
  const [breaker,    setBreaker]    = useState(matchedBreaker);
  const [date,       setDate]       = useState(new Date().toISOString().split("T")[0]);
  const [cardId,     setCardId]     = useState("");
  const [cardSearch, setCardSearch] = useState("");
  const [usage,      setUsage]      = useState("");
  const [notes,      setNotes]      = useState("");
  const [bulkMode,   setBulkMode]   = useState(false);
  const [bulkSel,    setBulkSel]    = useState(new Set());
  const usedIds   = new Set(breaks.map(b => b.inventoryId));
  const available = inventory.filter(c => !usedIds.has(c.id));
  const selCard   = inventory.find(c => c.id===cardId);

  function handleAdd() {
    if (!breaker||!cardId) return;
    onAdd({ id:uid(), date, breaker, inventoryId:cardId, cardName:selCard?.cardName||"", cardType:selCard?.cardType||"", usage, notes, dateAdded:new Date().toISOString(), loggedBy:user?.displayName||"Unknown" });
    setCardId(""); setCardSearch(""); setUsage(""); setNotes("");
  }
  function toggleBulk(id) { setBulkSel(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function handleBulkLog() {
    if (!breaker||bulkSel.size===0) return;
    const entries = [...bulkSel].map(id => { const card=inventory.find(c=>c.id===id); return { id:uid(), date, breaker, inventoryId:id, cardName:card?.cardName||"", cardType:card?.cardType||"", usage, notes, dateAdded:new Date().toISOString(), loggedBy:user?.displayName||"Unknown" }; });
    onBulkAdd(entries); setBulkSel(new Set());
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
          <Field label="Search Card">
            <input value={cardSearch} onChange={e=>{setCardSearch(e.target.value);setCardId("");}} placeholder="Type to search available cards..." style={S.inp}/>
            {cardSearch.length > 0 && (
              <div style={{ border:"1px solid #F0D0DC", borderRadius:8, overflow:"hidden", maxHeight:220, overflowY:"auto", background:"#FFFFFF", boxShadow:"0 4px 12px rgba(232,49,122,0.1)", marginTop:4 }}>
                {available.filter(c=>c.cardName.toLowerCase().includes(cardSearch.toLowerCase())).length===0
                  ? <div style={{ padding:"12px 16px", color:"#9CA3AF", fontSize:13 }}>No cards found</div>
                  : available.filter(c=>c.cardName.toLowerCase().includes(cardSearch.toLowerCase())).map(c => {
                      const cc = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                      return (
                        <div key={c.id} onClick={()=>{setCardId(c.id);setCardSearch(c.cardName);}} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", cursor:"pointer", background:cardId===c.id?"#FFF0F5":"#FFFFFF", borderBottom:"1px solid #FFF0F5" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontWeight:700, fontSize:13 }}>{c.cardName}</span>
                            <Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge>
                          </div>
                          <span style={{ fontSize:12, color:"#92400e", fontWeight:600 }}>${(c.marketValue||0).toFixed(2)}</span>
                        </div>
                      );
                    })
                }
              </div>
            )}
          </Field>
        </div>
        {selCard && (
          <div style={{ marginBottom:12, padding:"10px 14px", background:"#F9FAFB", borderRadius:8, display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:"#6B7280" }}>Selected: <strong style={{color:"#111827"}}>{selCard.cardName}</strong></span>
            <Badge bg={CC[selCard.cardType]?.bg} color={CC[selCard.cardType]?.text}>{selCard.cardType}</Badge>
            <span style={{ fontSize:12, color:"#6B7280" }}>Value: <strong style={{color:"#92400e"}}>${(selCard.marketValue||0).toFixed(2)}</strong></span>
          </div>
        )}
        <div style={{ display:"flex", gap:10, alignItems:"end" }}>
          <div style={{ flex:1 }}><TextInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="e.g. Break #2"/></div>
          <Btn onClick={handleAdd} disabled={!breaker||!cardId} variant="green">Log Card Out</Btn>
          <Btn onClick={()=>{setBulkMode(p=>!p);setBulkSel(new Set());}} variant="ghost">{bulkMode?"Cancel Bulk":"Bulk Log Out"}</Btn>
        </div>
        {bulkMode && (
          <div style={{ marginTop:16, borderTop:"1px solid #F0D0DC", paddingTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>Select cards to log out</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:8, maxHeight:280, overflowY:"auto", marginBottom:12 }}>
              {available.map(c => {
                const cc=CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                const isSel=bulkSel.has(c.id);
                return (
                  <div key={c.id} onClick={()=>toggleBulk(c.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:isSel?"#FFF0F5":"#FAFAFA", border:`1.5px solid ${isSel?"#E8317A":"#F0D0DC"}`, borderRadius:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={isSel} onChange={()=>toggleBulk(c.id)} onClick={e=>e.stopPropagation()}/>
                    <div><div style={{ fontSize:12, fontWeight:700, color:"#111827" }}>{c.cardName}</div><Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge></div>
                  </div>
                );
              })}
            </div>
            {bulkSel.size>0 && <Btn onClick={handleBulkLog} disabled={!breaker} variant="green">✅ Log Out {bulkSel.size} Card{bulkSel.size!==1?"s":""}</Btn>}
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
                <div key={ct} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F3F4F6" }}>
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
            <thead><tr>{["Date","Breaker","Card Name","Card Type","Usage","Logged By","Notes"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
            <tbody>
              {breaks.length===0 ? <EmptyRow msg="No breaks logged yet." cols={7}/> :
                [...breaks].reverse().map((b,i) => {
                  const bc=BC[b.breaker]||{bg:"#F3F4F6",text:"#6B7280"};
                  const cc=CC[b.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                  return (
                    <tr key={b.id} className="break-row" style={{ background:i%2===0?"#FFFFFF":"#FFF5F8" }}>
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:11 }}>{b.date}</td>
                      <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{b.breaker}</Badge></td>
                      <td style={{ ...S.td, fontWeight:700 }}>{b.cardName}</td>
                      <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{b.cardType}</Badge></td>
                      <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{b.usage||"—"}</td>
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:12 }}>{b.loggedBy||"—"}</td>
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

function Performance({ breaks, user, userRole }) {
  const isAdmin        = userRole?.role === "Admin";
  const currentUser    = user?.displayName?.split(" ")[0] || "";
  const matchedBreaker = BREAKERS.find(b => currentUser.toLowerCase().includes(b.toLowerCase()));
  const visibleBreakers = isAdmin ? BREAKERS : (matchedBreaker ? [matchedBreaker] : []);
  const now  = new Date();
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  function getStats(breaker) {
    const all   = breaks.filter(b => b.breaker===breaker);
    const month = all.filter(b => { const d=new Date(b.dateAdded||b.date); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
    const byType = {}; CARD_TYPES.forEach(ct => { byType[ct]=all.filter(b=>b.cardType===ct).length; });
    const byDay  = [0,0,0,0,0,0,0];
    all.forEach(b => { const d=new Date(b.dateAdded||b.date); if(!isNaN(d)) byDay[d.getDay()]++; });
    const last7 = [];
    for (let i=6; i>=0; i--) { const d=new Date(); d.setDate(d.getDate()-i); last7.push({ date:d.toLocaleDateString("en",{weekday:"short"}), count:all.filter(b=>new Date(b.dateAdded||b.date).toDateString()===d.toDateString()).length }); }
    let streak=0;
    for (let i=0; i<30; i++) { const d=new Date(); d.setDate(d.getDate()-i); if(all.some(b=>new Date(b.dateAdded||b.date).toDateString()===d.toDateString())) streak++; else if(i>0) break; }
    const topType = CARD_TYPES.reduce((a,ct) => byType[ct]>byType[a]?ct:a, CARD_TYPES[0]);
    return { all, month, byType, byDay, last7, streak, topType };
  }

  if (visibleBreakers.length===0) return <div style={{ ...S.card, textAlign:"center", padding:"60px" }}><div style={{ fontSize:32, marginBottom:12 }}>📈</div><div style={{ color:"#9CA3AF" }}>Your account isn't linked to a streamer profile.</div></div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {visibleBreakers.map((breaker,bi) => {
        const bc    = BC[breaker];
        const stats = getStats(breaker);
        return (
          <div key={breaker}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:bc.bg, border:`2px solid ${bc.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:bc.text }}>{breaker[0]}</div>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:"#111827" }}>{breaker}</div>
                <div style={{ fontSize:11, color:"#9CA3AF" }}>{stats.all.length} total cards logged</div>
              </div>
              {stats.streak>0 && <div style={{ marginLeft:"auto", background:bc.bg, border:`1.5px solid ${bc.border}`, borderRadius:10, padding:"6px 14px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:900, color:bc.text }}>🔥 {stats.streak}</div>
                <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>Day Streak</div>
              </div>}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
              {[
                { l:"Total Cards Used", v:stats.all.length,   c:bc.text },
                { l:"This Month",       v:stats.month.length, c:bc.text },
                { l:"Top Card Type",    v:stats.topType.replace(" Cards",""), c:CC[stats.topType]?.text||bc.text },
                { l:"Active Streak",    v:stats.streak>0?`${stats.streak}d`:"—", c:stats.streak>0?"#E8317A":"#9CA3AF" },
              ].map(({l,v,c}) => (
                <div key={l} style={{ ...S.card, textAlign:"center" }}>
                  <div style={{ fontSize:22, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
                  <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
                </div>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div style={S.card}>
                <SectionLabel t="Card Type Breakdown" />
                {CARD_TYPES.map(ct => {
                  const cc=CC[ct]; const cnt=stats.byType[ct]; const pct=stats.all.length>0?cnt/stats.all.length:0;
                  return (
                    <div key={ct} style={{ marginBottom:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:cc.text }}>{ct}</span>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>{cnt} ({(pct*100).toFixed(0)}%)</span>
                      </div>
                      <div style={{ height:6, background:"#F0E0E8", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct*100}%`, background:cc.border, borderRadius:3 }}/>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={S.card}>
                <SectionLabel t="Last 7 Days" />
                <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:100 }}>
                  {stats.last7.map((d,i) => {
                    const max=Math.max(...stats.last7.map(x=>x.count),1);
                    const h=Math.max((d.count/max)*80, d.count>0?8:2);
                    return (
                      <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:d.count>0?bc.text:"#9CA3AF" }}>{d.count||""}</div>
                        <div style={{ width:"100%", height:h, background:d.count>0?bc.border:"#F0E0E8", borderRadius:"3px 3px 0 0" }}/>
                        <div style={{ fontSize:9, color:"#9CA3AF" }}>{d.date}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={S.card}>
              <SectionLabel t="Activity by Day of Week" />
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
                {DAYS.map((day,i) => {
                  const count=stats.byDay[i]; const max=Math.max(...stats.byDay,1); const intensity=count/max;
                  const r=parseInt(bc.border.slice(1,3),16), g=parseInt(bc.border.slice(3,5),16), b2=parseInt(bc.border.slice(5,7),16);
                  return (
                    <div key={day} style={{ textAlign:"center", padding:"10px 4px", background:count===0?"#F0E0E8":`rgba(${r},${g},${b2},${0.2+intensity*0.8})`, borderRadius:8, border:"1px solid #F0E0E8" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:count>0?bc.text:"#9CA3AF" }}>{day}</div>
                      <div style={{ fontSize:16, fontWeight:900, color:count>0?bc.text:"#D1D5DB", marginTop:2 }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && bi < visibleBreakers.length-1 && <div style={{ height:1, background:"#F0E0E8", margin:"8px 0 16px" }}/>}
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const [tab,       setTab]       = useState("dashboard");
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [breaks,    setBreaks]    = useState([]);
  const [comps,     setComps]     = useState([]);
  const [toast,     setToast]     = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(query(collection(db,"inventory"), orderBy("dateAdded","asc")),  snap => setInventory(snap.docs.map(d => ({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"breaks"),    orderBy("dateAdded","asc")),  snap => setBreaks(snap.docs.map(d => ({id:d.id,...d.data()}))));
    const u3 = onSnapshot(query(collection(db,"comps"),     orderBy("dateAdded","desc")), snap => setComps(snap.docs.map(d => ({id:d.id,...d.data()}))));
    return () => { u1(); u2(); u3(); };
  }, [user]);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3500); }

  async function handleAccept(cards, seller, u) {
    for (const card of cards) await setDoc(doc(db,"inventory",card.id), { ...card, addedBy:u?.displayName||"Unknown" });
    showToast(`✅ ${cards.length} card${cards.length!==1?"s":""} added to inventory`);
    setTab("inventory");
  }
  async function handleRemove(id) { await deleteDoc(doc(db,"inventory",id)); }
  async function handleBulkRemove(ids) {
    for (const id of ids) await deleteDoc(doc(db,"inventory",id));
    showToast(`🗑 ${ids.length} card${ids.length!==1?"s":""} deleted`);
  }
  async function handleSaveComp(comp) {
    const id = uid();
    await setDoc(doc(db,"comps",id), { ...comp, id, dateAdded:new Date().toISOString(), savedBy:user?.displayName||"Unknown" });
    showToast("💾 Comp saved to history");
  }
  async function handleDeleteComp(id) { await deleteDoc(doc(db,"comps",id)); showToast("🗑 Comp deleted"); }
  async function handleAddBreak(b) {
    await setDoc(doc(db,"breaks",b.id), b);
    showToast(`✅ ${b.cardName} logged out by ${b.breaker}`);
  }
  async function handleBulkAddBreak(entries) {
    for (const b of entries) await setDoc(doc(db,"breaks",b.id), b);
    showToast(`✅ ${entries.length} cards logged out by ${entries[0]?.breaker}`);
  }

  const userRole = getUserRole(user);
  const TABS = [
    { id:"dashboard",   label:"📊 Dashboard"   },
    { id:"comp",        label:"🧮 Lot Comp"     },
    { id:"inventory",   label:"📦 Inventory"    },
    { id:"breaks",      label:"🎯 Break Log"    },
    { id:"performance", label:"📈 Performance"  },
  ];

  if (!authReady) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#FFFFFF", fontFamily:"'Trebuchet MS',sans-serif", fontSize:18, fontWeight:700, color:"#E8317A" }}>Loading...</div>;
  if (!user) return <LoginScreen />;

  return (
    <div style={{ background:"#F3F4F6", minHeight:"100vh", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", color:"#111827" }}>
      <GlobalStyles />
      <div style={{ background:"#000000", padding:"0 20px", position:"sticky", top:0, zIndex:100, boxShadow:"0 2px 20px rgba(232,49,122,0.2)" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", gap:20 }}>
          <div style={{ padding:"13px 0", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
            <span className="nav-bazooka" style={{ fontSize:20, fontWeight:900, color:"#E8317A", letterSpacing:2 }}>BAZOOKA</span>
            <span style={{ fontSize:10, color:"#444444", borderLeft:"1px solid #333333", paddingLeft:10, textTransform:"uppercase", letterSpacing:1 }}>BoBA Tracker</span>
          </div>
          <nav style={{ display:"flex", gap:2, flex:1 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={()=>setTab(t.id)} className="nav-tab" style={{ background:tab===t.id?"#1a1a2e":"transparent", border:"none", color:tab===t.id?"#E8317A":"#888888", padding:"10px 14px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:tab===t.id?700:400, fontFamily:"inherit", borderBottom:tab===t.id?"2px solid #E8317A":"2px solid transparent" }}>
                {t.label}
              </button>
            ))}
          </nav>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            <span style={{ color:"#9CA3AF", fontSize:11 }}>{inventory.length} cards</span>
            {user.photoURL && <img src={user.photoURL} alt="" style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #E8317A" }}/>}
            <span style={{ color:"#9CA3AF", fontSize:11 }}>{user.displayName?.split(" ")[0]}</span>
            <span style={{ background:"#1a1a2e", color:"#E8317A", border:"1px solid #E8317A44", borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{userRole.label}</span>
            <button onClick={()=>signOut(auth)} style={{ background:"transparent", border:"1px solid #444444", color:"#999999", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
          </div>
        </div>
      </div>

      <div key={tab} className="tab-content" style={{ maxWidth:1200, margin:"0 auto", padding:"20px" }}>
        {tab==="dashboard"   && <Dashboard   inventory={inventory} breaks={breaks} user={user} />}
        {tab==="comp"        && (CAN_VIEW_LOT_COMP.includes(userRole.role) ? <LotComp onAccept={handleAccept} onSaveComp={handleSaveComp} onDeleteComp={handleDeleteComp} comps={comps} user={user} userRole={userRole}/> : <AccessDenied msg="Lot Comp is for Admin and Procurement only." />)}
        {tab==="inventory"   && <Inventory   inventory={inventory} breaks={breaks} onRemove={handleRemove} onBulkRemove={handleBulkRemove} user={user} userRole={userRole}/>}
        {tab==="breaks"      && (CAN_LOG_BREAKS.includes(userRole.role) ? <BreakLog inventory={inventory} breaks={breaks} onAdd={handleAddBreak} onBulkAdd={handleBulkAddBreak} user={user}/> : <AccessDenied msg="Break Log access is restricted." />)}
        {tab==="performance" && <Performance breaks={breaks} user={user} userRole={userRole}/>}
      </div>

      {toast && <div className="toast" style={{ position:"fixed", bottom:20, right:20, background:"#166534", color:"#ffffff", padding:"12px 18px", borderRadius:10, fontWeight:700, fontSize:13, boxShadow:"0 4px 24px rgba(0,0,0,0.2)", zIndex:999 }}>{toast}</div>}
    </div>
  );
}
