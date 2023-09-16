import express from "express";
import cors from "cors";
import appRoutes from "./routes";

const app = express();

// CORS
app.use(cors());

// Serve static assets
app.use(express.static("public"));

// Parse application/json
app.use(express.json());

// Serve api
app.use("/api", appRoutes);

export default app;
