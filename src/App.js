import { useState, useEffect } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";

const CARD_TYPES = ["Giveaway/Standard Cards","First-Timer Cards","Chaser Cards"];
const BREAKERS = ["Dev","Dre","Krystal"];
const PRODUCT_TYPES = ["Double Mega","Hobby","Jumbo","Miscellaneous"];
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
const CAN_VIEW_LOT_COMP = ["Admin","Procurement","Streamer","Shipping","Viewer"];

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

function Dashboard({ inventory, breaks, user, userRole, streams=[] }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [financialPeriod, setFinancialPeriod] = useState("month");
  const [customStart,     setCustomStart]     = useState("");
  const [customEnd,       setCustomEnd]       = useState("");
  const [drillDown,       setDrillDown]       = useState(null); // "gross"|"imc"|"commission"|"bazooka"
    const canSeeCosts      = ["Admin","Procurement"].includes(userRole?.role);
  const usedIds    = new Set(breaks.map(b => b.inventoryId));
  const transitIds = new Set(inventory.filter(c => c.cardStatus === "in_transit").map(c => c.id));
  const stats = {};
  CARD_TYPES.forEach(ct => { stats[ct] = { total:0, used:0, inTransit:0, invested:0, market:0 }; });
  inventory.forEach(c => {
    const s = stats[c.cardType]; if (!s) return;
    s.total++; s.invested += (c.costPerCard||0); s.market += (c.marketValue||0);
    if (usedIds.has(c.id)) s.used++;
    else if (c.cardStatus === "in_transit") s.inTransit++;
  });
  const totInv      = Object.values(stats).reduce((a,b) => a+b.invested, 0);
  const totMkt      = Object.values(stats).reduce((a,b) => a+b.market, 0);
  const oPct        = totMkt > 0 ? totInv/totMkt : null;
  const oz          = getZone(oPct);
  const usedCount   = [...usedIds].length;
  const transitCount = inventory.filter(c => c.cardStatus === "in_transit" && !usedIds.has(c.id)).length;
  const availCount  = inventory.length - usedCount - transitCount;

  const runway = {};
  CARD_TYPES.forEach(ct => {
    const avail = stats[ct].total - stats[ct].used - stats[ct].inTransit;
    const ctBreaks = breaks.filter(b => b.cardType === ct);
    if (ctBreaks.length === 0) { runway[ct] = 999; return; }
    const earliest = ctBreaks.reduce((mn, b) => { const d = new Date(b.dateAdded||b.date); return d < mn ? d : mn; }, new Date());
    const days = Math.max(1, Math.floor((new Date() - earliest) / 86400000));
    runway[ct] = Math.floor(avail / (ctBreaks.length / days));
  });

  const alerts = CARD_TYPES.filter(ct => (stats[ct].total - stats[ct].used - stats[ct].inTransit) < TARGETS[ct].buffer);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── FINANCIAL OVERVIEW (Admin only) ── */}
      {canSeeFinancials && (() => {
        // Period filter
        const now   = new Date();
        function inPeriod(dateStr) {
          if (!dateStr) return false;
          const d = new Date(dateStr);
          if (financialPeriod === "custom") {
            const s = customStart ? new Date(customStart) : new Date(0);
            const e = customEnd   ? new Date(customEnd+"T23:59:59") : new Date();
            return d >= s && d <= e;
          }
          if (financialPeriod === "week") {
            const start = new Date(now); start.setDate(now.getDate() - now.getDay());
            start.setHours(0,0,0,0);
            return d >= start;
          }
          if (financialPeriod === "month")   return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
          if (financialPeriod === "quarter") {
            const q = Math.floor(now.getMonth()/3);
            return Math.floor(d.getMonth()/3)===q && d.getFullYear()===now.getFullYear();
          }
          if (financialPeriod === "year")    return d.getFullYear()===now.getFullYear();
          return true;
        }

        function calcStream(s) {
          const gross   = parseFloat(s.grossRevenue)||0;
          const fees    = parseFloat(s.whatnotFees)||0;
          const coupons = parseFloat(s.coupons)||0;
          const promo   = parseFloat(s.whatnotPromo)||0;
          const magpros = parseFloat(s.magpros)||0;
          const pack    = parseFloat(s.packagingMaterial)||0;
          const topload = parseFloat(s.topLoaders)||0;
          const chaser  = parseFloat(s.chaserCards)||0;
          const totalExp = fees+coupons+promo+magpros+pack+topload+chaser;
          const netRev   = gross - totalExp;
          const bazNet   = netRev * 0.30;
          const imcNet   = netRev * 0.70;
          const repExp   = totalExp * 0.135;
          const commBase = bazNet - repExp;
          const mm = parseFloat(s.marketMultiple)||0;
          const rate = s.binOnly ? 0.35 : mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
          const commAmt  = commBase * rate;
          return { gross, totalExp, netRev, bazNet, imcNet, repExp, commBase, rate, commAmt };
        }

        const filtered = streams.filter(s => inPeriod(s.date));
        const totals   = filtered.reduce((acc,s) => {
          const c = calcStream(s);
          acc.gross  += c.gross;
          acc.imc    += c.imcNet;
          acc.comm   += c.commAmt;
          acc.baz    += c.bazNet;
          return acc;
        }, { gross:0, imc:0, comm:0, baz:0 });

        const PERIOD_LABELS = { week:"This Week", month:"This Month", quarter:"This Quarter", year:"This Year", all:"All Time", custom:"Custom Range" };

        // Drill-down modal content
        const renderDrillDown = () => {
          if (!drillDown) return null;
          const config = {
            gross:      { label:"Gross Revenue",       color:"#E8317A", val: s => calcStream(s).gross },
            imc:        { label:"Owed to IMC (70%)",   color:"#6B2D8B", val: s => calcStream(s).imcNet },
            commission: { label:"Commission Owed",     color:"#166534", val: s => calcStream(s).commAmt },
            bazooka:    { label:"Bazooka Net (30%)",   color:"#1B4F8A", val: s => calcStream(s).bazNet },
          }[drillDown];
          return (
            <div style={{ ...S.card, border:`2px solid ${config.color}33`, marginTop:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <SectionLabel t={config.label} />
                <button onClick={()=>setDrillDown(null)} style={{ background:"none", border:"none", color:"#9CA3AF", cursor:"pointer", fontSize:18 }}>✕</button>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    {["Date","Breaker","Gross","Net","Rate",(drillDown==="commission"?"Commission":drillDown==="imc"?"IMC (70%)":drillDown==="bazooka"?"Bazooka (30%)":"Gross")].map(h=><th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filtered.length===0
                      ? <EmptyRow msg={streams.length===0 ? "No streams logged yet — add a stream recap in Break Log." : "No streams in this period."} cols={6}/>
                      : filtered.map((s,i) => {
                          const c   = calcStream(s);
                          const bc  = BC[s.breaker]||{bg:"#F3F4F6",text:"#6B7280"};
                          const val = config.val(s);
                          return (
                            <tr key={s.id} style={{ background:i%2===0?"#FFFFFF":"#FFF5F8" }}>
                              <td style={S.td}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                              <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge></td>
                              <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>${c.gross.toFixed(2)}</td>
                              <td style={{ ...S.td, color:"#1B4F8A", fontWeight:700 }}>${c.netRev.toFixed(2)}</td>
                              <td style={{ ...S.td, color:"#6B7280" }}>{(c.rate*100).toFixed(0)}%{s.binOnly?" BIN":""}</td>
                              <td style={{ ...S.td, color:config.color, fontWeight:900 }}>${val.toFixed(2)}</td>
                            </tr>
                          );
                        })
                    }
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"#F9FAFB", borderTop:"2px solid #F0E0E8" }}>
                      <td colSpan={5} style={{ ...S.td, fontWeight:800, color:"#111827" }}>Total ({filtered.length} stream{filtered.length!==1?"s":""})</td>
                      <td style={{ ...S.td, fontWeight:900, color:config.color, fontSize:15 }}>${filtered.reduce((a,s)=>a+config.val(s),0).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        };

        return (
          <>
          <div style={{ ...S.card, border:"2px solid #E8317A22" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
              <SectionLabel t="Financial Overview" />
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {[["week","Week"],["month","Month"],["quarter","Quarter"],["year","Year"],["all","All Time"],["custom","Custom"]].map(([val,label]) => (
                  <button key={val} onClick={()=>setFinancialPeriod(val)} style={{ background:financialPeriod===val?"#1A1A2E":"transparent", color:financialPeriod===val?"#E8317A":"#9CA3AF", border:`1.5px solid ${financialPeriod===val?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{label}</button>
                ))}
              </div>
            </div>

            {financialPeriod === "custom" && (
              <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
                <div><label style={S.lbl}>From</label><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{ ...S.inp, width:"auto" }}/></div>
                <div><label style={S.lbl}>To</label><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{ ...S.inp, width:"auto" }}/></div>
                <div style={{ fontSize:12, color:"#9CA3AF", marginTop:14 }}>{filtered.length} stream{filtered.length!==1?"s":""} in range</div>
              </div>
            )}

            <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:12, fontWeight:600 }}>{PERIOD_LABELS[financialPeriod]} · {filtered.length} stream{filtered.length!==1?"s":""}</div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
              {[
                { key:"gross",      label:"Gross Revenue",     val:totals.gross, color:"#E8317A", sub:"click for stream breakdown" },
                { key:"imc",        label:"Owed to IMC",       val:totals.imc,   color:"#6B2D8B", sub:"70% of net revenue" },
                { key:"commission", label:"Commission Owed",   val:totals.comm,  color:"#166534", sub:"click to see per rep" },
                { key:"bazooka",    label:"Bazooka Net",       val:totals.baz,   color:"#1B4F8A", sub:"30% of net revenue" },
              ].map(({key,label,val,color,sub}) => (
                <div
                  key={key}
                  onClick={()=>setDrillDown(drillDown===key?null:key)}
                  className="stat-card"
                  style={{ background:drillDown===key?"#1A1A2E":"#FAFAFA", border:`2px solid ${drillDown===key?color:color+"22"}`, borderRadius:12, padding:"16px", textAlign:"center", cursor:"pointer" }}
                >
                  <div style={{ fontSize:26, fontWeight:900, color:drillDown===key?"#FFFFFF":color, marginBottom:4 }}>${val.toFixed(2)}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:drillDown===key?"#E8317A":"#111827", marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:10, color:drillDown===key?"#888":"#9CA3AF" }}>{drillDown===key?"▲ hide":"▼ "+sub}</div>
                </div>
              ))}
            </div>
          </div>

          {drillDown && renderDrillDown()}
          </>
        );
      })()}

      <div style={{ ...S.card, border: alerts.length > 0 ? "2px solid #FCA5A5" : "2px solid #D6F4E3" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <SectionLabel t="Inventory Health Check" />
          <span style={{ fontSize:12, fontWeight:700, padding:"4px 12px", borderRadius:20, background:alerts.length===0?"#D6F4E3":alerts.length<=2?"#FFF9DB":"#FEE2E2", color:alerts.length===0?"#166534":alerts.length<=2?"#92400e":"#991b1b" }}>
            {alerts.length===0 ? "✅ All Good" : `🚨 ${alerts.length} Critical`}
          </span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${canSeeFinancials?5:4},1fr)`, gap:10, marginBottom:16 }}>
          {[
            { l:"Total Cards",    v:inventory.length, c:"#111827" },
            { l:"Available",      v:availCount,       c:"#166534" },
            { l:"In Transit",     v:transitCount,     c:"#2C3E7A" },
            { l:"Used",           v:usedCount,        c:"#991b1b" },
            ...(canSeeFinancials ? [{ l:"Portfolio Zone", v:oz?oz.label:"No data", c:oz?.color||"#9CA3AF" }] : []),
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
            const avail   = stats[ct].total - stats[ct].used - stats[ct].inTransit;
            const transit = stats[ct].inTransit;
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
                    {transit > 0 && <span style={{ fontSize:11, color:"#2C3E7A", fontWeight:700, background:"#EEF0FB", padding:"2px 8px", borderRadius:5 }}>🚚 {transit} in transit</span>}
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
        {canSeeFinancials && (
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
        )}
      </div>

      <div style={S.card}>
        <SectionLabel t="Inventory by Card Type" />
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {/* Header row */}
          <div style={{ display:"grid", gridTemplateColumns:"180px 1fr 1fr 1fr 1fr 60px auto", gap:8, padding:"0 16px", alignItems:"center" }}>
            <div/>
            {["Stock","Used","Avail","Transit","Min"].map(h => (
              <div key={h} style={{ textAlign:"center", fontSize:9, fontWeight:700, color:"#D1D5DB", textTransform:"uppercase", letterSpacing:1 }}>{h}</div>
            ))}
            <div/>
          </div>
          {CARD_TYPES.map(ct => {
            const d = stats[ct]; const { buffer } = TARGETS[ct]; const cc = CC[ct];
            const avail   = d.total - d.used - d.inTransit;
            const transit = d.inTransit;
            const pct   = d.market > 0 ? d.invested/d.market : null;
            const ok = avail >= buffer; const warn = avail >= buffer*0.5;
            const sc = ok?"#166534":warn?"#92400e":"#991b1b";
            const sl = ok?"✅ Stocked":warn?"⚠️ Low":"🚨 Critical";
            return (
              <div key={ct} style={{ background:cc.bg, border:`1px solid ${cc.border}44`, borderRadius:9, padding:"12px 16px", display:"grid", gridTemplateColumns:"180px 1fr 1fr 1fr 1fr 60px auto", gap:8, alignItems:"center" }}>
                <span style={{ fontWeight:700, color:cc.text, fontSize:14 }}>{ct}</span>
                {[
                  { v:d.total,  c:cc.text      },
                  { v:d.used,   c:"#991b1b"    },
                  { v:avail,    c:sc            },
                  { v:transit,  c: transit>0 ? "#2C3E7A" : "#D1D5DB" },
                  { v:buffer,   c:"#9CA3AF"    },
                ].map(({v,c},i) => (
                  <div key={i} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                  </div>
                ))}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                  {canSeeFinancials && <ZoneBadge pct={pct} />}
                  <span className={!ok&&!warn?"status-critical":""} style={{ background:ok?"#D6F4E3":warn?"#FFF9DB":"#FEE2E2", color:sc, border:`1px solid ${sc}33`, borderRadius:5, padding:"3px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{sl}</span>
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

    </div>
  );
}

function LotComp({ onAccept, onSaveComp, onDeleteComp, comps, user, userRole }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [compMode,     setCompMode]     = useState("builder");
  const [seller,       setSeller]       = useState({ name:"", contact:"", date:"", source:"", payment:"", paymentHandle:"" });
  const [lotPct,       setLotPct]       = useState("");
  const [finalOffer,   setFOffer]       = useState("");
  const [custView,     setCustView]     = useState(false);
  const [custNote,     setCustNote]     = useState("");
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
  const offerAmt  = finalOffer !== "" ? parseFloat(finalOffer) : null;
  const counterAmt = counterOffer !== "" ? parseFloat(counterOffer) : null;
  // Priority: counter > manual override > calculated
  const dispOffer  = (counterAmt != null && counterAmt > 0) ? counterAmt : (offerAmt != null && offerAmt > 0) ? offerAmt : calcOffer;
  const dispPct    = totalMkt > 0 ? dispOffer / totalMkt : pctNum;
  const lotZone    = totalMkt > 0 ? getZone(dispOffer/totalMkt) : null;
  const totalCards = included.reduce((s,r) => s+(parseInt(r.qty)||1), 0);
  const quickTotal     = (parseFloat(quickMktVal)||0) * (parseInt(quickCards)||0);
  const quickCalcOffer = quickTotal * (parseFloat(quickPct)/100 || 0.60);
  const quickOfferAmt  = parseFloat(quickOffer) || quickCalcOffer;
  const quickZone      = quickTotal > 0 ? getZone(quickOfferAmt/quickTotal) : null;
  const counterZone    = totalMkt > 0 && counterAmt != null && counterAmt > 0 ? getZone(counterAmt/totalMkt) : null;

  function upd(id,f,v) { setRows(p => p.map(r => r.id===id ? {...r,[f]:v} : r)); }
  function addRow() { setRows(p => [...p, { id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true }]); }

  function loadComp(comp) {
    setSeller({ name:comp.seller||"", contact:comp.contact||"", date:comp.date||"", source:comp.source||"", payment:comp.payment||"", paymentHandle:comp.paymentHandle||"" });
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
      source:seller.source, payment:seller.payment, paymentHandle:seller.paymentHandle, totalCards, totalMarket:totalMkt,
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
    onAccept(cards, seller, user, custNote);
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
            <thead><tr>{["#","Card Name","Qty","Value/Card","Offer/Card"].map(h=><th key={h} style={{ padding:"8px 10px", borderBottom:"2px solid #F0E0E8", color:"#9CA3AF", fontSize:10, fontWeight:700, textTransform:"uppercase", textAlign:"left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {included.length===0 ? <EmptyRow msg="No cards added." cols={5}/> :
                included.map((r,i) => {
                  const mv = parseFloat(r.mktVal)||0;
                  return (
                    <tr key={r.id} style={{ borderBottom:"1px solid #FFF0F5" }}>
                      <td style={{ padding:"8px 10px", color:"#D1D5DB", fontSize:11, width:32, textAlign:"center" }}>{i+1}</td>
                      <td style={{ padding:"8px 10px", fontWeight:700, color:"#111827" }}>{r.name}</td>
                      <td style={{ padding:"8px 10px", color:"#6B7280", textAlign:"center" }}>{parseInt(r.qty)||1}</td>
                      <td style={{ padding:"8px 10px", color:"#92400e", fontWeight:600 }}>${mv.toFixed(2)}</td>
                      <td style={{ padding:"8px 10px", color:"#166534", fontWeight:700 }}>${(mv*dispPct).toFixed(2)}</td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
        <div style={{ padding:"16px 24px", borderTop:"2px solid #F0E0E8", marginTop:8 }}>
          {/* Notes — rendered read-only in the quote */}
          {custNote.trim() && (
            <div style={{ marginBottom:14, padding:"12px 16px", background:"#FAFAFA", border:"1px solid #F0E0E8", borderLeft:"3px solid #E8317A", borderRadius:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Notes</div>
              <p style={{ margin:0, fontSize:13, color:"#374151", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{custNote}</p>
            </div>
          )}
          {[[`Total Cards`,totalCards],...(canSeeFinancials?[[`Total Market Value`,`$${totalMkt.toFixed(2)}`]]:[])] .map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #FFF0F5" }}>
              <span style={{ color:"#6B7280", fontSize:13 }}>{l}</span>
              <span style={{ color:"#111827", fontWeight:700 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, padding:"14px 20px", background:"#1A1A2E", borderRadius:10 }}>
            <span style={{ color:"#E8317A", fontWeight:800, fontSize:16 }}>Bazooka's Offer</span>
            <span style={{ color:"#FFFFFF", fontWeight:900, fontSize:22 }}>${dispOffer.toFixed(2)}</span>
          </div>
          {/* Ship-to address */}
          <div style={{ marginTop:14, padding:"12px 16px", background:"#F9FAFB", border:"1px solid #F0E0E8", borderRadius:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Ship Cards To</div>
            <div style={{ fontSize:13, color:"#111827", fontWeight:700, lineHeight:1.8 }}>
              Devin — Bazooka<br/>
              425 Prosperity Dr<br/>
              Warsaw, IN 46582
            </div>
          </div>

          {/* Payment section — shows when payment method + handle entered */}
          {seller.payment && seller.paymentHandle && (() => {
            const handle = seller.paymentHandle.trim();
            const amt    = dispOffer > 0 ? dispOffer.toFixed(2) : "";
            const note   = encodeURIComponent(`Bazooka card purchase - ${seller.name||"lot"}`);
            const cleanHandle = handle.replace(/^@/,"");

            const paymentConfig = {
              PayPal: {
                color: "#003087",
                label: "Send via PayPal",
                hint:  `To: ${handle}`,
                href:  `https://www.paypal.com/paypalme/${cleanHandle}${amt?"/"+amt:""}`,
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0 1 .761-.641h6.927c2.34 0 4.02.646 4.956 1.92.434.588.676 1.24.728 1.98.056.812-.07 1.766-.376 2.838-.79 2.764-2.723 4.168-5.745 4.168H9.87a.77.77 0 0 0-.761.641l-.87 5.49a.641.641 0 0 1-.633.54l-.53.001z" fill="#003087"/><path d="M19.612 8.2c-.056-.392-.163-.758-.32-1.094-.62 3.4-2.76 5.13-6.354 5.13H10.71l-1.04 6.567h2.197a.641.641 0 0 0 .633-.54l.87-5.49a.77.77 0 0 1 .761-.641h1.325c2.594 0 4.325-1.068 5.03-3.208.323-.98.37-1.822.126-2.724z" fill="#0070E0"/></svg>,
              },
              Venmo: {
                color: "#3D95CE",
                label: "Send via Venmo",
                hint:  `To: @${cleanHandle}`,
                href:  `venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${amt}&note=${note}`,
                webHref: `https://venmo.com/u/${cleanHandle}`,
                webHref: `https://venmo.com/${cleanHandle}`,
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#3D95CE"/><path d="M18.5 5.5c.4.7.6 1.4.6 2.3 0 2.9-2.5 6.6-4.5 9.2H10L8 5.8l4-.4 1 7.2c.9-1.5 2-3.8 2-5.4 0-.9-.2-1.5-.4-2l3.9-.7z" fill="white"/></svg>,
              },
              Zelle: {
                color: "#6D1ED4",
                label: "Send via Zelle",
                hint:  `To: ${handle}`,
                href:  null, // Zelle has no deep link
                icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#6D1ED4"/><path d="M16.5 6H7.5L6 9h7.2L6 15h1.8L16.5 9v-.5L18 6h-1.5zm0 3h-7.2L16.5 15H18L16.5 9z" fill="white"/></svg>,
              },
            };

            const cfg = paymentConfig[seller.payment];
            if (!cfg) return null;

            return (
              <div style={{ marginTop:14, padding:"14px 16px", background:"#FFFFFF", border:`2px solid ${cfg.color}33`, borderRadius:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>
                  Payment — <span style={{ color:cfg.color }}>{seller.payment}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    {cfg.icon}
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:cfg.color }}>{cfg.hint}</div>
                      {amt && <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>Amount: <strong style={{color:"#111827"}}>${amt}</strong></div>}
                    </div>
                  </div>
                  {cfg.href
                    ? <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                        <a href={cfg.href} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:cfg.color, color:"#FFFFFF", border:"none", borderRadius:9, padding:"10px 20px", fontSize:13, fontWeight:800, textDecoration:"none", cursor:"pointer" }}>
                          {cfg.icon} {cfg.label} →
                        </a>
                        {cfg.webHref && <a href={cfg.webHref} target="_blank" rel="noreferrer" style={{ fontSize:11, color:cfg.color, textDecoration:"underline" }}>Open in browser instead</a>}
                      </div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                        <div style={{ background:cfg.color, color:"#FFFFFF", borderRadius:9, padding:"10px 20px", fontSize:13, fontWeight:800, textAlign:"center" }}>Open Zelle App</div>
                        <div style={{ fontSize:11, color:"#9CA3AF" }}>Send to: <strong style={{color:"#111827"}}>{handle}</strong></div>
                      </div>
                  }
                </div>
              </div>
            );
          })()}

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
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:12 }}>
          {[
            { z:"🟢 Green",  p:"Under 65%", a:"Buy independently",          bg:"#D6F4E3", c:"#166534" },
            { z:"🟡 Yellow", p:"65–70%",    a:"Flag before buying",          bg:"#FFF9DB", c:"#92400e" },
            { z:"🔴 Red",    p:"Over 70%",  a:"Pass or get approval",        bg:"#FEE2E2", c:"#991b1b" },
          ].map(({z,p,a,bg,c}) => (
            <div key={z} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:bg, border:`1px solid ${c}22`, borderRadius:7 }}>
              <span style={{ fontWeight:800, color:c, fontSize:12, whiteSpace:"nowrap" }}>{z}</span>
              <span style={{ color:c, fontSize:11, whiteSpace:"nowrap" }}>{p}</span>
              <span style={{ color:"#9CA3AF", fontSize:11 }}>— {a}</span>
            </div>
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
          <div style={{ display:"grid", gridTemplateColumns:`repeat(${canSeeFinancials?4:2},1fr)`, gap:10 }}>
            {[
              ...(canSeeFinancials ? [
                { l:"Total Market Value", v:`$${quickTotal.toFixed(2)}`,     c:"#92400e" },
                { l:"Calculated Offer",   v:`$${quickCalcOffer.toFixed(2)}`, c:"#166534" },
              ] : []),
              { l:"Your Offer",  v:`$${quickOfferAmt.toFixed(2)}`,  c:"#6B2D8B" },
              { l:"Lot Zone",    v:quickZone?quickZone.label:"—",   c:quickZone?.color||"#9CA3AF" },
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
                const savedByRole = Object.entries(ROLES).find(([k]) => (c.savedBy||"").toLowerCase().includes(k))?.[1];
                const savedAt = c.dateAdded ? new Date(c.dateAdded).toLocaleString() : c.date;
                return (
                  <div key={c.id} style={{ ...S.card, border:`1px solid ${z?.color||"#F0D0DC"}33` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                      <div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                          <span style={{ fontWeight:800, fontSize:15, color:"#111827" }}>{c.seller||"Unknown Seller"}</span>
                          <span style={{ background:c.status==="accepted"?"#D6F4E3":c.status==="passed"?"#FEE2E2":"#FFF9DB", color:c.status==="accepted"?"#166534":c.status==="passed"?"#991b1b":"#92400e", borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                            {c.status==="accepted"?"✅ Accepted":c.status==="passed"?"❌ Passed":"💾 Saved"}
                          </span>
                          {z && canSeeFinancials && <span style={{ background:z.bg, color:z.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{z.label}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:11, color:"#9CA3AF" }}>Saved by</span>
                          <span style={{ fontWeight:700, fontSize:12, color:"#111827" }}>{c.savedBy||"—"}</span>
                          {savedByRole && <span style={{ background:savedByRole.bg, color:savedByRole.color, border:`1px solid ${savedByRole.color}33`, borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{savedByRole.label}</span>}
                          <span style={{ fontSize:11, color:"#D1D5DB" }}>·</span>
                          <span style={{ fontSize:11, color:"#9CA3AF" }}>{savedAt}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                        <button onClick={()=>loadComp(c)} style={{ background:"#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>📥 Load into Builder</button>
                        {CAN_DELETE.includes(userRole?.role) && <button onClick={()=>{ if(window.confirm(`Delete this comp from history?\n\nSaved by: ${c.savedBy||"Unknown"}\nSeller: ${c.seller||"Unknown"}\n\nThis action will be logged.`)) onDeleteComp(c.id); }} style={{ background:"#FEE2E2", color:"#991b1b", border:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑</button>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap", paddingTop:8, borderTop:"1px solid #FFF0F5" }}>
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>Cards: <strong style={{color:"#111827"}}>{c.totalCards}</strong></span>
                      {canSeeFinancials && <>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>Market: <strong style={{color:"#92400e"}}>${(c.totalMarket||0).toFixed(2)}</strong></span>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>Offer: <strong style={{color:"#6B2D8B"}}>${(c.offer||0).toFixed(2)}</strong></span>
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>Blended: <strong style={{color:z?.color||"#111827"}}>{((c.blendedPct||0)*100).toFixed(1)}%</strong></span>
                      </>}
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>Source: <strong style={{color:"#111827"}}>{c.source||"—"}</strong></span>
                      <span style={{ fontSize:12, color:"#9CA3AF" }}>
                        {c.cards&&c.cards.length>0 ? <span style={{color:"#166534",fontWeight:700}}>✓ {c.cards.length} card{c.cards.length!==1?"s":""} saved</span> : <span style={{color:"#92400e",fontWeight:700}}>⚠ No card details</span>}
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
            <SelectInput label="Payment Method" value={seller.payment} onChange={v=>setSeller(p=>({...p,payment:v,paymentHandle:""}))} options={PAYMENT_METHODS} />
            <TextInput
              label={seller.payment==="Venmo" ? "Venmo Handle (e.g. @username)" : seller.payment==="PayPal" ? "PayPal Username / Email" : seller.payment==="Zelle" ? "Zelle Email or Phone" : "Payment Handle / Info"}
              value={seller.paymentHandle}
              onChange={v=>setSeller(p=>({...p,paymentHandle:v}))}
              placeholder={seller.payment==="Venmo" ? "@theirhandle" : seller.payment==="PayPal" ? "username or email" : seller.payment==="Zelle" ? "email or phone" : "handle or account info"}
            />
            <SelectInput label="Source"         value={seller.source}  onChange={v=>setSeller(p=>({...p,source:v}))}  options={SOURCES} />
          </div>
        </div>

        <div style={S.card}>
          <SectionLabel t="Lot-Level Controls" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, alignItems:"end" }}>
            <div>
              <label style={S.lbl}>Buy % (blank = 60%)</label>
              <input
                type="number"
                value={lotPct}
                onChange={e => { setLotPct(e.target.value); setFOffer(""); }}
                placeholder="60"
                style={{ ...S.inp, fontWeight:700, color: lotPct ? "#1B4F8A" : "#9CA3AF" }}
              />
            </div>
            <div>
              <label style={S.lbl}>Override Offer ($)</label>
              <input
                type="number"
                value={finalOffer}
                onChange={e => { setFOffer(e.target.value); setLotPct(""); }}
                placeholder={totalMkt > 0 ? calcOffer.toFixed(2) : "0.00"}
                style={{ ...S.inp, fontWeight:700, color: (offerAmt != null && offerAmt > 0) ? "#E8317A" : "#9CA3AF", border: (offerAmt != null && offerAmt > 0) ? "2px solid #E8317A" : "1px solid #F0D0DC" }}
              />
            </div>
            <div>
              <label style={S.lbl}>Active Offer</label>
              <div style={{ ...S.inp, background: (counterAmt!=null&&counterAmt>0)?"#FFF9DB":(offerAmt!=null&&offerAmt>0)?"#FFF0F5":"#F9FAFB", color:(counterAmt!=null&&counterAmt>0)?"#92400e":(offerAmt!=null&&offerAmt>0)?"#E8317A":"#166534", fontWeight:900, fontSize:15, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span>${dispOffer.toFixed(2)}</span>
                <span style={{ fontSize:10, color:"#9CA3AF", fontWeight:600 }}>{(counterAmt!=null&&counterAmt>0)?"counter":(offerAmt!=null&&offerAmt>0)?"override":`${(dispPct*100).toFixed(0)}%`}</span>
              </div>
            </div>
            <div>
              <label style={S.lbl}>Zone</label>
              <div style={{ ...S.inp, background:lotZone?.bg||"#F9FAFB", border:`1.5px solid ${lotZone?.color||"#D1D5DB"}`, color:lotZone?.color||"#9CA3AF", fontWeight:700 }}>
                {lotZone ? lotZone.label : totalMkt > 0 ? "—" : "Add cards first"}
              </div>
            </div>
          </div>
          {(offerAmt != null && offerAmt > 0) && totalMkt > 0 && (
            <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:12, color:"#9CA3AF" }}>Effective buy rate: <strong style={{ color: lotZone?.color||"#111827" }}>{(dispPct*100).toFixed(1)}%</strong></span>
              <button onClick={()=>setFOffer("")} style={{ background:"none", border:"none", color:"#9CA3AF", cursor:"pointer", fontSize:12, textDecoration:"underline", fontFamily:"inherit" }}>Clear override</button>
            </div>
          )}
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
                  const cz  = mv > 0 ? getZone(dispPct) : null;
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
                      <td style={{ ...S.td, color:"#166534", fontWeight:700 }}>${(mv*dispPct).toFixed(2)}</td>
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
          <SectionLabel t="Confirm & Actions" />
          {canSeeFinancials && dispOffer > 0 && totalMkt > 0 && (
            <div style={{ marginBottom:16, padding:"8px 14px", background:"#F9FAFB", borderRadius:8, display:"flex", gap:20, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, color:"#9CA3AF" }}>Active offer: <strong style={{color:(counterAmt!=null&&counterAmt>0)?"#92400e":(offerAmt!=null&&offerAmt>0)?"#E8317A":"#166534"}}>${dispOffer.toFixed(2)} ({(dispPct*100).toFixed(1)}%)</strong></span>
              <span style={{ fontSize:12, color:"#9CA3AF" }}>Est. Margin: <strong style={{color:"#6B2D8B"}}>${(totalMkt-dispOffer).toFixed(2)}</strong></span>
              <span style={{ fontSize:12, color:"#9CA3AF" }}>Market Value: <strong style={{color:"#92400e"}}>${totalMkt.toFixed(2)}</strong></span>
              <span style={{ fontSize:12, color:"#9CA3AF" }}>Per Card: <strong style={{color:"#166534"}}>${totalCards>0?(dispOffer/totalCards).toFixed(2):"—"}</strong></span>
            </div>
          )}
          {/* Pay button — appears when payment method + handle are filled */}
          {seller.payment && seller.paymentHandle && (() => {
            const handle      = seller.paymentHandle.trim();
            const cleanHandle = handle.replace(/^@/,"");
            const amt         = dispOffer > 0 ? dispOffer.toFixed(2) : "";
            const note        = encodeURIComponent(`Bazooka card purchase - ${seller.name||"lot"}`);
            const PCFG = {
              Venmo:      { color:"#3D95CE", bg:"#E8F5FF", label:"Send via Venmo",    hint:`@${cleanHandle}`, href:`venmo://paycharge?txn=pay&recipients=${cleanHandle}&amount=${amt}&note=${note}`, webHref:`https://venmo.com/u/${cleanHandle}` },
              PayPal:     { color:"#003087", bg:"#E8EEFF", label:"Send via PayPal",   hint:handle,            href:`https://www.paypal.com/paypalme/${cleanHandle}${amt?"/"+amt:""}` },
              Zelle:      { color:"#6D1ED4", bg:"#F3EEFF", label:"Open Zelle",        hint:handle,            href:null },
              "Cash App": { color:"#00C244", bg:"#E6FFF0", label:"Send via Cash App", hint:`$${cleanHandle}`, href:`https://cash.app/$${cleanHandle}${amt?"/"+amt:""}` },
              Cash:       { color:"#166534", bg:"#D6F4E3", label:"Cash Payment",      hint:`$${amt||"—"} cash`, href:null },
            };
            const cfg = PCFG[seller.payment];
            if (!cfg) return null;
            return (
              <div style={{ marginBottom:16, padding:"14px 16px", background:cfg.bg, border:`2px solid ${cfg.color}33`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>💸 Send Payment</div>
                  <div style={{ fontWeight:800, fontSize:16, color:cfg.color }}>{cfg.hint}</div>
                  {amt && <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>Amount: <strong style={{color:"#111827"}}>${amt}</strong></div>}
                </div>
                {cfg.href
                  ? <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <a href={cfg.href} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:cfg.color, color:"#FFFFFF", borderRadius:9, padding:"12px 24px", fontSize:14, fontWeight:800, textDecoration:"none", whiteSpace:"nowrap" }}>{cfg.label} →</a>
                      {cfg.webHref && <a href={cfg.webHref} target="_blank" rel="noreferrer" style={{ fontSize:11, color:cfg.color, textDecoration:"underline" }}>Open in browser instead</a>}
                    </div>
                  : <div style={{ background:cfg.color, color:"#FFFFFF", borderRadius:9, padding:"12px 24px", fontSize:14, fontWeight:800 }}>{seller.payment==="Cash"?`Pay $${amt} cash`:`Open ${seller.payment} → ${cfg.hint}`}</div>
                }
              </div>
            );
          })()}

          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
            <Btn onClick={()=>setCustView(true)} variant="ghost">👁 Customer View</Btn>
            <Btn onClick={()=>saveComp("saved")} variant="ghost">💾 Save Comp</Btn>
            <Btn onClick={()=>saveComp("passed")} variant="ghost">❌ Pass on Lot</Btn>
            <Btn onClick={()=>{saveComp("accepted");doAccept();}} disabled={included.length===0} variant="green">✅ Accept & Import {totalCards} card{totalCards!==1?"s":""}</Btn>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ ...S.lbl, color:"#E8317A" }}>Notes for Seller (shown on Customer View)</label>
            <textarea
              value={custNote}
              onChange={e=>setCustNote(e.target.value)}
              placeholder="e.g. Condition notes, grade estimates, any special considerations..."
              rows={2}
              style={{ ...S.inp, resize:"vertical", lineHeight:1.5, fontSize:12 }}
            />
          </div>
          <div style={{ borderTop:"1px solid #F0D0DC", paddingTop:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1.5 }}>Counter Offer Calculator</div>
              {(counterAmt!=null&&counterAmt>0) && <span style={{ background:"#FFF9DB", color:"#92400e", border:"1px solid #92400e33", borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>⚠ Counter is active — overrides your offer</span>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
              <div><label style={S.lbl}>Seller's Counter ($)</label><input type="number" value={counterOffer} onChange={e=>setCounterOffer(e.target.value)} placeholder="0.00" style={{ ...S.inp, border:(counterAmt!=null&&counterAmt>0)?"2px solid #E8317A":S.inp.border }}/></div>
              <div><label style={S.lbl}>Counter Zone</label><div style={{ ...S.inp, background:counterZone?.bg||"#F9FAFB", border:`1.5px solid ${counterZone?.color||"#E5E7EB"}`, color:counterZone?.color||"#9CA3AF", fontWeight:700 }}>{counterZone?counterZone.label:totalMkt>0?"Enter counter":"Add cards first"}</div></div>
              <div><label style={S.lbl}>Counter Buy %</label><div style={{ ...S.inp, color:(counterAmt!=null&&counterAmt>0)?(counterZone?.color||"#6B2D8B"):"#9CA3AF", fontWeight:700 }}>{(counterAmt!=null&&counterAmt>0)&&totalMkt>0?`${((counterAmt/totalMkt)*100).toFixed(1)}%`:"—"}</div></div>
              <div><label style={S.lbl}>vs Your Offer</label><div style={{ ...S.inp, color:(counterAmt!=null&&counterAmt>(offerAmt!=null&&offerAmt>0?offerAmt:calcOffer))?"#991b1b":"#166534", fontWeight:700 }}>{(counterAmt!=null&&counterAmt>0)&&calcOffer>0?`$${Math.abs(counterAmt-(offerAmt>0?offerAmt:calcOffer)).toFixed(2)} ${counterAmt>(offerAmt!=null&&offerAmt>0?offerAmt:calcOffer)?"over":"under"}`:"—"}</div></div>
            </div>
            {(counterAmt!=null&&counterAmt>0) && totalMkt > 0 && (
              <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:"#9CA3AF" }}>Active offer: <strong style={{color:"#111827"}}>${counterAmt.toFixed(2)}</strong> at <strong style={{color:counterZone?.color||"#111827"}}>{((counterAmt/totalMkt)*100).toFixed(1)}%</strong> — card values and zones updated</span>
                <button onClick={()=>setCounterOffer("")} style={{ background:"none", border:"none", color:"#9CA3AF", cursor:"pointer", fontSize:12, fontWeight:700, textDecoration:"underline" }}>Clear</button>
              </div>
            )}
          </div>
        </div>
      </>}
    </div>
  );
}

function Inventory({ inventory, breaks, onRemove, onBulkRemove, user, userRole, lotTracking={}, onSaveLotTracking, lotNotes={}, onSaveLotNotes, onDeleteLot, shipments=[], productUsage=[], onSaveShipment, onDeleteShipment }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [trackingEdit,   setTrackingEdit]   = useState(null);
  const [trackingForm,   setTrackingForm]   = useState({ carrier:"", trackingNum:"", status:"", eta:"", notes:"" });

  const [search,   setSearch]   = useState("");
  const [typeF,    setTypeF]    = useState("");
  const [statusF,  setStatusF]  = useState("available");
  const [selected, setSelected] = useState(new Set());
  const [invTab,   setInvTab]   = useState("cards");
  const usedIds  = new Set(breaks.map(b => b.inventoryId));
  const filtered = inventory.filter(c => {
    const mn      = c.cardName?.toLowerCase().includes(search.toLowerCase());
    const mt      = !typeF || c.cardType===typeF;
    const used    = usedIds.has(c.id);
    const transit = !used && c.cardStatus === "in_transit";
    const ms      = statusF==="available"   ? (!used && !transit)
                  : statusF==="in_transit"  ? transit
                  : statusF==="used"        ? used
                  : true;
    return mn && mt && ms;
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
          {[["cards","📦 Cards"],["lots","🗂 Lot History"],["aging","⏰ Aging"],["customers","👥 Customers"],["product","🎁 Product"]].map(([id,label]) => (
            <button key={id} onClick={()=>setInvTab(id)} style={{ background:invTab===id?"#1A1A2E":"transparent", color:invTab===id?"#E8317A":"#9CA3AF", border:`1.5px solid ${invTab===id?"#E8317A":"#E5E7EB"}`, borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
          ))}
        </div>

        {invTab==="lots" && (() => {
          const lots = {};
          inventory.forEach(c => {
            const key = `${c.seller||"Unknown"}__${c.date||"Unknown"}`;
            if (!lots[key]) lots[key] = { key, seller:c.seller||"Unknown", date:c.date||"Unknown", source:c.source||"—", payment:c.payment||"—", lotPaid:c.lotTotalPaid||0, cards:[], addedBy:c.addedBy||"—" };
            lots[key].cards.push(c);
          });
          const lotList = Object.values(lots).sort((a,b) => new Date(b.date)-new Date(a.date));

          // Find any note keys that don't match a current lot key (orphaned from old format)
          const currentLotKeys = new Set(lotList.map(l => l.key));
          const orphanedNotes  = Object.entries(lotNotes).filter(([k]) => !currentLotKeys.has(k));
          function migrateNotes() {
            let fixed = 0;
            const promises = [];
            for (const [oldKey, noteData] of orphanedNotes) {
              const sellerName = oldKey.split("__")[0];
              const match = lotList.find(l => l.seller.toLowerCase() === sellerName.toLowerCase());
              if (match && !lotNotes[match.key]) {
                promises.push(onSaveLotNotes(match.key, noteData.notes));
                fixed++;
              }
            }
            Promise.all(promises).then(() => alert(`Migrated ${fixed} note${fixed!==1?"s":""} to correct lot keys.`));
          }

          const CARRIERS = ["USPS","UPS","FedEx","DHL","Other"];
          const TRACKING_STATUSES = ["Ordered","Label Created","Shipped","In Transit","Out for Delivery","Delivered","Exception"];
          const STATUS_COLORS = {
            "Ordered":            { bg:"#F3F4F6", color:"#6B7280" },
            "Label Created":      { bg:"#EEF0FB", color:"#2C3E7A" },
            "Shipped":            { bg:"#FFF0CC", color:"#8B5E00" },
            "In Transit":         { bg:"#E0F7F4", color:"#0D6E6E" },
            "Out for Delivery":   { bg:"#FCE8F3", color:"#8B1A5A" },
            "Delivered":          { bg:"#D6F4E3", color:"#166534" },
            "Exception":          { bg:"#FEE2E2", color:"#991b1b" },
          };

          return (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:12 }}>
              {orphanedNotes.length > 0 && CAN_DELETE.includes(userRole?.role) && (
                <div style={{ marginBottom:12, padding:"10px 16px", background:"#FFF9DB", border:"1.5px solid #92400e33", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <span style={{ fontSize:12, color:"#92400e" }}>⚠ {orphanedNotes.length} note{orphanedNotes.length!==1?"s":""} from previous lots couldn't be matched automatically.</span>
                  <button onClick={migrateNotes} style={{ background:"#92400e", color:"#fff", border:"none", borderRadius:7, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>Fix Now</button>
                </div>
              )}
              {lotList.length===0
                ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"40px 0" }}>No lots yet</div>
                : lotList.map((lot,i) => {
                    const usedInLot    = lot.cards.filter(c=>usedIds.has(c.id)).length;
                    const transitInLot = lot.cards.filter(c=>!usedIds.has(c.id) && c.cardStatus==="in_transit").length;
                    const availInLot   = lot.cards.length - usedInLot - transitInLot;
                    const tracking  = lotTracking[lot.key] || {};
                    const isEditing = trackingEdit === lot.key;
                    const sc        = STATUS_COLORS[tracking.status] || { bg:"#F3F4F6", color:"#9CA3AF" };

                    return (
                      <div key={i} style={{ border:"1px solid #F0D0DC", borderRadius:10, overflow:"hidden", background:"#FFFFFF" }}>
                        {/* Lot header */}
                        <div style={{ padding:"14px 18px", background:"#FAFAFA" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                            <div><span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>{lot.seller}</span><span style={{ color:"#9CA3AF", fontSize:12, marginLeft:10 }}>{lot.date}</span></div>
                            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                              <span style={{ fontSize:12, color:"#6B7280" }}>{lot.source}{canSeeFinancials?` · ${lot.payment}`:""}</span>
                              {canSeeFinancials && <span style={{ fontWeight:700, color:"#6B2D8B" }}>${lot.lotPaid.toFixed(2)}</span>}
                              {CAN_DELETE.includes(userRole?.role) && (
                                <button
                                  onClick={() => onDeleteLot(lot.key, lot.cards.map(c=>c.id))}
                                  style={{ background:"#FEE2E2", color:"#991b1b", border:"1.5px solid #fca5a5", borderRadius:7, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                  title="Delete entire lot">🗑 Delete Lot</button>
                              )}
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:8 }}>
                            <span style={{ fontSize:12, color:"#9CA3AF" }}>Total: <strong style={{color:"#111827"}}>{lot.cards.length}</strong></span>
                            <span style={{ fontSize:12, color:"#9CA3AF" }}>Available: <strong style={{color:"#166534"}}>{availInLot}</strong></span>
                            {transitInLot > 0 && <span style={{ fontSize:12, color:"#9CA3AF" }}>In Transit: <strong style={{color:"#2C3E7A"}}>🚚 {transitInLot}</strong></span>}
                            <span style={{ fontSize:12, color:"#9CA3AF" }}>Used: <strong style={{color:"#991b1b"}}>{usedInLot}</strong></span>
                            <span style={{ fontSize:12, color:"#9CA3AF" }}>Added by: <strong style={{color:"#111827"}}>{lot.addedBy}</strong></span>
                          </div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                            {CARD_TYPES.map(ct => { const count=lot.cards.filter(c=>c.cardType===ct).length; if(!count) return null; const cc=CC[ct]; return <span key={ct} style={{ background:cc.bg, color:cc.text, border:`1px solid ${cc.border}44`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{ct}: {count}</span>; })}
                          </div>
                        </div>

                        {/* Tracking bar */}
                        <div style={{ borderTop:"1px solid #F0E0E8", padding:"10px 18px", background:"#FFFFFF" }}>
                          {!isEditing ? (
                            <div>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom: (tracking.eta||tracking.lastEvent||tracking.lastEvent) ? 8 : 0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>📦 Tracking</span>
                                  {tracking.trackingNum || tracking.status
                                    ? <>
                                        {tracking.status && <span style={{ background:sc.bg, color:sc.color, border:`1px solid ${sc.color}33`, borderRadius:5, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{tracking.status}</span>}
                                        {tracking.carrier && <span style={{ fontSize:12, color:"#6B7280" }}>{tracking.carrier}</span>}
                                        {tracking.trackingNum && (() => {
                                            const num = tracking.trackingNum;
                                            const CURL = {
                                              USPS:  `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`,
                                              UPS:   `https://www.ups.com/track?tracknum=${num}`,
                                              FedEx: `https://www.fedex.com/fedextrack/?tracknumbers=${num}`,
                                              DHL:   `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${num}`,
                                            };
                                            const url = CURL[tracking.carrier] || `https://www.google.com/search?q=${encodeURIComponent((tracking.carrier||'')+" tracking "+num)}`;
                                            return <a key="tlink" href={url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#E8317A", fontWeight:700, fontFamily:"monospace", textDecoration:"none" }}>{num} ↗</a>;
                                          })()}
                                        {tracking.lastChecked && <span style={{ fontSize:10, color:"#D1D5DB" }}>· checked {new Date(tracking.lastChecked).toLocaleString()}</span>}
                                      </>
                                    : <span style={{ fontSize:12, color:"#D1D5DB" }}>No tracking added yet</span>
                                  }
                                </div>
                                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                                  {tracking.trackingNum && tracking.status !== "Delivered" && (
                                    <button
                                      onClick={() => onSaveLotTracking(lot.key, { ...tracking, status:"Delivered" })}
                                      style={{ background:"#166534", color:"#fff", border:"1.5px solid #14532d", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                    >✅ Mark Delivered</button>
                                  )}
                                  {tracking.status === "Delivered" && (
                                    <button
                                      onClick={() => onSaveLotTracking(lot.key, { ...tracking, status:"In Transit" })}
                                      style={{ background:"#FEE2E2", color:"#991b1b", border:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                    >↩ Undo Delivered</button>
                                  )}
                                  <button
                                    onClick={() => { setTrackingEdit(lot.key); setTrackingForm({ carrier:tracking.carrier||"", trackingNum:tracking.trackingNum||"", status:tracking.status||"", eta:tracking.eta||"", notes:tracking.notes||"" }); }}
                                    style={{ background:"transparent", border:"1.5px solid #E8317A", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                  >{tracking.trackingNum ? "✏️ Edit" : "+ Add Tracking"}</button>
                                </div>
                              </div>
                              {/* ETA + last event row */}
                              {(tracking.eta || tracking.lastEvent) && (
                                <div style={{ display:"flex", gap:16, flexWrap:"wrap", padding:"8px 12px", background:"#F9FAFB", borderRadius:7, marginTop:4 }}>
                                  {tracking.eta && (
                                    <span style={{ fontSize:12, color:"#9CA3AF" }}>
                                      📅 Est. Delivery: <strong style={{ color: tracking.status==="Delivered" ? "#166534" : "#1B4F8A" }}>{tracking.eta}</strong>
                                    </span>
                                  )}
                                  {tracking.lastEvent && (
                                    <span style={{ fontSize:12, color:"#9CA3AF" }}>
                                      📍 {tracking.lastLocation && <strong style={{color:"#111827"}}>{tracking.lastLocation} — </strong>}{tracking.lastEvent}
                                    </span>
                                  )}

                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color:"#E8317A", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>📦 Edit Tracking</div>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
                                <div>
                                  <label style={S.lbl}>Carrier</label>
                                  <select value={trackingForm.carrier} onChange={e=>setTrackingForm(p=>({...p,carrier:e.target.value}))} style={{ ...S.inp, cursor:"pointer", color:trackingForm.carrier?"#111827":"#9CA3AF" }}>
                                    <option value="">Select...</option>
                                    {CARRIERS.map(c=><option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={S.lbl}>Tracking Number</label>
                                  <input value={trackingForm.trackingNum} onChange={e=>setTrackingForm(p=>({...p,trackingNum:e.target.value, status:p.status||"In Transit"}))} placeholder="e.g. 9400111899..." style={S.inp}/>
                                </div>
                                <div>
                                  <label style={S.lbl}>Status</label>
                                  <select value={trackingForm.status} onChange={e=>setTrackingForm(p=>({...p,status:e.target.value}))} style={{ ...S.inp, cursor:"pointer", color:trackingForm.status?"#111827":"#9CA3AF" }}>
                                    <option value="">Select...</option>
                                    {TRACKING_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                                  </select>
                                </div>

                              </div>

                              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                                <button
                                  onClick={() => { onSaveLotTracking(lot.key, trackingForm); setTrackingEdit(null); }}
                                  style={{ background:"#166534", color:"#fff", border:"1.5px solid #14532d", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                                >💾 Save Tracking</button>

                                <button
                                  onClick={() => setTrackingEdit(null)}
                                  style={{ background:"#F3F4F6", color:"#6B7280", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
                                >Cancel</button>
                              </div>
                            </div>
                          )}
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

      {invTab==="customers" && <Sellers inventory={inventory} breaks={breaks} userRole={userRole}/>}
      {invTab==="product"   && <ProductInventory shipments={shipments} productUsage={productUsage} onSaveShipment={onSaveShipment} onDeleteShipment={onDeleteShipment} user={user} userRole={userRole}/>}

      {invTab==="cards" && <>
        <div style={S.card}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search card name..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{ ...S.inp, width:"auto", minWidth:160, color:typeF?"#111827":"#9CA3AF", cursor:"pointer" }}>
              <option value="">All Types</option>
              {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
            </select>
            <div style={{ display:"flex", gap:4 }}>
              {[["available","✅ Available"],["in_transit","🚚 In Transit"],["used","🔴 Used"],["all","All"]].map(([val,label]) => (
                <button key={val} onClick={()=>setStatusF(val)} style={{ background:statusF===val?"#1A1A2E":"transparent", color:statusF===val?"#E8317A":"#9CA3AF", border:`1.5px solid ${statusF===val?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{label}</button>
              ))}
            </div>
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
                  {["Card Name","Type",...(canSeeFinancials?["Market Value","Lot Paid","Payment"]:[]),"Source","Seller","Date","Added By","Status",""].map(h=><th key={h} style={S.th}>{h}</th>)}
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
                        {canSeeFinancials && <>
                          <td style={{ ...S.td, color:"#92400e", fontWeight:700 }}>${(c.marketValue||0).toFixed(2)}</td>
                          <td style={{ ...S.td, color:"#6B7280" }}>${(c.lotTotalPaid||0).toFixed(2)}</td>
                          <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.payment||"—"}</td>
                        </>}
                        <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.source||"—"}</td>
                        <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{c.seller||"—"}</td>
                        <td style={{ ...S.td, color:"#9CA3AF", fontSize:11 }}>{c.date||"—"}</td>
                        <td style={{ ...S.td, color:"#9CA3AF", fontSize:12 }}>{c.addedBy||"—"}</td>
                        <td style={S.td}>{used
                          ? <Badge bg="#FEE2E2" color="#991b1b">Used</Badge>
                          : c.cardStatus==="in_transit"
                            ? <Badge bg="#EEF0FB" color="#2C3E7A">🚚 In Transit</Badge>
                            : <Badge bg="#D6F4E3" color="#166534">Available</Badge>
                        }</td>
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

function BreakLog({ inventory, breaks, onAdd, onBulkAdd, onDeleteBreak, user, userRole, streams=[], onSaveStream, productUsage=[], onSaveProductUsage, shipments=[] }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const isAdminOrStreamer = ["Admin","Streamer"].includes(userRole?.role);
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
  const [histSel,    setHistSel]    = useState(new Set());

  // Stream recap state
  const EMPTY_RECAP = { grossRevenue:"", whatnotFees:"", coupons:"", whatnotPromo:"", magpros:"", packagingMaterial:"", topLoaders:"", chaserCards:"", marketMultiple:"", binOnly:false, breakType:"auction", streamNotes:"" };
  const EMPTY_USAGE = { doubleMega:"", hobby:"", jumbo:"", misc:"", miscNotes:"" };
  const [recap,       setRecap]       = useState(EMPTY_RECAP);
  const [prodUsage,   setProdUsage]   = useState(EMPTY_USAGE);
  const [recapSaving, setRecapSaving] = useState(false);
  const [recapSaved,  setRecapSaved]  = useState(false);

  // Check existing product usage for this breaker+date
  const existingUsage = productUsage.find(u => u.breaker === breaker && u.date === date);

  // Check if a stream recap already exists for this breaker+date
  const existingStream = streams.find(s => s.breaker === breaker && s.date === date);

  // Load existing stream into form when breaker/date changes
  useEffect(() => {
    if (existingStream) {
      setRecap({ grossRevenue:existingStream.grossRevenue||"", whatnotFees:existingStream.whatnotFees||"", coupons:existingStream.coupons||"", whatnotPromo:existingStream.whatnotPromo||"", magpros:existingStream.magpros||"", packagingMaterial:existingStream.packagingMaterial||"", topLoaders:existingStream.topLoaders||"", chaserCards:existingStream.chaserCards||"", marketMultiple:existingStream.marketMultiple||"", binOnly:existingStream.binOnly||false, breakType:existingStream.breakType||"auction", streamNotes:existingStream.notes||"" });
      setRecapSaved(true);
    } else {
      setRecap(EMPTY_RECAP);
      setRecapSaved(false);
    }
    if (existingUsage) {
      setProdUsage({ doubleMega:existingUsage.doubleMega||"", hobby:existingUsage.hobby||"", jumbo:existingUsage.jumbo||"", misc:existingUsage.misc||"", miscNotes:existingUsage.miscNotes||"" });
    } else {
      setProdUsage(EMPTY_USAGE);
    }
  }, [breaker, date]);

  function rf(k) { return v => { setRecap(p=>({...p,[k]:v})); setRecapSaved(false); }; }

  function calcRecap() {
    const gross   = parseFloat(recap.grossRevenue)||0;
    const fees    = parseFloat(recap.whatnotFees)||0;
    const coupons = parseFloat(recap.coupons)||0;
    const promo   = parseFloat(recap.whatnotPromo)||0;
    const magpros = parseFloat(recap.magpros)||0;
    const pack    = parseFloat(recap.packagingMaterial)||0;
    const topload = parseFloat(recap.topLoaders)||0;
    const chaser  = parseFloat(recap.chaserCards)||0;
    const totalExp = fees+coupons+promo+magpros+pack+topload+chaser;
    const netRev   = gross - totalExp;
    const bazNet   = netRev * 0.30;
    const imcNet   = netRev * 0.70;
    const repExp   = totalExp * 0.135;
    const commBase = bazNet - repExp;
    const mm = parseFloat(recap.marketMultiple)||0;
    const rate = recap.binOnly ? 0.35 : mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
    const commAmt = commBase * rate;
    return { gross, totalExp, netRev, bazNet, imcNet, repExp, commBase, rate, commAmt };
  }

  async function handleSaveRecap() {
    if (!breaker || !date || !recap.grossRevenue) return;
    setRecapSaving(true);
    try {
      const streamId = existingStream?.id || uid();
      await onSaveStream({ ...(existingStream||{}), ...recap, notes:recap.streamNotes, id:streamId, breaker, date });
      // Save product usage from recap fields
      const prodFields = PRODUCT_TYPES.reduce((acc,pt) => { const v=parseInt(recap[`prod_${pt}`])||0; if(v>0) acc[pt]=v; return acc; }, {});
      if (Object.keys(prodFields).length > 0 && onSaveProductUsage) {
        await onSaveProductUsage({ id:uid(), streamId, breaker, date, ...prodFields });
      }
      setRecapSaved(true);
    } finally { setRecapSaving(false); }
  }

  const rc = calcRecap();
  const hasRecapData = !!(parseFloat(recap.grossRevenue)||0);

  const usedIds   = new Set(breaks.map(b => b.inventoryId));
  const available = inventory.filter(c => !usedIds.has(c.id) && c.cardStatus !== "in_transit");
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
  function toggleHistSel(id) { setHistSel(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; }); }
  function toggleAllHist() { setHistSel(histSel.size===breaks.length ? new Set() : new Set(breaks.map(b=>b.id))); }
  function handleBulkDeleteHist() {
    if (histSel.size===0) return;
    if (window.confirm(`Remove ${histSel.size} break log entr${histSel.size!==1?"ies":"y"}? These cards will become available again.`)) {
      [...histSel].forEach(id => onDeleteBreak(id));
      setHistSel(new Set());
    }
  }

  const sum = {};
  BREAKERS.forEach(b => { sum[b]={total:0}; CARD_TYPES.forEach(ct=>{sum[b][ct]=0;}); });
  breaks.forEach(b => { if(sum[b.breaker]){sum[b.breaker].total++; if(b.cardType)sum[b.breaker][b.cardType]++;} });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── STREAM RECAP ── */}
      <div style={{ ...S.card, border: recapSaved ? "2px solid #D6F4E3" : "2px solid #E8317A22" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
          <SectionLabel t="Stream Recap" />
          {recapSaved && <span style={{ background:"#D6F4E3", color:"#166534", border:"1px solid #2E7D5222", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700 }}>✅ Saved</span>}
        </div>

        {/* Breaker + Date + Break Type */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12, marginBottom:14 }}>
          <SelectInput label="Breaker" value={breaker} onChange={v=>{setBreaker(v);}} options={BREAKERS}/>
          <TextInput label="Date" type="date" value={date} onChange={setDate}/>
          <div>
            <label style={S.lbl}>Break Type</label>
            <select value={recap.breakType} onChange={e=>rf("breakType")(e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
              <option value="auction">Auction</option>
              <option value="bin">BIN</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
          <div>
            <label style={S.lbl}>Market Multiple</label>
            <input type="number" step="0.1" value={recap.marketMultiple} onChange={e=>rf("marketMultiple")(e.target.value)} placeholder="e.g. 1.6" style={{ ...S.inp, color: recap.marketMultiple?"#1B4F8A":"#9CA3AF" }} disabled={recap.binOnly}/>
          </div>
        </div>

        {/* Financials */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
          {[
            ["grossRevenue",      "Gross Revenue ($)",       "#166534", false],
            ["whatnotFees",       "Whatnot Fees ($)",        "#991b1b", false],
            ["coupons",           "Coupons ($)",             "#991b1b", !canSeeFinancials],
            ["whatnotPromo",      "Whatnot Promo ($)",       "#991b1b", !canSeeFinancials],
            ["magpros",           "MagPros ($)",             "#991b1b", !canSeeFinancials],
            ["packagingMaterial", "Packaging ($)",           "#991b1b", !canSeeFinancials],
            ["topLoaders",        "Top Loaders ($)",         "#991b1b", !canSeeFinancials],
            ["chaserCards",       "Chaser Cards ($)",        "#991b1b", !canSeeFinancials],
          ].filter(([,,, adminOnly]) => !adminOnly).map(([key, label, color]) => (
            <div key={key}>
              <label style={{ ...S.lbl, color: key==="grossRevenue"?"#166534":S.lbl.color }}>{label}</label>
              <input type="number" step="0.01" value={recap[key]||""} onChange={e=>rf(key)(e.target.value)} placeholder="0.00" style={{ ...S.inp, color }}/>
            </div>
          ))}
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:14, alignItems:"center" }}>
          <input type="checkbox" checked={recap.binOnly||false} onChange={e=>rf("binOnly")(e.target.checked)} style={{ width:16, height:16 }}/>
          <span style={{ fontSize:12, color:"#6B7280" }}>BIN Break — flat 35% commission</span>
        </div>

        {/* Product used this stream */}
        <div style={{ marginBottom:14 }}>
          <label style={{ ...S.lbl, marginBottom:8, display:"block" }}>📦 Product Used This Stream</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {PRODUCT_TYPES.map(pt => (
              <div key={pt}>
                <label style={{ ...S.lbl, color:"#6B2D8B" }}>{pt}</label>
                <input
                  type="number" min="0" step="1"
                  value={recap[`prod_${pt}`]||""}
                  onChange={e=>rf(`prod_${pt}`)(e.target.value)}
                  placeholder="0"
                  style={{ ...S.inp, color:"#6B2D8B" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live commission preview */}
        {hasRecapData && (
          <div style={{ background:"#F9FAFB", border:"1px solid #F0E0E8", borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:`repeat(${canSeeFinancials?5:2},1fr)`, gap:10 }}>
              {(canSeeFinancials ? [
                { l:"Net Revenue",  v:`$${rc.netRev.toFixed(2)}`,  c:"#1B4F8A" },
                { l:"Bazooka 30%",  v:`$${rc.bazNet.toFixed(2)}`,  c:"#E8317A" },
                { l:"IMC 70%",      v:`$${rc.imcNet.toFixed(2)}`,  c:"#6B2D8B" },
                { l:"Rep Expenses", v:`$${rc.repExp.toFixed(2)}`,  c:"#991b1b" },
                { l:`Commission (${(rc.rate*100).toFixed(0)}%)`, v:`$${rc.commAmt.toFixed(2)}`, c:"#166534" },
              ] : [
                { l:"Net Revenue",  v:`$${rc.netRev.toFixed(2)}`,  c:"#1B4F8A" },
                { l:`Your Commission (${(rc.rate*100).toFixed(0)}%)`, v:`$${rc.commAmt.toFixed(2)}`, c:"#166534" },
              ]).map(({l,v,c}) => (
                <div key={l} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10, alignItems:"center" }}>
          <Btn onClick={handleSaveRecap} disabled={!breaker||!date||!recap.grossRevenue||recapSaving} variant="green">
            {recapSaving ? "Saving..." : recapSaved ? "✅ Update Recap" : "💾 Save Stream Recap"}
          </Btn>
          {existingStream && !recapSaved && <span style={{ fontSize:11, color:"#92400e" }}>⚠ Unsaved changes</span>}
        </div>
      </div>

      {/* ── LOG CARDS ── */}
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
                          {canSeeFinancials && <span style={{ fontSize:12, color:"#92400e", fontWeight:600 }}>${(c.marketValue||0).toFixed(2)}</span>}
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
            {canSeeFinancials && <span style={{ fontSize:12, color:"#6B7280" }}>Value: <strong style={{color:"#92400e"}}>${(selCard.marketValue||0).toFixed(2)}</strong></span>}
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
        <div style={{ padding:"16px 20px 0" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
            <SectionLabel t="Break History"/>
            {histSel.size > 0 && (
              <button onClick={handleBulkDeleteHist} style={{ background:"#FEE2E2", color:"#991b1b", border:"1.5px solid #fca5a5", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginBottom:14 }}>
                🗑 Remove {histSel.size} selected
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              <th style={{ ...S.th, width:40, textAlign:"center" }}>
                <input type="checkbox" checked={breaks.length>0&&histSel.size===breaks.length} onChange={toggleAllHist}/>
              </th>
              {["Date","Breaker","Card Name","Card Type","Usage","Logged By","Notes",""].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {breaks.length===0 ? <EmptyRow msg="No breaks logged yet." cols={9}/> :
                [...breaks].reverse().map((b,i) => {
                  const bc=BC[b.breaker]||{bg:"#F3F4F6",text:"#6B7280"};
                  const cc=CC[b.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                  const isSel=histSel.has(b.id);
                  return (
                    <tr key={b.id} className="break-row" style={{ background:isSel?"#FFF0F5":i%2===0?"#FFFFFF":"#FFF5F8" }}>
                      <td style={{ ...S.td, textAlign:"center" }}><input type="checkbox" checked={isSel} onChange={()=>toggleHistSel(b.id)}/></td>
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:11 }}>{b.date}</td>
                      <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{b.breaker}</Badge></td>
                      <td style={{ ...S.td, fontWeight:700 }}>{b.cardName}</td>
                      <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{b.cardType}</Badge></td>
                      <td style={{ ...S.td, color:"#6B7280", fontSize:12 }}>{b.usage||"—"}</td>
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:12 }}>{b.loggedBy||"—"}</td>
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:12 }}>{b.notes||"—"}</td>
                      <td style={S.td}>
                        <button onClick={()=>{ if(window.confirm(`Remove "${b.cardName}" from break log? This will make the card available again.`)) onDeleteBreak(b.id); }} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:14, padding:2 }} title="Remove from break log">✕</button>
                      </td>
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

// ─── PRODUCT INVENTORY ───────────────────────────────────────────
function ProductInventory({ shipments=[], productUsage=[], onSaveShipment, onDeleteShipment, user, userRole }) {
  const isAdmin = ["Admin"].includes(userRole?.role);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: new Date().toISOString().split("T")[0], doubleMega:0, hobby:0, jumbo:0, misc:0, miscNotes:"", supplier:"" });

  // Calculate stock per type: received - used
  function getStock(type) {
    const received = shipments.reduce((sum, s) => sum + (parseInt(s[type])||0), 0);
    const used     = productUsage.reduce((sum, u) => sum + (parseInt(u[type])||0), 0);
    return { received, used, stock: received - used };
  }

  const stock = {
    doubleMega: getStock("doubleMega"),
    hobby:      getStock("hobby"),
    jumbo:      getStock("jumbo"),
    misc:       getStock("misc"),
  };

  const LABELS = { doubleMega:"Double Mega", hobby:"Hobby", jumbo:"Jumbo", misc:"Miscellaneous" };
  const COLORS = { doubleMega:"#6B2D8B", hobby:"#E8317A", jumbo:"#1B4F8A", misc:"#166534" };

  async function handleSave() {
    if (!Object.values({doubleMega:form.doubleMega,hobby:form.hobby,jumbo:form.jumbo,misc:form.misc}).some(v=>parseInt(v)>0)) return;
    await onSaveShipment({ ...form, id: uid() });
    setForm({ date:new Date().toISOString().split("T")[0], doubleMega:0, hobby:0, jumbo:0, misc:0, miscNotes:"", supplier:"" });
    setShowForm(false);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Stock overview */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {Object.entries(stock).map(([key, s]) => {
          const c = COLORS[key];
          const low = s.stock <= 2;
          return (
            <div key={key} style={{ ...S.card, textAlign:"center", border:`2px solid ${low?'#FCA5A5':c+'22'}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{LABELS[key]}</div>
              <div style={{ fontSize:42, fontWeight:900, color: low?"#991b1b":c, lineHeight:1 }}>{s.stock}</div>
              <div style={{ fontSize:10, color:"#9CA3AF", marginTop:6 }}>in stock</div>
              <div style={{ display:"flex", justifyContent:"center", gap:12, marginTop:8, fontSize:11, color:"#9CA3AF" }}>
                <span>📥 {s.received} rcvd</span>
                <span>📤 {s.used} used</span>
              </div>
              {low && <div style={{ marginTop:8, background:"#FEE2E2", color:"#991b1b", borderRadius:6, padding:"3px 0", fontSize:11, fontWeight:700 }}>⚠ Low Stock</div>}
            </div>
          );
        })}
      </div>

      {/* Add shipment */}
      {isAdmin && (
        <div style={S.card}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showForm?14:0 }}>
            <SectionLabel t="Receive Shipment" />
            <Btn onClick={()=>setShowForm(p=>!p)} variant="ghost">{showForm?"Cancel":"+ Receive Shipment"}</Btn>
          </div>
          {showForm && (
            <div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12, marginBottom:12 }}>
                <div><label style={S.lbl}>Date</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={S.inp}/></div>
                <div><label style={S.lbl}>Supplier / Source</label><input value={form.supplier} onChange={e=>setForm(p=>({...p,supplier:e.target.value}))} placeholder="e.g. IMC" style={S.inp}/></div>
                {["doubleMega","hobby","jumbo","misc"].map(k => (
                  <div key={k}><label style={S.lbl}>{LABELS[k]}</label><input type="number" min="0" value={form[k]||""} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder="0" style={S.inp}/></div>
                ))}
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={S.lbl}>Misc Notes (optional)</label>
                <input value={form.miscNotes} onChange={e=>setForm(p=>({...p,miscNotes:e.target.value}))} placeholder="e.g. Special edition boxes, collector tins..." style={S.inp}/>
              </div>
              <Btn onClick={handleSave} variant="green">📥 Save Shipment</Btn>
            </div>
          )}
        </div>
      )}

      {/* Shipment history */}
      <div style={S.card}>
        <SectionLabel t="Shipment History" />
        {shipments.length === 0
          ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"30px 0" }}>No shipments yet — receive your first shipment above</div>
          : <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  {["Date","Supplier","Double Mega","Hobby","Jumbo","Misc","Notes",...(isAdmin?[""]:[])].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {shipments.map((s,i) => (
                    <tr key={s.id} style={{ background:i%2===0?"#FFFFFF":"#FFF5F8" }}>
                      <td style={S.td}>{s.date}</td>
                      <td style={S.td}>{s.supplier||"—"}</td>
                      {["doubleMega","hobby","jumbo","misc"].map(k=>(
                        <td key={k} style={{ ...S.td, textAlign:"center", fontWeight:700, color:parseInt(s[k])>0?COLORS[k]:"#D1D5DB" }}>{parseInt(s[k])||0}</td>
                      ))}
                      <td style={{ ...S.td, color:"#9CA3AF", fontSize:11 }}>{s.miscNotes||"—"}</td>
                      {isAdmin && <td style={S.td}><button onClick={()=>{ if(window.confirm("Remove this shipment?")) onDeleteShipment(s.id); }} style={{ background:"none", border:"none", color:"#FCA5A5", cursor:"pointer", fontSize:14 }}>🗑</button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Usage history */}
      {productUsage.length > 0 && (
        <div style={S.card}>
          <SectionLabel t="Product Usage History" />
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                {["Date","Breaker","Double Mega","Hobby","Jumbo","Misc"].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {productUsage.map((u,i) => (
                  <tr key={u.id} style={{ background:i%2===0?"#FFFFFF":"#FFF5F8" }}>
                    <td style={S.td}>{u.date}</td>
                    <td style={S.td}>{u.breaker||"—"}</td>
                    {["doubleMega","hobby","jumbo","misc"].map(k=>(
                      <td key={k} style={{ ...S.td, textAlign:"center", fontWeight:700, color:parseInt(u[k])>0?COLORS[k]:"#D1D5DB" }}>{parseInt(u[k])||0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

// ─── CUSTOMERS CRM ──────────────────────────────────────────────
}
function Sellers({ inventory, breaks, userRole }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [selectedSeller, setSelectedSeller] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("spent"); // spent | cards | lots | recent

  const usedIds = new Set(breaks.map(b => b.inventoryId));

  // Build seller profiles from inventory
  const sellerMap = {};
  inventory.forEach(c => {
    const name = c.seller?.trim() || "Unknown";
    if (!sellerMap[name]) {
      sellerMap[name] = {
        name,
        lots:    {},
        cards:   0,
        spent:   0,
        sources: {},
        payments:{},
        lastDate: null,
      };
    }
    const s = sellerMap[name];
    s.cards++;
    s.spent += c.costPerCard || 0;
    const lotKey = `${c.seller||"Unknown"}__${c.date||"Unknown"}`;
    if (!s.lots[lotKey]) s.lots[lotKey] = { key:lotKey, date:c.date||"—", cards:[], lotPaid:c.lotTotalPaid||0, source:c.source||"—", payment:c.payment||"—" };
    s.lots[lotKey].cards.push(c);
    if (c.source) s.sources[c.source] = (s.sources[c.source]||0) + 1;
    if (c.payment) s.payments[c.payment] = (s.payments[c.payment]||0) + 1;
    if (!s.lastDate || new Date(c.dateAdded) > new Date(s.lastDate)) s.lastDate = c.dateAdded;
  });

  const sellers = Object.values(sellerMap).map(s => ({
    ...s,
    lotCount:      Object.keys(s.lots).length,
    lotList:       Object.values(s.lots).sort((a,b) => new Date(b.date)-new Date(a.date)),
    topSource:     Object.entries(s.sources).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—",
    topPayment:    Object.entries(s.payments).sort((a,b)=>b[1]-a[1])[0]?.[0] || "—",
  }));

  const filtered = sellers
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => {
      if (sortBy==="cards")  return b.cards - a.cards;
      if (sortBy==="lots")   return b.lotCount - a.lotCount;
      if (sortBy==="recent") return new Date(b.lastDate||0) - new Date(a.lastDate||0);
      return b.spent - a.spent; // default: spent
    });

  const SOURCE_COLORS = { Discord:"#5865F2", Facebook:"#1877F2", Other:"#6B7280" };

  // ── SELLER DETAIL ──────────────────────────────────────────────
  if (selectedSeller) {
    const s = sellers.find(x => x.name === selectedSeller);
    if (!s) { setSelectedSeller(null); return null; }
    const totalCards = s.cards;
    const totalSpent = s.spent;
    const allCards   = s.lotList.flatMap(l=>l.cards);
    const usedCount  = allCards.filter(c=>usedIds.has(c.id)).length;
    const availCount = totalCards - usedCount;

    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {/* Back + header */}
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>setSelectedSeller(null)} style={{ background:"#F3F4F6", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#6B7280" }}>← Back</button>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:"#111827" }}>{s.name}</div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>
              {s.topSource !== "—" && <span style={{ color:SOURCE_COLORS[s.topSource]||"#6B7280", fontWeight:700 }}>{s.topSource}</span>}
              {s.topSource !== "—" && " · "}
              Last purchase {s.lastDate ? new Date(s.lastDate).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${canSeeFinancials?4:3},1fr)`, gap:12 }}>
          {[
            { l:"Total Lots",    v:s.lotCount,   c:"#1A1A2E" },
            { l:"Total Cards",   v:totalCards,   c:"#111827" },
            { l:"Available",     v:availCount,   c:"#166534" },
            ...(canSeeFinancials ? [{ l:"Total Spent", v:`$${totalSpent.toFixed(2)}`, c:"#6B2D8B" }] : []),
          ].map(({l,v,c}) => (
            <div key={l} style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:24, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
              <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Details row */}
        <div style={S.card}>
          <SectionLabel t="Customer Details" />
          <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:"#9CA3AF" }}>Primary Source: <strong style={{color:"#111827"}}>{s.topSource}</strong></span>
            <span style={{ fontSize:13, color:"#9CA3AF" }}>Preferred Payment: <strong style={{color:"#111827"}}>{s.topPayment}</strong></span>
            <span style={{ fontSize:13, color:"#9CA3AF" }}>Cards Used: <strong style={{color:"#991b1b"}}>{usedCount}</strong></span>
          </div>
        </div>

        {/* Lot history */}
        <div style={S.card}>
          <SectionLabel t={`Purchase History (${s.lotCount} lot${s.lotCount!==1?"s":""})`} />
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {s.lotList.map((lot,i) => {
              const lotUsed  = lot.cards.filter(c=>usedIds.has(c.id)).length;
              const lotAvail = lot.cards.length - lotUsed;
              return (
                <div key={i} style={{ background:"#FAFAFA", border:"1px solid #F0E0E8", borderRadius:10, padding:"14px 18px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:14, color:"#111827" }}>Lot #{s.lotCount - i}</span>
                      <span style={{ color:"#9CA3AF", fontSize:12, marginLeft:10 }}>{lot.date}</span>
                    </div>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <span style={{ fontSize:12, color:"#6B7280" }}>{lot.source}</span>
                      <span style={{ fontSize:12, color:"#6B7280" }}>{lot.payment}</span>
                      {canSeeFinancials && <span style={{ fontWeight:700, color:"#6B2D8B", fontSize:13 }}>${lot.lotPaid.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:"#9CA3AF" }}>Cards: <strong style={{color:"#111827"}}>{lot.cards.length}</strong></span>
                    <span style={{ fontSize:12, color:"#9CA3AF" }}>Available: <strong style={{color:"#166534"}}>{lotAvail}</strong></span>
                    <span style={{ fontSize:12, color:"#9CA3AF" }}>Used: <strong style={{color:"#991b1b"}}>{lotUsed}</strong></span>
                  </div>
                  {lot.cards.length > 0 && (
                    <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
                      {CARD_TYPES.map(ct => {
                        const count = lot.cards.filter(c=>c.cardType===ct).length;
                        if (!count) return null;
                        const cc = CC[ct];
                        return <span key={ct} style={{ background:cc.bg, color:cc.text, border:`1px solid ${cc.border}44`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{ct}: {count}</span>;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── SELLER LIST ────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={S.card}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
          <div style={{ display:"flex", gap:4 }}>
            {[["spent","💰 Top Spend"],["cards","📦 Most Cards"],["lots","🗂 Most Lots"],["recent","🕐 Recent"]].map(([val,label]) => (
              canSeeFinancials || val !== "spent" ? (
                <button key={val} onClick={()=>setSortBy(val)} style={{ background:sortBy===val?"#1A1A2E":"transparent", color:sortBy===val?"#E8317A":"#9CA3AF", border:`1.5px solid ${sortBy===val?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{label}</button>
              ) : null
            ))}
          </div>
          <span style={{ fontSize:12, color:"#9CA3AF" }}>{filtered.length} customers</span>
        </div>
      </div>

      {filtered.length === 0
        ? <div style={{ ...S.card, textAlign:"center", padding:"60px", color:"#D1D5DB" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>👥</div>
            <div>No customers yet — start importing lots from Lot Comp</div>
          </div>
        : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map((s,i) => {
              const rank = i + 1;
              const srcColor = SOURCE_COLORS[s.topSource] || "#6B7280";
              return (
                <div
                  key={s.name}
                  onClick={() => setSelectedSeller(s.name)}
                  style={{ ...S.card, cursor:"pointer", display:"flex", alignItems:"center", gap:16, transition:"box-shadow 0.15s" }}
                  className="inv-row"
                >
                  {/* Rank */}
                  <div style={{ width:32, height:32, borderRadius:"50%", background: rank<=3?"#1A1A2E":"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:rank<=3?"#E8317A":"#9CA3AF", flexShrink:0 }}>
                    {rank}
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:15, color:"#111827", marginBottom:3 }}>{s.name}</div>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      {s.topSource !== "—" && <span style={{ fontSize:11, color:srcColor, fontWeight:700 }}>{s.topSource}</span>}
                      {s.topPayment !== "—" && <span style={{ fontSize:11, color:"#9CA3AF" }}>{s.topPayment}</span>}
                      <span style={{ fontSize:11, color:"#9CA3AF" }}>Last: {s.lastDate ? new Date(s.lastDate).toLocaleDateString() : "—"}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display:"flex", gap:20, alignItems:"center", flexShrink:0 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:900, color:"#111827" }}>{s.lotCount}</div>
                      <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>Lots</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:900, color:"#111827" }}>{s.cards}</div>
                      <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>Cards</div>
                    </div>
                    {canSeeFinancials && (
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:900, color:"#6B2D8B" }}>${s.spent.toFixed(0)}</div>
                        <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>Spent</div>
                      </div>
                    )}
                    <div style={{ color:"#D1D5DB", fontSize:18 }}>›</div>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ─── COMMISSION ──────────────────────────────────────────────────
function Commission({ streams, onSave, onDelete, user, userRole }) {
  const isAdmin    = ["Admin"].includes(userRole?.role);
  const curUser    = user?.displayName?.split(" ")[0] || "";
  const myBreaker  = BREAKERS.find(b => curUser.toLowerCase().includes(b.toLowerCase()));

  const EMPTY = { date:"", breaker:"", breakType:"auction", grossRevenue:"", whatnotFees:"", coupons:"", whatnotPromo:"", magpros:"", packagingMaterial:"", topLoaders:"", chaserCards:"", marketMultiple:"", binOnly:false, notes:"" };
  const [form,      setForm]      = useState(EMPTY);
  const [editing,   setEditing]   = useState(null); // stream id or "new"
  const [viewStream,setViewStream]= useState(null); // stream id for detail view
  const [importing, setImporting] = useState(false);
  const [csvError,  setCsvError]  = useState("");

  // Commission rate from comp plan
  function getCommRate(stream) {
    if (stream.binOnly) return 0.35;
    const mm = parseFloat(stream.marketMultiple) || 0;
    if (mm >= 1.8) return 0.55;
    if (mm >= 1.7) return 0.50;
    if (mm >= 1.6) return 0.45;
    if (mm >= 1.5) return 0.40;
    return 0.35;
  }

  function calcStream(s) {
    const gross    = parseFloat(s.grossRevenue)      || 0;
    const fees     = parseFloat(s.whatnotFees)       || 0;
    const coupons  = parseFloat(s.coupons)           || 0;
    const promo    = parseFloat(s.whatnotPromo)      || 0;
    const magpros  = parseFloat(s.magpros)           || 0;
    const pack     = parseFloat(s.packagingMaterial) || 0;
    const topload  = parseFloat(s.topLoaders)        || 0;
    const chaser   = parseFloat(s.chaserCards)       || 0;
    const totalExp = fees + coupons + promo + magpros + pack + topload + chaser;
    const netRev   = gross - totalExp;
    const bazNet   = netRev * 0.30;
    const bobaNet  = netRev * 0.70;
    const repExp   = totalExp * 0.135;
    const commBase = bazNet - repExp;
    const rate     = getCommRate(s);
    const commAmt  = commBase * rate;
    return { gross, totalExp, netRev, bazNet, bobaNet, repExp, commBase, rate, commAmt };
  }

  // Filter by role
  const visibleStreams = isAdmin ? streams : streams.filter(s => s.breaker === myBreaker);

  // Aggregates
  const totals = visibleStreams.reduce((acc, s) => {
    const c = calcStream(s);
    acc.gross    += c.gross;
    acc.net      += c.netRev;
    acc.baz      += c.bazNet;
    acc.comm     += c.commAmt;
    return acc;
  }, { gross:0, net:0, baz:0, comm:0 });

  function openNew()   { setForm({...EMPTY, date:new Date().toISOString().split("T")[0]}); setEditing("new"); setViewStream(null); }
  function openEdit(s) { setForm({...s}); setEditing(s.id); setViewStream(null); }
  function cancelEdit(){ setEditing(null); setForm(EMPTY); }

  function f(k) { return v => setForm(p=>({...p,[k]:v})); }

  async function handleSave() {
    if (!form.date || !form.breaker) return;
    await onSave({ ...form, id: editing === "new" ? uid() : editing });
    setEditing(null); setForm(EMPTY);
  }

  // CSV import — parse Whatnot export
  function handleCSV(e) {
    const file = e.target.files[0]; if (!file) return;
    setCsvError("");
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const lines = ev.target.result.split("\n").map(l=>l.trim()).filter(Boolean);
        const headers = lines[0].split(",").map(h=>h.replace(/"/g,"").toLowerCase().trim());
        const row = lines[1]?.split(",").map(c=>c.replace(/"/g,"").trim());
        if (!row) { setCsvError("No data rows found in CSV."); return; }
        const get = (key) => { const i=headers.findIndex(h=>h.includes(key)); return i>=0?row[i]:""; };
        const gross   = parseFloat(get("gross")  || get("revenue") || get("total sales") || "0") || 0;
        const fees    = parseFloat(get("fee")    || get("platform fee") || "0") || 0;
        const coupons = parseFloat(get("coupon") || "0") || 0;
        setForm(p=>({ ...p, grossRevenue:gross.toFixed(2), whatnotFees:fees.toFixed(2), coupons:coupons.toFixed(2) }));
        setImporting(false);
      } catch(err) { setCsvError("Could not parse CSV. Try entering values manually."); }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // ── DETAIL VIEW ──────────────────────────────────────────────
  if (viewStream) {
    const s = streams.find(x=>x.id===viewStream);
    if (!s) { setViewStream(null); return null; }
    const c = calcStream(s);
    const bc = BC[s.breaker] || { bg:"#EEF0FB", text:"#2C3E7A", border:"#3730a3" };
    const EXPENSE_ROWS = [
      { l:"Whatnot Fees",        v:parseFloat(s.whatnotFees)||0 },
      { l:"Coupons",             v:parseFloat(s.coupons)||0 },
      { l:"Whatnot Promo",       v:parseFloat(s.whatnotPromo)||0 },
      { l:"MagPros",             v:parseFloat(s.magpros)||0 },
      { l:"Packaging Materials", v:parseFloat(s.packagingMaterial)||0 },
      { l:"Top Loaders",         v:parseFloat(s.topLoaders)||0 },
      { l:"Chaser Cards",        v:parseFloat(s.chaserCards)||0 },
    ];
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>setViewStream(null)} style={{ background:"#F3F4F6", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#6B7280" }}>← Back</button>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:"#111827" }}>{new Date(s.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            <div style={{ fontSize:12, color:"#9CA3AF", marginTop:2, display:"flex", gap:10 }}>
              <Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge>
              <span>{s.binOnly ? "BIN Break (flat 35%)" : `${s.breakType} · ${(c.rate*100).toFixed(0)}% commission`}</span>
            </div>
          </div>

        </div>

        {/* Revenue waterfall */}
        <div style={S.card}>
          <SectionLabel t="Stream Revenue Breakdown" />
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {/* Gross */}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"#1A1A2E", borderRadius:8 }}>
              <span style={{ fontWeight:700, color:"#FFFFFF", fontSize:14 }}>Gross Revenue</span>
              <span style={{ fontWeight:900, color:"#E8317A", fontSize:16 }}>${c.gross.toFixed(2)}</span>
            </div>
            {/* Expense rows */}
            {EXPENSE_ROWS.filter(r=>r.v>0).map(({l,v}) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", background:"#FEF3F2", borderRadius:7, border:"1px solid #FEE2E2" }}>
                <span style={{ color:"#6B7280", fontSize:13 }}>− {l}</span>
                <span style={{ color:"#991b1b", fontWeight:700, fontSize:13 }}>${v.toFixed(2)}</span>
              </div>
            ))}
            {/* Total expenses */}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", background:"#FEE2E2", borderRadius:7 }}>
              <span style={{ fontWeight:700, color:"#991b1b", fontSize:13 }}>Total Expenses</span>
              <span style={{ fontWeight:900, color:"#991b1b", fontSize:13 }}>${c.totalExp.toFixed(2)}</span>
            </div>
            {/* Net Revenue */}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"#F0F9FF", borderRadius:8, border:"2px solid #1B4F8A22" }}>
              <span style={{ fontWeight:800, color:"#1B4F8A", fontSize:14 }}>Net Revenue</span>
              <span style={{ fontWeight:900, color:"#1B4F8A", fontSize:16 }}>${c.netRev.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Split */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={S.card}>
            <SectionLabel t="Bazooka Net (30%)" />
            <div style={{ fontSize:32, fontWeight:900, color:"#E8317A" }}>${c.bazNet.toFixed(2)}</div>
          </div>
          <div style={S.card}>
            <SectionLabel t="BoBA Net (70%)" />
            <div style={{ fontSize:32, fontWeight:900, color:"#6B7280" }}>${c.bobaNet.toFixed(2)}</div>
          </div>
        </div>

        {/* Commission calc */}
        <div style={{ ...S.card, border:"2px solid #166534" }}>
          <SectionLabel t={`${s.breaker}'s Commission`} />
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
            {[
              { l:"Bazooka Net",           v:`$${c.bazNet.toFixed(2)}`,   c:"#E8317A" },
              { l:"Rep Expenses (13.5%)",  v:`− $${c.repExp.toFixed(2)}`, c:"#991b1b" },
              { l:"Commission Base",       v:`$${c.commBase.toFixed(2)}`, c:"#1B4F8A" },
              { l:`Rate (${(c.rate*100).toFixed(0)}%${s.binOnly?" — BIN flat":s.marketMultiple?" — "+s.marketMultiple+"x":""})`, v:`× ${(c.rate*100).toFixed(0)}%`, c:"#6B7280" },
            ].map(({l,v,c:clr}) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 12px", borderBottom:"1px solid #F0E0E8" }}>
                <span style={{ fontSize:13, color:"#6B7280" }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:clr }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"#D6F4E3", borderRadius:10 }}>
            <span style={{ fontWeight:800, fontSize:16, color:"#166534" }}>💵 Commission Earned</span>
            <span style={{ fontWeight:900, fontSize:28, color:"#166534" }}>${c.commAmt.toFixed(2)}</span>
          </div>
          {s.marketMultiple && !s.binOnly && (
            <div style={{ marginTop:10, fontSize:12, color:"#9CA3AF", textAlign:"right" }}>Market multiple: {s.marketMultiple}x → {(c.rate*100).toFixed(0)}% rate</div>
          )}
          {s.notes && <div style={{ marginTop:10, padding:"8px 12px", background:"#F9FAFB", borderRadius:7, fontSize:12, color:"#6B7280", fontStyle:"italic" }}>{s.notes}</div>}
        </div>
      </div>
    );
  }

  // ── FORM ─────────────────────────────────────────────────────
  if (editing) {
    const preview = calcStream(form);
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={cancelEdit} style={{ background:"#F3F4F6", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#6B7280" }}>← Cancel</button>
          <div style={{ fontSize:16, fontWeight:800, color:"#111827" }}>{editing==="new"?"New Stream":"Edit Stream"}</div>
          {importing && (
            <label style={{ background:"#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              📂 Select Whatnot CSV
              <input type="file" accept=".csv" onChange={handleCSV} style={{ display:"none" }}/>
            </label>
          )}
          <Btn onClick={()=>setImporting(p=>!p)} variant="ghost">{importing?"Cancel Import":"📂 Import CSV"}</Btn>
        </div>
        {csvError && <div style={{ padding:"10px 14px", background:"#FEE2E2", borderRadius:8, color:"#991b1b", fontSize:13 }}>{csvError}</div>}

        {/* Stream info */}
        <div style={S.card}>
          <SectionLabel t="Stream Info" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
            <div><label style={S.lbl}>Date</label><input type="date" value={form.date} onChange={e=>f("date")(e.target.value)} style={S.inp}/></div>
            <div>
              <label style={S.lbl}>Breaker</label>
              <select value={form.breaker} onChange={e=>f("breaker")(e.target.value)} style={{ ...S.inp, cursor:"pointer", color:form.breaker?"#111827":"#9CA3AF" }}>
                <option value="">Select...</option>
                {BREAKERS.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Break Type</label>
              <select value={form.breakType} onChange={e=>f("breakType")(e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
                <option value="auction">Auction</option>
                <option value="bin">BIN</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
              <label style={S.lbl}>BIN Break (flat 35%)?</label>
              <div style={{ display:"flex", alignItems:"center", gap:8, paddingTop:6 }}>
                <input type="checkbox" checked={form.binOnly||false} onChange={e=>f("binOnly")(e.target.checked)} style={{ width:18, height:18 }}/>
                <span style={{ fontSize:12, color:"#6B7280" }}>Override to flat 35%</span>
              </div>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginTop:12 }}>
            <div><label style={S.lbl}>Market Multiple (e.g. 1.6)</label><input type="number" step="0.1" value={form.marketMultiple} onChange={e=>f("marketMultiple")(e.target.value)} placeholder="e.g. 1.6" style={S.inp} disabled={form.binOnly}/></div>
            <div><label style={S.lbl}>Notes (optional)</label><input value={form.notes} onChange={e=>f("notes")(e.target.value)} placeholder="e.g. Holiday stream, slow night..." style={S.inp}/></div>
          </div>
        </div>

        {/* Revenue */}
        <div style={S.card}>
          <SectionLabel t="Revenue & Expenses" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
            {[
              ["grossRevenue",      "Gross Revenue ($)",        "#166534"],
              ["whatnotFees",       "Whatnot Fees ($)",         "#991b1b"],
              ["coupons",           "Coupons ($)",              "#991b1b"],
              ["whatnotPromo",      "Whatnot Promo ($)",        "#991b1b"],
              ["magpros",           "MagPros ($)",              "#991b1b"],
              ["packagingMaterial", "Packaging Materials ($)",  "#991b1b"],
              ["topLoaders",        "Top Loaders ($)",          "#991b1b"],
              ["chaserCards",       "Chaser Cards ($)",         "#991b1b"],
            ].map(([key, label, color]) => (
              <div key={key}>
                <label style={{ ...S.lbl, color: key==="grossRevenue"?"#166534":S.lbl.color }}>{label}</label>
                <input type="number" step="0.01" value={form[key]||""} onChange={e=>f(key)(e.target.value)} placeholder="0.00" style={{ ...S.inp, color }}/>
              </div>
            ))}
          </div>
        </div>

        {/* Live preview */}
        {(parseFloat(form.grossRevenue)||0) > 0 && (
          <div style={{ ...S.card, border:"2px solid #166534" }}>
            <SectionLabel t="Live Preview" />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
              {[
                { l:"Net Revenue",   v:`$${preview.netRev.toFixed(2)}`,   c:"#1B4F8A" },
                { l:"Bazooka 30%",   v:`$${preview.bazNet.toFixed(2)}`,   c:"#E8317A" },
                { l:"BoBA 70%",      v:`$${preview.bobaNet.toFixed(2)}`,  c:"#6B7280" },
                { l:"Rep Expenses",  v:`$${preview.repExp.toFixed(2)}`,   c:"#991b1b" },
                { l:`Commission (${(preview.rate*100).toFixed(0)}%)`, v:`$${preview.commAmt.toFixed(2)}`, c:"#166534" },
              ].map(({l,v,c}) => (
                <div key={l} style={{ textAlign:"center", background:"#F9FAFB", borderRadius:8, padding:"10px 8px" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <Btn onClick={handleSave} disabled={!form.date||!form.breaker} variant="green">💾 Save Stream</Btn>
          <Btn onClick={cancelEdit} variant="ghost">Cancel</Btn>
        </div>
      </div>
    );
  }

  // ── LIST VIEW ────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${isAdmin?4:2},1fr)`, gap:12 }}>
        {[
          { l:"Total Streams",     v:visibleStreams.length,           c:"#111827" },
          { l:"Total Commission",  v:`$${totals.comm.toFixed(2)}`,    c:"#166534" },
          ...(isAdmin ? [
            { l:"Total Gross",     v:`$${totals.gross.toFixed(2)}`,   c:"#E8317A" },
            { l:"Bazooka Net",     v:`$${totals.baz.toFixed(2)}`,     c:"#6B2D8B" },
          ] : []),
        ].map(({l,v,c}) => (
          <div key={l} style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:26, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Stream list */}
      {visibleStreams.length === 0
        ? <div style={{ ...S.card, textAlign:"center", padding:"60px" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>💵</div>
            <div style={{ color:"#9CA3AF" }}>No streams logged yet." Stream recaps are entered in the Break Log tab."</div>
          </div>
        : visibleStreams.map(s => {
            const c    = calcStream(s);
            const bc   = BC[s.breaker] || { bg:"#EEF0FB", text:"#2C3E7A", border:"#3730a3" };
            return (
              <div key={s.id} onClick={()=>setViewStream(s.id)} className="inv-row" style={{ ...S.card, cursor:"pointer", display:"grid", gridTemplateColumns:"140px 1fr auto", gap:16, alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:"#111827" }}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                  <Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge>
                </div>
                <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, color:"#9CA3AF" }}>Gross: <strong style={{color:"#111827"}}>${c.gross.toFixed(2)}</strong></span>
                  <span style={{ fontSize:12, color:"#9CA3AF" }}>Net: <strong style={{color:"#1B4F8A"}}>${c.netRev.toFixed(2)}</strong></span>
                  {isAdmin && <span style={{ fontSize:12, color:"#9CA3AF" }}>Bazooka: <strong style={{color:"#E8317A"}}>${c.bazNet.toFixed(2)}</strong></span>}
                  <span style={{ fontSize:12, color:"#9CA3AF" }}>Rate: <strong style={{color:"#6B7280"}}>{(c.rate*100).toFixed(0)}%{s.binOnly?" (BIN)":s.marketMultiple?" ("+s.marketMultiple+"x)":""}</strong></span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:"#166534" }}>${c.commAmt.toFixed(2)}</div>
                    <div style={{ fontSize:9, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:1 }}>Commission</div>
                  </div>
                  <span style={{ color:"#D1D5DB", fontSize:18 }}>›</span>
                </div>
              </div>
            );
          })
      }
    </div>
  );
}

export default function App() {
  const [tab,       setTab]       = useState("dashboard");
  const [gSearch,   setGSearch]   = useState("");
  const [gOpen,     setGOpen]     = useState(false);
  const [user,      setUser]      = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [breaks,    setBreaks]    = useState([]);
  const [comps,     setComps]     = useState([]);
  const [toast,        setToast]        = useState(null);
  const [lotTracking,  setLotTracking]  = useState({});
  const [lotNotes,     setLotNotes]     = useState({});
  const [streams,      setStreams]       = useState([]);
  const [shipments,    setShipments]     = useState([]);
  const [productUsage, setProductUsage] = useState([]);
  const [shipments,    setShipments]     = useState([]); // product shipments in
  const [productUsage, setProductUsage]  = useState([]); // product used per stream

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
    return unsub;
  }, []);

  // Keyboard shortcut: / to open search, Esc to close
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { setGOpen(false); setGSearch(""); }
      if (e.key === "/" && !gOpen && e.target.tagName !== "INPUT" && e.target.tagName !== "TEXTAREA") {
        e.preventDefault(); setGOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [gOpen]);

  useEffect(() => {
    if (!user) return;
    const u1 = onSnapshot(query(collection(db,"inventory"), orderBy("dateAdded","asc")),  snap => setInventory(snap.docs.map(d => ({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,"breaks"),    orderBy("dateAdded","asc")),  snap => setBreaks(snap.docs.map(d => ({id:d.id,...d.data()}))));
    const u3 = onSnapshot(query(collection(db,"comps"),     orderBy("dateAdded","desc")), snap => setComps(snap.docs.map(d => ({id:d.id,...d.data()}))));
    const u4 = onSnapshot(collection(db,"lot_tracking"), snap => { const t={}; snap.docs.forEach(d => { t[d.id]=d.data(); }); setLotTracking(t); });
    const u5 = onSnapshot(collection(db,"lot_notes"),    snap => { const n={}; snap.docs.forEach(d => { n[d.id]=d.data(); }); setLotNotes(n); });
    const u6 = onSnapshot(query(collection(db,"streams"), orderBy("date","desc")), snap => setStreams(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u7 = onSnapshot(query(collection(db,"shipments"), orderBy("date","desc")), snap => setShipments(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u8 = onSnapshot(query(collection(db,"product_usage"), orderBy("date","desc")), snap => setProductUsage(snap.docs.map(d=>({id:d.id,...d.data()}))));

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); };
  }, [user]);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3500); }

  async function handleAccept(cards, seller, u, custNote) {
    // Build key exactly as lot history does: seller__date from card data
    const firstCard  = cards[0];
    const lotKey     = `${firstCard?.seller||"Unknown"}__${firstCard?.date||"Unknown"}`;
    const hasTracking = !!(lotTracking[lotKey]?.trackingNum);
    const cardStatus  = hasTracking && lotTracking[lotKey]?.status !== "Delivered" ? "in_transit" : "available";
    for (const card of cards) {
      await setDoc(doc(db,"inventory",card.id), { ...card, cardStatus, addedBy:u?.displayName||"Unknown" });
    }
    if (custNote && custNote.trim()) {
      await setDoc(doc(db,"lot_notes",lotKey), { notes:custNote.trim(), updatedAt:new Date().toISOString(), updatedBy:u?.displayName||"Unknown" });
    }
    showToast(`✅ ${cards.length} card${cards.length!==1?"s":""} added${cardStatus==="in_transit"?" — In Transit":""}`);
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
  async function handleDeleteComp(id) {
    const comp = comps.find(c => c.id === id);
    if (comp) {
      await setDoc(doc(db,"comp_log",uid()), { ...comp, action:"deleted", actionBy:user?.displayName||"Unknown", actionByEmail:user?.email||"", actionAt:new Date().toISOString() });
    }
    await deleteDoc(doc(db,"comps",id));
    showToast("🗑 Comp deleted");
  }
  async function handleAddBreak(b) {
    await setDoc(doc(db,"breaks",b.id), b);
    showToast(`✅ ${b.cardName} logged out by ${b.breaker}`);
  }
  async function handleBulkAddBreak(entries) {
    for (const b of entries) await setDoc(doc(db,"breaks",b.id), b);
    showToast(`✅ ${entries.length} cards logged out by ${entries[0]?.breaker}`);
  }
  async function handleDeleteBreak(id) {
    await deleteDoc(doc(db,"breaks",id));
    showToast("↩️ Break entry removed — card is available again");
  }
  async function handleSaveLotTracking(lotKey, data) {
    let finalData = { ...data, updatedAt:new Date().toISOString(), updatedBy:user?.displayName||"Unknown" };

    await setDoc(doc(db,"lot_tracking",lotKey), finalData);

    // Auto-flip card status
    const lotCards = inventory.filter(c => `${c.seller||"Unknown"}__${c.date||"Unknown"}` === lotKey);
    if (finalData.status === "Delivered") {
      for (const card of lotCards) await setDoc(doc(db,"inventory",card.id), { ...card, cardStatus:"available" }, { merge:true });
      showToast("✅ Delivered — cards now Available");
    } else if (data.trackingNum) {
      for (const card of lotCards) if (card.cardStatus === "available" && card.cardStatus !== "used") await setDoc(doc(db,"inventory",card.id), { ...card, cardStatus:"in_transit" }, { merge:true });
      const eta = finalData.eta ? ` · ETA ${finalData.eta}` : "";
      showToast(`📦 ${finalData.status||"In Transit"}${eta}`);
    } else {
      showToast("📦 Tracking saved");
    }
  }
  async function handleSaveLotNotes(lotKey, notes) {
    await setDoc(doc(db,"lot_notes",lotKey), { notes, updatedAt:new Date().toISOString(), updatedBy:user?.displayName||"Unknown" });
    showToast("📝 Notes saved");
  }
  async function handleSaveStream(stream) {
    const id = stream.id || uid();
    await setDoc(doc(db,"streams",id), { ...stream, id, updatedAt:new Date().toISOString(), updatedBy:user?.displayName||"Unknown" });
    showToast(stream.id ? "💾 Stream updated" : "✅ Stream saved");
  }
  async function handleDeleteStream(id) {
    await deleteDoc(doc(db,"streams",id));
    showToast("🗑 Stream deleted");
  }
  async function handleSaveShipment(shipment) {
    const id = shipment.id || uid();
    await setDoc(doc(db,"shipments",id), { ...shipment, id, createdAt:new Date().toISOString(), createdBy:user?.displayName||"Unknown" });
    showToast(shipment.id ? "📦 Shipment updated" : "✅ Shipment added");
  }
  async function handleDeleteShipment(id) {
    await deleteDoc(doc(db,"shipments",id));
    showToast("🗑 Shipment deleted");
  }
  async function handleSaveProductUsage(usage) {
    const id = usage.id || uid();
    await setDoc(doc(db,"product_usage",id), { ...usage, id, createdAt:new Date().toISOString(), createdBy:user?.displayName||"Unknown" });
    showToast("📋 Product usage logged");
  }
  async function handleSaveShipment(shipment) {
    const id = shipment.id || uid();
    await setDoc(doc(db,"shipments",id), { ...shipment, id, addedAt:new Date().toISOString(), addedBy:user?.displayName||"Unknown" });
    showToast("📦 Shipment received");
  }
  async function handleDeleteShipment(id) {
    await deleteDoc(doc(db,"shipments",id));
    showToast("🗑 Shipment removed");
  }
  async function handleSaveProductUsage(usage) {
    const id = usage.id || uid();
    await setDoc(doc(db,"product_usage",id), { ...usage, id, loggedAt:new Date().toISOString(), loggedBy:user?.displayName||"Unknown" });
    showToast("✅ Product usage logged");
  }
  async function handleDeleteProductUsage(id) {
    await deleteDoc(doc(db,"product_usage",id));
    showToast("🗑 Usage entry removed");
  }

  async function handleDeleteLot(lotKey, cardIds) {
    if (!window.confirm(`Delete this entire lot (${cardIds.length} card${cardIds.length!==1?"s":""})? This cannot be undone.`)) return;
    for (const id of cardIds) await deleteDoc(doc(db,"inventory",id));
    await deleteDoc(doc(db,"lot_tracking",lotKey)).catch(()=>{});
    await deleteDoc(doc(db,"lot_notes",lotKey)).catch(()=>{});
    showToast(`🗑 Lot deleted — ${cardIds.length} card${cardIds.length!==1?"s":""} removed`);
  }

  const userRole = getUserRole(user);
  const TABS = [
    { id:"dashboard",   label:"📊 Dashboard"   },
    { id:"comp",        label:"🧮 Lot Comp"     },
    { id:"inventory",   label:"📦 Inventory"    },
    { id:"breaks",      label:"🎯 Break Log"    },
    { id:"performance", label:"📈 Performance"  },
    { id:"commission",  label:"💵 Commission"   },
  ];

  if (!authReady) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#FFFFFF", fontFamily:"'Trebuchet MS',sans-serif", fontSize:18, fontWeight:700, color:"#E8317A" }}>Loading...</div>;
  if (!user) return <LoginScreen />;

  return (
    <div style={{ background:"#F3F4F6", minHeight:"100vh", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", color:"#111827" }}>
      <GlobalStyles />

      {/* ── GLOBAL SEARCH OVERLAY ── */}
      {gOpen && (() => {
        const usedIds = new Set(breaks.map(b => b.inventoryId));
        const q = gSearch.toLowerCase().trim();
        const results = q.length < 2 ? [] : inventory.filter(c => {
          return (
            c.cardName?.toLowerCase().includes(q) ||
            c.seller?.toLowerCase().includes(q) ||
            c.cardType?.toLowerCase().includes(q) ||
            c.source?.toLowerCase().includes(q) ||
            (usedIds.has(c.id) ? "used" : c.cardStatus === "in_transit" ? "in transit" : "available").includes(q)
          );
        });
        const getStatus = c => usedIds.has(c.id) ? { l:"Used", bg:"#FEE2E2", c:"#991b1b" } : c.cardStatus==="in_transit" ? { l:"In Transit", bg:"#EEF0FB", c:"#2C3E7A" } : { l:"Available", bg:"#D6F4E3", c:"#166534" };
        return (
          <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", flexDirection:"column" }}>
            {/* Backdrop */}
            <div onClick={()=>{ setGOpen(false); setGSearch(""); }} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(2px)" }}/>
            {/* Panel */}
            <div style={{ position:"relative", zIndex:1000, margin:"60px auto 0", width:"100%", maxWidth:720, background:"#111111", borderRadius:14, boxShadow:"0 20px 60px rgba(0,0,0,0.8)", border:"1px solid #333", overflow:"hidden" }}>
              {/* Search input */}
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:"1px solid #222" }}>
                <span style={{ fontSize:18, color:"#E8317A" }}>🔍</span>
                <input
                  autoFocus
                  value={gSearch}
                  onChange={e=>setGSearch(e.target.value)}
                  placeholder="Search cards, sellers, types, sources..."
                  style={{ flex:1, background:"none", border:"none", outline:"none", color:"#FFFFFF", fontSize:16, fontFamily:"inherit" }}
                />
                {gSearch && <button onClick={()=>setGSearch("")} style={{ background:"none", border:"none", color:"#666", cursor:"pointer", fontSize:18 }}>✕</button>}
                <kbd style={{ background:"#222", color:"#666", border:"1px solid #444", borderRadius:5, padding:"2px 8px", fontSize:11 }}>esc</kbd>
              </div>

              {/* Results */}
              <div style={{ maxHeight:500, overflowY:"auto" }}>
                {q.length < 2
                  ? <div style={{ padding:"40px 20px", textAlign:"center", color:"#444", fontSize:13 }}>Type at least 2 characters to search</div>
                  : results.length === 0
                    ? <div style={{ padding:"40px 20px", textAlign:"center", color:"#444", fontSize:13 }}>No cards found for "{gSearch}"</div>
                    : <>
                        <div style={{ padding:"8px 20px", fontSize:11, color:"#555", borderBottom:"1px solid #1a1a1a" }}>{results.length} result{results.length!==1?"s":""}</div>
                        {results.map((c,i) => {
                          const st = getStatus(c);
                          const cc = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                          return (
                            <div key={c.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, padding:"12px 20px", borderBottom:"1px solid #1a1a1a", background:i%2===0?"#111111":"#161616" }}>
                              <div>
                                <div style={{ fontWeight:700, color:"#FFFFFF", fontSize:14, marginBottom:4 }}>{c.cardName||"—"}</div>
                                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                                  {c.cardType && <span style={{ background:cc.bg, color:cc.text, borderRadius:4, padding:"1px 7px", fontSize:11, fontWeight:700 }}>{c.cardType}</span>}
                                  {c.seller && <span style={{ fontSize:11, color:"#888" }}>from <strong style={{color:"#aaa"}}>{c.seller}</strong></span>}
                                  {c.source && <span style={{ fontSize:11, color:"#666" }}>{c.source}</span>}
                                  {c.date && <span style={{ fontSize:11, color:"#555" }}>{c.date}</span>}
                                </div>
                              </div>
                              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                                <span style={{ background:st.bg, color:st.c, borderRadius:5, padding:"2px 9px", fontSize:11, fontWeight:700 }}>{st.l}</span>
                                {c.marketValue > 0 && <span style={{ fontSize:11, color:"#92400e" }}>${c.marketValue.toFixed(2)}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </>
                }
              </div>
            </div>
          </div>
        );
      })()}

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
            {/* Search button */}
            <button
              onClick={()=>{ setGOpen(true); setGSearch(""); }}
              style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1a2e", border:"1px solid #333", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit", color:"#888" }}
            >
              <span style={{ fontSize:13 }}>🔍</span>
              <span style={{ fontSize:12 }}>Search</span>
              <kbd style={{ background:"#111", color:"#555", border:"1px solid #333", borderRadius:4, padding:"1px 5px", fontSize:10 }}>/</kbd>
            </button>
            <span style={{ color:"#9CA3AF", fontSize:11 }}>{inventory.length} cards</span>
            {user.photoURL && <img src={user.photoURL} alt="" style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #E8317A" }}/>}
            <span style={{ color:"#9CA3AF", fontSize:11 }}>{user.displayName?.split(" ")[0]}</span>
            <span style={{ background:"#1a1a2e", color:"#E8317A", border:"1px solid #E8317A44", borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{userRole.label}</span>
            <button onClick={()=>signOut(auth)} style={{ background:"transparent", border:"1px solid #444444", color:"#999999", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
          </div>
        </div>
      </div>

      <div key={tab} className="tab-content" style={{ maxWidth:1200, margin:"0 auto", padding:"20px" }}>
        {tab==="dashboard"   && <Dashboard   inventory={inventory} breaks={breaks} user={user} userRole={userRole} streams={streams}/>}
        {tab==="comp"        && (CAN_VIEW_LOT_COMP.includes(userRole.role) ? <LotComp onAccept={handleAccept} onSaveComp={handleSaveComp} onDeleteComp={handleDeleteComp} comps={comps} user={user} userRole={userRole}/> : <AccessDenied msg="Lot Comp is for Admin and Procurement only." />)}
        {tab==="inventory"   && <Inventory   inventory={inventory} breaks={breaks} onRemove={handleRemove} onBulkRemove={handleBulkRemove} user={user} userRole={userRole} lotTracking={lotTracking} onSaveLotTracking={handleSaveLotTracking} lotNotes={lotNotes} onSaveLotNotes={handleSaveLotNotes} onDeleteLot={handleDeleteLot} shipments={shipments} productUsage={productUsage} onSaveShipment={handleSaveShipment} onDeleteShipment={handleDeleteShipment}/>}
        {tab==="breaks"      && (CAN_LOG_BREAKS.includes(userRole.role) ? <BreakLog inventory={inventory} breaks={breaks} onAdd={handleAddBreak} onBulkAdd={handleBulkAddBreak} onDeleteBreak={handleDeleteBreak} user={user} userRole={userRole} streams={streams} onSaveStream={handleSaveStream} productUsage={productUsage} onSaveProductUsage={handleSaveProductUsage} shipments={shipments}/> : <AccessDenied msg="Break Log access is restricted." />)}
        {tab==="performance" && <Performance breaks={breaks} user={user} userRole={userRole}/>}
        {tab==="commission"  && <Commission streams={streams} onSave={handleSaveStream} onDelete={handleDeleteStream} user={user} userRole={userRole}/>}
      </div>

      {toast && <div className="toast" style={{ position:"fixed", bottom:20, right:20, background:"#166534", color:"#ffffff", padding:"12px 18px", borderRadius:10, fontWeight:700, fontSize:13, boxShadow:"0 4px 24px rgba(0,0,0,0.2)", zIndex:999 }}>{toast}</div>}
    </div>
  );
}
