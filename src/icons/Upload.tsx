import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Upload = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M12 16V4.8" />
      <path d="m7.5 9.1 4.5-4.3 4.5 4.3" />
      <path d="M4 17.5v2A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </LineIconWrapper>
  );
};

export default Upload;
