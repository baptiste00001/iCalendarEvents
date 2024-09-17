import { DateTime, DateTimeUnit } from "luxon"
import { parseICalDateTime } from './parse-ical-datetime.js'

export type Freq = "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"
export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU"
export type WeekdayNum = {
  nth: number | null, // (-5 to 5 - {0})
  weekday: Weekday
}

function mapFreqUnit(freq: Freq): DateTimeUnit {
  const map: { [key: string]: DateTimeUnit } = {
    SECONDLY: 'second', MINUTELY: 'minute', HOURLY: 'hour', DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year',
  }
  return map[freq]
}

//iCal rrule parser. Provides list of recurrences in a range
export class RRule {
  freq: Freq | null = null
  until: DateTime | null = null
  count: number | null = null 
  interval: number = 1
  bysecond: number[] = [] // (0 to 60)[]
  byminute: number[] = [] // (0 to 59)[]
  byhour: number[] = [] // (0 to 23)[]
  byday: WeekdayNum[] = []
  bymonthday: number[] = [] // (-31 to 31 - {0})[]
  byyearday: number[] = [] // (-366 to 366 - {0})[]
  byweekno: number[] = [] // (-53 to 53 - {0})[]
  bymonth: number[] = [] // 1 to 12
  bysetpos: number[] = [] // (-366 to 366 -{0})[] ou context dependant. Can be (-31 to 31 -{0})[], etc...
  wkst: Weekday = "MO"
  
  //cache: DateTime[] = []

  matchesRRule(dateTime: DateTime, ignoreSetPos: boolean = false): boolean {
    //Check if given dateTime verifies BYMONTH, BYWEEKNO, BYYEARDAY, BYMONTHDAY, BYDAY, BYHOUR, BYMINUTE, BYSECOND and BYSETPOS in that order

    //   From the RFC5545 spec:
    //   If multiple BYxxx rule parts are specified, then after evaluating
    //   the specified FREQ and INTERVAL rule parts, the BYxxx rule parts
    //   are applied to the current set of evaluated occurrences in the
    //   following order: BYMONTH, BYWEEKNO, BYYEARDAY, BYMONTHDAY, BYDAY,
    //   BYHOUR, BYMINUTE, BYSECOND and BYSETPOS; then COUNT and UNTIL are
    //   evaluated.

    //   A week is defined as a
    //   seven day period, starting on the day of the week defined to be
    //   the week start (see WKST).  Week number one of the calendar year
    //   is the first week that contains at least four (4) days in that
    //   calendar year.
    //   The WKST rule part specifies the day on which the workweek starts.
    //   Valid values are MO, TU, WE, TH, FR, SA, and SU.  This is significant 
    //   when a WEEKLY "RRULE" has an interval greater than 1,
    //   and a BYDAY rule part is specified.  This is also significant when
    //   in a YEARLY "RRULE" when a BYWEEKNO rule part is specified.  The
    //   default value is MO.

    //   An example where the days generated makes a difference because of
    //   WKST:

    //   DTSTART;TZID=America/New_York:19970805T090000
    //   RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=MO

    //   ==> (1997 EDT) August 5,10,19,24

    //   changing only WKST from MO to SU, yields different results...

    //   DTSTART;TZID=America/New_York:19970805T090000
    //   RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=SU

    //    ==> (1997 EDT) August 5,17,19,31

    //   The table below summarizes the dependency of BYxxx rule part
    //   expand or limit behavior on the FREQ rule part value.

    //   The term "N/A" means that the corresponding BYxxx rule part MUST
    //   NOT be used with the corresponding FREQ value.

    //   BYDAY has some special behavior depending on the FREQ value and
    //   this is described in separate notes below the table.

    // +----------+--------+--------+-------+-------+------+-------+------+
    // |          |SECONDLY|MINUTELY|HOURLY |DAILY  |WEEKLY|MONTHLY|YEARLY|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYMONTH   |Limit   |Limit   |Limit  |Limit  |Limit |Limit  |Expand|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYWEEKNO  |N/A     |N/A     |N/A    |N/A    |N/A   |N/A    |Expand|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYYEARDAY |Limit   |Limit   |Limit  |N/A    |N/A   |N/A    |Expand|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYMONTHDAY|Limit   |Limit   |Limit  |Limit  |N/A   |Expand |Expand|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYDAY     |Limit   |Limit   |Limit  |Limit  |Expand|Note 1 |Note 2|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYHOUR    |Limit   |Limit   |Limit  |Expand |Expand|Expand |Expand|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYMINUTE  |Limit   |Limit   |Expand |Expand |Expand|Expand |Expand|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYSECOND  |Limit   |Expand  |Expand |Expand |Expand|Expand |Expand|
    // +----------+--------+--------+-------+-------+------+-------+------+
    // |BYSETPOS  |Limit   |Limit   |Limit  |Limit  |Limit |Limit  |Limit |
    // +----------+--------+--------+-------+-------+------+-------+------+

    //    Note 1:  Limit if BYMONTHDAY is present; otherwise, special expand
    //             for MONTHLY.

    //    Note 2:  Limit if BYYEARDAY or BYMONTHDAY is present; otherwise,
    //             special expand for WEEKLY if BYWEEKNO present; otherwise,
    //             special expand for MONTHLY if BYMONTH present; otherwise,
    //             special expand for YEARLY.

    if(this.freq === null) {
      console.error(`RRule matchesRRule: FREQ is null:\n ${this.toString()}`)
      return false
    }

    // Verifies BYMONTH ?
    if(this.bymonth.length !== 0) {
      if(!this.bymonth.includes(dateTime.month)) return false
    }

    // Verifies BYWEEKNO ?
    if(this.byweekno.length !== 0 && this.freq === "YEARLY") {

      // Must consider WKST in this case
      let dateTimeInLocale: DateTime | null = this.adjustLocaleForWkst(dateTime) 
      if(dateTimeInLocale === null) return false

      let byweeknoMatch: boolean = false

      for(const weekno of this.byweekno) {
        if((weekno > 0 && dateTimeInLocale.localWeekNumber === weekno) ||
          (weekno < 0 && dateTimeInLocale.weeksInLocalWeekYear - dateTimeInLocale.localWeekNumber + 1 === weekno)) {

            byweeknoMatch = true
          break
        }
      }

      if(!byweeknoMatch) return false
    }    

    // Verifies BYYEARDAY ?
    if(this.byyearday.length !== 0 && !["DAILY","WEEKLY","MONTHLY"].includes(this.freq)) {
      
      let byyeardayMatch = false

      for(const yearday of this.byyearday) {
        if((yearday > 0 && dateTime.ordinal === yearday) ||
          (yearday < 0 && dateTime.daysInYear - dateTime.ordinal + 1 === yearday)) {

            byyeardayMatch = true
          break
        }
      }

      if(!byyeardayMatch) return false
    }

    // Verifies BYMONTHDAY ?
    if(this.bymonthday.length !== 0 && this.freq !== "WEEKLY") {
      
      const monthdayMatch: boolean = this.bymonthday.some((monthDay: number): boolean => {

        if(dateTime.daysInMonth === undefined) {

          console.error("RRule matchesRule BYMONTHDAY: could not get the number of days in the month")
          return false
        } 

        return ((monthDay > 0 && dateTime.day === monthDay) ||
          (monthDay < 0 && (dateTime.daysInMonth) + monthDay + 1 === dateTime.day))
          
      }) 
      
      if(!monthdayMatch) return false
    }

    // Verifies BYDAY ?
    if(this.byday.length !== 0) {
      // YEARLY -> offset from day number in a year
      // MONTHLY -> offset from day number in a month
      // ELSE -> shouldn't have an offset so ignore it

      let bydayMatch: boolean = false

      for(const day of this.byday) {

        if(dateTime.setLocale("en-US").weekdayShort?.substring(0,2).toUpperCase() !== day.weekday) continue

        if(day.nth !== null && this.freq === "YEARLY") {
          let positionInYear: number = 0
          let totalInYear: number = 0
  
          let dt: DateTime = dateTime.startOf("year").setLocale("en-US") // to get weekdays in English
          while(dt.year === dateTime.year) {
            if(dt.weekdayShort?.substring(0,2).toUpperCase() === day.weekday) {
              totalInYear++
              if(dt.toISODate() === dateTime.toISODate()) {
                positionInYear = totalInYear
              }
            }
            
            dt = dt.plus({days: 1})
          }

          if(((day.nth > 0) && positionInYear === day.nth) ||
          (day.nth < 0 && totalInYear + day.nth + 1 === positionInYear)) {
            bydayMatch = true
            break
          }
        } else if(day.nth !== null && this.freq === "MONTHLY") {
          let positionInMonth: number = 0
          let totalInMonth: number = 0
  
          let dt: DateTime = dateTime.startOf("month").setLocale("en-US") // to get weekdays in English
          while(dt.month === dateTime.month) {
            if(dt.weekdayShort?.substring(0,2).toUpperCase() === day.weekday) {
              totalInMonth++
              if(dt.toISODate() === dateTime.toISODate())  {
                positionInMonth = totalInMonth
              }
            }
            
            dt = dt.plus({days: 1})
          }

          if(((day.nth > 0) && positionInMonth === day.nth) ||
          (day.nth < 0 && totalInMonth + day.nth + 1 === positionInMonth)) {
            bydayMatch = true
            break
          }
        } else {
          bydayMatch = true
          break
        }
      }

      if(!bydayMatch) return false
    }

    // Verifies BYHOUR
    if(this.byhour.length !== 0) {
      if(!this.byhour.includes(dateTime.hour)) return false
    }
    
    // Verifies BYMINUTE
    if(this.byminute.length !== 0) {
      if(!this.byminute.includes(dateTime.minute)) return false
    }
    
    // Verifies BYSECOND
    if(this.bysecond.length !== 0) {
      if(!this.bysecond.includes(dateTime.second)) return false
    }

    // Verifies SETPOS
    // BYSETPOS must be checked after we get all the set in the relevant period
    // BYSETPOS operates on
    // a set of recurrence instances in one interval of the recurrence
    // rule.  For example, in a WEEKLY rule, the interval would be one
    // week. A set of recurrence instances starts at the beginning of the
    // interval defined by the FREQ rule part.  Valid values are 1 to 366
    // or -366 to -1.  It MUST only be used in conjunction with another
    // BYxxx rule part.  
    if(this.bysetpos.length !== 0 && !ignoreSetPos) {
      const periodUnit: DateTimeUnit = mapFreqUnit(this.freq)

      // Consider WKST with useLocaleWeeks: true
      const periodStart: DateTime = dateTime.startOf(periodUnit, {useLocaleWeeks: true})
      const periodEnd: DateTime = dateTime.endOf(periodUnit, {useLocaleWeeks: true})

      const validDates: string[] = []

      
      const advanceFreq = this.getAdvanceFreq()
      let dt: DateTime = periodStart.setSmallUnits(dateTime, this.unitsCap(advanceFreq))

      while(dt <= periodEnd) {
        if(this.matchesRRule(dt, true)) {
          const iso: string | null = dt.toISO()
          if(iso) validDates.push(iso)
        }
        dt = this.advanceDate(dt)
      }

      const bysetposMatch: boolean = this.bysetpos.some(setpos => {

        const index = validDates.indexOf(dateTime.toISO() ?? "")

        return( index !== -1 && 
          ( (setpos > 0 && setpos === index + 1) || (setpos < 0 && validDates.length + setpos === index) )
        )
      })

      if(!bysetposMatch) return false

    }

    return true
  }

  advanceDate(from: DateTime): DateTime {
    // TODO: optimize to skip values when possible

    if(this.freq === null) throw new Error(`RRule advanceDate: FREQ is null`)

    // Must consider WKST for the case FREQ=WEEKLY and INTERVAL > 1
    let fromInLocale: DateTime | null = (this.freq === "WEEKLY" && this.interval > 1) ? this.adjustLocaleForWkst(from) : from
    if(fromInLocale === null) {
      fromInLocale = from
      console.error("RRule advanceDate: could not change date locale")
    }

    let next: DateTime | null = null

    const advanceFreq: Freq = this.getAdvanceFreq()

    if(this.freq !== advanceFreq) {
      next = fromInLocale.plusUnit(mapFreqUnit(advanceFreq), 1)

      if(!next.hasSame(fromInLocale, mapFreqUnit(this.freq), {useLocaleWeeks: true})) {
        const temp: DateTime = fromInLocale.plusUnit(mapFreqUnit(this.freq), this.interval).startOf(mapFreqUnit(this.freq), {useLocaleWeeks: true})
        const unitLimit: DateTimeUnit = this.unitsCap(this.freq)
        next = temp.setSmallUnits(fromInLocale, unitLimit)

      }
        
    } else {
      next = fromInLocale.plusUnit(mapFreqUnit(this.freq), this.interval)
    }

    if(next === null || !next.isValid) {
      throw new Error(`RRule advanceDate: could not get the next date`) 
    }

    next.isDate = from.isDate
    return next
    
  }

  private getAdvanceFreq(): Freq {
    // Returns the frequency to be used in advanceDate
    // Useful when handling BYSETPOS

    if(this.freq === "SECONDLY" || this.bysecond.length !== 0) {
      return "SECONDLY"
    } else if(this.freq === "MINUTELY" || this.byminute.length !== 0) {
      return "MINUTELY"
    } else if(this.freq === "HOURLY" || this.byhour.length !== 0) {
      return "HOURLY"
    } else if(this.freq === "DAILY" || this.byday.length !== 0 || this.bymonthday.length !== 0 || this.byyearday.length !== 0) {
      return "DAILY"
    } else if(this.freq === "WEEKLY" || this.byweekno.length !== 0) {
      return "WEEKLY"
    } else if(this.freq === "MONTHLY" || this.bymonth.length !== 0) {
      return "MONTHLY"
    } else {
      return "YEARLY"
    }
  }

  private unitsCap(freq: Freq): DateTimeUnit {

    const map: { [key: string]: DateTimeUnit } = {
      SECONDLY: 'millisecond', 
      MINUTELY: 'second', 
      HOURLY: 'minute', 
      DAILY: 'hour', 
      WEEKLY: 'hour', 
      MONTHLY: 'hour', 
      YEARLY: (this.bymonth.length !== 0) ? 'day' : 'hour',
    }

    return map[freq]
  }

  private adjustLocaleForWkst(dateTime: DateTime): DateTime | null {
    // return a new DateTime object with a locale in which wkst is appropriate
    // only cover case where week start is on monday, sunday or saturday
    let dateTimeInLocale: DateTime 
    const dateTimeISO: string | null = dateTime.toISO()
    if(dateTimeISO === null) return null
    switch(this.wkst) {
      case "SU":
        dateTimeInLocale = DateTime.fromISO(dateTimeISO, {locale: "en-US", zone: dateTime.zone})
        break
      case "SA":
        dateTimeInLocale = DateTime.fromISO(dateTimeISO, {locale: "ar-EG", zone: dateTime.zone})
        break
      case "MO":
      default:
        dateTimeInLocale = DateTime.fromISO(dateTimeISO, {locale: "fr-FR", zone: dateTime.zone})
    }

    if(!dateTimeInLocale.isValid) return null

    dateTimeInLocale.isDate = dateTime.isDate
    return dateTimeInLocale
  }

  toString(): string {
      return ` \n \
        freq: ${this.freq}  \n \
        until: ${this.until?.toSQLString()}    \n \
        count: ${this.count}    \n \
        interval: ${this.interval} \n \
        bysecond: ${this.bysecond.map<string>(i=> i.toString()).reduce((prev, cur): string => {return prev + ((prev === "") ? "" : ",") + cur},"")} \n \
        byminute: ${this.byminute.map<string>(i=> i.toString()).reduce((prev, cur): string => {return prev + ((prev === "") ? "" : ",") + cur},"")} \n \
        byhour: ${this.byhour.map<string>(i=> i.toString()).reduce((prev, cur): string => {return prev + ((prev === "") ? "" : ",") + cur},"")}   \n \
        byday: ${JSON.stringify(this.byday)}    \n \
        bymonthday: ${JSON.stringify(this.bymonthday)}   \n \
        byyearday: ${JSON.stringify(this.byyearday)}    \n \
        byweekno: ${JSON.stringify(this.byweekno)} \n \
        bymonth: ${JSON.stringify(this.bymonth)}  \n \
        bysetpos: ${JSON.stringify(this.bysetpos)} \n \
        wkst: ${JSON.stringify(this.wkst)} \
      `
  }

  constructor(rrule: string) {
    const rruleParts: string[] = rrule.split(":")[1].split(";")

    for(const part of rruleParts) {
      if(part === "") continue

      const keyValue: string[] = part.split("=")
      if(keyValue.length < 2) continue

      const key: string = keyValue[0].trim().toUpperCase()
      const value: string = keyValue[1].trim()

      //TODO: check if each parsed value is acceptable (e.g. hour in 0-23)
      switch(key) {
        case "FREQ":
            this.freq = value as Freq
            break

        case "UNTIL":
          //need to keep the format including the key "UNTIL=..."" here
          //there is only 1 until date
          try {
            this.until = parseICalDateTime(`UNTIL=${value}`)[0]
          } catch (e: any) {
            console.error("RRule constructor", `Could not parse UNTIL: ${part}`)
            console.error("RRule constructor", e)
          }
          break

        case "COUNT":
          this.count = parseInt(value, 10)
          if(Number.isNaN(this.count)) throw new Error(`RRULE constructor: COUNT format error value=${value}`)
          break

        case "INTERVAL":
          this.interval = parseInt(value, 10)
          if(Number.isNaN(this.interval)) throw new Error(`RRULE constructor: INTERVAL format error value=${value}`)
          break

        case "BYSECOND":
          this.bysecond = value.split(",").map<number>((second: string) : number => {
            
            const parsed: number = parseInt(second, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYSECOND format error second=${second}`)

            return parsed
          })
          break

        case "BYMINUTE":
          this.byminute = value.split(",").map<number>((minute: string) : number => {
            
            const parsed: number = parseInt(minute, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYMINUTE format error minute=${minute}`)

            return parsed
          })
          break

        case "BYHOUR":
          this.byhour = value.split(",").map<number>((hour: string) : number => {
            
            const parsed: number = parseInt(hour, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYHOUR format error hour=${hour}`)

            return parsed
          })
          break

        case "BYDAY":
          this.byday = value.split(",").map<WeekdayNum>((day: string): WeekdayNum => {
                         
            const match = day.match(/([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)/);

            const nth: number | null = (match && match[1]) ? parseInt(match[1], 10) : null
            const parsed: string | null = (match && match[2]) ? match[2].toUpperCase() : null
            
            if(parsed === null) throw new Error(`RRULE constructor: BYDAY format error day=${day}`)
            
            return {
              nth: nth,
              weekday: parsed as Weekday
            };
          })
          break

        case "BYMONTHDAY":
          this.bymonthday = value.split(",").map<number>((monthday: string): number => {

            const parsed: number = parseInt(monthday, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYMONTHDAY format error monthday=${monthday}`)

            return parsed
          })
          break

        case "BYYEARDAY":
          this.byyearday = value.split(",").map<number>((yearday: string): number => {

            const parsed: number = parseInt(yearday, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYYEARDAY format error yearday=${yearday}`)

            return parsed
          })
          break

        case "BYWEEKNO":
          this.byweekno = value.split(",").map<number>((weekno: string): number => {

            const parsed: number = parseInt(weekno, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYWEEKNO format error weekno=${weekno}`)

            return parsed
          })
          break

        case "BYMONTH":
          this.bymonth = value.split(",").map<number>((month: string): number => {

            const parsed: number = parseInt(month, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYMONTH format error month=${month}`)

            return parsed
          } )
          break

        case "BYSETPOS":
          this.bysetpos = value.split(",").map<number>((setpos: string): number => {

            const parsed: number = parseInt(setpos, 10)

            if(Number.isNaN(parsed)) throw new Error(`RRULE constructor: BYSETPOS format error setpos=${setpos}`)

            return parsed
          })
          break

        case "WKST":
          const weekday: Weekday | undefined = value.match(/MO|TU|WE|TH|FR|SA|SU/)?.[0].toUpperCase() as Weekday | undefined

          if(weekday === undefined) throw new Error(`RRULE constructor: WKST format error value=${value}`)

          this.wkst = weekday
              
          break

        default:
          console.error(`RRULE constructor: unknown key=${key}, value=${value}`)
          
      }
    }

    if(this.freq === null) throw new Error("RRULE constructor: FREQ part is not defined")

  }
}