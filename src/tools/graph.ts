/**
 * Microsoft Graph API tools: whoami, list_emails, read_email, send_email,
 * list_events, create_event.
 */

import { z } from "zod";
import type { GraphConfig } from "../config.js";
import { getGraphToken } from "../util/tokens.js";
import { detectTimezone } from "../util/timezone.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphFetch(config: GraphConfig, path: string, init?: RequestInit) {
  const token = await getGraphToken(config);
  const tz = detectTimezone();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (!headers["Prefer"]) {
    headers["Prefer"] = `outlook.timezone="${tz}"`;
  }
  const resp = await fetch(`${GRAPH_BASE}${path}`, { ...init, headers });
  return resp;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]!;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

export const graphListEmailsSchema = {
  top: z.number().int().min(1).max(50).default(10).describe("Number of emails (1-50)"),
  search: z.string().optional().describe("Search query"),
  folder: z
    .enum(["Inbox", "SentItems", "Drafts", "DeletedItems"])
    .optional()
    .describe("Mail folder"),
  unread_only: z.boolean().optional().describe("Only unread emails"),
};

export const graphReadEmailSchema = {
  id: z.string().describe("Email message ID"),
};

export const graphSendEmailSchema = {
  to: z.string().describe("Comma-separated recipient addresses"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body (HTML or plain text)"),
  cc: z.string().optional().describe("Comma-separated CC addresses"),
};

export const graphListEventsSchema = {
  days: z.number().int().min(1).max(30).default(1).describe("Lookahead in days (1-30)"),
  date: z.string().optional().describe("Start date (YYYY-MM-DD), defaults to today"),
};

export const graphCreateEventSchema = {
  subject: z.string().describe("Event subject"),
  start: z.string().describe("Start datetime (ISO 8601)"),
  end: z.string().describe("End datetime (ISO 8601)"),
  attendees: z.string().optional().describe("Comma-separated attendee emails"),
  body: z.string().optional().describe("Event body/description"),
  is_online: z.boolean().default(true).describe("Create as online meeting"),
};

// ---------------------------------------------------------------------------
// graph_whoami
// ---------------------------------------------------------------------------

export async function graphWhoami(config: GraphConfig) {
  const resp = await graphFetch(
    config,
    "/me?$select=displayName,mail,jobTitle,department,officeLocation",
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph /me returned ${resp.status}: ${text}`);
  }
  const d = (await resp.json()) as any;
  return {
    name: d.displayName ?? "",
    email: d.mail ?? "",
    jobTitle: d.jobTitle ?? "",
    department: d.department ?? "",
    officeLocation: d.officeLocation ?? "",
  };
}

// ---------------------------------------------------------------------------
// graph_list_emails
// ---------------------------------------------------------------------------

export async function graphListEmails(
  config: GraphConfig,
  args: { top?: number; search?: string; folder?: string; unread_only?: boolean },
) {
  const top = args.top ?? 10;
  const params = new URLSearchParams({
    $top: String(top),
    $select: "id,subject,from,receivedDateTime,bodyPreview,isRead",
    $orderby: "receivedDateTime desc",
  });
  if (args.search) params.set("$search", `"${args.search}"`);
  if (args.unread_only) params.set("$filter", "isRead eq false");

  const folder = args.folder ?? "Inbox";
  const path = `/me/mailFolders/${folder}/messages?${params}`;
  const resp = await graphFetch(config, path);

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph messages returned ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const emails = (data.value ?? []).map((m: any) => ({
    id: m.id,
    subject: m.subject ?? "",
    from: m.from?.emailAddress?.address ?? "",
    fromName: m.from?.emailAddress?.name ?? "",
    receivedDateTime: m.receivedDateTime ?? "",
    bodyPreview: m.bodyPreview ?? "",
    isRead: m.isRead ?? false,
  }));

  return { emails, count: emails.length };
}

// ---------------------------------------------------------------------------
// graph_read_email
// ---------------------------------------------------------------------------

export async function graphReadEmail(config: GraphConfig, args: { id: string }) {
  const tz = detectTimezone();
  const resp = await graphFetch(config, `/me/messages/${args.id}`, {
    headers: {
      Prefer: `outlook.body-content-type="text",outlook.timezone="${tz}"`,
    } as any,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph read email returned ${resp.status}: ${text}`);
  }

  const m = (await resp.json()) as any;
  return {
    subject: m.subject ?? "",
    from: m.from?.emailAddress?.address ?? "",
    to: (m.toRecipients ?? []).map((r: any) => r.emailAddress?.address ?? ""),
    cc: (m.ccRecipients ?? []).map((r: any) => r.emailAddress?.address ?? ""),
    receivedDateTime: m.receivedDateTime ?? "",
    body: m.body?.content ?? "",
    hasAttachments: m.hasAttachments ?? false,
  };
}

// ---------------------------------------------------------------------------
// graph_send_email
// ---------------------------------------------------------------------------

export async function graphSendEmail(
  config: GraphConfig,
  args: { to: string; subject: string; body: string; cc?: string },
) {
  const toRecipients = args.to
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((addr) => ({ emailAddress: { address: addr } }));

  const message: Record<string, any> = {
    subject: args.subject,
    body: { contentType: "HTML", content: args.body },
    toRecipients,
  };

  if (args.cc) {
    message.ccRecipients = args.cc
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map((addr) => ({ emailAddress: { address: addr } }));
  }

  const resp = await graphFetch(config, "/me/sendMail", {
    method: "POST",
    headers: { "Content-Type": "application/json" } as any,
    body: JSON.stringify({ message }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph sendMail returned ${resp.status}: ${text}`);
  }

  return { success: true, message: "Email sent successfully" };
}

// ---------------------------------------------------------------------------
// graph_list_events
// ---------------------------------------------------------------------------

export async function graphListEvents(
  config: GraphConfig,
  args: { days?: number; date?: string },
) {
  const days = args.days ?? 1;
  const startDate = args.date ? new Date(args.date) : new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + days);

  const params = new URLSearchParams({
    startDateTime: startDate.toISOString(),
    endDateTime: endDate.toISOString(),
    $top: "50",
    $select: "subject,start,end,location,isOnlineMeeting,organizer,webLink",
    $orderby: "start/dateTime",
  });

  const resp = await graphFetch(config, `/me/calendarView?${params}`);

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph calendarView returned ${resp.status}: ${text}`);
  }

  const data = (await resp.json()) as any;
  const events = (data.value ?? []).map((ev: any) => ({
    subject: ev.subject ?? "",
    start: ev.start?.dateTime ?? "",
    end: ev.end?.dateTime ?? "",
    location: ev.location?.displayName ?? "",
    isOnlineMeeting: ev.isOnlineMeeting ?? false,
    organizer: ev.organizer?.emailAddress?.address ?? "",
    webLink: ev.webLink ?? "",
  }));

  return {
    events,
    count: events.length,
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
  };
}

// ---------------------------------------------------------------------------
// graph_create_event
// ---------------------------------------------------------------------------

export async function graphCreateEvent(
  config: GraphConfig,
  args: {
    subject: string;
    start: string;
    end: string;
    attendees?: string;
    body?: string;
    is_online?: boolean;
  },
) {
  const tz = detectTimezone();
  const eventBody: Record<string, any> = {
    subject: args.subject,
    start: { dateTime: args.start, timeZone: tz },
    end: { dateTime: args.end, timeZone: tz },
    isOnlineMeeting: args.is_online ?? true,
  };

  if (args.attendees) {
    eventBody.attendees = args.attendees
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map((addr) => ({
        emailAddress: { address: addr },
        type: "required",
      }));
  }

  if (args.body) {
    eventBody.body = { contentType: "HTML", content: args.body };
  }

  const resp = await graphFetch(config, "/me/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" } as any,
    body: JSON.stringify(eventBody),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Graph create event returned ${resp.status}: ${text}`);
  }

  const ev = (await resp.json()) as any;
  return {
    success: true,
    id: ev.id ?? "",
    subject: ev.subject ?? "",
    webLink: ev.webLink ?? "",
    message: "Event created successfully",
  };
}
