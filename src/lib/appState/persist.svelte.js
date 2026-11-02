// The panel's settings (the layer switches, the view picked, whether Reset has something to do and whether Layers is folded
// out) are kept in sessionStorage, so they survive reloading the page; a new tab starts afresh
const SAVED = "panel";
export const saved = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(SAVED));
  } catch {
    return null;
  }
})();

// Save what panel() returns whenever anything it reads changes (it runs inside an effect)
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
