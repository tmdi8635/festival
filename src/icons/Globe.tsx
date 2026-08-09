import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Globe = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.3 9.2h17.4" />
      <path d="M3.3 14.8h17.4" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </LineIconWrapper>
  );
};

export default Globe;
