import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ShieldAlert = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M12 2.5 4.5 5.4v6.1c0 4.6 3.1 8.5 7.5 10 4.4-1.5 7.5-5.4 7.5-10V5.4z" />
      <path d="M12 8.2v4.2" />
      <path d="M12 15.6h.01" />
    </LineIconWrapper>
  );
};

export default ShieldAlert;
