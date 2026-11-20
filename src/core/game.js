// Lõi game Đảo Đèn Lồng: logic thuần, không đồ họa, không API của Node/trình duyệt.
// Dùng chung cho chế độ headless và bản web.
import { TUNING as T, WORLD as W } from "./tuning.js";
import { mulberry32 } from "./rng.js";
import { validateScenario } from "./validate.js";

const TPS = W.tps;
const secToTicks = (s) => Math.round(s * TPS);
export const r3 = (x) => Math.round(x * 1000) / 1000;
const rv = (v) => v.map(r3);

// Khoảng cách theo mặt phẳng ngang XZ.
const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export const DEFAULT_INPUT = () => ({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
});

export function defaultLanternIds() {
  return Array.from({ length: T.lantern_count_night1 }, (_, i) => `L${i + 1}`);
}

export class Game {
  constructor({ seed = 0, scenario = {} } = {}) {
    validateScenario(scenario, defaultLanternIds());
    this.rng = mulberry32(seed);
    this.tick = 0;
    this.state = "playing";
    this.score = 0;
    this.prevBtn = { jump: false, interact: false, pulse: false };
    this.nextMoteId = 1;
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;

    const sp = scenario.player ?? {};
    this.player = {
      pos: sp.pos ? [...sp.pos] : [0, 0, 0],
      vy: 0,
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invuln: 0,
      pulseCd: 0,
    };

    // Đèn mặc định xếp vòng tròn, L1 ở (0,0,25).
    this.lanterns = defaultLanternIds().map((id, i) => {
      const a = (i * 72 * Math.PI) / 180;
      return {
        id,
        pos: [W.lantern_ring_radius * Math.sin(a), 0, W.lantern_ring_radius * Math.cos(a)],
        lit: false,
        deposited: 0,
      };
    });
    for (const sl of scenario.lanterns ?? []) {
      const l = this.lanterns.find((x) => x.id === sl.id);
      if (sl.pos) l.pos = [...sl.pos];
      if (sl.deposited !== undefined) l.deposited = sl.deposited;
      if (sl.lit !== undefined) {
        l.lit = sl.lit;
        if (sl.lit && sl.deposited === undefined) l.deposited = T.lantern_cost;
      } else if (l.deposited >= T.lantern_cost) {
        l.lit = true;
      }
    }

    // Đom đóm
    this.motes = [];
    if (scenario.motes) {
      for (const p of scenario.motes) this.addMote([...p]);
    } else if (this.randomMotes) {
      while (this.motes.length < W.mote_target) this.addMote(this.randomMotePos());
    }

    // Bóng Mực
    this.shades = [];
    if (scenario.shades) {
      scenario.shades.forEach((s, i) => {
        this.shades.push({ id: s.id ?? `S${i + 1}`, pos: [...s.pos], state: "chase", stun: 0 });
      });
    } else if (this.randomShades) {
      this.shades.push({ id: "S1", pos: this.edgePos(30), state: "chase", stun: 0 });
    }
    this.nextShadeNum = this.shades.length + 1;

    this.timeLeftTicks = secToTicks(scenario.time_left_s ?? T.night1_duration_s);
    this.events = [];
  }

  // ---------- tiện ích sinh ngẫu nhiên (dùng PRNG có seed) ----------
  randomMotePos() {
    for (;;) {
      const r = W.mote_spawn_radius * Math.sqrt(this.rng());
      const a = this.rng() * Math.PI * 2;
      const p = [r * Math.cos(a), 0, r * Math.sin(a)];
      if (Math.hypot(p[0], p[2]) >= 3) return p;
    }
  }
  edgePos(radius) {
    const a = this.rng() * Math.PI * 2;
    return [radius * Math.cos(a), W.shade_y, radius * Math.sin(a)];
  }
  addMote(pos) {
    this.motes.push({ id: `M${this.nextMoteId++}`, pos });
  }
  emit(name, data) {
    this.events.push({ type: "event", tick: this.tick, name, data });
  }

  // ---------- tiện ích hình học ----------
  clampIsland(pos) {
    const d = Math.hypot(pos[0], pos[2]);
    if (d > W.island_radius) {
      pos[0] *= W.island_radius / d;
      pos[2] *= W.island_radius / d;
    }
  }
  // Đẩy Bóng Mực ra khỏi vùng an toàn quanh mọi đèn.
  pushOutOfSafeZones(pos) {
    for (let pass = 0; pass < 2; pass++) {
      for (const l of this.lanterns) {
        const d = dist(pos, l.pos);
        if (d < T.safe_radius) {
          let dx = pos[0] - l.pos[0];
          let dz = pos[2] - l.pos[2];
          if (d === 0) {
            dx = 1;
            dz = 0;
          }
          const n = Math.hypot(dx, dz);
          pos[0] = l.pos[0] + (dx / n) * T.safe_radius;
          pos[2] = l.pos[2] + (dz / n) * T.safe_radius;
        }
      }
    }
  }

  // ---------- một bước mô phỏng (1/60 giây) ----------
  // input: trạng thái đầu vào đầy đủ của tick này. Trả về các event của bước.
  step(input) {
    this.events = [];
    if (this.state !== "playing") return this.events;
    this.tick++;
    this.timeLeftTicks--;
    const p = this.player;
    if (p.invuln > 0) p.invuln--;
    if (p.pulseCd > 0) p.pulseCd--;

    const edge = (k) => !!input[k] && !this.prevBtn[k];
    const jumpEdge = edge("jump");
    const interactEdge = edge("interact");
    const pulseEdge = edge("pulse");
    this.prevBtn = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse };

    // 1. Di chuyển (chuẩn hóa nếu dài hơn 1, xoay theo camera)
    let [mx, mz] = input.move;
    const len = Math.hypot(mx, mz);
    if (len > 1) {
      mx /= len;
      mz /= len;
    }
    const th = (input.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    p.pos[0] += (wx * T.player_speed) / TPS;
    p.pos[2] += (wz * T.player_speed) / TPS;
    this.clampIsland(p.pos);

    // 2. Nhảy (chỉ đổi độ cao Y)
    if (jumpEdge && p.pos[1] <= 0) p.vy = W.jump_speed;
    if (p.pos[1] > 0 || p.vy > 0) {
      p.vy -= W.gravity / TPS;
      p.pos[1] += p.vy / TPS;
      if (p.pos[1] <= 0) {
        p.pos[1] = 0;
        p.vy = 0;
      }
    }

    // 3. Nhặt đom đóm
    for (const m of [...this.motes]) {
      if (p.carried >= T.carry_capacity) break;
      if (dist(p.pos, m.pos) <= T.pickup_radius) {
        this.motes.splice(this.motes.indexOf(m), 1);
        p.carried++;
        this.score += T.score.per_mote;
        this.emit("mote_picked", { carried: p.carried });
      }
    }

    // 4. Nạp đèn
    if (interactEdge && p.carried > 0) {
      let best = null;
      let bestD = Infinity;
      for (const l of this.lanterns) {
        if (l.lit) continue;
        const d = dist(p.pos, l.pos);
        if (d <= T.interact_radius && d < bestD) {
          best = l;
          bestD = d;
        }
      }
      if (best) {
        const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
        if (amount > 0) {
          p.carried -= amount;
          best.deposited += amount;
          this.emit("deposit", { lantern_id: best.id, amount, deposited: best.deposited });
          if (best.deposited >= T.lantern_cost) {
            best.lit = true;
            this.score += T.score.per_lantern;
            this.emit("lantern_lit", { lantern_id: best.id });
          }
        }
      }
    }

    // 5. Tỏa sáng
    if (pulseEdge && p.pulseCd === 0 && p.carried >= T.pulse_cost) {
      p.carried -= T.pulse_cost;
      p.pulseCd = secToTicks(T.pulse_cooldown_s);
      const hit = [];
      for (const s of this.shades) {
        if (dist(p.pos, s.pos) <= T.pulse_radius) {
          hit.push(s.id);
          s.state = "stunned";
          s.stun = secToTicks(T.pulse_stun_s);
          let dx = s.pos[0] - p.pos[0];
          let dz = s.pos[2] - p.pos[2];
          const n = Math.hypot(dx, dz);
          if (n === 0) {
            dx = 1;
            dz = 0;
          } else {
            dx /= n;
            dz /= n;
          }
          s.pos[0] += dx * T.pulse_push_m;
          s.pos[2] += dz * T.pulse_push_m;
          this.clampIsland(s.pos);
          this.pushOutOfSafeZones(s.pos);
          this.score += T.score.per_stun;
        }
      }
      this.emit("pulse", { stunned_ids: hit });
    }

    // 6. Bóng Mực: đuổi, bị choáng, chạm người chơi
    for (const s of this.shades) {
      if (s.state === "stunned") {
        s.stun--;
        if (s.stun <= 0) s.state = "chase";
      } else {
        const d = dist(s.pos, p.pos);
        if (d > 0) {
          const stepLen = Math.min(T.shade_speed / TPS, d);
          s.pos[0] += ((p.pos[0] - s.pos[0]) / d) * stepLen;
          s.pos[2] += ((p.pos[2] - s.pos[2]) / d) * stepLen;
          this.pushOutOfSafeZones(s.pos);
        }
      }
      if (s.state !== "stunned" && p.invuln === 0 && p.flames > 0 && dist(s.pos, p.pos) <= T.shade_hit_radius) {
        p.flames--;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped;
        for (let i = 0; i < dropped; i++) {
          const a = (i / dropped) * Math.PI * 2 + Math.PI / 2;
          const pos = [p.pos[0] + W.drop_ring_radius * Math.cos(a), 0, p.pos[2] + W.drop_ring_radius * Math.sin(a)];
          this.clampIsland(pos);
          this.addMote(pos);
        }
        p.invuln = secToTicks(T.invuln_s);
        this.emit("player_hit", { by: "shade", flames: p.flames, dropped });
      }
    }

    // 7. Sinh đom đóm và Bóng Mực ngẫu nhiên
    if (this.randomMotes && this.tick % W.mote_spawn_every_ticks === 0 && this.motes.length < W.mote_target) {
      this.addMote(this.randomMotePos());
    }
    if (this.randomShades && this.tick % W.shade_spawn_every_ticks === 0 && this.shades.length < W.shade_max) {
      let id;
      do {
        id = `S${this.nextShadeNum++}`;
      } while (this.shades.some((s) => s.id === id));
      this.shades.push({ id, pos: this.edgePos(W.shade_spawn_radius), state: "chase", stun: 0 });
      this.emit("shade_spawned", { id });
    }

    // 8. Kết thúc: thắng, hết lửa, hết giờ
    if (this.lanterns.every((l) => l.lit)) {
      this.state = "won";
      this.score += T.score.per_second_left * Math.floor(this.timeLeftTicks / TPS) + T.score.per_flame_left * p.flames;
      this.emit("game_over", { result: "won", reason: "all_lit" });
    } else if (p.flames <= 0) {
      this.state = "lost";
      this.emit("game_over", { result: "lost", reason: "no_flames" });
    } else if (this.timeLeftTicks <= 0) {
      this.state = "lost";
      this.emit("game_over", { result: "lost", reason: "dawn" });
    }
    return this.events;
  }

  snapshot() {
    return {
      type: "snapshot",
      tick: this.tick,
      sim_tick: this.tick,
      state: this.state,
      time_left_s: r3(this.timeLeftTicks / TPS),
      score: this.score,
      player: { pos: rv(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: rv(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: rv(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: rv(m.pos) })),
    };
  }
}
