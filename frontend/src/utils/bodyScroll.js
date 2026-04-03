let bodyScrollLockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

const getScrollbarWidth = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 0;
  }

  return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
};

export const lockBodyScroll = () => {
  if (typeof document === 'undefined') {
    return;
  }

  bodyScrollLockCount += 1;

  if (bodyScrollLockCount > 1) {
    return;
  }

  const { body } = document;
  previousOverflow = body.style.overflow;
  previousPaddingRight = body.style.paddingRight;

  const scrollbarWidth = getScrollbarWidth();
  const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

  body.style.overflow = 'hidden';

  if (scrollbarWidth > 0) {
    body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
  }

  body.dataset.scrollLocked = 'true';
};

export const unlockBodyScroll = () => {
  if (typeof document === 'undefined' || bodyScrollLockCount === 0) {
    return;
  }

  bodyScrollLockCount -= 1;

  if (bodyScrollLockCount > 0) {
    return;
  }

  const { body } = document;
  body.style.overflow = previousOverflow;
  body.style.paddingRight = previousPaddingRight;
  delete body.dataset.scrollLocked;
};
