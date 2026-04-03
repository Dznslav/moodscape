import { nextTick, onBeforeUnmount, ref } from 'vue';

export const useRevealCards = () => {
  const revealCards = ref([]);
  const observedCards = new WeakSet();
  let observer = null;

  const registerRevealCard = (element) => {
    if (!element || revealCards.value.includes(element)) {
      return;
    }

    revealCards.value.push(element);

    if (!observer || observedCards.has(element)) {
      return;
    }

    observedCards.add(element);
    observer.observe(element);
  };

  const ensureRevealObserver = async () => {
    await nextTick();

    if (typeof window === 'undefined') {
      return;
    }

    if (!('IntersectionObserver' in window)) {
      revealCards.value.forEach((element) => element.classList.add('reveal-card--visible'));
      return;
    }

    if (!observer) {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }

            entry.target.classList.add('reveal-card--visible');
            observer?.unobserve(entry.target);
          }
        },
        { threshold: 0.22 }
      );
    }

    revealCards.value.forEach((element) => {
      if (observedCards.has(element)) {
        return;
      }

      observedCards.add(element);
      observer.observe(element);
    });
  };

  onBeforeUnmount(() => {
    observer?.disconnect();
    observer = null;
  });

  return {
    ensureRevealObserver,
    registerRevealCard,
  };
};
