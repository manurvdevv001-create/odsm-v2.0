"use client";

import { useState, useEffect, useMemo } from "react";
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { getFinanceSettings, saveFinanceSettings } from "@/app/setup/actions";
import { getAllClassrooms, getAllGrades } from "@/lib/classroom-utils";
import { toast } from "sonner";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    ArrowLeft, Save, Loader2, PlusCircle, Trash2,
    DollarSign, X, Library, FolderPlus, Link2, FilePenLine, Wallet,
    ArrowUp, ArrowDown, Search
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

// ─── Types ───────────────────────────────────────────────────────
type Currency = { code: string; rate: number; enabled: boolean };
type FeeItem = { id: string; name: string; amount: number; currency: string };
type PaymentCategory = { id: string; name: string; level: 'maternelle' | 'primaire' | 'secondaire'; isDefault: boolean };
type FeeCategory = { id: string; name: string; appliesTo: string[]; feeItemIds: string[]; paymentCategoryId?: string };
type InscriptionFeeEntry = { amount: number; currency: string };
type InscriptionFee = Record<string, InscriptionFeeEntry>;
type Bank = { id: string; name: string };
type ElectronicProvider = { id: string; name: string };
type FinanceSettings = {
    currencies: Currency[];
    feeItems: FeeItem[];
    feeCategories: FeeCategory[];
    paymentCategories: PaymentCategory[];
    inscriptionFee: InscriptionFee;
    banks?: Bank[];
    electronicProviders?: ElectronicProvider[];
};

const DEFAULT_CURRENCIES: Currency[] = [
    { code: 'CDF', rate: 1, enabled: true },
    { code: 'USD', rate: 2800, enabled: true },
    { code: 'EUR', rate: 3000, enabled: false },
];

const EMPTY_SETTINGS: FinanceSettings = {
    currencies: DEFAULT_CURRENCIES,
    feeItems: [],
    feeCategories: [],
    paymentCategories: [],
    inscriptionFee: {},
    banks: [],
    electronicProviders: [],
};

// ─── Component ───────────────────────────────────────────────────
export default function FinanceSettingsPage() {
    const { schoolData, refreshData } = useSchoolData();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingSettings, setIsLoadingSettings] = useState(true);
    const [activeYear, setActiveYear] = useState<string>('');

    const [settings, setSettings] = useState<FinanceSettings>(EMPTY_SETTINGS);

    // Derived classroom/grade lists
    const allClassrooms = useMemo(() => schoolData ? getAllClassrooms(schoolData) : [], [schoolData]);
    const allGrades = useMemo(() => schoolData ? getAllGrades(schoolData) : [], [schoolData]);
    const enabledCurrencies = useMemo(() => settings.currencies.filter(c => c.enabled), [settings.currencies]);
    const [rubriqueSearch, setRubriqueSearch] = useState('');

    // ─── Load settings ───
    useEffect(() => {
        const load = async () => {
            if (!schoolData) return;
            setIsLoadingSettings(true);
            try {
                const matricule = schoolData.matricule as string;
                const currentYear = (schoolData.schoolCalendar as any)?.schoolYear;
                setActiveYear(currentYear || '');

                const result = await getFinanceSettings(matricule, currentYear);
                if (result.success && result.data) {
                    // Migrate old inscription fee format if needed
                    let inscriptionFee: InscriptionFee = {};
                    const loadedFee = result.data.inscriptionFee as any;
                    if (loadedFee && typeof loadedFee.amount === 'number' && Array.isArray(loadedFee.appliesTo)) {
                        loadedFee.appliesTo.forEach((grade: string) => {
                            inscriptionFee[grade] = { amount: loadedFee.amount, currency: loadedFee.currency || 'USD' };
                        });
                    } else {
                        inscriptionFee = loadedFee || {};
                    }

                    setSettings({
                        currencies: result.data.currencies || DEFAULT_CURRENCIES,
                        feeItems: result.data.feeItems || [],
                        feeCategories: result.data.feeCategories || [],
                        paymentCategories: result.data.paymentCategories || [],
                        inscriptionFee,
                        banks: result.data.banks || [],
                        electronicProviders: result.data.electronicProviders || [],
                    });
                }
                if (result.activeYear) setActiveYear(result.activeYear);
            } catch (error) {
                console.error(error);
                toast.error("Erreur", { description: "Impossible de charger les paramètres financiers." });
            } finally {
                setIsLoadingSettings(false);
            }
        };
        load();
    }, [schoolData]);

    // ─── Save ───
    const { user } = useSchoolData();
    const executorName = user?.name || "Administrateur";

    const handleSave = async () => {
        if (!schoolData) return;
        setIsSaving(true);
        try {
            const result = await saveFinanceSettings(schoolData.matricule as string, settings, activeYear || undefined, executorName);
            if (result.success) {
                toast.success("Succès", { description: `Paramètres financiers enregistrés pour ${activeYear || "l'année active"}.` });
                await refreshData();
            } else {
                toast.error("Erreur", { description: result.error || "Impossible d'enregistrer." });
            }
        } catch (error) {
            console.error(error);
            toast.error("Erreur", { description: "Une erreur est survenue." });
        } finally {
            setIsSaving(false);
        }
    };

    // ─── Currency handlers ───
    const handleCurrencyChange = (code: string, field: 'rate' | 'enabled', value: any) => {
        setSettings(prev => ({
            ...prev,
            currencies: prev.currencies.map(c => c.code === code ? { ...c, [field]: value } : c),
        }));
    };

    // ─── Fee Item handlers ───
    const handleAddFeeItem = () => {
        setSettings(prev => ({
            ...prev,
            feeItems: [{
                id: `feeitem_${Date.now()}`,
                name: "Nouveau Frais",
                amount: 0,
                currency: 'CDF',
            }, ...prev.feeItems],
        }));
    };

    const handleFeeItemChange = (id: string, field: keyof FeeItem, value: any) => {
        setSettings(prev => ({
            ...prev,
            feeItems: prev.feeItems.map(item => item.id === id ? { ...item, [field]: value } : item),
        }));
    };

    const handleRemoveFeeItem = (id: string) => {
        setSettings(prev => ({
            ...prev,
            feeItems: prev.feeItems.filter(item => item.id !== id),
            feeCategories: prev.feeCategories.map(cat => ({
                ...cat,
                feeItemIds: cat.feeItemIds.filter(itemId => itemId !== id),
            })),
        }));
    };

    // ─── Fee Category handlers ───
    const handleAddFeeCategory = () => {
        setSettings(prev => ({
            ...prev,
            feeCategories: [{
                id: `feecat_${Date.now()}`,
                name: 'Nouvelle Rubrique',
                appliesTo: [],
                feeItemIds: [],
            }, ...prev.feeCategories],
        }));
    };

    const handleFeeCategoryChange = (id: string, field: keyof FeeCategory, value: any) => {
        setSettings(prev => ({
            ...prev,
            feeCategories: prev.feeCategories.map(fc => fc.id === id ? { ...fc, [field]: value } : fc),
        }));
    };

    const handleRemoveFeeCategory = (id: string) => {
        setSettings(prev => ({
            ...prev,
            feeCategories: prev.feeCategories.filter(fc => fc.id !== id),
        }));
    };

    const handleMoveFeeCategory = (id: string, direction: 'up' | 'down') => {
        setSettings(prev => {
            const cats = [...prev.feeCategories];
            const idx = cats.findIndex(fc => fc.id === id);
            if (idx === -1) return prev;
            const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
            if (swapIdx < 0 || swapIdx >= cats.length) return prev;
            [cats[idx], cats[swapIdx]] = [cats[swapIdx], cats[idx]];
            return { ...prev, feeCategories: cats };
        });
    };

    const handleCategoryClassroomToggle = (categoryId: string, classroomName: string, isSelected: boolean) => {
        const cat = settings.feeCategories.find(fc => fc.id === categoryId);
        if (!cat) return;
        handleFeeCategoryChange(categoryId, 'appliesTo',
            isSelected
                ? [...cat.appliesTo, classroomName]
                : cat.appliesTo.filter(name => name !== classroomName)
        );
    };

    // ─── Payment Category handlers ───
    const handleAddPaymentCategory = (level: 'maternelle' | 'primaire' | 'secondaire' = 'primaire') => {
        setSettings(prev => ({
            ...prev,
            paymentCategories: [{
                id: `paycat_${Date.now()}`,
                name: 'Nouvelle Catégorie',
                level,
                isDefault: false,
            }, ...prev.paymentCategories],
        }));
    };

    const handlePaymentCategoryChange = (id: string, field: keyof PaymentCategory, value: any) => {
        setSettings(prev => {
            const updatedCategories = prev.paymentCategories.map(pc => {
                if (pc.id === id) {
                    return { ...pc, [field]: value };
                }
                // If setting default, unset others of same level
                if (field === 'isDefault' && value === true) {
                    const current = prev.paymentCategories.find(c => c.id === id);
                    if (current && pc.level === current.level) {
                        return { ...pc, isDefault: false };
                    }
                }
                return pc;
            });
            return { ...prev, paymentCategories: updatedCategories };
        });
    };

    const handleRemovePaymentCategory = (id: string) => {
        setSettings(prev => ({
            ...prev,
            paymentCategories: prev.paymentCategories.filter(pc => pc.id !== id),
            feeCategories: prev.feeCategories.map(fc =>
                fc.paymentCategoryId === id ? { ...fc, paymentCategoryId: undefined } : fc
            ),
        }));
    };

    // ─── Payment Modes Handlers ───
    const handleAddBank = () => {
        setSettings(prev => ({
            ...prev,
            banks: [...(prev.banks || []), { id: `bank_${Date.now()}`, name: 'Nouvelle Banque' }],
        }));
    };

    const handleBankChange = (id: string, name: string) => {
        setSettings(prev => ({
            ...prev,
            banks: (prev.banks || []).map(b => b.id === id ? { ...b, name } : b),
        }));
    };

    const handleRemoveBank = (id: string) => {
        setSettings(prev => ({
            ...prev,
            banks: (prev.banks || []).filter(b => b.id !== id),
        }));
    };

    const handleAddElectronicProvider = () => {
        setSettings(prev => ({
            ...prev,
            electronicProviders: [...(prev.electronicProviders || []), { id: `ep_${Date.now()}`, name: 'Nouveau Service' }],
        }));
    };

    const handleElectronicProviderChange = (id: string, name: string) => {
        setSettings(prev => ({
            ...prev,
            electronicProviders: (prev.electronicProviders || []).map(ep => ep.id === id ? { ...ep, name } : ep),
        }));
    };

    const handleRemoveElectronicProvider = (id: string) => {
        setSettings(prev => ({
            ...prev,
            electronicProviders: (prev.electronicProviders || []).filter(ep => ep.id !== id),
        }));
    };

    // ─── Inscription Fee handlers ───
    const handleInscriptionFeeUpdate = (grade: string, field: 'amount' | 'currency', value: any) => {
        setSettings(prev => ({
            ...prev,
            inscriptionFee: {
                ...prev.inscriptionFee,
                [grade]: {
                    ...(prev.inscriptionFee[grade] || { amount: 0, currency: 'USD' }),
                    [field]: value,
                },
            },
        }));
    };

    // ─── Category total calculation ───
    const getCategoryTotal = (category: FeeCategory) => {
        if (category.feeItemIds.length === 0) return { amount: 0, currency: null as string | null, mixed: false };
        const items = category.feeItemIds
            .map(id => settings.feeItems.find(item => item.id === id))
            .filter(Boolean) as FeeItem[];
        if (items.length === 0) return { amount: 0, currency: null as string | null, mixed: false };
        const firstCurrency = items[0].currency;
        const isMixed = items.some(item => item.currency !== firstCurrency);
        if (isMixed) return { amount: 0, currency: firstCurrency, mixed: true };
        const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);
        return { amount: totalAmount, currency: firstCurrency, mixed: false };
    };

    // ─── Render ───
    if (!schoolData || isLoadingSettings) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
            </div>
        );
    }

    const schoolLevels = (schoolData.levels as Record<string, boolean>) || {};

    return (
        <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link href="/settings">
                        <Button variant="ghost" size="sm" className="mb-2 pl-0 hover:bg-transparent hover:text-primary">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Retour aux Paramètres
                        </Button>
                    </Link>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold tracking-tight">Paramètres Financiers</h1>
                        {activeYear && (
                            <Badge variant="outline" className="border-green-500 text-green-600 bg-green-50">
                                {activeYear}
                            </Badge>
                        )}
                    </div>
                    <p className="text-muted-foreground mt-1">
                        Gérez les devises, les frais individuels et la composition des rubriques
                        {activeYear ? ` pour ${activeYear}` : ''}.
                    </p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} size="lg">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Enregistrer
                </Button>
            </div>

            <Accordion type="multiple" defaultValue={["item-1", "item-2", "item-3", "item-4"]} className="w-full space-y-4">
                {/* Section 1: Currencies + Inscription Fees */}
                <AccordionItem value="item-1" className="bg-card rounded-lg border px-1">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-5 h-5" />
                            <span className="text-lg font-semibold">Devises et Frais d&apos;Inscription</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch pt-2">
                {/* Currencies */}
                <Card className="flex flex-col h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><DollarSign className="w-5 h-5" /> Devises et Taux</CardTitle>
                        <CardDescription>Activez les devises et définissez leurs taux de change.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 flex-grow">
                        {settings.currencies.map(currency => (
                            <div key={currency.code} className="p-3 border rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <DollarSign className="w-6 h-6 text-muted-foreground" />
                                    <div>
                                        <p className="font-bold text-lg">{currency.code}</p>
                                        {currency.code !== 'CDF' && (
                                            <div className="flex items-center gap-1">
                                                <Label className="text-xs">1 {currency.code} = </Label>
                                                <Input
                                                    type="number"
                                                    value={currency.rate}
                                                    onChange={e => handleCurrencyChange(currency.code, 'rate', Number(e.target.value))}
                                                    className="h-7 w-24"
                                                    disabled={!currency.enabled}
                                                />
                                                <Label className="text-xs">CDF</Label>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <Switch
                                    checked={currency.enabled}
                                    onCheckedChange={checked => handleCurrencyChange(currency.code, 'enabled', checked)}
                                    disabled={currency.code === 'CDF'}
                                />
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Inscription Fees */}
                <Card className="flex flex-col h-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><FilePenLine className="w-5 h-5" /> Frais d&apos;Inscription</CardTitle>
                        <CardDescription>Définissez un frais pour chaque grade. Si 0, aucun frais ne sera appliqué.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <ScrollArea className="h-[250px] pr-4">
                            <div className="space-y-4">
                                {allGrades.length === 0 && (
                                    <p className="text-sm text-muted-foreground">Aucun grade configuré dans l&apos;école.</p>
                                )}
                                {allGrades.map(grade => {
                                    const fee = settings.inscriptionFee[grade] || { amount: 0, currency: 'USD' };
                                    return (
                                        <div key={grade} className="flex items-center justify-between gap-4 p-2 rounded hover:bg-muted/30">
                                            <Label className="w-1/3 truncate font-medium" title={grade}>{grade}</Label>
                                            <div className="flex items-center gap-2 flex-grow">
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    value={fee.amount}
                                                    onChange={e => handleInscriptionFeeUpdate(grade, 'amount', Number(e.target.value))}
                                                    className="h-8 w-full"
                                                    min={0}
                                                />
                                                <Select value={fee.currency} onValueChange={v => handleInscriptionFeeUpdate(grade, 'currency', v)}>
                                                    <SelectTrigger className="w-[80px] h-8"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {enabledCurrencies.map(c => (
                                                            <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                            </CardContent>
                        </Card>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 2: Payment Categories */}
                <AccordionItem value="item-2" className="bg-card rounded-lg border px-1">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Library className="w-5 h-5" />
                            <span className="text-lg font-semibold">Catégories de Paiement</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2">
            <Card className="border-0 shadow-none">
                <CardHeader className="px-0 pt-0">
                    <CardTitle className="flex items-center gap-2"><Library className="w-5 h-5" /> Catégories de Paiement</CardTitle>
                    <CardDescription>Définissez les catégories (Principale, Boursière, etc.) par niveau académique.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {(['maternelle', 'primaire', 'secondaire'] as const).map(level => {
                            const levelCats = settings.paymentCategories.filter(pc => pc.level === level);
                            if (!schoolLevels[level]) return null;
                            return (
                                <div key={level} className="space-y-2">
                                    <div className="flex justify-between items-center bg-muted/20 p-2 rounded-md">
                                        <h4 className="font-bold capitalize">{level}</h4>
                                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleAddPaymentCategory(level)}>
                                            <PlusCircle className="mr-1 h-3 w-3" /> Ajouter
                                        </Button>
                                    </div>
                                    {levelCats.length === 0 && (
                                        <p className="text-sm text-muted-foreground ml-4">Aucune catégorie définie pour ce niveau.</p>
                                    )}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {levelCats.map(cat => (
                                            <div key={cat.id} className="p-3 border rounded-lg space-y-3 relative group">
                                                <div className="flex justify-between items-start">
                                                    <Input
                                                        value={cat.name}
                                                        onChange={e => handlePaymentCategoryChange(cat.id, 'name', e.target.value)}
                                                        className="h-8 font-semibold"
                                                    />
                                                    <Button variant="ghost" size="icon" onClick={() => handleRemovePaymentCategory(cat.id)} className="h-8 w-8 text-destructive">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Switch
                                                            id={`default-${cat.id}`}
                                                            checked={cat.isDefault}
                                                            onCheckedChange={checked => handlePaymentCategoryChange(cat.id, 'isDefault', checked)}
                                                        />
                                                        <Label htmlFor={`default-${cat.id}`} className="text-xs cursor-pointer">Principale (par défaut)</Label>
                                                    </div>
                                                    <Badge variant="outline" className="capitalize text-[10px]">{cat.level}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 3: Fee Items Bank */}
                <AccordionItem value="item-3" className="bg-card rounded-lg border px-1">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2">
                            <Library className="w-5 h-5" />
                            <span className="text-lg font-semibold">Banque de Frais</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2">
            <Card className="border-0 shadow-none">
                <CardHeader className="px-0 pt-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Library className="w-5 h-5" /> Banque de Frais</CardTitle>
                            <CardDescription>Créez ici tous les frais possibles (tranches, frais uniques, etc.). Ce sont les briques de base de votre facturation.</CardDescription>
                        </div>
                        <Button size="sm" onClick={handleAddFeeItem}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Ajouter un frais
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {settings.feeItems.length === 0 && (
                            <p className="text-center text-muted-foreground py-4">Aucun frais créé. Cliquez sur &quot;Ajouter un frais&quot; pour commencer.</p>
                        )}
                        {settings.feeItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md">
                                <Input
                                    placeholder="Nom du frais (ex: 1ère Tranche Minerval)"
                                    value={item.name}
                                    onChange={e => handleFeeItemChange(item.id, 'name', e.target.value)}
                                    className="h-9"
                                />
                                <Input
                                    type="number"
                                    placeholder="Montant"
                                    value={item.amount}
                                    onChange={e => handleFeeItemChange(item.id, 'amount', Number(e.target.value))}
                                    className="w-32 h-9"
                                />
                                <Select value={item.currency} onValueChange={v => handleFeeItemChange(item.id, 'currency', v)}>
                                    <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {enabledCurrencies.map(c => (
                                            <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveFeeItem(item.id)}>
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
                    </AccordionContent>
                </AccordionItem>

                {/* Section 4: Fee Categories */}
                <AccordionItem value="item-4" className="bg-card rounded-lg border px-1">
                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                        <div className="flex items-center gap-2">
                            <FolderPlus className="w-5 h-5" />
                            <span className="text-lg font-semibold">Rubriques de Frais Scolaires</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4 pt-2">
            <Card className="border-0 shadow-none">
                <CardHeader className="px-0 pt-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="flex items-center gap-2"><FolderPlus className="w-5 h-5" /> Rubriques de Frais Scolaires</CardTitle>
                            <CardDescription>Assemblez des frais de la banque pour créer des rubriques et assignez-les à des locaux de classe.</CardDescription>
                        </div>
                        <Button onClick={handleAddFeeCategory}>
                            <FolderPlus className="mr-2 h-4 w-4" /> Créer une rubrique
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {settings.feeCategories.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">Aucune rubrique créée. Créez des frais dans la banque ci-dessus, puis créez une rubrique ici.</p>
                    )}
                    {settings.feeCategories.length > 0 && (
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Rechercher une rubrique..."
                                value={rubriqueSearch}
                                onChange={e => setRubriqueSearch(e.target.value)}
                                className="pl-9 h-9"
                            />
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {settings.feeCategories.filter(cat =>
                            !rubriqueSearch || cat.name.toLowerCase().includes(rubriqueSearch.toLowerCase())
                        ).map((category, filteredIdx) => {
                            const globalIdx = settings.feeCategories.findIndex(fc => fc.id === category.id);
                            const total = getCategoryTotal(category);
                            const associatedItems = category.feeItemIds
                                .map(id => settings.feeItems.find(item => item.id === id))
                                .filter(Boolean) as FeeItem[];
                            const categoryCurrency = associatedItems.length > 0 ? associatedItems[0].currency : null;
                            const potentialItemsToAdd = settings.feeItems.filter(item =>
                                !category.feeItemIds.includes(item.id) && (categoryCurrency === null || item.currency === categoryCurrency)
                            );

                            return (
                                <Card key={category.id} className="bg-muted/30 flex flex-col">
                                    <CardHeader className="pb-4">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex flex-col gap-1 w-3/4">
                                                <Input
                                                    value={category.name}
                                                    onChange={e => handleFeeCategoryChange(category.id, 'name', e.target.value)}
                                                    className="text-lg font-bold h-10"
                                                />
                                                <div className="flex items-center gap-2">
                                                    <Label className="text-xs text-muted-foreground">Catégorie de paiement :</Label>
                                                    <Select
                                                        value={category.paymentCategoryId || ''}
                                                        onValueChange={v => handleFeeCategoryChange(category.id, 'paymentCategoryId', v)}
                                                    >
                                                        <SelectTrigger className="h-7 text-xs w-[180px]"><SelectValue placeholder="Choisir..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {settings.paymentCategories.map(pc => (
                                                                <SelectItem key={pc.id} value={pc.id}>{pc.name} ({pc.level})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <Button
                                                    variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={() => handleMoveFeeCategory(category.id, 'up')}
                                                    disabled={globalIdx === 0}
                                                    title="Monter"
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon" className="h-7 w-7"
                                                    onClick={() => handleMoveFeeCategory(category.id, 'down')}
                                                    disabled={globalIdx === settings.feeCategories.length - 1}
                                                    title="Descendre"
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveFeeCategory(category.id)}>
                                                    <X className="w-5 h-5 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="text-lg">
                                                Total:
                                                <span className="font-bold ml-2">
                                                    {total.mixed
                                                        ? <span className="text-destructive text-sm">Devises mixtes!</span>
                                                        : `${total.amount.toLocaleString()} ${total.currency || ''}`
                                                    }
                                                </span>
                                            </div>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" size="sm">Appliquer à ({category.appliesTo.length})</Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80">
                                                    <div className="space-y-2">
                                                        <h4 className="font-medium leading-none">Appliquer aux locaux</h4>
                                                        <p className="text-sm text-muted-foreground">Cochez les locaux concernés par cette rubrique.</p>
                                                    </div>
                                                    <ScrollArea className="h-40 mt-2">
                                                        <div className="grid gap-2 p-1">
                                                            {allClassrooms.map(name => (
                                                                <div key={name} className="flex items-center space-x-2">
                                                                    <Checkbox
                                                                        id={`apply-${category.id}-${name}`}
                                                                        checked={category.appliesTo.includes(name)}
                                                                        onCheckedChange={(checked) => handleCategoryClassroomToggle(category.id, name, !!checked)}
                                                                    />
                                                                    <Label htmlFor={`apply-${category.id}-${name}`} className="font-normal cursor-pointer">{name}</Label>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </ScrollArea>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3 flex-grow flex flex-col">
                                        <h4 className="font-semibold">Frais associés</h4>
                                        <div className="space-y-2 flex-grow">
                                            {associatedItems.length === 0 && (
                                                <p className="text-sm text-muted-foreground">Aucun frais associé.</p>
                                            )}
                                            {associatedItems.map(item => (
                                                <div key={item.id} className="flex justify-between items-center p-2 bg-background rounded">
                                                    <span>{item.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold">{item.amount.toLocaleString()} {item.currency}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7"
                                                            onClick={() => handleFeeCategoryChange(category.id, 'feeItemIds', category.feeItemIds.filter(id => id !== item.id))}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Separator className="my-2" />
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" size="sm" disabled={total.mixed}>
                                                    <Link2 className="mr-2 h-4 w-4" /> Associer un frais
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80">
                                                <div className="grid gap-4">
                                                    <div className="space-y-2">
                                                        <h4 className="font-medium leading-none">Ajouter un frais</h4>
                                                        <p className="text-sm text-muted-foreground">Cochez les frais à ajouter à cette rubrique.</p>
                                                    </div>
                                                    <ScrollArea className="h-40">
                                                        <div className="grid gap-2 p-1">
                                                            {potentialItemsToAdd.length === 0 && (
                                                                <p className="text-xs text-muted-foreground text-center py-2">Aucun autre frais disponible dans cette devise.</p>
                                                            )}
                                                            {potentialItemsToAdd.map(item => (
                                                                <div key={item.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                                                                    <div className="flex items-center space-x-2">
                                                                        <Checkbox
                                                                            id={`add-${category.id}-${item.id}`}
                                                                            onCheckedChange={(checked) => {
                                                                                const newIds = checked
                                                                                    ? [...category.feeItemIds, item.id]
                                                                                    : category.feeItemIds.filter(id => id !== item.id);
                                                                                handleFeeCategoryChange(category.id, 'feeItemIds', newIds);
                                                                            }}
                                                                        />
                                                                        <Label htmlFor={`add-${category.id}-${item.id}`} className="font-normal cursor-pointer">{item.name}</Label>
                                                                    </div>
                                                                    <Badge variant="secondary">{item.amount.toLocaleString()} {item.currency}</Badge>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </ScrollArea>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                        {total.mixed && (
                                            <p className="text-xs text-destructive mt-2">Veuillez retirer les frais de devises différentes pour continuer.</p>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
                    </AccordionContent>
                </AccordionItem>

                {/* MODES DE PAIEMENT ACCORDION ITEM */}
                <AccordionItem value="payment-modes" className="border-none">
                    <AccordionTrigger className="hover:no-underline [&[data-state=open]>div>div>div:first-child]:bg-primary/10 [&[data-state=open]>div>div>div:first-child]:text-primary px-2">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted text-muted-foreground transition-colors">
                                <Wallet className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <h3 className="font-semibold text-lg">Modes de Paiement</h3>
                                <p className="text-sm text-muted-foreground font-normal">Configurez les banques et services de monnaie électronique</p>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-6 px-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Banques */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div>
                                        <CardTitle className="text-base font-semibold">Banques</CardTitle>
                                        <CardDescription>Liste des banques pour les virements et versements.</CardDescription>
                                    </div>
                                    <Button onClick={handleAddBank} size="sm" variant="outline"><PlusCircle className="w-4 h-4 mr-2" /> Ajouter</Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 mt-4">
                                        {(!settings.banks || settings.banks.length === 0) && (
                                            <p className="text-sm text-muted-foreground text-center py-4">Aucune banque configurée.</p>
                                        )}
                                        {settings.banks?.map(bank => (
                                            <div key={bank.id} className="flex items-center gap-2">
                                                <Input 
                                                    value={bank.name} 
                                                    onChange={e => handleBankChange(bank.id, e.target.value)} 
                                                    placeholder="Nom de la banque" 
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveBank(bank.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Monnaie Électronique */}
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div>
                                        <CardTitle className="text-base font-semibold">Monnaie Électronique</CardTitle>
                                        <CardDescription>Services de paiement mobile (ex: M-Pesa).</CardDescription>
                                    </div>
                                    <Button onClick={handleAddElectronicProvider} size="sm" variant="outline"><PlusCircle className="w-4 h-4 mr-2" /> Ajouter</Button>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3 mt-4">
                                        {(!settings.electronicProviders || settings.electronicProviders.length === 0) && (
                                            <p className="text-sm text-muted-foreground text-center py-4">Aucun service configuré.</p>
                                        )}
                                        {settings.electronicProviders?.map(ep => (
                                            <div key={ep.id} className="flex items-center gap-2">
                                                <Input 
                                                    value={ep.name} 
                                                    onChange={e => handleElectronicProviderChange(ep.id, e.target.value)} 
                                                    placeholder="Nom du service (ex: M-Pesa)" 
                                                />
                                                <Button variant="ghost" size="icon" onClick={() => handleRemoveElectronicProvider(ep.id)} className="text-destructive">
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );
}
