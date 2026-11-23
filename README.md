# Civic & Fiscal Policy Sandbox (3D Web Simulation)

Interactive client-side simulation exploring the macroeconomic and urban-planning trade-offs between taxation, public stimulus, infrastructure investment, and public approval. Built with native **ES Modules** and **Three.js (v0.170.0)** with zero build-tool overhead, combining public-policy concepts with deterministic state modeling.

- **Live Browser Sandbox:** https://benjarong-dev.github.io/sovereign-president-simulator/

## Module Architecture

```text
sovereign-president-simulator/
├── index.html                        # Semantic HTML5 shell & ES Import Map
├── css/
│   └── styles.css                    # Responsive dark telemetry UI layout
├── src/
│   ├── main.js                       # DOM event bindings & simulation loop controller
│   ├── simulation/
│   │   └── policyEngine.js           # Pure deterministic fiscal & zoning state engine
│   └── render/
│       └── cityScene.js              # Three.js v0.170 WebGL grid & OrbitControls scene
└── tests/
    └── policyEngine.test.mjs         # Zero-dependency Node.js unit test suite
```

## Policy & Economic Model Mechanics

Rather than relying on random number generation, every quarterly tick computes state transitions deterministically from explicit policy levers:

| Policy Lever / Action | Immediate Fiscal Impact | Macroeconomic & Approval Trade-Off |
|---|---|---|
| **Tax Rate Adjustment (`10%` – `45%`)** | Scales quarterly tax revenue collected from active GDP | Rates above `28%` dampen private industrial output and reduce approval; overly low rates risk structural deficits |
| **Residential Zoning (`+1 District`)** | Costs `$45M` capital outlay | Expands labor capacity and population growth; requires matching industrial jobs to prevent unemployment spikes |
| **Industrial Zoning (`+1 District`)** | Costs `$70M` capital outlay | Raises base GDP output and job creation, but increases urban congestion/inflation pressure without civic infrastructure |
| **Civic Infrastructure (`+1 Plaza/Transit`)** | Costs `$60M` capital outlay | Boosts productivity multiplier, dampens inflation friction, and improves long-term public approval |
| **Targeted Fiscal Stimulus (`$50M`)** | Immediate `$50M` treasury draw | Provides short-term approval and demand relief during downturns, while nudging quarterly inflation upward |

## Local Development & Verification

Because the project uses standard browser ES Modules and Node's built-in test runner (`node:test`), no `npm install` step is required.

```bash
# 1. Clone repository
git clone https://github.com/benjarong-dev/sovereign-president-simulator.git
cd sovereign-president-simulator

# 2. Run deterministic policy-engine unit tests (Node.js 18+)
node --test tests/policyEngine.test.mjs

# 3. Serve locally over HTTP for ES Module imports
python3 -m http.server 8080
# Open http://localhost:8080 in browser
```

