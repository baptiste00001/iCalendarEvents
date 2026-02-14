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
          let allEvents: ICEvent[] = vevent.expandRecurrence(range, options?.includeDTSTART)

          this.events.push(...allEvents)
        }
      }
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

// TODO: add RECURRENCE-ID override support to update specific instances of recurring events.
//       Grok gives pseudocode below. Must implement.

// The reason to **expand the recurrence set first** (using `rruleSet.between(...)` with `RRULE`, `RDATE`, `EXDATE` applied) and **then** check for `RECURRENCE-ID` overrides is rooted in how the iCalendar specification (RFC 5545) and real CalDAV servers (like iCloud) actually model and deliver recurring events.

// ### Core iCalendar Rules for Recurring Events + Overrides

// - The **master VEVENT** (no `RECURRENCE-ID`) defines the recurrence set via:
//   - `DTSTART` (anchor)
//   - `RRULE` (the repeating pattern)
//   - `RDATE` (additional explicit dates)
//   - `EXDATE` (explicit exclusions from the generated set)
// - The recurrence set is the list of **candidate instance start times** produced by those rules.
// - **Overrides** (modified/canceled/moved individual instances) are stored as **separate VEVENT components** (often in separate `.ics` files/objects on CalDAV):
//   - They **share the same UID** as the master.
//   - They **must include** a `RECURRENCE-ID` property — this points to the original (would-be) start date/time of the instance being overridden.
//   - They **must not** contain `RRULE`, `RDATE`, or `EXDATE` — overrides are leaf nodes.
// - `EXDATE` only removes instances from the **generated recurrence set** — it does **not** handle overrides (which are separate components).

// ### Why Expand First, Then Apply Overrides

// 1. **The base recurrence set must respect `EXDATE` and `RDATE`**  
//    → You generate all "normal" occurrences using the master's rules (including exclusions via `exdate()` and additions via `rdate()`).  
//    → This gives you the correct list of dates that would exist **without** any per-instance modifications.

// 2. **Overrides are not part of the recurrence rule — they are exceptions to specific generated instances**  
//    → A `RECURRENCE-ID: 2026-02-27T10:00:00` means: "The instance that **would have** started at 2026-02-27 10:00 is now modified (or canceled)".  
//    → To know which instance is being overridden, you first need to know what instances the rule would produce.  
//    → If you applied overrides **before** expansion, you'd have no way to match them — because you wouldn't know the original candidate dates yet.

// 3. **Cancellation via override (deleted instance)**  
//    → If an override VEVENT has `STATUS:CANCELLED` (or sometimes just exists with minimal properties), it means **remove** that instance.  
//    → You need to generate the candidate first → then see if there's an override with matching `RECURRENCE-ID` → if yes and it's canceled → drop it.

// 4. **Real-world CalDAV / iCloud behavior**  
//    - Servers return the **master** + **only the overridden instances** that fall (or would fall) in/near your query range.  
//    - They do **not** return overrides for dates outside your range (optimization).  
//    - They do **not** auto-expand the full series (except in rare cases when you use `<CALDAV:expand>` in the REPORT — which iCloud often ignores or limits).  
//    → Client must do the expansion → then merge in the overrides it actually received.

// ### Correct Processing Order (Standard Pattern in Calendar Libraries)

// Most robust iCalendar/CalDAV clients follow roughly this sequence:

// 1. Parse the master VEVENT → extract `RRULE`, `RDATE`, `EXDATE`, duration, etc.
// 2. Build `RRuleSet` → add rule, rdate(s), exdate(s).
// 3. Generate candidate occurrences in your query range: `rruleSet.between(start, end, true)`.
// 4. Collect all override VEVENTs (same UID, have `RECURRENCE-ID`).
// 5. For each generated occurrence:
//    - Compute its original start time (the candidate).
//    - Look for an override whose `RECURRENCE-ID` matches that start time (exact match, including timezone awareness).
//    - If found:
//      - Use the override's properties (new `DTSTART`/`DTEND`, `SUMMARY`, `LOCATION`, etc.) instead of master's.
//      - If override is canceled → skip this occurrence.
//    - If no override → use master's properties + the generated start time + original duration.
// 6. Also handle rare cases where an override exists **without** a matching generated date (e.g., added via `RDATE` in override, but usually rare).

// ### Pseudo-code Refinement

// ```ts
// // 1. Expand the "normal" recurrence set (applies RRULE + RDATE + EXDATE)
// const candidates = rruleSet.between(queryStart, queryEnd, true);

// // 2. Build a map of overrides by their RECURRENCE-ID (normalized to comparable Date/time)
// const overridesByRecurrenceId = new Map();
// for (const overrideObj of otherEventsWithSameUid) {
//   const overrideVevent = /* parse */;
//   const recurrenceId = overrideVevent.getFirstPropertyValue('recurrence-id').toJSDate(); // normalize!
//   overridesByRecurrenceId.set(recurrenceId.getTime(), overrideVevent); // use timestamp for key
// }

// // 3. Build final events
// const finalEvents = candidates.map(occ => {
//   const occTime = occ.getTime();
//   const override = overridesByRecurrenceId.get(occTime);

//   if (override) {
//     if (override.getFirstPropertyValue('status') === 'CANCELLED') {
//       return null; // drop canceled
//     }
//     // Use override properties
//     return {
//       start: override.getFirstPropertyValue('dtstart').toJSDate(),
//       end: override.getFirstPropertyValue('dtend').toJSDate(),
//       summary: override.getFirstPropertyValue('summary'),
//       // ... other props from override
//       isOverride: true,
//     };
//   }

//   // Normal instance from master
//   return {
//     start: occ,
//     end: new Date(occ.getTime() + masterDurationMs),
//     summary: masterSummary,
//     // ...
//   };
// }).filter(e => e !== null); // remove canceled
// ```

// This is why the check comes **after** expansion — you need the expanded candidates to know **which** original instance each `RECURRENCE-ID` is referring to.

// If you tried it the other way around (overrides first), you'd lose the ability to correctly match, exclude, or replace instances that the rule would otherwise produce.
