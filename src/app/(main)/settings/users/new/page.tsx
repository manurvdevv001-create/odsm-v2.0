'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ArrowLeft, Plus } from 'lucide-react';
import { useSchoolData } from '@/components/providers/SchoolDataProvider';
import { UserForm } from '@/components/user-form';
import { createUser } from '../actions';

export default function CreateUserPage() {
    const router = useRouter();
    const { schoolData } = useSchoolData();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const useStaffNumberAsLogin = (schoolData?.configuration as { userManagement?: { useStaffNumberAsLogin?: boolean } } | undefined)?.userManagement?.useStaffNumberAsLogin ?? false;
    const staffProfiles = schoolData?.teachers || [];

    const handleCreate = async (formData: Record<string, string | boolean | undefined>) => {
        if (!schoolData?.matricule) return;

        const userName = typeof formData.name === 'string' && formData.name.trim().length > 0
            ? formData.name
            : 'utilisateur';

        setIsSubmitting(true);
        const result = await createUser(schoolData.matricule as string, formData);

        if (result?.success) {
            toast.success('Compte créé', {
                description: `Accès pour ${userName} configuré.`,
            });
            router.push('/settings/users');
        } else {
            toast.error('Erreur', {
                description: result?.error || "Échec de l'opération.",
            });
        }

        setIsSubmitting(false);
    };

    return (
        <div className="flex flex-col gap-6 p-1">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">Gestion des comptes</p>
                    <h1 className="text-3xl font-black tracking-tight">Créer un accès</h1>
                </div>
                <Button variant="outline" onClick={() => router.push('/settings/users')} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Retour
                </Button>
            </div>

            <Card className="border-none shadow-2xl bg-card/40 backdrop-blur-2xl">
                <CardHeader className="border-b border-primary/5 bg-primary/5">
                    <div className="flex items-center gap-3">
                        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                            <Plus className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black">Nouveau compte d&apos;accès</CardTitle>
                            <CardDescription>
                                Configurez les identifiants et les permissions pour un membre du personnel.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    <UserForm
                        staffProfiles={staffProfiles}
                        onSubmit={handleCreate}
                        onCancel={() => router.push('/settings/users')}
                        isSubmitting={isSubmitting}
                        useStaffNumberAsLogin={useStaffNumberAsLogin}
                        mode="create"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
