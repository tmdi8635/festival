import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ChevronLeft = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m15 6-6 6 6 6" />
    </LineIconWrapper>
  );
};

export default ChevronLeft;
