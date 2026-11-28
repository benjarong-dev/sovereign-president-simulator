import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  GRID_SIZE,
  getRailNetwork,
  getRoadLaneCount,
  getRoadNetwork,
  getTileInfoMetric,
  getTrafficSignalPhase,
  inBounds,
  isRoadTileType,
} from "../simulation/policyEngine.js";

const BRIDGE_DECK_Y = 0.20;
const BTS_VIADUCT_Y = 0.62;

function scoreToHeatmapColor(score) {
  const c = new THREE.Color();
  c.setHSL(0.34 * Math.max(0, Math.min(1, score)), 0.86, 0.47);
  return c;
}

/**
 * Generate procedural asphalt texture scaled to 2, 4, 6, or 10 lanes (plus embedded tram rails if needed).
 */
function makeMultiLaneRoadTexture(lanes, mask, { isBridge = false, hasTram = false } = {}) {
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d");

  ctx.fillStyle = isBridge ? "#cbd5e1" : "#94a3b8";
  ctx.fillRect(0, 0, 128, 128);

  // Wider asphalt width as lane count increases from 2 -> 10 lanes!
  const marginByLanes = { 2: 20, 4: 14, 6: 9, 10: 4 };
  const m = marginByLanes[lanes] ?? 16;
  const w = 128 - m * 2;

  ctx.fillStyle = lanes >= 10 ? "#111827" : "#1f2937";
  ctx.fillRect(m, m, w, w);

  const n = (mask & 1) !== 0;
  const e = (mask & 2) !== 0;
  const s = (mask & 4) !== 0;
  const west = (mask & 8) !== 0;

  if (n) ctx.fillRect(m, 0, w, m + 2);
  if (s) ctx.fillRect(m, 128 - m - 2, w, m + 2);
  if (e) ctx.fillRect(128 - m - 2, m, m + 2, w);
  if (west) ctx.fillRect(0, m, m + 2, w);

  const halfSideLanes = Math.max(1, Math.floor(lanes / 2));
  const halfW = w / 2;

  // Draw multi-lane white dashed lane dividers on each side of road
  ctx.strokeStyle = "rgba(248, 250, 252, 0.65)";
  ctx.lineWidth = lanes >= 10 ? 1.5 : 2;
  ctx.setLineDash([6, 6]);

  for (let l = 1; l < halfSideLanes; l += 1) {
    const offsetPx = (l / halfSideLanes) * (halfW - 3);
    for (const sign of [-1, 1]) {
      const pos = 64 + sign * offsetPx;
      if (n) { ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, m + 4); ctx.stroke(); }
      if (s) { ctx.beginPath(); ctx.moveTo(pos, 124 - m); ctx.lineTo(pos, 128); ctx.stroke(); }
      if (n && s && !e && !west) { ctx.beginPath(); ctx.moveTo(pos, 0); ctx.lineTo(pos, 128); ctx.stroke(); }
      if (west) { ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(m + 4, pos); ctx.stroke(); }
      if (e) { ctx.beginPath(); ctx.moveTo(124 - m, pos); ctx.lineTo(128, pos); ctx.stroke(); }
      if (e && west && !n && !s) { ctx.beginPath(); ctx.moveTo(0, pos); ctx.lineTo(128, pos); ctx.stroke(); }
    }
  }

  // Center Median (green boulevard strip for 6L, concrete jersey barrier for 10L, double yellow for 2L/4L)
  ctx.setLineDash([]);
  if (lanes >= 6 && ((n && s && !e && !west) || (e && west && !n && !s))) {
    ctx.fillStyle = lanes >= 10 ? "#fbbf24" : "#22c55e";
    if (n && s) ctx.fillRect(61, 0, 6, 128);
    else ctx.fillRect(0, 61, 128, 6);
  } else {
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = lanes >= 4 ? 3.5 : 2.5;
    ctx.setLineDash(lanes === 2 ? [8, 6] : []);
    if (n) { ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 48); ctx.stroke(); }
    if (s) { ctx.beginPath(); ctx.moveTo(64, 80); ctx.lineTo(64, 128); ctx.stroke(); }
    if (west) { ctx.beginPath(); ctx.moveTo(0, 64); ctx.lineTo(48, 64); ctx.stroke(); }
    if (e) { ctx.beginPath(); ctx.moveTo(80, 64); ctx.lineTo(128, 64); ctx.stroke(); }
  }

  // Embedded silver streetcar tram rails
  if (hasTram) {
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    for (const rOff of [-8, 8]) {
      if (n || s || (!e && !west)) {
        ctx.beginPath(); ctx.moveTo(64 + rOff, 0); ctx.lineTo(64 + rOff, 128); ctx.stroke();
      }
      if (e || west) {
        ctx.beginPath(); ctx.moveTo(0, 64 + rOff); ctx.lineTo(128, 64 + rOff); ctx.stroke();
      }
    }
  }

  const degree = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (west ? 1 : 0);
  if (degree >= 3) {
    ctx.fillStyle = "#f8fafc";
    for (let k = m + 4; k <= 128 - m - 8; k += 10) {
      if (n) ctx.fillRect(k, Math.max(2, m - 2), 5, 9);
      if (s) ctx.fillRect(k, Math.min(117, 128 - m - 7), 5, 9);
      if (west) ctx.fillRect(Math.max(2, m - 2), k, 9, 5);
      if (e) ctx.fillRect(Math.min(117, 128 - m - 7), k, 9, 5);
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWindowFacadeTextures(wallHex, accentHex, litWindowHex) {
  const colorCv = document.createElement("canvas");
  const emisCv = document.createElement("canvas");
  colorCv.width = 128;
  colorCv.height = 256;
  emisCv.width = 128;
  emisCv.height = 256;

  const cCtx = colorCv.getContext("2d");
  const eCtx = emisCv.getContext("2d");

  cCtx.fillStyle = wallHex;
  cCtx.fillRect(0, 0, 128, 256);
  cCtx.fillStyle = accentHex;
  for (let band = 0; band < 256; band += 32) cCtx.fillRect(0, band, 128, 4);

  eCtx.fillStyle = "#000000";
  eCtx.fillRect(0, 0, 128, 256);

  for (let row = 10; row < 244; row += 22) {
    for (let col = 12; col < 112; col += 20) {
      const isLit = ((row * 7 + col * 13) % 11) > 2;
      cCtx.fillStyle = isLit ? litWindowHex : "#1e293b";
      cCtx.fillRect(col, row, 12, 13);
      if (isLit) {
        eCtx.fillStyle = litWindowHex;
        eCtx.fillRect(col, row, 12, 13);
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCv);
  map.colorSpace = THREE.SRGBColorSpace;
  const emissiveMap = new THREE.CanvasTexture(emisCv);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  return { map, emissiveMap };
}

function makePitchTexture() {
  const cv = document.createElement("canvas");
  cv.width = 256;
  cv.height = 160;
  const ctx = cv.getContext("2d");

  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? "#16a34a" : "#15803d";
    ctx.fillRect(i * 32, 0, 32, 160);
  }
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 12, 228, 136);
  ctx.beginPath();
  ctx.moveTo(128, 12);
  ctx.lineTo(128, 148);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 80, 24, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(14, 44, 34, 72);
  ctx.strokeRect(208, 44, 34, 72);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildVehicleMesh(vehicleClass, bodyColorHex) {
  const group = new THREE.Group();
  const wheelGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.022, 8);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbae6fd,
    emissive: new THREE.Color(0x38bdf8),
    emissiveIntensity: 0.55,
  });

  if (vehicleClass === "BTS_SKYTRAIN") {
    // 3-Car Articulated White/Cyan/Blue BTS Skytrain Consist
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.25, metalness: 0.2 });
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    for (const cz of [-0.28, 0, 0.28]) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.25), shellMat);
      car.position.set(0, 0.07, cz);
      car.castShadow = true;
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.165, 0.035, 0.24), stripeMat);
      band.position.set(0, 0.055, cz);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.168, 0.036, 0.21), glassMat);
      win.position.set(0, 0.09, cz);
      group.add(car, band, win);
    }
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.024, 0.015), headlightMat);
    hl.position.set(0, 0.05, 0.41);
    group.add(hl);
    return group;
  }

  if (vehicleClass === "HEAVY_TRAIN") {
    // Red/Silver Intercity Express Train (Locomotive + 2 Coaches)
    const locoMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.45, roughness: 0.3 });
    for (const [idx, cz] of [[0, 0.28], [1, 0], [2, -0.28]]) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.13, 0.25), idx === 0 ? locoMat : silverMat);
      car.position.set(0, 0.075, cz);
      car.castShadow = true;
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.175, 0.038, 0.2), glassMat);
      win.position.set(0, 0.095, cz);
      group.add(car, win);
    }
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.026, 0.015), headlightMat);
    hl.position.set(0, 0.06, 0.41);
    group.add(hl);
    return group;
  }

  if (vehicleClass === "STREET_TRAM") {
    // Green & White Low-Floor Light Rail Tram
    const tramMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3 });
    for (const cz of [-0.14, 0.14]) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.115, 0.25), tramMat);
      seg.position.set(0, 0.07, cz);
      seg.castShadow = true;
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.045, 0.21), glassMat);
      win.position.set(0, 0.09, cz);
      group.add(seg, win);
    }
    return group;
  }

  if (vehicleClass === "CITY_BUS") {
    const busMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.12, 0.38), busMat);
    hull.position.y = 0.08;
    hull.castShadow = true;
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.045, 0.32), glassMat);
    windows.position.y = 0.1;
    group.add(hull, windows);
    for (const [wx, wz] of [[-0.07, -0.11], [0.07, -0.11], [-0.07, 0.11], [0.07, 0.11]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.026, wz);
      group.add(w);
    }
    return group;
  }

  if (vehicleClass === "CARGO_TRUCK") {
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(0.135, 0.11, 0.11),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b })
    );
    cab.position.set(0, 0.075, 0.11);
    cab.castShadow = true;
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(0.145, 0.14, 0.21),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0 })
    );
    cargo.position.set(0, 0.09, -0.07);
    cargo.castShadow = true;
    group.add(cab, cargo);
    return group;
  }

  // Passenger Sedan
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColorHex, roughness: 0.3, metalness: 0.25 });
  const lowerHull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.24), bodyMat);
  lowerHull.position.y = 0.044;
  lowerHull.castShadow = true;
  const cabinRoof = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.044, 0.12), bodyMat);
  cabinRoof.position.set(0, 0.086, -0.01);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.035, 0.105), glassMat);
  windows.position.set(0, 0.084, -0.01);
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.012), headlightMat);
  hl.position.set(0, 0.045, 0.122);
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.015, 0.012), taillightMat);
  tl.position.set(0, 0.045, -0.122);
  group.add(lowerHull, cabinRoof, windows, hl, tl);
  return group;
}

/**
 * Build animated 3D pedestrian figure (body + head) walking along city sidewalks & crosswalks.
 */
function buildPedestrianMesh(shirtHex) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.026, 0.085, 6),
    new THREE.MeshStandardMaterial({ color: shirtHex })
  );
  body.position.y = 0.045;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0xfde68a })
  );
  head.position.y = 0.105;
  g.add(body, head);
  return g;
}

export function createCityScene(container, { onTileAction, onTileHover } = {}) {
  let currentState = null;
  let activeBiomeSignature = "";
  let viewMode = "NONE";
  let lightingMode = "DAY";
  let isLeftDragging = false;
  let isSpaceHeld = false;
  let lastPaintedKey = "";

  const vehicles = [];
  const railTrains = [];
  const pedestrians = [];
  let roadCache = [];
  let railCaches = { BTS_TRACK: [], RAIL_TRACK: [], TRAM_TRACK: [] };

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") isSpaceHeld = true;
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") isSpaceHeld = false;
  });

  function roadSurfaceY(roadNode) {
    return roadNode.isBridge ? BRIDGE_DECK_Y : roadNode.elevation;
  }

  function syncAgents(state) {
    roadCache = getRoadNetwork(state);
    railCaches = {
      BTS_TRACK: getRailNetwork(state, "BTS_TRACK"),
      RAIL_TRACK: getRailNetwork(state, "RAIL_TRACK"),
      TRAM_TRACK: getRailNetwork(state, "TRAM_TRACK"),
    };

    // 1. Road Vehicles (distributed across multi-lane sub-lanes!)
    if (roadCache.length === 0) {
      vehicles.length = 0;
      pedestrians.length = 0;
    } else {
      const busCount = Math.min(8, (state.metrics.transitLines ?? 0) * 2);
      const truckCount = Math.min(8, Math.ceil((state.metrics.industrialJobs ?? 0) / 55));
      const sedanCount = Math.min(24, Math.max(5, Math.floor((state.metrics.population + state.metrics.commercialJobs) / 42)));
      const specs = [];
      for (let i = 0; i < busCount; i += 1) specs.push({ kind: "CITY_BUS", speed: 1.32, color: 0x0284c7, subLane: 0 });
      for (let i = 0; i < truckCount; i += 1) specs.push({ kind: "CARGO_TRUCK", speed: 1.22, color: 0xf59e0b, subLane: 0 });
      const colors = [0xf8fafc, 0xef4444, 0x38bdf8, 0xfacc15, 0xa855f7, 0x4ade80];
      for (let i = 0; i < sedanCount; i += 1) {
        specs.push({ kind: "SEDAN", speed: 1.85 + (i % 3) * 0.15, color: colors[i % colors.length], subLane: i % 3 });
      }

      while (vehicles.length > specs.length) vehicles.pop();
      for (let i = 0; i < specs.length; i += 1) {
        const sp = specs[i];
        if (!vehicles[i]) {
          const sn = roadCache[(i * 3) % roadCache.length];
          const nn = sn.neighbors[i % Math.max(1, sn.neighbors.length)] ?? sn;
          vehicles.push({
            kind: sp.kind,
            speed: sp.speed,
            color: sp.color,
            subLane: sp.subLane,
            fromX: sn.x,
            fromY: sn.y,
            toX: nn.x,
            toY: nn.y,
            t: (i * 0.23) % 0.85,
            dwellTimer: 0,
          });
        } else if (vehicles[i].kind !== sp.kind) {
          Object.assign(vehicles[i], sp, { dirtyMesh: true });
        }
      }

      // 2. Sidewalk Pedestrians
      const pedTarget = state.metrics.pedestrianCount ?? 12;
      const shirtPalette = [0x38bdf8, 0xf43f5e, 0xfacc15, 0x22c55e, 0xa855f7, 0xf8fafc];
      while (pedestrians.length > pedTarget) pedestrians.pop();
      while (pedestrians.length < pedTarget) {
        const idx = pedestrians.length;
        const sn = roadCache[(idx * 5) % roadCache.length];
        const nn = sn.neighbors[idx % Math.max(1, sn.neighbors.length)] ?? sn;
        pedestrians.push({
          fromX: sn.x,
          fromY: sn.y,
          toX: nn.x,
          toY: nn.y,
          t: (idx * 0.31) % 1,
          side: idx % 2 === 0 ? 1 : -1,
          speed: 0.42 + (idx % 4) * 0.08,
          color: shirtPalette[idx % shirtPalette.length],
          phase: idx * 1.3,
        });
      }
    }

    // 3. Rail Consists: BTS Skytrain, Heavy Train, and Street Tram
    const desiredTrains = [];
    if (railCaches.BTS_TRACK.length >= 2) {
      desiredTrains.push({ trackType: "BTS_TRACK", kind: "BTS_SKYTRAIN", speed: 2.15 });
      if (railCaches.BTS_TRACK.length >= 10) {
        desiredTrains.push({ trackType: "BTS_TRACK", kind: "BTS_SKYTRAIN", speed: 2.15 });
      }
    }
    if (railCaches.RAIL_TRACK.length >= 2) {
      desiredTrains.push({ trackType: "RAIL_TRACK", kind: "HEAVY_TRAIN", speed: 1.95 });
    }
    if (railCaches.TRAM_TRACK.length >= 2) {
      desiredTrains.push({ trackType: "TRAM_TRACK", kind: "STREET_TRAM", speed: 1.45 });
    }

    while (railTrains.length > desiredTrains.length) railTrains.pop();
    desiredTrains.forEach((spec, idx) => {
      const net = railCaches[spec.trackType];
      if (!railTrains[idx] || railTrains[idx].trackType !== spec.trackType) {
        const startNode = net[(idx * 4) % net.length];
        const nextNode = startNode.neighbors[0] ?? startNode;
        railTrains[idx] = {
          trackType: spec.trackType,
          kind: spec.kind,
          speed: spec.speed,
          fromX: startNode.x,
          fromY: startNode.y,
          toX: nextNode.x,
          toY: nextNode.y,
          t: (idx * 0.45) % 0.9,
          dwellTimer: 0,
          dirtyMesh: true,
        };
      }
    });
  }

  function advanceAllAgents(dt, nowMs, isPowerDeficit) {
    // 1. Road Vehicles
    if (roadCache.length > 0) {
      const roadMap = new Map(roadCache.map((r) => [`${r.x},${r.y}`, r]));
      const laneGroups = new Map();
      for (const v of vehicles) {
        const key = `${v.fromX},${v.fromY}->${v.toX},${v.toY}:${v.subLane % 2}`;
        if (!laneGroups.has(key)) laneGroups.set(key, []);
        laneGroups.get(key).push(v);
      }
      for (const list of laneGroups.values()) list.sort((a, b) => b.t - a.t);

      for (const list of laneGroups.values()) {
        let leaderT = Infinity;
        for (const v of list) {
          if (v.dwellTimer > 0) {
            v.dwellTimer = Math.max(0, v.dwellTimer - dt);
            leaderT = v.t;
            continue;
          }
          const curNode = roadMap.get(`${v.fromX},${v.fromY}`);
          const destNode = roadMap.get(`${v.toX},${v.toY}`);
          const dx = v.toX - v.fromX;
          const dy = v.toY - v.fromY;

          // Multi-lane speed bonus on 6L / 10L highways
          const laneSpeedMult = (curNode?.lanes ?? 2) >= 6 ? 1.28 : 1.0;

          let waitRed = false;
          if (destNode?.hasSignal && !isPowerDeficit) {
            const phase = getTrafficSignalPhase(nowMs, destNode.x, destNode.y);
            const sig = Math.abs(dy) > 0 ? phase.ns : phase.ew;
            if (sig !== "GREEN" && v.t >= 0.48 && v.t <= 0.72) waitRed = true;
          }

          let nextT = v.t + dt * v.speed * laneSpeedMult;
          if (waitRed) nextT = Math.min(nextT, 0.62);
          const gap = v.kind === "CITY_BUS" || v.kind === "CARGO_TRUCK" ? 0.35 : 0.26;
          if (leaderT < Infinity) nextT = Math.min(nextT, leaderT - gap);
          v.t = Math.max(v.t, nextT);

          if (v.kind === "CITY_BUS" && curNode?.hasBusStop && v.t >= 0.38 && v.t <= 0.45 && !v.stoppedHere) {
            v.dwellTimer = 0.95;
            v.stoppedHere = true;
          }

          if (v.t >= 1) {
            v.t = 0;
            v.stoppedHere = false;
            if (!destNode || destNode.neighbors.length === 0) {
              const fb = roadCache[0];
              v.fromX = fb.x; v.fromY = fb.y;
              v.toX = fb.neighbors[0]?.x ?? fb.x; v.toY = fb.neighbors[0]?.y ?? fb.y;
            } else {
              const nonRev = destNode.neighbors.filter((n) => !(n.x === v.fromX && n.y === v.fromY));
              const opts = nonRev.length > 0 ? nonRev : destNode.neighbors;
              const pick = opts[(v.fromX * 7 + v.fromY * 5 + Math.floor(nowMs / 450)) % opts.length];
              v.fromX = destNode.x; v.fromY = destNode.y;
              v.toX = pick.x; v.toY = pick.y;
            }
            leaderT = Infinity;
          } else {
            leaderT = v.t;
          }
        }
      }

      // 2. Pedestrians strolling along sidewalks
      for (const p of pedestrians) {
        p.t += dt * p.speed;
        if (p.t >= 1) {
          p.t = 0;
          const dest = roadMap.get(`${p.toX},${p.toY}`);
          if (!dest || dest.neighbors.length === 0) {
            const fb = roadCache[0];
            p.fromX = fb.x; p.fromY = fb.y;
            p.toX = fb.neighbors[0]?.x ?? fb.x; p.toY = fb.neighbors[0]?.y ?? fb.y;
          } else {
            const nonRev = dest.neighbors.filter((n) => !(n.x === p.fromX && n.y === p.fromY));
            const opts = nonRev.length > 0 ? nonRev : dest.neighbors;
            const pick = opts[(p.fromX + p.fromY + Math.floor(nowMs / 600)) % opts.length];
            p.fromX = dest.x; p.fromY = dest.y;
            p.toX = pick.x; p.toY = pick.y;
          }
        }
      }
    }

    // 3. Rail Trains (BTS Skytrain, Heavy Rail, Tram) stopping smoothly at passenger stations
    for (const tr of railTrains) {
      const net = railCaches[tr.trackType] ?? [];
      if (net.length === 0) continue;
      const railMap = new Map(net.map((n) => [`${n.x},${n.y}`, n]));

      if (tr.dwellTimer > 0) {
        tr.dwellTimer = Math.max(0, tr.dwellTimer - dt);
        continue;
      }

      tr.t += dt * (isPowerDeficit ? tr.speed * 0.35 : tr.speed);
      const curNode = railMap.get(`${tr.fromX},${tr.fromY}`);
      if (curNode?.nearStation && tr.t >= 0.45 && tr.t <= 0.55 && !tr.stoppedStation) {
        tr.dwellTimer = 1.25; // Passenger boarding stop at BTS/Train/Tram station!
        tr.stoppedStation = true;
      }

      if (tr.t >= 1) {
        tr.t = 0;
        tr.stoppedStation = false;
        const dest = railMap.get(`${tr.toX},${tr.toY}`);
        if (!dest || dest.neighbors.length === 0) {
          const fb = net[0];
          tr.fromX = fb.x; tr.fromY = fb.y;
          tr.toX = fb.neighbors[0]?.x ?? fb.x; tr.toY = fb.neighbors[0]?.y ?? fb.y;
        } else {
          const nonRev = dest.neighbors.filter((n) => !(n.x === tr.fromX && n.y === tr.fromY));
          const opts = nonRev.length > 0 ? nonRev : dest.neighbors;
          const pick = opts[0];
          tr.fromX = dest.x; tr.fromY = dest.y;
          tr.toX = pick.x; tr.toY = pick.y;
        }
      }
    }
  }

  let glRenderer = null;
  try {
    glRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch {
    glRenderer = null;
  }

  if (!glRenderer) {
    return initIsometricFallback(container, {
      getState: () => currentState,
      setState: (s) => {
        currentState = s;
        syncAgents(s);
      },
      getView: () => viewMode,
      setView: (v) => { viewMode = v; },
      advanceAllAgents,
      onTileAction,
      onTileHover,
    });
  }

  glRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  glRenderer.setSize(container.clientWidth, container.clientHeight);
  glRenderer.shadowMap.enabled = true;
  glRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  glRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  glRenderer.toneMappingExposure = 1.1;
  container.appendChild(glRenderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8ecae6);
  scene.fog = new THREE.FogExp2(0x8ecae6, 0.011);

  const camera = new THREE.PerspectiveCamera(
    41,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.2,
    190
  );
  camera.position.set(17.5, 18.5, 19.5);

  const controls = new OrbitControls(camera, glRenderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI / 2.16;
  controls.minDistance = 5.0;
  controls.maxDistance = 48;
  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.PAN,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x294631, 0.88);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff5dc, 1.95);
  sunLight.position.set(19, 27, 14);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 2;
  sunLight.shadow.camera.far = 80;
  const sBound = 17.5;
  sunLight.shadow.camera.left = -sBound;
  sunLight.shadow.camera.right = sBound;
  sunLight.shadow.camera.top = sBound;
  sunLight.shadow.camera.bottom = -sBound;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);

  function applyLightingAtmosphere() {
    if (lightingMode === "DUSK") {
      scene.background.setHex(0x0a1324);
      scene.fog.color.setHex(0x0a1324);
      hemiLight.color.setHex(0x38bdf8);
      hemiLight.groundColor.setHex(0x0f172a);
      hemiLight.intensity = 0.38;
      sunLight.color.setHex(0xfb923c);
      sunLight.intensity = 0.92;
      sunLight.position.set(-20, 12, 16);
      glRenderer.toneMappingExposure = 1.22;
    } else {
      scene.background.setHex(0x8ecae6);
      scene.fog.color.setHex(0x8ecae6);
      hemiLight.color.setHex(0xe0f2fe);
      hemiLight.groundColor.setHex(0x2d4c36);
      hemiLight.intensity = 0.9;
      sunLight.color.setHex(0xfff6e0);
      sunLight.intensity = 1.95;
      sunLight.position.set(19, 27, 14);
      glRenderer.toneMappingExposure = 1.06;
    }
  }
  applyLightingAtmosphere();

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(GRID_SIZE + 0.9, 0.75, GRID_SIZE + 0.9),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
  );
  plinth.position.y = -0.44;
  scene.add(plinth);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.18,
    metalness: 0.25,
    transparent: true,
    opacity: 0.86,
  });
  const waterPlane = new THREE.Mesh(new THREE.PlaneGeometry(GRID_SIZE + 0.1, GRID_SIZE + 0.1), waterMat);
  waterPlane.rotation.x = -Math.PI / 2;
  waterPlane.position.y = 0.06;
  waterPlane.receiveShadow = true;
  scene.add(waterPlane);

  const terrainGroup = new THREE.Group();
  const cityGroup = new THREE.Group();
  const vehiclesGroup = new THREE.Group();
  const trainsGroup = new THREE.Group();
  const pedsGroup = new THREE.Group();
  scene.add(terrainGroup, cityGroup, vehiclesGroup, trainsGroup, pedsGroup);

  const offset = (GRID_SIZE - 1) / 2;
  let terrainMeshes = [];

  function rebuildSculptedTerrain(state) {
    while (terrainGroup.children.length > 0) terrainGroup.remove(terrainGroup.children[0]);
    terrainMeshes = [];

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const cell = state.grid[y][x];
        const wx = x - offset;
        const wz = y - offset;

        let topHex = 0x3b7a47;
        if (cell.terrain === "WATER") topHex = 0x0c4a6e;
        else if (cell.terrain === "SAND") topHex = 0xe7cc8f;
        else if (cell.terrain === "HILL") topHex = 0x4d8b55;
        else if (cell.terrain === "MOUNTAIN") topHex = 0x64748b;
        else if ((x * 5 + y * 7) % 3 === 0) topHex = 0x367242;

        const blockH = Math.max(0.12, cell.elevation + 0.16);
        const geo = new THREE.BoxGeometry(1.002, blockH, 1.002);
        const mat = new THREE.MeshStandardMaterial({ color: topHex, roughness: 0.9 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(wx, cell.elevation - blockH / 2, wz);
        mesh.receiveShadow = true;
        if (cell.elevation > 0.3) mesh.castShadow = true;
        mesh.userData = { gridX: x, gridY: y };
        terrainGroup.add(mesh);
        terrainMeshes.push(mesh);

        if (cell.terrain === "MOUNTAIN") {
          const crag = new THREE.Mesh(
            new THREE.ConeGeometry(0.54, 0.95, 6),
            new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 })
          );
          crag.position.set(wx, cell.elevation + 0.46, wz);
          crag.castShadow = true;
          const snow = new THREE.Mesh(
            new THREE.ConeGeometry(0.28, 0.42, 6),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc })
          );
          snow.position.set(wx, cell.elevation + 0.78, wz);
          terrainGroup.add(crag, snow);
        }
      }
    }
  }

  const hoverCursor = new THREE.Mesh(
    new THREE.RingGeometry(0.41, 0.49, 4),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
  );
  hoverCursor.rotation.x = -Math.PI / 2;
  hoverCursor.rotation.z = Math.PI / 4;
  hoverCursor.visible = false;
  scene.add(hoverCursor);

  // Cache road textures by key "lanes:mask:bridge:tram"
  const roadTexCache = new Map();
  function getRoadTex(lanes, mask, isBridge, hasTram) {
    const k = `${lanes}:${mask}:${isBridge ? 1 : 0}:${hasTram ? 1 : 0}`;
    if (!roadTexCache.has(k)) {
      roadTexCache.set(k, makeMultiLaneRoadTexture(lanes, mask, { isBridge, hasTram }));
    }
    return roadTexCache.get(k);
  }

  const pitchTex = makePitchTexture();
  const facades = {
    RES: makeWindowFacadeTextures("#e2e8f0", "#cbd5e1", "#fde68a"),
    COM: makeWindowFacadeTextures("#1e293b", "#475569", "#7dd3fc"),
    IND: makeWindowFacadeTextures("#78350f", "#451a03", "#fbbf24"),
  };

  const tileRecords = new Map();

  function addWildTrees(group, count, tintMats) {
    const offsets = [[-0.22, -0.18], [0.21, 0.19], [-0.14, 0.24]];
    for (let i = 0; i < count; i += 1) {
      const [tx, tz] = offsets[i % offsets.length];
      const sc = 0.78 + (i % 3) * 0.14;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, 0.18, 5),
        new THREE.MeshStandardMaterial({ color: 0x713f12 })
      );
      trunk.position.set(tx, 0.09, tz);
      const crownMat = new THREE.MeshStandardMaterial({ color: 0x2f6f3e, roughness: 0.85 });
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.16 * sc, 0.42 * sc, 7), crownMat);
      crown.position.set(tx, 0.32 * sc, tz);
      crown.castShadow = true;
      group.add(trunk, crown);
      tintMats.push(crownMat);
    }
  }

  function buildIntersectionSignalRig() {
    const rigGroup = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const nsMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const ewMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const postNS = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.46, 6), poleMat);
    postNS.position.set(-0.43, 0.23, -0.43);
    const armNS = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.018, 0.018), poleMat);
    armNS.position.set(-0.32, 0.44, -0.43);
    const housingNS = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.045), boxMat);
    housingNS.position.set(-0.22, 0.42, -0.43);
    const lampNS = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), nsMat);
    lampNS.position.set(-0.22, 0.42, -0.4);

    const postEW = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.46, 6), poleMat);
    postEW.position.set(0.43, 0.23, 0.43);
    const armEW = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.018, 0.22), poleMat);
    armEW.position.set(0.43, 0.44, 0.32);
    const housingEW = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.11, 0.05), boxMat);
    housingEW.position.set(0.43, 0.42, 0.22);
    const lampEW = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 8), ewMat);
    lampEW.position.set(0.4, 0.42, 0.22);

    rigGroup.add(postNS, armNS, housingNS, lampNS, postEW, armEW, housingEW, lampEW);
    return { rigGroup, nsMat, ewMat };
  }

  function buildProceduralTileGroup(tile, roadInfo, railMask) {
    const root = new THREE.Group();
    const wx = tile.x - offset;
    const wz = tile.y - offset;
    const baseY = tile.isBridge ? BRIDGE_DECK_Y : tile.elevation;
    root.position.set(wx, baseY, wz);

    const emissiveMats = [];
    const streetGlowMats = [];
    const tintMats = [];
    let rotor = null;
    let scaleGroup = null;
    let signalRig = null;

    if (tile.type === "EMPTY") {
      if (tile.trees > 0 && (tile.terrain === "GRASS" || tile.terrain === "HILL")) {
        addWildTrees(root, tile.trees, tintMats);
      }
      return { root, scaleGroup, rotor, signalRig, emissiveMats, streetGlowMats, tintMats, tileRef: tile };
    }

    // 1. Multi-Lane Roads (2, 4, 6, 10 Lanes) & Street Tramway
    if (isRoadTileType(tile.type)) {
      const roadMask = roadInfo?.mask ?? 0;
      const landToBridgeMask = roadInfo?.landToBridgeMask ?? 0;
      const lanes = getRoadLaneCount(tile.type);
      const hasTram = tile.type === "TRAM_TRACK";

      const roadMat = new THREE.MeshStandardMaterial({
        map: getRoadTex(lanes, roadMask, tile.isBridge, hasTram),
        roughness: 0.82,
      });
      const deck = new THREE.Mesh(new THREE.BoxGeometry(1.012, 0.045, 1.012), roadMat);
      deck.position.y = 0.022;
      deck.receiveShadow = true;
      if (tile.isBridge) deck.castShadow = true;
      root.add(deck);
      tintMats.push(roadMat);

      if (!tile.isBridge && landToBridgeMask > 0 && tile.elevation < BRIDGE_DECK_Y) {
        const rise = BRIDGE_DECK_Y - tile.elevation;
        const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.048, 0.58), roadMat);
        const angle = Math.atan2(rise, 0.52);
        if (landToBridgeMask & 2) {
          ramp.position.set(0.24, 0.022 + rise / 2, 0);
          ramp.rotation.set(0, Math.PI / 2, 0);
          ramp.rotateX(-angle);
        } else if (landToBridgeMask & 8) {
          ramp.position.set(-0.24, 0.022 + rise / 2, 0);
          ramp.rotation.set(0, Math.PI / 2, 0);
          ramp.rotateX(angle);
        } else if (landToBridgeMask & 4) {
          ramp.position.set(0, 0.022 + rise / 2, 0.24);
          ramp.rotation.x = -angle;
        } else if (landToBridgeMask & 1) {
          ramp.position.set(0, 0.022 + rise / 2, -0.24);
          ramp.rotation.x = angle;
        }
        root.add(ramp);
      }

      const warmGlowMat = new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.34,
      });
      const glowW = lanes >= 6 ? 0.86 : 0.66;
      const glowStrip = new THREE.Mesh(new THREE.PlaneGeometry(glowW, glowW), warmGlowMat);
      glowStrip.rotation.x = -Math.PI / 2;
      glowStrip.position.y = 0.048;
      root.add(glowStrip);
      streetGlowMats.push(warmGlowMat);

      if (roadInfo?.hasSignal) {
        signalRig = buildIntersectionSignalRig();
        root.add(signalRig.rigGroup);
      } else if ((tile.x + tile.y) % 2 === 0 || lanes >= 6) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.018, 0.46, 6),
          new THREE.MeshStandardMaterial({ color: 0x64748b })
        );
        pole.position.set(0.44, 0.23, 0.44);
        const lampBulbMat = new THREE.MeshStandardMaterial({
          color: 0xfdba74,
          emissive: new THREE.Color(0xf97316),
          emissiveIntensity: 0.95,
        });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), lampBulbMat);
        bulb.position.set(0.44, 0.46, 0.44);
        root.add(pole, bulb);
        emissiveMats.push(lampBulbMat);
      }

      if (tile.isBridge) {
        const abutmentMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
        for (const [px, pz] of [[-0.34, -0.34], [0.34, 0.34]]) {
          const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.072, 0.28, 8), abutmentMat);
          pier.position.set(px, -0.12, pz);
          pier.castShadow = true;
          root.add(pier);
        }
      }

      return { root, scaleGroup, rotor, signalRig, emissiveMats, streetGlowMats, tintMats, tileRef: tile };
    }

    // 2. Heavy Rail Track & Elevated BTS Skytrain Viaduct
    if (tile.type === "RAIL_TRACK") {
      const ballastMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
      const bed = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.96), ballastMat);
      bed.position.y = 0.025;
      root.add(bed);

      const steelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7, roughness: 0.3 });
      const isEW = (railMask & 2) !== 0 || (railMask & 8) !== 0;
      for (const rOff of [-0.14, 0.14]) {
        const rail = new THREE.Mesh(
          isEW ? new THREE.BoxGeometry(1.0, 0.025, 0.03) : new THREE.BoxGeometry(0.03, 0.025, 1.0),
          steelMat
        );
        rail.position.set(isEW ? 0 : rOff, 0.062, isEW ? rOff : 0);
        root.add(rail);
      }
      tintMats.push(ballastMat);
      return { root, scaleGroup, rotor, signalRig, emissiveMats, streetGlowMats, tintMats, tileRef: tile };
    }

    if (tile.type === "BTS_TRACK") {
      root.position.y = 0; // Absolute height reference so BTS viaduct stays level over land & rivers!
      const pierH = BTS_VIADUCT_Y;
      const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.55 });
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, pierH, 10), concreteMat);
      pillar.position.y = pierH / 2;
      pillar.castShadow = true;

      const isEW = (railMask & 2) !== 0 || (railMask & 8) !== 0;
      const girder = new THREE.Mesh(
        isEW ? new THREE.BoxGeometry(1.02, 0.08, 0.54) : new THREE.BoxGeometry(0.54, 0.08, 1.02),
        concreteMat
      );
      girder.position.y = pierH;
      girder.castShadow = true;
      girder.receiveShadow = true;

      const blueTrim = new THREE.Mesh(
        isEW ? new THREE.BoxGeometry(1.02, 0.025, 0.57) : new THREE.BoxGeometry(0.57, 0.025, 1.02),
        new THREE.MeshStandardMaterial({ color: 0x0284c7 })
      );
      blueTrim.position.y = pierH + 0.035;

      root.add(pillar, girder, blueTrim);
      tintMats.push(concreteMat);
      return { root, scaleGroup, rotor, signalRig, emissiveMats, streetGlowMats, tintMats, tileRef: tile };
    }

    // 3. Hydroelectric Power Dam (Built directly on River / Bay Water!)
    if (tile.type === "HYDRO_DAM") {
      root.position.y = 0;
      const damConcrete = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.6 });
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.62, 0.72), damConcrete);
      wall.position.y = 0.28;
      wall.castShadow = true;

      const spillwayMat = new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.55,
      });
      const spillway = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.78), spillwayMat);
      spillway.position.y = 0.2;

      const powerhouse = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.22, 0.36),
        new THREE.MeshStandardMaterial({ color: 0x334155 })
      );
      powerhouse.position.y = 0.65;
      powerhouse.castShadow = true;

      root.add(wall, spillway, powerhouse);
      emissiveMats.push(spillwayMat);
      tintMats.push(damConcrete);
      return { root, scaleGroup, rotor, signalRig, emissiveMats, streetGlowMats, tintMats, tileRef: tile };
    }

    // Standard terrace pad for land buildings
    const padColor =
      tile.type === "PARK"
        ? 0x226b3a
        : tile.type === "PLAZA"
          ? 0xcbd5e1
          : tile.type === "RESIDENTIAL" && tile.level === 0
            ? 0x22c55e
            : tile.type === "COMMERCIAL" && tile.level === 0
              ? 0x3b82f6
              : tile.type === "INDUSTRIAL" && tile.level === 0
                ? 0xf59e0b
                : 0x64748b;

    const padMat = new THREE.MeshStandardMaterial({ color: padColor, roughness: 0.88 });
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.04, 0.94), padMat);
    pad.position.y = 0.02;
    pad.receiveShadow = true;
    root.add(pad);
    tintMats.push(padMat);

    scaleGroup = new THREE.Group();
    scaleGroup.scale.y = 0.08;
    root.add(scaleGroup);

    // 4. Football Stadium, Sports Complex, Mega Mall & Rail Stations
    if (tile.type === "FOOTBALL_STADIUM") {
      const bowlMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
      const bowlOuter = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.42, 0.38, 20, 1, true), bowlMat);
      bowlOuter.position.y = 0.21;
      bowlOuter.castShadow = true;

      const pitch = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.44),
        new THREE.MeshStandardMaterial({ map: pitchTex })
      );
      pitch.rotation.x = -Math.PI / 2;
      pitch.position.y = 0.05;

      const floodlightMat = new THREE.MeshStandardMaterial({
        color: 0xfef9c3,
        emissive: new THREE.Color(0xfef08a),
        emissiveIntensity: 1.1,
      });
      for (const [fx, fz] of [[-0.38, -0.34], [0.38, -0.34], [-0.38, 0.34], [0.38, 0.34]]) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.018, 0.65, 6),
          new THREE.MeshStandardMaterial({ color: 0x475569 })
        );
        mast.position.set(fx, 0.33, fz);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.04), floodlightMat);
        head.position.set(fx, 0.66, fz);
        scaleGroup.add(mast, head);
      }

      scaleGroup.add(bowlOuter, pitch);
      emissiveMats.push(floodlightMat);
      tintMats.push(bowlMat);
    } else if (tile.type === "SPORTS_COMPLEX") {
      const arenaMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.3, roughness: 0.35 });
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
        arenaMat
      );
      dome.position.set(-0.1, 0.04, 0);
      dome.castShadow = true;

      const pool = new THREE.Mesh(
        new THREE.BoxGeometry(0.28, 0.05, 0.56),
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: new THREE.Color(0x0284c7), emissiveIntensity: 0.45 })
      );
      pool.position.set(0.26, 0.045, 0);
      scaleGroup.add(dome, pool);
      tintMats.push(arenaMat);
    } else if (tile.type === "MEGA_MALL") {
      const mallWall = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 });
      const atriumGlass = new THREE.MeshStandardMaterial({
        color: 0x7dd3fc,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.85,
        metalness: 0.45,
        roughness: 0.18,
      });
      const neonSign = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: new THREE.Color(0xf43f5e),
        emissiveIntensity: 0.95,
      });

      const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.58, 0.82), mallWall);
      base.position.y = 0.31;
      base.castShadow = true;

      const skylight = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.54), atriumGlass);
      skylight.position.y = 0.66;

      const marquee = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.05), neonSign);
      marquee.position.set(0, 0.45, 0.42);

      scaleGroup.add(base, skylight, marquee);
      emissiveMats.push(atriumGlass, neonSign);
      tintMats.push(mallWall);
    } else if (tile.type === "BTS_STATION") {
      const concourseMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4 });
      const canopyMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: new THREE.Color(0x0ea5e9),
        emissiveIntensity: 0.55,
      });
      const concourse = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.48, 0.68), concourseMat);
      concourse.position.y = 0.36;
      concourse.castShadow = true;
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.88, 12, 1, false, 0, Math.PI), canopyMat);
      roof.rotation.z = Math.PI / 2;
      roof.position.y = 0.64;
      scaleGroup.add(concourse, roof);
      emissiveMats.push(canopyMat);
      tintMats.push(concourseMat);
    } else if (tile.type === "TRAIN_STATION" || tile.type === "TRAM_STOP" || tile.type === "TRANSIT_HUB") {
      const isHeavy = tile.type === "TRAIN_STATION";
      const hallMat = new THREE.MeshStandardMaterial({ color: isHeavy ? 0xb45309 : 0x0f766e, roughness: 0.45 });
      const hall = new THREE.Mesh(new THREE.BoxGeometry(0.8, isHeavy ? 0.46 : 0.28, 0.62), hallMat);
      hall.position.y = isHeavy ? 0.25 : 0.16;
      hall.castShadow = true;
      scaleGroup.add(hall);
      if (isHeavy) {
        const clockTower = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.88, 0.2), hallMat);
        clockTower.position.set(0.26, 0.46, 0.18);
        clockTower.castShadow = true;
        scaleGroup.add(clockTower);
      }
      tintMats.push(hallMat);
    } else if (tile.type === "CITY_HALL") {
      const marble = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
      const gold = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.6, roughness: 0.25 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.52, 0.76), marble);
      body.position.y = 0.28;
      body.castShadow = true;
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), gold);
      dome.position.y = 0.56;
      scaleGroup.add(body, dome);
      tintMats.push(marble, gold);
    } else if (tile.type === "BUS_DEPOT") {
      const depotMat = new THREE.MeshStandardMaterial({ color: 0x0369a1 });
      const garage = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.34, 0.54), depotMat);
      garage.position.set(0, 0.19, -0.06);
      garage.castShadow = true;
      scaleGroup.add(garage);
      tintMats.push(depotMat);
    } else if (tile.type === "PARK" || tile.type === "PLAZA") {
      addWildTrees(scaleGroup, tile.type === "PARK" ? 3 : 1, tintMats);
      if (tile.type === "PLAZA") {
        const obelisk = new THREE.Mesh(
          new THREE.ConeGeometry(0.1, 0.82, 4),
          new THREE.MeshStandardMaterial({ color: 0xf8fafc })
        );
        obelisk.position.y = 0.44;
        obelisk.castShadow = true;
        scaleGroup.add(obelisk);
      }
    } else if (tile.type === "WIND_TURBINE") {
      const towerMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc });
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.08, 1.65, 10), towerMat);
      mast.position.y = 0.84;
      mast.castShadow = true;
      rotor = new THREE.Group();
      rotor.position.set(0, 1.62, 0.08);
      for (let b = 0; b < 3; b += 1) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.62, 0.02), towerMat);
        blade.position.y = 0.28;
        const pivot = new THREE.Group();
        pivot.rotation.z = (b * Math.PI * 2) / 3;
        pivot.add(blade);
        rotor.add(pivot);
      }
      scaleGroup.add(mast, rotor);
      tintMats.push(towerMat);
    } else if (tile.type === "SOLAR_PLANT") {
      const panelMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, metalness: 0.65, roughness: 0.22 });
      for (const pz of [-0.22, 0.18]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.04, 0.32), panelMat);
        panel.position.set(0, 0.2, pz);
        panel.rotation.x = 0.38;
        panel.castShadow = true;
        scaleGroup.add(panel);
      }
      tintMats.push(panelMat);
    } else if (tile.type === "WATER_TOWER") {
      const tankMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8 });
      const tank = new THREE.Mesh(new THREE.SphereGeometry(0.27, 14, 12), tankMat);
      tank.position.y = 0.78;
      tank.castShadow = true;
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 0.65, 8),
        new THREE.MeshStandardMaterial({ color: 0x94a3b8 })
      );
      stem.position.y = 0.34;
      scaleGroup.add(stem, tank);
      tintMats.push(tankMat);
    } else if (tile.type === "SCHOOL" || tile.type === "HOSPITAL" || tile.type === "SAFETY_HQ") {
      const wallHex =
        tile.type === "HOSPITAL" ? 0xf8fafc : tile.type === "SCHOOL" ? 0xd97706 : 0xb91c1c;
      const wallMat = new THREE.MeshStandardMaterial({ color: wallHex });
      const h = tile.type === "HOSPITAL" ? 1.15 : 0.68;
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.74, h, 0.64), wallMat);
      wing.position.y = h / 2;
      wing.castShadow = true;
      scaleGroup.add(wing);
      tintMats.push(wallMat);
    } else if (tile.level > 0) {
      const key = tile.type === "RESIDENTIAL" ? "RES" : tile.type === "COMMERCIAL" ? "COM" : "IND";
      const glowHex = key === "RES" ? 0xfde68a : key === "COM" ? 0x7dd3fc : 0xfbbf24;
      const mat = new THREE.MeshStandardMaterial({
        map: facades[key].map,
        emissive: new THREE.Color(glowHex),
        emissiveMap: facades[key].emissiveMap,
        emissiveIntensity: 0.65,
        roughness: key === "COM" ? 0.28 : 0.68,
      });
      const h =
        key === "COM"
          ? 0.55 + tile.level * 0.58
          : key === "RES"
            ? 0.38 + tile.level * 0.42
            : 0.38 + tile.level * 0.24;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(0.68, h, 0.66), mat);
      tower.position.y = h / 2;
      tower.castShadow = true;
      tower.receiveShadow = true;
      scaleGroup.add(tower);
      emissiveMats.push(mat);
      tintMats.push(mat);
    }

    if (tile.issue) {
      const warnOrb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.13),
        new THREE.MeshBasicMaterial({ color: 0xef4444 })
      );
      warnOrb.position.y = (tile.level || 1) * 0.65 + 0.5;
      root.add(warnOrb);
    }

    return { root, scaleGroup, rotor, signalRig, emissiveMats, streetGlowMats, tintMats, tileRef: tile };
  }

  function syncSceneFromState() {
    const state = currentState;
    if (!state) return;

    const biomeSig = `${state.biome}:${state.grid[0][0].elevation}:${state.grid[12][12].terrain}`;
    if (biomeSig !== activeBiomeSignature) {
      activeBiomeSignature = biomeSig;
      rebuildSculptedTerrain(state);
      for (const rec of tileRecords.values()) cityGroup.remove(rec.root);
      tileRecords.clear();
    }

    const roadInfoMap = new Map(roadCache.map((r) => [`${r.x},${r.y}`, r]));
    const railMaskMap = new Map();
    for (const list of Object.values(railCaches)) {
      for (const rn of list) railMaskMap.set(`${rn.x},${rn.y}`, rn.mask);
    }

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const tile = state.grid[y][x];
        const key = `${x},${y}`;
        const rInfo = roadInfoMap.get(key);
        const rMask = railMaskMap.get(key) ?? 0;
        const sig = `${tile.type}:${tile.level}:${rInfo?.mask ?? 0}:${rMask}:${rInfo?.landToBridgeMask ?? 0}:${rInfo?.hasSignal ? 1 : 0}:${tile.isBridge}:${tile.issue ?? "OK"}`;

        let rec = tileRecords.get(key);
        if (!rec || rec.signature !== sig) {
          const prevScale = rec?.scaleGroup?.scale?.y ?? 0.08;
          if (rec) cityGroup.remove(rec.root);
          const built = buildProceduralTileGroup(tile, rInfo, rMask);
          if (built.scaleGroup) built.scaleGroup.scale.y = prevScale;
          cityGroup.add(built.root);
          rec = { signature: sig, ...built };
          tileRecords.set(key, rec);
        } else {
          rec.tileRef = tile;
        }

        const score = getTileInfoMetric(tile, viewMode);
        for (const tm of rec.tintMats) {
          if (!tm.userData.baseColor) tm.userData.baseColor = tm.color.clone();
          if (viewMode === "NONE" || score === null) {
            tm.color.copy(tm.userData.baseColor);
          } else {
            tm.color.copy(scoreToHeatmapColor(score));
          }
        }
      }
    }
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickGridCoord(clientX, clientY) {
    const rect = glRenderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(terrainMeshes, false);
    if (hits.length === 0) return null;
    const { gridX, gridY } = hits[0].object.userData;
    return inBounds(gridX, gridY) ? { x: gridX, y: gridY } : null;
  }

  glRenderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  glRenderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (isSpaceHeld) {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      return;
    }
    controls.mouseButtons.LEFT = null;
    isLeftDragging = true;
    const hit = pickGridCoord(e.clientX, e.clientY);
    if (hit) {
      lastPaintedKey = `${hit.x},${hit.y}`;
      onTileAction?.(hit.x, hit.y);
    }
  });

  glRenderer.domElement.addEventListener("pointermove", (e) => {
    const hit = pickGridCoord(e.clientX, e.clientY);
    if (hit && currentState) {
      const tile = currentState.grid[hit.y][hit.x];
      hoverCursor.visible = true;
      hoverCursor.position.set(
        hit.x - offset,
        Math.max(0.08, tile.isBridge ? BRIDGE_DECK_Y : tile.elevation) + 0.05,
        hit.y - offset
      );
      onTileHover?.(hit.x, hit.y);
      if (isLeftDragging && !isSpaceHeld) {
        const key = `${hit.x},${hit.y}`;
        if (key !== lastPaintedKey) {
          lastPaintedKey = key;
          onTileAction?.(hit.x, hit.y);
        }
      }
    } else {
      hoverCursor.visible = false;
    }
  });

  window.addEventListener("pointerup", () => {
    isLeftDragging = false;
    lastPaintedKey = "";
  });

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();
    glRenderer.setSize(container.clientWidth, container.clientHeight);
  });

  const SIGNAL_HEX = { GREEN: 0x22c55e, YELLOW: 0xfacc15, RED: 0xef4444 };

  let prevTime = performance.now();
  function renderFrame(now) {
    requestAnimationFrame(renderFrame);
    const dt = Math.min(0.05, (now - prevTime) / 1000);
    prevTime = now;

    const state = currentState;
    const m = state?.metrics;
    const isPowerDeficit = m ? m.powerDemand > m.powerSupply : false;

    waterPlane.position.y = 0.058 + Math.sin(now * 0.0022) * 0.012;
    advanceAllAgents(dt, now, isPowerDeficit);

    const duskBoost = lightingMode === "DUSK" ? 1.55 : 0.45;
    const baseEconGlow = m
      ? duskBoost * Math.max(0.2, Math.min(1.4, (m.gdpIndex / 110) * (m.approval / 78)))
      : 0.5;

    let idxSeed = 0;
    for (const rec of tileRecords.values()) {
      idxSeed += 1;
      if (rec.scaleGroup && rec.scaleGroup.scale.y < 0.999) {
        rec.scaleGroup.scale.y += (1 - rec.scaleGroup.scale.y) * Math.min(1, dt * 6.5);
      }
      if (rec.rotor) rec.rotor.rotation.z -= dt * (isPowerDeficit ? 1.4 : 3.9);

      if (rec.signalRig && rec.tileRef) {
        if (isPowerDeficit) {
          const blink = Math.floor(now / 350) % 2 === 0 ? 0xfacc15 : 0x334155;
          rec.signalRig.nsMat.color.setHex(blink);
          rec.signalRig.ewMat.color.setHex(blink);
        } else {
          const phase = getTrafficSignalPhase(now, rec.tileRef.x, rec.tileRef.y);
          rec.signalRig.nsMat.color.setHex(SIGNAL_HEX[phase.ns]);
          rec.signalRig.ewMat.color.setHex(SIGNAL_HEX[phase.ew]);
        }
      }

      const flickerWave = isPowerDeficit
        ? Math.max(0.03, 0.14 + 0.14 * Math.sin(now * 0.018 + idxSeed * 1.7))
        : baseEconGlow * ((rec.tileRef?.happiness ?? 80) / 80);

      for (const em of rec.emissiveMats) {
        em.emissiveIntensity = viewMode === "NONE" ? flickerWave : 0.1;
      }

      const streetOpacity =
        viewMode !== "NONE"
          ? 0.0
          : isPowerDeficit
            ? 0.06 + 0.06 * Math.sin(now * 0.02 + idxSeed)
            : lightingMode === "DUSK"
              ? 0.36
              : 0.12;

      for (const sg of rec.streetGlowMats) sg.opacity = Math.max(0, streetOpacity);
    }

    const roadLookup = new Map(roadCache.map((r) => [`${r.x},${r.y}`, r]));

    // Render Multi-Lane Vehicles (spread across inner/outer lanes on 4L/6L/10L highways!)
    while (vehiclesGroup.children.length > vehicles.length) {
      vehiclesGroup.remove(vehiclesGroup.children[vehiclesGroup.children.length - 1]);
    }
    vehicles.forEach((v, idx) => {
      if (!vehiclesGroup.children[idx] || v.dirtyMesh) {
        const newMesh = buildVehicleMesh(v.kind, v.color);
        if (vehiclesGroup.children[idx]) {
          vehiclesGroup.remove(vehiclesGroup.children[idx]);
          vehiclesGroup.children.splice(idx, 0, newMesh);
          newMesh.parent = vehiclesGroup;
        } else {
          vehiclesGroup.add(newMesh);
        }
        v.dirtyMesh = false;
      }

      const mesh = vehiclesGroup.children[idx];
      const dx = v.toX - v.fromX;
      const dy = v.toY - v.fromY;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uz = dy / len;

      const nA = roadLookup.get(`${v.fromX},${v.fromY}`);
      const nB = roadLookup.get(`${v.toX},${v.toY}`);
      const roadLanes = nA?.lanes ?? 2;
      const maxSubLanes = Math.max(1, Math.floor(roadLanes / 2));
      const chosenBand = v.subLane % maxSubLanes;
      const lateralMag = roadLanes >= 6 ? 0.11 + chosenBand * 0.1 : 0.16;

      const laneShiftX = -uz * lateralMag;
      const laneShiftZ = ux * lateralMag;

      const yA = nA ? roadSurfaceY(nA) : 0.18;
      const yB = nB ? roadSurfaceY(nB) : 0.18;
      const roadH = yA + (yB - yA) * v.t + 0.045;

      mesh.position.set(v.fromX + dx * v.t - offset + laneShiftX, roadH, v.fromY + dy * v.t - offset + laneShiftZ);
      mesh.rotation.y = dx !== 0 || dy !== 0 ? Math.atan2(ux, uz) : 0;
    });

    // Render BTS Skytrains, Heavy Rail Trains & Street Trams
    while (trainsGroup.children.length > railTrains.length) {
      trainsGroup.remove(trainsGroup.children[trainsGroup.children.length - 1]);
    }
    railTrains.forEach((tr, idx) => {
      if (!trainsGroup.children[idx] || tr.dirtyMesh) {
        const newTrain = buildVehicleMesh(tr.kind, 0xffffff);
        if (trainsGroup.children[idx]) {
          trainsGroup.remove(trainsGroup.children[idx]);
          trainsGroup.children.splice(idx, 0, newTrain);
          newTrain.parent = trainsGroup;
        } else {
          trainsGroup.add(newTrain);
        }
        tr.dirtyMesh = false;
      }
      const mesh = trainsGroup.children[idx];
      const dx = tr.toX - tr.fromX;
      const dy = tr.toY - tr.fromY;
      const trackY =
        tr.trackType === "BTS_TRACK"
          ? BTS_VIADUCT_Y + 0.05
          : 0.23;
      mesh.position.set(tr.fromX + dx * tr.t - offset, trackY, tr.fromY + dy * tr.t - offset);
      mesh.rotation.y = dx !== 0 || dy !== 0 ? Math.atan2(dx, dy) : 0;
    });

    // Render Walking 3D Pedestrians along sidewalks
    while (pedsGroup.children.length > pedestrians.length) {
      pedsGroup.remove(pedsGroup.children[pedsGroup.children.length - 1]);
    }
    pedestrians.forEach((p, idx) => {
      if (!pedsGroup.children[idx]) {
        pedsGroup.add(buildPedestrianMesh(p.color));
      }
      const mesh = pedsGroup.children[idx];
      const dx = p.toX - p.fromX;
      const dy = p.toY - p.fromY;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uz = dy / len;
      const sidewalkDist = 0.43 * p.side;
      const bounce = Math.abs(Math.sin(now * 0.012 + p.phase)) * 0.018;
      const nA = roadLookup.get(`${p.fromX},${p.fromY}`);
      const baseH = (nA ? roadSurfaceY(nA) : 0.18) + 0.045 + bounce;

      mesh.position.set(
        p.fromX + dx * p.t - offset - uz * sidewalkDist,
        baseH,
        p.fromY + dy * p.t - offset + ux * sidewalkDist
      );
    });

    controls.update();
    glRenderer.render(scene, camera);
  }
  requestAnimationFrame(renderFrame);

  return {
    mode: "V4 Multi-Lane, BTS & Stadium",
    renderCity(state) {
      currentState = state;
      syncAgents(state);
      syncSceneFromState();
    },
    setInfoView(nextView) {
      viewMode = nextView;
      syncSceneFromState();
    },
    toggleLighting() {
      lightingMode = lightingMode === "DAY" ? "DUSK" : "DAY";
      applyLightingAtmosphere();
      syncSceneFromState();
      return lightingMode;
    },
  };
}

function initIsometricFallback(container, ctx) {
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const c2d = canvas.getContext("2d");
  const resize = () => {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  };
  resize();
  window.addEventListener("resize", resize);

  function loop(now) {
    requestAnimationFrame(loop);
    ctx.advanceAllAgents(0.016, now, false);
    c2d.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(loop);

  return {
    mode: "2D Isometric Fallback (24×24)",
    renderCity(s) { ctx.setState(s); },
    setInfoView(v) { ctx.setView(v); },
    toggleLighting() { return "DAY"; },
  };
}
