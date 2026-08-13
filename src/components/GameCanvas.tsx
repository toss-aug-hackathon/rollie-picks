import React, { useEffect, useRef } from 'react';
import { CharacterKey, CharacterPreviewMap, GameEngine, GameEngineOptions, ThemeMode } from '../game/engine';

interface GameCanvasProps {
  onEngineReady: (engine: GameEngine) => void;
  onEngineError: () => void;
  onThemeLoadingChange: (loading: boolean) => void;
  onTimerUpdate: (time: string) => void;
  onStatusUpdate: (status: string) => void;
  onProgressUpdate: (progress: number) => void;
  onCountdownUpdate: (count: string, visible: boolean) => void;
  onFinish: (winnerName: string, winnerChar: any, winnerSpeech: string, rankings: any[]) => void;
  participants: Array<{ name: string; characterKey: CharacterKey }>;
  onCharacterPreviewsReady: (previews: CharacterPreviewMap) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  themeMode: ThemeMode;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  onEngineReady,
  onEngineError,
  onThemeLoadingChange,
  onTimerUpdate,
  onStatusUpdate,
  onProgressUpdate,
  onCountdownUpdate,
  onFinish,
  participants,
  onCharacterPreviewsReady,
  soundEnabled,
  hapticEnabled,
  themeMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const engineReadyRef = useRef(false);
  const themeModeRef = useRef(themeMode);
  const participantsRef = useRef(participants);
  themeModeRef.current = themeMode;
  participantsRef.current = participants;

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    const options: GameEngineOptions = {
      canvas: canvasRef.current,
      onTimerUpdate,
      onStatusUpdate,
      onProgressUpdate,
      onCountdownUpdate,
      onPlayerLabelsUpdate: () => {},
      onFinish,
      onCharacterPreviewsReady
    };

    const engine = new GameEngine(options);
    engineRef.current = engine;
    onThemeLoadingChange(true);
    void engine.setThemeMode(themeModeRef.current);

    engine.init()
      .then(async () => {
        await engine.setThemeMode(themeModeRef.current);
        if (cancelled) return;
        // Initialization can finish after the user has already filled and
        // submitted the setup form. Always use the latest participant state.
        engine.setParticipants(participantsRef.current);
        engineReadyRef.current = true;
        onThemeLoadingChange(false);
        onEngineReady(engine);
      })
      .catch(() => {
        if (!cancelled) {
          onThemeLoadingChange(false);
          onEngineError();
        }
      });

    return () => {
      cancelled = true;
      engineReadyRef.current = false;
      engine.destroy();
    };
  }, []);

  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setParticipants(participants);
      engineRef.current.setSoundEnabled(soundEnabled);
      engineRef.current.setHapticEnabled(hapticEnabled);
    }
  }, [participants, soundEnabled, hapticEnabled]);

  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !engineReadyRef.current) return;

    let cancelled = false;
    onThemeLoadingChange(true);
    void engine.setThemeMode(themeMode)
      .then(() => {
        if (!cancelled) onThemeLoadingChange(false);
      })
      .catch(() => {
        if (!cancelled) {
          onThemeLoadingChange(false);
          onEngineError();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [themeMode]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        touchAction: 'none',
        zIndex: 1
      }}
    />
  );
};
