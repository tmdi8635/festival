import React from "react";
import { IconProps, LineIconWrapper } from ".";

const MessageSquare = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 4V5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5z" />
    </LineIconWrapper>
  );
};

export default MessageSquare;
