// src/components/finance/class-summary.tsx
'use client';

import { useState, useMemo, Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Payment, FeeCategory, FeeItem } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Progress } from '@/components/ui/progress';
import { LineChart, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getAllClassrooms } from '@/lib/classroom-utils';

interface ClassSummaryProps {
    schoolData: any;
}

type ClassroomFinanceSummary = {
    classroomName: string;
    currency: string;
    totalBilled: number;
    totalPaid: number;
    balance: number;
};

export function ClassSummary({ schoolData }: ClassSummaryProps) {
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    const allClassrooms = useMemo(() => {
        if (!schoolData) return [];
        return getAllClassrooms(schoolData);
    }, [schoolData]);

    const financeSummary = useMemo((): ClassroomFinanceSummary[] => {
        if (!schoolData || !schoolData.financeSettings) {
            return [];
        }
        const { students = [], payments = [], financeSettings } = schoolData;
        const { feeCategories = [], feeItems = [] } = financeSettings;

        const summaryByClassAndCurrency: Record<string, ClassroomFinanceSummary> = {};

        allClassrooms.forEach((classroomName: string) => {
            const studentsInClass = students.filter((s: any) => s.classroomName === classroomName && s.status === 'active');
            if (studentsInClass.length === 0) return;

            const applicableCategories = feeCategories.filter((cat: FeeCategory) => cat.appliesTo.includes(classroomName));

            const feesByCurrency: Record<string, FeeItem[]> = {};

            applicableCategories.forEach((cat: FeeCategory) => {
                cat.feeItemIds.forEach((itemId: string) => {
                    const item = feeItems.find((fi: FeeItem) => fi.id === itemId);
                    if (item) {
                        if (!feesByCurrency[item.currency]) {
                            feesByCurrency[item.currency] = [];
                        }
                        feesByCurrency[item.currency].push(item);
                    }
                });
            });

            Object.entries(feesByCurrency).forEach(([currency, itemsInCurrency]) => {
                const totalBilled = itemsInCurrency.reduce((sum, item) => sum + item.amount, 0) * studentsInClass.length;

                let totalPaid = 0;
                const studentIdsInClass = new Set(studentsInClass.map((s: any) => s.id));
                const classPayments = payments.filter((p: Payment) => studentIdsInClass.has(p.studentId) && p.type === 'scolarite' && p.currency === currency);

                classPayments.forEach((p: Payment) => {
                    (p.details || []).forEach((detail: any) => {
                        if (itemsInCurrency.some(item => item.id === detail.feeItemId)) {
                            totalPaid += (detail.amountPaid || 0) + (detail.dispensationAmount || 0);
                        }
                    });
                });

                const summaryKey = `${classroomName}_${currency}`;
                summaryByClassAndCurrency[summaryKey] = {
                    classroomName,
                    currency,
                    totalBilled,
                    totalPaid,
                    balance: totalBilled - totalPaid,
                };
            });
        });

        return Object.values(summaryByClassAndCurrency);
    }, [schoolData, allClassrooms]);

    const getClassroomDetails = (classroomName: string, currency: string) => {
        const { students = [], payments = [], financeSettings } = schoolData;
        if (!financeSettings) return [];
        const { feeCategories = [], feeItems = [] } = financeSettings;
        const studentsInClass = students.filter((s: any) => s.classroomName === classroomName && s.status === 'active');
        const studentIdsInClass = new Set(studentsInClass.map((s: any) => s.id));

        const applicableCategories = feeCategories.filter((cat: FeeCategory) => cat.appliesTo.includes(classroomName));

        return applicableCategories.map((cat: FeeCategory) => {
            const items = cat.feeItemIds
                .map((id: string) => feeItems.find((item: FeeItem) => item.id === id))
                .filter((item: FeeItem | undefined): item is FeeItem => !!item && item.currency === currency);

            if (items.length === 0) return null;

            const categoryTotalBilled = items.reduce((sum: number, item: FeeItem) => sum + item.amount, 0) * studentsInClass.length;

            const categoryItemIds = new Set(items.map((i: FeeItem) => i.id));
            let categoryTotalPaid = 0;
            const classPayments = payments.filter((p: Payment) => studentIdsInClass.has(p.studentId) && p.type === 'scolarite' && p.currency === currency);
            classPayments.forEach((p: Payment) => {
                (p.details || []).forEach((d: any) => {
                    if (categoryItemIds.has(d.feeItemId)) {
                        categoryTotalPaid += (d.amountPaid || 0) + (d.dispensationAmount || 0);
                    }
                });
            });

            return {
                id: cat.id,
                name: cat.name,
                totalBilled: categoryTotalBilled,
                totalPaid: categoryTotalPaid,
                balance: categoryTotalBilled - categoryTotalPaid,
                currency: currency,
                feeItems: items.map((item: FeeItem) => {
                    let itemTotalPaid = 0;
                    classPayments.forEach((p: Payment) => {
                        (p.details || []).forEach((d: any) => {
                            if (d.feeItemId === item.id) {
                                itemTotalPaid += (d.amountPaid || 0) + (d.dispensationAmount || 0);
                            }
                        })
                    });

                    const itemTotalBilled = item.amount * studentsInClass.length;

                    return {
                        id: item.id,
                        name: item.name,
                        totalBilled: itemTotalBilled,
                        totalPaid: itemTotalPaid,
                        balance: itemTotalBilled - itemTotalPaid,
                        currency: item.currency
                    }
                })
            }
        }).filter((details: any): details is NonNullable<typeof details> => details !== null);
    }

    const handleRowClick = (classroomName: string, currency: string) => {
        const rowKey = `${classroomName}_${currency}`;
        setExpandedRow(prev => prev === rowKey ? null : rowKey);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <LineChart /> Suivi Financier par Classe
                </CardTitle>
                <CardDescription>
                    Vue d'ensemble des finances pour chaque local de classe. Cliquez sur une ligne pour voir les détails.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-8"></TableHead>
                            <TableHead>Local de Classe</TableHead>
                            <TableHead className="text-right">Total Facturé</TableHead>
                            <TableHead className="text-right">Total Payé</TableHead>
                            <TableHead className="text-right">Solde Dû</TableHead>
                            <TableHead className="w-1/4">Progression</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {financeSummary.map(summary => {
                            const rowKey = `${summary.classroomName}_${summary.currency}`;
                            return (
                                <Fragment key={rowKey}>
                                    <TableRow onClick={() => handleRowClick(summary.classroomName, summary.currency)} className="cursor-pointer">
                                        <TableCell>
                                            {expandedRow === rowKey ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {summary.classroomName} <Badge variant="secondary">{summary.currency}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">{summary.totalBilled.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-green-600">{summary.totalPaid.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-destructive">{summary.balance.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <Progress value={(summary.totalBilled > 0 ? (summary.totalPaid / summary.totalBilled) : 0) * 100} className="w-full" />
                                        </TableCell>
                                    </TableRow>
                                    {expandedRow === rowKey && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="p-0">
                                                <div className="p-4 bg-muted/50">
                                                    <h4 className="font-semibold text-base mb-2">Détails pour {summary.classroomName} (en {summary.currency})</h4>
                                                    <Accordion type="single" collapsible className="w-full">
                                                        {getClassroomDetails(summary.classroomName, summary.currency).map((catDetail: any) => (
                                                            <AccordionItem value={catDetail.id} key={catDetail.id}>
                                                                <AccordionTrigger>
                                                                    <div className="flex justify-between w-full pr-4 items-center">
                                                                        <span>{catDetail.name}</span>
                                                                        <Badge variant="outline">{catDetail.balance.toLocaleString()} {catDetail.currency} restants</Badge>
                                                                    </div>
                                                                </AccordionTrigger>
                                                                <AccordionContent>
                                                                    <Table>
                                                                        <TableHeader>
                                                                            <TableRow>
                                                                                <TableHead>Frais</TableHead>
                                                                                <TableHead className="text-right">Facturé</TableHead>
                                                                                <TableHead className="text-right">Payé</TableHead>
                                                                                <TableHead className="text-right">Solde</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {catDetail.feeItems.map((itemDetail: any) => (
                                                                                <TableRow key={itemDetail.id}>
                                                                                    <TableCell>{itemDetail.name}</TableCell>
                                                                                    <TableCell className="text-right">{itemDetail.totalBilled.toLocaleString()}</TableCell>
                                                                                    <TableCell className="text-right">{itemDetail.totalPaid.toLocaleString()}</TableCell>
                                                                                    <TableCell className="text-right font-medium">{itemDetail.balance.toLocaleString()}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                        ))}
                                                    </Accordion>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </Fragment>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
