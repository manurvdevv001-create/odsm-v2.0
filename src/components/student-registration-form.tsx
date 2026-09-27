'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  UserPlus,
  Users,
  Calendar,
  Camera,
  Wallet,
  CheckCircle,
  CircleAlert,
  Ticket,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Alert,
  AlertTitle,
  AlertDescription
} from '@/components/ui/alert';
import { DatePicker } from '@/components/ui/date-picker';
import type { SchoolData, Payment } from '@/types';
import { getAllGrades, getClassroomsByLevel, getClassroomsByGrade } from '@/lib/classroom-utils';
import { Combobox } from '@/components/ui/combobox';
import { PersonPhoneField } from '@/components/person-phone-field';

interface StudentRegistrationFormProps {
  schoolData: SchoolData | null;
  onClose: () => void;
  onSave: (matricule: string, studentData: any, paymentData?: Payment) => Promise<{ success: boolean; error?: string }>;
}

export default function StudentRegistrationForm({ schoolData, onClose, onSave }: StudentRegistrationFormProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '', // Postnom
    birthDate: '',
    gender: '',
    gradeName: '',
    classroomName: '',
    level: '' as any,
    guardianId: 'new', // 'new' or existing id
    guardianFirstName: '',
    guardianLastName: '',
    guardianMiddleName: '',
    guardianPhone: '',
    guardianPersonContactId: '',
    guardianAddress: '',
  });
  const [paymentForm, setPaymentForm] = useState({
    amountPaid: '',
    dispensationAmount: '0',
    dispensationReason: '',
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeSchoolYear = schoolData?.calendar?.schoolYear;

  const availableGrades = useMemo(() => {
    if (!schoolData?.levels || !schoolData?.structure) return [];
    return getAllGrades(schoolData);
  }, [schoolData]);

  const availableClassrooms = useMemo(() => {
    if (!formData.gradeName || !schoolData?.levels || !schoolData?.structure) return [];

    for (const level of Object.keys(schoolData.levels)) {
      if (!schoolData.levels[level as keyof typeof schoolData.levels]) continue;
      const classrooms = getClassroomsByGrade(level, formData.gradeName, schoolData);
      if (classrooms.length > 0) {
        return classrooms;
      }
    }
    return [];
  }, [schoolData, formData.gradeName]);

  const inscriptionFeeConfig = useMemo(() => {
    if (!schoolData?.financeSettings?.inscriptionFee || !formData.gradeName) return null;
    const { inscriptionFee } = schoolData.financeSettings;

    // The inscriptionFee is now a Record<GradeName, {amount, currency}>
    const gradeFee = (inscriptionFee as any)[formData.gradeName];

    if (gradeFee && typeof gradeFee.amount === 'number') {
      return gradeFee;
    }

    // Fallback for legacy format if any
    const legacy = inscriptionFee as any;
    if (typeof legacy.amount === 'number') {
      if (Array.isArray(legacy.appliesTo) && legacy.appliesTo.includes(formData.gradeName)) {
        return legacy;
      }
    }

    return null;
  }, [schoolData, formData.gradeName]);

  const totalToPay = useMemo(() => {
    if (!inscriptionFeeConfig) return 0;
    const amount = Number(inscriptionFeeConfig.amount) || 0;
    const dispensation = Number(paymentForm.dispensationAmount) || 0;
    return Math.max(0, amount - dispensation);
  }, [inscriptionFeeConfig, paymentForm.dispensationAmount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (step === 1) {
      setFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setPaymentForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [name]: value };

      // Auto-detect level when grade changes
      if (name === 'gradeName' && schoolData?.levels) {
        for (const [level, enabled] of Object.entries(schoolData.levels)) {
          if (!enabled) continue;
          // Only check grades for this specific level
          const levelGrades = getAllGrades(schoolData, level);
          if (levelGrades.includes(value)) {
            newData.level = level as any;
            break;
          }
        }
      }

      return newData;
    });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNextStep = () => {
    if (!formData.firstName || !formData.lastName || !formData.birthDate || !formData.gender || !formData.gradeName) {
      alert("Veuillez remplir tous les champs obligatoires de l'élève.");
      return;
    }

    // Validate Guardian
    if (formData.guardianId === 'new') {
      if (!formData.guardianFirstName || !formData.guardianLastName || !formData.guardianPhone || !formData.guardianAddress) {
        alert("Pour un nouveau tuteur, le nom, prénom, téléphone et adresse sont obligatoires.");
        return;
      }
    } else if (!formData.guardianId) {
      alert("Veuillez sélectionner ou créer un tuteur.");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (later: boolean) => {
    if (!schoolData?.matricule) return;

    if (!later && Number(paymentForm.amountPaid) < totalToPay && !confirm("Le montant payé est inférieur au total. Voullez-vous continuer ?")) {
      return;
    }

    if (Number(paymentForm.dispensationAmount) > 0 && !paymentForm.dispensationReason) {
      alert("Veuillez indiquer le motif de la dispense.");
      return;
    }

    setIsSaving(true);
    setIsSaving(true);
    try {
      // Don't generate ID or StudentNumber on client anymore
      // We let the server handle it

      const status = later ? 'pending_payment' : (Number(paymentForm.amountPaid) >= totalToPay ? 'active' : 'pending_payment');

      const studentData = {
        // id: studentId, // Omitted to let backend generate UUID
        // studentNumber, // Omitted to let backend generate Matricule
        ...formData,
        photo,
        status,
        createdAt: new Date().toISOString(),
      };

      let paymentData: Payment | undefined;


      if (!later && Number(paymentForm.amountPaid) > 0) {
        paymentData = {
          id: `pay_${Date.now()}`,
          studentId: '', // Placeholder, will be linked by backend using the created student
          type: 'inscription',
          date: new Date().toISOString(),
          currency: inscriptionFeeConfig?.currency || 'USD',
          totalAmountPaid: Number(paymentForm.amountPaid),
          totalDispensationAmount: Number(paymentForm.dispensationAmount),
          details: [
            {
              feeItemId: 'inscription_fee',
              amountPaid: Number(paymentForm.amountPaid),
              dispensationAmount: Number(paymentForm.dispensationAmount),
              dispensationReason: paymentForm.dispensationReason
            }
          ]
        };
      }

      const result = await onSave(schoolData.matricule, studentData, paymentData);

      if (result.success) {
        onClose();
      } else {
        alert(result.error || "Une erreur est survenue lors de l'enregistrement.");
      }
    } catch (error) {
      console.error(error);
      alert("Une erreur inattendue est survenue.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto border-none sm:border shadow-none sm:shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <UserPlus className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            </div>
            <div>
              <CardTitle className="font-headline text-xl sm:text-2xl">Nouvelle Inscription</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Étape {step} sur 2: {step === 1 ? "Informations" : "Paiement"}</CardDescription>
            </div>
          </div>
          {activeSchoolYear && (
            <Badge variant="outline" className="text-sm px-3 py-1 border-primary/20 bg-primary/5 text-primary self-start sm:self-center">
              <Calendar className="w-3 h-3 mr-2" />
              {activeSchoolYear}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6 min-h-[400px]">
        {step === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-1 flex flex-col items-center gap-4">
              <Label className="font-semibold text-primary">Photo de l'élève</Label>
              <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full border-2 border-dashed border-primary/20 flex items-center justify-center bg-muted/30 overflow-hidden group">
                {photo ? (
                  <Image src={photo} alt="Photo" layout="fill" objectFit="cover" className="rounded-full" />
                ) : (
                  <Camera className="w-10 h-10 text-muted-foreground group-hover:scale-110 transition-transform" />
                )}
              </div>
              <Input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById('photo')?.click()} className="w-full sm:w-auto">
                {photo ? "Changer la photo" : "Charger une photo"}
              </Button>
            </div>
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="lastName">Nom <span className="text-destructive">*</span></Label>
                <Input id="lastName" name="lastName" required value={formData.lastName} onChange={handleInputChange} placeholder="Ex: NDAYE" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Postnom</Label>
                <Input id="middleName" name="middleName" value={formData.middleName} onChange={handleInputChange} placeholder="Ex: KABAMBA" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">Prénom <span className="text-destructive">*</span></Label>
                <Input id="firstName" name="firstName" required value={formData.firstName} onChange={handleInputChange} placeholder="Ex: Jean" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">Date de naissance <span className="text-destructive">*</span></Label>
                <DatePicker
                  value={formData.birthDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, birthDate: date }))}
                  placeholder="jj/mm/aaaa"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Sexe <span className="text-destructive">*</span></Label>
                <Select name="gender" required onValueChange={(value) => handleSelectChange('gender', value)}>
                  <SelectTrigger id="gender"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculin</SelectItem>
                    <SelectItem value="F">Féminin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="gradeName">Classe (Grade) <span className="text-destructive">*</span></Label>
                  <Select name="gradeName" required onValueChange={(value) => handleSelectChange('gradeName', value)}>
                    <SelectTrigger id="gradeName"><SelectValue placeholder="..." /></SelectTrigger>
                    <SelectContent>
                      {availableGrades.map(grade => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="classroomName">Local</Label>
                  <Select name="classroomName" value={formData.classroomName} disabled={!formData.gradeName} onValueChange={(value) => handleSelectChange('classroomName', value)}>
                    <SelectTrigger id="classroomName"><SelectValue placeholder="Attendre..." /></SelectTrigger>
                    <SelectContent>
                      {availableClassrooms.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-3 pt-4">
              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <h3 className="font-headline text-lg mb-4 text-primary flex items-center gap-2">
                  <Users className="w-5 h-5" /> Tuteur / Responsable
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-1 md:col-span-2">
                    <Label>Choisir un tuteur</Label>
                    <Combobox
                      items={[
                        { value: "new", label: "+ Créer un nouveau tuteur" },
                        ...(schoolData?.guardians?.map((g: any) => ({
                          value: g.id,
                          label: `${g.lastName} ${g.firstName} (${g.phone})`
                        })) || [])
                      ]}
                      value={formData.guardianId}
                      onChange={(value) => handleSelectChange('guardianId', value || 'new')}
                      placeholder="Sélectionner un tuteur..."
                      searchPlaceholder="Rechercher par nom ou téléphone..."
                      triggerClass="bg-background w-full"
                      disabled={isSaving}
                    />
                  </div>

                  {formData.guardianId === 'new' && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="guardianLastName">Nom tuteur <span className="text-destructive">*</span></Label>
                        <Input id="guardianLastName" name="guardianLastName" required disabled={!!formData.guardianPersonContactId} value={formData.guardianLastName} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianMiddleName">Postnom tuteur</Label>
                        <Input id="guardianMiddleName" name="guardianMiddleName" disabled={!!formData.guardianPersonContactId} value={formData.guardianMiddleName} onChange={handleInputChange} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="guardianFirstName">Prénom tuteur <span className="text-destructive">*</span></Label>
                        <Input id="guardianFirstName" name="guardianFirstName" required disabled={!!formData.guardianPersonContactId} value={formData.guardianFirstName} onChange={handleInputChange} />
                      </div>
                      <PersonPhoneField
                        matricule={schoolData?.matricule || ""}
                        value={formData.guardianPhone}
                        selectedId={formData.guardianPersonContactId}
                        required
                        onChange={guardianPhone => setFormData(current => ({ ...current, guardianPhone, guardianPersonContactId: "" }))}
                        onSelect={guardianPersonContactId => setFormData(current => ({ ...current, guardianPersonContactId }))}
                        onIdentityMatch={match => setFormData(current => ({
                          ...current,
                          guardianFirstName: match.firstName,
                          guardianLastName: match.lastName,
                          guardianMiddleName: match.middleName || "",
                        }))}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="guardianAddress">Adresse physique <span className="text-destructive">*</span></Label>
                        <Input id="guardianAddress" name="guardianAddress" required value={formData.guardianAddress} onChange={handleInputChange} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            {inscriptionFeeConfig ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-headline text-lg flex items-center gap-2"><Wallet /> Détails du paiement</h3>
                  <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                    <div className="flex justify-between">
                      <span>Frais d'inscription prévus :</span>
                      <span className="font-bold">{(Number(inscriptionFeeConfig.amount) || 0).toLocaleString()} {inscriptionFeeConfig.currency}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <Label htmlFor="dispensationAmount">Dispense accordée :</Label>
                      <Input id="dispensationAmount" name="dispensationAmount" type="number" placeholder='0' value={paymentForm.dispensationAmount} onChange={handleInputChange} className="w-32 h-8" />
                    </div>
                    <Separator />
                    <div className="flex justify-between text-lg font-bold text-primary">
                      <span>TOTAL À PAYER :</span>
                      <span>{(totalToPay || 0).toLocaleString()} {inscriptionFeeConfig.currency}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="amountPaid" className="text-xl font-extrabold text-primary">Montant Payé</Label>
                    <Input id="amountPaid" name="amountPaid" type="number" placeholder="Montant versé par le parent" value={paymentForm.amountPaid} onChange={handleInputChange} className="text-lg h-12 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dispensationReason">Motif de la dispense (obligatoire si dispense &gt; 0)</Label>
                    <Textarea id="dispensationReason" name="dispensationReason" placeholder="ex: Réduction pour le personnel (obligatoire si dispense &gt; 0)" value={paymentForm.dispensationReason} onChange={handleInputChange} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-headline text-lg flex items-center gap-2"><CheckCircle /> Finaliser l'inscription</h3>
                  <Alert variant={Number(paymentForm.amountPaid) >= totalToPay ? 'default' : 'destructive'} className={Number(paymentForm.amountPaid) >= totalToPay ? 'bg-green-50 border-green-200' : ''}>
                    {Number(paymentForm.amountPaid) >= totalToPay ? <CheckCircle className="text-green-600" /> : <CircleAlert />}
                    <AlertTitle>{Number(paymentForm.amountPaid) >= totalToPay ? 'Paiement Complet' : 'Paiement Incomplet'}</AlertTitle>
                    <AlertDescription>
                      {Number(paymentForm.amountPaid) >= totalToPay
                        ? "L'élève sera marqué comme 'Actif' et éligible à l'affectation."
                        : `Il restera ${((totalToPay - Number(paymentForm.amountPaid || 0)) || 0).toLocaleString()} ${inscriptionFeeConfig.currency} à payer. L'élève sera mis en 'Liste d'attente'.`
                      }
                    </AlertDescription>
                  </Alert>
                  <Button onClick={() => handleSubmit(false)} className="w-full" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : `Valider le Paiement et Inscrire`}
                  </Button>
                  <Button variant="secondary" onClick={() => handleSubmit(true)} className="w-full" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Inscrire et Payer plus tard (Liste d'attente)"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <Ticket className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-headline text-xl">Aucun frais d'inscription requis</h3>
                <p className="text-muted-foreground mb-4">Aucun frais d'inscription n'a été configuré pour le grade "{formData.gradeName}".</p>
                <Button onClick={() => handleSubmit(true)} disabled={isSaving}>
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Finaliser l'inscription"}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" type="button" onClick={step === 1 ? onClose : () => setStep(1)} disabled={isSaving}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {step === 1 ? 'Annuler' : 'Retour'}
        </Button>
        {step === 1 && (
          <Button type="button" onClick={handleNextStep}>
            Suivant
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
