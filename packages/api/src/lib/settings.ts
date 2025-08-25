import type { settings } from "@beam/db/schema";

type Setting = typeof settings.$inferSelect & {
  initialized: boolean;
};

export const SETTINGS: Setting = {} as Setting;

export let INITIALIZED = false;
