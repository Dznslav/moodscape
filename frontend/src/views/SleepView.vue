<template>
  <div class="page">
    <div class="bg-glow" aria-hidden="true"></div>

    <div class="content">
      <header class="page-header">
        <div>
          <p class="page-caption">{{ greeting }}</p>
          <h1 class="page-title">{{ displayName }}</h1>
        </div>
        <div class="header-date">
          <span class="date-day">{{ today.day }}</span>
          <span class="date-month">{{ today.month }}</span>
        </div>
      </header>

      <div v-if="isLoadingPage" class="skeleton-list">
        <div v-for="i in 3" :key="i" class="skeleton-card">
          <div class="skel skel--sm"></div>
          <div class="skel skel--lg"></div>
        </div>
      </div>

      <template v-else>
        <section ref="sleepFormCardRef" class="card sleep-card form-scroll-anchor">
          <div class="sleep-card__header">
            <div>
              <h2 class="card-title sleep-card__title">{{ $t('sleep.title') }}</h2>
              <p class="sleep-card__subtitle">
                {{ showSleepSummary ? $t('sleep.summarySubtitle') : $t('sleep.promptSubtitle') }}
              </p>
              <p
                v-if="!isEditingHistoricalSleep && isLogicalCarryover"
                class="sleep-card__subtitle sleep-card__subtitle--muted"
              >
                {{ $t('dashboard.logicalDayHint', { date: trackingDateLabel }) }}
              </p>
              <p v-if="isEditingHistoricalSleep" class="sleep-card__subtitle sleep-card__subtitle--muted">
                {{ editingSleepDateLabel }}
              </p>
            </div>

            <button
              v-if="showSleepSummary"
              type="button"
              class="btn btn--secondary btn--sm btn--inline"
              @click="openSleepEditor"
            >
              {{ $t('dashboard.btnEdit') }}
            </button>
          </div>

          <form v-if="showSleepForm" @submit.prevent="submitSleepLog" class="sleep-form">
            <div class="field">
              <div class="sleep-slider-row">
                <label class="field-label">{{ $t('sleep.hoursLabel') }}</label>
                <span class="sleep-hours-badge">{{ sleepHoursDisplay }} {{ $t('sleep.hoursUnit') }}</span>
              </div>

              <div class="sleep-range-shell" :style="{ '--sleep-progress': sleepRangeProgress }">
                <input
                  :value="sleepHours"
                  type="range"
                  min="0"
                  max="16"
                  step="0.5"
                  class="sleep-range"
                  :style="{ '--sleep-progress': sleepRangeProgress }"
                  @input="updateSleepHours($event.target.value)"
                />
                <div class="sleep-range-stops" aria-hidden="true">
                  <span v-for="stop in 5" :key="stop" class="sleep-range-stop"></span>
                </div>
              </div>

              <div class="sleep-range-labels">
                <span>{{ $t('sleep.rangeMin') }}</span>
                <span>{{ $t('sleep.rangeMax') }}</span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">{{ $t('sleep.qualityLabel') }}</label>
              <div class="sleep-quality-row">
                <button
                  v-for="option in sleepQualityOptions"
                  :key="option.value"
                  type="button"
                  class="tag-btn"
                  :class="{ 'tag-btn--active': sleepQuality === option.value }"
                  @click="selectSleepQuality(option.value)"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>

            <div class="form-actions">
              <button
                v-if="isEditingSleep"
                type="button"
                class="btn btn--secondary btn--grow"
                @click="cancelSleepEdit"
              >
                {{ $t('dashboard.btnCancel') }}
              </button>
              <button type="submit" class="btn btn--primary btn--grow" :disabled="isSleepSubmitting">
                <span v-if="isSleepSubmitting" class="spinner"></span>
                <span v-else>{{ isEditingSleep ? $t('dashboard.btnSaveEdit') : $t('dashboard.btnSave') }}</span>
              </button>
            </div>
          </form>

          <template v-else>
            <div class="sleep-summary-grid">
              <div class="sleep-summary-pill">
                <span class="sleep-summary-pill__label">{{ $t('sleep.hoursLabel') }}</span>
                <strong class="sleep-summary-pill__value">
                  {{ todaySleepHoursDisplay }} {{ $t('sleep.hoursUnit') }}
                </strong>
              </div>
              <div class="sleep-summary-pill">
                <span class="sleep-summary-pill__label">{{ $t('sleep.qualityLabel') }}</span>
                <strong class="sleep-summary-pill__value">
                  {{ todaySleepQuality.emoji }} {{ todaySleepQuality.label }}
                </strong>
              </div>
            </div>
            <p class="sleep-card__subtitle sleep-card__subtitle--muted">{{ $t('sleep.summaryNote') }}</p>
          </template>
        </section>

        <section v-if="hasSleepLogsForMonth || hasSleepLogs" class="history-section">
          <div class="history-header">
            <h2 class="section-title">{{ $t('sleep.historyTitle') }}</h2>
            <div class="period-nav">
              <button class="period-nav-btn" @click="prevMonth" :aria-label="$t('history.navPrev')">‹</button>
              <span class="period-nav-label">{{ monthYearLabel }}</span>
              <button
                class="period-nav-btn"
                :disabled="!canMoveNextMonth"
                @click="nextMonth"
                :aria-label="$t('history.navNext')"
              >
                ›
              </button>
            </div>
          </div>

          <div v-if="filteredSleepLogs.length" class="history-list">
            <article
              v-for="log in filteredSleepLogs"
              :key="log.id"
              class="history-card"
            >
              <button
                class="dots-btn"
                @click.stop="toggleMenu(log.id)"
              >
                ⋯
              </button>

              <div v-if="openMenuId === log.id" class="mini-menu" @click.stop>
                <button class="mini-menu-item" @click="startSleepEdit(log)">
                  {{ $t('dashboard.btnEdit') }}
                </button>
              </div>

              <div class="history-top">
                <span class="history-date">{{ formatSleepDate(log.sleep_date) }}</span>
              </div>

              <div class="history-emojis-large">
                <div class="emoji-block">
                  <span class="emoji-big">🌙</span>
                  <div class="emoji-info">
                    <span class="emoji-label">{{ $t('sleep.hoursLabel') }}</span>
                    <span class="emoji-value">
                      {{ `${formatSleepHours(log.hours_slept)} ${$t('sleep.hoursUnit')}` }}
                    </span>
                  </div>
                </div>
                <div class="emoji-divider"></div>
                <div class="emoji-block">
                  <span class="emoji-big">{{ sleepQualityEmoji(log.sleep_quality) }}</span>
                  <div class="emoji-info">
                    <span class="emoji-label">{{ $t('sleep.qualityLabel') }}</span>
                    <span class="emoji-value">{{ sleepQualityLabel(log.sleep_quality) }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>

          <div v-else class="empty-month">
            <p>{{ $t('sleep.emptyMonth') }}</p>
          </div>
        </section>

        <div v-else class="empty">
          <div class="empty-icon">🌙</div>
          <p class="empty-title">{{ $t('sleep.emptyTitle') }}</p>
        </div>
      </template>

      <div v-if="openMenuId !== null" class="menu-overlay" @click="toggleMenu(openMenuId)"></div>

      <FooterSection />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import FooterSection from '../components/FooterSection.vue';
import { useSleepView } from '../composables/useSleepView';

const sleepFormCardRef = ref(null);

const {
  canMoveNextMonth,
  cancelSleepEdit,
  displayName,
  editingSleepDateLabel,
  filteredSleepLogs,
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
  todaySleepQuality,
  toggleMenu,
  updateSleepHours,
} = useSleepView({ formCardRef: sleepFormCardRef });
</script>

<style scoped src="../assets/styles/views/records-view.css"></style>
