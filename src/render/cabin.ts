import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { metricBox, pbr, projectUVs } from './assets';

/**
 * Interior bounds of the room in metres. The coffee table stands at the
 * origin and the big window is the back wall, towards -z.
 */
export const ROOM = { minX: -2.9, maxX: 2.4, minZ: -3.6, maxZ: 3.2, height: 2.75 };
/** The glazed openings: the back wall from x0 to the corner, and the right wall from the corner to z1. */
export const WINDOW = { x0: -1.95, z1: -1.75, y0: 0.06, y1: 2.42 };
const WALL_T = 0.16;
/** The ceiling and its boards run out past the glass as a roof overhang. */
export const OVERHANG = 1.5;

export interface Cabin {
  group: THREE.Group;
  /** Window glass, whose reflection map is filled in once the room has been captured. */
  glass: THREE.ShaderMaterial;
}

const glassVertex = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
// Reflection only, added on top of the view: a dark room behind the camera
// reflects little, the lamps and the fire reflect clearly.
const glassFragment = /* glsl */ `
  uniform samplerCube uEnv;
  uniform float uStrength;
  uniform vec3 uCapturePos;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  void main() {
    vec3 v = normalize(vWorldPos - cameraPosition);
    vec3 n = normalize(vNormal);
    if (dot(n, v) > 0.0) n = -n;
    vec3 r = reflect(v, n);
    // Crude parallax: look up the reflection from the reflected point's
    // direction as seen from where the room was captured.
    vec3 p = vWorldPos + r * 2.6;
    vec3 dir = normalize(p - uCapturePos);
    float cosT = clamp(-dot(v, n), 0.0, 1.0);
    float fresnel = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);
    vec3 col = textureCube(uEnv, dir).rgb;
    gl_FragColor = vec4(col * fresnel * uStrength, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Pine-panelled room with floor-to-ceiling glass on two sides, oak floor and a wool rug. */
export function createCabin(): Cabin {
  const group = new THREE.Group();
  group.name = 'cabin';
  const { minX, maxX, minZ, maxZ, height } = ROOM;
  const { x0, z1, y0, y1 } = WINDOW;

  // Pale hinoki boards stained a warm honey; turned so they run vertically
  // on the walls and towards the window on the ceiling.
  const boards = pbr('hinoki_planks', { size: 1.4, rotation: Math.PI / 2, color: 0xc2ab94, normalScale: 0.8 });
  const ceilingBoards = pbr('hinoki_planks', { size: 1.4, rotation: Math.PI / 2, color: 0xbea088, normalScale: 0.8 });
  const darkWood = pbr('hinoki_planks', { size: 1.4, color: 0x4a3a2e, roughness: 0.9 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x0c0c0d, metalness: 0.4, roughness: 0.55 });

  const box = (mat: THREE.Material, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(metricBox(w, h, d), mat);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // Floor: light oak boards running towards the window.
  const floor = box(
    pbr('laminate_floor_02', { size: 1.7, rotation: Math.PI / 2, color: 0xc4ab90, normalScale: 0.6 }),
    maxX - minX,
    0.05,
    maxZ - minZ,
    (minX + maxX) / 2,
    -0.025,
    (minZ + maxZ) / 2,
  );
  floor.name = 'floor';

  // A low wool rug under the table.
  const rugMat = pbr('rough_linen', { size: 0.27, color: 0xb4a593, noMap: true, normalScale: 1.2 });
  const rug = new THREE.Mesh(projectUVs(new RoundedBoxGeometry(2.7, 0.014, 1.9, 2, 0.006)), rugMat);
  rug.position.set(-0.05, 0.007, -0.35);
  rug.receiveShadow = true;
  group.add(rug);

  // Solid walls: left, front (behind the player), and the right wall in front of the side window.
  box(boards, WALL_T, height, maxZ - minZ, minX - WALL_T / 2, height / 2, (minZ + maxZ) / 2);
  box(boards, maxX - minX, height, WALL_T, (minX + maxX) / 2, height / 2, maxZ + WALL_T / 2);
  box(boards, WALL_T, height, maxZ - z1, maxX + WALL_T / 2, height / 2, (z1 + maxZ) / 2);
  // Back wall beside the window, and the headers above both openings.
  box(boards, x0 - minX, height, WALL_T, (minX + x0) / 2, height / 2, minZ - WALL_T / 2);
  box(boards, maxX - x0 + WALL_T, height - y1, WALL_T, (x0 + maxX + WALL_T) / 2, (y1 + height) / 2, minZ - WALL_T / 2);
  box(boards, WALL_T, height - y1, z1 - minZ, maxX + WALL_T / 2, (y1 + height) / 2, (minZ + z1) / 2);

  // Ceiling, running out over the deck as a roof overhang.
  const ceilD = maxZ - minZ + OVERHANG;
  box(ceilingBoards, maxX - minX + 0.6, 0.06, ceilD, (minX + maxX) / 2 + 0.3, height + 0.03, maxZ - ceilD / 2);
  box(darkWood, maxX - minX + 0.6, 0.22, 0.05, (minX + maxX) / 2 + 0.3, height - 0.05, minZ - OVERHANG);

  // Black steel window frames: sill, head, jambs and the corner post.
  const frame = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const m = box(steel, w, h, d, x, y, z);
    m.castShadow = false;
  };
  const F = 0.06;
  const glassZ = minZ - WALL_T / 2;
  const glassX = maxX + WALL_T / 2;
  frame(maxX - x0, F, WALL_T + 0.02, (x0 + maxX) / 2, y0 - F / 2 + 0.02, glassZ);
  frame(maxX - x0, F, WALL_T + 0.02, (x0 + maxX) / 2, y1 + F / 2 - 0.02, glassZ);
  frame(F, y1 - y0, WALL_T + 0.02, x0 + F / 2, (y0 + y1) / 2, glassZ);
  frame(WALL_T + 0.02, F, z1 - minZ, glassX, y0 - F / 2 + 0.02, (minZ + z1) / 2);
  frame(WALL_T + 0.02, F, z1 - minZ, glassX, y1 + F / 2 - 0.02, (minZ + z1) / 2);
  frame(WALL_T + 0.02, y1 - y0, F, glassX, (y0 + y1) / 2, z1 - F / 2);
  frame(0.11, height, 0.11, maxX + 0.02, height / 2, minZ - 0.02);

  // Glass: reflection-only sheets, blended on top of the view outside.
  const glass = new THREE.ShaderMaterial({
    vertexShader: glassVertex,
    fragmentShader: glassFragment,
    uniforms: {
      uEnv: { value: null },
      uStrength: { value: 0 },
      uCapturePos: { value: new THREE.Vector3() },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(maxX - x0, y1 - y0), glass);
  back.position.set((x0 + maxX) / 2, (y0 + y1) / 2, glassZ);
  const side = new THREE.Mesh(new THREE.PlaneGeometry(z1 - minZ, y1 - y0), glass);
  side.rotation.y = -Math.PI / 2;
  side.position.set(glassX, (y0 + y1) / 2, (minZ + z1) / 2);
  back.renderOrder = side.renderOrder = 5;
  group.add(back, side);

  group.add(createDownlights());
  group.add(createPicture());
  return { group, glass };
}

/** Positions of the recessed ceiling lights, shared with the lighting. */
export const DOWNLIGHTS: [number, number][] = [
  [-1.3, -2.3],
  [1.2, -2.3],
  [-1.3, 0.4],
  [0.35, 0.5],
  [1.2, 1.6],
  [-1.0, -4.3],
  [1.3, -4.3],
];

function createDownlights(): THREE.Group {
  const lights = new THREE.Group();
  const trim = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
  const lens = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 1.3) });
  const ring = new THREE.CylinderGeometry(0.045, 0.045, 0.012, 24);
  const disc = new THREE.CircleGeometry(0.03, 20);
  for (const [x, z] of DOWNLIGHTS) {
    const r = new THREE.Mesh(ring, trim);
    r.position.set(x, ROOM.height - 0.002, z);
    const l = new THREE.Mesh(disc, lens);
    l.rotation.x = Math.PI / 2;
    l.position.set(x, ROOM.height - 0.009, z);
    lights.add(r, l);
  }
  return lights;
}

/** A framed print of a snowy peak on the right wall. */
function createPicture(): THREE.Group {
  const pic = new THREE.Group();
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 340;
  const ctx = c.getContext('2d')!;
  const sky = ctx.createLinearGradient(0, 0, 0, 340);
  sky.addColorStop(0, '#5d6f86');
  sky.addColorStop(1, '#c9d2dc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 256, 340);
  ctx.fillStyle = '#e9edf1';
  ctx.beginPath();
  ctx.moveTo(0, 250);
  ctx.lineTo(70, 150);
  ctx.lineTo(110, 175);
  ctx.lineTo(170, 90);
  ctx.lineTo(256, 210);
  ctx.lineTo(256, 340);
  ctx.lineTo(0, 340);
  ctx.fill();
  ctx.fillStyle = '#6f7884';
  for (let i = 0; i < 40; i++) {
    const x = 60 + Math.random() * 160;
    ctx.fillRect(x, 120 + Math.abs(x - 170) * 0.9 + Math.random() * 40, 2, 10 + Math.random() * 20);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const art = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.74), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  art.position.z = 0.016;
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.6 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.84, 0.03), frameMat);
  pic.add(frame, art);
  pic.rotation.y = -Math.PI / 2;
  pic.position.set(ROOM.maxX - 0.02, 1.62, -0.9);
  return pic;
}
