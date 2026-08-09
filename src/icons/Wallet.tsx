import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Wallet = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3Z" />
      <path d="M3 8.5h15" />
      <circle cx="17" cy="13" r="1.2" />
    </LineIconWrapper>
  );
};

export default Wallet;
