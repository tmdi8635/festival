import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Check = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </LineIconWrapper>
  );
};

export default Check;
