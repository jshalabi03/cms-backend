import { Router } from "express";
import contentRoutes from "./contents";
import tagRoutes from "./tags";

const appRoutes = Router();

appRoutes.use("/contents", contentRoutes);
appRoutes.use("/tags", tagRoutes);

export default appRoutes;
