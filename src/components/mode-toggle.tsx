"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

const emptySubscribe = () => () => {};

export function ModeToggle({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!mounted) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("text-muted-foreground", className)}
        disabled
        aria-label="Toggle theme"
      >
        <span className="size-4" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "cursor-pointer text-muted-foreground hover:text-foreground transition-colors",
        className,
      )}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="size-4 transition-transform duration-200" />
      ) : (
        <Moon className="size-4 transition-transform duration-200" />
      )}
    </Button>
  );
}
