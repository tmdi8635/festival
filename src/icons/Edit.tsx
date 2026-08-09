import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Edit = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M4 20h4L18.5 9.5a2.12 2.12 0 0 0-3-3L4 18z" />
      <path d="m14.5 6.5 3 3" />
    </LineIconWrapper>
  );
};

export default Edit;
