import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { vibrate } from "@/lib/haptics"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[13px] text-[14px] font-[800] ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:bg-[#ECF0EA] disabled:text-[#A9B2A8] btn-3d",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[#12643D] border-[1.5px] border-transparent",
        destructive: "bg-background text-destructive border-[1.5px] border-[#F2D6D2] hover:border-[#D3DBD1]",
        outline: "border-[1.5px] border-border bg-background hover:border-[#D3DBD1] text-foreground",
        secondary: "bg-card text-foreground border-[1.5px] border-transparent",
        ghost: "hover:bg-muted hover:text-foreground active:scale-100",
        link: "text-primary underline-offset-4 hover:underline active:scale-100",
      },
      size: {
        default: "px-[17px] py-[11px] h-[40px]",
        sm: "h-[34px] px-[13px] text-[13px] rounded-[11px]",
        lg: "h-14 rounded-xl px-8 text-base",
        icon: "h-10 w-10",
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
