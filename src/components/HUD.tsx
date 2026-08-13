import React from 'react';

interface HUDProps {
  question: string;
  status: string;
  progress: number;
  timer: string;
  onOpenMenu: () => void;
}

export const HUD: React.FC<HUDProps> = ({ question, status, progress, timer, onOpenMenu }) => {
  const questionFontSize = Math.min(26, Math.max(15, 420 / Math.max(question.length, 1)));

  return (
    <div id="hud">
      <div className="hud-topline">
        <span id="race-question" style={{ fontSize: `${questionFontSize}px` }}>{question || '데굴이가 골라줘'}</span>
        <button id="menu-btn" type="button" aria-label="메뉴 열기" onClick={onOpenMenu}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>
      <div id="progress-area">
        <div id="progress-label"><span id="status">{status}</span></div>
        <div id="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="hud-bottomline">
          <span id="race-timer">{timer}</span>
          <strong>{progress}%</strong>
        </div>
      </div>
    </div>
  );
};
