import { DateTime, Duration, Interval } from 'luxon'
import { RRule } from './rrule'
import { parseICalDateTime } from './parse-ical-datetime'
import { parseICalPeriod } from './parse-ical-period'
import { UUID } from 'crypto'
import { Event } from './event'

export class VEvent {
  uuid?: UUID
  dtstart?: DateTime
  dtend?: DateTime
  duration?: Duration
  summary?: string
  location?: string
  description?: string
  rrule?: RRule
  rdates: (DateTime | Interval)[] = []
  exdates: DateTime[] = []
  calendarID: UUID

  constructor(eventData: string, calendarID: UUID) {
    
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
  
    this.calendarID = calendarID
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
        this.uuid = line.split(":")[1] as UUID
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
  }

  toString(): string {

    return `
      uuid: ${this.uuid} \n
      dtstart: ${this.dtstart?.toSQLString()} \n
      dtend: ${this.dtend?.toSQLString()} \n
      duration: ${this.duration?.toString()} \n
      summary: ${this.summary} \n
      location: ${this.location} \n
      description: ${this.description} \n
      rrule: ${this.rrule?.toString()} \n
      rdate: ${
        (this.rdates).map<string>((rdate: DateTime | Interval): string=>{
          if(rdate instanceof DateTime) {
            return rdate.toSQLString() ?? ""
          } else {
            return rdate.toISO()
          }
        }).reduce((p,c): string=> {return p +((p === "") ? "" : ",")+ c},"")
      } \n
      exdate: ${(this.exdates).map<string>((i:DateTime): string=>{return i.toSQLString() ?? ""}).reduce((p,c): string=> {return p +((p === "") ? "" : ",")+ c},"")} \n
      calendarID: ${this.calendarID}
      `
  }

  // create corresponding event calculating the appropriate end time using original event duration
  // period is for the case RDATE is a period, we use that duraiton instead
  private toEvent(newStartDate: DateTime, period?: Duration | null): Event | null {
    if(this.dtstart === undefined) return null

    let endDate: DateTime | null = null
    if(period !== undefined && period !== null) {
      endDate = newStartDate.plus(period)
    } else if(this.dtend !== undefined) {
      endDate = newStartDate.plus(Duration.fromDurationLike(this.dtend.diff(this.dtstart)))
    } else if (this.duration !== undefined) {
      endDate = newStartDate.plus(this.duration)
    } else { // case there is neither DTEND nor DURATION then event is 1 day by default
      endDate = this.dtstart.plus({days: 1})
    }

    if(endDate === null || !endDate.isValid) return null

    endDate.isDate = this.dtstart.isDate
    
    return  {
      uuid: this.uuid,
      dtStart: newStartDate.toSQLString(),
      dtEnd: endDate.toSQLString(),
      summary: this.summary,
      location: this.location,
      description: this.description,
      calendarID: this.calendarID
    } as Event
  }

  // Method to expand recurrence rules and generate all event occurrences
  //1. find all start dates from RRULE and RDATE. (DTSTART is also included in the set)
  //2. Do not include start dates that are in EXDATE.
  //3. Build events from the list of start dates, and using the duration in the original event 
  // duration = (DTEND - DTSTART) or (DURATION) or (RDATE if period)
  expandRecurrence ( range: Interval ) : Event[] {

    const events: Event[] = []

    if(this.dtstart === undefined || range.isBefore(this.dtstart)) return events

    // Add DTSTART into the set
    if(range.contains(this.dtstart) && !this.isExcluded(this.dtstart)) {
      const event: Event | null = this.toEvent(this.dtstart)
      
      if(event === null) {
        console.error("VEvent expandRecurrence: event could not be created from start date")
      } else {
        events.push(event)
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
            const event: Event | null = this.toEvent(currentDateTime)
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

        const event: Event | null = this.toEvent(rdateStartDate, duration)
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

  isExcluded(startDateTime: DateTime): boolean {
    return (this.exdates.some((exdate: DateTime) => exdate.valueOf() === startDateTime.valueOf()))
  }
}