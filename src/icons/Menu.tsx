import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Menu = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </LineIconWrapper>
  );
};

export default Menu;
