import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ArrowDown = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M12 5v14" />
      <path d="m5.5 12.5 6.5 6.5 6.5-6.5" />
    </LineIconWrapper>
  );
};

export default ArrowDown;
