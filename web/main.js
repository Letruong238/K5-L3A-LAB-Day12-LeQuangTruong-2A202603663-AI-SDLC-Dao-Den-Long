// Phần hiển thị 3D (Three.js). Toàn bộ luật chơi nằm ở src/core/game.js, ở đây chỉ vẽ và đọc phím.
import * as THREE from "three";
import { Game, DEFAULT_INPUT } from "/src/core/game.js";
import { TUNING as T, WORLD as W } from "/src/core/tuning.js";

const $ = (id) => document.getElementById(id);

// ---------- cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0714);
scene.fog = new THREE.FogExp2(0x120a22, 0.022);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 300);
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const hemi = new THREE.HemisphereLight(0x6a5acd, 0x1a1030, 0.35);
scene.add(hemi);

// Đảo, biển mây
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(W.island_radius, 64),
  new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);
const rim = new THREE.Mesh(new THREE.CylinderGeometry(W.island_radius, W.island_radius - 3, 3, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x1c1428, side: THREE.DoubleSide }));
rim.position.y = -1.5;
scene.add(rim);

// Sáng tạo của tôi: biển mây trôi quanh đảo (chỉ hiển thị, không ảnh hưởng luật chơi)
const clouds = new THREE.Group();
const cloudMat = new THREE.MeshStandardMaterial({ color: 0x8a7fb0, transparent: true, opacity: 0.55, roughness: 1 });
for (let i = 0; i < 40; i++) {
  const a = (i / 40) * Math.PI * 2;
  const r = W.island_radius + 6 + ((i * 37) % 23);
  const c = new THREE.Mesh(new THREE.SphereGeometry(3 + ((i * 13) % 5), 10, 8), cloudMat);
  c.position.set(Math.cos(a) * r, -3 + ((i * 7) % 4) * 0.5, Math.sin(a) * r);
  c.scale.y = 0.45;
  clouds.add(c);
}
scene.add(clouds);

// ---------- thực thể ----------
const lanternGroup = new THREE.Group();
scene.add(lanternGroup);
const lanternViews = [];
const motes = new Map();
const shades = new Map();
const moteGeo = new THREE.SphereGeometry(0.22, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xffe28a });
const shadeGeo = new THREE.SphereGeometry(0.9, 16, 12);

// Người chơi: Mây đội nón lá, treo đèn lồng nhỏ
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.0, 12), new THREE.MeshStandardMaterial({ color: 0x3b8f8a }));
body.position.y = 0.5;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf2c9a0 }));
head.position.y = 1.25;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.75, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0xd9b36a }));
hat.position.y = 1.62;
const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x5a3d1e }));
stick.position.set(0.5, 1.0, 0);
const pLamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
pLamp.position.set(0.5, 0.6, 0);
const pLight = new THREE.PointLight(0xffa64d, 18, 16, 2);
pLight.position.set(0.5, 0.8, 0);
player.add(body, head, hat, stick, pLamp, pLight);
scene.add(player);

// Hiệu ứng tỏa sáng
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
scene.add(ring);
let ringT = -1;

// ---------- trạng thái ----------
let game;
let acc = 0;
let camYaw = 0;
const keys = new Set();
const pending = { jump: false, interact: false, pulse: false };
let toastTimer = 0;

function toast(msg) {
  $("toast").textContent = msg;
  $("toast").style.opacity = 1;
  toastTimer = 1.8;
}

function newGame() {
  game = new Game({ seed: (Date.now() & 0x7fffffff) >>> 0 });
  acc = 0;
  for (const v of lanternViews) lanternGroup.remove(v.group);
  lanternViews.length = 0;
  for (const m of motes.values()) scene.remove(m);
  for (const s of shades.values()) scene.remove(s.mesh);
  motes.clear();
  shades.clear();
  for (const l of game.lanterns) {
    const g = new THREE.Group();
    g.position.set(l.pos[0], 0, l.pos[2]);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x4a3322 }));
    pole.position.y = 1.2;
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a2a2a, emissive: 0x000000 }));
    lamp.position.y = 2.95;
    const light = new THREE.PointLight(0xffa64d, 0, 30, 2);
    light.position.y = 3;
    const zone = new THREE.Mesh(new THREE.RingGeometry(T.safe_radius - 0.08, T.safe_radius, 48), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.12, side: THREE.DoubleSide }));
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.02;
    g.add(pole, lamp, light, zone);
    lanternGroup.add(g);
    lanternViews.push({ group: g, lamp, light, lit: false });
  }
  $("end").style.display = "none";
  toast("Đêm 1 – Đảo Bến. Gom đom đóm, thắp 5 ngọn đèn!");
}

// ---------- phím ----------
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.repeat) return;
  keys.add(k);
  if (k === " ") pending.jump = true;
  if (k === "e" || k === "enter") pending.interact = true;
  if (k === "f") pending.pulse = true;
  if (k === "r") newGame();
  if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k)) e.preventDefault();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
$("again").addEventListener("click", newGame);

function readInput() {
  const inp = DEFAULT_INPUT();
  // Camera nhìn theo +Z khi yaw = 0, nên phải/trái của màn hình là -X/+X.
  inp.move = [(keys.has("a") ? 1 : 0) - (keys.has("d") ? 1 : 0), (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0)];
  inp.cam_yaw_deg = (camYaw * 180) / Math.PI;
  inp.jump = keys.has(" ") || pending.jump;
  inp.interact = keys.has("e") || keys.has("enter") || pending.interact;
  inp.pulse = keys.has("f") || pending.pulse;
  return inp;
}

// ---------- vòng lặp ----------
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  if (keys.has("arrowleft")) camYaw += 1.8 * dt;
  if (keys.has("arrowright")) camYaw -= 1.8 * dt;

  if (game.state === "playing") {
    acc += dt;
    while (acc >= 1 / W.tps && game.state === "playing") {
      const inp = readInput();
      const events = game.step(inp);
      // chốt phím bấm nhanh đã được dùng ít nhất một tick
      pending.jump = pending.interact = pending.pulse = false;
      for (const ev of events) onEvent(ev);
      acc -= 1 / W.tps;
    }
  }
  sync(t);
  toastTimer -= dt;
  if (toastTimer < 0) $("toast").style.opacity = 0;
  renderer.render(scene, camera);
}

function onEvent(ev) {
  if (ev.name === "lantern_lit") toast("Một ngọn đèn đã sáng!");
  if (ev.name === "player_hit") toast("Bóng Mực chạm vào Mây!");
  if (ev.name === "pulse") {
    ringT = 0;
    ring.position.set(game.player.pos[0], 0.05, game.player.pos[2]);
  }
  if (ev.name === "shade_spawned") toast("Một Bóng Mực mới xuất hiện trong sương...");
  if (ev.name === "game_over") showEnd(ev.data);
}

function showEnd(d) {
  const won = d.result === "won";
  $("end-title").textContent = won ? "Đảo đã sáng trở lại!" : "Bóng tối đã nuốt hòn đảo";
  $("end-detail").textContent = won ? "Mây đã thắp sáng cả 5 ngọn đèn." : d.reason === "dawn" ? "Trời sáng mà đèn chưa thắp hết." : "Mây đã hết ngọn lửa.";
  $("end-score").textContent = `Điểm: ${game.score}`;
  $("end").style.display = "flex";
}

function sync(t) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = camYaw;
  player.visible = p.invuln === 0 || Math.floor(t * 12) % 2 === 0;
  pLight.intensity = 14 + Math.sin(t * 9) * 3 + p.carried * 1.2;

  // Đèn: sáng dần, đảo sáng dần khi thắp
  let lit = 0;
  game.lanterns.forEach((l, i) => {
    const v = lanternViews[i];
    if (l.lit) lit++;
    if (l.lit !== v.lit) {
      v.lit = l.lit;
      v.lamp.material.emissive.setHex(l.lit ? 0xffa64d : 0x000000);
      v.lamp.material.color.setHex(l.lit ? 0xffd27a : 0x3a2a2a);
      v.light.intensity = l.lit ? 220 : 0;
    }
    if (!l.lit && l.deposited > 0) v.lamp.material.emissive.setRGB((l.deposited / T.lantern_cost) * 0.5, (l.deposited / T.lantern_cost) * 0.25, 0);
  });
  hemi.intensity = 0.35 + lit * 0.18;
  scene.fog.density = 0.022 - lit * 0.003;

  // Đom đóm
  const seen = new Set();
  for (const m of game.motes) {
    seen.add(m.id);
    let mesh = motes.get(m.id);
    if (!mesh) {
      mesh = new THREE.Mesh(moteGeo, moteMat);
      motes.set(m.id, mesh);
      scene.add(mesh);
    }
    mesh.position.set(m.pos[0], 0.9 + Math.sin(t * 2 + m.pos[0]) * 0.25, m.pos[2]);
    mesh.scale.setScalar(0.85 + Math.sin(t * 5 + m.pos[2]) * 0.2); // lấp lánh
  }
  for (const [id, mesh] of motes) if (!seen.has(id)) { scene.remove(mesh); motes.delete(id); }

  // Bóng Mực
  const seenS = new Set();
  for (const s of game.shades) {
    seenS.add(s.id);
    let v = shades.get(s.id);
    if (!v) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x1a0a2e, emissive: 0x2a0a4a, roughness: 0.9 });
      v = { mesh: new THREE.Mesh(shadeGeo, mat), mat };
      shades.set(s.id, v);
      scene.add(v.mesh);
    }
    v.mesh.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3) * 0.1, s.pos[2]);
    v.mesh.scale.set(1, s.state === "stunned" ? 0.5 : 1 + Math.sin(t * 6) * 0.08, 1);
    v.mat.emissive.setHex(s.state === "stunned" ? 0x555577 : 0x2a0a4a);
  }
  for (const [id, v] of shades) if (!seenS.has(id)) { scene.remove(v.mesh); shades.delete(id); }

  // Vòng tỏa sáng
  if (ringT >= 0) {
    ringT += 1 / 60;
    const k = Math.min(ringT / 0.4, 1);
    ring.visible = true;
    ring.scale.setScalar(T.pulse_radius * k + 0.1);
    ring.material.opacity = 1 - k;
    if (k >= 1) { ringT = -1; ring.visible = false; }
  }
  clouds.rotation.y = t * 0.02;

  // Camera bám sau lưng Mây
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
  const target = new THREE.Vector3(p.pos[0] - fx * 11, 8 + p.pos[1] * 0.3, p.pos[2] - fz * 11);
  camera.position.lerp(target, 0.12);
  camera.lookAt(p.pos[0], 1.2, p.pos[2]);

  // HUD
  const flames = "🔥".repeat(p.flames) + "·".repeat(Math.max(0, T.flames - p.flames));
  $("hud").innerHTML =
    `Lửa: <b>${flames}</b><br>Đom đóm mang: <b>${p.carried}/${T.carry_capacity}</b><br>` +
    `Đèn đã thắp: <b>${lit}/${game.lanterns.length}</b><br>Điểm: <b>${game.score}</b><br>` +
    `Thời gian: <b>${Math.max(0, Math.ceil(game.timeLeftTicks / W.tps))}s</b>` +
    (p.pulseCd > 0 ? `<br>Tỏa sáng hồi: ${(p.pulseCd / W.tps).toFixed(1)}s` : "");
}

newGame();
frame();
