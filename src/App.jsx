import { useState, useEffect, useCallback, useRef } from "react";

// ═══════════ BAJUS Official Rates (Update when BAJUS announces new prices) ═══════════
const GOLD_RATES = {
  "24K": { perGram: 24530, label: "24 Karat", labelBn: "২৪ ক্যারেট" },
  "22K": { perGram: 22485, label: "22 Karat", labelBn: "২২ ক্যারেট" },
  "21K": { perGram: 21465, label: "21 Karat", labelBn: "২১ ক্যারেট" },
  "18K": { perGram: 18400, label: "18 Karat", labelBn: "১৮ ক্যারেট" },
  Sonaton: { perGram: 14985, label: "Traditional", labelBn: "সনাতন" },
};
const SILVER_RATE = 185;
const BHORI = 11.664;
const NISAB_GOLD_G = 87.48;
const NISAB_SILVER_G = 612.36;
const ZAKAT_RATE = 0.025;
const RATES_DATE = "19 Mar 2026";
const FITRA_RATE = 115;

// ═══════════ Helpers ═══════════
const fmt = (n) => (!n || isNaN(n) ? "৳0" : "৳" + Math.round(n).toLocaleString("en-IN"));
const clamp = (v) => Math.max(0, parseFloat(v) || 0);
const store = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ═══════════ Icons ═══════════
const IC = {
  Cash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>,
  Gold: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 19h20L12 2z"/></svg>,
  Inv: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Biz: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  Agri: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22c4-4 8-7.5 8-12a8 8 0 10-16 0c0 4.5 4 8 8 12z"/><path d="M12 12V6"/></svg>,
  Debt: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  Check: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  Right: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  Left: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Moon: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  Sun: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/></svg>,
  Share: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>,
  Bar: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>,
  Home: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>,
  Heart: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>,
  Cal: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Logout: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  Trash: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
  Info: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Google: () => <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  Phone: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
};

// ═══════════ Tooltip ═══════════
const Tip = ({ text }) => {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: 5 }}>
      <span onClick={(e) => { e.stopPropagation(); setOpen(!open); }} style={{ cursor: "pointer", opacity: 0.35, display: "inline-flex" }}><IC.Info /></span>
      {open && <>
        <div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
        <span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-60%)", background: "var(--tip)", color: "var(--tipT)", padding: "9px 12px", borderRadius: 9, fontSize: 11, lineHeight: 1.5, width: 210, zIndex: 100, boxShadow: "0 6px 24px rgba(0,0,0,.2)" }}>{text}</span>
      </>}
    </span>
  );
};

// ═══════════ Input ═══════════
const Inp = ({ label, value, onChange, tip, suffix, placeholder }) => (
  <div style={{ marginBottom: 13 }}>
    <label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 4 }}>
      {label}{tip && <Tip text={tip} />}
    </label>
    <div style={{ position: "relative" }}>
      <input type="number" inputMode="decimal" value={value || ""} onChange={(e) => onChange(clamp(e.target.value))} placeholder={placeholder || "0"}
        style={{ width: "100%", padding: "12px 14px", paddingRight: suffix ? 48 : 14, border: "1.5px solid var(--bd)", borderRadius: 10, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", background: "var(--inp)", color: "var(--t1)", outline: "none", transition: "all .2s", boxSizing: "border-box" }}
        onFocus={(e) => { e.target.style.borderColor = "var(--ac)"; e.target.style.boxShadow = "0 0 0 3px var(--acG)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--bd)"; e.target.style.boxShadow = "none"; }}
      />
      {suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--t3)", fontWeight: 700 }}>{suffix}</span>}
    </div>
  </div>
);

// ═══════════ Calculator Steps ═══════════
const STEPS = [
  { id: "cash", t: "Cash & Savings", tb: "নগদ ও সঞ্চয়", ic: "Cash", c: "#10B981",
    fields: [
      { k: "cashH", l: "Cash in Hand", lb: "হাতে নগদ", tip: "Physical cash at home or on person." },
      { k: "bank", l: "Bank Accounts", lb: "ব্যাংক ব্যালেন্স", tip: "All savings, current, FDR accounts." },
      { k: "wallet", l: "bKash / Nagad / Rocket", lb: "মোবাইল ওয়ালেট", tip: "All mobile wallet balances." },
      { k: "lent", l: "Money Lent Out", lb: "ধার দেওয়া", tip: "Recoverable loans given to others." },
    ] },
  { id: "gold", t: "Gold & Silver", tb: "স্বর্ণ ও রূপা", ic: "Gold", c: "#D97706",
    scholar: "Hanafi: All gold zakatable (incl. worn jewelry). Shafi'i: Personal jewelry may be exempt.",
    scholarBn: "হানাফী: পরিহিত গহনাসহ সব স্বর্ণে যাকাত। শাফিঈ: ব্যক্তিগত গহনা মুক্ত হতে পারে।",
    fields: [
      { k: "goldA", l: "Gold Amount", lb: "স্বর্ণের পরিমাণ", tip: "Select karat & unit above. Nisab: 7.5 Bhori.", isGold: true },
      { k: "slvA", l: "Silver Amount", lb: "রূপার পরিমাণ", tip: "Nisab: 612.36g (52.5 Tola). ~৳185/gm.", isSilver: true },
    ] },
  { id: "inv", t: "Investments", tb: "বিনিয়োগ", ic: "Inv", c: "#8B5CF6",
    fields: [
      { k: "stk", l: "Stocks / Shares", lb: "শেয়ার বাজার", tip: "DSE/CSE holdings, mutual funds." },
      { k: "fdr", l: "FDR / DPS", lb: "এফডিআর / ডিপিএস", tip: "Fixed deposits, DPS schemes." },
      { k: "sanchay", l: "Sanchayapatra", lb: "সঞ্চয়পত্র", tip: "All savings certificates." },
      { k: "pf", l: "Provident Fund", lb: "প্রভিডেন্ট ফান্ড", tip: "GPF/CPF — only if withdrawable." },
      { k: "otI", l: "Other (Crypto, Bonds)", lb: "অন্যান্য", tip: "Cryptocurrency, bonds, insurance." },
    ] },
  { id: "biz", t: "Business & Rental", tb: "ব্যবসা ও ভাড়া", ic: "Biz", c: "#EC4899",
    fields: [
      { k: "bizC", l: "Business Cash", lb: "ব্যবসায়ের নগদ", tip: "Cash held for business." },
      { k: "invt", l: "Inventory", lb: "মজুদ পণ্য", tip: "Market value of goods for sale." },
      { k: "rcv", l: "Receivables", lb: "পাওনা", tip: "Money owed to you." },
      { k: "rent", l: "Saved Rental Income", lb: "জমানো ভাড়া", tip: "Home NOT zakatable." },
    ] },
  { id: "agri", t: "Agriculture", tb: "কৃষি", ic: "Agri", c: "#059669",
    note: "Agricultural zakat: 10% rain-fed, 5% irrigated — NOT 2.5%!",
    noteBn: "কৃষি যাকাত: বৃষ্টি ১০%, সেচ ৫% — ২.৫% নয়!",
    fields: [
      { k: "agR", l: "Rain-fed Crops (10%)", lb: "বৃষ্টিনির্ভর ফসল (১০%)", tip: "Zakat: 10% (Ushr)" },
      { k: "agI", l: "Irrigated Crops (5%)", lb: "সেচনির্ভর ফসল (৫%)", tip: "Zakat: 5% (Half Ushr)" },
    ] },
  { id: "debt", t: "Debts & Liabilities", tb: "ঋণ ও দায়", ic: "Debt", c: "#EF4444",
    note: "Only deduct IMMEDIATE debts due now, not entire loan amount.",
    noteBn: "শুধু এখনই বকেয়া ঋণ বাদ দিন, পুরো ঋণ নয়।",
    fields: [
      { k: "pL", l: "Personal Loans", lb: "ব্যক্তিগত ঋণ", tip: "Money owed to people." },
      { k: "bL", l: "Bank Loan / EMI Due", lb: "ব্যাংক EMI বকেয়া", tip: "Only current installment." },
      { k: "cc", l: "Credit Card", lb: "ক্রেডিট কার্ড", tip: "Outstanding balance." },
      { k: "mehr", l: "Unpaid Mehr", lb: "অপরিশোধিত মোহরানা", tip: "Deductible (Hanafi)." },
      { k: "oD", l: "Other Due", lb: "অন্যান্য দায়", tip: "Rent, bills, taxes due now." },
    ] },
];

// ═══════════ Sadaqah Jariyah Plans ═══════════
const JARIYAH = [
  { id: "auto", name: "Auto-Rickshaw", nameBn: "অটো-রিকশা", cost: 350000, income: 800, emoji: "🛺",
    desc: "Gift an auto-rickshaw. Recipient earns ~৳800/day, pays back monthly.",
    descBn: "অটো-রিকশা দিন। প্রতিদিন ~৳৮০০ আয়, মাসিক কিস্তিতে পরিশোধ।" },
  { id: "sew", name: "Sewing Machine", nameBn: "সেলাই মেশিন", cost: 25000, income: 300, emoji: "🧵",
    desc: "Industrial sewing machine. ~৳300/day tailoring income.",
    descBn: "সেলাই মেশিন। দৈনিক ~৳৩০০ আয়।" },
  { id: "van", name: "Electric Van", nameBn: "ইলেকট্রিক ভ্যান", cost: 180000, income: 600, emoji: "🔋",
    desc: "Battery-powered delivery van. ~৳600/day earnings.",
    descBn: "ব্যাটারি ভ্যান। দৈনিক ~৳৬০০ আয়।" },
  { id: "shop", name: "Grocery Shop", nameBn: "মুদি দোকান", cost: 80000, income: 500, emoji: "🏪",
    desc: "Setup a small grocery shop. ~৳500/day profit.",
    descBn: "ছোট মুদি দোকান। দৈনিক ~৳৫০০ লাভ।" },
  { id: "cow", name: "Dairy Cow", nameBn: "দুধের গাভী", cost: 120000, income: 400, emoji: "🐄",
    desc: "Dairy cow yields ~৳400/day from milk sales.",
    descBn: "দুধের গাভী। দৈনিক ~৳৪০০ আয়।" },
  { id: "fish", name: "Fish Farming", nameBn: "মাছ চাষ", cost: 60000, income: 350, emoji: "🐟",
    desc: "Pond fish farming. ~৳350/day average.",
    descBn: "পুকুরে মাছ চাষ। দৈনিক গড়ে ~৳৩৫০।" },
];

// ═══════════ MAIN APP ═══════════
export default function App() {
  const [view, setView] = useState("splash");
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState("en");
  const [step, setStep] = useState(0);
  const [vals, setVals] = useState({});
  const [goldKarat, setGoldKarat] = useState("22K");
  const [goldUnit, setGoldUnit] = useState("bhori");
  const [silverUnit, setSilverUnit] = useState("gram");
  const [nisabStd, setNisabStd] = useState("silver");
  const [payments, setPayments] = useState([]);
  const [years, setYears] = useState([]);
  const [curZakat, setCurZakat] = useState(null);
  const [newPay, setNewPay] = useState({ amount: 0, note: "" });
  const [showPayForm, setShowPayForm] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginMethod, setLoginMethod] = useState(null);
  const [fitraPpl, setFitraPpl] = useState(1);
  const [selJariyah, setSelJariyah] = useState(null);
  const [anim, setAnim] = useState(true);
  const scrollRef = useRef(null);
  const bn = lang === "bn";

  // ── Load from localStorage on mount ──
  useEffect(() => {
    const u = store.get("zf-user");
    const d = store.get("zf-dark");
    const p = store.get("zf-payments");
    const y = store.get("zf-years");
    const c = store.get("zf-current");
    if (d) setDark(d);
    if (p) setPayments(p);
    if (y) setYears(y);
    if (c) setCurZakat(c);
    if (u) { setUser(u); setView("home"); }
    else { setTimeout(() => setView("login"), 1500); }
  }, []);

  const go = (v) => { setAnim(false); setTimeout(() => { setView(v); setAnim(true); scrollRef.current?.scrollTo(0, 0); }, 100); };
  const sv = (k, v) => setVals((p) => ({ ...p, [k]: v }));
  const toggleDark = () => { const d = !dark; setDark(d); store.set("zf-dark", d); };

  // ── Gold/Silver to grams ──
  const goldGrams = useCallback(() => {
    const a = vals.goldA || 0;
    if (goldUnit === "gram") return a;
    if (goldUnit === "bhori") return a * BHORI;
    return a * (BHORI / 16); // ana
  }, [vals.goldA, goldUnit]);

  const silverGrams = useCallback(() => {
    const a = vals.slvA || 0;
    return silverUnit === "bhori" ? a * BHORI : a;
  }, [vals.slvA, silverUnit]);

  // ── Calculate totals ──
  const calc = useCallback(() => {
    const v = vals;
    const gG = goldGrams(), gR = GOLD_RATES[goldKarat].perGram, goldVal = gG * gR;
    const sG = silverGrams(), slvVal = sG * SILVER_RATE;
    const cash = (v.cashH || 0) + (v.bank || 0) + (v.wallet || 0) + (v.lent || 0);
    const invest = (v.stk || 0) + (v.fdr || 0) + (v.sanchay || 0) + (v.pf || 0) + (v.otI || 0);
    const biz = (v.bizC || 0) + (v.invt || 0) + (v.rcv || 0) + (v.rent || 0);
    const totalAssets = cash + goldVal + slvVal + invest + biz;
    const totalDebts = (v.pL || 0) + (v.bL || 0) + (v.cc || 0) + (v.mehr || 0) + (v.oD || 0);
    const net = totalAssets - totalDebts;
    const nisabGold = NISAB_GOLD_G * GOLD_RATES["22K"].perGram;
    const nisabSilver = NISAB_SILVER_G * SILVER_RATE;
    const nisab = nisabStd === "gold" ? nisabGold : nisabSilver;
    const eligible = net >= nisab;
    const stdZakat = eligible ? net * ZAKAT_RATE : 0;
    const agriZakat = (v.agR || 0) * 0.10 + (v.agI || 0) * 0.05;
    return { cash, gG, goldVal, gR, goldKarat, sG, slvVal, invest, biz, totalAssets, totalDebts, net, nisab, eligible, stdZakat, agriZakat, total: stdZakat + agriZakat };
  }, [vals, goldKarat, goldGrams, silverGrams, nisabStd]);

  const doCalc = () => {
    const r = calc();
    const yr = new Date().getFullYear();
    const rec = { ...r, year: yr, date: new Date().toISOString() };
    setCurZakat(rec); store.set("zf-current", rec);
    const updated = [...years.filter((y) => y.year !== yr), rec].sort((a, b) => b.year - a.year);
    setYears(updated); store.set("zf-years", updated);
    go("result");
  };

  // ── Payments ──
  const addPayment = () => {
    if (!newPay.amount) return;
    const p = { id: Date.now(), amount: newPay.amount, note: newPay.note, date: new Date().toISOString() };
    const updated = [p, ...payments];
    setPayments(updated); store.set("zf-payments", updated);
    setNewPay({ amount: 0, note: "" }); setShowPayForm(false);
  };
  const delPayment = (id) => { const u = payments.filter((p) => p.id !== id); setPayments(u); store.set("zf-payments", u); };

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const remaining = curZakat ? Math.max(0, curZakat.total - totalPaid) : 0;
  const progress = curZakat && curZakat.total > 0 ? Math.min(1, totalPaid / curZakat.total) : 0;
  const monthly = curZakat && curZakat.total > 0 ? curZakat.total / 12 : 0;
  const MONTHS = bn ? ["জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthPaid = (m) => payments.filter((p) => new Date(p.date).getMonth() === m).reduce((s, p) => s + p.amount, 0);

  // ── Auth ──
  const doLogin = () => { if (!loginName.trim()) return; const u = { name: loginName.trim(), method: loginMethod, joined: new Date().toISOString() }; setUser(u); store.set("zf-user", u); go("home"); };
  const doLogout = () => { setUser(null); localStorage.removeItem("zf-user"); go("login"); };

  // ── Share ──
  const shareResult = () => {
    if (!curZakat) return;
    const t = `ZakatFlow — ${user?.name || ""}\nYear: ${curZakat.year}\nAssets: ${fmt(curZakat.totalAssets)}\nDebts: ${fmt(curZakat.totalDebts)}\nNet: ${fmt(curZakat.net)}\nZakat Due: ${fmt(curZakat.total)}\nPaid: ${fmt(totalPaid)} | Left: ${fmt(remaining)}\n\nCalculated via ZakatFlow`;
    if (navigator.share) navigator.share({ title: "ZakatFlow", text: t });
    else { navigator.clipboard?.writeText(t); alert(bn ? "কপি হয়েছে!" : "Copied to clipboard!"); }
  };

  // ═══════════ CSS ═══════════
  const css = `
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
:root{
  --bg:${dark ? "#0C0C12" : "#F6F5F1"};--cd:${dark ? "#16161F" : "#FFF"};
  --t1:${dark ? "#EEEEF4" : "#111128"};--t2:${dark ? "#9898B0" : "#4A4A6A"};--t3:${dark ? "#5A5A70" : "#9090A8"};
  --bd:${dark ? "#252530" : "#E4E2DC"};--ac:#0B7A62;--acG:${dark ? "#0B7A6230" : "#0B7A6212"};--acL:${dark ? "#0B7A6218" : "#E4F4EE"};
  --inp:${dark ? "#111118" : "#EFEEEA"};--gold:#B8860B;--goldL:${dark ? "#B8860B15" : "#FDF5E0"};
  --danger:#D32F2F;--dangerL:${dark ? "#D32F2F15" : "#FDE8E8"};--ok:#0B8A50;
  --tip:${dark ? "#EEEEF4" : "#111128"};--tipT:${dark ? "#111128" : "#EEEEF4"};
  --sh:${dark ? "0 1px 6px rgba(0,0,0,.3)" : "0 1px 4px rgba(0,0,0,.04)"}
}
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
body{background:var(--bg);font-family:'Outfit','Noto Sans Bengali',sans-serif}
.Z{color:var(--t1);min-height:100vh;min-height:100dvh;max-width:680px;margin:0 auto;position:relative;overflow-x:hidden}
.W{position:relative;z-index:1;padding:0 16px 96px;min-height:100vh;min-height:100dvh;transition:opacity .1s}
@media(min-width:600px){.W{padding:0 40px 96px}}
@media(min-width:1024px){.Z{max-width:520px;border-left:1px solid var(--bd);border-right:1px solid var(--bd);box-shadow:0 0 60px rgba(0,0,0,.06)}.W{padding:0 32px 96px}}
.hd{padding:14px 0 10px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg);z-index:50}
.lg{font-size:16px;font-weight:800;letter-spacing:-.4px;display:flex;align-items:center;gap:6px}
.dt{width:7px;height:7px;border-radius:50%;background:var(--ac);animation:pu 2s ease infinite}
@keyframes pu{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
.cd{background:var(--cd);border-radius:14px;padding:18px;border:1px solid var(--bd);box-shadow:var(--sh);margin-bottom:12px}
.b{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 20px;border-radius:11px;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:all .15s;font-family:inherit}
.bp{background:var(--ac);color:#fff;box-shadow:0 2px 10px rgba(11,122,98,.25)}.bp:active{transform:scale(.98)}
.bo{background:transparent;color:var(--ac);border:1.5px solid var(--ac)}
.bg{background:var(--acL);color:var(--ac);border:none}
.bd{background:var(--dangerL);color:var(--danger);border:none;padding:7px 10px;font-size:11px;border-radius:7px}
.pl{padding:4px 10px;border-radius:14px;font-size:10px;font-weight:700;cursor:pointer;border:1.5px solid var(--bd);background:var(--cd);color:var(--t2);transition:all .15s}
.pl.on{background:var(--ac);color:#fff;border-color:var(--ac)}
.pr{width:100%;height:10px;background:var(--inp);border-radius:5px;overflow:hidden}
.prf{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--ac),#10B981);transition:width .6s ease}
.nv{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:680px;background:var(--cd);border-top:1px solid var(--bd);padding:8px 12px;padding-bottom:max(8px,env(safe-area-inset-bottom));display:flex;justify-content:space-around;z-index:100}
@media(min-width:1024px){.nv{max-width:520px;border-left:1px solid var(--bd);border-right:1px solid var(--bd)}}
.ni{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 12px;border-radius:9px;cursor:pointer;color:var(--t3);font-size:9px;font-weight:600;border:none;background:none;font-family:inherit;transition:all .12s}
.ni.on{color:var(--ac);background:var(--acL)}
.mn{font-family:'JetBrains Mono',monospace}
.fi{animation:fii .2s ease}@keyframes fii{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.tg{display:inline-flex;padding:3px 7px;border-radius:5px;font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.sd{display:flex;gap:4px;justify-content:center;margin-bottom:16px}
.sdi{height:3.5px;border-radius:2px;background:var(--bd);transition:all .3s;cursor:pointer;flex:1;max-width:40px}
.sdi.on{background:var(--ac)}.sdi.dn{background:var(--ac);opacity:.3}
.kg{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:12px}
@media(min-width:500px){.kg{grid-template-columns:repeat(5,1fr)}}
.ko{padding:8px 4px;border-radius:9px;border:1.5px solid var(--bd);cursor:pointer;text-align:center;transition:all .12s;background:var(--cd);font-size:10px}
.ko.on{border-color:var(--gold);background:var(--goldL)}
input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
input[type=number]{-moz-appearance:textfield}
.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media(min-width:500px){.g3{grid-template-columns:repeat(4,1fr)}.g2{grid-template-columns:repeat(3,1fr)}}
@media(max-width:440px){.Z,.nv{max-width:100%}.W{padding:0 14px 96px}}
@keyframes splash{0%{opacity:0;transform:scale(.8)}50%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}
@keyframes loadbar{0%{left:-60%}100%{left:100%}}
`;

  // ═══════════ SPLASH ═══════════
  if (view === "splash") return (<><style>{css}</style>
    <div className="Z"><div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0B7A62,#059669)", color: "#fff", textAlign: "center", padding: 32 }}>
      <div style={{ animation: "splash .6s ease" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>☪</div>
        <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1, fontFamily: "'Outfit',sans-serif" }}>ZakatFlow</div>
        <div style={{ fontSize: 13, opacity: .7, marginTop: 6 }}>Your Zakat Companion</div>
        <div style={{ marginTop: 24, width: 40, height: 3, borderRadius: 2, background: "rgba(255,255,255,.3)", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", height: "100%", width: "60%", background: "#fff", borderRadius: 2, animation: "loadbar 1.5s ease infinite" }} /></div>
      </div>
    </div></div></>);

  // ═══════════ LOGIN ═══════════
  if (view === "login") return (<><style>{css}</style>
    <div className="Z"><div style={{ minHeight: "100vh", padding: "60px 24px 40px", display: "flex", flexDirection: "column" }}>
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}><span className="dt" style={{ width: 10, height: 10 }} /><span style={{ fontSize: 22, fontWeight: 800, letterSpacing: -.5 }}>ZakatFlow</span></div>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -.5, lineHeight: 1.3 }}>{bn ? "বিসমিল্লাহ,\nশুরু করুন" : "Bismillah,\nLet's Begin"}</h1>
        <p style={{ color: "var(--t2)", fontSize: 13, marginTop: 6 }}>{bn ? "আপনার যাকাত যাত্রা শুরু করুন" : "Start your Zakat journey"}</p>
      </div>
      {!loginMethod ? <>
        <button onClick={() => setLoginMethod("google")} style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "1.5px solid var(--bd)", background: "var(--cd)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "var(--t1)" }}><IC.Google />{bn ? "Google দিয়ে শুরু করুন" : "Continue with Google"}</button>
        <button onClick={() => setLoginMethod("phone")} style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "1.5px solid var(--bd)", background: "var(--cd)", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", marginBottom: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "var(--t1)" }}><IC.Phone />{bn ? "মোবাইল নম্বর দিয়ে" : "Continue with Phone"}</button>
        <div style={{ textAlign: "center", color: "var(--t3)", fontSize: 12, marginTop: 16, lineHeight: 1.6 }}>{bn ? "আপনার ডেটা আপনার ডিভাইসে সুরক্ষিত" : "Your data stays securely on your device"}</div>
      </> : <div className="fi">
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setLoginMethod(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex" }}><IC.Left /></button>
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--t2)" }}>{loginMethod === "google" ? "Google Account" : "Phone Number"}</span>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 5, display: "block" }}>{bn ? "আপনার নাম" : "Your Name"}</label>
          <input type="text" value={loginName} onChange={(e) => setLoginName(e.target.value)} placeholder={bn ? "নাম লিখুন" : "Enter your name"} style={{ width: "100%", padding: "14px 16px", border: "1.5px solid var(--bd)", borderRadius: 11, fontSize: 15, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} autoFocus onKeyDown={(e) => e.key === "Enter" && doLogin()} />
        </div>
        {loginMethod === "phone" && <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 5, display: "block" }}>{bn ? "মোবাইল নম্বর" : "Phone Number"}</label>
          <input type="tel" placeholder="+880 1XXX-XXXXXX" style={{ width: "100%", padding: "14px 16px", border: "1.5px solid var(--bd)", borderRadius: 11, fontSize: 15, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>}
        <button className="b bp" style={{ width: "100%", padding: "15px", fontSize: 15 }} onClick={doLogin}>{bn ? "শুরু করুন" : "Get Started"} <IC.Right /></button>
      </div>}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 24 }}>
        <button className={`pl ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>EN</button>
        <button className={`pl ${lang === "bn" ? "on" : ""}`} onClick={() => setLang("bn")}>বাং</button>
      </div>
    </div></div></>);

  // ═══════════ VIEWS ═══════════
  // Home
  const VHome = () => (<div className="fi">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <div><div style={{ fontSize: 13, color: "var(--t3)" }}>{bn ? "আস-সালামু আলাইকুম" : "Assalamu Alaikum"} 👋</div><div style={{ fontSize: 20, fontWeight: 800 }}>{user?.name}</div></div>
      <button onClick={doLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", padding: 4 }}><IC.Logout /></button>
    </div>
    <div className="cd" style={{ background: "linear-gradient(135deg,#0B7A62,#06805A)", color: "#fff", border: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 9, fontWeight: 700, letterSpacing: .8, opacity: .6 }}>NISAB • BAJUS • {RATES_DATE}</span></div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: 11, opacity: .75 }}>{bn ? "স্বর্ণ ৭.৫ভরি" : "Gold 7.5 Bhori"}</div><div className="mn" style={{ fontSize: 17, fontWeight: 800 }}>{fmt(NISAB_GOLD_G * GOLD_RATES["22K"].perGram)}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, opacity: .75 }}>{bn ? "রূপা ৫২.৫তোলা" : "Silver 52.5 Tola"}</div><div className="mn" style={{ fontSize: 17, fontWeight: 800 }}>{fmt(NISAB_SILVER_G * SILVER_RATE)}</div></div>
      </div>
    </div>
    {curZakat && curZakat.total > 0 && <div className="cd" onClick={() => go("tracker")} style={{ cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)" }}>{curZakat.year} {bn ? "যাকাত" : "ZAKAT"}</span><span className="tg" style={{ background: progress >= 1 ? "#E6F9F0" : "var(--goldL)", color: progress >= 1 ? "var(--ok)" : "var(--gold)" }}>{progress >= 1 ? "✓ DONE" : `${Math.round(progress * 100)}%`}</span></div>
      <div className="pr"><div className="prf" style={{ width: `${progress * 100}%` }} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--t3)", marginTop: 6 }}><span>{bn ? "পরিশোধিত" : "Paid"}: {fmt(totalPaid)}</span><span>{bn ? "বাকি" : "Left"}: {fmt(remaining)}</span></div>
      <div className="mn" style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "var(--ac)", marginTop: 6 }}>{fmt(curZakat.total)}</div>
      <div style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>≈ {fmt(monthly)}/{bn ? "মাস" : "mo"} × 12</div>
    </div>}
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
      <button className="b bp" style={{ width: "100%", padding: "15px 20px", fontSize: 14 }} onClick={() => { setStep(0); setVals({}); go("calc"); }}>{bn ? "যাকাত হিসাব করুন" : "Calculate Zakat"} <IC.Right /></button>
      <div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1, fontSize: 12 }} onClick={() => go("monthly")}><IC.Cal />{bn ? "মাসিক প্ল্যান" : "Monthly"}</button><button className="b bg" style={{ flex: 1, fontSize: 12 }} onClick={() => go("fitrana")}><IC.Heart />{bn ? "ফিতরা" : "Fitrana"}</button></div>
      <button className="b bo" style={{ width: "100%", fontSize: 12 }} onClick={() => go("jariyah")}>🤝 {bn ? "সদকা জারিয়া" : "Sadaqah Jariyah Planner"}</button>
    </div>
    {years.length > 0 && <div style={{ marginTop: 18 }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: .7, marginBottom: 8 }}>{bn ? "বার্ষিক ইতিহাস" : "YEARLY HISTORY"}</div>
      {years.slice(0, 5).map((y, i) => <div key={i} className="cd" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 14, fontWeight: 800 }}>{y.year}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{bn ? "সম্পদ" : "Assets"}: {fmt(y.totalAssets)} | {bn ? "ঋণ" : "Debt"}: {fmt(y.totalDebts)}</div></div>
        <div style={{ textAlign: "right" }}><div className="mn" style={{ fontSize: 16, fontWeight: 800, color: y.eligible ? "var(--ac)" : "var(--t3)" }}>{fmt(y.total)}</div><span className="tg" style={{ background: y.eligible ? "var(--acL)" : "var(--dangerL)", color: y.eligible ? "var(--ac)" : "var(--danger)" }}>{y.eligible ? (bn ? "ফরজ" : "DUE") : (bn ? "নয়" : "N/A")}</span></div>
      </div>)}</div>}
  </div>);

  // Calculator
  const VCalc = () => { const s = STEPS[step]; const StepIcon = IC[s.ic]; const t = calc(); return (<div className="fi">
    <div className="sd">{STEPS.map((_, i) => <div key={i} className={`sdi ${i === step ? "on" : i < step ? "dn" : ""}`} onClick={() => setStep(i)} />)}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: s.c + "15", display: "flex", alignItems: "center", justifyContent: "center", color: s.c, flexShrink: 0 }}><StepIcon /></div>
      <div><div style={{ fontSize: 9, fontWeight: 700, color: "var(--t3)", letterSpacing: .7 }}>STEP {step + 1}/{STEPS.length}</div><div style={{ fontSize: 16, fontWeight: 800 }}>{bn ? s.tb : s.t}</div></div>
    </div>
    {step === 0 && <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{[{ k: "silver", l: bn ? "রূপা" : "Silver", v: fmt(NISAB_SILVER_G * SILVER_RATE) }, { k: "gold", l: bn ? "স্বর্ণ" : "Gold", v: fmt(NISAB_GOLD_G * GOLD_RATES["22K"].perGram) }].map((n) => <div key={n.k} onClick={() => setNisabStd(n.k)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1.5px solid ${nisabStd === n.k ? "var(--ac)" : "var(--bd)"}`, cursor: "pointer", textAlign: "center", background: nisabStd === n.k ? "var(--acL)" : "var(--cd)" }}><div style={{ fontSize: 12, fontWeight: 700 }}>{n.l}</div><div className="mn" style={{ fontSize: 10, color: "var(--t3)" }}>{n.v}</div></div>)}</div>}
    {s.note && <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--goldL)", fontSize: 11, color: "var(--gold)", marginBottom: 12, lineHeight: 1.4 }}>⚠ {bn ? s.noteBn : s.note}</div>}
    {s.scholar && <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--acL)", fontSize: 10.5, color: "var(--ac)", marginBottom: 12, lineHeight: 1.4 }}>📖 {bn ? s.scholarBn : s.scholar}</div>}
    {s.id === "gold" && <><div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: .5, marginBottom: 4 }}>{bn ? "ক্যারেট" : "KARAT"}</div>
      <div className="kg">{Object.entries(GOLD_RATES).map(([k, v]) => <div key={k} className={`ko ${goldKarat === k ? "on" : ""}`} onClick={() => setGoldKarat(k)}><div style={{ fontWeight: 800, fontSize: 12 }}>{k === "Sonaton" ? (bn ? "সনাতন" : "Trad.") : k}</div><div style={{ fontSize: 9, color: "var(--t3)" }}>৳{v.perGram.toLocaleString()}</div></div>)}</div>
      <div style={{ display: "flex", gap: 5, marginBottom: 12, alignItems: "center" }}><span style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)" }}>{bn ? "ইউনিট" : "Unit"}:</span>{[{ k: "bhori", l: bn ? "ভরি" : "Bhori" }, { k: "gram", l: bn ? "গ্রাম" : "Gram" }, { k: "ana", l: bn ? "আনা" : "Ana" }].map((u) => <span key={u.k} className={`pl ${goldUnit === u.k ? "on" : ""}`} onClick={() => setGoldUnit(u.k)}>{u.l}</span>)}</div></>}
    <div className="cd">{s.fields.map((fd) => { let sfx = "৳"; if (fd.isGold) sfx = goldUnit === "bhori" ? "ভরি" : goldUnit === "ana" ? "আনা" : "gm"; if (fd.isSilver) sfx = silverUnit === "bhori" ? "ভরি" : "gm";
      return <div key={fd.k}>{fd.isSilver && <div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center" }}><span style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)" }}>{bn ? "রূপা" : "Silver"}:</span>{[{ k: "gram", l: "Gram" }, { k: "bhori", l: "Bhori" }].map((u) => <span key={u.k} className={`pl ${silverUnit === u.k ? "on" : ""}`} onClick={() => setSilverUnit(u.k)}>{u.l}</span>)}</div>}<Inp label={bn ? fd.lb : fd.l} value={vals[fd.k]} onChange={(v) => sv(fd.k, v)} tip={fd.tip} suffix={sfx} /></div>; })}</div>
    {s.id === "gold" && vals.goldA > 0 && <div style={{ background: "var(--goldL)", borderRadius: 10, padding: "8px 14px", marginBottom: 10, display: "flex", justifyContent: "space-between", fontSize: 12 }}><span style={{ color: "var(--gold)" }}>{vals.goldA} {goldUnit} × {goldKarat} = {goldGrams().toFixed(1)}gm</span><span className="mn" style={{ fontWeight: 800, color: "var(--gold)" }}>{fmt(goldGrams() * GOLD_RATES[goldKarat].perGram)}</span></div>}
    <div style={{ background: "var(--inp)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{bn ? "নিট সম্পদ" : "Net Wealth"}</span><span className="mn" style={{ fontSize: 14, fontWeight: 800, color: t.net >= 0 ? "var(--ac)" : "var(--danger)" }}>{fmt(t.net)}</span></div>
    <div style={{ display: "flex", gap: 8 }}>
      {step > 0 && <button className="b bg" onClick={() => setStep(step - 1)} style={{ flex: 1 }}><IC.Left />{bn ? "পিছনে" : "Back"}</button>}
      {step < STEPS.length - 1 ? <button className="b bp" onClick={() => setStep(step + 1)} style={{ flex: 2 }}>{bn ? "পরবর্তী" : "Next"} <IC.Right /></button>
        : <button className="b bp" onClick={doCalc} style={{ flex: 2, background: "linear-gradient(135deg,var(--ac),#059669)" }}>{bn ? "হিসাব করুন" : "Calculate"} <IC.Check /></button>}
    </div>
  </div>); };

  // Result
  const VResult = () => { if (!curZakat) return null; const z = curZakat; return (<div className="fi" style={{ textAlign: "center" }}>
    <div style={{ padding: "14px 0" }}>
      <div style={{ width: 50, height: 50, borderRadius: 14, background: z.eligible ? "var(--acL)" : "var(--dangerL)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{z.eligible ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}</div>
      <h2 style={{ fontSize: 16, fontWeight: 700 }}>{z.eligible ? (bn ? "যাকাত ফরজ" : "Zakat is Due") : (bn ? "যাকাত ফরজ নয়" : "Not Due")}</h2>
    </div>
    {z.eligible && <div style={{ marginBottom: 18 }}><div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600 }}>{bn ? "মোট যাকাত" : "TOTAL ZAKAT"}</div><div className="mn" style={{ fontSize: 34, fontWeight: 800, color: "var(--ac)", letterSpacing: -2 }}>{fmt(z.total)}</div><div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>≈ {fmt(z.total / 12)}/{bn ? "মাস" : "mo"} × 12</div>{z.agriZakat > 0 && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>({bn ? "সাধারণ" : "Std"}: {fmt(z.stdZakat)} + {bn ? "কৃষি" : "Agri"}: {fmt(z.agriZakat)})</div>}</div>}
    <div className="cd" style={{ textAlign: "left" }}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 10 }}>{bn ? "বিস্তারিত" : "BREAKDOWN"}</div>
      {[{ l: bn ? "নগদ" : "Cash", v: fmt(z.cash) }, { l: `${bn ? "স্বর্ণ" : "Gold"} (${z.goldKarat})`, v: fmt(z.goldVal), c: "var(--gold)" }, { l: bn ? "রূপা" : "Silver", v: fmt(z.slvVal), s: 1 }, { l: bn ? "বিনিয়োগ" : "Investments", v: fmt(z.invest) }, { l: bn ? "ব্যবসা" : "Business", v: fmt(z.biz) }, { l: bn ? "মোট সম্পদ" : "Total Assets", v: fmt(z.totalAssets), b: 1 }, { l: bn ? "ঋণ" : "Debts", v: `-${fmt(z.totalDebts)}`, c: "var(--danger)" }, { l: bn ? "নিট" : "Net Wealth", v: fmt(z.net), b: 1, c: "var(--ac)" }, { l: bn ? "নিসাব" : "Nisab", v: fmt(z.nisab) }].map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: r.s ? "2px 0 2px 16px" : "6px 0", borderTop: i && !r.s ? "1px solid var(--bd)" : "none", fontSize: r.s ? 11 : 12, color: r.s ? "var(--t3)" : "var(--t1)", fontWeight: r.b ? 700 : 400 }}><span>{r.l}</span><span className="mn" style={{ fontWeight: 600, color: r.c }}>{r.v}</span></div>)}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {z.eligible && <button className="b bp" style={{ width: "100%" }} onClick={() => go("tracker")}><IC.Bar />{bn ? "ট্র্যাক করুন" : "Track Payments"}</button>}
      <div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1 }} onClick={() => { setStep(0); go("calc"); }}>{bn ? "পুনরায়" : "Redo"}</button><button className="b bo" style={{ flex: 1 }} onClick={shareResult}><IC.Share />{bn ? "শেয়ার" : "Share"}</button></div>
    </div>
  </div>); };

  // Monthly Planner
  const VMonthly = () => (<div className="fi">
    <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{bn ? "মাসিক প্ল্যান" : "Monthly Plan"}</h2>
    <p style={{ color: "var(--t3)", fontSize: 11, marginBottom: 14 }}>{bn ? "১২ মাসে ভাগ করে পরিশোধ করুন" : "Split across 12 months"}</p>
    {(!curZakat || curZakat.total <= 0) ? <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--t3)" }}><div style={{ fontSize: 28, marginBottom: 6 }}>📊</div><p style={{ fontSize: 13 }}>{bn ? "প্রথমে হিসাব করুন" : "Calculate Zakat first"}</p><button className="b bp" style={{ marginTop: 12 }} onClick={() => { setStep(0); setVals({}); go("calc"); }}>{bn ? "হিসাব" : "Calculate"}</button></div>
      : <><div className="cd" style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600 }}>{bn ? "মাসিক লক্ষ্যমাত্রা" : "MONTHLY TARGET"}</div><div className="mn" style={{ fontSize: 28, fontWeight: 800, color: "var(--ac)", marginTop: 2 }}>{fmt(monthly)}</div><div style={{ fontSize: 11, color: "var(--t3)" }}>{fmt(curZakat.total)} ÷ 12</div></div>
        <div className="g3">{MONTHS.map((m, i) => { const paid = monthPaid(i), done = paid >= monthly, partial = paid > 0; return <div key={i} className="cd" style={{ padding: 10, textAlign: "center", borderColor: done ? "var(--ac)" : partial ? "var(--gold)" : "var(--bd)", background: done ? "var(--acL)" : partial ? "var(--goldL)" : "var(--cd)" }}><div style={{ fontSize: 11, fontWeight: 700 }}>{m}</div><div className="mn" style={{ fontSize: 12, fontWeight: 700, color: done ? "var(--ac)" : partial ? "var(--gold)" : "var(--t3)" }}>{fmt(paid)}</div><div style={{ fontSize: 9, color: "var(--t3)" }}>{done ? "✓" : `/ ${fmt(monthly)}`}</div></div>; })}</div>
        <div className="cd" style={{ marginTop: 8 }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}><span style={{ fontWeight: 600 }}>{bn ? "পরিশোধিত" : "Paid"}</span><span className="mn" style={{ fontWeight: 800, color: "var(--ac)" }}>{fmt(totalPaid)}</span></div><div className="pr"><div className="prf" style={{ width: `${progress * 100}%` }} /></div><div style={{ textAlign: "center", fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{Math.round(progress * 100)}% {bn ? "সম্পন্ন" : "done"}</div></div>
        <button className="b bp" style={{ width: "100%", marginTop: 8 }} onClick={() => go("tracker")}><IC.Plus />{bn ? "পেমেন্ট যোগ" : "Add Payment"}</button></>}
  </div>);

  // Tracker
  const VTracker = () => (<div className="fi">
    <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{bn ? "পেমেন্ট ট্র্যাকার" : "Payment Tracker"}</h2>
    {curZakat && curZakat.total > 0 && <div className="cd" style={{ textAlign: "center" }}><div style={{ display: "flex", justifyContent: "space-around", marginBottom: 10 }}><div><div style={{ fontSize: 9, color: "var(--t3)", fontWeight: 600 }}>{bn ? "প্রদেয়" : "DUE"}</div><div className="mn" style={{ fontSize: 16, fontWeight: 800 }}>{fmt(curZakat.total)}</div></div><div style={{ width: 1, background: "var(--bd)" }} /><div><div style={{ fontSize: 9, color: "var(--t3)", fontWeight: 600 }}>{bn ? "বাকি" : "LEFT"}</div><div className="mn" style={{ fontSize: 16, fontWeight: 800, color: remaining > 0 ? "var(--gold)" : "var(--ok)" }}>{fmt(remaining)}</div></div></div><div className="pr"><div className="prf" style={{ width: `${progress * 100}%` }} /></div></div>}
    {!showPayForm ? <button className="b bp" style={{ width: "100%", marginBottom: 12 }} onClick={() => setShowPayForm(true)}><IC.Plus />{bn ? "পেমেন্ট যোগ" : "Add Payment"}</button>
      : <div className="cd fi" style={{ border: "1.5px solid var(--ac)" }}><Inp label={bn ? "পরিমাণ" : "Amount"} value={newPay.amount} onChange={(v) => setNewPay((p) => ({ ...p, amount: v }))} suffix="৳" /><div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", marginBottom: 4, display: "block" }}>{bn ? "নোট" : "Note"}</label><input type="text" value={newPay.note} onChange={(e) => setNewPay((p) => ({ ...p, note: e.target.value }))} placeholder={bn ? "যেমন: মসজিদে" : "e.g. Mosque"} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div><div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1 }} onClick={() => setShowPayForm(false)}>{bn ? "বাতিল" : "Cancel"}</button><button className="b bp" style={{ flex: 1 }} onClick={addPayment}><IC.Check />{bn ? "সংরক্ষণ" : "Save"}</button></div></div>}
    {payments.length > 0 && <div className="cd"><div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 6 }}>LOG ({payments.length})</div>{payments.map((p) => <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bd)" }}><div><div className="mn" style={{ fontSize: 13, fontWeight: 700 }}>{fmt(p.amount)}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{p.note && `${p.note} • `}{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div></div><button className="b bd" onClick={() => delPayment(p.id)}><IC.Trash /></button></div>)}</div>}
    {payments.length === 0 && <div style={{ textAlign: "center", padding: "32px", color: "var(--t3)" }}>📋 {bn ? "কোনো পেমেন্ট নেই" : "No payments yet"}</div>}
  </div>);

  // Fitrana
  const VFitrana = () => (<div className="fi">
    <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{bn ? "ফিতরা ক্যালকুলেটর" : "Fitrana Calculator"}</h2>
    <p style={{ color: "var(--t3)", fontSize: 11, marginBottom: 14 }}>{bn ? "ঈদের আগে প্রতিজনের জন্য ফিতরা ওয়াজিব" : "Obligatory before Eid for every family member"}</p>
    <div className="cd"><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", marginBottom: 6, display: "block" }}>{bn ? "সদস্য সংখ্যা" : "Family Members"}</label>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}><button className="b bg" style={{ padding: "8px 14px" }} onClick={() => setFitraPpl(Math.max(1, fitraPpl - 1))}>−</button><span className="mn" style={{ fontSize: 26, fontWeight: 800, minWidth: 36, textAlign: "center" }}>{fitraPpl}</span><button className="b bg" style={{ padding: "8px 14px" }} onClick={() => setFitraPpl(fitraPpl + 1)}>+</button></div>
      <div style={{ background: "var(--inp)", borderRadius: 10, padding: 14, textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600 }}>{bn ? "মোট ফিতরা" : "TOTAL FITRANA"}</div><div className="mn" style={{ fontSize: 28, fontWeight: 800, color: "var(--ac)", marginTop: 2 }}>{fmt(fitraPpl * FITRA_RATE)}</div><div style={{ fontSize: 10, color: "var(--t3)", marginTop: 2 }}>{fitraPpl} × ৳{FITRA_RATE}</div></div></div>
  </div>);

  // Jariyah
  const VJariyah = () => (<div className="fi">
    <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>🤝 {bn ? "সদকা জারিয়া" : "Sadaqah Jariyah"}</h2>
    <p style={{ color: "var(--t3)", fontSize: 11, marginBottom: 14, lineHeight: 1.5 }}>{bn ? "কাউকে আয়ের উপায় দিন — চলমান সওয়াব অর্জন করুন" : "Give someone a means of earning — gain ongoing reward"}</p>
    {!selJariyah ? <div className="g2">{JARIYAH.map((j) => <div key={j.id} className="cd" style={{ padding: 14, cursor: "pointer", textAlign: "center" }} onClick={() => setSelJariyah(j)}><div style={{ fontSize: 28, marginBottom: 4 }}>{j.emoji}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{bn ? j.nameBn : j.name}</div><div className="mn" style={{ fontSize: 12, fontWeight: 700, color: "var(--ac)", marginTop: 2 }}>{fmt(j.cost)}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>~৳{j.income}/{bn ? "দিন" : "day"}</div></div>)}</div>
      : <div className="fi">
        <button onClick={() => setSelJariyah(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: "inherit" }}><IC.Left />{bn ? "সব দেখুন" : "All Plans"}</button>
        <div className="cd" style={{ textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 6 }}>{selJariyah.emoji}</div><h3 style={{ fontSize: 18, fontWeight: 800 }}>{bn ? selJariyah.nameBn : selJariyah.name}</h3><p style={{ fontSize: 12, color: "var(--t2)", marginTop: 4, lineHeight: 1.5 }}>{bn ? selJariyah.descBn : selJariyah.desc}</p></div>
        <div className="cd"><div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 10 }}>{bn ? "বিনিয়োগ প্ল্যান" : "INVESTMENT PLAN"}</div>
          {[{ l: bn ? "মোট খরচ" : "Total Cost", v: fmt(selJariyah.cost), b: 1 }, { l: bn ? "দৈনিক আয়" : "Daily Income", v: `~৳${selJariyah.income}` }, { l: bn ? "মাসিক আয়" : "Monthly Income", v: `~${fmt(selJariyah.income * 26)}` }, { l: bn ? "পরিশোধ সময়" : "Payback", v: `~${Math.ceil(selJariyah.cost / (selJariyah.income * 26))} ${bn ? "মাস" : "mo"}` }].map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i ? "1px solid var(--bd)" : "none", fontSize: 12, fontWeight: r.b ? 700 : 400 }}><span>{r.l}</span><span className="mn" style={{ fontWeight: 700, color: "var(--ac)" }}>{r.v}</span></div>)}</div>
        <div className="cd" style={{ background: "var(--acL)", border: "none" }}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>💡 {bn ? "কিভাবে কাজ করে" : "HOW IT WORKS"}</div><ol style={{ fontSize: 11, color: "var(--ac)", lineHeight: 1.8, paddingLeft: 16 }}><li>{bn ? "আপনি বিনিয়োগ করুন" : "You invest (Zakat/Sadaqah)"}</li><li>{bn ? "প্রাপক আয় শুরু করেন" : "Recipient starts earning"}</li><li>{bn ? "মাসিক কিস্তিতে পরিশোধ" : "Monthly installment payback"}</li><li>{bn ? "সম্পদ তাদের হয়ে যায়" : "Asset becomes theirs"}</li><li>{bn ? "আপনার চলমান সওয়াব" : "You earn ongoing reward"}</li></ol></div>
      </div>}
  </div>);

  // ═══════════ RENDER ═══════════
  return (<><style>{css}</style><div className="Z"><div className="W" ref={scrollRef} style={{ opacity: anim ? 1 : 0 }}>
    <div className="hd">
      <div className="lg">{!["home"].includes(view) && <button onClick={() => go("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", color: "var(--t1)" }}><IC.Left /></button>}<span className="dt" /> ZakatFlow</div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}><button onClick={toggleDark} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex", padding: 3 }}>{dark ? <IC.Sun /> : <IC.Moon />}</button><button className={`pl ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>EN</button><button className={`pl ${lang === "bn" ? "on" : ""}`} onClick={() => setLang("bn")}>বাং</button></div>
    </div>
    {view === "home" && <VHome />}
    {view === "calc" && <VCalc />}
    {view === "result" && <VResult />}
    {view === "monthly" && <VMonthly />}
    {view === "tracker" && <VTracker />}
    {view === "fitrana" && <VFitrana />}
    {view === "jariyah" && <VJariyah />}
  </div>
    <div className="nv">{[{ id: "home", l: bn ? "হোম" : "Home", i: <IC.Home /> }, { id: "calc", l: bn ? "হিসাব" : "Calc", i: <IC.Cash /> }, { id: "monthly", l: bn ? "মাসিক" : "Monthly", i: <IC.Cal /> }, { id: "tracker", l: bn ? "ট্র্যাক" : "Track", i: <IC.Bar /> }, { id: "jariyah", l: bn ? "জারিয়া" : "Jariyah", i: <IC.Heart /> }].map((n) => <button key={n.id} className={`ni ${view === n.id || (view === "result" && n.id === "calc") ? "on" : ""}`} onClick={() => { if (n.id === "calc") setStep(0); go(n.id); }}>{n.i}{n.l}</button>)}</div>
  </div></>);
}