/**
 * Deterministic 24x24 Megacity Engine (V4):
 * - 2, 4, 6, and 10-lane roads & bridges
 * - Tram, Heavy Rail, and Elevated BTS Skytrain tracks + stations
 * - Hydroelectric Dam (water-only high-output clean power)
 * - Sports category (Football Stadium, Sports Complex) & Mega Mall
 * Pure ES Module — zero external dependencies.
 */

export const GRID_SIZE = 24;

export const BIOME_PRESETS = Object.freeze({
  RIVER_VALLEY: { id: "RIVER_VALLEY", label: "ลุ่มแม่น้ำสายหลัก (River Valley)", hallCoord: { x: 7, y: 11 } },
  COASTAL_BAY: { id: "COASTAL_BAY", label: "อ่าวชายฝั่งทะเล (Coastal Bay)", hallCoord: { x: 11, y: 9 } },
  ALPINE_HIGHLANDS: { id: "ALPINE_HIGHLANDS", label: "หุบเขาอัลไพน์ (Alpine Highlands)", hallCoord: { x: 11, y: 12 } },
  HEARTLAND_PLAINS: { id: "HEARTLAND_PLAINS", label: "ที่ราบอุดมสมบูรณ์ (Heartland Plains)", hallCoord: { x: 11, y: 11 } },
});

export const ROAD_TYPES = new Set(["ROAD", "ROAD_4L", "ROAD_6L", "ROAD_10L", "TRAM_TRACK"]);
export const RAIL_TRACK_TYPES = new Set(["TRAM_TRACK", "RAIL_TRACK", "BTS_TRACK"]);
export const RAIL_STATION_TYPES = new Set(["TRAM_STOP", "TRAIN_STATION", "BTS_STATION"]);

export function isRoadTileType(type) {
  return ROAD_TYPES.has(type);
}

export function getRoadLaneCount(type) {
  if (type === "ROAD_10L") return 10;
  if (type === "ROAD_6L") return 6;
  if (type === "ROAD_4L") return 4;
  if (type === "ROAD" || type === "TRAM_TRACK") return 2;
  return 0;
}

export const TILE_SPECS = Object.freeze({
  EMPTY: { label: "พื้นที่ธรรมชาติ", category: "NONE", cost: 0, upkeep: 0, powerUse: 0, waterUse: 0, zone: false },
  CITY_HALL: { label: "ศาลาว่าการกลาง", category: "LANDMARK", cost: 0, upkeep: 10, powerUse: 8, waterUse: 6, zone: false },

  // Multi-lane Roads (2 to 10 Lanes)
  ROAD: { label: "ถนนซอย 2 เลนสวน", category: "ROADS", lanes: 2, cost: 20, bridgeCost: 45, upkeep: 1, powerUse: 0, waterUse: 0, zone: false },
  ROAD_4L: { label: "ถนนสายหลัก 4 เลน", category: "ROADS", lanes: 4, cost: 40, bridgeCost: 75, upkeep: 2, powerUse: 1, waterUse: 0, zone: false },
  ROAD_6L: { label: "ถนนบูเลอวาร์ด 6 เลน", category: "ROADS", lanes: 6, cost: 65, bridgeCost: 110, upkeep: 3, powerUse: 1, waterUse: 0, zone: false },
  ROAD_10L: { label: "ซูเปอร์ไฮเวย์ 10 เลน", category: "ROADS", lanes: 10, cost: 110, bridgeCost: 175, upkeep: 5, powerUse: 2, waterUse: 0, zone: false },
  BUS_DEPOT: { label: "อู่รถเมล์ไฟฟ้าสาธารณะ", category: "ROADS", cost: 180, upkeep: 8, powerUse: 5, waterUse: 3, zone: false },

  // Rail Family: Tram, Heavy Rail & Elevated BTS Skytrain
  TRAM_TRACK: { label: "รางรถรางไฟฟ้า (ถนน+ราง)", category: "RAIL", lanes: 2, railMode: "TRAM", cost: 45, bridgeCost: 80, upkeep: 2, powerUse: 2, waterUse: 0, zone: false },
  TRAM_STOP: { label: "สถานีจอดรถราง (Tram Stop)", category: "RAIL", railMode: "TRAM", cost: 150, upkeep: 6, powerUse: 4, waterUse: 2, zone: false },
  RAIL_TRACK: { label: "รางรถไฟชานเมือง (Heavy Rail)", category: "RAIL", railMode: "RAIL", cost: 55, bridgeCost: 95, upkeep: 2, powerUse: 2, waterUse: 0, zone: false },
  TRAIN_STATION: { label: "สถานีรถไฟกลาง (Train Station)", category: "RAIL", railMode: "RAIL", cost: 280, upkeep: 14, powerUse: 10, waterUse: 6, zone: false },
  BTS_TRACK: { label: "รางรถไฟฟ้าลอยฟ้า BTS", category: "RAIL", railMode: "BTS", cost: 75, bridgeCost: 115, upkeep: 3, powerUse: 3, waterUse: 0, zone: false },
  BTS_STATION: { label: "สถานีรถไฟฟ้า BTS Skytrain", category: "RAIL", railMode: "BTS", cost: 340, upkeep: 16, powerUse: 14, waterUse: 6, zone: false },
  TRANSIT_HUB: { label: "ศูนย์คมนาคมร่วม", category: "RAIL", railMode: "HUB", cost: 240, upkeep: 11, powerUse: 7, waterUse: 4, zone: false },

  // Zones & Mega Commercial Mall
  RESIDENTIAL: { label: "โซนที่อยู่อาศัย (R)", category: "ZONES", cost: 60, upkeep: 0, powerUse: 4, waterUse: 5, zone: true },
  COMMERCIAL: { label: "โซนพาณิชยกรรม (C)", category: "ZONES", cost: 80, upkeep: 0, powerUse: 6, waterUse: 4, zone: true },
  INDUSTRIAL: { label: "โซนอุตสาหกรรม (I)", category: "ZONES", cost: 100, upkeep: 0, powerUse: 10, waterUse: 7, zone: true },
  MEGA_MALL: { label: "ห้างสรรพสินค้าเมกะมอลล์", category: "ZONES", cost: 420, upkeep: 18, powerUse: 18, waterUse: 14, zone: false },

  // Sports & Parks Category
  FOOTBALL_STADIUM: { label: "สนามฟุตบอลสเตเดียม", category: "SPORTS", cost: 480, upkeep: 22, powerUse: 20, waterUse: 15, zone: false },
  SPORTS_COMPLEX: { label: "ศูนย์กีฬาและสระโอลิมปิก", category: "SPORTS", cost: 290, upkeep: 12, powerUse: 10, waterUse: 10, zone: false },
  PARK: { label: "สวนสาธารณะร่มรื่น", category: "SPORTS", cost: 90, upkeep: 3, powerUse: 1, waterUse: 2, zone: false },
  PLAZA: { label: "จัตุรัสน้ำพุแลนด์มาร์ก", category: "SPORTS", cost: 190, upkeep: 6, powerUse: 3, waterUse: 3, zone: false },

  // Utilities including Hydroelectric Dam
  HYDRO_DAM: { label: "เขื่อนผลิตไฟฟ้าพลังน้ำ (480 MW)", category: "UTILITY", waterOnly: true, cost: 520, upkeep: 18, powerUse: -480, waterUse: -60, zone: false },
  SOLAR_PLANT: { label: "โรงไฟฟ้าโซลาร์ (240 MW)", category: "UTILITY", cost: 360, upkeep: 13, powerUse: -240, waterUse: 2, zone: false },
  WIND_TURBINE: { label: "กังหันลม (140 MW)", category: "UTILITY", cost: 220, upkeep: 8, powerUse: -140, waterUse: 0, zone: false },
  WATER_TOWER: { label: "หอประปาสูง (150 kL)", category: "UTILITY", cost: 180, upkeep: 6, powerUse: 3, waterUse: -150, zone: false },

  // Civic Services
  SCHOOL: { label: "โรงเรียนเทศบาล", category: "CIVIC", cost: 260, upkeep: 12, powerUse: 8, waterUse: 6, zone: false },
  HOSPITAL: { label: "โรงพยาบาลศูนย์", category: "CIVIC", cost: 320, upkeep: 16, powerUse: 12, waterUse: 10, zone: false },
  SAFETY_HQ: { label: "สถานีตำรวจ-ดับเพลิง", category: "CIVIC", cost: 240, upkeep: 11, powerUse: 7, waterUse: 5, zone: false },
});

export const BULLDOZE_COST = 5;

const RES_CAP_BY_LEVEL = [0, 28, 74, 140];
const COM_JOBS_BY_LEVEL = [0, 22, 56, 108];
const IND_JOBS_BY_LEVEL = [0, 30, 76, 142];

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

export function getTrafficSignalPhase(nowMs, ix = 0, iy = 0) {
  const offsetMs = ((ix + iy) % 2) * 2500;
  const cycleSec = ((((nowMs + offsetMs) % 10000) + 10000) % 10000) / 1000;
  if (cycleSec < 4.0) return { ns: "GREEN", ew: "RED" };
  if (cycleSec < 5.0) return { ns: "YELLOW", ew: "RED" };
  if (cycleSec < 9.0) return { ns: "RED", ew: "GREEN" };
  return { ns: "RED", ew: "YELLOW" };
}

function computeTerrainCell(biomeId, x, y) {
  if (biomeId === "RIVER_VALLEY") {
    const riverCenter = 14.0 + Math.sin(y * 0.32) * 1.8;
    const dist = Math.abs(x - riverCenter);
    if (dist < 1.35) return { terrain: "WATER", elevation: 0.0, trees: 0 };
    if (dist < 2.2) return { terrain: "SAND", elevation: 0.14, trees: 0 };
    if ((x < 3 && y < 6) || (x > 20 && y > 18)) return { terrain: "HILL", elevation: 0.48, trees: 2 };
    const trees = (x * 7 + y * 13) % 6 === 0 ? 2 : 0;
    return { terrain: "GRASS", elevation: 0.18, trees };
  }

  if (biomeId === "COASTAL_BAY") {
    const coastLine = 17.2 + Math.sin(x * 0.32) * 2.1;
    if (y > coastLine + 1.1) return { terrain: "WATER", elevation: 0.0, trees: 0 };
    if (y > coastLine - 0.3) return { terrain: "SAND", elevation: 0.14, trees: 0 };
    if (y < 3 && (x < 7 || x > 16)) return { terrain: "HILL", elevation: 0.52, trees: 2 };
    const trees = (x * 11 + y * 5) % 6 === 0 ? 2 : 0;
    return { terrain: "GRASS", elevation: 0.18, trees };
  }

  if (biomeId === "ALPINE_HIGHLANDS") {
    const edgeDist = Math.min(x, y, GRID_SIZE - 1 - x, GRID_SIZE - 1 - y);
    if (edgeDist === 0 || (edgeDist === 1 && (x + y) % 3 !== 0)) {
      return { terrain: "MOUNTAIN", elevation: 1.25, trees: 0 };
    }
    if (edgeDist <= 2) return { terrain: "HILL", elevation: 0.54, trees: 2 };
    const lakeDist = Math.hypot(x - 17.5, y - 7.5);
    if (lakeDist < 2.3) return { terrain: "WATER", elevation: 0.0, trees: 0 };
    if (lakeDist < 3.0) return { terrain: "SAND", elevation: 0.15, trees: 0 };
    const trees = (x * 5 + y * 9) % 4 === 0 ? 3 : 0;
    return { terrain: "GRASS", elevation: 0.2, trees };
  }

  const pondDist = Math.hypot(x - 19, y - 18);
  if (pondDist < 2.2) return { terrain: "WATER", elevation: 0.0, trees: 0 };
  if (pondDist < 2.9) return { terrain: "SAND", elevation: 0.14, trees: 0 };
  if (x >= 2 && x <= 4 && y >= 18 && y <= 21) return { terrain: "HILL", elevation: 0.44, trees: 2 };
  const trees = (x * 3 + y * 11) % 6 === 0 ? 2 : 0;
  return { terrain: "GRASS", elevation: 0.18, trees };
}

export function createTile(x, y, type = "EMPTY", level = 0, terrainMeta = null) {
  const tMeta = terrainMeta ?? { terrain: "GRASS", elevation: 0.18, trees: 0 };
  const isSpanOverWater =
    (isRoadTileType(type) || RAIL_TRACK_TYPES.has(type)) && tMeta.terrain === "WATER";
  return {
    x,
    y,
    type,
    level,
    lanes: getRoadLaneCount(type),
    terrain: tMeta.terrain,
    elevation: tMeta.elevation,
    trees: tMeta.trees,
    isBridge: isSpanOverWater,
    growthProgress: 0,
    pollution: 0,
    happiness: 82,
    taxYield: 0,
    roadConnected: false,
    powered: true,
    watered: true,
    issue: null,
  };
}

export function createEmptyCity({
  startingTreasury = 8500,
  taxRate = 10,
  biome = "HEARTLAND_PLAINS",
  withCityHall = false,
} = {}) {
  const preset = BIOME_PRESETS[biome] ?? BIOME_PRESETS.HEARTLAND_PLAINS;
  const grid = [];

  for (let y = 0; y < GRID_SIZE; y += 1) {
    const row = [];
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const meta = computeTerrainCell(preset.id, x, y);
      row.push(createTile(x, y, "EMPTY", 0, meta));
    }
    grid.push(row);
  }

  const state = {
    gridSize: GRID_SIZE,
    biome: preset.id,
    biomeLabel: preset.label,
    day: 1,
    treasury: startingTreasury,
    netCashflow: 0,
    taxRate: clamp(taxRate, 4, 25),
    infraBudgetPct: 100,
    greenSubsidyPct: 20,
    grid,
    metrics: {
      population: 0,
      commercialJobs: 0,
      industrialJobs: 0,
      totalJobs: 0,
      transitLines: 0,
      railStations: 0,
      transitRidership: 0,
      pedestrianCount: 0,
      gdpIndex: 100,
      unemploymentPct: 0,
      approval: 82,
      avgPollution: 0,
      powerSupply: 0,
      powerDemand: 0,
      waterSupply: 0,
      waterDemand: 0,
      demand: { residential: 60, commercial: 45, industrial: 45 },
    },
  };

  if (withCityHall) {
    const { x: hx, y: hy } = preset.hallCoord;
    const landMeta = { terrain: "GRASS", elevation: 0.18, trees: 0 };
    state.grid[hy][hx] = createTile(hx, hy, "CITY_HALL", 3, landMeta);
  }

  recomputeSpatialMetrics(state);
  return state;
}

export function createStarterCity(biome = "RIVER_VALLEY") {
  const preset = BIOME_PRESETS[biome] ?? BIOME_PRESETS.RIVER_VALLEY;
  const state = createEmptyCity({
    startingTreasury: 14500,
    taxRate: 10,
    biome: preset.id,
    withCityHall: true,
  });

  const { x: hx, y: hy } = preset.hallCoord;

  // 10-Lane Superhighway & 6-Lane Boulevard East-West Corridors (auto-bridging river!)
  for (let x = 3; x <= 20; x += 1) {
    placeTile(state, x, hy - 1, "ROAD_6L");
    placeTile(state, x, hy + 2, "ROAD_10L");
  }
  // 4-Lane & Tram North-South avenues
  for (let y = 4; y <= 18; y += 1) {
    placeTile(state, hx - 1, y, "ROAD_4L");
    placeTile(state, hx + 2, y, "TRAM_TRACK");
  }

  // Elevated BTS Skytrain Line running East-West at y = hy - 3 + 2 BTS Stations
  for (let x = 4; x <= 19; x += 1) {
    placeTile(state, x, hy - 3, "BTS_TRACK");
  }
  placeTile(state, hx, hy - 4, "BTS_STATION");
  placeTile(state, hx + 4, hy - 4, "BTS_STATION");

  // Suburban Heavy Rail Line on West corridor x = 3
  for (let y = 4; y <= 18; y += 1) {
    if (state.grid[y][3].type === "EMPTY") {
      placeTile(state, 3, y, "RAIL_TRACK");
    }
  }
  placeTile(state, 4, 6, "TRAIN_STATION");
  placeTile(state, hx + 3, hy - 2, "TRAM_STOP");
  placeTile(state, 5, hy + 1, "BUS_DEPOT");

  // Hydroelectric Dam placed directly on WATER cell!
  let damPlaced = false;
  for (let y = 3; y < GRID_SIZE - 3 && !damPlaced; y += 1) {
    for (let x = 3; x < GRID_SIZE - 3; x += 1) {
      if (state.grid[y][x].terrain === "WATER" && state.grid[y][x].type === "EMPTY") {
        placeTile(state, x, y, "HYDRO_DAM");
        damPlaced = true;
        break;
      }
    }
  }
  if (!damPlaced) placeTile(state, 4, 4, "SOLAR_PLANT");
  placeTile(state, 4, hy + 3, "WATER_TOWER");
  placeTile(state, 5, hy + 3, "WATER_TOWER");

  // Mega Mall, Football Stadium, Sports Complex & Civic buildings
  const tryBuild = (tx, ty, tool) => {
    if (inBounds(tx, ty) && state.grid[ty][tx].type === "EMPTY") {
      placeTile(state, tx, ty, tool);
    }
  };

  tryBuild(hx + 3, hy, "MEGA_MALL");
  tryBuild(hx - 2, hy + 3, "FOOTBALL_STADIUM");
  tryBuild(hx - 3, hy + 3, "SPORTS_COMPLEX");
  tryBuild(hx + 1, hy, "PLAZA");
  tryBuild(hx, hy + 1, "PARK");
  tryBuild(hx + 1, hy + 1, "SCHOOL");
  tryBuild(hx - 2, hy, "HOSPITAL");
  tryBuild(hx - 2, hy + 1, "SAFETY_HQ");

  // Residential, Commercial & Industrial Districts
  const resCoords = [
    [hx - 3, hy - 2], [hx - 2, hy - 2], [hx, hy - 2], [hx + 1, hy - 2],
    [hx, hy + 3], [hx + 1, hy + 3], [hx + 3, hy + 3], [hx + 4, hy + 3],
  ];
  for (const [rx, ry] of resCoords) tryBuild(rx, ry, "RESIDENTIAL");

  const comCoords = [
    [hx + 4, hy], [hx + 5, hy], [hx + 3, hy + 1], [hx + 4, hy + 1], [hx + 5, hy + 1],
  ];
  for (const [cx, cy] of comCoords) tryBuild(cx, cy, "COMMERCIAL");

  tryBuild(17, hy + 3, "PARK");
  for (const [ix, iy] of [[18, hy + 3], [19, hy + 3], [18, hy + 1], [19, hy + 1]]) {
    tryBuild(ix, iy, "INDUSTRIAL");
  }

  for (let tick = 0; tick < 8; tick += 1) {
    stepSimulation(state);
  }

  state.treasury = Math.max(state.treasury, 12000);
  return state;
}

export function setTaxRate(state, nextTaxRate) {
  state.taxRate = clamp(Math.round(Number(nextTaxRate) || 10), 4, 25);
  recomputeSpatialMetrics(state);
  return state;
}

export function setPolicyBudgets(state, { infraBudgetPct, greenSubsidyPct } = {}) {
  if (infraBudgetPct !== undefined) {
    state.infraBudgetPct = clamp(Math.round(Number(infraBudgetPct) || 100), 50, 150);
  }
  if (greenSubsidyPct !== undefined) {
    state.greenSubsidyPct = clamp(Math.round(Number(greenSubsidyPct) || 0), 0, 100);
  }
  recomputeSpatialMetrics(state);
  return state;
}

export function placeTile(state, x, y, toolType) {
  if (!inBounds(x, y)) {
    return { ok: false, reason: "OUT_OF_BOUNDS" };
  }

  const current = state.grid[y][x];
  const terrainMeta = {
    terrain: current.terrain,
    elevation: current.elevation,
    trees: current.trees,
  };

  if (current.type === "CITY_HALL") {
    return { ok: false, reason: "PROTECTED_LANDMARK" };
  }

  if (toolType === "BULLDOZE") {
    if (current.type === "EMPTY") {
      return { ok: true, cost: 0, tile: current };
    }
    if (state.treasury < BULLDOZE_COST) {
      return { ok: false, reason: "INSUFFICIENT_FUNDS" };
    }
    state.treasury -= BULLDOZE_COST;
    state.grid[y][x] = createTile(x, y, "EMPTY", 0, terrainMeta);
    recomputeSpatialMetrics(state);
    return { ok: true, cost: BULLDOZE_COST, tile: state.grid[y][x] };
  }

  const spec = TILE_SPECS[toolType];
  if (!spec || toolType === "CITY_HALL" || toolType === "EMPTY") {
    return { ok: false, reason: "UNKNOWN_TOOL" };
  }

  if (current.terrain === "MOUNTAIN") {
    return { ok: false, reason: "STEEP_MOUNTAIN_TERRAIN" };
  }

  if (spec.waterOnly && current.terrain !== "WATER") {
    return { ok: false, reason: "REQUIRES_WATER_RIVER_OR_BAY" };
  }

  const canSpanWater =
    isRoadTileType(toolType) ||
    RAIL_TRACK_TYPES.has(toolType) ||
    toolType === "WIND_TURBINE" ||
    toolType === "HYDRO_DAM";

  if (current.terrain === "WATER" && !canSpanWater) {
    return { ok: false, reason: "CANNOT_BUILD_ON_WATER" };
  }

  if (current.type === toolType) {
    return { ok: true, cost: 0, tile: current };
  }

  const buildCost =
    current.terrain === "WATER" && spec.bridgeCost ? spec.bridgeCost : spec.cost;

  if (state.treasury < buildCost) {
    return { ok: false, reason: "INSUFFICIENT_FUNDS" };
  }

  state.treasury -= buildCost;
  const initialLevel = spec.zone ? 0 : 1;
  state.grid[y][x] = createTile(x, y, toolType, initialLevel, terrainMeta);
  recomputeSpatialMetrics(state);

  return { ok: true, cost: buildCost, tile: state.grid[y][x] };
}

function hasAdjacentPredicate(grid, x, y, fn) {
  const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  for (const [dx, dy] of dirs) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny) && fn(grid[ny][nx])) return true;
  }
  return false;
}

export function getRoadNetwork(state) {
  const roads = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (!isRoadTileType(tile.type)) continue;

      const n = inBounds(x, y - 1) && isRoadTileType(state.grid[y - 1][x].type);
      const e = inBounds(x + 1, y) && isRoadTileType(state.grid[y][x + 1].type);
      const s = inBounds(x, y + 1) && isRoadTileType(state.grid[y + 1][x].type);
      const w = inBounds(x - 1, y) && isRoadTileType(state.grid[y][x - 1].type);
      const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 1 : 0 ? 8 : 0);
      const cleanMask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);
      const degree = (n ? 1 : 0) + (e ? 1 : 0) + (s ? 1 : 0) + (w ? 1 : 0);

      const landToBridgeMask =
        (!tile.isBridge && n && state.grid[y - 1][x].isBridge ? 1 : 0) |
        (!tile.isBridge && e && state.grid[y][x + 1].isBridge ? 2 : 0) |
        (!tile.isBridge && s && state.grid[y + 1][x].isBridge ? 4 : 0) |
        (!tile.isBridge && w && state.grid[y][x - 1].isBridge ? 8 : 0);

      const hasBusStop =
        !tile.isBridge &&
        degree === 2 &&
        (hasAdjacentPredicate(state.grid, x, y, (t) => t.type === "BUS_DEPOT" || t.type === "TRAM_STOP" || t.type === "MEGA_MALL" || t.type === "FOOTBALL_STADIUM") ||
          ((x + y) % 5 === 0 &&
            hasAdjacentPredicate(state.grid, x, y, (t) => t.type === "RESIDENTIAL" || t.type === "COMMERCIAL")));

      const neighbors = [];
      if (n) neighbors.push({ x, y: y - 1 });
      if (e) neighbors.push({ x: x + 1, y });
      if (s) neighbors.push({ x, y: y + 1 });
      if (w) neighbors.push({ x: x - 1, y });

      roads.push({
        x,
        y,
        type: tile.type,
        lanes: getRoadLaneCount(tile.type),
        mask: cleanMask,
        degree,
        hasSignal: degree >= 3 && !tile.isBridge,
        hasBusStop,
        isBridge: tile.isBridge,
        landToBridgeMask,
        elevation: tile.elevation,
        neighbors,
      });
    }
  }
  return roads;
}

/**
 * Extract rail network graphs for TRAM_TRACK, RAIL_TRACK, or BTS_TRACK so trains/trams/BTS skytrains run & stop at stations.
 */
export function getRailNetwork(state, trackType) {
  const stationType =
    trackType === "BTS_TRACK"
      ? "BTS_STATION"
      : trackType === "RAIL_TRACK"
        ? "TRAIN_STATION"
        : "TRAM_STOP";

  const nodes = [];
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (tile.type !== trackType) continue;

      const n = inBounds(x, y - 1) && state.grid[y - 1][x].type === trackType;
      const e = inBounds(x + 1, y) && state.grid[y][x + 1].type === trackType;
      const s = inBounds(x, y + 1) && state.grid[y + 1][x].type === trackType;
      const w = inBounds(x - 1, y) && state.grid[y][x - 1].type === trackType;
      const mask = (n ? 1 : 0) | (e ? 2 : 0) | (s ? 4 : 0) | (w ? 8 : 0);

      const neighbors = [];
      if (n) neighbors.push({ x, y: y - 1 });
      if (e) neighbors.push({ x: x + 1, y });
      if (s) neighbors.push({ x, y: y + 1 });
      if (w) neighbors.push({ x: x - 1, y });

      const nearStation = hasAdjacentPredicate(
        state.grid,
        x,
        y,
        (t) => t.type === stationType || t.type === "TRANSIT_HUB"
      );

      nodes.push({
        x,
        y,
        trackType,
        mask,
        nearStation,
        isBridge: tile.isBridge,
        elevation: tile.elevation,
        neighbors,
      });
    }
  }
  return nodes;
}

export function getTileInfoMetric(tile, viewMode) {
  if (tile.type === "EMPTY") return null;
  if (viewMode === "POLLUTION") return clamp(1 - tile.pollution / 85, 0, 1);
  if (viewMode === "APPROVAL") return clamp((tile.happiness ?? 80) / 100, 0, 1);
  if (viewMode === "FISCAL") {
    const spec = TILE_SPECS[tile.type];
    const net = (tile.taxYield ?? 0) - spec.upkeep;
    return clamp((net + 18) / 65, 0, 1);
  }
  if (viewMode === "INFRA") {
    if (
      tile.type === "HYDRO_DAM" ||
      tile.type === "WIND_TURBINE" ||
      tile.type === "SOLAR_PLANT" ||
      tile.type === "WATER_TOWER" ||
      RAIL_TRACK_TYPES.has(tile.type) ||
      RAIL_STATION_TYPES.has(tile.type)
    ) {
      return 1;
    }
    if (isRoadTileType(tile.type)) return 0.85;
    if (!tile.roadConnected || !tile.powered || !tile.watered) return 0.08;
    return 0.92;
  }
  return null;
}

export function recomputeSpatialMetrics(state) {
  const infraFactor = (state.infraBudgetPct ?? 100) / 100;
  const greenFactor = 1 - ((state.greenSubsidyPct ?? 0) / 100) * 0.48;

  const emitters = [];
  const amenities = [];
  let powerSupply = 0;
  let powerDemand = 0;
  let waterSupply = 0;
  let waterDemand = 0;
  let transitLines = 0;
  let railStations = 0;
  let specialComJobs = 0;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (tile.type === "EMPTY") continue;

      const spec = TILE_SPECS[tile.type];
      const scale = spec.zone ? Math.max(1, tile.level) : 1;

      if (spec.powerUse < 0) {
        const bonus =
          tile.type === "WIND_TURBINE" && (tile.terrain === "HILL" || tile.terrain === "WATER")
            ? 1.25
            : 1.0;
        powerSupply += Math.round(Math.abs(spec.powerUse) * infraFactor * bonus);
      } else {
        powerDemand += spec.powerUse * scale;
      }

      if (spec.waterUse < 0) {
        waterSupply += Math.round(Math.abs(spec.waterUse) * infraFactor);
      } else {
        waterDemand += spec.waterUse * scale;
      }

      if (tile.type === "INDUSTRIAL") {
        emitters.push({ x, y, strength: Math.round((42 + tile.level * 14) * greenFactor) });
      } else if (tile.type === "MEGA_MALL") {
        const connected = hasAdjacentPredicate(state.grid, x, y, (t) => isRoadTileType(t.type) || RAIL_TRACK_TYPES.has(t.type));
        if (connected) specialComJobs += 160;
        amenities.push({ x, y, type: tile.type, connected });
      } else if (tile.type === "FOOTBALL_STADIUM" || tile.type === "SPORTS_COMPLEX") {
        const connected = hasAdjacentPredicate(state.grid, x, y, (t) => isRoadTileType(t.type) || RAIL_TRACK_TYPES.has(t.type));
        if (connected) specialComJobs += tile.type === "FOOTBALL_STADIUM" ? 110 : 55;
        amenities.push({ x, y, type: tile.type, connected });
      } else if (
        RAIL_STATION_TYPES.has(tile.type) ||
        tile.type === "BUS_DEPOT" ||
        tile.type === "TRANSIT_HUB"
      ) {
        const connected = hasAdjacentPredicate(
          state.grid,
          x,
          y,
          (t) => isRoadTileType(t.type) || RAIL_TRACK_TYPES.has(t.type)
        );
        amenities.push({ x, y, type: tile.type, connected });
        if (connected) {
          transitLines += 1;
          if (RAIL_STATION_TYPES.has(tile.type)) railStations += 1;
        }
      } else if (
        tile.type === "PARK" ||
        tile.type === "PLAZA" ||
        tile.type === "SCHOOL" ||
        tile.type === "HOSPITAL" ||
        tile.type === "SAFETY_HQ" ||
        tile.type === "CITY_HALL"
      ) {
        const connected =
          tile.type === "PARK" ||
          tile.type === "CITY_HALL" ||
          hasAdjacentPredicate(state.grid, x, y, (t) => isRoadTileType(t.type));
        amenities.push({ x, y, type: tile.type, connected });
      }
    }
  }

  const poweredGlobal = powerSupply >= powerDemand && (powerDemand === 0 || powerSupply > 0);
  const wateredGlobal = waterSupply >= waterDemand && (waterDemand === 0 || waterSupply > 0);

  let population = 0;
  let commercialJobs = specialComJobs;
  let industrialJobs = 0;
  let happinessSum = 0;
  let inhabitedZones = 0;
  let pollutionSum = 0;
  let activeTiles = 0;
  const taxFactor = state.taxRate / 100;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (tile.type === "EMPTY") {
        tile.pollution = 0;
        tile.taxYield = 0;
        tile.issue = null;
        continue;
      }

      activeTiles += 1;
      tile.roadConnected =
        isRoadTileType(tile.type) ||
        RAIL_TRACK_TYPES.has(tile.type) ||
        tile.type === "PARK" ||
        tile.type === "HYDRO_DAM" ||
        tile.type === "WIND_TURBINE" ||
        tile.type === "SOLAR_PLANT" ||
        tile.type === "WATER_TOWER"
          ? true
          : hasAdjacentPredicate(
              state.grid,
              x,
              y,
              (t) => isRoadTileType(t.type) || RAIL_TRACK_TYPES.has(t.type)
            );

      let rawPollution = 0;
      for (const em of emitters) {
        const dist = Math.abs(em.x - x) + Math.abs(em.y - y);
        if (dist === 0) rawPollution += em.strength;
        else if (dist === 1) rawPollution += Math.round(em.strength * 0.9);
        else if (dist === 2) rawPollution += Math.round(em.strength * 0.55);
        else if (dist === 3) rawPollution += Math.round(em.strength * 0.28);
      }

      let civicBonus = hasAdjacentPredicate(state.grid, x, y, (t) => t.terrain === "WATER") ? 9 : 0;
      let parkScrub = 0;
      let landValueMult = 1.0;

      // Multi-lane boulevard adjacency boosts commercial/mall accessibility
      if (hasAdjacentPredicate(state.grid, x, y, (t) => getRoadLaneCount(t.type) >= 6)) {
        landValueMult += 0.12;
      }

      for (const srv of amenities) {
        if (!srv.connected) continue;
        const dist = Math.abs(srv.x - x) + Math.abs(srv.y - y);
        if (srv.type === "PARK" && dist <= 3) {
          civicBonus += 10;
          parkScrub += 18;
        } else if (srv.type === "PLAZA" && dist <= 4) {
          civicBonus += 14;
          landValueMult += 0.12;
        } else if (srv.type === "FOOTBALL_STADIUM" && dist <= 7) {
          civicBonus += 22;
          landValueMult += 0.25;
        } else if (srv.type === "SPORTS_COMPLEX" && dist <= 5) {
          civicBonus += 16;
          landValueMult += 0.14;
        } else if (srv.type === "MEGA_MALL" && dist <= 6) {
          civicBonus += 15;
          landValueMult += 0.28;
        } else if (srv.type === "BTS_STATION" && dist <= 7) {
          civicBonus += 18;
          parkScrub += 14;
          landValueMult += 0.30;
        } else if (srv.type === "TRAIN_STATION" && dist <= 7) {
          civicBonus += 15;
          parkScrub += 12;
          landValueMult += 0.24;
        } else if (srv.type === "TRAM_STOP" && dist <= 5) {
          civicBonus += 12;
          parkScrub += 10;
          landValueMult += 0.18;
        } else if ((srv.type === "BUS_DEPOT" || srv.type === "TRANSIT_HUB") && dist <= 6) {
          civicBonus += 11;
          parkScrub += 10;
          landValueMult += 0.16;
        } else if (srv.type === "SCHOOL" && dist <= 5) {
          civicBonus += 13;
        } else if (srv.type === "HOSPITAL" && dist <= 6) {
          civicBonus += 15;
        } else if (srv.type === "SAFETY_HQ" && dist <= 6) {
          civicBonus += 12;
        } else if (srv.type === "CITY_HALL" && dist <= 6) {
          civicBonus += 12;
        }
      }

      tile.pollution = clamp(rawPollution - parkScrub, 0, 100);
      pollutionSum += tile.pollution;

      const spec = TILE_SPECS[tile.type];
      tile.powered = spec.powerUse <= 0 ? true : poweredGlobal;
      tile.watered = spec.waterUse <= 0 ? true : wateredGlobal;

      if (tile.type === "MEGA_MALL" && tile.roadConnected && tile.powered) {
        tile.taxYield = Math.round(380 * taxFactor * landValueMult);
        tile.issue = null;
      } else if (tile.type === "FOOTBALL_STADIUM" && tile.roadConnected && tile.powered) {
        tile.taxYield = Math.round(290 * taxFactor * landValueMult);
        tile.issue = null;
      } else if (spec.zone) {
        const taxPenalty = Math.max(0, (state.taxRate - 10) * 2.5);
        const greenHappy = Math.round(((state.greenSubsidyPct ?? 0) / 100) * 8);
        const pollutionPenalty =
          tile.type === "RESIDENTIAL"
            ? tile.pollution * 0.85
            : tile.type === "COMMERCIAL"
              ? tile.pollution * 0.45
              : 0;

        let baseHappy =
          68 + Math.min(42, civicBonus) + greenHappy - taxPenalty - pollutionPenalty;
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
          const pop = RES_CAP_BY_LEVEL[tile.level];
          population += pop;
          tile.taxYield = Math.round(pop * 1.35 * taxFactor * landValueMult);
          happinessSum += tile.happiness;
          inhabitedZones += 1;
        } else if (tile.type === "COMMERCIAL") {
          const jobs = COM_JOBS_BY_LEVEL[tile.level];
          commercialJobs += jobs;
          tile.taxYield = Math.round(jobs * 2.25 * taxFactor * infraFactor * landValueMult);
        } else if (tile.type === "INDUSTRIAL") {
          const jobs = IND_JOBS_BY_LEVEL[tile.level];
          industrialJobs += jobs;
          tile.taxYield = Math.round(jobs * 1.9 * taxFactor * infraFactor);
        }
      } else {
        tile.taxYield = 0;
        tile.issue = !tile.roadConnected ? "NO_ROAD" : null;
      }
    }
  }

  const totalJobs = commercialJobs + industrialJobs;
  const workforce = Math.round(population * 0.65);
  const unemploymentPct =
    workforce > 0 ? Math.round(clamp(((workforce - totalJobs) / workforce) * 100, 0, 100)) : 0;

  const transitRidership =
    transitLines > 0
      ? Math.min(
          population + specialComJobs,
          Math.round((population + specialComJobs * 0.5) * Math.min(0.88, transitLines * 0.18 + railStations * 0.14))
        )
      : 0;

  const pedestrianCount = Math.min(48, Math.max(6, Math.floor((population + transitRidership) / 28)));
  const approval = inhabitedZones > 0 ? Math.round(happinessSum / inhabitedZones) : 82;
  const avgPollution = activeTiles > 0 ? Math.round(pollutionSum / activeTiles) : 0;

  const gdpIndex = Math.max(
    60,
    Math.round(
      100 +
        (commercialJobs * 0.48 + industrialJobs * 0.38 + transitRidership * 0.1) * infraFactor -
        Math.max(0, state.taxRate - 12) * 2.2
    )
  );

  const taxDrag = (state.taxRate - 10) * 4;
  const resDemand = clamp(Math.round(50 + (totalJobs - workforce) * 0.8 - taxDrag), -100, 100);
  const comDemand = clamp(Math.round(38 + (population * 0.4 - commercialJobs) * 1.0 - taxDrag), -100, 100);
  const indDemand = clamp(Math.round(42 + (workforce - totalJobs) * 0.7 - taxDrag * 0.8), -100, 100);

  state.metrics = {
    population,
    commercialJobs,
    industrialJobs,
    totalJobs,
    transitLines,
    railStations,
    transitRidership,
    pedestrianCount,
    gdpIndex,
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

export function stepSimulation(state) {
  recomputeSpatialMetrics(state);
  const { demand } = state.metrics;

  let baseUpkeep = 0;

  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const tile = state.grid[y][x];
      if (tile.type === "EMPTY") continue;

      const spec = TILE_SPECS[tile.type];
      baseUpkeep += spec.upkeep + (tile.isBridge ? 1 : 0);

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
        const speed =
          36 + Math.max(0, Math.round(zoneDemand * 0.35)) + Math.round((tile.happiness - 50) * 0.42);
        tile.growthProgress += speed;
        if (tile.growthProgress >= 100 && tile.level < 3) {
          tile.level += 1;
          tile.growthProgress = 0;
        }
      } else if (
        (!tile.roadConnected || !tile.powered || !tile.watered || tile.happiness < 28) &&
        tile.level > 0
      ) {
        tile.growthProgress -= 50;
        if (tile.growthProgress <= -100) {
          tile.level -= 1;
          tile.growthProgress = 0;
        }
      }
    }
  }

  recomputeSpatialMetrics(state);

  let grossTax = 0;
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      grossTax += state.grid[y][x].taxYield ?? 0;
    }
  }

  const transitFareRevenue = Math.round((state.metrics.transitRidership ?? 0) * 0.16);
  const infraScale = (state.infraBudgetPct ?? 100) / 100;
  const greenProgramCost = Math.round(((state.greenSubsidyPct ?? 0) / 100) * 28);
  const totalOutflow = Math.round(baseUpkeep * infraScale) + greenProgramCost;

  state.netCashflow = grossTax + transitFareRevenue - totalOutflow;
  state.treasury += state.netCashflow;
  state.day += 1;

  return state;
}
