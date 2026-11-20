// Chạy mô phỏng headless: trả về mảng dòng JSONL (đối tượng) theo Test Contract v1.1.
import { Game, DEFAULT_INPUT } from "./game.js";
import { validateInputs } from "./validate.js";

const INPUT_KEYS = ["move", "cam_yaw_deg", "jump", "interact", "pulse", "dash", "pause"];

export function runHeadless({ seed = 0, night = 1, ticks, scenario = {}, inputs = null, snapshotEvery = 10 }) {
  if (inputs) validateInputs(inputs);
  const frames = inputs ? inputs.frames : [];
  const game = new Game({ seed, night, scenario });
  const out = [game.snapshot()]; // snapshot tick 0: sau dựng scenario, trước input
  out.push({ type: "event", tick: 0, name: "night_start", data: { night } });
  const cur = DEFAULT_INPUT();
  let fi = 0;
  for (let k = 0; k < ticks && game.state === "playing"; k++) {
    // Bước k đọc input của tick k: áp các frame có tick <= k
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      for (const key of INPUT_KEYS) if (key in f) cur[key] = f[key];
    }
    out.push(...game.step(cur));
    if (game.tick % snapshotEvery === 0) out.push(game.snapshot());
  }
  if (game.tick > 0 && game.tick % snapshotEvery !== 0) out.push(game.snapshot());
  out.push({ type: "end", ticks: game.tick, state: game.state, score: game.score });
  return out;
}
