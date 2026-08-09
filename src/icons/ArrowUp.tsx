import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ArrowUp = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M12 19V5" />
      <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
    </LineIconWrapper>
  );
};

export default ArrowUp;
