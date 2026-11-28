# Sovereign CityRT Sandbox — 16x16 Spatial City Builder & Fiscal Simulator

An interactive **3D WebGL (Three.js Raycaster) & 2D Isometric Canvas** spatial city-building simulation inspired by classic municipal builders (*Cities: Skylines* / *CityRT*). Engineered with modular **ES Modules**, zero npm runtime bloat, and deterministic automated unit/compliance tests.

- **Live Browser Sandbox:** https://benjarong-dev.github.io/sovereign-president-simulator/

## Core Gameplay & Engineering Architecture

1. **Interactive 16x16 Raycast Grid:** Left-click or drag directly onto terrain plots to lay **Roads**, zone **Residential (R) / Commercial (C) / Industrial (I)** districts, and construct **Wind Turbines (120 MW)**, **Water Towers (120 kL)**, **Parks**, **Schools**, and **Hospitals**.
2. **Spatial Adjacency & Utility Simulation (`src/simulation/policyEngine.js`):**
   - Zones require an adjacent `ROAD` plus city-wide `Power` and `Water` capacity (`NO_ROAD`, `NO_POWER`, `NO_WATER` diagnostics).
   - Industrial plots emit Manhattan-distance smog; placing factories beside homes triggers `POLLUTED` penalties and depresses citizen approval unless buffered by Urban Parks.
3. **Real-Time Simulation Loop & Road Traffic (`src/render/cityScene.js`):** Supports `Pause / 1x / 2x / 3x` continuous municipal ticks, animated vehicles navigating player-built road intersections, and dual WebGL / hardened-browser 2D Isometric Canvas rendering.

## Module Layout

```text
sovereign-president-simulator/
├── LICENSE                            # MIT License
├── THIRD_PARTY_NOTICES.md             # MIT compatibility attribution (Three.js v0.170.0)
├── README.md
├── package.json                       # Native ES Module test runner configuration
├── index.html                         # Top KPI HUD, RCI demand bars & build palette
├── css/
│   └── styles.css                     # Responsive dark municipal HUD layout
├── src/
│   ├── main.js                        # UI controller, drag-painting & 1x/2x/3x tick loop
│   ├── render/
│   │   └── cityScene.js               # 3D Three.js Raycaster + 2D Isometric fallback & traffic
│   └── simulation/
│       └── policyEngine.js            # Pure 16x16 spatial RCI, utility & adjacency engine
└── tests/
    ├── policyEngine.test.mjs          # Unit tests for RCI growth, utilities & smog adjacency
    └── repoCompliance.test.mjs        # Automated secret/path scanner & MIT license audit
```

## Local Verification & Testing

```bash
git clone https://github.com/benjarong-dev/sovereign-president-simulator.git
cd sovereign-president-simulator

# 1. Run all 12 unit, spatial simulation & repository security/license tests
node --test

# 2. Launch local HTTP server and open http://127.0.0.1:8080
python3 -m http.server 8080
```

## License

MIT License — see `LICENSE` and `THIRD_PARTY_NOTICES.md`.
