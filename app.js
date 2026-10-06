/* VA Disability Compensation Report */
(function () {
  "use strict";

  const D = VA_DATA;
  const BLUE = "#1a4d8c";
  const BLUE_LIGHT = "#6b9bd1";
  const GREEN = "#22c55e";
  const COLORS = [BLUE, "#2a6bb5", "#4a8fd4", "#7ab0e0", "#a8ccec", "#2e8b57", "#c45c26"];

  const PAGES = [
    { id: "dashboard", label: "Dashboard", icon: "home" },
    { id: "national", label: "National Overview", icon: null },
    { id: "bystate", label: "By State", icon: null },
    { id: "counties", label: "County Explorer", icon: null },
    { id: "ratings", label: "Rating Breakdown", icon: null },
    { id: "ages", label: "Age Demographics", icon: null },
    { id: "gender", label: "Gender Split", icon: null },
    { id: "top", label: "Top Counties", icon: null },
    { id: "profiles", label: "State Profiles", icon: null },
    { id: "compare", label: "Comparisons", icon: null },
  ];

  const chartRegistry = {};
  let sortState = { key: "total", dir: -1 };
  let countyFilter = { state: "", q: "" };
  let profileState = "";
  let compareA = "Texas", compareB = "Florida";

  function fmt(n) {
    if (n == null || isNaN(n)) return "—";
    return Math.round(n).toLocaleString("en-US");
  }
  function fmtPct(n, digits) {
    if (n == null || isNaN(n)) return "—";
    return (n * 100).toFixed(digits == null ? 2 : digits) + "%";
  }
  function pct(part, whole) {
    if (!whole) return 0;
    return part / whole;
  }
  function destroyChart(id) {
    if (chartRegistry[id]) {
      chartRegistry[id].destroy();
      delete chartRegistry[id];
    }
  }
  function makeChart(id, cfg) {
    destroyChart(id);
    const el = document.getElementById(id);
    if (!el) return null;
    chartRegistry[id] = new Chart(el, cfg);
    return chartRegistry[id];
  }

  // —— Navigation ——
  function showPage(id) {
    document.querySelectorAll(".page").forEach((p) => p.classList.toggle("active", p.id === "page-" + id));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.page === id));
    renderPage(id);
    const pageEl = document.getElementById("page-" + id);
    if (pageEl) pageEl.scrollTop = 0;
  }
  window.navigateTo = showPage;

  function renderPage(id) {
    switch (id) {
      case "dashboard": renderDashboard(); break;
      case "national": renderNational(); break;
      case "bystate": renderByState(); break;
      case "counties": renderCounties(); break;
      case "ratings": renderRatings(); break;
      case "ages": renderAges(); break;
      case "gender": renderGender(); break;
      case "top": renderTop(); break;
      case "profiles": renderProfiles(); break;
      case "compare": renderCompare(); break;
    }
  }

  // —— SVG Gauge ——
  // Semicircle gauge: track + value share the same center/radius.
  // Value arc span is always ≤ 180°, so large-arc-flag must stay 0
  // (using 1 when pct > 0.5 drew the major arc and threw the stroke off the track).
  function gaugeSVG(pctVal) {
    const p = Math.max(0, Math.min(1, pctVal));
    const r = 70, cx = 80, cy = 78;
    const start = Math.PI; // left endpoint
    const end = 0;         // right endpoint
    const angle = start + (end - start) * p; // sweep left→right along upper semicircle
    function pt(a) {
      // Math angles with y flipped to SVG coords: same path for track and value
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    }
    const [sx, sy] = pt(start);
    const [ex, ey] = pt(end);
    const [fx, fy] = pt(angle);
    // sweep-flag 1 = clockwise in SVG (= upper semicircle from left→right)
    // large-arc-flag 0 always: span is p*180° ≤ 180°
    const bg = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${ex} ${ey}`;
    const fg = p <= 0.001 ? "" : `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${fx} ${fy}`;
    return `
      <svg viewBox="0 0 160 100" aria-hidden="true">
        <path d="${bg}" fill="none" stroke="#d0dce8" stroke-width="14" stroke-linecap="round"/>
        ${fg ? `<path d="${fg}" fill="none" stroke="${BLUE}" stroke-width="14" stroke-linecap="round"/>` : ""}
      </svg>`;
  }

  function renderDashboard() {
    const n = D.national;
    const t = n.total || 1;
    const gauges = [
      { pct: pct(n.male, t), label: "Male Recipients", value: fmt(n.male) },
      { pct: pct(n.female, t), label: "Female Recipients", value: fmt(n.female) },
      { pct: pct(n.age65, t), label: "Age 65 or Older", value: fmt(n.age65) },
      { pct: pct(n.r70_90 + n.r100, t), label: "Rated 70% or Higher", value: fmt(n.r70_90 + n.r100) },
    ];
    const el = document.getElementById("dash-gauges");
    el.innerHTML = gauges.map((g) => `
      <div class="gauge-block">
        <div class="gauge">
          ${gaugeSVG(g.pct)}
          <div class="gauge-pct">${fmtPct(g.pct)}</div>
        </div>
        <div class="metric-card">
          <div class="val">${g.value}</div>
          <div class="lbl">${g.label}</div>
        </div>
      </div>`).join("");
    document.getElementById("dash-updated").textContent = D.lastUpdated;
  }

  // —— National Overview ——
  function renderNational() {
    const n = D.national;
    const t = n.total || 1;
    document.getElementById("nat-kpis").innerHTML = [
      ["Total Recipients", fmt(n.total)],
      ["Counties", fmt(D.meta.countyCount)],
      ["States / Territories", fmt(D.meta.stateCount)],
      ["Rated 100%", fmt(n.r100)],
      ["Age 65+", fmt(n.age65)],
    ].map(([l, v]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div></div>`).join("");

    makeChart("nat-rating-chart", {
      type: "bar",
      data: {
        labels: ["0–20%", "30–40%", "50–60%", "70–90%", "100%"],
        datasets: [{
          label: "Recipients",
          data: [n.r0_20, n.r30_40, n.r50_60, n.r70_90, n.r100],
          backgroundColor: BLUE,
          borderRadius: 2,
        }],
      },
      options: barOpts("Recipients by SCD Rating"),
    });

    makeChart("nat-age-chart", {
      type: "doughnut",
      data: {
        labels: ["17–44", "45–64", "65 or older"],
        datasets: [{ data: [n.age17_44, n.age45_64, n.age65], backgroundColor: [BLUE, BLUE_LIGHT, "#2e8b57"] }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } }, title: { display: false } },
      },
    });

    makeChart("nat-gender-chart", {
      type: "doughnut",
      data: {
        labels: ["Male", "Female", "Other / Not reported"],
        datasets: [{
          data: [n.male, n.female, Math.max(0, n.total - n.male - n.female)],
          backgroundColor: [BLUE, "#c45c26", "#ccc"],
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } } },
      },
    });

    document.getElementById("nat-share-list").innerHTML = [
      ["Share Male", fmtPct(pct(n.male, t))],
      ["Share Female", fmtPct(pct(n.female, t))],
      ["Share Age 17–44", fmtPct(pct(n.age17_44, t))],
      ["Share Age 45–64", fmtPct(pct(n.age45_64, t))],
      ["Share Age 65+", fmtPct(pct(n.age65, t))],
      ["Share Rated 70%+", fmtPct(pct(n.r70_90 + n.r100, t))],
      ["Share Rated 100%", fmtPct(pct(n.r100, t))],
    ].map(([a, b]) => `<li><span>${a}</span><span>${b}</span></li>`).join("");
  }

  function barOpts(yLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => " " + fmt(c.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: "#d0dce8", borderDash: [4, 4] },
          ticks: { font: { size: 11 }, callback: (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v },
          title: yLabel ? { display: true, text: yLabel, font: { size: 11 } } : undefined,
        },
      },
    };
  }

  // —— By State ——
  function renderByState() {
    const states = [...D.states].sort((a, b) => b.total - a.total);
    const top15 = states.slice(0, 15);

    document.getElementById("state-kpis").innerHTML = [
      ["Highest State", states[0].state + " — " + fmt(states[0].total)],
      ["Lowest State", states[states.length - 1].state + " — " + fmt(states[states.length - 1].total)],
      ["Median State Total", fmt(states[Math.floor(states.length / 2)].total)],
      ["Avg per State", fmt(D.national.total / states.length)],
      ["States & Territories", fmt(states.length)],
    ].map(([l, v]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value" style="font-size:15px">${v}</div></div>`).join("");

    makeChart("state-bar-chart", {
      type: "bar",
      data: {
        labels: top15.map((s) => s.state),
        datasets: [{ label: "Recipients", data: top15.map((s) => s.total), backgroundColor: BLUE, borderRadius: 2 }],
      },
      options: {
        ...barOpts("Total Recipients"),
        indexAxis: "y",
        scales: {
          x: {
            grid: { color: "#d0dce8", borderDash: [4, 4] },
            ticks: { font: { size: 10 }, callback: (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "K" },
          },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });

    const tbody = document.getElementById("state-table-body");
    const nat = D.national.total || 1;
    tbody.innerHTML = states.map((s, i) => `
      <tr data-state="${esc(s.state)}" style="cursor:pointer" title="Open State Profile">
        <td>${i + 1}</td>
        <td><strong>${esc(s.state)}</strong></td>
        <td class="num">${fmt(s.counties)}</td>
        <td class="num">${fmt(s.total)}</td>
        <td class="num">${fmtPct(pct(s.total, nat), 2)}</td>
        <td class="num">${fmt(s.r100)}</td>
        <td class="num">${fmtPct(pct(s.r100, s.total), 1)}</td>
        <td class="num">${fmt(s.age65)}</td>
        <td class="num">${fmtPct(pct(s.male, s.total), 1)}</td>
        <td class="num">${fmtPct(pct(s.female, s.total), 1)}</td>
      </tr>`).join("") + `
      <tr class="total-row">
        <td></td><td>Total</td><td class="num">${fmt(D.meta.countyCount)}</td>
        <td class="num">${fmt(D.national.total)}</td><td class="num">100%</td>
        <td class="num">${fmt(D.national.r100)}</td><td class="num">${fmtPct(pct(D.national.r100, D.national.total), 1)}</td>
        <td class="num">${fmt(D.national.age65)}</td>
        <td class="num">${fmtPct(pct(D.national.male, D.national.total), 1)}</td>
        <td class="num">${fmtPct(pct(D.national.female, D.national.total), 1)}</td>
      </tr>`;

    tbody.querySelectorAll("tr[data-state]").forEach((tr) => {
      tr.addEventListener("click", () => {
        profileState = tr.dataset.state;
        showPage("profiles");
      });
    });
  }

  // —— County Explorer ——
  function renderCounties() {
    const sel = document.getElementById("county-state-filter");
    if (sel && !sel.dataset.ready) {
      sel.innerHTML = `<option value="">All states</option>` + D.stateNames.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
      sel.dataset.ready = "1";
      sel.addEventListener("change", () => { countyFilter.state = sel.value; fillCountyTable(); });
      document.getElementById("county-search").addEventListener("input", (e) => {
        countyFilter.q = e.target.value.trim().toLowerCase();
        fillCountyTable();
      });
    }
    // KPIs based on filtered set will update in fillCountyTable
    fillCountyTable();
  }

  function fillCountyTable() {
    let rows = D.counties;
    if (countyFilter.state) rows = rows.filter((r) => r.state === countyFilter.state);
    if (countyFilter.q) {
      const q = countyFilter.q;
      rows = rows.filter((r) => r.county.toLowerCase().includes(q) || r.state.toLowerCase().includes(q) || r.fips.includes(q));
    }
    const key = sortState.key;
    const dir = sortState.dir;
    rows = [...rows].sort((a, b) => {
      const av = a[key], bv = b[key];
      if (typeof av === "string") return dir * av.localeCompare(bv);
      return dir * ((av || 0) - (bv || 0));
    });

    const shown = rows.slice(0, 500);
    const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    const tot = sum("total");

    document.getElementById("county-kpis").innerHTML = [
      ["Counties Shown", fmt(rows.length) + (rows.length > 500 ? " (table capped at 500)" : "")],
      ["Total Recipients", fmt(tot)],
      ["Rated 100%", fmt(sum("r100"))],
      ["Age 65+", fmt(sum("age65"))],
      ["Female", fmt(sum("female"))],
    ].map(([l, v]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value" style="font-size:${String(v).length > 14 ? 14 : 18}px">${v}</div></div>`).join("");

    // Chart: top 12 in current filter by total
    const top = [...rows].sort((a, b) => b.total - a.total).slice(0, 12);
    function countyAxisLabel(name) {
      if (name === "Other Foreign Countries") return "Other Foreign";
      if (name.length > 14) return name.slice(0, 12) + "…";
      return name;
    }
    const barBase = barOpts("Recipients");
    makeChart("county-bar-chart", {
      type: "bar",
      data: {
        labels: top.map((r) => countyAxisLabel(r.county)),
        datasets: [{ label: "Recipients", data: top.map((r) => r.total), backgroundColor: BLUE, borderRadius: 2 }],
      },
      options: {
        ...barBase,
        plugins: {
          ...barBase.plugins,
          title: { display: true, text: "Top Counties in Current Filter", font: { size: 12, weight: "600" }, color: BLUE },
          tooltip: {
            callbacks: {
              title: (items) => {
                const i = items[0].dataIndex;
                return top[i].county + ", " + top[i].state;
              },
              label: (c) => " " + fmt(c.raw),
            },
          },
        },
        scales: {
          ...barBase.scales,
          x: {
            ...barBase.scales.x,
            ticks: {
              ...(barBase.scales.x && barBase.scales.x.ticks),
              autoSkip: false,
              maxRotation: 40,
              minRotation: 0,
              font: { size: 10 },
            },
          },
        },
      },
    });

    // State share helper: build state totals map
    const stateTot = {};
    D.states.forEach((s) => { stateTot[s.state] = s.total; });

    const tbody = document.getElementById("county-table-body");
    tbody.innerHTML = shown.map((r) => {
      const share = stateTot[r.state] ? pct(r.total, stateTot[r.state]) : 0;
      return `<tr>
        <td>${esc(r.state)}</td>
        <td>${esc(r.county)}</td>
        <td class="num">${fmt(r.total)}</td>
        <td class="num">${fmt(r.r0_20)}</td>
        <td class="num">${fmt(r.r30_40)}</td>
        <td class="num">${fmt(r.r50_60)}</td>
        <td class="num">${fmt(r.r70_90)}</td>
        <td class="num">${fmt(r.r100)}</td>
        <td class="num">${fmt(r.age17_44)}</td>
        <td class="num">${fmt(r.age45_64)}</td>
        <td class="num">${fmt(r.age65)}</td>
        <td class="num">${fmt(r.male)}</td>
        <td class="num">${fmt(r.female)}</td>
        <td class="num">${fmtPct(share, 2)}</td>
      </tr>`;
    }).join("") + (rows.length ? `<tr class="total-row">
      <td colspan="2">Total (filtered${rows.length > 500 ? ", all matching" : ""})</td>
      <td class="num">${fmt(tot)}</td>
      <td class="num">${fmt(sum("r0_20"))}</td>
      <td class="num">${fmt(sum("r30_40"))}</td>
      <td class="num">${fmt(sum("r50_60"))}</td>
      <td class="num">${fmt(sum("r70_90"))}</td>
      <td class="num">${fmt(sum("r100"))}</td>
      <td class="num">${fmt(sum("age17_44"))}</td>
      <td class="num">${fmt(sum("age45_64"))}</td>
      <td class="num">${fmt(sum("age65"))}</td>
      <td class="num">${fmt(sum("male"))}</td>
      <td class="num">${fmt(sum("female"))}</td>
      <td class="num">—</td>
    </tr>` : `<tr><td colspan="14" class="empty-msg">No counties match your filters.</td></tr>`);

    document.getElementById("county-count-note").textContent =
      rows.length > 500 ? `Showing first 500 of ${fmt(rows.length)} matching counties. Narrow filters to see more detail.` :
      `${fmt(rows.length)} counties shown.`;
  }

  function setupCountySort() {
    document.querySelectorAll("#county-table thead th[data-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const k = th.dataset.key;
        if (sortState.key === k) sortState.dir *= -1;
        else { sortState.key = k; sortState.dir = k === "state" || k === "county" ? 1 : -1; }
        fillCountyTable();
      });
    });
  }

  // —— Ratings ——
  function renderRatings() {
    const n = D.national;
    const bands = [
      { key: "r0_20", label: "0% to 20%", val: n.r0_20 },
      { key: "r30_40", label: "30% to 40%", val: n.r30_40 },
      { key: "r50_60", label: "50% to 60%", val: n.r50_60 },
      { key: "r70_90", label: "70% to 90%", val: n.r70_90 },
      { key: "r100", label: "100%", val: n.r100 },
    ];
    document.getElementById("rating-kpis").innerHTML = bands.map((b) =>
      `<div class="kpi-card"><div class="kpi-label">${b.label}</div><div class="kpi-value">${fmt(b.val)}</div></div>`
    ).join("");

    makeChart("rating-nat-chart", {
      type: "bar",
      data: {
        labels: bands.map((b) => b.label),
        datasets: [{ data: bands.map((b) => b.val), backgroundColor: BLUE, borderRadius: 2 }],
      },
      options: barOpts("Recipients"),
    });

    // Top 10 states by % rated 100%
    const ranked = [...D.states].filter((s) => s.total > 1000).sort((a, b) => pct(b.r100, b.total) - pct(a.r100, a.total)).slice(0, 12);
    makeChart("rating-state-chart", {
      type: "bar",
      data: {
        labels: ranked.map((s) => s.state),
        datasets: [{
          label: "% Rated 100%",
          data: ranked.map((s) => +(pct(s.r100, s.total) * 100).toFixed(2)),
          backgroundColor: BLUE,
          borderRadius: 2,
        }],
      },
      options: {
        ...barOpts("% Rated 100%"),
        indexAxis: "y",
        scales: {
          x: { grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v + "%" }, max: 50 },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => " " + c.raw + "%" } },
          title: { display: true, text: "Highest Share Rated 100% (states with 1,000+ recipients)", font: { size: 12 }, color: BLUE },
        },
      },
    });

    // Stacked rating mix top states
    const top = [...D.states].sort((a, b) => b.total - a.total).slice(0, 10);
    makeChart("rating-stack-chart", {
      type: "bar",
      data: {
        labels: top.map((s) => s.state),
        datasets: [
          { label: "0–20%", data: top.map((s) => s.r0_20), backgroundColor: "#a8ccec", stack: "r" },
          { label: "30–40%", data: top.map((s) => s.r30_40), backgroundColor: "#7ab0e0", stack: "r" },
          { label: "50–60%", data: top.map((s) => s.r50_60), backgroundColor: "#4a8fd4", stack: "r" },
          { label: "70–90%", data: top.map((s) => s.r70_90), backgroundColor: "#2a6bb5", stack: "r" },
          { label: "100%", data: top.map((s) => s.r100), backgroundColor: BLUE, stack: "r" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
          title: { display: true, text: "Rating Mix — Top 10 States by Total Recipients", font: { size: 12 }, color: BLUE },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.raw)}` } },
        },
        scales: {
          x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { stacked: true, grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "K" } },
        },
      },
    });
  }

  // —— Ages ——
  function renderAges() {
    const n = D.national;
    document.getElementById("age-kpis").innerHTML = [
      ["Age 17–44", fmt(n.age17_44)],
      ["Age 45–64", fmt(n.age45_64)],
      ["Age 65 or older", fmt(n.age65)],
      ["Share 65+", fmtPct(pct(n.age65, n.total))],
      ["Largest Band", "65 or older"],
    ].map(([l, v]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div></div>`).join("");

    makeChart("age-nat-chart", {
      type: "bar",
      data: {
        labels: ["17–44", "45–64", "65 or older"],
        datasets: [{ data: [n.age17_44, n.age45_64, n.age65], backgroundColor: [BLUE, BLUE_LIGHT, "#2e8b57"], borderRadius: 2 }],
      },
      options: barOpts("Recipients"),
    });

    const ranked = [...D.states].filter((s) => s.total > 1000).sort((a, b) => pct(b.age65, b.total) - pct(a.age65, a.total)).slice(0, 12);
    makeChart("age-state-chart", {
      type: "bar",
      data: {
        labels: ranked.map((s) => s.state),
        datasets: [{ data: ranked.map((s) => +(pct(s.age65, s.total) * 100).toFixed(2)), backgroundColor: BLUE, borderRadius: 2 }],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Highest Share Age 65+ (states with 1,000+)", font: { size: 12 }, color: BLUE },
          tooltip: { callbacks: { label: (c) => " " + c.raw + "%" } },
        },
        scales: {
          x: { grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v + "%" } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });

    const top = [...D.states].sort((a, b) => b.total - a.total).slice(0, 10);
    makeChart("age-stack-chart", {
      type: "bar",
      data: {
        labels: top.map((s) => s.state),
        datasets: [
          { label: "17–44", data: top.map((s) => s.age17_44), backgroundColor: BLUE, stack: "a" },
          { label: "45–64", data: top.map((s) => s.age45_64), backgroundColor: BLUE_LIGHT, stack: "a" },
          { label: "65+", data: top.map((s) => s.age65), backgroundColor: "#2e8b57", stack: "a" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } },
          title: { display: true, text: "Age Mix — Top 10 States", font: { size: 12 }, color: BLUE },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.raw)}` } },
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: { stacked: true, grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(0) + "K" } },
        },
      },
    });
  }

  // —— Gender ——
  function renderGender() {
    const n = D.national;
    const other = Math.max(0, n.total - n.male - n.female);
    document.getElementById("gender-kpis").innerHTML = [
      ["Male", fmt(n.male)],
      ["Female", fmt(n.female)],
      ["Other / Not reported", fmt(other)],
      ["% Female", fmtPct(pct(n.female, n.total))],
      ["% Male", fmtPct(pct(n.male, n.total))],
    ].map(([l, v]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div></div>`).join("");

    makeChart("gender-nat-chart", {
      type: "doughnut",
      data: {
        labels: ["Male", "Female", "Other / Not reported"],
        datasets: [{ data: [n.male, n.female, other], backgroundColor: [BLUE, "#c45c26", "#bbb"] }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
      },
    });

    const ranked = [...D.states].filter((s) => s.total > 1000).sort((a, b) => pct(b.female, b.total) - pct(a.female, a.total)).slice(0, 12);
    makeChart("gender-state-chart", {
      type: "bar",
      data: {
        labels: ranked.map((s) => s.state),
        datasets: [{ data: ranked.map((s) => +(pct(s.female, s.total) * 100).toFixed(2)), backgroundColor: "#c45c26", borderRadius: 2 }],
      },
      options: {
        indexAxis: "y",
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Highest Female Share (states with 1,000+)", font: { size: 12 }, color: BLUE },
          tooltip: { callbacks: { label: (c) => " " + c.raw + "%" } },
        },
        scales: {
          x: { grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v + "%" } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });

    const tbody = document.getElementById("gender-table-body");
    const states = [...D.states].sort((a, b) => b.total - a.total);
    tbody.innerHTML = states.map((s) => `
      <tr>
        <td>${esc(s.state)}</td>
        <td class="num">${fmt(s.total)}</td>
        <td class="num">${fmt(s.male)}</td>
        <td class="num">${fmt(s.female)}</td>
        <td class="num">${fmtPct(pct(s.male, s.total), 1)}</td>
        <td class="num">${fmtPct(pct(s.female, s.total), 1)}</td>
      </tr>`).join("") + `
      <tr class="total-row">
        <td>Total</td>
        <td class="num">${fmt(n.total)}</td>
        <td class="num">${fmt(n.male)}</td>
        <td class="num">${fmt(n.female)}</td>
        <td class="num">${fmtPct(pct(n.male, n.total), 1)}</td>
        <td class="num">${fmtPct(pct(n.female, n.total), 1)}</td>
      </tr>`;
  }

  // —— Top Counties ——
  function renderTop() {
    const byTotal = [...D.counties].sort((a, b) => b.total - a.total).slice(0, 25);
    const by100 = [...D.counties].filter((c) => c.total >= 100).sort((a, b) => pct(b.r100, b.total) - pct(a.r100, a.total)).slice(0, 15);
    const byFemale = [...D.counties].filter((c) => c.total >= 200).sort((a, b) => pct(b.female, b.total) - pct(a.female, a.total)).slice(0, 15);

    document.getElementById("top-kpis").innerHTML = [
      ["#1 County", byTotal[0].county + ", " + byTotal[0].state],
      ["Recipients there", fmt(byTotal[0].total)],
      ["#2 County", byTotal[1].county + ", " + byTotal[1].state],
      ["#3 County", byTotal[2].county + ", " + byTotal[2].state],
      ["Top 25 share of U.S.", fmtPct(pct(byTotal.reduce((s, c) => s + c.total, 0), D.national.total))],
    ].map(([l, v]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value" style="font-size:14px">${v}</div></div>`).join("");

    makeChart("top-bar-chart", {
      type: "bar",
      data: {
        labels: byTotal.slice(0, 15).map((c) => c.county),
        datasets: [{ data: byTotal.slice(0, 15).map((c) => c.total), backgroundColor: BLUE, borderRadius: 2 }],
      },
      options: {
        ...barOpts("Recipients"),
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Top 15 Counties by Total Recipients", font: { size: 12 }, color: BLUE },
          tooltip: {
            callbacks: {
              title: (items) => {
                const c = byTotal[items[0].dataIndex];
                return c.county + ", " + c.state;
              },
              label: (c) => " " + fmt(c.raw),
            },
          },
        },
        scales: {
          x: { grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });

    document.getElementById("top-table-body").innerHTML = byTotal.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(c.county)}</td>
        <td>${esc(c.state)}</td>
        <td class="num">${fmt(c.total)}</td>
        <td class="num">${fmt(c.r100)}</td>
        <td class="num">${fmtPct(pct(c.r100, c.total), 1)}</td>
        <td class="num">${fmt(c.age65)}</td>
        <td class="num">${fmtPct(pct(c.female, c.total), 1)}</td>
      </tr>`).join("");

    document.getElementById("top100-table-body").innerHTML = by100.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(c.county)}</td>
        <td>${esc(c.state)}</td>
        <td class="num">${fmt(c.total)}</td>
        <td class="num">${fmt(c.r100)}</td>
        <td class="num">${fmtPct(pct(c.r100, c.total), 1)}</td>
      </tr>`).join("");

    document.getElementById("topfem-table-body").innerHTML = byFemale.map((c, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${esc(c.county)}</td>
        <td>${esc(c.state)}</td>
        <td class="num">${fmt(c.total)}</td>
        <td class="num">${fmt(c.female)}</td>
        <td class="num">${fmtPct(pct(c.female, c.total), 1)}</td>
      </tr>`).join("");
  }

  // —— State Profiles ——
  function renderProfiles() {
    const sel = document.getElementById("profile-state-sel");
    if (sel && !sel.dataset.ready) {
      sel.innerHTML = D.stateNames.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
      sel.dataset.ready = "1";
      sel.addEventListener("change", () => { profileState = sel.value; fillProfile(); });
    }
    if (!profileState) profileState = D.stateNames.includes("Texas") ? "Texas" : D.stateNames[0];
    sel.value = profileState;
    fillProfile();
  }

  function fillProfile() {
    const st = D.states.find((s) => s.state === profileState);
    if (!st) return;
    const counties = D.counties.filter((c) => c.state === profileState).sort((a, b) => b.total - a.total);
    const t = st.total || 1;

    document.getElementById("profile-title-extra").textContent = profileState;
    document.getElementById("profile-kpis").innerHTML = [
      ["Total Recipients", fmt(st.total)],
      ["Counties", fmt(st.counties)],
      ["Rated 100%", fmt(st.r100)],
      ["Age 65+", fmt(st.age65)],
      ["% Female", fmtPct(pct(st.female, t))],
    ].map(([l, v]) => `<div class="kpi-card"><div class="kpi-label">${l}</div><div class="kpi-value">${v}</div></div>`).join("");

    makeChart("profile-rating-chart", {
      type: "bar",
      data: {
        labels: ["0–20%", "30–40%", "50–60%", "70–90%", "100%"],
        datasets: [{ data: [st.r0_20, st.r30_40, st.r50_60, st.r70_90, st.r100], backgroundColor: BLUE, borderRadius: 2 }],
      },
      options: {
        ...barOpts("Recipients"),
        plugins: {
          ...barOpts().plugins,
          title: { display: true, text: "SCD Rating Mix — " + profileState, font: { size: 12 }, color: BLUE },
        },
      },
    });

    const top = counties.slice(0, 12);
    makeChart("profile-county-chart", {
      type: "bar",
      data: {
        labels: top.map((c) => c.county.length > 12 ? c.county.slice(0, 10) + "…" : c.county),
        datasets: [{ data: top.map((c) => c.total), backgroundColor: BLUE, borderRadius: 2 }],
      },
      options: {
        ...barOpts("Recipients"),
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          title: { display: true, text: "Top Counties in " + profileState, font: { size: 12 }, color: BLUE },
          tooltip: { callbacks: { label: (c) => " " + fmt(c.raw) } },
        },
        scales: {
          x: { grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v } },
          y: { grid: { display: false }, ticks: { font: { size: 10 } } },
        },
      },
    });

    document.getElementById("profile-table-body").innerHTML = counties.map((c) => `
      <tr>
        <td>${esc(c.county)}</td>
        <td class="num">${fmt(c.total)}</td>
        <td class="num">${fmtPct(pct(c.total, t), 2)}</td>
        <td class="num">${fmt(c.r0_20)}</td>
        <td class="num">${fmt(c.r70_90)}</td>
        <td class="num">${fmt(c.r100)}</td>
        <td class="num">${fmt(c.age17_44)}</td>
        <td class="num">${fmt(c.age45_64)}</td>
        <td class="num">${fmt(c.age65)}</td>
        <td class="num">${fmt(c.male)}</td>
        <td class="num">${fmt(c.female)}</td>
      </tr>`).join("") + `
      <tr class="total-row">
        <td>Total</td>
        <td class="num">${fmt(st.total)}</td>
        <td class="num">100%</td>
        <td class="num">${fmt(st.r0_20)}</td>
        <td class="num">${fmt(st.r70_90)}</td>
        <td class="num">${fmt(st.r100)}</td>
        <td class="num">${fmt(st.age17_44)}</td>
        <td class="num">${fmt(st.age45_64)}</td>
        <td class="num">${fmt(st.age65)}</td>
        <td class="num">${fmt(st.male)}</td>
        <td class="num">${fmt(st.female)}</td>
      </tr>`;
  }

  // —— Comparisons ——
  function renderCompare() {
    const selA = document.getElementById("cmp-a");
    const selB = document.getElementById("cmp-b");
    if (selA && !selA.dataset.ready) {
      const opts = D.stateNames.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
      selA.innerHTML = opts;
      selB.innerHTML = opts;
      selA.dataset.ready = "1";
      selB.dataset.ready = "1";
      selA.addEventListener("change", () => { compareA = selA.value; fillCompare(); });
      selB.addEventListener("change", () => { compareB = selB.value; fillCompare(); });
    }
    selA.value = compareA;
    selB.value = compareB;
    fillCompare();
  }

  function fillCompare() {
    const a = D.states.find((s) => s.state === compareA);
    const b = D.states.find((s) => s.state === compareB);
    if (!a || !b) return;

    function row(label, va, vb, isPct) {
      const da = isPct ? fmtPct(va, 1) : fmt(va);
      const db = isPct ? fmtPct(vb, 1) : fmt(vb);
      return `<tr><td>${label}</td><td class="num">${da}</td><td class="num">${db}</td></tr>`;
    }

    document.getElementById("cmp-table-body").innerHTML =
      row("Total Recipients", a.total, b.total) +
      row("Counties", a.counties, b.counties) +
      row("Rated 0–20%", a.r0_20, b.r0_20) +
      row("Rated 70–90%", a.r70_90, b.r70_90) +
      row("Rated 100%", a.r100, b.r100) +
      row("% Rated 100%", pct(a.r100, a.total), pct(b.r100, b.total), true) +
      row("% Rated 70%+", pct(a.r70_90 + a.r100, a.total), pct(b.r70_90 + b.r100, b.total), true) +
      row("Age 17–44", a.age17_44, b.age17_44) +
      row("Age 45–64", a.age45_64, b.age45_64) +
      row("Age 65+", a.age65, b.age65) +
      row("% Age 65+", pct(a.age65, a.total), pct(b.age65, b.total), true) +
      row("Male", a.male, b.male) +
      row("Female", a.female, b.female) +
      row("% Female", pct(a.female, a.total), pct(b.female, b.total), true);

    document.getElementById("cmp-head-a").textContent = compareA;
    document.getElementById("cmp-head-b").textContent = compareB;

    makeChart("cmp-rating-chart", {
      type: "bar",
      data: {
        labels: ["0–20%", "30–40%", "50–60%", "70–90%", "100%"],
        datasets: [
          { label: compareA, data: [a.r0_20, a.r30_40, a.r50_60, a.r70_90, a.r100], backgroundColor: BLUE },
          { label: compareB, data: [b.r0_20, b.r30_40, b.r50_60, b.r70_90, b.r100], backgroundColor: "#c45c26" },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          title: { display: true, text: "Rating Counts Compared", font: { size: 12 }, color: BLUE },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.raw)}` } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v >= 1e3 ? (v / 1e3).toFixed(0) + "K" : v } },
        },
      },
    });

    makeChart("cmp-share-chart", {
      type: "bar",
      data: {
        labels: ["% Male", "% Female", "% 17–44", "% 45–64", "% 65+", "% 70%+", "% 100%"],
        datasets: [
          {
            label: compareA,
            data: [
              pct(a.male, a.total) * 100, pct(a.female, a.total) * 100,
              pct(a.age17_44, a.total) * 100, pct(a.age45_64, a.total) * 100, pct(a.age65, a.total) * 100,
              pct(a.r70_90 + a.r100, a.total) * 100, pct(a.r100, a.total) * 100,
            ].map((x) => +x.toFixed(2)),
            backgroundColor: BLUE,
          },
          {
            label: compareB,
            data: [
              pct(b.male, b.total) * 100, pct(b.female, b.total) * 100,
              pct(b.age17_44, b.total) * 100, pct(b.age45_64, b.total) * 100, pct(b.age65, b.total) * 100,
              pct(b.r70_90 + b.r100, b.total) * 100, pct(b.r100, b.total) * 100,
            ].map((x) => +x.toFixed(2)),
            backgroundColor: "#c45c26",
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, font: { size: 11 } } },
          title: { display: true, text: "Share Comparison (%)", font: { size: 12 }, color: BLUE },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${c.raw}%` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: "#d0dce8", borderDash: [4, 4] }, ticks: { callback: (v) => v + "%" } },
        },
      },
    });
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // —— Init ——
  function buildTabs() {
    const bar = document.getElementById("tab-bar");
    bar.innerHTML = PAGES.map((p) => {
      const icon = p.icon === "home"
        ? `<svg class="tab-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`
        : "";
      return `<button type="button" class="tab" data-page="${p.id}">${icon}${esc(p.label)}</button>`;
    }).join("");
    bar.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => showPage(t.dataset.page)));
  }

  function bindNavButtons() {
    document.querySelectorAll("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => showPage(btn.dataset.nav));
    });
    document.querySelectorAll(".back-btn").forEach((btn) => {
      btn.addEventListener("click", () => showPage("dashboard"));
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (typeof Chart !== "undefined") {
      Chart.defaults.font.family = "'Segoe UI', system-ui, sans-serif";
      Chart.defaults.color = "#333";
    }
    buildTabs();
    bindNavButtons();
    setupCountySort();
    showPage("dashboard");
  });
})();
