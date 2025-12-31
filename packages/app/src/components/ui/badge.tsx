import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-2 py-1 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white",
        secondary: "bg-gray-700 text-gray-300",
        outline: "border border-gray-600 text-gray-400 hover:bg-gray-800",
        success: "bg-green-900 text-green-300",
        warning: "bg-yellow-900 text-yellow-300",
        danger: "bg-red-900 text-red-300",
        info: "bg-blue-900 text-blue-300",
        purple: "bg-purple-900 text-purple-300",
      },
    },
    defaultVariants: {
      variant: "secondary",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <span
        className={cn(badgeVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";

export { Badge, badgeVariants };
