// Chạy mô phỏng headless: trả về mảng dòng JSONL (đối tượng) theo Test Contract v1.0.
import { Game, DEFAULT_INPUT } from "./game.js";
import { validateInputs } from "./validate.js";

export function runHeadless({ seed = 0, ticks, scenario = {}, inputs = null, snapshotEvery = 10 }) {
  if (inputs) validateInputs(inputs);
  const frames = inputs ? inputs.frames : [];
  const game = new Game({ seed, scenario });
  const out = [game.snapshot()]; // snapshot tick 0: sau dựng scenario, trước input
  const cur = DEFAULT_INPUT();
  let fi = 0;
  for (let k = 0; k < ticks && game.state === "playing"; k++) {
    // Bước k đọc input của tick k: áp các frame có tick <= k
    while (fi < frames.length && frames[fi].tick <= k) {
      const f = frames[fi++];
      for (const key of ["move", "cam_yaw_deg", "jump", "interact", "pulse", "dash"]) {
        if (key in f) cur[key] = f[key];
      }
    }
    out.push(...game.step(cur));
    if (game.tick % snapshotEvery === 0) out.push(game.snapshot());
  }
  if (game.tick > 0 && game.tick % snapshotEvery !== 0) out.push(game.snapshot());
  out.push({ type: "end", ticks: game.tick, state: game.state, score: game.score });
  return out;
}
