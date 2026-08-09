import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Coin = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M14.7 9.4A3.2 3.2 0 0 0 12 8.2c-1.7 0-3 .9-3 2.1 0 2.7 6 1.1 6 3.8 0 1.2-1.3 2.1-3 2.1a3.2 3.2 0 0 1-2.7-1.2" />
      <path d="M12 6.6v10.8" />
    </LineIconWrapper>
  );
};

export default Coin;
