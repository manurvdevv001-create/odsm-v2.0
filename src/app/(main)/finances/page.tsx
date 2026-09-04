// src/app/(main)/finances/page.tsx
'use client';

import { useState, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BookOpen, LineChart, ListTree, PieChart, ArrowRightLeft } from 'lucide-react';
import { useSchoolData } from "@/components/providers/SchoolDataProvider";
import { isFinanceRestricted, isFinanceJournalHidden, isSupervisorRole } from "@/lib/role-permissions";
import { CashJournal } from '@/components/finance/cash-journal';
import { ClassSummary } from '@/components/finance/class-summary';
import { AllTransactions } from '@/components/finance/all-transactions';
import { PaymentReceiptDialog } from '@/components/finance/payment-receipt-dialog';
import { AdvancedReports } from '@/components/finance/advanced-reports';
import { StudentCategorization } from '@/components/finance/student-categorization';
import { Payment, Student } from '@/types';


export default function FinancesPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { schoolData, isLoading, refreshData, selectedYear, yearState } = useSchoolData();

    const isReadOnly = yearState !== "active";
    const userRole = ((useSchoolData().user?.role as string) || "").toUpperCase();
    const restrictedFinance = isFinanceRestricted(userRole);
    const hideJournal = isFinanceJournalHidden(userRole);
    const isSupervisor = isSupervisorRole(userRole);

    const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

    const defaultTab = hideJournal ? 'summary' : 'journal';
    const activeTab = searchParams.get('tab') || defaultTab;

    const setActiveTab = useCallback((value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', value);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router, searchParams]);

    if (isLoading || !schoolData) {
        return (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Chargement des données financières...</p>
            </div>
        );
    }

    const studentForPayment = selectedPayment ? (schoolData as any).students?.find((s: Student) => s.id === selectedPayment.studentId) : null;

    return (
        <>
            <div className="flex flex-col gap-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-headline font-bold text-primary">Gestion Financière</h1>
                        <p className="text-muted-foreground text-sm sm:text-base">Enregistrez les paiements et suivez la situation financière.</p>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="w-full flex justify-start h-auto p-1 bg-muted/50 overflow-x-auto no-scrollbar whitespace-nowrap">
                        {!hideJournal && (
                            <TabsTrigger value="journal" className="flex-shrink-0"><BookOpen className="mr-2 h-4 w-4" /> Journal</TabsTrigger>
                        )}
                        <TabsTrigger value="summary" className="flex-shrink-0"><LineChart className="mr-2 h-4 w-4" /> Classes</TabsTrigger>
                        <TabsTrigger value="transactions" className="flex-shrink-0"><ListTree className="mr-2 h-4 w-4" /> Transactions</TabsTrigger>
                        {!restrictedFinance && (
                            <TabsTrigger value="categorization" className="flex-shrink-0"><ArrowRightLeft className="mr-2 h-4 w-4" /> Catégories</TabsTrigger>
                        )}
                        {!restrictedFinance && (
                            <TabsTrigger value="reports" className="flex-shrink-0"><PieChart className="mr-2 h-4 w-4" /> Rapports</TabsTrigger>
                        )}
                    </TabsList>

                    {!hideJournal && (
                        <TabsContent value="journal" className="mt-4">
                            <CashJournal schoolData={schoolData} refreshData={refreshData} isReadOnly={!!isReadOnly} />
                        </TabsContent>
                    )}

                    <TabsContent value="summary" className="mt-4">
                        <ClassSummary schoolData={schoolData} />
                    </TabsContent>

                    <TabsContent value="transactions" className="mt-4">
                        <AllTransactions schoolData={schoolData} onRowClick={setSelectedPayment} />
                    </TabsContent>

                    {!restrictedFinance && (
                        <TabsContent value="categorization" className="mt-4">
                            <StudentCategorization schoolData={schoolData} refreshData={refreshData} />
                        </TabsContent>
                    )}

                    {!restrictedFinance && (
                        <TabsContent value="reports" className="mt-4">
                            <AdvancedReports schoolData={schoolData} />
                        </TabsContent>
                    )}
                </Tabs>
            </div>
            {selectedPayment && studentForPayment && (
                <PaymentReceiptDialog
                    isOpen={!!selectedPayment}
                    onClose={() => setSelectedPayment(null)}
                    payment={selectedPayment}
                    student={studentForPayment}
                    schoolData={schoolData as any}
                />
            )}
        </>
    )
}
