import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Grip = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="9" cy="6" r="1.4" />
      <circle cx="15" cy="6" r="1.4" />
      <circle cx="9" cy="12" r="1.4" />
      <circle cx="15" cy="12" r="1.4" />
      <circle cx="9" cy="18" r="1.4" />
      <circle cx="15" cy="18" r="1.4" />
    </LineIconWrapper>
  );
};

export default Grip;
