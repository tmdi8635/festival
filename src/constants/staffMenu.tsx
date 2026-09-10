import { ReactNode } from "react";
import { Calendar, FileText, Home, Megaphone, UserCheck } from "@/icons";

export interface StaffMenuItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const ICON_SIZE = 20;

/**
 * 스태프 포털의 하단 탭. **화면 목록의 단일 원본이다.**
 *
 * 관리자 메뉴(`ADMIN_MENU`)와 같은 역할이되 훨씬 얕다. 사이드바를 쓰지 않는 이유가 있다 —
 * 이 화면을 여는 사람은 대부분 현장으로 이동하는 길 위에 있고, 한 손으로 쥔 폰에서
 * 엄지가 닿는 곳은 화면 아래다. 접히는 2뎁스 메뉴는 그 자리에 놓을 수 없다.
 *
 * 다섯 개를 넘기지 않는다. 폰 가로폭에서 여섯 칸이 되면 글자가 줄바꿈되기 시작하고,
 * 그때부터는 아이콘만 보고 눌러야 한다.
 *
 * 정산(`/my/payroll`)은 여기 없다. 자주 보는 화면이지만 **여섯 번째 칸이 없어서**
 * 홈의 이번 달 카드와 내 정보에서 들어간다. 탭을 하나 더 만드는 것보다
 * 들어가는 길을 두 개 두는 편이 낫다.
 */
export const STAFF_MENU: StaffMenuItem[] = [
  { label: "홈", href: "/my", icon: <Home size={ICON_SIZE} /> },
  {
    label: "일정",
    href: "/my/schedule",
    icon: <Calendar size={ICON_SIZE} />,
  },
  {
    label: "공고",
    href: "/my/postings",
    icon: <Megaphone size={ICON_SIZE} />,
  },
  {
    label: "계약서",
    href: "/my/contracts",
    icon: <FileText size={ICON_SIZE} />,
  },
  {
    label: "내 정보",
    href: "/my/profile",
    icon: <UserCheck size={ICON_SIZE} />,
  },
];

/**
 * 지금 이 탭이 켜져 있는가.
 *
 * `/my`는 정확히 일치할 때만 켠다. 접두사로 판정하면 모든 하위 화면에서
 * 홈까지 함께 켜져, 다섯 칸 중 두 칸이 늘 파랗게 된다.
 */
export const isStaffMenuActive = (href: string, pathname: string): boolean =>
  href === "/my" ? pathname === "/my" : pathname.startsWith(href);

/** 헤더 제목. 브레드크럼을 두기에는 뎁스가 얕다 */
export const staffPageTitle = (pathname: string): string =>
  STAFF_MENU.find((item) => isStaffMenuActive(item.href, pathname))?.label ??
  (pathname.startsWith("/my/payroll") ? "정산" : "내 페이지");
