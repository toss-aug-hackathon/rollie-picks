import React, { useState, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { SetupScreen, ParticipantState } from './components/SetupScreen';
import { HUD } from './components/HUD';
import { PauseModal } from './components/PauseModal';
import { ResultOverlay, RankingItem } from './components/ResultOverlay';
import { CharacterPreviewMap, GameEngine, CharacterKey, ThemeMode } from './game/engine';

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<'setup' | 'playing' | 'paused' | 'result'>('setup');
  
  const [question, setQuestion] = useState('');
  const [participants, setParticipants] = useState<ParticipantState[]>([
    { name: '', characterKey: 'bear' },
    { name: '', characterKey: 'rabbit' },
    { name: '', characterKey: 'cat' },
    { name: '', characterKey: 'duck' }
  ]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');

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

  const handleOpenMenu = () => {
    setActiveScreen('paused');
  };

  const handleResumeMenu = () => {
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
        <div id="race-start" aria-live="assertive">
          <div className="start-board">
            <div className="signal-lights" aria-hidden="true">
              <i className="on"></i><i></i><i></i>
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
