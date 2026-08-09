import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Info = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" />
      <path d="M12 7.8h.01" />
    </LineIconWrapper>
  );
};

export default Info;
