

## Mosaic Brand Intelligence — Marketing Mix Optimizer

### Data Layer
- Fetch all pages from `https://mosaicfellowship.in/api/data/marketing/daily` (paginated, 100/page) using React Query
- Fallback to realistic mock data (10 channels × 3 years) if API fails
- Skeleton loaders during fetch, error state with retry button

### Design System
- Pastel palette (teal, sage, yellow, lavender — no pink), `#F8F9FA` background, white cards with subtle shadows
- Inter font, Lucide icons, 12px border-radius cards
- Fully responsive down to 375px

### Layout
- Collapsible sidebar: "🎯 Mosaic MI" logo + 5 nav items (Overview, Channel Performance, Mix Optimizer, Trend Analysis, Scenario Planner)
- Smooth route transitions

### Page 1: Overview Dashboard
- 4 KPI cards: Total Spend, Revenue, ROAS (as "X.Xx"), New Customers
- Monthly revenue line chart (toggleable channels) + horizontal bar chart (spend by channel)
- **Channel Fatigue Detector**: Week-over-week ROAS analysis, warning cards with sparklines for channels declining 3+ consecutive weeks

### Page 2: Channel Performance
- Sortable table: Channel, Spend, Revenue, ROAS (color-coded green/yellow/red), Conversions, New Customers, CPA, 7-day sparkline
- **Diminishing Returns Simulator**: Multi-line chart showing estimated ROAS at 0.5x–3x spend levels per channel using power-law model

### Page 3: Mix Optimizer
- Budget input (default ₹50,00,000)
- **Left panel**: 10 channel sliders (0–60%) with ₹ amounts, projected revenue, running total validation
- **Right panel**: Live projected revenue/ROAS, current vs optimized bar chart
- **Budget Scenario Pills**: Conservative ₹30L / Current ₹50L / Aggressive ₹75L with comparison table
- **"What If" Channel Pauser**: Toggle per channel, auto-redistribute, impact card
- **Executive Summary Generator**: Modal with 5 formatted bullets + copy to clipboard
- **Revenue Opportunity Gap Card**: Shows ₹ left on table vs AI-recommended allocation

### Page 4: Trend Analysis
- Monthly line chart with metric toggle (ROAS / Revenue / Spend)
- "Best Month" badge per channel
- Year-over-year comparison toggle (2022/2023/2024)

### Page 5: Scenario Planner
- 30-day forward projection chart based on current allocation
- ±15% confidence band (shaded area)
- KPI card with total projected monthly revenue

### Global
- All currency in ₹ Indian number format (₹X,XX,XXX)
- Recharts for all charts
- All state in React memory (no localStorage)
- Mobile responsive throughout

