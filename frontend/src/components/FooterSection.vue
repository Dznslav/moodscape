<template>
  <footer class="app-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <span class="footer-logo">🌤</span>
        <span class="footer-name">Moodscape</span>
      </div>

      <p class="footer-tagline">{{ $t('footer.tagline') }}</p>

      <div class="footer-divider"></div>

      <div class="footer-bottom">
        <span class="footer-copy">&copy; {{ year }} Moodscape</span>
        <span class="footer-dot">·</span>
        <span class="footer-credit">Dzianis Laurentsyeu</span>
      </div>
    </div>
  </footer>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const year = new Date().getFullYear();
</script>

<style scoped>
.app-footer {
  width: 100%;
  padding: 2rem 1.25rem 1.5rem;
  margin-top: auto;
}

.footer-inner {
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.footer-logo {
  font-size: 1.25rem;
  line-height: 1;
}

.footer-name {
  font-family: 'Syne', sans-serif;
  font-size: 1.0625rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  opacity: 0.7;
}

.footer-tagline {
  font-family: 'Inter', sans-serif;
  font-size: 0.8125rem;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.4;
  margin: 0;
}

.footer-divider {
  width: 3rem;
  height: 1px;
  background: var(--border-color);
  margin: 0.25rem 0;
}

.footer-bottom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}

.footer-copy,
.footer-credit {
  font-family: 'Inter', sans-serif;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.footer-dot {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  opacity: 0.5;
}
</style>
