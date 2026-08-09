import React from "react";
import { IconProps, LineIconWrapper } from ".";

const EyeOff = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m3 3 18 18" />
      <path d="M10.7 6a9.9 9.9 0 0 1 1.3-.1c6 0 9.5 6.1 9.5 6.1a17 17 0 0 1-2.8 3.6" />
      <path d="M6.5 7.7A16.4 16.4 0 0 0 2.5 12S6 18.1 12 18.1a9.4 9.4 0 0 0 4-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </LineIconWrapper>
  );
};

export default EyeOff;
