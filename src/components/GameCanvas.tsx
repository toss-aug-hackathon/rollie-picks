import React, { useEffect, useRef } from 'react';
import { GameEngine, GameEngineOptions, ThemeMode } from '../game/engine';

interface GameCanvasProps {
  onEngineReady: (engine: GameEngine) => void;
  onTimerUpdate: (time: string) => void;
  onStatusUpdate: (status: string) => void;
  onCountdownUpdate: (count: string, visible: boolean) => void;
  onFinish: (winnerName: string, winnerChar: any, winnerSpeech: string, rankings: any[]) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  themeMode: ThemeMode;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onEngineReady,
  onTimerUpdate,
  onStatusUpdate,
  onCountdownUpdate,
  onFinish,
  soundEnabled,
  hapticEnabled,
  themeMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const options: GameEngineOptions = {
      canvas: canvasRef.current,
      onTimerUpdate,
      onStatusUpdate,
      onCountdownUpdate,
      onPlayerLabelsUpdate: () => {},
      onFinish
    };

    const engine = new GameEngine(options);
    engineRef.current = engine;

    engine.init().then(() => {
      onEngineReady(engine);
    });

    return () => {
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setSoundEnabled(soundEnabled);
      engineRef.current.setHapticEnabled(hapticEnabled);
      engineRef.current.setThemeMode(themeMode);
    }
  }, [soundEnabled, hapticEnabled, themeMode]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', touchAction: 'none' }} />;
};
