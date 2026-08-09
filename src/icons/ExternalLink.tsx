import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ExternalLink = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14.5v4A2.5 2.5 0 0 1 15.5 21h-9A2.5 2.5 0 0 1 4 18.5v-9A2.5 2.5 0 0 1 6.5 7h4" />
    </LineIconWrapper>
  );
};

export default ExternalLink;
