import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  rounded?: '2xl' | '3xl';
}

const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  rounded = '2xl',
}) => {
  const baseStyles = 'bg-white shadow-sm border border-taupe/10';

  const paddingStyles = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  const roundedStyles = {
    '2xl': 'rounded-2xl',
    '3xl': 'rounded-3xl',
  };

  return (
    <div className={`${baseStyles} ${paddingStyles[padding]} ${roundedStyles[rounded]} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
