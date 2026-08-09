import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Star = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m12 3.2 2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
    </LineIconWrapper>
  );
};

export default Star;
