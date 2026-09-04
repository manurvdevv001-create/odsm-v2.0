'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { STAFF_CATEGORIES, STAFF_FUNCTIONS, FUNCTION_TO_ROLE_MAP } from '@/lib/staff-definitions';
import { Combobox } from '@/components/ui/combobox';

const userSchema = z.object({
    staffId: z.string().min(1, "Veuillez lier ce compte à un profil du personnel"),
    name: z.string().min(2, "Le nom doit avoir au moins 2 caractères"),
    login: z.string().min(3, "Le login doit avoir au moins 3 caractères"),
    password: z.string().min(6, "Le mot de passe doit avoir au moins 6 caractères").optional().or(z.literal('')),
    role: z.enum(['ADMIN', 'ADMIN_SYSTEM', 'SUPERVISOR', 'PREFET', 'CASHIER', 'SECRETARY', 'SECRETARY_CASHIER', 'DISCIPLINE', 'TEACHER']),
    isTitulaire: z.boolean().default(false),
    titulaireClassId: z.string().optional(),
    multipleSessionsEnabled: z.boolean().default(false),
});

interface UserFormProps {
    initialData?: any;
    staffProfiles: any[];
    onSubmit: (data: any) => Promise<void>;
    onCancel: () => void;
    isSubmitting: boolean;
    useStaffNumberAsLogin?: boolean;
    mode?: 'create' | 'edit';
}

export function UserForm({ initialData, staffProfiles, onSubmit, onCancel, isSubmitting, useStaffNumberAsLogin = false, mode = 'create' }: UserFormProps) {
    const form = useForm<z.infer<typeof userSchema>>({
        resolver: zodResolver(userSchema) as any,
        defaultValues: initialData || {
            staffId: '',
            name: '',
            login: '',
            password: '',
            role: 'TEACHER',
            isTitulaire: false,
            titulaireClassId: '',
            multipleSessionsEnabled: false,
        },
    });

    const selectedRole = form.watch('role');
    const isTitulaire = form.watch('isTitulaire');
    const selectedStaffId = form.watch('staffId');

    // Auto-fill name and details when staff is selected
    useEffect(() => {
        if (selectedStaffId && !initialData) {
            const staff = staffProfiles.find(s => s.id === selectedStaffId);
            if (staff) {
                const fullName = `${staff.lastName} ${staff.middleName ? staff.middleName + ' ' : ''}${staff.firstName}`;
                form.setValue('name', fullName);

                // Auto-fill Login if enabled and staff number exists
                if (useStaffNumberAsLogin && staff.staffNumber) {
                    form.setValue('login', staff.staffNumber);
                }

                // Set default role based on staff function using map
                const mappedRole = FUNCTION_TO_ROLE_MAP[staff.function] || 'TEACHER';
                form.setValue('role', mappedRole as any);

                // Auto-fill Titularity (if assignedClassroom exists in staff profile)
                if (staff.assignedClassroom) {
                    form.setValue('isTitulaire', true);
                    form.setValue('titulaireClassId', staff.assignedClassroom);
                }
            }
        }
    }, [selectedStaffId, staffProfiles, form, initialData, useStaffNumberAsLogin]);

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                    control={form.control}
                    name="staffId"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Lier à un profil (Personnel)</FormLabel>
                            <FormControl>
                                <Combobox
                                    items={staffProfiles.map(staff => ({
                                        value: staff.id,
                                        label: `${staff.lastName} ${staff.firstName} (${staff.function})`
                                    }))}
                                    value={field.value}
                                    onChange={field.onChange}
                                    placeholder="Choisir un membre du personnel..."
                                    searchPlaceholder="Rechercher un membre..."
                                    triggerClass="w-full"
                                    disabled={!!initialData}
                                />
                            </FormControl>
                            <FormDescription>
                                Un compte utilisateur doit obligatoirement être lié à un profil administratif.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nom d'affichage</FormLabel>
                            <FormControl>
                                <Input placeholder="Nom complet" {...field} readOnly={!!selectedStaffId} className={selectedStaffId ? "bg-muted" : ""} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="login"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Nom d'utilisateur (Login)</FormLabel>
                            <FormControl>
                                <Input placeholder="Ex: jmukendi" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {mode === 'create' && (
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mot de passe</FormLabel>
                                <FormControl>
                                    <Input type="password" placeholder="******" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rôle (Permissions ODSM)</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Sélectionnez un rôle" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="ADMIN_SYSTEM">Administrateur Système (Informaticiens)</SelectItem>
                                    <SelectItem value="ADMIN">Administrateur Général</SelectItem>

                                    {(() => {
                                        const roleGroups: Record<string, string[]> = {};

                                        Object.entries(STAFF_FUNCTIONS).forEach(([cat, funcs]) => {
                                            if (cat === STAFF_CATEGORIES.SOUTIEN) return;
                                            (funcs as any).forEach((func: string) => {
                                                const role = FUNCTION_TO_ROLE_MAP[func] || 'TEACHER';
                                                if (role === 'ADMIN_SYSTEM' || role === 'ADMIN') return;
                                                if (!roleGroups[role]) roleGroups[role] = [];
                                                roleGroups[role].push(func);
                                            });
                                        });

                                        const roleLabels: Record<string, string> = {
                                            SUPERVISOR: "Superviseur / Direction",
                                            SECRETARY: "Secrétariat",
                                            CASHIER: "Percepteur / Caisse",
                                            SECRETARY_CASHIER: "Secrétariat & Perception",
                                            PREFET: "Préfet des Études (Dir. Discipline)",
                                            DISCIPLINE: "Discipline",
                                            TEACHER: "Enseignant"
                                        };

                                        return Object.entries(roleGroups).map(([role, funcs]) => (
                                            <SelectItem key={role} value={role}>
                                                {roleLabels[role] || role} <span className="text-xs text-muted-foreground">({funcs.slice(0, 2).join(', ')}{funcs.length > 2 ? '...' : ''})</span>
                                            </SelectItem>
                                        ));
                                    })()}
                                    <SelectItem value="SECRETARY_CASHIER">Secrétariat &amp; Perception</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormDescription>
                                Ce rôle définit les accès de l'utilisateur dans l'application.
                            </FormDescription>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {selectedRole === 'TEACHER' && (
                    <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                        <FormField
                            control={form.control}
                            name="isTitulaire"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between">
                                    <div className="space-y-0.5">
                                        <FormLabel>Titularité</FormLabel>
                                        <FormDescription>
                                            Enseignant responsable d'une classe ?
                                        </FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {isTitulaire && (
                            <FormField
                                control={form.control}
                                name="titulaireClassId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Classe de titularité</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: 3ème Humanité A" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>
                )}

                <div className="bg-slate-50/50 p-4 rounded-lg border border-dashed border-slate-200 space-y-4">
                    <FormField
                        control={form.control}
                        name="multipleSessionsEnabled"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                                <div className="space-y-0.5">
                                    <FormLabel>Sessions multiples</FormLabel>
                                    <FormDescription>
                                        Permettre plusieurs connexions simultanées.
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                        Annuler
                    </Button>
                    <Button type="submit" disabled={isSubmitting} className="gradient-primary">
                        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {initialData ? 'Mettre à jour les accès' : 'Créer le compte'}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
