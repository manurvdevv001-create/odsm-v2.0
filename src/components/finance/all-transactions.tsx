// src/components/finance/all-transactions.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Payment, FeeItem } from '@/types';
import { Input } from '@/components/ui/input';
import { Search, ListTree } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AllTransactionsProps {
    schoolData: any;
    onRowClick: (payment: Payment) => void;
}

export function AllTransactions({ schoolData, onRowClick }: AllTransactionsProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const allPayments = useMemo(() => {
        return (schoolData?.payments || [])
            .map((p: Payment) => {
                const student = schoolData?.students?.find((s: any) => s.id === p.studentId);
                return { ...p, student };
            })
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [schoolData?.payments, schoolData?.students]);

    const filteredPayments = useMemo(() => {
        if (!searchTerm) {
            return allPayments;
        }
        const lowercasedTerm = searchTerm.toLowerCase();

        return allPayments.filter((p: any) => {
            const studentName = p.student ? `${p.student.firstName} ${p.student.lastName}`.toLowerCase() : '';
            const studentNumber = p.student ? p.student.matricule.toLowerCase() : '';
            const transactionNumber = p.transactionNumber?.toLowerCase() || '';
            const paymentId = p.id.toLowerCase();
            const amount = (p.totalAmountPaid || 0).toString();

            return (
                studentName.includes(lowercasedTerm) ||
                studentNumber.includes(lowercasedTerm) ||
                transactionNumber.includes(lowercasedTerm) ||
                paymentId.includes(lowercasedTerm) ||
                amount.includes(lowercasedTerm)
            );
        });
    }, [allPayments, searchTerm]);

    const getPaymentLabel = (payment: Payment) => {
        if (payment.type === 'inscription') return "Frais d'Inscription";

        const feeItems = schoolData?.financeSettings?.feeItems || [];
        const feeNames = (payment.details || [])
            .map((detail: any) => feeItems.find((fi: FeeItem) => fi.id === detail.feeItemId)?.name)
            .filter(Boolean);

        if (feeNames.length > 1) return `Paiement groupé (${feeNames.length} frais)`;

        return feeNames[0] || 'Frais Scolaire';
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ListTree /> Journal de Toutes les Transactions
                </CardTitle>
                <CardDescription>
                    Consultez et recherchez toutes les opérations financières enregistrées pour l'école.
                </CardDescription>
                <div className="relative pt-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Rechercher par nom, matricule, No. transaction, montant..."
                        className="pl-10 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <ScrollArea className="h-[600px]">
                    {/* PC View: Table */}
                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No. Trans.</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Élève</TableHead>
                                    <TableHead>Libellé</TableHead>
                                    <TableHead className="text-right">Montant</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredPayments.length > 0 ? (
                                    filteredPayments.map((p: any) => (
                                        <TableRow key={p.id} onClick={() => onRowClick(p)} className="cursor-pointer hover:bg-muted">
                                            <TableCell>
                                                <Badge variant="outline">{p.transactionNumber}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {new Date(p.date).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </TableCell>
                                            <TableCell>
                                                {p.student ? (
                                                    <div>
                                                        <p className="font-medium">{p.student.lastName} {p.student.firstName}</p>
                                                        <p className="text-xs text-muted-foreground">{p.student.matricule}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">Élève non trouvé</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {getPaymentLabel(p)}
                                                {(p.totalDispensationAmount || 0) > 0 && <Badge variant="secondary" className="ml-2">Dispense</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {(p.totalAmountPaid || 0).toLocaleString()} {p.currency}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center">
                                            Aucune transaction trouvée.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="md:hidden space-y-4">
                        {filteredPayments.length > 0 ? (
                            filteredPayments.map((p: any) => (
                                <div
                                    key={p.id}
                                    onClick={() => onRowClick(p)}
                                    className="p-4 border rounded-lg space-y-2 active:bg-muted"
                                >
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline">{p.transactionNumber}</Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {new Date(p.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                                        </span>
                                    </div>
                                    <div>
                                        {p.student ? (
                                            <p className="font-semibold">{p.student.lastName} {p.student.firstName}</p>
                                        ) : (
                                            <p className="text-muted-foreground italic">Élève non trouvé</p>
                                        )}
                                        <p className="text-sm">{getPaymentLabel(p)}</p>
                                    </div>
                                    <div className="flex justify-between items-end">
                                        {(p.totalDispensationAmount || 0) > 0 && (
                                            <Badge variant="secondary">Dispense</Badge>
                                        )}
                                        <p className="text-lg font-bold text-primary ml-auto">
                                            {(p.totalAmountPaid || 0).toLocaleString()} {p.currency}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-8 text-center text-muted-foreground italic">
                                Aucune transaction trouvée.
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
