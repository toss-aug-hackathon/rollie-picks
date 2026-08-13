import React from 'react';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({ isOpen, onResume, onRestart, onQuit }) => {
  if (!isOpen) return null;

  return (
    <section id="menu-modal" className="overlay" aria-labelledby="menu-title">
      <div className="card menu-card">
        <h2 id="menu-title">일시정지</h2>
        <p id="menu-desc">선택 레이스가 진행 중이에요.<br />무엇을 할까요?</p>
        <div className="actions menu-actions">
          <button id="menu-resume" className="primary" type="button" onClick={onResume}>계속하기</button>
          <button id="menu-restart" className="secondary" type="button" onClick={onRestart}>다시하기</button>
          <button id="menu-quit" className="secondary" type="button" onClick={onQuit}>그만하기 (처음으로)</button>
        </div>
      </div>
    </section>
  );
};
