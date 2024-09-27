import { DateTime } from 'luxon'

export type ICEvent = {
    uid?: string,
    dtstart: DateTime,
    dtend?: DateTime,
    summary?: string,
    location?: string,
    description?: string,
    allday?: boolean,
    transp?: string,
}