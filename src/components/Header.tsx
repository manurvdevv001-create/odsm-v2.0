"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
    LogOut,
    Menu,
    Expand,
    Shrink,
    Bell,
    User,
    Calendar,
    KeyRound,
} from "lucide-react";

import { getNavItems, getRoleDisplayLabel, getRoleAvatarLetter, isAdminRole, getHomeHref } from "@/lib/role-permissions";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { ChangePasswordDialog } from "./change-password-dialog";
import OdsmLogo from "./odsm-logo";

import { Badge } from "@/components/ui/badge";
import ThemeToggle from "./ThemeToggle";
import DatabaseHealthIndicator from "./DatabaseHealthIndicator";

export default function Header() {
    const pathname = usePathname();
    const router = useRouter();
    const { schoolData, isLoading, selectedYear, setSelectedYear, user: contextUser } = useSchoolData();
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);

    const [userRole, setUserRole] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        const storedUser = localStorage.getItem("odsm-user");
        if (storedUser) {
            try {
                const user = JSON.parse(storedUser);
                setUserRole(user.role || "");
            } catch (e) {
                console.error("Failed to parse user", e);
            }
        } else {
            setUserRole("");
        }
    }, []);

    const effectiveRole = (contextUser?.role || userRole || "").toUpperCase();
    const isAdmin = isAdminRole(effectiveRole);
    const homeHref = getHomeHref(effectiveRole);
    const roleNavItems = getNavItems(effectiveRole);

    const handleLogout = async () => {
        try {
            const matricule = localStorage.getItem("odsm-matricule");
            const storedUser = localStorage.getItem("odsm-user");
            if (matricule && storedUser) {
                const user = JSON.parse(storedUser);
                if (user.id) {
                    const { recordLogout } = await import("@/app/(main)/settings/users/session-actions");
                    await recordLogout(matricule, user.id);
                }
            }
        } catch (e) {
            console.error("Error recording logout:", e);
        }
        localStorage.removeItem("odsm-matricule");
        localStorage.removeItem("odsm-user");
        router.push("/login");
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Create a typed version of schoolData to avoid generic Record access issues
    const typedSchoolData = schoolData as any;

    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/80 backdrop-blur-md">
                <div className="container mx-auto flex h-20 items-center justify-between px-4 lg:px-8">
                <div className="flex items-center gap-2 shrink-0">
                    <Link href={homeHref} className="flex items-center gap-2.5">
                        <div className="sm:hidden">
                            <OdsmLogo variant="icon" size="sm" />
                        </div>
                        <div className="hidden sm:block">
                            <OdsmLogo variant="horizontal" size="sm" />
                        </div>
                    </Link>
                </div>

                {/* Teacher/User Branding (Centered after ODSM) */}
                <div className="hidden md:flex items-center ml-4 lg:ml-6 border-l-2 border-primary/10 pl-4 lg:pl-6 h-10 w-auto min-w-[120px] max-w-[320px]">
                    {mounted && (() => {
                        try {
                            const u = JSON.parse(localStorage.getItem("odsm-user") || "{}");
                            const name = u.name || "Administrateur";
                            const username = u.login || "";
                            const displayName = username ? `${name}, ${username}` : name;
                            return (
                                <div className="flex flex-col justify-center max-w-[300px]">
                                    <span className="text-sm font-bold text-foreground leading-tight uppercase tracking-tight truncate w-full" title={displayName}>
                                        {displayName}
                                    </span>
                                    {!u.staffNumber && (
                                        <span className="text-[10px] font-mono text-muted-foreground font-semibold bg-primary/5 px-1.5 rounded-md self-start mt-0.5">
                                            {getRoleDisplayLabel(u.role || effectiveRole)}
                                        </span>
                                    )}
                                    {u.staffNumber && (
                                        <span className="text-[10px] font-mono text-muted-foreground font-semibold bg-muted px-1.5 rounded-md self-start mt-0.5">
                                            {u.staffNumber}
                                        </span>
                                    )}
                                </div>
                            );
                        } catch { }
                        return null;
                    })()}
                </div>

                {/* Center: School Branding */}
                <div className="flex justify-center flex-1 min-w-0 px-1 sm:px-2">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Link href={homeHref} className="flex items-center gap-2 sm:gap-3 transition-transform hover:scale-[1.02] min-w-0">
                            <div className="relative flex-shrink-0 flex h-8 w-8 sm:h-10 sm:w-10 lg:h-11 lg:w-11 items-center justify-center rounded-lg sm:rounded-xl bg-primary/5 p-1 text-primary shadow-inner">
                                {isLoading ? (
                                    <div className="h-full w-full rounded-lg bg-primary/10 animate-pulse" />
                                ) : typedSchoolData?.logo ? (
                                    <Image
                                        src={typedSchoolData.logo}
                                        alt="Logo"
                                        fill
                                        className="object-contain p-1"
                                    />
                                ) : (
                                    <div className="h-2 w-2 rounded-full bg-primary/40 animate-pulse" />
                                )}
                            </div>
                        </Link>

                        <div className="flex flex-col min-w-0 overflow-hidden">
                            {isLoading ? (
                                <div className="h-4 w-16 sm:w-32 bg-primary/10 animate-pulse rounded" />
                            ) : (
                                <div className="flex flex-col items-start min-w-0">
                                    <Link href={homeHref} className="hover:text-primary transition-colors min-w-0 truncate w-full">
                                        <span className="text-[12px] sm:text-lg font-extrabold tracking-tight text-foreground sm:text-xl uppercase truncate block">
                                            {typedSchoolData?.name || "..."}
                                        </span>
                                    </Link>
                                    
                                    {typedSchoolData?.configuration?.knownYears && typedSchoolData.configuration.knownYears.length > 0 ? (
                                        <div className="mt-0.5 relative z-30">
                                            <Select
                                                value={selectedYear || typedSchoolData.calendar?.schoolYear || typedSchoolData.activeYear || ""}
                                                onValueChange={(val) => setSelectedYear(val)}
                                            >
                                                <SelectTrigger
                                                    disabled={!isAdmin}
                                                    className={`h-7 w-auto border border-primary/20 bg-primary/5 px-2 text-[10px] sm:text-[11px] font-bold tracking-wider focus:ring-1 focus:ring-primary/20 shadow-sm gap-1.5 min-w-0 transition-all hover:bg-primary/10 rounded-md ${!isAdmin ? "opacity-50 cursor-not-allowed" : "text-primary hover:border-primary/40"}`}
                                                >
                                                    <Calendar className="h-3 w-3 text-primary flex-shrink-0" />
                                                    <SelectValue placeholder="Année" />
                                                    
                                                    {(typedSchoolData.calendar?.schoolYear || typedSchoolData.activeYear) && (
                                                        (typedSchoolData.calendar?.schoolYear || typedSchoolData.activeYear) === typedSchoolData.activeYear ? (
                                                            <Badge variant="outline" className="hidden xs:flex text-[8px] h-3.5 px-1 border-green-500 text-green-600 bg-green-50 uppercase font-black pointer-events-none">Actif</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="hidden xs:flex text-[8px] h-3.5 px-1 bg-amber-100 text-amber-700 hover:bg-amber-100 uppercase font-black pointer-events-none">
                                                                Arch
                                                            </Badge>
                                                        )
                                                    )}
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {typedSchoolData.configuration.knownYears.map((year: string) => (
                                                        <SelectItem key={year} value={year} className="text-xs">
                                                            {year}
                                                            {year === typedSchoolData.activeYear && (
                                                                <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1 border-green-500 text-green-600 bg-green-50">Actif</Badge>
                                                            )}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : (
                                        (typedSchoolData?.calendar?.schoolYear || typedSchoolData?.activeYear) && (
                                            <div className="flex items-center gap-1 mt-0.5 px-2 py-0.5 bg-primary/5 rounded-md border border-primary/10">
                                                <Calendar className="h-3 w-3 text-primary" />
                                                <span className="text-[10px] font-bold text-primary tracking-wider">
                                                    {typedSchoolData.calendar?.schoolYear || typedSchoolData.activeYear}
                                                </span>
                                            </div>
                                        )
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Side: Actions & Menu */}
                <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="hidden sm:flex text-muted-foreground hover:text-primary transition-colors" onClick={toggleFullscreen}>
                        {isFullscreen ? <Shrink className="h-5 w-5" /> : <Expand className="h-5 w-5" />}
                    </Button>

                    <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-primary transition-colors">
                        <Bell className="h-5 w-5" />
                        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                    </Button>

                    <div className="hidden sm:flex items-center gap-2">
                        <DatabaseHealthIndicator />
                    </div>

                    <ThemeToggle className="ml-1" />

                    {mounted ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="lg" className="ml-2 gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10 hover:text-primary transition-all rounded-xl shadow-sm pl-2 pr-4 relative overflow-hidden group">
                                    <span className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary flex shadow-sm ring-2 ring-background">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <Menu className="h-4 w-4 opacity-50 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-64 p-2 rounded-2xl shadow-xl border-primary/10">
                                {/* User Info Section inside Menu */}
                                <div className="px-3 py-2 bg-muted/50 rounded-xl mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                            {getRoleAvatarLetter(effectiveRole)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold truncate max-w-[160px]">
                                                {(() => {
                                                    try {
                                                        const u = JSON.parse(localStorage.getItem("odsm-user") || "{}");
                                                        return u.name || "Administrateur";
                                                    } catch { return "Administrateur"; }
                                                })()}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {getRoleDisplayLabel(effectiveRole)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <DropdownMenuLabel className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Navigation
                                </DropdownMenuLabel>
                                {roleNavItems.map((item) => (
                                    <DropdownMenuItem key={item.href} asChild className="rounded-xl cursor-pointer">
                                        <Link href={item.href} className={`flex items-center gap-3 px-3 py-2.5 ${pathname.startsWith(item.href) ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"}`}>
                                            <item.icon className={`h-4 w-4 ${pathname.startsWith(item.href) ? "text-primary" : "text-muted-foreground"}`} />
                                            <span>{item.label}</span>
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator className="my-2 bg-primary/5" />
                                <DropdownMenuItem onClick={() => setIsPasswordDialogOpen(true)} className="rounded-xl cursor-pointer px-3 py-2.5">
                                    <KeyRound className="mr-3 h-4 w-4 text-muted-foreground" />
                                    <span>Changer le mot de passe</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleLogout} className="rounded-xl text-red-500 focus:text-red-500 focus:bg-red-500/10 cursor-pointer px-3 py-2.5">
                                    <LogOut className="mr-3 h-4 w-4" />
                                    <span>Déconnexion</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button variant="outline" size="lg" className="ml-2 gap-2 border-primary/20 bg-primary/5 rounded-xl shadow-sm pl-2 pr-4 opacity-50">
                            <div className="h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary flex">
                                <User className="h-4 w-4" />
                            </div>
                            <Menu className="h-4 w-4 opacity-50 ml-1" />
                        </Button>
                    )}
                </div>
            </div>
        </header>
        <ChangePasswordDialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen} />
        </>
    );
}
