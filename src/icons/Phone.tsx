import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Phone = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M6.2 3.5h3l1.6 4-2 1.4a12 12 0 0 0 6.3 6.3l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.2 5.7a2 2 0 0 1 2-2.2Z" />
    </LineIconWrapper>
  );
};

export default Phone;
