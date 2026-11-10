"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(
      "relative flex w-full touch-none select-none items-center",
      className
    )}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-none bg-chrome-well border border-chrome-border">
      <SliderPrimitive.Range className="absolute h-full bg-chrome-text" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="flex h-10 w-10 items-center justify-center rounded-none before:block before:h-5 before:w-3 before:rounded-none before:border-2 before:border-chrome-text before:bg-chrome-panel before:content-[''] ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }


















