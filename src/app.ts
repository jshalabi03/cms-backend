import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "../swagger.json";
import appRoutes from "./routes";

const app = express();

// CORS
app.use(cors());

// Serve static assets
app.use(express.static("public"));

// Parse application/json
app.use(express.json());

// Setup swagger
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Serve api
app.use("/api", appRoutes);

export default app;
