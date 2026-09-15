'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { X, Phone, Mail, MapPin, Wallet, Users, ArrowRight, Trash2, Edit, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Student, SchoolData, Guardian } from '@/types';
import { getInitials } from '@/lib/utils';
import { getClassroomsByGrade } from '@/lib/classroom-utils';
import { deleteGuardian, updateGuardian, updateStudentGuardian } from '@/app/(main)/students/actions';
import { toast } from 'sonner';
import { GuardianForm } from '@/components/guardian-form';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Combobox } from '@/components/ui/combobox';
import { Label } from '@/components/ui/label';

interface GuardianDetailsDialogProps {
    guardian: Guardian;
    schoolData: SchoolData | null;
    isOpen: boolean;
    onClose: () => void;
}

export const GuardianDetailsDialog = ({ guardian, schoolData, isOpen, onClose }: GuardianDetailsDialogProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [deletingGuardian, setDeletingGuardian] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [migratingStudent, setMigratingStudent] = useState<Student | null>(null);
    const [newGuardianId, setNewGuardianId] = useState('');
    const [isMigrating, setIsMigrating] = useState(false);
    const [showNewGuardianForm, setShowNewGuardianForm] = useState(false);

    const financialSummary = useMemo(() => {
        if (!guardian.students || !schoolData?.financeSettings) return { byCurrency: {}, studentCount: 0 };

        const { feeCategories = [], feeItems = [], inscriptionFee = {}, paymentCategories = [] } = schoolData.financeSettings;
        const allPayments = schoolData.payments || [];

        const byCurrency: Record<string, { totalBilled: number, totalPaid: number, balance: number }> = {};
        
        const addAmount = (currency: string, billed: number, paid: number) => {
            const curr = currency || 'USD';
            if (!byCurrency[curr]) byCurrency[curr] = { totalBilled: 0, totalPaid: 0, balance: 0 };
            byCurrency[curr].totalBilled += billed;
            byCurrency[curr].totalPaid += paid;
            byCurrency[curr].balance += (billed - paid);
        };

        guardian.students.forEach((student: Student) => {
            // 1. Process Inscription Fee
            const gradeFee = (inscriptionFee as any)?.[student.gradeName];
            if (gradeFee && typeof gradeFee.amount === 'number') {
                const currency = gradeFee.currency || 'USD';
                const studentPayments = allPayments.filter((p: any) => p.studentId === student.id && p.type === 'inscription');
                const paid = studentPayments.reduce((sum: number, p: any) => sum + (p.totalAmountPaid || 0) + (p.totalDispensationAmount || 0), 0);
                addAmount(currency, gradeFee.amount, paid);
            }

            // 2. Process School Fees by Category
            let effectiveCategoryId = student.paymentCategoryId;
            if (!effectiveCategoryId && feeCategories.length > 0) {
                let level = student.level;
                if (!level && student.gradeName) {
                    if (student.gradeName.includes('Maternelle')) level = 'maternelle';
                    else if (student.gradeName.includes('Primaire') || student.gradeName.includes('Spécial')) level = 'primaire';
                    else if (student.gradeName.includes('CTEB') || student.gradeName.includes('Humanité') || student.gradeName.includes('Professionnelle')) level = 'secondaire';
                }
                const defaultCat = paymentCategories.find((c: any) => c.level === (level || 'primaire') && c.isDefault);
                if (defaultCat) effectiveCategoryId = defaultCat.id;
            }

            const studentGradesClassrooms = student.classroomName ? [student.classroomName] :
                (student.gradeName ? getClassroomsByGrade(student.level || 'primaire', student.gradeName, schoolData as any) : []);

            const applicableCategories = feeCategories.filter((cat: any) => {
                const matchesClassroom = studentGradesClassrooms.some(cn => cat.appliesTo?.includes(cn));
                const matchesCategory = !cat.paymentCategoryId || cat.paymentCategoryId === effectiveCategoryId;
                return matchesClassroom && matchesCategory;
            });

            applicableCategories.forEach((cat: any) => {
                const items = cat.feeItemIds.map((id: string) => feeItems.find((item: any) => item.id === id)).filter(Boolean);
                if (items.length === 0) return;

                const categoryCurrency = items[0].currency || 'USD';
                const isMixedCurrency = items.some((item: any) => item.currency !== categoryCurrency);
                if (isMixedCurrency) return; // Skip mixed currency categories for simplicity

                const categoryTotalBilled = items.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
                let categoryTotalPaid = 0;
                const categoryItemIds = new Set(items.map((i: any) => i.id));

                const studentScolaritePayments = allPayments.filter((p: any) => p.studentId === student.id && p.type === 'scolarite');
                studentScolaritePayments.forEach((p: any) => {
                    (p.details || []).forEach((detail: any) => {
                        if (categoryItemIds.has(detail.feeItemId || detail.feeName)) {
                            categoryTotalPaid += (detail.amountPaid || 0) + (detail.dispensationAmount || 0);
                        }
                    });
                });

                addAmount(categoryCurrency, categoryTotalBilled, categoryTotalPaid);
            });
        });

        return {
            byCurrency,
            studentCount: guardian.students.length
        };
    }, [guardian, schoolData]);

    const eligibility = useMemo(() => {
        if (financialSummary.studentCount >= 3) {
            return {
                status: 'Eligible',
                reason: '3 élèves ou plus (Tarif Famille Nombreuse)',
                color: 'text-green-600 bg-green-50 border-green-200'
            };
        }
        if (financialSummary.studentCount === 2) {
            return {
                status: 'Potentiel',
                reason: '2 élèves (Réduction fratrie possible)',
                color: 'text-amber-600 bg-amber-50 border-amber-200'
            };
        }
        return {
            status: 'Standard',
            reason: '1 élève à charge',
            color: 'text-muted-foreground bg-muted border-transparent'
        };
    }, [financialSummary.studentCount]);

    if (!guardian || !isOpen) return null;

    const handleDelete = async () => {
        if (!schoolData?.matricule) return;
        setIsDeleting(true);
        const res = await deleteGuardian(schoolData.matricule, guardian.id);
        setIsDeleting(false);
        if (res.success) {
            toast.success("Tuteur supprimé.");
            onClose(); // the list handles refresh
        } else {
            toast.error("Erreur", { description: res.error });
            setDeletingGuardian(false);
        }
    };

    const handleEditSave = async (data: any) => {
        if (!schoolData?.matricule) return { success: false, error: 'Matricule introuvable' };
        const res = await updateGuardian(schoolData.matricule, guardian.id, data);
        if (res.success) {
            toast.success("Tuteur mis à jour.");
            setIsEditing(false);
            onClose(); // Will force refresh
        }
        return res;
    };

    const handleDetachStudent = async (student: Student) => {
        if (!schoolData?.matricule) return;
        if (!confirm(`Voulez-vous vraiment retirer l'élève ${student.lastName} ${student.firstName} de ce tuteur ?`)) return;
        
        const res = await updateStudentGuardian(schoolData.matricule, student.id, null);
        if (res.success) {
            toast.success("Élève retiré du tuteur.");
            onClose(); // refresh
        } else {
            toast.error("Erreur", { description: res.error });
        }
    };

    const handleMigrateSave = async () => {
        if (!schoolData?.matricule || !migratingStudent) return;
        
        if (newGuardianId === 'new') {
            setShowNewGuardianForm(true);
            return;
        }

        if (!newGuardianId) {
            toast.error("Veuillez sélectionner un tuteur.");
            return;
        }

        setIsMigrating(true);
        const res = await updateStudentGuardian(schoolData.matricule, migratingStudent.id, newGuardianId);
        setIsMigrating(false);
        
        if (res.success) {
            toast.success("Élève migré avec succès.");
            setMigratingStudent(null);
            setNewGuardianId('');
            onClose(); // refresh
        } else {
            toast.error("Erreur", { description: res.error });
        }
    };

    const guardiansList = (schoolData?.guardians as unknown as Guardian[]) || [];
    const otherGuardiansOptions = [
        { value: "new", label: "+ Créer un nouveau tuteur" },
        ...guardiansList.filter(g => g.id !== guardian.id).map(g => ({
            value: g.id,
            label: `${g.lastName} ${g.firstName} (${g.phone})`
        }))
    ];

    return (
        <>
            <Card className="fixed inset-0 z-40 overflow-auto bg-background/80 flex items-center justify-center p-4 backdrop-blur-sm">
                <Card className="w-full max-w-3xl relative z-50 max-h-[90dvh] overflow-y-auto">
                    <CardHeader className="border-b bg-muted/20">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-2xl font-headline flex items-center gap-3">
                                    <Avatar className="h-10 w-10">
                                        <AvatarFallback className="bg-primary/10 text-primary">{getInitials(guardian.firstName, guardian.lastName)}</AvatarFallback>
                                    </Avatar>
                                    {guardian.lastName} {guardian.firstName}
                                </CardTitle>
                                <CardDescription className="mt-1">Détails du responsable et du regroupement familial</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" onClick={() => setIsEditing(true)} title="Modifier">
                                    <Edit className="h-4 w-4 text-blue-600" />
                                </Button>
                                <Button variant="outline" size="icon" className="border-red-200 hover:bg-red-50" onClick={() => setDeletingGuardian(true)} title="Supprimer" disabled={(guardian.students?.length || 0) > 0}>
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={onClose}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1 bg-muted/30 p-3 rounded-lg">
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Téléphone</span>
                                        <p className="text-sm font-medium">{guardian.phone}</p>
                                    </div>
                                    <div className="space-y-1 bg-muted/30 p-3 rounded-lg">
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email</span>
                                        <p className="text-sm font-medium truncate" title={guardian.email}>{guardian.email || '-'}</p>
                                    </div>
                                    <div className="space-y-1 col-span-2 bg-muted/30 p-3 rounded-lg">
                                        <span className="text-muted-foreground text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> Adresse</span>
                                        <p className="text-sm font-medium">{guardian.address}</p>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-lg border ${eligibility.color}`}>
                                    <h4 className="text-xs font-bold uppercase tracking-wider mb-2">Éligibilité Financière</h4>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm font-semibold">{eligibility.status}</p>
                                        <p className="text-xs">{eligibility.reason}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4 shadow-sm">
                                <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-2">
                                    <Wallet className="h-4 w-4" /> Résumé Financier (Groupe)
                                </h4>
                                <div className="space-y-4">
                                    {Object.entries(financialSummary.byCurrency).length === 0 ? (
                                        <div className="text-sm text-indigo-600">Aucun frais calculé.</div>
                                    ) : (
                                        Object.entries(financialSummary.byCurrency).map(([currency, data]) => (
                                            <div key={currency} className="space-y-2 bg-white/50 p-3 rounded-lg border border-indigo-100">
                                                <h5 className="font-bold text-indigo-900 text-sm">{currency}</h5>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-indigo-600 font-medium">Total Facturé</span>
                                                    <span className="font-bold">{(data.totalBilled || 0).toLocaleString()} {currency}</span>
                                                </div>
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-indigo-600 font-medium">Total Payé</span>
                                                    <span className="font-bold text-green-600">-{(data.totalPaid || 0).toLocaleString()} {currency}</span>
                                                </div>
                                                <Separator className="bg-indigo-200 my-1" />
                                                <div className="flex justify-between text-base font-black">
                                                    <span className="text-indigo-900">SOLDE</span>
                                                    <span className={(data.balance || 0) > 0 ? "text-red-600" : "text-emerald-600"}>
                                                        {(data.balance || 0).toLocaleString()} {currency}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator />

                        <div>
                            <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" /> Élèves à charge ({guardian.students?.length || 0})</h3>
                            {guardian.students && guardian.students.length > 0 ? (
                                <div className="max-h-[300px] overflow-auto space-y-3 pr-2">
                                    {guardian.students.map((student: Student) => (
                                        <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl hover:bg-muted/30 transition-colors bg-card shadow-sm gap-4">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border">
                                                    <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-bold text-primary">{student.lastName} {student.firstName}</p>
                                                    <p className="text-xs text-muted-foreground">{student.gradeName} • {student.classroomName || 'Non affecté'}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={student.status === 'active' ? 'outline' : 'destructive'} className="mr-2">
                                                    {student.status === 'active' ? 'Actif' : 'En attente'}
                                                </Badge>
                                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setMigratingStudent(student)}>
                                                    <RefreshCw className="h-3 w-3 mr-1" /> Migrer
                                                </Button>
                                                <Button variant="outline" size="sm" className="h-8 text-xs text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleDetachStudent(student)}>
                                                    <LogOut className="h-3 w-3 mr-1" /> Retirer
                                                </Button>
                                                <Link href={`/students/${student.id}`} onClick={onClose}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                    </Button>
                                                </Link>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                    Aucun élève rattaché à ce tuteur.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </Card>

            {isEditing && (
                <GuardianForm
                    initialData={guardian}
                    onClose={() => setIsEditing(false)}
                    onSave={handleEditSave}
                />
            )}

            {deletingGuardian && (
                <AlertDialog open={deletingGuardian} onOpenChange={setDeletingGuardian}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer ce tuteur ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Êtes-vous sûr de vouloir supprimer définitivement le tuteur <strong>{guardian.lastName} {guardian.firstName}</strong> ?
                                Cette action est irréversible.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Supprimer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {migratingStudent && (
                <AlertDialog open={!!migratingStudent} onOpenChange={(open) => !open && setMigratingStudent(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Migrer l'élève</AlertDialogTitle>
                            <AlertDialogDescription>
                                Transférez l'élève <strong>{migratingStudent.lastName} {migratingStudent.firstName}</strong> vers un autre tuteur ou créez-en un nouveau.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="py-4">
                            <Label className="mb-2 block">Sélectionnez le nouveau tuteur</Label>
                            <Combobox
                                items={otherGuardiansOptions}
                                value={newGuardianId}
                                onChange={(val) => setNewGuardianId(val || '')}
                                placeholder="Choisir un tuteur..."
                                searchPlaceholder="Rechercher par nom..."
                                triggerClass="w-full"
                            />
                        </div>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isMigrating}>Annuler</AlertDialogCancel>
                            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleMigrateSave(); }} disabled={isMigrating}>
                                Continuer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}

            {showNewGuardianForm && migratingStudent && schoolData && (
                <GuardianForm
                    onClose={() => setShowNewGuardianForm(false)}
                    onSave={async (data) => {
                        setIsMigrating(true);
                        const res = await updateStudentGuardian(schoolData.matricule, migratingStudent.id, 'new', data);
                        setIsMigrating(false);
                        if (res.success) {
                            toast.success("Élève migré vers un nouveau tuteur avec succès.");
                            setShowNewGuardianForm(false);
                            setMigratingStudent(null);
                            setNewGuardianId('');
                            onClose(); // refresh
                        } else {
                            toast.error("Erreur lors de la migration", { description: res.error });
                        }
                        return res;
                    }}
                />
            )}
        </>
    );
};
