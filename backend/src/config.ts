import "dotenv/config";
import { setServers } from "node:dns";

// Optional process-local override for networks where Node's default resolver
// cannot resolve Atlas SRV/TXT records. Does not change operating-system DNS.
const dnsServers = process.env.DNS_SERVERS?.split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (dnsServers?.length) setServers(dnsServers);
export const config = {
  port: Number(process.env.PORT || 4000),
  mongo: process.env.MONGODB_URI || "",
  frontend: process.env.FRONTEND_URL || "http://localhost:5173",
  clientId: process.env.GITHUB_CLIENT_ID || "",
  clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
  callback:
    process.env.GITHUB_CALLBACK_URL ||
    "http://localhost:4000/api/auth/github/callback",
  sessionSecret: process.env.SESSION_SECRET || "",
  encryptionKey: process.env.TOKEN_ENCRYPTION_KEY || "",
  production: process.env.NODE_ENV === "production",
};
export const configured = () =>
  Boolean(
    config.mongo &&
    config.clientId &&
    config.clientSecret &&
    config.sessionSecret.length >= 32 &&
    /^[a-f\d]{64}$/i.test(config.encryptionKey),
  );
