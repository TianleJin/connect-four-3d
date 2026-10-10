import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { pbr, projectUVs } from './assets';

/** Height of the coffee table's top surface; the board stands on it. */
export const TABLE_TOP = 0.45;
const TOP_W = 1.16;
const TOP_D = 0.64;
const TOP_T = 0.065;

export interface Table {
  group: THREE.Group;
  update(time: number): void;
}

/**
 * Low oak coffee table: a thick slab on a solid, inset plinth, with a candle
 * in a glass, a mug and a book on it.
 */
export function createTable(): Table {
  const group = new THREE.Group();
  group.name = 'table';

  const oak = pbr('oak_veneer_01', { size: 1.83, rotation: Math.PI / 2, color: 0xf6e2cc, roughness: 1, normalScale: 0.4 });
  // Oiled, not lacquered: an even satin rather than the veneer scan's gloss.
  oak.roughnessMap = null;
  oak.roughness = 0.62;
  const top = new THREE.Mesh(projectUVs(new RoundedBoxGeometry(TOP_W, TOP_T, TOP_D, 3, 0.008)), oak);
  top.position.y = TABLE_TOP - TOP_T / 2;
  const baseH = TABLE_TOP - TOP_T;
  const base = new THREE.Mesh(projectUVs(new RoundedBoxGeometry(0.82, baseH, 0.4, 2, 0.006)), oak);
  base.position.y = baseH / 2;
  // A shadow gap where the plinth meets the slab.
  const gap = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.012, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 1 }),
  );
  gap.position.y = baseH - 0.006;
  group.add(top, base, gap);
  group.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });

  const mug = createMug();
  mug.position.set(0.44, TABLE_TOP, -0.12);
  mug.rotation.y = -2.2;
  const book = createBook();
  book.position.set(0.33, TABLE_TOP, 0.13);
  book.rotation.y = 0.18;
  const candle = createCandle();
  candle.group.position.set(-0.42, TABLE_TOP, 0.06);
  group.add(mug, book, candle.group);
  return { group, update: candle.update };
}

function createMug(): THREE.Group {
  const mug = new THREE.Group();
  // Matte stoneware with a speckled glaze.
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0xb59a7c, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const pts = [
    [0, 0],
    [0.036, 0],
    [0.04, 0.004],
    [0.041, 0.09],
    [0.037, 0.092],
    [0.036, 0.008],
    [0, 0.008],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), ceramic);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0065, 12, 28, Math.PI), ceramic);
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.04, 0.048, 0);
  const drink = new THREE.Mesh(
    new THREE.CircleGeometry(0.036, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x2a160c, roughness: 0.15 }),
  );
  drink.rotation.x = -Math.PI / 2;
  drink.position.y = 0.075;
  mug.add(body, handle, drink);
  mug.traverse((o) => (o.castShadow = o.receiveShadow = true));
  return mug;
}

function createBook(): THREE.Group {
  const book = new THREE.Group();
  const W = 0.15;
  const D = 0.215;
  const T = 0.028;
  const cover = new THREE.MeshPhysicalMaterial({
    color: 0x3a3428,
    roughness: 0.75,
    sheen: 0.6,
    sheenColor: new THREE.Color(0x6a604c),
  });
  const pages = new THREE.MeshStandardMaterial({ color: 0xe6dcc6, roughness: 0.9 });
  const front = new THREE.Mesh(new RoundedBoxGeometry(W, 0.003, D, 2, 0.001), cover);
  front.position.y = T - 0.0015;
  const backC = front.clone();
  backC.position.y = 0.0015;
  const spine = new THREE.Mesh(new RoundedBoxGeometry(0.004, T, D, 2, 0.0015), cover);
  spine.position.x = -W / 2 + 0.002;
  const block = new THREE.Mesh(new THREE.BoxGeometry(W - 0.008, T - 0.005, D - 0.008), pages);
  block.position.set(0.001, T / 2, 0);
  // A pale label on the cover.
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.07, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xcfc4ae, roughness: 0.9 }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0.01, T + 0.0002, -0.03);
  book.add(front, backC, spine, block, label);
  book.traverse((o) => (o.castShadow = o.receiveShadow = true));
  return book;
}

/** A pillar candle burning in a clear tumbler, with a small flickering light. */
function createCandle(): { group: THREE.Group; update(time: number): void } {
  const group = new THREE.Group();
  const R = 0.042;
  const H = 0.1;
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.05,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const pts = [
    [0, 0.001],
    [R - 0.002, 0],
    [R, 0.004],
    [R + 0.001, H],
    [R - 0.003, H],
    [R - 0.004, 0.012],
    [0, 0.012],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), glassMat);
  glass.renderOrder = 3;
  const wax = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.008, R - 0.008, 0.06, 32),
    new THREE.MeshPhysicalMaterial({
      color: 0xf2e8d6,
      roughness: 0.5,
      emissive: 0xff8a30,
      emissiveIntensity: 0.25,
    }),
  );
  wax.position.y = 0.012 + 0.03;
  const flame = new THREE.Mesh(
    new THREE.SphereGeometry(0.0045, 12, 8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(9, 5, 2) }),
  );
  flame.scale.set(1, 2.6, 1);
  const flameY = 0.012 + 0.06 + 0.012;
  flame.position.y = flameY;
  const light = new THREE.PointLight(0xffa050, 0.35, 0, 2);
  light.position.y = flameY + 0.01;
  group.add(glass, wax, flame, light);
  return {
    group,
    update(time) {
      const f = 0.85 + 0.1 * Math.sin(time * 11.3) + 0.05 * Math.sin(time * 27.1 + 1);
      flame.scale.set(1, 2.6 * f, 1);
      light.intensity = 0.35 * f;
    },
  };
}
