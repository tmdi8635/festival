import React from "react";
import { IconProps, LineIconWrapper } from ".";

const ImageIcon = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-4.5-4.5L7 21" />
    </LineIconWrapper>
  );
};

export default ImageIcon;
