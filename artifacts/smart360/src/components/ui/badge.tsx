import * as React from "react"
import { cn } from "@/lib/utils"

const Badge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "outline" | "destructive" }>(
  ({ className, variant = "default", ...props }, ref) => {
    const variants = {
      default: "bg-[#E4F2EA] text-[#116B41]",
      secondary: "bg-[#ECF0EA] text-[#66716A]",
      outline: "border-[1px] border-border text-foreground",
      destructive: "bg-[#F2D6D2] text-[#D93A2B]",
    }
    return (
      <div ref={ref} className={cn("inline-flex items-center rounded-[9px] px-[11px] py-[5px] text-[11.5px] font-[800] tracking-[0.04em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)} {...props} />
    )
  }
)
Badge.displayName = "Badge"

const AdminBadge = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "secondary" | "outline" | "destructive" }>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("admin-ui-badge", `admin-ui-badge--${variant}`, className)}
      {...props}
    />
  ),
)
AdminBadge.displayName = "AdminBadge"

export { Badge, AdminBadge }
