"use client";

import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import { STAFF_STATUS_LABEL, STAFF_STATUS_TONE } from "@/constants/staffOptions";
import { ChevronRight, Edit, Wallet } from "@/icons";
import { formatDate } from "@/lib/dayjs";
import { useJobRoleComparator, useJobRoleLabel } from "@/store/useOrgStore";
import { GENDER_LABEL, formatPhoneNumber } from "@/type/staff";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import RatingStat from "@/components/domain/RatingStat";
import DocumentStatusCard from "@/app/(portal)/_components/DocumentStatusCard";

/** 섹션 제목 줄 우측의 '수정'. 읽는 화면과 고치는 화면을 가른다. */
const EditLink = ({ href, label }: { href: string; label: string }) => (
  <Link
    href={href}
    aria-label={label}
    className="-my-1 inline-flex h-8 items-center gap-1 rounded-field px-2 text-[13px] font-medium text-brand transition hover:bg-brand-opacity"
  >
    <Edit size={14} />
    수정
  </Link>
);

const InfoRow = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2.5">
    <dt className="shrink-0 text-[13px] text-font-2">{label}</dt>
    <dd className="min-w-0 text-right text-[14px] break-words text-font-1">
      {children || <span className="text-font-disabled">-</span>}
    </dd>
  </div>
);

/**
 * 내 정보 — **읽는 화면이다.**
 *
 * 예전에는 들어오자마자 수정 폼이었다. 내 정보가 맞는지 확인하러 들어온 사람에게
 * 입력칸이 스무 개 열려 있으면, 무엇이 저장된 값이고 무엇을 방금 건드린 것인지 헷갈린다.
 * 보는 것과 고치는 것을 갈라, 고칠 때만 섹션의 '수정'으로 들어간다.
 *
 * 평판은 **점수 하나만** 위에 둔다. 누가 어느 현장에서 무엇을 눌렀는지를 보여 주면
 * 평가한 팀장과 받은 사람이 다음 현장에서 서로 불편해지고, 결국 아무도 솔직하게
 * 남기지 않는다. (`MyProfile.reputationScore` 주석)
 */
const MyProfileView = () => {
  const { data: profile, isLoading } = useMyProfileQuery();
  const jobRoleLabel = useJobRoleLabel();
  const compareJobRoles = useJobRoleComparator();

  /* 직무는 카탈로그 순서로 적는다. 신고한 순서대로 두면 사람마다 팀장이 맨 뒤에 가 있다. */
  const roleText = useMemo(
    () =>
      [...(profile?.roles ?? [])]
        .sort(compareJobRoles)
        .map((role) => jobRoleLabel(role))
        .join(", "),
    [profile, compareJobRoles, jobRoleLabel],
  );

  if (isLoading || !profile) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-96 w-full rounded-card" />
        <Skeleton className="h-56 w-full rounded-card" />
      </div>
    );
  }

  return (
    <>
      <Card>
        <div className="flex items-center gap-4">
          {profile.profileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.profileImageUrl}
              alt={`${profile.name} 프로필 사진`}
              className="size-14 shrink-0 rounded-full border border-border-main object-cover"
            />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand-opacity text-[20px] font-semibold text-brand">
              {profile.name.slice(0, 1)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[17px] font-semibold text-font-0">
                {profile.name}
              </p>
              <Badge tone={STAFF_STATUS_TONE[profile.status]}>
                {STAFF_STATUS_LABEL[profile.status]}
              </Badge>
            </div>
            <p className="mt-0.5 text-[13px] text-font-2 tabular-nums">
              {formatPhoneNumber(profile.phoneNumber)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-field bg-subtle px-4 py-3">
            <p className="text-[12px] text-font-2">평판 점수</p>
            <RatingStat
              reputationScore={profile.reputationScore}
              className="text-[22px] font-bold text-font-0"
            />
          </div>
          <div className="rounded-field bg-subtle px-4 py-3">
            <p className="text-[12px] text-font-2">근무한 날</p>
            <p className="text-[22px] font-bold text-font-0 tabular-nums">
              {profile.workCount}일
            </p>
          </div>
        </div>

        <p className="mt-2 text-[12px] text-font-2">
          평판 점수는 현장 평가가 쌓여 정해져요. 누가 어떤 평가를 남겼는지는 공개하지
          않아요.
        </p>
      </Card>

      <Card
        title="인적사항"
        action={<EditLink href="/my/profile/edit" label="인적사항 수정" />}
        bodyClassName="py-2"
      >
        <dl className="divide-y divide-border-main">
          <InfoRow label="이름">{profile.name}</InfoRow>
          <InfoRow label="휴대폰">
            <span className="tabular-nums">{formatPhoneNumber(profile.phoneNumber)}</span>
          </InfoRow>
          <InfoRow label="생년월일">
            {profile.birthDate && (
              <span className="tabular-nums">{formatDate(profile.birthDate)}</span>
            )}
          </InfoRow>
          <InfoRow label="성별">{GENDER_LABEL[profile.gender]}</InfoRow>
          <InfoRow label="할 수 있는 직무">{roleText}</InfoRow>
          <InfoRow label="활동 지역">
            {[profile.region, profile.district].filter(Boolean).join(" ")}
          </InfoRow>
          <InfoRow label="주소">{profile.address}</InfoRow>
          <InfoRow label="비상 연락처">
            {profile.emergencyContact && (
              <span className="tabular-nums">
                {formatPhoneNumber(profile.emergencyContact)}
              </span>
            )}
          </InfoRow>
          <InfoRow label="키">{profile.height ? `${profile.height}cm` : ""}</InfoRow>
          <InfoRow label="의상 사이즈">{profile.clothingSize}</InfoRow>
        </dl>
      </Card>

      <DocumentStatusCard
        profile={profile}
        action={<EditLink href="/my/profile/documents" label="서류 · 계좌 수정" />}
      />

      {/* 정산은 탭이 없다. 홈과 여기가 들어가는 길이다. */}
      <Link
        href="/my/payroll"
        className="flex items-center gap-3 rounded-card border border-border-main bg-surface p-5 shadow-card transition hover:-translate-y-px hover:border-brand hover:shadow-card-hover active:scale-[0.99]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-field bg-brand-opacity text-brand">
          <Wallet size={18} />
        </span>
        <span className="min-w-0 flex-1 text-[14px] font-medium text-font-1">
          정산 내역
        </span>
        <ChevronRight size={16} className="shrink-0 text-font-disabled" />
      </Link>
    </>
  );
};

export default MyProfileView;
