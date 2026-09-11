"use client";

import { useRouter } from "next/navigation";
import { useMyProfileQuery } from "@/api/my/getMyProfile";
import Skeleton from "@/components/ui/Skeleton";
import PortalBackHeader from "@/app/(portal)/_components/PortalBackHeader";
import MyProfileForm from "./MyProfileForm";

/**
 * 인적사항 수정 화면. 저장하면 읽기 화면(`/my/profile`)으로 돌아간다 —
 * 방금 고친 값이 제자리에 들어갔는지를 그 자리에서 확인하게 한다.
 */
const MyProfileEdit = () => {
  const router = useRouter();
  const { data: profile, isLoading } = useMyProfileQuery();

  const backToProfile = () => router.push("/my/profile");

  return (
    <>
      <PortalBackHeader href="/my/profile" label="내 정보" />

      {isLoading || !profile ? (
        <Skeleton className="h-[640px] w-full rounded-card" />
      ) : (
        <MyProfileForm
          profile={profile}
          onSaved={backToProfile}
          onCancel={backToProfile}
        />
      )}
    </>
  );
};

export default MyProfileEdit;
