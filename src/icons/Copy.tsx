import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Copy = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5v-2A2.5 2.5 0 0 0 13 4H6a2.5 2.5 0 0 0-2.5 2.5V13A2.5 2.5 0 0 0 6 15.5h2" />
    </LineIconWrapper>
  );
};

export default Copy;
