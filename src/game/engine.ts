import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { gsap } from 'gsap';
import { createCourse } from './course';

const WIDTH = 390;
const HEIGHT = 844;
const START_LINE_Y = 360;
const START_Y = START_LINE_Y - 55;
// Keep the generated 724x4044 course artwork at its original aspect ratio
// instead of stretching it to an arbitrary tall gameplay plane.
const COURSE_HEIGHT = Math.round(WIDTH * (4044 / 724));
const FLOOR_Y = COURSE_HEIGHT - 290;
const RACE_RUSH_TIME = 40;
const RACE_LIMIT = 58;
const MOLE_UP_TIME = 2.2;
const ROLL_SPEED = 1.3;
const CATCH_UP_GAP = 48;
const CATCH_UP_MAX_BOOST = 1.35;
const NIGHT_START = 19;
const NIGHT_END = 6;
const WALL_Z = -5;
const GRIP_Z = WALL_Z + 10;
const RACER_GAP_X = 78;
const EDGE_SOFT_LIMIT = 145;
const EDGE_INWARD_FORCE = 18;
const GHOST_FLY_TIME = 6;
const GHOST_SPEED = 155;
const ROCK_COUNT = 3;
const RIVER_TOP_Y = 880;
const RIVER_BOTTOM_Y = 1230;
const BRIDGE_HALF_WIDTH = 44;
const WATER_SPEED = 0.72;

export type CharacterKey = 'bear' | 'rabbit' | 'cat' | 'duck' | 'turtle' | 'ghost' | 'mole';
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
  ghost: { name: '유령', icon: '👻', preview: 'assets/ghost-plush-PG6yuj_G.webp', modelType: 'ghost' },
  mole: { name: '두더지', icon: '🦔', preview: 'assets/mole-plush-DJrSbKGU.webp', modelType: 'mole' }
};

const COLORS: Record<string, number> = { bear: 0xc6a27f, rabbit: 0xeee7cf, cat: 0x302e38, duck: 0xf1cd58, turtle: 0x8eb879, ghost: 0xffffff, mole: 0x765038 };
const PAD_POINTS = [
  new THREE.Vector3(-33, 14, 0),
  new THREE.Vector3(33, 14, 0),
  new THREE.Vector3(-15, -42, 0),
  new THREE.Vector3(15, -42, 0)
];
const START_PADS = [[0, 1, 2, 3], [1, 0, 3, 2], [0, 1, 2, 3], [1, 0, 3, 2]];

function ghostStep(x: number, direction: number, dt: number) {
  const next = x + direction * GHOST_SPEED * dt;
  if (direction > 0 && next >= EDGE_SOFT_LIMIT) return { x: EDGE_SOFT_LIMIT, direction: -1 };
  if (direction < 0 && next <= -EDGE_SOFT_LIMIT) return { x: -EDGE_SOFT_LIMIT, direction: 1 };
  return { x: next, direction };
}

function catchUpMultiplier(gap: number) {
  return 1 + Math.min(1, Math.max(0, gap / CATCH_UP_GAP)) * (CATCH_UP_MAX_BOOST - 1);
}

console.assert(ghostStep(WIDTH / 2 + 55, -1, 0.1).direction === -1, 'ghost entrance failed');
console.assert(ghostStep(140, 1, 0.1).direction === -1, 'ghost turn failed');
console.assert(catchUpMultiplier(0) === 1 && catchUpMultiplier(CATCH_UP_GAP) === CATCH_UP_MAX_BOOST, 'catch-up boost failed');

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private options: GameEngineOptions;

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private world!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;

  private isInitialized = false;
  private running = false;
  private finished = false;
  private cameraY = 0;
  private raceElapsed = 0;
  private raceStartedAt = 0;
  private soundEnabled = true;
  private hapticEnabled = true;
  private audioContext: AudioContext | undefined;
  private themeMode: ThemeMode = 'auto';
  private activeTheme: 'day' | 'night' = 'day';

  private courseWall?: THREE.Mesh;
  private courseMarkers?: THREE.Object3D;
  private courseNightMarkers?: THREE.Object3D;
  private dayCourseTexture?: THREE.Texture;
  private nightCourseTexture?: THREE.Texture;

  private hemisphereLight!: THREE.HemisphereLight;
  private keyLight!: THREE.DirectionalLight;
  private racers: any[] = [];
  private colliderRacers = new Map<number, number>();
  private mole: any;
  private rocks: any[] = [];
  private animFrameId: number | null = null;
  private fabricTexture!: THREE.Texture;
  private sphereGeometry = new THREE.SphereGeometry(1, 16, 10);
  private participantData: RacerInfo[] = [
    { name: '곰', characterKey: 'bear' },
    { name: '토끼', characterKey: 'rabbit' },
    { name: '고양이', characterKey: 'cat' },
    { name: '오리', characterKey: 'duck' }
  ];
  private countdownToken = 0;
  private draggedRacer: any = null;

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
    this.rocks = Array.from({ length: ROCK_COUNT }, () => this.createRock());
    this.randomizeRocks();
    this.mole = this.createMole();
    this.racers = ['bear', 'rabbit', 'cat', 'duck'].map((key, index) => this.createRacer(index, key as CharacterKey));
    this.options.onCharacterPreviewsReady?.(this.createCharacterPreviews());

    this.applyTheme(this.themeMode);
    this.resize();
    this.canvas.addEventListener('pointerdown', this.handlePointerDown);
    this.canvas.addEventListener('pointermove', this.handlePointerMove);
    this.canvas.addEventListener('pointerup', this.handlePointerUp);
    this.canvas.addEventListener('pointercancel', this.handlePointerUp);

    this.isInitialized = true;
    this.startLoop();
  }

  private makeFabricTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#e7e2d8';
    context.fillRect(0, 0, canvas.width, canvas.height);
    let seed = 731;
    for (let i = 0; i < 360; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % canvas.width;
      seed = (seed * 16807) % 2147483647;
      const y = seed % canvas.height;
      seed = (seed * 16807) % 2147483647;
      const radius = 1.4 + seed % 2.6;
      context.strokeStyle = i % 3 ? '#b9b3a9' : '#fffaf0';
      context.lineWidth = 1.2;
      context.beginPath();
      context.arc(x, y, radius, 0.2, Math.PI * 1.7);
      context.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(3.5, 4.5);
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
    const { wall, markers, nightMarkers, dayCourseTexture, nightCourseTexture } = course as any;
    this.courseWall = wall;
    this.courseMarkers = markers;
    this.courseNightMarkers = nightMarkers;
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
  }

  private makeVisual(key: CharacterKey, targetScene = this.scene) {
    const group = new THREE.Group();
    const doll = new THREE.Group();
    const accents: THREE.Object3D[] = [];
    const motionParts: Record<string, THREE.Object3D | THREE.Object3D[]> = {};
    group.add(doll);
    const fur = new THREE.MeshStandardMaterial({ color: COLORS[key] || 0xc6a27f, map: this.fabricTexture, bumpMap: this.fabricTexture, bumpScale: 1.15, roughness: 1 });
    const dark = new THREE.MeshBasicMaterial({ color: key === 'cat' ? 0xd8d6df : 0x332b30 });
    const nose = new THREE.MeshBasicMaterial({ color: key === 'rabbit' ? 0xe89b9b : 0x332b30 });
    const eyeShine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const pink = new THREE.MeshBasicMaterial({ color: 0xe89b9b });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe9873a, roughness: 0.9 });
    const paw = new THREE.MeshStandardMaterial({ color: key === 'duck' ? 0xe99a47 : key === 'turtle' ? 0xc5d891 : 0xe8d4bf, roughness: 0.95 });
    const muzzle = new THREE.MeshStandardMaterial({ color: key === 'cat' ? 0xe8e3dc : key === 'turtle' ? 0xd6e3b4 : 0xf1ddc5, map: this.fabricTexture, bumpMap: this.fabricTexture, bumpScale: 0.7, roughness: 1 });

    const ball = (scale: [number, number, number], position: [number, number, number], material: THREE.Material = fur) => {
      const mesh = new THREE.Mesh(this.sphereGeometry, material);
      mesh.scale.set(...scale);
      mesh.position.set(...position);
      doll.add(mesh);
      return mesh;
    };
    const limb = (radius: number, length: number, position: [number, number, number], rotation: number, material: THREE.Material = fur) => {
      const geometry = new THREE.CapsuleGeometry(radius, length, 5, 10);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...position);
      mesh.rotation.z = rotation;
      doll.add(mesh);
      return mesh;
    };

    if (key === 'turtle') {
      const shell = new THREE.MeshStandardMaterial({ color: 0x557a43, map: this.fabricTexture, bumpMap: this.fabricTexture, bumpScale: 1, roughness: 1 });
      ball([24, 25, 8], [0, -8, -6], shell);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.1, 8, 24), new THREE.MeshStandardMaterial({ color: 0x355d37, roughness: 1 }));
      rim.scale.set(20, 22, 2);
      rim.position.set(0, -8, 4);
      doll.add(rim);
      accents.push(rim);
      motionParts.shell = rim;
    }
    ball([20, 22, 12], [0, -8, 0]);
    ball([27, key === 'duck' ? 24 : 25, 14], [0, 25, 1]);
    const leftArm = limb(7.5, 12, [-23, 5, 0], 0.88);
    const rightArm = limb(7.5, 12, [23, 5, 0], -0.88);
    limb(8, 10, [-10, -30, 0], -0.3);
    limb(8, 10, [10, -30, 0], 0.3);

    if (key === 'turtle') ball([13, 15, 2], [0, -8, 12], paw);

    if (key === 'bear') {
      ball([9, 9, 6], [-17, 45, 0]);
      ball([9, 9, 6], [17, 45, 0]);
      ball([5, 5, 1.5], [-17, 45, 6], paw);
      ball([5, 5, 1.5], [17, 45, 6], paw);
    } else if (key === 'rabbit') {
      const ears = [limb(6, 18, [-9, 49, 0], -0.12), limb(6, 18, [9, 49, 0], 0.12)];
      ears.forEach((ear) => {
        const inner = new THREE.Mesh(new THREE.CapsuleGeometry(2.6, 13, 4, 8), pink);
        inner.position.z = 6;
        ear.add(inner);
      });
      accents.push(...ears);
      motionParts.ears = ears;
    } else if (key === 'cat') {
      [-15, 15].forEach((x) => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(9, 19, 12), fur);
        ear.position.set(x, 47, 0);
        ear.rotation.z = x < 0 ? -0.18 : 0.18;
        doll.add(ear);
      });
      const tail = new THREE.Mesh(new THREE.TorusGeometry(12, 4, 8, 24, Math.PI * 1.15), fur);
      tail.position.set(16, -31, -9);
      tail.rotation.z = -0.15;
      doll.add(tail);
      motionParts.tail = tail;
    } else if (key === 'duck') {
      motionParts.wings = [leftArm, rightArm];
    }

    const normalEyes: THREE.Mesh[] = [-8, 8].map((x) => {
      const eye = ball([2.5, 2.8, 1.2], [x, 30, 14], dark);
      const shine = new THREE.Mesh(this.sphereGeometry, eyeShine);
      shine.scale.set(0.26, 0.26, 0.35);
      shine.position.set(-0.35, 0.38, 0.9);
      eye.add(shine);
      return eye;
    });
    if (key === 'duck') {
      const bill = ball([9, 4.5, 2.8], [0, 20, 14], orange);
      bill.scale.x = 9;
      accents.push(bill);
    } else if (key === 'turtle') {
      ball([8, 5.5, 2.5], [0, 18, 13.5], muzzle);
      [-1, 1].forEach((side) => {
        const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 3.6, 3, 6), dark);
        mouth.position.set(side * 2.2, 18.5, 16.5);
        mouth.rotation.z = side * -1.05;
        doll.add(mouth);
        normalEyes.push(mouth);
      });
    } else {
      ball([10, 7, 3], [0, 18, 13], muzzle);
      ball([3.2, 2.7, 1.8], [0, 21, 16], nose);
      if (key === 'rabbit') {
        [-1, 1].forEach((side) => {
          const mouth = new THREE.Mesh(new THREE.CapsuleGeometry(0.65, 3, 3, 6), dark);
          mouth.position.set(side * 1.8, 17.5, 16.5);
          mouth.rotation.z = side * 0.9;
          doll.add(mouth);
          normalEyes.push(mouth);
        });
        normalEyes.push(ball([2, 2.8, 1], [0, 14.5, 16], pink));
      }
    }
    if (key === 'rabbit' || key === 'duck') {
      ball([4.2, 2.3, 0.8], [-17, 21, 13], pink);
      ball([4.2, 2.3, 0.8], [17, 21, 13], pink);
    }
    ball([5, 4.2, 1.8], [-33, 14, 8], paw);
    ball([5, 4.2, 1.8], [33, 14, 8], paw);
    ball([5.5, 4.8, 1.8], [-15, -42, 8], paw);
    ball([5.5, 4.8, 1.8], [15, -42, 8], paw);

    const readyFace = new THREE.Group(); readyFace.visible = false; doll.add(readyFace);
    const hitFace = new THREE.Group(); hitFace.visible = false; doll.add(hitFace);
    const resultFace = new THREE.Group(); resultFace.visible = false; doll.add(resultFace);
    const faceBar = (face: THREE.Group, x: number, y: number, rotation = 0, width = 7) => {
      const bar = new THREE.Mesh(new THREE.CapsuleGeometry(1.15, width, 3, 6), dark);
      bar.position.set(x, y, 16);
      bar.rotation.z = rotation;
      face.add(bar);
    };
    faceBar(readyFace, -8, 30, Math.PI / 2, 8);
    faceBar(readyFace, 8, 30, Math.PI / 2, 8);
    [-8, 8].forEach((x) => {
      faceBar(hitFace, x, 30, Math.PI / 4, 7);
      faceBar(hitFace, x, 30, -Math.PI / 4, 7);
    });
    faceBar(resultFace, -8, 30, Math.PI / 2, 8);
    faceBar(resultFace, 8, 30, Math.PI / 2, 8);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(5.5, 1, 5, 16, Math.PI), dark);
    smile.position.set(0, 17, 16);
    smile.rotation.z = Math.PI;
    resultFace.add(smile);

    const effect = new THREE.Group();
    effect.visible = false;
    effect.position.z = 18;
    const effectPart = (geometry: THREE.BufferGeometry, color: number, x: number, y: number, scaleX = 1, scaleY = scaleX, role = '') => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: false, side: THREE.DoubleSide }));
      mesh.position.set(x, y, 0);
      mesh.scale.set(scaleX, scaleY, 1);
      mesh.userData = { baseX: x, baseY: y, baseScaleX: scaleX, baseScaleY: scaleY, role };
      effect.add(mesh);
    };
    if (key === 'bear') {
      [[-24, -35], [24, -35], [-38, -31], [38, -31]].forEach(([x, y]) => effectPart(new THREE.CircleGeometry(1, 10), 0xd6b48b, x, y, 7, 4, 'dust'));
      effectPart(new THREE.CircleGeometry(1, 12), 0x8b5e3c, 0, -38, 8, 6, 'paw');
      [-7, 0, 7].forEach((x) => effectPart(new THREE.CircleGeometry(1, 10), 0x8b5e3c, x, -29, 2.5, 3, 'paw'));
    }
    group.add(effect);

    accents.forEach((part) => {
      part.userData.baseRotationZ = part.rotation.z;
      part.userData.baseScaleY = part.scale.y;
    });
    group.userData = { doll, accents, effect, motionParts, key, faces: { normalEyes, ready: readyFace, hit: hitFace, result: resultFace } };
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
      this.setExpression(model, 'neutral');
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
    const moleHitTexture = textureLoader.load(new URL('../assets/obstacles/mole-plush-hit.webp', import.meta.url).href);
    const ghostHitTexture = textureLoader.load(new URL('../assets/obstacles/ghost-plush-hit.webp', import.meta.url).href);
    moleTexture.colorSpace = THREE.SRGBColorSpace;
    ghostTexture.colorSpace = THREE.SRGBColorSpace;
    moleHitTexture.colorSpace = THREE.SRGBColorSpace;
    ghostHitTexture.colorSpace = THREE.SRGBColorSpace;
    const head = new THREE.Mesh(
      new THREE.PlaneGeometry(92, 78),
      new THREE.MeshBasicMaterial({ map: moleTexture, alphaTest: 0.35 })
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
    return { group, dirt, head, body, collider, moleTexture, ghostTexture, moleHitTexture, ghostHitTexture, phase: 'hidden', timer: 1.2, hit: 0 };
  }

  private createRock() {
    const texture = new THREE.TextureLoader().load(new URL('../assets/obstacles/rock.webp', import.meta.url).href);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(62, 56),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, alphaTest: 0.04 })
    );
    mesh.position.z = 12;
    this.scene.add(mesh);

    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(17)
        .setRestitution(1.45)
        .setFriction(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    return { mesh, body, collider };
  }

  private randomizeRocks() {
    this.rocks.forEach((rock, index) => {
      let courseY = 560 + index * ((FLOOR_Y - 720) / Math.max(1, ROCK_COUNT - 1)) + THREE.MathUtils.randFloat(-45, 45);
      if (courseY >= RIVER_TOP_Y && courseY <= RIVER_BOTTOM_Y) courseY = RIVER_BOTTOM_Y + 90;
      const x = THREE.MathUtils.randFloat(-115, 115);
      const y = this.screenToWorldY(courseY);
      const scale = THREE.MathUtils.randFloat(0.82, 1.18);
      rock.mesh.position.set(x, y, 12);
      rock.mesh.rotation.z = THREE.MathUtils.randFloat(-Math.PI / 4, Math.PI / 4);
      rock.mesh.scale.set(scale, scale * THREE.MathUtils.randFloat(0.8, 1.05), scale);
      rock.body.setNextKinematicTranslation({ x, y, z: GRIP_Z });
    });
  }

  private createRacer(index: number, characterKey: CharacterKey = 'bear') {
    const startX = -136.5 + index * 91;
    const startY = this.screenToWorldY(START_Y);
    const initialGrip = 0.65 + Math.random() * 0.25;
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(startX, startY, GRIP_Z)
        .setLinearDamping(0.35)
        .setAngularDamping(0.7)
        .setCcdEnabled(true)
        .setAdditionalSolverIterations(8)
    );
    this.createBodyCollider(index, body);

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
      effectTime: 0,
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

  private createBodyCollider(index: number, body: RAPIER.RigidBody) {
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(21, 24, 4, 7)
        .setTranslation(0, -4, 0)
        .setDensity(0.0007)
        .setFriction(0)
        .setRestitution(0.18)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    this.colliderRacers.set(collider.handle, index);
  }

  public setParticipants(participants: RacerInfo[]) {
    this.participantData = participants.map((participant) => ({ ...participant }));
    if (!this.isInitialized) return;

    this.racers.forEach((racer, index) => {
      const participant = this.participantData[index];
      racer.active = Boolean(participant && participant.name.trim());
      racer.visual.visible = racer.active;
      racer.body.setEnabled(racer.active);
      if (!racer.active) {
        [...racer.anchors].forEach((anchor) => this.detachPad(racer, anchor));
        return;
      }
      racer.name = participant.name;
      if (racer.characterKey !== participant.characterKey) {
        this.scene.remove(racer.visual);
        racer.visual = this.makeVisual(participant.characterKey);
        racer.characterKey = participant.characterKey;
      }
      racer.visual.visible = true;
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
    if (racer.characterKey === 'bear') racer.effectTime = 0.42;
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
    const y = position.y - 16;
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
    racer.flipStart = { ...racer.body.rotation() };
    racer.isFlipping = false;
    racer.knockbackUntil = 0;
    racer.expressionUntil = 0;
    racer.effectTime = 0;
    racer.stickDuration = 0;
    racer.stalledFor = 0;
    racer.placed = false;
    racer.visual.visible = racer.active;
    if (racer.visual.userData.effect) racer.visual.userData.effect.visible = false;
  }

  private placeRacer(racer: any, x: number, worldY: number) {
    [...racer.anchors].forEach((anchor) => this.detachPad(racer, anchor));
    racer.body.setTranslation({ x, y: worldY, z: GRIP_Z }, true);
    racer.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    racer.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    START_PADS[racer.index].forEach((padIndex: number) => this.attachPad(racer, padIndex));
    racer.lastProgressY = this.anchorProgressY(racer);
    racer.visual.position.set(x, worldY, GRIP_Z);
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
    racer.visual.position.set(x, worldY, GRIP_Z);
  }

  private pointerWorld(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const normalizedX = (event.clientX - rect.left) / rect.width;
    const normalizedY = (event.clientY - rect.top) / rect.height;
    const x = this.camera.left + normalizedX * (this.camera.right - this.camera.left);
    const y = this.camera.position.y + (0.5 - normalizedY) * (this.camera.top - this.camera.bottom);
    return { x, y };
  }

  private placeFromPointer(event: PointerEvent) {
    if (!this.draggedRacer) return;
    const point = this.pointerWorld(event);
    const active = this.racers.filter((racer) => racer.active && racer !== this.draggedRacer);
    let x = THREE.MathUtils.clamp(point.x, -EDGE_SOFT_LIMIT, EDGE_SOFT_LIMIT);
    let y = THREE.MathUtils.clamp(point.y, this.screenToWorldY(START_LINE_Y), this.screenToWorldY(95));
    active.forEach((racer) => {
      const other = racer.body.translation();
      if (Math.hypot(x - other.x, y - other.y) < 70) {
        const direction = Math.sign(x - other.x) || (this.draggedRacer.index % 2 ? -1 : 1);
        x = THREE.MathUtils.clamp(other.x + direction * RACER_GAP_X, -EDGE_SOFT_LIMIT, EDGE_SOFT_LIMIT);
      }
    });
    this.moveRacer(this.draggedRacer, x, y);
  }

  private handlePointerDown = (event: PointerEvent) => {
    if (this.running || this.finished) return;
    const point = this.pointerWorld(event);
    // Select by a forgiving hit area so dragging works on the whole doll.
    let closest = 180;
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
    if (this.draggedRacer && this.canvas.hasPointerCapture(event.pointerId)) {
      this.canvas.releasePointerCapture(event.pointerId);
    }
    this.draggedRacer = null;
  };

  private updateObstacle(dt: number) {
    if (!this.running || !this.mole) return;
    if (this.activeTheme === 'night') {
      this.updateGhost(dt);
      return;
    }
    this.mole.timer -= dt;
    this.mole.hit = Math.max(0, this.mole.hit - dt);
    (this.mole.head.material as THREE.MeshBasicMaterial).map = this.mole.hit ? this.mole.moleHitTexture : this.mole.moleTexture;
    if (this.mole.timer <= 0) {
      if (this.mole.phase === 'hidden') {
        const x = THREE.MathUtils.randFloat(-125, 125);
        const y = this.cameraY - THREE.MathUtils.randFloat(190, 330);
        if (this.isRiverOrBridge(y)) {
          this.mole.timer = 0.25;
          return;
        }
        this.mole.body.setNextKinematicTranslation({ x, y, z: 15 });
        this.mole.group.position.set(x, y, 15);
        this.mole.group.visible = true;
        this.mole.dirt.visible = this.activeTheme !== 'night';
        this.mole.phase = 'warning';
        this.mole.timer = 0.45;
      } else if (this.mole.phase === 'warning') {
        this.mole.phase = 'up';
        this.mole.timer = MOLE_UP_TIME;
        this.mole.collider.setEnabled(true);
      } else {
        this.mole.phase = 'hidden';
        this.mole.timer = THREE.MathUtils.randFloat(0.7, 1.6);
        this.mole.group.visible = false;
        this.mole.collider.setEnabled(false);
      }
    }
    if (!this.mole.group.visible) return;
    const warning = this.mole.phase === 'warning';
    const pop = warning ? 0.08 : Math.min(1, (MOLE_UP_TIME - this.mole.timer) * 7, this.mole.timer * 7);
    this.mole.head.scale.y = Math.max(0.02, pop);
  }

  private updateGhost(dt: number) {
    this.mole.timer -= dt;
    this.mole.hit = Math.max(0, this.mole.hit - dt);
    (this.mole.head.material as THREE.MeshBasicMaterial).map = this.mole.hit ? this.mole.ghostHitTexture : this.mole.ghostTexture;
    if (this.mole.phase === 'hidden') {
      if (this.mole.timer > 0) return;
      const side = Math.random() < 0.5 ? -1 : 1;
      this.mole.direction = -side;
      this.mole.flightY = this.cameraY - THREE.MathUtils.randFloat(190, 330);
      this.mole.group.position.set(side * (WIDTH / 2 + 55), this.mole.flightY, 15);
      this.mole.group.visible = true;
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

    const step = ghostStep(this.mole.group.position.x, this.mole.direction, dt);
    this.mole.direction = step.direction;
    const y = this.mole.flightY + Math.sin(this.raceElapsed * 4) * 6;
    this.mole.group.position.set(step.x, y, 15);
    this.mole.body.setNextKinematicTranslation({ x: step.x, y, z: 15 });
    const squash = this.mole.hit ? Math.sin(this.mole.hit / 0.18 * Math.PI) * 0.35 : 0;
    this.mole.head.scale.set(1 + squash, 1 - squash * 0.45, 1);
  }

  private setExpression(visual: THREE.Group, expression: 'neutral' | 'ready' | 'hit' | 'result') {
    const { faces } = visual.userData;
    if (!faces) return;
    faces.normalEyes.forEach((eye: THREE.Mesh) => { eye.visible = expression === 'neutral'; });
    faces.ready.visible = expression === 'ready';
    faces.hit.visible = expression === 'hit';
    faces.result.visible = expression === 'result';
  }

  private updateCharacterEffect(racer: any) {
    const { effect, key } = racer.visual.userData;
    if (!effect) return;
    const active = key === 'bear' && racer.effectTime > 0;
    effect.visible = active;
    if (!active) return;

    effect.quaternion.copy(racer.visual.quaternion).invert();
    const fade = Math.min(1, racer.effectTime / 0.32);
    effect.children.forEach((part: any) => {
      const material = part.material as THREE.MeshBasicMaterial;
      const { baseX, baseY, baseScaleX, baseScaleY, role } = part.userData;
      part.visible = true;
      part.position.set(baseX, baseY, 0);
      part.scale.set(baseScaleX, baseScaleY, 1);

      if (key === 'bear') {
        const elapsed = 1 - fade;
        part.position.x *= 1 + elapsed * 0.45;
        part.position.y += elapsed * 7;
        material.opacity = role === 'dust' ? fade * 0.28 : fade * 0.4;
      }
    });
  }

  private finishRace(winner: any) {
    if (this.finished) return;
    this.finished = true;
    this.running = false;
    this.setExpression(winner.visual, 'result');
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
    this.options.onStatusUpdate('선택 완료');
    this.options.onProgressUpdate?.(100);
    this.options.onFinish(
      winnerInfo.name,
      winnerInfo.key,
      `내 선택은 ${winnerInfo.name}이야!`,
      rankings
    );
  }

  private syncRace(dt: number) {
    const active = this.racers.filter((racer) => racer.active);
    if (!active.length) return;
    const progress = active.map((racer) => this.anchorProgressY(racer));
    const leaderY = Math.min(...progress);

    active.forEach((racer) => {
      const position = racer.body.translation();
      const inWater = this.isWater(position.x, position.y);
      racer.effectTime = Math.max(0, racer.effectTime - dt);
      if (racer.expressionUntil && racer.expressionUntil <= this.raceElapsed) {
        racer.expressionUntil = 0;
        this.setExpression(racer.visual, 'neutral');
      }
      const catchUpBoost = catchUpMultiplier(this.anchorProgressY(racer) - leaderY);
      const speed = ROLL_SPEED * catchUpBoost * (this.raceElapsed > RACE_RUSH_TIME ? 1.55 : 1);
      racer.gripElapsed += dt * speed;

      const sticking = racer.anchors.length > 1 && !racer.isFlipping && racer.gripElapsed < 0;
      const squeeze = sticking
        ? Math.sin(Math.PI * (1 + racer.gripElapsed / racer.stickDuration)) * 0.08
        : 0;
      racer.visual.scale.set(1 + squeeze * 0.45, 1 - squeeze * 0.35, 1 - squeeze);

      if (racer.isFlipping) {
        const angular = racer.body.angvel();
        const rollingSpeed = ROLL_SPEED * catchUpBoost
          * (2.5 + 6 * (1 - Math.exp(-racer.gripElapsed * 2)))
          * (inWater ? WATER_SPEED : 1);
        if (racer.knockbackUntil > this.raceElapsed) {
          racer.body.setAngvel({ x: -racer.flipAxisX * 10, y: angular.y, z: angular.z }, true);
        } else if (inWater || angular.x * racer.flipAxisX < rollingSpeed) {
          racer.body.setAngvel({ x: racer.flipAxisX * rollingSpeed, y: angular.y, z: angular.z }, true);
        }
      }

      const landingPad = racer.isFlipping ? this.nextPad(racer) : undefined;
      const landingPoint = landingPad === undefined ? null : this.padWorld(racer, landingPad);
      const lowerPadTouched = Boolean(
        racer.isFlipping
        && racer.anchors.length > 0
        && landingPoint
        && landingPoint.y < racer.anchors[0].anchorBody.translation().y - 28
        && Math.abs(landingPoint.z - GRIP_Z) < 12
      );
      const completedFlip = racer.isFlipping
        && racer.knockbackUntil <= this.raceElapsed
        && racer.gripElapsed > 0.12
        && lowerPadTouched
        && this.rotationSinceFlip(racer) > 1.2;
      const firstRelease = racer.anchors.length > 1 && racer.gripElapsed >= 0;
      const readyToFlip = racer.anchors.length === 1 && !racer.isFlipping && racer.gripElapsed >= 0;
      if (firstRelease) this.releaseExtraPad(racer);
      else if (readyToFlip) this.beginFlip(racer);
      else if (completedFlip) this.landOnNextPad(racer);

      const nextPosition = racer.body.translation();
      racer.visual.position.set(nextPosition.x, nextPosition.y, nextPosition.z);
      const rotation = racer.body.rotation();
      racer.visual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      const { doll, accents, motionParts, key } = racer.visual.userData;
      doll.position.set(0, 0, 0);
      doll.rotation.set(0, 0, 0);
      doll.scale.set(1, 1, 1);
      accents.forEach((part: THREE.Object3D) => {
        part.rotation.z = part.userData.baseRotationZ;
        part.scale.y = part.userData.baseScaleY;
      });
      if (key === 'bear') doll.position.y = Math.sin(this.raceElapsed * 3.2) * 1.1;
      else if (key === 'rabbit') (motionParts.ears as THREE.Object3D[]).forEach((ear, index) => {
        ear.rotation.z += Math.sin(this.raceElapsed * 11 + index * Math.PI) * (racer.isFlipping ? 0.32 : 0.1);
        ear.scale.y = racer.isFlipping ? 1.18 : 1;
      });
      else if (key === 'cat') {
        doll.rotation.y = Math.sin(this.raceElapsed * 6) * 0.09;
        (motionParts.tail as THREE.Object3D).rotation.z = -0.15 + Math.sin(this.raceElapsed * 8) * (racer.isFlipping ? 0.32 : 0.12);
      }
      else if (key === 'duck') {
        const bounce = Math.sin(this.raceElapsed * 7) * 0.025;
        doll.scale.set(1 + bounce, 1 - bounce, 1);
        accents[0].scale.y *= 1 + Math.abs(bounce) * 2;
        (motionParts.wings as THREE.Object3D[]).forEach((wing, index) => {
          wing.rotation.z = (index ? -1 : 1) * (0.78 + Math.sin(this.raceElapsed * 14 + index * Math.PI) * (racer.isFlipping ? 0.42 : 0.12));
        });
      } else if (key === 'turtle') {
        doll.rotation.z = Math.sin(this.raceElapsed * 2.4) * 0.025;
        (motionParts.shell as THREE.Object3D).rotation.z += racer.isFlipping ? 0.09 : Math.sin(this.raceElapsed * 2.4) * 0.025;
      }
      this.updateCharacterEffect(racer);
      const progressY = this.anchorProgressY(racer);
      if (progressY < racer.lastProgressY - 18) {
        racer.lastProgressY = progressY;
        racer.stalledFor = 0;
      } else {
        racer.stalledFor += dt;
      }
      if (racer.stalledFor > 4.5 && this.raceElapsed > 4) {
        this.recoverStalledRacer(racer);
      }
      if (nextPosition.y < this.screenToWorldY(FLOOR_Y)) racer.placed = true;
    });

    const lowest = Math.min(...active.map((racer) => this.anchorProgressY(racer)));
    this.cameraY += (Math.min(0, lowest + 220) - this.cameraY) * Math.min(1, dt * 3.2);
    this.camera.position.y = this.cameraY;
    const percent = Math.max(0, Math.min(99, Math.round((this.screenToWorldY(START_Y) - lowest) / (FLOOR_Y - START_Y) * 100)));
    this.options.onStatusUpdate('달리는 중');
    this.options.onProgressUpdate?.(percent);
    if (active.some((racer) => racer.placed) || this.raceElapsed >= RACE_LIMIT) {
      this.finishRace(active.slice().sort((a, b) => a.body.translation().y - b.body.translation().y)[0]);
    }
  }

  private isWater(x: number, worldY: number) {
    const courseY = HEIGHT / 2 - worldY;
    return courseY >= RIVER_TOP_Y && courseY <= RIVER_BOTTOM_Y && Math.abs(x) > BRIDGE_HALF_WIDTH;
  }

  private isRiverOrBridge(worldY: number) {
    const courseY = HEIGHT / 2 - worldY;
    return courseY >= RIVER_TOP_Y && courseY <= RIVER_BOTTOM_Y;
  }

  public applyTheme(mode: ThemeMode) {
    this.themeMode = mode;
    this.activeTheme = this.themeForMode(mode);

    // React applies the settings effect before the asynchronous engine
    // initialization finishes. Keep the requested theme, then apply its
    // Three.js state from init() once the scene and lights exist.
    if (!this.scene) return;

    const night = this.activeTheme === 'night';

    document.documentElement.setAttribute('data-theme', this.activeTheme);
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
      material.map = night
        ? (this.mole.hit ? this.mole.ghostHitTexture : this.mole.ghostTexture)
        : (this.mole.hit ? this.mole.moleHitTexture : this.mole.moleTexture);
      material.transparent = night;
      material.alphaTest = night ? 0.04 : 0.35;
      material.needsUpdate = true;
      this.mole.dirt.visible = !night && this.mole.group.visible;
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setHapticEnabled(enabled: boolean) {
    this.hapticEnabled = enabled;
  }

  public setThemeMode(mode: ThemeMode) {
    this.applyTheme(mode);
  }

  public async startRace() {
    if (!this.isInitialized || this.running) return;
    const token = ++this.countdownToken;
    this.finished = false;
    this.options.onCountdownUpdate('3', true);
    for (let count = 3; count > 0; count -= 1) {
      if (token !== this.countdownToken) return;
      this.options.onCountdownUpdate(String(count), true);
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    if (token !== this.countdownToken) return;
    this.options.onCountdownUpdate('출발!', true);
    this.racers.filter((racer) => racer.active).forEach((racer) => {
      racer.gripElapsed = 0;
      racer.isFlipping = false;
      this.setExpression(racer.visual, 'neutral');
      racer.body.wakeUp();
    });
    this.running = true;
    this.raceElapsed = 0;
    this.raceStartedAt = performance.now();
    this.options.onStatusUpdate('달리는 중');
    this.options.onProgressUpdate?.(0);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    this.options.onCountdownUpdate('출발!', false);
  }

  public resetRace() {
    this.countdownToken += 1;
    this.running = false;
    this.finished = false;
    this.raceElapsed = 0;
    this.draggedRacer = null;
    if (this.mole) {
      this.mole.phase = 'hidden';
      this.mole.timer = 1.2;
      this.mole.group.visible = false;
      this.mole.collider.setEnabled(false);
    }
    this.randomizeRocks();
    this.cameraY = 0;
    if (this.camera) this.camera.position.y = 0;
    const activeRacers = this.racers.filter((racer) => racer.active);
    this.racers.forEach((racer) => {
      const activeIndex = activeRacers.indexOf(racer);
      if (racer.active) {
        this.resetRacer(racer, activeIndex);
        const startX = (activeIndex - (activeRacers.length - 1) / 2) * RACER_GAP_X;
        this.placeRacer(racer, startX, this.screenToWorldY(START_Y));
      } else {
        racer.visual.visible = false;
      }
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
    const backgroundScale = Math.max(1, visibleWidth / WIDTH);

    this.camera.left = -visibleWidth / 2;
    this.camera.right = visibleWidth / 2;
    this.camera.top = visibleHeight / 2;
    this.camera.bottom = -visibleHeight / 2;
    this.camera.updateProjectionMatrix();
    if (this.courseWall) this.courseWall.scale.x = backgroundScale;
    if (this.courseMarkers) this.courseMarkers.scale.x = backgroundScale;
    if (this.courseNightMarkers) this.courseNightMarkers.scale.x = backgroundScale;
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
          this.updateObstacle(this.world.timestep);
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
          this.eventQueue.drainCollisionEvents((handleA, handleB, started) => {
            const racerA = this.colliderRacers.get(handleA);
            const racerB = this.colliderRacers.get(handleB);
            if (started && racerA !== undefined && racerB !== undefined && racerA !== racerB) {
              impacted.add(racerA);
              impacted.add(racerB);
            }
            const obstacle = handleA === this.mole.collider.handle || handleB === this.mole.collider.handle
              ? this.mole
              : this.rocks.find((rock) => handleA === rock.collider.handle || handleB === rock.collider.handle);
            const obstacleHit = handleA === obstacle?.collider.handle ? racerB : handleB === obstacle?.collider.handle ? racerA : undefined;
            if (started && obstacleHit !== undefined) {
              const racer = this.racers[obstacleHit];
              racer.expressionUntil = this.raceElapsed + 0.7;
              this.setExpression(racer.visual, 'hit');
              const direction = Math.sign(racer.body.translation().x - obstacle.body.translation().x) || 1;
              const mass = racer.body.mass();
              if (obstacle === this.mole) {
                while (racer.anchors.length > 1) this.detachPad(racer, racer.anchors[0]);
                if (!racer.isFlipping) this.beginFlip(racer);
                racer.knockbackUntil = this.raceElapsed + 0.65;
                racer.body.applyImpulse({ x: direction * mass * 380, y: mass * 440, z: 0 }, true);
                this.mole.hit = 0.18;
              } else {
                racer.gripElapsed += 0.12;
                racer.body.applyImpulse({ x: direction * mass * 120, y: mass * 100, z: 0 }, true);
              }
            }
          });
          impacted.forEach((index) => {
            const racer = this.racers[index];
            if (racer?.anchors.length > 1) racer.gripElapsed += 0.14;
          });
          accumulator -= 1 / 60;
        }

        this.raceElapsed = (performance.now() - this.raceStartedAt) / 1000;
        this.syncRace(dt);
        const totalSec = this.raceElapsed;
        const mins = Math.floor(totalSec / 60);
        const secs = Math.floor(totalSec % 60);
        const ms = Math.floor((totalSec % 1) * 100);
        const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
        this.options.onTimerUpdate(formatted);
      }

      this.renderer.render(this.scene, this.camera);
      this.animFrameId = requestAnimationFrame(frame);
    };

    this.animFrameId = requestAnimationFrame(frame);
    window.addEventListener('resize', this.resize);
  };

  public destroy() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
    this.renderer?.dispose();
  }
}
