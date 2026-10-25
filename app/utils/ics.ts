import ical from 'ical-generator';

function parseEventDate(value: string): Date {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!match) throw new Error(`Некорректный формат даты события: ${value}`);

  const [, year, month, day, hours, minutes, seconds] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );

  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== Number(month) - 1 ||
    date.getDate() !== Number(day) ||
    date.getHours() !== Number(hours) ||
    date.getMinutes() !== Number(minutes) ||
    date.getSeconds() !== Number(seconds)
  ) {
    throw new Error(`Некорректная дата события: ${value}`);
  }

  return date;
}

export function generateICS(result: Awaited<ReturnType<typeof parseTimetable>>) {
  const calendar = ical({
    name: 'Расписание ВШЭ',
  });

  for (const event of result.events) {
    calendar.createEvent({
      id: event.uid,
      start: parseEventDate(event.start),
      end: parseEventDate(event.end),
      summary: event.subject,
      location: [event.building, event.room].filter(Boolean).join(', '),
      description: event.description,
    });
  }

  return calendar.toString()
}

