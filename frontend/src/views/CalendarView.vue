<template>
  <div class="page">
    <div class="bg-glow" aria-hidden="true"></div>

    <div class="content">
      <header class="page-header">
        <div>
          <p class="page-caption">{{ $t('history.pageCaption') }}</p>
          <h1 class="page-title">{{ $t('history.pageTitle') }}</h1>
        </div>
      </header>

      <div v-if="isLoading" class="skeleton-list">
        <div v-for="i in 4" :key="i" class="skeleton-card">
          <div class="skel skel--sm"></div>
          <div class="skel skel--lg"></div>
          <div class="skel skel--md"></div>
        </div>
      </div>

      <div v-else-if="records.length === 0 && sleepLogs.length === 0" class="empty">
        <div class="empty-icon">📭</div>
        <p class="empty-title">{{ $t('history.emptyTitle') }}</p>
        <p class="empty-sub">{{ $t('history.emptySub') }}</p>
      </div>

      <template v-else>
        <section class="calendar-card">
          <div class="period-nav" style="margin-bottom: 1rem;">
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

          <div class="cal-weekdays">
            <span v-for="d in weekdays" :key="d" class="cal-wd">{{ d }}</span>
          </div>

          <div class="cal-grid">
            <div
              v-for="(cell, idx) in calendarCells"
              :key="idx"
              class="cal-cell"
              :class="{
                'cal-cell--empty': !cell.day,
                'cal-cell--today': cell.isToday,
                'cal-cell--future': cell.isFuture,
                'cal-cell--has-record': cell.record,
                'cal-cell--selected': cell.day && selectedDate === cell.dateKey,
              }"
              :style="cell.record ? {
                '--mood-color': moodColor(cell.record.mood),
                background: selectedDate === cell.dateKey ? moodBgSelected(cell.record.mood) : moodBg(cell.record.mood),
              } : {}"
              @click="cell.day && selectDate(cell)"
            >
              <span v-if="cell.day" class="cal-day">{{ cell.day }}</span>
              <span v-if="cell.record" class="cal-dot" :style="{ background: moodColor(cell.record.mood) }"></span>
            </div>
          </div>

          <div class="cal-legend">
            <span class="legend-item"><span class="legend-dot" style="background: #ef4444"></span> {{ $t('moods.awful') }}</span>
            <span class="legend-item"><span class="legend-dot" style="background: #f97316"></span> {{ $t('moods.bad') }}</span>
            <span class="legend-item"><span class="legend-dot" style="background: #eab308"></span> {{ $t('moods.meh') }}</span>
            <span class="legend-item"><span class="legend-dot" style="background: #22c55e"></span> {{ $t('moods.good') }}</span>
            <span class="legend-item"><span class="legend-dot" style="background: #10b981"></span> {{ $t('moods.super') }}</span>
          </div>
        </section>

        <transition name="slide-up">
          <div v-if="selectedDate" ref="detailStackRef" class="detail-stack form-anchor-stack">
            <section ref="moodDetailCardRef" class="detail-card detail-card--anchored">
              <div class="detail-header">
                <span class="detail-date">{{ formatDateFull(selectedDate) }}</span>
                <button class="detail-close" @click="closeDetail" aria-label="Закрыть">✕</button>
              </div>

              <transition name="card-swap" mode="out-in">
                <div
                  :key="selectedRecord && !isEditingCalendar ? 'mood-summary' : 'mood-form'"
                  class="detail-card__content"
                >
                  <template v-if="selectedRecord && !isEditingCalendar">
                <div class="detail-scores-large">
                  <div class="emoji-block">
                    <span class="emoji-big">{{ moodEmoji(selectedRecord.mood) }}</span>
                    <div class="emoji-info">
                      <span class="emoji-label">{{ $t('dashboard.mood') }}</span>
                      <span class="emoji-value">{{ selectedRecord.mood }}/5</span>
                    </div>
                  </div>
                  <div class="emoji-divider"></div>
                  <div class="emoji-block">
                    <span class="emoji-big">{{ energyEmoji(selectedRecord.energy) }}</span>
                    <div class="emoji-info">
                      <span class="emoji-label">{{ $t('dashboard.energy') }}</span>
                      <span class="emoji-value">{{ selectedRecord.energy }}/5</span>
                    </div>
                  </div>
                </div>

                <div v-if="selectedRecord.note" class="detail-note">
                  <span class="detail-note-label">📝 {{ $t('dashboard.note') }}</span>
                  <p class="detail-note-text">{{ selectedRecord.note }}</p>
                </div>

                <div v-if="visibleTags(selectedRecord.tags).length" class="detail-tags">
                  <span v-for="tag in visibleTags(selectedRecord.tags)" :key="tag" class="history-tag-pill">
                    {{ activityLabel(tag) }}
                  </span>
                </div>

                    <button class="btn btn--secondary btn--sm btn--block" @click="openMoodCalendarEditor">
                      {{ $t('dashboard.btnEdit') }}
                    </button>
                  </template>

                  <form v-else @submit.prevent="submitCalendarRecord" class="cal-form">
                  <div class="cal-field">
                    <label class="cal-field-label">{{ $t('dashboard.mood') }}</label>
                    <div class="emoji-row">
                      <button
                        v-for="(emoji, i) in moodEmojis"
                        :key="i"
                        type="button"
                        class="emoji-btn"
                        :class="{ 'emoji-btn--active': calMood === i + 1 }"
                        @click="selectCalendarMood(i + 1)"
                      >
                        {{ emoji }}
                      </button>
                    </div>
                  </div>

                  <div class="cal-field">
                    <label class="cal-field-label">{{ $t('dashboard.energy') }}</label>
                    <div class="emoji-row">
                      <button
                        v-for="(emoji, i) in energyEmojis"
                        :key="i"
                        type="button"
                        class="emoji-btn"
                        :class="{ 'emoji-btn--active emoji-btn--energy': calEnergy === i + 1 }"
                        @click="selectCalendarEnergy(i + 1)"
                      >
                        {{ emoji }}
                      </button>
                    </div>
                  </div>

                  <div class="cal-field">
                    <label class="cal-field-label">{{ $t('dashboard.tagsTitle') }}</label>
                    <div class="tags-container cal-tags">
                      <button
                        v-for="tag in availableTags"
                        :key="tag.id"
                        type="button"
                        class="tag-btn"
                        :class="{ 'tag-btn--active': isCalTagSelected(tag.id) }"
                        @click="toggleCalTag(tag.id)"
                      >
                        {{ activityLabel(tag.id) }}
                      </button>
                    </div>
                  </div>

                  <div class="cal-field">
                    <label class="cal-field-label">{{ $t('dashboard.note') }} <span class="optional">{{ $t('dashboard.optional') }}</span></label>
                    <textarea
                      v-model="calNote"
                      rows="2"
                      :placeholder="$t('dashboard.notePlaceholder')"
                      class="cal-textarea"
                    ></textarea>
                  </div>

                  <div class="cal-form-actions">
                    <button
                      v-if="isEditingCalendar"
                      type="button"
                      class="btn btn--secondary btn--grow btn--sm"
                      @click="cancelMoodCalendarEdit"
                    >
                      {{ $t('dashboard.btnCancel') }}
                    </button>
                    <button type="submit" class="btn btn--primary btn--grow btn--sm" :disabled="isCalSubmitting">
                      <span v-if="isCalSubmitting" class="spinner-small"></span>
                      <span v-else>{{ isEditingCalendar ? $t('dashboard.btnSaveEdit') : $t('dashboard.btnSave') }}</span>
                    </button>
                  </div>
                  </form>
                </div>
              </transition>
            </section>

            <section ref="sleepDetailCardRef" class="detail-card detail-card--anchored">
              <div class="detail-header">
                <span class="detail-date">{{ $t('nav.sleep') }}</span>
              </div>

              <transition name="card-swap" mode="out-in">
                <div
                  :key="selectedSleepLog && !isEditingCalendarSleep ? 'sleep-summary' : 'sleep-form'"
                  class="detail-card__content"
                >
                  <template v-if="selectedSleepLog && !isEditingCalendarSleep">
                <div class="detail-scores-large">
                  <div class="emoji-block">
                    <span class="emoji-big">🌙</span>
                    <div class="emoji-info">
                      <span class="emoji-label">{{ $t('sleep.hoursLabel') }}</span>
                      <span class="emoji-value">{{ `${selectedSleepLogHoursDisplay} ${$t('sleep.hoursUnit')}` }}</span>
                    </div>
                  </div>
                  <div class="emoji-divider"></div>
                  <div class="emoji-block">
                    <span class="emoji-big">{{ selectedSleepLogQuality.emoji }}</span>
                    <div class="emoji-info">
                      <span class="emoji-label">{{ $t('sleep.qualityLabel') }}</span>
                      <span class="emoji-value">{{ selectedSleepLogQuality.label }}</span>
                    </div>
                  </div>
                </div>

                    <button class="btn btn--secondary btn--sm btn--block" @click="openSleepCalendarEditor">
                      {{ $t('dashboard.btnEdit') }}
                    </button>
                  </template>

                  <form v-else @submit.prevent="submitCalendarSleepLog" class="cal-form">
                  <div class="cal-field">
                    <div class="sleep-slider-row">
                      <label class="cal-field-label">{{ $t('sleep.hoursLabel') }}</label>
                      <span class="sleep-hours-badge">{{ selectedSleepHoursDisplay }} {{ $t('sleep.hoursUnit') }}</span>
                    </div>

                    <div class="sleep-range-shell" :style="{ '--sleep-progress': sleepRangeProgress }">
                      <input
                        :value="calSleepHours"
                        type="range"
                        min="0"
                        max="16"
                        step="0.5"
                        class="sleep-range"
                        :style="{ '--sleep-progress': sleepRangeProgress }"
                        @input="updateCalendarSleepHours($event.target.value)"
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

                  <div class="cal-field">
                    <label class="cal-field-label">{{ $t('sleep.qualityLabel') }}</label>
                    <div class="sleep-quality-row">
                      <button
                        v-for="option in sleepQualityOptions"
                        :key="option.value"
                        type="button"
                        class="tag-btn"
                        :class="{ 'tag-btn--active': calSleepQuality === option.value }"
                        @click="selectCalendarSleepQuality(option.value)"
                      >
                        {{ option.label }}
                      </button>
                    </div>
                  </div>

                  <div class="cal-form-actions">
                    <button
                      v-if="isEditingCalendarSleep && selectedSleepLog"
                      type="button"
                      class="btn btn--secondary btn--grow btn--sm"
                      @click="cancelSleepCalendarEdit"
                    >
                      {{ $t('dashboard.btnCancel') }}
                    </button>
                    <button type="submit" class="btn btn--primary btn--grow btn--sm" :disabled="isCalSleepSubmitting">
                      <span v-if="isCalSleepSubmitting" class="spinner-small"></span>
                      <span v-else>{{ isEditingCalendarSleep ? $t('dashboard.btnSaveEdit') : $t('dashboard.btnSave') }}</span>
                    </button>
                  </div>
                  </form>
                </div>
              </transition>
            </section>
          </div>
        </transition>

        <section class="card mood-counter-section">
          <div class="card-header">
            <h2 class="card-title">{{ $t('statistics.moodCounter') }}</h2>
            <button type="button" class="info-btn" :aria-label="$t('statistics.openInfo')" @click="isMoodCounterInfoOpen = true">
              <span>i</span>
            </button>
          </div>
          <div class="gauge-wrapper">
            <div class="gauge-chart">
              <Doughnut :data="moodCounterData" :options="moodCounterOptions" />
              <div class="gauge-center">
                <span class="gauge-number">{{ viewMonthRecords.length }}</span>
                <span class="gauge-label">{{ $t('statistics.totalEntries') }}</span>
              </div>
            </div>
          </div>
          <div class="mood-counts">
            <div v-for="(m, i) in moodDistribution" :key="i" class="mood-count-item">
              <span class="mood-count-emoji">{{ m.emoji }}</span>
              <span class="mood-count-name">{{ m.name }}</span>
              <span class="mood-count-value" :style="{ color: m.color }">{{ m.count }}</span>
            </div>
          </div>
        </section>
      </template>

      <FooterSection />

      <transition name="fade">
        <div v-if="isMoodCounterInfoOpen" class="info-modal-overlay" @click="isMoodCounterInfoOpen = false">
          <div class="info-modal" @click.stop>
            <div class="info-modal-header">
              <div>
                <span class="info-modal-kicker">{{ $t('statistics.infoLabel') }}</span>
                <h3 class="info-modal-title">{{ $t('statistics.moodCounter') }}</h3>
              </div>
              <button
                type="button"
                class="info-modal-close"
                :aria-label="$t('statistics.closeInfo')"
                @click="isMoodCounterInfoOpen = false"
              >
                &times;
              </button>
            </div>
            <p class="info-modal-text">{{ $t('statistics.moodCounterInfo') }}</p>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { Doughnut } from 'vue-chartjs';
import FooterSection from '../components/FooterSection.vue';
import { useCalendarView } from '../composables/useCalendarView';

const detailStackRef = ref(null);
const moodDetailCardRef = ref(null);
const sleepDetailCardRef = ref(null);

const {
  activityLabel,
  availableTags,
  calEnergy,
  calMood,
  calNote,
  calSleepHours,
  calSleepQuality,
  calSelectedTags,
  canMoveNextMonth,
  calendarCells,
  cancelMoodCalendarEdit,
  cancelSleepCalendarEdit,
  closeDetail,
  energyEmoji,
  energyEmojis,
  formatDateFull,
  isCalSubmitting,
  isCalSleepSubmitting,
  isCalTagSelected,
  isEditingCalendar,
  isEditingCalendarSleep,
  isLoading,
  isMoodCounterInfoOpen,
  monthYearLabel,
  moodBg,
  moodBgSelected,
  moodColor,
  moodCounterData,
  moodCounterOptions,
  moodDistribution,
  openMoodCalendarEditor,
  moodEmoji,
  moodEmojis,
  nextMonth,
  openSleepCalendarEditor,
  prevMonth,
  records,
  selectedSleepHoursDisplay,
  selectedSleepLog,
  selectedSleepLogHoursDisplay,
  selectedSleepLogQuality,
  selectCalendarEnergy,
  selectCalendarMood,
  selectCalendarSleepQuality,
  selectDate,
  selectedDate,
  selectedRecord,
  sleepLogs,
  sleepQualityOptions,
  sleepRangeProgress,
  submitCalendarRecord,
  submitCalendarSleepLog,
  toggleCalTag,
  updateCalendarSleepHours,
  viewMonthRecords,
  visibleTags,
  weekdays,
} = useCalendarView({
  detailStackRef,
  moodDetailCardRef,
  sleepDetailCardRef,
});
</script>

<style scoped src="../assets/styles/views/calendar-view.css"></style>
