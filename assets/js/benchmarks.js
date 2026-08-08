/**
 * Benchmarks Page — Pivot table (models×benchmarks), filtering, sorting, model detail, and comparison
 */
(async function () {
  "use strict";

  // ─── Data ────────────────────────────────────────────────────────────
  const scriptTag = document.currentScript;
  const benchUrl = scriptTag.dataset.benchUrl || "/benchmarks/benchmarks.json";
  const rawData = await fetch(benchUrl).then((r) => r.json());
  let allResults = rawData.slice();

  // State
  let sortCol = "model";
  let sortDir = "asc";
  let selectedModels = new Set();
  let activeBenchmarks = new Set();
  let modelFilter = "";
  let compareMode = false;
  let chartInstance = null;
  const MAX_COMPARE = 4;

  // ─── DOM refs ────────────────────────────────────────────────────────
  const $ = (s) => document.querySelector(s);
  const thead = $("#benchTableHead");
  const tbody = $("#benchTableBody");
  const benchFilter = $("#benchBenchmarkFilter");
  const modelInput = $("#benchModelFilter");
  const compareBtn = $("#benchCompareBtn");
  const backBtn = $("#benchBackBtn");
  const tableView = $("#benchTableView");
  const compareView = $("#benchCompareView");
  const noResults = $("#benchNoResults");

  // Modal
  const modal = $("#benchModelModal");
  const modalTitle = $("#benchModalTitle");
  const modalBody = $("#benchModalBody");
  const modalClose = $("#benchModalClose");

  // Compare
  const compareHead = $("#benchCompareHead");
  const compareBody = $("#benchCompareBody");
  const compareModelsDiv = $("#benchCompareModels");
  const chartContainer = $("#benchChartContainer");

  // ─── Helpers ─────────────────────────────────────────────────────────
  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function fmtPct(v) {
    if (v == null) return null;
    return (v * 100).toFixed(2) + "%";
  }

  function fmtDate(d) {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // Build pivot: { model -> { benchmark -> result } }
  function buildPivot() {
    const pivot = {};
    allResults.forEach((r) => {
      if (!pivot[r.model]) pivot[r.model] = {};
      pivot[r.model][r.benchmark] = r;
    });
    return { pivot };
  }

  function getAllBenchmarks() {
    const s = new Set();
    allResults.forEach((r) => s.add(r.benchmark));
    return [...s].sort();
  }

  function getAllModels() {
    const s = new Set();
    allResults.forEach((r) => s.add(r.model));
    return [...s].sort();
  }

  // ─── Benchmark Filter Checkboxes ─────────────────────────────────────
  function renderBenchFilters() {
    const benches = getAllBenchmarks();
    activeBenchmarks.clear();
    benches.forEach((b) => activeBenchmarks.add(b));

    benchFilter.innerHTML = benches
      .map(
        (b) =>
          `<label class="bench-bench-label"><input type="checkbox" value="${esc(b)}" checked> ${esc(b)}</label>`
      )
      .join("");

    benchFilter.addEventListener("change", (e) => {
      if (e.target.type === "checkbox") {
        const val = e.target.value;
        if (e.target.checked) activeBenchmarks.add(val);
        else activeBenchmarks.delete(val);
        renderTable();
        if (compareMode) {
          renderCompare();
          renderChart();
        }
      }
    });
  }

  // ─── Render Pivot Table ──────────────────────────────────────────────
  function renderTable() {
    const benches = getAllBenchmarks().filter((b) => activeBenchmarks.has(b));
    const models = getAllModels();
    const { pivot } = buildPivot();

    // Filter by model name
    const filteredModels = modelFilter.trim()
      ? models.filter((m) => m.toLowerCase().includes(modelFilter.trim().toLowerCase()))
      : models;

    // Sort models
    filteredModels.sort((a, b) => {
      let va, vb;
      if (sortCol === "model") {
        va = a.toLowerCase();
        vb = b.toLowerCase();
      } else {
        // Sort by benchmark column
        va = (pivot[a] && pivot[a][sortCol]) ? pivot[a][sortCol].score ?? -1 : -1;
        vb = (pivot[b] && pivot[b][sortCol]) ? pivot[b][sortCol].score ?? -1 : -1;
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    if (filteredModels.length === 0) {
      thead.innerHTML = "";
      tbody.innerHTML = "";
      noResults.classList.remove("hidden");
      return;
    }
    noResults.classList.add("hidden");

    // Header
    let headHtml = `<tr>
      <th class="bench-check-col"><input type="checkbox" id="benchSelectAll" ${filteredModels.length === 0 ? "disabled" : ""}></th>
      <th data-sort="model" class="sortable">Model <span class="sort-arrow">${sortCol === "model" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span></th>`;

    benches.forEach((b) => {
      headHtml += `<th data-sort="${esc(b)}" class="sortable">${esc(b)} <span class="sort-arrow">${sortCol === b ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span></th>`;
    });

    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    // Body
    tbody.innerHTML = filteredModels
      .map((model) => {
        const isSelected = selectedModels.has(model);
        let row = `<tr data-model="${esc(model)}">
          <td class="bench-check-col">
            <input type="checkbox" class="bench-row-cb" data-model="${esc(model)}" ${isSelected ? "checked" : ""}>
          </td>
          <td class="bench-model-name"><a href="#" class="bench-model-link" data-model="${esc(model)}">${esc(model)}</a></td>`;

        benches.forEach((b) => {
          const r = pivot[model] && pivot[model][b];
          if (r && r.score != null) {
            row += `<td class="bench-score">${fmtPct(r.score)}</td>`;
          } else {
            row += `<td class="bench-no-data">—</td>`;
          }
        });

        row += `</tr>`;
        return row;
      })
      .join("");

    // Sort header clicks
    thead.querySelectorAll(".sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortCol === col) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortCol = col;
          sortDir = "asc";
        }
        renderTable();
      });
    });

    updateCompareBtn();
    updateSelectAllState();
  }

  // ─── Select-All helper ───────────────────────────────────────────────
  function updateSelectAllState() {
    const cb = document.getElementById("benchSelectAll");
    if (!cb) return;
    // Read models in current table order to match select-all behavior
    const tableModels = [...tbody.querySelectorAll(".bench-model-link")].map(
      (a) => a.dataset.model
    );
    if (tableModels.length === 0) {
      cb.checked = false;
      cb.indeterminate = false;
      return;
    }
    // Check if the first MAX_COMPARE models in current sort are all selected
    const firstN = tableModels.slice(0, MAX_COMPARE);
    const selectedCount = firstN.filter((m) => selectedModels.has(m)).length;
    cb.checked = selectedCount === firstN.length && selectedCount > 0;
    cb.indeterminate = selectedCount > 0 && selectedCount < firstN.length;
  }

  // ─── Checkbox delegation ─────────────────────────────────────────────
  tbody.addEventListener("change", (e) => {
    if (e.target.classList.contains("bench-row-cb")) {
      const model = e.target.dataset.model;
      if (e.target.checked) {
        if (selectedModels.size >= MAX_COMPARE) {
          e.target.checked = false;
          return;
        }
        selectedModels.add(model);
      } else {
        selectedModels.delete(model);
      }
      updateCompareBtn();
      updateSelectAllState();
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.id === "benchSelectAll") {
      // Read models in current table order (respects active sort)
      const tableModels = [...tbody.querySelectorAll(".bench-model-link")].map(
        (a) => a.dataset.model
      );

      // Only consider first MAX_COMPARE models
      const firstN = tableModels.slice(0, MAX_COMPARE);

      // Check if all first-N models are already selected
      const allSelected = firstN.length > 0 && firstN.every((m) => selectedModels.has(m));

      if (allSelected) {
        // Deselect the first-N models
        firstN.forEach((m) => selectedModels.delete(m));
      } else {
        // Clear and select first MAX_COMPARE models in current sort order
        selectedModels.clear();
        firstN.forEach((m) => selectedModels.add(m));
      }
      renderTable();
      updateCompareBtn();
    }
  });

  // ─── Model Detail Modal ──────────────────────────────────────────────
  tbody.addEventListener("click", (e) => {
    const link = e.target.closest(".bench-model-link");
    if (link) {
      e.preventDefault();
      openModelModal(link.dataset.model);
    }
  });

  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  function openModelModal(modelName) {
    const results = allResults.filter((r) => r.model === modelName);
    modalTitle.textContent = modelName;

    // Collect model-level notes from any result entry
    const modelNotes = results.find((r) => r.model_notes)?.model_notes || "";

    let html = "";
    if (modelNotes) {
      html += `<div class="bench-model-notes-box"><strong>Model Notes</strong><p>${esc(modelNotes)}</p></div>`;
    }

    html += `<table class="bench-detail-table">
      <thead><tr><th>Benchmark</th><th>Score</th><th>Samples</th><th>Date</th><th>Notes</th></tr></thead>
      <tbody>`;

    results.forEach((r) => {
      html += `<tr>
        <td>${esc(r.benchmark)}</td>
        <td>${r.score != null ? fmtPct(r.score) : "—"}</td>
        <td>${r.samples != null ? "n=" + r.samples : "—"}</td>
        <td>${fmtDate(r.date)}</td>
        <td>${esc(r.notes || "")}</td>
      </tr>`;

      if (r.subsets && r.subsets.length > 0) {
        html += `<tr class="bench-subset-row"><td colspan="6">
          <table class="bench-subset-table">
            <thead><tr><th>Subset</th><th>Score</th><th>Samples</th></tr></thead>
            <tbody>`;
        r.subsets.forEach((s) => {
          html += `<tr><td>${esc(s.name)}</td><td>${fmtPct(s.score)}</td><td>${s.samples != null ? "n=" + s.samples : "—"}</td></tr>`;
        });
        html += `</tbody></table></td></tr>`;
      }
    });

    html += `</tbody></table>`;
    modalBody.innerHTML = html;
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  // ─── Compare Button ──────────────────────────────────────────────────
  function updateCompareBtn() {
    const count = selectedModels.size;
    compareBtn.textContent = `Compare Selected (${count}/${MAX_COMPARE})`;
    compareBtn.disabled = count < 2;
  }

  compareBtn.addEventListener("click", () => {
    if (selectedModels.size < 2) return;
    enterCompareMode();
  });

  backBtn.addEventListener("click", exitCompareMode);

  function enterCompareMode() {
    compareMode = true;
    tableView.classList.add("hidden");
    compareView.classList.remove("hidden");
    compareBtn.classList.add("hidden");
    backBtn.classList.remove("hidden");
    modelInput.classList.add("hidden");
    renderCompare();
    renderChart();
  }

  function exitCompareMode() {
    compareMode = false;
    compareView.classList.add("hidden");
    tableView.classList.remove("hidden");
    compareBtn.classList.remove("hidden");
    backBtn.classList.add("hidden");
    modelInput.classList.remove("hidden");
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
  }

  // ─── Compare View ────────────────────────────────────────────────────
  function renderCompare() {
    const models = [...selectedModels].sort();
    const benches = getAllBenchmarks().filter((b) => activeBenchmarks.has(b));
    const { pivot } = buildPivot();

    // Model chips
    compareModelsDiv.innerHTML = models
      .map(
        (m) =>
          `<span class="bench-model-chip">${esc(m)} <button class="bench-chip-remove" data-model="${esc(m)}">&times;</button></span>`
      )
      .join("");

    compareModelsDiv.querySelectorAll(".bench-chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedModels.delete(btn.dataset.model);
        if (selectedModels.size < 2) {
          exitCompareMode();
          return;
        }
        renderCompare();
        renderChart();
      });
    });

    // Header
    compareHead.innerHTML = `<tr><th>Benchmark</th><th>Samples</th>${models.map((m) => `<th>${esc(m)}</th>`).join("")}</tr>`;

    // Body
    compareBody.innerHTML = benches
      .map((bench) => {
        const scores = models.map((m) => {
          const r = pivot[m] && pivot[m][bench];
          return r && r.score != null ? r : null;
        });

        const validScores = scores.filter((s) => s !== null);
        const maxScore = validScores.length > 0 ? Math.max(...validScores.map((s) => s.score)) : -1;

        const cells = scores
          .map((s) => {
            if (!s) return `<td class="bench-no-data">—</td>`;
            const isWinner = s.score === maxScore && validScores.length > 1;
            return `<td class="${isWinner ? "bench-winner" : ""}">${fmtPct(s.score)}</td>`;
          })
          .join("");

        const sampleCounts = scores.filter((s) => s !== null).map((s) => s.samples);
        const samplesLabel =
          sampleCounts.length > 0
            ? sampleCounts.every((v) => v === sampleCounts[0])
              ? `n=${sampleCounts[0]}`
              : sampleCounts.map((v) => `n=${v}`).join(", ")
            : "—";

        return `<tr><td>${esc(bench)}</td><td>${samplesLabel}</td>${cells}</tr>`;
      })
      .join("");
  }

  // ─── Bar Chart ───────────────────────────────────────────────────────
  const MAX_CHART_BENCHMARKS = 6;

  function renderChart() {
    const models = [...selectedModels].sort();
    let benches = getAllBenchmarks().filter((b) => activeBenchmarks.has(b));
    // Limit chart to max 6 benchmarks to keep it readable
    if (benches.length > MAX_CHART_BENCHMARKS) {
      benches = benches.slice(0, MAX_CHART_BENCHMARKS);
    }
    const { pivot } = buildPivot();

    const palette = [
      "#7c5cfc", "#ff6b9c", "#5cfcbc", "#ffc65c", "#5cff8c",
      "#ff5c5c", "#c65cff", "#5cffc6", "#ff8c5c", "#8cff5c",
    ];

    const datasets = models.map((m, i) => ({
      label: m,
      data: benches.map((b) => {
        const r = pivot[m] && pivot[m][b];
        return r && r.score != null ? r.score * 100 : null;
      }),
      backgroundColor: palette[i % palette.length],
      borderColor: palette[i % palette.length],
      borderWidth: 1,
      borderRadius: 4,
    }));

    if (chartInstance) chartInstance.destroy();

    const ctx = document.getElementById("benchChart").getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "bar",
      data: { labels: benches, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#e8e8f0", font: { family: "Inter, sans-serif" } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                ctx.parsed.y !== null ? `${ctx.dataset.label}: ${(ctx.parsed.y / 100).toFixed(4)}` : null,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#9898a8", font: { family: "Inter, sans-serif" } },
            grid: { color: "rgba(42,42,58,0.5)" },
          },
          y: {
            beginAtZero: true,
            max: 100,
            ticks: {
              color: "#9898a8",
              font: { family: "Inter, sans-serif" },
              callback: (v) => v + "%",
            },
            grid: { color: "rgba(42,42,58,0.5)" },
          },
        },
      },
    });
  }

  // ─── Model Filter Input ──────────────────────────────────────────────
  let filterTimeout;
  modelInput.addEventListener("input", () => {
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(() => {
      modelFilter = modelInput.value;
      renderTable();
    }, 200);
  });

  // ─── Keyboard Escape ─────────────────────────────────────────────────
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
  });

  // ─── Init ────────────────────────────────────────────────────────────
  renderBenchFilters();
  renderTable();
})();