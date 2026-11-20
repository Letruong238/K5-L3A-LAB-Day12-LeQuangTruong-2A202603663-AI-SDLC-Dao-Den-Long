// Phần hiển thị và luồng game (Three.js). Toàn bộ luật chơi nằm ở src/core/game.js; ở đây chỉ vẽ, đọc phím, HUD, âm thanh.
import * as THREE from "three";
import { Game, DEFAULT_INPUT } from "/src/core/game.js";
import { TUNING as T, WORLD as W } from "/src/core/tuning.js";
import { MAPS } from "/src/core/maps.js";
import { buildWorld, C } from "/web/scene.js";
import { sfx, unlock, setVolume } from "/web/audio.js";
import { ACTIONS, DEFAULT_KEYS, rebind, sanitizeKeys, keyLabel, normalizeKey } from "/web/keybinds.js";
import { validateName } from "/src/core/leaderboard.js";
import { BENCH, benchScenario, benchCamera, benchStats } from "/src/core/bench.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const BENCH_MODE = params.get("bench") === "1"; // cảnh benchmark chuẩn (scripts/bench.mjs mở trang này)
const OVERLAYS = ["menu", "intro", "result", "dawn", "pause", "settings", "leaderboard"];
const showOverlay = (id) => OVERLAYS.forEach((o) => $(o).classList.toggle("show", o === id));

// ---------- cài đặt (lưu giữa các lần mở game) ----------
let prefersReduced = false;
try {
  prefersReduced = matchMedia("(prefers-reduced-motion: reduce)").matches; // mặc định theo hệ điều hành
} catch {
  /* bỏ qua */
}
const settings = { volume: 0.6, sens: 1, colorblind: false, captions: true, reduceMotion: prefersReduced, big: false, keys: { ...DEFAULT_KEYS } };
try {
  Object.assign(settings, JSON.parse(localStorage.getItem("ddl.settings") || "{}"));
} catch {
  /* không có localStorage thì dùng mặc định */
}
settings.keys = sanitizeKeys(settings.keys);
function saveSettings() {
  try {
    localStorage.setItem("ddl.settings", JSON.stringify(settings));
  } catch {
    /* bỏ qua */
  }
}
setVolume(settings.volume);
if (params.get("cb") === "1") settings.colorblind = true; // đường tắt kiểm thử: /?cb=1
if (params.get("big") === "1") settings.big = true; // đường tắt kiểm thử: /?big=1
function applyUiSettings() {
  document.body.classList.toggle("cb", settings.colorblind);
  document.body.classList.toggle("rm", settings.reduceMotion);
  document.documentElement.classList.toggle("big", settings.big);
  $("captions").style.display = settings.captions ? "" : "none";
}
applyUiSettings();
const warn = (txt) => (settings.colorblind ? `⚠ ${txt}` : txt);

// ---------- cảnh ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(BENCH_MODE ? 1 : Math.min(devicePixelRatio, 2));
renderer.setSize(BENCH_MODE ? BENCH.window[0] : innerWidth, BENCH_MODE ? BENCH.window[1] : innerHeight);
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
scene.fog = new THREE.FogExp2(C.fog, 0.016);
const camera = new THREE.PerspectiveCamera(60, BENCH_MODE ? BENCH.window[0] / BENCH.window[1] : innerWidth / innerHeight, 0.1, 400);
if (!BENCH_MODE) {
  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  });
}
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
clouds.visible = !BENCH_MODE; // benchmark: tắt phần sáng tạo thêm để mọi bài đo trên cùng một cảnh chuẩn
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
// Vật liệu dùng chung cho mọi Bóng Mực (200 con trong benchmark không tạo 400 vật liệu riêng)
const shadeMat = { body: new THREE.MeshStandardMaterial({ color: C.shade, emissive: 0x000000, roughness: 0.9 }), stun: new THREE.MeshStandardMaterial({ color: C.shadeStun, roughness: 0.9 }) };
const rimMat = { normal: new THREE.MeshBasicMaterial({ color: C.shadeRim }), cb: new THREE.MeshBasicMaterial({ color: 0x00b3ff }), stun: new THREE.MeshBasicMaterial({ color: C.shadeStun }) };

// ---------- trạng thái ----------
let game = null;
let world = null;
let night = 1;
let totalScore = 0;
let nightsWon = 0; // số đêm đã thắng trong ván này (cho bảng xếp hạng)
let runSeed = (Date.now() & 0x7fffffff) >>> 0; // đêm n dùng seed runSeed + n - 1
let screen = "menu";
let acc = 0;
let camYaw = 0;
let settingsFrom = "menu";
let lastSecond = -1;
const keys = new Set(); // phím đang giữ (đã chuẩn hóa chữ thường)
const latch = { jump: false, interact: false, pulse: false, dash: false };
const pools = { motes: new Map(), shades: new Map(), drifters: new Map() };
let toastTimer = 0;
let shakeT = 0; // giây rung camera còn lại (tắt khi giảm chuyển động)
const alertShades = new Map(); // id Bóng Mực vừa xuất hiện -> giây còn hiện mũi tên chỉ hướng
const timedCaptions = new Map(); // khóa -> { text, left }
let pendingSave = null; // { score, nights_won, seed } của ván đang chờ lưu vào bảng xếp hạng

const INFO = {
  1: { name: "Đảo Bến", detail: "Hòn đảo tròn đầu tiên, năm ngọn đèn đang tắt. Giữ ít nhất 3 đèn sáng tới bình minh (240 s).", quote: "“Đi chậm thôi, cháu. Sương đen sợ ánh sáng, nhưng nó kiên nhẫn lắm.” (Ông Đăng)" },
  2: { name: "Đảo Cau", detail: "Hai đảo nối nhau bằng cầu tre không lan can, có bục nhảy và Gió Lạc hay cướp đom đóm. Giữ ít nhất 4 đèn sáng tới bình minh (270 s).", quote: "“Cầu tre hẹp lắm, nhìn đường mà đi. Gặp bùa đỏ thì cứ nhặt.” (Ông Đăng)" },
  3: { name: "Đảo Chuông", detail: "Ba tầng đảo, dốc, bục nhảy và tháp chuông. Cứ nửa phút lại có một cơn gió mạnh. Giữ ít nhất 5 đèn sáng tới bình minh (300 s).", quote: "“Tiếng chuông này lâu lắm rồi chưa ai nghe. Thắp hết đèn, Mây nhé.” (Ông Đăng)" },
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
function prepare(n, scenario = {}, extra = {}) {
  night = n;
  game = new Game({ seed: extra.seed ?? runSeed + n - 1, night: n, scenario, bench: extra.bench === true });
  if (world) world.dispose();
  clearPools();
  world = buildWorld(scene, game);
  acc = 0;
  lastSecond = -1;
  camYaw = 0;
  alertShades.clear();
  timedCaptions.clear();
  shakeT = 0;
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
  toast(`Đêm ${night}: giữ ít nhất ${need()} đèn sáng tới bình minh!`);
}

// ---------- tạm dừng ----------
const need = () => Math.ceil(T.win_ratio * game.lanterns.length); // số đèn tối thiểu phải còn sáng ở bình minh
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
let rebinding = null; // id hành động đang chờ phím mới (màn Cài đặt)
addEventListener("keydown", (e) => {
  if (BENCH_MODE) return;
  const k = normalizeKey(e.key);
  if (rebinding) {
    e.preventDefault();
    finishRebind(k);
    return;
  }
  if (e.target instanceof HTMLInputElement && e.target.type === "text") return; // đang gõ tên: không coi là phím chơi
  unlock();
  const kb = settings.keys;
  if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(k) && screen === "play") e.preventDefault();
  if (e.repeat) return;
  keys.add(k);
  if (k === "escape" || k === kb.pause) {
    if (screen === "play") pauseGame();
    else if (screen === "paused") resumeGame();
    return;
  }
  if (k === "enter" && screen === "intro") beginPlay();
  if (k === "f3") $("fps").style.display = $("fps").style.display === "block" ? "none" : "block";
  if (screen !== "play") return;
  if (k === kb.jump) {
    latch.jump = true;
    if (game.player.grounded) sfx.jump();
  }
  if (k === kb.interact) latch.interact = true;
  if (k === kb.pulse) latch.pulse = true;
  if (k === kb.dash) latch.dash = true;
});
addEventListener("keyup", (e) => keys.delete(normalizeKey(e.key)));
addEventListener("blur", () => keys.clear()); // mất tiêu điểm thì nhả hết phím, tránh Mây tự chạy
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
  const kb = settings.keys;
  // Camera nhìn theo +Z khi yaw = 0 nên phải/trái của màn hình là -X/+X.
  inp.move = [(keys.has(kb.left) ? 1 : 0) - (keys.has(kb.right) ? 1 : 0), (keys.has(kb.up) ? 1 : 0) - (keys.has(kb.down) ? 1 : 0)];
  inp.cam_yaw_deg = (camYaw * 180) / Math.PI;
  inp.jump = keys.has(kb.jump) || latch.jump;
  inp.interact = keys.has(kb.interact) || latch.interact;
  inp.pulse = keys.has(kb.pulse) || latch.pulse;
  inp.dash = keys.has(kb.dash) || latch.dash;
  return inp;
}

// ---------- sự kiện game -> âm thanh/hiệu ứng ----------
function onEvent(ev) {
  switch (ev.name) {
    case "mote_picked": sfx.mote(); break;
    case "deposit": sfx.deposit(); break;
    case "lantern_lit": sfx.lit(); toast(ev.data.relight ? "Đèn được thắp lại!" : "Một ngọn đèn đã sáng!"); break;
    case "refuel": sfx.deposit(); break;
    case "lantern_out": sfx.lose(); toast(warn("Một ngọn đèn đã tắt!")); break;
    case "fuel_drain": toast(warn("Bóng Mực đang hút dầu của đèn!")); break;
    case "pulse":
      sfx.pulse();
      ringT = 0;
      ring.position.set(game.player.pos[0], game.player.pos[1] + 0.06, game.player.pos[2]);
      break;
    case "player_hit":
      sfx.hit();
      toast(warn(ev.data.by === "fall" ? "Mây rơi khỏi đảo!" : "Bóng Mực chạm vào Mây!"));
      if (!settings.reduceMotion) {
        shakeT = 0.35; // rung camera và chớp đỏ toàn màn hình; tắt hẳn khi bật "Giảm chuyển động"
        $("flash").style.opacity = 0.35;
        setTimeout(() => ($("flash").style.opacity = 0), 120);
      }
      break;
    case "dash": sfx.dash(); break;
    case "charm_picked": sfx.charm(); toast("Bùa Gió! Chạy nhanh và lướt không cần chờ."); break;
    case "drifter_steal": sfx.steal(); toast("Gió Lạc cướp đom đóm của Mây!"); break;
    case "drifter_drop": toast("Gió Lạc làm rơi đom đóm!"); break;
    case "shade_spawned":
      sfx.spawn();
      alertShades.set(ev.data.id, 4); // phụ đề + mũi tên ở mép màn hình trong 4 giây
      timedCaptions.set("shade", { text: "⚠ Bóng Mực xuất hiện!", left: 4 });
      break;
    case "game_over": finish(ev.data); break;
    default: break;
  }
}

// ---------- bảng xếp hạng ----------
async function fetchLeaderboard() {
  try {
    const r = await fetch("/api/leaderboard", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()).entries;
  } catch {
    try {
      return JSON.parse(localStorage.getItem("ddl.leaderboard") || "[]"); // không có server thì dùng bản lưu trong trình duyệt
    } catch {
      return [];
    }
  }
}
async function postScore(data) {
  // fetch ném TypeError khi không gọi được server; server từ chối dữ liệu thì ném Error kèm lý do.
  const r = await fetch("/api/leaderboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || `Lỗi ${r.status}`);
  return body;
}
async function showLeaderboard(from) {
  lbFrom = from;
  $("lb-body").textContent = "Đang tải...";
  showOverlay("leaderboard");
  const list = await fetchLeaderboard();
  if (!list.length) {
    $("lb-body").innerHTML = "<p>Chưa có ai trong bảng. Hãy là người đầu tiên!</p>";
    return;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const date = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" });
  };
  $("lb-body").innerHTML = `<table class="lb"><tr><th class="n">#</th><th>Tên</th><th class="n">Điểm</th><th class="n">Đêm thắng</th><th>Thời điểm</th></tr>${list
    .map((e, i) => `<tr><td class="n">${i + 1}</td><td>${esc(e.name)}</td><td class="n">${e.score}</td><td class="n">${e.nights_won}/3</td><td>${esc(date(e.achieved_at))}</td></tr>`)
    .join("")}</table>`;
}
let lbFrom = "menu";

// Mở form nhập tên sau khi kết thúc ván (thắng Đêm 3 hoặc thua ở bất kỳ đêm nào).
function setSaveInputs(prefix, shown) {
  $(`${prefix}-name`).parentElement.style.display = shown ? "" : "none";
  $(`${prefix}-save`).querySelector("button").style.display = shown ? "" : "none";
}
function openSave(prefix) {
  pendingSave = { score: totalScore, nights_won: nightsWon, seed: runSeed };
  setSaveInputs(prefix, true);
  $(`${prefix}-name`).value = "";
  $(`${prefix}-msg`).textContent = "";
  $(`${prefix}-msg`).classList.remove("ok");
}
function bindSave(prefix) {
  $(`${prefix}-save`).addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $(`${prefix}-msg`);
    msg.classList.remove("ok");
    const v = validateName($(`${prefix}-name`).value.trim());
    if (!v.ok) {
      msg.textContent = v.reason;
      return;
    }
    if (!pendingSave) return;
    const data = { name: v.name, ...pendingSave };
    try {
      const r = await postScore(data);
      msg.textContent = r.rank ? `Đã lưu! Bạn đứng hạng ${r.rank}.` : "Đã lưu, nhưng chưa vào top 10.";
    } catch (err) {
      if (err instanceof TypeError) {
        // không gọi được server (ví dụ mở bản tĩnh): lưu tạm trong trình duyệt
        try {
          const list = JSON.parse(localStorage.getItem("ddl.leaderboard") || "[]");
          list.push({ ...data, achieved_at: new Date().toISOString() });
          list.sort((a, b) => b.score - a.score || Date.parse(a.achieved_at) - Date.parse(b.achieved_at));
          localStorage.setItem("ddl.leaderboard", JSON.stringify(list.slice(0, 10)));
          msg.textContent = "Không có server nên đã lưu trong trình duyệt này.";
        } catch {
          msg.textContent = "Không lưu được điểm.";
          return;
        }
      } else {
        msg.textContent = err.message;
        return;
      }
    }
    msg.classList.add("ok");
    setSaveInputs(prefix, false); // mỗi ván chỉ lưu một lần
    pendingSave = null;
  });
}

function finish(d) {
  const won = d.result === "won";
  (won ? sfx.win : sfx.lose)();
  setTimeout(() => {
    const litNow = game.lanterns.filter((l) => l.lit).length;
    $("res-title").textContent = won ? "Bình minh! Đảo vẫn sáng" : "Bóng tối đã nuốt hòn đảo";
    $("res-detail").textContent = won
      ? `Mây đã giữ ${litNow}/${game.lanterns.length} ngọn đèn sáng tới bình minh.`
      : d.reason === "dawn" ? `Trời sáng mà chỉ còn ${litNow}/${game.lanterns.length} đèn sáng (cần ít nhất ${need()}).` : "Mây đã hết ngọn lửa.";
    if (won) {
      totalScore += game.score;
      nightsWon++;
    }
    $("res-score").textContent = `Điểm đêm này: ${game.score}${won ? ` · Tổng: ${totalScore}` : ` · Tổng điểm các đêm đã thắng: ${totalScore}`}`;
    $("b-next").style.display = won && night < 3 ? "" : "none";
    if (won && night === 3) {
      $("dawn-score").textContent = `Tổng điểm: ${totalScore} (${nightsWon}/3 đêm thắng)`;
      openSave("dawn");
      showOverlay("dawn");
      screen = "dawn";
    } else {
      // thua ở bất kỳ đêm nào thì cho nhập tên lưu điểm; thắng đêm 1, 2 thì chưa
      $("res-save").style.display = won ? "none" : "";
      if (!won) openSave("res");
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
  shakeT = Math.max(0, shakeT - dt);
  syncScene(t);
  updateCaptions(dt);
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
    const fuel = l.fuelU / W.fuel_units;
    const low = l.lit && fuel < T.low_fuel_threshold;
    const blinkOn = !low || Math.floor(t * 2) % 2 === 0; // fuel < 30: nhấp nháy chậm 1 Hz
    v.lit = l.lit;
    v.lampMat.color.setHex(l.lit ? C.lampCore : C.lampOff);
    v.lampMat.emissive.setHex(l.lit ? C.lampOn : 0x000000);
    v.lampMat.emissiveIntensity = l.lit ? 0.4 + 0.6 * Math.min(1, fuel / 100) : 1;
    v.light.intensity = l.lit && blinkOn ? 60 + 200 * Math.min(1, fuel / 100) : 0;
    v.lamp.visible = blinkOn;
    v.lamp.scale.y = l.lit ? 1 : 0.8; // đèn tắt bị xẹp 20%
    v.lamp.position.y = l.lit ? 2.95 : 2.95 - 0.115;
    v.tear.forEach((m) => (m.visible = !l.lit)); // đèn tắt có vết rách trên giấy
    v.zone.visible = l.lit && fuel >= T.low_fuel_threshold; // chỉ đèn fuel >= 30 có vùng an toàn
    v.bar.visible = l.lit && blinkOn;
    v.barFill.scale.x = Math.max(0.001, fuel / 100);
    v.barFill.position.x = -0.62 * (1 - fuel / 100);
    v.barFill.material.color.setHex(low ? (settings.colorblind ? 0xffffff : 0xff5a5f) : C.lampOn);
    v.bar.lookAt(camera.position);
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
      const body = new THREE.Mesh(shadeGeo, shadeMat.body);
      const rim = new THREE.Mesh(rimGeo, rimMat.normal);
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
    v.body.material = stunned ? shadeMat.stun : shadeMat.body;
    v.rim.material = stunned ? rimMat.stun : settings.colorblind ? rimMat.cb : rimMat.normal;
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
  if (shakeT > 0 && !settings.reduceMotion) {
    const a = 0.35 * (shakeT / 0.35); // rung nhẹ, giảm dần
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
  }

  updateHud(p, lit);
}

// ---------- phụ đề và chỉ báo hình ảnh ----------
// Điều kiện liên tục (gió, 10 giây cuối, đèn sắp cạn) tính lại mỗi khung; sự kiện một lần (Bóng Mực xuất hiện) có thời hạn.
function updateCaptions(dt) {
  const box = $("captions");
  if (!settings.captions || screen !== "play") {
    box.textContent = "";
    $("shade-arrows").textContent = "";
    return;
  }
  const lines = [];
  for (const [k, c] of timedCaptions) {
    c.left -= dt;
    if (c.left <= 0) timedCaptions.delete(k);
    else lines.push({ text: c.text });
  }
  const w = game.wind;
  if (w.active) lines.push({ text: "⚠ Gió đang thổi mạnh, Mây bị đẩy đi!" });
  else if (w.pendingDir !== null) lines.push({ text: "⚠ Gió mạnh sắp thổi!" });
  const secs = Math.max(0, Math.ceil(game.timeLeftTicks / W.tps));
  if (secs > 0 && secs <= 10) lines.push({ text: `⚠ Còn ${secs} giây tới bình minh!` });
  for (const l of game.lanterns) {
    if (l.lit && l.fuelU < T.low_fuel_threshold * W.fuel_units) lines.push({ text: `⚠ Đèn ${l.id} sắp cạn dầu (${Math.ceil(l.fuelU / W.fuel_units)})`, info: true });
  }
  const key = lines.map((l) => l.text).join("|");
  if (box.dataset.key !== key) {
    box.dataset.key = key;
    box.replaceChildren(
      ...lines.slice(0, 5).map((l) => {
        const d = document.createElement("div");
        d.textContent = l.text;
        if (l.info) d.className = "info";
        return d;
      })
    );
  }
  // Mũi tên ở mép màn hình chỉ hướng Bóng Mực vừa xuất hiện
  const holder = $("shade-arrows");
  const live = [...alertShades.keys()].filter((id) => game.shades.some((s) => s.id === id));
  for (const id of [...alertShades.keys()]) {
    const left = alertShades.get(id) - dt;
    if (left <= 0 || !live.includes(id)) alertShades.delete(id);
    else alertShades.set(id, left);
  }
  while (holder.children.length < alertShades.size) {
    const a = document.createElement("div");
    a.className = "earrow";
    holder.appendChild(a);
  }
  [...holder.children].forEach((el, i) => {
    const id = [...alertShades.keys()][i];
    const s = id ? game.shades.find((x) => x.id === id) : null;
    if (!s) {
      el.style.display = "none";
      return;
    }
    tmpV.set(s.pos[0], s.pos[1] + 1, s.pos[2]).project(camera);
    let x = tmpV.x;
    let y = tmpV.y;
    const onScreen = tmpV.z <= 1 && Math.abs(x) <= 0.95 && Math.abs(y) <= 0.95;
    if (onScreen) {
      el.style.display = "none";
      return;
    }
    if (tmpV.z > 1) {
      x = -x;
      y = -y;
    }
    const m = Math.max(Math.abs(x), Math.abs(y), 1e-6);
    x /= m;
    y /= m;
    el.style.display = "block";
    el.style.left = `${((x * 0.93 + 1) / 2) * innerWidth - 14}px`;
    el.style.top = `${((1 - y * 0.9) / 2) * innerHeight - 15}px`;
    el.style.transform = `rotate(${Math.atan2(x, y)}rad)`;
  });
}

function updateHud(p, lit) {
  const secs = Math.max(0, Math.ceil(game.timeLeftTicks / W.tps));
  $("flames").textContent = "🔥".repeat(p.flames) + "·".repeat(Math.max(0, T.flames - p.flames));
  $("timer").textContent = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
  $("timer").classList.toggle("low", secs <= 30);
  if (secs <= 30) $("timer").textContent = warn($("timer").textContent);
  $("stats").innerHTML = `Đèn sáng <b>${lit}/${game.lanterns.length}</b> (cần ≥ ${need()})<br>Điểm <b>${game.score}</b><br>Mang <b>${p.carried}/${game.capacity()}</b>`;
  const bar = $("motes");
  if (bar.children.length !== game.capacity()) bar.innerHTML = "<i></i>".repeat(game.capacity());
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
  const unlit = game.lanterns.filter((l) => !l.lit || l.fuelU < T.low_fuel_threshold * W.fuel_units); // đèn tắt hoặc sắp cạn
  const close = game.lanterns.find((l) => (!l.lit || l.fuelU < T.fuel_max * W.fuel_units) && Math.hypot(l.pos[0] - p.pos[0], l.pos[2] - p.pos[2]) <= T.interact_radius && Math.abs(l.pos[1] - p.pos[1]) <= W.vertical_tol);
  $("prompt").style.display = close && screen === "play" ? "block" : "none";
  $("prompt").textContent = `${keyLabel(settings.keys.interact)} — ${close && close.lit ? "Châm dầu" : "Nạp ánh sáng"} (${p.carried}/${game.capacity()})`;

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
click("b-play", () => { totalScore = 0; nightsWon = 0; runSeed = Math.floor(Math.random() * 0x7fffff0); prepare(1); });
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
click("b-settings-back", () => { cancelRebind(); showOverlay(settingsFrom); });
click("b-menu-lb", () => showLeaderboard("menu"));
click("b-res-lb", () => showLeaderboard("result"));
click("b-dawn-lb", () => showLeaderboard("dawn"));
click("b-lb-back", () => showOverlay(lbFrom));
bindSave("res");
bindSave("dawn");

// ---------- đổi phím ----------
const keysBox = $("keys");
function renderKeys() {
  keysBox.replaceChildren(
    ...ACTIONS.map((a) => {
      const lab = document.createElement("label");
      lab.append(`${a.label} `);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sec";
      b.id = `rk-${a.id}`;
      b.textContent = keyLabel(settings.keys[a.id]);
      b.setAttribute("aria-label", `${a.label}: phím ${keyLabel(settings.keys[a.id])}. Bấm để đổi`);
      b.addEventListener("click", () => startRebind(a.id));
      lab.append(b);
      return lab;
    })
  );
  refreshKeyLabels();
}
function refreshKeyLabels() {
  const k = settings.keys;
  const L = keyLabel;
  $("k-dash").textContent = L(k.dash);
  $("k-pulse").textContent = L(k.pulse);
  $("help").textContent = `${L(k.up)} ${L(k.left)} ${L(k.down)} ${L(k.right)} đi · ${L(k.jump)} nhảy · ${L(k.dash)} lướt · ${L(k.interact)} nạp/châm dầu · ${L(k.pulse)} tỏa sáng · kéo chuột hoặc ← → xoay · Esc/${L(k.pause)} tạm dừng`;
}
function startRebind(id) {
  cancelRebind();
  rebinding = id;
  const b = $(`rk-${id}`);
  b.classList.add("wait");
  b.textContent = "Nhấn phím...";
  $("key-msg").classList.remove("ok");
  $("key-msg").textContent = "";
}
function cancelRebind() {
  if (!rebinding) return;
  rebinding = null;
  renderKeys();
}
function finishRebind(k) {
  const id = rebinding;
  if (k === "escape") return cancelRebind(); // Esc: hủy, giữ phím cũ
  const r = rebind(settings.keys, id, k);
  rebinding = null;
  if (r.ok) {
    settings.keys = r.keys;
    saveSettings();
    renderKeys();
    $("key-msg").classList.add("ok");
    $("key-msg").textContent = `Đã đổi: ${ACTIONS.find((a) => a.id === id).label} = ${keyLabel(k)}`;
  } else {
    renderKeys();
    $("key-msg").classList.remove("ok");
    $("key-msg").textContent = `⚠ ${r.message}`; // báo trùng phím hoặc phím bị cấm; giữ nguyên phím cũ
  }
}
click("b-keys-reset", () => {
  cancelRebind();
  settings.keys = { ...DEFAULT_KEYS };
  saveSettings();
  renderKeys();
  $("key-msg").classList.add("ok");
  $("key-msg").textContent = "Đã khôi phục phím mặc định";
});

function openSettings(from) {
  settingsFrom = from;
  $("s-vol").value = settings.volume;
  $("s-sens").value = settings.sens;
  $("s-vol-v").textContent = `${Math.round(settings.volume * 100)}%`;
  $("s-sens-v").textContent = settings.sens.toFixed(1);
  $("s-cb").checked = settings.colorblind;
  $("s-cap").checked = settings.captions;
  $("s-rm").checked = settings.reduceMotion;
  $("s-big").checked = settings.big;
  $("key-msg").textContent = "";
  renderKeys();
  showOverlay("settings");
}
for (const [id, field] of [["s-cap", "captions"], ["s-rm", "reduceMotion"], ["s-big", "big"]]) {
  $(id).addEventListener("change", (e) => {
    settings[field] = e.target.checked;
    applyUiSettings();
    saveSettings();
  });
}
$("s-vol").addEventListener("input", (e) => {
  settings.volume = Number(e.target.value);
  setVolume(settings.volume);
  $("s-vol-v").textContent = `${Math.round(settings.volume * 100)}%`;
  saveSettings();
});
$("s-cb").addEventListener("change", (e) => {
  settings.colorblind = e.target.checked;
  applyUiSettings();
  saveSettings();
});
$("s-sens").addEventListener("input", (e) => {
  settings.sens = Number(e.target.value);
  $("s-sens-v").textContent = settings.sens.toFixed(1);
  saveSettings();
});

// ---------- benchmark (Ticket-04, mục 1) ----------
// Mở bằng /?bench=1&seed=42&duration=30 (scripts/bench.mjs làm việc này). Cảnh chuẩn: 200 Bóng Mực wander, 100 đom đóm, L1 đến L3 sáng,
// Mây đứng yên (0,0,0), camera bay vòng bán kính 30 m, cao 15 m, 15 s một vòng. 3 s đầu khởi động, rồi đo đúng `duration` giây.
function startBench() {
  const seed = Number(params.get("seed") ?? BENCH.seed);
  const duration = Number(params.get("duration") ?? 30);
  prepare(1, benchScenario(seed), { seed, bench: true });
  showOverlay(null);
  screen = "bench";
  document.title = "bench-running";
  const dts = [];
  let t0 = null; // mốc thời gian của khung hình đầu tiên (ms, theo đồng hồ rAF)
  let firstEpoch = null;
  let last = null;
  let simAcc = 0;
  const idle = DEFAULT_INPUT();
  let lastRaf = performance.now();
  // Nhịp tim độc lập với vòng vẽ: phân biệt "trang treo hẳn" với "chỉ ngừng vẽ" khi cửa sổ dừng giữa chừng
  setInterval(() => report({ heartbeat: true, since_last_raf_ms: Math.round(performance.now() - lastRaf), visibility: document.visibilityState, hasFocus: document.hasFocus() }), 1000);
  const report = (o) => fetch("/api/bench-result", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }).catch(() => {});
  function loop(now) {
    try {
      step(now);
    } catch (e) {
      document.title = "bench-error";
      report({ error: String(e && e.stack ? e.stack : e) }); // lỗi giữa chừng thì báo về script thay vì im lặng dừng
    }
  }
  function step(now) {
    lastRaf = performance.now();
    if (t0 === null) {
      t0 = now;
      firstEpoch = Date.now();
    }
    const dtMs = last === null ? 0 : now - last;
    last = now;
    const elapsed = (now - t0) / 1000;
    simAcc += Math.min(dtMs / 1000, 0.1);
    while (simAcc >= 1 / W.tps) {
      game.step(idle); // chế độ bench của lõi: Bóng Mực wander, mọi thứ khác đứng yên
      simAcc -= 1 / W.tps;
    }
    syncScene(elapsed);
    const c = benchCamera(elapsed);
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    camera.lookAt(c.look[0], c.look[1], c.look[2]);
    renderer.render(scene, camera);
    if (elapsed >= BENCH.warmup_s && dtMs > 0) dts.push(dtMs);
    if (Math.floor(elapsed / 2) !== Math.floor((elapsed - dtMs / 1000) / 2)) report({ progress: Math.round(elapsed * 10) / 10, frames: dts.length, visibility: document.visibilityState }); // tín hiệu còn sống
    if (elapsed < BENCH.warmup_s + duration) {
      requestAnimationFrame(loop);
      return;
    }
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const result = {
      ...benchStats(dts),
      first_frame_epoch_ms: firstEpoch,
      renderer: `three.js r${THREE.REVISION} (WebGL) / ${gpu} / ${navigator.userAgent}`,
    };
    window.__benchResult = result;
    document.title = "bench-done";
    report(result);
  }
  requestAnimationFrame(loop);
}

// Nền menu: hiện Đêm 1 phía sau. Đường tắt kiểm thử: /?night=2 mở thẳng vào đêm 2 (bỏ qua menu).
if (BENCH_MODE) {
  startBench();
} else {
  prepare(1);
  showOverlay("menu");
  screen = "menu";
  renderKeys();
  const quick = Number(params.get("night"));
  if ([1, 2, 3].includes(quick)) {
    // ?night=1&demo=1: dựng sẵn đèn sáng với lượng dầu khác nhau và một Bóng Mực đang hút dầu (để chụp ảnh kiểm tra)
    const demo = params.get("demo") === "1";
    prepare(quick, demo ? {
      random_shades: false,
      lanterns: [{ id: "L1", pos: [0, 0, 8], lit: true, fuel: 20 }, { id: "L2", pos: [8, 0, 8], lit: true, fuel: 60 }, { id: "L3", pos: [-8, 0, 8], lit: true, fuel: 100 }, { id: "L4", pos: [8, 0, 16], ever_lit: true }],
      shades: [{ pos: [0.5, 1, 9], state: "drain", target_lantern_id: "L1" }],
      player: { carried: 6 },
    } : {});
    beginPlay();
    if (params.get("settings") === "1") openSettings("menu"); // đường tắt kiểm thử: chụp ảnh màn Cài đặt
    if (params.get("lb") === "1") showLeaderboard("menu"); // đường tắt kiểm thử: chụp ảnh Bảng xếp hạng
  }
  frame();
}
