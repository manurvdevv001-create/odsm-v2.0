"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

// Context to optionally pass shape override locally
const AvatarShapeContext = React.createContext<'round' | 'square' | null>(null);

// Hook to read shape from school context if available
function usePhotoFrame(): 'round' | 'square' {
    // Try to get from school context — lazy import to avoid circular deps
    const [shape, setShape] = React.useState<'round' | 'square'>('round');

    React.useEffect(() => {
        // Read from data attribute on document root (set by SchoolDataProvider)
        const frame = document.documentElement.getAttribute('data-photo-frame');
        if (frame === 'square' || frame === 'round') {
            setShape(frame);
        }

        // Observe for changes
        const observer = new MutationObserver(() => {
            const f = document.documentElement.getAttribute('data-photo-frame');
            if (f === 'square' || f === 'round') setShape(f);
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-photo-frame'] });
        return () => observer.disconnect();
    }, []);

    return shape;
}

const Avatar = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & { shape?: 'round' | 'square' }
>(({ className, shape, ...props }, ref) => {
    const globalShape = usePhotoFrame();
    const localShape = React.useContext(AvatarShapeContext);
    const effectiveShape = shape || localShape || globalShape;
    const radiusClass = effectiveShape === 'square' ? 'rounded-xl' : 'rounded-full';
    const fallbackRadiusClass = effectiveShape === 'square' ? 'rounded-xl' : 'rounded-full';

    return (
        <AvatarShapeContext.Provider value={effectiveShape}>
            <AvatarPrimitive.Root
                ref={ref}
                className={cn(
                    `relative flex h-10 w-10 shrink-0 overflow-hidden ${radiusClass}`,
                    className
                )}
                {...props}
            />
        </AvatarShapeContext.Provider>
    );
})
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Image>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
    <AvatarPrimitive.Image
        ref={ref}
        className={cn("aspect-square h-full w-full", className)}
        {...props}
    />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
    React.ElementRef<typeof AvatarPrimitive.Fallback>,
    React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => {
    const shape = React.useContext(AvatarShapeContext);
    const radiusClass = shape === 'square' ? 'rounded-xl' : 'rounded-full';
    return (
        <AvatarPrimitive.Fallback
            ref={ref}
            className={cn(
                `flex h-full w-full items-center justify-center ${radiusClass} bg-muted`,
                className
            )}
            {...props}
        />
    );
})
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
