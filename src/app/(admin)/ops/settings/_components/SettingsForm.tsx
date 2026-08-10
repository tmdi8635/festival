"use client";

import { useState } from "react";
import { useSettingsQuery } from "@/api/ops/getSettings";
import { WAGE_TYPE_OPTIONS } from "@/constants/eventOptions";
import { useSettingsMutation } from "@/api/ops/mutateSettings";
import { useHasPermission } from "@/store/useAdminStore";
import { ArrowDown, ArrowUp, Plus, Refresh, Trash, Warning } from "@/icons";
import { formatDateTime } from "@/lib/dayjs";
import { cn, formatCurrency } from "@/lib/utils";
import { openConfirm } from "@/store/useConfirmStore";
import {
  FEATURE_HINT,
  FEATURE_LABEL,
  FEATURE_MODE_DESCRIPTION,
  FEATURE_MODE_LABEL,
  canRemoveJobRole,
  type FeatureKey,
  type FeatureMode,
  type OperationSettings,
} from "@/type/ops";
import { WAGE_TYPE_UNIT, type WageType } from "@/type/event";
import {
  nextJobRoleCode,
  nextJobRoleOrder,
  sortJobRoles,
  type JobRoleDef,
} from "@/type/staff";
import Alert from "@/components/ui/Alert";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import FormField from "@/components/ui/FormField";
import IconButton from "@/components/ui/IconButton";
import Input from "@/components/ui/Input";
import TimeInput from "@/components/ui/TimeInput";
import Select from "@/components/ui/Select";
import Skeleton from "@/components/ui/Skeleton";
import Switch from "@/components/ui/Switch";

const FEATURE_KEYS: FeatureKey[] = ["RECRUIT", "MESSAGE", "CLIENT"];
const FEATURE_MODES: FeatureMode[] = ["ENABLED", "MOCK", "LOCKED"];

/**
 * 직무 표의 컬럼 폭.
 *
 * 머리글과 각 행이 따로 정의를 들고 있으면 칸 수가 한 번 어긋나는 순간
 * 표 전체가 밀린다. (실제로 그렇게 깨져 있었다) 한 상수를 둘 다 쓴다.
 */
const JOB_ROLE_GRID =
  "grid grid-cols-[84px_minmax(0,1fr)_150px_110px_190px_64px_40px] gap-3";

/**
 * 새 직무의 초기값.
 *
 * 코드는 사람이 정하지 않는다. 겹치지 않기만 하면 되는 내부 값이라
 * 시스템이 붙이고, 사용자는 이름만 적는다.
 */
const buildNewJobRole = (jobRoles: JobRoleDef[]): JobRoleDef => ({
  code: nextJobRoleCode(jobRoles),
  name: "",
  shortName: "",
  order: nextJobRoleOrder(jobRoles),
  defaultWageType: "HOURLY",
  defaultWage: 12000,
  isActive: true,
});

/**
 * 기준 설정.
 *
 * 이 시스템이 하려는 일은 "매번 사람이 판단하던 것을 규칙으로 굳히는 것"이다.
 * 다만 에이전시마다 운영 방식이 달라서, 규칙을 시스템이 강제하면 오히려 못 쓰게 된다.
 * 그래서 직무 · 수당 · 원천징수까지 전부 여기서 켜고 끄고 이름을 바꿀 수 있게 한다.
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
    화면은 항상 order 순으로 그린다.
    저장 · 조회를 거치면 배열 순서는 언제든 뒤집히므로 배열에 기대지 않는다.
  */
  const jobRoles = sortJobRoles(settings.jobRoles);

  const setJobRoles = (nextJobRoles: JobRoleDef[]) =>
    setDraft({ ...settings, jobRoles: nextJobRoles });

  const updateJobRole = (index: number, patch: Partial<JobRoleDef>) =>
    setJobRoles(
      jobRoles.map((role, roleIndex) =>
        roleIndex === index ? { ...role, ...patch } : role,
      ),
    );

  /**
   * 직무 순서 변경.
   *
   * 자주 쓰는 직무가 목록 맨 위에 있어야 행사 등록이 빨라진다.
   * 자리를 맞바꾼 뒤 order를 1부터 다시 매겨, 중간에 빈 번호가 생기지 않게 한다.
   */
  const handleMoveJobRole = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= jobRoles.length) return;

    const reordered = [...jobRoles];

    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];

    setJobRoles(
      reordered.map((role, roleIndex) => ({ ...role, order: roleIndex + 1 })),
    );
  };

  /**
   * 직무 삭제.
   *
   * 직무는 인력의 '가능 직무', 행사의 '발주', 배치, 계약서, 정산이 모두 참조한다.
   * 지우면 그 직무로 잡혀 있던 사람들의 직무가 사라지므로 반드시 경고를 띄운다.
   * 마지막 한 개는 지울 수 없다. 직무가 없으면 행사를 만들 수 없다.
   */
  const handleRemoveJobRole = (index: number) => {
    const target = jobRoles[index];

    openConfirm({
      title: `'${target.name || "이름 없는"}' 직무를 삭제할까요?`,
      description:
        "이 직무로 등록된 인력의 '가능 직무'에서 빠지고, 진행 중인 행사의 발주 항목도 사라집니다.",
      warning:
        "이미 끝난 행사의 배치 · 계약서 · 정산 기록에는 이 직무가 그대로 남습니다. 이름만 코드로 보이게 됩니다. 당분간 쓰지 않을 직무라면 삭제 대신 '사용'을 꺼 두세요.",
      confirmText: "삭제",
      tone: "danger",
      onConfirm: async () => {
        setJobRoles(
          jobRoles
            .filter((_, roleIndex) => roleIndex !== index)
            // 지운 자리를 메워 순서에 구멍이 남지 않게 한다.
            .map((role, roleIndex) => ({ ...role, order: roleIndex + 1 })),
        );
      },
    });
  };

  const handleAddJobRole = () =>
    setJobRoles([...jobRoles, buildNewJobRole(jobRoles)]);

  const updateFeature = (key: FeatureKey, mode: FeatureMode) =>
    setDraft({
      ...settings,
      featureModes: { ...settings.featureModes, [key]: mode },
    });

  /**
   * 이름이 비면 화면 어디에도 그릴 수 없고, 같은 이름이 둘이면
   * 배치 · 정산 표에서 어느 직무인지 구분되지 않는다.
   * (코드는 시스템이 붙이므로 더 이상 검사할 것이 없다)
   */
  const jobRoleNames = jobRoles.map((role) => role.name.trim());
  const hasInvalidJobRole = jobRoles.some(
    (role, index) =>
      !role.name.trim() || jobRoleNames.indexOf(role.name.trim()) !== index,
  );

  return (
    <fieldset disabled={!canWrite} className="contents">
      {!canWrite && (
        <Alert tone="warning" title="기준 설정을 볼 수만 있습니다.">
          직무 · 수당 기준 · 기능 잠금을 바꾸려면 &lsquo;기준 설정 &gt; 등록 ·
          수정&rsquo; 권한이 필요합니다.
        </Alert>
      )}

      <Alert tone="info" title="여기서 정한 값이 자동 계산의 기준이 됩니다.">
        직무 기본 시급은 행사 등록 시 초기값으로, 수당 기준은 정산 계산에
        쓰입니다. 여기서 정한 시급은 어디까지나 <b>기준값</b>이라 행사 안에서
        사람마다 · 날마다 얼마든지 고칠 수 있습니다. 쓰지 않는 기능은 아래
        &lsquo;기능 사용 범위&rsquo;에서 잠글 수 있습니다.
      </Alert>

      <div className="flex items-center justify-between">
        <p className="text-[13px] text-font-2">
          마지막 저장 {formatDateTime(settings.updatedAt)}
        </p>

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
            disabled={!isDirty || hasInvalidJobRole}
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

      {/* ------------------------------ 직무 ------------------------------ */}
      <Card
        title="직무"
        description="에이전시마다 부르는 이름도 구성도 다릅니다. 자유롭게 만들고 이름을 바꾸세요."
        action={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={handleAddJobRole}
          >
            직무 추가
          </Button>
        }
        noPadding
      >
        {/*
          한 행이 그리는 칸과 머리글의 칸 수가 어긋나면 표 전체가 밀린다.
          두 곳이 같은 정의를 쓰도록 컬럼 폭을 상수 하나로 묶어 둔다.
        */}
        {/*
          직무 표는 고정 컬럼만 700px가 넘는다. 좁은 화면에서 억지로 욱여넣으면
          이름 · 금액 칸이 잘려 무슨 값인지 읽을 수 없다.
          표는 폭을 지키고 자기 안에서 가로로 스크롤한다. (가이드 13-1)
        */}
        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[880px]">
            <div className="flex flex-col divide-y divide-border-main">
              <div className={cn(JOB_ROLE_GRID, "bg-subtle px-5 py-2.5 text-[12px] font-medium text-font-2")}>
                <span className="text-center">순서</span>
                <span>이름</span>
                <span>짧은 이름</span>
                <span>지급 기준</span>
                <span>기본 금액</span>
                <span className="text-center">사용</span>
                <span />
              </div>

              {jobRoles.map((role, index) => {
                const isDuplicated =
                  Boolean(role.name.trim()) &&
                  jobRoleNames.indexOf(role.name.trim()) !== index;

                return (
                  <div
                    key={role.code}
                    className={cn(JOB_ROLE_GRID, "items-center px-5 py-3")}
                  >
                    {/* 자주 쓰는 직무를 위로 올려 두면 행사 등록이 빨라진다. */}
                    <div className="flex items-center justify-center">
                      <IconButton
                        label="위로 이동"
                        icon={<ArrowUp size={15} />}
                        disabled={index === 0}
                        onClick={() => handleMoveJobRole(index, -1)}
                      />
                      <IconButton
                        label="아래로 이동"
                        icon={<ArrowDown size={15} />}
                        disabled={index === jobRoles.length - 1}
                        onClick={() => handleMoveJobRole(index, 1)}
                      />
                    </div>

                    <Input
                      aria-label="직무 이름"
                      value={role.name}
                      placeholder="스태프"
                      hasError={!role.name.trim() || isDuplicated}
                      onChange={(event) =>
                        updateJobRole(index, { name: event.target.value })
                      }
                    />

                    <Input
                      aria-label="짧은 이름"
                      value={role.shortName}
                      placeholder="캘린더용"
                      onChange={(event) =>
                        updateJobRole(index, { shortName: event.target.value })
                      }
                    />

                    {/*
                      직무마다 계산 관행이 다르다.
                      설치 · 철거처럼 시간이 들쭉날쭉한 일은 하루 얼마로 통으로 정한다.
                      여기서 정한 값이 행사 등록 폼의 초기값이 된다.
                    */}
                    <Select
                      aria-label="기본 지급 기준"
                      options={WAGE_TYPE_OPTIONS}
                      value={role.defaultWageType}
                      onChange={(changeEvent) =>
                        updateJobRole(index, {
                          defaultWageType: changeEvent.target.value as WageType,
                        })
                      }
                    />

                    <Input
                      type="number"
                      aria-label="기본 금액"
                      min={0}
                      step={500}
                      value={role.defaultWage}
                      rightSlot={
                        <span className="text-[13px] whitespace-nowrap text-font-2">
                          {WAGE_TYPE_UNIT[role.defaultWageType]}
                        </span>
                      }
                      onChange={(event) =>
                        updateJobRole(index, {
                          defaultWage: Number(event.target.value),
                        })
                      }
                    />

                    <div className="flex justify-center">
                      <Switch
                        label={`${role.name || "새 직무"} 사용`}
                        checked={role.isActive}
                        onChange={(checked) =>
                          updateJobRole(index, { isActive: checked })
                        }
                      />
                    </div>

                    <IconButton
                      label="직무 삭제"
                      icon={<Trash size={16} />}
                      tone="danger"
                      disabled={!canRemoveJobRole(jobRoles)}
                      title={
                        canRemoveJobRole(jobRoles)
                          ? "직무를 삭제합니다."
                          : "직무는 최소 한 개가 있어야 합니다."
                      }
                      onClick={() => handleRemoveJobRole(index)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 border-t border-border-main px-5 py-3">
          {hasInvalidJobRole && (
            <p className="flex items-center gap-1.5 text-[12px] text-font-error">
              <Warning size={13} />
              직무 이름은 비울 수 없고, 서로 겹칠 수 없습니다.
            </p>
          )}
          <p className="text-[12px] text-font-2">
            여기서 정한 순서대로 행사 발주 · 배치 · 통계에 직무가 나열됩니다.
            이름을 바꾸면 모든 화면에 즉시 반영되고, 과거 배치 · 계약서 · 정산
            기록도 새 이름으로 보입니다.
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
