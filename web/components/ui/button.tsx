import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-semibold transition disabled:opacity-50",
        variant === "primary" && "bg-teal text-white hover:bg-teal-dark",
        variant === "secondary" && "bg-ink text-white hover:opacity-90",
        variant === "ghost" && "text-ink hover:bg-black/5",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "outline" && "border border-border bg-white text-ink hover:bg-black/5",
        className,
      )}
      {...props}
    />
  );
}
