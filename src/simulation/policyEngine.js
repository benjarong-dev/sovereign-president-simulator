/**
 * Deterministic Fiscal & Urban Zoning Policy Engine
 * Pure ES Module — zero DOM or rendering dependencies.
 */

export const POLICY_COSTS = Object.freeze({
  residential: 45,
  industrial: 70,
  civic: 60,
  stimulus: 50,
});

export const TAX_BOUNDS = Object.freeze({
  min: 0.10,
  max: 0.45,
  neutral: 0.28,
});

export const GRID_LIMIT = 64;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Initializes the starting macroeconomic and urban grid state.
 */
export function createInitialState() {
  const initialDistricts = [
    { id: 1, type: 'civic', slotIndex: 27 },
    { id: 2, type: 'residential', slotIndex: 28 },
    { id: 3, type: 'residential', slotIndex: 35 },
    { id: 4, type: 'residential', slotIndex: 36 },
    { id: 5, type: 'industrial', slotIndex: 19 },
    { id: 6, type: 'industrial', slotIndex: 20 },
  ];

  return {
    year: 2026,
    quarter: 1,
    treasury: 240.0,
    gdp: 520.0,
    population: 120,
    taxRate: 0.24,
    inflationRate: 2.4,
    unemploymentRate: 4.3,
    approvalRating: 64.0,
    stimulusBoost: 0.0,
    nextDistrictId: 7,
    zones: {
      residential: 3,
      industrial: 2,
      civic: 1,
    },
    districts: initialDistricts,
    lastReport: {
      revenue: 31.2,
      expenditure: 29.1,
      netBalance: 2.1,
      laborForce: 70,
      jobsAvailable: 67,
    },
  };
}

/**
 * Picks the next unoccupied spiral/grid slot on the 8x8 board deterministically.
 */
function findNextAvailableSlot(districts) {
  const occupied = new Set(districts.map((d) => d.slotIndex));
  const centerOrder = [
    27, 28, 35, 36, 18, 19, 20, 21, 26, 29, 34, 37, 42, 43, 44, 45,
    9, 10, 11, 12, 13, 14, 17, 22, 25, 30, 33, 38, 41, 46, 49, 50,
    51, 52, 53, 54,
  ];

  for (const slot of centerOrder) {
    if (!occupied.has(slot)) {
      return slot;
    }
  }

  for (let i = 0; i < GRID_LIMIT; i += 1) {
    if (!occupied.has(i)) {
      return i;
    }
  }

  return -1;
}

/**
 * Updates the effective tax rate within statutory bounds (10% - 45%).
 */
export function setTaxRate(state, newRate) {
  const numericRate = Number(newRate);
  if (Number.isNaN(numericRate)) {
    return state;
  }

  return {
    ...state,
    taxRate: round2(clamp(numericRate, TAX_BOUNDS.min, TAX_BOUNDS.max)),
  };
}

/**
 * Enacts a capital zoning investment (residential, industrial, or civic).
 */
export function enactZoning(state, zoneType) {
  if (!['residential', 'industrial', 'civic'].includes(zoneType)) {
    return { ok: false, reason: 'INVALID_ZONE', state };
  }

  if (state.districts.length >= GRID_LIMIT) {
    return { ok: false, reason: 'GRID_FULL', state };
  }

  const cost = POLICY_COSTS[zoneType];
  if (state.treasury < cost) {
    return { ok: false, reason: 'INSUFFICIENT_FUNDS', state };
  }

  const slotIndex = findNextAvailableSlot(state.districts);
  if (slotIndex === -1) {
    return { ok: false, reason: 'GRID_FULL', state };
  }

  const nextZones = {
    ...state.zones,
    [zoneType]: state.zones[zoneType] + 1,
  };

  const nextDistrict = {
    id: state.nextDistrictId,
    type: zoneType,
    slotIndex,
  };

  const immediateApprovalDelta = zoneType === 'civic' ? 1.2 : 0.4;

  const nextState = {
    ...state,
    treasury: round2(state.treasury - cost),
    approvalRating: round2(clamp(state.approvalRating + immediateApprovalDelta, 5, 98)),
    nextDistrictId: state.nextDistrictId + 1,
    zones: nextZones,
    districts: [...state.districts, nextDistrict],
  };

  return { ok: true, reason: null, state: nextState };
}

/**
 * Injects targeted fiscal stimulus into the economy.
 */
export function enactStimulus(state) {
  const cost = POLICY_COSTS.stimulus;
  if (state.treasury < cost) {
    return { ok: false, reason: 'INSUFFICIENT_FUNDS', state };
  }

  const nextState = {
    ...state,
    treasury: round2(state.treasury - cost),
    stimulusBoost: round2(state.stimulusBoost + 3.5),
    inflationRate: round2(clamp(state.inflationRate + 0.45, 0.5, 18.0)),
    approvalRating: round2(clamp(state.approvalRating + 2.8, 5, 98)),
  };

  return { ok: true, reason: null, state: nextState };
}

/**
 * Advances the simulation by one fiscal quarter deterministically.
 */
export function advanceQuarter(state) {
  const housingCapacity = state.zones.residential * 48;
  const growthStep = state.population < housingCapacity && state.approvalRating >= 40
    ? Math.min(4, housingCapacity - state.population)
    : 0;
  const nextPopulation = state.population + growthStep;

  const laborForce = Math.max(10, Math.round(nextPopulation * 0.58));
  const jobsAvailable = (state.zones.industrial * 28) + (state.zones.civic * 11);
  const unemployed = Math.max(0, laborForce - jobsAvailable);
  const rawUnemployment = (unemployed / laborForce) * 100;
  const unemploymentRate = round2(clamp(rawUnemployment, 1.8, 35.0));

  const employedWorkers = Math.min(laborForce, jobsAvailable);
  const infraMultiplier = 1 + Math.min(0.35, state.zones.civic * 0.045);
  const taxDrag = state.taxRate > TAX_BOUNDS.neutral
    ? 1 - ((state.taxRate - TAX_BOUNDS.neutral) * 1.45)
    : 1 + ((TAX_BOUNDS.neutral - state.taxRate) * 0.25);

  const baseOutput = (state.zones.industrial * 145)
    + (employedWorkers * 3.2)
    + (state.stimulusBoost * 14);
  const gdp = round2(Math.max(80, baseOutput * infraMultiplier * taxDrag));

  const congestionPressure = Math.max(
    0,
    (state.zones.industrial * 0.42) - (state.zones.civic * 0.35)
  );
  const targetInflation = 2.0 + congestionPressure + (state.stimulusBoost * 0.35);
  const inflationRate = round2(
    clamp((state.inflationRate * 0.55) + (targetInflation * 0.45), 0.5, 18.0)
  );

  const revenue = round2(gdp * state.taxRate * 0.25);
  const expenditure = round2(
    10
    + (state.zones.residential * 2.2)
    + (state.zones.industrial * 2.8)
    + (state.zones.civic * 3.6)
    + (unemploymentRate * 0.8)
  );
  const netBalance = round2(revenue - expenditure);
  const treasury = round2(state.treasury + netBalance);

  const unemploymentPenalty = Math.max(0, unemploymentRate - 4.0) * 2.4;
  const inflationPenalty = Math.max(0, inflationRate - 2.5) * 3.1;
  const highTaxPenalty = state.taxRate > TAX_BOUNDS.neutral
    ? (state.taxRate - TAX_BOUNDS.neutral) * 95
    : 0;
  const civicBonus = Math.min(14, state.zones.civic * 2.5);
  const stimulusBonus = state.stimulusBoost * 1.4;
  const insolvencyPenalty = treasury < 0 ? 12 : 0;

  const targetApproval = 68
    - unemploymentPenalty
    - inflationPenalty
    - highTaxPenalty
    - insolvencyPenalty
    + civicBonus
    + stimulusBonus;

  const approvalRating = round2(
    clamp((state.approvalRating * 0.65) + (targetApproval * 0.35), 5, 98)
  );

  const nextStimulusBoost = round2(Math.max(0, (state.stimulusBoost * 0.55) - 0.25));
  const isYearRollover = state.quarter >= 4;

  return {
    ...state,
    year: isYearRollover ? state.year + 1 : state.year,
    quarter: isYearRollover ? 1 : state.quarter + 1,
    treasury,
    gdp,
    population: nextPopulation,
    inflationRate,
    unemploymentRate,
    approvalRating,
    stimulusBoost: nextStimulusBoost,
    lastReport: {
      revenue,
      expenditure,
      netBalance,
      laborForce,
      jobsAvailable,
    },
  };
}
