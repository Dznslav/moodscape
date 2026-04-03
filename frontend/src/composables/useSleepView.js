import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAuthStore } from '../stores/auth';
import { useSleepStore } from '../stores/sleep';
import {
  getDateKey,
  formatMonthYearLabel,
  getDateFromKey,
  getLogicalDate,
  getLogicalDateKey,
  getShiftedMonthCursor,
  isFutureMonth,
  formatRecordDate,
} from '../utils/date';
import { scrollElementToViewportTopAfterRender } from '../utils/formScroll';
import { playHaptic } from '../utils/haptics';

const defaultSleepHours = 8;
const defaultSleepQuality = 2;

const formatSleepHoursValue = (value, locale) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '';
  }

  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(numericValue);
};

export const useSleepView = ({ formCardRef } = {}) => {
  const { t, locale } = useI18n();
  const authStore = useAuthStore();
  const sleepStore = useSleepStore();

  const now = ref(new Date());
  const sleepHours = ref(defaultSleepHours);
  const sleepQuality = ref(defaultSleepQuality);
  const isSleepSubmitting = ref(false);
  const isLoadingPage = ref(true);
  const isEditingSleep = ref(false);
  const editingSleepDateKey = ref(null);
  const openMenuId = ref(null);
  const viewYear = ref(getLogicalDate(now.value).getFullYear());
  const viewMonth = ref(getLogicalDate(now.value).getMonth());
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  let nowTimerId = null;

  const todayKey = computed(() => getLogicalDateKey(now.value));
  const calendarTodayKey = computed(() => getDateKey(now.value));
  const sleepLogs = computed(() => sleepStore.logs);
  const sleepLogsByDate = computed(() => sleepStore.logsByDate);
  const todaySleepLog = computed(() => sleepLogsByDate.value[todayKey.value] ?? null);
  const activeSleepDateKey = computed(() => editingSleepDateKey.value ?? todayKey.value);
  const activeSleepLog = computed(() => sleepLogsByDate.value[activeSleepDateKey.value] ?? null);

  const resetSleepForm = () => {
    sleepHours.value = defaultSleepHours;
    sleepQuality.value = defaultSleepQuality;
  };

  const populateSleepFormFromLog = (sleepLog) => {
    sleepHours.value = Number(sleepLog?.hours_slept ?? defaultSleepHours);
    sleepQuality.value = Number(sleepLog?.sleep_quality ?? defaultSleepQuality);
  };

  const syncSleepForm = () => {
    if (activeSleepLog.value) {
      populateSleepFormFromLog(activeSleepLog.value);
      return;
    }

    resetSleepForm();
  };

  const sleepQualityOptions = computed(() => [
    { value: 1, emoji: '😞', label: t('sleep.qualityBad') },
    { value: 2, emoji: '😌', label: t('sleep.qualityNormal') },
    { value: 3, emoji: '🙂', label: t('sleep.qualityGood') },
  ]);

  const getSleepQualityOption = (value) =>
    sleepQualityOptions.value.find((option) => option.value === Number(value)) ??
    sleepQualityOptions.value[1];

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

  const today = computed(() => ({
    day: now.value.getDate(),
    month: now.value.toLocaleDateString(locale.value, { month: 'short' }),
  }));
  const isLogicalCarryover = computed(
    () => now.value.getHours() < 4 && todayKey.value !== calendarTodayKey.value
  );
  const trackingDateLabel = computed(() =>
    formatRecordDate(getDateFromKey(todayKey.value), locale.value)
  );

  const showSleepForm = computed(() => isEditingSleep.value || !todaySleepLog.value);
  const showSleepSummary = computed(() => Boolean(todaySleepLog.value) && !isEditingSleep.value);
  const isEditingHistoricalSleep = computed(
    () => Boolean(editingSleepDateKey.value) && editingSleepDateKey.value !== todayKey.value
  );
  const editingSleepDateLabel = computed(() =>
    editingSleepDateKey.value ? formatRecordDate(getDateFromKey(editingSleepDateKey.value), locale.value) : ''
  );

  const sleepHoursDisplay = computed(() => formatSleepHoursValue(sleepHours.value, locale.value));
  const sleepRangeProgress = computed(
    () => `${Math.max(0, Math.min(100, (sleepHours.value / 16) * 100))}%`
  );
  const todaySleepHoursDisplay = computed(() =>
    formatSleepHoursValue(todaySleepLog.value?.hours_slept, locale.value)
  );
  const todaySleepQuality = computed(() => getSleepQualityOption(todaySleepLog.value?.sleep_quality));

  const monthYearLabel = computed(() =>
    formatMonthYearLabel(viewYear.value, viewMonth.value, locale.value)
  );

  const filteredSleepLogs = computed(() =>
    sleepLogs.value.filter((log) => {
      const date = getDateFromKey(log.sleep_date);
      return date.getFullYear() === viewYear.value && date.getMonth() === viewMonth.value;
    })
  );

  const hasSleepLogsForMonth = computed(() => filteredSleepLogs.value.length > 0);
  const hasSleepLogs = computed(() => sleepLogs.value.length > 0);

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

  const formatSleepDate = (value) => formatRecordDate(getDateFromKey(value), locale.value);
  const sleepQualityLabel = (value) => getSleepQualityOption(value).label;
  const sleepQualityEmoji = (value) => getSleepQualityOption(value).emoji;
  const formatSleepHours = (value) => formatSleepHoursValue(value, locale.value);

  const toggleMenu = (id) => {
    openMenuId.value = openMenuId.value === id ? null : id;
    playHaptic('secondaryNav');
  };

  const selectSleepQuality = (value) => {
    if (sleepQuality.value === value) {
      return;
    }

    sleepQuality.value = value;
    playHaptic('picker');
  };

  const updateSleepHours = (value) => {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue) || sleepHours.value === numericValue) {
      return;
    }

    sleepHours.value = numericValue;
    playHaptic('picker');
  };

  const startSleepEdit = async (sleepLog = todaySleepLog.value) => {
    editingSleepDateKey.value = sleepLog?.sleep_date ?? todayKey.value;
    openMenuId.value = null;
    isEditingSleep.value = true;
    syncSleepForm();
    playHaptic('openPanel');
    await scrollElementToViewportTopAfterRender(formCardRef);
  };

  const openSleepEditor = () => {
    startSleepEdit(todaySleepLog.value);
  };

  const cancelSleepEdit = () => {
    isEditingSleep.value = false;
    editingSleepDateKey.value = null;
    syncSleepForm();
    playHaptic('closePanel');
  };

  const submitSleepLog = async () => {
    isSleepSubmitting.value = true;
    playHaptic('submit');

    try {
      await sleepStore.saveTodayLog({
        hours_slept: sleepHours.value,
        sleep_quality: sleepQuality.value,
        timezone: userTimezone,
        sleep_date: activeSleepDateKey.value,
      });

      isEditingSleep.value = false;
      editingSleepDateKey.value = null;
      syncSleepForm();
      playHaptic('success');
    } catch (error) {
      console.error('Error saving sleep log:', error);
      playHaptic('error');
      alert(`${t('sleep.saveError')} ${error.response?.data?.detail || ''}`.trim());
    } finally {
      isSleepSubmitting.value = false;
    }
  };

  watch(
    () => [activeSleepLog.value?.id ?? null, activeSleepDateKey.value],
    () => {
      syncSleepForm();
    },
    { immediate: true }
  );

  watch(todayKey, (nextDateKey, previousDateKey) => {
    if (previousDateKey !== nextDateKey) {
      const logicalToday = getLogicalDate(now.value);
      viewYear.value = logicalToday.getFullYear();
      viewMonth.value = logicalToday.getMonth();
    }

    if (!isEditingSleep.value) {
      editingSleepDateKey.value = null;
    }
  });

  onMounted(async () => {
    nowTimerId = window.setInterval(() => {
      now.value = new Date();
    }, 60_000);

    try {
      await sleepStore.ensureLoaded();
      syncSleepForm();
    } catch (error) {
      console.error('Error loading sleep logs:', error);
    } finally {
      isLoadingPage.value = false;
    }
  });

  onBeforeUnmount(() => {
    if (nowTimerId) {
      window.clearInterval(nowTimerId);
    }
  });

  return {
    canMoveNextMonth,
    cancelSleepEdit,
    displayName,
    editingSleepDateLabel,
    formatSleepDate,
    formatSleepHours,
    greeting,
    hasSleepLogs,
    hasSleepLogsForMonth,
    isEditingHistoricalSleep,
    isEditingSleep,
    isLoadingPage,
    isSleepSubmitting,
    monthYearLabel,
    nextMonth,
    openMenuId,
    openSleepEditor,
    prevMonth,
    showSleepForm,
    showSleepSummary,
    sleepHours,
    sleepHoursDisplay,
    sleepQuality,
    sleepQualityEmoji,
    sleepQualityLabel,
    sleepQualityOptions,
    sleepRangeProgress,
    selectSleepQuality,
    startSleepEdit,
    submitSleepLog,
    today,
    isLogicalCarryover,
    trackingDateLabel,
    todaySleepHoursDisplay,
    todaySleepLog,
    todaySleepQuality,
    updateSleepHours,
    toggleMenu,
    filteredSleepLogs,
  };
};
