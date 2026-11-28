import {
  createEmptyCity,
  createStarterCity,
  placeTile,
  setPolicyBudgets,
  setTaxRate,
  stepSimulation,
} from "./simulation/policyEngine.js";
import { createCityScene } from "./render/cityScene.js";
import { createHudController } from "./ui/HudController.js";

let cityState = createStarterCity("RIVER_VALLEY");
let activeTool = "RESIDENTIAL";
let simSpeed = 1;
let hoverCoord = { x: 8, y: 11 };

const stageEl = document.getElementById("canvas-stage");

let sceneCtrl = null;

const hud = createHudController({
  onSelectTool(tool) {
    activeTool = tool;
  },
  onSpeedChange(speed) {
    simSpeed = speed;
  },
  onToggleLighting() {
    return sceneCtrl ? sceneCtrl.toggleLighting() : "DAY";
  },
  onTaxChange(rate) {
    setTaxRate(cityState, rate);
    sceneCtrl.renderCity(cityState);
    hud.updateStats(cityState);
    hud.updateInspector(cityState, hoverCoord.x, hoverCoord.y);
  },
  onBudgetChange(budgets) {
    setPolicyBudgets(cityState, budgets);
    sceneCtrl.renderCity(cityState);
    hud.updateStats(cityState);
  },
  onInfoViewChange(viewMode) {
    sceneCtrl.setInfoView(viewMode);
  },
  onGenerateMap({ biome, withStarter }) {
    cityState = withStarter
      ? createStarterCity(biome)
      : createEmptyCity({ startingTreasury: 7500, taxRate: 10, biome, withCityHall: true });
    hud.syncSlidersFromState(cityState);
    sceneCtrl.renderCity(cityState);
    hud.updateStats(cityState);
    hud.showToast(`โหลดแผนที่ ${cityState.biomeLabel} เรียบร้อยแล้ว`);
  },
});

sceneCtrl = createCityScene(stageEl, {
  onTileAction(x, y) {
    hoverCoord = { x, y };
    if (activeTool === "INSPECT") {
      hud.updateInspector(cityState, x, y);
      return;
    }
    const res = placeTile(cityState, x, y, activeTool);
    if (!res.ok) {
      hud.showToast(`สร้างไม่ได้ที่ (${x}, ${y}): ${res.reason}`);
      return;
    }
    sceneCtrl.renderCity(cityState);
    hud.updateStats(cityState);
    hud.updateInspector(cityState, x, y);
  },
  onTileHover(x, y) {
    hoverCoord = { x, y };
    hud.updateInspector(cityState, x, y);
  },
});

hud.setRendererBadge(sceneCtrl.mode);
hud.syncSlidersFromState(cityState);
sceneCtrl.renderCity(cityState);
hud.updateStats(cityState);
hud.updateInspector(cityState, hoverCoord.x, hoverCoord.y);

const INTERVAL_BY_SPEED = { 1: 1350, 2: 650, 3: 300 };
let elapsedMs = 0;
let lastFrame = performance.now();

function tickLoop(now) {
  requestAnimationFrame(tickLoop);
  const delta = now - lastFrame;
  lastFrame = now;

  if (simSpeed === 0) return;
  elapsedMs += delta;
  if (elapsedMs >= (INTERVAL_BY_SPEED[simSpeed] ?? 1350)) {
    elapsedMs = 0;
    stepSimulation(cityState);
    sceneCtrl.renderCity(cityState);
    hud.updateStats(cityState);
    hud.updateInspector(cityState, hoverCoord.x, hoverCoord.y);
  }
}
requestAnimationFrame(tickLoop);
