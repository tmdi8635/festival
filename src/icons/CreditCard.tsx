import React from "react";
import { IconProps, LineIconWrapper } from ".";

const CreditCard = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19" />
    </LineIconWrapper>
  );
};

export default CreditCard;
