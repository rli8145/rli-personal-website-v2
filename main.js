/* ── Pixelmap: seeded pixel-topo terrain of the North Shore ──
   Value-noise fBm shaped by real geography: Strait of Georgia
   SW, English Bay → First Narrows → Burrard Inlet → Second
   Narrows → Port Moody Arm + Indian Arm, False Creek, the
   Fraser, Howe Sound with Bowen Island, peaks N. Vancouver is
   rendered as a street-grid dither with a dense downtown
   peninsula, Stanley Park, Point Grey, and two bridges.       */

(() => {
  "use strict";

  const SEED = 20260701;
  const PX = 7; // screen pixels per terrain cell

  // Hypsometric tints: 3 water depths, 10 land bands (low → snow)
  const WATER_HEX = ["#08262f", "#0d3540", "#16505a"];
  const LAND_HEX = [
    "#2e5c41", "#3a6c49", "#487c50", "#5a8c57", "#6f9a5f",
    "#8aa76d", "#9c9c82", "#b3ac97", "#dde5da", "#f4f9f4",
  ];
  const SHORE_HEX = "#a9b58c";
  const CITY_HEX = "#7e8c7b";

  // Survey stations — gaussian bumps guarantee summits here.
  // Fractions of the map; must match --x/--y on the .peak buttons.
  // amp is tuned so summit elevation × 1500 m ≈ the real height
  const PEAKS = [
    { x: 0.22, y: 0.24, amp: 0.23, sigma: 0.045, twin: true }, // The Lions, 1654 m
    { x: 0.44, y: 0.31, amp: 0.37, sigma: 0.050 },             // Grouse Mtn, 1224 m
    { x: 0.58, y: 0.27, amp: 0.50, sigma: 0.055 },             // Mt Seymour, 1455 m
    { x: 0.76, y: 0.40, amp: 0.16, sigma: 0.050 },             // Eagle Mtn, 1050 m
  ];

  // Water bodies as capsules (segment + radius, in map fractions)
  const CAPSULES = [
    { ax: 0.05, ay: 1.15, bx: -0.10, by: 0.45, r: 0.33, d: 1.0 },     // Strait of Georgia
    { ax: 0.10, ay: 0.52, bx: 0.00, by: 0.14, r: 0.085, d: 0.8 },     // Howe Sound
    { ax: 0.04, ay: 0.70, bx: 0.255, by: 0.66, r: 0.07, d: 0.7 },     // English Bay
    { ax: 0.265, ay: 0.610, bx: 0.325, by: 0.588, r: 0.017, d: 0.5 }, // First Narrows
    { ax: 0.325, ay: 0.598, bx: 0.555, by: 0.585, r: 0.038, d: 0.6 }, // Burrard Inlet (inner harbour)
    { ax: 0.555, ay: 0.585, bx: 0.605, by: 0.578, r: 0.019, d: 0.5 }, // Second Narrows
    { ax: 0.605, ay: 0.578, bx: 0.755, by: 0.607, r: 0.024, d: 0.5 }, // Port Moody Arm
    { ax: 0.615, ay: 0.567, bx: 0.655, by: 0.44, r: 0.028, d: 0.55 }, // Indian Arm, lower reach
    { ax: 0.655, ay: 0.44, bx: 0.642, by: 0.295, r: 0.025, d: 0.55 }, // Indian Arm, upper reach
    { ax: 0.292, ay: 0.694, bx: 0.388, by: 0.686, r: 0.018, d: 0.4 }, // False Creek
    { ax: -0.05, ay: 0.93, bx: 0.56, by: 0.93, r: 0.027, d: 0.7 },    // Fraser River, horizontal above the footer…
    { ax: 0.56, ay: 0.93, bx: 0.68, by: 1.08, r: 0.027, d: 0.7 },     // …dipping away SE at ~123.1°W
  ];

  // Land that must stay dry no matter what the water carves
  const DRY = [
    { ax: 0.294, ay: 0.652, bx: 0.303, by: 0.638, r: 0.014, e: 0.14, park: true }, // Stanley Park
    { ax: 0.296, ay: 0.650, bx: 0.318, by: 0.660, r: 0.020, e: 0.14 },             // isthmus tying the park to downtown
    { ax: 0.305, ay: 0.658, bx: 0.380, by: 0.662, r: 0.017, e: 0.13, town: true }, // downtown peninsula
    { ax: 0.130, ay: 0.740, bx: 0.220, by: 0.725, r: 0.024, e: 0.13 },             // Point Grey
    { ax: 0.052, ay: 0.455, bx: 0.070, by: 0.485, r: 0.021, e: 0.20 },             // Bowen Island
  ];

  // Bridge spans, drawn as muted pixels where they cross water;
  // slight skew matches the real crossings
  const BRIDGES = [
    { ax: 0.298, ay: 0.638, bx: 0.298, by: 0.564 }, // Lions Gate, plumb with the Stanley Park station
    { ax: 0.576, ay: 0.616, bx: 0.583, by: 0.546 }, // Second Narrows
  ];

  // Fake sheet extents for the cursor readout
  const GEO = { latN: 49.44, latS: 49.20, lonW: -123.42, lonE: -122.85 };

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ── noise ────────────────────────────────────────────────

  function hash2(ix, iy) {
    let h = (ix * 374761393 + iy * 668265263 + SEED * 69069) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function smooth(t) { return t * t * (3 - 2 * t); }

  function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = hash2(ix, iy), b = hash2(ix + 1, iy);
    const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    const u = smooth(fx), v = smooth(fy);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, y, oct) {
    let sum = 0, amp = 0.5, f = 1;
    for (let o = 0; o < oct; o++) {
      sum += amp * vnoise(x * f, y * f);
      amp *= 0.5;
      f *= 2;
    }
    return sum; // ~0..1
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1,
      ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  function sstep(e0, e1, x) {
    const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  }

  function hexRGB(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  const WATER_RGB = WATER_HEX.map(hexRGB);
  const LAND_RGB = LAND_HEX.map(hexRGB);
  const SHORE_RGB = hexRGB(SHORE_HEX);
  const CITY_RGB = hexRGB(CITY_HEX);
  const INK_RGB = hexRGB("#071a1f");
  const BRIDGE_RGB = hexRGB("#8a9184");

  // ── terrain build ────────────────────────────────────────

  const terrainCv = document.getElementById("terrain");
  const cloudCv = document.getElementById("clouds");
  const tctx = terrainCv.getContext("2d");
  const cctx = cloudCv.getContext("2d");

  let cols = 0, rows = 0, aspect = 1;
  let elevArr, bandArr, baseImg; // Float32, Int16, ImageData

  function elevation(x, y) {
    // x, y in map fractions; distances measured aspect-corrected
    const u = x * aspect, v = y;
    const relief = sstep(0.68, 0.42, y);      // mountains fade to city
    let e = Math.pow(1 - y, 1.35) * 0.64 * (0.15 + 0.85 * relief);
    e += 0.09; // lowland sits above sea
    e += (fbm(u * 4.2 + 7.3, v * 4.2 + 2.1, 5) - 0.5) * 0.58 * (0.35 + 0.65 * relief);
    // ridgelines + fine detail so contours stay busy on mid-slopes
    const ridge = Math.pow(1 - Math.abs(2 * vnoise(u * 5 + 3.7, v * 5 + 9.2) - 1), 2);
    e += relief * 0.16 * ridge;
    e += (fbm(u * 8 + 11.4, v * 8 + 5.6, 3) - 0.5) * 0.13;

    // peaks, roughened so summits aren't perfect discs; clamp the
    // aspect used here so summits stay separate on portrait screens
    const pa = Math.max(1.1, aspect);
    const rough = 0.7 + 0.6 * vnoise(u * 9 + 1.3, v * 9 + 4.8);
    for (const p of PEAKS) {
      const offs = p.twin ? [-0.016, 0.016] : [0];
      for (const o of offs) {
        const dx = (x - (p.x + o)) * pa, dy = y - p.y;
        e += p.amp * rough * Math.exp(-(dx * dx + dy * dy) / (2 * p.sigma * p.sigma));
      }
    }

    for (const c of CAPSULES) {
      const d = segDist(u, v, c.ax * aspect, c.ay, c.bx * aspect, c.by);
      e -= c.d * sstep(c.r, c.r * 0.25, d);
    }

    // parks, peninsulas, islands that must stay dry
    for (const k of DRY) {
      const kd = segDist(u, v, k.ax * aspect, k.ay, k.bx * aspect, k.by);
      if (kd < k.r) e = Math.max(e, k.e * sstep(k.r, k.r * 0.3, kd));
    }

    return e;
  }

  // Reveal index 0..12: water depths 0-2, land bands 3-12
  function bandOf(e) {
    if (e < 0) return e < -0.35 ? 0 : e < -0.12 ? 1 : 2;
    const t = Math.min(1, e / 1.2);
    return 3 + Math.min(9, Math.floor(Math.pow(t, 1.15) * 10));
  }

  function inDry(x, y, flag) {
    const u = x * aspect;
    for (const k of DRY) {
      if (flag && !k[flag]) continue;
      if (segDist(u, y, k.ax * aspect, k.ay, k.bx * aspect, k.by) < k.r) return true;
    }
    return false;
  }

  function cityMask(x, y) {
    // Vancouver proper: south shore of the inlet down to the Fraser
    const van = sstep(0.615, 0.68, y) * sstep(0.975, 0.915, y) *
                sstep(0.045, 0.13, x) * sstep(0.90, 0.75, x);
    // North Shore strip between the mountain toe and the inlet
    const ns = sstep(0.455, 0.505, y) * sstep(0.59, 0.545, y) *
               sstep(0.13, 0.20, x) * sstep(0.72, 0.62, x);
    return Math.max(van, ns);
  }

  function buildTerrain() {
    const w = innerWidth, h = innerHeight;
    cols = Math.max(40, Math.round(w / PX));
    rows = Math.max(30, Math.round(h / PX));
    aspect = cols / rows;

    terrainCv.width = cols; terrainCv.height = rows;
    cloudCv.width = cols; cloudCv.height = rows;

    elevArr = new Float32Array(cols * rows);
    bandArr = new Int16Array(cols * rows);

    for (let j = 0; j < rows; j++) {
      const y = j / rows;
      for (let i = 0; i < cols; i++) {
        const x = i / cols;
        const e = elevation(x, y);
        elevArr[j * cols + i] = e;
        bandArr[j * cols + i] = bandOf(e);
      }
    }

    baseImg = tctx.createImageData(cols, rows);
    const px = baseImg.data;

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        const b = bandArr[k];
        const x = i / cols, y = j / rows;
        let rgb;

        if (b < 3) {
          rgb = WATER_RGB[b];
        } else {
          rgb = LAND_RGB[b - 3];
          // built-up areas: plain checker dither; parks stay forest
          const cm = cityMask(x, y);
          if (b <= 5 && cm > 0 && !inDry(x, y, "park") && (i + j) % 2 === 0) {
            rgb = mix(rgb, CITY_RGB, 0.4 * cm);
          }
          if (inDry(x, y, "park")) rgb = LAND_RGB[3];
          // pale shoreline where land meets water
          if (b <= 4 && touchesWater(i, j)) rgb = mix(rgb, SHORE_RGB, 0.45);
        }

        // contour line at band boundaries
        const bR = i + 1 < cols ? bandArr[k + 1] : b;
        const bD = j + 1 < rows ? bandArr[k + cols] : b;
        if (bR !== b || bD !== b) rgb = mix(rgb, INK_RGB, 0.22);

        const o = k * 4;
        px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2]; px[o + 3] = 255;
      }
    }

    // bridge decks: one cell per row so spans stay a single pixel
    // thin, blended over the water rather than painted solid
    for (const br of BRIDGES) {
      const j0 = Math.round(br.ay * rows), j1 = Math.round(br.by * rows);
      const dir = j1 > j0 ? 1 : -1;
      const cells = [];
      for (let j = j0; j !== j1 + dir; j += dir) {
        const t = (j - j0) / (j1 - j0 || 1);
        const i = Math.round((br.ax + (br.bx - br.ax) * t) * cols);
        if (i >= 0 && j >= 0 && i < cols && j < rows) cells.push({ i, j });
      }
      const wet = cells.map(({ i, j }) => bandArr[j * cols + i] < 3);
      const first = wet.indexOf(true), last = wet.lastIndexOf(true);
      if (first === -1) continue;
      for (const { i, j } of cells.slice(Math.max(0, first - 1), last + 2)) {
        const o = (j * cols + i) * 4;
        const c = mix([px[o], px[o + 1], px[o + 2]], BRIDGE_RGB, 0.75);
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
      }
    }
  }

  function mix(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }

  function touchesWater(i, j) {
    const k = j * cols + i;
    return (i > 0 && bandArr[k - 1] < 3) || (i + 1 < cols && bandArr[k + 1] < 3) ||
           (j > 0 && bandArr[k - cols] < 3) || (j + 1 < rows && bandArr[k + cols] < 3);
  }

  // ── intro reveal: bands rise out of the water ────────────

  let introDone = false;

  function drawWithCutoff(cutoff) {
    const img = tctx.createImageData(cols, rows);
    img.data.set(baseImg.data);
    const px = img.data;
    const hid = WATER_RGB[0];
    for (let k = 0; k < cols * rows; k++) {
      if (bandArr[k] > cutoff) {
        const o = k * 4;
        px[o] = hid[0]; px[o + 1] = hid[1]; px[o + 2] = hid[2];
      }
    }
    tctx.putImageData(img, 0, 0);
  }

  function intro() {
    if (reduceMotion) {
      tctx.putImageData(baseImg, 0, 0);
      introDone = true;
      return;
    }
    const t0 = performance.now(), dur = 1300;
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      drawWithCutoff(Math.floor(t * 13));
      if (t < 1) requestAnimationFrame(step);
      else { tctx.putImageData(baseImg, 0, 0); introDone = true; }
    })(t0);
  }

  // ── drifting cloud shadows ───────────────────────────────

  let lastCloud = 0;

  function clouds(now) {
    requestAnimationFrame(clouds);
    if (!introDone || now - lastCloud < 40) return; // ~25 fps
    lastCloud = now;
    const t = now * 0.000008;
    const img = cctx.createImageData(cols, rows);
    const px = img.data;
    for (let j = 0; j < rows; j++) {
      const v = j / rows;
      for (let i = 0; i < cols; i++) {
        const u = (i / cols) * aspect;
        const n = fbm(u * 1.6 + t * 90, v * 1.6 + t * 55, 3);
        if (n > 0.56) {
          const o = (j * cols + i) * 4;
          px[o + 3] = Math.min(60, (n - 0.56) * 430);
        }
      }
    }
    cctx.putImageData(img, 0, 0);
  }

  // ── cursor readout ───────────────────────────────────────

  const map = document.getElementById("map");
  const roCoords = document.getElementById("ro-coords");
  const roElev = document.getElementById("ro-elev");

  map.addEventListener("pointermove", (ev) => {
    const fx = ev.clientX / innerWidth, fy = ev.clientY / innerHeight;
    const lat = GEO.latN - fy * (GEO.latN - GEO.latS);
    const lon = -(GEO.lonW + fx * (GEO.lonE - GEO.lonW));
    roCoords.textContent = `${lat.toFixed(2)}°N ${lon.toFixed(2)}°W`;

    const i = Math.min(cols - 1, Math.floor(fx * cols));
    const j = Math.min(rows - 1, Math.floor(fy * rows));
    const e = elevArr[j * cols + i];
    roElev.textContent = `EL ${Math.max(0, Math.round((e * 1500) / 10) * 10)} M`;
  });

  // ── drawer ───────────────────────────────────────────────

  const drawer = document.getElementById("drawer");
  const drawerTitle = document.getElementById("drawer-title");
  const drawerClose = document.getElementById("drawer-close");
  const panels = drawer.querySelectorAll(".panel");
  const peakBtns = document.querySelectorAll(".peak");
  let openBtn = null;

  function openDrawer(btn, focus = true) {
    const id = btn.dataset.panel;
    panels.forEach((p) => p.classList.toggle("active", p.dataset.panel === id));
    drawerTitle.textContent = btn.querySelector(".peak-role").textContent;

    peakBtns.forEach((b) => b.setAttribute("aria-expanded", b === btn ? "true" : "false"));
    drawer.hidden = false;
    drawer.scrollTop = 0;
    requestAnimationFrame(() => drawer.classList.add("open"));
    openBtn = btn;
    if (focus) drawerClose.focus();
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    peakBtns.forEach((b) => b.setAttribute("aria-expanded", "false"));
    const btn = openBtn;
    openBtn = null;
    setTimeout(() => { if (!openBtn) drawer.hidden = true; }, 240);
    if (btn) btn.focus();
  }

  peakBtns.forEach((btn, idx) => {
    btn.style.setProperty("--in-delay", `${1.4 + idx * 0.12}s`);
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (openBtn === btn) { closeDrawer(); return; }
      if (reduceMotion) {
        setJourney([STATION_NODES[idx]], null);
        walkDist = 0;
        standingIdx = idx;
        renderWalker(0);
        openDrawer(btn);
        return;
      }
      if (openBtn) closeDrawer();
      sendHiker(btn, idx); // drawer opens when the hiker arrives
    });
  });

  drawerClose.addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (ev) => ev.stopPropagation());
  map.addEventListener("click", () => { if (openBtn) closeDrawer(); });
  addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && openBtn) closeDrawer();
  });

  // ── trail + walker ───────────────────────────────────────
  // A trail network linking the stations, walked by a tiny pixel
  // hiker who picks a sensible route for each trip: ridge trails
  // between summits, and descents to whichever bridge suits.

  const trailSvg = document.getElementById("trail");
  const hikerSvg = document.getElementById("hiker");
  const SVG_NS = "http://www.w3.org/2000/svg";
  const WALK_U = 2.6;        // walker scale: sprite units → px
  const NAV_MIN_SPEED = 210; // px/s when sent to a station…
  const NAV_MAX_MS = 1700;   // …but never longer than this
  const HOME_STATION = 4;    // Stanley Park · About Me

  // Trail network (map fractions). Nodes are the five stations
  // plus junctions at the bridge heads, so the hiker can route
  // over the Lions Gate or the Second Narrows, whichever suits
  // the trip. Every edge stays on land; `straight` marks bridge
  // decks, walked as straight runs exactly on the drawn spans.
  const NODES = {
    lions:   [0.22, 0.24],
    grouse:  [0.44, 0.31],
    seymour: [0.58, 0.27],
    eagle:   [0.76, 0.40],
    stanley: [0.298, 0.645],
    lgn:     [0.298, 0.534], // Lions Gate, north approach
    sns:     [0.576, 0.616], // Second Narrows, south end
    snn:     [0.583, 0.546], // Second Narrows, north end
  };
  // node per .peak button (DOM order)
  const STATION_NODES = ["lions", "grouse", "seymour", "eagle", "stanley"];

  const EDGES = [
    { a: "lions", b: "grouse", via: [[0.295, 0.305], [0.365, 0.33]] }, // ridge
    { a: "grouse", b: "seymour", via: [[0.505, 0.32]] },               // ridge
    { a: "seymour", b: "eagle",  // around the head of Indian Arm
      via: [[0.625, 0.262], [0.663, 0.218], [0.705, 0.27]] },
    { a: "eagle", b: "sns",      // around Port Moody Arm, along the south shore
      via: [[0.80, 0.52], [0.805, 0.60], [0.785, 0.655], [0.70, 0.662], [0.615, 0.648]] },
    { a: "sns", b: "stanley",    // waterfront, through downtown
      via: [[0.53, 0.66], [0.47, 0.655], [0.375, 0.657]] },
    { a: "sns", b: "snn", straight: true, via: [] },                   // Second Narrows bridge
    { a: "snn", b: "seymour", via: [[0.592, 0.47], [0.60, 0.38]] },    // down the Seymour slope
    { a: "stanley", b: "lgn", straight: true,
      via: [[0.298, 0.601], [0.298, 0.564]] },                         // Lions Gate bridge
    { a: "lgn", b: "lions", via: [[0.26, 0.50], [0.225, 0.42]] },      // up through West Van
    { a: "lgn", b: "grouse", via: [[0.335, 0.475], [0.40, 0.40]] },    // down Capilano
  ];

  function edgeLen(e) {
    const pts = [NODES[e.a], ...e.via, NODES[e.b]];
    let L = 0;
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot((pts[i][0] - pts[i - 1][0]) * innerWidth,
                      (pts[i][1] - pts[i - 1][1]) * innerHeight);
    }
    return L;
  }

  // Shortest route between two nodes (Dijkstra over the tiny
  // graph). Passing over another station's summit en route is
  // penalized, so e.g. Seymour → Stanley descends to the Second
  // Narrows instead of climbing over Grouse, but a real traverse
  // like Lions → Eagle still walks the ridge.
  function findRoute(from, to) {
    const passPenalty = 0.1 * (innerWidth + innerHeight);
    const dist = { [from]: 0 }, prev = {}, done = new Set();
    for (;;) {
      let u = null;
      for (const k in dist) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
      if (u === null || u === to) break;
      done.add(u);
      for (const e of EDGES) {
        if (e.a !== u && e.b !== u) continue;
        const v = e.a === u ? e.b : e.a;
        const hop = STATION_NODES.includes(v) && v !== to ? passPenalty : 0;
        const alt = dist[u] + edgeLen(e) + hop;
        if (!(v in dist) || alt < dist[v]) { dist[v] = alt; prev[v] = u; }
      }
    }
    const nodes = [to];
    while (nodes[0] !== from) nodes.unshift(prev[nodes[0]]);
    return { nodes, len: dist[to] };
  }

  function svgRects(parts) {
    // parts: [[fill, [[x, y, w, h], …]], …]
    const g = document.createElementNS(SVG_NS, "g");
    for (const [fill, rects] of parts) {
      for (const [x, y, w, h] of rects) {
        const r = document.createElementNS(SVG_NS, "rect");
        r.setAttribute("x", x); r.setAttribute("y", y);
        r.setAttribute("width", w); r.setAttribute("height", h);
        r.setAttribute("fill", fill);
        g.appendChild(r);
      }
    }
    return g;
  }

  // pixel hiker: feet at the origin, facing right
  const SKIN = "#e6b08a", HAIR = "#181818", COAT = "#3272b8",
        PANT = "#3c4050", BOOT = "#241d18", PACK = "#f2762e";
  const walker = document.createElementNS(SVG_NS, "g");
  walker.setAttribute("class", "walker");
  walker.setAttribute("shape-rendering", "crispEdges");
  const walkerBody = svgRects([
    [PACK, [[-2, -9, 1, 3]]],               // backpack
    [COAT, [[-1, -9, 2, 4], [1, -8, 1, 2]]], // jacket + front arm
    [SKIN, [[-1, -11, 2, 2], [1, -6, 1, 1]]], // face + hand
    [HAIR, [[-1, -12, 2, 1], [-1, -11, 1, 1]]], // hair top + back of head
  ]);
  const legsStand = svgRects([
    [PANT, [[-1, -5, 1, 4], [0, -5, 1, 4]]],
    [BOOT, [[-1, -1, 1, 1], [0, -1, 1, 1]]],
  ]);
  const legsStride = svgRects([
    [PANT, [[-2, -5, 1, 4], [1, -5, 1, 4]]],
    [BOOT, [[-2, -1, 1, 1], [1, -1, 1, 1]]],
  ]);
  walker.append(walkerBody, legsStand, legsStride);

  const trailPath = document.createElementNS(SVG_NS, "path");
  trailPath.setAttribute("class", "trail-line");
  const measurePath = document.createElementNS(SVG_NS, "path");
  measurePath.setAttribute("visibility", "hidden");
  trailSvg.append(trailPath, measurePath);
  hikerSvg.append(walker);

  let trailLen = 0;
  let walkDist = 0, facing = 1, lastWalk = 0;
  const JUMP_MS = 460, JUMP_H = 7; // arrival hop: big bounce + settle
  let jumpT0 = -1;
  let navTarget = null, navSpeed = NAV_MIN_SPEED, navRemaining = 0; // {btn, idx}
  let standingIdx = HOME_STATION;

  // current journey, kept in map fractions so it survives resize
  let routeNodes = [STATION_NODES[HOME_STATION]];
  let pathPts = [NODES[STATION_NODES[HOME_STATION]]], pathFlags = [false];
  let routeWpIdx = [0];  // waypoint index of each route node
  let nodeBreaks = [0];  // arc length at each route node

  function rebuildPath() {
    const w = innerWidth, h = innerHeight;
    const pts = pathPts.map(([x, y]) => [x * w, y * h]);
    const N = pts.length;
    // open Catmull-Rom through the waypoints; consecutive flagged
    // waypoints (bridge decks) are joined with straight lines
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    const dAt = [d]; // path prefix ending at each waypoint
    for (let n = 0; n + 1 < N; n++) {
      const p1 = pts[n], p2 = pts[n + 1];
      if (pathFlags[n] && pathFlags[n + 1]) {
        d += ` L ${p2[0]} ${p2[1]}`;
      } else {
        const p0 = pts[Math.max(0, n - 1)], p3 = pts[Math.min(N - 1, n + 2)];
        d += ` C ${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6}` +
             ` ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6}` +
             ` ${p2[0]} ${p2[1]}`;
      }
      dAt.push(d);
    }
    if (N === 1) d += ` L ${pts[0][0]} ${pts[0][1]}`; // standing still
    trailPath.setAttribute("d", d);
    trailLen = trailPath.getTotalLength();
    nodeBreaks = routeWpIdx.map((i) => {
      measurePath.setAttribute("d", dAt[i]);
      return measurePath.getTotalLength();
    });
  }

  // Assemble the journey path: an optional off-node start point
  // (rerouted mid-walk), then the route's edges strung together
  function setJourney(nodes, prefix) {
    routeNodes = nodes;
    pathPts = []; pathFlags = []; routeWpIdx = [];
    if (prefix) { pathPts.push(prefix); pathFlags.push(false); }
    pathPts.push(NODES[nodes[0]]); pathFlags.push(false);
    routeWpIdx.push(pathPts.length - 1);
    for (let i = 0; i + 1 < nodes.length; i++) {
      const A = nodes[i], B = nodes[i + 1];
      const e = EDGES.find((g) => (g.a === A && g.b === B) || (g.a === B && g.b === A));
      const via = e.a === A ? e.via : e.via.slice().reverse();
      if (e.straight) pathFlags[pathFlags.length - 1] = true;
      for (const p of via) { pathPts.push(p); pathFlags.push(!!e.straight); }
      pathPts.push(NODES[B]); pathFlags.push(!!e.straight);
      routeWpIdx.push(pathPts.length - 1);
    }
    rebuildPath();
  }

  function buildTrail() {
    trailSvg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    hikerSvg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    const frac = trailLen > 0 ? walkDist / trailLen : 0;
    rebuildPath(); // same fractions, new pixel geometry
    walkDist = frac * trailLen;
    if (navTarget) {
      navRemaining = trailLen - walkDist;
      navSpeed = Math.max(NAV_MIN_SPEED, navRemaining / (NAV_MAX_MS / 1000));
    }
    renderWalker(0);
  }

  function renderWalker(now) {
    let jumpY = 0;
    if (jumpT0 >= 0) {
      const t = (now - jumpT0) / JUMP_MS;
      if (t >= 1) jumpT0 = -1;
      else if (t > 0) {
        // two hops: full-height bounce, then a small settle bounce
        const h = t < 0.62
          ? Math.sin((Math.PI * t) / 0.62) * JUMP_H
          : Math.sin((Math.PI * (t - 0.62)) / 0.38) * JUMP_H * 0.35;
        jumpY = Math.round(h) * WALK_U; // whole sprite pixels
      }
    }
    const striding =
      jumpY > 0 || (navTarget && Math.floor(now / 75) % 2 === 0);
    legsStride.setAttribute("visibility", striding ? "visible" : "hidden");
    legsStand.setAttribute("visibility", striding ? "hidden" : "visible");
    const p = trailPath.getPointAtLength(walkDist);
    walker.setAttribute("transform",
      `translate(${p.x} ${p.y - jumpY}) scale(${facing * WALK_U} ${WALK_U})`);
  }

  // Click-to-navigate: route the hiker along the trail network,
  // press the summit marker on arrival, then open its field
  // report. The hiker stands at a station otherwise.
  function sendHiker(btn, idx) {
    const target = STATION_NODES[idx];
    let nodes, prefix = null;
    if (navTarget && trailLen > 0) {
      // rerouted mid-walk: set off from right here, via whichever
      // adjacent route node gives the shorter overall trip
      const p = trailPath.getPointAtLength(walkDist);
      prefix = [p.x / innerWidth, p.y / innerHeight];
      let k = 0;
      while (k + 1 < nodeBreaks.length && nodeBreaks[k + 1] <= walkDist) k++;
      const back = routeNodes[k];
      const ahead = routeNodes[Math.min(k + 1, routeNodes.length - 1)];
      let best = null;
      for (const c of back === ahead ? [back] : [back, ahead]) {
        const r = findRoute(c, target);
        const lead = Math.hypot((NODES[c][0] - prefix[0]) * innerWidth,
                                (NODES[c][1] - prefix[1]) * innerHeight);
        if (!best || lead + r.len < best.cost) {
          best = { cost: lead + r.len, nodes: r.nodes };
        }
      }
      nodes = best.nodes;
    } else {
      nodes = findRoute(STATION_NODES[standingIdx], target).nodes;
    }
    // face toward the destination for the whole trip, ignoring
    // local wiggles in the trail (net screen direction of the leg)
    const fromX = prefix ? prefix[0] : NODES[nodes[0]][0];
    const dx = (NODES[target][0] - fromX) * innerWidth;
    if (Math.abs(dx) > 1) facing = dx > 0 ? 1 : -1;
    setJourney(nodes, prefix);
    walkDist = 0;
    navSpeed = Math.max(NAV_MIN_SPEED, trailLen / (NAV_MAX_MS / 1000));
    navRemaining = trailLen;
    navTarget = { btn, idx };
    jumpT0 = -1; // re-routed mid-hop: back to walking
  }

  function arrive(now) {
    const btn = navTarget.btn;
    standingIdx = navTarget.idx;
    navTarget = null;
    jumpT0 = now; // celebratory hop at the summit
    btn.classList.add("pressed");
    setTimeout(() => {
      btn.classList.remove("pressed");
      if (!navTarget) openDrawer(btn); // unless re-routed meanwhile
    }, 280);
  }

  function walk(now) {
    requestAnimationFrame(walk);
    if (!introDone) { lastWalk = now; return; }
    const dt = Math.min(64, now - lastWalk);
    lastWalk = now;
    if (navTarget) {
      const step = (navSpeed * dt) / 1000;
      if (step >= navRemaining) {
        walkDist = trailLen;
        arrive(now);
      } else {
        navRemaining -= step;
        walkDist += step;
      }
    }
    renderWalker(now);
  }

  // ── scale bar ────────────────────────────────────────────
  // Size the four 500 m segments from the sheet's true extents

  function updateScale() {
    const midLat = ((GEO.latN + GEO.latS) / 2) * Math.PI / 180;
    const kmWide = (GEO.lonE - GEO.lonW) * 111.32 * Math.cos(midLat);
    const segPx = (0.5 * innerWidth) / kmWide;
    document.documentElement.style.setProperty("--seg-px", `${segPx.toFixed(1)}px`);
  }

  // ── boot ─────────────────────────────────────────────────

  buildTerrain();
  buildTrail(); // parks the hiker at Stanley Park (About Me)
  updateScale();
  intro();
  if (!reduceMotion) {
    requestAnimationFrame(clouds);
    requestAnimationFrame(walk);
  }

  // About Me field report pops up once the sheet has settled
  const aboutBtn = document.querySelector('.peak[data-panel="about"]');
  if (reduceMotion) openDrawer(aboutBtn, false);
  else setTimeout(() => { if (!openBtn && !navTarget) openDrawer(aboutBtn, false); }, 1700);

  let resizeT;
  addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      buildTerrain();
      tctx.putImageData(baseImg, 0, 0);
      buildTrail();
      updateScale();
    }, 180);
  });
})();
