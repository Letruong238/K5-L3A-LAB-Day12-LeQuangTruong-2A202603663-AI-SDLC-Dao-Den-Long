// Dựng bản đồ 3D của từng đêm theo bản đồ chuẩn (src/core/maps.js) và bảng màu chuẩn của ticket.
import * as THREE from "three";
import { TUNING as T } from "/src/core/tuning.js";
import { MAPS } from "/src/core/maps.js";

// Bảng màu chuẩn (Ticket-02, Phần 3)
export const C = {
  sky: 0x0e1430, fog: 0x1b2350,
  grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lampOn: 0xffb347, lampCore: 0xffe9b0, lampOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a,
  shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450,
  robe: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e,
  drifter: 0x8fa3b8, danger: 0xff5a5f, text: 0xf5f1e6,
};
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...o });
const rad = (d) => (d * Math.PI) / 180;

function island(group, cx, cz, r, h = 3) {
  const side = new THREE.Mesh(new THREE.CylinderGeometry(r, r - 3, h, 64, 1, true), mat(C.sand, { side: THREE.DoubleSide }));
  side.position.set(cx, -h / 2, cz);
  const top = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mat(C.grass));
  top.rotation.x = -Math.PI / 2;
  top.position.set(cx, 0, cz);
  group.add(side, top);
}

function padMesh(group, pd) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.14, 24), mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.4 }));
  m.position.set(pd.pos[0], pd.pos[1] + 0.07, pd.pos[2]);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 32), mat(C.lampCore, { emissive: C.lampCore, emissiveIntensity: 0.6 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(pd.pos[0], pd.pos[1] + 0.15, pd.pos[2]);
  group.add(m, ring);
}

export function buildWorld(scene, game) {
  const root = new THREE.Group();
  scene.add(root);
  const map = MAPS[game.night];
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), mat(C.sea, { transparent: true, opacity: 0.9 }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -9;
  root.add(sea);

  if (game.night === 1) island(root, 0, 0, 40);
  if (game.night === 2) {
    island(root, 0, 0, 28);
    island(root, 70, 0, 28);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(18, 0.3, 4), mat(C.wood));
    bridge.position.set(35, -0.16, 0);
    root.add(bridge);
    for (let x = 27; x <= 43; x += 1) {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 4), mat(0x4a321e));
      plank.position.set(x, 0.01, 0);
      root.add(plank);
    }
  }
  if (game.night === 3) {
    island(root, 0, 0, 45);
    const sideM = mat(C.sand);
    const topM = mat(C.grass);
    // tầng 2: đĩa r=8 cao 6
    const t2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 6, 48), [sideM, topM, sideM]);
    t2.position.y = 3;
    root.add(t2);
    // tầng 1: vành khăn r 12..24 ở nửa z>0, cao 3
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false, curveSegments: 40 });
    geo.rotateX(Math.PI / 2);
    geo.translate(0, 3, 0);
    root.add(new THREE.Mesh(geo, [topM, sideM]));
    // tháp chuông: trụ r=2 cao 8 trên tầng 2
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.2, 8, 24), mat(C.wood));
    tower.position.y = 6 + 4;
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.3 }));
    bell.position.y = 6 + 8.8;
    root.add(tower, bell);
    // hai dốc rộng 3 m ở 30° và 150°: chân r=30 (Y=0) đỉnh r=24 (Y=3)
    for (const a of [30, 150]) {
      const g = new THREE.Group();
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), mat(C.wood));
      ramp.rotation.z = Math.atan(0.5);
      ramp.position.y = -0.15;
      g.add(ramp);
      g.rotation.y = Math.PI - rad(a);
      g.position.set(27 * Math.cos(rad(a)), 1.5, 27 * Math.sin(rad(a)));
      root.add(g);
    }
  }
  for (const pd of map.pads) padMesh(root, pd);

  // Đèn lồng
  const lanterns = game.lanterns.map((l) => {
    const g = new THREE.Group();
    g.position.set(l.pos[0], l.pos[1], l.pos[2]);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 8), mat(C.wood));
    pole.position.y = 1.2;
    const lampMat = new THREE.MeshStandardMaterial({ color: C.lampOff, emissive: 0x000000, roughness: 0.6 });
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.15, 0.95), lampMat);
    lamp.position.y = 2.95;
    const light = new THREE.PointLight(C.lampOn, 0, 34, 2);
    light.position.y = 3;
    // Thanh dầu (chỉ hiện khi đèn sáng) và vết rách trên giấy (hiện khi đèn tắt)
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.16), new THREE.MeshBasicMaterial({ color: 0x1b2350, transparent: true, opacity: 0.8, side: THREE.DoubleSide }));
    const barFill = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.1), new THREE.MeshBasicMaterial({ color: C.lampOn, side: THREE.DoubleSide }));
    barFill.position.z = 0.005;
    const bar = new THREE.Group();
    bar.add(barBg, barFill);
    bar.position.y = 4.1;
    bar.visible = false;
    const tear = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshBasicMaterial({ color: 0x0e1430, side: THREE.DoubleSide }));
    tear.position.set(0.1, 2.9, 0.49);
    tear.rotation.z = 0.5;
    const tear2 = tear.clone();
    tear2.position.set(-0.15, 3.15, -0.49);
    const zone = new THREE.Mesh(
      new THREE.RingGeometry(T.safe_radius - 0.1, T.safe_radius, 64),
      new THREE.MeshBasicMaterial({ color: C.lampOn, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.y = 0.04;
    zone.visible = false;
    g.add(pole, lamp, light, zone, bar, tear, tear2);
    root.add(g);
    return { group: g, lamp, lampMat, light, zone, bar, barFill, tear: [tear, tear2], lit: false };
  });

  // Bùa Gió
  const charms = game.charms.map((c) => {
    const g = new THREE.Group();
    g.position.set(c.pos[0], c.pos[1] + 1.2, c.pos[2]);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.05, 0.06), mat(C.gold, { emissive: C.gold, emissiveIntensity: 0.4 }));
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.08), mat(C.scarf, { emissive: C.scarf, emissiveIntensity: 0.3 }));
    g.add(edge, card);
    root.add(g);
    return { group: g };
  });

  return { root, lanterns, charms, dispose: () => scene.remove(root) };
}
