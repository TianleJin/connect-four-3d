import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Cell, Player } from '../core/game';
import { allLoaded, skyHdr } from './assets';
import { BOARD_CENTER_Y, BOARD_SIZE, createBoard } from './board';
import { ROOM, createCabin, type Cabin } from './cabin';
import { Discs } from './discs';
import { createFireplace, type Fireplace } from './fireplace';
import { ColumnInput } from './input';
import { createLighting } from './lighting';
import { HAZE, createOutdoors, type Outdoors } from './outdoors';
import { createBasket, createFloorLamp, createLeftWallFurniture, createLoungeChair, createSofa } from './props';
import { TABLE_TOP, createTable, type Table } from './table';

const FOV = 50;
/**
 * Default viewpoint, as in the reference photo: seated at the coffee table,
 * looking straight at the stove and the window. Relative to the board's centre.
 */
const VIEW_OFFSET = new THREE.Vector3(0, 0.34, 1.4);
/** Where the interior environment (reflections and bounce light) is captured from. */
const CAPTURE_POS = new THREE.Vector3(0.2, 1.2, -0.8);

/**
 * The 3D view: cabin, table, board and discs. Knows the board and its cells
 * but nothing about rules or the bot; main.ts drives it.
 */
export class BoardScene {
  /** Called when the player picks a column while input is enabled. */
  onColumnSelect: (col: number) => void = () => {};

  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 1, 0.03, 2500);
  private controls: OrbitControls;
  private discs = new Discs();
  private cabin: Cabin;
  private table: Table;
  private fireplace: Fireplace;
  private outdoors: Outdoors;
  private updaters: ((time: number) => void)[] = [];
  private input: ColumnInput;
  private target = new THREE.Vector3(0, TABLE_TOP + BOARD_CENTER_Y, 0);
  private inputPlayer: Player | null = null;
  private canPlay: (col: number) => boolean = () => false;
  private lastTime = performance.now();
  private time = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    container.appendChild(this.renderer.domElement);

    this.scene.background = HAZE.clone();
    // Aerial perspective: only the far valley and the mountains pick up haze.
    this.scene.fog = new THREE.Fog(HAZE, 40, 1900);
    this.outdoors = createOutdoors();
    this.cabin = createCabin();
    this.table = createTable();
    this.scene.add(this.outdoors.group, this.cabin.group, this.table.group, createLighting());
    this.fireplace = createFireplace(0);
    this.scene.add(this.fireplace.group);
    this.addFurniture();

    const board = createBoard();
    board.group.position.y = TABLE_TOP;
    board.group.add(this.discs.group);
    this.scene.add(board.group);

    // Post-processing renders into a multisampled HDR target, so bloom picks out the fire.
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.5, 1.2);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.target);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.minPolarAngle = Math.PI * 0.3;
    this.controls.maxPolarAngle = Math.PI * 0.5;
    this.controls.minAzimuthAngle = -Math.PI * 0.26;
    this.controls.maxAzimuthAngle = Math.PI * 0.26;

    this.input = new ColumnInput(this.renderer.domElement, this.camera, board.hitBoxes, {
      onHover: () => this.updateGhost(),
      onSelect: (col) => {
        if (this.inputPlayer !== null && this.canPlay(col)) this.onColumnSelect(col);
      },
    });

    this.resize();
    new ResizeObserver(() => this.resize()).observe(container);
    this.renderer.setAnimationLoop(() => this.frame());
    void this.bakeEnvironment();
    // Handle for inspecting the scene from the browser console during development.
    if (import.meta.env.DEV) Object.assign(window, { __view: { scene: this.scene, camera: this.camera, controls: this.controls, renderer: this.renderer, frame: () => this.frame() } });
  }

  /** Lets `player` pick a column (preview disc and clicks), or turns input off with null. */
  setInput(player: Player | null, canPlay: (col: number) => boolean = () => false): void {
    this.inputPlayer = player;
    this.canPlay = canPlay;
    this.updateGhost();
  }

  dropDisc(cell: Cell, player: Player): Promise<void> {
    return this.discs.drop(cell, player);
  }

  highlightWin(cells: readonly Cell[]): void {
    this.discs.highlight(cells);
  }

  clearBoard(): Promise<void> {
    return this.discs.clear();
  }

  private addFurniture(): void {
    const sofa = createSofa();
    sofa.rotation.y = -Math.PI / 2;
    sofa.position.set(ROOM.maxX - 0.52, 0, -0.35);
    const chair = createLoungeChair();
    chair.position.set(-1.45, 0, -0.75);
    chair.rotation.y = 0.75;
    const basket = createBasket();
    basket.position.set(0.72, 0, ROOM.minZ + 0.75);
    basket.rotation.y = 0.3;
    const left = createLeftWallFurniture();
    this.updaters.push(left.update, this.table.update);
    this.scene.add(sofa, chair, basket, left.group);

    for (const [x, z, h, power] of [
      [ROOM.minX + 0.45, -1.15, 1.42, 2.4],
      [-1.55, ROOM.minZ + 0.35, 1.3, 2],
    ] as [number, number, number, number][]) {
      const lamp = createFloorLamp(h, power);
      lamp.group.position.set(x, 0, z);
      this.scene.add(lamp.group);
    }
  }

  /**
   * Once everything has loaded: lights the outdoors with the sky HDR, then
   * captures the room into a cube map and uses it, filtered, as the
   * interior's environment, which stands in for bounce light and gives the
   * glossy things something real to reflect. Captured twice, so the second
   * capture includes the first bounce.
   */
  private async bakeEnvironment(): Promise<void> {
    const [sky] = await Promise.all([skyHdr(), allLoaded()]);
    this.outdoors.setSkyLight(sky);
    const cubeRT = new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(0.05, 2500, cubeRT);
    cubeCam.position.copy(CAPTURE_POS);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    let env: THREE.WebGLRenderTarget | null = null;
    for (let pass = 0; pass < 2; pass++) {
      this.discs.group.visible = false;
      cubeCam.update(this.renderer, this.scene);
      this.discs.group.visible = true;
      const next = pmrem.fromCubemap(cubeRT.texture);
      env?.dispose();
      env = next;
      this.scene.environment = env.texture;
    }
    pmrem.dispose();
    const glass = this.cabin.glass.uniforms;
    glass.uEnv!.value = cubeRT.texture;
    glass.uStrength!.value = 1;
    glass.uCapturePos!.value.copy(CAPTURE_POS);
  }

  private updateGhost(): void {
    const col = this.input.current;
    const show = this.inputPlayer !== null && col !== null && this.canPlay(col);
    this.discs.showGhost(show ? col : null, this.inputPlayer ?? 0);
  }

  /** Frames the board for the current aspect ratio, keeping the user's viewing angle. */
  private resize(): void {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);
    this.camera.aspect = w / h;
    // Shift the lens so the board sits low in the frame and the window,
    // stove and ceiling fill the rest, keeping verticals nearly upright.
    const shift = h > w ? Math.min(0.3, 0.2 + (h / w - 1) * 0.12) : 0.22;
    this.camera.setViewOffset(w, h, 0, -h * shift, w, h);
    this.camera.updateProjectionMatrix();

    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const fitW = (BOARD_SIZE.width * 2.2) / 2 / (tan * this.camera.aspect);
    const dist = Math.max(VIEW_OFFSET.length(), fitW);
    const dir =
      this.camera.position.lengthSq() > 0
        ? this.camera.position.clone().sub(this.target).normalize()
        : VIEW_OFFSET.clone().normalize();
    this.camera.position.copy(this.target).addScaledVector(dir, dist);
    this.controls.minDistance = 0.7;
    this.controls.maxDistance = Math.max(dist * 1.9, 2.4);
    this.controls.update();
  }

  private frame(): void {
    const now = performance.now();
    // Clamp so a background tab doesn't make discs jump when it comes back.
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.time += dt;

    this.controls.update();
    this.discs.update(dt);
    this.fireplace.update(this.time, dt, this.camera);
    this.outdoors.update(this.time, dt);
    for (const u of this.updaters) u(this.time);
    this.composer.render(dt);
  }
}
