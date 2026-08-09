import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ClipboardList = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2.5" />
      <path d="M9 4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6H9Z" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </LineIconWrapper>
  );
};

export default ClipboardList;
