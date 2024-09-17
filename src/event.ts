import { DateTime } from 'luxon'

export type Event = {
    uid?: string,
    dtstart: DateTime,
    dtend?: DateTime,
    summary?: string,
    location?: string,
    description?: string,
    allday?: boolean,
}