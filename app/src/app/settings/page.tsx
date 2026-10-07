"use client";

import { useState } from "react";
import { pickData, useApp, type AppData } from "@/lib/store";
import { CHANNELS, type Tone, type VatMode } from "@/lib/types";
import { Button, Card, Field, NumInput, PageHeader, Segmented, inputCls } from "@/components/ui";
import { platform } from "@/lib/platform";
import { askConfirm } from "@/components/Confirm";
import { usePersistStatus } from "@/lib/persistence";
import { DOW_LABEL, businessDays, todayLocal } from "@/lib/dates";
import { won } from "@/lib/format";

const pctIn = (r: number) => Math.round(r * 10000) / 100;

export default function SettingsPage() {
  const store = useApp((s) => s.store);
  const rule = useApp((s) => s.laborRule);
  const setStore = useApp((s) => s.setStore);
  const setRule = useApp((s) => s.setLaborRule);

  return (
    <div className="space-y-4">
      <PageHeader title="설정" desc="여기 값들이 원가·손익·급여 계산 전체에 반영됩니다." />

      <Card title="매장">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="매장 이름">
            <input className={inputCls} value={store.name} onChange={(e) => setStore({ name: e.target.value })} />
          </Field>
          <Field label="브랜드 색 (포스터·로고)">
            <div className="flex gap-2">
              <input type="color" className="h-10 w-14 rounded border border-line" value={store.brandColor} onChange={(e) => setStore({ brandColor: e.target.value })} />
              <input className={inputCls} value={store.brandColor} onChange={(e) => setStore({ brandColor: e.target.value })} />
            </div>
          </Field>
          <Field label="리뷰 답글 말투">
            <Segmented<Tone>
              value={store.tone}
              onChange={(tone) => setStore({ tone })}
              options={[
                { id: "friendly", label: "친근" },
                { id: "polite", label: "정중" },
                { id: "witty", label: "위트" },
              ]}
            />
          </Field>
          <Field label="과세 유형">
            <Segmented<VatMode>
              value={store.vatMode}
              onChange={(vatMode) => setStore({ vatMode })}
              options={[
                { id: "general", label: "일반과세" },
                { id: "simplified", label: "간이과세" },
                { id: "none", label: "면세/미적용" },
              ]}
            />
          </Field>
          <Field label="상시 근로자 수" hint="5인 이상이면 연장·야간 근로에 50% 가산수당이 적용됩니다.">
            <Segmented
              value={store.over5Employees ? "y" : "n"}
              onChange={(v) => setStore({ over5Employees: v === "y" })}
              options={[
                { id: "n", label: "5인 미만" },
                { id: "y", label: "5인 이상" },
              ]}
            />
          </Field>
        </div>
      </Card>

      <Card title="영업·목표">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="정기 휴무 요일" hint="손익분기 하루 매출, 월 목표, 매출 달력에 반영됩니다.">
            <div className="flex flex-wrap gap-1.5">
              {DOW_LABEL.map((d, i) => {
                const on = store.closedDays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStore({ closedDays: on ? store.closedDays.filter((x) => x !== i) : [...store.closedDays, i].sort() })}
                    className={`h-9 w-9 rounded-full border text-sm ${on ? "border-bad bg-bad/10 font-semibold text-bad" : "border-line"}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="월 매출 목표(원)" hint={store.monthlySalesTarget ? `하루 평균 ${won(store.monthlySalesTarget / Math.max(1, businessDays(todayLocal().slice(0, 7), store.closedDays)))} (이번 달 영업일 기준)` : "0이면 홈에 목표가 표시되지 않습니다."}>
            <NumInput value={store.monthlySalesTarget} step={100000} onChange={(n) => setStore({ monthlySalesTarget: Math.max(0, n) })} />
          </Field>
          <div className="md:col-span-2">
            <Field label="리뷰 답글 서명" hint="모든 답글 마지막 줄에 붙습니다. 비워두면 붙이지 않습니다.">
              <input className={inputCls} placeholder="예: — 카페 댐 사장 드림" value={store.replySignature} onChange={(e) => setStore({ replySignature: e.target.value })} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="원가·수수료">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="음료 목표 원가율(%)">
            <NumInput value={pctIn(store.targetCostRatio.drink)} onChange={(n) => setStore({ targetCostRatio: { ...store.targetCostRatio, drink: n / 100 } })} />
          </Field>
          <Field label="디저트 목표 원가율(%)">
            <NumInput value={pctIn(store.targetCostRatio.dessert)} onChange={(n) => setStore({ targetCostRatio: { ...store.targetCostRatio, dessert: n / 100 } })} />
          </Field>
          <Field label="배달 1개당 포장재비(원)">
            <NumInput value={store.deliveryPackagingCost} step={10} onChange={(n) => setStore({ deliveryPackagingCost: n })} />
          </Field>
          {CHANNELS.map((c) => (
            <Field key={c.id} label={`${c.label} 수수료(%)`} hint={c.delivery ? "중개+결제+사장님 부담 배달비 비율" : "카드·결제 수수료"}>
              <NumInput step={0.1} value={pctIn(store.channelFeeRate[c.id])} onChange={(n) => setStore({ channelFeeRate: { ...store.channelFeeRate, [c.id]: n / 100 } })} />
            </Field>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-ink-2">배달앱 요금제(정률·정액·배달비 분담)는 매장마다 달라요. 최근 정산서의 ‘총 차감액 ÷ 주문금액’을 넣으면 가장 정확합니다.</p>
      </Card>

      <Card title="노무 기준 (매년 갱신)">
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="최저시급(원)" hint="2026년 10,320원">
            <NumInput value={rule.minWage} step={10} onChange={(n) => setRule({ minWage: n })} />
          </Field>
          <Field label="근로자 4대보험 공제율(%)" hint="추정치">
            <NumInput step={0.1} value={pctIn(rule.employeeInsuranceRate)} onChange={(n) => setRule({ employeeInsuranceRate: n / 100 })} />
          </Field>
          <Field label="사업주 4대보험 부담률(%)" hint="추정치, 손익 인건비에 가산">
            <NumInput step={0.1} value={pctIn(rule.employerInsuranceRate)} onChange={(n) => setRule({ employerInsuranceRate: n / 100 })} />
          </Field>
          <Field label="사업소득 원천징수(%)">
            <NumInput step={0.1} value={pctIn(rule.freelanceTaxRate)} onChange={(n) => setRule({ freelanceTaxRate: n / 100 })} />
          </Field>
        </div>
        <p className="mt-3 text-[11px] text-ink-2">법령·요율은 바뀔 수 있습니다. 실제 신고·지급 전에는 세무사·노무사 확인을 권장합니다.</p>
      </Card>

      <DataCard />
    </div>
  );
}

function DataCard() {
  const loadDemo = useApp((s) => s.loadDemo);
  const resetEmpty = useApp((s) => s.resetEmpty);
  const importAll = useApp((s) => s.importAll);
  const [msg, setMsg] = useState<string | null>(null);
  const label = usePersistStatus((s) => s.label);

  const exportJson = async () => {
    const s = useApp.getState();
    const data: AppData = pickData(s);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    if (await platform().saveFile(`cafedam-backup-${todayLocal()}.json`, blob)) setMsg("백업 파일을 저장했습니다.");
  };

  const importJson = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as AppData;
      if (!data.store || !Array.isArray(data.menus) || !Array.isArray(data.sales)) throw new Error("형식 오류");
      importAll(data);
      setMsg("백업을 불러왔습니다.");
    } catch {
      setMsg("백업 파일 형식이 올바르지 않습니다.");
    }
  };

  return (
    <Card title="데이터">
      <p className="mb-3 text-sm text-ink-2">
        저장 위치: <b>{label}</b>. 변경 내용은 자동으로 저장됩니다. 중요한 시점에는 백업 파일도 받아 두세요.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportJson}>백업 내보내기(JSON)</Button>
        <label className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-surface-2">
          백업 불러오기
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
        </label>
        <Button variant="ghost" onClick={async () => (await askConfirm("현재 데이터를 지우고 샘플 카페 데이터를 불러올까요?", { confirmLabel: "샘플 불러오기", danger: true })) && (loadDemo(), setMsg("샘플 데이터를 불러왔습니다."))}>
          샘플 데이터 불러오기
        </Button>
        <Button variant="danger" onClick={async () => (await askConfirm("모든 데이터를 지우고 빈 상태로 시작할까요? 되돌릴 수 없습니다.", { confirmLabel: "모두 지우기", danger: true })) && (resetEmpty(), setMsg("초기화했습니다."))}>
          모두 지우고 시작
        </Button>
      </div>
      {msg && <p className="mt-3 text-sm text-good">{msg}</p>}
    </Card>
  );
}
