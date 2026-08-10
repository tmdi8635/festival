"use client";

import Image from "next/image";
import Link from "next/link";
import { Briefcase, Clock, Edit, Phone, ShieldCheck, Trash } from "@/icons";
import { formatDate, formatDateTime } from "@/lib/dayjs";
import { useHasPermission } from "@/store/useAdminStore";
import { type Employee } from "@/type/employee";
import { GENDER_LABEL, calculateAge, formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

interface EmployeeDetailModalProps {
  employee: Employee | null;
  onClose: () => void;
  onEdit: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}

/** 라벨 · 값 한 줄 */
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
    <p className="text-[13px] text-font-2 sm:w-24 sm:shrink-0">{label}</p>
    <div className="min-w-0 text-[14px] text-font-1 sm:flex-1">{value}</div>
  </div>
);

const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className="rounded-card border border-border-main">
    <p className="flex items-center gap-1.5 border-b border-border-main bg-subtle px-4 py-2.5 text-[13px] font-medium text-font-1">
      <span className="text-font-2">{icon}</span>
      {title}
    </p>
    <div className="flex flex-col divide-y divide-border-main px-4 py-1">
      {children}
    </div>
  </section>
);

/**
 * 직원 상세.
 *
 * **목록에서 바로 수정 창이 열리면 안 된다.** 목록은 훑는 자리이고, 줄을 누르는
 * 것은 "이 사람 누구더라"를 확인하는 동작이다. 그 동작이 곧바로 편집 상태로
 * 들어가면 실수로 값을 바꾸고 저장하는 사고가 난다.
 *
 * 그래서 목록에는 이름 · 연락처 · 권한만 두고, 나머지 인적사항은 전부 여기서
 * 보여 준다. 고치는 것은 여기서 한 번 더 눌러야 시작된다.
 */
const EmployeeDetailModal = ({
  employee,
  onClose,
  onEdit,
  onDelete,
}: EmployeeDetailModalProps) => {
  const canWrite = useHasPermission("employee:write");
  const canDelete = useHasPermission("employee:delete");

  const age = calculateAge(employee?.birthDate);

  return (
    <Modal
      isOpen={Boolean(employee)}
      onClose={onClose}
      title="직원 정보"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
          {canDelete && employee && !employee.isSuperAdmin && (
            <Button
              variant="dangerGhost"
              leftIcon={<Trash size={15} />}
              onClick={() => onDelete(employee)}
            >
              삭제
            </Button>
          )}
          {canWrite && employee && (
            <Button
              variant="primary"
              leftIcon={<Edit size={15} />}
              onClick={() => onEdit(employee)}
            >
              수정
            </Button>
          )}
        </>
      }
    >
      {employee && (
        <div className="flex flex-col gap-4">
          {/* 머리. 얼굴 · 이름 · 자리 · 번호까지가 한눈에 들어와야 한다. */}
          <div className="flex flex-wrap items-center gap-4 rounded-card border border-border-main bg-subtle p-4">
            <div className="relative size-16 shrink-0 overflow-hidden rounded-full bg-surface">
              {employee.profileImageUrl && (
                <Image
                  src={employee.profileImageUrl}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                  unoptimized
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[18px] font-bold text-font-0">
                  {employee.name}
                </p>
                <Badge tone="info">{employee.position}</Badge>
                {employee.isActive ? (
                  <Badge tone="success">재직</Badge>
                ) : (
                  <Badge tone="neutral">퇴사</Badge>
                )}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-font-2">
                <a
                  href={`tel:${employee.phoneNumber}`}
                  className="flex items-center gap-1 tabular-nums transition hover:text-brand"
                >
                  <Phone size={13} />
                  {formatPhoneNumber(employee.phoneNumber)}
                </a>
                <span className="truncate">{employee.email}</span>
              </div>
            </div>
          </div>

          <Section title="인적사항" icon={<Briefcase size={14} />}>
            <Row
              label="생년월일"
              value={
                employee.birthDate ? (
                  <span className="tabular-nums">
                    {formatDate(employee.birthDate)}
                    {age !== undefined && (
                      <span className="text-font-2"> · 만 {age}세</span>
                    )}
                  </span>
                ) : (
                  "-"
                )
              }
            />
            <Row label="성별" value={GENDER_LABEL[employee.gender]} />
            <Row label="주소" value={employee.address || "-"} />
            {/*
              비상 연락처는 목록에 두지 않고 여기서만 보여 준다.
              현장에서 사고가 났을 때 찾는 번호라 평소에는 볼 일이 없고,
              목록에 늘어놓으면 정작 매일 쓰는 본인 번호가 눈에 덜 띈다.
            */}
            <Row
              label="비상 연락처"
              value={
                employee.emergencyContact ? (
                  <span className="tabular-nums">
                    {formatPhoneNumber(employee.emergencyContact)}
                  </span>
                ) : (
                  "-"
                )
              }
            />
            <Row
              label="입사일"
              value={
                <span className="tabular-nums">
                  {employee.hireDate ? formatDate(employee.hireDate) : "-"}
                </span>
              }
            />
            <Row label="메모" value={employee.memo || "-"} />
          </Section>

          <Section title="권한 · 근무 기준" icon={<ShieldCheck size={14} />}>
            <Row
              label="시스템 권한"
              value={
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={employee.isSuperAdmin ? "brand" : "neutral"}>
                    {employee.roleName}
                  </Badge>
                  <Link
                    href="/ops/roles"
                    className="text-[12px] text-brand underline"
                  >
                    직책 · 권한
                  </Link>
                </span>
              }
            />
            {/*
              근무시간 집계.
              전원이 대상은 아니다. 대표 · 실장처럼 현장 시간으로 평가할 수 없는
              자리는 꺼 두고, 그 사람은 '직원 근무'에 나오지 않는다.
            */}
            <Row
              label="근무 집계"
              value={
                employee.tracksWorkHours ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">
                      기준 {employee.baseMonthlyHours}시간 / 월
                    </span>
                    <Link
                      href="/ops/employees/work"
                      className="text-[12px] text-brand underline"
                    >
                      직원 근무
                    </Link>
                  </span>
                ) : (
                  <span className="text-font-2">집계 대상이 아닙니다.</span>
                )
              }
            />
          </Section>

          <Section title="활동" icon={<Clock size={14} />}>
            {/*
              '담당 행사 n건'은 두지 않는다. 이 사람이 몇 건을 맡았는지는
              행사 목록에서 담당자로 걸러 보면 되고, 여기서는 숫자 하나만 남아
              어느 행사인지도 알 수 없었다.
            */}
            <Row
              label="마지막 접속"
              value={
                <span className="tabular-nums">
                  {formatDateTime(employee.lastLoginAt)}
                </span>
              }
            />
            <Row
              label="등록일"
              value={
                <span className="tabular-nums">
                  {formatDate(employee.createdAt)}
                </span>
              }
            />
          </Section>
        </div>
      )}
    </Modal>
  );
};

export default EmployeeDetailModal;
