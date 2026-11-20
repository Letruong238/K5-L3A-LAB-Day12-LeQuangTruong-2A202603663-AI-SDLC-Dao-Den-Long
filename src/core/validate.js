// Kiểm tra định dạng file scenario và inputs. Sai thì ném ContractError (mã thoát 2).
export class ContractError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractError";
    this.exitCode = 2;
  }
}

export const SHADE_STATES = ["spawning", "wander", "chase", "recoil", "stunned"];
export const DRIFTER_STATES = ["idle", "chase", "flee"];

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isNat = (v) => Number.isInteger(v) && v >= 0;
const isVec = (v, n) => Array.isArray(v) && v.length === n && v.every(isNum);

function fail(msg) {
  throw new ContractError(msg);
}

export function validateInputs(data) {
  if (!isObj(data)) fail("inputs: gốc phải là object");
  if (!Array.isArray(data.frames)) fail("inputs: thiếu mảng frames");
  let last = -1;
  data.frames.forEach((f, i) => {
    const where = `inputs.frames[${i}]`;
    if (!isObj(f)) fail(`${where}: phải là object`);
    if (!isNat(f.tick)) fail(`${where}.tick phải là số nguyên >= 0`);
    if (f.tick <= last) fail(`${where}.tick phải tăng nghiêm ngặt`);
    last = f.tick;
    if ("move" in f) {
      if (!isVec(f.move, 2)) fail(`${where}.move phải là [x, z]`);
      if (f.move.some((c) => c < -1 || c > 1)) fail(`${where}.move phải nằm trong [-1, 1]`);
    }
    if ("cam_yaw_deg" in f && !isNum(f.cam_yaw_deg)) fail(`${where}.cam_yaw_deg phải là số`);
    for (const k of ["jump", "interact", "pulse", "dash", "pause"]) {
      if (k in f && typeof f[k] !== "boolean") fail(`${where}.${k} phải là boolean`);
    }
  });
  return data;
}

export function validateScenario(data, lanternIds) {
  if (!isObj(data)) fail("scenario: gốc phải là object");
  if ("player" in data) {
    const p = data.player;
    if (!isObj(p)) fail("scenario.player phải là object");
    if ("pos" in p && !isVec(p.pos, 3)) fail("scenario.player.pos phải là [x, y, z]");
    for (const k of ["carried", "flames", "invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks"]) {
      if (k in p && !isNat(p[k])) fail(`scenario.player.${k} phải là số nguyên >= 0`);
    }
  }
  for (const k of ["random_motes", "random_shades", "random_drifters", "wind_enabled"]) {
    if (k in data && typeof data[k] !== "boolean") fail(`scenario.${k} phải là boolean`);
  }
  if ("motes" in data) {
    if (!Array.isArray(data.motes) || !data.motes.every((m) => isVec(m, 3))) fail("scenario.motes phải là mảng [x, y, z]");
  }
  if ("shades" in data) {
    if (!Array.isArray(data.shades)) fail("scenario.shades phải là mảng");
    data.shades.forEach((s, i) => {
      const where = `scenario.shades[${i}]`;
      if (!isObj(s) || !isVec(s.pos, 3)) fail(`${where}.pos phải là [x, y, z]`);
      if ("id" in s && typeof s.id !== "string") fail(`${where}.id phải là chuỗi`);
      if ("state" in s && !SHADE_STATES.includes(s.state)) fail(`${where}.state phải là một trong ${SHADE_STATES.join("/")}`);
      if ("state_ticks_left" in s && !isNat(s.state_ticks_left)) fail(`${where}.state_ticks_left phải là số nguyên >= 0`);
    });
    const ids = data.shades.filter((s) => s.id).map((s) => s.id);
    if (new Set(ids).size !== ids.length) fail("scenario.shades có id trùng");
  }
  if ("drifters" in data) {
    if (!Array.isArray(data.drifters)) fail("scenario.drifters phải là mảng");
    data.drifters.forEach((d, i) => {
      const where = `scenario.drifters[${i}]`;
      if (!isObj(d) || !isVec(d.pos, 3)) fail(`${where}.pos phải là [x, y, z]`);
      if ("id" in d && typeof d.id !== "string") fail(`${where}.id phải là chuỗi`);
      if ("state" in d && !DRIFTER_STATES.includes(d.state)) fail(`${where}.state phải là một trong ${DRIFTER_STATES.join("/")}`);
      if ("stolen" in d && !isNat(d.stolen)) fail(`${where}.stolen phải là số nguyên >= 0`);
    });
  }
  if ("charms" in data) {
    if (!Array.isArray(data.charms)) fail("scenario.charms phải là mảng");
    data.charms.forEach((c, i) => {
      const where = `scenario.charms[${i}]`;
      if (!isObj(c) || typeof c.id !== "string") fail(`${where}.id phải là chuỗi`);
      if (!isVec(c.pos, 3)) fail(`${where}.pos phải là [x, y, z]`);
      if ("available" in c && typeof c.available !== "boolean") fail(`${where}.available phải là boolean`);
      if ("respawn_ticks" in c && !isNat(c.respawn_ticks)) fail(`${where}.respawn_ticks phải là số nguyên >= 0`);
    });
  }
  if ("lanterns" in data) {
    if (!Array.isArray(data.lanterns)) fail("scenario.lanterns phải là mảng");
    data.lanterns.forEach((l, i) => {
      const where = `scenario.lanterns[${i}]`;
      if (!isObj(l) || typeof l.id !== "string") fail(`${where}.id phải là chuỗi`);
      if (!lanternIds.includes(l.id)) fail(`${where}.id không có trong màn: ${l.id}`);
      if ("pos" in l && !isVec(l.pos, 3)) fail(`${where}.pos phải là [x, y, z]`);
      if ("lit" in l && typeof l.lit !== "boolean") fail(`${where}.lit phải là boolean`);
      if ("deposited" in l && !isNat(l.deposited)) fail(`${where}.deposited phải là số nguyên >= 0`);
    });
  }
  if ("time_left_s" in data && !(isNum(data.time_left_s) && data.time_left_s >= 0)) fail("scenario.time_left_s phải là số >= 0");
  return data;
}
