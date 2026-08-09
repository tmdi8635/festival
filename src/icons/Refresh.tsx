import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Refresh = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M20.5 11.5a8.5 8.5 0 1 0-1.2 5" />
      <path d="M20.5 5v6.5H14" />
    </LineIconWrapper>
  );
};

export default Refresh;
