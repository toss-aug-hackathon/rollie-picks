import React, { useEffect, useState, useRef } from 'react';
import { getAnonymousKey, Storage } from '@apps-in-toss/web-framework';
import { GameCanvas } from './components/GameCanvas';
import { SetupScreen, ParticipantState } from './components/SetupScreen';
import { HUD } from './components/HUD';
import { PauseModal } from './components/PauseModal';
import { ResultOverlay, RankingItem } from './components/ResultOverlay';
import { CHARACTER_DATA, CharacterPreviewMap, GameEngine, CharacterKey, ThemeMode } from './game/engine';

const APP_STATE_STORAGE_KEY = 'degul-pick:app-state:v1';
const ANONYMOUS_KEY_STORAGE_KEY = 'degul-pick:anonymous-key';
const DEFAULT_PARTICIPANTS: ParticipantState[] = [
  { name: '', characterKey: 'bear' },
  { name: '', characterKey: 'rabbit' },
  { name: '', characterKey: 'cat' },
  { name: '', characterKey: 'duck' },
];

const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'day' || value === 'night' || value === 'auto';

const restoreParticipants = (value: unknown): ParticipantState[] => {
  if (!Array.isArray(value)) return DEFAULT_PARTICIPANTS;

  return DEFAULT_PARTICIPANTS.map((fallback, index) => {
    const item = value[index];
    if (!item || typeof item !== 'object') return fallback;

    const candidate = item as Partial<ParticipantState>;
    const characterKey = typeof candidate.characterKey === 'string'
      && candidate.characterKey in CHARACTER_DATA
      ? candidate.characterKey as CharacterKey
      : fallback.characterKey;

    return {
      name: typeof candidate.name === 'string' ? candidate.name.slice(0, 12) : fallback.name,
      characterKey,
    };
  });
};

export const App: React.FC = () => {
  useEffect(() => {
    const updateAppHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty('--viewport-height', `${Math.round(viewportHeight)}px`);
    };

    updateAppHeight();
    window.addEventListener('resize', updateAppHeight);
    window.visualViewport?.addEventListener('resize', updateAppHeight);
    return () => {
      window.removeEventListener('resize', updateAppHeight);
      window.visualViewport?.removeEventListener('resize', updateAppHeight);
      document.documentElement.style.removeProperty('--viewport-height');
    };
  }, []);

  const [activeScreen, setActiveScreen] = useState<'setup' | 'playing' | 'paused' | 'result'>('setup');
  
  const [question, setQuestion] = useState('');
  const [participants, setParticipants] = useState<ParticipantState[]>(DEFAULT_PARTICIPANTS);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>('day');
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const initializeNonGameUser = async () => {
      const [anonymousKeyResult, savedStateResult] = await Promise.allSettled([
        getAnonymousKey(),
        Storage.getItem(APP_STATE_STORAGE_KEY),
      ]);

      if (cancelled) return;

      if (anonymousKeyResult.status === 'fulfilled'
        && anonymousKeyResult.value
        && anonymousKeyResult.value !== 'ERROR') {
        void Storage.setItem(ANONYMOUS_KEY_STORAGE_KEY, anonymousKeyResult.value.hash).catch(() => {});
      }

      if (savedStateResult.status === 'fulfilled' && savedStateResult.value) {
        try {
          const saved = JSON.parse(savedStateResult.value) as Record<string, unknown>;
          if (typeof saved.question === 'string') setQuestion(saved.question.slice(0, 30));
          setParticipants(restoreParticipants(saved.participants));
          if (typeof saved.soundEnabled === 'boolean') setSoundEnabled(saved.soundEnabled);
          if (typeof saved.hapticEnabled === 'boolean') setHapticEnabled(saved.hapticEnabled);
          if (isThemeMode(saved.themeMode)) setThemeMode(saved.themeMode);
        } catch {
          // 손상된 저장값은 무시하고 안전한 기본값으로 시작해요.
        }
      }

      setStorageReady(true);
    };

    void initializeNonGameUser();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    const timeoutId = window.setTimeout(() => {
      const appState = JSON.stringify({
        question,
        participants,
        soundEnabled,
        hapticEnabled,
        themeMode,
      });
      void Storage.setItem(APP_STATE_STORAGE_KEY, appState).catch(() => {});
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [storageReady, question, participants, soundEnabled, hapticEnabled, themeMode]);

  const [timerStr, setTimerStr] = useState('00:00.00');
  const [statusStr, setStatusStr] = useState('준비');
  const [progress, setProgress] = useState(0);
  const [countdownStr, setCountdownStr] = useState('3');
  const [countdownVisible, setCountdownVisible] = useState(false);
  const [placementMode, setPlacementMode] = useState(false);

  const [winnerName, setWinnerName] = useState('');
  const [winnerCharKey, setWinnerCharKey] = useState<CharacterKey>('bear');
  const [winnerSpeech, setWinnerSpeech] = useState('');
  const [rankings, setRankings] = useState<RankingItem[]>([]);
  const [characterPreviews, setCharacterPreviews] = useState<CharacterPreviewMap>({});

  const engineRef = useRef<GameEngine | null>(null);
  const pendingStartRef = useRef(false);

  const handleEngineReady = (engine: GameEngine) => {
    engineRef.current = engine;
    if (pendingStartRef.current) {
      pendingStartRef.current = false;
      setPlacementMode(false);
      void engine.startRace();
    }
  };

  const handleSubmitSetup = () => {
    if (engineRef.current) {
      engineRef.current.setParticipants(participants);
      engineRef.current.resetRace();
    }
    setPlacementMode(true);
    setActiveScreen('playing');
  };

  const handleStartPlacedRace = () => {
    if (!engineRef.current) {
      pendingStartRef.current = true;
      return;
    }
    setPlacementMode(false);
    void engineRef.current.startRace();
  };

  const signalLightsOn = countdownStr === '3' ? 1 : countdownStr === '2' ? 2 : countdownStr === '1' ? 3 : 0;

  const handleOpenMenu = () => {
    setActiveScreen('paused');
  };

  const handleResumeMenu = () => {
    setActiveScreen('playing');
  };

  const handleRestartMenu = () => {
    if (engineRef.current) {
      engineRef.current.setParticipants(participants);
      engineRef.current.resetRace();
    }
    setPlacementMode(true);
    setActiveScreen('playing');
  };

  const handleQuitMenu = () => {
    if (engineRef.current) {
      engineRef.current.resetRace();
    }
    setActiveScreen('setup');
    setPlacementMode(false);
  };

  const handleFinish = (
    winnerNameRes: string,
    winnerCharKeyRes: CharacterKey,
    winnerSpeechRes: string,
    rankingsRes: RankingItem[]
  ) => {
    setWinnerName(winnerNameRes);
    setWinnerCharKey(winnerCharKeyRes);
    setWinnerSpeech(winnerSpeechRes);
    setRankings(rankingsRes);
    setActiveScreen('result');
  };

  const handleReplayResult = () => {
    if (engineRef.current) {
      engineRef.current.setParticipants(participants);
      engineRef.current.resetRace();
    }
    setPlacementMode(true);
    setActiveScreen('playing');
  };

  const handleEditPlayersResult = () => {
    if (engineRef.current) {
      engineRef.current.resetRace();
    }
    setPlacementMode(false);
    setActiveScreen('setup');
  };

  return (
    <main id="game" data-mode="choice" aria-label="데굴이가 골라줘 선택 도우미">
      <HUD
        question={question}
        status={statusStr}
        progress={progress}
        timer={timerStr}
        onOpenMenu={handleOpenMenu}
      />

      <GameCanvas
        onEngineReady={handleEngineReady}
        onTimerUpdate={setTimerStr}
        onStatusUpdate={setStatusStr}
        onProgressUpdate={setProgress}
        onCountdownUpdate={(count, visible) => {
          setCountdownStr(count);
          setCountdownVisible(visible);
        }}
        onFinish={handleFinish}
        participants={participants}
        onCharacterPreviewsReady={setCharacterPreviews}
        soundEnabled={soundEnabled}
        hapticEnabled={hapticEnabled}
        themeMode={themeMode}
      />

      {countdownVisible && (
        <div id="race-start" className={countdownStr === '출발!' ? 'is-go' : ''} aria-live="assertive">
          <div className="start-board">
            <div className="signal-lights" aria-hidden="true">
              {[0, 1, 2].map((lightIndex) => (
                <i key={lightIndex} className={lightIndex < signalLightsOn ? 'on' : ''}></i>
              ))}
            </div>
            <div id="start-count">{countdownStr}</div>
            <div id="start-caption">선택 준비</div>
          </div>
        </div>
      )}

      {activeScreen === 'playing' && placementMode && (
        <div id="placement-guide">
          <span>캐릭터를 원하는 위치로 옮겨보세요</span>
          <button type="button" className="primary" onClick={handleStartPlacedRace}>데굴이 출발</button>
        </div>
      )}

      {activeScreen === 'setup' && (
        <SetupScreen
          question={question}
          setQuestion={setQuestion}
          participants={participants}
          setParticipants={setParticipants}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          hapticEnabled={hapticEnabled}
          setHapticEnabled={setHapticEnabled}
          themeMode={themeMode}
          setThemeMode={setThemeMode}
          onSubmit={handleSubmitSetup}
          characterPreviews={characterPreviews}
        />
      )}

      <PauseModal
        isOpen={activeScreen === 'paused'}
        onResume={handleResumeMenu}
        onRestart={handleRestartMenu}
        onQuit={handleQuitMenu}
      />

      <ResultOverlay
        isOpen={activeScreen === 'result'}
        winnerName={winnerName}
        winnerCharKey={winnerCharKey}
        winnerSpeech={winnerSpeech}
        rankings={rankings}
        onReplay={handleReplayResult}
        onEditPlayers={handleEditPlayersResult}
        characterPreviews={characterPreviews}
      />
    </main>
  );
};
