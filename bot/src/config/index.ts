import dotenv from "dotenv";
dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== "" ? value : fallback;
}

export const config = {
  port: parseInt(optional("BOT_PORT", "3000"), 10),
  logLevel: optional("LOG_LEVEL", "info"),
  maxUploadMb: parseInt(optional("BOT_MAX_UPLOAD_MB", "90"), 10),
  sessionTtlSeconds: parseInt(optional("BOT_SESSION_TTL_SECONDS", "1800"), 10),

  redis: {
    url: optional("REDIS_URL", "redis://localhost:6379"),
  },

  nextcloud: {
    baseUrl: optional("NEXTCLOUD_BASE_URL", "http://localhost"),
    botUsername: required("NEXTCLOUD_BOT_USERNAME"),
    botAppPassword: required("NEXTCLOUD_BOT_APP_PASSWORD"),
    sharePasswordDefaultEnabled:
      optional("NEXTCLOUD_SHARE_PASSWORD_DEFAULT_ENABLED", "true") === "true",
    shareExpiryDays: parseInt(optional("NEXTCLOUD_SHARE_EXPIRY_DAYS", "1"), 10),
  },

  whatsapp: {
    accessToken: required("WHATSAPP_ACCESS_TOKEN"),
    verifyToken: required("WHATSAPP_VERIFY_TOKEN"),
    appSecret: required("WHATSAPP_APP_SECRET"),
    phoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
    apiVersion: optional("WHATSAPP_API_VERSION", "v20.0"),
  },
};

export type AppConfig = typeof config;
