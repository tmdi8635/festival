import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Logout = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M14.5 4.5h3A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-3" />
      <path d="m9.5 8.5-3.5 3.5 3.5 3.5" />
      <path d="M6 12h9" />
    </LineIconWrapper>
  );
};

export default Logout;
