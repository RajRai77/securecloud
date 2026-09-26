/**
 * Standalone health-check script (no config validation dependency on
 * WhatsApp/Nextcloud secrets) used by the Docker HEALTHCHECK instruction.
 * Exits 0 if the bot's local HTTP server responds, non-zero otherwise.
 */
import http from "http";

const port = process.env.BOT_PORT || "3000";

const req = http.get({ host: "127.0.0.1", port, path: "/health", timeout: 4000 }, (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

req.on("error", () => process.exit(1));
req.on("timeout", () => {
  req.destroy();
  process.exit(1);
});
