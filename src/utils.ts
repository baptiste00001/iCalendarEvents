import { DateTime, type DateTimeUnit, type WeekdayNumbers } from "luxon"

export function toSQL(dateTime: DateTime): string | null {
  if(dateTime.isDate) {
      return dateTime.toSQLDate()
  } else {
      return dateTime.toSQL({ includeZone: true })
  }
}

export function setSmallUnits(dateTime: DateTime,  origin: DateTime, upTo: DateTimeUnit): DateTime {
  
  switch(upTo) {
    case "millisecond":
      return dateTime.set({millisecond: origin.millisecond})
    case "second":
      return dateTime.set({millisecond: origin.millisecond, second: origin.second})
    case "minute":
      return dateTime.set({millisecond: origin.millisecond, second: origin.second, minute: origin.minute})
    case "hour":
      return dateTime.set({millisecond: origin.millisecond, second: origin.second, minute: origin.minute, hour: origin.hour})
    case "day":
      return dateTime.set({millisecond: origin.millisecond, second: origin.second, minute: origin.minute, hour: origin.hour, day: origin.day})
    case "week":
      return dateTime.set({millisecond: origin.millisecond, second: origin.second, minute: origin.minute, hour: origin.hour, localWeekday: origin.localWeekday as WeekdayNumbers, localWeekNumber: origin.localWeekNumber})
    case "month":
      return dateTime.set({millisecond: origin.millisecond, second: origin.second, minute: origin.minute, hour: origin.hour, day: origin.day, month: origin.month})
    case "year":
      return dateTime.set({millisecond: origin.millisecond, second: origin.second, minute: origin.minute, hour: origin.hour, day: origin.day, month: origin.month, year: origin.year})
    default:
      throw new Error(`DateTime setSmallUnits: invalid unit: ${upTo}`)
  }
}

export function　plusUnit(dateTime: DateTime, unit: DateTimeUnit, interval: number): DateTime {

  switch(unit) {
    case "second":
      return dateTime.plus({seconds: interval})
    case "minute":
      return dateTime.plus({minutes: interval})
    case "hour":
      return dateTime.plus({hours: interval})
    case "day":
      return dateTime.plus({days: interval})
    case "week":
      return dateTime.plus({weeks: interval})
    case "month":
      return dateTime.plus({months: interval})
    case "year":
      return dateTime.plus({years: interval})
    default:
      throw new Error(`DateTime plusUnit: invalid unit: ${unit}`)
  }
}