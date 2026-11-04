import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { DateTime, Interval } from 'luxon'
import { ICalendarEvents } from '../dist/index.js'

const calendar = body => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Test//EN\r\n${body}END:VCALENDAR\r\n`
const vevent = lines => `BEGIN:VEVENT\r\n${lines.join('\r\n')}\r\nEND:VEVENT\r\n`
const range = (start, end) => Interval.fromDateTimes(DateTime.fromISO(start, { zone: 'UTC' }), DateTime.fromISO(end, { zone: 'UTC' }))
// 5 November 2026, 09:00-17:00 UTC
const slot = range('2026-11-05T09:00', '2026-11-05T17:00')
const uids = (body, interval, rangeMode) => new ICalendarEvents(calendar(body), interval, { rangeMode }).events.map(event => event.uid)

describe('rangeMode', () => {
  const morning = vevent(['UID:morning', 'DTSTART:20261105T080000Z', 'DTEND:20261105T100000Z'])
  const ended = vevent(['UID:ended', 'DTSTART:20261105T070000Z', 'DTEND:20261105T090000Z'])
  const inside = vevent(['UID:inside', 'DTSTART:20261105T100000Z', 'DTEND:20261105T110000Z'])
  const later = vevent(['UID:later', 'DTSTART:20261105T170000Z', 'DTEND:20261105T180000Z'])
  const events = morning + ended + inside + later

  it('returns the occurrences that start in the range by default', () => {
    assert.deepEqual(uids(events, slot), ['inside'])
    assert.deepEqual(uids(events, slot, 'start'), ['inside'])
  })

  it('also returns the occurrences already running at the start of the range in overlap mode', () => {
    assert.deepEqual(uids(events, slot, 'overlap'), ['morning', 'inside'])
  })

  it('returns the recurring occurrences that started before the range', () => {
    // Every Wednesday 20:00 for 14 hours, so until Thursday 10:00
    const weekly = vevent(['UID:weekly', 'DTSTART:20260930T200000Z', 'DURATION:PT14H', 'RRULE:FREQ=WEEKLY'])
    const [event] = new ICalendarEvents(calendar(weekly), slot, { rangeMode: 'overlap' }).events
    assert.equal(event.dtstart.toUTC().toISO(), '2026-11-04T20:00:00.000Z')
    assert.equal(event.dtend.toUTC().toISO(), '2026-11-05T10:00:00.000Z')
    assert.deepEqual(uids(weekly, slot), [])
  })

  it('counts the occurrences of the whole set with COUNT', () => {
    const daily = vevent(['UID:daily', 'DTSTART:20261103T080000Z', 'DTEND:20261103T100000Z', 'RRULE:FREQ=DAILY;COUNT=2'])
    assert.deepEqual(uids(daily, slot, 'overlap'), [])
    assert.deepEqual(uids(daily, range('2026-11-04T09:00', '2026-11-04T17:00'), 'overlap'), ['daily'])
  })

  it('uses the duration of each RDATE period', () => {
    const periods = vevent(['UID:periods', 'DTSTART:20261101T080000Z', 'DTEND:20261101T083000Z',
      'RDATE;VALUE=PERIOD:20261105T060000Z/20261105T093000Z,20261105T060000Z/PT1H'])
    const events = new ICalendarEvents(calendar(periods), slot, { rangeMode: 'overlap' }).events
    assert.deepEqual(events.map(event => event.dtend.toUTC().toISO()), ['2026-11-05T09:30:00.000Z'])
  })

  it('applies modified occurrences that started before the range', () => {
    const series = vevent(['UID:series', 'DTSTART:20261104T080000Z', 'DTEND:20261104T100000Z', 'RRULE:FREQ=DAILY;COUNT=3'])
    const moved = vevent(['UID:series', 'RECURRENCE-ID:20261105T080000Z', 'DTSTART:20261105T070000Z', 'DTEND:20261105T083000Z'])
    const extended = vevent(['UID:series', 'RECURRENCE-ID:20261104T080000Z', 'DTSTART:20261104T080000Z', 'DTEND:20261105T093000Z'])
    const events = new ICalendarEvents(calendar(series + moved + extended), slot, { rangeMode: 'overlap' }).events
    assert.deepEqual(events.map(event => event.dtstart.toUTC().toISO()), ['2026-11-04T08:00:00.000Z'])
    assert.equal(events[0].dtend.toUTC().toISO(), '2026-11-05T09:30:00.000Z')
  })

  it('treats occurrences without duration as instants', () => {
    const atStart = vevent(['UID:at-start', 'DTSTART:20261105T090000Z'])
    const before = vevent(['UID:before', 'DTSTART:20261105T080000Z', 'DTEND:20261105T080000Z'])
    const atEnd = vevent(['UID:at-end', 'DTSTART:20261105T170000Z'])
    assert.deepEqual(uids(atStart + before + atEnd, slot, 'overlap'), ['at-start'])
  })

  it('returns the all-day events covering the range', () => {
    const holiday = vevent(['UID:holiday', 'DTSTART;VALUE=DATE:20261020', 'DTEND;VALUE=DATE:20261110'])
    const previousDay = vevent(['UID:previous-day', 'DTSTART;VALUE=DATE:20261104'])
    assert.deepEqual(uids(holiday + previousDay, slot, 'overlap'), ['holiday'])
  })

  it('rejects an unknown mode', () => {
    assert.throws(() => new ICalendarEvents(calendar(events), slot, { rangeMode: 'end' }), /rangeMode/)
  })
})
