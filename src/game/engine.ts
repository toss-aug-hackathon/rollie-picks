import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import gsap from 'gsap';
import { createCourse, createMountainsMesh } from './course';

export type CharacterKey = 'bear' | 'rabbit' | 'cat' | 'duck' | 'ghost' | 'mole';
export type ThemeMode = 'auto' | 'day' | 'night';

export interface RacerInfo {
  name: string;
  characterKey: CharacterKey;
}

export interface PlayerLabelState {
  id: number;
  name: string;
  x: number;
  y: number;
  visible: boolean;
}

export interface GameEngineOptions {
  canvas: HTMLCanvasElement;
  onTimerUpdate: (timeStr: string) => void;
  onStatusUpdate: (status: string) => void;
  onCountdownUpdate: (countStr: string, visible: boolean) => void;
  onPlayerLabelsUpdate: (labels: PlayerLabelState[]) => void;
  onFinish: (winnerName: string, winnerChar: CharacterKey, winnerSpeech: string, rankings: { rank: number; name: string; charName: string; key: CharacterKey }[]) => void;
}

export const CHARACTER_DATA: Record<CharacterKey, { name: string; icon: string; preview: string; modelType: 'bear' | 'rabbit' | 'cat' | 'duck' | 'ghost' | 'mole' }> = {
  bear: { name: '곰', icon: '🐻', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'bear' },
  rabbit: { name: '토끼', icon: '🐰', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'rabbit' },
  cat: { name: '고양이', icon: '🐱', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'cat' },
  duck: { name: '오리', icon: '🐥', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'duck' },
  ghost: { name: '유령', icon: '👻', preview: 'assets/ghost-plush-PG6yuj_G.webp', modelType: 'ghost' },
  mole: { name: '두더지', icon: '🦔', preview: 'assets/mole-plush-DJrSbKGU.webp', modelType: 'mole' }
};

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private options: GameEngineOptions;
  
  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private world!: RAPIER.World;
  
  private isInitialized = false;
  private isRunning = false;
  private isFinished = false;
  private raceElapsed = 0;
  private activeTheme: 'day' | 'night' = 'day';
  private themeMode: ThemeMode = 'auto';

  private soundEnabled = true;
  private hapticEnabled = true;

  private animFrameId: number | null = null;
  private activeRacersCount = 2;

  constructor(options: GameEngineOptions) {
    this.canvas = options.canvas;
    this.options = options;
  }

  public async init() {
    if (this.isInitialized) return;

    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: 0, z: -9.81 });

    const width = this.canvas.clientWidth || 430;
    const height = this.canvas.clientHeight || 900;

    this.scene = new THREE.Scene();
    const aspect = width / height;
    const frustumSize = 10;
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      100
    );
    this.camera.position.set(0, 0, 10);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 7);
    this.scene.add(dirLight);

    this.isInitialized = true;
    this.startLoop();
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public setHapticEnabled(enabled: boolean) {
    this.hapticEnabled = enabled;
  }

  public setThemeMode(mode: ThemeMode) {
    this.themeMode = mode;
    const hour = new Date().getHours();
    this.activeTheme = mode === 'night' || (mode === 'auto' && (hour >= 19 || hour < 6)) ? 'night' : 'day';
    document.documentElement.setAttribute('data-theme', this.activeTheme);
  }

  public startRace() {
    this.isRunning = true;
    this.isFinished = false;
    this.raceElapsed = 0;
    this.options.onStatusUpdate('달리는 중');
  }

  public resetRace() {
    this.isRunning = false;
    this.isFinished = false;
    this.raceElapsed = 0;
    this.options.onTimerUpdate('00:00.00');
    this.options.onStatusUpdate('준비');
    this.options.onCountdownUpdate('3', false);
  }

  private startLoop = () => {
    const loop = () => {
      if (this.isInitialized) {
        if (this.isRunning && !this.isFinished) {
          this.world.step();
          this.raceElapsed += 16.6;
          const totalSec = this.raceElapsed / 1000;
          const mins = Math.floor(totalSec / 60);
          const secs = Math.floor(totalSec % 60);
          const ms = Math.floor((totalSec % 1) * 100);
          const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
          this.options.onTimerUpdate(formatted);
        }
        this.renderer.render(this.scene, this.camera);
      }
      this.animFrameId = requestAnimationFrame(loop);
    };
    loop();
  };

  public destroy() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.renderer?.dispose();
  }
}
