# iCalEvents
A RFC5545 compliant parser for iCalendar VEVENT with time zone support and accurate recurring events generation.

The Goal of this package is to provide a most accurate parsing that sticks 100% to the RFC5545 specifications, and that handles time zones in any situation perfectly without using any hack (e.g. put everything in UTC).

I particularly tested it against all the example for RRULE given in the specification. However it is still in alpha so there might still be some bugs.

To achieve time zone support I use the luxon library, which comes as a dependency.
Note that VTIMEZONE parsing is not supported. Instead I use the olson time zone ID (e.g. "Asia/Tokyo") to instantiate datetimes.
I believe most calendar apps like Gmail, iCloud, Nextcloud or Exchange/Outlook use those so it should not be an issue.
Please let me know if there are use cases where VTIMEZONE parsing is required.

Any feedback through GitHub - bug report, pull request, code styling and design patterns suggestions - is highly welcome.


## Usage
Teminal
```
mkdir test-ical-events
cd test-ical-events
npm init -y
npm install luxon ical-events
npm install --save-dev typescript @types/luxon
```

In your node project:
src/index.ts
```
import { ICalEvents } from 'ical-events'
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

const iCalEvents = new ICalEvents(data, range, {withVEvent: true, includeDTSTART: false})

console.log(iCalEvents.vevents.toString())

console.log(range.toISO())

console.log(iCalEvents.events)
```

Compile typescript file using your prefered build system and run your code.
for example:

tsconfig.json
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

Terminal
```
npx tsc && node ./dist/index.js
```

