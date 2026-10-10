import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLS, ROWS } from '../core/bitboard';

/**
 * Board dimensions in metres, in the board's local space: x across the
 * columns (centred on 0), y up from the table top, z towards the player.
 * Discs slide down the gap between a front and a back plate.
 */
export const CELL = 0.042;
export const DISC_RADIUS = 0.0175;
export const DISC_THICKNESS = 0.0075;
const HOLE_RADIUS = 0.0155;
const GAP = DISC_THICKNESS + 0.002;
const PLATE = 0.004;
const BEVEL = 0.0012;
const MARGIN = 0.014;
const GRID_BOTTOM = 0.05;
export const GRID_TOP = GRID_BOTTOM + ROWS * CELL;
const HALF_WIDTH = (COLS / 2) * CELL + MARGIN;
const RAIL = 0.012;

/** Centre of a cell in board-local coordinates; row 0 is the bottom. */
export function cellPosition(col: number, row: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set((col - (COLS - 1) / 2) * CELL, GRID_BOTTOM + CELL / 2 + row * CELL, 0);
}

/** Height a disc hovers at before it is dropped. */
export const GHOST_Y = GRID_TOP + 0.04;

/** Centre and size of the whole board, for framing the camera. */
export const BOARD_CENTER_Y = (GRID_TOP + MARGIN) / 2;
export const BOARD_SIZE = { width: HALF_WIDTH * 2 + RAIL * 2, height: GRID_TOP + MARGIN };

export interface Board {
  group: THREE.Group;
  /** Invisible boxes, one per column (userData.col), for picking a column with the pointer. */
  hitBoxes: THREE.Mesh[];
}

export function createBoard(): Board {
  const group = new THREE.Group();
  group.name = 'board';

  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0x1d4fc4,
    roughness: 0.32,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
  });

  // Front and back plates: a rectangle with one hole per cell.
  const shape = new THREE.Shape();
  shape.moveTo(-HALF_WIDTH, GRID_BOTTOM - MARGIN);
  shape.lineTo(HALF_WIDTH, GRID_BOTTOM - MARGIN);
  shape.lineTo(HALF_WIDTH, GRID_TOP + MARGIN * 0.5);
  shape.lineTo(-HALF_WIDTH, GRID_TOP + MARGIN * 0.5);
  shape.closePath();
  const p = new THREE.Vector3();
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      cellPosition(c, r, p);
      const hole = new THREE.Path();
      hole.absarc(p.x, p.y, HOLE_RADIUS, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  }
  const plateGeo = new THREE.ExtrudeGeometry(shape, {
    depth: PLATE,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 2,
    curveSegments: 28,
  });
  const front = new THREE.Mesh(plateGeo, plastic);
  front.position.z = GAP / 2 + BEVEL;
  const back = new THREE.Mesh(plateGeo, plastic);
  back.position.z = -GAP / 2 - PLATE - BEVEL;
  group.add(front, back);

  // Spacers inside the gap: column dividers and the floor the bottom row rests on.
  const dividerGeo = new THREE.BoxGeometry(0.002, ROWS * CELL, GAP);
  for (let c = 1; c < COLS; c++) {
    const d = new THREE.Mesh(dividerGeo, plastic);
    d.position.set((c - COLS / 2) * CELL, GRID_BOTTOM + (ROWS * CELL) / 2, 0);
    group.add(d);
  }
  const floorTop = GRID_BOTTOM + CELL / 2 - DISC_RADIUS;
  const floorH = floorTop - (GRID_BOTTOM - MARGIN);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(HALF_WIDTH * 2, floorH, GAP), plastic);
  floor.position.set(0, floorTop - floorH / 2, 0);
  group.add(floor);

  // Side rails down to the table, with feet.
  const railH = GRID_TOP + MARGIN * 0.5 + 0.006;
  const railGeo = new RoundedBoxGeometry(RAIL, railH, GAP + PLATE * 2 + 0.012, 2, 0.003);
  const footGeo = new RoundedBoxGeometry(RAIL * 2.2, 0.014, 0.17, 2, 0.005);
  for (const side of [-1, 1]) {
    const x = side * (HALF_WIDTH + RAIL / 2);
    const rail = new THREE.Mesh(railGeo, plastic);
    rail.position.set(x, railH / 2, 0);
    const foot = new THREE.Mesh(footGeo, plastic);
    foot.position.set(x, 0.007, 0);
    group.add(rail, foot);
  }

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Column pick targets cover the column plus the space above it.
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitH = GHOST_Y + 0.05 - GRID_BOTTOM;
  const hitGeo = new THREE.BoxGeometry(CELL, hitH, 0.08);
  const hitBoxes: THREE.Mesh[] = [];
  for (let c = 0; c < COLS; c++) {
    const box = new THREE.Mesh(hitGeo, hitMat);
    box.position.set(cellPosition(c, 0).x, GRID_BOTTOM + hitH / 2, 0);
    box.userData.col = c;
    hitBoxes.push(box);
    group.add(box);
  }

  return { group, hitBoxes };
}
