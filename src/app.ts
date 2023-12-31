import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "../swagger.json";
import appRoutes from "./routes";
import { errorHandler } from "./middleware/errors";

const app = express();

// CORS
app.use(cors());

// Serve static assets
app.use(express.static("public"));

// Parse application/json
app.use(express.json());

// Serve api
app.use("/api", appRoutes);

// Setup swagger
app.use("/", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Error handling
app.use(errorHandler);

export default app;
