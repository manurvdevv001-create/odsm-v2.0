'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Loader2, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { assignStudentToCategory } from '@/app/(main)/students/actions';
import type { Student } from '@/types';

interface StudentCategorizationProps {
    schoolData: any;
    refreshData: () => void;
}

export const StudentCategorization = ({ schoolData, refreshData }: StudentCategorizationProps) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
    const [isUpdating, setIsUpdating] = useState<string | null>(null);

    const students = schoolData?.students || [];
    const paymentCategories = schoolData?.financeSettings?.paymentCategories || [];

    const filteredStudents = useMemo(() => {
        return students.filter((student: Student) => {
            if (!student) return false;

            const firstName = student.firstName || '';
            const lastName = student.lastName || '';
            const matricule = student.matricule || '';

            const matchesSearch =
                `${firstName} ${lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                matricule.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesCategory =
                selectedCategoryFilter === 'all' ||
                (selectedCategoryFilter === 'none' && !student.paymentCategoryId) ||
                student.paymentCategoryId === selectedCategoryFilter;

            return matchesSearch && matchesCategory;
        });
    }, [students, searchTerm, selectedCategoryFilter]);

    const handleCategoryChange = async (studentId: string, newCategoryId: string) => {
        setIsUpdating(studentId);
        
        // Get author name from localStorage
        let executorName = 'Administrateur';
        try {
            const storedUser = localStorage.getItem('odsm-user');
            if (storedUser) {
                const user = JSON.parse(storedUser);
                if (user.name) executorName = user.name;
            }
        } catch (e) {
            console.error('Error reading executor name:', e);
        }

        const result = await assignStudentToCategory(schoolData.matricule, studentId, newCategoryId, executorName);
        if (result.success) {
            toast('Succès', { description: 'Catégorie mise à jour avec succès.' });
            refreshData();
        } else {
            toast('Erreur', { description: result.error || 'Erreur lors de la mise à jour.' });
        }
        setIsUpdating(null);
    };

    const getCategoryName = (categoryId?: string) => {
        if (!categoryId) return 'Non défini';
        return paymentCategories.find((c: any) => c.id === categoryId)?.name || 'Inconnu';
    };

    const getInitials = (firstName: string, lastName: string) => {
        return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" /> Classification des élèves
                    </CardTitle>
                    <CardDescription>
                        Gérez l'appartenance des élèves aux différentes catégories de paiement pour l'année scolaire en cours.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher un élève par nom ou matricule..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="w-full md:w-64">
                            <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Filtrer par catégorie" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Toutes les catégories</SelectItem>
                                    <SelectItem value="none">Sans catégorie</SelectItem>
                                    {paymentCategories.map((cat: any) => (
                                        <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.level})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[60px]">Photo</TableHead>
                                    <TableHead>Élève</TableHead>
                                    <TableHead>Niveau / Grade</TableHead>
                                    <TableHead>Catégorie Actuelle</TableHead>
                                    <TableHead className="text-right">Changer la catégorie</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredStudents.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Aucun élève trouvé.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredStudents.map((student: Student) => (
                                        <TableRow key={student.id}>
                                            <TableCell>
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={student.photo || undefined} />
                                                    <AvatarFallback>{getInitials(student.firstName, student.lastName)}</AvatarFallback>
                                                </Avatar>
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-medium">{student.lastName} {student.firstName}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{student.matricule}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-sm">{student.gradeName}</span>
                                                    <Badge variant="outline" className="w-fit text-[10px] capitalize">
                                                        {student.classroomName || 'Non affecté'}
                                                    </Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={student.paymentCategoryId ? "secondary" : "destructive"}>
                                                    {getCategoryName(student.paymentCategoryId)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <Select
                                                        value={student.paymentCategoryId || ''}
                                                        onValueChange={(val) => handleCategoryChange(student.id, val)}
                                                        disabled={isUpdating === student.id}
                                                    >
                                                        <SelectTrigger className="w-[180px] h-9">
                                                            {isUpdating === student.id ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : <SelectValue placeholder="Migrer vers..." />}
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {paymentCategories
                                                                .filter((cat: any) => {
                                                                    let studentLevel = student.level;
                                                                    if (student.gradeName) {
                                                                        if (student.gradeName.includes('Maternelle')) studentLevel = 'maternelle' as any;
                                                                        else if (student.gradeName.includes('Primaire') || student.gradeName.includes('Spécial')) studentLevel = 'primaire' as any;
                                                                        else if (student.gradeName.includes('CTEB') || student.gradeName.includes('Humanité') || student.gradeName.includes('Professionnelle')) studentLevel = 'secondaire' as any;
                                                                    }
                                                                    return cat.level === (studentLevel || 'primaire');
                                                                })
                                                                .map((cat: any) => (
                                                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                                ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
