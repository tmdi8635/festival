import React from "react";
import { IconProps, LineIconWrapper } from ".";

const MapPin = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <path d="M19 10.2c0 5-7 11-7 11s-7-6-7-11a7 7 0 1 1 14 0Z" />
      <circle cx="12" cy="10" r="2.6" />
    </LineIconWrapper>
  );
};

export default MapPin;
