"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue>({
  open: false,
  onOpenChange: () => {},
});

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
}

const Collapsible = React.forwardRef<HTMLDivElement, CollapsibleProps>(
  (
    {
      open: controlledOpen,
      onOpenChange: controlledOnOpenChange,
      defaultOpen = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [uncontrolledOpen, setUncontrolledOpen] =
      React.useState(defaultOpen);
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : uncontrolledOpen;

    const onOpenChange = React.useCallback(
      (value: boolean) => {
        if (!isControlled) {
          setUncontrolledOpen(value);
        }
        controlledOnOpenChange?.(value);
      },
      [isControlled, controlledOnOpenChange]
    );

    return (
      <CollapsibleContext.Provider value={{ open, onOpenChange }}>
        <div
          ref={ref}
          data-state={open ? "open" : "closed"}
          className={className}
          {...props}
        >
          {children}
        </div>
      </CollapsibleContext.Provider>
    );
  }
);
Collapsible.displayName = "Collapsible";

const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { open, onOpenChange } = React.useContext(CollapsibleContext);

  return (
    <button
      ref={ref}
      type="button"
      aria-expanded={open}
      data-state={open ? "open" : "closed"}
      className={cn(className)}
      onClick={(e) => {
        onClick?.(e);
        onOpenChange(!open);
      }}
      {...props}
    />
  );
});
CollapsibleTrigger.displayName = "CollapsibleTrigger";

const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const { open } = React.useContext(CollapsibleContext);

  if (!open) return null;

  return (
    <div
      ref={ref}
      data-state={open ? "open" : "closed"}
      className={cn("overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  );
});
CollapsibleContent.displayName = "CollapsibleContent";

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
