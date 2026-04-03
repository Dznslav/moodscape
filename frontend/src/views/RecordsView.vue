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
        <section ref="recordFormCardRef" class="card sleep-card form-scroll-anchor">
          <div class="sleep-card__header">
            <div>
              <h2 class="card-title sleep-card__title">{{ isEditing ? $t('dashboard.editRecord') : $t('dashboard.recordOfDay') }}</h2>
              <p class="sleep-card__subtitle">
                {{ showRecordSummary ? $t('dashboard.recordSummarySubtitle') : $t('dashboard.recordPromptSubtitle') }}
              </p>
              <p v-if="isLogicalCarryover" class="sleep-card__subtitle sleep-card__subtitle--muted">
                {{ $t('dashboard.logicalDayHint', { date: trackingDateLabel }) }}
              </p>
            </div>

            <button
              v-if="showRecordSummary"
              type="button"
              class="btn btn--secondary btn--sm btn--inline"
              @click="openTodayEditor"
            >
              {{ $t('dashboard.btnEdit') }}
            </button>
          </div>

          <form v-if="showForm" @submit.prevent="submitRecord" class="form">
            <div class="field">
              <label class="field-label">{{ $t('dashboard.mood') }}</label>
              <div class="emoji-row">
                <button
                  v-for="(emoji, i) in moodEmojis"
                  :key="i"
                  type="button"
                  class="emoji-btn"
                  :class="{ 'emoji-btn--active': mood === i + 1 }"
                  @click="selectMood(i + 1)"
                >
                  {{ emoji }}
                </button>
              </div>
              <div class="scale-labels">
                <span>{{ $t('dashboard.moodTerrible') }}</span><span>{{ $t('dashboard.moodExcellent') }}</span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">{{ $t('dashboard.energy') }}</label>
              <div class="emoji-row">
                <button
                  v-for="(emoji, i) in energyEmojis"
                  :key="i"
                  type="button"
                  class="emoji-btn"
                  :class="{ 'emoji-btn--active emoji-btn--energy': energy === i + 1 }"
                  @click="selectEnergy(i + 1)"
                >
                  {{ emoji }}
                </button>
              </div>
              <div class="scale-labels">
                <span>{{ $t('dashboard.energyExhausted') }}</span><span>{{ $t('dashboard.energyFull') }}</span>
              </div>
            </div>

            <div class="field">
              <label class="field-label">{{ $t('dashboard.tagsTitle') }}</label>
              <div class="tags-container">
                <button
                  v-for="tag in availableTags"
                  :key="tag.id"
                  type="button"
                  class="tag-btn"
                  :class="{ 'tag-btn--active': isTagSelected(tag.id) }"
                  @click="toggleTag(tag.id)"
                >
                  {{ activityLabel(tag.id) }}
                </button>
              </div>
            </div>

            <div class="field">
              <label for="note" class="field-label">{{ $t('dashboard.note') }} <span class="optional">{{ $t('dashboard.optional') }}</span></label>
              <textarea
                id="note"
                v-model="note"
                rows="3"
                :placeholder="$t('dashboard.notePlaceholder')"
                class="textarea"
              ></textarea>
            </div>

            <div class="form-actions">
              <button v-if="isEditing" type="button" class="btn btn--secondary btn--grow" @click="cancelEdit">
                {{ $t('dashboard.btnCancel') }}
              </button>
              <button type="submit" class="btn btn--primary btn--grow" :disabled="isSubmitting">
                <span v-if="isSubmitting" class="spinner"></span>
                <span v-else>{{ isEditing ? $t('dashboard.btnSaveEdit') : $t('dashboard.btnSave') }}</span>
              </button>
            </div>
          </form>

          <template v-else>
            <div class="sleep-summary-grid">
              <div class="sleep-summary-pill">
                <span class="sleep-summary-pill__label">{{ $t('dashboard.mood') }}</span>
                <strong class="sleep-summary-pill__value">
                  {{ todayMoodSummary.emoji }} {{ todayMoodSummary.value }}
                </strong>
              </div>
              <div class="sleep-summary-pill">
                <span class="sleep-summary-pill__label">{{ $t('dashboard.energy') }}</span>
                <strong class="sleep-summary-pill__value">
                  {{ todayEnergySummary.emoji }} {{ todayEnergySummary.value }}
                </strong>
              </div>
            </div>
            <div v-if="todayRecordTags.length" class="history-tags">
              <span v-for="tag in todayRecordTags" :key="tag" class="history-tag-pill">
                {{ activityLabel(tag) }}
              </span>
            </div>
            <div v-if="todayRecordNote" class="history-card-note">
              {{ todayRecordNote }}
            </div>
            <p class="sleep-card__subtitle sleep-card__subtitle--muted">{{ $t('dashboard.recordSummaryNote') }}</p>
          </template>
        </section>

        <section v-if="hasRecordsForMonth || records.length > 0" class="history-section">
          <div class="history-header">
            <h2 class="section-title">{{ $t('dashboard.historyTitle') }}</h2>
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

          <div v-if="filteredRecords.length" class="history-list">
            <div
              v-for="rec in filteredRecords"
              :key="rec.id"
              class="history-card"
            >
              <button
                class="dots-btn"
                @click.stop="toggleMenu(rec.id)"
              >
                ⋯
              </button>

              <div v-if="openMenuId === rec.id" class="mini-menu" @click.stop>
                <button class="mini-menu-item" @click="startEdit(rec)">
                  ✏️ {{ $t('dashboard.btnEdit') }}
                </button>
              </div>

              <div class="history-top">
                <span class="history-date">{{ formatDate(rec.timestamp) }}</span>
              </div>

              <div v-if="visibleTags(rec.tags).length" class="history-tags">
                <span v-for="tag in visibleTags(rec.tags)" :key="tag" class="history-tag-pill">
                  {{ activityLabel(tag) }}
                </span>
              </div>

              <div class="history-emojis-large">
                <div class="emoji-block">
                  <span class="emoji-big">{{ moodEmoji(rec.mood) }}</span>
                  <div class="emoji-info">
                    <span class="emoji-label">{{ $t('dashboard.mood') }}</span>
                    <span class="emoji-value">{{ rec.mood }}/5</span>
                  </div>
                </div>
                <div class="emoji-divider"></div>
                <div class="emoji-block">
                  <span class="emoji-big">{{ energyEmoji(rec.energy) }}</span>
                  <div class="emoji-info">
                    <span class="emoji-label">{{ $t('dashboard.energy') }}</span>
                    <span class="emoji-value">{{ rec.energy }}/5</span>
                  </div>
                </div>
              </div>

              <div v-if="rec.note" class="history-card-note">
                {{ rec.note }}
              </div>
            </div>
          </div>
          <div v-else class="empty-month">
            <p>{{ $t('dashboard.emptyTitle') }}</p>
          </div>
        </section>

        <div v-else class="empty">
          <div class="empty-icon">📝</div>
          <p class="empty-title">{{ $t('dashboard.emptyTitle') }}</p>
        </div>
      </template>

      <div v-if="openMenuId !== null" class="menu-overlay" @click="openMenuId = null"></div>

      <GdprConsentModal
        v-model:isVisible="showGdprConsent"
        @consent-updated="onConsentUpdated"
      />

      <FooterSection />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import FooterSection from '../components/FooterSection.vue';
import GdprConsentModal from '../components/GdprConsentModal.vue';
import { useRecordsView } from '../composables/useRecordsView';

const recordFormCardRef = ref(null);

const {
  activityLabel,
  availableTags,
  cancelEdit,
  canMoveNextMonth,
  displayName,
  energy,
  energyEmoji,
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
  moodEmoji,
  moodEmojis,
  nextMonth,
  note,
  onConsentUpdated,
  openMenuId,
  openTodayEditor,
  prevMonth,
  records,
  selectEnergy,
  selectMood,
  showRecordSummary,
  showForm,
  showGdprConsent,
  startEdit,
  submitRecord,
  today,
  isLogicalCarryover,
  trackingDateLabel,
  todayEnergySummary,
  todayMoodSummary,
  todayRecordNote,
  todayRecordTags,
  toggleMenu,
  toggleTag,
  visibleTags,
} = useRecordsView({ formCardRef: recordFormCardRef });
</script>

<style scoped src="../assets/styles/views/records-view.css"></style>
