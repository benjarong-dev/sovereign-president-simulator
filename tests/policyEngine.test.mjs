import assert from "node:assert/strict";
import test from "node:test";

import {
  GRID_SIZE,
  createEmptyCity,
  createStarterCity,
  getRoadNetwork,
  placeTile,
  setTaxRate,
  stepSimulation,
} from "../src/simulation/policyEngine.js";

test("placeTile deducts build cost, guards insufficient funds, and supports BULLDOZE", () => {
  const city = createEmptyCity({ startingTreasury: 100 });
  assert.equal(city.grid.length, GRID_SIZE);

  const res = placeTile(city, 4, 4, "RESIDENTIAL");
  assert.equal(res.ok, true);
  assert.equal(city.treasury, 40);

  const tooExpensive = placeTile(city, 5, 4, "HOSPITAL");
  assert.equal(tooExpensive.ok, false);
  assert.equal(tooExpensive.reason, "INSUFFICIENT_FUNDS");

  const cleared = placeTile(city, 4, 4, "BULLDOZE");
  assert.equal(cleared.ok, true);
  assert.equal(city.grid[4][4].type, "EMPTY");
  assert.equal(city.treasury, 35);
});

test("Zone isolated without adjacent ROAD flags NO_ROAD and never upgrades", () => {
  const city = createEmptyCity({ startingTreasury: 2000 });
  placeTile(city, 1, 1, "WIND_TURBINE");
  placeTile(city, 2, 1, "WATER_TOWER");
  placeTile(city, 8, 8, "RESIDENTIAL");

  for (let i = 0; i < 6; i += 1) stepSimulation(city);

  const orphanTile = city.grid[8][8];
  assert.equal(orphanTile.roadConnected, false);
  assert.equal(orphanTile.issue, "NO_ROAD");
  assert.equal(orphanTile.level, 0);
  assert.equal(city.metrics.population, 0);
});

test("Zone connected to ROAD + Power + Water upgrades level and generates population & cashflow", () => {
  const city = createEmptyCity({ startingTreasury: 2000 });
  placeTile(city, 2, 2, "WIND_TURBINE");
  placeTile(city, 3, 2, "WATER_TOWER");
  placeTile(city, 5, 5, "ROAD");
  placeTile(city, 5, 6, "RESIDENTIAL");
  placeTile(city, 6, 5, "COMMERCIAL");

  for (let i = 0; i < 6; i += 1) stepSimulation(city);

  assert.equal(city.grid[6][5].issue, null);
  assert.equal(city.grid[6][5].level >= 1, true);
  assert.equal(city.metrics.population > 0, true);
});

test("Utility deficit flags NO_POWER / NO_WATER until Wind Turbine and Water Tower are built", () => {
  const city = createEmptyCity({ startingTreasury: 2000 });
  placeTile(city, 4, 4, "ROAD");
  placeTile(city, 4, 5, "RESIDENTIAL");

  assert.equal(city.grid[5][4].issue, "NO_POWER");

  placeTile(city, 1, 1, "WIND_TURBINE");
  assert.equal(city.grid[5][4].issue, "NO_WATER");

  placeTile(city, 2, 1, "WATER_TOWER");
  assert.equal(city.grid[5][4].issue, null);
});

test("Spatial adjacency: INDUSTRIAL next to RESIDENTIAL triggers POLLUTED penalty while PARK/SCHOOL boost happiness", () => {
  const pollutedCity = createEmptyCity({ startingTreasury: 3000 });
  placeTile(pollutedCity, 1, 1, "WIND_TURBINE");
  placeTile(pollutedCity, 2, 1, "WATER_TOWER");
  placeTile(pollutedCity, 6, 6, "ROAD");
  placeTile(pollutedCity, 7, 6, "ROAD");
  placeTile(pollutedCity, 6, 7, "RESIDENTIAL");
  placeTile(pollutedCity, 7, 7, "INDUSTRIAL");

  const cleanCity = createEmptyCity({ startingTreasury: 3000 });
  placeTile(cleanCity, 1, 1, "WIND_TURBINE");
  placeTile(cleanCity, 2, 1, "WATER_TOWER");
  placeTile(cleanCity, 6, 6, "ROAD");
  placeTile(cleanCity, 7, 6, "ROAD");
  placeTile(cleanCity, 6, 7, "RESIDENTIAL");
  placeTile(cleanCity, 7, 7, "PARK");
  placeTile(cleanCity, 5, 6, "SCHOOL");

  const smogHome = pollutedCity.grid[7][6];
  const greenHome = cleanCity.grid[7][6];

  assert.equal(smogHome.issue, "POLLUTED");
  assert.equal(smogHome.pollution >= 35, true);
  assert.equal(greenHome.happiness > smogHome.happiness + 30, true);
});

test("High tax rate depresses RCI demand and citizen approval", () => {
  const city = createStarterCity();
  setTaxRate(city, 7);
  const lowTaxResDemand = city.metrics.demand.residential;
  const lowTaxApproval = city.metrics.approval;

  setTaxRate(city, 24);
  assert.equal(city.metrics.demand.residential < lowTaxResDemand, true);
  assert.equal(city.metrics.approval < lowTaxApproval, true);
});

test("createStarterCity initializes connected road network, positive utility margins, and inhabitants", () => {
  const city = createStarterCity();
  const roads = getRoadNetwork(city);
  assert.equal(roads.length >= 15, true);
  assert.equal(city.metrics.powerSupply > city.metrics.powerDemand, true);
  assert.equal(city.metrics.waterSupply > city.metrics.waterDemand, true);
  assert.equal(city.metrics.population > 0, true);
});
