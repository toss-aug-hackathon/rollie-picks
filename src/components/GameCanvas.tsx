import React, { useEffect, useRef } from 'react';
import type { GameEngine, GameEngineOptions, LiveRankingItem } from '../game/engine';
import type { CharacterKey, CharacterPreviewMap, ThemeMode } from '../game/characters';

interface GameCanvasProps {
  onEngineReady: (engine: GameEngine) => void;
  onEngineError: () => void;
  onThemeLoadingChange: (loading: boolean) => void;
  onTimerUpdate: (time: string) => void;
  onStatusUpdate: (status: string) => void;
  onProgressUpdate: (progress: number) => void;
  onLiveRankingsUpdate: (rankings: LiveRankingItem[]) => void;
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
  onLiveRankingsUpdate,
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
  const soundEnabledRef = useRef(soundEnabled);
  const hapticEnabledRef = useRef(hapticEnabled);
  themeModeRef.current = themeMode;
  participantsRef.current = participants;
  soundEnabledRef.current = soundEnabled;
  hapticEnabledRef.current = hapticEnabled;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let engine: GameEngine | null = null;

    const options: GameEngineOptions = {
      canvas,
      onTimerUpdate,
      onStatusUpdate,
      onProgressUpdate,
      onCountdownUpdate,
      onPlayerLabelsUpdate: onLiveRankingsUpdate,
      onFinish,
      onCharacterPreviewsReady
    };

    onThemeLoadingChange(true);

    const initializeEngine = async () => {
      try {
        const { GameEngine } = await import('../game/engine');
        if (cancelled) return;

        engine = new GameEngine(options);
        engineRef.current = engine;
        void engine.setThemeMode(themeModeRef.current);

        await engine.init();
        await engine.setThemeMode(themeModeRef.current);
        if (cancelled) return;

        // Initialization can finish after the user has already changed the
        // setup. Always use the latest participant and feedback settings.
        engine.setParticipants(participantsRef.current);
        engine.setSoundEnabled(soundEnabledRef.current);
        engine.setHapticEnabled(hapticEnabledRef.current);
        engineReadyRef.current = true;
        onThemeLoadingChange(false);
        onEngineReady(engine);
      } catch {
        if (!cancelled) {
          onThemeLoadingChange(false);
          onEngineError();
        }
      }
    };

    void initializeEngine();

    return () => {
      cancelled = true;
      engineReadyRef.current = false;
      engine?.destroy();
      if (engineRef.current === engine) engineRef.current = null;
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
