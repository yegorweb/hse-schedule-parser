<script setup lang="ts">
const file = ref<File | undefined>(undefined);
const groups = ref<string[]>([]);
const selectedGroup = ref<string | null>(null);
const isReadingFile = ref(false);
const isGenerating = ref(false);
const errorMessage = ref('');
const warnings = ref<string[]>([]);

watch(file, async (selectedFile) => {
  isReadingFile.value = false;
  groups.value = [];
  selectedGroup.value = null;
  warnings.value = [];
  errorMessage.value = '';

  if (!selectedFile) return;

  if (!selectedFile.name.toLocaleLowerCase('ru').endsWith('.xlsx')) {
    errorMessage.value = 'Поддерживаются только файлы Excel с расширением .xlsx.';
    return;
  }

  isReadingFile.value = true;

  try {
    const { getTimetableGroups } = await import('~/utils/excel');
    const foundGroups = await getTimetableGroups(await selectedFile.arrayBuffer());
    if (file.value !== selectedFile) return;

    if (foundGroups.length === 0) {
      throw new Error('В файле не найдены учебные группы.');
    }

    groups.value = foundGroups;
  } catch (error) {
    if (file.value !== selectedFile) return;
    errorMessage.value = getErrorMessage(error);
  } finally {
    if (file.value === selectedFile) isReadingFile.value = false;
  }
});

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Не удалось обработать файл. Проверьте, что это корректное расписание .xlsx.';
}

function onRejected() {
  errorMessage.value = 'Поддерживаются только файлы Excel с расширением .xlsx.';
}

async function downloadCalendar() {
  if (!file.value || !selectedGroup.value) return;

  const selectedFile = file.value;
  const group = selectedGroup.value;
  isGenerating.value = true;
  errorMessage.value = '';
  warnings.value = [];

  try {
    const [{ parseTimetable }, { generateICS }] = await Promise.all([
      import('~/utils/excel'),
      import('~/utils/ics'),
    ]);
    const timetable = await parseTimetable(
      await selectedFile.arrayBuffer(),
      group,
    );
    if (file.value !== selectedFile || selectedGroup.value !== group) return;

    const calendar = generateICS(timetable);
    const blob = new Blob([calendar], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeGroupName = group.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');

    link.href = url;
    link.download = `raspisanie-${safeGroupName}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    warnings.value = timetable.warnings;
  } catch (error) {
    errorMessage.value = getErrorMessage(error);
  } finally {
    isGenerating.value = false;
  }
}

function resetFile() {
  file.value = undefined;
  groups.value = [];
  selectedGroup.value = null;
  errorMessage.value = '';
  warnings.value = [];
}

useSeoMeta({
  title: 'Расписание ВШЭ в календаре — Excel в ICS',
  description: 'Бесплатно конвертируйте расписание НИУ ВШЭ из Excel в календарь .ics. Выберите файл .xlsx и учебную группу — без регистрации и загрузки данных на сервер.',
  ogTitle: 'Расписание ВШЭ в календаре',
  ogDescription: 'Конвертер расписания НИУ ВШЭ из Excel в календарь ICS. Быстро, бесплатно и прямо в браузере.',
  ogType: 'website',
  ogLocale: 'ru_RU',
  twitterCard: 'summary',
});

useHead({
  link: [
    {
      rel: 'canonical',
      href: 'https://yegorweb.github.io/hse-schedule-parser/',
    },
  ],
});
</script>

<template>
  <main class="page-shell">
    <v-container class="page-content">
      <section class="converter" aria-labelledby="page-title">
        <h1 id="page-title" class="page-title">
          Конвертер .xlsx в .ics
        </h1>

        <div class="workflow-card">
          <div class="step-heading">
            <div>
              <h2>Загрузите расписание .xlsx</h2>
            </div>
            <v-btn
              v-if="file"
              class="reset-button"
              icon="mdi-close"
              aria-label="Выбрать другой файл"
              variant="text"
              @click="resetFile"
            />
          </div>

          <v-file-upload
            v-model="file"
            class="schedule-upload"
            density="default"
            title="Перетащите сюда"
            subtitle="или выберите файл .xlsx"
            accept=".xlsx"
            filter-by-type=".xlsx"
            clearable
            hide-browse
            @rejected="onRejected"
          />

          <div v-if="isReadingFile" class="status-message">
            <v-progress-circular indeterminate color="secondary" size="20" width="2" />
            <span>Читаем расписание…</span>
          </div>

          <template v-if="groups.length">
            <v-divider class="workflow-divider" />

            <div class="step-heading second-step">
              <div>
                <h2>Выберите группу</h2>
                <p>В календарь попадут занятия только вашей группы</p>
              </div>
            </div>

            <v-autocomplete
              v-model="selectedGroup"
              class="group-select"
              :items="groups"
              label="Учебная группа"
              placeholder="Например, КНТ..."
              prepend-inner-icon="mdi-account-group-outline"
              variant="outlined"
              density="comfortable"
              auto-select-first
              autocomplete="off"
              hide-details
            />

            <v-btn
              class="download-button"
              color="primary"
              prepend-icon="mdi-calendar-arrow-down"
              size="large"
              :disabled="!selectedGroup"
              :loading="isGenerating"
              @click="downloadCalendar"
            >
              Скачать .ics
            </v-btn>
            <p class="calendar-hint">
              Файл можно импортировать в Google Calendar, Apple Calendar и Outlook.
            </p>
          </template>

          <v-alert
            v-if="errorMessage"
            class="feedback-alert"
            type="error"
            variant="tonal"
            density="comfortable"
            role="alert"
          >
            {{ errorMessage }}
          </v-alert>

          <v-alert
            v-if="warnings.length"
            class="feedback-alert"
            type="warning"
            variant="tonal"
            density="comfortable"
          >
            В календаре есть предупреждения: {{ warnings.join(' ') }}
          </v-alert>
        </div>

      </section>
    </v-container>
  </main>
</template>

<style lang="scss" scoped>
.page-shell {
  display: flex;
  min-height: calc(100vh - 60px);
  align-items: center;
  padding: 24px 0 64px;
}

.page-content {
  display: flex;
  justify-content: center;
}

.converter {
  width: min(100%, 620px);
  text-align: center;
}

.page-title {
  margin: 0 0 28px;
  font-size: clamp(2.25rem, 6vw, 3.75rem);
  font-weight: 750;
  letter-spacing: -0.055em;
  line-height: 1.06;
  color: #fff;
}

.workflow-card {
  padding: 26px;
  border-radius: 20px;
  background: rgba(20, 29, 46, 0.92);
  text-align: left;
}

.step-heading {
  display: flex;
  align-items: center;
  gap: 13px;
  margin-bottom: 18px;

  h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 750;
  }

  p {
    margin: 3px 0 0;
    color: rgb(var(--v-theme-on-surface-variant));
    font-size: 0.83rem;
  }
}

.reset-button {
  margin-left: auto;
}

.schedule-upload {
  :deep(.v-file-upload) {
    min-height: 150px;
    border: 1px dashed rgba(157, 185, 234, 0.35);
    border-radius: 14px;
    background: rgba(8, 15, 28, 0.45);
  }

  :deep(.v-file-upload__title) {
    color: rgb(var(--v-theme-on-surface));
  }
}

.workflow-divider {
  margin: 24px 0;
  opacity: 0.35;
}

.second-step {
  margin-bottom: 16px;
}

.group-select {
  margin-bottom: 16px;
}

.download-button {
  width: 100%;
  min-height: 50px;
  font-weight: 650;
}

.calendar-hint {
  margin: 12px 0 0;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.78rem;
  text-align: center;
}

.status-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px 0 4px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.9rem;
}

.feedback-alert {
  margin-top: 16px;
  overflow-wrap: anywhere;
}

@media (max-width: 600px) {
  .page-shell {
    min-height: calc(100vh - 60px);
    padding: 34px 0 48px;
  }

  .page-title {
    margin-bottom: 24px;
  }

  .workflow-card {
    padding: 20px 16px;
    border-radius: 16px;
  }
}
</style>