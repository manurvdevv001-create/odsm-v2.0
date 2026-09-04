import * as React from "react"
import { cn, formatToUppercase, formatToTitleCase } from "@/lib/utils"

export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, name, onChange, ...props }, ref) => {
        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            if (type === "file") {
                onChange?.(e);
                return;
            }

            const lowName = name?.toLowerCase() || "";
            let value = e.target.value;

            // Apply masks based on field name
            if (
                lowName.includes("lastname") ||
                lowName === "nom" ||
                lowName.includes("middlename") ||
                lowName === "postnom"
            ) {
                value = formatToUppercase(value);
            } else if (
                lowName.includes("firstname") ||
                lowName === "prenom" ||
                lowName === "prénom"
            ) {
                value = formatToTitleCase(value);
            }

            e.target.value = value;
            onChange?.(e);
        };

        return (
            <input
                type={type}
                name={name}
                className={cn(
                    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                onChange={handleChange}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

export { Input }
