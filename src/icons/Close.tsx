import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Close = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </LineIconWrapper>
  );
};

export default Close;
