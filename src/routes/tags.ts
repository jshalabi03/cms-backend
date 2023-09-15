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
  } catch (err) {
    logger.error(err);
    return response.status(500).send();
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
        .where(eq(contentTagsTable.tagId, tagId));
      const transformedRecords = records.map((r) => {
        return { ...r.contents, tagId: r.content_tags.tagId };
      });
      return response.status(200).json(transformedRecords);
    } catch (err) {
      logger.error(err);
      return response.status(500).send();
    }
  }
);

export default tagRoutes;
