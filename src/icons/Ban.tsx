import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Ban = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </LineIconWrapper>
  );
};

export default Ban;
