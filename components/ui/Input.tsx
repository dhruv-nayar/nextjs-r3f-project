import React from 'react';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, fullWidth = false, inputSize = 'md', className = '', ...props }, ref) => {
    const baseStyles = 'bg-white border border-taupe/20 rounded-xl text-graphite placeholder:text-taupe/50 font-body transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage/50 disabled:bg-floral-white disabled:cursor-not-allowed';

    const sizeStyles = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-3 text-base',
      lg: 'px-6 py-4 text-lg',
    };

    const errorStyles = error ? 'border-scarlet/50 focus:ring-scarlet/50 focus:border-scarlet/50' : '';
    const widthStyles = fullWidth ? 'w-full' : '';

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label className="block text-sm font-medium text-graphite mb-2 font-body">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`${baseStyles} ${sizeStyles[inputSize]} ${errorStyles} ${widthStyles} ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-scarlet font-body">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
