import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Send = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M20.5 3.5 10.8 13.2" />
      <path d="M20.5 3.5 14.3 20.8l-3.5-7.6-7.6-3.5Z" />
    </LineIconWrapper>
  );
};

export default Send;
