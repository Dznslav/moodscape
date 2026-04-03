import { computed, nextTick, onActivated, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from 'chart.js';
import { useI18n } from 'vue-i18n';
import { useRecordsStore } from '../stores/records';
import { useSleepStore } from '../stores/sleep';
import {
  buildMoodCounterChartData,
  createNumericTrendOptions,
  createTrendOptions,
  moodCounterOptions,
} from '../utils/chartOptions';
import {
  getActivityDisplayLabel,
  getActivityGroupKey,
  resolveActivityId,
} from '../utils/activities';
import {
  getDateFromKey,
  getDateKey,
  formatFullDateLabel,
  getLogicalDate,
  getLogicalDateKey,
  getLogicalMonthKeyFromDate,
  getLogicalYearKeyFromDate,
  getMonthKeyFromDate,
  getYearKeyFromDate,
  isFutureMonth,
} from '../utils/date';
import {
  buildMoodDistribution,
  energyColors,
  energyEmojis,
  getEnergySummaryEmoji,
  getMoodSummaryEmoji,
  moodColors,
  moodEmojis,
} from '../utils/recordPresentation';
import { buildRecordsByDate } from '../utils/records';
import {
  buildActivityImpact,
  buildMoodInstability,
  buildSleepImpact,
  buildYearInPixels,
} from '../utils/statistics';
import { useBodyScrollLock } from './useBodyScrollLock';
import { useRevealCards } from './useRevealCards';

ChartJS.register(
  CategoryScale,
  LinearScale,
  RadialLinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Filler,
  Tooltip,
  Legend
);

const noDataLabel = '\u2014';
const stagedSectionKeys = [
  'yearInPixels',
  'moodCounter',
  'moodTrend',
  'energyTrend',
  'radar',
  'sleepHoursTrend',
  'sleepQualityTrend',
  'sleepImpact',
  'activityImpact',
  'insights',
  'achievements',
];
const eagerSectionKeys = new Set([
  'yearInPixels',
  'moodCounter',
  'moodTrend',
  'energyTrend',
]);
const createVisibleSectionsState = (isVisible = false) =>
  Object.fromEntries(
    stagedSectionKeys.map((sectionKey) => [sectionKey, isVisible || eagerSectionKeys.has(sectionKey)])
  );

const pushGroupedItem = (groups, key, item) => {
  if (!groups[key]) {
    groups[key] = [];
  }

  groups[key].push(item);
};

const buildTimeGroups = (items, getMonthKeyForItem, getYearKeyForItem) => {
  const monthGroups = Object.create(null);
  const yearGroups = Object.create(null);

  for (const item of items) {
    pushGroupedItem(monthGroups, getMonthKeyForItem(item), item);
    pushGroupedItem(yearGroups, getYearKeyForItem(item), item);
  }

  return {
    monthGroups,
    yearGroups,
  };
};

export const useStatisticsView = () => {
  const { t, locale } = useI18n();
  const recordsStore = useRecordsStore();
  const sleepStore = useSleepStore();
  const records = computed(() => recordsStore.records);
  const sleepLogs = computed(() => sleepStore.logs);
  const isLoading = ref(!(recordsStore.hasLoaded && sleepStore.hasLoaded));
  const showAllAchievements = ref(false);
  const showAllActivityImpact = ref(false);
  const activeChartInfoId = ref(null);
  const periodMode = ref('month');
  const selectedMonthKey = ref('');
  const selectedYearKey = ref('');
  const visibleSections = ref(createVisibleSectionsState());
  const observedSectionKeys = new Set();
  const sectionElements = new Map();
  let sectionObserver = null;

  const { ensureRevealObserver, registerRevealCard } = useRevealCards();

  useBodyScrollLock(computed(() => Boolean(activeChartInfoId.value)));

  const moodNames = computed(() => [
    t('moods.awful'),
    t('moods.bad'),
    t('moods.meh'),
    t('moods.good'),
    t('moods.super'),
  ]);

  const dayKeys = computed(() => [
    t('days.mon'),
    t('days.tue'),
    t('days.wed'),
    t('days.thu'),
    t('days.fri'),
    t('days.sat'),
    t('days.sun'),
  ]);

  const activityLabel = (activity) => getActivityDisplayLabel(activity, t);
  const isSectionVisible = (sectionKey) => Boolean(visibleSections.value[sectionKey]);
  const openChartInfo = (infoId) => {
    activeChartInfoId.value = infoId;
  };
  const closeChartInfo = () => {
    activeChartInfoId.value = null;
  };
  const revealSection = (sectionKey) => {
    if (visibleSections.value[sectionKey]) {
      return;
    }

    visibleSections.value = {
      ...visibleSections.value,
      [sectionKey]: true,
    };

    const element = sectionElements.get(sectionKey);

    if (!element) {
      return;
    }

    element.classList.add('reveal-card--visible');
    sectionObserver?.unobserve(element);
    observedSectionKeys.delete(sectionKey);
  };

  const registerSectionCard = (sectionKey) => (element) => {
    if (!element) {
      return;
    }

    element.dataset.statisticsSection = sectionKey;
    sectionElements.set(sectionKey, element);
    registerRevealCard(element);

    if (visibleSections.value[sectionKey]) {
      element.classList.add('reveal-card--visible');
      return;
    }

    if (!sectionObserver || observedSectionKeys.has(sectionKey)) {
      return;
    }

    observedSectionKeys.add(sectionKey);
    sectionObserver.observe(element);
  };

  const chartInfoContent = computed(() => ({
    moodCounter: {
      title: t('statistics.moodCounter'),
      description: t('statistics.moodCounterInfo'),
    },
    moodTrend: {
      title: t('statistics.moodTrend'),
      description: t('statistics.moodTrendInfo'),
    },
    energyTrend: {
      title: t('statistics.energyTrend'),
      description: t('statistics.energyTrendInfo'),
    },
    radar: {
      title: t('statistics.moodEnergyRadar'),
      description: t('statistics.moodEnergyRadarInfo'),
    },
    moodStability: {
      title: t('statistics.moodStability'),
      description: t('statistics.moodStabilityInfo'),
    },
    activityImpact: {
      title: t('statistics.activityImpact'),
      description: t('statistics.activityImpactInfo'),
    },
    sleepHoursTrend: {
      title: t('statistics.sleepHoursTrend'),
      description: t('statistics.sleepHoursTrendInfo'),
    },
    sleepQualityTrend: {
      title: t('statistics.sleepQualityTrend'),
      description: t('statistics.sleepQualityTrendInfo'),
    },
    sleepImpact: {
      title: t('statistics.sleepImpact'),
      description: t('statistics.sleepImpactInfo'),
    },
  }));

  const activeChartInfo = computed(() =>
    activeChartInfoId.value ? chartInfoContent.value[activeChartInfoId.value] ?? null : null
  );
  const recordGroups = computed(() =>
    buildTimeGroups(
      records.value,
      (record) => getLogicalMonthKeyFromDate(record.timestamp),
      (record) => getLogicalYearKeyFromDate(record.timestamp)
    )
  );
  const sleepLogGroups = computed(() =>
    buildTimeGroups(
      sleepLogs.value,
      (log) => getMonthKeyFromDate(log.sleep_date),
      (log) => getYearKeyFromDate(log.sleep_date)
    )
  );

  const availableMonthKeys = computed(() =>
    Object.keys(recordGroups.value.monthGroups)
      .filter((monthKey) => {
        const [year, month] = monthKey.split('-').map(Number);
        return !isFutureMonth(year, (month || 1) - 1, getLogicalDate(new Date()));
      })
      .sort()
  );

  const availableYearKeys = computed(() =>
    Object.keys(recordGroups.value.yearGroups)
      .filter((yearKey) => Number(yearKey) <= Number(getLogicalYearKeyFromDate(new Date())))
      .sort()
  );

  const canUseYearView = computed(() => availableMonthKeys.value.length >= 3);

  const showPeriodControls = computed(
    () => availableMonthKeys.value.length > 1 || canUseYearView.value
  );

  const activePeriodKeys = computed(() =>
    periodMode.value === 'year' ? availableYearKeys.value : availableMonthKeys.value
  );

  const activePeriodIndex = computed(() =>
    activePeriodKeys.value.indexOf(
      periodMode.value === 'year' ? selectedYearKey.value : selectedMonthKey.value
    )
  );

  const canMovePrevPeriod = computed(() => activePeriodIndex.value > 0);

  const canMoveNextPeriod = computed(
    () =>
      activePeriodIndex.value !== -1 &&
      activePeriodIndex.value < activePeriodKeys.value.length - 1
  );

  const syncPeriodSelection = () => {
    const latestMonthKey =
      availableMonthKeys.value.at(-1) || getLogicalMonthKeyFromDate(new Date());
    const latestYearKey =
      availableYearKeys.value.at(-1) || getLogicalYearKeyFromDate(new Date());

    if (
      !selectedMonthKey.value ||
      !availableMonthKeys.value.includes(selectedMonthKey.value)
    ) {
      selectedMonthKey.value = latestMonthKey;
    }

    if (!selectedYearKey.value || !availableYearKeys.value.includes(selectedYearKey.value)) {
      selectedYearKey.value = latestYearKey;
    }

    if (periodMode.value === 'year' && !canUseYearView.value) {
      periodMode.value = 'month';
    }
  };

  watch([availableMonthKeys, availableYearKeys], syncPeriodSelection, { immediate: true });

  const shiftPeriod = (direction) => {
    const nextKey = activePeriodKeys.value[activePeriodIndex.value + direction];

    if (!nextKey) {
      return;
    }

    if (periodMode.value === 'year') {
      selectedYearKey.value = nextKey;
      return;
    }

    selectedMonthKey.value = nextKey;
  };

  const currentMonthYear = computed(() => {
    if (periodMode.value === 'year') {
      return selectedYearKey.value || getLogicalYearKeyFromDate(new Date());
    }

    const monthKey = selectedMonthKey.value || getLogicalMonthKeyFromDate(new Date());
    const [year, month] = monthKey.split('-').map(Number);
    const date = new Date(year, (month || 1) - 1, 1);
    const monthLabel = date.toLocaleDateString(locale.value, { month: 'long' });
    return `${monthLabel.charAt(0).toUpperCase()}${monthLabel.slice(1)} ${date.getFullYear()}`;
  });

  const monthRecords = computed(() => {
    if (periodMode.value === 'year') {
      return recordGroups.value.yearGroups[selectedYearKey.value] ?? [];
    }

    return recordGroups.value.monthGroups[selectedMonthKey.value] ?? [];
  });

  const monthRecordsSorted = computed(() =>
    [...monthRecords.value].sort((left, right) => new Date(left.timestamp) - new Date(right.timestamp))
  );

  const selectedPeriodSleepLogs = computed(() => {
    if (periodMode.value === 'year') {
      return sleepLogGroups.value.yearGroups[selectedYearKey.value] ?? [];
    }

    return sleepLogGroups.value.monthGroups[selectedMonthKey.value] ?? [];
  });

  const selectedPeriodSleepLogsSorted = computed(() =>
    [...selectedPeriodSleepLogs.value].sort((left, right) =>
      String(left.sleep_date).localeCompare(String(right.sleep_date))
    )
  );

  const currentCalendarMonthRecords = computed(() => {
    return recordGroups.value.monthGroups[getLogicalMonthKeyFromDate(new Date())] ?? [];
  });

  const yearTrendPoints = computed(() => {
    const monthlyBuckets = Array.from({ length: 12 }, (_, monthIndex) => ({
      monthIndex,
      moodSum: 0,
      energySum: 0,
      count: 0,
    }));

    for (const record of monthRecords.value) {
      const monthIndex = getLogicalDate(record.timestamp).getMonth();
      monthlyBuckets[monthIndex].moodSum += record.mood;
      monthlyBuckets[monthIndex].energySum += record.energy || 3;
      monthlyBuckets[monthIndex].count += 1;
    }

    return monthlyBuckets
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        label: new Date(
          Number(selectedYearKey.value || getLogicalYearKeyFromDate(new Date())),
          bucket.monthIndex,
          1
        ).toLocaleDateString(locale.value, { month: 'short' }),
        mood: +(bucket.moodSum / bucket.count).toFixed(2),
        energy: +(bucket.energySum / bucket.count).toFixed(2),
      }));
  });

  const trendPoints = computed(() => {
    if (periodMode.value === 'year') {
      return yearTrendPoints.value;
    }

    return monthRecordsSorted.value.map((record) => {
      const recordDate = getLogicalDate(record.timestamp);

      return {
        label: `${recordDate.getDate()}/${recordDate.getMonth() + 1}`,
        mood: record.mood,
        energy: record.energy || 3,
      };
    });
  });

  const trendLabels = computed(() => trendPoints.value.map((point) => point.label));
  const sleepQualityOptions = computed(() => [
    { value: 1, emoji: '\u{1F61E}', label: t('sleep.qualityBad') },
    { value: 2, emoji: '\u{1F60C}', label: t('sleep.qualityNormal') },
    { value: 3, emoji: '\u{1F642}', label: t('sleep.qualityGood') },
  ]);
  const getSleepQualityOption = (value) =>
    sleepQualityOptions.value.find((option) => option.value === Number(value)) ??
    sleepQualityOptions.value[1];
  const sleepQualityLabel = (value) => getSleepQualityOption(value).label;
  const sleepQualityEmoji = (value) => getSleepQualityOption(value).emoji;

  const recordsByDate = computed(() => buildRecordsByDate(records.value));
  const selectedPeriodRecordsByDate = computed(() => buildRecordsByDate(monthRecords.value));
  const yearSleepTrendPoints = computed(() => {
    const monthlyBuckets = Array.from({ length: 12 }, (_, monthIndex) => ({
      monthIndex,
      hoursSum: 0,
      qualitySum: 0,
      count: 0,
    }));

    for (const log of selectedPeriodSleepLogs.value) {
      const monthIndex = getDateFromKey(log.sleep_date).getMonth();
      const hours = Number(log.hours_slept);
      const quality = Number(log.sleep_quality);

      if (!Number.isFinite(hours) || !Number.isFinite(quality)) {
        continue;
      }

      monthlyBuckets[monthIndex].hoursSum += hours;
      monthlyBuckets[monthIndex].qualitySum += quality;
      monthlyBuckets[monthIndex].count += 1;
    }

    return monthlyBuckets
      .filter((bucket) => bucket.count > 0)
      .map((bucket) => ({
        hours: +(bucket.hoursSum / bucket.count).toFixed(1),
        label: new Date(
          Number(selectedYearKey.value || new Date().getFullYear()),
          bucket.monthIndex,
          1
        ).toLocaleDateString(locale.value, { month: 'short' }),
        quality: +(bucket.qualitySum / bucket.count).toFixed(2),
      }));
  });

  const sleepTrendPoints = computed(() => {
    if (periodMode.value === 'year') {
      return yearSleepTrendPoints.value;
    }

    return selectedPeriodSleepLogsSorted.value.map((log) => {
      const sleepDate = getDateFromKey(log.sleep_date);

      return {
        hours: Number(log.hours_slept),
        label: `${sleepDate.getDate()}/${sleepDate.getMonth() + 1}`,
        quality: Number(log.sleep_quality),
      };
    });
  });

  const hasSleepTrendData = computed(() => sleepTrendPoints.value.length > 0);
  const sleepTrendLabels = computed(() => sleepTrendPoints.value.map((point) => point.label));
  const sleepImpact = computed(() =>
    buildSleepImpact({
      recordsByDate: recordsByDate.value,
      sleepLogsByDate: sleepStore.logsByDate,
    })
  );

  const sleepImpactSubtitle = computed(() => {
    if (!sleepImpact.value.pairedCount) {
      return t('statistics.sleepImpactEmpty');
    }

    return t('statistics.sleepImpactSubtitleAllTime', {
      count: sleepImpact.value.pairedCount,
    });
  });

  const sortedUniqueDateKeys = computed(() =>
    [...new Set(records.value.map((record) => getLogicalDateKey(record.timestamp)))].sort()
  );

  const activeYear = computed(() => {
    if (periodMode.value === 'year') {
      return Number(selectedYearKey.value || getLogicalYearKeyFromDate(new Date()));
    }

    const monthKey = selectedMonthKey.value || getLogicalMonthKeyFromDate(new Date());
    return Number(monthKey.split('-')[0]);
  });

  const yearRecords = computed(() =>
    recordGroups.value.yearGroups[String(activeYear.value)] ?? []
  );

  const yearRecordsByDate = computed(() => buildRecordsByDate(yearRecords.value));

  const yearInPixelsData = computed(() =>
    buildYearInPixels(yearRecordsByDate.value, activeYear.value)
  );

  const yearInPixelsLegend = computed(() =>
    [4, 3, 2, 1, 0].map((index) => ({
      color: moodColors[index],
      name: moodNames.value[index],
    }))
  );

  const yearInPixelsMonthMarkers = computed(() =>
    yearInPixelsData.value.monthMarkers.map((marker) => ({
      ...marker,
      label: marker.labelDate.toLocaleDateString(locale.value, { month: 'short' }),
    }))
  );

  const yearInPixelsWeekdayLabels = computed(() => dayKeys.value);

  const yearInPixelsMeta = computed(() =>
    `${activeYear.value} • ${t('statistics.yearInPixelsCoverage', {
      logged: yearInPixelsData.value.coverage.logged,
      total: yearInPixelsData.value.coverage.total,
    })}`
  );

  const yearPixelTitle = (day) => {
    const dateLabel = formatFullDateLabel(day.key, locale.value);

    if (!day.inYear || !day.hasRecord || day.mood === null) {
      return `${dateLabel} • ${t('statistics.noData')}`;
    }

    const moodIndex = Math.max(0, Math.min(4, day.mood - 1));
    return `${dateLabel} • ${moodEmojis[moodIndex]} ${moodNames.value[moodIndex]}`;
  };

  const streakDays = computed(() => {
    const days = [];
    const today = getLogicalDate(new Date());

    for (let index = 4; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(date.getDate() - index);
      const key = getLogicalDateKey(date);
      const dayLabel = date.toLocaleDateString(locale.value, { weekday: 'short' });

      days.push({
        label: `${dayLabel.charAt(0).toUpperCase()}${dayLabel.slice(1)}`,
        isToday: index === 0,
        isFuture: false,
        hasRecord: Boolean(recordsByDate.value[key]),
      });
    }

    return days;
  });

  const currentStreak = computed(() => {
    const dateKeys = sortedUniqueDateKeys.value;

    if (!dateKeys.length) {
      return 0;
    }

    const todayKey = getLogicalDateKey(new Date());
    const yesterday = getLogicalDate(new Date());
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = getDateKey(yesterday);
    const latestKey = dateKeys[dateKeys.length - 1];

    if (latestKey !== todayKey && latestKey !== yesterdayKey) {
      return 0;
    }

    let streak = 0;
    const cursor = getDateFromKey(latestKey);

    while (recordsByDate.value[getDateKey(cursor)]) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  });

  const longestStreak = computed(() => {
    if (!records.value.length) {
      return 0;
    }

    const dates = sortedUniqueDateKeys.value;
    let maxStreak = 1;
    let current = 1;

    for (let index = 1; index < dates.length; index += 1) {
      const previous = getDateFromKey(dates[index - 1]);
      const currentDate = getDateFromKey(dates[index]);
      const diffDays = Math.round((currentDate - previous) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        current += 1;
        maxStreak = Math.max(maxStreak, current);
      } else {
        current = 1;
      }
    }

    return maxStreak;
  });

  const moodDistribution = computed(() =>
    buildMoodDistribution(monthRecords.value, moodNames.value)
  );

  const moodCounterData = computed(() => buildMoodCounterChartData(moodDistribution.value));

  const moodTrendData = computed(() => {
    const data = trendPoints.value.map((point) => point.mood);

    return {
      labels: trendLabels.value,
      datasets: [
        {
          label: t('statistics.moodTrend'),
          data,
          borderColor: '#F15A22',
          backgroundColor: 'rgba(241, 90, 34, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: data.map(
            (value) => moodColors[Math.max(0, Math.min(4, value - 1))]
          ),
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 8,
        },
      ],
    };
  });

  const moodTrendOptions = computed(() =>
    createTrendOptions({
      emojis: moodEmojis,
      formatLabel: (value) => {
        const index = Math.max(0, Math.min(4, Math.round(value) - 1));
        return `${moodEmojis[index]} ${moodNames.value[index]}`;
      },
    })
  );

  const energyTrendData = computed(() => {
    const data = trendPoints.value.map((point) => point.energy);

    return {
      labels: trendLabels.value,
      datasets: [
        {
          label: t('statistics.energyTrend'),
          data,
          borderColor: '#4facfe',
          backgroundColor: 'rgba(79, 172, 254, 0.12)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 5,
          pointBackgroundColor: data.map(
            (value) => energyColors[Math.max(0, Math.min(4, value - 1))]
          ),
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointHoverRadius: 8,
        },
      ],
    };
  });

  const energyTrendOptions = computed(() =>
    createTrendOptions({
      emojis: energyEmojis,
      formatLabel: (value) => {
        const index = Math.max(0, Math.min(4, Math.round(value) - 1));
        return `${energyEmojis[index]} ${t('dashboard.energy')} ${Math.round(value)}/5`;
      },
    })
  );

  const sleepHoursNumberFormatter = computed(
    () =>
      new Intl.NumberFormat(locale.value, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0,
      })
  );

  const sleepHoursTrendData = computed(() => ({
    labels: sleepTrendLabels.value,
    datasets: [
      {
        label: t('statistics.sleepHoursTrend'),
        data: sleepTrendPoints.value.map((point) => point.hours),
        borderColor: '#F15A22',
        backgroundColor: 'rgba(241, 90, 34, 0.12)',
        borderWidth: 3,
        tension: 0.35,
        fill: true,
        pointRadius: 5,
        pointBackgroundColor: '#F15A22',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
      },
    ],
  }));

  const sleepHoursTrendOptions = computed(() =>
    createNumericTrendOptions({
      formatLabel: (value) => `${sleepHoursNumberFormatter.value.format(value)} ${t('sleep.hoursUnit')}`,
      layoutPadding: {
        bottom: 4,
        left: 4,
        right: 10,
        top: 4,
      },
      max: 16,
      min: 0,
      stepSize: 4,
      xMaxTicksLimit: periodMode.value === 'year' ? 12 : 7,
      yTickFormatter: (value) => `${value}${t('sleep.hoursUnit')}`,
    })
  );

  const sleepQualityTrendData = computed(() => ({
    labels: sleepTrendLabels.value,
    datasets: [
      {
        label: t('statistics.sleepQualityTrend'),
        data: sleepTrendPoints.value.map((point) => point.quality),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderWidth: 3,
        tension: 0.25,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: sleepTrendPoints.value.map((point) => {
          if (point.quality >= 3) return '#10b981';
          if (point.quality <= 1) return '#ef4444';
          return '#f59e0b';
        }),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      },
    ],
  }));

  const sleepQualityTrendOptions = computed(() =>
    createNumericTrendOptions({
      formatLabel: (value) => {
        const option = getSleepQualityOption(Math.round(value));
        return `${option.emoji} ${option.label}`;
      },
      layoutPadding: {
        bottom: 10,
        left: 12,
        right: 12,
        top: 10,
      },
      max: 3.5,
      min: 0.5,
      stepSize: 1,
      xMaxTicksLimit: periodMode.value === 'year' ? 12 : 7,
      yTickFontSize: 16,
      yTickFormatter: (value) => {
        const roundedValue = Math.round(value);
        return Math.abs(value - roundedValue) < 0.01 && roundedValue >= 1 && roundedValue <= 3
          ? sleepQualityEmoji(roundedValue)
          : '';
      },
      yTickPadding: 12,
    })
  );

  const avgMood = computed(() => {
    if (!monthRecords.value.length) {
      return noDataLabel;
    }

    const sum = monthRecords.value.reduce((total, record) => total + record.mood, 0);
    return (sum / monthRecords.value.length).toFixed(1);
  });

  const avgEnergy = computed(() => {
    if (!monthRecords.value.length) {
      return noDataLabel;
    }

    const sum = monthRecords.value.reduce((total, record) => total + (record.energy || 3), 0);
    return (sum / monthRecords.value.length).toFixed(1);
  });

  const summaryMoodEmoji = computed(() => getMoodSummaryEmoji(avgMood.value));
  const summaryEnergyEmoji = computed(() => getEnergySummaryEmoji(avgEnergy.value));

  const moodInstability = computed(() => buildMoodInstability(selectedPeriodRecordsByDate.value));

  const stabilityValue = computed(() => {
    if (!Number.isFinite(moodInstability.value.rmssd)) {
      return noDataLabel;
    }

    return moodInstability.value.rmssd.toFixed(1);
  });

  const stabilityLabel = computed(() => {
    if (!Number.isFinite(moodInstability.value.rmssd)) {
      return noDataLabel;
    }

    if (moodInstability.value.rmssd < 0.8) return t('statistics.stabilityGentle');
    if (moodInstability.value.rmssd < 1.4) return t('statistics.stabilityModerate');
    return t('statistics.stabilitySharp');
  });

  const stabilityEmoji = computed(() => {
    if (!Number.isFinite(moodInstability.value.rmssd)) return '\u{1F4CA}';
    if (moodInstability.value.rmssd < 0.8) return '\u{1F7E2}';
    if (moodInstability.value.rmssd < 1.4) return '\u{1F7E1}';
    return '\u{1F534}';
  });

  const weeklyAverages = computed(() => {
    const moodSums = [0, 0, 0, 0, 0, 0, 0];
    const energySums = [0, 0, 0, 0, 0, 0, 0];
    const counts = [0, 0, 0, 0, 0, 0, 0];

    for (const record of monthRecords.value) {
      let dayOfWeek = getLogicalDate(record.timestamp).getDay();
      dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      moodSums[dayOfWeek] += record.mood;
      energySums[dayOfWeek] += record.energy || 3;
      counts[dayOfWeek] += 1;
    }

    return {
      mood: moodSums.map((sum, index) =>
        counts[index] ? +(sum / counts[index]).toFixed(2) : 0
      ),
      energy: energySums.map((sum, index) =>
        counts[index] ? +(sum / counts[index]).toFixed(2) : 0
      ),
    };
  });

  const bestDayOfWeek = computed(() => {
    let maxValue = 0;
    let maxIndex = null;

    weeklyAverages.value.mood.forEach((value, index) => {
      if (value > maxValue) {
        maxValue = value;
        maxIndex = index;
      }
    });

    return maxIndex;
  });

  const bestDayLabel = computed(() =>
    bestDayOfWeek.value === null ? '' : dayKeys.value[bestDayOfWeek.value]
  );

  const radarData = computed(() => ({
    labels: dayKeys.value,
    datasets: [
      {
        label: t('statistics.avgMood'),
        data: weeklyAverages.value.mood,
        borderColor: '#F15A22',
        backgroundColor: 'rgba(241, 90, 34, 0.15)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#F15A22',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
      },
      {
        label: t('statistics.avgEnergy'),
        data: weeklyAverages.value.energy,
        borderColor: '#4facfe',
        backgroundColor: 'rgba(79, 172, 254, 0.15)',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#4facfe',
        pointBorderColor: '#fff',
        pointBorderWidth: 1,
      },
    ],
  }));

  const radarOptions = computed(() => ({
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        min: 0,
        max: 5,
        ticks: {
          stepSize: 1,
          display: false,
        },
        grid: { color: 'rgba(150,150,150,0.15)' },
        angleLines: { color: 'rgba(150,150,150,0.15)' },
        pointLabels: {
          font: { family: 'Inter', size: 11, weight: '500' },
          color: 'rgba(150,150,150,0.8)',
        },
      },
    },
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          font: { family: 'Inter', size: 11 },
          color: 'rgba(150,150,150,0.8)',
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 14, 39, 0.85)',
        cornerRadius: 10,
        bodyFont: { family: 'Inter', size: 13 },
      },
    },
  }));

  const activityImpactAnalysis = computed(() => {
    const selectedPeriodDays = Object.keys(selectedPeriodRecordsByDate.value).length;
    const yearDays = Object.keys(yearRecordsByDate.value).length;

    if (periodMode.value === 'month' && selectedPeriodDays >= 20) {
      return {
        recordsByDate: selectedPeriodRecordsByDate.value,
        scope: 'month',
      };
    }

    if (yearDays >= 35) {
      return {
        recordsByDate: yearRecordsByDate.value,
        scope: 'year',
      };
    }

    return {
      recordsByDate: recordsByDate.value,
      scope: 'all',
    };
  });

  const activityImpactScopeLabel = computed(() => {
    if (activityImpactAnalysis.value.scope === 'month') {
      return t('statistics.activityImpactScopeMonth');
    }

    if (activityImpactAnalysis.value.scope === 'year') {
      return t('statistics.activityImpactScopeYear', { year: activeYear.value });
    }

    return t('statistics.activityImpactScopeAllTime');
  });

  const activityImpactItems = computed(() =>
    buildActivityImpact({
      allRecordsByDate: recordsByDate.value,
      analysisRecordsByDate: activityImpactAnalysis.value.recordsByDate,
    })
  );

  const hasActivityImpactOverflow = computed(() => activityImpactItems.value.length > 6);

  const visibleActivityImpactItems = computed(() =>
    showAllActivityImpact.value
      ? activityImpactItems.value
      : activityImpactItems.value.slice(0, 6)
  );

  const mostFrequentMood = computed(() => {
    const counts = [0, 0, 0, 0, 0];
    const tagsForMood = [{}, {}, {}, {}, {}];

    for (const record of monthRecords.value) {
      if (record.mood < 1 || record.mood > 5) {
        continue;
      }

      const moodIndex = record.mood - 1;
      counts[moodIndex] += 1;

      if (!Array.isArray(record.tags)) {
        continue;
      }

      for (const tag of record.tags) {
        const groupKey = getActivityGroupKey(tag);

        if (!groupKey || groupKey === 'news update') {
          continue;
        }

        if (!tagsForMood[moodIndex][groupKey]) {
          tagsForMood[moodIndex][groupKey] = {
            count: 0,
            sampleTag: resolveActivityId(tag) || String(tag ?? '').trim(),
          };
        }

        tagsForMood[moodIndex][groupKey].count += 1;
      }
    }

    let maxCount = 0;
    let maxIndex = 2;

    counts.forEach((count, index) => {
      if (count > maxCount) {
        maxCount = count;
        maxIndex = index;
      }
    });

    const sortedTags = Object.values(tagsForMood[maxIndex])
      .sort((left, right) => right.count - left.count)
      .map((item) => item.sampleTag);

    return {
      emoji: moodEmojis[maxIndex],
      name: moodNames.value[maxIndex],
      count: maxCount,
      tags: sortedTags.slice(0, 5),
    };
  });

  const achievements = computed(() => {
    const total = records.value.length;

    return [
      {
        icon: '\u{1F525}',
        name: t('statistics.achOnARoll'),
        unlocked: currentStreak.value >= 3,
        bg: 'linear-gradient(135deg, #ff6b35, #f7931e)',
      },
      {
        icon: '\u{1F4DD}',
        name: t('statistics.achConsistent'),
        unlocked: total >= 7,
        bg: 'linear-gradient(135deg, #4facfe, #00f2fe)',
      },
      {
        icon: '\u{1F3C5}',
        name: t('statistics.achWeekWarrior'),
        unlocked: longestStreak.value >= 7,
        bg: 'linear-gradient(135deg, #f7971e, #ffd200)',
      },
      {
        icon: '\u{1F31F}',
        name: t('statistics.achMonthMaster'),
        unlocked: longestStreak.value >= 30,
        bg: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
      },
      {
        icon: '\u{1F4AA}',
        name: t('statistics.achFirstStep'),
        unlocked: total >= 1,
        bg: 'linear-gradient(135deg, #667eea, #764ba2)',
      },
      {
        icon: '\u{1F3AF}',
        name: t('statistics.achTenEntries'),
        unlocked: total >= 10,
        bg: 'linear-gradient(135deg, #f093fb, #f5576c)',
      },
      {
        icon: '\u{1F4CA}',
        name: t('statistics.achDataLover'),
        unlocked: total >= 25,
        bg: 'linear-gradient(135deg, #4facfe, #00f2fe)',
      },
      {
        icon: '\u{1F3C6}',
        name: t('statistics.achHalfYear'),
        unlocked: longestStreak.value >= 180,
        bg: 'linear-gradient(135deg, #f7971e, #ffd200)',
      },
      {
        icon: '\u26A1',
        name: t('statistics.achTwoWeeks'),
        unlocked: longestStreak.value >= 14,
        bg: 'linear-gradient(135deg, #ff6b35, #f7931e)',
      },
      {
        icon: '\u{1F308}',
        name: t('statistics.achAllMoods'),
        unlocked: new Set(records.value.map((record) => record.mood)).size >= 5,
        bg: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
      },
      {
        icon: '\u{1F48E}',
        name: t('statistics.achFiftyEntries'),
        unlocked: total >= 50,
        bg: 'linear-gradient(135deg, #667eea, #764ba2)',
      },
      {
        icon: '\u{1F5D3}\uFE0F',
        name: t('statistics.achFullMonth'),
        unlocked: (() => {
          const now = new Date();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          return currentCalendarMonthRecords.value.length >= daysInMonth;
        })(),
        bg: 'linear-gradient(135deg, #f093fb, #f5576c)',
      },
    ];
  });

  const unlockedAchievements = computed(
    () => achievements.value.filter((achievement) => achievement.unlocked).length
  );

  const totalAchievements = computed(() => achievements.value.length);

  const visibleAchievements = computed(() =>
    showAllAchievements.value ? achievements.value : achievements.value.slice(0, 6)
  );

  const effectNumberFormatter = computed(
    () =>
      new Intl.NumberFormat(locale.value, {
        maximumFractionDigits: 1,
        minimumFractionDigits: 1,
      })
  );

  const formatEffectDelta = (value) => {
    if (!Number.isFinite(value)) {
      return noDataLabel;
    }

    const absoluteValue = effectNumberFormatter.value.format(Math.abs(value));

    if (value > 0) {
      return `+${absoluteValue}`;
    }

    if (value < 0) {
      return `−${absoluteValue}`;
    }

    return absoluteValue;
  };

  const effectToneClass = (value) => {
    if (!Number.isFinite(value)) {
      return 'effect-value--muted';
    }

    if (value > 0) {
      return 'effect-value--positive';
    }

    if (value < 0) {
      return 'effect-value--negative';
    }

    return 'effect-value--neutral';
  };

  const interventionConfidenceLabel = (confidence) =>
    t(
      `statistics.confidence${
        confidence.charAt(0).toUpperCase()
      }${confidence.slice(1)}`
    );

  const getSleepImpactMetricPhrase = (metricKey, delta) => {
    if (metricKey === 'mood') {
      return delta >= 0
        ? t('statistics.sleepImpactMoodHigher')
        : t('statistics.sleepImpactMoodLower');
    }

    return delta >= 0
      ? t('statistics.sleepImpactEnergyHigher')
      : t('statistics.sleepImpactEnergyLower');
  };

  const buildSleepImpactInsightText = (insight, metricKey, fallbackKey) => {
    if (!insight || !Number.isFinite(insight.delta)) {
      return t(fallbackKey);
    }

    return t('statistics.sleepImpactAssociationPattern', {
      label: t(insight.labelKey),
      metric: getSleepImpactMetricPhrase(metricKey, insight.delta),
    });
  };

  const sleepImpactRows = computed(() =>
    [
      {
        key: 'mood',
        metricKey: 'mood',
        row: sleepImpact.value.moodImpact,
        title: t('statistics.sleepImpactMoodCardTitle'),
      },
      {
        key: 'energy',
        metricKey: 'energy',
        row: sleepImpact.value.energyImpact,
        title: t('statistics.sleepImpactEnergyCardTitle'),
      },
    ].map(({ key, metricKey, row, title }) => {
      const waitingForData = !row.hasEnoughHistory;

      return {
        confidence: row.confidence,
        delta: row.deltaFromBaseline,
        isInconclusive: row.isInconclusive,
        key,
        primaryLabel: t('statistics.sleepImpactQualityTitle'),
        primaryText: waitingForData
          ? t('statistics.sleepImpactNeedMoreDays')
          : buildSleepImpactInsightText(
              row.qualityInsight,
              metricKey,
              'statistics.sleepImpactNoClearPattern'
            ),
        sampleSize: row.sampleSize,
        secondaryLabel: t('statistics.sleepImpactHoursTitle'),
        secondaryText: waitingForData
          ? t('statistics.sleepImpactNeedMoreDays')
          : buildSleepImpactInsightText(
              row.durationInsight,
              metricKey,
              'statistics.sleepImpactDurationWeak'
            ),
        title,
      };
    })
  );

  const ensureSectionObserver = async () => {
    await nextTick();

    if (typeof window === 'undefined') {
      visibleSections.value = createVisibleSectionsState(true);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      visibleSections.value = createVisibleSectionsState(true);
      return;
    }

    if (!sectionObserver) {
      sectionObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) {
              continue;
            }

            const sectionKey = entry.target.dataset.statisticsSection;

            if (!sectionKey) {
              continue;
            }

            revealSection(sectionKey);
          }
        },
        {
          rootMargin: '240px 0px',
          threshold: 0.08,
        }
      );
    }

    stagedSectionKeys.forEach((sectionKey) => {
      if (visibleSections.value[sectionKey]) {
        return;
      }

      const element = sectionElements.get(sectionKey);

      if (!element || observedSectionKeys.has(sectionKey)) {
        return;
      }

      observedSectionKeys.add(sectionKey);
      sectionObserver.observe(element);
    });
  };

  onMounted(async () => {
    try {
      const pendingLoads = [];

      if (recordsStore.hasLoaded) {
        void recordsStore.revalidateIfStale(60_000);
      } else {
        pendingLoads.push(recordsStore.ensureLoaded());
      }

      if (sleepStore.hasLoaded) {
        void sleepStore.revalidateIfStale(60_000);
      } else {
        pendingLoads.push(sleepStore.ensureLoaded());
      }

      if (pendingLoads.length) {
        await Promise.all(pendingLoads);
      }
    } catch (error) {
      console.error('Error loading statistics data:', error);
    } finally {
      isLoading.value = false;
      await ensureRevealObserver();
      await ensureSectionObserver();
    }
  });

  onActivated(() => {
    if (!isLoading.value) {
      void ensureRevealObserver();
      void ensureSectionObserver();
      void recordsStore.revalidateIfStale(60_000);
      void sleepStore.revalidateIfStale(60_000);
    }
  });

  onBeforeUnmount(() => {
    sectionObserver?.disconnect();
    sectionObserver = null;
    observedSectionKeys.clear();
    sectionElements.clear();
  });

  watch([periodMode, monthRecords], async () => {
    if (isLoading.value) {
      return;
    }

    showAllActivityImpact.value = false;
    await ensureRevealObserver();
    await ensureSectionObserver();
  });

  return {
    activeChartInfo,
    achievements,
    activityImpactItems,
    activityLabel,
    avgEnergy,
    avgMood,
    bestDayLabel,
    bestDayOfWeek,
    canMoveNextPeriod,
    canMovePrevPeriod,
    canUseYearView,
    closeChartInfo,
    currentMonthYear,
    currentStreak,
    energyTrendData,
    energyTrendOptions,
    activityImpactScopeLabel,
    effectToneClass,
    formatEffectDelta,
    hasActivityImpactOverflow,
    hasSleepTrendData,
    interventionConfidenceLabel,
    isLoading,
    longestStreak,
    moodCounterData,
    moodCounterOptions,
    moodDistribution,
    moodTrendData,
    moodTrendOptions,
    monthRecords,
    mostFrequentMood,
    openChartInfo,
    periodMode,
    radarData,
    radarOptions,
    isSectionVisible,
    registerRevealCard,
    registerSectionCard,
    records,
    shiftPeriod,
    showAllAchievements,
    showAllActivityImpact,
    showPeriodControls,
    sleepHoursTrendData,
    sleepHoursTrendOptions,
    sleepImpact,
    sleepImpactRows,
    sleepImpactSubtitle,
    sleepQualityTrendData,
    sleepQualityTrendOptions,
    stabilityEmoji,
    stabilityLabel,
    stabilityValue,
    streakDays,
    summaryEnergyEmoji,
    summaryMoodEmoji,
    totalAchievements,
    unlockedAchievements,
    visibleAchievements,
    visibleActivityImpactItems,
    yearInPixelsData,
    yearInPixelsLegend,
    yearInPixelsMonthMarkers,
    yearInPixelsMeta,
    yearInPixelsWeekdayLabels,
    yearPixelTitle,
  };
};
