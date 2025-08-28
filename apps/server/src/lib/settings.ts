import type { settings } from "@beam/database";

type Setting = typeof settings.$inferSelect & {
  initialized: boolean;
};

export const SETTINGS: Setting = {} as Setting;

export const INITIALIZED = false;
