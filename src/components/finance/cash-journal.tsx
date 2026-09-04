// src/components/finance/cash-journal.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Button } from '@/components/ui/button';
import { Loader2, Wallet, User } from 'lucide-react';
import { toast } from 'sonner';
import { Student, Payment, FeeCategory, FeeItem, PaymentDetails } from '@/types';
import { PaymentReceiptDialog } from '@/components/finance/payment-receipt-dialog';
import { saveSchoolFeePayment } from '@/app/(main)/students/actions';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CashJournalProps {
    schoolData: any;
    refreshData: () => void;
    isReadOnly?: boolean;
}

type FeeToPay = FeeItem & {
    balance: number;
    paid: number;
    categoryName: string;
};

type PaymentInput = {
    amountPaid: number;
    dispensationAmount: number;
    dispensationReason: string;
};

export function CashJournal({ schoolData, refreshData, isReadOnly }: CashJournalProps) {
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [feesToPay, setFeesToPay] = useState<FeeToPay[]>([]);
    const [selectedFeeIds, setSelectedFeeIds] = useState<Record<string, boolean>>({});
    const [paymentInputs, setPaymentInputs] = useState<Record<string, Partial<PaymentInput>>>({});
    const [paymentLabel, setPaymentLabel] = useState('');
    const [isLabelModified, setIsLabelModified] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('caisse');
    const [paymentProvider, setPaymentProvider] = useState('');
    const [paymentReference, setPaymentReference] = useState('');

    // Receipt dialog state
    const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);
    const [receiptStudent, setReceiptStudent] = useState<Student | null>(null);

    const studentsForCombobox = useMemo(() => {
        return (schoolData?.students || [])
            .filter((s: Student) => s.status === 'active')
            .map((s: Student) => ({
                value: s.id,
                label: `${s.lastName} ${s.firstName} (${s.matricule})`,
            }));
    }, [schoolData?.students]);

    const selectedStudent = useMemo(() => {
        if (!selectedStudentId) return null;
        return schoolData?.students?.find((s: Student) => s.id === selectedStudentId);
    }, [selectedStudentId, schoolData?.students]);

    const studentPayments = useMemo(() => {
        if (!selectedStudentId) return [];
        return schoolData?.payments?.filter((p: Payment) => p.studentId === selectedStudentId && p.type === 'scolarite') || [];
    }, [selectedStudentId, schoolData?.payments]);

    useMemo(() => {
        if (!selectedStudent) {
            setFeesToPay([]);
            return;
        }

        const applicableFees: FeeToPay[] = [];
        const { feeCategories = [], feeItems = [] } = schoolData?.financeSettings || {};

        const applicableCategories = feeCategories.filter((cat: FeeCategory) => {
            const matchesClassroom = cat.appliesTo.includes(selectedStudent.classroomName!);
            const matchesCategory = !cat.paymentCategoryId || cat.paymentCategoryId === selectedStudent.paymentCategoryId;
            return matchesClassroom && matchesCategory;
        });

        applicableCategories.forEach((cat: FeeCategory) => {
            const categoryItems = cat.feeItemIds.map((id: string) => feeItems.find((item: FeeItem) => item.id === id)).filter(Boolean) as FeeItem[];

            categoryItems.forEach((item: FeeItem) => {
                const paymentsForThisItem = studentPayments.flatMap((p: Payment) => (p.details || []).filter((d: any) => d.feeItemId === item.id));
                const totalPaid = paymentsForThisItem.reduce((sum: number, d: any) => sum + (d.amountPaid || 0) + (d.dispensationAmount || 0), 0);
                const balance = item.amount - totalPaid;

                if (balance > 0) {
                    applicableFees.push({ ...item, balance, paid: totalPaid, categoryName: cat.name });
                }
            });
        });

        setFeesToPay(applicableFees);
        setSelectedFeeIds({});
        setPaymentInputs({});
        setPaymentMethod('caisse');
        setPaymentProvider('');
        setPaymentReference('');
    }, [selectedStudent, schoolData?.financeSettings, studentPayments]);

    const handleFeeSelectionChange = (feeId: string, isChecked: boolean) => {
        setSelectedFeeIds(prev => ({ ...prev, [feeId]: isChecked }));
    };

    const handlePaymentInputChange = (feeId: string, field: keyof PaymentInput, value: string) => {
        setPaymentInputs(prev => ({
            ...prev,
            [feeId]: {
                ...prev[feeId],
                [field]: field === 'dispensationReason' ? value : Number(value)
            }
        }));
    }

    const totalPaidForTransaction = useMemo(() => {
        return Object.entries(paymentInputs).reduce((total, [, input]) => {
            return total + (input.amountPaid || 0);
        }, 0);
    }, [paymentInputs]);

    const paidItemsSummary = useMemo(() => {
        return feesToPay.filter(f => selectedFeeIds[f.id]);
    }, [feesToPay, selectedFeeIds]);

    useEffect(() => {
        if (!isLabelModified) {
            if (paidItemsSummary.length > 0) {
                const categories = Array.from(new Set(paidItemsSummary.map(f => f.categoryName)));
                const itemsList = paidItemsSummary.map(f => f.name).join(', ');
                const suggestedLabel = `${categories.join(' / ')} : ${itemsList}`;
                setPaymentLabel(suggestedLabel);
            } else {
                setPaymentLabel('');
            }
        }
    }, [paidItemsSummary, isLabelModified]);

    const handleSubmit = async () => {
        if (!selectedStudentId || paidItemsSummary.length === 0) {
            toast('Erreur', { description: 'Veuillez sélectionner un élève et au moins un frais.' });
            return;
        }

        const paymentDetails: PaymentDetails[] = [];
        let totalAmountPaid = 0;
        let totalDispensationAmount = 0;

        for (const fee of paidItemsSummary) {
            const input = paymentInputs[fee.id] || {};
            const amountPaid = input.amountPaid || 0;
            const dispensationAmount = input.dispensationAmount || 0;
            const dispensationReason = input.dispensationReason || '';

            if (amountPaid > 0 || dispensationAmount > 0) {
                if (dispensationAmount > 0 && !dispensationReason) {
                    toast('Motif manquant', { description: `Le motif est obligatoire pour la dispense sur le frais "${fee.name}".` });
                    return;
                }
                if ((amountPaid + dispensationAmount) > fee.balance) {
                    toast('Montant excessif', { description: `Le paiement pour "${fee.name}" dépasse le solde restant.` });
                    return;
                }

                paymentDetails.push({
                    feeItemId: fee.id,
                    amountPaid,
                    dispensationAmount,
                    dispensationReason,
                });
                totalAmountPaid += amountPaid;
                totalDispensationAmount += dispensationAmount;
            }
        }

        if (paymentDetails.length === 0) {
            toast('Montant nul', { description: 'Veuillez saisir au moins un montant payé ou une dispense.' });
            return;
        }

        if (paymentMethod !== 'caisse') {
            if (!paymentProvider) {
                toast('Information manquante', { description: "Veuillez sélectionner la banque ou le service électronique." });
                return;
            }
            if (!paymentReference) {
                toast('Information manquante', { description: "Veuillez indiquer la référence du paiement (bordereau/transaction)." });
                return;
            }
        }

        setIsSaving(true);

        let collectorName = 'Administrateur';
        try {
            const storedUser = localStorage.getItem('odsm-user');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                if (user.name) collectorName = user.name;
            }
        } catch (e) {
            console.error('Error reading collector name:', e);
        }

        const paymentRecord: Payment = {
            id: `pay_${Date.now()}`,
            studentId: selectedStudentId,
            type: 'scolarite',
            date: new Date().toISOString(),
            currency: paidItemsSummary[0].currency,
            totalAmountPaid,
            totalDispensationAmount,
            details: paymentDetails,
            label: paymentLabel.trim() || undefined,
            collectorName,
            paymentMethod,
            paymentProvider,
            paymentReference,
        };

        const result = await saveSchoolFeePayment(schoolData.matricule, paymentRecord, collectorName);

        if (result.success && result.data) {
            toast('Paiement enregistré !', { description: `Le paiement de ${totalAmountPaid.toLocaleString()} ${paymentRecord.currency} a été enregistré.` });
            setReceiptPayment(result.data);
            setReceiptStudent(selectedStudent || null);
            setSelectedStudentId(null);
            setPaymentLabel('');
            setIsLabelModified(false);
            setPaymentMethod('caisse');
            setPaymentProvider('');
            setPaymentReference('');
            refreshData();
        } else if (result.success) { // Fallback if data is missing for some reason
            toast('Paiement enregistré !', { description: `Le paiement de ${totalAmountPaid.toLocaleString()} ${paymentRecord.currency} a été enregistré.` });
            setSelectedStudentId(null);
            setPaymentLabel('');
            setIsLabelModified(false);
            setPaymentMethod('caisse');
            setPaymentProvider('');
            setPaymentReference('');
            refreshData();
        } else {
            toast('Erreur', { description: result.error || "Une erreur est survenue." });
        }
        setIsSaving(false);
    };

    const feesByCategory = useMemo(() => {
        return feesToPay.reduce((acc, fee) => {
            (acc[fee.categoryName] = acc[fee.categoryName] || []).push(fee);
            return acc;
        }, {} as Record<string, FeeToPay[]>);
    }, [feesToPay]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Wallet /> Journal de Caisse
                </CardTitle>
                <CardDescription>
                    Enregistrez les paiements de frais scolaires pour les élèves.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                    <User className="w-5 h-5 text-muted-foreground hidden sm:block" />
                    <Combobox
                        items={studentsForCombobox}
                        value={selectedStudentId}
                        onChange={setSelectedStudentId}
                        placeholder="Sélectionner un élève..."
                        searchPlaceholder="Rechercher un élève..."
                        notfoundText="Aucun élève trouvé."
                        triggerClass="w-full sm:w-[450px]"
                    />
                </div>

                {selectedStudent && (
                    <div className="pt-4 border-t">
                        {feesToPay.length === 0 ? (
                            <p className="text-center text-green-600 font-semibold py-8">Cet élève est en ordre de paiement.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                <div className="space-y-2">
                                    <h3 className="font-semibold">Frais à payer</h3>
                                    <ScrollArea className="h-[400px] border p-2 rounded-md">
                                        <Accordion type="multiple" defaultValue={Object.keys(feesByCategory)}>
                                            {Object.entries(feesByCategory).map(([categoryName, fees]) => (
                                                <AccordionItem key={categoryName} value={categoryName}>
                                                    <AccordionTrigger>{categoryName}</AccordionTrigger>
                                                    <AccordionContent>
                                                        <div className="space-y-2">
                                                            {fees.map(fee => (
                                                                <div key={fee.id} className={cn("p-2 rounded-md", selectedFeeIds[fee.id] ? 'bg-muted/50' : 'hover:bg-muted/50')}>
                                                                    <div className="flex items-center justify-between">
                                                                        <div className="flex items-center gap-3">
                                                                            <Checkbox
                                                                                id={`fee-${fee.id}`}
                                                                                checked={!!selectedFeeIds[fee.id]}
                                                                                onCheckedChange={(checked) => handleFeeSelectionChange(fee.id, !!checked)}
                                                                                disabled={paidItemsSummary.length > 0 && paidItemsSummary[0].currency !== fee.currency}
                                                                            />
                                                                            <div className="grid gap-0.5">
                                                                                <Label htmlFor={`fee-${fee.id}`} className={cn("cursor-pointer", paidItemsSummary.length > 0 && paidItemsSummary[0].currency !== fee.currency && "text-muted-foreground")}>{fee.name}</Label>
                                                                                <span className="text-xs text-muted-foreground">Solde: {fee.balance.toLocaleString()} {fee.currency}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {selectedFeeIds[fee.id] && (
                                                                        <div className="grid grid-cols-2 gap-2 mt-2 pl-8">
                                                                            <div className='space-y-1'>
                                                                                <Label htmlFor={`paid-${fee.id}`} className="text-xs">Montant payé</Label>
                                                                                <Input
                                                                                    id={`paid-${fee.id}`}
                                                                                    type="number"
                                                                                    placeholder="0"
                                                                                    value={paymentInputs[fee.id]?.amountPaid ?? ''}
                                                                                    onChange={(e) => handlePaymentInputChange(fee.id, 'amountPaid', e.target.value)}
                                                                                    className="h-8"
                                                                                    max={fee.balance}
                                                                                />
                                                                            </div>
                                                                            <div className='space-y-1'>
                                                                                <Label htmlFor={`disp-${fee.id}`} className="text-xs">Dispense</Label>
                                                                                <Input
                                                                                    id={`disp-${fee.id}`}
                                                                                    type="number"
                                                                                    placeholder="0"
                                                                                    value={paymentInputs[fee.id]?.dispensationAmount ?? ''}
                                                                                    onChange={(e) => handlePaymentInputChange(fee.id, 'dispensationAmount', e.target.value)}
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                            <div className="col-span-2 space-y-1">
                                                                                <Label htmlFor={`reason-${fee.id}`} className="text-xs">Motif de la dispense</Label>
                                                                                <Input
                                                                                    id={`reason-${fee.id}`}
                                                                                    type="text"
                                                                                    placeholder="Motif (si dispense)"
                                                                                    value={paymentInputs[fee.id]?.dispensationReason ?? ''}
                                                                                    onChange={(e) => handlePaymentInputChange(fee.id, 'dispensationReason', e.target.value)}
                                                                                    className="h-8"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </AccordionContent>
                                                </AccordionItem>
                                            ))}
                                        </Accordion>
                                    </ScrollArea>
                                </div>
                                <div className="space-y-4 p-4 rounded-lg bg-muted/50 md:sticky md:top-4 h-fit">
                                    <h3 className="font-semibold text-primary">Résumé du paiement</h3>
                                    <div className="space-y-1 text-sm min-h-[60px]">
                                        {paidItemsSummary.length > 0 ? (
                                            paidItemsSummary.map(f => (
                                                <div key={f.id} className="flex justify-between">
                                                    <span>{f.name}</span>
                                                    <span>{(paymentInputs[f.id]?.amountPaid || 0).toLocaleString()} {f.currency}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-muted-foreground text-center pt-4">Sélectionnez un ou plusieurs frais de la même devise.</p>
                                        )}
                                    </div>
                                    <Separator />

                                    <div className="space-y-1">
                                        <Label htmlFor="payment-label" className="text-sm">Libellé du paiement (optionnel)</Label>
                                        <Input
                                            id="payment-label"
                                            placeholder="Ex: Frais 1er trimestre, Cantine..."
                                            value={paymentLabel}
                                            onChange={(e) => {
                                                setPaymentLabel(e.target.value);
                                                setIsLabelModified(true);
                                            }}
                                        />
                                    </div>

                                    <div className="space-y-1 mt-4">
                                        <Label className="text-sm font-semibold text-primary">Mode de paiement</Label>
                                        <Select 
                                            value={paymentMethod} 
                                            onValueChange={(v) => {
                                                setPaymentMethod(v);
                                                setPaymentProvider('');
                                                setPaymentReference('');
                                            }}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Sélectionnez un mode" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="caisse">Caisse</SelectItem>
                                                <SelectItem value="banque">Banque</SelectItem>
                                                <SelectItem value="electronique">Monnaie Électronique</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {paymentMethod === 'banque' && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Banque</Label>
                                                <Select value={paymentProvider} onValueChange={setPaymentProvider}>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Choisir..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {schoolData?.financeSettings?.banks?.map((b: any) => (
                                                            <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                                                        ))}
                                                        {(!schoolData?.financeSettings?.banks || schoolData?.financeSettings?.banks.length === 0) && (
                                                            <SelectItem value="-" disabled>Aucune banque configurée</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">N° Bordereau</Label>
                                                <Input 
                                                    placeholder="Réf" 
                                                    value={paymentReference} 
                                                    onChange={e => setPaymentReference(e.target.value)} 
                                                    className="h-8" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {paymentMethod === 'electronique' && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs">Service</Label>
                                                <Select value={paymentProvider} onValueChange={setPaymentProvider}>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Choisir..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {schoolData?.financeSettings?.electronicProviders?.map((ep: any) => (
                                                            <SelectItem key={ep.id} value={ep.name}>{ep.name}</SelectItem>
                                                        ))}
                                                        {(!schoolData?.financeSettings?.electronicProviders || schoolData?.financeSettings?.electronicProviders.length === 0) && (
                                                            <SelectItem value="-" disabled>Aucun service configuré</SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1">
                                                <Label className="text-xs">Code Transaction</Label>
                                                <Input 
                                                    placeholder="Code" 
                                                    value={paymentReference} 
                                                    onChange={e => setPaymentReference(e.target.value)} 
                                                    className="h-8" 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg text-primary">
                                        <h4>TOTAL PAYÉ</h4>
                                        <span>{totalPaidForTransaction.toLocaleString()} {paidItemsSummary[0]?.currency || ''}</span>
                                    </div>
                                    <Button onClick={handleSubmit} disabled={isSaving || paidItemsSummary.length === 0 || totalPaidForTransaction <= 0 || isReadOnly} className="w-full">
                                        {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Wallet className="mr-2" />} Enregistrer le paiement
                                    </Button>
                                    {isReadOnly && <p className="text-xs text-amber-600 text-center font-bold">Mode Lecture Seule - Paiement désactivé</p>}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            {receiptPayment && receiptStudent && (
                <PaymentReceiptDialog
                    isOpen={!!receiptPayment}
                    onClose={() => {
                        setReceiptPayment(null);
                        setReceiptStudent(null);
                    }}
                    payment={receiptPayment}
                    student={receiptStudent}
                    schoolData={schoolData}
                />
            )}
        </Card>
    );
}
