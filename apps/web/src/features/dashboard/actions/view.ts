"use server";

import { cookies } from "next/headers";

export async function setView(view: string) {
  const cookieStore = await cookies();
  cookieStore.set("view", view);
}
