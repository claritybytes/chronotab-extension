import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

/**
 * TooltipProvider component from Radix UI, customized with a default delayDuration.
 * This component provides context for all tooltips within its scope.
 *
 * @param {object} props - Props for TooltipPrimitive.Provider.
 * @param {number} [props.delayDuration=0] - The duration from when the mouse enters the trigger until the tooltip opens.
 * @returns {JSX.Element} The TooltipProvider component.
 */
function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

/**
 * Root Tooltip component from Radix UI.
 * It wraps a TooltipTrigger and TooltipContent, and is itself wrapped by a TooltipProvider.
 *
 * @param {React.ComponentProps<typeof TooltipPrimitive.Root>} props - Props for TooltipPrimitive.Root.
 * @returns {JSX.Element} The Tooltip component.
 */
function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

/**
 * TooltipTrigger component from Radix UI.
 * This is the element that, when hovered or focused, triggers the display of the TooltipContent.
 *
 * @param {React.ComponentProps<typeof TooltipPrimitive.Trigger>} props - Props for TooltipPrimitive.Trigger.
 * @returns {JSX.Element} The TooltipTrigger component.
 */
function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/**
 * TooltipContent component from Radix UI, styled with Tailwind CSS.
 * This is the content that appears when the TooltipTrigger is activated.
 * It includes styling for animations and positioning.
 *
 * @param {object} props - Props for TooltipPrimitive.Content.
 * @param {string} [props.className] - Additional CSS classes for styling.
 * @param {number} [props.sideOffset=0] - The distance in pixels from the trigger to the content.
 * @param {React.ReactNode} props.children - The content to display within the tooltip.
 * @returns {JSX.Element} The TooltipContent component.
 */
function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
