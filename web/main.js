// Phần hiển thị và luồng game (Three.js). Toàn bộ luật chơi nằm ở src/core/game.js; ở đây chỉ vẽ, đọc phím, HUD, âm thanh.
import * as THREE from "three";
import { Game, DEFAULT_INPUT } from "/src/core/game.js";
import { TUNING as T, WORLD as W } from "/src/core/tuning.js";
import { MAPS } from "/src/core/maps.js";
import { buildWorld, C } from "/web/scene.js";
import { sfx, unlock, setVolume } from "/web/audio.js";

const $ = (id) => document.getElementById(id);
const OVERLAYS = ["menu", "intro", "result", "dawn", "pause", "settings"];
const showOverlay = (id) => OVERLAYS.forEach((o) => $(o).classList.toggle("show", o === id));

// ---------- cài đặt (lưu giữa các lần mở game) ----------
const settings = { volume: 0.6, sens: 1 };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem("ddl.settings") || "{}"));
} catch {
  /* không có localStorage thì dùng mặc định */
}
function saveSettings() {
  try {
    localStorage.setItem("ddl.settings", JSON.stringify(settings));
  } catch {
    /* bỏ qua */
  }
}
setVolume(settings.volume);

// ---------- cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.016);
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 400);
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
const ambient = new THREE.AmbientLight(0xaab4ff, 0.15); // cường độ cập nhật theo công thức của ticket
scene.add(ambient);
// Ánh trăng nhẹ cố định để nhìn rõ địa hình (không thay công thức ánh sáng môi trường ở trên)
const moon = new THREE.DirectionalLight(0x8fa0f0, 0.9);
moon.position.set(-30, 50, -20);
scene.add(moon);

// Sáng tạo của tôi: biển mây trôi quanh đảo (chỉ hiển thị, không ảnh hưởng luật chơi)
const clouds = new THREE.Group();
const cloudMat = new THREE.MeshStandardMaterial({ color: 0x8a7fb0, transparent: true, opacity: 0.5, roughness: 1 });
for (let i = 0; i < 50; i++) {
  const a = (i / 50) * Math.PI * 2;
  const r = 70 + ((i * 37) % 60);
  const c = new THREE.Mesh(new THREE.SphereGeometry(3 + ((i * 13) % 5), 10, 8), cloudMat);
  c.position.set(35 + Math.cos(a) * r, -6 + ((i * 7) % 4) * 0.5, Math.sin(a) * r);
  c.scale.y = 0.45;
  clouds.add(c);
}
scene.add(clouds);

// Người chơi: Mây đội nón lá, khăn đỏ, treo đèn lồng nhỏ
const player = new THREE.Group();
{
  const m = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 1, 12), m(C.robe));
  body.position.y = 0.5;
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 8, 16), m(C.scarf));
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), m(0xf2c9a0));
  head.position.y = 1.3;
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.78, 0.5, 20), m(C.sand));
  hat.position.y = 1.7;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), m(C.wood));
  stick.position.set(0.5, 1.0, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: C.lampOn }));
  lamp.position.set(0.5, 0.6, 0);
  player.userData.light = new THREE.PointLight(C.lampOn, 18, 16, 2);
  player.userData.light.position.set(0.5, 0.8, 0);
  player.add(body, scarf, head, hat, stick, lamp, player.userData.light);
}
scene.add(player);
const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: C.lampCore, transparent: true, side: THREE.DoubleSide }));
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
scene.add(ring);
let ringT = -1;

// Lá bay báo gió
const leaves = Array.from({ length: 40 }, () => {
  const l = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.2), new THREE.MeshBasicMaterial({ color: C.grass, side: THREE.DoubleSide }));
  l.visible = false;
  scene.add(l);
  return l;
});

const moteGeo = new THREE.SphereGeometry(0.2, 10, 8);
const haloGeo = new THREE.SphereGeometry(0.45, 10, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: C.moteCore });
const haloMat = new THREE.MeshBasicMaterial({ color: C.moteHalo, transparent: true, opacity: 0.28, depthWrite: false });
const shadeGeo = new THREE.SphereGeometry(0.9, 18, 14);
const rimGeo = new THREE.TorusGeometry(0.95, 0.06, 8, 24);
const ribbonGeo = new THREE.PlaneGeometry(2.2, 0.5, 8, 1);

// ---------- trạng thái ----------
let game = null;
let world = null;
let night = 1;
let totalScore = 0;
let screen = "menu";
let acc = 0;
let camYaw = 0;
let settingsFrom = "menu";
let lastSecond = -1;
const keys = new Set();
const latch = { jump: false, interact: false, pulse: false, dash: false };
const pools = { motes: new Map(), shades: new Map(), drifters: new Map() };
let toastTimer = 0;

const INFO = {
  1: { name: "Đảo Bến", detail: "Hòn đảo tròn đầu tiên, năm ngọn đèn đang tắt.", quote: "“Đi chậm thôi, cháu. Sương đen sợ ánh sáng, nhưng nó kiên nhẫn lắm.” (Ông Đăng)" },
  2: { name: "Đảo Cau", detail: "Hai đảo nối nhau bằng cầu tre không lan can, có bục nhảy và Gió Lạc hay cướp đom đóm.", quote: "“Cầu tre hẹp lắm, nhìn đường mà đi. Gặp bùa đỏ thì cứ nhặt.” (Ông Đăng)" },
  3: { name: "Đảo Chuông", detail: "Ba tầng đảo, dốc, bục nhảy và tháp chuông. Cứ nửa phút lại có một cơn gió mạnh.", quote: "“Tiếng chuông này lâu lắm rồi chưa ai nghe. Thắp hết đèn, Mây nhé.” (Ông Đăng)" },
};

function toast(msg) {
  $("toast").textContent = msg;
  $("toast").style.opacity = 1;
  toastTimer = 1.8;
}

function clearPools() {
  for (const k of Object.keys(pools)) {
    for (const v of pools[k].values()) scene.remove(v.mesh ?? v);
    pools[k].clear();
  }
}

// Dựng đêm n (nền hiện sau màn giới thiệu); chưa chạy logic tới khi bấm "Vào đêm".
function prepare(n) {
  night = n;
  game = new Game({ seed: (Date.now() & 0x7fffffff) >>> 0, night: n });
  if (world) world.dispose();
  clearPools();
  world = buildWorld(scene, game);
  acc = 0;
  lastSecond = -1;
  camYaw = 0;
  const s = game.player.pos;
  camera.position.set(s[0], s[1] + 9, s[2] - 12);
  $("intro-title").textContent = `Đêm ${n} – ${INFO[n].name}`;
  $("intro-detail").textContent = INFO[n].detail;
  $("intro-quote").textContent = INFO[n].quote;
  showOverlay("intro");
  screen = "intro";
  syncScene(0);
}
function beginPlay() {
  unlock();
  showOverlay(null);
  screen = "play";
  toast(`Đêm ${night}: thắp ${game.lanterns.length} ngọn đèn!`);
}

// ---------- tạm dừng ----------
const stepWith = (over) => game.step({ ...DEFAULT_INPUT(), ...over });
function pauseGame() {
  if (screen !== "play" || game.state !== "playing") return;
  stepWith({ pause: true }); // core: paused, dừng logic hoàn toàn
  stepWith({ pause: false }); // nhả nút để lần sau có cạnh lên
  screen = "paused";
  showOverlay("pause");
}
function resumeGame() {
  if (screen !== "paused") return;
  stepWith({ pause: true }); // core: resumed
  screen = "play";
  showOverlay(null);
}

// ---------- phím và chuột ----------
addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  unlock();
  if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(k)) e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === "escape" || k === "p") {
    if (screen === "play") pauseGame();
    else if (screen === "paused") resumeGame();
    return;
  }
  if (k === "enter" && screen === "intro") beginPlay();
  if (k === "f3") $("fps").style.display = $("fps").style.display === "block" ? "none" : "block";
  if (screen !== "play") return;
  if (k === " ") {
    latch.jump = true;
    if (game.player.grounded) sfx.jump();
  }
  if (k === "e" || k === "enter") latch.interact = true;
  if (k === "f") latch.pulse = true;
  if (k === "shift") latch.dash = true;
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
let drag = null;
addEventListener("mousedown", (e) => {
  if (e.target === renderer.domElement) drag = e.clientX;
});
addEventListener("mouseup", () => (drag = null));
addEventListener("mousemove", (e) => {
  if (drag === null) return;
  camYaw -= (e.clientX - drag) * 0.006 * settings.sens;
  drag = e.clientX;
});

function readInput() {
  const inp = DEFAULT_INPUT();
  // Camera nhìn theo +Z khi yaw = 0 nên phải/trái của màn hình là -X/+X.
  inp.move = [(keys.has("a") ? 1 : 0) - (keys.has("d") ? 1 : 0), (keys.has("w") ? 1 : 0) - (keys.has("s") ? 1 : 0)];
  inp.cam_yaw_deg = (camYaw * 180) / Math.PI;
  inp.jump = keys.has(" ") || latch.jump;
  inp.interact = keys.has("e") || keys.has("enter") || latch.interact;
  inp.pulse = keys.has("f") || latch.pulse;
  inp.dash = keys.has("shift") || latch.dash;
  return inp;
}

// ---------- sự kiện game -> âm thanh/hiệu ứng ----------
function onEvent(ev) {
  switch (ev.name) {
    case "mote_picked": sfx.mote(); break;
    case "deposit": sfx.deposit(); break;
    case "lantern_lit": sfx.lit(); toast("Một ngọn đèn đã sáng!"); break;
    case "pulse":
      sfx.pulse();
      ringT = 0;
      ring.position.set(game.player.pos[0], game.player.pos[1] + 0.06, game.player.pos[2]);
      break;
    case "player_hit": sfx.hit(); toast(ev.data.by === "fall" ? "Mây rơi khỏi đảo!" : "Bóng Mực chạm vào Mây!"); break;
    case "dash": sfx.dash(); break;
    case "charm_picked": sfx.charm(); toast("Bùa Gió! Chạy nhanh và lướt không cần chờ."); break;
    case "drifter_steal": sfx.steal(); toast("Gió Lạc cướp đom đóm của Mây!"); break;
    case "drifter_drop": toast("Gió Lạc làm rơi đom đóm!"); break;
    case "shade_spawned": sfx.spawn(); break;
    case "game_over": finish(ev.data); break;
    default: break;
  }
}

function finish(d) {
  const won = d.result === "won";
  (won ? sfx.win : sfx.lose)();
  setTimeout(() => {
    $("res-title").textContent = won ? "Đảo đã sáng trở lại!" : "Bóng tối đã nuốt hòn đảo";
    $("res-detail").textContent = won ? `Mây đã thắp sáng cả ${game.lanterns.length} ngọn đèn.` : d.reason === "dawn" ? "Trời sáng mà đèn chưa thắp hết." : "Mây đã hết ngọn lửa.";
    if (won) totalScore += game.score;
    $("res-score").textContent = `Điểm đêm này: ${game.score}${won ? ` · Tổng: ${totalScore}` : ""}`;
    $("b-next").style.display = won && night < 3 ? "" : "none";
    if (won && night === 3) {
      $("dawn-score").textContent = `Tổng điểm: ${totalScore}`;
      showOverlay("dawn");
      screen = "dawn";
    } else {
      showOverlay("result");
      screen = "result";
    }
  }, 1200);
}

// ---------- vòng lặp ----------
const clock = new THREE.Clock();
const fpsBuf = [];
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const t = clock.elapsedTime;
  fpsBuf.push(dt);
  if (fpsBuf.length > 60) fpsBuf.shift();
  window.__fps = 1 / (fpsBuf.reduce((a, b) => a + b, 0) / fpsBuf.length);
  if (keys.has("arrowleft")) camYaw += 1.8 * dt * settings.sens;
  if (keys.has("arrowright")) camYaw -= 1.8 * dt * settings.sens;

  if (screen === "play" && game.state === "playing") {
    acc += dt;
    while (acc >= 1 / W.tps && game.state === "playing" && !game.paused) {
      const events = game.step(readInput());
      latch.jump = latch.interact = latch.pulse = latch.dash = false;
      for (const ev of events) onEvent(ev);
      acc -= 1 / W.tps;
    }
    const sec = Math.ceil(game.timeLeftTicks / W.tps);
    if (sec <= 10 && sec !== lastSecond && sec > 0) sfx.tick();
    lastSecond = sec;
  }
  syncScene(t);
  toastTimer -= dt;
  if (toastTimer < 0) $("toast").style.opacity = 0;
  if ($("fps").style.display === "block") $("fps").textContent = `${window.__fps.toFixed(0)} FPS`;
  renderer.render(scene, camera);
}

// ---------- đồng bộ cảnh và HUD ----------
const tmpV = new THREE.Vector3();
function syncScene(t) {
  const p = game.player;
  player.position.set(p.pos[0], p.pos[1], p.pos[2]);
  player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  player.visible = p.invuln === 0 || Math.floor(t * 12) % 2 === 0;
  player.scale.set(1, 1, p.dashLeft > 0 ? 1.5 : 1);
  player.userData.light.intensity = 14 + Math.sin(t * 9) * 3 + p.carried * 1.2;

  // Đèn: sáng dần khi thắp; ánh sáng môi trường = 0.15 + 0.55 * (đèn sáng / tổng đèn)
  const lit = game.lanterns.filter((l) => l.lit).length;
  game.lanterns.forEach((l, i) => {
    const v = world.lanterns[i];
    if (l.lit !== v.lit) {
      v.lit = l.lit;
      v.lampMat.color.setHex(l.lit ? C.lampCore : C.lampOff);
      v.lampMat.emissive.setHex(l.lit ? C.lampOn : 0x000000);
      v.light.intensity = l.lit ? 260 : 0;
      v.zone.visible = l.lit;
    }
    if (!l.lit && l.deposited > 0) v.lampMat.emissive.setRGB(0.5 * (l.deposited / T.lantern_cost), 0.25 * (l.deposited / T.lantern_cost), 0);
  });
  ambient.intensity = 0.15 + 0.55 * (lit / game.lanterns.length);
  scene.fog.density = 0.017 - 0.006 * (lit / game.lanterns.length);

  // Bùa
  game.charms.forEach((c, i) => {
    const g = world.charms[i].group;
    g.visible = c.available;
    g.rotation.y = t * 1.5;
    g.position.y = c.pos[1] + 1.2 + Math.sin(t * 2 + i) * 0.15;
  });

  // Đom đóm (lõi + quầng), lấp lánh
  const seen = new Set();
  for (const m of game.motes) {
    seen.add(m.id);
    let v = pools.motes.get(m.id);
    if (!v) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(moteGeo, moteMat), new THREE.Mesh(haloGeo, haloMat));
      scene.add(g);
      v = { mesh: g };
      pools.motes.set(m.id, v);
    }
    v.mesh.position.set(m.pos[0], m.pos[1] + 0.9 + Math.sin(t * 2 + m.pos[0]) * 0.25, m.pos[2]);
    v.mesh.scale.setScalar(0.85 + Math.sin(t * 5 + m.pos[2]) * 0.2);
    v.mesh.visible = m.ttl === null || m.ttl > 60 || Math.floor(t * 8) % 2 === 0; // đom đóm rơi nhấp nháy khi sắp hết hạn
  }
  for (const [id, v] of pools.motes) if (!seen.has(id)) { scene.remove(v.mesh); pools.motes.delete(id); }

  // Bóng Mực
  const seenS = new Set();
  for (const s of game.shades) {
    seenS.add(s.id);
    let v = pools.shades.get(s.id);
    if (!v) {
      const body = new THREE.Mesh(shadeGeo, new THREE.MeshStandardMaterial({ color: C.shade, emissive: 0x000000, roughness: 0.9 }));
      const rim = new THREE.Mesh(rimGeo, new THREE.MeshBasicMaterial({ color: C.shadeRim }));
      rim.rotation.x = Math.PI / 2;
      const g = new THREE.Group();
      g.add(body, rim);
      scene.add(g);
      v = { mesh: g, body, rim };
      pools.shades.set(s.id, v);
    }
    const stunned = s.state === "stunned";
    v.mesh.position.set(s.pos[0], s.pos[1] + Math.sin(t * 3) * 0.1, s.pos[2]);
    const grow = s.state === "spawning" ? 1 - s.left / W.shade_spawning_ticks : 1;
    v.mesh.scale.set(grow, grow * (stunned ? 0.5 : 1 + Math.sin(t * 6) * 0.08), grow);
    v.body.material.color.setHex(stunned ? C.shadeStun : C.shade);
    v.rim.material.color.setHex(stunned ? C.shadeStun : C.shadeRim);
  }
  for (const [id, v] of pools.shades) if (!seenS.has(id)) { scene.remove(v.mesh); pools.shades.delete(id); }

  // Gió Lạc: dải lụa xám xanh
  const seenD = new Set();
  for (const d of game.drifters) {
    seenD.add(d.id);
    let v = pools.drifters.get(d.id);
    if (!v) {
      const mesh = new THREE.Mesh(ribbonGeo, new THREE.MeshBasicMaterial({ color: C.drifter, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      scene.add(mesh);
      v = { mesh };
      pools.drifters.set(d.id, v);
    }
    v.mesh.position.set(d.pos[0], d.pos[1] + Math.sin(t * 4) * 0.2, d.pos[2]);
    v.mesh.rotation.y = t * 2;
    v.mesh.rotation.z = Math.sin(t * 6) * 0.4;
  }
  for (const [id, v] of pools.drifters) if (!seenD.has(id)) { scene.remove(v.mesh); pools.drifters.delete(id); }

  // Vòng tỏa sáng
  if (ringT >= 0) {
    ringT += 1 / 60;
    const k = Math.min(ringT / 0.4, 1);
    ring.visible = true;
    ring.scale.setScalar(T.pulse_radius * k + 0.1);
    ring.material.opacity = 1 - k;
    if (k >= 1) { ringT = -1; ring.visible = false; }
  }
  clouds.rotation.y = t * 0.01;

  // Lá bay báo gió (trước 2 s) và khi gió thổi
  const w = game.wind;
  const warn = w.pendingDir !== null && !w.active;
  if ((warn || w.active) && screen === "play") {
    const dir = ((w.active ? w.dir : w.pendingDir) * Math.PI) / 180;
    leaves.forEach((l, i) => {
      l.visible = true;
      const ph = (t * (w.active ? 0.8 : 0.3) + i / leaves.length) % 1;
      const ox = Math.cos(dir) * (ph - 0.5) * 40 + Math.sin(i * 12.9) * 12;
      const oz = Math.sin(dir) * (ph - 0.5) * 40 + Math.cos(i * 7.3) * 12;
      l.position.set(p.pos[0] + ox, p.pos[1] + 1 + (i % 5) * 0.8, p.pos[2] + oz);
      l.rotation.set(t * 3 + i, t * 2, t);
    });
    if (warn && !syncScene.warned) { syncScene.warned = true; sfx.wind(); toast("Gió mạnh sắp nổi!"); }
  } else {
    leaves.forEach((l) => (l.visible = false));
    syncScene.warned = false;
  }

  // Camera bám sau lưng Mây
  const fx = Math.sin(camYaw);
  const fz = Math.cos(camYaw);
  camera.position.lerp(tmpV.set(p.pos[0] - fx * 11, p.pos[1] + 8, p.pos[2] - fz * 11), 0.12);
  camera.lookAt(p.pos[0], p.pos[1] + 1.2, p.pos[2]);

  updateHud(p, lit);
}

function updateHud(p, lit) {
  const secs = Math.max(0, Math.ceil(game.timeLeftTicks / W.tps));
  $("flames").textContent = "🔥".repeat(p.flames) + "·".repeat(Math.max(0, T.flames - p.flames));
  $("timer").textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  $("timer").classList.toggle("low", secs <= 30);
  $("stats").innerHTML = `Đèn <b>${lit}/${game.lanterns.length}</b><br>Điểm <b>${game.score}</b>`;
  const bar = $("motes");
  if (bar.children.length !== T.carry_capacity) bar.innerHTML = "<i></i>".repeat(T.carry_capacity);
  [...bar.children].forEach((el, i) => el.classList.toggle("on", i < p.carried));

  const dashReady = p.charm > 0 || p.dashCd === 0;
  $("cd-dash").classList.toggle("ready", dashReady);
  $("cd-dash").lastElementChild.style.height = `${dashReady ? 0 : (p.dashCd / (T.dash_cooldown_s * W.tps)) * 100}%`;
  const pulseReady = p.pulseCd === 0 && p.carried >= T.pulse_cost;
  $("cd-pulse").classList.toggle("ready", pulseReady);
  $("cd-pulse").lastElementChild.style.height = `${(p.pulseCd / (T.pulse_cooldown_s * W.tps)) * 100}%`;
  $("charm").style.display = p.charm > 0 ? "block" : "none";
  $("charm").textContent = `Bùa Gió ${(p.charm / W.tps).toFixed(0)}s`;

  // Nhắc nạp đèn khi đứng gần đèn chưa sáng
  const unlit = game.lanterns.filter((l) => !l.lit);
  const close = unlit.find((l) => Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius && Math.abs(l.pos[1] - p.pos[1]) <= W.vertical_tol);
  $("prompt").style.display = close && screen === "play" ? "block" : "none";
  $("prompt").textContent = `E — Nạp ánh sáng (${p.carried}/${T.carry_capacity})`;

  // Mũi tên chỉ tới đèn chưa sáng gần nhất khi nó ngoài màn hình
  const arrow = $("arrow");
  const target = unlit.sort((a, b) => Math.hypot(a.pos[0] - p.pos[0], a.pos[2] - p.pos[2]) - Math.hypot(b.pos[0] - p.pos[0], b.pos[2] - p.pos[2]))[0];
  if (target && screen === "play") {
    tmpV.set(target.pos[0], target.pos[1] + 3, target.pos[2]).project(camera);
    const off = tmpV.z > 1 || Math.abs(tmpV.x) > 0.95 || Math.abs(tmpV.y) > 0.95;
    if (off) {
      let x = tmpV.x;
      let y = tmpV.y;
      if (tmpV.z > 1) { x = -x; y = -y; }
      const m = Math.max(Math.abs(x), Math.abs(y), 1e-6);
      x /= m; y /= m;
      arrow.style.display = "block";
      arrow.style.left = `${((x * 0.9 + 1) / 2) * innerWidth - 12}px`;
      arrow.style.top = `${((1 - y * 0.88) / 2) * innerHeight - 13}px`;
      arrow.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
    } else arrow.style.display = "none";
  } else arrow.style.display = "none";
}

// ---------- nút ----------
const click = (id, fn) => $(id).addEventListener("click", () => { unlock(); sfx.click(); fn(); });
click("b-play", () => { totalScore = 0; prepare(1); });
click("b-go", beginPlay);
click("b-next", () => prepare(night + 1));
click("b-retry", () => prepare(night));
click("b-res-menu", () => { showOverlay("menu"); screen = "menu"; });
click("b-dawn-menu", () => { showOverlay("menu"); screen = "menu"; });
click("b-resume", resumeGame);
click("b-restart", () => { prepare(night); });
click("b-pause-menu", () => { showOverlay("menu"); screen = "menu"; });
click("b-menu-settings", () => openSettings("menu"));
click("b-pause-settings", () => openSettings("pause"));
click("b-settings-back", () => { showOverlay(settingsFrom); });

function openSettings(from) {
  settingsFrom = from;
  $("s-vol").value = settings.volume;
  $("s-sens").value = settings.sens;
  $("s-vol-v").textContent = `${Math.round(settings.volume * 100)}%`;
  $("s-sens-v").textContent = settings.sens.toFixed(1);
  showOverlay("settings");
}
$("s-vol").addEventListener("input", (e) => {
  settings.volume = Number(e.target.value);
  setVolume(settings.volume);
  $("s-vol-v").textContent = `${Math.round(settings.volume * 100)}%`;
  saveSettings();
});
$("s-sens").addEventListener("input", (e) => {
  settings.sens = Number(e.target.value);
  $("s-sens-v").textContent = settings.sens.toFixed(1);
  saveSettings();
});

// Nền menu: hiện Đêm 1 phía sau. Đường tắt kiểm thử: /?night=2 mở thẳng vào đêm 2 (bỏ qua menu).
prepare(1);
showOverlay("menu");
screen = "menu";
const quick = Number(new URLSearchParams(location.search).get("night"));
if ([1, 2, 3].includes(quick)) {
  prepare(quick);
  beginPlay();
}
frame();
