"use client";

import Link from "next/link";
import { useFeatureMode } from "@/store/useOrgStore";
import { FEATURE_HINT, FEATURE_LABEL, type FeatureKey } from "@/type/ops";
import Alert from "@/components/ui/Alert";

interface FeatureNoticeProps {
  feature: FeatureKey;
  /** 이 기능이 준비되기 전까지 무엇을 대신 하면 되는지 */
  fallback: string;
}

/**
 * 기능 운영 모드 안내.
 *
 * 지금은 대부분의 업무를 손으로 처리한다. 그래서 만들어는 뒀지만
 * 아직 실제로 쓸 수 없는 화면이 섞여 있다.
 *
 * 아무 표시 없이 열어 두면 진짜 데이터인 줄 알고 입력하게 되고,
 * 나중에 "내가 등록한 공고가 어디 갔냐"는 일이 생긴다.
 * 그래서 MOCK 모드에서는 화면 맨 위에서 이 사실을 분명히 알린다.
 *
 * "안 되는 기능"이라고만 적지 않는다. **지금 무엇을 대신 하면 되는지**를 함께 적는다.
 */
const FeatureNotice = ({ feature, fallback }: FeatureNoticeProps) => {
  const mode = useFeatureMode(feature);

  if (mode === "ENABLED") return null;

  if (mode === "LOCKED") {
    return (
      <Alert tone="danger" title={`${FEATURE_LABEL[feature]} 기능이 잠겨 있습니다.`}>
        이 화면의 데이터는 실제 업무에 반영되지 않습니다.{" "}
        <Link href="/ops/settings" className="font-medium underline">
          운영 &gt; 기준 설정
        </Link>
        에서 사용 범위를 바꿀 수 있습니다.
      </Alert>
    );
  }

  return (
    <Alert
      tone="warning"
      title={`체험(MOCK) 모드입니다. 실제 업무에 반영되지 않습니다.`}
    >
      {FEATURE_HINT[feature]} 지금 보이는 값은 화면을 확인하기 위한 샘플
      데이터이며, 여기서 등록하거나 수정한 내용은 새로고침하면 사라집니다.
      <br />
      <b>지금은 이렇게 하세요.</b> {fallback}{" "}
      <Link href="/ops/settings" className="font-medium underline">
        운영 &gt; 기준 설정
      </Link>
      에서 이 기능을 켜거나 잠글 수 있습니다.
    </Alert>
  );
};

export default FeatureNotice;
