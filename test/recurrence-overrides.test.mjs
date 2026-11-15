import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DateTime, Interval } from 'luxon'
import { ICalendarEvents } from '../dist/index.js'

const calendar = body => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\n${body}END:VCALENDAR\r\n`
const vevent = lines => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT\r\n`
// Weekly 09:00-10:00 UTC on 2, 9 and 16 November 2026
const series = (sequence = 0, rule = 'FREQ=WEEKLY;COUNT=3', extra = []) =>
  vevent(['UID:yoga', `SEQUENCE:${sequence}`, 'DTSTART:20261102T090000Z', 'DTEND:20261102T100000Z', `RRULE:${rule}`, ...extra])
const override = (sequence, start, end, extra = [], uid = 'yoga') =>
  vevent([`UID:${uid}`, `SEQUENCE:${sequence}`, 'RECURRENCE-ID:20261109T090000Z', `DTSTART:${start}`, `DTEND:${end}`, ...extra])
const movedToNextDay = override(1, '20261110T090000Z', '20261110T100000Z')
const day = date => Interval.fromDateTimes(DateTime.fromISO(`${date}T00:00Z`), DateTime.fromISO(`${date}T00:00Z`).plus({ days: 1 }))
const november = Interval.fromDateTimes(DateTime.fromISO('2026-11-01T00:00Z'), DateTime.fromISO('2026-12-01T00:00Z'))
const starts = (body, range) => new ICalendarEvents(calendar(body), range, { includeDTSTART: true }).events
  .map(event => event.dtstart.toUTC().toFormat('dd/MM HH:mm'))

describe('modified occurrences (RECURRENCE-ID)', () => {
  it('returns a moved occurrence in a range that contains only its new start', () => {
    assert.deepEqual(starts(series() + movedToNextDay, day('2026-11-10')), ['10/11 09:00'])
  })

  it('removes the original occurrence from a range that contains only its original start', () => {
    assert.deepEqual(starts(series() + movedToNextDay, day('2026-11-09')), [])
  })

  it('does not depend on the order of components in the feed', () => {
    assert.deepEqual(starts(movedToNextDay + series(), day('2026-11-10')), ['10/11 09:00'])
  })

  it('keeps the original start in recurrenceId and the version in sequence', () => {
    const [moved] = new ICalendarEvents(calendar(series() + movedToNextDay), day('2026-11-10')).events
    assert.equal(moved.recurrenceId?.toUTC().toISO(), '2026-11-09T09:00:00.000Z')
    assert.equal(moved.sequence, 1)
  })

  it('uses the version with the highest SEQUENCE whatever their order', () => {
    const older = override(1, '20261109T110000Z', '20261109T120000Z')
    const newer = override(2, '20261109T140000Z', '20261109T150000Z')
    assert.deepEqual(starts(series() + older + newer, day('2026-11-09')), ['09/11 14:00'])
    assert.deepEqual(starts(series() + newer + older, day('2026-11-09')), ['09/11 14:00'])
  })

  it('removes a cancelled occurrence', () => {
    const cancelled = override(1, '20261109T090000Z', '20261109T100000Z', ['STATUS:CANCELLED'])
    assert.deepEqual(starts(series() + cancelled, november), ['02/11 09:00', '16/11 09:00'])
  })

  it('applies a modification with a lower SEQUENCE than its series', () => {
    // Evolution exports keep the series SEQUENCE above the SEQUENCE of its modified occurrences
    assert.deepEqual(starts(series(4) + movedToNextDay, day('2026-11-09')), [])
    assert.deepEqual(starts(series(4) + movedToNextDay, day('2026-11-10')), ['10/11 09:00'])
    const cancelled = override(1, '20261109T090000Z', '20261109T100000Z', ['STATUS:CANCELLED'])
    assert.deepEqual(starts(series(4) + cancelled, november), ['02/11 09:00', '16/11 09:00'])
  })

  it('keeps a modified occurrence whose series is not in the feed', () => {
    const single = override(1, '20261110T090000Z', '20261110T100000Z', [], 'invitation')
    assert.deepEqual(starts(single, day('2026-11-10')), ['10/11 09:00'])
  })

  it('moves all-day and TZID occurrences across days', () => {
    const allDay = vevent(['UID:d', 'DTSTART;VALUE=DATE:20261102', 'DTEND;VALUE=DATE:20261103', 'RRULE:FREQ=WEEKLY;COUNT=3']) +
      vevent(['UID:d', 'SEQUENCE:1', 'RECURRENCE-ID;VALUE=DATE:20261109', 'DTSTART;VALUE=DATE:20261110', 'DTEND;VALUE=DATE:20261111'])
    assert.deepEqual(new ICalendarEvents(calendar(allDay), november).events.map(event => event.dtstart.toISODate()),
      ['2026-11-02', '2026-11-10', '2026-11-16'])
    const zoned = vevent(['UID:t', 'DTSTART;TZID=Europe/Paris:20261102T100000', 'DTEND;TZID=Europe/Paris:20261102T110000', 'RRULE:FREQ=WEEKLY;COUNT=3']) +
      vevent(['UID:t', 'SEQUENCE:1', 'RECURRENCE-ID;TZID=Europe/Paris:20261109T100000', 'DTSTART;TZID=Europe/Paris:20261110T150000', 'DTEND;TZID=Europe/Paris:20261110T160000'])
    assert.deepEqual(starts(zoned, november), ['02/11 09:00', '10/11 14:00', '16/11 09:00'])
  })
})

describe('RRULE COUNT', () => {
  it('bounds the whole recurrence set, not the occurrences in the range', () => {
    assert.deepEqual(starts(series(), day('2026-11-16')), ['16/11 09:00'])
    assert.deepEqual(starts(series(), day('2026-11-23')), [])
  })

  it('counts occurrences removed by EXDATE', () => {
    assert.deepEqual(starts(series(0, 'FREQ=WEEKLY;COUNT=3', ['EXDATE:20261109T090000Z']), november), ['02/11 09:00', '16/11 09:00'])
  })

  it('applies RDATE in a range without any RRULE occurrence', () => {
    const body = vevent(['UID:r', 'DTSTART:20261102T090000Z', 'DTEND:20261102T100000Z', 'RRULE:FREQ=WEEKLY', 'RDATE:20261225T090000Z'])
    assert.deepEqual(starts(body, day('2026-12-25')), ['25/12 09:00'])
  })

  it('returns the same occurrences for any window of the recurrence set', () => {
    const body = series(0, 'FREQ=DAILY;COUNT=10')
    const all = starts(body, november)
    assert.equal(all.length, 10)
    for (let date = DateTime.fromISO('2026-11-01T00:00Z'); date < DateTime.fromISO('2026-11-15T00:00Z'); date = date.plus({ days: 1 })) {
      const window = Interval.fromDateTimes(date, date.plus({ days: 3 }))
      assert.deepEqual(starts(body, window), new ICalendarEvents(calendar(body), november, { includeDTSTART: true }).events
        .filter(event => window.contains(event.dtstart)).map(event => event.dtstart.toUTC().toFormat('dd/MM HH:mm')))
    }
  })
})

describe('RRULE expansion', () => {
  const dates = (start, rule) => new ICalendarEvents(calendar(vevent(['UID:x', `DTSTART;TZID=America/New_York:${start}`, 'DURATION:PT1H', `RRULE:${rule}`])),
    Interval.fromDateTimes(DateTime.fromISO('2024-01-01T00:00Z'), DateTime.fromISO('2027-01-01T00:00Z'))).events.map(event => event.dtstart.toISODate())

  it('counts an ordinal BYDAY within the month for FREQ=YEARLY with BYMONTH', () => {
    assert.deepEqual(dates('20241128T090000', 'FREQ=YEARLY;BYMONTH=11;BYDAY=4TH'), ['2024-11-28', '2025-11-27', '2026-11-26'])
    assert.deepEqual(dates('20240527T090000', 'FREQ=YEARLY;BYMONTH=5;BYDAY=-1MO'), ['2024-05-27', '2025-05-26', '2026-05-25'])
  })

  it('does not skip January 1-30 of the following years for FREQ=YEARLY with BYMONTH', () => {
    assert.deepEqual(dates('20240115T090000', 'FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=15'), ['2024-01-15', '2025-01-15', '2026-01-15'])
    assert.deepEqual(dates('20240702T090000', 'FREQ=YEARLY;BYMONTH=1,7;BYDAY=TU;COUNT=8'),
      ['2024-07-02', '2024-07-09', '2024-07-16', '2024-07-23', '2024-07-30', '2025-01-07', '2025-01-14', '2025-01-21'])
  })

  it('applies WKST to the weeks of FREQ=WEEKLY with BYSETPOS', () => {
    assert.deepEqual(dates('20240714T090000', 'FREQ=WEEKLY;BYDAY=FR,SU;BYSETPOS=2;COUNT=3'), ['2024-07-14', '2024-07-21', '2024-07-28'])
    assert.deepEqual(dates('20240714T090000', 'FREQ=WEEKLY;BYDAY=FR,SU;BYSETPOS=2;WKST=SU;COUNT=3'), ['2024-07-14', '2024-07-19', '2024-07-26'])
  })
})
