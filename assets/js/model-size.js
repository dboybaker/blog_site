/**
 * Benchmarks Pages - shared model size (parameter count) metadata
 *
 * Both benchmark tables (assets/js/benchmarks.js and assets/js/word500.js)
 * show a compact parameter count inside the Model column and can sort by it.
 * The count is derived from the model name whenever possible ("31B", "1.7B",
 * ...) so new entries work with no extra bookkeeping; only models whose name
 * carries no parameter count need an entry in SIZE_OVERRIDES below.
 *
 * Usage from a benchmark page script:
 *   1. Include this file before the page script (see
 *      themes/demitheme/layouts/benchmarks/list.html).
 *   2. Model cell:  ${ModelSize.chipHtml(model, sortCol === ModelSize.SIZE_COL)}
 *   3. Model header:${ModelSize.sorterHtml(arrow("size"))}  (inside the same th)
 *   4. Comparator:  if (sortCol === ModelSize.SIZE_COL)
 *                     return ModelSize.compareBySize(a, b, sortDir);
 *
 * Sizing rules (validated against every model name in assets/data/):
 *  - Names are split on "-", "_" and space ONLY. Splitting on "." would turn
 *    "Spark-X2.5-1.7B" into a bogus "7B" and "Qwen3.6-27B" into "6-27B".
 *  - A segment of the form 27B / 1.7B / 1b is the parameter count in billions.
 *    Version numbers ("Qwen3.6", "Swift-1.5", "LFM2.5") and quant tokens
 *    ("Q4_K_XL", "NVFP4", "INT4", "FP8") never match, so they can't leak in.
 *  - "E2B"/"A1B" (effective / active params) only count when the name offers no
 *    plain number, so "LFM2.5-8B-A1B" sizes as 8B total rather than 1B active.
 *  - A curated override always beats the name, so an entry can pin raw weights
 *    for an "E" model or correct a misleading name.
 *  - Anything that resolves to nothing has size null: it renders "-" and sorts
 *    last in both directions.
 */
(function () {
  "use strict";

  // Sort column id shared by both tables (kept as a constant so the header
  // markup and the comparators can never drift apart).
  const SIZE_COL = "size";

  /**
   * Curated parameter counts for models whose name has no size in it.
   *
   * Keyed by lowercase base-model slug and matched as a *substring* of the
   * normalized name (longest key wins), so every quant / engine variant of a
   * curated model inherits its size for free - e.g. "qwen3.8-flash-next" also
   * covers "Qwen3.8-Flash-Next-UD-Q4_K_XL" and "Swift-1.5-Qwen3.8-Flash-Next-NVFP4".
   *
   * A null value means "not recorded yet": the model shows "-" and sorts last,
   * so an unfinished entry here never breaks a table.
   */
  const SIZE_OVERRIDES = {
    "ling-3.0-tiny": 7.9,
    "muse-glimmer": 30,
    "qwen3.8-flash-next": 125,
    "gemma4-e2b": 5.1,
    "gemma4-e4b": 8,
  };

  // A parameter token: optional E/A prefix, a number, then B. Case-insensitive
  // so the lowercase word500 names ("qwen3.8-27b-fp8") match too.
  const SIZE_SEGMENT = /^([ae]?)(\d+(?:\.\d+)?)b$/i;

  function normalize(name) {
    return String(name == null ? "" : name).toLowerCase().replace(/[_\s]+/g, "-");
  }

  /** Parameter count in billions read from the name, or null. */
  function inferSize(name) {
    const segments = String(name == null ? "" : name).split(/[-_\s]+/);
    let best = null;
    segments.forEach((seg) => {
      const m = SIZE_SEGMENT.exec(seg);
      if (!m) return;
      const size = parseFloat(m[2]);
      if (!isFinite(size) || size <= 0) return;
      // 2 = plain total params, 1 = E/A-prefixed (effective / active).
      const rank = m[1] ? 1 : 2;
      if (!best || rank > best.rank) best = { size, rank };
    });
    return best ? best.size : null;
  }

  /** Curated parameter count for the model, or null when none is recorded. */
  function overrideSize(name) {
    const hay = normalize(name);
    let bestKey = null;
    Object.keys(SIZE_OVERRIDES).forEach((key) => {
      if (hay.indexOf(key) === -1) return;
      if (bestKey === null || key.length > bestKey.length) bestKey = key;
    });
    return bestKey === null ? null : SIZE_OVERRIDES[bestKey];
  }

  /**
   * Resolve a model name to `{ size, source }`.
   * source: "curated" | "inferred" | "unknown" (size null in the last case).
   */
  function entryFor(name) {
    const curated = overrideSize(name);
    if (curated != null) return { size: curated, source: "curated" };
    const inferred = inferSize(name);
    if (inferred != null) return { size: inferred, source: "inferred" };
    return { size: null, source: "unknown" };
  }

  function sizeOf(name) {
    return entryFor(name).size;
  }

  function sourceOf(name) {
    return entryFor(name).source;
  }

  /** "27B" / "1.7B" (trailing .0 dropped); null becomes an em dash. */
  function format(size) {
    if (size == null) return "\u2014";
    const txt =
      size < 1
        ? String(size).replace(/0+$/, "").replace(/\.$/, ".0")
        : size.toFixed(1).replace(/\.0$/, "");
    return txt + "B";
  }

  function labelFor(name) {
    return format(sizeOf(name));
  }

  function titleFor(name) {
    const e = entryFor(name);
    if (e.size == null) {
      return "No parameter count recorded - add it to assets/js/model-size.js";
    }
    return format(e.size) + " parameters" + (e.source === "inferred" ? " (from model name)" : "");
  }

  /**
   * The compact size token shown at the right edge of the Model cell. Carries
   * data-sort so clicking it (through each table's tbody delegation) sorts by
   * size. Deliberately NOT classed ".sortable": both tables bind their header
   * handler to ".sortable" and read the th's own sort attribute, which this
   * inline span does not have.
   *
   * Pass nonInteractive for uses outside a table (e.g. the model modal), where
   * the token is display-only and must not advertise a sort action.
   */
  function chipHtml(name, isActive, nonInteractive) {
    const cls =
      "model-size" +
      (isActive ? " model-size-active" : "") +
      (nonInteractive ? " model-size-static" : "");
    return (
      `<span class="${cls}"` +
      (nonInteractive ? "" : ` data-sort="${SIZE_COL}"`) +
      ` title="${escapeAttr(titleFor(name))}">${escapeHtml(labelFor(name))}</span>`
    );
  }

  /**
   * The "params" sorter shown at the right of the Model header, inside the same
   * th - this is what keeps the feature from needing an extra column. `arrow`
   * is the table's own arrow markup for the size column.
   */
  function sorterHtml(arrow, isActive) {
    return (
      `<span class="size-sorter${isActive ? " model-size-active" : ""}"` +
      ` data-sort="${SIZE_COL}" title="Sort by parameter count">` +
      `params <span class="sort-arrow">${arrow}</span></span>`
    );
  }

  /**
   * Compare two model names by parameter count. Unknown sizes always land last,
   * whichever way the table is sorted; equal sizes fall back to name order so
   * the quant variants of one model group together.
   */
  function compareBySize(a, b, dir) {
    const sa = sizeOf(a);
    const sb = sizeOf(b);
    const d = dir === "desc" ? -1 : 1;
    const byName = a.toLowerCase() < b.toLowerCase() ? -1 : 1;
    if (sa == null && sb == null) return byName;
    if (sa == null) return 1;
    if (sb == null) return -1;
    if (sa !== sb) return sa < sb ? -d : d;
    return byName;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  window.ModelSize = {
    SIZE_COL,
    SIZE_OVERRIDES,
    entryFor,
    sizeOf,
    sourceOf,
    inferSize,
    format,
    labelFor,
    titleFor,
    chipHtml,
    sorterHtml,
    compareBySize,
  };
})();

