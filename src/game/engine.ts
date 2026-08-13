import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { gsap } from 'gsap';
import { createCourse } from './course';

const WIDTH = 390;
const HEIGHT = 844;
const START_LINE_Y = 360;
const START_Y = START_LINE_Y - 55;
// Keep the supplied 836x1881 course artwork at its original aspect ratio
// instead of stretching it to an arbitrary tall gameplay plane.
const COURSE_HEIGHT = Math.round(WIDTH * (1881 / 836));
const FLOOR_Y = COURSE_HEIGHT - 48;
const RACE_RUSH_TIME = 40;
const RACE_LIMIT = 58;
const MOLE_UP_TIME = 2.2;
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
const RIVER_TOP_Y = 430;
const RIVER_BOTTOM_Y = 585;
const BRIDGE_HALF_WIDTH = 64;
const WATER_SPEED = 0.72;

export type CharacterKey = 'bear' | 'rabbit' | 'cat' | 'duck' | 'ghost' | 'mole';
export type ThemeMode = 'auto' | 'day' | 'night';
export type CharacterPreviewMap = Partial<Record<CharacterKey, string>>;

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
      name: this.participantData[index]?.name || CHARACTER_DATA[characterKey].name,
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
      racer.anchors.push({ padIndex, anchorBody, joint, removed: false });
    });

    return racer;
  }

  public setParticipants(participants: RacerInfo[]) {
    this.participantData = participants.map((participant) => ({ ...participant }));
    if (!this.isInitialized) return;

    this.racers.forEach((racer, index) => {
      const participant = this.participantData[index];
      racer.active = Boolean(participant && participant.name.trim());
      // Keep the Three.js scene in sync with the selected participant list.
      // Inactive slots must not remain visible on the race screen.
      racer.visual.visible = racer.active;
      if (!participant) return;
      racer.name = participant.name;
      if (racer.characterKey === participant.characterKey) return;
      this.scene.remove(racer.visual);
      racer.visual = this.makeVisual(participant.characterKey);
      racer.characterKey = participant.characterKey;
      racer.visual.visible = racer.active;
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
    if (!racer.anchors.length) {
      START_PADS[racer.index].forEach((padIndex: number) => this.attachPad(racer, padIndex));
    }
    racer.body.setTranslation({ x, y: worldY, z: GRIP_Z }, true);
    racer.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    racer.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    racer.anchors.forEach((anchor: any) => {
      const point = this.padWorld(racer, anchor.padIndex);
      anchor.anchorBody.setTranslation({ x: point.x, y: point.y, z: GRIP_Z }, true);
    });
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
    this.mole.timer -= dt;
    this.mole.hit = Math.max(0, this.mole.hit - dt);
    if (this.mole.timer <= 0) {
      if (this.mole.phase === 'hidden') {
        const x = THREE.MathUtils.randFloat(-125, 125);
        const y = this.cameraY - THREE.MathUtils.randFloat(190, 330);
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
    if (this.mole.phase === 'up') {
      this.racers.filter((racer) => racer.active).forEach((racer) => {
        const position = racer.body.translation();
        if (Math.hypot(position.x - this.mole.group.position.x, position.y - this.mole.group.position.y) < 58) {
          racer.body.setTranslation({ x: position.x, y: position.y + 70, z: GRIP_Z }, true);
          racer.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          this.mole.hit = 0.18;
        }
      });
    }
  }

  private setExpression(visual: THREE.Group, expression: 'neutral' | 'ready' | 'result') {
    const { faces } = visual.userData;
    if (!faces) return;
    faces.normalEyes.forEach((eye: THREE.Mesh) => { eye.visible = expression !== 'result'; });
    faces.ready.visible = expression === 'ready';
    faces.result.visible = expression === 'result';
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
      const gapBoost = position.y - leaderY > CATCH_UP_GAP ? CATCH_UP_BOOST : 1;
      const waterSlow = this.isWater(position.x, position.y) ? WATER_SPEED : 1;
      const speed = ROLL_SPEED * gapBoost * waterSlow * (this.raceElapsed > RACE_RUSH_TIME ? 1.55 : 1);
      racer.gripElapsed += dt * speed;

      const sticking = racer.anchors.length > 1 && !racer.isFlipping && racer.gripElapsed < 0;
      const squeeze = sticking
        ? Math.sin(Math.PI * (1 + racer.gripElapsed / racer.stickDuration)) * 0.08
        : 0;
      racer.visual.scale.set(1 + squeeze * 0.45, 1 - squeeze * 0.35, 1 - squeeze);

      if (racer.isFlipping) {
        const angular = racer.body.angvel();
        const rollingSpeed = ROLL_SPEED * gapBoost
          * (2.5 + 6 * (1 - Math.exp(-racer.gripElapsed * 2)))
          * (waterSlow < 1 ? WATER_SPEED : 1);
        if (waterSlow < 1 || angular.x * racer.flipAxisX < rollingSpeed) {
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
      const { doll, accents, key } = racer.visual.userData;
      doll.position.y = key === 'bear' ? Math.sin(this.raceElapsed * 4) * 2 : 0;
      if (key === 'rabbit') accents.forEach((ear: THREE.Object3D, index: number) => { ear.rotation.z = ear.userData.baseRotationZ + Math.sin(this.raceElapsed * 9 + index * Math.PI) * 0.13; });
      const progressY = this.anchorProgressY(racer);
      if (progressY < racer.lastProgressY - 18) {
        racer.lastProgressY = progressY;
        racer.stalledFor = 0;
      } else {
        racer.stalledFor += dt;
      }
      if (racer.stalledFor > 2.5 && this.raceElapsed > 4) {
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
      material.map = night ? this.mole.ghostTexture : this.mole.moleTexture;
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
        this.updateObstacle(dt);
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
