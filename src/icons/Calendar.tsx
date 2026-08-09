import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Calendar = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M3.5 10h17" />
    </LineIconWrapper>
  );
};

export default Calendar;
