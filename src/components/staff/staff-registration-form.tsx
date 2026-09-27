// src/components/staff/staff-registration-form.tsx
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, UserPlus, Camera } from 'lucide-react';
import { toast } from 'sonner';
import Image from 'next/image';
import type { StaffProfile, AcademicLevel } from '@/types';
import { STAFF_CATEGORIES, STAFF_FUNCTIONS } from '@/lib/staff-definitions';
import { PersonPhoneField } from '@/components/person-phone-field';

interface StaffRegistrationFormProps {
    matricule: string;
    activeLevels: AcademicLevel[];
    classrooms: string[];
    onClose: () => void;
    onSave: (staffData: any) => Promise<{ success: boolean; error?: string }>;
}

export function StaffRegistrationForm({ matricule, activeLevels, classrooms, onClose, onSave }: StaffRegistrationFormProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [photo, setPhoto] = useState<string | null>(null);
    const [selectedLevels, setSelectedLevels] = useState<AcademicLevel[]>([]);
    const [selectedClassrooms, setSelectedClassrooms] = useState<string[]>([]);

    const [formData, setFormData] = useState<Partial<Omit<StaffProfile, 'id'>>>({
        firstName: '',
        lastName: '',
        middleName: '',
        birthDate: '',
        gender: 'M',
        phone: '',
        personContactId: '',
        function: '',
        category: '',
        level: undefined,
    });

    const isTeachingCategory = formData.category === STAFF_CATEGORIES.ENSEIGNANT;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        if (name === 'category') {
            // Reset level selections when category changes
            setFormData(prev => ({ ...prev, [name]: value, function: '', level: undefined }));
            setSelectedLevels([]);
        } else if (name === 'level') {
            setFormData(prev => ({ ...prev, [name]: value as AcademicLevel, function: '' }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleLevelToggle = (level: AcademicLevel) => {
        setSelectedLevels(prev => {
            const next = prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level];
            setFormData(f => ({ ...f, level: next[0] || undefined }));
            return next;
        });
    };

    const handleClassroomToggle = (classroom: string) => {
        setSelectedClassrooms(prev => 
            prev.includes(classroom) ? prev.filter(c => c !== classroom) : [...prev, classroom]
        );
    };

    const resizeImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = document.createElement('img');
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > height) {
                        if (width > maxWidth) {
                            height = Math.round((height * maxWidth) / width);
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = Math.round((width * maxHeight) / height);
                            height = maxHeight;
                        }
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            try {
                const resizedImage = await resizeImage(file, 400, 400, 0.8);
                setPhoto(resizedImage);
            } catch (error) {
                console.error("Error resizing image:", error);
                toast.error("Impossible de traiter l'image.");
            }
        }
    };

    const handleSubmit = async () => {
        const hasLevel = (isTeachingCategory ? !!formData.level : selectedLevels.length > 0) || selectedClassrooms.length > 0;
        if (!formData.firstName || !formData.lastName || !formData.birthDate || !formData.gender || !formData.function || !formData.category || !hasLevel) {
            toast.error("Veuillez remplir les informations obligatoires.");
            return;
        }

        setIsSaving(true);
        const finalStaffData = {
            ...formData,
            photo,
            // For non-teaching staff, persist levels array; level is set to the first selected
            levels: isTeachingCategory ? [formData.level] : selectedLevels,
            assignedClassrooms: isTeachingCategory ? [] : selectedClassrooms,
        };
        const result = await onSave(finalStaffData);

        if (result.success) {
            toast.success("Membre du personnel enregistré !");
            onClose();
        } else {
            toast.error(result.error || "Une erreur est survenue.");
        }
        setIsSaving(false);
    };

    const levelTranslations: Record<string, string> = {
        maternelle: 'Maternelle',
        primaire: 'Primaire',
        secondaire: 'Secondaire'
    };

    const getFilteredFunctions = () => {
        if (!formData.category) return [];
        const allFunctions = (STAFF_FUNCTIONS as any)[formData.category] || [];

        if (formData.category === STAFF_CATEGORIES.ENSEIGNANT && formData.level) {
            const suffixMap: Record<string, string> = {
                maternelle: '(mat)',
                primaire: '(prim)',
                secondaire: '(sec)'
            };
            const targetSuffix = suffixMap[formData.level];
            return allFunctions.filter((f: string) => f.includes(targetSuffix) || f === "Maître soutien/appui");
        }

        return allFunctions;
    };

    return (
        <Card className="w-full max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex items-center gap-4">
                    <UserPlus className="w-8 h-8 text-primary" />
                    <div>
                        <CardTitle className="font-headline text-2xl">Ajouter un membre au personnel</CardTitle>
                        <CardDescription>Créez le profil administratif ou pédagogique d'un nouvel employé.</CardDescription>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-1 flex flex-col items-center gap-4">
                        <Label>Photo de profil</Label>
                        <div className="relative w-40 h-40 rounded-full border-2 border-dashed flex items-center justify-center bg-muted overflow-hidden">
                            {photo ? (
                                <Image src={photo} alt="Photo du membre" fill className="object-cover" />
                            ) : (
                                <Camera className="w-12 h-12 text-muted-foreground" />
                            )}
                        </div>
                        <Input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                        <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('photo')?.click()}>
                            Charger une photo
                        </Button>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="lastName">Nom *</Label>
                            <Input id="lastName" name="lastName" required disabled={!!formData.personContactId} value={formData.lastName} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="middleName">Postnom</Label>
                            <Input id="middleName" name="middleName" disabled={!!formData.personContactId} value={formData.middleName} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="firstName">Prénom *</Label>
                            <Input id="firstName" name="firstName" required disabled={!!formData.personContactId} value={formData.firstName} onChange={handleInputChange} />
                        </div>
                        <PersonPhoneField
                            matricule={matricule}
                            value={formData.phone || ''}
                            selectedId={formData.personContactId || ''}
                            onChange={phone => setFormData(current => ({ ...current, phone, personContactId: '' }))}
                            onSelect={personContactId => setFormData(current => ({ ...current, personContactId }))}
                            onIdentityMatch={match => setFormData(current => ({
                                ...current,
                                firstName: match.firstName,
                                lastName: match.lastName,
                                middleName: match.middleName || '',
                            }))}
                        />
                        <div className="space-y-2">
                            <Label htmlFor="birthDate">Date de naissance *</Label>
                            <DatePicker
                                value={formData.birthDate || ''}
                                onChange={(date) => setFormData(prev => ({ ...prev, birthDate: date }))}
                                placeholder="jj/mm/aaaa"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">Sexe *</Label>
                            <Select value={formData.gender} onValueChange={(value: 'M' | 'F') => handleSelectChange('gender', value)}>
                                <SelectTrigger id="gender"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="M">Masculin</SelectItem>
                                    <SelectItem value="F">Féminin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator className="sm:col-span-2 my-2" />

                        {/* Step 1: Category Selection (first because it determines the level UI) */}
                        <div className="sm:col-span-2 space-y-2">
                            <Label htmlFor="category" className="font-bold text-primary">Catégorie *</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(value: string) => handleSelectChange('category', value)}
                            >
                                <SelectTrigger id="category"><SelectValue placeholder="Sélectionner la catégorie..." /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(STAFF_CATEGORIES).map(([key, val]) => (
                                        <SelectItem key={key} value={val}>{val}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Step 2: Level Selection — adapts based on category */}
                        {formData.category && (
                            <div className="sm:col-span-2 space-y-2">
                                {isTeachingCategory ? (
                                    // For Teachers: single dropdown (one level only)
                                    <>
                                        <Label htmlFor="level" className="font-bold text-primary">Direction principale *</Label>
                                        <Select value={formData.level} onValueChange={(value: any) => handleSelectChange('level', value)}>
                                            <SelectTrigger id="level"><SelectValue placeholder="Sélectionner la direction..." /></SelectTrigger>
                                            <SelectContent>
                                                {activeLevels.map(lvl => (
                                                    <SelectItem key={lvl} value={lvl}>{levelTranslations[lvl]}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </>
                                ) : (
                                    // For Direction, Admin/Technique, Soutien: checkboxes (multi-level)
                                    <>
                                        <Label className="font-bold text-primary">Direction(s) académique(s)</Label>
                                        <p className="text-xs text-muted-foreground -mt-1">Sélectionnez un ou plusieurs niveaux académiques (laisser vide pour aucun filtrage)</p>
                                        <div className="flex flex-wrap gap-4 pt-1 mb-4">
                                            {activeLevels.map(lvl => (
                                                <label
                                                    key={lvl}
                                                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                                                        selectedLevels.includes(lvl)
                                                            ? 'bg-primary/10 border-primary/30 text-primary shadow-sm'
                                                            : 'bg-muted/20 border-primary/10 text-muted-foreground hover:bg-muted/40'
                                                    }`}
                                                >
                                                    <Checkbox
                                                        checked={selectedLevels.includes(lvl)}
                                                        onCheckedChange={() => handleLevelToggle(lvl)}
                                                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                    />
                                                    <span className="text-sm font-bold">{levelTranslations[lvl]}</span>
                                                </label>
                                            ))}
                                        </div>

                                        <Label className="font-bold text-primary">Classe(s) spécifique(s) assignée(s)</Label>
                                        <p className="text-xs text-muted-foreground -mt-1">Optionnel: Restreindre cet agent à des classes spécifiques (laisser vide pour accès au niveau entier)</p>
                                        <div className="border rounded-md p-3 max-h-48 overflow-y-auto bg-muted/10 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {classrooms.length > 0 ? (
                                                classrooms.map(c => (
                                                    <div key={c} className="flex items-center space-x-2 bg-background p-1.5 rounded border">
                                                        <Checkbox 
                                                            id={`class-${c}`} 
                                                            checked={selectedClassrooms.includes(c)}
                                                            onCheckedChange={() => handleClassroomToggle(c)}
                                                        />
                                                        <Label htmlFor={`class-${c}`} className="text-xs cursor-pointer truncate">{c}</Label>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="text-xs text-muted-foreground col-span-full">Aucune classe disponible</div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Step 3: Function / Position */}
                        <div className="space-y-2">
                            <Label htmlFor="function">Fonction / Poste *</Label>
                            <Select
                                value={formData.function}
                                onValueChange={(value: string) => handleSelectChange('function', value)}
                                disabled={!formData.category || (!isTeachingCategory && selectedLevels.length === 0 && selectedClassrooms.length === 0) || (isTeachingCategory && !formData.level && selectedClassrooms.length === 0)}
                            >
                                <SelectTrigger id="function"><SelectValue placeholder="Sélectionner le poste..." /></SelectTrigger>
                                <SelectContent>
                                    {getFilteredFunctions().map((func: string) => (
                                        <SelectItem key={func} value={func}>{func}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" type="button" onClick={onClose} disabled={isSaving}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Annuler
                </Button>
                <Button type="button" onClick={handleSubmit} disabled={isSaving} className="bg-primary text-primary-foreground">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Enregistrer le Profil'}
                </Button>
            </CardFooter>
        </Card>
    );
}
