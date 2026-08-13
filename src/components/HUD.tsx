import React from 'react';

interface HUDProps {
  question: string;
  status: string;
  timer: string;
  onOpenMenu: () => void;
}

export const HUD: React.FC<HUDProps> = ({ question, status, timer, onOpenMenu }) => {
  return (
    <div id="hud">
      <span id="race-question">{question || '데굴이가 골라줘'}</span>
      <div className="hud-controls">
        <span id="status">{status}</span>
        <button id="menu-btn" type="button" aria-label="메뉴 열기" onClick={onOpenMenu}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>
      <span id="race-timer">{timer}</span>
    </div>
  );
};
