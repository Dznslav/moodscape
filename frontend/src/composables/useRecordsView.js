import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import api from '../api/axios';
import { useAuthStore } from '../stores/auth';
import { useLocationStore } from '../stores/location';
import { useOnboardingStore } from '../stores/onboarding';
import { usePredictionsStore } from '../stores/predictions';
import { useRecordsStore } from '../stores/records';
import { getEnergyLabelKey } from '../utils/energy';
import {
  activityCatalog,
  getActivityDisplayLabel,
  isActivityIgnored,
  isActivitySelected,
  prepareActivitiesForSave,
  toggleActivitySelection,
} from '../utils/activities';
import {
  getDateFromKey,
  getDateKey,
  formatMonthYearLabel,
  formatRecordDate,
  getLogicalDate,
  getLogicalDateKey,
  getShiftedMonthCursor,
  isFutureMonth,
} from '../utils/date';
import {
  energyEmojis,
  getEnergyEmoji,
  getMoodEmoji,
  moodEmojis,
} from '../utils/recordPresentation';
import { normalizeCoordinates } from '../utils/coordinates';
import { filterRecordsByMonth } from '../utils/records';
import { scrollElementToViewportTopAfterRender } from '../utils/formScroll';
import { playHaptic } from '../utils/haptics';

const defaultMoodValue = 3;
const defaultEnergyValue = 3;

export const useRecordsView = ({ formCardRef } = {}) => {
  const { t, locale } = useI18n();
  const authStore = useAuthStore();
  const locationStore = useLocationStore();
  const onboardingStore = useOnboardingStore();
  const predictionsStore = usePredictionsStore();
  const recordsStore = useRecordsStore();

  const mood = ref(defaultMoodValue);
  const energy = ref(defaultEnergyValue);
  const note = ref('');
  const selectedTags = ref([]);
  const now = ref(new Date());
  const isSubmitting = ref(false);
  const isLoadingPage = ref(true);
  const isEditing = ref(false);
  const editingRecordId = ref(null);
  const showGdprConsent = ref(false);
  const openMenuId = ref(null);
  const viewYear = ref(getLogicalDate(now.value).getFullYear());
  const viewMonth = ref(getLogicalDate(now.value).getMonth());
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  let onboardingDraftHydrated = false;
  let nowTimerId = null;

  const records = computed(() => recordsStore.records);
  const todayRecord = computed(() => recordsStore.todayRecord);
  const todayKey = computed(() => getLogicalDateKey(now.value));
  const calendarTodayKey = computed(() => getDateKey(now.value));

  const resetForm = () => {
    mood.value = defaultMoodValue;
    energy.value = defaultEnergyValue;
    note.value = '';
    selectedTags.value = [];
  };

  const populateFormFromRecord = (record) => {
    mood.value = record.mood;
    energy.value = record.energy;
    note.value = record.note || '';
    selectedTags.value = Array.isArray(record.tags) ? [...record.tags] : [];
  };

  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);

    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }

    return null;
  };

  const checkGdprConsent = (userId) => {
    const gdprToken = `gdprConsent_${userId}`;
    const hasConsent = getCookie(gdprToken) || localStorage.getItem(gdprToken);

    if (!hasConsent) {
      showGdprConsent.value = true;
    }
  };

  const onConsentUpdated = (preferences) => {
    console.log('GDPR preferences assigned:', preferences);
  };

  const availableTags = activityCatalog;
  const activityLabel = (tag) => getActivityDisplayLabel(tag, t);
  const visibleTags = (tags) =>
    Array.isArray(tags) ? tags.filter((tag) => !isActivityIgnored(tag)) : [];
  const isTagSelected = (tagId) => isActivitySelected(selectedTags.value, tagId);

  const toggleTag = (tagId) => {
    selectedTags.value = toggleActivitySelection(selectedTags.value, tagId);
    playHaptic('chipToggle');
  };

  const selectMood = (value) => {
    if (mood.value === value) {
      return;
    }

    mood.value = value;
    playHaptic('picker');
  };

  const selectEnergy = (value) => {
    if (energy.value === value) {
      return;
    }

    energy.value = value;
    playHaptic('picker');
  };

  const showForm = computed(() => isEditing.value || !todayRecord.value);
  const showRecordSummary = computed(() => Boolean(todayRecord.value) && !isEditing.value);
  const moodNames = computed(() => [
    t('moods.awful'),
    t('moods.bad'),
    t('moods.meh'),
    t('moods.good'),
    t('moods.super'),
  ]);
  const energyLabels = computed(() =>
    Array.from({ length: 5 }, (_, index) => t(getEnergyLabelKey(index + 1)))
  );

  const greeting = computed(() => {
    const hour = now.value.getHours();

    if (hour < 4) return t('dashboard.greetingNight');
    if (hour < 12) return t('dashboard.greetingMorning');
    if (hour < 18) return t('dashboard.greetingAfternoon');
    return t('dashboard.greetingEvening');
  });

  const displayName = computed(
    () => authStore.user?.name || authStore.user?.email?.split('@')[0] || t('dashboard.defaultUser')
  );

  const today = computed(() => {
    return {
      day: now.value.getDate(),
      month: now.value.toLocaleDateString(locale.value, { month: 'short' }),
    };
  });
  const isLogicalCarryover = computed(
    () => now.value.getHours() < 4 && todayKey.value !== calendarTodayKey.value
  );
  const trackingDateLabel = computed(() =>
    formatRecordDate(getDateFromKey(todayKey.value), locale.value)
  );

  const monthYearLabel = computed(() =>
    formatMonthYearLabel(viewYear.value, viewMonth.value, locale.value)
  );

  const filteredRecords = computed(() =>
    filterRecordsByMonth(records.value, viewYear.value, viewMonth.value)
  );

  const hasRecordsForMonth = computed(() => filteredRecords.value.length > 0);

  const shiftMonth = (direction) => {
    const nextCursor = getShiftedMonthCursor(viewYear.value, viewMonth.value, direction);
    const logicalToday = getLogicalDate(now.value);

    if (direction > 0 && isFutureMonth(nextCursor.year, nextCursor.month, logicalToday)) {
      return;
    }

    viewYear.value = nextCursor.year;
    viewMonth.value = nextCursor.month;
    playHaptic('secondaryNav');
  };

  const prevMonth = () => shiftMonth(-1);
  const nextMonth = () => shiftMonth(1);
  const canMoveNextMonth = computed(() => {
    const nextCursor = getShiftedMonthCursor(viewYear.value, viewMonth.value, 1);
    return !isFutureMonth(nextCursor.year, nextCursor.month, getLogicalDate(now.value));
  });

  const formatDate = (value) => formatRecordDate(value, locale.value);
  const todayMoodSummary = computed(() => ({
    emoji: getMoodEmoji(todayRecord.value?.mood),
    value: todayRecord.value
      ? moodNames.value[Math.max(0, Math.min(4, Number(todayRecord.value.mood) - 1))]
      : '',
  }));
  const todayEnergySummary = computed(() => ({
    emoji: getEnergyEmoji(todayRecord.value?.energy),
    value: todayRecord.value
      ? energyLabels.value[Math.max(0, Math.min(4, Number(todayRecord.value.energy) - 1))]
      : '',
  }));
  const todayRecordTags = computed(() => visibleTags(todayRecord.value?.tags));
  const todayRecordNote = computed(() => String(todayRecord.value?.note ?? '').trim());

  const toggleMenu = (id) => {
    openMenuId.value = openMenuId.value === id ? null : id;
    playHaptic('secondaryNav');
  };

  const startEdit = async (record) => {
    openMenuId.value = null;
    populateFormFromRecord(record);
    editingRecordId.value = record.id;
    isEditing.value = true;
    playHaptic('openPanel');
    await scrollElementToViewportTopAfterRender(formCardRef);
  };

  const openTodayEditor = () => {
    if (todayRecord.value) {
      startEdit(todayRecord.value);
    }
  };

  const cancelEdit = () => {
    isEditing.value = false;
    editingRecordId.value = null;
    resetForm();
    playHaptic('closePanel');
  };

  const syncSavedRecord = async (response) => {
    if (response?.data?.id) {
      recordsStore.upsertRecord(response.data);
      return;
    }

    await recordsStore.refresh();
  };

  const applyWelcomeIntroDraft = () => {
    if (onboardingDraftHydrated) {
      return;
    }

    onboardingDraftHydrated = true;

    const draft = onboardingStore.getIntroDraft();
    if (!draft) {
      return;
    }

    if (todayRecord.value) {
      onboardingStore.clearIntroDraft();
      return;
    }

    mood.value = draft.mood;
    energy.value = draft.energy;
    note.value = '';
    selectedTags.value = [];
    onboardingStore.clearIntroDraft();
  };

  const submitRecord = async () => {
    if (authStore.user?.analytics_consent) {
      await locationStore.ensureFreshLocation();
    }

    isSubmitting.value = true;
    playHaptic('submit');

    try {
      const payload = {
        mood: mood.value,
        energy: energy.value,
        note: note.value || null,
        tags: prepareActivitiesForSave(selectedTags.value),
      };

      let response;

      if (isEditing.value && editingRecordId.value) {
        response = await api.put(`/records/${editingRecordId.value}`, payload);
      } else {
        if (authStore.user?.analytics_consent) {
          const { latitude, longitude } = normalizeCoordinates(locationStore.lat, locationStore.lon);
          payload.latitude = latitude;
          payload.longitude = longitude;
        }

        payload.timezone = userTimezone;
        response = await api.post('/records/', payload);
      }

      await syncSavedRecord(response);
      predictionsStore.invalidate();

      isEditing.value = false;
      editingRecordId.value = null;
      resetForm();
      playHaptic('success');
    } catch (error) {
      console.error('Error saving record:', error);
      playHaptic('error');
      alert(`${t('dashboard.saveError')} ${error.response?.data?.detail || ''}`);
    } finally {
      isSubmitting.value = false;
    }
  };

  watch(
    () => authStore.user,
    (user) => {
      if (user) {
        checkGdprConsent(user.id);
      }
    },
    { immediate: true }
  );

  watch(todayKey, (nextDateKey, previousDateKey) => {
    if (nextDateKey === previousDateKey) {
      return;
    }

    const logicalToday = getLogicalDate(now.value);
    viewYear.value = logicalToday.getFullYear();
    viewMonth.value = logicalToday.getMonth();
  });

  onMounted(async () => {
    nowTimerId = window.setInterval(() => {
      now.value = new Date();
    }, 60_000);

    try {
      await recordsStore.ensureLoaded();
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      applyWelcomeIntroDraft();
      isLoadingPage.value = false;
    }
  });

  onBeforeUnmount(() => {
    if (nowTimerId) {
      window.clearInterval(nowTimerId);
    }
  });

  return {
    activityLabel,
    availableTags,
    cancelEdit,
    canMoveNextMonth,
    displayName,
    energy,
    energyEmoji: getEnergyEmoji,
    energyEmojis,
    filteredRecords,
    formatDate,
    greeting,
    hasRecordsForMonth,
    isEditing,
    isLoadingPage,
    isSubmitting,
    isTagSelected,
    monthYearLabel,
    mood,
    moodEmoji: getMoodEmoji,
    moodEmojis,
    nextMonth,
    note,
    onConsentUpdated,
    openMenuId,
    openTodayEditor,
    prevMonth,
    records,
    selectedTags,
    selectEnergy,
    selectMood,
    showForm,
    showRecordSummary,
    showGdprConsent,
    startEdit,
    submitRecord,
    today,
    isLogicalCarryover,
    trackingDateLabel,
    todayEnergySummary,
    todayMoodSummary,
    todayRecord,
    todayRecordNote,
    todayRecordTags,
    toggleMenu,
    toggleTag,
    visibleTags,
  };
};
