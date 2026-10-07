"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentUser, clearSession, hashPin } from "@/lib/auth";
import { todayKST } from "@/lib/date";
import {
  setLog, clearChoiceGroup, usePassCard, addBook, addMoney, addInjury,
  addMemo, addWin, setSubjectStatus, toggleTaskActive, createTaskDef,
  setUserPin, allTaskDefs,
} from "@/lib/queries";

async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}

/** 아이는 자기 것만. 부모는 childId 를 지정해 대신 입력할 수 있다. */
async function resolveChild(childId?: number) {
  const u = await requireUser();
  if (u.role === "child") return u.id;
  if (!childId) throw new Error("childId 가 필요합니다.");
  return childId;
}

export async function actToggle(
  taskKey: string, next: boolean, group: string | null,
  date?: string, childId?: number
) {
  const id = await resolveChild(childId);
  const d = date ?? todayKST();
  await setLog(id, d, taskKey, { bool: next });
  if (next && group) await clearChoiceGroup(id, d, group, taskKey);
  revalidatePath("/", "layout");
}

export async function actSetNum(
  taskKey: string, value: number | null, date?: string, childId?: number
) {
  const id = await resolveChild(childId);
  await setLog(id, date ?? todayKST(), taskKey, { num: value, bool: null });
  revalidatePath("/", "layout");
}

export async function actSetText(
  taskKey: string, value: string, date?: string, childId?: number
) {
  const id = await resolveChild(childId);
  const d = date ?? todayKST();
  const v = value.trim();
  if (v === "") {
    await setLog(id, d, taskKey, { bool: false });
  } else {
    await setLog(id, d, taskKey, { text: v });
  }
  revalidatePath("/", "layout");
}

export async function actUsePassCard() {
  const u = await requireUser();
  if (u.role !== "child") return;
  await usePassCard(u.id);
  revalidatePath("/", "layout");
}

export async function actAddBook(formData: FormData) {
  const u = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await addBook(u.id, title, String(formData.get("one_line") ?? ""));
  revalidatePath("/record");
}

export async function actAddMoney(formData: FormData) {
  const u = await requireUser();
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return;
  await addMoney(u.id, String(formData.get("kind") ?? "spend"), Math.round(amount),
    String(formData.get("memo") ?? ""));
  revalidatePath("/record");
}

export async function actAddInjury(formData: FormData) {
  const u = await requireUser();
  const part = String(formData.get("part") ?? "").trim();
  if (!part) return;
  await addInjury(u.id, part, String(formData.get("situation") ?? ""),
    String(formData.get("time_of_day") ?? ""));
  revalidatePath("/record");
}

export async function actSetSubject(id: number, status: string) {
  const u = await requireUser();
  if (u.role !== "child") return;
  await setSubjectStatus(id, u.id, status);
  revalidatePath("/study");
}

/* ---------- 부모 ---------- */

async function requireParent() {
  const u = await requireUser();
  if (u.role !== "parent") redirect("/");
  return u;
}

export async function actAddMemo(formData: FormData) {
  await requireParent();
  const childId = Number(formData.get("child_id"));
  const body = String(formData.get("body") ?? "").trim();
  if (!childId || !body) return;
  await addMemo(childId, body);
  revalidatePath("/parent/memo");
}

export async function actAddWin(formData: FormData) {
  await requireParent();
  const childId = Number(formData.get("child_id"));
  const title = String(formData.get("title") ?? "").trim();
  if (!childId || !title) return;
  await addWin(childId, title, String(formData.get("hard_start") ?? ""),
    String(formData.get("now_text") ?? ""));
  revalidatePath("/", "layout");
}

export async function actToggleTask(id: number, active: boolean) {
  await requireParent();
  await toggleTaskActive(id, active);
  revalidatePath("/parent/tasks");
  revalidatePath("/today");
}

export async function actCreateTask(formData: FormData) {
  await requireParent();
  const childId = Number(formData.get("child_id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!childId || !label) return;

  const existing = await allTaskDefs(childId);
  const base = "custom_" + (existing.filter((t) => t.task_key.startsWith("custom_")).length + 1);

  await createTaskDef({
    childId,
    taskKey: String(formData.get("task_key") ?? "").trim() || base,
    label,
    emoji: String(formData.get("emoji") ?? "") || "⭐",
    category: String(formData.get("category") ?? "life"),
    kind: String(formData.get("kind") ?? "fixed"),
    valueType: String(formData.get("value_type") ?? "bool"),
    targetNum: formData.get("target_num") ? Number(formData.get("target_num")) : null,
    unit: String(formData.get("unit") ?? "") || null,
    hint: String(formData.get("hint") ?? "") || null,
  });
  revalidatePath("/parent/tasks");
  revalidatePath("/today");
}

export async function actChangePin(formData: FormData) {
  await requireParent();
  const slug = String(formData.get("slug") ?? "");
  const pin = String(formData.get("pin") ?? "");
  if (!/^\d{4}$/.test(pin)) return;
  await setUserPin(slug, hashPin(pin));
  revalidatePath("/parent/tasks");
}

export async function actLogout() {
  await clearSession();
  redirect("/login");
}

/** 운동 "오늘은 쉼" — 운동한 날로는 세지 않지만 기록은 남는다 */
export async function actRestExercise(date?: string) {
  const u = await requireUser();
  if (u.role !== "child") return;
  await setLog(u.id, date ?? todayKST(), "exercise_rest", { text: "쉼" });
  revalidatePath("/exercise");
}
