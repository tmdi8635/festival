import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Warning = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M10.3 4 2.6 17.5a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0" />
      <path d="M12 9.2v4.2" />
      <path d="M12 16.8h.01" />
    </LineIconWrapper>
  );
};

export default Warning;
