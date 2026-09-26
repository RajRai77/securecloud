import pino from "pino";
import { config } from "../config";

// Central logger. IMPORTANT: never pass raw request bodies, tokens, secrets,
// or file contents to this logger. Redact before logging.
export const logger = pino({
  level: config.logLevel,
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:standard" } }
      : undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "*.accessToken",
      "*.access_token",
      "*.appSecret",
      "*.app_secret",
      "*.password",
      "*.token",
    ],
    remove: true,
  },
});
