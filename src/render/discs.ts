import * as THREE from 'three';
import type { Cell, Player } from '../core/game';
import { DISC_RADIUS, DISC_THICKNESS, GHOST_Y, cellPosition } from './board';

export const PLAYER_COLORS: Record<Player, number> = { 0: 0xc8161d, 1: 0xf5b800 };

const GRAVITY = 5; // m/s², a little under real gravity so the drop reads well
const RESTITUTION = 0.3;

/** A disc with a raised rim and a recessed centre on both faces, facing +z. */
function discGeometry(): THREE.BufferGeometry {
  const r = DISC_RADIUS;
  const h = DISC_THICKNESS / 2;
  const e = 0.0011;
  const profile = [
    [0, -h + e],
    [r * 0.7, -h + e],
    [r * 0.74, -h],
    [r - e, -h],
    [r, -h + e],
    [r, h - e],
    [r - e, h],
    [r * 0.74, h],
    [r * 0.7, h - e],
    [0, h - e],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(profile, 48);
  geo.rotateX(Math.PI / 2);
  return geo;
}

function discMaterial(player: Player): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: PLAYER_COLORS[player],
    roughness: 0.3,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
  });
}

interface Animation {
  /** Advances by dt seconds; returns true when finished. */
  step(dt: number): boolean;
  /** Called once, when the animation finishes or is cut short. */
  done(): void;
}

/** Discs on the board, the hover preview disc, and their animations. */
export class Discs {
  readonly group = new THREE.Group();
  private geometry = discGeometry();
  private placed: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[] = [];
  private winners: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>[] = [];
  private animations = new Set<Animation>();
  private ghost: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  private ghostTargetX = 0;
  private time = 0;

  constructor() {
    this.ghost = new THREE.Mesh(this.geometry, discMaterial(0));
    this.ghost.material.transparent = true;
    this.ghost.material.opacity = 0.75;
    this.ghost.castShadow = true;
    this.ghost.visible = false;
    this.ghost.position.y = GHOST_Y;
    this.group.add(this.ghost);
  }

  /** Shows the preview disc above a column, or hides it with null. */
  showGhost(col: number | null, player: Player): void {
    if (col === null) {
      this.ghost.visible = false;
      return;
    }
    const x = cellPosition(col, 0).x;
    if (!this.ghost.visible) this.ghost.position.x = x;
    this.ghostTargetX = x;
    this.ghost.material.color.setHex(PLAYER_COLORS[player]);
    this.ghost.visible = true;
  }

  /** Drops a disc into a cell; resolves when it has stopped bouncing. */
  drop(cell: Cell, player: Player): Promise<void> {
    const mesh = new THREE.Mesh(this.geometry, discMaterial(player));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const target = cellPosition(cell.col, cell.row);
    // Start from the preview disc when it is over this column, so the move reads as one motion.
    const fromGhost = this.ghost.visible && Math.abs(this.ghost.position.x - target.x) < 0.01;
    mesh.position.set(target.x, fromGhost ? this.ghost.position.y : GHOST_Y, 0);
    this.ghost.visible = false;
    this.group.add(mesh);
    this.placed.push(mesh);

    let vy = 0;
    let bounces = 0;
    return this.animate({
      step: (dt) => {
        vy -= GRAVITY * dt;
        mesh.position.y += vy * dt;
        if (mesh.position.y > target.y) return false;
        mesh.position.y = target.y;
        vy = -vy * RESTITUTION;
        return ++bounces > 3 || vy < 0.06;
      },
      done: () => {
        mesh.position.y = target.y;
      },
    });
  }

  /** Makes the winning discs pulse. */
  highlight(cells: readonly Cell[]): void {
    const p = new THREE.Vector3();
    this.winners = this.placed.filter((m) =>
      cells.some((c) => cellPosition(c.col, c.row, p).distanceToSquared(m.position) < 1e-6),
    );
    for (const m of this.winners) m.material.emissive.copy(m.material.color);
  }

  /** Fades all discs out; resolves when they are gone. Safe to call while discs are still falling. */
  clear(): Promise<void> {
    for (const a of this.animations) a.done();
    this.animations.clear();
    const leaving = this.placed;
    this.placed = [];
    this.winners = [];
    this.ghost.visible = false;
    if (leaving.length === 0) return Promise.resolve();

    for (const m of leaving) {
      m.material.transparent = true;
      m.material.emissiveIntensity = 0;
      m.castShadow = false;
    }
    let t = 0;
    const duration = 0.45;
    return this.animate({
      step: (dt) => {
        t += dt;
        const k = Math.min(1, t / duration);
        for (const m of leaving) {
          m.material.opacity = 1 - k;
          m.position.y -= dt * 0.15;
        }
        return k >= 1;
      },
      done: () => {
        for (const m of leaving) {
          this.group.remove(m);
          m.material.dispose();
        }
      },
    });
  }

  update(dt: number): void {
    this.time += dt;
    this.ghost.position.x += (this.ghostTargetX - this.ghost.position.x) * Math.min(1, dt * 18);
    this.ghost.position.y = GHOST_Y + Math.sin(this.time * 3) * 0.002;

    const glow = 0.35 + 0.3 * Math.sin(this.time * 5);
    for (const m of this.winners) m.material.emissiveIntensity = glow;

    for (const a of this.animations) {
      if (a.step(dt)) {
        this.animations.delete(a);
        a.done();
      }
    }
  }

  private animate(a: Animation): Promise<void> {
    return new Promise((resolve) => {
      const done = a.done;
      this.animations.add({
        step: a.step,
        done: () => {
          done();
          resolve();
        },
      });
    });
  }
}
