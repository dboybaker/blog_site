/**
 * Benchmarks Page — Pivot table (models×benchmarks), filtering, sorting, model detail, and comparison
 */
(async function () {
  "use strict";

  // ─── Tabs ────────────────────────────────────────────────────────────
  const tabButtons = Array.from(document.querySelectorAll("[data-bench-tab]"));
  const tabPanels = new Map(
    tabButtons.map(
      (b) => [b.dataset.benchTab, document.getElementById(`benchPanel-${b.dataset.benchTab}`)]
    )
  );
  const DEFAULT_TAB = "traditional";

  function activateTab(id, syncHash) {
    if (!tabPanels.has(id) || !tabPanels.get(id)) id = DEFAULT_TAB;
    tabButtons.forEach((btn) => {
      const isActive = btn.dataset.benchTab === id;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
    });
    tabPanels.forEach((panel, tabId) => {
      if (panel) panel.classList.toggle("hidden", tabId !== id);
    });
    if (syncHash && location.hash !== `#${id}`) {
      history.replaceState(null, "", `#${id}`);
    }
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => activateTab(btn.dataset.benchTab, true));
  });

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (hash) activateTab(hash, false);
  });

  // Activate tab from the URL hash (e.g. /benchmarks/#word500); default is traditional
  const initialTab = location.hash.replace("#", "");
  activateTab(tabPanels.has(initialTab) ? initialTab : DEFAULT_TAB, false);

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
  // localStorage key for the saved test selection (see bench-state.js)
  const BENCH_STATE_KEY = "traditional.active-benchmarks";
  // localStorage key for the saved sort (see bench-state.js)
  const SORT_STATE_KEY = "traditional.sort";
  // Benchmarks selected by default on first visit (before the user makes
  // their own picks, which are then remembered). Keep this at 6 - update
  // the list when new benchmarks arrive.
  const DEFAULT_ACTIVE_BENCHMARKS = [
    "Arena-Hard",
    "BFCL-v4",
    "HumanEval+",
    "IFEval",
    "MBPP+",
    "MMLU-Pro",
  ];
  let modelFilter = "";
  let compareMode = false;
  let chartInstance = null;
  const MAX_COMPARE = 4;
  // Synthetic Overall column: an equal-weight average of the scores in the
  // benchmark columns currently shown. It is not a benchmark, so it never
  // enters the filter checkboxes, the chart, or getAllBenchmarks().
  const OVERALL = "__overall__";

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

  // Default selection: the DEFAULT list limited to what's currently
  // available. If every default name is gone (renames/removals), fall back
  // to all available.
  function defaultBenchmarks(available) {
    const set = new Set(available);
    const kept = DEFAULT_ACTIVE_BENCHMARKS.filter((b) => set.has(b));
    return kept.length > 0 ? kept : [...available];
  }

  // ─── Benchmark Filter Checkboxes ─────────────────────────────────────
  function renderBenchFilters() {
    const benches = getAllBenchmarks();
    // Restore the user's saved selection (survives reloads). Falls back to
    // the default selection when nothing usable is saved.
    const restored = window.BenchState.restoreSelection(BENCH_STATE_KEY, benches);
    activeBenchmarks.clear();
    (restored || defaultBenchmarks(benches)).forEach((b) => activeBenchmarks.add(b));

    benchFilter.innerHTML = benches
      .map(
        (b) =>
          `<label class="bench-bench-label"><input type="checkbox" value="${esc(b)}" ${activeBenchmarks.has(b) ? "checked" : ""}> ${esc(b)}</label>`
      )
      .join("");

    benchFilter.addEventListener("change", (e) => {
      if (e.target.type === "checkbox") {
        const val = e.target.value;
        if (e.target.checked) activeBenchmarks.add(val);
        else activeBenchmarks.delete(val);
        window.BenchState.saveSelection(BENCH_STATE_KEY, activeBenchmarks);
        renderTable();
        if (compareMode) {
          renderCompare();
          renderChart();
        }
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // An equal-weight average of the scores a model earned across the benchmark
  // columns currently shown: it follows the checkboxes, and both the header
  // and the cell say how many columns the average covers.
  //
  // Equal weight rather than sample weight on purpose. The suites run 75 to
  // 420 samples, so weighting by sample count would hand MMLU-Pro and MBPP+
  // about half the score and quietly move the small models several points.
  // This is also what the Word500 Overall does on its own data: there every
  // suite carries the same rep count, so pooled correct/samples and the
  // per-test mean come out as the same number.
  function overallFor(pivot, model, benches) {
    const row = pivot[model] || {};
    const parts = [];
    benches.forEach((b) => {
      const r = row[b];
      if (r && r.score != null) parts.push({ bench: b, score: r.score, samples: r.samples });
    });
    if (parts.length === 0) return null;
    return {
      mean: parts.reduce((sum, p) => sum + p.score, 0) / parts.length,
      parts,
      missing: benches.filter((b) => parts.every((p) => p.bench !== b)),
    };
  }

  function overallCellHtml(o, isWinner) {
    if (o === null) return `<td class="bench-no-data bench-overall-cell">—</td>`;
    const tip =
      `Average of ${o.parts.length} benchmark${o.parts.length === 1 ? "" : "s"}, equal weight: ` +
      o.parts.map((p) => `${p.bench} ${fmtPct(p.score)}`).join(", ") +
      (o.missing.length ? ` not run: ${o.missing.join(", ")}` : "");
    return (
      `<td class="bench-overall-cell" title="${esc(tip)}">` +
      `<div class="bench-overall-score${isWinner ? " bench-winner" : ""}">${fmtPct(o.mean)}</div>` +
      `<div class="bench-overall-sub">avg of ${o.parts.length}</div></td>`
    );
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
      } else if (sortCol === ModelSize.SIZE_COL) {
        // Parameter count, read from the model name (assets/js/model-size.js).
        // Own comparator: unknown sizes must stay last in both directions.
        return ModelSize.compareBySize(a, b, sortDir);
      } else if (sortCol === OVERALL) {
        const oa = overallFor(pivot, a, benches);
        const ob = overallFor(pivot, b, benches);
        if (oa === null && ob === null) return 0;
        if (oa === null) return 1; // no score in a shown column: last either way
        if (ob === null) return -1;
        va = oa.mean;
        vb = ob.mean;
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

    // Header. The Model th carries a "params" sorter on its right edge - the
    // size sort lives inside the existing column instead of adding one.
    const arrow = (col) => (sortCol === col ? (sortDir === "asc" ? "↑" : "↓") : "↕");

    let headHtml = `<tr>
      <th class="bench-check-col"><input type="checkbox" id="benchSelectAll" ${filteredModels.length === 0 ? "disabled" : ""}></th>
      <th data-sort="model" class="sortable bench-model-th"><span class="bench-th-inner"><span>Model <span class="sort-arrow">${arrow("model")}</span></span>${ModelSize.sorterHtml(
      arrow(ModelSize.SIZE_COL),
      sortCol === ModelSize.SIZE_COL
    )}</span></th>`;

    benches.forEach((b) => {
      headHtml += `<th data-sort="${esc(b)}" class="sortable">${esc(b)} <span class="sort-arrow">${arrow(
        b
      )}</span></th>`;
    });

    // Overall closes the row, like the Word500 table. Its sub-label states the
    // scope, so the average is never mistaken for a measured score.
    headHtml += `<th data-sort="${OVERALL}" class="sortable bench-overall-th">Overall <span class="sort-arrow">${arrow(
      OVERALL
    )}</span><div class="bench-col-sub">avg of ${benches.length}</div></th>`;

    headHtml += `</tr>`;
    thead.innerHTML = headHtml;

    // Best Overall among the rows currently on screen; ties share the
    // highlight, the same rule the Word500 table applies to its columns.
    const overallMeans = filteredModels
      .map((m) => overallFor(pivot, m, benches))
      .filter((o) => o !== null)
      .map((o) => o.mean);
    const bestOverall = overallMeans.length > 1 ? Math.max(...overallMeans) : null;

    // Body
    tbody.innerHTML = filteredModels
      .map((model) => {
        const isSelected = selectedModels.has(model);
        let row = `<tr data-model="${esc(model)}">
          <td class="bench-check-col">
            <input type="checkbox" class="bench-row-cb" data-model="${esc(model)}" ${isSelected ? "checked" : ""}>
          </td>
          <td class="bench-model-name"><a href="#" class="bench-model-link" data-model="${esc(model)}">${esc(model)}</a>${ModelSize.chipHtml(
          model,
          sortCol === ModelSize.SIZE_COL
        )}</td>`;

        benches.forEach((b) => {
          const r = pivot[model] && pivot[model][b];
          if (r && r.score != null) {
            row += `<td class="bench-score">${fmtPct(r.score)}</td>`;
          } else {
            row += `<td class="bench-no-data">—</td>`;
          }
        });

        const o = overallFor(pivot, model, benches);
        row += overallCellHtml(
          o,
          bestOverall !== null && o !== null && o.mean === bestOverall
        );

        row += `</tr>`;
        return row;
      })
      .join("");

    // Sort header clicks. Scoped to th.sortable and the size sorter is bound
    // separately: it sits INSIDE the Model th, so it must not pick up this
    // handler (it has no data-sort of the kind a th carries).
    thead.querySelectorAll("th.sortable").forEach((th) => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (sortCol === col) {
          sortDir = sortDir === "asc" ? "desc" : "asc";
        } else {
          sortCol = col;
          // Overall opens best-first; measured columns keep ascending.
          sortDir = col === OVERALL ? "desc" : "asc";
        }
        rememberSort();
        renderTable();
      });
    });

    thead
      .querySelectorAll(`[data-sort="${ModelSize.SIZE_COL}"]`)
      .forEach((el) => el.addEventListener("click", sortBySize));

    updateCompareBtn();
    updateSelectAllState();
  }

  // ─── Sort by parameter count ─────────────────────────────────────────
  // Shared by the "params" sorter in the Model header and the size chip in
  // every row. The header sorter lives inside the Model th, so the click has
  // to be stopped from bubbling into that th's own sort-by-name handler.
  function sortBySize(e) {
    e.preventDefault();
    e.stopPropagation();
    if (sortCol === ModelSize.SIZE_COL) {
      sortDir = sortDir === "asc" ? "desc" : "asc";
    } else {
      sortCol = ModelSize.SIZE_COL;
      sortDir = "asc";
    }
    rememberSort();
    renderTable();
  }

  // Sorts worth remembering: the name column, the size sorter, every benchmark
  // column currently on screen, and the synthetic Overall column.
  function visibleSortColumns() {
    const shown = getAllBenchmarks().filter((b) => activeBenchmarks.has(b));
    return ["model", ModelSize.SIZE_COL].concat(shown, [OVERALL]);
  }

  function rememberSort() {
    window.BenchState.saveSort(SORT_STATE_KEY, sortCol, sortDir);
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
    // Size chip: sorting affordance that lives inside the Model cell
    if (e.target.closest(`[data-sort="${ModelSize.SIZE_COL}"]`)) {
      sortBySize(e);
      return;
    }
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
    // Size chip repeated here (display-only) so the number is readable outside
    // the table it came from. The space keeps the two read apart by assistive
    // tech rather than as one mashed-together string.
    modalTitle.innerHTML = `${esc(modelName)} ${ModelSize.chipHtml(modelName, false, true)}`;

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

    // Same equal-weight average as the pivot column, so the comparison view
    // and the main table always agree.
    const ovs = models.map((m) => overallFor(pivot, m, benches));
    const ovMeans = ovs.filter((o) => o !== null).map((o) => o.mean);
    const bestOv = ovMeans.length > 1 ? Math.max(...ovMeans) : null;
    const ovCells = ovs
      .map((o) => {
        if (o === null) return `<td class="bench-no-data">—</td>`;
        const isWinner = bestOv !== null && o.mean === bestOv;
        return (
          `<td class="${isWinner ? "bench-winner" : ""}">${fmtPct(o.mean)}` +
          `<div class="bench-col-sub">avg of ${o.parts.length}</div></td>`
        );
      })
      .join("");
    compareBody.innerHTML += `<tr class="bench-overall-row"><td>Overall<div class="bench-col-sub">equal weight, ${benches.length} columns</div></td><td>—</td>${ovCells}</tr>`;
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

  // Reopen on the sort the visitor last chose. Only columns that are actually
  // on screen qualify: a sort saved on a benchmark that has since been
  // unchecked, renamed, or dropped falls back to the default name order.
  const savedSort = window.BenchState.restoreSort(SORT_STATE_KEY, visibleSortColumns());
  if (savedSort) {
    sortCol = savedSort.col;
    sortDir = savedSort.dir;
  }

  renderTable();
})();