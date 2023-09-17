/**
 * This file contains integration tests for the backend API
 * Testcases use an in-memory sqlite3 DB that is migrated before each run @see /src/db
 * Tests validate HTTP responses and DB state for API
 */

import request from "supertest";
import app from "../src/app";
import { db } from "../src/db";
import {
  contents as contentsTable,
  contentHistory as contentHistoryTable,
  tags as tagsTable,
  contentTags as contentTagsTable,
} from "../src/db/schema";
import { migrate } from "../src/db/migrate";
import { asc, desc, eq } from "drizzle-orm";
import { CreateContentRequest, UpdateContentRequest, clearDb } from "./util";

/* SUPERTEST HELPERS */

async function createContent(content: CreateContentRequest) {
  return await request(app).post("/api/contents").send(content);
}

async function getContents() {
  return await request(app).get("/api/contents");
}

async function getContent(id: number) {
  return await request(app).get(`/api/contents/${id}`);
}

async function updateContent(id: number, content: UpdateContentRequest) {
  return await request(app).put(`/api/contents/${id}`).send(content);
}

async function deleteContent(id: number) {
  return await request(app).delete(`/api/contents/${id}`);
}

async function rollbackContent(id: number, version: number) {
  return await request(app).post(`/api/contents/${id}/rollback/${version}`);
}

async function getTags() {
  return await request(app).get("/api/tags");
}

async function getTaggedContent(tagId: number) {
  return await request(app).get(`/api/tags/${tagId}/contents`);
}

/* Other helpers */

const SAMPLE_CONTENT = {
  title: "Test Content",
  body: "Test Body",
  tags: ["tag1", "tag2"],
};

async function insertSampleContent() {
  return await createContent(SAMPLE_CONTENT);
}

/* TEST SUITE */

describe("Test api", () => {
  beforeAll(async () => {
    await migrate();
  });

  beforeEach(async () => {
    await clearDb();
  });

  afterEach(async () => {
    await clearDb();
  });

  it("should create a new content and history entry", async () => {
    const res = await insertSampleContent();

    // Validate response
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title", SAMPLE_CONTENT.title);
    expect(res.body).toHaveProperty("body", SAMPLE_CONTENT.body);
    expect(res.body).toHaveProperty("views", 0);

    // Validate DB
    const records = await db.select().from(contentsTable);
    expect(records.length).toEqual(1);
    expect(records[0].title).toEqual(SAMPLE_CONTENT.title);
    expect(records[0].body).toEqual(SAMPLE_CONTENT.body);
    expect(records[0].views).toEqual(0);

    const historyRecords = await db.select().from(contentHistoryTable);
    expect(historyRecords.length).toEqual(1);
    expect(historyRecords[0].contentId).toEqual(records[0].id);
    expect(historyRecords[0].title).toEqual(SAMPLE_CONTENT.title);
    expect(historyRecords[0].body).toEqual(SAMPLE_CONTENT.body);
    expect(historyRecords[0].version).toEqual(1);
  });

  it("should fetch all contents", async () => {
    const newContent: CreateContentRequest = {
      title: "Test Content",
      body: "Test Body",
      tags: ["test1", "test2"],
    };
    await createContent(newContent);
    const res = await getContents();

    // Validate response
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toEqual(1);
    expect(res.body[0].title).toEqual("Test Content");
    expect(res.body[0].body).toEqual("Test Body");
    expect(res.body[0].views).toEqual(0);
  });

  it("should fetch a content by id and update views by 1", async () => {
    const newContent: CreateContentRequest = {
      title: "Test Content",
      body: "Test Body",
      tags: ["test1", "test2"],
    };
    const createResponse = await createContent(newContent);
    const res = await getContent(createResponse.body.id);

    // Validate response
    expect(res.statusCode).toEqual(200);

    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("views");
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("body");

    expect(res.body.views).toEqual(1);
    expect(res.body.title).toEqual("Test Content");
    expect(res.body.body).toEqual("Test Body");

    // Validate DB
    const records = await db.select().from(contentsTable);
    expect(records.length).toEqual(1);
    expect(records[0].title).toEqual("Test Content");
    expect(records[0].body).toEqual("Test Body");
    expect(records[0].views).toEqual(1);
  });

  it("should update a content by id and insert into content history table", async () => {
    const newContent: CreateContentRequest = {
      title: "Test Content",
      body: "Test Body",
      tags: ["test1", "test2"],
    };
    const createResponse = await createContent(newContent);
    const updatedContent: UpdateContentRequest = {
      title: "Updated Test Content",
      body: "Updated Test Body",
      tags: ["newtag1", "newtag2"],
    };
    const res = await updateContent(createResponse.body.id, updatedContent);

    // Validate response
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("views");
    expect(res.body).toHaveProperty("title", "Updated Test Content");
    expect(res.body).toHaveProperty("body", "Updated Test Body");

    // Validate DB

    // Contents table
    const contentRecords = await db.select().from(contentsTable);
    expect(contentRecords.length).toEqual(1);
    expect(contentRecords[0].title).toEqual("Updated Test Content");
    expect(contentRecords[0].body).toEqual("Updated Test Body");

    // Content history table
    const historyRecords = await db.select().from(contentHistoryTable);
    expect(historyRecords.length).toEqual(2);

    expect(historyRecords[0].contentId).toEqual(contentRecords[0].id);
    expect(historyRecords[0].title).toEqual("Test Content");
    expect(historyRecords[0].body).toEqual("Test Body");
    expect(historyRecords[0].version).toEqual(1);

    expect(historyRecords[1].contentId).toEqual(contentRecords[0].id);
    expect(historyRecords[1].title).toEqual("Updated Test Content");
    expect(historyRecords[1].body).toEqual("Updated Test Body");
    expect(historyRecords[1].version).toEqual(2);
  });

  it("should delete a content by id", async () => {
    const newContent: CreateContentRequest = {
      title: "Test Content",
      body: "Test Body",
      tags: ["test1", "test2"],
    };
    const createResponse = await createContent(newContent);
    const res = await deleteContent(createResponse.body.id);

    // Validate response
    expect(res.statusCode).toEqual(204);

    // Validate DB
    const contentRecords = await db.select().from(contentsTable);
    expect(contentRecords.length).toEqual(0);

    const historyRecords = await db.select().from(contentHistoryTable);
    expect(historyRecords.length).toEqual(0);
  });

  it("should store all history updates and return", async () => {
    const newContent = {
      title: "Test Content",
      body: "Test Body",
      tags: ["test1", "test2"],
    };
    const createResponse = await createContent(newContent);

    let putRes = await request(app)
      .put(`/api/contents/${createResponse.body.id}`)
      .send({
        title: "Updated Test Content 1",
        body: "Updated Test Body 1",
      });
    expect(putRes.statusCode).toEqual(200);

    putRes = await request(app)
      .put(`/api/contents/${createResponse.body.id}`)
      .send({
        title: "Updated Test Content 2",
        body: "Updated Test Body 2",
      });
    expect(putRes.statusCode).toEqual(200);

    putRes = await request(app)
      .put(`/api/contents/${createResponse.body.id}`)
      .send({
        title: "Updated Test Content 3",
        body: "Updated Test Body 3",
      });
    expect(putRes.statusCode).toEqual(200);

    const res2 = await request(app).get(
      `/api/contents/${createResponse.body.id}/history`
    );
    expect(res2.statusCode).toEqual(200);
    expect(Array.isArray(res2.body)).toBeTruthy();

    // Validate DB
    const contentRecordsAfterUpdates = await db.select().from(contentsTable);
    expect(contentRecordsAfterUpdates.length).toEqual(1);
    expect(contentRecordsAfterUpdates[0].title).toEqual(
      "Updated Test Content 3"
    );
    expect(contentRecordsAfterUpdates[0].body).toEqual("Updated Test Body 3");

    const historyRecords = await db
      .select()
      .from(contentHistoryTable)
      .orderBy(asc(contentHistoryTable.version));
    expect(historyRecords.length).toEqual(4);
    expect(historyRecords[0].contentId).toEqual(
      contentRecordsAfterUpdates[0].id
    );
    expect(historyRecords[0].version).toEqual(1);
    expect(historyRecords[0].title).toEqual("Test Content");
    expect(historyRecords[0].body).toEqual("Test Body");

    expect(historyRecords[1].contentId).toEqual(
      contentRecordsAfterUpdates[0].id
    );
    expect(historyRecords[1].version).toEqual(2);
    expect(historyRecords[1].title).toEqual("Updated Test Content 1");
    expect(historyRecords[1].body).toEqual("Updated Test Body 1");

    expect(historyRecords[2].contentId).toEqual(
      contentRecordsAfterUpdates[0].id
    );
    expect(historyRecords[2].version).toEqual(3);
    expect(historyRecords[2].title).toEqual("Updated Test Content 2");
    expect(historyRecords[2].body).toEqual("Updated Test Body 2");

    expect(historyRecords[3].contentId).toEqual(
      contentRecordsAfterUpdates[0].id
    );
    expect(historyRecords[3].version).toEqual(4);
    expect(historyRecords[3].title).toEqual("Updated Test Content 3");
    expect(historyRecords[3].body).toEqual("Updated Test Body 3");
  });

  it("should rollback a content to a specific version", async () => {
    const newContent = {
      title: "Test Content",
      body: "Test Body",
      tags: ["test1", "test2"],
    };
    const createResponse = await createContent(newContent);

    let putRes = await request(app)
      .put(`/api/contents/${createResponse.body.id}`)
      .send({
        title: "Updated Test Content 1",
        body: "Updated Test Body 1",
      });
    expect(putRes.statusCode).toEqual(200);

    putRes = await request(app)
      .put(`/api/contents/${createResponse.body.id}`)
      .send({
        title: "Updated Test Content 2",
        body: "Updated Test Body 2",
      });
    expect(putRes.statusCode).toEqual(200);

    putRes = await request(app)
      .put(`/api/contents/${createResponse.body.id}`)
      .send({
        title: "Updated Test Content 3",
        body: "Updated Test Body 3",
      });
    expect(putRes.statusCode).toEqual(200);
    const res = await rollbackContent(createResponse.body.id, 2);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("views");
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("body");
    expect(res.body.title === "Updated Test Content 1").toBeTruthy();
    expect(res.body.body === "Updated Test Body 1").toBeTruthy();

    const contentRecords = await db.select().from(contentsTable);
    expect(contentRecords.length).toEqual(1);
    expect(contentRecords[0].title).toEqual("Updated Test Content 1");
    expect(contentRecords[0].body).toEqual("Updated Test Body 1");

    const historyRecords = await db
      .select()
      .from(contentHistoryTable)
      .orderBy(desc(contentHistoryTable.version));
    expect(historyRecords.length).toEqual(5);
    expect(historyRecords[0].contentId).toEqual(contentRecords[0].id);
    expect(historyRecords[0].version).toEqual(5);
    expect(historyRecords[0].title).toEqual("Updated Test Content 1");
    expect(historyRecords[0].body).toEqual("Updated Test Body 1");
  });

  it("should store tags on create", async () => {
    const newContent: CreateContentRequest = {
      title: "Sample Title",
      body: "Sample Body",
      tags: ["tag1", "tag2", "tag3"],
    };
    const createResponse = await createContent(newContent);

    const tagRecords = await db.select().from(tagsTable);
    expect(tagRecords.length).toEqual(newContent.tags!.length);

    const contentTagRecords = await db.select().from(contentTagsTable);
    expect(contentTagRecords.length).toEqual(newContent.tags!.length);

    newContent.tags!.forEach((tag) => {
      expect(tagRecords.map((t) => t.name)).toContain(tag);
    });

    contentTagRecords.forEach((t) => {
      expect(t.contentId).toEqual(createResponse.body.id);
      expect(tagRecords.map((t) => t.id)).toContain(t.tagId);
    });
  });

  it("endpoint should return tags and associated content", async () => {
    const newContentA: CreateContentRequest = {
      title: "Sample Title 1",
      body: "Sample Body 1",
      tags: ["tag1", "tag2"],
    };
    const newContentB: CreateContentRequest = {
      title: "Sample Title 2",
      body: "Sample Body 2",
      tags: ["tag2", "tag3"],
    };
    await createContent(newContentA);
    await createContent(newContentB);

    const getTagsResponse = await getTags();
    expect(getTagsResponse.status).toEqual(200);
    expect(Array.isArray(getTagsResponse.body)).toBeTruthy();
    expect(getTagsResponse.body.length).toEqual(3);

    const [tagRecord] = await db
      .select()
      .from(tagsTable)
      .where(eq(tagsTable.name, "tag2"));
    const getTaggedContentResponse = await getTaggedContent(tagRecord.id);
    expect(getTaggedContentResponse.status).toEqual(200);
    expect(Array.isArray(getTaggedContentResponse.body)).toBeTruthy();
    expect(getTaggedContentResponse.body.length).toEqual(2);
  });

  it("updating tags", async () => {
    const newContent: CreateContentRequest = {
      title: "Test Content",
      body: "Test Body",
      tags: ["tag1", "tag2"],
    };
    const createResponse = await createContent(newContent);
    const updatedContent: UpdateContentRequest = {
      title: "Updated Test Content",
      body: "Updated Test Body",
      tags: ["newtag1", "newtag2"],
    };
    const res = await updateContent(createResponse.body.id, updatedContent);

    // Validate response
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("views");
    expect(res.body).toHaveProperty("title", "Updated Test Content");
    expect(res.body).toHaveProperty("body", "Updated Test Body");

    // Validate DB
    const tagRecords = await db.select().from(tagsTable);
    // Note: tag records are not deleted even when they have no referencing content
    expect(tagRecords.length).toEqual(4);

    const contentTagRecords = await db.select().from(contentTagsTable);
    // The relational records, however, are deleted
    expect(contentTagRecords.length).toEqual(2);

    updatedContent.tags!.forEach((tag) => {
      expect(tagRecords.map((t) => t.name)).toContain(tag);
    });

    contentTagRecords.forEach((t) => {
      expect(t.contentId).toEqual(createResponse.body.id);
      expect(tagRecords.map((t) => t.id)).toContain(t.tagId);
    });
  });

  it("should delete tags", async () => {
    const newContent: CreateContentRequest = {
      title: "Test Content",
      body: "Test Body",
      tags: ["tag1", "tag2"],
    };
    const createResponse = await createContent(newContent);
    const updatedContent: UpdateContentRequest = {
      title: "Updated Test Content",
      body: "Updated Test Body",
      tags: ["tag2", "tag3"],
    };
    await updateContent(createResponse.body.id, updatedContent);
    expect(createResponse.statusCode).toEqual(201);
    const res = await request(app).delete("/api/tags");
    const tagRecords = await db.select().from(tagsTable);
    expect(tagRecords.length).toEqual(0);
    const relationalRecords = await db.select().from(contentTagsTable);
    expect(relationalRecords.length).toEqual(0);
  });

  it("should handle not found content", async () => {
    const res = await request(app).get("/api/contents/9999");
    expect(res.statusCode).toEqual(404);
  });
});
