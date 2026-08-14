# iPhone 레이아웃 및 오디오 완성도 개선 구현 계획

## 1. 홈 상태와 레이아웃 수정

- `SetupScreen.tsx`에서 CTA disabled 조건을 `!mapReady || !isValid`로 통일한다.
- `index.html`에서 캐릭터 카드, 미리보기, 이미지 높이를 축소한다.
- 짧은 높이용 스타일을 보정하고 `#setup`의 세로 overflow를 제거한다.
- 밤 테마의 disabled 선택자를 일반 primary 선택자보다 명확하게 적용한다.

## 2. safe area와 제스처 수정

- `index.html`에서 root padding과 app-height 차감을 제거한다.
- 하단 고정 UI에만 safe-bottom을 적용한다.
- `granite.config.ts`에서 back/forward navigation gesture를 비활성화한다.
- `App.tsx`에서 iOS 런타임 스와이프를 비활성화하고 cleanup에서 복원한다.
- 문서 전체의 가로 overscroll과 overflow를 차단한다.

## 3. HUD와 종료선 수정

- `index.html`의 HUD 내부 높이를 약 20% 줄인다.
- `course.ts`에서 종료선 텍스처를 수평 반복하고 plane 폭을 확장한다.

## 4. 오디오 개선

- `engine.ts`의 음악 패턴을 32스텝으로 확장한다.
- 베이스, 코드 보이싱, oscillator 퍼커션을 추가한다.
- master·music·effect gain을 상향하고 compressor를 유지한다.
- 단일 종료 tone을 상승 3음 팡파르 메서드로 교체한다.

## 5. 검증

- diff와 프로덕션 빌드를 확인한다.
- 짧은 모바일 viewport에서 낮·밤 홈 상태를 확인한다.
- 설정 → 배치 → 출발 → 일시정지 → 재개 흐름을 실행한다.
- AIT 빌드와 partner 메타데이터를 확인한다.
