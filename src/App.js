/* eslint-disable */
import { useState, useEffect, useRef } from "react";
import { auth, db, googleProvider, storage } from "./firebase";
import { signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy, where, getDoc, getDocs, deleteField, arrayUnion, arrayRemove, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const CARD_TYPES = ["Giveaway Cards","Insurance Cards","First-Timer Cards","Chaser Cards"];
const POOL_TYPES  = ["Giveaway Cards","Insurance Cards"]; // bulk pools
const INDIV_TYPES = ["First-Timer Cards","Chaser Cards"];  // individual tracking
const BREAKERS = ["Dev","Dre","Krystal"];
const PRODUCT_TYPES = ["Double Mega","Hobby","Jumbo","Miscellaneous"];
const USAGE_TYPES = ["Giveaway","Insurance","First-Timer Pack","Chaser Pull"];
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
  "Giveaway Cards":   { monthly:2000, buffer:300 },
  "Insurance Cards":  { monthly:2000, buffer:300 },
  "First-Timer Cards":{ monthly:200,  buffer:50  },
  "Chaser Cards":     { monthly:150,  buffer:30  },
};
const CC = {
  "Giveaway Cards":   { bg:"#0a1a0f", text:"#4ade80",  border:"#2E7D52" },
  "Insurance Cards":  { bg:"#0a0f1a", text:"#7B9CFF",  border:"#3730a3" },
  "First-Timer Cards":{ bg:"#1a0810", text:"#F472B6",  border:"#9d174d" },
  "Chaser Cards":     { bg:"#2a1520", text:"#E8317A",  border:"#E8317A" },
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
const fmt = n => isNaN(n) || n === "" || n === null ? "--" : "$" + parseFloat(n).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });

// -- useCountUp hook -- animates numbers from 0 to target ----------
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
  if (pct < 0.65)  return { label:"\uD83D\uDFE2 Green",  color:"#E8317A", bg:"#D6F4E3" };
  if (pct <= 0.70) return { label:"\uD83D\uDFE1 Yellow", color:"#AAAAAA", bg:"#FFF9DB" };
  return                   { label:"\uD83D\uDD34 Red",    color:"#E8317A", bg:"#FEE2E2" };
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
  if (!z) return <span style={{ color:"#D1D5DB", fontSize:11 }}>--</span>;
  const cls = pct >= 0.70 ? "zone-red" : pct >= 0.65 ? "zone-yellow" : "";
  return <span className={cls} style={{ background:z.bg, color:z.color, border:`1px solid ${z.color}33`, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700, whiteSpace:"nowrap", display:"inline-block" }}>{z.label} &middot; {(pct*100).toFixed(1)}%</span>;
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
      <div style={{ fontSize:40, marginBottom:12 }}>{"\uD83D\uDD12"}</div>
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
      html, body { overflow-x: hidden; max-width: 100vw; }
      body { background: #000000 !important; color: #F0F0F0; }
      #root { background: #000000; min-height: 100vh; overflow-x: hidden; }
      table { width: 100%; }
      .tab-content { width: 100%; min-width: 0; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input[type="date"], input[type="month"] { color-scheme: dark; } input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(1) saturate(5) hue-rotate(290deg); cursor: pointer; }
      input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input::placeholder { color: #555555 !important; }
      select option { background: #111111; color: #F0F0F0; }
      @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
      @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
      @keyframes spin { to { transform: rotate(360deg); } }
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
      input[type="date"], input[type="month"] { color-scheme: dark; } input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(1) saturate(5) hue-rotate(290deg); cursor: pointer; }
      input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input::placeholder { color: #555555 !important; }
      select option { background: #111111; color: #F0F0F0; }
      input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(1); cursor:pointer; }
      input[type="date"], input[type="month"] { color-scheme: dark; } input[type="date"]::-webkit-calendar-picker-indicator, input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(0.6) sepia(1) saturate(5) hue-rotate(290deg); cursor: pointer; }
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
      .boba-flip-card { transform-style: preserve-3d; }
      .boba-flip-card > div { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
      .boba-card-flip { transform-style: preserve-3d; transition: transform 0.5s ease; }
      .boba-card-flip:hover { transform: rotateY(180deg); }

      /* -- MOBILE RESPONSIVE -- */
      @media (max-width: 768px) {
        .mobile-hide { display: none !important; }
        .mobile-show { display: inline !important; }
        .nav-tab-label { display: none !important; }
        .nav-tab-icon { display: inline !important; }
        .nav-tab { padding: 10px 14px !important; font-size: 18px !important; }
        .tab-content { padding: 10px !important; }
        .boba-card-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 6px !important; }
        .lot-comp-grid { grid-template-columns: 1fr !important; }
        .seller-intel-panel { display: none !important; }
        .stats-grid-4 { grid-template-columns: 1fr 1fr !important; }
        .mobile-scroll-x { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
        .mobile-scroll-x table { min-width: 500px; }
        .view-mode-row { overflow-x: auto !important; flex-wrap: nowrap !important; -webkit-overflow-scrolling: touch; }
        .view-mode-row::-webkit-scrollbar { display: none; }
        .checklist-actions { flex-wrap: wrap !important; }
      }
      @media (max-width: 480px) {
        .boba-card-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 4px !important; }
        .tab-content { padding: 8px !important; }
      }

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
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",background:"#000",fontFamily:"'Trebuchet MS',sans-serif",overflow:"hidden",position:"relative"}}>
      <style>{`
        @keyframes loginOrb{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-30px) scale(1.1)}66%{transform:translate(-25px,20px) scale(0.9)}}
        @keyframes loginSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes loginSpinR{from{transform:rotate(0deg)}to{transform:rotate(-360deg)}}
        @keyframes loginFade{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes loginPulse{0%,100%{opacity:0.5;transform:scale(0.95)}50%{opacity:1;transform:scale(1.05)}}
        .login-btn{transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1) !important;}
        .login-btn:hover{transform:translateY(-2px) scale(1.02) !important;box-shadow:0 16px 48px rgba(232,49,122,0.5) !important;}
      `}</style>
      <div style={{position:"absolute",width:600,height:600,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,49,122,0.07) 0%,transparent 70%)",top:"-15%",left:"-10%",animation:"loginOrb 12s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(123,47,247,0.07) 0%,transparent 70%)",bottom:"-10%",right:"-10%",animation:"loginOrb 15s ease-in-out infinite reverse",pointerEvents:"none"}}/>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:40,animation:"loginFade 0.7s ease both",position:"relative",zIndex:1}}>
        <div style={{position:"relative",width:100,height:100}}>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"1.5px solid rgba(232,49,122,0.2)",animation:"loginSpin 10s linear infinite"}}/>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"1.5px dashed rgba(123,47,247,0.15)",animation:"loginSpinR 14s linear infinite"}}/>
          <div style={{position:"absolute",inset:14,borderRadius:"50%",border:"2px solid rgba(232,49,122,0.5)",animation:"loginSpin 5s linear infinite",boxShadow:"0 0 20px rgba(232,49,122,0.2)"}}/>
          <div style={{position:"absolute",inset:28,borderRadius:"50%",border:"1.5px solid rgba(123,47,247,0.4)",animation:"loginSpinR 3s linear infinite"}}/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"linear-gradient(135deg,#E8317A,#7B2FF7)",boxShadow:"0 0 20px rgba(232,49,122,0.8)",animation:"loginPulse 2s ease-in-out infinite"}}/>
          </div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:11,fontWeight:900,letterSpacing:8,color:"rgba(255,255,255,0.15)",textTransform:"uppercase",marginBottom:6}}>Bazooka Breaks</div>
          <div style={{fontSize:52,fontWeight:900,background:"linear-gradient(135deg,#E8317A,#7B2FF7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-2,lineHeight:1,marginBottom:8}}>Dashboard</div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",letterSpacing:3,textTransform:"uppercase"}}>Internal Operations</div>
        </div>
        <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:20,padding:"32px 40px",textAlign:"center",minWidth:320}}>
          <div style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginBottom:24,lineHeight:1.7}}>Access restricted to<br/>Bazooka team members</div>
          <button onClick={handleLogin} className="login-btn" style={{display:"flex",alignItems:"center",gap:12,background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"14px 28px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",width:"100%",justifyContent:"center",boxShadow:"0 8px 32px rgba(232,49,122,0.3)"}}>
            <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#fff" fillOpacity="0.9" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#fff" fillOpacity="0.9" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/><path fill="#fff" fillOpacity="0.9" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/><path fill="#fff" fillOpacity="0.9" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z"/></svg>
            Sign in with Google
          </button>
          {error && <div style={{marginTop:16,color:"#E8317A",fontSize:12,fontWeight:600}}>{error}</div>}
        </div>
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
    const streamExp=promo+magpros+pack+topload+chaser; const reimbExp=streamExp;
    const totalExp=fees+coupons+streamExp, netRev=gross-totalExp;
    // bazNet for DISPLAY/SPLIT includes fees (true 30% of net)
    const bazNet=netRev*0.30, imcNet=netRev*0.70;
    // repExp and commBase use gross-streamExp (fees don't affect rep commission)
    const grossForComm=gross-streamExp-coupons, bazNetForComm=grossForComm*0.30;
    const repExp=streamExp*0.135, imcExpReimb=reimbExp*0.70;
    const mm=parseFloat(s.marketMultiple)||0, overrideRate=s.commissionOverride!==""&&s.commissionOverride!=null?parseFloat(s.commissionOverride)/100:null;
    const rate=overrideRate!==null?overrideRate:s.binOnly?0.35:mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
    const commBase=bazNet, commAmt=commBase*rate;
    return { gross, netRev, bazNet, imcNet, repExp, imcExpReimb, commBase, commAmt, totalExp, collabAmt:bazNet*(parseFloat(s.collabPct||0)/100||0)*(s.collabPartner&&s.collabPartner!=="_"?1:0), bazTrueNet:bazNet-commAmt+imcExpReimb-repExp-bazNet*(s.collabPartner&&s.collabPartner!=="_"?parseFloat(s.collabPct||0)/100:0), rate };
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* -- QUOTE NOTIFICATIONS (Admin) -- */}
      {quoteNotifs.map(q => {
        const cfg = {
          accepted: { icon:"\uD83C\uDF89", color:"#4ade80", bg:"#0a1a0a", border:"#4ade8033", title:"Offer Accepted!", body:`${q.seller?.name||"Seller"} accepted your offer of $${parseFloat(q.dispOffer||0).toFixed(2)}` },
          declined: { icon:"\u274C", color:"#E8317A", bg:"#1a0a0a", border:"#E8317A33", title:"Offer Declined", body:`${q.seller?.name||"Seller"} declined your offer of $${parseFloat(q.dispOffer||0).toFixed(2)}` },
          countered:{ icon:"\uD83E\uDD1D", color:"#FBBF24", bg:"#1a1400", border:"#FBBF2433", title:"Counter Offer!", body:`${q.seller?.name||"Seller"} countered at $${parseFloat(q.sellerCounter||0).toFixed(2)} (you offered $${parseFloat(q.currentOffer||q.dispOffer||0).toFixed(2)})` },
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
                    <div style={{ fontSize:12, color:"#4ade80", marginTop:4 }}>{"\uD83D\uDCB3 Wants payment via"}<strong>{q.sellerPayment}</strong>{q.sellerHandle ? ` -- ${q.sellerHandle}` : ""}</div>
                  )}
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <a href={`/quote/${q.id}`} target="_blank" rel="noreferrer" style={{ background:"#1a1a1a", color:cfg.color, border:`1px solid ${cfg.border}`, borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, textDecoration:"none" }}>{"View Quote \u2197"}</a>
                <button onClick={()=>{ if(onDismissQuoteNotif) onDismissQuoteNotif(q.id); }} style={{ background:"transparent", border:"1px solid #333", color:"#666", borderRadius:8, padding:"7px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>{"\u2713 Dismiss"}</button>
              </div>
            </div>
          </div>
        );
      })}

      {/* -- PAY STUB NOTIFICATIONS -- */}
      {myStubs.length > 0 && myStubs.map(stub => (
        <div key={stub.id} style={{ background:"linear-gradient(135deg,#0a1a0a,#111)", border:"2px solid #4ade80", borderRadius:14, padding:"18px 20px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ fontSize:32 }}>{"\uD83D\uDCB5"}</div>
            <div>
              <div style={{ fontSize:14, fontWeight:800, color:"#4ade80", marginBottom:4 }}>New Pay Stub from Bazooka!</div>
              <div style={{ fontSize:12, color:"#888" }}>
                Period: <strong style={{color:"#F0F0F0"}}>{stub.period}</strong>
                &nbsp;&middot;&nbsp; {stub.streamCount} stream{stub.streamCount!==1?"s":""}
                &nbsp;&middot;&nbsp; Generated {new Date(stub.createdAt).toLocaleDateString()}
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
                {viewStub===stub.id ? "\u25B2 Hide" : "\uD83D\uDC41 View Details"}
              </button>
              <button onClick={()=>{ if(onDismissPayStub) onDismissPayStub(stub.id); }} style={{ background:"transparent", border:"1px solid #555", color:"#888", borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>{"\u2713 Dismiss"}</button>
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
                      <td style={{ ...S.td, color:"#888" }}>{s.breakType}{s.binOnly?" BIN":""}{s.sessionType?<span style={{marginLeft:5,fontSize:10,color:"#7B9CFF"}}>{{day:"\u2600\uFE0F",night:"\uD83C\uDF19",weekend:"\uD83D\uDCC5",event:"\uD83C\uDF89"}}[s.sessionType]||""</span>:""}</td>
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

      {/* -- FINANCIAL OVERVIEW (Admin only) -- */}
      {canSeeFinancials && (() => {
        // Period filter
        const now   = new Date();
        function inPeriod(dateStr) {
          if (!dateStr) return false;
          const d = parseLocalDate(dateStr);
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
            const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
            return d >= start && d <= end;
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
          const streamExp = promo+magpros+pack+topload+chaser;
          const reimbExp  = streamExp;
          const totalExp = fees+coupons+streamExp;
          const netRev   = gross - totalExp;
          const bazNet   = netRev * 0.30;
          const imcNet   = netRev * 0.70;
          const grossForComm = gross - streamExp - coupons;
          const bazNetForComm = grossForComm * 0.30;
          const repExp   = streamExp * 0.135;
          const imcExpReimb = reimbExp * 0.70;
          const commBase = bazNet;
          const mm = parseFloat(s.marketMultiple)||0;
          const overrideRate = s.commissionOverride !== "" && s.commissionOverride != null ? parseFloat(s.commissionOverride)/100 : null;
          const rate = overrideRate !== null ? overrideRate : s.binOnly ? 0.35 : mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
          const commAmt  = commBase * rate;
          const collabAmt = bazNet*(s.collabPartner&&s.collabPartner!=="_"?parseFloat(s.collabPct||0)/100:0);
          return { gross, totalExp, netRev, bazNet, imcNet, repExp, imcExpReimb, commBase, rate, commAmt, collabAmt, bazTrueNet: bazNet - commAmt + imcExpReimb - collabAmt };
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

        const PERIOD_LABELS = { month:"This Month", quarter:"This Quarter", year:"This Year", all:"All Time", custom:"Custom Range" };

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
                <button onClick={()=>setDrillDown(null)} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:18 }}>{"\u2715"}</button>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead><tr>
                    {["Date","Breaker","Gross","Net","Rate",
                      ...(drillDown==="trueNet" ? ["Baz Earnings","\u2212 Commission","+ IMC Reimb","True Net"] : [
                        drillDown==="commission"?"Commission":drillDown==="imc"?"IMC (70%)":drillDown==="bazooka"?"Bazooka Earnings":"Gross"
                      ])
                    ].map(h=><th key={h} style={S.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filtered.length===0
                      ? <EmptyRow msg={streams.length===0 ? "No streams logged yet -- add a stream recap in Break Log." : "No streams in this period."} cols={drillDown==="trueNet"?9:6}/>
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
                                <td style={{ ...S.td, color:"#E8317A" }}>{"\u2212"}{fmt(c.commAmt)}</td>
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
                        <td style={{ ...S.td, fontWeight:900, color:"#E8317A", fontSize:14 }}>{"\u2212"}{fmt(filtered.reduce((a,s)=>a+calcStream(s).commAmt,0))}</td>
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
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }} className="checklist-actions">
                {[["month","Month"],["quarter","Quarter"],["year","Year"],["all","All Time"],["custom","Custom"]].map(([val,label]) => (
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

            <div style={{ fontSize:11, color:"#AAAAAA", marginBottom:12, fontWeight:600 }}>{PERIOD_LABELS[financialPeriod]} &middot; {filtered.length} stream{filtered.length!==1?"s":""}</div>

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
                  <div style={{ fontSize:10, color:drillDown===key?"#888":"#9CA3AF" }}>{drillDown===key?"\u25B2 hide":"\u25BC "+sub}</div>
                </div>
              ))}
            </div>
          </div>

          {drillDown && <div className="drill-down">{renderDrillDown()}</div>}
          </>
        );
      })()}

      {/* Ops Summary */}
      {canSeeFinancials && (() => {
        const periodStreams = streams.filter(s => {
          if (!s.date) return false;
          const d = parseLocalDate(s.date);
          const now = new Date();
          if (financialPeriod==="week") {
            const day=d.getDay(), diff=day===0?6:day-1;
            const wStart=new Date(d); wStart.setDate(d.getDate()-diff); wStart.setHours(0,0,0,0);
            const wEnd=new Date(wStart); wEnd.setDate(wStart.getDate()+6); wEnd.setHours(23,59,59,999);
            const today=new Date(); const tDay=today.getDay(), tDiff=tDay===0?6:tDay-1;
            const twStart=new Date(today); twStart.setDate(today.getDate()-tDiff); twStart.setHours(0,0,0,0);
            return wStart >= twStart;
          }
          if (financialPeriod==="month") return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
          if (financialPeriod==="quarter") { const q=Math.floor(now.getMonth()/3); return Math.floor(d.getMonth()/3)===q&&d.getFullYear()===now.getFullYear(); }
          if (financialPeriod==="year") return d.getFullYear()===now.getFullYear();
          return true;
        });

        const totMagpros  = periodStreams.reduce((s,r)=>s+(parseFloat(r.magpros)||0),0);
        const totPack     = periodStreams.reduce((s,r)=>s+(parseFloat(r.packagingMaterial)||0),0);
        const totTopload  = periodStreams.reduce((s,r)=>s+(parseFloat(r.topLoaders)||0),0);
        const totChaser   = periodStreams.reduce((s,r)=>s+(parseFloat(r.chaserCards)||0),0);
        const totMagQty   = periodStreams.reduce((s,r)=>s+(parseInt(r.magprosQty)||0),0);
        const totPackQty  = periodStreams.reduce((s,r)=>s+(parseInt(r.packagingQty)||0),0);
        const totTopQty   = periodStreams.reduce((s,r)=>s+(parseInt(r.topLoadersQty)||0),0);
        const totZion     = periodStreams.reduce((s,r)=>s+(parseFloat(r.zionRevenue)||0),0);
        const totCoupons  = periodStreams.reduce((s,r)=>s+(parseFloat(r.coupons)||0),0);

        // Card usage costs by type -- join breaks with inventory costs
        const periodStreamIds = new Set(periodStreams.map(s=>s.id));
        const periodBreaks = breaks.filter(b => b.streamId && periodStreamIds.has(b.streamId));
        const cardCostByType = {};
        const cardQtyByType  = {};
        CARD_TYPES.forEach(ct => { cardCostByType[ct]=0; cardQtyByType[ct]=0; });
        periodBreaks.forEach(b => {
          if (!b.cardType || !CARD_TYPES.includes(b.cardType)) return;
          const inv = inventory.find(c => c.id === b.inventoryId);
          const cost = inv?.costPerCard || 0;
          if (b.cardType !== "Chaser Cards") { // Chaser cost comes from stream field (includes overrides)
            cardCostByType[b.cardType] += cost;
          }
          cardQtyByType[b.cardType] += 1;
        });
        // Chaser Cards cost: use stream-level chaserCards field (captures manual overrides)
        cardCostByType["Chaser Cards"] = periodStreams.reduce((s,r)=>s+(parseFloat(r.chaserCards)||0),0);

        return (
          <div style={{ ...S.card }}>
            <SectionLabel t="\uD83D\uDCE6 Ops Summary" />
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
              {[
                { l:"MagPros",          v:`$${totMagpros.toFixed(2)}`,  sub:totMagQty>0?`${totMagQty} units`:"",         c:"#7B9CFF" },
                { l:"Packaging",        v:`$${totPack.toFixed(2)}`,     sub:totPackQty>0?`${totPackQty} units`:"",        c:"#7B9CFF" },
                { l:"Top Loaders",      v:`$${totTopload.toFixed(2)}`,  sub:totTopQty>0?`${totTopQty} units`:"",          c:"#7B9CFF" },
                { l:"Chaser Cards",     v:`$${totChaser.toFixed(2)}`,   sub:"",                                           c:"#E8317A" },
                { l:"Coupons Given",    v:`$${totCoupons.toFixed(2)}`,  sub:"",                                           c:"#FBBF24" },
                { l:"\uD83D\uDFE2 Zion Cases",     v:totZion>0?`$${totZion.toFixed(2)}`:"--", sub:totZion>0?`~${Math.round(totZion/3)} units sold`:"Bazooka-only", c:"#4ade80" },
              ].map(({l,v,sub,c}) => (
                <div key={l} style={{ background:"#1a1a1a", borderRadius:8, padding:"12px 14px", border:"1px solid #2a2a2a" }}>
                  <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{l}</div>
                  {sub && <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{sub}</div>}
                </div>
              ))}
            </div>
            {/* Card usage by type */}
            <div style={{ marginTop:12, paddingTop:12, borderTop:"1px solid #1a1a1a" }}>
              <div style={{ fontSize:10, color:"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Cards Used in Streams</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
                {CARD_TYPES.map(ct => {
                  const cc = CC[ct]||{ text:"#888", bg:"#111" };
                  const qty  = cardQtyByType[ct]||0;
                  const cost = cardCostByType[ct]||0;
                  return (
                    <div key={ct} style={{ background:"#1a1a1a", borderRadius:8, padding:"12px 14px", border:"1px solid #2a2a2a" }}>
                      <div style={{ fontSize:18, fontWeight:900, color:cc.text }}>{qty}</div>
                      <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{ct.replace(" Cards","")}</div>
                      {cost>0 && <div style={{ fontSize:10, color:"#555", marginTop:2 }}>${cost.toFixed(2)} cost</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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
                {"\uD83D\uDCC8 Year-End Projections"}</div>
              <span style={{ fontSize:11, color:"#AAAAAA" }}>
                {ytdStreams.length} stream{ytdStreams.length!==1?"s":""}
                {ytdHist.length>0 ? ` + ${ytdHist.length} historical month${ytdHist.length!==1?"s":""}` : ""} &middot; {pct}% through {now.getFullYear()}
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
            {alerts.length===0 ? "\u2705 All Good" : `\uD83D\uDEA8 ${alerts.length} Critical`}
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
            <div style={{ fontSize:11, fontWeight:700, color:"#E8317A", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>{"\uD83D\uDEA8 Restock Needed"}</div>
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
                    {transit > 0 && <span style={{ fontSize:11, color:"#F0F0F0", fontWeight:700, background:"#111111", padding:"2px 8px", borderRadius:5 }}>{"\uD83D\uDE9A"}{transit} in transit</span>}
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

      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ padding:"16px 20px 12px" }}>
          <SectionLabel t="Inventory by Card Type" />
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:"1px solid #222" }}>
              <th style={{ ...S.th, textAlign:"left", paddingLeft:20, width:"30%" }}>Card Type</th>
              <th style={{ ...S.th, textAlign:"center" }}>Stock</th>
              <th style={{ ...S.th, textAlign:"center" }}>Used</th>
              <th style={{ ...S.th, textAlign:"center" }}>Avail</th>
              <th style={{ ...S.th, textAlign:"center" }}>Transit</th>
              <th style={{ ...S.th, textAlign:"center" }}>Min</th>
              <th style={{ ...S.th, textAlign:"right", paddingRight:20 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {CARD_TYPES.map((ct,i) => {
              const d = stats[ct]; const { buffer } = TARGETS[ct]; const cc = CC[ct];
              const avail   = d.total - d.used - d.inTransit;
              const transit = d.inTransit;
              const pct     = d.market > 0 ? d.invested/d.market : null;
              const ok = avail >= buffer; const warn = avail >= buffer*0.5;
              const sc = ok?"#4ade80":warn?"#FBBF24":"#E8317A";
              const sl = ok?"\u2705 Stocked":warn?"\u26A0\uFE0F Low":"\uD83D\uDEA8 Critical";
              return (<tr key={ct} style={{ background:i%2===0?"#111111":"#0d0d0d", borderBottom:"1px solid #1a1a1a" }}>
                  <td style={{ padding:"14px 20px", fontWeight:800, color:cc.text, fontSize:14 }}>{ct}</td>
                  <td style={{ ...S.td, textAlign:"center", fontSize:20, fontWeight:900, color:cc.text }}>{d.total}</td>
                  <td style={{ ...S.td, textAlign:"center", fontSize:20, fontWeight:900, color:d.used>0?"#E8317A":"#333" }}>{d.used}</td>
                  <td style={{ ...S.td, textAlign:"center", fontSize:20, fontWeight:900, color:ok?"#4ade80":warn?"#FBBF24":"#E8317A" }}>{avail}</td>
                  <td style={{ ...S.td, textAlign:"center", fontSize:20, fontWeight:900, color:transit>0?"#7B9CFF":"#333" }}>{transit}</td>
                  <td style={{ ...S.td, textAlign:"center", fontSize:16, color:"#555", fontWeight:700 }}>{buffer}</td>
                  <td style={{ padding:"14px 20px", textAlign:"right" }}>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                      {canSeeFinancials && <ZoneBadge pct={pct} />}
                      <span style={{ background:ok?"#0a1a0a":warn?"#1a1400":"#1a0a0a", color:sc, border:`1px solid ${sc}33`, borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{sl}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
                {[["Cards logged out",bBreaks.length],["Added to inventory",bInv.length],["Last break",last?new Date(last.dateAdded).toLocaleDateString():"--"]].map(([l,v]) => (
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

      {/* Historical Data -- Admin only */}
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
              <SectionLabel t="\uD83D\uDCC5 Historical Monthly Data" />
              <button onClick={()=>{ setShowHist(p=>!p); cancelEdit(); }} style={{ background:"transparent", border:"1.5px solid #6B2D8B", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {showHist ? "\u25B2 Hide" : "\u25BC Manage"}
              </button>
            </div>
            {showHist && (
              <>
                <div style={{ fontSize:12, color:"#AAAAAA", marginBottom:14 }}>{editingId ? `Editing ${editingId} -- update fields and save.` : "Enter monthly summary data for historical periods. These feed into YTD totals and projections on the dashboard."}</div>
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
                    <Btn onClick={saveHist} disabled={!histForm.yearMonth||!histForm.grossRevenue} variant="green">{editingId ? "\uD83D\uDCBE Save" : "+ Add"}</Btn>
                    {editingId && <Btn onClick={cancelEdit} variant="ghost">{"\u2715"}</Btn>}
                  </div>
                </div>
                {historicalData.length > 0 && (
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead><tr>{["Month","Gross","Net","Bazooka (30%)","IMC Reimb","True Net","\uD83C\uDF31 New Buyers","Notes",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {historicalData.map((h,i) => (
                        <tr key={h.id} style={{ background: editingId===h.id?"rgba(107,45,139,0.08)":i%2===0?"#111111":"#0d0d0d" }}>
                          <td style={{ ...S.td, fontWeight:700, color:"#E8317A" }}>{h.yearMonth}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(parseFloat(h.grossRevenue)||0)}</td>
                          <td style={{ ...S.td, color:"#F0F0F0" }}>{fmt(parseFloat(h.netRevenue)||0)}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt((parseFloat(h.netRevenue)||0)*0.30)}</td>
                          <td style={{ ...S.td, color:"#E8317A" }}>{h.imcReimb?fmt(parseFloat(h.imcReimb)):"--"}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:900 }}>{fmt((parseFloat(h.netRevenue)||0)*0.30 + (parseFloat(h.imcReimb)||0))}</td>
                          <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{h.newBuyers>0?`\uD83C\uDF31 ${h.newBuyers}`:"--"}</td>
                          <td style={{ ...S.td, color:"#AAAAAA" }}>{h.notes||"--"}</td>
                          <td style={S.td}>
                            <div style={{ display:"flex", gap:6 }}>
                              <button onClick={()=>startEdit(h)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>{"\u270F\uFE0F"}</button>
                              <button onClick={()=>{ if(window.confirm("Delete this historical entry?")) onDeleteHistorical(h.id); }} style={{ background:"none", border:"1px solid #FCA5A5", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1"}</button>
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

function LotComp({ onAccept, onSaveComp, onDeleteComp, comps, user, userRole, onSaveQuote, quotes=[], onCloseQuote, onBazookaCounter, cardPools=[], onDismissQuoteNotif, bobaCards=[] }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [compMode,     setCompMode]     = useState("builder");
  const [seller,       setSeller]       = useState({ name:"", contact:"", date:"", source:"", payment:"", paymentHandle:"" });
  const [lotPct,       setLotPct]       = useState("");
  const [finalOffer,   setFOffer]       = useState("");
  const [custView,     setCustView]     = useState(false);
  const [custNote,     setCustNote]     = useState("");
  const [quoteLink,    setQuoteLink]    = useState(null);
  const [quoteCopied,  setQuoteCopied]  = useState(false);
  const [allowCounter, setAllowCounter] = useState(false);
  const [bzCounterAmt, setBzCounterAmt] = useState({});
  const [rows,         setRows]         = useState(() => Array.from({ length:8 }, () => ({ id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true })));
  const [quickCards,   setQuickCards]   = useState("");
  const [quickMktVal,  setQuickMktVal]  = useState("");
  const [quickPct,     setQuickPct]     = useState("");
  const [quickOffer,   setQuickOffer]   = useState("");
  const [counterOffer,        setCounterOffer]        = useState("");
  const [loadedCompId,        setLoadedCompId]        = useState(null);
  const [loadedCompHadCards,  setLoadedCompHadCards]  = useState(true);
  const [acOpen,       setAcOpen]       = useState(null);  // row id with open autocomplete
  const [acQuery,      setAcQuery]      = useState({});    // {rowId: queryString}




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
      zone:lotZone?.label||"--", status,
      cards:included.map(r=>({ name:r.name, cardType:r.cardType, qty:parseInt(r.qty)||1, mktVal:parseFloat(r.mktVal)||0 }))
    });
  }

  function doAccept() {
    if (included.length === 0) return;
    const cards = [];
    included.forEach(r => {
      const qty = parseInt(r.qty)||1;
      const mv  = parseFloat(r.mktVal)||0;
      const cardName = r.name === "__new__" ? (r._newName||"").trim() || r.cardType : r.name || r.cardType;
      const weightedCost = totalMkt > 0 ? (mv / totalMkt) * dispOffer : (totalCards > 0 ? dispOffer/totalCards : 0);
      for (let i=0; i<qty; i++) {
        cards.push({ id:uid(), cardName, cardType:r.cardType, marketValue:mv, lotTotalPaid:dispOffer, cardsInLot:totalCards, costPerCard:weightedCost, buyPct:mv>0?weightedCost/mv:null, date:seller.date||new Date().toLocaleDateString(), source:seller.source, seller:seller.name, payment:seller.payment, dateAdded:new Date().toISOString() });
      }
    });
    onAccept(cards, seller, user, custNote);
  }

  if (custView) return (
    <div>
      <div style={{ marginBottom:14 }}><Btn onClick={()=>setCustView(false)} variant="ghost">{"\u2190 Back to Builder"}</Btn></div>
      <div style={{ background:"#111111", border:"2px solid #E8317A55", borderRadius:16, overflow:"hidden", maxWidth:680, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ background:"#000000", padding:"28px 32px", textAlign:"center" }}>
          <div style={{ fontSize:32, fontWeight:900, color:"#F0F0F0", letterSpacing:4, marginBottom:6 }}>BAZOOKA</div>
          <div style={{ fontSize:11, color:"#AAAAAA", fontStyle:"italic" }}>Bo Jackson Battle Arena &middot; Lot Purchase Offer</div>
        </div>
        <div style={{ padding:"14px 24px", borderBottom:"1px solid #333333", display:"grid", gridTemplateColumns:"1fr 1fr", background:"#111111" }}>
          <div><span style={{ color:"#AAAAAA", fontSize:11 }}>Prepared for: </span><strong>{seller.name||"--"}</strong></div>
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
          {/* Notes -- rendered read-only in the quote */}
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
              Devin -- Bazooka<br/>
              425 Prosperity Dr<br/>
              Warsaw, IN 46582
            </div>
          </div>

          {/* Payment section -- shows when payment method + handle entered */}
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
                  Payment -- <span style={{ color:cfg.color }}>{seller.payment}</span>
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
                          {cfg.icon} {cfg.label} \u2192
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
          {[["builder","\uD83E\uDDEE Builder"],["quick","\u26A1 Quick Mode"],...(["Admin","Procurement"].includes(userRole?.role)?[["history","\uD83D\uDCCB History"]]:[] )].map(([mode,label]) => (
            <button key={mode} onClick={()=>setCompMode(mode)} style={{ background:compMode===mode?"#1A1A2E":"transparent", color:compMode===mode?"#E8317A":"#9CA3AF", border:`1.5px solid ${compMode===mode?"#E8317A":"#E5E7EB"}`, borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginTop:12 }}>
          {[
            { z:"\uD83D\uDFE2 Green",  p:"Under 65%", a:"Buy independently",          bg:"#0a1a0a", c:"#4ade80" },
            { z:"\uD83D\uDFE1 Yellow", p:"65-70%",    a:"Flag before buying",          bg:"#FFF9DB", c:"#92400e" },
            { z:"\uD83D\uDD34 Red",    p:"Over 70%",  a:"Pass or get approval",        bg:"#FEE2E2", c:"#991b1b" },
          ].map(({z,p,a,bg,c}) => (
            <div key={z} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background:bg, border:`1px solid ${c}22`, borderRadius:7 }}>
              <span style={{ fontWeight:800, color:c, fontSize:12, whiteSpace:"nowrap" }}>{z}</span>
              <span style={{ color:c, fontSize:11, whiteSpace:"nowrap" }}>{p}</span>
              <span style={{ color:"#AAAAAA", fontSize:11 }}>-- {a}</span>
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
              { l:"Lot Zone",    v:quickZone?quickZone.label:"--",   c:quickZone?.color||"#9CA3AF" },
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
        const activeQuotes = quotes.filter(q => !["closed"].includes(q.status));

        return (
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

          {/* -- ACTIVE QUOTES -- */}
          {activeQuotes.length > 0 && (
            <div style={{ ...S.card, border:"2px solid rgba(232,49,122,0.3)" }}>
              <SectionLabel t="\uD83D\uDD17 Active Quote Links" />
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {activeQuotes.map(q => {
                  // Auto-dismiss badge when admin views a responded quote
                  // Note: notifications are dismissed from the Dashboard, not auto-dismissed here
                  const statusCfg = {
                    pending:   { color:"#888",    bg:"#1a1a1a",  label:"\u23F3 Awaiting Response" },
                    countered: { color:"#FBBF24", bg:"#1a1400",  label:"\uD83E\uDD1D Counter Received" },
                    accepted:  { color:"#4ade80", bg:"#0a1a0a",  label:"\u2705 Accepted" },
                    declined:  { color:"#E8317A", bg:"#1a0a0a",  label:"\u274C Declined" },
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
                            {q.cards?.length||0} cards &middot; Offer: <strong style={{color:"#E8317A"}}>${parseFloat(q.currentOffer||q.dispOffer||0).toFixed(2)}</strong>
                            {q.status==="countered" && <> &middot; Counter: <strong style={{color:"#FBBF24"}}>${parseFloat(q.sellerCounter||0).toFixed(2)}</strong></>}
                            {q.status==="accepted" && q.sellerPayment && <> &middot; Payment: <strong style={{color:"#4ade80"}}>{q.sellerPayment}{q.sellerHandle?` -- ${q.sellerHandle}`:""}</strong></>}
                            &nbsp;&middot; {daysLeft}d left
                          </div>
                          {/* View tracking */}
                          <div style={{ display:"flex", alignItems:"center", gap:8, marginTop:4 }}>
                            {(q.viewCount||0) === 0
                              ? <span style={{ fontSize:11, color:"#444" }}>{"\uD83D\uDC41 Not opened yet"}</span>
                              : <span style={{ fontSize:11, color:(q.viewCount||0)>=5?"#FBBF24":"#7B9CFF", fontWeight:700 }}>
                                  {"\uD83D\uDC41 Opened "}{q.viewCount} time{q.viewCount!==1?"s":""}
                                  {q.lastViewedAt && <span style={{color:"#555",fontWeight:400}}> &middot; Last: {new Date(q.lastViewedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
                                  {(q.viewCount||0)>=5 && <span style={{color:"#FBBF24",marginLeft:6}}>{"\uD83D\uDD25 Interested!"}</span>}
                                </span>
                            }
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                          <button onClick={()=>{ navigator.clipboard?.writeText(quoteUrl); }} style={{ background:"none", border:"1px solid #333", color:"#888", borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDCCB Copy Link"}</button>
                          <a href={quoteUrl} target="_blank" rel="noreferrer" style={{ background:"none", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, textDecoration:"none" }}>{"View \u2197"}</a>
                          {onCloseQuote && <button onClick={()=>{ if(window.confirm("Close this quote? The seller's link will show as expired.")) onCloseQuote(q.id); }} style={{ background:"none", border:"1px solid #333", color:"#555", borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDD12 Close"}</button>}
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
                            {/* Live % preview */}
                            {bzCounterAmt[q.id] && parseFloat(bzCounterAmt[q.id]) > 0 && (() => {
                              const totalMkt = (q.cards||[]).reduce((s,c)=>(s+(parseFloat(c.mktVal)||0)*(parseInt(c.qty)||1)),0);
                              const counterVal = parseFloat(bzCounterAmt[q.id]);
                              const pct = totalMkt > 0 ? (counterVal/totalMkt)*100 : null;
                              const origOffer = parseFloat(q.dispOffer||0);
                              const origPct = totalMkt > 0 ? (origOffer/totalMkt)*100 : null;
                              const sellerPct = totalMkt > 0 ? (parseFloat(q.sellerCounter||0)/totalMkt)*100 : null;
                              const zone = pct < 65 ? {c:"#4ade80",l:"\uD83D\uDFE2 Green Zone"} : pct < 70 ? {c:"#FBBF24",l:"\uD83D\uDFE1 Yellow Zone"} : {c:"#E8317A",l:"\uD83D\uDD34 Red Zone"};
                              return (
                                <div style={{ marginTop:8, display:"flex", gap:8, flexWrap:"wrap" }}>
                                  <div style={{ background:"#1a1a1a", border:`1px solid ${zone.c}44`, borderRadius:7, padding:"5px 10px", fontSize:11 }}>
                                    <span style={{ color:"#666" }}>Your counter: </span>
                                    <strong style={{ color:zone.c }}>{pct?pct.toFixed(1)+"%":"--"}</strong>
                                    <span style={{ color:"#555", marginLeft:4 }}>{zone.l}</span>
                                  </div>
                                  {origPct && <div style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:7, padding:"5px 10px", fontSize:11 }}>
                                    <span style={{ color:"#666" }}>Our offer: </span>
                                    <strong style={{ color:"#E8317A" }}>{origPct.toFixed(1)}%</strong>
                                  </div>}
                                  {sellerPct && <div style={{ background:"#1a1a1a", border:"1px solid #333", borderRadius:7, padding:"5px 10px", fontSize:11 }}>
                                    <span style={{ color:"#666" }}>Their ask: </span>
                                    <strong style={{ color:"#FBBF24" }}>{sellerPct.toFixed(1)}%</strong>
                                  </div>}
                                </div>
                              );
                            })()}
                          </div>
                          <Btn onClick={()=>{ if(onBazookaCounter&&bzCounterAmt[q.id]) { onBazookaCounter(q.id,parseFloat(bzCounterAmt[q.id]),q.history||[]); setBzCounterAmt(p=>({...p,[q.id]:""})); }}} disabled={!bzCounterAmt[q.id]} variant="ghost">{"\uD83E\uDD1D Send Counter"}</Btn>
                          <Btn onClick={()=>{ if(onCloseQuote) onCloseQuote(q.id); }} variant="ghost">{"\u274C Decline"}</Btn>
                          {q.status==="countered" && (
                            <Btn onClick={async()=>{
                              // Accept their counter -- update offer to their counter amount
                              if(onBazookaCounter) {
                                await setDoc(doc(db,"quotes",q.id),{ status:"pending", currentOffer:parseFloat(q.sellerCounter), history:[...(q.history||[]),{type:"bazooka_accepted_counter",amount:parseFloat(q.sellerCounter),timestamp:new Date().toISOString()}], notified:false },{ merge:true });
                                showToast?.(`\u2705 Accepted counter at $${parseFloat(q.sellerCounter).toFixed(2)}`);
                              }
                            }} variant="green">{"\u2705 Accept Their Counter"}</Btn>
                          )}
                        </div>
                      )}

                      {/* Accepted -- import prompt */}
                      {q.status==="accepted" && (
                        <div style={{ borderTop:"1px solid #333", paddingTop:10, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:8 }}>
                          <span style={{ fontSize:12, color:"#4ade80" }}>{"\uD83C\uDF89 Seller accepted! Ready to import into inventory."}</span>
                          <button onClick={()=>{ loadComp({ seller:q.seller?.name, contact:q.seller?.contact, date:q.seller?.date, source:q.seller?.source, payment:q.sellerPayment, paymentHandle:q.sellerHandle, cards:q.cards, offer:parseFloat(q.currentOffer||q.dispOffer), id:q.id }); setCompMode("builder"); }} style={{ background:"#166534", color:"#fff", border:"none", borderRadius:8, padding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDCE5 Load into Builder & Import"}</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* -- SAVED COMPS -- */}
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
                            {c.status==="accepted"?"\u2705 Accepted":c.status==="passed"?"\u274C Passed":"\uD83D\uDCBE Saved"}
                          </span>
                          {z && canSeeFinancials && <span style={{ background:z.bg, color:z.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{z.label}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <span style={{ fontSize:11, color:"#AAAAAA" }}>Saved by</span>
                          <span style={{ fontWeight:700, fontSize:12, color:"#F0F0F0" }}>{c.savedBy||"--"}</span>
                          {savedByRole && <span style={{ background:savedByRole.bg, color:savedByRole.color, border:`1px solid ${savedByRole.color}33`, borderRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{savedByRole.label}</span>}
                          <span style={{ fontSize:11, color:"#D1D5DB" }}>&middot;</span>
                          <span style={{ fontSize:11, color:"#AAAAAA" }}>{savedAt}</span>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                        <button onClick={()=>loadComp(c)} style={{ background:"#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDCE5 Load into Builder"}</button>
                        {CAN_DELETE.includes(userRole?.role) && <button onClick={()=>{ if(window.confirm(`Delete this comp from history?\n\nSaved by: ${c.savedBy||"Unknown"}\nSeller: ${c.seller||"Unknown"}\n\nThis action will be logged.`)) onDeleteComp(c.id); }} style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1"}</button>}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:16, flexWrap:"wrap", paddingTop:8, borderTop:"1px solid #FFF0F5" }}>
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>Cards: <strong style={{color:"#F0F0F0"}}>{c.totalCards}</strong></span>
                      {canSeeFinancials && <>
                        <span style={{ fontSize:12, color:"#AAAAAA" }}>Market: <strong style={{color:"#AAAAAA"}}>${(c.totalMarket||0).toFixed(2)}</strong></span>
                        <span style={{ fontSize:12, color:"#AAAAAA" }}>Offer: <strong style={{color:"#E8317A"}}>${(c.offer||0).toFixed(2)}</strong></span>
                        <span style={{ fontSize:12, color:"#AAAAAA" }}>Blended: <strong style={{color:z?.color||"#F0F0F0"}}>{((c.blendedPct||0)*100).toFixed(1)}%</strong></span>
                      </>}
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>Source: <strong style={{color:"#F0F0F0"}}>{c.source||"--"}</strong></span>
                      <span style={{ fontSize:12, color:"#AAAAAA" }}>
                        {c.cards&&c.cards.length>0 ? <span style={{color:"#E8317A",fontWeight:700}}>{"\u2713"}{c.cards.length} card{c.cards.length!==1?"s":""} saved</span> : <span style={{color:"#AAAAAA",fontWeight:700}}>{"\u26A0 No card details"}</span>}
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
        <div className="lot-comp-grid" style={{ display:"grid", gridTemplateColumns: seller.name ? "1fr 300px" : "1fr", gap:14, alignItems:"start" }}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        {loadedCompId && (
          <div id="comp-builder-top" style={{ background: loadedCompHadCards ? "#D6F4E3" : "#FFF9DB", border: `1.5px solid ${loadedCompHadCards ? "#2E7D52" : "#92400e"}`, borderRadius:10, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:18 }}>{loadedCompHadCards ? "\u2705" : "\u26A0\uFE0F"}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color: loadedCompHadCards ? "#166534" : "#92400e" }}>
                  {loadedCompHadCards ? "Comp loaded -- ready to edit and import" : "Comp loaded -- no card data saved"}
                </div>
                <div style={{ fontSize:11, color:"#AAAAAA", marginTop:2 }}>
                  {loadedCompHadCards ? "All seller info, cards, and offer amount restored. Hit Accept & Import to add to inventory." : "Seller info and offer restored, but this comp was saved without per-card details. Add cards manually below."}
                </div>
              </div>
            </div>
            <button onClick={()=>setLoadedCompId(null)} style={{ background:"transparent", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:18, lineHeight:1 }}>{"\u2715"}</button>
          </div>
        )}
        <div id="comp-builder-top" style={S.card}>
          <SectionLabel t="Seller Information" />
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            {/* Seller Name with autocomplete from history */}
            {(() => {
              const prevSellers = [...new Map(
                [...comps].reverse()
                  .filter(c => c.seller)
                  .map(c => [c.seller.toLowerCase(), c])
              ).values()].slice(0, 50);

              const q = (seller.name||"").toLowerCase();
              const suggestions = q.length >= 1
                ? prevSellers.filter(c => c.seller.toLowerCase().includes(q) && c.seller.toLowerCase() !== q)
                : [];

              function fillSeller(comp) {
                setSeller(p => ({
                  ...p,
                  name: comp.seller||"",
                  contact: comp.contact||p.contact,
                  source: comp.source||p.source,
                  payment: comp.payment||p.payment,
                  paymentHandle: comp.paymentHandle||p.paymentHandle,
                }));
              }

              return (
                <Field label="Seller Name">
                  <div style={{ position:"relative" }}>
                    <input
                      type="text"
                      value={seller.name}
                      onChange={e => setSeller(p=>({...p, name:e.target.value}))}
                      placeholder="Seller name..."
                      style={S.inp}
                      autoComplete="off"
                    />
                    {suggestions.length > 0 && (
                      <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, zIndex:999, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.6)", maxHeight:240, overflowY:"auto" }}>
                        {suggestions.map((c,i) => {
                          const lastComp = comps.filter(x=>x.seller===c.seller).slice(-1)[0];
                          const totalBought = comps.filter(x=>x.seller===c.seller).reduce((s,x)=>s+(parseFloat(x.offer)||0),0);
                          const dealCount = comps.filter(x=>x.seller===c.seller).length;
                          return (
                            <div key={i} onMouseDown={()=>fillSeller(c)}
                              style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderBottom:"1px solid #111", cursor:"pointer", background:"#1a1a1a" }}
                              className="inv-row">
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:700, color:"#F0F0F0" }}>{c.seller}</div>
                                <div style={{ fontSize:10, color:"#555", marginTop:1 }}>
                                  {dealCount} deal{dealCount!==1?"s":""} &middot; ${Math.round(totalBought).toLocaleString()} total
                                  {c.source && <span style={{ marginLeft:6, color:"#7B9CFF" }}>{c.source}</span>}
                                </div>
                              </div>
                              <div style={{ textAlign:"right", flexShrink:0 }}>
                                {c.payment && <div style={{ fontSize:10, color:"#FBBF24" }}>{c.payment}</div>}
                                {lastComp?.date && <div style={{ fontSize:10, color:"#333" }}>Last: {lastComp.date}</div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </Field>
              );
            })()}
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
                {lotZone ? lotZone.label : totalMkt > 0 ? "--" : "Add cards first"}
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
              <thead><tr>{["#","Card Name","Card Type","Qty","Value/Card ($)","Total Value ($)","Offer/Card ($)","Zone","\u2713"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
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
                          {POOL_TYPES.includes(r.cardType) ? (
                            // Pool type -- show dropdown if pools exist, otherwise free text
                            cardPools.filter(p=>p.cardType===r.cardType).length > 0 ? (
                              <select
                                value={r.name}
                                onChange={e=>upd(r.id,"name",e.target.value)}
                                style={{ ...S.inp, padding:"5px 8px", fontSize:12, color:r.name?"#F0F0F0":"#9CA3AF", cursor:"pointer" }}
                              >
                                <option value="">-- Select Pool --</option>
                                {cardPools.filter(p=>p.cardType===r.cardType).map(p=>(
                                  <option key={p.id} value={p.cardName}>{p.cardName} ({(parseInt(p.totalQty)||0)-(parseInt(p.usedQty)||0)} avail)</option>
                                ))}
                                <option value="__new__">+ Type new name...</option>
                              </select>
                            ) : (
                              <input value={r.name} onChange={e=>upd(r.id,"name",e.target.value)} placeholder="Card name..." style={{ ...S.inp, padding:"5px 8px", fontSize:12, flex:1 }}/>
                            )
                          ) : (
                            // Individual type -- BoBA checklist autocomplete
                            <>
                              <div style={{ position:"relative", flex:1 }}>
                                <input
                                  value={acOpen === r.id ? (acQuery[r.id] ?? r.name) : r.name}
                                  onChange={e => {
                                    setAcOpen(r.id);
                                    setAcQuery(q => ({ ...q, [r.id]: e.target.value }));
                                    upd(r.id, "name", e.target.value);
                                  }}
                                  onFocus={() => {
                                    setAcOpen(r.id);
                                    setAcQuery(q => ({ ...q, [r.id]: r.name }));
                                  }}
                                  onBlur={() => setTimeout(() => setAcOpen(p => p === r.id ? null : p), 150)}
                                  placeholder="Type hero name or card #..."
                                  style={{ ...S.inp, padding:"5px 8px", fontSize:12, width:"100%" }}
                                />
                                {acOpen === r.id && (acQuery[r.id]||"").length >= 1 && (() => {
                                  const raw = (acQuery[r.id]||"").toLowerCase();
                                  // Multi-term fuzzy: split on spaces, every term must match somewhere
                                  const terms = raw.trim().split(/\s+/).filter(Boolean);
                                  const searchFields = c => [
                                    c.hero||"", c.weapon||"", c.treatment||"",
                                    String(c.cardNum||""), c.notation||"", c.setName||""
                                  ].join(" ").toLowerCase();
                                  const hits = bobaCards.filter(c =>
                                    terms.every(t => searchFields(c).includes(t))
                                  ).sort((a,b) => {
                                    const aHero = (a.hero||"").toLowerCase();
                                    const bHero = (b.hero||"").toLowerCase();
                                    // Exact hero match first, then startsWith, then contains
                                    const score = h => h === raw ? 0 : h.startsWith(terms[0]) ? 1 : 2;
                                    return score(aHero) - score(bHero) || aHero.localeCompare(bHero);
                                  });
                                  if (hits.length === 0) return null;
                                  return (
                                    <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, zIndex:999, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.6)", maxHeight:400, overflowY:"auto" }}>
                                      <div style={{ padding:"4px 10px", fontSize:10, color:"#555", borderBottom:"1px solid #111" }}>{hits.length} match{hits.length!==1?"es":""}</div>
                                      {hits.map(c => {
                                        const wc = PUBLIC_WEAPON_COLORS[c.weapon]||"#444";
                                        const label = [c.hero, c.treatment, c.weapon ? "("+c.weapon+")" : "", c.cardNum ? "#"+c.cardNum : ""].filter(Boolean).join(" -- ");
                                        return (
                                          <div key={c.id}
                                            onMouseDown={() => {
                                              upd(r.id, "name", label);
                                              setAcOpen(null);
                                              setAcQuery(q2 => ({ ...q2, [r.id]: label }));
                                            }}
                                            style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", cursor:"pointer", borderBottom:"1px solid #111" }}
                                            className="inv-row">
                                            {/* Card image -- large on hover via title tooltip, small inline */}
                                            <div style={{ position:"relative", flexShrink:0 }}>
                                              {c.imageUrl
                                                ? <img src={c.imageUrl} alt={c.hero} style={{ width:36, height:48, objectFit:"cover", borderRadius:4 }}/>
                                                : <div style={{ width:36, height:48, background:"#2a2a2a", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#555", textAlign:"center", padding:2 }}>{c.hero?.split(" ")[0]}</div>
                                              }
                                            </div>
                                            <div style={{ flex:1, minWidth:0 }}>
                                              <div style={{ fontSize:13, fontWeight:700, color:"#F0F0F0", marginBottom:2 }}>{c.hero}</div>
                                              <div style={{ display:"flex", gap:6, fontSize:10, flexWrap:"wrap" }}>
                                                <span style={{ color:"#555" }}>#{c.cardNum}</span>
                                                {c.weapon && <span style={{ color:wc, fontWeight:700 }}>{c.weapon}</span>}
                                                {c.treatment && <span style={{ color:"#888" }}>{c.treatment}</span>}
                                                {c.setName && <span style={{ color:"#444", fontStyle:"italic" }}>{c.setName}</span>}
                                              </div>
                                            </div>
                                            {c.power && <span style={{ fontSize:16, fontWeight:900, color:wc, flexShrink:0 }}>{c.power}</span>}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })()}
                              </div>
                              {r.name.trim() && (
                                <a
                                  href={`https://130point.com/sales/?sSearch=${encodeURIComponent(r.name.trim())}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Search on 130point"
                                  style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #E8317A44", borderRadius:6, padding:"4px 8px", fontSize:11, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap", flexShrink:0, display:"inline-flex", alignItems:"center" }}
                                >{"\uD83D\uDD0D"}</a>
                              )}
                            </>
                          )}
                          {r.name === "__new__" && (
                            <input autoFocus value={r._newName||""} onChange={e=>upd(r.id,"_newName",e.target.value)} onBlur={e=>{ if(e.target.value.trim()) upd(r.id,"name",e.target.value.trim()); }} placeholder="New pool name..." style={{ ...S.inp, padding:"5px 8px", fontSize:12, flex:1, marginTop:4 }}/>
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
                      <td style={S.td}>{cz?<Badge bg={cz.bg} color={cz.color}>{cz.label}</Badge>:<span style={{color:"#D1D5DB"}}>--</span>}</td>
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
              <span style={{ fontSize:12, color:"#AAAAAA" }}>Per Card: <strong style={{color:"#E8317A"}}>${totalCards>0?(dispOffer/totalCards).toFixed(2):"--"}</strong></span>
            </div>
          )}
          {/* Pay button -- appears when payment method + handle are filled */}
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
              Cash:       { color:"#E8317A", bg:"#D6F4E3", label:"Cash Payment",      hint:`$${amt||"--"} cash`, href:null },
            };
            const cfg = PCFG[seller.payment];
            if (!cfg) return null;
            return (
              <div style={{ marginBottom:16, padding:"14px 16px", background:cfg.bg, border:`2px solid ${cfg.color}33`, borderRadius:10, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>{"\uD83D\uDCB8 Send Payment"}</div>
                  <div style={{ fontWeight:800, fontSize:16, color:cfg.color }}>{cfg.hint}</div>
                  {amt && <div style={{ fontSize:12, color:"#AAAAAA", marginTop:2 }}>Amount: <strong style={{color:"#F0F0F0"}}>${amt}</strong></div>}
                </div>
                {cfg.href
                  ? <div style={{ display:"flex", flexDirection:"column", gap:6, alignItems:"flex-end" }}>
                      <a href={cfg.href} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:8, background:cfg.color, color:"#F0F0F0", borderRadius:9, padding:"12px 24px", fontSize:14, fontWeight:800, textDecoration:"none", whiteSpace:"nowrap" }}>{cfg.label} \u2192</a>
                      {cfg.webHref && <a href={cfg.webHref} target="_blank" rel="noreferrer" style={{ fontSize:11, color:cfg.color, textDecoration:"underline" }}>Open in browser instead</a>}
                    </div>
                  : <div style={{ background:cfg.color, color:"#F0F0F0", borderRadius:9, padding:"12px 24px", fontSize:14, fontWeight:800 }}>{seller.payment==="Cash"?`Pay $${amt} cash`:`Open ${seller.payment} \u2192 ${cfg.hint}`}</div>
                }
              </div>
            );
          })()}

          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
            <Btn onClick={()=>setCustView(true)} variant="ghost">{"\uD83D\uDC41 Customer View"}</Btn>
            <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"6px 12px", cursor:"pointer" }} onClick={()=>setAllowCounter(p=>!p)}>
              <div style={{ width:32, height:18, borderRadius:9, background:allowCounter?"#E8317A":"#333", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                <div style={{ position:"absolute", top:2, left:allowCounter?14:2, width:14, height:14, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
              </div>
              <span style={{ fontSize:11, fontWeight:700, color:allowCounter?"#E8317A":"#666", whiteSpace:"nowrap" }}>Counter Offer {allowCounter?"ON":"OFF"}</span>
            </div>
            <Btn onClick={async()=>{
              if (!onSaveQuote) return;
              const id = await onSaveQuote({
                seller, cards:included.map(r=>({ name:r.name, cardType:r.cardType, qty:parseInt(r.qty)||1, mktVal:parseFloat(r.mktVal)||0 })),
                dispOffer, dispPct, totalMkt, custNote,
                payment:seller.payment, paymentHandle:seller.paymentHandle,
                allowCounter,
              });
              const link = `${window.location.origin}/quote/${id}`;
              setQuoteLink(link);
              navigator.clipboard?.writeText(link);
              setQuoteCopied(true);
              setTimeout(()=>setQuoteCopied(false), 3000);
            }} variant="ghost" disabled={included.length===0}>{"\uD83D\uDD17 Share Quote"}</Btn>
            {quoteLink && (
              <div style={{ display:"flex", alignItems:"center", gap:8, background:"#0a1a0a", border:"1px solid #4ade8033", borderRadius:8, padding:"6px 12px", flex:1 }}>
                <span style={{ fontSize:11, color:"#4ade80", fontWeight:700 }}>{quoteCopied ? "\u2705 Copied!" : "\uD83D\uDD17"}</span>
                <span style={{ fontSize:11, color:"#888", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{quoteLink}</span>
                <button onClick={()=>{ navigator.clipboard?.writeText(quoteLink); setQuoteCopied(true); setTimeout(()=>setQuoteCopied(false),3000); }} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#888", cursor:"pointer", fontSize:11, padding:"2px 8px", fontFamily:"inherit", whiteSpace:"nowrap" }}>Copy</button>
                <a href={quoteLink} target="_blank" rel="noreferrer" style={{ color:"#E8317A", fontSize:11, textDecoration:"none", whiteSpace:"nowrap" }}>{"Open \u2197"}</a>
              </div>
            )}
            <Btn onClick={()=>saveComp("saved")} variant="ghost">{"\uD83D\uDCBE Save Comp"}</Btn>
            <Btn onClick={()=>saveComp("passed")} variant="ghost">{"\u274C Pass on Lot"}</Btn>
            <Btn onClick={()=>{saveComp("accepted");doAccept();}} disabled={included.length===0} variant="green">{"\u2705 Accept & Import"}{totalCards} card{totalCards!==1?"s":""}</Btn>
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
              {(counterAmt!=null&&counterAmt>0) && <span style={{ background:"#111111", color:"#AAAAAA", border:"1px solid #92400e33", borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700 }}>{"\u26A0 Counter is active -- overrides your offer"}</span>}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:12 }}>
              <div><label style={S.lbl}>Seller's Counter ($)</label><input type="number" value={counterOffer} onChange={e=>setCounterOffer(e.target.value)} placeholder="0.00" style={{ ...S.inp, border:(counterAmt!=null&&counterAmt>0)?"2px solid #E8317A":S.inp.border }}/></div>
              <div><label style={S.lbl}>Counter Zone</label><div style={{ ...S.inp, background:counterZone?.bg||"#F9FAFB", border:`1.5px solid ${counterZone?.color||"#E5E7EB"}`, color:counterZone?.color||"#9CA3AF", fontWeight:700 }}>{counterZone?counterZone.label:totalMkt>0?"Enter counter":"Add cards first"}</div></div>
              <div><label style={S.lbl}>Counter Buy %</label><div style={{ ...S.inp, color:(counterAmt!=null&&counterAmt>0)?(counterZone?.color||"#6B2D8B"):"#9CA3AF", fontWeight:700 }}>{(counterAmt!=null&&counterAmt>0)&&totalMkt>0?`${((counterAmt/totalMkt)*100).toFixed(1)}%`:"--"}</div></div>
              <div><label style={S.lbl}>vs Your Offer</label><div style={{ ...S.inp, color:(counterAmt!=null&&counterAmt>(offerAmt!=null&&offerAmt>0?offerAmt:calcOffer))?"#991b1b":"#166534", fontWeight:700 }}>{(counterAmt!=null&&counterAmt>0)&&calcOffer>0?`$${Math.abs(counterAmt-(offerAmt>0?offerAmt:calcOffer)).toFixed(2)} ${counterAmt>(offerAmt!=null&&offerAmt>0?offerAmt:calcOffer)?"over":"under"}`:"--"}</div></div>
            </div>
            {(counterAmt!=null&&counterAmt>0) && totalMkt > 0 && (
              <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:12, color:"#AAAAAA" }}>Active offer: <strong style={{color:"#F0F0F0"}}>${counterAmt.toFixed(2)}</strong> at <strong style={{color:counterZone?.color||"#F0F0F0"}}>{((counterAmt/totalMkt)*100).toFixed(1)}%</strong> -- card values and zones updated</span>
                <button onClick={()=>setCounterOffer("")} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:12, fontWeight:700, textDecoration:"underline" }}>Clear</button>
              </div>
            )}
          </div>
        </div>
        </div>{/* end left column */}

        {/* Seller Intelligence Panel -- right column */}
        {seller.name && (() => {
          const sellerComps = comps.filter(c => (c.seller||"").toLowerCase() === seller.name.toLowerCase());
          if (sellerComps.length === 0) return (
            <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:10, padding:"20px 16px", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, minHeight:160, color:"#333", position:"sticky", top:80 }}>
              <div style={{ fontSize:24 }}>{"\uD83C\uDD95"}</div>
              <div style={{ fontSize:12, fontWeight:700, color:"#555" }}>New seller</div>
              <div style={{ fontSize:11, color:"#333", textAlign:"center" }}>No previous history with {seller.name}</div>
            </div>
          );
          const totalPaid    = sellerComps.reduce((s,c)=>s+(parseFloat(c.offer)||0),0);
          const totalMktVal  = sellerComps.reduce((s,c)=>s+(parseFloat(c.totalMarket)||0),0);
          const avgPct       = totalMktVal > 0 ? totalPaid/totalMktVal : 0;
          const accepted     = sellerComps.filter(c=>c.status==="accepted").length;
          const declined     = sellerComps.filter(c=>c.status==="declined").length;
          const pending      = sellerComps.filter(c=>c.status==="pending").length;
          const counterCount = sellerComps.filter(c=>c.status==="countered").length;
          const avgLotSize   = sellerComps.reduce((s,c)=>s+(c.totalCards||0),0)/sellerComps.length;
          const sorted       = [...sellerComps].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
          const statColor    = p => p > 0.65 ? "#E8317A" : p > 0.55 ? "#FBBF24" : "#4ade80";
          return (
            <div style={{ display:"flex", flexDirection:"column", gap:10, position:"sticky", top:80 }}>
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 16px" }}>
                <div style={{ fontSize:14, fontWeight:900, color:"#F0F0F0", marginBottom:2 }}>{seller.name}</div>
                <div style={{ fontSize:11, color:"#555" }}>{sellerComps.length} deal{sellerComps.length!==1?"s":""} &middot; Last: {sorted[0]?.date||"--"}</div>
                {seller.contact && <div style={{ fontSize:11, color:"#7B9CFF", marginTop:4 }}>{seller.contact}</div>}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {[
                  { l:"Total Paid",   v:`$${Math.round(totalPaid).toLocaleString()}`,      c:"#4ade80" },
                  { l:"Avg % of Mkt", v:`${Math.round(avgPct*100)}%`,                      c:statColor(avgPct) },
                  { l:"Avg Lot Size", v:`${Math.round(avgLotSize)} cards`,                 c:"#7B9CFF" },
                  { l:"Accept Rate",  v:sellerComps.length>0?`${Math.round(accepted/sellerComps.length*100)}%`:"--", c:"#4ade80" },
                ].map(({l,v,c})=>(
                  <div key={l} style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Outcomes</div>
                {[{l:"\u2705 Accepted",v:accepted,c:"#4ade80"},{l:"\u274C Declined",v:declined,c:"#E8317A"},{l:"\uD83E\uDD1D Countered",v:counterCount,c:"#FBBF24"},{l:"\u23F3 Pending",v:pending,c:"#555"}].filter(x=>x.v>0).map(({l,v,c})=>(
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                    <span style={{ fontSize:12, color:"#888" }}>{l}</span>
                    <span style={{ fontSize:12, fontWeight:700, color:c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:"#111", border:"1px solid #1a1a1a", borderRadius:10, overflow:"hidden" }}>
                <div style={{ padding:"10px 14px 6px", fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Deal History</div>
                <div style={{ maxHeight:300, overflowY:"auto" }}>
                  {sorted.map((c,i)=>{ const p=c.totalMarket>0?c.offer/c.totalMarket:0; const sc={accepted:"#4ade80",declined:"#E8317A",countered:"#FBBF24",pending:"#555"}; return (
                    <div key={c.id||i} style={{ padding:"8px 14px", borderTop:"1px solid #1a1a1a", background:i%2===0?"#0d0d0d":"#111" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                        <span style={{ fontSize:11, color:"#555" }}>{c.date||"--"}</span>
                        <span style={{ fontSize:10, fontWeight:700, color:sc[c.status]||"#555", textTransform:"capitalize" }}>{c.status||"--"}</span>
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <span style={{ fontSize:11, color:"#888" }}>{c.totalCards||0} cards &middot; ${Math.round(c.totalMarket||0).toLocaleString()} mkt</span>
                        <span style={{ fontSize:12, fontWeight:700, color:statColor(p) }}>${Math.round(c.offer||0).toLocaleString()} ({Math.round(p*100)}%)</span>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            </div>
          );
        })()}

        </div>{/* end grid */}
      </>}
    </div>
  );
}


// --- CARD POOL GLOBALS ---------------------------------------
const DEFAULT_PARALLELS = ["Base","Silver","Gold","Holo","Refractor","Auto","Prizm","Optic","Color Match","Superfractor","1/1","Other"];

// --- CARD POOLS ----------------------------------------------
function CardPools({ cardPools=[], onSavePool, onDeletePool, onLogPoolOut, onAddToPool, userRole, canSeeFinancials }) {
  const isAdmin = ["Admin"].includes(userRole?.role);
  const EMPTY_POOL = { cardName:"", cardType:"Giveaway Cards", totalQty:"", costPerCard:"", marketValue:"", notes:"" };
  const [form,       setForm]       = useState(EMPTY_POOL);
  const [editing,    setEditing]    = useState(null); // pool id or "new"
  const [logForm,    setLogForm]    = useState({ poolId:"", qty:"", breaker:BREAKERS[0], date:new Date().toISOString().split("T")[0], usage:"Giveaway" });
  const [addForm,    setAddForm]    = useState({ poolId:"", qty:"" });
  const [showLog,    setShowLog]    = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);

  const poolsByType = POOL_TYPES.reduce((acc, t) => {
    acc[t] = cardPools.filter(p => p.cardType === t);
    return acc;
  }, {});

  const totalCards = cardPools.reduce((s,p)=>(s+(parseInt(p.totalQty)||0)),0);
  const totalUsed  = cardPools.reduce((s,p)=>(s+(parseInt(p.usedQty)||0)),0);
  const totalAvail = totalCards - totalUsed;

  function startNew() { setForm(EMPTY_POOL); setEditing("new"); }
  function startEdit(p) { setForm({ cardName:p.cardName, cardType:p.cardType, totalQty:p.totalQty||"", costPerCard:p.costPerCard||"", marketValue:p.marketValue||"", notes:p.notes||"" }); setEditing(p.id); }
  function cancelEdit() { setEditing(null); setForm(EMPTY_POOL); }

  async function savePool() {
    if (!form.cardName.trim()) return;
    const data = { cardName:form.cardName.trim(), cardType:form.cardType, totalQty:parseInt(form.totalQty)||0, usedQty:editing!=="new" ? (cardPools.find(p=>p.id===editing)?.usedQty||0) : 0, costPerCard:parseFloat(form.costPerCard)||0, marketValue:parseFloat(form.marketValue)||0, notes:form.notes };
    if (editing !== "new") data.id = editing;
    await onSavePool(data);
    cancelEdit();
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Stats */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
        {[
          { l:"Total in Pools",    v:totalCards, c:"#F0F0F0" },
          { l:"Used This Cycle",   v:totalUsed,  c:totalUsed>0?"#E8317A":"#333" },
          { l:"Available",         v:totalAvail, c:totalAvail>100?"#4ade80":"#FBBF24" },
        ].map(({l,v,c})=>(
          <div key={l} style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:28, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:10, color:"#666", textTransform:"uppercase", letterSpacing:1, marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display:"flex", gap:8 }}>
        <Btn onClick={startNew} variant="green">+ New Pool</Btn>
        <Btn onClick={()=>setShowLog(p=>!p)} variant="ghost">{"\uD83D\uDCE4 Log Out Cards"}</Btn>
        <Btn onClick={()=>setShowAdd(p=>!p)} variant="ghost">{"\uD83D\uDCE5 Add to Pool"}</Btn>
        {isAdmin && cardPools.length > 0 && <Btn onClick={async()=>{ if(window.confirm(`Reset ALL ${cardPools.length} pools to 0? This clears all totals and used qtys.`)) { for(const p of cardPools) await onSavePool({...p, totalQty:0, usedQty:0}); }}} variant="ghost" style={{ color:"#FBBF24", border:"1px solid #FBBF2444" }}>{"\u21BA Reset All"}</Btn>}
      </div>

      {/* Log Out form */}
      {showLog && (
        <div style={{ ...S.card, border:"1px solid #E8317A33" }}>
          <SectionLabel t="\uD83D\uDCE4 Log Cards Out of Pool" />
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr auto", gap:10, alignItems:"end" }}>
            <div>
              <label style={S.lbl}>Pool</label>
              <select value={logForm.poolId} onChange={e=>setLogForm(p=>({...p,poolId:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                <option value="">-- Select Pool --</option>
                {cardPools.map(p=>{
                  const avail=(parseInt(p.totalQty)||0)-(parseInt(p.usedQty)||0);
                  return <option key={p.id} value={p.id}>{p.cardName} ({avail} avail)</option>;
                })}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Qty</label>
              <input type="number" min="1" value={logForm.qty} onChange={e=>setLogForm(p=>({...p,qty:e.target.value}))} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Breaker</label>
              <select value={logForm.breaker} onChange={e=>setLogForm(p=>({...p,breaker:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                {BREAKERS.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Date</label>
              <input type="date" value={logForm.date} onChange={e=>setLogForm(p=>({...p,date:e.target.value}))} style={S.inp}/>
            </div>
            <Btn onClick={async()=>{
              if (!logForm.poolId||!logForm.qty) return;
              const pool = cardPools.find(p=>p.id===logForm.poolId);
              const avail = (parseInt(pool?.totalQty)||0)-(parseInt(pool?.usedQty)||0);
              if (parseInt(logForm.qty) > avail) { alert(`Only ${avail} available in this pool`); return; }
              await onLogPoolOut(logForm.poolId, parseInt(logForm.qty), logForm.breaker, logForm.date, logForm.usage);
              setLogForm(p=>({...p,qty:""}));
              setShowLog(false);
            }} variant="green" disabled={!logForm.poolId||!logForm.qty}>{"\u2705 Log Out"}</Btn>
          </div>
        </div>
      )}

      {/* Add to Pool form */}
      {showAdd && (
        <div style={{ ...S.card, border:"1px solid #4ade8033" }}>
          <SectionLabel t="\uD83D\uDCE5 Add Cards to Pool" />
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr auto", gap:10, alignItems:"end" }}>
            <div>
              <label style={S.lbl}>Pool</label>
              <select value={addForm.poolId} onChange={e=>setAddForm(p=>({...p,poolId:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                <option value="">-- Select Pool --</option>
                {cardPools.map(p=><option key={p.id} value={p.id}>{p.cardName} (currently {parseInt(p.totalQty)||0})</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Qty to Add</label>
              <input type="number" min="1" value={addForm.qty} onChange={e=>setAddForm(p=>({...p,qty:e.target.value}))} style={S.inp}/>
            </div>
            <Btn onClick={async()=>{
              if (!addForm.poolId||!addForm.qty) return;
              await onAddToPool(addForm.poolId, parseInt(addForm.qty));
              setAddForm({poolId:"",qty:""});
              setShowAdd(false);
            }} variant="green" disabled={!addForm.poolId||!addForm.qty}>{"\u2705 Add"}</Btn>
          </div>
        </div>
      )}

      {/* New/Edit pool form */}
      {editing && (
        <div style={{ ...S.card, border:"2px solid #E8317A44" }}>
          <SectionLabel t={editing==="new"?"New Card Pool":"Edit Pool"} />
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={S.lbl}>Card Name</label>
              <input value={form.cardName} onChange={e=>setForm(p=>({...p,cardName:e.target.value}))} placeholder="e.g. Silver Battlefoil" style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Card Type</label>
              <select value={form.cardType} onChange={e=>setForm(p=>({...p,cardType:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                {POOL_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={S.lbl}>Starting Qty</label>
              <input type="number" min="0" value={form.totalQty} onChange={e=>setForm(p=>({...p,totalQty:e.target.value}))} style={S.inp} disabled={editing!=="new"}/>
            </div>
            <div>
              <label style={S.lbl}>Cost Per Card ($)</label>
              <input type="number" step="0.01" value={form.costPerCard} onChange={e=>setForm(p=>({...p,costPerCard:e.target.value}))} style={S.inp}/>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr", gap:10, marginBottom:10 }}>
            <div>
              <label style={S.lbl}>Market Value Per Card ($)</label>
              <input type="number" step="0.01" value={form.marketValue} onChange={e=>setForm(p=>({...p,marketValue:e.target.value}))} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Notes</label>
              <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Optional notes" style={S.inp}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn onClick={savePool} variant="green" disabled={!form.cardName.trim()}>{"\uD83D\uDCBE Save Pool"}</Btn>
            <Btn onClick={cancelEdit} variant="ghost">Cancel</Btn>
          </div>
        </div>
      )}

      {/* Pool list by type */}
      {POOL_TYPES.map(type => {
        const pools = poolsByType[type] || [];
        const cc = CC[type] || { text:"#888", bg:"#111", border:"#333" };
        return (
          <div key={type}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
              <span style={{ fontWeight:800, color:cc.text, fontSize:13, textTransform:"uppercase", letterSpacing:1 }}>{type}</span>
              <span style={{ fontSize:11, color:"#555" }}>{pools.length} pool{pools.length!==1?"s":""}</span>
            </div>
            {pools.length === 0
              ? <div style={{ color:"#333", fontSize:12, padding:"10px 0" }}>No {type} pools yet</div>
              : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {pools.map(p => {
                    const avail = (parseInt(p.totalQty)||0) - (parseInt(p.usedQty)||0);
                    const pct   = parseInt(p.totalQty)>0 ? (avail/parseInt(p.totalQty))*100 : 0;
                    const statusC = avail > 100 ? "#4ade80" : avail > 30 ? "#FBBF24" : "#E8317A";
                    return (
                      <div key={p.id} style={{ ...S.card, display:"grid", gridTemplateColumns:"1fr auto auto auto auto auto auto", gap:12, alignItems:"center", padding:"12px 16px" }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:14, color:"#F0F0F0" }}>{p.cardName}</div>
                          {p.notes && <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{p.notes}</div>}
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontSize:20, fontWeight:900, color:"#F0F0F0" }}>{parseInt(p.totalQty)||0}</div>
                          <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Total</div>
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontSize:20, fontWeight:900, color:p.usedQty>0?"#E8317A":"#333" }}>{parseInt(p.usedQty)||0}</div>
                          <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Used</div>
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontSize:20, fontWeight:900, color:statusC }}>{avail}</div>
                          <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Avail</div>
                        </div>
                        {canSeeFinancials && p.costPerCard>0 && (
                          <div style={{ textAlign:"center" }}>
                            <div style={{ fontSize:13, fontWeight:700, color:"#888" }}>${parseFloat(p.costPerCard).toFixed(2)}</div>
                            <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Cost/Card</div>
                          </div>
                        )}
                        {/* Progress bar */}
                        <div style={{ width:80 }}>
                          <div style={{ background:"#1a1a1a", borderRadius:4, height:6, overflow:"hidden" }}>
                            <div style={{ width:`${Math.max(0,Math.min(100,pct))}%`, height:"100%", background:statusC, borderRadius:4, transition:"width 0.3s" }}/>
                          </div>
                          <div style={{ fontSize:9, color:"#555", marginTop:3, textAlign:"center" }}>{pct.toFixed(0)}% left</div>
                        </div>
                        <div style={{ display:"flex", gap:6 }}>
                          {isAdmin && <button onClick={async()=>{ if(window.confirm(`Reset ${p.cardName} to 0? This clears total and used qty.`)) { await onSavePool({ ...p, totalQty:0, usedQty:0 }); }}} style={{ background:"none", border:"1px solid #FBBF2444", color:"#FBBF24", borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }} title="Reset qty to 0">{"\u21BA Reset"}</button>}
                          {isAdmin && <button onClick={()=>startEdit(p)} style={{ background:"none", border:"1px solid #333", color:"#888", borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\u270F\uFE0F"}</button>}
                          {isAdmin && <button onClick={()=>{ if(window.confirm(`Delete ${p.cardName} pool?`)) onDeletePool(p.id); }} style={{ background:"none", border:"1px solid #E8317A33", color:"#E8317A", borderRadius:6, padding:"3px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1"}</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
            }
          </div>
        );
      })}

      {cardPools.length === 0 && !editing && (
        <div style={{ ...S.card, textAlign:"center", padding:"60px 40px", color:"#555" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>{"\uD83D\uDDC3"}</div>
          <div>No card pools yet -- click <strong style={{color:"#E8317A"}}>+ New Pool</strong> to create your first pool</div>
        </div>
      )}
    </div>
  );
}

function Inventory({ inventory, breaks, onRemove, onBulkRemove, onSaveCardCost, onPutBack, onAdd, user, userRole, streams=[], lotTracking={}, onSaveLotTracking, lotNotes={}, onSaveLotNotes, onDeleteLot, shipments=[], productUsage=[], onSaveShipment, onDeleteShipment, skuPrices={}, onSaveSkuPrices, skuPriceHistory=[], onDeleteProductUsage, cardPools=[], onSavePool, onDeletePool, onLogPoolOut, onAddToPool, bobaCards=[] }) {
  const canSeeFinancials = ["Admin"].includes(userRole?.role);
  const [trackingEdit,   setTrackingEdit]   = useState(null);
  const [trackingForm,   setTrackingForm]   = useState({ carrier:"", trackingNum:"", status:"", eta:"", notes:"" });

  const [search,   setSearch]   = useState("");
  const [typeF,    setTypeF]    = useState("");
  const [statusF,  setStatusF]  = useState("available");
  const [sortInv,  setSortInv]  = useState("date");
  const [logOutCard, setLogOutCard] = useState(null);
  const [logOutForm, setLogOutForm] = useState({ breaker:BREAKERS[0], date:new Date().toISOString().split("T")[0], usage:"Giveaway" });
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
  }).sort((a,b) => {
    if (sortInv==="name")    return (a.cardName||"").localeCompare(b.cardName||"");
    if (sortInv==="mv_desc") return (b.marketValue||0)-(a.marketValue||0);
    if (sortInv==="mv_asc")  return (a.marketValue||0)-(b.marketValue||0);
    if (sortInv==="cost_desc") return (b.costPerCard||0)-(a.costPerCard||0);
    if (sortInv==="cost_asc")  return (a.costPerCard||0)-(b.costPerCard||0);
    if (sortInv==="type")    return (a.cardType||"").localeCompare(b.cardType||"");
    // default: date desc
    return new Date(b.dateAdded||0)-new Date(a.dateAdded||0);
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
          {[["cards","\uD83D\uDCE6 Cards"],["pools","\uD83D\uDDC3 Card Pools"],...(["Admin","Procurement"].includes(userRole?.role)?[["lots","\uD83D\uDDC2 Lot History"]]:[]),["product","\uD83C\uDF81 Product"]].map(([id,label]) => (
            <button key={id} onClick={()=>setInvTab(id)} style={{ background:invTab===id?"#1A1A2E":"transparent", color:invTab===id?"#E8317A":"#9CA3AF", border:`1.5px solid ${invTab===id?"#E8317A":"#E5E7EB"}`, borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
          ))}
        </div>

        {invTab==="lots" && (() => {
          const lots = {};
          inventory.forEach(c => {
            const key = `${c.seller||"Unknown"}__${c.date||"Unknown"}`;
            if (!lots[key]) lots[key] = { key, seller:c.seller||"Unknown", date:c.date||"Unknown", source:c.source||"--", payment:c.payment||"--", lotPaid:c.lotTotalPaid||0, cards:[], addedBy:c.addedBy||"--" };
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
                  <span style={{ fontSize:12, color:"#AAAAAA" }}>{"\u26A0"}{orphanedNotes.length} note{orphanedNotes.length!==1?"s":""} from previous lots couldn't be matched automatically.</span>
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
                              <span style={{ fontSize:12, color:"#AAAAAA" }}>{lot.source}{canSeeFinancials?` &middot; ${lot.payment}`:""}</span>
                              {canSeeFinancials && <span style={{ fontWeight:700, color:"#E8317A" }}>${lot.lotPaid.toFixed(2)}</span>}
                              {CAN_DELETE.includes(userRole?.role) && (
                                <button
                                  onClick={() => onDeleteLot(lot.key, lot.cards.map(c=>c.id))}
                                  style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:7, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                  title="Delete entire lot">{"\uD83D\uDDD1 Delete Lot"}</button>
                              )}
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:16, flexWrap:"wrap", marginBottom:8 }}>
                            <span style={{ fontSize:12, color:"#AAAAAA" }}>Total: <strong style={{color:"#F0F0F0"}}>{lot.cards.length}</strong></span>
                            <span style={{ fontSize:12, color:"#AAAAAA" }}>Available: <strong style={{color:"#E8317A"}}>{availInLot}</strong></span>
                            {transitInLot > 0 && <span style={{ fontSize:12, color:"#AAAAAA" }}>In Transit: <strong style={{color:"#F0F0F0"}}>{"\uD83D\uDE9A"}{transitInLot}</strong></span>}
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
                                  <span style={{ fontSize:11, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>{"\uD83D\uDCE6 Tracking"}</span>
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
                                            return <a key="tlink" href={url} target="_blank" rel="noreferrer" style={{ fontSize:12, color:"#E8317A", fontWeight:700, fontFamily:"monospace", textDecoration:"none" }}>{num} \u2197</a>;
                                          })()}
                                        {tracking.lastChecked && <span style={{ fontSize:10, color:"#D1D5DB" }}>&middot; checked {new Date(tracking.lastChecked).toLocaleString()}</span>}
                                      </>
                                    : <span style={{ fontSize:12, color:"#D1D5DB" }}>No tracking added yet</span>
                                  }
                                </div>
                                <div style={{ display:"flex", gap:8, flexShrink:0 }}>
                                  {tracking.trackingNum && tracking.status !== "Delivered" && (
                                    <button
                                      onClick={() => onSaveLotTracking(lot.key, { ...tracking, status:"Delivered" })}
                                      style={{ background:"#166534", color:"#fff", border:"1.5px solid #14532d", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                    >{"\u2705 Mark Delivered"}</button>
                                  )}
                                  {tracking.status === "Delivered" && (
                                    <button
                                      onClick={() => onSaveLotTracking(lot.key, { ...tracking, status:"In Transit" })}
                                      style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                    >{"\u21A9 Undo Delivered"}</button>
                                  )}
                                  <button
                                    onClick={() => { setTrackingEdit(lot.key); setTrackingForm({ carrier:tracking.carrier||"", trackingNum:tracking.trackingNum||"", status:tracking.status||"", eta:tracking.eta||"", notes:tracking.notes||"" }); }}
                                    style={{ background:"transparent", border:"1.5px solid #E8317A", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}
                                  >{tracking.trackingNum ? "\u270F\uFE0F Edit" : "+ Add Tracking"}</button>
                                </div>
                              </div>
                              {/* ETA + last event row */}
                              {(tracking.eta || tracking.lastEvent) && (
                                <div style={{ display:"flex", gap:16, flexWrap:"wrap", padding:"8px 12px", background:"#111111", borderRadius:7, marginTop:4 }}>
                                  {tracking.eta && (
                                    <span style={{ fontSize:12, color:"#AAAAAA" }}>
                                      {"\uD83D\uDCC5 Est. Delivery:"}<strong style={{ color: tracking.status==="Delivered" ? "#166534" : "#1B4F8A" }}>{tracking.eta}</strong>
                                    </span>
                                  )}
                                  {tracking.lastEvent && (
                                    <span style={{ fontSize:12, color:"#AAAAAA" }}>
                                      {"\uD83D\uDCCD"}{tracking.lastLocation && <strong style={{color:"#F0F0F0"}}>{tracking.lastLocation} -- </strong>}{tracking.lastEvent}
                                    </span>
                                  )}

                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color:"#E8317A", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>{"\uD83D\uDCE6 Edit Tracking"}</div>
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
                                >{"\uD83D\uDCBE Save Tracking"}</button>

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
                ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"40px 0" }}>{"\uD83C\uDF89 No aging cards!"}</div>
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
      {invTab==="product"   && <ProductInventory shipments={shipments} productUsage={productUsage} onSaveShipment={onSaveShipment} onDeleteShipment={onDeleteShipment} onDeleteProductUsage={onDeleteProductUsage} user={user} userRole={userRole} skuPrices={skuPrices} onSaveSkuPrices={onSaveSkuPrices} streams={streams} skuPriceHistory={skuPriceHistory}/>}

      {invTab==="pools" && <CardPools cardPools={cardPools} onSavePool={onSavePool} onDeletePool={onDeletePool} onLogPoolOut={onLogPoolOut} onAddToPool={onAddToPool} userRole={userRole} canSeeFinancials={canSeeFinancials}/>}

      {invTab==="cards" && <>
        <div style={S.card}>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search card name..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
            <select value={typeF} onChange={e=>setTypeF(e.target.value)} style={{ ...S.inp, width:"auto", minWidth:160, color:typeF?"#F0F0F0":"#9CA3AF", cursor:"pointer" }}>
              <option value="">All Types</option>
              {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct}</option>)}
            </select>
            <select value={sortInv} onChange={e=>setSortInv(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
              <option value="date">Sort: Date Added</option>
              <option value="name">{"Sort: Name A\u2192Z"}</option>
              <option value="type">Sort: Type</option>
              <option value="mv_desc">{"Sort: MV High\u2192Low"}</option>
              <option value="mv_asc">{"Sort: MV Low\u2192High"}</option>
              <option value="cost_desc">{"Sort: Cost High\u2192Low"}</option>
              <option value="cost_asc">{"Sort: Cost Low\u2192High"}</option>
            </select>
            <div style={{ display:"flex", gap:4 }}>
              {[["available","\u2705 Available"],["in_transit","\uD83D\uDE9A In Transit"],["used","\uD83D\uDD34 Used"],["all","All"]].map(([val,label]) => (
                <button key={val} onClick={()=>setStatusF(val)} style={{ background:statusF===val?"#1A1A2E":"transparent", color:statusF===val?"#E8317A":"#9CA3AF", border:`1.5px solid ${statusF===val?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"6px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{label}</button>
              ))}
            </div>
            <span style={{ color:"#AAAAAA", fontSize:12 }}>{filtered.length} cards</span>
            {selected.size>0 && CAN_DELETE.includes(userRole?.role) && (
              <button onClick={handleBulkDelete} style={{ background:"#111111", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1 Delete"}{selected.size} selected</button>
            )}
          </div>
        </div>
        <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:900 }}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width:40, textAlign:"center" }}><input type="checkbox" checked={filtered.length>0&&selected.size===filtered.length} onChange={toggleAll}/></th>
                  {["Card Name","Type",...(canSeeFinancials?["Market Value","Cost/Card","Lot Paid","Payment"]:[]),"Source","Seller","Date","Added By","Status",""].map(h=><th key={h} style={S.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0 ? <EmptyRow msg="No cards yet -- accept a lot comp to add cards." cols={12}/> :
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
                            {isAging && <span style={{ background:"#1a1400", color:"#AAAAAA", border:"1px solid #FDE68A", borderRadius:4, padding:"1px 6px", fontSize:10, fontWeight:700 }}>{"\u23F0"}{daysIn}d</span>}
                          </div>
                        </td>
                        <td style={S.td}><Badge bg={cc.bg} color={cc.text}>{c.cardType}</Badge></td>
                        {canSeeFinancials && <>
                          <td style={{ ...S.td, color:"#AAAAAA", fontWeight:700 }}>${(c.marketValue||0).toFixed(2)}</td>
                          <td style={{ ...S.td, color:"#4ade80", fontWeight:700 }}>${(c.costPerCard||0).toFixed(2)}</td>
                          <td style={{ ...S.td, color:"#AAAAAA" }}>${(c.lotTotalPaid||0).toFixed(2)}</td>
                          <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.payment||"--"}</td>
                        </>}
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.source||"--"}</td>
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.seller||"--"}</td>
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:11 }}>{c.date||"--"}</td>
                        <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{c.addedBy||"--"}</td>
                        <td style={S.td}>{used
                          ? <Badge bg="#FEE2E2" color="#991b1b">Used</Badge>
                          : c.cardStatus==="in_transit"
                            ? <Badge bg="#EEF0FB" color="#2C3E7A">{"\uD83D\uDE9A In Transit"}</Badge>
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
                                      onRemove(c.id); // we'll need a save handler -- see note below
                                      setEditCostId(null);
                                    }
                                    if (e.key==="Escape") setEditCostId(null);
                                  }}
                                />
                                <button onClick={async()=>{
                                  const newCost = parseFloat(editCostVal)||0;
                                  await onSaveCardCost(c.id, newCost);
                                  setEditCostId(null);
                                }} style={{ background:"#166534", color:"#fff", border:"none", borderRadius:5, padding:"3px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\u2713"}</button>
                                <button onClick={()=>setEditCostId(null)} style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:13 }}>{"\u2715"}</button>
                              </>
                            ) : (
                              <>
                                {canSeeFinancials && <button onClick={()=>{ setEditCostId(c.id); setEditCostVal((c.costPerCard||0).toFixed(2)); }} style={{ background:"none", border:"1px solid #333", color:"#888", borderRadius:5, padding:"2px 7px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }} title="Edit cost">{"\u270F\uFE0F"}</button>}
                                {!usedIds.has(c.id) && <button onClick={()=>setLogOutCard(c)} style={{ background:"#1a0a0f", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{"\uD83D\uDCE4 Log Out"}</button>}
                                {CAN_DELETE.includes(userRole?.role) && <button onClick={()=>onRemove(c.id)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:14 }}>{"\u2715"}</button>}
                                {usedIds.has(c.id) && onPutBack && CAN_DELETE.includes(userRole?.role) && (
                                  <button onClick={()=>{ if(window.confirm(`Put "${c.cardName}" back in inventory?`)) onPutBack(c.id); }} style={{ background:"#0a1a0a", border:"1px solid #4ade8033", color:"#4ade80", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{"\u21A9 Put Back"}</button>
                                )}
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

      {/* Log Out Card Modal */}
      {logOutCard && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setLogOutCard(null)}>
          <div style={{ background:"#111111", border:"1.5px solid #E8317A44", borderRadius:14, padding:"24px", width:380, maxWidth:"90vw" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:15, color:"#F0F0F0", marginBottom:4 }}>{"\uD83D\uDCE4 Log Out Card"}</div>
            <div style={{ fontSize:12, color:"#888", marginBottom:16 }}>{logOutCard.cardName} &middot; {logOutCard.cardType}</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div>
                <label style={S.lbl}>Breaker</label>
                <select value={logOutForm.breaker} onChange={e=>setLogOutForm(p=>({...p,breaker:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                  {BREAKERS.map(b=><option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Date</label>
                <input type="date" value={logOutForm.date} onChange={e=>setLogOutForm(p=>({...p,date:e.target.value}))} style={S.inp}/>
              </div>
              <div>
                <label style={S.lbl}>Usage Type</label>
                <select value={logOutForm.usage} onChange={e=>setLogOutForm(p=>({...p,usage:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                  <option value="Giveaway">Giveaway</option>
                  <option value="Insurance">Insurance</option>
                  <option value="First-Timer Pack">First-Timer Pack</option>
                  <option value="Chaser">Chaser Pull</option>
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:16 }}>
              <Btn onClick={async()=>{
                const entry = { id:uid(), date:logOutForm.date, breaker:logOutForm.breaker, inventoryId:logOutCard.id, cardName:logOutCard.cardName, cardType:logOutCard.cardType, usage:logOutForm.usage, notes:"Logged from Inventory", dateAdded:new Date().toISOString(), loggedBy:user?.displayName||"Unknown" };
                if (onAdd) await onAdd(entry);
                setLogOutCard(null);
              }} variant="green">{"\u2705 Log Out"}</Btn>
              <Btn onClick={()=>setLogOutCard(null)} variant="ghost">Cancel</Btn>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}

function BreakLog({ inventory, breaks, onAdd, onBulkAdd, onDeleteBreak, user, userRole, streams=[], onSaveStream, onDeleteStream, productUsage=[], onSaveProductUsage, shipments=[], recapOnly=false, cardsOnly=false, skuPrices={}, onUpsertBuyers, cardPools=[], imcFormUrl="", onSaveImcFormUrl }) {
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
  const [streamBulkSel, setStreamBulkSel] = useState(new Set());
  const [streamLogBreaker, setStreamLogBreaker] = useState("");

  // Stream recap state
  const EMPTY_RECAP = { grossRevenue:"", whatnotFees:"", coupons:"", whatnotPromo:"", magpros:"", packagingMaterial:"", topLoaders:"", magprosQty:"", packagingQty:"", topLoadersQty:"", chaserCards:"", chaserCardIds:"", marketMultiple:"", newBuyers:"", binOnly:false, breakType:"auction", sessionType:"", commissionOverride:"", streamNotes:"", zionRevenue:"", collabPartner:"", collabPct:"", streamSkuPrices:{} };
  const EMPTY_USAGE = { doubleMega:"", hobby:"", jumbo:"", misc:"", miscNotes:"" };
  const [recap,       setRecap]       = useState(EMPTY_RECAP);
  const [prodUsage,   setProdUsage]   = useState(EMPTY_USAGE);
  const [recapSaving, setRecapSaving] = useState(false);
  const [recapSaved,  setRecapSaved]  = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const csvJustLoaded = useRef(false);
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
    if (csvJustLoaded.current) { csvJustLoaded.current = false; return; }
    if (existingStream) {
      const prodFields = PRODUCT_TYPES.reduce((acc,pt) => { acc[`prod_${pt}`] = existingStream[`prod_${pt}`]||""; return acc; }, {});
      setRecap({ grossRevenue:existingStream.grossRevenue||"", whatnotFees:existingStream.whatnotFees||"", coupons:existingStream.coupons||"", whatnotPromo:existingStream.whatnotPromo||"", magpros:existingStream.magpros||"", packagingMaterial:existingStream.packagingMaterial||"", topLoaders:existingStream.topLoaders||"", magprosQty:existingStream.magprosQty||"", packagingQty:existingStream.packagingQty||"", topLoadersQty:existingStream.topLoadersQty||"", chaserCards:existingStream.chaserCards||"", chaserCardIds:existingStream.chaserCardIds||"", marketMultiple:existingStream.marketMultiple||"", newBuyers:existingStream.newBuyers||"", binOnly:existingStream.binOnly||false, breakType:existingStream.breakType||"auction", sessionType:existingStream.sessionType||"", commissionOverride:existingStream.commissionOverride||"", streamNotes:existingStream.notes||"", zionRevenue:existingStream.zionRevenue||"", collabPartner:existingStream.collabPartner||"", collabPct:existingStream.collabPct||"", streamSkuPrices:existingStream.streamSkuPrices||{}, ...prodFields });
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
            const price = parseFloat(updated.streamSkuPrices?.[pt] ?? skuPrices[pt]) || 0;
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
    const streamExp = promo+magpros+pack+topload+chaser;
    const reimbExp  = streamExp;
    const totalExp = fees+coupons+streamExp;
    const netRev   = gross - totalExp;
    const bazNet   = netRev * 0.30;
    const imcNet   = netRev * 0.70;
    // Rep commission uses gross-streamExp (fees don't reduce rep commission)
    const grossForComm = gross - streamExp - coupons;
    const bazNetForComm = grossForComm * 0.30;
    const repExp   = streamExp * 0.135;
    const imcExpReimb = reimbExp * 0.70;
    const commBase = bazNet;
    const mm = parseFloat(recap.marketMultiple)||0;
    const overrideRate = recap.commissionOverride !== "" ? parseFloat(recap.commissionOverride)/100 : null;
    const rate = overrideRate !== null ? overrideRate : recap.binOnly ? 0.35 : mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
    const commAmt = commBase * rate;
    const collabAmt = recap.collabPartner && recap.collabPartner !== "_" ? bazNet * (parseFloat(recap.collabPct||0)/100) : 0;
    return { gross, totalExp, netRev, bazNet, imcNet, repExp, imcExpReimb, commBase, rate, commAmt, collabAmt, bazTrueNet: bazNet - commAmt + imcExpReimb - collabAmt };
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

      {/* -- STREAM RECAP -- */}
      {!cardsOnly && <div style={{ ...S.card, border: recapSaved ? "2px solid #D6F4E3" : "2px solid #E8317A22" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, flexWrap:"wrap", gap:8 }}>
          <SectionLabel t="Stream Recap" />
          <div style={{ background:"#1a1400", border:"1px solid #FBBF2444", borderRadius:8, padding:"8px 14px", fontSize:12, color:"#FBBF24", fontWeight:600, marginBottom:8 }}>
            {"\u26A0\uFE0F Select your breaker first, then import the CSV"}</div>
          <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
            {/* Whatnot CSV Import */}
            <label style={{ display:"flex", alignItems:"center", gap:6, background:"#1a1a2e", border:"1.5px solid #E8317A44", borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700, color:"#E8317A", cursor:"pointer", whiteSpace:"nowrap" }}>
              {"\uD83D\uDCE5 Whatnot CSV"}<input type="file" accept=".csv" style={{ display:"none" }} onChange={e => {
                const file = e.target.files[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => {
                  try {
                    const raw = ev.target.result;
                    // Rejoin lines that are split inside quoted fields
                    const fixedLines = [];
                    let current = "";
                    let inQ = false;
                    for (let ci = 0; ci < raw.length; ci++) {
                      const ch = raw[ci];
                      if (ch === '"') inQ = !inQ;
                      if ((ch === '\n' || ch === '\r') && !inQ) {
                        if (current.trim()) fixedLines.push(current.replace(/\r/g,''));
                        current = "";
                      } else {
                        current += ch;
                      }
                    }
                    if (current.trim()) fixedLines.push(current.replace(/\r/g,''));
                    const lines = fixedLines;
                    const rawHeaders = lines[0].split(",").map(h=>h.replace(/"/g,"").toLowerCase().trim());
                    const getIdx = key => rawHeaders.findIndex(h=>h===key);
                    const origIdx   = getIdx("original_item_price");
                    const couponIdx = getIdx("coupon_price");
                    const cancelIdx = getIdx("cancelled_or_failed");
                    const dateIdx   = getIdx("placed_at");
                    const descIdx  = getIdx("product_description");
                    const nameIdx  = getIdx("product_name");
                    const titleIdx = getIdx("listing_title") !== -1 ? getIdx("listing_title") : getIdx("item_name");
                    // Zion Cases: check product_name first (that's where it lives), then description
                    if (origIdx === -1) { alert("Couldn't find original_item_price column. Make sure this is a Whatnot live sales CSV."); return; }
                    let gross=0, coupons=0, zionGross=0, streamDate="", skipped=0;
                    for (let i=1; i<lines.length; i++) {
                      const cols=[]; let cur="", inQuote=false;
                      for (const ch of lines[i]) {
                        if (ch==='"') { inQuote=!inQuote; }
                        else if (ch==="," && !inQuote) { cols.push(cur.trim()); cur=""; }
                        else { cur+=ch; }
                      }
                      cols.push(cur.trim());
                      const cancelVal = (cols[cancelIdx]||"").toLowerCase();
                      if (cancelVal === "true" || cancelVal === "failed") { skipped++; continue; }
                      const itemDesc  = descIdx  !== -1 ? (cols[descIdx]||"")  : "";
                      const itemName  = nameIdx  !== -1 ? (cols[nameIdx]||"")  : "";
                      const itemTitle = titleIdx !== -1 ? (cols[titleIdx]||"") : "";
                      const isZion = itemDesc.toLowerCase().includes("zion") || itemName.toLowerCase().includes("zion") || itemTitle.toLowerCase().includes("zion");
                      const rowGross = (parseFloat(cols[origIdx]||0)||0) + (parseFloat(cols[couponIdx]||0)||0);
                      const rowCoupon = parseFloat(cols[couponIdx]||0)||0;
                      if (isZion) {
                        zionGross += rowGross;
                      } else {
                        gross   += rowGross;
                        coupons += rowCoupon;
                      }
                      if (!streamDate && cols[dateIdx]) streamDate = cols[dateIdx].split(" ")[0];
                    }
                    setRecap(p=>({ ...p, grossRevenue:gross.toFixed(2), coupons:coupons>0?coupons.toFixed(2):p.coupons, zionRevenue:zionGross>0?zionGross.toFixed(2):"" }));
                    if (streamDate) { csvJustLoaded.current = true; setDate(streamDate); }
                    setRecapSaved(false);
                    setCsvMsg({ type:"success", text:`\u2705 Imported! Gross: $${gross.toFixed(2)}${zionGross>0?` &middot; Zion Cases (excluded): $${zionGross.toFixed(2)}`:""}${coupons>0?` &middot; Coupons: $${coupons.toFixed(2)}`:""}${skipped>0?` &middot; ${skipped} cancelled skipped`:""}${streamDate?` &middot; Date: ${streamDate}`:""} -- now fill in Whatnot fees & other expenses.` });
                    setTimeout(()=>setCsvMsg(null), 8000);

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
                        const cv = (cols[cancelIdx]||"").toLowerCase();
                        if (cv === "true" || cv === "failed") continue;
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
                      // Use actual stream Firestore ID so multiple streams on same day don't collide
                      const streamId = editingStreamId || `${breaker}_${streamDate}`;
                      onUpsertBuyers(Object.values(buyerMap), streamId, file.name);
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
                  {"\u270F\uFE0F Editing:"}{existingStream.breaker} &middot; {existingStream.date}
                </span>
                <button onClick={()=>{ setRecap({...EMPTY_RECAP}); setRecapSaved(false); setEditingStreamId(null); }} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:11, textDecoration:"underline", fontFamily:"inherit" }}>
                  Start new instead
                </button>
              </div>
            )}
            {recapSaved && <span style={{ background:"#111111", color:"#E8317A", border:"1px solid #2E7D5222", borderRadius:20, padding:"3px 12px", fontSize:11, fontWeight:700 }}>{"\u2705 Saved"}</span>}
          </div>
        </div>

        {/* CSV import message */}
        {csvMsg && (
          <div style={{ marginBottom:12, padding:"10px 14px", background:csvMsg.type==="success"?"#0a1a0a":"#1a0a0a", border:`1px solid ${csvMsg.type==="success"?"#4ade8033":"#E8317A33"}`, borderRadius:8, fontSize:12, color:csvMsg.type==="success"?"#4ade80":"#E8317A", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>{csvMsg.text}</span>
            <button onClick={()=>setCsvMsg(null)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:14, marginLeft:10 }}>{"\u2715"}</button>
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
            <label style={S.lbl}>Session Type</label>
            <select value={recap.sessionType||""} onChange={e=>rf("sessionType")(e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
              <option value="">-- Select --</option>
              <option value="day">{"\u2600\uFE0F Day Break (Mon-Thurs)"}</option>
              <option value="night">{"\uD83C\uDF19 Night Break (Mon-Thurs)"}</option>
              <option value="weekend">{"\uD83D\uDCC5 Weekend Break (Fri-Sun)"}</option>
              <option value="event">{"\uD83C\uDF89 Event"}</option>
            </select>
          </div>
          <div>
            <label style={S.lbl}>Market Multiple</label>
            <input type="number" step="0.01" value={recap.marketMultiple} onChange={e=>rf("marketMultiple")(e.target.value)} placeholder="Auto-calculated" style={{ ...S.inp, color: recap.marketMultiple?"#1B4F8A":"#9CA3AF" }} disabled={recap.binOnly}/>
            {recap.marketMultiple && !recap.binOnly && (() => {
              const mm = parseFloat(recap.marketMultiple);
              const pct = Math.round(mm * 100);
              const color = mm>=1.8?"#4ade80":mm>=1.5?"#FBBF24":"#E8317A";
              return <div style={{ fontSize:11, color, fontWeight:700, marginTop:3 }}>{pct}% to market</div>;
            })()}
          </div>
          <div>
            <label style={{ ...S.lbl, color:"#E8317A" }}>{"\uD83C\uDF31 New Buyers"}</label>
            <input type="number" min="0" step="1" value={recap.newBuyers||""} onChange={e=>rf("newBuyers")(e.target.value)} placeholder="0" style={{ ...S.inp, color:"#E8317A" }}/>
          </div>
        </div>

        {/* Financials */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 }}>
          {[
            ["grossRevenue",      "Gross Revenue ($)",  "#166534", false],
            ["whatnotFees",       "Whatnot Fees ($)",          "#991b1b", false],
            ["coupons",           "Coupons ($)",               "#991b1b", false],
            ["whatnotPromo",      "Whatnot Promo ($)",         "#991b1b", false],
          ].filter(([,,, adminOnly]) => !adminOnly).map(([key, label, color]) => (
            <div key={key}>
              <label style={{ ...S.lbl, color: key==="grossRevenue"?"#166534":S.lbl.color }}>{label}</label>
              <input type="number" step="0.01" value={recap[key]||""} onChange={e=>rf(key)(e.target.value)} placeholder="0.00" style={{ ...S.inp, color }}/>
            </div>
          ))}
        </div>

        {/* Zion Cases Revenue -- auto-filled, read-only, Bazooka only */}
        {parseFloat(recap.zionRevenue||0) > 0 && (
          <div style={{ background:"#0a1a0a", border:"1px solid #4ade8033", borderRadius:8, padding:"10px 16px", marginBottom:10, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#4ade80" }}>{"\uD83D\uDFE2 Zion Cases Revenue -- Bazooka Only"}</div>
              <div style={{ fontSize:10, color:"#555", marginTop:2 }}>Auto-detected from CSV &middot; Not included in IMC gross</div>
            </div>
            <div style={{ fontSize:22, fontWeight:900, color:"#4ade80" }}>${parseFloat(recap.zionRevenue||0).toFixed(2)}</div>
          </div>
        )}
        {/* Chaser Cards -- picker + manual override */}
        <div style={{ background:"#111111", border:"1px solid #2a2a2a", borderRadius:10, padding:"12px 14px", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
              <label style={{ ...S.lbl, color:"#AAAAAA", margin:0 }}>{"\uD83C\uDFC6 Cards Used as Chasers"}</label>
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
                          {chaserSearch && <button onClick={()=>setChaserSearch("")} style={{ background:"none", border:"none", color:"#888", cursor:"pointer", fontSize:14, flexShrink:0 }}>{"\u2715"}</button>}
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
                        {"\u2705"}{selectedChasers.length} card{selectedChasers.length!==1?"s":""} selected &middot; auto-cost: ${totalCost.toFixed(2)}
                      </span>
                      <button onClick={()=>{ setRecap(p=>({...p, chaserCardIds:"", chaserCards:""})); setRecapSaved(false); }} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#AAAAAA", cursor:"pointer", fontSize:11, padding:"2px 8px", fontFamily:"inherit" }}>{"\u2715 Clear"}</button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
          {/* Supply qty fields -- auto-calc from cost per unit */}
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

        <div style={{ display:"flex", gap:16, marginBottom:14, alignItems:"center", flexWrap:"wrap" }}>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <input type="checkbox" checked={recap.binOnly||false} onChange={e=>rf("binOnly")(e.target.checked)} style={{ width:16, height:16 }}/>
            <span style={{ fontSize:12, color:"#AAAAAA" }}>BIN Break -- flat 35% commission</span>
          </div>
          {canSeeFinancials && (
            <div style={{ display:"flex", alignItems:"center", gap:8, marginLeft:"auto" }}>
              <label style={{ fontSize:12, color:"#E8317A", fontWeight:700, whiteSpace:"nowrap" }}>{"\uD83D\uDD27 Override Commission %"}</label>
              <input
                type="number" min="0" max="100" step="1"
                value={recap.commissionOverride||""}
                onChange={e=>rf("commissionOverride")(e.target.value)}
                placeholder="e.g. 0"
                style={{ ...S.inp, width:80, color:"#E8317A", textAlign:"center" }}
              />
              {recap.commissionOverride !== "" && (
                <button onClick={()=>rf("commissionOverride")("")} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:14, padding:0 }}>{"\u2715"}</button>
              )}
              <span style={{ fontSize:11, color:"#AAAAAA" }}>{recap.commissionOverride !== "" ? `Using ${recap.commissionOverride}%` : "Leave blank to use tier rate"}</span>
            </div>
          )}
        </div>

        {/* Collab Stream */}
        <div style={{ background:"#0a0f1a", border:"1px solid #7B9CFF33", borderRadius:8, padding:"12px 16px", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <input type="checkbox" checked={!!recap.collabPartner} onChange={e=>{ if(!e.target.checked){ rf("collabPartner")(""); rf("collabPct")(""); } else rf("collabPartner")("_"); }} style={{ width:15, height:15 }}/>
            <span style={{ fontSize:12, color:"#7B9CFF", fontWeight:700 }}>{"\uD83E\uDD1D Collab Stream"}</span>
            {!!recap.collabPartner && (
              <>
                <input value={recap.collabPartner === "_" ? "" : recap.collabPartner} onChange={e=>rf("collabPartner")(e.target.value||"_")} placeholder="Partner name / channel" style={{ ...S.inp, flex:1, fontSize:12 }}/>
                <input type="number" min="0" max="100" step="1" value={recap.collabPct||""} onChange={e=>rf("collabPct")(e.target.value)} placeholder="%" style={{ ...S.inp, width:70, textAlign:"center", fontSize:12, color:"#7B9CFF" }}/>
                <span style={{ fontSize:11, color:"#555", whiteSpace:"nowrap" }}>% of Bazooka Net</span>
              </>
            )}
          </div>
          {!!recap.collabPartner && recap.collabPct && (() => {
            const pct = parseFloat(recap.collabPct)||0;
            const baz = rc.bazNet || 0;
            const collabAmt = baz * (pct/100);
            const bazAfter  = baz - collabAmt;
            return (
              <div style={{ display:"flex", gap:16, fontSize:12, marginTop:8 }}>
                <span style={{ color:"#888" }}>Collab payout: <strong style={{color:"#7B9CFF"}}>${collabAmt.toFixed(2)}</strong></span>
                <span style={{ color:"#888" }}>Bazooka after collab: <strong style={{color:"#E8317A"}}>${bazAfter.toFixed(2)}</strong></span>
              </div>
            );
          })()}
        </div>

        {/* Product used this stream */}
        <div style={{ marginBottom:14 }}>
          <label style={{ ...S.lbl, marginBottom:8, display:"block" }}>{"\uD83D\uDCE6 Product Used This Stream"}</label>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
            {PRODUCT_TYPES.map(pt => {
              const globalPrice = parseFloat(skuPrices[pt]) || 0;
              const streamPrice = recap.streamSkuPrices?.[pt];
              const effectivePrice = parseFloat(streamPrice ?? globalPrice) || 0;
              const qty = parseInt(recap[`prod_${pt}`]) || 0;
              const mktVal = qty * effectivePrice;
              return (
                <div key={pt}>
                  <label style={{ ...S.lbl, color:"#E8317A" }}>{pt}</label>
                  <input
                    type="number" min="0" step="1"
                    value={recap[`prod_${pt}`]||""}
                    onChange={e=>rf(`prod_${pt}`)(e.target.value)}
                    placeholder="0 boxes"
                    style={{ ...S.inp, color:"#E8317A" }}
                  />
                  <div style={{ display:"flex", alignItems:"center", gap:4, marginTop:4 }}>
                    <span style={{ fontSize:10, color:"#555" }}>$</span>
                    <input
                      type="number" min="0" step="0.01"
                      value={streamPrice ?? globalPrice}
                      onChange={e => {
                        const val = e.target.value;
                        setRecap(p => {
                          const newSku = { ...p.streamSkuPrices, [pt]: val };
                          const gross = parseFloat(p.grossRevenue) || 0;
                          const totalMktVal = PRODUCT_TYPES.reduce((sum, t) => {
                            const q = parseInt(p[`prod_${t}`]) || 0;
                            const pr = parseFloat(t === pt ? val : (newSku[t] ?? skuPrices[t])) || 0;
                            return sum + q * pr;
                          }, 0);
                          const mm = gross > 0 && totalMktVal > 0 ? (gross / totalMktVal).toFixed(2) : p.marketMultiple;
                          return { ...p, streamSkuPrices: newSku, marketMultiple: mm };
                        });
                        setRecapSaved(false);
                      }}
                      style={{ ...S.inp, fontSize:11, padding:"3px 6px", color: streamPrice !== undefined && streamPrice !== String(globalPrice) ? "#FBBF24" : "#555" }}
                    />
                    <span style={{ fontSize:10, color:"#555" }}>/box</span>
                  </div>
                  {qty > 0 && <div style={{ fontSize:10, color:"#555", marginTop:2 }}>MV: ${mktVal.toFixed(0)}</div>}
                  {streamPrice !== undefined && streamPrice !== String(globalPrice) && (
                    <div style={{ fontSize:9, color:"#FBBF24", marginTop:1 }}>{"\u26A0 overriding global $"}{globalPrice}</div>
                  )}
                </div>
              );
            })}
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
                    { l:"Gross Revenue (IMC)",      v:fmt(rc.gross),   c:"#F0F0F0" },
                    { l:"Owed to Imagination Mining", v:fmt(rc.imcNet),  c:"#6B2D8B" },
                    { l:"Bazooka Earnings (30%)", v:fmt(rc.bazNet),  c:"#E8317A" },
                  ].map(({l,v,c}) => (
                    <div key={l} style={{ textAlign:"center", background:"#111111", borderRadius:8, padding:"10px 8px", border:"1px solid #2a2a2a" }}>
                      <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                      <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginTop:3 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {recap.collabPartner && recap.collabPartner !== "_" && parseFloat(recap.collabPct) > 0 && (() => {
                  const collabAmt = rc.bazNet * (parseFloat(recap.collabPct)/100);
                  return (
                    <div style={{ marginBottom:10, padding:"8px 14px", background:"#0a0f1a", border:"1px solid #7B9CFF33", borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:12, color:"#7B9CFF", fontWeight:700 }}>{"\uD83E\uDD1D Collab --"}{recap.collabPartner} ({recap.collabPct}%)</span>
                      <span style={{ fontSize:14, fontWeight:900, color:"#7B9CFF" }}>{"\u2212"}{fmt(collabAmt)}</span>
                    </div>
                  );
                })()}
                {parseFloat(recap.zionRevenue||0) > 0 && (
                  <div style={{ marginTop:8, padding:"8px 14px", background:"#0a1a0a", border:"1px solid #4ade8033", borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <span style={{ fontSize:11, color:"#4ade80", fontWeight:700 }}>{"\uD83D\uDFE2 Zion Cases -- Bazooka Only"}</span>
                      <span style={{ fontSize:10, color:"#555", marginLeft:8 }}>not in IMC split</span>
                    </div>
                    <span style={{ fontSize:15, fontWeight:900, color:"#4ade80" }}>{fmt(parseFloat(recap.zionRevenue||0))}</span>
                  </div>
                )}

                {/* Row 2: bazooka true net */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, paddingTop:10, borderTop:"1px solid #222222" }}>
                  {[
                    { l:"Bazooka Earnings",          v:fmt(rc.bazNet),              c:"#E8317A" },
                    { l:"\u2212 Rep Commission",           v:"\u2212 "+fmt(rc.commAmt),        c:"#991b1b" },
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
                  { l:"Bazooka Net (30%)", v:fmt(rc.bazNet),   c:"#E8317A" },
                  { l:`Your Commission (${(rc.rate*100).toFixed(0)}%)`, v:fmt(rc.commAmt), c:"#4ade80" },
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
            {recapSaving ? "Saving..." : recapSaved ? "\u2705 Update Recap" : "\uD83D\uDCBE Save Stream Recap"}
          </Btn>
          {recapSaved && (() => {
            // Build IMC pre-fill URL
            const formBase = (imcFormUrl||"").trim() || "https://docs.google.com/forms/d/e/1FAIpQLSeElbeOg-0ZsXcKBVA4xuaG0x66H_8qzgjMRLVMvDVHa6DmIA/viewform";
            const hobby  = parseInt(recap[`prod_Hobby`])||0;
            const jumbo  = parseInt(recap[`prod_Jumbo`])||0;
            const dmega  = parseInt(recap[`prod_Double Mega`])||0;
            const misc   = parseInt(recap[`prod_Miscellaneous`])||0;
            const streamExpenses = [
              parseFloat(recap.whatnotPromo)>0?`WN Promo: $${parseFloat(recap.whatnotPromo).toFixed(2)}`:"",
              parseFloat(recap.coupons)>0?`Coupons: $${parseFloat(recap.coupons).toFixed(2)}`:"",
              (() => {
                const v = parseFloat(recap.magpros)||0;
                const q = parseInt(recap.magprosQty)||0;
                const price = parseFloat(recap.streamSkuPrices?.supply_magpros ?? skuPrices?.supply_magpros)||0;
                const calc = q > 0 && price > 0 ? q * price : 0;
                const final = v > 0 ? v : calc;
                return final > 0 ? `MagPros: $${final.toFixed(2)}` : "";
              })(),
              (() => {
                const v = parseFloat(recap.packagingMaterial)||0;
                const q = parseInt(recap.packagingQty)||0;
                const price = parseFloat(recap.streamSkuPrices?.supply_packaging ?? skuPrices?.supply_packaging)||0;
                const calc = q > 0 && price > 0 ? q * price : 0;
                const final = v > 0 ? v : calc;
                return final > 0 ? `Packaging: $${final.toFixed(2)}` : "";
              })(),
              (() => {
                const v = parseFloat(recap.topLoaders)||0;
                const q = parseInt(recap.topLoadersQty)||0;
                const price = parseFloat(recap.streamSkuPrices?.supply_topLoaders ?? skuPrices?.supply_topLoaders)||0;
                const calc = q > 0 && price > 0 ? q * price : 0;
                const final = v > 0 ? v : calc;
                return final > 0 ? `Top Loaders: $${final.toFixed(2)}` : "";
              })(),
              parseFloat(recap.chaserCards)>0?`Chasers: $${parseFloat(recap.chaserCards).toFixed(2)}`:"",
            ].filter(Boolean).join(", ") || "None";
            const totalStreamExp = (
              (parseFloat(recap.whatnotPromo)||0) +
              (parseFloat(recap.coupons)||0) +
              (parseFloat(recap.magpros)||0) +
              (parseFloat(recap.packagingMaterial)||0) +
              (parseFloat(recap.topLoaders)||0) +
              (parseFloat(recap.chaserCards)||0)
            ).toFixed(2);
            const formDate = date ? new Date(date+"T12:00:00").toLocaleDateString("en-US",{month:"2-digit",day:"2-digit",year:"numeric"}) : "";
            const params = new URLSearchParams({
              [`entry.546325134`]:  "Bazooka Vault",
              [`entry.53983190`]:   formDate,
              [`entry.1397101824`]: hobby||"0",
              [`entry.473640875`]:  jumbo||"0",
              [`entry.2005003030`]: dmega||"0",
              [`entry.1594275904`]: misc>0?`Miscellaneous: ${misc} box${misc!==1?"es":""}. `:"",
              [`entry.1550026312`]: (parseFloat(recap.grossRevenue)||0).toFixed(2),
              [`entry.1898010524`]: (parseFloat(recap.whatnotFees)||0).toFixed(2),
              [`entry.2063681927`]: streamExpenses,
              [`entry.1117405477`]: "Devin Street",
            });
            const imcUrl = `${formBase}?usp=pp_url&entry.emailAddress=devin%40bazookabreaks.com&${params.toString()}`;
            return (
              <a href={imcUrl} target="_blank" rel="noreferrer" style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#1a0a0f", border:"1.5px solid #E8317A44", color:"#E8317A", borderRadius:9, padding:"8px 16px", fontSize:12, fontWeight:700, textDecoration:"none", whiteSpace:"nowrap" }}>
                {"\uD83D\uDCCB Submit to IMC \u2197"}</a>
            );
          })()}
          {recapSaved && (
            <Btn onClick={()=>{ setDate(new Date().toISOString().split("T")[0]); setRecap({...EMPTY_RECAP}); setRecapSaved(false); setEditingStreamId(null); }} variant="ghost">
              + New Stream
            </Btn>
          )}
          {existingStream && !recapSaved && <span style={{ fontSize:11, color:"#AAAAAA" }}>{"\u26A0 Unsaved changes"}</span>}
        </div>
        {/* IMC Form URL setting -- Admin only */}
        {userRole?.role === "Admin" && (
          <div style={{ marginTop:12, display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#555", whiteSpace:"nowrap" }}>IMC Form URL:</span>
            <input
              defaultValue={imcFormUrl}
              onBlur={e=>{ if(onSaveImcFormUrl && e.target.value.trim() !== imcFormUrl) onSaveImcFormUrl(e.target.value.trim()); }}
              placeholder="Paste new Google Form URL here each month..."
              style={{ ...S.inp, fontSize:11, padding:"4px 10px", color:"#666" }}
            />
          </div>
        )}
      </div>}

      {/* -- STREAM LOG -- */}
      {!cardsOnly && (() => {
        function calcS(s) {
          const gross=parseFloat(s.grossRevenue)||0, fees=parseFloat(s.whatnotFees)||0, coupons=parseFloat(s.coupons)||0, promo=parseFloat(s.whatnotPromo)||0, magpros=parseFloat(s.magpros)||0, pack=parseFloat(s.packagingMaterial)||0, topload=parseFloat(s.topLoaders)||0, chaser=parseFloat(s.chaserCards)||0;
          const streamExp=promo+magpros+pack+topload+chaser; const reimbExp=streamExp;
          const totalExp=fees+coupons+streamExp, netRev=gross-totalExp, bazNet=netRev*0.30, imcNet=netRev*0.70;
          const grossForComm=gross-streamExp-coupons, bazNetForComm=grossForComm*0.30;
          const repExp=streamExp*0.135, imcExpReimb=reimbExp*0.70;
          const mm=parseFloat(s.marketMultiple)||0, overrideRate=s.commissionOverride!==""&&s.commissionOverride!=null?parseFloat(s.commissionOverride)/100:null, rate=overrideRate!==null?overrideRate:s.binOnly?0.35:mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
          const commBase=bazNet, commAmt=commBase*rate;
          return { gross, netRev, bazNet, imcNet, commBase, commAmt, imcExpReimb, collabAmt:bazNet*(s.collabPartner&&s.collabPartner!=="_"?parseFloat(s.collabPct||0)/100:0), bazTrueNet: bazNet - commAmt+imcExpReimb-bazNet*(s.collabPartner&&s.collabPartner!=="_"?parseFloat(s.collabPct||0)/100:0), rate };
        }
        const myStreams = (canSeeFinancials ? streams : streams.filter(s => s.breaker === matchedBreaker))
          .filter(s => !streamLogBreaker || s.breaker === streamLogBreaker);
        return (
          <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px 0", display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, flexWrap:"wrap" }}>
              <SectionLabel t={`Stream Log (${myStreams.length})`} />
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                {canSeeFinancials && (
                  <select value={streamLogBreaker} onChange={e=>setStreamLogBreaker(e.target.value)} style={{ ...S.inp, width:"auto", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                    <option value="">All Breakers</option>
                    {BREAKERS.map(b=><option key={b} value={b}>{b}</option>)}
                  </select>
                )}
                {streamBulkSel.size > 0 && (
                  <button onClick={()=>{
                    if(window.confirm(`Delete ${streamBulkSel.size} stream${streamBulkSel.size!==1?"s":""}? Chaser cards will be restored.`)) {
                      [...streamBulkSel].forEach(id => { if(onDeleteStream) onDeleteStream(id); });
                      setStreamBulkSel(new Set());
                    }
                  }} style={{ background:"#1a0a0a", color:"#E8317A", border:"1.5px solid #fca5a5", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                    {"\uD83D\uDDD1 Delete"}{streamBulkSel.size} stream{streamBulkSel.size!==1?"s":""}
                  </button>
                )}
              </div>
            </div>
            {myStreams.length === 0
              ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"30px 0" }}>No streams logged yet -- save a stream recap above to get started</div>
              : <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, width:40, textAlign:"center" }}>
                      <input type="checkbox"
                        checked={myStreams.length>0 && streamBulkSel.size===myStreams.length}
                        onChange={()=>setStreamBulkSel(streamBulkSel.size===myStreams.length ? new Set() : new Set(myStreams.map(s=>s.id)))}
                      />
                    </th>
                    {["Date","Breaker","Gross","Net Rev",canSeeFinancials?"Owed to IM":null,canSeeFinancials?"Baz Earnings":null,"Commission",canSeeFinancials?"True Net":null,"Rate","New Buyers",...PRODUCT_TYPES.map(pt=>pt.replace(" ","")),""].filter(Boolean).map(h=><th key={h} style={S.th}>{h}</th>)}
                  </tr>
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
                        <td style={{ ...S.td, textAlign:"center" }} onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={streamBulkSel.has(s.id)}
                            onChange={()=>setStreamBulkSel(prev=>{ const n=new Set(prev); n.has(s.id)?n.delete(s.id):n.add(s.id); return n; })}
                          />
                        </td>
                        <td style={S.td}>{s.date}</td>
                        <td style={S.td}><Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge></td>
                        <td style={{ ...S.td, color:"#F0F0F0", fontWeight:700 }}>{fmt(c.gross)}</td>
                        <td style={{ ...S.td, color:"#F0F0F0" }}>{fmt(c.netRev)}</td>
                        {canSeeFinancials && <td style={{ ...S.td, color:"#E8317A" }}>{fmt(c.imcNet)}</td>}
                        {canSeeFinancials && <td style={{ ...S.td, color:"#E8317A" }}>{fmt(c.bazNet)}</td>}
                        <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(c.commAmt)}</td>
                        {canSeeFinancials && <td style={{ ...S.td, color:"#E8317A", fontWeight:900 }}>{fmt(c.bazTrueNet)}</td>}
                        <td style={{ ...S.td, color:"#AAAAAA" }}>{(c.rate*100).toFixed(0)}%{s.binOnly?" BIN":""}</td>
                        <td style={{ ...S.td, color:"#E8317A" }}>{parseInt(s.newBuyers)||0 > 0 ? `\uD83C\uDF31 ${s.newBuyers}` : "--"}</td>
                        {PRODUCT_TYPES.map(pt => {
                          const qty = parseInt(s[`prod_${pt}`])||0;
                          const PT_COLORS = {"Double Mega":"#C2410C","Hobby":"#2C3E7A","Jumbo":"#166534","Miscellaneous":"#6B2D8B"};
                          return (
                            <td key={pt} style={{ ...S.td, color: qty>0?PT_COLORS[pt]:"#D1D5DB", fontWeight:qty>0?700:400, textAlign:"center" }}>
                              {qty>0 ? qty : "--"}
                            </td>
                          );
                        })}
                        <td style={S.td}>
                          <button
                            onClick={e=>{ e.stopPropagation(); if(window.confirm("Delete this stream?")) { if(onDeleteStream) onDeleteStream(s.id); if(existingStream?.id===s.id){ setRecap({...EMPTY_RECAP}); setRecapSaved(false); setEditingStreamId(null); } }}}
                            style={{ background:"none", border:"1px solid #FCA5A5", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                          >{"\uD83D\uDDD1"}</button>
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

      {/* -- LOG CARDS -- */}
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
            {bulkSel.size>0 && <Btn onClick={handleBulkLog} disabled={!breaker} variant="green">{"\u2705 Log Out"}{bulkSel.size} Card{bulkSel.size!==1?"s":""}</Btn>}
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
                {"\uD83D\uDDD1 Remove"}{histSel.size} selected
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
                      <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{b.usage||"--"}</td>
                      <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{b.loggedBy||"--"}</td>
                      <td style={{ ...S.td, color:"#AAAAAA", fontSize:12 }}>{b.notes||"--"}</td>
                      <td style={S.td}>
                        <button onClick={()=>{ if(window.confirm(`Remove "${b.cardName}" from break log? This will make the card available again.`)) onDeleteBreak(b.id); }} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:14, padding:2 }} title="Remove from break log">{"\u2715"}</button>
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


function BuyersCRM({ buyers=[], csvImports=[], onDeleteImport, onClearAll, userRole, streams=[] }) {
  const isAdmin = ["Admin","Streamer"].includes(userRole?.role);
  const [search,       setSearch]       = useState("");
  const [sortBy,       setSortBy]       = useState("totalSpend");
  const [filterNew,    setFilterNew]    = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [showImports,  setShowImports]  = useState(false);
  const [activeTab,    setActiveTab]    = useState("table");
  const [selectedState, setSelectedState] = useState(null);

  const fmt = n => `$${(parseFloat(n)||0).toFixed(2)}`;

  const filtered = buyers.filter(b => {
    if (filterNew && !b.isNew) return false;
    if (search) {
      const q = search.toLowerCase();
      return (b.username||"").toLowerCase().includes(q) ||
             (b.fullName||"").toLowerCase().includes(q) ||
             (b.city||"").toLowerCase().includes(q) ||
             (b.state||"").toLowerCase().includes(q);
    }
    return true;
  }).sort((a,b) => {
    if (sortBy==="totalSpend")  return (b.totalSpend||0)-(a.totalSpend||0);
    if (sortBy==="orderCount")  return (b.orderCount||0)-(a.orderCount||0);
    if (sortBy==="lastSeen")    return (b.lastSeen||"").localeCompare(a.lastSeen||"");
    if (sortBy==="username")    return (a.username||"").localeCompare(b.username||"");
    return 0;
  });

  const totalBuyers   = buyers.length;
  const totalRevenue  = buyers.reduce((s,b)=>s+(b.totalSpend||0),0);
  const newBuyers     = buyers.filter(b=>b.isNew).length;
  const avgSpend      = totalBuyers > 0 ? totalRevenue/totalBuyers : 0;

  // State breakdown
  const stateData = {};
  buyers.forEach(b => {
    const s = (b.state||"").toUpperCase().trim();
    if (!s || s.length !== 2) return;
    if (!stateData[s]) stateData[s] = { buyers:0, revenue:0 };
    stateData[s].buyers++;
    stateData[s].revenue += (b.totalSpend||0);
  });
  const stateEntries = Object.entries(stateData).sort((a,b)=>b[1].revenue-a[1].revenue);

  // Time zone breakdown
  const ZONE_MAP = {
    'ET':['CT','DC','DE','FL','GA','IN','KY','MA','MD','ME','MI','NC','NH','NJ','NY','OH','PA','RI','SC','TN','VA','VT','WV'],
    'CT':['AL','AR','IA','IL','KS','LA','MN','MO','MS','NE','ND','OK','SD','TX','WI'],
    'MT':['AZ','CO','ID','MT','NM','UT','WY'],
    'PT':['AK','CA','HI','NV','OR','WA'],
  };
  const zoneData = { 'ET':{ buyers:0, revenue:0 }, 'CT':{ buyers:0, revenue:0 }, 'MT':{ buyers:0, revenue:0 }, 'PT':{ buyers:0, revenue:0 }, 'Other':{ buyers:0, revenue:0 } };
  buyers.forEach(b => {
    const s = (b.state||"").toUpperCase().trim();
    let zone = 'Other';
    for (const [z, states] of Object.entries(ZONE_MAP)) { if (states.includes(s)) { zone = z; break; } }
    zoneData[zone].buyers++;
    zoneData[zone].revenue += (b.totalSpend||0);
  });

  const S = {
    card: { background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 16px" },
    inp:  { background:"#111", border:"1px solid #2a2a2a", borderRadius:7, color:"#F0F0F0", padding:"6px 10px", fontSize:12, fontFamily:"inherit", outline:"none" },
    th:   { padding:"10px 12px", textAlign:"left", fontSize:11, color:"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:1, borderBottom:"1px solid #1a1a1a", whiteSpace:"nowrap" },
    td:   { padding:"10px 12px", borderBottom:"1px solid #111", fontSize:12 },
  };

  const maxRevenue = stateEntries.length > 0 ? stateEntries[0][1].revenue : 1;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Stats row */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
        {[
          { l:"Total Buyers",    v:totalBuyers.toLocaleString(),     c:"#7B9CFF" },
          { l:"Total Revenue",   v:`$${Math.round(totalRevenue).toLocaleString()}`, c:"#4ade80" },
          { l:"New Buyers",      v:newBuyers.toLocaleString(),        c:"#FBBF24" },
          { l:"Avg Spend",       v:fmt(avgSpend),                     c:"#E8317A" },
        ].map(({l,v,c})=>(
          <div key={l} style={{ ...S.card, textAlign:"center" }}>
            <div style={{ fontSize:22, fontWeight:900, color:c }}>{v}</div>
            <div style={{ fontSize:11, color:"#555", marginTop:4 }}>{l}</div>
          </div>
        ))}
      </div>
      {isAdmin && buyers.length > 0 && (
        <div style={{ display:"flex", justifyContent:"flex-end" }}>
          <button onClick={()=>{ if(onClearAll) onClearAll(); }}
            style={{ background:"#1a0a0a", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            {"\uD83D\uDDD1 Clear All Buyers & Imports"}</button>
        </div>
      )}

      {/* Analytics tabs */}
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <div style={{ display:"flex", borderBottom:"1px solid #1a1a1a" }}>
          {[["table","\uD83D\uDC65 Buyers"],["map","\uD83D\uDDFA\uFE0F By State"],["zones","\uD83D\uDD50 By Time Zone"]].map(([id,label])=>(
            <button key={id} onClick={()=>setActiveTab(id)}
              style={{ background:activeTab===id?"#1A1A2E":"transparent", color:activeTab===id?"#E8317A":"#555", border:"none", borderBottom:activeTab===id?"2px solid #E8317A":"2px solid transparent", padding:"10px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {label}
            </button>
          ))}
        </div>

        {/* Buyers table */}
        {activeTab === "table" && (
          <>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #1a1a1a" }}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search username, name, city..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                <option value="totalSpend">Sort: Total Spend</option>
                <option value="orderCount">Sort: Orders</option>
                <option value="lastSeen">Sort: Last Seen</option>
                <option value="username">Sort: Username</option>
              </select>
              <label style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#888", cursor:"pointer" }}>
                <input type="checkbox" checked={filterNew} onChange={e=>setFilterNew(e.target.checked)}/>
                New only
              </label>
              <span style={{ fontSize:11, color:"#555" }}>{filtered.length} of {totalBuyers}</span>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                <thead>
                  <tr>{["Username","Name","Location","Orders","Total Spend","Avg/Order","Last Seen"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} style={{ ...S.td, textAlign:"center", color:"#333", padding:32 }}>
                      {buyers.length === 0 ? "No buyers yet -- import a CSV from the Streams tab" : "No buyers match your search"}
                    </td></tr>
                  ) : filtered.map((b,i) => {
                    const avgOrder = b.orderCount > 0 ? (b.totalSpend||0)/b.orderCount : 0;
                    const loc = [b.city, b.state].filter(Boolean).join(", ");
                    return (
                      <tr key={b.id} onClick={()=>setSelected(selected?.id===b.id?null:b)}
                        style={{ cursor:"pointer", background:selected?.id===b.id?"#1A1A2E":i%2===0?"#0d0d0d":"#111" }}
                        className="clickable-row">
                        <td style={S.td}>
                          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                            {b.isNew && <span style={{ fontSize:9, background:"#FBBF2422", color:"#FBBF24", border:"1px solid #FBBF2444", borderRadius:4, padding:"1px 5px", fontWeight:700 }}>NEW</span>}
                            <span style={{ color:"#7B9CFF", fontWeight:700 }}>@{b.username}</span>
                          </div>
                        </td>
                        <td style={{ ...S.td, color:"#F0F0F0" }}>{b.fullName||"--"}</td>
                        <td style={{ ...S.td, color:"#888" }}>{loc||"--"}</td>
                        <td style={{ ...S.td, color:"#F0F0F0", textAlign:"center" }}>{b.orderCount||0}</td>
                        <td style={{ ...S.td, color:"#4ade80", fontWeight:700 }}>{fmt(b.totalSpend)}</td>
                        <td style={{ ...S.td, color:"#888" }}>{fmt(avgOrder)}</td>
                        <td style={{ ...S.td, color:"#555" }}>{b.lastSeen ? new Date(b.lastSeen).toLocaleDateString() : "--"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {selected && (
              <div style={{ borderTop:"1px solid #1a1a1a", padding:"14px 16px", background:"#0a0a0a" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:"#7B9CFF" }}>@{selected.username}</div>
                  <button onClick={()=>setSelected(null)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16 }}>{"\u00D7"}</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:8 }}>
                  {[
                    { l:"Full Name",    v:selected.fullName||"--" },
                    { l:"Location",     v:[selected.city,selected.state,selected.zip].filter(Boolean).join(", ")||"--" },
                    { l:"Total Spend",  v:fmt(selected.totalSpend), c:"#4ade80" },
                    { l:"Orders",       v:selected.orderCount||0 },
                    { l:"Coupons Used", v:selected.couponCount||0 },
                    { l:"First Seen",   v:selected.firstSeen ? new Date(selected.firstSeen).toLocaleDateString() : "--" },
                    { l:"Last Seen",    v:selected.lastSeen  ? new Date(selected.lastSeen).toLocaleDateString()  : "--" },
                    { l:"Streams",      v:(selected.streams||[]).length },
                  ].map(({l,v,c})=>(
                    <div key={l} style={{ background:"#111", borderRadius:7, padding:"8px 10px" }}>
                      <div style={{ fontSize:11, color:"#555", marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:13, fontWeight:700, color:c||"#F0F0F0" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* By State */}
        {activeTab === "map" && (() => {
          const maxBuyers = stateEntries.length > 0 ? stateEntries[0][1].buyers : 1;
          function stateColor(abbr) {
            const d = stateData[abbr];
            if (!d) return "#1a1a1a";
            const t = d.buyers / maxBuyers;
            if (t > 0.8) return "#E8317A";
            if (t > 0.6) return "#cc2a68";
            if (t > 0.4) return "#a82255";
            if (t > 0.2) return "#7a1a3f";
            return "#4a1028";
          }
          return (
            <div style={{ padding:"12px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10, fontSize:10, color:"#555" }}>
                <span>Fewer buyers</span>
                {["#4a1028","#7a1a3f","#a82255","#cc2a68","#E8317A"].map(c=>(
                  <div key={c} style={{ width:20, height:12, background:c, borderRadius:2 }}/>
                ))}
                <span>More buyers</span>
                <span style={{ marginLeft:"auto", color:"#333" }}>Click a state to see buyers</span>
              </div>

              {selectedState && (() => {
                const stateBuyers = buyers.filter(b=>(b.state||"").toUpperCase()===selectedState);
                const d = stateData[selectedState];
                return (
                  <div style={{ marginTop:12, background:"#0a0a0a", border:"1px solid #E8317A44", borderRadius:10, overflow:"hidden" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #1a1a1a" }}>
                      <div>
                        <span style={{ fontSize:14, fontWeight:800, color:"#E8317A" }}>{selectedState}</span>
                        <span style={{ fontSize:12, color:"#555", marginLeft:8 }}>{d?.buyers||0} buyer{d?.buyers!==1?"s":""} &middot; {fmt(d?.revenue||0)}</span>
                      </div>
                      <button onClick={()=>setSelectedState(null)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16 }}>{"\u00D7"}</button>
                    </div>
                    <div style={{ maxHeight:260, overflowY:"auto" }}>
                      {stateBuyers.sort((a,b)=>(b.totalSpend||0)-(a.totalSpend||0)).map((b,i)=>(
                        <div key={b.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 14px", borderBottom:"1px solid #111", background:i%2===0?"#0a0a0a":"#0d0d0d" }}>
                          <span style={{ color:"#7B9CFF", fontWeight:700, fontSize:12 }}>@{b.username}</span>
                          {b.fullName && <span style={{ fontSize:11, color:"#555" }}>{b.fullName}</span>}
                          {b.city && <span style={{ fontSize:11, color:"#444" }}>{b.city}</span>}
                          <span style={{ marginLeft:"auto", color:"#4ade80", fontWeight:700, fontSize:12 }}>{fmt(b.totalSpend)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}
        {/* By Time Zone */}
        {activeTab === "zones" && (
          <div style={{ padding:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#F0F0F0", marginBottom:12 }}>Revenue by Time Zone</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:10 }}>
              {Object.entries(zoneData).map(([zone, data]) => {
                const colors = { ET:"#7B9CFF", CT:"#4ade80", MT:"#FBBF24", PT:"#E8317A", Other:"#555" };
                return (
                  <div key={zone} style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:"12px 14px" }}>
                    <div style={{ fontSize:16, fontWeight:900, color:colors[zone] }}>{zone}</div>
                    <div style={{ fontSize:20, fontWeight:800, color:"#F0F0F0", marginTop:4 }}>{fmt(data.revenue)}</div>
                    <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{data.buyers} buyer{data.buyers!==1?"s":""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CSV Imports -- collapsible */}
      <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
        <button onClick={()=>setShowImports(p=>!p)}
          style={{ width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 16px", background:"transparent", border:"none", color:"#F0F0F0", cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700 }}>
          <span>{"\uD83D\uDCE5 CSV Imports ("}{csvImports.length})</span>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {isAdmin && buyers.length > 0 && (
              <span onClick={e => { e.stopPropagation(); if(onClearAll) onClearAll(); }}
                style={{ fontSize:11, color:"#E8317A", border:"1px solid #E8317A33", borderRadius:6, padding:"2px 8px", cursor:"pointer", fontWeight:700 }}>
                {"\uD83D\uDDD1 Clear All"}</span>
            )}
            <span style={{ color:"#555", fontSize:11 }}>{showImports?"\u25B2 collapse":"\u25BC expand"}</span>
          </div>
        </button>
        {showImports && csvImports.length > 0 && (
          <div style={{ borderTop:"1px solid #1a1a1a", padding:"10px 14px", display:"flex", flexDirection:"column", gap:6 }}>
            {csvImports.map(imp => {
              const stream = streams.find(s=>s.id===imp.streamId);
              return (
                <div key={imp.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"#0a0a0a", borderRadius:7, border:"1px solid #1a1a1a" }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:"#F0F0F0" }}>{imp.filename}</div>
                    <div style={{ fontSize:10, color:"#555", marginTop:2 }}>
                      {imp.rowCount} buyers &middot; {new Date(imp.importedAt).toLocaleDateString()}
                      {stream && <span style={{ color:"#7B9CFF", marginLeft:8 }}>{stream.name||stream.id}</span>}
                    </div>
                  </div>
                  {isAdmin && (
                    <button onClick={()=>{ if(window.confirm(`Delete import "${imp.filename}"?`)) onDeleteImport(imp.id); }}
                      style={{ background:"transparent", border:"1px solid #E8317A33", color:"#E8317A", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                      Delete
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {showImports && csvImports.length === 0 && (
          <div style={{ borderTop:"1px solid #1a1a1a", padding:24, textAlign:"center", color:"#333", fontSize:12 }}>No CSV imports yet</div>
        )}
      </div>
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

  const [perfPeriod, setPerfPeriod] = useState("month");
  const [perfFrom,   setPerfFrom]   = useState("");
  const [perfTo,     setPerfTo]     = useState("");

  function getPerfStreams() {
    return streams.filter(s => {
      if (!s.date) return false;
      const d = parseLocalDate(s.date);
      if (perfPeriod === "week") {
        const day=d.getDay(), diff=day===0?6:day-1;
        const wStart=new Date(now); wStart.setDate(now.getDate()-(now.getDay()===0?6:now.getDay()-1)); wStart.setHours(0,0,0,0);
        const wEnd=new Date(wStart); wEnd.setDate(wStart.getDate()+6); wEnd.setHours(23,59,59,999);
        return d >= wStart && d <= wEnd;
      }
      if (perfPeriod === "month") return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
      if (perfPeriod === "quarter") { const q=Math.floor(now.getMonth()/3); return Math.floor(d.getMonth()/3)===q && d.getFullYear()===now.getFullYear(); }
      if (perfPeriod === "year") return d.getFullYear()===now.getFullYear();
      if (perfPeriod === "custom" && perfFrom && perfTo) {
        const f=new Date(perfFrom); f.setHours(0,0,0,0);
        const t=new Date(perfTo);   t.setHours(23,59,59,999);
        return d >= f && d <= t;
      }
      return true;
    });
  }

  const filteredStreams = getPerfStreams();
  const thisMonth = filteredStreams;
  const thisYear  = streams.filter(s => parseLocalDate(s.date).getFullYear()===now.getFullYear());

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

  if (visibleBreakers.length===0) return <div style={{ ...S.card, textAlign:"center", padding:"60px" }}><div style={{ fontSize:32, marginBottom:12 }}>{"\uD83D\uDCC8"}</div><div style={{ color:"#AAAAAA" }}>Your account isn't linked to a streamer profile.</div></div>;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>

      {/* Period Filter */}
      <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
        {[["month","This Month"],["quarter","This Quarter"],["year","This Year"],["all","All Time"],["custom","Custom"]].map(([val,label]) => (
          <button key={val} onClick={()=>setPerfPeriod(val)} style={{ background:perfPeriod===val?"#E8317A":"#1a1a1a", color:perfPeriod===val?"#fff":"#888", border:`1px solid ${perfPeriod===val?"#E8317A":"#2a2a2a"}`, borderRadius:7, padding:"5px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{label}</button>
        ))}
        {perfPeriod==="custom" && (
          <>
            <input type="date" value={perfFrom} onChange={e=>setPerfFrom(e.target.value)} style={{ ...S.inp, width:"auto", fontSize:12 }}/>
            <span style={{ color:"#555", fontSize:12 }}>{"\u2192"}</span>
            <input type="date" value={perfTo} onChange={e=>setPerfTo(e.target.value)} style={{ ...S.inp, width:"auto", fontSize:12 }}/>
          </>
        )}
      </div>

      {/* Boxes Ripped Summary */}
      {(monthTotal > 0 || yearTotal > 0 || monthGross > 0 || monthNewBuyers > 0) && (
      <div style={S.card}>
        <SectionLabel t={`\uD83D\uDCE6 ${perfPeriod==="month"?"This Month's":perfPeriod==="week"?"This Week's":perfPeriod==="year"?"This Year's":perfPeriod==="quarter"?"This Quarter's":perfPeriod==="custom"?"Selected Period":""} Key Metrics`} />
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
                  <span style={{ fontSize:11, color:"#E8317A", minWidth:30 }}>{"\uD83C\uDF31"}{bBuyers}</span>
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
                <div style={{ fontSize:18, fontWeight:900, color:bc.text }}>{"\uD83D\uDD25"}{stats.streak}</div>
                <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>Day Streak</div>
              </div>}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
              {[
                { l:"Total Cards Used",     v:stats.all.length,                                          c:bc.text },
                { l:"This Month",           v:stats.month.length,                                        c:bc.text },
                { l:"\uD83D\uDCE6 Boxes This Month",  v:stats.breakerBoxTotal||0,                                  c:stats.breakerBoxTotal>0?"#6B2D8B":"#9CA3AF" },
                { l:"\uD83D\uDCB0 Gross This Month",  v:stats.breakerGross>0?fmt(stats.breakerGross):"--",          c:stats.breakerGross>0?"#E8317A":"#9CA3AF" },
                { l:"\uD83C\uDF31 New Buyers",        v:stats.breakerNewBuyers||0,                                 c:stats.breakerNewBuyers>0?"#166534":"#9CA3AF" },
                { l:"Top Card Type",        v:stats.topType.replace(" Cards",""),                        c:CC[stats.topType]?.text||bc.text },
                { l:"\uD83D\uDCC8 Avg Market Multiple", v:stats.breakerAvgMM?`${stats.breakerAvgMM.toFixed(2)}x`:"--", c:stats.breakerAvgMM>=1.6?"#166534":stats.breakerAvgMM>=1.5?"#92400e":"#9CA3AF" },
                { l:"Active Streak",        v:stats.streak>0?`${stats.streak}d`:"--",                    c:stats.streak>0?"#E8317A":"#9CA3AF" },
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

// --- PRODUCT INVENTORY -------------------------------------------
function ProductInventory({ shipments=[], productUsage=[], onSaveShipment, onDeleteShipment, onDeleteProductUsage, user, userRole, skuPrices={}, onSaveSkuPrices, streams=[], skuPriceHistory=[] }) {
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

      {/* SKU Price History Chart */}
      {(() => {
        // Build price history: global saves + per-stream overrides merged and sorted by date
        const history = {};
        PRODUCT_TYPES.forEach(pt => history[pt] = []);

        // 1. Global SKU price saves (from sku_price_history collection)
        skuPriceHistory.forEach(h => {
          PRODUCT_TYPES.forEach(pt => {
            const price = parseFloat(h.prices?.[pt]);
            if (price > 0) history[pt].push({ date: h.date, price, source: "global" });
          });
        });

        // 2. Per-stream overrides (deduplicate by date, override wins)
        [...streams]
          .filter(s => s.date && s.streamSkuPrices && Object.keys(s.streamSkuPrices).length > 0)
          .sort((a,b) => new Date(a.date)-new Date(b.date))
          .forEach(s => {
            PRODUCT_TYPES.forEach(pt => {
              const price = parseFloat(s.streamSkuPrices[pt]);
              if (price > 0) {
                // Only add if no global entry on same date
                if (!history[pt].some(e => e.date === s.date && e.source === "global")) {
                  history[pt].push({ date: s.date, price, source: "stream" });
                }
              }
            });
          });

        // Sort each product's history by date and deduplicate same-day entries (keep last)
        PRODUCT_TYPES.forEach(pt => {
          const byDate = {};
          history[pt].forEach(e => { byDate[e.date] = e; });
          history[pt] = Object.values(byDate).sort((a,b) => a.date.localeCompare(b.date));
        });

        const hasData = PRODUCT_TYPES.some(pt => history[pt].length >= 1);
        if (!hasData) return (
          <div style={{ ...S.card, border:"1px solid #2a2a2a", textAlign:"center", color:"#555", fontSize:12, padding:"20px" }}>
            {"\uD83D\uDCC8 SKU price history will appear here once SKU prices have been saved"}</div>
        );
        const COLORS = { "Double Mega":"#E8317A", "Hobby":"#7B9CFF", "Jumbo":"#4ade80", "Miscellaneous":"#FBBF24" };
        const [activePt, setActivePt] = useState(PRODUCT_TYPES.find(pt => history[pt].length >= 1) || PRODUCT_TYPES[0]);
        const pts = history[activePt] || [];
        const color = COLORS[activePt] || "#E8317A";
        const minP = Math.min(...pts.map(p=>p.price));
        const maxP = Math.max(...pts.map(p=>p.price));
        const range = maxP - minP || 1;
        const W = 600, H = 200, PAD = { t:24, r:20, b:40, l:60 };
        const chartW = W - PAD.l - PAD.r;
        const chartH = H - PAD.t - PAD.b;
        const points = pts.map((p, i) => ({
          x: PAD.l + (pts.length > 1 ? (i / (pts.length-1)) * chartW : chartW/2),
          y: PAD.t + chartH - ((p.price - minP) / range) * chartH,
          price: p.price, date: p.date, source: p.source
        }));
        const pathD = points.map((p,i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const areaD = points.length > 0 ? `${pathD} L${points[points.length-1].x},${PAD.t+chartH} L${points[0].x},${PAD.t+chartH} Z` : "";
        return (
          <div style={{ ...S.card, border:"1px solid #2a2a2a" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
              <SectionLabel t="\uD83D\uDCC8 SKU Price History" />
              <div style={{ display:"flex", gap:6 }}>
                {PRODUCT_TYPES.filter(pt => history[pt].length > 0).map(pt => (
                  <button key={pt} onClick={()=>setActivePt(pt)} style={{ background:activePt===pt?COLORS[pt]+"22":"transparent", color:activePt===pt?COLORS[pt]:"#555", border:`1.5px solid ${activePt===pt?COLORS[pt]:"#333"}`, borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{pt}</button>
                ))}
              </div>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"auto" }}>
              {[0,0.25,0.5,0.75,1].map(t => {
                const y = PAD.t + chartH * (1-t);
                const val = minP + range * t;
                return <g key={t}>
                  <line x1={PAD.l} y1={y} x2={W-PAD.r} y2={y} stroke="#1a1a1a" strokeWidth="1"/>
                  <text x={PAD.l-6} y={y+4} textAnchor="end" fill="#555" fontSize="10">${val.toFixed(0)}</text>
                </g>;
              })}
              {areaD && <path d={areaD} fill={color} fillOpacity="0.08"/>}
              {pathD && <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>}
              {points.map((p,i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="4" fill={p.source==="stream"?color+"88":color} stroke="#111" strokeWidth="1.5"/>
                  <text x={p.x} y={p.y-10} textAnchor="middle" fill={color} fontSize="10" fontWeight="700">${p.price.toFixed(0)}</text>
                </g>
              ))}
              {points.map((p,i) => (
                <text key={i} x={p.x} y={H-6} textAnchor="middle" fill="#555" fontSize="9">{p.date.slice(5)}</text>
              ))}
              <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+chartH} stroke="#333" strokeWidth="1"/>
              <line x1={PAD.l} y1={PAD.t+chartH} x2={W-PAD.r} y2={PAD.t+chartH} stroke="#333" strokeWidth="1"/>
            </svg>
            {pts.length > 1 && (() => {
              const first = pts[0].price, last = pts[pts.length-1].price;
              const diff = last - first, pct = ((diff/first)*100).toFixed(1);
              return <div style={{ fontSize:11, color:diff>=0?"#4ade80":"#E8317A", textAlign:"right", marginTop:4 }}>
                {diff>=0?"\u2191":"\u2193"} ${Math.abs(diff).toFixed(0)} ({Math.abs(pct)}%) since {pts[0].date}
              </div>;
            })()}
          </div>
        );
      })()}

      {/* SKU Pricing -- Admin only */}
      {canEdit && (
        <div style={{ ...S.card, border:"2px solid #333333" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: skuEditing ? 14 : 0 }}>
            <SectionLabel t="SKU Market Values" />
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              {!skuEditing && PRODUCT_TYPES.map(pt => skuPrices[pt] ? (
                <span key={pt} style={{ fontSize:11, color:"#AAAAAA" }}>{pt}: <strong style={{color:"#F0F0F0"}}>${parseFloat(skuPrices[pt]).toFixed(2)}</strong></span>
              ) : null)}
              <button onClick={()=>setSkuEditing(p=>!p)} style={{ background:"transparent", border:"1.5px solid #E8317A", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {skuEditing ? "Cancel" : "\u270F\uFE0F Edit"}
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
              <Btn onClick={async()=>{ await onSaveSkuPrices(skuForm); setSkuEditing(false); }} variant="green">{"\uD83D\uDCBE Save SKU Prices"}</Btn>
            </>
          )}
        </div>
      )}

      {/* Supply Cost Config -- Admin only */}
      {canEdit && (
        <div style={{ ...S.card, border:"2px solid #6B2D8B22" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: supplyEditing ? 14 : 0 }}>
            <SectionLabel t="Supply Cost Per Unit" />
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              {!supplyEditing && SUPPLY_ITEMS.map(({ key, label }) => skuPrices[`supply_${key}`] ? (
                <span key={key} style={{ fontSize:11, color:"#AAAAAA" }}>{label}: <strong style={{color:"#F0F0F0"}}>${parseFloat(skuPrices[`supply_${key}`]).toFixed(3)}</strong></span>
              ) : null)}
              <button onClick={()=>setSupplyEditing(p=>!p)} style={{ background:"transparent", border:"1.5px solid #6B2D8B", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {supplyEditing ? "Cancel" : "\u270F\uFE0F Edit"}
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
              <Btn onClick={async()=>{ await onSaveSkuPrices({...skuPrices,...supplyForm}); setSupplyEditing(false); }} variant="green">{"\uD83D\uDCBE Save Supply Costs"}</Btn>
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
                <span style={{ fontSize:10, color:"#AAAAAA" }}>{"\u2191"}{s.received} rcvd</span>
                <span style={{ fontSize:10, color:"#AAAAAA" }}>{"\u2193"}{s.used} used</span>
              </div>
              {skuPrices[pt] && <div style={{ marginTop:6, fontSize:10, color:pc.text, fontWeight:700 }}>${parseFloat(skuPrices[pt]).toFixed(2)}/unit</div>}
              {out  && <div style={{ marginTop:8, background:"#111111", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{"\uD83D\uDEA8 Out of Stock"}</div>}
              {!out && low && <div style={{ marginTop:8, background:"#111111", color:"#AAAAAA", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700 }}>{"\u26A0 Low Stock"}</div>}
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
                  <button onClick={cancelForm} style={{ background:"none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:18 }}>{"\u2715"}</button>
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
                  <Btn onClick={handleSave} disabled={!form.productType||!form.qty||!form.date} variant="green">{"\uD83D\uDCBE"}{editId?"Update":"Save"} Shipment</Btn>
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
          ? <div style={{ textAlign:"center", color:"#D1D5DB", padding:"30px 0" }}>No shipments yet -- add one above</div>
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
                      <td style={{ ...S.td, color:"#AAAAAA" }}>{s.notes||"--"}</td>
                      <td style={S.td}>
                        {canEdit && (
                          <div style={{ display:"flex", gap:6 }}>
                            <button onClick={()=>openEdit(s)} style={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>{"\u270F\uFE0F"}</button>
                            <button onClick={()=>{ if(window.confirm("Delete this shipment?")) onDeleteShipment(s.id); }} style={{ background:"none", border:"1px solid #FCA5A5", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"#E8317A" }}>{"\uD83D\uDDD1"}</button>
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
                        {(parseInt(u[pt])||0)>0 ? `-${u[pt]}` : "--"}
                      </td>
                    ))}
                    <td style={S.td}>
                      {canEdit && onDeleteProductUsage && (
                        <button
                          onClick={()=>{ if(window.confirm("Delete this usage entry? Stock will be restored.")) onDeleteProductUsage(u.id); }}
                          style={{ background:"none", border:"1px solid #FCA5A5", color:"#E8317A", borderRadius:5, padding:"2px 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}
                        >{"\uD83D\uDDD1"}</button>
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

// --- CUSTOMERS CRM ----------------------------------------------
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
    if (!s.lots[lotKey]) s.lots[lotKey] = { key:lotKey, date:c.date||"--", cards:[], lotPaid:c.lotTotalPaid||0, source:c.source||"--", payment:c.payment||"--" };
    s.lots[lotKey].cards.push(c);
    if (c.source) s.sources[c.source] = (s.sources[c.source]||0) + 1;
    if (c.payment) s.payments[c.payment] = (s.payments[c.payment]||0) + 1;
    if (!s.lastDate || new Date(c.dateAdded) > new Date(s.lastDate)) s.lastDate = c.dateAdded;
  });

  const sellers = Object.values(sellerMap).map(s => ({
    ...s,
    lotCount:      Object.keys(s.lots).length,
    lotList:       Object.values(s.lots).sort((a,b) => new Date(b.date)-new Date(a.date)),
    topSource:     Object.entries(s.sources).sort((a,b)=>b[1]-a[1])[0]?.[0] || "--",
    topPayment:    Object.entries(s.payments).sort((a,b)=>b[1]-a[1])[0]?.[0] || "--",
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

  // -- SELLER DETAIL ----------------------------------------------
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
          <button onClick={()=>setSelectedSeller(null)} style={{ background:"#111111", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>{"\u2190 Back"}</button>
          <div>
            <div style={{ fontSize:22, fontWeight:900, color:"#F0F0F0" }}>{s.name}</div>
            <div style={{ fontSize:12, color:"#AAAAAA", marginTop:2 }}>
              {s.topSource !== "--" && <span style={{ color:SOURCE_COLORS[s.topSource]||"#6B7280", fontWeight:700 }}>{s.topSource}</span>}
              {s.topSource !== "--" && " &middot; "}
              Last purchase {s.lastDate ? new Date(s.lastDate).toLocaleDateString() : "--"}
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

  // -- SELLER LIST ------------------------------------------------
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={S.card}>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search customers..." style={{ ...S.inp, flex:1, minWidth:180 }}/>
          <div style={{ display:"flex", gap:4 }}>
            {[["spent","\uD83D\uDCB0 Top Spend"],["cards","\uD83D\uDCE6 Most Cards"],["lots","\uD83D\uDDC2 Most Lots"],["recent","\uD83D\uDD50 Recent"]].map(([val,label]) => (
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
            <div style={{ fontSize:32, marginBottom:12 }}>{"\uD83D\uDC65"}</div>
            <div>No customers yet -- start importing lots from Lot Comp</div>
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
                      {s.topSource !== "--" && <span style={{ fontSize:11, color:srcColor, fontWeight:700 }}>{s.topSource}</span>}
                      {s.topPayment !== "--" && <span style={{ fontSize:11, color:"#AAAAAA" }}>{s.topPayment}</span>}
                      <span style={{ fontSize:11, color:"#AAAAAA" }}>Last: {s.lastDate ? new Date(s.lastDate).toLocaleDateString() : "--"}</span>
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
                    <div style={{ color:"#D1D5DB", fontSize:18 }}>{"\u203A"}</div>
                  </div>
                </div>
              );
            })}
          </div>
      }

      {/* SKU Market Price History */}
      {isAdmin && (() => {
        const snapStreams = [...streams].filter(s => s.date && s.marketSnapshot).sort((a,b) => new Date(a.date)-new Date(b.date));
        if (snapStreams.length < 2) return null;
        return (
          <div style={{ ...S.card, marginTop:14 }}>
            <SectionLabel t="\uD83D\uDCC8 SKU Market Price History" />
            <div style={{ fontSize:11, color:"#555", marginBottom:10 }}>Price per box at time of each stream -- frozen at save</div>
            <div style={{ position:"relative", height:260 }}>
              <canvas id="skuPriceChart" style={{ width:"100%", height:"100%" }}/>
            </div>
            <SkuPriceChart streams={snapStreams}/>
          </div>
        );
      })()}
    </div>
  );
}

function SkuPriceChart({ streams }) {
  const [loaded, setLoaded] = useState(!!window.Chart);
  useEffect(() => {
    if (window.Chart) { setLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, []);
  useEffect(() => {
    if (!loaded || !window.Chart) return;
    const el = document.getElementById("skuPriceChart");
    if (!el) return;
    if (window._skuChart) window._skuChart.destroy();
    const PT_COLORS = { "Double Mega":"#C2410C", "Hobby":"#7B9CFF", "Jumbo":"#4ade80", "Miscellaneous":"#FBBF24" };
    const labels = streams.map(s => s.date);
    const datasets = ["Double Mega","Hobby","Jumbo","Miscellaneous"].map(pt => ({
      label: pt,
      data: streams.map(s => parseFloat(s.marketSnapshot[pt])||null),
      borderColor: PT_COLORS[pt],
      backgroundColor: PT_COLORS[pt]+"33",
      tension: 0.3, pointRadius: 4, pointHoverRadius: 6, spanGaps: true,
    }));
    window._skuChart = new window.Chart(el, {
      type:"line", data:{ labels, datasets },
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{ labels:{ color:"#888", font:{ size:11 }}}, tooltip:{ callbacks:{ label: c => c.dataset.label+": $"+(c.parsed.y?.toFixed(2)||"--") }}},
        scales:{
          x:{ grid:{ color:"#1a1a1a" }, ticks:{ color:"#888", font:{ size:10 }, maxTicksLimit:12 }},
          y:{ grid:{ color:"#1a1a1a" }, ticks:{ color:"#888", font:{ size:11 }, callback: v => "$"+v }, beginAtZero:false }
        }
      }
    });
  }, [loaded, streams.length]);
  return null;
}

// --- STREAMS (wrapper: recap + cards + commission) ---------------
// --- BREAK PLANNER -------------------------------------------
function BreakPlanner({ skuPrices={}, userRole }) {
  const isAdmin = ["Admin"].includes(userRole?.role);
  const EMPTY_PRODUCT = { type:"", qty:"1" };
  const [products,    setProducts]    = useState([{ ...EMPTY_PRODUCT, id:uid() }]);
  const [targetPct,   setTargetPct]   = useState("60");
  const [spots,       setSpots]       = useState("30");
  const [breaker,     setBreaker]     = useState(BREAKERS[0]);
  const [whatnotPct,  setWhatnotPct]  = useState("8");  // Whatnot fee %
  const [couponAmt,   setCouponAmt]   = useState("0");

  function addProduct() { setProducts(p=>[...p, { ...EMPTY_PRODUCT, id:uid() }]); }
  function removeProduct(id) { setProducts(p=>p.filter(x=>x.id!==id)); }
  function updateProduct(id, field, val) { setProducts(p=>p.map(x=>x.id===id?{...x,[field]:val}:x)); }

  // Calculate total market value from selected products
  const totalMktVal = products.reduce((sum, p) => {
    const price = parseFloat(skuPrices[p.type]) || 0;
    const qty   = parseInt(p.qty) || 0;
    return sum + price * qty;
  }, 0);

  const targetMultiple = totalMktVal > 0 ? parseFloat(targetPct)/100 : 0;
  const targetGross    = totalMktVal * targetMultiple;
  const numSpots       = parseInt(spots) || 1;
  const spotPrice      = targetGross / numSpots;

  // Financial projections
  const whatnotFee  = targetGross * (parseFloat(whatnotPct)||0) / 100;
  const coupons     = parseFloat(couponAmt) || 0;
  const streamExp   = coupons;
  const reimbExp    = 0; // no reimbursable expenses in planner (coupons not reimbursed)
  const netRev      = targetGross - whatnotFee - streamExp;
  const bazNet      = netRev * 0.30;
  const grossForComm = targetGross - streamExp;
  const bazNetForComm = grossForComm * 0.30;
  const repExp      = streamExp * 0.135;
  const mm          = targetGross > 0 ? targetGross / totalMktVal : 0;
  const rate        = mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
  const commBase    = bazNet;
  const commAmt     = commBase * rate;
  const bazTrueNet  = bazNet - commAmt;

  // Zone based on market multiple (targetGross / totalMktVal)
  // 1.5x+ = green, 1.3-1.5x = yellow, <1.3x = red
  const zone = targetMultiple >= 1.5 ? { c:"#4ade80", bg:"#0a1a0a", l:"\uD83D\uDFE2 Green &middot; "+targetMultiple.toFixed(2)+"x" }
             : targetMultiple >= 1.3 ? { c:"#FBBF24", bg:"#1a1400", l:"\uD83D\uDFE1 Yellow &middot; "+targetMultiple.toFixed(2)+"x" }
             : { c:"#E8317A", bg:"#1a0a0a", l:"\uD83D\uDD34 Red &middot; "+targetMultiple.toFixed(2)+"x" };

  const breakEvenGross  = totalMktVal * 1.0;
  const breakEvenSpot   = breakEvenGross / numSpots;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Inputs */}
      <div style={S.card}>
        <SectionLabel t="\uD83E\uDDEE Break Planner" />
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>

          {/* Products */}
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
              <label style={S.lbl}>Products to Rip</label>
              <button onClick={addProduct} style={{ background:"none", border:"1px solid #333", color:"#E8317A", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>+ Add Product</button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {products.map(p => {
                const price = parseFloat(skuPrices[p.type]) || 0;
                const subtotal = price * (parseInt(p.qty)||0);
                return (
                  <div key={p.id} style={{ display:"grid", gridTemplateColumns:"1fr 80px auto auto", gap:8, alignItems:"center" }}>
                    <select value={p.type} onChange={e=>updateProduct(p.id,"type",e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
                      <option value="">-- Select Product --</option>
                      {PRODUCT_TYPES.map(pt=>(
                        <option key={pt} value={pt}>{pt}{skuPrices[pt]?` ($${parseFloat(skuPrices[pt]).toFixed(2)}/box)`:" (no price set)"}</option>
                      ))}
                    </select>
                    <input type="number" min="1" value={p.qty} onChange={e=>updateProduct(p.id,"qty",e.target.value)} placeholder="Qty" style={{ ...S.inp, textAlign:"center" }}/>
                    <div style={{ fontSize:13, fontWeight:700, color:subtotal>0?"#E8317A":"#333", whiteSpace:"nowrap", minWidth:80, textAlign:"right" }}>
                      {subtotal>0?`$${subtotal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"--"}
                    </div>
                    {products.length > 1 && <button onClick={()=>removeProduct(p.id)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:16 }}>{"\u2715"}</button>}
                  </div>
                );
              })}
            </div>
            {totalMktVal > 0 && (
              <div style={{ marginTop:10, padding:"10px 14px", background:"#1a1a1a", borderRadius:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontSize:12, color:"#888" }}>Total Market Value</span>
                <span style={{ fontSize:18, fontWeight:900, color:"#F0F0F0" }}>${totalMktVal.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
              </div>
            )}
          </div>

          {/* Settings row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr", gap:12 }}>
            <div>
              <label style={S.lbl}>Number of Spots</label>
              <input type="number" min="1" value={spots} onChange={e=>setSpots(e.target.value)} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Target Market % (e.g. 65)</label>
              <input type="number" min="1" max="200" value={targetPct} onChange={e=>setTargetPct(e.target.value)} style={{ ...S.inp, color: targetMultiple<0.65?"#4ade80":targetMultiple<0.70?"#FBBF24":"#E8317A" }}/>
            </div>
            <div>
              <label style={S.lbl}>Whatnot Fee %</label>
              <input type="number" min="0" max="100" value={whatnotPct} onChange={e=>setWhatnotPct(e.target.value)} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Est. Coupons ($)</label>
              <input type="number" min="0" value={couponAmt} onChange={e=>setCouponAmt(e.target.value)} style={S.inp}/>
            </div>
            <div>
              <label style={S.lbl}>Breaker</label>
              <select value={breaker} onChange={e=>setBreaker(e.target.value)} style={{ ...S.inp, cursor:"pointer" }}>
                {BREAKERS.map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {totalMktVal > 0 && targetGross > 0 && (
        <>
          {/* Spot price hero */}
          <div style={{ ...S.card, background:zone.bg, border:`2px solid ${zone.c}44`, textAlign:"center", padding:"28px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:zone.c, textTransform:"uppercase", letterSpacing:2, marginBottom:8 }}>{zone.l} &middot; {targetPct}% of Market Value</div>
            <div style={{ fontSize:13, color:"#888", marginBottom:6 }}>Price per spot to hit your target</div>
            <div style={{ fontSize:56, fontWeight:900, color:zone.c, letterSpacing:-1 }}>${spotPrice.toFixed(2)}</div>
            <div style={{ fontSize:13, color:"#666", marginTop:6 }}>{numSpots} spots \u00D7 ${spotPrice.toFixed(2)} = <strong style={{color:"#F0F0F0"}}>${targetGross.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong> gross</div>
          </div>

          {/* Financial breakdown */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
            {[
              { l:"Est. Gross Revenue",  v:`$${targetGross.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`, c:"#F0F0F0", sub:`${numSpots} spots @ $${spotPrice.toFixed(2)}` },
              { l:"Bazooka Net (30%)",   v:fmt(bazNet),    c:"#E8317A",  sub:`After ${whatnotPct}% Whatnot fee` },
              { l:`${breaker}'s Commission`, v:fmt(commAmt), c:"#4ade80", sub:`${(rate*100).toFixed(0)}% rate &middot; ${(mm).toFixed(2)}x multiple` },
            ].map(({l,v,c,sub})=>(
              <div key={l} style={{ ...S.card, textAlign:"center" }}>
                <div style={{ fontSize:24, fontWeight:900, color:c, marginBottom:4 }}>{v}</div>
                <div style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{l}</div>
                <div style={{ fontSize:11, color:"#555" }}>{sub}</div>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
            <div style={{ padding:"14px 20px 10px" }}><SectionLabel t="Spot Price Scenarios" /></div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                {["Target %","Spot Price","Est. Gross","Bazooka Net","Commission","Zone"].map(h=><th key={h} style={S.th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[110,120,130,140,150,160,170,180].map((pct,i) => {
                  const g = totalMktVal * pct/100;
                  const sp = g / numSpots;
                  const wf = g * (parseFloat(whatnotPct)||0) / 100;
                  const nr = g - wf - (parseFloat(couponAmt)||0);
                  const bn = nr * 0.30;
                  const gfc = g - (parseFloat(couponAmt)||0);
                  const bnc = gfc * 0.30;
                  const re = (parseFloat(couponAmt)||0) * 0.135;
                  const mult = totalMktVal > 0 ? g/totalMktVal : 0;
                  const r = mult>=1.8?0.55:mult>=1.7?0.50:mult>=1.6?0.45:mult>=1.5?0.40:0.35;
                  const ca = (bnc-re) * r;
                  const isTarget = pct === parseInt(targetPct);
                  const zc = pct>=150?"#4ade80":pct>=130?"#FBBF24":"#E8317A";
                  const zl = pct>=150?"\uD83D\uDFE2 Green":pct>=130?"\uD83D\uDFE1 Yellow":"\uD83D\uDD34 Red";
                  return (<tr key={pct} style={{ background:isTarget?"#1a1520":i%2===0?"#111111":"#0d0d0d", borderBottom:"1px solid #1a1a1a" }}>
                      <td style={{ ...S.td, fontWeight:isTarget?900:400, color:zc }}>{pct}%{isTarget?" \u2190 target":""}</td>
                      <td style={{ ...S.td, fontWeight:900, color:isTarget?zc:"#F0F0F0" }}>${sp.toFixed(2)}</td>
                      <td style={{ ...S.td, color:"#F0F0F0" }}>${g.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td style={{ ...S.td, color:"#E8317A" }}>{fmt(bn)}</td>
                      <td style={{ ...S.td, color:"#4ade80", fontWeight:700 }}>{fmt(ca)}</td>
                      <td style={{ ...S.td }}><span style={{ color:zc, fontWeight:700, fontSize:11 }}>{zl}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Break-even callout */}
          <div style={{ ...S.card, background:"#0a0f1a", border:"1px solid #7B9CFF33", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#E8317A", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>{"\uD83D\uDEA8 Break-Even Spot Price (1.0x)"}</div>
              <div style={{ fontSize:12, color:"#666" }}>At this price you're just recovering market value -- no profit</div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:28, fontWeight:900, color:"#7B9CFF" }}>${breakEvenSpot.toFixed(2)}</div>
              <div style={{ fontSize:11, color:"#555" }}>${breakEvenGross.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})} gross needed</div>
            </div>
          </div>
        </>
      )}

      {totalMktVal === 0 && (
        <div style={{ ...S.card, textAlign:"center", padding:"60px 40px", color:"#555" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>{"\uD83E\uDDEE"}</div>
          <div style={{ fontSize:14 }}>{"Select a product and set your prices in Inventory \u2192 Product Tracking to get started"}</div>
        </div>
      )}
    </div>
  );
}

function Streams({ inventory, breaks, onAdd, onBulkAdd, onDeleteBreak, user, userRole, streams=[], onSaveStream, onDeleteStream, productUsage=[], onSaveProductUsage, shipments=[], skuPrices={}, historicalData=[], onSavePayStub, onUpsertBuyers, payStubs=[], onDeletePayStub, cardPools=[], imcFormUrl="", onSaveImcFormUrl }) {
  const isAdmin    = ["Admin"].includes(userRole?.role);
  const isShipping = userRole?.role === "Shipping";
  const ALL_STREAM_TABS = [
    { id:"recap",      label:"\uD83D\uDCCB Stream Recap", roles:["Admin","Streamer","Procurement"] },
    { id:"cards",      label:"\uD83C\uDCCF Log Cards",    roles:["Admin","Streamer","Procurement","Shipping"] },
    { id:"commission", label:"\uD83D\uDCB5 Commission",   roles:["Admin","Streamer","Procurement"] },
    { id:"planner",    label:"\uD83E\uDDEE Break Planner", roles:["Admin","Streamer","Procurement"] },
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

      {streamTab === "recap"      && <BreakLog      inventory={inventory} breaks={breaks} onAdd={onAdd} onBulkAdd={onBulkAdd} onDeleteBreak={onDeleteBreak} user={user} userRole={userRole} streams={streams} onSaveStream={onSaveStream} onDeleteStream={onDeleteStream} productUsage={productUsage} onSaveProductUsage={onSaveProductUsage} shipments={shipments} recapOnly={true} skuPrices={skuPrices} onUpsertBuyers={onUpsertBuyers} imcFormUrl={imcFormUrl} onSaveImcFormUrl={onSaveImcFormUrl}/>}
      {streamTab === "cards"      && <BreakLog      inventory={inventory} breaks={breaks} onAdd={onAdd} onBulkAdd={onBulkAdd} onDeleteBreak={onDeleteBreak} user={user} userRole={userRole} streams={streams} onSaveStream={onSaveStream} productUsage={productUsage} onSaveProductUsage={onSaveProductUsage} shipments={shipments} cardsOnly={true} cardPools={cardPools}/>}
      {streamTab === "commission" && <Commission    streams={streams} onSave={onSaveStream} onDelete={onDeleteStream} user={user} userRole={userRole} historicalData={historicalData} onSavePayStub={onSavePayStub} payStubs={payStubs} onDeletePayStub={onDeletePayStub}/>}
      {streamTab === "planner"    && <BreakPlanner  skuPrices={skuPrices} userRole={userRole}/>}
    </div>
  );
}

// --- COMMISSION --------------------------------------------------
function StubRow({ stub, S, onDeletePayStub }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background:"#0d0d0d", border:"1px solid #222", borderRadius:10, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 16px", flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:32, height:32, borderRadius:"50%", background:"#1a1a1a", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>{"\uD83D\uDCB5"}</div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontWeight:800, fontSize:13, color:"#F0F0F0" }}>{stub.breaker}</span>
              <span style={{ fontSize:11, color:"#666" }}>{stub.period}</span>
              {!stub.read && <span style={{ background:"#E8317A22", color:"#E8317A", border:"1px solid #E8317A44", borderRadius:20, padding:"1px 8px", fontSize:10, fontWeight:700 }}>Unread</span>}
            </div>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>
              {stub.streamCount} stream{stub.streamCount!==1?"s":""} &middot; Generated {new Date(stub.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} by {stub.createdBy||"Admin"}
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:18, fontWeight:900, color:"#4ade80" }}>{fmt(stub.totalComm)}</div>
            <div style={{ fontSize:9, color:"#555", textTransform:"uppercase", letterSpacing:1 }}>Commission</div>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button onClick={()=>setExpanded(p=>!p)} style={{ background:"#1a1a1a", border:"1px solid #333", color:"#888", borderRadius:7, padding:"5px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{expanded?"\u25B2 Hide":"\u25BC View"}</button>
            <button onClick={()=>{ if(window.confirm(`Delete pay stub for ${stub.breaker}?\n\nThis removes it from their dashboard too.`)) onDeletePayStub(stub.id); }} style={{ background:"#1a0a0a", border:"1px solid #E8317A33", color:"#E8317A", borderRadius:7, padding:"5px 10px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1"}</button>
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop:"1px solid #222", padding:"12px 16px" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Date","Type","Gross","Baz Net","Rate","Commission"].map(h=><th key={h} style={S.th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(stub.streams||[]).map((s,i)=>(
                <tr key={i} style={{ background:i%2===0?"#111111":"#0d0d0d" }}>
                  <td style={S.td}>{new Date(s.date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</td>
                  <td style={{ ...S.td, color:"#888" }}>{s.breakType}{s.binOnly?" BIN":""}{s.sessionType?<span style={{marginLeft:5,fontSize:11,color:"#7B9CFF"}}>{({day:"\u2600\uFE0F",night:"\uD83C\uDF19",weekend:"\uD83D\uDCC5",event:"\uD83C\uDF89"})[s.sessionType]||""}</span>:""}</td>
                  <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}>{fmt(s.gross)}</td>
                  <td style={{ ...S.td, color:"#7B9CFF" }}>{fmt(s.bazNet||0)}</td>
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
  );
}

function Commission({ streams, onSave, onDelete, user, userRole, historicalData=[], onSavePayStub, payStubs=[], onDeletePayStub }) {
  const isAdmin    = ["Admin"].includes(userRole?.role);
  const curUser    = user?.displayName?.split(" ")[0] || "";
  const myBreaker  = BREAKERS.find(b => curUser.toLowerCase().includes(b.toLowerCase()));

  const EMPTY = { date:"", breaker:"", breakType:"auction", grossRevenue:"", whatnotFees:"", coupons:"", whatnotPromo:"", magpros:"", packagingMaterial:"", topLoaders:"", chaserCards:"", chaserCardIds:"", marketMultiple:"", newBuyers:"", binOnly:false, notes:"" };
  const [form,      setForm]      = useState(EMPTY);
  const [editing,   setEditing]   = useState(null);
  const [viewStream,setViewStream]= useState(null);
  const [importing, setImporting] = useState(false);
  const [csvError,  setCsvError]  = useState("");
  const [showStub,     setShowStub]     = useState(false);
  const [showStubHist, setShowStubHist] = useState(false);
  const [stubBreaker,  setStubBreaker]  = useState("");
  const [stubPeriod,   setStubPeriod]   = useState("week");
  const [stubHistFilter, setStubHistFilter] = useState("");
  const [stubAdminView,  setStubAdminView]  = useState(false); // false = rep view (default for sending)
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
    const streamExp = promo+magpros+pack+topload+chaser;
    const reimbExp  = streamExp;
    const grossForComm = gross - streamExp - coupons;
    const bazNetForComm = grossForComm * 0.30;
    const repExp   = streamExp * 0.135;
    const imcExpReimb = reimbExp * 0.70;
    const commBase = bazNet;
    const rate     = getCommRate(s);
    const commAmt  = commBase * rate;
    return { gross, totalExp, netRev, bazNet, bobaNet, repExp, imcExpReimb, commBase, rate, commAmt, collabAmt:bazNet*(s.collabPartner&&s.collabPartner!=="_"?parseFloat(s.collabPct||0)/100:0), bazTrueNet: bazNet - commAmt + imcExpReimb - bazNet*(s.collabPartner&&s.collabPartner!=="_"?parseFloat(s.collabPct||0)/100:0) };
  }

  // Admins see all streams; streamers see only their own
  const CEO_NAMES = ["Dev","Devin","Derrik"];
  const isCEO = CEO_NAMES.some(n => curUser.toLowerCase().includes(n.toLowerCase()));
  const visibleStreams = isAdmin
    ? streams
    : streams.filter(s => s.breaker === myBreaker);

  // Period filter -- available to everyone
  const [period,        setPeriod]        = useState("all");
  const [customFrom,    setCustomFrom]    = useState("");
  const [customTo,      setCustomTo]      = useState("");
  const [breakerFilter, setBreakerFilter] = useState("all");

  function inPeriod(dateStr) {
    const d   = parseLocalDate(dateStr);
    const now = new Date();
    if (period === "week") {
      const start = new Date(now);
      const day = now.getDay();
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0,0,0,0);
      const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
      return d >= start && d <= end;
    }
    if (period === "month")   return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
    if (period === "quarter") {
      const q = Math.floor(now.getMonth()/3);
      return Math.floor(d.getMonth()/3)===q && d.getFullYear()===now.getFullYear();
    }
    if (period === "year")    return d.getFullYear()===now.getFullYear();
    if (period === "custom" && customFrom && customTo) {
      const from = parseLocalDate(customFrom); from.setHours(0,0,0,0);
      const to   = parseLocalDate(customTo);   to.setHours(23,59,59,999);
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

  // CSV import -- parse Whatnot export
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

  // -- DETAIL VIEW ----------------------------------------------
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
          <button onClick={()=>setViewStream(null)} style={{ background:"#111111", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>{"\u2190 Back"}</button>
          <div>
            <div style={{ fontSize:18, fontWeight:900, color:"#F0F0F0" }}>{new Date(s.date).toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
            <div style={{ fontSize:12, color:"#AAAAAA", marginTop:2, display:"flex", gap:10 }}>
              <Badge bg={bc.bg} color={bc.text}>{s.breaker}</Badge>
              <span>{s.binOnly ? "BIN Break (flat 35%)" : `${s.breakType} &middot; ${(c.rate*100).toFixed(0)}% commission`}</span>
              {s.newBuyers>0 && <span style={{ background:"#111111", color:"#E8317A", borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:700 }}>{"\uD83C\uDF31"}{s.newBuyers} new buyers</span>}
            </div>
          </div>

        </div>


        {/* Commission calc */}
        <div style={{ ...S.card, border:"2px solid #166534" }}>
          <SectionLabel t={`${s.breaker}'s Commission`} />
          <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:16 }}>
            {[
              { l:"Gross Revenue",                        v:fmt(c.gross),                          c:"#F0F0F0", indent:false },
              { l:`\u2212 Whatnot Fees`,                       v:"\u2212 "+fmt(parseFloat(s.whatnotFees)||0), c:"#666",    indent:true  },
              { l:`\u2212 Coupons`,                            v:"\u2212 "+fmt(parseFloat(s.coupons)||0),     c:"#666",    indent:true  },
              { l:`\u2212 Stream Expenses`,                    v:"\u2212 "+fmt(parseFloat(s.whatnotPromo||0)+(parseFloat(s.magpros)||0)+(parseFloat(s.packagingMaterial)||0)+(parseFloat(s.topLoaders)||0)+(parseFloat(s.chaserCards)||0)), c:"#666", indent:true },
              { l:"= Net Revenue",                        v:fmt(c.netRev),                          c:"#F0F0F0", indent:false, bold:true },
              { l:"\u00D7 30% (Bazooka Share)",                v:fmt(c.bazNet),                          c:"#E8317A", indent:true  },
              { l:`\u2212 Your Expenses (13.5% of stream costs)`, v:"\u2212 "+fmt(c.repExp),                 c:"#991b1b", indent:true  },
              ...(isAdmin ? [{ l:"+ IMC Expense Reimb (70%)", v:"+ "+fmt(c.imcExpReimb||0),        c:"#166534", indent:true  }] : []),
              { l:"= Commission Base",                    v:fmt(c.bazNet - c.repExp),               c:"#7B9CFF", indent:false, bold:true },
              { l:`\u00D7 Rate (${(c.rate*100).toFixed(0)}%${s.binOnly?" -- BIN flat":s.marketMultiple?" -- "+s.marketMultiple+"x":""})`, v:`\u00D7 ${(c.rate*100).toFixed(0)}%`, c:"#6B7280", indent:true },
            ].map(({l,v,c:clr,indent,bold}) => (
              <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"7px 12px", borderBottom:"1px solid #1a1a1a", paddingLeft:indent?"24px":"12px" }}>
                <span style={{ fontSize:13, color:bold?"#F0F0F0":"#AAAAAA", fontWeight:bold?700:400 }}>{l}</span>
                <span style={{ fontSize:13, fontWeight:700, color:clr }}>{v}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"#0a1a0a", border:"1px solid rgba(22,101,52,0.4)", borderRadius:10, marginBottom:10 }} className="save-flash">
            <span style={{ fontWeight:800, fontSize:16, color:"#4ade80" }}>{"\uD83D\uDCB5 Commission Earned"}</span>
            <span style={{ fontWeight:900, fontSize:28, color:"#4ade80" }}>{fmt(c.commAmt)}</span>
          </div>
          {isAdmin && (
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", background:"#111111", borderRadius:10 }}>
            <span style={{ fontWeight:800, fontSize:16, color:"#E8317A" }}>{"\uD83C\uDFE6 Bazooka True Net"}</span>
            <span style={{ fontWeight:900, fontSize:28, color:"#E8317A" }}>{fmt(c.bazTrueNet)}</span>
          </div>
          )}
          {s.marketMultiple && !s.binOnly && (
            <div style={{ marginTop:10, fontSize:12, color:"#AAAAAA", textAlign:"right" }}>Market multiple: {s.marketMultiple}x \u2192 {(c.rate*100).toFixed(0)}% rate</div>
          )}
          {s.notes && <div style={{ marginTop:10, padding:"8px 12px", background:"#111111", borderRadius:7, fontSize:12, color:"#AAAAAA", fontStyle:"italic" }}>{s.notes}</div>}
        </div>
      </div>
    );
  }

  // -- FORM -----------------------------------------------------
  if (editing) {
    const preview = calcStream(form);
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={cancelEdit} style={{ background:"#111111", border:"1.5px solid #E5E7EB", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>{"\u2190 Cancel"}</button>
          <div style={{ fontSize:16, fontWeight:800, color:"#F0F0F0" }}>{editing==="new"?"New Stream":"Edit Stream"}</div>
          {importing && (
            <label style={{ background:"#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              {"\uD83D\uDCC2 Select Whatnot CSV"}<input type="file" accept=".csv" onChange={handleCSV} style={{ display:"none" }}/>
            </label>
          )}
          <Btn onClick={()=>setImporting(p=>!p)} variant="ghost">{importing?"Cancel Import":"\uD83D\uDCC2 Import CSV"}</Btn>
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
          <Btn onClick={handleSave} disabled={!form.date||!form.breaker} variant="green">{"\uD83D\uDCBE Save Stream"}</Btn>
          <Btn onClick={cancelEdit} variant="ghost">Cancel</Btn>
        </div>
      </div>
    );
  }

  // -- LIST VIEW ------------------------------------------------
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* -- PAY STUB GENERATOR -- */}
      {isAdmin && (
        <div style={{ ...S.card, border:"2px solid rgba(232,49,122,0.3)" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showStub?14:0 }}>
            <div style={{ fontSize:10, fontWeight:800, color:"#E8317A", textTransform:"uppercase", letterSpacing:2.5, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:14, height:2, background:"#E8317A", borderRadius:1 }}/>
              {"\uD83D\uDCB5 Pay Stub Generator"}</div>
            <button onClick={()=>setShowStub(p=>!p)} style={{ background:"transparent", border:"1.5px solid #E8317A", color:"#E8317A", borderRadius:7, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {showStub ? "\u25B2 Hide" : "\u25BC Generate"}
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
              // Parse date string as local time (not UTC) to avoid timezone shift
              const parts = dateStr.split("-");
              const d = parts.length === 3
                ? new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), 12, 0, 0)
                : new Date(dateStr);
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
              const streamExp=promo+magpros+pack+topload+chaser; const reimbExp=streamExp;
              const totalExp=fees+coupons+streamExp, netRev=gross-totalExp, bazNet=netRev*0.30;
              const grossForComm=gross-streamExp-coupons, bazNetForComm=grossForComm*0.30;
              const repExp=streamExp*0.135, imcExpReimb=reimbExp*0.70;
              const mm=parseFloat(s.marketMultiple)||0, overrideRate=s.commissionOverride!==""&&s.commissionOverride!=null?parseFloat(s.commissionOverride)/100:null;
              const rate=overrideRate!==null?overrideRate:s.binOnly?0.35:mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
              const commAmt=bazNet*rate;
              const collabAmt=bazNet*(s.collabPartner&&s.collabPartner!=="_"?parseFloat(s.collabPct||0)/100:0); const bazTrueNet=bazNet-repExp-commAmt+imcExpReimb-collabAmt;
              return { gross, totalExp, netRev, bazNet, bazNetForComm, repExp, imcExpReimb, commAmt, bazTrueNet, rate };
            }

            const totals = stubStreams.reduce((acc,s)=>{ const c=calcS(s); acc.gross+=c.gross; acc.baz+=c.bazNet; acc.comm+=c.commAmt; acc.reimb+=c.imcExpReimb; acc.trueNet+=c.bazTrueNet; return acc; }, {gross:0,baz:0,comm:0,reimb:0,trueNet:0});
            const periodLabel = stubPeriod==="week"
              ? `${weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"})} - ${weekEnd.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}`
              : stubFrom && stubTo ? `${stubFrom} - ${stubTo}` : "Select dates";

            function printStub() {
              const adminPDF = stubAdminView;
              const w = window.open("","_blank","width=800,height=900");
              const bc = BC[targetBreaker]||{text:"#E8317A"};
              const streamRows = stubStreams.map(s => {
                const c = calcS(s);
                return adminPDF ? `
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

              w.document.write(`<!DOCTYPE html><html><head><title>Bazooka Pay Stub -- ${targetBreaker}</title>
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
                <button class="no-print print-btn" onclick="window.print()">{"\uD83D\uDDA8 Print / Save as PDF"}</button>
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
                <div class="breaker-badge">{"\uD83C\uDFAF $"}{targetBreaker}</div>
                ${stubStreams.length === 0 ? '<p style="color:#888;text-align:center;padding:40px 0;">No streams found for this period.</p>' : `
                <table>
                  <thead><tr>
                    ${adminPDF
                      ? `<th>Date</th><th>Type</th><th style="text-align:right">Gross</th><th style="text-align:right">Bazooka Net</th><th style="text-align:right">Rep Exp</th><th style="text-align:right">Rate</th><th style="text-align:right">{"\u2212 Commission"}</th><th style="text-align:right">+ IMC Reimb</th><th style="text-align:right">True Net</th>`
                      : `<th>Date</th><th>Type</th><th style="text-align:right">Gross</th><th style="text-align:right">Bazooka Net</th><th style="text-align:right">Rate</th><th style="text-align:right">Commission</th>`
                    }
                  </tr></thead>
                  <tbody>${streamRows}</tbody>
                </table>
                <div class="totals">
                  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888;margin-bottom:14px;">Period Summary</div>
                  <div class="totals-grid" style="grid-template-columns:${adminPDF?"repeat(5,1fr)":"repeat(3,1fr)"}">
                    <div class="tot-item"><div class="tot-val" style="color:#E8317A;">${fmt(totals.gross)}</div><div class="tot-lbl">Total Gross</div></div>
                    <div class="tot-item"><div class="tot-val" style="color:#1B4F8A;">${fmt(totals.baz)}</div><div class="tot-lbl">Bazooka Net (30%)</div></div>
                    ${adminPDF ? `
                    <div class="tot-item"><div class="tot-val" style="color:#991b1b;">-${fmt(totals.comm)}</div><div class="tot-lbl">Commission Paid</div></div>
                    <div class="tot-item"><div class="tot-val" style="color:#166534;">+${fmt(totals.reimb)}</div><div class="tot-lbl">IMC Reimb</div></div>
                    <div class="tot-item"><div class="tot-val" style="color:#166534;">${fmt(totals.trueNet)}</div><div class="tot-lbl">Bazooka True Net</div></div>
                    ` : `
                    <div class="tot-item"><div class="tot-val" style="color:#166534;">${fmt(totals.comm)}</div><div class="tot-lbl">Total Commission</div></div>
                    `}
                  </div>
                </div>
                <div class="payout">
                  <div class="payout-label">{"\uD83D\uDCB5 Commission Earned This Period"}</div>
                  <div class="payout-amt">${fmt(totals.comm)}</div>
                </div>`}
                <div class="footer">Bazooka Breaks, LLC &nbsp;&middot;&nbsp; This document is confidential and intended for the named recipient only.</div>
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
                      <option value="week">This Week (Mon-Sun)</option>
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
                  <Btn onClick={()=>{ printStub(); }} variant="ghost">{"\uD83D\uDC41 Preview PDF"}</Btn>
                  <Btn onClick={async()=>{
                    printStub();
                    try {
                      if (onSavePayStub) await onSavePayStub({
                        breaker: targetBreaker,
                        period: periodLabel,
                        periodType: stubPeriod,
                        streamCount: stubStreams.length,
                        totalGross: totals.gross,
                        totalBaz: totals.baz,
                        totalComm: totals.comm,
                        streams: stubStreams.map(s=>{ const c=calcS(s); return { date:s.date, breakType:s.breakType||"Auction", binOnly:s.binOnly, gross:c.gross, bazNet:c.bazNet, repExp:c.repExp, rate:c.rate, commAmt:c.commAmt }; }),
                      });
                    } catch(e) { console.error("Pay stub save failed:", e); alert("Failed to send stub: " + e.message); }
                  }} variant="green" disabled={stubStreams.length===0}>{"\uD83D\uDCE4 Send to"}{targetBreaker}</Btn>
                  <div style={{ display:"flex", alignItems:"center", gap:8, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"5px 12px" }}>
                    <span style={{ fontSize:11, color:"#666" }}>PDF View:</span>
                    <button onClick={()=>setStubAdminView(false)} style={{ background:!stubAdminView?"#E8317A":"transparent", color:!stubAdminView?"#fff":"#888", border:"none", borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Rep</button>
                    <button onClick={()=>setStubAdminView(true)} style={{ background:stubAdminView?"#1A1A2E":"transparent", color:stubAdminView?"#E8317A":"#888", border:"none", borderRadius:5, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Admin</button>
                  </div>
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
                              { l:"\u2212 Commission",       v:fmt(totals.comm),    c:"#991b1b" },
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

      {/* -- PAY STUB HISTORY -- */}
      {isAdmin && payStubs.length > 0 && (
        <div style={{ ...S.card, border:"1px solid #2a2a2a" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: showStubHist ? 14 : 0 }}>
            <div style={{ fontSize:10, fontWeight:800, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:2.5, display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:14, height:2, background:"#AAAAAA", borderRadius:1 }}/>
              {"\uD83D\uDCCB Statement History ("}{payStubs.length})
            </div>
            <button onClick={()=>setShowStubHist(p=>!p)} style={{ background:"transparent", border:"1.5px solid #333", color:"#888", borderRadius:7, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {showStubHist?"\u25B2 Hide":"\u25BC Show"}
            </button>
          </div>
          {showStubHist && (
            <div>
              {/* Filter by breaker */}
              <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
                <span style={{ fontSize:11, color:"#666" }}>Filter:</span>
                <button onClick={()=>setStubHistFilter("")} style={{ background:!stubHistFilter?"#1A1A2E":"transparent", color:!stubHistFilter?"#E8317A":"#888", border:`1.5px solid ${!stubHistFilter?"#E8317A":"#2a2a2a"}`, borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>All</button>
                {BREAKERS.map(b=>(
                  <button key={b} onClick={()=>setStubHistFilter(b)} style={{ background:stubHistFilter===b?"#1A1A2E":"transparent", color:stubHistFilter===b?"#E8317A":"#888", border:`1.5px solid ${stubHistFilter===b?"#E8317A":"#2a2a2a"}`, borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{b}</button>
                ))}
              </div>

              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {payStubs
                  .filter(s => !stubHistFilter || s.breaker === stubHistFilter)
                  .map(stub => {
                    return <StubRow key={stub.id} stub={stub} S={S} onDeletePayStub={onDeletePayStub}/>;
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Period filter */}
      <div style={{ ...S.card, padding:"12px 16px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, fontWeight:700, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1, marginRight:4 }}>Period:</span>
          {[["month","This Month"],["quarter","This Quarter"],["year","This Year"],["all","All Time"],["custom","Custom"]].map(([val,label]) => (
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
          { l:"\uD83C\uDF31 New Buyers",     v:totals.newBuyers,                c:"#166534" },
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



      {/* Breaker filter -- admin only */}
      {isAdmin && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {["all", ...BREAKERS].map(b => (
            <button key={b} onClick={()=>{ setBreakerFilter(b); setViewStream(null); setEditing(null); }}
              style={{ background:breakerFilter===b?"#1A1A2E":"transparent", color:breakerFilter===b?"#E8317A":"#9CA3AF", border:`1.5px solid ${breakerFilter===b?"#E8317A":"#E5E7EB"}`, borderRadius:7, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              {b === "all" ? "\uD83D\uDC65 All Breakers" : b}
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
            <div style={{ fontSize:32, marginBottom:12 }}>{"\uD83D\uDCB5"}</div>
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
                  {s.newBuyers>0 && <span style={{ fontSize:12, color:"#E8317A", fontWeight:700 }}>{"\uD83C\uDF31"}{s.newBuyers} new</span>}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:22, fontWeight:900, color:"#E8317A" }}>{fmt(c.commAmt)}</div>
                    <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"uppercase", letterSpacing:1 }}>Commission</div>
                  </div>
                  <span style={{ color:"#D1D5DB", fontSize:18 }}>{"\u203A"}</span>
                </div>
              </div>
            );
          })
      }
    </div>
  );
}

const PUBLIC_WEAPON_COLORS = { Fire:"#F97316", Ice:"#60A5FA", Steel:"#C0C0C0", Brawl:"#EF4444", Glow:"#4ade80", Hex:"#A855F7", Gum:"#F472B6", Metallic:"#E5E7EB", Alt:"#FFFFFF", Super:"#F59E0B" };
const PUBLIC_DECK_SIZE = 60;
const PUBLIC_PLAY_LIMIT = 30;
const PUBLIC_DBS_CAP = 1000;

// --- PUBLIC DECK BUILDER (no auth required) --------------------
function PublicDeckBuilder() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deckCards, setDeckCards] = useState([]);
  const [deckName, setDeckName] = useState("My Deck");
  const [deckType, setDeckType] = useState("none");
  const [deckSearch, setDeckSearch] = useState("");
  const [deckFilterWeap, setDeckFilterWeap] = useState("");
  const [deckFilterHero, setDeckFilterHero] = useState("");
  const [deckFilterPower, setDeckFilterPower] = useState("");
  const [deckFilterPowers, setDeckFilterPowers] = useState(new Set());
  const [deckFilterSet,    setDeckFilterSet]    = useState("");
  const [deckFilterTreat,  setDeckFilterTreat]  = useState("");
  const [deckSlotSort, setDeckSlotSort] = useState("added");

  useEffect(() => {
    async function load() {
      const CACHE_KEY = "boba_checklist_cache_v2";
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { cards: cc, ts } = JSON.parse(raw);
          if (Date.now() - ts < 5*60*1000 && cc?.length > 0) { setCards(cc.filter(c=>{ const t=(c.treatment||"").toLowerCase(); return t!=="plays"&&t!=="bonus plays"&&t!=="home team discount"; })); setLoading(false); return; }
        }
      } catch(e) {}
      const snap = await getDocs(collection(db, "boba_checklist"));
      const all = snap.docs.map(d=>({id:d.id,...d.data()}));
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cards: all, ts: Date.now() })); } catch(e) {}
      setCards(all.filter(c=>{ const t=(c.treatment||"").toLowerCase(); return t!=="plays"&&t!=="bonus plays"&&t!=="home team discount"; }));
      setLoading(false);
    }
    load();
  }, []);

  const deckSet = new Set(deckCards);
  const inDeck  = cards.filter(c => deckSet.has(c.id));
  const empty   = PUBLIC_DECK_SIZE - inDeck.length;
  const isSpec        = deckType==="spec";
  const isApex        = deckType==="apex";
  const isApexMadness = deckType==="apexmadness";
  const hasRules = isSpec||isApex||isApexMadness;
  const dupKey  = c => `${(c.hero||"").toLowerCase()}|${(c.variation||"").toLowerCase()}|${c.power||""}|${(c.weapon||"").toLowerCase()}`;
  const inDeckDupKeys = new Set(inDeck.map(dupKey));
  const powerCount = {};
  inDeck.forEach(c => { const p=c.power||"0"; powerCount[p]=(powerCount[p]||0)+1; });
  const treatCountCore = {}, treatCountApex = {};
  if (isApexMadness) {
    inDeck.forEach(c => {
      const t=(c.treatment||"Unknown").toLowerCase(), p=parseFloat(c.power||0);
      if (p>=115&&p<=160) treatCountCore[t]=(treatCountCore[t]||0)+1;
      if (p>160)          treatCountApex[t]=(treatCountApex[t]||0)+1;
    });
  }
  const totalPower = inDeck.reduce((s,c)=>s+(parseFloat(c.power)||0),0);
  const weaponBreak = {}, heroCover = new Set();
  inDeck.forEach(c=>{ const w=c.weapon||"Unknown"; weaponBreak[w]=(weaponBreak[w]||0)+1; if(c.hero) heroCover.add(c.hero); });
  const weaponEntries = Object.entries(weaponBreak).sort((a,b)=>b[1]-a[1]);

  function canAdd(c) {
    if (deckSet.has(c.id)) return { ok:false, reason:"Already in deck" };
    if (inDeck.length >= PUBLIC_DECK_SIZE) return { ok:false, reason:"Deck full" };
    if (hasRules && inDeckDupKeys.has(dupKey(c))) return { ok:false, reason:"Duplicate card" };
    if (hasRules && (powerCount[c.power||"0"]||0)>=6) return { ok:false, reason:`6 cards already at power ${c.power}` };
    const p = parseFloat(c.power||0);
    if (isSpec && p>160) return { ok:false, reason:`Power ${c.power} exceeds 160` };
    if (isApexMadness && p>160) {
      const t=(c.treatment||"Unknown").toLowerCase();
      const core=treatCountCore[t]||0;
      if (core<10) return { ok:false, reason:`Need 10 core ${c.treatment} cards first (have ${core}/10)` };
      if ((treatCountApex[t]||0)>=1) return { ok:false, reason:`Already have 1 unlocked ${c.treatment} apex card` };
    }
    return { ok:true };
  }

  const weapons = [...new Set(cards.map(c=>c.weapon).filter(Boolean))].sort();
  const heroes  = [...new Set(cards.map(c=>c.hero).filter(Boolean))].sort();
  const powers  = [...new Set(cards.map(c=>c.power).filter(Boolean))].sort((a,b)=>parseFloat(b)-parseFloat(a));

  const available = cards.filter(c => {
    if (deckSet.has(c.id)) return false;
    if (deckFilterWeap && c.weapon!==deckFilterWeap) return false;
    if (deckFilterHero && c.hero!==deckFilterHero) return false;
    if (deckFilterPowers.size > 0 && !deckFilterPowers.has(String(c.power||""))) return false;
    if (deckFilterSet && c.setName!==deckFilterSet) return false;
    if (deckFilterTreat && c.treatment!==deckFilterTreat) return false;
    if (deckSearch && !`${c.hero} ${c.cardNum} ${c.treatment}`.toLowerCase().includes(deckSearch.toLowerCase())) return false;
    return true;
  }).sort((a,b)=>(parseFloat(b.power)||0)-(parseFloat(a.power)||0));

  const S = { inp:{ background:"#111", border:"1px solid #2a2a2a", borderRadius:7, color:"#F0F0F0", padding:"6px 10px", fontSize:12, fontFamily:"inherit", outline:"none", width:"100%" }, card:{ background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 16px" } };

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0a0a0a", color:"#E8317A", fontSize:16, fontWeight:700 }}>Loading cards...</div>;

  return (
    <div style={{ background:"#0a0a0a", minHeight:"100vh", fontFamily:"'Trebuchet MS',sans-serif", color:"#F0F0F0", padding:20 }}>
      <div style={{ maxWidth:1400, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <a href="/" style={{ color:"#555", fontSize:12, textDecoration:"none" }}>{"\u2190 Back"}</a>
          <div style={{ fontSize:22, fontWeight:900, color:"#E8317A" }}>{"\u2694\uFE0F Deck Builder"}</div>
          <select value={deckType} onChange={e=>setDeckType(e.target.value)} style={{ ...S.inp, width:"auto", fontWeight:700, color:deckType==="spec"?"#FBBF24":deckType==="apex"?"#A855F7":"#888" }}>
            <option value="none">No Restrictions</option>
            <option value="spec">{"Spec Deck (\u2264160 power)"}</option>
            <option value="apex">Apex Deck</option>
            <option value="apexmadness">Apex Madness</option>
          </select>
          <span style={{ fontSize:12, color:empty===0?"#4ade80":"#FBBF24", fontWeight:700 }}>{inDeck.length}/{PUBLIC_DECK_SIZE} cards</span>
          <span style={{ fontSize:11, color:"#555", marginLeft:"auto" }}>Log in to save decks</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) clamp(260px,28%,340px)", gap:14, alignItems:"start" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <input value={deckSearch} onChange={e=>setDeckSearch(e.target.value)} placeholder="Search hero, card #, treatment..." style={{ ...S.inp, flex:1, minWidth:140 }}/>
              <select value={deckFilterWeap} onChange={e=>setDeckFilterWeap(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                <option value="">All Weapons</option>
                {[...new Set(cards.map(c=>c.weapon).filter(Boolean))].sort().map(w=><option key={w} value={w}>{w}</option>)}
              </select>
              <select value={deckFilterSet} onChange={e=>setDeckFilterSet(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer", color:deckFilterSet?"#7B9CFF":"#888" }}>
                <option value="">All Sets</option>
                {[...new Set(cards.map(c=>c.setName).filter(Boolean))].sort().map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={deckFilterTreat} onChange={e=>setDeckFilterTreat(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer", color:deckFilterTreat?"#FBBF24":"#888" }}>
                <option value="">All Treatments</option>
                {[...new Set(cards.map(c=>c.treatment).filter(Boolean))].sort().map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select value={deckFilterHero} onChange={e=>setDeckFilterHero(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                <option value="">All Heroes</option>
                {[...new Set(cards.map(c=>c.hero).filter(Boolean))].sort().map(h=><option key={h} value={h}>{h}</option>)}
              </select>
              <span style={{ fontSize:11, color:"#555", alignSelf:"center" }}>{available.length} cards</span>
            </div>
            {/* Multi-select power chips */}
            <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
              {[...new Set(cards.map(c=>c.power).filter(Boolean))].sort((a,b)=>parseFloat(b)-parseFloat(a)).map(p=>{
                const sel = deckFilterPowers.has(p);
                const over = (isSpec||isApexMadness) && parseFloat(p)>160;
                return (
                  <button key={p} onClick={()=>setDeckFilterPowers(prev=>{ const n=new Set(prev); n.has(p)?n.delete(p):n.add(p); return n; })}
                    style={{ background:sel?(over?"#E8317A":"#FBBF2433"):"#111", border:`1px solid ${sel?(over?"#E8317A":"#FBBF24"):"#2a2a2a"}`, color:sel?(over?"#E8317A":"#FBBF24"):"#555", borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                    {p}{over?" \u26A0":""}
                  </button>
                );
              })}
              {deckFilterPowers.size > 0 && (
                <button onClick={()=>setDeckFilterPowers(new Set())} style={{ background:"transparent", border:"1px solid #333", color:"#555", borderRadius:6, padding:"3px 9px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\u2715 Clear"}</button>
              )}
            </div>
            <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:10, overflow:"hidden", maxHeight:560, overflowY:"auto" }}>
              {available.map((c,i)=>{
                const { ok, reason } = canAdd(c);
                const wc = PUBLIC_WEAPON_COLORS[c.weapon]||"#444";
                return (
                  <div key={c.id} onClick={()=>{ if(ok) setDeckCards(p=>[...p,c.id]); }}
                    style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderBottom:"1px solid #111", background:i%2===0?"#0a0a0a":"#0d0d0d", cursor:ok?"pointer":"not-allowed", opacity:ok?1:0.35 }}
                    title={!ok?reason:""}>
                    {c.imageUrl && <img src={c.imageUrl} alt={c.hero} style={{ width:36, height:48, objectFit:"cover", borderRadius:4, flexShrink:0 }}/>}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0" }}>{c.hero}</div>
                      <div style={{ display:"flex", gap:6, marginTop:2, flexWrap:"wrap", fontSize:10 }}>
                        <span style={{ color:"#555" }}>#{c.cardNum}</span>
                        {c.weapon && <span style={{ color:wc, fontWeight:700 }}>{c.weapon}</span>}
                        {c.treatment && <span style={{ color:"#555" }}>{c.treatment}</span>}
                        {!ok && <span style={{ color:"#E8317A" }}>{reason}</span>}
                      </div>
                    </div>
                    {c.power && <div style={{ fontSize:16, fontWeight:900, color:isSpec&&parseFloat(c.power)>160?"#E8317A":wc, flexShrink:0 }}>{c.power}</div>}
                    {ok && <div style={{ fontSize:18, color:"#4ade80", flexShrink:0 }}>+</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ ...S.card }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0", marginBottom:10 }}>{"\u2694\uFE0F Stats"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                {[{l:"Cards",v:`${inDeck.length}/${PUBLIC_DECK_SIZE}`,c:inDeck.length===PUBLIC_DECK_SIZE?"#4ade80":"#FBBF24"},{l:"Total Power",v:Math.round(totalPower).toLocaleString(),c:"#E8317A"},{l:"Heroes",v:heroCover.size,c:"#7B9CFF"},{l:"Avg Power",v:inDeck.length>0?Math.round(totalPower/inDeck.length):0,c:"#FBBF24"}].map(({l,v,c})=>(
                  <div key={l} style={{ background:"#111", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              {weaponEntries.length > 0 && <div>{weaponEntries.map(([w,cnt])=>{ const wc=PUBLIC_WEAPON_COLORS[w]||"#444"; const pct=Math.round(cnt/inDeck.length*100); return (<div key={w} style={{ marginBottom:5 }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}><span style={{ fontSize:11, color:wc, fontWeight:700 }}>{w}</span><span style={{ fontSize:11, color:"#555" }}>{cnt} ({pct}%)</span></div><div style={{ height:4, background:"#1a1a1a", borderRadius:2 }}><div style={{ width:`${pct}%`, height:"100%", background:wc, borderRadius:2 }}/></div></div>); })}</div>}
              {isApexMadness && inDeck.length > 0 && (
                <div style={{ marginTop:12 }}>
                  <div style={{ fontSize:10, color:"#A855F7", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Treatment Unlocks</div>
                  {[...new Set(inDeck.map(c=>c.treatment).filter(Boolean))].sort().map(t => {
                    const tl=t.toLowerCase(), core=treatCountCore[tl]||0, apex=treatCountApex[tl]||0, unlocked=core>=10;
                    return (
                      <div key={t} style={{ marginBottom:6 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                          <span style={{ fontSize:11, color:unlocked?"#A855F7":"#888", fontWeight:unlocked?700:400 }}>{unlocked?"\uD83D\uDD13":"\uD83D\uDD12"} {t}</span>
                          <span style={{ fontSize:11, color:unlocked?"#A855F7":"#555" }}>{core}/10{unlocked?` &middot; ${apex}/1 apex`:""}</span>
                        </div>
                        <div style={{ height:3, background:"#1a1a1a", borderRadius:2 }}>
                          <div style={{ width:`${Math.min(100,core/10*100)}%`, height:"100%", background:unlocked?"#A855F7":"#333", borderRadius:2 }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ ...S.card }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:800, color:"#F0F0F0" }}>Deck Slots -- {empty>0?<span style={{ color:"#FBBF24" }}>{empty} empty</span>:<span style={{ color:"#4ade80" }}>{"Full! \u2705"}</span>}</span>
                <select value={deckSlotSort} onChange={e=>setDeckSlotSort(e.target.value)} style={{ ...S.inp, width:"auto", fontSize:10, padding:"3px 8px", cursor:"pointer" }}>
                  <option value="added">Order Added</option><option value="power">{"Power \u2193"}</option><option value="name">{"Name A\u2192Z"}</option><option value="weapon">Weapon</option>
                </select>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:4 }}>
                {(()=>{ const sorted=[...inDeck].sort((a,b)=>{ if(deckSlotSort==="power") return (parseFloat(b.power)||0)-(parseFloat(a.power)||0); if(deckSlotSort==="name") return (a.hero||"").localeCompare(b.hero||""); if(deckSlotSort==="weapon") return (a.weapon||"").localeCompare(b.weapon||""); return 0; }); return Array.from({length:PUBLIC_DECK_SIZE}).map((_,i)=>{ const c=sorted[i]; if(c){ const wc=PUBLIC_WEAPON_COLORS[c.weapon]||"#444"; return (<div key={i} title={`${c.hero} -- ${c.weapon||""} ${c.power||""}`} onClick={()=>setDeckCards(p=>p.filter(id=>id!==c.id))} style={{ aspectRatio:"3/4", borderRadius:4, overflow:"hidden", position:"relative", cursor:"pointer", border:`1.5px solid ${wc}44`, background:"#1a1a1a" }}>{c.imageUrl?<img src={c.imageUrl} alt={c.hero} style={{ width:"100%", height:"100%", objectFit:"cover" }}/>:<div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:wc, fontWeight:700, textAlign:"center", padding:2 }}>{c.hero?.split(" ")[0]}</div>}</div>); } return (<div key={i} style={{ aspectRatio:"3/4", borderRadius:4, border:"1px dashed #1a1a1a", background:"#080808", display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:9, color:"#222", fontWeight:700 }}>{i+1}</span></div>); }); })()}
              </div>
              {inDeck.length>0 && <button onClick={()=>{ if(window.confirm("Clear deck?")) setDeckCards([]); }} style={{ marginTop:10, background:"transparent", border:"1px solid #E8317A22", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", width:"100%" }}>{"\u2715 Clear"}</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PUBLIC PLAYBOOK BUILDER (no auth required) --------------------
function PublicPlaybookBuilder() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pbCards, setPbCards] = useState([]);
  const [pbSearch, setPbSearch] = useState("");
  const [pbSort, setPbSort] = useState("name");

  useEffect(() => {
    async function load() {
      const CACHE_KEY = "boba_checklist_cache_v2";
      try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
          const { cards: cc, ts } = JSON.parse(raw);
          if (Date.now() - ts < 5*60*1000 && cc?.length > 0) {
            const plays = cc.filter(c=>{ const t=(c.treatment||"").toLowerCase(); return t==="plays"||t==="bonus plays"||t==="home team discount"; });
            setCards(plays); setLoading(false); return;
          }
        }
      } catch(e) {}
      const snap = await getDocs(collection(db, "boba_checklist"));
      const all = snap.docs.map(d=>({id:d.id,...d.data()}));
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cards: all, ts: Date.now() })); } catch(e) {}
      setCards(all.filter(c=>{ const t=(c.treatment||"").toLowerCase(); return t==="plays"||t==="bonus plays"||t==="home team discount"; }));
      setLoading(false);
    }
    load();
  }, []);

  const pbEntryIds = new Set(pbCards.map(e=>e.id));
  const playCount  = pbCards.filter(e=>e.type==="play").length;
  const bonusCount = pbCards.filter(e=>e.type==="bonus").length;
  const playFull   = playCount >= PUBLIC_PLAY_LIMIT;
  const pbResolved = pbCards.map(e=>({...e, card:cards.find(c=>c.id===e.id)})).filter(e=>e.card);
  const totalDbs   = pbResolved.reduce((s,e)=>s+(parseFloat(e.card.dbs)||0),0);
  const dbsLeft    = PUBLIC_DBS_CAP - totalDbs;
  const dbsPct     = Math.min(totalDbs/PUBLIC_DBS_CAP*100,100);
  const dbsOver    = totalDbs > PUBLIC_DBS_CAP;

  const isPlay  = c => { const t=(c.treatment||"").toLowerCase(); return t==="plays"||t==="home team discount"; };
  const isBonus = c => (c.treatment||"").toLowerCase()==="bonus plays";

  const available = cards.filter(c => {
    if (pbEntryIds.has(c.id)) return false;
    if (pbSearch && !`${c.hero} ${c.cardNum} ${c.playAbility||""}`.toLowerCase().includes(pbSearch.toLowerCase())) return false;
    return true;
  }).sort((a,b)=>{
    if (pbSort==="dbs_desc") return (parseFloat(b.dbs)||0)-(parseFloat(a.dbs)||0);
    if (pbSort==="dbs_asc")  return (parseFloat(a.dbs)||0)-(parseFloat(b.dbs)||0);
    return (a.hero||"").localeCompare(b.hero||"");
  });

  const S = { inp:{ background:"#111", border:"1px solid #2a2a2a", borderRadius:7, color:"#F0F0F0", padding:"6px 10px", fontSize:12, fontFamily:"inherit", outline:"none", width:"100%" }, card:{ background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 16px" } };

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#0a0a0a", color:"#E8317A", fontSize:16, fontWeight:700 }}>Loading plays...</div>;

  return (
    <div style={{ background:"#0a0a0a", minHeight:"100vh", fontFamily:"'Trebuchet MS',sans-serif", color:"#F0F0F0", padding:20 }}>
      <div style={{ maxWidth:1400, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
          <a href="/" style={{ color:"#555", fontSize:12, textDecoration:"none" }}>{"\u2190 Back"}</a>
          <div style={{ fontSize:22, fontWeight:900, color:"#E8317A" }}>{"\uD83D\uDCD6 Playbook Builder"}</div>
          <span style={{ fontSize:12, color:playFull?"#E8317A":"#4ade80", fontWeight:700 }}>{playCount}/{PUBLIC_PLAY_LIMIT} plays</span>
          {bonusCount>0 && <span style={{ fontSize:12, color:"#7B9CFF", fontWeight:700 }}>&middot; {bonusCount} BPL</span>}
          <span style={{ fontSize:11, color:"#555", marginLeft:"auto" }}>Log in to save playbooks</span>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) clamp(260px,28%,340px)", gap:14, alignItems:"start" }}>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              <input value={pbSearch} onChange={e=>setPbSearch(e.target.value)} placeholder="Search play name or ability..." style={{ ...S.inp, flex:1 }}/>
              <select value={pbSort} onChange={e=>setPbSort(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                <option value="name">Sort: Name</option>
                <option value="dbs_desc">{"DBS: High \u2192 Low"}</option>
                <option value="dbs_asc">{"DBS: Low \u2192 High"}</option>
              </select>
              <span style={{ fontSize:11, color:"#555", alignSelf:"center" }}>{available.length} plays</span>
            </div>
            <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:10, overflow:"hidden", maxHeight:560, overflowY:"auto" }}>
              {available.map((c,i)=>{
                const wc = PUBLIC_WEAPON_COLORS[c.weapon]||"#444";
                const wouldExceedPlay = (parseFloat(c.dbs)||0)>0 && totalDbs+(parseFloat(c.dbs)||0)>PUBLIC_DBS_CAP;
                const wouldExceedBpl  = wouldExceedPlay;
                return (
                  <div key={c.id} style={{ borderBottom:"1px solid #111", background:i%2===0?"#0a0a0a":"#0d0d0d" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px" }}>
                      {c.imageUrl && <img src={c.imageUrl} alt={c.hero} style={{ width:36, height:48, objectFit:"cover", borderRadius:4, flexShrink:0 }}/>}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0" }}>{c.hero}</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:2, fontSize:10 }}>
                          <span style={{ color:"#555" }}>#{c.cardNum}</span>
                          {c.setName&&<span style={{ color:"#444", fontStyle:"italic" }}>{c.setName}</span>}
                          {c.playCost!==undefined&&c.playCost!==""&&<span style={{ color:"#FBBF24", fontWeight:700 }}>Cost: {c.playCost}</span>}
                          {c.dbs!==undefined&&<span style={{ color:"#A855F7", fontWeight:700 }}>DBS: {c.dbs}</span>}
                          {c.weapon&&<span style={{ color:wc, fontWeight:700 }}>{c.weapon}</span>}
                        </div>
                        {c.playAbility&&<div style={{ fontSize:10, color:"#888", fontStyle:"italic", lineHeight:1.4 }}>{c.playAbility}</div>}
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                        {isPlay(c)&&<button onClick={()=>{ if(!playFull&&!wouldExceedPlay) setPbCards(p=>[...p,{id:c.id,type:"play"}]); }} disabled={playFull||wouldExceedPlay} title={wouldExceedPlay?"Would exceed DBS cap":playFull?"Play slots full":""} style={{ background:"#1a1a2e", border:"1px solid #E8317A44", color:(playFull||wouldExceedPlay)?"#333":"#E8317A", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, cursor:(playFull||wouldExceedPlay)?"not-allowed":"pointer", fontFamily:"inherit" }}>+ Play</button>}
                        {isBonus(c)&&<button onClick={()=>{ if(!wouldExceedBpl) setPbCards(p=>[...p,{id:c.id,type:"bonus"}]); }} disabled={wouldExceedBpl} title={wouldExceedBpl?"Would exceed DBS cap":""} style={{ background:"#0a0f1a", border:"1px solid #7B9CFF44", color:wouldExceedBpl?"#333":"#7B9CFF", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, cursor:wouldExceedBpl?"not-allowed":"pointer", fontFamily:"inherit" }}>+ BPL</button>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ ...S.card }}>
              <div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0", marginBottom:10 }}>{"\uD83D\uDCD6 Playbook"}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                {[{l:"Plays",v:`${playCount}/${PUBLIC_PLAY_LIMIT}`,c:playFull?"#E8317A":"#4ade80"},{l:"Bonus Plays",v:bonusCount,c:"#7B9CFF"}].map(({l,v,c})=>(
                  <div key={l} style={{ background:"#111", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:10 }}>
                <div style={{ height:6, background:"#1a1a1a", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ width:`${Math.min(playCount/PUBLIC_PLAY_LIMIT*100,100)}%`, height:"100%", borderRadius:3, background:playFull?"#E8317A":"linear-gradient(90deg,#E8317A,#7B2FF7)", transition:"width 0.3s" }}/>
                </div>
                <div style={{ fontSize:10, color:"#555", marginTop:4 }}>{PUBLIC_PLAY_LIMIT-playCount} play slots remaining</div>
              </div>
              <div style={{ background:dbsOver?"#1a0a0a":"#0a0a0a", border:`1px solid ${dbsOver?"#E8317A44":"#2a2a2a"}`, borderRadius:8, padding:"10px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:800, color:dbsOver?"#E8317A":"#A855F7" }}>{"\uD83D\uDCB0 DBS"}</span>
                  <span style={{ fontSize:11, fontWeight:700, color:dbsOver?"#E8317A":dbsPct>80?"#FBBF24":"#4ade80" }}>{Math.round(totalDbs)} / {PUBLIC_DBS_CAP}</span>
                </div>
                <div style={{ height:8, background:"#1a1a1a", borderRadius:4, overflow:"hidden", marginBottom:6 }}>
                  <div style={{ width:`${dbsPct}%`, height:"100%", borderRadius:4, background:dbsOver?"#E8317A":dbsPct>80?"linear-gradient(90deg,#FBBF24,#E8317A)":"linear-gradient(90deg,#A855F7,#7B9CFF)", transition:"width 0.3s" }}/>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
                  <span style={{ color:"#555" }}>Used: {Math.round(totalDbs)}</span>
                  <span style={{ color:dbsOver?"#E8317A":dbsLeft<100?"#FBBF24":"#4ade80", fontWeight:700 }}>{dbsOver?`\u26A0\uFE0F Over by ${Math.round(totalDbs-PUBLIC_DBS_CAP)}`:`${Math.round(dbsLeft)} remaining`}</span>
                </div>
              </div>
            </div>
            {pbResolved.length>0 && (
              <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
                {pbResolved.filter(e=>e.type==="play").length>0&&<div><div style={{ padding:"10px 14px 6px", fontSize:10, fontWeight:700, color:"#E8317A", textTransform:"uppercase", letterSpacing:1 }}>{"\u2694\uFE0F Plays ("}{pbResolved.filter(e=>e.type==="play").length})</div>{pbResolved.filter(e=>e.type==="play").map((e,i)=>{ const c=e.card; return (<div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px", borderTop:"1px solid #111", background:i%2===0?"#0d0d0d":"#0a0a0a" }}><div style={{ fontSize:12, color:"#333", width:18, textAlign:"center", flexShrink:0 }}>{i+1}</div>{c.imageUrl&&<img src={c.imageUrl} alt={c.hero} style={{ width:28, height:37, objectFit:"cover", borderRadius:3, flexShrink:0 }}/>}<div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0" }}>{c.hero}</div><div style={{ display:"flex", gap:6, fontSize:10, marginTop:1 }}>{c.playCost!==undefined&&c.playCost!==""&&<span style={{ color:"#FBBF24" }}>Cost: {c.playCost}</span>}{c.dbs!==undefined&&<span style={{ color:"#A855F7" }}>DBS: {c.dbs}</span>}{c.setName&&<span style={{ color:"#444",fontStyle:"italic" }}>{c.setName}</span>}</div></div><button onClick={()=>{ const arr=[...pbCards]; const idx=arr.findIndex((x,j)=>x.type==="play"&&j===pbCards.filter((y,k)=>k<=j&&y.type==="play").length-1+pbCards.slice(0,pbCards.findIndex((y,k)=>{ let pi=0; for(let l=0;l<k;l++) if(pbCards[l].type==="play") pi++; return pi===i&&pbCards[k].type==="play"; })).length-1); const playArr=pbCards.filter(x=>x.type==="play"); const target=playArr[i]; const gi=pbCards.indexOf(target); const a=[...pbCards]; a.splice(gi,1); setPbCards(a); }} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:14, padding:"2px 4px", flexShrink:0 }}>{"\u00D7"}</button></div>); })}</div>}
                {pbResolved.filter(e=>e.type==="bonus").length>0&&<div><div style={{ padding:"10px 14px 6px", fontSize:10, fontWeight:700, color:"#7B9CFF", textTransform:"uppercase", letterSpacing:1, borderTop:"1px solid #1a1a1a" }}>{"\u2B50 Bonus Plays ("}{pbResolved.filter(e=>e.type==="bonus").length})</div>{pbResolved.filter(e=>e.type==="bonus").map((e,i)=>{ const c=e.card; return (<div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px", borderTop:"1px solid #111", background:i%2===0?"#0d0d0d":"#0a0a0a" }}><div style={{ fontSize:12, color:"#333", width:18, flexShrink:0 }}>B{i+1}</div>{c.imageUrl&&<img src={c.imageUrl} alt={c.hero} style={{ width:28, height:37, objectFit:"cover", borderRadius:3, flexShrink:0 }}/>}<div style={{ flex:1, minWidth:0 }}><div style={{ fontSize:12, fontWeight:800, color:"#7B9CFF" }}>{c.hero}</div><div style={{ display:"flex", gap:6, fontSize:10, marginTop:1 }}>{c.playCost!==undefined&&c.playCost!==""&&<span style={{ color:"#FBBF24" }}>Cost: {c.playCost}</span>}{c.dbs!==undefined&&<span style={{ color:"#A855F7" }}>DBS: {c.dbs}</span>}{c.setName&&<span style={{ color:"#444",fontStyle:"italic" }}>{c.setName}</span>}</div></div><button onClick={()=>{ const bonusArr=pbCards.filter(x=>x.type==="bonus"); const target=bonusArr[i]; const gi=pbCards.indexOf(target); const a=[...pbCards]; a.splice(gi,1); setPbCards(a); }} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:14, padding:"2px 4px", flexShrink:0 }}>{"\u00D7"}</button></div>); })}</div>}
                <div style={{ padding:"10px 14px" }}><button onClick={()=>{ if(window.confirm("Clear playbook?")) setPbCards([]); }} style={{ background:"transparent", border:"1px solid #E8317A22", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", width:"100%" }}>{"\u2715 Clear"}</button></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// --- BOBA SHOWCASE (public, no auth required) --------------------
function BobaShowcase({ uid }) {
  const [cards,     setCards]     = useState([]);
  const [owned,     setOwned]     = useState({});
  const [loading,   setLoading]   = useState(true);
  const [spotlight, setSpotlight] = useState(null);
  const [filterSet, setFilterSet] = useState("");
  const [filterWeapon, setFilterWeapon] = useState("");
  const [sortBy,    setSortBy]    = useState("set");
  const [page,      setPage]      = useState(0);
  const [pageDir,   setPageDir]   = useState(1);
  const [copied,    setCopied]    = useState(false);
  const CARDS_PER_PAGE = 9;
  const ownedDocId = uid || "owned";

  useEffect(() => {
    async function load() {
      try {
        // 1. Load owned doc
        const ownedSnap = await getDoc(doc(db, "boba_owned", ownedDocId));
        const ownedData = ownedSnap.exists() ? ownedSnap.data() : {};
        setOwned(ownedData);
        const ownedIds = Object.keys(ownedData);
        if (ownedIds.length === 0) { setLoading(false); return; }

        // 2. Check localStorage cache for image cards (valid 30 min)
        const CACHE_KEY = "boba_showcase_cards_v2";
        let cachedCards = null;
        try {
          const raw = localStorage.getItem(CACHE_KEY);
          if (raw) {
            const { cards: cc, ts } = JSON.parse(raw);
            if (Date.now() - ts < 30 * 60 * 1000 && cc.length > 0) cachedCards = cc;
          }
        } catch(e) {}

        if (cachedCards) {
          setCards(cachedCards.filter(c => ownedData[c.id]));
          setLoading(false);
          // Refresh cache in background
          getDocs(collection(db, "boba_checklist")).then(snap => {
            const fresh = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.imageUrl);
            try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cards: fresh, ts: Date.now() })); } catch(e) {}
          });
          return;
        }

        // 3. No cache -- fetch all, filter to image-only
        const cardSnap = await getDocs(collection(db, "boba_checklist"));
        const allImageCards = cardSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.imageUrl);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cards: allImageCards, ts: Date.now() })); } catch(e) {}
        setCards(allImageCards.filter(c => ownedData[c.id]));
      } catch(e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, [ownedDocId]);

  const ownedCards = cards.filter(c => owned[c.id]);
  const sorted = [...ownedCards].sort((a, b) => {
    if (sortBy === "set") {
      const s = (a.setName||"").localeCompare(b.setName||"");
      return s !== 0 ? s : String(a.cardNum).localeCompare(String(b.cardNum), undefined, { numeric:true });
    }
    if (sortBy === "power") return (parseFloat(b.power)||0) - (parseFloat(a.power)||0);
    if (sortBy === "hero")  return (a.hero||"").localeCompare(b.hero||"");
    if (sortBy === "rarity") return getRarity(b).minPower - getRarity(a).minPower;
    return 0;
  });
  const sets    = [...new Set(ownedCards.map(c => c.setName).filter(Boolean))].sort();
  const weapons = [...new Set(ownedCards.map(c => c.weapon).filter(Boolean))].sort();
  let filtered = sorted;
  if (filterSet)    filtered = filtered.filter(c => c.setName === filterSet);
  if (filterWeapon) filtered = filtered.filter(c => c.weapon  === filterWeapon);
  const totalPages = Math.ceil(filtered.length / CARDS_PER_PAGE);
  const pageCards  = filtered.slice(page * CARDS_PER_PAGE, (page + 1) * CARDS_PER_PAGE);
  const totalPower     = ownedCards.reduce((s, c) => s + (parseFloat(c.power)||0), 0);
  const heroCount      = [...new Set(ownedCards.map(c=>c.hero).filter(Boolean))].length;
  const legendaryCount = ownedCards.filter(c => getRarity(c).label === "Legendary").length;

  useEffect(() => { setPage(0); }, [filterSet, filterWeapon, sortBy]);
  function goPage(next) { setPageDir(next > page ? 1 : -1); setPage(Math.max(0, Math.min(totalPages - 1, next))); }
  function copyLink() {
    const shareUrl = uid
      ? `${window.location.origin}/showcase?uid=${uid}`
      : `${window.location.origin}/showcase`;
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  if (loading) return (
    <div style={{ minHeight:"100vh", background:"#000", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Trebuchet MS',sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>{"\uD83C\uDCCF"}</div>
        <div style={{ color:"#E8317A", fontWeight:700, fontSize:16 }}>Loading Showcase...</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#050505", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", color:"#F0F0F0" }}>
      <div style={{ background:"linear-gradient(180deg,#0d0d0d 0%,#050505 100%)", borderBottom:"1px solid #1a1a1a", padding:"24px 32px" }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:20, marginBottom:20, flexWrap:"wrap" }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:28, fontWeight:900, letterSpacing:-1, lineHeight:1 }}>
                <span style={{ color:"#E8317A" }}>BAZOOKA</span>
                <span style={{ color:"#F0F0F0" }}> Collection</span>
              </div>
              <div style={{ fontSize:11, color:"#444", marginTop:4 }}>Bo Jackson Battle Arena &middot; Bazooka Breaks, LLC</div>
            </div>
            <button onClick={copyLink} style={{ background: copied ? "#0a1a0a" : "#1a1a1a", border:`1px solid ${copied?"#4ade80":"#2a2a2a"}`, color: copied ? "#4ade80" : "#888", borderRadius:10, padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center", gap:6, transition:"all 0.2s" }}>
              {copied ? "\u2705 Copied!" : "\uD83D\uDD17 Share Link"}
            </button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12, marginBottom:20 }}>
            {[
              { label:"Cards Owned",  value:ownedCards.length.toLocaleString(), color:"#4ade80",  icon:"\uD83C\uDCCF" },
              { label:"Heroes",       value:heroCount,                           color:"#7B9CFF",  icon:"\u26A1" },
              { label:"Sets",         value:sets.length,                         color:"#FBBF24",  icon:"\uD83D\uDCE6" },
              { label:"Legendaries",  value:legendaryCount,                      color:"#FBBF24",  icon:"\uD83D\uDC51" },
              { label:"Power Score",  value:Math.round(totalPower).toLocaleString(), color:"#E8317A", icon:"\uD83D\uDCA5" },
            ].map(({ label, value, color, icon }) => (
              <div key={label} style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:10, padding:"12px 14px" }}>
                <div style={{ fontSize:10, color:"#444", marginBottom:4 }}>{icon} {label}</div>
                <div style={{ fontSize:20, fontWeight:900, color }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <select value={filterSet} onChange={e=>{setFilterSet(e.target.value);}} style={{ background:"#111", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              <option value="">All Sets</option>
              {sets.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterWeapon} onChange={e=>setFilterWeapon(e.target.value)} style={{ background:"#111", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              <option value="">All Weapons</option>
              {weapons.map(w => <option key={w} value={w} style={{ color: SHOWCASE_WEAPON_COLORS[w]||"#888" }}>{w}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{ background:"#111", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"5px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              <option value="set">Sort: Set</option>
              <option value="power">{"Sort: Power \u2193"}</option>
              <option value="rarity">Sort: Rarity</option>
              <option value="hero">{"Sort: Hero A\u2192Z"}</option>
            </select>
            <div style={{ flex:1 }}/>
            <span style={{ fontSize:11, color:"#333" }}>{filtered.length} cards &middot; {totalPages} pages</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1200, margin:"0 auto", padding:"32px" }}>
        {ownedCards.length === 0 ? (
          <div style={{ textAlign:"center", padding:"100px 0", color:"#333" }}>
            <div style={{ fontSize:56, marginBottom:20 }}>{"\uD83C\uDCCF"}</div>
            <div style={{ fontSize:18, fontWeight:900, color:"#555" }}>No cards yet</div>
            <div style={{ fontSize:13, marginTop:8, color:"#333" }}>Mark cards as owned in the BoBA Checklist to populate your showcase.</div>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:24 }}>
              <button onClick={()=>goPage(page-1)} disabled={page===0}
                style={{ background:"transparent", border:"1px solid #2a2a2a", color:page===0?"#222":"#888", borderRadius:8, padding:"8px 20px", fontSize:13, fontWeight:700, cursor:page===0?"default":"pointer", fontFamily:"inherit" }}>
                {"\u2190 Prev"}</button>
              <div style={{ display:"flex", gap:4, alignItems:"center" }}>
                {Array.from({ length: Math.min(totalPages, 9) }).map((_, i) => {
                  const pIdx = totalPages <= 9 ? i : Math.max(0, Math.min(totalPages - 9, page - 4)) + i;
                  return (
                    <button key={pIdx} onClick={()=>goPage(pIdx)}
                      style={{ background:page===pIdx?"#E8317A":"transparent", color:page===pIdx?"#fff":"#444", border:`1px solid ${page===pIdx?"#E8317A":"#2a2a2a"}`, borderRadius:6, width:30, height:30, fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                      {pIdx+1}
                    </button>
                  );
                })}
                {totalPages > 9 && <span style={{ color:"#333", fontSize:11 }}>{"\u2026"}{totalPages}</span>}
              </div>
              <button onClick={()=>goPage(page+1)} disabled={page>=totalPages-1}
                style={{ background:"transparent", border:"1px solid #2a2a2a", color:page>=totalPages-1?"#222":"#888", borderRadius:8, padding:"8px 20px", fontSize:13, fontWeight:700, cursor:page>=totalPages-1?"default":"pointer", fontFamily:"inherit" }}>
                {"Next \u2192"}</button>
            </div>

            <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:16, padding:"28px", boxShadow:"0 24px 80px rgba(0,0,0,0.7)" }}>
              {pageCards[0] && (
                <div style={{ fontSize:11, color:"#333", fontWeight:700, letterSpacing:1, textTransform:"uppercase", marginBottom:20 }}>
                  {pageCards[0].setName} -- Page {page+1} of {totalPages}
                </div>
              )}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
                {pageCards.map(c => (
                  <ShowcaseCard key={c.id} c={c} onClick={()=>setSpotlight(c)} />
                ))}
                {Array.from({ length: CARDS_PER_PAGE - pageCards.length }).map((_,i) => (
                  <div key={`empty-${i}`} style={{ aspectRatio:"3/4", border:"1px dashed #111", borderRadius:12, background:"#080808" }}/>
                ))}
              </div>
            </div>

            <div style={{ display:"flex", gap:16, marginTop:16, justifyContent:"center", flexWrap:"wrap" }}>
              {RARITY_TIERS.map(r => (
                <div key={r.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#444" }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:r.color }}/>
                  <span style={{ color:r.color, fontWeight:700 }}>{r.label}</span>
                  <span>({r.minPower === 0 ? "<130" : `${r.minPower}+`} power)</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {spotlight && (
        <div onClick={()=>setSpotlight(null)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.95)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
          <div onClick={e=>e.stopPropagation()} style={{ display:"flex", gap:48, alignItems:"center", maxWidth:900, width:"100%", flexWrap:"wrap" }}>
            <div style={{ width:280, flexShrink:0 }}>
              <ShowcaseCard c={spotlight} onClick={()=>{}} large />
            </div>
            <div style={{ flex:1, minWidth:260 }}>
              <div style={{ fontSize:11, color:"#444", marginBottom:6, letterSpacing:1, textTransform:"uppercase" }}>
                {spotlight.setName} &middot; #{spotlight.cardNum}
              </div>
              <div style={{ fontSize:38, fontWeight:900, color:"#F0F0F0", lineHeight:1.1, marginBottom:12 }}>{spotlight.hero}</div>
              {(() => { const r = getRarity(spotlight); return (
                <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:r.color+"22", border:`1px solid ${r.color}44`, borderRadius:20, padding:"4px 12px", marginBottom:14 }}>
                  <div style={{ width:8, height:8, borderRadius:"50%", background:r.color }}/>
                  <span style={{ fontSize:11, color:r.color, fontWeight:700 }}>{r.label}</span>
                </div>
              ); })()}
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:20 }}>
                {spotlight.weapon    && <span style={{ fontSize:12, color:SHOWCASE_WEAPON_COLORS[spotlight.weapon]||"#888", background:(SHOWCASE_WEAPON_COLORS[spotlight.weapon]||"#888")+"22", borderRadius:6, padding:"3px 10px", fontWeight:700 }}>{spotlight.weapon}</span>}
                {spotlight.treatment && <span style={{ fontSize:12, color:"#AAAAAA", background:"#1a1a1a", borderRadius:6, padding:"3px 10px" }}>{spotlight.treatment}</span>}
                {spotlight.notation  && <span style={{ fontSize:12, color:"#FBBF24", background:"#FBBF2422", borderRadius:6, padding:"3px 10px", fontWeight:700 }}>{spotlight.notation}</span>}
              </div>
              {spotlight.power && (
                <div style={{ marginBottom:20 }}>
                  <div style={{ fontSize:10, color:"#444", marginBottom:4, letterSpacing:1 }}>POWER</div>
                  <div style={{ fontSize:56, fontWeight:900, color:SHOWCASE_WEAPON_COLORS[spotlight.weapon]||"#E8317A", lineHeight:1 }}>{spotlight.power}</div>
                </div>
              )}
              {spotlight.athlete && <div style={{ fontSize:13, color:"#555", marginBottom:6 }}>{"\uD83C\uDFC5 Inspired by"}{spotlight.athlete}</div>}
              {spotlight.variation && <div style={{ fontSize:12, color:"#333", marginBottom:16 }}>{spotlight.variation}</div>}
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button onClick={()=>{ const i=filtered.indexOf(spotlight); if(i>0) setSpotlight(filtered[i-1]); }} disabled={filtered.indexOf(spotlight)===0}
                  style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>{"\u2190 Prev"}</button>
                <button onClick={()=>{ const i=filtered.indexOf(spotlight); if(i<filtered.length-1) setSpotlight(filtered[i+1]); }} disabled={filtered.indexOf(spotlight)===filtered.length-1}
                  style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"8px 14px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>{"Next \u2192"}</button>
                <button onClick={()=>setSpotlight(null)}
                  style={{ background:"transparent", border:"1px solid #2a2a2a", color:"#555", borderRadius:8, padding:"8px 16px", fontSize:12, cursor:"pointer", fontFamily:"inherit", marginLeft:"auto" }}>{"\u2715 Close"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShowcaseCard({ c, onClick, large }) {
  const wc = SHOWCASE_WEAPON_COLORS[c.weapon] || "#444";
  const rarity = getRarity(c);
  const cardRef  = useRef(null);
  const foilRef  = useRef(null);
  const glareRef = useRef(null);
  const animRef  = useRef(null);
  const currentTilt = useRef({ x:0, y:0 });
  const targetTilt  = useRef({ x:0, y:0 });
  const isHovering  = useRef(false);

  function startAnimation() { if (!animRef.current) animRef.current = requestAnimationFrame(animate); }
  function onMouseMove(e) {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX-rect.left)/rect.width, y = (e.clientY-rect.top)/rect.height;
    targetTilt.current = { x:(y-0.5)*28, y:(x-0.5)*-28 };
    if (foilRef.current) { foilRef.current.style.backgroundPosition=`${x*100}% ${y*100}%`; foilRef.current.style.opacity="1"; }
    if (glareRef.current) { glareRef.current.style.background=`radial-gradient(ellipse at ${x*100}% ${y*100}%, rgba(255,255,255,0.22) 0%, transparent 60%)`; glareRef.current.style.opacity="1"; }
    startAnimation();
  }
  function onMouseLeave() {
    isHovering.current=false; targetTilt.current={x:0,y:0};
    if (foilRef.current) foilRef.current.style.opacity="0";
    if (glareRef.current) glareRef.current.style.opacity="0";
    startAnimation();
  }
  function onMouseEnter() { isHovering.current=true; startAnimation(); }
  function animate() {
    const cur=currentTilt.current, tgt=targetTilt.current;
    cur.x+=(tgt.x-cur.x)*0.1; cur.y+=(tgt.y-cur.y)*0.1;
    if (cardRef.current) cardRef.current.style.transform=`perspective(600px) rotateX(${cur.x}deg) rotateY(${cur.y}deg) scale3d(${large?1.02:1.05},${large?1.02:1.05},${large?1.02:1.05})`;
    if (Math.abs(tgt.x-cur.x)>0.05||Math.abs(tgt.y-cur.y)>0.05||isHovering.current) { animRef.current=requestAnimationFrame(animate); }
    else { animRef.current=null; cur.x=0; cur.y=0; if(cardRef.current) cardRef.current.style.transform=""; }
  }

  return (
    <div style={{ aspectRatio:"3/4", cursor:onClick?"pointer":"default" }}
      onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onMouseEnter={onMouseEnter} onClick={onClick}>
      <div ref={cardRef} style={{ width:"100%", height:"100%", borderRadius:large?16:12, overflow:"hidden", position:"relative", willChange:"transform",
        boxShadow:`0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px ${rarity.color}22` }}>
        <img src={c.imageUrl} alt={c.hero} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
        <div ref={foilRef} style={{ position:"absolute", inset:0,
          background:"linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.14) 30%, rgba(255,220,100,0.22) 40%, rgba(100,200,255,0.24) 50%, rgba(200,100,255,0.20) 60%, rgba(255,100,150,0.18) 70%, transparent 80%)",
          backgroundSize:"200% 200%", mixBlendMode:"screen", opacity:0, transition:"opacity 0.2s", pointerEvents:"none" }}/>
        <div ref={glareRef} style={{ position:"absolute", inset:0, mixBlendMode:"overlay", opacity:0, transition:"opacity 0.2s", pointerEvents:"none" }}/>
        <div style={{ position:"absolute", inset:0, borderRadius:large?16:12, boxShadow:`inset 0 0 ${large?30:20}px ${rarity.color}18`, pointerEvents:"none" }}/>
        <div style={{ position:"absolute", bottom:0, left:0, right:0, background:"linear-gradient(transparent, rgba(0,0,0,0.9))", padding:large?"36px 18px 16px":"24px 12px 10px" }}>
          <div style={{ fontSize:large?15:12, fontWeight:900, color:"#F0F0F0", lineHeight:1.2 }}>{c.hero}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:3 }}>
            {c.weapon && <span style={{ fontSize:large?12:10, color:wc, fontWeight:700 }}>{c.weapon}</span>}
            {c.power  && <span style={{ fontSize:large?12:10, color:"#555" }}>&middot; {c.power}</span>}
            <span style={{ fontSize:large?11:9, color:rarity.color, marginLeft:"auto", fontWeight:700 }}>{rarity.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- PUBLIC QUOTE PAGE (no auth required) --------------------
// --- BOBA SHOWCASE (public, no auth required) ----------------
const SHOWCASE_WEAPON_COLORS = { Fire:"#F97316",Ice:"#60A5FA",Steel:"#9CA3AF",Brawl:"#E8317A",Glow:"#4ade80",Hex:"#A855F7",Gum:"#FBBF24",Super:"#F472B6",Alt:"#AAAAAA",Metallic:"#E5E7EB" };
const RARITY_TIERS = [
  { label:"Legendary", minPower:200, color:"#FBBF24" },
  { label:"Elite",     minPower:160, color:"#A855F7" },
  { label:"Rare",      minPower:130, color:"#60A5FA" },
  { label:"Common",    minPower:0,   color:"#9CA3AF" },
];
function getRarity(c) {
  const p = parseFloat(c.power) || 0;
  return RARITY_TIERS.find(r => p >= r.minPower) || RARITY_TIERS[3];
}

let ATHLETE_SPORT = {
  // Baseball
  "Aaron Judge":"MLB","Adrian Beltr\u00E9":"MLB","Adri\u00E1n Beltr\u00E9":"MLB","Brent Rooker":"MLB",
  "Cal Raleigh":"MLB","Carlton Fisk":"MLB","Craig Biggio":"MLB","David Ortiz":"MLB",
  "Dennis Eckersley":"MLB","Edgar Martinez":"MLB","Elly De La Cruz":"MLB","Evan Carter":"MLB",
  "Fernando Tatis Jr.":"MLB","F\u00E9lix Hern\u00E1ndez":"MLB","George Bell":"MLB",
  "Gunnar Henderson":"MLB","Jack Morris":"MLB","Jackson Holliday":"MLB","Jeff Bagwell":"MLB",
  "Jim Rice":"MLB","John Smoltz":"MLB","Jung Hoo Lee":"MLB","Junior Caminero":"MLB",
  "Ken Griffey Jr.":"MLB","Ken Griffey Sr.":"MLB","Ketel Marte":"MLB","Kyle Tucker":"MLB",
  "Manny Machado":"MLB","Mariano Rivera":"MLB","Miguel Cabrera":"MLB","Nick Kurtz":"MLB",
  "Ozzie Albies":"MLB","Pedro Mart\u00EDnez":"MLB","Rafael Devers":"MLB","Reggie Jackson":"MLB",
  "Rick Sutcliffe":"MLB","Robin Yount":"MLB","Roger Clemens":"MLB","Rollie Fingers":"MLB",
  "Roman Anthony":"MLB","Scott Rolen":"MLB","Steve Garvey":"MLB","Tarik Skubal":"MLB",
  "Tim Raines":"MLB","Todd Helton":"MLB","Tom Glavine":"MLB","Vladimir Guerrero Sr.":"MLB",
  "William Contreras":"MLB","Wyatt Langford":"MLB","\u00C9ric Gagn\u00E9":"MLB","James Wood":"MLB",
  "Jac Caglianone":"MLB","Kristian Campbell":"MLB",
  // Football (NFL)
  "AJ Brown":"NFL","Aaron Rodgers":"NFL","Adrian Peterson":"NFL","Ashton Jeanty":"NFL",
  "Bo Jackson":"NFL/MLB","Brock Bowers":"NFL","Caleb Williams":"NFL","Cam Ward":"NFL",
  "Courtland Sutton":"NFL","DK Metcalf":"NFL","Dante Hall":"NFL","Donnie Shell":"NFL",
  "Doug Plank":"NFL","Drake Baldwin":"NFL","Jack Ham":"NFL","Jaxson Dart":"NFL",
  "Jordan Love":"NFL","Julius Peppers":"NFL","Justin Fields":"NFL",
  "Kenneth Walker lll":"NFL","Kenneth Walker III":"NFL","Matthew Golden":"NFL",
  "Pierre Gar\u00E7on":"NFL","Ron Jaworski":"NFL","Santana Moss":"NFL","Steve Spurrier":"NFL/NCAA",
  "TJ Watt":"NFL","Terry McLaurin":"NFL","Travis Hunter":"NFL","Troy Aikman":"NFL",
  "Bijon Robinson":"NFL","Collin Murray- Boyles":"NFL","Collin Murray-Boyles":"NFL",
  // Basketball (NBA)
  "Cade Cunningham":"NBA","Cam Thomas":"NBA","Chauncey Billups":"NBA",
  "Chris Mullin":"NBA","Cooper Flagg":"NBA","DeMarr Derozen":"NBA","DeMar DeRozan":"NBA",
  "Dominique Wilkins":"NBA","Dylan Harper":"NBA","Giannis Antetokounmpo":"NBA",
  "Jalen Brunson":"NBA","Jamal Murray":"NBA","John Starks":"NBA","Julius Erving":"NBA/ABA",
  "Kawhi Leonard":"NBA","Lauri Markkanen":"NBA","Patrick Ewing":"NBA","Paulo Banchero":"NBA",
  "Sam Perkins":"NBA","Stephon Castle":"NBA","Tyrese Haliburton":"NBA","Tyrese Maxey":"NBA",
  "Tyler Herro":"NBA","V.J. Edgecombe":"NBA","Victor Wembanyama":"NBA",
  "Alex Antetokounmpo":"NBA","Kostas Antetokounmpo":"NBA","Thanasis Antetokounmpo":"NBA",
  "Ace Bailey":"NBA",
  // WNBA
  "Alysha Clark":"WNBA","Cheryl Miller":"WNBA","Elena Delle Donne":"WNBA",
  "Paige Bueckers":"WNBA",
  // Hockey (NHL)
  "Alexander Ovechkin":"NHL","Henrik Lundqvist":"NHL","Sidney Crosby":"NHL",
  // Golf
  "Bryson DeChambeau":"PGA","Jordan Spieth":"PGA",
  // Soccer
  "Christie Pearce Rampone":"USWNT","Jozy Altidore":"MLS/USMNT",
  // Tennis
  "Jessica Pegula":"WTA","Paula Badosa":"WTA",
  // Boxing / MMA
  "Muhammed Ali":"Boxing","Muhammad Ali":"Boxing",
  // Celebrity / Other
  "Flavor Flav":"Music","Randy Quaid":"Acting",
  "Jim Boeheim":"NCAA Basketball",
};

function athleteSport(name) {
  if (!name) return null;
  return ATHLETE_SPORT[name.trim()] || ATHLETE_SPORT[name] || null;
}

function BobaCard({ c, isOwned, ownedQty, flippedCard, setFlippedCard, toggleOwned, setOwnedQty, toggleWant, wantList, WEAPON_COLORS }) {
  const wc = WEAPON_COLORS[c.weapon] || "#444";
  const isFlipped = flippedCard === c.id;
  const qty = ownedQty || 0;
  const isWanted = !!(wantList && wantList[c.id]);
  const cardRef = useRef(null);
  const foilRef = useRef(null);
  const glareRef = useRef(null);
  const animRef = useRef(null);
  const currentTilt = useRef({ x:0, y:0 });
  const targetTilt  = useRef({ x:0, y:0 });
  const isHovering  = useRef(false);

  function startAnimation() { if (animRef.current) return; animRef.current = requestAnimationFrame(animate); }
  function onMouseMove(e) {
    if (isFlipped) return;
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    targetTilt.current = { x: (y - 0.5) * 28, y: (x - 0.5) * -28 };
    if (foilRef.current) { foilRef.current.style.backgroundPosition = `${x*100}% ${y*100}%`; foilRef.current.style.opacity = "1"; }
    if (glareRef.current) { glareRef.current.style.background = `radial-gradient(ellipse at ${x*100}% ${y*100}%, rgba(255,255,255,0.22) 0%, transparent 60%)`; glareRef.current.style.opacity = "1"; }
    startAnimation();
  }
  function onMouseLeave() {
    isHovering.current = false; targetTilt.current = { x:0, y:0 };
    if (foilRef.current) foilRef.current.style.opacity = "0";
    if (glareRef.current) glareRef.current.style.opacity = "0";
    startAnimation();
  }
  function onMouseEnter() { isHovering.current = true; startAnimation(); }
  function animate() {
    const cur = currentTilt.current, tgt = targetTilt.current;
    cur.x += (tgt.x - cur.x) * 0.1; cur.y += (tgt.y - cur.y) * 0.1;
    if (cardRef.current && !isFlipped) cardRef.current.style.transform = `perspective(600px) rotateX(${cur.x}deg) rotateY(${cur.y}deg) scale3d(1.04,1.04,1.04)`;
    if (Math.abs(tgt.x-cur.x)>0.05||Math.abs(tgt.y-cur.y)>0.05||isHovering.current) { animRef.current = requestAnimationFrame(animate); }
    else { animRef.current = null; cur.x = 0; cur.y = 0; if(cardRef.current && !isFlipped) cardRef.current.style.transform = ""; }
  }
  function handleClick() {
    if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
    currentTilt.current = { x:0, y:0 }; targetTilt.current = { x:0, y:0 };
    if (foilRef.current) foilRef.current.style.opacity = "0";
    if (glareRef.current) glareRef.current.style.opacity = "0";
    if (cardRef.current) cardRef.current.style.transform = "";
    isHovering.current = false;
    setFlippedCard(!isFlipped ? c.id : null);
  }

  const QtyControls = () => (
    <div style={{ display:"flex", alignItems:"center", gap:4 }} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOwnedQty(c.id, Math.max(0, qty-1))} style={{ background:"#1a1a1a", border:"1px solid #333", color:"#888", borderRadius:5, width:22, height:22, fontSize:13, cursor:"pointer", fontFamily:"inherit", lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>{"\u2212"}</button>
      <span style={{ fontSize:12, fontWeight:700, color:qty>0?"#4ade80":"#555", minWidth:16, textAlign:"center" }}>{qty}</span>
      <button onClick={()=>setOwnedQty(c.id, qty+1)} style={{ background:"#1a1a1a", border:"1px solid #333", color:"#888", borderRadius:5, width:22, height:22, fontSize:13, cursor:"pointer", fontFamily:"inherit", lineHeight:1, display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
    </div>
  );

  if (c.imageUrl) {
    return (
      <div style={{ aspectRatio:"3/4" }} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} onMouseEnter={onMouseEnter}>
        <div ref={cardRef} style={{ position:"relative", width:"100%", height:"100%", transformStyle:"preserve-3d", transition:isFlipped?"transform 0.45s cubic-bezier(0.4,0,0.2,1)":"box-shadow 0.2s ease", transform:isFlipped?"perspective(600px) rotateY(180deg)":undefined, borderRadius:10, cursor:"pointer", willChange:"transform" }} onClick={handleClick}>
          <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", borderRadius:10, overflow:"hidden", border:`2px solid ${isOwned?"#4ade8044":"#1a1a1a"}` }}>
            <img src={c.imageUrl} alt={c.hero} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
            <div ref={foilRef} style={{ position:"absolute", inset:0, borderRadius:10, background:"linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.14) 30%, rgba(255,220,100,0.22) 40%, rgba(100,200,255,0.24) 50%, rgba(200,100,255,0.20) 60%, rgba(255,100,150,0.18) 70%, transparent 80%)", backgroundSize:"200% 200%", mixBlendMode:"screen", opacity:0, transition:"opacity 0.2s ease", pointerEvents:"none" }}/>
            <div ref={glareRef} style={{ position:"absolute", inset:0, borderRadius:10, background:"radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.22) 0%, transparent 60%)", mixBlendMode:"overlay", opacity:0, transition:"opacity 0.2s ease", pointerEvents:"none" }}/>
            <div style={{ position:"absolute", bottom:6, right:8, fontSize:10, color:"#ffffff88", fontWeight:700 }}>click to flip</div>
            {isOwned && <div style={{ position:"absolute", top:6, right:8, fontSize:16 }}>{"\u2705"}</div>}
          </div>
          <div style={{ position:"absolute", inset:0, backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", transform:"rotateY(180deg)", background:"#111111", border:`2px solid ${isOwned?"#4ade8044":"#2a2a2a"}`, borderRadius:10, padding:"12px 14px", display:"flex", flexDirection:"column", justifyContent:"space-between" }}>
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                <span style={{ fontSize:10, color:"#555" }}>#{c.cardNum}</span>
                <QtyControls/>
              </div>
              <div style={{ fontSize:15, fontWeight:900, color:"#F0F0F0", marginBottom:4 }}>{c.hero}</div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:4 }}>
                {c.weapon && <span style={{ fontSize:10, color:wc, background:wc+"22", borderRadius:4, padding:"1px 6px", fontWeight:700 }}>{c.weapon}</span>}
                {c.treatment && <span style={{ fontSize:10, color:"#AAAAAA", background:"#1a1a1a", borderRadius:4, padding:"1px 6px" }}>{c.treatment}</span>}
                {c.notation && <span style={{ fontSize:10, color:"#FBBF24", background:"#FBBF2422", borderRadius:4, padding:"1px 6px", fontWeight:700 }}>{c.notation}</span>}
              </div>
              {c.athlete && <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{"\uD83C\uDFC5 Inspired by"}{c.athlete}{athleteSport(c.athlete) ? <span style={{ color:"#444", marginLeft:4 }}>&middot; {athleteSport(c.athlete)}</span> : null}</div>}
              {c.variation && <div style={{ fontSize:10, color:"#555" }}>{c.variation}</div>}
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
              {c.power && <div style={{ fontSize:22, fontWeight:900, color:wc }}>{c.power}</div>}
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {toggleWant && <button onClick={e=>{e.stopPropagation();toggleWant(c.id);}} style={{ background:isWanted?"#1a0f00":"transparent", border:`1px solid ${isWanted?"#FBBF24":"#333"}`, color:isWanted?"#FBBF24":"#555", borderRadius:5, padding:"2px 8px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{isWanted?"\uD83C\uDFAF Wanted":"+ Want"}</button>}
                <div style={{ fontSize:9, color:"#333" }}>click to flip back</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ background:isOwned?"#0a1a0a":"#111111", border:`1.5px solid ${isOwned?"#4ade8044":"#1a1a1a"}`, borderRadius:10, padding:"10px 12px", display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ fontSize:14, fontWeight:900, color:isOwned?"#4ade80":"#F0F0F0", lineHeight:1.2 }}>{c.hero}</div>
      <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:10, color:"#555", fontWeight:700 }}>#{c.cardNum}</span>
        {c.weapon && <span style={{ fontSize:10, color:wc, background:wc+"22", borderRadius:4, padding:"1px 6px", fontWeight:700 }}>{c.weapon}</span>}
        {c.treatment && <span style={{ fontSize:10, color:"#AAAAAA", background:"#1a1a1a", borderRadius:4, padding:"1px 6px" }}>{c.treatment}</span>}
        {c.notation && <span style={{ fontSize:10, color:"#FBBF24", background:"#FBBF2422", borderRadius:4, padding:"1px 6px", fontWeight:700 }}>{c.notation}</span>}
      </div>
      {c.athlete && <div style={{ fontSize:10, color:"#555" }}>{"\uD83C\uDFC5 Inspired by"}{c.athlete}{athleteSport(c.athlete) ? <span style={{ color:"#444", marginLeft:4 }}>&middot; {athleteSport(c.athlete)}</span> : null}</div>}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginTop:2 }}>
        {c.power ? <div style={{ fontSize:16, fontWeight:900, color:wc }}>{c.power}</div> : <div/>}
        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
          {toggleWant && <button onClick={e=>{e.stopPropagation();toggleWant(c.id);}} style={{ background:isWanted?"#1a0f00":"transparent", border:`1px solid ${isWanted?"#FBBF24":"#333"}`, color:isWanted?"#FBBF24":"#444", borderRadius:5, padding:"1px 6px", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{isWanted?"\uD83C\uDFAF":"+ Want"}</button>}
          <QtyControls/>
        </div>
      </div>
    </div>
  );
}

function BobaChecklist({ userRole, user, onScanUpdate, onChecklistUpdated }) {
  const ownedDocId = user?.uid || "owned";
  const wantsDocId = user?.uid ? `wants_${user.uid}` : "wants";
  const [cards,        setCards]        = useState([]);
  const [imports,      setImports]      = useState([]); // list of {id, setName, filename, importedAt, cardIds}
  const [owned,        setOwned]        = useState({});
  const [loading,      setLoading]      = useState(true);
  const [setsCollapsed, setSetsCollapsed] = useState(false);
  const [importing,    setImporting]    = useState(false);
  const [importProgress, setImportProgress] = useState("");
  const [pendingFile,  setPendingFile]  = useState(null); // file waiting for set name
  const [setNameInput, setSetNameInput] = useState("");
  const [newSetMode,   setNewSetMode]   = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterTreat,  setFilterTreat]  = useState("");
  const [filterWeapon, setFilterWeapon] = useState("");
  const [filterNote,   setFilterNote]   = useState("");
  const [filterSet,    setFilterSet]    = useState("");
  const [filterOwned,    setFilterOwned]    = useState("all");
  const [renamingId,   setRenamingId]   = useState(null);
  const [renameVal,    setRenameVal]    = useState("");
  const [scanPdf,      setScanPdf]      = useState(null);
  const [scanProgress, setScanProgress] = useState(null);
  const _setScanProgress = (v) => { setScanProgress(v); if(onScanUpdate) onScanUpdate(v ? { type:"pdf", ...v } : null); };
  const [imgScanProgress, setImgScanProgress] = useState(null);
  const [imgImportModal, setImgImportModal] = useState(null); // {files} waiting for set selection
  const [imgImportSet, setImgImportSet] = useState("");
  const _setImgScanProgress = (v) => { setImgScanProgress(v); if(onScanUpdate) onScanUpdate(v ? { type:"images", ...v } : null); };
  const [scanConfig,   setScanConfig]   = useState(null); // { file, setName, treatment, weapon }
  const [pendingScan,  setPendingScan]  = useState(null); // file waiting for config
  const [scanPaused,   setScanPaused]   = useState(false);
  const scanPausedRef = useRef(false);
  const [flippedCard,  setFlippedCard]  = useState(null);
  const [viewMode,       setViewMode]       = useState("cards");
  const [expandedHero,   setExpandedHero]   = useState(null);
  const [expandedTreat,  setExpandedTreat]  = useState(null);
  const [rainbowFilter,    setRainbowFilter]    = useState("all");
  const [rainbowSetFilter, setRainbowSetFilter] = useState("");
  const [treatOwnedFilter, setTreatOwnedFilter] = useState("all"); // all | owned | missing
  const [sortBy,           setSortBy]           = useState("cardNum");
  const [weaponSetFilter,  setWeaponSetFilter]  = useState("");
  const [page,           setPage]           = useState(1);
  const sentinelRef = useRef(null);
  // Deck builder state
  const [deckCards,      setDeckCards]      = useState([]); // array of card ids in current deck
  const [deckName,       setDeckName]       = useState("My Deck");
  const [savedDecks,     setSavedDecks]     = useState([]);
  const [deckSearch,     setDeckSearch]     = useState("");
  const [deckFilterWeap, setDeckFilterWeap] = useState("");
  const [deckFilterHero, setDeckFilterHero] = useState("");
  const [deckSaving,     setDeckSaving]     = useState(false);
  const [deckLoadId,     setDeckLoadId]     = useState(null);
  const [deckOwnedOnly,  setDeckOwnedOnly]  = useState(false);
  const [deckSlotSort,   setDeckSlotSort]   = useState("added");
  const [deckType,       setDeckType]       = useState("none");
  const [deckFilterPower, setDeckFilterPower] = useState("");
  const [deckFilterPowers, setDeckFilterPowers] = useState(new Set()); // multi-select powers
  const [deckFilterSet,    setDeckFilterSet]    = useState("");
  const [deckFilterTreat,  setDeckFilterTreat]  = useState("");
  const [dbsImporting,   setDbsImporting]   = useState(false);
  const [dbsStatus,      setDbsStatus]      = useState(null); // {msg, ok}
  const DBS_CAP = 1000; // none | spec | apex
  // Playbook state
  const [pbCards,        setPbCards]        = useState([]); // {id, type: "play"|"bonus"}
  const [pbName,         setPbName]         = useState("My Playbook");
  const [savedPlaybooks, setSavedPlaybooks] = useState([]);
  const [pbLoadId,       setPbLoadId]       = useState(null);
  const [pbSearch,       setPbSearch]       = useState("");
  const [pbOwnedOnly,    setPbOwnedOnly]    = useState(false);
  const [pbSaving,       setPbSaving]       = useState(false);
  const [pbSort,         setPbSort]         = useState("name");
  const [pbFilterSet,    setPbFilterSet]    = useState("");
  const [pbTreatFilter,  setPbTreatFilter]  = useState(""); // name | dbs_asc | dbs_desc
  const PLAY_LIMIT = 30;
  const DECK_SIZE = 60;
  const PAGE_SIZE = 100;
  const isAdmin = ["Admin"].includes(userRole?.role);

  useEffect(() => {
    // Cards are static after import -- use localStorage cache for instant load
    const CACHE_KEY = "boba_checklist_cache_v2";
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const { cards: cachedCards, ts } = JSON.parse(cached);
        if (Date.now() - ts < 10 * 60 * 1000 && cachedCards.length > 0) {
          setCards(cachedCards);
          setLoading(false);
        }
      }
    } catch(e) {}
    // Always fetch fresh in background
    getDocs(collection(db, "boba_checklist")).then(snap => {
      const sorted = snap.docs.map(d=>d.data()).sort((a,b)=>{
        const n1=parseFloat(a.cardNum), n2=parseFloat(b.cardNum);
        if(!isNaN(n1)&&!isNaN(n2)) return n1-n2;
        return String(a.cardNum).localeCompare(String(b.cardNum));
      });
      setCards(sorted);
      setLoading(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ cards:sorted, ts:Date.now() })); } catch(e) {}
    });
    // Owned + imports stay realtime
    const u2 = onSnapshot(doc(db,"boba_owned",ownedDocId), snap => {
      if (snap.exists()) setOwned(snap.data()); else setOwned({});
    });
    const uWants = onSnapshot(doc(db,"boba_owned",wantsDocId), snap => { if(snap.exists()) setWantList(snap.data()); else setWantList({}); });
    const u3 = onSnapshot(collection(db,"boba_imports"), snap => {
      setImports(snap.docs.map(d=>d.data()).sort((a,b)=>b.importedAt?.localeCompare(a.importedAt)));
    });
    const u4 = onSnapshot(collection(db,"boba_decks"), snap => {
      const uid = user?.uid || "shared";
      setSavedDecks(snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.userId===uid).sort((a,b)=>b.savedAt?.localeCompare(a.savedAt)));
    });
    const u5 = onSnapshot(collection(db,"boba_playbooks"), snap => {
      const uid = user?.uid || "shared";
      setSavedPlaybooks(snap.docs.map(d=>({id:d.id,...d.data()})).filter(d=>d.userId===uid).sort((a,b)=>b.savedAt?.localeCompare(a.savedAt)));
    });
    return ()=>{ u2(); u3(); u4(); u5(); uWants(); };
  }, []);

  // Infinite scroll -- load more when user scrolls near bottom
  useEffect(() => {
    if (viewMode !== "cards") return;
    function onScroll() {
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollHeight - scrollTop - clientHeight < 400) {
        setPage(p => p + 1);
      }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [viewMode]);

  async function saveDeck() {
    if (!deckName.trim() || deckCards.length === 0) return;
    setDeckSaving(true);
    const id = deckLoadId || `deck_${Date.now()}`;
    await setDoc(doc(db,"boba_decks",id), {
      id, userId: user?.uid||"shared", name: deckName.trim(),
      cardIds: deckCards, cardCount: deckCards.length,
      deckType, savedAt: new Date().toISOString(),
    }, { merge:true });
    setDeckLoadId(id);
    setDeckSaving(false);
  }

  async function deleteDeck(id) {
    if (!window.confirm("Delete this deck?")) return;
    await deleteDoc(doc(db,"boba_decks",id));
    if (deckLoadId === id) { setDeckLoadId(null); setDeckName("My Deck"); setDeckCards([]); }
  }

  function loadDeck(deck) {
    setDeckLoadId(deck.id);
    setDeckName(deck.name);
    setDeckCards(deck.cardIds||[]);
    setDeckType(deck.deckType||"none");
    setDeckSearch(""); setDeckFilterWeap(""); setDeckFilterHero(""); setDeckFilterPower("");
  }

  function newDeck() {
    setDeckLoadId(null);
    setDeckName("My Deck");
    setDeckCards([]);
    setDeckSearch(""); setDeckFilterWeap(""); setDeckFilterHero(""); setDeckFilterPower("");
  }

  async function savePlaybook() {
    if (!pbName.trim() || pbCards.length === 0) return;
    setPbSaving(true);
    const id = pbLoadId || `pb_${Date.now()}`;
    const plays = pbCards.filter(e=>e.type==="play").length;
    const bonus = pbCards.filter(e=>e.type==="bonus").length;
    await setDoc(doc(db,"boba_playbooks",id), {
      id, userId: user?.uid||"shared", name: pbName.trim(),
      entries: pbCards, playCount: plays, bonusCount: bonus,
      savedAt: new Date().toISOString(),
    }, { merge:true });
    setPbLoadId(id);
    setPbSaving(false);
  }

  async function deletePlaybook(id) {
    if (!window.confirm("Delete this playbook?")) return;
    await deleteDoc(doc(db,"boba_playbooks",id));
    if (pbLoadId === id) { setPbLoadId(null); setPbName("My Playbook"); setPbCards([]); }
  }

  function loadPlaybook(pb) {
    setPbLoadId(pb.id);
    setPbName(pb.name);
    setPbCards(pb.entries||[]);
    setPbSearch(""); setPbTreatFilter(""); setPbFilterSet("");
  }

  function newPlaybook() {
    setPbLoadId(null);
    setPbName("My Playbook");
    setPbCards([]);
    setPbSearch(""); setPbTreatFilter(""); setPbFilterSet("");
  }

  async function scanPdfForCards(file, setName, treatment, weapon) {
    setScanPdf(file.name);
    _setScanProgress({ current:0, total:0, status:"Loading PDF..." });
    scanPausedRef.current = false;
    setScanPaused(false);

    // Load pdf.js
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const total = pdf.numPages;
    _setScanProgress({ current:0, total, status:"Starting scan..." });

    const BATCH_SIZE = 5; // process 5 pages at a time
    let completed = 0;

    function normalize(s) { return (s||"").toLowerCase().replace(/[^a-z0-9\s]/g,"").trim(); }
    function fuzzyMatch(a, b) {
      const na = normalize(a), nb = normalize(b);
      if (na === nb) return true;
      if (na.includes(nb) || nb.includes(na)) return true;
      const wa = na.split(/\s+/), wb = nb.split(/\s+/);
      const shared = wa.filter(w => wb.includes(w)).length;
      return shared > 0 && shared / Math.max(wa.length, wb.length) >= 0.5;
    }

    async function processPage(pageNum) {
      while (scanPausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }

      // Render small version for Claude Vision
      const page = await pdf.getPage(pageNum);
      const rawViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(0.8, 800 / rawViewport.width);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const base64 = canvas.toDataURL("image/jpeg", 0.5).split(",")[1];

      // Send to Claude Vision
      let identified = null;
      try {
        const resp = await fetch("/api/scan-card", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: base64, treatment, weapon }),
        });
        const data = await resp.json();
        identified = data.identified;
      } catch(e) { console.error(`Page ${pageNum} error:`, e); }

      if (!identified?.hero && !identified?.cardNum) return;

      const heroName = identified.hero ? identified.hero.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim() : null;

      // 1. Card number + set name (most reliable)
      // Normalize card nums -- strip spaces/dashes for comparison: "ALT-4" == "ALT4" == "ALT 4"
      function normalizeCardNum(n) { return String(n||"").toLowerCase().replace(/[\s\-]/g,""); }
      const identifiedNum = normalizeCardNum(identified.cardNum);

      let match = identifiedNum
        ? cards.find(c =>
            normalizeCardNum(c.cardNum) === identifiedNum &&
            (!setName || c.setName === setName)
          )
        : null;

      // 2. Card number only (cross-set fallback)
      if (!match && identifiedNum) {
        match = cards.find(c => normalizeCardNum(c.cardNum) === identifiedNum);
      }

      // 3. Hero + treatment + weapon (fuzzy)
      if (!match && heroName) {
        match = cards.find(c =>
          fuzzyMatch(c.hero, heroName) &&
          (!treatment || c.treatment?.toLowerCase() === treatment.toLowerCase()) &&
          (!weapon   || c.weapon?.toLowerCase()   === weapon.toLowerCase()) &&
          (!setName  || c.setName === setName)
        ) || cards.find(c =>
          fuzzyMatch(c.hero, heroName) &&
          (!treatment || c.treatment?.toLowerCase() === treatment.toLowerCase()) &&
          (!weapon   || c.weapon?.toLowerCase()   === weapon.toLowerCase())
        );
      }

      // 4. Hero + weapon only
      if (!match && heroName) {
        match = cards.find(c =>
          fuzzyMatch(c.hero, heroName) &&
          (!weapon || c.weapon?.toLowerCase() === weapon.toLowerCase())
        );
      }

      if (!match) { console.log(`Page ${pageNum}: no match -- cardNum="${identified.cardNum}" hero="${identified.hero}"`); return; }
      console.log(`Page ${pageNum}: matched ${match.hero} #${match.cardNum}`);

      // Render high quality version for storage -- 3.5x scale, PNG lossless
      const hiCanvas = document.createElement("canvas");
      const hiViewport = page.getViewport({ scale: 3.5 });
      hiCanvas.width = hiViewport.width;
      hiCanvas.height = hiViewport.height;
      const hiCtx = hiCanvas.getContext("2d");
      hiCtx.imageSmoothingEnabled = true;
      hiCtx.imageSmoothingQuality = "high";
      await page.render({ canvasContext: hiCtx, viewport: hiViewport }).promise;
      const imgBlob = await new Promise(res => hiCanvas.toBlob(res, "image/png"));
      const storageRef = ref(storage, `boba_cards/${match.id}.png`);
      await uploadBytes(storageRef, imgBlob);
      await uploadBytes(storageRef, imgBlob);
      const imageUrl = await getDownloadURL(storageRef);
      await setDoc(doc(db,"boba_checklist",match.id), { imageUrl }, { merge:true });
    }

    for (let i = 1; i <= total; i += BATCH_SIZE) {
      while (scanPausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }
      const batch = [];
      for (let j = i; j < Math.min(i + BATCH_SIZE, total + 1); j++) {
        batch.push(processPage(j));
      }
      await Promise.all(batch);
      completed = Math.min(i + BATCH_SIZE - 1, total);
      _setScanProgress({ current:completed, total, status:`Scanning pages ${i}-${Math.min(i+BATCH_SIZE-1,total)} of ${total}...` });
    }

    __setScanProgress({ current:total, total, status:"\u2705 Scan complete!" });
    setTimeout(() => { setScanPdf(null); _setScanProgress(null); }, 3000);
  }

  async function scanImagesForCards(files, setName) {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;
    try {
    _setImgScanProgress({ current:0, total:fileList.length, status:"Starting image scan..." });

    let matched = 0, skipped = 0;

    // -- Matching helpers --------------------------------------
    function normNum(n) { return String(n||"").replace(/[\s\-]/g,"").toLowerCase(); }

    // Strict hero match: first word must agree, full strings must be close
    function heroMatch(cardHero, identified) {
      if (!cardHero || !identified) return false;
      const a = cardHero.toLowerCase().trim();
      const b = identified.toLowerCase().trim();
      if (a === b) return true;
      // First word must match exactly
      if (a.split(" ")[0] !== b.split(" ")[0]) return false;
      // And overall similarity must be high (one is substring of other)
      return a.includes(b) || b.includes(a);
    }

    // Extract set-order number from filename e.g. "setorder61" - "61"
    function extractSetOrder(filename) {
      const m = filename.match(/setorder(\d+)/i) || filename.match(/[-_](\d+)\./);
      return m ? m[1] : null;
    }

    // Try filename-based matching first (most reliable, no Vision needed)
    function matchByFilename(filename, setNm) {
      const order = extractSetOrder(filename);
      if (!order) return null;
      const idx = parseInt(order) - 1; // setorder is 1-based
      const setCards = setNm
        ? cards.filter(c => c.setName === setNm)
        : cards;
      // Sort by card number numerically to get set order
      const sorted = [...setCards].sort((a, b) => {
        const na = parseInt(String(a.cardNum||"").replace(/[^0-9]/g,""))||0;
        const nb = parseInt(String(b.cardNum||"").replace(/[^0-9]/g,""))||0;
        return na - nb;
      });
      return sorted[idx] || null;
    }

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      _setImgScanProgress({ current:i, total:fileList.length, status:`Scanning ${file.name} (${i+1}/${fileList.length})...` });

      try {
        // -- Step 1: Try filename matching first (free, instant, reliable) --
        let match = matchByFilename(file.name, setName);

        // -- Step 2: Vision API if filename didn't work --
        if (!match) {
          const base64 = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const img = new Image();
              img.onload = () => {
                const MAX = 1200;
                const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width  = Math.round(img.width  * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                res(canvas.toDataURL("image/jpeg", 0.9).split(",")[1]);
              };
              img.onerror = rej;
              img.src = ev.target.result;
            };
            reader.onerror = rej;
            reader.readAsDataURL(file);
          });

          const resp = await fetch("/api/scan-card", {
            method:"POST",
            headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ imageBase64: base64, mediaType:"image/jpeg", setName }),
          });
          const data = await resp.json();

          if (data.cardNum || data.hero) {
            const identifiedNum = normNum(data.cardNum);
            const heroName  = (data.hero||"").trim().toLowerCase();
            const weapon    = (data.weapon||"").trim().toLowerCase();
            const treatment = (data.treatment||"").trim().toLowerCase();
            const setNm     = setName||"";

            // 1. Card# + set + hero
            if (!match && identifiedNum && heroName) {
              match = cards.find(c =>
                normNum(c.cardNum) === identifiedNum &&
                heroMatch(c.hero, heroName) &&
                (!setNm || c.setName === setNm)
              );
            }
            // 2. Card# + hero (cross-set)
            if (!match && identifiedNum && heroName) {
              match = cards.find(c =>
                normNum(c.cardNum) === identifiedNum &&
                heroMatch(c.hero, heroName)
              );
            }
            // 3. Card# alone (only if set matches)
            if (!match && identifiedNum && setNm) {
              match = cards.find(c =>
                normNum(c.cardNum) === identifiedNum &&
                c.setName === setNm
              );
            }
            // 4. Hero + treatment + weapon (all three, strict)
            if (!match && heroName && treatment && weapon) {
              const cands = cards.filter(c =>
                heroMatch(c.hero, heroName) &&
                c.treatment?.toLowerCase() === treatment &&
                c.weapon?.toLowerCase() === weapon &&
                (!setNm || c.setName === setNm)
              );
              if (cands.length === 1) match = cands[0];
              // If multiple, pick by power
              else if (cands.length > 1 && data.power) {
                match = cands.find(c => String(c.power||"") === String(data.power||"")) || cands[0];
              }
            }
            // 5. Hero + weapon (strict hero matching)
            if (!match && heroName && weapon) {
              const cands = cards.filter(c =>
                heroMatch(c.hero, heroName) &&
                c.weapon?.toLowerCase() === weapon &&
                (!setNm || c.setName === setNm)
              );
              if (cands.length === 1) match = cands[0];
              else if (cands.length > 1 && data.power) {
                match = cands.find(c => String(c.power||"") === String(data.power||""));
              }
            }
          }
        }

        if (!match) { skipped++; console.log(`No match: ${file.name}`); _setImgScanProgress(p=>({...p, status:`No match for ${file.name} - skipping`})); continue; }

        // Upload original file (not re-compressed)
        const imgBlob = new Blob([await file.arrayBuffer()], { type: file.type || "image/webp" });
        const ext = file.name.split(".").pop() || "webp";
        const storageRef = ref(storage, `boba_cards/${match.id}.${ext}`);
        await uploadBytes(storageRef, imgBlob);
        const imageUrl = await getDownloadURL(storageRef);
        await setDoc(doc(db,"boba_checklist",match.id), { imageUrl }, { merge:true });
        matched++;
        console.log(`\u2705 ${file.name} \u2192 ${match.hero} #${match.cardNum} (${match.setName})`);

      } catch(e) {
        console.error(`Error scanning ${file.name}:`, e);
        _setImgScanProgress(p=>({...p, status:`Error on ${file.name}: ${e.message}`}));
        skipped++;
      }
    }

    _setImgScanProgress({ current:fileList.length, total:fileList.length, status:`\u2705 Done! Matched ${matched}, skipped ${skipped}` });
    setTimeout(() => _setImgScanProgress(null), 5000);
    } catch(err) { _setImgScanProgress({ current:0, total:0, status:"Error: " + err.message }); console.error("Import error:", err); }
    try { localStorage.removeItem("boba_checklist_cache_v2"); } catch(e) {}
  }  // - closes scanImagesForCards

  const [photoScan,    setPhotoScan]    = useState(null); // {status, card}
  const [scanModal,    setScanModal]    = useState(false); // full-screen scan modal open
  const [scanSession,  setScanSession]  = useState([]);    // [{card, qty, addedAt}]
  const [scanQty,      setScanQty]      = useState(1);     // qty selector for pending match
  const scanInputRef = useRef(null);
  const treatmentVisuals = useRef({}); // { treatmentName: ["hint1","hint2",...] }

  // Load treatment visual fingerprints once
  useEffect(() => {
    getDocs(collection(db,"treatment_visuals")).then(snap => {
      const map = {};
      snap.forEach(d => { map[d.id] = d.data().hints || []; });
      treatmentVisuals.current = map;
    }).catch(()=>{});
  }, []);

  async function scanCardPhoto(file) {
    setPhotoScan({ status:"scanning", card:null });
    try {
      // Resize to max 1200px for fast API response
      const base64 = await new Promise((res, rej) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const MAX = 1200;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width  = Math.round(img.width  * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          res(canvas.toDataURL("image/jpeg", 0.92).split(",")[1]);
        };
        img.onerror = rej;
        img.src = url;
      });

      const resp = await fetch("/api/scan-card", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType: "image/jpeg" }),
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(()=>({ error: `HTTP ${resp.status}` }));
        const msg = errData.details ? `${errData.error}: ${errData.details.slice(0,120)}` : errData.error || `HTTP ${resp.status}`;
        console.error("scan-card API error:", resp.status, errData);
        setPhotoScan({ status:"error", message: msg });
        return;
      }

      const data = await resp.json();
      if (data.error) {
        console.error("scan-card returned error:", data.error);
        setPhotoScan({ status:"error", message: data.error });
        return;
      }

      if (!data.cardNum && !data.hero) {
        setPhotoScan({ status:"nomatch", card:null });
        setTimeout(() => setPhotoScan(null), 4000);
        return;
      }

      // Match against checklist -- prioritize card number, then strict hero+weapon
      const identifiedNum = (data.cardNum||"").replace(/[\s\-]/g,"").toLowerCase();
      const heroName  = (data.hero||"").trim().toLowerCase();
      const weapon    = (data.weapon||"").trim().toLowerCase();
      const treatment = (data.treatment||"").trim().toLowerCase();

      function normNum(n) { return String(n||"").replace(/[\s\-]/g,"").toLowerCase(); }
      function heroMatch(cardHero, id) {
        if (!cardHero || !id) return false;
        const a = cardHero.toLowerCase(), b = id.toLowerCase();
        if (a === b) return true;
        if (a.includes(b) || b.includes(a)) return true;
        const aF = a.split(" ")[0], bF = b.split(" ")[0];
        return aF === bF && aF.length > 2;
      }

      // Visual tiebreaker -- score how well a treatment's fingerprint matches detected hints
      function visualScore(treatment, detectedHints) {
        if (!detectedHints || !treatment) return 0;
        const fingerprints = treatmentVisuals.current[treatment] || [];
        if (fingerprints.length === 0) return 0;
        const detected = detectedHints.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
        let score = 0;
        fingerprints.forEach(hint => {
          const words = hint.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3);
          words.forEach(w => { if (detected.includes(w)) score++; });
        });
        return score / Math.max(detected.length, 1);
      }

      const visualHints = data.visualHints || null;

      let match = null;
      // 1. Card number + hero + weapon (all three agree -- most reliable)
      if (identifiedNum && heroName) {
        match = cards.find(c =>
          normNum(c.cardNum)===identifiedNum &&
          heroMatch(c.hero, heroName) &&
          (!weapon || c.weapon?.toLowerCase()===weapon)
        );
      }
      // 2. Card number + hero (no weapon requirement)
      if (!match && identifiedNum && heroName) {
        match = cards.find(c => normNum(c.cardNum)===identifiedNum && heroMatch(c.hero, heroName));
      }
      // 3. Hero + treatment + weapon (all three agree)
      if (!match && heroName && treatment && weapon) {
        match = cards.find(c =>
          heroMatch(c.hero, heroName) &&
          c.treatment?.toLowerCase()===treatment &&
          c.weapon?.toLowerCase()===weapon
        );
      }
      // 4. Hero + weapon -- use visual score to break ties between treatments
      if (!match && heroName && weapon) {
        const cands = cards.filter(c => heroMatch(c.hero, heroName) && c.weapon?.toLowerCase()===weapon);
        if (cands.length === 1) {
          match = cands[0];
        } else if (cands.length > 1) {
          // Try exact hero name first
          const exact = cands.find(c => c.hero.toLowerCase()===heroName);
          if (exact) {
            match = exact;
          } else if (visualHints) {
            // Score each candidate's treatment against visual hints
            const scored = cands.map(c => ({
              card: c,
              score: visualScore(c.treatment, visualHints)
            })).sort((a,b) => b.score - a.score);
            // Only pick visually if there's a clear winner (score > 0)
            if (scored[0].score > 0 && scored[0].score > scored[1]?.score) {
              match = scored[0].card;
            }
            // Otherwise leave as null -- show no-match so user retakes
          }
        }
      }
      // 5. Card number alone -- only if hero also matches loosely (prevent wrong-number matches)
      if (!match && identifiedNum) {
        const byNum = cards.find(c => normNum(c.cardNum)===identifiedNum);
        if (byNum && (!heroName || heroMatch(byNum.hero, heroName))) match = byNum;
      }
      // 6. Hero only -- only if exactly one card matches
      if (!match && heroName) {
        const cands = cards.filter(c => heroMatch(c.hero, heroName));
        if (cands.length === 1) match = cands[0];
      }

      if (!match) {
        setPhotoScan({ status:"nomatch", card:null, identified: data });
        if (!scanModal) setTimeout(() => setPhotoScan(null), 5000);
        return;
      }

      // In modal mode -- show match for user to confirm qty before adding
      // In header mode -- auto-add 1 and show toast
      if (scanModal) {
        setScanQty(1);
        // Pass detected data too so user can see what Vision read
        setPhotoScan({ status:"matched", card:match, detected: data });
      } else {
        const next = { ...owned, [match.id]: (owned[match.id]||0) + 1 };
        setOwned(next);
        await setDoc(doc(db,"boba_owned",ownedDocId), next);
        setPhotoScan({ status:"matched", card:match });
        setTimeout(() => setPhotoScan(null), 4000);
      }

    } catch(e) {
      console.error(e);
      setPhotoScan({ status:"error", card:null });
      if (!scanModal) setTimeout(() => setPhotoScan(null), 4000);
    }
  }

  async function confirmScanAdd(qty) {
    if (!photoScan?.card) return;
    const match = photoScan.card;
    const q = parseInt(qty) || 1;
    const next = { ...owned, [match.id]: (owned[match.id]||0) + q };
    setOwned(next);
    await setDoc(doc(db,"boba_owned",ownedDocId), next);
    setScanSession(prev => [{ card:match, qty:q, addedAt:new Date().toISOString() }, ...prev]);

    // Save visual fingerprint for this treatment -- builds accuracy over time
    const hints = photoScan.detected?.visualHints;
    if (hints && match.treatment) {
      const treatKey = match.treatment;
      const existing = treatmentVisuals.current[treatKey] || [];
      // Add new hints, keep last 20 confirmed scans per treatment
      const updated = [...existing, hints].slice(-20);
      treatmentVisuals.current[treatKey] = updated;
      // Save to Firestore in background
      setDoc(doc(db,"treatment_visuals",treatKey), {
        hints: updated,
        treatment: treatKey,
        updatedAt: new Date().toISOString(),
        sampleCount: updated.length,
      }, { merge: true }).catch(()=>{});
    }

    setPhotoScan(null);
    setScanQty(1);
    // Mobile: user must tap the scan area again -- no programmatic click needed
  }

  async function toggleWant(cardId) {
    const next = { ...wantList };
    if (next[cardId]) delete next[cardId];
    else next[cardId] = true;
    setWantList(next);
    await setDoc(doc(db,"boba_owned",wantsDocId), next);
  }

  function exportWantList() {
    const wants = cards.filter(c => wantList[c.id]);
    if (!wants.length) { alert("No cards on your want list!"); return; }
    const rows = [["card_num","hero","treatment","weapon","notation","power"]];
    wants.forEach(c => rows.push([c.cardNum, c.hero, c.treatment||"", c.weapon||"", c.notation||"", c.power||""]));
    const csv = rows.map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="boba-want-list.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function exportHaveList() {
    const haves = cards.filter(c => (owned[c.id]||0) > 1);
    if (!haves.length) { alert("No duplicate cards to trade!"); return; }
    const rows = [["card_num","hero","treatment","weapon","notation","quantity","extras"]];
    haves.forEach(c => rows.push([c.cardNum, c.hero, c.treatment||"", c.weapon||"", c.notation||"", owned[c.id], (owned[c.id]||0)-1]));
    const csv = rows.map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="boba-have-list.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function setOwnedQty(cardId, qty) {
    const next = { ...owned };
    if (qty <= 0) delete next[cardId];
    else next[cardId] = qty;
    setOwned(next);
    await setDoc(doc(db,"boba_owned",ownedDocId), next);
  }

  // Keep toggleOwned as convenience (0-1, 1-0)
  async function toggleOwned(cardId) {
    await setOwnedQty(cardId, owned[cardId] ? 0 : 1);
  }

  // Export collection to CSV
  function exportCollection() {
    const ownedCards = cards.filter(c => owned[c.id]);
    if (!ownedCards.length) { alert("No cards owned yet!"); return; }
    const rows = [["card_num","hero","treatment","weapon","notation","quantity"]];
    ownedCards.forEach(c => {
      rows.push([c.cardNum, c.hero, c.treatment, c.weapon, c.notation||"", owned[c.id]||1]);
    });
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="boba-collection.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadTemplate() {
    const csv = [
      ["card_num","hero","treatment","weapon","notation","quantity"],
      ["RAD-1","Bojax","80's Rad Battlefoil","Hex","",1],
      ["1","Maverick","Base Set","Fire","",2],
    ].map(r => r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="boba-collection-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Import collection from CSV
  const [collectionImportResult, setCollectionImportResult] = useState(null);
  const [wantList, setWantList] = useState({}); // { cardId: true }
  async function importCollectionCsv(file) {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    const headers = lines[0].split(",").map(h => h.replace(/"/g,"").trim().toLowerCase());
    const idx = k => headers.indexOf(k);
    const cardNumIdx = idx("card_num"), heroIdx = idx("hero"),
          treatIdx = idx("treatment"), weaponIdx = idx("weapon"),
          noteIdx = idx("notation"), qtyIdx = idx("quantity");

    if (cardNumIdx === -1) { alert("CSV must have a 'card_num' column"); return; }

    function normalize(s) { return (s||"").toLowerCase().replace(/[^a-z0-9\s]/g,"").trim(); }
    function fuzzy(a,b) {
      const na=normalize(a), nb=normalize(b);
      if(na===nb) return true;
      if(na.includes(nb)||nb.includes(na)) return true;
      const wa=na.split(/\s+/), wb=nb.split(/\s+/);
      const shared=wa.filter(w=>wb.includes(w)).length;
      return shared>0 && shared/Math.max(wa.length,wb.length)>=0.5;
    }

    const next = { ...owned };
    let matched=0, skipped=0, skippedRows=[];

    for (let i=1; i<lines.length; i++) {
      const cols = lines[i].split(",").map(c => c.replace(/^"|"$/g,"").trim());
      const cardNum = cols[cardNumIdx]||"";
      const hero = cols[heroIdx]||"";
      const treatment = treatIdx>=0 ? cols[treatIdx]||"" : "";
      const weapon = weaponIdx>=0 ? cols[weaponIdx]||"" : "";
      const notation = noteIdx>=0 ? cols[noteIdx]||"" : "";
      const qty = Math.max(1, parseInt(cols[qtyIdx])||1);

      if (!cardNum) { skipped++; continue; }

      // Match by card_num first, then narrow by hero/treatment/weapon
      let match = cards.find(c =>
        String(c.cardNum).toLowerCase() === String(cardNum).toLowerCase() &&
        (!hero || fuzzy(c.hero, hero)) &&
        (!treatment || c.treatment?.toLowerCase() === treatment.toLowerCase()) &&
        (!weapon || c.weapon?.toLowerCase() === weapon.toLowerCase())
      );

      // Fallback: card_num only
      if (!match) match = cards.find(c =>
        String(c.cardNum).toLowerCase() === String(cardNum).toLowerCase()
      );

      if (match) {
        next[match.id] = qty;
        matched++;
      } else {
        skipped++;
        skippedRows.push(`Row ${i+1}: card_num="${cardNum}" hero="${hero}"`);
      }
    }

    setOwned(next);
    await setDoc(doc(db,"boba_owned",ownedDocId), next);
    setCollectionImportResult({ matched, skipped, skippedRows });
  }

  async function importDbsCsv(file) {
    if (!file) return;
    setDbsImporting(true);
    setDbsStatus({ msg:"Reading CSV...", ok:null });
    try {
      const text = await file.text();

      // RFC 4180 compliant CSV parser -- handles quoted fields with embedded newlines/commas
      function parseCSV(str) {
        const rows = [];
        let row = [], cur = "", inQ = false, i = 0;
        while (i < str.length) {
          const ch = str[i];
          if (ch === '"') {
            if (inQ && str[i+1] === '"') { cur += '"'; i += 2; continue; }
            inQ = !inQ;
          } else if (ch === ',' && !inQ) {
            row.push(cur.trim()); cur = "";
          } else if ((ch === '\n' || (ch === '\r' && str[i+1] === '\n')) && !inQ) {
            if (ch === '\r') i++;
            row.push(cur.trim()); rows.push(row); row = []; cur = "";
          } else {
            cur += ch;
          }
          i++;
        }
        if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
        return rows;
      }

      const rows = parseCSV(text).filter(r => r.some(c => c));
      if (rows.length < 2) { setDbsStatus({ msg:"\u274C CSV appears empty", ok:false }); setDbsImporting(false); return; }

      const headers = rows[0].map(h => h.replace(/^"|"$/g,"").trim().toLowerCase());
      setDbsStatus({ msg:`Parsing ${rows.length-1} rows...`, ok:null });

      const find = keys => keys.reduce((f,k) => f >= 0 ? f : headers.indexOf(k), -1);
      const cnIdx   = find(["card number","card_num","card#","cardnum","card num"]);
      const dbsIdx  = find(["dbs score","dbs_score","dbs","salary"]);
      const setIdx  = find(["set name","set","edition"]);
      const costIdx = find(["hot dog cost","hd cost","play cost","cost"]);

      if (cnIdx < 0 || dbsIdx < 0) {
        setDbsStatus({ msg:`\u274C Couldn't find required columns. Found: ${headers.join(", ")}`, ok:false });
        setDbsImporting(false); return;
      }

      // Rarity prefix - set name mapping
      const PREFIX_TO_SET = {
        "a": "2024 Alpha Edition",
        "u": "2025 Alpha Update",
        "g": '2026 Edition "The Griffey Set"',
        "htd": "2025 Alpha Blast",
      };

      function stripPrefix(s) {
        // Strip single-letter rarity prefix: "A - PL-59" - "PL-59", "G - BPL-3" - "BPL-3"
        return String(s||"").replace(/^[A-Za-z]\s*-\s*/,"").trim();
      }
      function normStr(s) {
        return String(s||"").toLowerCase().replace(/[^a-z0-9]/g,"");
      }

      // Build lookup map: normalized cardNum - [cards]
      const exactMap = {};
      cards.forEach(c => {
        const k = normStr(c.cardNum);
        if (!exactMap[k]) exactMap[k] = [];
        exactMap[k].push(c);
      });

      let updated = 0, skipped = 0;
      const batch = [];

      for (let i = 1; i < rows.length; i++) {
        const cols    = rows[i];
        const rawNum  = (cols[cnIdx]||"").replace(/^"|"$/g,"").trim();
        const rawDbs  = (cols[dbsIdx]||"").replace(/^"|"$/g,"").trim();
        const dbs     = parseFloat(rawDbs);
        if (!rawNum || isNaN(dbs)) { skipped++; continue; }

        const baseNum  = stripPrefix(rawNum);
        const normNum  = normStr(baseNum);
        const csvSet   = setIdx >= 0 ? (cols[setIdx]||"").replace(/^"|"$/g,"").trim() : "";
        const playCost = costIdx >= 0 ? (cols[costIdx]||"").replace(/^"|"$/g,"").trim() : "";

        const allMatches = exactMap[normNum] || [];
        if (allMatches.length === 0) { skipped++; continue; }

        // Extract rarity prefix: "G - BPL-6" - "g", "HTD-40" - "htd"
        const prefixMatch = rawNum.match(/^([A-Za-z]+)\s*-\s*/);
        const prefix = prefixMatch ? prefixMatch[1].toLowerCase() : "";
        const prefixSet = PREFIX_TO_SET[prefix] || "";

        // Narrow by set -- CSV Set column first, then prefix map as fallback
        const resolvedSet = csvSet || prefixSet;
        let matches = allMatches;
        if (allMatches.length > 1 && resolvedSet) {
          const bySet = allMatches.filter(c =>
            normStr(c.setName||"") === normStr(resolvedSet)
          );
          if (bySet.length > 0) matches = bySet;
        }

        for (const match of matches) {
          const update = { dbs };
          if (playCost) update.playCost = playCost;
          batch.push({ id: match.id, update });
          updated++;
        }
      }

      // Write in batches of 400
      setDbsStatus({ msg:`Writing ${batch.length} cards to Firestore...`, ok:null });
      for (let i = 0; i < batch.length; i += 400) {
        const chunk = batch.slice(i, i + 400);
        await Promise.all(chunk.map(({ id, update }) =>
          setDoc(doc(db, "boba_checklist", id), update, { merge: true })
        ));
        setDbsStatus({ msg:`Writing... ${Math.min(i+400, batch.length)}/${batch.length}`, ok:null });
      }

      // Bust cache and reload
      try { localStorage.removeItem("boba_checklist_cache_v2"); } catch(e2) {}
      const freshSnap = await getDocs(collection(db, "boba_checklist"));
      const freshCards = freshSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => String(a.cardNum||"").localeCompare(String(b.cardNum||""), undefined, { numeric:true }));
      setCards(freshCards);
      try { localStorage.setItem("boba_checklist_cache_v2", JSON.stringify({ cards: freshCards, ts: Date.now() })); } catch(e2) {}
      setDbsStatus({ msg:`\u2705 Done! Updated ${updated} cards, skipped ${skipped}.`, ok:true });
      setTimeout(() => setDbsStatus(null), 5000);
    } catch(e) {
      console.error(e);
      setDbsStatus({ msg:"\u274C Error: " + e.message, ok:false });
    }
    setDbsImporting(false);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]; if(!file) return;
    setPendingFile(file);
    setSetNameInput("");
    e.target.value = "";
  }

  async function handleImport() {
    if(!pendingFile || !setNameInput.trim()) return;
    setImporting(true);
    setImportProgress("Reading file...");
    const text = await pendingFile.text();
    const lines = [];
    let cur="", inQ=false;
    for(let ci=0;ci<text.length;ci++){
      const ch=text[ci];
      if(ch==='"') inQ=!inQ;
      if((ch==="\n"||ch==="\r")&&!inQ){ if(cur.trim()) lines.push(cur.replace(/\r/,'')); cur=""; }
      else cur+=ch;
    }
    if(cur.trim()) lines.push(cur);
    const headers = lines[0].split(',').map(h=>h.replace(/"/g,'').trim().toLowerCase());
    const idx = k => headers.indexOf(k);
    const cardNumIdx=idx('card #'), heroIdx=idx('hero'), varIdx=idx('variation'),
          treatIdx=idx('treatment'), weaponIdx=idx('weapon'), noteIdx=idx('notation'),
          powerIdx=idx('power'), athIdx=idx('athlete inspiration'),
          costIdx=idx('play cost'), abilityIdx=idx('play ability');
    // If adding to existing set, reuse its importId so card IDs are consistent
    const existingImport = imports.find(i => i.setName === setNameInput.trim());
    const importId = existingImport ? existingImport.id : uid();
    const setName = setNameInput.trim();
    const cardIds = [];
    const batch = [];
    for(let i=1;i<lines.length;i++){
      const cols=[];let c="",q=false;
      for(const ch of lines[i]){
        if(ch==='"'){q=!q;}else if(ch===','&&!q){cols.push(c.trim());c="";}else c+=ch;
      }
      cols.push(c.trim());
      const cardNum = cols[cardNumIdx]||"";
      if(!cardNum||cardNum==="undefined") continue;
      const id = `${importId}_${cardNum.replace(/[^a-zA-Z0-9]/g,'_')}`;
      cardIds.push(id);
      batch.push({
        id, cardNum, setName, importId,
        hero:cols[heroIdx]||"", variation:cols[varIdx]||"",
        treatment:cols[treatIdx]||"", weapon:cols[weaponIdx]||"",
        notation:cols[noteIdx]||"", power:cols[powerIdx]||"",
        athlete:cols[athIdx]||"", playCost:cols[costIdx]||"",
        playAbility:cols[abilityIdx]||"",
      });
    }
    setImportProgress(`Writing ${batch.length} cards...`);
    for(let i=0;i<batch.length;i+=200){
      const chunk=batch.slice(i,i+200);
      await Promise.all(chunk.map(c=>setDoc(doc(db,"boba_checklist",c.id),c)));
      setImportProgress(`Writing ${Math.min(i+200,batch.length)} / ${batch.length}...`);
    }
    await setDoc(doc(db,"boba_imports",importId), {
      id:importId, setName, filename:pendingFile.name,
      importedAt:new Date().toISOString(), cardCount:batch.length, cardIds,
    });
    setImporting(false);
    setImportProgress("");
    setPendingFile(null);
    setSetNameInput("");
    setNewSetMode(false);
    if (onChecklistUpdated) onChecklistUpdated();
  }

  async function handleDeleteImport(imp) {
    if(!window.confirm(`Delete set "${imp.setName}" (${imp.cardCount} cards)? This cannot be undone.`)) return;
    const chunkSize = 200;
    for(let i=0;i<imp.cardIds.length;i+=chunkSize){
      await Promise.all(imp.cardIds.slice(i,i+chunkSize).map(id=>deleteDoc(doc(db,"boba_checklist",id))));
    }
    const nextOwned = {...owned};
    imp.cardIds.forEach(id=>delete nextOwned[id]);
    await setDoc(doc(db,"boba_owned",ownedDocId), nextOwned);
    await deleteDoc(doc(db,"boba_imports",imp.id));
    if (onChecklistUpdated) onChecklistUpdated();
  }

  async function handleRenameSet(imp, newName) {
    if(!newName.trim()) return;
    // Update import record
    await setDoc(doc(db,"boba_imports",imp.id), { ...imp, setName:newName.trim() }, { merge:true });
    // Update all cards in this import
    const chunkSize = 200;
    for(let i=0;i<imp.cardIds.length;i+=chunkSize){
      await Promise.all(imp.cardIds.slice(i,i+chunkSize).map(id=>
        setDoc(doc(db,"boba_checklist",id), { setName:newName.trim() }, { merge:true })
      ));
    }
    setRenamingId(null);
  }

  const sets = [...new Set(cards.map(c=>c.setName).filter(Boolean))].sort();
  const treatments = [...new Set(cards.filter(c=>!filterSet||c.setName===filterSet).map(c=>c.treatment).filter(Boolean))].sort();
  const weapons    = [...new Set(cards.filter(c=>!filterSet||c.setName===filterSet).map(c=>c.weapon).filter(Boolean))].sort();
  const notations  = [...new Set(cards.filter(c=>!filterSet||c.setName===filterSet).map(c=>c.notation).filter(Boolean))].sort();

  const filtered = cards.filter(c => {
    if(filterSet && c.setName !== filterSet) return false;
    if(search && !`${c.cardNum} ${c.hero} ${c.variation} ${c.athlete}`.toLowerCase().includes(search.toLowerCase())) return false;
    if(filterTreat && c.treatment !== filterTreat) return false;
    if(filterWeapon && c.weapon !== filterWeapon) return false;
    if(filterNote && c.notation !== filterNote) return false;
    if(filterOwned==="owned" && !owned[c.id]) return false;
    if(filterOwned==="missing" && owned[c.id]) return false;
    return true;
  }).sort((a,b) => {
    if(sortBy==="cardNum") {
      const na = parseFloat(a.cardNum), nb = parseFloat(b.cardNum);
      if(!isNaN(na)&&!isNaN(nb)) return na-nb;
      return String(a.cardNum).localeCompare(String(b.cardNum));
    }
    if(sortBy==="power_desc") return (parseFloat(b.power)||0)-(parseFloat(a.power)||0);
    if(sortBy==="power_asc")  return (parseFloat(a.power)||0)-(parseFloat(b.power)||0);
    if(sortBy==="hero")       return (a.hero||"").localeCompare(b.hero||"");
    if(sortBy==="treatment")  return (a.treatment||"").localeCompare(b.treatment||"");
    if(sortBy==="weapon")     return (a.weapon||"").localeCompare(b.weapon||"");
    if(sortBy==="owned")      return (owned[b.id]?1:0)-(owned[a.id]?1:0);
    return 0;
  });

  const totalOwned = Object.keys(owned).length; // unique cards
  const totalCollection = Object.values(owned).reduce((s,q)=>s+(q||0),0); // total copies
  const totalCards = cards.length;
  const pct = totalCards > 0 ? Math.round(totalOwned/totalCards*100) : 0;
  const totalPages = Math.ceil(filtered.length/PAGE_SIZE);
  const paginated = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);

  const WEAPON_COLORS = { Fire:"#F97316", Ice:"#60A5FA", Steel:"#C0C0C0", Brawl:"#EF4444",
    Glow:"#4ade80", Hex:"#A855F7", Gum:"#F472B6", Metallic:"#E5E7EB",
    Alt:"#FFFFFF", Super:"#F59E0B", "":"#444" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

      {/* Header */}
      <div style={{ ...S.card, padding:"12px 16px" }}>
        {/* Row 1: title + stats + view toggles */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom: imports.length > 0 ? 10 : 0, flexWrap:"wrap" }}>
          <span style={{ fontSize:16, fontWeight:900, color:"#F0F0F0" }}>{"\uD83C\uDCCF BoBA"}</span>
          <span style={{ fontSize:11, color:"#555" }}>{totalCards.toLocaleString()} cards</span>
          {totalOwned > 0 && <span style={{ fontSize:11, color:"#4ade80", fontWeight:700 }}>{totalOwned} owned</span>}
          {totalCollection > totalOwned && <span style={{ fontSize:11, color:"#7B9CFF" }}>{totalCollection} copies</span>}
          {pct > 0 && <span style={{ fontSize:11, color:"#FBBF24", fontWeight:700 }}>{pct}%</span>}
          <div style={{ flex:1 }}/>
          {/* View toggles */}
          <div style={{ display:"flex", gap:3, flexWrap:"wrap" }} className="view-mode-row">
            {[["cards","\uD83C\uDCCF Cards"],["treatments","\uD83D\uDCCB Treatments"],["rainbow","\uD83C\uDF08 Rainbow"],["stats","\uD83D\uDCCA Stats"],["wants","\uD83C\uDFAF Wants"],["deck","\u2694\uFE0F Deck"],["playbook","\uD83D\uDCD6 Playbook"]].map(([v,l])=>(
              <button key={v} onClick={()=>setViewMode(v)} style={{ background:viewMode===v?"#1A1A2E":"transparent", color:viewMode===v?"#E8317A":"#9CA3AF", border:`1.5px solid ${viewMode===v?"#E8317A":"#2a2a2a"}`, borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>{l}</button>
            ))}
          </div>
          {/* Action buttons -- compact */}
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {isAdmin && (
              <label style={{ background:"#1A1A2E", color:"#E8317A", border:"1px solid #E8317A44", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                {"\uD83D\uDCC2 Import Cards"}<input type="file" accept=".csv" onChange={handleFileSelect} style={{ display:"none" }}/>
              </label>
            )}
            {isAdmin && (
              <label title="Import .webp/.jpg/.png card images directly" style={{ background:"#0a1a0a", color:"#4ade80", border:"1px solid #4ade8044", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:imgScanProgress?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap", opacity:imgScanProgress?0.5:1 }}>
                {"\uD83D\uDDBC Import Images"}<input type="file" accept=".webp,.jpg,.jpeg,.png" multiple disabled={!!imgScanProgress}
                  onChange={e=>{
                    const files = e.target.files;
                    if (!files || files.length === 0) return;
                    setImgImportSet(filterSet || "");
                    setImgImportModal({ files });
                    e.target.value="";
                  }} style={{ display:"none" }}/>
              </label>
            )}
            {/* Camera scan -- opens modal on click */}
            <button title="Scan cards into your collection"
              onClick={()=>{ setScanModal(true); setScanSession([]); setPhotoScan(null); }}
              style={{ background:"#1a0a1a", color:"#E8317A", border:"1px solid #E8317A44", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              {"\uD83D\uDCF7 Scan Card"}</button>
            {isAdmin && (
              <label title="Import DBS salary values (CSV: card_num, dbs)" style={{ background:"#1a0f1a", color:"#A855F7", border:"1px solid #A855F744", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:dbsImporting?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap", opacity:dbsImporting?0.5:1 }}>
                {dbsImporting?"Importing...":"\uD83D\uDCB0 Import DBS"}
                <input type="file" accept=".csv" disabled={dbsImporting} onChange={e=>{ const f=e.target.files[0]; if(f) importDbsCsv(f); e.target.value=""; }} style={{ display:"none" }}/>
              </label>
            )}
            {isAdmin && (
              <button onClick={async()=>{
                if(!window.confirm("Wipe all DBS import data (dbs, playCost, playName) from all play cards so you can re-import clean. Continue?")) return;
                const playcards = cards.filter(c=>{ const t=(c.treatment||"").toLowerCase(); return t==="plays"||t==="bonus plays"||t==="home team discount"; });
                setDbsStatus({ msg:`Wiping DBS data from ${playcards.length} play cards...`, ok:null });
                for(let i=0;i<playcards.length;i+=400){
                  await Promise.all(playcards.slice(i,i+400).map(c=>
                    setDoc(doc(db,"boba_checklist",c.id), { dbs:deleteField(), playCost:deleteField(), playName:deleteField() }, { merge:true })
                  ));
                  setDbsStatus({ msg:`Wiping... ${Math.min(i+400,playcards.length)}/${playcards.length}`, ok:null });
                }
                try { localStorage.removeItem("boba_checklist_cache_v2"); } catch(e){}
                const snap = await getDocs(collection(db,"boba_checklist"));
                const fresh = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.cardNum||"").localeCompare(String(b.cardNum||""),undefined,{numeric:true}));
                setCards(fresh);
                try { localStorage.setItem("boba_checklist_cache_v2", JSON.stringify({ cards:fresh, ts:Date.now() })); } catch(e){}
                setDbsStatus({ msg:`\u2705 Wiped ${playcards.length} play cards -- re-import DBS CSV now`, ok:true });
                setTimeout(()=>setDbsStatus(null),8000);
              }} style={{ background:"#1a0a0a", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                {"\uD83E\uDDF9 Wipe DBS Data"}</button>
            )}
            {dbsStatus && (
              <span style={{ fontSize:11, fontWeight:700, color:dbsStatus.ok===true?"#4ade80":dbsStatus.ok===false?"#E8317A":"#A855F7", background:dbsStatus.ok===true?"#0a1a0a":dbsStatus.ok===false?"#1a0a0a":"#1a0f1a", border:`1px solid ${dbsStatus.ok===true?"#4ade8044":dbsStatus.ok===false?"#E8317A44":"#A855F744"}`, borderRadius:7, padding:"4px 10px", whiteSpace:"nowrap" }}>
                {dbsStatus.msg}
              </span>
            )}
            {isAdmin && totalOwned === 0 && (
              <button onClick={async()=>{
                if (!window.confirm("Copy your collection from the old shared doc to your personal account?")) return;
                const oldSnap = await getDoc(doc(db,"boba_owned","owned"));
                if (oldSnap.exists() && Object.keys(oldSnap.data()).length > 0) {
                  const data = oldSnap.data();
                  await setDoc(doc(db,"boba_owned",ownedDocId), data);
                  setOwned(data);
                  alert(`\u2705 Imported ${Object.keys(data).length} cards to your account!`);
                } else {
                  alert("No data found in the shared collection.");
                }
              }} style={{ background:"#0a1a0a", border:"1px solid #4ade8044", color:"#4ade80", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                {"\u2191 Restore My Collection"}</button>
            )}
            <label style={{ background:"#0a0f1a", color:"#7B9CFF", border:"1px solid #7B9CFF44", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
              {"\uD83D\uDCE5 Collection"}<input type="file" accept=".csv" onChange={e=>{ const f=e.target.files[0]; if(f) importCollectionCsv(f); e.target.value=""; }} style={{ display:"none" }}/>
            </label>
            <button onClick={downloadTemplate} style={{ background:"transparent", border:"1px solid #2a2a2a", color:"#555", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDCCB"}</button>
            {totalOwned > 0 && (
              <button onClick={exportCollection} style={{ background:"transparent", border:"1px solid #2a2a2a", color:"#4ade80", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDCE4"}</button>
            )}
            {totalOwned > 0 && (
              <button onClick={async()=>{ if(!window.confirm(`Clear all ${totalOwned} owned cards?`)) return; await setDoc(doc(db,"boba_owned",ownedDocId),{}); setOwned({}); }} style={{ background:"transparent", border:"1px solid #E8317A22", color:"#E8317A", borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\u2715"}</button>
            )}
          </div>
        </div>
        {/* Row 2: per-set progress bars -- collapsible */}
        {imports.length > 0 && (
          <div>
            <button onClick={()=>setSetsCollapsed(p=>!p)}
              style={{ background:"none", border:"none", color:"#333", fontSize:10, fontWeight:700, cursor:"pointer", fontFamily:"inherit", padding:"4px 0", display:"flex", alignItems:"center", gap:4 }}>
              {setsCollapsed ? "\u25B6 Show sets" : "\u25BC Hide sets"}
            </button>
            {!setsCollapsed && (
              <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                {imports.map(imp => {
                  const setCards = cards.filter(c => c.setName === imp.setName);
                  const setOwned = setCards.filter(c => owned[c.id]).length;
                  const setPct   = setCards.length > 0 ? Math.round(setOwned/setCards.length*100) : 0;
                  const isComplete = setPct === 100;
                  return (
                    <div key={imp.id} style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <span style={{ fontSize:10, color:isComplete?"#4ade80":"#666", fontWeight:isComplete?700:400, width:220, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", flexShrink:0 }}>
                        {isComplete?"\uD83C\uDF08 ":""}{imp.setName}
                      </span>
                      <div style={{ flex:1, height:4, background:"#1a1a1a", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ width:`${setPct}%`, height:"100%", borderRadius:2, transition:"width 0.3s",
                          background: isComplete
                            ? "linear-gradient(90deg,#F97316,#FBBF24,#4ade80,#60A5FA,#A855F7,#F472B6)"
                            : "linear-gradient(90deg,#E8317A,#7B2FF7)"
                        }}/>
                      </div>
                      <span style={{ fontSize:10, color:isComplete?"#4ade80":setPct>0?"#FBBF24":"#333", minWidth:80, textAlign:"right", flexShrink:0 }}>
                        {setOwned}/{setCards.length} &middot; {setPct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Image Import Set Picker Modal */}
      {imgImportModal && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }}
          onClick={()=>setImgImportModal(null)}>
          <div style={{ background:"#111", border:"1.5px solid #4ade8044", borderRadius:16, padding:28, width:420, maxWidth:"90vw" }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:18, fontWeight:900, color:"#F0F0F0", marginBottom:4 }}>
              {"\uD83D\uDDBC Import"}{imgImportModal.files.length}{" Image"}{imgImportModal.files.length !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize:12, color:"#555", marginBottom:20 }}>Select which set these images belong to. This dramatically improves matching accuracy.</div>
            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:700, color:"#888", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:8 }}>Set (recommended)</label>
              <select
                value={imgImportSet}
                onChange={e=>setImgImportSet(e.target.value)}
                autoFocus
                style={{ width:"100%", background:"#0a0a0a", border:"1.5px solid #2a2a2a", borderRadius:8, color:imgImportSet?"#F0F0F0":"#666", padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none", cursor:"pointer" }}>
                <option value="">-- No set filter (filename / Vision only) --</option>
                {sets.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              {imgImportSet && (
                <div style={{ fontSize:11, color:"#4ade80", marginTop:6 }}>
                  {"\u2713 Matching against"}{cards.filter(c=>c.setName===imgImportSet).length}{" cards in "}{imgImportSet}
                </div>
              )}
            </div>
            <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:"10px 14px", marginBottom:20, fontSize:11, color:"#555", lineHeight:1.7 }}>
              <div style={{ color:"#4ade80", fontWeight:700, marginBottom:4 }}>Matching priority:</div>
              <div>{"1. Filename set-order number (e.g. setorder61)"}</div>
              <div>{"2. Card # + set + hero name"}</div>
              <div>{"3. Hero + treatment + weapon + power"}</div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button
                onClick={()=>{ scanImagesForCards(imgImportModal.files, imgImportSet); setImgImportModal(null); }}
                style={{ flex:1, background:"#4ade80", color:"#000", border:"none", borderRadius:10, padding:"12px 0", fontSize:14, fontWeight:900, cursor:"pointer", fontFamily:"inherit" }}>
                Start Import
              </button>
              <button
                onClick={()=>setImgImportModal(null)}
                style={{ background:"transparent", border:"1px solid #333", color:"#555", borderRadius:10, padding:"12px 20px", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Collection Import Result Modal */}
      {collectionImportResult && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setCollectionImportResult(null)}>
          <div style={{ background:"#111111", border:"1.5px solid #7B9CFF44", borderRadius:14, padding:"24px", width:420, maxWidth:"90vw" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:15, color:"#7B9CFF", marginBottom:12 }}>{"\uD83D\uDCE5 Import Complete"}</div>
            <div style={{ fontSize:13, color:"#4ade80", marginBottom:4 }}>{"\u2705"}{collectionImportResult.matched} cards matched & imported</div>
            {collectionImportResult.skipped > 0 && (
              <div style={{ fontSize:13, color:"#E8317A", marginBottom:8 }}>{"\u26A0\uFE0F"}{collectionImportResult.skipped} rows skipped (no match found)</div>
            )}
            {collectionImportResult.skippedRows.length > 0 && (
              <div style={{ maxHeight:120, overflowY:"auto", background:"#0a0a0a", borderRadius:6, padding:"8px 10px", fontSize:10, color:"#666", marginBottom:12 }}>
                {collectionImportResult.skippedRows.map((r,i)=><div key={i}>{r}</div>)}
              </div>
            )}
            <button onClick={()=>setCollectionImportResult(null)} style={{ background:"#0a0f1a", color:"#7B9CFF", border:"1.5px solid #7B9CFF", borderRadius:8, padding:"8px 18px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Done</button>
          </div>
        </div>
      )}

      {/* Scan Config Modal */}
      {pendingScan && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={()=>setPendingScan(null)}>
          <div style={{ background:"#111111", border:"1.5px solid #7B9CFF44", borderRadius:14, padding:"24px", width:420, maxWidth:"90vw" }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:15, color:"#7B9CFF", marginBottom:4 }}>{"\uD83D\uDD0D Scan PDF:"}{pendingScan.file.name}</div>
            <div style={{ fontSize:12, color:"#555", marginBottom:16 }}>Tell Claude what's in this PDF so it only needs to match hero names</div>
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              <div>
                <label style={S.lbl}>Treatment</label>
                <select value={pendingScan.treatment||""} onChange={e=>setPendingScan(p=>({...p,treatment:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                  <option value="">-- Select Treatment --</option>
                  {[...new Set(cards.map(c=>c.treatment).filter(Boolean))].sort().map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={S.lbl}>Weapon</label>
                <select value={pendingScan.weapon||""} onChange={e=>setPendingScan(p=>({...p,weapon:e.target.value}))} style={{ ...S.inp, cursor:"pointer" }}>
                  <option value="">-- Select Weapon --</option>
                  {["Fire","Ice","Steel","Brawl","Glow","Hex","Gum","Super","Alt","Metallic"].map(w=><option key={w} value={w}>{w}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize:11, color:"#555", marginTop:10 }}>
              {pendingScan.treatment && pendingScan.weapon
                ? `Will match hero names to ${pendingScan.treatment} / ${pendingScan.weapon} cards`
                : "Select treatment and weapon to narrow matching"}
            </div>
            <div style={{ display:"flex", gap:8, marginTop:16 }}>
              <button onClick={()=>{ if(!pendingScan.treatment||!pendingScan.weapon){ alert("Please select both treatment and weapon"); return; } scanPdfForCards(pendingScan.file, pendingScan.setName, pendingScan.treatment, pendingScan.weapon); setPendingScan(null); }} style={{ background:"#0a0f1a", color:"#7B9CFF", border:"1.5px solid #7B9CFF", borderRadius:8, padding:"8px 18px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDD0D Start Scan"}</button>
              <button onClick={()=>setPendingScan(null)} style={{ background:"none", border:"1px solid #333", color:"#888", borderRadius:8, padding:"8px 18px", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Scan Progress */}
      {scanProgress && (
        <div style={{ ...S.card, border:"1.5px solid #7B9CFF44", background:"#0a0f1a" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
            <div style={{ fontWeight:700, color:"#7B9CFF", fontSize:14 }}>{"\uD83D\uDD0D Scanning:"}{scanPdf}</div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={()=>{ scanPausedRef.current=!scanPausedRef.current; setScanPaused(p=>!p); }} style={{ background:"#1a1a2e", color:"#7B9CFF", border:"1px solid #7B9CFF44", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {scanPaused ? "\u25B6 Resume" : "\u23F8 Pause"}
              </button>
            </div>
          </div>
          <div style={{ height:8, background:"#1a1a1a", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
            <div style={{ width:`${scanProgress.total > 0 ? Math.round(scanProgress.current/scanProgress.total*100) : 0}%`, height:"100%", background:"linear-gradient(90deg,#7B9CFF,#C084FC)", borderRadius:4, transition:"width 0.3s" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
            <span style={{ color:"#888" }}>{scanProgress.status}</span>
            <span style={{ color:"#7B9CFF", fontWeight:700 }}>{scanProgress.current}/{scanProgress.total} pages</span>
          </div>
        </div>
      )}

      )}

      {/* -- SCAN MODAL -- */}
      {scanModal && (
        <div style={{ position:"fixed", inset:0, background:"#000", zIndex:2000, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Header bar */}
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", background:"#0a0a0a", borderBottom:"1px solid #1a1a1a", flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:16, fontWeight:900, color:"#E8317A" }}>{"\uD83D\uDCF7 Scan Mode"}</span>
              {scanSession.length > 0 && (
                <span style={{ fontSize:12, background:"#E8317A22", color:"#E8317A", border:"1px solid #E8317A44", borderRadius:20, padding:"2px 10px", fontWeight:700 }}>
                  {scanSession.length} added
                </span>
              )}
            </div>
            <button onClick={()=>{ setScanModal(false); setPhotoScan(null); setScanQty(1); }}
              style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
              Done
            </button>
          </div>

          <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

            {/* Scan result / camera trigger area */}
            <div style={{ padding:"16px", flexShrink:0 }}>
              {!photoScan && (
                 <label style={{ display:"block", width:"100%", cursor:"pointer" }}>
                   <div style={{ background:"#0a0a0a", border:"2px dashed #E8317A44", borderRadius:16, padding:"32px 16px", textAlign:"center" }}>
                     <div style={{ fontSize:48, marginBottom:8 }}>{"\uD83D\uDCF7"}</div>
                     <div style={{ fontSize:16, fontWeight:800, color:"#E8317A", marginBottom:4 }}>Tap to scan a card</div>
                     <div style={{ fontSize:12, color:"#555" }}>Opens camera to identify the card</div>
                   </div>
                   <input type="file" accept="image/*" capture="environment"
                     onChange={e=>{ const f=e.target.files?.[0]; if(f){ setPhotoScan(null); scanCardPhoto(f); } e.target.value=""; }}
                     style={{ position:"absolute", opacity:0, width:1, height:1, pointerEvents:"none" }}/>
                 </label>
              )}

              {photoScan?.status === "scanning" && (
                <div style={{ background:"#0a0f1a", border:"1.5px solid #7B9CFF44", borderRadius:16, padding:"32px 16px", textAlign:"center" }}>
                  <div style={{ width:40, height:40, border:"3px solid #1a1a2e", borderTopColor:"#E8317A", borderRadius:"50%", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
                  <div style={{ fontSize:15, fontWeight:700, color:"#7B9CFF" }}>Reading card...</div>
                </div>
              )}

              {photoScan?.status === "matched" && photoScan.card && (() => {
                const c = photoScan.card;
                const wc = { Fire:"#F97316", Ice:"#60A5FA", Steel:"#C0C0C0", Brawl:"#EF4444", Glow:"#4ade80", Hex:"#A855F7", Gum:"#F472B6", Metallic:"#E5E7EB", Alt:"#FFFFFF", Super:"#F59E0B" }[c.weapon] || "#888";
                return (
                  <div style={{ background:"#0a1a0a", border:"1.5px solid #4ade8044", borderRadius:16, overflow:"hidden" }}>
                    <div style={{ display:"flex", gap:12, padding:"14px" }}>
                      {c.imageUrl
                        ? <img src={c.imageUrl} alt={c.hero} style={{ width:72, height:96, objectFit:"cover", borderRadius:10, flexShrink:0, boxShadow:"0 4px 16px rgba(0,0,0,0.6)" }}/>
                        : <div style={{ width:72, height:96, background:"#1a1a1a", borderRadius:10, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:"#555", textAlign:"center" }}>{c.hero?.split(" ")[0]}</div>
                      }
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:16, fontWeight:900, color:"#F0F0F0", marginBottom:4 }}>{c.hero}</div>
                        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
                          {c.weapon && <span style={{ fontSize:11, fontWeight:700, color:wc }}>{c.weapon}</span>}
                          {c.treatment && <span style={{ fontSize:11, color:"#888" }}>{c.treatment}</span>}
                          {c.setName && <span style={{ fontSize:11, color:"#555", fontStyle:"italic" }}>{c.setName}</span>}
                        </div>
                        {c.power && <div style={{ fontSize:28, fontWeight:900, color:wc, lineHeight:1 }}>{c.power}</div>}
                        {c.athlete && <div style={{ fontSize:11, color:"#555", marginTop:4 }}>Inspired by {c.athlete}</div>}
                        {/* Debug: show what Vision actually detected */}
                        {photoScan.detected && (
                          <div style={{ fontSize:10, color:"#333", marginTop:6, borderTop:"1px solid #1a1a1a", paddingTop:4 }}>
                            <div>Vision read: #{photoScan.detected.cardNum||"?"} &middot; {photoScan.detected.hero||"?"} &middot; {photoScan.detected.weapon||"?"}</div>
                            {photoScan.detected.visualHints && <div style={{ color:"#2a2a2a", marginTop:2 }}>Visual: {photoScan.detected.visualHints}</div>}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* Qty + confirm */}
                    <div style={{ padding:"12px 14px", borderTop:"1px solid #1a2a1a", display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:0, background:"#111", borderRadius:8, border:"1px solid #2a2a2a", overflow:"hidden" }}>
                        <button onClick={()=>setScanQty(q=>Math.max(1,q-1))}
                          style={{ background:"none", border:"none", color:"#888", fontSize:18, fontWeight:700, width:40, height:40, cursor:"pointer", fontFamily:"inherit" }}>{"\u2212"}</button>
                        <span style={{ fontSize:16, fontWeight:900, color:"#F0F0F0", minWidth:32, textAlign:"center" }}>{scanQty}</span>
                        <button onClick={()=>setScanQty(q=>q+1)}
                          style={{ background:"none", border:"none", color:"#888", fontSize:18, fontWeight:700, width:40, height:40, cursor:"pointer", fontFamily:"inherit" }}>+</button>
                      </div>
                      <button onClick={()=>confirmScanAdd(scanQty)}
                        style={{ flex:1, background:"#4ade80", color:"#000", border:"none", borderRadius:8, padding:"10px 0", fontSize:14, fontWeight:900, cursor:"pointer", fontFamily:"inherit" }}>
                        {"\u2713 Add"}{scanQty > 1 ? `${scanQty}\u00D7` : ""} to Collection
                      </button>
                      <label style={{ background:"#1a1a1a", color:"#555", border:"1px solid #2a2a2a", borderRadius:8, padding:"10px 14px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit", display:"flex", alignItems:"center" }}>
                        Retake
                        <input type="file" accept="image/*" capture="environment" onChange={e=>{ const f=e.target.files[0]; if(f){ setPhotoScan(null); setScanQty(1); scanCardPhoto(f); } e.target.value=""; }} style={{ display:"none" }}/>
                      </label>
                      <button onClick={()=>{ setPhotoScan({ status:"nomatch", card:null, identified: photoScan.detected }); }}
                        style={{ background:"transparent", border:"none", color:"#E8317A", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", padding:"0 4px" }}>
                        Wrong card?
                      </button>
                    </div>
                  </div>
                );
              })()}

              {photoScan?.status === "nomatch" && (
                <div style={{ background:"#1a0a0a", border:"1.5px solid #E8317A44", borderRadius:16, padding:"20px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{"\u274C"}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:"#E8317A", marginBottom:4 }}>Card not recognized</div>
                  {photoScan.identified?.hero && <div style={{ fontSize:12, color:"#555", marginBottom:12 }}>Detected: {photoScan.identified.hero} #{photoScan.identified.cardNum}</div>}
                  <label style={{ background:"#E8317A", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", display:"inline-block" }}>
                    Try Again
                    <input type="file" accept="image/*" capture="environment" onChange={e=>{ const f=e.target.files[0]; if(f){ setPhotoScan(null); scanCardPhoto(f); } e.target.value=""; }} style={{ display:"none" }}/>
                  </label>
                </div>
              )}

              {photoScan?.status === "error" && (
                <div style={{ background:"#1a0a0a", border:"1.5px solid #E8317A44", borderRadius:16, padding:"20px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>{"\u26A0\uFE0F"}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:"#E8317A", marginBottom:8 }}>Scan failed</div>
                  {photoScan.message && <div style={{ fontSize:11, color:"#555", marginBottom:12, fontFamily:"monospace" }}>{photoScan.message}</div>}
                  <label style={{ background:"#E8317A", color:"#fff", border:"none", borderRadius:8, padding:"10px 24px", fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit", display:"inline-block" }}>
                    Try Again
                    <input type="file" accept="image/*" capture="environment" onChange={e=>{ const f=e.target.files?.[0]; if(f){ setPhotoScan(null); scanCardPhoto(f); } e.target.value=""; }} style={{ display:"none" }}/>
                  </label>
                </div>
              )}
            </div>

            {/* Session log */}
            {scanSession.length > 0 && (
              <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column", borderTop:"1px solid #1a1a1a" }}>
                <div style={{ padding:"10px 16px 6px", fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1, flexShrink:0 }}>
                  This Session -- {scanSession.reduce((s,e)=>s+e.qty,0)} cards added
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"0 16px 16px" }}>
                  {scanSession.map((entry, i) => {
                    const c = entry.card;
                    const wc = { Fire:"#F97316", Ice:"#60A5FA", Steel:"#C0C0C0", Brawl:"#EF4444", Glow:"#4ade80", Hex:"#A855F7", Gum:"#F472B6", Metallic:"#E5E7EB", Alt:"#FFFFFF", Super:"#F59E0B" }[c.weapon] || "#888";
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 0", borderBottom:"1px solid #111" }}>
                        {c.imageUrl
                          ? <img src={c.imageUrl} alt={c.hero} style={{ width:32, height:42, objectFit:"cover", borderRadius:5, flexShrink:0 }}/>
                          : <div style={{ width:32, height:42, background:"#1a1a1a", borderRadius:5, flexShrink:0 }}/>
                        }
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#F0F0F0" }}>{c.hero}</div>
                          <div style={{ fontSize:11, color:wc }}>{c.weapon} &middot; {c.power}</div>
                        </div>
                        <div style={{ fontSize:13, fontWeight:900, color:"#4ade80", flexShrink:0 }}>+{entry.qty}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* First scan prompt if nothing yet */}
            {!photoScan && scanSession.length === 0 && (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#222", fontSize:12, padding:16 }}>
                Session log will appear here after your first scan
              </div>
            )}
          </div>
        </div>
      )}

      {/* Non-modal photoScan toast (used when not in modal) */}
      {!scanModal && photoScan && photoScan.status !== "scanning" && (
        <div style={{ ...S.card, border:`1.5px solid ${photoScan.status==="matched"?"#4ade8044":"#E8317A44"}`, background:photoScan.status==="matched"?"#0a1a0a":"#1a0a0a", display:"flex", alignItems:"center", gap:12 }}>
          {photoScan.status==="matched" && <><span style={{ fontSize:28 }}>{"\u2705"}</span><div><div style={{ fontWeight:800, color:"#4ade80", fontSize:14 }}>Added to collection!</div><div style={{ fontSize:12, color:"#888", marginTop:2 }}>{photoScan.card?.hero} &middot; #{photoScan.card?.cardNum}</div></div></>}
          {photoScan.status==="nomatch" && <><span style={{ fontSize:28 }}>{"\u274C"}</span><div><div style={{ fontWeight:800, color:"#E8317A", fontSize:14 }}>Card not found</div>{photoScan.identified && <div style={{ fontSize:12, color:"#888", marginTop:2 }}>Detected: {photoScan.identified.hero||"?"} #{photoScan.identified.cardNum||"?"}</div>}</div></>}
          {photoScan.status==="error" && <><span style={{ fontSize:28 }}>{"\u26A0\uFE0F"}</span><div style={{ fontWeight:800, color:"#E8317A", fontSize:14 }}>Scan failed -- try again</div></>}
        </div>
      )}

      {imgScanProgress && (
        <div style={{ position:"fixed",bottom:24,right:24,zIndex:9999,background:"#0a1a0a",border:"1.5px solid #4ade8044",borderRadius:12,padding:"16px 20px",minWidth:300,boxShadow:"0 8px 40px rgba(0,0,0,0.8)",fontFamily:"'Trebuchet MS',sans-serif" }}>
          <div style={{ fontWeight:700, color:"#4ade80", fontSize:14, marginBottom:10 }}>{"\uD83D\uDDBC Scanning Images..."}</div>
          <div style={{ height:8, background:"#1a1a1a", borderRadius:4, overflow:"hidden", marginBottom:8 }}>
            <div style={{ width:`${imgScanProgress.total > 0 ? Math.round(imgScanProgress.current/imgScanProgress.total*100) : 0}%`, height:"100%", background:"linear-gradient(90deg,#4ade80,#7B9CFF)", borderRadius:4, transition:"width 0.3s" }}/>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11 }}>
            <span style={{ color:"#888" }}>{imgScanProgress.status}</span>
            <span style={{ color:"#4ade80", fontWeight:700 }}>{imgScanProgress.current}/{imgScanProgress.total} images</span>
          </div>
        </div>
      )}

      {/* Import modal */}
      {pendingFile && (() => {
        const existingSets = [...new Set(cards.map(c=>c.setName).filter(Boolean))].sort();
        return (
          <div style={{ ...S.card, border:"1.5px solid #E8317A44", background:"#0a0005" }}>
            <div style={{ fontWeight:700, color:"#F0F0F0", marginBottom:10 }}>{"\uD83D\uDCC2"}{pendingFile.name}</div>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              {!newSetMode && existingSets.length > 0 ? (
                <>
                  <select
                    value={setNameInput}
                    onChange={e => { if(e.target.value === "__new__") { setNewSetMode(true); setSetNameInput(""); } else setSetNameInput(e.target.value); }}
                    style={{ ...S.inp, flex:1, cursor:"pointer", color:setNameInput?"#F0F0F0":"#555" }}
                    autoFocus
                  >
                    <option value="">-- Select existing set --</option>
                    {existingSets.map(s=><option key={s} value={s}>{s}</option>)}
                    <option value="__new__">+ Create new set...</option>
                  </select>
                </>
              ) : (
                <div style={{ display:"flex", gap:8, flex:1, alignItems:"center" }}>
                  {existingSets.length > 0 && (
                    <button onClick={()=>{ setNewSetMode(false); setSetNameInput(""); }}
                      style={{ background:"transparent", border:"1px solid #2a2a2a", color:"#555", borderRadius:7, padding:"6px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                      {"\u2190 Existing"}</button>
                  )}
                  <input
                    value={setNameInput}
                    onChange={e=>setSetNameInput(e.target.value)}
                    placeholder="New set name (e.g. 2025 Alpha Blast)"
                    style={{ ...S.inp, flex:1 }}
                    onKeyDown={e=>e.key==="Enter"&&handleImport()}
                    autoFocus
                  />
                </div>
              )}
              <Btn onClick={handleImport} variant="green" disabled={!setNameInput.trim()||importing}>
                {importing ? importProgress||"Importing..." : "\u2705 Import"}
              </Btn>
              <Btn onClick={()=>{ setPendingFile(null); setNewSetMode(false); setSetNameInput(""); }} variant="ghost">Cancel</Btn>
            </div>
            {setNameInput && !newSetMode && (
              <div style={{ fontSize:11, color:"#555", marginTop:6 }}>
                Adding cards to existing set: <span style={{ color:"#7B9CFF", fontWeight:700 }}>{setNameInput}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filters */}
      <div style={{ ...S.card, display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search card #, hero, athlete..." style={{ ...S.inp, flex:1, minWidth:200 }}/>
        {sets.length > 0 && (
          <select value={filterSet} onChange={e=>{setFilterSet(e.target.value);setFilterTreat("");setFilterWeapon("");setFilterNote("");setPage(1);}} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
            <option value="">All Sets</option>
            {sets.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        )}
        <select value={filterTreat} onChange={e=>{setFilterTreat(e.target.value);setPage(1);}} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
          <option value="">All Treatments</option>
          {treatments.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterWeapon} onChange={e=>{setFilterWeapon(e.target.value);setPage(1);}} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
          <option value="">All Weapons</option>
          {weapons.map(w=><option key={w} value={w}>{w}</option>)}
        </select>
        <select value={filterNote} onChange={e=>{setFilterNote(e.target.value);setPage(1);}} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
          <option value="">All Notations</option>
          {notations.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <select value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(1);}} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
          <option value="cardNum">Sort: Card #</option>
          <option value="hero">{"Sort: Hero A\u2192Z"}</option>
          <option value="power_desc">{"Sort: Power High\u2192Low"}</option>
          <option value="power_asc">{"Sort: Power Low\u2192High"}</option>
          <option value="treatment">Sort: Treatment</option>
          <option value="weapon">Sort: Weapon</option>
          <option value="owned">Sort: Owned First</option>
        </select>
        <div style={{ display:"flex", gap:4 }}>
          {[["all","All"],["owned","\u2705 Owned"],["missing","\u274C Missing"]].map(([v,l])=>(
            <button key={v} onClick={()=>{setFilterOwned(v);setPage(1);}} style={{ background:filterOwned===v?"#1A1A2E":"transparent", color:filterOwned===v?"#E8317A":"#9CA3AF", border:`1.5px solid ${filterOwned===v?"#E8317A":"#333"}`, borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
          ))}
        </div>
        <span style={{ fontSize:11, color:"#555" }}>{filtered.length.toLocaleString()} cards</span>
      </div>

      {/* Rainbow Tracker */}
      {viewMode === "rainbow" && !loading && cards.length > 0 && (() => {
        const rainbowCards = (rainbowSetFilter ? cards.filter(c => c.setName === rainbowSetFilter) : cards)
          .filter(c => { const t=(c.treatment||"").toLowerCase(); return t!=="plays"&&t!=="bonus plays"&&t!=="home team discount"; });
        const availableSets = [...new Set(cards.map(c=>c.setName).filter(Boolean))].sort();

        // Group filtered cards by hero
        const heroCards = {};
        rainbowCards.forEach(c => {
          if(!c.hero) return;
          if(!heroCards[c.hero]) heroCards[c.hero] = [];
          heroCards[c.hero].push(c);
        });
        const allHeroes = Object.keys(heroCards).sort();
        const heroStats = allHeroes.map(hero => {
          const hcards = heroCards[hero];
          const total = hcards.length;
          const ownedCount = hcards.filter(c => owned[c.id]).length;
          const complete = total > 0 && ownedCount === total;
          // Group by set for multi-set heroes
          const bySets = {};
          hcards.forEach(c => {
            const s = c.setName || "Unknown";
            if(!bySets[s]) bySets[s] = { total:0, owned:0 };
            bySets[s].total++;
            if(owned[c.id]) bySets[s].owned++;
          });
          return { hero, total, ownedCount, complete, bySets };
        });
        const completedRainbows = heroStats.filter(h => h.complete).length;
        const partialRainbows   = heroStats.filter(h => h.ownedCount > 0 && !h.complete).length;

        const filteredHeroes = heroStats.filter(h =>
          !search || h.hero.toLowerCase().includes(search.toLowerCase())
        );

        const visibleHeroes = filteredHeroes.filter(h => {
          if(rainbowFilter === "complete") return h.complete;
          if(rainbowFilter === "partial")  return h.ownedCount > 0 && !h.complete;
          if(rainbowFilter === "missing")  return h.ownedCount === 0;
          return true;
        });

        return (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {/* Summary */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
              {[
                { l:"\uD83C\uDF08 Complete Rainbows", v:completedRainbows, c:"#4ade80" },
                { l:"\uD83D\uDD36 In Progress",       v:partialRainbows,   c:"#FBBF24" },
                { l:"\u2B1C Not Started",        v:allHeroes.length-completedRainbows-partialRainbows, c:"#555" },
              ].map(({l,v,c})=>(
                <div key={l} style={{ background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, padding:"12px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:26, fontWeight:900, color:c }}>{v}</div>
                  <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Filter */}
            <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
              {/* Set selector -- dropdown */}
              {availableSets.length > 0 && (
                <select value={rainbowSetFilter} onChange={e=>setRainbowSetFilter(e.target.value)} style={{ ...S.inp, width:"auto", fontSize:11, padding:"5px 10px", cursor:"pointer" }}>
                  <option value="">{"\uD83C\uDF08 All Sets"}</option>
                  {availableSets.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              )}
              {[["all","All Heroes"],["complete","\uD83C\uDF08 Complete"],["partial","\uD83D\uDD36 In Progress"],["missing","\u2B1C Not Started"]].map(([v,l])=>(
                <button key={v} onClick={()=>setRainbowFilter(v)} style={{ background:rainbowFilter===v?"#1A1A2E":"transparent", color:rainbowFilter===v?"#E8317A":"#9CA3AF", border:`1.5px solid ${rainbowFilter===v?"#E8317A":"#333"}`, borderRadius:7, padding:"5px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
              ))}
              <span style={{ fontSize:11, color:"#555", marginLeft:4 }}>{visibleHeroes.length} heroes</span>
            </div>

            {/* Hero grid */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {visibleHeroes.map(({ hero, total, ownedCount, complete, bySets }) => {
                const pct = total > 0 ? Math.round(ownedCount/total*100) : 0;
                const isExpanded = expandedHero === hero;
                const heroCardList = cards.filter(c => c.hero === hero).sort((a,b) => {
                  // Sort by weapon then treatment
                  const WEAPONS = ["Fire","Ice","Steel","Brawl","Glow","Hex","Gum","Super","Alt","Metallic"];
                  const wa = WEAPONS.indexOf(a.weapon), wb = WEAPONS.indexOf(b.weapon);
                  if(wa !== wb) return wa - wb;
                  return (a.treatment||"").localeCompare(b.treatment||"");
                });
                return (
                  <div key={hero} style={{ background:"#111111", border:`1.5px solid ${complete?"#ffffff22":ownedCount>0?"#FBBF2422":"#1a1a1a"}`, borderRadius:10, overflow:"hidden" }}>
                    {/* Hero row -- click to expand */}
                    <div onClick={()=>setExpandedHero(isExpanded ? null : hero)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: Object.keys(bySets).length > 1 && !rainbowSetFilter ? 6 : 8 }}>
                          <span style={{ fontSize:13, fontWeight:800, color:complete?"#F0F0F0":ownedCount>0?"#F0F0F0":"#555" }}>
                            {complete && "\uD83C\uDF08 "}{hero}
                          </span>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:complete?"#4ade80":ownedCount>0?"#FBBF24":"#555" }}>
                              {ownedCount}/{total} cards{complete ? " -- RAINBOW! \uD83C\uDF08" : ""}
                            </span>
                            <span style={{ color:"#444", fontSize:12 }}>{isExpanded?"\u25B2":"\u25BC"}</span>
                          </div>
                        </div>
                        {/* Per-set mini progress when on All Sets and hero spans multiple sets */}
                        {!rainbowSetFilter && Object.keys(bySets).length > 1 && (
                          <div style={{ display:"flex", gap:6, marginBottom:6, flexWrap:"wrap" }}>
                            {Object.entries(bySets).map(([setName, sd]) => {
                              const sp = Math.round(sd.owned/sd.total*100);
                              const sc = sd.owned===sd.total?"#4ade80":sd.owned>0?"#FBBF24":"#555";
                              return (
                                <div key={setName} style={{ display:"flex", alignItems:"center", gap:4, background:"#1a1a1a", borderRadius:5, padding:"2px 8px" }}>
                                  <span style={{ fontSize:10, color:"#555" }}>{setName}:</span>
                                  <span style={{ fontSize:10, fontWeight:700, color:sc }}>{sd.owned}/{sd.total}</span>
                                  {sd.owned===sd.total && <span style={{ fontSize:10 }}>{"\uD83C\uDF08"}</span>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {/* Rainbow progress bar */}
                        <div style={{ height:6, background:"#1a1a1a", borderRadius:3, overflow:"hidden" }}>
                          <div style={{
                            width:`${pct}%`, height:"100%", borderRadius:3, transition:"width 0.3s",
                            background: complete
                              ? "linear-gradient(90deg,#F97316,#FBBF24,#4ade80,#60A5FA,#A855F7,#F472B6,#EF4444,#F97316)"
                              : pct > 50 ? "linear-gradient(90deg,#E8317A,#7B2FF7)" : "#E8317A"
                          }}/>
                        </div>
                      </div>
                    </div>

                    {/* Expanded -- fan out all cards */}
                    {isExpanded && (
                      <div style={{ borderTop:"1px solid #1a1a1a", padding:"12px 14px", background:"#0a0a0a" }}>
                        <div style={{ display:"flex", gap:4, marginBottom:10 }}>
                          {[["all","All"],["owned","\u2705 Have"],["missing","\u274C Missing"]].map(([v,l])=>(
                            <button key={v} onClick={e=>{ e.stopPropagation(); setTreatOwnedFilter(v); }} style={{ background:treatOwnedFilter===v?"#1A1A2E":"transparent", color:treatOwnedFilter===v?"#E8317A":"#9CA3AF", border:`1.5px solid ${treatOwnedFilter===v?"#E8317A":"#333"}`, borderRadius:7, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                          ))}
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:6 }}>
                          {heroCardList.filter(c => treatOwnedFilter==="owned" ? owned[c.id] : treatOwnedFilter==="missing" ? !owned[c.id] : true).map(c => {
                            const isOwned = !!owned[c.id];
                            return <BobaCard key={c.id} c={c} isOwned={isOwned} ownedQty={owned[c.id]||0} flippedCard={flippedCard} setFlippedCard={setFlippedCard} toggleOwned={toggleOwned} setOwnedQty={setOwnedQty} toggleWant={toggleWant} wantList={wantList} WEAPON_COLORS={WEAPON_COLORS}/>;
                          })}
                        </div>
                        {/* Toggle all for hero */}
                        <div style={{ marginTop:10, display:"flex", gap:8 }}>
                          <button onClick={async e=>{ e.stopPropagation(); const next={...owned}; heroCardList.forEach(c=>next[c.id]=1); setOwned(next); await setDoc(doc(db,"boba_owned",ownedDocId),next); }} style={{ background:"#0a1a0a", border:"1px solid #4ade8044", color:"#4ade80", borderRadius:7, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\u2705 Mark All Owned"}</button>
                          <button onClick={async e=>{ e.stopPropagation(); const next={...owned}; heroCardList.forEach(c=>delete next[c.id]); setOwned(next); await setDoc(doc(db,"boba_owned",ownedDocId),next); }} style={{ background:"#1a0a0a", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:7, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\u2715 Clear All"}</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Treatments View */}
      {viewMode === "treatments" && !loading && cards.length > 0 && (() => {
        // Group filtered cards by treatment
        const treatmentMap = {};
        filtered.forEach(c => {
          const t = c.treatment || "Uncategorized";
          if(!treatmentMap[t]) treatmentMap[t] = [];
          treatmentMap[t].push(c);
        });
        const treatmentList = Object.entries(treatmentMap)
          .map(([t, tcards]) => {
            const ownedCount = tcards.filter(c => owned[c.id]).length;
            const pct = Math.round(ownedCount / tcards.length * 100);
            const complete = ownedCount === tcards.length;
            return { treatment:t, tcards, ownedCount, pct, complete };
          })
          .sort((a,b) => b.pct - a.pct || a.treatment.localeCompare(b.treatment));

        return (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
              <span style={{ fontSize:11, color:"#555" }}>{treatmentList.length} treatments &middot; respects active filters</span>
              <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
                {[["all","All"],["owned","\u2705 Have"],["missing","\u274C Missing"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setTreatOwnedFilter(v)} style={{ background:treatOwnedFilter===v?"#1A1A2E":"transparent", color:treatOwnedFilter===v?"#E8317A":"#9CA3AF", border:`1.5px solid ${treatOwnedFilter===v?"#E8317A":"#333"}`, borderRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
            </div>
            {treatmentList.map(({ treatment, tcards, ownedCount, pct, complete }) => {
              const isExp = expandedTreat === treatment;
              // Filter expanded cards by owned status
              const visibleTcards = treatOwnedFilter === "owned" ? tcards.filter(c=>owned[c.id]) : treatOwnedFilter === "missing" ? tcards.filter(c=>!owned[c.id]) : tcards;
              return (
                <div key={treatment} style={{ background:"#111111", border:`1.5px solid ${complete?"#ffffff22":pct>0?"#FBBF2422":"#1a1a1a"}`, borderRadius:10, overflow:"hidden" }}>
                  {/* Treatment header row */}
                  <div onClick={()=>setExpandedTreat(isExp ? null : treatment)} style={{ padding:"12px 14px", cursor:"pointer", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <span style={{ fontSize:13, fontWeight:800, color:complete?"#F0F0F0":pct>0?"#F0F0F0":"#555" }}>
                          {complete && "\u2705 "}{treatment}
                        </span>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:11, fontWeight:700, color:complete?"#4ade80":pct>0?"#FBBF24":"#555" }}>
                            {ownedCount}/{tcards.length} &middot; {pct}%
                          </span>
                          <span style={{ color:"#444", fontSize:12 }}>{isExp?"\u25B2":"\u25BC"}</span>
                        </div>
                      </div>
                      <div style={{ height:6, background:"#1a1a1a", borderRadius:3, overflow:"hidden" }}>
                        <div style={{
                          width:`${pct}%`, height:"100%", borderRadius:3, transition:"width 0.3s",
                          background: "linear-gradient(90deg,#F97316,#FBBF24,#4ade80,#60A5FA,#A855F7,#F472B6,#EF4444,#F97316)"
                        }}/>
                      </div>
                    </div>
                  </div>
                  {/* Expanded cards */}
                  {isExp && (
                    <div style={{ borderTop:"1px solid #1a1a1a", padding:"12px 14px", background:"#0a0a0a" }}>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:6 }}>
                        {visibleTcards.sort((a,b)=>String(a.cardNum).localeCompare(String(b.cardNum),undefined,{numeric:true})).map(c => {
                          const isOwned = !!owned[c.id];
                          return <BobaCard key={c.id} c={c} isOwned={isOwned} ownedQty={owned[c.id]||0} flippedCard={flippedCard} setFlippedCard={setFlippedCard} toggleOwned={toggleOwned} setOwnedQty={setOwnedQty} toggleWant={toggleWant} wantList={wantList} WEAPON_COLORS={WEAPON_COLORS}/>;
                        })}
                      </div>
                      <div style={{ marginTop:10, display:"flex", gap:8 }}>
                        <button onClick={async e=>{ e.stopPropagation(); const next={...owned}; tcards.forEach(c=>next[c.id]=true); setOwned(next); await setDoc(doc(db,"boba_owned",ownedDocId),next); }} style={{ background:"#0a1a0a", border:"1px solid #4ade8044", color:"#4ade80", borderRadius:7, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\u2705 Mark All Owned"}</button>
                        <button onClick={async e=>{ e.stopPropagation(); const next={...owned}; tcards.forEach(c=>delete next[c.id]); setOwned(next); await setDoc(doc(db,"boba_owned",ownedDocId),next); }} style={{ background:"#1a0a0a", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:7, padding:"4px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\u2715 Clear All"}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Card grid */}
      {/* Stats View */}
      {viewMode === "stats" && !loading && cards.length > 0 && (() => {
        const haveList = cards.filter(c => (owned[c.id]||0) > 1);
        const missingCards = cards.filter(c => !owned[c.id]);

        // By treatment
        const byTreat = {};
        cards.forEach(c => {
          const t = c.treatment || "Uncategorized";
          if(!byTreat[t]) byTreat[t] = { total:0, owned:0 };
          byTreat[t].total++;
          if(owned[c.id]) byTreat[t].owned++;
        });
        const treatStats = Object.entries(byTreat)
          .map(([t,s]) => ({ t, ...s, pct:Math.round(s.owned/s.total*100), missing:s.total-s.owned }))
          .sort((a,b) => b.pct-a.pct);

        // By weapon
        const byWeapon = {};
        cards.forEach(c => {
          const w = c.weapon || "Unknown";
          if(!byWeapon[w]) byWeapon[w] = { total:0, owned:0 };
          byWeapon[w].total++;
          if(owned[c.id]) byWeapon[w].owned++;
        });
        const weaponStats = Object.entries(byWeapon)
          .map(([w,s]) => ({ w, ...s, pct:Math.round(s.owned/s.total*100) }))
          .sort((a,b) => b.pct-a.pct);

        // Per-set weapon stats (built separately so we can filter)
        const weaponFilteredCards = weaponSetFilter ? cards.filter(c => c.setName === weaponSetFilter) : cards;
        const byWeaponFiltered = {};
        weaponFilteredCards.forEach(c => {
          const w = c.weapon || "Unknown";
          if(!byWeaponFiltered[w]) byWeaponFiltered[w] = { total:0, owned:0 };
          byWeaponFiltered[w].total++;
          if(owned[c.id]) byWeaponFiltered[w].owned++;
        });
        const weaponStatsFiltered = Object.entries(byWeaponFiltered)
          .map(([w,s]) => ({ w, ...s, pct:Math.round(s.owned/s.total*100) }))
          .sort((a,b) => b.pct-a.pct);
        const availSets = [...new Set(cards.map(c=>c.setName).filter(Boolean))].sort();

        // Heroes with zero cards
        const heroZero = [...new Set(cards.map(c=>c.hero))].filter(h => !cards.some(c=>c.hero===h && owned[c.id])).length;
        // Heroes complete
        const heroComplete = [...new Set(cards.map(c=>c.hero))].filter(h => cards.filter(c=>c.hero===h).every(c=>owned[c.id])).length;
        // Collection value estimate (power as proxy -- not real $)
        const collectionPower = cards.filter(c=>owned[c.id]).reduce((s,c)=>s+(parseFloat(c.power)||0)*( owned[c.id]||1),0);

        return (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {/* Summary cards */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:8 }}>
              {[
                { label:"Unique Owned", value:totalOwned.toLocaleString(), color:"#4ade80" },
                { label:"Total Copies", value:totalCollection.toLocaleString(), color:"#7B9CFF" },
                { label:"Still Missing", value:missingCards.length.toLocaleString(), color:"#E8317A" },
                { label:"Tradeable Extras", value:haveList.length.toLocaleString(), color:"#FBBF24" },
                { label:"Heroes Complete", value:heroComplete, color:"#4ade80" },
                { label:"Heroes Not Started", value:heroZero, color:"#555" },
                { label:"On Want List", value:Object.keys(wantList).length, color:"#FBBF24" },
                { label:"Overall %", value:`${pct}%`, color:pct>75?"#4ade80":pct>40?"#FBBF24":"#E8317A" },
              ].map(({label,value,color})=>(
                <div key={label} style={{ background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, padding:"12px 14px" }}>
                  <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>{label}</div>
                  <div style={{ fontSize:22, fontWeight:900, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Completion by Treatment */}
            <div style={{ ...S.card }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0", marginBottom:10 }}>Completion by Treatment</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {treatStats.map(({t,total,owned:o,pct:p,missing})=>(
                  <div key={t} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:11, color:p===100?"#4ade80":"#AAAAAA", minWidth:200, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p===100?"\uD83C\uDF08 ":""}{t}</span>
                    <div style={{ flex:1, height:5, background:"#1a1a1a", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${p}%`, height:"100%", borderRadius:3, background:p===100?"linear-gradient(90deg,#F97316,#FBBF24,#4ade80,#60A5FA,#A855F7,#F472B6)":p>50?"#4ade80":"linear-gradient(90deg,#E8317A,#7B2FF7)" }}/>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:p===100?"#4ade80":p>0?"#FBBF24":"#555", minWidth:80, textAlign:"right" }}>{o}/{total} ({p}%)</span>
                    {missing > 0 && <span style={{ fontSize:10, color:"#E8317A", minWidth:60, textAlign:"right" }}>-{missing}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Completion by Weapon */}
            <div style={{ ...S.card }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:8 }}>
                <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0" }}>Completion by Weapon</div>
                {availSets.length > 1 && (
                  <select value={weaponSetFilter} onChange={e=>setWeaponSetFilter(e.target.value)} style={{ ...S.inp, width:"auto", fontSize:11, padding:"4px 10px", cursor:"pointer" }}>
                    <option value="">All Sets</option>
                    {availSets.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }} className="boba-card-grid">
                {weaponStatsFiltered.map(({w,total,owned:o,pct:p})=>{
                  const wc = WEAPON_COLORS[w]||"#444";
                  return (
                    <div key={w} style={{ background:"#0a0a0a", borderRadius:8, padding:"10px 12px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:wc }}>{w}</span>
                        <span style={{ fontSize:11, color:p===100?"#4ade80":p>0?"#FBBF24":"#555", fontWeight:700 }}>{o}/{total}</span>
                      </div>
                      <div style={{ height:4, background:"#1a1a1a", borderRadius:2, overflow:"hidden" }}>
                        <div style={{ width:`${p}%`, height:"100%", background:wc, borderRadius:2 }}/>
                      </div>
                      <div style={{ fontSize:10, color:"#555", marginTop:4, textAlign:"right" }}>{p}%</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Tradeable extras */}
            {haveList.length > 0 && (
              <div style={{ ...S.card }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0" }}>{"\uD83D\uDD04 Tradeable Extras ("}{haveList.length} cards)</div>
                  <button onClick={exportHaveList} style={{ background:"#0a1a0a", border:"1px solid #4ade8044", color:"#4ade80", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDCE4 Export Have List"}</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:6 }}>
                  {haveList.sort((a,b)=>(owned[b.id]||0)-(owned[a.id]||0)).map(c=>{
                    const wc2 = WEAPON_COLORS[c.weapon]||"#444";
                    return (
                      <div key={c.id} style={{ background:"#0a1a0a", border:"1px solid #4ade8022", borderRadius:8, padding:"8px 12px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                        <div>
                          <div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0" }}>{c.hero}</div>
                          <div style={{ fontSize:10, color:"#555" }}>#{c.cardNum} &middot; <span style={{color:wc2}}>{c.weapon}</span></div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:14, fontWeight:900, color:"#4ade80" }}>{"\u00D7"}{owned[c.id]||0}</div>
                          <div style={{ fontSize:10, color:"#FBBF24" }}>+{(owned[c.id]||0)-1} extra</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Wants View */}
      {viewMode === "wants" && !loading && (() => {
        const wantedCards = cards.filter(c => wantList[c.id] && !owned[c.id]);
        const wantedOwned = cards.filter(c => wantList[c.id] && owned[c.id]);
        return (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0" }}>{"\uD83C\uDFAF Want List --"}{Object.keys(wantList).length} cards flagged</div>
              <div style={{ display:"flex", gap:8 }}>
                {wantedCards.length > 0 && <button onClick={exportWantList} style={{ background:"#1a0f00", border:"1px solid #FBBF2444", color:"#FBBF24", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDCE4 Export Want List"}</button>}
              </div>
            </div>
            {wantedCards.length === 0 && wantedOwned.length === 0 && (
              <div style={{ ...S.card, color:"#555", fontSize:13, textAlign:"center", padding:32 }}>
                No cards on your want list yet. Click "+ Want" on any card to add it here.
              </div>
            )}
            {wantedCards.length > 0 && (
              <div style={{ ...S.card }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#FBBF24", marginBottom:8 }}>{"\uD83C\uDFAF Still Need ("}{wantedCards.length})</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:6 }}>
                  {wantedCards.map(c => {
                    const isOwned2 = !!owned[c.id];
                    return <BobaCard key={c.id} c={c} isOwned={isOwned2} ownedQty={owned[c.id]||0} flippedCard={flippedCard} setFlippedCard={setFlippedCard} toggleOwned={toggleOwned} setOwnedQty={setOwnedQty} toggleWant={toggleWant} wantList={wantList} WEAPON_COLORS={WEAPON_COLORS}/>;
                  })}
                </div>
              </div>
            )}
            {wantedOwned.length > 0 && (
              <div style={{ ...S.card }}>
                <div style={{ fontSize:12, fontWeight:700, color:"#4ade80", marginBottom:8 }}>{"\u2705 Got It! ("}{wantedOwned.length})</div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:6 }}>
                  {wantedOwned.map(c => {
                    const isOwned2 = !!owned[c.id];
                    return <BobaCard key={c.id} c={c} isOwned={isOwned2} ownedQty={owned[c.id]||0} flippedCard={flippedCard} setFlippedCard={setFlippedCard} toggleOwned={toggleOwned} setOwnedQty={setOwnedQty} toggleWant={toggleWant} wantList={wantList} WEAPON_COLORS={WEAPON_COLORS}/>;
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })()}


      {viewMode === "deck" && (() => {
        const ownedSet = new Set(Object.keys(owned));
        const deckSet  = new Set(deckCards);
        const inDeck   = cards.filter(c => deckSet.has(c.id));
        const empty    = DECK_SIZE - inDeck.length;

        // -- Deck rules --
        const isSpec        = deckType === "spec";
        const isApex        = deckType === "apex";
        const isApexMadness = deckType === "apexmadness";
        const hasRules      = isSpec || isApex || isApexMadness;

        // Duplicate check: same hero + variation + power + weapon = duplicate
        const dupKey = c => `${(c.hero||"").toLowerCase()}|${(c.variation||"").toLowerCase()}|${c.power||""}|${(c.weapon||"").toLowerCase()}`;
        const inDeckDupKeys = new Set(inDeck.map(dupKey));

        // Power level count: how many cards at each power value
        const powerCount = {};
        inDeck.forEach(c => { const p = c.power||"0"; powerCount[p] = (powerCount[p]||0)+1; });

        // Treatment count: how many 115-160 cards per treatment (for Apex Madness unlock)
        const treatCountCore = {};   // treatment - count of 115-160 cards in deck
        const treatCountApex = {};   // treatment - count of >160 cards in deck
        if (isApexMadness) {
          inDeck.forEach(c => {
            const t = (c.treatment||"Unknown").toLowerCase();
            const p = parseFloat(c.power||0);
            if (p >= 115 && p <= 160) treatCountCore[t] = (treatCountCore[t]||0) + 1;
            if (p > 160)              treatCountApex[t]  = (treatCountApex[t]||0)  + 1;
          });
        }

        // Validation errors for cards already in deck
        const deckViolations = hasRules ? inDeck.filter(c => {
          if ((isSpec || isApexMadness) && parseFloat(c.power||0) > 160) {
            // Apex Madness: >160 allowed only if treatment has 10 core cards
            if (isApexMadness) {
              const t = (c.treatment||"Unknown").toLowerCase();
              if ((treatCountCore[t]||0) < 10) return true;
            } else {
              return true;
            }
          }
          if ((powerCount[c.power||"0"]||0) > 6) return true;
          return false;
        }) : [];

        // Can a card be added?
        function canAdd(c) {
          if (deckSet.has(c.id)) return { ok:false, reason:"Already in deck" };
          if (inDeck.length >= DECK_SIZE) return { ok:false, reason:"Deck full" };
          if (hasRules && inDeckDupKeys.has(dupKey(c))) return { ok:false, reason:"Duplicate (same hero, pose, power & weapon)" };
          if (hasRules && (powerCount[c.power||"0"]||0) >= 6) return { ok:false, reason:`Already 6 cards at power ${c.power}` };
          const p = parseFloat(c.power||0);
          if (isSpec && p > 160) return { ok:false, reason:`Power ${c.power} exceeds 160 limit` };
          if (isApexMadness && p > 160) {
            const t = (c.treatment||"Unknown").toLowerCase();
            const coreCount = (treatCountCore[t]||0);
            if (coreCount < 10) return { ok:false, reason:`Need 10 core ${c.treatment} cards first (have ${coreCount}/10)` };
            const apexCount = (treatCountApex[t]||0);
            if (apexCount >= 1) return { ok:false, reason:`Already have 1 unlocked ${c.treatment} apex card` };
          }
          return { ok:true };
        }

        // Stats
        const totalPower  = inDeck.reduce((s,c)=>s+(parseFloat(c.power)||0),0);
        const weaponBreak = {};
        const heroCover   = new Set();
        inDeck.forEach(c => {
          const w = c.weapon||"Unknown";
          weaponBreak[w] = (weaponBreak[w]||0) + 1;
          if(c.hero) heroCover.add(c.hero);
        });
        const weaponEntries = Object.entries(weaponBreak).sort((a,b)=>b[1]-a[1]);

        // Card pool: all cards or owned only -- exclude plays (PL/BPL)
        const cardPool = (deckOwnedOnly ? cards.filter(c => ownedSet.has(c.id)) : cards)
          .filter(c => { const t=(c.treatment||"").toLowerCase(); return t!=="plays"&&t!=="bonus plays"&&t!=="home team discount"; });

        // Available cards to add
        const available = cardPool.filter(c => {
          if (deckSet.has(c.id)) return false;
          if (deckFilterWeap && c.weapon !== deckFilterWeap) return false;
          if (deckFilterHero && c.hero !== deckFilterHero) return false;
          if (deckFilterPowers.size > 0 && !deckFilterPowers.has(String(c.power||""))) return false;
          if (deckFilterSet && c.setName !== deckFilterSet) return false;
          if (deckFilterTreat && c.treatment !== deckFilterTreat) return false;
          if (deckSearch && !`${c.hero} ${c.cardNum} ${c.treatment}`.toLowerCase().includes(deckSearch.toLowerCase())) return false;
          return true;
        }).sort((a,b) => (parseFloat(b.power)||0)-(parseFloat(a.power)||0));

        const deckPowers   = [...new Set(cardPool.map(c=>c.power).filter(Boolean))].sort((a,b)=>parseFloat(b)-parseFloat(a));
        const deckSets     = [...new Set(cardPool.map(c=>c.setName).filter(Boolean))].sort();
        const deckTreats   = [...new Set(cardPool.map(c=>c.treatment).filter(Boolean))].sort();
        const deckHeroes   = [...new Set(cardPool.map(c=>c.hero).filter(Boolean))].sort();
        const deckWeapons  = [...new Set(cardPool.map(c=>c.weapon).filter(Boolean))].sort();

        return (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Header */}
            <div style={{ ...S.card, padding:"12px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <input value={deckName} onChange={e=>setDeckName(e.target.value)}
                  style={{ ...S.inp, fontSize:15, fontWeight:800, flex:1, minWidth:180 }}
                  placeholder="Deck name..."/>
                <select value={deckType} onChange={e=>setDeckType(e.target.value)}
                  style={{ ...S.inp, width:"auto", fontWeight:700, cursor:"pointer",
                    color: deckType==="spec"?"#FBBF24": deckType==="apex"?"#A855F7": deckType==="apexmadness"?"#E8317A":"#888" }}>
                  <option value="none">No Restrictions</option>
                  <option value="spec">{"Spec Deck (\u2264160 power)"}</option>
                  <option value="apex">Apex Deck (no power limit)</option>
                  <option value="apexmadness">Apex Madness</option>
                </select>
                <span style={{ fontSize:12, color: inDeck.length===DECK_SIZE?"#4ade80":inDeck.length>DECK_SIZE?"#E8317A":"#FBBF24", fontWeight:700 }}>
                  {inDeck.length}/{DECK_SIZE} cards
                </span>
                <button onClick={saveDeck} disabled={deckSaving||deckCards.length===0}
                  style={{ background:"#0a1a0a", border:"1px solid #4ade8044", color:"#4ade80", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {deckSaving?"Saving...":"\uD83D\uDCBE Save Deck"}
                </button>
                <button onClick={newDeck}
                  style={{ background:"transparent", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  + New Deck
                </button>
              </div>

              {/* Saved decks */}
              {savedDecks.length > 0 && (
                <div style={{ marginTop:10, display:"flex", gap:6, flexWrap:"wrap" }}>
                  {savedDecks.map(d=>(
                    <div key={d.id} style={{ display:"flex", alignItems:"center", gap:4, background:deckLoadId===d.id?"#1A1A2E":"#1a1a1a", border:`1px solid ${deckLoadId===d.id?"#7B9CFF":"#2a2a2a"}`, borderRadius:8, padding:"4px 10px" }}>
                      <button onClick={()=>loadDeck(d)} style={{ background:"none", border:"none", color:deckLoadId===d.id?"#7B9CFF":"#888", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                        {d.name} <span style={{ color:"#555", fontWeight:400 }}>({d.cardCount})</span>
                      </button>
                      <button onClick={()=>deleteDeck(d.id)} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:13, lineHeight:1, padding:"0 2px" }}>{"\u00D7"}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) clamp(280px,30%,360px)", gap:14, alignItems:"start" }}>

              {/* LEFT: Card picker */}
              <div style={{ display:"flex", flexDirection:"column", gap:10, minHeight:0 }}>
                {/* Filters */}
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                  {/* Owned only toggle */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, background:"#1a1a1a", border:`1px solid ${deckOwnedOnly?"#4ade80":"#2a2a2a"}`, borderRadius:8, padding:"5px 10px", cursor:"pointer" }}
                    onClick={()=>setDeckOwnedOnly(p=>!p)}>
                    <div style={{ width:28, height:16, borderRadius:8, background:deckOwnedOnly?"#4ade80":"#333", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:2, left:deckOwnedOnly?12:2, width:12, height:12, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:deckOwnedOnly?"#4ade80":"#666", whiteSpace:"nowrap" }}>
                      {deckOwnedOnly?"\u2705 Owned Only":"All Cards"}
                    </span>
                  </div>
                  <input value={deckSearch} onChange={e=>setDeckSearch(e.target.value)}
                    placeholder="Search hero, card #, treatment..."
                    style={{ ...S.inp, flex:1, minWidth:160 }}/>
                  <select value={deckFilterWeap} onChange={e=>setDeckFilterWeap(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                    <option value="">All Weapons</option>
                    {deckWeapons.map(w=><option key={w} value={w}>{w}</option>)}
                  </select>
                  <select value={deckFilterSet} onChange={e=>setDeckFilterSet(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer", color:deckFilterSet?"#7B9CFF":"#888" }}>
                    <option value="">All Sets</option>
                    {deckSets.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={deckFilterTreat} onChange={e=>setDeckFilterTreat(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer", color:deckFilterTreat?"#FBBF24":"#888" }}>
                    <option value="">All Treatments</option>
                    {deckTreats.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={deckFilterHero} onChange={e=>setDeckFilterHero(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                    <option value="">All Heroes</option>
                    {deckHeroes.map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                  <span style={{ fontSize:11, color:"#555" }}>{available.length} available</span>
                </div>
                {/* Multi-select power chips */}
                <div style={{ display:"flex", gap:6, flexWrap:"wrap", paddingBottom:6 }}>
                  {deckPowers.map(p => {
                    const sel = deckFilterPowers.has(p);
                    const over = (isSpec||isApexMadness) && parseFloat(p)>160;
                    return (
                      <button key={p} onClick={()=>{
                        setDeckFilterPowers(prev => {
                          const next = new Set(prev);
                          if (next.has(p)) next.delete(p); else next.add(p);
                          return next;
                        });
                      }} style={{ background:sel?(over?"#E8317A":"#FBBF2433"):"#111", border:`1px solid ${sel?(over?"#E8317A":"#FBBF24"):"#2a2a2a"}`, color:sel?(over?"#E8317A":"#FBBF24"):"#555", borderRadius:6, padding:"3px 9px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                        {p}{over?" \u26A0":""}
                      </button>
                    );
                  })}
                  {deckFilterPowers.size > 0 && (
                    <button onClick={()=>setDeckFilterPowers(new Set())} style={{ background:"transparent", border:"1px solid #333", color:"#555", borderRadius:6, padding:"3px 9px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\u2715 Clear"}</button>
                  )}
                </div>

                {/* Available cards list */}
                <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:10, overflow:"hidden", minHeight:300, maxHeight:"calc(100vh - 280px)", overflowY:"auto" }}>
                  {available.length === 0 ? (
                    <div style={{ padding:"32px", textAlign:"center", color:"#333", fontSize:13 }}>
                      {Object.keys(owned).length === 0 ? "No owned cards -- mark cards as owned in the Checklist first" : "No cards match your filters"}
                    </div>
                  ) : available.map((c,i) => {
                    const wc = WEAPON_COLORS[c.weapon]||"#444";
                    const full = inDeck.length >= DECK_SIZE;
                    return (
                      (() => {
                        const { ok, reason } = canAdd(c);
                        return (
                          <div key={c.id} onClick={()=>{ if(ok) setDeckCards(p=>[...p,c.id]); }}
                            style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px", borderBottom:"1px solid #111", background:i%2===0?"#0a0a0a":"#0d0d0d", cursor:ok?"pointer":"not-allowed", opacity:ok?1:0.35 }}
                            className="inv-row"
                            title={!ok?reason:""}>
                            {c.imageUrl && <img src={c.imageUrl} alt={c.hero} style={{ width:36, height:48, objectFit:"cover", borderRadius:4, flexShrink:0 }}/>}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0", lineHeight:1.2 }}>{c.hero}</div>
                              <div style={{ display:"flex", gap:6, marginTop:3, flexWrap:"wrap" }}>
                                <span style={{ fontSize:10, color:"#555" }}>#{c.cardNum}</span>
                                {c.weapon && <span style={{ fontSize:10, color:wc, fontWeight:700 }}>{c.weapon}</span>}
                                {c.treatment && <span style={{ fontSize:10, color:"#555" }}>{c.treatment}</span>}
                                {!deckOwnedOnly && (
                                  <span style={{ fontSize:10, fontWeight:700, color:ownedSet.has(c.id)?"#4ade80":"#333" }}>
                                    {ownedSet.has(c.id)?"\u2713 owned":"not owned"}
                                  </span>
                                )}
                                {!ok && reason && <span style={{ fontSize:10, color:"#E8317A" }}>{reason}</span>}
                              </div>
                            </div>
                            {c.power && <div style={{ fontSize:16, fontWeight:900, color: isSpec&&parseFloat(c.power)>160?"#E8317A":wc, flexShrink:0 }}>{c.power}</div>}
                            {ok && <div style={{ fontSize:18, color:"#4ade80", flexShrink:0 }}>+</div>}
                          </div>
                        );
                      })()
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Deck + stats */}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

                  <div style={{ ...S.card }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0", marginBottom:10 }}>{"\u2694\uFE0F Deck Stats"}{deckType !== "none" && <span style={{ marginLeft:8, fontSize:10, color:deckType==="spec"?"#FBBF24":deckType==="apexmadness"?"#E8317A":"#A855F7", fontWeight:700 }}>
                      {deckType==="spec"?"SPEC":deckType==="apexmadness"?"APEX MADNESS":"APEX"}
                    </span>}
                  </div>
                  {/* Rule violations */}
                  {deckViolations.length > 0 && (
                    <div style={{ background:"#1a0a0a", border:"1px solid #E8317A44", borderRadius:8, padding:"8px 10px", marginBottom:10 }}>
                      <div style={{ fontSize:10, color:"#E8317A", fontWeight:700, marginBottom:4 }}>{"\u26A0\uFE0F"}{deckViolations.length} Rule Violation{deckViolations.length!==1?"s":""}</div>
                      {deckViolations.slice(0,3).map(c=>(
                        <div key={c.id} style={{ fontSize:10, color:"#888" }}>{"\u2022"}{c.hero} #{c.cardNum} ({c.power})</div>
                      ))}
                      {deckViolations.length > 3 && <div style={{ fontSize:10, color:"#555" }}>...and {deckViolations.length-3} more</div>}
                    </div>
                  )}
                  {/* Rules summary */}
                  {hasRules && (
                    <div style={{ background:"#0a0a0a", border:"1px solid #2a2a2a", borderRadius:8, padding:"8px 10px", marginBottom:10, fontSize:10, color:"#555", lineHeight:1.8 }}>
                      {isSpec        && <div style={{ color:"#FBBF24" }}>{"\u26A1 Max power: 160"}</div>}
                      {isApexMadness && <div style={{ color:"#A855F7" }}>{"\u26A1 Core deck: 115-160 power only"}</div>}
                      {isApexMadness && <div style={{ color:"#A855F7" }}>{"\u26A1 10 core cards per treatment unlocks 1 apex card (&gt;160) of that treatment"}</div>}
                      <div>{"\u26A1 No duplicates (same hero + pose + power + weapon)"}</div>
                      <div>{"\u26A1 Max 6 cards per power level"}</div>
                    </div>
                  )}

                  {/* Apex Madness treatment unlock tracker */}
                  {isApexMadness && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, color:"#A855F7", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Treatment Unlocks</div>
                      {(() => {
                        const allTreats = [...new Set(inDeck.map(c=>(c.treatment||"Unknown")))].sort();
                        if (allTreats.length === 0) return <div style={{ fontSize:11, color:"#333" }}>Add cards to see unlock progress</div>;
                        return allTreats.map(t => {
                          const tl = t.toLowerCase();
                          const core  = treatCountCore[tl] || 0;
                          const apex  = treatCountApex[tl]  || 0;
                          const unlocked = core >= 10;
                          const pct = Math.min(100, Math.round(core / 10 * 100));
                          return (
                            <div key={t} style={{ marginBottom:8 }}>
                              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                                <span style={{ fontSize:11, color: unlocked ? "#A855F7" : "#888", fontWeight: unlocked ? 700 : 400 }}>
                                  {unlocked ? "\uD83D\uDD13" : "\uD83D\uDD12"} {t}
                                </span>
                                <span style={{ fontSize:11, color: unlocked ? "#A855F7" : "#555" }}>
                                  {core}/10 core{unlocked ? ` &middot; ${apex}/1 apex` : ""}
                                </span>
                              </div>
                              <div style={{ height:4, background:"#1a1a1a", borderRadius:2, overflow:"hidden" }}>
                                <div style={{ width:`${pct}%`, height:"100%", background: unlocked ? "#A855F7" : "#333", borderRadius:2, transition:"width 0.3s" }}/>
                              </div>
                            </div>
                          );
                        });
                      })()}
                      <div style={{ fontSize:10, color:"#333", marginTop:6 }}>
                        {Object.values(treatCountCore).filter(v=>v>=10).length} of {[...new Set(inDeck.map(c=>c.treatment).filter(Boolean))].length} treatments unlocked
                      </div>
                    </div>
                  )}
                  {/* Power level breakdown */}
                  {hasRules && Object.keys(powerCount).length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, color:"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Power Level Counts</div>
                      {Object.entries(powerCount).sort((a,b)=>parseFloat(b[0])-parseFloat(a[0])).map(([pwr,cnt])=>{
                        const over160 = parseFloat(pwr) > 160;
                        const bad = isSpec && over160;
                        return (
                          <div key={pwr} style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:2 }}>
                            <span style={{ color: bad ? "#E8317A" : over160 && isApexMadness ? "#A855F7" : "#888" }}>
                              Power {pwr}{over160 && isApexMadness ? " \uD83D\uDD13" : ""}
                            </span>
                            <span style={{ fontWeight:700, color: cnt>=6?"#E8317A":cnt>=4?"#FBBF24":"#4ade80" }}>{cnt}/6</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                    {[
                      { l:"Cards", v:`${inDeck.length}/${DECK_SIZE}`, c:inDeck.length===DECK_SIZE?"#4ade80":"#FBBF24" },
                      { l:"Total Power", v:Math.round(totalPower).toLocaleString(), c:"#E8317A" },
                      { l:"Heroes", v:heroCover.size, c:"#7B9CFF" },
                      { l:"Avg Power", v:inDeck.length>0?Math.round(totalPower/inDeck.length):0, c:"#FBBF24" },
                    ].map(({l,v,c})=>(
                      <div key={l} style={{ background:"#111", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                        <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</div>
                        <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l}</div>
                      </div>
                    ))}
                  </div>

                  {/* Weapon breakdown */}
                  {weaponEntries.length > 0 && (
                    <div style={{ marginBottom:10 }}>
                      <div style={{ fontSize:10, color:"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Weapon Balance</div>
                      {weaponEntries.map(([w,count])=>{
                        const wc = WEAPON_COLORS[w]||"#444";
                        const pct = Math.round(count/inDeck.length*100);
                        return (
                          <div key={w} style={{ marginBottom:5 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                              <span style={{ fontSize:11, color:wc, fontWeight:700 }}>{w}</span>
                              <span style={{ fontSize:11, color:"#555" }}>{count} ({pct}%)</span>
                            </div>
                            <div style={{ height:4, background:"#1a1a1a", borderRadius:2, overflow:"hidden" }}>
                              <div style={{ width:`${pct}%`, height:"100%", background:wc, borderRadius:2 }}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Hero coverage */}
                  {heroCover.size > 0 && (
                    <div>
                      <div style={{ fontSize:10, color:"#555", fontWeight:700, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Heroes ({heroCover.size})</div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                        {[...heroCover].sort().map(h=>(
                          <span key={h} style={{ fontSize:10, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:5, padding:"2px 7px", color:"#888" }}>{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 60-slot grid */}
                <div style={{ ...S.card }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10, flexWrap:"wrap", gap:8 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0" }}>
                      Deck Slots -- {empty > 0 ? <span style={{ color:"#FBBF24" }}>{empty} empty</span> : <span style={{ color:"#4ade80" }}>{"Full! \u2705"}</span>}
                    </div>
                    <select value={deckSlotSort} onChange={e=>setDeckSlotSort(e.target.value)}
                      style={{ ...S.inp, width:"auto", fontSize:10, padding:"3px 8px", cursor:"pointer" }}>
                      <option value="added">Order Added</option>
                      <option value="power">{"Power \u2193"}</option>
                      <option value="name">{"Name A\u2192Z"}</option>
                      <option value="weapon">Weapon</option>
                    </select>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:4 }}>
                    {(() => {
                      const sorted = [...inDeck].sort((a,b) => {
                        if (deckSlotSort === "power")  return (parseFloat(b.power)||0)-(parseFloat(a.power)||0);
                        if (deckSlotSort === "name")   return (a.hero||"").localeCompare(b.hero||"");
                        if (deckSlotSort === "weapon") return (a.weapon||"").localeCompare(b.weapon||"");
                        return 0; // "added" = natural order
                      });
                      return Array.from({ length: DECK_SIZE }).map((_,i) => {
                        const c = sorted[i];
                      if (c) {
                        const wc = WEAPON_COLORS[c.weapon]||"#444";
                        return (
                          <div key={i} title={`${c.hero} -- ${c.weapon||""} ${c.power||""}`}
                            onClick={()=>setDeckCards(p=>p.filter(id=>id!==c.id))}
                            style={{ aspectRatio:"3/4", borderRadius:4, overflow:"hidden", position:"relative", cursor:"pointer", border:`1.5px solid ${wc}44`, background:"#1a1a1a" }}>
                            {c.imageUrl
                              ? <img src={c.imageUrl} alt={c.hero} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}/>
                              : <div style={{ width:"100%", height:"100%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:7, color:wc, fontWeight:700, textAlign:"center", padding:2, lineHeight:1.2 }}>{c.hero?.split(" ")[0]}</div>
                            }
                            <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0)", transition:"background 0.15s" }} className="deck-slot-hover"/>
                          </div>
                        );
                      }
                      return (
                        <div key={i} style={{ aspectRatio:"3/4", borderRadius:4, border:"1px dashed #1a1a1a", background:"#080808", display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <span style={{ fontSize:9, color:"#222", fontWeight:700 }}>{i+1}</span>
                        </div>
                      );
                    })})()}
                  </div>
                  {inDeck.length > 0 && (
                    <button onClick={()=>{ if(window.confirm("Clear all cards from deck?")) setDeckCards([]); }}
                      style={{ marginTop:10, background:"transparent", border:"1px solid #E8317A22", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
                      {"\u2715 Clear Deck"}</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {viewMode === "playbook" && (() => {
        const ownedSet  = new Set(Object.keys(owned));
        const pbEntryIds = new Set(pbCards.map(e=>e.id));
        const playCount  = pbCards.filter(e=>e.type==="play").length;
        const bonusCount = pbCards.filter(e=>e.type==="bonus").length;
        const playFull   = playCount >= PLAY_LIMIT;

        // DBS tracking -- cap applies to plays + BPL combined
        const pbResolvedAll = pbCards.map(e=>({ ...e, card: cards.find(c=>c.id===e.id) })).filter(e=>e.card);
        const totalDbs   = pbResolvedAll.reduce((s,e)=>s+(parseFloat(e.card.dbs)||0), 0);
        const dbsLeft    = DBS_CAP - totalDbs;
        const dbsPct     = Math.min(totalDbs / DBS_CAP * 100, 100);
        const dbsOver    = totalDbs > DBS_CAP;

        // All Play cards: PL-xxx = regular plays, BPL-xxx = bonus plays
        const allPlays = cards.filter(c => { const t=(c.treatment||"").toLowerCase(); return t==="plays"||t==="bonus plays"||t==="home team discount"; });
        const isPlay  = c => { const t=(c.treatment||"").toLowerCase(); return t==="plays"||t==="home team discount"; };
        const isBonus = c => (c.treatment||"").toLowerCase()==="bonus plays";
        const pbSets   = [...new Set(allPlays.map(c=>c.setName).filter(Boolean))].sort();
        const pbPool   = pbOwnedOnly ? allPlays.filter(c=>ownedSet.has(c.id)) : allPlays;
        const available = pbPool.filter(c => {
          if (pbEntryIds.has(c.id)) return false;
          if (pbFilterSet && c.setName !== pbFilterSet) return false;
          if (pbTreatFilter && (c.treatment||"").toLowerCase() !== pbTreatFilter.toLowerCase()) return false;
          if (pbSearch && !`${c.hero} ${c.cardNum} ${c.treatment} ${c.playAbility||""}`.toLowerCase().includes(pbSearch.toLowerCase())) return false;
          return true;
        }).sort((a,b) => {
          if (pbSort === "dbs_desc") return (parseFloat(b.dbs)||0) - (parseFloat(a.dbs)||0);
          if (pbSort === "dbs_asc")  return (parseFloat(a.dbs)||0) - (parseFloat(b.dbs)||0);
          return (a.hero||"").localeCompare(b.hero||"");
        });

        // Cards currently in playbook (resolved)
        const pbResolved = pbCards.map(e => ({ ...e, card: cards.find(c=>c.id===e.id) })).filter(e=>e.card);

        return (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

            {/* Header */}
            <div style={{ ...S.card, padding:"12px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                <input value={pbName} onChange={e=>setPbName(e.target.value)}
                  style={{ ...S.inp, fontSize:15, fontWeight:800, flex:1, minWidth:180 }}
                  placeholder="Playbook name..."/>
                <span style={{ fontSize:12, fontWeight:700 }}>
                  <span style={{ color:playFull?"#E8317A":"#4ade80" }}>{playCount}/{PLAY_LIMIT}</span>
                  <span style={{ color:"#555" }}> plays</span>
                  {bonusCount > 0 && <span style={{ color:"#7B9CFF" }}> &middot; {bonusCount} BPL</span>}
                </span>
                <button onClick={savePlaybook} disabled={pbSaving||pbCards.length===0}
                  style={{ background:"#0a1a0a", border:"1px solid #4ade8044", color:"#4ade80", borderRadius:8, padding:"6px 14px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  {pbSaving?"Saving...":"\uD83D\uDCBE Save Playbook"}
                </button>
                <button onClick={newPlaybook}
                  style={{ background:"transparent", border:"1px solid #2a2a2a", color:"#888", borderRadius:8, padding:"6px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                  + New
                </button>
              </div>

              {/* Saved playbooks */}
              {savedPlaybooks.length > 0 && (
                <div style={{ marginTop:10, display:"flex", gap:6, flexWrap:"wrap" }}>
                  {savedPlaybooks.map(pb=>(
                    <div key={pb.id} style={{ display:"flex", alignItems:"center", gap:4, background:pbLoadId===pb.id?"#1A1A2E":"#1a1a1a", border:`1px solid ${pbLoadId===pb.id?"#7B9CFF":"#2a2a2a"}`, borderRadius:8, padding:"4px 10px" }}>
                      <button onClick={()=>loadPlaybook(pb)} style={{ background:"none", border:"none", color:pbLoadId===pb.id?"#7B9CFF":"#888", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                        {pb.name} <span style={{ color:"#555", fontWeight:400 }}>({pb.playCount}P{pb.bonusCount>0?` +${pb.bonusCount}B`:""})</span>
                      </button>
                      <button onClick={()=>deletePlaybook(pb.id)} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:13, lineHeight:1, padding:"0 2px" }}>{"\u00D7"}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) clamp(280px,30%,380px)", gap:14, alignItems:"start" }}>

              {/* LEFT: Play card picker */}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                  {/* Owned toggle */}
                  <div style={{ display:"flex", alignItems:"center", gap:6, background:"#1a1a1a", border:`1px solid ${pbOwnedOnly?"#4ade80":"#2a2a2a"}`, borderRadius:8, padding:"5px 10px", cursor:"pointer" }}
                    onClick={()=>setPbOwnedOnly(p=>!p)}>
                    <div style={{ width:28, height:16, borderRadius:8, background:pbOwnedOnly?"#4ade80":"#333", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <div style={{ position:"absolute", top:2, left:pbOwnedOnly?12:2, width:12, height:12, borderRadius:"50%", background:"#fff", transition:"left 0.2s" }}/>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color:pbOwnedOnly?"#4ade80":"#666", whiteSpace:"nowrap" }}>
                      {pbOwnedOnly?"\u2705 Owned Only":"All Cards"}
                    </span>
                  </div>
                  <input value={pbSearch} onChange={e=>setPbSearch(e.target.value)}
                    placeholder="Search hero, play ability..."
                    style={{ ...S.inp, flex:1 }}/>
                  <select value={pbFilterSet} onChange={e=>setPbFilterSet(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                    <option value="">All Sets</option>
                    {pbSets.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                  <select value={pbTreatFilter} onChange={e=>setPbTreatFilter(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                    <option value="">All Types</option>
                    <option value="Plays">{"\u2694\uFE0F Plays"}</option>
                    <option value="Bonus Plays">{"\u2B50 Bonus Plays"}</option>
                    <option value="Home Team Discount">{"\uD83C\uDF2D Home Team Discount"}</option>
                  </select>
                  <select value={pbSort} onChange={e=>setPbSort(e.target.value)} style={{ ...S.inp, width:"auto", cursor:"pointer" }}>
                    <option value="name">Sort: Name</option>
                    <option value="dbs_desc">{"DBS: High \u2192 Low"}</option>
                    <option value="dbs_asc">{"DBS: Low \u2192 High"}</option>
                  </select>
                  <span style={{ fontSize:11, color:"#555" }}>{available.length} plays available</span>
                </div>

                <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:10, overflow:"hidden", maxHeight:560, overflowY:"auto" }}>
                  {available.length === 0 ? (
                    <div style={{ padding:"32px", textAlign:"center", color:"#333", fontSize:13 }}>
                      {allPlays.length === 0 ? "No Play cards found -- make sure your CSV has a Treatment or Play Ability column" : "No cards match your search"}
                    </div>
                  ) : available.map((c,i) => {
                    const isOwned = ownedSet.has(c.id);
                    const wc = WEAPON_COLORS[c.weapon]||"#444";
                    return (
                      <div key={c.id} style={{ borderBottom:"1px solid #111", background:i%2===0?"#0a0a0a":"#0d0d0d" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 14px" }}>
                          {c.imageUrl && <img src={c.imageUrl} alt={c.hero} style={{ width:36, height:48, objectFit:"cover", borderRadius:4, flexShrink:0, opacity:isOwned?1:0.4 }}/>}
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                              <span style={{ fontSize:13, fontWeight:800, color:"#F0F0F0" }}>{c.hero}</span>
                              {!pbOwnedOnly && <span style={{ fontSize:10, fontWeight:700, color:isOwned?"#4ade80":"#333" }}>{isOwned?"\u2713":"--"}</span>}
                            </div>
                            <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:c.playAbility?3:0 }}>
                              <span style={{ fontSize:10, color:"#555" }}>#{c.cardNum}</span>
                              {c.setName && <span style={{ fontSize:10, color:"#444", fontStyle:"italic" }}>{c.setName}</span>}
                              {c.playCost !== undefined && c.playCost !== "" && <span style={{ fontSize:10, color:"#FBBF24", fontWeight:700 }}>Cost: {c.playCost}</span>}
                              {c.dbs !== undefined && <span style={{ fontSize:10, color:"#A855F7", fontWeight:700 }}>DBS: {c.dbs}</span>}
                              {c.weapon && <span style={{ fontSize:10, color:wc, fontWeight:700 }}>{c.weapon}</span>}
                            </div>
                            {c.playAbility && <div style={{ fontSize:10, color:"#888", lineHeight:1.4, fontStyle:"italic" }}>{c.playAbility}</div>}
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", gap:4, flexShrink:0 }}>
                            {isPlay(c) && (() => {
                              const wouldExceed = (parseFloat(c.dbs)||0) > 0 && totalDbs + (parseFloat(c.dbs)||0) > DBS_CAP;
                              return (
                                <button onClick={()=>{ if(!playFull && !wouldExceed) setPbCards(p=>[...p,{id:c.id,type:"play"}]); }}
                                  disabled={playFull || wouldExceed}
                                  title={wouldExceed?`Would exceed ${DBS_CAP} DBS cap`:playFull?"Play slots full":""}
                                  style={{ background:"#1a1a2e", border:"1px solid #E8317A44", color:(playFull||wouldExceed)?"#333":"#E8317A", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, cursor:(playFull||wouldExceed)?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                                  + Play
                                </button>
                              );
                            })()}
                            {isBonus(c) && (() => {
                              const wouldExceed = (parseFloat(c.dbs)||0) > 0 && totalDbs + (parseFloat(c.dbs)||0) > DBS_CAP;
                              return (
                                <button onClick={()=>{ if(!wouldExceed) setPbCards(p=>[...p,{id:c.id,type:"bonus"}]); }}
                                  disabled={wouldExceed}
                                  title={wouldExceed?`Would exceed ${DBS_CAP} DBS cap`:""}
                                  style={{ background:"#0a0f1a", border:"1px solid #7B9CFF44", color:wouldExceed?"#333":"#7B9CFF", borderRadius:6, padding:"3px 8px", fontSize:10, fontWeight:700, cursor:wouldExceed?"not-allowed":"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                                  + BPL
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* RIGHT: Playbook */}
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>

                {/* Stats */}
                <div style={{ ...S.card }}>
                  <div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0", marginBottom:10 }}>{"\uD83D\uDCD6 Playbook"}</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:10 }}>
                    {[
                      { l:"Plays", v:`${playCount}/${PLAY_LIMIT}`, c:playFull?"#E8317A":"#4ade80" },
                      { l:"Bonus Plays", v:bonusCount, c:"#7B9CFF" },
                    ].map(({l,v,c})=>(
                      <div key={l} style={{ background:"#111", borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                        <div style={{ fontSize:20, fontWeight:900, color:c }}>{v}</div>
                        <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l}</div>
                      </div>
                    ))}
                  </div>
                  {/* Play slots bar */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ height:6, background:"#1a1a1a", borderRadius:3, overflow:"hidden" }}>
                      <div style={{ width:`${Math.min(playCount/PLAY_LIMIT*100,100)}%`, height:"100%", borderRadius:3, background:playFull?"#E8317A":"linear-gradient(90deg,#E8317A,#7B2FF7)", transition:"width 0.3s" }}/>
                    </div>
                    <div style={{ fontSize:10, color:"#555", marginTop:4 }}>{PLAY_LIMIT-playCount} play slots remaining</div>
                  </div>
                  {/* DBS cap */}
                  <div style={{ background: dbsOver?"#1a0a0a":"#0a0a0a", border:`1px solid ${dbsOver?"#E8317A44":"#2a2a2a"}`, borderRadius:8, padding:"10px 12px" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:6 }}>
                      <span style={{ fontSize:11, fontWeight:800, color: dbsOver?"#E8317A":"#A855F7" }}>{"\uD83D\uDCB0 DBS"}</span>
                      <span style={{ fontSize:11, fontWeight:700, color: dbsOver?"#E8317A":dbsPct>80?"#FBBF24":"#4ade80" }}>
                        {Math.round(totalDbs)} / {DBS_CAP}
                      </span>
                    </div>
                    <div style={{ height:8, background:"#1a1a1a", borderRadius:4, overflow:"hidden", marginBottom:6 }}>
                      <div style={{ width:`${dbsPct}%`, height:"100%", borderRadius:4, transition:"width 0.3s",
                        background: dbsOver?"#E8317A": dbsPct>80?"linear-gradient(90deg,#FBBF24,#E8317A)":"linear-gradient(90deg,#A855F7,#7B9CFF)" }}/>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10 }}>
                      <span style={{ color:"#555" }}>Used: {Math.round(totalDbs)}</span>
                      <span style={{ color: dbsOver?"#E8317A":dbsLeft<100?"#FBBF24":"#4ade80", fontWeight:700 }}>
                        {dbsOver ? `\u26A0\uFE0F Over by ${Math.round(totalDbs-DBS_CAP)}` : `${Math.round(dbsLeft)} remaining`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Plays list */}
                {pbResolved.length > 0 ? (
                  <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
                    {/* Plays */}
                    {pbResolved.filter(e=>e.type==="play").length > 0 && (
                      <div>
                        <div style={{ padding:"10px 14px 6px", fontSize:10, fontWeight:700, color:"#E8317A", textTransform:"uppercase", letterSpacing:1 }}>
                          {"\u2694\uFE0F Plays ("}{pbResolved.filter(e=>e.type==="play").length})
                        </div>
                        {pbResolved.filter(e=>e.type==="play").map((e,i) => {
                          const c = e.card;
                          const wc = WEAPON_COLORS[c.weapon]||"#444";
                          return (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px", borderTop:"1px solid #111", background:i%2===0?"#0d0d0d":"#0a0a0a" }}>
                              <div style={{ fontSize:12, color:"#333", width:18, textAlign:"center", flexShrink:0 }}>{i+1}</div>
                              {c.imageUrl && <img src={c.imageUrl} alt={c.hero} style={{ width:28, height:37, objectFit:"cover", borderRadius:3, flexShrink:0 }}/>}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:800, color:"#F0F0F0" }}>{c.hero}</div>
                                <div style={{ display:"flex", gap:8, marginTop:2 }}>{c.playCost !== undefined && c.playCost !== "" && <span style={{ fontSize:10, color:"#FBBF24", fontWeight:700 }}>Cost: {c.playCost}</span>}{c.dbs !== undefined && <span style={{ fontSize:10, color:"#A855F7", fontWeight:700 }}>DBS: {c.dbs}</span>}{c.setName && <span style={{ fontSize:10, color:"#444", fontStyle:"italic" }}>{c.setName}</span>}</div>
                                {c.playAbility && <div style={{ fontSize:10, color:"#666", fontStyle:"italic", lineHeight:1.3, marginTop:2 }}>{c.playAbility}</div>}
                              </div>
                              <button onClick={()=>{ const playEntries=pbCards.filter(x=>x.type==="play"); const globalIdx=pbCards.indexOf(playEntries[i]); const arr=[...pbCards]; arr.splice(globalIdx,1); setPbCards(arr); }}
                                style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:14, padding:"2px 4px", flexShrink:0 }}>{"\u00D7"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Bonus plays */}
                    {pbResolved.filter(e=>e.type==="bonus").length > 0 && (
                      <div>
                        <div style={{ padding:"10px 14px 6px", fontSize:10, fontWeight:700, color:"#7B9CFF", textTransform:"uppercase", letterSpacing:1, borderTop:"1px solid #1a1a1a" }}>
                          {"\u2B50 Bonus Plays ("}{pbResolved.filter(e=>e.type==="bonus").length})
                        </div>
                        {pbResolved.filter(e=>e.type==="bonus").map((e,i) => {
                          const c = e.card;
                          return (
                            <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 14px", borderTop:"1px solid #111", background:i%2===0?"#0d0d0d":"#0a0a0a" }}>
                              <div style={{ fontSize:12, color:"#333", width:18, textAlign:"center", flexShrink:0 }}>B{i+1}</div>
                              {c.imageUrl && <img src={c.imageUrl} alt={c.hero} style={{ width:28, height:37, objectFit:"cover", borderRadius:3, flexShrink:0 }}/>}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:12, fontWeight:800, color:"#7B9CFF" }}>{c.hero}</div>
                                <div style={{ display:"flex", gap:8, marginTop:2 }}>{c.playCost !== undefined && c.playCost !== "" && <span style={{ fontSize:10, color:"#FBBF24", fontWeight:700 }}>Cost: {c.playCost}</span>}{c.dbs !== undefined && <span style={{ fontSize:10, color:"#A855F7", fontWeight:700 }}>DBS: {c.dbs}</span>}{c.setName && <span style={{ fontSize:10, color:"#444", fontStyle:"italic" }}>{c.setName}</span>}</div>
                                {c.playAbility && <div style={{ fontSize:10, color:"#666", fontStyle:"italic", lineHeight:1.3, marginTop:2 }}>{c.playAbility}</div>}
                              </div>
                              <button onClick={()=>{ const entries=[...pbCards]; const bonusEntries=entries.filter(x=>x.type==="bonus"); const target=bonusEntries[i]; const idx=entries.findIndex((x,j)=>x===target); entries.splice(idx,1); setPbCards(entries); }}
                                style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:14, padding:"2px 4px", flexShrink:0 }}>{"\u00D7"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ padding:"10px 14px" }}>
                      <button onClick={()=>{ if(window.confirm("Clear entire playbook?")) setPbCards([]); }}
                        style={{ background:"transparent", border:"1px solid #E8317A22", color:"#E8317A", borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
                        {"\u2715 Clear Playbook"}</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ ...S.card, textAlign:"center", color:"#333", padding:32, fontSize:13 }}>
                    Add plays from the left panel.<br/>Max {PLAY_LIMIT} plays + unlimited BPL.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {viewMode === "cards" && (loading ? (
        <div style={{ ...S.card, textAlign:"center", color:"#555", padding:40 }}>Loading checklist...</div>
      ) : cards.length === 0 ? (
        <div style={{ ...S.card, textAlign:"center", color:"#555", padding:40 }}>No cards loaded yet. Import a CSV to get started.</div>
      ) : (() => {
        const visibleCards = filtered.slice(0, page * PAGE_SIZE);
        const hasMore = visibleCards.length < filtered.length;
        return (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
              {visibleCards.map(c => {
                const isOwned = !!owned[c.id];
                return <BobaCard key={c.id} c={c} isOwned={isOwned} ownedQty={owned[c.id]||0} flippedCard={flippedCard} setFlippedCard={setFlippedCard} toggleOwned={toggleOwned} setOwnedQty={setOwnedQty} toggleWant={toggleWant} wantList={wantList} WEAPON_COLORS={WEAPON_COLORS}/>;
              })}
            </div>
            {hasMore && (
              <div style={{ textAlign:"center", padding:"16px 0", color:"#555", fontSize:12 }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:16, height:16, border:"2px solid #333", borderTopColor:"#E8317A", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
                  Loading more... ({visibleCards.length} of {filtered.length.toLocaleString()})
                </div>
              </div>
            )}
            {!hasMore && filtered.length > PAGE_SIZE && (
              <div style={{ textAlign:"center", padding:"12px 0", color:"#333", fontSize:11 }}>
                All {filtered.length.toLocaleString()} cards loaded
              </div>
            )}
          </>
        );
      })())}
      {/* Imported sets */}
      {isAdmin && (
        <div style={{ ...S.card }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
            <SectionLabel t={`Imported Sets (${imports.length})`} />
            {cards.length > 0 && imports.length === 0 && (
              <div style={{ fontSize:11, color:"#FBBF24" }}>{"\u26A0 Cards found but no import record -- use Rename below or re-import"}</div>
            )}
          </div>
          {imports.length === 0 ? (
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
              <div style={{ fontSize:12, color:"#555" }}>
                No import records found.
                {cards.length > 0 && (
                  <span style={{ color:"#FBBF24", marginLeft:8 }}>{cards.length.toLocaleString()} cards in Firestore from a previous import -- clear them and re-import below.</span>
                )}
              </div>
              {cards.length > 0 && (
                <button onClick={async () => {
                  if(!window.confirm(`Delete ALL ${cards.length.toLocaleString()} cards and all owned data? This cannot be undone.`)) return;
                  const chunkSize = 200;
                  const allIds = cards.map(c=>c.id);
                  for(let i=0;i<allIds.length;i+=chunkSize){
                    await Promise.all(allIds.slice(i,i+chunkSize).map(id=>deleteDoc(doc(db,"boba_checklist",id))));
                  }
                  await setDoc(doc(db,"boba_owned",ownedDocId), {});
                  setOwned({});
                  try { localStorage.removeItem("boba_checklist_cache_v2"); } catch(e) {}
                }} style={{ background:"#1a0a0a", border:"1.5px solid #E8317A", color:"#E8317A", borderRadius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                  {"\uD83D\uDDD1 Clear All Cards"}</button>
              )}
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {imports.map(imp=>(
                <div key={imp.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", background:"#1a1a1a", borderRadius:8, gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    {renamingId === imp.id ? (
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                          onKeyDown={e=>{ if(e.key==="Enter") handleRenameSet(imp,renameVal); if(e.key==="Escape") setRenamingId(null); }}
                          style={{ ...S.inp, flex:1, fontSize:13, padding:"4px 8px" }}/>
                        <button onClick={()=>handleRenameSet(imp,renameVal)} style={{ background:"#166534", color:"#fff", border:"none", borderRadius:6, padding:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\u2713"}</button>
                        <button onClick={()=>setRenamingId(null)} style={{ background:"none", border:"none", color:"#555", cursor:"pointer", fontSize:13 }}>{"\u2715"}</button>
                      </div>
                    ) : (
                      <>
                        <span style={{ fontWeight:700, color:"#F0F0F0", fontSize:13 }}>{imp.setName}</span>
                        <span style={{ fontSize:11, color:"#555", marginLeft:10 }}>{imp.cardCount?.toLocaleString()} cards &middot; {imp.importedAt?.slice(0,10)}</span>
                      </>
                    )}
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={()=>{ setRenamingId(imp.id); setRenameVal(imp.setName); }} style={{ background:"none", border:"1px solid #333", color:"#888", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\u270F\uFE0F Rename"}</button>
                    {!scanPdf && (
                      <label style={{ background:"#0a0f1a", color:"#7B9CFF", border:"1px solid #7B9CFF44", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
                        {"\uD83D\uDD0D Scan PDF"}<input type="file" accept=".pdf" onChange={e=>{ const f=e.target.files[0]; if(f) setPendingScan({ file:f, setName:imp.setName }); e.target.value=""; }} style={{ display:"none" }}/>
                      </label>
                    )}
                    <button onClick={()=>handleDeleteImport(imp)} style={{ background:"none", border:"1px solid #E8317A44", color:"#E8317A", borderRadius:6, padding:"3px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1 Delete"}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {cards.length > 0 && (
            <div style={{ marginTop:10, paddingTop:10, borderTop:"1px solid #1a1a1a", display:"flex", justifyContent:"flex-end" }}>
              <button onClick={async () => {
                if(!window.confirm(`Delete ALL ${cards.length.toLocaleString()} cards, all import records, and all owned data? This cannot be undone.`)) return;
                const chunkSize = 200;
                const allIds = cards.map(c=>c.id);
                for(let i=0;i<allIds.length;i+=chunkSize){
                  await Promise.all(allIds.slice(i,i+chunkSize).map(id=>deleteDoc(doc(db,"boba_checklist",id))));
                }
                await Promise.all(imports.map(imp=>deleteDoc(doc(db,"boba_imports",imp.id))));
                await setDoc(doc(db,"boba_owned",ownedDocId), {});
                setOwned({});
              }} style={{ background:"#1a0a0a", border:"1.5px solid #E8317A44", color:"#E8317A", borderRadius:8, padding:"5px 14px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                {"\uD83D\uDDD1 Clear All & Restart"}</button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}




// --- PUBLIC CARD DATABASE (full community app) ---------------

function MessagesTab({ user, activeThread, setActiveThread, threads, threadMsgs, newMsg, setNewMsg, sendMessage, closeThread, marketSales, inp, WEAPON_COLORS, setSigningIn }) {
  if (!user) return (
    <div style={{textAlign:"center",padding:80}}>
      <div style={{fontSize:48,marginBottom:16}}>{"\uD83D\uDCAC"}</div>
      <button onClick={()=>setSigningIn(true)} style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:14,padding:"12px 28px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Sign in to view messages</button>
    </div>
  );

  if (activeThread) return (
    <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,overflow:"hidden",backdropFilter:"blur(10px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.3)"}}>
        <button onClick={()=>setActiveThread(null)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:20,padding:0,lineHeight:1}}>{"\u2190"}</button>
        {activeThread.cardImage&&<img src={activeThread.cardImage} alt="" style={{width:32,height:43,objectFit:"cover",borderRadius:5,flexShrink:0}}/>}
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0"}}>{activeThread.cardName}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>
            {"$"}{(activeThread.agreedPrice||0).toFixed(2)} agreed {"\u00B7"} with {activeThread.sellerUid===user.uid?activeThread.buyerName:activeThread.sellerName}
          </div>
        </div>
        {activeThread.status==="active"&&activeThread.sellerUid===user.uid&&(
          <button onClick={()=>closeThread(activeThread.id)} style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",color:"#4ade80",borderRadius:10,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"\u2705 Mark Complete"}</button>
        )}
        {activeThread.status==="completed"&&<span style={{fontSize:11,color:"rgba(74,222,128,0.6)",fontWeight:700}}>{"\u2705 Completed"}</span>}
        <button onClick={()=>{if(window.confirm("Delete this entire conversation?")){
          deleteDoc(doc(db,"deal_threads",activeThread.id));
          setActiveThread(null);
        }}} style={{background:"rgba(232,49,122,0.08)",border:"1px solid rgba(232,49,122,0.2)",color:"rgba(232,49,122,0.6)",borderRadius:8,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginLeft:"auto"}}>{"\uD83D\uDDD1"}</button>
      </div>
      <div style={{height:400,overflowY:"auto",padding:"16px 20px",display:"flex",flexDirection:"column",gap:10}}>
        {threadMsgs.length===0&&<div style={{textAlign:"center",color:"rgba(255,255,255,0.2)",padding:40,fontSize:13}}>No messages yet</div>}
        {threadMsgs.map(m=>{
          const isMe=m.senderUid===user.uid;
          if(m.senderUid==="system") return (
            <div key={m.id} style={{textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.03)",borderRadius:10,padding:"8px 14px"}}>{m.text}</div>
          );
          return (
            <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",gap:3}}>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginBottom:2,display:"flex",alignItems:"center",gap:8}}>
                <span>{isMe?"You":m.senderName} {"\u00B7"} {new Date(m.sentAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</span>
                {isMe&&<button onClick={()=>updateDoc(doc(db,"deal_threads",activeThread.id),{messages:arrayRemove(m)})} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:12,padding:"0 2px",lineHeight:1}} title="Delete">{"\u00D7"}</button>}
              </div>
              <div style={{
                background:isMe?"linear-gradient(135deg,rgba(232,49,122,0.3),rgba(123,47,247,0.3))":"rgba(255,255,255,0.06)",
                border:"1px solid "+(isMe?"rgba(232,49,122,0.3)":"rgba(255,255,255,0.08)"),
                borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",
                padding:"10px 14px",maxWidth:"75%",fontSize:13,color:"#F0F0F0",lineHeight:1.5,wordBreak:"break-word"
              }}>{m.text}</div>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8,padding:"12px 20px",borderTop:"1px solid rgba(255,255,255,0.06)",background:"rgba(0,0,0,0.2)"}}>
        {activeThread.status!=="active"&&<div style={{position:"absolute",bottom:72,left:0,right:0,textAlign:"center",fontSize:11,color:"rgba(255,255,255,0.2)",pointerEvents:"none"}}>Deal marked complete</div>}
        <input value={newMsg} onChange={e=>setNewMsg(e.target.value)} placeholder={activeThread.status==="active"?"Message to coordinate payment...":"Continue the conversation..."} style={{...inp,flex:1}} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}/>
        <button onClick={sendMessage} disabled={!newMsg.trim()} style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:newMsg.trim()?"pointer":"not-allowed",fontFamily:"inherit",opacity:newMsg.trim()?1:0.4}}>Send</button>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0",marginBottom:16}}>Deal Messages</div>
      {threads.length===0?(
        <div style={{textAlign:"center",padding:80,color:"rgba(255,255,255,0.2)"}}>
          <div style={{fontSize:48,marginBottom:16}}>{"\uD83D\uDCAC"}</div>
          <div style={{fontSize:14,fontWeight:700}}>No deal threads yet</div>
          <div style={{fontSize:12,marginTop:8}}>When you accept or make an offer, a chat opens here</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {threads.map(t=>{
            const isUnread=t.lastReadBy?.[user.uid]<t.lastMessageAt&&t.lastSenderUid!==user.uid;
            const otherName=t.sellerUid===user.uid?t.buyerName:t.sellerName;
            return (
              <div key={t.id} onClick={()=>setActiveThread(t)}
                style={{display:"flex",alignItems:"center",gap:14,
                  background:isUnread?"rgba(232,49,122,0.06)":"rgba(255,255,255,0.02)",
                  border:"1px solid "+(isUnread?"rgba(232,49,122,0.2)":"rgba(255,255,255,0.06)"),
                  borderRadius:14,padding:"14px 18px",cursor:"pointer",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";}}
                onMouseLeave={e=>{e.currentTarget.style.background=isUnread?"rgba(232,49,122,0.06)":"rgba(255,255,255,0.02)";}}>
                {t.cardImage
                  ?<img src={t.cardImage} alt={t.cardName} style={{width:40,height:54,objectFit:"cover",borderRadius:7,flexShrink:0}}/>
                  :<div style={{width:40,height:54,background:"rgba(255,255,255,0.04)",borderRadius:7,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{"\uD83C\uDCCF"}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <div style={{fontSize:14,fontWeight:isUnread?800:600,color:"#F0F0F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.cardName}</div>
                    {t.status==="completed"&&<span style={{fontSize:10,color:"#4ade80",fontWeight:700,flexShrink:0}}>Done</span>}
                    {isUnread&&<span style={{width:8,height:8,borderRadius:"50%",background:"#E8317A",flexShrink:0}}/>}
                  </div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:3}}>with {otherName} {"\u00B7"} {"$"}{(t.agreedPrice||0).toFixed(2)}</div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.lastMessage||"No messages yet"} <span style={{color:"rgba(232,49,122,0.5)",fontWeight:700}}>{"\u2192 Tap to chat"}</span></div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,flexShrink:0}}>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>{t.lastMessageAt?new Date(t.lastMessageAt).toLocaleDateString([],{month:"short",day:"numeric"}):""}</div>
                  <button onClick={e=>{e.stopPropagation();setActiveThread(t);}} style={{background:"rgba(232,49,122,0.15)",border:"1px solid rgba(232,49,122,0.3)",color:"#E8317A",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Chat</button>
                  <button onClick={e=>{e.stopPropagation();if(window.confirm("Delete this conversation?"))deleteDoc(doc(db,"deal_threads",t.id));}} style={{background:"rgba(232,49,122,0.08)",border:"1px solid rgba(232,49,122,0.2)",color:"rgba(232,49,122,0.6)",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"\uD83D\uDDD1 Delete"}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {marketSales.length>0&&(
        <div style={{marginTop:32}}>
          <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0",marginBottom:4}}>Recent Sales</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:16}}>Price history from completed deals on this platform</div>
          {(()=>{
            const byCard={};
            marketSales.forEach(s=>{
              const key=s.cardName+"|"+(s.cardTreatment||"");
              if(!byCard[key]) byCard[key]={cardName:s.cardName,treatment:s.cardTreatment,weapon:s.cardWeapon,image:s.cardImage,sales:[]};
              byCard[key].sales.push({price:s.price,date:s.soldDate});
            });
            const sorted=Object.values(byCard).sort((a,b)=>b.sales.length-a.sales.length).slice(0,10);
            return (
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10,marginBottom:24}}>
                {sorted.map((entry,idx)=>{
                  const prices=entry.sales.map(s=>s.price);
                  const avg=prices.reduce((a,b)=>a+b,0)/prices.length;
                  const high=Math.max(...prices),low=Math.min(...prices);
                  const last=entry.sales[0];
                  const wc=WEAPON_COLORS[entry.weapon]||"#444";
                  return (
                    <div key={idx} style={{background:"rgba(255,255,255,0.02)",border:"1px solid "+wc+"22",borderRadius:14,padding:14}}>
                      <div style={{display:"flex",gap:10,marginBottom:10}}>
                        {entry.image?<img src={entry.image} alt={entry.cardName} style={{width:40,height:54,objectFit:"cover",borderRadius:7,flexShrink:0}}/>:<div style={{width:40,height:54,background:"rgba(255,255,255,0.04)",borderRadius:7,flexShrink:0}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:"#F0F0F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{entry.cardName}</div>
                          <div style={{fontSize:10,color:wc,fontWeight:700}}>{entry.weapon}</div>
                        </div>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
                        {[{l:"Avg",v:"$"+avg.toFixed(2),c:"#7B9CFF"},{l:"High",v:"$"+high.toFixed(2),c:"#4ade80"},{l:"Low",v:"$"+low.toFixed(2),c:"#FBBF24"}].map(({l,v,c})=>(
                          <div key={l} style={{background:"rgba(0,0,0,0.3)",borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                            <div style={{fontSize:13,fontWeight:800,color:c}}>{v}</div>
                            <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:1}}>{l}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{entry.sales.length} sale{entry.sales.length!==1?"s":""} {"\u00B7"} Last: {last&&last.date?last.date:"--"}</div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
          <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,overflow:"hidden"}}>
            <div style={{padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.05)",fontSize:11,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5}}>Recent Sales Feed</div>
            {marketSales.slice(0,30).map((s,i)=>{
              const wc=WEAPON_COLORS[s.cardWeapon]||"#444";
              return (
                <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.03)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                  {s.cardImage?<img src={s.cardImage} alt={s.cardName} style={{width:28,height:37,objectFit:"cover",borderRadius:5,flexShrink:0}}/>:<div style={{width:28,height:37,background:"rgba(255,255,255,0.04)",borderRadius:5,flexShrink:0}}/>}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:"#F0F0F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.cardName}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{s.cardTreatment} {"\u00B7"} <span style={{color:wc}}>{s.cardWeapon}</span></div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>{"$"}{(s.price||0).toFixed(2)}</div>
                    <div style={{fontSize:10,color:"rgba(255,255,255,0.2)"}}>{s.soldDate||"--"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketTab({ user, myListings, listings, WEAPON_COLORS, allMyOffers, marketSales, trackingInputs, setTrackingInputs, setListModal, setOfferModal, setOfferAmt, setOfferNote, setOfferSent, setCounterModal, setCounterAmt, buyNow, respondOffer, unsellListing, saveTracking, setSigningIn, setActiveTab, inp , listType, cards, owned, search, removeListing}) {
  return (
          <div>
            {/* My listings */}
            {user&&myListings.length>0&&(
              <div style={{marginBottom:24}}>
                <div style={{fontSize:14,fontWeight:800,color:"#4ade80",marginBottom:12}}>Your Listings ({myListings.length})</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                  {myListings.map(l=>(
                    <div key={l.id} className="market-card" style={{background:"rgba(10,26,10,0.6)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:16,padding:16,backdropFilter:"blur(10px)",transition:"all 0.2s",position:"relative"}}>
                      <div style={{display:"flex",gap:12,marginBottom:10}}>
                        {l.cardImage?<img src={l.cardImage} alt={l.cardName} style={{width:48,height:64,objectFit:"cover",borderRadius:8,flexShrink:0}}/>:<div style={{width:48,height:64,background:"rgba(255,255,255,0.05)",borderRadius:8,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"rgba(255,255,255,0.3)"}}>IMG</div>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0"}}>{l.cardName}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{l.cardTreatment} &middot; {l.cardPower}\u26A1</div>
                          <div style={{fontSize:12,fontWeight:700,color:"#4ade80",marginTop:4}}>${(l.askingPrice||0).toFixed(2)}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{l.listType==="trade"?"For Trade":l.listType==="either"?"Sale/Trade":"For Sale"}</div>
                        </div>
                      </div>
                      {l.offerCount>0&&<div style={{fontSize:11,color:"#FBBF24",fontWeight:700,marginBottom:8}}>{"\uD83E\uDD1D"}{l.offerCount} offer{l.offerCount!==1?"s":""}</div>}
                      <button onClick={()=>removeListing(l.id)} style={{width:"100%",background:"transparent",border:"1px solid rgba(232,49,122,0.2)",color:"rgba(232,49,122,0.5)",borderRadius:8,padding:"5px 0",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Remove Listing</button>
                    </div>
                  ))}
                </div>
              </div>
            )}


            {/* Sold Listings */}
            {user&&marketSales.filter(s=>s.sellerUid===user.uid).length>0&&(()=>{
              const mySales=marketSales.filter(s=>s.sellerUid===user.uid);
              const totalRevenue=mySales.reduce((acc,s)=>acc+(s.price||0),0);
              const CARRIERS=["USPS","UPS","FedEx","DHL","Other"];
              return (
                <div style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>{"\uD83D\uDCB8 Sold"}</div>
                    <span style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,color:"#4ade80"}}>{mySales.length} card{mySales.length!==1?"s":""}</span>
                    <span style={{marginLeft:"auto",fontSize:13,fontWeight:800,color:"#4ade80"}}>{"$"}{totalRevenue.toFixed(2)} total</span>
                  </div>
                  <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(74,222,128,0.1)",borderRadius:16,overflow:"hidden"}}>
                    {mySales.map((s,i)=>{
                      const ti=trackingInputs[s.id]||{num:s.trackingNumber||"",carrier:s.carrier||"USPS"};
                      const hasTracking=s.trackingNumber;
                      return (
                        <div key={s.soldAt+i} style={{borderBottom:i<mySales.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                          <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px"}}>
                            {s.cardImage?<img src={s.cardImage} alt={s.cardName} style={{width:32,height:43,objectFit:"cover",borderRadius:6,flexShrink:0}}/>:<div style={{width:32,height:43,background:"rgba(255,255,255,0.04)",borderRadius:6,flexShrink:0}}/>}
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:"#F0F0F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.cardName}</div>
                              <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{s.cardTreatment} {"\u00B7"} to {s.buyerName||"buyer"}</div>
                              {hasTracking&&(
                                <div style={{fontSize:10,color:"#7B9CFF",marginTop:2}}>
                                  {s.carrier||"USPS"}: {s.trackingNumber}
                                </div>
                              )}
                            </div>
                            <div style={{textAlign:"right",flexShrink:0}}>
                              <div style={{fontSize:15,fontWeight:900,color:"#4ade80"}}>{"$"}{(s.price||0).toFixed(2)}</div>
                              <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{s.soldDate||"--"}</div>
                              <button onClick={e=>{e.stopPropagation();unsellListing(s);}} style={{marginTop:4,background:"transparent",border:"1px solid rgba(232,49,122,0.2)",color:"rgba(232,49,122,0.4)",borderRadius:6,padding:"2px 8px",fontSize:10,cursor:"pointer",fontFamily:"inherit"}}>Reverse</button>
                            </div>
                          </div>
                          {/* Tracking input row */}
                          {s.id&&(
                            <div style={{display:"flex",gap:6,padding:"0 16px 10px",alignItems:"center"}}>
                              <select value={ti.carrier} onChange={e=>setTrackingInputs(prev=>({...prev,[s.id]:{...ti,carrier:e.target.value}}))}
                                style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 6px",fontSize:11,color:"rgba(255,255,255,0.5)",fontFamily:"inherit",cursor:"pointer"}}>
                                {CARRIERS.map(c=><option key={c} value={c}>{c}</option>)}
                              </select>
                              <input value={ti.num} onChange={e=>setTrackingInputs(prev=>({...prev,[s.id]:{...ti,num:e.target.value}}))}
                                placeholder={hasTracking?"Update tracking #":"Add tracking #"}
                                style={{flex:1,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 10px",fontSize:11,color:"#F0F0F0",fontFamily:"inherit",outline:"none"}}/>
                              <button onClick={()=>saveTracking(s.id,ti.num,ti.carrier)}
                                disabled={!ti.num.trim()}
                                style={{background:ti.num.trim()?"rgba(123,156,255,0.15)":"rgba(255,255,255,0.03)",border:"1px solid "+(ti.num.trim()?"rgba(123,156,255,0.3)":"rgba(255,255,255,0.06)"),color:ti.num.trim()?"#7B9CFF":"rgba(255,255,255,0.2)",borderRadius:6,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:ti.num.trim()?"pointer":"default",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                {hasTracking?"Update":"Save"}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Bought / Purchases */}
            {user&&marketSales.filter(s=>s.buyerUid===user.uid).length>0&&(()=>{
              const myBuys=marketSales.filter(s=>s.buyerUid===user.uid);
              const totalSpent=myBuys.reduce((acc,s)=>acc+(s.price||0),0);
              return (
                <div style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#7B9CFF"}}>{"\uD83D\uDCE6 Purchased"}</div>
                    <span style={{background:"rgba(123,156,255,0.1)",border:"1px solid rgba(123,156,255,0.2)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,color:"#7B9CFF"}}>{myBuys.length} card{myBuys.length!==1?"s":""}</span>
                    <span style={{marginLeft:"auto",fontSize:13,fontWeight:800,color:"#7B9CFF"}}>{"$"}{totalSpent.toFixed(2)} spent</span>
                  </div>
                  <div style={{background:"rgba(0,0,0,0.3)",border:"1px solid rgba(123,156,255,0.1)",borderRadius:16,overflow:"hidden"}}>
                    {myBuys.map((s,i)=>{
                      const shipped=s.trackingNumber;
                      return (
                        <div key={s.soldAt+"b"+i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:i<myBuys.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                          {s.cardImage?<img src={s.cardImage} alt={s.cardName} style={{width:32,height:43,objectFit:"cover",borderRadius:6,flexShrink:0}}/>:<div style={{width:32,height:43,background:"rgba(255,255,255,0.04)",borderRadius:6,flexShrink:0}}/>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:"#F0F0F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.cardName}</div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>from {s.sellerName||"seller"} {"\u00B7"} {s.soldDate||"--"}</div>
                            {shipped?(
                              <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3}}>
                                <span style={{fontSize:10,fontWeight:700,color:"#4ade80"}}>{"\u2705 Shipped"}</span>
                                <span style={{fontSize:10,color:"#7B9CFF"}}>{s.carrier||""} {s.trackingNumber}</span>
                              </div>
                            ):(
                              <div style={{fontSize:10,color:"rgba(251,191,36,0.6)",marginTop:2}}>{"\u23F3 Awaiting shipment"}</div>
                            )}
                          </div>
                          <div style={{textAlign:"right",flexShrink:0}}>
                            <div style={{fontSize:15,fontWeight:900,color:"#7B9CFF"}}>{"$"}{(s.price||0).toFixed(2)}</div>
                            {shipped&&(
                              <a href={"https://www.google.com/search?q="+encodeURIComponent((s.carrier||"")+" "+s.trackingNumber+" tracking")} target="_blank" rel="noreferrer"
                                style={{fontSize:10,color:"#7B9CFF",textDecoration:"none",display:"block",marginTop:2}}>Track {"\u2192"}</a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Offer Inbox -- all pending offers on my listings grouped by listing */}
            {user&&allMyOffers.length>0&&(()=>{
              // Group offers by listingId
              const byListing={};
              allMyOffers.forEach(o=>{
                if(!byListing[o.listingId]) byListing[o.listingId]={listingId:o.listingId,cardName:o.cardName,cardImage:o.cardImage||null,offers:[]};
                byListing[o.listingId].offers.push(o);
              });
              const groups=Object.values(byListing);
              return (
                <div style={{marginBottom:24}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#FBBF24"}}>{"\uD83D\uDCE5 Offer Inbox"}</div>
                    <span style={{background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:20,padding:"2px 10px",fontSize:11,fontWeight:800,color:"#FBBF24"}}>{allMyOffers.length}</span>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:16}}>
                    {groups.map(g=>(
                      <div key={g.listingId} style={{background:"rgba(251,191,36,0.03)",border:"1px solid rgba(251,191,36,0.12)",borderRadius:16,overflow:"hidden"}}>
                        {/* Listing header */}
                        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid rgba(251,191,36,0.08)",background:"rgba(251,191,36,0.04)"}}>
                          {g.cardImage&&<img src={g.cardImage} alt={g.cardName} style={{width:32,height:43,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:800,color:"#F0F0F0"}}>{g.cardName}</div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{g.offers.length} offer{g.offers.length!==1?"s":""} {"\u00B7"} Best: {"$"}{(g.offers[0]?.offerAmount||0).toFixed(2)}</div>
                          </div>
                        </div>
                        {/* Offer rows sorted highest to lowest */}
                        {g.offers.map((o,idx)=>{
                          const isBest=idx===0;
                          const pctOfBest=g.offers[0].offerAmount>0?Math.round(o.offerAmount/g.offers[0].offerAmount*100):100;
                          return (
                            <div key={o.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 16px",borderBottom:idx<g.offers.length-1?"1px solid rgba(255,255,255,0.04)":"none",background:isBest?"rgba(74,222,128,0.04)":"transparent"}}>
                              {/* Rank */}
                              <div style={{width:22,height:22,borderRadius:"50%",background:isBest?"rgba(74,222,128,0.15)":"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:800,color:isBest?"#4ade80":"rgba(255,255,255,0.3)",flexShrink:0}}>
                                {idx+1}
                              </div>
                              {/* Buyer name */}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:13,fontWeight:700,color:"#F0F0F0"}}>{o.buyerName}</div>
                                {o.note&&<div style={{fontSize:11,color:"rgba(255,255,255,0.35)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:1}}>{o.note}</div>}
                                <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:1}}>{o.createdAt?new Date(o.createdAt).toLocaleDateString([],{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):""}</div>
                              </div>
                              {/* Amount + bar */}
                              <div style={{textAlign:"right",flexShrink:0}}>
                                <div style={{fontSize:16,fontWeight:900,color:isBest?"#4ade80":"#F0F0F0"}}>{"$"}{(o.offerAmount||0).toFixed(2)}</div>
                                {!isBest&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{pctOfBest}{"% of best"}</div>}
                                {isBest&&<div style={{fontSize:10,color:"#4ade80",fontWeight:700}}>Best offer</div>}
                              </div>
                              {/* Action buttons */}
                              <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                                <button onClick={()=>respondOffer(o,"accepted")}
                                  style={{background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.3)",color:"#4ade80",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                  Accept
                                </button>
                                <button onClick={()=>{setCounterModal(o);setCounterAmt("");}}
                                  style={{background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.2)",color:"#FBBF24",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                  Counter
                                </button>
                                <button onClick={()=>respondOffer(o,"declined")}
                                  style={{background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.3)",borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                                  Decline
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Community listings */}
            <div>
              <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0",marginBottom:12}}>
                {listings.length===0?"No active listings right now":"Community Listings"} {listings.length>0&&<span style={{fontSize:12,color:"rgba(255,255,255,0.3)",fontWeight:400}}>({listings.length})</span>}
              </div>
              {listings.length===0?(
                <div style={{textAlign:"center",padding:80,color:"rgba(255,255,255,0.2)"}}>
                  <div style={{fontSize:48,marginBottom:16}}>{"\uD83D\uDCB0"}</div>
                  <div style={{fontSize:16,fontWeight:700}}>No cards listed yet</div>
                  <div style={{fontSize:13,marginTop:8}}>{"List your owned cards from the Cards tab using the \uD83D\uDCB0 button"}</div>
                </div>
              ):(
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10}}>
                  {listings.filter(l=>l.sellerUid!==user?.uid).map(l=>{
                    const wc=WEAPON_COLORS[l.cardWeapon]||"#444";
                    return (
                      <div key={l.id} className="market-card" style={{background:"rgba(255,255,255,0.02)",border:`1px solid ${wc}22`,borderRadius:16,padding:16,backdropFilter:"blur(10px)",transition:"all 0.2s",cursor:"pointer"}} onClick={()=>{if(!user){setSigningIn(true);return;}setOfferModal(l);setOfferAmt("");setOfferNote("");}}>
                        <div style={{display:"flex",gap:12,marginBottom:10}}>
                          {l.cardImage?<img src={l.cardImage} alt={l.cardName} style={{width:54,height:72,objectFit:"cover",borderRadius:10,flexShrink:0,boxShadow:`0 4px 16px ${wc}33`}}/>:<div style={{width:54,height:72,background:"rgba(255,255,255,0.04)",borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"rgba(255,255,255,0.3)"}}>IMG</div>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0",marginBottom:2}}>{l.cardName}</div>
                            <div style={{fontSize:11,color:wc,fontWeight:700,marginBottom:2}}>{l.cardWeapon}</div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{l.cardTreatment}</div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{l.cardPower}\u26A1 &middot; {l.setName}</div>
                          </div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                          <div>
                            {l.isOBO?(
                              <div style={{fontSize:15,fontWeight:900,color:"#4ade80",letterSpacing:-0.5}}>{"\uD83D\uDCE8 Best Offer"}</div>
                            ):(
                              <div style={{fontSize:18,fontWeight:900,color:"#4ade80"}}>${(l.askingPrice||0).toFixed(2)}</div>
                            )}
                            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{l.isOBO?"Offers only":l.listType==="trade"?"Trade only":l.listType==="either"?"Sale or Trade":"For Sale"}</div>
                          </div>
                          <div style={{textAlign:"right"}}>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>by {l.sellerName}</div>
                            {l.offerCount>0&&<div style={{fontSize:10,color:"#FBBF24"}}>{l.offerCount} offer{l.offerCount!==1?"s":""}</div>}
                          </div>
                        </div>
                        {l.notes&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontStyle:"italic",marginBottom:10,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:8}}>{l.notes}</div>}
                        <div style={{display:"flex",gap:6,marginTop:2}}>
                          {!l.isOBO&&l.askingPrice>0&&l.sellerUid!==user?.uid&&(
                            <button onClick={e=>{e.stopPropagation();buyNow(l);}}
                              style={{flex:1,background:"linear-gradient(135deg,rgba(74,222,128,0.2),rgba(34,197,94,0.15))",border:"1px solid rgba(74,222,128,0.35)",color:"#4ade80",borderRadius:10,padding:"8px 0",fontSize:12,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                              {"\uD83D\uDED2 Buy Now"}
                            </button>
                          )}
                          {l.sellerUid!==user?.uid&&(
                            <button onClick={e=>{e.stopPropagation();if(!user){setSigningIn(true);return;}setOfferModal(l);setOfferAmt("");setOfferNote("");setOfferSent(false);}}
                              style={{flex:1,background:"linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.1))",border:"1px solid rgba(251,191,36,0.2)",color:"#FBBF24",borderRadius:10,padding:"8px 0",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
                              {"\uD83E\uDD1D "+(l.isOBO?"Make Offer":"Offer")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
  );
}

function TeamTab({ user, teams, activeTeam, setActiveTeam, newTeamName, setNewTeamName, inviteEmail, setInviteEmail, inviteStatus, setInviteStatus, teamInvites, moveTeamMember, deleteTeam, respondTeamInvite, createTeam, inviteMember, WEAPON_COLORS, setSigningIn, cards, owned , friendOwned, inp, inviteToTeam}) {
  return (
          <div style={{maxWidth:960,margin:"0 auto"}}>
            {!user?(
              <div style={{textAlign:"center",padding:80}}>
                <div style={{fontSize:48,marginBottom:16}}>{"\uD83C\uDFC6"}</div>
                <button onClick={()=>setSigningIn(true)} style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:14,padding:"12px 28px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>Sign in to create a team</button>
              </div>
            ):(
              <>
                {/* Create team form -- only show if no teams */}
                {teams.filter(t=>t.status!=="deleted").length===0&&(
                  <div style={{background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:16,padding:24,marginBottom:16,backdropFilter:"blur(10px)"}}>
                    <div style={{fontSize:14,fontWeight:800,color:"#A855F7",marginBottom:12}}>{"\uD83C\uDFC6 Create Your Team"}</div>
                    <div style={{display:"flex",gap:8}}>
                      <input value={newTeamName} onChange={e=>setNewTeamName(e.target.value)} placeholder="Team name..." style={{...inp,flex:1}} onKeyDown={e=>e.key==="Enter"&&createTeam()}/>
                      <button onClick={createTeam} style={{background:"linear-gradient(135deg,#A855F7,#7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(168,85,247,0.3)"}}>Create</button>
                    </div>
                  </div>
                )}

                {/* Team selector */}
                {teams.filter(t=>t.status!=="deleted").length>1&&(
                  <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
                    {teams.filter(t=>t.status!=="deleted").map(t=>(
                      <button key={t.id} onClick={()=>setActiveTeam(t)} style={{background:activeTeam?.id===t.id?"rgba(168,85,247,0.15)":"rgba(255,255,255,0.02)",border:`1.5px solid ${activeTeam?.id===t.id?"#A855F7":"rgba(255,255,255,0.08)"}`,color:activeTeam?.id===t.id?"#A855F7":"rgba(255,255,255,0.4)",borderRadius:10,padding:"7px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)"}}>
                        {t.name} ({(t.members||[]).length}/6)
                      </button>
                    ))}
                    <button onClick={()=>{setNewTeamName(" ");}} style={{background:"transparent",border:"1px dashed rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",borderRadius:10,padding:"7px 16px",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>+ New Team</button>
                  </div>
                )}

                {activeTeam&&activeTeam.status!=="deleted"&&(()=>{
                  const team=activeTeam;
                  const starters=team.starters||team.members?.slice(0,4)||[];
                  const bench=team.bench||team.members?.slice(4)||[];
                  const allMembers=[...starters,...bench];
                  const isOwner=team.createdBy===user.uid;

                  // Apex conflict detection across all members
                  const dupKey2=c=>`${(c.hero||"").toLowerCase()}|${(c.variation||"").toLowerCase()}|${c.power||""}|${(c.weapon||"").toLowerCase()}`;
                  const apexMap={};
                  allMembers.forEach(m=>{
                    const mOwned=m.uid===user.uid?owned:(friendOwned[m.uid]||{});
                    cards.filter(c=>mOwned[c.id]&&parseFloat(c.power||0)>160).forEach(c=>{
                      const dk=dupKey2(c);
                      if(!apexMap[dk])apexMap[dk]={card:c,members:[]};
                      apexMap[dk].members.push(m.displayName);
                    });
                  });
                  const conflicts=Object.values(apexMap).filter(x=>x.members.length>1);

                  // Drag state
                  let dragUid=null;

                  function MemberCard({m, slot, isDraggable}) {
                    const mOwned=m.uid===user.uid?owned:(friendOwned[m.uid]||{});
                    const totalCards=Object.keys(mOwned).filter(id=>cards.find(c=>c.id===id)).length;
                    const apexCards=cards.filter(c=>mOwned[c.id]&&parseFloat(c.power||0)>160);
                    const isMe=m.uid===user.uid;
                    const wc_starter="#A855F7", wc_bench="#7B9CFF";
                    const borderColor=slot==="starter"?wc_starter:wc_bench;
                    return (
                      <div
                        draggable={isDraggable}
                        onDragStart={e=>{e.dataTransfer.setData("memberUid",m.uid);e.dataTransfer.setData("fromSlot",slot);}}
                        style={{background:isMe?"rgba(168,85,247,0.06)":"rgba(255,255,255,0.02)",border:`1px solid ${isMe?`${borderColor}44`:"rgba(255,255,255,0.06)"}`,borderRadius:14,padding:14,cursor:isDraggable?"grab":"default",transition:"all 0.2s",userSelect:"none"}}
                        onMouseEnter={e=>{if(isDraggable)e.currentTarget.style.borderColor=`${borderColor}88`;}}
                        onMouseLeave={e=>{e.currentTarget.style.borderColor=isMe?`${borderColor}44`:"rgba(255,255,255,0.06)";}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          {m.photoURL?<img src={m.photoURL} alt="" style={{width:36,height:36,borderRadius:"50%",flexShrink:0,border:`2px solid ${isMe?borderColor:"rgba(255,255,255,0.1)"}`}}/>:<div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,0.05)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>{"\uD83D\uDC64"}</div>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:700,color:isMe?borderColor:"#F0F0F0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.displayName}{isMe?" (you)":""}</div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{totalCards} cards</div>
                          </div>
                          {isDraggable&&<span style={{fontSize:14,color:"rgba(255,255,255,0.2)"}}>{"\u283F"}</span>}
                        </div>
                        {apexCards.length>0&&(
                          <div>
                            <div style={{fontSize:10,color:"#A855F7",fontWeight:700,marginBottom:4}}>Apex ({apexCards.length})</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                              {apexCards.slice(0,5).map(c=>{const wc=WEAPON_COLORS[c.weapon]||"#444";return <div key={c.id} title={`${c.hero} ${c.power} ${c.treatment}`} style={{background:`${wc}15`,border:`1px solid ${wc}33`,borderRadius:5,padding:"2px 6px",fontSize:9,color:wc,fontWeight:700}}>{c.hero?.split(" ")[0]} {c.power}</div>;})}
                              {apexCards.length>5&&<span style={{fontSize:9,color:"rgba(255,255,255,0.2)"}}>+{apexCards.length-5}</span>}
                            </div>
                          </div>
                        )}
                        {/* Move buttons */}
                        {isOwner&&m.uid!==user.uid&&(
                          <div style={{display:"flex",gap:6,marginTop:10}}>
                            {slot==="starter"&&bench.length<2&&(
                              <button onClick={()=>moveTeamMember(team,m.uid,"to_bench")} style={{fontSize:10,background:"rgba(123,156,255,0.1)",border:"1px solid rgba(123,156,255,0.2)",color:"#7B9CFF",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{"\u2192 Bench"}</button>
                            )}
                            {slot==="bench"&&starters.length<4&&(
                              <button onClick={()=>moveTeamMember(team,m.uid,"to_starter")} style={{fontSize:10,background:"rgba(168,85,247,0.1)",border:"1px solid rgba(168,85,247,0.2)",color:"#A855F7",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>{"\u2192 Starter"}</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  function DropZone({slot, label, color, members, maxCount}) {
                    const [over,setOver]=useState(false);
                    return (
                      <div
                        onDragOver={e=>{e.preventDefault();setOver(true);}}
                        onDragLeave={()=>setOver(false)}
                        onDrop={e=>{
                          e.preventDefault(); setOver(false);
                          const memberUid=e.dataTransfer.getData("memberUid");
                          const fromSlot=e.dataTransfer.getData("fromSlot");
                          if(fromSlot===slot)return;
                          if(slot==="starter"&&members.length>=4)return;
                          if(slot==="bench"&&members.length>=2)return;
                          moveTeamMember(team,memberUid,slot==="bench"?"to_bench":"to_starter");
                        }}
                        style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                          <div style={{fontSize:12,fontWeight:800,color,textTransform:"uppercase",letterSpacing:1.5}}>{label}</div>
                          <span style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontWeight:700}}>{members.length}/{maxCount}</span>
                        </div>
                        <div style={{
                          display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,
                          minHeight:90,borderRadius:14,padding:over?"12px":"0",
                          border:over?`2px dashed ${color}55`:"2px dashed transparent",
                          background:over?`${color}08`:"transparent",
                          transition:"all 0.15s"
                        }}>
                          {members.map(m=>(
                            <MemberCard key={m.uid} m={m} slot={slot} isDraggable={isOwner}/>
                          ))}
                          {members.length<maxCount&&(
                            <div style={{background:"rgba(255,255,255,0.01)",border:`1px dashed ${color}22`,borderRadius:14,minHeight:80,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
                              <span style={{fontSize:20,opacity:0.3}}>{slot==="bench"?"\uD83E\uDE91":"\u2B50"}</span>
                              <span style={{fontSize:10,color:"rgba(255,255,255,0.15)"}}>Empty {slot} slot</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Team header */}
                      <div style={{background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.15)",borderRadius:20,padding:24,marginBottom:16,backdropFilter:"blur(10px)"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
                          <div>
                            <div style={{fontSize:22,fontWeight:900,background:"linear-gradient(135deg,#A855F7,#7B9CFF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{team.name}</div>
                            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:4}}>{allMembers.length}/6 members &middot; Apex Madness &middot; Drag players to move between starter/bench</div>
                          </div>
                          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                            {allMembers.length<6&&isOwner&&(
                              <>
                                <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="Invite by email..." style={{...inp,width:200,fontSize:12}} onKeyDown={e=>e.key==="Enter"&&inviteToTeam(team)}/>
                                <button onClick={()=>inviteToTeam(team)} style={{background:"linear-gradient(135deg,#A855F7,#7B2FF7)",color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Invite</button>
                              </>
                            )}
                            {isOwner&&(
                              <button onClick={()=>deleteTeam(team)} style={{background:"rgba(232,49,122,0.08)",border:"1px solid rgba(232,49,122,0.2)",color:"rgba(232,49,122,0.6)",borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}
                                onMouseEnter={e=>{e.currentTarget.style.background="rgba(232,49,122,0.15)";e.currentTarget.style.color="#E8317A";}}
                                onMouseLeave={e=>{e.currentTarget.style.background="rgba(232,49,122,0.08)";e.currentTarget.style.color="rgba(232,49,122,0.6)";}}>
                                {"\uD83D\uDDD1 Delete Team"}</button>
                            )}
                          </div>
                        </div>
                        {inviteStatus&&<div style={{fontSize:12,color:inviteStatus.ok?"#4ade80":"#E8317A",marginBottom:12,fontWeight:600}}>{inviteStatus.ok?"\u2705":"\u274C"} {inviteStatus.msg}</div>}

                        {/* Starters + Bench with drag drop */}
                        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
                          <DropZone slot="starter" label="\u2B50 Starters" color="#A855F7" members={starters} maxCount={4}/>
                          <DropZone slot="bench" label="\uD83E\uDE91 Bench" color="#7B9CFF" members={bench} maxCount={2}/>
                        </div>
                      </div>

                      {/* Apex conflict panel */}
                      {allMembers.length>1&&(
                        conflicts.length===0?(
                          <div style={{background:"rgba(10,26,10,0.6)",border:"1px solid rgba(74,222,128,0.2)",borderRadius:16,padding:20,textAlign:"center",backdropFilter:"blur(10px)"}}>
                            <div style={{fontSize:24,marginBottom:8}}>{"\u2705"}</div>
                            <div style={{fontSize:14,fontWeight:700,color:"#4ade80"}}>No apex card conflicts</div>
                            <div style={{fontSize:12,color:"rgba(255,255,255,0.3)",marginTop:4}}>All team members have unique apex cards</div>
                          </div>
                        ):(
                          <div style={{background:"rgba(26,10,10,0.6)",border:"1px solid rgba(232,49,122,0.2)",borderRadius:16,padding:20,backdropFilter:"blur(10px)"}}>
                            <div style={{fontSize:14,fontWeight:800,color:"#E8317A",marginBottom:12}}>{"\u26A0\uFE0F"}{conflicts.length} Apex Conflict{conflicts.length!==1?"s":""}</div>
                            {conflicts.map(({card,members:mems},i)=>{
                              const wc=WEAPON_COLORS[card.weapon]||"#444";
                              return (
                                <div key={i} style={{display:"flex",alignItems:"center",gap:12,marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                                  <div style={{width:36,height:48,borderRadius:6,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,0.05)"}}>
                                    {card.imageUrl?<img src={card.imageUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:wc}}>{card.hero?.split(" ")[0]}</div>}
                                  </div>
                                  <div style={{flex:1}}>
                                    <div style={{fontSize:13,fontWeight:700,color:"#F0F0F0"}}>{card.hero} &middot; {card.power}\u26A1 &middot; {card.treatment}</div>
                                    <div style={{fontSize:11,color:"#E8317A",marginTop:2}}>Conflict: {mems.join(", ")}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
  );
}

function FriendsTab({ user, friends, friendReqs, sentReqs, addEmail, setAddEmail, addStatus, setAddStatus, friendOwned, viewingFriend, setViewingFriend, respondFriendReq, addFriend, cards, owned, privateCards, WEAPON_COLORS, setSigningIn , inp, teamInvites, sendFriendRequest, respondTeamInvite}) {
  return (
          <div style={{maxWidth:700,margin:"0 auto"}}>
            {!user?(
              <div style={{textAlign:"center",padding:80}}>
                <div style={{fontSize:48,marginBottom:16}}>{"\uD83D\uDC65"}</div>
                <button onClick={()=>setSigningIn(true)} style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:14,padding:"12px 28px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 8px 32px rgba(232,49,122,0.4)"}}>Sign in to add friends</button>
              </div>
            ):(
              <>
                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:20,marginBottom:12,backdropFilter:"blur(10px)"}}>
                  <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0",marginBottom:12}}>{"\u2795 Add Friend"}</div>
                  <div style={{display:"flex",gap:8}}>
                    <input value={addEmail} onChange={e=>setAddEmail(e.target.value)} placeholder="Their Google sign-in email..." style={{...inp,flex:1}} onKeyDown={e=>e.key==="Enter"&&sendFriendRequest()}/>
                    <button onClick={sendFriendRequest} style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"8px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(232,49,122,0.3)"}}>Send</button>
                  </div>
                  {addStatus&&<div style={{fontSize:12,color:addStatus.ok?"#4ade80":"#E8317A",marginTop:10,fontWeight:600}}>{addStatus.ok?"\u2705":"\u274C"} {addStatus.msg}</div>}
                </div>

                {friendReqs.length>0&&(
                  <div style={{background:"rgba(251,191,36,0.04)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:16,padding:20,marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#FBBF24",marginBottom:12}}>{"\uD83D\uDCEC Requests ("}{friendReqs.length})</div>
                    {friendReqs.map(r=>(
                      <div key={r.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{r.fromName}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{r.fromEmail}</div></div>
                        <button onClick={()=>respondFriendReq(r,true)} style={{background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.3)",color:"#4ade80",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"\u2705 Accept"}</button>
                        <button onClick={()=>respondFriendReq(r,false)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.3)",borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Decline</button>
                      </div>
                    ))}
                  </div>
                )}

                {teamInvites.length>0&&(
                  <div style={{background:"rgba(168,85,247,0.04)",border:"1px solid rgba(168,85,247,0.2)",borderRadius:16,padding:20,marginBottom:12}}>
                    <div style={{fontSize:13,fontWeight:800,color:"#A855F7",marginBottom:12}}>{"\uD83C\uDFC6 Team Invites ("}{teamInvites.length})</div>
                    {teamInvites.map(inv=>(
                      <div key={inv.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                        <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{inv.teamName}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>from {inv.fromName}</div></div>
                        <button onClick={()=>respondTeamInvite(inv,true)} style={{background:"rgba(168,85,247,0.15)",border:"1px solid rgba(168,85,247,0.3)",color:"#A855F7",borderRadius:8,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"\u2705 Join"}</button>
                        <button onClick={()=>respondTeamInvite(inv,false)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.3)",borderRadius:8,padding:"6px 14px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Decline</button>
                      </div>
                    ))}
                  </div>
                )}

                {sentReqs.length>0&&(
                  <div style={{background:"rgba(255,255,255,0.01)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:16,marginBottom:12}}>
                    <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.3)",marginBottom:8}}>Pending sent</div>
                    {sentReqs.map(r=><div key={r.id} style={{fontSize:12,color:"rgba(255,255,255,0.2)",marginBottom:4}}>{"\u23F3"}{r.toEmail}</div>)}
                  </div>
                )}

                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:20,backdropFilter:"blur(10px)"}}>
                  <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0",marginBottom:12}}>Friends ({friends.length})</div>
                  {friends.length===0?<div style={{fontSize:13,color:"rgba(255,255,255,0.3)"}}>No friends yet -- add someone above!</div>:
                    friends.map(f=>(
                      <div key={f.id} style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,paddingBottom:14,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                        <div style={{width:40,height:40,borderRadius:"50%",background:"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,border:"1.5px solid rgba(255,255,255,0.1)"}}>{"\uD83D\uDC64"}</div>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13,fontWeight:700}}>{f.friendName}</div>
                          <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{friendOwned[f.friendUid]?`${Object.keys(friendOwned[f.friendUid]).length} cards owned`:"Loading..."}</div>
                        </div>
                        <button onClick={()=>{setViewingFriend(viewingFriend===f.friendUid?null:f.friendUid);}}
                          style={{background:viewingFriend===f.friendUid?"rgba(123,156,255,0.2)":"rgba(255,255,255,0.04)",border:`1px solid ${viewingFriend===f.friendUid?"rgba(123,156,255,0.4)":"rgba(255,255,255,0.08)"}`,color:viewingFriend===f.friendUid?"#7B9CFF":"rgba(255,255,255,0.4)",borderRadius:10,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>
                          {viewingFriend===f.friendUid?"Hide":"\uD83D\uDC41 View"}
                        </button>
                      </div>
                    ))
                  }
                </div>

                {viewingFriend&&(()=>{
                  const f=friends.find(fr=>fr.friendUid===viewingFriend);
                  const fo=friendOwned[viewingFriend]||{};
                  const friendCards=cards.filter(c=>fo[c.id]);
                  return (
                    <div style={{marginTop:12,background:"rgba(123,156,255,0.03)",border:"1px solid rgba(123,156,255,0.15)",borderRadius:16,padding:20,backdropFilter:"blur(10px)",animation:"floatUp 0.3s ease"}}>
                      <div style={{fontSize:14,fontWeight:800,color:"#7B9CFF",marginBottom:12}}>{f?.friendName}'s Collection ({friendCards.length} cards)</div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:8,maxHeight:500,overflowY:"auto"}}>
                        {friendCards.map(c=>{
                          const wc=WEAPON_COLORS[c.weapon]||"#444";
                          return (
                            <div key={c.id} style={{background:"rgba(0,0,0,0.4)",border:`1px solid ${wc}22`,borderRadius:12,padding:10,backdropFilter:"blur(4px)"}}>
                              {c.imageUrl&&<img src={c.imageUrl} alt={c.hero} style={{width:"100%",aspectRatio:"3/4",objectFit:"cover",borderRadius:8,marginBottom:6}}/>}
                              <div style={{fontSize:12,fontWeight:700,color:"#F0F0F0"}}>{c.hero}</div>
                              <div style={{fontSize:10,color:wc,fontWeight:700}}>{c.weapon}</div>
                              <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{c.treatment}</div>
                              <div style={{fontSize:11,fontWeight:800,color:wc,marginTop:2}}>{c.power}\u26A1</div>
                              {fo[c.id]>1&&<div style={{fontSize:10,color:"#FBBF24",fontWeight:700}}>{"\u00D7"}{fo[c.id]}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
  );
}

function PlaybookTab({ user, pbCards, pbSearch, setPbSearch, pbSort, setPbSort, WEAPON_COLORS, setSigningIn, cards, owned, inp }) {
  const playCards=cards.filter(c=>{const t=(c.treatment||"").toLowerCase();return t==="plays"||t==="bonus plays"||t==="home team discount";});
  const pbEntryIds=new Set(pbCards.map(e=>e.id));
  const playCount=pbCards.filter(e=>e.type==="play").length;
  const bonusCount=pbCards.filter(e=>e.type==="bonus").length;
  const playFull=playCount>=PUBLIC_PLAY_LIMIT;
  const pbResolved=pbCards.map(e=>({...e,card:cards.find(c=>c.id===e.id)})).filter(e=>e.card);
  const totalDbs=pbResolved.reduce((s,e)=>s+(parseFloat(e.card.dbs)||0),0);
  const dbsLeft=PUBLIC_DBS_CAP-totalDbs, dbsPct=Math.min(totalDbs/PUBLIC_DBS_CAP*100,100), dbsOver=totalDbs>PUBLIC_DBS_CAP;
  const isPlay=c=>{const t=(c.treatment||"").toLowerCase();return t==="plays"||t==="home team discount";};
  const isBonus=c=>(c.treatment||"").toLowerCase()==="bonus plays";
  const pbAvail=playCards.filter(c=>{if(pbEntryIds.has(c.id))return false;if(pbSearch&&!`${c.hero} ${c.cardNum} ${c.playAbility||""}`.toLowerCase().includes(pbSearch.toLowerCase()))return false;return true;}).sort((a,b)=>{if(pbSort==="dbs_desc")return(parseFloat(b.dbs)||0)-(parseFloat(a.dbs)||0);if(pbSort==="dbs_asc")return(parseFloat(a.dbs)||0)-(parseFloat(b.dbs)||0);return(a.hero||"").localeCompare(b.hero||"");});
  return (
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) clamp(260px,28%,340px)",gap:16,alignItems:"start"}}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div className="filter-bar" style={{display:"flex",gap:8,flexWrap:"wrap",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"12px 16px",backdropFilter:"blur(10px)"}}>
                  <input value={pbSearch} onChange={e=>setPbSearch(e.target.value)} placeholder="Search play or ability..." style={{...inp,flex:1}}/>
                  <select value={pbSort} onChange={e=>setPbSort(e.target.value)} style={{...inp,width:"auto",cursor:"pointer"}}>
                    <option value="name">{"Name A\u2192Z"}</option>
                    <option value="dbs_desc">{"DBS High\u2192Low"}</option>
                    <option value="dbs_asc">{"DBS Low\u2192High"}</option>
                  </select>
                  <span style={{fontSize:11,color:"rgba(255,255,255,0.2)",alignSelf:"center"}}>{pbAvail.length} plays</span>
                </div>
                <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,overflow:"hidden",maxHeight:"calc(100vh - 300px)",overflowY:"auto"}}>
                  {pbAvail.map((c,i)=>{
                    const wc=WEAPON_COLORS[c.weapon]||"#444",wouldExceed=totalDbs+(parseFloat(c.dbs)||0)>PUBLIC_DBS_CAP;
                    return (
                      <div key={c.id} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px"}}>
                          {c.imageUrl&&<img src={c.imageUrl} alt={c.hero} style={{width:36,height:48,objectFit:"cover",borderRadius:6,flexShrink:0}}/>}
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:13,fontWeight:800,color:"#F0F0F0"}}>{c.hero}</div>
                            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:2,fontSize:10}}>
                              <span style={{color:"rgba(255,255,255,0.3)"}}>#{c.cardNum}</span>
                              {c.playCost!==undefined&&c.playCost!==""&&<span style={{color:"#FBBF24",fontWeight:700}}>Cost: {c.playCost}</span>}
                              {c.dbs!==undefined&&<span style={{color:"#A855F7",fontWeight:700}}>DBS: {c.dbs}</span>}
                            </div>
                            {c.playAbility&&<div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontStyle:"italic",lineHeight:1.4}}>{c.playAbility}</div>}
                          </div>
                          <div style={{display:"flex",flexDirection:"column",gap:4,flexShrink:0}}>
                            {isPlay(c)&&<button onClick={()=>{if(!playFull&&!wouldExceed)setPbCards(p=>[...p,{id:c.id,type:"play"}]);}} disabled={playFull||wouldExceed} style={{background:playFull||wouldExceed?"rgba(255,255,255,0.03)":"rgba(232,49,122,0.15)",border:`1px solid ${playFull||wouldExceed?"rgba(255,255,255,0.08)":"rgba(232,49,122,0.4)"}`,color:playFull||wouldExceed?"rgba(255,255,255,0.2)":"#E8317A",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:playFull||wouldExceed?"not-allowed":"pointer",fontFamily:"inherit"}}>+ Play</button>}
                            {isBonus(c)&&<button onClick={()=>{if(!wouldExceed)setPbCards(p=>[...p,{id:c.id,type:"bonus"}]);}} disabled={wouldExceed} style={{background:wouldExceed?"rgba(255,255,255,0.03)":"rgba(123,156,255,0.15)",border:`1px solid ${wouldExceed?"rgba(255,255,255,0.08)":"rgba(123,156,255,0.4)"}`,color:wouldExceed?"rgba(255,255,255,0.2)":"#7B9CFF",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,cursor:wouldExceed?"not-allowed":"pointer",fontFamily:"inherit"}}>+ BPL</button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:18,backdropFilter:"blur(10px)"}}>
                <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0",marginBottom:14}}>{"\uD83D\uDCD6 Playbook"}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  {[{l:"Plays",v:`${playCount}/${PUBLIC_PLAY_LIMIT}`,c:playFull?"#E8317A":"#4ade80"},{l:"Bonus",v:bonusCount,c:"#7B9CFF"}].map(({l,v,c})=>(
                    <div key={l} style={{background:"rgba(0,0,0,0.3)",borderRadius:10,padding:"10px",textAlign:"center",border:"1px solid rgba(255,255,255,0.05)"}}>
                      <div style={{fontSize:20,fontWeight:900,color:c}}>{v}</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>
                <div style={{marginBottom:12}}>
                  <div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:2,overflow:"hidden",marginBottom:4}}>
                    <div style={{width:`${Math.min(playCount/PUBLIC_PLAY_LIMIT*100,100)}%`,height:"100%",background:playFull?"#E8317A":"linear-gradient(90deg,#E8317A,#7B2FF7)",borderRadius:2,transition:"width 0.3s"}}/>
                  </div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{PUBLIC_PLAY_LIMIT-playCount} play slots left</div>
                </div>
                <div style={{background:dbsOver?"rgba(232,49,122,0.05)":"rgba(0,0,0,0.3)",border:`1px solid ${dbsOver?"rgba(232,49,122,0.3)":"rgba(255,255,255,0.05)"}`,borderRadius:10,padding:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <span style={{fontSize:11,fontWeight:800,color:dbsOver?"#E8317A":"#A855F7"}}>{"\uD83D\uDCB0 DBS Budget"}</span>
                    <span style={{fontSize:11,fontWeight:700,color:dbsOver?"#E8317A":dbsPct>80?"#FBBF24":"#4ade80"}}>{Math.round(totalDbs)} / {PUBLIC_DBS_CAP}</span>
                  </div>
                  <div style={{height:6,background:"rgba(255,255,255,0.05)",borderRadius:3,overflow:"hidden",marginBottom:6}}>
                    <div style={{width:`${dbsPct}%`,height:"100%",background:dbsOver?"#E8317A":dbsPct>80?"linear-gradient(90deg,#FBBF24,#E8317A)":"linear-gradient(90deg,#A855F7,#7B9CFF)",borderRadius:3,transition:"width 0.3s"}}/>
                  </div>
                  <div style={{fontSize:10,color:dbsOver?"#E8317A":dbsLeft<100?"#FBBF24":"rgba(255,255,255,0.3)",fontWeight:dbsOver?700:400}}>{dbsOver?`\u26A0\uFE0F Over by ${Math.round(totalDbs-PUBLIC_DBS_CAP)}`:`${Math.round(dbsLeft)} remaining`}</div>
                </div>
                {pbResolved.length>0&&(
                  <div style={{marginTop:12}}>
                    {[{type:"play",label:"\u2694\uFE0F Plays",color:"#E8317A"},{type:"bonus",label:"\u2B50 Bonus",color:"#7B9CFF"}].map(({type,label,color})=>{
                      const entries=pbResolved.filter(e=>e.type===type);
                      if(!entries.length)return null;
                      return (
                        <div key={type} style={{marginBottom:8}}>
                          <div style={{fontSize:10,color:color,fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{label} ({entries.length})</div>
                          {entries.map((e,i)=>{
                            const c=e.card;
                            return (
                              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                                <span style={{fontSize:10,color:"rgba(255,255,255,0.2)",width:16,textAlign:"center"}}>{type==="play"?i+1:`B${i+1}`}</span>
                                {c.imageUrl&&<img src={c.imageUrl} alt={c.hero} style={{width:24,height:32,objectFit:"cover",borderRadius:3,flexShrink:0}}/>}
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:11,fontWeight:700,color:color}}>{c.hero}</div>
                                  {c.dbs&&<div style={{fontSize:10,color:"#A855F7"}}>DBS: {c.dbs}</div>}
                                </div>
                                <button onClick={()=>{const arr=pbCards.filter(x=>x.type===type);const target=arr[i];const gi=pbCards.indexOf(target);const a=[...pbCards];a.splice(gi,1);setPbCards(a);}} style={{background:"none",border:"none",color:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:16,padding:"2px 4px",flexShrink:0}}>{"\u00D7"}</button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    <button onClick={()=>{if(window.confirm("Clear playbook?"))setPbCards([]);}} style={{width:"100%",background:"transparent",border:"1px solid rgba(232,49,122,0.15)",color:"rgba(232,49,122,0.4)",borderRadius:8,padding:"5px 0",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",marginTop:8}}>{"\u2715 Clear"}</button>
                  </div>
                )}
              </div>
            </div>
  );
}

function DeckBuilderTab({ user, deckCards, setDeckCards, deckName, setDeckName, deckType, setDeckType, deckSearch, setDeckSearch, deckFilterW, setDeckFilterW, deckFilterP, setDeckFilterP, deckFilterS, setDeckFilterS, deckFilterT, setDeckFilterT, WEAPON_COLORS, setSigningIn, cards, owned, inp, canAddToDeck }) {
  const weapons    = [...new Set(cards.map(c=>c.weapon).filter(Boolean))].sort();
  const sets       = [...new Set(cards.map(c=>c.setName).filter(Boolean))].sort();
  const treatments = [...new Set(cards.map(c=>c.treatment).filter(Boolean))].sort();
  const DECK_SIZE = 60;
  const deckSet = new Set(deckCards);
  const inDeck = cards.filter(c=>deckSet.has(c.id));
  const isSpec = deckType==="spec", isAM = deckType==="apexmadness";
  const dupKey = c=>`${(c.hero||"").toLowerCase()}|${(c.variation||"").toLowerCase()}|${c.power||""}|${(c.weapon||"").toLowerCase()}`;
  const inDeckDupKeys = new Set(inDeck.map(dupKey));
  const powerCount = {}; inDeck.forEach(c=>{const p=c.power||"0"; powerCount[p]=(powerCount[p]||0)+1;});
  const treatCore={}, treatApex={};
  if(isAM){inDeck.forEach(c=>{const t=(c.treatment||"").toLowerCase(),p=parseFloat(c.power||0);if(p>=115&&p<=160){treatCore[t]=(treatCore[t]||0)+1;}else if(p>160){treatApex[t]=(treatApex[t]||0)+1;}});}
  const deckAvail = cards.filter(c=>{
    if(deckSet.has(c.id)) return false;
    if(deckFilterW && c.weapon!==deckFilterW) return false;
    if(deckFilterP && deckFilterP.size>0 && !deckFilterP.has(String(c.power||""))) return false;
    if(deckFilterS && c.setName!==deckFilterS) return false;
    if(deckFilterT && c.treatment!==deckFilterT) return false;
    if(deckSearch && !`${c.hero} ${c.cardNum} ${c.treatment}`.toLowerCase().includes(deckSearch.toLowerCase())) return false;
    const t=(c.treatment||"").toLowerCase();
    if(t==="plays"||t==="bonus plays"||t==="home team discount") return false;
    return true;
  }).sort((a,b)=>(parseFloat(b.power)||0)-(parseFloat(a.power)||0));
  return (
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) clamp(260px,28%,340px)",gap:16,alignItems:"start"}}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div className="filter-bar" style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:"12px 16px",backdropFilter:"blur(10px)"}}>
                <input value={deckSearch} onChange={e=>setDeckSearch(e.target.value)} placeholder="Search hero, treatment..." style={{...inp,flex:1,minWidth:160}}/>
                <select value={deckType} onChange={e=>setDeckType(e.target.value)} style={{...inp,width:"auto",cursor:"pointer",fontWeight:700,color:deckType==="spec"?"#FBBF24":deckType==="apexmadness"?"#E8317A":deckType==="apex"?"#A855F7":"rgba(255,255,255,0.4)"}}>
                  <option value="none">No Restrictions</option>
                  <option value="spec">{"Spec Deck (\u2264160)"}</option>
                  <option value="apex">Apex Deck</option>
                  <option value="apexmadness">Apex Madness</option>
                </select>
                <select value={deckFilterW} onChange={e=>setDeckFilterW(e.target.value)} style={{...inp,width:"auto",cursor:"pointer"}}>
                  <option value="">All Weapons</option>{weapons.map(w=><option key={w} value={w}>{w}</option>)}
                </select>
                <select value={deckFilterS} onChange={e=>setDeckFilterS(e.target.value)} style={{...inp,width:"auto",cursor:"pointer",color:deckFilterS?"#7B9CFF":"rgba(255,255,255,0.4)"}}>
                  <option value="">All Sets</option>{sets.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
                <select value={deckFilterT} onChange={e=>setDeckFilterT(e.target.value)} style={{...inp,width:"auto",cursor:"pointer",color:deckFilterT?"#FBBF24":"rgba(255,255,255,0.4)"}}>
                  <option value="">All Treatments</option>{treatments.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>{deckAvail.length}</span>
              </div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {[...new Set(cards.map(c=>c.power).filter(Boolean))].sort((a,b)=>parseFloat(b)-parseFloat(a)).map(p=>{
                  const sel=deckFilterP.has(p),over=(isSpec||isAM)&&parseFloat(p)>160;
                  return <button key={p} onClick={()=>setDeckFilterP(prev=>{const n=new Set(prev);n.has(p)?n.delete(p):n.add(p);return n;})}
                    style={{background:sel?(over?"rgba(232,49,122,0.3)":"rgba(251,191,36,0.15)"):"rgba(255,255,255,0.03)",border:`1px solid ${sel?(over?"#E8317A":"#FBBF24"):"rgba(255,255,255,0.08)"}`,color:sel?(over?"#E8317A":"#FBBF24"):"rgba(255,255,255,0.3)",borderRadius:20,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s"}}>{p}{over?" \u26A0":""}</button>;
                })}
                {deckFilterP.size>0&&<button onClick={()=>setDeckFilterP(new Set())} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",borderRadius:20,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>{"\u2715"}</button>}
              </div>
              <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:14,overflow:"hidden",maxHeight:"calc(100vh - 340px)",overflowY:"auto",backdropFilter:"blur(10px)"}}>
                {deckAvail.length===0?<div style={{padding:40,textAlign:"center",color:"rgba(255,255,255,0.2)"}}>No cards match filters</div>:
                  deckAvail.map((c,i)=>{
                    const {ok,reason}=canAddToDeck(c),wc=WEAPON_COLORS[c.weapon]||"#444";
                    return (
                      <div key={c.id} onClick={()=>{if(ok)setDeckCards(p=>[...p,c.id]);}}
                        style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderBottom:"1px solid rgba(255,255,255,0.04)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)",cursor:ok?"pointer":"not-allowed",opacity:ok?1:0.35,transition:"background 0.12s"}}
                        title={!ok?reason:""}
                        onMouseEnter={e=>{if(ok)e.currentTarget.style.background="rgba(232,49,122,0.05)";}}
                        onMouseLeave={e=>{e.currentTarget.style.background=i%2===0?"transparent":"rgba(255,255,255,0.01)";}}>
                        {c.imageUrl&&<img src={c.imageUrl} alt={c.hero} style={{width:32,height:43,objectFit:"cover",borderRadius:5,flexShrink:0}}/>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:800,color:"#F0F0F0"}}>{c.hero}</div>
                          <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:1}}>{c.treatment} &middot; #{c.cardNum}</div>
                          {!ok&&<div style={{fontSize:10,color:"#E8317A",marginTop:1}}>{reason}</div>}
                        </div>
                        <div style={{fontSize:16,fontWeight:900,color:ok?wc:"rgba(255,255,255,0.2)",flexShrink:0}}>{c.power}</div>
                        {ok&&<div style={{fontSize:18,color:"#4ade80",flexShrink:0}}>+</div>}
                      </div>
                    );
                  })
                }
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:18,backdropFilter:"blur(10px)"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                <div style={{fontSize:14,fontWeight:800,color:"#F0F0F0"}}>{"\u2694\uFE0F"}{deckName}</div>
                <span style={{fontSize:12,fontWeight:700,color:inDeck.length===DECK_SIZE?"#4ade80":"#FBBF24"}}>{inDeck.length}/{DECK_SIZE}</span>
              </div>
              {isAM&&inDeck.length>0&&(
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10,color:"#A855F7",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>Treatment Unlocks</div>
                  {[...new Set(inDeck.map(c=>c.treatment).filter(Boolean))].sort().map(t=>{
                    const tl=t.toLowerCase(),core=treatCore[tl]||0,apex=treatApex[tl]||0,unlocked=core>=10;
                    return (
                      <div key={t} style={{marginBottom:7}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                          <span style={{fontSize:11,color:unlocked?"#A855F7":"rgba(255,255,255,0.4)",fontWeight:unlocked?700:400}}>{unlocked?"\uD83D\uDD13":"\uD83D\uDD12"} {t}</span>
                          <span style={{fontSize:11,color:unlocked?"#A855F7":"rgba(255,255,255,0.3)"}}>{core}/10{unlocked?` &middot; ${apex}/1`:""}</span>
                        </div>
                        <div style={{height:3,background:"rgba(255,255,255,0.06)",borderRadius:2}}>
                          <div style={{width:`${Math.min(100,core/10*100)}%`,height:"100%",background:unlocked?"linear-gradient(90deg,#A855F7,#7B2FF7)":"rgba(255,255,255,0.15)",borderRadius:2,transition:"width 0.3s"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:3,marginBottom:12}}>
                {Array.from({length:DECK_SIZE}).map((_,i)=>{
                  const c=inDeck[i];
                  if(c){const wc=WEAPON_COLORS[c.weapon]||"#444";return(<div key={i} title={`${c.hero} ${c.power}`} onClick={()=>setDeckCards(p=>p.filter(id=>id!==c.id))} style={{aspectRatio:"3/4",borderRadius:4,overflow:"hidden",cursor:"pointer",border:`1.5px solid ${wc}33`,background:"#111"}}>{c.imageUrl?<img src={c.imageUrl} alt={c.hero} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:7,color:wc,fontWeight:700,textAlign:"center",padding:2}}>{c.hero?.split(" ")[0]}</div>}</div>);}
                  return <div key={i} style={{aspectRatio:"3/4",borderRadius:4,border:"1px dashed rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.01)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:8,color:"rgba(255,255,255,0.1)",fontWeight:700}}>{i+1}</span></div>;
                })}
              </div>
              {inDeck.length>0&&<button onClick={()=>{if(window.confirm("Clear deck?"))setDeckCards([]);}} style={{width:"100%",background:"transparent",border:"1px solid rgba(232,49,122,0.15)",color:"rgba(232,49,122,0.5)",borderRadius:10,padding:"6px 0",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(232,49,122,0.4)";e.currentTarget.style.color="#E8317A";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(232,49,122,0.15)";e.currentTarget.style.color="rgba(232,49,122,0.5)";}}>
                {"\u2715 Clear deck"}</button>}
            </div>
          </div>
  );
}

function OfferModal({ offerModal, offerSent, setOfferModal, offerAmt, setOfferAmt, offerNote, setOfferNote, setOfferSent, submitOffer, inp }) {
  if (!offerModal) return null;
  return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}
          onClick={()=>{if(offerSent){setOfferModal(null);setOfferAmt("");setOfferNote("");setOfferSent(false);}}}>
          <div style={{background:"linear-gradient(135deg,#0d0d0d,#1a1400)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:20,padding:28,maxWidth:400,width:"100%"}} onClick={e=>e.stopPropagation()}>
            {offerSent?(
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:52,marginBottom:16}}>{"\uD83E\uDD1D"}</div>
                <div style={{fontSize:20,fontWeight:900,color:"#4ade80",marginBottom:8}}>Offer Sent!</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,0.6)",marginBottom:6}}>
                  Your offer of <strong style={{color:"#FBBF24"}}>{"$"}{parseFloat(offerAmt||0).toFixed(2)}</strong> on
                </div>
                <div style={{fontSize:15,fontWeight:800,color:"#F0F0F0",marginBottom:6}}>
                  {offerModal.cardName}
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:24}}>
                  has been sent to the seller. {"\u2022"} {"\u2022"} {"\u2022"}<br/>
                  {"You'll be notified when they respond."}
                </div>
                <button
                  onClick={()=>{setOfferModal(null);setOfferAmt("");setOfferNote("");setOfferSent(false);}}
                  style={{background:"linear-gradient(135deg,#FBBF24,#F59E0B)",color:"#000",border:"none",borderRadius:12,padding:"12px 32px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                  Done
                </button>
              </div>
            ):(
              <>
                <div style={{fontSize:18,fontWeight:900,color:"#FBBF24",marginBottom:4}}>{"\uD83E\uDD1D Make an Offer"}</div>
                <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:16}}>{offerModal.cardName} {"\u00B7"} {offerModal.sellerName}</div>

                {!offerModal?.isOBO&&<div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"12px 14px",marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>Asking price</span>
                    <span style={{fontSize:16,fontWeight:900,color:"#F0F0F0"}}>{"$"}{(offerModal.askingPrice||0).toFixed(2)}</span>
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:6}}>Quick offer</div>
                  <div style={{display:"flex",gap:6}}>
                    {[100,95,90,85,80].map(pct=>{
                      const qAmt=((offerModal.askingPrice||0)*pct/100).toFixed(2);
                      const active=offerAmt===qAmt;
                      return (
                        <button key={pct} onClick={()=>setOfferAmt(qAmt)}
                          style={{flex:1,background:active?"rgba(251,191,36,0.25)":"rgba(255,255,255,0.05)",
                            border:"1px solid "+(active?"rgba(251,191,36,0.5)":"rgba(255,255,255,0.08)"),
                            borderRadius:8,padding:"5px 0",fontSize:11,fontWeight:700,
                            color:active?"#FBBF24":"rgba(255,255,255,0.5)",
                            cursor:"pointer",fontFamily:"inherit"}}>
                          {pct}{"%"}
                        </button>
                      );
                    })}
                  </div>
                </div>}

                <div style={{marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
                    <span style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(251,191,36,0.2)",borderRight:"none",borderRadius:"10px 0 0 10px",padding:"10px 14px",fontSize:15,color:"rgba(255,255,255,0.4)",fontWeight:700}}>$</span>
                    <input value={offerAmt} onChange={e=>setOfferAmt(e.target.value)} placeholder="0.00" type="number" min="0" step="0.01"
                      style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(251,191,36,0.2)",borderLeft:"none",borderRight:"none",padding:"10px 14px",fontSize:15,color:"#F0F0F0",fontFamily:"inherit",outline:"none"}}/>
                    <span style={{
                      background:"rgba(255,255,255,0.05)",border:"1px solid rgba(251,191,36,0.2)",borderLeft:"none",
                      borderRadius:"0 10px 10px 0",padding:"10px 12px",fontSize:13,fontWeight:800,minWidth:52,textAlign:"center",
                      color:"rgba(255,255,255,0.3)"}}>
                      {offerModal?.isOBO||!offerModal?.askingPrice?"--":offerAmt&&!isNaN(parseFloat(offerAmt))?Math.round(parseFloat(offerAmt)/(offerModal.askingPrice||1)*100)+"%":"--"}
                    </span>
                  </div>
                  {offerAmt&&!isNaN(parseFloat(offerAmt))&&!offerModal?.isOBO&&offerModal?.askingPrice>0&&(()=>{
                    const oa=parseFloat(offerAmt);
                    const ask=offerModal.askingPrice||0;
                    const pct=ask>0?oa/ask*100:0;
                    const savings=ask-oa;
                    const barColor=pct>=95?"#4ade80":pct>=85?"#FBBF24":pct>=75?"#F97316":"#f87171";
                    const verdict=pct>=100?"Full ask":pct>=95?"Strong offer":pct>=85?"Fair offer":pct>=75?"Low offer":"Very low";
                    return (
                      <div>
                        <div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:4,marginBottom:6,overflow:"hidden"}}>
                          <div style={{height:"100%",width:Math.min(pct,100)+"%",background:barColor,borderRadius:4,transition:"width 0.2s"}}/>
                        </div>
                        <div style={{display:"flex",justifyContent:"space-between"}}>
                          <span style={{fontSize:11,color:barColor,fontWeight:700}}>{verdict}</span>
                          {savings>0&&<span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>{"$"}{savings.toFixed(2)} off ask</span>}
                          {savings<0&&<span style={{fontSize:11,color:"#f87171"}}>{"$"}{Math.abs(savings).toFixed(2)} over ask</span>}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <textarea value={offerNote} onChange={e=>setOfferNote(e.target.value)} placeholder="Message to seller (optional)" rows={2}
                  style={{width:"100%",marginBottom:16,boxSizing:"border-box",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#F0F0F0",fontFamily:"inherit",outline:"none",resize:"none"}}/>
                <div style={{display:"flex",gap:10}}>
                  <button onClick={submitOffer} disabled={!offerAmt||isNaN(parseFloat(offerAmt))} style={{flex:1,background:"linear-gradient(135deg,#FBBF24,#F59E0B)",color:"#000",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:offerAmt&&!isNaN(parseFloat(offerAmt))?1:0.4}}>Send Offer</button>
                  <button onClick={()=>setOfferModal(null)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",borderRadius:12,padding:"12px 20px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
  );
}

function CounterModal({ counterModal, counterSent, setCounterModal, counterAmt, setCounterAmt, setCounterSent, counterOffer, negHistory }) {
  if (!counterModal) return null;
  return (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}
          onClick={()=>{if(counterSent){setCounterModal(null);setCounterAmt("");setCounterSent(false);}}}>
          <div style={{background:"#0E0E14",border:"1px solid rgba(251,191,36,0.3)",borderRadius:20,padding:28,maxWidth:420,width:"100%"}} onClick={e=>e.stopPropagation()}>
            {counterSent?(
              <div style={{textAlign:"center",padding:"20px 0"}}>
                <div style={{fontSize:52,marginBottom:16}}>{"\uD83E\uDD1D"}</div>
                <div style={{fontSize:20,fontWeight:900,color:"#4ade80",marginBottom:8}}>Counter Sent!</div>
                <div style={{fontSize:14,color:"rgba(255,255,255,0.6)",marginBottom:6}}>
                  Your counter of <strong style={{color:"#FBBF24"}}>{"$"}{parseFloat(counterAmt||0).toFixed(2)}</strong> on
                </div>
                <div style={{fontSize:15,fontWeight:800,color:"#F0F0F0",marginBottom:6}}>{counterModal.cardName}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.35)",marginBottom:24}}>
                  has been sent. {"\u2022"} {"\u2022"} {"\u2022"}<br/>
                  {"You'll be notified when they respond."}
                </div>
                <button
                  onClick={()=>{setCounterModal(null);setCounterAmt("");setCounterSent(false);}}
                  style={{background:"linear-gradient(135deg,#FBBF24,#F59E0B)",color:"#000",border:"none",borderRadius:12,padding:"12px 32px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                  Done
                </button>
              </div>
            ):(
              <>
                <div style={{fontSize:16,fontWeight:800,color:"#F0F0F0",marginBottom:4}}>Counter Offer</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.4)",marginBottom:20}}>{counterModal.cardName}</div>
                <div style={{background:"rgba(251,191,36,0.06)",border:"1px solid rgba(251,191,36,0.15)",borderRadius:12,padding:"12px 16px",marginBottom:20,maxHeight:160,overflowY:"auto"}}>
                  <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:8,fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Negotiation history</div>
                  {negHistory.length>0?negHistory.map((h,idx)=>{
                    const isCounter=h.action==="counter";
                    const isAccept=h.action==="accepted";
                    const isDecline=h.action==="declined";
                    const color=isAccept?"#4ade80":isDecline?"#f87171":isCounter?"#7B9CFF":"#FBBF24";
                    const label=isAccept?"Accepted":isDecline?"Declined":isCounter?"Countered":"Offered";
                    return (
                      <div key={idx} style={{display:"flex",alignItems:"center",gap:8,marginBottom:idx<negHistory.length-1?6:0}}>
                        <div style={{width:6,height:6,borderRadius:"50%",background:color,flexShrink:0}}/>
                        <span style={{fontSize:12,color:"rgba(255,255,255,0.5)",flex:1}}>{h.fromName}</span>
                        <span style={{fontSize:12,fontWeight:700,color:color}}>{label} ${(h.amount||0).toFixed(2)}</span>
                      </div>
                    );
                  }):(
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:"#FBBF24",flexShrink:0}}/>
                      <span style={{fontSize:12,color:"rgba(255,255,255,0.5)",flex:1}}>{counterModal.buyerName||"Buyer"}</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#FBBF24"}}>Offered ${(counterModal.offerAmount||0).toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",marginBottom:8,fontWeight:700}}>Your counter amount</div>
                  <div style={{display:"flex",alignItems:"center",gap:0}}>
                    <span style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRight:"none",borderRadius:"8px 0 0 8px",padding:"10px 14px",fontSize:15,color:"rgba(255,255,255,0.4)",fontWeight:700}}>$</span>
                    <input
                      value={counterAmt}
                      onChange={e=>setCounterAmt(e.target.value.replace(/[^0-9.]/g,""))}
                      placeholder="0.00"
                      style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderLeft:"none",borderRadius:"0 8px 8px 0",padding:"10px 14px",fontSize:15,color:"#F0F0F0",fontFamily:"inherit",outline:"none"}}
                      autoFocus
                    />
                  </div>
                </div>
                <div style={{display:"flex",gap:10}}>
                  <button
                    onClick={()=>counterOffer(counterModal,counterAmt)}
                    disabled={!counterAmt||isNaN(parseFloat(counterAmt))}
                    style={{flex:1,background:"linear-gradient(135deg,rgba(251,191,36,0.8),rgba(245,158,11,0.8))",color:"#000",border:"none",borderRadius:12,padding:"12px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:counterAmt&&!isNaN(parseFloat(counterAmt))?1:0.4}}>
                    Send Counter
                  </button>
                  <button
                    onClick={()=>setCounterModal(null)}
                    style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",borderRadius:12,padding:"12px 20px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

  );
}

function ScanModal({ scanModal, setScanModal, photoScan, setPhotoScan, scanSession, setScanSession, scanQty, setScanQty, user, db, owned, setOwned, cards, inp , confirmScan, scanCardPhoto}) {
  if (!scanModal) return null;
  return (
        <div style={{position:"fixed",inset:0,background:"#000",zIndex:9997,display:"flex",flexDirection:"column"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",background:"rgba(10,10,10,0.95)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(232,49,122,0.2)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18,fontWeight:900,background:"linear-gradient(135deg,#E8317A,#7B2FF7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{"\uD83D\uDCF7 Scan Mode"}</span>
              {scanSession.length>0&&<span style={{fontSize:12,background:"rgba(232,49,122,0.15)",color:"#E8317A",border:"1px solid rgba(232,49,122,0.3)",borderRadius:20,padding:"3px 12px",fontWeight:700}}>{scanSession.length} added</span>}
            </div>
            <button onClick={()=>{setScanModal(false);setPhotoScan(null);}} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.6)",borderRadius:10,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)"}}>Done</button>
          </div>
          <div style={{flex:1,padding:20,overflowY:"auto"}}>
            {!photoScan&&(
              <label style={{display:"block",cursor:"pointer"}}>
                <div style={{background:"linear-gradient(135deg,rgba(232,49,122,0.05),rgba(123,47,247,0.05))",border:"2px dashed rgba(232,49,122,0.3)",borderRadius:20,padding:"50px 20px",textAlign:"center",transition:"all 0.2s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(232,49,122,0.6)"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(232,49,122,0.3)"}>
                  <div style={{fontSize:56,marginBottom:12}}>{"\uD83D\uDCF7"}</div>
                  <div style={{fontSize:18,fontWeight:800,background:"linear-gradient(135deg,#E8317A,#7B2FF7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:6}}>Tap to scan a card</div>
                  <div style={{fontSize:12,color:"rgba(255,255,255,0.3)"}}>Opens your camera -- identify any BoBA card instantly</div>
                </div>
                <input type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoScan(null);scanCardPhoto(f);}e.target.value="";}} style={{position:"absolute",opacity:0,width:1,height:1,pointerEvents:"none"}}/>
              </label>
            )}
            {photoScan?.status==="scanning"&&(
              <div style={{textAlign:"center",padding:50}}>
                <div style={{width:48,height:48,border:"3px solid rgba(123,156,255,0.2)",borderTopColor:"#7B9CFF",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 16px"}}/>
                <div style={{fontSize:15,fontWeight:700,color:"#7B9CFF"}}>Reading card...</div>
              </div>
            )}
            {photoScan?.status==="matched"&&photoScan.card&&(()=>{
              const c=photoScan.card,wc=WEAPON_COLORS[c.weapon]||"#888";
              return (
                <div style={{background:`linear-gradient(135deg,rgba(10,26,10,0.8),rgba(0,0,0,0.8))`,border:`1.5px solid rgba(74,222,128,0.3)`,borderRadius:20,padding:20,backdropFilter:"blur(10px)",animation:"floatUp 0.3s ease"}}>
                  <div style={{display:"flex",gap:14,marginBottom:16}}>
                    {c.imageUrl?<img src={c.imageUrl} alt={c.hero} style={{width:80,height:107,objectFit:"cover",borderRadius:10,flexShrink:0,boxShadow:"0 8px 32px rgba(0,0,0,0.5)"}}/>:<div style={{width:80,height:107,background:"#1a1a1a",borderRadius:10,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#555"}}>{c.hero}</div>}
                    <div>
                      <div style={{fontSize:18,fontWeight:900,color:"#F0F0F0",marginBottom:4}}>{c.hero}</div>
                      <div style={{fontSize:12,color:wc,fontWeight:700,marginBottom:2}}>{c.weapon}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{c.treatment}</div>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>#{c.cardNum} &middot; {c.setName}</div>
                      <div style={{fontSize:20,fontWeight:900,color:wc,marginTop:6}}>{c.power}\u26A1</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
                    <button onClick={()=>setScanQty(q=>Math.max(1,q-1))} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#F0F0F0",borderRadius:8,width:36,height:36,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>{"\u2212"}</button>
                    <span style={{fontSize:20,fontWeight:900,minWidth:40,textAlign:"center"}}>{scanQty}</span>
                    <button onClick={()=>setScanQty(q=>q+1)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#F0F0F0",borderRadius:8,width:36,height:36,fontSize:20,cursor:"pointer",fontFamily:"inherit"}}>+</button>
                    <button onClick={()=>confirmScan(c,scanQty)} style={{flex:1,background:"linear-gradient(135deg,#4ade80,#22c55e)",color:"#000",border:"none",borderRadius:10,padding:"10px 0",fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 4px 16px rgba(74,222,128,0.4)"}}>{"\u2705 Add"}{scanQty}</button>
                  </div>
                  <button onClick={()=>setPhotoScan(null)} style={{width:"100%",background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",borderRadius:10,padding:"8px 0",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Scan different card</button>
                </div>
              );
            })()}
            {photoScan?.status==="nomatch"&&(
              <div style={{background:"rgba(26,10,10,0.8)",border:"1.5px solid rgba(232,49,122,0.3)",borderRadius:20,padding:28,textAlign:"center",animation:"floatUp 0.3s ease"}}>
                <div style={{fontSize:36,marginBottom:10}}>{"\u274C"}</div>
                <div style={{fontSize:16,fontWeight:800,color:"#E8317A",marginBottom:12}}>Card not recognized</div>
                <label style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"12px 28px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"inline-block",boxShadow:"0 4px 20px rgba(232,49,122,0.4)"}}>
                  Try Again<input type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoScan(null);scanCardPhoto(f);}e.target.value="";}} style={{display:"none"}}/>
                </label>
              </div>
            )}
            {photoScan?.status==="error"&&(
              <div style={{background:"rgba(26,10,10,0.8)",border:"1.5px solid rgba(232,49,122,0.3)",borderRadius:20,padding:28,textAlign:"center",animation:"floatUp 0.3s ease"}}>
                <div style={{fontSize:36,marginBottom:10}}>{"\u26A0\uFE0F"}</div>
                <div style={{fontSize:16,fontWeight:800,color:"#E8317A",marginBottom:6}}>Scan failed</div>
                {photoScan.message&&<div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:16,fontFamily:"monospace"}}>{photoScan.message}</div>}
                <label style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"12px 28px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",display:"inline-block"}}>
                  Try Again<input type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f){setPhotoScan(null);scanCardPhoto(f);}e.target.value="";}} style={{display:"none"}}/>
                </label>
              </div>
            )}
            {scanSession.length>0&&(
              <div style={{marginTop:20}}>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:10}}>Added this session</div>
                {scanSession.slice(0,5).map((s,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                    <span style={{fontSize:20}}>{"\u2705"}</span>
                    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{s.card.hero}</div><div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{s.card.treatment} &middot; {s.card.power}\u26A1</div></div>
                    <span style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>+{s.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

  );
}

function CompModal({ compCard, setCompCard, marketSales, WEAPON_COLORS , cards, listings}) {
  if (!compCard) return null;
  const c = compCard;
  const wc = WEAPON_COLORS[c.weapon]||"#444";
  const exactSales = marketSales.filter(s=>s.cardId===c.id);
  const nearSales = marketSales.filter(s=>s.cardId!==c.id&&(
  (s.cardName===c.hero&&s.cardTreatment===c.treatment)||
  (s.cardName===c.hero&&s.cardWeapon===c.weapon&&s.cardPower===c.power)||
  (s.cardName===c.hero&&s.cardTreatment===c.treatment&&s.cardPower!==c.power)
  ));
  function stats(sales) {
  if(!sales.length) return null;
  const prices = sales.map(s=>s.price).sort((a,b)=>a-b);
  const avg = prices.reduce((a,b)=>a+b,0)/prices.length;
  const last = sales.sort((a,b)=>b.soldDate?.localeCompare(a.soldDate||"")||0)[0];
  return { avg, high:Math.max(...prices), low:Math.min(...prices), count:prices.length, last };
  }
  const exact = stats(exactSales);
  const near = stats(nearSales);
  return (
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(20px)",padding:16}} onClick={()=>setCompCard(null)}>
    <div style={{background:"linear-gradient(135deg,#0d0d0d,#0a0d1a)",border:`1px solid ${wc}33`,borderRadius:24,width:"100%",maxWidth:560,maxHeight:"90vh",overflowY:"auto",boxShadow:`0 40px 120px ${wc}22`,animation:"floatUp 0.3s ease"}} onClick={e=>e.stopPropagation()}>
      {/* Header */}
      <div style={{display:"flex",gap:14,padding:"24px 24px 20px",borderBottom:`1px solid ${wc}22`}}>
        {c.imageUrl?<img src={c.imageUrl} alt={c.hero} style={{width:64,height:85,objectFit:"cover",borderRadius:10,flexShrink:0,boxShadow:`0 8px 24px ${wc}44`}}/>:<div style={{width:64,height:85,background:"rgba(255,255,255,0.04)",borderRadius:10,flexShrink:0}}/>}
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:`${wc}`,fontWeight:700,textTransform:"uppercase",letterSpacing:2,marginBottom:4}}>{"\uD83D\uDCCA Card Comp"}</div>
          <div style={{fontSize:20,fontWeight:900,color:"#F0F0F0",marginBottom:4}}>{c.hero}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <span style={{background:`${wc}22`,color:wc,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:700}}>{c.weapon}</span>
            <span style={{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",borderRadius:6,padding:"2px 8px",fontSize:11}}>{c.treatment}</span>
            {c.power&&<span style={{background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.5)",borderRadius:6,padding:"2px 8px",fontSize:11}}>{c.power}\u26A1</span>}
            {c.setName&&<span style={{background:"rgba(255,255,255,0.04)",color:"rgba(255,255,255,0.3)",borderRadius:6,padding:"2px 8px",fontSize:10}}>{c.setName}</span>}
          </div>
        </div>
        <button onClick={()=>setCompCard(null)} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:22,padding:0,alignSelf:"flex-start",lineHeight:1}}>{"\u00D7"}</button>
      </div>
      <div style={{padding:24}}>
        {/* Exact match comps */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:800,color:"#4ade80"}}>{"\u2705 Exact Match Sales"}</div>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Same card, same treatment, same power</span>
          </div>
          {exact?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:12}}>
                {[{l:"Avg Sale",v:`$${exact.avg.toFixed(2)}`,c:"#7B9CFF"},{l:"High",v:`$${exact.high.toFixed(2)}`,c:"#4ade80"},{l:"Low",v:`$${exact.low.toFixed(2)}`,c:"#FBBF24"},{l:"# Sales",v:exact.count,c:"rgba(255,255,255,0.6)"}].map(({l,v,c:col})=>(
                  <div key={l} style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:900,color:col}}>{v}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:3,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginBottom:8}}>Last sale: <span style={{color:"#4ade80",fontWeight:700}}>${(exact.last?.price||0).toFixed(2)}</span> on {exact.last?.soldDate||"--"}</div>
              {/* Sales list */}
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:12,overflow:"hidden"}}>
                {exactSales.sort((a,b)=>b.soldDate?.localeCompare(a.soldDate||"")||0).slice(0,8).map((s,i)=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",borderBottom:"1px solid rgba(255,255,255,0.03)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                    <span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{s.soldDate||"--"}</span>
                    <span style={{fontSize:14,fontWeight:800,color:"#4ade80"}}>${(s.price||0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(255,255,255,0.08)",borderRadius:12,padding:"24px",textAlign:"center",color:"rgba(255,255,255,0.3)"}}>
              <div style={{fontSize:14,marginBottom:4}}>No exact sales yet on this platform</div>
              <div style={{fontSize:11}}>Be the first -- list this card in the Market tab</div>
            </div>
          )}
        </div>
        {/* Similar cards */}
        <div style={{marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <div style={{fontSize:13,fontWeight:800,color:"#FBBF24"}}>{"\uD83D\uDD0D Similar Card Sales"}</div>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Same hero, similar treatment or power</span>
          </div>
          {near?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
                {[{l:"Avg",v:`$${near.avg.toFixed(2)}`,c:"#7B9CFF"},{l:"High",v:`$${near.high.toFixed(2)}`,c:"#4ade80"},{l:"# Sales",v:near.count,c:"rgba(255,255,255,0.6)"}].map(({l,v,c:col})=>(
                  <div key={l} style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,padding:"10px 8px",textAlign:"center"}}>
                    <div style={{fontSize:16,fontWeight:900,color:col}}>{v}</div>
                    <div style={{fontSize:9,color:"rgba(255,255,255,0.3)",marginTop:3,textTransform:"uppercase",letterSpacing:1}}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{background:"rgba(0,0,0,0.3)",borderRadius:12,overflow:"hidden"}}>
                {nearSales.sort((a,b)=>b.soldDate?.localeCompare(a.soldDate||"")||0).slice(0,6).map((s,i)=>(
                  <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderBottom:"1px solid rgba(255,255,255,0.03)",background:i%2===0?"transparent":"rgba(255,255,255,0.01)"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.cardTreatment} &middot; {s.cardPower}\u26A1</div>
                      <div style={{fontSize:10,color:"rgba(255,255,255,0.25)"}}>{s.soldDate||"--"}</div>
                    </div>
                    <span style={{fontSize:14,fontWeight:800,color:"#FBBF24",flexShrink:0}}>${(s.price||0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </>
          ):(
            <div style={{background:"rgba(255,255,255,0.02)",border:"1px dashed rgba(255,255,255,0.08)",borderRadius:12,padding:"16px",textAlign:"center",color:"rgba(255,255,255,0.3)",fontSize:12}}>
              No similar card sales yet
            </div>
          )}
        </div>
        {/* eBay placeholder */}
        <div style={{background:"rgba(255,255,255,0.01)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:12,padding:"16px 20px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{fontSize:24}}>{"\uD83D\uDED2"}</div>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.4)"}}>eBay Sales Data</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.2)"}}>Coming soon -- eBay sold listings will appear here for real-world comps</div>
          </div>
          <div style={{marginLeft:"auto",fontSize:10,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.3)",borderRadius:6,padding:"3px 8px",fontWeight:700,whiteSpace:"nowrap"}}>COMING SOON</div>
        </div>
      </div>
    </div>
  </div>
  );
}

function PublicCardDatabase() {
  // -- Core state --
  const [cards,         setCards]         = useState([]);
  const [loading, setLoading] = useState(()=>{ try { const r=localStorage.getItem("boba_checklist_cache_v2"); if(r){const{cards:cc}=JSON.parse(r);if(cc?.length>0)return false;} } catch(e){} return true; });
  const [user,          setUser]          = useState(null);
  const [owned,         setOwned]         = useState({});
  const [privateCards,  setPrivateCards]  = useState({});
  const [ownedDocId,    setOwnedDocId]    = useState(null);
  const [signingIn,     setSigningIn]     = useState(false);
  const [activeTab,     setActiveTab]     = useState("cards");
  const [headerLoaded,  setHeaderLoaded]  = useState(false);

  // -- Cards/filter state --
  const [search,        setSearch]        = useState("");
  const [filterSet,     setFilterSet]     = useState("");
  const [filterWeapon,  setFilterWeapon]  = useState("");
  const [filterTreat,   setFilterTreat]   = useState("");
  const [filterOwned,   setFilterOwned]   = useState("all");
  const [sortBy,        setSortBy]        = useState("cardNum");
  const [page,          setPage]          = useState(1);
  const [flippedCard,   setFlippedCard]   = useState(null);
  const PAGE_SIZE = 100;

  // -- Wants --
  const [wantList,      setWantList]      = useState({});

  // -- Playbook --
  const [pbCards,       setPbCards]       = useState([]);
  const [pbSearch,      setPbSearch]      = useState("");
  const [pbSort,        setPbSort]        = useState("name");

  // -- Scan --
  const [scanModal,     setScanModal]     = useState(false);
  const [photoScan,     setPhotoScan]     = useState(null);
  const [scanSession,   setScanSession]   = useState([]);
  const [scanQty,       setScanQty]       = useState(1);

  // -- Friends --
  const [friends,       setFriends]       = useState([]);
  const [friendReqs,    setFriendReqs]    = useState([]);
  const [sentReqs,      setSentReqs]      = useState([]);
  const [addEmail,      setAddEmail]      = useState("");
  const [addStatus,     setAddStatus]     = useState(null);
  const [friendOwned,   setFriendOwned]   = useState({});
  const [viewingFriend, setViewingFriend] = useState(null);

  // -- Teams --
  const [teams,         setTeams]         = useState([]);
  const [activeTeam,    setActiveTeam]    = useState(null);
  const [newTeamName,   setNewTeamName]   = useState("");
  const [inviteEmail,   setInviteEmail]   = useState("");
  const [inviteStatus,  setInviteStatus]  = useState(null);
  const [teamInvites,   setTeamInvites]   = useState([]);

  // -- Deck builder --
  const [deckCards,     setDeckCards]     = useState([]);
  const [deckName,      setDeckName]      = useState("My Deck");
  const [deckType,      setDeckType]      = useState("none");
  const [deckSearch,    setDeckSearch]    = useState("");
  const [deckFilterW,   setDeckFilterW]   = useState("");
  const [deckFilterP,   setDeckFilterP]   = useState(new Set());
  const [deckFilterS,   setDeckFilterS]   = useState("");
  const [deckFilterT,   setDeckFilterT]   = useState("");

  // -- Marketplace --
  const [listings,      setListings]      = useState([]);
  const [myListings,    setMyListings]    = useState([]);
  const [listModal,     setListModal]     = useState(null); // card being listed
  // -- Messages --
  const [threads,       setThreads]       = useState([]);
  const [activeThread,  setActiveThread]  = useState(null);
  const [threadMsgs,    setThreadMsgs]    = useState([]);
  const [newMsg,        setNewMsg]        = useState("");
  const [unreadThreads, setUnreadThreads] = useState(0);
  // -- Market sales --
  const [marketSales,   setMarketSales]   = useState([]);
  // -- Comp modal --
  const [compCard,      setCompCard]      = useState(null); // card being comped
  const [privacyAnim,   setPrivacyAnim]   = useState(null); // cardId showing lock animation
  const [listPrice,     setListPrice]     = useState("");
  const [listType,      setListType]      = useState("sale"); // sale|trade|either
  const [listNotes,     setListNotes]     = useState("");
  const [listPayment,  setListPayment]  = useState(""); // seller payment info
  const [paymentPopup,  setPaymentPopup]  = useState(null);
  const [offerModal,    setOfferModal]    = useState(null); // listing being offered on
  const [offerAmt,      setOfferAmt]      = useState("");
  const [offerNote,     setOfferNote]     = useState("");
  const [offerSent,     setOfferSent]     = useState(false);
  const [marketNotifs,  setMarketNotifs]  = useState([]);
  const [allMyOffers,   setAllMyOffers]   = useState([]);
  const [counterModal,  setCounterModal]  = useState(null); // offer being countered
  const [counterAmt,    setCounterAmt]    = useState("");
  const [counterSent,   setCounterSent]   = useState(false);
  const [negHistory,    setNegHistory]    = useState([]);
  const [wantNotifs,    setWantNotifs]    = useState([]);
  const [trackingInputs, setTrackingInputs] = useState({}); // {saleId: {num,carrier}}

  const WEAPON_COLORS = { Fire:"#F97316", Ice:"#60A5FA", Steel:"#C0C0C0", Brawl:"#EF4444",
    Glow:"#4ade80", Hex:"#A855F7", Gum:"#F472B6", Metallic:"#E5E7EB", Alt:"#FFFFFF", Super:"#F59E0B" };
  const DECK_SIZE = 60;

  const inp = { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10,
    color:"#F0F0F0", padding:"9px 14px", fontSize:13, fontFamily:"'Trebuchet MS',sans-serif", outline:"none",
    backdropFilter:"blur(10px)" };

  // Animate header in
  useEffect(() => { setTimeout(()=>setHeaderLoaded(true), 100); }, []);

  // Auto-open latest active thread when switching to messages tab
  useEffect(() => {
    if (activeTab === "messages" && !activeThread && threads.length > 0) {
      // Find the most recently active thread
      const latest = threads.slice().sort((a,b) => (b.lastMessageAt||"") > (a.lastMessageAt||"") ? 1 : -1)[0];
      if (latest) setActiveThread(latest);
    }
  }, [activeTab, threads.length]);


  // Load negotiation history when counter modal opens
  useEffect(() => {
    if (!counterModal) { setNegHistory([]); return; }
    const rootId = counterModal.parentOfferId||counterModal.id;
    getDocs(query(
      collection(db,"negotiation_history"),
      where("rootOfferId","==",rootId)
    )).then(snap => setNegHistory(snap.docs.map(d=>d.data()).sort((a,b)=>(a.timestamp||"").localeCompare(b.timestamp||""))))
      .catch(() => {
        // Fallback: show at least the current offer as first entry
        setNegHistory([{
          action:"offer",
          fromName:counterModal.buyerName||"Buyer",
          amount:counterModal.offerAmount||0,
          timestamp:counterModal.createdAt||"",
        }]);
      });
  }, [counterModal?.id]);



  // -- Public marketplace (loads without login) --
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db,"marketplace"), where("status","==","active")),
      snap => {
        const all = snap.docs.map(d=>({...d.data(),id:d.id}));
        setListings(all);
      }
    );
    return ()=>unsub();
  }, []);

  // -- Load cards (instant from cache, background refresh) --
  useEffect(() => {
    const CACHE_KEY = "boba_checklist_cache_v2";
    const CACHE_TTL = 24 * 60 * 60 * 1000;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const { cards:cc, ts } = JSON.parse(raw);
        if (cc?.length > 0) {
          setCards(cc); setLoading(false);
          if (Date.now() - ts < CACHE_TTL) return;
        }
      }
    } catch(e) {}
    getDocs(collection(db,"boba_checklist")).then(snap => {
      const all = snap.docs.map(d=>({id:d.id,...d.data()}));
      setCards(all); setLoading(false);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({cards:all,ts:Date.now()})); } catch(e) {}
    });
  }, []);
  // -- Auth + owned + wants + private --
  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      setUser(u);
      if (u) {
        const [ownSnap, wSnap, prvSnap] = await Promise.all([
          getDoc(doc(db,"boba_owned",u.uid)),
          getDoc(doc(db,"boba_wants",u.uid)),
          getDoc(doc(db,"boba_private",u.uid)),
        ]);
        setOwned(ownSnap.exists() ? ownSnap.data() : {});
        setOwnedDocId(u.uid);
        setWantList(wSnap.exists() ? wSnap.data() : {});
        setPrivateCards(prvSnap.exists() ? prvSnap.data() : {});
      } else {
        setOwned({}); setOwnedDocId(null); setWantList({}); setPrivateCards({});
      }
    });
  }, []);

  // -- Friends/teams listeners --
  useEffect(() => {
    if (!user) return;
    const uid2 = user.uid;
    const unsubs = [
      onSnapshot(query(collection(db,"friend_requests"), where("from","==",uid2), where("status","==","accepted")),
        snap => setFriends(prev => { const ff=snap.docs.map(d=>({...d.data(),id:d.id,friendUid:d.data().to,friendName:d.data().toName||d.data().toEmail})); return [...ff,...prev.filter(f=>f._dir==="to")]; })
      ),
      onSnapshot(query(collection(db,"friend_requests"), where("to","==",uid2), where("status","==","accepted")),
        snap => setFriends(prev => { const tf=snap.docs.map(d=>({...d.data(),id:d.id,friendUid:d.data().from,friendName:d.data().fromName||d.data().fromEmail,_dir:"to"})); return [...prev.filter(f=>f._dir!=="to"),...tf]; })
      ),
      onSnapshot(query(collection(db,"friend_requests"), where("to","==",uid2), where("status","==","pending")),
        snap => setFriendReqs(snap.docs.map(d=>({...d.data(),id:d.id})))
      ),
      onSnapshot(query(collection(db,"friend_requests"), where("from","==",uid2), where("status","==","pending")),
        snap => setSentReqs(snap.docs.map(d=>({...d.data(),id:d.id})))
      ),
      onSnapshot(query(collection(db,"teams"), where("memberUids","array-contains",uid2)),
        snap => { const t=snap.docs.map(d=>({...d.data(),id:d.id})); setTeams(t); if(!activeTeam&&t.length>0) setActiveTeam(t[0]); }
      ),
      onSnapshot(query(collection(db,"team_invites"), where("toUid","==",uid2), where("status","==","pending")),
        snap => setTeamInvites(snap.docs.map(d=>({...d.data(),id:d.id})))
      ),
      // Marketplace: my listings only (logged-in user)
      onSnapshot(query(collection(db,"marketplace"), where("status","==","active"), where("sellerUid","==",uid2)),
        snap => setMyListings(snap.docs.map(d=>({...d.data(),id:d.id})))
      ),
      // Marketplace notifications for me (offers on my listings)
      onSnapshot(query(collection(db,"market_offers"), where("sellerUid","==",uid2), where("notified","==",false)),
        snap => setMarketNotifs(snap.docs.map(d=>({...d.data(),id:d.id})))
      ),
      onSnapshot(query(collection(db,"market_offers"), where("sellerUid","==",uid2), where("status","==","pending")),
        snap => setAllMyOffers(snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>(b.offerAmount||0)-(a.offerAmount||0)))
      ),
      // Want notifications -- someone listed a card I want
      onSnapshot(query(collection(db,"market_notifs"), where("toUid","==",uid2), where("read","==",false)),
        snap => setWantNotifs(snap.docs.map(d=>({...d.data(),id:d.id})))
      ),
      // Deal threads
      onSnapshot(query(collection(db,"deal_threads"), where("memberUids","array-contains",uid2)),
        snap => {
          const threads = snap.docs
            .map(d=>({...d.data(),id:d.id}))
            .sort((a,b)=>(b.lastMessageAt||"").localeCompare(a.lastMessageAt||""));
          setThreads(threads);
          setUnreadThreads(threads.filter(t=>t.lastReadBy?.[uid2]<t.lastMessageAt&&t.lastSenderUid!==uid2).length);
        }
      ),
      // Recent market sales (last 200)
      onSnapshot(query(collection(db,"market_sales"), orderBy("soldAt","desc")),
        snap => setMarketSales(snap.docs.map(d=>({...d.data(),id:d.id})).slice(0,200))
      ),
    ];
    return () => unsubs.forEach(u=>u());
  }, [user]);

  // Load friend owned maps
  useEffect(() => {
    if (!friends.length) return;
    friends.forEach(async f => {
      if (friendOwned[f.friendUid]) return;
      const snap = await getDoc(doc(db,"boba_owned",f.friendUid));
      if (snap.exists()) setFriendOwned(prev=>({...prev,[f.friendUid]:snap.data()}));
    });
  }, [friends]);

  // Upsert profile on login
  useEffect(() => {
    if (!user) return;
    setDoc(doc(db,"boba_profiles",user.uid), {email:user.email,displayName:user.displayName||user.email,photoURL:user.photoURL||"",lastSeen:new Date().toISOString()},{merge:true});
  }, [user]);

  // Infinite scroll
  useEffect(() => {
    function onScroll() { if (document.documentElement.scrollHeight-window.scrollY-window.innerHeight<400) setPage(p=>p+1); }
    window.addEventListener("scroll",onScroll,{passive:true});
    return ()=>window.removeEventListener("scroll",onScroll);
  }, []);

  // -- Helpers --
  async function toggleOwned(cardId) {
    if (!user) { setSigningIn(true); return; }
    const next = {...owned};
    if (next[cardId]) delete next[cardId]; else next[cardId]=1;
    setOwned(next);
    await setDoc(doc(db,"boba_owned",user.uid), next);
  }
  async function setOwnedQty(cardId, qty) {
    if (!user) return;
    const next = {...owned};
    if (qty<=0) delete next[cardId]; else next[cardId]=qty;
    setOwned(next);
    await setDoc(doc(db,"boba_owned",user.uid), next);
  }
  async function toggleWant(cardId) {
    if (!user) { setSigningIn(true); return; }
    const next = {...wantList};
    if (next[cardId]) delete next[cardId]; else next[cardId]=1;
    setWantList(next);
    await setDoc(doc(db,"boba_wants",user.uid), next);
  }
  async function togglePrivate(cardId) {
    if (!user) return;
    const next = {...privateCards};
    if (next[cardId]) delete next[cardId]; else next[cardId]=true;
    setPrivateCards(next);
    await setDoc(doc(db,"boba_private",user.uid), next);
  }
  function signInGoogle() {
    const provider = new GoogleAuthProvider();
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      signInWithRedirect(auth, provider).catch(console.error);
    } else {
      signInWithPopup(auth, provider)
        .then(()=>setSigningIn(false))
        .catch(e=>{
          if(e.code==="auth/popup-blocked"||e.code==="auth/popup-closed-by-user") {
            signInWithRedirect(auth, provider).catch(console.error);
          } else { console.error(e); }
        });
    }
  }

  // Handle redirect result on page load
  useEffect(() => {
    getRedirectResult(auth).then(result => {
      if (result?.user) setSigningIn(false);
    }).catch(console.error);
  }, []);

  // -- Scan --
  async function scanCardPhoto(file) {
    setPhotoScan({status:"scanning"});
    try {
      const base64 = await new Promise((res,rej) => {
        const img=new Image(), url=URL.createObjectURL(file);
        img.onload=()=>{ URL.revokeObjectURL(url); const MAX=1200,scale=Math.min(1,MAX/Math.max(img.width,img.height)); const canvas=document.createElement("canvas"); canvas.width=Math.round(img.width*scale); canvas.height=Math.round(img.height*scale); canvas.getContext("2d").drawImage(img,0,0,canvas.width,canvas.height); res(canvas.toDataURL("image/jpeg",0.92).split(",")[1]); };
        img.onerror=rej; img.src=url;
      });
      const resp=await fetch("/api/scan-card",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64:base64,mediaType:"image/jpeg"})});
      if(!resp.ok){const e=await resp.json().catch(()=>({}));setPhotoScan({status:"error",message:e.error||`HTTP ${resp.status}`});return;}
      const data=await resp.json();
      if(!data.cardNum&&!data.hero){setPhotoScan({status:"nomatch"});setTimeout(()=>setPhotoScan(null),3000);return;}
      const normNum=n=>String(n||"").replace(/[\s\-]/g,"").toLowerCase();
      const heroMatch=(a,b)=>{if(!a||!b)return false;const al=a.toLowerCase(),bl=b.toLowerCase();if(al===bl)return true;if(al.split(" ")[0]!==bl.split(" ")[0])return false;return al.includes(bl)||bl.includes(al);};
      const iNum=normNum(data.cardNum),iHero=(data.hero||"").toLowerCase(),iWeap=(data.weapon||"").toLowerCase();
      let match=null;
      if(iNum&&iHero) match=cards.find(c=>normNum(c.cardNum)===iNum&&heroMatch(c.hero,iHero));
      if(!match&&iNum) match=cards.find(c=>normNum(c.cardNum)===iNum);
      if(!match&&iHero&&iWeap){const cands=cards.filter(c=>heroMatch(c.hero,iHero)&&c.weapon?.toLowerCase()===iWeap);if(cands.length===1)match=cands[0];}
      if(!match&&iHero){const cands=cards.filter(c=>heroMatch(c.hero,iHero));if(cands.length===1)match=cands[0];}
      if(!match){setPhotoScan({status:"nomatch",identified:data});return;}
      setPhotoScan({status:"matched",card:match,detected:data}); setScanQty(1);
    } catch(e){setPhotoScan({status:"error",message:e.message});}
  }
  async function confirmScan(card,qty) {
    if(!user){setSigningIn(true);return;}
    const next={...owned,[card.id]:(owned[card.id]||0)+qty};
    setOwned(next);
    await setDoc(doc(db,"boba_owned",user.uid),next);
    setScanSession(prev=>[{card,qty,addedAt:new Date().toISOString()},...prev]);
    setPhotoScan(null); setScanQty(1);
  }

  // -- Friends --
  async function sendFriendRequest() {
    if(!user||!addEmail.trim())return;
    setAddStatus(null);
    const email=addEmail.trim().toLowerCase();
    if(email===user.email?.toLowerCase()){setAddStatus({ok:false,msg:"That's you!"});return;}
    if(friends.find(f=>f.toEmail?.toLowerCase()===email||f.fromEmail?.toLowerCase()===email)){setAddStatus({ok:false,msg:"Already friends"});return;}
    const profSnap=await getDocs(query(collection(db,"boba_profiles"),where("email","==",email)));
    if(profSnap.empty){setAddStatus({ok:false,msg:"No account found with that email -- they need to sign in at /cards first"});return;}
    const toProfile=profSnap.docs[0].data(), toUid=profSnap.docs[0].id;
    const existSnap=await getDocs(query(collection(db,"friend_requests"),where("from","==",user.uid),where("to","==",toUid)));
    if(!existSnap.empty){setAddStatus({ok:false,msg:"Request already sent"});return;}
    const id=uid();
    await setDoc(doc(db,"friend_requests",id),{id,from:user.uid,fromEmail:user.email,fromName:user.displayName||user.email,to:toUid,toEmail:email,toName:toProfile.displayName||email,status:"pending",createdAt:new Date().toISOString()});
    await setDoc(doc(db,"boba_profiles",user.uid),{email:user.email,displayName:user.displayName||user.email,photoURL:user.photoURL||""},{merge:true});
    setAddEmail(""); setAddStatus({ok:true,msg:`Request sent to ${toProfile.displayName||email}!`});
  }
  async function respondFriendReq(req,accept) {
    await setDoc(doc(db,"friend_requests",req.id),{status:accept?"accepted":"declined"},{merge:true});
    if(accept) await setDoc(doc(db,"boba_profiles",user.uid),{email:user.email,displayName:user.displayName||user.email,photoURL:user.photoURL||""},{merge:true});
  }

  // -- Teams --
  async function createTeam() {
    if(!user||!newTeamName.trim())return;
    const id=uid();
    const me={uid:user.uid,email:user.email,displayName:user.displayName||user.email,photoURL:user.photoURL||""};
    await setDoc(doc(db,"teams",id),{id,name:newTeamName.trim(),starters:[me],bench:[],members:[me],memberUids:[user.uid],createdBy:user.uid,createdAt:new Date().toISOString()});
    setNewTeamName("");
  }
  async function inviteToTeam(team) {
    if(!inviteEmail.trim())return;
    const email=inviteEmail.trim().toLowerCase();
    const profSnap=await getDocs(query(collection(db,"boba_profiles"),where("email","==",email)));
    if(profSnap.empty){setInviteStatus({ok:false,msg:"No account found"});return;}
    const toUid=profSnap.docs[0].id, toProfile=profSnap.docs[0].data();
    if(team.memberUids?.includes(toUid)){setInviteStatus({ok:false,msg:"Already on team"});return;}
    if((team.members||[]).length>=6){setInviteStatus({ok:false,msg:"Team is full (4 starters + 2 bench max)"});return;}
    const invId=uid();
    await setDoc(doc(db,"team_invites",invId),{id:invId,teamId:team.id,teamName:team.name,fromUid:user.uid,fromName:user.displayName||user.email,toUid,toEmail:email,toName:toProfile.displayName||email,status:"pending",createdAt:new Date().toISOString()});
    setInviteEmail(""); setInviteStatus({ok:true,msg:`Invite sent to ${toProfile.displayName||email}`});
  }

  async function deleteTeam(team) {
    if(!window.confirm(`Delete team "${team.name}"? This cannot be undone.`))return;
    await setDoc(doc(db,"teams",team.id),{status:"deleted"},{merge:true});
    setActiveTeam(null);
  }

  async function moveTeamMember(team, memberUid, direction) {
    // direction: "to_bench" or "to_starter"
    const starters = [...(team.starters||[])];
    const bench    = [...(team.bench||[])];
    if(direction==="to_bench") {
      if(bench.length>=2){return;} // bench full
      const idx = starters.findIndex(m=>m.uid===memberUid);
      if(idx<0)return;
      const [moved] = starters.splice(idx,1);
      bench.push(moved);
    } else {
      if(starters.length>=4){return;} // starters full
      const idx = bench.findIndex(m=>m.uid===memberUid);
      if(idx<0)return;
      const [moved] = bench.splice(idx,1);
      starters.push(moved);
    }
    await setDoc(doc(db,"teams",team.id),{starters,bench},{merge:true});
    setActiveTeam(prev=>prev?{...prev,starters,bench}:prev);
  }
  async function respondTeamInvite(invite,accept) {
    await setDoc(doc(db,"team_invites",invite.id),{status:accept?"accepted":"declined"},{merge:true});
    if(accept){
      const tsnap=await getDoc(doc(db,"teams",invite.teamId));
      if(tsnap.exists()){
        const t=tsnap.data();
        const me={uid:user.uid,email:user.email,displayName:user.displayName||user.email,photoURL:user.photoURL||""};
        const starters=t.starters||[];
        const bench=t.bench||[];
        // Put in starters if room, else bench
        if(starters.length<4) starters.push(me);
        else bench.push(me);
        await setDoc(doc(db,"teams",invite.teamId),{
          starters,bench,
          members:[...(t.members||[]),me],
          memberUids:[...(t.memberUids||[]),user.uid]
        },{merge:true});
      }
    }
  }

  // -- Marketplace --
  async function createListing() {
    if(!user||!listModal)return;
    if(listType!=="offer"&&!listPrice)return;
    const id=uid();
    const card=listModal;
    await setDoc(doc(db,"marketplace",id),{id,isOBO:listType==="offer",cardId:card.id,cardName:card.hero,cardNum:card.cardNum,cardTreatment:card.treatment,cardWeapon:card.weapon,cardPower:card.power,cardImage:card.imageUrl||null,setName:card.setName,sellerUid:user.uid,sellerName:user.displayName||user.email,askingPrice:parseFloat(listPrice)||0,listType,notes:listNotes,paymentInfo:listPayment,status:"active",createdAt:new Date().toISOString(),offerCount:0});
    // Notify users who have this card on their want list
    try {
      const wantSnaps = await getDocs(collection(db,"boba_wants"));
      const notifBatch = [];
      wantSnaps.forEach(wsnap => {
        const wantData = wsnap.data();
        if (wsnap.id !== user.uid && wantData[card.id]) {
          notifBatch.push(setDoc(doc(db,"market_notifs",uid()), {
            toUid: wsnap.id, cardId: card.id, cardName: card.hero,
            cardImage: card.imageUrl||null, listingId: id,
            sellerName: user.displayName||user.email,
            askingPrice: parseFloat(listPrice)||0,
            type: "want_listed", read: false,
            createdAt: new Date().toISOString()
          }));
        }
      });
      await Promise.all(notifBatch);
    } catch(e) { console.error("Want notification error:", e); }
    setListModal(null); setListPrice(""); setListNotes(""); setListPayment(""); setListType("sale");
  }
  async function removeListing(id) {
    if(!window.confirm("Remove this listing?"))return;
    await setDoc(doc(db,"marketplace",id),{status:"removed"},{merge:true});
  }
  async function unsellListing(sale) {
    if(!window.confirm("Reverse this sale? The listing will reopen and the card will be removed from the buyer's collection.")) return;
    // Reopen the listing
    try {
      if(sale.listingId) await setDoc(doc(db,"marketplace",sale.listingId),{status:"active",soldAt:null,soldTo:null,soldFor:null},{merge:true});
    } catch(e){ console.warn("Listing reopen failed:",e); }
    // Remove from buyer collection
    try {
      if(sale.cardId&&sale.buyerUid) {
        const buyerSnap=await getDoc(doc(db,"boba_owned",sale.buyerUid));
        if(buyerSnap.exists()) {
          const bo=buyerSnap.data(); const newQty=(bo[sale.cardId]||1)-1;
          const next={...bo}; if(newQty<=0) delete next[sale.cardId]; else next[sale.cardId]=newQty;
          await setDoc(doc(db,"boba_owned",sale.buyerUid),next);
          if(user?.uid===sale.buyerUid) setOwned(next);
        }
      }
    } catch(e){ console.warn("Buyer reversal failed:",e); }
    // Restore seller collection
    try {
      if(sale.cardId&&sale.sellerUid) {
        const sellerSnap=await getDoc(doc(db,"boba_owned",sale.sellerUid));
        const so=sellerSnap.exists()?sellerSnap.data():{};
        const next={...so,[sale.cardId]:(so[sale.cardId]||0)+1};
        await setDoc(doc(db,"boba_owned",sale.sellerUid),next);
        if(user?.uid===sale.sellerUid) setOwned(next);
      }
    } catch(e){ console.warn("Seller restore failed:",e); }
    // Delete the sale doc by ID
    try {
      if(sale.id) {
        await deleteDoc(doc(db,"market_sales",sale.id));
      } else {
        // fallback: query by soldAt+sellerUid
        const saleSnap=await getDocs(query(collection(db,"market_sales"),where("sellerUid","==",sale.sellerUid),where("soldAt","==",sale.soldAt)));
        await Promise.all(saleSnap.docs.map(d=>deleteDoc(doc(db,"market_sales",d.id))));
      }
    } catch(e){ console.warn("Sale doc delete failed:",e); }
    showToast("Sale reversed.");
  }

  async function saveTracking(saleId, trackingNum, carrier) {
    await setDoc(doc(db,"market_sales",saleId),{trackingNumber:trackingNum,carrier:carrier||"",shippedAt:new Date().toISOString()},{merge:true});
    showToast("Tracking saved!");
  }
  async function submitOffer() {
    if(!user||!offerModal||!offerAmt)return;
    const offId=uid();
    await setDoc(doc(db,"market_offers",offId),{id:offId,cardId:offerModal.cardId||offerModal.id,listingId:offerModal.id,cardName:offerModal.cardName,cardImage:offerModal.cardImage||null,cardTreatment:offerModal.cardTreatment||"",cardWeapon:offerModal.cardWeapon||"",setName:offerModal.setName||"",sellerUid:offerModal.sellerUid,sellerName:offerModal.sellerName,buyerUid:user.uid,buyerName:user.displayName||user.email,buyerEmail:user.email,offerAmount:parseFloat(offerAmt)||0,note:offerNote,status:"pending",notified:false,createdAt:new Date().toISOString()});
    // Increment offer count
    await setDoc(doc(db,"marketplace",offerModal.id),{offerCount:(offerModal.offerCount||0)+1},{merge:true});
    setOfferSent(true);
  }

  async function buyNow(listing) {
    if (!user) { setSigningIn(true); return; }
    if (!listing.askingPrice) { alert("No asking price set on this listing."); return; }
    const now = new Date().toISOString();
    const threadId = uid();
    const saleId = uid();
    const sysText = "\u2705 Purchase complete! "+listing.cardName+" for $"+listing.askingPrice.toFixed(2)+(listing.paymentInfo?" | Payment: "+listing.paymentInfo:"");
    const sysMsg = {id:uid(),text:sysText,senderUid:"system",senderName:"System",sentAt:now};
    try {
      // Write deal thread (buyer creates - needs auth write permission on deal_threads)
      await setDoc(doc(db,"deal_threads",threadId),{
        id:threadId, memberUids:[listing.sellerUid,user.uid],
        sellerUid:listing.sellerUid, sellerName:listing.sellerName||"Seller",
        buyerUid:user.uid, buyerName:user.displayName||user.email||"Buyer",
        cardName:listing.cardName, cardImage:listing.cardImage||null, cardId:listing.cardId||"",
        agreedPrice:listing.askingPrice, status:"active",
        messages:[sysMsg],
        lastMessage:sysText, lastMessageAt:now, lastSenderUid:"system",
        lastReadBy:{[user.uid]:now}, createdAt:now,
      });
    } catch(e) { alert("Could not create deal thread: "+e.message); return; }
    try {
      // Log sale
      await setDoc(doc(db,"market_sales",saleId),{
        id:saleId, listingId:listing.id,
        cardId:listing.cardId||"", cardName:listing.cardName,
        cardTreatment:listing.cardTreatment||"", cardWeapon:listing.cardWeapon||"",
        cardImage:listing.cardImage||null, setName:listing.setName||"",
        price:listing.askingPrice, soldAt:now, soldDate:now.split("T")[0],
        sellerUid:listing.sellerUid, sellerName:listing.sellerName||"",
        buyerUid:user.uid, buyerName:user.displayName||user.email||"",
      });
    } catch(e) { alert("Could not log sale: "+e.message); return; }
    try {
      // Add card to buyer's own collection (buyer writing to their own doc = always allowed)
      if(listing.cardId){
        const buyerSnap=await getDoc(doc(db,"boba_owned",user.uid));
        const bo=buyerSnap.exists()?buyerSnap.data():{};
        const next={...bo,[listing.cardId]:(bo[listing.cardId]||0)+1};
        await setDoc(doc(db,"boba_owned",user.uid),next);
        setOwned(next);
      }
    } catch(e) { alert("Could not update your collection: "+e.message); return; }
    try {
      // Mark listing sold (buyer writing to marketplace doc - may need permissive rules)
      await setDoc(doc(db,"marketplace",listing.id),{status:"sold",soldAt:now,soldTo:user.uid,soldFor:listing.askingPrice},{merge:true});
    } catch(e) { alert("Could not close listing (check Firestore rules for marketplace): "+e.message); }
    // Navigate to thread
    setActiveTab("messages");
    setActiveThread({id:threadId,memberUids:[listing.sellerUid,user.uid],sellerUid:listing.sellerUid,sellerName:listing.sellerName||"Seller",buyerUid:user.uid,buyerName:user.displayName||"Buyer",cardName:listing.cardName,cardImage:listing.cardImage||null,agreedPrice:listing.askingPrice,status:"active",messages:[sysMsg],lastMessageAt:now,lastSenderUid:"system",lastReadBy:{[user.uid]:now},createdAt:now});
    showToast("Purchase complete!");
    if(listing.paymentInfo){
      setPaymentPopup({cardName:listing.cardName,price:listing.askingPrice,paymentInfo:listing.paymentInfo,sellerName:listing.sellerName});
    }
  }


  async function logNegotiationHistory(offer, action, amount) {
    try {
      await setDoc(doc(db,"negotiation_history",uid()), {
        rootOfferId: offer.parentOfferId||offer.id,
        offerId: offer.id,
        listingId: offer.listingId||"",
        cardName: offer.cardName,
        cardImage: offer.cardImage||null,
        action,
        amount: amount||offer.offerAmount||0,
        fromUid: user.uid,
        fromName: user.displayName||user.email||"Unknown",
        sellerUid: offer.sellerUid,
        buyerUid: offer.buyerUid,
        timestamp: new Date().toISOString(),
      });
    } catch(e) { console.warn("History log failed:", e); }
  }

  async function respondOffer(offer, action) {
    const now = new Date().toISOString();
    await setDoc(doc(db,"market_offers",offer.id),{status:action,notified:true,respondedAt:now},{merge:true});
    logNegotiationHistory(offer, action, offer.offerAmount||0);
    if (action==="accepted") {
      // 1. Close the listing
      await setDoc(doc(db,"marketplace",offer.listingId),{status:"sold",soldAt:now,soldTo:offer.buyerUid,soldFor:offer.offerAmount||0},{merge:true});
      // 2. Auto-decline all OTHER pending offers on this listing
      try {
        const othersSnap = await getDocs(query(collection(db,"market_offers"),where("listingId","==",offer.listingId),where("status","==","pending")));
        await Promise.all(othersSnap.docs.filter(d=>d.id!==offer.id).map(d=>setDoc(doc(db,"market_offers",d.id),{status:"declined",notified:true,respondedAt:now},{merge:true})));
      } catch(e){ console.warn("Auto-decline failed:",e); }
      // 3. Decrement seller owned qty by 1
      // Resolve cardId -- older offer docs may not have it, fall back to listing
      let cardId = offer.cardId;
      if (!cardId) {
        try {
          const listSnap = await getDoc(doc(db,"marketplace",offer.listingId));
          if (listSnap.exists()) cardId = listSnap.data().cardId;
        } catch(e){}
      }
      try {
        const sellerSnap = await getDoc(doc(db,"boba_owned",offer.sellerUid));
        if (sellerSnap.exists()&&cardId) {
          const so=sellerSnap.data(); const newQty=(so[cardId]||1)-1;
          const next={...so}; if(newQty<=0) delete next[cardId]; else next[cardId]=newQty;
          await setDoc(doc(db,"boba_owned",offer.sellerUid),next);
          if(user?.uid===offer.sellerUid) setOwned(next);
        }
      } catch(e){ console.warn("Seller qty failed:",e); }
      // 4. Add to buyer collection
      try {
        const buyerSnap = await getDoc(doc(db,"boba_owned",offer.buyerUid));
        const bo=buyerSnap.exists()?buyerSnap.data():{};
        if(cardId) {
          const next={...bo,[cardId]:(bo[cardId]||0)+1};
          await setDoc(doc(db,"boba_owned",offer.buyerUid),next);
          if(user?.uid===offer.buyerUid) setOwned(next);
        } else {
          console.warn("respondOffer: no cardId found, buyer collection not updated");
        }
      } catch(e){ console.warn("Buyer collection failed:",e); }
      // 5. Create deal thread
      const threadId=uid();
      await setDoc(doc(db,"deal_threads",threadId),{
        id:threadId, memberUids:[offer.sellerUid,offer.buyerUid],
        sellerUid:offer.sellerUid, sellerName:offer.sellerName||"Seller",
        buyerUid:offer.buyerUid, buyerName:offer.buyerName||"Buyer",
        cardName:offer.cardName, cardImage:offer.cardImage||null, cardId:offer.cardId||"",
        agreedPrice:offer.offerAmount||0, status:"active",
        lastMessage:"Deal accepted! Coordinate payment details here.",
        lastMessageAt:now, lastSenderUid:"system",
        lastReadBy:{[offer.sellerUid]:now}, createdAt:now,
      });
      await setDoc(doc(db,"deal_threads",threadId),{
        messages: arrayUnion({id:uid(),text:"\u2705 Deal agreed! "+offer.cardName+" for $"+(offer.offerAmount||0).toFixed(2)+(offer.paymentInfo?" | Payment: "+offer.paymentInfo:"")+" | Card added to buyer's collection automatically.",senderUid:"system",senderName:"System",sentAt:now}),
      },{merge:true});
      // 6. Log sale
      await setDoc(doc(db,"market_sales",uid()),{
        id:uid(), listingId:offer.listingId||"",
        cardId:offer.cardId||"", cardName:offer.cardName,
        cardTreatment:offer.cardTreatment||"", cardWeapon:offer.cardWeapon||"",
        cardPower:offer.cardPower||"", cardImage:offer.cardImage||null,
        setName:offer.setName||"", price:offer.offerAmount||0,
        soldAt:now, soldDate:now.split("T")[0],
        sellerUid:offer.sellerUid, sellerName:offer.sellerName||"",
        buyerUid:offer.buyerUid, buyerName:offer.buyerName||"",
      });
      // 7. Switch to Messages tab and open the thread
      showToast("Deal accepted! Opening chat to coordinate payment...");
      setActiveTab("messages");
      setActiveThread({
        id:threadId, memberUids:[offer.sellerUid,offer.buyerUid],
        sellerUid:offer.sellerUid, sellerName:offer.sellerName||"Seller",
        buyerUid:offer.buyerUid, buyerName:offer.buyerName||"Buyer",
        cardName:offer.cardName, cardImage:offer.cardImage||null,
        agreedPrice:offer.offerAmount||0, status:"active",
        lastMessage:"Deal accepted! Coordinate payment details here.",
        lastMessageAt:now, lastSenderUid:"system",
        lastReadBy:{[offer.sellerUid]:now}, createdAt:now,
      });
    }
  }

  async function counterOffer(offer, counterAmount) {
    if (!counterAmount || isNaN(parseFloat(counterAmount))) return;
    const now = new Date().toISOString();
    const amt = parseFloat(counterAmount);
    try {
      // Mark original offer as countered + dismiss from current user's bar
      await setDoc(doc(db,"market_offers",offer.id), {
        status: "countered", notified: true, respondedAt: now,
      }, {merge:true});
      // Write paper trail to negotiation_history collection
      try {
        await setDoc(doc(db,"negotiation_history",uid()), {
          rootOfferId: offer.parentOfferId||offer.id,
          offerId: offer.id,
          listingId: offer.listingId||"",
          cardName: offer.cardName,
          cardImage: offer.cardImage||null,
          action: "counter",
          amount: amt,
          previousAmount: offer.offerAmount||0,
          fromUid: user.uid,
          fromName: user.displayName||user.email||"Unknown",
          sellerUid: offer.sellerUid,
          buyerUid: offer.buyerUid,
          timestamp: now,
        });
      } catch(e) { console.warn("History write failed (non-fatal):", e); }
      // Create a NEW offer doc with roles flipped so it lands in the
      // other party's marketNotifs feed (they query where sellerUid==theirUid)
      const newOffId = uid();
      const iAmSeller = offer.sellerUid === user.uid;
      await setDoc(doc(db,"market_offers",newOffId), {
        id: newOffId,
        parentOfferId: offer.id,
        listingId: offer.listingId,
        cardId: offer.cardId||"",
        cardName: offer.cardName,
        cardImage: offer.cardImage||null,
        cardTreatment: offer.cardTreatment||"",
        cardWeapon: offer.cardWeapon||"",
        sellerUid:  iAmSeller ? offer.buyerUid  : offer.sellerUid,
        sellerName: iAmSeller ? offer.buyerName  : offer.sellerName,
        buyerUid:   iAmSeller ? offer.sellerUid  : offer.buyerUid,
        buyerName:  iAmSeller ? offer.sellerName : offer.buyerName,
        offerAmount: amt,
        isCounter: true,
        status: "pending",
        notified: false,
        createdAt: now,
      });
    } catch(e) {
      console.error("counterOffer error:", e);
    } finally {
      // Always show confirmation regardless of errors
      setCounterSent(true);
    }
  }


  // -- Thread messaging --
  useEffect(() => {
    if (!activeThread) { setThreadMsgs([]); return; }
    const unsub = onSnapshot(
      doc(db,"deal_threads",activeThread.id),
      snap => {
        if (snap.exists()) {
          const msgs = (snap.data().messages||[]).slice().sort((a,b)=>a.sentAt>b.sentAt?1:-1);
          setThreadMsgs(msgs);
        }
      }
    );
    if (user) setDoc(doc(db,"deal_threads",activeThread.id),{lastReadBy:{[user.uid]:new Date().toISOString()}},{merge:true});
    return ()=>unsub();
  }, [activeThread?.id]);

  async function sendMessage() {
    if (!newMsg.trim()||!activeThread||!user) return;
    const now = new Date().toISOString();
    const msg = {id:uid(), text:newMsg.trim(), senderUid:user.uid, senderName:user.displayName||user.email, sentAt:now};
    await setDoc(doc(db,"deal_threads",activeThread.id),{
      messages: arrayUnion(msg),
      lastMessage:msg.text, lastMessageAt:now, lastSenderUid:user.uid,
      lastReadBy:{[user.uid]:now},
    },{merge:true});
    setNewMsg("");
  }

  async function closeThread(threadId) {
    await setDoc(doc(db,"deal_threads",threadId),{status:"completed"},{merge:true});
    setActiveThread(null);
  }

  // -- Computed --
  const sets       = [...new Set(cards.map(c=>c.setName).filter(Boolean))].sort();
  const weapons    = [...new Set(cards.map(c=>c.weapon).filter(Boolean))].sort();
  const treatments = [...new Set(cards.map(c=>c.treatment).filter(Boolean))].sort();

  const filtered = cards.filter(c=>{
    if(filterSet    && c.setName!==filterSet)    return false;
    if(filterWeapon && c.weapon!==filterWeapon)  return false;
    if(filterTreat  && c.treatment!==filterTreat) return false;
    if(filterOwned==="owned"   && !owned[c.id])  return false;
    if(filterOwned==="missing" &&  owned[c.id])  return false;
    if(search){const t=search.toLowerCase();return [c.hero,c.cardNum,c.athlete,c.weapon,c.treatment,c.setName].join(" ").toLowerCase().includes(t);}
    return true;
  }).sort((a,b)=>{
    if(sortBy==="power") return (parseFloat(b.power)||0)-(parseFloat(a.power)||0);
    if(sortBy==="cardNum"){const na=parseInt(String(a.cardNum||"").replace(/[^0-9]/g,"")||"0"),nb=parseInt(String(b.cardNum||"").replace(/[^0-9]/g,"")||"0");return na-nb;}
    return (a[sortBy]||"").toString().localeCompare((b[sortBy]||"").toString());
  });
  const visibleCards=filtered.slice(0,page*PAGE_SIZE);
  const totalOwned=Object.keys(owned).filter(id=>cards.find(c=>c.id===id)).length;
  const collectionValue=(()=>{
    // Build avg sale price per cardId from marketSales
    const priceMap={};
    marketSales.forEach(s=>{
      if(!s.cardId||!s.price) return;
      if(!priceMap[s.cardId]) priceMap[s.cardId]={total:0,count:0};
      priceMap[s.cardId].total+=s.price;
      priceMap[s.cardId].count+=1;
    });
    return Object.keys(owned).reduce((sum,cid)=>{
      const qty=owned[cid]||1;
      const avg=priceMap[cid]?priceMap[cid].total/priceMap[cid].count:0;
      return sum+avg*qty;
    },0);
  })();

  // -- Deck logic --
  const deckSet=new Set(deckCards);
  const inDeck=cards.filter(c=>deckSet.has(c.id));
  const isSpec=deckType==="spec",isAM=deckType==="apexmadness";
  const dupKey=c=>`${(c.hero||"").toLowerCase()}|${(c.variation||"").toLowerCase()}|${c.power||""}|${(c.weapon||"").toLowerCase()}`;
  const inDeckDupKeys=new Set(inDeck.map(dupKey));
  const powerCount={};inDeck.forEach(c=>{const p=c.power||"0";powerCount[p]=(powerCount[p]||0)+1;});
  const treatCore={},treatApex={};
  if(isAM){inDeck.forEach(c=>{const t=(c.treatment||"").toLowerCase(),p=parseFloat(c.power||0);if(p>=115&&p<=160)treatCore[t]=(treatCore[t]||0)+1;if(p>160)treatApex[t]=(treatApex[t]||0)+1;});}
  function canAddToDeck(c){
    if(deckSet.has(c.id))return{ok:false,reason:"Already in deck"};
    if(inDeck.length>=DECK_SIZE)return{ok:false,reason:"Deck full"};
    if(inDeckDupKeys.has(dupKey(c)))return{ok:false,reason:"Duplicate card"};
    if((powerCount[c.power||"0"]||0)>=6)return{ok:false,reason:`Already 6 at power ${c.power}`};
    const p=parseFloat(c.power||0);
    if(isSpec&&p>160)return{ok:false,reason:`Power ${c.power} exceeds 160`};
    if(isAM&&p>160){const t=(c.treatment||"").toLowerCase();if((treatCore[t]||0)<10)return{ok:false,reason:`Need 10 core ${c.treatment} first (${treatCore[t]||0}/10)`};if((treatApex[t]||0)>=1)return{ok:false,reason:`Already have 1 ${c.treatment} apex card`};}
    return{ok:true};
  }
  const deckAvail=cards.filter(c=>{
    if(deckSet.has(c.id))return false;
    if(deckFilterW&&c.weapon!==deckFilterW)return false;
    if(deckFilterP.size>0&&!deckFilterP.has(String(c.power||"")))return false;
    if(deckFilterS&&c.setName!==deckFilterS)return false;
    if(deckFilterT&&c.treatment!==deckFilterT)return false;
    if(deckSearch&&!`${c.hero} ${c.cardNum} ${c.treatment}`.toLowerCase().includes(deckSearch.toLowerCase()))return false;
    const t=(c.treatment||"").toLowerCase();
    if(t==="plays"||t==="bonus plays"||t==="home team discount")return false;
    return true;
  }).sort((a,b)=>(parseFloat(b.power)||0)-(parseFloat(a.power)||0));

  const totalNotifs = friendReqs.length+teamInvites.length+marketNotifs.length+wantNotifs.length+unreadThreads;

  if(loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh",background:"#000",fontFamily:"'Trebuchet MS',sans-serif",overflow:"hidden",position:"relative"}}>
      <style>{`
        @keyframes vaultSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes vaultSpinR { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
        @keyframes vaultPulse { 0%,100%{opacity:0.4;transform:scale(0.95)} 50%{opacity:1;transform:scale(1.05)} }
        @keyframes vaultGlow { 0%,100%{box-shadow:0 0 20px rgba(232,49,122,0.3)} 50%{box-shadow:0 0 60px rgba(232,49,122,0.8),0 0 100px rgba(123,47,247,0.4)} }
        @keyframes cardFloat { 0%{transform:translateY(0px) rotate(-3deg)} 50%{transform:translateY(-12px) rotate(3deg)} 100%{transform:translateY(0px) rotate(-3deg)} }
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes orb { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-20px) scale(1.1)} 66%{transform:translate(-20px,15px) scale(0.9)} }
        @keyframes dot { 0%,80%,100%{transform:scale(0.6);opacity:0.3} 40%{transform:scale(1);opacity:1} }
      `}</style>

      {/* Background orbs */}
      <div style={{position:"absolute",width:400,height:400,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,49,122,0.08) 0%,transparent 70%)",top:"10%",left:"10%",animation:"orb 8s ease-in-out infinite"}}/>
      <div style={{position:"absolute",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(123,47,247,0.08) 0%,transparent 70%)",bottom:"15%",right:"15%",animation:"orb 10s ease-in-out infinite reverse"}}/>

      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:32,animation:"fadeSlideUp 0.6s ease both"}}>

        {/* Vault icon - concentric spinning rings */}
        <div style={{position:"relative",width:120,height:120}}>
          {/* Ring 3 - outermost, slow */}
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(232,49,122,0.2)",animation:"vaultSpin 8s linear infinite"}}/>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px dashed rgba(123,47,247,0.15)",animation:"vaultSpinR 12s linear infinite"}}/>
          {/* Ring 2 */}
          <div style={{position:"absolute",inset:12,borderRadius:"50%",border:"2px solid rgba(232,49,122,0.4)",animation:"vaultSpin 4s linear infinite"}}/>
          <div style={{position:"absolute",inset:12,borderRadius:"50%",border:"1px solid rgba(123,47,247,0.3)",animation:"vaultSpinR 6s linear infinite"}}/>
          {/* Ring 1 - inner */}
          <div style={{position:"absolute",inset:24,borderRadius:"50%",border:"2px solid rgba(232,49,122,0.7)",animation:"vaultSpin 2s linear infinite",boxShadow:"0 0 20px rgba(232,49,122,0.4)"}}>
            <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:6,height:6,borderRadius:"50%",background:"#E8317A",boxShadow:"0 0 12px #E8317A"}}/>
          </div>
          {/* Center glow */}
          <div style={{position:"absolute",inset:36,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,49,122,0.15) 0%,transparent 70%)",animation:"vaultPulse 2s ease-in-out infinite"}}/>
          {/* Tick marks on outer ring */}
          {[0,60,120,180,240,300].map(deg=>(
            <div key={deg} style={{position:"absolute",top:"50%",left:"50%",width:8,height:2,background:"rgba(232,49,122,0.5)",borderRadius:1,transformOrigin:"left center",transform:`rotate(${deg}deg) translateX(52px) translateY(-1px)`}}/>
          ))}
        </div>

        {/* Text */}
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:900,letterSpacing:6,color:"rgba(255,255,255,0.15)",textTransform:"uppercase",marginBottom:8}}>Bazooka</div>
          <div style={{fontSize:32,fontWeight:900,background:"linear-gradient(135deg,#E8317A,#7B2FF7)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-1,marginBottom:4}}>VAULT</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,0.25)",letterSpacing:3,textTransform:"uppercase"}}>BoBA Collector Database</div>
        </div>

        {/* Animated dots */}
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {[0,0.2,0.4].map((delay,i)=>(
            <div key={i} style={{width:6,height:6,borderRadius:"50%",background:"#E8317A",animation:`dot 1.4s ease-in-out ${delay}s infinite`}}/>
          ))}
        </div>

      </div>
    </div>
  );

  // -- Render helpers --
  const tabBtn=(id,label,badge)=>(
    <button key={id} onClick={()=>setActiveTab(id)} style={{
      background:activeTab===id?"rgba(232,49,122,0.15)":"transparent",
      color:activeTab===id?"#E8317A":"rgba(255,255,255,0.5)",
      border:`1.5px solid ${activeTab===id?"#E8317A":"rgba(255,255,255,0.1)"}`,
      borderRadius:20, padding:"7px 18px", fontSize:12, fontWeight:700,
      cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", position:"relative",
      backdropFilter:"blur(10px)",
      transition:"all 0.2s ease",
      boxShadow:activeTab===id?"0 0 20px rgba(232,49,122,0.3)":"none"
    }}>
      {label}
      {badge>0&&<span style={{position:"absolute",top:-7,right:-7,background:"#E8317A",color:"#fff",borderRadius:"50%",width:18,height:18,fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 10px rgba(232,49,122,0.8)"}}>{badge}</span>}
    </button>
  );

  return (
    <div style={{minHeight:"100vh",background:"#000",color:"#F0F0F0",fontFamily:"'Trebuchet MS',sans-serif"}}>
      <style>{`
        @keyframes lockPulse { 0%{transform:scale(0.5);opacity:0} 40%{transform:scale(1.3);opacity:1} 70%{transform:scale(0.95);opacity:1} 100%{transform:scale(1);opacity:1} }
        @keyframes lockFadeOut { 0%{opacity:1} 70%{opacity:1} 100%{opacity:0} }
        @keyframes cardDim { 0%{opacity:1} 30%{opacity:0.35} 100%{opacity:1} }
        @keyframes floatUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes glowPulse { 0%,100%{opacity:0.5} 50%{opacity:1} }
        @keyframes cardEntrance { from{opacity:0;transform:translateY(20px) scale(0.95)} to{opacity:1;transform:translateY(0) scale(1)} }
        .pub-tab:hover{background:rgba(232,49,122,0.1)!important;color:rgba(255,255,255,0.8)!important;transform:translateY(-1px)}
        .pub-card-grid > * { animation: cardEntrance 0.4s ease both; }
        .pub-card-grid > *:nth-child(2n){animation-delay:0.05s}
        .pub-card-grid > *:nth-child(3n){animation-delay:0.1s}
        .pub-card-grid > *:nth-child(4n){animation-delay:0.15s}
        .market-card:hover{transform:translateY(-4px)!important;box-shadow:0 20px 60px rgba(232,49,122,0.3)!important}
        .filter-bar select,.filter-bar input{transition:border-color 0.2s ease,box-shadow 0.2s ease}
        .filter-bar select:focus,.filter-bar input:focus{border-color:#E8317A!important;box-shadow:0 0 0 3px rgba(232,49,122,0.15)!important}
      `}</style>

      {/* Comp Modal */}
      <CompModal compCard={compCard} setCompCard={setCompCard} marketSales={marketSales} WEAPON_COLORS={WEAPON_COLORS} cards={cards}
          listings={listings}
          />

      {/* Sign-in modal */}
      {signingIn&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(20px)"}} onClick={()=>setSigningIn(false)}>
          <div style={{background:"linear-gradient(135deg,#0d0d0d,#1a0a12)",border:"1px solid rgba(232,49,122,0.3)",borderRadius:24,padding:40,textAlign:"center",maxWidth:380,boxShadow:"0 40px 120px rgba(232,49,122,0.2)",animation:"floatUp 0.4s ease"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:48,marginBottom:16}}>{"\uD83C\uDCCF"}</div>
            <div style={{fontSize:22,fontWeight:900,color:"#F0F0F0",marginBottom:8}}>Join the Community</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.4)",marginBottom:28,lineHeight:1.6}}>Track your collection, scan cards, build decks, and connect with BoBA collectors worldwide.</div>
            <button onClick={signInGoogle} style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:14,padding:"14px 32px",fontSize:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",width:"100%",boxShadow:"0 8px 32px rgba(232,49,122,0.4)",transition:"transform 0.2s,box-shadow 0.2s"}}
              onMouseEnter={e=>{e.target.style.transform="translateY(-2px)";e.target.style.boxShadow="0 16px 48px rgba(232,49,122,0.5)";}}
              onMouseLeave={e=>{e.target.style.transform="";e.target.style.boxShadow="0 8px 32px rgba(232,49,122,0.4)";}}>
              Sign in with Google
            </button>
          </div>
        </div>
      )}

      {/* Listing modal */}
      {listModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(20px)"}} onClick={()=>setListModal(null)}>
          <div style={{background:"linear-gradient(135deg,#0d0d0d,#0a1a0a)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:24,padding:32,width:420,maxWidth:"90vw",boxShadow:"0 40px 120px rgba(74,222,128,0.15)",animation:"floatUp 0.3s ease"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:900,color:"#4ade80",marginBottom:4}}>{"\uD83D\uDCB0 List for Sale/Trade"}</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",marginBottom:20}}>{listModal.hero} &middot; {listModal.treatment} &middot; {listModal.power}\u26A1</div>
            <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
              {[["sale","For Sale"],["trade","For Trade"],["either","Sale or Trade"],["offer","Best Offer"]].map(([v,l])=>(
                <button key={v} onClick={()=>setListType(v)} style={{flex:1,minWidth:"45%",background:listType===v?"rgba(74,222,128,0.15)":"transparent",border:"1.5px solid "+(listType===v?"#4ade80":"rgba(255,255,255,0.1)"),color:listType===v?"#4ade80":"rgba(255,255,255,0.4)",borderRadius:10,padding:"8px 0",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{l}</button>
              ))}
            </div>

            {listType==="offer"?(
              <div style={{background:"rgba(74,222,128,0.05)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:10,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#4ade80",marginBottom:4}}>{"\uD83D\uDCE8 Accepting offers only"}</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>No asking price set. Buyers can submit any amount and you negotiate from there.</div>
              </div>
            ):(
              <div style={{position:"relative",marginBottom:10}}>
                <input value={listPrice} onChange={e=>setListPrice(e.target.value)} placeholder="Asking price ($)" type="number" step="0.01" style={{...inp,width:"100%",paddingRight:90,boxSizing:"border-box"}}/>
                {listPrice&&!isNaN(parseFloat(listPrice))&&(
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",fontSize:11,color:"rgba(255,255,255,0.3)"}}>or best offer</span>
                )}
              </div>
            )}
            <textarea value={listNotes} onChange={e=>setListNotes(e.target.value)} placeholder="Notes (condition, trades wanted, etc.)" rows={2} style={{...inp,width:"100%",marginBottom:10,resize:"none"}}/>
                <input value={listPayment} onChange={e=>setListPayment(e.target.value)} placeholder="Payment info (e.g. Venmo @handle, PayPal friends, Cash App $tag)" style={{...inp,width:"100%",marginBottom:16,boxSizing:"border-box",fontSize:12}}/>
            <div style={{display:"flex",gap:10}}>
              <button onClick={createListing} style={{flex:1,background:"linear-gradient(135deg,#4ade80,#22c55e)",color:"#000",border:"none",borderRadius:12,padding:"12px 0",fontSize:14,fontWeight:900,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 8px 24px rgba(74,222,128,0.3)"}}>List Card</button>
              <button onClick={()=>setListModal(null)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",borderRadius:12,padding:"12px 20px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Offer modal */}
      <OfferModal offerModal={offerModal} offerSent={offerSent} setOfferModal={setOfferModal} offerAmt={offerAmt} setOfferAmt={setOfferAmt} offerNote={offerNote} setOfferNote={setOfferNote} setOfferSent={setOfferSent} submitOffer={submitOffer} inp={inp}/>
      {/* Payment info popup */}
      {paymentPopup&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setPaymentPopup(null)}>
          <div style={{background:"linear-gradient(135deg,#0a1a0a,#0d0d0d)",border:"1px solid rgba(74,222,128,0.4)",borderRadius:20,padding:28,maxWidth:400,width:"100%"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:24,textAlign:"center",marginBottom:8}}>{"\uD83C\uDF89"}</div>
            <div style={{fontSize:18,fontWeight:900,color:"#4ade80",textAlign:"center",marginBottom:4}}>Purchase Complete!</div>
            <div style={{fontSize:13,color:"rgba(255,255,255,0.5)",textAlign:"center",marginBottom:20}}>{paymentPopup.cardName} {"\u00B7"} {"$"}{(paymentPopup.price||0).toFixed(2)}</div>
            <div style={{background:"rgba(74,222,128,0.06)",border:"1px solid rgba(74,222,128,0.15)",borderRadius:12,padding:"14px 16px",marginBottom:20}}>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.4)",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>Payment Instructions from {paymentPopup.sellerName}</div>
              <div style={{fontSize:14,color:"#F0F0F0",fontWeight:600,lineHeight:1.5}}>{paymentPopup.paymentInfo}</div>
            </div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.3)",textAlign:"center",marginBottom:16}}>Send payment and use the Messages tab to confirm with the seller.</div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{setPaymentPopup(null);setActiveTab("messages");}}
                style={{flex:1,background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"11px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit"}}>
                Go to Messages
              </button>
              <button onClick={()=>setPaymentPopup(null)}
                style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.4)",borderRadius:12,padding:"11px 18px",fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Counter offer modal */}
      <CounterModal counterModal={counterModal} counterSent={counterSent} setCounterModal={setCounterModal} counterAmt={counterAmt} setCounterAmt={setCounterAmt} setCounterSent={setCounterSent} counterOffer={counterOffer} negHistory={negHistory}/>
      {/* Scan modal */}
      {scanModal&&<ScanModal scanModal={scanModal} setScanModal={setScanModal} photoScan={photoScan} setPhotoScan={setPhotoScan} scanSession={scanSession} setScanSession={setScanSession} scanQty={scanQty} setScanQty={setScanQty} user={user} db={db} owned={owned} setOwned={setOwned} cards={cards} inp={inp} confirmScan={confirmScan}
          scanCardPhoto={scanCardPhoto}
          />}
      {/* HERO HEADER */}
      <div style={{
        position:"relative", overflow:"hidden",
        background:"linear-gradient(135deg,#0d0005,#0a000d,#050015,#000d1a)",
        backgroundSize:"400% 400%", animation:"gradientShift 12s ease infinite",
        borderBottom:"1px solid rgba(232,49,122,0.15)", paddingBottom:0
      }}>
        {/* Glow orbs */}
        <div style={{position:"absolute",top:-100,left:"20%",width:400,height:400,background:"radial-gradient(circle,rgba(232,49,122,0.12),transparent 70%)",pointerEvents:"none",animation:"glowPulse 4s ease infinite"}}/>
        <div style={{position:"absolute",top:-80,right:"15%",width:300,height:300,background:"radial-gradient(circle,rgba(123,47,247,0.1),transparent 70%)",pointerEvents:"none",animation:"glowPulse 6s ease infinite 2s"}}/>
        <div style={{position:"absolute",bottom:0,left:"40%",width:500,height:200,background:"radial-gradient(ellipse,rgba(123,156,255,0.06),transparent 70%)",pointerEvents:"none"}}/>

        <div style={{maxWidth:1400,margin:"0 auto",padding:"40px 24px 0",position:"relative"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",flexWrap:"wrap",gap:16,marginBottom:32}}>
            <div style={{opacity:headerLoaded?1:0,transform:headerLoaded?"none":"translateY(20px)",transition:"all 0.6s cubic-bezier(0.22,1,0.36,1)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#E8317A",letterSpacing:4,textTransform:"uppercase",marginBottom:8}}>Bazooka Vault</div>
              <h1 style={{margin:0,fontSize:"clamp(28px,5vw,52px)",fontWeight:900,lineHeight:1,textTransform:"uppercase",letterSpacing:"-1px"}}>
                <span style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7,#7B9CFF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundSize:"200%",animation:"gradientShift 4s ease infinite"}}>Bazooka</span>
                <br/>
                <span style={{color:"#F0F0F0"}}>{"Collector's Database"}</span>
              </h1>
              <div style={{display:"flex",gap:12,marginTop:14,flexWrap:"wrap"}}>
                {[{v:cards.length.toLocaleString(),l:"Cards"},{v:sets.length,l:"Sets"},{v:totalOwned,l:"Owned"},{v:collectionValue>0?"$"+collectionValue.toFixed(0):"--",l:"Est. Value"}].map(({v,l})=>(
                  <div key={l} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 14px",backdropFilter:"blur(10px)"}}>
                    <span style={{fontSize:15,fontWeight:900,color:"#E8317A"}}>{v}</span>
                    <span style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginLeft:6}}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,opacity:headerLoaded?1:0,transition:"opacity 0.8s ease 0.2s"}}>
              {user?(
                <>
                  {user.photoURL&&<img src={user.photoURL} alt="" style={{width:40,height:40,borderRadius:"50%",border:"2px solid #E8317A",boxShadow:"0 0 16px rgba(232,49,122,0.4)"}}/>}
                  <div>
                    <div style={{fontSize:13,fontWeight:700}}>{user.displayName?.split(" ")[0]}</div>
                    <div style={{fontSize:11,color:"#4ade80"}}>{totalOwned} owned</div>
                  </div>
                  <button onClick={()=>setScanModal(true)} style={{background:"linear-gradient(135deg,rgba(232,49,122,0.2),rgba(123,47,247,0.2))",color:"#E8317A",border:"1px solid rgba(232,49,122,0.4)",borderRadius:12,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)",transition:"all 0.2s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(232,49,122,0.35),rgba(123,47,247,0.35))";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg,rgba(232,49,122,0.2),rgba(123,47,247,0.2))";}}>
                    {"\uD83D\uDCF7 Scan"}</button>
                  <button onClick={()=>signOut(auth)} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",borderRadius:10,padding:"7px 14px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Sign out</button>
                </>
              ):(
                <button onClick={()=>setSigningIn(true)} style={{background:"linear-gradient(135deg,#E8317A,#7B2FF7)",color:"#fff",border:"none",borderRadius:14,padding:"10px 24px",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 8px 32px rgba(232,49,122,0.4)",transition:"all 0.2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 16px 48px rgba(232,49,122,0.5)";}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 8px 32px rgba(232,49,122,0.4)";}}>
                  Sign in
                </button>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingBottom:20}}>
            {tabBtn("cards","\uD83C\uDCCF Cards",0)}
            {tabBtn("wants","\uD83C\uDFAF Wants",Object.keys(wantList).length)}
            {tabBtn("deck","\u2694\uFE0F Deck Builder",0)}
            {tabBtn("playbook","\uD83D\uDCD6 Playbook",0)}
            {tabBtn("market","\uD83D\uDCB0 Market",wantNotifs.length)}
            {user&&tabBtn("messages","\uD83D\uDCAC Messages",unreadThreads)}
            {user&&tabBtn("friends","\uD83D\uDC65 Friends",(friendReqs.length+teamInvites.length))}
            {user&&tabBtn("team","\uD83C\uDFC6 Team",0)}
          </div>
        </div>
      </div>

      {/* Market notifications bar */}
      {marketNotifs.length>0&&(
        <div style={{background:"linear-gradient(135deg,rgba(251,191,36,0.1),rgba(245,158,11,0.05))",borderBottom:"1px solid rgba(251,191,36,0.2)",padding:"10px 24px"}}>
          <div style={{maxWidth:1400,margin:"0 auto",display:"flex",gap:12,flexWrap:"wrap"}}>
            {marketNotifs.map(n=>(
              <div key={n.id} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRadius:12,padding:"8px 14px"}}>
                <span style={{fontSize:14}}>{"\uD83E\uDD1D"}</span>
                <span style={{fontSize:12,color:"#FBBF24",fontWeight:700}}>{n.buyerName} {n.isCounter?"countered":"offered"} <strong>${(n.offerAmount||0).toFixed(2)}</strong> for {n.cardName}</span>
                {n.isCounter?(
                  <>
                    <button onClick={()=>respondOffer(n,"accepted")} style={{background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.3)",color:"#4ade80",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Accept</button>
                    <button onClick={()=>{setCounterModal(n);setCounterAmt("");}} style={{background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.3)",color:"#FBBF24",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Counter</button>
                    <button onClick={()=>respondOffer(n,"declined")} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Decline</button>
                  </>
                ):(
                  <>
                    <button onClick={()=>respondOffer(n,"accepted")} style={{background:"rgba(74,222,128,0.15)",border:"1px solid rgba(74,222,128,0.3)",color:"#4ade80",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Accept</button>
                    <button onClick={()=>{setCounterModal(n);setCounterAmt("");}} style={{background:"rgba(251,191,36,0.15)",border:"1px solid rgba(251,191,36,0.3)",color:"#FBBF24",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Counter</button>
                    <button onClick={()=>respondOffer(n,"declined")} style={{background:"transparent",border:"1px solid rgba(255,255,255,0.1)",color:"rgba(255,255,255,0.3)",borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Decline</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Want notifications bar */}
      {wantNotifs.length>0&&(
        <div style={{background:"linear-gradient(135deg,rgba(232,49,122,0.08),rgba(123,47,247,0.05))",borderBottom:"1px solid rgba(232,49,122,0.15)",padding:"10px 24px"}}>
          <div style={{maxWidth:1400,margin:"0 auto",display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
            <span style={{fontSize:12,color:"rgba(255,255,255,0.4)",fontWeight:700,whiteSpace:"nowrap"}}>{"\uD83C\uDFAF Cards on your want list are now available:"}</span>
            {wantNotifs.map(n=>(
              <div key={n.id} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(232,49,122,0.08)",border:"1px solid rgba(232,49,122,0.2)",borderRadius:12,padding:"6px 12px"}}>
                {n.cardImage&&<img src={n.cardImage} alt={n.cardName} style={{width:24,height:32,objectFit:"cover",borderRadius:4,flexShrink:0}}/>}
                <span style={{fontSize:12,color:"#E8317A",fontWeight:700}}>{n.cardName}</span>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>by {n.sellerName} &middot; ${(n.askingPrice||0).toFixed(2)}</span>
                <button onClick={()=>{setActiveTab("market");setDoc(doc(db,"market_notifs",n.id),{read:true},{merge:true});}} style={{background:"rgba(232,49,122,0.15)",border:"1px solid rgba(232,49,122,0.3)",color:"#E8317A",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>View</button>
                <button onClick={()=>setDoc(doc(db,"market_notifs",n.id),{read:true},{merge:true})} style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.2)",cursor:"pointer",fontSize:14,padding:"0 2px"}}>{"\u00D7"}</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT */}
      <div style={{maxWidth:1400,margin:"0 auto",padding:20}}>

        {/* CARDS TAB */}
        {activeTab==="cards"&&(
          <>
            <div className="filter-bar" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"14px 18px",marginBottom:16,backdropFilter:"blur(10px)",display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <input value={search} onChange={e=>{setSearch(e.target.value);setPage(1);}} placeholder="Search hero, card #, athlete, treatment..." style={{...inp,flex:2,minWidth:200}}/>
              <select value={filterSet} onChange={e=>{setFilterSet(e.target.value);setPage(1);}} style={{...inp,flex:1,minWidth:140,cursor:"pointer"}}>
                <option value="">All Sets</option>{sets.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filterTreat} onChange={e=>{setFilterTreat(e.target.value);setPage(1);}} style={{...inp,flex:1,minWidth:140,cursor:"pointer"}}>
                <option value="">All Treatments</option>{treatments.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <select value={filterWeapon} onChange={e=>{setFilterWeapon(e.target.value);setPage(1);}} style={{...inp,width:130,cursor:"pointer"}}>
                <option value="">All Weapons</option>{weapons.map(w=><option key={w} value={w}>{w}</option>)}
              </select>
              <select value={sortBy} onChange={e=>{setSortBy(e.target.value);setPage(1);}} style={{...inp,width:130,cursor:"pointer"}}>
                <option value="cardNum">Card #</option>
                <option value="hero">{"Hero A\u2192Z"}</option>
                <option value="power">{"Power \u2193"}</option>
                <option value="setName">Set</option>
              </select>
              {user&&(
                <div style={{display:"flex",gap:4}}>
                  {[["all","All"],["owned","\u2705 Owned"],["missing","\u274C Missing"]].map(([v,l])=>(
                    <button key={v} onClick={()=>{setFilterOwned(v);setPage(1);}} style={{background:filterOwned===v?"rgba(232,49,122,0.15)":"transparent",color:filterOwned===v?"#E8317A":"rgba(255,255,255,0.4)",border:`1.5px solid ${filterOwned===v?"#E8317A":"rgba(255,255,255,0.08)"}`,borderRadius:20,padding:"6px 14px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.2s"}}>{l}</button>
                  ))}
                </div>
              )}
              <span style={{fontSize:12,color:"rgba(255,255,255,0.2)",marginLeft:"auto"}}>{filtered.length.toLocaleString()} cards</span>
            </div>
            <div className="pub-card-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
              {visibleCards.map(c=>(
                <div key={c.id} style={{position:"relative"}}>
                  <BobaCard c={c} isOwned={!!owned[c.id]} ownedQty={owned[c.id]||0}
                    flippedCard={flippedCard} setFlippedCard={setFlippedCard}
                    toggleOwned={()=>{if(!user){setSigningIn(true);return;} toggleOwned(c.id);}}
                    setOwnedQty={(id,qty)=>setOwnedQty(id,qty)}
                    toggleWant={()=>toggleWant(c.id)} wantList={wantList} WEAPON_COLORS={WEAPON_COLORS}/>
                  {/* Comp button -- bottom left of every card */}
                  <button onClick={e=>{e.stopPropagation();setCompCard(c);}} title="View price comps"
                    style={{position:"absolute",bottom:6,left:6,background:"rgba(0,0,0,0.75)",border:"1px solid rgba(123,156,255,0.3)",borderRadius:6,padding:"3px 7px",fontSize:10,cursor:"pointer",backdropFilter:"blur(6px)",color:"#7B9CFF",fontWeight:700,zIndex:10}}>
                    {"\uD83D\uDCCA Comp"}</button>
                  {/* Lock animation overlay */}
                  {privacyAnim===c.id&&(
                    <div style={{position:"absolute",inset:0,borderRadius:10,zIndex:20,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none",animation:"lockFadeOut 1.2s ease forwards",background:"rgba(0,0,0,0.55)"}}>
                      <div style={{fontSize:48,animation:"lockPulse 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards",lineHeight:1,marginBottom:6}}>
                        {privateCards[c.id]?"\uD83D\uDD12":"\uD83D\uDC41"}
                      </div>
                      <div style={{fontSize:11,fontWeight:800,color:"#fff",textAlign:"center",textShadow:"0 2px 8px rgba(0,0,0,0.8)",letterSpacing:0.5}}>
                        {privateCards[c.id]?"Hidden from friends":"Visible to friends"}
                      </div>
                    </div>
                  )}
                  {/* Card dim when private */}
                  {privateCards[c.id]&&privacyAnim!==c.id&&(
                    <div style={{position:"absolute",inset:0,borderRadius:10,background:"rgba(0,0,0,0.4)",pointerEvents:"none",zIndex:5,display:"flex",alignItems:"flex-end",justifyContent:"flex-end",padding:6}}>
                      <span style={{fontSize:14,filter:"drop-shadow(0 1px 3px rgba(0,0,0,0.8))"}}>{"\uD83D\uDD12"}</span>
                    </div>
                  )}
                  {/* Private toggle + list button on owned cards */}
                  {owned[c.id]&&(
                    <div style={{position:"absolute",top:6,left:6,display:"flex",gap:4,zIndex:10}}>
                      <button onClick={e=>{
                        e.stopPropagation();
                        togglePrivate(c.id);
                        setPrivacyAnim(c.id);
                        setTimeout(()=>setPrivacyAnim(null), 1300);
                      }} title={privateCards[c.id]?"Card is private (friends can't see)":"Card is visible to friends"}
                        style={{background:privateCards[c.id]?"rgba(232,49,122,0.85)":"rgba(0,0,0,0.6)",border:"none",borderRadius:6,padding:"3px 6px",fontSize:11,cursor:"pointer",backdropFilter:"blur(4px)",color:"#fff",fontWeight:700,transition:"background 0.2s"}}>
                        {privateCards[c.id]?"\uD83D\uDD12":"\uD83D\uDC41"}
                      </button>
                      <button onClick={e=>{e.stopPropagation();setListModal(c);}} title="List for sale or trade"
                        style={{background:"rgba(74,222,128,0.7)",border:"none",borderRadius:6,padding:"3px 6px",fontSize:11,cursor:"pointer",backdropFilter:"blur(4px)",color:"#000",fontWeight:700,display:myListings.find(l=>l.cardId===c.id)?"none":"block"}}>
                        {"\uD83D\uDCB0"}</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {visibleCards.length<filtered.length&&<div style={{textAlign:"center",padding:32,color:"rgba(255,255,255,0.2)",fontSize:12}}>Scroll to load more...</div>}
          </>
        )}

        {/* WANTS TAB */}
        {activeTab==="wants"&&(
          <div>
            {Object.keys(wantList).length===0?(
              <div style={{textAlign:"center",padding:80,color:"rgba(255,255,255,0.2)"}}>
                <div style={{fontSize:48,marginBottom:16}}>{"\uD83C\uDFAF"}</div>
                <div style={{fontSize:16,fontWeight:700}}>No cards on your want list</div>
                <div style={{fontSize:13,marginTop:8}}>Flip a card in the Cards tab and tap + Want</div>
              </div>
            ):(
              <div className="pub-card-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10}}>
                {cards.filter(c=>wantList[c.id]).map(c=>(
                  <BobaCard key={c.id} c={c} isOwned={!!owned[c.id]} ownedQty={owned[c.id]||0}
                    flippedCard={flippedCard} setFlippedCard={setFlippedCard}
                    toggleOwned={()=>toggleOwned(c.id)} setOwnedQty={(id,qty)=>setOwnedQty(id,qty)}
                    toggleWant={()=>toggleWant(c.id)} wantList={wantList} WEAPON_COLORS={WEAPON_COLORS}/>
                ))}
              </div>
            )}
          </div>
        )}

        {/* DECK BUILDER TAB */}
        {activeTab==="deck"&&(
          <DeckBuilderTab
            user={user} deckCards={deckCards} setDeckCards={setDeckCards}
            deckName={deckName} setDeckName={setDeckName}
            deckType={deckType} setDeckType={setDeckType}
            deckSearch={deckSearch} setDeckSearch={setDeckSearch}
            deckFilterW={deckFilterW} setDeckFilterW={setDeckFilterW}
            deckFilterP={deckFilterP} setDeckFilterP={setDeckFilterP}
            deckFilterS={deckFilterS} setDeckFilterS={setDeckFilterS}
            deckFilterT={deckFilterT} setDeckFilterT={setDeckFilterT}
            WEAPON_COLORS={WEAPON_COLORS} setSigningIn={setSigningIn}
            cards={cards} owned={owned} inp={inp}
            canAddToDeck={canAddToDeck}
          />
        )}

        {/* PLAYBOOK TAB */}
        {activeTab==="playbook"&&(
          <PlaybookTab
            user={user} pbCards={pbCards} pbSearch={pbSearch} setPbSearch={setPbSearch}
            pbSort={pbSort} setPbSort={setPbSort} WEAPON_COLORS={WEAPON_COLORS}
            setSigningIn={setSigningIn} cards={cards} owned={owned}
            inp={inp}
          />
        )}

        {/* MARKET TAB */}
        {activeTab==="market"&&(
          <MarketTab
            user={user} myListings={myListings} listings={listings}
            WEAPON_COLORS={WEAPON_COLORS} allMyOffers={allMyOffers}
            marketSales={marketSales} trackingInputs={trackingInputs}
            setTrackingInputs={setTrackingInputs} setListModal={setListModal}
            setOfferModal={setOfferModal} setOfferAmt={setOfferAmt}
            setOfferNote={setOfferNote} setOfferSent={setOfferSent}
            setCounterModal={setCounterModal} setCounterAmt={setCounterAmt}
            buyNow={buyNow} respondOffer={respondOffer}
            unsellListing={unsellListing} saveTracking={saveTracking}
            setSigningIn={setSigningIn} setActiveTab={setActiveTab}
            inp={inp} listType={listType} cards={cards} owned={owned} search={search}
          removeListing={removeListing}
          />
        )}

        {/* MESSAGES TAB */}
        {/* MESSAGES TAB - always mounted so thread listener stays active */}
        <div style={{maxWidth:800,margin:"0 auto",display:activeTab==="messages"?"block":"none"}}>
            <MessagesTab
              user={user}
              activeThread={activeThread}
              setActiveThread={setActiveThread}
              threads={threads}
              threadMsgs={threadMsgs}
              newMsg={newMsg}
              setNewMsg={setNewMsg}
              sendMessage={sendMessage}
              closeThread={closeThread}
              marketSales={marketSales}
              inp={inp}
              WEAPON_COLORS={WEAPON_COLORS}
              setSigningIn={setSigningIn}
            />
          </div>


        {/* FRIENDS TAB */}
        {activeTab==="friends"&&(
          <FriendsTab
            user={user} friends={friends} friendReqs={friendReqs} sentReqs={sentReqs}
            addEmail={addEmail} setAddEmail={setAddEmail}
            addStatus={addStatus} setAddStatus={setAddStatus}
            friendOwned={friendOwned} viewingFriend={viewingFriend} setViewingFriend={setViewingFriend}
            respondFriendReq={respondFriendReq} addFriend={addFriend}
            sendFriendRequest={sendFriendRequest}
            cards={cards} owned={owned} privateCards={privateCards}
            WEAPON_COLORS={WEAPON_COLORS} setSigningIn={setSigningIn}
            inp={inp} teamInvites={teamInvites}
          respondTeamInvite={respondTeamInvite}
          />
        )}

        {/* TEAM TAB */}
        {activeTab==="team"&&(
          <TeamTab
            user={user} teams={teams} activeTeam={activeTeam} setActiveTeam={setActiveTeam}
            newTeamName={newTeamName} setNewTeamName={setNewTeamName}
            inviteEmail={inviteEmail} setInviteEmail={setInviteEmail}
            inviteStatus={inviteStatus} setInviteStatus={setInviteStatus}
            teamInvites={teamInvites} moveTeamMember={moveTeamMember}
            deleteTeam={deleteTeam} respondTeamInvite={respondTeamInvite}
            createTeam={createTeam} inviteMember={inviteMember}
            WEAPON_COLORS={WEAPON_COLORS} setSigningIn={setSigningIn}
            cards={cards} owned={owned} friendOwned={friendOwned}
            inp={inp} inviteToTeam={inviteToTeam}
          />
        )}
      </div>{/* end tab content */}
    </div>
  );
}


function parseLocalDate(dateStr) {
  if (!dateStr) return new Date(0);
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) return new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]), 12, 0, 0);
  return new Date(dateStr);
}


// --- PUBLIC QUOTE PAGE --------------------------------------
function PublicQuote({ quoteId }) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState("");
  const [counterAmt, setCounterAmt] = useState("");
  const [payment, setPayment] = useState("");
  const [paymentHandle, setPaymentHandle] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!quoteId) return;
    getDoc(doc(db, "quotes", quoteId)).then(snap => {
      if (snap.exists()) {
        setQuote({ id: snap.id, ...snap.data() });
        // Track view
        setDoc(doc(db, "quotes", quoteId), {
          viewCount: (snap.data().viewCount || 0) + 1,
          lastViewedAt: new Date().toISOString(),
        }, { merge: true });
      }
      setLoading(false);
    });
  }, [quoteId]);

  if (loading) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#000", color:"#E8317A", fontFamily:"'Trebuchet MS',sans-serif", fontSize:16, fontWeight:700 }}>Loading quote...</div>;
  if (!quote) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#000", color:"#888", fontFamily:"'Trebuchet MS',sans-serif", fontSize:14 }}>Quote not found or has expired.</div>;

  const isExpired = new Date() > new Date(new Date(quote.createdAt).getTime() + 7*24*60*60*1000);
  const isClosed  = quote.status === "closed";
  const totalMkt  = (quote.cards||[]).reduce((s,c)=>(s+(parseFloat(c.mktVal)||0)*(parseInt(c.qty)||1)),0);
  const offer     = parseFloat(quote.currentOffer || quote.dispOffer) || 0;
  const offerPct  = totalMkt > 0 ? (offer/totalMkt*100).toFixed(1) : null;

  async function submitResponse(type) {
    if (type === "accepted") {
      await setDoc(doc(db,"quotes",quote.id), { status:"accepted", sellerPayment:payment, sellerHandle:paymentHandle, notified:false, respondedAt:new Date().toISOString() }, { merge:true });
    } else if (type === "declined") {
      await setDoc(doc(db,"quotes",quote.id), { status:"declined", notified:false, respondedAt:new Date().toISOString() }, { merge:true });
    } else if (type === "countered") {
      const amt = parseFloat(counterAmt);
      if (!amt) return;
      await setDoc(doc(db,"quotes",quote.id), { status:"countered", sellerCounter:amt, notified:false, respondedAt:new Date().toISOString(), history:[...(quote.history||[]),{type:"seller_counter",amount:amt,timestamp:new Date().toISOString()}] }, { merge:true });
    }
    setSubmitted(true);
    setQuote(prev => ({ ...prev, status: type }));
  }

  const PAYMENT_METHODS = ["Venmo","PayPal","Zelle","Cash App","Cash","Other"];

  return (
    <div style={{ minHeight:"100vh", background:"#000", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", color:"#F0F0F0", padding:"24px 16px" }}>
      <div style={{ maxWidth:680, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ background:"#0a0a0a", borderRadius:16, padding:"28px 32px", marginBottom:16, textAlign:"center", border:"1px solid #1a1a1a" }}>
          <div style={{ fontSize:32, fontWeight:900, color:"#E8317A", letterSpacing:4, marginBottom:4 }}>BAZOOKA</div>
          <div style={{ fontSize:11, color:"#555", fontStyle:"italic" }}>Bo Jackson Battle Arena &middot; Lot Purchase Offer</div>
        </div>

        {(isExpired || isClosed) && (
          <div style={{ background:"#1a0a0a", border:"1px solid #E8317A44", borderRadius:12, padding:"16px 20px", marginBottom:16, textAlign:"center" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#E8317A" }}>{isClosed ? "This quote has been closed." : "This quote has expired (7-day limit)."}</div>
            <div style={{ fontSize:12, color:"#555", marginTop:4 }}>Please contact Bazooka Breaks for a new offer.</div>
          </div>
        )}

        {/* Status badge */}
        {quote.status && quote.status !== "pending" && (
          <div style={{ marginBottom:16, textAlign:"center" }}>
            {{ accepted:<span style={{background:"#0a1a0a",color:"#4ade80",border:"1px solid #4ade8044",borderRadius:20,padding:"6px 20px",fontSize:13,fontWeight:700}}>{"\u2705 You accepted this offer"}</span>, declined:<span style={{background:"#1a0a0a",color:"#E8317A",border:"1px solid #E8317A44",borderRadius:20,padding:"6px 20px",fontSize:13,fontWeight:700}}>{"\u274C You declined this offer"}</span>, countered:<span style={{background:"#1a1400",color:"#FBBF24",border:"1px solid #FBBF2444",borderRadius:20,padding:"6px 20px",fontSize:13,fontWeight:700}}>{"\uD83E\uDD1D Counter offer sent"}</span> }[quote.status]}
          </div>
        )}

        {/* Seller info */}
        <div style={{ background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 18px", marginBottom:12, display:"grid", gridTemplateColumns:"1fr 1fr" }}>
          <div><span style={{ color:"#555", fontSize:11 }}>Prepared for: </span><strong style={{ color:"#F0F0F0" }}>{quote.seller?.name || "--"}</strong></div>
          <div style={{ textAlign:"right" }}><span style={{ color:"#555", fontSize:11 }}>Date: </span><strong style={{ color:"#F0F0F0" }}>{quote.seller?.date || new Date(quote.createdAt).toLocaleDateString()}</strong></div>
        </div>

        {/* Cards table */}
        {quote.cards && quote.cards.length > 0 && (
          <div style={{ background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, overflow:"hidden", marginBottom:12 }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#0a0a0a" }}>
                  {["#","Card Name","Qty","Value/Card","Offer/Card"].map(h=>(
                    <th key={h} style={{ padding:"10px 12px", fontSize:10, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1, textAlign:"left", borderBottom:"1px solid #1a1a1a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {quote.cards.map((c,i) => {
                  const mv = parseFloat(c.mktVal)||0;
                  const dispPct = totalMkt > 0 ? offer/totalMkt : 0;
                  return (
                    <tr key={i} style={{ borderBottom:"1px solid #1a1a1a" }}>
                      <td style={{ padding:"10px 12px", color:"#555", fontSize:12 }}>{i+1}</td>
                      <td style={{ padding:"10px 12px", fontWeight:700, color:"#F0F0F0", fontSize:13 }}>{c.name}</td>
                      <td style={{ padding:"10px 12px", color:"#888", fontSize:12, textAlign:"center" }}>{parseInt(c.qty)||1}</td>
                      <td style={{ padding:"10px 12px", color:"#888", fontSize:12 }}>${mv.toFixed(2)}</td>
                      <td style={{ padding:"10px 12px", color:"#E8317A", fontWeight:700, fontSize:12 }}>${(mv*dispPct).toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Notes */}
        {quote.custNote && (
          <div style={{ background:"#111111", border:"1px solid #1a1a1a", borderLeft:"3px solid #E8317A", borderRadius:8, padding:"12px 16px", marginBottom:12 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Notes from Bazooka</div>
            <p style={{ margin:0, fontSize:13, color:"#888", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{quote.custNote}</p>
          </div>
        )}

        {/* Offer box */}
        <div style={{ background:"#111111", border:"2px solid #E8317A33", borderRadius:12, padding:"20px 24px", marginBottom:12 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span style={{ fontSize:16, fontWeight:800, color:"#E8317A" }}>Bazooka's Offer</span>
            <span style={{ fontSize:32, fontWeight:900, color:"#F0F0F0" }}>${offer.toFixed(2)}</span>
          </div>
          <div style={{ fontSize:12, color:"#555", marginTop:4 }}>{quote.totalCards || (quote.cards||[]).reduce((s,c)=>s+(parseInt(c.qty)||1),0)} cards total</div>
        </div>

        {/* -- RESPONSE AREA -- right after the offer, impossible to miss -- */}
        {!isExpired && !isClosed && !submitted && (quote.status === "pending" || !quote.status) && (
          <div style={{ background:"#111111", border:"2px solid #4ade8044", borderRadius:12, padding:"20px", marginBottom:12 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#888", marginBottom:14 }}>How would you like to respond?</div>

            {/* Payment method */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>How should Bazooka pay you?</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                <select value={payment} onChange={e=>setPayment(e.target.value)}
                  style={{ background:"#0a0a0a", border:`1px solid ${payment?"#4ade80":"#2a2a2a"}`, borderRadius:8, color:payment?"#F0F0F0":"#666", padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}>
                  <option value="">Select method...</option>
                  {PAYMENT_METHODS.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
                <input value={paymentHandle} onChange={e=>setPaymentHandle(e.target.value)}
                  placeholder={payment==="Venmo"?"@yourhandle":payment==="PayPal"?"email or username":payment==="Zelle"?"email or phone":payment?"your info":"handle / account"}
                  style={{ background:"#0a0a0a", border:`1px solid ${paymentHandle?"#4ade80":"#2a2a2a"}`, borderRadius:8, color:"#F0F0F0", padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}/>
              </div>
            </div>

            {/* Big Accept button */}
            <button onClick={()=>submitResponse("accepted")}
              style={{ width:"100%", background:"#4ade80", color:"#000", border:"none", borderRadius:12, padding:"18px 0", fontSize:18, fontWeight:900, cursor:"pointer", fontFamily:"inherit", marginBottom:10 }}>
              {"\u2705 Accept Offer -- $"}{offer.toFixed(2)}
            </button>

            {/* Counter offer */}
            {quote.allowCounter && (
              <div style={{ marginBottom:10 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Or send a counter offer</div>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="number" step="0.01" value={counterAmt} onChange={e=>setCounterAmt(e.target.value)}
                    placeholder={`Your counter (e.g. $${(offer*1.1).toFixed(0)})`}
                    style={{ flex:1, background:"#0a0a0a", border:"1px solid #FBBF2444", borderRadius:8, color:"#FBBF24", padding:"10px 12px", fontSize:13, fontFamily:"inherit", outline:"none" }}/>
                  <button onClick={()=>submitResponse("countered")} disabled={!counterAmt}
                    style={{ background:"#1a1400", border:"2px solid #FBBF24", color:"#FBBF24", borderRadius:8, padding:"10px 18px", fontSize:13, fontWeight:700, cursor:counterAmt?"pointer":"not-allowed", fontFamily:"inherit", opacity:counterAmt?1:0.4, whiteSpace:"nowrap" }}>
                    {"\uD83E\uDD1D Counter"}</button>
                </div>
              </div>
            )}

            {/* Decline -- subtle */}
            <button onClick={()=>{ if(window.confirm("Decline this offer?")) submitResponse("declined"); }}
              style={{ width:"100%", background:"transparent", border:"1px solid #333", color:"#555", borderRadius:8, padding:"10px 0", fontSize:12, cursor:"pointer", fontFamily:"inherit" }}>
              {"\u274C Decline this offer"}</button>
          </div>
        )}

        {/* Ship-to */}
        <div style={{ background:"#111111", border:"1px solid #1a1a1a", borderRadius:10, padding:"14px 18px", marginBottom:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:"#555", textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 }}>Ship Cards To</div>
          <div style={{ fontSize:13, color:"#F0F0F0", fontWeight:700, lineHeight:1.8 }}>
            Devin -- Bazooka<br/>
            425 Prosperity Dr<br/>
            Warsaw, IN 46582
          </div>
        </div>

        {submitted && (
          <div style={{ background:"#0a1a0a", border:"2px solid #4ade80", borderRadius:12, padding:"20px", textAlign:"center" }}>
            <div style={{ fontSize:28, marginBottom:8 }}>{"\u2705"}</div>
            <div style={{ fontSize:16, fontWeight:800, color:"#4ade80" }}>Response sent!</div>
            <div style={{ fontSize:12, color:"#555", marginTop:6 }}>Bazooka Breaks will be in touch soon.</div>
          </div>
        )}

        <div style={{ marginTop:20, textAlign:"center", color:"#333", fontSize:11, fontStyle:"italic" }}>
          This offer is valid for 7 days. Thank you for bringing your collection to Bazooka!
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [tab,           setTab]           = useState("dashboard");
  const [gSearch,       setGSearch]       = useState("");
  const [gOpen,         setGOpen]         = useState(false);
  const [user,          setUser]          = useState(null);
  const [authReady,     setAuthReady]     = useState(false);
  const [viewAs,        setViewAs]        = useState("");
  const [inventory,     setInventory]     = useState([]);
  const [breaks,        setBreaks]        = useState([]);
  const [streams,       setStreams]       = useState([]);
  const [comps,         setComps]         = useState([]);
  const [quotes,        setQuotes]        = useState([]);
  const [buyers,        setBuyers]        = useState([]);
  const [csvImports,    setCsvImports]    = useState([]);
  const [shipments,     setShipments]     = useState([]);
  const [productUsage,  setProductUsage]  = useState([]);
  const [skuPrices,     setSkuPrices]     = useState({});
  const [skuPriceHistory,setSkuPriceHistory]=useState([]);
  const [cardPools,     setCardPools]     = useState([]);
  const [lotTracking,   setLotTracking]   = useState({});
  const [lotNotes,      setLotNotes]      = useState({});
  const [historicalData,setHistoricalData]=useState([]);
  const [payStubs,      setPayStubs]      = useState([]);
  const [imcFormUrl,    setImcFormUrl]    = useState("");
  const [bobaCards,     setBobaCards]     = useState([]);
  const [toast,         setToast]         = useState(null);
  const [scanStatus,    setScanStatus]    = useState(null);
  const [activeScan,    setActiveScan]    = useState(null);

  const BOBA_CACHE_KEY = "boba_checklist_cache_v2";
  const BOBA_CACHE_TTL = 24 * 60 * 60 * 1000;

  // Load bobaCards at startup
  useEffect(() => {
    async function loadBobaCards() {
      try {
        const raw = localStorage.getItem(BOBA_CACHE_KEY);
        if (raw) {
          const { cards: cc, ts } = JSON.parse(raw);
          if (cc?.length > 0 && Date.now() - ts < BOBA_CACHE_TTL) {
            setBobaCards(cc); return;
          }
        }
      } catch(e) {}
      try {
        const snap = await getDocs(collection(db, "boba_checklist"));
        const cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setBobaCards(cards);
        try { localStorage.setItem(BOBA_CACHE_KEY, JSON.stringify({ cards, ts: Date.now() })); } catch(e) {}
      } catch(e) {}
    }
    loadBobaCards();
  }, []);

  // Auth listener
  useEffect(() => {
    return onAuthStateChanged(auth, u => { setUser(u); setAuthReady(true); });
  }, []);

  // Firestore listeners
  useEffect(() => {
    if (!user) return;
    const unsubs = [
      onSnapshot(query(collection(db,"inventory"), orderBy("dateAdded","asc")), snap => setInventory(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"breaks"), orderBy("dateAdded","asc")), snap => setBreaks(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(query(collection(db,"streams"), orderBy("date","asc")), snap => setStreams(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,"comps"), snap => setComps(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.dateAdded||0)-new Date(a.dateAdded||0)))),
      onSnapshot(collection(db,"quotes"), snap => setQuotes(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,"buyers"), snap => setBuyers(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(collection(db,"csv_imports"), snap => setCsvImports(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.importedAt||"").localeCompare(a.importedAt||"")))),
      onSnapshot(collection(db,"shipments"), snap => setShipments(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>new Date(b.date||0)-new Date(a.date||0)))),
      onSnapshot(collection(db,"product_usage"), snap => setProductUsage(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(doc(db,"config","skuPrices"), snap => { if(snap.exists()) setSkuPrices(snap.data()); }),
      onSnapshot(collection(db,"sku_price_history"), snap => setSkuPriceHistory(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.date||"").localeCompare(b.date||"")))),
      onSnapshot(collection(db,"card_pools"), snap => setCardPools(snap.docs.map(d=>({id:d.id,...d.data()})))),
      onSnapshot(doc(db,"config","lotTracking"), snap => { if(snap.exists()) setLotTracking(snap.data()); }),
      onSnapshot(doc(db,"config","lotNotes"), snap => { if(snap.exists()) setLotNotes(snap.data()); }),
      onSnapshot(collection(db,"historical_data"), snap => setHistoricalData(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.yearMonth||"").localeCompare(b.yearMonth||"")))),
      onSnapshot(collection(db,"pay_stubs"), snap => setPayStubs(snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt||"").localeCompare(a.createdAt||"")))),
      onSnapshot(doc(db,"config","imcFormUrl"), snap => { if(snap.exists()) setImcFormUrl(snap.data().url||""); }),
    ];
    return () => unsubs.forEach(u => u());
  }, [user]);

  // Keyboard shortcut for global search
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") { e.preventDefault(); setGOpen(p=>!p); }
      if (e.key === "Escape") { setGOpen(false); setGSearch(""); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function showToast(msg) { setToast(msg); setTimeout(()=>setToast(null), 3500); }

  const userRole    = getUserRole(user);
  const effectiveRole = viewAs ? ROLES[viewAs] || userRole : userRole;
  const effectiveUser = viewAs ? { displayName: viewAs, email: viewAs + "@bazooka.com", uid: viewAs } : user;

  // -- HANDLERS ------------------------------------------------

  async function handleAccept(cards, seller, u, custNote) {
    for (const card of cards) {
      await setDoc(doc(db,"inventory",card.id), { ...card, addedBy: u?.displayName||"Unknown", dateAdded: new Date().toISOString(), cardStatus:"in_transit" });
    }
    showToast(`\u2705 ${cards.length} card${cards.length!==1?"s":""} added -- marked In Transit until delivered`);
    setTab("inventory");
  }

  async function handleRemove(id) { await deleteDoc(doc(db,"inventory",id)); }

  async function handleBulkRemove(ids) {
    await Promise.all(ids.map(id => deleteDoc(doc(db,"inventory",id))));
    showToast(`\uD83D\uDDD1 $"}{ids.length} card${ids.length!==1?"s":""} deleted`);
  }

  async function handleSaveCardCost(id, cost) {
    await setDoc(doc(db,"inventory",id), { costPerCard: cost }, { merge:true });
  }

  async function handlePutBack(id) {
    await deleteDoc(doc(db,"breaks", breaks.find(b=>b.inventoryId===id)?.id || "noop"));
  }

  async function handleAddBreak(entry) {
    await setDoc(doc(db,"breaks",entry.id), { ...entry });
    showToast(`\u2705 ${entry.cardName} logged out`);
  }

  async function handleBulkAddBreak(entries) {
    await Promise.all(entries.map(e => setDoc(doc(db,"breaks",e.id), e)));
    showToast(`\u2705 $"}{entries.length} cards logged out`);
  }

  async function handleDeleteBreak(id) { await deleteDoc(doc(db,"breaks",id)); }

  async function handleSaveStream(stream) {
    await setDoc(doc(db,"streams",stream.id), stream, { merge:true });
  }

  async function handleDeleteStream(id) {
    // Restore any chaser cards logged under this stream
    const streamBreaks = breaks.filter(b => b.streamId === id || b.streamId === streams.find(s=>s.id===id)?.breaker_date);
    await Promise.all(streamBreaks.map(b => deleteDoc(doc(db,"breaks",b.id))));
    await deleteDoc(doc(db,"streams",id));
    showToast("\uD83D\uDDD1 Stream deleted");
  }

  async function handleSaveComp(comp) {
    const id = uid();
    await setDoc(doc(db,"comps",id), { ...comp, id, dateAdded:new Date().toISOString(), savedBy:user?.displayName||"Unknown" });
    showToast("\uD83D\uDCBE Comp saved");
  }

  async function handleDeleteComp(id) { await deleteDoc(doc(db,"comps",id)); showToast("\uD83D\uDDD1 Comp deleted"); }

  async function handleSaveQuote(quoteData) {
    const id = uid();
    await setDoc(doc(db,"quotes",id), { ...quoteData, id, status:"pending", createdAt:new Date().toISOString(), viewCount:0, notified:true, history:[] });
    return id;
  }

  async function handleCloseQuote(id) { await setDoc(doc(db,"quotes",id), { status:"closed" }, { merge:true }); }

  async function handleBazookaCounter(quoteId, amount, history) {
    await setDoc(doc(db,"quotes",quoteId), { status:"pending", currentOffer:amount, history:[...history,{type:"bazooka_counter",amount,timestamp:new Date().toISOString()}], notified:false }, { merge:true });
  }

  async function handleDismissQuoteNotif(id) { await setDoc(doc(db,"quotes",id), { notified:true }, { merge:true }); }

  async function handleSaveLotTracking(key, data) {
    const next = { ...lotTracking, [key]: data };
    setLotTracking(next);
    await setDoc(doc(db,"config","lotTracking"), next);
    // Update cardStatus on all inventory cards in this lot
    const lotCards = inventory.filter(c => `${c.seller||"Unknown"}__${c.date||"Unknown"}` === key);
    if (lotCards.length > 0) {
      const newStatus = data.status === "Delivered" ? "available" : "in_transit";
      await Promise.all(lotCards.map(c =>
        setDoc(doc(db,"inventory",c.id), { cardStatus: newStatus }, { merge:true })
      ));
    }
  }

  async function handleSaveLotNotes(key, notes) {
    const next = { ...lotNotes, [key]: { notes } };
    setLotNotes(next);
    await setDoc(doc(db,"config","lotNotes"), next);
  }

  async function handleDeleteLot(key, cardIds) {
    if (!window.confirm(`Delete this entire lot and all ${cardIds.length} cards? Cannot be undone.`)) return;
    await Promise.all(cardIds.map(id => deleteDoc(doc(db,"inventory",id))));
    showToast("\uD83D\uDDD1 Lot deleted");
  }

  async function handleSaveShipment(shipment) { await setDoc(doc(db,"shipments",shipment.id), shipment); }
  async function handleDeleteShipment(id) { await deleteDoc(doc(db,"shipments",id)); }

  async function handleSaveProductUsage(usage) { await setDoc(doc(db,"product_usage",usage.id), usage); }
  async function handleDeleteProductUsage(id) { await deleteDoc(doc(db,"product_usage",id)); }

  async function handleSaveSkuPrices(prices) {
    await setDoc(doc(db,"config","skuPrices"), prices, { merge:true });
    // Save snapshot to price history
    const histId = uid();
    await setDoc(doc(db,"sku_price_history",histId), { id:histId, date:new Date().toISOString().split("T")[0], prices, savedAt:new Date().toISOString() });
    showToast("\uD83D\uDCBE SKU prices saved");
  }

  async function handleSavePool(pool) { await setDoc(doc(db,"card_pools",pool.id||uid()), { ...pool, id:pool.id||uid() }); }
  async function handleDeletePool(id) { await deleteDoc(doc(db,"card_pools",id)); }

  async function handleLogPoolOut(poolId, qty, breaker, date, usage) {
    const pool = cardPools.find(p=>p.id===poolId);
    if (!pool) return;
    const newUsed = (parseInt(pool.usedQty)||0) + qty;
    await setDoc(doc(db,"card_pools",poolId), { usedQty: newUsed }, { merge:true });
    // Log a break entry for tracking
    const breakId = uid();
    await setDoc(doc(db,"breaks",breakId), { id:breakId, date, breaker, inventoryId:poolId, cardName:pool.cardName, cardType:pool.cardType, usage, notes:`Pool log: ${qty} units`, dateAdded:new Date().toISOString(), loggedBy:user?.displayName||"Unknown", isPoolLog:true, qty });
    showToast(`\u2705 Logged ${qty} ${pool.cardName}`);
  }

  async function handleAddToPool(poolId, qty) {
    const pool = cardPools.find(p=>p.id===poolId);
    if (!pool) return;
    await setDoc(doc(db,"card_pools",poolId), { totalQty:(parseInt(pool.totalQty)||0)+qty }, { merge:true });
    showToast(`\u2705 Added ${qty} to ${pool.cardName}`);
  }

  async function handleSaveHistorical(entry) {
    await setDoc(doc(db,"historical_data",entry.id), entry);
    showToast("\uD83D\uDCBE Historical data saved");
  }

  async function handleDeleteHistorical(id) {
    await deleteDoc(doc(db,"historical_data",id));
    showToast("\uD83D\uDDD1 Entry deleted");
  }

  async function handleSavePayStub(stub) {
    const id = uid();
    await setDoc(doc(db,"pay_stubs",id), { ...stub, id, createdAt:new Date().toISOString(), createdBy:user?.displayName||"Admin", read:false });
    showToast(`\uD83D\uDCE4 Pay stub sent to ${stub.breaker}`);
  }

  async function handleDismissPayStub(id) { await setDoc(doc(db,"pay_stubs",id), { read:true }, { merge:true }); }
  async function handleDeletePayStub(id) { await deleteDoc(doc(db,"pay_stubs",id)); showToast("\uD83D\uDDD1 Pay stub deleted"); }

  async function handleSaveImcFormUrl(url) {
    await setDoc(doc(db,"config","imcFormUrl"), { url });
    showToast("\uD83D\uDCBE IMC Form URL saved");
  }

  async function handleUpsertBuyers(buyerList, streamId, filename) {
    // Merge buyers -- accumulate spend and orders
    const existing = [...buyers];
    const updates = {};
    buyerList.forEach(b => {
      const prev = existing.find(x => x.username === b.username);
      updates[b.username] = {
        id: prev?.id || uid(),
        username: b.username,
        fullName: b.fullName || prev?.fullName || "",
        city: b.city || prev?.city || "",
        state: b.state || prev?.state || "",
        zip: b.zip || prev?.zip || "",
        totalSpend: (prev?.totalSpend || 0) + b.spend,
        orderCount: (prev?.orderCount || 0) + b.orders,
        couponCount: (prev?.couponCount || 0) + (b.couponCount||0),
        streams: [...new Set([...(prev?.streams||[]), streamId])],
        firstSeen: prev?.firstSeen || b.date || new Date().toISOString().split("T")[0],
        lastSeen: b.date || new Date().toISOString().split("T")[0],
        isNew: !prev,
        updatedAt: new Date().toISOString(),
      };
    });
    await Promise.all(Object.values(updates).map(b => setDoc(doc(db,"buyers",b.id), b, { merge:true })));
    // Save CSV import record
    const impId = uid();
    await setDoc(doc(db,"csv_imports",impId), { id:impId, streamId, filename, importedAt:new Date().toISOString(), rowCount:buyerList.length });
    showToast(`\u2705 ${buyerList.length} buyers imported`);
  }

  async function handleClearAllBuyers() {
    if (!window.confirm("Delete ALL buyer data and CSV imports? This cannot be undone.")) return;
    await Promise.all(buyers.map(b => deleteDoc(doc(db,"buyers",b.id))));
    await Promise.all(csvImports.map(i => deleteDoc(doc(db,"csv_imports",i.id))));
    showToast("\uD83D\uDDD1 All buyer data cleared");
  }

  async function handleDeleteCsvImport(id) { await deleteDoc(doc(db,"csv_imports",id)); }

  async function handleDeleteImport(id) { await deleteDoc(doc(db,"csv_imports",id)); }

  function handleOnChecklistUpdated() {
    try { localStorage.removeItem(BOBA_CACHE_KEY); } catch(e) {}
    getDocs(collection(db,"boba_checklist")).then(snap => {
      const cards = snap.docs.map(d=>({id:d.id,...d.data()}));
      setBobaCards(cards);
      try { localStorage.setItem(BOBA_CACHE_KEY, JSON.stringify({cards,ts:Date.now()})); } catch(e) {}
    });
  }

  // -- NAV TABS -------------------------------------------------
  const ALL_TABS = [
    { id:"dashboard",  label:"Dashboard",   icon:"\uD83D\uDCCA", roles:["Admin","Streamer","Procurement","Shipping","Viewer"] },
    { id:"comp",       label:"Lot Comp",     icon:"\uD83E\uDDEE", roles:["Admin","Procurement","Streamer","Shipping","Viewer"] },
    { id:"inventory",  label:"Inventory",   icon:"\uD83D\uDCE6", roles:["Admin","Streamer","Procurement","Shipping","Viewer"] },
    { id:"streams",    label:"Streams",      icon:"\uD83C\uDFAF", roles:["Admin","Streamer","Procurement","Shipping"] },
    { id:"buyers",     label:"Buyers",       icon:"\uD83D\uDC65", roles:["Admin","Streamer"] },
    { id:"performance",label:"Performance",  icon:"\uD83D\uDCC8", roles:["Admin","Streamer"] },
    { id:"checklist",  label:"BoBA",         icon:"\uD83C\uDCCF", roles:["Admin","Streamer","Procurement","Shipping","Viewer"] },
    { id:"showcase",   label:"Showcase",     icon:"\u2728", roles:["Admin","Streamer","Procurement","Shipping","Viewer"] },
  ].filter(t => t.roles.includes(effectiveRole?.role));

  // -- PUBLIC ROUTES -- no auth required, check FIRST --
  const quoteMatch = window.location.pathname.match(/^\/quote\/([a-zA-Z0-9]+)$/);
  if (quoteMatch) return <PublicQuote quoteId={quoteMatch[1]} />;

  if (window.location.pathname === "/showcase") {
    const params = new URLSearchParams(window.location.search);
    const uid2 = params.get("uid");
    return <BobaShowcase uid={uid2} />;
  }

  if (window.location.pathname === "/deck")     return <PublicDeckBuilder />;
  if (window.location.pathname === "/playbook") return <PublicPlaybookBuilder />;
  if (window.location.pathname === "/cards")    return <PublicCardDatabase />;

  // Auth gate -- only for the main app
  if (!authReady) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100vh", background:"#111111", fontFamily:"'Trebuchet MS',sans-serif", fontSize:18, fontWeight:700, color:"#E8317A" }}>Loading...</div>;

  if (!user) return <LoginScreen />;

  return (
    <div style={{ background:"#000000", minHeight:"100vh", fontFamily:"'Trebuchet MS','Segoe UI',sans-serif", color:"#F0F0F0", overflowX:"hidden" }}>
      <GlobalStyles />

      {/* Global search overlay */}
      {gOpen && (() => {
        const usedIds = new Set(breaks.map(b=>b.inventoryId));
        const q = gSearch.toLowerCase().trim();
        const results = q.length < 2 ? [] : inventory.filter(c => {
          return (
            c.cardName?.toLowerCase().includes(q) ||
            c.seller?.toLowerCase().includes(q) ||
            c.cardType?.toLowerCase().includes(q) ||
            c.source?.toLowerCase().includes(q) ||
            (usedIds.has(c.id) ? "used" : c.cardStatus==="in_transit" ? "in transit" : "available").includes(q)
          );
        });
        const getStatus = c => usedIds.has(c.id) ? { l:"Used", bg:"#FEE2E2", c:"#991b1b" } : c.cardStatus==="in_transit" ? { l:"In Transit", bg:"#EEF0FB", c:"#7B9CFF" } : { l:"Available", bg:"#0a1a0a", c:"#4ade80" };
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"flex-start", paddingTop:80 }}
            onClick={()=>{ setGOpen(false); setGSearch(""); }}>
            <div style={{ background:"#111111", borderRadius:14, width:"100%", maxWidth:620, boxShadow:"0 24px 80px rgba(0,0,0,0.8)", border:"1.5px solid #2a2a2a", overflow:"hidden" }}
              onClick={e=>e.stopPropagation()}>
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", borderBottom:"1px solid #1a1a1a" }}>
                <span style={{ fontSize:20 }}>{"\uD83D\uDD0D"}</span>
                <input autoFocus value={gSearch} onChange={e=>setGSearch(e.target.value)} placeholder="Search inventory by name, seller, type, status..." style={{ flex:1, background:"transparent", border:"none", color:"#F0F0F0", fontSize:15, fontFamily:"inherit", outline:"none" }}/>
                <span style={{ fontSize:11, color:"#444" }}>ESC to close</span>
              </div>
              <div style={{ maxHeight:400, overflowY:"auto" }}>
                {q.length < 2 ? <div style={{ padding:"24px", textAlign:"center", color:"#555", fontSize:12 }}>Type at least 2 characters to search</div> :
                  results.length === 0 ? <div style={{ padding:"24px", textAlign:"center", color:"#555", fontSize:12 }}>No matches for "{gSearch}"</div> :
                  results.slice(0,20).map((c,i) => {
                    const st = getStatus(c);
                    const cc = CC[c.cardType]||{bg:"#F3F4F6",text:"#6B7280"};
                    return (
                      <div key={c.id} onClick={()=>{ setTab("inventory"); setGOpen(false); setGSearch(""); }} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 16px", borderBottom:"1px solid #111", cursor:"pointer", background:i%2===0?"#111":"#0d0d0d" }} className="inv-row">
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"#F0F0F0" }}>{c.cardName}</div>
                          <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{c.seller||"--"} &middot; {c.source||"--"} &middot; {c.date||"--"}</div>
                        </div>
                        <span style={{ background:cc.bg, color:cc.text, fontSize:10, fontWeight:700, borderRadius:5, padding:"2px 7px" }}>{c.cardType}</span>
                        <span style={{ background:st.bg, color:st.c, fontSize:10, fontWeight:700, borderRadius:5, padding:"2px 7px" }}>{st.l}</span>
                      </div>
                    );
                  })
                }
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div className="toast" style={{ position:"fixed", bottom:24, right:24, background:"#111111", border:"1.5px solid #4ade80", borderRadius:12, padding:"12px 20px", fontSize:13, fontWeight:700, color:"#4ade80", zIndex:999, boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}

      {/* Active scan indicator (when scanning from non-BoBA tab) */}
      {activeScan && activeScan.type === "images" && (
        <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:"#0a1a0a",border:"1.5px solid #4ade8044",borderRadius:12,padding:"16px 20px",minWidth:300,boxShadow:"0 8px 40px rgba(0,0,0,0.8)",fontFamily:"'Trebuchet MS',sans-serif"}}>
          <div style={{fontWeight:700,color:"#4ade80",fontSize:13,marginBottom:10}}>{"\uD83D\uDDBC"} {activeScan.type==="images"?"Importing Images...":"Scan active"}</div>
          {activeScan.total > 0 && (
            <div style={{height:6,background:"#1a1a1a",borderRadius:3,overflow:"hidden",marginBottom:8}}>
              <div style={{width:`${Math.round(activeScan.current/activeScan.total*100)}%`,height:"100%",background:"linear-gradient(90deg,#4ade80,#7B9CFF)",borderRadius:3,transition:"width 0.3s"}}/>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
            <span style={{color:"#888",flex:1,marginRight:8}}>{activeScan.status}</span>
            {activeScan.total > 0 && <span style={{color:"#4ade80",fontWeight:700,flexShrink:0}}>{activeScan.current}/{activeScan.total}</span>}
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{position:"sticky",top:0,zIndex:100}}>
        <style>{`
          @keyframes dashGradient{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
          @keyframes dashOrb{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-10px) scale(1.05)}}
          .dash-tab:hover{background:rgba(232,49,122,0.12)!important;color:rgba(255,255,255,0.9)!important;border-color:rgba(232,49,122,0.4)!important;transform:translateY(-1px)}
        `}</style>

        {/* Gradient header */}
        <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(135deg,#0d0005,#0a000d,#050015,#000d1a)",backgroundSize:"400% 400%",animation:"dashGradient 12s ease infinite",borderBottom:"1px solid rgba(232,49,122,0.15)"}}>
          {/* Glow orbs */}
          <div style={{position:"absolute",top:-80,left:"15%",width:350,height:350,borderRadius:"50%",background:"radial-gradient(circle,rgba(232,49,122,0.12) 0%,transparent 70%)",animation:"dashOrb 8s ease-in-out infinite",pointerEvents:"none"}}/>
          <div style={{position:"absolute",top:-60,right:"10%",width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,rgba(123,47,247,0.1) 0%,transparent 70%)",animation:"dashOrb 11s ease-in-out infinite reverse",pointerEvents:"none"}}/>

          <div style={{maxWidth:1500,margin:"0 auto",padding:"20px 20px 0",position:"relative"}}>
            {/* Top row: brand + controls */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                <div style={{width:32,height:32,borderRadius:"50%",border:"1.5px solid rgba(232,49,122,0.5)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px rgba(232,49,122,0.3)",flexShrink:0}}>
                  <div style={{width:9,height:9,borderRadius:"50%",background:"linear-gradient(135deg,#E8317A,#7B2FF7)"}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,color:"rgba(232,49,122,0.7)",letterSpacing:4,textTransform:"uppercase"}}>Bazooka Breaks</div>
                  <div style={{fontSize:20,fontWeight:900,background:"linear-gradient(135deg,#E8317A,#7B2FF7,#7B9CFF)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:-0.5,lineHeight:1}}>Dashboard</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <button onClick={()=>setGOpen(p=>!p)}
                  style={{display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:10,padding:"7px 14px",fontSize:12,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontFamily:"inherit",backdropFilter:"blur(10px)"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(232,49,122,0.5)";e.currentTarget.style.color="#E8317A"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.1)";e.currentTarget.style.color="rgba(255,255,255,0.5)"}}>
                  <span style={{fontSize:13}}>{"\uD83D\uDD0D"}</span>
                  <span className="mobile-hide">Search</span>
                  <kbd style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:4,padding:"1px 6px",fontSize:10,color:"rgba(255,255,255,0.25)",fontFamily:"inherit"}} className="mobile-hide">K</kbd>
                </button>
                <span style={{fontSize:11,color:"rgba(255,255,255,0.2)"}} className="mobile-hide">{inventory.length} cards</span>
                {userRole.role === "Admin" && (
                  <select value={viewAs} onChange={e=>setViewAs(e.target.value)} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:8,color:"rgba(255,255,255,0.4)",fontSize:11,padding:"5px 8px",fontFamily:"inherit",cursor:"pointer"}}>
                    <option value="">-- Real Role --</option>
                    {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v.label} ({k})</option>)}
                  </select>
                )}
                <div style={{display:"flex",alignItems:"center",gap:8}} className="mobile-hide">
                  <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,0.8)"}}>{user?.displayName?.split(" ")[0]}</span>
                  <span style={{background:effectiveRole.bg||"rgba(255,255,255,0.06)",color:effectiveRole.color,border:`1px solid ${effectiveRole.color}44`,borderRadius:20,padding:"2px 10px",fontSize:10,fontWeight:700,backdropFilter:"blur(10px)"}}>{effectiveRole.label}</span>
                </div>
                <button onClick={()=>signOut(auth)}
                  style={{background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,color:"rgba(255,255,255,0.3)",fontSize:11,padding:"6px 14px",cursor:"pointer",fontFamily:"inherit"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(232,49,122,0.5)";e.currentTarget.style.color="#E8317A"}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";e.currentTarget.style.color="rgba(255,255,255,0.3)"}}>Sign out</button>
              </div>
            </div>

            {/* Tab bar - pill style like /cards */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",paddingBottom:16,overflowX:"auto",scrollbarWidth:"none"}}>
              {ALL_TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} className="dash-tab"
                  style={{background:tab===t.id?"rgba(232,49,122,0.15)":"transparent",color:tab===t.id?"#E8317A":"rgba(255,255,255,0.45)",border:`1.5px solid ${tab===t.id?"#E8317A":"rgba(255,255,255,0.1)"}`,borderRadius:20,padding:"7px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",backdropFilter:"blur(10px)",transition:"all 0.15s ease",boxShadow:tab===t.id?"0 0 20px rgba(232,49,122,0.2)":"none"}}>
                  <span className="nav-tab-icon" style={{display:"none"}}>{t.icon}</span>
                  <span className="nav-tab-label">{t.icon} {t.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Tab content */}
      <div className="tab-content" style={{ padding:"16px", maxWidth:1500, margin:"0 auto" }}>
        {tab==="dashboard"  && <Dashboard   inventory={inventory} breaks={breaks} user={effectiveUser} userRole={effectiveRole} streams={streams} historicalData={historicalData} onSaveHistorical={handleSaveHistorical} onDeleteHistorical={handleDeleteHistorical} payStubs={payStubs} onDismissPayStub={handleDismissPayStub} quotes={quotes} onDismissQuoteNotif={handleDismissQuoteNotif}/>}
        {tab==="comp"       && (CAN_VIEW_LOT_COMP.includes(effectiveRole.role) ? <LotComp onAccept={handleAccept} onSaveComp={handleSaveComp} onDeleteComp={handleDeleteComp} comps={comps} user={effectiveUser} userRole={effectiveRole} onSaveQuote={handleSaveQuote} quotes={quotes} onCloseQuote={handleCloseQuote} onBazookaCounter={handleBazookaCounter} cardPools={cardPools} onDismissQuoteNotif={handleDismissQuoteNotif} bobaCards={bobaCards}/> : <AccessDenied msg="Lot Comp is for Admin and Procurement only." />)}
        {tab==="inventory"  && <Inventory   inventory={inventory} breaks={breaks} onRemove={handleRemove} onBulkRemove={handleBulkRemove} onSaveCardCost={handleSaveCardCost} onPutBack={handlePutBack} user={effectiveUser} userRole={effectiveRole} lotTracking={lotTracking} onSaveLotTracking={handleSaveLotTracking} lotNotes={lotNotes} onSaveLotNotes={handleSaveLotNotes} onDeleteLot={handleDeleteLot} shipments={shipments} productUsage={productUsage} onSaveShipment={handleSaveShipment} onDeleteShipment={handleDeleteShipment} skuPrices={skuPrices} onSaveSkuPrices={handleSaveSkuPrices} skuPriceHistory={skuPriceHistory} onDeleteProductUsage={handleDeleteProductUsage} cardPools={cardPools} onSavePool={handleSavePool} onDeletePool={handleDeletePool} onLogPoolOut={handleLogPoolOut} onAddToPool={handleAddToPool} onAdd={handleAddBreak} streams={streams} bobaCards={bobaCards}/>}
        {tab==="streams"    && <Streams     inventory={inventory} breaks={breaks} onAdd={handleAddBreak} onBulkAdd={handleBulkAddBreak} onDeleteBreak={handleDeleteBreak} user={effectiveUser} userRole={effectiveRole} streams={streams} onSaveStream={handleSaveStream} onDeleteStream={handleDeleteStream} productUsage={productUsage} onSaveProductUsage={handleSaveProductUsage} shipments={shipments} skuPrices={skuPrices} historicalData={historicalData} onSavePayStub={handleSavePayStub} onUpsertBuyers={handleUpsertBuyers} payStubs={payStubs} onDeletePayStub={handleDeletePayStub} cardPools={cardPools} imcFormUrl={imcFormUrl} onSaveImcFormUrl={handleSaveImcFormUrl}/>}
        {tab==="buyers"     && <BuyersCRM   buyers={buyers} csvImports={csvImports} onDeleteImport={handleDeleteCsvImport} onClearAll={handleClearAllBuyers} userRole={effectiveRole} streams={streams}/>}
        {tab==="performance"&& <Performance breaks={breaks} user={effectiveUser} userRole={effectiveRole} streams={streams}/>}
        {tab==="checklist"  && <BobaChecklist userRole={effectiveRole} user={effectiveUser} onScanUpdate={setActiveScan} onChecklistUpdated={handleOnChecklistUpdated}/>}
        {tab==="showcase"   && <BobaShowcase uid={effectiveUser?.uid} />}
      </div>
    </div>
  );
}