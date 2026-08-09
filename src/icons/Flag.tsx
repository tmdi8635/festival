import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Flag = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M5 21V3.6" />
      <path d="M5 4.5h11.5l-2.2 4 2.2 4H5" />
    </LineIconWrapper>
  );
};

export default Flag;
