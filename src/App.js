import { useState, useEffect } from "react";
import { auth, db, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, getDoc } from "firebase/firestore";

const CARD_TYPES = ["Giveaway/Standard Cards","First-Timer Cards","Chaser Cards"];
const BREAKERS = ["Dev","Dre","Krystal"];
const PRODUCT_TYPES = ["Double Mega","Hobby","Jumbo","Miscellaneous"];
const USAGE_TYPES = ["Giveaway/Standard","First-Timer Pack","Chaser Pull"];
const SOURCES = ["Discord","Facebook","Other"];
const PAYMENT_METHODS = ["Cash","Venmo","PayPal","Zelle","Other"];
const ROLES = {
  "devin":   { role:"Admin",       label:"CEO",                color:"#E8317A", bg:"#FFF0F5" },
  "derrik":  { role:"Admin",       label:"CFO",                color:"#E8317A", bg:"#FFF0F5" },
  "dre":     { role:"Streamer",    label:"Streamer",           color:"#E8317A", bg:"#F3EAF9" },
  "krystal": { role:"Streamer",    label:"Streamer",           color:"#0D6E6E", bg:"#E0F7F4" },
  "john":    { role:"Procurement", label:"Procurement Mgr",    color:"#F0F0F0", bg:"#E8F0FB" },
  "jake":    { role:"Shipping",    label:"Shipping/Logistics", color:"#AAAAAA", bg:"#FFF0CC" },
};
const TARGETS = {
  "Giveaway/Standard Cards": { monthly:4000, buffer:500 },
  "First-Timer Cards":       { monthly:200,  buffer:50  },
  "Chaser Cards":            { monthly:275,  buffer:70  },
};
const CC = {
  "Giveaway/Standard Cards": { bg:"#0a1a0f", text:"#4ade80", border:"#2E7D52" },
  "First-Timer Cards":       { bg:"#1a0810", text:"#F472B6", border:"#9d174d" },
  "Chaser Cards":            { bg:"#2a1520", text:"#E8317A", border:"#E8317A" },
};
const BC = {
  Dev:     { bg:"#0a0a1a", text:"#7B9CFF", border:"#3730a3" },
  Dre:     { bg:"#12081a", text:"#C084FC", border:"#6b21a8" },
  Krystal: { bg:"#08181a", text:"#2DD4BF", border:"#115e59" },
};
const CAN_DELETE        = ["Admin"];
const CAN_LOG_BREAKS    = ["Admin","Streamer","Procurement","Shipping"];
const CAN_VIEW_LOT_COMP = ["Admin","Procurement","Streamer","Shipping","Viewer"];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
const fmt = n => isNaN(n) || n === "" || n === null ? "—" : "$" + parseFloat(n).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });

// ── useCountUp hook — animates numbers from 0 to target ──────────
function useCountUp(target, duration=600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!target || isNaN(target)) { setVal(target); return; }
    const start = Date.now();
    const from = 0;
    const to = parseFloat(target);
    function tick() {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
      setVal(from + (to - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [target]);
  return val;
}

function AnimatedNumber({ value, format="dollar", duration=700 }) {
  const num = useCountUp(parseFloat(value)||0, duration);
  if (format === "dollar") return <>{fmt(num)}</>;
  return <>{Math.round(num).toLocaleString()}</>;
}

function getUserRole(user) {
  if (!user) return { role:"Viewer", label:"Viewer", color:"#AAAAAA", bg:"#F3F4F6" };
  const name = (user.displayName||"").toLowerCase();
  const email = (user.email||"").toLowerCase();
  for (const [key, val] of Object.entries(ROLES)) {
    if (name.includes(key) || email.includes(key)) return val;
  }
  return { role:"Viewer", label:"Viewer", color:"#AAAAAA", bg:"#F3F4F6" };
}
function getZone(pct) {
  if (!pct || isNaN(pct)) return null;
  if (pct < 0.65)  return { label:"🟢 Green",  color:"#E8317A", bg:"#D6F4E3" };
  if (pct <= 0.70) return { label:"🟡 Yellow", color:"#AAAAAA", bg:"#FFF9DB" };
  return                   { label:"🔴 Red",    color:"#E8317A", bg:"#FEE2E2" };
}

const DARK_T = {
  pageBg:"#000000", card:"#111111", cardBorder:"#2a2a2a",
  inp:"#1a1a1a", inpBorder:"#333333", text:"#F0F0F0",
  textSub:"#999999", textMute:"#777777",
  rowA:"#111111", rowB:"#0d0d0d", rowHover:"#1a1a1a",
  border:"#2a2a2a", thBg:"#000000", tdBorder:"rgba(255,255,255,0.04)",
};
const LIGHT_T = {
  pageBg:"#F7F4F8", card:"#FFFFFF", cardBorder:"#EDE0EC",
  inp:"#FDFCFE", inpBorder:"#E8D0DC", text:"#111827",
  textSub:"#6B7280", textMute:"#9CA3AF",
  rowA:"#FFFFFF", rowB:"#FFF8FB", rowHover:"#FFF0F5",
  border:"#E5E7EB", thBg:"#1A1A2E", tdBorder:"#FFF0F5",
};

function makeS(dark) {
  const T = dark ? DARK_T : LIGHT_T;
  return {
    card: { background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:14, padding:"18px 20px", boxShadow: dark?"0 4px 24px rgba(0,0,0,0.5)":"0 2px 16px rgba(232,49,122,0.07)" },
    inp:  { background:T.inp, border:`1px solid ${T.inpBorder}`, borderRadius:8, padding:"8px 12px", color:T.text, fontSize:13, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-box" },
    lbl:  { fontSize:10, fontWeight:700, color:T.textMute, textTransform:"uppercase", letterSpacing:1.5, display:"block", marginBottom:5 },
    th:   { padding:"9px 14px", background:T.thBg, color:"#E8317A", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, textAlign:"left", whiteSpace:"nowrap", borderBottom:"1px solid rgba(232,49,122,0.15)" },
    td:   { padding:"8px 14px", borderBottom:`1px solid ${T.tdBorder}`, fontSize:13, color:T.text },
    T, // expose theme tokens
  };
}

// Default S = dark (components that don't receive darkMode prop use this)
const S = makeS(true);



function SectionLabel({ t }) {
  return (
    <div style={{ fontSize:10, fontWeight:800, color:"#F0F0F0", textTransform:"uppercase", letterSpacing:2.5, marginBottom:14, display:"flex", alignItems:"center", gap:8 }}>
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
    green: { bg:"#E8317A", c:"#ffffff", b:"#c41e5a" },
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
      <select value={value} onChange={e=>onChange(e.target.value)} style={{ ...S.inp, color:value?"#F0F0F0":"#9CA3AF", cursor:"pointer" }}>
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
      <div style={{ fontSize:18, fontWeight:700, color:"#F0F0F0", marginBottom:8 }}>Access Restricted</div>
      <div style={{ fontSize:13, color:"#AAAAAA" }}>{msg}</div>
    </div>
  );
}

function GlobalStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      * { box-sizing: border-box; }
      body { background: #000000 !important; color: #F0F0F0; }
      #root { background: #000000; min-height: 100vh; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input[type="date"], input[type="month"] { color-scheme: dark; }
      input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input::placeholder { color: #555555 !important; }
      select option { background: #111111; color: #F0F0F0; }
      @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      .toast { animation: toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      @keyframes toastIn { from { opacity:0; transform:translateY(24px) scale(0.92); } to { opacity:1; transform:translateY(0) scale(1); } }
      .card-hover { transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.18s ease !important; }
      .card-hover:hover { transform: translateY(-3px) !important; box-shadow: 0 16px 40px rgba(232,49,122,0.2) !important; }
      .btn-lift { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.15s ease, opacity 0.15s ease !important; }
      .btn-lift:hover:not(:disabled) { transform: translateY(-2px) scale(1.02) !important; box-shadow: 0 8px 28px rgba(232,49,122,0.45) !important; }
      .btn-lift:active:not(:disabled) { transform: translateY(0) scale(0.97) !important; }
      .nav-tab { transition: color 0.15s ease, background 0.15s ease, transform 0.15s ease !important; }
      .nav-tab:hover { color: #E8317A !important; background: rgba(232,49,122,0.1) !important; transform: translateY(-1px) !important; }
      .inv-row { transition: background 0.12s ease !important; }
      .inv-row:hover { background: #1a1a1a !important; }
      .break-row { transition: background 0.12s ease !important; }
      .break-row:hover { background: #1a1a1a !important; }
      .clickable-row { transition: background 0.12s ease, box-shadow 0.12s ease !important; cursor: pointer !important; }
      .clickable-row:hover { background: #1a1a1a !important; box-shadow: inset 3px 0 0 #E8317A !important; }
      .stat-card { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.2s ease !important; }
      .stat-card:hover { transform: translateY(-4px) scale(1.02) !important; box-shadow: 0 20px 48px rgba(232,49,122,0.25) !important; }
      .num-pop { animation: numPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      @keyframes numPop { from { transform: scale(0.7); opacity:0; } to { transform: scale(1); opacity:1; } }
      .fade-in { animation: fadeIn 0.3s ease forwards; }
      @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
      .slide-in { animation: slideIn 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
      @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
      .zone-red { animation: pulsRed 2.5s ease-in-out infinite; }
      @keyframes pulsRed { 0%,100% { box-shadow:0 0 0 0 rgba(153,27,27,0.6); } 50% { box-shadow:0 0 0 8px rgba(153,27,27,0); } }
      .zone-yellow { animation: pulsYellow 2.5s ease-in-out infinite; }
      @keyframes pulsYellow { 0%,100% { box-shadow:0 0 0 0 rgba(146,64,14,0.5); } 50% { box-shadow:0 0 0 6px rgba(146,64,14,0); } }
      .status-critical { animation: pulsCritical 2s ease-in-out infinite; }
      @keyframes pulsCritical { 0%,100% { box-shadow:0 0 0 0 rgba(220,38,38,0.8); } 50% { box-shadow:0 0 0 10px rgba(220,38,38,0.05),0 0 20px 4px rgba(220,38,38,0.15); } }
      .nav-bazooka { text-shadow:0 0 20px rgba(232,49,122,0.7),0 0 40px rgba(232,49,122,0.4); transition:text-shadow 0.3s ease; }
      .nav-bazooka:hover { text-shadow:0 0 30px rgba(232,49,122,1),0 0 60px rgba(232,49,122,0.6),0 0 100px rgba(232,49,122,0.3); }
      input[type="checkbox"] { cursor:pointer; accent-color:#E8317A; }
      input:focus, select:focus, textarea:focus { outline:none !important; border-color:#E8317A !important; box-shadow:0 0 0 3px rgba(232,49,122,0.2) !important; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input[type="date"], input[type="month"] { color-scheme: dark; }
      input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input::placeholder { color: #555555 !important; }
      select option { background: #111111; color: #F0F0F0; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input[type="date"], input[type="month"] { color-scheme: dark; }
      input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input::placeholder { color: #444444 !important; }
      input, select, textarea { color: #FFFFFF !important; background-color: #000000; }
      input, select, textarea { transition: border-color 0.15s ease !important; }
      
      
      ::-webkit-scrollbar { width:5px; height:5px; }
      ::-webkit-scrollbar-track { background: #000000; }
      ::-webkit-scrollbar-thumb { background: #333333; border-radius:10px; }
      ::-webkit-scrollbar-thumb:hover { background: #E8317A; }
      .drill-down { animation: expandDown 0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
      @keyframes expandDown { from { opacity:0; transform:scaleY(0.95) translateY(-8px); transform-origin:top; } to { opacity:1; transform:scaleY(1) translateY(0); } }
      .save-flash { animation: saveFlash 0.6s ease forwards; }
      @keyframes saveFlash { 0% { box-shadow:0 0 0 0 rgba(22,101,52,0.8); } 50% { box-shadow:0 0 0 14px rgba(22,101,52,0.05); } 100% { box-shadow:none; } }
      ::selection { background: rgba(232,49,122,0.3); color:#fff; }
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
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#000000", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif" }}>
      <div style={{ background:"#111111", borderRadius:16, padding:"48px 40px", boxShadow:"0 4px 40px rgba(232,49,122,0.15)", textAlign:"center", maxWidth:380, width:"100%" }}>
        <div style={{ fontSize:40, fontWeight:900, color:"#E8317A", letterSpacing:4, marginBottom:4 }}>BAZOOKA</div>
        <div style={{ fontSize:11, color:"#E8317A", marginBottom:32, fontWeight:700, textTransform:"uppercase", letterSpacing:3 }}>Dashboard</div>
        <button onClick={handleLogin} style={{ display:"flex", alignItems:"center", gap:12, background:"#1a1a1a", border:"2px solid #333333", borderRadius:10, padding:"12px 24px", cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:14, color:"#F0F0F0", width:"100%", justifyContent:"center" }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
          </svg>
          Sign in with Google
        </button>
        {error && <div style={{ marginTop:16, color:"#E8317A", fontSize:12 }}>{error}</div>}
        <div style={{ marginTop:20, fontSize:11, color:"#D1D5DB" }}>Access restricted to Bazooka team members</div>
      </div>
    </div>
  );
}

function Dashboard({ inventory, breaks, user, userRole, streams=[], historicalData=[], onSaveHistorical, onDeleteHistorical, payStubs=[], onDismissPayStub, quotes=[], onDismissQuoteNotif }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const curUser    = user?.displayName?.split(" ")[0] || "";
  const myBreaker  = BREAKERS.find(b => curUser.toLowerCase().includes(b.toLowerCase()));

  // Pay stub notifications for this breaker
  const myStubs = payStubs.filter(s => s.breaker === myBreaker && !s.read);
  // Quote notifications for admins
  const quoteNotifs = canSeeFinancials ? quotes.filter(q => !q.notified && ["accepted","declined","countered"].includes(q.status)) : [];
  const [viewStub,  setViewStub]  = useState(null);
  const [viewQuote, setViewQuote] = useState(null);
  const [financialPeriod, setFinancialPeriod] = useState("month");
  const [customStart,     setCustomStart]     = useState("");
  const [customEnd,       setCustomEnd]       = useState("");
  const [drillDown,       setDrillDown]       = useState(null);
  const [showHist,    setShowHist]    = useState(false);
  const [histForm,    setHistForm]    = useState({ yearMonth:"", grossRevenue:"", netRevenue:"", imcReimb:"", newBuyers:"", notes:"" });
  const [editingId,   setEditingId]   = useState(null);
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

  function calcStreamDash(s) {
    const gross=parseFloat(s.grossRevenue)||0, fees=parseFloat(s.whatnotFees)||0, coupons=parseFloat(s.coupons)||0, promo=parseFloat(s.whatnotPromo)||0, magpros=parseFloat(s.magpros)||0, pack=parseFloat(s.packagingMaterial)||0, topload=parseFloat(s.topLoaders)||0, chaser=parseFloat(s.chaserCards)||0;
    const totalExp=fees+coupons+promo+magpros+pack+topload+chaser, netRev=gross-totalExp, bazNet=netRev*0.30;
    const streamExp=coupons+promo+magpros+pack+topload+chaser, repExp=streamExp*0.135, imcExpReimb=streamExp*0.70;
    const mm=parseFloat(s.marketMultiple)||0, overrideRate=s.commissionOverride!==""&&s.commissionOverride!=null?parseFloat(s.commissionOverride)/100:null;
    const rate=overrideRate!==null?overrideRate:s.binOnly?0.35:mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
    const commAmt=(bazNet-repExp)*rate;
    return { gross, netRev, bazNet, repExp, imcExpReimb, commAmt, bazTrueNet:bazNet-repExp-commAmt+imcExpReimb, rate };
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* ── QUOTE NOTIFICATIONS (Admin) ── */}
      {quoteNotifs.map(q => {
        const cfg = {
          accepted: { icon:"🎉", color:"#4ade80", bg:"#0a1a0a", border:"#4ade8033", title:"Offer Accepted!", body:`${q.seller?.name||"Seller"} accepted your offer of $${parseFloat(q.dispOffer||0).toFixed(2)}` },
          declined: { icon:"❌", color:"#E8317A", bg:"#1a0a0a", border:"#E8317A33", title:"Offer Declined", body:`${q.seller?.name||"Seller"} declined your offer of $${parseFloat(q.dispOffer||0).toFixed(2)}` },
          countered:{ icon:"🤝", color:"#FBBF24", bg:"#1a1400", border:"#FBBF2433", title:"Counter Offer!", body:`${q.seller?.name||"Seller"} countered at $${parseFloat(q.sellerCounter||0).toFixed(2)} (you offered $${parseFloat(q.currentOffer||q.dispOffer||0).toFixed(2)})` },
        }[q.status];
        if (!cfg) return null;
        return (
          <div key={q.id} style={{ background:cfg.bg, border:`2px solid ${cfg.border}`, borderRadius:14, padding:"18px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ fontSize:28 }}>{cfg.icon}</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:cfg.color, marginBottom:4 }}>{cfg.title}</div>
                  <div style={{ fontSize:12, color:"#888" }}>{cfg.body}</div>
                  {q.status==="accepted" && q.sellerPayment && (
                    <div style={{ fontSize:12, color:"#4ade80", marginTop:4 }}>💳 Wants payment via <strong>{q.sellerPayment}</strong>{q.sellerHandle ? ` — ${q.sellerHandle}` : ""}</div>
                  )}
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <a href={`/quote/${q.id}`} target="_blank" rel="noreferrer" style={{ background:"#1a1a1a", color:cfg.color, border:`1px solid ${cfg.border}`, borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, textDecoration:"none" }}>View Quote ↗</a>
                <button onClick={()=>{ if(onDismissQuoteNotif) onDismissQuoteNotif(q.id); }} style={{ background:"transparent", border:"1px solid #333", color:"#666", borderRadius:8, padding:"7px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>✓ Dismiss</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── PAY STUB NOTIFICATIONS ── */}
      {myStubs.length > 0 && myStubs.map(stub => (
        <div key={stub.id} style={{ background:"linear-gradient(135deg,#0a1a0a,#111)", border:"2px solid #4ade80", borderRadius:14, padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:32 }}>💵</div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:"#4ade80", marginBottom:4 }}>New Pay Stub from Bazooka!</div>
              <div style={{ fontSize:12, color:"#888" }}>
                Period: <strong style={{color:"#F0F0F0"}}>{stub.period}</strong>
                &nbsp;·&nbsp; {stub.streamCount} stream{stub.streamCount!==1?"s":""}
                &nbsp;·&nbsp; Generated {new Date(stub.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:16, flexShrink:0 }}>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#4ade80" }}>{fmt(stub.totalComm)}</div>
              <div style={{ fontSize:10, color:"#666", textTransform:"uppercase", letterSpacing:1 }}>Commission Earned</div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>setViewStub(viewStub===stub.id?null:stub.id)} style={{ background:"#4ade80", color:"#000", border:"none", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {viewStub===stub.id ? "▲ Hide" : "👁 View Details"}
              </button>
              <button onClick={()=>{ if(onDismissPayStub) onDismissPayStub(stub.id); }} style={{ background:"transparent", border:"1px solid #555", color:"#888", borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>✓ Dismiss</button>
            </div>
          </div>
          {viewStub===stub.id && (
            <div style={{ width:"100%", borderTop:"1px solid #2a2a2a", paddingTop:14, marginTop:4 }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead><tr>
                  {["Date","Type","Gross","Net","Rate","Commission"].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {(stub.streams||[]).map((s,i)=>(
                    <tr key={i} style={{ background:i%2===0?"#111111":"#0d0d0d" }}>
                      <td style={S.td}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                      <td style={{ ...S.td, color:"#888" }}>{s.breakType}{s.binOnly?" BIN":""}</td>
                      <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(s.gross)}</td>
                      <td style={{ ...S.td, color:"#888" }}>{fmt(s.netRev)}</td>
                      <td style={{ ...S.td, color:"#888" }}>{(s.rate*100).toFixed(0)}%</td>
                      <td style={{ ...S.td, color:"#4ade80", fontWeight:900 }}>{fmt(s.commAmt)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"#0a1a0a", borderTop:"2px solid #4ade8033" }}>
                    <td colSpan={5} style={{ ...S.td, fontWeight:800, color:"#F0F0F0" }}>Total ({stub.streamCount} streams)</td>
                    <td style={{ ...S.td, color:"#4ade80", fontWeight:900, fontSize:15 }}>{fmt(stub.totalComm)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ))}

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
            const start = new Date(now);
            const day = now.getDay(); // 0=Sun,1=Mon,...6=Sat
            const daysFromMonday = day === 0 ? 6 : day - 1; // Mon=0 offset
            start.setDate(now.getDate() - daysFromMonday);
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
          const streamExp = coupons+promo+magpros+pack+topload+chaser;
          const repExp   = streamExp * 0.135;
          const imcExpReimb = streamExp * 0.70;
          const commBase = bazNet - repExp;
          const mm = parseFloat(s.marketMultiple)||0;
          const overrideRate = s.commissionOverride !== "" && s.commissionOverride != null ? parseFloat(s.commissionOverride)/100 : null;
          const rate = overrideRate !== null ? overrideRate : s.binOnly ? 0.35 : mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
          const commAmt  = commBase * rate;
          return { gross, totalExp, netRev, bazNet, imcNet, repExp, imcExpReimb, commBase, rate, commAmt, bazTrueNet: bazNet - repExp - commAmt + imcExpReimb };
        }

        const filtered = streams.filter(s => inPeriod(s.date));
        const streamTotals = filtered.reduce((acc,s) => {
          const c = calcStream(s);
          acc.gross    += c.gross;
          acc.imc      += c.imcNet;
          acc.comm     += c.commAmt;
          acc.baz      += c.bazNet;
          acc.trueNet  += c.bazTrueNet||0;
          return acc;
        }, { gross:0, imc:0, comm:0, baz:0, trueNet:0 });

        // Merge historical monthly summaries into totals
        const histFiltered = historicalData.filter(h => {
          if (!h.yearMonth) return false;
          const [y,m] = h.yearMonth.split("-").map(Number);
          const d = new Date(y, m-1, 15);
          return inPeriod(d.toISOString().split("T")[0]);
        });
        const histTotals = histFiltered.reduce((acc,h) => {
          const gross   = parseFloat(h.grossRevenue)||0;
          const net     = parseFloat(h.netRevenue)||0;
          const reimb   = parseFloat(h.imcReimb)||0;
          acc.gross    += gross;
          acc.imc      += net * 0.70;
          acc.baz      += net * 0.30;
          acc.trueNet  += net * 0.30 + reimb; // reimbursement adds to true net only
          return acc;
        }, { gross:0, imc:0, comm:0, baz:0, trueNet:0 });

        const totals = {
          gross:   streamTotals.gross   + histTotals.gross,
          imc:     streamTotals.imc     + histTotals.imc,
          comm:    streamTotals.comm    + histTotals.comm,
          baz:     streamTotals.baz     + histTotals.baz,
          trueNet: streamTotals.trueNet + histTotals.trueNet,
        };

        const PERIOD_LABELS = { week:"This Week", month:"This Month", quarter:"This Quarter", year:"This Year", all:"All Time", custom:"Custom Range" };

        // Drill-down modal content
        const renderDrillDown = () => {
          if (!drillDown) return null;
          const config = {
            gross:      { label:"Gross Revenue",       color:"#E8317A", val: s => calcStream(s).gross },
            imc:        { label:"Owed to Imagination Mining (70%)", color:"#E8317A", val: s => calcStream(s).imcNet },
            commission: { label:"Commission Owed",     color:"#E8317A", val: s => calcStream(s).commAmt },
            bazooka:    { label:"Bazooka Earnings (30%)", color:"#E8317A", val: s => calcStream(s).bazNet },
            trueNet:    { label:"Bazooka True Net",      color:"#E8317A", val: s => calcStream(s).bazTrueNet||0 },
          }[drillDown];
          return (
            <div style={{ ...S.card, border:`2px solid ${config.color}33`, marginTop:0 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <SectionLabel t={config.label} />
                <button onClick={()=>setDrillDown(null)} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:18 }}>✕</button>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    {["Date","Breaker","Gross","Net","Rate",
                      ...(drillDown==="trueNet" ? ["Baz Earnings","− Commission","+ IMC Reimb","True Net"] : [
                        drillDown==="commission"?"Commission":drillDown==="imc"?"IMC (70%)":drillDown==="bazooka"?"Bazooka Earnings":"Gross"
                      ])
                    ].map(h=><th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filtered.length===0
                      ? <EmptyRow msg={streams.length===0 ? "No streams logged yet — add a stream recap in Break Log." : "No streams in this period."} cols={drillDown==="trueNet"?9:6}/>
                      : filtered.map((s,i) => {
                          const c   = calcStream(s);
                          const bc  = BC[s.breaker]||{bg:"#F3F4F6",text:"#6B7280"};
                          const val = config.val(s);
                          return (
                            <tr key={s.id} style={{ background:"#111111" }}>
                              <td style={S.td}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                              <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge></td>
                              <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(c.gross)}</td>
                              <td style={{ ...S.td, color:"#F0F0F0", fontWeight:700 }}>{fmt(c.netRev)}</td>
                              <td style={{ ...S.td, color:"#AAAAAA" }}>{(c.rate*100).toFixed(0)}%{s.binOnly?" BIN":""}</td>
                              {drillDown==="trueNet" ? <>
                                <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(c.bazNet)}</td>
                                <td style={{ ...S.td, color:"#E8317A" }}>− {fmt(c.commAmt)}</td>
                                <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>+ {fmt(c.imcExpReimb||0)}</td>
                                <td style={{ ...S.td, color:"#E8317A", fontWeight:900 }}>{fmt(c.bazTrueNet)}</td>
                              </> : <td style={{ ...S.td, color:config.color, fontWeight:900 }}>{fmt(val)}</td>}
                            </tr>
                          );
                        })
                    }
                  </tbody>
                  <tfoot>
                    <tr style={{ background:"#111111", borderTop:"2px solid #333333" }}>
                      <td colSpan={5} style={{ ...S.td, fontWeight:800, color:"#F0F0F0" }}>Total ({filtered.length} stream{filtered.length!==1?"s":""})</td>
                      {drillDown==="trueNet" ? <>
                        <td style={{ ...S.td, fontWeight:900, color:"#E8317A", fontSize:14 }}>{fmt(filtered.reduce((a,s)=>a+calcStream(s).bazNet,0))}</td>
                        <td style={{ ...S.td, fontWeight:900, color:"#E8317A", fontSize:14 }}>− {fmt(filtered.reduce((a,s)=>a+calcStream(s).commAmt,0))}</td>
                        <td style={{ ...S.td, fontWeight:900, color:"#E8317A", fontSize:14 }}>+ {fmt(filtered.reduce((a,s)=>a+(calcStream(s).imcExpReimb||0),0))}</td>
                        <td style={{ ...S.td, fontWeight:900, color:"#E8317A", fontSize:15 }}>{fmt(filtered.reduce((a,s)=>a+(calcStream(s).bazTrueNet||0),0))}</td>
                      </> : <td style={{ ...S.td, fontWeight:900, color:config.color, fontSize:15 }}>{fmt(filtered.reduce((a,s)=>a+config.val(s),0))}</td>}
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        };

        return (
          <>
          <div style={{ ...S.card, border:"2px solid #333333" }}>
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
                <div style={{ fontSize:12, color:"#AAAAAA", marginTop:14 }}>{filtered.length} stream{filtered.length!==1?"s":""} in range</div>
              </div>
            )}

            <div style={{ fontSize:11, color:"#AAAAAA", marginBottom:12, fontWeight:600 }}>{PERIOD_LABELS[financialPeriod]} · {filtered.length} stream{filtered.length!==1?"s":""}</div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12 }}>
              {[
                { key:"gross",      label:"Gross Revenue",       val:totals.gross,     color:"#E8317A", sub:"click for stream breakdown" },
                { key:"imc",        label:"Owed to IMC",          val:totals.imc,       color:"#E8317A", sub:"70% of net revenue" },
                { key:"bazooka",    label:"Bazooka Earnings",     val:totals.baz,       color:"#E8317A", sub:"before commission" },
                { key:"commission", label:"Commission Owed",      val:totals.comm,      color:"#E8317A", sub:"click to see per rep" },
                { key:"trueNet",    label:"Bazooka True Net",     val:totals.trueNet,   color:"#E8317A", sub:"after commission paid" },
              ].map(({key,label,val,color,sub}) => (
                <div
                  key={key}
                  onClick={()=>setDrillDown(drillDown===key?null:key)}
                  className="stat-card"
                  style={{ background:drillDown===key?"#1A1A2E":"#1a1a1a", border:`2px solid ${drillDown===key?color:color+"22"}`, borderRadius:12, padding:"16px", textAlign:"center", cursor:"pointer" }}
                >
                  <div style={{ fontSize:26, fontWeight:900, color:drillDown===key?"#FFFFFF":color, marginBottom:4 }}>{fmt(val)}</div>
                  <div style={{ fontSize:12, fontWeight:700, color:drillDown===key?"#E8317A":"#F0F0F0", marginBottom:3 }}>{label}</div>
                  <div style={{ fontSize:10, color:drillDown===key?"#888":"#9CA3AF" }}>{drillDown===key?"▲ hide":"▼ "+sub}</div>
                </div>
              ))}
            </div>
          </div>

          {drillDown && <div className="drill-down">{renderDrillDown()}</div>}
          </>
        );
      })()}

      {/* Year-End Projections */}
      {canSeeFinancials && (() => {
        const now = new Date();
        const dayOfYear  = Math.floor((now - new Date(now.getFullYear(),0,0)) / 86400000);
        const daysInYear = 365;
        const ytdStreams  = streams.filter(s => new Date(s.date).getFullYear()===now.getFullYear());
        const ytdHist    = historicalData.filter(h => h.yearMonth?.startsWith(String(now.getFullYear())));
        const ytdGross   = ytdStreams.reduce((sum,s) => sum+(parseFloat(s.grossRevenue)||0), 0)
                         + ytdHist.reduce((sum,h) => sum+(parseFloat(h.grossRevenue)||0), 0);
        const ytdNet     = ytdStreams.reduce((sum,s) => sum+(parseFloat(calcStreamDash(s).netRev)||0), 0)
                         + ytdHist.reduce((sum,h) => sum+(parseFloat(h.netRevenue)||0), 0);
        const ytdBaz     = ytdStreams.reduce((sum,s) => sum+calcStreamDash(s).bazTrueNet, 0)
                         + ytdHist.reduce((sum,h) => sum+(parseFloat(h.netRevenue)||0)*0.30, 0);
        const ytdTrueNet  = ytdStreams.reduce((sum,s) => sum+calcStreamDash(s).bazTrueNet, 0)
                         + ytdHist.reduce((sum,h) => sum+(parseFloat(h.netRevenue)||0)*0.30+(parseFloat(h.imcReimb)||0), 0);
        const ytdNewBuyers = ytdStreams.reduce((sum,s) => sum+(parseInt(s.newBuyers)||0), 0)
                         + ytdHist.reduce((sum,h) => sum+(parseInt(h.newBuyers)||0), 0);
        if (ytdStreams.length === 0 && ytdHist.length === 0) return null;
        const pct        = Math.round(dayOfYear / daysInYear * 100);
        const proj = v => dayOfYear > 0 ? v / dayOfYear * daysInYear : 0;
        return (
          <div style={{ background:"#111111", border:"1px solid #E8317A", borderRadius:14, padding:"18px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:800, color:"#E8317A", textTransform:"uppercase", letterSpacing:2.5, display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ width:14, height:2, background:"#E8317A", borderRadius:1, boxShadow:"0 0 8px rgba(232,49,122,0.6)" }}/>
                📈 Year-End Projections
              </div>
              <span style={{ fontSize:11, color:"#AAAAAA" }}>
                {ytdStreams.length} stream{ytdStreams.length!==1?"s":""}
                {ytdHist.length>0 ? ` + ${ytdHist.length} historical month${ytdHist.length!==1?"s":""}` : ""} · {pct}% through {now.getFullYear()}
              </span>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:14 }}>
              {[
                { l:"Gross Revenue",       v:proj(ytdGross),    ytd:ytdGross,    c:"#E8317A" },
                { l:"Net Revenue",         v:proj(ytdNet),      ytd:ytdNet,      c:"#1B4F8A" },
                { l:"Bazooka Earnings",    v:proj(ytdBaz),      ytd:ytdBaz,      c:"#E8317A" },
                { l:"Bazooka True Net",    v:proj(ytdTrueNet),  ytd:ytdTrueNet,  c:"#166534" },
                { l:"New Buyers",          v:proj(ytdNewBuyers),ytd:ytdNewBuyers,c:"#166534", count:true },
              ].map(({l,v,ytd,c,count}) => (
                <div key={l} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:900, color:c }}>{count ? Math.round(v).toLocaleString() : fmt(v)}</div>
                  <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{l}</div>
                  <div style={{ fontSize:10, color:"#AAAAAA", marginTop:3 }}>{count ? Math.round(ytd).toLocaleString() : fmt(ytd)} YTD</div>
                </div>
              ))}
            </div>
            <div style={{ height:6, background:"#333", borderRadius:10, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#E8317A,#6B2D8B)", borderRadius:10 }}/>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
              <span style={{ fontSize:10, color:"#999999" }}>Jan 1</span>
              <span style={{ fontSize:10, color:"#E8317A", fontWeight:700 }}>Today ({pct}%)</span>
              <span style={{ fontSize:10, color:"#999999" }}>Dec 31</span>
            </div>
          </div>
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
            { l:"Total Cards",    v:inventory.length, c:"#F0F0F0" },
            { l:"Available",      v:availCount,       c:"#166534" },
            { l:"In Transit",     v:transitCount,     c:"#7B9CFF" },
            { l:"Used",           v:usedCount,        c:"#991b1b" },
            ...(canSeeFinancials ? [{ l:"Portfolio Zone", v:oz?oz.label:"No data", c:oz?.color||"#9CA3AF" }] : []),
          ].map(({l,v,c}) => (
            <div key={l} style={{ background:"#111111", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
              <div style={{ fontSize:22, fontWeight:900, color:c, marginBottom:2 }}>{v}</div>
              <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>
        {alerts.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#E8317A", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>🚨 Restock Needed</div>
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
              <div key={ct} style={{ background:"#111111", border:"1px solid #2a2a2a", borderRadius:9, padding:"10px 14px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontWeight:700, color:cc.text, fontSize:13 }}>{ct}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <span style={{ fontSize:11, color:"#AAAAAA" }}>{avail} avail</span>
                    {transit > 0 && <span style={{ fontSize:11, color:"#F0F0F0", fontWeight:700, background:"#111111", padding:"2px 8px", borderRadius:5 }}>🚚 {transit} in transit</span>}
                    <span style={{ background:runBg, color:runC, fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:5 }}>
                      {days >= 999 ? "No usage yet" : `~${days}d runway`}
                    </span>
                    <span style={{ fontSize:11, color:"#AAAAAA" }}>Pace: {(pace*100).toFixed(0)}%</span>
                  </div>
                </div>
                <div style={{ height:5, background:"#111111", borderRadius:3, overflow:"hidden" }}>
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
            <div key={l} style={{ background:"#111111", border:"1px solid #2a2a2a", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:18, fontWeight:900, color:c, marginBottom:2 }}>{v}</div>
              <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
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
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #333333" }}>
                    <span style={{ fontSize:11, color:"#AAAAAA" }}>{l}</span>
                    <span style={{ fontSize:11, fontWeight:700, color:bc.text }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Historical Data — Admin only */}
      {canSeeFinancials && (() => {

        function startEdit(h) {
          setHistForm({ yearMonth:h.yearMonth, grossRevenue:h.grossRevenue||"", netRevenue:h.netRevenue||"", imcReimb:h.imcReimb||"", newBuyers:h.newBuyers||"", notes:h.notes||"" });
          setEditingId(h.id);
          setShowHist(true);
        }
        function cancelEdit() {
          setHistForm({ yearMonth:"", grossRevenue:"", netRevenue:"", imcReimb:"", newBuyers:"", notes:"" });
          setEditingId(null);
        }

        async function saveHist() {
          if (!histForm.yearMonth || !histForm.grossRevenue) return;
          await onSaveHistorical({ ...histForm, id: histForm.yearMonth });
          setHistForm({ yearMonth:"", grossRevenue:"", netRevenue:"", imcReimb:"", newBuyers:"", notes:"" });
          setEditingId(null);
        }

        return (
          <div style={{ ...S.card, border:"2px solid #333333" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showHist ? 14 : 0 }}>
              <SectionLabel t="📅 Historical Monthly Data" />
              <button onClick={()=>{ setShowHist(p=>!p); cancelEdit(); }} style={{ background:"transparent", border:"1.5px solid #6B2D8B", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {showHist ? "▲ Hide" : "▼ Manage"}
              </button>
            </div>
            {showHist && (
              <>
                <div style={{ fontSize:12, color:"#AAAAAA", marginBottom:14 }}>{editingId ? `Editing ${editingId} — update fields and save.` : "Enter monthly summary data for historical periods. These feed into YTD totals and projections on the dashboard."}</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 2fr auto", gap:10, marginBottom:14, alignItems:"end" }}>
                  <div>
                    <label style={S.lbl}>Month (YYYY-MM)</label>
                    <input type="month" value={histForm.yearMonth} onChange={e=>setHistForm(p=>({...p,yearMonth:e.target.value}))} style={{ ...S.inp, opacity: editingId ? 0.5 : 1 }} disabled={!!editingId}/>
                  </div>
                  <div>
                    <label style={S.lbl}>Gross Revenue ($)</label>
                    <input type="number" step="0.01" value={histForm.grossRevenue} onChange={e=>setHistForm(p=>({...p,grossRevenue:e.target.value}))} placeholder="0.00" style={S.inp}/>
                  </div>
                  <div>
                    <label style={S.lbl}>Net Revenue ($)</label>
                    <input type="number" step="0.01" value={histForm.netRevenue} onChange={e=>setHistForm(p=>({...p,netRevenue:e.target.value}))} placeholder="0.00" style={S.inp}/>
                  </div>
                  <div>
                    <label style={S.lbl}>IMC Reimb ($)</label>
                    <input type="number" step="0.01" value={histForm.imcReimb} onChange={e=>setHistForm(p=>({...p,imcReimb:e.target.value}))} placeholder="0.00" style={S.inp}/>
                  </div>
                  <div>
                    <label style={S.lbl}>New Buyers</label>
                    <input type="number" min="0" value={histForm.newBuyers} onChange={e=>setHistForm(p=>({...p,newBuyers:e.target.value}))} placeholder="0" style={S.inp}/>
                  </div>
                  <div>
                    <label style={S.lbl}>Notes</label>
                    <input value={histForm.notes} onChange={e=>setHistForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. Jan streams" style={S.inp}/>
                  </div>
                  <div style={{ display:"flex", gap:6 }}>
                    <Btn onClick={saveHist} disabled={!histForm.yearMonth||!histForm.grossRevenue} variant="green">{editingId ? "💾 Save" : "+ Add"}</Btn>
                    {editingId && <Btn onClick={cancelEdit} variant="ghost">✕</Btn>}
                  </div>
                </div>
                {historicalData.length > 0 && (
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr>{["Month","Gross","Net","Bazooka (30%)","IMC Reimb","True Net","🌱 New Buyers","Notes",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {historicalData.map((h,i) => (
                        <tr key={h.id} style={{ background: editingId===h.id?"rgba(107,45,139,0.08)":i%2===0?"#111111":"#0d0d0d" }}>
                          <td style={{ ...S.td, fontWeight:700, color:"#E8317A" }}>{h.yearMonth}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(parseFloat(h.grossRevenue)||0)}</td>
                          <td style={{ ...S.td, color:"#F0F0F0" }}>{fmt(parseFloat(h.netRevenue)||0)}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt((parseFloat(h.netRevenue)||0)*0.30)}</td>
                          <td style={{ ...S.td, color:"#E8317A" }}>{h.imcReimb?fmt(parseFloat(h.imcReimb)):"—"}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:900 }}>{fmt((parseFloat(h.netRevenue)||0)*0.30 + (parseFloat(h.imcReimb)||0))}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{h.newBuyers>0?`🌱 ${h.newBuyers}`:"—"}</td>
                          <td style={{ ...S.td, color:"#AAAAAA" }}>{h.notes||"—"}</td>
                          <td style={S.td}>
                            <div style={{ display:"flex", gap:6 }}>
                              <button onClick={()=>startEdit(h)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>✏️</button>
                              <button onClick={()=>{ if(window.confirm("Delete this historical entry?")) onDeleteHistorical(h.id); }} style={{ background:"none", border:"1px solid #FCA5A5", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        );
      })()}

    </div>
  );
}

function LotComp({ onAccept, onSaveComp, onDeleteComp, comps, user, userRole, onSaveQuote, quotes=[], onCloseQuote, onBazookaCounter }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [compMode,     setCompMode]     = useState("builder");
  const [seller,       setSeller]       = useState({ name:"", contact:"", date:"", source:"", payment:"", paymentHandle:"" });
  const [lotPct,       setLotPct]       = useState("");
  const [finalOffer,   setFOffer]       = useState("");
  const [custView,     setCustView]     = useState(false);
  const [custNote,     setCustNote]     = useState("");
  const [quoteLink,    setQuoteLink]    = useState(null);
  const [quoteCopied,  setQuoteCopied]  = useState(false);
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
      // Weight cost by this card's market value relative to total lot market value
      // so a $10 card costs more of the offer than a $1 card
      const weightedCost = totalMkt > 0 ? (mv / totalMkt) * dispOffer : (totalCards > 0 ? dispOffer/totalCards : 0);
      for (let i=0; i<qty; i++) {
        cards.push({ id:uid(), cardName:r.name, cardType:r.cardType, marketValue:mv, lotTotalPaid:dispOffer, cardsInLot:totalCards, costPerCard:weightedCost, buyPct:mv>0?weightedCost/mv:null, date:seller.date||new Date().toLocaleDateString(), source:seller.source, seller:seller.name, payment:seller.payment, dateAdded:new Date().toISOString() });
      }
    });
    onAccept(cards, seller, user, custNote);
  }

  if (custView) return (
    <div>
      <div style={{ marginBottom:14 }}><Btn onClick={()=>setCustView(false)} variant="ghost">← Back to Builder</Btn></div>
      <div style={{ background:"#111111", border:"2px solid #E8317A55", borderRadius:16, overflow:"hidden", maxWidth:680, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ background:"#000000", padding:"28px 32px", textAlign:"center" }}>
          <div style={{ fontSize:32, fontWeight:900, color:"#F0F0F0", letterSpacing:4, marginBottom:6 }}>BAZOOKA</div>
          <div style={{ fontSize:11, color:"#AAAAAA", fontStyle:"italic" }}>Bo Jackson Battle Arena · Lot Purchase Offer</div>
        </div>
        <div style={{ padding:"14px 24px", borderBottom:"1px solid #333333", display:"grid", gridTemplateColumns:"1fr 1fr", background:"#111111" }}>
          <div><span style={{ color:"#AAAAAA", fontSize:11 }}>Prepared for: </span><strong>{seller.name||"—"}</strong></div>
          <div style={{ textAlign:"right" }}><span style={{ color:"#AAAAAA", fontSize:11 }}>Date: </span><strong>{seller.date||new Date().toLocaleDateString()}</strong></div>
        </div>
        <div style={{ padding:"8px 24px 0" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["#","Card Name","Qty","Value/Card","Offer/Card"].map(h=><th key={h} style={{ padding:"8px 10px", borderBottom:"2px solid #F0E0E8", color:"#AAAAAA", fontSize:10, fontWeight:700, textTransform:"uppercase", textAlign:"left" }}>{h}</th>)}</tr></thead>
            <tbody>
              {included.length===0 ? <EmptyRow msg="No cards added." cols={5}/> :
                included.map((r,i) => {
                  const mv = parseFloat(r.mktVal)||0;
                  return (
                    <tr key={r.id} style={{ borderBottom:"1px solid #FFF0F5" }}>
                      <td style={{ padding:"8px 10px", color:"#D1D5DB", fontSize:11, width:32, textAlign:"center" }}>{i+1}</td>
                      <td style={{ padding:"8px 10px", fontWeight:700, color:"#F0F0F0" }}>{r.name}</td>
                      <td style={{ padding:"8px 10px", color:"#AAAAAA", textAlign:"center" }}>{parseInt(r.qty)||1}</td>
                      <td style={{ padding:"8px 10px", color:"#AAAAAA", fontWeight:600 }}>${mv.toFixed(2)}</td>
                      <td style={{ padding:"8px 10px", color:"#E8317A", fontWeight:700 }}>${(mv*dispPct).toFixed(2)}</td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>
        <div style={{ padding:"16px 24px", borderTop:"2px solid #333333", marginTop:8 }}>
          {/* Notes — rendered read-only in the quote */}
          {custNote.trim() && (
            <div style={{ marginBottom:14, padding:"12px 16px", background:"#111111", border:"1px solid #2a2a2a", borderLeft:"3px solid #E8317A", borderRadius:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Notes</div>
              <p style={{ margin:0, fontSize:13, color:"#AAAAAA", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{custNote}</p>
            </div>
          )}
          {[[`Total Cards`,totalCards],...(canSeeFinancials?[[`Total Market Value`,`$${totalMkt.toFixed(2)}`]]:[])] .map(([l,v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #FFF0F5" }}>
              <span style={{ color:"#AAAAAA", fontSize:13 }}>{l}</span>
              <span style={{ color:"#F0F0F0", fontWeight:700 }}>{v}</span>
            </div>
          ))}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12, padding:"14px 20px", background:"#111111", borderRadius:10 }}>
            <span style={{ color:"#E8317A", fontWeight:800, fontSize:16 }}>Bazooka's Offer</span>
            <span style={{ color:"#F0F0F0", fontWeight:900, fontSize:22 }}>${dispOffer.toFixed(2)}</span>
          </div>
          {/* Ship-to address */}
          <div style={{ marginTop:14, padding:"12px 16px", background:"#111111", border:"1px solid #2a2a2a", borderRadius:8 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Ship Cards To</div>
            <div style={{ fontSize:13, color:"#F0F0F0", fontWeight:700, lineHeight:1.8 }}>
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
              <div style={{ marginTop:14, padding:"14px 16px", background:"#111111", border:`2px solid ${cfg.color}33`, borderRadius:10 }}>
                <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>
                  Payment — <span style={{ color:cfg.color }}>{seller.payment}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    {cfg.icon}
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:cfg.color }}>{cfg.hint}</div>
                      {amt && <div style={{ fontSize:12, color:"#AAAAAA", marginTop:2 }}>Amount: <strong style={{color:"#F0F0F0"}}>${amt}</strong></div>}
                    </div>
                  </div>
                  {cfg.href
                    ? <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                        <a href={cfg.href} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:cfg.color, color:"#F0F0F0", border:"none", borderRadius:9, padding:"10px 20px", fontSize:13, fontWeight:800, textDecoration:"none", cursor:"pointer" }}>
                          {cfg.icon} {cfg.label} →
                        </a>
                        {cfg.webHref && <a href={cfg.webHref} target="_blank" rel="noreferrer" style={{ fontSize:11, color:cfg.color, textDecoration:"underline" }}>Open in browser instead</a>}
                      </div>
                    : <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                        <div style={{ background:cfg.color, color:"#F0F0F0", borderRadius:9, padding:"10px 20px", fontSize:13, fontWeight:800, textAlign:"center" }}>Open Zelle App</div>
                        <div style={{ fontSize:11, color:"#AAAAAA" }}>Send to: <strong style={{color:"#F0F0F0"}}>{handle}</strong></div>
                      </div>
                  }
                </div>
              </div>
            );
          })()}

          <div style={{ marginTop:12, textAlign:"center", color:"#AAAAAA", fontSize:11, fontStyle:"italic" }}>This offer is valid for 7 days. Thank you for bringing your collection to Bazooka!</div>
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
            { z:"🟢 Green",  p:"Under 65%", a:"Buy independently",          bg:"#0a1a0a", c:"#4ade80" },
            { z:"🟡 Yellow", p:"65–70%",    a:"Flag before buying",          bg:"#FFF9DB", c:"#92400e" },
            { z:"🔴 Red",    p:"Over 70%",  a:"Pass or get approval",        bg:"#FEE2E2", c:"#991b1b" },
          ].map(({z,p,a,bg,c}) => (
            <div key={z} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:bg, border:`1px solid ${c}22`, borderRadius:7 }}>
              <span style={{ fontWeight:800, color:c, fontSize:12, whiteSpace:"nowrap" }}>{z}</span>
              <span style={{ color:c, fontSize:11, whiteSpace:"nowrap" }}>{p}</span>
              <span style={{ color:"#AAAAAA", fontSize:11 }}>— {a}</span>
            </div>
          ))}
        </div>
      </div>

      {compMode==="quick" && (
        <div style={S.card}>
          <SectionLabel t="Quick Lot Comp" />
          <p style={{ fontSize:12, color:"#AAAAAA", marginBottom:16 }}>Enter total cards + avg market value per card for an instant offer.</p>
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
              <div key={l} style={{ background:"#111111", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
                <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {compMode==="history" && (() => {
        const [bzCounterAmt, setBzCounterAmt] = useState({});
        const activeQuotes = quotes.filter(q => !["closed"].includes(q.status));

        return (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* ── ACTIVE QUOTES ── */}
          {activeQuotes.length > 0 && (
            <div style={{ ...S.card, border:"2px solid rgba(232,49,122,0.3)" }}>
              <SectionLabel t="🔗 Active Quote Links" />
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {activeQuotes.map(q => {
                  const statusCfg = {
                    pending:   { color:"#888",    bg:"#1a1a1a",  label:"⏳ Awaiting Response" },
                    countered: { color:"#FBBF24", bg:"#1a1400",  label:"🤝 Counter Received" },
                    accepted:  { color:"#4ade80", bg:"#0a1a0a",  label:"✅ Accepted" },
                    declined:  { color:"#E8317A", bg:"#1a0a0a",  label:"❌ Declined" },
                  }[q.status] || { color:"#888", bg:"#1a1a1a", label:q.status };

                  const quoteUrl = `${window.location.origin}/quote/${q.id}`;
                  const expiresAt = new Date(new Date(q.createdAt).getTime()+7*24*60*60*1000);
                  const daysLeft = Math.max(0,Math.ceil((expiresAt-new Date())/86400000));

                  return (
                    <div key={q.id} style={{ background:statusCfg.bg, border:`1px solid ${statusCfg.color}33`, borderRadius:10, padding:"14px 16px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10, flexWrap:"wrap", gap:8 }}>
                        <div>
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                            <span style={{ fontWeight:800, fontSize:14, color:"#F0F0F0" }}>{q.seller?.name||"Unknown Seller"}</span>
                            <span style={{ background:statusCfg.bg, color:statusCfg.color, border:`1px solid ${statusCfg.color}44`, borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{statusCfg.label}</span>
                          </div>
                          <div style={{ fontSize:11, color:"#666" }}>
                            {q.cards?.length||0} cards · Offer: <strong style={{color:"#E8317A"}}>${parseFloat(q.currentOffer||q.dispOffer||0).toFixed(2)}</strong>
                            {q.status==="countered" && <> · Counter: <strong style={{color:"#FBBF24"}}>${parseFloat(q.sellerCounter||0).toFixed(2)}</strong></>}
                            {q.status==="accepted" && q.sellerPayment && <> · Payment: <strong style={{color:"#4ade80"}}>{q.sellerPayment}{q.sellerHandle?` — ${q.sellerHandle}`:""}</strong></>}
                            &nbsp;· {daysLeft}d left
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          <button onClick={()=>{ navigator.clipboard?.writeText(quoteUrl); }} style={{ background:"none", border:"1px solid #333", color:"#888", borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>📋 Copy Link</button>
                          <a href={quoteUrl} target="_blank" rel="noreferrer" style={{ background:"none", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, textDecoration:"none" }}>View ↗</a>
                          {onCloseQuote && <button onClick={()=>{ if(window.confirm("Close this quote? The seller's link will show as expired.")) onCloseQuote(q.id); }} style={{ background:"none", border:"1px solid #333", color:"#555", borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>🔒 Close</button>}
                        </div>
                      </div>

                      {/* Counter response UI */}
                      {q.status==="countered" && (
                        <div style={{ borderTop:"1px solid #333", paddingTop:10, display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
                          <div style={{ flex:1, minWidth:160 }}>
                            <label style={{ fontSize:10, fontWeight:700, color:"#777", textTransform:"uppercase", letterSpacing:1.5, display:"block", marginBottom:6 }}>Your Counter Back ($)</label>
                            <input
                              type="number" step="0.01" min="0"
                              value={bzCounterAmt[q.id]||""}
                              onChange={e=>setBzCounterAmt(p=>({...p,[q.id]:e.target.value}))}
                              placeholder={`Their counter: $${parseFloat(q.sellerCounter||0).toFixed(2)}`}
                              style={{ ...S.inp, color:"#FBBF24" }}
                            />
                          </div>
                          <Btn onClick={()=>{ if(onBazookaCounter&&bzCounterAmt[q.id]) { onBazookaCounter(q.id,parseFloat(bzCounterAmt[q.id]),q.history||[]); setBzCounterAmt(p=>({...p,[q.id]:""})); }}} disabled={!bzCounterAmt[q.id]} variant="ghost">🤝 Send Counter</Btn>
                          <Btn onClick={()=>{ if(onCloseQuote) onCloseQuote(q.id); }} variant="ghost">❌ Decline</Btn>
                          {q.status==="countered" && (
                            <Btn onClick={async()=>{
                              // Accept their counter — update offer to their counter amount
                              if(onBazookaCounter) {
                                await setDoc(doc(db,"quotes",q.id),{ status:"pending", currentOffer:parseFloat(q.sellerCounter), history:[...(q.history||[]),{type:"bazooka_accepted_counter",amount:parseFloat(q.sellerCounter),timestamp:new Date().toISOString()}], notified:false },{ merge:true });
                                showToast?.(`✅ Accepted counter at $${parseFloat(q.sellerCounter).toFixed(2)}`);
                              }
                            }} variant="green">✅ Accept Their Counter</Btn>
                          )}
                        </div>
                      )}

                      {/* Accepted — import prompt */}
                      {q.status==="accepted" && (
                        <div style={{ borderTop:"1px solid #333", paddingTop:10, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                          <span style={{ fontSize:12, color:"#4ade80" }}>🎉 Seller accepted! Ready to import into inventory.</span>
                          <button onClick={()=>{ loadComp({ seller:q.seller?.name, contact:q.seller?.contact, date:q.seller?.date, source:q.seller?.source, payment:q.sellerPayment, paymentHandle:q.sellerHandle, cards:q.cards, offer:parseFloat(q.currentOffer||q.dispOffer), id:q.id }); setCompMode("builder"); }} style={{ background:"#166534", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>📥 Load into Builder & Import</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SAVED COMPS ── */}
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
                          <span style={{ fontWeight:800, fontSize:15, color:"#F0F0F0" }}>{c.seller||"Unknown Seller"}</span>
                          <span style={{ background:c.status==="accepted"?"#D6F4E3":c.status==="passed"?"#FEE2E2":"#FFF9DB", color:c.status==="accepted"?"#166534":c.status==="passed"?"#991b1b":"#92400e", borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>
                            {c.status==="accepted"?"✅ Accepted":c.status==="passed"?"❌ Passed":"💾 Saved"}
                          </span>
                          {z && canSeeFinancials && <span style={{ background:z.bg, color:z.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{z.label}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:11, color:"#AAAAAA" }}>Saved by</span>
                          <span style={{ fontWeight:700, fontSize:12, color:"#F0F0F0" }}>{c.savedBy||"—"}</span>
                          {savedByRole && <span style={{ background:savedByRole.bg, color:savedByRole.color, border:`1px solid ${savedByRole.color}33`, borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{savedByRole.label}</span>}
                          <span style={{ fontSize:11, color:"#D1D5DB" }}>·</span>
                          <span style={{ fontSize:11, color:"#AAAAAA" }}>{savedAt}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                        <button onClick={()=>loadComp(c)} style={{ background:"#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>📥 Load into Builder</button>
                        {CAN_DELETE.includes(userRole?.role) && <button onClick={()=>{ if(window.confirm(`Delete this comp from history?\n\nSaved by: ${c.savedBy||"Unknown"}\nSeller: ${c.seller||"Unknown"}\n\nThis action will be logged.`)) onDeleteComp(c.id); }} style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑</button>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap", paddingTop:8, borderTop:"1px solid #FFF0F5" }}>
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>Cards: <strong style={{color:"#F0F0F0"}}>{c.totalCards}</strong></span>
                      {canSeeFinancials && <>
                        <span style={{ fontSize:12, color:"#AAAAAA" }}>Market: <strong style={{color:"#AAAAAA"}}>${(c.totalMarket||0).toFixed(2)}</strong></span>
                        <span style={{ fontSize:12, color:"#AAAAAA" }}>Offer: <strong style={{color:"#E8317A"}}>${(c.offer||0).toFixed(2)}</strong></span>
                        <span style={{ fontSize:12, color:"#AAAAAA" }}>Blended: <strong style={{color:z?.color||"#F0F0F0"}}>{((c.blendedPct||0)*100).toFixed(1)}%</strong></span>
                      </>}
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>Source: <strong style={{color:"#F0F0F0"}}>{c.source||"—"}</strong></span>
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>
                        {c.cards&&c.cards.length>0 ? <span style={{color:"#E8317A",fontWeight:700}}>✓ {c.cards.length} card{c.cards.length!==1?"s":""} saved</span> : <span style={{color:"#AAAAAA",fontWeight:700}}>⚠ No card details</span>}
                      </span>
                    </div>
                  </div>
                );
              })
          }
        </div>
        );
      })()}

      {compMode==="builder" && <>
        {loadedCompId && (
          <div id="comp-builder-top" style={{ background: loadedCompHadCards ? "#D6F4E3" : "#FFF9DB", border: `1.5px solid ${loadedCompHadCards ? "#2E7D52" : "#92400e"}`, borderRadius:10, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>{loadedCompHadCards ? "✅" : "⚠️"}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color: loadedCompHadCards ? "#166534" : "#92400e" }}>
                  {loadedCompHadCards ? "Comp loaded — ready to edit and import" : "Comp loaded — no card data saved"}
                </div>
                <div style={{ fontSize:11, color:"#AAAAAA", marginTop:2 }}>
                  {loadedCompHadCards ? "All seller info, cards, and offer amount restored. Hit Accept & Import to add to inventory." : "Seller info and offer restored, but this comp was saved without per-card details. Add cards manually below."}
                </div>
              </div>
            </div>
            <button onClick={()=>setLoadedCompId(null)} style={{ background:"transparent", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:18, lineHeight:1 }}>✕</button>
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
                <span style={{ fontSize:10, color:"#AAAAAA", fontWeight:600 }}>{(counterAmt!=null&&counterAmt>0)?"counter":(offerAmt!=null&&offerAmt>0)?"override":`${(dispPct*100).toFixed(0)}%`}</span>
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
              <span style={{ fontSize:12, color:"#AAAAAA" }}>Effective buy rate: <strong style={{ color: lotZone?.color||"#F0F0F0" }}>{(dispPct*100).toFixed(1)}%</strong></span>
              <button onClick={()=>setFOffer("")} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:12, textDecoration:"underline", fontFamily:"inherit" }}>Clear override</button>
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
                    <tr key={r.id} style={{ background:"#111111", opacity:r.include?1:0.35 }}>
                      <td style={{ ...S.td, color:"#D1D5DB", width:32, textAlign:"center" }}>{i+1}</td>
                      <td style={{ ...S.td, width:220, position:"relative" }}>
                        <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                          <input value={r.name} onChange={e=>upd(r.id,"name",e.target.value)} placeholder="Card name..." style={{ ...S.inp, padding:"5px 8px", fontSize:12, flex:1 }}/>
                          {r.name.trim() && (
                            <a
                              href={`https://130point.com/sales/?sSearch=${encodeURIComponent(r.name.trim())}`}
                              target="_blank"
                              rel="noreferrer"
                              title="Search on 130point"
                              style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #E8317A44", borderRadius:6, padding:"4px 8px", fontSize:11, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap", flexShrink:0, display:"inline-flex", alignItems:"center" }}
                            >🔍</a>
                          )}
                        </div>

                      </td>
                      <td style={{ ...S.td, width:155 }}>
                        <select value={r.cardType} onChange={e=>upd(r.id,"cardType",e.target.value)} style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:r.cardType?"#F0F0F0":"#9CA3AF", cursor:"pointer" }}>
                          <option value="">Type...</option>
                          {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
                        </select>
                      </td>
                      <td style={{ ...S.td, width:70 }}><input type="number" value={r.qty} onChange={e=>upd(r.id,"qty",e.target.value)} placeholder="1" min="1" style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:"#F0F0F0", width:55 }}/></td>
                      <td style={{ ...S.td, width:110 }}><input type="number" value={r.mktVal} onChange={e=>upd(r.id,"mktVal",e.target.value)} placeholder="0.00" style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:"#AAAAAA", width:80 }}/></td>
                      <td style={{ ...S.td, color:"#AAAAAA", fontWeight:700 }}>${(mv*qty).toFixed(2)}</td>
                      <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>${(mv*dispPct).toFixed(2)}</td>
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

        <div style={{ ...S.card, border:"2px solid #333333" }}>
          <SectionLabel t="Confirm & Actions" />
          {canSeeFinancials && dispOffer > 0 && totalMkt > 0 && (
            <div style={{ marginBottom:16, padding:"8px 14px", background:"#111111", borderRadius:8, display:"flex", gap:20, flexWrap:"wrap" }}>
              <span style={{ fontSize:12, color:"#AAAAAA" }}>Active offer: <strong style={{color:(counterAmt!=null&&counterAmt>0)?"#92400e":(offerAmt!=null&&offerAmt>0)?"#E8317A":"#166534"}}>${dispOffer.toFixed(2)} ({(dispPct*100).toFixed(1)}%)</strong></span>
              <span style={{ fontSize:12, color:"#AAAAAA" }}>Est. Margin: <strong style={{color:"#E8317A"}}>${(totalMkt-dispOffer).toFixed(2)}</strong></span>
              <span style={{ fontSize:12, color:"#AAAAAA" }}>Market Value: <strong style={{color:"#AAAAAA"}}>${totalMkt.toFixed(2)}</strong></span>
              <span style={{ fontSize:12, color:"#AAAAAA" }}>Per Card: <strong style={{color:"#E8317A"}}>${totalCards>0?(dispOffer/totalCards).toFixed(2):"—"}</strong></span>
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
              Cash:       { color:"#E8317A", bg:"#D6F4E3", label:"Cash Payment",      hint:`$${amt||"—"} cash`, href:null },
            };
            const cfg = PCFG[seller.payment];
            if (!cfg) return null;
            return (
              <div style={{ marginBottom:16, padding:"14px 16px", background:cfg.bg, border:`2px solid ${cfg.color}33`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>💸 Send Payment</div>
                  <div style={{ fontWeight:800, fontSize:16, color:cfg.color }}>{cfg.hint}</div>
                  {amt && <div style={{ fontSize:12, color:"#AAAAAA", marginTop:2 }}>Amount: <strong style={{color:"#F0F0F0"}}>${amt}</strong></div>}
                </div>
                {cfg.href
                  ? <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <a href={cfg.href} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:cfg.color, color:"#F0F0F0", borderRadius:9, padding:"12px 24px", fontSize:14, fontWeight:800, textDecoration:"none", whiteSpace:"nowrap" }}>{cfg.label} →</a>
                      {cfg.webHref && <a href={cfg.webHref} target="_blank" rel="noreferrer" style={{ fontSize:11, color:cfg.color, textDecoration:"underline" }}>Open in browser instead</a>}
                    </div>
                  : <div style={{ background:cfg.color, color:"#F0F0F0", borderRadius:9, padding:"12px 24px", fontSize:14, fontWeight:800 }}>{seller.payment==="Cash"?`Pay $${amt} cash`:`Open ${seller.payment} → ${cfg.hint}`}</div>
                }
              </div>
            );
          })()}

          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16 }}>
            <Btn onClick={()=>setCustView(true)} variant="ghost">👁 Customer View</Btn>
            <Btn onClick={async()=>{
              if (!onSaveQuote) return;
              const id = await onSaveQuote({
                seller, cards:included.map(r=>({ name:r.name, cardType:r.cardType, qty:parseInt(r.qty)||1, mktVal:parseFloat(r.mktVal)||0 })),
                dispOffer, dispPct, totalMkt, custNote,
                payment:seller.payment, paymentHandle:seller.paymentHandle,
              });
              const link = `${window.location.origin}/quote/${id}`;
              setQuoteLink(link);
              navigator.clipboard?.writeText(link);
              setQuoteCopied(true);
              setTimeout(()=>setQuoteCopied(false), 3000);
            }} variant="ghost" disabled={included.length===0}>🔗 Share Quote</Btn>
            {quoteLink && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#0a1a0a", border:"1px solid #4ade8033", borderRadius:8, padding:"6px 12px", flex:1 }}>
                <span style={{ fontSize:11, color:"#4ade80", fontWeight:700 }}>{quoteCopied ? "✅ Copied!" : "🔗"}</span>
                <span style={{ fontSize:11, color:"#888", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{quoteLink}</span>
                <button onClick={()=>{ navigator.clipboard?.writeText(quoteLink); setQuoteCopied(true); setTimeout(()=>setQuoteCopied(false),3000); }} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#888", cursor:"pointer", fontSize:11, padding:"2px 8px", fontFamily:"inherit", whiteSpace:"nowrap" }}>Copy</button>
                <a href={quoteLink} target="_blank" rel="noreferrer" style={{ color:"#E8317A", fontSize:11, textDecoration:"none", whiteSpace:"nowrap" }}>Open ↗</a>
              </div>
            )}
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
              <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1.5 }}>Counter Offer Calculator</div>
              {(counterAmt!=null&&counterAmt>0) && <span style={{ background:"#111111", color:"#AAAAAA", border:"1px solid #92400e33", borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>⚠ Counter is active — overrides your offer</span>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
              <div><label style={S.lbl}>Seller's Counter ($)</label><input type="number" value={counterOffer} onChange={e=>setCounterOffer(e.target.value)} placeholder="0.00" style={{ ...S.inp, border:(counterAmt!=null&&counterAmt>0)?"2px solid #E8317A":S.inp.border }}/></div>
              <div><label style={S.lbl}>Counter Zone</label><div style={{ ...S.inp, background:counterZone?.bg||"#F9FAFB", border:`1.5px solid ${counterZone?.color||"#E5E7EB"}`, color:counterZone?.color||"#9CA3AF", fontWeight:700 }}>{counterZone?counterZone.label:totalMkt>0?"Enter counter":"Add cards first"}</div></div>
              <div><label style={S.lbl}>Counter Buy %</label><div style={{ ...S.inp, color:(counterAmt!=null&&counterAmt>0)?(counterZone?.color||"#6B2D8B"):"#9CA3AF", fontWeight:700 }}>{(counterAmt!=null&&counterAmt>0)&&totalMkt>0?`${((counterAmt/totalMkt)*100).toFixed(1)}%`:"—"}</div></div>
              <div><label style={S.lbl}>vs Your Offer</label><div style={{ ...S.inp, color:(counterAmt!=null&&counterAmt>(offerAmt!=null&&offerAmt>0?offerAmt:calcOffer))?"#991b1b":"#166534", fontWeight:700 }}>{(counterAmt!=null&&counterAmt>0)&&calcOffer>0?`$${Math.abs(counterAmt-(offerAmt>0?offerAmt:calcOffer)).toFixed(2)} ${counterAmt>(offerAmt!=null&&offerAmt>0?offerAmt:calcOffer)?"over":"under"}`:"—"}</div></div>
            </div>
            {(counterAmt!=null&&counterAmt>0) && totalMkt > 0 && (
              <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:"#AAAAAA" }}>Active offer: <strong style={{color:"#F0F0F0"}}>${counterAmt.toFixed(2)}</strong> at <strong style={{color:counterZone?.color||"#F0F0F0"}}>{((counterAmt/totalMkt)*100).toFixed(1)}%</strong> — card values and zones updated</span>
                <button onClick={()=>setCounterOffer("")} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:12, fontWeight:700, textDecoration:"underline" }}>Clear</button>
              </div>
            )}
          </div>
        </div>
      </>}
    </div>
  );
}

function Inventory({ inventory, breaks, onRemove, onBulkRemove, onSaveCardCost, user, userRole, lotTracking={}, onSaveLotTracking, lotNotes={}, onSaveLotNotes, onDeleteLot, shipments=[], productUsage=[], onSaveShipment, onDeleteShipment, skuPrices={}, onSaveSkuPrices, onDeleteProductUsage }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [trackingEdit,   setTrackingEdit]   = useState(null);
  const [trackingForm,   setTrackingForm]   = useState({ carrier:"", trackingNum:"", status:"", eta:"", notes:"" });

  const [search,   setSearch]   = useState("");
  const [typeF,    setTypeF]    = useState("");
  const [statusF,  setStatusF]  = useState("available");
  const [selected, setSelected] = useState(new Set());
  const [invTab,   setInvTab]   = useState("cards");
  const [editCostId,  setEditCostId]  = useState(null);
  const [editCostVal, setEditCostVal] = useState("");
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
            "Ordered":            { bg:"#F3F4F6", color:"#AAAAAA" },
            "Label Created":      { bg:"#EEF0FB", color:"#F0F0F0" },
            "Shipped":            { bg:"#FFF0CC", color:"#AAAAAA" },
            "In Transit":         { bg:"#E0F7F4", color:"#0D6E6E" },
            "Out for Delivery":   { bg:"#FCE8F3", color:"#8B1A5A" },
            "Delivered":          { bg:"#D6F4E3", color:"#E8317A" },
            "Exception":          { bg:"#FEE2E2", color:"#E8317A" },
          };

          return (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:12 }}>
              {orphanedNotes.length > 0 && CAN_DELETE.includes(userRole?.role) && (
                <div style={{ marginBottom:12, padding:"10px 16px", background:"#111111", border:"1.5px solid #92400e33", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                  <span style={{ fontSize:12, color:"#AAAAAA" }}>⚠ {orphanedNotes.length} note{orphanedNotes.length!==1?"s":""} from previous lots couldn't be matched automatically.</span>
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
                    const sc        = STATUS_COLORS[tracking.status] || { bg:"#F3F4F6", color:"#AAAAAA" };

                    return (
                      <div key={i} style={{ border:"1px solid #2a2a2a", borderRadius:10, overflow:"hidden", background:"#111111" }}>
                        {/* Lot header */}
                        <div style={{ padding:"14px 18px", background:"#111111" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                            <div><span style={{ fontWeight:700, fontSize:14, color:"#F0F0F0" }}>{lot.seller}</span><span style={{ color:"#AAAAAA", fontSize:12, marginLeft:10 }}>{lot.date}</span></div>
                            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                              <span style={{ fontSize:12, color:"#AAAAAA" }}>{lot.source}{canSeeFinancials?` · ${lot.payment}`:""}</span>
                              {canSeeFinancials && <span style={{ fontWeight:700, color:"#E8317A" }}>${lot.lotPaid.toFixed(2)}</span>}
                              {CAN_DELETE.includes(userRole?.role) && (
                                <button
                                  onClick={() => onDeleteLot(lot.key, lot.cards.map(c=>c.id))}
                                  style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:7, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                  title="Delete entire lot">🗑 Delete Lot</button>
                              )}
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:8 }}>
                            <span style={{ fontSize:12, color:"#AAAAAA" }}>Total: <strong style={{color:"#F0F0F0"}}>{lot.cards.length}</strong></span>
                            <span style={{ fontSize:12, color:"#AAAAAA" }}>Available: <strong style={{color:"#E8317A"}}>{availInLot}</strong></span>
                            {transitInLot > 0 && <span style={{ fontSize:12, color:"#AAAAAA" }}>In Transit: <strong style={{color:"#F0F0F0"}}>🚚 {transitInLot}</strong></span>}
                            <span style={{ fontSize:12, color:"#AAAAAA" }}>Used: <strong style={{color:"#E8317A"}}>{usedInLot}</strong></span>
                            <span style={{ fontSize:12, color:"#AAAAAA" }}>Added by: <strong style={{color:"#F0F0F0"}}>{lot.addedBy}</strong></span>
                          </div>
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                            {CARD_TYPES.map(ct => { const count=lot.cards.filter(c=>c.cardType===ct).length; if(!count) return null; const cc=CC[ct]; return <span key={ct} style={{ background:cc.bg, color:cc.text, border:`1px solid ${cc.border}44`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{ct}: {count}</span>; })}
                          </div>
                        </div>

                        {/* Tracking bar */}
                        <div style={{ borderTop:"1px solid #222222", padding:"10px 18px", background:"#111111" }}>
                          {!isEditing ? (
                            <div>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, marginBottom: (tracking.eta||tracking.lastEvent||tracking.lastEvent) ? 8 : 0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>📦 Tracking</span>
                                  {tracking.trackingNum || tracking.status
                                    ? <>
                                        {tracking.status && <span style={{ background:sc.bg, color:sc.color, border:`1px solid ${sc.color}33`, borderRadius:5, padding:"2px 10px", fontSize:12, fontWeight:700 }}>{tracking.status}</span>}
                                        {tracking.carrier && <span style={{ fontSize:12, color:"#AAAAAA" }}>{tracking.carrier}</span>}
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
                                      style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
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
                                <div style={{ display:"flex", gap:16, flexWrap:"wrap", padding:"8px 12px", background:"#111111", borderRadius:7, marginTop:4 }}>
                                  {tracking.eta && (
                                    <span style={{ fontSize:12, color:"#AAAAAA" }}>
                                      📅 Est. Delivery: <strong style={{ color: tracking.status==="Delivered" ? "#166534" : "#1B4F8A" }}>{tracking.eta}</strong>
                                    </span>
                                  )}
                                  {tracking.lastEvent && (
                                    <span style={{ fontSize:12, color:"#AAAAAA" }}>
                                      📍 {tracking.lastLocation && <strong style={{color:"#F0F0F0"}}>{tracking.lastLocation} — </strong>}{tracking.lastEvent}
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
                                  <select value={trackingForm.carrier} onChange={e=>setTrackingForm(p=>({...p,carrier:e.target.value}))} style={{ ...S.inp, cursor:"pointer", color:trackingForm.carrier?"#F0F0F0":"#9CA3AF" }}>
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
                                  <select value={trackingForm.status} onChange={e=>setTrackingForm(p=>({...p,status:e.target.value}))} style={{ ...S.inp, cursor:"pointer", color:trackingForm.status?"#F0F0F0":"#9CA3AF" }}>
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
                                  style={{ background:"#111111", color:"#AAAAAA", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}
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
                    const urg = d>=90?{bg:"#FEE2E2",color:"#E8317A"}:d>=60?{bg:"#FEF3C7",color:"#AAAAAA"}:{bg:"#F9FAFB",color:"#AAAAAA"};
                    return (
                      <div key={c.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:urg.bg, border:`1px solid ${urg.color}22`, borderRadius:8, marginBottom:6 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <span style={{ fontWeight:700, color:"#F0F0F0" }}>{c.cardName}</span>
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
      {invTab==="product"   && <ProductInventory shipments={shipments} productUsage={productUsage} onSaveShipment={onSaveShipment} onDeleteShipment={onDeleteShipment} onDeleteProductUsage={onDeleteProductUsage} user={user} userRole={userRole} skuPrices={skuPrices} onSaveSkuPrices={onSaveSkuPrices}/>}

      {invTab==="cards" && <>
        <div style={S.card}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search card name..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{ ...S.inp, width:"auto", minWidth:160, color:typeF?"#F0F0F0":"#9CA3AF", cursor:"pointer" }}>
              <option value="">All Types</option>
              {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
            </select>
            <div style={{ display:"flex", gap:4 }}>
              {[["available","✅ Available"],["in_transit","🚚 In Transit"],["used","🔴 Used"],["all","All"]].map(([val,label]) => (
                <button key={val} onClick={()=>setStatusF(val)} style={{ background:statusF===val?"#1A1A2E":"transparent", color:statusF===val?"#E8317A":"#9CA3AF", border:`1.5px solid ${statusF===val?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{label}</button>
              ))}
            </div>
            <span style={{ color:"#AAAAAA", fontSize:12 }}>{filtered.length} cards</span>
            {selected.size>0 && CAN_DELETE.includes(userRole?.role) && (
              <button onClick={handleBulkDelete} style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>🗑 Delete {selected.size} selected</button>
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
                      <tr key={c.id} className="inv-row fade-in" style={{ background:isSel?"#1a0a0f":i%2===0?"#111111":"#0d0d0d", opacity:used?0.45:1 }}>
                        <td style={{ ...S.td, textAlign:"center" }}><input type="checkbox" checked={isSel} onChange={()=>toggleSelect(c.id)}/></td>
                        <td style={{ ...S.td, fontWeight:700 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {c.cardName}
                            {isAging && <span style={{ background:"#1a1400", color:"#AAAAAA", border:"1px solid #FDE68A", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>⏰ {daysIn}d</span>}
                          </div>
                        </td>
                        <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge></td>
                        {canSeeFinancials && <>
                          <td style={{ ...S.td, color:"#AAAAAA", fontWeight:700 }}>${(c.marketValue||0).toFixed(2)}</td>
                          <td style={{ ...S.td, color:"#AAAAAA" }}>${(c.lotTotalPaid||0).toFixed(2)}</td>
                          <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.payment||"—"}</td>
                        </>}
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.source||"—"}</td>
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.seller||"—"}</td>
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:11 }}>{c.date||"—"}</td>
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.addedBy||"—"}</td>
                        <td style={S.td}>{used
                          ? <Badge bg="#FEE2E2" color="#991b1b">Used</Badge>
                          : c.cardStatus==="in_transit"
                            ? <Badge bg="#EEF0FB" color="#2C3E7A">🚚 In Transit</Badge>
                            : <Badge bg="#D6F4E3" color="#166534">Available</Badge>
                        }</td>
                        <td style={S.td}>
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            {editCostId === c.id ? (
                              <>
                                <input
                                  type="number" step="0.01" autoFocus
                                  value={editCostVal}
                                  onChange={e=>setEditCostVal(e.target.value)}
                                  style={{ ...S.inp, width:80, padding:"3px 6px", fontSize:11 }}
                                  onKeyDown={e=>{
                                    if (e.key==="Enter") {
                                      const newCost = parseFloat(editCostVal)||0;
                                      onRemove(c.id); // we'll need a save handler — see note below
                                      setEditCostId(null);
                                    }
                                    if (e.key==="Escape") setEditCostId(null);
                                  }}
                                />
                                <button onClick={async()=>{
                                  const newCost = parseFloat(editCostVal)||0;
                                  await onSaveCardCost(c.id, newCost);
                                  setEditCostId(null);
                                }} style={{ background:"#166534", color:"#fff", border:"none", borderRadius:5, padding:"3px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>✓</button>
                                <button onClick={()=>setEditCostId(null)} style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:13 }}>✕</button>
                              </>
                            ) : (
                              <>
                                {canSeeFinancials && <button onClick={()=>{ setEditCostId(c.id); setEditCostVal((c.costPerCard||0).toFixed(2)); }} style={{ background:"none", border:"1px solid #333", color:"#888", borderRadius:5, padding:"2px 7px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }} title="Edit cost">✏️</button>}
                                {CAN_DELETE.includes(userRole?.role) && <button onClick={()=>onRemove(c.id)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:14 }}>✕</button>}
                              </>
                            )}
                          </div>
                        </td>
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

function BreakLog({ inventory, breaks, onAdd, onBulkAdd, onDeleteBreak, user, userRole, streams=[], onSaveStream, onDeleteStream, productUsage=[], onSaveProductUsage, shipments=[], recapOnly=false, cardsOnly=false, skuPrices={}, onUpsertBuyers }) {
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
  const [chaserSearch, setChaserSearch] = useState("");

  // Stream recap state
  const EMPTY_RECAP = { grossRevenue:"", whatnotFees:"", coupons:"", whatnotPromo:"", magpros:"", packagingMaterial:"", topLoaders:"", magprosQty:"", packagingQty:"", topLoadersQty:"", chaserCards:"", chaserCardIds:"", marketMultiple:"", newBuyers:"", binOnly:false, breakType:"auction", commissionOverride:"", streamNotes:"" };
  const EMPTY_USAGE = { doubleMega:"", hobby:"", jumbo:"", misc:"", miscNotes:"" };
  const [recap,       setRecap]       = useState(EMPTY_RECAP);
  const [prodUsage,   setProdUsage]   = useState(EMPTY_USAGE);
  const [recapSaving, setRecapSaving] = useState(false);
  const [recapSaved,  setRecapSaved]  = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvMsg,       setCsvMsg]       = useState(null); // { type: 'success'|'error', text }

  // Check existing product usage for this breaker+date
  const existingUsage = productUsage.find(u => u.breaker === breaker && u.date === date);

  // Check if a stream recap already exists for this breaker+date
  const [editingStreamId, setEditingStreamId] = useState(null);

  // Find existing stream: prefer by ID when editing, fall back to breaker+date for new entries
  const existingStream = editingStreamId
    ? streams.find(s => s.id === editingStreamId)
    : streams.find(s => s.breaker === breaker && s.date === date);

  // Load existing stream into form when breaker/date changes
  useEffect(() => {
    if (existingStream) {
      const prodFields = PRODUCT_TYPES.reduce((acc,pt) => { acc[`prod_${pt}`] = existingStream[`prod_${pt}`]||""; return acc; }, {});
      setRecap({ grossRevenue:existingStream.grossRevenue||"", whatnotFees:existingStream.whatnotFees||"", coupons:existingStream.coupons||"", whatnotPromo:existingStream.whatnotPromo||"", magpros:existingStream.magpros||"", packagingMaterial:existingStream.packagingMaterial||"", topLoaders:existingStream.topLoaders||"", magprosQty:existingStream.magprosQty||"", packagingQty:existingStream.packagingQty||"", topLoadersQty:existingStream.topLoadersQty||"", chaserCards:existingStream.chaserCards||"", chaserCardIds:existingStream.chaserCardIds||"", marketMultiple:existingStream.marketMultiple||"", newBuyers:existingStream.newBuyers||"", binOnly:existingStream.binOnly||false, breakType:existingStream.breakType||"auction", commissionOverride:existingStream.commissionOverride||"", streamNotes:existingStream.notes||"", ...prodFields });
      setRecapSaved(true);
    } else {
      setRecap(EMPTY_RECAP);
      setRecapSaved(false);
      setChaserSearch("");
    }
    if (existingUsage) {
      setProdUsage({ doubleMega:existingUsage.doubleMega||"", hobby:existingUsage.hobby||"", jumbo:existingUsage.jumbo||"", misc:existingUsage.misc||"", miscNotes:existingUsage.miscNotes||"" });
    } else {
      setProdUsage(EMPTY_USAGE);
    }
  }, [breaker, date]);

  function rf(k) {
    return v => {
      setRecap(p => {
        const updated = { ...p, [k]: v };
        // When BIN is toggled on, clear the market multiple
        if (k === "binOnly" && v === true) {
          updated.marketMultiple = "";
          return updated;
        }
        // Auto-calculate market multiple when product counts or gross revenue change (not BIN)
        const isProductField = PRODUCT_TYPES.some(pt => k === `prod_${pt}`);
        if ((isProductField || k === "grossRevenue") && !updated.binOnly) {
          const gross = parseFloat(k === "grossRevenue" ? v : updated.grossRevenue) || 0;
          const totalMktVal = PRODUCT_TYPES.reduce((sum, pt) => {
            const qty   = parseInt(k === `prod_${pt}` ? v : updated[`prod_${pt}`]) || 0;
            const price = parseFloat(skuPrices[pt]) || 0;
            return sum + (qty * price);
          }, 0);
          if (gross > 0 && totalMktVal > 0) {
            updated.marketMultiple = (gross / totalMktVal).toFixed(2);
          }
        }
        return updated;
      });
      setRecapSaved(false);
    };
  }

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
    const streamExp = coupons+promo+magpros+pack+topload+chaser;
    const repExp   = streamExp * 0.135;
    const imcExpReimb = streamExp * 0.70;
    const commBase = bazNet - repExp;
    const mm = parseFloat(recap.marketMultiple)||0;
    const overrideRate = recap.commissionOverride !== "" ? parseFloat(recap.commissionOverride)/100 : null;
    const rate = overrideRate !== null ? overrideRate : recap.binOnly ? 0.35 : mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
    const commAmt = commBase * rate;
    return { gross, totalExp, netRev, bazNet, imcNet, repExp, imcExpReimb, commBase, rate, commAmt, bazTrueNet: bazNet - repExp - commAmt + imcExpReimb };
  }

  async function handleSaveRecap() {
    if (!breaker || !date || !recap.grossRevenue) return;
    setRecapSaving(true);
    try {
      const streamId = existingStream?.id || uid();
      await onSaveStream({ ...(existingStream||{}), ...recap, notes:recap.streamNotes, id:streamId, breaker, date });
      // Log selected chaser cards out of inventory
      if (recap.chaserCardIds) {
        const cardIds = recap.chaserCardIds.split(",").filter(Boolean);
        const alreadyLogged = new Set(breaks.filter(b=>b.streamId===streamId).map(b=>b.inventoryId));
        const toLog = cardIds.filter(id => !alreadyLogged.has(id));
        if (toLog.length > 0) {
          const entries = toLog.map(id => {
            const card = inventory.find(c=>c.id===id);
            return { id:uid(), date, breaker, inventoryId:id, cardName:card?.cardName||"", cardType:"Chaser Cards", usage:"Chaser", notes:"Auto-logged from stream recap", streamId, dateAdded:new Date().toISOString(), loggedBy:user?.displayName||"Unknown" };
          });
          if (onBulkAdd) onBulkAdd(entries);
        }
      }
      // Save product usage from recap fields
      const prodFields = PRODUCT_TYPES.reduce((acc,pt) => { const v=parseInt(recap[`prod_${pt}`])||0; if(v>0) acc[pt]=v; return acc; }, {});
      if (Object.keys(prodFields).length > 0 && onSaveProductUsage) {
        await onSaveProductUsage({ id:uid(), streamId, breaker, date, ...prodFields });
      }
      setRecapSaved(true);
      setEditingStreamId(streamId); // lock to this stream for subsequent edits
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
      {!cardsOnly && <div style={{ ...S.card, border: recapSaved ? "2px solid #D6F4E3" : "2px solid #E8317A22" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:8 }}>
          <SectionLabel t="Stream Recap" />
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            {/* Whatnot CSV Import */}
            <label style={{ display:"flex", alignItems:"center", gap:6, background:"#1a1a2e", border:"1.5px solid #E8317A44", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700, color:"#E8317A", cursor:"pointer", whiteSpace:"nowrap" }}>
              📥 Whatnot CSV
              <input type="file" accept=".csv" style={{ display:"none" }} onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const lines = ev.target.result.split("\n").map(l=>l.trim()).filter(Boolean);
                    const rawHeaders = lines[0].split(",").map(h=>h.replace(/"/g,"").toLowerCase().trim());
                    const getIdx = key => rawHeaders.findIndex(h=>h===key);
                    const origIdx   = getIdx("original_item_price");
                    const couponIdx = getIdx("coupon_price");
                    const cancelIdx = getIdx("cancelled_or_failed");
                    const dateIdx   = getIdx("placed_at");
                    if (origIdx === -1) { alert("Couldn't find original_item_price column. Make sure this is a Whatnot live sales CSV."); return; }
                    let gross=0, coupons=0, streamDate="", skipped=0;
                    for (let i=1; i<lines.length; i++) {
                      const cols=[]; let cur="", inQuote=false;
                      for (const ch of lines[i]) {
                        if (ch==='"') { inQuote=!inQuote; }
                        else if (ch==="," && !inQuote) { cols.push(cur.trim()); cur=""; }
                        else { cur+=ch; }
                      }
                      cols.push(cur.trim());
                      if ((cols[cancelIdx]||"").toLowerCase()==="true") { skipped++; continue; }
                      gross   += parseFloat(cols[origIdx]||0)||0;
                      coupons += parseFloat(cols[couponIdx]||0)||0;
                      if (!streamDate && cols[dateIdx]) streamDate = cols[dateIdx].split(" ")[0];
                    }
                    setRecap(p=>({ ...p, grossRevenue:gross.toFixed(2), coupons:coupons>0?coupons.toFixed(2):p.coupons }));
                    if (streamDate) setDate(streamDate);
                    setRecapSaved(false);
                    setCsvMsg({ type:"success", text:`✅ Imported! Gross: $${gross.toFixed(2)}${coupons>0?` · Coupons: $${coupons.toFixed(2)}`:""}${skipped>0?` · ${skipped} cancelled skipped`:""}${streamDate?` · Date: ${streamDate}`:""} — now fill in fees & expenses.` });
                    setTimeout(()=>setCsvMsg(null), 6000);

                    // Parse buyers for CRM
                    if (onUpsertBuyers) {
                      const buyerMap = {};
                      const usernameIdx = rawHeaders.indexOf("buyer_username");
                      const addressIdx  = rawHeaders.indexOf("shipping_address");
                      const zipIdx      = rawHeaders.indexOf("postal_code");
                      const couponCodeIdx = rawHeaders.indexOf("coupon_code");
                      for (let i=1; i<lines.length; i++) {
                        const cols=[]; let cur="", inQuote=false;
                        for (const ch of lines[i]) {
                          if (ch==='"') { inQuote=!inQuote; }
                          else if (ch==="," && !inQuote) { cols.push(cur.trim()); cur=""; }
                          else { cur+=ch; }
                        }
                        cols.push(cur.trim());
                        if ((cols[cancelIdx]||"").toLowerCase()==="true") continue;
                        const username = cols[usernameIdx]||"";
                        if (!username) continue;
                        const address = cols[addressIdx]||"";
                        const parts = address.split(",").map(p=>p.trim());
                        const fullName = parts[0]||"";
                        const city  = parts[parts.length-4]||"";
                        const state = parts[parts.length-3]||"";
                        const zip   = cols[zipIdx]||"";
                        const spend = parseFloat(cols[origIdx]||0)||0;
                        const hasCoupon = !!(cols[couponCodeIdx]||"").trim();
                        if (!buyerMap[username]) buyerMap[username] = { username, fullName, city, state, zip, spend:0, orders:0, couponCount:0, date:streamDate };
                        buyerMap[username].spend += spend;
                        buyerMap[username].orders++;
                        if (hasCoupon) buyerMap[username].couponCount++;
                      }
                      const streamId = `${breaker}_${streamDate}`;
                      onUpsertBuyers(Object.values(buyerMap), streamId);
                    }
                  } catch(err) { setCsvMsg({ type:"error", text:"Could not parse CSV. Make sure it's a Whatnot live sales export." }); }
                };
                reader.readAsText(file);
                e.target.value="";
              }}/>
            </label>
            {editingStreamId && existingStream && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ background:"#111111", color:"#AAAAAA", border:"1px solid #92400e33", borderRadius:6, padding:"2px 10px", fontSize:11, fontWeight:700 }}>
                  ✏️ Editing: {existingStream.breaker} · {existingStream.date}
                </span>
                <button onClick={()=>{ setRecap({...EMPTY_RECAP}); setRecapSaved(false); setEditingStreamId(null); }} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:11, textDecoration:"underline", fontFamily:"inherit" }}>
                  Start new instead
                </button>
              </div>
            )}
            {recapSaved && <span style={{ background:"#111111", color:"#E8317A", border:"1px solid #2E7D5222", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700 }}>✅ Saved</span>}
          </div>
        </div>

        {/* CSV import message */}
        {csvMsg && (
          <div style={{ marginBottom:12, padding:"10px 14px", background:csvMsg.type==="success"?"#0a1a0a":"#1a0a0a", border:`1px solid ${csvMsg.type==="success"?"#4ade8033":"#E8317A33"}`, borderRadius:8, fontSize:12, color:csvMsg.type==="success"?"#4ade80":"#E8317A", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>{csvMsg.text}</span>
            <button onClick={()=>setCsvMsg(null)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:14, marginLeft:10 }}>✕</button>
          </div>
        )}

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
            <input type="number" step="0.01" value={recap.marketMultiple} onChange={e=>rf("marketMultiple")(e.target.value)} placeholder="Auto-calculated" style={{ ...S.inp, color: recap.marketMultiple?"#1B4F8A":"#9CA3AF" }} disabled={recap.binOnly}/>
          </div>
          <div>
            <label style={{ ...S.lbl, color:"#E8317A" }}>🌱 New Buyers</label>
            <input type="number" min="0" step="1" value={recap.newBuyers||""} onChange={e=>rf("newBuyers")(e.target.value)} placeholder="0" style={{ ...S.inp, color:"#E8317A" }}/>
          </div>
        </div>

        {/* Financials */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
          {[
            ["grossRevenue",      "Gross Revenue ($)",       "#166534", false],
            ["whatnotFees",       "Whatnot Fees ($)",        "#991b1b", false],
            ["coupons",           "Coupons ($)",             "#991b1b", false],
            ["whatnotPromo",      "Whatnot Promo ($)",       "#991b1b", false],
          ].filter(([,,, adminOnly]) => !adminOnly).map(([key, label, color]) => (
            <div key={key}>
              <label style={{ ...S.lbl, color: key==="grossRevenue"?"#166534":S.lbl.color }}>{label}</label>
              <input type="number" step="0.01" value={recap[key]||""} onChange={e=>rf(key)(e.target.value)} placeholder="0.00" style={{ ...S.inp, color }}/>
            </div>
          ))}
          {/* Chaser Cards — picker + manual override */}
          <div style={{ gridColumn:"span 4", background:"#111111", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 14px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <label style={{ ...S.lbl, color:"#AAAAAA", margin:0 }}>🏆 Cards Used as Chasers</label>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <label style={{ fontSize:11, color:"#AAAAAA" }}>Manual override ($)</label>
                <input type="number" step="0.01" value={recap.chaserCards||""} onChange={e=>rf("chaserCards")(e.target.value)} placeholder="0.00" style={{ ...S.inp, width:90, color:"#AAAAAA", padding:"4px 8px" }}/>
              </div>
            </div>
            {(() => {
              const usedIdSet = new Set(breaks.map(b=>b.inventoryId));
              const available = inventory.filter(c => !usedIdSet.has(c.id) && c.cardStatus!=="in_transit");
              const selectedChasers = recap.chaserCardIds ? recap.chaserCardIds.split(",").filter(Boolean) : [];
              const totalCost = selectedChasers.reduce((sum,id)=>{ const card=inventory.find(c=>c.id===id); return sum+(card?.costPerCard||0); }, 0);
              const visibleCards = chaserSearch.trim()
                ? available.filter(c => c.cardName?.toLowerCase().includes(chaserSearch.toLowerCase()) || c.cardType?.toLowerCase().includes(chaserSearch.toLowerCase()))
                : available;
              return (
                <div>
                  {available.length === 0
                    ? <div style={{ fontSize:12, color:"#AAAAAA", padding:"8px 0" }}>No available cards in inventory</div>
                    : <>
                        <div style={{ marginBottom:8, display:"flex", gap:8, alignItems:"center" }}>
                          <input
                            value={chaserSearch}
                            onChange={e=>setChaserSearch(e.target.value)}
                            placeholder="Search cards..."
                            style={{ ...S.inp, padding:"5px 10px", fontSize:12, flex:1 }}
                          />
                          {chaserSearch && <button onClick={()=>setChaserSearch("")} style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:14, flexShrink:0 }}>✕</button>}
                          <span style={{ fontSize:11, color:"#666", whiteSpace:"nowrap" }}>{visibleCards.length} card{visibleCards.length!==1?"s":""}</span>
                        </div>
                        <div style={{ maxHeight:200, overflowY:"auto", border:"1px solid #2a2a2a", borderRadius:8, background:"#111111" }}>
                          {visibleCards.length === 0
                            ? <div style={{ padding:"12px 16px", color:"#666", fontSize:12 }}>No cards match "{chaserSearch}"</div>
                            : visibleCards.map(c => {
                                const isSel = selectedChasers.includes(c.id);
                          const cc = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                          return (
                            <div key={c.id}
                              onClick={()=>{
                                const newSel = isSel ? selectedChasers.filter(x=>x!==c.id) : [...selectedChasers, c.id];
                                const newCost = newSel.reduce((sum,id)=>{ const card=inventory.find(x=>x.id===id); return sum+(card?.costPerCard||0); },0);
                                setRecap(p=>({...p, chaserCardIds:newSel.join(","), chaserCards:newCost>0?newCost.toFixed(2):p.chaserCards}));
                                setRecapSaved(false);
                              }}
                              style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 12px", cursor:"pointer", background:isSel?"#2a1520":"#111111", borderBottom:"1px solid #222222" }}
                            >
                              <input type="checkbox" checked={isSel} readOnly style={{ flexShrink:0 }}/>
                              <span style={{ fontSize:12, fontWeight:isSel?700:400, color:"#F0F0F0", flex:1 }}>{c.cardName}</span>
                              <span style={{ background:cc.bg, color:cc.text, borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700, whiteSpace:"nowrap" }}>{c.cardType}</span>
                              {c.costPerCard>0 && <span style={{ fontSize:11, color:"#AAAAAA", fontWeight:700 }}>${c.costPerCard.toFixed(2)}</span>}
                            </div>
                          );
                        })}
                      </div>
                      </>
                  }
                  {selectedChasers.length > 0 && (
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:8 }}>
                      <span style={{ fontSize:12, color:"#AAAAAA", fontWeight:700 }}>
                        ✅ {selectedChasers.length} card{selectedChasers.length!==1?"s":""} selected · auto-cost: ${totalCost.toFixed(2)}
                      </span>
                      <button onClick={()=>{ setRecap(p=>({...p, chaserCardIds:"", chaserCards:""})); setRecapSaved(false); }} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#AAAAAA", cursor:"pointer", fontSize:11, padding:"2px 8px", fontFamily:"inherit" }}>✕ Clear</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          {/* Supply qty fields — auto-calc from cost per unit */}
          <div style={{ display:"contents" }}>
              {[
                { qtyKey:"magprosQty",   dollarKey:"magpros",           label:"MagPros",             supplyKey:"supply_magpros"   },
                { qtyKey:"packagingQty", dollarKey:"packagingMaterial", label:"Packaging Materials", supplyKey:"supply_packaging" },
                { qtyKey:"topLoadersQty",dollarKey:"topLoaders",        label:"Top Loaders",         supplyKey:"supply_topLoaders"},
              ].map(({ qtyKey, dollarKey, label, supplyKey }) => {
                const costPer = parseFloat(skuPrices[supplyKey]) || 0;
                const qty     = parseInt(recap[qtyKey]) || 0;
                const total   = (qty * costPer).toFixed(2);
                return (
                  <div key={qtyKey}>
                    <label style={{ ...S.lbl, color:"#E8317A" }}>{label} (qty)</label>
                    <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                      <input
                        type="number" min="0" step="1"
                        value={recap[qtyKey]||""}
                        onChange={e => {
                          const q = parseInt(e.target.value)||0;
                          const amt = (q * costPer).toFixed(2);
                          setRecap(p => ({ ...p, [qtyKey]:e.target.value, [dollarKey]:amt }));
                          setRecapSaved(false);
                        }}
                        placeholder="0"
                        style={{ ...S.inp, color:"#E8317A", flex:1 }}
                      />
                      {costPer > 0 && qty > 0 && (
                        <span style={{ fontSize:11, color:"#E8317A", fontWeight:700, whiteSpace:"nowrap" }}>${total}</span>
                      )}
                      {!costPer && <span style={{ fontSize:10, color:"#D1D5DB", whiteSpace:"nowrap" }}>no cost set</span>}
                    </div>
                  </div>
                );
              })}
            </div>
        </div>

        <div style={{ display:"flex", gap:16, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <input type="checkbox" checked={recap.binOnly||false} onChange={e=>rf("binOnly")(e.target.checked)} style={{ width:16, height:16 }}/>
            <span style={{ fontSize:12, color:"#AAAAAA" }}>BIN Break — flat 35% commission</span>
          </div>
          {canSeeFinancials && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
              <label style={{ fontSize:12, color:"#E8317A", fontWeight:700, whiteSpace:"nowrap" }}>🔧 Override Commission %</label>
              <input
                type="number" min="0" max="100" step="1"
                value={recap.commissionOverride||""}
                onChange={e=>rf("commissionOverride")(e.target.value)}
                placeholder="e.g. 0"
                style={{ ...S.inp, width:80, color:"#E8317A", textAlign:"center" }}
              />
              {recap.commissionOverride !== "" && (
                <button onClick={()=>rf("commissionOverride")("")} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:14, padding:0 }}>✕</button>
              )}
              <span style={{ fontSize:11, color:"#AAAAAA" }}>{recap.commissionOverride !== "" ? `Using ${recap.commissionOverride}%` : "Leave blank to use tier rate"}</span>
            </div>
          )}
        </div>

        {/* Product used this stream */}
        <div style={{ marginBottom:14 }}>
          <label style={{ ...S.lbl, marginBottom:8, display:"block" }}>📦 Product Used This Stream</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {PRODUCT_TYPES.map(pt => (
              <div key={pt}>
                <label style={{ ...S.lbl, color:"#E8317A" }}>{pt}</label>
                <input
                  type="number" min="0" step="1"
                  value={recap[`prod_${pt}`]||""}
                  onChange={e=>rf(`prod_${pt}`)(e.target.value)}
                  placeholder="0"
                  style={{ ...S.inp, color:"#E8317A" }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Live commission preview */}
        {hasRecapData && (
          <div style={{ background:"#111111", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 16px", marginBottom:14 }}>
            {canSeeFinancials ? (
              <>
                {/* Row 1: top-level split */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:10 }}>
                  {[
                    { l:"Gross Revenue",         v:fmt(rc.gross),   c:"#F0F0F0" },
                    { l:"Owed to Imagination Mining", v:fmt(rc.imcNet),  c:"#6B2D8B" },
                    { l:"Bazooka Earnings (30%)", v:fmt(rc.bazNet),  c:"#E8317A" },
                  ].map(({l,v,c}) => (
                    <div key={l} style={{ textAlign:"center", background:"#111111", borderRadius:8, padding:"10px 8px", border:"1px solid #2a2a2a" }}>
                      <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                      <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {/* Row 2: bazooka true net */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, paddingTop:10, borderTop:"1px solid #222222" }}>
                  {[
                    { l:"Bazooka Earnings",          v:fmt(rc.bazNet),              c:"#E8317A" },
                    { l:"− Rep Commission",           v:"− "+fmt(rc.commAmt),        c:"#991b1b" },
                    ...(canSeeFinancials ? [{ l:"+ IMC Expense Reimb (70%)",  v:"+ "+fmt(rc.imcExpReimb||0), c:"#166534" }] : []),
                    ...(canSeeFinancials ? [{ l:"Bazooka True Net",           v:fmt(rc.bazTrueNet),          c:"#166534" }] : []),
                  ].map(({l,v,c}) => (
                    <div key={l} style={{ textAlign:"center", background: l==="Bazooka True Net"?"#D6F4E3":"#FFFFFF", borderRadius:8, padding:"10px 8px", border:`1px solid ${l==="Bazooka True Net"?"#16653444":"#F0E0E8"}` }}>
                      <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                      <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10 }}>
                {[
                  { l:"Net Revenue",  v:fmt(rc.netRev),  c:"#1B4F8A" },
                  { l:`Your Commission (${(rc.rate*100).toFixed(0)}%)`, v:fmt(rc.commAmt), c:"#166534" },
                ].map(({l,v,c}) => (
                  <div key={l} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                    <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <Btn onClick={handleSaveRecap} disabled={!breaker||!date||!recap.grossRevenue||recapSaving} variant="green">
            {recapSaving ? "Saving..." : recapSaved ? "✅ Update Recap" : "💾 Save Stream Recap"}
          </Btn>
          {recapSaved && (
            <Btn onClick={()=>{ setDate(new Date().toISOString().split("T")[0]); setRecap({...EMPTY_RECAP}); setRecapSaved(false); setEditingStreamId(null); }} variant="ghost">
              + New Stream
            </Btn>
          )}
          {existingStream && !recapSaved && <span style={{ fontSize:11, color:"#AAAAAA" }}>⚠ Unsaved changes</span>}
        </div>
      </div>}

      {/* ── STREAM LOG ── */}
      {!cardsOnly && (() => {
        function calcS(s) {
          const gross=parseFloat(s.grossRevenue)||0, fees=parseFloat(s.whatnotFees)||0, coupons=parseFloat(s.coupons)||0, promo=parseFloat(s.whatnotPromo)||0, magpros=parseFloat(s.magpros)||0, pack=parseFloat(s.packagingMaterial)||0, topload=parseFloat(s.topLoaders)||0, chaser=parseFloat(s.chaserCards)||0;
          const totalExp=fees+coupons+promo+magpros+pack+topload+chaser, netRev=gross-totalExp, bazNet=netRev*0.30, imcNet=netRev*0.70;
          const streamExp=coupons+promo+magpros+pack+topload+chaser, repExp=streamExp*0.135, imcExpReimb=streamExp*0.70;
          const mm=parseFloat(s.marketMultiple)||0, overrideRate=s.commissionOverride!==""&&s.commissionOverride!=null?parseFloat(s.commissionOverride)/100:null, rate=overrideRate!==null?overrideRate:s.binOnly?0.35:mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
          const commAmt=(bazNet-repExp)*rate;
          return { gross, netRev, bazNet, imcNet, commAmt, imcExpReimb, bazTrueNet: bazNet-repExp-commAmt+imcExpReimb, rate };
        }
        const myStreams = canSeeFinancials ? streams : streams.filter(s => s.breaker === matchedBreaker);
        return (
          <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px 0" }}>
              <SectionLabel t={`Stream Log (${myStreams.length})`} />
            </div>
            {myStreams.length === 0
              ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"30px 0" }}>No streams logged yet — save a stream recap above to get started</div>
              : <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>{["Date","Breaker","Gross","Net Rev",canSeeFinancials?"Owed to IM":null,canSeeFinancials?"Baz Earnings":null,"Commission",canSeeFinancials?"True Net":null,"Rate","New Buyers",...PRODUCT_TYPES.map(pt=>pt.replace(" ","")),""].filter(Boolean).map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {myStreams.map((s,i) => {
                    const c = calcS(s);
                    const bc = BC[s.breaker]||{bg:"#F3F4F6",text:"#6B7280"};
                    const isActive = existingStream?.id === s.id;
                    return (
                      <tr key={s.id}
                        onClick={()=>{ setBreaker(s.breaker); setDate(s.date); setEditingStreamId(s.id); setRecapSaved(false); }}
                        className="clickable-row"
                        style={{ background:isActive?"#2a1520":i%2===0?"#111111":"#0d0d0d", cursor:"pointer", borderBottom:"1px solid #FFF0F5" }}
                        title="Click to load this stream"
                      >
                        <td style={S.td}>{s.date}</td>
                        <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge></td>
                        <td style={{ ...S.td, color:"#F0F0F0", fontWeight:700 }}>{fmt(c.gross)}</td>
                        <td style={{ ...S.td, color:"#F0F0F0" }}>{fmt(c.netRev)}</td>
                        {canSeeFinancials && <td style={{ ...S.td, color:"#E8317A" }}>{fmt(c.imcNet)}</td>}
                        {canSeeFinancials && <td style={{ ...S.td, color:"#E8317A" }}>{fmt(c.bazNet)}</td>}
                        <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(c.commAmt)}</td>
                        {canSeeFinancials && <td style={{ ...S.td, color:"#E8317A", fontWeight:900 }}>{fmt(c.bazTrueNet)}</td>}
                        <td style={{ ...S.td, color:"#AAAAAA" }}>{(c.rate*100).toFixed(0)}%{s.binOnly?" BIN":""}</td>
                        <td style={{ ...S.td, color:"#E8317A" }}>{parseInt(s.newBuyers)||0 > 0 ? `🌱 ${s.newBuyers}` : "—"}</td>
                        {PRODUCT_TYPES.map(pt => {
                          const qty = parseInt(s[`prod_${pt}`])||0;
                          const PT_COLORS = {"Double Mega":"#C2410C","Hobby":"#2C3E7A","Jumbo":"#166534","Miscellaneous":"#6B2D8B"};
                          return (
                            <td key={pt} style={{ ...S.td, color: qty>0?PT_COLORS[pt]:"#D1D5DB", fontWeight:qty>0?700:400, textAlign:"center" }}>
                              {qty>0 ? qty : "—"}
                            </td>
                          );
                        })}
                        <td style={S.td}>
                          <button
                            onClick={e=>{ e.stopPropagation(); if(window.confirm("Delete this stream?")) { if(onDeleteStream) onDeleteStream(s.id); if(existingStream?.id===s.id){ setRecap({...EMPTY_RECAP}); setRecapSaved(false); setEditingStreamId(null); } }}}
                            style={{ background:"none", border:"1px solid #FCA5A5", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                          >🗑</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}
          </div>
        );
      })()}

      {/* ── LOG CARDS ── */}
      {!recapOnly && <>
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
              <div style={{ border:"1px solid #2a2a2a", borderRadius:8, overflow:"hidden", maxHeight:220, overflowY:"auto", background:"#111111", boxShadow:"0 4px 12px rgba(232,49,122,0.1)", marginTop:4 }}>
                {available.filter(c=>c.cardName.toLowerCase().includes(cardSearch.toLowerCase())).length===0
                  ? <div style={{ padding:"12px 16px", color:"#AAAAAA", fontSize:13 }}>No cards found</div>
                  : available.filter(c=>c.cardName.toLowerCase().includes(cardSearch.toLowerCase())).map(c => {
                      const cc = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                      return (
                        <div key={c.id} onClick={()=>{setCardId(c.id);setCardSearch(c.cardName);}} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 16px", cursor:"pointer", background:cardId===c.id?"#1a0a0f":"#111111", borderBottom:"1px solid #FFF0F5" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontWeight:700, fontSize:13 }}>{c.cardName}</span>
                            <Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge>
                          </div>
                          {canSeeFinancials && <span style={{ fontSize:12, color:"#AAAAAA", fontWeight:600 }}>${(c.marketValue||0).toFixed(2)}</span>}
                        </div>
                      );
                    })
                }
              </div>
            )}
          </Field>
        </div>
        {selCard && (
          <div style={{ marginBottom:12, padding:"10px 14px", background:"#111111", borderRadius:8, display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize:12, color:"#AAAAAA" }}>Selected: <strong style={{color:"#F0F0F0"}}>{selCard.cardName}</strong></span>
            <Badge bg={CC[selCard.cardType]?.bg} color={CC[selCard.cardType]?.text}>{selCard.cardType}</Badge>
            {canSeeFinancials && <span style={{ fontSize:12, color:"#AAAAAA" }}>Value: <strong style={{color:"#AAAAAA"}}>${(selCard.marketValue||0).toFixed(2)}</strong></span>}
          </div>
        )}
        <div style={{ display:"flex", gap:10, alignItems:"end" }}>
          <div style={{ flex:1 }}><TextInput label="Notes (optional)" value={notes} onChange={setNotes} placeholder="e.g. Break #2"/></div>
          <Btn onClick={handleAdd} disabled={!breaker||!cardId} variant="green">Log Card Out</Btn>
          <Btn onClick={()=>{setBulkMode(p=>!p);setBulkSel(new Set());}} variant="ghost">{bulkMode?"Cancel Bulk":"Bulk Log Out"}</Btn>
        </div>
        {bulkMode && (
          <div style={{ marginTop:16, borderTop:"1px solid #F0D0DC", paddingTop:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>Select cards to log out</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(220px,1fr))", gap:8, maxHeight:280, overflowY:"auto", marginBottom:12 }}>
              {available.map(c => {
                const cc=CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                const isSel=bulkSel.has(c.id);
                return (
                  <div key={c.id} onClick={()=>toggleBulk(c.id)} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 12px", background:isSel?"#1a0a0f":"#FAFAFA", border:`1.5px solid ${isSel?"#E8317A":"#F0D0DC"}`, borderRadius:8, cursor:"pointer" }}>
                    <input type="checkbox" checked={isSel} onChange={()=>toggleBulk(c.id)} onClick={e=>e.stopPropagation()}/>
                    <div><div style={{ fontSize:12, fontWeight:700, color:"#F0F0F0" }}>{c.cardName}</div><Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge></div>
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
              <div style={{ fontSize:24, fontWeight:900, color:bc.text, marginBottom:10 }}>{s.total} <span style={{ fontSize:11, color:"#AAAAAA", fontWeight:400 }}>cards used</span></div>
              {CARD_TYPES.map(ct => (
                <div key={ct} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #222222" }}>
                  <span style={{ fontSize:11, color:"#AAAAAA" }}>{ct}</span>
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
              <button onClick={handleBulkDeleteHist} style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginBottom:14 }}>
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
                    <tr key={b.id} className="break-row fade-in" style={{ background:isSel?"#1a0a0f":i%2===0?"#111111":"#0d0d0d" }}>
                      <td style={{ ...S.td, textAlign:"center" }}><input type="checkbox" checked={isSel} onChange={()=>toggleHistSel(b.id)}/></td>
                      <td style={{ ...S.td, color:"#AAAAAA", fontSize:11 }}>{b.date}</td>
                      <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{b.breaker}</Badge></td>
                      <td style={{ ...S.td, fontWeight:700 }}>{b.cardName}</td>
                      <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{b.cardType}</Badge></td>
                      <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{b.usage||"—"}</td>
                      <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{b.loggedBy||"—"}</td>
                      <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{b.notes||"—"}</td>
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
      </>}
    </div>
  );
}

function Performance({ breaks, user, userRole, streams=[] }) {
  const isAdmin        = userRole?.role === "Admin";
  const currentUser    = user?.displayName?.split(" ")[0] || "";
  const matchedBreaker = BREAKERS.find(b => currentUser.toLowerCase().includes(b.toLowerCase()));
  const visibleBreakers = isAdmin ? BREAKERS : (matchedBreaker ? [matchedBreaker] : []);
  const now  = new Date();
  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // Boxes ripped calculations
  const thisMonth = streams.filter(s => {
    const d = new Date(s.date);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });
  const thisYear = streams.filter(s => new Date(s.date).getFullYear()===now.getFullYear());

  function boxesForStreams(slist) {
    return PRODUCT_TYPES.reduce((acc, pt) => {
      acc[pt] = slist.reduce((sum, s) => sum + (parseInt(s[`prod_${pt}`])||0), 0);
      return acc;
    }, {});
  }

  const monthBoxes = boxesForStreams(thisMonth);
  const yearBoxes  = boxesForStreams(thisYear);
  const monthTotal = Object.values(monthBoxes).reduce((a,b)=>a+b,0);
  const yearTotal  = Object.values(yearBoxes).reduce((a,b)=>a+b,0);
  const monthGross = thisMonth.reduce((sum,s) => sum+(parseFloat(s.grossRevenue)||0), 0);
  const monthNewBuyers = thisMonth.reduce((sum,s) => sum+(parseInt(s.newBuyers)||0), 0);

  const PT_COLORS = {
    "Double Mega":   "#FFFFFF",
    "Hobby":         "#FFFFFF",
    "Jumbo":         "#FFFFFF",
    "Miscellaneous": "#FFFFFF",
  };

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
    // Boxes ripped this month by breaker
    const breakerMonthStreams = thisMonth.filter(s => s.breaker===breaker);
    const breakerBoxes = boxesForStreams(breakerMonthStreams);
    const breakerBoxTotal = Object.values(breakerBoxes).reduce((a,b)=>a+b,0);
    const breakerGross = breakerMonthStreams.reduce((sum,s) => sum+(parseFloat(s.grossRevenue)||0), 0);
    const breakerNewBuyers = breakerMonthStreams.reduce((sum,s) => sum+(parseInt(s.newBuyers)||0), 0);
    const mmStreams = breakerMonthStreams.filter(s=>parseFloat(s.marketMultiple)>0);
    const breakerAvgMM = mmStreams.length>0 ? mmStreams.reduce((sum,s)=>sum+(parseFloat(s.marketMultiple)||0),0)/mmStreams.length : null;
    return { all, month, byType, byDay, last7, streak, topType, breakerBoxes, breakerBoxTotal, breakerGross, breakerNewBuyers, breakerAvgMM };
  }

  if (visibleBreakers.length===0) return <div style={{ ...S.card, textAlign:"center", padding:"60px" }}><div style={{ fontSize:32, marginBottom:12 }}>📈</div><div style={{ color:"#AAAAAA" }}>Your account isn't linked to a streamer profile.</div></div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Boxes Ripped Summary */}
      {(monthTotal > 0 || yearTotal > 0 || monthGross > 0 || monthNewBuyers > 0) && (
      <div style={S.card}>
        <SectionLabel t="📦 This Month's Key Metrics" />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
          <div style={{ ...S.card, textAlign:"center", background:"#111111" }}>
            <div style={{ fontSize:32, fontWeight:900, color:"#F0F0F0" }} className="num-pop"><AnimatedNumber value={monthTotal} format="count"/></div>
            <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>Boxes Ripped</div>
            <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginTop:8 }}>
              {PRODUCT_TYPES.map(pt => monthBoxes[pt]>0 ? (
                <span key={pt} style={{ color:PT_COLORS[pt], fontSize:11, fontWeight:700 }}>{pt.replace(" ","")}: {monthBoxes[pt]}</span>
              ) : null)}
            </div>
          </div>
          <div style={{ ...S.card, textAlign:"center", background:"#111111" }}>
            <div style={{ fontSize:32, fontWeight:900, color:"#E8317A" }} className="num-pop"><AnimatedNumber value={monthGross}/></div>
            <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>Gross Revenue</div>
            <div style={{ fontSize:11, color:"#AAAAAA", marginTop:6 }}>{thisMonth.length} stream{thisMonth.length!==1?"s":""}</div>
          </div>
          <div style={{ ...S.card, textAlign:"center", background:"#111111" }}>
            <div style={{ fontSize:32, fontWeight:900, color:"#E8317A" }} className="num-pop"><AnimatedNumber value={monthNewBuyers} format="count"/></div>
            <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>New Buyers</div>
          </div>
        </div>
        {/* Per-breaker box bars */}
        {isAdmin && monthTotal > 0 && (
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Boxes by Breaker</div>
            {BREAKERS.map(b => {
              const bStreams = thisMonth.filter(s=>s.breaker===b);
              const bTotal  = Object.values(boxesForStreams(bStreams)).reduce((a,x)=>a+x,0);
              const bGross  = bStreams.reduce((sum,s)=>sum+(parseFloat(s.grossRevenue)||0),0);
              const bBuyers = bStreams.reduce((sum,s)=>sum+(parseInt(s.newBuyers)||0),0);
              if (bTotal===0 && bGross===0 && bBuyers===0) return null;
              const bc = BC[b]||{bg:"#F3F4F6",text:"#6B7280"};
              return (
                <div key={b} style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <Badge bg={bc.bg} color={bc.text}>{b}</Badge>
                  <div style={{ flex:1, height:6, background:"#111111", borderRadius:3, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:bc.text, borderRadius:3, width:`${monthTotal>0?(bTotal/monthTotal*100):0}%` }}/>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:bc.text, minWidth:24 }}>{bTotal} boxes</span>
                  <span style={{ fontSize:11, color:"#E8317A", minWidth:60 }}>{fmt(bGross)}</span>
                  <span style={{ fontSize:11, color:"#E8317A", minWidth:30 }}>🌱 {bBuyers}</span>
                </div>
              );
            })}
          </div>
        )}
        {/* Year totals */}
        {yearTotal > 0 && (
          <div style={{ borderTop:"1px solid #222222", paddingTop:14 }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>This Year</div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <span style={{ fontSize:22, fontWeight:900, color:"#F0F0F0" }}>{yearTotal} boxes</span>
              {PRODUCT_TYPES.map(pt => yearBoxes[pt]>0 ? (
                <span key={pt} style={{ background:"#111111", border:`1.5px solid ${PT_COLORS[pt]}33`, color:PT_COLORS[pt], borderRadius:7, padding:"3px 10px", fontSize:11, fontWeight:700 }}>
                  {pt}: {yearBoxes[pt]}
                </span>
              ) : null)}
            </div>
          </div>
        )}
      </div>
      )}
      {visibleBreakers.map((breaker,bi) => {
        const bc    = BC[breaker];
        const stats = getStats(breaker);
        return (
          <div key={breaker}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:bc.bg, border:`2px solid ${bc.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:900, color:bc.text }}>{breaker[0]}</div>
              <div>
                <div style={{ fontSize:18, fontWeight:900, color:"#F0F0F0" }}>{breaker}</div>
                <div style={{ fontSize:11, color:"#AAAAAA" }}>{stats.all.length} total cards logged</div>
              </div>
              {stats.streak>0 && <div style={{ marginLeft:"auto", background:bc.bg, border:`1.5px solid ${bc.border}`, borderRadius:10, padding:"6px 14px", textAlign:"center" }}>
                <div style={{ fontSize:18, fontWeight:900, color:bc.text }}>🔥 {stats.streak}</div>
                <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>Day Streak</div>
              </div>}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
              {[
                { l:"Total Cards Used",     v:stats.all.length,                                          c:bc.text },
                { l:"This Month",           v:stats.month.length,                                        c:bc.text },
                { l:"📦 Boxes This Month",  v:stats.breakerBoxTotal||0,                                  c:stats.breakerBoxTotal>0?"#6B2D8B":"#9CA3AF" },
                { l:"💰 Gross This Month",  v:stats.breakerGross>0?fmt(stats.breakerGross):"—",          c:stats.breakerGross>0?"#E8317A":"#9CA3AF" },
                { l:"🌱 New Buyers",        v:stats.breakerNewBuyers||0,                                 c:stats.breakerNewBuyers>0?"#166534":"#9CA3AF" },
                { l:"Top Card Type",        v:stats.topType.replace(" Cards",""),                        c:CC[stats.topType]?.text||bc.text },
                { l:"📈 Avg Market Multiple", v:stats.breakerAvgMM?`${stats.breakerAvgMM.toFixed(2)}x`:"—", c:stats.breakerAvgMM>=1.6?"#166534":stats.breakerAvgMM>=1.5?"#92400e":"#9CA3AF" },
                { l:"Active Streak",        v:stats.streak>0?`${stats.streak}d`:"—",                    c:stats.streak>0?"#E8317A":"#9CA3AF" },
              ].map(({l,v,c}) => (
                <div key={l} className="stat-card" style={{ ...S.card, textAlign:"center" }}>
                  <div style={{ fontSize:20, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
                  <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
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
                        <span style={{ fontSize:12, color:"#AAAAAA" }}>{cnt} ({(pct*100).toFixed(0)}%)</span>
                      </div>
                      <div style={{ height:6, background:"#111111", borderRadius:3, overflow:"hidden" }}>
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
                        <div style={{ fontSize:9, color:"#AAAAAA" }}>{d.date}</div>
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
                    <div key={day} style={{ textAlign:"center", padding:"10px 4px", background:count===0?"#F0E0E8":`rgba(${r},${g},${b2},${0.2+intensity*0.8})`, borderRadius:8, border:"1px solid #2a2a2a" }}>
                      <div style={{ fontSize:11, fontWeight:700, color:count>0?bc.text:"#9CA3AF" }}>{day}</div>
                      <div style={{ fontSize:16, fontWeight:900, color:count>0?bc.text:"#D1D5DB", marginTop:2 }}>{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {isAdmin && bi < visibleBreakers.length-1 && <div style={{ height:1, background:"#111111", margin:"8px 0 16px" }}/>}
          </div>
        );
      })}
    </div>
  );
}

// ─── PRODUCT INVENTORY ───────────────────────────────────────────
function ProductInventory({ shipments=[], productUsage=[], onSaveShipment, onDeleteShipment, onDeleteProductUsage, user, userRole, skuPrices={}, onSaveSkuPrices }) {
  const canEdit = ["Admin"].includes(userRole?.role);
  const EMPTY   = { date:new Date().toISOString().split("T")[0], productType:"Hobby", qty:"", notes:"" };
  const [form,          setForm]          = useState(EMPTY);
  const [adding,        setAdding]        = useState(false);
  const [editId,        setEditId]        = useState(null);
  const [skuForm,       setSkuForm]       = useState({});
  const [skuEditing,    setSkuEditing]    = useState(false);
  const [supplyEditing, setSupplyEditing] = useState(false);
  const [supplyForm,    setSupplyForm]    = useState({});

  const SUPPLY_ITEMS = [
    { key:"magpros",     label:"MagPros"              },
    { key:"packaging",   label:"Packaging Materials"  },
    { key:"topLoaders",  label:"Top Loaders"          },
  ];

  useEffect(() => {
    setSkuForm(skuPrices);
    setSupplyForm(skuPrices); // supply costs stored alongside sku prices
  }, [JSON.stringify(skuPrices)]);

  // Stock = total received - total used per product type
  const stock = PRODUCT_TYPES.reduce((acc, pt) => {
    const received = shipments.reduce((s, sh) => s + (sh.productType===pt ? (parseInt(sh.qty)||0) : 0), 0);
    const used     = productUsage.reduce((s, u) => s + (parseInt(u[pt])||0), 0);
    acc[pt] = { received, used, current: received - used };
    return acc;
  }, {});

  function openAdd()    { setForm({...EMPTY}); setAdding(true); setEditId(null); }
  function openEdit(s)  { setForm({date:s.date, productType:s.productType, qty:String(s.qty), notes:s.notes||""}); setEditId(s.id); setAdding(true); }
  function cancelForm() { setAdding(false); setEditId(null); setForm(EMPTY); }

  async function handleSave() {
    if (!form.productType || !form.qty || !form.date) return;
    await onSaveShipment({ ...(editId ? shipments.find(s=>s.id===editId)||{} : {}), ...form, qty:parseInt(form.qty)||0, id:editId||uid() });
    cancelForm();
  }

  const PT_COLORS = {
    "Double Mega":   { bg:"#222222", text:"#FFFFFF", border:"#444444" },
    "Hobby":         { bg:"#222222", text:"#FFFFFF", border:"#444444" },
    "Jumbo":         { bg:"#222222", text:"#FFFFFF", border:"#444444" },
    "Miscellaneous": { bg:"#222222", text:"#FFFFFF", border:"#444444" },
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* SKU Pricing — Admin only */}
      {canEdit && (
        <div style={{ ...S.card, border:"2px solid #333333" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: skuEditing ? 14 : 0 }}>
            <SectionLabel t="SKU Market Values" />
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {!skuEditing && PRODUCT_TYPES.map(pt => skuPrices[pt] ? (
                <span key={pt} style={{ fontSize:11, color:"#AAAAAA" }}>{pt}: <strong style={{color:"#F0F0F0"}}>${parseFloat(skuPrices[pt]).toFixed(2)}</strong></span>
              ) : null)}
              <button onClick={()=>setSkuEditing(p=>!p)} style={{ background:"transparent", border:"1.5px solid #E8317A", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {skuEditing ? "Cancel" : "✏️ Edit"}
              </button>
            </div>
          </div>
          {skuEditing && (
            <>
              <div style={{ fontSize:12, color:"#AAAAAA", marginBottom:12 }}>Set the retail/market value per unit for each product type. Used to auto-calculate market multiple in Stream Recap.</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:14 }}>
                {PRODUCT_TYPES.map(pt => (
                  <div key={pt}>
                    <label style={{ ...S.lbl, color:PT_COLORS[pt]?.text }}>{pt} ($)</label>
                    <input
                      type="number" step="0.01" min="0"
                      value={skuForm[pt]||""}
                      onChange={e=>setSkuForm(p=>({...p,[pt]:e.target.value}))}
                      placeholder="0.00"
                      style={{ ...S.inp, color:PT_COLORS[pt]?.text }}
                    />
                  </div>
                ))}
              </div>
              <Btn onClick={async()=>{ await onSaveSkuPrices(skuForm); setSkuEditing(false); }} variant="green">💾 Save SKU Prices</Btn>
            </>
          )}
        </div>
      )}

      {/* Supply Cost Config — Admin only */}
      {canEdit && (
        <div style={{ ...S.card, border:"2px solid #6B2D8B22" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: supplyEditing ? 14 : 0 }}>
            <SectionLabel t="Supply Cost Per Unit" />
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {!supplyEditing && SUPPLY_ITEMS.map(({ key, label }) => skuPrices[`supply_${key}`] ? (
                <span key={key} style={{ fontSize:11, color:"#AAAAAA" }}>{label}: <strong style={{color:"#F0F0F0"}}>${parseFloat(skuPrices[`supply_${key}`]).toFixed(3)}</strong></span>
              ) : null)}
              <button onClick={()=>setSupplyEditing(p=>!p)} style={{ background:"transparent", border:"1.5px solid #6B2D8B", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {supplyEditing ? "Cancel" : "✏️ Edit"}
              </button>
            </div>
          </div>
          {supplyEditing && (
            <>
              <div style={{ fontSize:12, color:"#AAAAAA", marginBottom:12 }}>Set cost per unit for supplies. In Stream Recap, enter quantities and costs auto-calculate.</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginBottom:14 }}>
                {SUPPLY_ITEMS.map(({ key, label }) => (
                  <div key={key}>
                    <label style={{ ...S.lbl, color:"#E8317A" }}>{label} ($ per unit)</label>
                    <input
                      type="number" step="0.001" min="0"
                      value={supplyForm[`supply_${key}`]||""}
                      onChange={e=>setSupplyForm(p=>({...p,[`supply_${key}`]:e.target.value}))}
                      placeholder="e.g. 0.25"
                      style={{ ...S.inp, color:"#E8317A" }}
                    />
                  </div>
                ))}
              </div>
              <Btn onClick={async()=>{ await onSaveSkuPrices({...skuPrices,...supplyForm}); setSupplyEditing(false); }} variant="green">💾 Save Supply Costs</Btn>
            </>
          )}
        </div>
      )}

      {/* Stock summary */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {PRODUCT_TYPES.map(pt => {
          const s  = stock[pt];
          const pc = PT_COLORS[pt] || { bg:"#F3F4F6", text:"#6B7280", border:"#6B7280" };
          const low = s.current <= 2;
          const out = s.current <= 0;
          return (
            <div key={pt} style={{ background:pc.bg, border:`2px solid ${out?"#991b1b":low?"#92400e":pc.border}33`, borderRadius:12, padding:"16px", textAlign:"center" }}>
              <div style={{ fontSize:11, fontWeight:700, color:pc.text, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{pt}</div>
              <div style={{ fontSize:36, fontWeight:900, color: out?"#991b1b":low?"#92400e":pc.text, marginBottom:4 }}>{s.current}</div>
              <div style={{ fontSize:10, color:"#AAAAAA" }}>in stock</div>
              <div style={{ display:"flex", justifyContent:"center", gap:12, marginTop:8 }}>
                <span style={{ fontSize:10, color:"#AAAAAA" }}>↑ {s.received} rcvd</span>
                <span style={{ fontSize:10, color:"#AAAAAA" }}>↓ {s.used} used</span>
              </div>
              {skuPrices[pt] && <div style={{ marginTop:6, fontSize:10, color:pc.text, fontWeight:700 }}>${parseFloat(skuPrices[pt]).toFixed(2)}/unit</div>}
              {out  && <div style={{ marginTop:8, background:"#111111", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700 }}>🚨 Out of Stock</div>}
              {!out && low && <div style={{ marginTop:8, background:"#111111", color:"#AAAAAA", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700 }}>⚠ Low Stock</div>}
            </div>
          );
        })}
      </div>

      {/* Add shipment */}
      {canEdit && (
        <>
          {!adding
            ? <Btn onClick={openAdd} variant="gold">+ Add Shipment</Btn>
            : (
              <div style={{ ...S.card, border:"2px solid #333333" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                  <SectionLabel t={editId ? "Edit Shipment" : "Add Shipment"} />
                  <button onClick={cancelForm} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:18 }}>✕</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 2fr", gap:12, marginBottom:14 }}>
                  <div><label style={S.lbl}>Date</label><input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} style={S.inp}/></div>
                  <div>
                    <label style={S.lbl}>Product Type</label>
                    <select value={form.productType} onChange={e=>setForm(p=>({...p,productType:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                      {PRODUCT_TYPES.map(pt=><option key={pt} value={pt}>{pt}</option>)}
                    </select>
                  </div>
                  <div><label style={S.lbl}>Qty Received</label><input type="number" min="1" value={form.qty} onChange={e=>setForm(p=>({...p,qty:e.target.value}))} placeholder="e.g. 12" style={S.inp}/></div>
                  <div><label style={S.lbl}>Notes (optional)</label><input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. Special edition, damaged box..." style={S.inp}/></div>
                </div>
                <div style={{ display:"flex", gap:10 }}>
                  <Btn onClick={handleSave} disabled={!form.productType||!form.qty||!form.date} variant="green">💾 {editId?"Update":"Save"} Shipment</Btn>
                  <Btn onClick={cancelForm} variant="ghost">Cancel</Btn>
                </div>
              </div>
            )
          }
        </>
      )}

      {/* Shipment history */}
      <div style={S.card}>
        <SectionLabel t="Shipment History" />
        {shipments.length === 0
          ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"30px 0" }}>No shipments yet — add one above</div>
          : (
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>{["Date","Product","Qty","Notes",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {shipments.map((s,i) => {
                  const pc = PT_COLORS[s.productType] || { bg:"#F3F4F6", text:"#6B7280" };
                  return (
                    <tr key={s.id} style={{ background:"#111111" }}>
                      <td style={S.td}>{s.date}</td>
                      <td style={S.td}><span style={{ background:pc.bg, color:pc.text, borderRadius:5, padding:"2px 9px", fontSize:11, fontWeight:700 }}>{s.productType}</span></td>
                      <td style={{ ...S.td, fontWeight:700, color:"#E8317A", fontSize:15 }}>+{s.qty}</td>
                      <td style={{ ...S.td, color:"#AAAAAA" }}>{s.notes||"—"}</td>
                      <td style={S.td}>
                        {canEdit && (
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={()=>openEdit(s)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>✏️</button>
                            <button onClick={()=>{ if(window.confirm("Delete this shipment?")) onDeleteShipment(s.id); }} style={{ background:"none", border:"1px solid #FCA5A5", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"#E8317A" }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        }
      </div>

      {/* Usage log */}
      <div style={S.card}>
        <SectionLabel t="Usage Log (from Streams)" />
        {productUsage.length === 0
          ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"20px 0" }}>No product usage logged yet</div>
          : <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>{["Date","Breaker",...PRODUCT_TYPES,""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
              <tbody>
                {productUsage.map((u,i) => (
                  <tr key={u.id} style={{ background:"#111111" }}>
                    <td style={S.td}>{u.date}</td>
                    <td style={S.td}><Badge bg={BC[u.breaker]?.bg||"#F3F4F6"} color={BC[u.breaker]?.text||"#6B7280"}>{u.breaker}</Badge></td>
                    {PRODUCT_TYPES.map(pt => (
                      <td key={pt} style={{ ...S.td, color:(parseInt(u[pt])||0)>0?"#991b1b":"#D1D5DB", fontWeight:(parseInt(u[pt])||0)>0?700:400 }}>
                        {(parseInt(u[pt])||0)>0 ? `-${u[pt]}` : "—"}
                      </td>
                    ))}
                    <td style={S.td}>
                      {canEdit && onDeleteProductUsage && (
                        <button
                          onClick={()=>{ if(window.confirm("Delete this usage entry? Stock will be restored.")) onDeleteProductUsage(u.id); }}
                          style={{ background:"none", border:"1px solid #FCA5A5", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                        >🗑</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        }
      </div>
    </div>
  );
}

// ─── CUSTOMERS CRM ──────────────────────────────────────────────
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
          <button onClick={()=>setSelectedSeller(null)} style={{ background:"#111111", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>← Back</button>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:"#F0F0F0" }}>{s.name}</div>
            <div style={{ fontSize:12, color:"#AAAAAA", marginTop:2 }}>
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
            { l:"Total Cards",   v:totalCards,   c:"#F0F0F0" },
            { l:"Available",     v:availCount,   c:"#166534" },
            ...(canSeeFinancials ? [{ l:"Total Spent", v:`$${totalSpent.toFixed(2)}`, c:"#6B2D8B" }] : []),
          ].map(({l,v,c}) => (
            <div key={l} className="stat-card" style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:24, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
              <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>

        {/* Details row */}
        <div style={S.card}>
          <SectionLabel t="Customer Details" />
          <div style={{ display:"flex", gap:24, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:"#AAAAAA" }}>Primary Source: <strong style={{color:"#F0F0F0"}}>{s.topSource}</strong></span>
            <span style={{ fontSize:13, color:"#AAAAAA" }}>Preferred Payment: <strong style={{color:"#F0F0F0"}}>{s.topPayment}</strong></span>
            <span style={{ fontSize:13, color:"#AAAAAA" }}>Cards Used: <strong style={{color:"#E8317A"}}>{usedCount}</strong></span>
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
                <div key={i} style={{ background:"#111111", border:"1px solid #2a2a2a", borderRadius:10, padding:"14px 18px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div>
                      <span style={{ fontWeight:700, fontSize:14, color:"#F0F0F0" }}>Lot #{s.lotCount - i}</span>
                      <span style={{ color:"#AAAAAA", fontSize:12, marginLeft:10 }}>{lot.date}</span>
                    </div>
                    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>{lot.source}</span>
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>{lot.payment}</span>
                      {canSeeFinancials && <span style={{ fontWeight:700, color:"#E8317A", fontSize:13 }}>${lot.lotPaid.toFixed(2)}</span>}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
                    <span style={{ fontSize:12, color:"#AAAAAA" }}>Cards: <strong style={{color:"#F0F0F0"}}>{lot.cards.length}</strong></span>
                    <span style={{ fontSize:12, color:"#AAAAAA" }}>Available: <strong style={{color:"#E8317A"}}>{lotAvail}</strong></span>
                    <span style={{ fontSize:12, color:"#AAAAAA" }}>Used: <strong style={{color:"#E8317A"}}>{lotUsed}</strong></span>
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
          <span style={{ fontSize:12, color:"#AAAAAA" }}>{filtered.length} customers</span>
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
                  className="card-hover" style={{ ...S.card, cursor:"pointer", display:"flex", alignItems:"center", gap:16, transition:"box-shadow 0.15s" }}
                  className="inv-row fade-in"
                >
                  {/* Rank */}
                  <div style={{ width:32, height:32, borderRadius:"50%", background: rank<=3?"#1A1A2E":"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:rank<=3?"#E8317A":"#9CA3AF", flexShrink:0 }}>
                    {rank}
                  </div>

                  {/* Name + meta */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:15, color:"#F0F0F0", marginBottom:3 }}>{s.name}</div>
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      {s.topSource !== "—" && <span style={{ fontSize:11, color:srcColor, fontWeight:700 }}>{s.topSource}</span>}
                      {s.topPayment !== "—" && <span style={{ fontSize:11, color:"#AAAAAA" }}>{s.topPayment}</span>}
                      <span style={{ fontSize:11, color:"#AAAAAA" }}>Last: {s.lastDate ? new Date(s.lastDate).toLocaleDateString() : "—"}</span>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display:"flex", gap:20, alignItems:"center", flexShrink:0 }}>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:900, color:"#F0F0F0" }}>{s.lotCount}</div>
                      <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>Lots</div>
                    </div>
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:18, fontWeight:900, color:"#F0F0F0" }}>{s.cards}</div>
                      <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>Cards</div>
                    </div>
                    {canSeeFinancials && (
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:900, color:"#E8317A" }}>${s.spent.toFixed(0)}</div>
                        <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>Spent</div>
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

// ─── STREAMS (wrapper: recap + cards + commission) ───────────────
function Streams({ inventory, breaks, onAdd, onBulkAdd, onDeleteBreak, user, userRole, streams=[], onSaveStream, onDeleteStream, productUsage=[], onSaveProductUsage, shipments=[], skuPrices={}, historicalData=[], onSavePayStub, onUpsertBuyers }) {
  const isAdmin    = ["Admin"].includes(userRole?.role);
  const isShipping = userRole?.role === "Shipping";
  const ALL_STREAM_TABS = [
    { id:"recap",      label:"📋 Stream Recap", roles:["Admin","Streamer","Procurement"] },
    { id:"cards",      label:"🃏 Log Cards",    roles:["Admin","Streamer","Procurement","Shipping"] },
    { id:"commission", label:"💵 Commission",   roles:["Admin","Streamer","Procurement"] },
  ];
  const STREAM_TABS = ALL_STREAM_TABS.filter(t => t.roles.includes(userRole?.role));
  const [streamTab, setStreamTab] = useState(isShipping ? "cards" : "recap");

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Sub-tab bar */}
      <div style={{ display:"flex", gap:6 }}>
        {STREAM_TABS.map(t => (
          <button key={t.id} onClick={()=>setStreamTab(t.id)}
            style={{ background:streamTab===t.id?"#1A1A2E":"transparent", color:streamTab===t.id?"#E8317A":"#9CA3AF", border:`1.5px solid ${streamTab===t.id?"#E8317A":"#E5E7EB"}`, borderRadius:8, padding:"7px 18px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {streamTab === "recap"      && <BreakLog      inventory={inventory} breaks={breaks} onAdd={onAdd} onBulkAdd={onBulkAdd} onDeleteBreak={onDeleteBreak} user={user} userRole={userRole} streams={streams} onSaveStream={onSaveStream} onDeleteStream={onDeleteStream} productUsage={productUsage} onSaveProductUsage={onSaveProductUsage} shipments={shipments} recapOnly={true} skuPrices={skuPrices} onUpsertBuyers={onUpsertBuyers}/>}
      {streamTab === "cards"      && <BreakLog      inventory={inventory} breaks={breaks} onAdd={onAdd} onBulkAdd={onBulkAdd} onDeleteBreak={onDeleteBreak} user={user} userRole={userRole} streams={streams} onSaveStream={onSaveStream} productUsage={productUsage} onSaveProductUsage={onSaveProductUsage} shipments={shipments} cardsOnly={true}/>}
      {streamTab === "commission" && <Commission    streams={streams} onSave={onSaveStream} onDelete={onDeleteStream} user={user} userRole={userRole} historicalData={historicalData} onSavePayStub={onSavePayStub}/>}
    </div>
  );
}

// ─── COMMISSION ──────────────────────────────────────────────────
function Commission({ streams, onSave, onDelete, user, userRole, historicalData=[], onSavePayStub }) {
  const isAdmin    = ["Admin"].includes(userRole?.role);
  const curUser    = user?.displayName?.split(" ")[0] || "";
  const myBreaker  = BREAKERS.find(b => curUser.toLowerCase().includes(b.toLowerCase()));

  const EMPTY = { date:"", breaker:"", breakType:"auction", grossRevenue:"", whatnotFees:"", coupons:"", whatnotPromo:"", magpros:"", packagingMaterial:"", topLoaders:"", chaserCards:"", chaserCardIds:"", marketMultiple:"", newBuyers:"", binOnly:false, notes:"" };
  const [form,      setForm]      = useState(EMPTY);
  const [editing,   setEditing]   = useState(null);
  const [viewStream,setViewStream]= useState(null);
  const [importing, setImporting] = useState(false);
  const [csvError,  setCsvError]  = useState("");
  const [showStub,  setShowStub]  = useState(false);
  const [stubBreaker, setStubBreaker] = useState("");
  const [stubPeriod,  setStubPeriod]  = useState("week");
  const [stubFrom,    setStubFrom]    = useState("");
  const [stubTo,      setStubTo]      = useState("");

  // Commission rate from comp plan
  function getCommRate(stream) {
    if (stream.commissionOverride !== "" && stream.commissionOverride != null) return parseFloat(stream.commissionOverride)/100;
    if (stream.binOnly) return 0.35;
    const mm = parseFloat(stream.marketMultiple) || 0;
    if (mm >= 1.8) return 0.55;
    if (mm >= 1.7) return 0.50;
    if (mm >= 1.6) return 0.45;
    if (mm >= 1.5) return 0.40;
    return 0.35;
  }

  function calcStreamDash(s) {
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
    const streamExp = coupons+promo+magpros+pack+topload+chaser;
    const repExp   = streamExp * 0.135;
    const imcExpReimb = streamExp * 0.70;
    const commBase = bazNet - repExp;
    const rate     = getCommRate(s);
    const commAmt  = commBase * rate;
    return { gross, totalExp, netRev, bazNet, bobaNet, repExp, imcExpReimb, commBase, rate, commAmt, bazTrueNet: bazNet - repExp - commAmt + imcExpReimb };
  }

  // Admins see all streams; streamers see only their own
  const CEO_NAMES = ["Dev","Devin","Derrik"];
  const isCEO = CEO_NAMES.some(n => curUser.toLowerCase().includes(n.toLowerCase()));
  const visibleStreams = isAdmin
    ? streams
    : streams.filter(s => s.breaker === myBreaker);

  // Period filter — available to everyone
  const [period,        setPeriod]        = useState("all");
  const [customFrom,    setCustomFrom]    = useState("");
  const [customTo,      setCustomTo]      = useState("");
  const [breakerFilter, setBreakerFilter] = useState("all");

  function inPeriod(dateStr) {
    const d   = new Date(dateStr);
    const now = new Date();
    if (period === "week") {
      const start = new Date(now);
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0,0,0,0);
      return d >= start;
    }
    if (period === "month")   return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    if (period === "quarter") {
      const q = Math.floor(now.getMonth()/3);
      return Math.floor(d.getMonth()/3)===q && d.getFullYear()===now.getFullYear();
    }
    if (period === "year")    return d.getFullYear()===now.getFullYear();
    if (period === "custom" && customFrom && customTo) {
      const from = new Date(customFrom); from.setHours(0,0,0,0);
      const to   = new Date(customTo);   to.setHours(23,59,59,999);
      return d >= from && d <= to;
    }
    return true; // "all"
  }

  const periodFiltered = visibleStreams.filter(s => inPeriod(s.date));
  const filteredStreams = isAdmin && breakerFilter !== "all"
    ? periodFiltered.filter(s => s.breaker === breakerFilter)
    : periodFiltered;

  // Aggregates
  const totals = filteredStreams.reduce((acc, s) => {
    const c = calcStreamDash(s);
    acc.gross    += c.gross;
    acc.net      += c.netRev;
    acc.baz      += c.bazNet;
    acc.comm     += c.commAmt;
    acc.trueNet  += c.bazTrueNet||0;
    acc.reimb    += c.imcExpReimb||0;
    acc.newBuyers += parseInt(s.newBuyers)||0;
    return acc;
  }, { gross:0, net:0, baz:0, comm:0, trueNet:0, reimb:0, newBuyers:0 });

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
    const c = calcStreamDash(s);
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
          <button onClick={()=>setViewStream(null)} style={{ background:"#111111", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>← Back</button>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:"#F0F0F0" }}>{new Date(s.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            <div style={{ fontSize:12, color:"#AAAAAA", marginTop:2, display:"flex", gap:10 }}>
              <Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge>
              <span>{s.binOnly ? "BIN Break (flat 35%)" : `${s.breakType} · ${(c.rate*100).toFixed(0)}% commission`}</span>
              {s.newBuyers>0 && <span style={{ background:"#111111", color:"#E8317A", borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>🌱 {s.newBuyers} new buyers</span>}
            </div>
          </div>

        </div>

        {/* Revenue waterfall */}
        <div style={S.card}>
          <SectionLabel t="Stream Revenue Breakdown" />
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"#111111", borderRadius:8 }}>
              <span style={{ fontWeight:700, color:"#F0F0F0", fontSize:14 }}>Gross Revenue</span>
              <span style={{ fontWeight:900, color:"#E8317A", fontSize:16 }}>{fmt(c.gross)}</span>
            </div>
            {/* Platform fees — excluded from rep 13.5% */}
            {parseFloat(s.whatnotFees) > 0 && (
              <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", background:"#111111", borderRadius:7, border:"1px solid #2a2a2a" }}>
                <span style={{ color:"#AAAAAA", fontSize:13 }}>− Whatnot Fees <span style={{ fontSize:10, color:"#AAAAAA", marginLeft:6 }}>(platform cost — not included in rep expenses)</span></span>
                <span style={{ color:"#AAAAAA", fontWeight:700, fontSize:13 }}>${(parseFloat(s.whatnotFees)||0).toFixed(2)}</span>
              </div>
            )}
            {/* Supply/stream expenses — included in rep 13.5% */}
            {EXPENSE_ROWS.filter(r=>r.l !== "Whatnot Fees" && r.v>0).length > 0 && (
              <div style={{ fontSize:10, color:"#AAAAAA", fontWeight:700, textTransform:"uppercase", letterSpacing:1, padding:"4px 2px" }}>Stream Expenses (rep pays 13.5% of these)</div>
            )}
            {EXPENSE_ROWS.filter(r=>r.l !== "Whatnot Fees" && r.v>0).map(({l,v}) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", background:"#111111", borderRadius:7, border:"1px solid #FEE2E2" }}>
                <span style={{ color:"#AAAAAA", fontSize:13 }}>− {l}</span>
                <span style={{ color:"#E8317A", fontWeight:700, fontSize:13 }}>${v.toFixed(2)}</span>
              </div>
            ))}
            <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 14px", background:"#111111", borderRadius:7 }}>
              <span style={{ fontWeight:700, color:"#E8317A", fontSize:13 }}>Total Expenses</span>
              <span style={{ fontWeight:900, color:"#E8317A", fontSize:13 }}>${c.totalExp.toFixed(2)}</span>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"#111111", borderRadius:8, border:"2px solid #1B4F8A22" }}>
              <span style={{ fontWeight:800, color:"#F0F0F0", fontSize:14 }}>Net Revenue</span>
              <span style={{ fontWeight:900, color:"#F0F0F0", fontSize:16 }}>{fmt(c.netRev)}</span>
            </div>
          </div>
        </div>

        {/* Split — Admin only */}
        {isAdmin && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          <div style={S.card}>
            <SectionLabel t="Gross Revenue" />
            <div style={{ fontSize:28, fontWeight:900, color:"#F0F0F0" }}>{fmt(c.gross)}</div>
          </div>
          <div style={S.card}>
            <SectionLabel t="Owed to Imagination Mining (70%)" />
            <div style={{ fontSize:28, fontWeight:900, color:"#E8317A" }}>{fmt(c.imcNet)}</div>
          </div>
          <div style={S.card}>
            <SectionLabel t="Bazooka Earnings (30%)" />
            <div style={{ fontSize:28, fontWeight:900, color:"#E8317A" }}>{fmt(c.bazNet)}</div>
          </div>
        </div>
        )}

        {/* Commission calc */}
        <div style={{ ...S.card, border:"2px solid #166534" }}>
          <SectionLabel t={`${s.breaker}'s Commission`} />
          <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:16 }}>
            {[
              { l:"Bazooka Earnings",               v:fmt(c.bazNet),         c:"#E8317A" },
              { l:"Rep Expenses (13.5%)",           v:"− "+fmt(c.repExp),    c:"#991b1b" },
              ...(isAdmin ? [{ l:"IMC Expense Reimb (70%)", v:"+ "+fmt(c.imcExpReimb||0), c:"#166534" }] : []),
              { l:"Commission Base",                v:fmt(c.commBase),       c:"#1B4F8A" },
              { l:`Rate (${(c.rate*100).toFixed(0)}%${s.binOnly?" — BIN flat":s.marketMultiple?" — "+s.marketMultiple+"x":""})`, v:`× ${(c.rate*100).toFixed(0)}%`, c:"#6B7280" },
            ].map(({l,v,c:clr}) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 12px", borderBottom:"1px solid #333333" }}>
                <span style={{ fontSize:13, color:"#AAAAAA" }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:clr }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"#0a1a0a", border:"1px solid rgba(22,101,52,0.4)", borderRadius:10, marginBottom:10 }} className="save-flash">
            <span style={{ fontWeight:800, fontSize:16, color:"#4ade80" }}>💵 Commission Earned</span>
            <span style={{ fontWeight:900, fontSize:28, color:"#4ade80" }}>{fmt(c.commAmt)}</span>
          </div>
          {isAdmin && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"#111111", borderRadius:10 }}>
            <span style={{ fontWeight:800, fontSize:16, color:"#E8317A" }}>🏦 Bazooka True Net</span>
            <span style={{ fontWeight:900, fontSize:28, color:"#E8317A" }}>{fmt(c.bazTrueNet)}</span>
          </div>
          )}
          {s.marketMultiple && !s.binOnly && (
            <div style={{ marginTop:10, fontSize:12, color:"#AAAAAA", textAlign:"right" }}>Market multiple: {s.marketMultiple}x → {(c.rate*100).toFixed(0)}% rate</div>
          )}
          {s.notes && <div style={{ marginTop:10, padding:"8px 12px", background:"#111111", borderRadius:7, fontSize:12, color:"#AAAAAA", fontStyle:"italic" }}>{s.notes}</div>}
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
          <button onClick={cancelEdit} style={{ background:"#111111", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>← Cancel</button>
          <div style={{ fontSize:16, fontWeight:800, color:"#F0F0F0" }}>{editing==="new"?"New Stream":"Edit Stream"}</div>
          {importing && (
            <label style={{ background:"#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              📂 Select Whatnot CSV
              <input type="file" accept=".csv" onChange={handleCSV} style={{ display:"none" }}/>
            </label>
          )}
          <Btn onClick={()=>setImporting(p=>!p)} variant="ghost">{importing?"Cancel Import":"📂 Import CSV"}</Btn>
        </div>
        {csvError && <div style={{ padding:"10px 14px", background:"#111111", borderRadius:8, color:"#E8317A", fontSize:13 }}>{csvError}</div>}

        {/* Stream info */}
        <div style={S.card}>
          <SectionLabel t="Stream Info" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
            <div><label style={S.lbl}>Date</label><input type="date" value={form.date} onChange={e=>f("date")(e.target.value)} style={S.inp}/></div>
            <div>
              <label style={S.lbl}>Breaker</label>
              <select value={form.breaker} onChange={e=>f("breaker")(e.target.value)} style={{ ...S.inp, cursor:"pointer", color:form.breaker?"#F0F0F0":"#9CA3AF" }}>
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
                <span style={{ fontSize:12, color:"#AAAAAA" }}>Override to flat 35%</span>
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
                <div key={l} style={{ textAlign:"center", background:"#111111", borderRadius:8, padding:"10px 8px" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
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

      {/* ── PAY STUB GENERATOR ── */}
      {isAdmin && (
        <div style={{ ...S.card, border:"2px solid rgba(232,49,122,0.3)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showStub?14:0 }}>
            <div style={{ fontSize:10, fontWeight:800, color:"#E8317A", textTransform:"uppercase", letterSpacing:2.5, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:14, height:2, background:"#E8317A", borderRadius:1 }}/>
              💵 Pay Stub Generator
            </div>
            <button onClick={()=>setShowStub(p=>!p)} style={{ background:"transparent", border:"1.5px solid #E8317A", color:"#E8317A", borderRadius:7, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {showStub ? "▲ Hide" : "▼ Generate"}
            </button>
          </div>
          {showStub && (() => {
            // Build stub data
            const now = new Date();
            function getWeekStart(d) {
              const day = d.getDay();
              const diff = day === 0 ? 6 : day - 1;
              const s = new Date(d); s.setDate(d.getDate()-diff); s.setHours(0,0,0,0);
              return s;
            }
            const weekStart = getWeekStart(now);
            const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+6); weekEnd.setHours(23,59,59,999);

            function inStubPeriod(dateStr) {
              const d = new Date(dateStr);
              if (stubPeriod === "week") return d >= weekStart && d <= weekEnd;
              if (stubPeriod === "custom" && stubFrom && stubTo) {
                const f = new Date(stubFrom); f.setHours(0,0,0,0);
                const t = new Date(stubTo);   t.setHours(23,59,59,999);
                return d >= f && d <= t;
              }
              return false;
            }

            const targetBreaker = stubBreaker || (isAdmin ? BREAKERS[0] : myBreaker);
            const stubStreams = streams.filter(s => s.breaker === targetBreaker && inStubPeriod(s.date));

            function calcS(s) {
              const gross=parseFloat(s.grossRevenue)||0, fees=parseFloat(s.whatnotFees)||0, coupons=parseFloat(s.coupons)||0, promo=parseFloat(s.whatnotPromo)||0, magpros=parseFloat(s.magpros)||0, pack=parseFloat(s.packagingMaterial)||0, topload=parseFloat(s.topLoaders)||0, chaser=parseFloat(s.chaserCards)||0;
              const totalExp=fees+coupons+promo+magpros+pack+topload+chaser, netRev=gross-totalExp, bazNet=netRev*0.30;
              const streamExp=coupons+promo+magpros+pack+topload+chaser, repExp=streamExp*0.135, imcExpReimb=streamExp*0.70;
              const mm=parseFloat(s.marketMultiple)||0, overrideRate=s.commissionOverride!==""&&s.commissionOverride!=null?parseFloat(s.commissionOverride)/100:null;
              const rate=overrideRate!==null?overrideRate:s.binOnly?0.35:mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
              const commAmt=(bazNet-repExp)*rate;
              const bazTrueNet=bazNet-repExp-commAmt+imcExpReimb;
              return { gross, totalExp, netRev, bazNet, repExp, imcExpReimb, commAmt, bazTrueNet, rate };
            }

            const totals = stubStreams.reduce((acc,s)=>{ const c=calcS(s); acc.gross+=c.gross; acc.baz+=c.bazNet; acc.comm+=c.commAmt; acc.reimb+=c.imcExpReimb; acc.trueNet+=c.bazTrueNet; return acc; }, {gross:0,baz:0,comm:0,reimb:0,trueNet:0});
            const periodLabel = stubPeriod==="week"
              ? `${weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})} – ${weekEnd.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`
              : stubFrom && stubTo ? `${stubFrom} – ${stubTo}` : "Select dates";

            function printStub() {
              const w = window.open("","_blank","width=800,height=900");
              const bc = BC[targetBreaker]||{text:"#E8317A"};
              const streamRows = stubStreams.map(s => {
                const c = calcS(s);
                return isAdmin ? `
                  <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px 12px;font-size:13px;">${new Date(s.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</td>
                    <td style="padding:10px 12px;font-size:13px;">${s.breakType||"Auction"}${s.binOnly?" (BIN)":""}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;">${fmt(c.gross)}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;">${fmt(c.bazNet)}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;color:#991b1b;">${fmt(c.repExp)}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;">${(c.rate*100).toFixed(0)}%</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;color:#991b1b;">-${fmt(c.commAmt)}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;color:#166534;">+${fmt(c.imcExpReimb)}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:700;color:#166534;">${fmt(c.bazTrueNet)}</td>
                  </tr>` : `
                  <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px 12px;font-size:13px;">${new Date(s.date).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</td>
                    <td style="padding:10px 12px;font-size:13px;">${s.breakType||"Auction"}${s.binOnly?" (BIN)":""}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;">${fmt(c.gross)}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;">${fmt(c.bazNet)}</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;">${(c.rate*100).toFixed(0)}%</td>
                    <td style="padding:10px 12px;font-size:13px;text-align:right;font-weight:700;color:#166534;">${fmt(c.commAmt)}</td>
                  </tr>`;
              }).join("");

              w.document.write(`<!DOCTYPE html><html><head><title>Bazooka Pay Stub — ${targetBreaker}</title>
                <style>
                  * { box-sizing:border-box; margin:0; padding:0; font-family:'Trebuchet MS',sans-serif; }
                  body { background:#fff; color:#111; padding:40px; }
                  @media print { body { padding:20px; } .no-print { display:none; } }
                  .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:3px solid #E8317A; }
                  .logo { font-size:28px; font-weight:900; letter-spacing:3px; color:#E8317A; }
                  .sub { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:2px; margin-top:4px; }
                  .meta { text-align:right; }
                  .meta div { font-size:13px; color:#444; margin-bottom:4px; }
                  .meta strong { color:#111; }
                  .breaker-badge { display:inline-block; background:#f0f0f0; border-radius:20px; padding:4px 16px; font-size:14px; font-weight:700; color:#333; margin-bottom:20px; }
                  table { width:100%; border-collapse:collapse; margin-bottom:24px; }
                  thead tr { background:#111; color:#E8317A; }
                  thead th { padding:10px 12px; font-size:10px; text-transform:uppercase; letter-spacing:1px; text-align:left; }
                  thead th:nth-child(n+3) { text-align:right; }
                  tbody tr:nth-child(even) { background:#fafafa; }
                  .totals { background:#f8f8f8; border:2px solid #E8317A22; border-radius:12px; padding:20px 24px; margin-bottom:24px; }
                  .totals-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; }
                  .tot-item { text-align:center; }
                  .tot-val { font-size:22px; font-weight:900; }
                  .tot-lbl { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-top:4px; }
                  .payout { background:#111; color:#fff; border-radius:12px; padding:20px 28px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; }
                  .payout-label { font-size:16px; font-weight:700; color:#4ade80; }
                  .payout-amt { font-size:32px; font-weight:900; color:#4ade80; }
                  .footer { text-align:center; font-size:11px; color:#aaa; border-top:1px solid #eee; padding-top:16px; }
                  .print-btn { background:#E8317A; color:#fff; border:none; border-radius:8px; padding:10px 24px; font-size:14px; font-weight:700; cursor:pointer; margin-bottom:24px; }
                </style></head><body>
                <button class="no-print print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
                <div class="header">
                  <div>
                    <div class="logo">BAZOOKA</div>
                    <div class="sub">Commission Pay Stub</div>
                  </div>
                  <div class="meta">
                    <div>Pay Period: <strong>${periodLabel}</strong></div>
                    <div>Generated: <strong>${now.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"})}</strong></div>
                    <div>Streams: <strong>${stubStreams.length}</strong></div>
                  </div>
                </div>
                <div class="breaker-badge">🎯 ${targetBreaker}</div>
                ${stubStreams.length === 0 ? '<p style="color:#888;text-align:center;padding:40px 0;">No streams found for this period.</p>' : `
                <table>
                  <thead><tr>
                    ${isAdmin
                      ? `<th>Date</th><th>Type</th><th style="text-align:right">Gross</th><th style="text-align:right">Bazooka Net</th><th style="text-align:right">Rep Exp</th><th style="text-align:right">Rate</th><th style="text-align:right">− Commission</th><th style="text-align:right">+ IMC Reimb</th><th style="text-align:right">True Net</th>`
                      : `<th>Date</th><th>Type</th><th style="text-align:right">Gross</th><th style="text-align:right">Bazooka Net</th><th style="text-align:right">Rate</th><th style="text-align:right">Commission</th>`
                    }
                  </tr></thead>
                  <tbody>${streamRows}</tbody>
                </table>
                <div class="totals">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:14px;">Period Summary</div>
                  <div class="totals-grid" style="grid-template-columns:${isAdmin?"repeat(5,1fr)":"repeat(3,1fr)"}">
                    <div class="tot-item"><div class="tot-val" style="color:#E8317A;">${fmt(totals.gross)}</div><div class="tot-lbl">Total Gross</div></div>
                    <div class="tot-item"><div class="tot-val" style="color:#1B4F8A;">${fmt(totals.baz)}</div><div class="tot-lbl">Bazooka Net (30%)</div></div>
                    ${isAdmin ? `
                    <div class="tot-item"><div class="tot-val" style="color:#991b1b;">-${fmt(totals.comm)}</div><div class="tot-lbl">Commission Paid</div></div>
                    <div class="tot-item"><div class="tot-val" style="color:#166534;">+${fmt(totals.reimb)}</div><div class="tot-lbl">IMC Reimb</div></div>
                    <div class="tot-item"><div class="tot-val" style="color:#166534;">${fmt(totals.trueNet)}</div><div class="tot-lbl">Bazooka True Net</div></div>
                    ` : `
                    <div class="tot-item"><div class="tot-val" style="color:#166534;">${fmt(totals.comm)}</div><div class="tot-lbl">Total Commission</div></div>
                    `}
                  </div>
                </div>
                <div class="payout">
                  <div class="payout-label">💵 Commission Earned This Period</div>
                  <div class="payout-amt">${fmt(totals.comm)}</div>
                </div>`}
                <div class="footer">Bazooka Breaks, LLC &nbsp;·&nbsp; This document is confidential and intended for the named recipient only.</div>
              </body></html>`);
              w.document.close();
            }

            return (
              <div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:12, marginBottom:16, alignItems:"end" }}>
                  <div>
                    <label style={S.lbl}>Breaker</label>
                    <select value={stubBreaker||targetBreaker} onChange={e=>setStubBreaker(e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
                      {BREAKERS.map(b=><option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.lbl}>Period</label>
                    <select value={stubPeriod} onChange={e=>setStubPeriod(e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
                      <option value="week">This Week (Mon–Sun)</option>
                      <option value="custom">Custom Range</option>
                    </select>
                  </div>
                  {stubPeriod==="custom" && <>
                    <div>
                      <label style={S.lbl}>From</label>
                      <input type="date" value={stubFrom} onChange={e=>setStubFrom(e.target.value)} style={S.inp}/>
                    </div>
                    <div>
                      <label style={S.lbl}>To</label>
                      <input type="date" value={stubTo} onChange={e=>setStubTo(e.target.value)} style={S.inp}/>
                    </div>
                  </>}
                  <Btn onClick={()=>{
                    printStub();
                    if (onSavePayStub) onSavePayStub({
                      breaker: targetBreaker,
                      period: periodLabel,
                      periodType: stubPeriod,
                      streamCount: stubStreams.length,
                      totalGross: totals.gross,
                      totalNet: totals.net,
                      totalComm: totals.comm,
                      streams: stubStreams.map(s=>{ const c=calcS(s); return { date:s.date, breakType:s.breakType||"Auction", binOnly:s.binOnly, gross:c.gross, bazNet:c.bazNet, repExp:c.repExp, rate:c.rate, commAmt:c.commAmt }; }),
                    });
                  }} variant="green">🖨 Generate PDF</Btn>
                </div>
                {/* Preview */}
                <div style={{ background:"#0a0a0a", border:"1px solid #2a2a2a", borderRadius:10, padding:"16px 20px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                    <div>
                      <span style={{ fontWeight:800, color:"#E8317A", fontSize:14 }}>{targetBreaker}</span>
                      <span style={{ color:"#666", fontSize:12, marginLeft:10 }}>{periodLabel}</span>
                    </div>
                    <span style={{ fontSize:12, color:"#666" }}>{stubStreams.length} stream{stubStreams.length!==1?"s":""}</span>
                  </div>
                  {stubStreams.length === 0
                    ? <div style={{ color:"#555", fontSize:12, padding:"12px 0" }}>No streams found for this period.</div>
                    : <>
                        <div style={{ display:"grid", gridTemplateColumns:`repeat(${isAdmin?5:3},1fr)`, gap:10, marginBottom:12 }}>
                          {[
                            { l:"Gross Revenue",        v:fmt(totals.gross),   c:"#E8317A" },
                            { l:"Bazooka Net (30%)",    v:fmt(totals.baz),     c:"#1B4F8A" },
                            ...(isAdmin ? [
                              { l:"− Commission",       v:fmt(totals.comm),    c:"#991b1b" },
                              { l:"+ IMC Reimb",        v:fmt(totals.reimb),   c:"#166534" },
                              { l:"Bazooka True Net",   v:fmt(totals.trueNet), c:"#4ade80" },
                            ] : [
                              { l:"Commission",         v:fmt(totals.comm),    c:"#4ade80" },
                            ]),
                          ].map(({l,v,c})=>(
                            <div key={l} style={{ textAlign:"center", background:"#111111", borderRadius:8, padding:"10px" }}>
                              <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                              <div style={{ fontSize:9, color:"#666", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
                            </div>
                          ))}
                        </div>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                          <thead><tr>
                            {["Date","Type","Gross","Baz Net",...(isAdmin?["Rep Exp","IMC Reimb","True Net"]:["Rate","Commission"])].map(h=><th key={h} style={{ ...S.th, fontSize:9, padding:"6px 10px" }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {stubStreams.map((s,i)=>{
                              const c=calcS(s);
                              return <tr key={s.id} style={{ background:i%2===0?"#111111":"#0d0d0d" }}>
                                <td style={{ ...S.td, padding:"6px 10px" }}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                                <td style={{ ...S.td, padding:"6px 10px", color:"#888" }}>{s.breakType||"Auction"}{s.binOnly?" BIN":""}</td>
                                <td style={{ ...S.td, padding:"6px 10px", color:"#E8317A", fontWeight:700 }}>{fmt(c.gross)}</td>
                                <td style={{ ...S.td, padding:"6px 10px", color:"#1B4F8A", fontWeight:700 }}>{fmt(c.bazNet)}</td>
                                {isAdmin ? <>
                                  <td style={{ ...S.td, padding:"6px 10px", color:"#991b1b" }}>{fmt(c.repExp)}</td>
                                  <td style={{ ...S.td, padding:"6px 10px", color:"#166534" }}>+{fmt(c.imcExpReimb)}</td>
                                  <td style={{ ...S.td, padding:"6px 10px", color:"#4ade80", fontWeight:900 }}>{fmt(c.bazTrueNet)}</td>
                                </> : <>
                                  <td style={{ ...S.td, padding:"6px 10px", color:"#888" }}>{(c.rate*100).toFixed(0)}%</td>
                                  <td style={{ ...S.td, padding:"6px 10px", color:"#4ade80", fontWeight:900 }}>{fmt(c.commAmt)}</td>
                                </>}
                              </tr>;
                            })}
                          </tbody>
                        </table>
                      </>
                  }
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Period filter */}
      <div style={{ ...S.card, padding:"12px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginRight:4 }}>Period:</span>
          {[["all","All Time"],["week","This Week"],["month","This Month"],["quarter","This Quarter"],["year","This Year"],["custom","Custom"]].map(([val,label]) => (
            <button key={val} onClick={()=>{ setPeriod(val); setViewStream(null); }}
              style={{ background:period===val?"#1A1A2E":"transparent", color:period===val?"#E8317A":"#9CA3AF", border:`1.5px solid ${period===val?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"5px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {label}
            </button>
          ))}
          {period==="custom" && (
            <>
              <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} style={{ ...S.inp, width:140, fontSize:11, padding:"4px 8px" }}/>
              <span style={{ fontSize:11, color:"#AAAAAA" }}>to</span>
              <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)} style={{ ...S.inp, width:140, fontSize:11, padding:"4px 8px" }}/>
            </>
          )}
          <span style={{ marginLeft:"auto", fontSize:11, color:"#AAAAAA" }}>{filteredStreams.length} stream{filteredStreams.length!==1?"s":""}</span>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:"grid", gridTemplateColumns:`repeat(${isAdmin?5:3},1fr)`, gap:12 }}>
        {[
          { l:"Total Streams",     v:filteredStreams.length,          c:"#F0F0F0" },
          { l:"Total Commission",  v:fmt(totals.comm),    c:"#166534" },
          { l:"🌱 New Buyers",     v:totals.newBuyers,                c:"#166534" },
          ...(isAdmin ? [
            { l:"Total Gross",     v:fmt(totals.gross),   c:"#E8317A" },
            { l:"Bazooka Net",     v:fmt(totals.baz),     c:"#6B2D8B" },
          ] : []),
        ].map(({l,v,c}) => (
          <div key={l} className="stat-card" style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:26, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
          </div>
        ))}
      </div>



      {/* Breaker filter — admin only */}
      {isAdmin && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["all", ...BREAKERS].map(b => (
            <button key={b} onClick={()=>{ setBreakerFilter(b); setViewStream(null); setEditing(null); }}
              style={{ background:breakerFilter===b?"#1A1A2E":"transparent", color:breakerFilter===b?"#E8317A":"#9CA3AF", border:`1.5px solid ${breakerFilter===b?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {b === "all" ? "👥 All Breakers" : b}
              {b !== "all" && <span style={{ marginLeft:6, background:"#111111", color:"#E8317A", borderRadius:10, padding:"0 6px", fontSize:10 }}>
                {visibleStreams.filter(s=>s.breaker===b).length}
              </span>}
            </button>
          ))}
        </div>
      )}

      {/* Stream list */}
      {filteredStreams.length === 0
        ? <div style={{ ...S.card, textAlign:"center", padding:"60px" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>💵</div>
            <div style={{ color:"#AAAAAA" }}>{visibleStreams.length === 0 ? "No streams logged yet. Stream recaps are entered in the Break Log tab." : `No streams for ${breakerFilter} yet.`}</div>
          </div>
        : filteredStreams.map(s => {
            const c    = calcStreamDash(s);
            const bc   = BC[s.breaker] || { bg:"#EEF0FB", text:"#2C3E7A", border:"#3730a3" };
            return (
              <div key={s.id} onClick={()=>setViewStream(s.id)} className="inv-row fade-in" className="card-hover" style={{ ...S.card, cursor:"pointer", display:"grid", gridTemplateColumns:"140px 1fr auto", gap:16, alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:13, color:"#F0F0F0" }}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</div>
                  <Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge>
                </div>
                <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                  <span style={{ fontSize:12, color:"#AAAAAA" }}>Gross: <strong style={{color:"#F0F0F0"}}>{fmt(c.gross)}</strong></span>
                  <span style={{ fontSize:12, color:"#AAAAAA" }}>Net: <strong style={{color:"#F0F0F0"}}>{fmt(c.netRev)}</strong></span>
                  {isAdmin && <span style={{ fontSize:12, color:"#AAAAAA" }}>Bazooka: <strong style={{color:"#E8317A"}}>{fmt(c.bazNet)}</strong></span>}
                  <span style={{ fontSize:12, color:"#AAAAAA" }}>Rate: <strong style={{color:"#AAAAAA"}}>{(c.rate*100).toFixed(0)}%{s.binOnly?" (BIN)":s.marketMultiple?" ("+s.marketMultiple+"x)":""}</strong></span>
                  {s.newBuyers>0 && <span style={{ fontSize:12, color:"#E8317A", fontWeight:700 }}>🌱 {s.newBuyers} new</span>}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:"#E8317A" }}>{fmt(c.commAmt)}</div>
                    <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>Commission</div>
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

// ─── PUBLIC QUOTE PAGE (no auth required) ────────────────────
function PublicQuote({ quoteId }) {
  const [quote,       setQuote]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [expired,     setExpired]     = useState(false);
  const [notFound,    setNotFound]    = useState(false);
  const [selPayment,  setSelPayment]  = useState("");
  const [selHandle,   setSelHandle]   = useState("");
  const [counterAmt,  setCounterAmt]  = useState("");
  const [view,        setView]        = useState("quote"); // quote | accept | counter | done
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "quotes", quoteId), snap => {
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      const data = snap.data();
      const created = new Date(data.createdAt);
      if ((new Date() - created) > 7 * 24 * 60 * 60 * 1000) { setExpired(true); setLoading(false); return; }
      setQuote(data);
      setLoading(false);
    });
    return unsub;
  }, [quoteId]);

  const pageStyle = { minHeight:"100vh", background:"#000000", color:"#F0F0F0", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", padding:"40px 20px", display:"flex", justifyContent:"center" };
  const cardStyle = { background:"#111111", border:"1px solid #2a2a2a", borderRadius:16, overflow:"hidden", maxWidth:680, width:"100%" };

  if (loading) return <div style={{...pageStyle,alignItems:"center"}}><div style={{color:"#E8317A",fontSize:18,fontWeight:700}}>Loading your quote...</div></div>;
  if (notFound) return <div style={{...pageStyle,alignItems:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>🔍</div><div style={{fontSize:22,fontWeight:800,color:"#E8317A",marginBottom:8}}>Quote Not Found</div><div style={{color:"#888",fontSize:14}}>This link may be invalid or has been removed.</div></div></div>;
  if (expired)  return <div style={{...pageStyle,alignItems:"center"}}><div style={{textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>⏰</div><div style={{fontSize:22,fontWeight:800,color:"#E8317A",marginBottom:8}}>Quote Expired</div><div style={{color:"#888",fontSize:14}}>This offer was valid for 7 days and has expired.</div><div style={{color:"#888",fontSize:14,marginTop:8}}>Please contact Bazooka for a fresh quote.</div></div></div>;

  const { seller, cards=[], dispOffer=0, custNote, payment:bzPayment, paymentHandle:bzHandle, createdAt, status="pending", history=[], currentOffer } = quote;
  const activeOffer = currentOffer || dispOffer;
  const totalCards = cards.reduce((s,c)=>s+(parseInt(c.qty)||1),0);
  const totalMkt   = cards.reduce((s,c)=>s+(parseFloat(c.mktVal)||0)*(parseInt(c.qty)||1),0);
  const expiresAt  = new Date(new Date(createdAt).getTime()+7*24*60*60*1000);
  const daysLeft   = Math.max(0,Math.ceil((expiresAt-new Date())/86400000));
  const isClosed   = ["accepted","declined","closed"].includes(status);

  const PAYMENT_METHODS = ["Venmo","PayPal","Zelle","Cash App","Cash","Check","Other"];
  const PCFG = {
    Venmo:    { color:"#3D95CE", href:(h,a)=>`venmo://paycharge?txn=pay&recipients=${h.replace(/^@/,"")}&amount=${a}&note=${encodeURIComponent("Bazooka card purchase")}`, webHref:(h)=>`https://venmo.com/${h.replace(/^@/,"")}` },
    PayPal:   { color:"#003087", href:(h,a)=>`https://www.paypal.com/paypalme/${h.replace(/^@/,"")}${a?"/"+a:""}` },
    Zelle:    { color:"#6D1ED4", href:null },
    "Cash App":{ color:"#00C244",href:(h,a)=>`https://cash.app/$${h.replace(/^@/,"")}${a?"/"+a:""}` },
    Cash:     { color:"#166534", href:null },
    Other:    { color:"#888888", href:null },
  };

  async function submitResponse(type) {
    setSubmitting(true);
    setSubmitError("");
    try {
      const now = new Date().toISOString();
      const entry = { type, timestamp: now };
      if (type === "accepted") {
        if (!selPayment) { setSubmitError("Please select a payment method."); setSubmitting(false); return; }
        entry.paymentMethod = selPayment;
        entry.paymentHandle = selHandle;
        await setDoc(doc(db,"quotes",quoteId), {
          status:"accepted",
          sellerPayment: selPayment,
          sellerHandle:  selHandle,
          acceptedAt:    now,
          history:       [...history, entry],
          notified:      false,
        }, { merge:true });
      } else if (type === "declined") {
        await setDoc(doc(db,"quotes",quoteId), {
          status:"declined", declinedAt:now,
          history:[...history,entry], notified:false,
        }, { merge:true });
      } else if (type === "countered") {
        const amt = parseFloat(counterAmt);
        if (!amt || amt <= 0) { setSubmitError("Please enter a valid counter offer amount."); setSubmitting(false); return; }
        entry.counterAmount = amt;
        await setDoc(doc(db,"quotes",quoteId), {
          status:"countered", currentOffer:amt,
          sellerCounter:amt, counteredAt:now,
          history:[...history,entry], notified:false,
        }, { merge:true });
      }
      setView("done");
    } catch(e) { setSubmitError("Something went wrong. Please try again."); }
    setSubmitting(false);
  }

  // ── DONE STATE ──────────────────────────────────────────────
  if (view === "done" || isClosed) {
    const msgs = {
      accepted: { icon:"🎉", title:"Offer Accepted!", color:"#4ade80", body:"Bazooka will reach out to confirm details. Ship your cards to the address below once confirmed." },
      declined: { icon:"👋", title:"Offer Declined", color:"#E8317A", body:"No worries — feel free to reach out if you change your mind." },
      countered:{ icon:"🤝", title:"Counter Offer Sent!", color:"#FBBF24", body:"Bazooka has been notified of your counter. They'll respond shortly on this same link — check back soon." },
      closed:   { icon:"🔒", title:"Quote Closed", color:"#888", body:"This quote has been closed by Bazooka." },
    };
    const m = msgs[status] || msgs.countered;
    return (
      <div style={{...pageStyle,alignItems:"center"}}>
        <div style={{...cardStyle,padding:"48px 40px",textAlign:"center"}}>
          <div style={{fontSize:48,marginBottom:16}}>{m.icon}</div>
          <div style={{fontSize:24,fontWeight:900,color:m.color,marginBottom:12}}>{m.title}</div>
          <div style={{fontSize:14,color:"#888",lineHeight:1.7,marginBottom:24}}>{m.body}</div>
          {status==="accepted" && (
            <div style={{background:"#0d0d0d",border:"1px solid #2a2a2a",borderRadius:10,padding:"16px",textAlign:"left"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>📦 Ship Cards To</div>
              <div style={{fontSize:13,color:"#F0F0F0",fontWeight:700,lineHeight:2}}>
                Devin — Bazooka<br/>425 Prosperity Dr<br/>Warsaw, IN 46582
              </div>
            </div>
          )}
          {status==="countered" && (
            <div style={{background:"#1a1400",border:"1px solid #FBBF2433",borderRadius:10,padding:"14px 18px"}}>
              <div style={{fontSize:12,color:"#888"}}>Your counter offer: <strong style={{color:"#FBBF24",fontSize:16}}>${parseFloat(quote.sellerCounter||0).toFixed(2)}</strong></div>
              <div style={{fontSize:11,color:"#666",marginTop:6}}>Original offer: ${parseFloat(dispOffer).toFixed(2)}</div>
            </div>
          )}
          <div style={{marginTop:20,fontSize:11,color:"#555"}}>
            {status==="countered" ? "This page will update when Bazooka responds." : "Thank you for working with Bazooka!"}
          </div>
        </div>
      </div>
    );
  }

  // ── ACCEPT VIEW ─────────────────────────────────────────────
  if (view === "accept") {
    const pcfg = PCFG[selPayment];
    const handle = selHandle.trim();
    const cleanHandle = handle.replace(/^@/,"");
    const amt = activeOffer > 0 ? activeOffer.toFixed(2) : "";
    return (
      <div style={pageStyle}>
        <div style={{...cardStyle,padding:"32px"}}>
          <button onClick={()=>setView("quote")} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:13,marginBottom:20,fontFamily:"inherit"}}>← Back to offer</button>
          <div style={{fontSize:22,fontWeight:900,color:"#4ade80",marginBottom:6}}>✅ Accept Offer</div>
          <div style={{fontSize:13,color:"#888",marginBottom:24}}>You're accepting Bazooka's offer of <strong style={{color:"#4ade80"}}>${parseFloat(activeOffer).toFixed(2)}</strong>. Choose how you'd like to be paid:</div>

          <div style={{marginBottom:16}}>
            <label style={{fontSize:10,fontWeight:700,color:"#777",textTransform:"uppercase",letterSpacing:1.5,display:"block",marginBottom:8}}>Payment Method</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {PAYMENT_METHODS.map(m=>(
                <button key={m} onClick={()=>{setSelPayment(m);setSelHandle("");}} style={{background:selPayment===m?"#1a1a1a":"transparent",border:`1.5px solid ${selPayment===m?"#E8317A":"#333"}`,color:selPayment===m?"#E8317A":"#888",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{m}</button>
              ))}
            </div>
          </div>

          {selPayment && !["Cash","Check","Other"].includes(selPayment) && (
            <div style={{marginBottom:16}}>
              <label style={{fontSize:10,fontWeight:700,color:"#777",textTransform:"uppercase",letterSpacing:1.5,display:"block",marginBottom:8}}>
                {selPayment==="Venmo"?"Your Venmo Handle (e.g. @username)":selPayment==="PayPal"?"Your PayPal Username or Email":selPayment==="Zelle"?"Your Zelle Email or Phone":selPayment==="Cash App"?"Your Cash App $tag":"Your Info"}
              </label>
              <input
                value={selHandle}
                onChange={e=>setSelHandle(e.target.value)}
                placeholder={selPayment==="Venmo"?"@yourhandle":selPayment==="PayPal"?"email or username":selPayment==="Zelle"?"email or phone number":"$yourtag"}
                style={{background:"#1a1a1a",border:"1px solid #333",borderRadius:8,padding:"10px 14px",color:"#F0F0F0",fontSize:14,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"}}
              />
            </div>
          )}

          {selPayment==="Cash" && <div style={{marginBottom:16,padding:"12px 16px",background:"#0a1a0a",border:"1px solid #4ade8033",borderRadius:8,fontSize:13,color:"#4ade80"}}>💵 Bazooka will pay you cash upon receiving the cards.</div>}
          {selPayment==="Check" && <div style={{marginBottom:16,padding:"12px 16px",background:"#0a0f1a",border:"1px solid #7B9CFF33",borderRadius:8,fontSize:13,color:"#7B9CFF"}}>📬 Bazooka will mail you a check. Please include your mailing address in the notes.</div>}

          {/* Live payment preview */}
          {selPayment && pcfg && handle && !["Cash","Check","Other"].includes(selPayment) && (
            <div style={{marginBottom:16,padding:"14px 16px",background:"#0d0d0d",border:`1.5px solid ${pcfg.color}44`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
              <div>
                <div style={{fontSize:11,color:"#666",marginBottom:4}}>Bazooka will send payment to:</div>
                <div style={{fontWeight:700,fontSize:15,color:pcfg.color}}>{handle}</div>
                <div style={{fontSize:12,color:"#888",marginTop:2}}>Amount: <strong style={{color:"#F0F0F0"}}>${amt}</strong></div>
              </div>
              {pcfg.href && (
                <a href={pcfg.href(cleanHandle,amt)} style={{background:pcfg.color,color:"#fff",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,textDecoration:"none"}}>
                  Open {selPayment} →
                </a>
              )}
            </div>
          )}

          {submitError && <div style={{marginBottom:12,padding:"10px 14px",background:"#1a0a0a",border:"1px solid #E8317A44",borderRadius:8,color:"#E8317A",fontSize:13}}>{submitError}</div>}

          <button
            onClick={()=>submitResponse("accepted")}
            disabled={submitting||!selPayment}
            style={{width:"100%",background:submitting||!selPayment?"#333":"#166534",color:submitting||!selPayment?"#666":"#fff",border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:800,cursor:submitting||!selPayment?"not-allowed":"pointer",fontFamily:"inherit"}}
          >{submitting?"Submitting...":"✅ Confirm & Accept Offer"}</button>
        </div>
      </div>
    );
  }

  // ── COUNTER VIEW ────────────────────────────────────────────
  if (view === "counter") {
    return (
      <div style={pageStyle}>
        <div style={{...cardStyle,padding:"32px"}}>
          <button onClick={()=>setView("quote")} style={{background:"none",border:"none",color:"#888",cursor:"pointer",fontSize:13,marginBottom:20,fontFamily:"inherit"}}>← Back to offer</button>
          <div style={{fontSize:22,fontWeight:900,color:"#FBBF24",marginBottom:6}}>🤝 Make a Counter Offer</div>
          <div style={{fontSize:13,color:"#888",marginBottom:24}}>Bazooka offered <strong style={{color:"#E8317A"}}>${parseFloat(activeOffer).toFixed(2)}</strong>. What would you like to counter with?</div>

          <div style={{marginBottom:20}}>
            <label style={{fontSize:10,fontWeight:700,color:"#777",textTransform:"uppercase",letterSpacing:1.5,display:"block",marginBottom:8}}>Your Counter Offer ($)</label>
            <input
              type="number" step="0.01" min="0"
              value={counterAmt}
              onChange={e=>setCounterAmt(e.target.value)}
              placeholder={`More than $${parseFloat(activeOffer).toFixed(2)}`}
              style={{background:"#1a1a1a",border:"2px solid #FBBF2444",borderRadius:8,padding:"12px 16px",color:"#FBBF24",fontSize:20,fontWeight:900,fontFamily:"inherit",outline:"none",width:"100%",boxSizing:"border-box"}}
            />
          </div>

          {counterAmt && parseFloat(counterAmt) > 0 && (
            <div style={{marginBottom:20,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
              {[
                {l:"Bazooka Offer",v:`$${parseFloat(activeOffer).toFixed(2)}`,c:"#E8317A"},
                {l:"Your Counter",v:`$${parseFloat(counterAmt).toFixed(2)}`,c:"#FBBF24"},
                {l:"Difference",v:`$${Math.abs(parseFloat(counterAmt)-parseFloat(activeOffer)).toFixed(2)}`,c:"#888"},
              ].map(({l,v,c})=>(
                <div key={l} style={{textAlign:"center",background:"#0d0d0d",borderRadius:8,padding:"10px"}}>
                  <div style={{fontSize:16,fontWeight:900,color:c}}>{v}</div>
                  <div style={{fontSize:9,color:"#666",textTransform:"uppercase",letterSpacing:1,marginTop:3}}>{l}</div>
                </div>
              ))}
            </div>
          )}

          {submitError && <div style={{marginBottom:12,padding:"10px 14px",background:"#1a0a0a",border:"1px solid #E8317A44",borderRadius:8,color:"#E8317A",fontSize:13}}>{submitError}</div>}

          <button
            onClick={()=>submitResponse("countered")}
            disabled={submitting||!counterAmt||parseFloat(counterAmt)<=0}
            style={{width:"100%",background:submitting||!counterAmt?"#333":"#92400e",color:submitting||!counterAmt?"#666":"#FBBF24",border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:800,cursor:submitting||!counterAmt?"not-allowed":"pointer",fontFamily:"inherit"}}
          >{submitting?"Submitting...":"🤝 Send Counter Offer"}</button>
        </div>
      </div>
    );
  }

  // ── MAIN QUOTE VIEW ─────────────────────────────────────────
  const statusBanner = {
    countered: { bg:"#1a1400", border:"#FBBF2433", color:"#FBBF24", icon:"🤝", text:`You countered at $${parseFloat(quote.sellerCounter||0).toFixed(2)}. Waiting for Bazooka's response...` },
    accepted:  { bg:"#0a1a0a", border:"#4ade8033", color:"#4ade80", icon:"✅", text:"You've accepted this offer." },
    declined:  { bg:"#1a0a0a", border:"#E8317A33", color:"#E8317A", icon:"❌", text:"You've declined this offer." },
  }[status];

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#0a0a0a,#1a0a0f)",padding:"32px",textAlign:"center",borderBottom:"1px solid #2a2a2a"}}>
          <div style={{fontSize:36,fontWeight:900,color:"#E8317A",letterSpacing:4,marginBottom:6}}>BAZOOKA</div>
          <div style={{fontSize:11,color:"#888",textTransform:"uppercase",letterSpacing:3}}>Bo Jackson Battle Arena · Lot Purchase Offer</div>
          <div style={{marginTop:14,display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap"}}>
            <span style={{background:"#E8317A22",border:"1px solid #E8317A44",borderRadius:20,padding:"4px 14px",fontSize:12,color:"#E8317A"}}>⏰ {daysLeft} day{daysLeft!==1?"s":""} remaining</span>
            <span style={{background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:20,padding:"4px 14px",fontSize:12,color:"#888"}}>{cards.length} card{cards.length!==1?"s":""} · {totalCards} total qty</span>
          </div>
        </div>

        {/* Status banner if already responded */}
        {statusBanner && (
          <div style={{padding:"12px 20px",background:statusBanner.bg,border:`1px solid ${statusBanner.border}`,display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>{statusBanner.icon}</span>
            <span style={{fontSize:13,color:statusBanner.color,fontWeight:700}}>{statusBanner.text}</span>
          </div>
        )}

        {/* Seller info */}
        <div style={{padding:"14px 24px",borderBottom:"1px solid #222",display:"grid",gridTemplateColumns:"1fr 1fr",background:"#0d0d0d"}}>
          <div><span style={{color:"#666",fontSize:11}}>Prepared for: </span><strong style={{color:"#F0F0F0"}}>{seller?.name||"—"}</strong></div>
          <div style={{textAlign:"right"}}><span style={{color:"#666",fontSize:11}}>Date: </span><strong style={{color:"#F0F0F0"}}>{seller?.date||new Date(createdAt).toLocaleDateString()}</strong></div>
        </div>

        {/* Cards */}
        <div style={{padding:"16px 24px 0"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr>
              {["#","Card Name","Qty","Value/Card","Offer/Card"].map(h=><th key={h} style={{padding:"8px 10px",borderBottom:"2px solid #2a2a2a",color:"#E8317A",fontSize:10,fontWeight:700,textTransform:"uppercase",textAlign:"left"}}>{h}</th>)}
            </tr></thead>
            <tbody>
              {cards.length===0
                ? <tr><td colSpan={5} style={{padding:"24px",textAlign:"center",color:"#555"}}>No cards listed</td></tr>
                : cards.map((c,i)=>{
                    const mv=parseFloat(c.mktVal)||0;
                    const offerPerCard=totalMkt>0?(mv/totalMkt)*activeOffer:0;
                    return (
                      <tr key={i} style={{borderBottom:"1px solid #1a1a1a"}}>
                        <td style={{padding:"9px 10px",color:"#555",fontSize:11}}>{i+1}</td>
                        <td style={{padding:"9px 10px",fontWeight:700,color:"#F0F0F0"}}>{c.name}</td>
                        <td style={{padding:"9px 10px",color:"#888",textAlign:"center"}}>{parseInt(c.qty)||1}</td>
                        <td style={{padding:"9px 10px",color:"#888"}}>${mv.toFixed(2)}</td>
                        <td style={{padding:"9px 10px",color:"#4ade80",fontWeight:700}}>${offerPerCard.toFixed(2)}</td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        <div style={{padding:"16px 24px 24px"}}>
          {/* Notes */}
          {custNote?.trim() && (
            <div style={{marginBottom:16,padding:"12px 16px",background:"#0d0d0d",borderLeft:"3px solid #E8317A",borderRadius:8}}>
              <div style={{fontSize:10,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>Notes from Bazooka</div>
              <p style={{margin:0,fontSize:13,color:"#CCCCCC",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{custNote}</p>
            </div>
          )}

          {/* Offer */}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #222",marginBottom:8}}>
            <span style={{color:"#888",fontSize:13}}>Total Cards</span>
            <span style={{color:"#F0F0F0",fontWeight:700}}>{totalCards}</span>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"12px 0 20px",padding:"18px 20px",background:"#0a1a0a",border:"2px solid #4ade8033",borderRadius:12}}>
            <span style={{color:"#4ade80",fontWeight:800,fontSize:18}}>💰 Bazooka's Offer</span>
            <span style={{color:"#4ade80",fontWeight:900,fontSize:28}}>${parseFloat(activeOffer).toFixed(2)}</span>
          </div>

          {/* Ship to */}
          <div style={{marginBottom:16,padding:"14px 16px",background:"#0d0d0d",border:"1px solid #2a2a2a",borderRadius:10}}>
            <div style={{fontSize:10,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>📦 Ship Cards To</div>
            <div style={{fontSize:13,color:"#F0F0F0",fontWeight:700,lineHeight:2}}>
              Devin — Bazooka<br/>425 Prosperity Dr<br/>Warsaw, IN 46582
            </div>
          </div>

          {/* Negotiation history */}
          {history.length > 0 && (
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,fontWeight:700,color:"#666",textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>📋 Offer History</div>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {history.map((h,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 12px",background:"#0d0d0d",borderRadius:7,border:"1px solid #222"}}>
                    <span style={{fontSize:12,color:h.type==="countered"?"#FBBF24":h.type==="accepted"?"#4ade80":h.type==="declined"?"#E8317A":"#888",fontWeight:700}}>
                      {h.type==="countered"?`🤝 Counter: $${parseFloat(h.counterAmount).toFixed(2)}`:h.type==="accepted"?"✅ Accepted":h.type==="declined"?"❌ Declined":h.type==="bazooka_counter"?`🏢 Bazooka Counter: $${parseFloat(h.amount||0).toFixed(2)}`:"—"}
                    </span>
                    <span style={{fontSize:11,color:"#555"}}>{new Date(h.timestamp).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons — only show if not already responded */}
          {!isClosed && status !== "countered" && (
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <button onClick={()=>setView("accept")} style={{width:"100%",background:"#166534",color:"#fff",border:"none",borderRadius:10,padding:"14px",fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                ✅ Accept This Offer
              </button>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <button onClick={()=>setView("counter")} style={{background:"#1a1400",color:"#FBBF24",border:"1.5px solid #FBBF2444",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  🤝 Make Counter Offer
                </button>
                <button onClick={()=>submitResponse("declined")} disabled={submitting} style={{background:"#1a0a0a",color:"#E8317A",border:"1.5px solid #E8317A44",borderRadius:10,padding:"12px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                  ❌ Decline
                </button>
              </div>
            </div>
          )}

          {status==="countered" && !isClosed && (
            <div style={{textAlign:"center",padding:"16px",background:"#1a1400",border:"1px solid #FBBF2433",borderRadius:10,color:"#FBBF24",fontSize:13,fontWeight:700}}>
              🤝 Your counter of <strong>${parseFloat(quote.sellerCounter||0).toFixed(2)}</strong> is pending. Check back soon!
            </div>
          )}

          <div style={{marginTop:16,textAlign:"center",color:"#555",fontSize:11,fontStyle:"italic"}}>
            This offer expires {expiresAt.toLocaleDateString()}. Bazooka Breaks, LLC.
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── BUYERS CRM ──────────────────────────────────────────────
function BuyersCRM({ buyers=[], userRole }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [search,   setSearch]   = useState("");
  const [sortBy,   setSortBy]   = useState("spend");
  const [selected, setSelected] = useState(null);
  const [stateFilter, setStateFilter] = useState("");

  const US_STATES = [...new Set(buyers.map(b=>b.state).filter(Boolean))].sort();

  const filtered = buyers
    .filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.username?.toLowerCase().includes(q) || b.fullName?.toLowerCase().includes(q) || b.city?.toLowerCase().includes(q) || b.state?.toLowerCase().includes(q);
      const matchState = !stateFilter || b.state === stateFilter;
      return matchSearch && matchState;
    })
    .sort((a,b) => {
      if (sortBy==="orders")  return (b.orderCount||0)-(a.orderCount||0);
      if (sortBy==="recent")  return new Date(b.lastSeen||0)-new Date(a.lastSeen||0);
      if (sortBy==="new")     return new Date(b.firstSeen||0)-new Date(a.firstSeen||0);
      if (sortBy==="streams") return (b.streams?.length||0)-(a.streams?.length||0);
      return (b.totalSpend||0)-(a.totalSpend||0); // default spend
    });

  // Stats
  const totalBuyers  = buyers.length;
  const totalSpend   = buyers.reduce((s,b)=>s+(b.totalSpend||0),0);
  const totalOrders  = buyers.reduce((s,b)=>s+(b.orderCount||0),0);
  const newThisMonth = buyers.filter(b=>{ const d=new Date(b.firstSeen||0); const n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }).length;
  const stateGroups  = buyers.reduce((acc,b)=>{ if(b.state){acc[b.state]=(acc[b.state]||0)+1;} return acc; },{});
  const topStates    = Object.entries(stateGroups).sort((a,b)=>b[1]-a[1]).slice(0,5);

  // ── BUYER DETAIL ──────────────────────────────────────────
  if (selected) {
    const b = buyers.find(x=>x.id===selected);
    if (!b) { setSelected(null); return null; }
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={()=>setSelected(null)} style={{ background:"#1a1a1a", border:"1.5px solid #2a2a2a", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#888" }}>← Back</button>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:"#F0F0F0" }}>{b.fullName||b.username}</div>
            <div style={{ fontSize:12, color:"#888", marginTop:2, display:"flex", gap:10, alignItems:"center" }}>
              <span>@{b.username}</span>
              {b.city && b.state && <span>📍 {b.city}, {b.state} {b.zip}</span>}
              {b.isNew && <span style={{ background:"#0a1a0a", color:"#4ade80", border:"1px solid #4ade8033", borderRadius:20, padding:"1px 8px", fontSize:11, fontWeight:700 }}>🌱 New Buyer</span>}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
          {[
            { l:"Total Spend",   v:fmt(b.totalSpend||0),          c:"#E8317A" },
            { l:"Total Orders",  v:b.orderCount||0,               c:"#F0F0F0" },
            { l:"Streams",       v:(b.streams?.length||0),        c:"#7B9CFF" },
            { l:"Coupon Uses",   v:b.couponCount||0,              c:"#FBBF24" },
          ].map(({l,v,c})=>(
            <div key={l} style={{ ...S.card, textAlign:"center" }}>
              <div style={{ fontSize:24, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
              <div style={{ fontSize:10, color:"#777", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={S.card}>
          <SectionLabel t="Buyer Details" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <div>
              <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Whatnot Handle</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#E8317A" }}>@{b.username}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Full Name</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#F0F0F0" }}>{b.fullName||"—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Location</div>
              <div style={{ fontSize:14, color:"#F0F0F0" }}>{b.city&&b.state?`${b.city}, ${b.state} ${b.zip}`:"—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>First Seen</div>
              <div style={{ fontSize:14, color:"#F0F0F0" }}>{b.firstSeen ? new Date(b.firstSeen).toLocaleDateString() : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Last Purchase</div>
              <div style={{ fontSize:14, color:"#F0F0F0" }}>{b.lastSeen ? new Date(b.lastSeen).toLocaleDateString() : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize:11, color:"#666", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Avg Order Value</div>
              <div style={{ fontSize:14, fontWeight:700, color:"#E8317A" }}>{b.orderCount>0?fmt((b.totalSpend||0)/b.orderCount):"—"}</div>
            </div>
          </div>
        </div>

        {b.streams?.length > 0 && (
          <div style={S.card}>
            <SectionLabel t={`Streams (${b.streams.length})`} />
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {b.streams.map(s=>(
                <span key={s} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:7, padding:"4px 12px", fontSize:12, color:"#888" }}>{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── BUYER LIST ────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[
          { l:"Total Buyers",    v:totalBuyers,         c:"#F0F0F0" },
          { l:"🌱 New This Month", v:newThisMonth,      c:"#4ade80" },
          { l:"Total Orders",    v:totalOrders,         c:"#7B9CFF" },
          { l:"Total Spend",     v:fmt(totalSpend),     c:"#E8317A" },
        ].map(({l,v,c})=>(
          <div key={l} className="stat-card" style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:26, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
            <div style={{ fontSize:10, color:"#777", textTransform:"uppercase", letterSpacing:1 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Top states */}
      {topStates.length > 0 && (
        <div style={S.card}>
          <SectionLabel t="📍 Top States" />
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {topStates.map(([state,count])=>(
              <button key={state} onClick={()=>setStateFilter(stateFilter===state?"":state)} style={{ background:stateFilter===state?"#E8317A":"#1a1a1a", color:stateFilter===state?"#fff":"#F0F0F0", border:`1px solid ${stateFilter===state?"#E8317A":"#2a2a2a"}`, borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {state} <span style={{ opacity:0.7 }}>({count})</span>
              </button>
            ))}
            {stateFilter && <button onClick={()=>setStateFilter("")} style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:12, fontFamily:"inherit" }}>✕ Clear</button>}
          </div>
        </div>
      )}

      {/* Search + sort */}
      <div style={S.card}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, username, city..." style={{ ...S.inp, flex:1, minWidth:200 }}/>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {[["spend","💰 Top Spend"],["orders","📦 Most Orders"],["streams","🎯 Most Streams"],["recent","🕐 Recent"],["new","🌱 Newest"]].map(([val,label])=>(
              <button key={val} onClick={()=>setSortBy(val)} style={{ background:sortBy===val?"#1A1A2E":"transparent", color:sortBy===val?"#E8317A":"#888", border:`1.5px solid ${sortBy===val?"#E8317A":"#2a2a2a"}`, borderRadius:7, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{label}</button>
            ))}
          </div>
          <span style={{ fontSize:12, color:"#666" }}>{filtered.length} buyers</span>
        </div>
      </div>

      {/* Buyer list */}
      {filtered.length === 0
        ? <div style={{ ...S.card, textAlign:"center", padding:"60px", color:"#555" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>👥</div>
            <div>{buyers.length===0?"No buyers yet — upload a Whatnot CSV in Stream Recap to populate":"No buyers match your search"}</div>
          </div>
        : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {filtered.map((b,i)=>(
              <div key={b.id} onClick={()=>setSelected(b.id)} className="inv-row" style={{ ...S.card, cursor:"pointer", display:"grid", gridTemplateColumns:"36px 1fr auto", gap:16, alignItems:"center", padding:"14px 20px" }}>
                {/* Rank */}
                <div style={{ width:32, height:32, borderRadius:"50%", background:i<3?"#1A1A2E":"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:900, color:i<3?"#E8317A":"#555", flexShrink:0 }}>{i+1}</div>

                {/* Info */}
                <div style={{ minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                    <span style={{ fontWeight:800, fontSize:14, color:"#F0F0F0" }}>{b.fullName||b.username}</span>
                    <span style={{ fontSize:11, color:"#555" }}>@{b.username}</span>
                    {b.isNew && <span style={{ background:"#0a1a0a", color:"#4ade80", border:"1px solid #4ade8033", borderRadius:20, padding:"1px 7px", fontSize:10, fontWeight:700 }}>🌱 New</span>}
                  </div>
                  <div style={{ display:"flex", gap:12, flexWrap:"wrap" }}>
                    {b.city && b.state && <span style={{ fontSize:11, color:"#666" }}>📍 {b.city}, {b.state}</span>}
                    <span style={{ fontSize:11, color:"#666" }}>Last: {b.lastSeen?new Date(b.lastSeen).toLocaleDateString():"—"}</span>
                    {(b.streams?.length||0) > 0 && <span style={{ fontSize:11, color:"#7B9CFF" }}>🎯 {b.streams.length} stream{b.streams.length!==1?"s":""}</span>}
                    {(b.couponCount||0) > 0 && <span style={{ fontSize:11, color:"#FBBF24" }}>🎟 {b.couponCount} coupon{b.couponCount!==1?"s":""}</span>}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display:"flex", gap:20, alignItems:"center", flexShrink:0 }}>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:16, fontWeight:900, color:"#F0F0F0" }}>{b.orderCount||0}</div>
                    <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Orders</div>
                  </div>
                  {canSeeFinancials && (
                    <div style={{ textAlign:"center" }}>
                      <div style={{ fontSize:16, fontWeight:900, color:"#E8317A" }}>{fmt(b.totalSpend||0)}</div>
                      <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Spent</div>
                    </div>
                  )}
                  <span style={{ color:"#333", fontSize:18 }}>›</span>
                </div>
              </div>
            ))}
          </div>
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
  const [skuPrices,    setSkuPrices]     = useState({});
  const [historicalData, setHistoricalData] = useState([]);
  const [payStubs,       setPayStubs]       = useState([]);
  const [quotes,         setQuotes]         = useState([]);
  const [buyers,         setBuyers]         = useState([]);

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
    const u9  = onSnapshot(doc(db,"settings","sku_prices"), snap => { if(snap.exists()) setSkuPrices(snap.data()); });
    const u10 = onSnapshot(query(collection(db,"historical_data"), orderBy("yearMonth","asc")), snap => setHistoricalData(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u11 = onSnapshot(query(collection(db,"pay_stubs"), orderBy("createdAt","desc")), snap => setPayStubs(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u12 = onSnapshot(query(collection(db,"quotes"), orderBy("createdAt","desc")), snap => setQuotes(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u13 = onSnapshot(collection(db,"buyers"), snap => setBuyers(snap.docs.map(d=>({id:d.id,...d.data()}))));

    return () => { u1(); u2(); u3(); u4(); u5(); u6(); u7(); u8(); u9(); u10(); u11(); u12(); u13(); };
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
    // Also delete any product usage entries linked to this stream
    const linked = productUsage.filter(u => u.streamId === id);
    for (const u of linked) await deleteDoc(doc(db,"product_usage",u.id));
    showToast(`🗑 Stream deleted${linked.length > 0 ? " — product usage removed" : ""}`);
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
  async function handleSaveHistorical(entry) {
    const id = entry.id || entry.yearMonth;
    await setDoc(doc(db,"historical_data",id), { ...entry, id });
    showToast("📅 Historical data saved");
  }
  async function handleDeleteHistorical(id) {
    await deleteDoc(doc(db,"historical_data",id));
    showToast("🗑 Historical entry deleted");
  }
  async function handleSavePayStub(stub) {
    const id = uid();
    await setDoc(doc(db,"pay_stubs",id), { ...stub, id, createdAt:new Date().toISOString(), createdBy:user?.displayName||"Unknown", read:false });
    showToast(`💵 Pay stub sent to ${stub.breaker}`);
  }
  async function handleDismissPayStub(id) {
    await setDoc(doc(db,"pay_stubs",id), { read:true }, { merge:true });
  }
  async function handleSaveQuote(quoteData) {
    const id = uid();
    await setDoc(doc(db,"quotes",id), { ...quoteData, id, createdAt:new Date().toISOString() });
    return id;
  }
  async function handleDismissQuoteNotif(id) {
    await setDoc(doc(db,"quotes",id), { notified:true }, { merge:true });
  }
  async function handleUpsertBuyers(buyerRows, streamId) {
    // buyerRows: array of parsed buyer objects from CSV
    for (const b of buyerRows) {
      const existing = buyers.find(x => x.id === b.username);
      const prevStreams = existing?.streams || [];
      const prevSpend   = existing?.totalSpend || 0;
      const prevOrders  = existing?.orderCount || 0;
      const isNew       = !existing;
      await setDoc(doc(db,"buyers",b.username), {
        id:           b.username,
        username:     b.username,
        fullName:     b.fullName,
        city:         b.city,
        state:        b.state,
        zip:          b.zip,
        totalSpend:   prevSpend + b.spend,
        orderCount:   prevOrders + b.orders,
        streams:      prevStreams.includes(streamId) ? prevStreams : [...prevStreams, streamId],
        couponCount:  (existing?.couponCount||0) + b.couponCount,
        firstSeen:    existing?.firstSeen || b.date,
        lastSeen:     b.date,
        isNew:        isNew,
        updatedAt:    new Date().toISOString(),
      }, { merge:true });
    }
  }
  async function handleCloseQuote(id) {
    await setDoc(doc(db,"quotes",id), { status:"closed", closedAt:new Date().toISOString() }, { merge:true });
    showToast("🔒 Quote closed");
  }
  async function handleBazookaCounter(id, amount, currentHistory=[]) {
    const entry = { type:"bazooka_counter", amount, timestamp:new Date().toISOString() };
    await setDoc(doc(db,"quotes",id), { status:"pending", currentOffer:amount, notified:false, history:[...currentHistory, entry] }, { merge:true });
    showToast(`🤝 Counter sent: $${parseFloat(amount).toFixed(2)}`);
  }
  async function handleSaveSkuPrices(prices) {
    await setDoc(doc(db,"settings","sku_prices"), prices);
    showToast("💰 SKU prices saved");
  }
  async function handleSaveProductUsage(usage) {
    const id = usage.id || uid();
    await setDoc(doc(db,"product_usage",id), { ...usage, id, createdAt:new Date().toISOString(), createdBy:user?.displayName||"Unknown" });
    showToast("📋 Product usage logged");
  }
  async function handleDeleteProductUsage(id) {
    await deleteDoc(doc(db,"product_usage",id));
    showToast("🗑 Usage entry deleted — stock restored");
  }
  async function handleSaveCardCost(id, newCost) {
    const card = inventory.find(c => c.id === id);
    if (!card) return;
    await setDoc(doc(db,"inventory",id), { ...card, costPerCard:newCost, buyPct: card.marketValue>0 ? newCost/card.marketValue : null }, { merge:true });
    showToast("💰 Card cost updated");
  }

  async function handleDeleteLot(lotKey, cardIds) {
    if (!window.confirm(`Delete this entire lot (${cardIds.length} card${cardIds.length!==1?"s":""})? This cannot be undone.`)) return;
    for (const id of cardIds) await deleteDoc(doc(db,"inventory",id));
    await deleteDoc(doc(db,"lot_tracking",lotKey)).catch(()=>{});
    await deleteDoc(doc(db,"lot_notes",lotKey)).catch(()=>{});
    showToast(`🗑 Lot deleted — ${cardIds.length} card${cardIds.length!==1?"s":""} removed`);
  }

  const realRole = getUserRole(user);
  const [viewAs,  setViewAs]  = useState(null);
  const userRole    = viewAs ? viewAs : realRole;
  const effectiveUser = viewAs ? { ...user, displayName: viewAs.displayName } : user;
  const TABS = [
    { id:"dashboard",   label:"📊 Dashboard"   },
    { id:"comp",        label:"🧮 Lot Comp"     },
    { id:"inventory",   label:"📦 Inventory"    },
    { id:"streams",     label:"🎯 Streams"      },
    { id:"buyers",      label:"👥 Buyers"       },
    { id:"performance", label:"📈 Performance"  },
  ];

  if (!authReady) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#111111", fontFamily:"'Trebuchet MS',sans-serif", fontSize:18, fontWeight:700, color:"#E8317A" }}>Loading...</div>;

  // ── PUBLIC QUOTE ROUTE (no login required) ──
  const quoteMatch = window.location.pathname.match(/^\/quote\/([a-zA-Z0-9]+)$/);
  if (quoteMatch) return <PublicQuote quoteId={quoteMatch[1]} />;

  if (!user) return <LoginScreen />;

  return (
    <div style={{ background:"#000000", minHeight:"100vh", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", color:"#F0F0F0" }}>
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
        const getStatus = c => usedIds.has(c.id) ? { l:"Used", bg:"#FEE2E2", c:"#991b1b" } : c.cardStatus==="in_transit" ? { l:"In Transit", bg:"#EEF0FB", c:"#7B9CFF" } : { l:"Available", bg:"#0a1a0a", c:"#4ade80" };
        return (
          <div style={{ position:"fixed", inset:0, zIndex:999, display:"flex", flexDirection:"column" }}>
            {/* Backdrop */}
            <div onClick={()=>{ setGOpen(false); setGSearch(""); }} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(2px)" }}/>
            {/* Panel */}
            <div style={{ position:"relative", zIndex:1000, margin:"60px auto 0", width:"100%", maxWidth:720, background:"#111111", borderRadius:14, boxShadow:"0 20px 60px rgba(0,0,0,0.8)", border:"1px solid #2a2a2a", overflow:"hidden" }}>
              {/* Search input */}
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"16px 20px", borderBottom:"1px solid #222" }}>
                <span style={{ fontSize:18, color:"#E8317A" }}>🔍</span>
                <input
                  autoFocus
                  value={gSearch}
                  onChange={e=>setGSearch(e.target.value)}
                  placeholder="Search cards, sellers, types, sources..."
                  style={{ flex:1, background:"none", border:"none", outline:"none", color:"#F0F0F0", fontSize:16, fontFamily:"inherit" }}
                />
                {gSearch && <button onClick={()=>setGSearch("")} style={{ background:"none", border:"none", color:"#888888", cursor:"pointer", fontSize:18 }}>✕</button>}
                <kbd style={{ background:"#222", color:"#666", border:"1px solid #444", borderRadius:5, padding:"2px 8px", fontSize:11 }}>esc</kbd>
              </div>

              {/* Results */}
              <div style={{ maxHeight:500, overflowY:"auto" }}>
                {q.length < 2
                  ? <div style={{ padding:"40px 20px", textAlign:"center", color:"#AAAAAA", fontSize:13 }}>Type at least 2 characters to search</div>
                  : results.length === 0
                    ? <div style={{ padding:"40px 20px", textAlign:"center", color:"#AAAAAA", fontSize:13 }}>No cards found for "{gSearch}"</div>
                    : <>
                        <div style={{ padding:"8px 20px", fontSize:11, color:"#999999", borderBottom:"1px solid #1a1a1a" }}>{results.length} result{results.length!==1?"s":""}</div>
                        {results.map((c,i) => {
                          const st = getStatus(c);
                          const cc = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                          return (
                            <div key={c.id} style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:12, padding:"12px 20px", borderBottom:"1px solid #1a1a1a", background:i%2===0?"#111111":"#161616" }}>
                              <div>
                                <div style={{ fontWeight:700, color:"#F0F0F0", fontSize:14, marginBottom:4 }}>{c.cardName||"—"}</div>
                                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                                  {c.cardType && <span style={{ background:cc.bg, color:cc.text, borderRadius:4, padding:"1px 7px", fontSize:11, fontWeight:700 }}>{c.cardType}</span>}
                                  {c.seller && <span style={{ fontSize:11, color:"#888" }}>from <strong style={{color:"#AAAAAA"}}>{c.seller}</strong></span>}
                                  {c.source && <span style={{ fontSize:11, color:"#666" }}>{c.source}</span>}
                                  {c.date && <span style={{ fontSize:11, color:"#999999" }}>{c.date}</span>}
                                </div>
                              </div>
                              <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                                <span style={{ background:st.bg, color:st.c, borderRadius:5, padding:"2px 9px", fontSize:11, fontWeight:700 }}>{st.l}</span>
                                {c.marketValue > 0 && <span style={{ fontSize:11, color:"#AAAAAA" }}>${c.marketValue.toFixed(2)}</span>}
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
            <span style={{ fontSize:10, color:"#999999", borderLeft:"1px solid #333333", paddingLeft:10, textTransform:"uppercase", letterSpacing:1 }}>Dashboard</span>
          </div>
          <nav style={{ display:"flex", gap:2, flex:1 }}>
            {TABS.map(t => {
              const pendingQuotes = t.id==="comp" ? quotes.filter(q=>!q.notified&&["accepted","declined","countered"].includes(q.status)).length : 0;
              return (
                <button key={t.id} onClick={()=>setTab(t.id)} className="nav-tab" style={{ background:tab===t.id?"#1a1a2e":"transparent", border:"none", color:tab===t.id?"#E8317A":"#888888", padding:"10px 14px", borderRadius:7, cursor:"pointer", fontSize:12, fontWeight:tab===t.id?700:400, fontFamily:"inherit", borderBottom:tab===t.id?"2px solid #E8317A":"2px solid transparent", position:"relative" }}>
                  {t.label}
                  {pendingQuotes > 0 && <span style={{ position:"absolute", top:4, right:4, background:"#E8317A", color:"#fff", borderRadius:"50%", width:16, height:16, fontSize:9, fontWeight:900, display:"flex", alignItems:"center", justifyContent:"center" }}>{pendingQuotes}</span>}
                </button>
              );
            })}
          </nav>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
            {/* Search button */}
            <button
              onClick={()=>{ setGOpen(true); setGSearch(""); }}
              style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1a2e", border:"1px solid #2a2a2a", borderRadius:8, padding:"5px 12px", cursor:"pointer", fontFamily:"inherit", color:"#888" }}
            >
              <span style={{ fontSize:13 }}>🔍</span>
              <span style={{ fontSize:12 }}>Search</span>
              <kbd style={{ background:"#111", color:"#999999", border:"1px solid #2a2a2a", borderRadius:4, padding:"1px 5px", fontSize:10 }}>/</kbd>
            </button>
            <span style={{ color:"#AAAAAA", fontSize:11 }}>{inventory.length} cards</span>
            {realRole.role === "Admin" && (
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"#1a1a2e", border:`1.5px solid ${viewAs?"#f59e0b":"#333"}`, borderRadius:8, padding:"3px 10px" }}>
                <span style={{ fontSize:10, color: viewAs?"#f59e0b":"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>{viewAs?"👁 Viewing as":"View As"}</span>
                <select
                  value={viewAs?.key||""}
                  onChange={e=>{
                    if (!e.target.value) { setViewAs(null); return; }
                    const ROLE_MAP = {
                      Admin:       { role:"Admin",       label:"CEO (Devin)",    key:"Admin",       displayName:user.displayName },
                      Dev:         { role:"Streamer",    label:"Dev",            key:"Dev",         displayName:"Dev" },
                      Dre:         { role:"Streamer",    label:"Dre",            key:"Dre",         displayName:"Dre" },
                      Krystal:     { role:"Streamer",    label:"Krystal",        key:"Krystal",     displayName:"Krystal" },
                      Procurement: { role:"Procurement", label:"Procurement",    key:"Procurement", displayName:"John" },
                      Shipping:    { role:"Shipping",    label:"Shipping",       key:"Shipping",    displayName:"Jake" },
                    };
                    setViewAs(ROLE_MAP[e.target.value]);
                    setTab("dashboard");
                  }}
                  style={{ background:"none", border:"none", color: viewAs?"#f59e0b":"#888", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", outline:"none" }}
                >
                  <option value="">— Real Role —</option>
                  <optgroup label="Streamers">
                    <option value="Dev">Dev</option>
                    <option value="Dre">Dre</option>
                    <option value="Krystal">Krystal</option>
                  </optgroup>
                  <optgroup label="Other Roles">
                    <option value="Procurement">Procurement (John)</option>
                    <option value="Shipping">Shipping (Jake)</option>
                  </optgroup>
                </select>
              </div>
            )}
            {user.photoURL && <img src={user.photoURL} alt="" style={{ width:28, height:28, borderRadius:"50%", border:"2px solid #E8317A" }}/>}
            <span style={{ color:"#AAAAAA", fontSize:11 }}>{user.displayName?.split(" ")[0]}</span>
            <span style={{ background:"#1a1a2e", color:"#E8317A", border:"1px solid #E8317A44", borderRadius:10, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{userRole.label}</span>
            <button onClick={()=>signOut(auth)} style={{ background:"transparent", border:"1px solid #444444", color:"#999999", borderRadius:6, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>Sign out</button>
          </div>
        </div>
      </div>

      {viewAs && (
        <div style={{ background:"#78350f", padding:"8px 20px", display:"flex", alignItems:"center", justifyContent:"center", gap:16 }}>
          <span style={{ fontSize:12, color:"#fef3c7", fontWeight:700 }}>👁 Previewing as <strong style={{color:"#f59e0b"}}>{viewAs.label}</strong> — this is exactly what they see</span>
          <button onClick={()=>{ setViewAs(null); }} style={{ background:"#f59e0b", color:"#78350f", border:"none", borderRadius:6, padding:"3px 12px", fontSize:11, fontWeight:900, cursor:"pointer", fontFamily:"inherit" }}>Exit Preview</button>
        </div>
      )}

      <div key={tab} className="tab-content" style={{ maxWidth:1200, margin:"0 auto", padding:"20px" }}>
        {tab==="dashboard"   && <Dashboard   inventory={inventory} breaks={breaks} user={effectiveUser} userRole={userRole} streams={streams} historicalData={historicalData} onSaveHistorical={handleSaveHistorical} onDeleteHistorical={handleDeleteHistorical} payStubs={payStubs} onDismissPayStub={handleDismissPayStub} quotes={quotes} onDismissQuoteNotif={handleDismissQuoteNotif}/>}
        {tab==="comp"        && (CAN_VIEW_LOT_COMP.includes(userRole.role) ? <LotComp onAccept={handleAccept} onSaveComp={handleSaveComp} onDeleteComp={handleDeleteComp} comps={comps} user={effectiveUser} userRole={userRole} onSaveQuote={handleSaveQuote} quotes={quotes} onCloseQuote={handleCloseQuote} onBazookaCounter={handleBazookaCounter}/> : <AccessDenied msg="Lot Comp is for Admin and Procurement only." />)}
        {tab==="inventory"   && <Inventory   inventory={inventory} breaks={breaks} onRemove={handleRemove} onBulkRemove={handleBulkRemove} onSaveCardCost={handleSaveCardCost} user={effectiveUser} userRole={userRole} lotTracking={lotTracking} onSaveLotTracking={handleSaveLotTracking} lotNotes={lotNotes} onSaveLotNotes={handleSaveLotNotes} onDeleteLot={handleDeleteLot} shipments={shipments} productUsage={productUsage} onSaveShipment={handleSaveShipment} onDeleteShipment={handleDeleteShipment} skuPrices={skuPrices} onSaveSkuPrices={handleSaveSkuPrices} onDeleteProductUsage={handleDeleteProductUsage}/>}
        {tab==="streams"     && (CAN_LOG_BREAKS.includes(userRole.role) ? <Streams inventory={inventory} breaks={breaks} onAdd={handleAddBreak} onBulkAdd={handleBulkAddBreak} onDeleteBreak={handleDeleteBreak} user={effectiveUser} userRole={userRole} streams={streams} onSaveStream={handleSaveStream} onDeleteStream={handleDeleteStream} productUsage={productUsage} onSaveProductUsage={handleSaveProductUsage} shipments={shipments} skuPrices={skuPrices} historicalData={historicalData} onSavePayStub={handleSavePayStub} onUpsertBuyers={handleUpsertBuyers}/> : <AccessDenied msg="Break Log access is restricted." />)}
        {tab==="buyers"      && <BuyersCRM buyers={buyers} userRole={userRole}/>}
        {tab==="performance" && <Performance breaks={breaks} user={effectiveUser} userRole={userRole} streams={streams}/>}
      </div>

      {toast && <div className="toast" style={{ position:"fixed", bottom:20, right:20, background:"#166534", color:"#ffffff", padding:"12px 18px", borderRadius:10, fontWeight:700, fontSize:13, boxShadow:"0 4px 24px rgba(0,0,0,0.2)", zIndex:999 }}>{toast}</div>}
    </div>
  );
}
