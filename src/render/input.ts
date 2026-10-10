import * as THREE from 'three';
import { COLS } from '../core/bitboard';

export interface ColumnInputHandlers {
  /** The column under the pointer or keyboard cursor changed (null: none). */
  onHover(col: number | null): void;
  /** The player picked a column. */
  onSelect(col: number): void;
}

const TAP_SLOP_PX = 8;
const TAP_MAX_MS = 400;

/**
 * Turns pointer and keyboard input into column picks. A pointer press that
 * barely moves is a pick; anything larger is left to the orbit controls.
 * Keys: arrows move the cursor, Enter/Space/Down drops, 1-7 drop directly.
 */
export class ColumnInput {
  private raycaster = new THREE.Raycaster();
  private ndc = new THREE.Vector2();
  private down: { x: number; y: number; t: number; id: number } | null = null;
  private keyCol: number | null = null;
  private hovered: number | null = null;

  constructor(
    private element: HTMLElement,
    private camera: THREE.Camera,
    private targets: THREE.Object3D[],
    private handlers: ColumnInputHandlers,
  ) {
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('keydown', this.onKeyDown);
  }

  /** The column currently under the pointer or keyboard cursor. */
  get current(): number | null {
    return this.hovered;
  }

  private pick(e: PointerEvent): number | null {
    const rect = this.element.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.targets, false)[0];
    return hit ? (hit.object.userData.col as number) : null;
  }

  private setHover(col: number | null): void {
    if (col === this.hovered) return;
    this.hovered = col;
    this.handlers.onHover(col);
  }

  private onPointerMove = (e: PointerEvent) => {
    // Touch has no hover; a finger moving is orbiting the camera.
    if (e.pointerType === 'touch') return;
    if (this.down && e.buttons) return;
    this.keyCol = null;
    this.setHover(this.pick(e));
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    this.down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
  };

  private onPointerUp = (e: PointerEvent) => {
    const down = this.down;
    this.down = null;
    if (!down || down.id !== e.pointerId) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    if (moved > TAP_SLOP_PX || performance.now() - down.t > TAP_MAX_MS) return;
    const col = this.pick(e);
    if (col === null) return;
    if (e.pointerType !== 'touch') this.setHover(col);
    this.handlers.onSelect(col);
  };

  private onPointerLeave = () => {
    if (this.keyCol === null) this.setHover(null);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, button, select, textarea, dialog')) return;
    const digit = Number(e.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= COLS) {
      this.keyCol = digit - 1;
      this.setHover(this.keyCol);
      this.handlers.onSelect(this.keyCol);
      return;
    }
    const start = this.hovered ?? Math.floor(COLS / 2);
    switch (e.key) {
      case 'ArrowLeft':
        this.keyCol = this.hovered === null ? start : Math.max(0, start - 1);
        this.setHover(this.keyCol);
        break;
      case 'ArrowRight':
        this.keyCol = this.hovered === null ? start : Math.min(COLS - 1, start + 1);
        this.setHover(this.keyCol);
        break;
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        if (this.hovered === null) {
          this.keyCol = start;
          this.setHover(start);
        } else {
          this.handlers.onSelect(this.hovered);
        }
        break;
      default:
        return;
    }
    e.preventDefault();
  };
}
