import app from "./app";
import { migrate } from "./db/migrate";
import logger from "./winston";

// Start web server
async function startServer() {
  if (process.env.NODE_ENV == "production") {
    await migrate();
  }

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Listening on port ${PORT}`);
  });
}

startServer();
