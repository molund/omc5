/** The sessionStorage key the panel's settings are kept under. */
const SAVED = "panel";

/**
 * The panel's settings (the layer switches, the view picked, whether Reset has something to do and whether Layers is
 * folded out) as they were saved, so they survive reloading the page; a new tab starts afresh.
 * @type {{ layers?: Record<string, boolean>, view?: string, changed?: boolean, layersOpen?: boolean, drawingSnap?: Record<string, boolean>|null }|null}
 * null when nothing was saved or storage is blocked.
 */
export const saved = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(SAVED));
  } catch {
    return null;
  }
})();

/**
 * Saves what `panel()` returns whenever anything it reads changes (it runs inside an effect).
 * @param {() => object} panel Returns the settings to save, as plain data.
 * @returns {void}
 */
export function autosave(panel) {
  $effect.root(() => {
    $effect(() => {
      try {
        sessionStorage.setItem(SAVED, JSON.stringify(panel()));
      } catch {
        // storage blocked (a private window, say): settings last until the page is reloaded
      }
    });
  });
}
