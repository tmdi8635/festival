import React from "react";
import { IconProps, LineIconWrapper } from ".";

const CheckCircle = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.2 12.2 2.6 2.6 5-5.2" />
    </LineIconWrapper>
  );
};

export default CheckCircle;
