// src/app/(main)/staff/workload/page.tsx
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { getTeacherFullName, matchTeacherName } from '@/lib/utils';
import { Clock, BookOpen, UserCheck } from 'lucide-react';

export default function WorkloadPage() {
    const { schoolData } = useSchoolData();
    const typedSchoolData = schoolData as any;

    const workloadData = useMemo(() => {
        if (!typedSchoolData) return [];

        const teachers = typedSchoolData.teachers || [];
        const timetables = typedSchoolData.timetables || {};

        const teacherWorkloads = teachers.map((teacher: any) => {
            let totalHours = 0;
            const assignedClasses: string[] = [];
            const courses: string[] = [];

            // Scan all timetables (Secondary usually has these)
            // Logic: If a slot in a timetable belongs to this teacher, add it.
            // Note: In ODSM-App, timetables were often indexed by level/classroom
            Object.entries(timetables).forEach(([level, classrooms]: [string, any]) => {
                if (level === 'secondaire') {
                    Object.entries(classrooms).forEach(([classroomName, days]: [string, any]) => {
                        Object.values(days).forEach((slots: any) => {
                            if (Array.isArray(slots)) {
                                slots.forEach((slot: any) => {
                                    if (slot.teacherId === teacher.id || (slot.teacherName && matchTeacherName(getTeacherFullName(teacher), slot.teacherName))) {
                                        totalHours += 1; // Each slot is typically 1 hour/period
                                        if (!assignedClasses.includes(classroomName)) assignedClasses.push(classroomName);
                                        if (slot.subject && !courses.includes(slot.subject)) courses.push(slot.subject);
                                    }
                                });
                            }
                        });
                    });
                }
            });

            return {
                id: teacher.id,
                name: getTeacherFullName(teacher),
                category: teacher.category,
                totalHours,
                classesCount: assignedClasses.length,
                courses: courses.join(', ')
            };
        });

        return teacherWorkloads.filter((tw: any) => tw.totalHours > 0 || tw.category === 'Personnel enseignant');
    }, [typedSchoolData]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-headline font-bold">Charges Horaires</h1>
                    <p className="text-muted-foreground">Répartition hebdomadaire du temps d'enseignement par professeur.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Professeurs</CardTitle>
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{workloadData.length}</div>
                        <p className="text-xs text-muted-foreground">Enseignants actifs au Secondaire</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Charge Moyenne</CardTitle>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {workloadData.length > 0 ? (workloadData.reduce((acc: number, curr: any) => acc + curr.totalHours, 0) / workloadData.length).toFixed(1) : 0}h
                        </div>
                        <p className="text-xs text-muted-foreground">Heures par semaine par prof</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Volume Global</CardTitle>
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{workloadData.reduce((acc: number, curr: any) => acc + curr.totalHours, 0)}h</div>
                        <p className="text-xs text-muted-foreground">Heures d'enseignement totales / semaine</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Détails par Enseignant</CardTitle>
                    <CardDescription>Calculé sur la base de l'emploi du temps actuel du Secondaire.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nom de l'Enseignant</TableHead>
                                <TableHead>Cours Dispensés</TableHead>
                                <TableHead className="text-center">Classes</TableHead>
                                <TableHead className="text-right">Volume Horaire</TableHead>
                                <TableHead className="text-right">Statut</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {workloadData.map((row: any) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-medium">{row.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{row.courses || '-'}</TableCell>
                                    <TableCell className="text-center">{row.classesCount}</TableCell>
                                    <TableCell className="text-right font-bold">{row.totalHours}h/sem</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={row.totalHours > 20 ? 'destructive' : row.totalHours > 10 ? 'default' : 'outline'}>
                                            {row.totalHours > 20 ? 'Surcharge' : row.totalHours > 0 ? 'Actif' : 'Non assigné'}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {workloadData.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Aucune donnée d'emploi du temps disponible pour calculer les charges.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
