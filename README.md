# ☪ ZakatFlow — Free Zakat Calculator & Tracker

A production-ready, mobile-first Zakat web app built for Bangladesh.  
**Completely free** to deploy and host.

---

## 🚀 Deploy in 5 Steps (All Free)

### Step 1: Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Repository name: `zakatflow`
3. Select **Public** (free hosting requires public repo on free Vercel plan)
4. Click **Create repository**

### Step 2: Open in GitHub Codespace

1. On your new repo page, click the green **Code** button
2. Click the **Codespaces** tab
3. Click **Create codespace on main**
4. Wait ~30 seconds for it to load (you get 60 free hours/month)

### Step 3: Upload All Project Files

In the Codespace terminal, run these commands:

```bash
# You're already in the repo directory
# Upload/paste all the project files from the zakatflow folder
# OR clone from this structure:

# Install dependencies
npm install

# Test locally
npm run dev
```

**Your file structure should be:**
```
zakatflow/
├── public/
│   ├── manifest.json
│   ├── sw.js
│   ├── favicon.svg
│   ├── icon-192.png
│   └── icon-512.png
├── src/
│   ├── App.jsx
│   └── main.jsx
├── index.html
├── package.json
├── vite.config.js
└── README.md
```

### Step 4: Push to GitHub

```bash
git add .
git commit -m "ZakatFlow v3 — initial release"
git push
```

### Step 5: Deploy to Vercel (Free)

1. Go to [vercel.com](https://vercel.com) → Sign up with your GitHub account (free)
2. Click **Add New → Project**
3. Find and select your `zakatflow` repository
4. Framework Preset: **Vite** (auto-detected)
5. Click **Deploy**
6. Wait ~60 seconds
7. ✅ **Your app is now live!** at `zakatflow.vercel.app`

Every time you push to GitHub, Vercel auto-deploys the update.

---

## 💰 Total Cost: ৳0 (FREE)

| Service | Cost | What You Get |
|---------|------|-------------|
| GitHub | FREE | Code hosting, version control |
| Codespace | FREE | 60 hours/month cloud IDE |
| Vercel | FREE | Hosting, SSL, CDN, 100GB bandwidth |
| Domain | FREE | yourapp.vercel.app (or buy custom ~$12/yr) |

---

## 📱 How Users Install It

Since this is a PWA (Progressive Web App), users don't need an app store:

**Android:** Visit your URL → Chrome shows "Add to Home Screen" banner → Tap it  
**iPhone:** Visit your URL → Tap Share → "Add to Home Screen"  
**Desktop:** Visit your URL → Click install icon in address bar

---

## ✨ Features

- 💎 **Karat-based gold** — 24K, 22K, 21K, 18K, Traditional (Sonaton)
- ⚖️ **BD units** — Bhori, Gram, Ana
- 📊 **Monthly installment planner** — divide Zakat across 12 months
- 📅 **Yearly tracking** — year-over-year history
- 🤝 **Sadaqah Jariyah planner** — auto-rickshaw, sewing machine, etc.
- 🌾 **Agricultural Zakat** — correct 5%/10% rates
- 📖 **Scholarly notes** — Hanafi vs Shafi'i positions
- 🌙 **Dark mode** + 🇧🇩 **Bilingual** (EN/বাং)
- 🔒 **Privacy-first** — all data stays in browser localStorage
- 📲 **PWA** — installable on any phone

---

## 🔄 Updating Gold Prices

When BAJUS announces new rates, update the `GOLD_RATES` object in `src/App.jsx`:

```javascript
const GOLD_RATES = {
  "24K": { perGram: 24530 },  // ← Update these numbers
  "22K": { perGram: 22485 },
  "21K": { perGram: 21465 },
  "18K": { perGram: 18400 },
  Sonaton: { perGram: 14985 },
};
```

Push to GitHub → Vercel auto-deploys in ~30 seconds.

---

## 🔐 Adding Real Google/Phone Login (Optional)

The current app uses a simple name-based login stored in localStorage.  
To add real Google/Phone auth:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Google + Phone sign-in methods
3. `npm install firebase`
4. Replace the login logic in App.jsx with Firebase Auth calls

This is optional — the app works perfectly without it.

---

## 📄 License

MIT — Free to use, modify, and distribute.
