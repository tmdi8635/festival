import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Users = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M16 20.5V19a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1.5" />
      <circle cx="9" cy="7" r="3.5" />
      <path d="M22 20.5V19a4 4 0 0 0-3-3.87" />
      <path d="M16.5 3.7a4 4 0 0 1 0 6.6" />
    </LineIconWrapper>
  );
};

export default Users;
