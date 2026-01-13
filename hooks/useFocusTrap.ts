/**
 * Focus Trap Hook
 * Traps keyboard focus within a container element for accessibility
 * Used in modals, dialogs, and overlays
 */

import { useEffect, useRef, useCallback } from 'react';

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface UseFocusTrapOptions {
  /** Whether the focus trap is active */
  isActive: boolean;
  /** Callback when escape key is pressed */
  onEscape?: () => void;
  /** Whether to return focus to the previously focused element on deactivation */
  returnFocusOnDeactivate?: boolean;
  /** Initial element to focus (selector or 'first' | 'last') */
  initialFocus?: string | 'first' | 'last';
}

/**
 * Custom hook to trap focus within a container
 * @param options Focus trap configuration
 * @returns Ref to attach to the container element
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions
) {
  const {
    isActive,
    onEscape,
    returnFocusOnDeactivate = true,
    initialFocus = 'first',
  } = options;

  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<Element | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    return Array.from(elements).filter(el => {
      // Filter out elements that are not visible
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  // Focus the initial element
  const focusInitialElement = useCallback(() => {
    const focusableElements = getFocusableElements();
    if (focusableElements.length === 0) return;

    let elementToFocus: HTMLElement | null = null;

    if (initialFocus === 'first') {
      elementToFocus = focusableElements[0];
    } else if (initialFocus === 'last') {
      elementToFocus = focusableElements[focusableElements.length - 1];
    } else if (typeof initialFocus === 'string') {
      elementToFocus = containerRef.current?.querySelector(initialFocus) || focusableElements[0];
    }

    if (elementToFocus) {
      // Use setTimeout to ensure element is rendered
      setTimeout(() => elementToFocus?.focus(), 0);
    }
  }, [getFocusableElements, initialFocus]);

  // Handle keyboard events for tab trapping and escape
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!containerRef.current) return;

    // Handle Escape key
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      event.stopPropagation();
      onEscape();
      return;
    }

    // Handle Tab key for focus trapping
    if (event.key === 'Tab') {
      const focusableElements = getFocusableElements();
      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Shift+Tab from first element -> focus last element
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      // Tab from last element -> focus first element
      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      // If focus is outside the container, bring it back
      if (!containerRef.current.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }, [getFocusableElements, onEscape]);

  // Activate focus trap
  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement;

    // Focus the initial element
    focusInitialElement();

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyDown, true);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);

      // Return focus to the previously focused element
      if (returnFocusOnDeactivate && previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive, focusInitialElement, handleKeyDown, returnFocusOnDeactivate]);

  return containerRef;
}

export default useFocusTrap;
