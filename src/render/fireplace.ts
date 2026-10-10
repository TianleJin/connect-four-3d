import * as THREE from 'three';
import { ROOM } from './cabin';
import { endGrainTexture, rng, woodTexture } from './textures';

/** Freestanding black steel stove: an open log store, the fire box with a glass door, and a flue. */
const BASE_H = 0.4;
const BOX_W = 0.52;
const BOX_H = 0.62;
const BOX_D = 0.44;
const OPEN_W = 0.38;
const OPEN_H = 0.36;
/** Distance of the stove's back from the glass. */
const STAND_OFF = 0.55;
/** Candela of the fire's light. */
const FIRE_POWER = 3;

const flameVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flameFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float n = fbm(vec2(uv.x * 3.0 + uSeed, uv.y * 2.2 - uTime * 1.7));
    float x = (uv.x - 0.5) * 2.0 + (n - 0.5) * 0.7 * uv.y;
    // Tongues of flame: wide at the base, narrowing and breaking up towards the top.
    float width = mix(0.85, 0.05, pow(uv.y, 0.7));
    float shape = 1.0 - smoothstep(width * 0.5, width, abs(x));
    float body = shape * (1.0 - smoothstep(0.15, 0.95, uv.y + (n - 0.5) * 0.6));
    body *= smoothstep(0.0, 0.06, uv.y);
    float heat = clamp(body * 1.7 - uv.y * 0.35, 0.0, 1.0);
    vec3 col = mix(vec3(0.9, 0.12, 0.0), vec3(1.0, 0.5, 0.08), smoothstep(0.1, 0.55, heat));
    col = mix(col, vec3(1.0, 0.85, 0.5), smoothstep(0.6, 1.0, heat));
    float a = smoothstep(0.03, 0.45, body);
    gl_FragColor = vec4(col * a * uIntensity, a);
  }
`;

export interface Fireplace {
  group: THREE.Group;
  update(time: number, dt: number, camera: THREE.Camera): void;
}

export function createFireplace(x: number): Fireplace {
  const group = new THREE.Group();
  group.name = 'fireplace';
  // Local +z points into the room; the back of the unit stands just off the glass.
  group.position.set(x, 0, ROOM.minZ + STAND_OFF);

  // Stove paint: black, slightly satin, so edges catch the lamps.
  const steel = new THREE.MeshStandardMaterial({ color: 0x111112, metalness: 0.3, roughness: 0.42 });
  const panel = (w: number, h: number, d: number, px: number, py: number, pz: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steel);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  const T = 0.02;
  const cz = BOX_D / 2;

  // Log store: an open steel frame packed with log ends.
  panel(T, BASE_H, BOX_D, -BOX_W / 2 + T / 2, BASE_H / 2, cz);
  panel(T, BASE_H, BOX_D, BOX_W / 2 - T / 2, BASE_H / 2, cz);
  panel(BOX_W, T, BOX_D, 0, T / 2, cz);
  group.add(logStack(BOX_W - T * 2, BASE_H - T * 2, BOX_D - 0.04, 0, T, cz, 5));

  // Fire box: floor, top, sides and back, and a front plate with the opening cut out.
  const boxY = BASE_H;
  panel(BOX_W, T * 1.6, BOX_D, 0, boxY + T * 0.8, cz);
  panel(BOX_W, T, BOX_D, 0, boxY + BOX_H - T / 2, cz);
  panel(T, BOX_H, BOX_D, -BOX_W / 2 + T / 2, boxY + BOX_H / 2, cz);
  panel(T, BOX_H, BOX_D, BOX_W / 2 - T / 2, boxY + BOX_H / 2, cz);
  panel(BOX_W, BOX_H, T, 0, boxY + BOX_H / 2, T / 2);
  const front = new THREE.Shape();
  front.moveTo(-BOX_W / 2, 0);
  front.lineTo(BOX_W / 2, 0);
  front.lineTo(BOX_W / 2, BOX_H);
  front.lineTo(-BOX_W / 2, BOX_H);
  front.closePath();
  const openY = 0.09;
  const hole = new THREE.Path();
  hole.moveTo(-OPEN_W / 2, openY);
  hole.lineTo(-OPEN_W / 2, openY + OPEN_H);
  hole.lineTo(OPEN_W / 2, openY + OPEN_H);
  hole.lineTo(OPEN_W / 2, openY);
  hole.closePath();
  front.holes.push(hole);
  const frontPlate = new THREE.Mesh(new THREE.ExtrudeGeometry(front, { depth: 0.03, bevelEnabled: false }), steel);
  frontPlate.position.set(0, boxY, BOX_D);
  frontPlate.castShadow = true;
  group.add(frontPlate);
  // Door handle.
  panel(0.014, 0.16, 0.02, OPEN_W / 2 + 0.035, boxY + openY + OPEN_H / 2, BOX_D + 0.04);
  // Door glass: a faint smoky sheet over the opening.
  const doorGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(OPEN_W, OPEN_H),
    new THREE.MeshPhysicalMaterial({ color: 0x302820, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false }),
  );
  doorGlass.position.set(0, boxY + openY + OPEN_H / 2, BOX_D + 0.031);
  doorGlass.renderOrder = 3;
  group.add(doorGlass);

  // Flue up to the ceiling.
  const flueH = ROOM.height - (boxY + BOX_H);
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, flueH, 32), steel);
  flue.position.set(0, boxY + BOX_H + flueH / 2, cz * 0.8);
  flue.castShadow = true;
  group.add(flue);
  // A plinth plate under the stove.
  panel(BOX_W + 0.04, 0.012, BOX_D + 0.04, 0, 0.006, cz);

  // Firebrick lining, glowing faintly with heat.
  const lining = new THREE.Mesh(
    new THREE.BoxGeometry(BOX_W - T * 2, BOX_H - T * 2.6, BOX_D - T),
    new THREE.MeshStandardMaterial({ color: 0x2a1c16, roughness: 1, emissive: 0x401204, side: THREE.BackSide }),
  );
  lining.position.set(0, boxY + BOX_H / 2 + T * 0.3, cz + T / 2);
  group.add(lining);

  // Logs and embers on the grate.
  const fireY = boxY + T * 1.6;
  const fireZ = cz + 0.04;
  const barkTex = woodTexture(20, 16, 71);
  barkTex.rotation = Math.PI / 2;
  const bark = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1, emissive: 0xff3a00, emissiveIntensity: 0.15 });
  const logGeo = new THREE.CylinderGeometry(0.03, 0.034, 0.34, 12);
  for (const [lx, ly, lz, yaw] of [
    [0, 0.032, fireZ - 0.05, 0.1],
    [0.02, 0.032, fireZ + 0.05, -0.08],
    [0, 0.09, fireZ, 0.7],
  ] as [number, number, number, number][]) {
    const log = new THREE.Mesh(logGeo, bark);
    log.rotation.set(0, yaw, Math.PI / 2);
    log.position.set(lx, fireY + ly, lz);
    group.add(log);
  }
  const embersBed = new THREE.Mesh(
    new THREE.CircleGeometry(0.17, 24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.35, 0.05) }),
  );
  embersBed.rotation.x = -Math.PI / 2;
  embersBed.scale.set(1.2, 0.55, 1);
  embersBed.position.set(0, fireY + 0.003, fireZ);
  group.add(embersBed);

  // Flames: a few noise-driven billboards that turn to face the camera.
  const flames = new THREE.Group();
  flames.position.set(0, fireY + 0.02, fireZ);
  group.add(flames);
  const flameMats: THREE.ShaderMaterial[] = [];
  for (const [fx, fw, fh, seed] of [
    [0, 0.3, 0.3, 0],
    [-0.09, 0.2, 0.24, 3.1],
    [0.09, 0.21, 0.25, 7.7],
    [0.02, 0.18, 0.2, 12.3],
  ] as [number, number, number, number][]) {
    const mat = new THREE.ShaderMaterial({
      vertexShader: flameVertex,
      fragmentShader: flameFragment,
      uniforms: { uTime: { value: 0 }, uSeed: { value: seed }, uIntensity: { value: 1.3 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    flameMats.push(mat);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), mat);
    plane.position.set(fx, fh / 2, seed * 0.003);
    plane.renderOrder = 2;
    flames.add(plane);
  }

  // Sparks inside the box.
  const SPARKS = 24;
  const sparkPos = new Float32Array(SPARKS * 3);
  const sparkVel: number[] = [];
  const rand = rng(17);
  const resetSpark = (i: number, initial: boolean) => {
    sparkPos[i * 3] = (rand() - 0.5) * 0.28;
    sparkPos[i * 3 + 1] = initial ? rand() * OPEN_H : 0.04;
    sparkPos[i * 3 + 2] = (rand() - 0.5) * 0.15;
    sparkVel[i] = 0.12 + rand() * 0.25;
  };
  for (let i = 0; i < SPARKS; i++) resetSpark(i, true);
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(
    sparkGeo,
    new THREE.PointsMaterial({
      color: new THREE.Color(3, 1.2, 0.3),
      size: 0.01,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sparks.position.set(0, fireY, fireZ);
  group.add(sparks);

  // The fire's light, just in front of the door so it reaches the room.
  const light = new THREE.PointLight(0xff8a3a, FIRE_POWER, 0, 2);
  const lightBase = new THREE.Vector3(0, fireY + 0.15, BOX_D + 0.12);
  // No shadows: a cube shadow map redraws the scene six times a frame, and the
  // lamp over the table already gives the board its shadows.
  light.position.copy(lightBase);
  group.add(light);


  const toCamera = new THREE.Vector3();
  return {
    group,
    update(time, dt, camera) {
      // Layered sines at unrelated frequencies read as a natural flicker.
      const f =
        0.75 + 0.12 * Math.sin(time * 7.3) + 0.08 * Math.sin(time * 13.1 + 1.3) + 0.05 * Math.sin(time * 23.7 + 0.4);
      light.intensity = FIRE_POWER * f;
      light.position.set(lightBase.x + Math.sin(time * 5.1) * 0.03, lightBase.y + Math.sin(time * 6.7) * 0.02, lightBase.z);
      bark.emissiveIntensity = 0.12 + 0.1 * f;
      for (const mat of flameMats) mat.uniforms.uTime!.value = time;

      // Billboard the flames around the vertical axis.
      flames.getWorldPosition(toCamera);
      toCamera.subVectors(camera.position, toCamera);
      flames.rotation.y = Math.atan2(toCamera.x, toCamera.z);

      for (let i = 0; i < SPARKS; i++) {
        const y = sparkPos[i * 3 + 1]! + sparkVel[i]! * dt;
        sparkPos[i * 3 + 1] = y;
        sparkPos[i * 3] = sparkPos[i * 3]! + Math.sin(time * 3 + i) * 0.02 * dt;
        if (y > OPEN_H * 0.9) resetSpark(i, false);
      }
      sparkGeo.attributes.position!.needsUpdate = true;
    },
  };
}

/**
 * Logs stacked end-on (pointing along z), filling a w x h box whose bottom
 * centre is at (x, y, z).
 */
export function logStack(
  w: number,
  h: number,
  depth: number,
  x: number,
  y: number,
  z: number,
  seed: number,
): THREE.InstancedMesh {
  const rand = rng(seed);
  const barkTex = woodTexture(22, 20, seed + 100);
  barkTex.rotation = Math.PI / 2;
  const bark = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1 });
  const ends = new THREE.MeshStandardMaterial({ map: endGrainTexture(seed), roughness: 0.95 });
  const geo = new THREE.CylinderGeometry(1, 1, 1, 9);
  geo.rotateX(Math.PI / 2);

  const slots: [number, number, number][] = [];
  const r0 = 0.055;
  let row = 0;
  for (let cy = r0; cy + r0 * 0.6 < h; cy += r0 * 1.75, row++) {
    for (let cx = -w / 2 + r0 + (row % 2) * r0; cx + r0 * 0.8 < w / 2; cx += r0 * 2) {
      slots.push([cx, cy, r0 * (0.8 + rand() * 0.35)]);
    }
  }
  // Cylinder groups: 0 is the side, 1 and 2 are the caps.
  const mesh = new THREE.InstancedMesh(geo, [bark, ends, ends], slots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const color = new THREE.Color();
  slots.forEach(([cx, cy, r], i) => {
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.06, rand() * 6));
    m.compose(p.set(x + cx, y + cy, z + (rand() - 0.5) * 0.04), q, s.set(r, r, depth * (0.92 + rand() * 0.1)));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, color.setScalar(0.75 + rand() * 0.3));
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
