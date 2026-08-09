import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Eye = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
      <circle cx="12" cy="12" r="3" />
    </LineIconWrapper>
  );
};

export default Eye;
