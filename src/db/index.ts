import dns from "node:dns";
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import https from "node:https";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Ensure rock-solid IPv4 network connectivity across all node/serverless environments
if (typeof window === "undefined") {
  neonConfig.fetchFunction = (
    url: string | URL | Request,
    options?: RequestInit & { headers?: Record<string, string> }
  ) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = typeof url === "string" ? new URL(url) : url instanceof URL ? url : new URL(url.url);
      const req = https.request(
        parsedUrl,
        {
          method: options?.method || "POST",
          headers: options?.headers,
          family: 4,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf-8");
            resolve({
              ok: res.statusCode ? res.statusCode >= 200 && res.statusCode < 300 : false,
              status: res.statusCode || 200,
              statusText: res.statusMessage || "OK",
              json: async () => JSON.parse(body),
              text: async () => body,
              headers: new Headers(res.headers as Record<string, string>),
            } as unknown as Response);
          });
        }
      );
      req.on("error", reject);
      if (options?.body) {
        req.write(options.body);
      }
      req.end();
    });
  };
}

const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://placeholder:placeholder@localhost:5432/placeholder";

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  console.warn("⚠️ Warning: DATABASE_URL is not set in environment variables (.env.local)");
}

const sql = neon(databaseUrl);
export const db = drizzle(sql, { schema });

export * from "./schema";
