import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ListLines = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </LineIconWrapper>
  );
};

export default ListLines;
