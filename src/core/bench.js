// Cảnh benchmark chuẩn (Ticket-04, mục 1): dữ liệu thuần, dùng chung cho bản web và test.
// 200 Bóng Mực wander rải đều trên đảo Đêm 1 (seed 42), 100 đom đóm, L1 đến L3 sáng fuel 100, Mây đứng yên (0,0,0).
import { mulberry32 } from "./rng.js";

export const BENCH = {
  seed: 42,
  shades: 200,
  motes: 100,
  warmup_s: 3, // 3 giây đầu khởi động, không đo
  window: [1280, 720],
  camera: { radius: 30, height: 15, period_s: 15 },
  island_radius: 38, // đảo Đêm 1 bán kính 40; chừa mép 2 m
  zone_keep_out: 6.5, // không đặt Bóng Mực trong vùng an toàn của L1 đến L3 (6 m) để chúng ở đúng trạng thái wander
};

// Vị trí L1 đến L3 của Đêm 1 (khớp src/core/maps.js, có test đối chiếu).
const LIT = [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2]];

// Điểm ngẫu nhiên đều theo diện tích trong đĩa bán kính R, tránh xa các đèn sáng.
function diskPoint(rng, R, avoid) {
  for (let tries = 0; tries < 1000; tries++) {
    const r = R * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    if (avoid.every((l) => Math.hypot(x - l[0], z - l[2]) >= BENCH.zone_keep_out)) return [x, z];
  }
  throw new Error("không đặt được điểm ngẫu nhiên cho cảnh benchmark");
}

export function benchScenario(seed = BENCH.seed) {
  const rng = mulberry32(seed);
  const shades = Array.from({ length: BENCH.shades }, (_, i) => {
    const [x, z] = diskPoint(rng, BENCH.island_radius, LIT);
    return { id: `S${i + 1}`, pos: [x, 1, z], state: "wander" };
  });
  const motes = Array.from({ length: BENCH.motes }, () => {
    const [x, z] = diskPoint(rng, BENCH.island_radius, []);
    return [x, 0, z];
  });
  return {
    random_motes: false,
    random_shades: false,
    random_drifters: false,
    wind_enabled: false,
    motes,
    shades,
    lanterns: ["L1", "L2", "L3"].map((id) => ({ id, lit: true, fuel: 100 })),
    player: { pos: [0, 0, 0] },
  };
}

// Camera bay vòng: tâm (0,0,0), bán kính 30 m, cao Y = 15 m, luôn nhìn (0,0,0), xuất phát (30,15,0),
// quay ngược chiều kim đồng hồ khi nhìn từ trên xuống (từ +X sang -Z trong hệ tay phải của Three.js), 15 s một vòng.
export function benchCamera(tSeconds) {
  const a = (2 * Math.PI * tSeconds) / BENCH.camera.period_s;
  return { pos: [BENCH.camera.radius * Math.cos(a), BENCH.camera.height, -BENCH.camera.radius * Math.sin(a)], look: [0, 0, 0] };
}

// ---- Thống kê khung hình theo định nghĩa của ticket ----
// dtMs: mảng thời gian từng khung hình (ms) trong khoảng đo.
export function benchStats(dtMs) {
  const n = dtMs.length;
  if (n === 0) throw new Error("không có khung hình nào trong khoảng đo");
  const sum = dtMs.reduce((a, b) => a + b, 0);
  const desc = [...dtMs].sort((a, b) => b - a);
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worstMean = desc.slice(0, k).reduce((a, b) => a + b, 0) / k;
  // Phân vị 95 theo cách xếp hạng gần nhất (nearest-rank): phần tử thứ ceil(0.95 × N) của dãy tăng dần.
  const asc = [...dtMs].sort((a, b) => a - b);
  const p95 = asc[Math.max(0, Math.ceil(0.95 * n) - 1)];
  const round1 = (x) => Math.round(x * 10) / 10;
  return { frames: n, avg_fps: round1((1000 * n) / sum), p1_low_fps: round1(1000 / worstMean), frame_ms_p95: round1(p95) };
}
