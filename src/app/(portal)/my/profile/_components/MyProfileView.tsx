"use client";

import Link from "next/link";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import { ChevronRight, Wallet } from "@/icons";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import MyDocumentForm from "./MyDocumentForm";
import MyProfileForm from "./MyProfileForm";
import MyReputationCard from "./MyReputationCard";

/**
 * 내 정보.
 *
 * 탭으로 나누지 않고 위에서 아래로 쌓는다. 폰에서 세 칸짜리 탭은 누를 때마다
 * 화면이 통째로 갈리는데, 여기 있는 것들은 서로 이어져 있다 —
 * 서류를 내면 상태가 바뀌고, 그 상태가 공고 지원 가능 여부를 가른다.
 */
const MyProfileView = () => {
  const { data: profile, isLoading } = useMyProfileQuery();

  if (isLoading || !profile) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-96 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  return (
    <>
      <MyProfileForm profile={profile} />

      {/* 서류·계좌는 저장하면 벌어지는 일이 달라 폼을 따로 둔다. */}
      <div id="DOCUMENT" className="scroll-mt-4">
        <MyDocumentForm profile={profile} />
      </div>

      <MyReputationCard />

      {/* 정산은 탭이 없다. 홈과 여기가 들어가는 길이다. */}
      <Link href="/my/payroll" className="block">
        <Card className="transition hover:bg-surface-hover">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-field bg-brand-opacity text-brand">
              <Wallet size={18} />
            </span>
            <span className="min-w-0 flex-1 text-[14px] font-medium text-font-1">
              정산 내역
            </span>
            <ChevronRight size={16} />
          </div>
        </Card>
      </Link>
    </>
  );
};

export default MyProfileView;
