'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { recordLogout, clearForcedLogout } from '@/app/(main)/settings/users/session-actions';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Clock, LogOut } from 'lucide-react';

/**
 * SessionGuard monitors user activity and forces logout after the configured
 * inactivity timeout. Also checks for forced logout flags from admin.
 */
export function SessionGuard() {
    const router = useRouter();
    const lastActivityRef = useRef<number>(Date.now());
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [showWarning, setShowWarning] = useState(false);
    const [secondsLeft, setSecondsLeft] = useState(0);
    const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

    const getTimeoutMs = useCallback((): number => {
        try {
            const user = JSON.parse(localStorage.getItem('odsm-user') || '{}');
            const minutes = user.sessionTimeoutMinutes ?? 30;
            if (minutes === 0) return 0; // Never
            return minutes * 60 * 1000;
        } catch {
            return 30 * 60 * 1000; // Default 30 min
        }
    }, []);

    const handleForceLogout = useCallback(async (reason: string) => {
        try {
            const matricule = localStorage.getItem('odsm-matricule');
            const storedUser = localStorage.getItem('odsm-user');
            if (matricule && storedUser) {
                const user = JSON.parse(storedUser);
                if (user.id) {
                    await recordLogout(matricule, user.id);
                }
            }
        } catch (e) {
            console.error('SessionGuard: Error recording logout', e);
        }
        localStorage.removeItem('odsm-matricule');
        localStorage.removeItem('odsm-user');
        router.push('/login');
    }, [router]);

    const resetTimer = useCallback(() => {
        lastActivityRef.current = Date.now();
        setShowWarning(false);
        if (warningTimerRef.current) {
            clearInterval(warningTimerRef.current);
            warningTimerRef.current = null;
        }
    }, []);

    // Track user activity
    useEffect(() => {
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
        const handler = () => {
            lastActivityRef.current = Date.now();
            if (showWarning) {
                setShowWarning(false);
                if (warningTimerRef.current) {
                    clearInterval(warningTimerRef.current);
                    warningTimerRef.current = null;
                }
            }
        };

        events.forEach(evt => window.addEventListener(evt, handler, { passive: true }));
        return () => {
            events.forEach(evt => window.removeEventListener(evt, handler));
        };
    }, [showWarning]);

    // Check inactivity periodically
    useEffect(() => {
        const WARNING_BEFORE_MS = 2 * 60 * 1000; // 2 min warning

        checkIntervalRef.current = setInterval(() => {
            const timeoutMs = getTimeoutMs();
            if (timeoutMs === 0) return; // Never timeout

            const elapsed = Date.now() - lastActivityRef.current;

            // Show warning 2 minutes before
            if (elapsed >= (timeoutMs - WARNING_BEFORE_MS) && elapsed < timeoutMs) {
                if (!showWarning) {
                    setShowWarning(true);
                    const remaining = Math.ceil((timeoutMs - elapsed) / 1000);
                    setSecondsLeft(remaining);

                    // Countdown
                    warningTimerRef.current = setInterval(() => {
                        setSecondsLeft(prev => {
                            if (prev <= 1) {
                                handleForceLogout('inactivity');
                                return 0;
                            }
                            return prev - 1;
                        });
                    }, 1000);
                }
            }

            // Force logout
            if (elapsed >= timeoutMs) {
                handleForceLogout('inactivity');
            }
        }, 15000); // Check every 15 seconds

        return () => {
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
            if (warningTimerRef.current) clearInterval(warningTimerRef.current);
        };
    }, [getTimeoutMs, handleForceLogout, showWarning]);

    // Check for forced logout from admin
    useEffect(() => {
        const checkForcedLogout = async () => {
            try {
                const matricule = localStorage.getItem('odsm-matricule');
                const storedUser = localStorage.getItem('odsm-user');
                if (!matricule || !storedUser) return;

                const user = JSON.parse(storedUser);
                if (!user.id) return;

                // Fetch config to check forcedLogoutUserIds
                const res = await fetch(`/api/school?matricule=${matricule}&fields=configuration`);
                if (!res.ok) return;

                const data = await res.json();
                const forcedIds: string[] = data?.configuration?.forcedLogoutUserIds || [];

                if (forcedIds.includes(user.id)) {
                    // Clear the flag first
                    await clearForcedLogout(matricule, user.id);
                    // Then force logout
                    handleForceLogout('admin_forced');
                }
            } catch (e) {
                // Silently fail — don't break the app
            }
        };

        // Check on mount and every 30 seconds
        checkForcedLogout();
        const interval = setInterval(checkForcedLogout, 30000);
        return () => clearInterval(interval);
    }, [handleForceLogout]);

    return (
        <AlertDialog open={showWarning}>
            <AlertDialogContent className="border-none shadow-2xl sm:max-w-[420px]">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                        <Clock className="h-5 w-5" />
                        Session sur le point d'expirer
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        Votre session sera automatiquement fermée dans{' '}
                        <strong className="text-amber-600 text-lg">{secondsLeft}s</strong>{' '}
                        en raison d'inactivité. Interagissez avec l'application pour rester connecté.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogAction
                        onClick={resetTimer}
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                        Rester connecté
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
