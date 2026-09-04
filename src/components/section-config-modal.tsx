'use client';

import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfiguredOption, OptionClass } from '@/types/post-cteb-types';
import { sections, options, sectionCategories, cycles } from '@/constants/sections';

interface SectionConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (configuredOptions: ConfiguredOption[]) => void;
    existingOptions: ConfiguredOption[];
}

export function SectionConfigModal({ isOpen, onClose, onSave, existingOptions }: SectionConfigModalProps) {
    const [configuredOptions, setConfiguredOptions] = useState<ConfiguredOption[]>(existingOptions || []);

    // Wizard state
    const [step, setStep] = useState<'category' | 'section' | 'option' | 'classes'>('category');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
    const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

    const configuredOptionIds = new Set(configuredOptions.map(opt => opt.optionId));

    const resetWizard = () => {
        setStep('category');
        setSelectedCategoryId(null);
        setSelectedSectionId(null);
        setSelectedOptionId(null);
        setSelectedClasses([]);
    };

    const handleCategorySelect = (categoryId: number) => {
        setSelectedCategoryId(categoryId);
        setStep('section');
    };

    const handleSectionSelect = (sectionId: number) => {
        setSelectedSectionId(sectionId);
        setStep('option');
    };

    const handleOptionSelect = (optionId: number) => {
        setSelectedOptionId(optionId);
        setStep('classes');
    };

    const handleClassToggle = (className: string) => {
        setSelectedClasses(prev =>
            prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className]
        );
    };

    const handleAddOption = () => {
        if (!selectedOptionId || selectedClasses.length === 0) return;

        const optionData = options.find(o => o.option_id === selectedOptionId);
        if (!optionData) return;

        const sectionData = sections.find(s => s.section_id === selectedSectionId);
        const isProfessionnel = optionData.specialty.toLowerCase().includes('professionnel') ||
            sectionData?.section_name.toLowerCase().includes('professionnel');

        const type: 'humanite' | 'professionnel' = isProfessionnel ? 'professionnel' : 'humanite';

        const classes: OptionClass[] = selectedClasses.map(cls => {
            const gradeNum = parseInt(cls.replace('ere', '').replace('eme', ''));
            let gradeName = '';

            if (type === 'professionnel') {
                gradeName = gradeNum === 1 ? '1ère Professionnelle' : '2ème Professionnelle';
            } else {
                const ordinalMap: Record<number, string> = { 1: '1ère', 2: '2ème', 3: '3ème', 4: '4ème' };
                gradeName = `${ordinalMap[gradeNum]} Humanité`;
            }

            return {
                id: Math.random().toString(36).substring(2, 9),
                grade: gradeName,
                gradeNumber: gradeNum,
                code: '',
                classrooms: 1,
                assignedCodes: []
            };
        });

        const newOption: ConfiguredOption = {
            id: Date.now().toString(),
            optionId: optionData.option_id.toString(),
            optionName: optionData.specialty,
            sectionName: sectionData?.section_name || '',
            type,
            classes,
            sequenceOrder: configuredOptions.length
        };

        setConfiguredOptions([...configuredOptions, newOption]);
        resetWizard();
    };

    const handleSave = () => {
        onSave(configuredOptions);
        onClose();
    };

    const handleClose = () => {
        setConfiguredOptions(existingOptions || []);
        resetWizard();
        onClose();
    };

    const handleBack = () => {
        if (step === 'section') {
            setStep('category');
            setSelectedSectionId(null);
        } else if (step === 'option') {
            setStep('section');
            setSelectedOptionId(null);
        } else if (step === 'classes') {
            setStep('option');
            setSelectedClasses([]);
        }
    };

    const handleRemoveOption = (optionId: string) => {
        setConfiguredOptions(prev => prev.filter(opt => opt.id !== optionId));
    };

    // Filter data
    const availableSections = selectedCategoryId
        ? sections.filter(s => s.section_cat_id === selectedCategoryId)
        : [];

    const availableOptions = selectedSectionId
        ? options.filter(o =>
            o.section_id === selectedSectionId &&
            !configuredOptionIds.has(o.option_id.toString())
        )
        : [];

    const stepNumber = step === 'category' ? 1 : step === 'section' ? 2 : step === 'option' ? 3 : 4;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <div className="bg-background rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold">Configuration Post CTEB</h2>
                        <div className="flex items-center gap-2 mt-2">
                            {[1, 2, 3, 4].map(n => (
                                <div key={n} className="flex items-center gap-1">
                                    <div className={`h-2 w-8 rounded-full transition-colors ${n <= stepNumber ? 'bg-primary' : 'bg-muted'}`} />
                                </div>
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">Étape {stepNumber}/4</span>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-muted rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Step 1: Category */}
                    {step === 'category' && (
                        <div className="space-y-3">
                            <h3 className="font-bold mb-4">Sélectionnez une catégorie</h3>
                            {sectionCategories.map(category => (
                                <button
                                    key={category.section_cat_id}
                                    onClick={() => handleCategorySelect(category.section_cat_id)}
                                    className="w-full p-4 border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left group flex justify-between items-center"
                                >
                                    <div>
                                        <div className="font-semibold group-hover:text-primary transition-colors">
                                            {category.section_cat_name}
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            Cycle {cycles.find(c => c.cycle_id === category.cycle_id)?.cycle_term}
                                        </div>
                                    </div>
                                    <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" size={18} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Section */}
                    {step === 'section' && (
                        <div className="space-y-3">
                            <h3 className="font-bold mb-4">Sélectionnez une section</h3>
                            {availableSections.map(section => (
                                <button
                                    key={section.section_id}
                                    onClick={() => handleSectionSelect(section.section_id)}
                                    className="w-full p-4 border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left group flex justify-between items-center"
                                >
                                    <span className="font-semibold group-hover:text-primary transition-colors">
                                        {section.section_name}
                                    </span>
                                    <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" size={18} />
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Step 3: Option */}
                    {step === 'option' && (
                        <div className="space-y-3">
                            <h3 className="font-bold mb-4">Sélectionnez une option</h3>
                            {availableOptions.length === 0 ? (
                                <div className="text-center py-10 text-muted-foreground">
                                    <p className="font-medium">Toutes les options de cette section sont déjà configurées.</p>
                                    <p className="text-sm mt-2">Veuillez choisir une autre section.</p>
                                </div>
                            ) : (
                                availableOptions.map(option => (
                                    <button
                                        key={option.option_id}
                                        onClick={() => handleOptionSelect(option.option_id)}
                                        className="w-full p-4 border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-all text-left group flex justify-between items-center"
                                    >
                                        <span className="font-semibold group-hover:text-primary transition-colors">
                                            {option.specialty}
                                        </span>
                                        <ChevronRight className="text-muted-foreground group-hover:text-primary transition-colors" size={18} />
                                    </button>
                                ))
                            )}
                        </div>
                    )}

                    {/* Step 4: Classes */}
                    {step === 'classes' && (() => {
                        const optionData = options.find(o => o.option_id === selectedOptionId);
                        const sectionData = sections.find(s => s.section_id === selectedSectionId);
                        const isProfessionnel = optionData?.specialty.toLowerCase().includes('professionnel') ||
                            sectionData?.section_name.toLowerCase().includes('professionnel');

                        const availableClasses = isProfessionnel
                            ? ['1ere', '2eme']
                            : ['1ere', '2eme', '3eme', '4eme'];

                        const classLabels: Record<string, string> = {
                            '1ere': '1ère année',
                            '2eme': '2ème année',
                            '3eme': '3ème année',
                            '4eme': '4ème année',
                        };

                        return (
                            <div className="space-y-4">
                                <div>
                                    <h3 className="font-bold mb-1">Sélectionnez les classes</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Choisissez les niveaux pour <span className="font-semibold text-primary">{optionData?.specialty}</span>.
                                    </p>
                                    <p className="text-xs text-primary font-semibold mt-1">
                                        {isProfessionnel ? 'Cycle Court (Professionnel) : 2 années' : 'Cycle Long (Humanités) : 4 années'}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {availableClasses.map(cn => (
                                        <button
                                            key={cn}
                                            onClick={() => handleClassToggle(cn)}
                                            className={`p-5 border-2 rounded-xl transition-all font-bold text-base flex items-center justify-between
                                                ${selectedClasses.includes(cn)
                                                    ? 'border-primary bg-primary/5 text-primary'
                                                    : 'border-border hover:border-primary/30 text-foreground'
                                                }`}
                                        >
                                            <span>{classLabels[cn] || cn}</span>
                                            {selectedClasses.includes(cn) && <Check size={20} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Configured options summary */}
                    {configuredOptions.length > 0 && (
                        <div className="mt-6 p-4 bg-primary/5 rounded-xl border border-primary/20">
                            <h4 className="text-sm font-semibold mb-2">
                                Options configurées ({configuredOptions.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {configuredOptions.map(opt => (
                                    <div
                                        key={opt.id}
                                        className="text-xs px-3 py-1.5 bg-background rounded-lg border flex items-center gap-2"
                                    >
                                        <span>{opt.optionName}</span>
                                        <span className="text-muted-foreground">({opt.sectionName})</span>
                                        <button
                                            onClick={() => handleRemoveOption(opt.id)}
                                            className="p-0.5 hover:bg-destructive/20 rounded text-destructive"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t flex justify-between">
                    <Button
                        variant="outline"
                        onClick={step === 'category' ? handleClose : handleBack}
                        className="rounded-xl"
                    >
                        {step === 'category' ? 'Annuler' : <><ChevronLeft size={16} className="mr-1" /> Retour</>}
                    </Button>
                    <div className="flex gap-2">
                        {step === 'classes' && (
                            <Button
                                onClick={handleAddOption}
                                disabled={selectedClasses.length === 0}
                                className="rounded-xl bg-green-600 hover:bg-green-700"
                            >
                                <Check size={16} className="mr-1" /> Ajouter
                            </Button>
                        )}
                        {configuredOptions.length > 0 && (
                            <Button
                                onClick={handleSave}
                                className="rounded-xl"
                            >
                                Enregistrer ({configuredOptions.length})
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
