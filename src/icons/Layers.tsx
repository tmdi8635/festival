import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Layers = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m12 3 9 4.5-9 4.5-9-4.5z" />
      <path d="m3 12.4 9 4.5 9-4.5" />
      <path d="m3 17 9 4.5 9-4.5" />
    </LineIconWrapper>
  );
};

export default Layers;
