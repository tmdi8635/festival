"use client";

import { ReactNode } from "react";
import { ShieldAlert } from "@/icons";
import { cn } from "@/lib/utils";
import { useAdminStore, useHasPermission } from "@/store/useAdminStore";
import { permissionLabel, type PermissionKey } from "@/type/permission";
import Card from "@/components/ui/Card";

interface PermissionDeniedProps {
  required: PermissionKey;
  /** 카드 안에 넣지 않고 문단만 쓸 때 */
  bare?: boolean;
  className?: string;
}

/**
 * 권한이 없을 때 보여 주는 안내.
 *
 * **무엇이 없어서 막혔는지를 이름으로 말해 준다.**
 * "권한이 없습니다"만 띄우면 담당자는 무엇을 요청해야 하는지 몰라
 * 결국 최고관리자에게 "그냥 다 열어 달라"고 하게 되고, 그러면 권한을 나눈 의미가 사라진다.
 *
 * 그래서 필요한 권한 이름(`정산 > 지급 승인`)과 지금 직책을 함께 적는다.
 * 그대로 복사해 요청할 수 있어야 한다.
 */
export const PermissionDenied = ({
  required,
  bare = false,
  className,
}: PermissionDeniedProps) => {
  const admin = useAdminStore((state) => state.admin);

  const body = (
    <div
      className={cn(
        "flex flex-col items-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-danger-bg text-danger">
        <ShieldAlert size={24} />
      </span>

      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-semibold text-font-0">
          이 화면을 볼 권한이 없습니다.
        </p>
        <p className="text-[13px] text-font-2">
          현재 직책은 <b className="text-font-1">{admin?.roleName ?? "-"}</b>
          입니다.
        </p>
      </div>

      {/* 요청할 때 그대로 복사할 수 있게 코드 형태로 둔다. */}
      <div className="flex flex-col items-center gap-1 rounded-field border border-border-main bg-subtle px-4 py-3">
        <span className="text-[12px] text-font-2">필요한 권한</span>
        <code className="text-[13px] font-semibold text-font-1">
          {permissionLabel(required)}
        </code>
      </div>

      <p className="text-[12px] text-font-2">
        최고관리자에게 위 권한을 요청하세요. (운영 &gt; 직책 · 권한)
      </p>
    </div>
  );

  return bare ? body : <Card noPadding>{body}</Card>;
};

interface PermissionGateProps {
  required: PermissionKey;
  children: ReactNode;
  /** 막혔을 때 대신 그릴 것. 비우면 안내 화면이 나온다. */
  fallback?: ReactNode;
}

/**
 * 권한이 있을 때만 자식을 그린다.
 *
 * 화면을 감추는 것은 **실수를 줄이는 장치일 뿐** 막는 수단이 아니다.
 * 실제로 막는 것은 서버(`requirePermission`)다. 둘 다 있어야 하는 이유는,
 * 서버만 있으면 담당자가 끝까지 입력한 뒤에야 거부당하고,
 * 화면만 있으면 주소를 직접 치는 순간 통과하기 때문이다.
 */
const PermissionGate = ({
  required,
  children,
  fallback,
}: PermissionGateProps) => {
  const allowed = useHasPermission(required);

  if (allowed) return <>{children}</>;

  return <>{fallback ?? <PermissionDenied required={required} />}</>;
};

export default PermissionGate;
