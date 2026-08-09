import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Sparkle = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M12 3.5 13.9 9l5.6 2-5.6 2-1.9 5.5L10.1 13l-5.6-2 5.6-2Z" />
      <path d="M18.5 3.5v3" />
      <path d="M20 5h-3" />
    </LineIconWrapper>
  );
};

export default Sparkle;
