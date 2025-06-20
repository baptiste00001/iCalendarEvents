import { DateTime, DateTimeUnit, WeekdayNumbers } from 'luxon'

declare module 'luxon' {
  export interface DateTime {

    isDate?: boolean

    toSQLString(): string | null

    plusUnit(unit: DateTimeUnit, interval: number): DateTime

    setSmallUnits(from: DateTime, strictlyUnder: DateTimeUnit): DateTime

  }
}

DateTime.prototype.toSQLString = function(): string | null {
  if(this.isDate) {
      return this.toSQLDate()
  } else {
      return this.toSQL({ includeZone: true })
  }
}



DateTime.prototype.setSmallUnits = function(from: DateTime, upTo: DateTimeUnit): DateTime {
  
  switch(upTo) {
    case "millisecond":
      return this.set({millisecond: from.millisecond})
    case "second":
      return this.set({millisecond: from.millisecond, second: from.second})
    case "minute":
      return this.set({millisecond: from.millisecond, second: from.second, minute: from.minute})
    case "hour":
      return this.set({millisecond: from.millisecond, second: from.second, minute: from.minute, hour: from.hour})
    case "day":
      return this.set({millisecond: from.millisecond, second: from.second, minute: from.minute, hour: from.hour, day: from.day})
    case "week":
      return this.set({millisecond: from.millisecond, second: from.second, minute: from.minute, hour: from.hour, localWeekday: from.localWeekday as WeekdayNumbers, localWeekNumber: from.localWeekNumber})
    case "month":
      return this.set({millisecond: from.millisecond, second: from.second, minute: from.minute, hour: from.hour, day: from.day, month: from.month})
    case "year":
      return this.set({millisecond: from.millisecond, second: from.second, minute: from.minute, hour: from.hour, day: from.day, month: from.month, year: from.year})
    default:
      throw new Error(`DateTime setSmallUnits: invalid unit: ${upTo}`)
  }
}

DateTime.prototype.plusUnit = function(unit: DateTimeUnit, interval: number): DateTime {

  switch(unit) {
    case "second":
      return this.plus({seconds: interval})
    case "minute":
      return this.plus({minutes: interval})
    case "hour":
      return this.plus({hours: interval})
    case "day":
      return this.plus({days: interval})
    case "week":
      return this.plus({weeks: interval})
    case "month":
      return this.plus({months: interval})
    case "year":
      return this.plus({years: interval})
    default:
      throw new Error(`DateTime plusUnit: invalid unit: ${unit}`)
  }
}