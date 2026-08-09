import React from "react";
import { IconProps, LineIconWrapper } from ".";

const UserCheck = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M15 20.5V19a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1.5" />
      <circle cx="8.5" cy="7" r="3.5" />
      <path d="m16 11.5 2 2 4-4" />
    </LineIconWrapper>
  );
};

export default UserCheck;
