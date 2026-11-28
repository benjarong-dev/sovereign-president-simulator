import {
  TILE_SPECS,
  createEmptyCity,
  createStarterCity,
  placeTile,
  setTaxRate,
  stepSimulation,
} from "./simulation/policyEngine.js";
import { createCityScene } from "./render/cityScene.js";

let cityState = createStarterCity();
let activeTool = "ROAD";
let simSpeed = 1; // 0=Pause, 1=1x, 2=2x, 3=3x
let inspectedCoord = { x: 6, y: 6 };

const viewport = document.getElementById("viewport");
const toastEl = document.getElementById("status-toast");
const inspectorEl = document.getElementById("inspector-box");
const alertsEl = document.getElementById("alerts-list");

function showToast(msg) {
  toastEl.textContent = msg;
}

function renderInspector(x, y) {
  const tile = cityState.grid[y]?.[x];
  if (!tile) return;

  const spec = TILE_SPECS[tile.type];
  const issueBadge = tile.issue ? `⚠ ${tile.issue}` : "Nominal";

  inspectorEl.innerHTML = [
    `<div><strong>Plot (${x}, ${y}):</strong> ${spec.label}</div>`,
    `<div><strong>Density Level:</strong> Lv.${tile.level} (${tile.growthProgress}%)</div>`,
    `<div><strong>Road Access:</strong> ${tile.roadConnected ? "Connected" : "Disconnected"}</div>`,
    `<div><strong>Utilities:</strong> Power ${tile.powered ? "OK" : "OUT"} | Water ${tile.watered ? "OK" : "OUT"}</div>`,
    `<div><strong>Happiness / Pollution:</strong> ${tile.happiness}% | Smog ${tile.pollution}</div>`,
    `<div><strong>Status:</strong> ${issueBadge}</div>`,
  ].join("");
}

function updateHud() {
  const m = cityState.metrics;
  document.getElementById("kpi-day").textContent = String(cityState.day);
  document.getElementById("kpi-treasury").textContent = `$${cityState.treasury.toLocaleString()}`;

  const sign = cityState.netCashflow >= 0 ? "+" : "";
  document.getElementById("kpi-cashflow").textContent = `${sign}$${cityState.netCashflow}/d`;
  document.getElementById("kpi-pop").textContent = m.population.toLocaleString();
  document.getElementById("kpi-jobs").textContent = m.totalJobs.toLocaleString();
  document.getElementById("kpi-approval").textContent = `${m.approval}%`;
  document.getElementById("kpi-power").textContent = `${m.powerDemand}/${m.powerSupply} MW`;
  document.getElementById("kpi-water").textContent = `${m.waterDemand}/${m.waterSupply} kL`;

  const normDemand = (val) => `${Math.max(5, Math.min(100, Math.round((val + 100) / 2)))}%`;
  document.getElementById("bar-r").style.width = normDemand(m.demand.residential);
  document.getElementById("bar-c").style.width = normDemand(m.demand.commercial);
  document.getElementById("bar-i").style.width = normDemand(m.demand.industrial);

  const warnings = [];
  if (m.powerDemand > m.powerSupply) warnings.push("Power deficit — build Wind Turbine (120 MW).");
  if (m.waterDemand > m.waterSupply) warnings.push("Water deficit — build Water Tower (120 kL).");
  if (m.avgPollution >= 25) warnings.push("High urban smog — buffer Industrial zones with Parks.");
  if (cityState.treasury < 150) warnings.push("Low municipal treasury — adjust tax rate or pause expansion.");

  alertsEl.innerHTML =
    warnings.length === 0
      ? "<li>All municipal networks operating within capacity.</li>"
      : warnings.map((w) => `<li class="warn">${w}</li>`).join("");

  renderInspector(inspectedCoord.x, inspectedCoord.y);
}

const sceneCtrl = createCityScene(viewport, {
  onTileAction(x, y) {
    inspectedCoord = { x, y };
    if (activeTool === "INSPECT") {
      renderInspector(x, y);
      return;
    }
    const result = placeTile(cityState, x, y, activeTool);
    if (!result.ok) {
      showToast(`Cannot place ${activeTool} at (${x}, ${y}): ${result.reason}`);
      return;
    }
    sceneCtrl.renderCity(cityState);
    updateHud();
    if (result.cost > 0) {
      showToast(`Built ${activeTool} at (${x}, ${y}) for $${result.cost}`);
    }
  },
  onTileHover(x, y) {
    inspectedCoord = { x, y };
    renderInspector(x, y);
  },
});

document.getElementById("renderer-badge").textContent = sceneCtrl.mode;
sceneCtrl.renderCity(cityState);
updateHud();

document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tool-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTool = btn.dataset.tool;
    showToast(`Active tool: ${activeTool}`);
  });
});

document.querySelectorAll(".speed-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".speed-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    simSpeed = Number.parseInt(btn.dataset.speed, 10);
  });
});

document.querySelectorAll(".overlay-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".overlay-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    sceneCtrl.setOverlayMode(btn.dataset.overlay);
  });
});

const taxSlider = document.getElementById("tax-slider");
const taxVal = document.getElementById("tax-val");
taxSlider.addEventListener("input", () => {
  taxVal.textContent = `${taxSlider.value}%`;
  setTaxRate(cityState, Number.parseInt(taxSlider.value, 10));
  updateHud();
});

document.getElementById("btn-starter").addEventListener("click", () => {
  cityState = createStarterCity();
  taxSlider.value = String(cityState.taxRate);
  taxVal.textContent = `${cityState.taxRate}%`;
  sceneCtrl.renderCity(cityState);
  updateHud();
  showToast("Reset to playable starter town.");
});

document.getElementById("btn-empty").addEventListener("click", () => {
  cityState = createEmptyCity({ startingTreasury: 4500, taxRate: 10 });
  taxSlider.value = "10";
  taxVal.textContent = "10%";
  sceneCtrl.renderCity(cityState);
  updateHud();
  showToast("Cleared blank 16x16 map ($4,500 budget).");
});

const TICK_INTERVALS_MS = { 1: 1400, 2: 680, 3: 320 };
let accMs = 0;
let prevTick = performance.now();

function simulationLoop(now) {
  requestAnimationFrame(simulationLoop);
  const delta = now - prevTick;
  prevTick = now;

  if (simSpeed === 0) return;
  accMs += delta;
  const threshold = TICK_INTERVALS_MS[simSpeed] ?? 1400;

  if (accMs >= threshold) {
    accMs = 0;
    stepSimulation(cityState);
    sceneCtrl.renderCity(cityState);
    updateHud();
  }
}
requestAnimationFrame(simulationLoop);
