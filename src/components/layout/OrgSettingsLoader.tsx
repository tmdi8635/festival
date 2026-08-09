"use client";

import { useSettingsQuery } from "@/api/ops/getSettings";

/**
 * 운영 기준 설정을 앱 시작 시 한 번 불러온다.
 *
 * 직무 이름 · 등급제 사용 여부 · 기능 잠금은 거의 모든 화면이 참조하는데,
 * 정작 그 값을 불러오는 것은 기준 설정 화면뿐이었다.
 * 그래서 인력풀처럼 설정을 조회하지 않는 화면은 기본값(등급제 켜짐)을 그대로 쓰고 있었고,
 * 설정을 꺼도 등급 컬럼이 사라지지 않았다.
 *
 * 레이아웃에서 한 번 불러 두면 `getSettings`가 응답을 받는 순간
 * 전역 스토어(useOrgStore)로 흘러 들어가 모든 화면이 같은 기준을 쓴다.
 * 그리는 것이 없으므로 레이아웃 어디에 두어도 된다.
 */
const OrgSettingsLoader = () => {
  useSettingsQuery();

  return null;
};

export default OrgSettingsLoader;
