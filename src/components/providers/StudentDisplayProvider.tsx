'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export type DisplayMode = 'compact' | 'full' | 'id';

interface StudentDisplayContextType {
    globalDisplayMode: DisplayMode;
    setGlobalDisplayMode: (mode: DisplayMode) => void;
}

const StudentDisplayContext = createContext<StudentDisplayContextType | undefined>(undefined);

export function StudentDisplayProvider({ children }: { children: ReactNode }) {
    // Par défaut, pas de mémorisation comme demandé
    const [globalDisplayMode, setGlobalDisplayMode] = useState<DisplayMode>('compact');

    return (
        <StudentDisplayContext.Provider value={{ globalDisplayMode, setGlobalDisplayMode }}>
            {children}
        </StudentDisplayContext.Provider>
    );
}

export function useStudentDisplay() {
    const context = useContext(StudentDisplayContext);
    if (context === undefined) {
        throw new Error('useStudentDisplay must be used within a StudentDisplayProvider');
    }
    return context;
}
