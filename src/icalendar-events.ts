import { type ICEvent}  from './icevent.js'
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


export class ICalendarEvents {
  // All Events in the given date range sorted, with reccurence expanded
  events: ICEvent[]

  // Optional raw list of vevents sorted. For debugging purpose mostly.
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

    this.events = []

    // Add the events as they are parsed
    // We don't read the VTIMEZONE, instead we just use the standard Olson TZID
    const eventsData: string[] = data.split('BEGIN:VEVENT')
    
    // First pass: parse all VEVENTs and separate masters from overrides
    const masterEvents: VEvent[] = []
    const overrideEvents: Map<string, VEvent[]> = new Map() // Map of UID -> list of overrides
    
    eventsData.forEach((eventData) => {
      if (eventData.includes('END:VEVENT')) {

        let vevent: VEvent | null = null 
        try {
          vevent = new VEvent(eventData)
        } catch(e: any) {
          console.error("ICalEvents constructor", `Could not parse VEVENT`)
          console.error("ICalEvents constructor", e)
        } 

        if(vevent && vevent.dtstart !== undefined) {
          if(options?.withVEvent) this.vevents.push(vevent)
          
          // Check if this is an override event (has RECURRENCE-ID)
          if(vevent.isException()) {
            // Collect overrides by UID
            const uid = vevent.uid ?? 'no-uid'
            if(!overrideEvents.has(uid)) {
              overrideEvents.set(uid, [])
            }
            overrideEvents.get(uid)!.push(vevent)
          } else {
            // This is a master event or single event
            masterEvents.push(vevent)
          }
        }
      }
    })
    
    // Second pass: expand masters and apply overrides
    masterEvents.forEach((vevent) => {
      // Expand the master event's recurrence
      let expandedEvents: ICEvent[] = vevent.expandRecurrence(range, options?.includeDTSTART)
      
      // Apply any overrides for this event's UID
      const uid = vevent.uid ?? 'no-uid'
      const overrides = overrideEvents.get(uid) ?? []
      
      // For each override, find and replace matching occurrences
      overrides.forEach((override) => {
        const recurrenceId = override.getRecurrenceIdDate()
        if(recurrenceId) {
          // Find the matching occurrence in expandedEvents
          const matchIndex = expandedEvents.findIndex(
            event => event.dtstart.valueOf() === recurrenceId.valueOf()
          )
          
          if(matchIndex !== -1) {
            // If this override is canceled, remove the occurrence
            if(override.status?.toUpperCase() === 'CANCELLED') {
              expandedEvents.splice(matchIndex, 1)
              return
            }

            // Check if override has higher sequence number
            if(override.getSequence() >= vevent.getSequence()) {
              // Replace with override's event
              const overrideExpandedEvents = override.expandRecurrence(range, options?.includeDTSTART)
              if(overrideExpandedEvents.length > 0) {
                expandedEvents[matchIndex] = overrideExpandedEvents[0]
              }
            }
          }
        }
      })
      
      this.events.push(...expandedEvents)
    })

    this.vevents.sort((vevent1, vevent2) => {
      if(vevent1.dtstart === undefined || vevent2.dtstart === undefined) return 0

      return vevent1.dtstart.valueOf() - vevent2.dtstart.valueOf()
    })

    this.events.sort((event1, event2) => {
      return event1.dtstart.valueOf() - event2.dtstart.valueOf()
    })
  }
}

// RECURRENCE-ID override support has been implemented (March 2026)
// 
// Implementation follows RFC 5545 specification for handling recurring events with exceptions:
// 
// 1. Master events (no RECURRENCE-ID) are expanded using RRULE, RDATE, and EXDATE
// 2. Override events (with RECURRENCE-ID) are collected by UID
// 3. For each override, the matching occurrence is found by comparing RECURRENCE-ID with generated event start times
//   Note: RECURRENCE-ID is the original start time of the occurrence being overridden, not the new start time in the override event
//   Note2: the check comes **after** expansion — you need the expanded candidates to know **which** original instance each `RECURRENCE-ID` is referring to.
// 4. The override replaces the occurrence if its SEQUENCE number is >= the master's SEQUENCE
// 
// The VEvent, RRule, and ICEvent classes have been updated to:
// - Parse and store RECURRENCE-ID (as DateTime) and SEQUENCE (as number)
// - Provide helper methods: isException(), getRecurrenceIdDate(), getSequence()
// - Return events with exception dates as single occurrences via expandRecurrence()
// 
// This approach correctly handles:
// - Modified instances (override with different properties replaces the occurrence)
// - Moved instances (override has different DTSTART)
// - Canceled instances (can be detected and handled at higher levels)
// - Version conflicts (SEQUENCE determines which version takes precedence)