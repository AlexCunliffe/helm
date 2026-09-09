/** Complete, bounded Google event snapshots. No persistence until every page succeeds. */
import { ConvexError } from "convex/values";
export const MEETING_LIMIT = 1000;
export type MeetingInput = { eventId: string; title: string; startAt: number; endAt: number; url?: string };

export function validateWindow(windowStart: number, windowEnd: number, meetings: MeetingInput[]) {
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart || windowEnd - windowStart > 72 * 3600_000)
    throw new ConvexError("Use a calendar window of at most 72 hours.");
  if (meetings.length > MEETING_LIMIT) throw new ConvexError("Calendar window exceeds 1000 meetings. Narrow the calendar before syncing.");
  const seen = new Set<string>();
  for (const m of meetings) {
    if (typeof m.eventId !== "string" || !m.eventId || m.eventId.length > 1024 || seen.has(m.eventId))
      throw new ConvexError("Calendar snapshot has an invalid or duplicate event ID.");
    seen.add(m.eventId);
    if (typeof m.title !== "string" || m.title.length > 2000 || (m.url !== undefined && (typeof m.url !== "string" || m.url.length > 4096)))
      throw new ConvexError("Calendar snapshot has an oversized or invalid event field.");
    if (!Number.isFinite(m.startAt) || !Number.isFinite(m.endAt) || m.endAt <= m.startAt || m.endAt <= windowStart || m.startAt >= windowEnd)
      throw new ConvexError("Calendar snapshot contains an invalid time or an event outside its window.");
  }
  if (JSON.stringify(meetings).length * 3 > 2 * 1024 * 1024)
    throw new ConvexError("Calendar snapshot exceeds the supported payload. Narrow the calendar before syncing.");
}

type GoogleEvent = { id?: string; summary?: string; htmlLink?: string; status?: string;
  start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } };

export async function loadCalendarWindow(accessToken: string, windowStart: number, windowEnd: number, request: typeof fetch = fetch): Promise<MeetingInput[]> {
  validateWindow(windowStart, windowEnd, []);
  const params = new URLSearchParams({ timeMin: new Date(windowStart).toISOString(), timeMax: new Date(windowEnd).toISOString(),
    singleEvents: "true", orderBy: "startTime", maxResults: "100", fields: "nextPageToken,items(id,summary,htmlLink,status,start,end)" });
  const meetings: MeetingInput[] = [], tokens = new Set<string>();
  let itemsRead = 0;
  for (let page = 0; page < 20; page++) {
    const response = await request(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`calendar: events fetch failed (${response.status})`);
    const raw = await response.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("calendar: invalid event page");
    const data = raw as { items?: GoogleEvent[]; nextPageToken?: string };
    if ((data.items !== undefined && !Array.isArray(data.items)) || (data.nextPageToken !== undefined && typeof data.nextPageToken !== "string"))
      throw new Error("calendar: invalid event page");
    itemsRead += (data.items ?? []).length;
    if (itemsRead > MEETING_LIMIT) throw new ConvexError("Calendar response exceeds 1000 events. No mirror changes were made.");
    for (const event of data.items ?? []) {
      if (event.status === "cancelled") continue;
      if (event.start?.date && event.end?.date && !event.start.dateTime && !event.end.dateTime) continue;
      meetings.push({ eventId: event.id!, title: event.summary ?? "(untitled)",
        startAt: Date.parse(event.start?.dateTime ?? ""), endAt: Date.parse(event.end?.dateTime ?? ""),
        ...(event.htmlLink !== undefined ? { url: event.htmlLink } : {}) });
    }
    validateWindow(windowStart, windowEnd, meetings);
    if (!data.nextPageToken) return meetings;
    if (tokens.has(data.nextPageToken)) throw new Error("calendar: repeated page token; no mirror changes were made");
    tokens.add(data.nextPageToken); params.set("pageToken", data.nextPageToken);
  }
  throw new ConvexError("Calendar pagination exceeded 20 pages. No mirror changes were made.");
}
