# iCalEvents
A RFC5545 compliant parser for iCalendar VEVENT with time zone support and accurate recurring events generation.

`
import { ICalEvents } from '@bt.l/ical-events'
import { DateTime, Interval } from 'luxon'

// Get the iCalendar data from an url (using fetch) or from a file (using fs)
// Here we use an example
const data = "\
BEGIN:VCALENDAR\n\
BEGIN:VEVENT\n\
CREATED:20240817T085751Z\n\
DTSTAMP:20240821T003640Z\n\
LAST-MODIFIED:20240821T003640Z\n\
SEQUENCE:5\n\
UID:172a399f-b2c6-44e4-9b06-9c70356dabd2\n\
STATUS:CONFIRMED\n\
SUMMARY:test repeating hour event\n\
LOCATION:loc\n\
DESCRIPTION:desc\n\
DURATION:PT1H\n\
DTSTART;TZID=America/New_York:20241005T090000\n\
RRULE:FREQ=MONTHLY;BYMONTHDAY=20,23;COUNT=10\n\
END:VEVENT\n\
END:VCALENDAR"

const firstDate: DateTime = DateTime.fromFormat("20241005T090000", "yyyyMMdd'T'HHmmss", {zone: 'America/New_York'}).startOf('month')
const lastDate: DateTime = firstDate.plus({months:2}).endOf('month')
const range = Interval.fromDateTimes(firstDate, lastDate)

const iCalEvents = new ICalEvents(data, range, {withVEvent: true})

console.log(iCalEvents.days)

console.log(iCalEvents.vevents.toString())
`