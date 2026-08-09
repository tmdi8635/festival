import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Moon = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8" />
    </LineIconWrapper>
  );
};

export default Moon;
