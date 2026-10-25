import ExcelJS from 'exceljs';

export interface TimetableEvent {
  uid: string;
  group: string;
  subject: string;
  teacher?: string;
  start: string; // YYYYMMDDTHHmmss
  end: string;   // YYYYMMDDTHHmmss
  room?: string;
  building?: string;
  description: string;
}

export interface TimetableResult {
  groups: string[];
  events: TimetableEvent[];
  warnings: string[];
  period: {
    start: string; // YYYYMMDD
    end: string;   // YYYYMMDD
  };
}

interface Lesson {
  group: string;
  subject: string;
  teacher?: string;
  weekday: number;
  startTime: string;
  endTime: string;
  room?: string;
  building?: string;
  explicitDates: string[];
  startsFrom?: string;
  sheet: string;
  cell: string;
}

const TIME_RE = /^(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})$/;

const WEEKDAYS: Record<string, number> = {
  пн: 1,
  вт: 2,
  ср: 3,
  чт: 4,
  пт: 5,
  сб: 6,
  вс: 7,
};

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return '';

  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText.map((part) => part.text).join('');
    }

    if ('text' in value && typeof value.text === 'string') {
      return value.text;
    }

    if ('result' in value) {
      return cellText(value.result as ExcelJS.CellValue);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }
  }

  return String(value);
}

function normalize(value: string): string {
  return value.replace(/\r/g, '').trim();
}

function normalizeRoom(value: string): string | undefined {
  const room = normalize(value).replace(/\.0+$/, '');
  return room && room !== '-' && room !== '—' ? room : undefined;
}

function formatDate(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
}

function formatDateTime(date: Date, time: string): string {
  const [hours, minutes] = time.split(':').map(Number) as any;

  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);

  return `${formatDate(result)}T${String(hours).padStart(2, '0')}${String(minutes).padStart(2, '0')}00`;
}

function parseDate(day: number, month: number, year: number): Date {
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error(`Некорректная дата: ${day}.${month}.${year}`);
  }

  return date;
}

function parseDayMonth(value: string, year: number): Date | undefined {
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
  if (!match) return undefined;

  return parseDate(Number(match[1]), Number(match[2]), year);
}

function parseLesson(raw: string) {
  let text = normalize(raw);

  // "с 09.11." — дата начала регулярных занятий,
  // а не отдельное событие.
  const startMatch = text.match(
    /(?:^|\s)с\s+(\d{1,2}\.\d{1,2}\.?)/i,
  );
  const startsFrom = startMatch?.[1];

  if (startMatch) {
    text = text.replace(startMatch[0], ' ');
  }

  // Извлекаем явные даты, например:
  // "10.11., 24.11., 08.12."
  const explicitDates = [
    ...text.matchAll(/(?<!\d)(\d{1,2})\.(\d{1,2})\.?(?!\d)/g),
  ].map((match) => `${match[1]}.${match[2]}.`);

  text = text
    .replace(/(?<!\d)\d{1,2}\.\d{1,2}\.?(?!\d)/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const teacherIndex = lines.findLastIndex((line) =>
    /^[А-ЯЁ][а-яё-]+(?:\s+[А-ЯЁ][а-яё-]+)?\s+[А-ЯЁ]\.[А-ЯЁ]\.?$/u.test(line),
  );

  const teacher =
    teacherIndex >= 0 ? lines.splice(teacherIndex, 1)[0] : undefined;
  const subject = lines
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s,]+/, '');

  return {
    subject,
    teacher,
    explicitDates: [...new Set(explicitDates)],
    startsFrom,
  };
}

/**
 * Читает период действия расписания из текста книги.
 *
 * Поддерживает форматы:
 * 01.09.2026 - 31.12.2026
 * с 01.09.2026 по 31.12.2026
 * 01.09 - 31.12
 *
 * Если год не указан, используется текущий.
 */
function detectPeriod(
  workbook: ExcelJS.Workbook,
  year: number,
): { start: Date; end: Date } {
  const texts: string[] = [];

  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const value = normalize(cellText(cell.value));
        if (value) texts.push(value);
      });
    });
  }

  const patterns = [
    /(\d{1,2}\.\d{1,2}\.?\d{0,4})\s*(?:-|–|—|по)\s*(\d{1,2}\.\d{1,2}\.?\d{0,4})/i,
    /с\s+(\d{1,2}\.\d{1,2}\.?\d{0,4})\s+по\s+(\d{1,2}\.\d{1,2}\.?\d{0,4})/i,
  ];

  for (const text of texts) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const start = parseDateString(match[1] as any, year);
      const end = parseDateString(match[2] as any, year);

      if (start && end && start <= end) return { start, end };
    }
  }

  throw new Error(
    'Не удалось определить период расписания. Добавьте его явно или передайте через параметр period.',
  );
}

function parseDateString(value: string, defaultYear: number): Date | undefined {
  const match = value.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{4})?$/);
  if (!match) return undefined;

  return parseDate(
    Number(match[1]),
    Number(match[2]),
    match[3] ? Number(match[3]) : defaultYear,
  );
}

function dateInRange(date: Date, start: Date, end: Date): boolean {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  return (
    value >= new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime() &&
    value <= new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  );
}

function getMergedEndRow(
  sheet: ExcelJS.Worksheet,
  row: number,
  col: number,
): number {
  for (const address of sheet.model.merges ?? []) {
    const [startAddress, endAddress] = address.split(':');
    const start = sheet.getCell(startAddress as any);
    const end = sheet.getCell(endAddress as any);

    if (
      start.fullAddress.row === row &&
      start.fullAddress.col === col &&
      end.fullAddress.col === col
    ) {
      return end.fullAddress.row;
    }
  }

  return row;
}

function getGroupHeaderCells(sheet: ExcelJS.Worksheet): ExcelJS.Cell[] {
  const groupCells: ExcelJS.Cell[] = [];

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      const roomHeader = normalize(
        cellText(sheet.getCell(cell.row, cell.fullAddress.col + 1).value),
      ).toLocaleLowerCase('ru');
      const buildingHeader = normalize(
        cellText(sheet.getCell(cell.row, cell.fullAddress.col + 2).value),
      ).toLocaleLowerCase('ru');
      const group = normalize(cellText(cell.value));

      if (
        group &&
        roomHeader === 'ауд.' &&
        buildingHeader === 'корпус'
      ) {
        groupCells.push(cell);
      }
    });
  });

  return groupCells;
}

function getGroups(workbook: ExcelJS.Workbook): string[] {
  const groups = new Set<string>();

  for (const sheet of workbook.worksheets) {
    for (const cell of getGroupHeaderCells(sheet)) {
      groups.add(normalize(cellText(cell.value)));
    }
  }

  return [...groups].sort((a, b) => a.localeCompare(b, 'ru'));
}

export async function getTimetableGroups(
  buffer: Parameters<typeof ExcelJS.Workbook.prototype.xlsx.load>[0],
): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  return getGroups(workbook);
}

function collectLessons(
  workbook: ExcelJS.Workbook,
  selectedGroup: string,
  warnings: string[],
): Lesson[] {
  for (const sheet of workbook.worksheets) {
    const groupCell = getGroupHeaderCells(sheet).find(
      (cell) => normalize(cellText(cell.value)) === selectedGroup,
    );

    if (!groupCell) continue;

    const groupCol = groupCell.fullAddress.col;
    const lessons: Lesson[] = [];

    let weekday: number | undefined;
    let firstLessonRow = 0;

    for (let row = 1; row <= sheet.rowCount; row++) {
      const day = normalize(cellText(sheet.getCell(row, 2).value)).toLowerCase();
      const time = normalize(cellText(sheet.getCell(row, 3).value));

      if (day in WEEKDAYS) weekday = WEEKDAYS[day];

      if (time.match(TIME_RE)) {
        firstLessonRow = row;
        break;
      }
    }

    if (!firstLessonRow) {
      warnings.push(`${sheet.name}: не найдены строки с временем занятий.`);
      continue;
    }

    weekday = undefined;

    for (let row = firstLessonRow; row <= sheet.rowCount; row++) {
      const day = normalize(cellText(sheet.getCell(row, 2).value)).toLowerCase();
      if (day in WEEKDAYS) weekday = WEEKDAYS[day];

      const time = normalize(cellText(sheet.getCell(row, 3).value));
      const timeMatch = time.match(TIME_RE);

      if (!weekday || !timeMatch) continue;

      const cell = sheet.getCell(row, groupCol);
      const raw = normalize(cellText(cell.value));

      if (!raw || raw === '-' || raw === '—') continue;

      const parsed = parseLesson(raw);

      if (/занятия проводятся по расписанию дисциплины/i.test(parsed.subject)) {
        continue;
      }

      if (!parsed.subject) {
        warnings.push(`${sheet.name}!${cell.address}: не удалось определить предмет.`);
        continue;
      }

      const mergedEndRow = getMergedEndRow(sheet, row, groupCol);
      const mergedEndTime = normalize(
        cellText(sheet.getCell(mergedEndRow, 3).value),
      ).match(TIME_RE);

      lessons.push({
        group: selectedGroup,
        subject: parsed.subject,
        teacher: parsed.teacher,
        weekday,
        startTime: timeMatch[1] as any,
        endTime:
          mergedEndRow > row && mergedEndTime
            ? mergedEndTime[2] as any
            : timeMatch[2],
        room: normalizeRoom(cellText(sheet.getCell(row, groupCol + 1).value)),
        building: normalizeRoom(cellText(sheet.getCell(row, groupCol + 2).value)),
        explicitDates: parsed.explicitDates,
        startsFrom: parsed.startsFrom,
        sheet: sheet.name,
        cell: cell.address,
      });

      if (mergedEndRow > row) row = mergedEndRow;
    }

    return lessons;
  }

  throw new Error(`Не найдена группа "${selectedGroup}" в расписании.`);
}

function expandLesson(
  lesson: Lesson,
  periodStart: Date,
  periodEnd: Date,
  year: number,
  warnings: string[],
): TimetableEvent[] {
  let dates: Date[] = [];

  if (lesson.explicitDates.length > 0) {
    for (const value of lesson.explicitDates) {
      try {
        const date = parseDayMonth(value, year);

        if (date && dateInRange(date, periodStart, periodEnd)) {
          dates.push(date);
        }
      } catch {
        warnings.push(`${lesson.sheet}!${lesson.cell}: некорректная дата ${value}`);
      }
    }
  } else {
    let start = periodStart;

    if (lesson.startsFrom) {
      try {
        const from = parseDayMonth(lesson.startsFrom, year);
        if (from && from > start) start = from;
      } catch {
        warnings.push(`${lesson.sheet}!${lesson.cell}: некорректная дата начала.`);
      }
    }

    const date = new Date(start);

    while (date.getDay() !== lesson.weekday % 7) {
      date.setDate(date.getDate() + 1);
    }

    while (date <= periodEnd) {
      dates.push(new Date(date));
      date.setDate(date.getDate() + 7);
    }
  }

  return dates.map((date) => {
    const start = formatDateTime(date, lesson.startTime);
    const end = formatDateTime(date, lesson.endTime);

    const description = [
      lesson.teacher && `Преподаватель: ${lesson.teacher}`,
      lesson.room && `Аудитория: ${lesson.room}`,
      lesson.building && `Корпус: ${lesson.building}`,
      `Группа: ${lesson.group}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      uid: `${lesson.sheet}-${lesson.cell}-${formatDate(date)}-${lesson.group}@hse-timetable`,
      group: lesson.group,
      subject: lesson.subject,
      teacher: lesson.teacher,
      start,
      end,
      room: lesson.room,
      building: lesson.building,
      description,
    };
  });
}

export async function parseTimetable(
  buffer: Parameters<typeof ExcelJS.Workbook.prototype.xlsx.load>[0],
  selectedGroup: string,
  options: {
    year?: number;
    period?: { start: Date; end: Date };
  } = {},
): Promise<TimetableResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const year = options.year ?? new Date().getFullYear();
  const groups = getGroups(workbook);

  if (!groups.includes(selectedGroup)) {
    throw new Error(
      `Группа "${selectedGroup}" не найдена. Доступные группы: ${groups.join(', ')}`,
    );
  }

  const period = options.period ?? detectPeriod(workbook, year);
  const warnings: string[] = [];

  const lessons = collectLessons(workbook, selectedGroup, warnings);

  const events = lessons.flatMap((lesson) =>
    expandLesson(lesson, period.start, period.end, year, warnings),
  );

  events.sort((a, b) => a.start.localeCompare(b.start));

  return {
    groups,
    events,
    warnings,
    period: {
      start: formatDate(period.start),
      end: formatDate(period.end),
    },
  };
}
