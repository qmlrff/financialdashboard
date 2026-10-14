# Clean Neutral Zinc & Charcoal Dark Mode Theme

A systematic redesign of the application's dark mode visual language, migrating from cool blue-tinted slate tones to a clean, modern neutral zinc and charcoal palette (`#09090b` canvas, `#18181b` card surfaces, and `#27272a` hairline borders), while preserving high-contrast vibrant indigo highlights and emerald/rose status accents.

### User Review & Clarifications Confirmed

> [!IMPORTANT]
> - **Background Tone**: Neutral zinc and charcoal dark gray (pure, clean neutral tones without blue/purple bias).
> - **Accents & Highlights**: Vibrant indigo interactive elements and crisp emerald/rose/amber semantic status colors with enhanced contrast against charcoal surfaces.

---

### 1. Proposed Changes & Component Scope

#### A. Core Canvas & Global Shell (`src/App.tsx`)
- Migrate root dark background from `bg-slate-950 text-slate-100` to clean `bg-zinc-950 text-zinc-100`.
- Update modal sheets, quick preview cards, and banner callouts to `bg-zinc-900 border-zinc-800`.
- Adjust subtle borders and divider lines to `border-zinc-800`.
- Update search and filter indicators to clean zinc tones.

#### B. Header & Navigation (`src/components/Header.tsx`)
- Transition header sticky bar from `bg-slate-950/85 border-slate-800/80` to `bg-zinc-950/90 border-zinc-800/80`.
- Update search input container to `bg-zinc-900 border-zinc-700/80 text-zinc-100 placeholder-zinc-500`.
- Adjust theme toggle, sample button, and export icon hover surfaces to `hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100`.
- Keep active navigation indicator in vibrant indigo (`text-white border-indigo-400 font-semibold`).

#### C. Timeframe & Period Controls (`src/components/TimeframeBar.tsx`)
- Replace timeframe segmented pill background with neutral `bg-zinc-900 border-zinc-800`.
- Active segment button set to `bg-zinc-800 text-white shadow-xs`.
- Period navigation chevron buttons and custom date inputs styled in `bg-zinc-900 border-zinc-800 text-zinc-200`.

#### D. KPI Summary Cards (`src/components/SummaryCards.tsx`)
- Card surface background changed from `bg-slate-900/80 border-slate-800` to `bg-zinc-900/90 border-zinc-800/80`.
- Inner metrics and account balance cards updated to `bg-zinc-950/60 border-zinc-800/60`.
- Maintain crisp emerald (`text-emerald-400`), rose (`text-rose-400`), and indigo KPI indicators.

#### E. Budget Variance & Limits Panel (`src/components/BudgetVariancePanel.tsx`)
- Update progress bar background wells from `bg-slate-800` to `bg-zinc-800/80`.
- Card list items and limit adjustment inputs updated to `bg-zinc-900 border-zinc-800 text-zinc-100`.
- Status pills and deficit warnings retain high-contrast amber/rose badges.

#### F. Chart Studio (`src/components/ChartStudio.tsx`)
- Update Recharts grid stroke and tooltip containers from slate to zinc:
  - Chart grid lines: `#27272a` (zinc-800) instead of slate.
  - Tooltip card: `bg-zinc-900 border-zinc-800 text-zinc-100`.
  - Chart control toggles and type selectors: `bg-zinc-900 border-zinc-800`.

#### G. Financial Anomalies & Transaction Ledger (`src/components/FinancialAnomaliesView.tsx`, `src/components/TransactionLedger.tsx`)
- Ledger table header: `bg-zinc-900/90 border-zinc-800 text-zinc-400`.
- Table alternating rows and hover highlights: `hover:bg-zinc-900/60 border-zinc-800/60`.
- Pagination buttons, filter popovers, and search inputs: `bg-zinc-900 border-zinc-800 text-zinc-200`.
- File upload dropzone (`src/components/FileUploadZone.tsx`): `border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900`.

---

### 2. Design System Tokens (Dark Mode)

| Surface Role | Old Style (Slate) | New Clean Style (Zinc / Charcoal) |
| :--- | :--- | :--- |
| **Canvas Background** | `bg-slate-950` (`#020617`) | `bg-zinc-950` (`#09090b`) |
| **Card & Modal Surface** | `bg-slate-900` (`#0f172a`) | `bg-zinc-900` (`#18181b`) |
| **Inner Well / Inset Box** | `bg-slate-950/50` | `bg-zinc-950/60` |
| **Borders & Dividers** | `border-slate-800` (`#1e293b`)| `border-zinc-800` (`#27272a`) |
| **Muted / Secondary Text**| `text-slate-400` / `text-slate-500` | `text-zinc-400` / `text-zinc-500` |
| **Primary Text** | `text-slate-100` / `text-white` | `text-zinc-100` / `text-white` |
| **Interactive Hover** | `hover:bg-slate-800` | `hover:bg-zinc-800` |
| **Accent Action / Active**| `bg-indigo-600` / `border-indigo-500` | `bg-indigo-600` / `border-indigo-500` (Preserved) |

---

### 3. Verification Plan

- **Visual Theme Audit**:
  - Verify dark mode canvas displays deep neutral charcoal (`#09090b`) without blue haze.
  - Test all 5 dashboard views (Overview, Budget Variance, Charts, Anomalies, Ledger) in both dark and light mode.
  - Verify Recharts tooltip backgrounds and axis line colors blend seamlessly with zinc surfaces.
- **Accessibility & Contrast**:
  - Ensure all body text, financial metrics, and tabular numbers achieve WCAG AA contrast against zinc-900 surfaces.
  - Verify focus rings and active tab states remain sharply legible.
- **Lint & Compilation**:
  - Run `lint_applet` to confirm no TypeScript or JSX errors.
  - Run `compile_applet` to ensure production bundle builds cleanly.
