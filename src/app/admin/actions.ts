"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { getStaff } from "@/lib/auth";
import { ALL_BRANCHES, BRANCH_COOKIE } from "@/lib/branches";

export async function setViewBranch(value: string) {
  await getStaff();
  (await cookies()).set(BRANCH_COOKIE, value || ALL_BRANCHES, {
    path: "/admin",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
  });
  refresh();
}
