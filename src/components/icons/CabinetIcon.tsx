import React from "react";

interface CabinetIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

const CabinetIcon: React.FC<CabinetIconProps> = ({ size = 24, className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {/* Outer cabinet frame */}
    <rect x="3" y="2" width="18" height="20" rx="2" />
    {/* Center divider */}
    <line x1="12" y1="2" x2="12" y2="22" />
    {/* Left door handle */}
    <line x1="10" y1="10" x2="10" y2="14" />
    {/* Right door handle */}
    <line x1="14" y1="10" x2="14" y2="14" />
  </svg>
);

export default CabinetIcon;
