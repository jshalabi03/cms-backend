import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { validateRequestParams } from "zod-express-middleware";

import { db } from "@/db";
import {
  contentTags as contentTagsTable,
  contents as contentsTable,
  tags as tagsTable,
} from "@/db/schema";

const tagRoutes = Router();

tagRoutes.get("/", async (_request, response) => {
  const records = await db.select().from(tagsTable);
  return response.status(200).json(records);
});

tagRoutes.get(
  "/:tagId/contents",
  validateRequestParams(
    z.object({
      tagId: z.coerce.number(),
    })
  ),
  async (request, response) => {
    const { tagId } = request.params;
    const records = await db
      .select({
        contents: contentsTable,
        tag: tagsTable,
      })
      .from(contentsTable)
      .leftJoin(
        contentTagsTable,
        eq(contentsTable.id, contentTagsTable.contentId)
      )
      .leftJoin(tagsTable, eq(contentTagsTable.tagId, tagsTable.id))
      .where(eq(tagsTable.id, tagId));
    const aggregatedRecords = records.reduce<
      Record<
        number,
        {
          content: {
            id: number;
            title: string;
            body: string | null;
            views: number | null;
          };
          tags: {
            id: number;
            name: string;
          }[];
        }
      >
    >((acc, item) => {
      const { contents, tag } = item;
      if (!acc[contents.id]) {
        acc[contents.id] = {
          content: {
            id: contents.id,
            title: contents.title,
            body: contents.body,
            views: contents.views,
          },
          tags: [],
        };
      }
      if (tag) acc[contents.id].tags.push(tag);
      return acc;
    }, {});
    const result = Object.values(aggregatedRecords)
      .filter((r) => r.tags.find((tag) => tag.id == tagId))
      .map((r) => {
        return { ...r.content, tags: r.tags.map((t) => t.name) };
      });
    return response.status(200).json(result);
  }
);

tagRoutes.delete("/", async (_request, response) => {
  await db.delete(tagsTable).returning();
  return response.status(204).send();
});

export default tagRoutes;
