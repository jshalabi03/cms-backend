import app from "../src/app";
import { db } from "../src/db";
import {
  contents as contentsTable,
  contentHistory as contentHistoryTable,
} from "../src/db/schema";
import { migrate } from "../src/db/migrate";
import request from "supertest";
import { asc, desc } from "drizzle-orm";

describe("Test api", () => {
  beforeAll(async () => {
    await migrate();
  });

  it("should create a new content and history entry", async () => {
    const res = await request(app)
      .post("/api/contents")
      .send({
        title: "Test Content",
        body: "Test Body",
        tags: ["test1", "test2"],
      });

    // Validate response
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("body");
    expect(res.body).toHaveProperty("views");
    expect(res.body.views).toEqual(0);
    expect(res.body.title).toEqual("Test Content");
    expect(res.body.body).toEqual("Test Body");

    // Validate DB
    const records = await db.select().from(contentsTable);
    expect(records.length).toEqual(1);
    expect(records[0].title).toEqual("Test Content");
    expect(records[0].body).toEqual("Test Body");
    expect(records[0].views).toEqual(0);

    const historyRecords = await db.select().from(contentHistoryTable);
    expect(historyRecords.length).toEqual(1);
    expect(historyRecords[0].contentId).toEqual(records[0].id);
    expect(historyRecords[0].title).toEqual("Test Content");
    expect(historyRecords[0].body).toEqual("Test Body");
    expect(historyRecords[0].version).toEqual(1);
  });

  it("should fetch all contents", async () => {
    const res = await request(app).get("/api/contents");

    // Validate response
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBeTruthy();
    expect(res.body.length).toEqual(1);
    expect(res.body[0].title).toEqual("Test Content");
    expect(res.body[0].body).toEqual("Test Body");
    expect(res.body[0].views).toEqual(0);
  });

  it("should fetch a content by id and update views by 1", async () => {
    const res = await request(app).get("/api/contents/1");

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
    const res = await request(app).put("/api/contents/1").send({
      title: "Updated Test Content",
      body: "Updated Test Body",
    });

    // Validate response
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty("id");
    expect(res.body).toHaveProperty("views");
    expect(res.body).toHaveProperty("title");
    expect(res.body).toHaveProperty("body");

    expect(res.body.views).toEqual(1);
    expect(res.body.title).toEqual("Updated Test Content");
    expect(res.body.body).toEqual("Updated Test Body");

    // Validate DB

    // Contents table
    const contentRecords = await db.select().from(contentsTable);
    expect(contentRecords.length).toEqual(1);
    expect(contentRecords[0].title).toEqual("Updated Test Content");
    expect(contentRecords[0].body).toEqual("Updated Test Body");
    expect(contentRecords[0].views).toEqual(1);

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
    const res = await request(app).delete("/api/contents/1");

    // Validate response
    expect(res.statusCode).toEqual(204);

    // Validate DB
    const contentRecords = await db.select().from(contentsTable);
    expect(contentRecords.length).toEqual(0);

    const historyRecords = await db.select().from(contentHistoryTable);
    expect(historyRecords.length).toEqual(0);
  });

  it("should store all history updates and return", async () => {
    const res = await request(app)
      .post("/api/contents")
      .send({
        title: "Test Content",
        body: "Test Body",
        tags: ["test1", "test2"],
      });

    let putRes = await request(app).put(`/api/contents/${res.body.id}`).send({
      title: "Updated Test Content 1",
      body: "Updated Test Body 1",
    });
    expect(putRes.statusCode).toEqual(200);

    putRes = await request(app).put(`/api/contents/${res.body.id}`).send({
      title: "Updated Test Content 2",
      body: "Updated Test Body 2",
    });
    expect(putRes.statusCode).toEqual(200);

    putRes = await request(app).put(`/api/contents/${res.body.id}`).send({
      title: "Updated Test Content 3",
      body: "Updated Test Body 3",
    });
    expect(putRes.statusCode).toEqual(200);

    const res2 = await request(app).get(`/api/contents/${res.body.id}/history`);
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
    const res = await request(app).post("/api/contents/2/rollback/2");
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

  it("should handle not found content", async () => {
    const res = await request(app).get("/api/contents/9999");
    expect(res.statusCode).toEqual(404);
  });
});
