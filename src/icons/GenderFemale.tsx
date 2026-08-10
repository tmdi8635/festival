import React from "react";
import { IconProps, LineIconWrapper } from ".";

/** 여성(♀). 원 + 아래로 내린 십자. */
const GenderFemale = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="8.5" r="5.5" />
      <path d="M12 14v6.5" />
      <path d="M9 18h6" />
    </LineIconWrapper>
  );
};

export default GenderFemale;
