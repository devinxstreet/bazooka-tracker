21:00:49.299 Running build in Washington, D.C., USA (East) – iad1 (Turbo Build Machine)
21:00:49.300 Build machine configuration: 30 cores, 60 GB
21:00:49.384 Cloning github.com/devinxstreet/bazooka-tracker (Branch: main, Commit: a84d8fc)
21:00:50.013 Cloning completed: 629.000ms
21:00:51.241 Restored build cache from previous deployment (HMTEMHpuhgUDuXta8vGARNAKB7by)
21:00:51.432 Running "vercel build"
21:00:51.445 Vercel CLI 54.12.2
21:00:52.020 Installing dependencies...
21:00:53.781 
21:00:53.781 up to date in 2s
21:00:53.782 
21:00:53.782 267 packages are looking for funding
21:00:53.782   run `npm fund` for details
21:00:53.782 npm notice
21:00:53.783 npm notice New minor version of npm available! 11.12.1 -> 11.17.0
21:00:53.783 npm notice Changelog: https://github.com/npm/cli/releases/tag/v11.17.0
21:00:53.783 npm notice To update run: npm install -g npm@11.17.0
21:00:53.783 npm notice
21:00:53.897 
21:00:53.897 > bazooka-tracker@1.0.0 build
21:00:53.897 > react-scripts build
21:00:53.897 
21:00:54.786 (node:167) [DEP0176] DeprecationWarning: fs.F_OK is deprecated, use fs.constants.F_OK instead
21:00:54.786 (Use `node --trace-deprecation ...` to show where the warning was created)
21:00:54.788 Creating an optimized production build...
21:01:24.227 Failed to compile.
21:01:24.227 
21:01:24.235 Error: Parse Error: < 7*24*60*60*1000) {
21:01:24.236           LOADING_CARD_IMAGES.urls = urls;
21:01:24.236           LOADING_CARD_IMAGES.loaded = true;
21:01:24.236           return;
21:01:24.236         }
21:01:24.236       }
21:01:24.236       const snap = await getDocs(query(collection(db,"boba_checklist"), where("h  ero","==","BoJax")));
21:01:24.236       const urls = snap.docs.map(d=>d.data().imageUrl).filter(Boolean).slice(0,6  0);
21:01:24.236       if (urls.length > 0) {
21:01:24.236         LOADING_CARD_IMAGES.urls = urls;
21:01:24.236         LOADING_CARD_IMAGES.loaded = true;
21:01:24.236         localStorage.setItem(CACHE_KEY, JSON.stringify({ urls, ts: Date.now() })  );
21:01:24.236       }
21:01:24.236     } catch(e) {}
21:01:24.236   })();
21:01:24.236   
21:01:24.236   const CARD_TYPES = ["Giveaway Cards","Insurance Cards","First-Timer Cards","Ch  aser Cards"];
21:01:24.236   
21:01:24.236   const POOL_TYPES  = ["Giveaway Cards","Insurance Cards"]; // bulk pools
21:01:24.236   const INDIV_TYPES = ["First-Timer Cards","Chaser Cards"];  // individual track  ing
21:01:24.236   const BREAKERS = ["Dev","Dre","Krystal","BigU"];
21:01:24.236   const LOCATIONS = ["BZKA HQ","BIGU HQ"];
21:01:24.237   const WOTF_SETS = ["Dragon Box","Collector Booster","Play Booster","Wonders of   The First"];
21:01:24.237   const BOBA_SETS = ["Alpha Edition","Alpha Update","Griffey 2026","Tecmo Bowl"]  ;
21:01:24.237   
21:01:24.237   // ── SINGLE CANONICAL STREAM CALC ───────────────────────────────────────────  ──
21:01:24.237   function calcStream(s, targetBreaker=null) {
21:01:24.237     const gross        = parseFloat(s.grossRevenue)||0;
21:01:24.237     const fees         = parseFloat(s.whatnotFees)||0;
21:01:24.237     const coupons      = parseFloat(s.coupons)||0;
21:01:24.237     const isSingles     = !!(s.isSinglesShow);
21:01:24.237     const streamExp    = (parseFloat(s.whatnotPromo)||0)+(parseFloat(s.magpros)|  |0)+(parseFloat(s.packagingMaterial)||0)+(parseFloat(s.topLoaders)||0)+(parseF  loat(s.chaserCards)||0);
21:01:24.237     const splitBase    = gross - fees - coupons;
21:01:24.237     const externalCh   = !!s.externalChannel;
21:01:24.237   
21:01:24.238     // Singles Show: 100% of net goes to breaker, no 70/30 split
21:01:24.238     const bazNet       = isSingles ? 0 : splitBase * 0.30;
21:01:24.238     const imcNet       = isSingles ? 0 : externalCh ? 0 : splitBase * 0.70;
21:01:24.238     const collabAmt    = 0;
21:01:24.238     const bazOwnShare  = isSingles ? 0 : bazNet;
21:01:24.238     const isBigU        = (s.breaker||"").toLowerCase() === "bigu";
21:01:24.238     // BigU pays his own mags/packaging/topLoaders and gets reimbursed separatel  y —
21:01:24.238     // don't deduct those from his commission. Still report to IMC for 70% reimb  ursement.
21:01:24.238     const repExpBase    = isBigU
21:01:24.238       ? (parseFloat(s.whatnotPromo)||0) + (parseFloat(s.chaserCards)||0)
21:01:24.238       : streamExp;
21:01:24.238     const rate         = isSingles ? 1 : getRate(s);
21:01:24.238     const commAmt      = isSingles ? splitBase : bazOwnShare * rate;
21:01:24.238     const repExpShare  = isSingles ? 0 : repExpBase * (rate * 0.30);
21:01:24.238     const bazExpShare  = isSingles ? 0 : streamExp * ((1-rate) * 0.30);
21:01:24.238     const tips         = parseFloat(s.tips)||0;
21:01:24.238     const salesBonus   = parseFloat(s.salesBonus)||0;
21:01:24.238     const eventStaffAmt = 0;
21:01:24.239     const imcReimb      = isSingles ? 0 : externalCh ? 0 : streamExp * 0.70;
21:01:24.239     const imcDirectReimb = parseFloat(s.imcReimbursement)||0;
21:01:24.239     const splitPct      = s.splitRep ? parseFloat(s.splitPct||50)/100 : 1;
21:01:24.239     const primaryCommAmt = isSingles ? splitBase : (s.splitRep ? commAmt*splitPc  t : commAmt);
21:01:24.239     const splitRepAmt    = s.splitRep ? commAmt*(1-splitPct) : 0;
21:01:24.239     const biguCardCosts = isBigU ? (parseFloat(s.biguGiveawayCards)||0)+(parseFl  oat(s.biguInsuranceCards)||0) : 0;
21:01:24.239     const bazTrueNet    = isSingles ? 0 : bazOwnShare - commAmt - eventStaffAmt   + repExpShare - bazExpShare + imcReimb + imcDirectReimb - biguCardCosts;
21:01:24.239     let myComm = isSingles ? splitBase + tips : primaryCommAmt - repExpShare * s  plitPct + salesBonus + tips;
21:01:24.239     if (targetBreaker) {
21:01:24.239       const myStaff    = (s.eventStaff||[]).find(es=>es.breaker===targetBreaker)  ;
21:01:24.239       const isEventOnly = !!myStaff && s.breaker !== targetBreaker;
21:01:24.239       const isSplitRep  = s.splitRep === targetBreaker;
21:01:24.239       myComm = isEventOnly ? Math.min(1000, bazOwnShare*0.15)
21:01:24.239              : isSplitRep  ? splitRepAmt - repExpShare * (1-splitPct)
21:01:24.239              : primaryCommAmt - repExpShare * splitPct + salesBonus + tips;
21:01:24.240     }
21:01:24.240     const biguReimb = isBigU
21:01:24.240       ? (parseFloat(s.magpros)||0)+(parseFloat(s.packagingMaterial)||0)+(parseFl  oat(s.topLoaders)||0)+(parseFloat(s.biguGiveawayCards)||0)+(parseFloat(s.biguI  nsuranceCards)||0)
21:01:24.240       : 0;
21:01:24.240   
21:01:24.240     return { gross, fees, coupons, streamExp, splitBase, netRev:splitBase, bazNe  t, bazOwnShare, imcNet, rate, commAmt, repExpShare, bazExpShare, tips, salesBo  nus, collabAmt, eventStaffAmt:0, imcReimb, imcDirectReimb, splitPct, primaryCo  mmAmt, splitRepAmt, splitRep:s.splitRep||"", bazTrueNet, myComm, totalExp:fees  +coupons+streamExp, commBase:bazNet, externalChannel:externalCh, isSingles, is  BigU, biguReimb };
21:01:24.240   }
21:01:24.240   function getStreamBrand(s) {
21:01:24.240     const prods = s.streamSkuPrices ? Object.keys(s.streamSkuPrices) : [];
21:01:24.240     const name = (s.streamName||"").toLowerCase();
21:01:24.240     const hasWotF = prods.some(p=>WOTF_SETS.some(w=>p.toLowerCase().includes(w.t  oLowerCase()))) ||
21:01:24.240                     WOTF_SETS.some(w=>name.includes(w.toLowerCase())) ||
21:01:24.240                     name.includes("wonders") || name.includes("wotf") || name.in  cludes("dragon box");
21:01:24.240     if (hasWotF) return "wotf";
21:01:24.240     return "boba";
21:01:24.240   }
21:01:24.240   const OFFICE_STAFF = [
21:01:24.241     { id:"devin",   name:"Devin",   color:"#E8317A", role:"CEO" },
21:01:24.241     { id:"dre",     name:"Dre",     color:"#C084FC", role:"Streamer" },
21:01:24.241     { id:"krystal", name:"Krystal", color:"#2DD4BF", role:"Streamer" },
21:01:24.241     { id:"jake",    name:"Jake",    color:"#FBBF24", role:"Shipping" },
21:01:24.241     { id:"cameron", name:"Cameron", color:"#F97316", role:"Shipping" },
21:01:24.241   ];
21:01:24.241   const CHANNELS = ["Bazooka Vault", "Bazooka Breaks", "Orbital Society"];
21:01:24.241   const FLAT_RATE_CHANNELS = []; // no flat-rate channels currently
21:01:24.241   const FLAT_RATE_BREAKERS = []; // all breakers use standard tiered commission
21:01:24.241   
21:01:24.241   function getRate(s) {
21:01:24.241     if (s.commissionOverride !== "" && s.commissionOverride != null) return pars  eFloat(s.commissionOverride)/100;
21:01:24.241     if (s.isEvent) return 0.15;
21:01:24.241     const newBuyerBonus = (parseInt(s.newBuyers)||0) >= 5 ? 0.05 : 0;
21:01:24.241     const isFlat = (s.channel && FLAT_RATE_CHANNELS.includes(s.channel)) || (!s.  channel && FLAT_RATE_BREAKERS.includes(s.breaker));
21:01:24.241     if (isFlat) return Math.min(0.55, 0.50 + newBuyerBonus);
21:01:24.241     if (s.binOnly) return 0.35;
21:01:24.241     const mm = parseFloat(s.marketMultiple)||0;
21:01:24.242     const base = mm>=1.8?0.55:mm>=1.7?0.50:mm>=1.6?0.45:mm>=1.5?0.40:0.35;
21:01:24.242     return Math.min(0.60, base + newBuyerBonus);
21:01:24.242   }
21:01:24.242   const PRODUCT_SETS = {
21:01:24.242     "Alpha Edition":        ["Blaster","Booster","Hobby","Jumbo"],
21:01:24.242     "Alpha Update":         ["Blaster","Booster","Hobby","Jumbo"],
21:01:24.242     "Alpha Blast":          ["Blast Box"],
21:01:24.242     "Griffey 2026":         ["Blaster","Double Mega","Hobby","Jumbo"],
21:01:24.242     "Tecmo Bowl":           ["Double Mega","Hobby"],
21:01:24.242     "Wonders of The First": ["Dragon Box","Collector Booster","Play Booster"],
21:01:24.242   };
21:01:24.243   const PRODUCT_TYPES = [
21:01:24.243     ...Object.entries(PRODUCT_SETS).flatMap(([set,types])=>types.map(t=>`${set}   - ${t}`)),
21:01:24.243     "Miscellaneous",
21:01:24.243   ];
21:01:24.243   const USAGE_TYPES = ["Giveaway","Insurance","First-Timer Pack","Chaser Pull"];  const SOURCES = ["Discord","Facebook","Other"];
21:01:24.243   const PAYMENT_METHODS = ["PayPal","Zelle"];
21:01:24.243   const ROLES = {
21:01:24.243     "devin":   { role:"Admin",         label:"CEO",                color:"#E8317  A", bg:"#FFF0F5" },
21:01:24.243     "derrik":  { role:"Admin",         label:"CFO",                color:"#E8317  A", bg:"#FFF0F5" },
21:01:24.243     "dre":     { role:"Streamer",      label:"Streamer",           color:"#E8317  A", bg:"#F3EAF9" },
21:01:24.243     "krystal": { role:"Streamer",      label:"Streamer",           color:"#0D6E6  E", bg:"#E0F7F4" },
21:01:24.243     "bigu":    { role:"Streamer",      label:"Streamer",           color:"#F9731  6", bg:"#FFF3E8" },
21:01:24.243     "alison":  { role:"Streamer",      label:"Streamer",           color:"#F9731  6", bg:"#FFF3E8" },
21:01:24.243     "orbitalsociety": { role:"Streamer", label:"Orbital Society", color:"#34d399  ", bg:"#ECFDF5" },
21:01:24.243     "john":    { role:"Procurement",   label:"Procurement Mgr",    color:"#F0F0F  0", bg:"#E8F0FB" },
21:01:24.243     "jake":    { role:"Shipping",      label:"Shipping/Logistics", color:"#AAAAA  A", bg:"#FFF0CC" },
21:01:24.243     "cameron": { role:"Shipping",      label:"Shipping/Logistics", color:"#AAAAA  A", bg:"#FFF0CC" },
21:01:24.243   };
21:01:24.243   const TARGETS = {
21:01:24.243     "Giveaway Cards":   { monthly:2000, buffer:300 },
21:01:24.243     "Insurance Cards":  { monthly:2000, buffer:300 },
21:01:24.243     "First-Timer Cards":{ monthly:200,  buffer:50  },
21:01:24.243     "Chaser Cards":     { monthly:150,  buffer:30  },
21:01:24.243   };
21:01:24.243   const CC = {
21:01:24.243     "Giveaway Cards":   { bg:"#0a1a0f", text:"#4ade80",  border:"#2E7D52" },
21:01:24.243     "Insurance Cards":  { bg:"#0a0f1a", text:"#7B9CFF",  border:"#3730a3" },
21:01:24.243     "First-Timer Cards":{ bg:"#1a0810", text:"#F472B6",  border:"#9d174d" },
21:01:24.243     "Chaser Cards":     { bg:"#2a1520", text:"#E8317A",  border:"#E8317A" },
21:01:24.243   };
21:01:24.243   const BC = {
21:01:24.243     Dev:     { bg:"#0a0a1a", text:"#7B9CFF", border:"#3730a3" },
21:01:24.243     Dre:     { bg:"#12081a", text:"#C084FC", border:"#6b21a8" },
21:01:24.243     Krystal: { bg:"#08181a", text:"#2DD4BF", border:"#115e59" },
21:01:24.243     BigU:    { bg:"#1a0e00", text:"#FB923C", border:"#9a3412" },
21:01:24.243     "Orbital Society": { bg:"#0a1a10", text:"#34d399", border:"#065f46" },
21:01:24.243   };
21:01:24.243   const CAN_DELETE        = ["Admin"];
21:01:24.243   const CAN_LOG_BREAKS    = ["Admin","Streamer","Procurement","Shipping"];
21:01:24.243   const CAN_VIEW_LOT_COMP = ["Admin","Procurement","Streamer","Shipping","Viewer  "];
21:01:24.243   
21:01:24.244   function useWindowWidth() {
21:01:24.244     const [w, setW] = useState(window.innerWidth);
21:01:24.244     useEffect(()=>{ const h=()=>setW(window.innerWidth); window.addEventListener  ("resize",h); return()=>window.removeEventListener("resize",h); },[]);
21:01:24.244     return w;
21:01:24.244   }
21:01:24.244   
21:01:24.244   function uid() { return Date.now().toString(36) + Math.random().toString(36).s  lice(2); }
21:01:24.244   const fmt = n => isNaN(n) || n === "" || n === null ? "--" : "$" + parseFloat(  n).toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2   });
21:01:24.244   
21:01:24.244   // -- useCountUp hook -- animates numbers from 0 to target ----------
21:01:24.244   function useCountUp(target, duration=600) {
21:01:24.244     const [val, setVal] = useState(0);
21:01:24.244     useEffect(() => {
21:01:24.244       if (!target || isNaN(target)) { setVal(target); return; }
21:01:24.244       const start = Date.now();
21:01:24.244       const from = 0;
21:01:24.244       const to = parseFloat(target);
21:01:24.244       function tick() {
21:01:24.244         const elapsed = Date.now() - start;
21:01:24.244         const progress = Math.min(elapsed / duration, 1);
21:01:24.244         const eased = 1 - Math.pow(1 - progress, 3); // ease out cubic
21:01:24.244         setVal(from + (to - from) * eased);
21:01:24.244         if (progress < 1) requestAnimationFrame(tick);
21:01:24.244       }
21:01:24.244       requestAnimationFrame(tick);
21:01:24.244     }, [target]);
21:01:24.244     return val;
21:01:24.244   }
21:01:24.244   
21:01:24.244   function AnimatedNumber({ value, format="dollar", duration=700 }) {
21:01:24.244     const num = useCountUp(parseFloat(value)||0, duration);
21:01:24.244     if (format === "dollar") return <>{fmt(num)}</>;
21:01:24.244     return <>{Math.round(num).toLocaleString()}</>;
21:01:24.244   }
21:01:24.244   
21:01:24.244   function getUserRole(user) {
21:01:24.244     if (!user) return null;
21:01:24.244     const email = (user.email||"").toLowerCase();
21:01:24.244     // Only allow @bazookabreaks.com emails
21:01:24.244     if (!email.endsWith("@bazookabreaks.com")) return null;
21:01:24.244     const name = (user.displayName||"").toLowerCase();
21:01:24.244     for (const [key, val] of Object.entries(ROLES)) {
21:01:24.244       if (name.includes(key) || email.includes(key)) return val;
21:01:24.244     }
21:01:24.244     return { role:"Viewer", label:"Viewer", color:"#AAAAAA", bg:"#F3F4F6" };
21:01:24.244   }
21:01:24.244   function getZone(pct) {
21:01:24.244     if (!pct || isNaN(pct)) return null;
21:01:24.244     if (pct < 0.65)  return { label:"\uD83D\uDFE2 Green",  color:"#E8317A", bg:"  #D6F4E3" };
21:01:24.245     if (pct <= 0.70) return { label:"\uD83D\uDFE1 Yellow", color:"#AAAAAA", bg:"  #FFF9DB" };
21:01:24.245     return                   { label:"\uD83D\uDD34 Red",    color:"#E8317A", bg:  "#FEE2E2" };
21:01:24.245   }
21:01:24.245   
21:01:24.245   const DARK_T = {
21:01:24.245     pageBg:"#000000", card:"#111111", cardBorder:"#2a2a2a",
21:01:24.245     inp:"#1a1a1a", inpBorder:"#333333", text:"#F0F0F0",
21:01:24.245     textSub:"#999999", textMute:"#777777",
21:01:24.245     rowA:"#111111", rowB:"#0d0d0d", rowHover:"#1a1a1a",
21:01:24.245     border:"#2a2a2a", thBg:"#000000", tdBorder:"rgba(255,255,255,0.04)",
21:01:24.245   };
21:01:24.245   const LIGHT_T = {
21:01:24.245     pageBg:"#F7F4F8", card:"#FFFFFF", cardBorder:"#EDE0EC",
21:01:24.245     inp:"#FDFCFE", inpBorder:"#E8D0DC", text:"#111827",
21:01:24.245     textSub:"#6B7280", textMute:"#9CA3AF",
21:01:24.245     rowA:"#FFFFFF", rowB:"#FFF8FB", rowHover:"#FFF0F5",
21:01:24.245     border:"#E5E7EB", thBg:"#1A1A2E", tdBorder:"#FFF0F5",
21:01:24.245   };
21:01:24.245   
21:01:24.245   function makeS(dark) {
21:01:24.245     const T = dark ? DARK_T : LIGHT_T;
21:01:24.245     return {
21:01:24.245       card: { background:T.card, border:`1px solid ${T.cardBorder}`, borderRadiu  s:14, padding:"18px 20px" },
21:01:24.245       inp:  { background:T.inp, border:`1px solid ${T.inpBorder}`, borderRadius:  8, padding:"8px 12px", color:T.text, fontSize:13, fontFamily:"inherit", outlin  e:"none", width:"100%", boxSizing:"border-box", transition:"border-color 0.15s   ease" },
21:01:24.245       lbl:  { fontSize:9, fontWeight:700, color:"#666", textTransform:"uppercase  ", letterSpacing:"1.2px", display:"block", marginBottom:5 },
21:01:24.245       th:   { padding:"8px 12px", background:"#0a0a0a", color:"#E8317A", fontSiz  e:9, fontWeight:700, textTransform:"uppercase", letterSpacing:"1px", textAlign  :"left", whiteSpace:"nowrap", borderBottom:"1px solid rgba(232,49,122,0.12)" }  ,
21:01:24.245       td:   { padding:"9px 12px", borderBottom:`1px solid ${T.tdBorder}`, fontSi  ze:13, color:T.text },
21:01:24.245       T,
21:01:24.245     };
21:01:24.245   }
21:01:24.245   
21:01:24.245   // Default S = dark (components that don't receive darkMode prop use this)
21:01:24.245   const S = makeS(true);
21:01:24.245   
21:01:24.246   function SectionLabel({ t }) {
21:01:24.246     return (
21:01:24.246       <div style={{ fontSize:9, fontWeight:800, color:"#E8317A", textTransform:"  uppercase", letterSpacing:"2px", marginBottom:14, display:"flex", alignItems:"  center", gap:8 }}>
21:01:24.246         {t}
21:01:24.246         <div style={{ flex:1, height:"1px", background:"linear-gradient(90deg,rg  ba(232,49,122,0.3),transparent)" }}/>
21:01:24.246       </div>
21:01:24.246     );
21:01:24.246   }
21:01:24.246   function Badge({ children, bg="#F3F4F6", color="#374151" }) {
21:01:24.246     return <span style={{ background:bg, color, borderRadius:5, padding:"2px 8px  ", fontSize:11, fontWeight:700, whiteSpace:"nowrap", letterSpacing:"0.2px" }}>  {children}</span>;
21:01:24.246   }
21:01:24.246   function ZoneBadge({ pct }) {
21:01:24.246     const z = getZone(pct);
21:01:24.246     if (!z) return <span style={{ color:"#444", fontSize:11 }}>—</span>;
21:01:24.246     const cls = pct >= 0.70 ? "zone-red" : pct >= 0.65 ? "zone-yellow" : "";
21:01:24.246     return <span className={cls} style={{ background:z.bg, color:z.color, border  :`1px solid ${z.color}33`, borderRadius:5, padding:"2px 8px", fontSize:11, fon  tWeight:700, whiteSpace:"nowrap", display:"inline-block" }}>{z.label} · {(pct*  100).toFixed(1)}%</span>;
21:01:24.246   }
21:01:24.246   function Btn({ children, onClick, variant="gold", disabled, style:extra }) {
21:01:24.246     const V = {
21:01:24.246       gold:  { bg:"#E8317A", c:"#fff", hover:"#c41e5a" },
21:01:24.246       green: { bg:"rgba(74,222,128,0.15)", c:"#4ade80", hover:"rgba(74,222,128,0  .25)" },
21:01:24.246       ghost: { bg:"rgba(255,255,255,0.06)", c:"#888", hover:"rgba(255,255,255,0.  1)" },
21:01:24.246       red:   { bg:"rgba(239,68,68,0.12)", c:"#ef4444", hover:"rgba(239,68,68,0.2  )" },
21:01:24.246     };
21:01:24.246     const v = V[variant]||V.gold;
21:01:24.246     return (
21:01:24.246       <button onClick={onClick} disabled={disabled} className="btn-lift"
21:01:24.246         style={{ background:v.bg, color:v.c, border:"none", borderRadius:8, padd  ing:"8px 18px", fontSize:12, fontWeight:700, cursor:disabled?"not-allowed":"po  inter", opacity:disabled?0.35:1, fontFamily:"inherit", whiteSpace:"nowrap", tr  ansition:"all 0.15s ease", ...extra }}
21:01:24.246         onMouseEnter={e=>{ if(!disabled) e.currentTarget.style.background=v.hove  r; }}
21:01:24.246         onMouseLeave={e=>{ e.currentTarget.style.background=v.bg; }}>
21:01:24.246         {children}
21:01:24.246       </button>
21:01:24.246     );
21:01:24.246   }
21:01:24.246   function Field({ label, children }) {
21:01:24.246     return <div style={{ display:"flex", flexDirection:"column", gap:4 }}><label   style={S.lbl}>{label}</label>{children}</div>;
21:01:24.247   }
21:01:24.247   function TextInput({ label, value, onChange, type="text", placeholder }) {
21:01:24.247     return (
21:01:24.247       <Field label={label}>
21:01:24.247         <input type={type} value={value} onChange={e=>onChange(e.target.value)}   placeholder={placeholder} style={S.inp}/>
21:01:24.247       </Field>
21:01:24.247     );
21:01:24.247   }
21:01:24.247   function SelectInput({ label, value, onChange, options }) {
21:01:24.247     return (
21:01:24.247       <Field label={label}>
21:01:24.247         <select value={value} onChange={e=>onChange(e.target.value)} style={{ ..  .S.inp, color:value?"#F0F0F0":"#555", cursor:"pointer" }}>
21:01:24.247           <option value="">Select...</option>
21:01:24.247           {options.map(o=><option key={o} value={o}>{o}</option>)}
21:01:24.247         </select>
21:01:24.247       </Field>
21:01:24.247     );
21:01:24.247   }
21:01:24.247   function EmptyRow({ msg, cols=10 }) {
21:01:24.247     return (
21:01:24.247       <tr><td colSpan={cols} style={{ padding:"48px 0", textAlign:"center" }}>
21:01:24.247         <div style={{ fontSize:28, marginBottom:10, opacity:0.25 }}>—</div>
21:01:24.247         <div style={{ fontSize:13, color:"#555", fontWeight:500 }}>{msg}</div>
21:01:24.247       </td></tr>
21:01:24.247     );
21:01:24.247   }
21:01:24.247   function EmptyState({ icon="—", title, body }) {
21:01:24.247     return (
21:01:24.247       <div style={{ textAlign:"center", padding:"48px 24px" }}>
21:01:24.247         <div style={{ fontSize:36, marginBottom:12, opacity:0.3 }}>{icon}</div>
21:01:24.247         {title && <div style={{ fontSize:15, fontWeight:700, color:"#555", margi  nBottom:6 }}>{title}</div>}
21:01:24.247         {body  && <div style={{ fontSize:12, color:"#444", lineHeight:1.6, maxWi  dth:320, margin:"0 auto" }}>{body}</div>}
21:01:24.247       </div>
21:01:24.247     );
21:01:24.247   }
21:01:24.247   function AccessDenied({ msg }) {
21:01:24.247     return (
21:01:24.247       <div style={{ ...S.card, textAlign:"center", padding:"60px 40px" }}>
21:01:24.247         <div style={{ fontSize:36, marginBottom:12, opacity:0.4 }}>🔒</div>
21:01:24.247         <div style={{ fontSize:16, fontWeight:700, color:"#F0F0F0", marginBottom  :8 }}>Access Restricted</div>
21:01:24.247         <div style={{ fontSize:13, color:"#555", lineHeight:1.6 }}>{msg}</div>
21:01:24.247       </div>
21:01:24.247     );
21:01:24.247   }
21:01:24.247   
21:01:24.247   // ── PERFORMANCE HOOKS ──────────────────────────────────────────────────────  ───
21:01:24.248   function useDebounce(value, delay=220) {
21:01:24.248     const [debounced, setDebounced] = useState(value);
21:01:24.248     useEffect(() => {
21:01:24.248       const t = setTimeout(() => setDebounced(value), delay);
21:01:24.248       return () => clearTimeout(t);
21:01:24.248     }, [value, delay]);
21:01:24.248     return debounced;
21:01:24.248   }
21:01:24.248   
21:01:24.248   // Memoized calcStream — cache results by stream id+fingerprint so we don't
21:01:24.248   // recalculate 100 streams on every keystroke
21:01:24.248   const streamCalcCache = new Map();
21:01:24.248   function calcStreamMemo(s, targetBreaker=null) {
21:01:24.248     const key = `${s.id||""}:${s.grossRevenue}:${s.marketMultiple}:${s.newBuyers  }:${s.commissionOverride}:${s.channel}:${s.collabPct}:${s.externalChannel}:${s  .whatnotPromo}:${s.magpros}:${s.packagingMaterial}:${s.topLoaders}:${s.chaserC  ards}:${s.isSinglesShow}:${targetBreaker||""}`;
21:01:24.248     if (streamCalcCache.has(key)) return streamCalcCache.get(key);
21:01:24.248     const result = calcStream(s, targetBreaker);
21:01:24.248     streamCalcCache.set(key, result);
21:01:24.248     if (streamCalcCache.size > 500) {
21:01:24.248       const firstKey = streamCalcCache.keys().next().value;
21:01:24.248       streamCalcCache.delete(firstKey);
21:01:24.248     }
21:01:24.248     return result;
21:01:24.248   }
21:01:24.248   
21:01:24.248   function GlobalStyles() {
21:01:24.248     useEffect(() => {
21:01:24.248       const style = document.createElement("style");
21:01:24.248       style.textContent = `
21:01:24.248         * { box-sizing: border-box; }
21:01:24.248         html, body { overflow-x: hidden; max-width: 100vw; }
21:01:24.248         body { background: #000 !important; color: #F0F0F0; font-family: inherit  ; -webkit-font-smoothing: antialiased; }
21:01:24.248         #root { background: #000; min-height: 100vh; overflow-x: hidden; }
21:01:24.248         table { width: 100%; border-collapse: collapse; }
21:01:24.248         .tab-content { width: 100%; min-width: 0; }
21:01:24.248   
21:01:24.248         /* Image protection — prevent easy right-click save */
21:01:24.248         img { -webkit-user-drag: none; user-drag: none; pointer-events: none; }
21:01:24.248         .card-img-wrap { position: relative; display: inline-block; }
21:01:24.248         .card-img-wrap::after { content: ""; position: absolute; inset: 0; z-ind  ex: 1; cursor: default; }
21:01:24.248         input::placeholder { color: #444 !important; }
21:01:24.248         select option { background: #111; color: #F0F0F0; }
21:01:24.248         input, select, textarea { transition: border-color 0.15s ease, box-shado  w 0.15s ease !important; }
21:01:24.249         input:focus, select:focus, textarea:focus { outline: none !important; bo  rder-color: rgba(232,49,122,0.6) !important; box-shadow: 0 0 0 3px rgba(232,49  ,122,0.12) !important; }
21:01:24.249         input[type="date"], input[type="month"] { color-scheme: dark; }
21:01:24.249         input[type="date"]::-webkit-calendar-picker-indicator,
21:01:24.249         input[type="month"]::-webkit-calendar-picker-indicator { filter: invert(  0.6) sepia(1) saturate(5) hue-rotate(290deg); cursor: pointer; }
21:01:24.249         input[type="checkbox"] { cursor: pointer; accent-color: #E8317A; }
21:01:24.249         ::selection { background: rgba(232,49,122,0.25); color: #fff; }
21:01:24.249   
21:01:24.249         /* Scrollbars */
21:01:24.249         ::-webkit-scrollbar { width: 4px; height: 4px; }
21:01:24.249         ::-webkit-scrollbar-track { background: transparent; }
21:01:24.249         ::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
21:01:24.249         ::-webkit-scrollbar-thumb:hover { background: #E8317A; }
21:01:24.249   
21:01:24.249         /* Card hover */
21:01:24.249         .card-hover { transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), b  ox-shadow 0.18s ease, border-color 0.18s ease !important; }
21:01:24.249         .card-hover:hover { transform: translateY(-2px) !important; box-shadow:   0 12px 32px rgba(0,0,0,0.5) !important; border-color: rgba(232,49,122,0.2) !im  portant; }
21:01:24.249   
21:01:24.249         /* Buttons */
21:01:24.249         .btn-lift { transition: transform 0.15s cubic-bezier(0.34,1.56,0.64,1),   opacity 0.15s ease !important; }
21:01:24.249         .btn-lift:hover:not(:disabled) { transform: translateY(-1px) scale(1.02)   !important; }
21:01:24.249         .btn-lift:active:not(:disabled) { transform: translateY(0) scale(0.98) !  important; }
21:01:24.249   
21:01:24.249         /* Stat cards */
21:01:24.249         .stat-card { transition: transform 0.2s cubic-bezier(0.22,1,0.36,1), box  -shadow 0.2s ease, border-color 0.2s ease !important; }
21:01:24.249         .stat-card:hover { transform: translateY(-3px) !important; box-shadow: 0   16px 40px rgba(0,0,0,0.6) !important; }
21:01:24.250   
21:01:24.250         /* Table rows */
21:01:24.250         .inv-row, .break-row { transition: background 0.1s ease !important; }
21:01:24.250         .inv-row:hover, .break-row:hover { background: rgba(255,255,255,0.03) !i  mportant; }
21:01:24.250         .clickable-row { transition: background 0.1s ease !important; cursor: po  inter !important; }
21:01:24.250         .clickable-row:hover { background: rgba(255,255,255,0.03) !important; bo  x-shadow: inset 3px 0 0 #E8317A !important; }
21:01:24.250   
21:01:24.250         /* Nav */
21:01:24.250         .dash-tab:hover { background: rgba(232,49,122,0.06) !important; color: r  gba(232,49,122,0.8) !important; border-bottom: 2px solid rgba(232,49,122,0.4)   !important; }
21:01:24.250         .nav-bazooka { transition: opacity 0.2s ease; }
21:01:24.250         .nav-bazooka:hover { opacity: 0.8; }
21:01:24.250   
21:01:24.251         /* Animations */
21:01:24.251         @keyframes fadeSlideUp { from { opacity:0; transform:translateY(12px); }   to { opacity:1; transform:translateY(0); } }
21:01:24.251         @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
21:01:24.251         @keyframes slideIn { from { opacity:0; transform:translateX(16px); } to   { opacity:1; transform:translateX(0); } }
21:01:24.251         @keyframes numPop { from { transform:scale(0.8); opacity:0; } to { trans  form:scale(1); opacity:1; } }
21:01:24.251         @keyframes spin { to { transform:rotate(360deg); } }
21:01:24.251         @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
21:01:24.251         @keyframes toastIn { from { opacity:0; transform:translateY(20px) scale(  0.95); } to { opacity:1; transform:translateY(0) scale(1); } }
21:01:24.251         @keyframes expandDown { from { opacity:0; transform:scaleY(0.96) transla  teY(-6px); transform-origin:top; } to { opacity:1; transform:scaleY(1) transla  teY(0); } }
21:01:24.251         @keyframes saveFlash { 0%{box-shadow:0 0 0 0 rgba(22,101,52,0.6);} 50%{b  ox-shadow:0 0 0 12px rgba(22,101,52,0.02);} 100%{box-shadow:none;} }
21:01:24.251         @keyframes pulsRed { 0%,100%{box-shadow:0 0 0 0 rgba(153,27,27,0.5);} 50  %{box-shadow:0 0 0 8px rgba(153,27,27,0);} }
21:01:24.251         @keyframes tickerScroll { from { transform:translateX(0); } to { transfo  rm:translateX(-50%); } }
21:01:24.251         .ticker-track { display:inline-flex; gap:10px; animation:tickerScroll 30  s linear infinite; }
21:01:24.251         .ticker-wrap:hover .ticker-track { animation-play-state:paused; }
21:01:24.251         @keyframes pulsYellow { 0%,100%{box-shadow:0 0 0 0 rgba(146,64,14,0.4);}   50%{box-shadow:0 0 0 6px rgba(146,64,14,0);} }
21:01:24.251         @keyframes pulsCritical { 0%,100%{box-shadow:0 0 0 0 rgba(220,38,38,0.6)  ;} 50%{box-shadow:0 0 0 8px rgba(220,38,38,0.04);} }
21:01:24.251         .toast { animation: toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forward  s; }
21:01:24.251         .num-pop { animation: numPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwar  ds; }
21:01:24.251         .fade-in { animation: fadeIn 0.25s ease forwards; }
21:01:24.251         .slide-in { animation: slideIn 0.22s cubic-bezier(0.22,1,0.36,1) forward  s; }
21:01:24.251         .drill-down { animation: expandDown 0.22s cubic-bezier(0.22,1,0.36,1) fo  rwards; }
21:01:24.251         .save-flash { animation: saveFlash 0.5s ease forwards; }
21:01:24.252         .zone-red { animation: pulsRed 2.5s ease-in-out infinite; }
21:01:24.252         .zone-yellow { animation: pulsYellow 2.5s ease-in-out infinite; }
21:01:24.252         .status-critical { animation: pulsCritical 2s ease-in-out infinite; }
21:01:24.252         .boba-flip-card { transform-style: preserve-3d; }
21:01:24.252         .boba-flip-card > div { backface-visibility: hidden; -webkit-backface-vi  sibility: hidden; }
21:01:24.252         .boba-card-flip { transform-style: preserve-3d; transition: transform 0.  5s ease; }
21:01:24.252         .boba-card-flip:hover { transform: rotateY(180deg); }
21:01:24.252         .boba-flip-pill { opacity: 0; transform: translateY(4px); transition: op  acity 0.18s ease, transform 0.18s ease; }
21:01:24.252         .boba-card-hover:hover .boba-flip-pill { opacity: 1; transform: translat  eY(0); }
21:01:24.252         @media (hover: none) { .boba-flip-pill { opacity: 1; transform: none; }   }
21:01:24.252   
21:01:24.252         /* Mobile */
21:01:24.252         @media (max-width: 768px) {
21:01:24.252           .tab-content { padding: 8px !important; }
21:01:24.252           table { font-size: 12px !important; }
21:01:24.252           .mobile-stack { flex-direction: column !important; }
21:01:24.252           .mobile-full { width: 100% !important; grid-template-columns: 1fr !imp  ortant; }
21:01:24.252           .mobile-2col { grid-template-columns: 1fr 1fr !important; }
21:01:24.252           .mobile-hide { display: none !important; }
21:01:24.252           input, select, textarea { font-size: 16px !important; }
21:01:24.252         }
21:01:24.252         .mobile-show { display: inline !important; }
21:01:24.252         .nav-tab-label { display: inline; }
21:01:24.252         .boba-card-grid { grid-template-columns: repeat(2,1fr) !important; gap:6  px !important; }
21:01:24.252         .lot-comp-grid { grid-template-columns: 1fr !important; }
21:01:24.252         .stats-grid-4 { grid-template-columns: 1fr 1fr !important; }
21:01:24.252         .mobile-scroll-x { overflow-x: auto !important; -webkit-overflow-scrolli  ng: touch; }
21:01:24.252         .mobile-scroll-x table { min-width: 500px; }
21:01:24.252         .view-mode-row { overflow-x: auto !important; flex-wrap: nowrap !importa  nt; -webkit-overflow-scrolling: touch; }
21:01:24.253         .view-mode-row::-webkit-scrollbar { display: none; }
21:01:24.253         .checklist-actions { flex-wrap: wrap !important; }
21:01:24.253         .deck-pb-layout { grid-template-columns: 1fr !important; }
21:01:24.253         .dash-grid-5 { grid-template-columns: repeat(2,1fr) !important; }
21:01:24.253         .dash-grid-4 { grid-template-columns: repeat(2,1fr) !important; }
21:01:24.253         .dash-grid-3 { grid-template-columns: repeat(2,1fr) !important; }
21:01:24.253         .dash-fin-card { font-size: 18px !important; padding: 12px !important; }        .period-btns { gap: 4px !important; }
21:01:24.253         .period-btns button { padding: 4px 8px !important; font-size: 10px !impo  rtant; }
21:01:24.253       `;
21:01:24.253       document.head.appendChild(style);
21:01:24.253       return () => document.head.removeChild(style);
21:01:24.253     }, []);
21:01:24.253     return null;
21:01:24.253   }
21:01:24.253   
21:01:24.253   function LoginScreen() {
21:01:24.253     const [error, setError] = useState(null);
21:01:24.253     async function handleLogin() {
21:01:24.253       try { await signInWithPopup(auth, googleProvider); }
21:01:24.253       catch { setError("Login failed. Please try again."); }
21:01:24.253     }
21:01:24.253     return (
21:01:24.253       <div style={{display:"flex",alignItems:"center",justifyContent:"center",mi  nHeight:"100vh",background:"#000",fontFamily:"'Trebuchet MS',sans-serif",overf  low:"hidden",position:"relative"}}>
21:01:24.253         <style>{`
21:01:24.253           @keyframes loginOrb{0%,100%{transform:translate(0,0) scale(1)}33%{tran  sform:translate(40px,-30px) scale(1.1)}66%{transform:translate(-25px,20px) sca  le(0.9)}}
21:01:24.253           @keyframes loginSpin{from{transform:rotate(0deg)}to{transform:rotate(3  60deg)}}
21:01:24.253           @keyframes loginSpinR{from{transform:rotate(0deg)}to{transform:rotate(  -360deg)}}
21:01:24.253           @keyframes loginFade{from{opacity:0;transform:translateY(24px)}to{opac  ity:1;transform:translateY(0)}}
21:01:24.253           @keyframes loginPulse{0%,100%{opacity:0.5;transform:scale(0.95)}50%{op  acity:1;transform:scale(1.05)}}
21:01:24.253           .login-btn{transition:all 0.2s cubic-bezier(0.34,1.56,0.64,1) !importa  nt;}
21:01:24.253           .login-btn:hover{transform:translateY(-2px) scale(1.02) !important;box  -shadow:0 16px 48px rgba(232,49,122,0.5) !important;}
21:01:24.253         `}</style>
21:01:24.253         <div style={{position:"absolute",width:600,height:600,borderRadius:"50%"  ,background:"radial-gradient(circle,rgba(232,49,122,0.07) 0%,transparent 70%)"  ,top:"-15%",left:"-10%",animation:"loginOrb 12s ease-in-out infinite",pointerE  vents:"none"}}/>
21:01:24.253         <div style={{position:"absolute",width:500,height:500,borderRadius:"50%"  ,background:"radial-gradient(circle,rgba(123,47,247,0.07) 0%,transparent 70%)"  ,bottom:"-10%",right:"-10%",animation:"loginOrb 15s ease-in-out infinite rever  se",pointerEvents:"none"}}/>
21:01:24.253         <div style={{display:"flex",flexDirection:"column",alignItems:"center",g  ap:40,animation:"loginFade 0.7s ease both",position:"relative",zIndex:1}}>
21:01:24.253           <div style={{position:"relative",width:120,height:120}}>
21:01:24.253             <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"  1.5px solid rgba(232,49,122,0.2)",animation:"loginSpin 10s linear infinite"}}/  >
21:01:24.253             <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"  1.5px dashed rgba(123,47,247,0.15)",animation:"loginSpinR 14s linear infinite"  }}/>
21:01:24.253             <div style={{position:"absolute",inset:14,borderRadius:"50%",border:  "2px solid rgba(232,49,122,0.5)",animation:"loginSpin 5s linear infinite",boxS  hadow:"0 0 20px rgba(232,49,122,0.2)"}}/>
21:01:24.253             <div style={{position:"absolute",inset:28,borderRadius:"50%",border:  "1.5px solid rgba(123,47,247,0.4)",animation:"loginSpinR 3s linear infinite"}}  />
21:01:24.253             <div style={{position:"absolute",inset:0,display:"flex",alignItems:"  center",justifyContent:"center"}}>
21:01:24.253               <img src="/BazookaLogo.png" alt="" style={{width:56,height:56,obje  ctFit:"contain",filter:"drop-shadow(0 0 12px rgba(232,49,122,0.6))",animation:  "loginPulse 2.5s ease-in-out infinite"}}/>
21:01:24.253             </div>
21:01:24.253           </div>
21:01:24.253           <div style={{textAlign:"center"}}>
21:01:24.254             <img src="/Bazooka_Logo_cropped.png" alt="Bazooka" style={{height:"c  lamp(44px,8vw,68px)",width:"auto",maxWidth:"80vw",objectFit:"contain",display:  "block",margin:"0 auto 12px",filter:"drop-shadow(0 4px 16px rgba(232,49,122,0.  35))"}}/>
21:01:24.254             <div style={{fontSize:12,color:"rgba(255,255,255,0.2)",letterSpacing  :3,textTransform:"uppercase"}}>Internal Operations</div>
21:01:24.254           </div>
21:01:24.254           <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgb  a(255,255,255,0.08)",borderRadius:20,padding:"32px 40px",textAlign:"center",mi  nWidth:320}}>
21:01:24.254             <div style={{fontSize:13,color:"rgba(255,255,255,0.35)",marginBottom  :24,lineHeight:1.7}}>Access restricted to<br/>Bazooka team members</div>
21:01:24.254             <button onClick={handleLogin} className="login-btn" style={{display:  "flex",alignItems:"center",gap:12,background:"linear-gradient(135deg,#E8317A,#  7B2FF7)",color:"#fff",border:"none",borderRadius:12,padding:"14px 28px",fontSi  ze:14,fontWeight:800,cursor:"pointer",fontFamily:"inherit",width:"100%",justif  yContent:"center",boxShadow:"0 8px 32px rgba(232,49,122,0.3)"}}>
21:01:24.254               <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#fff"   fillOpacity="0.9" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8   7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#fff" fillOpacity="0.  9" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.0  7A8 8 0 008.98 17z"/><path fill="#fff" fillOpacity="0.9" d="M4.5 10.52a4.8 4.8   0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z"/><path fill="#fff" fillOpacit  y="0.9" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49  a4.77 4.77 0 014.48-3.31z"/></svg>
21:01:24.254               Sign in with Google
21:01:24.254             </button>
21:01:24.254             {error && <div style={{marginTop:16,color:"#E8317A",fontSize:12,font  Weight:600}}>{error}</div>}
21:01:24.254           </div>
21:01:24.254         </div>
21:01:24.254       </div>
21:01:24.254     );
21:01:24.254   }
21:01:24.254   
21:01:24.254   function Dashboard({ inventory, breaks, user, userRole, streams=[], historical  Data=[], onSaveHistorical, onDeleteHistorical, payStubs=[], onDismissPayStub,   quotes=[], onDismissQuoteNotif, cardPools=[], imcAdjustmentsData={}, onSaveImc  Adjustments, plannedStreams=[] }) {
21:01:24.254     const canSeeFinancials = ["Admin"].includes(userRole?.role);
21:01:24.254     const curUser    = user?.displayName?.split(" ")[0] || "";
21:01:24.254     const myBreaker  = BREAKERS.find(b => curUser.toLowerCase().includes(b.toLow  erCase()));
21:01:24.254     const GOAL_KEY   = `bz_yeargoals_${new Date().getFullYear()}`;
21:01:24.254     const [goals,     setGoals]     = useState(()=>{ try { return JSON.parse(loc  alStorage.getItem(GOAL_KEY)||"{}"); } catch(e) { return {}; } });
21:01:24.254     const [editGoals, setEditGoals] = useState(false);
21:01:24.254     const [goalForm,  setGoalForm]  = useState(()=>{ try { return JSON.parse(loc  alStorage.getItem(GOAL_KEY)||"{}"); } catch(e) { return {}; } });
21:01:24.254   
21:01:24.254     // Pay stub notifications for this breaker
21:01:24.254     const myStubs = payStubs.filter(s => s.breaker === myBreaker && !s.read);
21:01:24.254     // Quote notifications for admins
21:01:24.254     const quoteNotifs = canSeeFinancials ? quotes.filter(q => !q.notified && (["  accepted","declined","countered"].includes(q.status) || q.submittedBySeller))   : [];
21:01:24.254     const [viewStub,  setViewStub]  = useState(null);
21:01:24.254     const [viewQuote, setViewQuote] = useState(null);
21:01:24.254     const [lightbox,  setLightbox]  = useState(null);
21:01:24.254     const [financialPeriod, setFinancialPeriod] = useState("year");
21:01:24.254     const [customStart,     setCustomStart]     = useState("");
21:01:24.254     const [customEnd,       setCustomEnd]       = useState("");
21:01:24.254     const [drillDown,       setDrillDown]       = useState(null);
21:01:24.254     const [showHist,    setShowHist]    = useState(false);
21:01:24.254     const [histForm,    setHistForm]    = useState({ yearMonth:"", grossRevenue:  "", netRevenue:"", imcReimb:"", newBuyers:"", notes:"" });
21:01:24.254     const [editingId,   setEditingId]   = useState(null);
21:01:24.254     const [imcAdjustments, setImcAdjustments] = useState(imcAdjustmentsData||{})  ;
21:01:24.254     useEffect(() => { setImcAdjustments(imcAdjustmentsData||{}); }, [imcAdjustme  ntsData]);
21:01:24.254     function updateImcAdj(mk, val) {
21:01:24.254       const next = { ...imcAdjustments, [mk]: val };
21:01:24.254       setImcAdjustments(next);
21:01:24.254       if (onSaveImcAdjustments) onSaveImcAdjustments(next);
21:01:24.254     }
21:01:24.255     function clearImcAdj() {
21:01:24.255       setImcAdjustments({});
21:01:24.255       if (onSaveImcAdjustments) onSaveImcAdjustments({});
21:01:24.255     }
21:01:24.255     const [showImcAdj,  setShowImcAdj]  = useState(false);
21:01:24.255     const [migrating,   setMigrating]   = useState(false);
21:01:24.255     const [migDone,     setMigDone]     = useState(false);
21:01:24.255     const [opsPeriod,    setOpsPeriod]    = useState("month");
21:01:24.255     const [opsFrom,      setOpsFrom]      = useState("");
21:01:24.255     const [opsTo,        setOpsTo]        = useState("");
21:01:24.255     const usedIds    = new Set(breaks.filter(b=>!b.isPoolLog).map(b => b.invento  ryId));
21:01:24.255     const transitIds = new Set(inventory.filter(c => c.cardStatus === "in_transi  t").map(c => c.id));
21:01:24.255     const USAGE_TO_CT = { "Giveaway":"Giveaway Cards", "Insurance":"Insurance Ca  rds", "First-Timer Pack":"First-Timer Cards", "Chaser Pull":"Chaser Cards", "C  haser":"Chaser Cards" };
21:01:24.255     // Count individual-card usage by usage type (exclude pool logs — pool usage   comes from pool.usedQty)
21:01:24.255     const usedByType = {};
21:01:24.255     CARD_TYPES.forEach(ct => { usedByType[ct] = 0; });
21:01:24.255     breaks.forEach(b => {
21:01:24.256       if (b.isPoolLog) return; // pool usage counted separately below
21:01:24.256       const ct = USAGE_TO_CT[b.usage] || b.cardType;
21:01:24.256       if (ct && usedByType[ct] !== undefined) usedByType[ct]++;
21:01:24.256     });
21:01:24.256     // Add pool usage (usedQty is the ground truth for pools, qty-aware)
21:01:24.256     cardPools.forEach(p => {
21:01:24.256       const ct = p.cardType;
21:01:24.256       if (ct && usedByType[ct] !== undefined) usedByType[ct] += (parseInt(p.used  Qty)||0);
21:01:24.256     });
21:01:24.256     const stats = {};
21:01:24.256     CARD_TYPES.forEach(ct => { stats[ct] = { total:0, avail:0, used:0, inTransit  :0, invested:0, investedAll:0, market:0 }; });
21:01:24.256     inventory.forEach(c => {
21:01:24.256       const s = stats[c.cardType]; if (!s) return;
21:01:24.256       s.total++;
21:01:24.256       s.investedAll += (c.costPerCard||0);
21:01:24.256       if (usedIds.has(c.id)) return; // skip used cards for avail/cost/market
21:01:24.256       s.invested += (c.costPerCard||0);
21:01:24.256       s.market   += (c.marketValue||0);
21:01:24.256       if (c.cardStatus === "in_transit") { s.inTransit++; } else { s.avail++; }
21:01:24.256     });
21:01:24.256     // Add pool available cards to the relevant card type
21:01:24.256     cardPools.forEach(p => {
21:01:24.256       const s = stats[p.cardType]; if (!s) return;
21:01:24.256       const poolAvail = Math.max(0, (parseInt(p.totalQty)||0) - (parseInt(p.used  Qty)||0));
21:01:24.256       s.total += parseInt(p.totalQty)||0;
21:01:24.256       s.avail += poolAvail;
21:01:24.256     });
21:01:24.256     CARD_TYPES.forEach(ct => { stats[ct].used = usedByType[ct]; });
21:01:24.256     const totInv      = Object.values(stats).reduce((a,b) => a+b.invested, 0);
21:01:24.256     const totInvAll   = Object.values(stats).reduce((a,b) => a+b.investedAll, 0)  ;
21:01:24.256     const totMkt      = Object.values(stats).reduce((a,b) => a+b.market, 0);
21:01:24.256     const oPct        = totMkt > 0 ? totInv/totMkt : null;
21:01:24.256     const oz          = getZone(oPct);
21:01:24.256     const usedCount   = [...usedIds].length + cardPools.reduce((s,p)=>s+(parseIn  t(p.usedQty)||0),0);
21:01:24.256     const transitCount = inventory.filter(c => c.cardStatus === "in_transit" &&   !usedIds.has(c.id)).length;
21:01:24.256     const poolAvailTotal = cardPools.reduce((s,p)=>s+Math.max(0,(parseInt(p.tota  lQty)||0)-(parseInt(p.usedQty)||0)),0);
21:01:24.256     const availCount  = inventory.length - [...usedIds].length - transitCount +   poolAvailTotal;
21:01:24.256   
21:01:24.256     const runway = {};
21:01:24.256     CARD_TYPES.forEach(ct => {
21:01:24.256       const avail = stats[ct].avail;
21:01:24.256       const ctBreaks = breaks.filter(b => !b.isPoolLog && (USAGE_TO_CT[b.usage]   || b.cardType) === ct);
21:01:24.256       // For pools, estimate daily usage from usedQty and pool creation date
21:01:24.256       const poolUsed = cardPools.filter(p=>p.cardType===ct).reduce((s,p)=>s+(par  seInt(p.usedQty)||0),0);
21:01:24.256       const totalUsedForRate = ctBreaks.length + poolUsed;
21:01:24.257       if (totalUsedForRate === 0) { runway[ct] = 999; return; }
21:01:24.257       const allDates = [
21:01:24.257         ...ctBreaks.map(b => new Date(b.dateAdded||b.date)),
21:01:24.257       ].filter(d => !isNaN(d));
21:01:24.257       if (!allDates.length) { runway[ct] = 999; return; }
21:01:24.257       const earliest = allDates.reduce((mn, d) => d < mn ? d : mn, new Date());
21:01:24.257       const days = Math.max(1, Math.floor((new Date() - earliest) / 86400000));
21:01:24.257       runway[ct] = Math.floor(avail / (totalUsedForRate / days));
21:01:24.257     });
21:01:24.257   
21:01:24.257     const alerts = CARD_TYPES.filter(ct => (stats[ct].avail) < TARGETS[ct].buffe  r);
21:01:24.257   
21:01:24.257     const calcStreamDash = (s) => calcStreamMemo(s);
21:01:24.257   
21:01:24.257     return (
21:01:24.257       <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
21:01:24.257   
21:01:24.257         {/* Lightbox overlay */}
21:01:24.257         {lightbox && (
21:01:24.257           <div onClick={()=>setLightbox(null)}
21:01:24.257             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", z  Index:99999, display:"flex", alignItems:"center", justifyContent:"center", cur  sor:"zoom-out" }}>
21:01:24.257             <img src={lightbox} alt="Lot photo"
21:01:24.257               style={{ maxWidth:"90vw", maxHeight:"90vh", objectFit:"contain", b  orderRadius:10, boxShadow:"0 0 60px rgba(0,0,0,0.8)" }}
21:01:24.257               onClick={e=>e.stopPropagation()}/>
21:01:24.257             <button onClick={()=>setLightbox(null)}
21:01:24.257               style={{ position:"fixed", top:20, right:24, background:"rgba(255,  255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", color:"#fff", borderR  adius:"50%", width:40, height:40, fontSize:20, cursor:"pointer", fontFamily:"i  nherit", lineHeight:1 }}>✕</button>
21:01:24.257           </div>
21:01:24.257         )}
21:01:24.257   
21:01:24.257         {/* -- QUOTE NOTIFICATIONS (Admin) -- */}
21:01:24.257         {quoteNotifs.map(q => {
21:01:24.257           const cfg = {
21:01:24.257             accepted: { icon:"\uD83C\uDF89", color:"#4ade80", bg:"#0a1a0a", bord  er:"#4ade8033", title:"Offer Accepted!", body:`${q.seller?.name||"Seller"} acc  epted your offer of $${parseFloat(q.dispOffer||0).toFixed(2)}` },
21:01:24.257             declined: { icon:"\u274C", color:"#E8317A", bg:"#1a0a0a", border:"#E  8317A33", title:"Offer Declined", body:`${q.seller?.name||"Seller"} declined y  our offer of $${parseFloat(q.dispOffer||0).toFixed(2)}` },
21:01:24.257             countered:{ icon:"\uD83E\uDD1D", color:"#FBBF24", bg:"#1a1400", bord  er:"#FBBF2433", title:"Counter Offer!", body:`${q.seller?.name||"Seller"} coun  tered at $${parseFloat(q.sellerCounter||0).toFixed(2)} (you offered $${parseFl  oat(q.currentOffer||q.dispOffer||0).toFixed(2)})` },
21:01:24.257             pending:  q.submittedBySeller ? { icon:"📬", color:"#7B9CFF", bg:"#0  a0a1a", border:"#7B9CFF33", title:"New Lot Submission!", body:`${q.seller?.nam  e||"Someone"} submitted ${(q.cards||[]).length} card${(q.cards||[]).length!==1  ?"s":""} for a quote via bazookadash.com/sell` } : null,
21:01:24.257           }[q.status] || (q.submittedBySeller ? { icon:"📬", color:"#7B9CFF", bg  :"#0a0a1a", border:"#7B9CFF33", title:"New Lot Submission!", body:`${q.seller?  .name||"Someone"} submitted ${(q.cards||[]).length} card${(q.cards||[]).length  !==1?"s":""} for a quote via bazookadash.com/sell` } : null);
21:01:24.257           if (!cfg) return null;
21:01:24.257           return (
21:01:24.257             <div key={q.id} style={{ background:cfg.bg, border:`2px solid ${cfg.  border}`, borderRadius:14, padding:"18px 20px" }}>
21:01:24.257               <div style={{ display:"flex", alignItems:"center", justifyContent:  "space-between", gap:16, flexWrap:"wrap" }}>
21:01:24.258                 <div style={{ display:"flex", alignItems:"center", gap:14 }}>
21:01:24.258                   <div style={{ fontSize:28 }}>{cfg.icon}</div>
21:01:24.258                   <div>
21:01:24.258                     <div style={{ display:"flex", alignItems:"center", gap:8, ma  rginBottom:4, flexWrap:"wrap" }}>
21:01:24.258                       <span style={{ fontSize:14, fontWeight:800, color:cfg.colo  r }}>{cfg.title}</span>
21:01:24.258                       {q.quoteRef && <span style={{ fontSize:11, fontWeight:700,   color:"#7B9CFF", background:"rgba(123,156,255,0.08)", border:"1px solid rgba(  123,156,255,0.2)", borderRadius:6, padding:"2px 8px", letterSpacing:0.5 }}>{q.  quoteRef}</span>}
21:01:24.258                     </div>
21:01:24.258                     <div style={{ fontSize:12, color:"#888" }}>{cfg.body}</div>
21:01:24.258                     {q.quotedBy && <div style={{ fontSize:11, color:"#555", marg  inTop:3 }}>Quoted by <strong style={{color:"#AAAAAA"}}>{q.quotedBy.split(" ")[  0]}</strong></div>}
21:01:24.258                     {/* Lot photos */}
21:01:24.258                     {(q.photoUrls||[]).length > 0 && (
21:01:24.258                       <div style={{ display:"flex", gap:6, flexWrap:"wrap", marg  inTop:10 }}>
21:01:24.258                         {(q.photoUrls||[]).map((url,i)=>(
21:01:24.258                           <img key={i} src={url} alt={`Photo ${i+1}`}
21:01:24.258                             onClick={()=>setLightbox(url)}
21:01:24.258                             style={{ width:72, height:72, objectFit:"cover", bor  derRadius:8, border:"1px solid rgba(123,156,255,0.3)", cursor:"zoom-in" }}
21:01:24.258                             onError={e=>e.target.style.display="none"}/>
21:01:24.258                         ))}
21:01:24.258                         <div style={{ fontSize:11, color:"#7B9CFF", alignSelf:"c  enter" }}>📸 {(q.photoUrls||[]).length} photo{(q.photoUrls||[]).length!==1?"s"  :""} · click to enlarge</div>
21:01:24.258                       </div>
21:01:24.258                     )}
21:01:24.258                     {q.submittedBySeller && !(q.photoUrls||[]).length && (
21:01:24.258                       <div style={{ fontSize:11, color:"#333", marginTop:6, font  Style:"italic" }}>No photos submitted</div>
21:01:24.258                     )}
21:01:24.258                     {q.status==="accepted" && q.sellerPayment && (
21:01:24.258                       <div style={{ fontSize:12, color:"#4ade80", marginTop:4 }}  >{"\uD83D\uDCB3 Wants payment via "}<strong>{q.sellerPayment}</strong>{q.selle  rHandle ? ` — ${q.sellerHandle}` : ""}</div>
21:01:24.258                     )}
21:01:24.258                   </div>
21:01:24.258                 </div>
21:01:24.258                 <div style={{ display:"flex", gap:8 }}>
21:01:24.258                   <a href={`/quote/${q.id}`} target="_blank" rel="noreferrer" st  yle={{ background:"#1a1a1a", color:cfg.color, border:`1px solid ${cfg.border}`  , borderRadius:8, padding:"7px 14px", fontSize:12, fontWeight:700, textDecorat  ion:"none" }}>{"View Quote \u2197"}</a>
21:01:24.258                   <button onClick={()=>{ if(onDismissQuoteNotif) onDismissQuoteN  otif(q.id); }} style={{ background:"transparent", border:"1px solid #333", col  or:"#666", borderRadius:8, padding:"7px 12px", fontSize:12, cursor:"pointer",   fontFamily:"inherit" }}>{"\u2713 Dismiss"}</button>
21:01:24.258                 </div>
21:01:24.258               </div>
21:01:24.258             </div>
21:01:24.258           );
21:01:24.259         })}
21:01:24.259   
21:01:24.259         {/* -- UPCOMING STREAMS (reps only) -- */}
21:01:24.259         {!canSeeFinancials && myBreaker && (() => {
21:01:24.259           const today = new Date(); today.setHours(0,0,0,0);
21:01:24.259           const in7 = new Date(today); in7.setDate(today.getDate()+7);
21:01:24.259           const upcoming = plannedStreams
21:01:24.259             .filter(p => {
21:01:24.259               const d = parseLocalDate(p.date);
21:01:24.259               return d >= today && d <= in7 && p.breaker === myBreaker;
21:01:24.259             })
21:01:24.259             .sort((a,b) => a.date.localeCompare(b.date));
21:01:24.259           if (!upcoming.length) return (
21:01:24.259             <div style={{ background:"#111", border:"1px solid #1a1a1a", borderR  adius:14, padding:"18px 20px" }}>
21:01:24.259               <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0", margin  Bottom:4 }}>📅 Your Next 7 Days</div>
21:01:24.259               <div style={{ fontSize:12, color:"#333", padding:"16px 0", textAli  gn:"center" }}>No streams scheduled — check with your team</div>
21:01:24.259             </div>
21:01:24.259           );
21:01:24.259           return (
21:01:24.259             <div style={{ background:"#111", border:"1px solid #1a1a2e", borderR  adius:14, padding:"18px 20px" }}>
21:01:24.259               <div style={{ fontSize:13, fontWeight:800, color:"#F0F0F0", margin  Bottom:14 }}>📅 Your Next 7 Days · <span style={{ color:"#555", fontWeight:400   }}>{upcoming.length} stream{upcoming.length!==1?"s":""} scheduled</span></div  >
21:01:24.259               <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
21:01:24.259                 {upcoming.map((p,i) => {
21:01:24.260                   const d = parseLocalDate(p.date);
21:01:24.260                   const isToday = d.toDateString() === new Date().toDateString()  ;
21:01:24.260                   const isTomorrow = d.toDateString() === new Date(Date.now()+86  400000).toDateString();
21:01:24.260                   const dayLabel = isToday ? "🔴 Today" : isTomorrow ? "🟡 Tomor  row" : d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeri  c"});
21:01:24.260                   const sessionIcon = {day:"☀️",night:"🌙",weekend:"📅",event:"�  �"}[p.sessionType]||"📺";
21:01:24.260                   const bc = BC[p.breaker]?.text || "#E8317A";
21:01:24.260                   return (
21:01:24.260                     <div key={p.id||i} style={{ display:"flex", alignItems:"cent  er", gap:14, padding:"12px 16px", background:isToday?"rgba(232,49,122,0.06)":"  #0d0d0d", border:`1px solid ${isToday?"rgba(232,49,122,0.3)":"#1a1a1a"}`, bord  erRadius:10 }}>
21:01:24.260                       <div style={{ fontSize:22 }}>{sessionIcon}</div>
21:01:24.260                       <div style={{ flex:1 }}>
21:01:24.260                         <div style={{ fontSize:14, fontWeight:800, color:"#F0F0F  0" }}>{p.streamName||p.breaker}</div>
21:01:24.260                         <div style={{ fontSize:11, color:"#555", marginTop:2 }}>                          {p.startTime && <span style={{ color:"#AAAAAA", margin  Right:8 }}>🕐 {p.startTime}{p.endTime?` – ${p.endTime}`:""}</span>}
21:01:24.260                           {p.sessionType && <span style={{ marginRight:8 }}>{p.s  essionType}</span>}
21:01:24.260                           {p.sets && p.sets.length > 0 && <span style={{ color:"  #7B9CFF" }}>{p.sets.join(", ")}</span>}
21:01:24.260                         </div>
21:01:24.260                       </div>
21:01:24.260                       <div style={{ textAlign:"right" }}>
21:01:24.260                         <div style={{ fontSize:13, fontWeight:800, color:isToday  ?"#E8317A":"#FBBF24" }}>{dayLabel}</div>
21:01:24.260                         {p.notes && <div style={{ fontSize:10, color:"#555", mar  ginTop:2, maxWidth:120, textAlign:"right" }}>{p.notes}</div>}
21:01:24.260                       </div>
21:01:24.260                     </div>
21:01:24.260                   );
21:01:24.260                 })}
21:01:24.260               </div>
21:01:24.260             </div>
21:01:24.260           );
21:01:24.260         })()}
21:01:24.260   
21:01:24.260         {/* -- PAY STUB NOTIFICATIONS -- */}
21:01:24.260         {myStubs.length > 0 && myStubs.map(stub => (
21:01:24.260           <div key={stub.id} style={{ background:"linear-gradient(135deg,#0a1a0a  ,#111)", border:"2px solid #4ade80", borderRadius:14, padding:"18px 20px", dis  play:"flex", alignItems:"center", justifyContent:"space-between", gap:16, flex  Wrap:"wrap" }}>
21:01:24.260             <div style={{ display:"flex", alignItems:"center", gap:14 }}>
21:01:24.260               <div style={{ fontSize:32 }}>{"\uD83D\uDCB5"}</div>
21:01:24.260               <div>
21:01:24.260                 <div style={{ fontSize:14, fontWeight:800, color:"#4ade80", marg  inBottom:4 }}>New Pay Stub from Bazooka!</div>
21:01:24.260                 <div style={{ fontSize:12, color:"#888" }}>
21:01:24.260                   Period: <strong style={{color:"#F0F0F0"}}>{stub.period}</stron  g>
21:01:24.260                   &nbsp;·&nbsp; {stub.streamCount} stream{stub.streamCount!==1?"  s":""}
21:01:24.260                   &nbsp;·&nbsp; Generated {new Date(stub.createdAt).toLocaleDate  String()}
21:01:24.260                 </div>
21:01:24.260               </div>
21:01:24.260             </div>
21:01:24.260             <div style={{ display:"flex", alignItems:"center", gap:16, flexShrin  k:0 }}>
21:01:24.261               <div style={{ textAlign:"right" }}>
21:01:24.261                 <div style={{ fontSize:28, fontWeight:900, color:"#4ade80" }}>{f  mt(stub.totalComm)}</div>
21:01:24.261                 <div style={{ fontSize:10, color:"#666", textTransform:"uppercas  e", letterSpacing:1 }}>Commission Earned</div>
21:01:24.261               </div>
21:01:24.261               <div style={{ display:"flex", gap:8 }}>
21:01:24.261                 <button onClick={()=>setViewStub(viewStub===stub.id?null:stub.id  )} style={{ background:"#4ade80", color:"#000", border:"none", borderRadius:8,   padding:"8px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily  :"inherit" }}>
21:01:24.261                   {viewStub===stub.id ? "\u25B2 Hide" : "\uD83D\uDC41 View Detai  ls"}
21:01:24.261                 </button>
21:01:24.261                 <button onClick={()=>{ if(onDismissPayStub) onDismissPayStub(stu  b.id); }} style={{ background:"transparent", border:"1px solid #555", color:"#  888", borderRadius:8, padding:"8px 12px", fontSize:12, cursor:"pointer", fontF  amily:"inherit" }}>{"\u2713 Dismiss"}</button>
21:01:24.261               </div>
21:01:24.261             </div>
21:01:24.261             {viewStub===stub.id && (
21:01:24.261               <div style={{ width:"100%", borderTop:"1px solid #2a2a2a", padding  Top:14, marginTop:4 }}>
21:01:24.261                 <table style={{ width:"100%", borderCollapse:"collapse" }}>
21:01:24.261                   <thead><tr>
21:01:24.261                     {["Date","Type","Gross","Net","Rate","Commission"].map(h=><t  h key={h} style={S.th}>{h}</th>)}
21:01:24.261                   </tr></thead>
21:01:24.261                   <tbody>
21:01:24.261                     {(stub.streams||[]).map((s,i)=>(
21:01:24.261                       <tr key={i} style={{ background:i%2===0?"#111111":"#0d0d0d  " }}>
21:01:24.261                         <td style={S.td}>{new Date(s.date+"T12:00:00").toLocaleD  ateString("en-US",{month:"short",day:"numeric"})}</td>
21:01:24.261                         <td style={{ ...S.td, color:"#888" }}>{s.breakType}{s.bi  nOnly?" BIN":""}{s.sessionType?<span style={{marginLeft:5,fontSize:10,color:"#  7B9CFF"}}>{({day:"☀️",night:"🌙",weekend:"📅",event:"🎉"})[s.sessionType]||""}  </span>:""}</td>
21:01:24.261                         <td style={{ ...S.td, color:"#E8317A", fontWeight:700 }}  >{s.isEventOnly||s.gross===0?"—":fmt(s.gross)}</td>
21:01:24.261                         <td style={{ ...S.td, color:"#888" }}>{s.isEventOnly||!s  .netRev?"—":fmt(s.netRev)}</td>
21:01:24.261                         <td style={{ ...S.td, color:"#888" }}>{s.rate===-1?"🎪 E  vent":s.rate!=null?(s.rate*100).toFixed(0)+"%":"—"}</td>
21:01:24.261                         <td style={{ ...S.td, color:"#4ade80", fontWeight:900 }}  >{fmt(s.commAmt)}</td>
21:01:24.261                       </tr>
21:01:24.261                     ))}
21:01:24.261                   </tbody>
21:01:24.261                   <tfoot>
21:01:24.261                     <tr style={{ background:"#0a1a0a", borderTop:"2px solid #4ad  e8033" }}>
21:01:24.261                       <td colSpan={5} style={{ ...S.td, fontWeight:800, color:"#  F0F0F0" }}>Total ({stub.streamCount} streams)</td>
21:01:24.261                       <td style={{ ...S.td, color:"#4ade80", fontWeight:900, fon  tSize:15 }}>{fmt(stub.totalComm)}</td>
21:01:24.261                     </tr>
21:01:24.261                   </tfoot>
21:01:24.261                 </table>
21:01:24.261               </div>
21:01:24.262             )}
21:01:24.262           </div>
21:01:24.262         ))}
21:01:24.262   
21:01:24.262         {/* -- FINANCIAL OVERVIEW (Admin only) -- */}
21:01:24.262         {canSeeFinancials && (() => {
21:01:24.262           // Period filter
21:01:24.262           const now   = new Date();
21:01:24.262           function inPeriod(dateStr) {
21:01:24.262             if (!dateStr) return false;
21:01:24.262             const d = parseLocalDate(dateStr);
21:01:24.262             if (financialPeriod === "custom") {
21:01:24.262               const s = customStart ? new Date(customStart) : new Date(0);
21:01:24.262               const e = customEnd   ? new Date(customEnd+"T23:59:59") : new Date  ();
21:01:24.262               return d >= s && d <= e;
21:01:24.262             }
21:01:24.262             if (financialPeriod === "week") {
21:01:24.262               const start = new Date(now);
21:01:24.262               const day = now.getDay(); // 0=Sun,1=Mon,...6=Sat
21:01:24.262               const daysFromMonday = day === 0 ? 6 : day - 1; // Mon=0 offset
21:01:24.262               start.setDate(now.getDate() - daysFromMonday);
21:01:24.262               start.setHours(0,0,0,0);
21:01:24.262               const end = new Date(start); end.setDate(start.getDate()+6); end.s  etHours(23,59,59,999);
21:01:24.262               return d >= start && d <= end;
21:01:24.263             }
21:01:24.263             if (financialPeriod === "month")   return d.getMonth()===now.getMont  h() && d.getFullYear()===now.getFullYear();
21:01:24.263             if (financialPeriod === "quarter") {
21:01:24.263               const q = Math.floor(now.getMonth()/3);
21:01:24.263               return Math.floor(d.getMonth()/3)===q && d.getFullYear()===now.get  FullYear();
21:01:24.263             }
21:01:24.263             if (financialPeriod === "year")    return d.getFullYear()===now.getF  ullYear();
21:01:24.263             return true;
21:01:24.263           }
21:01:24.263   
21:01:24.263           const filtered = streams.filter(s => inPeriod(s.date));
21:01:24.263           const streamTotals = filtered.reduce((acc,s) => {
21:01:24.263             const c = calcStream(s);
21:01:24.263             if (c.isSingles) { acc.singlesGross += c.gross; acc.singlesComm += c  .myComm; return acc; }
21:01:24.263             const exp = (parseFloat(s.whatnotPromo)||0)+(parseFloat(s.magpros)||  0)+(parseFloat(s.packagingMaterial)||0)+(parseFloat(s.topLoaders)||0)+(parseFl  oat(s.chaserCards)||0);
21:01:24.263             const splitPct = s.splitRep ? parseFloat(s.splitPct||50)/100 : 1;
21:01:24.263             const primaryComm = s.splitRep ? c.commAmt*splitPct : c.commAmt;
21:01:24.263             const splitRepComm = s.splitRep ? c.commAmt*(1-splitPct) : 0;
21:01:24.263             const eventStaffComm = (s.eventStaff||[]).reduce((sum,_)=>sum+Math.m  in(1000,c.bazNet*0.15),0);
21:01:24.263             acc.gross    += c.gross;
21:01:24.263             acc.imc      += c.imcNet - (c.imcDirectReimb||0);
21:01:24.263             acc.comm     += (primaryComm - (c.repExpShare||0)) + splitRepComm +   eventStaffComm + (c.salesBonus||0) + (c.tips||0);
21:01:24.263             acc.baz      += c.bazNet;
21:01:24.263             acc.trueNet  += c.bazTrueNet||0;
21:01:24.263             acc.expenses += exp;
21:01:24.263             acc.imcDirectReimb += c.imcDirectReimb||0;
21:01:24.263             return acc;
21:01:24.264           }, { gross:0, imc:0, comm:0, baz:0, trueNet:0, expenses:0, imcDirectRe  imb:0, singlesGross:0, singlesComm:0 });
21:01:24.264   
21:01:24.264           // Merge historical monthly summaries into totals
21:01:24.264           const histFiltered = historicalData.filter(h => {
21:01:24.264             if (!h.yearMonth) return false;
21:01:24.264             const [y,m] = h.yearMonth.split("-").map(Number);
21:01:24.264             const d = new Date(y, m-1, 15);
21:01:24.264             return inPeriod(d.toISOString().split("T")[0]);
21:01:24.264           });
21:01:24.264           const histTotals = histFiltered.reduce((acc,h) => {
21:01:24.264             const gross   = parseFloat(h.grossRevenue)||0;
21:01:24.264             const net     = parseFloat(h.netRevenue)||0;
21:01:24.264             const reimb   = parseFloat(h.imcReimb)||0;
21:01:24.264             acc.gross    += gross;
21:01:24.264             acc.imc      += net * 0.70;
21:01:24.264             acc.baz      += net * 0.30;
21:01:24.264             acc.trueNet  += net * 0.30 + reimb; // reimbursement adds to true ne  t only
21:01:24.264             return acc;
21:01:24.264           }, { gross:0, imc:0, comm:0, baz:0, trueNet:0 });
21:01:24.264   
21:01:24.264           const totals = {
21:01:24.264             gross:         streamTotals.gross    + histTotals.gross,
21:01:24.264             imc:           streamTotals.imc      + histTotals.imc,
21:01:24.264             comm:          streamTotals.comm     + histTotals.comm,
21:01:24.264             baz:           streamTotals.baz      + histTotals.baz,
21:01:24.264             trueNet:       streamTotals.trueNet  + histTotals.trueNet,
21:01:24.265             expenses:      streamTotals.expenses || 0,
21:01:24.265             imcDirectReimb: streamTotals.imcDirectReimb || 0,
21:01:24.265             singlesGross:  streamTotals.singlesGross || 0,
21:01:24.265             singlesComm:   streamTotals.singlesComm || 0,
21:01:24.265           };
21:01:24.265   
21:01:24.265           const PERIOD_LABELS = { month:"This Month", quarter:"This Quarter", ye  ar:"This Year", all:"All Time", custom:"Custom Range" };
21:01:24.265   
21:01:24.265           // Drill-down modal content
21:01:24.265           const renderDrillDown = () => {
21:01:24.265             if (!drillDown) return null;
21:01:24.265             const config = {
21:01:24.265               gross:      { label:"Gross Revenue",       color:"#E8317A", val: s   => calcStream(s).gross },
21:01:24.265               expenses:   { label:"Stream Expenses",     color:"#991b1b", val: s   => (parseFloat(s.whatnotPromo)||0)+(parseFloat(s.magpros)||0)+(parseFloat(s.p  ackagingMaterial)||0)+(parseFloat(s.topLoaders)||0)+(parseFloat(s.chaserCards)  ||0) },
21:01:24.265               imc:        { label:"Owed to Imagination Mining (70%)", color:"#E8  317A", val: s => calcStream(s).imcNet },
21:01:24.265               commission: { label:"Commission Owed",     color:"#E8317A", val: s   => calcStream(s).commAmt },
21:01:24.265               bazooka:    { label:"Bazooka Earnings (30%)", color:"#E8317A", val  : s => calcStream(s).bazNet },
21:01:24.265               trueNet:    { label:"Bazooka True Net",      color:"#E8317A", val:   s => calcStream(s).bazTrueNet||0 },
21:01:24.265             }[drillDown];
21:01:24.265             return (
21:01:24.265               <div style={{ ...S.card, border:`1px solid #2a2a2a`, marginTop:0,   padding:0, overflow:"hidden" }}>
21:01:24.265                 <div style={{ display:"flex", alignItems:"center", justifyConten  t:"space-between", padding:"14px 20px", borderBottom:"1px solid #1a1a1a" }}>
21:01:24.265                   <SectionLabel t={config.label} />
21:01:24.265                   <button onClick={()=>setDrillDown(null)} style={{ background:"  none", border:"1px solid #2a2a2a", color:"#AAAAAA", cursor:"pointer", fontSize  :14, borderRadius:6, padding:"4px 10px", fontFamily:"inherit" }}>✕ Close</butt  on>
21:01:24.265                 </div>
21:01:24.266                 <div style={{ overflowX:"auto" }}>
21:01:24.266                   <table style={{ width:"100%", borderCollapse:"collapse", fontS  ize:13 }}>
21:01:24.266                     <thead>
21:01:24.266                       <tr style={{ borderBottom:"1px solid #2a2a2a", background:  "#0d0d0d" }}>
21:01:24.266                         {["Date","Breaker","Gross","Rate",
21:01:24.266                           ...(drillDown==="trueNet" ? ["Baz Net","− Commission",  "💙 IMC Reimb","= True Net"] : [
21:01:24.266                             drillDown==="commission"?"Commission":drillDown==="i  mc"?"IMC (70%)":drillDown==="bazooka"?"Bazooka 30%":"Gross"
21:01:24.266                           ])
21:01:24.266                         ].map(h=><th key={h} style={{ padding:"10px 14px", textA  lign:"left", fontSize:10, fontWeight:700, color:"#555", textTransform:"upperca  se", letterSpacing:1, whiteSpace:"nowrap" }}>{h}</th>)}
21:01:24.266                       </tr>
21:01:24.266                     </thead>
21:01:24.266                     <tbody>
21:01:24.266                       {filtered.length===0
21:01:24.266                         ? <EmptyRow msg={streams.length===0 ? "No streams logged   yet." : "No streams in this period."} cols={drillDown==="trueNet"?8:5}/>
21:01:24.266                         : filtered.map((s,i) => {
21:01:24.266                             const c   = calcStream(s);
21:01:24.266                             const bc  = BC[s.breaker]||{bg:"#F3F4F6",text:"#6B72  80"};
21:01:24.266                             const val = config.val(s);
21:01:24.266                             const hasReimb = (c.imcDirectReimb||0) > 0;
21:01:24.266                             return (
21:01:24.266                               <tr key={s.id} style={{ borderBottom:"1px solid #1  a1a1a", background:i%2===0?"#111":"#0d0d0d" }}>
21:01:24.266                                 <td style={{ padding:"10px 14px", color:"#888",   whiteSpace:"nowrap" }}>{new Date(s.date+"T12:00:00").toLocaleDateString("en-US  ",{month:"short",day:"numeric"})}</td>
21:01:24.266                                 <td style={{ padding:"10px 14px" }}><Badge bg={b  c.bg} color={bc.text}>{s.breaker}</Badge></td>
21:01:24.266                                 <td style={{ padding:"10px 14px", color:"#E8317A  ", fontWeight:700 }}>{fmt(c.gross)}</td>
21:01:24.266                                 <td style={{ padding:"10px 14px", color:"#AAAAAA  " }}>{(c.rate*100).toFixed(0)}%{s.isEvent?" Event":s.binOnly?" BIN":""}{s.exte  rnalChannel&&<span style={{ marginLeft:6, fontSize:10, color:"#7B9CFF", backgr  ound:"rgba(123,156,255,0.1)", border:"1px solid rgba(123,156,255,0.2)", border  Radius:4, padding:"1px 5px" }}>🌐 Ext</span>}</td>
21:01:24.267                                 {drillDown==="trueNet" ? <>
21:01:24.267                                   <td style={{ padding:"10px 14px", color:"#E831  7A", fontWeight:700 }}>{fmt(c.bazNet)}</td>
21:01:24.267                                   <td style={{ padding:"10px 14px", color:"#ef44  44" }}>−{fmt(c.commAmt)}</td>
21:01:24.267                                   <td style={{ padding:"10px 14px" }}>
21:01:24.267                                     {hasReimb ? (
21:01:24.267                                       <div>
21:01:24.267                                         <span style={{ color:"#60A5FA", fontWeig  ht:700 }}>+{fmt(c.imcDirectReimb)}</span>
21:01:24.267                                         {s.imcReimbNote && <div style={{ fontSiz  e:10, color:"#555", marginTop:2, maxWidth:140 }}>{s.imcReimbNote}</div>}
21:01:24.267                                       </div>
21:01:24.267                                     ) : <span style={{ color:"#333" }}>—</span>}                                  </td>
21:01:24.267                                   <td style={{ padding:"10px 14px", color:"#A78B  FA", fontWeight:900 }}>{fmt(c.bazTrueNet)}</td>
21:01:24.267                                 </> : <td style={{ padding:"10px 14px", color:co  nfig.color, fontWeight:900 }}>{fmt(val)}</td>}
21:01:24.267                               </tr>
21:01:24.267                             );
21:01:24.267                           })
21:01:24.267                       }
21:01:24.267                     </tbody>
21:01:24.267                     <tfoot>
21:01:24.267                       <tr style={{ background:"#0d0d0d", borderTop:"2px solid #2  a2a2a" }}>
21:01:24.267                         <td colSpan={4} style={{ padding:"12px 14px", fontWeight  :800, color:"#F0F0F0", fontSize:12 }}>Total ({filtered.length} stream{filtered  .length!==1?"s":""})</td>
21:01:24.267                         {drillDown==="trueNet" ? <>
21:01:24.267                           <td style={{ padding:"12px 14px", fontWeight:900, colo  r:"#E8317A", fontSize:14 }}>{fmt(filtered.reduce((a,s)=>a+calcStream(s).bazNet  ,0))}</td>
21:01:24.267                           <td style={{ padding:"12px 14px", fontWeight:900, colo  r:"#ef4444", fontSize:14 }}>−{fmt(filtered.reduce((a,s)=>a+calcStream(s).commA  mt,0))}</td>
21:01:24.267                           <td style={{ padding:"12px 14px", fontWeight:900, colo  r:"#60A5FA", fontSize:14 }}>{filtered.some(s=>calcStream(s).imcDirectReimb>0)   ? "+"+fmt(filtered.reduce((a,s)=>a+(calcStream(s).imcDirectReimb||0),0)) : "—"  }</td>
21:01:24.267                           <td style={{ padding:"12px 14px", fontWeight:900, colo  r:"#A78BFA", fontSize:16 }}>{fmt(filtered.reduce((a,s)=>a+(calcStream(s).bazTr  ueNet||0),0))}</td>
21:01:24.267                         </> : <td style={{ padding:"12px 14px", fontWeight:900,   color:config.color, fontSize:16 }}>{fmt(filtered.reduce((a,s)=>a+config.val(s)  ,0))}</td>}
21:01:24.267                       </tr>
21:01:24.267                     </tfoot>
21:01:24.267                   </table>
21:01:24.267                 </div>
21:01:24.267               </div>
21:01:24.267             );
21:01:24.267           };
21:01:24.267   
21:01:24.267           return (
21:01:24.267             <>
21:01:24.267             <div style={{ ...S.card, border:"2px solid #333333" }}>
21:01:24.267               <div style={{ display:"flex", alignItems:"center", justifyContent:  "space-between", marginBottom:16, flexWrap:"wrap", gap:10 }}>
21:01:24.267                 <div>
21:01:24.267                   <SectionLabel t="Financial Overview" />
21:01:24.267                   <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{PERIO  D_LABELS[financialPeriod]} · {filtered.length} stream{filtered.length!==1?"s":  ""}</div>
21:01:24.267                 </div>
21:01:24.268                 <div style={{ display:"flex", gap:4, background:"#0d0d0d", borde  rRadius:10, padding:4 }}>
21:01:24.268                   {[["month","Month"],["quarter","Quarter"],["year","Year"],["al  l","All"],["custom","Custom"]].map(([val,label]) => (
21:01:24.268                     <button key={val} onClick={()=>setFinancialPeriod(val)} styl  e={{ background:financialPeriod===val?"#1a1a1a":"transparent", color:financial  Period===val?"#E8317A":"#555", border:`1px solid ${financialPeriod===val?"#E83  17A33":"transparent"}`, borderRadius:7, padding:"5px 12px", fontSize:11, fontW  eight:700, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap", transi  tion:"all 0.15s" }}>{label}</button>
21:01:24.268                   ))}
21:01:24.268                 </div>
21:01:24.268               </div>
21:01:24.268   
21:01:24.268               {financialPeriod === "custom" && (
21:01:24.269                 <div style={{ display:"flex", gap:10, marginBottom:14, alignItem  s:"center" }}>
21:01:24.269                   <div><label style={S.lbl}>From</label><input type="date" value  ={customStart} onChange={e=>setCustomStart(e.target.value)} style={{ ...S.inp,   width:"auto" }}/></div>
21:01:24.269                   <div><label style={S.lbl}>To</label><input type="date" value={  customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{ ...S.inp, width  :"auto" }}/></div>
21:01:24.269                   <div style={{ fontSize:12, color:"#555", marginTop:14 }}>{filt  ered.length} stream{filtered.length!==1?"s":""} in range</div>
21:01:24.269                 </div>
21:01:24.269               )}
21:01:24.269   
21:01:24.269               <div className="dash-grid-5" style={{ display:"grid", gridTemplate  Columns:"repeat(6,1fr)", gap:10 }}>
21:01:24.269                 {[
21:01:24.269                   { key:"gross",      label:"Gross Revenue",      val:totals.gro  ss,    color:"#E8317A", icon:"📈", sub:"breaks only · excl. singles" },
21:01:24.269                   { key:"expenses",   label:"Stream Expenses",    val:totals.exp  enses, color:"#888",    icon:"📦", sub:"before IMC split" },
21:01:24.269                   { key:"imc",        label:"Owed to IMC",        val:totals.imc   + Object.entries(imcAdjustments).reduce((s,[mk,v])=>{ const [y,m]=mk.split("-  ").map(Number); return inPeriod(new Date(y,m-1,15).toISOString().split("T")[0]  ) ? s+(parseFloat(v)||0) : s; },0), color:"#7B9CFF", icon:"💙", sub:"70% of sp  lit base" },
21:01:24.269                   { key:"bazooka",    label:"Bazooka 30%",        val:totals.baz  ,      color:"#E8317A", icon:"🏦", sub:"before commission" },
21:01:24.269                   { key:"trueNet",    label:"True Net",           val:totals.tru  eNet - Object.entries(imcAdjustments).reduce((s,[mk,v])=>{ const [y,m]=mk.spli  t("-").map(Number); return inPeriod(new Date(y,m-1,15).toISOString().split("T"  )[0]) ? s+(parseFloat(v)||0) : s; },0), color:"#A78BFA", icon:"✨", sub:"after   all deductions" },
21:01:24.269                   { key:"commission", label:"Commission Owed",    val:totals.com  m,     color:"#4ade80", icon:"💰", sub:"net rep payout" },
21:01:24.269                   ...(totals.singlesGross>0 ? [{ key:"singles", label:"Singles R  evenue", val:totals.singlesGross, color:"#FBBF24", icon:"🃏", sub:`$${totals.s  inglesComm.toFixed(0)} to breaker · 100%` }] : []),
21:01:24.269                 ].map(({key,label,val,color,icon,sub}) => {
21:01:24.269                   const isActive = drillDown === key;
21:01:24.269                   const isPositive = val >= 0;
21:01:24.269                   return (
21:01:24.269                     <div
21:01:24.269                       key={key}
21:01:24.269                       onClick={()=>setDrillDown(isActive?null:key)}
21:01:24.269                       className="stat-card dash-fin-card"
21:01:24.269                       style={{
21:01:24.269                         background: isActive ? `${color}18` : "#111",
21:01:24.269                         border: `1.5px solid ${isActive ? color : color+"28"}`,
21:01:24.269                         borderRadius: 14,
21:01:24.269                         padding: "14px 14px 12px",
21:01:24.269                         cursor: "pointer",
21:01:24.269                         position: "relative",
21:01:24.269                         transition: "border-color 0.15s",
21:01:24.269                       }}
21:01:24.269                     >
21:01:24.269                       {/* Active indicator */}
21:01:24.269                       {isActive && <div style={{ position:"absolute", top:0, lef  t:"50%", transform:"translateX(-50%)", width:32, height:3, background:color, b  orderRadius:"0 0 4px 4px" }}/>}
21:01:24.269   
21:01:24.269                       {/* Label row */}
21:01:24.269                       <div style={{ display:"flex", alignItems:"center", justify  Content:"space-between", marginBottom:8 }}>
21:01:24.269                         <div style={{ fontSize:10, fontWeight:700, color:"#888",   textTransform:"uppercase", letterSpacing:"0.8px" }}>{label}</div>
21:01:24.269                         <div style={{ fontSize:13, opacity:0.7 }}>{icon}</div>
21:01:24.269                       </div>
21:01:24.269   
21:01:24.269                       {/* Big number */}
21:01:24.269                       <div style={{ fontSize:22, fontWeight:900, color, lineHeig  ht:1, marginBottom:6, letterSpacing:"-0.5px" }}>
21:01:24.269                         {fmt(val)}
21:01:24.269                       </div>
21:01:24.269   
21:01:24.269                       {/* Sub label */}
21:01:24.270                       <div style={{ fontSize:10, color:"#555", marginBottom:8 }}  >{sub}</div>
21:01:24.270   
21:01:24.270                       {/* Drill affordance */}
21:01:24.270                       <div style={{ display:"flex", alignItems:"center", justify  Content:"center", gap:4, background: isActive ? `${color}22` : "rgba(255,255,2  55,0.04)", borderRadius:6, padding:"4px 0" }}>
21:01:24.270                         <span style={{ fontSize:10, fontWeight:700, color: isAct  ive ? color : "#555" }}>
21:01:24.270                           {isActive ? "▲ Hide breakdown" : "▼ See breakdown"}
21:01:24.270                         </span>
21:01:24.270                       </div>
21:01:24.270                     </div>
21:01:24.270                   );
21:01:24.270                 })}
21:01:24.270               </div>
21:01:24.270   
21:01:24.270               {/* IMC Manual Adjustment — per month */}
21:01:24.270               {canSeeFinancials && (
21:01:24.270                 <div style={{marginTop:10}}>
21:01:24.270                   {!showImcAdj ? (
21:01:24.270                     <button onClick={()=>setShowImcAdj(true)} style={{background  :"none",border:"1px dashed rgba(255,255,255,0.08)",color:"#555",borderRadius:7  ,padding:"4px 12px",fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>
21:01:24.270                       ✏️ Adjust IMC by month {Object.keys(imcAdjustments).filter  (k=>parseFloat(imcAdjustments[k])).length>0?`(${Object.keys(imcAdjustments).fi  lter(k=>parseFloat(imcAdjustments[k])).length} active)`:""}
21:01:24.270                     </button>
21:01:24.270                   ) : (
21:01:24.270                     <div style={{background:"#1a1a1a",border:"1px solid #2a2a2a"  ,borderRadius:10,padding:"14px 16px"}}>
21:01:24.270                       <div style={{display:"flex",justifyContent:"space-between"  ,alignItems:"center",marginBottom:12}}>
21:01:24.270                         <span style={{fontSize:12,fontWeight:700,color:"#F0F0F0"  }}>IMC Adjustment by Month</span>
21:01:24.270                         <button onClick={()=>setShowImcAdj(false)} style={{backg  round:"none",border:"none",color:"#555",cursor:"pointer",fontSize:13,fontFamil  y:"inherit"}}>✕ Close</button>
21:01:24.270                       </div>
21:01:24.270                       <div style={{fontSize:11,color:"#555",marginBottom:10}}>En  ter the difference between the invoice amount and calculated amount. Use negat  ive to reduce.</div>
21:01:24.270                       {(() => {
21:01:24.270                         // Build list of months that have streams
21:01:24.270                         const monthsWithStreams = [...new Set(streams.filter(s=>  s.date).map(s=>s.date.slice(0,7)))].sort().reverse().slice(0,12);
21:01:24.270                         if (monthsWithStreams.length === 0) return <div style={{  fontSize:11,color:"#555"}}>No streams logged yet.</div>;
21:01:24.270                         const totalAdj = Object.values(imcAdjustments).reduce((s  ,v)=>s+(parseFloat(v)||0),0);
21:01:24.270                         return (
21:01:24.270                           <>
21:01:24.270                             <div style={{display:"flex",flexDirection:"column",g  ap:8}}>
21:01:24.270                               {monthsWithStreams.map(mk=>{
21:01:24.270                                 const [y,m] = mk.split("-");
21:01:24.270                                 const monthLabel = `${["Jan","Feb","Mar","Apr","  May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(m)-1]} ${y}`;
21:01:24.270                                 const adj = imcAdjustments[mk]||"";
21:01:24.270                                 const adjNum = parseFloat(adj)||0;
21:01:24.270                                 // Calc IMC for this month from streams
21:01:24.270                                 const monthStreams = streams.filter(s=>s.date&&s  .date.startsWith(mk));
21:01:24.270                                 const calcImc = monthStreams.reduce((s,str)=>{ c  onst c=calcStreamDash(str); return s + c.imcNet - (c.imcDirectReimb||0); },0);                                return (
21:01:24.270                                   <div key={mk} style={{display:"grid",gridTempl  ateColumns:"100px 1fr 1fr auto",gap:8,alignItems:"center"}}>
21:01:24.270                                     <span style={{fontSize:12,fontWeight:700,col  or:"#F0F0F0"}}>{monthLabel}</span>
21:01:24.270                                     <span style={{fontSize:11,color:"#555"}}>Cal  c: <strong style={{color:"#888"}}>{fmt(calcImc)}</strong></span>
21:01:24.270                                     <div style={{display:"flex",alignItems:"cent  er",gap:6}}>
21:01:24.270                                       <span style={{fontSize:11,color:"#555"}}>A  dj:</span>
21:01:24.270                                       <input type="number" step="0.01" value={ad  j}
21:01:24.271                                         onChange={e=>updateImcAdj(mk, e.target.v  alue)}
21:01:24.271                                         placeholder="0.00"
21:01:24.271                                         style={{background:"#111",border:`1px so  lid ${adjNum?"rgba(251,191,36,0.4)":"#2a2a2a"}`,borderRadius:6,color:adjNum?"#  FBBF24":"#F0F0F0",padding:"4px 8px",fontSize:12,fontFamily:"inherit",outline:"  none",width:100}}/>
21:01:24.271                                     </div>
21:01:24.271                                     <span style={{fontSize:11,fontWeight:700,col  or:adjNum?"#FBBF24":"#333"}}>
21:01:24.271                                       {adjNum ? `→ ${fmt(calcImc+adjNum)}` : ""}                                    </span>
21:01:24.271                                   </div>
21:01:24.271                                 );
21:01:24.271                               })}
21:01:24.271                             </div>
21:01:24.271                             {totalAdj !== 0 && (
21:01:24.271                               <div style={{marginTop:10,padding:"8px 12px",backg  round:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",borderRa  dius:7,fontSize:12,color:"#FBBF24",fontWeight:700}}>
21:01:24.271                                 Total adjustment (all months): {totalAdj>0?"+":"  "}{fmt(totalAdj)}
21:01:24.271                               </div>
21:01:24.271                             )}
21:01:24.271                             <button onClick={()=>clearImcAdj()} style={{marginTo  p:8,background:"none",border:"none",color:"#555",cursor:"pointer",fontSize:11,  fontFamily:"inherit"}}>✕ Clear all adjustments</button>
21:01:24.271                           </>
21:01:24.271                         );
21:01:24.271                       })()}
21:01:24.271                     </div>
21:01:24.271                   )}
21:01:24.271                 </div>
21:01:24.271               )}
21:01:24.271             </div>
21:01:24.271             {drillDown && <div className="drill-down">{renderDrillDown()}</div>}            </>
21:01:24.271           );
21:01:24.271         })()}
21:01:24.271   
21:01:24.271         {/* Ops Summary */}
21:01:24.271         {canSeeFinancials && (() => {
21:01:24.271           function opsInPeriod(dateStr) {
21:01:24.271             if (!dateStr) return false;
21:01:24.271             const d = parseLocalDate(dateStr);
21:01:24.271             const now = new Date();
21:01:24.271             if (opsPeriod==="month")   return d.getMonth()===now.getMonth()&&d.g  etFullYear()===now.getFullYear();
21:01:24.271             if (opsPeriod==="quarter") { const q=Math.floor(now.getMonth()/3); r  eturn Math.floor(d.getMonth()/3)===q&&d.getFullYear()===now.getFullYear(); }
21:01:24.271             if (opsPeriod==="year")    return d.getFullYear()===now.getFullYear(  );
21:01:24.271             if (opsPeriod==="custom"&&opsFrom&&opsTo) { const f=new Date(opsFrom  +"T00:00:00"),t=new Date(opsTo+"T23:59:59"); return d>=f&&d<=t; }
21:01:24.271             return true;
21:01:24.271           }
21:01:24.271   
21:01:24.271           const periodStreams = streams.filter(s => opsInPeriod(s.date));
21:01:24.271   
21:01:24.271           const totMagpros  = periodStreams.reduce((s,r)=>s+(parseFloat(r.magpro  s)||0),0);
21:01:24.272           const totPack     = periodStreams.reduce((s,r)=>s+(parseFloat(r.packag  ingMaterial)||0),0);
21:01:24.272           const totTopload  = periodStreams.reduce((s,r)=>s+(parseFloat(r.topLoa  ders)||0),0);
21:01:24.272           const totChaser   = periodStreams.reduce((s,r)=>s+(parseFloat(r.chaser  Cards)||0),0);
21:01:24.272           const totMagQty   = periodStreams.reduce((s,r)=>s+(parseInt(r.magprosQ  ty)||0),0);
21:01:24.272           const totPackQty  = periodStreams.reduce((s,r)=>s+(parseInt(r.packagin  gQty)||0),0);
21:01:24.272           const totTopQty   = periodStreams.reduce((s,r)=>s+(parseInt(r.topLoade  rsQty)||0),0);
21:01:24.272           const totZion     = periodStreams.reduce((s,r)=>s+(parseFloat(r.zionRe  venue)||0),0);
21:01:24.272           const totCoupons  = periodStreams.reduce((s,r)=>s+(parseFloat(r.coupon  s)||0),0);
21:01:24.272   
21:01:24.272           // Card usage costs by type
21:01:24.272           const USAGE_TO_CT_OPS = { "Giveaway":"Giveaway Cards", "Insurance":"In  surance Cards", "First-Timer Pack":"First-Timer Cards", "Chaser Pull":"Chaser   Cards", "Chaser":"Chaser Cards" };
21:01:24.272           const cardCostByType = {};
21:01:24.272           const cardQtyByType  = {};
21:01:24.272           const cardRowsByType = {};
21:01:24.272           CARD_TYPES.forEach(ct => { cardCostByType[ct]=0; cardQtyByType[ct]=0;   cardRowsByType[ct]=[]; });
21:01:24.272           breaks.forEach(b => {
21:01:24.272             const ct = USAGE_TO_CT_OPS[b.usage] || b.cardType;
21:01:24.272             if (!ct || !CARD_TYPES.includes(ct)) return;
21:01:24.272             const breakDate = b.date || (b.dateAdded ? b.dateAdded.split("T")[0]   : null);
21:01:24.272             if (!opsInPeriod(breakDate)) return;
21:01:24.272             const inv  = b.isPoolLog ? null : inventory.find(c => c.id === b.inv  entoryId);
21:01:24.272             const cost = inv?.costPerCard || 0;
21:01:24.272             const qty  = b.isPoolLog ? (parseInt(b.qty)||1) : 1;
21:01:24.272             cardCostByType[ct] += cost * qty;
21:01:24.272             cardQtyByType[ct]  += qty;
21:01:24.272             cardRowsByType[ct].push({
21:01:24.272               date: breakDate||"",
21:01:24.272               cardName: inv?.cardName || b.cardName || "Unknown",
21:01:24.272               usage: b.usage || ct,
21:01:24.272               qty,
21:01:24.272               costPerCard: cost,
21:01:24.272               totalCost: cost*qty,
21:01:24.272               streamId: b.streamId||"",
21:01:24.272             });
21:01:24.272           });
21:01:24.272   
21:01:24.272           function exportCardCSV(ct) {
21:01:24.272             const rows = cardRowsByType[ct];
21:01:24.272             if (!rows.length) return;
21:01:24.272             const header = "Date,Card Name,Usage Type,Qty,Cost Per Card,Total Co  st,Stream ID\n";
21:01:24.272             const body   = rows.map(r=>`${r.date},"${r.cardName}","${r.usage}",$  {r.qty},${r.costPerCard.toFixed(2)},${r.totalCost.toFixed(2)},${r.streamId}`).  join("\n");
21:01:24.272             const blob   = new Blob([header+body], { type:"text/csv" });
21:01:24.272             const a      = document.createElement("a");
21:01:24.272             a.href       = URL.createObjectURL(blob);
21:01:24.273             a.download   = `${ct.replace(" ","_")}_usage_${opsPeriod}.csv`;
21:01:24.273             a.click();
21:01:24.273           }
21:01:24.273   
21:01:24.273           function exportAllCardsCSV() {
21:01:24.273             const header = "Date,Card Name,Card Type,Usage Type,Qty,Cost Per Car  d,Total Cost,Stream ID\n";
21:01:24.273             const allRows = CARD_TYPES.flatMap(ct => cardRowsByType[ct].map(r=>(  {...r, cardType:ct})));
21:01:24.273             allRows.sort((a,b)=>a.date.localeCompare(b.date));
21:01:24.273             const body = allRows.map(r=>`${r.date},"${r.cardName}","${r.cardType  }","${r.usage}",${r.qty},${r.costPerCard.toFixed(2)},${r.totalCost.toFixed(2)}  ,${r.streamId}`).join("\n");
21:01:24.273             const blob = new Blob([header+body], { type:"text/csv" });
21:01:24.273             const a    = document.createElement("a");
21:01:24.273             a.href     = URL.createObjectURL(blob);
21:01:24.273             a.download = `all_cards_used_${opsPeriod}.csv`;
21:01:24.273             a.click();
21:01:24.273           }
21:01:24.273   
21:01:24.273           const periodLabel = opsPeriod==="month"?"This Month":opsPeriod==="quar  ter"?"This Quarter":opsPeriod==="year"?"This Year":opsPeriod==="custom"&&opsFr  om&&opsTo?`${opsFrom} → ${opsTo}`:"All Time";
21:01:24.273           const totalCardCost = CARD_TYPES.reduce((s,ct)=>s+cardCostByType[ct],0  );
21:01:24.273           const totalCardQty  = CARD_TYPES.reduce((s,ct)=>s+cardQtyByType[ct],0)  ;
21:01:24.273   
21:01:24.273           return (
21:01:24.273             <div style={{ ...S.card }}>
21:01:24.273               {/* Header + period filter */}
21:01:24.273               <div style={{ display:"flex", alignItems:"center", justifyContent:  "space-between", flexWrap:"wrap", gap:10, marginBottom:14 }}>
21:01:24.273                 <SectionLabel t="📦 Ops Summary" />
21:01:24.273                 <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems  :"center" }}>
21:01:24.273                   {[["month","Month"],["quarter","Quarter"],["year","Year"],["al  l","All Time"],["custom","Custom"]].map(([v,l])=>(
21:01:24.273                     <button key={v} onClick={()=>setOpsPeriod(v)}
21:01:24.273                       style={{ background:opsPeriod===v?"rgba(232,49,122,0.15)":  "transparent", border:`1px solid ${opsPeriod===v?"#E8317A":"#2a2a2a"}`, color:  opsPeriod===v?"#E8317A":"#888", borderRadius:16, padding:"4px 12px", fontSize:  11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
21:01:24.273                       {l}
21:01:24.273                     </button>
21:01:24.273                   ))}
21:01:24.273                 </div>
21:01:24.273               </div>
21:01:24.274               {opsPeriod==="custom" && (
21:01:24.274                 <div style={{ display:"flex", gap:8, marginBottom:12, alignItems  :"center" }}>
21:01:24.274                   <input type="date" value={opsFrom} onChange={e=>setOpsFrom(e.t  arget.value)} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borde  rRadius:7, color:"#F0F0F0", padding:"6px 10px", fontSize:12, fontFamily:"inher  it" }}/>
21:01:24.274                   <span style={{ color:"#555" }}>to</span>
21:01:24.274                   <input type="date" value={opsTo} onChange={e=>setOpsTo(e.targe  t.value)} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRad  ius:7, color:"#F0F0F0", padding:"6px 10px", fontSize:12, fontFamily:"inherit"   }}/>
21:01:24.274                 </div>
21:01:24.274               )}
21:01:24.274   
21:01:24.274               {/* Supplies */}
21:01:24.274               <div style={{ fontSize:10, color:"#555", fontWeight:700, textTrans  form:"uppercase", letterSpacing:1, marginBottom:8 }}>Supplies — {periodLabel}<  /div>
21:01:24.274               <div className="dash-grid-4" style={{ display:"grid", gridTemplate  Columns:"repeat(4,1fr)", gap:10 }}>
21:01:24.274                 {[
21:01:24.274                   { l:"MagPros",       v:`$${totMagpros.toFixed(2)}`,  sub:totMa  gQty>0?`${totMagQty} units`:"",  c:"#7B9CFF" },
21:01:24.274                   { l:"Packaging",     v:`$${totPack.toFixed(2)}`,     sub:totPa  ckQty>0?`${totPackQty} units`:"", c:"#7B9CFF" },
21:01:24.274                   { l:"Top Loaders",   v:`$${totTopload.toFixed(2)}`,  sub:totTo  pQty>0?`${totTopQty} units`:"",  c:"#7B9CFF" },
21:01:24.274                   { l:"Chaser Cards",  v:`$${totChaser.toFixed(2)}`,   sub:"",                                      c:"#E8317A" },
21:01:24.274                   { l:"Coupons Given", v:`$${totCoupons.toFixed(2)}`,  sub:"",                                      c:"#FBBF24" },
21:01:24.275                   { l:"🟢 Zion Cases", v:totZion>0?`$${totZion.toFixed(2)}`:"--"  , sub:totZion>0?`~${Math.round(totZion/3)} units`:"Bazooka-only", c:"#4ade80"   },
21:01:24.275                 ].map(({l,v,sub,c}) => (
21:01:24.275                   <div key={l} style={{ background:"#1a1a1a", borderRadius:8, pa  dding:"12px 14px", border:"1px solid #2a2a2a" }}>
21:01:24.275                     <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}</d  iv>
21:01:24.275                     <div style={{ fontSize:11, color:"#888", marginTop:2 }}>{l}<  /div>
21:01:24.275                     {sub && <div style={{ fontSize:10, color:"#555", marginTop:2   }}>{sub}</div>}
21:01:24.275                   </div>
21:01:24.275                 ))}
21:01:24.275               </div>
21:01:24.275   
21:01:24.275               {/* Card usage by type with export */}
21:01:24.275               <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #1  a1a1a" }}>
21:01:24.276                 <div style={{ display:"flex", alignItems:"center", justifyConten  t:"space-between", marginBottom:10, flexWrap:"wrap", gap:8 }}>
21:01:24.276                   <div style={{ fontSize:10, color:"#555", fontWeight:700, textT  ransform:"uppercase", letterSpacing:1 }}>Cards Used — {periodLabel}</div>
21:01:24.276                   {totalCardQty > 0 && (
21:01:24.276                     <button onClick={exportAllCardsCSV}
21:01:24.276                       style={{ background:"rgba(74,222,128,0.1)", border:"1px so  lid rgba(74,222,128,0.3)", color:"#4ade80", borderRadius:8, padding:"5px 12px"  , fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
21:01:24.276                       ⬇ Export All ({totalCardQty} cards) CSV
21:01:24.276                     </button>
21:01:24.276                   )}
21:01:24.276                 </div>
21:01:24.276                 <div className="dash-grid-4" style={{ display:"grid", gridTempla  teColumns:"repeat(4,1fr)", gap:10 }}>
21:01:24.276                   {CARD_TYPES.map(ct => {
21:01:24.276                     const cc  = CC[ct]||{ text:"#888", bg:"#111" };
21:01:24.276                     const qty  = cardQtyByType[ct]||0;
21:01:24.276                     const cost = cardCostByType[ct]||0;
21:01:24.276                     return (
21:01:24.276                       <div key={ct} style={{ background:"#1a1a1a", borderRadius:  8, padding:"12px 14px", border:"1px solid #2a2a2a" }}>
21:01:24.276                         <div style={{ fontSize:18, fontWeight:900, color:cc.text   }}>{qty}</div>
21:01:24.276                         <div style={{ fontSize:11, color:"#888", marginTop:2 }}>  {ct.replace(" Cards","")}</div>
21:01:24.276                         {cost>0 && <div style={{ fontSize:10, color:"#555", marg  inTop:2 }}>${cost.toFixed(2)} cost</div>}
21:01:24.276                         {qty>0 && (
21:01:24.276                           <button onClick={()=>exportCardCSV(ct)}
21:01:24.276                             style={{ marginTop:6, background:"transparent", bord  er:"1px solid #2a2a2a", color:"#555", borderRadius:6, padding:"3px 8px", fontS  ize:10, cursor:"pointer", fontFamily:"inherit", width:"100%" }}>
21:01:24.276                             ⬇ Export CSV
21:01:24.276                           </button>
21:01:24.276                         )}
21:01:24.276                       </div>
21:01:24.276                     );
21:01:24.276                   })}
21:01:24.276                 </div>
21:01:24.276                 {totalCardCost > 0 && (
21:01:24.276                   <div style={{ marginTop:8, textAlign:"right", fontSize:12, col  or:"#555" }}>
21:01:24.276                     Total card cost: <strong style={{ color:"#F0F0F0" }}>${total  CardCost.toFixed(2)}</strong>
21:01:24.276                   </div>
21:01:24.276                 )}
21:01:24.276               </div>
21:01:24.276             </div>
21:01:24.276           );
21:01:24.276         })()}
21:01:24.276   
21:01:24.276         {/* Year-End Projections */}
21:01:24.276         {canSeeFinancials && (() => {
21:01:24.276           const now = new Date();
21:01:24.276           const dayOfYear  = Math.floor((now - new Date(now.getFullYear(),0,0))   / 86400000);
21:01:24.276           const daysInYear = 365;
21:01:24.276           const ytdStreams  = streams.filter(s => new Date(s.date+"T12:00:00").g  etFullYear()===now.getFullYear());
21:01:24.276           const skippedStreams = streams.filter(s => !s.date || new Date(s.date+  "T12:00:00").getFullYear()!==now.getFullYear());
21:01:24.277           const ytdHist    = historicalData.filter(h => h.yearMonth?.startsWith(  String(now.getFullYear())));
21:01:24.277           const ytdGross   = ytdStreams.reduce((sum,s) => sum+(parseFloat(s.gros  sRevenue)||0), 0)
21:01:24.277                            + ytdHist.reduce((sum,h) => sum+(parseFloat(h.grossRe  venue)||0), 0);
21:01:24.277           const ytdNet     = ytdStreams.reduce((sum,s) => sum+(parseFloat(calcSt  reamDash(s).netRev)||0), 0)
21:01:24.277                            + ytdHist.reduce((sum,h) => sum+(parseFloat(h.netReve  nue)||0), 0);
21:01:24.277           const ytdBaz     = ytdStreams.reduce((sum,s) => sum+calcStreamDash(s).  bazNet, 0)
21:01:24.277                            + ytdHist.reduce((sum,h) => sum+(parseFloat(h.netReve  nue)||0)*0.30, 0);
21:01:24.277           const ytdTrueNet  = ytdStreams.reduce((sum,s) => sum+calcStreamDash(s)  .bazTrueNet, 0)
21:01:24.277                            + ytdHist.reduce((sum,h) => sum+(parseFloat(h.netReve  nue)||0)*0.30-(parseFloat(h.commPaid)||0)+(parseFloat(h.imcReimb)||0), 0);
21:01:24.277           const ytdNewBuyers = ytdStreams.reduce((sum,s) => sum+(parseInt(s.newB  uyers)||0), 0)
21:01:24.277                            + ytdHist.reduce((sum,h) => sum+(parseInt(h.newBuyers  )||0), 0);
21:01:24.277           if (ytdStreams.length === 0 && ytdHist.length === 0) return null;
21:01:24.277           const pct  = Math.round(dayOfYear / daysInYear * 100);
21:01:24.277           // Project based on weekly stream pace, not raw days elapsed
21:01:24.277           const weeksElapsed = Math.max(1, dayOfYear / 7);
21:01:24.277           const weeksInYear  = 52;
21:01:24.277           const proj = v => weeksElapsed > 0 ? v / weeksElapsed * weeksInYear :   0;
21:01:24.277   
21:01:24.277           function saveGoals() {
21:01:24.277             setGoals(goalForm);
21:01:24.277             try { localStorage.setItem(GOAL_KEY, JSON.stringify(goalForm)); } ca  tch(e) {}
21:01:24.277             setEditGoals(false);
21:01:24.277           }
21:01:24.277   
21:01:24.277           const metrics = [
21:01:24.277             { key:"gross",    l:"Gross Revenue",    v:proj(ytdGross),    ytd:ytd  Gross,    c:"#E8317A" },
21:01:24.277             { key:"net",      l:"Net Revenue",       v:proj(ytdNet),      ytd:yt  dNet,      c:"#7B9CFF" },
21:01:24.277             { key:"baz",      l:"Bazooka Earnings",  v:proj(ytdBaz),      ytd:yt  dBaz,      c:"#6B2D8B" },
21:01:24.277             { key:"trueNet",  l:"Bazooka True Net",  v:proj(ytdTrueNet),  ytd:yt  dTrueNet,  c:"#4ade80" },
21:01:24.277             { key:"buyers",   l:"New Buyers",        v:proj(ytdNewBuyers),ytd:yt  dNewBuyers,c:"#FBBF24", count:true },
21:01:24.277           ];
21:01:24.277   
21:01:24.277           return (
21:01:24.277             <div style={{ background:"#111111", border:"1px solid #E8317A33", bo  rderRadius:14, padding:"18px 20px" }}>
21:01:24.277               <div style={{ display:"flex", alignItems:"center", justifyContent:  "space-between", marginBottom:14, flexWrap:"wrap", gap:6 }}>
21:01:24.277                 <div style={{ fontSize:10, fontWeight:800, color:"#E8317A", text  Transform:"uppercase", letterSpacing:2.5, display:"flex", alignItems:"center",   gap:8 }}>
21:01:24.277                   <div style={{ width:14, height:2, background:"#E8317A", border  Radius:1, boxShadow:"0 0 8px rgba(232,49,122,0.6)" }}/>
21:01:24.277                   📈 {now.getFullYear()} Year-End Projections
21:01:24.277                 </div>
21:01:24.277                 <div style={{ display:"flex", gap:8, alignItems:"center" }}>
21:01:24.277                   <span style={{ fontSize:11, color:"#AAAAAA" }}>
21:01:24.277                     {ytdStreams.length} stream{ytdStreams.length!==1?"s":""}
21:01:24.277                     {ytdHist.length>0 ? ` + ${ytdHist.length} historical` : ""}   · {pct}% through {now.getFullYear()}
21:01:24.277                     {skippedStreams.length>0 && <span style={{color:"#FBBF24",ma  rginLeft:6}}>⚠ {skippedStreams.length} streams excluded (wrong/missing date)</  span>}
21:01:24.277                   </span>
21:01:24.277                   <button onClick={()=>{ setGoalForm(goals); setEditGoals(p=>!p)  ; }}
21:01:24.277                     style={{ background:"transparent", border:"1px solid #333",   color:"#555", borderRadius:7, padding:"3px 10px", fontSize:11, cursor:"pointer  ", fontFamily:"inherit" }}>
21:01:24.277                     {editGoals ? "Cancel" : "🎯 Set Goals"}
21:01:24.277                   </button>
21:01:24.277                 </div>
21:01:24.277               </div>
21:01:24.277   
21:01:24.277               {/* Month-by-month gross breakdown */}
21:01:24.277               {(() => {
21:01:24.277                 const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","A  ug","Sep","Oct","Nov","Dec"];
21:01:24.278                 const monthData = monthNames.map((label,i) => {
21:01:24.278                   const key = `${now.getFullYear()}-${String(i+1).padStart(2,"0"  )}`;
21:01:24.278                   const streamGross = streams
21:01:24.278                     .filter(s => (s.date||"").startsWith(key))
21:01:24.278                     .reduce((s,r)=>s+(parseFloat(r.grossRevenue)||0),0);
21:01:24.278                   const histGross = historicalData
21:01:24.278                     .filter(h => h.yearMonth===key)
21:01:24.278                     .reduce((s,h)=>s+(parseFloat(h.grossRevenue)||0),0);
21:01:24.278                   const total = streamGross + histGross;
21:01:24.278                   const streamCount = streams.filter(s=>(s.date||"").startsWith(  key)).length;
21:01:24.278                   return { label, key, total, streamCount, isFuture: i > now.get  Month() };
21:01:24.278                 });
21:01:24.278                 const maxMonth = Math.max(...monthData.map(m=>m.total), 1);
21:01:24.278                 return (
21:01:24.278                   <div style={{marginBottom:16,background:"#0d0d0d",borderRadius  :10,padding:"14px 16px"}}>
21:01:24.278                     <div style={{fontSize:10,color:"#555",textTransform:"upperca  se",letterSpacing:1,marginBottom:10,fontWeight:700}}>Gross Revenue by Month</d  iv>
21:01:24.278                     <div style={{display:"flex",gap:4,alignItems:"flex-end",heig  ht:80}}>
21:01:24.278                       {monthData.map(m=>(
21:01:24.278                         <div key={m.key} style={{flex:1,display:"flex",flexDirec  tion:"column",alignItems:"center",gap:2}}>
21:01:24.278                           <div style={{width:"100%",height:64,display:"flex",ali  gnItems:"flex-end"}}>
21:01:24.278                             <div style={{
21:01:24.278                               width:"100%",
21:01:24.278                               height:m.total>0?`${Math.max((m.total/maxMonth)*64  ,3)}px`:"2px",
21:01:24.278                               background:m.isFuture?"#1a1a1a":m.total===0&&!m.is  Future?"rgba(239,68,68,0.4)":"#E8317A",
21:01:24.278                               borderRadius:"2px 2px 0 0",
21:01:24.278                               position:"relative",
21:01:24.278                               cursor:"default",
21:01:24.278                             }} title={`${m.label}: $${Math.round(m.total).toLoca  leString()} (${m.streamCount} streams)`}/>
21:01:24.278                           </div>
21:01:24.278                           <div style={{fontSize:9,color:m.total===0&&!m.isFuture  ?"#ef4444":"#555",fontWeight:m.total===0&&!m.isFuture?700:400}}>{m.label}</div  >
21:01:24.278                           {m.total>0&&<div style={{fontSize:8,color:"#333"}}>${m  .total>=1000?`${(m.total/1000).toFixed(0)}k`:Math.round(m.total)}</div>}
21:01:24.278                           {m.total===0&&!m.isFuture&&<div style={{fontSize:8,col  or:"#ef4444"}}>⚠ $0</div>}
21:01:24.278                         </div>
21:01:24.278                       ))}
21:01:24.278                     </div>
21:01:24.278                   </div>
21:01:24.278                 );
21:01:24.278               })()}
21:01:24.278   
21:01:24.278               {/* Goal editor */}
21:01:24.278               {editGoals && (
21:01:24.278                 <div style={{ background:"#0a0a0a", border:"1px solid #222", bor  derRadius:10, padding:"14px 16px", marginBottom:14 }}>
21:01:24.278                   <div style={{ fontSize:11, fontWeight:700, color:"#555", textT  ransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Set {now.getFullYear  ()} Goals</div>
21:01:24.278                   <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1f  r)", gap:10, marginBottom:12 }}>
21:01:24.278                     {metrics.map(({key,l})=>(
21:01:24.278                       <div key={key}>
21:01:24.278                         <label style={{ fontSize:10, fontWeight:700, color:"#444  ", textTransform:"uppercase", letterSpacing:1, display:"block", marginBottom:4   }}>{l}</label>
21:01:24.278                         <input type="number" value={goalForm[key]||""} onChange=  {e=>setGoalForm(p=>({...p,[key]:e.target.value}))}
21:01:24.278                           placeholder="0" style={{ background:"#111", border:"1p  x solid #2a2a2a", borderRadius:7, color:"#F0F0F0", padding:"7px 10px", fontSiz  e:12, fontFamily:"inherit", outline:"none", width:"100%", boxSizing:"border-bo  x" }}/>
21:01:24.278                       </div>
21:01:24.278                     ))}
21:01:24.278                   </div>
21:01:24.278                   <button onClick={saveGoals} style={{ background:"#166534", col  or:"#fff", border:"none", borderRadius:8, padding:"7px 20px", fontSize:12, fon  tWeight:700, cursor:"pointer", fontFamily:"inherit" }}>💾 Save Goals</button>
21:01:24.278                 </div>
21:01:24.278               )}
21:01:24.278   
21:01:24.278               {/* Metric tiles */}
21:01:24.278               <div className="dash-grid-5" style={{ display:"grid", gridTemplate  Columns:"repeat(5,1fr)", gap:12, marginBottom:14 }}>
21:01:24.278                 {metrics.map(({key,l,v,ytd,c,count}) => {
21:01:24.278                   const goal = parseFloat(goals[key]) || 0;
21:01:24.279                   const projPct = goal > 0 ? Math.min(100, v/goal*100) : 0;
21:01:24.279                   const ytdPct  = goal > 0 ? Math.min(100, ytd/goal*100) : 0;
21:01:24.279                   const onTrack = goal > 0 && v >= goal;
21:01:24.279                   return (
21:01:24.279                     <div key={l} style={{ textAlign:"center" }}>
21:01:24.279                       <div style={{ fontSize:20, fontWeight:900, color:onTrack?"  #4ade80":c }}>{count ? Math.round(v).toLocaleString() : fmt(v)}</div>
21:01:24.279                       <div style={{ fontSize:9, color:"#AAAAAA", textTransform:"  uppercase", letterSpacing:1, marginTop:4 }}>{l}</div>
21:01:24.279                       <div style={{ fontSize:10, color:"#555", marginTop:3 }}>{c  ount ? Math.round(ytd).toLocaleString() : fmt(ytd)} YTD</div>
21:01:24.279                       {goal > 0 && (
21:01:24.279                         <>
21:01:24.279                           <div style={{ fontSize:10, color:onTrack?"#4ade80":"#5  55", marginTop:3, fontWeight:700 }}>
21:01:24.279                             {onTrack ? "✅ On track" : `${projPct.toFixed(0)}% of   goal`}
21:01:24.279                           </div>
21:01:24.279                           <div style={{ height:3, background:"#1a1a1a", borderRa  dius:2, marginTop:5, overflow:"hidden" }}>
21:01:24.279                             <div style={{ height:"100%", width:`${ytdPct}%`, bac  kground:onTrack?"#4ade80":c, borderRadius:2, transition:"width 0.6s ease" }}/>                          </div>
21:01:24.279                           <div style={{ fontSize:9, color:"#444", marginTop:2 }}  >
21:01:24.279                             {count ? Math.round(goal).toLocaleString() : fmt(goa  l)} goal
21:01:24.279                           </div>
21:01:24.279                         </>
21:01:24.279                       )}
21:01:24.279                     </div>
21:01:24.279                   );
21:01:24.279                 })}
21:01:24.279               </div>
21:01:24.279   
21:01:24.279               {/* Year progress bar */}
21:01:24.279               <div style={{ height:6, background:"#1a1a1a", borderRadius:10, ove  rflow:"hidden" }}>
21:01:24.279                 <div style={{ height:"100%", width:`${pct}%`, background:"linear  -gradient(90deg,#E8317A,#6B2D8B)", borderRadius:10, transition:"width 0.6s eas  e" }}/>
21:01:24.279               </div>
21:01:24.279               <div style={{ display:"flex", justifyContent:"space-between", marg  inTop:4 }}>
21:01:24.279                 <span style={{ fontSize:10, color:"#555" }}>Jan 1</span>
21:01:24.279                 <span style={{ fontSize:10, color:"#E8317A", fontWeight:700 }}>T  oday ({pct}%)</span>
21:01:24.279                 <span style={{ fontSize:10, color:"#555" }}>Dec 31</span>
21:01:24.279               </div>
21:01:24.279             </div>
21:01:24.279           );
21:01:24.279         })()}
21:01:24.279   
21:01:24.280         <div style={{ ...S.card, border: alerts.length > 0 ? "2px solid #FCA5A5"   : "2px solid #D6F4E3" }}>
21:01:24.280           <div style={{ display:"flex", alignItems:"center", justifyContent:"spa  ce-between", marginBottom:16 }}>
21:01:24.280             <SectionLabel t="Inventory Health Check" />
21:01:24.280             <span style={{ fontSize:12, fontWeight:700, padding:"4px 12px", bord  erRadius:20, background:alerts.length===0?"#D6F4E3":alerts.length<=2?"#FFF9DB"  :"#FEE2E2", color:alerts.length===0?"#166534":alerts.length<=2?"#92400e":"#991  b1b" }}>
21:01:24.280               {alerts.length===0 ? "✅ All Good" : `🚨 ${alerts.length} Critical`  }
21:01:24.280             </span>
21:01:24.280           </div>
21:01:24.280   
21:01:24.280           {/* Top KPIs — what you have */}
21:01:24.280           <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap  :10, marginBottom:16 }}>
21:01:24.280             {[
21:01:24.280               { l:"Available Now", v:availCount,              c:"#4ade80" },
21:01:24.280               { l:"In Transit",    v:transitCount,             c:"#7B9CFF" },
21:01:24.280               { l:"Total Stock",   v:availCount + transitCount, c:"#F0F0F0" },
21:01:24.280             ].map(({l,v,c}) => (
21:01:24.280               <div key={l} style={{ background:"#111111", border:"1px solid #2a2  a2a", borderRadius:10, padding:"14px 16px", textAlign:"center" }}>
21:01:24.280                 <div style={{ fontSize:26, fontWeight:900, color:c, marginBottom  :2 }}>{v}</div>
21:01:24.280                 <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"upper  case", letterSpacing:1 }}>{l}</div>
21:01:24.280               </div>
21:01:24.280             ))}
21:01:24.280           </div>
21:01:24.280   
21:01:24.280           {/* Per card type — simplified */}
21:01:24.280           <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
21:01:24.280             {CARD_TYPES.map(ct => {
21:01:24.280               const cc = CC[ct];
21:01:24.280               const avail   = stats[ct].avail;
21:01:24.280               const transit = stats[ct].inTransit;
21:01:24.280               const target  = TARGETS[ct].buffer;
21:01:24.280               const days    = runway[ct];
21:01:24.280               const pct     = Math.min(avail / Math.max(target, 1), 1);
21:01:24.280               const status  = avail === 0 ? { label:"❌ Out", color:"#991b1b", bg  :"#FEE2E2" }
21:01:24.280                             : avail < target ? { label:"⚠️ Low", color:"#92400e"  , bg:"#FFF9DB" }
21:01:24.280                             : { label:"✅ Good", color:"#166534", bg:"#D6F4E3" };              const runLabel = days >= 999 ? null : days <= 0 ? "Overdue" : `~${  days}d left`;
21:01:24.280   
21:01:24.280               return (
21:01:24.281                 <div key={ct} style={{ background:"#111111", border:`1px solid $  {avail < target ? (avail===0?"rgba(153,27,27,0.4)":"rgba(146,64,14,0.3)") : "#  2a2a2a"}`, borderRadius:10, padding:"12px 16px" }}>
21:01:24.281                   <div style={{ display:"flex", alignItems:"center", gap:12, mar  ginBottom:8 }}>
21:01:24.281                     <span style={{ fontWeight:800, color:cc.text, fontSize:14, f  lex:1 }}>{ct}</span>
21:01:24.281                     {/* Available count — the main number */}
21:01:24.281                     <div style={{ textAlign:"center", minWidth:60 }}>
21:01:24.281                       <div style={{ fontSize:22, fontWeight:900, color:avail===0  ?"#991b1b":avail<target?"#FBBF24":"#4ade80" }}>{avail}</div>
21:01:24.281                       <div style={{ fontSize:9, color:"#555", textTransform:"upp  ercase", letterSpacing:1 }}>Available</div>
21:01:24.281                     </div>
21:01:24.281                     {transit > 0 && (
21:01:24.281                       <div style={{ textAlign:"center", minWidth:50 }}>
21:01:24.281                         <div style={{ fontSize:18, fontWeight:700, color:"#7B9CF  F" }}>{transit}</div>
21:01:24.281                         <div style={{ fontSize:9, color:"#555", textTransform:"u  ppercase", letterSpacing:1 }}>Coming</div>
21:01:24.281                       </div>
21:01:24.281                     )}
21:01:24.281                     <div style={{ textAlign:"center", minWidth:50 }}>
21:01:24.282                       <div style={{ fontSize:14, fontWeight:700, color:"#333" }}  >{target}</div>
21:01:24.282                       <div style={{ fontSize:9, color:"#555", textTransform:"upp  ercase", letterSpacing:1 }}>Min</div>
21:01:24.282                     </div>
21:01:24.282                     <span style={{ background:status.bg, color:status.color, fon  tSize:11, fontWeight:700, padding:"4px 10px", borderRadius:6, whiteSpace:"nowr  ap" }}>{status.label}</span>
21:01:24.282                     {runLabel && <span style={{ fontSize:11, color:days<=7?"#991  b1b":days<=14?"#92400e":"#555", fontWeight:700, whiteSpace:"nowrap" }}>{runLab  el}</span>}
21:01:24.282                   </div>
21:01:24.282                   {/* Progress bar: available vs target */}
21:01:24.282                   <div style={{ height:5, background:"#1a1a1a", borderRadius:3,   overflow:"hidden" }}>
21:01:24.282                     <div style={{ height:"100%", width:`${pct*100}%`, background  :pct>=1?"#4ade80":pct>=0.5?"#FBBF24":"#991b1b", borderRadius:3, transition:"wi  dth 0.4s" }}/>
21:01:24.282                   </div>
21:01:24.282                   <div style={{ display:"flex", justifyContent:"space-between",   marginTop:4 }}>
21:01:24.282                     <div style={{ fontSize:10, color:"#333" }}>0</div>
21:01:24.282                     <div style={{ fontSize:10, color:"#333" }}>min: {target}</di  v>
21:01:24.282                   </div>
21:01:24.282                 </div>
21:01:24.282               );
21:01:24.282             })}
21:01:24.282           </div>
21:01:24.282   
21:01:24.282           {canSeeFinancials && (
21:01:24.282           <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap  :10, marginTop:14 }}>
21:01:24.282             {[
21:01:24.282               { l:"Market Value (in stock)", v:`$${totMkt.toFixed(2)}`, c:"#9240  0e" },
21:01:24.282               { l:"Cost of Current Stock",  v:`$${totInv.toFixed(2)}`, c:"#6B2D8  B" },
21:01:24.282               { l:"Total Spent (all time)", v:`$${totInvAll.toFixed(2)}`, c:"#44  4" },
21:01:24.282             ].map(({l,v,c}) => (
21:01:24.282               <div key={l} style={{ background:"#111111", border:"1px solid #2a2  a2a", borderRadius:10, padding:"10px 14px", textAlign:"center" }}>
21:01:24.282                 <div style={{ fontSize:18, fontWeight:900, color:c, marginBottom  :2 }}>{v}</div>
21:01:24.282                 <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"upper  case", letterSpacing:1 }}>{l}</div>
21:01:24.282               </div>
21:01:24.282             ))}
21:01:24.282           </div>
21:01:24.282           )}
21:01:24.283         </div>
21:01:24.283   
21:01:24.283         <div style={{ ...S.card, padding:0, overflow:"hidden" }}>
21:01:24.283           <div style={{ padding:"16px 20px 12px" }}>
21:01:24.283             <SectionLabel t="Inventory by Card Type" />
21:01:24.283           </div>
21:01:24.283           <table style={{ width:"100%", borderCollapse:"collapse" }}>
21:01:24.283             <thead>
21:01:24.283               <tr style={{ borderBottom:"1px solid #222" }}>
21:01:24.283                 <th style={{ ...S.th, textAlign:"left", paddingLeft:20, width:"3  0%" }}>Card Type</th>
21:01:24.283                 <th style={{ ...S.th, textAlign:"center" }}>Stock</th>
21:01:24.283                 <th style={{ ...S.th, textAlign:"center" }}>Used</th>
21:01:24.283                 <th style={{ ...S.th, textAlign:"center" }}>Avail</th>
21:01:24.283                 <th style={{ ...S.th, textAlign:"center" }}>Transit</th>
21:01:24.283                 <th style={{ ...S.th, textAlign:"center" }}>Min</th>
21:01:24.283                 <th style={{ ...S.th, textAlign:"right", paddingRight:20 }}>Stat  us</th>
21:01:24.283               </tr>
21:01:24.283             </thead>
21:01:24.283             <tbody>
21:01:24.283               {CARD_TYPES.map((ct,i) => {
21:01:24.283                 const d = stats[ct]; const { buffer } = TARGETS[ct]; const cc =   CC[ct];
21:01:24.283                 const avail   = d.avail;
21:01:24.283                 const transit = d.inTransit;
21:01:24.283                 const pct     = d.market > 0 ? d.invested/d.market : null;
21:01:24.283                 const ok = avail >= buffer; const warn = avail >= buffer*0.5;
21:01:24.283                 const sc = ok?"#4ade80":warn?"#FBBF24":"#E8317A";
21:01:24.283                 const sl = ok?"\u2705 Stocked":warn?"\u26A0\uFE0F Low":"\uD83D\u  DEA8 Critical";
21:01:24.283                 return (<tr key={ct} style={{ background:i%2===0?"#111111":"#0d0  d0d", borderBottom:"1px solid #1a1a1a" }}>
21:01:24.283                     <td style={{ padding:"14px 20px", fontWeight:800, color:cc.t  ext, fontSize:14 }}>{ct}</td>
21:01:24.283                     <td style={{ ...S.td, textAlign:"center", fontSize:20, fontW  eight:900, color:cc.text }}>{d.total}</td>
21:01:24.283                     <td style={{ ...S.td, textAlign:"center", fontSize:20, fontW  eight:900, color:d.used>0?"#E8317A":"#333" }}>{d.used}</td>
21:01:24.283                     <td style={{ ...S.td, textAlign:"center", fontSize:20, fontW  eight:900, color:ok?"#4ade80":warn?"#FBBF24":"#E8317A" }}>{avail}</td>
21:01:24.283                     <td style={{ ...S.td, textAlign:"center", fontSize:20, fontW  eight:900, color:transit>0?"#7B9CFF":"#333" }}>{transit}</td>
21:01:24.283                     <td style={{ ...S.td, textAlign:"center", fontSize:16, color  :"#555", fontWeight:700 }}>{buffer}</td>
21:01:24.283                     <td style={{ padding:"14px 20px", textAlign:"right" }}>
21:01:24.283                       <div style={{ display:"flex", flexDirection:"column", alig  nItems:"flex-end", gap:6 }}>
21:01:24.283                         {canSeeFinancials && <ZoneBadge pct={pct} />}
21:01:24.283                         <span style={{ background:ok?"#0a1a0a":warn?"#1a1400":"#  1a0a0a", color:sc, border:`1px solid ${sc}33`, borderRadius:6, padding:"4px 10  px", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>{sl}</span>
21:01:24.283                       </div>
21:01:24.283                     </td>
21:01:24.283                   </tr>
21:01:24.283                 );
21:01:24.283               })}
21:01:24.283             </tbody>
21:01:24.283           </table>
21:01:24.283         </div>
21:01:24.283   
21:01:24.284         <div style={S.card}>
21:01:24.284           <SectionLabel t="Team Activity" />
21:01:24.284           <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap  :12 }}>
21:01:24.284             {BREAKERS.map(b => {
21:01:24.284               const bc = BC[b];
21:01:24.284               const bBreaks = breaks.filter(x => x.breaker === b);
21:01:24.284               const bInv    = inventory.filter(x => x.addedBy?.toLowerCase().inc  ludes(b.toLowerCase()));
21:01:24.284               const last    = bBreaks.length > 0 ? [...bBreaks].sort((a,z) => ne  w Date(z.dateAdded)-new Date(a.dateAdded))[0] : null;
21:01:24.284               const isYou   = user?.displayName?.toLowerCase().includes(b.toLowe  rCase());
21:01:24.284               return (
21:01:24.284                 <div key={b} style={{ ...S.card, border:`1.5px solid ${bc.border  }44`, background:bc.bg+"44", position:"relative" }}>
21:01:24.284                   {isYou && <div style={{ position:"absolute", top:10, right:10,   fontSize:10, fontWeight:700, color:bc.text, background:bc.bg, border:`1px sol  id ${bc.border}`, borderRadius:10, padding:"2px 8px" }}>You</div>}
21:01:24.284                   <div style={{ fontWeight:900, fontSize:16, color:bc.text, marg  inBottom:10 }}>{b}</div>
21:01:24.284                   {[["Cards logged out",bBreaks.length],["Added to inventory",bI  nv.length],["Last break",last?new Date(last.dateAdded).toLocaleDateString():"-  -"]].map(([l,v]) => (
21:01:24.284                     <div key={l} style={{ display:"flex", justifyContent:"space-  between", padding:"4px 0", borderBottom:"1px solid #333333" }}>
21:01:24.284                       <span style={{ fontSize:11, color:"#AAAAAA" }}>{l}</span>
21:01:24.284                       <span style={{ fontSize:11, fontWeight:700, color:bc.text   }}>{v}</span>
21:01:24.284                     </div>
21:01:24.284                   ))}
21:01:24.284                 </div>
21:01:24.284               );
21:01:24.284             })}
21:01:24.284           </div>
21:01:24.284         </div>
21:01:24.284   
21:01:24.284         {/* Historical Data -- Admin only */}
21:01:24.284         {canSeeFinancials && (() => {
21:01:24.284   
21:01:24.284           function startEdit(h) {
21:01:24.284             setHistForm({ yearMonth:h.yearMonth, grossRevenue:h.grossRevenue||""  , netRevenue:h.netRevenue||"", imcReimb:h.imcReimb||"", newBuyers:h.newBuyers|  |"", notes:h.notes||"" });
21:01:24.284             setEditingId(h.id);
21:01:24.284             setShowHist(true);
21:01:24.284           }
21:01:24.284           function cancelEdit() {
21:01:24.285             setHistForm({ yearMonth:"", grossRevenue:"", netRevenue:"", imcReimb  :"", newBuyers:"", notes:"" });
21:01:24.285             setEditingId(null);
21:01:24.285           }
21:01:24.285   
21:01:24.285           async function saveHist() {
21:01:24.285             if (!histForm.yearMonth || !histForm.grossRevenue) return;
21:01:24.285             await onSaveHistorical({ ...histForm, id: histForm.yearMonth });
21:01:24.285             setHistForm({ yearMonth:"", grossRevenue:"", netRevenue:"", imcReimb  :"", newBuyers:"", notes:"" });
21:01:24.285             setEditingId(null);
21:01:24.285           }
21:01:24.285   
21:01:24.285           return (
21:01:24.285             <div style={{ ...S.card, border:"2px solid #333333" }}>
21:01:24.285               <div style={{ display:"flex", alignItems:"center", justifyContent:  "space-between", marginBottom: showHist ? 14 : 0 }}>
21:01:24.285                 <SectionLabel t="📅 Historical Monthly Data" />
21:01:24.285                 <button onClick={()=>{ setShowHist(p=>!p); cancelEdit(); }} styl  e={{ background:"transparent", border:"1.5px solid #6B2D8B", color:"#E8317A",   borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700, cursor:"point  er", fontFamily:"inherit" }}>
21:01:24.285                   {showHist ? "\u25B2 Hide" : "\u25BC Manage"}
21:01:24.285                 </button>
21:01:24.285               </div>
21:01:24.285               {showHist && (
21:01:24.285                 <>
21:01:24.285                   <div style={{ fontSize:12, color:"#AAAAAA", marginBottom:14 }}  >{editingId ? `Editing ${editingId} -- update fields and save.` : "Enter month  ly summary data for historical periods. These feed into YTD totals and project  ions on the dashboard."}</div>
21:01:24.285                   <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr   1fr 1fr 2fr auto", gap:10, marginBottom:14, alignItems:"end" }}>
21:01:24.285                     <div>
21:01:24.286                       <label style={S.lbl}>Month (YYYY-MM)</label>
21:01:24.286                       <input type="month" value={histForm.yearMonth} onChange={e  =>setHistForm(p=>({...p,yearMonth:e.target.value}))} style={{ ...S.inp, opacit  y: editingId ? 0.5 : 1 }} disabled={!!editingId}/>
21:01:24.286                     </div>
21:01:24.286                     <div>
21:01:24.286                       <label style={S.lbl}>Gross Revenue ($)</label>
21:01:24.286                       <input type="number" step="0.01" value={histForm.grossReve  nue} onChange={e=>setHistForm(p=>({...p,grossRevenue:e.target.value}))} placeh  older="0.00" style={S.inp}/>
21:01:24.286                     </div>
21:01:24.286                     <div>
21:01:24.286                       <label style={S.lbl}>Net Revenue ($)</label>
21:01:24.286                       <input type="number" step="0.01" value={histForm.netRevenu  e} onChange={e=>setHistForm(p=>({...p,netRevenue:e.target.value}))} placeholde  r="0.00" style={S.inp}/>
21:01:24.286                     </div>
21:01:24.286                     <div>
21:01:24.286                       <label style={S.lbl}>IMC Reimb ($)</label>
21:01:24.286                       <input type="number" step="0.01" value={histForm.imcReimb}   onChange={e=>setHistForm(p=>({...p,imcReimb:e.target.value}))} placeholder="0  .00" style={S.inp}/>
21:01:24.286                     </div>
21:01:24.286                     <div>
21:01:24.286                       <label style={S.lbl}>New Buyers</label>
21:01:24.286                       <input type="number" min="0" value={histForm.newBuyers} on  Change={e=>setHistForm(p=>({...p,newBuyers:e.target.value}))} placeholder="0"   style={S.inp}/>
21:01:24.286                     </div>
21:01:24.286                     <div>
21:01:24.286                       <label style={S.lbl}>Notes</label>
21:01:24.286                       <input value={histForm.notes} onChange={e=>setHistForm(p=>  ({...p,notes:e.target.value}))} placeholder="e.g. Jan streams" style={S.inp}/>                    </div>
21:01:24.286                     <div style={{ display:"flex", gap:6 }}>
21:01:24.286                       <Btn onClick={saveHist} disabled={!histForm.yearMonth||!hi  stForm.grossRevenue} variant="green">{editingId ? "\uD83D\uDCBE Save" : "+ Add  "}</Btn>
21:01:24.286                       {editingId && <Btn onClick={cancelEdit} variant="ghost">{"  \u2715"}</Btn>}
21:01:24.286                     </div>
21:01:24.286                   </div>
21:01:24.286                   {historicalData.length > 0 && (
21:01:24.286                     <table style={{ width:"100%", borderCollapse:"collapse" }}>
21:01:24.286                       <thead><tr>{["Month","Gross","Net","Bazooka (30%)","IMC Re  imb","True Net","\uD83C\uDF31 New Buyers","Notes",""].map(h=><th key={h} style  ={S.th}>{h}</th>)}</tr></thead>
21:01:24.286                       <tbody>
21:01:24.286                         {historicalData.map((h,i) => (
21:01:24.286                           <tr key={h.id} style={{ background: editingId===h.id?"  rgba(107,45,139,0.08)":i%2===0?"#111111":"#0d0d0d" }}>
21:01:24.287                             <td style={{ ...S.td, fontWeight:700, color:"#E8317A  " }}>{h.yearMonth}</td>
21:01:24.287                             <td style={{ ...S.td, color:"#E8317A", fontWeight:70  0 }}>{fmt(parseFloat(h.grossRevenue)||0)}</td>
21:01:24.287                             <td style={{ ...S.td, color:"#F0F0F0" }}>{fmt(parseF  loat(h.netRevenue)||0)}</td>
21:01:24.287                             <td style={{ ...S.td, color:"#E8317A", fontWeight:70  0 }}>{fmt((parseFloat(h.netRevenue)||0)*0.30)}</td>
21:01:24.287                             <td style={{ ...S.td, color:"#E8317A" }}>{h.imcReimb  ?fmt(parseFloat(h.imcReimb)):"--"}</td>
21:01:24.287                             <td style={{ ...S.td, color:"#E8317A", fontWeight:90  0 }}>{fmt((parseFloat(h.netRevenue)||0)*0.30 + (parseFloat(h.imcReimb)||0))}</  td>
21:01:24.287                             <td style={{ ...S.td, color:"#E8317A", fontWeight:70  0 }}>{h.newBuyers>0?`\uD83C\uDF31 ${h.newBuyers}`:"--"}</td>
21:01:24.287                             <td style={{ ...S.td, color:"#AAAAAA" }}>{h.notes||"  --"}</td>
21:01:24.287                             <td style={S.td}>
21:01:24.287                               <div style={{ display:"flex", gap:6 }}>
21:01:24.287                                 <button onClick={()=>startEdit(h)} style={{ back  ground:"none", border:"1px solid #2a2a2a", borderRadius:5, padding:"2px 8px",   fontSize:11, cursor:"pointer", fontFamily:"inherit", color:"#AAAAAA" }}>{"\u27  0F\uFE0F"}</button>
21:01:24.287                                 <button onClick={()=>{ if(window.confirm("Delete   this historical entry?")) onDeleteHistorical(h.id); }} style={{ background:"n  one", border:"1px solid #FCA5A5", color:"#E8317A", borderRadius:5, padding:"2p  x 8px", fontSize:11, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1"  }</button>
21:01:24.287                               </div>
21:01:24.287                             </td>
21:01:24.287                           </tr>
21:01:24.287                         ))}
21:01:24.287                       </tbody>
21:01:24.287                     </table>
21:01:24.287                   )}
21:01:24.287                 </>
21:01:24.287               )}
21:01:24.287             </div>
21:01:24.287           );
21:01:24.287         })()}
21:01:24.287   
21:01:24.287         {/* Card Type Migration Tool -- Admin only */}
21:01:24.287         {canSeeFinancials && (() => {
21:01:24.287           const USAGE_MAP = { "Giveaway":"Giveaway Cards", "Insurance":"Insuranc  e Cards", "First-Timer Pack":"First-Timer Cards", "Chaser Pull":"Chaser Cards"  , "Chaser":"Chaser Cards" };
21:01:24.287           const mismatched = breaks.filter(b => {
21:01:24.287             if (b.isPoolLog || !b.usage) return false;
21:01:24.287             const correct = USAGE_MAP[b.usage];
21:01:24.287             return correct && b.cardType !== correct;
21:01:24.287           });
21:01:24.287           if (mismatched.length === 0) return null;
21:01:24.287           async function runMigration() {
21:01:24.287             setMigrating(true);
21:01:24.287             await Promise.all(mismatched.map(b =>
21:01:24.287               setDoc(doc(db,"breaks",b.id), { cardType: USAGE_MAP[b.usage] }, {   merge:true })
21:01:24.287             ));
21:01:24.287             setMigrating(false); setMigDone(true);
21:01:24.288           }
21:01:24.288           return (
21:01:24.288             <div style={{ ...S.card, border:"2px solid rgba(251,191,36,0.3)", ba  ckground:"rgba(251,191,36,0.04)" }}>
21:01:24.288               <div style={{ display:"flex", justifyContent:"space-between", alig  nItems:"center", flexWrap:"wrap", gap:10 }}>
21:01:24.288                 <div>
21:01:24.288                   <div style={{ fontSize:13, fontWeight:800, color:"#FBBF24", ma  rginBottom:4 }}>⚠️ Card Type Fix Available</div>
21:01:24.288                   <div style={{ fontSize:12, color:"#555" }}>
21:01:24.288                     {mismatched.length} existing break {mismatched.length===1?"e  ntry":"entries"} {mismatched.length===1?"has":"have"} a card type that doesn't   match how the card was actually used.
21:01:24.288                     This is a one-time fix — it won't affect your inventory, jus  t corrects the tracking labels.
21:01:24.288                   </div>
21:01:24.288                 </div>
21:01:24.288                 {!migDone ? (
21:01:24.288                   <button onClick={runMigration} disabled={migrating}
21:01:24.288                     style={{ background:"rgba(251,191,36,0.15)", color:"#FBBF24"  , border:"1px solid rgba(251,191,36,0.3)", borderRadius:8, padding:"8px 18px",   fontSize:12, fontWeight:800, cursor:migrating?"not-allowed":"pointer", fontFa  mily:"inherit", flexShrink:0 }}>
21:01:24.288                     {migrating?`Fixing ${mismatched.length} entries...`:`✅ Fix $  {mismatched.length} Entries`}
21:01:24.288                   </button>
21:01:24.288                 ) : (
21:01:24.288                   <div style={{ color:"#4ade80", fontWeight:700, fontSize:13 }}>  ✅ All fixed!</div>
21:01:24.288                 )}
21:01:24.288               </div>
21:01:24.288             </div>
21:01:24.288           );
21:01:24.288         })()}
21:01:24.288   
21:01:24.288       </div>
21:01:24.288     );
21:01:24.288   }
21:01:24.288   
21:01:24.288   function LotComp({ defaultMode="builder", onAccept, onSaveComp, onDeleteComp,   comps, user, userRole, onSaveQuote, quotes=[], onCloseQuote, onBazookaCounter,   cardPools=[], onDismissQuoteNotif, bobaCards=[] }) {
21:01:24.288     const canSeeFinancials = ["Admin"].includes(userRole?.role);
21:01:24.288     const [compMode,     setCompMode]     = useState(defaultMode);
21:01:24.288     useEffect(() => { setCompMode(defaultMode); }, [defaultMode]);
21:01:24.288     useEffect(()=>{setCompMode(defaultMode);},[defaultMode]);
21:01:24.288     const [windowWidth, setWindowWidth] = useState(window.innerWidth);
21:01:24.288     useEffect(()=>{ const h=()=>setWindowWidth(window.innerWidth); window.addEve  ntListener("resize",h,{passive:true}); return()=>window.removeEventListener("r  esize",h); },[]);
21:01:24.288     const isMobile = windowWidth < 768;
21:01:24.289     const [seller,       setSeller]       = useState({ name:"", contact:"", date  :"", source:"", payment:"", paymentHandle:"" });
21:01:24.289     const [lotPct,       setLotPct]       = useState("");
21:01:24.289     const [finalOffer,   setFOffer]       = useState("");
21:01:24.289     const [custView,     setCustView]     = useState(false);
21:01:24.289     const [custNote,     setCustNote]     = useState("");
21:01:24.289     const [lotLocation,  setLotLocation]  = useState(LOCATIONS[0]);
21:01:24.289     const [quoteLink,    setQuoteLink]    = useState(null);
21:01:24.289     const [savedQuoteRef, setSavedQuoteRef] = useState(null);
21:01:24.289     const [quoteCopied,  setQuoteCopied]  = useState(false);
21:01:24.289     const [allowCounter, setAllowCounter] = useState(false);
21:01:24.289     const [bzCounterAmt, setBzCounterAmt] = useState({});
21:01:24.289     const [rows,         setRows]         = useState(() => Array.from({ length:8   }, () => ({ id:uid(), name:"", cardType:"", mktVal:"", qty:"1", include:true,   costOverride:"", pctOverride:"", manualEntry:false })));
21:01:24.289     const [quickCards,   setQuickCards]   = useState("");
21:01:24.289     const [quickMktVal,  setQuickMktVal]  = useState("");
21:01:24.289     const [quickPct,     setQuickPct]     = useState("");
21:01:24.289     const [quickOffer,   setQuickOffer]   = useState("");
21:01:24.289     const [counterOffer,        setCounterOffer]        = useState("");
21:01:24.289     const [loadedCompId,        setLoadedCompId]        = useState(null);
21:01:24.289     const [lightbox,            setLightbox]            = useState(null);
21:01:24.289     const [loadedCompHadCards,  setLoadedCompHadCards]  = useState(true);
21:01:24.289     const [acOpen,       setAcOpen]       = useState(null);  // row id with open   autocomplete
21:01:24.289     const [acQuery,      setAcQuery]      = useState({});    // {rowId: queryStr  ing}
21:01:24.289     const [importing,    setImporting]    = useState(false);
21:01:24.289   
21:01:24.289     const pctNum    = parseFloat(lotPct)/100 || 0.60;
21:01:24.289     const included  = rows.filter(r => r.name && r.include);
21:01:24.289     const totalMkt  = included.reduce((s,r) => s + (parseFloat(r.mktVal)||0)*(pa  rseInt(r.qty)||1), 0);
21:01:24.289     // Base offer from global pct — this is the fixed total
21:01:24.289     const baseOffer = totalMkt * pctNum;
21:01:24.289     // Locked cards: those with costOverride OR pctOverride
21:01:24.289     const lockedAmt = included.reduce((s,r) => {
21:01:24.289       const mv = (parseFloat(r.mktVal)||0)*(parseInt(r.qty)||1);
21:01:24.289       const co = parseFloat(r.costOverride);
21:01:24.289       const po = parseFloat(r.pctOverride);
21:01:24.289       if (!isNaN(co)) return s + co*(parseInt(r.qty)||1);
21:01:24.290       if (!isNaN(po)) return s + mv*(po/100);
21:01:24.290       return s;
21:01:24.290     }, 0);
21:01:24.290     const unlockedMkt = included.reduce((s,r) => {
21:01:24.291       const co = parseFloat(r.costOverride);
21:01:24.291       const po = parseFloat(r.pctOverride);
21:01:24.291       return (isNaN(co) && isNaN(po)) ? s + (parseFloat(r.mktVal)||0)*(parseInt(  r.qty)||1) : s;
21:01:24.291     }, 0);
21:01:24.291     // Total offer = locked amounts + unlocked cards at global pct
21:01:24.291     const calcOffer = lockedAmt + unlockedMkt * pctNum;
21:01:24.291     const offerAmt  = finalOffer !== "" ? parseFloat(finalOffer) : null;
21:01:24.291     const counterAmt = counterOffer !== "" ? parseFloat(counterOffer) : null;
21:01:24.291     // Priority: counter > manual override > calculated
21:01:24.291     const dispOffer  = (counterAmt != null && counterAmt > 0) ? counterAmt : (of  ferAmt != null && offerAmt > 0) ? offerAmt : calcOffer;
21:01:24.291     const dispPct    = totalMkt > 0 ? dispOffer / totalMkt : pctNum;
21:01:24.291     const lotZone    = totalMkt > 0 ? getZone(dispOffer/totalMkt) : null;
21:01:24.291     const totalCards = included.reduce((s,r) => s+(parseInt(r.qty)||1), 0);
21:01:24.291     const quickTotal     = (parseFloat(quickMktVal)||0) * (parseInt(quickCards)|  |0);
21:01:24.291     const quickCalcOffer = quickTotal * (parseFloat(quickPct)/100 || 0.60);
21:01:24.291     const quickOfferAmt  = parseFloat(quickOffer) || quickCalcOffer;
21:01:24.291     const quickZone      = quickTotal > 0 ? getZone(quickOfferAmt/quickTotal) :   null;
21:01:24.291     const counterZone    = totalMkt > 0 && counterAmt != null && counterAmt > 0   ? getZone(counterAmt/totalMkt) : null;
21:01:24.291   
21:01:24.291     // Cost allocation per card
21:01:24.291     const manuallyAllocated = lockedAmt;
21:01:24.291     const remainingOffer = Math.max(0, dispOffer - manuallyAllocated);
21:01:24.291     function getCostPerCard(r) {
21:01:24.291       const co = parseFloat(r.costOverride);
21:01:24.291       if (!isNaN(co)) return co;
21:01:24.291       const po = parseFloat(r.pctOverride);
21:01:24.291       const mv = parseFloat(r.mktVal)||0;
21:01:24.291       if (!isNaN(po)) return mv*(po/100);
21:01:24.291       // Unlocked: proportional share of remaining offer
21:01:24.291       if (unlockedMkt > 0) return (mv / unlockedMkt) * remainingOffer;
21:01:24.291       return 0;
21:01:24.291     }
21:01:24.291     const totalAllocated = included.reduce((s,r) => s + getCostPerCard(r)*(parse  Int(r.qty)||1), 0);
21:01:24.292     const allocationDiff = dispOffer > 0 ? totalAllocated - dispOffer : 0;
21:01:24.292   
21:01:24.292     function upd(id,f,v) { setRows(p => p.map(r => r.id===id ? {...r,[f]:v} : r)  ); }
21:01:24.292     function addRow() { setRows(p => [...p, { id:uid(), name:"", cardType:"", mk  tVal:"", qty:"1", include:true, costOverride:"", manualEntry:false }]); }
21:01:24.292   
21:01:24.292     function importFromFile(e) {
21:01:24.292       const file = e.target.files[0];
21:01:24.292       e.target.value = "";
21:01:24.292       if (!file) return;
21:01:24.292       setImporting(true);
21:01:24.292       const ext = file.name.split(".").pop().toLowerCase();
21:01:24.292   
21:01:24.292       function processText(text) {
21:01:24.292         const lines = text.split(/\r?\n/).filter(l => l.trim());
21:01:24.292         if (lines.length < 2) { alert("File appears empty or has only headers.")  ; setImporting(false); return; }
21:01:24.292         // Parse header row
21:01:24.292         const headers = lines[0].split(",").map(h => h.replace(/^["']|["']$/g,""  ).trim().toLowerCase());
21:01:24.292         // Auto-detect columns
21:01:24.292         const nameIdx    = headers.findIndex(h => h.includes("hero") || h==="nam  e" || h.includes("card name"));
21:01:24.292         const weaponIdx  = headers.findIndex(h => h.includes("weapon"));
21:01:24.292         const treatIdx   = headers.findIndex(h => h.includes("treatment") || h.i  ncludes("treat"));
21:01:24.292         const qtyIdx     = headers.findIndex(h => h.includes("qty") || h.include  s("quantity"));
21:01:24.292         const valIdx     = headers.findIndex(h => h.includes("value") || h.inclu  des("market") || h.includes("price") || h.includes("mkt"));
21:01:24.292         const typeIdx    = headers.findIndex(h => h.includes("type"));
21:01:24.292         if (nameIdx === -1) { alert("Could not find a Hero or Name column. Make   sure your first row has column headers."); setImporting(false); return; }
21:01:24.292   
21:01:24.292         const newRows = [];
21:01:24.292         for (let i = 1; i < lines.length; i++) {
21:01:24.292           const cells = [];
21:01:24.292           let cur = ""; let inQ = false;
21:01:24.292           for (const ch of lines[i]) {
21:01:24.292             if (ch==='"'||ch==="'") { inQ=!inQ; }
21:01:24.292             else if (ch===","&&!inQ) { cells.push(cur.trim()); cur=""; }
21:01:24.292             else { cur+=ch; }
21:01:24.292           }
21:01:24.292           cells.push(cur.trim());
21:01:24.292           const hero   = cells[nameIdx]  ? cells[nameIdx].replace(/^["']|["']$/g  ,"").trim()   : "";
21:01:24.292           const weapon = weaponIdx>=0 && cells[weaponIdx] ? cells[weaponIdx].rep  lace(/^["']|["']$/g,"").trim() : "";
21:01:24.293           const treat  = treatIdx>=0  && cells[treatIdx]  ? cells[treatIdx].repl  ace(/^["']|["']$/g,"").trim()  : "";
21:01:24.293           const name   = [hero, weapon, treat].filter(Boolean).join(" ");
21:01:24.293           if (!name) continue;
21:01:24.293           const qty    = qtyIdx>=0 && cells[qtyIdx]  ? String(Math.max(1,parseIn  t(cells[qtyIdx])||1)) : "1";
21:01:24.293           const rawVal = valIdx>=0 && cells[valIdx]   ? cells[valIdx].replace(/[  $,\s"']/g,"") : "";
21:01:24.293           const mktVal = rawVal && !isNaN(parseFloat(rawVal)) ? String(parseFloa  t(rawVal)) : "";
21:01:24.293           const cardType = typeIdx>=0 && cells[typeIdx] ? cells[typeIdx].replace  (/^["']|["']$/g,"").trim() : "";
21:01:24.293           newRows.push({ id:uid(), name, cardType, mktVal, qty, include:true, co  stOverride:"", pctOverride:"", manualEntry:true });
21:01:24.293         }
21:01:24.293         if (!newRows.length) { alert("No cards found. Check that your file has d  ata rows below the header."); setImporting(false); return; }
21:01:24.293         setRows(p => [...p.filter(r=>r.name.trim()), ...newRows]);
21:01:24.293         setImporting(false);
21:01:24.293         alert(`✅ Imported ${newRows.length} card${newRows.length!==1?"s":""}! Ad  d market values in the list below.`);
21:01:24.293       }
21:01:24.293   
21:01:24.293       if (ext === "csv") {
21:01:24.293         const reader = new FileReader();
21:01:24.293         reader.onload = ev => processText(ev.target.result);
21:01:24.293         reader.onerror = () => { alert("Failed to read file."); setImporting(fal  se); };
21:01:24.293         reader.readAsText(file);
21:01:24.293       } else {
21:01:24.293         // XLSX — load SheetJS then convert to CSV-like text
21:01:24.293         const loadXLSX = (cb) => {
21:01:24.293           if (window.XLSX) { cb(); return; }
21:01:24.293           const s = document.createElement("script");
21:01:24.293           s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.  min.js";
21:01:24.293           s.onload = cb;
21:01:24.293           s.onerror = () => { alert("Failed to load XLSX library. Please export   your file as CSV and try again."); setImporting(false); };
21:01:24.293           document.head.appendChild(s);
21:01:24.293         };
21:01:24.293         const reader = new FileReader();
21:01:24.293         reader.onload = ev => {
21:01:24.293           loadXLSX(() => {
21:01:24.293             try {
21:01:24.293               const wb = window.XLSX.read(new Uint8Array(ev.target.result), { ty  pe:"array" });
21:01:24.293               const csv = window.XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames  [0]]);
21:01:24.293               processText(csv);
21:01:24.293             } catch(err) { alert("Error reading XLSX: " + err.message); setImpor  ting(false); }
21:01:24.294           });
21:01:24.294         };
21:01:24.294         reader.onerror = () => { alert("Failed to read file."); setImporting(fal  se); };
21:01:24.294         reader.readAsArrayBuffer(file);
21:01:24.294       }
21:01:24.294     }
21:01:24.294   
21:01:24.294     function loadComp(comp) {
21:01:24.294       setSeller({ name:comp.seller||"", contact:comp.contact||"", date:comp.date  ||"", source:comp.source||"", payment:comp.payment||"", paymentHandle:comp.pay  mentHandle||"" });
21:01:24.294       const hasCards = comp.cards && comp.cards.length > 0;
21:01:24.294       setRows(hasCards
21:01:24.294         ? comp.cards.map(c => ({ id:uid(), name:c.name||"", cardType:c.cardType|  |"", mktVal:String(c.mktVal||""), qty:String(c.qty||1), include:true, costOver  ride:"", pctOverride:"", manualEntry:false }))
21:01:24.294         : Array.from({ length:8 }, () => ({ id:uid(), name:"", cardType:"", mktV  al:"", qty:"1", include:true, costOverride:"", pctOverride:"", manualEntry:fal  se }))
21:01:24.294       );
21:01:24.294       setFOffer(comp.offer ? String(comp.offer) : "");
21:01:24.294       setCounterOffer("");
21:01:24.294       setLoadedCompId(comp.id);
21:01:24.294       setLoadedCompHadCards(hasCards);
21:01:24.294       setCompMode("builder");
21:01:24.294       setTimeout(() => { const el = document.getElementById("comp-builder-top");   if (el) el.scrollIntoView({ behavior:"smooth", block:"start" }); }, 100);
21:01:24.294     }
21:01:24.294   
21:01:24.294     function saveComp(status) {
21:01:24.294       if (!onSaveComp) { alert("Save not available — please refresh and try agai  n."); return; }
21:01:24.294       if (included.length === 0) { alert("Add at least one card before saving.")  ; return; }
21:01:24.294       onSaveComp({
21:01:24.294         id: loadedCompId || undefined,
21:01:24.294         seller:seller.name, contact:seller.contact, date:seller.date||new Date()  .toLocaleDateString(),
21:01:24.294         source:seller.source, payment:seller.payment, paymentHandle:seller.payme  ntHandle, totalCards, totalMarket:totalMkt,
21:01:24.294         offer:dispOffer, blendedPct:totalMkt>0?dispOffer/totalMkt:0,
21:01:24.294         zone:lotZone?.label||"--", status,
21:01:24.294         cards:included.map(r=>({ name:r.name, cardType:r.cardType, qty:parseInt(  r.qty)||1, mktVal:parseFloat(r.mktVal)||0, pctOverride:r.pctOverride||"", offe  rPerCard:getCostPerCard(r) }))
21:01:24.294       });
21:01:24.294     }
21:01:24.294   
21:01:24.294     function doAccept() {
21:01:24.294       if (included.length === 0) return;
21:01:24.295       const cards = [];
21:01:24.295       const lotDate = seller.date || new Date().toISOString().split("T")[0]; //   always ISO YYYY-MM-DD
21:01:24.295       const lotSeller = seller.name?.trim() || "Unknown Seller";
21:01:24.295       included.forEach(r => {
21:01:24.295         const qty = parseInt(r.qty)||1;
21:01:24.295         const mv  = parseFloat(r.mktVal)||0;
21:01:24.295         const cardName = (r.name === "__new__" || r.name === "__manual__") ? (r.  _newName||"").trim() || r.cardType : r.name || r.cardType;
21:01:24.295         const costPerCard = getCostPerCard(r);
21:01:24.295         for (let i=0; i<qty; i++) {
21:01:24.295           cards.push({ id:uid(), cardName, cardType:r.cardType, marketValue:mv,   lotTotalPaid:dispOffer, cardsInLot:totalCards, costPerCard, buyPct:mv>0?costPe  rCard/mv:null, date:lotDate, source:seller.source||"", seller:lotSeller, payme  nt:seller.payment||"", paymentHandle:seller.paymentHandle||"", dateAdded:new D  ate().toISOString(), location:lotLocation });
21:01:24.295         }
21:01:24.295       });
21:01:24.295       onAccept(cards, { ...seller, name:lotSeller, date:lotDate }, user, custNot  e);
21:01:24.295     }
21:01:24.295   
21:01:24.295     if (custView) return (
21:01:24.295       <div>
21:01:24.295         <div style={{ marginBottom:14 }}><Btn onClick={()=>setCustView(false)} v  ariant="ghost">{"\u2190 Back to Builder"}</Btn></div>
21:01:24.295         <div style={{ background:"#111111", border:"2px solid #E8317A55", border  Radius:16, overflow:"hidden", maxWidth:680, boxShadow:"0 4px 24px rgba(0,0,0,0  .08)" }}>
21:01:24.295           <div style={{ background:"#000000", padding:"28px 32px", textAlign:"ce  nter" }}>
21:01:24.295             <div style={{ fontSize:32, fontWeight:900, color:"#F0F0F0", letterSp  acing:4, marginBottom:6 }}>BAZOOKA</div>
21:01:24.295             <div style={{ fontSize:11, color:"#AAAAAA", fontStyle:"italic" }}>Bo   Jackson Battle Arena · Lot Purchase Offer</div>
21:01:24.295           </div>
21:01:24.295           <div style={{ padding:"14px 24px", borderBottom:"1px solid #333333", d  isplay:"grid", gridTemplateColumns:"1fr 1fr", background:"#111111" }}>
21:01:24.295             <div><span style={{ color:"#AAAAAA", fontSize:11 }}>Prepared for: </  span><strong>{seller.name||"--"}</strong></div>
21:01:24.295             <div style={{ textAlign:"right" }}><span style={{ color:"#AAAAAA", f  ontSize:11 }}>Date: </span><strong>{seller.date||new Date().toLocaleDateString  ()}</strong></div>
21:01:24.295           </div>
21:01:24.295           <div style={{ padding:"8px 24px 0" }}>
21:01:24.295             <table style={{ width:"100%", borderCollapse:"collapse" }}>
21:01:24.295               <thead><tr>{["#","Card Name","Qty","Value/Card","Offer/Card"].map(  h=><th key={h} style={{ padding:"8px 10px", borderBottom:"2px solid #F0E0E8",   color:"#AAAAAA", fontSize:10, fontWeight:700, textTransform:"uppercase", textA  lign:"left" }}>{h}</th>)}</tr></thead>
21:01:24.296               <tbody>
21:01:24.296                 {included.length===0 ? <EmptyRow msg="No cards added." cols={5}/  > :
21:01:24.296                   included.map((r,i) => {
21:01:24.296                     const mv = parseFloat(r.mktVal)||0;
21:01:24.296                     return (
21:01:24.296                       <tr key={r.id} style={{ borderBottom:"1px solid #FFF0F5" }  }>
21:01:24.296                         <td style={{ padding:"8px 10px", color:"#D1D5DB", fontSi  ze:11, width:32, textAlign:"center" }}>{i+1}</td>
21:01:24.296                         <td style={{ padding:"8px 10px", fontWeight:700, color:"  #F0F0F0" }}>{r.name}</td>
21:01:24.296                         <td style={{ padding:"8px 10px", color:"#AAAAAA", textAl  ign:"center" }}>{parseInt(r.qty)||1}</td>
21:01:24.296                         <td style={{ padding:"8px 10px", color:"#AAAAAA", fontWe  ight:600 }}>${mv.toFixed(2)}</td>
21:01:24.296                         <td style={{ padding:"8px 10px", color:"#E8317A", fontWe  ight:700 }}>${(mv*dispPct).toFixed(2)}</td>
21:01:24.296                       </tr>
21:01:24.296                     );
21:01:24.296                   })
21:01:24.296                 }
21:01:24.296               </tbody>
21:01:24.296             </table>
21:01:24.296           </div>
21:01:24.296           <div style={{ padding:"16px 24px", borderTop:"2px solid #333333", marg  inTop:8 }}>
21:01:24.296             {/* Notes -- rendered read-only in the quote */}
21:01:24.296             {custNote.trim() && (
21:01:24.296               <div style={{ marginBottom:14, padding:"12px 16px", background:"#1  11111", border:"1px solid #2a2a2a", borderLeft:"3px solid #E8317A", borderRadi  us:8 }}>
21:01:24.296                 <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", text  Transform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Notes</div>
21:01:24.296                 <p style={{ margin:0, fontSize:13, color:"#AAAAAA", lineHeight:1  .6, whiteSpace:"pre-wrap" }}>{custNote}</p>
21:01:24.296               </div>
21:01:24.296             )}
21:01:24.296             {[[`Total Cards`,totalCards],...(canSeeFinancials?[[`Total Market Va  lue`,`$${totalMkt.toFixed(2)}`]]:[])] .map(([l,v]) => (
21:01:24.296               <div key={l} style={{ display:"flex", justifyContent:"space-betwee  n", padding:"6px 0", borderBottom:"1px solid #FFF0F5" }}>
21:01:24.296                 <span style={{ color:"#AAAAAA", fontSize:13 }}>{l}</span>
21:01:24.296                 <span style={{ color:"#F0F0F0", fontWeight:700 }}>{v}</span>
21:01:24.296               </div>
21:01:24.296             ))}
21:01:24.296             <div style={{ display:"flex", justifyContent:"space-between", alignI  tems:"center", marginTop:12, padding:"14px 20px", background:"#111111", border  Radius:10 }}>
21:01:24.296               <span style={{ color:"#E8317A", fontWeight:800, fontSize:16 }}>Baz  ooka's Offer</span>
21:01:24.296               <span style={{ color:"#F0F0F0", fontWeight:900, fontSize:22 }}>${d  ispOffer.toFixed(2)}</span>
21:01:24.296             </div>
21:01:24.296             {/* Ship-to address */}
21:01:24.296             <div style={{ marginTop:14, padding:"12px 16px", background:"#111111  ", border:"1px solid #2a2a2a", borderRadius:8 }}>
21:01:24.296               <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", textTr  ansform:"uppercase", letterSpacing:1.5, marginBottom:6 }}>Ship Cards To</div>
21:01:24.296               <div style={{ fontSize:13, color:"#F0F0F0", fontWeight:700, lineHe  ight:1.8 }}>
21:01:24.296                 Devin -- Bazooka<br/>
21:01:24.296                 425 Prosperity Dr<br/>
21:01:24.296                 Warsaw, IN 46582
21:01:24.296               </div>
21:01:24.296             </div>
21:01:24.296   
21:01:24.296             {/* Payment section -- shows when payment method + handle entered */  }
21:01:24.296             {seller.payment && seller.paymentHandle && (() => {
21:01:24.296               const handle = seller.paymentHandle.trim();
21:01:24.296               const amt    = dispOffer > 0 ? dispOffer.toFixed(2) : "";
21:01:24.296   
21:01:24.296               const paymentConfig = {
21:01:24.296                 PayPal: {
21:01:24.296                   color: "#003087",
21:01:24.296                   hint:  `To: ${handle}`,
21:01:24.296                   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="no  ne"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.72a.77.77 0 0   1 .761-.641h6.927c2.34 0 4.02.646 4.956 1.92.434.588.676 1.24.728 1.98.056.812  -.07 1.766-.376 2.838-.79 2.764-2.723 4.168-5.745 4.168H9.87a.77.77 0 0 0-.761  .641l-.87 5.49a.641.641 0 0 1-.633.54l-.53.001z" fill="#003087"/><path d="M19.  612 8.2c-.056-.392-.163-.758-.32-1.094-.62 3.4-2.76 5.13-6.354 5.13H10.71l-1.0  4 6.567h2.197a.641.641 0 0 0 .633-.54l.87-5.49a.77.77 0 0 1 .761-.641h1.325c2.  594 0 4.325-1.068 5.03-3.208.323-.98.37-1.822.126-2.724z" fill="#0070E0"/></sv  g>,
21:01:24.296                 },
21:01:24.296                 Zelle: {
21:01:24.296                   color: "#6D1ED4",
21:01:24.296                   hint:  `To: ${handle}`,
21:01:24.296                   icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="no  ne"><rect width="24" height="24" rx="5" fill="#6D1ED4"/><path d="M16.5 6H7.5L6   9h7.2L6 15h1.8L16.5 9v-.5L18 6h-1.5zm0 3h-7.2L16.5 15H18L16.5 9z" fill="white  "/></svg>,
21:01:24.296                 },
21:01:24.296               };
21:01:24.296   
21:01:24.296               const cfg = paymentConfig[seller.payment];
21:01:24.296               if (!cfg) return null;
21:01:24.296   
21:01:24.296               return (
21:01:24.296                 <div style={{ marginTop:14, padding:"14px 16px", background:"#11  1111", border:`2px solid ${cfg.color}33`, borderRadius:10 }}>
21:01:24.296                   <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", te  xtTransform:"uppercase", letterSpacing:1.5, marginBottom:10 }}>
21:01:24.296                     Payment -- <span style={{ color:cfg.color }}>{seller.payment  }</span>
21:01:24.297                   </div>
21:01:24.297                   <div style={{ display:"flex", alignItems:"center", justifyCont  ent:"space-between", gap:12, flexWrap:"wrap" }}>
21:01:24.297                     <div style={{ display:"flex", alignItems:"center", gap:12 }}  >
21:01:24.297                       {cfg.icon}
21:01:24.297                       <div>
21:01:24.297                         <div style={{ fontWeight:700, fontSize:14, color:cfg.col  or }}>{cfg.hint}</div>
21:01:24.297                         {amt && <div style={{ fontSize:12, color:"#AAAAAA", marg  inTop:2 }}>Amount: <strong style={{color:"#F0F0F0"}}>${amt}</strong></div>}
21:01:24.297                       </div>
21:01:24.297                     </div>
21:01:24.297                     <div style={{ display:"flex", flexDirection:"column", gap:4,   alignItems:"flex-end" }}>
21:01:24.297                       <div style={{ background:cfg.color, color:"#F0F0F0", borde  rRadius:9, padding:"10px 20px", fontSize:13, fontWeight:800 }}>Open {seller.pa  yment} App</div>
21:01:24.297                       <div style={{ fontSize:11, color:"#AAAAAA" }}>Send to: <st  rong style={{color:"#F0F0F0"}}>{handle}</strong></div>
21:01:24.297                     </div>
21:01:24.297                   </div>
21:01:24.297                 </div>
21:01:24.297               );
21:01:24.297             })()}
21:01:24.297   
21:01:24.298             <div style={{ marginTop:12, textAlign:"center", color:"#AAAAAA", fon  tSize:11, fontStyle:"italic" }}>This offer is valid for 7 days. Thank you for   bringing your collection to Bazooka!</div>
21:01:24.298           </div>
21:01:24.298         </div>
21:01:24.298       </div>
21:01:24.298     );
21:01:24.298   
21:01:24.298     return (
21:01:24.298       <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
21:01:24.298         {lightbox && (
21:01:24.298           <div onClick={()=>setLightbox(null)}
21:01:24.298             style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.92)", z  Index:99999, display:"flex", alignItems:"center", justifyContent:"center", cur  sor:"zoom-out" }}>
21:01:24.298             <img src={lightbox} alt="Lot photo" style={{ maxWidth:"90vw", maxHei  ght:"90vh", objectFit:"contain", borderRadius:10 }} onClick={e=>e.stopPropagat  ion()}/>
21:01:24.298             <button onClick={()=>setLightbox(null)} style={{ position:"fixed", t  op:20, right:24, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(25  5,255,255,0.2)", color:"#fff", borderRadius:"50%", width:40, height:40, fontSi  ze:20, cursor:"pointer", fontFamily:"inherit", lineHeight:1 }}>✕</button>
21:01:24.298           </div>
21:01:24.298         )}
21:01:24.298         <div style={S.card}>
21:01:24.298           <div style={{ display:"none" }}>
21:01:24.298             {[["builder","\uD83E\uDDEE Builder"],["quick","\u26A1 Quick Mode"],.  ..(["Admin","Procurement"].includes(userRole?.role)?[["history","\uD83D\uDCCB   History"]]:[] )].map(([mode,label]) => (
21:01:24.298               <button key={mode} onClick={()=>setCompMode(mode)} style={{ backgr  ound:compMode===mode?"#1A1A2E":"transparent", color:compMode===mode?"#E8317A":  "#9CA3AF", border:`1.5px solid ${compMode===mode?"#E8317A":"#E5E7EB"}`, border  Radius:8, padding:"6px 16px", fontSize:12, fontWeight:700, cursor:"pointer", f  ontFamily:"inherit" }}>{label}</button>
21:01:24.298             ))}
21:01:24.298           </div>
21:01:24.298           <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"repe  at(3,1fr)", gap:isMobile?6:8, marginTop:12 }}>
21:01:24.298             {[
21:01:24.298               { z:"\uD83D\uDFE2 Green",  p:"Under 65%", a:"Buy independently",     bg:"#0a1a0a", c:"#4ade80" },
21:01:24.298               { z:"\uD83D\uDFE1 Yellow", p:"65–70%",    a:"Flag before buying",     bg:"#FFF9DB", c:"#92400e" },
21:01:24.298               { z:"\uD83D\uDD34 Red",    p:"Over 70%",  a:"Pass or get approval"  , bg:"#FEE2E2", c:"#991b1b" },
21:01:24.298             ].map(({z,p,a,bg,c}) => (
21:01:24.298               <div key={z} style={{ display:"flex", alignItems:"center", gap:8,   padding:"7px 12px", background:bg, border:`1px solid ${c}22`, borderRadius:7,   flexWrap:"wrap" }}>
21:01:24.298                 <span style={{ fontWeight:800, color:c, fontSize:12 }}>{z}</span  >
21:01:24.298                 <span style={{ color:c, fontSize:11 }}>{p}</span>
21:01:24.298                 {!isMobile && <span style={{ color:"#AAAAAA", fontSize:11 }}>— {  a}</span>}
21:01:24.298               </div>
21:01:24.298             ))}
21:01:24.298           </div>
21:01:24.298         </div>
21:01:24.298   
21:01:24.298         {compMode==="quick" && (
21:01:24.298           <div style={S.card}>
21:01:24.298             <SectionLabel t="Quick Lot Comp" />
21:01:24.298             <p style={{ fontSize:12, color:"#AAAAAA", marginBottom:16 }}>Enter t  otal cards + avg market value per card for an instant offer.</p>
21:01:24.298             <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr",   gap:12, marginBottom:16 }}>
21:01:24.298               <div><label style={S.lbl}>Total Cards</label><input type="number"   value={quickCards} onChange={e=>setQuickCards(e.target.value)} placeholder="0"   style={S.inp}/></div>
21:01:24.298               <div><label style={S.lbl}>Avg Value/Card ($)</label><input type="n  umber" value={quickMktVal} onChange={e=>setQuickMktVal(e.target.value)} placeh  older="0.00" style={S.inp}/></div>
21:01:24.298               <div><label style={S.lbl}>Buy % (blank=60%)</label><input type="nu  mber" value={quickPct} onChange={e=>setQuickPct(e.target.value)} placeholder="  60" style={S.inp}/></div>
21:01:24.298               <div><label style={S.lbl}>Your Final Offer ($)</label><input type=  "number" value={quickOffer} onChange={e=>setQuickOffer(e.target.value)} placeh  older={quickCalcOffer.toFixed(2)} style={S.inp}/></div>
21:01:24.298             </div>
21:01:24.298             <div style={{ display:"grid", gridTemplateColumns:`repeat(${canSeeFi  nancials?4:2},1fr)`, gap:10 }}>
21:01:24.298               {[
21:01:24.298                 ...(canSeeFinancials ? [
21:01:24.298                   { l:"Total Market Value", v:`$${quickTotal.toFixed(2)}`,     c  :"#92400e" },
21:01:24.298                   { l:"Calculated Offer",   v:`$${quickCalcOffer.toFixed(2)}`, c  :"#166534" },
21:01:24.298                 ] : []),
21:01:24.298                 { l:"Your Offer",  v:`$${quickOfferAmt.toFixed(2)}`,  c:"#6B2D8B  " },
21:01:24.298                 { l:"Lot Zone",    v:quickZone?quickZone.label:"--",   c:quickZo  ne?.color||"#9CA3AF" },
21:01:24.298               ].map(({l,v,c}) => (
21:01:24.298                 <div key={l} style={{ background:"#111111", border:"1px solid #2  a2a2a", borderRadius:10, padding:"12px", textAlign:"center" }}>
21:01:24.298                   <div style={{ fontSize:18, fontWeight:900, color:c, marginBott  om:4 }}>{v}</div>
21:01:24.298                   <div style={{ fontSize:10, color:"#AAAAAA", textTransform:"upp  ercase", letterSpacing:1 }}>{l}</div>
21:01:24.298                 </div>
21:01:24.298               ))}
21:01:24.298             </div>
21:01:24.298           </div>
21:01:24.298         )}
21:01:24.298   
21:01:24.298         {compMode==="history" && (() => {
21:01:24.298           const activeQuotes = quotes.filter(q => !q.bazookaClosed);
21:01:24.298   
21:01:24.298           return (
21:01:24.298           <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
21:01:24.298   
21:01:24.299             {/* -- ACTIVE QUOTES -- */}
21:01:24.299             {activeQuotes.length > 0 && (
21:01:24.299               <div style={{ ...S.card, border:"2px solid rgba(232,49,122,0.3)" }  }>
21:01:24.299                 <SectionLabel t="🔗 Active Quote Links" />
21:01:24.299                 <div style={{ display:"flex", flexDirection:"column", gap:10 }}>                  {activeQuotes.map(q => {
21:01:24.299                     // Auto-dismiss badge when admin views a responded quote
21:01:24.299                     // Note: notifications are dismissed from the Dashboard, not   auto-dismissed here
21:01:24.299                     const statusCfg = {
21:01:24.299                       pending:   { color:"#888",    bg:"#1a1a1a",  label:"\u23F3   Awaiting Response" },
21:01:24.299                       countered: { color:"#FBBF24", bg:"#1a1400",  label:"\uD83E  \uDD1D Counter Received" },
21:01:24.299                       accepted:  { color:"#4ade80", bg:"#0a1a0a",  label:"\u2705   Accepted" },
21:01:24.299                       declined:  { color:"#E8317A", bg:"#1a0a0a",  label:"\u274C   Declined" },
21:01:24.299                     }[q.status] || { color:"#888", bg:"#1a1a1a", label:q.status   };
21:01:24.299   
21:01:24.299                     const quoteUrl = `${window.location.origin}/quote/${q.id}`;
21:01:24.299                     const expiresAt = new Date(new Date(q.createdAt).getTime()+7  *24*60*60*1000);
21:01:24.299                     const daysLeft = Math.max(0,Math.ceil((expiresAt-new Date())  /86400000));
21:01:24.299   
21:01:24.299                     return (
21:01:24.299                       <div key={q.id} style={{ background:statusCfg.bg, border:`  1px solid ${statusCfg.color}33`, borderRadius:10, padding:"14px 16px" }}>
21:01:24.299                         <div style={{ display:"flex", justifyContent:"space-betw  een", alignItems:"flex-start", marginBottom:10, flexWrap:"wrap", gap:8 }}>
21:01:24.299                           <div>
21:01:24.299                             <div style={{ display:"flex", alignItems:"center", g  ap:8, marginBottom:4, flexWrap:"wrap" }}>
21:01:24.299                               <span style={{ fontWeight:800, fontSize:14, color:  "#F0F0F0" }}>{q.seller?.name||"Unknown Seller"}</span>
21:01:24.299                               <span style={{ background:statusCfg.bg, color:stat  usCfg.color, border:`1px solid ${statusCfg.color}44`, borderRadius:20, padding  :"2px 10px", fontSize:11, fontWeight:700 }}>{statusCfg.label}</span>
21:01:24.299                               {q.quoteRef && <span style={{ fontSize:11, fontWei  ght:700, color:"#7B9CFF", background:"rgba(123,156,255,0.08)", border:"1px sol  id rgba(123,156,255,0.2)", borderRadius:6, padding:"2px 8px", letterSpacing:0.  5 }}>{q.quoteRef}</span>}
21:01:24.299                             </div>
21:01:24.299                             <div style={{ display:"flex", alignItems:"center", g  ap:6, marginBottom:4, flexWrap:"wrap" }}>
21:01:24.299                               <span style={{ fontSize:11, color:"#555" }}>
21:01:24.299                                 Quoted by <strong style={{ color:"#AAAAAA" }}>{q  .quotedBy?.split(" ")[0] || "Unknown"}</strong>
21:01:24.299                               </span>
21:01:24.299                               {q.lastUpdatedBy && q.lastUpdatedBy !== q.quotedBy   && (
21:01:24.299                                 <span style={{ fontSize:11, color:"#555" }}>· Up  dated by <strong style={{ color:"#AAAAAA" }}>{q.lastUpdatedBy.split(" ")[0]}</  strong></span>
21:01:24.299                               )}
21:01:24.299                               {q.createdAt && <span style={{ fontSize:11, color:  "#444" }}>· {new Date(q.createdAt).toLocaleDateString("en-US",{month:"short",d  ay:"numeric"})}</span>}
21:01:24.299                             </div>
21:01:24.299                             <div style={{ fontSize:11, color:"#666" }}>
21:01:24.299                               {q.cards?.length||0} cards · Offer: <strong style=  {{color:"#E8317A"}}>${parseFloat(q.currentOffer||q.dispOffer||0).toFixed(2)}</  strong>
21:01:24.299                               {q.status==="countered" && <> · Counter: <strong s  tyle={{color:"#FBBF24"}}>${parseFloat(q.sellerCounter||0).toFixed(2)}</strong>  </>}
21:01:24.299                               {q.status==="accepted" && q.sellerPayment && <> ·   Payment: <strong style={{color:"#4ade80"}}>{q.sellerPayment}{q.sellerHandle?`   -- ${q.sellerHandle}`:""}</strong></>}
21:01:24.299                               &nbsp;· {daysLeft}d left
21:01:24.300                             </div>
21:01:24.300                             {/* Lot photos */}
21:01:24.300                             {(q.photoUrls||[]).length > 0 && (
21:01:24.300                               <div style={{ display:"flex", gap:6, flexWrap:"wra  p", marginTop:6 }}>
21:01:24.300                                 {(q.photoUrls||[]).map((url,i)=>(
21:01:24.300                                   <img key={i} src={url} alt={`Lot photo ${i+1}`  }
21:01:24.300                                     onClick={()=>setLightbox(url)}
21:01:24.300                                     style={{ width:60, height:60, objectFit:"cov  er", borderRadius:6, border:"1px solid #2a2a2a", cursor:"zoom-in" }}/>
21:01:24.300                                 ))}
21:01:24.300                                 <div style={{ fontSize:10, color:"#555", alignSe  lf:"center" }}>📸 {(q.photoUrls||[]).length} photo{(q.photoUrls||[]).length!==  1?"s":""}</div>
21:01:24.300                               </div>
21:01:24.300                             )}
21:01:24.300                             {/* View tracking */}
21:01:24.300                             <div style={{ display:"flex", alignItems:"center", g  ap:8, marginTop:4 }}>
21:01:24.300                               {(q.viewCount||0) === 0
21:01:24.300                                 ? <span style={{ fontSize:11, color:"#444" }}>{"  \uD83D\uDC41 Not opened yet"}</span>
21:01:24.300                                 : <span style={{ fontSize:11, color:(q.viewCount  ||0)>=5?"#FBBF24":"#7B9CFF", fontWeight:700 }}>
21:01:24.300                                     {"\uD83D\uDC41 Opened "}{q.viewCount} time{q  .viewCount!==1?"s":""}
21:01:24.300                                     {q.lastViewedAt && <span style={{color:"#555  ",fontWeight:400}}> · Last: {new Date(q.lastViewedAt).toLocaleDateString("en-U  S",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</span>}
21:01:24.300                                     {(q.viewCount||0)>=5 && <span style={{color:  "#FBBF24",marginLeft:6}}>{"\uD83D\uDD25 Interested!"}</span>}
21:01:24.300                                   </span>
21:01:24.300                               }
21:01:24.300                             </div>
21:01:24.300                           </div>
21:01:24.300                           <div style={{ display:"flex", gap:6, flexWrap:"wrap" }  }>
21:01:24.300                             <button onClick={()=>{ navigator.clipboard?.writeTex  t(quoteUrl); }} style={{ background:"none", border:"1px solid #333", color:"#8  88", borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFa  mily:"inherit" }}>{"\uD83D\uDCCB Copy Link"}</button>
21:01:24.300                             <a href={quoteUrl} target="_blank" rel="noreferrer"   style={{ background:"none", border:"1px solid #E8317A44", color:"#E8317A", bor  derRadius:7, padding:"4px 10px", fontSize:11, fontWeight:700, textDecoration:"  none" }}>{"View \u2197"}</a>
21:01:24.300                             {parseFloat(q.currentOffer||q.dispOffer) > 0 && (
21:01:24.300                               <button onClick={()=>{
21:01:24.300                                 const msg = `Hey${q.seller?.name?" "+q.seller.na  me:""}! We reviewed your cards and have an offer ready. Check it out here and   let us know what you think:\n\n${quoteUrl}`;
21:01:24.300                                 navigator.clipboard?.writeText(msg);
21:01:24.300                               }} style={{ background:"rgba(74,222,128,0.12)", bo  rder:"1px solid rgba(74,222,128,0.3)", color:"#4ade80", borderRadius:7, paddin  g:"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inher  it" }}>{"📤 Send Offer to Seller"}</button>
21:01:24.300                             )}
21:01:24.300                             <button onClick={()=>{
21:01:24.300                               const cards = (q.cards||[]).map(c=>({ name:c.cardN  ame||c.name||"", cardType:c.cardType||"", mktVal:c.mktVal||c.marketValue||0, q  ty:c.qty||1 }));
21:01:24.300                               const totalMv = cards.reduce((s,c)=>(s+(parseFloat  (c.mktVal)||0)*(parseInt(c.qty)||1)),0);
21:01:24.300                               const offer = parseFloat(q.currentOffer||q.dispOff  er)||0;
21:01:24.300                               const pct = totalMv > 0 ? ((offer/totalMv)*100).to  Fixed(1) : "60";
21:01:24.301                               loadComp({ id:q.id, seller:q.seller?.name||"", con  tact:q.seller?.contact||"", date:q.seller?.date||"", source:q.seller?.source||  "", payment:q.seller?.payment||"", paymentHandle:q.seller?.paymentHandle||"",   offer:0, cards });
21:01:24.301                               setLotPct(pct);
21:01:24.301                             }} style={{ background:"rgba(123,156,255,0.1)", bord  er:"1px solid rgba(123,156,255,0.3)", color:"#7B9CFF", borderRadius:7, padding  :"4px 10px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inheri  t" }}>{"\u270F\uFE0F Edit in Builder"}</button>
21:01:24.301                             {onCloseQuote && <button onClick={()=>{ if(window.co  nfirm("Close this quote? The seller's link will show as expired.")) onCloseQuo  te(q.id); }} style={{ background:"none", border:"1px solid #333", color:"#555"  , borderRadius:7, padding:"4px 10px", fontSize:11, cursor:"pointer", fontFamil  y:"inherit" }}>{"\uD83D\uDD12 Close"}</button>}
21:01:24.301                           </div>
21:01:24.301                         </div>
21:01:24.301   
21:01:24.301                         {/* Counter response UI */}
21:01:24.301                         {q.status==="countered" && (
21:01:24.301                           <div style={{ borderTop:"1px solid #333", paddingTop:1  0, display:"flex", gap:10, alignItems:"flex-end", flexWrap:"wrap" }}>
21:01:24.301                             <div style={{ flex:1, minWidth:160 }}>
21:01:24.301                               <label style={{ fontSize:10, fontWeight:700, color  :"#777", textTransform:"uppercase", letterSpacing:1.5, display:"block", margin  Bottom:6 }}>Your Counter Back ($)</label>
21:01:24.301                               <input
21:01:24.301                                 type="number" step="0.01" min="0"
21:01:24.301                                 value={bzCounterAmt[q.id]||""}
21:01:24.301                                 onChange={e=>setBzCounterAmt(p=>({...p,[q.id]:e.  target.value}))}
21:01:24.301                                 placeholder={`Their counter: $${parseFloat(q.sel  lerCounter||0).toFixed(2)}`}
21:01:24.301                                 style={{ ...S.inp, color:"#FBBF24" }}
21:01:24.301                               />
21:01:24.301                               {/* Live % preview */}
21:01:24.301                               {bzCounterAmt[q.id] && parseFloat(bzCounterAmt[q.i  d]) > 0 && (() => {
21:01:24.301                                 const totalMkt = (q.cards||[]).reduce((s,c)=>(s+  (parseFloat(c.mktVal)||0)*(parseInt(c.qty)||1)),0);
21:01:24.301                                 const counterVal = parseFloat(bzCounterAmt[q.id]  );
21:01:24.301                                 const pct = totalMkt > 0 ? (counterVal/totalMkt)  *100 : null;
21:01:24.301                                 const origOffer = parseFloat(q.dispOffer||0);
21:01:24.301                                 const origPct = totalMkt > 0 ? (origOffer/totalM  kt)*100 : null;
21:01:24.301                                 const sellerPct = totalMkt > 0 ? (parseFloat(q.s  ellerCounter||0)/totalMkt)*100 : null;
21:01:24.301                                 const zone = pct < 65 ? {c:"#4ade80",l:"\uD83D\u  DFE2 Green Zone"} : pct < 70 ? {c:"#FBBF24",l:"\uD83D\uDFE1 Yellow Zone"} : {c  :"#E8317A",l:"\uD83D\uDD34 Red Zone"};
21:01:24.301                                 return (
21:01:24.301                                   <div style={{ marginTop:8, display:"flex", gap  :8, flexWrap:"wrap" }}>
21:01:24.301                                     <div style={{ background:"#1a1a1a", border:`  1px solid ${zone.c}44`, borderRadius:7, padding:"5px 10px", fontSize:11 }}>
21:01:24.301                                       <span style={{ color:"#666" }}>Your counte  r: </span>
21:01:24.301                                       <strong style={{ color:zone.c }}>{pct?pct.  toFixed(1)+"%":"--"}</strong>
21:01:24.301                                       <span style={{ color:"#555", marginLeft:4   }}>{zone.l}</span>
21:01:24.301                                     </div>
21:01:24.301                                     {origPct && <div style={{ background:"#1a1a1  a", border:"1px solid #333", borderRadius:7, padding:"5px 10px", fontSize:11 }  }>
21:01:24.301                                       <span style={{ color:"#666" }}>Our offer:   </span>
21:01:24.301                                       <strong style={{ color:"#E8317A" }}>{origP  ct.toFixed(1)}%</strong>
21:01:24.302                                     </div>}
21:01:24.302                                     {sellerPct && <div style={{ background:"#1a1  a1a", border:"1px solid #333", borderRadius:7, padding:"5px 10px", fontSize:11   }}>
21:01:24.302                                       <span style={{ color:"#666" }}>Their ask:   </span>
21:01:24.302                                       <strong style={{ color:"#FBBF24" }}>{selle  rPct.toFixed(1)}%</strong>
21:01:24.302                                     </div>}
21:01:24.302                                   </div>
21:01:24.302                                 );
21:01:24.302                               })()}
21:01:24.302                             </div>
21:01:24.302                             <Btn onClick={()=>{ if(onBazookaCounter&&bzCounterAm  t[q.id]) { onBazookaCounter(q.id,parseFloat(bzCounterAmt[q.id]),q.history||[])  ; setBzCounterAmt(p=>({...p,[q.id]:""})); }}} disabled={!bzCounterAmt[q.id]} v  ariant="ghost">{"\uD83E\uDD1D Send Counter"}</Btn>
21:01:24.302                             <Btn onClick={()=>{ if(onCloseQuote) onCloseQuote(q.  id); }} variant="ghost">{"\u274C Close (admin only)"}</Btn>
21:01:24.302                             {q.status==="countered" && (
21:01:24.302                               <Btn onClick={async()=>{
21:01:24.302                                 // Accept their counter -- update offer to their   counter amount
21:01:24.302                                 if(onBazookaCounter) {
21:01:24.302                                   await setDoc(doc(db,"quotes",q.id),{ status:"p  ending", currentOffer:parseFloat(q.sellerCounter), history:[...(q.history||[])  ,{type:"bazooka_accepted_counter",amount:parseFloat(q.sellerCounter),timestamp  :new Date().toISOString()}], notified:false },{ merge:true });
21:01:24.302                                   showToast?.(`\u2705 Accepted counter at $${par  seFloat(q.sellerCounter).toFixed(2)}`);
21:01:24.302                                 }
21:01:24.302                               }} variant="green">{"\u2705 Accept Their Counter"}  </Btn>
21:01:24.302                             )}
21:01:24.302                           </div>
21:01:24.302                         )}
21:01:24.302   
21:01:24.302                         {/* Accepted -- import prompt */}
21:01:24.302                         {q.status==="accepted" && (
21:01:24.302                           <div style={{ borderTop:"1px solid #333", paddingTop:1  0, display:"flex", alignItems:"center", justifyContent:"space-between", flexWr  ap:"wrap", gap:8 }}>
21:01:24.302                             <span style={{ fontSize:12, color:"#4ade80" }}>{"\uD  83C\uDF89 Seller accepted! Ready to import into inventory."}</span>
21:01:24.302                             <button onClick={()=>{ loadComp({ seller:q.seller?.n  ame, contact:q.seller?.contact, date:q.seller?.date, source:q.seller?.source,   payment:q.sellerPayment, paymentHandle:q.sellerHandle, cards:q.cards, offer:pa  rseFloat(q.currentOffer||q.dispOffer), id:q.id }); setCompMode("builder"); }}   style={{ background:"#166534", color:"#fff", border:"none", borderRadius:8, pa  dding:"7px 16px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"i  nherit" }}>{"\uD83D\uDCE5 Load into Builder & Import"}</button>
21:01:24.302                           </div>
21:01:24.302                         )}
21:01:24.302                       </div>
21:01:24.302                     );
21:01:24.302                   })}
21:01:24.302                 </div>
21:01:24.302               </div>
21:01:24.302             )}
21:01:24.302   
21:01:24.302             {/* -- SAVED COMPS -- */}
21:01:24.302             {(!comps||comps.length===0)
21:01:24.302               ? <div style={{ ...S.card, textAlign:"center", padding:"60px", col  or:"#D1D5DB" }}>No comps saved yet.</div>
21:01:24.302               : comps.map(c => {
21:01:24.303                   const z = getZone(c.blendedPct);
21:01:24.303                   const savedByRole = Object.entries(ROLES).find(([k]) => (c.sav  edBy||"").toLowerCase().includes(k))?.[1];
21:01:24.303                   const savedAt = c.dateAdded ? new Date(c.dateAdded).toLocaleSt  ring() : c.date;
21:01:24.303                   return (
21:01:24.303                     <div key={c.id} style={{ ...S.card, border:`1px solid ${z?.c  olor||"#F0D0DC"}33` }}>
21:01:24.303                       <div style={{ display:"flex", justifyContent:"space-betwee  n", alignItems:"flex-start", marginBottom:10 }}>
21:01:24.303                         <div>
21:01:24.303                           <div style={{ display:"flex", alignItems:"center", gap  :8, marginBottom:4 }}>
21:01:24.303                             <span style={{ fontWeight:800, fontSize:15, color:"#  F0F0F0" }}>{c.seller||"Unknown Seller"}</span>
21:01:24.303                             <span style={{ background:c.status==="accepted"?"#D6  F4E3":c.status==="passed"?"#FEE2E2":"#FFF9DB", color:c.status==="accepted"?"#1  66534":c.status==="passed"?"#991b1b":"#92400e", borderRadius:5, padding:"2px 8  px", fontSize:11, fontWeight:700 }}>
21:01:24.303                               {c.status==="accepted"?"\u2705 Accepted":c.status=  =="passed"?"\u274C Passed":"\uD83D\uDCBE Saved"}
21:01:24.303                             </span>
21:01:24.303                             {z && canSeeFinancials && <span style={{ background:  z.bg, color:z.color, borderRadius:5, padding:"2px 8px", fontSize:11, fontWeigh  t:700 }}>{z.label}</span>}
21:01:24.303                           </div>
21:01:24.303                           <div style={{ display:"flex", alignItems:"center", gap  :8, flexWrap:"wrap" }}>
21:01:24.303                             <span style={{ fontSize:11, color:"#AAAAAA" }}>Saved   by</span>
21:01:24.303                             <span style={{ fontWeight:700, fontSize:12, color:"#  F0F0F0" }}>{c.savedBy||"--"}</span>
21:01:24.303                             {savedByRole && <span style={{ background:savedByRol  e.bg, color:savedByRole.color, border:`1px solid ${savedByRole.color}33`, bord  erRadius:10, padding:"1px 7px", fontSize:10, fontWeight:700 }}>{savedByRole.la  bel}</span>}
21:01:24.303                             {c.quotedBy && c.quotedBy !== c.savedBy && <>
21:01:24.303                               <span style={{ fontSize:11, color:"#D1D5DB" }}>·</  span>
21:01:24.303                               <span style={{ fontSize:11, color:"#555" }}>Quoted   by <strong style={{ color:"#AAAAAA" }}>{c.quotedBy?.split(" ")[0] || "Unknown  "}</strong></span>
21:01:24.303                             </>}
21:01:24.303                             <span style={{ fontSize:11, color:"#D1D5DB" }}>·</sp  an>
21:01:24.303                             <span style={{ fontSize:11, color:"#AAAAAA" }}>{save  dAt}</span>
21:01:24.303                             {c.quoteRef && <span style={{ fontSize:11, fontWeigh  t:700, color:"#7B9CFF", background:"rgba(123,156,255,0.08)", border:"1px solid   rgba(123,156,255,0.2)", borderRadius:6, padding:"2px 8px", letterSpacing:0.5   }}>{c.quoteRef}</span>}
21:01:24.303                           </div>
21:01:24.303                         </div>
21:01:24.303                         <div style={{ display:"flex", gap:8, alignItems:"center"  , flexShrink:0 }}>
21:01:24.303                           <button onClick={()=>loadComp(c)} style={{ background:  "#1A1A2E", color:"#E8317A", border:"1.5px solid #E8317A", borderRadius:7, padd  ing:"4px 12px", fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inh  erit" }}>{"\uD83D\uDCE5 Load into Builder"}</button>
21:01:24.303                           {CAN_DELETE.includes(userRole?.role) && <button onClic  k={()=>{ if(window.confirm(`Delete this comp from history?\n\nSaved by: ${c.sa  vedBy||"Unknown"}\nSeller: ${c.seller||"Unknown"}\n\nThis action will be logge  d.`)) onDeleteComp(c.id); }} style={{ background:"#111111", color:"#E8317A", b  order:"1.5px solid #fca5a5", borderRadius:7, padding:"4px 12px", fontSize:11,   fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{"\uD83D\uDDD1"}</bu  tton>}
21:01:24.303                         </div>
21:01:24.303                       </div>
21:01:24.303                       <div style={{ display:"flex", gap:16, flexWrap:"wrap", pad  dingTop:8, borderTop:"1px solid #FFF0F5" }}>
21:01:24.303                         <span style={{ fontSize:12, color:"#AAAAAA" }}>Cards: <s  trong style={{color:"#F0F0F0"}}>{c.totalCards}</strong></span>
21:01:24.303                         {canSeeFinancials && <>
21:01:24.303                           <span style={{ fontSize:12, color:"#AAAAAA" }}>Market:   <strong style={{color:"#AAAAAA"}}>${(c.totalMarket||0).toFixed(2)}</strong></  span>
21:01:24.303                           <span style={{ fontSize:12, color:"#AAAAAA" }}>Offer:   <strong style={{color:"#E8317A"}}>${(c.offer||0).toFixed(2)}</strong></span>
21:01:24.303                           <span style={{ fontSize:12, color:"#AAAAAA" }}>Blended  : <strong style={{color:z?.color||"#F0F0F0"}}>{((c.blendedPct||0)*100).toFixed  (1)}%</strong></span>
21:01:24.303                         </>}
21:01:24.303                         <span style={{ fontSize:12, color:"#AAAAAA" }}>Source: <  strong style={{color:"#F0F0F0"}}>{c.source||"--"}</strong></span>
21:01:24.304                         <span style={{ fontSize:12, color:"#AAAAAA" }}>
21:01:24.304                           {c.cards&&c.cards.length>0 ? <span style={{color:"#E83  17A",fontWeight:700}}>{"\u2713"}{c.cards.length} card{c.cards.length!==1?"s":"  "} saved</span> : <span style={{color:"#AAAAAA",fontWeight:700}}>{"\u26A0 No c  ard details"}</span>}
21:01:24.304                         </span>
21:01:24.304                       </div>
21:01:24.304                     </div>
21:01:24.304                   );
21:01:24.304                 })
21:01:24.304             }
21:01:24.304           </div>
21:01:24.304           );
21:01:24.304         })()}
21:01:24.304   
21:01:24.304         {compMode==="builder" && <>
21:01:24.304           <div className="lot-comp-grid" style={{ display:"grid", gridTemplateCo  lumns: seller.name ? "1fr 300px" : "1fr", gap:14, alignItems:"start" }}>
21:01:24.304           <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
21:01:24.304           {loadedCompId && (
21:01:24.304             <div id="comp-builder-top" style={{ background: loadedCompHadCards ?   "#D6F4E3" : "#FFF9DB", border: `1.5px solid ${loadedCompHadCards ? "#2E7D52"   : "#92400e"}`, borderRadius:10, padding:"12px 18px", display:"flex", alignItem  s:"center", justifyContent:"space-between" }}>
21:01:24.304               <div style={{ display:"flex", alignItems:"center", gap:10 }}>
21:01:24.304                 <span style={{ fontSize:18 }}>{loadedCompHadCards ? "\u2705" : "  \u26A0\uFE0F"}</span>
21:01:24.304                 <div>
21:01:24.304                   <div style={{ fontWeight:700, fontSize:13, color: loadedCompHa  dCards ? "#166534" : "#92400e" }}>
21:01:24.304                     {loadedCompHadCards ? "Comp loaded -- ready to edit and impo  rt" : "Comp loaded -- no card data saved"}
21:01:24.304                   </div>
21:01:24.304                   <div style={{ fontSize:11, color:"#AAAAAA", marginTop:2 }}>
21:01:24.304                     {loadedCompHadCards ? "All seller info, cards, and offer amo  unt restored. Hit Accept & Import to add to inventory." : "Seller info and off  er restored, but this comp was saved without per-card details. Add cards manua  lly below."}
21:01:24.304                   </div>
21:01:24.305                 </div>
21:01:24.305               </div>
21:01:24.305               <button onClick={()=>setLoadedCompId(null)} style={{ background:"t  ransparent", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:18, li  neHeight:1 }}>{"\u2715"}</button>
21:01:24.305             </div>
21:01:24.305           )}
21:01:24.305           <div id="comp-builder-top" style={S.card}>
21:01:24.305             <SectionLabel t="Seller Information" />
21:01:24.305             <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr":"1f  r 1fr 1fr", gap:12 }}>
21:01:24.305               {/* Seller Name with autocomplete from history */}
21:01:24.305               {(() => {
21:01:24.305                 const prevSellers = [...new Map(
21:01:24.305                   [...comps].reverse()
21:01:24.305                     .filter(c => c.seller)
21:01:24.305                     .map(c => [c.seller.toLowerCase(), c])
21:01:24.305                 ).values()].slice(0, 50);
21:01:24.305   
21:01:24.305                 const q = (seller.name||"").toLowerCase();
21:01:24.305                 const suggestions = q.length >= 1
21:01:24.305                   ? prevSellers.filter(c => c.seller.toLowerCase().includes(q) &  & c.seller.toLowerCase() !== q)
21:01:24.305                   : [];
21:01:24.305   
21:01:24.305                 function fillSeller(comp) {
21:01:24.305                   setSeller(p => ({
21:01:24.305                     ...p,
21:01:24.305                     name: comp.seller||"",
21:01:24.305                     contact: comp.contact||p.contact,
21:01:24.305                     source: comp.source||p.source,
21:01:24.305                     payment: comp.payment||p.payment,
21:01:24.305                     paymentHandle: comp.paymentHandle||p.paymentHandle,
21:01:24.305                   }));
21:01:24.305                 }
21:01:24.305   
21:01:24.305                 return (
21:01:24.305                   <Field label="Seller Name">
21:01:24.305                     <div style={{ position:"relative" }}>
21:01:24.305                       <input
21:01:24.305                         type="text"
21:01:24.305                         value={seller.name}
21:01:24.305                         onChange={e => setSeller(p=>({...p, name:e.target.value}  ))}
21:01:24.305                         placeholder="Seller name..."
21:01:24.305                         style={S.inp}
21:01:24.305                         autoComplete="off"
21:01:24.305                       />
21:01:24.305                       {suggestions.length > 0 && (
21:01:24.305                         <div style={{ position:"absolute", top:"100%", left:0, r  ight:0, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, zInd  ex:999, overflow:"hidden", boxShadow:"0 8px 24px rgba(0,0,0,0.6)", maxHeight:2  40, overflowY:"auto" }}>
21:01:24.305                           {suggestions.map((c,i) => {
21:01:24.305                             const lastComp = comps.filter(x=>x.seller===c.seller  ).slice(-1)[0];
21:01:24.305                             const totalBought = comps.filter(x=>x.seller===c.sel  ler).reduce((s,x)=>s+(parseFloat(x.offer)||0),0);
21:01:24.305                             const dealCount = comps.filter(x=>x.seller===c.selle  r).length;
21:01:24.305                             return (
21:01:24.305                               <div key={i} onMouseDown={()=>fillSeller(c)}
21:01:24.305                                 style={{ display:"flex", alignItems:"center", ga  p:10, padding:"8px 12px", borderBottom:"1px solid #111", cursor:"pointer", bac  kground:"#1a1a1a" }}
21:01:24.305                                 className="inv-row">
21:01:24.305                                 <div style={{ flex:1, minWidth:0 }}>
21:01:24.305                                   <div style={{ fontSize:13, fontWeight:700, col  or:"#F0F0F0" }}>{c.seller}</div>
21:01:24.305                                   <div style={{ fontSize:10, color:"#555", margi  nTop:1 }}>
21:01:24.305                                     {dealCount} deal{dealCount!==1?"s":""} · ${M  ath.round(totalBought).toLocaleString()} total
21:01:24.305                                     {c.source && <span style={{ marginLeft:6, co  lor:"#7B9CFF" }}>{c.source}</span>}
21:01:24.306                                   </div>
21:01:24.306                                 </div>
21:01:24.306                                 <div style={{ textAlign:"right", flexShrink:0 }}  >
21:01:24.306                                   {c.payment && <div style={{ fontSize:10, color  :"#FBBF24" }}>{c.payment}</div>}
21:01:24.306                                   {lastComp?.date && <div style={{ fontSize:10,   color:"#333" }}>Last: {lastComp.date}</div>}
21:01:24.306                                 </div>
21:01:24.306                               </div>
21:01:24.306                             );
21:01:24.306                           })}
21:01:24.306                         </div>
21:01:24.306                       )}
21:01:24.306                     </div>
21:01:24.306                   </Field>
21:01:24.306                 );
21:01:24.306               })()}
21:01:24.306               <TextInput label="Contact"          value={seller.contact} onChang  e={v=>setSeller(p=>({...p,contact:v}))} />
21:01:24.306               <TextInput label="Date" type="date" value={seller.date}    onChang  e={v=>setSeller(p=>({...p,date:v}))} />
21:01:24.306               <SelectInput label="Payment Method" value={seller.payment} onChang  e={v=>setSeller(p=>({...p,payment:v,paymentHandle:""}))} options={PAYMENT_METH  ODS} />
21:01:24.306               <TextInput
21:01:24.306                 label={seller.payment==="PayPal" ? "PayPal Username / Email" : s  eller.payment==="Zelle" ? "Zelle Email or Phone" : "Payment Handle / Info"}
21:01:24.306                 value={seller.paymentHandle}
21:01:24.306                 onChange={v=>setSeller(p=>({...p,paymentHandle:v}))}
21:01:24.306                 placeholder={seller.payment==="Venmo" ? "@theirhandle" : seller.  payment==="PayPal" ? "username or email" : seller.payment==="Zelle" ? "email o  r phone" : "handle or account info"}
21:01:24.306               />
21:01:24.306               <SelectInput label="Source"         value={seller.source}  onChang  e={v=>setSeller(p=>({...p,source:v}))}  options={SOURCES} />
21:01:24.306             </div>
21:01:24.306           </div>
21:01:24.306   
21:01:24.306           {/* ── STICKY OFFER SUMMARY BAR ── */}
21:01:24.306           <div style={{ position:"sticky", top:64, zIndex:200, background:"#0d0d  0d", border:"1px solid #1a1a1a", borderRadius:14, padding:"12px 16px", marginB  ottom:12, backdropFilter:"blur(12px)" }}>
21:01:24.306             <div style={{ display:"grid", gridTemplateColumns:isMobile?"1fr 1fr"  :"repeat(5,1fr)", gap:10, alignItems:"end" }}>
21:01:24.306   
21:01:24.306               {/* Buy % */}
21:01:24.306               <div>
21:01:24.306                 <label style={{ ...S.lbl, color:"#E8317A" }}>Buy % of Market</la  bel>
21:01:24.306                 <div style={{ position:"relative" }}>
21:01:24.306                   <input type="text" inputMode="decimal" value={lotPct}
21:01:24.306                     onChange={e => { setLotPct(e.target.value); setFOffer(""); }  }
21:01:24.306                     placeholder="60"
21:01:24.306                     style={{ ...S.inp, fontWeight:800, color:"#E8317A", fontSize  :15, paddingRight:28, border:"1px solid rgba(232,49,122,0.3)" }}/>
21:01:24.306                   <span style={{ position:"absolute", right:10, top:"50%", trans  form:"translateY(-50%)", fontSize:13, color:"#555" }}>%</span>
21:01:24.306                 </div>
21:01:24.306               </div>
21:01:24.306   
21:01:24.306               {/* Override $ */}
21:01:24.306               <div>
21:01:24.306                 <label style={S.lbl}>Override Offer ($)</label>
21:01:24.306                 <input type="text" inputMode="decimal" value={finalOffer}
21:01:24.306                   onChange={e => { setFOffer(e.target.value); setLotPct(""); }}
21:01:24.306                   placeholder={totalMkt > 0 ? calcOffer.toFixed(2) : "0.00"}
21:01:24.306                   style={{ ...S.inp, fontWeight:700, color:(offerAmt!=null&&offe  rAmt>0)?"#E8317A":"#9CA3AF", border:(offerAmt!=null&&offerAmt>0)?"1.5px solid   rgba(232,49,122,0.5)":"1px solid #2a2a2a" }}/>
21:01:24.306               </div>
21:01:24.306   
21:01:24.306               {/* Active Offer — big */}
21:01:24.306               <div>
21:01:24.306                 <label style={S.lbl}>Active Offer</label>
21:01:24.306                 <div style={{ background:"rgba(232,49,122,0.08)", border:"1.5px   solid rgba(232,49,122,0.25)", borderRadius:8, padding:"8px 14px", display:"fle  x", alignItems:"baseline", justifyContent:"space-between" }}>
21:01:24.306                   <span style={{ fontSize:20, fontWeight:900, color:"#E8317A" }}  >${dispOffer.toFixed(2)}</span>
21:01:24.306                   <span style={{ fontSize:10, color:"#555" }}>{(dispPct*100).toF  ixed(0)}%</span>
21:01:24.306                 </div>
21:01:24.306               </div>
21:01:24.306   
21:01:24.306               {/* Market value */}
21:01:24.306               <div>
21:01:24.306                 <label style={S.lbl}>Total Market Value</label>
21:01:24.306                 <div style={{ background:"#111", border:"1px solid #2a2a2a", bor  derRadius:8, padding:"8px 14px", display:"flex", alignItems:"baseline", justif  yContent:"space-between" }}>
21:01:24.306                   <span style={{ fontSize:16, fontWeight:700, color:"#888" }}>{t  otalMkt>0?`$${totalMkt.toFixed(2)}`:"—"}</span>
21:01:24.306                   {totalMkt>0&&<span style={{ fontSize:10, color:"#555" }}>{tota  lCards} card{totalCards!==1?"s":""}</span>}
21:01:24.306                 </div>
21:01:24.306               </div>
21:01:24.307   
21:01:24.307               {/* Zone — big color chip */}
21:01:24.307               {(() => {
21:01:24.307                 const z = lotZone;
21:01:24.307                 const ZONES = {
21:01:24.307                   "🟢 Green":  { bg:"rgba(74,222,128,0.1)",  border:"rgba(74,222  ,128,0.3)",  text:"#4ade80",  label:"Slam Dunk",    sub:"Under 65%" },
21:01:24.307                   "🟡 Yellow": { bg:"rgba(251,191,36,0.1)",  border:"rgba(251,19  1,36,0.3)",  text:"#FBBF24",  label:"Fair Deal",    sub:"65–70%" },
21:01:24.307                   "🔴 Red":    { bg:"rgba(239,68,68,0.1)",   border:"rgba(239,68  ,68,0.3)",   text:"#ef4444",  label:"Stretch",      sub:"Over 70%" },
21:01:24.307                 };
21:01:24.307                 const zc = z ? ZONES[z.label] : null;
21:01:24.307                 return (
21:01:24.307                   <div>
21:01:24.307                     <label style={S.lbl}>Zone</label>
21:01:24.307                     <div style={{ background: zc?.bg||"#111", border:`1.5px soli  d ${zc?.border||"#2a2a2a"}`, borderRadius:8, padding:"6px 14px", textAlign:"ce  nter" }}>
21:01:24.307                       {zc ? (
21:01:24.307                         <>
21:01:24.307                           <div style={{ fontSize:14, fontWeight:900, color:zc.te  xt }}>{zc.label}</div>
21:01:24.307                           <div style={{ fontSize:10, color:zc.text, opacity:0.7   }}>{zc.sub} of market</div>
21:01:24.307                         </>
21:01:24.307                       ) : (
21:01:24.307                         <div style={{ fontSize:12, color:"#555" }}>{totalMkt>0?"  —":"Add cards first"}</div>
21:01:24.307                       )}
21:01:24.307                     </div>
21:01:24.307                   </div>
21:01:24.307                 );
21:01:24.307               })()}
21:01:24.307             </div>
21:01:24.307   
21:01:24.307             {/* Est margin row */}
21:01:24.307             {dispOffer>0 && totalMkt>0 && (
21:01:24.307               <div style={{ display:"flex", gap:16, marginTop:8, paddingTop:8, b  orderTop:"1px solid #1a1a1a", flexWrap:"wrap" }}>
21:01:24.307                 <span style={{ fontSize:11, color:"#555" }}>Margin <strong style  ={{ color:"#4ade80" }}>${(totalMkt-dispOffer).toFixed(2)}</strong></span>
21:01:24.307                 <span style={{ fontSize:11, color:"#555" }}>Per card <strong sty  le={{ color:"#AAAAAA" }}>{totalCards>0?"$"+(dispOffer/totalCards).toFixed(2):"  —"}</strong></span>
21:01:24.307                 {(offerAmt!=null&&offerAmt>0) && <button onClick={()=>setFOffer(  "")} style={{ background:"none", border:"none", color:"#E8317A", cursor:"point  er", fontSize:11, fontFamily:"inherit", textDecoration:"underline" }}>Clear ov  erride</button>}
21:01:24.307                 {Math.abs(allocationDiff) >= 0.01 && <span style={{ fontSize:11,   fontWeight:700, color:allocationDiff>0?"#ef4444":"#FBBF24" }}>{allocationDiff  >0?`⚠ $${allocationDiff.toFixed(2)} over offer`:`$${Math.abs(allocationDiff).t  oFixed(2)} unallocated`}</span>}
21:01:24.307                 {Math.abs(allocationDiff) < 0.01 && included.length>0 && <span s  tyle={{ fontSize:11, color:"#4ade80" }}>✓ Perfectly balanced</span>}
21:01:24.307               </div>
21:01:24.307             )}
21:01:24.307           </div>
21:01:24.307   
21:01:24.307           <div style={S.card}>
21:01:24.307             <div style={{ display:"flex", alignItems:"center", justifyContent:"s  pace-between", marginBottom:10 }}>
21:01:24.307               <SectionLabel t="Cards in This Lot" />
21:01:24.307               <label style={{ background:"rgba(123,156,255,0.08)", border:"1px s  olid rgba(123,156,255,0.3)", color:"#7B9CFF", borderRadius:8, padding:"7px 14p  x", fontSize:12, fontWeight:700, cursor:"pointer", display:"flex", alignItems:  "center", gap:6 }}>
21:01:24.307                 {importing ? "⏳ Importing..." : "📂 Import CSV / XLSX"}
21:01:24.307                 <input type="file" accept=".csv,.xlsx,.xls" style={{ display:"no  ne" }} disabled={importing} onChange={importFromFile}/>
21:01:24.307               </label>
21:01:24.307             </div>
21:01:24.307             {isMobile ? (
21:01:24.307               <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
21:01:24.307                 {rows.map((r,i) => {
21:01:24.307                   const mv  = parseFloat(r.mktVal)||0;
21:01:24.307                   const qty = parseInt(r.qty)||1;
21:01:24.307                   const perCardOffer = totalMkt > 0 ? mv * dispPct : (totalCards   > 0 ? dispOffer / totalCards : 0);
21:01:24.307                   const mInp = { background:"#1a1a1a", border:"1px solid #2a2a2a  ", borderRadius:8, color:"#F0F0F0", padding:"10px 12px", fontSize:16, fontFami  ly:"inherit", outline:"none", width:"100%", boxSizing:"border-box" };
21:01:24.307                   return (
21:01:24.307                     <div key={r.id} style={{ background:r.include?"#111111":"#0a  0a0a", border:`1.5px solid ${r.include?"#2a2a2a":"#1a1a1a"}`, borderRadius:10,   padding:"12px", opacity:r.include?1:0.5 }}>
21:01:24.307                       <div style={{ display:"flex", justifyContent:"space-betwee  n", alignItems:"center", marginBottom:10 }}>
21:01:24.307                         <span style={{ fontSize:12, fontWeight:700, color:"#555"   }}>#{i+1}</span>
21:01:24.307                         <label style={{ display:"flex", alignItems:"center", gap  :6, fontSize:12, color:"#888", cursor:"pointer" }}>
21:01:24.307                           <input type="checkbox" checked={r.include} onChange={e  =>upd(r.id,"include",e.target.checked)}/> Include
21:01:24.307                         </label>
21:01:24.307                       </div>
21:01:24.307                       {/* Card Name */}
21:01:24.307                       {POOL_TYPES.includes(r.cardType) ? (
21:01:24.307                         <div style={{marginBottom:8}}>
21:01:24.307                           {cardPools.filter(p=>p.cardType===r.cardType).length >   0 && !r.manualEntry ? (
21:01:24.307                             <select value={r.name} onChange={e=>{
21:01:24.307                               if (e.target.value==="__manual__") {
21:01:24.307                                 setRows(p=>p.map(x=>x.id===r.id?{...x,name:"",ma  nualEntry:true}:x));
21:01:24.307                               } else {
21:01:24.307                                 upd(r.id,"name",e.target.value);
21:01:24.307                               }
21:01:24.308                             }} style={{ ...mInp, cursor:"pointer" }}>
21:01:24.308                               <option value="">-- Select Pool or Treatment --</o  ption>
21:01:24.308                               <optgroup label="Your Pools">
21:01:24.308                                 {cardPools.filter(p=>p.cardType===r.cardType).ma  p(p=>(
21:01:24.308                                   <option key={p.id} value={p.cardName}>{p.cardN  ame} ({(parseInt(p.totalQty)||0)-(parseInt(p.usedQty)||0)} avail)</option>
21:01:24.308                                 ))}
21:01:24.308                               </optgroup>
21:01:24.308                               <optgroup label="All Treatments">
21:01:24.308                                 {[...new Set(bobaCards.map(c=>c.treatment).filte  r(Boolean))].sort().map(t=>(
21:01:24.308                                   <option key={t} value={t}>{t}</option>
21:01:24.308                                 ))}
21:01:24.308                               </optgroup>
21:01:24.308                               <option value="__manual__">✏️ Type manually instea  d...</option>
21:01:24.308                             </select>
21:01:24.308                           ) : (
21:01:24.308                             <div style={{display:"flex",gap:6,alignItems:"center  "}}>
21:01:24.308                               <div style={{position:"relative",flex:1}}>
21:01:24.308                                 <input
21:01:24.308                                   value={acOpen===r.id?(acQuery[r.id]??r.name):r  .name}
21:01:24.308                                   onChange={e=>{setAcOpen(r.id);setAcQuery(q=>({  ...q,[r.id]:e.target.value}));upd(r.id,"name",e.target.value);}}
21:01:24.308                                   onFocus={()=>{setAcOpen(r.id);setAcQuery(q=>({  ...q,[r.id]:r.name}));}}
21:01:24.308                                   onBlur={()=>setTimeout(()=>setAcOpen(p=>p===r.  id?null:p),150)}
21:01:24.308                                   placeholder="Type hero name or card #..."
21:01:24.308                                   style={{...mInp}}
21:01:24.308                                 />
21:01:24.308                                 {acOpen===r.id&&(acQuery[r.id]||"").length>=1&&(  ()=>{
21:01:24.308                                   const raw=(acQuery[r.id]||"").toLowerCase();
21:01:24.308                                   const terms=raw.trim().split(/\s+/).filter(Boo  lean);
21:01:24.308                                   const hits=bobaCards.filter(c=>terms.every(t=>  [c.hero||"",c.weapon||"",c.treatment||"",String(c.cardNum||""),c.notation||"",  c.setName||""].join(" ").toLowerCase().includes(t))).slice(0,12);
21:01:24.308                                   if(!hits.length) return null;
21:01:24.308                                   return (
21:01:24.308                                     <div style={{position:"absolute",top:"100%",  left:0,right:0,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,  zIndex:999,boxShadow:"0 8px 24px rgba(0,0,0,0.8)",maxHeight:280,overflowY:"aut  o"}}>
21:01:24.308                                       <div style={{padding:"4px 10px",fontSize:1  0,color:"#555",borderBottom:"1px solid #111"}}>{hits.length} match{hits.length  !==1?"es":""}</div>
21:01:24.308                                       {hits.map(c=>{
21:01:24.308                                         const wc=PUBLIC_WEAPON_COLORS[c.weapon]|  |"#444";
21:01:24.308                                         const label=[c.hero,c.treatment,c.weapon  ?"("+c.weapon+")":"",c.cardNum?"#"+c.cardNum:""].filter(Boolean).join(" — ");
21:01:24.308                                         return (
21:01:24.308                                           <div key={c.id} onMouseDown={()=>{upd(  r.id,"name",label);if(c.mktValue||c.marketValue)upd(r.id,"mktVal",String(c.mkt  Value||c.marketValue||""));setAcOpen(null);}}
21:01:24.308                                             style={{display:"flex",alignItems:"c  enter",gap:10,padding:"8px 10px",cursor:"pointer",borderBottom:"1px solid #111  "}} className="inv-row">
21:01:24.308                                             <div style={{flexShrink:0}}>
21:01:24.308                                               {c.imageUrl
21:01:24.308                                                 ? <img src={c.imageUrl} alt={c.h  ero} style={{width:36,height:48,objectFit:"cover",borderRadius:4}}/>
21:01:24.308                                                 : <div style={{width:36,height:4  8,background:"#2a2a2a",borderRadius:4,display:"flex",alignItems:"center",justi  fyContent:"center",fontSize:8,color:"#555",textAlign:"center",padding:2}}>{c.h  ero?.split(" ")[0]}</div>
21:01:24.308                                               }
21:01:24.308                                             </div>
21:01:24.308                                             <div style={{flex:1,minWidth:0}}>
21:01:24.308                                               <div style={{fontSize:13,fontWeigh  t:700,color:"#F0F0F0",marginBottom:2}}>{c.hero}</div>
21:01:24.308                                               <div style={{display:"flex",gap:6,  fontSize:10,flexWrap:"wrap"}}>
21:01:24.308                                                 <span style={{color:"#555"}}>#{c  .cardNum}</span>
21:01:24.308                                                 {c.weapon&&<span style={{color:w  c,fontWeight:700}}>{c.weapon}</span>}
21:01:24.308                                                 {c.treatment&&<span style={{colo  r:"#888"}}>{c.treatment}</span>}
21:01:24.308                                                 {c.setName&&<span style={{color:  "#444",fontStyle:"italic"}}>{c.setName}</span>}
21:01:24.308                                               </div>
21:01:24.308                                               {(c.mktValue||c.marketValue)&&<div   style={{fontSize:10,color:"#4ade80",marginTop:2}}>${parseFloat(c.mktValue||c.  marketValue).toFixed(2)}</div>}
21:01:24.308                                             </div>
21:01:24.308                                           </div>
21:01:24.308                                         );
21:01:24.308                                       })}
21:01:24.308                                     </div>
21:01:24.308                                   );
21:01:24.308                                 })()}
21:01:24.308                               </div>
21:01:24.308                               {cardPools.filter(p=>p.cardType===r.cardType).leng  th > 0 && (
21:01:24.308                                 <button onClick={()=>setRows(p=>p.map(x=>x.id===  r.id?{...x,name:"",manualEntry:false}:x))} style={{background:"none",border:"1  px solid #333",color:"#555",borderRadius:6,padding:"6px 8px",fontSize:11,curso  r:"pointer",fontFamily:"inherit",flexShrink:0}}>↩ Pool</button>
21:01:24.308                               )}
21:01:24.308                             </div>
21:01:24.308                           )}
21:01:24.308                         </div>
21:01:24.308                       ) : (
21:01:24.308                         <div style={{ position:"relative", marginBottom:8 }}>
21:01:24.309                           <input
21:01:24.309                             value={acOpen===r.id ? (acQuery[r.id]??r.name) : r.n  ame}
21:01:24.309                             onChange={e=>{ setAcOpen(r.id); setAcQuery(q=>({...q  ,[r.id]:e.target.value})); upd(r.id,"name",e.target.value); }}
21:01:24.309                             onFocus={()=>{ setAcOpen(r.id); setAcQuery(q=>({...q  ,[r.id]:r.name})); }}
21:01:24.309                             onBlur={()=>setTimeout(()=>setAcOpen(p=>p===r.id?nul  l:p),150)}
21:01:24.309                             placeholder="Type hero name or card #..."
21:01:24.309                             style={mInp}
21:01:24.309                           />
21:01:24.309                           {acOpen===r.id && (acQuery[r.id]||"").length>=1 && (()   => {
21:01:24.309                             const raw=(acQuery[r.id]||"").toLowerCase();
21:01:24.309                             const terms=raw.trim().split(/\s+/).filter(Boolean);                            const hits=bobaCards.filter(c=>terms.every(t=>[c.her  o||"",c.weapon||"",c.treatment||"",String(c.cardNum||""),c.notation||"",c.setN  ame||""].join(" ").toLowerCase().includes(t))).slice(0,12);
21:01:24.309                             if(!hits.length) return null;
21:01:24.309                             return (
21:01:24.310                               <div style={{ position:"absolute", top:"100%", lef  t:0, right:0, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8  , zIndex:999, boxShadow:"0 8px 24px rgba(0,0,0,0.8)", maxHeight:280, overflowY  :"auto" }}>
21:01:24.310                                 <div style={{padding:"4px 10px",fontSize:10,colo  r:"#555",borderBottom:"1px solid #111"}}>{hits.length} match{hits.length!==1?"  es":""}</div>
21:01:24.310                                 {hits.map(c=>{
21:01:24.310                                   const wc=PUBLIC_WEAPON_COLORS[c.weapon]||"#444  ";
21:01:24.310                                   const label=[c.hero,c.treatment,c.weapon?"("+c  .weapon+")":"",c.cardNum?"#"+c.cardNum:""].filter(Boolean).join(" — ");
21:01:24.310                                   return (
21:01:24.310                                     <div key={c.id} onMouseDown={()=>{ upd(r.id,  "name",label); if(c.mktValue||c.marketValue) upd(r.id,"mktVal",String(c.mktVal  ue||c.marketValue||"")); setAcOpen(null); }}
21:01:24.310                                       style={{display:"flex",alignItems:"center"  ,gap:10,padding:"8px 10px",cursor:"pointer",borderBottom:"1px solid #111"}} cl  assName="inv-row">
21:01:24.310                                       <div style={{flexShrink:0}}>
21:01:24.310                                         {c.imageUrl
21:01:24.310                                           ? <img src={c.imageUrl} alt={c.hero} s  tyle={{width:36,height:48,objectFit:"cover",borderRadius:4}}/>
21:01:24.310                                           : <div style={{width:36,height:48,back  ground:"#2a2a2a",borderRadius:4,display:"flex",alignItems:"center",justifyCont  ent:"center",fontSize:8,color:"#555",textAlign:"center",padding:2}}>{c.hero?.s  plit(" ")[0]}</div>
21:01:24.310                                         }
21:01:24.310                                       </div>
21:01:24.310                                       <div style={{flex:1,minWidth:0}}>
21:01:24.310                                         <div style={{fontSize:13,fontWeight:700,  color:"#F0F0F0",marginBottom:2}}>{c.hero}</div>
21:01:24.310                                         <div style={{display:"flex",gap:6,fontSi  ze:10,flexWrap:"wrap"}}>
21:01:24.310                                           <span style={{color:"#555"}}>#{c.cardN  um}</span>
21:01:24.310                                           {c.weapon&&<span style={{color:wc,font  Weight:700}}>{c.weapon}</span>}
21:01:24.310                                           {c.treatment&&<span style={{color:"#88  8"}}>{c.treatment}</span>}
21:01:24.310                                           {c.setName&&<span style={{color:"#444"  ,fontStyle:"italic"}}>{c.setName}</span>}
21:01:24.310                                         </div>
21:01:24.310                                         {(c.mktValue||c.marketValue)&&<div style  ={{fontSize:10,color:"#4ade80",marginTop:2}}>${parseFloat(c.mktValue||c.market  Value).toFixed(2)}</div>}
21:01:24.310                                       </div>
21:01:24.310                                     </div>
21:01:24.310                                   );
21:01:24.310                                 })}
21:01:24.310                               </div>
21:01:24.310                             );
21:01:24.310                           })()}
21:01:24.310                         </div>
21:01:24.310                       )}
21:01:24.310                       <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr   1fr", gap:8, marginBottom:8 }}>
21:01:24.310                         <div>
21:01:24.310                           <div style={{ fontSize:11, color:"#666", marginBottom:  4 }}>Type</div>
21:01:24.310                           <select value={r.cardType} onChange={e=>upd(r.id,"card  Type",e.target.value)} style={{ ...mInp, cursor:"pointer" }}>
21:01:24.310                             <option value="">Type...</option>
21:01:24.310                             {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct.  replace(" Cards","")}</option>)}
21:01:24.310                           </select>
21:01:24.310                         </div>
21:01:24.310                         <div>
21:01:24.310                           <div style={{ fontSize:11, color:"#666", marginBottom:  4 }}>Qty</div>
21:01:24.310                           <input type="number" value={r.qty} onChange={e=>upd(r.  id,"qty",e.target.value)} placeholder="1" min="1" style={mInp}/>
21:01:24.310                         </div>
21:01:24.310                         <div>
21:01:24.310                           <div style={{ fontSize:11, color:"#666", marginBottom:  4 }}>Value/Card</div>
21:01:24.310                           <input type="number" value={r.mktVal} onChange={e=>upd  (r.id,"mktVal",e.target.value)} placeholder="0.00" style={mInp}/>
21:01:24.310                         </div>
21:01:24.310                       </div>
21:01:24.310                       <div style={{ marginBottom:8, display:"grid", gridTemplate  Columns:"1fr 1fr", gap:8 }}>
21:01:24.310                         <div>
21:01:24.310                           <div style={{ fontSize:11, color: r.costOverride?"#FBB  F24":"#666", marginBottom:4, fontWeight:r.costOverride?700:400 }}>
21:01:24.310                             {r.costOverride?"★ ":""}Cost/Card Override
21:01:24.310                           </div>
21:01:24.310                           <input type="text" inputMode="decimal" value={r.costOv  erride} onChange={e=>upd(r.id,"costOverride",e.target.value)} placeholder={`au  to ($${getCostPerCard(r).toFixed(2)})`} style={{ ...mInp, border:r.costOverrid  e?"1.5px solid #FBBF2488":"1px solid #2a2a2a", color:r.costOverride?"#FBBF24":  "#888" }}/>
21:01:24.310                         </div>
21:01:24.310                         <div>
21:01:24.310                           <div style={{ fontSize:11, color: r.pctOverride?"#A78B  FA":"#666", marginBottom:4, fontWeight:r.pctOverride?700:400 }}>
21:01:24.310                             {r.pctOverride?"★ ":""}Custom Comp % (e.g. 70)
21:01:24.310                           </div>
21:01:24.310                           <div style={{ display:"flex", alignItems:"center", gap  :4 }}>
21:01:24.310                             <input type="number" min="0" max="100" value={r.pctO  verride} onChange={e=>{upd(r.id,"pctOverride",e.target.value); upd(r.id,"costO  verride","");}} placeholder="global %" style={{ ...mInp, border:r.pctOverride?  "1.5px solid #A78BFA88":"1px solid #2a2a2a", color:r.pctOverride?"#A78BFA":"#8  88", flex:1 }}/>
21:01:24.310                             <span style={{ fontSize:11, color:"#555" }}>%</span>                          </div>
21:01:24.310                           {r.pctOverride && <div style={{ fontSize:10, color:"#A  78BFA", marginTop:2 }}>${((parseFloat(r.mktVal)||0)*(parseFloat(r.pctOverride)  /100)).toFixed(2)}/card</div>}
21:01:24.310                         </div>
21:01:24.310                       </div>
21:01:24.311                       {(mv > 0 || perCardOffer > 0) && (
21:01:24.311                         <div style={{ display:"flex", justifyContent:"space-betw  een", padding:"6px 10px", background:"#1a1a1a", borderRadius:6, fontSize:12 }}  >
21:01:24.311                           <span style={{ color:"#888" }}>Total: <strong style={{   color:"#F0F0F0" }}>${(mv*qty).toFixed(2)}</strong></span>
21:01:24.311                           <span style={{ color:"#888" }}>Offer/card: <strong sty  le={{ color:"#E8317A" }}>${perCardOffer.toFixed(2)}</strong></span>
21:01:24.311                         </div>
21:01:24.311                       )}
21:01:24.311                     </div>
21:01:24.311                   );
21:01:24.311                 })}
21:01:24.311                 <button onClick={addRow} style={{ background:"transparent", bord  er:"1.5px dashed #2a2a2a", color:"#888", borderRadius:10, padding:"12px", font  Size:13, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>+ Add Card<  /button>
21:01:24.311               </div>
21:01:24.311             ) : (
21:01:24.311             <div style={{ overflowX:"auto" }}>
21:01:24.311               <table style={{ width:"100%", borderCollapse:"collapse", minWidth:  750 }}>
21:01:24.311                 <thead>
21:01:24.311                   <tr style={{ background:"#0d0d0d" }}>
21:01:24.311                     {["#","Card","Type","Qty","Mkt Val","Total","Offer/Card","Ov  erride","Zone","✓"].map(h=>(
21:01:24.311                       <th key={h} style={{ ...S.th, fontSize:9, letterSpacing:"0  .8px", padding:"8px 10px" }}>{h}</th>
21:01:24.311                     ))}
21:01:24.311                   </tr>
21:01:24.311                 </thead>
21:01:24.311                 <tbody>
21:01:24.311                   {rows.map((r,i) => {
21:01:24.311                     const mv  = parseFloat(r.mktVal)||0;
21:01:24.311                     const qty = parseInt(r.qty)||1;
21:01:24.311                     const perCardOffer = mv > 0 ? getCostPerCard(r) : (totalCard  s > 0 ? dispOffer / totalCards : 0);
21:01:24.311                     const cardPct = mv > 0 ? perCardOffer / mv : 0;
21:01:24.311                     const isLocked = r.costOverride || r.pctOverride;
21:01:24.311                     // Per-card zone based on what this card actually gets
21:01:24.311                     const cz = mv > 0 && perCardOffer > 0 ? (() => {
21:01:24.311                       const p = cardPct;
21:01:24.311                       if (p < 0.65) return { label:"Dunk",  color:"#4ade80", bg:  "rgba(74,222,128,0.12)",  border:"rgba(74,222,128,0.3)" };
21:01:24.311                       if (p <= 0.70) return { label:"Fair",  color:"#FBBF24", bg  :"rgba(251,191,36,0.12)",  border:"rgba(251,191,36,0.3)" };
21:01:24.311                       return              { label:"Stretch", color:"#ef4444", bg  :"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)" };
21:01:24.311                     })() : null;
21:01:24.311   
21:01:24.311                     return (
21:01:24.311                       <tr key={r.id} style={{ background: i%2===0?"#111":"#0d0d0  d", opacity:r.include?1:0.4, borderBottom:"1px solid #1a1a1a" }}>
21:01:24.311   
21:01:24.311                         {/* # */}
21:01:24.311                         <td style={{ ...S.td, color:"#333", width:28, textAlign:  "center", fontSize:11 }}>{i+1}</td>
21:01:24.311   
21:01:24.311                         {/* Card name */}
21:01:24.311                         <td style={{ ...S.td, width:200, position:"relative" }}>                          {POOL_TYPES.includes(r.cardType) ? (
21:01:24.311                             <div style={{display:"flex",flexDirection:"column",g  ap:4,flex:1}}>
21:01:24.311                               {cardPools.filter(p=>p.cardType===r.cardType).leng  th > 0 && !r.manualEntry ? (
21:01:24.311                                 <select value={r.name} onChange={e=>{ if(e.targe  t.value==="__manual__"){setRows(p=>p.map(x=>x.id===r.id?{...x,name:"",manualEn  try:true}:x));} else {upd(r.id,"name",e.target.value);}}}
21:01:24.311                                   style={{ ...S.inp, padding:"5px 8px", fontSize  :12, color:r.name?"#F0F0F0":"#9CA3AF", cursor:"pointer" }}>
21:01:24.311                                   <option value="">-- Pool / Treatment --</optio  n>
21:01:24.312                                   <optgroup label="Your Pools">{cardPools.filter  (p=>p.cardType===r.cardType).map(p=>(<option key={p.id} value={p.cardName}>{p.  cardName} ({(parseInt(p.totalQty)||0)-(parseInt(p.usedQty)||0)} avail)</option  >))}</optgroup>
21:01:24.312                                   <optgroup label="All Treatments">{[...new Set(  bobaCards.map(c=>c.treatment).filter(Boolean))].sort().map(t=>(<option key={t}   value={t}>{t}</option>))}</optgroup>
21:01:24.312                                   <option value="__manual__">✏️ Type manually...  </option>
21:01:24.312                                 </select>
21:01:24.312                               ) : (
21:01:24.312                                 <div style={{display:"flex",gap:4,alignItems:"ce  nter",flex:1}}>
21:01:24.312                                   <div style={{position:"relative",flex:1}}>
21:01:24.312                                     <input value={acOpen===r.id?(acQuery[r.id]??  r.name):r.name}
21:01:24.312                                       onChange={e=>{setAcOpen(r.id);setAcQuery(q  =>({...q,[r.id]:e.target.value}));upd(r.id,"name",e.target.value);}}
21:01:24.312                                       onFocus={()=>{setAcOpen(r.id);setAcQuery(q  =>({...q,[r.id]:r.name}));}}
21:01:24.312                                       onBlur={()=>setTimeout(()=>setAcOpen(p=>p=  ==r.id?null:p),150)}
21:01:24.312                                       placeholder="Type name..." style={{ ...S.i  np, padding:"5px 8px", fontSize:12, width:"100%" }}/>
21:01:24.312                                     {acOpen===r.id&&(acQuery[r.id]||"").length>=  1&&(()=>{const raw=(acQuery[r.id]||"").toLowerCase();const hits=bobaCards.filt  er(c=>[c.hero||"",c.weapon||"",c.treatment||"",String(c.cardNum||""),c.notatio  n||"",c.setName||""].join(" ").toLowerCase().includes(raw)).slice(0,8);if(!hit  s.length)return null;return(<div style={{position:"absolute",top:"100%",left:0  ,right:0,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadius:8,zIndex  :999,boxShadow:"0 8px 24px rgba(0,0,0,0.8)",maxHeight:220,overflowY:"auto"}}>{  hits.map(c=>{const label=[c.hero,c.treatment,c.weapon?"("+c.weapon+")":"",c.ca  rdNum?"#"+c.cardNum:""].filter(Boolean).join(" — ");return<div key={c.id} onMo  useDown={()=>{upd(r.id,"name",label);if(c.mktValue||c.marketValue)upd(r.id,"mk  tVal",String(c.mktValue||c.marketValue||""));setAcOpen(null);}} style={{paddin  g:"7px 10px",borderBottom:"1px solid #111",cursor:"pointer",fontSize:12,color:  "#F0F0F0"}} className="inv-row">{label}</div>;})}</div>);})()}
21:01:24.312                                   </div>
21:01:24.312                                   {cardPools.filter(p=>p.cardType===r.cardType).  length>0&&<button onClick={()=>setRows(p=>p.map(x=>x.id===r.id?{...x,name:"",m  anualEntry:false}:x))} style={{background:"none",border:"1px solid #333",color  :"#555",borderRadius:6,padding:"3px 7px",fontSize:11,cursor:"pointer",fontFami  ly:"inherit",flexShrink:0}}>↩</button>}
21:01:24.312                                 </div>
21:01:24.312                               )}
21:01:24.312                             </div>
21:01:24.312                           ) : (
21:01:24.312                             <div style={{ display:"flex", gap:4, alignItems:"cen  ter" }}>
21:01:24.312                               <div style={{ position:"relative", flex:1 }}>
21:01:24.312                                 <input value={acOpen===r.id?(acQuery[r.id]??r.na  me):r.name}
21:01:24.312                                   onChange={e=>{setAcOpen(r.id);setAcQuery(q=>({  ...q,[r.id]:e.target.value}));upd(r.id,"name",e.target.value);}}
21:01:24.312                                   onFocus={()=>{setAcOpen(r.id);setAcQuery(q=>({  ...q,[r.id]:r.name}));}}
21:01:24.312                                   onBlur={()=>setTimeout(()=>setAcOpen(p=>p===r.  id?null:p),150)}
21:01:24.312                                   placeholder="Hero name or card #..."
21:01:24.312                                   style={{ ...S.inp, padding:"5px 8px", fontSize  :12, width:"100%" }}/>
21:01:24.312                                 {acOpen===r.id&&(acQuery[r.id]||"").length>=1&&(  ()=>{
21:01:24.312                                   const raw=(acQuery[r.id]||"").toLowerCase();
21:01:24.312                                   const terms=raw.trim().split(/\s+/).filter(Boo  lean);
21:01:24.312                                   const hits=bobaCards.filter(c=>terms.every(t=>  [c.hero||"",c.weapon||"",c.treatment||"",String(c.cardNum||""),c.notation||"",  c.setName||""].join(" ").toLowerCase().includes(t))).sort((a,b)=>{const s=h=>h  .toLowerCase()===raw?0:h.toLowerCase().startsWith(terms[0])?1:2;return s(a.her  o||"")-s(b.hero||"");}).slice(0,10);
21:01:24.312                                   if(!hits.length)return null;
21:01:24.312                                   return(<div style={{position:"absolute",top:"1  00%",left:0,right:0,background:"#1a1a1a",border:"1px solid #2a2a2a",borderRadi  us:8,zIndex:999,boxShadow:"0 8px 24px rgba(0,0,0,0.8)",maxHeight:260,overflowY  :"auto"}}>
21:01:24.312                                     {hits.map(c=>{const wc=PUBLIC_WEAPON_COLORS[  c.weapon]||"#444";const label=[c.hero,c.treatment,c.weapon?"("+c.weapon+")":""  ,c.cardNum?"#"+c.cardNum:""].filter(Boolean).join(" — ");return(
21:01:24.312                                       <div key={c.id} onMouseDown={()=>{upd(r.id  ,"name",label);if(c.mktValue||c.marketValue)upd(r.id,"mktVal",String(c.mktValu  e||c.marketValue||""));setAcOpen(null);}}
21:01:24.312                                         style={{display:"flex",alignItems:"cente  r",gap:8,padding:"7px 10px",cursor:"pointer",borderBottom:"1px solid #111"}} c  lassName="inv-row">
21:01:24.312                                         <div style={{flex:1,minWidth:0}}>
21:01:24.312                                           <div style={{fontSize:12,fontWeight:70  0,color:"#F0F0F0"}}>{c.hero}</div>
21:01:24.312                                           <div style={{display:"flex",gap:5,font  Size:10}}>
21:01:24.312                                             {c.weapon&&<span style={{color:wc,fo  ntWeight:700}}>{c.weapon}</span>}
21:01:24.312                                             {c.treatment&&<span style={{color:"#  666"}}>{c.treatment}</span>}
21:01:24.312                                             {c.cardNum&&<span style={{color:"#44  4"}}>#{c.cardNum}</span>}
21:01:24.312                                           </div>
21:01:24.312                                         </div>
21:01:24.313                                         {(c.mktValue||c.marketValue)&&<span styl  e={{fontSize:11,color:"#4ade80",fontWeight:700}}>${parseFloat(c.mktValue||c.ma  rketValue).toFixed(2)}</span>}
21:01:24.313                                       </div>);
21:01:24.313                                     })}
21:01:24.313                                   </div>);
21:01:24.313                                 })()}
21:01:24.313                               </div>
21:01:24.313                               {r.name.trim()&&(
21:01:24.313                                 <a href={`https://130point.com/sales/?sSearch=${  encodeURIComponent(r.name.trim())}`} target="_blank" rel="noreferrer"
21:01:24.313                                   style={{background:"#111",color:"#E8317A",bord  er:"1px solid #E8317A33",borderRadius:6,padding:"4px 7px",fontSize:11,textDeco  ration:"none",flexShrink:0}}>🔍</a>
21:01:24.313                               )}
21:01:24.313                             </div>
21:01:24.313                           )}
21:01:24.313                           <button onClick={()=>setRows(p=>p.filter(x=>x.id!==r.i  d))}
21:01:24.313                             style={{position:"absolute",top:6,right:6,background  :"none",border:"none",color:"#333",cursor:"pointer",fontSize:13,padding:2,line  Height:1}} title="Remove row">×</button>
21:01:24.313                         </td>
21:01:24.313   
21:01:24.313                         {/* Type */}
21:01:24.313                         <td style={{ ...S.td, width:130 }}>
21:01:24.313                           <select value={r.cardType} onChange={e=>upd(r.id,"card  Type",e.target.value)}
21:01:24.313                             style={{ ...S.inp, padding:"4px 8px", fontSize:11, c  olor:r.cardType?"#F0F0F0":"#9CA3AF", cursor:"pointer" }}>
21:01:24.313                             <option value="">Type...</option>
21:01:24.313                             {CARD_TYPES.map(ct=><option key={ct} value={ct}>{ct.  replace(" Cards","")}</option>)}
21:01:24.313                           </select>
21:01:24.313                         </td>
21:01:24.313   
21:01:24.313                         {/* Qty */}
21:01:24.313                         <td style={{ ...S.td, width:52 }}>
21:01:24.313                           <input type="number" value={r.qty} onChange={e=>upd(r.  id,"qty",e.target.value)} placeholder="1" min="1"
21:01:24.313                             style={{ ...S.inp, padding:"4px 6px", fontSize:12, w  idth:44, textAlign:"center" }}/>
21:01:24.313                         </td>
21:01:24.313   
21:01:24.313                         {/* Mkt Val */}
21:01:24.313                         <td style={{ ...S.td, width:90 }}>
21:01:24.313                           <input type="number" value={r.mktVal} onChange={e=>upd  (r.id,"mktVal",e.target.value)} placeholder="0.00"
21:01:24.313                             style={{ ...S.inp, padding:"4px 8px", fontSize:12, c  olor:mv?"#AAAAAA":"#333", width:78 }}/>
21:01:24.313                         </td>
21:01:24.313   
21:01:24.313                         {/* Total mkt */}
21:01:24.313                         <td style={{ ...S.td, color:"#555", fontWeight:600, font  Size:12, width:80 }}>
21:01:24.313                           {mv>0 ? `$${(mv*qty).toFixed(2)}` : "—"}
21:01:24.313                         </td>
21:01:24.313   
21:01:24.313                         {/* Offer/card — highlighted */}
21:01:24.313                         <td style={{ ...S.td, width:90 }}>
21:01:24.313                           <div style={{ fontWeight:800, fontSize:13, color: isLo  cked?"#FBBF24":"#E8317A" }}>
21:01:24.313                             ${perCardOffer.toFixed(2)}
21:01:24.313                             {r.pctOverride&&<span style={{fontSize:9,color:"#A78  BFA",marginLeft:3}}>%</span>}
21:01:24.313                             {r.costOverride&&<span style={{fontSize:9,color:"#FB  BF24",marginLeft:3}}>★</span>}
21:01:24.313                           </div>
21:01:24.313                           {mv>0&&<div style={{fontSize:9,color:"#555",marginTop:  1}}>{(cardPct*100).toFixed(0)}% of mkt</div>}
21:01:24.313                         </td>
21:01:24.313   
21:01:24.313                         {/* Cost/pct override — two mini inputs */}
21:01:24.314                         <td style={{ ...S.td, width:130 }}>
21:01:24.314                           <div style={{ display:"flex", gap:4 }}>
21:01:24.314                             <input type="text" inputMode="decimal" value={r.cost  Override}
21:01:24.314                               onChange={e=>{upd(r.id,"costOverride",e.target.val  ue);if(e.target.value)upd(r.id,"pctOverride","");}}
21:01:24.314                               placeholder="$"
21:01:24.314                               style={{ ...S.inp, padding:"4px 6px", fontSize:11,   width:50, color:r.costOverride?"#FBBF24":"#555", border:r.costOverride?"1px s  olid #FBBF2455":"1px solid #2a2a2a", textAlign:"center" }}/>
21:01:24.314                             <div style={{ display:"flex", alignItems:"center", g  ap:2 }}>
21:01:24.314                               <input type="number" min="0" max="200" value={r.pc  tOverride}
21:01:24.314                                 onChange={e=>{upd(r.id,"pctOverride",e.target.va  lue);if(e.target.value)upd(r.id,"costOverride","");}}
21:01:24.314                                 placeholder="%"
21:01:24.314                                 style={{ ...S.inp, padding:"4px 4px", fontSize:1  1, width:40, color:r.pctOverride?"#A78BFA":"#555", border:r.pctOverride?"1px s  olid #A78BFA55":"1px solid #2a2a2a", textAlign:"center" }}/>
21:01:24.314                               <span style={{fontSize:10,color:"#555"}}>%</span>
21:01:24.314                             </div>
21:01:24.314                           </div>
21:01:24.314                           {(r.costOverride||r.pctOverride)&&(
21:01:24.314                             <button onClick={()=>{upd(r.id,"costOverride","");up  d(r.id,"pctOverride","");}}
21:01:24.314                               style={{background:"none",border:"none",color:"#55  5",cursor:"pointer",fontSize:10,fontFamily:"inherit",padding:"2px 0"}}>↩ reset  </button>
21:01:24.314                           )}
21:01:24.314                         </td>
21:01:24.314   
21:01:24.314                         {/* Zone chip */}
21:01:24.314                         <td style={{ ...S.td, width:72 }}>
21:01:24.314                           {cz ? (
21:01:24.314                             <div style={{ background:cz.bg, border:`1px solid ${  cz.border}`, borderRadius:6, padding:"3px 8px", textAlign:"center" }}>
21:01:24.314                               <div style={{ fontSize:10, fontWeight:800, color:c  z.color }}>{cz.label}</div>
21:01:24.314                             </div>
21:01:24.314                           ) : <span style={{ color:"#333", fontSize:11 }}>—</spa  n>}
21:01:24.314                         </td>
21:01:24.314   
21:01:24.314                         {/* Include checkbox */}
21:01:24.314                         <td style={{ ...S.td, textAlign:"center", width:32 }}>
21:01:24.314                           <input type="checkbox" checked={r.include} onChange={e  =>upd(r.id,"include",e.target.checked)}/>
21:01:24.314                         </td>
21:01:24.314                       </tr>
21:01:24.314                     );
21:01:24.314                   })}
21:01:24.314                 </tbody>
21:01:24.314               </table>
21:01:24.314             </div>
21:01:24.314             )}
21:01:24.314             {!isMobile && <div style={{ marginTop:10 }}><Btn onClick={addRow} va  riant="ghost">+ Add Row</Btn></div>}
21:01:24.314           </div>
21:01:24.314   
21:01:24.315           <div style={{ ...S.card, border:"2px solid #333333" }}>
21:01:24.315             <SectionLabel t="Confirm & Actions" />
21:01:24.315             {canSeeFinancials && dispOffer > 0 && totalMkt > 0 && (
21:01:24.315               <div style={{ marginBottom:16, padding:"8px 14px", background:"#11  1111", borderRadius:8, display:"flex", gap:20, flexWrap:"wrap" }}>
21:01:24.315                 <span style={{ fontSize:12, color:"#AAAAAA" }}>Active offer: <st  rong style={{color:(counterAmt!=null&&counterAmt>0)?"#92400e":(offerAmt!=null&  &offerAmt>0)?"#E8317A":"#166534"}}>${dispOffer.toFixed(2)} ({(dispPct*100).toF  ixed(1)}%)</strong></span>
21:01:24.315                 <span style={{ fontSize:12, color:"#AAAAAA" }}>Est. Margin: <str  ong style={{color:"#E8317A"}}>${(totalMkt-dispOffer).toFixed(2)}</strong></spa  n>
21:01:24.315                 <span style={{ fontSize:12, color:"#AAAAAA" }}>Market Value: <st  rong style={{color:"#AAAAAA"}}>${totalMkt.toFixed(2)}</strong></span>
21:01:24.315                 <span style={{ fontSize:12, color:"#AAAAAA" }}>Per Card: <strong   style={{color:"#E8317A"}}>${totalCards>0?(dispOffer/totalCards).toFixed(2):"-  -"}</strong></span>
21:01:24.315               </div>
21:01:24.315             )}
21:01:24.315             {/* Pay button -- appears when payment method + handle are filled */  }
21:01:24.315             {seller.payment && seller.paymentHandle && (() => {
21:01:24.315               const handle      = seller.paymentHandle.trim();
21:01:24.315               const cleanHandle = handle.replace(/^@/,"");
21:01:24.315               const amt         = dispOffer > 0 ? dispOffer.toFixed(2) : "";
21:01:24.315               const PCFG = {
21:01:24.315                 PayPal: { color:"#003087", bg:"#E8EEFF", hint:handle },
21:01:24.315                 Zelle:  { color:"#6D1ED4", bg:"#F3EEFF", hint:handle },
21:01:24.315               };
21:01:24.315               const cfg = PCFG[seller.payment];
21:01:24.315               if (!cfg) return null;
21:01:24.315               return (
21:01:24.315                 <div style={{ marginBottom:16, padding:"14px 16px", background:c  fg.bg, border:`2px solid ${cfg.color}33`, borderRadius:10, display:"flex", ali  gnItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
21:01:24.315                   <div>
21:01:24.315                     <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA",   textTransform:"uppercase", letterSpacing:1.5, marginBottom:4 }}>{"\uD83D\uDCB8   Send Payment"}</div>
21:01:24.315                     <div style={{ fontWeight:800, fontSize:16, color:cfg.color }  }>{cfg.hint}</div>
21:01:24.315                     {amt && <div style={{ fontSize:12, color:"#AAAAAA", marginTo  p:2 }}>Amount: <strong style={{color:"#F0F0F0"}}>${amt}</strong></div>}
21:01:24.315                   </div>
21:01:24.315                   <div style={{ background:cfg.color, color:"#F0F0F0", borderRad  ius:9, padding:"12px 24px", fontSize:14, fontWeight:800 }}>
21:01:24.315                     {`Open ${seller.payment} \u2192 ${cfg.hint}`}
21:01:24.315                   </div>
21:01:24.315                 </div>
21:01:24.315               );
21:01:24.315             })()}
21:01:24.315   
21:01:24.315             <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:  16, alignItems:"center" }}>
21:01:24.315               <Btn onClick={()=>setCustView(true)} variant="ghost">{"\uD83D\uDC4  1 Customer View"}</Btn>
21:01:24.315               <div style={{ display:"flex", alignItems:"center", gap:8, backgrou  nd:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:8, padding:"6px 12px",   cursor:"pointer" }} onClick={()=>setAllowCounter(p=>!p)}>
21:01:24.315                 <div style={{ width:32, height:18, borderRadius:9, background:al  lowCounter?"#E8317A":"#333", position:"relative", transition:"background 0.2s"  , flexShrink:0 }}>
21:01:24.316                   <div style={{ position:"absolute", top:2, left:allowCounter?14  :2, width:14, height:14, borderRadius:"50%", background:"#fff", transition:"le  ft 0.2s" }}/>
21:01:24.316                 </div>
21:01:24.316                 <span style={{ fontSize:11, fontWeight:700, color:allowCounter?"  #E8317A":"#666", whiteSpace:"nowrap" }}>Counter Offer {allowCounter?"ON":"OFF"  }</span>
21:01:24.316               </div>
21:01:24.316               {loadedCompId ? (
21:01:24.316                 <div style={{ display:"flex", gap:6 }}>
21:01:24.316                   <Btn onClick={async()=>{
21:01:24.316                     if (!onSaveQuote) return;
21:01:24.316                     const { id } = await onSaveQuote({
21:01:24.316                       existingId: loadedCompId,
21:01:24.316                       seller, cards:included.map(r=>({ name:r.name, cardType:r.c  ardType, qty:parseInt(r.qty)||1, mktVal:parseFloat(r.mktVal)||0, pctOverride:r  .pctOverride||"", offerPerCard:getCostPerCard(r) })),
21:01:24.316                       dispOffer, dispPct, totalMkt, custNote,
21:01:24.316                       payment:seller.payment, paymentHandle:seller.paymentHandle  ,
21:01:24.316                       allowCounter,
21:01:24.316                     });
21:01:24.316                     const link = `${window.location.origin}/quote/${loadedCompId  }`;
21:01:24.316                     setQuoteLink(link);
21:01:24.316                     navigator.clipboard?.writeText(link);
21:01:24.316                     setQuoteCopied(true);
21:01:24.316                     setTimeout(()=>setQuoteCopied(false), 3000);
21:01:24.316                   }} variant="green" disabled={included.length===0}>{"📤 Send Of  fer Back"}</Btn>
21:01:24.316                   <Btn onClick={async()=>{
21:01:24.316                     if (!onSaveQuote) return;
21:01:24.316                     const { id, quoteRef } = await onSaveQuote({
21:01:24.316                       existingId: null,
21:01:24.316                       seller, cards:included.map(r=>({ name:r.name, cardType:r.c  ardType, qty:parseInt(r.qty)||1, mktVal:parseFloat(r.mktVal)||0, pctOverride:r  .pctOverride||"", offerPerCard:getCostPerCard(r) })),
21:01:24.316                       dispOffer, dispPct, totalMkt, custNote,
21:01:24.316                       payment:seller.payment, paymentHandle:seller.paymentHandle  ,
21:01:24.316                       allowCounter,
21:01:24.316                     });
21:01:24.316                     const link = `${window.location.origin}/quote/${id}`;
21:01:24.316                     setSavedQuoteRef(quoteRef || null);
21:01:24.316                     setQuoteLink(link);
21:01:24.316                     navigator.clipboard?.writeText(link);
21:01:24.316                     setQuoteCopied(true);
21:01:24.316                     setTimeout(()=>setQuoteCopied(false), 3000);
21:01:24.316                   }} variant="ghost" disabled={included.length===0}>{"\uD83D\uDD  17 Generate New Link"}</Btn>
21:01:24.316                 </div>
21:01:24.316               ) : (
21:01:24.316               <Btn onClick={async()=>{
21:01:24.316                 if (!onSaveQuote) return;
21:01:24.316                 const { id, quoteRef } = await onSaveQuote({
21:01:24.316                   existingId: null,
21:01:24.317                   seller, cards:included.map(r=>({ name:r.name, cardType:r.cardT  ype, qty:parseInt(r.qty)||1, mktVal:parseFloat(r.mktVal)||0, pctOverride:r.pct  Override||"", offerPerCard:getCostPerCard(r) })),
21:01:24.317                   dispOffer, dispPct, totalMkt, custNote,
21:01:24.317                   payment:seller.payment, paymentHandle:seller.paymentHandle,
21:01:24.317                   allowCounter,
21:01:24.317                 });
21:01:24.317                 const link = `${window.location.origin}/quote/${id}`;
21:01:24.317                 setSavedQuoteRef(quoteRef || null);
21:01:24.317                 setQuoteLink(link);
21:01:24.317                 navigator.clipboard?.writeText(link);
21:01:24.317                 setQuoteCopied(true);
21:01:24.317                 setTimeout(()=>setQuoteCopied(false), 3000);
21:01:24.317               }} variant="ghost" disabled={included.length===0}>{"\uD83D\uDD17 S  hare Quote"}</Btn>
21:01:24.317               )}
21:01:24.317               {quoteLink && (
21:01:24.317                 <div style={{ display:"flex", flexDirection:"column", gap:6, fle  x:1 }}>
21:01:24.317                   {savedQuoteRef && (
21:01:24.317                     <div style={{ display:"flex", alignItems:"center", gap:8, ba  ckground:"#0a0a1a", border:"1px solid #7B9CFF33", borderRadius:8, padding:"6px   12px" }}>
21:01:24.317                       <span style={{ fontSize:11, color:"#7B9CFF", fontWeight:70  0 }}>📋 Quote Ref:</span>
21:01:24.317                       <span style={{ fontSize:14, fontWeight:900, color:"#F0F0F0  ", letterSpacing:1 }}>{savedQuoteRef}</span>
21:01:24.317                       <button onClick={()=>{ navigator.clipboard?.writeText(save  dQuoteRef); }} style={{ background:"none", border:"1px solid #2a2a2a", borderR  adius:5, color:"#555", cursor:"pointer", fontSize:10, padding:"2px 8px", fontF  amily:"inherit" }}>Copy</button>
21:01:24.317                       <span style={{ fontSize:10, color:"#555", marginLeft:"auto  " }}>Use this in payment notes</span>
21:01:24.317                     </div>
21:01:24.317                   )}
21:01:24.317                   <div style={{ display:"flex", alignItems:"center", gap:8, back  ground:"#0a1a0a", border:"1px solid #4ade8033", borderRadius:8, padding:"6px 1  2px" }}>
21:01:24.317                     <span style={{ fontSize:11, color:"#4ade80", fontWeight:700   }}>{quoteCopied ? "\u2705 Copied!" : "\uD83D\uDD17"}</span>
21:01:24.317                     <span style={{ fontSize:11, color:"#888", flex:1, overflow:"  hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{quoteLink}</span>
21:01:24.317                     <button onClick={()=>{ navigator.clipboard?.writeText(quoteL  ink); setQuoteCopied(true); setTimeout(()=>setQuoteCopied(false),3000); }} sty  le={{ background:"none", border:"1px solid #2a2a2a", borderRadius:5, color:"#8  88", cursor:"pointer", fontSize:11, padding:"2px 8px", fontFamily:"inherit", w  hiteSpace:"nowrap" }}>Copy</button>
21:01:24.317                     <a href={quoteLink} target="_blank" rel="noreferrer" style={  { color:"#E8317A", fontSize:11, textDecoration:"none", whiteSpace:"nowrap" }}>  {"Open \u2197"}</a>
21:01:24.317                   </div>
21:01:24.317                 </div>
21:01:24.317               )}
21:01:24.317               <Btn onClick={()=>saveComp("saved")} variant="ghost">{"\uD83D\uDCB  E Save Comp"}</Btn>
21:01:24.317               <Btn onClick={()=>saveComp("passed")} variant="ghost">{"\u274C Pas  s on Lot"}</Btn>
21:01:24.317               <Btn onClick={()=>{saveComp("accepted");doAccept();}} disabled={in  cluded.length===0} variant="green">{"\u2705 Accept & Import"}{totalCards} card  {totalCards!==1?"s":""}</Btn>
21:01:24.317             </div>
21:01:24.317             <div style={{ marginBottom:14, display:"flex", gap:10, alignItems:"f  lex-end", flexWrap:"wrap" }}>
21:01:24.318               <div style={{ flex:1, minWidth:180 }}>
21:01:24.318                 <label style={S.lbl}>Cards Going To <span style={{ color:"#E8317  A" }}>*</span></label>
21:01:24.318                 <select value={lotLocation} onChange={e=>setLotLocation(e.target  .value)}
21:01:24.318                   style={{ ...S.inp, fontWeight:700, color:"#F0F0F0", cursor:"po  inter" }}>
21:01:24.318                   {LOCATIONS.map(l=><option key={l} value={l}>{l}</option>)}
21:01:24.318                 </select>
21:01:24.318               </div>
21:01:24.318             </div>
21:01:24.318             <div style={{ marginBottom:16 }}>
21:01:24.318               <label style={{ ...S.lbl, color:"#E8317A" }}>Notes for Seller (sho  wn on Customer View)</label>
21:01:24.318               <textarea
21:01:24.318                 value={custNote}
21:01:24.318                 onChange={e=>setCustNote(e.target.value)}
21:01:24.318                 placeholder="e.g. Condition notes, grade estimates, any special   considerations..."
21:01:24.318                 rows={2}
21:01:24.318                 style={{ ...S.inp, resize:"vertical", lineHeight:1.5, fontSize:1  2 }}
21:01:24.318               />
21:01:24.318             </div>
21:01:24.318             <div style={{ borderTop:"1px solid #F0D0DC", paddingTop:16 }}>
21:01:24.318               <div style={{ display:"flex", alignItems:"center", gap:10, marginB  ottom:10 }}>
21:01:24.318                 <div style={{ fontSize:10, fontWeight:700, color:"#AAAAAA", text  Transform:"uppercase", letterSpacing:1.5 }}>Counter Offer Calculator</div>
21:01:24.318                 {(counterAmt!=null&&counterAmt>0) && <span style={{ background:"  #111111", color:"#AAAAAA", border:"1px solid #92400e33", borderRadius:5, paddi  ng:"2px 8px", fontSize:11, fontWeight:700 }}>{"\u26A0 Counter is active -- ove  rrides your offer"}</span>}
21:01:24.318               </div>
21:01:24.318               <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr  ", gap:12 }}>
21:01:24.318                 <div><label style={S.lbl}>Seller's Counter ($)</label><input typ  e="number" value={counterOffer} onChange={e=>setCounterOffer(e.target.value)}   placeholder="0.00" style={{ ...S.inp, border:(counterAmt!=null&&counterAmt>0)?  "2px solid #E8317A":S.inp.border }}/></div>
21:01:24.318                 <div><label style={S.lbl}>Counter Zone</label><div style={{ ...S  .inp, background:counterZone?.bg||"#F9FAFB", border:`1.5px solid ${counterZone  ?.color||"#E5E7EB"}`, color:counterZone?.color||"#9CA3AF", fontWeight:700 }}>{  counterZone?counterZone.label:totalMkt>0?"Enter counter":"Add cards first"}</d  iv></div>
21:01:24.318                 <div><label style={S.lbl}>Counter Buy %</label><div style={{ ...  S.inp, color:(counterAmt!=null&&counterAmt>0)?(counterZone?.color||"#6B2D8B"):  "#9CA3AF", fontWeight:700 }}>{(counterAmt!=null&&counterAmt>0)&&totalMkt>0?`${  ((counterAmt/totalMkt)*100).toFixed(1)}%`:"--"}</div></div>
21:01:24.318                 <div><label style={S.lbl}>vs Your Offer</label><div style={{ ...  S.inp, color:(counterAmt!=null&&counterAmt>(offerAmt!=null&&offerAmt>0?offerAm  t:calcOffer))?"#991b1b":"#166534", fontWeight:700 }}>{(counterAmt!=null&&count  erAmt>0)&&calcOffer>0?`$${Math.abs(counterAmt-(offerAmt>0?offerAmt:calcOffer))  .toFixed(2)} ${counterAmt>(offerAmt!=null&&offerAmt>0?offerAmt:calcOffer)?"ove  r":"under"}`:"--"}</div></div>
21:01:24.318               </div>
21:01:24.318               {(counterAmt!=null&&counterAmt>0) && totalMkt > 0 && (
21:01:24.318                 <div style={{ marginTop:8, display:"flex", alignItems:"center",   gap:8 }}>
21:01:24.318                   <span style={{ fontSize:12, color:"#AAAAAA" }}>Active offer: <  strong style={{color:"#F0F0F0"}}>${counterAmt.toFixed(2)}</strong> at <strong   style={{color:counterZone?.color||"#F0F0F0"}}>{((counterAmt/totalMkt)*100).toF  ixed(1)}%</strong> -- card values and zones updated</span>
21:01:24.318                   <button onClick={()=>setCounterOffer("")} style={{ background:  "none", border:"none", color:"#AAAAAA", cursor:"pointer", fontSize:12, fontWei  ght:700, textDecoration:"underline" }}>Clear</button>
21:01:24.318                 </div>
21:01:24.318               )}
21:01:24.318             </div>
21:01:24.318           </div>
21:01:24.318           </div>{/* end left column */}
21:01:24.318   
21:01:24.318           {/* Seller Intelligence Panel -- right column */}
21:01:24.319           {seller.name && (() => {
21:01:24.319             const sellerComps = comps.filter(c => (c.seller||"").toLowerCase() =  == seller.name.toLowerCase());
21:01:24.319             if (sellerComps.length === 0) return (
21:01:24.319               <div style={{ background:"#111", border:"1px solid #1a1a1a", borde  rRadius:10, padding:"20px 16px", display:"flex", flexDirection:"column", align  Items:"center", justifyContent:"center", gap:8, minHeight:160, color:"#333", p  osition:"sticky", top:80 }}>
21:01:24.319                 <div style={{ fontSize:24 }}>{"\uD83C\uDD95"}</div>
21:01:24.319                 <div style={{ fontSize:12, fontWeight:700, color:"#555" }}>New s  eller</div>
21:01:24.319                 <div style={{ fontSize:11, color:"#333", textAlign:"center" }}>N  o previous history with {seller.name}</div>
21:01:24.319               </div>
21:01:24.319             );
21:01:24.319             const totalPaid    = sellerComps.reduce((s,c)=>s+(parseFloat(c.offer  )||0),0);
21:01:24.319             const totalMktVal  = sellerComps.reduce((s,c)=>s+(parseFloat(c.total  Market)||0),0);
21:01:24.319             const avgPct       = totalMktVal > 0 ? totalPaid/totalMktVal : 0;
21:01:24.319             const accepted     = sellerComps.filter(c=>c.status==="accepted").le  ngth;
21:01:24.319             const declined     = sellerComps.filter(c=>c.status==="declined").le  ngth;
21:01:24.319             const pending      = sellerComps.filter(c=>c.status==="pending").len  gth;
21:01:24.319             const counterCount = sellerComps.filter(c=>c.status==="countered").l  ength;
21:01:24.319             const avgLotSize   = sellerComps.reduce((s,c)=>s+(c.totalCards||0),0  )/sellerComps.length;
21:01:24.319             const sorted       = [...sellerComps].sort((a,b)=>(b.date||"").local  eCompare(a.date||""));
21:01:24.319             const statColor    = p => p > 0.65 ? "#E8317A" : p > 0.55 ? "#FBBF24  " : "#4ade80";
21:01:24.319             return (
21:01:24.319               <div style={{ display:"flex", flexDirection:"column", gap:10, posi  tion:"sticky", top:80 }}>
21:01:24.319                 <div style={{ background:"#111", border:"1px solid #1a1a1a", bor  derRadius:10, padding:"14px 16px" }}>
21:01:24.319                   <div style={{ fontSize:14, fontWeight:900, color:"#F0F0F0", ma  rginBottom:2 }}>{seller.name}</div>
21:01:24.319                   <div style={{ fontSize:11, color:"#555" }}>{sellerComps.length  } deal{sellerComps.length!==1?"s":""} · Last: {sorted[0]?.date||"--"}</div>
21:01:24.319                   {seller.contact && <div style={{ fontSize:11, color:"#7B9CFF",   marginTop:4 }}>{seller.contact}</div>}
21:01:24.319                 </div>
21:01:24.319                 <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap  :8 }}>
21:01:24.319                   {[
21:01:24.319                     { l:"Total Paid",   v:`$${Math.round(totalPaid).toLocaleStri  ng()}`,      c:"#4ade80" },
21:01:24.319                     { l:"Avg % of Mkt", v:`${Math.round(avgPct*100)}%`,                        c:statColor(avgPct) },
21:01:24.319                     { l:"Avg Lot Size", v:`${Math.round(avgLotSize)} cards`,                   c:"#7B9CFF" },
21:01:24.319                     { l:"Accept Rate",  v:sellerComps.length>0?`${Math.round(acc  epted/sellerComps.length*100)}%`:"--", c:"#4ade80" },
21:01:24.319                   ].map(({l,v,c})=>(
21:01:24.319                     <div key={l} style={{ background:"#111", border:"1px solid #  1a1a1a", borderRadius:8, padding:"10px 12px", textAlign:"center" }}>
21:01:24.319                       <div style={{ fontSize:18, fontWeight:900, color:c }}>{v}<  /div>
21:01:24.319                       <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{l  }</div>
21:01:24.319                     </div>
21:01:24.319                   ))}
21:01:24.319                 </div>
21:01:24.319                 <div style={{ background:"#111", border:"1px solid #1a1a1a", bor  derRadius:10, padding:"12px 14px" }}>
21:01:24.320                   <div style={{ fontSize:11, fontWeight:700, color:"#555", textT  ransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Outcomes</div>
21:01:24.320                   {[{l:"\u2705 Accepted",v:accepted,c:"#4ade80"},{l:"\u274C Decl  ined",v:declined,c:"#E8317A"},{l:"\uD83E\uDD1D Countered",v:counterCount,c:"#F  BBF24"},{l:"\u23F3 Pending",v:pending,c:"#555"}].filter(x=>x.v>0).map(({l,v,c}  )=>(
21:01:24.320                     <div key={l} style={{ display:"flex", justifyContent:"space-  between", marginBottom:4 }}>
21:01:24.320                       <span style={{ fontSize:12, color:"#888" }}>{l}</span>
21:01:24.320                       <span style={{ fontSize:12, fontWeight:700, color:c }}>{v}  </span>
