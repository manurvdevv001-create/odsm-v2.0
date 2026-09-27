import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { Guardian } from '@/types';
import { PersonPhoneField } from '@/components/person-phone-field';

export const GuardianForm = ({ initialData, matricule, onClose, onSave }: { initialData?: Partial<Guardian>, matricule: string, onClose: () => void, onSave: (data: any) => Promise<any> }) => {
    const [formData, setFormData] = useState({
        firstName: initialData?.firstName || '',
        lastName: initialData?.lastName || '',
        middleName: initialData?.middleName || '',
        phone: initialData?.phone || '',
        personContactId: initialData?.personContactId || '',
        email: initialData?.email || '',
        profession: initialData?.profession || '',
        address: initialData?.address || ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isConfirmedMatch, setIsConfirmedMatch] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        const result = await onSave(formData);
        if (result.success) {
            onClose();
        } else {
            alert(result.error || "Erreur lors de l'enregistrement");
        }
        setIsSaving(false);
    };

    return (
        <Card className="fixed inset-0 z-50 overflow-auto bg-background/80 flex items-center justify-center p-4 backdrop-blur-sm">
            <Card className="w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <CardHeader>
                        <CardTitle>{initialData ? 'Modifier Tuteur' : 'Nouveau Tuteur'}</CardTitle>
                        <CardDescription>Enregistrez ou modifiez les informations du responsable.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Nom <span className="text-red-500">*</span></Label>
                                <Input required disabled={isConfirmedMatch} value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Postnom</Label>
                                <Input disabled={isConfirmedMatch} value={formData.middleName} onChange={e => setFormData({ ...formData, middleName: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Prénom <span className="text-red-500">*</span></Label>
                                <Input required disabled={isConfirmedMatch} value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} />
                            </div>
                        </div>
                        <PersonPhoneField
                            matricule={matricule}
                            value={formData.phone}
                            selectedId={formData.personContactId}
                            required
                            onChange={phone => setFormData(current => ({ ...current, phone, personContactId: '' }))}
                            onSelect={personContactId => {
                                setFormData(current => ({ ...current, personContactId }));
                                setIsConfirmedMatch(!!personContactId);
                            }}
                            onIdentityMatch={match => setFormData(current => ({
                                ...current,
                                firstName: match.firstName,
                                lastName: match.lastName,
                                middleName: match.middleName || '',
                            }))}
                        />
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Profession</Label>
                            <Input value={formData.profession} onChange={e => setFormData({ ...formData, profession: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Adresse <span className="text-red-500">*</span></Label>
                            <Input required value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enregistrer"}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </Card>
    );
};
