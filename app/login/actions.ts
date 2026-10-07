"use server";

import { redirect } from "next/navigation";
import { login, issueSession } from "@/lib/auth";

export type LoginState = { error?: string };

export async function doLogin(
  _prev: LoginState, formData: FormData
): Promise<LoginState> {
  const slug = String(formData.get("slug") ?? "");
  const pin = String(formData.get("pin") ?? "");
  if (!/^\d{4}$/.test(pin)) return { error: "숫자 4개를 눌러줘" };

  const r = await login(slug, pin);
  if (!r.ok) {
    if (r.reason === "locked") {
      return { error: `잠겼어. ${r.minutesLeft}분 뒤에 다시 해보자` };
    }
    if (r.reason === "no_user") return { error: "누구인지 모르겠어" };
    return { error: "비밀번호가 달라. 다시 눌러봐" };
  }

  await issueSession(r.user);
  redirect(r.user.role === "parent" ? "/parent" : "/");
}
