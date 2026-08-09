import Link from "next/link";
import { Search } from "@/icons";
import Button from "@/components/ui/Button";

/** 존재하지 않는 경로. 관리자 레이아웃 밖이므로 자체적으로 화면을 구성한다. */
export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg-base px-6 text-center">
      <span className="text-font-disabled">
        <Search size={40} />
      </span>

      <p className="text-[20px] font-bold text-font-0">
        존재하지 않는 페이지입니다.
      </p>
      <p className="text-[13px] text-font-2">
        주소가 바뀌었거나 삭제된 메뉴일 수 있습니다.
      </p>

      <Link href="/" className="mt-3">
        <Button variant="primary">대시보드로 이동</Button>
      </Link>
    </div>
  );
}
