import React, { useState } from "react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { LogoutButton } from "../auth/LogoutButton";

export interface TopNavBarProps {
  currentPath: string;
}

const navItems: { label: string; href: string }[] = [
  { label: "Generate", href: "/generate" },
  { label: "Flashcards", href: "/flashcards" },
  { label: "Learn", href: "/learn" },
  { label: "User Panel", href: "/user" },
];

export const TopNavBar: React.FC<TopNavBarProps> = ({ currentPath }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((open) => !open);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const isActive = (href: string) => {
    if (href === "/") return currentPath === "/";
    return currentPath.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <a href="/generate" className="flex items-center gap-2" aria-label="AI Flashcards home">
            <span className="text-base font-semibold tracking-tight">AI Flashcards</span>
          </a>

          <nav className="hidden md:flex items-center gap-4" aria-label="Main">
            {navItems.map((item) => {
              const active = isActive(item.href);

              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "text-sm font-medium transition-colors border-b-2 border-transparent px-1.5 py-0.5",
                    active
                      ? "text-primary border-primary"
                      : "text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {!isMobileMenuOpen && (
            <div className="hidden md:block">
              <LogoutButton />
            </div>
          )}

          <div className="md:hidden flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="top-nav-mobile-menu"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      <div
        id="top-nav-mobile-menu"
        className={cn("md:hidden border-t bg-background/95 backdrop-blur-sm", isMobileMenuOpen ? "block" : "hidden")}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="container mx-auto max-w-7xl px-4 py-3 space-y-3">
          <nav className="flex flex-col gap-1" aria-label="Main mobile">
            {navItems.map((item) => {
              const active = isActive(item.href);

              return (
                <a
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-2 py-1.5 text-sm font-medium",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {isMobileMenuOpen && (
            <div className="pt-2">
              <LogoutButton />
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
