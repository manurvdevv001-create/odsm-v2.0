"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

/**
 * Standardized DatePicker for ODSM-v2.
 * 
 * - Displays and accepts dates in dd/mm/yyyy format.
 * - Auto-inserts slashes as the user types.
 * - Includes a calendar icon that triggers the native date picker.
 * - Value is stored/emitted as an ISO string (YYYY-MM-DD).
 */

interface DatePickerProps {
    value?: string; // ISO format: YYYY-MM-DD
    onChange: (value: string) => void;
    className?: string;
    disabled?: boolean;
    placeholder?: string;
    id?: string;
}

function isoToDisplay(iso: string): string {
    if (!iso) return "";
    const parts = iso.split("-");
    if (parts.length !== 3) return iso;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function displayToIso(display: string): string {
    const parts = display.split("/");
    if (parts.length !== 3) return display;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

const DatePicker = React.forwardRef<HTMLDivElement, DatePickerProps>(
    ({ value = "", onChange, className, disabled, placeholder = "jj/mm/aaaa", id }, ref) => {
        const [textValue, setTextValue] = React.useState(isoToDisplay(value));
        const hiddenDateRef = React.useRef<HTMLInputElement>(null);

        // Sync when external value changes
        React.useEffect(() => {
            setTextValue(isoToDisplay(value));
        }, [value]);

        const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const raw = e.target.value;
            // Auto-insert slashes as user types
            let cleaned = raw.replace(/[^\d/]/g, "");

            // Limit to 10 chars: dd/mm/yyyy
            if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);

            // Format logic (auto-slash)
            if (cleaned.length > 2 && cleaned[2] !== '/') {
                cleaned = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
            }
            if (cleaned.length > 5 && cleaned[5] !== '/') {
                cleaned = cleaned.slice(0, 5) + '/' + cleaned.slice(5);
            }

            setTextValue(cleaned);

            // If fully typed with valid format, emit the ISO value
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleaned)) {
                const iso = displayToIso(cleaned);
                const d = new Date(iso);
                if (!isNaN(d.getTime())) {
                    onChange(iso);
                }
            }
        };

        const handleTextBlur = () => {
            // On blur, reformat to match the current value
            setTextValue(isoToDisplay(value));
        };

        const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const iso = e.target.value;
            if (iso) {
                onChange(iso);
                setTextValue(isoToDisplay(iso));
            }
        };

        const openPicker = () => {
            if (disabled) return;
            hiddenDateRef.current?.showPicker?.();
        };

        return (
            <div ref={ref} className={cn("relative", className)}>
                <input
                    id={id}
                    type="text"
                    inputMode="numeric"
                    value={textValue}
                    onChange={handleTextChange}
                    onBlur={handleTextBlur}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                        "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        "pr-9"
                    )}
                />
                <button
                    type="button"
                    onClick={openPicker}
                    disabled={disabled}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:pointer-events-none"
                    tabIndex={-1}
                >
                    <CalendarDays className="h-4 w-4" />
                </button>
                {/* Hidden native date input for the calendar popup */}
                <input
                    ref={hiddenDateRef}
                    type="date"
                    value={value || ""}
                    onChange={handleNativeDateChange}
                    className="absolute inset-0 opacity-0 pointer-events-none"
                    tabIndex={-1}
                    aria-hidden
                />
            </div>
        );
    }
);

DatePicker.displayName = "DatePicker";

export { DatePicker };
