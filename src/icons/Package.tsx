import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Package = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="m12 3 8 4v10l-8 4-8-4V7z" />
      <path d="m4 7 8 4 8-4" />
      <path d="M12 11.2V21" />
    </LineIconWrapper>
  );
};

export default Package;
