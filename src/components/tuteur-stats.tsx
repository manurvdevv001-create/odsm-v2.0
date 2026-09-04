import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SchoolData, Guardian, Student } from '@/types';
import { Wallet, Users, Banknote, MapPin, GraduationCap } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export const TuteurStats = ({ schoolData }: { schoolData: SchoolData | null }) => {
    const stats = useMemo(() => {
        if (!schoolData || !schoolData.guardians) return null;
        
        const guardians: Guardian[] = schoolData.guardians as unknown as Guardian[];
        const { feeCategories = [], feeItems = [], inscriptionFee = {} } = schoolData.financeSettings || {};
        const allPayments = schoolData.payments || [];

        let totalBilledGlobal = 0;
        let totalPaidGlobal = 0;
        
        const byLevel: Record<string, { billed: number, paid: number, students: number }> = {
            maternelle: { billed: 0, paid: 0, students: 0 },
            primaire: { billed: 0, paid: 0, students: 0 },
            secondaire: { billed: 0, paid: 0, students: 0 }
        };
        const byClassroom: Record<string, { billed: number, paid: number, students: number }> = {};
        const byOption: Record<string, { billed: number, paid: number, students: number }> = {};

        guardians.forEach(guardian => {
            if (!guardian.students) return;
            
            guardian.students.forEach((student: Student) => {
                let studentBilled = 0;
                let studentPaid = 0;

                // 1. Inscription
                const gradeFee = (inscriptionFee as any)?.[student.gradeName];
                if (gradeFee && typeof gradeFee.amount === 'number') {
                    studentBilled += gradeFee.amount;
                    const studentPayments = allPayments.filter((p: any) => p.studentId === student.id && p.type === 'inscription');
                    studentPaid += studentPayments.reduce((sum: number, p: any) => sum + (p.totalAmountPaid || 0) + (p.totalDispensationAmount || 0), 0);
                }

                // 2. School Fees
                feeCategories.forEach((cat: any) => {
                    if (cat.appliesTo?.includes(student.classroomName || '')) {
                        const items = cat.feeItemIds.map((id: string) => feeItems.find((item: any) => item.id === id)).filter(Boolean);
                        const billed = items.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
                        studentBilled += billed;

                        const studentScolaritePayments = allPayments.filter((p: any) => p.studentId === student.id && p.type === 'scolarite');
                        studentScolaritePayments.forEach((p: any) => {
                            const relevantDetails = p.details?.filter((d: any) => cat.feeItemIds.includes(d.feeName || d.feeItemId));
                            studentPaid += (relevantDetails || []).reduce((sum: number, d: any) => sum + (d.amountPaid || 0) + (d.dispensationAmount || 0), 0);
                        });
                    }
                });

                totalBilledGlobal += studentBilled;
                totalPaidGlobal += studentPaid;

                // By Level
                const level = student.level?.toLowerCase() || 'inconnu';
                if (byLevel[level]) {
                    byLevel[level].billed += studentBilled;
                    byLevel[level].paid += studentPaid;
                    byLevel[level].students += 1;
                }

                // By Classroom
                const classroom = student.classroomName || 'Non affecté';
                if (!byClassroom[classroom]) byClassroom[classroom] = { billed: 0, paid: 0, students: 0 };
                byClassroom[classroom].billed += studentBilled;
                byClassroom[classroom].paid += studentPaid;
                byClassroom[classroom].students += 1;
                
                // By Option
                if (level === 'secondaire') {
                    const parts = student.gradeName.split(' ');
                    const option = parts.length > 1 ? parts.slice(1).join(' ') : 'Cycle Inférieur';
                    if (!byOption[option]) byOption[option] = { billed: 0, paid: 0, students: 0 };
                    byOption[option].billed += studentBilled;
                    byOption[option].paid += studentPaid;
                    byOption[option].students += 1;
                }
            });
        });

        return {
            global: {
                totalBilled: totalBilledGlobal,
                totalPaid: totalPaidGlobal,
                balance: totalBilledGlobal - totalPaidGlobal
            },
            byLevel,
            byClassroom,
            byOption
        };
    }, [schoolData]);

    if (!stats) return <div className="p-8 text-center text-muted-foreground">Données indisponibles.</div>;

    const formatMoney = (val: number) => `${val.toLocaleString()} USD`;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-blue-50 border-blue-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-blue-800 flex items-center gap-2"><Banknote className="h-4 w-4" /> Total Facturé</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-blue-900">{formatMoney(stats.global.totalBilled)}</p>
                    </CardContent>
                </Card>
                <Card className="bg-green-50 border-green-100">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-800 flex items-center gap-2"><Wallet className="h-4 w-4" /> Total Payé (Recettes)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-2xl font-black text-green-900">{formatMoney(stats.global.totalPaid)}</p>
                    </CardContent>
                </Card>
                <Card className={stats.global.balance > 0 ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}>
                    <CardHeader className="pb-2">
                        <CardTitle className={`text-sm flex items-center gap-2 ${stats.global.balance > 0 ? "text-red-800" : "text-emerald-800"}`}>
                            <Users className="h-4 w-4" /> Reste à recouvrer
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-2xl font-black ${stats.global.balance > 0 ? "text-red-900" : "text-emerald-900"}`}>{formatMoney(stats.global.balance)}</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Par Niveau Académique</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Niveau</TableHead>
                                    <TableHead className="text-right">Élèves</TableHead>
                                    <TableHead className="text-right">Recouvrement</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(stats.byLevel).map(([lvl, data]) => {
                                    if (data.students === 0) return null;
                                    const percent = data.billed > 0 ? Math.round((data.paid / data.billed) * 100) : 0;
                                    return (
                                        <TableRow key={lvl}>
                                            <TableCell className="capitalize">{lvl}</TableCell>
                                            <TableCell className="text-right">{data.students}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span>{percent}%</span>
                                                    <span className="text-xs text-muted-foreground">{formatMoney(data.paid)} / {formatMoney(data.billed)}</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><GraduationCap className="h-4 w-4" /> Par Option (Secondaire)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Option</TableHead>
                                    <TableHead className="text-right">Élèves</TableHead>
                                    <TableHead className="text-right">Recouvrement</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {Object.entries(stats.byOption).map(([opt, data]) => {
                                    const percent = data.billed > 0 ? Math.round((data.paid / data.billed) * 100) : 0;
                                    return (
                                        <TableRow key={opt}>
                                            <TableCell className="capitalize">{opt}</TableCell>
                                            <TableCell className="text-right">{data.students}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex flex-col items-end">
                                                    <span>{percent}%</span>
                                                    <span className="text-xs text-muted-foreground">{formatMoney(data.paid)} / {formatMoney(data.billed)}</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {Object.keys(stats.byOption).length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">Aucune donnée du secondaire</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" /> Par Local (Classe)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="max-h-[300px] overflow-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Local</TableHead>
                                        <TableHead className="text-right">Élèves</TableHead>
                                        <TableHead className="text-right">Facturé</TableHead>
                                        <TableHead className="text-right">Payé</TableHead>
                                        <TableHead className="text-right">Solde</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {Object.entries(stats.byClassroom).map(([cls, data]) => {
                                        const balance = data.billed - data.paid;
                                        return (
                                            <TableRow key={cls}>
                                                <TableCell className="font-medium">{cls}</TableCell>
                                                <TableCell className="text-right">{data.students}</TableCell>
                                                <TableCell className="text-right">{formatMoney(data.billed)}</TableCell>
                                                <TableCell className="text-right text-green-600">{formatMoney(data.paid)}</TableCell>
                                                <TableCell className={`text-right ${balance > 0 ? 'text-red-600 font-bold' : ''}`}>{formatMoney(balance)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
