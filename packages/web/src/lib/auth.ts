import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [adminClient()],
  user: {
    additionalFields: {
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
