import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ChevronDown = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m6 9 6 6 6-6" />
    </LineIconWrapper>
  );
};

export default ChevronDown;
