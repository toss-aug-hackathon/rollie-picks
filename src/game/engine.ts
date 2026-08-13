import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { gsap } from 'gsap';
import { createCourse } from './course';
import { triggerHaptic } from '../utils/feedback';

const WIDTH = 390;
const HEIGHT = 844;
const START_LINE_Y = 360;
const START_Y = START_LINE_Y - 55;
const FLOOR_Y = 2350;
const COURSE_HEIGHT = 2800;
const RACE_RUSH_TIME = 40;
const RACE_LIMIT = 58;
const ROLL_SPEED = 1.3;
const CATCH_UP_GAP = 48;
const CATCH_UP_BOOST = 1.24;
const NIGHT_START = 19;
const NIGHT_END = 6;
const WALL_Z = -5;
const GRIP_Z = WALL_Z + 10;
const RACER_GAP_X = 78;
const EDGE_SOFT_LIMIT = 145;
const EDGE_INWARD_FORCE = 18;
const MOLE_UP_TIME = 3;
const GHOST_FLY_TIME = 6;
const GHOST_SPEED = 155;
const RIVER_TOP_Y = 1350;
const RIVER_BOTTOM_Y = 1780;
const BRIDGE_HALF_WIDTH = 64;
const WATER_SPEED = 0.72;
const RACER_TOP_CLEARANCE = 50;
const DRAG_VISUAL_Z_OFFSET = 40;
const PLACEMENT_SETTLE_DURATION = 0.22;
const FINISH_RESULT_DELAY = 800;

const PLACEMENT_PARTS = [
  { x: 0, y: 25, rx: 22, ry: 20 },
  { x: 0, y: -3, rx: 19, ry: 25 },
  { x: -23, y: 13, rx: 16, ry: 10 },
  { x: 23, y: 13, rx: 16, ry: 10 },
  { x: -10, y: -32, rx: 10, ry: 18 },
  { x: 10, y: -32, rx: 10, ry: 18 }
];

export type CharacterKey = 'bear' | 'rabbit' | 'cat' | 'duck' | 'turtle' | 'dog' | 'fox' | 'panda' | 'pig' | 'hamster';
export type ThemeMode = 'auto' | 'day' | 'night';
export type CharacterPreviewMap = Partial<Record<CharacterKey | `${CharacterKey}-result`, string>>;

export interface RacerInfo {
  name: string;
  characterKey: CharacterKey;
}

export interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  onTimerUpdate: (timeStr: string) => void;
  onStatusUpdate: (status: string) => void;
  onProgressUpdate?: (progress: number) => void;
  onCountdownUpdate: (countStr: string, visible: boolean) => void;
  onPlayerLabelsUpdate: (labels: any[]) => void;
  onFinish: (winnerName: string, winnerChar: CharacterKey, winnerSpeech: string, rankings: any[]) => void;
  onCharacterPreviewsReady?: (previews: CharacterPreviewMap) => void;
}

export const CHARACTER_DATA: Record<CharacterKey, { name: string; icon: string; preview: string; modelType: CharacterKey }> = {
  bear: { name: '곰', icon: '🐻', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'bear' },
  rabbit: { name: '토끼', icon: '🐰', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'rabbit' },
  cat: { name: '고양이', icon: '🐱', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'cat' },
  duck: { name: '오리', icon: '🐥', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'duck' },
  turtle: { name: '거북이', icon: '🐢', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'turtle' },
  dog: { name: '강아지', icon: '🐶', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'dog' },
  fox: { name: '여우', icon: '🦊', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'fox' },
  panda: { name: '판다', icon: '🐼', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'panda' },
  pig: { name: '돼지', icon: '🐷', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'pig' },
  hamster: { name: '햄스터', icon: '🐹', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'hamster' }
};

const COLORS: Record<CharacterKey, number> = {
  bear: 0xc6a27f,
  rabbit: 0xeee7cf,
  cat: 0x302e38,
  duck: 0xf1cd58,
  turtle: 0x8eb879,
  dog: 0xc99462,
  fox: 0xd96b36,
  panda: 0xf0eee7,
  pig: 0xe9a2aa,
  hamster: 0xd9a65d
};
const PAD_POINTS = [
  new THREE.Vector3(-27, 27, 0),
  new THREE.Vector3(27, 27, 0),
  new THREE.Vector3(-18, -35, 0),
  new THREE.Vector3(18, -35, 0)
];
const START_PADS = [[0, 1, 2, 3], [1, 0, 3, 2], [0, 1, 2, 3], [1, 0, 3, 2]];

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private options: GameEngineOptions;

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private world!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;

  private isInitialized = false;
  private isDestroyed = false;
  private running = false;
  private finished = false;
  private cameraY = 0;
  private raceElapsed = 0;
  private raceStartedAt = 0;
  private soundEnabled = true;
  private hapticEnabled = true;
  private audioContext: AudioContext | undefined;
  private resumeAudioAfterVisibility = false;
  private themeMode: ThemeMode = 'day';
  private activeTheme: 'day' | 'night' = 'day';

  private courseWall?: THREE.Mesh;
  private courseMarkers?: THREE.Object3D;
  private courseNightMarkers?: THREE.Object3D;
  private courseFinishLine?: THREE.Object3D;
  private dayCourseTexture?: THREE.Texture;
  private nightCourseTexture?: THREE.Texture;

  private hemisphereLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private racers: any[] = [];
  private colliderRacers = new Map<number, number>();
  private mole: any;
  private animFrameId: number | null = null;
  private resizeObserver?: ResizeObserver;
  private fabricTexture!: THREE.Texture;
  private sphereGeometry = new THREE.SphereGeometry(1, 16, 10);
  private participantData: RacerInfo[] = [
    { name: '곰', characterKey: 'bear' },
    { name: '토끼', characterKey: 'rabbit' },
    { name: '고양이', characterKey: 'cat' },
    { name: '오리', characterKey: 'duck' }
  ];
  private countdownToken = 0;
  private finishTimeoutId: number | null = null;
  private draggedRacer: any = null;
  private dragOrigin: { x: number; y: number } | null = null;
  private motionListening = false;
  private lastMotionMagnitude: number | undefined;
  private shakeBoostUntil = 0;
  private lastShakeAt = 0;
  private lastRacerImpactFeedbackAt = 0;

  constructor(options: GameEngineOptions) {
    this.canvas = options.canvas;
    this.options = options;
  }

  private screenToWorldY(screenY: number) {
    return HEIGHT / 2 - screenY;
  }

  private themeForMode(mode: string, hour = new Date().getHours()) {
    return mode === 'auto' ? (hour >= NIGHT_START || hour < NIGHT_END ? 'night' : 'day') : (mode as 'day' | 'night');
  }

  public async init() {
    if (this.isInitialized) return;

    await RAPIER.init();
    if (this.isDestroyed) return;
    this.world = new RAPIER.World({ x: 0, y: -520, z: 0 });
    this.world.timestep = 1 / 60;
    this.eventQueue = new RAPIER.EventQueue(true);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8de8ee);

    const width = this.canvas.clientWidth || WIDTH;
    const height = this.canvas.clientHeight || HEIGHT;

    this.camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 1000);
    this.camera.position.set(0, 0, 500);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x756477, 2.2);
    this.scene.add(this.hemisphereLight);

    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    this.keyLight.position.set(-160, 250, 300);
    this.scene.add(this.keyLight);

    this.fabricTexture = this.makeFabricTexture();

    // Create course boundaries
    const wallBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, this.screenToWorldY(COURSE_HEIGHT / 2), WALL_Z - 2));
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(WIDTH / 2, COURSE_HEIGHT / 2, 500).setTranslation(0, 0, -499).setFriction(0),
      wallBody
    );
    for (const side of [-1, 1]) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(4, COURSE_HEIGHT / 2, 40)
          .setTranslation(side * (WIDTH / 2 + 4), 0, 10)
          .setFriction(0),
        wallBody
      );
    }

    this.makeWall();
    this.mole = this.createMole();
    this.racers = ['bear', 'rabbit', 'cat', 'duck'].map((key, index) => this.createRacer(index, key as CharacterKey));
    this.options.onCharacterPreviewsReady?.(this.createCharacterPreviews());

    this.applyTheme(this.themeMode);
    this.resize();
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(this.canvas);
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.isInitialized = true;
    this.startLoop();
  }

  private makeFabricTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#eeeae2';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.lineCap = 'round';
    let seed = 731;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 1900; i += 1) {
      const x = random() * canvas.width;
      const y = random() * canvas.height;
      const length = 2.5 + random() * 7;
      const angle = random() * Math.PI * 2;
      const wave = (random() - 0.5) * 3.5;
      context.strokeStyle = i % 4 === 0 ? 'rgba(255,255,255,.9)' : i % 3 === 0 ? 'rgba(122,113,104,.48)' : 'rgba(174,165,154,.68)';
      context.lineWidth = 0.7 + random() * 1.2;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(
        x + Math.cos(angle) * length * 0.5 + Math.cos(angle + Math.PI / 2) * wave,
        y + Math.sin(angle) * length * 0.5 + Math.sin(angle + Math.PI / 2) * wave,
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length
      );
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2.2, 2.8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private makeWall() {
    const course = createCourse({
      width: WIDTH,
      courseHeight: COURSE_HEIGHT,
      startLineY: START_LINE_Y,
      floorY: FLOOR_Y,
      wallZ: WALL_Z,
      activeTheme: this.activeTheme,
      screenToWorldY: this.screenToWorldY.bind(this)
    });
    const { wall, markers, nightMarkers, finishLine, dayCourseTexture, nightCourseTexture } = course as any;
    this.courseWall = wall;
    this.courseMarkers = markers;
    this.courseNightMarkers = nightMarkers;
    this.courseFinishLine = finishLine;
    this.dayCourseTexture = dayCourseTexture;
    this.nightCourseTexture = nightCourseTexture;

    if (this.courseWall) {
      this.scene.add(this.courseWall);
    }
    if (this.courseMarkers) {
      this.scene.add(this.courseMarkers);
    }
    if (this.courseNightMarkers) {
      this.scene.add(this.courseNightMarkers);
    }
    if (this.courseFinishLine) {
      this.scene.add(this.courseFinishLine);
    }
  }

  private makeVisual(key: CharacterKey, targetScene = this.scene) {
    const group = new THREE.Group();
    const doll = new THREE.Group();
    const accents: THREE.Object3D[] = [];
    group.add(doll);
    const plushMaterial = (color: number) => new THREE.MeshPhysicalMaterial({
      color,
      map: this.fabricTexture,
      bumpMap: this.fabricTexture,
      bumpScale: 2.1,
      roughness: 0.96,
      sheen: 0.75,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(0xfff4e6)
    });
    const fur = plushMaterial(COLORS[key]);
    const creamFur = plushMaterial(0xeee1ca);
    const whiteFur = plushMaterial(0xf2eee5);
    const brownFur = plushMaterial(0x76503f);
    const blackFur = plushMaterial(0x302e34);
    const dark = new THREE.MeshBasicMaterial({ color: key === 'cat' ? 0xd8d6df : 0x332b30 });
    const pink = new THREE.MeshBasicMaterial({ color: 0xe89b9b });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe9873a, roughness: 0.9 });
    const paw = new THREE.MeshPhysicalMaterial({
      color: key === 'duck' ? 0xe99a47 : key === 'bear' ? 0xe8d4bf : key === 'turtle' ? 0xc5d891 : 0xe5a3a5,
      roughness: 0.32,
      clearcoat: 0.65,
      clearcoatRoughness: 0.28
    });

    const ball = (scale: [number, number, number], position: [number, number, number], material: THREE.Material = fur) => {
      const mesh = new THREE.Mesh(this.sphereGeometry, material);
      mesh.scale.set(...scale);
      mesh.position.set(...position);
      doll.add(mesh);
      return mesh;
    };
    const limb = (radius: number, length: number, position: [number, number, number], rotation: number) => {
      const geometry = new THREE.CapsuleGeometry(radius, length, 5, 10);
      const mesh = new THREE.Mesh(geometry, fur);
      mesh.position.set(...position);
      mesh.rotation.z = rotation;
      doll.add(mesh);
      return mesh;
    };
    const accentLimb = (
      radius: number,
      length: number,
      position: [number, number, number],
      rotation: number,
      material: THREE.Material
    ) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 5, 10), material);
      mesh.position.set(...position);
      mesh.rotation.z = rotation;
      doll.add(mesh);
      return mesh;
    };
    const pawPad = (
      limbCenter: [number, number, number],
      rotation: number,
      outward: 1 | -1,
      reach: number,
      size = 1
    ) => {
      const pad = new THREE.Group();
      pad.position.set(
        limbCenter[0] - Math.sin(rotation) * reach * outward,
        limbCenter[1] + Math.cos(rotation) * reach * outward,
        limbCenter[2]
      );
      pad.rotation.z = rotation;
      doll.add(pad);

      const center = new THREE.Mesh(this.sphereGeometry, paw);
      center.scale.set(3.8 * size, 3.8 * size, 3.2 * size);
      pad.add(center);
      return pad;
    };

    if (key === 'turtle') {
      const shell = new THREE.MeshPhysicalMaterial({ color: 0x557a43, map: this.fabricTexture, bumpMap: this.fabricTexture, bumpScale: 2.1, roughness: 0.96, sheen: 0.55, sheenRoughness: 0.9 });
      ball([26, 29, 8], [0, -3, -5], shell);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 24), new THREE.MeshStandardMaterial({ color: 0x355d37, roughness: 1 }));
      rim.scale.set(22, 25, 2);
      rim.position.set(0, -3, 4);
      doll.add(rim);
      accents.push(rim);
    }
    ball([19, 25, 11], [0, -3, 0]);
    ball([22, 20, 12], [0, 25, 0]);
    limb(7, 20, [-23, 13, 0], 0.78);
    limb(7, 20, [23, 13, 0], -0.78);
    limb(8, 18, [-10, -30, 0], -0.34);
    limb(8, 18, [10, -30, 0], 0.34);

    if (key === 'turtle') {
      ball([14, 18, 2], [0, -4, 10], paw);
      const bellyRim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 24), dark);
      bellyRim.scale.set(13, 17, 2);
      bellyRim.position.set(0, -4, 12.2);
      doll.add(bellyRim);
      accents.push(bellyRim);
    }

    if (key === 'bear') {
      ball([8, 8, 6], [-14, 43, 0]);
      ball([8, 8, 6], [14, 43, 0]);
    } else if (key === 'rabbit') {
      accents.push(limb(4.5, 19, [-7, 45, 0], -0.08), limb(4.5, 19, [7, 45, 0], 0.08));
    } else if (key === 'cat') {
      limb(5, 7, [-12, 39, 0], -0.25);
      limb(5, 7, [12, 39, 0], 0.25);
    } else if (key === 'dog') {
      accentLimb(5.5, 11, [-17, 38, -1], 0.48, brownFur);
      accentLimb(5.5, 11, [17, 38, -1], -0.48, brownFur);
      ball([9, 6.5, 2.2], [0, 21.5, 10.5], creamFur);
      ball([7, 9, 1.5], [-10, 30, 10.3], brownFur);
    } else if (key === 'fox') {
      accentLimb(5.5, 12, [-12, 42, 0], -0.22, fur);
      accentLimb(5.5, 12, [12, 42, 0], 0.22, fur);
      ball([7.5, 6.5, 2], [-6, 21.5, 10.6], whiteFur);
      ball([7.5, 6.5, 2], [6, 21.5, 10.6], whiteFur);
      ball([10, 14, 2], [0, -5, 10], whiteFur);
    } else if (key === 'panda') {
      ball([8, 8, 6], [-14, 43, 0], blackFur);
      ball([8, 8, 6], [14, 43, 0], blackFur);
      const leftPatch = ball([6.3, 8, 1.2], [-7, 29, 10.1], blackFur);
      const rightPatch = ball([6.3, 8, 1.2], [7, 29, 10.1], blackFur);
      leftPatch.rotation.z = -0.35;
      rightPatch.rotation.z = 0.35;
      ball([10, 13, 2], [0, -4, 10], blackFur);
    } else if (key === 'pig') {
      ball([7, 7, 5], [-14, 42, 0]);
      ball([7, 7, 5], [14, 42, 0]);
      ball([4.3, 4.3, 2], [-14, 42, 5], paw);
      ball([4.3, 4.3, 2], [14, 42, 5], paw);
    } else if (key === 'hamster') {
      ball([7, 7, 5], [-14, 41, 0], brownFur);
      ball([7, 7, 5], [14, 41, 0], brownFur);
      ball([4, 4, 2], [-14, 41, 5], paw);
      ball([4, 4, 2], [14, 41, 5], paw);
      ball([8, 7, 2], [-10, 21, 10.4], creamFur);
      ball([8, 7, 2], [10, 21, 10.4], creamFur);
      ball([10, 15, 2], [0, -4, 10], creamFur);
    }

    const normalEyes: THREE.Mesh[] = [
      ball([1.8, 2.2, 0.9], [-6.2, 28.5, 11], dark),
      ball([1.8, 2.2, 0.9], [6.2, 28.5, 11], dark)
    ];
    if (key === 'cat') {
      const pupil = new THREE.MeshBasicMaterial({ color: 0x28242c });
      normalEyes.push(ball([0.7, 1.2, 0.5], [-6.2, 28.5, 12], pupil), ball([0.7, 1.2, 0.5], [6.2, 28.5, 12], pupil));
    }
    if (key === 'duck') {
      accents.push(ball([5.8, 2.9, 2.4], [0, 22, 12], orange));
    } else if (key === 'pig') {
      ball([7.4, 5.2, 2.2], [0, 21.5, 11.2], paw);
      ball([1.2, 1.7, 0.7], [-2.5, 21.5, 13], dark);
      ball([1.2, 1.7, 0.7], [2.5, 21.5, 13], dark);
    } else {
      ball([2.7, 2.2, 1.6], [0, 22.5, 12], key === 'rabbit' || key === 'hamster' ? pink : dark);
    }
    pawPad([-23, 13, 0], 0.78, 1, 16, 0.9);
    pawPad([23, 13, 0], -0.78, 1, 16, 0.9);
    pawPad([-10, -30, 0], -0.34, -1, 16);
    pawPad([10, -30, 0], 0.34, -1, 16);

    if (key === 'fox') {
      accentLimb(7, 19, [22, -13, -8], -0.68, fur);
      ball([7, 8, 4], [33, -23, -7], whiteFur);
    } else if (key === 'dog') {
      accentLimb(4.5, 10, [18, -13, -8], -0.72, brownFur);
    } else if (key === 'pig') {
      const curl = new THREE.Mesh(new THREE.TorusGeometry(5, 1.5, 7, 18, Math.PI * 1.65), fur);
      curl.position.set(18, -5, -9);
      doll.add(curl);
    } else {
      const tailSize = key === 'rabbit' ? 6 : key === 'turtle' ? 3 : key === 'hamster' ? 3.5 : 4.5;
      ball([tailSize, tailSize, 3], [0, -3, -10], fur);
    }

    const faceGroup = () => {
      const face = new THREE.Group();
      face.visible = false;
      doll.add(face);
      return face;
    };
    const stroke = (face: THREE.Group, x: number, y: number, rotation: number, length = 4) => {
      const line = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, length, 3, 6), dark);
      line.position.set(x, y, 12.5);
      line.rotation.z = rotation;
      face.add(line);
    };
    const roundMouth = (face: THREE.Group) => {
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(2, 0.65, 6, 16), dark);
      mouth.position.set(0, 20, 12.5);
      face.add(mouth);
    };

    const readyFace = faceGroup();
    stroke(readyFace, -6.2, 33, -1.3, 4.5);
    stroke(readyFace, 6.2, 33, 1.3, 4.5);
    roundMouth(readyFace);

    const hitFace = faceGroup();
    stroke(hitFace, -6.2, 29.8, 0.75);
    stroke(hitFace, -6.2, 27.2, -0.75);
    stroke(hitFace, 6.2, 29.8, -0.75);
    stroke(hitFace, 6.2, 27.2, 0.75);
    roundMouth(hitFace);

    const resultFace = faceGroup();
    stroke(resultFace, -7.5, 28.5, -0.75);
    stroke(resultFace, -4.9, 28.5, 0.75);
    stroke(resultFace, 4.9, 28.5, -0.75);
    stroke(resultFace, 7.5, 28.5, 0.75);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.7, 6, 18, Math.PI), dark);
    smile.position.set(0, 22, 12.5);
    smile.rotation.z = Math.PI;
    resultFace.add(smile);

    accents.forEach((part) => {
      part.userData.baseRotationZ = part.rotation.z;
      part.userData.baseScaleY = part.scale.y;
    });
    group.userData = { doll, accents, key, faces: { normalEyes, ready: readyFace, hit: hitFace, result: resultFace } };
    targetScene.add(group);
    return group;
  }

  private createCharacterPreviews(): CharacterPreviewMap {
    const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    previewRenderer.setSize(180, 180, false);
    previewRenderer.setPixelRatio(1);
    previewRenderer.setClearColor(0x000000, 0);
    previewRenderer.outputColorSpace = THREE.SRGBColorSpace;

    const previewScene = new THREE.Scene();
    previewScene.add(new THREE.HemisphereLight(0xffffff, 0x756477, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(-80, 100, 160);
    previewScene.add(light);
    const previewCamera = new THREE.OrthographicCamera(-70, 70, 80, -80, 0.1, 400);
    previewCamera.position.z = 180;

    const previews: CharacterPreviewMap = {};
    (Object.keys(CHARACTER_DATA) as CharacterKey[]).forEach((key) => {
      const model = this.makeVisual(key, previewScene);
      model.position.y = -4;
      model.rotation.y = -0.08;
      this.setExpression(model, 'ready');
      previewRenderer.render(previewScene, previewCamera);
      previews[key] = previewRenderer.domElement.toDataURL('image/png');
      this.setExpression(model, 'result');
      previewRenderer.render(previewScene, previewCamera);
      previews[`${key}-result`] = previewRenderer.domElement.toDataURL('image/png');
      previewScene.remove(model);
      model.traverse((part: THREE.Object3D) => {
        const mesh = part as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.geometry !== this.sphereGeometry) mesh.geometry.dispose();
        (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
      });
    });

    previewRenderer.dispose();
    return previews;
  }

  private createMole() {
    const group = new THREE.Group();
    const brown = new THREE.MeshStandardMaterial({ color: 0x765038, roughness: 1 });
    const dirt = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 8), brown);
    dirt.scale.set(1.5, 0.22, 0.45);
    dirt.position.z = -2;

    const textureLoader = new THREE.TextureLoader();
    const moleTexture = textureLoader.load(new URL('../assets/obstacles/mole-plush.webp', import.meta.url).href);
    const ghostTexture = textureLoader.load(new URL('../assets/obstacles/ghost-plush.webp', import.meta.url).href);
    moleTexture.colorSpace = THREE.SRGBColorSpace;
    ghostTexture.colorSpace = THREE.SRGBColorSpace;
    const head = new THREE.Mesh(
      new THREE.PlaneGeometry(92, 78),
      new THREE.MeshBasicMaterial({ map: moleTexture, transparent: true, alphaTest: 0.04 })
    );
    head.position.set(0, 18, 2);
    group.add(dirt, head);
    group.visible = false;
    this.scene.add(group);

    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(40)
        .setRestitution(1.8)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    collider.setEnabled(false);
    return { group, dirt, head, body, collider, moleTexture, ghostTexture, phase: 'hidden', timer: 1.2, hit: 0 };
  }

  private createBodyColliders(index: number, body: RAPIER.RigidBody) {
    const add = (hx: number, hy: number, hz: number, radius: number, x: number, y: number, angle = 0) => {
      const rotation = { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) };
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.roundCuboid(hx, hy, hz, radius)
          .setTranslation(x, y, 0)
          .setRotation(rotation)
          .setDensity(0.0007)
          .setFriction(0)
          .setRestitution(0.18)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body
      );
      this.colliderRacers.set(collider.handle, index);
    };

    add(21, 24, 4, 7, 0, -4);
  }

  private createRacer(index: number, characterKey: CharacterKey = 'bear') {
    const startX = -136.5 + index * 91;
    const startY = this.screenToWorldY(START_Y);
    const initialGrip = 0.65 + Math.random() * 0.25;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(startX, startY, 5)
        .setLinearDamping(0.35)
        .setAngularDamping(0.7)
        .setCcdEnabled(true)
        .setAdditionalSolverIterations(8)
    );
    this.createBodyColliders(index, body);

    const visual = this.makeVisual(characterKey);

    const racer = {
      index,
      body,
      visual,
      characterKey,
      name: this.participantData[index]?.name || CHARACTER_DATA[characterKey].name,
      anchors: [] as any[],
      gripElapsed: -initialGrip,
      flipStart: { ...body.rotation() },
      flipAxisX: 1,
      isFlipping: false,
      knockbackUntil: 0,
      expressionUntil: 0,
      stickDuration: initialGrip,
      lastProgressY: startY,
      stalledFor: 0,
      placed: false,
      active: true
    };

    START_PADS[index].forEach((padIndex) => this.attachPad(racer, padIndex));
    racer.lastProgressY = this.anchorProgressY(racer);
    body.setAngvel({ x: 0, y: 0, z: 0.05 * (index % 2 ? 1 : -1) }, true);

    return racer;
  }

  public setParticipants(participants: RacerInfo[]) {
    this.participantData = participants.map((participant) => ({ ...participant }));
    if (!this.isInitialized) return;

    this.racers.forEach((racer, index) => {
      const participant = this.participantData[index];
      racer.active = Boolean(participant && participant.name.trim());
      if (racer.active && participant && racer.characterKey !== participant.characterKey) {
        this.scene.remove(racer.visual);
        racer.visual.traverse((part: THREE.Object3D) => {
          const mesh = part as THREE.Mesh;
          if (!mesh.isMesh) return;
          if (mesh.geometry !== this.sphereGeometry) mesh.geometry.dispose();
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => material.dispose());
        });
        racer.characterKey = participant.characterKey;
        racer.visual = this.makeVisual(racer.characterKey);
      }
      racer.visual.visible = racer.active;
      if (racer.active && participant) racer.name = participant.name;
      else [...racer.anchors].forEach((anchor: any) => this.detachPad(racer, anchor));
      racer.body.setEnabled(racer.active);
    });
  }

  private detachPad(racer: any, anchor: any) {
    const index = racer.anchors.indexOf(anchor);
    if (index === -1 || anchor.removed) return;
    anchor.removed = true;
    racer.anchors.splice(index, 1);
    try {
      this.world.removeImpulseJoint(anchor.joint, true);
    } catch {
      // The joint may already be gone during recovery.
    }
    try {
      this.world.removeRigidBody(anchor.anchorBody);
    } catch {
      // The body may already be gone during recovery.
    }
  }

  private padWorld(racer: any, padIndex: number) {
    const translation = racer.body.translation();
    const rotation = racer.body.rotation();
    return PAD_POINTS[padIndex].clone()
      .applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
      .add(new THREE.Vector3(translation.x, translation.y, translation.z));
  }

  private attachPad(racer: any, padIndex: number) {
    if (racer.anchors.some((anchor: any) => anchor.padIndex === padIndex)) return;
    const point = this.padWorld(racer, padIndex);
    const anchorBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(point.x, point.y, GRIP_Z)
    );
    const joint = this.world.createImpulseJoint(
      RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, PAD_POINTS[padIndex]),
      anchorBody,
      racer.body,
      true
    );
    racer.anchors.push({ padIndex, anchorBody, joint, removed: false });
  }

  private anchorProgressY(racer: any) {
    return racer.anchors.length
      ? Math.min(...racer.anchors.map((anchor: any) => anchor.anchorBody.translation().y))
      : racer.body.translation().y;
  }

  private nextPad(racer: any) {
    if (!racer.anchors.length) return undefined;
    const occupied = new Set(racer.anchors.map((anchor: any) => anchor.padIndex));
    const anchor = racer.anchors[0].anchorBody.translation();
    const anchorIsHand = racer.anchors[0].padIndex < 2;
    return [0, 1, 2, 3]
      .filter((index) => !occupied.has(index)
        && (index < 2) !== anchorIsHand
        && this.padWorld(racer, index).y < anchor.y - 28)
      .sort((a, b) => {
        const pointA = this.padWorld(racer, a);
        const pointB = this.padWorld(racer, b);
        return Math.abs(pointA.z - GRIP_Z) - Math.abs(pointB.z - GRIP_Z)
          || pointA.y - pointB.y
          || Math.abs(pointA.x - anchor.x) - Math.abs(pointB.x - anchor.x);
      })[0];
  }

  private beginFlip(racer: any) {
    if (!racer.anchors.length || racer.isFlipping) return;
    const rotation = racer.body.rotation();
    const position = racer.body.translation();
    const anchor = racer.anchors[0].anchorBody.translation();
    racer.flipAxisX = Math.sign(position.y - anchor.y) || 1;
    racer.flipStart = { ...rotation };
    racer.gripElapsed = 0;
    racer.isFlipping = true;
    racer.body.setAngvel({ x: racer.flipAxisX * 2.5, y: 0, z: 0 }, true);
    racer.body.wakeUp();
  }

  private releaseExtraPad(racer: any) {
    if (racer.anchors.length <= 1) return;
    this.detachPad(racer, racer.anchors[0]);
    if (racer.anchors.length === 1) this.beginFlip(racer);
  }

  private landOnNextPad(racer: any) {
    const nextPad = this.nextPad(racer);
    if (nextPad === undefined) return;
    this.attachPad(racer, nextPad);
    racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    racer.stickDuration = 0.5 + Math.random() * 0.35;
    racer.gripElapsed = -racer.stickDuration;
    racer.isFlipping = false;
  }

  private rotationSinceFlip(racer: any) {
    if (!racer.flipStart) return 0;
    const current = racer.body.rotation();
    const start = racer.flipStart;
    const dot = Math.abs(current.x * start.x + current.y * start.y + current.z * start.z + current.w * start.w);
    return 2 * Math.acos(Math.min(1, dot));
  }

  private recoverStalledRacer(racer: any) {
    const position = racer.body.translation();
    const y = position.y - 72;
    this.placeRacer(racer, THREE.MathUtils.clamp(position.x, -EDGE_SOFT_LIMIT, EDGE_SOFT_LIMIT), y);
    racer.isFlipping = false;
    racer.stickDuration = 0.18;
    racer.gripElapsed = -racer.stickDuration;
    racer.stalledFor = 0;
  }

  private resetRacer(racer: any, index: number) {
    [...racer.anchors].forEach((anchor) => this.detachPad(racer, anchor));
    const startX = (index - 1.5) * RACER_GAP_X;
    const startY = this.screenToWorldY(START_Y);
    racer.body.setTranslation({ x: startX, y: startY, z: GRIP_Z }, true);
    racer.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    racer.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    racer.lastProgressY = startY;
    racer.gripElapsed = 0;
    racer.stalledFor = 0;
    racer.placed = false;
    racer.visual.visible = racer.active;
  }

  private placeRacer(racer: any, x: number, worldY: number) {
    [...racer.anchors].forEach((anchor: any) => this.detachPad(racer, anchor));
    racer.body.setTranslation({ x, y: worldY, z: 5 }, true);
    racer.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    racer.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    START_PADS[racer.index].forEach((padIndex: number) => this.attachPad(racer, padIndex));
    racer.lastProgressY = this.anchorProgressY(racer);
  }

  private moveRacer(racer: any, x: number, worldY: number) {
    racer.body.setTranslation({ x, y: worldY, z: GRIP_Z }, true);
    racer.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    racer.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    racer.anchors.forEach((anchor: any) => {
      const point = this.padWorld(racer, anchor.padIndex);
      anchor.anchorBody.setTranslation({ x: point.x, y: point.y, z: GRIP_Z }, true);
    });
    racer.lastProgressY = worldY;
    racer.visual.position.set(x, worldY, GRIP_Z + (racer === this.draggedRacer ? DRAG_VISUAL_Z_OFFSET : 0));
  }

  private pointerWorld(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;
    const x = this.camera.left + normalizedX * (this.camera.right - this.camera.left);
    const y = this.camera.position.y + (0.5 - normalizedY) * (this.camera.top - this.camera.bottom);
    return { x, y };
  }

  private placementTopScreenY() {
    const canvasRect = this.canvas.getBoundingClientRect();
    const hudRect = document.querySelector<HTMLElement>('#hud')?.getBoundingClientRect();
    if (!hudRect || !canvasRect.height) return 105;
    const hudBottomInGame = (hudRect.bottom - canvasRect.top) / canvasRect.height * HEIGHT;
    return THREE.MathUtils.clamp(hudBottomInGame + RACER_TOP_CLEARANCE, 105, START_Y);
  }

  private overlapsRacerAt(racer: any, x: number, y: number) {
    const others = this.racers.filter((item) => item.active && item !== racer).map((item) => item.body.translation());
    return others.some((position) => PLACEMENT_PARTS.some((part) => PLACEMENT_PARTS.some((otherPart) => (
      Math.hypot(
        (x + part.x - position.x - otherPart.x) / (part.rx + otherPart.rx),
        (y + part.y - position.y - otherPart.y) / (part.ry + otherPart.ry)
      ) < 1
    ))));
  }

  private nearestOpenPosition(racer: any, targetX: number, targetY: number) {
    if (!this.overlapsRacerAt(racer, targetX, targetY)) return { x: targetX, y: targetY };

    const preferredDirection = targetX <= 0 ? 1 : -1;
    for (let distance = 6; distance <= 320; distance += 6) {
      for (const direction of [preferredDirection, -preferredDirection]) {
        const x = targetX + distance * direction;
        if (x < -160 || x > 160) continue;
        if (!this.overlapsRacerAt(racer, x, targetY)) return { x, y: targetY };
      }
    }

    return this.dragOrigin ?? { x: targetX, y: targetY };
  }

  private settleRacer(racer: any, targetX: number, targetY: number) {
    const position = racer.body.translation();
    const tweenPosition = { x: position.x, y: position.y };
    racer.placementTween?.kill();
    racer.placementTween = gsap.to(tweenPosition, {
      x: targetX,
      y: targetY,
      duration: PLACEMENT_SETTLE_DURATION,
      ease: 'power2.out',
      onUpdate: () => this.moveRacer(racer, tweenPosition.x, tweenPosition.y),
      onComplete: () => { racer.placementTween = null; }
    });
  }

  private placeFromPointer(event: PointerEvent) {
    if (!this.draggedRacer) return;
    const point = this.pointerWorld(event);
    const x = THREE.MathUtils.clamp(point.x, -160, 160);
    const y = THREE.MathUtils.clamp(point.y, this.screenToWorldY(START_Y), this.screenToWorldY(this.placementTopScreenY()));
    this.moveRacer(this.draggedRacer, x, y);
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (this.running || this.finished) return;
    const point = this.pointerWorld(event);
    let closest = 48;
    this.draggedRacer = null;
    this.racers.filter((racer) => racer.active).forEach((racer) => {
      const position = racer.body.translation();
      const distance = Math.hypot(position.x - point.x, position.y - point.y);
      if (distance < closest) {
        closest = distance;
        this.draggedRacer = racer;
      }
    });
    if (this.draggedRacer) {
      this.draggedRacer.placementTween?.kill();
      this.draggedRacer.placementTween = null;
      const position = this.draggedRacer.body.translation();
      this.dragOrigin = { x: position.x, y: position.y };
      this.draggedRacer.visual.renderOrder = 20;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
    }
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.draggedRacer) return;
    event.preventDefault();
    this.placeFromPointer(event);
  };
  private handlePointerUp = (event: PointerEvent) => {
    if (this.draggedRacer && this.dragOrigin) {
      const draggedPosition = this.draggedRacer.body.translation();
      const openPosition = this.nearestOpenPosition(this.draggedRacer, draggedPosition.x, draggedPosition.y);
      this.settleRacer(this.draggedRacer, openPosition.x, openPosition.y);
      this.draggedRacer.visual.renderOrder = 0;
    }
    if (this.draggedRacer && this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.draggedRacer = null;
    this.dragOrigin = null;
  };

  private resetMole() {
    this.mole.phase = 'hidden';
    this.mole.timer = THREE.MathUtils.randFloat(0.5, 1);
    this.mole.group.visible = false;
    this.mole.collider.setEnabled(false);
  }

  private ghostStep(x: number, direction: number, dt: number) {
    const next = x + direction * GHOST_SPEED * dt;
    if (direction > 0 && next >= EDGE_SOFT_LIMIT) return { x: EDGE_SOFT_LIMIT, direction: -1 };
    if (direction < 0 && next <= -EDGE_SOFT_LIMIT) return { x: -EDGE_SOFT_LIMIT, direction: 1 };
    return { x: next, direction };
  }

  private updateGhost(dt: number) {
    this.mole.timer -= dt;
    this.mole.hit = Math.max(0, this.mole.hit - dt);
    if (this.mole.phase === 'hidden') {
      if (this.mole.timer > 0) return;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.mole.direction = -side;
      this.mole.flightY = this.cameraY - THREE.MathUtils.randFloat(190, 330);
      this.mole.group.position.set(side * (WIDTH / 2 + 55), this.mole.flightY, 15);
      this.mole.group.visible = true;
      this.mole.head.visible = true;
      this.mole.dirt.visible = false;
      this.mole.collider.setEnabled(true);
      this.mole.phase = 'flying';
      this.mole.timer = GHOST_FLY_TIME;
    } else if (this.mole.timer <= 0) {
      this.mole.phase = 'hidden';
      this.mole.timer = THREE.MathUtils.randFloat(0.7, 1.3);
      this.mole.group.visible = false;
      this.mole.collider.setEnabled(false);
      return;
    }

    const flightY = this.mole.flightY ?? this.cameraY;
    const step = this.ghostStep(this.mole.group.position.x, this.mole.direction ?? 1, dt);
    this.mole.direction = step.direction;
    const y = flightY + Math.sin(this.raceElapsed * 4) * 6;
    this.mole.group.position.set(step.x, y, 15);
    this.mole.body.setNextKinematicTranslation({ x: step.x, y, z: 15 });
    const squash = this.mole.hit ? Math.sin(this.mole.hit / 0.18 * Math.PI) * 0.35 : 0;
    this.mole.head.scale.set(1 + squash, 1 - squash * 0.45, 1);
    this.mole.head.position.y = 18;
  }

  private isRiverZone(worldY: number) {
    const courseY = HEIGHT / 2 - worldY;
    return courseY >= RIVER_TOP_Y && courseY <= RIVER_BOTTOM_Y;
  }

  private canSpawnObstacle(theme: string, worldY: number) {
    return theme === 'night' || !this.isRiverZone(worldY);
  }

  private updateMole(dt: number) {
    if (!this.running) return;
    if (this.activeTheme === 'night') {
      this.updateGhost(dt);
      return;
    }
    this.mole.timer -= dt;
    this.mole.hit = Math.max(0, this.mole.hit - dt);
    if (this.mole.timer <= 0) {
      if (this.mole.phase === 'hidden') {
        const x = THREE.MathUtils.randFloat(-125, 125);
        const y = this.cameraY - THREE.MathUtils.randFloat(190, 330);
        if (!this.canSpawnObstacle(this.activeTheme, y)) {
          this.mole.timer = 0.25;
          return;
        }
        this.mole.body.setNextKinematicTranslation({ x, y, z: 15 });
        this.mole.group.position.set(x, y, 15);
        this.mole.group.visible = true;
        this.mole.head.visible = false;
        this.mole.dirt.visible = this.activeTheme === 'day';
        this.mole.phase = 'warning';
        this.mole.timer = 0.5;
      } else if (this.mole.phase === 'warning') {
        this.mole.phase = 'up';
        this.mole.timer = MOLE_UP_TIME;
        this.mole.head.visible = true;
        // The mole artwork already includes its own dirt rim. Hide the
        // temporary warning hole once it pops up so the two do not overlap.
        this.mole.dirt.visible = false;
        this.mole.collider.setEnabled(true);
      } else {
        this.mole.phase = 'hidden';
        this.mole.timer = THREE.MathUtils.randFloat(0.4, 1);
        this.mole.group.visible = false;
        this.mole.collider.setEnabled(false);
      }
    }
    if (!this.mole.group.visible) return;
    const warning = this.mole.phase === 'warning';
    this.mole.dirt.scale.x = 1.5 + Math.sin(this.mole.timer * 35) * (warning ? 0.16 : 0.03);
    const pop = warning ? 0.01 : Math.min(1, (MOLE_UP_TIME - this.mole.timer) * 7, this.mole.timer * 7);
    const squash = this.mole.hit ? Math.sin(this.mole.hit / 0.18 * Math.PI) * 0.35 : 0;
    this.mole.head.scale.set(1 + squash, Math.max(0.01, pop - squash * 0.45), 1);
    this.mole.head.position.y = 18;
  }

  private setExpression(visual: THREE.Group, expression: 'neutral' | 'ready' | 'hit' | 'result' = 'neutral') {
    const { faces } = visual.userData;
    if (!faces) return;
    faces.normalEyes.forEach((eye: THREE.Mesh) => { eye.visible = expression !== 'hit' && expression !== 'result'; });
    faces.ready.visible = expression === 'ready';
    faces.hit.visible = expression === 'hit';
    faces.result.visible = expression === 'result';
  }

  private finishRace(winner: any) {
    if (this.finished) return;
    this.finished = true;
    this.setExpression(winner.visual, 'result');
    this.tone(1040, 0.24);
    triggerHaptic(this.hapticEnabled, 'confetti', [55, 30, 80]);
    const active = this.racers.filter((racer) => racer.active);
    const rankings = active
      .slice()
      .sort((a, b) => a.body.translation().y - b.body.translation().y)
      .map((racer, index) => ({
        rank: index + 1,
        name: racer.name || CHARACTER_DATA[racer.characterKey as CharacterKey].name,
        charName: CHARACTER_DATA[racer.characterKey as CharacterKey].name,
        key: racer.characterKey as CharacterKey
      }));
    const winnerInfo: { name: string; key: CharacterKey } = rankings[0]
      ? { name: rankings[0].name, key: rankings[0].key as CharacterKey }
      : { name: winner.name, key: winner.characterKey as CharacterKey };
    this.options.onStatusUpdate('결승선 통과!');
    this.options.onProgressUpdate?.(100);
    this.finishTimeoutId = window.setTimeout(() => {
      this.finishTimeoutId = null;
      if (!this.finished || this.isDestroyed) return;
      this.running = false;
      this.options.onStatusUpdate('선택 완료');
      this.options.onFinish(
        winnerInfo.name,
        winnerInfo.key,
        `내 선택은 ${winnerInfo.name}이야!`,
        rankings
      );
    }, FINISH_RESULT_DELAY);
  }

  private catchUpIndex(progressY: number[]) {
    const leader = Math.min(...progressY);
    const last = Math.max(...progressY);
    return progressY.length > 1 && last - leader >= CATCH_UP_GAP ? progressY.lastIndexOf(last) : -1;
  }

  private syncRace(dt: number) {
    let lowest = Infinity;
    if (this.running) this.raceElapsed = (performance.now() - this.raceStartedAt) / 1000;
    const active = this.racers.filter((racer) => racer.active);
    const boostedRacer = active[this.catchUpIndex(active.map((racer) => racer.body.translation().y))];
    this.racers.forEach((racer) => {
      if (!racer.active) return;
      const position = racer.body.translation();
      const rotation = racer.body.rotation();
      if (this.running && racer.expressionUntil && this.raceElapsed >= racer.expressionUntil) {
        racer.expressionUntil = 0;
        this.setExpression(racer.visual);
      }
      racer.visual.position.set(
        position.x,
        position.y,
        position.z + (racer === this.draggedRacer ? DRAG_VISUAL_Z_OFFSET : 0)
      );
      racer.visual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

      const sticking = racer.anchors.length > 1 && !racer.isFlipping && racer.gripElapsed < 0;
      const squeeze = sticking ? Math.sin(Math.PI * (1 + racer.gripElapsed / racer.stickDuration)) * 0.08 : 0;
      racer.visual.scale.set(1 + squeeze * 0.45, 1 - squeeze * 0.35, 1 - squeeze);
      const { doll, accents, key } = racer.visual.userData;
      const characterMotion = this.running ? this.raceElapsed : 0;
      doll.position.set(0, 0, 0);
      doll.rotation.set(0, 0, 0);
      doll.scale.set(1, 1, 1);
      accents.forEach((part: any) => {
        part.rotation.z = part.userData.baseRotationZ;
        part.scale.y = part.userData.baseScaleY;
      });
      if (key === 'bear') doll.position.y = Math.sin(characterMotion * 3.2) * 1.1;
      else if (key === 'rabbit') accents.forEach((ear: any, index: number) => { ear.rotation.z += Math.sin(characterMotion * 9 + index * Math.PI) * 0.13; });
      else if (key === 'cat') doll.rotation.y = Math.sin(characterMotion * 6) * 0.09;
      else if (key === 'duck') {
        const bounce = Math.sin(characterMotion * 7) * 0.025;
        doll.scale.set(1 + bounce, 1 - bounce, 1);
        accents[0].scale.y *= 1 + Math.abs(bounce) * 2;
      } else if (key === 'turtle') {
        doll.rotation.z = Math.sin(characterMotion * 2.4) * 0.025;
        accents.forEach((shell: any) => { shell.rotation.z += Math.sin(characterMotion * 2.4) * 0.04; });
      } else if (key === 'dog') {
        doll.rotation.y = Math.sin(characterMotion * 5.5) * 0.055;
      } else if (key === 'fox') {
        doll.position.x = Math.sin(characterMotion * 4.5) * 0.8;
      } else if (key === 'panda') {
        doll.position.y = Math.sin(characterMotion * 3) * 0.9;
      } else if (key === 'pig') {
        const bounce = Math.sin(characterMotion * 5) * 0.018;
        doll.scale.set(1 + bounce, 1 - bounce, 1);
      } else if (key === 'hamster') {
        doll.position.y = Math.abs(Math.sin(characterMotion * 5.5)) * 1.2;
      }
      if (this.running) {
        const progressY = this.anchorProgressY(racer);
        if (progressY < racer.lastProgressY - 18) {
          racer.lastProgressY = progressY;
          racer.stalledFor = 0;
        } else racer.stalledFor += dt;
        if (racer.stalledFor > 2.5 && this.raceElapsed > 4) {
          this.recoverStalledRacer(racer);
        }
        const shakeBoosted = performance.now() < this.shakeBoostUntil;
        const catchUpBoost = racer === boostedRacer ? CATCH_UP_BOOST : 1;
        const speed = ROLL_SPEED * catchUpBoost * (shakeBoosted ? 3.2 : this.raceElapsed > RACE_RUSH_TIME ? 1.55 : 1);
        racer.gripElapsed += dt * speed;
        const firstRelease = racer.anchors.length > 1 && racer.gripElapsed >= 0;
        const readyToFlip = racer.anchors.length === 1 && !racer.isFlipping && racer.gripElapsed >= 0;
        const flipAngle = racer.isFlipping ? this.rotationSinceFlip(racer) : 0;
        const knockedBack = racer.knockbackUntil > this.raceElapsed;
        if (racer.isFlipping) {
          const angular = racer.body.angvel();
          const slowedByWater = this.isWater(position.x, position.y);
          const rollingSpeed = ROLL_SPEED * catchUpBoost * (2.5 + 6 * (1 - Math.exp(-racer.gripElapsed * 2))) * (shakeBoosted ? 1.45 : 1) * (slowedByWater ? WATER_SPEED : 1);
          if (knockedBack) {
            racer.body.setAngvel({ x: -racer.flipAxisX * 10, y: angular.y, z: angular.z }, true);
          } else if (slowedByWater || angular.x * racer.flipAxisX < rollingSpeed) {
            racer.body.setAngvel({ x: racer.flipAxisX * rollingSpeed, y: angular.y, z: angular.z }, true);
          }
        }
        const landingPad = racer.isFlipping ? this.nextPad(racer) : undefined;
        const landingPoint = landingPad === undefined ? null : this.padWorld(racer, landingPad);
        const lowerPadTouched = racer.isFlipping
          && landingPoint
          && landingPoint.y < racer.anchors[0].anchorBody.translation().y - 28
          && Math.abs(landingPoint.z - GRIP_Z) < 12;
        const completedFlip = racer.isFlipping
          && !knockedBack
          && racer.gripElapsed > 0.12
          && lowerPadTouched
          && flipAngle > 1.2;
        if (firstRelease) this.releaseExtraPad(racer);
        else if (readyToFlip) this.beginFlip(racer);
        else if (completedFlip) this.landOnNextPad(racer);
      }
      lowest = Math.min(lowest, position.y);
      if (!racer.placed && position.y < this.screenToWorldY(FLOOR_Y)) {
        racer.placed = true;
        if (!this.finished) this.finishRace(racer);
      }
    });

    if (this.running) {
      const target = Math.min(0, lowest + 220);
      this.cameraY += (target - this.cameraY) * Math.min(1, dt * 3.2);
      this.camera.position.y = this.cameraY;
      if (!this.finished) {
        const progress = Math.max(0, Math.min(99, Math.round((this.screenToWorldY(START_Y) - lowest) / (FLOOR_Y - START_Y) * 100)));
        this.options.onStatusUpdate(performance.now() < this.shakeBoostUntil ? `흔들림 감지 · ${progress}%` : `데굴 중 ${progress}%`);
        this.options.onProgressUpdate?.(progress);
        if (this.raceElapsed >= RACE_LIMIT) {
          const choice = active.reduce((selected, racer) => racer.body.translation().y < selected.body.translation().y ? racer : selected);
          this.finishRace(choice);
        }
      }
    }
  }

  private isWater(x: number, worldY: number) {
    return this.isRiverZone(worldY) && Math.abs(x) > BRIDGE_HALF_WIDTH;
  }

  private motionMagnitude(acceleration: { x?: number | null; y?: number | null; z?: number | null } | null) {
    return acceleration ? Math.hypot(acceleration.x || 0, acceleration.y || 0, acceleration.z || 0) : 0;
  }

  private handleDeviceMotion = (event: DeviceMotionEvent) => {
    if (!this.running) return;
    const acceleration = event.acceleration;
    const magnitude = this.motionMagnitude(acceleration || event.accelerationIncludingGravity);
    const intensity = acceleration ? magnitude : Math.abs(magnitude - (this.lastMotionMagnitude ?? magnitude));
    this.lastMotionMagnitude = magnitude;
    const now = performance.now();
    if (intensity < 9 || now - this.lastShakeAt < 250) return;
    this.lastShakeAt = now;
    this.shakeBoostUntil = now + 1200;
    triggerHaptic(this.hapticEnabled, 'softMedium', 25);
  };

  private async enableMotionSensor() {
    if (this.motionListening || typeof DeviceMotionEvent === 'undefined') return;
    try {
      const DeviceMotionEventClass = DeviceMotionEvent as typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
      if (typeof DeviceMotionEventClass.requestPermission === 'function'
        && await DeviceMotionEventClass.requestPermission() !== 'granted') return;
      window.addEventListener('devicemotion', this.handleDeviceMotion);
      this.motionListening = true;
    } catch (error) {
      console.warn('기기 흔들기 감지를 사용할 수 없어요.', error);
    }
  }

  private prepareAudio() {
    if (!this.soundEnabled || document.hidden) return;
    this.audioContext ||= new AudioContext();
    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => {});
    }
  }

  private handleVisibilityChange = () => {
    const audioContext = this.audioContext;
    if (!audioContext || audioContext.state === 'closed') return;

    if (document.hidden) {
      this.resumeAudioAfterVisibility = this.soundEnabled && audioContext.state === 'running';
      if (audioContext.state === 'running') {
        void audioContext.suspend().catch(() => {});
      }
      return;
    }

    if (this.resumeAudioAfterVisibility && this.soundEnabled && audioContext.state === 'suspended') {
      this.resumeAudioAfterVisibility = false;
      void audioContext.resume().catch(() => {});
    }
  };

  private tone(frequency = 440, duration = 0.08) {
    if (!this.soundEnabled) return;
    this.prepareAudio();
    if (!this.audioContext) return;
    const oscillator = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
    oscillator.connect(gain).connect(this.audioContext.destination);
    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  public applyTheme(mode: ThemeMode) {
    const previousTheme = this.activeTheme;
    this.themeMode = mode;
    this.activeTheme = this.themeForMode(mode);

    // React applies the settings effect before the asynchronous engine
    // initialization finishes. Keep the requested theme, then apply its
    // Three.js state from init() once the scene and lights exist.
    if (!this.scene) return;

    const night = this.activeTheme === 'night';

    document.getElementById('game')?.setAttribute('data-theme', this.activeTheme);
    (this.scene.background as THREE.Color).set(night ? 0x101936 : 0x8de8ee);

    this.hemisphereLight.intensity = night ? 1.35 : 2.2;
    this.keyLight.intensity = night ? 1.45 : 2.2;

    if (this.courseWall) {
      const mat = this.courseWall.material as THREE.MeshBasicMaterial;
      mat.map = (night ? this.nightCourseTexture : this.dayCourseTexture) || null;
      mat.needsUpdate = true;
      if (this.courseMarkers) this.courseMarkers.visible = !night;
      if (this.courseNightMarkers) this.courseNightMarkers.visible = night;
    }

    if (this.mole) {
      const material = this.mole.head.material as THREE.MeshBasicMaterial;
      material.map = night ? this.mole.ghostTexture : this.mole.moleTexture;
      material.needsUpdate = true;
      if (previousTheme !== this.activeTheme) this.resetMole();
      this.mole.dirt.visible = !night && this.mole.group.visible && this.mole.phase === 'warning';
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (!this.audioContext || this.audioContext.state === 'closed') return;

    if (!enabled) {
      this.resumeAudioAfterVisibility = false;
      if (this.audioContext.state === 'running') {
        void this.audioContext.suspend().catch(() => {});
      }
    } else if (!document.hidden && this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => {});
    }
  }

  public setHapticEnabled(enabled: boolean) {
    this.hapticEnabled = enabled;
  }

  public setThemeMode(mode: ThemeMode) {
    this.applyTheme(mode);
  }

  public async startRace() {
    if (!this.isInitialized || this.running) return;
    // Run synchronously from the start-button gesture so iOS WebView allows
    // the later countdown and collision sounds to use this audio context.
    this.prepareAudio();
    this.racers.forEach((racer) => {
      racer.placementTween?.kill();
      racer.placementTween = null;
    });
    await this.enableMotionSensor();
    const token = ++this.countdownToken;
    this.finished = false;
    this.options.onCountdownUpdate('3', true);
    for (let count = 3; count > 0; count -= 1) {
      if (token !== this.countdownToken) return;
      this.options.onCountdownUpdate(String(count), true);
      this.tone(360 + (3 - count) * 80, 0.16);
      triggerHaptic(this.hapticEnabled, 'tickMedium', 35);
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    }
    if (token !== this.countdownToken) return;
    this.options.onCountdownUpdate('출발!', true);
    this.tone(820, 0.3);
    triggerHaptic(this.hapticEnabled, 'success', [60, 35, 90]);
    this.raceElapsed = 0;
    this.raceStartedAt = performance.now();
    this.racers.filter((racer) => racer.active).forEach((racer) => this.setExpression(racer.visual));
    this.running = true;
    this.options.onStatusUpdate('달리는 중');
    this.options.onProgressUpdate?.(0);
    await new Promise((resolve) => window.setTimeout(resolve, 500));
    this.options.onCountdownUpdate('출발!', false);
  }

  public resetRace() {
    this.countdownToken += 1;
    if (this.finishTimeoutId !== null) {
      window.clearTimeout(this.finishTimeoutId);
      this.finishTimeoutId = null;
    }
    this.applyTheme(this.themeMode);
    this.running = false;
    this.finished = false;
    this.raceElapsed = 0;
    this.shakeBoostUntil = 0;
    this.lastMotionMagnitude = undefined;
    this.draggedRacer = null;
    if (this.mole) this.resetMole();
    this.cameraY = 0;
    if (this.camera) this.camera.position.y = 0;
    const activeRacers = this.racers.filter((racer) => racer.active);
    activeRacers.forEach((racer, index) => {
      racer.placementTween?.kill();
      racer.placementTween = null;
      this.placeRacer(racer, (index - (activeRacers.length - 1) / 2) * RACER_GAP_X, this.screenToWorldY(START_Y));
      racer.placed = false;
      racer.isFlipping = false;
      racer.stickDuration = 0;
      racer.gripElapsed = 0;
      racer.stalledFor = 0;
      racer.knockbackUntil = 0;
      racer.expressionUntil = 0;
      this.setExpression(racer.visual, 'ready');
    });
    this.options.onTimerUpdate('00:00.00');
    this.options.onStatusUpdate('위치를 정한 뒤 출발');
    this.options.onProgressUpdate?.(0);
    this.options.onCountdownUpdate('3', false);
  }

  private resize = () => {
    if (!this.canvas) return;
    const width = this.canvas.clientWidth || WIDTH;
    const height = this.canvas.clientHeight || HEIGHT;

    this.renderer.setSize(width, height, false);
    const visibleHeight = HEIGHT;
    const visibleWidth = (visibleHeight * width) / height;

    this.camera.left = -visibleWidth / 2;
    this.camera.right = visibleWidth / 2;
    this.camera.top = visibleHeight / 2;
    this.camera.bottom = -visibleHeight / 2;
    this.camera.updateProjectionMatrix();
  };

  private startLoop = () => {
    let previous = performance.now();
    let accumulator = 0;

    const frame = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      if (this.running) {
        accumulator += dt;
        while (accumulator >= 1 / 60) {
          this.updateMole(this.world.timestep);
          this.racers.forEach((racer) => {
            if (!racer.active) return;
            const x = racer.body.translation().x;
            const edgeDepth = Math.abs(x) - EDGE_SOFT_LIMIT;
            if (edgeDepth > 0) {
              const impulse = (EDGE_INWARD_FORCE + edgeDepth * 2) * this.world.timestep * racer.body.mass();
              racer.body.applyImpulse({ x: -Math.sign(x) * impulse, y: 0, z: 0 }, true);
            }
          });
          this.world.step(this.eventQueue);
          const impacted = new Set<number>();
          this.eventQueue.drainCollisionEvents((handleA: number, handleB: number, started: boolean) => {
            const racerA = this.colliderRacers.get(handleA);
            const racerB = this.colliderRacers.get(handleB);
            if (started && racerA !== undefined && racerB !== undefined && racerA !== racerB) {
              impacted.add(racerA);
              impacted.add(racerB);
              const now = performance.now();
              if (now - this.lastRacerImpactFeedbackAt >= 180) {
                this.lastRacerImpactFeedbackAt = now;
                this.tone(190, 0.045);
                triggerHaptic(this.hapticEnabled, 'basicWeak', 18);
              }
            }
            const moleHit = handleA === this.mole.collider.handle ? racerB : handleB === this.mole.collider.handle ? racerA : undefined;
            if (started && moleHit !== undefined) {
              const racer = this.racers[moleHit];
              const direction = Math.sign(racer.body.translation().x - this.mole.body.translation().x) || 1;
              const mass = racer.body.mass();
              while (racer.anchors.length > 1) this.detachPad(racer, racer.anchors[0]);
              if (!racer.isFlipping) this.beginFlip(racer);
              racer.knockbackUntil = this.raceElapsed + 0.65;
              racer.expressionUntil = this.raceElapsed + 0.7;
              this.setExpression(racer.visual, 'hit');
              racer.body.applyImpulse({ x: direction * mass * 380, y: mass * 440, z: 0 }, true);
              this.mole.hit = 0.18;
              gsap.fromTo(this.canvas, { x: -direction * 9, scale: 1.015 }, { x: 0, scale: 1, duration: 0.07, repeat: 3, yoyo: true, clearProps: 'x,scale' });
              this.tone(120, 0.16);
              triggerHaptic(this.hapticEnabled, 'error', [70, 30, 110]);
            }
          });
          impacted.forEach((index) => {
            const racer = this.racers[index];
            if (!racer) return;
            if (racer.anchors.length > 1) racer.gripElapsed += 0.14;
          });
          accumulator -= 1 / 60;
        }
      }

      this.syncRace(dt);
      if (this.running) {
        const mins = Math.floor(this.raceElapsed / 60);
        const secs = Math.floor(this.raceElapsed % 60);
        const hundredths = Math.floor(this.raceElapsed * 100) % 100;
        this.options.onTimerUpdate(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`);
      }

      this.renderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(frame);
    };

    this.animFrameId = requestAnimationFrame(frame);
    window.addEventListener('resize', this.resize);
  };

  public destroy() {
    this.isDestroyed = true;
    if (this.finishTimeoutId !== null) {
      window.clearTimeout(this.finishTimeoutId);
      this.finishTimeoutId = null;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.resize);
    this.resizeObserver?.disconnect();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.motionListening) window.removeEventListener('devicemotion', this.handleDeviceMotion);
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close().catch(() => {});
    }
    this.renderer?.dispose();
  }
}
