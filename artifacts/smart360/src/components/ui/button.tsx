import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { playClickSound, vibrate } from "@/lib/audio"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 btn-3d",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground btn-3d-primary hover:brightness-110",
        destructive:
          "bg-destructive text-destructive-foreground btn-3d-destructive hover:brightness-110",
        outline:
          "border-2 border-border bg-background hover:bg-muted btn-3d-secondary text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground btn-3d-secondary hover:brightness-105",
        ghost: "hover:bg-muted hover:text-foreground active:translate-y-0 active:shadow-none !shadow-none",
        link: "text-primary underline-offset-4 hover:underline active:translate-y-0 active:shadow-none !shadow-none",
      },
      size: {
        default: "h-12 px-6 py-2",
        sm: "h-10 rounded-lg px-4 text-xs",
        lg: "h-14 rounded-xl px-8 text-base",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      playClickSound();
      vibrate();
      if (onClick) {
        onClick(e);
      }
    };
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
