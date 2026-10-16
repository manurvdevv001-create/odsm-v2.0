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
        const rawTimetables = typedSchoolData.timetables || {};
        const timetables = typeof rawTimetables === 'string'
            ? (() => { try { return JSON.parse(rawTimetables); } catch { return {}; } })()
            : rawTimetables;

        const teacherWorkloads = teachers.map((teacher: any) => {
            let totalHours = 0;
            const assignedClasses = new Set<string>();
            const courses = new Set<string>();
            const teacherFullName = getTeacherFullName(teacher);

            // Scan all timetables. Timetables are structured as:
            // timetables[classroomName][day_slotKey] = { course: string, teacher?: string, teacherId?: string, ... }
            // Or historically/nested: timetables[level][classroomName][day] = [slots]
            Object.entries(timetables).forEach(([classroomOrLevelKey, classroomData]: [string, any]) => {
                if (!classroomData || typeof classroomData !== 'object') return;

                // Case 1: Standard flat structure timetables[classroomKey][slotKey]
                // Check if values inside are slot objects with course/teacher
                const entries = Object.entries(classroomData);
                const isFlatClassroom = entries.some(([_, val]: [string, any]) => val && typeof val === 'object' && ('course' in val || 'teacher' in val || 'teacherId' in val));

                if (isFlatClassroom) {
                    const classroomName = classroomOrLevelKey;
                    entries.forEach(([_, slot]: [string, any]) => {
                        if (!slot || typeof slot !== 'object') return;
                        const sTeacherName = slot.teacher || slot.teacherName;
                        const sTeacherId = slot.teacherId;
                        const isMatch = (sTeacherId && sTeacherId === teacher.id) ||
                            (sTeacherName && (matchTeacherName(teacherFullName, sTeacherName) || matchTeacherName(teacher.lastName, sTeacherName)));

                        if (isMatch) {
                            totalHours += 1;
                            assignedClasses.add(classroomName);
                            const subject = slot.course || slot.subject;
                            if (subject) courses.add(subject);
                        }
                    });
                } else {
                    // Case 2: Nested structure timetables[level][classroomName][day/slots]
                    Object.entries(classroomData).forEach(([classroomName, daysOrSlots]: [string, any]) => {
                        if (!daysOrSlots || typeof daysOrSlots !== 'object') return;

                        const scanSlot = (slot: any) => {
                            if (!slot || typeof slot !== 'object') return;
                            const sTeacherName = slot.teacher || slot.teacherName;
                            const sTeacherId = slot.teacherId;
                            const isMatch = (sTeacherId && sTeacherId === teacher.id) ||
                                (sTeacherName && (matchTeacherName(teacherFullName, sTeacherName) || matchTeacherName(teacher.lastName, sTeacherName)));

                            if (isMatch) {
                                totalHours += 1;
                                assignedClasses.add(classroomName);
                                const subject = slot.course || slot.subject;
                                if (subject) courses.add(subject);
                            }
                        };

                        if (Array.isArray(daysOrSlots)) {
                            daysOrSlots.forEach(scanSlot);
                        } else {
                            Object.values(daysOrSlots).forEach((val: any) => {
                                if (Array.isArray(val)) {
                                    val.forEach(scanSlot);
                                } else if (val && typeof val === 'object') {
                                    scanSlot(val);
                                }
                            });
                        }
                    });
                }
            });

            return {
                id: teacher.id,
                name: teacherFullName,
                category: teacher.category,
                totalHours,
                classesCount: assignedClasses.size,
                courses: Array.from(courses).join(', ')
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
                        <CardTitle className="text-sm font-medium">Total Enseignant</CardTitle>
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
