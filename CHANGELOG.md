1.3.0 changes (November 2026) by Claude Opus 5.5:
 - The parser and `VEvent.expandRecurrence` now return the occurrences that overlap the requested range, including those that started before it and are still running (RFC 4791 9.9 time-range rule). Previously only the occurrences starting in the range were returned. Occurrences without duration are instants, returned when they are in the range.

1.2.0 changes (November 2026) by Claude Opus 5.5: 
 - Fix modified occurrences (RECURRENCE-ID) when the original and the new start are not both in the requested range: a moved occurrence was missing from a range containing only its new start, and the original occurrence was still returned in a range containing only its original start.
 - Use the modified version with the highest SEQUENCE regardless of its position in the feed.
 - Apply modified occurrences whose SEQUENCE is lower than the SEQUENCE of their series: each component is versioned independently (RFC 5545), and some exports (e.g. Evolution) keep the series SEQUENCE higher.
 - Keep modified occurrences whose series is not in the feed (e.g. an invitation to a single occurrence) as standalone events.
 - RRULE COUNT now bounds the whole recurrence set: occurrences before the requested range and occurrences removed by EXDATE are counted, as specified by RFC 5545.
 - Add tests (`npm test`).

1.1.1 changes (March 2026): 
 - RECURRENCE-ID override with SEQUENCE handling has been implemented
 - Updated the README with more usage example
 - Added a quick guide to wrap the library into a CLI tool.
 - Added a quick guide to create a openclaw skill to call the library using the CLI tool.