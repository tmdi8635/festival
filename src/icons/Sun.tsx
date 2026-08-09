import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Sun = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2" />
      <path d="M12 19.8V22" />
      <path d="m4.6 4.6 1.6 1.6" />
      <path d="m17.8 17.8 1.6 1.6" />
      <path d="M2 12h2.2" />
      <path d="M19.8 12H22" />
      <path d="m4.6 19.4 1.6-1.6" />
      <path d="m17.8 6.2 1.6-1.6" />
    </LineIconWrapper>
  );
};

export default Sun;
