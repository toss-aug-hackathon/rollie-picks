import React from 'react';
import { Button, Modal } from '@toss/tds-mobile';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

// TDS Mobile 2.5.1의 Modal.Content 타입은 React 19에서 children을 누락해
// 런타임 동작은 유지하면서 표준 div 속성만 허용하는 좁은 어댑터를 사용해요.
const ModalContent = Modal.Content as unknown as React.FC<React.HTMLAttributes<HTMLDivElement>>;

export const PauseModal: React.FC<PauseModalProps> = ({ isOpen, onResume, onRestart, onQuit }) => {
  return (
    <Modal open={isOpen} onOpenChange={(open) => !open && onResume()}>
      <Modal.Overlay />
      <ModalContent
        aria-labelledby="menu-title"
        aria-describedby="menu-desc"
        style={{
          width: 'calc(100% - 72px)',
          maxWidth: 330,
          padding: '20px 16px 16px',
          borderRadius: 20,
          background: '#ffffff',
        }}
      >
        <h2 id="menu-title" style={{ margin: '0 0 4px', color: '#191f28', fontSize: 22, lineHeight: 1.3 }}>
          일시정지
        </h2>
        <p id="menu-desc" style={{ margin: '0 0 16px', color: '#6b7684', fontSize: 14, lineHeight: 1.45 }}>
          선택이 진행 중이에요.<br />무엇을 할까요?
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          <Button id="menu-resume" display="block" size="medium" onClick={onResume}>계속하기</Button>
          <Button id="menu-restart" display="block" size="medium" color="dark" variant="weak" onClick={onRestart}>다시하기</Button>
          <Button id="menu-quit" display="block" size="medium" color="dark" variant="weak" onClick={onQuit}>그만하기 (처음으로)</Button>
        </div>
      </ModalContent>
    </Modal>
  );
};
