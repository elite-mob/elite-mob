import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const USERNAME = "elite-mob";
const API_URL = `https://github-contributions-api.jogruber.de/v4/${USERNAME}?y=last`;

const LEVEL_COLORS = [
  0x1a2330,
  0x355f2d,
  0x4f8f3d,
  0x6db84f,
  0x8fe06a,
];

const canvas = document.getElementById("canvas");
const loading = document.getElementById("loading");
const totalContributionsEl = document.getElementById("total-contributions");
const activeDaysEl = document.getElementById("active-days");
const bestDayEl = document.getElementById("best-day");
const hoveredDayEl = document.getElementById("hovered-day");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0f14, 28, 80);

const camera = new THREE.PerspectiveCamera(
  42,
  canvas.clientWidth / canvas.clientHeight,
  0.1,
  200,
);
camera.position.set(18, 16, 22);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI / 2.1;
controls.minDistance = 10;
controls.maxDistance = 48;
controls.target.set(0, 2, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const keyLight = new THREE.DirectionalLight(0xffffff, 1.1);
keyLight.position.set(10, 18, 12);
keyLight.castShadow = true;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x8fe06a, 0.35);
fillLight.position.set(-12, 8, -10);
scene.add(fillLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({
    color: 0x10161f,
    metalness: 0.1,
    roughness: 0.95,
  }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.01;
floor.receiveShadow = true;
scene.add(floor);

const grid = new THREE.GridHelper(70, 35, 0x243041, 0x18212d);
grid.position.y = 0.001;
scene.add(grid);

const blocks = [];
const blockMeshes = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function levelColor(level) {
  return LEVEL_COLORS[Math.max(0, Math.min(level, 4))];
}

function blockHeight(count, level) {
  if (count <= 0) return 0;
  return 0.35 + level * 0.55 + Math.min(count, 12) * 0.08;
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function updateStats(contributions) {
  const active = contributions.filter((entry) => entry.count > 0);
  const total = contributions.reduce((sum, entry) => sum + entry.count, 0);
  const best = active.reduce(
    (current, entry) => (entry.count > current.count ? entry : current),
    { count: 0, date: "—" },
  );

  totalContributionsEl.textContent = total.toLocaleString();
  activeDaysEl.textContent = active.length.toLocaleString();
  bestDayEl.textContent =
    best.count > 0 ? `${best.count} on ${formatDate(best.date)}` : "—";
}

function buildScene(contributions) {
  const weeks = [];
  let currentWeek = [];

  contributions.forEach((entry, index) => {
    currentWeek.push(entry);
    const day = new Date(`${entry.date}T00:00:00`).getDay();
    if (day === 6 || index === contributions.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  const weekSpacing = 1.15;
  const daySpacing = 1.05;
  const offsetX = ((weeks.length - 1) * weekSpacing) / 2;
  const offsetZ = (6 * daySpacing) / 2;
  const group = new THREE.Group();

  weeks.forEach((week, weekIndex) => {
    week.forEach((entry) => {
      if (entry.count <= 0) return;

      const date = new Date(`${entry.date}T00:00:00`);
      const dayIndex = date.getDay();
      const height = blockHeight(entry.count, entry.level);
      const geometry = new THREE.BoxGeometry(0.82, height, 0.82);
      const material = new THREE.MeshStandardMaterial({
        color: levelColor(entry.level),
        metalness: 0.18,
        roughness: 0.62,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(
        weekIndex * weekSpacing - offsetX,
        height / 2,
        dayIndex * daySpacing - offsetZ,
      );

      mesh.userData = entry;
      blocks.push(entry);
      blockMeshes.push(mesh);
      group.add(mesh);
    });
  });

  scene.add(group);
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function setHovered(entry) {
  if (!entry) {
    hoveredDayEl.textContent = "Drag to explore";
    return;
  }

  hoveredDayEl.textContent = `${entry.count} contribution${
    entry.count === 1 ? "" : "s"
  } on ${formatDate(entry.date)}`;
}

function onPointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(blockMeshes, false);
  canvas.style.cursor = hits.length > 0 ? "pointer" : "grab";
  setHovered(hits[0]?.object.userData ?? null);
}

async function init() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Contribution API failed (${response.status})`);
    }

    const data = await response.json();
    const contributions = data.contributions ?? [];
    updateStats(contributions);
    buildScene(contributions);
    loading.classList.add("hidden");
  } catch (error) {
    loading.textContent =
      "Unable to load contribution data. Please refresh in a moment.";
    console.error(error);
  }
}

window.addEventListener("resize", resize);
canvas.addEventListener("pointermove", onPointerMove);
canvas.addEventListener("pointerleave", () => setHovered(null));

resize();
init();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

animate();
