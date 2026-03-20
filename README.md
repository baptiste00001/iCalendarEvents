# iCalendarEvents
A RFC5545 compliant parser for iCalendar VEVENT with time zone support and accurate recurring events generation.

The Goal of this package is to provide a most accurate parsing that sticks 100% to the RFC5545 specifications, and that handles time zones in any situation perfectly without using any hack (e.g. put everything in UTC).

I particularly tested it against all the example for RRULE given in the specification. However it is still in alpha so there might still be some bugs.

To achieve time zone support I use the luxon library, which comes as a dependency.
Note that VTIMEZONE parsing is not supported. Instead I use the olson time zone ID (e.g. "Asia/Tokyo") to instantiate datetimes.
I believe most calendar apps like Gmail, iCloud, Nextcloud or Exchange/Outlook use those so it should not be an issue.
Please let me know if there are use cases where VTIMEZONE parsing is required.

Any feedback through GitHub - bug report, pull request, code styling and design patterns suggestions - is highly welcome.

1.0.10 changes (March 2026): 
 - RECURRENCE-ID override with SEQUENCE handling has been implemented
 - Updated the README with more usage example
 - Added a quick guide to wrap the library into a CLI tool.
 - Added a quick guide to create a openclaw skill to call the library using the CLI tool.


## Usage

### Use the library in an existing project
Terminal
```bash
cd your-project-path
npm install icalendar-events luxon
npm install --save-dev @types/luxon 
```

Then you can import the library in your code and use it as shown in the example below.

index.ts or whatever your  file is named
```typescript
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

console.log("RAW VEVENTS")
console.log(iCalendarEvents.vevents.toString())

console.log("ALL EVENTS INCLUDING RRULE EXPANSIONS")
console.log(range.toISO())
console.log(JSON.stringify(iCalendarEvents.events, null, 2))
```
### Start a new project from scratch (to test the library or to use it in a new project)
Terminal
```bash
mkdir test-icalendar-events
cd test-icalendar-events
npm init -y esnext
npm install icalendar-events luxon
npm install --save-dev typescript @types/luxon
mkdir src
nano src/index.ts
```

Add this code to 'src/index.ts'
```typescript
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

console.log("RAW VEVENTS")
console.log(iCalendarEvents.vevents.toString())

console.log("ALL EVENTS INCLUDING RRULE EXPANSIONS")
console.log(range.toISO())
console.log(JSON.stringify(iCalendarEvents.events, null, 2))
```

Compile typescript file using your prefered build system and run your code.
for example:

In your project root folder
```bash
nano tsconfig.json
```

Add this code to 'tsconfig.json'
```json
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
```bash
npx tsc && node ./dist/index.js
```

### Excpected output format

When running the codes above you get the list of events that correspond to the iCalendar file given as an example.
Terminal
```bash
RAW VEVENTS
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

ALL EVENTS INCLUDING RRULE EXPANSIONS  
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

### How to get the icalendar (ics) raw feed in text format
You can fetch the icalendar (.ics) feed using this code for example:
```javascript
import { readFile } from 'fs/promises';
import path from 'path';

// ...

let icsContent;
if (params.source.startsWith('http://') || params.source.startsWith('https://')) {
  const res = await fetch(params.source);
  if (!res.ok) {
    throw new Error(`Failed to fetch ICS: HTTP ${res.status}`);
  }
  icsContent = await res.text();
} else {
  let filePath = params.source;
  if (filePath.startsWith('~')) {
    filePath = path.join(process.env.HOME || '/home/pi', filePath.slice(1));
  }
  const safePath = path.resolve(filePath);
  if (!safePath.startsWith(process.env.HOME || '/home/pi')) {
    throw new Error('Access restricted to home directory');
  }
  icsContent = await readFile(safePath, 'utf-8');
}

// ...

// Then call the library like before

const iCalendarEvents = new ICalendarEvents(data, range, {withVEvent: true, includeDTSTART: false})

// ...

```

### Documentation
The ICalendarEvents constructor must get the following arguments:

```typescript
data: string,
dateRange?: Interval, 
options?: iCalParserOptions
```

`data` is the raw ics feed in text format

`dateRange` is a luxon Interval. 
default is [start of current month - 1 year later]

`options` is an object that defines the results you want to get. All fields are optional.

options.withEvents?: boolean
default is false to keep memory usage low.
If true the parser will also populate the parsed raw vevent objects. For debugging purpose moslty.

options.includeDTSTART?: boolean
default is true
If true, dtstart will be included in recurrence rule expansion regardless if it satisfied the rule or not.
If false, it will be included in the expanded set only if it satisfied the recurrence rule.

options.localTZ?: string
e.g. Asia/Tokyo
Is used instead of the local time zone on the server in the case where a VEVENT date is defined in the local timezone (no time zone defined and no 'Z'). DTSTART:20261220T150000
It is mostly to force the user's local time zone instead of the server's local time zone.
It depends on your use case but it should be rarely used.


### Wrap the library to turn it into a CLI command
First you must make sure you have a node_module with the needed libraries in the same folder as your wrapper.

Terminal
```bash
cd path-to-your-project-root
npm init -y esnext
npm install icalendar-events luxon
```

Then create a wrapper that calls the library and pass the arguments givent in the termial to the constructor. This is just an example of such a wrapper.

main.js in your project root
```javascript
#!/usr/bin/env node

import { ICalendarEvents } from 'icalendar-events';
import { DateTime, Interval } from 'luxon';
import { readFile } from 'fs/promises';
import path from 'path';

// ── Extract the core logic into an exported function ────────────────────────
export async function processICalEvents(params) {

  try {
    if (!params?.source) {
      throw new Error('No source param provided');
    }

    let icsContent;
    if (params.source.startsWith('http://') || params.source.startsWith('https://')) {
      const res = await fetch(params.source);
      if (!res.ok) {
        throw new Error(`Failed to fetch ICS: HTTP ${res.status}`);
      }
      icsContent = await res.text();
    } else {
      let filePath = params.source;
      if (filePath.startsWith('~')) {
        filePath = path.join(process.env.HOME || '/home/pi', filePath.slice(1));
      }
      const safePath = path.resolve(filePath);
      if (!safePath.startsWith(process.env.HOME || '/home/pi')) {
        throw new Error('Access restricted to home directory');
      }
      icsContent = await readFile(safePath, 'utf-8');
    }

    const timeZone = params.timeZone || params.timezone || 'UTC';

    let range = null;
    if (params.start && params.end) {
      const firstDate = DateTime.fromFormat(params.start, "yyyy-MM-dd", { zone: timeZone }).startOf('day');
      const lastDate  = DateTime.fromFormat(params.end,   "yyyy-MM-dd", { zone: timeZone }).endOf('day');
      range = Interval.fromDateTimes(firstDate, lastDate);
    }

    const calendar = new ICalendarEvents(icsContent, range, {
      withVEvent: false,
      includeDTSTART: false
    });

    let events = calendar.events;

    if (params.filter) {
      const f = params.filter;
      events = events.filter(ev => {
        if (f.titleContains && !ev.summary?.toLowerCase().includes(f.titleContains.toLowerCase())) return false;
        if (f.descriptionContains && !ev.description?.toLowerCase().includes(f.descriptionContains.toLowerCase())) return false;
        if (f.locationContains && !ev.location?.toLowerCase().includes(f.locationContains.toLowerCase())) return false;
        return true;
      });
    }

    return {
      success: true,
      count: events.length,
      events: events.map(ev => ({
        uid: ev.uid,
        title: ev.summary || '(No title)',
        start: ev.dtstart?.setZone(timeZone).toISO({ extendedZone: true }),
        end:   ev.dtend?.setZone(timeZone).toISO({ extendedZone: true }),
        allday: ev.allday || false,
        description: ev.description || '',
        location: ev.location || '',
        recurrenceId: null,
        originalRRule: null
      })),
      message: `${events.length} event(s) found`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    };
  }
}

// ── CLI entry point ─────────────────────────────────────────────────────────
async function runAsCli() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', async () => {
    try {
      if (!input.trim()) {
        throw new Error('No input received on stdin');
      }

      const { params } = JSON.parse(input);

      const result = await processICalEvents(params);

      if (result.success) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      } else {
        console.error(JSON.stringify(result));
        process.exit(1);
      }
    } catch (err) {
      console.error(JSON.stringify({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }));
      process.exit(1);
    }
  });
}

// Most reliable cross-project ESM "is main?" check (2024–2026 style)
const isMain = () =>
  process.argv.length > 1 &&
  (import.meta.url.endsWith(process.argv[1]) ||
   import.meta.url.endsWith(process.argv[1] + '.js') ||   // sometimes seen after bundling/tsc
   import.meta.url === `file://${process.argv[1]}`);

if (isMain()) {
  runAsCli().catch(err => {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  });
}
```

IMPORTANT: make the file executable

Terminal
```bash
chmod +x main.js
```

You can then call the command like this: 
Terminal
```bash
echo '{"params":{"source":"https://calendar.google.com/calendar/ical/your-gmail-address/public/basic.ics","start":"2026-03-16","end":"2026-04-15","timeZone":"Asia/Tokyo"}}' | ./main.js
```

<B>Troubleshooting:</b>

Make sure main.js is executable.
Make sure node is in the user PATH.
Otherwise you must give the full path to node and call it like this:

Terminal
```bash
echo '{"params":{"source":"https://calendar.google.com/calendar/ical/your-gmail-address/public/basic.ics","start":"2026-03-16","end":"2026-04-15","timeZone":"Asia/Tokyo"}}' | /usr/bin/node ./main.js
```

### How to create a skill to make the agent call the library when asked to parse ics feed in Openclaw

This is one example of how you can create a skill. Depending on your setup and use case you might need to give the agent access to part of the file system and/or to the network.
Ajust paths and content to fit your setup.

Terminal
```bash
mkdir -p ~/.openclaw/workspace/skills/icalendar-events-parser
cd ~/.openclaw/workspace/skills/icalendar-events-parser
npm init -y esnext
npm install icalendar-events luxon
nano index.js
```

Put this code in index.js
```javascript
#!/usr/bin/env node

import { ICalendarEvents } from 'icalendar-events';
import { DateTime, Interval } from 'luxon';
import { readFile } from 'fs/promises';
import path from 'path';

// ── Extract the core logic into an exported function ────────────────────────
export async function processICalEvents(params) {

  try {
    if (!params?.source) {
      throw new Error('No source param provided');
    }

    let icsContent;
    if (params.source.startsWith('http://') || params.source.startsWith('https://')) {
      const res = await fetch(params.source);
      if (!res.ok) {
        throw new Error(`Failed to fetch ICS: HTTP ${res.status}`);
      }
      icsContent = await res.text();
    } else {
      let filePath = params.source;
      if (filePath.startsWith('~')) {
        filePath = path.join(process.env.HOME || '/home/pi', filePath.slice(1));
      }
      const safePath = path.resolve(filePath);
      if (!safePath.startsWith(process.env.HOME || '/home/pi')) {
        throw new Error('Access restricted to home directory');
      }
      icsContent = await readFile(safePath, 'utf-8');
    }

    const timeZone = params.timeZone || params.timezone || 'UTC';

    let range = null;
    if (params.start && params.end) {
      const firstDate = DateTime.fromFormat(params.start, "yyyy-MM-dd", { zone: timeZone }).startOf('day');
      const lastDate  = DateTime.fromFormat(params.end,   "yyyy-MM-dd", { zone: timeZone }).endOf('day');
      range = Interval.fromDateTimes(firstDate, lastDate);
    }

    const calendar = new ICalendarEvents(icsContent, range, {
      withVEvent: false,
      includeDTSTART: false
    });

    let events = calendar.events;

    if (params.filter) {
      const f = params.filter;
      events = events.filter(ev => {
        if (f.titleContains && !ev.summary?.toLowerCase().includes(f.titleContains.toLowerCase())) return false;
        if (f.descriptionContains && !ev.description?.toLowerCase().includes(f.descriptionContains.toLowerCase())) return false;
        if (f.locationContains && !ev.location?.toLowerCase().includes(f.locationContains.toLowerCase())) return false;
        return true;
      });
    }

    return {
      success: true,
      count: events.length,
      events: events.map(ev => ({
        uid: ev.uid,
        title: ev.summary || '(No title)',
        start: ev.dtstart?.setZone(timeZone).toISO({ extendedZone: true }),
        end:   ev.dtend?.setZone(timeZone).toISO({ extendedZone: true }),
        allday: ev.allday || false,
        description: ev.description || '',
        location: ev.location || '',
        recurrenceId: null,
        originalRRule: null
      })),
      message: `${events.length} event(s) found`
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    };
  }
}

// ── CLI entry point ─────────────────────────────────────────────────────────
async function runAsCli() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { input += chunk; });
  process.stdin.on('end', async () => {
    try {
      if (!input.trim()) {
        throw new Error('No input received on stdin');
      }

      const { params } = JSON.parse(input);

      const result = await processICalEvents(params);

      if (result.success) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(0);
      } else {
        console.error(JSON.stringify(result));
        process.exit(1);
      }
    } catch (err) {
      console.error(JSON.stringify({
        success: false,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }));
      process.exit(1);
    }
  });
}

// Most reliable cross-project ESM "is main?" check (2024–2026 style)
const isMain = () =>
  process.argv.length > 1 &&
  (import.meta.url.endsWith(process.argv[1]) ||
   import.meta.url.endsWith(process.argv[1] + '.js') ||   // sometimes seen after bundling/tsc
   import.meta.url === `file://${process.argv[1]}`);

if (isMain()) {
  runAsCli().catch(err => {
    console.error(JSON.stringify({ success: false, error: err.message }));
    process.exit(1);
  });
}
```

IMPORTANT: make the file executable

Terminal
```bash
chmod +x index.js
```

Then create the SKILL.md file to tell the agent how to use the library:
````markdown
---
name: icalendar-events-parser
description: Parse .ics / iCalendar files or URLs, expand recurring events (RRULE), filter by date range / keywords, and return clean list of events. Use this instead of manual parsing or other ical libraries when reliable recurrence expansion is needed.
version: 1.0.0
tags: icalendar, ics, ical, parser
user-invocable: true
disable-model-invocation: false
triggers: ["parse calendar feed", "parse ics"]
metadata:
  openclaw:
    entrypoint: index.js
    runner: node
    format: json
    type: cli
    permissions:
      version: 1
      declared_purpose: "Download remote .ics feeds via HTTP and parse remote or local .ics calendar files."
      exec:
        - node
      network:
        - "*"
      filesystem:
        - "read:~/**"
        - "read:./**"
      env: []
      sensitive_data:
        credentials: false
        personal_data: false
---

# iCal Events Parser with Recurrence Expansion

## When to use this skill
- User gives an .ics URL or local path and asks to list, summarize, filter or process events
- Need to expand recurring events into individual instances
- Want date-range filtering, keyword search in title/description/location
- Need clean structured output for further processing (e.g. add to Google Calendar, check conflicts)

Do NOT try to parse iCalendar .ics feeds yourself in prompts — always call this tool.
Do NOT use the built in web_fetch tool - always call this tool.
For several urls, call this tool several times.

## How the agent should call it (JSON format)

Send a JSON object like this to stdin (the script reads and processes it automatically):

```json
{
  "tool": "icalendar-events-parser",
  "action": "parse-expand-filter",
  "params": {
    "source": "https://calendar.google.com/calendar/ical/.../basic.ics",   // or "~/data/my-calendar.ics" or "./data/my-calendar.ics"
    "start": "2026-03-01",                    // YYYY-MM-DD date format
    "end":   "2026-03-31",                    // YYYY-MM-DD date format
    "timeZone": "Asia/Tokyo",                 // ALWAYS USE THE USER'S ACTUAL TIME ZONE
    "maxInstancesPerSeries": 200,             // safety limit to prevent huge exansions
    "filter": {                               // optional - all fields optional
      "titleContains": "yoga",
      "descriptionContains": null,
      "locationContains": "Tokyo"
    }
  }
}
```

## What the tool returns

```json
{
  "success": true,
  "count": 18,
  "events": [
    {
      "uid": "abc123@google.com",
      "title": "Team Sync",
      "start": "2026-03-05T09:00:00+09:00[Asia/Tokyo]",
      "end":   "2026-03-05T10:00:00+09:00[Asia/Tokyo]",
      "allday": false,                         // shows if the event is an allday event (true) or an intraday event (false).
      "description": "...",
      "location": "Zoom",
      "recurrenceId": null,                    // present only for expanded instances of recurring events
      "originalRRule": "FREQ=WEEKLY;BYDAY=WE"  // only for the master event
    },
    ...
  ],
  "message": "18 events found"
}
```

If error: `{ "success": false, "error": "..." }`

Implementation is in index.js in this folder.

## Required Permissions
This skill needs:
- Ability to execute `node` (tool: exec)
- Ability to read files on the file system
- Outbound network access for HTTP requests (fetch inside Node.js)

Please ensure your agent config allows `exec`, filesystem read and outbound network
````

Your skill folder should look like this

- SKILL.md
- index.js (must be executable)
- node_modules
- package.json
- package-lock.json

<b>Troubleshooting</b>

Did you make the file executable?

Terminal
```bash
chmod +x index.js
```

Does the agent see your skill?

Terminal
```bash
openclaw skills list
openclaw skills info icalendar-events-parser
```

If the agent complains about allowing `exec`, fetching data from the network or accessing the file system you might need to give it permission to run node, access the network and/or access part of your file system. You may change the tools profile to coding in openclaw.json and restart the gateway service.

If the agent complains that it cannot find node or the CLI command fails it might be because you intalled node with nvm and it is neither in usr/bin/ nor in your user PATH when running openclaw gateway service for some reasons.

From my experience when using openclaw it is better to install node globally in the expected location (/usr/bin/ on linux) and not use nvm. 

Uninstalling everything then reinstalling openclaw cleanly using the insltall script fixes the issues in some cases
