import React, { useState } from 'react';
import { CharacterKey, CHARACTER_DATA } from '../game/engine';

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
}

const COMMENTS = [
  '데굴이가 가장 당당하게 굴러들어왔어요!',
  '망설임 없이 끝까지 돌진했어요!',
  '고민하지 말고 바로 결정하세요!'
];

export const ResultOverlay: React.FC<ResultOverlayProps> = ({
  isOpen,
  winnerName,
  winnerCharKey,
  winnerSpeech,
  rankings,
  onReplay,
  onEditPlayers
}) => {
  if (!isOpen) return null;

  const [commentIndex, setCommentIndex] = useState(0);
  const charData = CHARACTER_DATA[winnerCharKey] || CHARACTER_DATA['bear'];

  const handlePrevComment = () => {
    setCommentIndex((prev) => (prev > 0 ? prev - 1 : COMMENTS.length - 1));
  };

  const handleNextComment = () => {
    setCommentIndex((prev) => (prev < COMMENTS.length - 1 ? prev + 1 : 0));
  };

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
          <img id="result-character-image" src={charData.preview} alt={charData.name} />
          <p id="result-speech" aria-live="polite">
            {winnerSpeech || `${charData.name} 데굴이가 선택을 마쳤어요!`}
          </p>
        </div>

        <div className="feedback-carousel">
          <button id="comment-prev" type="button" aria-label="이전 한마디" onClick={handlePrevComment}>
            ←
          </button>
          <p id="result-copy" aria-live="polite">
            {COMMENTS[commentIndex]}
          </p>
          <button id="comment-next" type="button" aria-label="다음 한마디" onClick={handleNextComment}>
            →
          </button>
        </div>

        <ol id="result-list">
          {rankings.map((item) => (
            <li key={item.rank}>
              {item.rank}등: {item.name} ({item.charName})
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
