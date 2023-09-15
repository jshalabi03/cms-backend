import { db } from "@/db";
import { tags } from "@/db/schema";
import logger from "@/winston";
import { Router } from "express";

const tagRoutes = Router();

tagRoutes.get("/tags", async (_request, response) => {
  try {
    const records = await db.select().from(tags);
    return response.status(200).json(records);
  } catch (err) {
    logger.error(err);
    return response.status(500).send();
  }
});

export default tagRoutes;
