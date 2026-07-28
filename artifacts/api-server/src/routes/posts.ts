import { Router, type IRouter } from "express";
import { db, postsTable, usersTable, matchesTable } from "@workspace/db";
import { eq, and, or, lt, desc } from "drizzle-orm";
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
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

// Check if viewer has matched with author (for blur logic)
async function hasMatchedWith(viewerId: number, authorId: number): Promise<boolean> {
  if (viewerId === authorId) return true;
  const [match] = await db
    .select()
    .from(matchesTable)
    .where(
      or(
        and(eq(matchesTable.user1Id, viewerId), eq(matchesTable.user2Id, authorId)),
        and(eq(matchesTable.user1Id, authorId), eq(matchesTable.user2Id, viewerId))
      )
    )
    .limit(1);
  return !!match;
}

// GET /posts
router.get("/posts", requireAuth, async (req, res): Promise<void> => {
  const viewerId = req.dbUserId!;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const cursor = req.query.cursor ? Number(req.query.cursor) : null;

  const [viewer] = await db.select().from(usersTable).where(eq(usersTable.id, viewerId));

  const query = db
    .select({ post: postsTable, author: usersTable })
    .from(postsTable)
    .leftJoin(usersTable, eq(postsTable.authorId, usersTable.id))
    .orderBy(desc(postsTable.createdAt))
    .limit(limit + 1);

  if (cursor) {
    query.where(lt(postsTable.id, cursor));
  }

  const rows = await query;
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  const posts = await Promise.all(
    items.map(async ({ post, author }) => {
      const matched = await hasMatchedWith(viewerId, post.authorId);
      const isBlurred = !matched && !viewer?.isVip;
      return {
        id: post.id,
        authorId: post.authorId,
        authorDisplayName: author?.displayName ?? "Anonymous",
        authorAvatarUrl: author?.avatarUrl ?? null,
        content: post.content,
        imageUrl: post.imageUrl ?? null,
        isBlurred,
        isOwn: post.authorId === viewerId,
        createdAt: post.createdAt.toISOString(),
      };
    })
  );

  res.json({
    posts,
    hasMore,
    nextCursor: hasMore ? items[items.length - 1].post.id : null,
  });
});

// POST /posts
router.post("/posts", requireAuth, async (req, res): Promise<void> => {
  const { content } = req.body;
  if (!content || typeof content !== "string" || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({ authorId: req.dbUserId!, content: content.trim().slice(0, 500) })
    .returning();

  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, req.dbUserId!));

  res.status(201).json({
    id: post.id,
    authorId: post.authorId,
    authorDisplayName: author?.displayName ?? "Anonymous",
    authorAvatarUrl: author?.avatarUrl ?? null,
    content: post.content,
    imageUrl: post.imageUrl ?? null,
    isBlurred: false,
    isOwn: true,
    createdAt: post.createdAt.toISOString(),
  });
});

// DELETE /posts/:id
router.delete("/posts/:id", requireAuth, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.authorId !== req.dbUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(postsTable).where(eq(postsTable.id, id));
  res.sendStatus(204);
});

// POST /posts/:id/image
router.post("/posts/:id/image", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [post] = await db.select().from(postsTable).where(eq(postsTable.id, id));
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  if (post.authorId !== req.dbUserId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const imageUrl = `/api/uploads/${req.file.filename}`;
  await db.update(postsTable).set({ imageUrl }).where(eq(postsTable.id, id));

  res.json({ imageUrl });
});

export default router;
