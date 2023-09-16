import { NextFunction, Request, Response } from "express";
import logger from "@/winston";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error(err);
  res.status(500).send({ error: "Internal Server Error" });
};
