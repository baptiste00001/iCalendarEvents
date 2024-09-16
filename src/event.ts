import { UUID } from "crypto";

//Model
export type Event = {
    uuid?: UUID,
    dtStart: string,
    dtEnd?: string,
    summary?: string,
    location?: string,
    description?: string,
    calendarID?: UUID,// to which calendar this event belongs to
}