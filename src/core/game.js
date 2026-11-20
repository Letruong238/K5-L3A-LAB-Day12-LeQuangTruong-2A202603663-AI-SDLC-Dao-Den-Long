// Lõi game Đảo Đèn Lồng (Contract v1.1): logic thuần, không đồ họa, không API của Node/trình duyệt.
// Dùng chung cho chế độ headless và bản web. Thứ tự xử lý trong một tick theo đúng ticket (12 bước).
import { TUNING as T, WORLD as W } from "./tuning.js";
import { MAPS } from "./maps.js";
import { mulberry32 } from "./rng.js";
import { validateScenario } from "./validate.js";

const TPS = W.tps;
const ticks = (s) => Math.round(s * TPS);
export const r3 = (x) => Math.round(x * 1000) / 1000;
const rv = (v) => v.map(r3);
const dist2 = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]); // khoảng cách ngang XZ
const idNum = (id) => parseInt(String(id).replace(/\D/g, ""), 10) || 0;
const byId = (a, b) => idNum(a.id) - idNum(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const FROZEN = ["spawning", "recoil", "stunned"];
const FU = W.fuel_units; // dầu tính bằng số nguyên đơn vị 1/60
const FUEL_MAX_U = T.fuel_max * FU;
const LOW_U = T.low_fuel_threshold * FU;
const DECAY_U = Math.round((T.fuel_decay_per_s * FU) / TPS); // hao mỗi tick
const DRAIN_U = Math.round((T.drain_per_s * FU) / TPS); // bị hút mỗi tick mỗi Bóng Mực
const r1 = (x) => Math.round(x * 10) / 10;

export const DEFAULT_INPUT = () => ({
  move: [0, 0],
  cam_yaw_deg: 0,
  jump: false,
  interact: false,
  pulse: false,
  dash: false,
  pause: false,
});

export const lanternIdsFor = (night) => MAPS[night].lanterns.map((_, i) => `L${i + 1}`);

export class Game {
  constructor({ seed = 0, night = 1, scenario = {} } = {}) {
    const map = MAPS[night];
    if (!map) throw new Error(`night không hợp lệ: ${night}`);
    validateScenario(scenario, lanternIdsFor(night));
    this.map = map;
    this.night = night;
    this.rng = mulberry32(seed);
    this.tick = 0; // đếm mọi bước (kể cả khi tạm dừng)
    this.simTick = 0; // chỉ đếm bước gameplay
    this.state = "playing";
    this.paused = false;
    this.score = 0;
    this.prev = { jump: false, interact: false, pulse: false, dash: false, pause: false };
    this.events = [];
    this.nextMote = 1;
    this.nextDrifter = 1;
    this.randomMotes = scenario.random_motes !== false;
    this.randomShades = scenario.random_shades !== false;
    this.randomDrifters = scenario.random_drifters ?? map.drifters;
    this.windEnabled = scenario.wind_enabled ?? map.wind;
    this.wind = { active: false, left: 0, dir: 0, pendingDir: null };

    const sp = scenario.player ?? {};
    const pos = sp.pos ? [...sp.pos] : [...map.start];
    const H0 = map.heightAt(pos[0], pos[2]);
    const solid = H0 !== null && H0 !== Infinity;
    const grounded = solid && pos[1] <= H0 + 1e-6;
    if (grounded) pos[1] = H0;
    this.player = {
      pos,
      vel: [0, 0, 0],
      vh: [0, 0],
      grounded,
      facing: [0, 1],
      flames: sp.flames ?? T.flames,
      carried: sp.carried ?? 0,
      invuln: sp.invuln_ticks ?? 0,
      dashCd: sp.dash_cd_ticks ?? 0,
      dashLeft: 0,
      dashDir: [0, 1],
      pulseCd: sp.pulse_cd_ticks ?? 0,
      charm: sp.charm_ticks ?? 0,
      launch: null,
      fallWait: 0,
    };

    this.lanterns = map.lanterns.map((pos, i) => ({ id: `L${i + 1}`, pos: [...pos], lit: false, deposited: 0, fuelU: 0, everLit: false, relit: 0 }));
    for (const sl of scenario.lanterns ?? []) {
      const l = this.lanterns.find((x) => x.id === sl.id);
      if (sl.pos) l.pos = [...sl.pos];
      if (sl.deposited !== undefined) l.deposited = sl.deposited;
      if (sl.lit !== undefined) l.lit = sl.lit;
      else if (sl.fuel !== undefined) l.lit = sl.fuel > 0;
      else if (l.deposited >= T.lantern_cost) l.lit = true;
      if (l.lit) {
        // đèn đặt lit: true mà không có fuel thì fuel = 100
        l.fuelU = sl.fuel !== undefined ? Math.round(sl.fuel * FU) : FUEL_MAX_U;
        l.everLit = true;
        if (sl.deposited === undefined) l.deposited = T.lantern_cost;
      }
      if (sl.ever_lit !== undefined) l.everLit = sl.ever_lit;
      if (sl.relit_count !== undefined) l.relit = sl.relit_count;
    }
    this.successfulLights = sp.successful_lights ?? 0; // đèn đặt sẵn bằng scenario không tính

    // Đom đóm: danh sách scenario thay thế mặc định; mặc định là 20 trong các điểm của đêm.
    this.motes = [];
    if (scenario.motes) {
      for (const p of scenario.motes) this.addMote([...p], "random", -1, null);
    } else if (this.randomMotes) {
      const idx = [...map.motePoints.keys()];
      for (let i = 0; i < W.mote_start; i++) {
        const j = i + Math.floor(this.rng() * (idx.length - i));
        [idx[i], idx[j]] = [idx[j], idx[i]];
        this.addMote([...map.motePoints[idx[i]]], "random", idx[i], null);
      }
    }

    this.charms = (scenario.charms ?? map.charms.map((c) => ({ ...c }))).map((c) => ({
      id: c.id,
      pos: [...c.pos],
      available: c.available ?? true,
      respawn: c.respawn_ticks ?? 0,
    }));

    this.shades = [];
    (scenario.shades ?? []).forEach((s, i) => {
      const d = dist2(s.pos, this.player.pos);
      const H = map.heightAt(s.pos[0], s.pos[2]);
      this.shades.push({
        id: s.id ?? `S${i + 1}`,
        pos: [...s.pos],
        gy: H === null || H === Infinity ? 0 : H,
        state: s.state ?? (d <= W.shade_detect ? "chase" : "wander"),
        left: s.state_ticks_left ?? 0,
        targetId: s.target_lantern_id ?? null,
        drainTicks: 0,
        pushLeft: 0,
        pushVec: [0, 0],
        zoneLeft: 0,
        wanderDir: this.rng() * Math.PI * 2,
        wanderLeft: 0,
      });
    });
    for (const s of this.shades) if (s.state === "drain" && !s.targetId) s.targetId = this.weakLanterns(s.pos)[0]?.id ?? null;
    this.nextShade = this.shades.length + 1;

    this.drifters = (scenario.drifters ?? []).map((d, i) => ({
      id: d.id ?? `D${i + 1}`,
      pos: [...d.pos],
      state: d.state ?? "idle",
      stolen: d.stolen ?? 0,
      fleeLeft: d.state === "flee" ? W.drifter_flee_ticks : 0,
      wanderDir: this.rng() * Math.PI * 2,
      wanderLeft: 0,
    }));
    this.nextDrifter = this.drifters.length + 1;

    this.timeLeftTicks = ticks(scenario.time_left_s ?? map.duration_s);
  }

  // ---------- tiện ích ----------
  emit(name, data) {
    this.events.push({ type: "event", tick: this.tick, name, data });
  }
  addMote(pos, kind, point, ttl) {
    this.motes.push({ id: `M${this.nextMote++}`, pos, kind, point, ttl, born: this.tick });
  }
  capacity() {
    return Math.min(T.capacity_max, T.carry_capacity + W.capacity_per_light * this.successfulLights);
  }
  // Chỉ đèn đang sáng và fuel >= 30 mới có vùng an toàn (đúng 30 vẫn còn).
  zoneLanterns() {
    return this.lanterns.filter((l) => l.lit && l.fuelU >= LOW_U);
  }
  // Đèn sáng có fuel < 30, gần pos nhất trước, hòa thì id nhỏ.
  weakLanterns(pos) {
    return this.lanterns.filter((l) => l.lit && l.fuelU < LOW_U).sort((a, b) => dist2(pos, a.pos) - dist2(pos, b.pos) || byId(a, b));
  }
  lanternById(id) {
    return this.lanterns.find((l) => l.id === id) ?? null;
  }
  insideZone(x, z) {
    return this.zoneLanterns().some((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) < T.safe_radius - 1e-6);
  }
  // Chiếu điểm ra khỏi vùng an toàn của đèn đã sáng (Bóng Mực bị chặn ở mép).
  projectOut(x, z) {
    for (let pass = 0; pass < 2; pass++) {
      for (const l of this.zoneLanterns()) {
        const d = Math.hypot(x - l.pos[0], z - l.pos[2]);
        if (d < T.safe_radius - 1e-6) {
          const [ux, uz] = d === 0 ? [1, 0] : [(x - l.pos[0]) / d, (z - l.pos[2]) / d];
          x = l.pos[0] + ux * T.safe_radius;
          z = l.pos[2] + uz * T.safe_radius;
        }
      }
    }
    return [x, z];
  }
  // Di chuyển Bóng Mực tới (nx, nz) nếu hợp lệ. project=true: bị chặn trượt ở mép vùng an toàn; false: đẩy lùi, gặp vùng thì dừng.
  shadeMove(s, nx, nz, project) {
    if (project) [nx, nz] = this.projectOut(nx, nz);
    else if (this.insideZone(nx, nz)) return false;
    const H = this.map.heightAt(nx, nz);
    if (H === null || H === Infinity || Math.abs(H - s.gy) > W.step_up) return false;
    s.pos = [nx, H + 1, nz];
    s.gy = H;
    return true;
  }
  awayFrom(from, to) {
    const dx = to[0] - from[0];
    const dz = to[2] - from[2];
    const n = Math.hypot(dx, dz);
    return n === 0 ? [1, 0] : [dx / n, dz / n]; // trùng vị trí thì theo +X
  }
  dropMotes(count, x, z, scatter) {
    const base = scatter ? this.rng() * Math.PI * 2 : 0;
    for (let i = 0; i < count; i++) {
      let px = x;
      let pz = z;
      if (scatter) {
        const a = base + (i / count) * Math.PI * 2;
        const r = W.drop_r_min + this.rng() * (W.drop_r_max - W.drop_r_min);
        px = x + r * Math.cos(a);
        pz = z + r * Math.sin(a);
      }
      let H = this.map.heightAt(px, pz);
      if (H === null || H === Infinity) {
        px = x;
        pz = z;
        H = this.map.heightAt(px, pz);
        if (H === null || H === Infinity) H = 0;
      }
      this.addMote([px, H, pz], "dropped", -1, W.drop_ttl_ticks);
    }
  }

  // ---------- một bước mô phỏng ----------
  // input: trạng thái đầu vào đầy đủ của tick này. Trả về các event của bước.
  step(input) {
    this.events = [];
    const edge = (k) => !!input[k] && !this.prev[k];
    const e = { jump: edge("jump"), interact: edge("interact"), pulse: edge("pulse"), dash: edge("dash"), pause: edge("pause") };
    this.prev = { jump: !!input.jump, interact: !!input.interact, pulse: !!input.pulse, dash: !!input.dash, pause: !!input.pause };
    if (this.state !== "playing") return this.events;
    this.tick++;

    // 1. Pause trước; vừa tạm dừng thì dừng bước ở đây.
    if (e.pause) {
      if (this.paused) {
        this.paused = false;
        this.emit("resumed", {});
      } else {
        this.paused = true;
        this.emit("paused", {});
        return this.events;
      }
    }
    if (this.paused) return this.events;
    this.simTick++;

    this.countdown(); // 2
    const waiting = this.movePlayer(input, e); // 3
    if (!waiting) {
      this.pickups(); // 4
      if (e.interact) this.interact(); // 5
    }
    this.updateZones(); // 6
    if (!waiting && e.pulse) this.pulse(); // 7
    this.moveEnemies(); // 8
    if (!waiting) this.contacts(); // 9
    this.spawns(); // 10
    this.checkEnd(); // 11
    return this.events;
  }

  // 2. Giảm các bộ đếm
  countdown() {
    const p = this.player;
    this.timeLeftTicks--;
    for (const k of ["dashCd", "pulseCd", "invuln", "charm"]) if (p[k] > 0) p[k]--;
    for (const s of this.shades) if (FROZEN.includes(s.state) && s.left > 0) s.left--;
    for (const d of this.drifters) if (d.fleeLeft > 0) d.fleeLeft--;
    this.motes = this.motes.filter((m) => {
      if (m.ttl === null) return true;
      m.ttl--;
      return m.ttl > 0;
    });
    for (const c of this.charms) {
      if (!c.available && c.respawn > 0 && --c.respawn === 0) c.available = true;
    }
    this.updateFuel();
    if (this.windEnabled) {
      const w = this.wind;
      const t = this.simTick;
      if (w.active && --w.left <= 0) w.active = false;
      if (t % W.wind_every === W.wind_every - W.wind_warn_ticks) w.pendingDir = Math.floor(this.rng() * 360);
      if (t % W.wind_every === 0) {
        w.active = true;
        w.left = W.wind_ticks;
        w.dir = w.pendingDir ?? Math.floor(this.rng() * 360);
        w.pendingDir = null;
      }
    }
  }

  // Bước 2 (bổ sung ở Ticket-03): trừ dầu (hao + bị hút), rồi đèn có fuel <= 0 tắt.
  updateFuel() {
    for (const l of this.lanterns) if (l.lit) l.fuelU -= DECAY_U;
    for (const s of this.shades) {
      if (s.state !== "drain") continue;
      const l = this.lanternById(s.targetId);
      if (!l || !l.lit || l.fuelU >= LOW_U || dist2(s.pos, l.pos) > W.drain_radius) continue;
      l.fuelU -= DRAIN_U;
      if (++s.drainTicks % W.drain_event_every === 0) {
        this.emit("fuel_drain", { lantern_id: l.id, shade_id: s.id, fuel: r1(Math.max(0, l.fuelU) / FU) });
      }
    }
    for (const l of this.lanterns) {
      if (l.lit && l.fuelU <= 0) {
        l.lit = false;
        l.fuelU = 0;
        l.deposited = 0;
        this.emit("lantern_out", { lantern_id: l.id });
      }
    }
  }

  respawn() {
    const p = this.player;
    p.pos = [...this.map.start];
    p.vel = [0, 0, 0];
    p.vh = [0, 0];
    p.grounded = true;
    p.launch = null;
    p.dashLeft = 0;
    p.facing = [0, 1];
    p.invuln = W.respawn_invuln_ticks;
  }

  // 3. Di chuyển Mây (nhảy, lướt, bục nhảy, gió), rồi kiểm tra rơi. Trả về true nếu đang chờ hồi sinh.
  movePlayer(input, e) {
    const p = this.player;
    const map = this.map;
    if (p.fallWait > 0) {
      if (--p.fallWait > 0) return true;
      this.respawn();
      return false;
    }
    let [mx, mz] = input.move;
    const len0 = Math.hypot(mx, mz);
    if (len0 > 1) {
      mx /= len0;
      mz /= len0;
    }
    const th = (input.cam_yaw_deg * Math.PI) / 180;
    const wx = mx * Math.cos(th) + mz * Math.sin(th);
    const wz = -mx * Math.sin(th) + mz * Math.cos(th);
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-9) p.facing = [wx / wl, wz / wl];
    const speed = p.charm > 0 ? W.charm_speed : T.player_speed;

    if (e.dash && p.dashLeft === 0 && (p.charm > 0 || p.dashCd === 0)) {
      p.dashLeft = ticks(T.dash_duration_s);
      p.dashDir = [...p.facing];
      if (p.charm === 0) p.dashCd = ticks(T.dash_cooldown_s);
      this.emit("dash", {});
    }
    if (e.jump && p.grounded) {
      p.vel[1] = W.jump_speed;
      p.grounded = false;
    }

    // vận tốc ngang
    const target = [wx * speed, wz * speed];
    const dashing = p.dashLeft > 0;
    let hx;
    let hz;
    if (dashing) {
      hx = p.dashDir[0] * T.dash_speed;
      hz = p.dashDir[1] * T.dash_speed;
      if (--p.dashLeft === 0) p.vh = [...target];
    } else if (p.launch) {
      [hx, hz] = p.launch;
    } else {
      const dx = target[0] - p.vh[0];
      const dz = target[1] - p.vh[1];
      const mag = Math.hypot(dx, dz);
      const maxd = speed / W.accel_ticks;
      p.vh = mag <= maxd ? [...target] : [p.vh[0] + (dx / mag) * maxd, p.vh[1] + (dz / mag) * maxd];
      [hx, hz] = p.vh;
    }
    let px = hx;
    let pz = hz;
    if (this.wind.active) {
      px += Math.cos((this.wind.dir * Math.PI) / 180) * W.wind_push;
      pz += Math.sin((this.wind.dir * Math.PI) / 180) * W.wind_push;
    }

    // vận tốc dọc (lướt: đóng băng, giữ nguyên độ cao)
    let y = p.pos[1];
    let ynew = y;
    if (!dashing && !p.grounded) {
      p.vel[1] -= W.gravity / TPS;
      ynew = y + p.vel[1] / TPS;
    }

    // di chuyển ngang theo từng trục để trượt dọc vách
    const yRef = p.grounded ? y : ynew;
    const tol = p.grounded ? W.step_up : 0.05;
    const ok = (nx, nz) => {
      const H = map.heightAt(nx, nz);
      return H === null || H <= yRef + tol;
    };
    let x = p.pos[0];
    let z = p.pos[2];
    if (ok(x + px / TPS, z)) x += px / TPS;
    if (ok(x, z + pz / TPS)) z += pz / TPS;

    // chạm đất / rời đất
    p.pos = [x, ynew, z];
    const Hc = map.heightAt(x, z);
    const solid = Hc !== null && Hc !== Infinity;
    if (p.grounded) {
      if (!solid || Hc < y - W.step_up) {
        p.grounded = false;
        p.vel[1] = 0;
        p.pos[1] = y;
      } else {
        p.pos[1] = Hc;
      }
    } else if (!dashing && p.vel[1] <= 0 && solid && ynew <= Hc + 1e-9) {
      p.pos[1] = Hc;
      p.vel[1] = 0;
      p.grounded = true;
      p.launch = null;
    }
    // bục nhảy
    if (p.grounded) {
      for (const pd of map.pads) {
        if (Math.hypot(p.pos[0] - pd.pos[0], p.pos[2] - pd.pos[2]) <= 1 && Math.abs(p.pos[1] - pd.pos[1]) <= 0.5) {
          p.vel[1] = pd.vy;
          p.grounded = false;
          p.launch = [pd.dir[0] * pd.hspeed, pd.dir[1] * pd.hspeed];
          break;
        }
      }
    }
    p.vel = [px, p.vel[1], pz];

    // rơi khỏi đảo: đúng 1 lần, bỏ qua bất tử
    if (p.pos[1] < W.fall_y) {
      p.flames--;
      const lost = p.carried;
      p.carried = 0;
      this.emit("player_hit", { by: "fall", flames: p.flames, dropped: 0, lost });
      p.vel = [0, 0, 0];
      p.vh = [0, 0];
      p.launch = null;
      p.dashLeft = 0;
      if (p.flames > 0) {
        p.fallWait = W.fall_wait_ticks;
        return true;
      }
    }
    return false;
  }

  // 4. Nhặt đom đóm và bùa
  pickups() {
    const p = this.player;
    for (const m of [...this.motes]) {
      if (p.carried >= this.capacity()) break;
      if (m.born >= this.tick) continue; // thực thể mới chỉ nhặt được từ tick sau
      if (dist2(p.pos, m.pos) <= T.pickup_radius && Math.abs(p.pos[1] - m.pos[1]) <= W.vertical_tol) {
        this.motes.splice(this.motes.indexOf(m), 1);
        p.carried++;
        this.emit("mote_picked", { carried: p.carried });
      }
    }
    for (const c of this.charms) {
      if (!c.available) continue;
      if (dist2(p.pos, c.pos) <= T.pickup_radius && Math.abs(p.pos[1] - c.pos[1]) <= W.vertical_tol) {
        c.available = false;
        c.respawn = W.charm_respawn_ticks;
        p.charm = W.charm_ticks;
        this.emit("charm_picked", { charm_id: c.id, charm_ticks: W.charm_ticks });
      }
    }
  }

  // 5. Tương tác với đèn "nhận được" (chưa sáng, hoặc sáng nhưng chưa đầy dầu) gần nhất, hòa thì id nhỏ
  interact() {
    const p = this.player;
    if (p.carried <= 0) return;
    const l = this.lanterns
      .filter((q) => (!q.lit || q.fuelU < FUEL_MAX_U) && dist2(p.pos, q.pos) <= T.interact_radius && Math.abs(p.pos[1] - q.pos[1]) <= W.vertical_tol)
      .sort((a, b) => dist2(p.pos, a.pos) - dist2(p.pos, b.pos) || byId(a, b))[0];
    if (!l) return;
    if (l.lit) {
      // châm dầu: used = min(mang, ceil((100 - fuel) / 10))
      const perMoteU = T.fuel_per_mote * FU;
      const used = Math.min(p.carried, Math.ceil((FUEL_MAX_U - l.fuelU) / perMoteU));
      l.fuelU = Math.min(FUEL_MAX_U, l.fuelU + used * perMoteU);
      p.carried -= used;
      this.score += used * T.score.per_mote;
      this.emit("refuel", { lantern_id: l.id, amount: used, fuel: r1(l.fuelU / FU) });
      return;
    }
    const cost = l.everLit ? T.relight_cost : T.lantern_cost;
    const amount = Math.min(p.carried, cost - l.deposited);
    if (amount <= 0) return;
    p.carried -= amount;
    l.deposited += amount;
    this.score += amount * T.score.per_mote;
    this.emit("deposit", { lantern_id: l.id, amount, deposited: l.deposited });
    if (l.deposited >= cost) {
      const relight = l.everLit;
      l.lit = true;
      l.fuelU = FUEL_MAX_U;
      l.everLit = true;
      if (relight) l.relit++;
      this.successfulLights++;
      this.score += relight ? W.relight_bonus : T.score.per_lantern;
      this.emit("lantern_lit", { lantern_id: l.id, relight });
    }
  }

  // 6. Vùng an toàn: Bóng Mực đang ở trong vùng của đèn sáng bị đẩy ra mép (tối đa 30 tick, không gây sát thương)
  updateZones() {
    const lit = this.zoneLanterns();
    const R = T.safe_radius;
    for (const s of this.shades) {
      if (s.zoneLeft === 0 && lit.some((l) => dist2(s.pos, l.pos) < R - 1e-6)) s.zoneLeft = W.zone_push_ticks;
      if (s.zoneLeft === 0) continue;
      const l = lit.filter((q) => dist2(s.pos, q.pos) < R - 1e-6).sort((a, b) => dist2(s.pos, a.pos) - dist2(s.pos, b.pos))[0];
      if (!l) {
        s.zoneLeft = 0;
        continue;
      }
      const d0 = dist2(s.pos, l.pos);
      const [ux, uz] = d0 === 0 ? [1, 0] : [(s.pos[0] - l.pos[0]) / d0, (s.pos[2] - l.pos[2]) / d0];
      s.zoneLeft--;
      const nd = s.zoneLeft === 0 ? R : Math.min(R, d0 + W.zone_push_per_tick);
      const nx = l.pos[0] + ux * nd;
      const nz = l.pos[2] + uz * nd;
      const H = this.map.heightAt(nx, nz);
      s.pos = [nx, H === null || H === Infinity ? s.pos[1] : H + 1, nz];
      if (H !== null && H !== Infinity) s.gy = H;
      if (nd >= R) s.zoneLeft = 0;
    }
  }

  // 7. Tỏa Sáng: mục tiêu chốt ngay tick kích hoạt
  pulse() {
    const p = this.player;
    if (p.pulseCd > 0 || p.carried < T.pulse_cost) return;
    p.carried -= T.pulse_cost;
    p.pulseCd = ticks(T.pulse_cooldown_s);
    const c = [p.pos[0], p.pos[1] + W.pulse_center_y, p.pos[2]];
    const d3 = (a) => Math.hypot(a[0] - c[0], a[1] - c[1], a[2] - c[2]);
    const ids = [];
    for (const s of this.shades) {
      if (d3(s.pos) > T.pulse_radius) continue;
      ids.push(s.id);
      this.score += T.score.per_stun + (s.state === "drain" ? W.drain_stun_bonus : 0);
      s.state = "stunned";
      s.left = ticks(T.pulse_stun_s);
      const [ux, uz] = this.awayFrom(p.pos, s.pos);
      s.pushVec = [(ux * T.pulse_push_m) / W.pulse_push_ticks, (uz * T.pulse_push_m) / W.pulse_push_ticks];
      s.pushLeft = W.pulse_push_ticks;
    }
    this.emit("pulse", { stunned_ids: ids });
    for (const d of this.drifters) {
      if (d.state === "idle" || d3(d.pos) > T.pulse_radius) continue;
      if (d.state === "chase") {
        d.state = "flee";
        d.fleeLeft = W.drifter_flee_ticks;
      } else if (d.stolen > 0) {
        const amount = d.stolen;
        d.stolen = 0;
        d.fleeLeft = Math.min(d.fleeLeft, W.drifter_drop_flee_ticks);
        this.dropMotes(amount, d.pos[0], d.pos[2], false);
        this.emit("drifter_drop", { drifter_id: d.id, amount });
      }
    }
  }

  // 8. Di chuyển Bóng Mực và Gió Lạc
  moveEnemies() {
    for (const s of this.shades) this.updateShade(s);
    this.updateDrifters();
  }

  updateShade(s) {
    const p = this.player;
    if (s.pushLeft > 0) {
      if (this.shadeMove(s, s.pos[0] + s.pushVec[0], s.pos[2] + s.pushVec[1], false)) s.pushLeft--;
      else s.pushLeft = 0; // gặp vật cản thì dừng
    }
    if (s.zoneLeft > 0) return;
    const d = dist2(s.pos, p.pos);
    if (FROZEN.includes(s.state)) {
      if (s.left <= 0) {
        if (s.state === "stunned") s.state = "wander"; // hết choáng thì về wander (Ticket-03)
        else s.state = d <= (s.state === "spawning" ? W.shade_detect : W.shade_lose) ? "chase" : "wander";
      }
      return;
    }
    if (s.state === "drain") {
      const l = this.lanternById(s.targetId);
      if (d <= W.drain_chase_radius) s.state = "chase"; // Mây vào trong 6 m
      else if (!l || !l.lit || l.fuelU >= LOW_U || dist2(s.pos, l.pos) > W.drain_radius) s.state = "wander";
      else return; // đứng yên hút dầu
    }
    if (s.state === "wander" && d <= W.shade_detect) s.state = "chase";
    else if (s.state === "chase" && d > W.shade_lose) s.state = "wander";
    if (s.state === "chase") {
      if (d <= 0) return;
      const step = Math.min(this.map.shade.speed / TPS, d);
      const nx = s.pos[0] + ((p.pos[0] - s.pos[0]) / d) * step;
      const nz = s.pos[2] + ((p.pos[2] - s.pos[2]) / d) * step;
      if (!this.shadeMove(s, nx, nz, true) && !this.shadeMove(s, nx, s.pos[2], true)) this.shadeMove(s, s.pos[0], nz, true);
    } else {
      const tgt = this.pickTarget(s);
      const sp = W.shade_wander_speed / TPS;
      if (tgt) {
        s.targetId = tgt.id;
        const dl = dist2(s.pos, tgt.pos);
        if (dl <= W.drain_radius) {
          if (tgt.lit) {
            s.state = "drain"; // tới đèn yếu: đứng yên và hút
            s.drainTicks = 0;
          }
          return; // tới đèn tắt thì đứng chờ
        }
        const step = Math.min(sp, dl);
        const nx = s.pos[0] + ((tgt.pos[0] - s.pos[0]) / dl) * step;
        const nz = s.pos[2] + ((tgt.pos[2] - s.pos[2]) / dl) * step;
        if (!this.shadeMove(s, nx, nz, true) && !this.shadeMove(s, nx, s.pos[2], true)) this.shadeMove(s, s.pos[0], nz, true);
        return;
      }
      s.targetId = null;
      if (--s.wanderLeft <= 0) {
        s.wanderDir = this.rng() * Math.PI * 2;
        s.wanderLeft = 120;
      }
      if (!this.shadeMove(s, s.pos[0] + Math.cos(s.wanderDir) * sp, s.pos[2] + Math.sin(s.wanderDir) * sp, true)) s.wanderLeft = 0;
    }
  }

  // Bóng Mực wander chọn đèn yếu (sáng, fuel < 30) gần nhất; không có thì đèn tắt gần nhất; không có thì null.
  pickTarget(s) {
    const keep = s.targetId ? this.lanternById(s.targetId) : null;
    if (keep && keep.lit && keep.fuelU < LOW_U) return keep; // giữ mục tiêu đèn yếu còn hợp lệ (cả mục tiêu đặt bằng scenario)
    const weak = this.weakLanterns(s.pos)[0];
    if (weak) return weak;
    return this.lanterns.filter((l) => !l.lit).sort((a, b) => dist2(s.pos, a.pos) - dist2(s.pos, b.pos) || byId(a, b))[0] ?? null;
  }

  updateDrifters() {
    const p = this.player;
    for (const d of [...this.drifters]) {
      const dd = dist2(d.pos, p.pos);
      const near = p.carried >= W.drifter_detect_carry && dd <= W.drifter_detect_dist;
      if (d.state === "idle" && near) d.state = "chase";
      else if (d.state === "chase" && !near) d.state = "idle";
      if (d.state === "flee" && d.fleeLeft <= 0) {
        this.drifters.splice(this.drifters.indexOf(d), 1); // biến mất cùng số đã cướp
        continue;
      }
      let ux;
      let uz;
      let sp = W.drifter_speed / TPS;
      if (d.state === "chase") {
        [ux, uz] = this.awayFrom(d.pos, p.pos);
        sp = Math.min(sp, dd);
      } else if (d.state === "flee") {
        [ux, uz] = this.awayFrom(p.pos, d.pos);
      } else {
        if (--d.wanderLeft <= 0) {
          d.wanderDir = this.rng() * Math.PI * 2;
          d.wanderLeft = 120;
        }
        ux = Math.cos(d.wanderDir);
        uz = Math.sin(d.wanderDir);
        sp = W.drifter_idle_speed / TPS;
      }
      d.pos[0] += ux * sp;
      d.pos[2] += uz * sp;
      const H = this.map.heightAt(d.pos[0], d.pos[2]);
      if (H !== null && H !== Infinity) d.pos[1] = H + 1.5;
    }
  }

  // 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit (theo id tăng dần)
  contacts() {
    const p = this.player;
    for (const d of this.drifters) {
      if (d.state !== "chase" || dist2(d.pos, p.pos) > W.drifter_steal_radius) continue;
      const amount = Math.min(W.drifter_steal_amount, p.carried);
      p.carried -= amount;
      d.stolen = amount;
      d.state = "flee";
      d.fleeLeft = W.drifter_flee_ticks;
      this.emit("drifter_steal", { drifter_id: d.id, amount, carried: p.carried });
    }
    for (const s of [...this.shades].sort(byId)) {
      if (FROZEN.includes(s.state) || s.zoneLeft > 0) continue;
      if (dist2(s.pos, p.pos) > T.shade_hit_radius || Math.abs(p.pos[1] - s.gy) > W.vertical_tol) continue;
      if (p.invuln > 0) continue; // bóng chạm lúc Mây bất tử không làm gì (và tối đa 1 hit mỗi tick)
      p.flames--;
      const dropped = Math.floor(p.carried * T.hit_drop_ratio);
      p.carried -= dropped;
      this.dropMotes(dropped, p.pos[0], p.pos[2], true);
      p.invuln = ticks(T.invuln_s);
      s.state = "recoil";
      s.left = W.recoil_ticks;
      const [ux, uz] = this.awayFrom(p.pos, s.pos);
      s.pushVec = [(ux * W.recoil_m) / W.recoil_ticks, (uz * W.recoil_m) / W.recoil_ticks];
      s.pushLeft = W.recoil_ticks;
      this.emit("player_hit", { by: "shade", flames: p.flames, dropped });
    }
  }

  // 10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch (thực thể mới chỉ tương tác được từ tick sau)
  spawns() {
    const t = this.simTick;
    const map = this.map;
    const p = this.player;
    if (this.randomMotes && t % W.mote_spawn_every === 0 && this.motes.length < W.mote_cap) {
      const used = new Set(this.motes.filter((m) => m.point >= 0).map((m) => m.point));
      const free = [...map.motePoints.keys()].filter((i) => !used.has(i));
      if (free.length) {
        const i = free[Math.floor(this.rng() * free.length)];
        this.addMote([...map.motePoints[i]], "random", i, null);
      }
    }
    if (this.randomShades) {
      const sc = map.shade;
      let n = 0;
      if (t === sc.first) n = sc.firstCount;
      else if (t > sc.first && (t - sc.first) % sc.interval === 0) n = 1;
      for (let i = 0; i < n; i++) {
        if (this.shades.length >= sc.max) break;
        const valid = map.shadePoints.filter(
          (pt) => dist2(pt, p.pos) >= W.shade_spawn_min_dist && !this.insideZone(pt[0], pt[2]) && !this.shades.some((s) => dist2(s.pos, pt) < 1)
        );
        if (!valid.length) continue; // hết điểm hợp lệ thì bỏ lượt
        const pt = valid[Math.floor(this.rng() * valid.length)];
        let id;
        do id = `S${this.nextShade++}`;
        while (this.shades.some((s) => s.id === id));
        const H = map.heightAt(pt[0], pt[2]);
        const gy = H === null || H === Infinity ? 0 : H;
        this.shades.push({
          id, pos: [pt[0], gy + 1, pt[2]], gy, state: "spawning", left: W.shade_spawning_ticks, targetId: null, drainTicks: 0,
          pushLeft: 0, pushVec: [0, 0], zoneLeft: 0, wanderDir: this.rng() * Math.PI * 2, wanderLeft: 0,
        });
        this.emit("shade_spawned", { id });
      }
    }
    if (this.randomDrifters && t % W.drifter_spawn_every === 0 && this.drifters.length < W.drifter_max) {
      const pt = map.shadePoints[Math.floor(this.rng() * map.shadePoints.length)];
      const H = map.heightAt(pt[0], pt[2]);
      this.drifters.push({
        id: `D${this.nextDrifter++}`, pos: [pt[0], (H === null || H === Infinity ? 0 : H) + 1.5, pt[2]],
        state: "idle", stolen: 0, fleeLeft: 0, wanderDir: this.rng() * Math.PI * 2, wanderLeft: 0,
      });
    }
  }

  // 11. Thắng/thua (Ticket-03): hết lửa luôn thua; hết giờ mà đủ đèn sáng thì thắng (bình minh); còn lại thua. Không thắng sớm.
  checkEnd() {
    const p = this.player;
    if (p.flames <= 0) {
      this.state = "lost";
      this.emit("game_over", { result: "lost", reason: "no_flames" });
    } else if (this.timeLeftTicks <= 0) {
      const litNow = this.lanterns.filter((l) => l.lit);
      if (litNow.length >= Math.ceil(T.win_ratio * this.lanterns.length)) {
        this.state = "won";
        for (const l of litNow) this.score += W.dawn_lantern_base + Math.floor(l.fuelU / FU);
        this.score += p.flames * T.score.per_flame_left;
        this.emit("game_over", { result: "won", reason: "dawn_survived" });
      } else {
        this.state = "lost";
        this.emit("game_over", { result: "lost", reason: "dawn" });
      }
    }
  }

  // 12. Snapshot
  snapshot() {
    const p = this.player;
    return {
      type: "snapshot",
      tick: this.tick,
      sim_tick: this.simTick,
      state: this.paused ? "paused" : this.state,
      night: this.night,
      time_left_s: r3(Math.max(0, this.timeLeftTicks) / TPS),
      score: this.score,
      wind: { active: this.wind.active, dir_deg: this.wind.active ? this.wind.dir : 0 },
      player: {
        pos: rv(p.pos),
        vel: rv(p.vel),
        flames: p.flames,
        carried: p.carried,
        capacity: this.capacity(),
        grounded: p.grounded,
        invuln: p.invuln,
        dash_cd_s: r3(p.dashCd / TPS),
        pulse_cd_s: r3(p.pulseCd / TPS),
        charm_s: r3(p.charm / TPS),
      },
      lanterns: this.lanterns.map((l) => ({
        id: l.id, pos: rv(l.pos), lit: l.lit, deposited: l.deposited,
        fuel: l.lit ? r1(l.fuelU / FU) : 0, ever_lit: l.everLit, relit_count: l.relit,
      })),
      shades: this.shades.map((s) => ({
        id: s.id, pos: rv(s.pos), state: s.state, state_ticks_left: FROZEN.includes(s.state) ? s.left : 0, target_lantern_id: s.targetId ?? null,
      })),
      drifters: this.drifters.map((d) => ({ id: d.id, pos: rv(d.pos), state: d.state, stolen: d.stolen })),
      charms: this.charms.map((c) => ({ id: c.id, available: c.available, respawn_s: r3(c.respawn / TPS) })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: rv(m.pos), kind: m.kind, ttl_s: m.ttl === null ? null : r3(m.ttl / TPS) })),
    };
  }
}
