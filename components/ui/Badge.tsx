import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'outline' | 'accent';
  size?: 'sm' | 'md';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = '',
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-body font-medium transition-colors';

  const variantStyles = {
    default: 'bg-floral-white text-taupe border border-taupe/10',
    outline: 'bg-transparent text-taupe border border-taupe/30',
    accent: 'bg-sage text-white border border-sage/20',
  };

  const sizeStyles = {
    sm: 'px-2.5 py-1 text-xs rounded-lg',
    md: 'px-3 py-1.5 text-sm rounded-xl',
  };

  return (
    <span className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
