import { DateTime, Duration, Interval } from 'luxon'
import { RRule } from './rrule.js'
import { parseICalDateTime } from './parse-ical-datetime.js'
import { parseICalPeriod } from './parse-ical-period.js'
import { ICEvent } from './icevent.js'
import { toSQL } from './utils.js'


export class VEvent {
  uid?: string
  dtstart?: DateTime
  dtend?: DateTime
  duration?: Duration
  summary?: string
  location?: string
  description?: string
  rrule?: RRule
  rdates: (DateTime | Interval)[] = []
  exdates: DateTime[] = []
  transp?: string

  constructor(eventData: string) {
    
    const lines = eventData.split('\n')

    this.rdates = []
    this.exdates = []
  
    let currentLine = ''
  
    for(const line of lines) {
  
      if (line.startsWith(' ')) {
        currentLine += line.trim()  // Handle multi-line continuation
  
      } else if (line.trim().startsWith('END:VEVENT')) {
          break
  
      } else {
        if (currentLine) this.parseEventLine(currentLine)
        currentLine = line.trim()
      }
    }
  
    if (currentLine) this.parseEventLine(currentLine)
    
    if(this.dtstart === undefined) throw new Error(`VEvent constructor: couldn't parse start date: \n ${eventData}`)
  }

  private parseEventLine(line: string) {

    const lineUC: string = line.toUpperCase()

    if(lineUC.startsWith("DESCRIPTION")) {
        this.description = line.split(":")[1]
        return
    }
  
    if(lineUC.startsWith("DTEND")) {
        try {
            //There is only 1 date in DTEND
            this.dtend = parseICalDateTime(line)[0]
        } catch (e: any) {
            console.error("VEvent", `Could not parse dtend: ${line}`)
            console.error("VEvent", e)
        }
        return
    }

    if(lineUC.startsWith("DURATION")) {
      this.duration = Duration.fromISO(line.split(":")[1])
    }
  
    if(lineUC.startsWith("DTSTART")) {
        try {
            //There is only 1 date in DTSTART
            this.dtstart = parseICalDateTime(line)[0]
        } catch (e: any) {
            console.error("VEvent", `Could not parse dtstart: ${line}`)
            console.error("VEvent", e)
        }
        return
    }
  
    if(lineUC.startsWith("SUMMARY")) {
        this.summary = line.split(":")[1]
        return
    }

    if(lineUC.startsWith("LOCATION")) {
      this.location = line.split(":")[1]
      return
  }
  
    if(lineUC.startsWith("UID")) {
        this.uid = line.split(":")[1]
        return
    }
  
    if(lineUC.startsWith("RRULE")) {
        try {
            this.rrule = new RRule(line)
        } catch (e: any) {
            console.error("VEvent", `Could not parse rrule: ${line}`)
            console.error("VEvent", e)
        } 
        return
    }
  
    if(lineUC.startsWith("RDATE")) {
        try {
          if(lineUC.includes("VALUE=PERIOD")) {
            // Parse period (Interval)
            parseICalPeriod(line).forEach(period => {
              this.rdates.push(period)
            })
          } else {
            // Parse DateTime (DateTime)
            parseICalDateTime(line).forEach(date => {
              this.rdates.push(date)
            })
          }
        } catch (e: any) {
            console.error("VEvent", `Could not parse rdate: ${line}`)
            console.error("VEvent", e)
        }
        return
    }
  
    if(lineUC.startsWith("EXDATE")) {
        try {
          parseICalDateTime(line).forEach(date => {
                this.exdates.push(date)
            })
        } catch (e: any) {
            console.error("VEvent", `Could not parse exdate: ${line}`)
            console.error("VEvent", e)
        }
        return
    }

    if(lineUC.startsWith("TRANSP")) {
      this.transp = line.split(":")[1]
    }
  }

  toString(): string {

    return `
      uuid: ${this.uid} \n
      dtstart: ${this.dtstart ? toSQL(this.dtstart) : ""} \n
      dtend: ${this.dtend ? toSQL(this.dtend) : ""} \n
      duration: ${this.duration?.toString()} \n
      summary: ${this.summary} \n
      location: ${this.location} \n
      description: ${this.description} \n
      rrule: ${this.rrule?.toString()} \n
      rdate: ${
        (this.rdates).map<string>((rdate: DateTime | Interval): string=>{
          if(rdate instanceof DateTime) {
            return toSQL(rdate) ?? ""
          } else {
            return rdate.toISO()
          }
        }).reduce((p,c): string=> {return p +((p === "") ? "" : ",")+ c},"")
      } \n
      exdate: ${(this.exdates).map<string>((i:DateTime): string=>{return toSQL(i) ?? ""}).reduce((p,c): string=> {return p +((p === "") ? "" : ",")+ c},"")} \n
      `
  }

  // create corresponding event calculating the appropriate end time using original event duration
  // period is for the case RDATE is a period, we use that duraiton instead
  private toEvent(newStartDate: DateTime, period?: Duration | null): ICEvent | null {
    if(this.dtstart === undefined) return null

    let endDate: DateTime | null = null
    if(period !== undefined && period !== null) {
      endDate = newStartDate.plus(period)
    } else if(this.dtend !== undefined) {
      endDate = newStartDate.plus(Duration.fromDurationLike(this.dtend.diff(this.dtstart)))
    } else if (this.duration !== undefined) {
      endDate = newStartDate.plus(this.duration)
    } else { 
      // case where there is neither DTEND nor DURATION then event duration is 1 day by default.
      // RFC specifications state: 
        //   The "DTSTART" property for a "VEVENT" specifies the inclusive
        // start of the event.  For recurring events, it also specifies the
        // very first instance in the recurrence set.  The "DTEND" property
        // for a "VEVENT" calendar component specifies the non-inclusive end
        // of the event.  ******* For cases where a "VEVENT" calendar component
        // specifies a "DTSTART" property with a DATE value type but no
        // "DTEND" nor "DURATION" property, the event's duration is taken to
        // be one day.  For cases where a "VEVENT" calendar component
        // specifies a "DTSTART" property with a DATE-TIME value type but no
        // "DTEND" property, the event ends on the same calendar date and
        // time of day specified by the "DTSTART" property. *******
      if(this.dtstart.isDate) {
        endDate = newStartDate.plus({days: 1})
      } else {
        // just add 1 millisecond to the start date instead of 
        // returning the exact same calendar date and time 
        // to avoid problems because dtend is non-inclusive
        endDate = newStartDate.plus({milliseconds: 1})
      }
    }

    if(endDate === null || !endDate.isValid) return null

    endDate.isDate = this.dtstart.isDate
    
    return  {
      uid: this.uid,
      dtstart: newStartDate,
      dtend: endDate,
      summary: this.summary,
      location: this.location,
      description: this.description,
      allday: this.dtstart.isDate ?? false,
      transp: this.transp
    } as ICEvent
  }

  // Method to expand recurrence rules and generate all event occurrences
  //1. find all start dates from RRULE and RDATE. (DTSTART is also included in the set)
  //2. Do not include start dates that are in EXDATE.
  //3. Build events from the list of start dates, and using the duration in the original event 
  // duration = (DTEND - DTSTART) or (DURATION) or (RDATE if period)
  expandRecurrence ( range: Interval, includeDTSTART: boolean = false ) : ICEvent[] {

    const events: ICEvent[] = []

    if(this.dtstart === undefined || range.isBefore(this.dtstart)) return events

    // Add DTSTART into the set
    if(range.contains(this.dtstart) && !this.isExcluded(this.dtstart)) {
      if (includeDTSTART || !this.rrule || this.rrule.matchesRRule(this.dtstart)) {
        const event: ICEvent | null = this.toEvent(this.dtstart)
        
        if(event === null) {
          console.error("VEvent expandRecurrence: event could not be created from start date")
        } else {
          events.push(event)
        }
      }
    }

    if(this.rrule !== undefined) {
      let currentDateTime: DateTime = this.dtstart

      // Advance until next date in the range
      range.isAfter
      try {
        do {
          currentDateTime = this.rrule.advanceDate(currentDateTime)
          if(range.isBefore(currentDateTime)) return events
        } while(!range.contains(currentDateTime))
      } catch(e: any) {
        console.error(`VEvent expandRecurrence: could not advance date:`)
        console.error(e)
        return events
      }

      const until: DateTime | null = this.rrule.until
      const count: number | null = this.rrule.count

      // Loop to find all recurrences
      while ((until === null || currentDateTime <= until) && (count === null || events.length < count) && range.contains(currentDateTime)) {
        if (!this.isExcluded(currentDateTime)) {
          if (this.rrule.matchesRRule(currentDateTime)) {
            const event: ICEvent | null = this.toEvent(currentDateTime)
            if(event === null) {
              console.error("VEvent expandRecurrence: event could not be created from new start date")
            } else {
              events.push(event)
            }
          }
        }
        try {
          currentDateTime = this.rrule.advanceDate(currentDateTime)
        } catch(e: any) {
          console.error(`VEvent expandRecurrence: could not advance date:`)
          console.error(e)
          break
        }
      }
    }

    
    this.rdates.forEach((rdate: DateTime | Interval) => {
      const rdateStartDate: DateTime | null = (rdate instanceof Interval) ? rdate.start : rdate

      if(rdateStartDate === null) {
        console.error(`VEvent expandRecurrence: could not get RDATE start date`)
        return
      }

      if(!range.contains(rdateStartDate)) return

      if (!this.isExcluded(rdateStartDate)) {
        const duration: Duration | null = (rdate instanceof Interval) ? rdate.toDuration() : null

        const event: ICEvent | null = this.toEvent(rdateStartDate, duration)
        if(event === null) {
          console.error("expandRecurrence: event could not be created from RDATE")
        }
        else {
          events.push(event)
        }
      }
    });

    return events

  }

  private isExcluded(startDateTime: DateTime): boolean {
    return (this.exdates.some((exdate: DateTime) => exdate.valueOf() === startDateTime.valueOf()))
  }
}