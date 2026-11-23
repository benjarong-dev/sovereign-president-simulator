/**
 * Resilient Urban Grid Renderer (Isometric Canvas + Async Three.js WebGL Upgrade)
 * Renders immediately with zero CDN wait; gracefully handles WebGL-disabled browsers (e.g., LibreWolf).
 */

const GRID_SIZE = 8;

function drawIsoPrism(ctx, cx, cy, halfW, halfH, height, colors) {
  // Top face
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH - height);
  ctx.lineTo(cx + halfW, cy - height);
  ctx.lineTo(cx, cy + halfH - height);
  ctx.lineTo(cx - halfW, cy - height);
  ctx.closePath();
  ctx.fillStyle = colors.top;
  ctx.fill();
  ctx.strokeStyle = colors.stroke || 'rgba(15, 23, 42, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  if (height <= 0) return;

  // Left face
  ctx.beginPath();
  ctx.moveTo(cx - halfW, cy - height);
  ctx.lineTo(cx, cy + halfH - height);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
  ctx.fillStyle = colors.left;
  ctx.fill();
  ctx.stroke();

  // Right face
  ctx.beginPath();
  ctx.moveTo(cx + halfW, cy - height);
  ctx.lineTo(cx, cy + halfH - height);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.closePath();
  ctx.fillStyle = colors.right;
  ctx.fill();
  ctx.stroke();
}

function createIsometricCanvasBackend(container) {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.cursor = 'grab';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let panX = 0;
  let panY = 24;
  let zoom = 1.0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let currentState = null;

  function render() {
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b1120';
    ctx.fillRect(0, 0, width, height);

    const tileW = 64 * zoom;
    const tileH = 32 * zoom;
    const originX = (width / 2) + panX;
    const originY = (height / 2) - (GRID_SIZE * tileH * 0.38) + panY;

    const districtBySlot = new Map();
    if (currentState && Array.isArray(currentState.districts)) {
      for (const d of currentState.districts) {
        districtBySlot.set(d.slotIndex, d);
      }
    }

    // Back-to-front painter's order across 8x8 isometric grid
    for (let row = 0; row < GRID_SIZE; row += 1) {
      for (let col = 0; col < GRID_SIZE; col += 1) {
        const slotIndex = (row * GRID_SIZE) + col;
        const cx = originX + ((col - row) * (tileW / 2));
        const cy = originY + ((col + row) * (tileH / 2));

        // Base parcel pad
        drawIsoPrism(ctx, cx, cy, (tileW * 0.46), (tileH * 0.46), 5 * zoom, {
          top: '#162032',
          left: '#0f172a',
          right: '#1e293b',
          stroke: 'rgba(56, 189, 248, 0.18)',
        });

        const district = districtBySlot.get(slotIndex);
        if (!district) continue;

        const baseY = cy - (5 * zoom);
        if (district.type === 'residential') {
          drawIsoPrism(ctx, cx, baseY, tileW * 0.36, tileH * 0.36, 7 * zoom, {
            top: '#0284c7',
            left: '#0369a1',
            right: '#075985',
          });
          drawIsoPrism(ctx, cx - (tileW * 0.1), baseY - (7 * zoom), tileW * 0.16, tileH * 0.16, 36 * zoom, {
            top: '#7dd3fc',
            left: '#38bdf8',
            right: '#0284c7',
          });
          drawIsoPrism(ctx, cx + (tileW * 0.12), baseY - (5 * zoom), tileW * 0.14, tileH * 0.14, 24 * zoom, {
            top: '#bae6fd',
            left: '#38bdf8',
            right: '#0369a1',
          });
        } else if (district.type === 'industrial') {
          drawIsoPrism(ctx, cx, baseY, tileW * 0.36, tileH * 0.36, 18 * zoom, {
            top: '#fbbf24',
            left: '#f59e0b',
            right: '#b45309',
          });
          drawIsoPrism(ctx, cx - (tileW * 0.12), baseY - (18 * zoom), tileW * 0.08, tileH * 0.08, 22 * zoom, {
            top: '#fde68a',
            left: '#d97706',
            right: '#78350f',
          });
        } else {
          drawIsoPrism(ctx, cx, baseY, tileW * 0.38, tileH * 0.38, 6 * zoom, {
            top: '#10b981',
            left: '#059669',
            right: '#047857',
          });
          drawIsoPrism(ctx, cx, baseY - (6 * zoom), tileW * 0.12, tileH * 0.12, 42 * zoom, {
            top: '#6ee7b7',
            left: '#34d399',
            right: '#059669',
          });
        }
      }
    }
  }

  const onPointerDown = (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    render();
  };
  const onPointerUp = () => {
    dragging = false;
    canvas.style.cursor = 'grab';
  };
  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.08 : 0.92;
    zoom = Math.min(1.85, Math.max(0.6, zoom * factor));
    render();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });

  const resizeObserver = new ResizeObserver(() => render());
  resizeObserver.observe(container);

  return {
    syncState(state) {
      currentState = state;
      render();
    },
    resetCamera() {
      panX = 0;
      panY = 24;
      zoom = 1.0;
      render();
    },
    dispose() {
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      if (canvas.parentNode === container) {
        container.removeChild(canvas);
      }
    },
  };
}

function createWebGLBackend(container, THREE, OrbitControls) {
  const TILE_SIZE = 2.2;
  const STEP = 2.45;
  const BOARD_OFFSET = ((GRID_SIZE - 1) * STEP) / 2;

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1120);
  scene.fog = new THREE.FogExp2(0x0b1120, 0.022);

  const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 120);
  camera.position.set(16.5, 15.5, 18.5);

  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2.15;
  controls.minDistance = 9;
  controls.maxDistance = 36;
  controls.target.set(0, 0.5, 0);

  const ambientLight = new THREE.AmbientLight(0x94a3b8, 0.9);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.65);
  keyLight.position.set(14, 22, 12);
  keyLight.castShadow = true;
  scene.add(keyLight);

  const padGeo = new THREE.BoxGeometry(TILE_SIZE, 0.16, TILE_SIZE);
  const padMat = new THREE.MeshStandardMaterial({ color: 0x162032, roughness: 0.88 });

  const slotPos = (idx) => ({
    x: ((idx % GRID_SIZE) * STEP) - BOARD_OFFSET,
    z: (Math.floor(idx / GRID_SIZE) * STEP) - BOARD_OFFSET,
  });

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i += 1) {
    const pad = new THREE.Mesh(padGeo, padMat);
    const p = slotPos(i);
    pad.position.set(p.x, -0.08, p.z);
    pad.receiveShadow = true;
    scene.add(pad);
  }

  const districtsRoot = new THREE.Group();
  scene.add(districtsRoot);
  const renderedMap = new Map();

  const buildMesh = (type) => {
    const group = new THREE.Group();
    if (type === 'residential') {
      const a = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.85, 0.7),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35 })
      );
      a.position.set(-0.32, 0.95, -0.2);
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 1.3, 0.62),
        new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.45 })
      );
      b.position.set(0.35, 0.68, 0.25);
      group.add(a, b);
    } else if (type === 'industrial') {
      const hall = new THREE.Mesh(
        new THREE.BoxGeometry(1.55, 0.85, 1.15),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.48 })
      );
      hall.position.set(0, 0.43, 0.16);
      const stack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 1.55, 12),
        new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.55 })
      );
      stack.position.set(-0.42, 0.78, -0.42);
      group.add(hall, stack);
    } else {
      const park = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.18, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x059669, roughness: 0.75 })
      );
      park.position.y = 0.09;
      const spire = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.36, 2.05, 6),
        new THREE.MeshStandardMaterial({ color: 0x34d399, roughness: 0.25 })
      );
      spire.position.y = 1.1;
      group.add(park, spire);
    }
    return group;
  };

  let frameId = null;
  const animate = () => {
    frameId = window.requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObserver.observe(container);

  return {
    syncState(state) {
      if (!state) return;
      if (state.districts.length < renderedMap.size) {
        for (const m of renderedMap.values()) districtsRoot.remove(m);
        renderedMap.clear();
      }
      for (const d of state.districts) {
        if (!renderedMap.has(d.id)) {
          const mesh = buildMesh(d.type);
          const p = slotPos(d.slotIndex);
          mesh.position.set(p.x, 0, p.z);
          districtsRoot.add(mesh);
          renderedMap.set(d.id, mesh);
        }
      }
    },
    resetCamera() {
      camera.position.set(16.5, 15.5, 18.5);
      controls.target.set(0, 0.5, 0);
      controls.update();
    },
    dispose() {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      controls.dispose();
      renderer.dispose();
    },
  };
}

export function createCityScene(container) {
  let latestState = null;
  let disposed = false;
  let backend = createIsometricCanvasBackend(container);

  // Attempt non-blocking WebGL upgrade in background if browser permits WebGL
  const probeCanvas = document.createElement('canvas');
  const webglAvailable = Boolean(
    probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl')
  );

  if (webglAvailable) {
    Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
    ])
      .then(([THREE, { OrbitControls }]) => {
        if (disposed) return;
        const webglBackend = createWebGLBackend(container, THREE, OrbitControls);
        backend.dispose();
        backend = webglBackend;
        if (latestState) {
          backend.syncState(latestState);
        }
      })
      .catch(() => {
        // Keep fast Isometric 2D Canvas backend active if CDN or WebGL fails
      });
  }

  return {
    syncState(state) {
      latestState = state;
      backend.syncState(state);
    },
    resetCamera() {
      backend.resetCamera();
    },
    dispose() {
      disposed = true;
      backend.dispose();
    },
  };
}
