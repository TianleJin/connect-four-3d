import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { DOWNLIGHTS, ROOM, WINDOW } from './cabin';
import { TABLE_TOP } from './table';

/** Luminance (nits) of the blue-hour sky as seen through the glass. */
const WINDOW_NITS = 3.5;
const SKY_LIGHT = 0x9db2d6;
/** Candela of each recessed ceiling light; they are dimmed for the evening. */
const DOWNLIGHT_CD = 3.5;

/**
 * Lighting apart from the fire, lamps and candles: the cool glow of the sky
 * coming in through both walls of glass, and warm recessed lights in the
 * ceiling. The one above the coffee table casts the board's shadows.
 */
export function createLighting(): THREE.Group {
  RectAreaLightUniformsLib.init();
  const group = new THREE.Group();
  group.name = 'lighting';
  const { minZ, maxX, height } = ROOM;
  const { x0, z1, y0, y1 } = WINDOW;

  const back = new THREE.RectAreaLight(SKY_LIGHT, WINDOW_NITS, maxX - x0, y1 - y0);
  back.position.set((x0 + maxX) / 2, (y0 + y1) / 2, minZ - 0.02);
  back.lookAt(back.position.x, back.position.y, 0);
  const side = new THREE.RectAreaLight(SKY_LIGHT, WINDOW_NITS * 0.8, z1 - minZ, y1 - y0);
  side.position.set(maxX + 0.02, (y0 + y1) / 2, (minZ + z1) / 2);
  side.lookAt(0, side.position.y, side.position.z);
  group.add(back, side);

  DOWNLIGHTS.forEach(([x, z], i) => {
    const outside = z < minZ;
    const spot = new THREE.SpotLight(0xffd2a0, outside ? DOWNLIGHT_CD * 1.6 : DOWNLIGHT_CD, 0, 0.62, 0.85, 2);
    spot.position.set(x, height - 0.02, z);
    spot.target.position.set(x, 0, z);
    // The light nearest the table casts the board's shadow.
    if (i === 3) {
      spot.castShadow = true;
      spot.shadow.mapSize.set(2048, 2048);
      spot.shadow.bias = -0.0002;
      spot.shadow.normalBias = 0.01;
      spot.shadow.radius = 4;
      spot.shadow.camera.near = 0.5;
      spot.shadow.camera.far = 4;
      spot.target.position.set(0, TABLE_TOP, 0);
    }
    group.add(spot, spot.target);
  });
  return group;
}
