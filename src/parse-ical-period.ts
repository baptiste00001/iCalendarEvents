import { DateTime, Duration, Interval } from 'luxon'
import { parseDateString } from './parse-ical-datetime.js'


export function parseICalPeriod(line: string): Interval[] {

  let intervalList: Interval[] = []

  const lineUC: string = line.trim().toUpperCase()

  if(lineUC.includes("VALUE=PERIOD")) {
    // Case RDATE;VALUE=PERIOD:19960403T020000Z/19960403T040000Z,19960404T010000Z/PT3H
    //  or RDATE;VALUE=PERIOD;TZID=Asia/Tokyo:20230918T090000/20230918T100000,20230920T140000/20230920T150000,20230922T090000/20230922T100000 
    //  or RDATE;VALUE=PERIOD;TZID=Asia/Tokyo:20230918T090000/20230918T100000,20230920T140000/20230920T150000,20230922T090000/PT1H 
    //  for example

    const parts: string[] = line.split(":")
      if(parts.length < 2) throw new Error(`parseICalDateTime: Invalid DateTime ${line}`)

      let tzid: string | undefined = process.env.ICALEVENTS_LOCAL_TZ
      const firstPartUC: string = parts[0].replace(/tzid/,"TZID")
      if (firstPartUC.includes("TZID=")) {
        tzid = firstPartUC.split("TZID=")[1].split(";")[0].split(":")[0].trim()
      }

      // Multiple values separated by ","
      parts[1].split(",").forEach( (dateString: string): void => {
        intervalList.push(parsePeriodString(dateString, tzid))
      })

  } else {
    throw new Error(`parseICalPeriod: parsed data is not a period: ${line}`)
  }

  if(intervalList.length === 0 || !intervalList.every((interval: Interval) => interval !== null && interval.isValid)) {
    throw new Error(`parseICalPeriod: Invalid Period ${line}`)
  }

  return intervalList
}

function parsePeriodString(periodString: string, tzid?: string): Interval {
  if(!periodString.includes("/")) throw new Error(`parsePeriodString: period could not be parsed: ${periodString}`)

  const parts: string[] = periodString.split("/")
  if(parts.length < 2) throw new Error(`parsePeriodString: invalid period: ${periodString}`)

  const periodStart: DateTime = parseDateString(parts[0], tzid)
  let interval: Interval | null = null

  const secondPart: string = parts[1].trim().toUpperCase()
  if(secondPart.startsWith('P')) {
    // Case period-start of the form 19970101T180000Z/PT5H30M
    const duration: Duration = Duration.fromISO(secondPart)
    const periodEnd: DateTime = periodStart.plus(duration)
    interval = Interval.fromDateTimes(periodStart, periodEnd)
  } else {
    // Case period-explicit of the form 19970101T180000Z/19970102T070000Z
    const periodEnd: DateTime = parseDateString(secondPart, tzid)
    interval = Interval.fromDateTimes(periodStart, periodEnd)
  }

  if(!interval || !interval.isValid) throw new Error(`parsePeriodString: invalid period: ${periodString}`)

  return interval
}