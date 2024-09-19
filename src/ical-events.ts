import { type Event}  from './event.js'
import { DateTime, Interval } from 'luxon'
import { VEvent } from './vevent.js'
import './luxon-extensions.js'

export type iCalParserOptions = {
  // return the raw list of parsed VEVENTs too
  withVEvent?: boolean, 

  // client's local time zone to use instead of 'local'
  // because 'local' is the time zone of the server where the code is running.
  // e.g. 'America/New_York'
  localTZ?: string, 

  // always include DTSTART in the recurrence set even if it does not match RRULE.
  // it can still be excluded by EXDATE.
  includeDTSTART?: boolean,
}

export class ICalEvents {
  // All Events in the given date range sorted by day and with reccurence expanded.
  days: Map<string, Event[]>

  // All Events in the given date range with reccurence expanded
  events: Event[]

  // Optional raw list of vevents. For debugging purpose mostly.
  vevents: VEvent[] = []


  // Parse string iCalendar data and build the ICalendar vevents
  constructor(data: string, dateRange?: Interval, options?: iCalParserOptions) {

    process.env.ICALEVENTS_LOCAL_TZ = options?.localTZ ?? 'local';

    let range: Interval
    if(!dateRange) {
      // Default Range is [start of current month - 1 year later]
      // Time Zone is set to UTC with the same time to avoid overflowing to previous or next day in local time zone
      const firstDate: DateTime = DateTime.now().setZone('UTC', {keepLocalTime: true}).startOf('month')
      const lastDate: DateTime = firstDate.plus({months:11}).endOf('month')
      range = Interval.fromDateTimes(firstDate, lastDate)
    } else {
      range = dateRange
    }

    if(!range || !range.isValid) throw new Error(`ICalEvents constructor: range is invalid: ${range.invalidReason}`)

    // Create map<string, Event[]> with dates (keys) initialized/sorted, and empty values
    this.days = new Map<string, Event[]>()

    // Pre-set the keys to have them in order
    const start: DateTime | null = range.start
    if(start === null) throw new Error(`ICalEvents constructor: could not get the start of range`)
    
    let currentDate: DateTime = start
    while(range.contains(currentDate)) {
      const dateString: string | null = currentDate.toISODate()
      if(dateString !== null) {
        this.days.set(dateString, [])
      }
      currentDate = currentDate.plus({days: 1})
    }

    // Then add the events as they are parsed
    // We don't read the VTIMEZONE, instead we just use the standard Olson TZID
    const eventsData: string[] = data.split('BEGIN:VEVENT')
    eventsData.forEach((eventData) => {
      if (eventData.includes('END:VEVENT')) {

        let vevent: VEvent | null = null 
        try {
          vevent = new VEvent(eventData)
        } catch(e: any) {
          console.error("ICalEvents constructor", `Could not parse VEVENT`)
          console.error("ICalEvents constructor", e)
        } 

        // if event is not null and has a start date, expand recurrences if applicable 
        // then push all events between firsDate and endDate in this.days 
        if(vevent && vevent.dtstart !== undefined) {

          if(options?.withVEvent) this.vevents.push(vevent)

          // Add recurring events that fall in the range
          let allEvents: Event[] = vevent.expandRecurrence(range, options?.includeDTSTART)

          // push the events into this.days
          for(const event of allEvents) {
            const dateString: string = event.dtstart.toISODate() ?? ""
            
            if(!this.days.has(dateString)) {
              console.error(`ICalEvents constructor: key=${dateString} undefined in the map`)
              return
            }

            this.days.get(dateString)?.push(event)    
          }
        }
      }
    }) 
    
    this.events = []

    this.days.forEach((value, key) => {
      value.forEach(event => {
        this.events.push(event)
      })
    })
  }
}