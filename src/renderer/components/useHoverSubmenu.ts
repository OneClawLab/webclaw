import React from 'react';

/**
 * Hook for managing hover-triggered submenu behavior in Radix DropdownMenu.Sub
 * 
 * Usage:
 * ```tsx
 * const submenu = useHoverSubmenu();
 * 
 * <DropdownMenu.Sub {...submenu.subProps}>
 *   <DropdownMenu.SubTrigger {...submenu.triggerProps}>
 *     ...
 *   </DropdownMenu.SubTrigger>
 *   <DropdownMenu.SubContent {...submenu.contentProps}>
 *     ...
 *   </DropdownMenu.SubContent>
 * </DropdownMenu.Sub>
 * ```
 */
export function useHoverSubmenu(closeDelay: number = 150) {
  const [open, setOpen] = React.useState(false);
  const closeTimer = React.useRef<number>(0);

  const triggerProps = {
    onPointerEnter: () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
      setOpen(true);
    },
    onPointerLeave: () => {
      closeTimer.current = window.setTimeout(() => {
        setOpen(false);
      }, closeDelay);
    },
  };

  const contentProps = {
    onPointerEnter: () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
      }
    },
    onPointerLeave: () => {
      setOpen(false);
    },
  };

  const subProps = {
    open,
    onOpenChange: setOpen,
  };

  return {
    subProps,
    triggerProps,
    contentProps,
  };
}
