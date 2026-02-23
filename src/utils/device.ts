// src/utils/device.ts

/**
 * Basic mobile detection based on user agent and screen size
 */
export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  // Basic regex for mobile devices
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  
  // Screen size check (typical mobile/tablet breakpoint)
  const isSmallScreen = window.innerWidth <= 1024;
  
  return isMobileUA || isSmallScreen;
};

/**
 * Check if the device is specifically iOS
 */
export const isIOS = () => {
  if (typeof window === 'undefined') return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  return /iPhone|iPad|iPod/i.test(userAgent);
};
