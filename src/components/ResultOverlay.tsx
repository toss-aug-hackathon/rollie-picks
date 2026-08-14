import React, { useEffect, useRef, useState } from 'react';
import { CharacterKey, CharacterPreviewMap, CHARACTER_DATA } from '../game/engine';
import tiredBear from '../assets/characters/tired/bear.webp';
import tiredRabbit from '../assets/characters/tired/rabbit.webp';
import tiredCat from '../assets/characters/tired/cat.webp';
import tiredDuck from '../assets/characters/tired/duck.webp';
import tiredTurtle from '../assets/characters/tired/turtle.webp';
import tiredDog from '../assets/characters/tired/dog.webp';
import tiredFox from '../assets/characters/tired/fox.webp';
import tiredPanda from '../assets/characters/tired/panda.webp';
import tiredPig from '../assets/characters/tired/pig.webp';
import tiredHamster from '../assets/characters/tired/hamster.webp';
import cryingBear from '../assets/characters/crying/bear.webp';
import cryingRabbit from '../assets/characters/crying/rabbit.webp';
import cryingCat from '../assets/characters/crying/cat.webp';
import cryingDuck from '../assets/characters/crying/duck.webp';
import cryingTurtle from '../assets/characters/crying/turtle.webp';
import cryingDog from '../assets/characters/crying/dog.webp';
import cryingFox from '../assets/characters/crying/fox.webp';
import cryingPanda from '../assets/characters/crying/panda.webp';
import cryingPig from '../assets/characters/crying/pig.webp';
import cryingHamster from '../assets/characters/crying/hamster.webp';

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

const TIRED_CHARACTER_IMAGES: Partial<Record<CharacterKey, string>> = {
  bear: tiredBear,
  rabbit: tiredRabbit,
  cat: tiredCat,
  duck: tiredDuck,
  turtle: tiredTurtle,
  dog: tiredDog,
  fox: tiredFox,
  panda: tiredPanda,
  pig: tiredPig,
  hamster: tiredHamster
};

const CRYING_CHARACTER_IMAGES: Partial<Record<CharacterKey, string>> = {
  bear: cryingBear,
  rabbit: cryingRabbit,
  cat: cryingCat,
  duck: cryingDuck,
  turtle: cryingTurtle,
  dog: cryingDog,
  fox: cryingFox,
  panda: cryingPanda,
  pig: cryingPig,
  hamster: cryingHamster
};

const REPLAY_CHARACTER_KEYS = Object.keys(TIRED_CHARACTER_IMAGES) as CharacterKey[];

const pickReplayCharacters = (count: number, previous: CharacterKey[]) => {
  const shuffled = [...REPLAY_CHARACTER_KEYS];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }

  const selected = shuffled.slice(0, Math.min(Math.max(count, 1), shuffled.length));
  if (selected.length > 1 && selected.every((key, index) => key === previous[index])) {
    [selected[0], selected[1]] = [selected[1], selected[0]];
  }
  return selected;
};

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
  const [showReplayConfirm, setShowReplayConfirm] = useState(false);
  const [showFinalConfirm, setShowFinalConfirm] = useState(false);
  const [replayCharacterKeys, setReplayCharacterKeys] = useState<CharacterKey[]>(['bear', 'rabbit']);
  const previousReplayCharacterKeys = useRef<CharacterKey[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const nextCharacterKeys = pickReplayCharacters(rankings.length, previousReplayCharacterKeys.current);
    previousReplayCharacterKeys.current = nextCharacterKeys;
    setReplayCharacterKeys(nextCharacterKeys);

    nextCharacterKeys.forEach((key) => {
      [TIRED_CHARACTER_IMAGES[key], CRYING_CHARACTER_IMAGES[key]].forEach((src) => {
        if (!src) return;
        const image = new Image();
        image.src = src;
        void image.decode?.().catch(() => {});
      });
    });
  }, [isOpen, rankings]);

  if (!isOpen) return null;

  const charData = CHARACTER_DATA[winnerCharKey] || CHARACTER_DATA['bear'];
  const activeRankings = rankings
    .filter((item) => item.name.trim().length > 0)
    .map((item, index) => ({ ...item, rank: index + 1 }));

  return (
    <section id="result" className="overlay" aria-labelledby="result-title">
      <div
        key={showFinalConfirm ? 'final-confirm' : showReplayConfirm ? 'replay-confirm' : 'result'}
        className={`card ${showReplayConfirm ? 'replay-card' : ''}`}
      >
        {showReplayConfirm ? (
          <div className="replay-confirm">
            <h2 id="result-title">{showFinalConfirm ? '진짜?' : <>또 다시<br />굴러오라고...?</>}</h2>
            <div className={`replay-pile ${showFinalConfirm ? 'is-crying' : ''}`} data-count={replayCharacterKeys.length} aria-label={showFinalConfirm ? '울면서 서 있는 데굴이들' : '지쳐 쓰러진 데굴이들'}>
              {replayCharacterKeys.map((key, index) => (
                <div className="pile-character" key={key}>
                  <img
                    src={(showFinalConfirm ? CRYING_CHARACTER_IMAGES[key] : TIRED_CHARACTER_IMAGES[key]) || characterPreviews[key]}
                    alt={`${showFinalConfirm ? '우는' : '지친'} ${CHARACTER_DATA[key].name}`}
                  />
                  {!showFinalConfirm && index === 1 && <span className="pile-sweat" aria-hidden="true">💧</span>}
                </div>
              ))}
            </div>
            <div className="replay-actions">
              <button className="primary" type="button" onClick={() => {
                if (showFinalConfirm) {
                  setShowReplayConfirm(false);
                  setShowFinalConfirm(false);
                  onReplay();
                } else {
                  setShowFinalConfirm(true);
                }
              }}>
                {showFinalConfirm ? '응, 진짜!' : '그래, 한 번 더!'}
              </button>
              <button className="secondary" type="button" onClick={() => {
                setShowReplayConfirm(false);
                setShowFinalConfirm(false);
              }}>
                잠깐 쉴게
              </button>
            </div>
          </div>
        ) : (
          <>
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
          {activeRankings.map((item) => (
            <li key={item.rank}>
              <span className="rank-badge">{item.rank}등</span>
              <span className="rank-name">{item.name}</span>
              <span className="rank-character">
                {characterPreviews[item.key] ? (
                  <img src={characterPreviews[item.key]} alt={`${item.charName} 캐릭터`} />
                ) : (
                  <span aria-label={`${item.charName} 캐릭터`} role="img">{CHARACTER_DATA[item.key].icon}</span>
                )}
              </span>
            </li>
          ))}
        </ol>

        <div className="actions">
          <button id="edit-players" className="secondary" type="button" onClick={onEditPlayers}>
            선택지 변경
          </button>
          <button id="replay" className="primary" type="button" onClick={() => setShowReplayConfirm(true)}>
            다시 골라줘
          </button>
        </div>
          </>
        )}
      </div>
    </section>
  );
};
