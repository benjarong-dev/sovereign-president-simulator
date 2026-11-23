/**
 * Main Application Controller
 * Coordinates user DOM events, simulation loop timer, and 3D scene updates.
 */

import {
  POLICY_COSTS,
  GRID_LIMIT,
  createInitialState,
  setTaxRate,
  enactZoning,
  enactStimulus,
  advanceQuarter,
} from './simulation/policyEngine.js';
import { createCityScene } from './render/cityScene.js';

const TICK_INTERVAL_MS = 3500;
const MAX_LOG_ENTRIES = 5;

const dom = {
  sceneContainer: document.getElementById('scene-container'),
  periodDisplay: document.getElementById('period-display'),
  treasuryVal: document.getElementById('treasury-val'),
  netBalanceVal: document.getElementById('net-balance-val'),
  gdpVal: document.getElementById('gdp-val'),
  populationVal: document.getElementById('population-val'),
  approvalVal: document.getElementById('approval-val'),
  approvalBar: document.getElementById('approval-bar'),
  inflationVal: document.getElementById('inflation-val'),
  unemploymentVal: document.getElementById('unemployment-val'),
  laborSummaryVal: document.getElementById('labor-summary-val'),
  zoneResCount: document.getElementById('zone-res-count'),
  zoneIndCount: document.getElementById('zone-ind-count'),
  zoneCivCount: document.getElementById('zone-civ-count'),
  gridUsageVal: document.getElementById('grid-usage-val'),
  taxSlider: document.getElementById('tax-slider'),
  taxRateLabel: document.getElementById('tax-rate-label'),
  btnResidential: document.getElementById('btn-zone-residential'),
  btnIndustrial: document.getElementById('btn-zone-industrial'),
  btnCivic: document.getElementById('btn-zone-civic'),
  btnStimulus: document.getElementById('btn-stimulus'),
  btnStepQuarter: document.getElementById('btn-step-quarter'),
  btnTogglePlay: document.getElementById('btn-toggle-play'),
  btnResetCamera: document.getElementById('btn-reset-camera'),
  btnResetSim: document.getElementById('btn-reset-sim'),
  policyLogList: document.getElementById('policy-log-list'),
};

let appState = createInitialState();
let autoPlayTimer = null;
const eventLogs = ['[2026 Q1] Fiscal administration initialized.'];

const cityScene = createCityScene(dom.sceneContainer);

function formatSignedCurrency(amount) {
  const sign = amount >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(amount).toFixed(1)}M / qtr`;
}

function appendLog(message) {
  const prefix = `[${appState.year} Q${appState.quarter}]`;
  eventLogs.unshift(`${prefix} ${message}`);
  if (eventLogs.length > MAX_LOG_ENTRIES) {
    eventLogs.pop();
  }
}

function renderHud() {
  dom.periodDisplay.textContent = `${appState.year} Q${appState.quarter}`;
  dom.treasuryVal.textContent = `$${appState.treasury.toFixed(1)}M`;
  dom.treasuryVal.className = `metric-value ${appState.treasury < 0 ? 'text-negative' : ''}`;

  const { netBalance, laborForce, jobsAvailable } = appState.lastReport;
  dom.netBalanceVal.textContent = formatSignedCurrency(netBalance);
  dom.netBalanceVal.className = `metric-sub ${netBalance >= 0 ? 'text-positive' : 'text-negative'}`;

  dom.gdpVal.textContent = `$${appState.gdp.toFixed(1)}M`;
  dom.populationVal.textContent = `${appState.population}k`;

  dom.approvalVal.textContent = `${appState.approvalRating.toFixed(1)}%`;
  dom.approvalBar.style.width = `${appState.approvalRating}%`;
  if (appState.approvalRating < 40) {
    dom.approvalBar.style.backgroundColor = '#f43f5e';
  } else if (appState.approvalRating >= 65) {
    dom.approvalBar.style.backgroundColor = '#10b981';
  } else {
    dom.approvalBar.style.backgroundColor = '#38bdf8';
  }

  dom.inflationVal.textContent = `${appState.inflationRate.toFixed(1)}%`;
  dom.inflationVal.className = `metric-value ${appState.inflationRate > 4.5 ? 'text-warning' : ''}`;

  dom.unemploymentVal.textContent = `${appState.unemploymentRate.toFixed(1)}%`;
  dom.unemploymentVal.className = `metric-value ${appState.unemploymentRate > 7.5 ? 'text-negative' : ''}`;
  dom.laborSummaryVal.textContent = `${jobsAvailable}k jobs / ${laborForce}k labor`;

  dom.zoneResCount.textContent = String(appState.zones.residential);
  dom.zoneIndCount.textContent = String(appState.zones.industrial);
  dom.zoneCivCount.textContent = String(appState.zones.civic);
  dom.gridUsageVal.textContent = `${appState.districts.length}/${GRID_LIMIT}`;

  const pctTax = Math.round(appState.taxRate * 100);
  dom.taxSlider.value = String(pctTax);
  dom.taxRateLabel.textContent = `${pctTax}%`;

  const gridFull = appState.districts.length >= GRID_LIMIT;
  dom.btnResidential.disabled = gridFull || appState.treasury < POLICY_COSTS.residential;
  dom.btnIndustrial.disabled = gridFull || appState.treasury < POLICY_COSTS.industrial;
  dom.btnCivic.disabled = gridFull || appState.treasury < POLICY_COSTS.civic;
  dom.btnStimulus.disabled = appState.treasury < POLICY_COSTS.stimulus;

  dom.policyLogList.innerHTML = '';
  for (const entry of eventLogs) {
    const li = document.createElement('li');
    li.textContent = entry;
    dom.policyLogList.appendChild(li);
  }

  cityScene.syncState(appState);
}

function handleZoningClick(zoneType, label) {
  const result = enactZoning(appState, zoneType);
  if (result.ok) {
    appState = result.state;
    appendLog(`Zoned ${label} (-$${POLICY_COSTS[zoneType]}M).`);
    renderHud();
  }
}

function stepQuarter() {
  appState = advanceQuarter(appState);
  renderHud();
}

function setAutoPlay(enabled) {
  if (autoPlayTimer !== null) {
    window.clearInterval(autoPlayTimer);
    autoPlayTimer = null;
  }

  if (enabled) {
    autoPlayTimer = window.setInterval(stepQuarter, TICK_INTERVAL_MS);
    dom.btnTogglePlay.textContent = 'Auto-Run: ON';
    dom.btnTogglePlay.classList.add('active');
  } else {
    dom.btnTogglePlay.textContent = 'Auto-Run: PAUSED';
    dom.btnTogglePlay.classList.remove('active');
  }
}

dom.taxSlider.addEventListener('input', (event) => {
  const pct = Number(event.target.value);
  appState = setTaxRate(appState, pct / 100);
  appendLog(`Adjusted effective tax rate to ${pct}%.`);
  renderHud();
});

dom.btnResidential.addEventListener('click', () => handleZoningClick('residential', 'Residential District'));
dom.btnIndustrial.addEventListener('click', () => handleZoningClick('industrial', 'Industrial District'));
dom.btnCivic.addEventListener('click', () => handleZoningClick('civic', 'Civic Infrastructure'));

dom.btnStimulus.addEventListener('click', () => {
  const result = enactStimulus(appState);
  if (result.ok) {
    appState = result.state;
    appendLog(`Disbursed targeted stimulus (-$${POLICY_COSTS.stimulus}M).`);
    renderHud();
  }
});

dom.btnStepQuarter.addEventListener('click', () => {
  appendLog('Advanced fiscal quarter manually.');
  stepQuarter();
});

dom.btnTogglePlay.addEventListener('click', () => {
  setAutoPlay(autoPlayTimer === null);
});

dom.btnResetCamera.addEventListener('click', () => {
  cityScene.resetCamera();
});

dom.btnResetSim.addEventListener('click', () => {
  appState = createInitialState();
  eventLogs.length = 0;
  eventLogs.push('[2026 Q1] Simulation state reset to baseline.');
  renderHud();
});

renderHud();
setAutoPlay(true);
