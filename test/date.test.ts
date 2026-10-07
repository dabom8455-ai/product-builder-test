import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toKstDateString, nowTimeKST, addDays, daysBetween, isoWeekday,
  weekdayLabel, recentDates, sleepMinutes, formatMinutes, displayDate,
} from "../lib/date.ts";

// ── 이 앱에서 가장 터지기 쉬운 버그: UTC 00:00~08:59 구간 ──
test("KST 날짜 경계 — UTC 자정은 이미 한국의 오전 9시(같은 날)", () => {
  assert.equal(toKstDateString(new Date("2026-10-08T00:00:00Z")), "2026-10-08");
});

test("KST 날짜 경계 — UTC 14:59 는 아직 한국 당일 23:59", () => {
  assert.equal(toKstDateString(new Date("2026-10-08T14:59:00Z")), "2026-10-08");
});

test("KST 날짜 경계 — UTC 15:00 부터 한국은 다음 날", () => {
  assert.equal(toKstDateString(new Date("2026-10-08T15:00:00Z")), "2026-10-09");
});

test("KST 날짜 경계 — 아이가 밤 9시 반에 체크하면 그날로 저장돼야 한다", () => {
  // 한국 2026-10-08 21:30 = UTC 2026-10-08 12:30
  assert.equal(toKstDateString(new Date("2026-10-08T12:30:00Z")), "2026-10-08");
});

test("KST 날짜 경계 — 연말", () => {
  assert.equal(toKstDateString(new Date("2026-12-31T15:00:00Z")), "2027-01-01");
});

test("nowTimeKST", () => {
  assert.equal(nowTimeKST(new Date("2026-10-08T12:30:00Z")), "21:30");
  assert.equal(nowTimeKST(new Date("2026-10-08T22:05:00Z")), "07:05");
});

test("addDays — 월·연 경계", () => {
  assert.equal(addDays("2026-10-08", 1), "2026-10-09");
  assert.equal(addDays("2026-10-01", -1), "2026-09-30");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29"); // 윤년
});

test("daysBetween", () => {
  assert.equal(daysBetween("2026-10-10", "2026-10-07"), 3);
  assert.equal(daysBetween("2026-10-07", "2026-10-10"), -3);
});

test("isoWeekday / weekdayLabel — 1=월 … 7=일", () => {
  assert.equal(isoWeekday("2026-10-05"), 1); // 월요일
  assert.equal(weekdayLabel("2026-10-05"), "월");
  assert.equal(isoWeekday("2026-10-11"), 7); // 일요일
  assert.equal(weekdayLabel("2026-10-11"), "일");
});

test("recentDates — 오래된 날짜부터, 기준일 포함", () => {
  assert.deepEqual(recentDates(3, "2026-10-08"), ["2026-10-06", "2026-10-07", "2026-10-08"]);
});

test("sleepMinutes — 자정을 넘기는 취침", () => {
  assert.equal(sleepMinutes("21:30", "07:00"), 570); // 9시간 30분
  assert.equal(sleepMinutes("22:30", "07:30"), 540); // 9시간
  assert.equal(sleepMinutes("23:50", "06:20"), 390); // 6시간 30분
  assert.equal(sleepMinutes(null, "07:00"), null);
  assert.equal(sleepMinutes("21:30", null), null);
  assert.equal(sleepMinutes("이상한값", "07:00"), null);
});

test("formatMinutes", () => {
  assert.equal(formatMinutes(528), "8시간 48분");
  assert.equal(formatMinutes(540), "9시간");
});

test("displayDate", () => {
  assert.equal(displayDate("2026-10-08"), "10월 8일 (목)");
});
