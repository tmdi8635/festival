import { ReactNode } from "react";
import type { FeatureKey } from "@/type/ops";
import {
  Ban,
  Bell,
  Briefcase,
  Building,
  Calendar,
  ClipboardList,
  Dashboard,
  FileText,
  Layers,
  ListLines,
  Megaphone,
  MessageSquare,
  Receipt,
  Send,
  ShieldCheck,
  Sliders,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
} from "@/icons";

export interface AdminMenuItem {
  label: string;
  href: string;
  icon?: ReactNode;
  /**
   * 이 메뉴가 속한 기능.
   * 기준 설정에서 잠그면 메뉴에서 사라지고, MOCK이면 배지가 붙는다.
   */
  feature?: FeatureKey;
}

export interface AdminMenuGroup {
  /** 메뉴 펼침 상태를 저장할 키 */
  key: string;
  label: string;
  icon: ReactNode;
  /** 하위가 없는 단독 메뉴는 href를 갖는다. */
  href?: string;
  /** 그룹 전체가 하나의 기능인 경우 (예: 모집) */
  feature?: FeatureKey;
  children?: AdminMenuItem[];
}

const ICON_SIZE = 19;
const SUB_ICON_SIZE = 17;

/**
 * 좌측 네비게이션 정의.
 *
 * 분류 기준
 * 1) 1뎁스는 **실제 업무가 흘러가는 순서**대로 둔다.
 *    행사 등록 → 인력 배치 → 근로계약서 → 현장 안내 → 진행(근태) → 정산
 *    메뉴를 위에서 아래로 훑으면 그날 할 일의 순서와 같아야 한다.
 * 2) 2뎁스는 그 안에서 실제로 사람이 앉아서 처리하는 화면 단위다.
 * 3) 하위가 1개뿐인 도메인은 2뎁스를 만들지 않고 단독 메뉴로 둔다.
 * 4) 흐름에 직접 끼지 않는 기준 정보(거래처)와 설정(운영)은 맨 아래로 내린다.
 *
 * '모집'은 앱이 나오기 전까지 쓸 수 없어 흐름 중간이 아니라 아래쪽에 둔다.
 * (기준 설정에서 잠그면 메뉴에서 아예 사라진다)
 *
 * 자세한 근거는 docs/ADMIN_PLAN.md 2장 참고.
 */
export const ADMIN_MENU: AdminMenuGroup[] = [
  {
    key: "dashboard",
    label: "대시보드",
    icon: <Dashboard size={ICON_SIZE} />,
    href: "/",
  },
  {
    key: "schedule",
    label: "행사 일정",
    icon: <Calendar size={ICON_SIZE} />,
    children: [
      {
        label: "캘린더",
        href: "/schedule",
        icon: <Calendar size={SUB_ICON_SIZE} />,
      },
      {
        label: "행사 목록",
        href: "/schedule/events",
        icon: <Briefcase size={SUB_ICON_SIZE} />,
      },
      {
        label: "배치 · 근태 현황",
        href: "/schedule/assignments",
        icon: <UserCheck size={SUB_ICON_SIZE} />,
      },
    ],
  },
  {
    key: "staff",
    label: "인사관리",
    icon: <Users size={ICON_SIZE} />,
    children: [
      {
        label: "인력풀",
        href: "/staff",
        icon: <Users size={SUB_ICON_SIZE} />,
      },
      {
        label: "서류 관리",
        href: "/staff/documents",
        icon: <FileText size={SUB_ICON_SIZE} />,
      },
      {
        label: "블랙리스트",
        href: "/staff/blacklist",
        icon: <Ban size={SUB_ICON_SIZE} />,
      },
    ],
  },
  {
    key: "contracts",
    label: "근로계약",
    icon: <FileText size={ICON_SIZE} />,
    children: [
      {
        label: "계약서 관리",
        href: "/contracts",
        icon: <FileText size={SUB_ICON_SIZE} />,
      },
      {
        label: "계약서 템플릿",
        href: "/contracts/templates",
        icon: <Layers size={SUB_ICON_SIZE} />,
      },
    ],
  },
  {
    key: "messages",
    label: "공지 · 발송",
    icon: <MessageSquare size={ICON_SIZE} />,
    feature: "MESSAGE",
    children: [
      {
        label: "문자 발송",
        href: "/messages",
        icon: <Send size={SUB_ICON_SIZE} />,
        feature: "MESSAGE",
      },
      {
        label: "발송 이력",
        href: "/messages/history",
        icon: <Receipt size={SUB_ICON_SIZE} />,
        feature: "MESSAGE",
      },
      {
        label: "메시지 템플릿",
        href: "/messages/templates",
        icon: <Bell size={SUB_ICON_SIZE} />,
        feature: "MESSAGE",
      },
    ],
  },
  {
    key: "payroll",
    label: "정산",
    icon: <Wallet size={ICON_SIZE} />,
    href: "/payroll",
  },
  {
    key: "clients",
    label: "거래처",
    icon: <Building size={ICON_SIZE} />,
    href: "/clients",
    feature: "CLIENT",
  },
  {
    key: "recruit",
    label: "모집",
    icon: <Megaphone size={ICON_SIZE} />,
    feature: "RECRUIT",
    children: [
      {
        label: "공고 관리",
        href: "/recruit/postings",
        icon: <ClipboardList size={SUB_ICON_SIZE} />,
        feature: "RECRUIT",
      },
      {
        label: "지원자 관리",
        href: "/recruit/applications",
        icon: <UserPlus size={SUB_ICON_SIZE} />,
        feature: "RECRUIT",
      },
    ],
  },
  {
    key: "ops",
    label: "운영",
    icon: <ShieldCheck size={ICON_SIZE} />,
    children: [
      {
        label: "담당자 관리",
        href: "/ops/managers",
        icon: <ShieldCheck size={SUB_ICON_SIZE} />,
      },
      {
        label: "기준 설정",
        href: "/ops/settings",
        icon: <Sliders size={SUB_ICON_SIZE} />,
      },
      {
        label: "운영 로그",
        href: "/ops/logs",
        icon: <ListLines size={SUB_ICON_SIZE} />,
      },
    ],
  },
];

/** 현재 경로가 속한 1뎁스 그룹 키를 찾는다. */
export const findActiveGroupKey = (pathname: string): string | undefined => {
  const matched = ADMIN_MENU.find((group) => {
    // 단독 메뉴는 상세 경로(/payroll/1)도 같은 메뉴로 취급한다.
    if (group.href) {
      return (
        group.href === pathname ||
        (group.href !== "/" && pathname.startsWith(`${group.href}/`))
      );
    }

    return group.children?.some((child) => isMenuItemActive(child, pathname));
  });

  return matched?.key;
};

/**
 * 2뎁스 활성 판정.
 *
 * 상세 경로(`/schedule/events/12`)도 목록 메뉴를 켜 두어야 하므로 prefix 매칭을 허용하되,
 * **더 구체적인 형제 메뉴가 그 경로를 맡고 있으면 양보한다.**
 * (`/schedule`이 `/schedule/events/12`까지 같이 켜지면 캘린더와 행사 목록이 동시에 활성화된다)
 */
export const isMenuItemActive = (
  item: AdminMenuItem,
  pathname: string,
): boolean => {
  if (pathname === item.href) return true;
  if (!pathname.startsWith(`${item.href}/`)) return false;

  const hasMoreSpecificSibling = ADMIN_MENU.some((group) =>
    group.children?.some(
      (child) =>
        child.href !== item.href &&
        child.href.startsWith(`${item.href}/`) &&
        (child.href === pathname || pathname.startsWith(`${child.href}/`)),
    ),
  );

  return !hasMoreSpecificSibling;
};
