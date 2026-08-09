import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ShieldCheck = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M12 2.5 4.5 5.4v6.1c0 4.6 3.1 8.5 7.5 10 4.4-1.5 7.5-5.4 7.5-10V5.4z" />
      <path d="m8.8 11.9 2.2 2.2 4.2-4.3" />
    </LineIconWrapper>
  );
};

export default ShieldCheck;
