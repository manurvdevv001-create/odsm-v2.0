// src/app/(main)/staff/stats/page.tsx
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Users, GraduationCap, Building2, UserCircle, PieChart, Info } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function StaffStatsPage() {
    const { schoolData } = useSchoolData();
    const typedSchoolData = schoolData as any;

    const stats = useMemo(() => {
        const staff = typedSchoolData?.teachers || [];
        const total = staff.length;
        const teachers = staff.filter((s: any) => s.category === 'Personnel enseignant').length;
        const admin = staff.filter((s: any) => s.category === 'Administratif/Technique' || s.category === 'Direction').length;
        const support = staff.filter((s: any) => s.category === 'Soutien').length;

        const women = staff.filter((s: any) => s.gender === 'F').length;
        const men = total - women;
        const parity = total > 0 ? Math.round((women / total) * 100) : 0;

        return { total, teachers, admin, support, women, men, parity };
    }, [typedSchoolData]);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-headline font-bold">Statistiques du Personnel</h1>
                <p className="text-muted-foreground">Analyse globale de la répartition des ressources humaines.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Personnel</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <p className="text-xs text-muted-foreground">Employés actifs</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Enseignants</CardTitle>
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.teachers}</div>
                        <p className="text-xs text-muted-foreground">Corps professoral</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Administratifs</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.admin}</div>
                        <p className="text-xs text-muted-foreground">Cadres et gestion</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Parité F/H</CardTitle>
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.parity}%</div>
                        <p className="text-xs text-muted-foreground">De personnel féminin</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card className="col-span-1">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <PieChart className="w-5 h-5 text-primary" />
                            <CardTitle>Répartition par Genre</CardTitle>
                        </div>
                        <CardDescription>Composition hommes / femmes du personnel.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Femmes ({stats.women})</span>
                                <span className="font-semibold text-primary">{stats.parity}%</span>
                            </div>
                            <Progress value={stats.parity} className="h-2" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Hommes ({stats.men})</span>
                                <span className="font-semibold">{100 - stats.parity}%</span>
                            </div>
                            <Progress value={100 - stats.parity} className="h-2 bg-muted/50" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Info className="w-5 h-5 text-primary" />
                            <CardTitle>Aperçu des fonctions</CardTitle>
                        </div>
                        <CardDescription>Top des fonctions représentées dans l'école.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground italic text-center py-12">
                            Les graphiques détaillés par fonction seront disponibles dès que davantage de profils seront enregistrés.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
