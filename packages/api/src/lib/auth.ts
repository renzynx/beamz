import { betterAuth, generateId } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db, schema } from "@beam/db";
import { admin } from "better-auth/plugins";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { SETTINGS } from "./settings";
import { SECRET } from "./constants";
import { generateUserAvatar } from "./utils";

export const auth = betterAuth({
  secret: SECRET,
  baseURL: process.env.BASE_URL,
  trustedOrigins: [process.env.BASE_URL || "http://localhost:3000"],
  database: drizzleAdapter(db, { provider: "sqlite", schema }),
  telemetry: { enabled: false },
  emailAndPassword: { enabled: true },
  appName: "Beam",
  advanced: {
    cookiePrefix: "beam",
  },
  plugins: [admin()],
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!SETTINGS.initialized) {
            SETTINGS.initialized = true;

            return {
              data: {
                ...user,
                role: "admin",
                image: generateUserAvatar(user.email),
                apiKey: generateId(24),
              },
            };
          } else {
            return {
              data: {
                ...user,
                image: generateUserAvatar(user.email),
                apiKey: generateId(24),
              },
            };
          }
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (!ctx.path.includes("sign-up")) {
        return;
      }

      if (!SETTINGS.enableSignUp) {
        throw new APIError("FORBIDDEN", {
          message: "Sign up is disabled",
        });
      }
    }),
  },
  user: {
    additionalFields: {
      apiKey: {
        type: "string",
        required: false,
        defaultValue: "",
        input: false,
      },
      quota: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
      usedQuota: {
        type: "number",
        required: false,
        defaultValue: 0,
        input: false,
      },
    },
  },
});
