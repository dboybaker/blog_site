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

  window.BenchState = { read, write, restoreSelection, saveSelection };
})();
