# SmartSpend — Personal Finance Tracker 💰

A modern, mobile-first personal finance and budget tracking app built for India. Track your income, expenses, and multiple wallets all in one place.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + TypeScript + Vite |
| **Styling** | Tailwind CSS + Custom Design System |
| **Animations** | Framer Motion |
| **State Management** | Zustand |
| **Backend / Database** | Supabase (PostgreSQL + Auth + Storage) |
| **Icons** | Lucide React |
| **Charts** | Recharts |
| **PWA** | Vite PWA Plugin |

---

## ✨ Features

### Core
- **Multi-Wallet Support** — Bank, Cash, Credit Card, and E-Wallet accounts
- **Wallet Transfers** — Move money between accounts without affecting expense analytics
- **Income & Expense Tracking** — Log transactions with categories, notes, and wallet association
- **Budget Management** — Set monthly spending limits per category with real-time progress
- **Recurring Subscriptions** — Track fixed monthly bills like Netflix, Rent, and Spotify

### Analytics & Insights
- **Reports Dashboard** — 6-month trend charts, category breakdowns, MoM comparisons
- **#Hashtag Analytics** — Tag notes with `#GoaTrip` or `#Amazon` for custom spending reports
- **Savings Goals** — Set financial goals with progress tracking and manual contributions

### UX & Polish
- **Receipt Photo Uploads** — Attach images to transactions via Supabase Storage
- **Advanced Search & Filters** — Search by name, month, or amount range (`>5000`, `<500`, `Dec`)
- **CSV Export** — Download all transactions as a spreadsheet
- **Illustrated Empty States** — Friendly onboarding cues throughout the app
- **India-first** — ₹ currency, Indian number formatting, local conventions
- **Splash Screen + Onboarding** — Premium first-time experience
- **PWA Ready** — Installable on Android / iOS home screen

---

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd budget-buddy-main
npm install
```

### 2. Configure Environment

Create a `.env.local` file in the root of the project:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Run Locally

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🗄️ Database Schema

The app uses the following Supabase tables (all protected with Row-Level Security):

| Table | Purpose |
|---|---|
| `profiles` | User profile data |
| `wallets` | User wallets (Bank, Cash, Credit, E-Wallet) |
| `categories` | Transaction categories with icons and colors |
| `transactions` | All financial entries (income, expense, transfer) |
| `budgets` | Monthly spending limits per category |
| `subscriptions` | Recurring expense tracking |
| `goals` | Savings goals with progress |

> **Storage Bucket:** `receipts` — for transaction photo attachments.

---

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── WalletList.tsx
│   ├── QuickAddSheet.tsx
│   ├── TransactionCard.tsx
│   ├── SubscriptionsList.tsx
│   ├── GoalsList.tsx
│   └── ...
├── pages/            # Route-level page components
│   ├── Dashboard.tsx
│   ├── Transactions.tsx
│   ├── Budgets.tsx
│   ├── Reports.tsx
│   └── Profile.tsx
├── store/            # Zustand global state
│   ├── useDataStore.ts
│   └── useAuthStore.ts
└── lib/
    └── supabase.ts   # Supabase client
```

---

## 📄 License

This project is for educational and personal use.
