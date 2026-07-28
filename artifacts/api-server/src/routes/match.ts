import { Router, type IRouter } from "express";
import { db, usersTable, matchesTable, messagesTable } from "@workspace/db";
import { eq, and, or, desc, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { sendToUser } from "../lib/ws";

const router: IRouter = Router();

// Helper: get active match for a user
async function getActiveMatch(userId: number) {
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)),
        eq(matchesTable.status, "active")
      )
    )
    .limit(1);
  return match ?? null;
}

// Build MatchState response from the perspective of userId
async function buildMatchState(match: typeof matchesTable.$inferSelect, userId: number) {
  const isUser1 = match.user1Id === userId;
  const partnerId = isUser1 ? match.user2Id : match.user1Id;
  const myMsgCount = isUser1 ? match.user1MsgCount : match.user2MsgCount;
  const partnerMsgCount = isUser1 ? match.user2MsgCount : match.user1MsgCount;
  const myRevealRequested = isUser1 ? match.user1RevealRequested : match.user2RevealRequested;
  const partnerRevealRequested = isUser1 ? match.user2RevealRequested : match.user1RevealRequested;

  const [partner] = await db.select().from(usersTable).where(eq(usersTable.id, partnerId));
  const isRevealed = !!match.revealedAt;

  return {
    id: match.id,
    partnerId,
    partnerDisplayName: partner?.displayName ?? "Anonymous",
    partnerAvatarUrl: partner?.avatarUrl ?? null,
    myMessageCount: myMsgCount,
    partnerMessageCount: partnerMsgCount,
    myRevealRequested,
    partnerRevealRequested,
    isRevealed,
    status: match.status,
    createdAt: match.createdAt.toISOString(),
    endedAt: match.endedAt ? match.endedAt.toISOString() : null,
  };
}

// POST /match/search
router.post("/match/search", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUserId!;

  // Can't search if already in active chat
  const existing = await getActiveMatch(userId);
  if (existing) {
    res.status(400).json({ error: "Already in an active chat. End it before searching." });
    return;
  }

  // Check if already searching
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (me.isSearching) {
    res.json({ status: "searching" });
    return;
  }

  // Find another user already searching (not self)
  const [waiting] = await db
    .select()
    .from(usersTable)
    .where(and(eq(usersTable.isSearching, true)))
    .limit(10);

  // Filter out self
  const partner = waiting && waiting.id !== userId ? waiting : null;

  if (partner) {
    // Create a match
    const [match] = await db
      .insert(matchesTable)
      .values({ user1Id: partner.id, user2Id: userId })
      .returning();

    // Mark both as no longer searching
    await db.update(usersTable).set({ isSearching: false }).where(eq(usersTable.id, partner.id));
    await db.update(usersTable).set({ isSearching: false }).where(eq(usersTable.id, userId));

    // Notify waiting partner via WS
    const partnerMatchState = await buildMatchState(match, partner.id);
    sendToUser(partner.id, { type: "match_found", match: partnerMatchState });

    const myMatchState = await buildMatchState(match, userId);
    res.json({ status: "matched", match: myMatchState });
  } else {
    // Mark user as searching
    await db.update(usersTable).set({ isSearching: true }).where(eq(usersTable.id, userId));
    res.json({ status: "searching" });
  }
});

// DELETE /match/search
router.delete("/match/search", requireAuth, async (req, res): Promise<void> => {
  await db.update(usersTable).set({ isSearching: false }).where(eq(usersTable.id, req.dbUserId!));
  res.sendStatus(204);
});

// GET /match/current
router.get("/match/current", requireAuth, async (req, res): Promise<void> => {
  const match = await getActiveMatch(req.dbUserId!);
  if (!match) {
    res.status(404).json({ error: "No active match" });
    return;
  }
  const state = await buildMatchState(match, req.dbUserId!);
  res.json(state);
});

// DELETE /match/current (end chat)
router.delete("/match/current", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUserId!;
  const match = await getActiveMatch(userId);
  if (!match) {
    res.status(404).json({ error: "No active match" });
    return;
  }

  await db
    .update(matchesTable)
    .set({ status: "ended", endedAt: new Date() })
    .where(eq(matchesTable.id, match.id));

  const partnerId = match.user1Id === userId ? match.user2Id : match.user1Id;
  sendToUser(partnerId, { type: "chat_ended", matchId: match.id });

  res.sendStatus(204);
});

// GET /match/current/messages
router.get("/match/current/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUserId!;
  const match = await getActiveMatch(userId);
  if (!match) {
    res.status(404).json({ error: "No active match" });
    return;
  }

  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const rows = await db
    .select()
    .from(messagesTable)
    .where(
      cursor
        ? and(eq(messagesTable.matchId, match.id), lt(messagesTable.id, cursor))
        : eq(messagesTable.matchId, match.id)
    )
    .orderBy(desc(messagesTable.createdAt))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  res.json({
    messages: items.map((m) => ({
      id: m.id,
      matchId: m.matchId,
      senderId: m.senderId,
      content: m.content,
      isMine: m.senderId === userId,
      createdAt: m.createdAt.toISOString(),
    })),
    hasMore,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  });
});

// POST /match/current/messages
router.post("/match/current/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUserId!;
  const match = await getActiveMatch(userId);
  if (!match) {
    res.status(404).json({ error: "No active match" });
    return;
  }

  const { content } = req.body;
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [message] = await db
    .insert(messagesTable)
    .values({ matchId: match.id, senderId: userId, content: content.trim().slice(0, 1000) })
    .returning();

  // Increment message count for sender
  const isUser1 = match.user1Id === userId;
  if (isUser1) {
    await db
      .update(matchesTable)
      .set({ user1MsgCount: match.user1MsgCount + 1 })
      .where(eq(matchesTable.id, match.id));
  } else {
    await db
      .update(matchesTable)
      .set({ user2MsgCount: match.user2MsgCount + 1 })
      .where(eq(matchesTable.id, match.id));
  }

  const partnerId = isUser1 ? match.user2Id : match.user1Id;
  const newCount = isUser1 ? match.user1MsgCount + 1 : match.user2MsgCount + 1;

  const msgPayload = {
    id: message.id,
    matchId: message.matchId,
    senderId: message.senderId,
    content: message.content,
    isMine: false,
    createdAt: message.createdAt.toISOString(),
  };

  // Notify partner via WS
  sendToUser(partnerId, {
    type: "new_message",
    message: msgPayload,
    senderMsgCount: newCount,
  });

  res.status(201).json({ ...msgPayload, isMine: true });
});

// POST /match/current/reveal
router.post("/match/current/reveal", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUserId!;
  const match = await getActiveMatch(userId);
  if (!match) {
    res.status(404).json({ error: "No active match" });
    return;
  }

  const isUser1 = match.user1Id === userId;
  const partnerId = isUser1 ? match.user2Id : match.user1Id;

  const myRevealRequested = true;
  const partnerRevealRequested = isUser1 ? match.user2RevealRequested : match.user1RevealRequested;
  const bothRevealed = myRevealRequested && partnerRevealRequested;

  if (isUser1) {
    await db
      .update(matchesTable)
      .set({
        user1RevealRequested: true,
        ...(bothRevealed ? { revealedAt: new Date() } : {}),
      })
      .where(eq(matchesTable.id, match.id));
  } else {
    await db
      .update(matchesTable)
      .set({
        user2RevealRequested: true,
        ...(bothRevealed ? { revealedAt: new Date() } : {}),
      })
      .where(eq(matchesTable.id, match.id));
  }

  // Notify partner
  sendToUser(partnerId, {
    type: "reveal_update",
    myRevealRequested: partnerRevealRequested,
    partnerRevealRequested: true,
    isRevealed: bothRevealed,
  });

  res.json({
    myRevealRequested: true,
    partnerRevealRequested,
    isRevealed: bothRevealed,
  });
});

// GET /match/history
router.get("/match/history", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUserId!;
  const matches = await db
    .select()
    .from(matchesTable)
    .where(
      and(
        or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)),
        eq(matchesTable.status, "ended")
      )
    )
    .orderBy(desc(matchesTable.createdAt))
    .limit(50);

  const result = await Promise.all(
    matches.map(async (m) => {
      const isUser1 = m.user1Id === userId;
      const partnerId = isUser1 ? m.user2Id : m.user1Id;
      const myMsgCount = isUser1 ? m.user1MsgCount : m.user2MsgCount;
      const partnerMsgCount = isUser1 ? m.user2MsgCount : m.user1MsgCount;
      const [partner] = await db.select().from(usersTable).where(eq(usersTable.id, partnerId));
      return {
        id: m.id,
        partnerDisplayName: partner?.displayName ?? "Anonymous",
        partnerAvatarUrl: partner?.avatarUrl ?? null,
        myMessageCount: myMsgCount,
        partnerMessageCount: partnerMsgCount,
        isRevealed: !!m.revealedAt,
        createdAt: m.createdAt.toISOString(),
        endedAt: m.endedAt ? m.endedAt.toISOString() : null,
      };
    })
  );

  res.json({ matches: result });
});

export default router;
