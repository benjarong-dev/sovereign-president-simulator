import { TILE_SPECS } from "../simulation/policyEngine.js";

const BUILDING_CATALOG = {
  ROADS: [
    { id: "ROAD", title: "🛣️ ถนนซอย 2 เลนสวน", meta: "$20 | สะพาน $45", cls: "" },
    { id: "ROAD_4L", title: "🛣️ ถนนสายหลัก 4 เลน", meta: "$40 | ไฟจราจรสี่แยก", cls: "" },
    { id: "ROAD_6L", title: "🛣️ ถนนบูเลอวาร์ด 6 เลน", meta: "$65 | เกาะกลางสีเขียว", cls: "" },
    { id: "ROAD_10L", title: "🛣️ ซูเปอร์ไฮเวย์ 10 เลน", meta: "$110 | ความเร็วสูง 10 ช่อง", cls: "" },
    { id: "BUS_DEPOT", title: "🚌 อู่รถเมล์ไฟฟ้าสาธารณะ", meta: "$180 | ปล่อยรถเมล์แวะป้าย", cls: "" },
  ],
  RAIL: [
    { id: "TRAM_TRACK", title: "🚊 รางรถรางไฟฟ้า (Tram)", meta: "$45 | ถนนพร้อมรางรถราง", cls: "" },
    { id: "TRAM_STOP", title: "🚏 สถานีรถราง (Tram Stop)", meta: "$150 | จุดรับส่งผู้โดยสารรถราง", cls: "" },
    { id: "RAIL_TRACK", title: "🛤️ รางรถไฟหลัก (Heavy Rail)", meta: "$55 | รางรถไฟชานเมือง", cls: "" },
    { id: "TRAIN_STATION", title: "🚉 สถานีรถไฟกลาง", meta: "$280 | หอนาฬิกา & รถไฟด่วน", cls: "" },
    { id: "BTS_TRACK", title: "🚝 รางรถไฟฟ้าลอยฟ้า BTS", meta: "$75 | ทางยกระดับคอนกรีต", cls: "" },
    { id: "BTS_STATION", title: "🏢 สถานีรถไฟฟ้า BTS", meta: "$340 | บูสต์มูลค่าที่ดิน +30%", cls: "" },
  ],
  ZONES: [
    { id: "RESIDENTIAL", title: "🏠 โซนที่อยู่อาศัย (R)", meta: "$60 | บ้าน -> คอนโดสูง", cls: "zone-r" },
    { id: "COMMERCIAL", title: "🏢 โซนพาณิชยกรรม (C)", meta: "$80 | ร้านค้า -> ตึกระฟ้า", cls: "zone-c" },
    { id: "INDUSTRIAL", title: "🏭 โซนอุตสาหกรรม (I)", meta: "$100 | โรงงาน & รถบรรทุก", cls: "zone-i" },
    { id: "MEGA_MALL", title: "🛍️ ห้างเมกะมอลล์ (Mall)", meta: "$420 | +160 งาน & ภาษีสูง", cls: "zone-c" },
  ],
  SPORTS: [
    { id: "FOOTBALL_STADIUM", title: "🏟️ สนามฟุตบอลสเตเดียม", meta: "$480 | สปอตไลท์ 4 เสา +ความสุขพุ่ง", cls: "" },
    { id: "SPORTS_COMPLEX", title: "🏊 ศูนย์กีฬา & สระโอลิมปิก", meta: "$290 | โดมกีฬา & สระว่ายน้ำ", cls: "" },
    { id: "PARK", title: "🌳 สวนสาธารณะร่มรื่น", meta: "$90 | ดูดซับฝุ่นควันโรงงาน", cls: "" },
    { id: "PLAZA", title: "⛲ จัตุรัสน้ำพุแลนด์มาร์ก", meta: "$190 | จุดนัดพบคนเดินเท้า", cls: "" },
  ],
  UTILITY: [
    { id: "HYDRO_DAM", title: "🌊 เขื่อนผลิตไฟฟ้าพลังน้ำ", meta: "$520 | +480 MW (วางบนแม่น้ำ/ทะเล)", cls: "" },
    { id: "SOLAR_PLANT", title: "☀️ โรงไฟฟ้าโซลาร์เซลล์", meta: "$360 | +240 MW พลังงานสะอาด", cls: "" },
    { id: "WIND_TURBINE", title: "🌬️ กังหันลมไฟฟ้า", meta: "$220 | +140 MW (เนิน/น้ำ +25%)", cls: "" },
    { id: "WATER_TOWER", title: "💧 หอประปาแรงดันสูง", meta: "$180 | +150 kL น้ำสะอาด", cls: "" },
  ],
  CIVIC: [
    { id: "SCHOOL", title: "🏫 โรงเรียนเทศบาล", meta: "$260 | เพิ่มความสุขรัศมี 5 ช่อง", cls: "" },
    { id: "HOSPITAL", title: "🏥 โรงพยาบาลศูนย์", meta: "$320 | สุขภาพประชาชนรัศมี 6 ช่อง", cls: "" },
    { id: "SAFETY_HQ", title: "🚒 สถานีตำรวจ-ดับเพลิง", meta: "$240 | ความปลอดภัยรัศมี 6 ช่อง", cls: "" },
  ],
};

const TERRAIN_LABELS = {
  GRASS: "ที่ราบหญ้าเขียว",
  SAND: "หาดทรายริมน้ำ",
  HILL: "เนินเขาสูง (โบนัสลม +25%)",
  WATER: "แม่น้ำ / ทะเล (สร้างเขื่อนหรือสะพานได้)",
  MOUNTAIN: "ยอดเขาหินสูงชัน",
};

export function createHudController({
  onSelectTool,
  onSpeedChange,
  onToggleLighting,
  onTaxChange,
  onBudgetChange,
  onInfoViewChange,
  onGenerateMap,
}) {
  const subtoolTray = document.getElementById("subtool-tray");
  const mapDrawer = document.getElementById("map-drawer");
  const policyDrawer = document.getElementById("policy-drawer");
  const infoDrawer = document.getElementById("infoview-drawer");
  const toastEl = document.getElementById("toast-pill");
  const inspectorEl = document.getElementById("inspector-content");
  const alertBanner = document.getElementById("city-alert-banner");

  let currentTool = "ROAD_6L";
  let selectedBiome = "RIVER_VALLEY";

  function showToast(text) {
    toastEl.textContent = text;
  }

  function renderCategoryCards(catKey) {
    const items = BUILDING_CATALOG[catKey] ?? [];
    subtoolTray.innerHTML = "";
    subtoolTray.classList.toggle("hidden", items.length === 0);

    items.forEach((item, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `build-card ${item.cls}`.trim();
      btn.innerHTML = `<span class="card-title">${item.title}</span><span class="card-meta">${item.meta}</span>`;

      if (item.id === currentTool || (idx === 0 && !items.some((x) => x.id === currentTool))) {
        currentTool = item.id;
        btn.classList.add("active");
        onSelectTool(currentTool);
      }

      btn.addEventListener("click", () => {
        currentTool = item.id;
        subtoolTray.querySelectorAll(".build-card").forEach((b) => b.classList.remove("active"));
        document.getElementById("btn-bulldoze").classList.remove("active");
        document.getElementById("btn-inspect").classList.remove("active");
        btn.classList.add("active");
        onSelectTool(currentTool);
        showToast(`เลือกสร้าง: ${item.title}`);
      });

      subtoolTray.appendChild(btn);
    });
  }

  document.querySelectorAll(".cat-btn[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-btn[data-cat], #btn-bulldoze, #btn-inspect").forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      renderCategoryCards(btn.dataset.cat);
    });
  });

  const bulldozeBtn = document.getElementById("btn-bulldoze");
  bulldozeBtn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn[data-cat], #btn-inspect").forEach((b) => b.classList.remove("active"));
    subtoolTray.classList.add("hidden");
    bulldozeBtn.classList.add("active");
    currentTool = "BULLDOZE";
    onSelectTool("BULLDOZE");
    showToast("โหมดรื้อถอน ($5 ต่อช่อง)");
  });

  const inspectBtn = document.getElementById("btn-inspect");
  inspectBtn.addEventListener("click", () => {
    document.querySelectorAll(".cat-btn[data-cat], #btn-bulldoze").forEach((b) => b.classList.remove("active"));
    subtoolTray.classList.add("hidden");
    inspectBtn.classList.add("active");
    currentTool = "INSPECT";
    onSelectTool("INSPECT");
    showToast("โหมดตรวจสอบแปลงที่ดิน");
  });

  const btnMaps = document.getElementById("btn-maps");
  const btnPolicies = document.getElementById("btn-policies");
  const btnInfo = document.getElementById("btn-infoview");

  btnMaps.addEventListener("click", () => {
    policyDrawer.classList.add("hidden");
    btnPolicies.classList.remove("active");
    const hidden = mapDrawer.classList.toggle("hidden");
    btnMaps.classList.toggle("active", !hidden);
  });
  document.getElementById("close-map").addEventListener("click", () => {
    mapDrawer.classList.add("hidden");
    btnMaps.classList.remove("active");
  });

  document.querySelectorAll(".biome-card").forEach((card) => {
    card.addEventListener("click", () => {
      document.querySelectorAll(".biome-card").forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      selectedBiome = card.dataset.biome;
    });
  });

  document.getElementById("btn-apply-map").addEventListener("click", () => {
    const withStarter = document.getElementById("chk-starter-town").checked;
    onGenerateMap({ biome: selectedBiome, withStarter });
    mapDrawer.classList.add("hidden");
    btnMaps.classList.remove("active");
  });

  btnPolicies.addEventListener("click", () => {
    mapDrawer.classList.add("hidden");
    btnMaps.classList.remove("active");
    const hidden = policyDrawer.classList.toggle("hidden");
    btnPolicies.classList.toggle("active", !hidden);
  });
  document.getElementById("close-policy").addEventListener("click", () => {
    policyDrawer.classList.add("hidden");
    btnPolicies.classList.remove("active");
  });

  btnInfo.addEventListener("click", () => {
    const hidden = infoDrawer.classList.toggle("hidden");
    btnInfo.classList.toggle("active", !hidden);
  });
  document.getElementById("close-infoview").addEventListener("click", () => {
    infoDrawer.classList.add("hidden");
    btnInfo.classList.remove("active");
  });

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".view-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onInfoViewChange(btn.dataset.view);
      showToast(`มุมมองข้อมูล: ${btn.textContent}`);
    });
  });

  const lightBtn = document.getElementById("btn-lighting");
  lightBtn.addEventListener("click", () => {
    const next = onToggleLighting();
    lightBtn.textContent = next === "DUSK" ? "🌆 พลบค่ำ (ไฟสนาม/BTS)" : "☀️ กลางวัน";
    showToast(next === "DUSK" ? "โหมดพลบค่ำ — เปิดไฟสปอตไลท์สนามบอล ห้าง และแถบไฟถนน" : "โหมดแสงแดดกลางวัน");
  });

  document.querySelectorAll(".speed-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".speed-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onSpeedChange(Number.parseInt(btn.dataset.speed, 10));
    });
  });

  const taxSlider = document.getElementById("tax-slider");
  const infraSlider = document.getElementById("infra-slider");
  const greenSlider = document.getElementById("green-slider");

  taxSlider.addEventListener("input", () => {
    document.getElementById("tax-val").textContent = `${taxSlider.value}%`;
    onTaxChange(Number.parseInt(taxSlider.value, 10));
  });

  const syncBudgets = () => {
    document.getElementById("infra-val").textContent = `${infraSlider.value}%`;
    document.getElementById("green-val").textContent = `${greenSlider.value}%`;
    onBudgetChange({
      infraBudgetPct: Number.parseInt(infraSlider.value, 10),
      greenSubsidyPct: Number.parseInt(greenSlider.value, 10),
    });
  };
  infraSlider.addEventListener("input", syncBudgets);
  greenSlider.addEventListener("input", syncBudgets);

  renderCategoryCards("ROADS");

  return {
    showToast,
    setRendererBadge(modeText) {
      document.getElementById("renderer-mode").textContent = modeText;
    },
    syncSlidersFromState(state) {
      taxSlider.value = String(state.taxRate);
      infraSlider.value = String(state.infraBudgetPct);
      greenSlider.value = String(state.greenSubsidyPct);
      document.getElementById("tax-val").textContent = `${state.taxRate}%`;
      document.getElementById("infra-val").textContent = `${state.infraBudgetPct}%`;
      document.getElementById("green-val").textContent = `${state.greenSubsidyPct}%`;
    },
    updateStats(state) {
      const m = state.metrics;
      document.getElementById("hud-day").textContent = String(state.day);
      document.getElementById("hud-treasury").textContent = `$${state.treasury.toLocaleString()}`;
      const sign = state.netCashflow >= 0 ? "+" : "";
      document.getElementById("hud-cashflow").textContent = `${sign}$${state.netCashflow}/d`;
      document.getElementById("hud-pop").textContent = m.population.toLocaleString();
      document.getElementById("hud-gdp").textContent = `${m.totalJobs.toLocaleString()} | ${m.gdpIndex}`;
      document.getElementById("hud-transit").textContent = `${m.transitRidership.toLocaleString()} คน`;
      document.getElementById("hud-approval").textContent = `${m.approval}%`;
      document.getElementById("hud-power").textContent = `${m.powerDemand}/${m.powerSupply} MW`;
      document.getElementById("hud-water").textContent = `${m.waterDemand}/${m.waterSupply} kL`;

      const toPct = (v) => `${Math.max(6, Math.min(100, Math.round((v + 100) / 2)))}%`;
      document.getElementById("bar-r").style.height = toPct(m.demand.residential);
      document.getElementById("bar-c").style.height = toPct(m.demand.commercial);
      document.getElementById("bar-i").style.height = toPct(m.demand.industrial);

      if (m.powerDemand > m.powerSupply) {
        alertBanner.className = "alert-warn";
        alertBanner.textContent = "⚡ ไฟติดลบ! สร้างเขื่อนผลิตไฟฟ้า (480 MW) บนแม่น้ำหรือโรงไฟฟ้าเพิ่ม!";
      } else if (m.waterDemand > m.waterSupply) {
        alertBanner.className = "alert-warn";
        alertBanner.textContent = "💧 น้ำประปาไม่พอ — สร้างหอประปาเพิ่มทันที!";
      } else {
        alertBanner.className = "alert-ok";
        alertBanner.textContent = `✓ สถานีราง/BTS ${m.railStations} แห่ง | คนเดินเท้าคึกคัก (${m.pedestrianCount} จุด)`;
      }
    },
    updateInspector(state, x, y) {
      const tile = state.grid[y]?.[x];
      if (!tile) return;
      const spec = TILE_SPECS[tile.type];
      const terrainName = TERRAIN_LABELS[tile.terrain] ?? tile.terrain;
      const statusText = tile.issue ? `⚠ ${tile.issue}` : "สมบูรณ์";
      const laneBadge = tile.lanes > 0 ? ` [${tile.lanes} เลน]` : "";

      inspectorEl.innerHTML = [
        `<div><strong>พิกัด (${x}, ${y}):</strong> ${spec.label}${laneBadge} ${spec.zone ? `[Lv.${tile.level}]` : ""}</div>`,
        `<div><strong>ภูมิประเทศ:</strong> ${terrainName}</div>`,
        `<div><strong>ภาษี:</strong> $${tile.taxYield}/d | <strong>ความสุข:</strong> ${tile.happiness}% | <strong>สถานะ:</strong> ${statusText}</div>`,
      ].join("");
    },
  };
}
