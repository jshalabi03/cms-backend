/**
 * Testing utility
 */

import { db } from "../src/db";
import {
  contents as contentsTable,
  contentHistory as contentHistoryTable,
  tags as tagsTable,
  contentTags as contentTagsTable,
} from "../src/db/schema";

export async function clearDb() {
  await db.delete(contentsTable);
  await db.delete(contentHistoryTable);
  await db.delete(tagsTable);
  await db.delete(contentTagsTable);
}

/* RESPONSE VALIDATION */

export interface CreateContentRequest {
  title: string;
  body: string;
  tags: Array<string> | null;
}

export interface UpdateContentRequest {
  title: string | null;
  body: string | null;
  tags: Array<string> | null;
}
