# VA Disability Compensation by County — Interactive Report

A self-contained, multi-page HTML dashboard styled after a professional Power BI report. It explores VA disability compensation recipients by U.S. county (SCD rating bands, age, and gender).

## How to open

**Easiest (recommended):** double-click `index.html`, or open this file in your browser:

```
/workspace/va-disability-report/index.html
```

Data is embedded in `data.js` (no local web server required). Chart.js loads from a CDN, so you need an internet connection for charts.

**Optional local server:**

```bash
cd /workspace/va-disability-report
python3 -m http.server 8080
```

Then visit `http://localhost:8080/`.

## Pages

1. **Dashboard** — logo, six navigation tiles, four KPI gauges + metric cards  
2. **National Overview** — U.S. totals, rating / age / gender charts  
3. **By State** — state ranking chart + table (click a row → State Profiles)  
4. **County Explorer** — filterable/sortable county table, KPIs, top-county chart  
5. **Rating Breakdown** — SCD rating bands nationally and by state  
6. **Age Demographics** — age band analysis  
7. **Gender Split** — male / female patterns  
8. **Top Counties** — highest totals, densest 100% ratings, highest female share  
9. **State Profiles** — pick a state for county table + KPIs + charts  
10. **Comparisons** — side-by-side two-state comparison  

Use the **bottom tab bar** for any page. Non-dashboard pages have a **circular back button** to return home. Homepage tiles jump to the main sections.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Report shell and all page layouts |
| `styles.css` | Power BI–inspired styling |
| `app.js` | Navigation, tables, Chart.js charts |
| `data.js` | Embedded cleaned county + aggregate data |
| `va_disability_by_county.csv` | Source CSV copy |

## Key national KPIs (from this dataset)

- **Total recipients:** 6,331,627  
- **Counties:** 3,148  
- **States / territories:** 55  
- **Male:** 5,490,962 (86.72%)  
- **Female:** 804,265 (12.70%)  
- **Age 65 or older:** 2,392,605 (37.79%)  
- **Rated 70% or higher:** 3,714,329 (58.66%)  
- **Rated 100%:** 1,845,855 (29.15%)  

Top states by recipients: Texas, Florida, California, North Carolina, Virginia.

## Data quality notes

- Numbers with commas in the CSV were parsed to integers.  
- **13 counties** have a total of 0 recipients.  
- Band sums (rating, age, or gender) do not always equal the county total — common with suppressed or unreported categories. Nationally, Male + Female is slightly below Total (~0.6% gap). Treat Total as the authoritative headcount; use band columns for composition.  
- Dataset includes states and territories (55 geographic entities).

## Style

White / light-grey background, primary blue `#1a4d8c`, green underline only on the active bottom tab, square bordered homepage buttons with icons, semicircular gauges with blue metric cards, detail pages with KPI cards + charts + dark-blue header tables.
