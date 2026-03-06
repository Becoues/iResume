"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  value: "",
  onValueChange: () => {},
});

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: controlledValue,
      onValueChange: controlledOnValueChange,
      defaultValue = "",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] =
      React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    const onValueChange = React.useCallback(
      (newValue: string) => {
        if (!isControlled) {
          setUncontrolledValue(newValue);
        }
        controlledOnValueChange?.(newValue);
      },
      [isControlled, controlledOnValueChange]
    );

    return (
      <TabsContext.Provider value={{ value, onValueChange }}>
        <div ref={ref} className={className} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="tablist"
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-zinc-100 p-1 text-zinc-500",
      className
    )}
    {...props}
  />
));
TabsList.displayName = "TabsList";

interface TabsTriggerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);
    const isActive = context.value === value;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        aria-selected={isActive}
        data-state={isActive ? "active" : "inactive"}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          isActive
            ? "bg-white text-zinc-950 shadow-sm"
            : "text-zinc-500 hover:text-zinc-900",
          className
        )}
        onClick={() => context.onValueChange(value)}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => {
    const context = React.useContext(TabsContext);

    if (context.value !== value) return null;

    return (
      <div
        ref={ref}
        role="tabpanel"
        data-state={context.value === value ? "active" : "inactive"}
        className={cn(
          "mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2",
          className
        )}
        tabIndex={0}
        {...props}
      />
    );
  }
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
