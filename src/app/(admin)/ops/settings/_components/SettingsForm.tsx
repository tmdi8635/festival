"use client";

import { useState } from "react";
import { useSettingsQuery } from "@/api/ops/getSettings";
import { WAGE_TYPE_OPTIONS } from "@/constants/eventOptions";
import { useSettingsMutation } from "@/api/ops/mutateSettings";
import { useHasPermission } from "@/store/useAdminStore";
import { Refresh, Warning } from "@/icons";
import { cn, formatCurrency } from "@/lib/utils";
import {
  FEATURE_HINT,
  FEATURE_LABEL,
  FEATURE_MODE_DESCRIPTION,
  FEATURE_MODE_LABEL,
  hasActiveJobRole,
  type FeatureKey,
  type FeatureMode,
  type OperationSettings,
} from "@/type/ops";
import { WAGE_TYPE_UNIT, type WageType } from "@/type/event";
import {
  mergeJobRoles,
  sanitizeJobRoles,
  type JobRole,
  type JobRoleDef,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import AmountInput from "@/components/ui/AmountInput";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import Input from "@/components/ui/Input";
import TimeInput from "@/components/ui/TimeInput";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Switch from "@/components/ui/Switch";

/**
 * '기능 사용 범위' 카드에 세우는 기능들.
 *
 * `HR_POLICY`는 여기 없다. 그건 메뉴가 아니라 이 화면 안의 카드 하나라,
 * 잠금 · 체험 · 사용중 3단계를 줄 자리가 없다. 자기 카드 위의 스위치로 켜고 끈다.
 * 두 곳에서 같은 값을 고칠 수 있게 두면 어느 쪽이 지금 값인지 알 수 없다.
 */
const FEATURE_KEYS: FeatureKey[] = ["RECRUIT", "MESSAGE", "CLIENT"];
const FEATURE_MODES: FeatureMode[] = ["ENABLED", "MOCK", "LOCKED"];

/**
 * 직무 표의 컬럼 폭.
 *
 * 머리글과 각 행이 따로 정의를 들고 있으면 칸 수가 한 번 어긋나는 순간
 * 표 전체가 밀린다. (실제로 그렇게 깨져 있었다) 한 상수를 둘 다 쓴다.
 */
const JOB_ROLE_GRID =
  "grid grid-cols-[minmax(0,1fr)_110px_180px_180px_64px] gap-3";

/**
 * 기준 설정.
 *
 * 이 시스템이 하려는 일은 "매번 사람이 판단하던 것을 규칙으로 굳히는 것"이다.
 * 다만 에이전시마다 운영 방식이 달라서, 규칙을 시스템이 강제하면 오히려 못 쓰게 된다.
 * 그래서 단가 · 수당 · 원천징수를 여기서 정하게 한다.
 *
 * **직무 목록만은 예외다.** 그건 우리끼리 쓰는 말이 아니라 대행사와 주고받는
 * 말이라 시스템이 고정한다. 여기서 정하는 것은 그 직무의 금액뿐이다.
 */
const SettingsForm = () => {
  const { data, isLoading } = useSettingsQuery();
  const { updateMutation } = useSettingsMutation();

  /*
    기준 설정은 화면 전체가 하나의 긴 폼이라, 저장 버튼만 감추면
    담당자는 직무를 지우고 수당을 바꾼 뒤에야 저장할 수 없다는 것을 안다.
    그래서 `fieldset disabled`로 입력 칸을 통째로 잠근다.
    (조회는 `settings:read`, 수정은 `settings:write` — 이 화면은 둘을 모두 쓴다)
  */
  const canWrite = useHasPermission("settings:write");

  // 편집 전에는 서버 값을 그대로 쓰고, 편집이 시작되면 draft가 화면을 담당한다.
  const [draft, setDraft] = useState<OperationSettings | null>(null);
  const settings = draft ?? data;
  const isDirty = draft !== null;

  if (isLoading || !settings) {
    return <Skeleton className="h-96 w-full rounded-card" />;
  }

  const update = <K extends keyof OperationSettings>(
    key: K,
    value: OperationSettings[K],
  ) => setDraft({ ...settings, [key]: value });

  /*
    카탈로그(이름 · 순서)와 저장된 단가를 합쳐서 그린다.
    시스템에 직무가 새로 추가되면 저장된 설정에 없더라도 여기에 바로 나타난다.
  */
  const jobRoles = mergeJobRoles(settings.jobRoles);

  /**
   * 직무 한 줄의 단가 · 사용 여부를 고친다.
   *
   * **저장할 배열은 화면에 그린 것이 아니라 순수한 설정값이다.**
   * 카탈로그에서 온 이름 · 순서 · 설명까지 같이 저장해 버리면 그 값이
   * 서버에 사본으로 남고, 나중에 시스템이 이름을 고쳐도 저장된 옛 이름이
   * 계속 따라다닌다. 합친 값은 화면에서만 쓰고 저장은 코드 기준으로 한다.
   */
  const updateJobRole = (code: JobRole, patch: Partial<JobRoleDef>) =>
    setDraft({
      ...settings,
      jobRoles: sanitizeJobRoles(jobRoles).map((role) =>
        role.code === code ? { ...role, ...patch } : role,
      ),
    });

  const updateFeature = (key: FeatureKey, mode: FeatureMode) =>
    setDraft({
      ...settings,
      featureModes: { ...settings.featureModes, [key]: mode },
    });

  /*
    인사 · 운영 기준은 켜고 끄기만 한다.

    다른 기능처럼 3단계를 다 열 필요가 없다. 이건 메뉴가 아니라 카드 하나라
    '잠금'과 '안 씀'이 화면에서 같은 모습이다. 그래서 스위치 하나로 두고,
    켠 상태는 아직 실제로 돌지 않으므로 항상 MOCK이다.
  */
  const isHrPolicyOn = settings.featureModes.HR_POLICY !== "LOCKED";

  /*
    이름 · 코드 검사는 더 이상 없다. 둘 다 시스템이 갖는다.
    남은 위험은 하나뿐이다 — 직무를 전부 꺼 버리면 행사를 만들 수 없다.
  */
  const hasNoActiveJobRole = !hasActiveJobRole(jobRoles);

  return (
    <fieldset disabled={!canWrite} className="contents">
      {!canWrite && (
        <Alert tone="warning" title="기준 설정을 볼 수만 있습니다.">
          직무 · 수당 기준 · 기능 잠금을 바꾸려면 &lsquo;기준 설정 &gt; 등록 ·
          수정&rsquo; 권한이 필요합니다.
        </Alert>
      )}

      {/*
        상단 안내와 '마지막 저장' 줄은 두지 않는다.
        카드마다 제목 아래에 이미 그 카드가 무엇을 정하는지 적혀 있고,
        저장 시각은 저장 버튼을 누르는 사람에게 새로 알려 주는 것이 없다.
      */}

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {isDirty && (
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Refresh size={15} />}
              onClick={() => setDraft(null)}
            >
              되돌리기
            </Button>
          )}

          <Button
            variant="primary"
            size="sm"
            disabled={!isDirty || hasNoActiveJobRole}
            isLoading={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate(settings, {
                onSuccess: () => setDraft(null),
              })
            }
          >
            저장
          </Button>
        </div>
      </div>

      {/* --------------------------- 직무별 단가 --------------------------- */}
      <Card
        title="직무별 단가"
        description="직무는 시스템이 정합니다. 여기서는 각 직무의 지급 · 청구 금액만 정하세요."
        noPadding
      >
        {/*
          직무 표는 고정 컬럼만 700px가 넘는다. 좁은 화면에서 억지로 욱여넣으면
          이름 · 금액 칸이 잘려 무슨 값인지 읽을 수 없다.
          표는 폭을 지키고 자기 안에서 가로로 스크롤한다. (가이드 13-1)
        */}
        <div className="overflow-x-auto scrollbar-thin">
          {/*
            한 행이 그리는 칸과 머리글의 칸 수가 어긋나면 표 전체가 밀린다.
            두 곳이 같은 정의를 쓰도록 컬럼 폭을 상수 하나로 묶어 둔다.
          */}
          <div className="min-w-[860px]">
            <div className="flex flex-col divide-y divide-border-main">
              <div
                className={cn(
                  JOB_ROLE_GRID,
                  "bg-subtle px-5 py-2.5 text-[12px] font-medium text-font-2",
                )}
              >
                <span>직무</span>
                <span>지급 기준</span>
                <span>지급 단가</span>
                <span>청구 단가</span>
                <span className="text-center">사용</span>
              </div>

              {jobRoles.map((role) => (
                <div
                  key={role.code}
                  className={cn(JOB_ROLE_GRID, "items-center px-5 py-3")}
                >
                  {/*
                    이름은 입력칸이 아니라 글자다. 읽기 전용 입력칸으로 두면
                    눌러 보고 나서야 못 고치는 것을 알게 된다.
                    설명을 같이 적어 대행사와 뜻을 맞출 수 있게 한다.
                  */}
                  <div className="min-w-0">
                    <p className="text-[14px] text-font-1">{role.name}</p>
                    <p className="mt-0.5 text-[12px] text-font-2">
                      {role.description}
                    </p>
                  </div>

                  {/*
                    직무마다 계산 관행이 다르다.
                    설치 · 철거처럼 시간이 들쭉날쭉한 일은 하루 얼마로 통으로 정한다.
                    여기서 정한 값이 행사 등록 폼의 초기값이 된다.
                  */}
                  <Select
                    aria-label={`${role.name} 지급 기준`}
                    options={WAGE_TYPE_OPTIONS}
                    value={role.defaultWageType}
                    onChange={(changeEvent) =>
                      updateJobRole(role.code, {
                        defaultWageType: changeEvent.target.value as WageType,
                      })
                    }
                  />

                  <AmountInput
                    aria-label={`${role.name} 지급 단가`}
                    value={role.defaultWage}
                    rightSlot={
                      <span className="text-[13px] whitespace-nowrap text-font-2">
                        {WAGE_TYPE_UNIT[role.defaultWageType]}
                      </span>
                    }
                    onValueChange={(defaultWage) =>
                      updateJobRole(role.code, { defaultWage })
                    }
                  />

                  {/*
                    청구 단가는 **언제나 시급**이다.
                    지급을 일급으로 하더라도 대행사에 넣는 견적은 시간 단위라
                    지급 기준을 따라가지 않는다.
                  */}
                  <AmountInput
                    aria-label={`${role.name} 청구 단가`}
                    placeholder="미설정"
                    value={role.billingRate}
                    rightSlot={
                      <span className="text-[13px] whitespace-nowrap text-font-2">
                        원 / 시간
                      </span>
                    }
                    onValueChange={(billingRate) =>
                      updateJobRole(role.code, { billingRate })
                    }
                  />

                  <div className="flex justify-center">
                    <Switch
                      label={`${role.name} 사용`}
                      checked={role.isActive}
                      onChange={(checked) =>
                        updateJobRole(role.code, { isActive: checked })
                      }
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border-main px-5 py-3">
          {hasNoActiveJobRole && (
            <p className="flex items-center gap-1.5 text-[12px] text-font-error">
              <Warning size={13} />
              직무를 하나 이상 켜 두어야 행사를 등록할 수 있습니다.
            </p>
          )}
          <p className="text-[12px] text-font-2">
            <b className="text-font-1">지급 단가</b>는 인력에게 주는 금액,{" "}
            <b className="text-font-1">청구 단가</b>는 대행사에 견적으로 부르는
            금액입니다. 둘 다 행사 등록 시 초기값으로 깔리고 행사마다 고칠 수
            있습니다. 우리가 취급하지 않는 직무는 &lsquo;사용&rsquo;을 끄면
            선택지에서 빠집니다. (지난 기록은 그대로 남습니다)
          </p>
        </div>
      </Card>

      {/* ------------------------------ 수당 ------------------------------ */}
      <Card
        title="수당 · 정산 기준"
        description="여기서 정한 값은 정산 건의 초기값입니다. 건별로 정산 화면에서 다시 켜고 끌 수 있습니다."
      >
        <div className="flex flex-col gap-4">
          <div className="rounded-field border border-border-main">
            <div className="flex items-center justify-between border-b border-border-main px-4 py-3">
              <div>
                <p className="text-[14px] text-font-1">연장수당</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  기준 시간을 넘긴 만큼 가산합니다. 거래처와 협의해 붙이지 않는
                  건도 흔하므로 강제하지 않습니다.
                </p>
              </div>
              <Switch
                label="연장수당 기본 적용"
                checked={settings.isOvertimeEnabled}
                onChange={(checked) => update("isOvertimeEnabled", checked)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-4 py-3">
              <FormField label="연장근로 기준" hint="이 시간을 넘긴 만큼 가산">
                <Input
                  type="number"
                  min={1}
                  max={24}
                  disabled={!settings.isOvertimeEnabled}
                  value={settings.overtimeThresholdHours}
                  onChange={(event) =>
                    update("overtimeThresholdHours", Number(event.target.value))
                  }
                  rightSlot={
                    <span className="text-[13px] text-font-2">시간</span>
                  }
                />
              </FormField>

              <FormField
                label="가산율"
                hint={`초과분 ${(1 + settings.overtimeRate).toFixed(1)}배 지급`}
              >
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={2}
                  disabled={!settings.isOvertimeEnabled}
                  value={settings.overtimeRate}
                  onChange={(event) =>
                    update("overtimeRate", Number(event.target.value))
                  }
                  rightSlot={<span className="text-[13px] text-font-2">배</span>}
                />
              </FormField>
            </div>
          </div>

          <div className="rounded-field border border-border-main">
            <div className="flex items-center justify-between border-b border-border-main px-4 py-3">
              <div>
                <p className="text-[14px] text-font-1">야간수당</p>
                <p className="mt-0.5 text-[12px] text-font-2">
                  야간 시간대에 걸친 근무시간만큼 가산합니다.
                </p>
              </div>
              <Switch
                label="야간수당 기본 적용"
                checked={settings.isNightPayEnabled}
                onChange={(checked) => update("isNightPayEnabled", checked)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 py-3">
              <FormField label="야간 시작">
                <TimeInput
                  disabled={!settings.isNightPayEnabled}
                  value={settings.nightStartTime}
                  onChange={(nextTime) => update("nightStartTime", nextTime)}
                />
              </FormField>

              <FormField label="야간 종료">
                <TimeInput
                  disabled={!settings.isNightPayEnabled}
                  value={settings.nightEndTime}
                  onChange={(nextTime) => update("nightEndTime", nextTime)}
                />
              </FormField>

              <FormField
                label="가산율"
                hint={`야간 시간 ${(1 + settings.nightRate).toFixed(1)}배`}
              >
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  max={2}
                  disabled={!settings.isNightPayEnabled}
                  value={settings.nightRate}
                  onChange={(event) =>
                    update("nightRate", Number(event.target.value))
                  }
                  rightSlot={<span className="text-[13px] text-font-2">배</span>}
                />
              </FormField>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="원천징수율"
              hint={`${(settings.withholdingRate * 100).toFixed(1)}% (사업소득 기본 3.3%)`}
            >
              <Input
                type="number"
                step="0.001"
                min={0}
                max={1}
                value={settings.withholdingRate}
                onChange={(event) =>
                  update("withholdingRate", Number(event.target.value))
                }
              />
            </FormField>

            <FormField
              label="최저 시급"
              hint={`${formatCurrency(settings.minimumHourlyWage)} 미만은 입력할 수 없습니다.`}
            >
              <Input
                type="number"
                min={0}
                step={10}
                value={settings.minimumHourlyWage}
                onChange={(event) =>
                  update("minimumHourlyWage", Number(event.target.value))
                }
                rightSlot={<span className="text-[13px] text-font-2">원</span>}
              />
            </FormField>
          </div>
        </div>
      </Card>


      {/* --------------------------- 인사 · 운영 --------------------------- */}
      <Card
        title="인사 · 운영 기준"
        description="사람이 매번 판단하지 않아도 되도록 기준을 숫자로 고정합니다."
      >
        {/*
          아직 쓸 수 없는 기능이다.

          세 값 모두 "때가 되면 시스템이 먼저 알려 준다"를 전제로 하는데,
          알림을 내보낼 곳(문자 · 푸시)이 없어서 숫자만 저장되고 아무 일도
          일어나지 않는다. 그대로 열어 두면 담당자는 설정을 해 놓고
          "돌아가고 있겠지"라고 믿는다 — 그게 가장 위험하다.

          그렇다고 화면에서 지우지는 않는다. 지우면 나중에 무엇이 있었는지
          알 수 없다. 켜고 끌 수 있게 두고, 켜도 체험이라는 것을 배너로 밝힌다.
        */}
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3 rounded-field border border-border-main px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] text-font-1">인사 · 운영 기준 사용</p>
              <p className="mt-0.5 text-[12px] text-font-2">
                끄면 아래 기준값을 쓰지 않습니다. 블랙리스트 후보 · 출근 안내 ·
                계약서 기한을 담당자가 직접 챙기는 방식입니다.
              </p>
            </div>
            <Switch
              label="인사 · 운영 기준 사용 여부"
              checked={isHrPolicyOn}
              onChange={(checked) =>
                updateFeature("HR_POLICY", checked ? "MOCK" : "LOCKED")
              }
            />
          </div>

          {/*
            배너는 `FeatureNotice`가 아니라 여기서 직접 그린다.
            그 컴포넌트는 **저장된** 설정(스토어)을 보는데, 이 화면은 아직
            저장 전인 draft를 들고 있다. 방금 켠 스위치와 배너가 어긋나면
            무엇이 지금 값인지 알 수 없게 된다.
          */}
          {isHrPolicyOn && (
            <Alert tone="warning" title="체험(MOCK) 모드입니다.">
              {FEATURE_HINT.HR_POLICY}
            </Alert>
          )}
        </div>

        {!isHrPolicyOn ? (
          <p className="rounded-field border border-dashed border-border-strong px-4 py-6 text-center text-[13px] text-font-2">
            지금은 쓰지 않는 기준입니다. 필요해지면 위에서 다시 켤 수 있습니다.
          </p>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField label="블랙리스트 후보 기준" hint="노쇼 누적 횟수">
            <Input
              type="number"
              min={1}
              max={10}
              value={settings.blacklistNoShowThreshold}
              onChange={(event) =>
                update("blacklistNoShowThreshold", Number(event.target.value))
              }
              rightSlot={<span className="text-[13px] text-font-2">회</span>}
            />
          </FormField>

          <FormField label="출근 안내 발송" hint="행사 시작 며칠 전">
            <Input
              type="number"
              min={0}
              max={7}
              value={settings.reminderDaysBefore}
              onChange={(event) =>
                update("reminderDaysBefore", Number(event.target.value))
              }
              rightSlot={<span className="text-[13px] text-font-2">일 전</span>}
            />
          </FormField>

          <FormField
            label="계약서 등록 기한"
            hint="근무 시작 며칠 전까지 서명본을 받아야 하는지"
          >
            <Input
              type="number"
              min={1}
              max={30}
              value={settings.contractRegisterDeadlineDays}
              onChange={(event) =>
                update(
                  "contractRegisterDeadlineDays",
                  Number(event.target.value),
                )
              }
              rightSlot={<span className="text-[13px] text-font-2">일</span>}
            />
          </FormField>
        </div>
        )}
      </Card>

      {/* --------------------------- 기능 사용 범위 -------------------------- */}
      <Card
        title="기능 사용 범위"
        description="아직 쓸 수 없는 기능을 잠그거나, 샘플 데이터로 미리 둘러볼 수 있습니다."
      >
        <div className="flex flex-col gap-3">
          <Alert tone="info" title="지금은 대부분의 업무를 손으로 처리합니다.">
            모집 공고나 문자 발송처럼 외부 연동이 필요한 기능은 화면만 만들어 둔
            상태입니다. 메뉴에서 지워 버리면 나중에 무엇이 있었는지 알 수 없고,
            그냥 열어 두면 진짜 데이터인 줄 알고 쓰게 됩니다. 그래서 세 단계로
            나눠 뒀습니다.
          </Alert>

          {FEATURE_KEYS.map((key) => (
            <div
              key={key}
              className="flex flex-col gap-3 rounded-field border border-border-main px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[14px] text-font-1">
                    {FEATURE_LABEL[key]}
                  </p>
                  <Badge
                    tone={
                      settings.featureModes[key] === "ENABLED"
                        ? "success"
                        : settings.featureModes[key] === "MOCK"
                          ? "warning"
                          : "neutral"
                    }
                  >
                    {FEATURE_MODE_LABEL[settings.featureModes[key]]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[12px] text-font-2">
                  {FEATURE_HINT[key]}
                </p>
                <p className="mt-0.5 text-[12px] text-font-disabled">
                  {FEATURE_MODE_DESCRIPTION[settings.featureModes[key]]}
                </p>
              </div>

              <div className="flex shrink-0 items-center rounded-field border border-border-main p-0.5">
                {FEATURE_MODES.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateFeature(key, mode)}
                    className={
                      settings.featureModes[key] === mode
                        ? "rounded-[7px] bg-surface-selected px-2.5 py-1 text-[13px] font-medium text-brand transition"
                        : "shrink-0 rounded-[7px] px-2.5 py-1 text-[13px] whitespace-nowrap text-font-2 transition hover:bg-surface-hover hover:text-font-1"
                    }
                  >
                    {FEATURE_MODE_LABEL[mode]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </fieldset>
  );
};

export default SettingsForm;
