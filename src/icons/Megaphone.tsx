import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Megaphone = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M3.5 10.2v3.2a1.6 1.6 0 0 0 1.6 1.6h1.9l7 4.5V4.5l-7 4.5H5.1a1.6 1.6 0 0 0-1.6 1.2" />
      <path d="M18 9a4 4 0 0 1 0 6" />
      <path d="M7 15v4.5" />
    </LineIconWrapper>
  );
};

export default Megaphone;
