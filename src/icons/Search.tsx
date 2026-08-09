import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Search = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.6-3.6" />
    </LineIconWrapper>
  );
};

export default Search;
