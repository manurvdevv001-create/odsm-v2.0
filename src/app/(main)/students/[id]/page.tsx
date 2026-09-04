// src/app/(main)/students/[id]/page.tsx
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { updateStudentData, updateStudentGuardian } from '../actions';
import { Loader2, ArrowLeft, User, Wallet, FileText, Calendar, Hash, Tag, Edit, Save, X, School, Printer, Camera, ShieldCheck, ArrowRight, Trash2 } from 'lucide-react';
import { GuardianDetailsDialog } from '@/components/guardian-details-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { PaymentReceiptDialog } from '@/components/finance/payment-receipt-dialog';
import { StudentTransferDialog } from '@/components/student-transfer-dialog';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import { toast } from 'sonner';
import { Student, Payment, FeeItem, FeeCategory } from '@/types';
import { getInitials, cn } from '@/lib/utils';

import { getClassroomsByLevel, getAllGrades, getClassroomsByGrade } from '@/lib/classroom-utils';



import { useSchoolData } from "@/components/providers/SchoolDataProvider";

export default function StudentDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { schoolData: rawSchoolData, isLoading: isSchoolLoading, refreshData, selectedYear } = useSchoolData();
    const schoolData = rawSchoolData as any;
    const studentId = params.id as string;
    const photoInputRef = useRef<HTMLInputElement>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editData, setEditData] = useState<Partial<Student>>({});
    const searchParams = useSearchParams();
    const editModeParam = searchParams.get('edit') === 'true';
    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
    const [showGuardianDetails, setShowGuardianDetails] = useState(false);
    const [isAssigningTutor, setIsAssigningTutor] = useState(false);
    const [selectedTutorId, setSelectedTutorId] = useState('');
    const [showTransferDialog, setShowTransferDialog] = useState(false);

    const handleAssignTutor = async () => {
        if (!selectedTutorId || !student) return;
        setIsAssigningTutor(true);
        const matricule = localStorage.getItem('odsm-matricule');
        if (matricule) {
            const res = await updateStudentGuardian(matricule, student.id, selectedTutorId);
            if (res.success) {
                toast.success('Tuteur assigné avec succès.');
                refreshData();
                setSelectedTutorId('');
            } else {
                toast.error('Erreur', { description: res.error });
            }
        }
        setIsAssigningTutor(false);
    };

    const student = useMemo(() => {
        return (schoolData as any)?.students?.find((s: any) => s.id === studentId) || null;
    }, [schoolData, studentId]);

    useEffect(() => {
        if (student && !isEditing) {
            setEditData(student);
            if (editModeParam) {
                setIsEditing(true);
            }
        }
    }, [student, isEditing, editModeParam]);

    // Check read-only mode
    const isReadOnly = selectedYear && (schoolData as any)?.calendar?.schoolYear && selectedYear !== (schoolData as any).calendar.schoolYear;

    const handleEditToggle = () => {
        if (isEditing) {
            setEditData(student || {});
        }
        setIsEditing(!isEditing);
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    }

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setEditData(prev => ({ ...prev, photo: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };


    const handleSelectChange = (name: string, value: string | undefined) => {
        setEditData(prev => ({ ...prev, [name]: value === "null" ? undefined : value }));
    };

    const handleSave = async () => {
        if (!student) return;
        setIsSaving(true);
        const matricule = localStorage.getItem('odsm-matricule');
        if (matricule) {
            const result = await updateStudentData(matricule, student.id, editData);
            if (result.success) {
                toast('Succès', { description: 'Fiche élève mise à jour.' });
                refreshData();
                setIsEditing(false);
            } else {
                toast('Erreur', { description: result.error });
            }
        }
        setIsSaving(false);
    }

    const financialSummary = useMemo(() => {
        if (!student || !schoolData?.financeSettings) {
            return { byCategory: [], byCurrency: {} };
        }

        const { feeCategories = [], feeItems = [], inscriptionFee, paymentCategories = [] } = (schoolData as any).financeSettings;
        const studentPayments: Payment[] = (schoolData as any).payments?.filter((p: Payment) => p.studentId === student.id) || [];

        const summaryByCategory: { name: string; currency: string; totalBilled: number; totalPaid: number; balance: number }[] = [];

        // 1. Process Inscription Fee
        const inscriptionFeeConfig = (inscriptionFee as any)?.[student.gradeName];
        if (inscriptionFeeConfig && Number(inscriptionFeeConfig.amount) > 0) {
            const inscriptionPayments = studentPayments.filter(p => p.type === 'inscription');
            const totalPaid = inscriptionPayments.reduce((sum, p) => sum + (p.totalAmountPaid || 0) + (p.totalDispensationAmount || 0), 0);
            summaryByCategory.push({
                name: "Frais d'Inscription",
                currency: inscriptionFeeConfig.currency,
                totalBilled: Number(inscriptionFeeConfig.amount),
                totalPaid: totalPaid,
                balance: Number(inscriptionFeeConfig.amount) - totalPaid,
            });
        }

        // 2. Process School Fees by Category
        // Determine the effective payment category ID (use default of level if student has none)
        let effectiveCategoryId = student.paymentCategoryId;
        if (!effectiveCategoryId && feeCategories.length > 0) {
            // Infer level
            let level = student.level;
            if (!level && student.gradeName) {
                if (student.gradeName.includes('Maternelle')) level = 'maternelle';
                else if (student.gradeName.includes('Primaire') || student.gradeName.includes('Spécial')) level = 'primaire';
                else if (student.gradeName.includes('CTEB') || student.gradeName.includes('Humanité') || student.gradeName.includes('Professionnelle')) level = 'secondaire';
            }
            const defaultCat = paymentCategories.find((c: any) => c.level === (level || 'primaire') && c.isDefault);
            if (defaultCat) effectiveCategoryId = defaultCat.id;
        }

        // Even if not assigned to a specific classroom, we should check fees for their grade
        const studentGradesClassrooms = student.classroomName ? [student.classroomName] :
            (student.gradeName ? getClassroomsByGrade(student.level || 'primaire', student.gradeName, schoolData as any) : []);

        const applicableCategories = feeCategories.filter((cat: FeeCategory) => {
            const matchesClassroom = studentGradesClassrooms.some(cn => cat.appliesTo.includes(cn));
            // Logic: A fee rubrique applies if:
            // 1. It belongs to the same classroom (or any classroom of the same grade if student not yet assigned)
            // 2. AND (it has no category OR it matches student's effective category)
            const matchesCategory = !cat.paymentCategoryId || cat.paymentCategoryId === effectiveCategoryId;
            return matchesClassroom && matchesCategory;
        });

        applicableCategories.forEach((cat: FeeCategory) => {
            const items = cat.feeItemIds.map((id: string) => feeItems.find((item: FeeItem) => item.id === id)).filter(Boolean) as FeeItem[];
            if (items.length === 0) return;

            const categoryCurrency = items[0].currency;
            const isMixedCurrency = items.some(item => item.currency !== categoryCurrency);
            if (isMixedCurrency) return; // Skip mixed currency categories for simplicity

            const categoryTotalBilled = items.reduce((sum, item) => sum + Number(item.amount), 0);

            let categoryTotalPaid = 0;
            const categoryItemIds = new Set(items.map(i => i.id));

            studentPayments
                .filter(p => p.type === 'scolarite')
                .forEach((p: Payment) => {
                    (p.details || []).forEach((detail: any) => {
                        if (categoryItemIds.has(detail.feeItemId)) {
                            categoryTotalPaid += (detail.amountPaid || 0) + (detail.dispensationAmount || 0);
                        }
                    });
                });

            summaryByCategory.push({
                name: cat.name,
                currency: categoryCurrency,
                totalBilled: categoryTotalBilled,
                totalPaid: categoryTotalPaid,
                balance: categoryTotalBilled - categoryTotalPaid,
            });
        });

        // 3. Aggregate totals by currency for the overall summary
        const summaryByCurrency: Record<string, { totalBilled: number; totalPaid: number; balance: number }> = {};
        summaryByCategory.forEach(catSummary => {
            if (!summaryByCurrency[catSummary.currency]) {
                summaryByCurrency[catSummary.currency] = { totalBilled: 0, totalPaid: 0, balance: 0 };
            }
            summaryByCurrency[catSummary.currency].totalBilled += catSummary.totalBilled;
            summaryByCurrency[catSummary.currency].totalPaid += catSummary.totalPaid;
            summaryByCurrency[catSummary.currency].balance += catSummary.balance;
        });

        return { byCategory: summaryByCategory, byCurrency: summaryByCurrency };
    }, [student, schoolData]);

    const guardian = useMemo(() => {
        if (!student?.guardianId || !schoolData?.guardians) return null;
        return schoolData.guardians.find((g: any) => g.id === student.guardianId);
    }, [student, schoolData]);

    const studentPayments = useMemo(() => {
        if (!student || !(schoolData as any)?.payments) return [];
        return (schoolData as any).payments
            .filter((p: Payment) => p.studentId === student.id)
            .sort((a: Payment, b: Payment) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [student, schoolData]);

    const availableGrades = useMemo(() => {
        if (!(schoolData as any)?.levels) return [];
        return getAllGrades(schoolData as any);
    }, [schoolData]);

    const availableClassrooms = useMemo(() => {
        if (!editData.gradeName || !(schoolData as any)?.levels || !(schoolData as any)?.structure) return [];

        for (const level of Object.keys((schoolData as any).levels)) {
            if (!(schoolData as any).levels[level]) continue;

            const classrooms = getClassroomsByGrade(level, editData.gradeName, schoolData as any);
            if (classrooms.length > 0) {
                return classrooms;
            }
        }
        return [];
    }, [editData.gradeName, schoolData]);

    if (isSchoolLoading) {
        return <div className="flex h-[60vh] w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!student) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <div className="bg-muted p-6 rounded-full">
                    <User className="h-12 w-12 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold">Élève non trouvé</h2>
                <p className="text-muted-foreground">L'élève que vous recherchez n'existe pas ou n'appartient pas à cette école.</p>
                <Button onClick={() => router.push('/students')}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Retour à la liste
                </Button>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-6 print:hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <Button variant="outline" onClick={() => router.push('/students')} className="w-full sm:w-auto">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Liste
                    </Button>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                        {isReadOnly && <Badge variant="outline" className="border-amber-500 text-amber-600 bg-amber-50">Lecture Seule</Badge>}
                        {isEditing && (
                            <>
                                <Button variant="ghost" size="sm" onClick={handleEditToggle} disabled={isSaving}>
                                    <X className="mr-2 h-4 w-4" /> Annuler
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Enregistrer
                                </Button>
                            </>
                        )}
                        {!isEditing && (
                            <>
                                <Button variant="outline" size="sm" onClick={() => setShowTransferDialog(true)} disabled={!!isReadOnly}>
                                    <ArrowRight className="mr-2 h-4 w-4" /> Transférer
                                </Button>
                                <Button size="sm" onClick={handleEditToggle} disabled={!!isReadOnly}>
                                    <Edit className="mr-2 h-4 w-4" /> Modifier
                                </Button>
                            </>
                        )}
                    </div>
                </div>

                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 text-center sm:text-left">
                        <div className="relative">
                            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 text-2xl sm:text-3xl shadow-md border-2 border-primary/10">
                                <AvatarImage src={isEditing ? editData.photo || undefined : student.photo || undefined} alt={`${student.lastName} ${student.middleName || ''} ${student.firstName}`} />
                                <AvatarFallback className="bg-primary/5 text-primary">{getInitials(student.firstName, student.lastName, student.middleName)}</AvatarFallback>
                            </Avatar>
                            {isEditing && (
                                <div
                                    className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={() => photoInputRef.current?.click()}
                                >
                                    <Camera className="w-8 h-8 text-white" />
                                </div>
                            )}
                            <Input type="file" ref={photoInputRef} className="hidden" accept="image/*" onChange={handlePhotoChange} />
                            {/* Revoke photo button */}
                            {isEditing && (editData.photo || student.photo) && (
                                <button
                                    type="button"
                                    title="Supprimer la photo"
                                    onClick={() => setEditData(prev => ({ ...prev, photo: null as any }))}
                                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors z-10"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <div className="flex-grow space-y-2">
                            {isEditing ? (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Nom</Label>
                                        <Input name="lastName" value={editData.lastName || ''} onChange={handleInputChange} placeholder="Nom" className="font-bold h-auto py-1 px-2" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Postnom</Label>
                                        <Input name="middleName" value={editData.middleName || ''} onChange={handleInputChange} placeholder="Postnom" className="font-bold h-auto py-1 px-2" />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Prénom</Label>
                                        <Input name="firstName" value={editData.firstName || ''} onChange={handleInputChange} placeholder="Prénom" className="font-bold h-auto py-1 px-2" />
                                    </div>
                                </div>
                            ) : (
                                <h1 className="text-xl sm:text-3xl font-bold font-headline leading-tight">
                                    {student.lastName} {student.middleName ? `${student.middleName} ` : ''}{student.firstName}
                                </h1>
                            )}
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    {isEditing ? (
                                        <Select name="gender" value={editData.gender} onValueChange={(v) => handleSelectChange('gender', v)}>
                                            <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="M">Masculin</SelectItem>
                                                <SelectItem value="F">Féminin</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <span>{student.gender === 'M' ? 'Masculin' : 'Féminin'}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {isEditing ? (
                                        <DatePicker
                                            value={editData.birthDate}
                                            onChange={(date) => handleSelectChange('birthDate', date)}
                                            placeholder="jj/mm/aaaa"
                                        />
                                    ) : (
                                        <span>Né(e) le {student.birthDate ? new Date(student.birthDate).toLocaleDateString('fr-FR') : 'Non définie'}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 pt-1">
                                <Badge
                                    variant={student.status === 'active' ? 'secondary' : student.status === 'pending_enrollment' ? 'outline' : 'destructive'}
                                    className={cn("text-sm",
                                        student.status === 'pending_enrollment' && "border-amber-400 bg-amber-50 text-amber-700",
                                        student.status === 'excluded' && "border-rose-400 bg-rose-50 text-rose-700"
                                    )}
                                >
                                    {student.status === 'active' ? 'Actif'
                                        : student.status === 'pending_enrollment' ? 'En attente d\'inscription'
                                        : student.status === 'excluded' ? 'Exclu / Retiré'
                                        : 'En attente de paiement'}
                                </Badge>

                                <div className="flex items-center gap-2 font-semibold">
                                    <Tag className="w-4 h-4 text-primary" />
                                    {isEditing ? (
                                        <>
                                            <Select name="gradeName" value={editData.gradeName} onValueChange={(v) => handleSelectChange('gradeName', v)}>
                                                <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {(availableGrades as string[]).map((grade: string) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </>
                                    ) : (
                                        <span>{student.gradeName}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 font-semibold">
                                    <School className="w-4 h-4 text-primary" />
                                    {isEditing ? (
                                        <Select name="classroomName" value={editData.classroomName} onValueChange={(v) => handleSelectChange('classroomName', v)} disabled={!editData.gradeName}>
                                            <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Non affecté" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="null">Non affecté</SelectItem>
                                                {availableClassrooms.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        student.classroomName ? <span>{student.classroomName}</span> : <span className="text-muted-foreground italic">Non affecté</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 font-semibold pt-1">
                                <Hash className="w-4 h-4 text-primary" />
                                <span className="font-mono text-sm">{student.matricule}</span>
                            </div>
                        </div>
                    </CardHeader>
                </Card>

                {guardian ? (
                    <Card className="border-indigo-100 bg-indigo-50/30">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-indigo-100 p-2 rounded-full">
                                    <ShieldCheck className="h-6 w-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-indigo-600 font-bold uppercase tracking-wider">Tuteur Responsable</p>
                                    <p className="font-headline font-bold text-lg">{guardian.lastName} {guardian.firstName}</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={() => setShowGuardianDetails(true)}>
                                Voir le profil du tuteur <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="border-amber-100 bg-amber-50/30">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-amber-100 p-2 rounded-full">
                                    <ShieldCheck className="h-6 w-6 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Tuteur Responsable</p>
                                    <p className="text-sm text-muted-foreground mt-1">Aucun tuteur assigné</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Combobox
                                    items={((schoolData as any)?.guardians || []).map((g: any) => ({
                                        value: g.id,
                                        label: `${g.lastName} ${g.firstName} (${g.phone})`
                                    }))}
                                    value={selectedTutorId}
                                    onChange={(v) => setSelectedTutorId(v || '')}
                                    placeholder="Sélectionner un tuteur..."
                                    triggerClass="min-w-[200px]"
                                />
                                <Button size="sm" onClick={handleAssignTutor} disabled={!selectedTutorId || isAssigningTutor}>
                                    {isAssigningTutor ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assigner'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Wallet /> Résumé Financier</CardTitle>
                            <CardDescription>Aperçu détaillé des frais et paiements.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {financialSummary.byCategory.length === 0 ? (
                                <p className="text-muted-foreground text-sm">Aucun frais applicable pour le moment.</p>
                            ) : (
                                <div className="space-y-4">
                                    {financialSummary.byCategory.map((category, index) => (
                                        <div key={index} className="space-y-1 text-sm">
                                            <h4 className="font-semibold">{category.name}</h4>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Facturé:</span>
                                                <span>{(category.totalBilled || 0).toLocaleString()} {category.currency}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Payé:</span>
                                                <span className="text-green-600">{(category.totalPaid || 0).toLocaleString()} {category.currency}</span>
                                            </div>
                                            <div className="flex justify-between font-bold">
                                                <span>Solde:</span>
                                                <span className={category.balance > 0 ? 'text-destructive' : 'text-green-700'}>{(category.balance || 0).toLocaleString()} {category.currency}</span>
                                            </div>
                                        </div>
                                    ))}

                                    <Separator className="my-4" />

                                    <div className="space-y-2">
                                        <h3 className="font-semibold text-base">Totaux par devise</h3>
                                        {Object.keys(financialSummary.byCurrency).length > 0 ? Object.entries(financialSummary.byCurrency).map(([currency, summary]) => (
                                            <div key={currency} className="p-3 border rounded-lg bg-muted/30">
                                                <h4 className="font-bold text-lg mb-2 text-primary">{currency}</h4>
                                                <div className="space-y-1 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Total à payer:</span>
                                                        <span>{(summary.totalBilled || 0).toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-muted-foreground">Total payé:</span>
                                                        <span className="text-green-600">{(summary.totalPaid || 0).toLocaleString()}</span>
                                                    </div>
                                                    <Separator className="my-2" />
                                                    <div className="flex justify-between font-bold">
                                                        <span>Solde restant:</span>
                                                        <span className={summary.balance > 0 ? 'text-destructive' : 'text-green-700'}>
                                                            {(summary.balance || 0).toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )) : <p className="text-muted-foreground text-sm">Aucun frais calculé.</p>}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><FileText /> Historique des Paiements</CardTitle>
                            <CardDescription>Liste de toutes les transactions financières pour cet élève.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="hidden md:block">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Libellé</TableHead>
                                            <TableHead className="text-right">Montant</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {studentPayments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center h-24 text-muted-foreground">Aucune transaction trouvée</TableCell>
                                            </TableRow>
                                        ) : (
                                            studentPayments.map((p: Payment) => {
                                                const getPaymentLabel = () => {
                                                    if (p.type === 'inscription') return "Frais d'Inscription";

                                                    const feeItems = (schoolData as any)?.financeSettings?.feeItems || [];
                                                    const feeNames = (p.details || []).map((detail: any) =>
                                                        feeItems.find((fi: FeeItem) => fi.id === detail.feeItemId)?.name
                                                    ).filter(Boolean);

                                                    if (feeNames.length > 1) {
                                                        return `Paiement groupé (${feeNames.length} frais)`;
                                                    }
                                                    return feeNames[0] || 'Frais Scolaire';
                                                }

                                                const paymentLabel = getPaymentLabel();

                                                return (
                                                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted" onClick={() => setSelectedPayment(p)}>
                                                        <TableCell>{new Date(p.date).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(' ', ' - ')}</TableCell>
                                                        <TableCell>
                                                            <div className="font-medium">{paymentLabel}</div>
                                                            {(p.totalDispensationAmount || 0) > 0 &&
                                                                <div className="text-xs text-muted-foreground">
                                                                    (Dispense de {(p.totalDispensationAmount || 0).toLocaleString()} {p.currency} incluse)
                                                                </div>
                                                            }
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold">{(p.totalAmountPaid || 0).toLocaleString()} {p.currency}</TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="md:hidden space-y-3">
                                {studentPayments.length === 0 ? (
                                    <p className="text-center py-8 text-muted-foreground">Aucune transaction.</p>
                                ) : (
                                    studentPayments.map((p: Payment) => {
                                        const getPaymentLabel = () => {
                                            if (p.type === 'inscription') return "Inscription";
                                            const feeItems = (schoolData as any)?.financeSettings?.feeItems || [];
                                            const feeNames = (p.details || []).map((detail: any) =>
                                                feeItems.find((fi: FeeItem) => fi.id === detail.feeItemId)?.name
                                            ).filter(Boolean);
                                            if (feeNames.length > 1) return `${feeNames.length} frais`;
                                            return feeNames[0] || 'Frais';
                                        }
                                        return (
                                            <div key={p.id} className="p-3 border rounded-lg bg-card shadow-sm space-y-2" onClick={() => setSelectedPayment(p)}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-bold text-sm">{getPaymentLabel()}</p>
                                                        <p className="text-[10px] text-muted-foreground">{new Date(p.date).toLocaleDateString('fr-FR')}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-primary">{(p.totalAmountPaid || 0).toLocaleString()} <span className="text-[10px]">{p.currency}</span></p>
                                                        {(p.totalDispensationAmount || 0) > 0 && <p className="text-[9px] text-green-600">Disp. incluse</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {selectedPayment && (
                <PaymentReceiptDialog
                    isOpen={!!selectedPayment}
                    onClose={() => setSelectedPayment(null)}
                    payment={selectedPayment}
                    student={student}
                    schoolData={schoolData}
                />
            )}

            {showTransferDialog && student && (
                <StudentTransferDialog
                    student={student}
                    open={showTransferDialog}
                    onOpenChange={setShowTransferDialog}
                    onSuccess={() => {
                        refreshData();
                    }}
                />
            )}

            {showGuardianDetails && guardian && (
                <GuardianDetailsDialog
                    isOpen={showGuardianDetails}
                    onClose={() => setShowGuardianDetails(false)}
                    guardian={guardian}
                    schoolData={schoolData}
                />
            )}
        </>
    );
}
