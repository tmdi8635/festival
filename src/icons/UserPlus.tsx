import React from "react";
import { IconProps, LineIconWrapper } from ".";

const UserPlus = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M14.5 20.5V19a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1.5" />
      <circle cx="8.25" cy="7" r="3.5" />
      <path d="M19 8.5v6" />
      <path d="M22 11.5h-6" />
    </LineIconWrapper>
  );
};

export default UserPlus;
