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
const MOLE_UP_TIME = 3;
const GHOST_FLY_TIME = 6;
const GHOST_SPEED = 155;
const RIVER_TOP_Y = 1350;
const RIVER_BOTTOM_Y = 1780;
const BRIDGE_HALF_WIDTH = 64;
const WATER_SPEED = 0.72;
const PLACEMENT_PARTS = [
  { x: 0, y: 25, rx: 22, ry: 20 },
  { x: 0, y: -3, rx: 19, ry: 25 },
  { x: -23, y: 13, rx: 16, ry: 10 },
  { x: 23, y: 13, rx: 16, ry: 10 },
  { x: -10, y: -32, rx: 10, ry: 18 },
  { x: 10, y: -32, rx: 10, ry: 18 }
];
type CharacterKey = 'bear' | 'rabbit' | 'cat' | 'duck' | 'turtle';

interface Racer {
  index: number;
  body: RAPIER.RigidBody;
  visual: THREE.Group;
  characterKey: CharacterKey;
  label: HTMLElement;
  anchors: any[];
  gripElapsed: number;
  flipStart: any;
  flipAxisX: number;
  isFlipping: boolean;
  knockbackUntil: number;
  expressionUntil?: number;
  stickDuration: number;
  lastProgressY: number;
  stalledFor: number;
  placed: boolean;
  active: boolean;
}

interface MoleObj {
  group: THREE.Group;
  head: THREE.Mesh<any, any>;
  dirt: THREE.Mesh;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  moleTexture: THREE.Texture;
  ghostTexture: THREE.Texture;
  hit: number;
  phase: string;
  timer: number;
  direction?: number;
  flightY?: number;
}

const DEFAULT_NAMES = ['곰', '토끼', '고양이', '오리'];
const KEYS: CharacterKey[] = ['bear', 'rabbit', 'cat', 'duck'];
const CHARACTER_KEYS: CharacterKey[] = [...KEYS, 'turtle'];
const CHARACTER_NAMES: Record<CharacterKey, string> = { bear: '곰', rabbit: '토끼', cat: '고양이', duck: '오리', turtle: '거북이' };
const COLORS: Record<CharacterKey, number> = { bear: 0xc6a27f, rabbit: 0xeee7cf, cat: 0x302e38, duck: 0xf1cd58, turtle: 0x8eb879 };
const CHARACTER_TONES: Record<CharacterKey, number> = { bear: 260, rabbit: 760, cat: 520, duck: 640, turtle: 360 };
const PAD_POINTS = [
  new THREE.Vector3(-27, 27, 0),
  new THREE.Vector3(27, 27, 0),
  new THREE.Vector3(-18, -35, 0),
  new THREE.Vector3(18, -35, 0)
];
const START_PADS = [[0, 1, 2, 3], [1, 0, 3, 2], [0, 1, 2, 3], [1, 0, 3, 2]];

const game = document.querySelector<HTMLElement>('#game')!;
const guide = document.querySelector<HTMLButtonElement>('#guide');
const raceQuestion = document.querySelector<HTMLElement>('#race-question');
const status = document.querySelector<HTMLElement>('#status');
const raceTimer = document.querySelector<HTMLElement>('#race-timer');
const raceStart = document.querySelector<HTMLElement>('#race-start');
const startCount = document.querySelector<HTMLElement>('#start-count');
const startCaption = document.querySelector<HTMLElement>('#start-caption');
const signalLights = Array.from(document.querySelectorAll<HTMLElement>('.signal-lights i'));
const errorBox = document.querySelector<HTMLElement>('#error');
const setup = document.querySelector<HTMLElement>('#setup');
const setupForm = document.querySelector<HTMLFormElement>('#setup-form');
const setupSubmit = document.querySelector<HTMLButtonElement>('#setup-submit');
const setupDescription = document.querySelector<HTMLElement>('#setup-description');
const decisionQuestion = document.querySelector<HTMLInputElement>('#decision-question');
const themeSelect = document.querySelector<HTMLSelectElement>('#theme-mode');
const nameInputs = setupForm ? Array.from(setupForm.querySelectorAll<HTMLInputElement>('input[name="name"]')) : [];
const characterSelects = setupForm ? Array.from(setupForm.querySelectorAll<HTMLSelectElement>('select[name="character"]')) : [];
const participants = Array.from(document.querySelectorAll<HTMLElement>('.participant'));
const characterPickers = Array.from(document.querySelectorAll<HTMLElement>('.mini-character-picker'));
const characterPreviewImages = Array.from(document.querySelectorAll<HTMLImageElement>('.mini-character-preview img'));
const characterPreviewLabels = Array.from(document.querySelectorAll<HTMLElement>('.mini-character-preview span'));
const characterSteps = Array.from(document.querySelectorAll<HTMLButtonElement>('.character-step'));
const result = document.querySelector<HTMLElement>('#result');
const resultTitle = document.querySelector<HTMLElement>('#result-title');
const resultCopy = document.querySelector<HTMLElement>('#result-copy');
const resultList = document.querySelector<HTMLElement>('#result-list');
const resultCharacterImage = document.querySelector<HTMLImageElement>('#result-character-image');
const resultSpeech = document.querySelector<HTMLElement>('#result-speech');
const commentPrev = document.querySelector<HTMLButtonElement>('#comment-prev');
const commentNext = document.querySelector<HTMLButtonElement>('#comment-next');
let world: RAPIER.World;
let eventQueue: RAPIER.EventQueue;
let racers: Racer[] = [];
let mountains: THREE.Object3D[] = [];
const colliderRacers = new Map<number, number>();
let mole: MoleObj;
let running = false;
let finished = false;
let cameraY = 0;
let raceElapsed = 0;
let raceStartedAt = 0;
let soundEnabled = true;
let hapticEnabled = true;
let audioContext: AudioContext | undefined;
let resultComments: string[] = [];
let commentIndex = 0;
let characterPreviews: Record<string, { ready: string; result: string }> = {};
let motionListening = false;
let lastMotionMagnitude: number | undefined;
let shakeBoostUntil = 0;
let lastShakeAt = 0;
let themeMode = 'auto';
let activeTheme = themeForMode(themeMode);
let courseWall: THREE.Mesh<any, any> | undefined;
let courseMarkers: THREE.Object3D | undefined;
let courseNightMarkers: THREE.Object3D | undefined;
let dayCourseTexture: THREE.Texture | undefined;
let nightCourseTexture: THREE.Texture | undefined;

const scene = new THREE.Scene();
scene.background = new THREE.Color();
const camera = new THREE.OrthographicCamera(-WIDTH / 2, WIDTH / 2, HEIGHT / 2, -HEIGHT / 2, 0.1, 1000);
camera.position.set(0, 0, 500);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.outputColorSpace = THREE.SRGBColorSpace;
game.prepend(renderer.domElement);

const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x756477, 2.2);
scene.add(hemisphereLight);
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(-160, 250, 300);
scene.add(keyLight);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const motionScale = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;

function themeForMode(mode: string, hour = new Date().getHours()) {
  return mode === 'auto' ? (hour >= NIGHT_START || hour < NIGHT_END ? 'night' : 'day') : mode;
}

console.assert(themeForMode('auto', 22) === 'night' && themeForMode('auto', 12) === 'day', 'auto theme failed');

function applyTheme(mode: string) {
  const nextTheme = themeForMode(mode);
  const themeChanged = activeTheme !== nextTheme;

  themeMode = mode;
  activeTheme = nextTheme;

  const night = activeTheme === 'night';

  document.documentElement.dataset.theme = activeTheme;
  (scene.background as THREE.Color).set(night ? 0x101936 : 0x8de8ee);

  hemisphereLight.intensity = night ? 1.35 : 2.2;
  keyLight.intensity = night ? 1.45 : 2.2;

  if (courseWall) {
    courseWall.material.map = (night ? nightCourseTexture : dayCourseTexture) || null;
    courseWall.material.needsUpdate = true;
    if (courseMarkers) courseMarkers.visible = !night;
    if (courseNightMarkers) courseNightMarkers.visible = night;
  }

  if (mole) {
    mole.head.material.map = night ? mole.ghostTexture : mole.moleTexture;
    mole.head.material.needsUpdate = true;

    if (themeChanged) {
      resetMole();
    }

    mole.dirt.visible = !night && mole.group.visible;
  }
}

function motionMagnitude(acceleration: any) {
  return acceleration ? Math.hypot(acceleration.x || 0, acceleration.y || 0, acceleration.z || 0) : 0;
}

console.assert(motionMagnitude({ x: 3, y: 4, z: 0 }) === 5, 'motion magnitude failed');

function handleDeviceMotion(event: DeviceMotionEvent) {
  if (!running) return;
  const acceleration = event.acceleration;
  const magnitude = motionMagnitude(acceleration || event.accelerationIncludingGravity);
  const intensity = acceleration ? magnitude : Math.abs(magnitude - (lastMotionMagnitude ?? magnitude));
  lastMotionMagnitude = magnitude;
  const now = performance.now();
  if (intensity < 9 || now - lastShakeAt < 250) return;
  lastShakeAt = now;
  shakeBoostUntil = now + 1200;
  buzz(25);
}

async function enableMotionSensor() {
  if (motionListening || typeof DeviceMotionEvent === 'undefined') return;
  try {
    const DeviceMotionEventClass = DeviceMotionEvent as any;
    if (typeof DeviceMotionEventClass.requestPermission === 'function'
      && await DeviceMotionEventClass.requestPermission() !== 'granted') return;
    addEventListener('devicemotion', handleDeviceMotion as any);
    motionListening = true;
  } catch (error) {
    console.warn('기기 흔들기 감지를 사용할 수 없어요.', error);
  }
}

function showOverlay(overlay: HTMLElement) {
  overlay.hidden = false;
  gsap.fromTo(overlay, { opacity: 0 }, { opacity: 1, duration: 0.35 * motionScale, ease: 'power2.out' });
  gsap.fromTo(overlay.querySelector('.card'), { y: 42, scale: 0.96, rotation: -1.5 }, { y: 0, scale: 1, rotation: 0, duration: 0.65 * motionScale, ease: 'power3.out' });
}

function hideOverlay(overlay: HTMLElement) {
  gsap.to(overlay, {
    opacity: 0,
    duration: 0.3 * motionScale,
    ease: 'power2.in',
    onComplete: () => {
      overlay.hidden = true;
      gsap.set(overlay, { clearProps: 'opacity' });
    }
  });
}

function showComment(offset = 0) {
  if (!resultComments.length) return;
  commentIndex = (commentIndex + offset + resultComments.length) % resultComments.length;
  if (resultCopy) resultCopy.textContent = resultComments[commentIndex];
  if (resultCopy) gsap.fromTo(resultCopy, { x: offset * 10, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 * motionScale });
}

function buzz(pattern: VibratePattern) {
  if (hapticEnabled) navigator.vibrate?.(pattern);
}

function tone(frequency = 440, duration = 0.08) {
  if (!soundEnabled) return;
  audioContext ||= new AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.05, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function screenToWorldY(screenY: number) {
  return HEIGHT / 2 - screenY;
}

function catchUpIndex(progressY: number[]) {
  const leader = Math.min(...progressY);
  const last = Math.max(...progressY);
  return progressY.length > 1 && last - leader >= CATCH_UP_GAP ? progressY.lastIndexOf(last) : -1;
}

console.assert(catchUpIndex([0, 20, 60]) === 2 && catchUpIndex([0, 20]) === -1, 'catch-up selection failed');

function isRiverZone(worldY: number) {
  const courseY = HEIGHT / 2 - worldY;
  return courseY >= RIVER_TOP_Y && courseY <= RIVER_BOTTOM_Y;
}

function isWater(x: number, worldY: number) {
  return isRiverZone(worldY) && Math.abs(x) > BRIDGE_HALF_WIDTH;
}

function canSpawnObstacle(theme: string, worldY: number) {
  return theme === 'night' || !isRiverZone(worldY);
}

console.assert(isRiverZone(screenToWorldY(1500)) && !isRiverZone(screenToWorldY(1200)), 'river zone failed');
console.assert(!isWater(0, screenToWorldY(1500)) && isWater(100, screenToWorldY(1500)), 'bridge zone failed');
console.assert(canSpawnObstacle('night', screenToWorldY(1500)), 'night obstacle river spawn failed');

function makeWall() {
  const course = createCourse({
    width: WIDTH,
    courseHeight: COURSE_HEIGHT,
    startLineY: START_LINE_Y,
    floorY: FLOOR_Y,
    wallZ: WALL_Z,
    activeTheme,
    screenToWorldY
  });
  ({
    wall: courseWall,
    markers: courseMarkers,
    nightMarkers: courseNightMarkers,
    dayCourseTexture,
    nightCourseTexture
  } = course);
  if (courseWall && courseMarkers && courseNightMarkers) {
    scene.add(courseWall, courseMarkers, courseNightMarkers);
  }
}

function clearMountains() {
  mountains.forEach((item: any) => {
    const { body, visual } = item;
    world.removeRigidBody(body);
    scene.remove(visual);
    visual.traverse((child: any) => {
      child.geometry?.dispose();
      child.material?.dispose();
    });
  });
  mountains = [];
}

function makeMountainVisual(width: number, height: number, color: number) {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(1, 10, 6);
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x405344 })
  );
  outline.scale.set(width, height, 11);
  outline.position.y = height * 0.55;
  const rock = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  rock.scale.set(width * 0.88, height * 0.82, 12);
  rock.position.set(0, height * 0.58, 2);
  const highlight = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xd8d0b8 }));
  highlight.scale.set(width * 0.24, height * 0.16, 2);
  highlight.position.set(-width * 0.25, height * 0.9, 15);
  group.add(outline, rock, highlight);
  return group;
}

function createMountains() {
  clearMountains();
  const colors = [0x9d9a86, 0x858e82, 0xa7a18c, 0x7d8981, 0x96917f];
  for (let index = 0; index < 5; index += 1) {
    const width = 34 + Math.random() * 9;
    const height = 18 + Math.random() * 7;
    const x = -105 + Math.random() * 210;
    const y = screenToWorldY(560 + index * 380 + (Math.random() - 0.5) * 46);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, GRIP_Z));
    const slopeLength = Math.hypot(width, height);
    const angle = Math.atan2(height, width);
    for (const side of [-1, 1]) {
      const rotation = side * -angle;
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(slopeLength / 2, 3, 10)
          .setTranslation(side * width / 2, height / 2, 0)
          .setRotation({ x: 0, y: 0, z: Math.sin(rotation / 2), w: Math.cos(rotation / 2) })
          .setFriction(0)
          .setRestitution(0.16),
        body
      );
    }
    const visual = makeMountainVisual(width, height, colors[index]);
    visual.position.set(x, y, GRIP_Z);
    scene.add(visual);
    mountains.push({ body, visual } as any);
  }
}

function makeFabricTexture() {
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

const fabricTexture = makeFabricTexture();
const sphereGeometry = new THREE.SphereGeometry(1, 16, 10);

function makeVisual(key: CharacterKey, targetScene = scene) {
  const group = new THREE.Group();
  const doll = new THREE.Group();
  const accents: THREE.Object3D[] = [];
  group.add(doll);
  const fur = new THREE.MeshStandardMaterial({ color: COLORS[key], map: fabricTexture, bumpMap: fabricTexture, bumpScale: 0.8, roughness: 1 });
  const dark = new THREE.MeshBasicMaterial({ color: key === 'cat' ? 0xd8d6df : 0x332b30 });
  const pink = new THREE.MeshBasicMaterial({ color: 0xe89b9b });
  const orange = new THREE.MeshStandardMaterial({ color: 0xe9873a, roughness: 0.9 });
  const paw = new THREE.MeshStandardMaterial({ color: key === 'duck' ? 0xe99a47 : key === 'bear' ? 0xe8d4bf : key === 'turtle' ? 0xc5d891 : 0xe5a3a5, roughness: 0.95 });

  const ball = (scale: [number, number, number], position: [number, number, number], material: THREE.Material = fur) => {
    const mesh = new THREE.Mesh(sphereGeometry, material);
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

  if (key === 'turtle') {
    const shell = new THREE.MeshStandardMaterial({ color: 0x557a43, map: fabricTexture, bumpMap: fabricTexture, bumpScale: 1, roughness: 1 });
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
  }

  const normalEyes: THREE.Mesh[] = [
    ball([1.8, 2.2, 0.9], [-6.2, 28.5, 11], dark),
    ball([1.8, 2.2, 0.9], [6.2, 28.5, 11], dark)
  ];
  if (key === 'cat') {
    const pupil = new THREE.MeshBasicMaterial({ color: 0x28242c });
    normalEyes.push(ball([0.7, 1.2, 0.5], [-6.2, 28.5, 12], pupil), ball([0.7, 1.2, 0.5], [6.2, 28.5, 12], pupil));
  }
  if (key === 'duck') accents.push(ball([5.8, 2.9, 2.4], [0, 22, 12], orange));
  else ball([2.7, 2.2, 1.6], [0, 22.5, 12], key === 'rabbit' ? pink : dark);
  ball([4.2, 4.2, 1.8], [-34, 26, 7], paw);
  ball([4.2, 4.2, 1.8], [34, 26, 7], paw);
  ball([4.5, 4.5, 1.8], [-16, -45, 7], paw);
  ball([4.5, 4.5, 1.8], [16, -45, 7], paw);

  const tailSize = key === 'rabbit' ? 6 : key === 'turtle' ? 3 : 4.5;
  ball([tailSize, tailSize, 3], [0, -3, -10], fur);

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

function setExpression(visual: THREE.Group, expression = 'neutral') {
  const { faces } = visual.userData;
  faces.normalEyes.forEach((eye: THREE.Mesh) => { eye.visible = expression !== 'hit' && expression !== 'result'; });
  faces.ready.visible = expression === 'ready';
  faces.hit.visible = expression === 'hit';
  faces.result.visible = expression === 'result';
}

function renderCharacterPreviews() {
  const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  previewRenderer.setSize(180, 180, false);
  previewRenderer.setPixelRatio(1);
  previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
  const previewScene = new THREE.Scene();
  const previewCamera = new THREE.OrthographicCamera(-58, 58, 68, -58, 0.1, 400);
  previewCamera.position.z = 180;
  previewScene.add(new THREE.HemisphereLight(0xffffff, 0x756477, 2.4));
  const light = new THREE.DirectionalLight(0xffffff, 2.2);
  light.position.set(-80, 100, 160);
  previewScene.add(light);
  const previews: Record<CharacterKey, { ready: string; result: string }> = {} as any;
  CHARACTER_KEYS.forEach((key) => {
    const model = makeVisual(key, previewScene);
    model.rotation.y = -0.08;
    setExpression(model, 'ready');
    previewRenderer.render(previewScene, previewCamera);
    const ready = previewRenderer.domElement.toDataURL('image/png');
    setExpression(model, 'result');
    previewRenderer.render(previewScene, previewCamera);
    previews[key] = { ready, result: previewRenderer.domElement.toDataURL('image/png') };
    previewScene.remove(model);
    model.traverse((part: any) => {
      if (!part.isMesh) return;
      if (part.geometry !== sphereGeometry) part.geometry.dispose();
      part.material.dispose();
    });
  });
  previewRenderer.dispose();
  return previews;
}

function padWorld(racer: Racer, padIndex: number) {
  const translation = racer.body.translation();
  const rotation = racer.body.rotation();
  return PAD_POINTS[padIndex].clone()
    .applyQuaternion(new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w))
    .add(new THREE.Vector3(translation.x, translation.y, translation.z));
}

function attachPad(racer: Racer, padIndex: number) {
  if (racer.anchors.some((anchor) => anchor.padIndex === padIndex)) return;
  const point = padWorld(racer, padIndex);
  const anchorBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(point.x, point.y, GRIP_Z)
  );
  const joint = world.createImpulseJoint(
    RAPIER.JointData.spherical({ x: 0, y: 0, z: 0 }, PAD_POINTS[padIndex]),
    anchorBody,
    racer.body,
    true
  );
  racer.anchors.push({ padIndex, anchorBody, joint });
}

function detachPad(racer: Racer, anchor: any) {
  world.removeImpulseJoint(anchor.joint, true);
  world.removeRigidBody(anchor.anchorBody);
  racer.anchors.splice(racer.anchors.indexOf(anchor), 1);
}

function anchorProgressY(racer: Racer) {
  return Math.min(...racer.anchors.map((anchor) => anchor.anchorBody.translation().y));
}

function nextPad(racer: Racer) {
  const occupied = new Set(racer.anchors.map((anchor) => anchor.padIndex));
  const anchor = racer.anchors[0].anchorBody.translation();
  const anchorIsHand = racer.anchors[0].padIndex < 2;
  return [0, 1, 2, 3]
    .filter((index) => !occupied.has(index)
      && (index < 2) !== anchorIsHand
      && padWorld(racer, index).y < anchor.y - 28)
    .sort((a, b) => {
      const pointA = padWorld(racer, a);
      const pointB = padWorld(racer, b);
      return Math.abs(pointA.z - GRIP_Z) - Math.abs(pointB.z - GRIP_Z)
        || pointA.y - pointB.y
        || Math.abs(pointA.x - anchor.x) - Math.abs(pointB.x - anchor.x);
    })[0];
}

function beginFlip(racer: Racer) {
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

function releaseExtraPad(racer: Racer) {
  detachPad(racer, racer.anchors[0]);
  if (racer.anchors.length === 1) beginFlip(racer);
}

function landOnNextPad(racer: Racer) {
  attachPad(racer, nextPad(racer));
  racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  racer.stickDuration = 0.5 + Math.random() * 0.35;
  racer.gripElapsed = -racer.stickDuration;
  racer.isFlipping = false;
}

function rotationSinceFlip(racer: Racer) {
  const current = racer.body.rotation();
  const start = racer.flipStart;
  const dot = Math.abs(current.x * start.x + current.y * start.y + current.z * start.z + current.w * start.w);
  return 2 * Math.acos(Math.min(1, dot));
}

function createBodyColliders(index: number, body: RAPIER.RigidBody) {
  const add = (hx: number, hy: number, hz: number, radius: number, x: number, y: number, angle = 0) => {
    const rotation = { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) };
    const collider = world.createCollider(
      RAPIER.ColliderDesc.roundCuboid(hx, hy, hz, radius)
        .setTranslation(x, y, 0)
        .setRotation(rotation)
        .setDensity(0.0007)
        .setFriction(0)
        .setRestitution(0.18)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    colliderRacers.set(collider.handle, index);
  };

  add(21, 24, 4, 7, 0, -4);
}

function createMole() {
  const group = new THREE.Group();
  const brown = new THREE.MeshStandardMaterial({ color: 0x765038, roughness: 1 });
  const dirt = new THREE.Mesh(new THREE.SphereGeometry(22, 16, 8), brown);
  dirt.scale.set(1.5, 0.22, 0.45);
  dirt.position.z = -2;
  const loader = new THREE.TextureLoader();
  const moleTexture = loader.load(new URL('./assets/obstacles/mole-plush.webp', import.meta.url).href);
  const ghostTexture = loader.load(new URL('./assets/obstacles/ghost-plush.webp', import.meta.url).href);
  moleTexture.colorSpace = THREE.SRGBColorSpace;
  ghostTexture.colorSpace = THREE.SRGBColorSpace;
  const head = new THREE.Mesh(
    new THREE.PlaneGeometry(92, 78),
    new THREE.MeshBasicMaterial({ map: activeTheme === 'night' ? ghostTexture : moleTexture, transparent: true, alphaTest: 0.04 })
  );
  head.position.set(0, 18, 2);
  group.add(dirt, head);
  scene.add(group);

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
  const collider = world.createCollider(
    RAPIER.ColliderDesc.ball(40)
      .setRestitution(1.8)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
    body
  );
  collider.setEnabled(false);
  return { group, dirt, head, body, collider, moleTexture, ghostTexture, phase: 'hidden', timer: 1.2, hit: 0 };
}

function resetMole() {
  mole.phase = 'hidden';
  mole.timer = THREE.MathUtils.randFloat(0.5, 1);
  mole.group.visible = false;
  mole.collider.setEnabled(false);
  console.assert(!mole.collider.isEnabled(), 'mole reset failed');
}

function ghostStep(x: number, direction: number, dt: number) {
  const next = x + direction * GHOST_SPEED * dt;
  if (direction > 0 && next >= EDGE_SOFT_LIMIT) return { x: EDGE_SOFT_LIMIT, direction: -1 };
  if (direction < 0 && next <= -EDGE_SOFT_LIMIT) return { x: -EDGE_SOFT_LIMIT, direction: 1 };
  return { x: next, direction };
}

console.assert(ghostStep(140, 1, 0.1).direction === -1, 'ghost turn failed');

function updateGhost(dt: number) {
  mole.timer -= dt;
  mole.hit = Math.max(0, mole.hit - dt);
  if (mole.phase === 'hidden') {
    if (mole.timer > 0) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    mole.direction = -side;
    mole.flightY = cameraY - THREE.MathUtils.randFloat(190, 330);
    mole.group.position.set(side * (WIDTH / 2 + 55), mole.flightY, 15);
    mole.group.visible = true;
    mole.dirt.visible = false;
    mole.collider.setEnabled(true);
    mole.phase = 'flying';
    mole.timer = GHOST_FLY_TIME;
  } else if (mole.timer <= 0) {
    mole.phase = 'hidden';
    mole.timer = THREE.MathUtils.randFloat(0.7, 1.3);
    mole.group.visible = false;
    mole.collider.setEnabled(false);
    return;
  }

  const flightY = mole.flightY ?? cameraY;
  const step = ghostStep(mole.group.position.x, mole.direction ?? 1, dt);
  mole.direction = step.direction;
  const y = flightY + Math.sin(raceElapsed * 4) * 6;
  mole.group.position.set(step.x, y, 15);
  mole.body.setNextKinematicTranslation({ x: step.x, y, z: 15 });
  const squash = mole.hit ? Math.sin(mole.hit / 0.18 * Math.PI) * 0.35 : 0;
  mole.head.scale.set(1 + squash, 1 - squash * 0.45, 1);
  mole.head.position.y = 18;
}

function updateMole(dt: number) {
  if (!running) return;
  if (activeTheme === 'night') {
    updateGhost(dt);
    return;
  }
  mole.timer -= dt;
  mole.hit = Math.max(0, mole.hit - dt);
  if (mole.timer <= 0) {
    if (mole.phase === 'hidden') {
      const x = THREE.MathUtils.randFloat(-125, 125);
      const y = cameraY - THREE.MathUtils.randFloat(190, 330);
      if (!canSpawnObstacle(activeTheme, y)) {
        mole.timer = 0.25;
        return;
      }
      mole.body.setNextKinematicTranslation({ x, y, z: 15 });
      mole.group.position.set(x, y, 15);
      mole.group.visible = true;
      mole.dirt.visible = activeTheme === 'day';
      mole.phase = 'warning';
      mole.timer = 0.5;
    } else if (mole.phase === 'warning') {
      mole.phase = 'up';
      mole.timer = MOLE_UP_TIME;
      mole.collider.setEnabled(true);
    } else {
      mole.phase = 'hidden';
      mole.timer = THREE.MathUtils.randFloat(0.4, 1);
      mole.group.visible = false;
      mole.collider.setEnabled(false);
    }
  }
  if (!mole.group.visible) return;
  const warning = mole.phase === 'warning';
  mole.dirt.scale.x = 1.5 + Math.sin(mole.timer * 35) * (warning ? 0.16 : 0.03);
  const pop = warning ? 0.01 : Math.min(1, (MOLE_UP_TIME - mole.timer) * 7, mole.timer * 7);
  const squash = mole.hit ? Math.sin(mole.hit / 0.18 * Math.PI) * 0.35 : 0;
  mole.head.scale.set(1 + squash, Math.max(0.01, pop - squash * 0.45), 1);
  mole.head.position.y = 18;
}

function createRacer(index: number): Racer {
  const x = -136.5 + index * 91;
  const initialGrip = 0.65 + Math.random() * 0.25;
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(x, screenToWorldY(START_Y), 5)
      .setLinearDamping(0.35)
      .setAngularDamping(0.7)
      .setCcdEnabled(true)
      .setAdditionalSolverIterations(8)
  );
  createBodyColliders(index, body);
  const label = document.createElement('div');
  label.className = 'player-label';
  label.textContent = DEFAULT_NAMES[index];
  game.append(label);
  const racer: Racer = {
    index,
    body,
    visual: makeVisual(KEYS[index]),
    characterKey: KEYS[index],
    label,
    anchors: [],
    gripElapsed: -initialGrip,
    flipStart: { ...body.rotation() },
    flipAxisX: 1,
    isFlipping: false,
    knockbackUntil: 0,
    expressionUntil: 0,
    stickDuration: initialGrip,
    lastProgressY: screenToWorldY(START_Y),
    stalledFor: 0,
    placed: false,
    active: true
  };
  START_PADS[index].forEach((pad) => attachPad(racer, pad));
  racer.lastProgressY = anchorProgressY(racer);
  racer.knockbackUntil = 0;
  racer.expressionUntil = 0;
  body.setAngvel({ x: 0, y: 0, z: 0.05 * (index % 2 ? 1 : -1) }, true);
  return racer;
}

function placeRacer(racer: Racer, x: number, worldY: number) {
  [...racer.anchors].forEach((anchor) => detachPad(racer, anchor));
  racer.body.setTranslation({ x, y: worldY, z: 5 }, true);
  racer.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  racer.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  racer.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  START_PADS[racer.index].forEach((pad) => attachPad(racer, pad));
  racer.lastProgressY = anchorProgressY(racer);
}

function recoverStalledRacer(racer: Racer) {
  const position = racer.body.translation();
  const y = position.y - 72;
  placeRacer(racer, THREE.MathUtils.clamp(position.x, -EDGE_SOFT_LIMIT, EDGE_SOFT_LIMIT), y);
  racer.isFlipping = false;
  racer.stickDuration = 0.18;
  racer.gripElapsed = -racer.stickDuration;
  racer.stalledFor = 0;
  console.assert(racer.anchors.length === START_PADS[racer.index].length, 'stalled racer recovery failed');
}

function resetRace() {
  applyTheme(themeMode);
  running = false;
  finished = false;
  raceElapsed = 0;
  shakeBoostUntil = 0;
  lastMotionMagnitude = undefined;
  cameraY = 0;
  camera.position.y = 0;
  if (result) result.hidden = true;
  createMountains();
  resetMole();
  const active = racers.filter((racer) => racer.active);
  active.forEach((racer, index) => {
    placeRacer(racer, (index - (active.length - 1) / 2) * RACER_GAP_X, screenToWorldY(START_Y));
    racer.placed = false;
    racer.isFlipping = false;
    racer.stickDuration = 0;
    racer.gripElapsed = 0;
    racer.stalledFor = 0;
    racer.knockbackUntil = 0;
    racer.expressionUntil = 0;
    setExpression(racer.visual, 'ready');
  });
  if (status) status.textContent = '준비';
  if (raceTimer) raceTimer.textContent = '00:00.00';
  if (guide) {
    guide.textContent = '캐릭터 위치를 정한 뒤 데굴이 출발';
    guide.disabled = false;
    guide.hidden = false;
  }
}

function setParticipants(names: string[], characterKeys: CharacterKey[]) {
  racers.forEach((racer, index) => {
    racer.active = index < names.length;
    if (racer.active && racer.characterKey !== characterKeys[index]) {
      scene.remove(racer.visual);
      racer.visual.traverse((part: any) => {
        if (!part.isMesh) return;
        if (part.geometry !== sphereGeometry) part.geometry.dispose();
        part.material.dispose();
      });
      racer.characterKey = characterKeys[index];
      racer.visual = makeVisual(racer.characterKey);
    }
    racer.visual.visible = racer.active;
    racer.label.hidden = !racer.active;
    if (racer.active) racer.label.textContent = names[index];
    else [...racer.anchors].forEach((anchor) => detachPad(racer, anchor));
    racer.body.setEnabled(racer.active);
  });
  resetRace();
}

function pointerWorld(event: PointerEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width - 0.5) * (camera.right - camera.left);
  const y = camera.position.y + (0.5 - (event.clientY - rect.top) / rect.height) * HEIGHT;
  return { x, y };
}

function nearestOpenPosition(racer: Racer, targetX: number, targetY: number) {
  const others = racers.filter((item) => item.active && item !== racer).map((item) => item.body.translation());
  const current = racer.body.translation();
  let x = targetX;
  let y = targetY;
  for (let pass = 0; pass < 8; pass += 1) {
    others.forEach((position) => {
      PLACEMENT_PARTS.forEach((part) => {
        PLACEMENT_PARTS.forEach((otherPart) => {
          const width = part.rx + otherPart.rx;
          const height = part.ry + otherPart.ry;
          let dx = x + part.x - position.x - otherPart.x;
          let dy = y + part.y - position.y - otherPart.y;
          let distance = Math.hypot(dx / width, dy / height);
          if (distance >= 1) return;
          if (!distance) {
            dx = current.x - position.x || 1;
            dy = current.y - position.y;
            distance = Math.hypot(dx / width, dy / height);
          }
          const scale = 1.001 / distance;
          x = THREE.MathUtils.clamp(x + dx * (scale - 1), -160, 160);
          y = THREE.MathUtils.clamp(y + dy * (scale - 1), screenToWorldY(START_Y), screenToWorldY(105));
        });
      });
    });
  }
  const overlaps = others.some((position) => PLACEMENT_PARTS.some((part) => PLACEMENT_PARTS.some((otherPart) => (
    Math.hypot(
      (x + part.x - position.x - otherPart.x) / (part.rx + otherPart.rx),
      (y + part.y - position.y - otherPart.y) / (part.ry + otherPart.ry)
    ) < 1
  ))));
  return !overlaps
    ? { x, y }
    : current;
}

let draggedRacer: Racer | null = null;
renderer.domElement.addEventListener('pointerdown', (event: PointerEvent) => {
  if (running || finished) return;
  const point = pointerWorld(event);
  let closestDistance = 48;
  draggedRacer = null;
  racers.filter((racer) => racer.active).forEach((racer) => {
    const position = racer.body.translation();
    const distance = Math.hypot(position.x - point.x, position.y - point.y);
    if (distance < closestDistance) {
      closestDistance = distance;
      draggedRacer = racer;
    }
  });
  if (draggedRacer) renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event: PointerEvent) => {
  if (!draggedRacer) return;
  const point = pointerWorld(event);
  const position = nearestOpenPosition(
    draggedRacer,
    THREE.MathUtils.clamp(point.x, -160, 160),
    THREE.MathUtils.clamp(point.y, screenToWorldY(START_Y), screenToWorldY(105))
  );
  placeRacer(draggedRacer, position.x, position.y);
});
renderer.domElement.addEventListener('pointerup', () => { draggedRacer = null; });
renderer.domElement.addEventListener('pointercancel', () => { draggedRacer = null; });

function syncVisuals(dt: number) {
  let lowest = Infinity;
  if (running) raceElapsed = (performance.now() - raceStartedAt) / 1000;
  const activeRacers = racers.filter((racer) => racer.active);
  const boostedRacer = activeRacers[catchUpIndex(activeRacers.map((racer) => racer.body.translation().y))];
  racers.forEach((racer) => {
    if (!racer.active) return;
    const position = racer.body.translation();
    const rotation = racer.body.rotation();
    if (running && racer.expressionUntil && raceElapsed >= racer.expressionUntil) {
      racer.expressionUntil = 0;
      setExpression(racer.visual);
    }
    racer.visual.position.set(position.x, position.y, position.z);
    racer.visual.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    const sticking = racer.anchors.length > 1 && !racer.isFlipping && racer.gripElapsed < 0;
    const squeeze = sticking ? Math.sin(Math.PI * (1 + racer.gripElapsed / racer.stickDuration)) * 0.08 : 0;
    racer.visual.scale.set(1 + squeeze * 0.45, 1 - squeeze * 0.35, 1 - squeeze);
    const { doll, accents, key } = racer.visual.userData;
    const characterMotion = running ? raceElapsed : 0;
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
    }
    if (running) {
      const progressY = anchorProgressY(racer);
      if (progressY < racer.lastProgressY - 18) {
        racer.lastProgressY = progressY;
        racer.stalledFor = 0;
      } else racer.stalledFor += dt;
      if (racer.stalledFor > 2.5 && raceElapsed > 4) {
        recoverStalledRacer(racer);
      }
      const shakeBoosted = performance.now() < shakeBoostUntil;
      const catchUpBoost = racer === boostedRacer ? CATCH_UP_BOOST : 1;
      const speed = ROLL_SPEED * catchUpBoost * (shakeBoosted ? 3.2 : raceElapsed > RACE_RUSH_TIME ? 1.55 : 1);
      racer.gripElapsed += dt * speed;
      const firstRelease = racer.anchors.length > 1 && racer.gripElapsed >= 0;
      const readyToFlip = racer.anchors.length === 1 && !racer.isFlipping && racer.gripElapsed >= 0;
      const flipAngle = racer.isFlipping ? rotationSinceFlip(racer) : 0;
      const knockedBack = racer.knockbackUntil > raceElapsed;
      if (racer.isFlipping) {
        const angular = racer.body.angvel();
        const slowedByWater = isWater(position.x, position.y);
        const rollingSpeed = ROLL_SPEED * catchUpBoost * (2.5 + 6 * (1 - Math.exp(-racer.gripElapsed * 2))) * (shakeBoosted ? 1.45 : 1) * (slowedByWater ? WATER_SPEED : 1);
        if (knockedBack) {
          racer.body.setAngvel({ x: -racer.flipAxisX * 10, y: angular.y, z: angular.z }, true);
        } else if (slowedByWater || angular.x * racer.flipAxisX < rollingSpeed) {
          racer.body.setAngvel({ x: racer.flipAxisX * rollingSpeed, y: angular.y, z: angular.z }, true);
        }
      }
      const landingPad = racer.isFlipping ? nextPad(racer) : undefined;
      const landingPoint = landingPad === undefined ? null : padWorld(racer, landingPad);
      const lowerPadTouched = racer.isFlipping
        && landingPoint
        && landingPoint.y < racer.anchors[0].anchorBody.translation().y - 28
        && Math.abs(landingPoint.z - GRIP_Z) < 12;
      const completedFlip = racer.isFlipping
        && !knockedBack
        && racer.gripElapsed > 0.12
        && lowerPadTouched
        && flipAngle > 1.2;
      if (firstRelease) releaseExtraPad(racer);
      else if (readyToFlip) beginFlip(racer);
      else if (completedFlip) landOnNextPad(racer);
    }
    lowest = Math.min(lowest, position.y);

    const projected = new THREE.Vector3(position.x, position.y + 47, position.z).project(camera);
    racer.label.style.left = `${(projected.x * 0.5 + 0.5) * game.clientWidth}px`;
    racer.label.style.top = `${(-projected.y * 0.5 + 0.5) * game.clientHeight}px`;

    if (!racer.placed && position.y < screenToWorldY(FLOOR_Y)) {
      racer.placed = true;
      if (!finished) finishRace(racer);
    }
  });
  game.dataset.lowest = Number.isFinite(lowest) ? lowest.toFixed(1) : '';
  if (running) {
    const target = Math.min(0, lowest + 220);
    cameraY += (target - cameraY) * Math.min(1, dt * 3.2);
    camera.position.y = cameraY;
    const progress = Math.max(0, Math.min(99, Math.round((screenToWorldY(START_Y) - lowest) / (FLOOR_Y - START_Y) * 100)));
    const minutes = Math.floor(raceElapsed / 60);
    const seconds = Math.floor(raceElapsed % 60);
    const hundredths = Math.floor(raceElapsed * 100) % 100;
    if (raceTimer) raceTimer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
    if (status) status.textContent = performance.now() < shakeBoostUntil ? `흔들림 감지 · ${progress}%` : `데굴 중 ${progress}%`;
    if (raceElapsed >= RACE_LIMIT && !finished) {
      const choice = racers.filter((racer) => racer.active)
        .reduce((selected, racer) => racer.body.translation().y < selected.body.translation().y ? racer : selected);
      finishRace(choice);
    }
  }
}

function finishRace(racer: Racer) {
  finished = true;
  running = false;
  setExpression(racer.visual, 'result');
  if (status) status.textContent = '선택 완료';
  if (guide) guide.hidden = true;
  if (resultTitle && decisionQuestion) resultTitle.textContent = `“${decisionQuestion.value.trim()}”\n데굴이가 골랐어요`;
  if (resultCharacterImage && characterPreviews[racer.characterKey]) resultCharacterImage.src = characterPreviews[racer.characterKey].result;
  if (resultCharacterImage) resultCharacterImage.alt = `${CHARACTER_NAMES[racer.characterKey]} 캐릭터`;
  if (resultSpeech) resultSpeech.textContent = `내 선택은 이거야!\n${racer.label.textContent}`;
  const comments = ['데굴이가 하나를 골랐어요.', '고민 끝! 이걸로 가볼까요?', '가장 먼저 내려온 데굴이의 선택이에요.'];
  resultComments = comments;
  commentIndex = Math.floor(Math.random() * comments.length);
  showComment();
  const row = document.createElement('li');
  row.textContent = `데굴이의 선택: ${racer.label.textContent}`;
  if (resultList) resultList.replaceChildren(row);
  if (result) showOverlay(result);
  gsap.from('.result-character', { y: 16, opacity: 0, scale: 0.94, duration: 0.45 * motionScale, delay: 0.12 * motionScale, ease: 'back.out(1.8)' });
  if (resultList) gsap.from(resultList.children, { y: 18, opacity: 0, stagger: 0.08, duration: 0.4 * motionScale, delay: 0.18 * motionScale });
  tone(CHARACTER_TONES[racer.characterKey], 0.25);
  buzz([60, 40, 100]);
}

function resize() {
  renderer.setSize(game.clientWidth, game.clientHeight, false);
  const visibleHeight = HEIGHT;
  const visibleWidth = visibleHeight * game.clientWidth / game.clientHeight;
  camera.left = -visibleWidth / 2;
  camera.right = visibleWidth / 2;
  camera.top = visibleHeight / 2;
  camera.bottom = -visibleHeight / 2;
  camera.updateProjectionMatrix();
}

async function startRace() {
  if (running || finished) return;
  if (guide) guide.disabled = true;
  if (raceStart) raceStart.hidden = false;
  signalLights.forEach((light) => light.className = '');
  for (let count = 3; count > 0; count -= 1) {
    if (startCount) startCount.textContent = `${count}`;
    if (startCaption) startCaption.textContent = '데굴 준비 중';
    signalLights[3 - count].className = 'on';
    gsap.fromTo('.start-board', { scale: 0.78, rotation: -2 }, { scale: 1, rotation: 0, duration: 0.38 * motionScale, ease: 'back.out(2)' });
    if (startCount) gsap.fromTo(startCount, { scale: 1.55, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3 * motionScale, ease: 'power3.out' });
    tone(360 + (3 - count) * 80, 0.16);
    buzz(35);
    await wait(700);
  }
  signalLights.forEach((light) => light.className = 'go');
  if (startCount) startCount.textContent = '출발!';
  if (startCaption) startCaption.textContent = '데굴데굴 골라줘';
  if (startCount) gsap.fromTo(startCount, { scale: 0.65 }, { scale: 1.08, duration: 0.32 * motionScale, ease: 'back.out(2.4)' });
  gsap.fromTo(game, { x: -5 }, { x: 0, duration: 0.08, repeat: 5, yoyo: true, clearProps: 'x' });
  tone(820, 0.3);
  buzz([60, 35, 90]);
  raceElapsed = 0;
  raceStartedAt = performance.now();
  racers.filter((racer) => racer.active).forEach((racer) => setExpression(racer.visual));
  running = true;
  await wait(450);
  if (raceStart) raceStart.hidden = true;
  if (guide) guide.hidden = true;
  if (guide) guide.disabled = false;
}

async function boot() {
  await RAPIER.init();
  world = new RAPIER.World({ x: 0, y: -520, z: 0 });
  world.timestep = 1 / 60;
  eventQueue = new RAPIER.EventQueue(true);
  const wallBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, screenToWorldY(COURSE_HEIGHT / 2), WALL_Z - 2));
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(WIDTH / 2, COURSE_HEIGHT / 2, 500).setTranslation(0, 0, -499).setFriction(0),
    wallBody
  );
  for (const side of [-1, 1]) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(4, COURSE_HEIGHT / 2, 40)
        .setTranslation(side * (WIDTH / 2 + 4), 0, 10)
        .setFriction(0),
      wallBody
    );
  }
  makeWall();
  mole = createMole();
  if (themeSelect) applyTheme(themeSelect.value);
  racers = KEYS.map((_, index) => createRacer(index));
  characterPreviews = renderCharacterPreviews();
  syncCharacterOptions();
  resize();
  if (setupSubmit) setupSubmit.disabled = false;
  if (setupSubmit) setupSubmit.textContent = '데굴이들에게 골라달라고 하기';
  gsap.from('#setup-form', { opacity: 0, duration: 0.5 * motionScale, ease: 'power2.out' });
  gsap.from('.hero-title img', { scale: 0.8, opacity: 0.2, duration: 0.8 * motionScale, ease: 'back.out(1.6)' });
  if (setupDescription) gsap.fromTo(setupDescription, { opacity: 0.12 }, { opacity: 1, duration: 0.35 * motionScale });
  if (motionScale) gsap.to('.story-marquee-track', { xPercent: -50, duration: 22, repeat: -1, ease: 'none' });

  let previous = performance.now();
  let accumulator = 0;
  function frame(now: number) {
    const dt = Math.min((now - previous) / 1000, 0.05);
    previous = now;
    if (running) {
      accumulator += dt;
      while (accumulator >= 1 / 60) {
        updateMole(world.timestep);
        racers.forEach((racer) => {
          if (!racer.active) return;
          const x = racer.body.translation().x;
          const edgeDepth = Math.abs(x) - EDGE_SOFT_LIMIT;
          if (edgeDepth > 0) {
            const impulse = (EDGE_INWARD_FORCE + edgeDepth * 2) * world.timestep * racer.body.mass();
            racer.body.applyImpulse({ x: -Math.sign(x) * impulse, y: 0, z: 0 }, true);
          }
        });
        world.step(eventQueue);
        const impacted = new Set<number>();
        eventQueue.drainCollisionEvents((handleA: number, handleB: number, started: boolean) => {
          const racerA = colliderRacers.get(handleA);
          const racerB = colliderRacers.get(handleB);
          if (started && racerA !== undefined && racerB !== undefined && racerA !== racerB) {
            impacted.add(racerA);
            impacted.add(racerB);
          }
          const moleHit = handleA === mole.collider.handle ? racerB : handleB === mole.collider.handle ? racerA : undefined;
          if (started && moleHit !== undefined) {
            const racer = racers[moleHit];
            const direction = Math.sign(racer.body.translation().x - mole.body.translation().x) || 1;
            const mass = racer.body.mass();
            while (racer.anchors.length > 1) detachPad(racer, racer.anchors[0]);
            if (!racer.isFlipping) beginFlip(racer);
            racer.knockbackUntil = raceElapsed + 0.65;
            racer.expressionUntil = raceElapsed + 0.7;
            setExpression(racer.visual, 'hit');
            racer.body.applyImpulse({ x: direction * mass * 380, y: mass * 440, z: 0 }, true);
            mole.hit = 0.18;
            gsap.fromTo(game, { x: -direction * 9, scale: 1.015 }, { x: 0, scale: 1, duration: 0.07, repeat: 3, yoyo: true, clearProps: 'x,scale' });
            tone(120, 0.16);
            buzz([70, 30, 110]);
          }
        });
        impacted.forEach((index) => {
          const racer = racers[index];
          if (!racer) return;
          if (racer.anchors.length > 1) racer.gripElapsed += 0.14;
        });
        accumulator -= 1 / 60;
      }
    }
    syncVisuals(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (guide) {
  guide.addEventListener('click', async () => {
    await enableMotionSensor();
    startRace();
  });
}
if (setupForm) {
  setupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const activeParticipants = nameInputs.map((input, index) => ({ name: input.value.trim(), character: (characterSelects[index] as HTMLSelectElement).value })).filter(({ name }) => name);
    const names = activeParticipants.map(({ name }) => name);
    if (names.length < 2) {
      nameInputs.find((input) => !input.value.trim())?.focus();
      return;
    }
    const soundToggle = document.querySelector<HTMLInputElement>('#sound-toggle');
    const hapticToggle = document.querySelector<HTMLInputElement>('#haptic-toggle');
    soundEnabled = soundToggle ? soundToggle.checked : true;
    hapticEnabled = hapticToggle ? hapticToggle.checked : true;
    if (themeSelect) applyTheme(themeSelect.value);
    const characterKeys = activeParticipants.map(({ character }) => character as CharacterKey);
    if (raceQuestion && decisionQuestion) raceQuestion.textContent = decisionQuestion.value.trim();
    setParticipants(names, characterKeys);
    if (setup) hideOverlay(setup);
    tone(420);
  });
}
function syncCharacterOptions() {
  const active = characterSelects.map((_, index) => index < 2 || Boolean(nameInputs[index]?.value.trim()));
  const claimed = new Set<string>();
  characterSelects.forEach((select, index) => {
    if (!active[index]) return;
    if (claimed.has(select.value)) select.value = CHARACTER_KEYS.find((key) => !claimed.has(key)) || select.value;
    claimed.add(select.value);
  });
  characterSelects.forEach((select, index) => {
    const used = new Set(characterSelects.filter((_, otherIndex) => otherIndex !== index && active[otherIndex]).map((item) => item.value));
    Array.from(select.options).forEach((option) => { option.disabled = used.has(option.value); });
    const disabled = !active[index];
    if (characterPickers[index]) characterPickers[index].setAttribute('aria-disabled', String(disabled));
    if (characterPickers[index]) characterPickers[index].querySelectorAll('button').forEach((button) => { button.disabled = disabled; });
    if (characterPreviewLabels[index]) characterPreviewLabels[index].textContent = active[index] ? CHARACTER_NAMES[select.value as CharacterKey] : '이름 입력 후 선택';
    if (characterPreviews[select.value] && characterPreviewImages[index]) characterPreviewImages[index].src = characterPreviews[select.value].ready;
  });
}
characterSelects.forEach((select, index) => {
  select.replaceChildren(...CHARACTER_KEYS.map((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = CHARACTER_NAMES[key];
    return option;
  }));
  select.value = KEYS[index];
  select.addEventListener('change', syncCharacterOptions);
});
function stepCharacter(index: number, direction: number) {
  const select = characterSelects[index];
  const available = Array.from(select.options).filter((option) => !option.disabled || option.selected).map((option) => option.value);
  const next = (available.indexOf(select.value) + direction + available.length) % available.length;
  select.value = available[next];
  syncCharacterOptions();
  if (characterPreviewImages[index]) gsap.fromTo(characterPreviewImages[index], { x: direction * 18, opacity: 0.25 }, { x: 0, opacity: 1, duration: 0.25 * motionScale });
}

const swipeDirection = (distance: number) => Math.abs(distance) >= 30 ? -Math.sign(distance) : 0;
console.assert(swipeDirection(-40) === 1 && swipeDirection(20) === 0, 'character swipe failed');

characterSteps.forEach((button) => button.addEventListener('click', () => {
  const participant = button.closest('.participant') as HTMLElement;
  if (participant) stepCharacter(participants.indexOf(participant), Number(button.dataset.direction));
}));
characterPickers.forEach((picker, index) => {
  const preview = picker.querySelector<HTMLElement>('.mini-character-preview');
  if (!preview) return;
  let startX = 0;
  preview.addEventListener('pointerdown', (event: PointerEvent) => {
    startX = event.clientX;
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener('pointerup', (event: PointerEvent) => {
    const direction = swipeDirection(event.clientX - startX);
    if (direction && picker.getAttribute('aria-disabled') !== 'true') stepCharacter(index, direction);
  });
});
nameInputs.forEach((input) => input.addEventListener('input', syncCharacterOptions));
if (themeSelect) themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));
setInterval(() => {
  if (themeMode === 'auto' && themeForMode('auto') !== activeTheme) applyTheme('auto');
}, 60000);
syncCharacterOptions();
const replayBtn = document.querySelector('#replay');
if (replayBtn) {
  replayBtn.addEventListener('click', () => {
    resetRace();
    startRace();
  });
}
const editPlayersBtn = document.querySelector('#edit-players');
if (editPlayersBtn) {
  editPlayersBtn.addEventListener('click', () => {
    if (result) result.hidden = true;
    if (setup) showOverlay(setup);
  });
}
if (commentPrev) commentPrev.addEventListener('click', () => showComment(-1));
if (commentNext) commentNext.addEventListener('click', () => showComment(1));
addEventListener('resize', resize);
boot().catch((error) => {
  console.error(error);
  if (errorBox) errorBox.style.display = 'grid';
});
