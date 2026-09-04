import React from "react";
import { cn } from "@/lib/utils";

interface OdsmLogoProps {
    variant?: "icon" | "horizontal" | "full";
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
}

export default function OdsmLogo({ variant = "full", size = "md", className }: OdsmLogoProps) {
    const sizeClasses = {
        sm: "h-6",
        md: "h-8",
        lg: "h-12",
        xl: "h-16",
    };

    const iconSizeClasses = {
        sm: "w-6 h-6",
        md: "w-8 h-8",
        lg: "w-12 h-12",
        xl: "w-16 h-16",
    };

    const textSizes = {
        sm: "text-lg",
        md: "text-2xl",
        lg: "text-4xl",
        xl: "text-5xl",
    };

    const subtextSizes = {
        sm: "text-[6px]",
        md: "text-[8px]",
        lg: "text-[10px]",
        xl: "text-[12px]",
    };

    const Star = ({ className }: { className?: string }) => (
        <path
            d="M 0,-1 L 0.224,-0.309 L 0.951,-0.309 L 0.363,0.118 L 0.588,0.809 L 0,0.382 L -0.588,0.809 L -0.363,0.118 L -0.951,-0.309 L -0.224,-0.309 Z"
            fill="currentColor"
            className={className}
        />
    );

    const Icon = () => (
        <svg
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={cn(iconSizeClasses[size], "text-primary shrink-0")}
        >
            {/* Outer Ring */}
            <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="8" />
            
            {/* Center Dot */}
            <circle cx="50" cy="50" r="4" fill="currentColor" />

            {/* Pointer 1 (to Star 1) */}
            <line x1="50" y1="50" x2="25" y2="35" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            
            {/* Pointer 2 (to Star 2) */}
            <line x1="50" y1="50" x2="75" y2="35" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* Pointer 3 (to Star 3) */}
            <line x1="50" y1="50" x2="35" y2="75" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />

            {/* Star 1 (Top Left) */}
            <g transform="translate(25, 35) scale(6)">
                <Star />
            </g>

            {/* Star 2 (Top Right) */}
            <g transform="translate(75, 35) scale(6)">
                <Star />
            </g>

            {/* Star 3 (Bottom Left) */}
            <g transform="translate(35, 75) scale(6)">
                <Star />
            </g>
        </svg>
    );

    return (
        <div className={cn("flex flex-col items-start gap-0.5", className)}>
            <div className="flex items-center gap-2">
                <Icon />
                {variant !== "icon" && (
                    <span className={cn("font-black tracking-tighter text-foreground uppercase italic", textSizes[size])}>
                        DSM
                    </span>
                )}
            </div>
            {variant === "full" && (
                <span className={cn("font-bold tracking-[0.2em] text-muted-foreground uppercase pl-1", subtextSizes[size])}>
                    Orion Digital School Manager
                </span>
            )}
        </div>
    );
}
