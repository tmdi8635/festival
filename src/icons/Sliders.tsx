import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Sliders = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M4 6h9" />
      <path d="M17.5 6H20" />
      <circle cx="15.25" cy="6" r="2.25" />
      <path d="M4 12h2.5" />
      <path d="M11 12h9" />
      <circle cx="8.75" cy="12" r="2.25" />
      <path d="M4 18h9" />
      <path d="M17.5 18H20" />
      <circle cx="15.25" cy="18" r="2.25" />
    </LineIconWrapper>
  );
};

export default Sliders;
