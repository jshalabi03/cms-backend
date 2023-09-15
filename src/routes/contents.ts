import { db } from "@/db";
import {
  contentHistory as contentHistoryTable,
  contentTags as contentTagsTable,
  contents as contentsTable,
  tags as tagsTable,
} from "@/db/schema";
import logger from "@/winston";
import { eq, sql, desc, and } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { validateRequest, validateRequestParams } from "zod-express-middleware";

const contentRoutes = Router();

contentRoutes.post(
  "/",
  validateRequest({
    body: z.object({
      title: z.string(),
      body: z.string(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  async (request, response) => {
    const { title, body, tags } = request.body;
    try {
      const [newContent] = await db
        .insert(contentsTable)
        .values({
          title,
          body,
        })
        .returning();

      await db.insert(contentHistoryTable).values({
        contentId: newContent.id,
        title,
        body,
        version: 1,
        updatedAt: new Date().toISOString(),
      });

      return response.status(201).json(newContent);
    } catch (error) {
      logger.error(error);
      return response.status(500).send();
    }
  }
);

contentRoutes.get("/", async (_request, response) => {
  try {
    const contentsItems = await db.select().from(contentsTable);
    return response.status(200).json(contentsItems);
  } catch (error) {
    logger.error(error);
    return response.status(500).send();
  }
});

contentRoutes.get(
  "/:contentId",
  validateRequestParams(z.object({ contentId: z.coerce.number() })),
  async (request, response) => {
    const { contentId } = request.params;
    try {
      // Increment views and return content
      const contentRecords = await db
        .update(contentsTable)
        .set({ views: sql`${contentsTable.views} + 1` })
        .where(eq(contentsTable.id, contentId))
        .returning();
      if (!contentRecords.length) {
        return response.status(404).send();
      }
      return response.status(200).json(contentRecords[0]);
    } catch (err) {
      logger.error(err);
      return response.status(500).send();
    }
  }
);

contentRoutes.put(
  "/:contentId",
  validateRequest({
    params: z.object({
      contentId: z.coerce.number(),
    }),
    body: z.object({
      title: z.string().optional(),
      body: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }),
  }),
  async (request, response) => {
    const { contentId } = request.params;
    const { title, body, tags } = request.body;
    try {
      // Get latest version of content
      const maxVersionContent = await db
        .select()
        .from(contentHistoryTable)
        .where(eq(contentHistoryTable.contentId, contentId))
        .orderBy(desc(contentHistoryTable.version));
      const latestVersion = maxVersionContent.length
        ? maxVersionContent[0].version
        : 0;

      // Update content
      const updatedContent = await db
        .update(contentsTable)
        .set({ title, body })
        .where(eq(contentsTable.id, contentId))
        .returning();
      if (!updatedContent.length) {
        return response.status(404).send();
      }
      const updatedContentRecord = updatedContent[0];

      // Update history
      await db.insert(contentHistoryTable).values({
        contentId,
        title: updatedContentRecord.title,
        body: updatedContentRecord.body,
        version: latestVersion + 1,
      });

      if (!updatedContent.length) {
        return response.status(404).send();
      }
      return response.status(200).json(updatedContent[0]);
    } catch (err) {
      logger.error(err);
      return response.status(500).send();
    }
  }
);

contentRoutes.delete(
  "/:contentId",
  validateRequestParams(z.object({ contentId: z.coerce.number() })),
  async (request, response) => {
    const { contentId } = request.params;
    const result = await db
      .delete(contentsTable)
      .where(eq(contentsTable.id, contentId))
      .returning();
    if (result.length === 0) {
      return response.status(404).send();
    }
    return response.status(204).send();
  }
);

contentRoutes.get(
  "/:contentId/history",
  validateRequestParams(z.object({ contentId: z.coerce.number() })),
  async (request, response) => {
    const { contentId } = request.params;
    try {
      const historyRecords = await db
        .select()
        .from(contentHistoryTable)
        .where(eq(contentHistoryTable.contentId, contentId));
      if (!historyRecords.length) {
        return response.status(404).send();
      }
      return response.status(200).json(historyRecords);
    } catch (err) {
      logger.error(err);
      return response.status(500).send();
    }
  }
);

contentRoutes.post(
  "/:contentId/rollback/:version",
  validateRequestParams(
    z.object({
      contentId: z.coerce.number(),
      version: z.coerce.number(),
    })
  ),
  async (request, response) => {
    const { contentId, version } = request.params;
    try {
      const targetRecord = await db
        .select()
        .from(contentHistoryTable)
        .where(
          and(
            eq(contentHistoryTable.contentId, contentId),
            eq(contentHistoryTable.version, version)
          )
        )
        .limit(1);
      if (!targetRecord.length) {
        return response.status(404).send();
      }
      const { title, body } = targetRecord[0];
      const [updatedContent] = await db
        .update(contentsTable)
        .set({ title, body })
        .returning();

      // Find latest version
      const latestVersionRecord = await db
        .select()
        .from(contentHistoryTable)
        .where(eq(contentHistoryTable.contentId, contentId))
        .orderBy(desc(contentHistoryTable.version))
        .limit(1);
      const latestVersion = latestVersionRecord.length
        ? latestVersionRecord[0].version
        : 0;

      // Insert record into contentHistory table with new version
      await db
        .insert(contentHistoryTable)
        .values({
          contentId,
          title,
          body,
          version: latestVersion + 1,
        })
        .returning();

      return response.status(200).json(updatedContent);
    } catch (err) {
      logger.error(err);
      return response.status(500).send();
    }
  }
);

export default contentRoutes;
