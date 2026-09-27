// src/app/(main)/staff/page.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Loader2, BarChartHorizontal, Trash2, Search, PieChart, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffRegistrationForm } from '@/components/staff/staff-registration-form';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { isReadOnlyRole } from "@/lib/role-permissions";
import { toast } from 'sonner';
import Link from 'next/link';
import { StaffProfile, AcademicLevel } from '@/types';
import { getInitials } from '@/lib/utils';
import { getAllClassrooms } from '@/lib/classroom-utils';

type SortKey = 'name' | 'function' | 'category';
type SortOrder = 'asc' | 'desc';

interface SortConfig {
    key: SortKey;
    order: SortOrder;
}

const StaffList = ({
    staffMembers,
    onDelete,
    sortConfig,
    onSort,
    isReadOnly = false
}: {
    staffMembers: StaffProfile[],
    onDelete: (id: string) => void,
    sortConfig: SortConfig,
    onSort: (key: SortKey) => void,
    isReadOnly?: boolean
}) => {
    if (staffMembers.length === 0) {
        return <p className="text-center text-muted-foreground py-8">Aucun membre du personnel enregistré.</p>;
    }

    const SortIcon = ({ column }: { column: SortKey }) => {
        if (sortConfig.key !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
        return sortConfig.order === 'asc' ?
            <ArrowUp className="ml-2 h-4 w-4" /> :
            <ArrowDown className="ml-2 h-4 w-4" />;
    };

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="w-[80px]">Photo</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('name')}>
                        <div className="flex items-center">
                            Nom Complet <SortIcon column="name" />
                        </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('function')}>
                        <div className="flex items-center">
                            Fonction <SortIcon column="function" />
                        </div>
                    </TableHead>
                    <TableHead className="cursor-pointer hover:text-primary transition-colors" onClick={() => onSort('category')}>
                        <div className="flex items-center">
                            Catégorie <SortIcon column="category" />
                        </div>
                    </TableHead>
                    <TableHead className="text-center">Ajouté le</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {staffMembers.map((member) => (
                    <TableRow key={member.id}>
                        <TableCell>
                            <Avatar>
                                <AvatarImage src={member.photo || undefined} alt={`${member.lastName} ${member.firstName}`} />
                                <AvatarFallback>{getInitials(member.firstName, member.lastName, member.middleName)}</AvatarFallback>
                            </Avatar>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold">
                            {member.staffNumber || <span className="text-muted-foreground italic">-</span>}
                        </TableCell>
                        <TableCell className="font-medium">
                            <Link href={`/staff/${member.id}`} className="hover:underline text-primary">
                                {member.lastName} {member.middleName ? `${member.middleName} ` : ''}{member.firstName}
                            </Link>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium">{member.function}</span>
                                {member.phone && <span className="text-xs text-muted-foreground">{member.phone}</span>}
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant="outline">{member.category}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                            {member.createdAt ? new Date(member.createdAt).toLocaleDateString('fr-FR') : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                                <Button asChild variant="outline" size="sm">
                                    <Link href={`/staff/${member.id}`}>{isReadOnly ? 'Consulter' : 'Gérer'}</Link>
                                </Button>
                                {!isReadOnly && (
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(member.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

export default function StaffPage() {
    const { schoolData, user, refreshData } = useSchoolData();
    const effectiveRole = ((user?.role as string) || 'ADMIN').toUpperCase();
    const readOnly = isReadOnlyRole(effectiveRole);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', order: 'asc' });

    const typedSchoolData = schoolData as any;
    const staffMembers: StaffProfile[] = useMemo(() => typedSchoolData?.teachers || [], [typedSchoolData]);

    const handleSort = (key: SortKey) => {
        setSortConfig(current => ({
            key,
            order: current.key === key && current.order === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleSaveStaff = async (staffData: any) => {
        if (!typedSchoolData?.matricule) return { success: false, error: "Ecole non chargée" };

        try {
            const res = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ matricule: typedSchoolData.matricule, staffData, executorName: user?.name || 'Administrateur' })
            });
            const result = await res.json();
            if (result.success) {
                refreshData();
                return { success: true };
            }
            return { success: false, error: result.error };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Supprimer ce membre du personnel ?")) return;

        try {
            const executorParam = encodeURIComponent(user?.name || 'Administrateur');
            const res = await fetch(`/api/staff?id=${id}&executorName=${executorParam}`, { method: 'DELETE' });
            if (res.ok) {
                toast.success("Supprimé avec succès");
                refreshData();
            }
        } catch (error) {
            toast.error("Erreur de suppression");
        }
    };

    const filteredStaffMembers = useMemo(() => {
        const filtered = staffMembers.filter((member) => {
            const fullName = `${member.lastName} ${member.middleName || ''} ${member.firstName}`.toLowerCase();
            const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                (member.function || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'ALL' || member.category === categoryFilter;

            return matchesSearch && matchesCategory;
        });

        return [...filtered].sort((a, b) => {
            let comparison = 0;
            if (sortConfig.key === 'name') {
                const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
                const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
                comparison = nameA.localeCompare(nameB);
            } else if (sortConfig.key === 'function') {
                comparison = (a.function || '').localeCompare(b.function || '');
            } else if (sortConfig.key === 'category') {
                const catA = a.category || '';
                const catB = b.category || '';
                comparison = catA.localeCompare(catB);
            }
            return sortConfig.order === 'asc' ? comparison : -comparison;
        });
    }, [staffMembers, searchTerm, categoryFilter, sortConfig]);

    const activeLevels = useMemo(() => {
        if (!typedSchoolData?.levels) return [];
        return Object.entries(typedSchoolData.levels)
            .filter(([, isActive]) => isActive)
            .map(([level]) => level as AcademicLevel);
    }, [typedSchoolData?.levels]);

    const allClassrooms = useMemo(() => {
        return typedSchoolData ? getAllClassrooms(typedSchoolData) : [];
    }, [typedSchoolData]);

    if (!schoolData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Chargement du personnel...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8">
            {showForm ? (
                <StaffRegistrationForm
                    matricule={typedSchoolData.matricule}
                    activeLevels={activeLevels}
                    classrooms={allClassrooms}
                    onClose={() => setShowForm(false)}
                    onSave={handleSaveStaff}
                />
            ) : (
                <>
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-headline font-bold">Gestion du Personnel</h1>
                            <p className="text-muted-foreground">Gérez les profils administratifs et pédagogiques de votre établissement.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button asChild variant="outline">
                                <Link href="/staff/workload">
                                    <BarChartHorizontal className="mr-2 h-4 w-4" /> Charges Horaires
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link href="/staff/stats">
                                    <PieChart className="mr-2 h-4 w-4" /> Statistiques
                                </Link>
                            </Button>
                            {!readOnly && (
                                <Button onClick={() => setShowForm(true)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un membre
                                </Button>
                            )}
                        </div>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <CardTitle>Liste du personnel</CardTitle>
                                    <CardDescription>Retrouvez ici tous les profils enregistrés.</CardDescription>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            type="search"
                                            placeholder="Rechercher..."
                                            className="pl-8 w-full sm:w-[200px] lg:w-[300px]"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                                        <SelectTrigger className="w-full sm:w-[180px]">
                                            <SelectValue placeholder="Filtrer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ALL">Toutes les catégories</SelectItem>
                                            <SelectItem value="Personnel enseignant">Enseignants</SelectItem>
                                            <SelectItem value="Direction">Direction</SelectItem>
                                            <SelectItem value="Administratif/Technique">Administratif/Technique</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <StaffList
                                staffMembers={filteredStaffMembers}
                                onDelete={handleDelete}
                                sortConfig={sortConfig}
                                onSort={handleSort}
                                isReadOnly={readOnly}
                            />
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
