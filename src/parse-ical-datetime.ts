import { DateTime } from 'luxon'

//TODO: 'local' time zone must be the time zone of the client, not the server's one !!
//TODO: display the dates in the time zone set in the BISettings or the one of the client ??
export function parseICalDateTime(line: string): DateTime[] {
      
  let dateTimeList: DateTime[] = []

  const lineUC: string = line.trim().toUpperCase()

  if(lineUC.includes("UNTIL=")) {
    //case UNTIL=20130130 or UNTIL=20130130T230000 or UNTIL=20130130T230000Z

    const parts: string[] = lineUC.split("UNTIL=")
    if(parts.length < 2) throw new Error(`parseICalDateTime: Invalid DateTime ${line}`)

    // UNTIL can have only 1 value
    dateTimeList.push(parseDateString(parts[1], null))
      
  } else if(line.includes(":")) {
    // Case DTSTART;TZID=Asia/Tokyo:20201027T163000 or DTSTART:20201027T163000 or DTSTART:20201027T163000Z
    // or RDATE;VALUE=DATE:19970304,19970504,19970704,19970904 
    // or EXDATE:20201027T163000Z,20201127T163000Z,20201227T163000Z
    // or RDATE;TZID=Asia/Tokyo:20201027T163000,20201127T163000,20201227T163000 for example
    // (case RDATE;VALUE=PERIOD is handled in parseICalPeriod function)

    const parts: string[] = line.split(":")
    if(parts.length < 2) throw new Error(`parseICalDateTime: Invalid DateTime ${line}`)


    let tzid: string | null = null
    if (parts[0].replace(/tzid/,"TZID").includes("TZID=")) {
      tzid = parts[0].split("TZID=")[1].split(";")[0].split(":")[0].trim()
    }

    //DTSTART;TZID=America/New_York:20070115T090000

    // Multiple values separated by ","
    parts[1].split(",").forEach( (dateString: string): void => {
      dateTimeList.push(parseDateString(dateString, tzid))
    })
  } else {
    throw new Error(`parseICalDateTime: datetime could not be parsed ${line}`)
  }

  if(dateTimeList.length === 0 || !dateTimeList.every((dateTime: DateTime) => dateTime !== null && dateTime.isValid)) {
    throw new Error(`parseICalDateTime: Invalid DateTime ${line}`)
  }

  return dateTimeList
}

export function parseDateString(dateString: string, tzid: string | null): DateTime {
  
  let dateStringTrimmed: string = dateString.trim().toUpperCase()

  if(dateStringTrimmed.match(/^\d{8}T\d{6}Z$/) !== null) {
    return DateTime.fromFormat(dateStringTrimmed, "yyyyMMdd'T'HHmmss'Z'", {zone: 'UTC'})

  } else if(dateStringTrimmed.match(/^\d{8}T\d{6}$/) !== null) {
    tzid = tzid ?? 'local'
    return DateTime.fromFormat(dateStringTrimmed, "yyyyMMdd'T'HHmmss", {zone: tzid})

  } else if(dateStringTrimmed.match(/^\d{8}$/) !== null) {
    //Date so Time zone is set to UTC
    const date: DateTime = DateTime.fromFormat(dateStringTrimmed, "yyyyMMdd", {zone: 'UTC'})
    date.isDate = true
    return date
  } else {
    throw new Error(`parseICalDateTime: datetime could not be parsed: ${dateString}`)
  }
}