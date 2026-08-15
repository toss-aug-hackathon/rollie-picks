export type CharacterKey = 'bear' | 'rabbit' | 'cat' | 'duck' | 'turtle' | 'dog' | 'fox' | 'panda' | 'pig' | 'hamster';
export type ThemeMode = 'auto' | 'day' | 'night';
export type CharacterPreviewMap = Partial<Record<CharacterKey | `${CharacterKey}-result`, string>>;

export const CHARACTER_DATA: Record<CharacterKey, { name: string; icon: string; preview: string; modelType: CharacterKey }> = {
  bear: { name: '곰', icon: '🐻', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'bear' },
  rabbit: { name: '토끼', icon: '🐰', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'rabbit' },
  cat: { name: '고양이', icon: '🐱', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'cat' },
  duck: { name: '오리', icon: '🐥', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'duck' },
  turtle: { name: '거북이', icon: '🐢', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'turtle' },
  dog: { name: '강아지', icon: '🐶', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'dog' },
  fox: { name: '여우', icon: '🦊', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'fox' },
  panda: { name: '판다', icon: '🐼', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'panda' },
  pig: { name: '돼지', icon: '🐷', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'pig' },
  hamster: { name: '햄스터', icon: '🐹', preview: 'assets/rolling-course-BVgPItdr.webp', modelType: 'hamster' }
};
