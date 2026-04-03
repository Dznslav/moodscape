<template>
  <div class="page">
    <div class="bg-glow" aria-hidden="true"></div>

    <div class="content">
      <header class="page-header">
        <div class="page-title-group">
          <p class="page-caption">{{ t('prediction.pageCaption') }}</p>
          <h1 class="page-title">{{ t('prediction.pageTitle') }}</h1>
          <p class="page-subtitle">{{ t('prediction.pageSub') }}</p>
        </div>
      </header>

      <div class="forecast-stack">
        <section v-if="hasConsentError" class="card consent-card">
          <div class="consent-icon">🔒</div>
          <h2 class="consent-title">{{ t('prediction.consentRequiredTitle') }}</h2>
          <p class="consent-text">{{ t('prediction.consentRequiredText') }}</p>
          <button type="button" class="btn btn--primary btn--block" @click="openSettings">
            {{ t('settings.manageConsent') }}
          </button>
        </section>

        <section v-else-if="needsLocation" class="card location-card">
          <div class="consent-icon">📍</div>
          <h2 class="consent-title">{{ t('prediction.locationRequiredTitle') }}</h2>
          <p class="consent-text">{{ t('prediction.locationRequiredText') }}</p>
          <div class="state-actions">
            <button type="button" class="btn btn--primary btn--grow" @click="openLocationSearch">
              {{ t('location.changeCity') }}
            </button>
            <button type="button" class="btn btn--secondary btn--grow" @click="retryWithGps">
              {{ t('location.btnGPS') }}
            </button>
          </div>
        </section>

        <div v-else-if="isLoadingPrediction" class="skeleton-grid">
          <div class="card skeleton-card skeleton-card--hero">
            <div class="skel skel--sm"></div>
            <div class="skel skel--lg"></div>
            <div class="skel skel--md"></div>
            <div class="skeleton-panels">
              <div class="skel skel--panel"></div>
              <div class="skel skel--panel"></div>
            </div>
          </div>
          <div class="detail-grid">
            <div class="card skeleton-card skeleton-card--detail">
              <div class="skel skel--sm"></div>
              <div class="skel skel--md"></div>
              <div class="skel skel--detail-text"></div>
            </div>
            <div class="card skeleton-card skeleton-card--detail">
              <div class="skel skel--sm"></div>
              <div class="skel skel--md"></div>
              <div class="skel skel--detail-text"></div>
            </div>
          </div>
        </div>

        <template v-else-if="prediction">
          <section class="card hero-card" :class="isColdModel ? 'hero-card--cold' : 'hero-card--warm'">
            <div class="hero-head">
              <div>
                <p class="hero-kicker">{{ forecastDateLabel }}</p>
                <h2 class="hero-title">{{ heroTitle }}</h2>
                <p class="hero-subtitle">{{ heroSubtitle }}</p>
              </div>

              <span class="model-badge" :class="{ 'model-badge--cold': isColdModel }">
                {{ modelBadgeLabel }}
              </span>
            </div>

            <p class="hero-note">{{ t('prediction.forecastDisclaimer') }}</p>

            <div class="forecast-panels">
              <article class="forecast-panel forecast-panel--mood">
                <div class="forecast-panel-head">
                  <div class="metric-icon-shell">
                    <span class="metric-icon">{{ moodEmoji }}</span>
                  </div>
                  <div>
                    <p class="metric-kicker">{{ t('prediction.moodLabel') }}</p>
                    <h3 class="metric-title">{{ moodTrendTitle }}</h3>
                  </div>
                </div>

                <p class="metric-description">{{ moodTrendSub }}</p>

              </article>

              <article
                class="forecast-panel forecast-panel--energy"
                :class="{ 'forecast-panel--pending': !energyAvailable }"
              >
                <div class="forecast-panel-head">
                  <div
                    class="metric-icon-shell metric-icon-shell--energy"
                    :class="{ 'metric-icon-shell--pending': !energyAvailable }"
                  >
                    <span class="metric-icon">{{ energyEmoji }}</span>
                  </div>
                  <div>
                    <p class="metric-kicker">{{ t('prediction.energyLabel') }}</p>
                    <h3 class="metric-title">{{ energyTrendTitle }}</h3>
                  </div>
                </div>

                <p class="metric-description">{{ energyTrendSub }}</p>

              </article>
            </div>
          </section>

          <div class="detail-grid">
            <article class="card detail-card detail-card--weather">
              <p class="detail-kicker">{{ t('prediction.weatherTitle') }}</p>
              <h3 class="detail-title">{{ weatherDetailTitle }}</h3>
              <p class="detail-text">{{ weatherText }}</p>
              <button
                v-if="showWeatherLocationAction"
                type="button"
                class="btn btn--secondary btn--sm btn--inline"
                @click="openLocationSearch"
              >
                {{ t('location.changeCity') }}
              </button>
            </article>

            <article class="card detail-card detail-card--model">
              <p class="detail-kicker">{{ t('prediction.modelTitle') }}</p>
              <h3 class="detail-title">{{ detailModelTitle }}</h3>
              <p class="detail-text">{{ modelInsightText }}</p>
              <p class="detail-note">{{ modelHintText }}</p>
            </article>
          </div>
        </template>

        <section v-else class="card empty-card">
          <div class="empty-icon">✨</div>
          <h2 class="empty-title">{{ t('prediction.emptyTitle') }}</h2>
          <p class="empty-text">{{ t('prediction.emptyText') }}</p>
        </section>

        <section class="card method-card">
          <div class="method-header">
            <div>
              <p class="method-kicker">{{ t('prediction.pageCaption') }}</p>
              <h2 class="card-title">{{ t('prediction.infoTitle') }}</h2>
            </div>
            <button type="button" class="btn btn--secondary btn--sm method-toggle" @click="toggleMethodCard">
              {{ isMethodExpanded ? t('prediction.methodToggleHide') : t('prediction.methodToggleShow') }}
            </button>
          </div>

          <div v-if="isMethodExpanded" class="method-body">
            <p class="method-text">{{ t('prediction.infoText') }}</p>

            <div class="method-grid">
              <article v-for="step in forecastSteps" :key="step.title" class="method-step">
                <span class="method-step-icon">{{ step.icon }}</span>
                <h3 class="method-step-title">{{ step.title }}</h3>
                <p class="method-step-text">{{ step.text }}</p>
              </article>
            </div>

            <div class="model-note-grid">
              <div class="model-note">
                {{ t('prediction.infoCold') }}
              </div>
              <div class="model-note model-note--warm">
                {{ t('prediction.infoWarm') }}
              </div>
            </div>

            <div class="legend-row">
              <span
                v-for="item in forecastLegend"
                :key="item.tone"
                class="legend-chip"
                :class="`legend-chip--${item.tone}`"
              >
                <span class="legend-dot"></span>
                <span>{{ item.label }}</span>
              </span>
            </div>
          </div>
        </section>
      </div>

      <FooterSection />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import FooterSection from '../components/FooterSection.vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useRouter } from 'vue-router';
import { useLocationStore } from '../stores/location';
import { usePredictionsStore } from '../stores/predictions';
import { getLogicalDateKey } from '../utils/date';
import { playHaptic } from '../utils/haptics';

defineOptions({ name: 'PredictionView' });

const { t, locale } = useI18n();
const authStore = useAuthStore();
const router = useRouter();
const locationStore = useLocationStore();
const predictionsStore = usePredictionsStore();

const prediction = computed(() => predictionsStore.prediction);
const isLoadingPrediction = computed(() => predictionsStore.isLoading || Boolean(authStore.token && !authStore.user));
const hasConsentError = computed(() => predictionsStore.hasConsentError);
const needsLocation = computed(() => predictionsStore.needsLocation);
const currentDayKey = ref(getLogicalDateKey(new Date()));
const isMethodExpanded = ref(false);
let dayRefreshTimerId = null;

const getForecastDate = () => {
  if (predictionsStore.targetDate) {
    const [year, month, day] = predictionsStore.targetDate.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

const isColdModel = computed(() => prediction.value?.model_type === 'cold');
const energyAvailable = computed(() => prediction.value?.energy_available !== false);
const predictionRecordCount = computed(() => {
  const numericValue = Number(prediction.value?.prediction_metadata?.record_count);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
});

const forecastDateLabel = computed(() => {
  if (isColdModel.value) {
    return t('prediction.windowNextTwoDays');
  }

  return new Intl.DateTimeFormat(locale.value || undefined, {
    day: 'numeric',
    month: 'long',
  }).format(getForecastDate());
});

const heroTitle = computed(() => (
  isColdModel.value ? t('prediction.cardTitleCold') : t('prediction.cardTitleWarm')
));

const heroSubtitle = computed(() => {
  if (!prediction.value) return '';

  if (isColdModel.value) {
    return {
      rise: t('prediction.heroSubColdRise'),
      drop: t('prediction.heroSubColdDrop'),
      stable: t('prediction.heroSubColdStable'),
    }[prediction.value.mood_trend] || t('prediction.heroSubColdStable');
  }

  if (predictionRecordCount.value) {
    return t('prediction.heroSubWarmWithCount', { count: predictionRecordCount.value });
  }

  return t('prediction.heroSubWarm');
});

const weatherReason = computed(() => prediction.value?.weather_info?.reason || null);
const hasWeatherContext = computed(() => Boolean(prediction.value?.weather_info?.available));

const weatherConditionLabel = computed(() => {
  if (!hasWeatherContext.value) return t('prediction.weatherUnavailableShort');

  const weather = prediction.value.weather_info;
  const condition = weather.weather_condition;

  if (condition) {
    if (['Rain', 'Drizzle', 'Thunderstorm'].includes(condition)) return t('prediction.weatherRain');
    if (condition === 'Snow') return t('prediction.weatherSnow');
    if (condition === 'Clear') return t('prediction.weatherClear');
    if (condition === 'Clouds' && weather.clouds <= 40) return t('prediction.weatherClear');
    return t('prediction.weatherCloudy');
  }

  if (weather.rain > 0) return t('prediction.weatherRain');
  if (weather.clouds > 60) return t('prediction.weatherCloudy');
  return t('prediction.weatherClear');
});

const weatherDetailTitle = computed(() => {
  if (hasWeatherContext.value) return weatherConditionLabel.value;

  if (weatherReason.value === 'missing_location') {
    return t('prediction.weatherNeedsLocationTitle');
  }

  return t('prediction.weatherUnavailableTitle');
});

const showWeatherLocationAction = computed(() => weatherReason.value === 'missing_location');

const weatherText = computed(() => {
  if (!hasWeatherContext.value) {
    if (weatherReason.value === 'missing_location') return t('prediction.weatherMissingLocationText');
    if (weatherReason.value === 'missing_api_key') return t('prediction.weatherMissingApiKeyText');
    if (weatherReason.value === 'api_error') return t('prediction.weatherApiErrorText');
    return t('prediction.weatherUnavailableText');
  }

  const weather = prediction.value.weather_info;
  const base = t('prediction.weatherBase', { temp: Math.round(weather.temp) });
  const condition = weather.weather_condition;

  const isRainy = condition
    ? ['Rain', 'Drizzle', 'Thunderstorm'].includes(condition)
    : weather.rain > 0;
  const isSnowy = condition === 'Snow';
  const isClear = condition
    ? (condition === 'Clear' || (condition === 'Clouds' && weather.clouds <= 40))
    : weather.clouds <= 60;

  if (isRainy) {
    return `${base} ${t('prediction.weatherRainDetail')} ${t('prediction.weatherEffectCalm')}`;
  }

  if (isSnowy) {
    return `${base} ${t('prediction.weatherSnowDetail')} ${t('prediction.weatherEffectCalm')}`;
  }

  if (isClear) {
    return `${base} ${t('prediction.weatherClearDetail')} ${t('prediction.weatherEffectActive')}`;
  }

  return `${base} ${t('prediction.weatherCloudyDetail')} ${t('prediction.weatherEffectCalm')}`;
});

const modelBadgeLabel = computed(() => (
  isColdModel.value ? t('prediction.badgeCold') : t('prediction.badgeWarm')
));

const detailModelTitle = computed(() => (
  isColdModel.value ? t('prediction.detailModelTitleCold') : t('prediction.detailModelTitleWarm')
));

const modelInsightText = computed(() => {
  if (predictionRecordCount.value) {
    return isColdModel.value
      ? t('prediction.modelInsightColdWithCount', { count: predictionRecordCount.value })
      : t('prediction.modelInsightWarmWithCount', { count: predictionRecordCount.value });
  }

  if (isColdModel.value) {
    return t('prediction.modelInsightCold');
  }

  return t('prediction.modelInsightWarm');
});

const modelHintText = computed(() => (
  isColdModel.value ? t('prediction.modelHintCold') : t('prediction.modelHintWarm')
));

const openSettings = () => {
  playHaptic('secondaryNav');
  router.push('/settings');
};

const openLocationSearch = () => {
  playHaptic('secondaryNav');
  locationStore.openSearchModal();
};

const toggleMethodCard = () => {
  isMethodExpanded.value = !isMethodExpanded.value;
  playHaptic('secondaryNav');
};

const loadPrediction = async () => {
  try {
    await predictionsStore.ensureTomorrowPrediction();
  } catch (error) {
    console.error('Forecast error:', error);
  }
};

const retryWithGps = async () => {
  playHaptic('submit');

  try {
    await locationStore.requestBrowserLocation();
    locationStore.setAutoDetect(true);
    await loadPrediction();
    playHaptic('success');
  } catch (error) {
    console.error('Geolocation retry failed:', error);
    locationStore.setAutoDetect(false);
    playHaptic('error');
  }
};

const forecastSteps = computed(() => ([
  {
    icon: '📝',
    title: t('prediction.stepRecordsTitle'),
    text: t('prediction.stepRecordsText'),
  },
  {
    icon: '🌦️',
    title: t('prediction.stepWeatherTitle'),
    text: t('prediction.stepWeatherText'),
  },
  {
    icon: '🧭',
    title: t('prediction.stepModelTitle'),
    text: t('prediction.stepModelText'),
  },
]));

const forecastLegend = computed(() => ([
  { tone: 'rise', label: t('prediction.legendRise') },
  { tone: 'stable', label: t('prediction.legendStable') },
  { tone: 'drop', label: t('prediction.legendDrop') },
]));

onMounted(() => {
  dayRefreshTimerId = window.setInterval(() => {
    currentDayKey.value = getLogicalDateKey(new Date());
  }, 60_000);
});

onBeforeUnmount(() => {
  if (dayRefreshTimerId) {
    window.clearInterval(dayRefreshTimerId);
  }
});

const moodEmoji = computed(() => {
  if (!prediction.value) return '⚖️';
  return { rise: '🌤️', drop: '🌧️', stable: '⚖️' }[prediction.value.mood_trend] || '⚖️';
});

const moodTrendTitle = computed(() => {
  if (!prediction.value) return '—';

  return {
    rise: t('prediction.moodRiseTitle'),
    drop: t('prediction.moodDropTitle'),
    stable: t('prediction.moodStableTitle'),
  }[prediction.value.mood_trend] || t('prediction.moodStableTitle');
});

const moodTrendSub = computed(() => {
  if (!prediction.value) return '';

  return {
    rise: t('prediction.moodRiseSub'),
    drop: t('prediction.moodDropSub'),
    stable: t('prediction.moodStableSub'),
  }[prediction.value.mood_trend] || '';
});

const energyEmoji = computed(() => {
  if (!prediction.value) return '⚖️';
  if (!energyAvailable.value) return '⏳';
  return { rise: '⚡', drop: '🔋', stable: '⚖️' }[prediction.value.energy_trend] || '⚖️';
});

const energyTrendTitle = computed(() => {
  if (!prediction.value) return '—';
  if (!energyAvailable.value) return t('prediction.energyPendingTitle');

  return {
    rise: t('prediction.energyRiseTitle'),
    drop: t('prediction.energyDropTitle'),
    stable: t('prediction.energyStableTitle'),
  }[prediction.value.energy_trend] || t('prediction.energyStableTitle');
});

const energyTrendSub = computed(() => {
  if (!prediction.value) return '';
  if (!energyAvailable.value) return t('prediction.energyPendingSub');

  return {
    rise: t('prediction.energyRiseSub'),
    drop: t('prediction.energyDropSub'),
    stable: t('prediction.energyStableSub'),
  }[prediction.value.energy_trend] || '';
});

watch(
  () => [authStore.user?.id, authStore.user?.analytics_consent],
  ([userId]) => {
    if (!userId) {
      return;
    }

    void loadPrediction();
  },
  { immediate: true }
);

watch(
  () => [locationStore.lat, locationStore.lon],
  ([lat, lon], [prevLat, prevLon]) => {
    if (lat === prevLat && lon === prevLon) {
      return;
    }

    if (
      Number.isFinite(Number(lat)) &&
      Number.isFinite(Number(lon)) &&
      authStore.user?.analytics_consent
    ) {
      void loadPrediction();
    }
  }
);

watch(currentDayKey, (nextDayKey, previousDayKey) => {
  if (nextDayKey !== previousDayKey && authStore.user?.analytics_consent) {
    void loadPrediction();
  }
});
</script>

<style scoped>
@import '../assets/styles/views/prediction-view.css';
</style>
