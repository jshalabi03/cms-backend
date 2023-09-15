// schema.ts
import { sql } from "drizzle-orm";
import {
  sqliteTable,
  integer,
  text,
  primaryKey,
} from "drizzle-orm/sqlite-core";

/* CONTENT */

export const contents = sqliteTable("contents", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  body: text("body"),
  views: integer("views").default(0),
});

/* CONTENT HISTORY */

export const contentHistory = sqliteTable("content_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  contentId: integer("content_id").references(() => contents.id, {
    onDelete: "cascade",
  }),
  title: text("title").notNull(),
  body: text("body"),
  version: integer("version").notNull(),
  updatedAt: text("updated_at").default(sql`CURRENT_TIMESTAMP`),
});

/* TAGS */

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
});

export const contentTags = sqliteTable(
  "content_tags",
  {
    contentId: integer("content_id").references(() => contents.id, {
      onDelete: "cascade",
    }),
    tagId: integer("tag_id").references(() => tags.id, {
      onDelete: "cascade",
    }),
  },
  (table) => {
    return {
      pk: primaryKey(table.contentId, table.tagId),
    };
  }
);
