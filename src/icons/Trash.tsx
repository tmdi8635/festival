import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Trash = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M4 7h16" />
      <path d="M9.5 4.5h5" />
      <path d="m6.5 7 .8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </LineIconWrapper>
  );
};

export default Trash;
