import { Router } from "express";
import { eq, sql, desc, and } from "drizzle-orm";
import { z } from "zod";
import { validateRequest, validateRequestParams } from "zod-express-middleware";
import logger from "@/winston";

import { db } from "@/db";
import {
  contentHistory as contentHistoryTable,
  contentTags as contentTagsTable,
  contents as contentsTable,
  tags as tagsTable,
} from "@/db/schema";

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
    return await db.transaction(async (tx) => {
      // Insert new content
      const [newContent] = await tx
        .insert(contentsTable)
        .values({
          title,
          body,
        })
        .returning();

      // Retrieve or insert tags
      const tagPromises =
        tags?.map(async (name: string) => {
          const existingTag = await tx
            .select()
            .from(tagsTable)
            .where(eq(tagsTable.name, name));
          if (existingTag.length > 0) {
            return existingTag[0];
          } else {
            const [newTag] = await tx
              .insert(tagsTable)
              .values({ name })
              .returning();
            return newTag;
          }
        }) || [];
      const tagResults = await Promise.all(tagPromises);

      // Insert content tags
      const insertContentTags = tagResults.map((tag) => {
        return tx.insert(contentTagsTable).values({
          contentId: newContent.id,
          tagId: tag.id,
        });
      });
      await Promise.allSettled(insertContentTags);

      // Insert content history
      await db.insert(contentHistoryTable).values({
        contentId: newContent.id,
        title,
        body,
        version: 1,
        updatedAt: new Date().toISOString(),
      });

      return response
        .status(201)
        .json({ ...newContent, tags: tagResults.map((t) => t.name) });
    });
  }
);

contentRoutes.get("/", async (_request, response) => {
  const contentsItems = await db
    .select({
      contents: contentsTable,
      tagName: tagsTable.name,
    })
    .from(contentsTable)
    .leftJoin(
      contentTagsTable,
      eq(contentTagsTable.contentId, contentsTable.id)
    )
    .leftJoin(tagsTable, eq(contentTagsTable.tagId, tagsTable.id));
  const aggregatedContents = contentsItems.reduce<
    Record<
      number,
      {
        content: {
          id: number;
          title: string;
          body: string | null;
          views: number | null;
        };
        tags: string[];
      }
    >
  >((acc, item) => {
    const { contents, tagName } = item;
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
    if (tagName) acc[contents.id].tags.push(tagName);
    return acc;
  }, {});

  const result = Object.values(aggregatedContents).map((r) => {
    return { ...r.content, tags: r.tags };
  });
  return response.status(200).json(result);
});

contentRoutes.get(
  "/:contentId",
  validateRequestParams(z.object({ contentId: z.coerce.number() })),
  async (request, response) => {
    const { contentId } = request.params;
    return await db.transaction(async (tx) => {
      // Increment views and return content
      const contentRecords = await tx
        .update(contentsTable)
        .set({ views: sql`${contentsTable.views} + 1` })
        .where(eq(contentsTable.id, contentId))
        .returning();
      if (!contentRecords.length) {
        return response.status(404).send();
      }
      const tagRecords = await tx
        .select()
        .from(contentTagsTable)
        .innerJoin(tagsTable, eq(tagsTable.id, contentTagsTable.tagId))
        .where(eq(contentTagsTable.contentId, contentId));
      const tags = tagRecords.map((r) => r.tags.name);
      return response.status(200).json({ ...contentRecords[0], tags });
    });
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
    return await db.transaction(async (tx) => {
      // Get latest version of content
      const maxVersionContent = await tx
        .select()
        .from(contentHistoryTable)
        .where(eq(contentHistoryTable.contentId, contentId))
        .orderBy(desc(contentHistoryTable.version))
        .limit(1);
      const latestVersion = maxVersionContent.length
        ? maxVersionContent[0].version
        : 0;

      // Update or retrieve content
      const updatedContent =
        title || body
          ? await tx
              .update(contentsTable)
              .set({ title, body })
              .where(eq(contentsTable.id, contentId))
              .returning()
          : await tx
              .select()
              .from(contentsTable)
              .where(eq(contentsTable.id, contentId));
      if (!updatedContent.length) {
        return response.status(404).send();
      }
      const updatedContentRecord = updatedContent[0];

      // Update history
      await tx.insert(contentHistoryTable).values({
        contentId,
        title: updatedContentRecord.title,
        body: updatedContentRecord.body,
        version: latestVersion + 1,
      });

      // Retrieve or insert tags
      const tagPromises =
        tags?.map(async (name: string) => {
          const existingTag = await tx
            .select()
            .from(tagsTable)
            .where(eq(tagsTable.name, name));
          if (existingTag.length > 0) {
            return existingTag[0];
          } else {
            const [newTag] = await tx
              .insert(tagsTable)
              .values({ name })
              .returning();
            return newTag;
          }
        }) || [];
      const tagResults = await Promise.all(tagPromises);

      // Delete old content tags if new ones are specified, retrieve otherwise
      if (tagResults.length) {
        await tx
          .delete(contentTagsTable)
          .where(eq(contentTagsTable.contentId, contentId))
          .returning();
      }

      // Fetch old content tags, if still exist
      const oldTags = await tx
        .select()
        .from(contentTagsTable)
        .innerJoin(tagsTable, eq(tagsTable.id, contentTagsTable.tagId))
        .where(eq(contentTagsTable.contentId, contentId));

      // Insert new content tags
      const insertContentTags = tagResults.map((tag) => {
        return tx.insert(contentTagsTable).values({
          contentId: updatedContentRecord.id,
          tagId: tag.id,
        });
      });
      await Promise.allSettled(insertContentTags);
      const tagsArr = tagResults.length
        ? tagResults.map((r) => r.name)
        : oldTags.map((r) => r.tags.name);
      return response.status(200).json({ ...updatedContentRecord, tagsArr });
    });
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
    const historyRecords = await db
      .select()
      .from(contentHistoryTable)
      .where(eq(contentHistoryTable.contentId, contentId))
      .orderBy(desc(contentHistoryTable.version));
    if (!historyRecords.length) {
      return response.status(404).send();
    }
    return response.status(200).json(historyRecords);
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
    return await db.transaction(async (tx) => {
      const targetRecord = await tx
        .select()
        .from(contentHistoryTable)
        .where(
          and(
            eq(contentHistoryTable.contentId, contentId),
            eq(contentHistoryTable.version, version)
          )
        );
      if (!targetRecord.length) {
        return response.status(404).send();
      }
      const { title, body } = targetRecord[0];
      const [updatedContent] = await tx
        .update(contentsTable)
        .set({ title, body })
        .returning();

      // Find latest version
      const latestVersionRecord = await tx
        .select()
        .from(contentHistoryTable)
        .where(eq(contentHistoryTable.contentId, contentId))
        .orderBy(desc(contentHistoryTable.version))
        .limit(1);
      const latestVersion = latestVersionRecord.length
        ? latestVersionRecord[0].version
        : 0;

      // Insert record into contentHistory table with new version
      await tx
        .insert(contentHistoryTable)
        .values({
          contentId,
          title,
          body,
          version: latestVersion + 1,
        })
        .returning();

      return response.status(200).json(updatedContent);
    });
  }
);

export default contentRoutes;
