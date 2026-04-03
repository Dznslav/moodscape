import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import api from '../api/axios';
import { useAuthStore } from './auth';
import { useLocationStore } from './location';
import { buildCoordinateKey, normalizeCoordinates } from '../utils/coordinates';
import { getLogicalTomorrowDateKey } from '../utils/date';

const getTomorrowTargetDate = () => getLogicalTomorrowDateKey(new Date());
const PREDICTION_CACHE_REVISION = 'warm-next-value-v1';

export const usePredictionsStore = defineStore('predictions', () => {
  const prediction = ref(null);
  const targetDate = ref('');
  const status = ref('idle');
  const error = ref(null);
  const hasConsentError = ref(false);
  const needsLocation = ref(false);
  const activeUserKey = ref(null);
  const activeLocationKey = ref('');
  const activeCacheRevision = ref('');
  let pendingRequest = null;

  const isLoading = computed(() => status.value === 'loading');

  const getUserKey = () => {
    const authStore = useAuthStore();
    return authStore.user?.id ? String(authStore.user.id) : authStore.token || null;
  };

  const clearForLogout = () => {
    prediction.value = null;
    targetDate.value = '';
    status.value = 'idle';
    error.value = null;
    hasConsentError.value = false;
    needsLocation.value = false;
    activeUserKey.value = null;
    activeLocationKey.value = '';
    activeCacheRevision.value = '';
    pendingRequest = null;
  };

  const invalidate = () => {
    prediction.value = null;
    targetDate.value = '';
    status.value = 'idle';
    error.value = null;
    hasConsentError.value = false;
    needsLocation.value = false;
    activeLocationKey.value = '';
    activeCacheRevision.value = '';
  };

  const syncSession = () => {
    const userKey = getUserKey();

    if (!userKey) {
      clearForLogout();
      return null;
    }

    if (activeUserKey.value && activeUserKey.value !== userKey) {
      clearForLogout();
    }

    return userKey;
  };

  const ensureTomorrowPrediction = async () => {
    const authStore = useAuthStore();
    const locationStore = useLocationStore();
    const userKey = syncSession();
    const nextTargetDate = getTomorrowTargetDate();

    if (!userKey) {
      return prediction.value;
    }

    if (!authStore.user?.analytics_consent) {
      hasConsentError.value = true;
      needsLocation.value = false;
      status.value = prediction.value ? 'ready' : 'idle';
      return prediction.value;
    }

    hasConsentError.value = false;

    if (pendingRequest) {
      return pendingRequest;
    }

    status.value = 'loading';
    error.value = null;
    needsLocation.value = false;

    pendingRequest = (async () => {
      const hasCoordinates = await locationStore.ensureFreshLocation();

      if (!hasCoordinates) {
        needsLocation.value = true;
        status.value = 'idle';
        return null;
      }

      const { latitude, longitude } = normalizeCoordinates(locationStore.lat, locationStore.lon);
      const nextLocationKey = buildCoordinateKey(locationStore.lat, locationStore.lon);

      if (
        prediction.value &&
        activeUserKey.value === userKey &&
        targetDate.value === nextTargetDate &&
        activeLocationKey.value === nextLocationKey &&
        activeCacheRevision.value === PREDICTION_CACHE_REVISION
      ) {
        status.value = 'ready';
        return prediction.value;
      }

      const scopeChanged =
        activeUserKey.value !== userKey ||
        targetDate.value !== nextTargetDate ||
        activeLocationKey.value !== nextLocationKey ||
        activeCacheRevision.value !== PREDICTION_CACHE_REVISION;

      if (scopeChanged) {
        prediction.value = null;
      }

      const response = await api.post('/predictions/tomorrow', {
        target_date: nextTargetDate,
        latitude,
        longitude,
      });

      prediction.value = response.data;
      targetDate.value = nextTargetDate;
      status.value = 'ready';
      error.value = null;
      hasConsentError.value = false;
      needsLocation.value = false;
      activeUserKey.value = userKey;
      activeLocationKey.value = nextLocationKey;
      activeCacheRevision.value = PREDICTION_CACHE_REVISION;

      return prediction.value;
    })()
      .catch((requestError) => {
        error.value = requestError;
        status.value = prediction.value ? 'ready' : 'error';
        throw requestError;
      })
      .finally(() => {
        pendingRequest = null;
      });

    return pendingRequest;
  };

  return {
    clearForLogout,
    ensureTomorrowPrediction,
    error,
    hasConsentError,
    invalidate,
    isLoading,
    needsLocation,
    prediction,
    status,
    targetDate,
  };
});
