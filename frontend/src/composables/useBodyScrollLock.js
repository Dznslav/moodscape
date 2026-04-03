import { onBeforeUnmount, watch } from 'vue';
import { lockBodyScroll, unlockBodyScroll } from '../utils/bodyScroll';

export const useBodyScrollLock = (source) => {
  let isLocked = false;

  watch(
    source,
    (nextValue) => {
      if (nextValue && !isLocked) {
        lockBodyScroll();
        isLocked = true;
        return;
      }

      if (!nextValue && isLocked) {
        unlockBodyScroll();
        isLocked = false;
      }
    },
    { immediate: true }
  );

  onBeforeUnmount(() => {
    if (!isLocked) {
      return;
    }

    unlockBodyScroll();
    isLocked = false;
  });
};
