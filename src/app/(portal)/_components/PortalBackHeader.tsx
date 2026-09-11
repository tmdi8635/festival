import { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "@/icons";

interface PortalBackHeaderProps {
  /** 돌아갈 곳. 브라우저 뒤로가기가 아니라 **정해진 상위 화면**이다 */
  href: string;
  label: string;
  /** 우측 슬롯 (크게 보기 · 내려받기처럼 이 화면에만 있는 동작) */
  action?: ReactNode;
}

/**
 * 하위 화면의 '돌아가기' 줄.
 *
 * 포털 헤더에는 뒤로가기가 없다. 탭 다섯 칸이 전부 1뎁스라 필요 없었는데,
 * 계약서 상세 · 전문, 내 정보 수정처럼 **한 칸 들어간 화면**이 생겼다.
 *
 * `router.back()`을 쓰지 않는다. 홈의 할 일이나 문자로 받은 링크로 곧장 들어온 사람에게
 * 뒤로가기는 앱 밖(메신저)으로 나가는 버튼이 된다. 돌아갈 곳을 주소로 박아 둔다.
 */
const PortalBackHeader = ({ href, label, action }: PortalBackHeaderProps) => (
  <div className="-mb-1 flex min-h-10 items-center justify-between gap-2">
    <Link
      href={href}
      className="-ml-2 inline-flex h-10 min-w-0 items-center gap-1 rounded-field px-2 text-[14px] text-font-2 transition hover:bg-surface-hover hover:text-font-1 active:scale-[0.98]"
    >
      <ChevronLeft size={16} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>

    {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
  </div>
);

export default PortalBackHeader;
