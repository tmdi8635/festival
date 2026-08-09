import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ChevronRight = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m9 6 6 6-6 6" />
    </LineIconWrapper>
  );
};

export default ChevronRight;
