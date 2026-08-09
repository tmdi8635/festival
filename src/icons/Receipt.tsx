import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Receipt = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M5 3.6 6.75 5 8.5 3.6 10.25 5 12 3.6 13.75 5 15.5 3.6 17.25 5 19 3.6v16.8L17.25 19l-1.75 1.4L13.75 19 12 20.4 10.25 19 8.5 20.4 6.75 19 5 20.4z" />
      <path d="M8.5 9.5h7" />
      <path d="M8.5 13.5h7" />
    </LineIconWrapper>
  );
};

export default Receipt;
