/**
 * Benchmarks Pages - shared UI-state persistence
 *
 * Tiny localStorage-backed helpers used by the benchmark page scripts so
 * user UI choices (e.g. which benchmark/test checkboxes are selected)
 * survive a page reload.
 *
 * Usage for the current and any future benchmark page:
 *   1. Include this file before the page's own script (see
 *      themes/demitheme/layouts/benchmarks/list.html).
 *   2. When rendering the filter checkboxes:
 *        const restored = window.BenchState.restoreSelection("page-key", availableNames);
 *      Use `restored` when it is a Set, otherwise fall back to the default
 *      (all selected).
 *   3. On every change event:
 *        window.BenchState.saveSelection("page-key", mySelectedSet);
 *   4. For a sort control (column plus direction) the same pattern, using
 *      restoreSort/saveSort so a column that has since disappeared falls back
 *      to the table default instead of sorting by something no longer shown:
 *        const saved = window.BenchState.restoreSort("page.sort", columns);
 *        if (saved) { sortCol = saved.col; sortDir = saved.dir; }
 *        # ...and on every sort change:
 *        window.BenchState.saveSort("page.sort", sortCol, sortDir);
 *
 * Keys are namespaced under "demibench." and stored as JSON. All access is
 * wrapped in try/catch so unavailable storage (private browsing, quota,
 * blocked storage) degrades gracefully to the default state.
 */
(function () {
  "use strict";

  const NS = "demibench.";

  function read(key) {
    try {
      const raw = window.localStorage.getItem(NS + key);
      return raw == null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(NS + key, JSON.stringify(value));
    } catch {
      // storage unavailable - state just won't persist
    }
  }

  /**
   * Restore a saved name selection against the names currently available.
   *
   * Returns a Set of the previously selected names that still exist, so the
   * selection follows renames/removals gracefully. A deliberately empty
   * saved selection is preserved as an empty Set. Returns null when there is
   * no saved state, or when every saved name is gone - the caller should
   * then fall back to its default (all selected).
   */
  function restoreSelection(key, availableNames) {
    const saved = read(key);
    if (!Array.isArray(saved)) return null;
    const available = new Set(availableNames);
    const kept = new Set(saved.filter((n) => available.has(n)));
    return saved.length > 0 && kept.size === 0 ? null : kept;
  }

  function saveSelection(key, names) {
    write(key, [...names]);
  }

  /**
   * Restore a saved sort choice. Returns { col, dir } only when the stored
   * column is still among `availableCols`; otherwise null, so the caller keeps
   * its own default sort. A benchmark that has been renamed or removed since
   * the visit therefore never leaves the table sorted by a missing column.
   */
  function restoreSort(key, availableCols) {
    const saved = read(key);
    if (saved === null || typeof saved !== "object") return null;
    if (typeof saved.col !== "string") return null;
    if (availableCols.indexOf(saved.col) === -1) return null;
    return { col: saved.col, dir: saved.dir === "desc" ? "desc" : "asc" };
  }

  function saveSort(key, col, dir) {
    write(key, { col: col, dir: dir });
  }

  window.BenchState = { read, write, restoreSelection, saveSelection, restoreSort, saveSort };
})();
