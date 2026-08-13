import { Device, type HapticFeedbackType } from '@apps-in-toss/web-framework';

export function triggerHaptic(enabled: boolean, type: HapticFeedbackType, browserFallback: VibratePattern = 20) {
  if (!enabled) return;

  const fallback = () => navigator.vibrate?.(browserFallback);
  try {
    void Device.triggerHaptic({ type }).catch(fallback);
  } catch {
    fallback();
  }
}
