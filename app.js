// ==========================================================================
// ASMA-UL-HUSNA 3D INTERACTIVE ENGINE - FULLY MOBILE OPTIMIZED & TOUCH ENHANCED
// Features: Pinch-To-Zoom, Portrait Auto-Distance, Inertia Drag & Haptic Feedback
// ==========================================================================

let camera, scene, renderer;
const objects = [];
const targets = { table: [], sphere: [], helix: [], grid: [] };

let currentLayout = 'sphere';
let autoRotate = true;
let activeModalName = null;
let tasbeehCount = 0;
let bookmarkedIds = JSON.parse(localStorage.getItem('asma_bookmarks') || '[]');
let currentFilter = 'all';
let searchQuery = '';

// Spherical Orbit Camera Coordinates
let isUserInteracting = false;
let isPinching = false;
let onPointerDownMouseX = 0, onPointerDownMouseY = 0;
let lon = 0, onPointerDownLon = 0, targetLon = 0;
let lat = 10, onPointerDownLat = 10, targetLat = 10;

// Dynamic Camera Distance (Automatically adapts for Mobile Portrait vs Desktop)
function getBaseDistance() {
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isPortrait) {
    // In mobile portrait, push camera back so the 3D sphere fits screen width perfectly
    return Math.max(3100, (window.innerHeight / window.innerWidth) * 1600);
  }
  return 2500;
}

let distance = getBaseDistance();
let targetDistance = getBaseDistance();
let dragDist = 0;
let lastPinchDistance = 0;

// Web Audio API for Soft Chimes
let audioCtx = null;
function playChime(freq = 520, type = 'sine', duration = 0.22) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.3, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// Pronounce Arabic
function pronounceArabic(text) {
  playChime(660, 'sine', 0.35);
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ar-SA';
    utterance.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const arVoice = voices.find(v => v.lang.startsWith('ar'));
    if (arVoice) utterance.voice = arVoice;
    window.speechSynthesis.speak(utterance);
  }
}

// Initialize 3D Scene
function init3D() {
  const container = document.getElementById('container3d');

  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 10000);
  scene = new THREE.Scene();

  // Create 3D CSS Elements for all 99 Names
  NAMES_DATA.forEach((item) => {
    const isSaved = bookmarkedIds.includes(item.id);

    const element = document.createElement('div');
    element.className = `element-3d-card cat-${item.category}`;
    element.id = `card-${item.id}`;
    element.setAttribute('data-id', item.id);

    element.innerHTML = `
      <div class="card-top-row">
        <span class="card-num-badge">#${item.id}</span>
        <button class="card-heart-btn ${isSaved ? 'saved' : ''}" 
                onclick="event.stopPropagation(); toggleFavorite(${item.id})">
          ${isSaved ? '♥' : '♡'}
        </button>
      </div>

      <div class="card-arabic-name">${item.arabic}</div>
      <div class="card-translit">${item.transliteration}</div>
      <div class="card-urdu-meaning">${item.meaning_ur}</div>
      <div class="card-english-meaning">${item.meaning_en}</div>

      <div class="card-category-indicator">${item.category_label.split('(')[0]}</div>
    `;

    // Click handler checking drag distance (Prevents accidental open when dragging)
    element.addEventListener('click', () => {
      if (dragDist < 8) {
        openNameModal(item.id);
      }
    });

    const objectCSS = new THREE.CSS3DObject(element);
    objectCSS.position.x = Math.random() * 2400 - 1200;
    objectCSS.position.y = Math.random() * 2400 - 1200;
    objectCSS.position.z = Math.random() * 2400 - 1200;
    scene.add(objectCSS);

    objects.push(objectCSS);
  });

  const vector = new THREE.Vector3();

  // 1. SPHERE FORMATION
  const sphereRadius = 820;
  for (let i = 0; i < objects.length; i++) {
    const phi = Math.acos(-1 + (2 * i) / objects.length);
    const theta = Math.sqrt(objects.length * Math.PI) * phi;

    const object = new THREE.Object3D();
    object.position.setFromSphericalCoords(sphereRadius, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }

  // 2. TABLE FORMATION
  for (let i = 0; i < objects.length; i++) {
    const col = i % 11;
    const row = Math.floor(i / 11);

    const object = new THREE.Object3D();
    object.position.x = (col * 165) - 825;
    object.position.y = -(row * 200) + 800;
    object.position.z = 0;
    targets.table.push(object);
  }

  // 3. HELIX FORMATION
  for (let i = 0; i < objects.length; i++) {
    const theta = i * 0.175 + Math.PI;
    const y = -(i * 11) + 550;

    const object = new THREE.Object3D();
    object.position.setFromCylindricalCoords(900, theta, y);
    vector.x = object.position.x * 2;
    vector.y = object.position.y;
    vector.z = object.position.z * 2;
    object.lookAt(vector);
    targets.helix.push(object);
  }

  // 4. 3D GRID FORMATION
  for (let i = 0; i < objects.length; i++) {
    const object = new THREE.Object3D();
    object.position.x = ((i % 5) * 330) - 660;
    object.position.y = (-(Math.floor(i / 5) % 4) * 330) + 495;
    object.position.z = (Math.floor(i / 20)) * 480 - 960;
    targets.grid.push(object);
  }

  // Setup CSS3DRenderer
  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  // Setup Full Touch + Mouse Orbit Controller
  setupOrbitController();

  // Entrance into Sphere
  transform(targets.sphere, 2000);

  window.addEventListener('resize', onWindowResize);
}

// Touch & Mouse Orbit Controller with Pinch-to-Zoom
function setupOrbitController() {
  function getCoord(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  function onPointerDown(e) {
    if (e.target.closest('input, button, .modal-box')) return;

    // Two finger pinch detected
    if (e.touches && e.touches.length === 2) {
      isPinching = true;
      isUserInteracting = false;
      lastPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      return;
    }

    isPinching = false;
    isUserInteracting = true;
    dragDist = 0;
    const coord = getCoord(e);
    onPointerDownMouseX = coord.x;
    onPointerDownMouseY = coord.y;
    onPointerDownLon = targetLon;
    onPointerDownLat = targetLat;
    document.body.classList.add('grabbing');
  }

  function onPointerMove(e) {
    // Handle Two-Finger Pinch to Zoom on Mobile
    if (isPinching && e.touches && e.touches.length === 2) {
      const currentPinch = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const pinchDelta = currentPinch - lastPinchDistance;
      targetDistance -= pinchDelta * 4;
      targetDistance = Math.max(900, Math.min(5000, targetDistance));
      lastPinchDistance = currentPinch;
      return;
    }

    if (!isUserInteracting) return;
    const coord = getCoord(e);
    const dx = coord.x - onPointerDownMouseX;
    const dy = coord.y - onPointerDownMouseY;
    dragDist = Math.hypot(dx, dy);

    // Responsive drag sensitivity
    const sensitivity = window.innerWidth < 600 ? 0.3 : 0.22;
    targetLon = onPointerDownLon - dx * sensitivity;
    targetLat = Math.max(-75, Math.min(75, onPointerDownLat + dy * sensitivity));
  }

  function onPointerUp(e) {
    if (e.touches && e.touches.length === 0) {
      isUserInteracting = false;
      isPinching = false;
      document.body.classList.remove('grabbing');
    } else if (!e.touches) {
      isUserInteracting = false;
      isPinching = false;
      document.body.classList.remove('grabbing');
    }
  }

  function onWheel(e) {
    targetDistance += e.deltaY * 1.5;
    targetDistance = Math.max(900, Math.min(5000, targetDistance));
  }

  window.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  window.addEventListener('touchstart', onPointerDown, { passive: true });
  window.addEventListener('touchmove', onPointerMove, { passive: true });
  window.addEventListener('touchend', onPointerUp);
  window.addEventListener('touchcancel', onPointerUp);

  window.addEventListener('wheel', onWheel, { passive: true });
}

// Smooth 3D Transformation with Tween
function transform(targetArray, duration = 1800) {
  TWEEN.removeAll();

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    const target = targetArray[i];

    new TWEEN.Tween(object.position)
      .to({ x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * (duration * 0.5) + duration)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to({ x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * (duration * 0.5) + duration)
      .easing(TWEEN.Easing.Cubic.InOut)
      .start();
  }

  new TWEEN.Tween(this)
    .to({}, duration * 1.5)
    .onUpdate(render)
    .start();
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);

  // Auto-adjust default distance if user switches orientation (portrait <-> landscape)
  targetDistance = getBaseDistance();
  render();
}

// 60 FPS Render Loop
function animate() {
  requestAnimationFrame(animate);

  TWEEN.update();

  // Celestial auto-spin when idle
  if (!isUserInteracting && !isPinching && autoRotate) {
    targetLon += 0.16;
  }

  // Smooth lerp (0.08 damping creates super silky glide)
  lon += (targetLon - lon) * 0.08;
  lat += (targetLat - lat) * 0.08;
  distance += (targetDistance - distance) * 0.08;

  // Spherical camera positioning around center
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon);

  camera.position.x = distance * Math.sin(phi) * Math.cos(theta);
  camera.position.y = distance * Math.cos(phi);
  camera.position.z = distance * Math.sin(phi) * Math.sin(theta);
  camera.lookAt(0, -30, 0);

  render();
}

function render() {
  renderer.render(scene, camera);
}

// Switch 3D Layout
function switchLayout(layoutName) {
  currentLayout = layoutName;
  playChime(560, 'sine', 0.2);

  document.querySelectorAll('.view-mode-toolbar .toolbar-btn[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === layoutName);
  });

  if (layoutName === 'sphere') {
    transform(targets.sphere, 1800);
  } else if (layoutName === 'table') {
    targetLat = 0;
    targetLon = 0;
    transform(targets.table, 1800);
  } else if (layoutName === 'helix') {
    targetLat = 15;
    transform(targets.helix, 1800);
  } else if (layoutName === 'grid') {
    transform(targets.grid, 1800);
  }
}

// Filter and Search Cards
function applyFilters() {
  const query = searchQuery.trim().toLowerCase();

  NAMES_DATA.forEach(item => {
    const cardEl = document.getElementById(`card-${item.id}`);
    if (!cardEl) return;

    let matchesCategory = true;
    if (currentFilter === 'saved') {
      matchesCategory = bookmarkedIds.includes(item.id);
    } else if (currentFilter !== 'all') {
      matchesCategory = item.category === currentFilter;
    }

    let matchesSearch = true;
    if (query) {
      const matchId = item.id.toString() === query;
      const matchTranslit = item.transliteration.toLowerCase().includes(query);
      const matchArabic = item.arabic.includes(query);
      const matchEn = item.meaning_en.toLowerCase().includes(query);
      const matchUr = item.meaning_ur.includes(query);
      matchesSearch = matchId || matchTranslit || matchArabic || matchEn || matchUr;
    }

    const isMatch = matchesCategory && matchesSearch;

    if (isMatch) {
      cardEl.classList.remove('dimmed');
      if (query || currentFilter !== 'all') {
        cardEl.classList.add('highlighted');
      } else {
        cardEl.classList.remove('highlighted');
      }
    } else {
      cardEl.classList.add('dimmed');
      cardEl.classList.remove('highlighted');
    }
  });

  render();
}

// Toggle Favorite
function toggleFavorite(id) {
  if (bookmarkedIds.includes(id)) {
    bookmarkedIds = bookmarkedIds.filter(x => x !== id);
  } else {
    bookmarkedIds.push(id);
    playChime(750, 'sine', 0.2);
  }
  localStorage.setItem('asma_bookmarks', JSON.stringify(bookmarkedIds));

  const cardEl = document.getElementById(`card-${id}`);
  if (cardEl) {
    const btn = cardEl.querySelector('.card-heart-btn');
    const isSaved = bookmarkedIds.includes(id);
    btn.className = `card-heart-btn ${isSaved ? 'saved' : ''}`;
    btn.textContent = isSaved ? '♥' : '♡';
  }

  if (currentFilter === 'saved') applyFilters();
}

// Open Detail Modal
function openNameModal(id) {
  const item = NAMES_DATA.find(x => x.id === id);
  if (!item) return;

  activeModalName = item;
  tasbeehCount = 0;

  document.getElementById('modalNumber').textContent = `#${item.id} of 99`;
  document.getElementById('modalArabic').textContent = item.arabic;
  document.getElementById('modalTranslit').textContent = item.transliteration;
  document.getElementById('modalUrdu').textContent = item.meaning_ur;
  document.getElementById('modalEnglish').textContent = item.meaning_en;
  document.getElementById('modalCategory').textContent = item.category_label;
  document.getElementById('modalQuranRef').textContent = item.quran_ref;
  document.getElementById('modalExplanationEn').textContent = item.explanation_en;
  document.getElementById('modalExplanationUr').textContent = item.explanation_ur;
  document.getElementById('modalFazilat').textContent = item.fazilat;
  document.getElementById('tasbeehDisplay').textContent = '0';
  document.getElementById('tasbeehNameLabel').textContent = `Recite: "Ya ${item.transliteration.replace(/^(Al-|Ar-|As-|Ash-|Az-|At-|Ad-)/, '')}"`;

  const modal = document.getElementById('nameModal');
  modal.classList.add('active');
  playChime(480, 'triangle', 0.2);
}

function closeModal() {
  const modal = document.getElementById('nameModal');
  modal.classList.remove('active');
  activeModalName = null;
}

// Tasbeeh Counter with Haptic Vibration
function incrementTasbeeh() {
  tasbeehCount++;
  document.getElementById('tasbeehDisplay').textContent = tasbeehCount;

  const tone = 440 + (tasbeehCount % 33) * 8;
  playChime(tone, 'sine', 0.12);

  // Native mobile vibration on each tap!
  if ('vibrate' in navigator) navigator.vibrate(30);

  if (tasbeehCount === 33 || tasbeehCount === 99 || tasbeehCount === 100) {
    setTimeout(() => playChime(880, 'sine', 0.4), 100);
  }
}

function resetTasbeeh() {
  tasbeehCount = 0;
  document.getElementById('tasbeehDisplay').textContent = '0';
  playChime(320, 'triangle', 0.15);
  if ('vibrate' in navigator) navigator.vibrate([20, 40, 20]);
}

// Random Wazeefa
function pickRandom() {
  const rand = NAMES_DATA[Math.floor(Math.random() * NAMES_DATA.length)];
  openNameModal(rand.id);
}

// Ultra-Light Stardust Particles (60 FPS Guaranteed)
function initStardustCanvas() {
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d');
  let width, height;
  const particles = [];
  const count = window.innerWidth < 600 ? 35 : 60; // Fewer particles on mobile for speed

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.6 + 0.2,
      speedX: (Math.random() - 0.5) * 0.25,
      speedY: (Math.random() - 0.5) * 0.25,
      color: Math.random() > 0.35 ? '#d4af37' : '#10b981'
    });
  }

  function renderParticles() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.speedX;
      p.y += p.speedY;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    }

    requestAnimationFrame(renderParticles);
  }
  renderParticles();
}

// Initialization on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initStardustCanvas();
  init3D();
  animate();

  // Toolbar View Switcher
  document.querySelectorAll('.view-mode-toolbar .toolbar-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchLayout(btn.getAttribute('data-view'));
    });
  });

  // Auto-Rotate Toggle Button
  const autoRotateBtn = document.getElementById('autoRotateBtn');
  autoRotateBtn.addEventListener('click', () => {
    autoRotate = !autoRotate;
    autoRotateBtn.classList.toggle('active', autoRotate);
    const labelSpan = autoRotateBtn.querySelector('.btn-label');
    if (labelSpan) {
      labelSpan.textContent = autoRotate ? 'Auto-Spin: ON' : 'Auto-Spin: OFF';
    }
    playChime(autoRotate ? 600 : 400, 'sine', 0.15);
  });

  // Category Filter Pills
  document.querySelectorAll('.cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-cat');
      applyFilters();
    });
  });

  // Search Input
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    clearBtn.style.display = searchQuery ? 'block' : 'none';
    applyFilters();
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearBtn.style.display = 'none';
    applyFilters();
  });

  // Wazeefa Button
  document.getElementById('randomWazeefaBtn').addEventListener('click', pickRandom);

  // Modal Audio & Tasbeeh
  document.getElementById('pronounceBtn').addEventListener('click', () => {
    if (activeModalName) pronounceArabic(activeModalName.arabic);
  });

  document.getElementById('tasbeehTapBtn').addEventListener('click', incrementTasbeeh);
  document.getElementById('tasbeehResetBtn').addEventListener('click', resetTasbeeh);
  document.getElementById('closeModalBtn').addEventListener('click', closeModal);

  document.getElementById('nameModal').addEventListener('click', (e) => {
    if (e.target.id === 'nameModal') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
    if (e.code === 'Space' && activeModalName && document.getElementById('nameModal').classList.contains('active')) {
      e.preventDefault();
      incrementTasbeeh();
    }
  });
});
