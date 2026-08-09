import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Bell = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M18 8.8a6 6 0 1 0-12 0c0 5.9-2.5 7.4-2.5 7.4h17S18 14.7 18 8.8" />
      <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
    </LineIconWrapper>
  );
};

export default Bell;
