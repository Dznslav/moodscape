<template>
  <div class="page">
    <div class="bg-glow" aria-hidden="true"></div>

    <div class="content">
      <header class="page-header">
        <div>
          <p class="page-caption">{{ $t('statistics.title') }}</p>
          <h1 class="page-title">{{ currentMonthYear }}</h1>
        </div>
      </header>

      <div v-if="showPeriodControls" class="period-toolbar">
        <div class="period-switch">
          <button
            type="button"
            class="period-chip"
            :class="{ 'period-chip--active': periodMode === 'month' }"
            @click="periodMode = 'month'"
          >
            {{ $t('statistics.byMonth') }}
          </button>
          <button
            v-if="canUseYearView"
            type="button"
            class="period-chip"
            :class="{ 'period-chip--active': periodMode === 'year' }"
            @click="periodMode = 'year'"
          >
            {{ $t('statistics.byYear') }}
          </button>
        </div>

        <div class="period-nav">
          <button type="button" class="period-nav-btn" :disabled="!canMovePrevPeriod" @click="shiftPeriod(-1)">
            &#8249;
          </button>
          <span class="period-nav-label">{{ currentMonthYear }}</span>
          <button type="button" class="period-nav-btn" :disabled="!canMoveNextPeriod" @click="shiftPeriod(1)">
            &#8250;
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="skeleton-list">
        <div v-for="i in 4" :key="i" class="skeleton-card">
          <div class="skel skel--sm"></div>
          <div class="skel skel--lg"></div>
          <div class="skel skel--md"></div>
        </div>
      </div>

      <div v-else-if="records.length === 0" class="empty">
        <div class="empty-icon">&#128202;</div>
        <p class="empty-title">{{ $t('statistics.empty') }}</p>
        <p class="empty-sub">{{ $t('statistics.emptySub') }}</p>
      </div>

      <template v-else>
        <section :ref="registerRevealCard" class="card streak-card reveal-card">
          <div class="streak-header">
            <h2 class="card-title">{{ $t('statistics.daysInARow') }}</h2>
          </div>

          <div class="streak-timeline">
            <div
              v-for="(day, i) in streakDays"
              :key="i"
              class="streak-day"
              :class="{ 'streak-day--today': day.isToday }"
            >
              <span class="streak-day-label">{{ day.isToday ? $t('statistics.today') : day.label }}</span>
              <div
                class="streak-check"
                :class="{
                  'streak-check--done': day.hasRecord,
                  'streak-check--today': day.isToday && day.hasRecord,
                  'streak-check--missed': !day.hasRecord && !day.isFuture,
                }"
              >
                <svg
                  v-if="day.hasRecord"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="check-icon"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span v-else-if="day.isFuture" class="check-future">&middot;</span>
                <svg
                  v-else
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  class="check-icon check-icon--miss"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
            </div>
          </div>

          <div class="streak-counter-row">
            <div class="streak-counter">
              <span class="streak-number">{{ currentStreak }}</span>
              <span class="streak-label">{{ $t('statistics.daysInARow') }}</span>
            </div>
            <div class="streak-best">
              <span class="trophy-icon">&#127942;</span>
              <div class="best-info">
                <span class="best-value">{{ longestStreak }}</span>
                <span class="best-label">{{ $t('statistics.longestStreak') }}</span>
              </div>
            </div>
          </div>
        </section>

        <div class="summary-grid">
          <div :ref="registerRevealCard" class="summary-card reveal-card">
            <span class="summary-emoji">{{ summaryMoodEmoji }}</span>
            <span class="summary-value">{{ avgMood }}</span>
            <span class="summary-label">{{ $t('statistics.avgMood') }}</span>
          </div>
          <div :ref="registerRevealCard" class="summary-card reveal-card">
            <span class="summary-emoji">{{ summaryEnergyEmoji }}</span>
            <span class="summary-value">{{ avgEnergy }}</span>
            <span class="summary-label">{{ $t('statistics.avgEnergy') }}</span>
          </div>
          <div :ref="registerRevealCard" class="summary-card reveal-card">
            <span class="summary-emoji">&#128221;</span>
            <span class="summary-value">{{ monthRecords.length }}</span>
            <span class="summary-label">{{ $t('statistics.totalRecords') }}</span>
          </div>
          <div :ref="registerRevealCard" class="summary-card summary-card--stability reveal-card">
            <button
              type="button"
              class="info-btn info-btn--summary summary-card__info"
              :aria-label="$t('statistics.openInfo')"
              @click="openChartInfo('moodStability')"
            >
              <span>i</span>
            </button>
            <span class="summary-emoji">{{ stabilityEmoji }}</span>
            <span class="summary-value">{{ stabilityValue }}</span>
            <span class="summary-label">{{ $t('statistics.moodStability') }}</span>
            <span class="summary-note">{{ stabilityLabel }}</span>
          </div>
        </div>

        <section :ref="registerSectionCard('yearInPixels')" class="card reveal-card">
          <div class="card-header card-header--compact">
            <div>
              <h2 class="card-title">{{ $t('statistics.yearInPixels') }}</h2>
              <p v-if="isSectionVisible('yearInPixels')" class="card-subtitle">{{ yearInPixelsMeta }}</p>
            </div>
          </div>

          <template v-if="isSectionVisible('yearInPixels')">
            <div class="year-pixels-viewport">
              <div class="year-pixels-shell">
                <div class="year-pixels-weekdays">
                  <span v-for="dayLabel in yearInPixelsWeekdayLabels" :key="dayLabel">{{ dayLabel }}</span>
                </div>
                <div class="year-pixels-main">
                  <div class="year-pixels-months" :style="{ '--year-pixels-columns': yearInPixelsData.columns }">
                    <span
                      v-for="marker in yearInPixelsMonthMarkers"
                      :key="`${marker.monthIndex}-${marker.column}`"
                      class="year-pixels-month"
                      :style="{ gridColumn: `${marker.column} / span 4` }"
                    >
                      {{ marker.label }}
                    </span>
                  </div>
                  <div class="year-pixels-grid" :style="{ '--year-pixels-columns': yearInPixelsData.columns }">
                    <div v-for="week in yearInPixelsData.weeks" :key="week[0].key" class="year-pixels-week">
                      <div
                        v-for="day in week"
                        :key="day.key"
                        class="year-pixels-cell"
                        :class="{
                          'year-pixels-cell--empty': !day.hasRecord,
                          'year-pixels-cell--outside': !day.inYear,
                          'year-pixels-cell--today': day.isToday,
                        }"
                        :style="day.hasRecord ? { '--year-pixels-cell': day.color } : {}"
                        :title="yearPixelTitle(day)"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="year-pixels-legend">
              <span v-for="item in yearInPixelsLegend" :key="item.name" class="year-pixels-legend-item">
                <span class="year-pixels-legend-dot" :style="{ background: item.color }"></span>
                <span class="year-pixels-legend-label">{{ item.name }}</span>
              </span>
            </div>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--year" aria-hidden="true">
            <span class="stat-placeholder__line stat-placeholder__line--lg"></span>
            <span class="stat-placeholder__grid"></span>
            <div class="stat-placeholder__chips">
              <span v-for="index in 5" :key="`year-chip-${index}`" class="stat-placeholder__chip"></span>
            </div>
          </div>
        </section>

        <section :ref="registerSectionCard('moodCounter')" class="card mood-counter-section reveal-card">
          <div class="card-header">
            <h2 class="card-title">{{ $t('statistics.moodCounter') }}</h2>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('moodCounter')">
              <span>i</span>
            </button>
          </div>

          <template v-if="isSectionVisible('moodCounter')">
            <div class="gauge-wrapper">
              <div class="gauge-chart">
                <Doughnut :data="moodCounterData" :options="moodCounterOptions" />
                <div class="gauge-center">
                  <span class="gauge-number">{{ monthRecords.length }}</span>
                  <span class="gauge-label">{{ $t('statistics.totalEntries') }}</span>
                </div>
              </div>
            </div>
            <div class="mood-counts">
              <div v-for="(moodItem, index) in moodDistribution" :key="index" class="mood-count-item">
                <span class="mood-count-emoji">{{ moodItem.emoji }}</span>
                <span class="mood-count-name">{{ moodItem.name }}</span>
                <span class="mood-count-value" :style="{ color: moodItem.color }">{{ moodItem.count }}</span>
              </div>
            </div>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--gauge" aria-hidden="true">
            <span class="stat-placeholder__gauge"></span>
            <div class="stat-placeholder__chips">
              <span
                v-for="index in 5"
                :key="`gauge-chip-${index}`"
                class="stat-placeholder__chip stat-placeholder__chip--compact"
              ></span>
            </div>
          </div>
        </section>

        <section :ref="registerSectionCard('moodTrend')" class="card reveal-card">
          <div class="card-header">
            <h2 class="card-title">{{ $t('statistics.moodTrend') }}</h2>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('moodTrend')">
              <span>i</span>
            </button>
          </div>
          <div v-if="isSectionVisible('moodTrend')" class="chart-container chart-container--line">
            <Line :data="moodTrendData" :options="moodTrendOptions" />
          </div>
          <div v-else class="stat-placeholder stat-placeholder--chart" aria-hidden="true">
            <span class="stat-placeholder__chart"></span>
          </div>
        </section>

        <section :ref="registerSectionCard('energyTrend')" class="card reveal-card">
          <div class="card-header">
            <h2 class="card-title">{{ $t('statistics.energyTrend') }}</h2>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('energyTrend')">
              <span>i</span>
            </button>
          </div>
          <div v-if="isSectionVisible('energyTrend')" class="chart-container chart-container--line">
            <Line :data="energyTrendData" :options="energyTrendOptions" />
          </div>
          <div v-else class="stat-placeholder stat-placeholder--chart" aria-hidden="true">
            <span class="stat-placeholder__chart"></span>
          </div>
        </section>

        <section :ref="registerSectionCard('radar')" class="card reveal-card">
          <div class="card-header">
            <h2 class="card-title">{{ $t('statistics.moodEnergyRadar') }}</h2>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('radar')">
              <span>i</span>
            </button>
          </div>

          <template v-if="isSectionVisible('radar')">
            <div class="chart-container chart-container--radar">
              <Radar :data="radarData" :options="radarOptions" />
            </div>
            <div v-if="bestDayOfWeek !== null" class="best-day-badge">
              <span class="best-day-star">&#11088;</span>
              <span>{{ $t('statistics.bestDay') }}: <strong>{{ bestDayLabel }}</strong></span>
            </div>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--radar" aria-hidden="true">
            <span class="stat-placeholder__radar"></span>
            <span class="stat-placeholder__line stat-placeholder__line--md"></span>
          </div>
        </section>

        <section :ref="registerSectionCard('sleepHoursTrend')" class="card reveal-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">{{ $t('statistics.sleepHoursTrend') }}</h2>
              <p v-if="isSectionVisible('sleepHoursTrend')" class="card-subtitle">{{ currentMonthYear }}</p>
            </div>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('sleepHoursTrend')">
              <span>i</span>
            </button>
          </div>
          <template v-if="isSectionVisible('sleepHoursTrend')">
            <div v-if="hasSleepTrendData" class="chart-container chart-container--line">
              <Line :data="sleepHoursTrendData" :options="sleepHoursTrendOptions" />
            </div>
            <div v-else class="sleep-impact-fallback">
              <p class="sleep-impact-fallback__text">{{ $t('statistics.sleepTrendEmpty') }}</p>
            </div>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--chart" aria-hidden="true">
            <span class="stat-placeholder__chart"></span>
          </div>
        </section>

        <section :ref="registerSectionCard('sleepQualityTrend')" class="card reveal-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">{{ $t('statistics.sleepQualityTrend') }}</h2>
              <p v-if="isSectionVisible('sleepQualityTrend')" class="card-subtitle">{{ currentMonthYear }}</p>
            </div>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('sleepQualityTrend')">
              <span>i</span>
            </button>
          </div>
          <template v-if="isSectionVisible('sleepQualityTrend')">
            <div v-if="hasSleepTrendData" class="chart-container chart-container--line">
              <Line :data="sleepQualityTrendData" :options="sleepQualityTrendOptions" />
            </div>
            <div v-else class="sleep-impact-fallback">
              <p class="sleep-impact-fallback__text">{{ $t('statistics.sleepTrendEmpty') }}</p>
            </div>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--chart" aria-hidden="true">
            <span class="stat-placeholder__chart"></span>
          </div>
        </section>

        <section :ref="registerSectionCard('sleepImpact')" class="card reveal-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">{{ $t('statistics.sleepImpact') }}</h2>
              <p v-if="isSectionVisible('sleepImpact')" class="card-subtitle">{{ sleepImpactSubtitle }}</p>
            </div>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('sleepImpact')">
              <span>i</span>
            </button>
          </div>

          <template v-if="isSectionVisible('sleepImpact')">
            <div v-if="sleepImpact.hasPairedEntries" class="sleep-impact-rows">
              <article
                v-for="row in sleepImpactRows"
                :key="row.key"
                class="sleep-impact-row"
                :class="{ 'sleep-impact-row--muted': row.isInconclusive }"
              >
                <div class="sleep-impact-row__header">
                  <h3 class="intervention-title">{{ row.title }}</h3>
                  <span class="confidence-pill" :class="`confidence-pill--${row.confidence}`">
                    {{ interventionConfidenceLabel(row.confidence) }}
                  </span>
                </div>

                <div class="sleep-impact-row__facts">
                  <div class="sleep-impact-row__fact">
                    <span class="sleep-impact-row__fact-label">{{ row.primaryLabel }}</span>
                    <p class="sleep-impact-row__fact-text">{{ row.primaryText }}</p>
                  </div>
                  <div class="sleep-impact-row__fact">
                    <span class="sleep-impact-row__fact-label">{{ row.secondaryLabel }}</span>
                    <p class="sleep-impact-row__fact-text">{{ row.secondaryText }}</p>
                  </div>
                </div>

                <div class="sleep-impact-row__meta">
                  <span class="sleep-impact-row__meta-chip">
                    <span class="sleep-impact-row__meta-label">{{ $t('statistics.sleepImpactDeltaLabel') }}</span>
                    <strong class="sleep-impact-row__meta-value" :class="effectToneClass(row.delta)">
                      {{ formatEffectDelta(row.delta) }}
                    </strong>
                  </span>
                  <span class="sleep-impact-row__meta-chip">
                    <span class="sleep-impact-row__meta-label">{{ $t('statistics.sleepImpactPairedDaysLabel') }}</span>
                    <strong class="sleep-impact-row__meta-value">{{ row.sampleSize }}</strong>
                  </span>
                </div>
              </article>
            </div>

            <div v-else class="sleep-impact-fallback">
              <strong class="sleep-impact-fallback__title">{{ $t('statistics.sleepImpactNotEnoughTitle') }}</strong>
              <p class="sleep-impact-fallback__text">{{ $t('statistics.sleepImpactEmpty') }}</p>
            </div>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--list" aria-hidden="true">
            <div v-for="index in 2" :key="`sleep-card-${index}`" class="stat-placeholder__card">
              <span class="stat-placeholder__line stat-placeholder__line--md"></span>
              <span class="stat-placeholder__line stat-placeholder__line--sm"></span>
              <div class="stat-placeholder__metrics">
                <span class="stat-placeholder__metric"></span>
                <span class="stat-placeholder__metric"></span>
              </div>
            </div>
          </div>
        </section>

        <section :ref="registerSectionCard('activityImpact')" class="card reveal-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">{{ $t('statistics.activityImpact') }}</h2>
              <p v-if="isSectionVisible('activityImpact')" class="card-subtitle">{{ activityImpactScopeLabel }}</p>
            </div>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="openChartInfo('activityImpact')">
              <span>i</span>
            </button>
          </div>

          <template v-if="isSectionVisible('activityImpact')">
            <div v-if="activityImpactItems.length" class="intervention-list">
              <article
                v-for="item in visibleActivityImpactItems"
                :key="item.key"
                class="intervention-card"
              >
                <div class="intervention-card-header">
                  <div class="intervention-title-group">
                    <div>
                      <h3 class="intervention-title">{{ activityLabel(item.sampleTag) }}</h3>
                      <p class="intervention-meta">
                        {{ $t('statistics.activityImpactDays', { count: item.count, comparisonCount: item.comparisonCount }) }}
                      </p>
                    </div>
                  </div>
                  <span class="confidence-pill" :class="`confidence-pill--${item.confidence}`">
                    {{ interventionConfidenceLabel(item.confidence) }}
                  </span>
                </div>
                <div class="intervention-metrics">
                  <div class="effect-chip">
                    <span class="effect-chip-label">{{ $t('statistics.sameDay') }}</span>
                    <strong class="effect-chip-value" :class="effectToneClass(item.sameDayDelta)">
                      {{ formatEffectDelta(item.sameDayDelta) }}
                    </strong>
                  </div>
                  <div class="effect-chip">
                    <span class="effect-chip-label">{{ $t('statistics.nextDay') }}</span>
                    <strong class="effect-chip-value" :class="effectToneClass(item.nextDayDelta)">
                      {{ formatEffectDelta(item.nextDayDelta) }}
                    </strong>
                  </div>
                </div>
              </article>
            </div>
            <p v-else class="intervention-empty">{{ $t('statistics.activityImpactNeedsData') }}</p>
            <button
              v-if="hasActivityImpactOverflow"
              type="button"
              class="show-all-btn show-all-btn--compact"
              @click="showAllActivityImpact = !showAllActivityImpact"
            >
              {{ showAllActivityImpact ? $t('statistics.showLess') : $t('statistics.showMore') }}
            </button>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--list" aria-hidden="true">
            <div v-for="index in 3" :key="`impact-card-${index}`" class="stat-placeholder__card">
              <span class="stat-placeholder__line stat-placeholder__line--md"></span>
              <span class="stat-placeholder__line stat-placeholder__line--sm"></span>
              <div class="stat-placeholder__metrics">
                <span class="stat-placeholder__metric"></span>
                <span class="stat-placeholder__metric"></span>
              </div>
            </div>
          </div>
        </section>

        <section :ref="registerSectionCard('insights')" class="card insight-card insight-card--static reveal-card">
          <template v-if="isSectionVisible('insights')">
            <div class="insight-row">
              <div class="insight-emoji">{{ mostFrequentMood.emoji }}</div>
              <div class="insight-info">
                <span class="insight-title">{{ $t('statistics.mostCommonMood') }}</span>
                <span class="insight-value">{{ mostFrequentMood.name }} - {{ mostFrequentMood.count }}x</span>
                <span class="insight-sub">{{ $t('statistics.relatedActivities') }}</span>
              </div>
            </div>
            <div class="insight-expanded-content insight-expanded-content--always">
              <div v-if="mostFrequentMood.tags.length" class="insight-tags">
                <span v-for="tag in mostFrequentMood.tags" :key="tag" class="insight-tag-pill">
                  {{ activityLabel(tag) }}
                </span>
              </div>
              <p v-else class="insight-empty">{{ $t('statistics.noData') }}</p>
            </div>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--insight" aria-hidden="true">
            <div class="stat-placeholder__insight-row">
              <span class="stat-placeholder__avatar"></span>
              <div class="stat-placeholder__stack">
                <span class="stat-placeholder__line stat-placeholder__line--sm"></span>
                <span class="stat-placeholder__line stat-placeholder__line--lg"></span>
                <span class="stat-placeholder__line stat-placeholder__line--md"></span>
              </div>
            </div>
            <div class="stat-placeholder__chips">
              <span v-for="index in 4" :key="`insight-chip-${index}`" class="stat-placeholder__chip"></span>
            </div>
          </div>
        </section>

        <section :ref="registerSectionCard('achievements')" class="card reveal-card">
          <div class="achievements-header">
            <h2 class="card-title" style="margin-bottom: 0">{{ $t('statistics.achievements') }}</h2>
            <span v-if="isSectionVisible('achievements')" class="achievement-counter">
              {{ unlockedAchievements }} {{ $t('statistics.of') }} {{ totalAchievements }}
            </span>
          </div>

          <template v-if="isSectionVisible('achievements')">
            <div class="achievements-grid">
              <div
                v-for="(ach, i) in visibleAchievements"
                :key="i"
                class="achievement-badge"
                :class="{ 'achievement-badge--locked': !ach.unlocked }"
              >
                <div class="ach-circle" :style="ach.unlocked ? { background: ach.bg } : {}">
                  <span class="ach-icon">{{ ach.icon }}</span>
                </div>
                <span class="ach-name">{{ ach.name }}</span>
              </div>
            </div>
            <button v-if="!showAllAchievements && achievements.length > 6" class="show-all-btn" @click="showAllAchievements = true">
              {{ $t('statistics.showAll') }}
            </button>
          </template>
          <div v-else class="stat-placeholder stat-placeholder--achievements" aria-hidden="true">
            <div class="stat-placeholder__achievement-grid">
              <div v-for="index in 6" :key="`achievement-${index}`" class="stat-placeholder__achievement">
                <span class="stat-placeholder__achievement-circle"></span>
                <span class="stat-placeholder__line stat-placeholder__line--sm"></span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <FooterSection />

      <transition name="fade">
        <div v-if="activeChartInfo" class="info-modal-overlay" @click="closeChartInfo">
          <div class="info-modal" @click.stop>
            <div class="info-modal-header">
              <div>
                <span class="info-modal-kicker">{{ $t('statistics.infoLabel') }}</span>
                <h3 class="info-modal-title">{{ activeChartInfo.title }}</h3>
              </div>
              <button type="button" class="info-modal-close" :aria-label="$t('statistics.closeInfo')" @click="closeChartInfo">
                &times;
              </button>
            </div>
            <p class="info-modal-text">{{ activeChartInfo.description }}</p>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { Doughnut, Line, Radar } from 'vue-chartjs';
import FooterSection from '../components/FooterSection.vue';
import { useStatisticsView } from '../composables/useStatisticsView';

defineOptions({ name: 'StatisticsView' });

const {
  activeChartInfo,
  achievements,
  activityImpactItems,
  activityImpactScopeLabel,
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
  effectToneClass,
  formatEffectDelta,
  hasActivityImpactOverflow,
  hasSleepTrendData,
  interventionConfidenceLabel,
  isLoading,
  isSectionVisible,
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
} = useStatisticsView();
</script>

<style scoped src="../assets/styles/views/statistics-view.css"></style>
