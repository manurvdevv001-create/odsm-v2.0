// src/app/(main)/students/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, Users, Wallet, Search, X, Phone, Mail, MapPin, ArrowRight, Trash2, Edit, AlertCircle } from 'lucide-react';
import StudentRegistrationForm from '@/components/student-registration-form';
import { saveStudentData, updateStudentPaymentStatus, deleteStudent } from './actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InscriptionPaymentDialog } from '@/components/inscription-payment-dialog';
import { GuardianForm } from '@/components/guardian-form';
import { TuteurStats } from '@/components/tuteur-stats';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { Student, SchoolData } from '@/types';
import { getInitials } from '@/lib/utils';
import { GuardianDetailsDialog } from '@/components/guardian-details-dialog';
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
import { toast } from 'sonner';

import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

type SortConfig = {
    key: keyof Student | 'fullName';
    direction: 'asc' | 'desc';
} | null;

const StudentList = ({
    students,
    onPay,
    onEdit,
    onDelete,
    sortConfig,
    onSort,
    activeYear,
    readOnly
}: {
    students: Student[],
    onPay: (student: Student) => void,
    onEdit: (student: Student) => void,
    onDelete: (student: Student) => void,
    sortConfig: SortConfig,
    onSort: (key: keyof Student | 'fullName') => void,
    activeYear?: string | null,
    readOnly?: boolean
}) => {
    if (students.length === 0) {
        return <p className="text-center text-muted-foreground py-8">Aucun élève dans cette liste.</p>;
    }

    const renderSortIcon = (columnKey: keyof Student | 'fullName') => {
        if (sortConfig?.key !== columnKey) {
            return <ArrowUpDown className="ml-2 h-4 w-4" />;
        }
        return sortConfig.direction === 'asc' ?
            <ArrowUp className="ml-2 h-4 w-4" /> :
            <ArrowDown className="ml-2 h-4 w-4" />;
    };

    return (
        <div className="space-y-4">
            {/* PC View: Table */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[80px]">Photo</TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onSort('matricule')}
                            >
                                <div className="flex items-center">
                                    No. Élève
                                    <span className="ml-1 text-muted-foreground">
                                        {renderSortIcon('matricule')}
                                    </span>
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onSort('fullName')}
                            >
                                <div className="flex items-center">
                                    Nom Complet
                                    {renderSortIcon('fullName')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onSort('gradeName')}
                            >
                                <div className="flex items-center">
                                    Grade
                                    {renderSortIcon('gradeName')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onSort('classroomName')}
                            >
                                <div className="flex items-center">
                                    Local
                                    {renderSortIcon('classroomName')}
                                </div>
                            </TableHead>
                            <TableHead
                                className="cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => onSort('status')}
                            >
                                <div className="flex items-center">
                                    Statut
                                    {renderSortIcon('status')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map((student) => (
                            <TableRow key={student.id}>
                                <TableCell>
                                    <Avatar>
                                        <AvatarImage src={student.photo || undefined} alt={`${student.lastName} ${student.middleName || ''} ${student.firstName}`} />
                                        <AvatarFallback>{getInitials(student.firstName, student.lastName, student.middleName)}</AvatarFallback>
                                    </Avatar>
                                </TableCell>
                                <TableCell className="font-mono text-xs">{student.matricule}</TableCell>
                                <TableCell className="font-medium">
                                    <Link href={`/students/${student.id}`} className="hover:underline text-primary">
                                        {student.lastName} {student.middleName ? `${student.middleName} ` : ''}{student.firstName}
                                    </Link>
                                </TableCell>
                                <TableCell>{student.gradeName}</TableCell>
                                <TableCell>{student.classroomName || <span className="text-muted-foreground">Non affecté</span>}</TableCell>
                                <TableCell>
                                    <Badge variant={student.status === 'active' ? 'secondary' : 'destructive'}>
                                        {student.status === 'active' ? 'Actif' : 'En attente'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        {student.status === 'pending_payment' && !(student.schoolYear && activeYear && student.schoolYear !== activeYear) && !readOnly && (
                                            <Button variant="outline" size="sm" onClick={() => onPay(student)} title="Effectuer le paiement">
                                                <Wallet className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="sm" onClick={() => onEdit(student)} title="Modifier" disabled={!!(student.schoolYear && activeYear && student.schoolYear !== activeYear) || !!readOnly}>
                                            <Edit className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                        <Button variant="ghost" size="sm" onClick={() => onDelete(student)} title="Supprimer" disabled={!!(student.schoolYear && activeYear && student.schoolYear !== activeYear) || !!readOnly}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile View: Cards */}
            <div className="md:hidden space-y-4">
                {students.map((student) => (
                    <div key={student.id} className="p-4 border rounded-xl bg-card space-y-3 shadow-sm">
                        <div className="flex items-center gap-3">
                            <Avatar>
                                <AvatarImage src={student.photo || undefined} />
                                <AvatarFallback>{getInitials(student.firstName, student.lastName, student.middleName)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <Link href={`/students/${student.id}`} className="font-bold text-primary block truncate">
                                    {student.lastName} {student.firstName}
                                </Link>
                                <p className="text-xs text-muted-foreground font-mono">{student.matricule}</p>
                            </div>
                            <Badge variant={student.status === 'active' ? 'outline' : 'destructive'} className="h-6">
                                {student.status === 'active' ? 'Actif' : 'Incomplet'}
                            </Badge>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground">Grade:</span>
                            <span className="font-medium">{student.gradeName}</span>
                        </div>
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-muted-foreground">Classe:</span>
                            <span className="font-medium">{student.classroomName || 'Non affecté'}</span>
                        </div>
                        {student.status === 'pending_payment' && !(student.schoolYear && activeYear && student.schoolYear !== activeYear) && !readOnly && (
                            <Button className="w-full mt-2" size="sm" onClick={() => onPay(student)}>
                                <Wallet className="mr-2 h-4 w-4" />
                                Effectuer le paiement
                            </Button>
                        )}
                        <div className="flex justify-between items-center gap-2 pt-2 border-t">
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => onEdit(student)} disabled={!!(student.schoolYear && activeYear && student.schoolYear !== activeYear) || !!readOnly}>
                                    <Edit className="h-4 w-4 mr-1" /> Modifier
                                </Button>
                                <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10" onClick={() => onDelete(student)} disabled={!!(student.schoolYear && activeYear && student.schoolYear !== activeYear) || !!readOnly}>
                                    <Trash2 className="h-4 w-4 mr-1" /> Supprimer
                                </Button>
                            </div>
                            <Link href={`/students/${student.id}`}>
                                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                                    Dossier <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


const TuteurList = ({ guardians, schoolData, onRefresh }: { guardians: any[], schoolData: SchoolData | null, onRefresh: () => void }) => {
    const [selectedGuardian, setSelectedGuardian] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const filteredGuardians = useMemo(() => {
        if (!searchTerm) return guardians;
        const lowerTerm = searchTerm.toLowerCase();
        return guardians.filter(g => 
            g.firstName.toLowerCase().includes(lowerTerm) || 
            g.lastName.toLowerCase().includes(lowerTerm) || 
            (g.phone && g.phone.toLowerCase().includes(lowerTerm)) || 
            (g.address && g.address.toLowerCase().includes(lowerTerm))
        );
    }, [guardians, searchTerm]);

    return (
        <div className="space-y-4">
            <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    type="search"
                    placeholder="Rechercher par nom, téléphone, adresse..."
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            {filteredGuardians.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Aucun tuteur trouvé.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nom Complet</TableHead>
                            <TableHead>Téléphone</TableHead>
                            <TableHead>Adresse</TableHead>
                            <TableHead className="text-center">Élèves à charge</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredGuardians.map((guardian) => (
                            <TableRow key={guardian.id} className="group hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedGuardian(guardian)}>
                                <TableCell className="font-medium flex items-center gap-2">
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback className="bg-indigo-100 text-indigo-700">{getInitials(guardian.firstName, guardian.lastName)}</AvatarFallback>
                                    </Avatar>
                                    {guardian.lastName} {guardian.firstName}
                                </TableCell>
                                <TableCell>{guardian.phone}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{guardian.address}</TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary" className="px-2">
                                        {guardian.students?.length || 0}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button variant="ghost" size="sm" className="text-primary h-8">
                                        Détails <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            {selectedGuardian && (
                <GuardianDetailsDialog
                    guardian={selectedGuardian}
                    schoolData={schoolData}
                    isOpen={!!selectedGuardian}
                    onClose={() => {
                        setSelectedGuardian(null);
                        onRefresh();
                    }}
                />
            )}
        </div>
    );
};




export default function StudentsPage() {
    const [showForm, setShowForm] = useState(false);
    const [showGuardianForm, setShowGuardianForm] = useState(false);
    const { schoolData: layoutData, refreshData: refreshLayout, selectedYear, user, yearState } = useSchoolData();
    const executorName = user?.name || "Administrateur";
    
    // Get school data directly from layout context to avoid redundant fetching
    const schoolData = layoutData as unknown as SchoolData;

    // Check if we are in read-only mode (Draft/Archive) for daily operations
    const isReadOnly = yearState !== "active";

    const router = useRouter();
    const [activeTab, setActiveTab] = useState('all');
    const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
    const [deletingStudent, setDeletingStudent] = useState<Student | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const handleEditStudent = (student: Student) => {
        router.push(`/students/${student.id}?edit=true`);
    };

    const handleDeleteClick = (student: Student) => {
        setDeletingStudent(student);
    };

    const confirmDelete = async () => {
        if (!deletingStudent || !schoolData?.matricule) return;
        
        setIsDeleting(true);
        const res = await deleteStudent(schoolData.matricule, deletingStudent.id, executorName);
        if (res.success) {
            toast.success("Supprimé", { description: "L'élève a été supprimé avec succès." });
            refreshLayout(); // Refresh global data
        } else {
            toast.error("Erreur", { description: res.error || "Impossible de supprimer l'élève." });
        }
        setIsDeleting(false);
        setDeletingStudent(null);
    };

    const handleFormClose = () => {
        setShowForm(false);
        refreshLayout(); // Refresh layout for any global config changes/data updates
    };

    const handlePaymentDialogClose = () => {
        setPaymentStudent(null);
        refreshLayout();
    }

    const handleSort = (key: keyof Student | 'fullName') => {
        setSortConfig(current => {
            if (current?.key === key) {
                return {
                    key,
                    direction: current.direction === 'asc' ? 'desc' : 'asc'
                };
            }
            return { key, direction: 'asc' };
        });
    };

    const students: Student[] = useMemo(() => schoolData?.students || [], [schoolData]);

    const filteredStudents = useMemo(() => {
        let result = [...students];

        // 1. Filter
        if (searchTerm) {
            const lowercasedTerm = searchTerm.toLowerCase();
            result = result.filter(student => {
                const studentName = `${student.firstName} ${student.lastName} ${student.middleName || ''}`.toLowerCase();
                return (
                    student.matricule?.toLowerCase().includes(lowercasedTerm) ||
                    studentName.includes(lowercasedTerm) ||
                    student.classroomName?.toLowerCase().includes(lowercasedTerm) ||
                    student.gradeName?.toLowerCase().includes(lowercasedTerm)
                );
            });
        }

        // 2. Sort
        if (sortConfig) {
            result.sort((a, b) => {
                let aValue: any;
                let bValue: any;

                if (sortConfig.key === 'fullName') {
                    aValue = `${a.lastName} ${a.firstName}`;
                    bValue = `${b.lastName} ${b.firstName}`;
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }

                // Handle null/undefined values
                if (aValue === bValue) return 0;
                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
                return sortConfig.direction === 'asc' ? comparison : -comparison;
            });
        }

        return result;
    }, [students, searchTerm, sortConfig]);

    const pendingPaymentStudents = useMemo(() => filteredStudents.filter(s => s.status === 'pending_payment'), [filteredStudents]);
    const pendingAllocationStudents = useMemo(() => filteredStudents.filter(s => s.status === 'active' && !s.classroomName), [filteredStudents]);
    const pendingEnrollmentStudents = useMemo(() => filteredStudents.filter(s => s.status === 'pending_enrollment'), [filteredStudents]);

    if (!schoolData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Chargement de la liste des élèves...</p>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-8">
                {showForm ? (
                    <StudentRegistrationForm
                        schoolData={schoolData as any}
                        onClose={handleFormClose}
                        onSave={async (matricule, studentData, paymentData) => {
                            const result = await saveStudentData(matricule, studentData, paymentData, executorName);
                            if (result?.success) {
                                refreshLayout();
                            }
                            return result || { success: false, error: 'Aucune réponse du serveur.' };
                        }}
                    />
                ) : (
                    <>
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Gestion des élèves</h1>
                                <p className="text-muted-foreground text-sm sm:text-base">Inscrivez, consultez et gérez les élèves.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {isReadOnly && <Badge variant="outline" className="h-9 border-amber-500 text-amber-600 bg-amber-50">Mode Lecture Seule</Badge>}
                                <Button onClick={() => setShowForm(true)} disabled={!!isReadOnly} className="w-full sm:w-auto">
                                    <PlusCircle className="mr-2 h-4 w-4" /> Inscrire
                                </Button>
                            </div>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Rechercher par nom, matricule, grade, local..."
                                className="pl-10 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Tabs defaultValue="all" className="w-full">
                            <TabsList className="w-full flex justify-start h-auto p-1 bg-muted/50 overflow-x-auto no-scrollbar whitespace-nowrap">
                                <TabsTrigger value="all" className="flex-shrink-0">
                                    <Users className="mr-2 h-4 w-4" /> Tous ({filteredStudents.length})
                                </TabsTrigger>
                                <TabsTrigger value="pending_payment" className="text-destructive flex-shrink-0">
                                    À payer ({pendingPaymentStudents.length})
                                </TabsTrigger>
                                <TabsTrigger value="pending_allocation" className="text-blue-600 flex-shrink-0">
                                    Affectation ({pendingAllocationStudents.length})
                                </TabsTrigger>
                                {pendingEnrollmentStudents.length > 0 && (
                                    <TabsTrigger value="pending_enrollment" className="text-amber-600 flex-shrink-0">
                                        En attente d'inscription ({pendingEnrollmentStudents.length})
                                    </TabsTrigger>
                                )}
                                <TabsTrigger value="tuteurs" className="text-indigo-600 flex-shrink-0">
                                    Tuteurs ({(schoolData as any)?.guardians?.length || 0})
                                </TabsTrigger>
                            </TabsList>
                            <Card className="mt-2">
                                <TabsContent value="all" className="m-0">
                                    <CardHeader>
                                        <CardTitle>Liste de tous les élèves</CardTitle>
                                        <CardDescription>Retrouvez ici l'ensemble des élèves inscrits, qu'ils soient actifs ou en attente.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <StudentList
                                            students={filteredStudents}
                                            onPay={setPaymentStudent}
                                            onEdit={handleEditStudent}
                                            onDelete={handleDeleteClick}
                                            sortConfig={sortConfig}
                                            onSort={handleSort}
                                            activeYear={(schoolData as any)?.activeYear || null}
                                            readOnly={isReadOnly}
                                        />
                                    </CardContent>
                                </TabsContent>
                                <TabsContent value="pending_payment" className="m-0">
                                    <CardHeader>
                                        <CardTitle>Élèves en attente de paiement des frais d'inscription</CardTitle>
                                        <CardDescription>Ces élèves ont été enregistrés mais doivent finaliser leur paiement pour devenir actifs.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <StudentList
                                            students={pendingPaymentStudents}
                                            onPay={setPaymentStudent}
                                            onEdit={handleEditStudent}
                                            onDelete={handleDeleteClick}
                                            sortConfig={sortConfig}
                                            onSort={handleSort}
                                        />
                                    </CardContent>
                                </TabsContent>
                                <TabsContent value="pending_allocation" className="m-0">
                                    <CardHeader>
                                        <CardTitle>Élèves en attente d'affectation</CardTitle>
                                        <CardDescription>Ces élèves sont actifs mais n'ont pas encore été assignés à un local de classe.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <StudentList
                                            students={pendingAllocationStudents}
                                            onPay={setPaymentStudent}
                                            onEdit={handleEditStudent}
                                            onDelete={handleDeleteClick}
                                            sortConfig={sortConfig}
                                            onSort={handleSort}
                                        />
                                    </CardContent>
                                </TabsContent>
                                {pendingEnrollmentStudents.length > 0 && (
                                    <TabsContent value="pending_enrollment" className="m-0">
                                        <CardHeader>
                                            <CardTitle>Élèves en attente d'inscription (nouvelle année)</CardTitle>
                                            <CardDescription>Ces élèves ont été promus, maintenus ou démis et attendent d'être inscrits dans leur nouveau local pour la prochaine année scolaire.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <StudentList
                                                students={pendingEnrollmentStudents}
                                                onPay={setPaymentStudent}
                                                onEdit={handleEditStudent}
                                                onDelete={handleDeleteClick}
                                                sortConfig={sortConfig}
                                                onSort={handleSort}
                                            />
                                        </CardContent>
                                    </TabsContent>
                                )}
                                <TabsContent value="tuteurs" className="m-0">
                                    <Tabs defaultValue="liste" className="w-full">
                                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                                            <TabsList>
                                                <TabsTrigger value="liste">Liste des Tuteurs</TabsTrigger>
                                                <TabsTrigger value="stats">Statistiques Financières</TabsTrigger>
                                            </TabsList>
                                            <Button size="sm" onClick={() => setShowGuardianForm(true)} disabled={!!isReadOnly}>
                                                <PlusCircle className="mr-2 h-4 w-4" /> Nouveau Tuteur
                                            </Button>
                                        </div>

                                        {(schoolData?.students?.filter((s: any) => !s.guardianId && s.status === 'active').length ?? 0) > 0 && (
                                            <Alert variant="destructive" className="mb-4 bg-red-50 text-red-900 border-red-200">
                                                <AlertCircle className="h-4 w-4 text-red-600" />
                                                <AlertTitle>Attention</AlertTitle>
                                                <AlertDescription>
                                                    Il y a {schoolData?.students?.filter((s: any) => !s.guardianId && s.status === 'active').length} élève(s) actif(s) non-rattaché(s) à un tuteur. 
                                                    Veuillez les affecter pour assurer un suivi correct.
                                                </AlertDescription>
                                            </Alert>
                                        )}

                                        <TabsContent value="liste" className="m-0">
                                            <Card>
                                                <CardHeader>
                                                    <CardTitle>Liste des Tuteurs</CardTitle>
                                                    <CardDescription>Gérez les responsables et analysez les regroupements familiaux.</CardDescription>
                                                </CardHeader>
                                                <CardContent>
                                                    <TuteurList guardians={(schoolData as any)?.guardians || []} schoolData={schoolData} onRefresh={refreshLayout} />
                                                </CardContent>
                                            </Card>
                                        </TabsContent>
                                        <TabsContent value="stats" className="m-0">
                                            <TuteurStats schoolData={schoolData} />
                                        </TabsContent>
                                    </Tabs>
                                </TabsContent>
                            </Card>
                        </Tabs>
                    </>
                )}
            </div>

            {showGuardianForm && schoolData && (
                <GuardianForm
                    onClose={() => setShowGuardianForm(false)}
                    onSave={async (data) => {
                        const { createGuardian } = await import('./actions');
                        const res = await createGuardian(schoolData.matricule, data, executorName);
                        if (res.success) {
                            refreshLayout();
                        }
                        return res;
                    }}
                />
            )}
            {paymentStudent && schoolData && (
                <InscriptionPaymentDialog
                    student={paymentStudent}
                    schoolData={schoolData}
                    isOpen={!!paymentStudent}
                    onClose={handlePaymentDialogClose}
                    onSave={updateStudentPaymentStatus}
                />
            )}
            {deletingStudent && (
                <AlertDialog open={!!deletingStudent} onOpenChange={(open: boolean) => !open && setDeletingStudent(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Êtes-vous absolument sûr ?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Cette action supprimera définitivement l'élève <strong>{deletingStudent.lastName} {deletingStudent.firstName}</strong> et toutes ses données associées de nos serveurs.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={(e) => {
                                    e.preventDefault();
                                    confirmDelete();
                                }}
                                disabled={isDeleting}
                                variant="destructive"
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Supprimer
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </>
    );
}