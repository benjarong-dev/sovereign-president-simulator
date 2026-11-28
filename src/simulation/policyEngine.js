/**
 * Deterministic 16x16 Spatial City-Builder & Fiscal Simulation Engine.
 * Zero external dependencies — pure ES Module compatible with browser & Node.js.
 */

export const GRID_SIZE = 16;

export const TILE_SPECS = Object.freeze({
  EMPTY: { label: "Empty Land", cost: 0, upkeep: 0, powerUse: 0, waterUse: 0, zone: false },
  ROAD: { label: "Road", cost: 20, upkeep: 1, powerUse: 0, waterUse: 0, zone: false },
  RESIDENTIAL: { label: "Residential Zone (R)", cost: 60, upkeep: 0, powerUse: 4, waterUse: 5, zone: true },
  COMMERCIAL: { label: "Commercial Zone (C)", cost: 80, upkeep: 0, powerUse: 6, waterUse: 4, zone: true },
  INDUSTRIAL: { label: "Industrial Zone (I)", cost: 100, upkeep: 0, powerUse: 10, waterUse: 7, zone: true },
  WIND_TURBINE: { label: "Wind Power (120 MW)", cost: 220, upkeep: 8, powerUse: -120, waterUse: 0, zone: false },
  WATER_TOWER: { label: "Water Tower (120 kL)", cost: 180, upkeep: 6, powerUse: 3, waterUse: -120, zone: false },
  SCHOOL: { label: "Public School", cost: 260, upkeep: 12, powerUse: 8, waterUse: 6, zone: false },
  HOSPITAL: { label: "City Hospital", cost: 320, upkeep: 16, powerUse: 12, waterUse: 10, zone: false },
  PARK: { label: "Urban Park", cost: 90, upkeep: 3, powerUse: 1, waterUse: 2, zone: false },
});

export const BULLDOZE_COST = 5;

const RES_CAP_BY_LEVEL = [0, 24, 64, 120];
const COM_JOBS_BY_LEVEL = [0, 18, 48, 92];
const IND_JOBS_BY_LEVEL = [0, 28, 68, 125];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function createTile(x, y, type = "EMPTY", level = 0) {
  return {
    x,
    y,
    type,
    level,
    growthProgress: 0,
    pollution: 0,
    happiness: 75,
    roadConnected: false,
    powered: true,
    watered: true,
    issue: null,
  };
}

/**
 * Create a clean 16x16 blank city map.
 */
export function createEmptyCity({ startingTreasury = 3000, taxRate = 11 } = {}) {
  const grid = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x += 1) {
      row.push(createTile(x, y, "EMPTY", 0));
    }
    grid.push(row);
  }

  const state = {
    gridSize: GRID_SIZE,
    day: 1,
    treasury: startingTreasury,
    netCashflow: 0,
    taxRate: clamp(taxRate, 4, 25),
    grid,
    metrics: {
      population: 0,
      commercialJobs: 0,
      industrialJobs: 0,
      totalJobs: 0,
      unemploymentPct: 0,
      approval: 75,
      avgPollution: 0,
      powerSupply: 0,
      powerDemand: 0,
      waterSupply: 0,
      waterDemand: 0,
      demand: { residential: 60, commercial: 35, industrial: 45 },
    },
  };

  recomputeSpatialMetrics(state);
  return state;
}

/**
 * Create a playable starter town with connected crossroads, utilities, and initial RCI districts.
 */
export function createStarterCity() {
  const state = createEmptyCity({ startingTreasury: 4200, taxRate: 10 });

  for (let i = 3; i <= 12; i += 1) {
    placeTile(state, i, 7, "ROAD");
    placeTile(state, 7, i, "ROAD");
  }

  placeTile(state, 3, 6, "WIND_TURBINE");
  placeTile(state, 4, 6, "WATER_TOWER");

  placeTile(state, 5, 6, "RESIDENTIAL");
  placeTile(state, 6, 6, "RESIDENTIAL");
  placeTile(state, 5, 8, "RESIDENTIAL");
  placeTile(state, 6, 8, "PARK");
  placeTile(state, 6, 5, "SCHOOL");

  placeTile(state, 8, 6, "COMMERCIAL");
  placeTile(state, 9, 6, "COMMERCIAL");

  placeTile(state, 11, 8, "INDUSTRIAL");
  placeTile(state, 12, 8, "INDUSTRIAL");

  for (let tick = 0; tick < 6; tick += 1) {
    stepSimulation(state);
  }

  return state;
}

export function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

export function setTaxRate(state, nextTaxRate) {
  state.taxRate = clamp(Math.round(Number(nextTaxRate) || 10), 4, 25);
  recomputeSpatialMetrics(state);
  return state;
}

/**
 * Place a zone, road, utility, service building, or bulldoze an existing tile.
 */
export function placeTile(state, x, y, toolType) {
  if (!inBounds(x, y)) {
    return { ok: false, reason: "OUT_OF_BOUNDS" };
  }

  const current = state.grid[y][x];

  if (toolType === "BULLDOZE") {
    if (current.type === "EMPTY") {
      return { ok: true, cost: 0, tile: current };
    }
    if (state.treasury < BULLDOZE_COST) {
      return { ok: false, reason: "INSUFFICIENT_FUNDS" };
    }
    state.treasury -= BULLDOZE_COST;
    state.grid[y][x] = createTile(x, y, "EMPTY", 0);
    recomputeSpatialMetrics(state);
    return { ok: true, cost: BULLDOZE_COST, tile: state.grid[y][x] };
  }

  const spec = TILE_SPECS[toolType];
  if (!spec) {
    return { ok: false, reason: "UNKNOWN_TOOL" };
  }

  if (current.type === toolType) {
    return { ok: true, cost: 0, tile: current };
  }

  if (state.treasury < spec.cost) {
    return { ok: false, reason: "INSUFFICIENT_FUNDS" };
  }

  state.treasury -= spec.cost;
  const initialLevel = spec.zone ? 0 : 1;
  state.grid[y][x] = createTile(x, y, toolType, initialLevel);
  recomputeSpatialMetrics(state);

  return { ok: true, cost: spec.cost, tile: state.grid[y][x] };
}

function hasAdjacentRoad(grid, x, y) {
  const dirs = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny) && grid[ny][nx].type === "ROAD") {
      return true;
    }
  }
  return false;
}

/**
 * Return all road coordinates with neighbor bitmasks for rendering intersections & moving vehicles.
 */
export function getRoadNetwork(state) {
  const roads = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (state.grid[y][x].type !== "ROAD") continue;
      const neighbors = [];
      if (inBounds(x, y - 1) && state.grid[y - 1][x].type === "ROAD") neighbors.push({ x, y: y - 1 });
      if (inBounds(x + 1, y) && state.grid[y][x + 1].type === "ROAD") neighbors.push({ x: x + 1, y });
      if (inBounds(x, y + 1) && state.grid[y + 1][x].type === "ROAD") neighbors.push({ x, y: y + 1 });
      if (inBounds(x - 1, y) && state.grid[y][x - 1].type === "ROAD") neighbors.push({ x: x - 1, y });
      roads.push({ x, y, neighbors });
    }
  }
  return roads;
}

/**
 * Compute spatial pollution, utility supply/demand, service coverage, happiness, and RCI demand.
 */
export function recomputeSpatialMetrics(state) {
  const emitters = [];
  const services = [];
  let powerSupply = 0;
  let powerDemand = 0;
  let waterSupply = 0;
  let waterDemand = 0;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (tile.type === "EMPTY") continue;

      const spec = TILE_SPECS[tile.type];
      const scale = spec.zone ? Math.max(1, tile.level) : 1;

      if (spec.powerUse < 0) powerSupply += Math.abs(spec.powerUse);
      else powerDemand += spec.powerUse * scale;

      if (spec.waterUse < 0) waterSupply += Math.abs(spec.waterUse);
      else waterDemand += spec.waterUse * scale;

      if (tile.type === "INDUSTRIAL") {
        emitters.push({ x, y, strength: 42 + tile.level * 14 });
      } else if (tile.type === "PARK" || tile.type === "SCHOOL" || tile.type === "HOSPITAL") {
        services.push({ x, y, type: tile.type, connected: hasAdjacentRoad(state.grid, x, y) || tile.type === "PARK" });
      }
    }
  }

  const poweredGlobal = powerSupply >= powerDemand && (powerDemand === 0 || powerSupply > 0);
  const wateredGlobal = waterSupply >= waterDemand && (waterDemand === 0 || waterSupply > 0);

  let population = 0;
  let commercialJobs = 0;
  let industrialJobs = 0;
  let happinessSum = 0;
  let inhabitedZones = 0;
  let pollutionSum = 0;
  let activeTiles = 0;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (tile.type === "EMPTY") {
        tile.pollution = 0;
        tile.issue = null;
        continue;
      }

      activeTiles += 1;
      tile.roadConnected = tile.type === "ROAD" ? true : hasAdjacentRoad(state.grid, x, y);

      let rawPollution = 0;
      for (const em of emitters) {
        const dist = Math.abs(em.x - x) + Math.abs(em.y - y);
        if (dist === 0) rawPollution += em.strength;
        else if (dist === 1) rawPollution += Math.round(em.strength * 0.9);
        else if (dist === 2) rawPollution += Math.round(em.strength * 0.55);
        else if (dist === 3) rawPollution += Math.round(em.strength * 0.25);
      }

      let schoolBonus = 0;
      let hospitalBonus = 0;
      let parkBonus = 0;
      let parkScrub = 0;

      for (const srv of services) {
        if (!srv.connected) continue;
        const dist = Math.abs(srv.x - x) + Math.abs(srv.y - y);
        if (srv.type === "PARK" && dist <= 2) {
          parkBonus = Math.max(parkBonus, 12);
          parkScrub += 18;
        } else if (srv.type === "SCHOOL" && dist <= 4) {
          schoolBonus = 16;
        } else if (srv.type === "HOSPITAL" && dist <= 5) {
          hospitalBonus = 20;
        }
      }

      tile.pollution = clamp(rawPollution - parkScrub, 0, 100);
      pollutionSum += tile.pollution;

      const spec = TILE_SPECS[tile.type];
      tile.powered = spec.powerUse <= 0 ? true : poweredGlobal;
      tile.watered = spec.waterUse <= 0 ? true : wateredGlobal;

      if (spec.zone) {
        const taxPenalty = Math.max(0, (state.taxRate - 10) * 2.5);
        const pollutionPenalty =
          tile.type === "RESIDENTIAL"
            ? tile.pollution * 0.85
            : tile.type === "COMMERCIAL"
              ? tile.pollution * 0.45
              : 0;

        let baseHappy = 68 + schoolBonus + hospitalBonus + parkBonus - taxPenalty - pollutionPenalty;
        if (!tile.roadConnected) baseHappy -= 40;
        if (!tile.powered) baseHappy -= 30;
        if (!tile.watered) baseHappy -= 30;

        tile.happiness = Math.round(clamp(baseHappy, 5, 100));

        if (!tile.roadConnected) tile.issue = "NO_ROAD";
        else if (!tile.powered) tile.issue = "NO_POWER";
        else if (!tile.watered) tile.issue = "NO_WATER";
        else if (tile.type === "RESIDENTIAL" && tile.pollution >= 35) tile.issue = "POLLUTED";
        else tile.issue = null;

        if (tile.type === "RESIDENTIAL") {
          population += RES_CAP_BY_LEVEL[tile.level];
          happinessSum += tile.happiness;
          inhabitedZones += 1;
        } else if (tile.type === "COMMERCIAL") {
          commercialJobs += COM_JOBS_BY_LEVEL[tile.level];
        } else if (tile.type === "INDUSTRIAL") {
          industrialJobs += IND_JOBS_BY_LEVEL[tile.level];
        }
      } else {
        tile.issue = null;
      }
    }
  }

  const totalJobs = commercialJobs + industrialJobs;
  const workforce = Math.round(population * 0.65);
  const unemploymentPct =
    workforce > 0 ? Math.round(clamp(((workforce - totalJobs) / workforce) * 100, 0, 100)) : 0;

  const approval = inhabitedZones > 0 ? Math.round(happinessSum / inhabitedZones) : 75;
  const avgPollution = activeTiles > 0 ? Math.round(pollutionSum / activeTiles) : 0;

  const taxDrag = (state.taxRate - 10) * 4;
  const resDemand = clamp(Math.round(45 + (totalJobs - workforce) * 0.8 - taxDrag), -100, 100);
  const comDemand = clamp(Math.round(30 + (population * 0.35 - commercialJobs) * 1.1 - taxDrag), -100, 100);
  const indDemand = clamp(Math.round(40 + (workforce - totalJobs) * 0.7 - taxDrag * 0.8), -100, 100);

  state.metrics = {
    population,
    commercialJobs,
    industrialJobs,
    totalJobs,
    unemploymentPct,
    approval,
    avgPollution,
    powerSupply,
    powerDemand,
    waterSupply,
    waterDemand,
    demand: {
      residential: resDemand,
      commercial: comDemand,
      industrial: indDemand,
    },
  };

  return state.metrics;
}

/**
 * Advance city simulation by 1 day: grow/downgrade connected zones and settle daily municipal budget.
 */
export function stepSimulation(state) {
  recomputeSpatialMetrics(state);
  const { demand } = state.metrics;

  let upkeepTotal = 0;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (tile.type === "EMPTY") continue;

      const spec = TILE_SPECS[tile.type];
      upkeepTotal += spec.upkeep;

      if (!spec.zone) continue;

      const zoneDemand =
        tile.type === "RESIDENTIAL"
          ? demand.residential
          : tile.type === "COMMERCIAL"
            ? demand.commercial
            : demand.industrial;

      const canGrow =
        tile.roadConnected &&
        tile.powered &&
        tile.watered &&
        tile.issue !== "POLLUTED" &&
        zoneDemand > -15;

      if (canGrow && tile.happiness >= 45) {
        const speed = 35 + Math.max(0, Math.round(zoneDemand * 0.35)) + Math.round((tile.happiness - 50) * 0.4);
        tile.growthProgress += speed;
        if (tile.growthProgress >= 100 && tile.level < 3) {
          tile.level += 1;
          tile.growthProgress = 0;
        }
      } else if ((!tile.roadConnected || !tile.powered || !tile.watered || tile.happiness < 28) && tile.level > 0) {
        tile.growthProgress -= 50;
        if (tile.growthProgress <= -100) {
          tile.level -= 1;
          tile.growthProgress = 0;
        }
      }
    }
  }

  recomputeSpatialMetrics(state);

  const taxFactor = state.taxRate / 100;
  const resTax = state.metrics.population * 1.35 * taxFactor;
  const comTax = state.metrics.commercialJobs * 2.1 * taxFactor;
  const indTax = state.metrics.industrialJobs * 1.85 * taxFactor;
  const grossRevenue = Math.round(resTax + comTax + indTax);

  state.netCashflow = grossRevenue - upkeepTotal;
  state.treasury += state.netCashflow;
  state.day += 1;

  return state;
}
