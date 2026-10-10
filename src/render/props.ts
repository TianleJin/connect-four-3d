import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { model, pbr, projectUVs } from './assets';
import { ROOM } from './cabin';
import { rng } from './textures';

function shadowed<T extends THREE.Object3D>(o: T): T {
  o.traverse((c) => {
    c.castShadow = true;
    c.receiveShadow = true;
  });
  return o;
}

/** A rounded box with UVs in metres, so fabric and wood keep their scale. */
function softBox(w: number, h: number, d: number, r: number, segs = 4): THREE.BufferGeometry {
  return projectUVs(new RoundedBoxGeometry(w, h, d, segs, r));
}

/**
 * A cushion: a rounded box that bulges in the middle and thins to its seams,
 * with a little irregularity so it doesn't look inflated.
 */
function cushionGeometry(w: number, h: number, d: number, seed: number, squash = 0.45): THREE.BufferGeometry {
  const geo = new RoundedBoxGeometry(w, h, d, 6, Math.min(w, h, d) * 0.45);
  const rand = rng(seed);
  const pos = geo.attributes.position!;
  const phase = rand() * 6;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ex = Math.pow(Math.abs(x) / (w / 2), 2);
    const ez = Math.pow(Math.abs(z) / (d / 2), 2);
    const pinch = (1 - squash * Math.max(ex, ez)) * (1 + 0.04 * Math.sin(x * 9 + phase) * Math.cos(z * 7));
    pos.setY(i, y * pinch);
  }
  geo.computeVertexNormals();
  return projectUVs(geo);
}

/**
 * Cloth laid over a profile: `path` is a polyline in the (along, up) plane
 * and the cloth spans `width` across it. Folds grow where the cloth hangs.
 * Returns geometry in a frame where `along` is x, up is y and across is z.
 */
function drape(path: [number, number][], width: number, seed: number, foldAmp = 0.02): THREE.BufferGeometry {
  const rand = rng(seed);
  // Resample the path by arc length.
  const lens = [0];
  for (let i = 1; i < path.length; i++) {
    lens.push(lens[i - 1]! + Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]));
  }
  const total = lens[lens.length - 1]!;
  const at = (s: number): [number, number, number, number] => {
    let i = 1;
    while (i < lens.length - 1 && lens[i]! < s) i++;
    const t = (s - lens[i - 1]!) / Math.max(1e-6, lens[i]! - lens[i - 1]!);
    const [ax, ay] = path[i - 1]!;
    const [bx, by] = path[i]!;
    const dx = bx - ax;
    const dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    // Normal pointing away from the surface underneath (left of the direction of travel).
    return [ax + dx * t, ay + dy * t, -dy / l, dx / l];
  };
  const U = Math.max(24, Math.round(total / 0.015));
  const V = Math.max(16, Math.round(width / 0.02));
  const geo = new THREE.PlaneGeometry(1, 1, U, V);
  const pos = geo.attributes.position!;
  const uv = geo.attributes.uv!;
  const k1 = 9 + rand() * 6;
  const k2 = 17 + rand() * 8;
  const ph = rand() * 6;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const v = pos.getY(i) + 0.5;
    const s = u * total;
    const [x, y, nx, ny] = at(s);
    // Hanging parts are where the path runs mostly vertically.
    const prev = at(Math.max(0, s - 0.02));
    const hang = Math.min(1, Math.abs(y - prev[1]) / 0.02);
    const z = (v - 0.5) * width;
    const fold =
      foldAmp *
      (0.25 + hang) *
      (Math.sin(z * k1 + ph + s * 2) * 0.7 + Math.sin(z * k2 - s * 5) * 0.3) *
      (0.6 + 0.4 * Math.sin(s * 7 + ph));
    const off = 0.004 + Math.max(0, fold);
    pos.setXYZ(i, x + nx * off, y + ny * off + Math.min(0, fold) * 0.3, z + fold * hang * 0.5);
    uv.setXY(i, s, z);
  }
  geo.computeVertexNormals();
  return geo;
}

export interface Lamp {
  group: THREE.Group;
}

/**
 * A modern three-seat sofa in grey wool, facing +z, origin at the floor in
 * the middle of the seat, with cushions and two throws.
 */
export function createSofa(): THREE.Group {
  const sofa = new THREE.Group();
  const W = 2.3;
  const D = 0.95;
  const fabric = pbr('poly_wool_herringbone', {
    size: 0.27,
    color: 0x86888a,
    normalScale: 0.9,
    physical: { sheen: 0.5, sheenColor: new THREE.Color(0x77736e), sheenRoughness: 0.7 },
  });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    sofa.add(m);
    return m;
  };

  const ARM = 0.2;
  // Plinth and frame.
  add(softBox(W - 0.04, 0.22, D - 0.04, 0.03), fabric, 0, 0.16, 0);
  for (const side of [-1, 1]) add(softBox(ARM, 0.6, D, 0.07), fabric, side * (W / 2 - ARM / 2), 0.33, 0);
  add(softBox(W - ARM * 2 + 0.02, 0.5, 0.2, 0.07), fabric, 0, 0.5, -D / 2 + 0.1);
  // Seat cushions, slightly sunk where they meet.
  const seatW = (W - ARM * 2) / 3;
  for (let i = 0; i < 3; i++) {
    add(cushionGeometry(seatW - 0.012, 0.17, D - 0.24, 10 + i, 0.3), fabric, (i - 1) * seatW, 0.355, 0.1);
  }
  // Back cushions, leaning back.
  for (let i = 0; i < 3; i++) {
    add(cushionGeometry(seatW - 0.015, 0.2, 0.46, 20 + i, 0.4), fabric, (i - 1) * seatW, 0.66, -D / 2 + 0.27, Math.PI / 2 - 0.25);
  }
  // Short dark legs.
  const legMat = new THREE.MeshStandardMaterial({ color: 0x1d1611, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) add(new THREE.CylinderGeometry(0.018, 0.014, 0.05, 12), legMat, sx * (W / 2 - 0.08), 0.025, sz * (D / 2 - 0.08));
  }

  // Cream knitted throw over the far arm, spilling onto the seat.
  // Cloth is a single sheet, so both sides render.
  const cream = pbr('curly_teddy_natural', { size: 0.33, color: 0xe6dccb, normalScale: 1.4, physical: { side: THREE.DoubleSide } });
  const ax = -W / 2;
  const creamThrow = new THREE.Mesh(
    drape(
      [
        [ax - 0.02, 0.12],
        [ax - 0.02, 0.5],
        [ax + 0.01, 0.64],
        [ax + ARM - 0.02, 0.645],
        [ax + ARM + 0.02, 0.48],
        [ax + ARM + 0.45, 0.455],
      ],
      0.85,
      3,
      0.025,
    ),
    cream,
  );
  creamThrow.position.z = 0.02;
  sofa.add(creamThrow);

  // Burnt-orange wool throw across the near seat and down the front.
  const orange = pbr('caban', { size: 0.27, color: 0xa4521f, noMap: true, normalScale: 1.2, physical: { side: THREE.DoubleSide } });
  const orangeThrow = new THREE.Mesh(
    drape(
      [
        [-0.35, 0.68],
        [-0.15, 0.48],
        [0.38, 0.45],
        [0.46, 0.4],
        [0.47, 0.12],
      ],
      0.62,
      5,
      0.045,
    ),
    orange,
  );
  // The path runs front-to-back here, so turn it to run along z.
  orangeThrow.rotation.y = -Math.PI / 2;
  orangeThrow.position.x = 0.05;
  sofa.add(orangeThrow);

  // Throw pillows.
  const knit = pbr('knitted_fleece', { size: 0.27, color: 0xe8e0d0, noMap: true, normalScale: 1.5 });
  const pillows: [number, number, number, number, THREE.Material][] = [
    [-0.62, 0.7, -0.17, -0.2, knit],
    [0.68, 0.7, -0.17, 0.25, orange],
  ];
  pillows.forEach(([x, y, z, yaw, mat], i) => {
    const p = add(cushionGeometry(0.46, 0.13, 0.44, 40 + i, 0.6), mat, x, y, z, Math.PI / 2 - 0.3);
    p.rotation.y = yaw;
  });
  return shadowed(sofa);
}

/**
 * A low Scandinavian lounge chair: walnut side frames, a slanted seat and
 * back with a sheepskin thrown over. Faces +z.
 */
export function createLoungeChair(): THREE.Group {
  const chair = new THREE.Group();
  const walnut = pbr('oak_veneer_01', { size: 1.8, color: 0x6a4630, roughness: 0.8 });
  const W = 0.68;
  const stick = (len: number, t: number, x: number, y: number, z: number, rx: number) => {
    const m = new THREE.Mesh(softBox(t, len, t * 1.6, t * 0.35, 2), walnut);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    chair.add(m);
  };
  for (const side of [-1, 1]) {
    const x = side * (W / 2);
    stick(0.6, 0.035, x, 0.3, 0.22, -0.18); // front leg
    stick(0.62, 0.035, x, 0.3, -0.28, 0.3); // back leg
    const arm = new THREE.Mesh(softBox(0.06, 0.028, 0.62, 0.01, 2), walnut);
    arm.position.set(x, 0.56, 0.0);
    arm.rotation.x = 0.06;
    chair.add(arm);
    stick(0.66, 0.03, x, 0.25, -0.02, Math.PI / 2 - 0.1); // seat rail
    stick(0.62, 0.03, x * 0.98, 0.62, -0.36, 0.42); // back stile
  }
  // Cushions: grey wool seat and back, under a sheepskin.
  const wool = pbr('poly_wool_herringbone', { size: 0.27, color: 0x8d8780 });
  const seat = new THREE.Mesh(cushionGeometry(W - 0.04, 0.1, 0.56, 51, 0.3), wool);
  seat.position.set(0, 0.32, 0.0);
  seat.rotation.x = -0.1;
  const back = new THREE.Mesh(cushionGeometry(W - 0.06, 0.1, 0.55, 52, 0.3), wool);
  back.position.set(0, 0.64, -0.3);
  back.rotation.x = Math.PI / 2 - 0.42;
  chair.add(seat, back);
  const fleece = pbr('curly_teddy_natural', { size: 0.25, color: 0xcfc5b8, normalScale: 2, physical: { side: THREE.DoubleSide } });
  const skin = new THREE.Mesh(
    drape(
      [
        [-0.5, 0.92],
        [-0.33, 0.62],
        [-0.22, 0.42],
        [0.0, 0.38],
        [0.27, 0.35],
        [0.32, 0.22],
      ],
      0.6,
      8,
      0.02,
    ),
    fleece,
  );
  skin.rotation.y = -Math.PI / 2;
  chair.add(skin);
  return shadowed(chair);
}

/** Floor lamp: black base and stem, linen drum shade lit from inside. */
export function createFloorLamp(height: number, power: number): Lamp {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x18181a, metalness: 0.7, roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.15, 0.025, 40), metal);
  base.position.y = 0.0125;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, height, 12), metal);
  stem.position.y = height / 2;
  const shadeH = 0.3;
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xf1e6d2,
    emissive: new THREE.Color(1, 0.62, 0.3),
    emissiveIntensity: 0.75,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, shadeH, 48, 1, true), shadeMat);
  shade.position.y = height + shadeH * 0.35;
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 16, 10),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 4.2, 2.4) }),
  );
  bulb.position.y = height + 0.04;
  const light = new THREE.PointLight(0xffc27a, power, 0, 2);
  light.position.y = height + 0.06;
  group.add(base, stem, shade, bulb, light);
  base.castShadow = stem.castShadow = true;
  return { group };
}

/** Low oak bench along the left wall, with candles; and two floating shelves above with pottery. */
export function createLeftWallFurniture(): { group: THREE.Group; update(time: number): void } {
  const group = new THREE.Group();
  const oak = pbr('oak_veneer_01', { size: 1.8, rotation: Math.PI / 2, color: 0xc8ae90, roughness: 0.85 });
  const x = ROOM.minX;

  // Bench: a thick top on two slab ends.
  const L = 1.9;
  const zc = -0.35;
  const top = new THREE.Mesh(softBox(0.4, 0.05, L, 0.006, 2), oak);
  top.position.set(x + 0.22, 0.4, zc);
  group.add(top);
  for (const s of [-1, 1]) {
    const end = new THREE.Mesh(softBox(0.38, 0.375, 0.05, 0.005, 2), oak);
    end.position.set(x + 0.22, 0.1875, zc + s * (L / 2 - 0.12));
    group.add(end);
  }

  // Shelves.
  for (const y of [1.42, 1.82]) {
    const shelf = new THREE.Mesh(softBox(0.24, 0.035, 1.3, 0.004, 2), oak);
    shelf.position.set(x + 0.12, y, -1.25);
    group.add(shelf);
  }
  shadowed(group);

  // Candles on the bench.
  const flames: { flame: THREE.Mesh; light: THREE.PointLight | null; phase: number }[] = [];
  const wax = new THREE.MeshPhysicalMaterial({
    color: 0xf0e6d4,
    roughness: 0.45,
    emissive: 0xff8a30,
    emissiveIntensity: 0.2,
  });
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5, 2) });
  const candles: [number, number, number, boolean][] = [
    [0.26, 0.2, 0.035, true],
    [0.14, 0.11, 0.03, false],
    [0.3, 0.32, 0.03, false],
  ];
  candles.forEach(([dz, h, r, lit], i) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28), wax);
    c.position.set(x + 0.2 + (i % 2) * 0.06, 0.425 + h / 2, zc + L / 2 - 0.25 - dz * 1.2);
    c.castShadow = true;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), flameMat);
    flame.scale.set(1, 2.6, 1);
    flame.position.set(c.position.x, 0.425 + h + 0.014, c.position.z);
    group.add(c, flame);
    let light: THREE.PointLight | null = null;
    if (lit) {
      light = new THREE.PointLight(0xffa050, 0.3, 0, 2);
      light.position.copy(flame.position).y += 0.02;
      group.add(light);
    }
    flames.push({ flame, light, phase: i * 2.1 });
  });

  // Pottery on the shelves (Poly Haven ceramic vases).
  const place = (name: string, height: number, px: number, py: number, pz: number, tint?: number) => {
    void model(name).then((m) => {
      const box = new THREE.Box3().setFromObject(m);
      const s = height / (box.max.y - box.min.y);
      m.scale.setScalar(s);
      m.position.set(px, py - box.min.y * s, pz);
      m.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = o.receiveShadow = true;
          if (tint !== undefined) (o.material as THREE.MeshStandardMaterial).color.set(tint);
        }
      });
      group.add(m);
    });
  };
  place('ceramic_vase_02', 0.17, x + 0.12, 1.4375, -1.65);
  place('ceramic_vase_04', 0.22, x + 0.12, 1.4375, -0.85, 0xb8a894);
  place('ceramic_vase_04', 0.14, x + 0.12, 1.8375, -1.5, 0x8a7a6a);
  place('ceramic_vase_02', 0.12, x + 0.12, 1.8375, -1.05, 0xd8d0c4);

  return {
    group,
    update(time) {
      for (const { flame, light, phase } of flames) {
        const f = 0.85 + 0.1 * Math.sin(time * 10.7 + phase) + 0.05 * Math.sin(time * 25.3 + phase * 2);
        flame.scale.set(1, 2.6 * f, 1);
        if (light) light.intensity = 0.3 * f;
      }
    },
  };
}

/** The wicker log basket beside the stove (Poly Haven model) with a folded blanket. */
export function createBasket(): THREE.Group {
  const group = new THREE.Group();
  void model('wicker_basket_01').then((m) => {
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const s = 0.42 / Math.max(size.x, size.z);
    m.scale.setScalar(s);
    m.position.y = -box.min.y * s;
    shadowed(m);
    group.add(m);
  });
  const blanket = new THREE.Mesh(
    cushionGeometry(0.34, 0.12, 0.28, 61, 0.5),
    pbr('knitted_fleece', { size: 0.27, color: 0x9d968c, noMap: true, normalScale: 1.5 }),
  );
  blanket.position.y = 0.3;
  blanket.rotation.set(0.15, 0.3, 0.1);
  group.add(shadowed(blanket));
  return group;
}
