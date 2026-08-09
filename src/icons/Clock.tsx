import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Clock = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </LineIconWrapper>
  );
};

export default Clock;
