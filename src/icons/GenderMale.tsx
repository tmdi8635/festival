import React from "react";
import { IconProps, LineIconWrapper } from ".";

/** 남성(♂). 원 + 오른쪽 위로 뻗은 화살. */
const GenderMale = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="10" cy="14" r="5.5" />
      <path d="M14.2 9.8 20 4" />
      <path d="M15 4h5v5" />
    </LineIconWrapper>
  );
};

export default GenderMale;
