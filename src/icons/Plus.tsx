import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Plus = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </LineIconWrapper>
  );
};

export default Plus;
