import { type Event}  from './event'
import { DateTime, Interval } from 'luxon'
import './luxon-extensions'
import { VEvent } from './vevent'
import { inspect } from 'util'
import { randomUUID } from 'crypto'


export class ICalEvents {
  //Change to Array<Event[]> or Day[] maybe ?
  //Model
  public days: Map<string, Event[]>


  //Parse string iCal data and build the ICal vevents
  //TODO: Add case RDATE is a period instead of a DATE or DATE-TIME -> use luxon interval
  constructor(data: string[]) { //iCal: {info: CalendarInfo, data: string}[]) {

    //create map<string, Event[]> with dates (keys) initialized/sorted, and empty values
    this.days = new Map<string, Event[]>()

    //find first date and last date to display. Time Zone is set to UTC to avoid overflowing to previous or next day in local time zone
    const firstDate: DateTime = DateTime.utc(1996,1,1).setZone('America/New_York', {keepLocalTime: true})
    const lastDate: DateTime = firstDate.plus({years: 30})
    
    // const firstDate: DateTime = DateTime.now().setZone('UTC', {keepLocalTime: true}).minus({months: 2})// .startOf('month')
    // const lastDate: DateTime = DateTime.now().setZone('UTC', {keepLocalTime: true}).plus({months:2})// firstDate.plus({months: 1}).endOf('month')

    const range: Interval = Interval.fromDateTimes(firstDate, lastDate)

    if(!range.isValid) {
        throw new Error(`ICalEvents constructor: range is invalid: ${range.invalidReason}`)
    }
    

    //pre-set the keys to have them in order
    let currentDate: DateTime = firstDate
    while(range.contains(currentDate)) {
      const dateString: string | null = currentDate.toISODate()
      if(dateString !== null) {
        this.days.set(dateString, [])
      }
      currentDate = currentDate.plus({days: 1})
    }

    //Then add the events as they are parsed
    //We don't get the VTIMEZONE, instead we just use the standard Olson TZID
   
    const calendarID = randomUUID()
    const eventsData: string[] = data[0].split('BEGIN:VEVENT')

    eventsData.forEach((eventData) => {
      if (eventData.includes('END:VEVENT')) {

        let vevent: VEvent | null = null 
        try {
          vevent = new VEvent(eventData, calendarID)
        } catch(e: any) {
          console.error("ICalEvents constructor", `Could not parse VEVENT`)
          console.error("ICalEvents constructor", e)
        } 

        // if event is not null and has a start date, expand recurrences if applicable 
        // then push all events between firsDate and endDate in this.days 
        if(vevent && vevent.dtstart !== undefined) {

          console.log(`vevent: \n ${vevent.toString()}`)

          // Add recurring events that fall in the range
          let allEvents: Event[] = vevent.expandRecurrence(range)

          console.log(`range: ${range.toISO()} \n`)
          console.log(inspect(allEvents))

          // push the events into this.days
          for(const event of allEvents) {
            const dateString: string = event.dtStart.substring(0,10)
            
            if(!this.days.has(dateString)) {
              console.error(`ICalEvents constructor: key=${dateString} undefined in the map`)
              return
            }

            this.days.get(dateString)?.push(event)    
          }
        }
      }
    })       
  }
}