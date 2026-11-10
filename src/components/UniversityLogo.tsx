import React, { ImgHTMLAttributes } from 'react';

type UniversityLogoProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'>;

export const UniversityLogo: React.FC<UniversityLogoProps> = ({
  alt = 'Southern Leyte State University official seal',
  className = '',
  ...props
}) => (
  <img
    src="/images/slsu-logo.png"
    alt={alt}
    className={`block object-contain ${className}`.trim()}
    draggable={false}
    {...props}
  />
);
