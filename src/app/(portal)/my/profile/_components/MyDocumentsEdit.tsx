"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import Skeleton from "@/components/ui/Skeleton";
import PortalBackHeader from "@/app/(portal)/_components/PortalBackHeader";
import MyDocumentForm from "./MyDocumentForm";
import MyHealthCertForm from "./MyHealthCertForm";

/**
 * 서류 제출 화면 — 필수 서류(신분증 · 계좌)와 보건증을 **다른 폼으로** 낸다.
 *
 * 공고에서 "보건증이 필요해요"를 보고 들어온 사람(`?focus=health-cert`)에게는
 * 보건증을 먼저 세운다. 이미 승인된 신분증 폼을 지나 스크롤해 내려가게 두면,
 * 그 폼을 건드려 멀쩡한 승인을 대기로 되돌리는 일이 생긴다.
 */
const MyDocumentsEdit = () => {
  const router = useRouter();
  const isHealthCertFirst = useSearchParams().get("focus") === "health-cert";
  const { data: profile, isLoading } = useMyProfileQuery();

  const backToProfile = () => router.push("/my/profile");

  if (isLoading || !profile) {
    return (
      <>
        <PortalBackHeader href="/my/profile" label="내 정보" />
        <Skeleton className="h-[640px] w-full rounded-card" />
      </>
    );
  }

  const documentForm = <MyDocumentForm profile={profile} onSaved={backToProfile} />;
  const healthCertForm = (
    <MyHealthCertForm profile={profile} onSaved={backToProfile} />
  );

  return (
    <>
      <PortalBackHeader href="/my/profile" label="내 정보" />

      {isHealthCertFirst ? (
        <>
          {healthCertForm}
          {documentForm}
        </>
      ) : (
        <>
          {documentForm}
          {healthCertForm}
        </>
      )}
    </>
  );
};

export default MyDocumentsEdit;
