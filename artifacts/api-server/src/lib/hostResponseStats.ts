import { asc, eq } from "drizzle-orm";
import { db, messagesTable } from "@workspace/db";

type MessageTiming = {
  threadId: string;
  sender: string;
  createdAt: Date;
};

export type HostResponseStats = {
  answeredCount: number;
  medianMinutes: number | null;
};

export function computeHostResponseStats(rows: MessageTiming[]): HostResponseStats {
  const firstUnansweredGuestAt = new Map<string, number>();
  const responseDurations: number[] = [];

  for (const row of rows) {
    const at = row.createdAt.getTime();
    if (row.sender === "guest") {
      if (!firstUnansweredGuestAt.has(row.threadId)) {
        firstUnansweredGuestAt.set(row.threadId, at);
      }
      continue;
    }

    if (row.sender !== "host") continue;
    const guestAt = firstUnansweredGuestAt.get(row.threadId);
    if (guestAt === undefined) continue;
    responseDurations.push(Math.max(0, at - guestAt));
    firstUnansweredGuestAt.delete(row.threadId);
  }

  if (responseDurations.length < 5) {
    return { answeredCount: responseDurations.length, medianMinutes: null };
  }

  responseDurations.sort((a, b) => a - b);
  const middle = Math.floor(responseDurations.length / 2);
  const medianMs =
    responseDurations.length % 2 === 1
      ? responseDurations[middle]
      : (responseDurations[middle - 1] + responseDurations[middle]) / 2;

  return {
    answeredCount: responseDurations.length,
    medianMinutes: Math.ceil(medianMs / 60_000),
  };
}

export async function getHostResponseStats(tenantId: string): Promise<HostResponseStats> {
  const rows = await db
    .select({
      threadId: messagesTable.threadId,
      sender: messagesTable.sender,
      createdAt: messagesTable.createdAt,
    })
    .from(messagesTable)
    .where(eq(messagesTable.tenantId, tenantId))
    .orderBy(asc(messagesTable.threadId), asc(messagesTable.createdAt));

  return computeHostResponseStats(rows);
}