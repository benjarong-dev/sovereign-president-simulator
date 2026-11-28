import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GRID_SIZE, getRoadNetwork, inBounds } from "../simulation/policyEngine.js";

const COLORS = {
  GROUND_A: 0x1e293b,
  GROUND_B: 0x243247,
  ROAD: 0x334155,
  RESIDENTIAL: 0x22c55e,
  COMMERCIAL: 0x3b82f6,
  INDUSTRIAL: 0xf59e0b,
  WIND_TURBINE: 0xe2e8f0,
  WATER_TOWER: 0x38bdf8,
  PARK: 0x16a34a,
  SCHOOL: 0xa855f7,
  HOSPITAL: 0xef4444,
  WARN: 0xef4444,
};

function hexCss(num) {
  return `#${num.toString(16).padStart(6, "0")}`;
}

function overlayColorHex(tile, overlayMode) {
  if (overlayMode === "POLLUTION") {
    const p = tile.pollution / 100;
    const r = Math.round(40 + p * 215);
    const g = Math.round(190 - p * 150);
    return (r << 16) | (g << 8) | 60;
  }
  if (overlayMode === "HAPPINESS") {
    const h = (tile.happiness ?? 75) / 100;
    const r = Math.round(230 - h * 190);
    const g = Math.round(50 + h * 185);
    return (r << 16) | (g << 8) | 90;
  }
  return null;
}

export function createCityScene(container, { onTileAction, onTileHover } = {}) {
  let currentState = null;
  let overlayMode = "NONE";
  let hoverCoord = null;
  let isPointerDown = false;
  let lastPaintedKey = "";
  const cars = [];
  let roadCache = [];

  function syncVehicles(state) {
    roadCache = getRoadNetwork(state);
    const targetCars = roadCache.length === 0
      ? 0
      : Math.min(18, Math.max(2, Math.floor((state.metrics.population + state.metrics.totalJobs) / 35)));

    while (cars.length > targetCars) cars.pop();
    while (cars.length < targetCars && roadCache.length > 0) {
      const startNode = roadCache[cars.length % roadCache.length];
      const nextNode = startNode.neighbors[0] ?? startNode;
      cars.push({
        fromX: startNode.x,
        fromY: startNode.y,
        toX: nextNode.x,
        toY: nextNode.y,
        t: (cars.length * 0.27) % 1,
        color: cars.length % 2 === 0 ? 0xfef08a : 0x38bdf8,
      });
    }
  }

  function advanceVehicles(dt) {
    if (roadCache.length === 0) return;
    const roadMap = new Map(roadCache.map((r) => [`${r.x},${r.y}`, r]));

    for (const car of cars) {
      car.t += dt * 1.6;
      if (car.t >= 1) {
        car.t = 0;
        const arrived = roadMap.get(`${car.toX},${car.toY}`);
        if (!arrived || arrived.neighbors.length === 0) {
          const fallback = roadCache[0];
          car.fromX = fallback.x;
          car.fromY = fallback.y;
          car.toX = fallback.neighbors[0]?.x ?? fallback.x;
          car.toY = fallback.neighbors[0]?.y ?? fallback.y;
        } else {
          const forward = arrived.neighbors.filter(
            (n) => !(n.x === car.fromX && n.y === car.fromY)
          );
          const choices = forward.length > 0 ? forward : arrived.neighbors;
          const pick = choices[(car.fromX + car.fromY + Math.floor(performance.now())) % choices.length];
          car.fromX = arrived.x;
          car.fromY = arrived.y;
          car.toX = pick.x;
          car.toY = pick.y;
        }
      }
    }
  }

  // Attempt WebGL 3D Renderer first; fall back cleanly to Interactive 2D Isometric Canvas
  let glRenderer = null;
  try {
    glRenderer = new THREE.WebGLRenderer({ antialias: true });
  } catch {
    glRenderer = null;
  }

  if (glRenderer) {
    return initWebGLScene(container, glRenderer, {
      getState: () => currentState,
      setState: (s) => {
        currentState = s;
        syncVehicles(s);
      },
      getOverlay: () => overlayMode,
      setOverlay: (m) => { overlayMode = m; },
      getHover: () => hoverCoord,
      setHover: (h) => { hoverCoord = h; },
      isDragging: () => isPointerDown,
      setDragging: (v) => { isPointerDown = v; },
      getLastKey: () => lastPaintedKey,
      setLastKey: (k) => { lastPaintedKey = k; },
      cars,
      advanceVehicles,
      onTileAction,
      onTileHover,
    });
  }

  return initIsometric2DScene(container, {
    getState: () => currentState,
    setState: (s) => {
      currentState = s;
      syncVehicles(s);
    },
    getOverlay: () => overlayMode,
    setOverlay: (m) => { overlayMode = m; },
    getHover: () => hoverCoord,
    setHover: (h) => { hoverCoord = h; },
    isDragging: () => isPointerDown,
    setDragging: (v) => { isPointerDown = v; },
    getLastKey: () => lastPaintedKey,
    setLastKey: (k) => { lastPaintedKey = k; },
    cars,
    advanceVehicles,
    onTileAction,
    onTileHover,
  });
}

function initWebGLScene(container, renderer, ctx) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1120);

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.1,
    200
  );
  camera.position.set(14, 16, 16);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0, 0);
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minDistance = 7;
  controls.maxDistance = 36;
  controls.mouseButtons = {
    LEFT: null,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE,
  };

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.15);
  sun.position.set(12, 22, 10);
  scene.add(sun);

  const offset = (GRID_SIZE - 1) / 2;
  const tileMeshes = [];
  const propsGroup = new THREE.Group();
  const carsGroup = new THREE.Group();
  const rotors = [];
  scene.add(propsGroup);
  scene.add(carsGroup);

  const baseGeo = new THREE.BoxGeometry(0.96, 0.14, 0.96);
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const mat = new THREE.MeshStandardMaterial({
        color: (x + y) % 2 === 0 ? COLORS.GROUND_A : COLORS.GROUND_B,
      });
      const mesh = new THREE.Mesh(baseGeo, mat);
      mesh.position.set(x - offset, -0.07, y - offset);
      mesh.userData = { gridX: x, gridY: y };
      scene.add(mesh);
      tileMeshes.push(mesh);
    }
  }

  const cursorGeo = new THREE.RingGeometry(0.36, 0.46, 4);
  cursorGeo.rotateX(-Math.PI / 2);
  cursorGeo.rotateY(Math.PI / 4);
  const cursorMesh = new THREE.Mesh(
    cursorGeo,
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide })
  );
  cursorMesh.position.y = 0.03;
  cursorMesh.visible = false;
  scene.add(cursorMesh);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function pickTile(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(tileMeshes, false);
    return hits.length > 0 ? hits[0].object.userData : null;
  }

  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ctx.setDragging(true);
    const hit = pickTile(e.clientX, e.clientY);
    if (hit) {
      const key = `${hit.gridX},${hit.gridY}`;
      ctx.setLastKey(key);
      ctx.onTileAction?.(hit.gridX, hit.gridY);
    }
  });

  renderer.domElement.addEventListener("pointermove", (e) => {
    const hit = pickTile(e.clientX, e.clientY);
    ctx.setHover(hit);
    if (hit) {
      cursorMesh.visible = true;
      cursorMesh.position.x = hit.gridX - offset;
      cursorMesh.position.z = hit.gridY - offset;
      ctx.onTileHover?.(hit.gridX, hit.gridY);
      if (ctx.isDragging()) {
        const key = `${hit.gridX},${hit.gridY}`;
        if (key !== ctx.getLastKey()) {
          ctx.setLastKey(key);
          ctx.onTileAction?.(hit.gridX, hit.gridY);
        }
      }
    } else {
      cursorMesh.visible = false;
    }
  });

  window.addEventListener("pointerup", () => {
    ctx.setDragging(false);
    ctx.setLastKey("");
  });

  window.addEventListener("resize", () => {
    camera.aspect = container.clientWidth / Math.max(1, container.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  function rebuildMeshes() {
    const state = ctx.getState();
    if (!state) return;

    while (propsGroup.children.length > 0) propsGroup.remove(propsGroup.children[0]);
    rotors.length = 0;

    for (const mesh of tileMeshes) {
      const { gridX: x, gridY: y } = mesh.userData;
      const tile = state.grid[y][x];
      const ov = overlayColorHex(tile, ctx.getOverlay());

      if (ov !== null && tile.type !== "EMPTY") {
        mesh.material.color.setHex(ov);
      } else if (tile.type === "ROAD") {
        mesh.material.color.setHex(COLORS.ROAD);
      } else if (tile.type === "PARK") {
        mesh.material.color.setHex(COLORS.PARK);
      } else {
        mesh.material.color.setHex((x + y) % 2 === 0 ? COLORS.GROUND_A : COLORS.GROUND_B);
      }

      if (tile.type === "EMPTY" || tile.type === "ROAD") continue;

      const wx = x - offset;
      const wz = y - offset;

      if (tile.type === "WIND_TURBINE") {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.1, 1.35, 8),
          new THREE.MeshStandardMaterial({ color: COLORS.WIND_TURBINE })
        );
        mast.position.set(wx, 0.67, wz);
        propsGroup.add(mast);

        const blades = new THREE.Mesh(
          new THREE.BoxGeometry(0.85, 0.06, 0.04),
          new THREE.MeshStandardMaterial({ color: 0x38bdf8 })
        );
        blades.position.set(wx, 1.3, wz + 0.08);
        propsGroup.add(blades);
        rotors.push(blades);
      } else if (tile.type === "WATER_TOWER") {
        const tank = new THREE.Mesh(
          new THREE.CylinderGeometry(0.28, 0.22, 0.9, 12),
          new THREE.MeshStandardMaterial({ color: COLORS.WATER_TOWER })
        );
        tank.position.set(wx, 0.45, wz);
        propsGroup.add(tank);
      } else if (tile.type === "PARK") {
        const tree = new THREE.Mesh(
          new THREE.ConeGeometry(0.28, 0.65, 7),
          new THREE.MeshStandardMaterial({ color: 0x4ade80 })
        );
        tree.position.set(wx, 0.33, wz);
        propsGroup.add(tree);
      } else {
        const height =
          tile.type === "SCHOOL" || tile.type === "HOSPITAL"
            ? 0.85
            : tile.level === 0
              ? 0.12
              : 0.35 + tile.level * 0.48;
        const bldg = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, height, 0.72),
          new THREE.MeshStandardMaterial({ color: COLORS[tile.type] ?? 0x94a3b8 })
        );
        bldg.position.set(wx, height / 2, wz);
        propsGroup.add(bldg);

        if (tile.issue) {
          const beacon = new THREE.Mesh(
            new THREE.SphereGeometry(0.13, 8, 8),
            new THREE.MeshBasicMaterial({ color: COLORS.WARN })
          );
          beacon.position.set(wx, height + 0.24, wz);
          propsGroup.add(beacon);
        }
      }
    }
  }

  let lastTs = performance.now();
  function animate(now) {
    requestAnimationFrame(animate);
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;

    ctx.advanceVehicles(dt);
    for (const r of rotors) r.rotation.z += dt * 4.2;

    while (carsGroup.children.length < ctx.cars.length) {
      carsGroup.add(
        new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.11, 0.22),
          new THREE.MeshBasicMaterial({ color: 0xfef08a })
        )
      );
    }
    while (carsGroup.children.length > ctx.cars.length) {
      carsGroup.remove(carsGroup.children[carsGroup.children.length - 1]);
    }
    ctx.cars.forEach((c, idx) => {
      const m = carsGroup.children[idx];
      const lx = c.fromX + (c.toX - c.fromX) * c.t;
      const ly = c.fromY + (c.toY - c.fromY) * c.t;
      m.position.set(lx - offset, 0.08, ly - offset);
      m.material.color.setHex(c.color);
    });

    controls.update();
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);

  return {
    mode: "3D WebGL (Three.js Raycaster)",
    renderCity(state) {
      ctx.setState(state);
      rebuildMeshes();
    },
    setOverlayMode(mode) {
      ctx.setOverlay(mode);
      rebuildMeshes();
    },
  };
}

function initIsometric2DScene(container, ctx) {
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const c2d = canvas.getContext("2d");

  function syncSize() {
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
  syncSize();
  window.addEventListener("resize", syncSize);

  function metrics() {
    const tileW = Math.min(52, Math.max(28, Math.floor(canvas.width / 20)));
    const tileH = Math.floor(tileW / 2);
    const originX = Math.floor(canvas.width / 2);
    const originY = Math.max(70, Math.floor((canvas.height - GRID_SIZE * tileH) / 2));
    return { tileW, tileH, originX, originY };
  }

  function gridToScreen(gx, gy, m) {
    return {
      sx: m.originX + (gx - gy) * (m.tileW / 2),
      sy: m.originY + (gx + gy) * (m.tileH / 2),
    };
  }

  function screenToGrid(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const m = metrics();
    const dx = px - m.originX;
    const dy = py - m.originY;
    const gx = Math.floor((dx / (m.tileW / 2) + dy / (m.tileH / 2)) / 2);
    const gy = Math.floor((dy / (m.tileH / 2) - dx / (m.tileW / 2)) / 2);
    return inBounds(gx, gy) ? { gridX: gx, gridY: gy } : null;
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    ctx.setDragging(true);
    const hit = screenToGrid(e.clientX, e.clientY);
    if (hit) {
      ctx.setLastKey(`${hit.gridX},${hit.gridY}`);
      ctx.onTileAction?.(hit.gridX, hit.gridY);
    }
  });

  canvas.addEventListener("pointermove", (e) => {
    const hit = screenToGrid(e.clientX, e.clientY);
    ctx.setHover(hit);
    if (hit) {
      ctx.onTileHover?.(hit.gridX, hit.gridY);
      if (ctx.isDragging()) {
        const key = `${hit.gridX},${hit.gridY}`;
        if (key !== ctx.getLastKey()) {
          ctx.setLastKey(key);
          ctx.onTileAction?.(hit.gridX, hit.gridY);
        }
      }
    }
  });

  window.addEventListener("pointerup", () => {
    ctx.setDragging(false);
    ctx.setLastKey("");
  });

  let lastTs = performance.now();
  function drawLoop(now) {
    requestAnimationFrame(drawLoop);
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;
    ctx.advanceVehicles(dt);

    c2d.clearRect(0, 0, canvas.width, canvas.height);
    const state = ctx.getState();
    if (!state) return;

    const m = metrics();
    const hover = ctx.getHover();

    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        const tile = state.grid[y][x];
        const { sx, sy } = gridToScreen(x, y, m);
        const ov = overlayColorHex(tile, ctx.getOverlay());

        let baseColor = (x + y) % 2 === 0 ? COLORS.GROUND_A : COLORS.GROUND_B;
        if (ov !== null && tile.type !== "EMPTY") baseColor = ov;
        else if (tile.type !== "EMPTY") baseColor = COLORS[tile.type] ?? COLORS.GROUND_A;

        c2d.beginPath();
        c2d.moveTo(sx, sy);
        c2d.lineTo(sx + m.tileW / 2, sy + m.tileH / 2);
        c2d.lineTo(sx, sy + m.tileH);
        c2d.lineTo(sx - m.tileW / 2, sy + m.tileH / 2);
        c2d.closePath();
        c2d.fillStyle = hexCss(baseColor);
        c2d.fill();
        c2d.strokeStyle = hover && hover.gridX === x && hover.gridY === y ? "#38bdf8" : "#0f172a";
        c2d.lineWidth = hover && hover.gridX === x && hover.gridY === y ? 2 : 1;
        c2d.stroke();

        if (tile.type !== "EMPTY" && tile.type !== "ROAD") {
          const hPx = tile.level > 0 ? 8 + tile.level * 10 : 6;
          c2d.fillStyle = hexCss(COLORS[tile.type] ?? 0x94a3b8);
          c2d.fillRect(sx - 7, sy + m.tileH / 2 - hPx, 14, hPx);
        }
        if (tile.issue) {
          c2d.fillStyle = "#ef4444";
          c2d.beginPath();
          c2d.arc(sx, sy + 4, 4, 0, Math.PI * 2);
          c2d.fill();
        }
      }
    }

    for (const car of ctx.cars) {
      const lx = car.fromX + (car.toX - car.fromX) * car.t;
      const ly = car.fromY + (car.toY - car.fromY) * car.t;
      const { sx, sy } = gridToScreen(lx, ly, m);
      c2d.fillStyle = hexCss(car.color);
      c2d.beginPath();
      c2d.arc(sx, sy + m.tileH / 2, 3.2, 0, Math.PI * 2);
      c2d.fill();
    }
  }
  requestAnimationFrame(drawLoop);

  return {
    mode: "2D Isometric Canvas (Hardened Browser Fallback)",
    renderCity(state) {
      ctx.setState(state);
    },
    setOverlayMode(mode) {
      ctx.setOverlay(mode);
    },
  };
}
