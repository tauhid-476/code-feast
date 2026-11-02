import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider, ThemeScript } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/legacy-ui/tooltip";

export const metadata: Metadata = {
  title: "Code Feast",
  description: "One live contest, one shared clock.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <ThemeScript defaultTheme="dark" />
      </head>
      <body className="flex min-h-full flex-col">
        <ThemeProvider defaultTheme="dark">
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
