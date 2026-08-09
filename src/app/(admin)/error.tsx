"use client";

import { useEffect } from "react";
import { Refresh, Warning } from "@/icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

/**
 * 관리자 화면 에러 바운더리.
 * 화면 하나가 터져도 사이드바와 헤더는 유지되어 다른 메뉴로 이동할 수 있다.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 서버 로깅이 붙으면 이 자리에서 전송한다.
    console.error("[admin] 화면 렌더링 중 오류:", error);
  }, [error]);

  return (
    <Card>
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <span className="text-danger">
          <Warning size={40} />
        </span>

        <p className="text-[16px] font-semibold text-font-0">
          화면을 불러오지 못했습니다.
        </p>
        <p className="text-[13px] text-font-2">
          일시적인 문제일 수 있습니다. 다시 시도해도 같은 화면이 보이면
          개발팀에 아래 오류 코드를 전달해 주세요.
        </p>

        {error.digest && (
          <code className="mt-1 rounded-field bg-subtle px-2.5 py-1 text-[12px] text-font-2">
            {error.digest}
          </code>
        )}

        <Button
          variant="primary"
          leftIcon={<Refresh size={15} />}
          onClick={reset}
          className="mt-3"
        >
          다시 시도
        </Button>
      </div>
    </Card>
  );
}
