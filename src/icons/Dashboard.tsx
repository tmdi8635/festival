import React from "react";
import { IconProps, LineIconWrapper } from ".";

const Dashboard = (props: IconProps) => {
  return (
    <LineIconWrapper {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </LineIconWrapper>
  );
};

export default Dashboard;
