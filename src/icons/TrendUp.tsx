import React from "react";
import { IconProps, LineIconWrapper } from ".";

const TrendUp = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M3.5 16.5 9 11l3.5 3.5L20 7" />
      <path d="M15.5 7H20v4.5" />
    </LineIconWrapper>
  );
};

export default TrendUp;
