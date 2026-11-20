// Bản đồ chuẩn của 3 Đêm (Ticket-02, Phần 2). Góc đo từ +X ngược chiều kim đồng hồ: x = cx + r·cos, z = cz + r·sin.
const rad = (d) => (d * Math.PI) / 180;
const polar = (r, deg, cx = 0, y = 0, cz = 0) => [cx + r * Math.cos(rad(deg)), y, cz + r * Math.sin(rad(deg))];
const ring = (n, r, startDeg, stepDeg, cx = 0, y = 0, cz = 0) =>
  Array.from({ length: n }, (_, i) => polar(r, startDeg + i * stepDeg, cx, y, cz));
const pad = (pos, vy, h, dir) => {
  const n = Math.hypot(dir[0], dir[1]);
  return { pos, vy, hspeed: h, dir: [dir[0] / n, dir[1] / n] };
};

// ---- Đêm 1: Đảo Bến ----
const night1 = {
  night: 1,
  name: "Đảo Bến",
  duration_s: 300,
  start: [0, 0, 0],
  lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
  motePoints: [...ring(8, 12, 0, 45), ...ring(16, 33, 0, 22.5)],
  shadePoints: ring(12, 37, 15, 30),
  shade: { first: 300, firstCount: 2, interval: 480, max: 6, speed: 4 },
  charms: [],
  pads: [],
  drifters: false,
  wind: false,
  heightAt: (x, z) => (Math.hypot(x, z) <= 40 ? 0 : null),
};

// ---- Đêm 2: Đảo Cau (hai đảo nối cầu tre, hai bục nhảy) ----
const B_CENTER = [70, 0];
const night2 = {
  night: 2,
  name: "Đảo Cau",
  duration_s: 330,
  start: [0, 0, 0],
  lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
  motePoints: [
    ...ring(4, 10, 0, 90), ...ring(8, 22, 0, 45),
    ...ring(4, 10, 0, 90, 70), ...ring(8, 22, 0, 45, 70),
  ],
  shadePoints: [...ring(8, 26, 22.5, 45), ...ring(8, 26, 22.5, 45, 70)],
  shade: { first: 300, firstCount: 2, interval: 420, max: 8, speed: 4 },
  charms: [{ id: "C1", pos: [35, 0, 0] }],
  pads: [
    pad([20, 0, 18], 14, 24, [B_CENTER[0] - 20, B_CENTER[1] - 18]),
    pad([50, 0, -18], 14, 24, [0 - 50, 0 + 18]),
  ],
  drifters: true,
  wind: false,
  heightAt: (x, z) => {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28) return 0;
    if (x >= 26 && x <= 44 && Math.abs(z) <= 2) return 0; // cầu tre
    return null;
  },
};

// ---- Đêm 3: Đảo Chuông (3 tầng, dốc, bục nhảy, tháp chuông, gió) ----
const RAMP_ANGLES = [30, 150];
const night3 = {
  night: 3,
  name: "Đảo Chuông",
  duration_s: 360,
  start: [0, 0, -30],
  lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
  motePoints: [...ring(18, 34, 0, 20), ...ring(8, 18, 20, 20, 0, 3), ...ring(4, 5, 45, 90, 0, 6)],
  shadePoints: ring(16, 43, 0, 22.5),
  shade: { first: 300, firstCount: 2, interval: 360, max: 10, speed: 4.5 },
  charms: [{ id: "C1", pos: [30, 0, 25] }, { id: "C2", pos: [-30, 0, 25] }],
  pads: [pad([0, 3, 13], 12, 8, [0, -1])],
  drifters: true,
  wind: true,
  heightAt: (x, z) => {
    const r = Math.hypot(x, z);
    if (r < 2) return Infinity; // tháp chuông (vật cản đặc)
    for (const a of RAMP_ANGLES) {
      const ux = Math.cos(rad(a));
      const uz = Math.sin(rad(a));
      const p = x * ux + z * uz;
      const lateral = Math.abs(-x * uz + z * ux);
      if (p >= 24 && p <= 30 && lateral <= 1.5) return (3 * (30 - p)) / 6;
    }
    if (r <= 8) return 6;
    if (r >= 12 && r <= 24 && z > 0) return 3;
    if (r <= 45) return 0;
    return null;
  },
};

export const MAPS = { 1: night1, 2: night2, 3: night3 };
