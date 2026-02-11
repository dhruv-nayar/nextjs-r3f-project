import React from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
}) => {
  const baseStyles = 'rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';

  const variantStyles = {
    primary: 'bg-sage text-white hover:bg-sage/90 focus:ring-sage/50 disabled:bg-sage/50',
    secondary: 'bg-white text-taupe border-2 border-taupe/20 hover:bg-floral-white hover:border-taupe/30 focus:ring-taupe/30 disabled:bg-white/50 disabled:text-taupe/50',
    danger: 'bg-scarlet text-white hover:bg-scarlet/90 focus:ring-scarlet/50 disabled:bg-scarlet/50',
    ghost: 'bg-transparent text-taupe hover:bg-floral-white focus:ring-taupe/30 disabled:text-taupe/50',
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const disabledStyles = disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${disabledStyles} ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
