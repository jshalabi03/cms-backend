import { db } from "@/db";
import {
  contentTags as contentTagsTable,
  contents as contentsTable,
  tags as tagsTable,
} from "@/db/schema";
import logger from "@/winston";
import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { validateRequestParams } from "zod-express-middleware";

const tagRoutes = Router();

tagRoutes.get("/", async (_request, response) => {
  try {
    const records = await db.select().from(tagsTable);
    return response.status(200).json(records);
  } catch (error) {
    logger.error(error);
    return response.status(500).json({ error });
  }
});

tagRoutes.get(
  "/:tagId/contents",
  validateRequestParams(
    z.object({
      tagId: z.coerce.number(),
    })
  ),
  async (request, response) => {
    try {
      const { tagId } = request.params;
      const records = await db
        .select()
        .from(contentsTable)
        .innerJoin(
          contentTagsTable,
          eq(contentsTable.id, contentTagsTable.contentId)
        )
        .innerJoin(tagsTable, eq(contentTagsTable.tagId, tagsTable.id))
        .where(eq(tagsTable.id, tagId));
      const transformedRecords = records.map((r) => {
        return { ...r.contents, tag: r.tags };
      });
      return response.status(200).json(transformedRecords);
    } catch (error) {
      logger.error(error);
      return response.status(500).json({ error });
    }
  }
);

export default tagRoutes;
