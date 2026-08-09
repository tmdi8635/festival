import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Activity = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </LineIconWrapper>
  );
};

export default Activity;
