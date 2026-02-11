'use client';

import React, { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  show: boolean;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  show,
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const typeStyles = {
    success: 'bg-sage text-white border-sage/20',
    error: 'bg-scarlet text-white border-scarlet/20',
    info: 'bg-taupe text-white border-taupe/20',
  };

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
      <div
        className={`${typeStyles[type]} px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 border min-w-[300px]`}
      >
        <span className="text-xl font-semibold">{icons[type]}</span>
        <p className="font-body font-medium flex-1">{message}</p>
        <button
          onClick={onClose}
          className="ml-2 text-white/80 hover:text-white transition-colors text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default Toast;
