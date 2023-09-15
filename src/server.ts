import app from "./app";
import logger from "./winston";

// Start web server
function startServer() {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`Listening on port ${PORT}`);
  });
}

startServer();
