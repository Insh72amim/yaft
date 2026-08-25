'use client';

import { useState, useCallback } from 'react';

export interface UseDisclosureProps {
  initialOpen?: boolean;
  onOpen?: () => void;
  onClose?: () => void;
}

export function useDisclosure({
  initialOpen = false,
  onOpen: onOpenProp,
  onClose: onCloseProp,
}: UseDisclosureProps = {}) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  const open = useCallback(() => {
    setIsOpen(true);
    onOpenProp?.();
  }, [onOpenProp]);

  const close = useCallback(() => {
    setIsOpen(false);
    onCloseProp?.();
  }, [onCloseProp]);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) onOpenProp?.();
      else onCloseProp?.();
      return next;
    });
  }, [onOpenProp, onCloseProp]);

  return {
    isOpen,
    open,
    close,
    toggle,
    setIsOpen,
  };
}
