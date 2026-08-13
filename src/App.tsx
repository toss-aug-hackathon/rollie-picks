import React, { useState, useRef } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { SetupScreen, ParticipantState } from './components/SetupScreen';
import { HUD } from './components/HUD';
import { PauseModal } from './components/PauseModal';
import { ResultOverlay, RankingItem } from './components/ResultOverlay';
import { GameEngine, CharacterKey, ThemeMode } from './game/engine';

export const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<'setup' | 'playing' | 'paused' | 'result'>('setup');
  
  const [question, setQuestion] = useState('오늘 저녁 뭐 먹지?');
  const [participants, setParticipants] = useState<ParticipantState[]>([
    { name: '짜장면', characterKey: 'bear' },
    { name: '짬뽕', characterKey: 'rabbit' },
    { name: '마라탕', characterKey: 'cat' },
    { name: '초밥', characterKey: 'duck' }
  ]);

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto');

  const [timerStr, setTimerStr] = useState('00:00.00');
  const [statusStr, setStatusStr] = useState('준비');
  const [countdownStr, setCountdownStr] = useState('3');
  const [countdownVisible, setCountdownVisible] = useState(false);

  const [winnerName, setWinnerName] = useState('');
  const [winnerCharKey, setWinnerCharKey] = useState<CharacterKey>('bear');
  const [winnerSpeech, setWinnerSpeech] = useState('');
  const [rankings, setRankings] = useState<RankingItem[]>([]);

  const engineRef = useRef<GameEngine | null>(null);

  const handleEngineReady = (engine: GameEngine) => {
    engineRef.current = engine;
  };

  const handleSubmitSetup = () => {
    if (engineRef.current) {
      engineRef.current.resetRace();
      engineRef.current.startRace();
    }
    setActiveScreen('playing');
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
      engineRef.current.resetRace();
      engineRef.current.startRace();
    }
    setActiveScreen('playing');
  };

  const handleEditPlayersResult = () => {
    if (engineRef.current) {
      engineRef.current.resetRace();
    }
    setActiveScreen('setup');
  };

  return (
    <main id="game" data-mode="choice" aria-label="데굴이가 골라줘 선택 도우미">
      <HUD
        question={question}
        status={statusStr}
        timer={timerStr}
        onOpenMenu={handleOpenMenu}
      />

      <GameCanvas
        onEngineReady={handleEngineReady}
        onTimerUpdate={setTimerStr}
        onStatusUpdate={setStatusStr}
        onCountdownUpdate={(count, visible) => {
          setCountdownStr(count);
          setCountdownVisible(visible);
        }}
        onFinish={handleFinish}
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
      />
    </main>
  );
};
