# iCalendarEvents
A RFC5545 compliant parser for iCalendar VEVENT with time zone support and accurate recurring events generation.

The Goal of this package is to provide a most accurate parsing that sticks 100% to the RFC5545 specifications, and that handles time zones in any situation perfectly without using any hack (e.g. put everything in UTC).

I particularly tested it against all the example for RRULE given in the specification. However it is still in alpha so there might still be some bugs.

To achieve time zone support I use the luxon library, which comes as a dependency.
Note that VTIMEZONE parsing is not supported. Instead I use the olson time zone ID (e.g. "Asia/Tokyo") to instantiate datetimes.
I believe most calendar apps like Gmail, iCloud, Nextcloud or Exchange/Outlook use those so it should not be an issue.
Please let me know if there are use cases where VTIMEZONE parsing is required.

Any feedback through GitHub - bug report, pull request, code styling and design patterns suggestions - is highly welcome.

As of now RECURRENCE-ID override and SEQUENCE support are not implemented. They will be added soon.


## Usage
Teminal
```
mkdir test-ical-events
cd test-ical-events
npm init -y esnext
npm install icalendar-events
npm install --save-dev typescript @types/luxon
mkdir src
nano src/index.ts
```

Add this code to 'src/index.ts'
```
import { ICalendarEvents } from 'icalendar-events'
import { DateTime, Interval } from 'luxon'

// Get the iCalendar data from an url (using fetch) or from a file (using fs)
// Here we use an example string
const data = "\
BEGIN:VCALENDAR\n\
BEGIN:VEVENT\n\
CREATED:20240817T085751Z\n\
DTSTAMP:20240821T003640Z\n\
LAST-MODIFIED:20240821T003640Z\n\
SEQUENCE:5\n\
UID:172a399f-b2c6-44e4-9b06-9c70356dabd2\n\
STATUS:CONFIRMED\n\
SUMMARY:test event\n\
LOCATION:loc\n\
DESCRIPTION:desc\n\
DURATION:PT1H\n\
DTSTART;TZID=America/New_York:20241005T090000\n\
RRULE:FREQ=MONTHLY;BYDAY=-1FR,-1SA,-1SU;COUNT=5\n\
END:VEVENT\n\
END:VCALENDAR"

// Get the events in a 3 months range
const firstDate: DateTime = DateTime.fromFormat("20241005T090000", "yyyyMMdd'T'HHmmss", {zone: 'America/New_York'}).startOf('month')
const lastDate: DateTime = firstDate.plus({months:2}).endOf('month')
const range = Interval.fromDateTimes(firstDate, lastDate)

const iCalendarEvents = new ICalendarEvents(data, range, {withVEvent: true, includeDTSTART: false})

console.log(iCalendarEvents.vevents.toString())

console.log(range.toISO())

console.log(iCalendarEvents.events)
```

Compile typescript file using your prefered build system and run your code.
for example:

In your project root folder
```
nano tsconfig.json
```

Add this code to 'tsconfig.json'
```
{
  "compilerOptions": {
    "lib": ["dom", "ESNext"],
    "allowJs": true,
    "skipLibCheck": false,
    "strict": true,
    "esModuleInterop": true,
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "incremental": false,
    "declaration": true,
    "paths": {
      "@/*": ["./src/*"],
    },
    "target": "ESNext",
    "outDir": "./dist",
  },
  "include": ["./**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Compile and run:
Terminal
```
npx tsc && node ./dist/index.js
```

You get the list of events that correspond to the iCalendar file given as an example.
Terminal
```
> npx tsc && node ./dist/index.js


      uuid: 172a399f-b2c6-44e4-9b06-9c70356dabd2 

      dtstart: 2024-10-05 09:00:00.000 America/New_York 

      dtend: undefined 

      duration: PT1H 

      summary: test event 

      location: loc 

      description: desc 

      rrule:  
         freq: MONTHLY  
         until: undefined    
         count: 5    
         interval: 1 
         bysecond:  
         byminute:  
         byhour:    
         byday: [{"nth":-1,"weekday":"FR"},{"nth":-1,"weekday":"SA"},{"nth":-1,"weekday":"SU"}]    
         bymonthday: []   
         byyearday: []    
         byweekno: [] 
         bymonth: []  
         bysetpos: [] 
         wkst: "MO"        

      rdate:  

      exdate:  

      
2024-10-01T00:00:00.000-04:00/2024-12-31T23:59:59.999-05:00
[
  {
    uid: '172a399f-b2c6-44e4-9b06-9c70356dabd2',
    dtstart: DateTime { ts: 2024-10-25T09:00:00.000-04:00, zone: America/New_York, locale: en-US },
    dtend: DateTime { ts: 2024-10-25T10:00:00.000-04:00, zone: America/New_York, locale: en-US },
    summary: 'test event',
    location: 'loc',
    description: 'desc',
    allday: false
  },
  {
    uid: '172a399f-b2c6-44e4-9b06-9c70356dabd2',
    dtstart: DateTime { ts: 2024-10-26T09:00:00.000-04:00, zone: America/New_York, locale: en-US },
    dtend: DateTime { ts: 2024-10-26T10:00:00.000-04:00, zone: America/New_York, locale: en-US },
    summary: 'test event',
    location: 'loc',
    description: 'desc',
    allday: false
  },
  {
    uid: '172a399f-b2c6-44e4-9b06-9c70356dabd2',
    dtstart: DateTime { ts: 2024-10-27T09:00:00.000-04:00, zone: America/New_York, locale: en-US },
    dtend: DateTime { ts: 2024-10-27T10:00:00.000-04:00, zone: America/New_York, locale: en-US },
    summary: 'test event',
    location: 'loc',
    description: 'desc',
    allday: false
  },
  {
    uid: '172a399f-b2c6-44e4-9b06-9c70356dabd2',
    dtstart: DateTime { ts: 2024-11-24T09:00:00.000-05:00, zone: America/New_York, locale: en-US },
    dtend: DateTime { ts: 2024-11-24T10:00:00.000-05:00, zone: America/New_York, locale: en-US },
    summary: 'test event',
    location: 'loc',
    description: 'desc',
    allday: false
  },
  {
    uid: '172a399f-b2c6-44e4-9b06-9c70356dabd2',
    dtstart: DateTime { ts: 2024-11-29T09:00:00.000-05:00, zone: America/New_York, locale: en-US },
    dtend: DateTime { ts: 2024-11-29T10:00:00.000-05:00, zone: America/New_York, locale: en-US },
    summary: 'test event',
    location: 'loc',
    description: 'desc',
    allday: false
  }
]

```
