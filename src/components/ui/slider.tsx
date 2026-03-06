"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value" | "defaultValue"
  > {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      className,
      value: controlledValue,
      defaultValue = [0],
      min = 0,
      max = 100,
      step = 1,
      onValueChange,
      ...props
    },
    ref
  ) => {
    const [uncontrolledValue, setUncontrolledValue] =
      React.useState(defaultValue);
    const isControlled = controlledValue !== undefined;
    const currentValue = isControlled ? controlledValue : uncontrolledValue;
    const percentage = ((currentValue[0] - min) / (max - min)) * 100;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = [Number(e.target.value)];
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <div className={cn("relative flex w-full touch-none select-none items-center", className)}>
        <div className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-100">
          <div
            className="absolute h-full bg-zinc-900"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue[0]}
          onChange={handleChange}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue[0]}
          {...props}
        />
        <div
          className="absolute h-5 w-5 rounded-full border-2 border-zinc-900 bg-white ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 pointer-events-none"
          style={{ left: `calc(${percentage}% - 10px)` }}
        />
      </div>
    );
  }
);
Slider.displayName = "Slider";

export { Slider };
