// src/components/inscription-payment-dialog.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Wallet, CircleAlert, CheckCircle } from 'lucide-react';
import { SchoolData, Student, Payment, FeeCategory, FeeItem, PaymentDetails } from '@/types';
import { toast } from 'sonner';
import { Separator } from './ui/separator';
import { Textarea } from './ui/textarea';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InscriptionPaymentDialogProps {
  student: Student;
  schoolData: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (matricule: string, studentId: string, paymentData: Payment, executorName?: string) => Promise<{ success: boolean; error?: string }>;
}

export function InscriptionPaymentDialog({ student, schoolData, isOpen, onClose, onSave }: InscriptionPaymentDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  const [paymentForm, setPaymentForm] = useState({
    amountPaid: '',
    dispensationAmount: '',
    dispensationReason: '',
    label: '',
    paymentMethod: 'caisse',
    paymentProvider: '',
    paymentReference: '',
  });

  const inscriptionFeeConfig = useMemo(() => {
    // If no grade or settings, we assume standard behavior (or 0 fee)
    if (!student.gradeName || !schoolData?.financeSettings?.inscriptionFee) {
      console.log('InscriptionPaymentDialog: Missing gradeName or inscriptionFee settings', { gradeName: student.gradeName, settings: schoolData?.financeSettings });
      return { amount: 0, currency: 'USD', feeItemId: 'inscription_fee' };
    }

    const fees = schoolData.financeSettings.inscriptionFee;
    let feeConfig = fees[student.gradeName];

    // Fallback: Fuzzy matching if direct lookup fails
    if (!feeConfig) {
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/1(ere|ère)/g, '1e').replace(/([0-9]+)(e|eme|ème)/g, '$1e');
      const target = normalize(student.gradeName);
      const foundKey = Object.keys(fees).find(key => normalize(key) === target);
      if (foundKey) {
        feeConfig = fees[foundKey];
        console.log('InscriptionPaymentDialog: Fuzzy match found', { original: student.gradeName, matched: foundKey });
      } else {
        console.log('InscriptionPaymentDialog: No match found for grade', { gradeName: student.gradeName, availableKeys: Object.keys(fees) });
      }
    }

    // If config exists, use it. If not, default to 0 (Free Inscription)
    if (feeConfig) {
      return {
        amount: feeConfig.amount,
        currency: feeConfig.currency,
        feeItemId: 'inscription_fee'
      };
    } else {
      return { amount: 0, currency: 'USD', feeItemId: 'inscription_fee' };
    }
  }, [student.gradeName, schoolData]);

  const totalToPay = useMemo(() => {
    if (!inscriptionFeeConfig) return 0;
    const total = Number(inscriptionFeeConfig.amount) - Number(paymentForm.dispensationAmount || 0);
    return total > 0 ? total : 0;
  }, [inscriptionFeeConfig, paymentForm.dispensationAmount]);

  // Reset form when dialog opens for a new student
  useEffect(() => {
    if (isOpen) {
      setPaymentForm({
        amountPaid: '',
        dispensationAmount: '',
        dispensationReason: '',
        label: `Frais d'Inscription : ${student.gradeName}`,
        paymentMethod: 'caisse',
        paymentProvider: '',
        paymentReference: '',
      });
    }
  }, [isOpen, student.gradeName]);

  const handleSelectChange = (name: string, value: string) => {
    setPaymentForm(prev => ({ ...prev, [name]: value, ...(name === 'paymentMethod' ? { paymentProvider: '', paymentReference: '' } : {}) }));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPaymentForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (!inscriptionFeeConfig) return;

    if (totalToPay > 0 && Number(paymentForm.amountPaid) < totalToPay) {
      toast.error('Paiement incomplet', { description: `Le montant payé doit être au moins de ${totalToPay.toLocaleString()} ${inscriptionFeeConfig.currency}.` });
      return;
    }

    if (Number(paymentForm.dispensationAmount) > 0 && !paymentForm.dispensationReason) {
      toast.error('Motif manquant', { description: "Le motif est obligatoire pour toute dispense." });
      return;
    }

    if (paymentForm.paymentMethod !== 'caisse') {
      if (!paymentForm.paymentProvider) {
        toast.error('Information manquante', { description: "Veuillez sélectionner la banque ou le service électronique." });
        return;
      }
      if (!paymentForm.paymentReference) {
        toast.error('Information manquante', { description: "Veuillez indiquer la référence du paiement (bordereau/transaction)." });
        return;
      }
    }

    setIsSaving(true);

    // Get collector name from localStorage
    let collectorName = 'Administrateur';
    try {
      const storedUser = localStorage.getItem('odsm-user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.name) collectorName = user.name;
      }
    } catch (e) {
      console.error('Error reading collector name:', e);
    }

    const paymentRecord: Payment = {
      id: `pay_${Date.now()}`,
      studentId: student.id,
      type: 'inscription',
      date: new Date().toISOString(),
      currency: inscriptionFeeConfig.currency,
      totalAmountPaid: Number(paymentForm.amountPaid || 0),
      totalDispensationAmount: Number(paymentForm.dispensationAmount || 0),
      label: paymentForm.label.trim() || undefined,
      collectorName,
      paymentMethod: paymentForm.paymentMethod,
      paymentProvider: paymentForm.paymentProvider,
      paymentReference: paymentForm.paymentReference,
      details: [
        {
          feeItemId: inscriptionFeeConfig.feeItemId,
          amountPaid: Number(paymentForm.amountPaid || 0),
          dispensationAmount: Number(paymentForm.dispensationAmount || 0),
          dispensationReason: paymentForm.dispensationReason,
        }
      ]
    };

    const result = await onSave(schoolData.matricule, student.id, paymentRecord, collectorName);

    if (result.success) {
      toast.success('Succès !', { description: `L'élève ${student.lastName} est maintenant actif.` });
      onClose();
    } else {
      toast.error('Erreur', { description: result.error || "Une erreur est survenue." });
    }
    setIsSaving(false);
  };

  const isFree = totalToPay === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet /> {isFree ? "Confirmation d'inscription" : "Paiement des frais d'inscription"}
          </DialogTitle>
          <DialogDescription>
            {isFree
              ? `Aucun frais n'est requis pour inscrire ${student.lastName} ${student.firstName}.`
              : `Finalisez l'inscription pour ${student.lastName} ${student.firstName} (${student.gradeName}).`
            }
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {inscriptionFeeConfig && (
            <>
              {!isFree && (
                <div className="p-4 border rounded-lg bg-muted/50 space-y-2">
                  <div className="flex justify-between">
                    <span>Frais d'inscription :</span>
                    <span className="font-bold">{inscriptionFeeConfig.amount.toLocaleString()} {inscriptionFeeConfig.currency}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <Label htmlFor="dispensationAmount-dialog">Dispense accordée :</Label>
                    <Input id="dispensationAmount-dialog" name="dispensationAmount" type="number" placeholder='0' value={paymentForm.dispensationAmount} onChange={handleInputChange} className="w-32 h-8" />
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold text-primary">
                    <span>TOTAL À PAYER :</span>
                    <span>{totalToPay.toLocaleString()} {inscriptionFeeConfig.currency}</span>
                  </div>
                </div>
              )}

              {!isFree && (
                <>
                  <div className="space-y-3">
                    <Label htmlFor="amountPaid-dialog" className="text-xl font-extrabold text-primary">Montant Payé</Label>
                    <Input id="amountPaid-dialog" name="amountPaid" type="number" placeholder="Montant versé" value={paymentForm.amountPaid} onChange={handleInputChange} className="text-lg h-12 font-bold" />
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="paymentMethod" className="font-semibold text-primary">Mode de paiement</Label>
                    <Select value={paymentForm.paymentMethod} onValueChange={(v) => handleSelectChange('paymentMethod', v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Sélectionnez un mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="caisse">Caisse</SelectItem>
                        <SelectItem value="banque">Banque</SelectItem>
                        <SelectItem value="electronique">Monnaie Électronique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentForm.paymentMethod === 'banque' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Banque</Label>
                        <Select value={paymentForm.paymentProvider} onValueChange={(v) => handleSelectChange('paymentProvider', v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Choisir la banque" />
                          </SelectTrigger>
                          <SelectContent>
                            {schoolData?.financeSettings?.banks?.map((b: any) => (
                              <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                            ))}
                            {(!schoolData?.financeSettings?.banks || schoolData?.financeSettings?.banks.length === 0) && (
                              <SelectItem value="-" disabled>Aucune banque configurée</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">N° Bordereau</Label>
                        <Input name="paymentReference" placeholder="Réf du bordereau" value={paymentForm.paymentReference} onChange={handleInputChange} className="h-9" />
                      </div>
                    </div>
                  )}

                  {paymentForm.paymentMethod === 'electronique' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Service</Label>
                        <Select value={paymentForm.paymentProvider} onValueChange={(v) => handleSelectChange('paymentProvider', v)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Choisir le service" />
                          </SelectTrigger>
                          <SelectContent>
                            {schoolData?.financeSettings?.electronicProviders?.map((ep: any) => (
                              <SelectItem key={ep.id} value={ep.name}>{ep.name}</SelectItem>
                            ))}
                            {(!schoolData?.financeSettings?.electronicProviders || schoolData?.financeSettings?.electronicProviders.length === 0) && (
                              <SelectItem value="-" disabled>Aucun service configuré</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Code Transaction</Label>
                        <Input name="paymentReference" placeholder="Code de transaction" value={paymentForm.paymentReference} onChange={handleInputChange} className="h-9" />
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="dispensationReason-dialog">Motif de la dispense</Label>
                    <Textarea id="dispensationReason-dialog" name="dispensationReason" placeholder="ex: Réduction pour le personnel" value={paymentForm.dispensationReason} onChange={handleInputChange} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="label-dialog">Libellé du paiement</Label>
                    <Input id="label-dialog" name="label" placeholder="ex: Inscription 2025-2026" value={paymentForm.label} onChange={handleInputChange} />
                  </div>
                </>
              )}

              {isFree && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="text-green-600" />
                  <AlertTitle>Inscription Gratuite</AlertTitle>
                  <AlertDescription>
                    L'élève sera activé sans frais. Confirmez pour continuer.
                  </AlertDescription>
                </Alert>
              )}

              {!isFree && (
                <Alert variant={Number(paymentForm.amountPaid) >= totalToPay ? 'default' : 'destructive'} className={Number(paymentForm.amountPaid) >= totalToPay ? 'bg-green-50 border-green-200' : ''}>
                  {Number(paymentForm.amountPaid) >= totalToPay ? <CheckCircle className="text-green-600" /> : <CircleAlert />}
                  <AlertTitle>{Number(paymentForm.amountPaid) >= totalToPay ? 'Paiement Complet' : 'Paiement Incomplet'}</AlertTitle>
                  <AlertDescription>
                    {Number(paymentForm.amountPaid) >= totalToPay
                      ? "Le statut de l'élève sera mis à jour vers 'Actif'."
                      : `Le montant versé doit couvrir le total à payer.`
                    }
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
          <Button type="button" onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isFree ? 'Confirmer l\'inscription' : 'Enregistrer le paiement')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
