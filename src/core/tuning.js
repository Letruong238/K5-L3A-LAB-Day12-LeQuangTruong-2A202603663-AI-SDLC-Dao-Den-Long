// Các con số cân bằng game. Phải khớp với "tuning" trong game.contract.json
// (có test tests/contract.test.js kiểm tra).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1,
  interact_radius: 2,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 3,
  pulse_push_m: 4,
  pulse_cooldown_s: 2,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: {
    per_mote: 10,
    per_lantern: 100,
    per_stun: 20,
    per_second_left: 1,
    per_flame_left: 50,
  },
};

// Hằng số thế giới (không nằm trong contract).
export const WORLD = {
  tps: 60,
  island_radius: 40,
  lantern_ring_radius: 25,
  jump_speed: 6,
  gravity: 18,
  drop_ring_radius: 2.5,
  mote_target: 20,
  mote_spawn_every_ticks: 120,
  mote_spawn_radius: 36,
  shade_spawn_every_ticks: 900,
  shade_max: 5,
  shade_spawn_radius: 38,
  shade_y: 1,
};
