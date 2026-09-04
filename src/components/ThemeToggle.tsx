"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ThemeToggle({ className }: { className?: string }) {
    const { theme, setTheme, resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className={`h-9 w-9 rounded-xl opacity-0 ${className || ""}`}>
                <Sun className="h-4 w-4" />
            </Button>
        );
    }

    const isDark = resolvedTheme === "dark";

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => {
                document.body.classList.add("theme-transition");
                setTheme(isDark ? "light" : "dark");
                setTimeout(() => document.body.classList.remove("theme-transition"), 400);
            }}
            className={`relative h-9 w-9 rounded-xl overflow-hidden group transition-all duration-300 
                ${isDark 
                    ? "bg-primary/10 hover:bg-primary/20 text-primary" 
                    : "bg-amber-50 hover:bg-amber-100 text-amber-600"
                } ${className || ""}`}
            title={isDark ? "Mode clair" : "Mode sombre"}
        >
            <Sun className={`h-4 w-4 absolute transition-all duration-500 ${isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"}`} />
            <Moon className={`h-4 w-4 absolute transition-all duration-500 ${isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"}`} />
        </Button>
    );
}
