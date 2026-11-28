import assert from "node:assert/strict";
import test from "node:test";

import {
  BIOME_PRESETS,
  GRID_SIZE,
  createEmptyCity,
  createStarterCity,
  getRailNetwork,
  getRoadLaneCount,
  getRoadNetwork,
  getTileInfoMetric,
  getTrafficSignalPhase,
  placeTile,
  setPolicyBudgets,
  setTaxRate,
  stepSimulation,
} from "../src/simulation/policyEngine.js";

test("24x24 grid supports all 4 selectable terrain biomes and protects CITY_HALL", () => {
  for (const biomeKey of Object.keys(BIOME_PRESETS)) {
    const city = createStarterCity(biomeKey);
    assert.equal(city.grid.length, 24);
    assert.equal(GRID_SIZE, 24);
    const { x, y } = BIOME_PRESETS[biomeKey].hallCoord;
    assert.equal(city.grid[y][x].type, "CITY_HALL");
    assert.equal(placeTile(city, x, y, "BULLDOZE").reason, "PROTECTED_LANDMARK");
  }
});

test("Multi-lane roads (2, 4, 6, and 10 lanes) register exact lane capacities and bridge spans", () => {
  const city = createEmptyCity({ startingTreasury: 2000, biome: "HEARTLAND_PLAINS" });
  placeTile(city, 4, 5, "ROAD");
  placeTile(city, 5, 5, "ROAD_4L");
  placeTile(city, 6, 5, "ROAD_6L");
  placeTile(city, 7, 5, "ROAD_10L");

  assert.equal(getRoadLaneCount("ROAD"), 2);
  assert.equal(getRoadLaneCount("ROAD_4L"), 4);
  assert.equal(getRoadLaneCount("ROAD_6L"), 6);
  assert.equal(getRoadLaneCount("ROAD_10L"), 10);

  const net = getRoadNetwork(city);
  assert.equal(net.length, 4);
  assert.equal(net.find((r) => r.x === 7).lanes, 10);
});

test("HYDRO_DAM requires WATER cell and generates 480 MW clean hydroelectric power", () => {
  const valley = createEmptyCity({ startingTreasury: 3000, biome: "RIVER_VALLEY" });
  const dryAttempt = placeTile(valley, 5, 5, "HYDRO_DAM");
  assert.equal(dryAttempt.ok, false);
  assert.equal(dryAttempt.reason, "REQUIRES_WATER_RIVER_OR_BAY");

  let waterCell = null;
  for (let y = 0; y < GRID_SIZE && !waterCell; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      if (valley.grid[y][x].terrain === "WATER") waterCell = { x, y };
    }
  }
  const dam = placeTile(valley, waterCell.x, waterCell.y, "HYDRO_DAM");
  assert.equal(dam.ok, true);
  assert.equal(valley.metrics.powerSupply >= 480, true);
});

test("Rail family (TRAM, RAIL, and BTS Skytrain) builds tracks, links stations, and drives ridership", () => {
  const city = createEmptyCity({ startingTreasury: 5000, biome: "HEARTLAND_PLAINS" });
  placeTile(city, 2, 2, "SOLAR_PLANT");
  placeTile(city, 3, 2, "WATER_TOWER");

  for (let x = 6; x <= 10; x += 1) {
    placeTile(city, x, 8, "BTS_TRACK");
    placeTile(city, x, 10, "RAIL_TRACK");
    placeTile(city, x, 12, "TRAM_TRACK");
  }
  placeTile(city, 7, 7, "BTS_STATION");
  placeTile(city, 7, 9, "TRAIN_STATION");
  placeTile(city, 7, 11, "TRAM_STOP");
  placeTile(city, 8, 13, "RESIDENTIAL");

  for (let i = 0; i < 5; i += 1) stepSimulation(city);

  assert.equal(getRailNetwork(city, "BTS_TRACK").length, 5);
  assert.equal(getRailNetwork(city, "RAIL_TRACK").length, 5);
  assert.equal(getRailNetwork(city, "TRAM_TRACK").length, 5);
  assert.equal(city.metrics.railStations, 3);
  assert.equal(city.metrics.transitRidership > 0, true);
});

test("Sports & Mall landmarks (FOOTBALL_STADIUM, SPORTS_COMPLEX, MEGA_MALL) boost jobs, happiness, and tax", () => {
  const city = createEmptyCity({ startingTreasury: 5000, biome: "HEARTLAND_PLAINS" });
  placeTile(city, 2, 2, "SOLAR_PLANT");
  placeTile(city, 3, 2, "WATER_TOWER");
  placeTile(city, 8, 8, "ROAD_6L");
  placeTile(city, 9, 8, "ROAD_6L");
  placeTile(city, 10, 8, "ROAD_6L");
  placeTile(city, 8, 9, "MEGA_MALL");
  placeTile(city, 9, 9, "FOOTBALL_STADIUM");
  placeTile(city, 10, 9, "SPORTS_COMPLEX");
  placeTile(city, 8, 7, "RESIDENTIAL");

  stepSimulation(city);

  assert.equal(city.metrics.commercialJobs >= 300, true);
  assert.equal(city.grid[9][8].taxYield > 0, true);
  assert.equal(city.grid[7][8].happiness >= 90, true);
});

test("Intersections mount 3-phase traffic signals and transition GREEN -> YELLOW -> RED", () => {
  const p1 = getTrafficSignalPhase(1000, 10, 10);
  const p2 = getTrafficSignalPhase(4500, 10, 10);
  const p3 = getTrafficSignalPhase(6000, 10, 10);
  assert.deepEqual(p1, { ns: "GREEN", ew: "RED" });
  assert.deepEqual(p2, { ns: "YELLOW", ew: "RED" });
  assert.deepEqual(p3, { ns: "RED", ew: "GREEN" });
});

test("Zone isolated without adjacent ROAD flags NO_ROAD and never upgrades", () => {
  const city = createEmptyCity({ startingTreasury: 2000, biome: "HEARTLAND_PLAINS" });
  placeTile(city, 1, 1, "SOLAR_PLANT");
  placeTile(city, 2, 1, "WATER_TOWER");
  placeTile(city, 8, 8, "RESIDENTIAL");
  stepSimulation(city);
  assert.equal(city.grid[8][8].issue, "NO_ROAD");
});

test("Utility deficit flags NO_POWER / NO_WATER until utilities are constructed", () => {
  const city = createEmptyCity({ startingTreasury: 2000, biome: "HEARTLAND_PLAINS" });
  placeTile(city, 6, 6, "ROAD");
  placeTile(city, 6, 7, "RESIDENTIAL");
  assert.equal(city.grid[7][6].issue, "NO_POWER");
  placeTile(city, 2, 2, "WIND_TURBINE");
  assert.equal(city.grid[7][6].issue, "NO_WATER");
  placeTile(city, 3, 2, "WATER_TOWER");
  assert.equal(city.grid[7][6].issue, null);
});

test("Spatial adjacency & Green Subsidy mitigate industrial smog next to homes", () => {
  const city = createEmptyCity({ startingTreasury: 3000, biome: "HEARTLAND_PLAINS" });
  placeTile(city, 1, 1, "SOLAR_PLANT");
  placeTile(city, 2, 1, "WATER_TOWER");
  placeTile(city, 10, 10, "ROAD");
  placeTile(city, 11, 10, "ROAD");
  placeTile(city, 10, 11, "RESIDENTIAL");
  placeTile(city, 11, 11, "INDUSTRIAL");

  const baseSmog = city.grid[11][10].pollution;
  setPolicyBudgets(city, { greenSubsidyPct: 100 });
  assert.equal(city.grid[11][10].pollution < baseSmog, true);
  setTaxRate(city, 20);
  assert.equal(city.taxRate, 20);
});

test("Info Views compute normalized 0..1 heatmap scores across all 4 modes", () => {
  const city = createStarterCity("COASTAL_BAY");
  const { x, y } = BIOME_PRESETS.COASTAL_BAY.hallCoord;
  const hallTile = city.grid[y][x];
  for (const mode of ["FISCAL", "APPROVAL", "INFRA", "POLLUTION"]) {
    const score = getTileInfoMetric(hallTile, mode);
    assert.equal(score >= 0 && score <= 1, true);
  }
});
