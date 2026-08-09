import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Building = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M4 21V4.5A1.5 1.5 0 0 1 5.5 3h9A1.5 1.5 0 0 1 16 4.5V21" />
      <path d="M16 10h3.5A1.5 1.5 0 0 1 21 11.5V21" />
      <path d="M2.5 21h19" />
      <path d="M7.5 7.5h5" />
      <path d="M7.5 11.5h5" />
      <path d="M7.5 15.5h5" />
    </LineIconWrapper>
  );
};

export default Building;
