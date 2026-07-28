import { Router, type IRouter } from "express";
import { db, usersTable, postsTable, matchesTable } from "@workspace/db";
import { eq, count, and, or } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

const uploadDir = "/tmp/uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// GET /users/me
router.get("/users/me", requireAuth, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isVip: user.isVip,
    isOnline: user.isOnline,
    isSearching: user.isSearching,
    createdAt: user.createdAt.toISOString(),
  });
});

// PUT /users/me
router.put("/users/me", requireAuth, async (req, res): Promise<void> => {
  const { displayName, username, bio } = req.body;
  const updates: Record<string, unknown> = {};
  if (displayName != null) updates.displayName = String(displayName).slice(0, 50);
  if (username != null) updates.username = String(username).slice(0, 30).toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (bio != null) updates.bio = String(bio).slice(0, 300);

  const [user] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, req.dbUserId!))
    .returning();

  res.json({
    id: user.id,
    clerkId: user.clerkId,
    displayName: user.displayName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    isVip: user.isVip,
    isOnline: user.isOnline,
    isSearching: user.isSearching,
    createdAt: user.createdAt.toISOString(),
  });
});

// POST /users/me/avatar
router.post("/users/me/avatar", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const avatarUrl = `/api/uploads/${req.file.filename}`;
  const [user] = await db
    .update(usersTable)
    .set({ avatarUrl })
    .where(eq(usersTable.id, req.dbUserId!))
    .returning();

  res.json({ avatarUrl: user.avatarUrl });
});

// GET /users/me/stats
router.get("/users/me/stats", requireAuth, async (req, res): Promise<void> => {
  const userId = req.dbUserId!;

  const [postCount] = await db
    .select({ count: count() })
    .from(postsTable)
    .where(eq(postsTable.authorId, userId));

  const allMatches = await db
    .select()
    .from(matchesTable)
    .where(and(
      or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)),
      eq(matchesTable.status, "ended")
    ));

  let totalMessages = 0;
  let totalReveals = 0;
  for (const m of allMatches) {
    totalMessages += m.user1Id === userId ? m.user1MsgCount : m.user2MsgCount;
    if (m.revealedAt) totalReveals++;
  }

  res.json({
    totalChats: allMatches.length,
    totalMessages,
    totalReveals,
    postsCount: postCount?.count ?? 0,
  });
});

export default router;
