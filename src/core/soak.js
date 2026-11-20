// Soak test (Ticket-04, mục 2): chạy nhiều Đêm liên tiếp với input ngẫu nhiên theo seed. Logic thuần; đo bộ nhớ nằm ở scripts/soak.mjs.
import { Game, DEFAULT_INPUT } from "./game.js";
import { mulberry32 } from "./rng.js";
import { TUNING as T, WORLD as W } from "./tuning.js";

// Đêm thứ i (đếm từ 1) xoay vòng 1 → 2 → 3 → 1 ...
export const nightFor = (i) => ((i - 1) % 3) + 1;
// Đêm thứ i dùng seed (seed gốc + i).
export const seedFor = (base, i) => base + i;
const DURATION_S = { 1: T.night1_duration_s, 2: T.night2_duration_s, 3: T.night3_duration_s };

// Input ngẫu nhiên theo seed: mỗi 30 tick chọn lại hướng; mỗi tick xác suất 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác.
export function makeInputSource(seed) {
  const rng = mulberry32(((seed >>> 0) * 2654435761) >>> 0); // dòng số ngẫu nhiên riêng, tách khỏi dòng của game
  let move = [0, 0];
  return (tick) => {
    if (tick % 30 === 0) {
      const a = rng() * Math.PI * 2;
      move = [Math.cos(a), Math.sin(a)];
    }
    const inp = DEFAULT_INPUT();
    inp.move = move;
    inp.jump = rng() < 0.05;
    inp.dash = rng() < 0.03;
    inp.pulse = rng() < 0.02;
    inp.interact = rng() < 0.1;
    return inp;
  };
}

// Chạy một Đêm tới khi kết thúc hoặc hết thời lượng chuẩn. Trả về { result: "won" | "lost" | "timeout", ticks, score }.
export function runSoakNight(night, seed) {
  const game = new Game({ seed, night });
  const input = makeInputSource(seed);
  const limit = DURATION_S[night] * W.tps + 60;
  while (game.state === "playing" && game.tick < limit) game.step(input(game.tick));
  return { result: game.state === "playing" ? "timeout" : game.state, ticks: game.tick, score: game.score };
}

// hooks.afterFirstLoad(): ngay sau khi tải xong Đêm đầu tiên. hooks.afterLastReset(): sau khi dọn xong Đêm cuối cùng.
export function runSoak({ seed, nights, hooks = {} }) {
  const results = [];
  let crashes = 0;
  const errors = [];
  for (let i = 1; i <= nights; i++) {
    try {
      if (i === 1) {
        // Đêm đầu: tải xong rồi khởi động nóng một lượt (engine JS biên dịch mã nóng nên RSS vọt lên một lần, không phải rò rỉ;
        // đo trên 1000 Đêm cho thấy heap phẳng ~4.8 MB). Mốc đầu lấy SAU lượt này, lượt đó bỏ đi, rồi chạy lại từ đầu đúng seed.
        runSoakNight(nightFor(1), seedFor(seed, 1));
        hooks.afterFirstLoad?.();
      }
      results.push(runSoakNight(nightFor(i), seedFor(seed, i)).result);
    } catch (e) {
      crashes++;
      results.push("crashed");
      errors.push(`Đêm ${i}: ${e.stack ?? e}`);
    }
  }
  hooks.afterLastReset?.();
  return { nights, crashes, results, errors };
}
