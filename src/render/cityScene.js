/**
 * WebGL 3D Urban Grid Renderer (Three.js v0.170.0 ES Module)
 * Decoupled from fiscal math — consumes immutable state snapshots only.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const GRID_SIZE = 8;
const TILE_SIZE = 2.2;
const TILE_GAP = 0.25;
const STEP = TILE_SIZE + TILE_GAP;
const BOARD_OFFSET = ((GRID_SIZE - 1) * STEP) / 2;

/**
 * Shared geometries and materials to avoid redundant GPU allocations.
 */
function createSharedAssets() {
  return {
    geometries: {
      tilePad: new THREE.BoxGeometry(TILE_SIZE, 0.16, TILE_SIZE),
      podium: new THREE.BoxGeometry(1.75, 0.24, 1.75),
      resTowerA: new THREE.BoxGeometry(0.68, 1.85, 0.68),
      resTowerB: new THREE.BoxGeometry(0.62, 1.35, 0.62),
      indHall: new THREE.BoxGeometry(1.55, 0.85, 1.15),
      indStack: new THREE.CylinderGeometry(0.14, 0.18, 1.55, 12),
      civicPark: new THREE.BoxGeometry(1.82, 0.18, 1.82),
      civicSpire: new THREE.CylinderGeometry(0.12, 0.36, 2.05, 6),
    },
    materials: {
      tilePad: new THREE.MeshStandardMaterial({
        color: 0x162032,
        roughness: 0.88,
        metalness: 0.12,
      }),
      residentialMain: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.35,
        metalness: 0.25,
      }),
      residentialBase: new THREE.MeshStandardMaterial({
        color: 0x0369a1,
        roughness: 0.6,
      }),
      industrialMain: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        roughness: 0.48,
        metalness: 0.3,
      }),
      industrialStack: new THREE.MeshStandardMaterial({
        color: 0x92400e,
        roughness: 0.55,
        metalness: 0.4,
      }),
      civicPark: new THREE.MeshStandardMaterial({
        color: 0x059669,
        roughness: 0.75,
      }),
      civicSpire: new THREE.MeshStandardMaterial({
        color: 0x34d399,
        roughness: 0.25,
        metalness: 0.45,
      }),
    },
  };
}

function slotToPosition(slotIndex) {
  const row = Math.floor(slotIndex / GRID_SIZE);
  const col = slotIndex % GRID_SIZE;
  return {
    x: (col * STEP) - BOARD_OFFSET,
    z: (row * STEP) - BOARD_OFFSET,
  };
}

function buildDistrictMeshGroup(type, assets) {
  const group = new THREE.Group();
  const { geometries, materials } = assets;

  if (type === 'residential') {
    const podium = new THREE.Mesh(geometries.podium, materials.residentialBase);
    podium.position.y = 0.12;
    podium.castShadow = true;
    podium.receiveShadow = true;

    const towerA = new THREE.Mesh(geometries.resTowerA, materials.residentialMain);
    towerA.position.set(-0.34, 1.05, -0.22);
    towerA.castShadow = true;

    const towerB = new THREE.Mesh(geometries.resTowerB, materials.residentialMain);
    towerB.position.set(0.36, 0.8, 0.28);
    towerB.castShadow = true;

    group.add(podium, towerA, towerB);
  } else if (type === 'industrial') {
    const hall = new THREE.Mesh(geometries.indHall, materials.industrialMain);
    hall.position.set(0, 0.43, 0.18);
    hall.castShadow = true;
    hall.receiveShadow = true;

    const stackA = new THREE.Mesh(geometries.indStack, materials.industrialStack);
    stackA.position.set(-0.45, 0.78, -0.45);
    stackA.castShadow = true;

    const stackB = new THREE.Mesh(geometries.indStack, materials.industrialStack);
    stackB.position.set(0.45, 0.78, -0.45);
    stackB.castShadow = true;

    group.add(hall, stackA, stackB);
  } else {
    const park = new THREE.Mesh(geometries.civicPark, materials.civicPark);
    park.position.y = 0.09;
    park.receiveShadow = true;

    const spire = new THREE.Mesh(geometries.civicSpire, materials.civicSpire);
    spire.position.y = 1.1;
    spire.castShadow = true;

    group.add(park, spire);
  }

  return group;
}

/**
 * Initializes the Three.js urban scene inside the given container element.
 */
export function createCityScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1120);
  scene.fog = new THREE.FogExp2(0x0b1120, 0.022);

  const initialWidth = container.clientWidth || window.innerWidth;
  const initialHeight = container.clientHeight || window.innerHeight;

  const camera = new THREE.PerspectiveCamera(42, initialWidth / initialHeight, 0.1, 120);
  camera.position.set(16.5, 15.5, 18.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialWidth, initialHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minDistance = 9;
  controls.maxDistance = 36;
  controls.target.set(0, 0.5, 0);

  const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.85);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.65);
  keyLight.position.set(14, 22, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 2;
  keyLight.shadow.camera.far = 55;
  const shadowBounds = 13;
  keyLight.shadow.camera.left = -shadowBounds;
  keyLight.shadow.camera.right = shadowBounds;
  keyLight.shadow.camera.top = shadowBounds;
  keyLight.shadow.camera.bottom = -shadowBounds;
  scene.add(keyLight);

  const assets = createSharedAssets();

  // Base 8x8 urban parcel pads
  const boardGroup = new THREE.Group();
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i += 1) {
    const pad = new THREE.Mesh(assets.geometries.tilePad, assets.materials.tilePad);
    const pos = slotToPosition(i);
    pad.position.set(pos.x, -0.08, pos.z);
    pad.receiveShadow = true;
    boardGroup.add(pad);
  }
  scene.add(boardGroup);

  const gridHelper = new THREE.GridHelper(GRID_SIZE * STEP + 0.6, GRID_SIZE, 0x334155, 0x1e293b);
  gridHelper.position.y = -0.15;
  scene.add(gridHelper);

  const districtsRoot = new THREE.Group();
  scene.add(districtsRoot);

  const renderedMap = new Map();
  let animationFrameId = null;

  function clearAllDistricts() {
    for (const entry of renderedMap.values()) {
      districtsRoot.remove(entry.mesh);
    }
    renderedMap.clear();
  }

  function syncState(state) {
    if (state.districts.length < renderedMap.size) {
      clearAllDistricts();
    }

    for (const district of state.districts) {
      if (!renderedMap.has(district.id)) {
        const mesh = buildDistrictMeshGroup(district.type, assets);
        const pos = slotToPosition(district.slotIndex);
        mesh.position.set(pos.x, 0.0, pos.z);
        mesh.scale.set(1, 0.05, 1);
        districtsRoot.add(mesh);
        renderedMap.set(district.id, { mesh, targetScaleY: 1.0 });
      }
    }

    // Subtle atmospheric warmth reflecting public approval health
    if (state.approvalRating < 40) {
      ambientLight.color.setHex(0xfca5a5);
    } else if (state.approvalRating >= 70) {
      ambientLight.color.setHex(0xbae6fd);
    } else {
      ambientLight.color.setHex(0x94a3b8);
    }
  }

  function animate() {
    animationFrameId = window.requestAnimationFrame(animate);

    for (const entry of renderedMap.values()) {
      if (entry.mesh.scale.y < entry.targetScaleY) {
        entry.mesh.scale.y = Math.min(
          entry.targetScaleY,
          entry.mesh.scale.y + ((entry.targetScaleY - entry.mesh.scale.y) * 0.16) + 0.01
        );
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }

  const resizeObserver = new ResizeObserver(() => {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  });
  resizeObserver.observe(container);

  animate();

  return {
    syncState,
    resetCamera() {
      camera.position.set(16.5, 15.5, 18.5);
      controls.target.set(0, 0.5, 0);
      controls.update();
    },
    dispose() {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
      controls.dispose();
      Object.values(assets.geometries).forEach((g) => g.dispose());
      Object.values(assets.materials).forEach((m) => m.dispose());
      renderer.dispose();
    },
  };
}
