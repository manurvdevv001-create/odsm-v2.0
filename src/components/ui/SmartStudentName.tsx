import React, { useState } from 'react';
import { useStudentDisplay, DisplayMode } from '@/components/providers/StudentDisplayProvider';
import { cn } from '@/lib/utils';
import { RefreshCcw } from 'lucide-react';

export interface SmartStudentNameProps {
    student: {
        id?: string;
        matricule?: string;
        studentNumber?: string;
        firstName: string;
        lastName: string;
        postName?: string;
        middleName?: string;
    };
    className?: string;
}

export function SmartStudentName({ student, className }: SmartStudentNameProps) {
    const { globalDisplayMode } = useStudentDisplay();
    const [localMode, setLocalMode] = useState<DisplayMode | null>(null);

    const activeMode = localMode || globalDisplayMode;
    const postName = student.middleName || student.postName;
    const matricule = student.matricule || student.studentNumber;

    const cycleMode = (e: React.MouseEvent) => {
        // Empêche de déclencher d'éventuels clics sur la ligne du tableau
        e.preventDefault();
        e.stopPropagation();

        const modes: DisplayMode[] = ['compact', 'full', 'id'];
        let currentIndex = modes.indexOf(activeMode);
        let nextIndex = (currentIndex + 1) % modes.length;
        
        if (modes[nextIndex] === 'full' && !postName) {
            nextIndex = (nextIndex + 1) % modes.length;
        }

        setLocalMode(modes[nextIndex]);
    };

    let displayText = '';

    switch (activeMode) {
        case 'compact':
            displayText = `${student.lastName} ${student.firstName}`;
            break;
        case 'full':
            displayText = `${student.lastName} ${postName ? postName + ' ' : ''}${student.firstName}`;
            break;
        case 'id':
            displayText = matricule ? `${matricule} - ${student.lastName}` : `${student.lastName} ${student.firstName}`;
            break;
    }

    return (
        <span 
            className={cn(
                "group relative inline-flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 px-1 -ml-1 rounded transition-colors", 
                className
            )}
            onClick={cycleMode}
            title="Toucher pour changer l'affichage"
        >
            <span className="whitespace-nowrap truncate">{displayText}</span>
            <RefreshCcw className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
    );
}
