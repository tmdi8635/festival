import React from "react";
import { IconProps, LineIconWrapper } from ".";

/**
 * 스태프 포털의 첫 화면 탭.
 *
 * 관리자 쪽 첫 화면은 `Dashboard`(격자)인데, 여기서는 쓰지 않는다.
 * 격자는 "여러 지표를 한눈에"라는 뜻이고, 이 화면이 말하는 것은
 * "다음에 어디로 가면 되는가" 하나다.
 */
const Home = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M3.5 10.2 12 3.5l8.5 6.7" />
      <path d="M5.5 9.2V19a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5V9.2" />
      <path d="M9.75 20.5v-5.25a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1v5.25" />
    </LineIconWrapper>
  );
};

export default Home;
