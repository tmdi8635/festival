import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Dots = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </LineIconWrapper>
  );
};

export default Dots;
