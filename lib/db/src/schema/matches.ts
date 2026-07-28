import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  user2Id: integer("user2_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("active"), // active | ended
  user1MsgCount: integer("user1_msg_count").notNull().default(0),
  user2MsgCount: integer("user2_msg_count").notNull().default(0),
  user1RevealRequested: boolean("user1_reveal_requested").notNull().default(false),
  user2RevealRequested: boolean("user2_reveal_requested").notNull().default(false),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
