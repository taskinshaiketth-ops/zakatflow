import { useState, useEffect, useCallback, useRef } from "react";
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged } from "./firebase";

// ═══════════ CONFIG & CONSTANTS ═══════════
const BAJUS_FALLBACK = {
  "24K": { g: 24530 }, "22K": { g: 22485 }, "21K": { g: 21465 }, "18K": { g: 18400 }, "Sonaton": { g: 14985 }
};
const SILVER_FALLBACK = 185; // BDT per gram fallback
const BHORI_MULTIPLIER = 11.664;
const NISAB_GOLD_GRAMS = 87.48;
const NISAB_SILVER_GRAMS = 612.36;
const ZAKAT_RATE = 0.025;
// BD premium: international spot is ~60-65% of local BAJUS retail price (duties, VAT, making charges)
const BD_GOLD_PREMIUM = 1.51;
const BD_SILVER_PREMIUM = 1.40;
const TROY_OZ_TO_GRAM = 31.1035;
const HAWL_DAYS = 354; // Lunar year

// ═══════════ SUPPORT CONFIG (change to your numbers) ═══════════
const SUPPORT = {
  bkash: "01679276533",
  nagad: "01679276533",
  name: "ZakatFlow Team",
};

const formatCurrency = (n) => (!n || isNaN(n) ? "৳0" : "৳" + Math.round(n).toLocaleString("en-IN"));
const clampNumber = (v) => Math.max(0, parseFloat(v) || 0);
const LS = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

// ═══════════ QURAN & HADITH ═══════════
const AYAT = [
  { ar: "وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ", en: "And establish prayer and give Zakat.", bn: "নামায কায়েম করো এবং যাকাত দাও।", ref: "Al-Baqarah 2:43" },
  { ar: "خُذْ مِنْ أَمْوَالِهِمْ صَدَقَةً تُطَهِّرُهُمْ", en: "Take from their wealth a charity to purify them.", bn: "তাদের সম্পদ থেকে সদকা নাও যা তাদের পবিত্র করবে।", ref: "At-Tawbah 9:103" },
  { ar: "وَفِي أَمْوَالِهِمْ حَقٌّ لِّلسَّائِلِ وَالْمَحْرُومِ", en: "And in their wealth is a right for the needy.", bn: "তাদের সম্পদে অভাবী ও বঞ্চিতদের হক রয়েছে।", ref: "Adh-Dhariyat 51:19" },
  { ar: "", en: "Islam is built on five pillars... and paying Zakat.", bn: "ইসলাম পাঁচটি স্তম্ভের উপর প্রতিষ্ঠিত... এবং যাকাত প্রদান।", ref: "Sahih Bukhari 8" },
  { ar: "", en: "Whoever pays Zakat on his wealth, its evil is removed.", bn: "যে ব্যক্তি তার সম্পদের যাকাত দেয়, তার অনিষ্ট দূর হয়।", ref: "Tabarani, Hasan" },
  { ar: "", en: "Protect your wealth by paying Zakat.", bn: "যাকাত দিয়ে তোমাদের সম্পদ রক্ষা করো।", ref: "Abu Dawud 1577" },
];
const STEP_AYAT = {
  cash: { en: "\"Zakat purifies your wealth\" — Sunan Ibn Majah", bn: "\"যাকাত তোমার সম্পদকে পবিত্র করে\" — সুনানে ইবনে মাজাহ" },
  gold: { en: "\"Gold & silver not given Zakat will be heated in Hellfire\" — Muslim 987", bn: "\"স্বর্ণ ও রূপার যাকাত না দিলে জাহান্নামে তা গরম করা হবে\" — মুসলিম ৯৮৭" },
  inv: { en: "\"There is Zakat on every asset that grows\" — Scholars' consensus", bn: "\"প্রতিটি বর্ধনশীল সম্পদে যাকাত\" — আলেমদের ঐকমত্য" },
  biz: { en: "\"Give Zakat from what you earn from trade\" — Al-Baqarah 2:267", bn: "\"ব্যবসায়ের আয় থেকে যাকাত দাও\" — আল-বাকারাহ ২:২৬৭" },
  prop: { en: "\"Personal home is not zakatable\" — Hanafi Fiqh", bn: "\"ব্যক্তিগত বাসস্থান যাকাতযোগ্য নয়\" — হানাফী ফিকহ" },
  agri: { en: "\"On rain-watered: 1/10th; irrigated: 1/20th\" — Bukhari 1483", bn: "\"বৃষ্টির পানিতে: ১/১০ ভাগ; সেচে: ১/২০ ভাগ\" — বুখারী ১৪৮৩" },
  debt: { en: "\"No Zakat until debts are settled\" — Scholarly view", bn: "\"ঋণ বাদ দিয়ে যাকাত হিসাব\" — আলেমদের মত" }
};

// ═══════════ ICONS ═══════════
const IC = {
  Cash: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>,
  Gold: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2L2 19h20L12 2z"/></svg>,
  Inv: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Biz: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>,
  Prop: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Agri: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 22c4-4 8-7.5 8-12a8 8 0 10-16 0c0 4.5 4 8 8 12z"/></svg>,
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
  Users: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  Zap: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Eye: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  EyeOff: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>,
  Edit: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
};

// ═══════════ COMPONENTS ═══════════
const Tip = ({ t }) => { const [open, setOpen] = useState(false); return <span style={{ position: "relative", display: "inline-flex", marginLeft: 5 }}><span onClick={(e) => { e.stopPropagation(); setOpen(!open); }} style={{ cursor: "pointer", opacity: 0.35, display: "inline-flex" }}><IC.Info /></span>{open && <><div style={{ position: "fixed", inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} /><span style={{ position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-60%)", background: "var(--tip)", color: "var(--tipT)", padding: "9px 12px", borderRadius: 9, fontSize: 11, lineHeight: 1.5, width: 220, zIndex: 100, boxShadow: "0 6px 24px rgba(0,0,0,.2)" }}>{t}</span></>}</span>; };

const Inp = ({ label, value, onChange, tip, suffix, ph }) => <div style={{ marginBottom: 13 }}><label style={{ display: "flex", alignItems: "center", fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 4 }}>{label}{tip && <Tip t={tip} />}</label><div style={{ position: "relative" }}><input type="number" inputMode="decimal" value={value || ""} onChange={(e) => onChange(clampNumber(e.target.value))} placeholder={ph || "0"} style={{ width: "100%", padding: "12px 14px", paddingRight: suffix ? 48 : 14, border: "1.5px solid var(--bd)", borderRadius: 10, fontSize: 14, fontFamily: "'JetBrains Mono',monospace", background: "var(--inp)", color: "var(--t1)", outline: "none", transition: "all .2s", boxSizing: "border-box" }} onFocus={(e) => { e.target.style.borderColor = "var(--ac)"; e.target.style.boxShadow = "0 0 0 3px var(--acG)"; }} onBlur={(e) => { e.target.style.borderColor = "var(--bd)"; e.target.style.boxShadow = "none"; }} />{suffix && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: "var(--t3)", fontWeight: 700 }}>{suffix}</span>}</div></div>;

// ═══════════ STEPS ═══════════
const STEPS = [
  { id: "cash", t: "Cash & Savings", tb: "নগদ ও সঞ্চয়", ic: "Cash", c: "#10B981", f: [{ k: "cashH", l: "Cash in Hand", lb: "হাতে নগদ", t: "Physical cash." }, { k: "bank", l: "Bank Accounts", lb: "ব্যাংক", t: "All bank accounts." }, { k: "wallet", l: "bKash/Nagad/Rocket", lb: "মোবাইল ওয়ালেট", t: "Mobile wallets." }, { k: "lent", l: "Money Lent Out", lb: "ধার দেওয়া", t: "Recoverable loans." }, { k: "salDue", l: "Salary/Wages Due", lb: "বকেয়া বেতন", t: "Unpaid salary." }] },
  { id: "gold", t: "Gold & Silver", tb: "স্বর্ণ ও রূপা", ic: "Gold", c: "#D97706", isGold: true, sn: "Hanafi: All gold zakatable incl. worn jewelry. Shafi'i: Personal jewelry may be exempt.", snb: "হানাফী: গহনাসহ সব স্বর্ণে যাকাত। শাফিঈ: ব্যক্তিগত গহনা মুক্ত হতে পারে।" },
  { id: "inv", t: "Investments", tb: "বিনিয়োগ", ic: "Inv", c: "#8B5CF6", f: [{ k: "stk", l: "Stocks/Shares", lb: "শেয়ার", t: "DSE/CSE, mutual funds." }, { k: "fdr", l: "FDR/DPS", lb: "এফডিআর/ডিপিএস", t: "Fixed deposits." }, { k: "sanchay", l: "Sanchayapatra", lb: "সঞ্চয়পত্র", t: "Savings certificates." }, { k: "pf", l: "Provident Fund", lb: "প্রভিডেন্ট ফান্ড", t: "If withdrawable." }, { k: "somiti", l: "Cooperative/Somiti", lb: "সমিতি", t: "Cooperative savings." }, { k: "insurance", l: "Insurance Cash", lb: "বীমা", t: "Surrenderable value." }, { k: "otI", l: "Other (Crypto)", lb: "অন্যান্য", t: "Crypto, bonds." }] },
  { id: "biz", t: "Business & Trade", tb: "ব্যবসা", ic: "Biz", c: "#EC4899", f: [{ k: "bizC", l: "Business Cash", lb: "ব্যবসায়ের নগদ", t: "Business cash." }, { k: "invt", l: "Inventory", lb: "মজুদ পণ্য", t: "Goods for sale." }, { k: "rcv", l: "Receivables", lb: "পাওনা", t: "Money owed to you." }, { k: "bizVeh", l: "Business Vehicles", lb: "ব্যবসায়িক গাড়ি", t: "For income only." }, { k: "bizMach", l: "Machinery Income", lb: "যন্ত্রপাতি আয়", t: "Saved income." }] },
  { id: "prop", t: "Property & Land", tb: "সম্পত্তি", ic: "Prop", c: "#06B6D4", n: "Personal home NOT zakatable. Only investment property.", nb: "ব্যক্তিগত বাসস্থান যাকাতযোগ্য নয়।", f: [{ k: "invPlot", l: "Investment Land", lb: "বিনিয়োগের জমি", t: "Land for profit." }, { k: "invFlat", l: "Investment Flat", lb: "ফ্ল্যাট (বিনিয়োগ)", t: "NOT personal home." }, { k: "rentSaved", l: "Saved Rent", lb: "জমানো ভাড়া", t: "Accumulated rental." }, { k: "otProp", l: "Other Income", lb: "অন্যান্য", t: "Warehouse etc." }] },
  { id: "agri", t: "Agriculture", tb: "কৃষি", ic: "Agri", c: "#059669", n: "10% rain-fed, 5% irrigated — NOT 2.5%!", nb: "বৃষ্টি ১০%, সেচ ৫%!", f: [{ k: "agR", l: "Rain-fed (10%)", lb: "বৃষ্টিনির্ভর (১০%)", t: "10% Ushr." }, { k: "agI", l: "Irrigated (5%)", lb: "সেচনির্ভর (৫%)", t: "5% Half Ushr." }] },
  { id: "debt", t: "Debts", tb: "ঋণ", ic: "Debt", c: "#EF4444", n: "Only IMMEDIATE debts, not full loan.", nb: "শুধু এখনই বকেয়া।", f: [{ k: "pL", l: "Personal Loans", lb: "ব্যক্তিগত ঋণ", t: "Owed to people." }, { k: "bL", l: "Bank EMI Due", lb: "ব্যাংক EMI", t: "Current installment." }, { k: "cc", l: "Credit Card", lb: "ক্রেডিট কার্ড", t: "Outstanding." }, { k: "mehr", l: "Unpaid Mehr", lb: "মোহরানা", t: "Deductible." }, { k: "oD", l: "Other Due", lb: "অন্যান্য", t: "Rent, bills." }] }
];

const JARIYAH = [
  { n: "Auto-Rickshaw", nb: "অটো-রিকশা", cost: 350000, inc: 800, e: "🛺" },
  { n: "Sewing Machine", nb: "সেলাই মেশিন", cost: 25000, inc: 300, e: "🧵" },
  { n: "Electric Van", nb: "ই-ভ্যান", cost: 180000, inc: 600, e: "🔋" },
  { n: "Grocery Shop", nb: "মুদি দোকান", cost: 80000, inc: 500, e: "🏪" },
  { n: "Dairy Cow", nb: "দুধের গাভী", cost: 120000, inc: 400, e: "🐄" },
  { n: "Fish Farming", nb: "মাছ চাষ", cost: 60000, inc: 350, e: "🐟" }
];

const TRUSTED_ORGS = [
  { n: "As-Sunnah Foundation", desc: "Zakat Fund", bn: "আস-সুন্নাহ ফাউন্ডেশন", link: "https://assunnahfoundation.org/zakat" },
  { n: "Sajida Foundation", desc: "Healthcare & Poverty", bn: "সাজেদা ফাউন্ডেশন", link: "https://www.sajidafoundation.org/" },
  { n: "Anjuman Mufidul Islam", desc: "Orphanages & Burial", bn: "আঞ্জুমান মুফিদুল ইসলাম", link: "https://anjumanmufidul.org/" }
];

// ═══════════ MAIN APP ═══════════
export default function App() {
  const [view, setView] = useState("splash");
  const [user, setUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [lang, setLang] = useState("en");
  const [step, setStep] = useState(0);
  const [vals, setVals] = useState({});
  const [goldEntries, setGoldEntries] = useState([{ karat: "22K", amount: 0, unit: "bhori" }]);
  const [silverAmt, setSilverAmt] = useState(0);
  const [silverUnit, setSilverUnit] = useState("gram");
  const [nStd, setNStd] = useState("silver");
  const [profiles, setProfiles] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [showNewProfile, setShowNewProfile] = useState(false);
  const [quickAmount, setQuickAmount] = useState(0);
  const [quickName, setQuickName] = useState("");
  const [years, setYears] = useState([]);
  const [newPay, setNewPay] = useState({ amount: 0, note: "" });
  const [showPF, setShowPF] = useState(false);
  const [loginName, setLoginName] = useState("");
  const [loginMethod, setLoginMethod] = useState(null);
  const [fitraRate, setFitraRate] = useState(115);
  const [fitraN, setFitraN] = useState(1);
  const [selJ, setSelJ] = useState(null);
  const [anim, setAnim] = useState(true);
  const [goldRates, setGoldRates] = useState(BAJUS_FALLBACK);
  const [silverRate, setSilverRate] = useState(SILVER_FALLBACK);
  const [ratesDate, setRatesDate] = useState("BAJUS Fallback");
  const [ratesLoading, setRatesLoading] = useState(false);
  const [openGuide, setOpenGuide] = useState(null);
  const [calcName, setCalcName] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  // ── Riya Protection (hide amounts in public) ──
  const [riya, setRiya] = useState(false);
  // ── "May Allah Accept" toast ──
  const [showKabul, setShowKabul] = useState(false);
  const [kabulData, setKabulData] = useState({ amount: 0 });
  // ── Manual calc mode ──
  const [calcMode, setCalcMode] = useState(null); // null | "guided" | "manual"
  const [manAst, setManAst] = useState("");
  const [manLia, setManLia] = useState("");
  const [hawlDate, setHawlDate] = useState(new Date().toISOString().split("T")[0]);
  const [showEditRates, setShowEditRates] = useState(false);
  const [tempRates, setTempRates] = useState({ gold: 0, silver: 0 });
  // ── Year navigation + tracker sub-view ──
  const [trackerYear, setTrackerYear] = useState(new Date().getFullYear());
  const [trackerSubView, setTrackerSubView] = useState("tracker");
  const [isIos, setIsIos] = useState(false);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const scrollRef = useRef(null);
  const bn = lang === "bn";
  const dailyAyat = AYAT[Math.floor(Date.now() / 86400000) % AYAT.length];
  const displayMoney = (val) => riya ? "৳ * * * *" : formatCurrency(val);

  // ── Load data + Firebase auth listener + PWA install ──
  useEffect(() => {
    const d = LS.get("zf-dark"), p = LS.get("zf-profiles"), y = LS.get("zf-yrs"), g = LS.get("zf-gold"), r = LS.get("zf-rates"), fr = LS.get("zf-fitra"), ri = LS.get("zf-riya");
    if (d) setDark(d); if (p) setProfiles(p); if (y) setYears(y); if (g) setGoldEntries(g); if (fr) setFitraRate(fr); if (ri !== null) setRiya(ri);
    if (r && r.ts && Date.now() - r.ts < 6 * 3600000) {
      setGoldRates(r.goldRates); setSilverRate(r.silverRate); setRatesDate(r.date);
    } else { fetchLivePrices(); }

    // Firebase auth state listener
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const u = { name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User", email: firebaseUser.email, photo: firebaseUser.photoURL, uid: firebaseUser.uid };
        setUser(u); LS.set("zf-user", u); setView("home");
      } else {
        // Check for guest user in localStorage
        const guest = LS.get("zf-user");
        if (guest && guest.isGuest) { setUser(guest); setView("home"); }
        else { setTimeout(() => setView("login"), 1500); }
      }
    });

    // PWA install prompt capture + iOS detection
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    if (isStandalone) { setIsInstalled(true); } else if (isIosDevice) { setShowIosPrompt(true); }
    const handleInstall = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handleInstall);
    if (window.matchMedia("(display-mode: standalone)").matches) setIsInstalled(true);

    return () => { unsubscribe(); window.removeEventListener("beforeinstallprompt", handleInstall); };
  }, []);

  // ══════════════════════════════════════════
  // FIX #1: CORRECT API with proper conversion
  // ══════════════════════════════════════════
  const fetchLivePrices = async () => {
    setRatesLoading(true);
    try {
      // Step 1: Fetch gold & silver prices in USD per troy ounce
      const [goldRes, silverRes, fxRes] = await Promise.all([
        fetch("https://api.gold-api.com/price/XAU").then(r => r.json()),
        fetch("https://api.gold-api.com/price/XAG").then(r => r.json()),
        fetch("https://open.er-api.com/v6/latest/USD").then(r => r.json())
      ]);

      const goldUsdOz = goldRes?.price;
      const silverUsdOz = silverRes?.price;
      const bdtRate = fxRes?.rates?.BDT;

      if (goldUsdOz && bdtRate) {
        // Step 2: Convert to BDT per gram
        const gold24kPerGram = (goldUsdOz / TROY_OZ_TO_GRAM) * bdtRate;
        // Step 3: Apply BD premium (BAJUS ≈ 1.51x international spot)
        const gold24kBD = Math.round(gold24kPerGram * BD_GOLD_PREMIUM);

        const rates = {
          "24K": { g: gold24kBD },
          "22K": { g: Math.round(gold24kBD * 0.916) },
          "21K": { g: Math.round(gold24kBD * 0.875) },
          "18K": { g: Math.round(gold24kBD * 0.75) },
          "Sonaton": { g: Math.round(gold24kBD * 0.611) }
        };
        setGoldRates(rates);

        // Silver with BD premium
        let newSlvRate = SILVER_FALLBACK;
        if (silverUsdOz) {
          newSlvRate = Math.round((silverUsdOz / TROY_OZ_TO_GRAM) * bdtRate * BD_SILVER_PREMIUM);
          setSilverRate(newSlvRate);
        }

        const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        const label = "Live • " + dateStr;
        setRatesDate(label);
        LS.set("zf-rates", { goldRates: rates, silverRate: newSlvRate, date: label, ts: Date.now() });
      }
    } catch (err) {
      console.log("Price fetch failed, using BAJUS fallback:", err);
      setRatesDate("BAJUS Fallback (offline)");
    }
    setRatesLoading(false);
  };

  const go = (v) => { setAnim(false); setTimeout(() => { setView(v); setAnim(true); scrollRef.current?.scrollTo(0, 0); }, 100); };

  const getHawlInfo = (startStr) => {
    if (!startStr) return null;
    const start = new Date(startStr);
    const end = new Date(start.getTime() + HAWL_DAYS * 24 * 60 * 60 * 1000);
    const diff = Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
    if (diff <= 0) return { text: bn ? "হাওল পূর্ণ হয়েছে" : "Hawl Complete", due: true };
    return { text: bn ? `⏳ ${diff} দিন বাকি` : `⏳ ${diff} days left`, due: false, days: diff };
  };

  const handleSaveManualRates = () => {
    const gold24k = Math.round(tempRates.gold / 0.916);
    const rates = { "24K": { g: gold24k }, "22K": { g: tempRates.gold }, "21K": { g: Math.round(gold24k * 0.875) }, "18K": { g: Math.round(gold24k * 0.75) }, "Sonaton": { g: Math.round(gold24k * 0.611) } };
    setGoldRates(rates); setSilverRate(tempRates.silver); setRatesDate("Custom Entry");
    LS.set("zf-rates", { goldRates: rates, silverRate: tempRates.silver, date: "Custom Entry", ts: Date.now() });
    setShowEditRates(false);
  };
  const sv = (k, v) => setVals((p) => ({ ...p, [k]: v }));
  const tgDark = () => { const d = !dark; setDark(d); LS.set("zf-dark", d); };
  const tgRiya = () => { const r = !riya; setRiya(r); LS.set("zf-riya", r); };

  // ── Gold helpers ──
  const addGE = () => { const n = [...goldEntries, { karat: "22K", amount: 0, unit: "bhori" }]; setGoldEntries(n); LS.set("zf-gold", n); };
  const rmGE = (i) => { if (goldEntries.length <= 1) return; const n = goldEntries.filter((_, j) => j !== i); setGoldEntries(n); LS.set("zf-gold", n); };
  const upGE = (i, f, v) => { const n = [...goldEntries]; n[i] = { ...n[i], [f]: v }; setGoldEntries(n); LS.set("zf-gold", n); };
  const g2g = (e) => { const a = e.amount || 0; return e.unit === "gram" ? a : e.unit === "bhori" ? a * BHORI_MULTIPLIER : a * (BHORI_MULTIPLIER / 16); };
  const tGV = useCallback(() => goldEntries.reduce((s, e) => s + g2g(e) * (goldRates[e.karat]?.g || 0), 0), [goldEntries, goldRates]);
  const tSG = useCallback(() => silverUnit === "bhori" ? silverAmt * BHORI_MULTIPLIER : silverAmt, [silverAmt, silverUnit]);

  // ── Profiles ──
  const saveProfiles = (p) => { setProfiles(p); LS.set("zf-profiles", p); };
  const addPayToProfile = () => {
    if (!newPay.amount || !activeProfile) return;
    const pay = { id: Date.now(), amount: newPay.amount, note: newPay.note, date: new Date().toISOString() };
    const upd = profiles.map(p => p.id === activeProfile.id ? { ...p, payments: [pay, ...(p.payments || [])] } : p);
    saveProfiles(upd); setActiveProfile(upd.find(p => p.id === activeProfile.id)); setNewPay({ amount: 0, note: "" }); setShowPF(false);
    // "May Allah Accept" toast
    setKabulData({ amount: newPay.amount }); setShowKabul(true); setTimeout(() => setShowKabul(false), 2800);
  };
  const delPayFromProfile = (payId) => {
    const upd = profiles.map(p => p.id === activeProfile.id ? { ...p, payments: (p.payments || []).filter(x => x.id !== payId) } : p);
    saveProfiles(upd); setActiveProfile(upd.find(p => p.id === activeProfile.id));
  };
  const createQuickProfile = () => {
    if (!quickAmount || !quickName.trim()) return;
    const prof = { id: Date.now(), name: quickName.trim(), zakatDue: quickAmount, payments: [], date: new Date().toISOString(), hawlStart: hawlDate, year: new Date().getFullYear(), isQuick: true };
    const upd = [prof, ...profiles]; saveProfiles(upd); setActiveProfile(prof);
    setQuickAmount(0); setQuickName(""); setShowNewProfile(false); go("tracker");
  };

  // ── Calculate ──
  const calc = useCallback(() => {
    const v = vals, gV = tGV(), slV = tSG() * silverRate;
    const cash = (v.cashH || 0) + (v.bank || 0) + (v.wallet || 0) + (v.lent || 0) + (v.salDue || 0);
    const invest = (v.stk || 0) + (v.fdr || 0) + (v.sanchay || 0) + (v.pf || 0) + (v.somiti || 0) + (v.insurance || 0) + (v.otI || 0);
    const biz = (v.bizC || 0) + (v.invt || 0) + (v.rcv || 0) + (v.bizVeh || 0) + (v.bizMach || 0);
    const prop = (v.invPlot || 0) + (v.invFlat || 0) + (v.rentSaved || 0) + (v.otProp || 0);
    const tA = cash + gV + slV + invest + biz + prop;
    const tD = (v.pL || 0) + (v.bL || 0) + (v.cc || 0) + (v.mehr || 0) + (v.oD || 0);
    const net = tA - tD;
    const nisab = nStd === "gold" ? NISAB_GOLD_GRAMS * goldRates["22K"].g : NISAB_SILVER_GRAMS * silverRate;
    const el = net >= nisab, sZ = el ? net * ZAKAT_RATE : 0;
    const agZ = (v.agR || 0) * 0.10 + (v.agI || 0) * 0.05;
    return { cash, gV, slV, invest, biz, prop, tA, tD, net, nisab, el, sZ, agZ, total: sZ + agZ, goldEntries: [...goldEntries] };
  }, [vals, tGV, tSG, silverRate, nStd, goldEntries, goldRates]);

  const doCalc = () => {
    const r = calc(); const yr = new Date().getFullYear();
    const profName = calcName.trim() || ((bn ? "যাকাত " : "Zakat ") + yr);
    const prof = { id: Date.now(), name: profName, zakatDue: r.total, payments: [], date: new Date().toISOString(), hawlStart: hawlDate, year: yr, result: r };
    const updP = [prof, ...profiles]; saveProfiles(updP); setActiveProfile(prof);
    const rec = { ...r, year: yr, date: new Date().toISOString() };
    const updY = [...years.filter(y => y.year !== yr), rec].sort((a, b) => b.year - a.year);
    setYears(updY); LS.set("zf-yrs", updY);
    // Show install prompt after first calculation
    if (installPrompt && !isInstalled) setShowInstall(true);
    go("result");
  };

  // ── Manual Calc (enter totals directly) ──
  const doManualCalc = () => {
    const ast = clampNumber(manAst), lia = clampNumber(manLia), net = ast - lia;
    const nisab = nStd === "gold" ? NISAB_GOLD_GRAMS * goldRates["22K"].g : NISAB_SILVER_GRAMS * silverRate;
    const sZ = net >= nisab ? net * ZAKAT_RATE : 0;
    const yr = new Date().getFullYear();
    const profName = calcName.trim() || ((bn ? "ম্যানুয়াল " : "Manual ") + yr);
    const r = { tA: ast, tD: lia, net, nisab, el: net >= nisab, sZ, agZ: 0, total: sZ, isManual: true };
    const prof = { id: Date.now(), name: profName, zakatDue: r.total, payments: [], date: new Date().toISOString(), hawlStart: hawlDate, year: yr, result: r, isQuick: true };
    const updP = [prof, ...profiles]; saveProfiles(updP); setActiveProfile(prof);
    const rec = { ...r, year: yr, date: new Date().toISOString() };
    const updY = [...years.filter(y => y.year !== yr), rec].sort((a, b) => b.year - a.year);
    setYears(updY); LS.set("zf-yrs", updY);
    if (installPrompt && !isInstalled) setShowInstall(true);
    go("result");
  };

  // ── Auth ──
  const doGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged will handle the rest
    } catch (err) {
      console.log("Google login failed:", err);
      alert(bn ? "Google লগইন ব্যর্থ। আবার চেষ্টা করুন।" : "Google login failed. Try again.");
    }
    setAuthLoading(false);
  };
  const doGuestLogin = () => {
    if (!loginName.trim()) return;
    const u = { name: loginName.trim(), isGuest: true };
    setUser(u); LS.set("zf-user", u); go("home");
  };
  const doLogout = async () => {
    try { await signOut(auth); } catch {}
    setUser(null); localStorage.removeItem("zf-user"); go("login");
  };
  // PWA install trigger
  const triggerInstall = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const result = await installPrompt.userChoice;
      if (result.outcome === "accepted") setIsInstalled(true);
      setInstallPrompt(null);
    }
    setShowInstall(false);
  };

  // ── Computed ──
  const profPaid = activeProfile ? (activeProfile.payments || []).reduce((s, p) => s + p.amount, 0) : 0;
  const profRem = activeProfile ? Math.max(0, activeProfile.zakatDue - profPaid) : 0;
  const profProg = activeProfile && activeProfile.zakatDue > 0 ? Math.min(1, profPaid / activeProfile.zakatDue) : 0;
  const profMon = activeProfile && activeProfile.zakatDue > 0 ? activeProfile.zakatDue / 12 : 0;
  const MO = bn ? ["জানু", "ফেব", "মার্চ", "এপ্রি", "মে", "জুন", "জুলা", "আগ", "সেপ্ট", "অক্টো", "নভে", "ডিসে"] : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const moPd = (m) => (activeProfile?.payments || []).filter(p => new Date(p.date).getMonth() === m).reduce((s, p) => s + p.amount, 0);
  const profilesForYear = profiles.filter(p => (p.year || new Date(p.date).getFullYear()) === trackerYear);
  const availableYears = [...new Set(profiles.map(p => p.year || new Date(p.date).getFullYear()))].sort((a, b) => b - a);

  // ═══════════ CSS ═══════════
  const css = `@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Amiri:wght@400;700&display=swap');:root{--bg:${dark ? "#0C0C12" : "#F6F5F1"};--cd:${dark ? "#16161F" : "#FFF"};--t1:${dark ? "#EEEEF4" : "#111128"};--t2:${dark ? "#9898B0" : "#4A4A6A"};--t3:${dark ? "#5A5A70" : "#9090A8"};--bd:${dark ? "#252530" : "#E4E2DC"};--ac:#0B7A62;--acG:${dark ? "#0B7A6230" : "#0B7A6212"};--acL:${dark ? "#0B7A6218" : "#E4F4EE"};--inp:${dark ? "#111118" : "#EFEEEA"};--gold:#B8860B;--goldL:${dark ? "#B8860B15" : "#FDF5E0"};--danger:#D32F2F;--dangerL:${dark ? "#D32F2F15" : "#FDE8E8"};--ok:#0B8A50;--tip:${dark ? "#EEEEF4" : "#111128"};--tipT:${dark ? "#111128" : "#EEEEF4"};--sh:${dark ? "0 1px 6px rgba(0,0,0,.3)" : "0 1px 4px rgba(0,0,0,.04)"};--jar:#6D28D9;--jarL:${dark ? "#6D28D915" : "#F3E8FF"}}*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}body{background:var(--bg);font-family:'Outfit','Noto Sans Bengali',sans-serif}.Z{color:var(--t1);min-height:100vh;width:100%;margin:0 auto;position:relative;overflow-x:hidden}.W{position:relative;z-index:1;padding:0 16px 96px;min-height:100vh;transition:opacity .1s;max-width:600px;margin:0 auto}@media(min-width:600px){.W{max-width:680px;padding:0 28px 96px}}@media(min-width:900px){.W{max-width:760px;padding:0 36px 96px}}.hd{padding:14px 0 10px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg);z-index:50}.lg{font-size:16px;font-weight:800;letter-spacing:-.4px;display:flex;align-items:center;gap:6px}.dt{width:7px;height:7px;border-radius:50%;background:var(--ac);animation:pu 2s ease infinite}@keyframes pu{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}.cd{background:var(--cd);border-radius:14px;padding:18px;border:1px solid var(--bd);box-shadow:var(--sh);margin-bottom:12px}@media(min-width:600px){.cd{padding:22px;border-radius:16px}}.b{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:12px 20px;border-radius:11px;font-size:13px;font-weight:700;border:none;cursor:pointer;transition:all .15s;font-family:inherit}@media(min-width:600px){.b{padding:14px 24px;font-size:14px}}.bp{background:var(--ac);color:#fff;box-shadow:0 2px 10px rgba(11,122,98,.25)}.bp:active{transform:scale(.98)}.bo{background:transparent;color:var(--ac);border:1.5px solid var(--ac)}.bg{background:var(--acL);color:var(--ac);border:none}.bd{background:var(--dangerL);color:var(--danger);border:none;padding:7px 10px;font-size:11px;border-radius:7px}.bj{background:var(--jarL);color:var(--jar);border:none}.pl{padding:4px 10px;border-radius:14px;font-size:10px;font-weight:700;cursor:pointer;border:1.5px solid var(--bd);background:var(--cd);color:var(--t2);transition:all .15s}.pl.on{background:var(--ac);color:#fff;border-color:var(--ac)}.pr{width:100%;height:10px;background:var(--inp);border-radius:5px;overflow:hidden}.prf{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--ac),#10B981);transition:width .6s ease}.nv{position:fixed;bottom:0;left:0;right:0;background:var(--cd);border-top:1px solid var(--bd);padding:8px 12px;padding-bottom:max(8px,env(safe-area-inset-bottom));display:flex;justify-content:center;z-index:100}.nvI{display:flex;justify-content:space-around;width:100%;max-width:760px}.ni{display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 10px;border-radius:9px;cursor:pointer;color:var(--t3);font-size:9px;font-weight:600;border:none;background:none;font-family:inherit;transition:all .12s}@media(min-width:600px){.ni{padding:6px 14px;font-size:10px}}.ni.on{color:var(--ac);background:var(--acL)}.mn{font-family:'JetBrains Mono',monospace}.ar{font-family:'Amiri',serif}.fi{animation:fii .2s ease}@keyframes fii{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.tg{display:inline-flex;padding:3px 7px;border-radius:5px;font-size:9px;font-weight:700;letter-spacing:.4px;text-transform:uppercase}.sd{display:flex;gap:4px;justify-content:center;margin-bottom:16px}.sdi{height:3.5px;border-radius:2px;background:var(--bd);transition:all .3s;cursor:pointer;flex:1;max-width:36px}.sdi.on{background:var(--ac)}.sdi.dn{background:var(--ac);opacity:.3}.kg{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-bottom:10px}@media(min-width:500px){.kg{grid-template-columns:repeat(5,1fr)}}.ko{padding:7px 4px;border-radius:9px;border:1.5px solid var(--bd);cursor:pointer;text-align:center;transition:all .12s;background:var(--cd);font-size:10px}.ko.on{border-color:var(--gold);background:var(--goldL)}.g3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.g2{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}@media(min-width:500px){.g3{grid-template-columns:repeat(4,1fr)}.g2{grid-template-columns:repeat(3,1fr)}}@media(min-width:900px){.g3{grid-template-columns:repeat(6,1fr)}}.ge{border:1px solid var(--bd);border-radius:12px;padding:14px;margin-bottom:10px;background:var(--cd);position:relative}.ge:hover{border-color:var(--gold)}input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}input[type=number]{-moz-appearance:textfield}@keyframes splash{0%{opacity:0;transform:scale(.8)}50%{opacity:1;transform:scale(1.05)}100%{opacity:1;transform:scale(1)}}@keyframes loadbar{0%{left:-60%}100%{left:100%}}@keyframes kabulIn{from{opacity:0;transform:translateY(20px) scale(.9)}to{opacity:1;transform:translateY(0) scale(1)}}.kabul{animation:kabulIn .3s ease}.yr-nav{display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:14px}.yr-btn{width:28px;height:28px;border-radius:50%;border:1.5px solid var(--bd);background:var(--cd);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--t2);transition:all .12s}.yr-btn:hover{border-color:var(--ac);color:var(--ac)}.yr-btn:disabled{opacity:.3;cursor:default}`;

  // ═══════════ SPLASH ═══════════
  if (view === "splash") return <><style>{css}</style><div className="Z"><div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#0B7A62,#059669)", color: "#fff", textAlign: "center", padding: 32 }}><div style={{ animation: "splash .6s ease" }}><div style={{ fontSize: 32, marginBottom: 12 }}>☪</div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -1 }}>ZakatFlow</div>{dailyAyat.ar && <div className="ar" style={{ fontSize: 16, opacity: .8, marginTop: 8, direction: "rtl" }}>{dailyAyat.ar}</div>}<div style={{ fontSize: 12, opacity: .6, marginTop: 4 }}>{bn ? dailyAyat.bn : dailyAyat.en}</div><div style={{ fontSize: 10, opacity: .4, marginTop: 2 }}>— {dailyAyat.ref}</div><div style={{ margin: "24px auto 0", width: 40, height: 3, borderRadius: 2, background: "rgba(255,255,255,.3)", position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", height: "100%", width: "60%", background: "#fff", borderRadius: 2, animation: "loadbar 1.5s ease infinite" }} /></div></div></div></div></>;

  // ═══════════ LOGIN — Real Google Auth + Guest ═══════════
  if (view === "login") return <><style>{css}</style><div className="Z"><div style={{ minHeight: "100vh", padding: "60px 24px 40px", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 36 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16 }}><span className="dt" style={{ width: 10, height: 10 }} /><span style={{ fontSize: 22, fontWeight: 800 }}>ZakatFlow</span></div>
      <h1 style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.3 }}>{bn ? "বিসমিল্লাহ, শুরু করুন" : "Bismillah, Let's Begin"}</h1>
      <p style={{ color: "var(--t2)", fontSize: 13, marginTop: 8 }}>{bn ? dailyAyat.bn : dailyAyat.en}</p>
      <p style={{ color: "var(--t3)", fontSize: 10, marginTop: 2 }}>— {dailyAyat.ref}</p>
    </div>
    {/* Google Sign-In — Primary */}
    <button onClick={doGoogleLogin} disabled={authLoading} style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "1.5px solid var(--bd)", background: "var(--cd)", display: "flex", alignItems: "center", gap: 12, cursor: authLoading ? "wait" : "pointer", marginBottom: 10, fontFamily: "inherit", fontSize: 14, fontWeight: 600, color: "var(--t1)", opacity: authLoading ? 0.6 : 1 }}>
      <IC.Google />{authLoading ? (bn ? "সংযোগ হচ্ছে..." : "Connecting...") : (bn ? "Google দিয়ে শুরু করুন" : "Continue with Google")}
    </button>
    <div style={{ fontSize: 10, color: "var(--t3)", textAlign: "center", marginBottom: 10, lineHeight: 1.4 }}>{bn ? "✓ আপনার ডেটা সুরক্ষিত থাকবে • ✓ ডিভাইস পরিবর্তনেও ডেটা থাকবে" : "✓ Your data stays secure • ✓ Syncs across devices"}</div>
    {/* Divider */}
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0 14px" }}><div style={{ flex: 1, height: 1, background: "var(--bd)" }} /><span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{bn ? "অথবা" : "OR"}</span><div style={{ flex: 1, height: 1, background: "var(--bd)" }} /></div>
    {/* Guest Login */}
    {!loginMethod ? <button onClick={() => setLoginMethod("guest")} style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "1.5px solid var(--bd)", background: "var(--cd)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, color: "var(--t2)" }}><IC.Phone />{bn ? "নাম দিয়ে শুরু করুন (অতিথি)" : "Continue as Guest"}</button>
    : <div className="fi">
      <button onClick={() => setLoginMethod(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex", marginBottom: 12 }}><IC.Left /></button>
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--t2)", marginBottom: 5, display: "block" }}>{bn ? "আপনার নাম" : "Your Name"}</label>
        <input type="text" value={loginName} onChange={e => setLoginName(e.target.value)} placeholder={bn ? "নাম" : "Name"} style={{ width: "100%", padding: "14px 16px", border: "1.5px solid var(--bd)", borderRadius: 11, fontSize: 15, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} autoFocus onKeyDown={e => e.key === "Enter" && doGuestLogin()} />
      </div>
      <button className="b bp" style={{ width: "100%", padding: 15, fontSize: 15 }} onClick={doGuestLogin}>{bn ? "শুরু করুন" : "Get Started"} <IC.Right /></button>
      <p style={{ fontSize: 10, color: "var(--t3)", textAlign: "center", marginTop: 8 }}>{bn ? "⚠ অতিথি মোডে ডেটা শুধু এই ডিভাইসে থাকবে" : "⚠ Guest mode: data stays on this device only"}</p>
    </div>}
    <div style={{ flex: 1 }} />
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 24 }}>
      <button className={`pl ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>EN</button>
      <button className={`pl ${lang === "bn" ? "on" : ""}`} onClick={() => setLang("bn")}>বাং</button>
    </div>
  </div></div></>;

  // ═══════════ HEADER ═══════════
  const Hdr = () => <div className="hd"><div className="lg">{view !== "home" && <button onClick={() => go("home")} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", color: "var(--t1)" }}><IC.Left /></button>}<span className="dt" /> ZakatFlow</div><div style={{ display: "flex", gap: 5, alignItems: "center" }}><button onClick={tgRiya} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 3, color: riya ? "var(--ac)" : "var(--t3)", opacity: riya ? 1 : 0.5 }} title={riya ? "Show amounts" : "Hide amounts"}>{riya ? <IC.EyeOff /> : <IC.Eye />}</button><button onClick={tgDark} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex", padding: 3 }}>{dark ? <IC.Sun /> : <IC.Moon />}</button><button className={`pl ${lang === "en" ? "on" : ""}`} onClick={() => setLang("en")}>EN</button><button className={`pl ${lang === "bn" ? "on" : ""}`} onClick={() => setLang("bn")}>বাং</button></div></div>;

  // ═══════════ HOME ═══════════
  const VHome = () => <div className="fi">
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {user?.photo ? <img src={user.photo} alt="" style={{ width: 36, height: 36, borderRadius: 10, objectFit: "cover" }} referrerPolicy="no-referrer" /> : <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--acL)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, color: "var(--ac)" }}>{(user?.name || "U")[0]}</div>}
        <div><div style={{ fontSize: 13, color: "var(--t3)" }}>{bn ? "আস-সালামু আলাইকুম" : "Assalamu Alaikum"} 👋</div><div style={{ fontSize: 18, fontWeight: 800 }}>{user?.name}</div>{user?.isGuest && <div style={{ fontSize: 9, color: "var(--gold)" }}>Guest • {bn ? "Google দিয়ে লগইন করলে ডেটা সুরক্ষিত থাকবে" : "Sign in with Google for data safety"}</div>}</div>
      </div>
      <button onClick={doLogout} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t3)", display: "flex", padding: 4 }}><IC.Logout /></button>
    </div>
    {/* PWA Install Banner */}
    {!isInstalled && installPrompt && <div className="cd fi" style={{ background: "linear-gradient(135deg, #0B7A62, #059669)", color: "#fff", border: "none", cursor: "pointer", padding: 14 }} onClick={triggerInstall}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>📲</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{bn ? "ফোনে ইনস্টল করুন" : "Install on your phone"}</div><div style={{ fontSize: 10, opacity: .8 }}>{bn ? "ফ্রি • ১ সেকেন্ড • অফলাইনেও কাজ করে" : "Free • 1 second • Works offline"}</div></div>
        <div className="b" style={{ background: "#fff", color: "#0B7A62", padding: "8px 14px", fontSize: 12 }}>{bn ? "ইনস্টল" : "Install"}</div>
      </div>
    </div>}
    {/* iOS Install Banner */}
    {!isInstalled && isIos && showIosPrompt && <div className="cd fi" style={{ background: "linear-gradient(135deg, #0B7A62, #059669)", color: "#fff", border: "none", padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>🍎</span>
        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{bn ? "iPhone-এ ইনস্টল করুন" : "Install on iPhone"}</div><div style={{ fontSize: 10, opacity: .8 }}>{bn ? "Safari-তে Share আইকন ট্যাপ করে 'Add to Home Screen' নির্বাচন করুন" : "Tap Share icon → Add to Home Screen"}</div></div>
        <button className="b" style={{ background: "transparent", border: "1px solid #fff", color: "#fff", padding: "8px", fontSize: 12 }} onClick={() => setShowIosPrompt(false)}>✕</button>
      </div>
    </div>}
    <div style={{ background: "var(--acL)", borderRadius: 12, padding: "12px 16px", marginBottom: 12, textAlign: "center" }}>{dailyAyat.ar && <div className="ar" style={{ fontSize: 16, color: "var(--ac)", direction: "rtl", marginBottom: 4 }}>{dailyAyat.ar}</div>}<div style={{ fontSize: 11, color: "var(--ac)", lineHeight: 1.4 }}>{bn ? dailyAyat.bn : dailyAyat.en}</div><div style={{ fontSize: 9, color: "var(--t3)", marginTop: 2 }}>— {dailyAyat.ref}</div></div>
    {/* Nisab Card — LIVE rates with source */}
    <div className="cd" style={{ background: "linear-gradient(135deg,#0B7A62,#06805A)", color: "#fff", border: "none", position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: .8, opacity: .8, background: "rgba(255,255,255,0.15)", padding: "4px 8px", borderRadius: 6 }}>NISAB • {ratesDate}</span>
        <button onClick={() => { setTempRates({ gold: goldRates["22K"].g, silver: silverRate }); setShowEditRates(true); }} style={{ background: "none", border: "none", color: "#fff", opacity: 0.8, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600 }}><IC.Edit /> {bn ? "এডিট" : "Edit"}</button>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}><div><div style={{ fontSize: 11, opacity: .75 }}>{bn ? "স্বর্ণ ৭.৫ভরি" : "Gold 7.5 Bhori"}</div><div className="mn" style={{ fontSize: 17, fontWeight: 800 }}>{formatCurrency(NISAB_GOLD_GRAMS * goldRates["22K"].g)}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 11, opacity: .75 }}>{bn ? "রূপা ৫২.৫তোলা" : "Silver 52.5 Tola"}</div><div className="mn" style={{ fontSize: 17, fontWeight: 800 }}>{formatCurrency(NISAB_SILVER_GRAMS * silverRate)}</div></div></div>
      <div style={{ fontSize: 8.5, opacity: .8, marginTop: 8, textAlign: "center", background: "rgba(0,0,0,0.15)", padding: "4px", borderRadius: 4 }}>{bn ? "উৎস: gold-api.com (আন্তর্জাতিক স্পট) × open.er-api.com (BDT রেট) × BD প্রিমিয়াম" : "Source: gold-api.com (intl spot) × open.er-api.com (BDT rate) × BD retail premium"}</div>
    </div>
    {/* Custom Rates Modal */}
    {showEditRates && <div className="cd fi" style={{ border: "1.5px solid var(--ac)", marginBottom: 12 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{bn ? "ম্যানুয়াল রেট (প্রতি গ্রাম)" : "Manual Rates (per gram)"}</div><Inp label={bn ? "স্বর্ণ (২২ ক্যারেট)" : "Gold (22K)"} value={tempRates.gold} onChange={v => setTempRates(p => ({ ...p, gold: v }))} suffix="৳" /><Inp label={bn ? "রূপা" : "Silver"} value={tempRates.silver} onChange={v => setTempRates(p => ({ ...p, silver: v }))} suffix="৳" /><div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1 }} onClick={() => setShowEditRates(false)}>{bn ? "বাতিল" : "Cancel"}</button><button className="b bp" style={{ flex: 1 }} onClick={handleSaveManualRates}><IC.Check />{bn ? "সেভ" : "Save"}</button></div></div>}
    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
      <button className="b bp" style={{ width: "100%", padding: "15px 20px", fontSize: 14 }} onClick={() => { setStep(0); setCalcMode(null); setVals({}); setGoldEntries([{ karat: "22K", amount: 0, unit: "bhori" }]); setSilverAmt(0); setCalcName(""); setHawlDate(new Date().toISOString().split("T")[0]); go("calc"); }}>{bn ? "যাকাত হিসাব করুন" : "Calculate Zakat"} <IC.Right /></button>
      <button className="b bo" style={{ width: "100%", fontSize: 13 }} onClick={() => { setHawlDate(new Date().toISOString().split("T")[0]); setShowNewProfile(true); }}><IC.Zap /> {bn ? "দ্রুত ট্র্যাক (ম্যানুয়াল)" : "Quick Track (Manual Entry)"}</button>
      <div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1, fontSize: 12 }} onClick={() => go("tracker")}><IC.Bar />{bn ? "ট্র্যাকার" : "Tracker"}</button><button className="b bg" style={{ flex: 1, fontSize: 12 }} onClick={() => { go("guide"); setOpenGuide("fitrana"); }}><IC.Heart />{bn ? "ফিতরা" : "Fitrana"}</button></div>
    </div>
    {showNewProfile && <div className="cd fi" style={{ border: "1.5px solid var(--ac)", marginTop: 8 }}><div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{bn ? "দ্রুত ট্র্যাক" : "Quick Track"}</div><p style={{ fontSize: 11, color: "var(--t3)", marginBottom: 10 }}>{bn ? "হিসাব ছাড়াই সরাসরি ট্র্যাক করুন" : "Skip calculator — enter amount directly"}</p><div style={{ marginBottom: 10 }}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", marginBottom: 4, display: "block" }}>{bn ? "প্রোফাইলের নাম" : "Profile Name"}</label><input type="text" value={quickName} onChange={e => setQuickName(e.target.value)} placeholder={bn ? "যেমন: স্ত্রীর যাকাত" : "e.g. Wife's Zakat"} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div><Inp label={bn ? "যাকাতের পরিমাণ" : "Zakat Amount"} value={quickAmount} onChange={v => setQuickAmount(v)} suffix="৳" /><div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", marginBottom: 4, display: "block" }}>{bn ? "হাওল শুরুর তারিখ (ঐচ্ছিক)" : "Hawl Start Date (Optional)"}</label><input type="date" value={hawlDate} onChange={e => setHawlDate(e.target.value)} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div><div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1 }} onClick={() => setShowNewProfile(false)}>{bn ? "বাতিল" : "Cancel"}</button><button className="b bp" style={{ flex: 1 }} onClick={createQuickProfile}><IC.Check />{bn ? "ট্র্যাক শুরু" : "Start Tracking"}</button></div></div>}
    {profiles.length > 0 && <div style={{ marginTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)", letterSpacing: .7, display: "flex", alignItems: "center", gap: 4 }}><IC.Users /> {bn ? "প্রোফাইলসমূহ" : "PROFILES"}</div><span style={{ fontSize: 10, color: "var(--t3)" }}>{profiles.length}</span></div>{profiles.slice(0, 8).map(p => { const paid = (p.payments || []).reduce((s, x) => s + x.amount, 0); const pct = p.zakatDue > 0 ? Math.min(1, paid / p.zakatDue) : 0; const hawl = getHawlInfo(p.hawlStart); return <div key={p.id} className="cd" style={{ padding: 14, cursor: "pointer" }} onClick={() => { setActiveProfile(p); go("tracker"); }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}><div><div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 10, color: "var(--t3)", display: "flex", alignItems: "center", gap: 4 }}>{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{p.isQuick && " • Manual"}{hawl && <span style={{ background: hawl.due ? "var(--dangerL)" : "var(--acL)", color: hawl.due ? "var(--danger)" : "var(--ac)", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{hawl.text}</span>}</div></div><span className="tg" style={{ background: pct >= 1 ? "#E6F9F0" : "var(--goldL)", color: pct >= 1 ? "var(--ok)" : "var(--gold)" }}>{pct >= 1 ? "✓ DONE" : `${Math.round(pct * 100)}%`}</span></div><div className="pr" style={{ height: 6 }}><div className="prf" style={{ width: `${pct * 100}%`, height: 6 }} /></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--t3)", marginTop: 4 }}><span>{bn ? "প্রদেয়" : "Due"}: {displayMoney(p.zakatDue)}</span><span>{bn ? "বাকি" : "Left"}: {displayMoney(Math.max(0, p.zakatDue - paid))}</span></div></div>; })}</div>}
    {/* Support ZakatFlow */}
    <div style={{ marginTop: 16, textAlign: "center" }}>
      <div onClick={() => go("support")} style={{ cursor: "pointer", padding: "10px 16px", borderRadius: 10, background: "var(--inp)", display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>💚</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)" }}>{bn ? "ZakatFlow সাপোর্ট করুন" : "Support ZakatFlow"}</span>
      </div>
    </div>
    {/* Where to Pay — Suggestions */}
    <div style={{ marginTop: 20, borderTop: "1px solid var(--bd)", paddingTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}><span style={{ fontSize: 16 }}>🏛️</span><div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)" }}>{bn ? "কোথায় দেবেন? (নির্দেশিকা)" : "Where to Pay? (Suggestions)"}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{bn ? "নির্ভরযোগ্য কিছু প্রতিষ্ঠানের তালিকা — ZakatFlow এর সাথে সম্পর্কিত নয়" : "Trusted organizations — not affiliated with ZakatFlow"}</div></div></div>
      {TRUSTED_ORGS.map((org, i) => <div key={i} className="cd" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}><div><div style={{ fontSize: 12, fontWeight: 700 }}>{bn ? org.bn : org.n}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{org.desc}</div></div><button className="b bo" style={{ padding: "6px 12px", fontSize: 11 }} onClick={() => window.open(org.link, "_blank")}>{bn ? "দেখুন" : "Visit"}</button></div>)}
    </div>
    {/* Jariyah — CLEARLY SEPARATE */}
    <div style={{ marginTop: 20, borderTop: "2px dashed var(--bd)", paddingTop: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span style={{ fontSize: 16 }}>🤲</span><div><div style={{ fontSize: 12, fontWeight: 700, color: "var(--jar)" }}>{bn ? "সদকা জারিয়া (স্বেচ্ছা দান)" : "Sadaqah Jariyah (Voluntary)"}</div><div style={{ fontSize: 10, color: "var(--danger)", fontWeight: 600 }}>⚠ {bn ? "এটি যাকাত নয়!" : "This is NOT Zakat!"}</div></div></div><button className="b bj" style={{ width: "100%", fontSize: 12 }} onClick={() => go("jariyah")}>{bn ? "জারিয়া প্ল্যান দেখুন" : "View Jariyah Plans"}</button></div>
  </div>;

  // ═══════════ CALCULATOR (with mode selection) ═══════════
  const VCalc = () => {
    // Mode selection screen
    if (calcMode === null) return <div className="fi">
      <div className="cd" style={{ textAlign: "center", padding: "30px 16px" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>⚖️</div>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>{bn ? "কিভাবে হিসাব করতে চান?" : "How would you like to calculate?"}</h2>
        <p style={{ fontSize: 12, color: "var(--t2)", marginBottom: 20 }}>{bn ? "৭-ধাপের গাইড ব্যবহার করুন অথবা সরাসরি মোট সম্পদ লিখুন।" : "Use our 7-step guide or enter your totals directly."}</p>
        <button className="b bp" style={{ width: "100%", marginBottom: 12, padding: 16 }} onClick={() => setCalcMode("guided")}><IC.Cash /> {bn ? "গাইডেড জার্নি (৭-ধাপ)" : "Guided Journey (7 Steps)"}</button>
        <button className="b bg" style={{ width: "100%", padding: 16 }} onClick={() => setCalcMode("manual")}><IC.Zap /> {bn ? "সরাসরি মোট দিন" : "Enter Totals Directly"}</button>
      </div>
    </div>;

    // Manual entry mode
    if (calcMode === "manual") return <div className="fi">
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}><button onClick={() => setCalcMode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex" }}><IC.Left /></button><h2 style={{ fontSize: 18, fontWeight: 800 }}>{bn ? "ম্যানুয়াল এন্ট্রি" : "Manual Entry"}</h2></div>
      <div className="cd" style={{ padding: 14, marginBottom: 12, border: calcName.trim() ? "1.5px solid var(--ac)" : "1.5px solid var(--gold)" }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 5, display: "block" }}>{bn ? "কার যাকাত?" : "Whose Zakat?"}</label>
        <input type="text" value={calcName} onChange={e => setCalcName(e.target.value)} placeholder={bn ? "যেমন: আমার যাকাত" : "e.g. My Zakat"} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }} />
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 5, display: "block" }}>{bn ? "হাওল শুরুর তারিখ (ঐচ্ছিক)" : "Hawl Start Date (Optional)"}</label>
        <input type="date" value={hawlDate} onChange={e => setHawlDate(e.target.value)} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      </div>
      <div className="cd"><Inp label={bn ? "মোট যাকাতযোগ্য সম্পদ" : "Total Zakatable Assets"} value={manAst} onChange={setManAst} suffix="৳" /><Inp label={bn ? "ঋণ (শুধু বর্তমান)" : "Liabilities (Due now)"} value={manLia} onChange={setManLia} suffix="৳" /></div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>{[{ k: "silver", l: bn ? "রূপা" : "Silver", v: formatCurrency(NISAB_SILVER_GRAMS * silverRate) }, { k: "gold", l: bn ? "স্বর্ণ" : "Gold", v: formatCurrency(NISAB_GOLD_GRAMS * goldRates["22K"].g) }].map(n => <div key={n.k} onClick={() => setNStd(n.k)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1.5px solid ${nStd === n.k ? "var(--ac)" : "var(--bd)"}`, cursor: "pointer", textAlign: "center", background: nStd === n.k ? "var(--acL)" : "var(--cd)" }}><div style={{ fontSize: 12, fontWeight: 700 }}>{n.l} {bn ? "নিসাব" : "Nisab"}</div><div className="mn" style={{ fontSize: 10, color: "var(--t3)" }}>{n.v}</div></div>)}</div>
      <button className="b bp" style={{ width: "100%" }} onClick={doManualCalc}>{bn ? "হিসাব করুন" : "Calculate"} <IC.Check /></button>
    </div>;

    // Guided mode (original 7-step)
    const s = STEPS[step]; const SI = IC[s.ic]; const t = calc(); const sa = STEP_AYAT[s.id]; return <div className="fi">
    {/* Profile Name — always visible at top */}
    <div className="cd" style={{ padding: 14, marginBottom: 12, border: calcName.trim() ? "1.5px solid var(--ac)" : "1.5px solid var(--gold)" }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 5, display: "block" }}>{bn ? "কার যাকাত হিসাব করছেন?" : "Whose Zakat is this for?"}</label>
      <input type="text" value={calcName} onChange={e => setCalcName(e.target.value)} placeholder={bn ? "যেমন: আমার যাকাত, স্ত্রীর যাকাত, বাবার যাকাত" : "e.g. My Zakat, Wife's Zakat, Father's Zakat"} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
      {!calcName.trim() && <div style={{ fontSize: 10, color: "var(--gold)", marginTop: 4 }}>⚠ {bn ? "একটি নাম দিন — পরে ট্র্যাক করতে সুবিধা হবে" : "Give a name — helps track multiple profiles"}</div>}
      <div style={{ marginTop: 10 }}><label style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 5, display: "block" }}>{bn ? "হাওল শুরুর তারিখ (ঐচ্ছিক)" : "Hawl Start Date (Optional)"}</label><input type="date" value={hawlDate} onChange={e => setHawlDate(e.target.value)} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
    </div>
    <div className="sd">{STEPS.map((_, i) => <div key={i} className={`sdi ${i === step ? "on" : i < step ? "dn" : ""}`} onClick={() => setStep(i)} />)}</div>
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>{step === 0 && <button onClick={() => setCalcMode(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex", flexShrink: 0 }}><IC.Left /></button>}<div style={{ width: 38, height: 38, borderRadius: 10, background: s.c + "15", display: "flex", alignItems: "center", justifyContent: "center", color: s.c, flexShrink: 0 }}><SI /></div><div><div style={{ fontSize: 9, fontWeight: 700, color: "var(--t3)", letterSpacing: .7 }}>STEP {step + 1}/{STEPS.length}</div><div style={{ fontSize: 16, fontWeight: 800 }}>{bn ? s.tb : s.t}</div></div></div>
    {sa && <div style={{ padding: "6px 10px", borderRadius: 8, background: "var(--acL)", fontSize: 10, color: "var(--ac)", marginBottom: 10, lineHeight: 1.4, fontStyle: "italic" }}>{bn ? sa.bn : sa.en}</div>}
    {step === 0 && <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{[{ k: "silver", l: bn ? "রূপা" : "Silver", v: formatCurrency(NISAB_SILVER_GRAMS * silverRate) }, { k: "gold", l: bn ? "স্বর্ণ" : "Gold", v: formatCurrency(NISAB_GOLD_GRAMS * goldRates["22K"].g) }].map(n => <div key={n.k} onClick={() => setNStd(n.k)} style={{ flex: 1, padding: 10, borderRadius: 10, border: `1.5px solid ${nStd === n.k ? "var(--ac)" : "var(--bd)"}`, cursor: "pointer", textAlign: "center", background: nStd === n.k ? "var(--acL)" : "var(--cd)" }}><div style={{ fontSize: 12, fontWeight: 700 }}>{n.l}</div><div className="mn" style={{ fontSize: 10, color: "var(--t3)" }}>{n.v}</div></div>)}</div>}
    {s.n && <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--goldL)", fontSize: 11, color: "var(--gold)", marginBottom: 10, lineHeight: 1.4 }}>⚠ {bn ? s.nb : s.n}</div>}
    {s.sn && <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--acL)", fontSize: 10.5, color: "var(--ac)", marginBottom: 10, lineHeight: 1.4 }}>📖 {bn ? s.snb : s.sn}</div>}
    {s.isGold ? <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 8 }}>{bn ? "আপনার স্বর্ণ" : "YOUR GOLD"} — {bn ? "একাধিক ক্যারেট যোগ করুন" : "Add multiple karats"}</div>
      {goldEntries.map((entry, i) => <div key={i} className="ge">{goldEntries.length > 1 && <button onClick={() => rmGE(i)} style={{ position: "absolute", top: 8, right: 8, background: "var(--dangerL)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--danger)", fontSize: 10, fontWeight: 700, fontFamily: "inherit" }}>✕</button>}<div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>Entry {i + 1}</div><div className="kg">{Object.entries(goldRates).map(([k, v]) => <div key={k} className={`ko ${entry.karat === k ? "on" : ""}`} onClick={() => upGE(i, "karat", k)}><div style={{ fontWeight: 800, fontSize: 11 }}>{k === "Sonaton" ? (bn ? "সনাতন" : "Trad.") : k}</div><div style={{ fontSize: 9, color: "var(--t3)" }}>৳{v.g.toLocaleString()}</div></div>)}</div><div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center" }}><span style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)" }}>Unit:</span>{[{ k: "bhori", l: bn ? "ভরি" : "Bhori" }, { k: "gram", l: "Gram" }, { k: "ana", l: bn ? "আনা" : "Ana" }].map(u => <span key={u.k} className={`pl ${entry.unit === u.k ? "on" : ""}`} onClick={() => upGE(i, "unit", u.k)}>{u.l}</span>)}</div><Inp label={bn ? "পরিমাণ" : "Amount"} value={entry.amount} onChange={v => upGE(i, "amount", v)} suffix={entry.unit === "bhori" ? "ভরি" : entry.unit === "ana" ? "আনা" : "gm"} />{entry.amount > 0 && <div style={{ background: "var(--goldL)", borderRadius: 8, padding: "6px 12px", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--gold)" }}><span>{entry.amount} {entry.unit} × {entry.karat}</span><span className="mn" style={{ fontWeight: 800 }}>{formatCurrency(g2g(entry) * goldRates[entry.karat].g)}</span></div>}</div>)}
      <button className="b bg" style={{ width: "100%", marginBottom: 14 }} onClick={addGE}><IC.Plus /> {bn ? "আরো যোগ" : "Add More Gold"}</button>
      {tGV() > 0 && <div style={{ background: "var(--goldL)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--gold)", fontWeight: 600 }}>TOTAL GOLD</div><div className="mn" style={{ fontSize: 18, fontWeight: 800, color: "var(--gold)" }}>{formatCurrency(tGV())}</div></div>}
      <div style={{ borderTop: "1px solid var(--bd)", paddingTop: 14 }}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 8 }}>{bn ? "রূপা" : "SILVER"} <span style={{ fontWeight: 400, color: "var(--t3)" }}>(৳{silverRate}/gm)</span></div><div style={{ display: "flex", gap: 5, marginBottom: 8, alignItems: "center" }}><span style={{ fontSize: 10, fontWeight: 700, color: "var(--t3)" }}>Unit:</span>{[{ k: "gram", l: "Gram" }, { k: "bhori", l: "Bhori" }].map(u => <span key={u.k} className={`pl ${silverUnit === u.k ? "on" : ""}`} onClick={() => setSilverUnit(u.k)}>{u.l}</span>)}</div><Inp label={bn ? "রূপা" : "Silver"} value={silverAmt} onChange={v => setSilverAmt(v)} suffix={silverUnit === "bhori" ? "ভরি" : "gm"} tip="Nisab: 612.36g" /></div>
    </div> : <div className="cd">{s.f.map(fd => <Inp key={fd.k} label={bn ? fd.lb : fd.l} value={vals[fd.k]} onChange={v => sv(fd.k, v)} tip={fd.t} suffix="৳" />)}</div>}
    <div style={{ background: "var(--inp)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 11, color: "var(--t3)", fontWeight: 600 }}>{bn ? "নিট সম্পদ" : "Net Wealth"}</span><span className="mn" style={{ fontSize: 14, fontWeight: 800, color: t.net >= 0 ? "var(--ac)" : "var(--danger)" }}>{formatCurrency(t.net)}</span></div>
    <div style={{ display: "flex", gap: 8 }}>{step > 0 && <button className="b bg" onClick={() => setStep(step - 1)} style={{ flex: 1 }}><IC.Left />{bn ? "পিছনে" : "Back"}</button>}{step < STEPS.length - 1 ? <button className="b bp" onClick={() => setStep(step + 1)} style={{ flex: 2 }}>{bn ? "পরবর্তী" : "Next"} <IC.Right /></button> : <button className="b bp" onClick={doCalc} style={{ flex: 2, background: "linear-gradient(135deg,var(--ac),#059669)" }}>{bn ? "হিসাব" : "Calculate"} <IC.Check /></button>}</div>
  </div>; };

  // ═══════════ RESULT ═══════════
  const VRes = () => { if (!activeProfile) return null; const z = activeProfile.result || {}; const due = activeProfile.zakatDue; return <div className="fi" style={{ textAlign: "center" }}><div style={{ padding: "14px 0" }}><div style={{ width: 50, height: 50, borderRadius: 14, background: due > 0 ? "var(--acL)" : "var(--dangerL)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>{due > 0 ? <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg> : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>}</div><h2 style={{ fontSize: 16, fontWeight: 700 }}>{due > 0 ? (bn ? "যাকাত ফরজ" : "Zakat is Due") : (bn ? "ফরজ নয়" : "Not Due")}</h2></div>{due > 0 && <div style={{ marginBottom: 18 }}><div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600 }}>TOTAL ZAKAT</div><div className="mn" style={{ fontSize: 34, fontWeight: 800, color: "var(--ac)", letterSpacing: -2 }}>{displayMoney(due)}</div><div style={{ fontSize: 12, color: "var(--t3)", marginTop: 4 }}>≈ {displayMoney(due / 12)}/{bn ? "মাস" : "mo"} × 12</div>
        {/* Transparent Calculation */}
        <div style={{ background: "var(--acL)", padding: 12, borderRadius: 10, marginTop: 12, textAlign: "left" }}>
          <div style={{ fontSize: 11, color: "var(--ac)", fontWeight: 700, marginBottom: 8 }}>{bn ? "হিসাব পদ্ধতি" : "How It's Calculated"}</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{bn ? "নিট সম্পদ" : "Net Wealth"}</span><span className="mn">{displayMoney(z.net)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{bn ? "নিসাব" : "Nisab"}</span><span className="mn">{displayMoney(z.nisab)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{bn ? "স্ট্যাটাস" : "Status"}</span><span className="mn" style={{ color: "var(--ac)", fontWeight: 700 }}>{z.el ? (bn ? "নিসাব ছাড়িয়েছে ✓" : "Exceeds Nisab ✓") : (bn ? "নিসাবের নিচে" : "Below Nisab")}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{bn ? "যাকাত হার" : "Rate"}</span><span className="mn">× 2.5%</span></div>
          {z.agZ > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}><span>{bn ? "কৃষি যাকাত" : "Agri Zakat"}</span><span className="mn">+ {displayMoney(z.agZ)}</span></div>}
          <div style={{ height: 1, background: "var(--bd)", margin: "6px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, color: "var(--ac)" }}><span>{bn ? "মোট যাকাত" : "Total Zakat"}</span><span className="mn">{displayMoney(due)}</span></div>
        </div>
        {z.agZ > 0 && <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>(Std: {formatCurrency(z.sZ)} + Agri: {formatCurrency(z.agZ)})</div>}</div>}{z.tA && <div className="cd" style={{ textAlign: "left" }}><div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 10 }}>BREAKDOWN</div>{[{ l: bn ? "নগদ" : "Cash", v: displayMoney(z.cash) }, { l: bn ? "স্বর্ণ" : "Gold", v: displayMoney(z.gV), c: "var(--gold)" }, { l: bn ? "রূপা" : "Silver", v: displayMoney(z.slV), s: 1 }, { l: bn ? "বিনিয়োগ" : "Invest", v: displayMoney(z.invest) }, { l: bn ? "ব্যবসা" : "Business", v: displayMoney(z.biz) }, { l: bn ? "সম্পত্তি" : "Property", v: displayMoney(z.prop) }, { l: bn ? "মোট সম্পদ" : "Total", v: displayMoney(z.tA), b: 1 }, { l: bn ? "ঋণ" : "Debts", v: riya ? "৳ * * * *" : `-${formatCurrency(z.tD)}`, c: "var(--danger)" }, { l: bn ? "নিট" : "Net", v: displayMoney(z.net), b: 1, c: "var(--ac)" }, { l: bn ? "নিসাব" : "Nisab", v: displayMoney(z.nisab) }].map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: r.s ? "2px 0 2px 16px" : "6px 0", borderTop: i && !r.s ? "1px solid var(--bd)" : "none", fontSize: r.s ? 11 : 12, fontWeight: r.b ? 700 : 400 }}><span>{r.l}</span><span className="mn" style={{ fontWeight: 600, color: r.c }}>{r.v}</span></div>)}</div>}<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{due > 0 && <button className="b bp" style={{ width: "100%" }} onClick={() => go("tracker")}><IC.Bar />{bn ? "ট্র্যাক" : "Track Payments"}</button>}<div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1 }} onClick={() => { setStep(0); go("calc"); }}>{bn ? "পুনরায়" : "Redo"}</button><button className="b bo" style={{ flex: 1 }} onClick={() => { const t = `*ZakatFlow Summary*\n\nNet Wealth: ${formatCurrency(z.net || 0)}\nNisab: ${formatCurrency(z.nisab || 0)}\nStatus: ${due > 0 ? "Exceeds Nisab ✓" : "Below Nisab"}\n\n*Total Zakat Due: ${formatCurrency(due)}*\n(${formatCurrency(z.net || 0)} × 2.5% = ${formatCurrency(z.sZ || 0)})${z.agZ > 0 ? `\nAgri Zakat: +${formatCurrency(z.agZ)}` : ""}\n\nCalculated on zakatflow-blue.vercel.app`; if (navigator.share) navigator.share({ text: t }); else { navigator.clipboard?.writeText(t); alert("Summary Copied!"); } }}><IC.Share />{bn ? "শেয়ার" : "Share Summary"}</button></div></div>
    {/* Support Card — shows after result */}
    <div style={{ marginTop: 20, background: "linear-gradient(135deg, #F0FDF4, #ECFDF5)", borderRadius: 14, padding: 18, border: "1px solid #BBF7D0", textAlign: "center" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#166534", marginBottom: 6 }}>💚 {bn ? "ZakatFlow আপনার কাজে লাগলো?" : "Did ZakatFlow help you?"}</div>
      <div style={{ fontSize: 11, color: "#15803D", lineHeight: 1.5, marginBottom: 12 }}>{bn ? "এই অ্যাপটি সম্পূর্ণ বিনামূল্যে। একটি ছোট স্বেচ্ছা অনুদান আমাদের এটি চালু ও উন্নত রাখতে সাহায্য করবে। এটি আপনার সদকা জারিয়া হতে পারে — একটি ইসলামিক টুল যা হাজারো মানুষকে সাহায্য করছে।" : "This app is completely free. A small voluntary contribution helps us keep it running and improving. This can be your Sadaqah Jariyah — an Islamic tool helping thousands calculate their obligation correctly."}</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        <button className="b" style={{ background: "#E3106E", color: "#fff", fontSize: 12, padding: "10px 16px" }} onClick={() => { navigator.clipboard?.writeText(SUPPORT.bkash); alert(bn ? "bKash নম্বর কপি হয়েছে!" : "bKash number copied!"); }}>bKash: {SUPPORT.bkash}</button>
        <button className="b" style={{ background: "#F6921E", color: "#fff", fontSize: 12, padding: "10px 16px" }} onClick={() => { navigator.clipboard?.writeText(SUPPORT.nagad); alert(bn ? "Nagad নম্বর কপি হয়েছে!" : "Nagad number copied!"); }}>Nagad: {SUPPORT.nagad}</button>
      </div>
      <div style={{ fontSize: 9, color: "#16A34A", marginTop: 8, opacity: 0.6 }}>{bn ? "যেকোনো পরিমাণ • সম্পূর্ণ ঐচ্ছিক" : "Any amount • Completely voluntary"}</div>
    </div>
    {/* Install prompt after calculation */}
    {showInstall && !isInstalled && installPrompt && <div className="cd fi" style={{ border: "2px solid var(--ac)", textAlign: "center" }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>📲</div>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{bn ? "ZakatFlow ইনস্টল করুন!" : "Install ZakatFlow!"}</div>
      <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5, marginBottom: 12 }}>{bn ? "ফোনের হোম স্ক্রিনে যোগ করুন — অ্যাপ স্টোর লাগবে না, সম্পূর্ণ ফ্রি, অফলাইনেও কাজ করে।" : "Add to home screen — no app store needed, completely free, works offline."}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="b bg" style={{ flex: 1 }} onClick={() => setShowInstall(false)}>{bn ? "পরে" : "Later"}</button>
        <button className="b bp" style={{ flex: 1 }} onClick={triggerInstall}>{bn ? "ইনস্টল করুন" : "Install Now"}</button>
      </div>
    </div>}
  </div>; };

  // ═══════════ TRACKER (with year nav + monthly toggle) ═══════════
  const VTrk = () => {
    if (!activeProfile) return <div className="fi">
      {/* Year navigation */}
      <div className="yr-nav">
        <button className="yr-btn" disabled={!availableYears.includes(trackerYear - 1)} onClick={() => setTrackerYear(y => y - 1)}><IC.Left /></button>
        <div style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: 800 }}>{trackerYear}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{bn ? "যাকাত বছর" : "Zakat Year"}</div></div>
        <button className="yr-btn" disabled={trackerYear >= new Date().getFullYear()} onClick={() => setTrackerYear(y => y + 1)}><IC.Right /></button>
      </div>
      {profilesForYear.length > 0 ? profilesForYear.map(p => {
        const paid = (p.payments || []).reduce((s, x) => s + x.amount, 0);
        const pct = p.zakatDue > 0 ? Math.min(1, paid / p.zakatDue) : 0;
        const hawl = getHawlInfo(p.hawlStart);
        return <div key={p.id} className="cd" style={{ padding: 14, cursor: "pointer" }} onClick={() => { setActiveProfile(p); setTrackerSubView("tracker"); }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 10, color: "var(--t3)", display: "flex", alignItems: "center", gap: 4 }}>{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{p.isQuick && " • Manual"}{hawl && <span style={{ background: hawl.due ? "var(--dangerL)" : "var(--acL)", color: hawl.due ? "var(--danger)" : "var(--ac)", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{hawl.text}</span>}</div></div>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "4px 12px", borderRadius: 20, background: pct >= 1 ? "#E6F9F0" : "var(--goldL)", color: pct >= 1 ? "var(--ok)" : "var(--gold)" }}>{pct >= 1 ? (bn ? "✓ সম্পন্ন" : "✓ Done") : `${Math.round(pct * 100)}%`}</span>
          </div>
          <div className="pr" style={{ height: 6 }}><div className="prf" style={{ width: `${pct * 100}%`, height: 6 }} /></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--t3)", marginTop: 4 }}><span>{bn ? "প্রদেয়" : "Due"}: {displayMoney(p.zakatDue)}</span><span>{bn ? "বাকি" : "Left"}: {displayMoney(Math.max(0, p.zakatDue - paid))}</span></div>
        </div>;
      }) : <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--t3)" }}>
        <p style={{ marginBottom: 12 }}>{bn ? `${trackerYear} সালের কোনো প্রোফাইল নেই।` : `No profiles for ${trackerYear}.`}</p>
        <button className="b bp" onClick={() => go("home")}>{bn ? "হোম" : "Home"}</button>
      </div>}
    </div>;

    return <div className="fi">
      {/* Tracker / Monthly toggle */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>{[{ k: "tracker", l: bn ? "ট্র্যাকার" : "Tracker" }, { k: "monthly", l: bn ? "মাসিক প্ল্যান" : "Monthly" }].map(t => <button key={t.k} className={`pl ${trackerSubView === t.k ? "on" : ""}`} style={{ flex: 1, padding: "8px 12px", fontSize: 12, borderRadius: 9 }} onClick={() => setTrackerSubView(t.k)}>{t.l}</button>)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}><div><h2 style={{ fontSize: 16, fontWeight: 800 }}>{activeProfile.name}</h2><div style={{ fontSize: 10, color: "var(--t3)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>{activeProfile.isQuick ? "Manual" : "Calculated"} • {new Date(activeProfile.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{(() => { const h = getHawlInfo(activeProfile.hawlStart); return h ? <span style={{ background: h.due ? "var(--dangerL)" : "var(--acL)", color: h.due ? "var(--danger)" : "var(--ac)", padding: "2px 6px", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>{h.text}</span> : null; })()}</div></div><div style={{ display: "flex", gap: 6 }}><button className="b bg" style={{ fontSize: 10, padding: "7px 10px" }} onClick={() => { setActiveProfile(null); setTrackerSubView("tracker"); }}>{bn ? "পরিবর্তন" : "Switch"}</button><button className="b bd" style={{ fontSize: 10 }} onClick={() => { saveProfiles(profiles.filter(p => p.id !== activeProfile.id)); setActiveProfile(null); go("home"); }}><IC.Trash /> Del</button></div></div>

      {trackerSubView === "tracker" ? <>
        {/* Dashboard card */}
        <div className="cd" style={{ background: "linear-gradient(135deg, #0B7A62, #059669)", color: "#fff", border: "none", textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 9, opacity: .6, fontWeight: 700 }}>📅 {new Date(activeProfile.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</div>
            <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>{Math.round(profProg * 100)}% {bn ? "পরিশোধ" : "Paid"}</span>
          </div>
          <div style={{ fontSize: 10, opacity: .7, marginBottom: 2 }}>{bn ? "বাকি পরিমাণ" : "Remaining"}</div>
          <div className="mn" style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>{displayMoney(profRem)}</div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: 6, height: 8, marginBottom: 10 }}><div style={{ background: "#fff", borderRadius: 6, height: 8, width: `${profProg * 100}%`, transition: "width .6s ease" }} /></div>
          <div style={{ display: "flex", justifyContent: "space-around" }}>
            <div><div style={{ fontSize: 9, opacity: .65 }}>{bn ? "প্রদেয়" : "Due"}</div><div className="mn" style={{ fontSize: 14, fontWeight: 800 }}>{displayMoney(activeProfile.zakatDue)}</div></div>
            <div style={{ width: 1, background: "rgba(255,255,255,.3)" }} />
            <div><div style={{ fontSize: 9, opacity: .65 }}>{bn ? "পরিশোধিত" : "Paid"}</div><div className="mn" style={{ fontSize: 14, fontWeight: 800 }}>{displayMoney(profPaid)}</div></div>
          </div>
        </div>
        {!showPF ? <button className="b bp" style={{ width: "100%", marginBottom: 12 }} onClick={() => setShowPF(true)}><IC.Plus />{bn ? "পেমেন্ট যোগ" : "Add Payment"}</button> : <div className="cd fi" style={{ border: "1.5px solid var(--ac)" }}><Inp label={bn ? "পরিমাণ" : "Amount"} value={newPay.amount} onChange={v => setNewPay(p => ({ ...p, amount: v }))} suffix="৳" /><div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, fontWeight: 600, color: "var(--t2)", marginBottom: 4, display: "block" }}>{bn ? "নোট" : "Note"}</label><input type="text" value={newPay.note} onChange={e => setNewPay(p => ({ ...p, note: e.target.value }))} placeholder={bn ? "মসজিদ" : "e.g. Mosque"} style={{ width: "100%", padding: "11px 13px", border: "1.5px solid var(--bd)", borderRadius: 9, fontSize: 13, background: "var(--inp)", color: "var(--t1)", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div><div style={{ display: "flex", gap: 8 }}><button className="b bg" style={{ flex: 1 }} onClick={() => setShowPF(false)}>{bn ? "বাতিল" : "Cancel"}</button><button className="b bp" style={{ flex: 1 }} onClick={addPayToProfile}><IC.Check />{bn ? "সংরক্ষণ" : "Save"}</button></div></div>}
        {(activeProfile.payments || []).length > 0 && <div className="cd"><div style={{ fontSize: 11, fontWeight: 700, color: "var(--t2)", marginBottom: 6 }}>LOG ({(activeProfile.payments || []).length})</div>{(activeProfile.payments || []).map(p => <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--bd)" }}><div><div className="mn" style={{ fontSize: 13, fontWeight: 700 }}>{displayMoney(p.amount)}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{p.note && `${p.note} • `}{new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</div></div><button className="b bd" onClick={() => delPayFromProfile(p.id)}><IC.Trash /></button></div>)}</div>}
      </> : <>
        {/* Monthly plan sub-view */}
        <div className="cd" style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600 }}>MONTHLY TARGET</div><div className="mn" style={{ fontSize: 28, fontWeight: 800, color: "var(--ac)", marginTop: 2 }}>{displayMoney(profMon)}</div></div>
        <div className="g3">{MO.map((m, i) => { const pd = moPd(i), dn = pd >= profMon, pt = pd > 0; return <div key={i} className="cd" style={{ padding: 10, textAlign: "center", borderColor: dn ? "var(--ac)" : pt ? "var(--gold)" : "var(--bd)", background: dn ? "var(--acL)" : pt ? "var(--goldL)" : "var(--cd)" }}><div style={{ fontSize: 11, fontWeight: 700 }}>{m}</div><div className="mn" style={{ fontSize: 12, fontWeight: 700, color: dn ? "var(--ac)" : pt ? "var(--gold)" : "var(--t3)" }}>{displayMoney(pd)}</div></div>; })}</div>
        <button className="b bp" style={{ width: "100%", marginTop: 8 }} onClick={() => setTrackerSubView("tracker")}><IC.Plus />{bn ? "পেমেন্ট যোগ" : "Add Payment"}</button>
      </>}
    </div>;
  };

  // ═══════════ MONTHLY ═══════════
  const VMon = () => <div className="fi"><h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{bn ? "মাসিক প্ল্যান" : "Monthly Plan"}</h2>{!activeProfile || !activeProfile.zakatDue ? <div>
    <p style={{ color: "var(--t3)", fontSize: 11, marginBottom: 14 }}>{bn ? "একটি প্রোফাইল নির্বাচন করুন" : "Select a profile to view monthly plan"}</p>
    {profiles.filter(p => p.zakatDue > 0).length > 0 ? profiles.filter(p => p.zakatDue > 0).map(p => {
      const paid = (p.payments || []).reduce((s, x) => s + x.amount, 0);
      return <div key={p.id} className="cd" style={{ padding: 14, cursor: "pointer" }} onClick={() => setActiveProfile(p)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div><div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{bn ? "প্রদেয়" : "Due"}: {formatCurrency(p.zakatDue)} • {bn ? "মাসিক" : "Monthly"}: {formatCurrency(p.zakatDue / 12)}</div></div>
          <span style={{ fontSize: 11, color: "var(--ac)", fontWeight: 700 }}>→</span>
        </div>
      </div>;
    }) : <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--t3)" }}>
      <p style={{ marginBottom: 12 }}>{bn ? "কোনো প্রোফাইল নেই। প্রথমে হিসাব করুন।" : "No profiles yet. Calculate Zakat first."}</p>
      <button className="b bp" onClick={() => go("home")}>{bn ? "হোম" : "Home"}</button>
    </div>}
    {activeProfile && <button className="b bg" style={{ width: "100%", marginTop: 8 }} onClick={() => setActiveProfile(null)}>{bn ? "পরিবর্তন" : "Switch Profile"}</button>}
  </div> : <><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><span style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)" }}>{activeProfile.name}</span><button className="b bg" style={{ fontSize: 10, padding: "5px 10px" }} onClick={() => setActiveProfile(null)}>{bn ? "পরিবর্তন" : "Switch"}</button></div><div className="cd" style={{ textAlign: "center" }}><div style={{ fontSize: 10, color: "var(--t3)", fontWeight: 600 }}>MONTHLY TARGET</div><div className="mn" style={{ fontSize: 28, fontWeight: 800, color: "var(--ac)", marginTop: 2 }}>{formatCurrency(profMon)}</div></div><div className="g3">{MO.map((m, i) => { const pd = moPd(i), dn = pd >= profMon, pt = pd > 0; return <div key={i} className="cd" style={{ padding: 10, textAlign: "center", borderColor: dn ? "var(--ac)" : pt ? "var(--gold)" : "var(--bd)", background: dn ? "var(--acL)" : pt ? "var(--goldL)" : "var(--cd)" }}><div style={{ fontSize: 11, fontWeight: 700 }}>{m}</div><div className="mn" style={{ fontSize: 12, fontWeight: 700, color: dn ? "var(--ac)" : pt ? "var(--gold)" : "var(--t3)" }}>{formatCurrency(pd)}</div></div>; })}</div><button className="b bp" style={{ width: "100%", marginTop: 8 }} onClick={() => go("tracker")}><IC.Plus />{bn ? "পেমেন্ট" : "Add Payment"}</button></>}</div>;

  // ═══════════ FITRANA (adjustable rate) ═══════════
  const VFit = () => <div className="fi"><h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{bn ? "ফিতরা ক্যালকুলেটর" : "Fitrana Calculator"}</h2><div className="cd"><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}><button className="b bg" style={{ padding: "8px 14px" }} onClick={() => setFitraN(Math.max(1, fitraN - 1))}>−</button><span className="mn" style={{ fontSize: 26, fontWeight: 800, minWidth: 36, textAlign: "center" }}>{fitraN}</span><button className="b bg" style={{ padding: "8px 14px" }} onClick={() => setFitraN(fitraN + 1)}>+</button></div><div style={{ background: "var(--inp)", borderRadius: 10, padding: 14, textAlign: "center" }}><div className="mn" style={{ fontSize: 28, fontWeight: 800, color: "var(--ac)" }}>{formatCurrency(fitraN * fitraRate)}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>{fitraN} × ৳{fitraRate}</div></div><div style={{ marginTop: 14, borderTop: "1px solid var(--bd)", paddingTop: 10 }}><Inp label={bn ? "ফিতরা রেট (প্রতিজন)" : "Fitra Rate (per person)"} value={fitraRate} onChange={v => { setFitraRate(v); LS.set("zf-fitra", v); }} suffix="৳" tip={bn ? "ইসলামিক ফাউন্ডেশন বা স্থানীয় আলেমের নির্ধারিত হার অনুযায়ী পরিবর্তন করুন" : "Adjust as per Islamic Foundation or local scholar's rate"} /></div></div></div>;

  // ═══════════ JARIYAH (NOT ZAKAT) ═══════════
  const VJar = () => <div className="fi"><div style={{ background: "var(--dangerL)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: "var(--danger)" }}>⚠ {bn ? "গুরুত্বপূর্ণ" : "IMPORTANT"}</div><div style={{ fontSize: 11, color: "var(--danger)", marginTop: 2, lineHeight: 1.4 }}>{bn ? "সদকা জারিয়া যাকাত নয়। আলাদা স্বেচ্ছামূলক দান।" : "Sadaqah Jariyah is NOT Zakat. Separate voluntary charity."}</div></div><h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2, color: "var(--jar)" }}>🤲 {bn ? "সদকা জারিয়া" : "Sadaqah Jariyah"}</h2><p style={{ color: "var(--t3)", fontSize: 11, marginBottom: 14 }}>{bn ? "কাউকে আয়ের উপায় দিন" : "Give earning ability"}</p>{!selJ ? <div className="g2">{JARIYAH.map((j, i) => <div key={i} className="cd" style={{ padding: 14, cursor: "pointer", textAlign: "center" }} onClick={() => setSelJ(j)}><div style={{ fontSize: 28, marginBottom: 4 }}>{j.e}</div><div style={{ fontSize: 13, fontWeight: 700 }}>{bn ? j.nb : j.n}</div><div className="mn" style={{ fontSize: 12, fontWeight: 700, color: "var(--jar)", marginTop: 2 }}>{formatCurrency(j.cost)}</div><div style={{ fontSize: 10, color: "var(--t3)" }}>~৳{j.inc}/{bn ? "দিন" : "day"}</div></div>)}</div> : <div className="fi"><button onClick={() => setSelJ(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, marginBottom: 12, fontFamily: "inherit" }}><IC.Left />{bn ? "সব" : "All"}</button><div className="cd" style={{ textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 6 }}>{selJ.e}</div><h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--jar)" }}>{bn ? selJ.nb : selJ.n}</h3></div><div className="cd">{[{ l: bn ? "খরচ" : "Cost", v: formatCurrency(selJ.cost), b: 1 }, { l: bn ? "দৈনিক" : "Daily", v: `~৳${selJ.inc}` }, { l: bn ? "মাসিক" : "Monthly", v: `~${formatCurrency(selJ.inc * 26)}` }, { l: bn ? "পরিশোধ" : "Payback", v: `~${Math.ceil(selJ.cost / (selJ.inc * 26))} ${bn ? "মাস" : "mo"}` }].map((r, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderTop: i ? "1px solid var(--bd)" : "none", fontSize: 12, fontWeight: r.b ? 700 : 400 }}><span>{r.l}</span><span className="mn" style={{ fontWeight: 700, color: "var(--jar)" }}>{r.v}</span></div>)}</div></div>}</div>;

  // ═══════════ SUPPORT PAGE ═══════════
  const VSupport = () => <div className="fi">
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>💚</div>
      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>{bn ? "ZakatFlow সাপোর্ট করুন" : "Support ZakatFlow"}</h2>
      <p style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>{bn ? "এই অ্যাপটি সম্পূর্ণ বিনামূল্যে তৈরি এবং পরিচালিত হচ্ছে। আপনার একটি ছোট অনুদান এটিকে চালু, আপডেট এবং আরও উন্নত রাখতে সাহায্য করবে।" : "This app is built and maintained entirely for free. A small contribution helps keep it running, updated, and improving for everyone."}</p>
    </div>
    <div className="cd" style={{ background: "linear-gradient(135deg, #F0FDF4, #ECFDF5)", border: "1px solid #BBF7D0" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 10 }}>{bn ? "কেন সাপোর্ট করবেন?" : "Why support?"}</div>
      <div style={{ fontSize: 11, color: "#15803D", lineHeight: 1.7 }}>{bn ? "• সার্ভার ও ডোমেইন খরচ বহন\n• লাইভ স্বর্ণ/রূপার দাম আপডেট রাখা\n• নতুন ফিচার যোগ করা\n• বাগ ফিক্স ও রক্ষণাবেক্ষণ\n• এটি আপনার সদকা জারিয়া — একটি ইসলামিক টুল যা হাজারো মানুষকে সঠিকভাবে যাকাত হিসাব করতে সাহায্য করছে" : "• Server & domain costs\n• Keeping live gold/silver prices updated\n• Adding new features\n• Bug fixes & maintenance\n• This is your Sadaqah Jariyah — an Islamic tool helping thousands calculate Zakat correctly"}</div>
    </div>
    <div className="cd">
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", marginBottom: 12 }}>{bn ? "পাঠান যেকোনো পরিমাণ" : "Send any amount"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div onClick={() => { navigator.clipboard?.writeText(SUPPORT.bkash); alert(bn ? "bKash নম্বর কপি হয়েছে: " + SUPPORT.bkash : "bKash number copied: " + SUPPORT.bkash); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "#E3106E10", border: "1px solid #E3106E30", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#E3106E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>b</div>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: "#E3106E" }}>bKash</div><div className="mn" style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>{SUPPORT.bkash}</div></div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>{bn ? "ট্যাপ করে কপি" : "Tap to copy"}</div>
        </div>
        <div onClick={() => { navigator.clipboard?.writeText(SUPPORT.nagad); alert(bn ? "Nagad নম্বর কপি হয়েছে: " + SUPPORT.nagad : "Nagad number copied: " + SUPPORT.nagad); }} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "#F6921E10", border: "1px solid #F6921E30", cursor: "pointer" }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F6921E", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 800 }}>N</div>
          <div><div style={{ fontSize: 13, fontWeight: 700, color: "#F6921E" }}>Nagad</div><div className="mn" style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>{SUPPORT.nagad}</div></div>
          <div style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>{bn ? "ট্যাপ করে কপি" : "Tap to copy"}</div>
        </div>
      </div>
    </div>
    <div style={{ textAlign: "center", marginTop: 8 }}>
      <p style={{ fontSize: 10, color: "var(--t3)", lineHeight: 1.5 }}>{bn ? "সম্পূর্ণ ঐচ্ছিক • কোনো চাপ নেই • আল্লাহ আপনাকে উত্তম প্রতিদান দিন" : "Completely voluntary • No pressure • May Allah reward you abundantly"}</p>
    </div>
  </div>;

  // ═══════════ RENDER ═══════════
  // ═══ ZAKAT GUIDE (replaces Fitrana in nav) ═══
  const GUIDE = [
    { id: "what", icon: "📖", t: "What is Zakat?", tb: "যাকাত কী?", en: "Zakat is the third pillar of Islam — a mandatory annual charity of 2.5% on wealth above the Nisab threshold. It is not optional sadaqah; it is a right of the poor upon the wealthy. The word 'Zakat' means purification — it purifies your wealth and your soul.", bn: "যাকাত ইসলামের তৃতীয় স্তম্ভ — নিসাবের উপরে সম্পদের উপর বাধ্যতামূলক বার্ষিক ২.৫% দান। এটি ঐচ্ছিক সদকা নয়; এটি ধনীদের সম্পদে গরিবের হক। 'যাকাত' শব্দের অর্থ পবিত্রতা।", ref: "Surah At-Tawbah 9:103" },
    { id: "who", icon: "👤", t: "Who Must Pay?", tb: "কাকে দিতে হবে?", en: "You must pay Zakat if you are: (1) Muslim, (2) Adult (baligh), (3) Sane, (4) Free, (5) Your net wealth exceeds Nisab, (6) You have held this wealth for one full lunar year (hawl). Children's wealth: Hanafi scholars say no Zakat on minors' wealth. Shafi'i/Hanbali say guardians must pay.", bn: "যাকাত দিতে হবে যদি: (১) মুসলিম, (২) প্রাপ্তবয়স্ক, (৩) সুস্থ মস্তিষ্ক, (৪) স্বাধীন, (৫) নিট সম্পদ নিসাবের উপরে, (৬) এক চন্দ্র বছর (হাওল) ধরে সম্পদ। শিশুর সম্পদ: হানাফী মতে নাবালেগের সম্পদে যাকাত নেই।", ref: "Sahih Bukhari 1395" },
    { id: "nisab", icon: "⚖️", t: "Nisab Threshold", tb: "নিসাব — সীমা কত?", en: "Nisab is the minimum wealth before Zakat is due.\n\n• Gold: 7.5 Bhori (87.48g)\n• Silver: 52.5 Tola (612.36g)\n\nMost BD scholars recommend SILVER standard — it's lower, so more people pay, helping more poor. If net wealth (assets minus debts) exceeds either, Zakat is due.", bn: "নিসাব হলো ন্যূনতম সম্পদ যা থাকলে যাকাত ফরজ।\n\n• স্বর্ণ: ৭.৫ ভরি (৮৭.৪৮ গ্রাম)\n• রূপা: ৫২.৫ তোলা (৬১২.৩৬ গ্রাম)\n\nঅধিকাংশ আলেম রূপার মানদণ্ড ব্যবহারের পরামর্শ দেন কারণ এটি কম — বেশি মানুষ যাকাত দেবেন।", ref: "Sahih Muslim 979" },
    { id: "assets", icon: "💰", t: "What is Zakatable?", tb: "কোন সম্পদে যাকাত?", en: "ZAKATABLE: Cash, bank savings, bKash/Nagad, gold & silver (all forms), stocks, FDR/DPS, sanchayapatra, provident fund (if withdrawable), business inventory, receivables, investment property, crypto.\n\nNOT ZAKATABLE: Personal home, personal car, furniture, clothes, tools of trade.\n\nItems BD people miss: Sanchayapatra, DPS, bKash balance, somiti savings, unpaid salary.", bn: "যাকাতযোগ্য: নগদ, ব্যাংক, বিকাশ/নগদ, স্বর্ণ-রূপা, শেয়ার, এফডিআর/ডিপিএস, সঞ্চয়পত্র, প্রভিডেন্ট ফান্ড, ব্যবসার মজুদ, পাওনা, বিনিয়োগ সম্পত্তি, ক্রিপ্টো।\n\nযাকাতযোগ্য নয়: বাসস্থান, ব্যক্তিগত গাড়ি, আসবাবপত্র।\n\nযা মিস করেন: সঞ্চয়পত্র, ডিপিএস, বিকাশ ব্যালেন্স, সমিতি, বকেয়া বেতন।", ref: "Al-Baqarah 2:267" },
    { id: "howmuch", icon: "🔢", t: "How Much to Pay?", tb: "কত দিতে হবে?", en: "Standard: 2.5% of net zakatable wealth.\n\nAgriculture is DIFFERENT:\n• Rain-fed crops: 10% (Ushr)\n• Irrigated crops: 5% (Half Ushr)\n• NOT 2.5%!\n\nExample: Net wealth ৳10,00,000 → Zakat = ৳25,000.", bn: "সাধারণ: নিট সম্পদের ২.৫%।\n\nকৃষি আলাদা:\n• বৃষ্টিনির্ভর: ১০% (উশর)\n• সেচনির্ভর: ৫%\n• ২.৫% নয়!\n\nউদাহরণ: নিট সম্পদ ৳১০,০০,০০০ → যাকাত = ৳২৫,০০০।", ref: "Bukhari 1483" },
    { id: "when", icon: "📅", t: "When to Pay?", tb: "কখন দিতে হবে?", en: "After one lunar year (Hawl) from when your wealth first exceeded Nisab. Many calculate in Ramadan for extra reward. You can pay in advance or monthly installments. Don't delay once due.", bn: "সম্পদ নিসাব ছাড়ানোর এক চন্দ্র বছর পর ফরজ। অনেকে রমজানে হিসাব করেন। অগ্রিম বা মাসিক কিস্তিতে দেওয়া যায়। ফরজ হলে বিলম্ব করবেন না।", ref: "Abu Dawud 1577" },
    { id: "receivers", icon: "🤲", t: "Who Can Receive?", tb: "কারা যাকাত পাবে?", en: "Quran specifies 8 categories (At-Tawbah 9:60):\n\n1. Faqir — The poor\n2. Miskin — The needy\n3. Amil — Zakat collectors\n4. Mu'allaf — New Muslims\n5. Riqab — Freeing captives\n6. Gharimin — Those in debt\n7. Fi Sabilillah — In Allah's cause\n8. Ibn Sabil — Stranded travelers\n\nCANNOT give to: Parents, grandparents, children, spouse, non-Muslims (majority view).", bn: "কুরআনে ৮টি শ্রেণি (আত-তাওবাহ ৯:৬০):\n\n১. ফকির — দরিদ্র\n২. মিসকিন — অভাবী\n৩. আমিল — যাকাত সংগ্রহকারী\n৪. মুআল্লাফ — নওমুসলিম\n৫. রিকাব — দাসমুক্তি\n৬. গারিমিন — ঋণগ্রস্ত\n৭. ফী সাবিলিল্লাহ — আল্লাহর পথে\n৮. ইবনুস সাবিল — পথিক\n\nযাদের দেওয়া যাবে না: পিতা-মাতা, সন্তান, স্বামী/স্ত্রী।", ref: "At-Tawbah 9:60" },
    { id: "gold_rules", icon: "🪙", t: "Gold & Jewelry Rules", tb: "স্বর্ণ ও গহনার নিয়ম", en: "Hanafi (majority in BD): ALL gold is zakatable — including daily-wear jewelry. This is the safer position.\n\nShafi'i: Personal jewelry in regular use may be exempt.\n\nIf total gold exceeds 7.5 Bhori (even across multiple pieces/karats), Zakat is due on full market value at current rates.", bn: "হানাফী (বাংলাদেশে সংখ্যাগরিষ্ঠ): সমস্ত স্বর্ণে যাকাত — প্রতিদিন পরা গহনা সহ।\n\nশাফিঈ: ব্যক্তিগত গহনা মুক্ত হতে পারে।\n\nমোট স্বর্ণ ৭.৫ ভরি ছাড়ালে পুরো বাজার মূল্যে যাকাত।", ref: "Muslim 987" },
    { id: "mistakes", icon: "⚠️", t: "Common Mistakes", tb: "সাধারণ ভুল", en: "1. Forgetting bKash/Nagad balance\n2. Not counting sanchayapatra & DPS\n3. Deducting FULL loan instead of current EMI\n4. Thinking jewelry is exempt (Hanafi: it's not)\n5. Using 2.5% on crops (should be 5-10%)\n6. Giving Zakat to parents/children\n7. Mixing Zakat with Sadaqah Jariyah\n8. Not paying because 'no cash' (sell if needed)\n9. Not counting wife's gold separately\n10. Delaying year after year", bn: "১. বিকাশ/নগদ ব্যালেন্স ভুলে যাওয়া\n২. সঞ্চয়পত্র/ডিপিএস না গোণা\n৩. পুরো ঋণ বাদ দেওয়া (শুধু EMI বাদ দিন)\n৪. গহনায় যাকাত নেই ভাবা (হানাফী: আছে)\n৫. কৃষিতে ২.৫% (৫-১০% হওয়া উচিত)\n৬. পিতা-মাতা/সন্তানকে দেওয়া\n৭. যাকাত ও জারিয়া মেশানো\n৮. 'নগদ নেই' বলে না দেওয়া\n৯. স্ত্রীর স্বর্ণ আলাদা না গোণা\n১০. বছরের পর বছর বিলম্ব", ref: "Scholarly consensus" },
    { id: "fitrana", icon: "🌙", t: "Fitrana (Zakat al-Fitr)", tb: "ফিতরা (যাকাতুল ফিতর)", en: "Fitrana is SEPARATE from Zakat — due before Eid al-Fitr prayer. Every Muslim pays for themselves and dependents. Amount set by Islamic Foundation BD (usually ~৳115/person). Must reach the poor BEFORE Eid prayer. Not deductible from Zakat.", bn: "ফিতরা যাকাত থেকে আলাদা — ঈদুল ফিতরের নামাযের আগে দিতে হয়। প্রত্যেক মুসলিম নিজের ও নির্ভরশীলদের জন্য দেন। ইসলামিক ফাউন্ডেশন হার নির্ধারণ করে (~৳১১৫/জন)। ঈদের আগেই গরিবের কাছে পৌঁছাতে হবে।", ref: "Bukhari 1503" },
  ];

  const renderGuide = () => <div className="fi">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
      <div><h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{bn ? "যাকাত গাইড" : "Zakat Guide"}</h2><p style={{ color: "var(--t3)", fontSize: 11 }}>{bn ? "সম্পূর্ণ যাকাত নির্দেশিকা" : "Complete Zakat guide for Bangladeshi Muslims"}</p></div>
      <button className="b bo" style={{ fontSize: 10, padding: "7px 12px" }} onClick={() => window.open(`https://www.youtube.com/results?search_query=${bn ? "যাকাতের+নিয়ম+বাংলা" : "how+to+calculate+zakat+bangladesh"}`, "_blank")}>▶ {bn ? "ভিডিও" : "Video"}</button>
    </div>
    {GUIDE.map((sec) => {
      const isOpen = openGuide === sec.id;
      return <div key={sec.id} className="cd" style={{ padding: 0, overflow: "hidden", marginBottom: 8, cursor: "pointer" }} onClick={() => setOpenGuide(isOpen ? null : sec.id)}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>{sec.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{bn ? sec.tb : sec.t}</span>
          </div>
          <span style={{ fontSize: 12, color: "var(--t3)" }}>{isOpen ? "▲" : "▼"}</span>
        </div>
        {isOpen && <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--bd)" }}>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--t2)", marginTop: 12, whiteSpace: "pre-line" }}>{bn ? sec.bn : sec.en}</div>
          <div style={{ marginTop: 8, fontSize: 10, color: "var(--ac)", fontStyle: "italic" }}>📖 {sec.ref}</div>
        </div>}
      </div>;
    })}
    {/* Fitrana calculator inside Guide */}
    <div style={{ marginTop: 12, borderTop: "2px dashed var(--bd)", paddingTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🌙 {bn ? "ফিতরা ক্যালকুলেটর" : "Fitrana Calculator"}</h3>
      <div className="cd">
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button className="b bg" style={{ padding: "8px 14px" }} onClick={(e) => { e.stopPropagation(); setFitraN(Math.max(1, fitraN - 1)); }}>−</button>
          <span className="mn" style={{ fontSize: 26, fontWeight: 800, minWidth: 36, textAlign: "center" }}>{fitraN}</span>
          <button className="b bg" style={{ padding: "8px 14px" }} onClick={(e) => { e.stopPropagation(); setFitraN(fitraN + 1); }}>+</button>
        </div>
        <div style={{ background: "var(--inp)", borderRadius: 10, padding: 14, textAlign: "center" }}>
          <div className="mn" style={{ fontSize: 28, fontWeight: 800, color: "var(--ac)" }}>{formatCurrency(fitraN * fitraRate)}</div>
          <div style={{ fontSize: 10, color: "var(--t3)" }}>{fitraN} × ৳{fitraRate}</div>
        </div>
        <div style={{ marginTop: 10 }}>
          <Inp label={bn ? "ফিতরা রেট (প্রতিজন)" : "Fitra Rate/person"} value={fitraRate} onChange={v => { setFitraRate(v); LS.set("zf-fitra", v); }} suffix="৳" tip={bn ? "ইসলামিক ফাউন্ডেশনের হার অনুযায়ী" : "Per Islamic Foundation rate"} />
        </div>
      </div>
    </div>
  </div>;

  // ═══ RENDER — calling functions with (), NOT <Component /> to prevent remount ═══
  return <><style>{css}</style><div className="Z">
    {/* "May Allah Accept" Kabul Toast */}
    {showKabul && <div className="kabul" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ background: "#0B7A62", color: "#fff", padding: "24px 32px", borderRadius: 20, textAlign: "center", maxWidth: 260, boxShadow: "0 8px 40px rgba(0,0,0,0.35)" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>💚</div>
        <div className="mn" style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{formatCurrency(kabulData.amount)}</div>
        <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{bn ? "পেমেন্ট রেকর্ড হয়েছে।" : "Payment recorded."}</div>
        <div style={{ fontSize: 12, opacity: .85, marginTop: 4 }}>{bn ? "আল্লাহ কবুল করুন।" : "May Allah accept."}</div>
      </div>
    </div>}
    <div className="W" ref={scrollRef} style={{ opacity: anim ? 1 : 0 }}>
    {Hdr()}
    {view === "home" && VHome()}
    {view === "calc" && VCalc()}
    {view === "result" && VRes()}
    {view === "tracker" && VTrk()}
    {view === "fitrana" && VFit()}
    {view === "support" && VSupport()}
    {view === "guide" && renderGuide()}
    {view === "jariyah" && VJar()}
  </div><div className="nv"><div className="nvI">{[{ id: "home", l: bn ? "হোম" : "Home", i: <IC.Home /> }, { id: "calc", l: bn ? "হিসাব" : "Calc", i: <IC.Cash /> }, { id: "tracker", l: bn ? "ট্র্যাক" : "Track", i: <IC.Bar /> }, { id: "guide", l: bn ? "গাইড" : "Guide", i: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg> }].map(n => <button key={n.id} className={`ni ${view === n.id || (view === "result" && n.id === "calc") ? "on" : ""}`} onClick={() => { if (n.id === "calc") { setStep(0); setCalcMode(null); } go(n.id); }}>{n.i}{n.l}</button>)}</div></div></div></>;
}