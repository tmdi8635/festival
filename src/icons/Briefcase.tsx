import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Briefcase = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <rect x="2.5" y="7" width="19" height="13" rx="2.5" />
      <path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7" />
      <path d="M2.5 12.5h19" />
    </LineIconWrapper>
  );
};

export default Briefcase;
