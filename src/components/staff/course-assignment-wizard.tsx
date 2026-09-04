// src/components/staff/course-assignment-wizard.tsx
'use client';

import { useState, useMemo } from 'react';
import { X, ChevronRight, ChevronLeft, Check, Plus, Trash2, Edit, BookOpen, School, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ClassroomCourseAssignment } from '@/types';

interface CourseAssignmentWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (assignments: ClassroomCourseAssignment[]) => void;
    existingAssignments: ClassroomCourseAssignment[];
    availableClassrooms: string[];
    // Map of classroom name -> available courses for that classroom
    coursesByClassroom: Record<string, string[]>;
}

type WizardStep = 'overview' | 'select-classrooms' | 'select-courses';

export function CourseAssignmentWizard({
    isOpen,
    onClose,
    onSave,
    existingAssignments,
    availableClassrooms,
    coursesByClassroom
}: CourseAssignmentWizardProps) {
    const [step, setStep] = useState<WizardStep>('overview');
    const [assignments, setAssignments] = useState<ClassroomCourseAssignment[]>(existingAssignments);
    const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);
    const [selectedCourses, setSelectedCourses] = useState<Record<string, string[]>>({});
    const [courseFilter, setCourseFilter] = useState('');
    // Track which assignment we're editing (null = adding new)
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    const handleClose = () => {
        resetWizard();
        onClose();
    };

    const resetWizard = () => {
        setStep('overview');
        setSelectedClassrooms([]);
        setSelectedCourses({});
        setCourseFilter('');
        setEditingIndex(null);
    };

    const handleStartAdd = () => {
        setEditingIndex(null);
        setSelectedClassrooms([]);
        setSelectedCourses({});
        setStep('select-classrooms');
    };

    const handleEditAssignment = (index: number) => {
        const assignment = assignments[index];
        setEditingIndex(index);
        setSelectedClassrooms([assignment.classroom]);
        setSelectedCourses({ [assignment.classroom]: [...assignment.courses] });
        setStep('select-courses');
    };

    const handleRemoveAssignment = (index: number) => {
        setAssignments(prev => prev.filter((_, i) => i !== index));
    };

    const handleClassroomToggle = (classroom: string) => {
        setSelectedClassrooms(prev => {
            if (prev.includes(classroom)) {
                // Remove classroom and its courses
                const newCourses = { ...selectedCourses };
                delete newCourses[classroom];
                setSelectedCourses(newCourses);
                return prev.filter(c => c !== classroom);
            }
            return [...prev, classroom];
        });
    };

    const handleCourseToggle = (classroom: string, course: string) => {
        setSelectedCourses(prev => {
            const current = prev[classroom] || [];
            const updated = current.includes(course)
                ? current.filter(c => c !== course)
                : [...current, course];
            return { ...prev, [classroom]: updated };
        });
    };

    const handleSelectAllCourses = (classroom: string) => {
        const allCourses = coursesByClassroom[classroom] || [];
        const currentlySelected = selectedCourses[classroom] || [];
        const allSelected = allCourses.every(c => currentlySelected.includes(c));

        setSelectedCourses(prev => ({
            ...prev,
            [classroom]: allSelected ? [] : [...allCourses]
        }));
    };

    const handleGoToCourses = () => {
        // Pre-fill selectedCourses for new classrooms
        const newCourses = { ...selectedCourses };
        selectedClassrooms.forEach(cr => {
            if (!newCourses[cr]) newCourses[cr] = [];
        });
        setSelectedCourses(newCourses);
        setStep('select-courses');
    };

    const handleValidate = () => {
        // Build new assignments from selections
        const newAssignments: ClassroomCourseAssignment[] = [];

        selectedClassrooms.forEach(classroom => {
            const courses = selectedCourses[classroom] || [];
            if (courses.length > 0) {
                // Deduplicate courses in same classroom
                const uniqueCourses = [...new Set(courses)];
                newAssignments.push({ classroom, courses: uniqueCourses });
            }
        });

        if (editingIndex !== null) {
            // Replace the edited assignment
            const updated = [...assignments];
            updated.splice(editingIndex, 1, ...newAssignments);
            setAssignments(updated);
        } else {
            // Merge: if a classroom already exists in assignments, update its courses
            const merged = [...assignments];
            newAssignments.forEach(newA => {
                const existingIdx = merged.findIndex(a => a && typeof a === 'object' && a.classroom === newA.classroom);
                if (existingIdx >= 0) {
                    // Merge courses, deduplicate
                    const mergedCourses = [...new Set([...merged[existingIdx].courses, ...newA.courses])];
                    merged[existingIdx] = { ...merged[existingIdx], courses: mergedCourses };
                } else {
                    merged.push(newA);
                }
            });
            setAssignments(merged);
        }

        resetWizard();
    };

    const handleSaveAll = () => {
        onSave(assignments);
        handleClose();
    };

    // Classrooms already assigned (to disable re-selection when adding new)
    const alreadyAssignedClassrooms = useMemo(() => {
        const list = editingIndex !== null
            ? assignments.filter((_, i) => i !== editingIndex)
            : assignments;
        return list
            .filter(a => a && typeof a === 'object')
            .map(a => a.classroom)
            .filter(Boolean);
    }, [assignments, editingIndex]);

    const totalSelectedCourses = Object.values(selectedCourses).reduce((sum, arr) => sum + arr.length, 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800">
                                {step === 'overview' && 'Cours Dispensés'}
                                {step === 'select-classrooms' && 'Choisir les classes'}
                                {step === 'select-courses' && 'Choisir les cours'}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {step === 'overview' && 'Gérez les cours dispensés par cet enseignant'}
                                {step === 'select-classrooms' && 'Sélectionnez une ou plusieurs classes'}
                                {step === 'select-courses' && 'Cochez les cours à enseigner dans chaque classe'}
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClose} className="rounded-xl">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden">
                    {step === 'overview' && (
                        <div className="p-6 h-full flex flex-col">
                            {assignments.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                                    <School className="w-16 h-16 text-slate-200 mb-4" />
                                    <p className="text-slate-500 mb-4">Aucun cours assigné pour le moment.</p>
                                    <Button onClick={handleStartAdd} className="rounded-xl gap-2">
                                        <Plus className="w-4 h-4" /> Ajouter des cours
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <ScrollArea className="h-[50vh]">
                                        <div className="space-y-3">
                                            {assignments.map((assignment, idx) => {
                                                const isObject = typeof assignment === 'object' && assignment !== null;
                                                const classroom = isObject ? (assignment.classroom || 'Inconnu') : 'Non assigné';
                                                const courses = isObject ? (assignment.courses || []) : [String(assignment)];

                                                return (
                                                    <div key={idx} className={`border rounded-xl p-4 transition-colors ${!isObject ? 'bg-amber-50/50 border-amber-200' : 'hover:border-primary/30'}`}>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className={`rounded-lg font-semibold ${!isObject ? 'text-amber-700 border-amber-300 bg-amber-100/50' : 'text-primary border-primary/30 bg-primary/5'}`}>
                                                                    {classroom}
                                                                </Badge>
                                                                {!isObject && (
                                                                    <Badge variant="secondary" className="text-[10px] bg-amber-200 text-amber-800 border-none uppercase font-bold">
                                                                        Ancien Format
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1">
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm" 
                                                                    onClick={() => handleEditAssignment(idx)} 
                                                                    className="h-7 w-7 p-0 rounded-lg" 
                                                                    title="Modifier"
                                                                    disabled={!isObject}
                                                                >
                                                                    <Edit className="w-3.5 h-3.5 text-slate-500" />
                                                                </Button>
                                                                <Button variant="ghost" size="sm" onClick={() => handleRemoveAssignment(idx)} className="h-7 w-7 p-0 rounded-lg" title="Supprimer">
                                                                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {courses.map((course: string) => (
                                                                <span key={course} className={`text-xs px-2 py-1 rounded-md ${!isObject ? 'bg-white text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'}`}>
                                                                    {course}
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {!isObject && (
                                                            <p className="text-[10px] text-amber-600 mt-2 italic">
                                                                * Ce cours sera automatiquement associé à son local via l'horaire.
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                    <div className="pt-4">
                                        <Button variant="outline" onClick={handleStartAdd} className="w-full rounded-xl gap-2 border-dashed">
                                            <Plus className="w-4 h-4" /> Ajouter un autre local
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {step === 'select-classrooms' && (
                        <ScrollArea className="h-[50vh]">
                            <div className="p-6 space-y-2">
                                {availableClassrooms
                                    .filter(cr => !alreadyAssignedClassrooms.includes(cr))
                                    .map(classroom => {
                                        const courseCount = (coursesByClassroom[classroom] || []).length;
                                        return (
                                            <div
                                                key={classroom}
                                                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedClassrooms.includes(classroom)
                                                    ? 'border-primary bg-primary/5 shadow-sm'
                                                    : 'border-slate-200 hover:border-slate-300'
                                                    }`}
                                                onClick={() => handleClassroomToggle(classroom)}
                                            >
                                                <Checkbox
                                                    checked={selectedClassrooms.includes(classroom)}
                                                    onCheckedChange={() => handleClassroomToggle(classroom)}
                                                />
                                                <div className="flex-1">
                                                    <span className="font-medium text-sm">{classroom}</span>
                                                    <span className="text-xs text-muted-foreground ml-2">
                                                        ({courseCount} cours)
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                {availableClassrooms.filter(cr => !alreadyAssignedClassrooms.includes(cr)).length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground">
                                        Toutes les classes ont déjà été assignées.
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    )}

                    {step === 'select-courses' && (
                        <ScrollArea className="h-[50vh]">
                            {/* Course search filter — sticky at top */}
                            <div className="sticky top-0 z-10 bg-white px-6 pt-4 pb-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Filtrer les cours..."
                                        value={courseFilter}
                                        onChange={(e) => setCourseFilter(e.target.value)}
                                        className="pl-10 h-9 rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <div className="px-6 pb-6 space-y-6">
                                {selectedClassrooms.map(classroom => {
                                    const allCourses = coursesByClassroom[classroom] || [];
                                    const filterTerm = courseFilter.toLowerCase().trim();
                                    const courses = filterTerm
                                        ? allCourses.filter(c => c.toLowerCase().includes(filterTerm))
                                        : allCourses;
                                    const selected = selectedCourses[classroom] || [];
                                    const allSelected = allCourses.length > 0 && allCourses.every(c => selected.includes(c));

                                    if (filterTerm && courses.length === 0) return null;

                                    return (
                                        <div key={classroom}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="rounded-lg font-semibold text-primary border-primary/30 bg-primary/5">
                                                        {classroom}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {selected.length}/{allCourses.length} sélectionné(s)
                                                    </span>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleSelectAllCourses(classroom)}
                                                    className="text-xs h-7 rounded-lg"
                                                >
                                                    {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
                                                </Button>
                                            </div>
                                            <div className="space-y-1.5 pl-1">
                                                {courses.map(course => (
                                                    <div
                                                        key={`${classroom}-${course}`}
                                                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${selected.includes(course)
                                                            ? 'bg-primary/5'
                                                            : 'hover:bg-slate-50'
                                                            }`}
                                                        onClick={() => handleCourseToggle(classroom, course)}
                                                    >
                                                        <Checkbox
                                                            checked={selected.includes(course)}
                                                            onCheckedChange={() => handleCourseToggle(classroom, course)}
                                                        />
                                                        <Label className="font-normal cursor-pointer flex-1 text-sm">
                                                            <span className="font-medium">{course}</span>
                                                            <span className="text-muted-foreground ml-1">- {classroom}</span>
                                                        </Label>
                                                    </div>
                                                ))}
                                                {courses.length === 0 && !filterTerm && (
                                                    <p className="text-xs text-muted-foreground italic py-2">Aucun cours défini pour cette classe.</p>
                                                )}
                                            </div>
                                            <Separator className="mt-4" />
                                        </div>
                                    );
                                })}
                                {courseFilter.trim() && selectedClassrooms.every(cr => {
                                    const allCourses = coursesByClassroom[cr] || [];
                                    const ft = courseFilter.toLowerCase().trim();
                                    return allCourses.filter(c => c.toLowerCase().includes(ft)).length === 0;
                                }) && (
                                        <p className="text-center text-sm text-muted-foreground py-4">Aucun cours correspondant à &quot;{courseFilter}&quot;.</p>
                                    )}
                            </div>
                        </ScrollArea>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-slate-50/50">
                    {step === 'overview' && (
                        <>
                            <Button variant="outline" onClick={handleClose} className="rounded-xl">
                                Fermer
                            </Button>
                            <Button onClick={handleSaveAll} className="rounded-xl gap-2 shadow-lg shadow-primary/20">
                                <Check className="w-4 h-4" /> Valider
                            </Button>
                        </>
                    )}

                    {step === 'select-classrooms' && (
                        <>
                            <Button variant="outline" onClick={() => setStep('overview')} className="rounded-xl gap-2">
                                <ChevronLeft className="w-4 h-4" /> Retour
                            </Button>
                            <Button
                                onClick={handleGoToCourses}
                                disabled={selectedClassrooms.length === 0}
                                className="rounded-xl gap-2"
                            >
                                Suivant <ChevronRight className="w-4 h-4" />
                            </Button>
                        </>
                    )}

                    {step === 'select-courses' && (
                        <>
                            <Button variant="outline" onClick={() => editingIndex !== null ? resetWizard() : setStep('select-classrooms')} className="rounded-xl gap-2">
                                <ChevronLeft className="w-4 h-4" /> Retour
                            </Button>
                            <Button
                                onClick={handleValidate}
                                disabled={totalSelectedCourses === 0}
                                className="rounded-xl gap-2 shadow-lg shadow-primary/20"
                            >
                                <Check className="w-4 h-4" /> Confirmer ({totalSelectedCourses} cours)
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div >
    );
}
