import * as React from "react";

import { cn } from "@/lib/utils";

// Extract grid/layout classes for the outer glass wrapper so they aren't trapped inside
const LAYOUT_RE = /(?:^|\s)((?:lg:|md:|sm:|xl:|2xl:)?(?:col-span-\S+|row-span-\S+|order-\S+|self-\S+))(?=\s|$)/g;

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => {
  const cls = className ?? "";
  const layoutClasses: string[] = [];
  const innerClasses = cls.replace(LAYOUT_RE, (_, m) => { layoutClasses.push(m); return ""; }).trim();
  const glassPadding = (props as any)["data-glass-padding"] as string | undefined;

  return (
    <div
      className={cn(
        "rounded-[21px] shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5),0_2px_8px_-2px_rgba(0,0,0,0.3)]",
        // Outer frame: subtle highlight at top, fades to nothing — gives the bevel/glass-edge feel
        "bg-gradient-to-b from-white/[0.12] via-white/[0.05] via-50% to-white/[0.02]",
        layoutClasses.join(" "),
      )}
      style={{ padding: glassPadding ?? "1px" }}
    >
      <div
        ref={ref}
        className={cn(
          "rounded-[20px] h-full text-card-foreground",
          // Translucent fill + backdrop blur = glass. Subtle inner highlight via gradient.
          "bg-gradient-to-b from-card/80 to-card/65 backdrop-blur-2xl",
          innerClasses,
        )}
        {...props}
        style={{ border: "none", ...props.style }}
      />
    </div>
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
