// src/components/finance/payment-receipt-dialog.tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Printer } from 'lucide-react';
import Image from 'next/image';
import type { Payment, Student, FeeItem, SchoolData } from '@/types';

interface PaymentReceiptDialogProps {
    isOpen: boolean;
    onClose: () => void;
    payment: Payment;
    student: Student;
    schoolData: SchoolData;
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────
function formatCurrency(amount: number, currency: string) {
    return `${(amount || 0).toLocaleString()} ${currency}`;
}

function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions) {
    return new Date(date).toLocaleDateString('fr-FR', options || { day: 'numeric', month: 'short', year: 'numeric' });
}

function getReceiptSettings(schoolData: SchoolData) {
    const config = (schoolData as any).configuration || {};
    return {
        model: config.receiptSettings?.model || 1,
        paperSize: config.receiptSettings?.paperSize || 'A4',
        orientation: config.receiptSettings?.orientation || 'portrait',
    };
}

function SchoolHeader({ schoolData, compact = false }: { schoolData: SchoolData; compact?: boolean }) {
    return (
        <div className={`flex items-center gap-3 ${compact ? '' : 'justify-between'}`}>
            {schoolData.logo ? (
                <Image src={schoolData.logo} alt={`Logo`} width={compact ? 50 : 70} height={compact ? 50 : 70} className="object-contain" />
            ) : (
                <div className={`${compact ? 'w-10 h-10' : 'w-14 h-14'} bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0`}>
                    <span className={`text-primary font-black ${compact ? 'text-lg' : 'text-2xl'}`}>{schoolData?.name?.charAt(0) || '?'}</span>
                </div>
            )}
            <div>
                <div className={`font-black text-primary ${compact ? 'text-base' : 'text-xl'}`}>{schoolData?.name}</div>
                <div className="text-xs text-muted-foreground">{schoolData?.address} — {schoolData?.city}, {schoolData?.province}</div>
                {schoolData?.phone && <div className="text-xs text-muted-foreground">Tél: {schoolData?.phone}</div>}
            </div>
        </div>
    );
}

function ReceiptMeta({ payment }: { payment: Payment }) {
    return (
        <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Reçu N°</div>
            <div className="font-mono font-black text-primary text-sm">{payment.transactionNumber || payment.id}</div>
            <div className="text-[10px] mt-1 text-muted-foreground">{formatDate(payment.date)}</div>
        </div>
    );
}

function PaymentDetailsTable({ payment, schoolData }: { payment: Payment; schoolData: SchoolData }) {
    return (
        <table className="w-full text-sm border-collapse">
            <thead>
                <tr className="border-b-2 border-current">
                    <th className="text-left py-2 text-xs uppercase tracking-wider">Description</th>
                    <th className="text-right py-2 text-xs uppercase tracking-wider">Dispense</th>
                    <th className="text-right py-2 text-xs uppercase tracking-wider">Payé</th>
                </tr>
            </thead>
            <tbody>
                {(payment.details || []).map((detail, index) => {
                    const feeItem = (schoolData as any).financeSettings?.feeItems?.find((fi: FeeItem) => fi.id === detail.feeItemId);
                    return (
                        <tr key={index} className="border-b border-gray-200">
                            <td className="py-2 pr-4">
                                <div className="font-semibold">{payment.type === 'inscription' ? "Frais d'Inscription" : feeItem?.name || 'Frais Scolaire'}</div>
                                {detail.dispensationReason && <div className="text-[10px] text-orange-600 italic">Motif: {detail.dispensationReason}</div>}
                            </td>
                            <td className="text-right py-2 text-orange-600 whitespace-nowrap">
                                {formatCurrency(detail.dispensationAmount || 0, payment.currency)}
                            </td>
                            <td className="text-right py-2 font-black whitespace-nowrap">
                                {formatCurrency(detail.amountPaid || 0, payment.currency)}
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modèle 1 — Classique
// ────────────────────────────────────────────────────────────────────────────────
function Model1({ payment, student, schoolData }: { payment: Payment; student: Student; schoolData: SchoolData }) {
    return (
        <div className="bg-white p-8 space-y-6 font-sans text-slate-800">
            <div className="flex justify-between items-start">
                <SchoolHeader schoolData={schoolData} />
                <ReceiptMeta payment={payment} />
            </div>
            <Separator />
            <div className="flex justify-between items-start gap-4">
                <div>
                    <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Reçu de paiement pour :</div>
                    <div className="text-xl font-black">{student.lastName} {student.middleName ? `${student.middleName} ` : ''}{student.firstName}</div>
                    <div className="text-xs text-muted-foreground mt-1">Matricule : {student.matricule} · Classe : {student.classroomName || student.gradeName}</div>
                    {payment.label && <div className="mt-2 text-sm font-medium border-l-4 border-primary pl-2">{payment.label}</div>}
                    <div className="text-xs mt-1 text-muted-foreground">Mode : <span className="font-bold text-foreground capitalize">{payment.paymentMethod === 'electronique' ? 'Monnaie Électronique' : payment.paymentMethod || 'Caisse'}</span>
                        {payment.paymentProvider && <span> — {payment.paymentProvider} (Réf: {payment.paymentReference})</span>}
                    </div>
                </div>
            </div>
            <PaymentDetailsTable payment={payment} schoolData={schoolData} />
            <div className="flex justify-between items-end mt-4">
                <div className="text-xs text-muted-foreground italic">
                    <div>Fait à {schoolData.city}, le {formatDate(payment.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div className="mt-8 border-t border-dashed w-40 pt-1">
                        <div className="font-bold not-italic text-foreground">Sceau et Signature</div>
                        <div className="text-[10px] mt-6 uppercase">Percepteur : <span className="font-semibold text-foreground">{payment.collectorName || 'Administrateur'}</span></div>
                    </div>
                </div>
                <div className="bg-primary text-primary-foreground p-5 rounded-2xl shadow-lg text-right">
                    <div className="text-[10px] font-bold opacity-80 uppercase tracking-widest mb-1">TOTAL PAYÉ</div>
                    <div className="text-3xl font-black">{formatCurrency(payment.totalAmountPaid || 0, payment.currency)}</div>
                </div>
            </div>
            <footer className="text-center border-t border-dashed pt-4 text-xs text-muted-foreground">
                <div>Merci pour votre confiance. Ce reçu est une preuve de votre paiement.</div>
                <div className="font-black text-primary mt-1">Orion Digital School Manager</div>
            </footer>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modèle 2 — Minimaliste
// ────────────────────────────────────────────────────────────────────────────────
function Model2({ payment, student, schoolData }: { payment: Payment; student: Student; schoolData: SchoolData }) {
    return (
        <div className="bg-white p-10 font-sans text-slate-900 max-w-2xl mx-auto">
            <div className="text-center mb-8">
                <div className="text-2xl font-black uppercase tracking-widest">{schoolData?.name}</div>
                <div className="text-xs text-gray-500 mt-1">{schoolData?.address} | {schoolData?.phone}</div>
                <div className="text-3xl font-thin tracking-[0.3em] mt-4 uppercase text-primary">Reçu</div>
            </div>
            <div className="flex justify-between text-sm mb-6">
                <div><span className="text-gray-500">N° :</span> <span className="font-mono font-bold">{payment.transactionNumber || payment.id}</span></div>
                <div><span className="text-gray-500">Date :</span> <span className="font-semibold">{formatDate(payment.date)}</span></div>
            </div>
            <div className="border-t border-b py-4 mb-6">
                <div className="text-lg font-bold">{student.lastName} {student.middleName ? `${student.middleName} ` : ''}{student.firstName}</div>
                <div className="text-xs text-gray-500">{student.classroomName || student.gradeName} · Matricule {student.matricule}</div>
            </div>
            <PaymentDetailsTable payment={payment} schoolData={schoolData} />
            <div className="mt-8 text-right">
                <div className="text-xs uppercase tracking-widest text-gray-500">Total payé</div>
                <div className="text-4xl font-black mt-1">{formatCurrency(payment.totalAmountPaid || 0, payment.currency)}</div>
            </div>
            <div className="mt-10 flex justify-between items-end text-xs text-gray-400">
                <div>Percepteur : {payment.collectorName || 'Administrateur'}</div>
                <div>Orion DSM</div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modèle 3 — Ticket de caisse (80mm style)
// ────────────────────────────────────────────────────────────────────────────────
function Model3({ payment, student, schoolData }: { payment: Payment; student: Student; schoolData: SchoolData }) {
    return (
        <div className="bg-white p-4 font-mono text-xs" style={{ maxWidth: '72mm', margin: '0 auto' }}>
            <div className="text-center font-bold text-sm mb-1">{schoolData?.name}</div>
            <div className="text-center text-[10px] mb-1">{schoolData?.address}</div>
            <div className="text-center text-[10px] mb-3">Tél: {schoolData?.phone}</div>
            <div className="border-t border-dashed border-black mb-2"></div>
            <div className="text-center font-bold text-sm mb-2">REÇU DE PAIEMENT</div>
            <div className="flex justify-between mb-1"><span>N°:</span><span className="font-bold">{payment.transactionNumber || payment.id?.slice(-8)}</span></div>
            <div className="flex justify-between mb-3"><span>Date:</span><span>{formatDate(payment.date)}</span></div>
            <div className="border-t border-dashed border-black mb-2"></div>
            <div className="mb-1 font-bold">{student.lastName} {student.firstName}</div>
            <div className="mb-3 text-[10px]">{student.classroomName || student.gradeName} | {student.matricule}</div>
            <div className="border-t border-dashed border-black mb-2"></div>
            {(payment.details || []).map((detail, i) => {
                const feeItem = (schoolData as any).financeSettings?.feeItems?.find((fi: FeeItem) => fi.id === detail.feeItemId);
                return (
                    <div key={i} className="mb-1">
                        <div>{payment.type === 'inscription' ? "Inscription" : feeItem?.name || 'Frais'}</div>
                        <div className="flex justify-between">
                            <span className="text-gray-500">Payé:</span>
                            <span className="font-bold">{formatCurrency(detail.amountPaid || 0, payment.currency)}</span>
                        </div>
                    </div>
                );
            })}
            <div className="border-t border-dashed border-black my-2"></div>
            <div className="flex justify-between font-bold text-sm">
                <span>TOTAL:</span>
                <span>{formatCurrency(payment.totalAmountPaid || 0, payment.currency)}</span>
            </div>
            <div className="border-t border-dashed border-black mt-2 mb-3"></div>
            <div className="text-center text-[10px]">Mode: {payment.paymentMethod === 'electronique' ? 'Élect.' : 'Caisse'}</div>
            <div className="text-center text-[10px]">Caissier: {payment.collectorName || 'Admin'}</div>
            <div className="text-center text-[10px] mt-3">Merci pour votre paiement!</div>
            <div className="text-center text-[10px]">*** ORION DSM ***</div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modèle 4 — Colonnes (tableau compact)
// ────────────────────────────────────────────────────────────────────────────────
function Model4({ payment, student, schoolData }: { payment: Payment; student: Student; schoolData: SchoolData }) {
    return (
        <div className="bg-white p-8 font-sans text-sm">
            <div className="grid grid-cols-2 gap-4 mb-6">
                <SchoolHeader schoolData={schoolData} compact />
                <ReceiptMeta payment={payment} />
            </div>
            <div className="bg-slate-100 rounded-xl p-4 mb-4">
                <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-gray-500 block">Élève</span><span className="font-bold">{student.lastName} {student.firstName}</span></div>
                    <div><span className="text-gray-500 block">Matricule</span><span className="font-mono font-bold">{student.matricule}</span></div>
                    <div><span className="text-gray-500 block">Classe</span><span className="font-bold">{student.classroomName || student.gradeName}</span></div>
                </div>
            </div>
            <PaymentDetailsTable payment={payment} schoolData={schoolData} />
            <div className="flex justify-between items-center mt-6 bg-slate-800 text-white rounded-xl p-4">
                <div>
                    <div className="text-xs opacity-70">Mode de paiement</div>
                    <div className="font-bold capitalize">{payment.paymentMethod === 'electronique' ? 'Monnaie Électronique' : payment.paymentMethod || 'Caisse'}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs opacity-70 uppercase tracking-widest">Total Payé</div>
                    <div className="text-2xl font-black">{formatCurrency(payment.totalAmountPaid || 0, payment.currency)}</div>
                </div>
            </div>
            <div className="flex justify-between items-end mt-6 text-xs text-gray-500">
                <div>Fait à {schoolData.city}, le {formatDate(payment.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div>Percepteur : {payment.collectorName || 'Administrateur'}</div>
            </div>
            <div className="text-center text-xs text-primary font-bold mt-4">Orion Digital School Manager</div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modèle 5 — Moderne (accent coloré)
// ────────────────────────────────────────────────────────────────────────────────
function Model5({ payment, student, schoolData }: { payment: Payment; student: Student; schoolData: SchoolData }) {
    return (
        <div className="bg-white font-sans overflow-hidden">
            {/* Bande de titre */}
            <div className="bg-primary text-primary-foreground px-8 py-5 flex justify-between items-center">
                <div>
                    <div className="text-xs uppercase tracking-[0.2em] opacity-80 mb-0.5">REÇU DE PAIEMENT</div>
                    <div className="text-2xl font-black">{schoolData?.name}</div>
                </div>
                <div className="text-right">
                    {schoolData.logo && <Image src={schoolData.logo} alt="" width={50} height={50} className="object-contain opacity-90 mb-1 ml-auto" />}
                    <div className="font-mono font-bold text-sm opacity-90">{payment.transactionNumber || payment.id}</div>
                    <div className="text-xs opacity-70">{formatDate(payment.date)}</div>
                </div>
            </div>
            <div className="p-8 space-y-6">
                <div className="flex gap-6 items-start">
                    <div className="flex-1">
                        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Bénéficiaire</div>
                        <div className="text-xl font-black">{student.lastName} {student.middleName ? `${student.middleName} ` : ''}{student.firstName}</div>
                        <div className="text-sm text-muted-foreground">{student.classroomName || student.gradeName} · {student.matricule}</div>
                        {payment.label && <div className="mt-2 text-sm font-semibold text-primary">{payment.label}</div>}
                    </div>
                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                        <div className="text-xs text-primary font-bold uppercase tracking-widest">Total Payé</div>
                        <div className="text-3xl font-black text-primary mt-1">{formatCurrency(payment.totalAmountPaid || 0, payment.currency)}</div>
                    </div>
                </div>
                <PaymentDetailsTable payment={payment} schoolData={schoolData} />
                <div className="flex justify-between items-end pt-4 border-t border-dashed text-xs text-muted-foreground">
                    <div>
                        <div>Mode : <span className="font-bold text-foreground capitalize">{payment.paymentMethod === 'electronique' ? 'Élect.' : payment.paymentMethod || 'Caisse'}</span></div>
                        <div>Percepteur : <span className="font-bold text-foreground">{payment.collectorName || 'Administrateur'}</span></div>
                    </div>
                    <div className="text-right">
                        <div>Fait à {schoolData.city}</div>
                        <div>le {formatDate(payment.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                        <div className="mt-6 border-t border-dashed pt-1 w-32 ml-auto">Signature</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Modèle 6 — Institutionnel (formel, avec cadre)
// ────────────────────────────────────────────────────────────────────────────────
function Model6({ payment, student, schoolData }: { payment: Payment; student: Student; schoolData: SchoolData }) {
    return (
        <div className="bg-white p-10 font-serif text-sm border-8 border-double border-slate-300">
            <div className="text-center mb-6 border-b-2 border-slate-800 pb-6">
                {schoolData.logo && <Image src={schoolData.logo} alt="" width={60} height={60} className="object-contain mx-auto mb-2" />}
                <div className="text-2xl font-bold uppercase tracking-widest">{schoolData?.name}</div>
                <div className="text-xs text-gray-600 mt-1">{schoolData?.address} · {schoolData?.city}, {schoolData?.province}</div>
                <div className="text-xs text-gray-600">Tél : {schoolData?.phone}</div>
            </div>
            <div className="text-center mb-8">
                <div className="text-xl font-bold uppercase tracking-[0.3em] border border-slate-800 inline-block px-8 py-2">Reçu de Paiement</div>
            </div>
            <div className="grid grid-cols-2 gap-6 mb-6 text-xs">
                <div>
                    <div className="font-bold uppercase mb-1 border-b pb-1">Informations du bénéficiaire</div>
                    <div><span className="text-gray-500">Nom : </span><span className="font-semibold">{student.lastName} {student.middleName ? `${student.middleName} ` : ''}{student.firstName}</span></div>
                    <div><span className="text-gray-500">Matricule : </span><span className="font-mono">{student.matricule}</span></div>
                    <div><span className="text-gray-500">Classe : </span><span>{student.classroomName || student.gradeName}</span></div>
                </div>
                <div className="text-right">
                    <div className="font-bold uppercase mb-1 border-b pb-1">Détails du reçu</div>
                    <div><span className="text-gray-500">N° Reçu : </span><span className="font-mono font-bold">{payment.transactionNumber || payment.id}</span></div>
                    <div><span className="text-gray-500">Date : </span><span>{formatDate(payment.date, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
                    <div><span className="text-gray-500">Mode : </span><span className="capitalize">{payment.paymentMethod === 'electronique' ? 'Monnaie Élect.' : payment.paymentMethod || 'Caisse'}</span></div>
                </div>
            </div>
            <PaymentDetailsTable payment={payment} schoolData={schoolData} />
            <div className="flex justify-end mt-6">
                <div className="border-2 border-slate-800 px-8 py-3 text-right">
                    <div className="text-xs uppercase tracking-widest text-gray-600">Total Payé</div>
                    <div className="text-2xl font-bold mt-1">{formatCurrency(payment.totalAmountPaid || 0, payment.currency)}</div>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-8 mt-10 text-xs text-gray-600">
                <div>
                    <div>Lu et approuvé,</div>
                    <div className="mt-12 border-t border-slate-800 pt-1">Signature du bénéficiaire</div>
                </div>
                <div className="text-right">
                    <div>Fait à {schoolData.city},</div>
                    <div>le {formatDate(payment.date, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                    <div className="mt-8 border-t border-slate-800 pt-1">Percepteur : {payment.collectorName || 'Administrateur'}</div>
                </div>
            </div>
            <div className="text-center text-[10px] text-gray-400 mt-8 border-t pt-3">
                Document généré par Orion Digital School Manager — {schoolData?.name}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────────
// Receipt Switcher
// ────────────────────────────────────────────────────────────────────────────────
function ReceiptContent({ payment, student, schoolData }: { payment: Payment; student: Student; schoolData: SchoolData }) {
    const { model } = getReceiptSettings(schoolData);

    switch (model) {
        case 2: return <Model2 payment={payment} student={student} schoolData={schoolData} />;
        case 3: return <Model3 payment={payment} student={student} schoolData={schoolData} />;
        case 4: return <Model4 payment={payment} student={student} schoolData={schoolData} />;
        case 5: return <Model5 payment={payment} student={student} schoolData={schoolData} />;
        case 6: return <Model6 payment={payment} student={student} schoolData={schoolData} />;
        default: return <Model1 payment={payment} student={student} schoolData={schoolData} />;
    }
}

// ────────────────────────────────────────────────────────────────────────────────
// Print CSS helper
// ────────────────────────────────────────────────────────────────────────────────
function getPrintCSS(paperSize: string, orientation: string) {
    let pageSize = 'A4';
    if (paperSize === 'A5') pageSize = 'A5';
    if (paperSize === '80mm') pageSize = '80mm 297mm'; // thermal roll

    return `
        @media print {
            @page {
                size: ${pageSize} ${orientation === 'landscape' && paperSize !== '80mm' ? 'landscape' : 'portrait'};
                margin: 0.5cm;
            }
            body * { visibility: hidden; }
            #receipt-print-area, #receipt-print-area * { visibility: visible; }
            #receipt-print-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
            }
        }
    `;
}

// ────────────────────────────────────────────────────────────────────────────────
// Main Dialog
// ────────────────────────────────────────────────────────────────────────────────
export function PaymentReceiptDialog({ isOpen, onClose, payment, student, schoolData }: PaymentReceiptDialogProps) {
    const { paperSize, orientation, model } = getReceiptSettings(schoolData);

    const handlePrint = () => {
        window.print();
    };

    const modelNames = ['', 'Classique', 'Minimaliste', 'Ticket de Caisse', 'Colonnes', 'Moderne', 'Institutionnel'];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[95vh] overflow-y-auto p-0 sm:p-6 print:max-w-full print:max-h-none print:overflow-visible print:border-0 print:shadow-none">
                <DialogHeader className="p-4 pb-0 sm:p-0 print:hidden">
                    <DialogTitle className="text-lg sm:text-2xl">Reçu de Paiement</DialogTitle>
                    <DialogDescription className="text-xs sm:text-sm">
                        {student.lastName} {student.middleName ? `${student.middleName} ` : ''}{student.firstName} · Modèle {model} ({modelNames[model] || 'Classique'}) · {paperSize} {orientation}
                    </DialogDescription>
                </DialogHeader>

                <div id="receipt-print-area" className="bg-white overflow-hidden">
                    <ReceiptContent payment={payment} student={student} schoolData={schoolData} />
                </div>

                <DialogFooter className="print:hidden p-4 sm:p-0">
                    <Button variant="outline" onClick={onClose}>Fermer</Button>
                    <Button onClick={handlePrint}><Printer className="mr-2 w-4 h-4" />Imprimer / PDF</Button>
                </DialogFooter>

                <style>{getPrintCSS(paperSize, orientation)}</style>
            </DialogContent>
        </Dialog>
    );
}
