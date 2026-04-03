import { nextTick } from 'vue';

const defaultOffset = 16;
const defaultComfortableViewportRatio = 0.18;

const resolveElement = (target) => {
  if (!target) {
    return null;
  }

  if (typeof target === 'function') {
    return resolveElement(target());
  }

  if ('value' in target) {
    return target.value ?? null;
  }

  return target;
};

const resolveViewportOffset = ({
  align = 'top',
  offset = defaultOffset,
  viewportOffset,
  viewportRatio = defaultComfortableViewportRatio,
}) => {
  if (typeof window === 'undefined') {
    return offset;
  }

  if (align === 'comfort') {
    if (Number.isFinite(viewportOffset)) {
      return Math.max(offset, viewportOffset);
    }

    return Math.max(offset, Math.round(window.innerHeight * viewportRatio));
  }

  return offset;
};

export const scrollElementToViewportTop = (
  target,
  {
    align = 'top',
    behavior = 'smooth',
    offset = defaultOffset,
    viewportOffset,
    viewportRatio,
  } = {}
) => {
  if (typeof window === 'undefined') {
    return;
  }

  const element = resolveElement(target);

  if (!element) {
    return;
  }

  const resolvedOffset = resolveViewportOffset({
    align,
    offset,
    viewportOffset,
    viewportRatio,
  });
  const nextTop = window.scrollY + element.getBoundingClientRect().top - resolvedOffset;

  window.scrollTo({
    top: Math.max(0, nextTop),
    behavior,
  });
};

export const scrollElementToViewportTopAfterRender = async (target, options = {}) => {
  await nextTick();

  if (typeof window === 'undefined') {
    return;
  }

  window.requestAnimationFrame(() => {
    scrollElementToViewportTop(target, options);
  });
};
