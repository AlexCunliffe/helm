/**
 * Scheduled jobs (H4). One job so far: the snooze-waker — the first "it comes
 * to you" seam that runs server-side, so a parked task returns on time even
 * with every client closed. Cost: one indexed range read per minute (usually
 * empty), no LLM — negligible.
 */
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("wake expired snoozes", { minutes: 1 }, internal.tasks.wakeExpired, {});

// T-30 meeting-prep promotion (4.2): indexed range read/min, usually empty.
crons.interval("promote meeting prep", { minutes: 1 }, internal.meetings.promotePrep, {});

// Calendar mirror (4.2, D12): skips quietly until the Google OAuth secrets are
// set. 15-min cadence — the thread shows markers, not a live calendar.
crons.interval("sync google calendar", { minutes: 15 }, internal.meetings.syncGoogleCalendar, {});

export default crons;
