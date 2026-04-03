import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

const normalizeTheme = (value) => (value === 'light' ? 'light' : 'dark');

const getStoredTheme = () => {
  const storedTheme = localStorage.getItem('theme');
  return storedTheme === 'dark' || storedTheme === 'light' ? storedTheme : null;
};

const applyTheme = (theme) => {
  const normalizedTheme = normalizeTheme(theme);
  document.documentElement.classList.toggle('dark', normalizedTheme === 'dark');
  document.documentElement.setAttribute('data-theme', normalizedTheme);
  document.documentElement.style.colorScheme = normalizedTheme;
};

export const useThemeStore = defineStore('theme', () => {
  const theme = ref(getStoredTheme() || 'dark');

  applyTheme(theme.value);

  const toggle = () => {
    theme.value = theme.value === 'light' ? 'dark' : 'light';
  };

  const setTheme = (nextTheme) => {
    theme.value = normalizeTheme(nextTheme);
  };

  watch(theme, (nextTheme) => {
    localStorage.setItem('theme', nextTheme);
    applyTheme(nextTheme);
  });

  const isDark = () => theme.value === 'dark';

  return { theme, toggle, setTheme, isDark };
});
