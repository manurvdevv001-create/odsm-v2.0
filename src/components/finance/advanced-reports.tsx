
// src/components/finance/advanced-reports.tsx
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PieChart, Search, Printer } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Student, FeeItem, FeeCategory } from '@/types';
import Link from 'next/link';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAllClassrooms } from '@/lib/classroom-utils';

interface AdvancedReportsProps {
    schoolData: any;
}

type StudentFinancialRecord = {
    student: Student;
    fee?: FeeItem | { id: string; name: string; amount: number; currency: string };
    categoryName?: string;
    totalPaid: number;
    totalDue: number;
    balance: number;
    percentagePaid: number;
    currency: string;
};

export function AdvancedReports({ schoolData }: AdvancedReportsProps) {
    const [filters, setFilters] = useState<{
        classroom: string;
        rubriques: string[];
        frais: string[];
        currency: string;
        status: 'insolvent' | 'paid_up' | 'percentage';
        percentageCondition: 'less_than' | 'equal_to' | 'more_than';
        percentage: number;
        detailByFee: boolean;
    }>({
        classroom: 'all',
        rubriques: [],
        frais: [],
        currency: 'all',
        status: 'insolvent',
        percentageCondition: 'less_than',
        percentage: 50,
        detailByFee: true,
    });
    const [results, setResults] = useState<StudentFinancialRecord[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const { classrooms, feeItems, feeCategories, currencies } = useMemo(() => {
        const allClassrooms = schoolData ? getAllClassrooms(schoolData) : [];
        let items = schoolData?.financeSettings?.feeItems || [];
        let cats = schoolData?.financeSettings?.feeCategories || [];
        const currs = (schoolData?.financeSettings?.currencies || []).filter((c: any) => c.enabled);

        if (filters.classroom !== 'all') {
            cats = cats.filter((c: FeeCategory) => c.appliesTo.includes(filters.classroom));
            const catItemIds = new Set(cats.flatMap((c: FeeCategory) => c.feeItemIds));
            items = items.filter((i: FeeItem) => catItemIds.has(i.id));
        }

        if (filters.currency !== 'all') {
            items = items.filter((i: FeeItem) => i.currency === filters.currency);
        }

        return {
            classrooms: allClassrooms.sort(),
            feeItems: items,
            feeCategories: cats,
            currencies: currs,
        };
    }, [schoolData, filters.classroom, filters.currency]);

    const studentFinancialData = useMemo((): StudentFinancialRecord[] => {
        const records: StudentFinancialRecord[] = [];
        const students = schoolData?.students || [];
        const payments = schoolData?.payments || [];
        const financeSettings = schoolData?.financeSettings;

        if (!financeSettings) return [];

        students.forEach((student: Student) => {
            if (student.status !== 'active') return;

            const studentPayments = payments.filter((p: any) => p.studentId === student.id);

            const applicableCategories = (financeSettings.feeCategories || []).filter((cat: FeeCategory) => cat.appliesTo.includes(student.classroomName!));

            applicableCategories.forEach((cat: FeeCategory) => {
                const categoryItems = cat.feeItemIds.map((id: string) => (financeSettings.feeItems || []).find((item: FeeItem) => item.id === id)).filter(Boolean) as FeeItem[];

                categoryItems.forEach((item: FeeItem) => {
                    const paymentsForItem = studentPayments.flatMap((p: any) => (p.details || []).filter((d: any) => d.feeItemId === item.id));
                    const totalPaid = paymentsForItem.reduce((sum: number, d: any) => sum + (d.amountPaid || 0) + (d.dispensationAmount || 0), 0);

                    records.push({
                        student,
                        fee: item,
                        categoryName: cat.name,
                        totalDue: item.amount,
                        totalPaid,
                        balance: item.amount - totalPaid,
                        percentagePaid: item.amount > 0 ? (totalPaid / item.amount) * 100 : 100,
                        currency: item.currency,
                    });
                });
            });
        });
        return records;
    }, [schoolData]);

    const handleSearch = () => {
        setIsSearching(true);
        let filteredData = [...studentFinancialData];

        if (filters.currency !== 'all') {
            filteredData = filteredData.filter(r => r.currency === filters.currency);
        }

        if (filters.classroom !== 'all') {
            filteredData = filteredData.filter(r => r.student.classroomName === filters.classroom);
        }

        if (filters.rubriques.length > 0) {
            const allowedItems = new Set(feeCategories.filter((c: FeeCategory) => filters.rubriques.includes(c.id)).flatMap((c: FeeCategory) => c.feeItemIds));
            filteredData = filteredData.filter(r => r.fee && allowedItems.has(r.fee.id));
        }

        if (filters.frais.length > 0) {
            filteredData = filteredData.filter(r => r.fee && filters.frais.includes(r.fee.id));
        }

        let finalResults: StudentFinancialRecord[];

        if (filters.detailByFee) {
            finalResults = filteredData;
        } else {
            const aggregated: Record<string, StudentFinancialRecord> = {};
            filteredData.forEach(record => {
                const key = record.student.id;
                if (!aggregated[key]) {
                    aggregated[key] = {
                        student: record.student,
                        totalDue: 0,
                        totalPaid: 0,
                        balance: 0,
                        percentagePaid: 0,
                        currency: record.currency,
                    };
                }
                aggregated[key].totalDue += record.totalDue;
                aggregated[key].totalPaid += record.totalPaid;
                aggregated[key].balance += record.balance;
            });

            finalResults = Object.values(aggregated).map(record => {
                record.percentagePaid = record.totalDue > 0 ? (record.totalPaid / record.totalDue) * 100 : 100;
                return record;
            });
        }

        if (filters.status === 'insolvent') {
            finalResults = finalResults.filter(r => r.balance > 0);
        } else if (filters.status === 'paid_up') {
            finalResults = finalResults.filter(r => r.balance <= 0);
        } else if (filters.status === 'percentage') {
            finalResults = finalResults.filter(r => {
                const percentage = r.percentagePaid;
                if (filters.percentageCondition === 'less_than') return percentage < filters.percentage;
                if (filters.percentageCondition === 'equal_to') return Math.round(percentage) === filters.percentage;
                if (filters.percentageCondition === 'more_than') return percentage > filters.percentage;
                return false;
            });
        }

        setResults(finalResults);
        setIsSearching(false);
    };

    // --- MONTHLY REVENUE LOGIC ---
    const monthlyData = useMemo<{
        months: string[];
        currencies: string[];
        levels: string[];
        data: Record<string, Record<string, { total: number; byLevel: Record<string, number> }>>;
        grandTotals: Record<string, { total: number; byLevel: Record<string, number> }>;
    }>(() => {
        if (!schoolData?.payments) return { months: [], currencies: [], levels: [], data: {}, grandTotals: {} };
 
        const payments = schoolData.payments;
        const students = schoolData.students || [];
        const studentMap = new Map<string, Student>(students.map((s: Student) => [s.id, s]));

        const data: Record<string, Record<string, { total: number; byLevel: Record<string, number> }>> = {};
        const allMonths = new Set<string>();
        const allCurrencies = new Set<string>();
        const allLevels = new Set<string>();

        payments.forEach((p: any) => {
            if (!p.totalAmountPaid || p.totalAmountPaid <= 0) return;

            const date = new Date(p.date);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM
            const currency = p.currency || 'USD';
            
            let level = 'Inconnu';
            if (p.studentId) {
                const student = studentMap.get(p.studentId);
                if (student?.level) {
                    level = student.level;
                }
            }

            allMonths.add(monthStr);
            allCurrencies.add(currency);
            allLevels.add(level);

            if (!data[currency]) data[currency] = {};
            if (!data[currency][monthStr]) data[currency][monthStr] = { total: 0, byLevel: {} };
            
            data[currency][monthStr].total += p.totalAmountPaid;
            
            if (!data[currency][monthStr].byLevel[level]) {
                data[currency][monthStr].byLevel[level] = 0;
            }
            data[currency][monthStr].byLevel[level] += p.totalAmountPaid;
        });

        // Compute grand totals
        const grandTotals: Record<string, { total: number; byLevel: Record<string, number> }> = {};
        allCurrencies.forEach(curr => {
            grandTotals[curr] = { total: 0, byLevel: {} };
            if (data[curr]) {
                Object.values(data[curr]).forEach(monthData => {
                    grandTotals[curr].total += monthData.total;
                    Object.entries(monthData.byLevel).forEach(([lvl, amount]) => {
                        if (!grandTotals[curr].byLevel[lvl]) grandTotals[curr].byLevel[lvl] = 0;
                        grandTotals[curr].byLevel[lvl] += amount as number;
                    });
                });
            }
        });

        return {
            months: Array.from(allMonths).sort().reverse(), // latest first
            currencies: Array.from(allCurrencies),
            levels: Array.from(allLevels).sort(),
            data,
            grandTotals
        };
    }, [schoolData]);

    const [selectedRevCurrency, setSelectedRevCurrency] = useState<string>('');
    
    // Set default currency if not set
    if (!selectedRevCurrency && monthlyData.currencies.length > 0) {
        setSelectedRevCurrency(monthlyData.currencies[0]);
    }

    return (
        <Tabs defaultValue="situation" className="w-full">
            <div className="flex items-center justify-between mb-4">
                <TabsList>
                    <TabsTrigger value="situation">Situation des Élèves</TabsTrigger>
                    <TabsTrigger value="revenu">Revenus Mensuels</TabsTrigger>
                </TabsList>
            </div>
            
            <TabsContent value="situation" className="m-0">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PieChart /> Contrôle et Rapports Financiers</CardTitle>
                        <CardDescription>
                            Utilisez les filtres pour générer des rapports précis sur la situation financière des élèves.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 border rounded-lg bg-muted/50 space-y-4 md:space-y-0 md:grid md:grid-cols-4 md:gap-4 md:items-end">
                            <div className="space-y-1">
                                <Label>Classe</Label>
                                <Select value={filters.classroom} onValueChange={v => setFilters(f => ({ ...f, classroom: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les classes</SelectItem>
                                        {classrooms.map((c: string) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label>Rubrique</Label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between font-normal text-left truncate">
                                            {filters.rubriques.length === 0 ? 'Toutes les rubriques' : `${filters.rubriques.length} sélectionnée(s)`}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56">
                                        <DropdownMenuCheckboxItem
                                            checked={filters.rubriques.length === 0}
                                            onCheckedChange={() => setFilters(f => ({ ...f, rubriques: [] }))}
                                        >
                                            Toutes les rubriques
                                        </DropdownMenuCheckboxItem>
                                        {feeCategories.map((c: FeeCategory) => (
                                            <DropdownMenuCheckboxItem
                                                key={c.id}
                                                checked={filters.rubriques.includes(c.id)}
                                                onCheckedChange={(checked) => {
                                                    setFilters(f => {
                                                        const rub = checked ? [...f.rubriques, c.id] : f.rubriques.filter(id => id !== c.id);
                                                        return { ...f, rubriques: rub };
                                                    });
                                                }}
                                            >
                                                {c.name}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            
                            <div className="space-y-1">
                                <Label>Frais</Label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="outline" className="w-full justify-between font-normal text-left truncate">
                                            {filters.frais.length === 0 ? 'Tous les frais' : `${filters.frais.length} sélectionné(s)`}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56 max-h-64 overflow-y-auto">
                                        <DropdownMenuCheckboxItem
                                            checked={filters.frais.length === 0}
                                            onCheckedChange={() => setFilters(f => ({ ...f, frais: [] }))}
                                        >
                                            Tous les frais
                                        </DropdownMenuCheckboxItem>
                                        {feeItems.map((i: FeeItem) => (
                                            <DropdownMenuCheckboxItem
                                                key={i.id}
                                                checked={filters.frais.includes(i.id)}
                                                onCheckedChange={(checked) => {
                                                    setFilters(f => {
                                                        const fraisList = checked ? [...f.frais, i.id] : f.frais.filter(id => id !== i.id);
                                                        return { ...f, frais: fraisList };
                                                    });
                                                }}
                                            >
                                                {i.name}
                                            </DropdownMenuCheckboxItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div className="space-y-1">
                                <Label>Devise</Label>
                                <Select value={filters.currency} onValueChange={v => setFilters(f => ({ ...f, currency: v }))}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Toutes les devises</SelectItem>
                                        {currencies.map((c: any) => <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1 flex items-center gap-2 pt-5">
                                <Switch id="detail-switch" checked={filters.detailByFee} onCheckedChange={c => setFilters(f => ({ ...f, detailByFee: c }))} />
                                <Label htmlFor="detail-switch">Détailler par frais</Label>
                            </div>
                            <div className="col-span-full md:col-span-3 space-y-2">
                                <RadioGroup
                                    value={filters.status}
                                    onValueChange={(v: 'insolvent' | 'paid_up' | 'percentage') => setFilters(f => ({ ...f, status: v }))}
                                    className="flex gap-4"
                                >
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="insolvent" id="r1" /><Label htmlFor="r1">Insolvables</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="paid_up" id="r2" /><Label htmlFor="r2">En ordre</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="percentage" id="r3" /><Label htmlFor="r3">Par pourcentage</Label></div>
                                </RadioGroup>
                                {filters.status === 'percentage' && (
                                    <div className="p-3 bg-background rounded-md flex items-center gap-4">
                                        <Select value={filters.percentageCondition} onValueChange={(v: 'less_than' | 'equal_to' | 'more_than') => setFilters(f => ({ ...f, percentageCondition: v }))}>
                                            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="less_than">Moins de</SelectItem>
                                                <SelectItem value="equal_to">Égal à</SelectItem>
                                                <SelectItem value="more_than">Plus de</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Slider value={[filters.percentage]} onValueChange={v => setFilters(f => ({ ...f, percentage: v[0] }))} max={100} step={1} />
                                        <span className="font-bold w-12 text-center">{filters.percentage}%</span>
                                    </div>
                                )}
                            </div>
                            <div className="col-span-full md:col-span-1 flex gap-2">
                                <Button onClick={handleSearch} disabled={isSearching} className="w-full">
                                    <Search className="mr-2" /> {isSearching ? 'Recherche...' : 'Appliquer'}
                                </Button>
                                <Button onClick={() => window.print()} variant="outline" className="px-3" title="Imprimer le rapport">
                                    <Printer className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="mt-6">
                            <h3 className="font-semibold mb-2">Résultats ({results.length})</h3>
                            <div className="border rounded-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Élève</TableHead>
                                            <TableHead>Classe</TableHead>
                                            {filters.detailByFee && <TableHead>Frais concerné</TableHead>}
                                            <TableHead className="text-right">Dû</TableHead>
                                            <TableHead className="text-right">Payé</TableHead>
                                            <TableHead className="text-right">Solde</TableHead>
                                            <TableHead>% Payé</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.length === 0 ? (
                                            <TableRow><TableCell colSpan={filters.detailByFee ? 7 : 6} className="text-center h-24">Aucun résultat. Essayez d'autres filtres.</TableCell></TableRow>
                                        ) : (
                                            results.map((r, index) => (
                                                <TableRow key={`${r.student.id}-${r.fee?.id || 'agg'}-${index}`}>
                                                    <TableCell className="font-medium">
                                                        <Link href={`/students/${r.student.id}`} className="hover:underline text-primary">
                                                            {r.student.lastName} {r.student.firstName}
                                                        </Link>
                                                    </TableCell>
                                                    <TableCell>{r.student.classroomName}</TableCell>
                                                    {filters.detailByFee && <TableCell>{r.fee?.name}</TableCell>}
                                                    <TableCell className="text-right">{r.totalDue.toLocaleString()} <Badge variant="secondary" className="text-xs">{r.currency}</Badge></TableCell>
                                                    <TableCell className="text-right">{r.totalPaid.toLocaleString()} <Badge variant="secondary" className="text-xs">{r.currency}</Badge></TableCell>
                                                    <TableCell className="text-right font-bold text-destructive">{r.balance.toLocaleString()} <Badge variant="secondary" className="text-xs">{r.currency}</Badge></TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Progress value={r.percentagePaid} className="w-24" />
                                                            <span className="text-xs font-mono">{Math.round(r.percentagePaid)}%</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="revenu" className="m-0">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><PieChart /> Revenus Mensuels</CardTitle>
                        <CardDescription>
                            Rapports des revenus perçus par mois et par niveau académique.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {monthlyData.currencies.length > 0 ? (
                            <div className="space-y-6">
                                <div className="w-64">
                                    <Label>Devise</Label>
                                    <Select value={selectedRevCurrency} onValueChange={setSelectedRevCurrency}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {monthlyData.currencies.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="border rounded-md overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Mois</TableHead>
                                                {monthlyData.levels.map(l => (
                                                    <TableHead key={l} className="text-right whitespace-nowrap">{l}</TableHead>
                                                ))}
                                                <TableHead className="text-right bg-muted/50 font-bold">Total Établissement</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {monthlyData.months.map(month => {
                                                const monthData = monthlyData.data[selectedRevCurrency]?.[month] || { total: 0, byLevel: {} };
                                                const date = new Date(month + '-01');
                                                const monthLabel = date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
                                                
                                                return (
                                                    <TableRow key={month}>
                                                        <TableCell className="font-medium capitalize">{monthLabel}</TableCell>
                                                        {monthlyData.levels.map(l => (
                                                            <TableCell key={l} className="text-right">
                                                                {(monthData.byLevel[l] || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground">{selectedRevCurrency}</span>
                                                            </TableCell>
                                                        ))}
                                                        <TableCell className="text-right bg-muted/20 font-bold text-primary">
                                                            {monthData.total.toLocaleString()} <span className="text-[10px] text-muted-foreground">{selectedRevCurrency}</span>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                        <tfoot className="bg-muted/50 font-bold">
                                            <TableRow>
                                                <TableCell>TOTAL GÉNÉRAL</TableCell>
                                                {monthlyData.levels.map(l => {
                                                    const totalLvl = monthlyData.grandTotals[selectedRevCurrency]?.byLevel[l] || 0;
                                                    return (
                                                        <TableCell key={l} className="text-right">
                                                            {totalLvl.toLocaleString()} <span className="text-[10px] text-muted-foreground">{selectedRevCurrency}</span>
                                                        </TableCell>
                                                    )
                                                })}
                                                <TableCell className="text-right text-primary">
                                                    {(monthlyData.grandTotals[selectedRevCurrency]?.total || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground">{selectedRevCurrency}</span>
                                                </TableCell>
                                            </TableRow>
                                        </tfoot>
                                    </Table>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground border rounded-md bg-muted/10">
                                <PieChart className="w-12 h-12 mb-4 opacity-20" />
                                <p>Aucun revenu enregistré pour générer ce rapport.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    );
}
