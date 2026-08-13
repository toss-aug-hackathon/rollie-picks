import React, { useState } from 'react';
import { CharacterKey, CharacterPreviewMap, CHARACTER_DATA } from '../game/engine';

export interface RankingItem {
  rank: number;
  name: string;
  charName: string;
  key: CharacterKey;
}

interface ResultOverlayProps {
  isOpen: boolean;
  winnerName: string;
  winnerCharKey: CharacterKey;
  winnerSpeech: string;
  rankings: RankingItem[];
  onReplay: () => void;
  onEditPlayers: () => void;
  characterPreviews: CharacterPreviewMap;
}

const COMMENTS = [
  '데굴이가 가장 당당하게 굴러들어왔어요!',
  '망설임 없이 끝까지 돌진했어요!',
  '고민하지 말고 바로 결정하세요!',
  '오늘의 선택은 데굴이에게 맡겨도 좋아요!',
  '가장 먼저 도착한 데굴이의 자신감 있는 선택이에요!',
  '이 정도면 운명이라고 불러도 괜찮겠어요!',
  '데굴데굴 굴러온 만큼 확실한 선택이에요!'
];

export const ResultOverlay: React.FC<ResultOverlayProps> = ({
  isOpen,
  winnerName,
  winnerCharKey,
  winnerSpeech,
  rankings,
  onReplay,
  onEditPlayers,
  characterPreviews
}) => {
  const [cheerMessage] = useState(() => COMMENTS[Math.floor(Math.random() * COMMENTS.length)]);
  if (!isOpen) return null;

  const charData = CHARACTER_DATA[winnerCharKey] || CHARACTER_DATA['bear'];

  return (
    <section id="result" className="overlay" aria-labelledby="result-title">
      <div className="card">
        <div className="story-marquee" aria-hidden="true">
          <div className="story-marquee-track">
            <span>데굴이의 선택</span>
            <span>데굴데굴 하나를 골랐어요</span>
            <span>데굴이의 선택</span>
            <span>데굴데굴 하나를 골랐어요</span>
          </div>
        </div>

        <h2 id="result-title">{winnerName}</h2>

        <div className="result-character">
          {characterPreviews[`${winnerCharKey}-result`] && (
            <img id="result-character-image" src={characterPreviews[`${winnerCharKey}-result`]} alt={charData.name} />
          )}
        </div>

        <div className="feedback-carousel">
          <p id="result-copy" aria-live="polite">
            {cheerMessage}
          </p>
        </div>

        <ol id="result-list">
          {rankings.map((item) => (
            <li key={item.rank}>
              <span className="rank-badge">{item.rank}등</span>
              <span className="rank-name">{item.name}</span>
              <span className="rank-character">({item.charName})</span>
            </li>
          ))}
        </ol>

        <div className="actions">
          <button id="edit-players" className="secondary" type="button" onClick={onEditPlayers}>
            선택지 변경
          </button>
          <button id="replay" className="primary" type="button" onClick={onReplay}>
            다시 골라줘
          </button>
        </div>
      </div>
    </section>
  );
};
