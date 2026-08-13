import React, { useState } from 'react';
import { CharacterKey, CharacterPreviewMap, CHARACTER_DATA, ThemeMode } from '../game/engine';

export interface ParticipantState {
  name: string;
  characterKey: CharacterKey;
}

interface SetupScreenProps {
  question: string;
  setQuestion: (val: string) => void;
  participants: ParticipantState[];
  setParticipants: React.Dispatch<React.SetStateAction<ParticipantState[]>>;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  hapticEnabled: boolean;
  setHapticEnabled: (val: boolean) => void;
  themeMode: ThemeMode;
  setThemeMode: (val: ThemeMode) => void;
  onSubmit: () => void;
  characterPreviews: CharacterPreviewMap;
}

const CHARACTER_KEYS: CharacterKey[] = ['bear', 'rabbit', 'cat', 'duck', 'turtle'];
const CARD_CLASSES = ['setup-card--yellow', 'setup-card--rose', 'setup-card--indigo', 'setup-card--sky'];
const QUESTION_MAX_LENGTH = 30;
const PARTICIPANT_MAX_LENGTH = 12;

export const SetupScreen: React.FC<SetupScreenProps> = ({
  question,
  setQuestion,
  participants,
  setParticipants,
  soundEnabled,
  setSoundEnabled,
  hapticEnabled,
  setHapticEnabled,
  themeMode,
  setThemeMode,
  onSubmit,
  characterPreviews
}) => {
  const [toastMessage, setToastMessage] = useState('');

  const handleNameChange = (index: number, newName: string) => {
    const limitedName = newName.slice(0, PARTICIPANT_MAX_LENGTH);
    setParticipants((prev) => {
      const next = [...prev];
      const usedByOthers = new Set(
        next
          .filter((_, participantIndex) => participantIndex !== index)
          .map((participant) => participant.characterKey)
      );
      const characterKey = limitedName.trim() && usedByOthers.has(next[index].characterKey)
        ? CHARACTER_KEYS.find((key) => !usedByOthers.has(key)) || next[index].characterKey
        : next[index].characterKey;
      next[index] = { ...next[index], name: limitedName, characterKey };
      return next;
    });
  };

  const handleStepCharacter = (index: number, direction: number) => {
    setParticipants((prev) => {
      const next = [...prev];
      const currentKey = next[index].characterKey;
      const usedByOthers = new Set(
        next
          .filter((_, participantIndex) => participantIndex !== index)
          .map((participant) => participant.characterKey)
      );
      const availableKeys = CHARACTER_KEYS.filter((key) => key === currentKey || !usedByOthers.has(key));
      const currentIndex = availableKeys.indexOf(currentKey);
      let nextIndex = (currentIndex + direction) % availableKeys.length;
      if (nextIndex < 0) nextIndex += availableKeys.length;
      next[index] = { ...next[index], characterKey: availableKeys[nextIndex] };
      return next;
    });
  };

  const isValid = question.trim().length > 0 && participants[0].name.trim().length > 0 && participants[1].name.trim().length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) {
      setToastMessage('고민 제목을 적어주세요.');
      return;
    }

    if (!participants[0].name.trim() || !participants[1].name.trim()) {
      setToastMessage('선택지 2개를 모두 적어주세요.');
      return;
    }

    onSubmit();
  };

  return (
    <section id="setup" className="overlay" aria-labelledby="setup-title">
      <div className="setup-topbar" aria-hidden="true"></div>
      <form id="setup-form" className="setup-page" onSubmit={handleSubmit}>
        <header className="setup-header">
          <span className="brand-pill">데굴데굴</span>
          <h1 id="setup-title">
            고민은 <em>가볍게</em><br />
            데굴이가 골라줘
          </h1>
          <p id="setup-description">
            선택지를 적고 캐릭터를 골라주세요.<br />
            가장 먼저 들어온 데굴이가 하나를 골라줘요.
          </p>
        </header>

        <section className="question-field" aria-labelledby="question-label">
          <label id="question-label" htmlFor="decision-question">Q. 고민은 뭐야?</label>
          <input
            id="decision-question"
            maxLength={QUESTION_MAX_LENGTH}
            placeholder="무엇을 골라줄까?"
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_MAX_LENGTH))}
          />
        </section>

        <section id="name-fields" aria-label="선택지와 캐릭터">
          {participants.map((item, i) => {
            const charData = CHARACTER_DATA[item.characterKey];
            const isOptional = i >= 2;
            const isDisabled = isOptional && !item.name.trim();
            const placeholder = isOptional ? `${i + 1}번째 선택지 (선택)` : `${i + 1}번째 선택지`;

            return (
              <div
                key={i}
                className={`participant setup-card ${CARD_CLASSES[i]} ${isDisabled ? 'is-disabled' : ''}`}
              >
                <input
                  name="name"
                  maxLength={PARTICIPANT_MAX_LENGTH}
                  placeholder={placeholder}
                  value={item.name}
                  onChange={(e) => handleNameChange(i, e.target.value)}
                />
                <div className="mini-character-picker" aria-disabled={isDisabled}>
                  <button
                    className="character-step"
                    type="button"
                    onClick={() => handleStepCharacter(i, -1)}
                    disabled={isDisabled}
                    aria-label="이전 캐릭터"
                  >
                    ‹
                  </button>
                  <div className="mini-character-preview">
                    {characterPreviews[item.characterKey] ? (
                      <img className="mini-character-art" src={characterPreviews[item.characterKey]} alt={charData.name} />
                    ) : (
                      <div className="mini-character-art is-loading" role="img" aria-label={`${charData.name} 준비 중`} />
                    )}
                    <span>{isDisabled ? '선택 안 됨' : charData.name}</span>
                  </div>
                  <button
                    className="character-step"
                    type="button"
                    onClick={() => handleStepCharacter(i, 1)}
                    disabled={isDisabled}
                    aria-label="다음 캐릭터"
                  >
                    ›
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <div className="settings">
          <label>
            <input
              id="sound-toggle"
              type="checkbox"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            소리
          </label>
          <label>
            <input
              id="haptic-toggle"
              type="checkbox"
              checked={hapticEnabled}
              onChange={(e) => setHapticEnabled(e.target.checked)}
            />
            진동
          </label>
          <select
            id="theme-mode"
            value={themeMode}
            onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
            aria-label="배경 모드"
          >
            <option value="auto">자동 (시간대)</option>
            <option value="day">낮</option>
            <option value="night">밤</option>
          </select>
        </div>

        <footer className="setup-footer">
          <button id="setup-submit" className={`primary ${!isValid ? 'is-incomplete' : ''}`} type="submit">
            데굴이들에게 골라달라고 하기
          </button>
        </footer>
      </form>
      {toastMessage && (
        <div className="setup-toast" role="alert" onAnimationEnd={() => setToastMessage('')}>
          {toastMessage}
        </div>
      )}
    </section>
  );
};
