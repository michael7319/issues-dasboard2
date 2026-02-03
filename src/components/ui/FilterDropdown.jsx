import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function FilterDropdown({ 
  buttonRef, 
  isOpen, 
  onClose, 
  children 
}) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Create portal container
  useEffect(() => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    containerRef.current = container;
    
    return () => {
      if (containerRef.current) {
        document.body.removeChild(containerRef.current);
      }
    };
  }, []);

  // Update position when opened
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    
    const updatePosition = () => {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: buttonRect.bottom + window.scrollY + 8,
        left: buttonRect.left + window.scrollX
      });
    };
    
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, buttonRef]);

  // Handle outside clicks and escape key
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClick = (e) => {
      // Ignore clicks on the button (let button handle it)
      if (buttonRef.current?.contains(e.target)) return;
      
      // Ignore clicks inside the dropdown
      if (contentRef.current?.contains(e.target)) return;
      
      // Close on outside clicks
      onClose();
    };
    
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    // Small delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }, 50);
    
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen || !containerRef.current) return null;

  return createPortal(
    <div
      ref={contentRef}
      style={{
        position: 'absolute',
        top: position.top + 'px',
        left: position.left + 'px',
        zIndex: 9999,
        minWidth: '288px'
      }}
      className="bg-yellow-200 shadow-xl rounded border-2 border-blue-600"
    >
      {children}
    </div>,
    containerRef.current
  );
}