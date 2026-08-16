import React, { useEffect, useState, useRef } from 'react';
import {
  closeView,
  graniteEvent,
  getAnonymousKey,
  setDeviceOrientation,
  setIosSwipeGestureEnabled,
  setScreenAwakeMode,
  Storage,
} from '@apps-in-toss/web-framework';
import { ConfirmDialog } from '@toss/tds-mobile';
import { GameCanvas } from './components/GameCanvas';
import { SetupScreen, type ParticipantState } from './components/SetupScreen';
import { HUD } from './components/HUD';
import { PauseModal } from './components/PauseModal';
import { ResultOverlay, type RankingItem } from './components/ResultOverlay';
import type { GameEngine, LiveRankingItem } from './game/engine';
import type { CharacterKey, CharacterPreviewMap, ThemeMode } from './game/characters';

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

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<'setup' | 'playing' | 'paused' | 'result'>('setup');
  const [engineError, setEngineError] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  
  const [question, setQuestion] = useState('');
  const [participants, setParticipants] = useState<ParticipantState[]>(DEFAULT_PARTICIPANTS);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');
  const [mapReady, setMapReady] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const handleConfirmExit = async () => {
    setIsExitModalOpen(false);
    try {
      await closeView();
    } catch {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    }
  };

  useEffect(() => {
    const unsubscribeBack = graniteEvent.addEventListener?.('backEvent', {
      onEvent: () => {
        setIsExitModalOpen(true);
      },
    });

    return () => {
      unsubscribeBack?.();
    };
  }, []);

  useEffect(() => {
    void setDeviceOrientation({ type: 'portrait' }).catch(() => {});
    void setIosSwipeGestureEnabled({ isEnabled: false }).catch(() => {});
    return () => {
      void setIosSwipeGestureEnabled({ isEnabled: true }).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const enabled = activeScreen === 'playing';
    void setScreenAwakeMode({ enabled }).catch(() => {});
    return () => {
      if (enabled) void setScreenAwakeMode({ enabled: false }).catch(() => {});
    };
  }, [activeScreen]);

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
        soundEnabled,
        hapticEnabled,
        themeMode,
      });
      void Storage.setItem(APP_STATE_STORAGE_KEY, appState).catch(() => {});
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [storageReady, soundEnabled, hapticEnabled, themeMode]);

  const [timerStr, setTimerStr] = useState('00:00.00');
  const [statusStr, setStatusStr] = useState('준비');
  const [progress, setProgress] = useState(0);
  const [liveRankings, setLiveRankings] = useState<LiveRankingItem[]>([]);
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
    setEngineError(false);
    setMapReady(true);
    engineRef.current = engine;
    if (pendingStartRef.current) {
      pendingStartRef.current = false;
      setPlacementMode(false);
      void engine.startRace();
    }
  };

  const handleSubmitSetup = () => {
    if (!mapReady) return;
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
    engineRef.current?.pauseRace();
    setActiveScreen('paused');
  };

  const handleResumeMenu = () => {
    engineRef.current?.resumeRace();
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

      {activeScreen === 'playing' && !placementMode && liveRankings.length > 0 && (
        <aside id="live-rankings" aria-label="실시간 순위" aria-live="polite">
          <strong>실시간 순위</strong>
          <ol>
            {liveRankings.map((item) => (
              <li key={item.key}>
                <b>{item.rank}</b>
                <span>{item.name}</span>
              </li>
            ))}
          </ol>
        </aside>
      )}

      <GameCanvas
        onEngineReady={handleEngineReady}
        onEngineError={() => {
          setMapReady(false);
          setEngineError(true);
        }}
        onThemeLoadingChange={(loading) => setMapReady(!loading)}
        onTimerUpdate={setTimerStr}
        onStatusUpdate={setStatusStr}
        onProgressUpdate={setProgress}
        onLiveRankingsUpdate={setLiveRankings}
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

      {engineError && (
        <div id="error" className="is-visible" role="alert">
          <strong>게임을 불러오지 못했어요.</strong>
          <button type="button" className="primary" onClick={() => window.location.reload()}>다시 시도</button>
        </div>
      )}

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
          setThemeMode={(mode) => {
            setMapReady(false);
            setThemeMode(mode);
          }}
          mapReady={mapReady}
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

      <ConfirmDialog
        open={isExitModalOpen}
        onClose={() => setIsExitModalOpen(false)}
        title="데굴픽을 종료할까요?"
        cancelButton={
          <ConfirmDialog.CancelButton onClick={() => setIsExitModalOpen(false)}>
            닫기
          </ConfirmDialog.CancelButton>
        }
        confirmButton={
          <ConfirmDialog.ConfirmButton onClick={handleConfirmExit}>
            종료하기
          </ConfirmDialog.ConfirmButton>
        }
      />
    </main>
  );
};
