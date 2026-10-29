// The plan drawing lives in plan.svg. Load it into the page (rather than with <img> or <object>) so styles.css and the layer
// switches below can reach inside it.
document
  .getElementById("stage")
  .insertAdjacentHTML("beforeend", await (await fetch("plan.svg")).text());
const LAYERS = [
  [
    "Guideway",
    [
      ["guideway", "Finished concrete spans", "guideway", true],
      ["steel", "Finished steel spans", "steel-hwy15", true],
      ["unfinished", "Unfinished spans", "unfinished", true],
      ["supports", "Supports", "supports", true],
    ],
  ],
  [
    "Base",
    [
      ["aerial", "Aerial photo", "aerial", true],
      ["roads", "Roads", "roads", true],
      ["yard", "Construction yard", "yard", false],
      ["ave72", "Future 72 Ave", "ave72", false],
      ["greenbelt", "Greenbelt", "greenbelt", false],
      ["creeks", "Creeks", "creeks", false],
      ["railway", "Old railway line", "railway", false],
      ["walk", "Walking paths", "walk-paths", false],
    ],
  ],
  [
    "Gantry",
    [
      ["gantry", "Full gantry", "gantry", false],
      ["beams", "Support beams only", "gantry-beams", false],
    ],
  ],
  [
    "View",
    [
      ["sfzoom", "SFMSF zoom", "sfzoom", true],
      ["view_default", "Full", "view_default", false],
      ["progress", "Progress-chart mode", "progress", false],
      ["drawing", "Drawing mode", "drawing", false],
    ],
  ],
  [
    "Labels",
    [
      ["labels", "SFMSF span labels", "spanlabel", true],
      ["cclabels", "Clayton Clipper span labels", "cclabel", false],
      ["roadlabels", "Highway labels", "road-labels", false],
      ["arrows", "Direction arrows", "arrows", false],
    ],
  ],
  [
    "Built by",
    [
      ["cc", "Clayton Clipper", "cc", true],
      ["ll", "Langley Launcher", "ll", true],
      ["ff", "Fleetwood Flyer", "ff", true],
    ],
  ],
];
const state = {},
  defaults = {};
LAYERS.forEach((g) =>
  g[1].forEach((l) => {
    state[l[0]] = l[3];
    defaults[l[0]] = l[3];
  }),
);
// "Full" is the previous default: the whole canvas with roads and the SFMSF labels off
const fullDefaults = Object.assign({}, defaults, {
  sfzoom: false,
  roads: false,
  labels: false,
  view_default: true,
});
const rowEls = {};
// Progress-chart mode: only the aerial photo, the Clayton Clipper finished spans (concrete and steel, in bright pink), the unfinished
// sections (still white) and the Clayton Clipper span labels (black) stay visible. Everything else is hidden with visibility, which
// leaves the masks and clip paths that the drawing relies on untouched.
const PROGRESS_CSS =
  "#plan polygon,#plan path,#plan line,#plan polyline,#plan rect,#plan circle,#plan ellipse,#plan text{visibility:hidden !important}" +
  "#plan mask *,#plan clipPath *,#plan defs *{visibility:visible !important}" +
  "#plan polygon.guideway.cc:not(.unfinished){visibility:visible !important;fill:#FF2E93 !important}" +
  "#plan polygon.guideway.unfinished,#plan path.guideway.unfinished{visibility:visible !important}" +
  "#plan text.cclabel.cc{visibility:visible !important;fill:#000000 !important}";
const css = document.getElementById("layer-rules");
function apply() {
  let r = "";
  // the span-label options need Clayton Clipper spans on screen: Clayton Clipper on and at least one type of span on
  const avail =
    state.progress ||
    (state.cc && (state.guideway || state.steel || state.unfinished));
  LAYERS.forEach((g) =>
    g[1].forEach(([k, , cls]) => {
      const on =
        state[k] &&
        !((k === "greenbelt" || k === "creeks") && !state.drawing) &&
        !(k === "roads" && !state.drawing && !state.sfzoom) &&
        !(k === "aerial" && state.drawing) &&
        !((k === "labels" || k === "cclabels") && !avail) &&
        !(k === "hires" && !state.aerial);
      if (
        k === "progress" ||
        k === "drawing" ||
        k === "sfzoom" ||
        k === "view_default" ||
        (state.progress && !["aerial", "hires", "cc", "ll", "ff"].includes(k))
      )
        return;
      if (k === "bg")
        r +=
          ".bg{visibility:" +
          (on ? "visible" : "hidden") +
          " !important}" +
          (on
            ? ""
            : ".bg.hwy15,.bg.ave72,.fraser{visibility:visible !important}");
      else if (k === "roads")
        r +=
          '.roads,.fraser,.hwy15,line[class="bg"]{display:' +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "labels")
        r +=
          ".spanlabel{display:" +
          (on ? "inline" : "none") +
          " !important}" +
          (on ? "" : ".spanlabel.steel-hwy15{display:none !important}");
      else if (k === "cclabels")
        r +=
          ".cclabel{display:" +
          (on ? "inline" : "none") +
          " !important}" +
          (on ? "" : ".cclabel.steel-hwy15{display:none !important}");
      else if (k === "cc" || k === "ll" || k === "ff")
        r += on
          ? ""
          : "#plan ." + k + "." + k + "." + k + "{display:none !important}";
      else if (k === "arrows")
        r += on ? "" : "text.n.guideway{display:none !important}";
      else if (k === "gantry" || k === "beams") r += "";
      else if (k === "supports")
        r += on ? "" : 'rect.g,circle[fill="#D7D7D7"]{display:none !important}';
      else if (k === "roadlabels")
        r +=
          ".road.hwy15,.road.fraser{display:" +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "unfinished")
        r +=
          ".guideway.unfinished{display:" +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "steel")
        r +=
          ".steel-hwy15,.guideway.steel-hwy15,.spanlabel.steel-hwy15,.cclabel.steel-hwy15{display:" +
          (on ? "inline" : "none") +
          " !important}";
      else if (k === "yard")
        r += ".yard{display:" + (on ? "inline" : "none") + " !important}";
      else
        r +=
          "." + cls + "{display:" + (on ? "inline" : "none") + " !important}";
    }),
  );
  r +=
    ".gantry{display:" +
    (state.gantry || state.beams ? "inline" : "none") +
    " !important}" +
    (state.gantry || !state.beams
      ? ""
      : ".gantry-body{display:none !important}");
  if (state.progress) r += PROGRESS_CSS;
  Object.keys(rowEls).forEach((k) => {
    rowEls[k].style.opacity =
      state.progress &&
      ![
        "aerial",
        "hires",
        "cc",
        "ll",
        "ff",
        "progress",
        "drawing",
        "sfzoom",
        "view_default",
      ].includes(k)
        ? "0.4"
        : "";
    ["labels", "cclabels"].forEach((k) => {
      const c = document.getElementById("cb-" + k);
      if (c) c.disabled = !avail;
      if (rowEls[k] && !state.progress)
        rowEls[k].style.opacity = avail ? "" : "0.4";
    });
    ["greenbelt", "creeks"].forEach((k) => {
      if (rowEls[k]) rowEls[k].style.display = state.drawing ? "" : "none";
    });
    if (rowEls.roads)
      rowEls.roads.style.display = state.drawing || state.sfzoom ? "" : "none";
    if (rowEls.aerial)
      rowEls.aerial.style.display = state.drawing ? "none" : "";
    state.view_default = Object.keys(fullDefaults).every(
      (k) => k === "view_default" || state[k] === fullDefaults[k],
    );
    {
      const vd = document.getElementById("cb-view_default");
      if (vd) vd.checked = state.view_default;
    }
  });
  r +=
    'polygon.ave72[fill="#FFFFFF"]{opacity:' +
    (state.greenbelt && state.drawing ? 1 : 0) +
    " !important}";
  css.textContent = r;
}
// Launcher layers: tag every span, arrow, label, exit-track piece and support as Clayton Clipper (cc, everything west of the
// Hillcrest 184 station) or Langley Launcher (ll, the station itself and everything east). The dividing line is the centre line of
// the first station bent; an element is east of it when its centre is on that line or past it.
(function () {
  const root = document.getElementById("plan"),
    inv = root.getScreenCTM().inverse();
  const th = (122.7 * Math.PI) / 180,
    nx = Math.sin(th),
    ny = -Math.cos(th),
    P0x = 5108.7,
    P0y = 3022.6;
  function toCanvas(el, x, y) {
    const m = el.getScreenCTM();
    if (!m) return null;
    const p = root.createSVGPoint();
    p.x = x;
    p.y = y;
    return p.matrixTransform(m).matrixTransform(inv);
  }
  function tag(el, x, y) {
    if (el.classList.contains("ff")) return;
    const q = toCanvas(el, x, y);
    if (!q) return;
    el.classList.add((q.x - P0x) * nx + (q.y - P0y) * ny >= -0.5 ? "ll" : "cc");
  }
  const has = (el, re) => re.test(el.getAttribute("class") || "");
  root.querySelectorAll("polygon").forEach((el) => {
    if (!has(el, /guideway/)) return;
    const L = el.points,
      n = L.numberOfItems;
    let x = 0,
      y = 0;
    for (let i = 0; i < n; i++) {
      x += L.getItem(i).x;
      y += L.getItem(i).y;
    }
    tag(el, x / n, y / n);
  });
  root.querySelectorAll("path").forEach((el) => {
    if (!has(el, /guideway/)) return;
    const p = el.getPointAtLength(el.getTotalLength() / 2);
    tag(el, p.x, p.y);
  });
  root.querySelectorAll("text").forEach((el) => {
    if (!has(el, /guideway|spanlabel/)) return;
    tag(el, +el.getAttribute("x"), +el.getAttribute("y"));
  });
  root
    .querySelectorAll("rect.g")
    .forEach((el) =>
      tag(
        el,
        +el.getAttribute("x") + +el.getAttribute("width") / 2,
        +el.getAttribute("y") + +el.getAttribute("height") / 2,
      ),
    );
  root
    .querySelectorAll('circle[fill="#D7D7D7"]')
    .forEach((el) => tag(el, +el.getAttribute("cx"), +el.getAttribute("cy")));
})();
// Drawing mode: shrink the canvas to the first-photo frame (the area the greenbelt drawing fills), switch the aerial photo off, put the
// SFMSF labels and every other layer on, and put everything back as it was when the mode is switched off.
const FULL_VB = "-6840.7 -5402.04 12387.4 8699.48",
  DRAW_VB = "-38.4 -126.95 2188.4 1888.55",
  ZOOM_VB = "-38.4 -126.95 2188.4 1888.55"; // drawing mode and zoom view: the right edge cuts through span A
let drawingSnap = null;
function setView(vb) {
  document.getElementById("plan").setAttribute("viewBox", vb);
  const st = document.getElementById("stage");
  st.scrollLeft = 0;
  st.scrollTop = 0;
}
function syncBoxes() {
  Object.keys(state).forEach((k) => {
    const c = document.getElementById("cb-" + k);
    if (c) c.checked = !!state[k];
  });
}
function enterDrawing() {
  drawingSnap = Object.assign({}, state);
  Object.keys(state).forEach((k) => {
    state[k] = true;
  });
  state.aerial = false;
  state.cclabels = false;
  state.beams = false;
  state.progress = false;
  state.sfzoom = false;
  state.drawing = true;
  syncBoxes();
  setView(DRAW_VB);
}
function exitDrawing() {
  if (drawingSnap)
    Object.keys(drawingSnap).forEach((k) => {
      state[k] = drawingSnap[k];
    });
  state.drawing = false;
  drawingSnap = null;
  syncBoxes();
  setView(FULL_VB);
}
// SFMSF zoom: same canvas as Drawing mode, nothing else changes except that Roads goes on with it and off again when it ends
function exitZoom() {
  setLayer("sfzoom", false);
  setView(FULL_VB);
  setLayer("roads", false);
  setLayer("labels", false);
}
function applyDefaults() {
  drawingSnap = null;
  setView(defaults.sfzoom ? ZOOM_VB : FULL_VB);
  Object.keys(defaults).forEach((k) => setLayer(k, defaults[k]));
}
function applyFull() {
  drawingSnap = null;
  setView(FULL_VB);
  Object.keys(fullDefaults).forEach((k) => setLayer(k, fullDefaults[k]));
}
const box = document.getElementById("layers");
LAYERS.forEach((g) => {
  const h = document.createElement("div");
  h.className = "grp";
  h.textContent = g[0];
  box.appendChild(h);
  g[1].forEach(([k, label]) => {
    const row = document.createElement("label");
    row.className = "row";
    rowEls[k] = row;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.id = "cb-" + k;
    cb.checked = state[k];
    cb.addEventListener("change", () => {
      state[k] = cb.checked;
      if (k === "greenbelt" && cb.checked) setLayer("aerial", false);
      if (k === "aerial" && cb.checked) setLayer("greenbelt", false);
      if (k === "gantry" && cb.checked) setLayer("beams", false);
      if (k === "beams" && cb.checked) setLayer("gantry", false);
      if (k === "labels" && cb.checked) setLayer("cclabels", false);
      if (k === "cclabels" && cb.checked) setLayer("labels", false);
      if (k === "view_default") {
        applyFull();
      } else if (k === "drawing") {
        if (cb.checked) {
          if (state.sfzoom) exitZoom();
          enterDrawing();
        } else exitDrawing();
      } else if (k === "progress" && cb.checked) {
        if (state.drawing) exitDrawing();
        if (state.sfzoom) exitZoom();
        setLayer("progress", true);
      } else if (k === "sfzoom") {
        if (cb.checked) {
          if (state.drawing) exitDrawing();
          setLayer("sfzoom", true);
          setLayer("progress", false);
          setView(ZOOM_VB);
          setLayer("roads", true);
          setLayer("labels", true);
          setLayer("cclabels", false);
        } else {
          setView(FULL_VB);
          setLayer("roads", false);
          setLayer("labels", false);
        }
      }
      apply();
    });
    row.appendChild(cb);
    row.appendChild(document.createTextNode(label));
    box.appendChild(row);
  });
});
function setLayer(k, v) {
  state[k] = v;
  document.getElementById("cb-" + k).checked = v;
}
document.getElementById("all").onclick = () => {
  Object.keys(state).forEach((k) => {
    if (
      k !== "greenbelt" &&
      k !== "creeks" &&
      k !== "roads" &&
      k !== "progress" &&
      k !== "drawing" &&
      k !== "sfzoom"
    )
      setLayer(k, true);
  });
  setLayer("greenbelt", false);
  setLayer("cclabels", false);
  apply();
};
document.getElementById("reset").onclick = () => {
  applyDefaults();
  apply();
};
apply();
if (state.sfzoom) setView(ZOOM_VB);
// collapse the layer panel
const appEl = document.querySelector(".app"),
  expandBtn = document.getElementById("expand");
function setCollapsed(c) {
  appEl.classList.toggle("collapsed", c);
  expandBtn.hidden = !c;
}
document.getElementById("collapse").onclick = () => setCollapsed(true);
expandBtn.onclick = () => setCollapsed(false);
// zoom
const stage = document.getElementById("stage"),
  svg = document.getElementById("plan");
const zb = document.getElementById("zoombtns");
const PCTS = [100, 150, 200, 300];
let zoom = 100;
function setZoom(p, cx, cy) {
  p = Math.max(100, Math.min(16000, p));
  const r = stage.getBoundingClientRect();
  const x = (cx == null ? r.left + r.width / 2 : cx) - r.left,
    y = (cy == null ? r.top + r.height / 2 : cy) - r.top;
  const fx = (stage.scrollLeft + x) / stage.scrollWidth,
    fy = (stage.scrollTop + y) / stage.scrollHeight;
  zoom = p;
  svg.style.width = p + "%";
  stage.scrollLeft = fx * stage.scrollWidth - x;
  stage.scrollTop = fy * stage.scrollHeight - y;
  [...zb.children].forEach((b, i) =>
    b.classList.toggle("on", Math.abs(PCTS[i] - p) < 0.5),
  );
}
[
  ["Fit", 100],
  ["150%", 150],
  ["200%", 200],
  ["300%", 300],
].forEach(([t, p], i) => {
  const b = document.createElement("button");
  b.textContent = t;
  if (i === 0) b.classList.add("on");
  b.onclick = () => setZoom(p);
  zb.appendChild(b);
});
// touchpad pinch: Chrome, Edge and Firefox send it as ctrl+wheel; Safari sends gesture events
stage.addEventListener(
  "wheel",
  (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    // a mouse wheel notch is much bigger than a touchpad pinch event, so it gets a gentler factor
    const dy = e.deltaY * (e.deltaMode === 1 ? 16 : 1),
      k = e.metaKey && !e.ctrlKey ? 0.002 : 0.01;
    setZoom(zoom * Math.exp(-dy * k), e.clientX, e.clientY);
  },
  { passive: false },
);
let gz = 100;
stage.addEventListener("gesturestart", (e) => {
  e.preventDefault();
  gz = zoom;
});
stage.addEventListener("gesturechange", (e) => {
  e.preventDefault();
  setZoom(gz * e.scale, e.clientX, e.clientY);
});
svg.style.width = 187.31 + "%";
zoom = 187.31;
[...zb.children].forEach((b) => b.classList.remove("on"));
// drag to pan
let d = null;
stage.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch") return;
  d = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop };
  stage.classList.add("drag");
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener("pointermove", (e) => {
  if (!d) return;
  stage.scrollLeft = d.l - (e.clientX - d.x);
  stage.scrollTop = d.t - (e.clientY - d.y);
});
const end = () => {
  d = null;
  stage.classList.remove("drag");
};
stage.addEventListener("pointerup", end);
stage.addEventListener("pointercancel", end);
