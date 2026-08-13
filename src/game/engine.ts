import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { gsap } from 'gsap';
import { createCourse } from './course';

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
const GHOST_FLY_TIME = 6;
const GHOST_SPEED = 155;
const RIVER_TOP_Y = 1350;
const RIVER_BOTTOM_Y = 1780;
const BRIDGE_HALF_WIDTH = 64;
const WATER_SPEED = 0.72;

export type CharacterKey = 'bear' | 'rabbit' | 'cat' | 'duck' | 'ghost' | 'mole';
export type ThemeMode = 'auto' | 'day' | 'night';

export interface RacerInfo {
  name: string;
  characterKey: CharacterKey;
}

export interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  onTimerUpdate: (timeStr: string) => void;
  onStatusUpdate: (status: string) => void;
  onCountdownUpdate: (countStr: string, visible: boolean) => void;
  onPlayerLabelsUpdate: (labels: any[]) => void;
  onFinish: (winnerName: string, winnerChar: CharacterKey, winnerSpeech: string, rankings: any[]) => void;
}

export const CHARACTER_DATA: Record<CharacterKey, { name: string; icon: string; preview: string; modelType: CharacterKey }> = {
  bear: { name: '곰', icon: '🐻', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'bear' },
  rabbit: { name: '토끼', icon: '🐰', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'rabbit' },
  cat: { name: '고양이', icon: '🐱', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'cat' },
  duck: { name: '오리', icon: '🐥', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'duck' },
  ghost: { name: '유령', icon: '👻', preview: 'assets/ghost-plush-PG6yuj_G.webp', modelType: 'ghost' },
  mole: { name: '두더지', icon: '🦔', preview: 'assets/mole-plush-DJrSbKGU.webp', modelType: 'mole' }
};

const COLORS: Record<string, number> = { bear: 0xc6a27f, rabbit: 0xeee7cf, cat: 0x302e38, duck: 0xf1cd58, ghost: 0xffffff, mole: 0x765038 };
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
  private animFrameId: number | null = null;
  private fabricTexture!: THREE.Texture;
  private sphereGeometry = new THREE.SphereGeometry(1, 16, 10);

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
    this.mole = this.createMole();
    this.racers = ['bear', 'rabbit', 'cat', 'duck'].map((key, index) => this.createRacer(index, key as CharacterKey));

    this.applyTheme(this.themeMode);
    this.resize();

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
    group.add(doll);
    const fur = new THREE.MeshStandardMaterial({ color: COLORS[key] || 0xc6a27f, map: this.fabricTexture, bumpMap: this.fabricTexture, bumpScale: 0.8, roughness: 1 });
    const dark = new THREE.MeshBasicMaterial({ color: key === 'cat' ? 0xd8d6df : 0x332b30 });
    const pink = new THREE.MeshBasicMaterial({ color: 0xe89b9b });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe9873a, roughness: 0.9 });
    const paw = new THREE.MeshStandardMaterial({ color: key === 'duck' ? 0xe99a47 : 0xe8d4bf, roughness: 0.95 });

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

    ball([19, 25, 11], [0, -3, 0]);
    ball([22, 20, 12], [0, 25, 0]);
    limb(7, 20, [-23, 13, 0], 0.78);
    limb(7, 20, [23, 13, 0], -0.78);
    limb(8, 18, [-10, -30, 0], -0.34);
    limb(8, 18, [10, -30, 0], 0.34);

    if (key === 'bear') {
      ball([8, 8, 6], [-14, 43, 0]);
      ball([8, 8, 6], [14, 43, 0]);
    } else if (key === 'rabbit') {
      accents.push(limb(4.5, 19, [-7, 45, 0], -0.08), limb(4.5, 19, [7, 45, 0], 0.08));
    } else if (key === 'cat') {
      limb(5, 7, [-12, 39, 0], -0.25);
      limb(5, 7, [12, 39, 0], 0.25);
    }

    const normalEyes: THREE.Mesh[] = [
      ball([1.8, 2.2, 0.9], [-6.2, 28.5, 11], dark),
      ball([1.8, 2.2, 0.9], [6.2, 28.5, 11], dark)
    ];
    if (key === 'duck') accents.push(ball([5.8, 2.9, 2.4], [0, 22, 12], orange));
    else ball([2.7, 2.2, 1.6], [0, 22.5, 12], key === 'rabbit' ? pink : dark);
    ball([4.2, 4.2, 1.8], [-34, 26, 7], paw);
    ball([4.2, 4.2, 1.8], [34, 26, 7], paw);
    ball([4.5, 4.5, 1.8], [-16, -45, 7], paw);
    ball([4.5, 4.5, 1.8], [16, -45, 7], paw);

    const readyFace = new THREE.Group(); readyFace.visible = false; doll.add(readyFace);
    const hitFace = new THREE.Group(); hitFace.visible = false; doll.add(hitFace);
    const resultFace = new THREE.Group(); resultFace.visible = false; doll.add(resultFace);

    group.userData = { doll, accents, key, faces: { normalEyes, ready: readyFace, hit: hitFace, result: resultFace } };
    targetScene.add(group);
    return group;
  }

  private createMole() {
    const group = new THREE.Group();
    const brown = new THREE.MeshStandardMaterial({ color: 0x765038, roughness: 1 });
    const dirt = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 8), brown);
    dirt.scale.set(1.5, 0.22, 0.45);
    dirt.position.z = -2;

    const head = new THREE.Mesh(
      new THREE.PlaneGeometry(92, 78),
      new THREE.MeshBasicMaterial({ color: 0x888888, transparent: true, alphaTest: 0.04 })
    );
    head.position.set(0, 18, 2);
    group.add(dirt, head);
    this.scene.add(group);

    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(40)
        .setRestitution(1.8)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    collider.setEnabled(false);
    return { group, dirt, head, body, collider, phase: 'hidden', timer: 1.2, hit: 0 };
  }

  private createRacer(index: number, characterKey: CharacterKey = 'bear') {
    const startX = -117 + index * RACER_GAP_X;
    const startY = this.screenToWorldY(START_Y);
    const body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(startX, startY, GRIP_Z)
        .setLinearDamping(0.12)
        .setAngularDamping(0.08)
    );
    body.setAdditionalMass(0.015, true);

    const visual = this.makeVisual(characterKey);

    const racer = {
      index,
      body,
      visual,
      characterKey,
      anchors: [] as any[],
      gripElapsed: 0,
      flipStart: null,
      flipAxisX: 1,
      isFlipping: false,
      knockbackUntil: 0,
      expressionUntil: 0,
      stickDuration: 0.5,
      lastProgressY: startY,
      stalledFor: 0,
      placed: false,
      active: true
    };

    START_PADS[index].forEach((padIndex) => {
      const point = PAD_POINTS[padIndex].clone().add(new THREE.Vector3(startX, startY, GRIP_Z));
      const anchorBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(point.x, point.y, GRIP_Z));
      const joint = this.world.createImpulseJoint(
        RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, PAD_POINTS[padIndex]),
        anchorBody,
        body,
        true
      );
      racer.anchors.push({ padIndex, anchorBody, joint });
    });

    return racer;
  }

  public applyTheme(mode: ThemeMode) {
    this.themeMode = mode;
    this.activeTheme = this.themeForMode(mode);
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

  public startRace() {
    this.running = true;
    this.finished = false;
    this.raceElapsed = 0;
    this.raceStartedAt = performance.now();
    this.options.onStatusUpdate('달리는 중 0%');
  }

  public resetRace() {
    this.running = false;
    this.finished = false;
    this.raceElapsed = 0;
    this.cameraY = 0;
    this.camera.position.y = 0;
    this.options.onTimerUpdate('00:00.00');
    this.options.onStatusUpdate('준비');
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
          this.world.step(this.eventQueue);
          accumulator -= 1 / 60;
        }

        this.raceElapsed = (performance.now() - this.raceStartedAt) / 1000;
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
    this.renderer?.dispose();
  }
}
