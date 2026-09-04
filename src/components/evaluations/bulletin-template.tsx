"use client";

import React, { useMemo } from "react";
import Image from "next/image";
import { Course } from "@/types";
import { cn } from "@/lib/utils";
import OdsmLogo from "../odsm-logo";

export interface BulletinStudentData {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    matricule: string;
    photo?: string | null;
    conduct?: string;
    application?: string;
    enafepScore?: number;
    stateExamScore?: number;
    jurySchoolScore?: number;
    juryExamScore?: number;
    juryLesson1?: number;
    juryLesson2?: number;
}

export interface PeriodScore {
    periodId?: string;
    periodName: string;
    score: number | null; // null if absent/empty, -888 if vide
    max: number; // max points for this period/course
    isSimulation?: boolean; // if filled by simulation
}

export interface BulletinData {
    student: BulletinStudentData;
    classroomName: string;
    level: string;
    schoolYear: string;
    courses: Course[];
    schoolData: any;
    performanceData: {
        [courseName: string]: PeriodScore[];
    };
    config: {
        isSecondary: boolean;
        isMaternelle?: boolean;
        isSimulationMode: boolean;
        title?: string;
        ranks?: any;
    };
}

const normalize = (str: string) => str ? str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() : "";

export const MATERNELLE_OFFICIAL_MAP: Record<string, string> = {
    "activites sensorielles": "GROUPE I : EDUCATION SENSORIELLE",
    "activites musicales": "GROUPE I : EDUCATION SENSORIELLE",
    "activites psychomotrices": "GROUPE II : EDUCATION PHYSIQUE ET MOTRICE",
    "activites physiques": "GROUPE II : EDUCATION PHYSIQUE ET MOTRICE",
    "ed. phys. & sportive": "GROUPE II : EDUCATION PHYSIQUE ET MOTRICE",
    "activites de comportement": "GROUPE III : EDUCATION SOCIALE",
    "activites de vie pratique": "GROUPE III : EDUCATION SOCIALE",
    "activites de promotion de la sante": "GROUPE III : EDUCATION SOCIALE",
    "activites exploratoires": "GROUPE IV : EDUCATION INTELLECTUELLE",
    "activites de langage": "GROUPE IV : EDUCATION INTELLECTUELLE",
    "activites mathematiques": "GROUPE IV : EDUCATION INTELLECTUELLE",
    "activites libres": "GROUPE IV : EDUCATION INTELLECTUELLE",
};

export function BulletinTemplate({ data }: { data: BulletinData }) {
    const { student, classroomName, schoolYear, courses, schoolData, performanceData, config } = data;
    const { isSecondary, isMaternelle } = config;

    // Helper for subdomain totals
    const calculateSubdomainTotal = (domainCourses: any[], identifiers: string[]) => {
        let rawTotal = 0;
        let hasVal = false;
        domainCourses.forEach(course => {
            identifiers.forEach(id => {
                const sList = performanceData[course.name] || [];
                const t = sList.find(s => (s.periodId && s.periodId.includes(id)) || normalize(s.periodName).includes(id));
                if (t && t.score !== null && t.score !== -999 && t.score !== -888) {
                    rawTotal += t.score;
                    hasVal = true;
                }
            });
        });
        if (!hasVal) return "";
        return Number.isInteger(rawTotal) ? rawTotal.toString() : rawTotal.toFixed(1);
    };

    // Group courses by Domaine -> Sous-Domaine
    const groupedCourses = useMemo(() => {
        const domains: Record<string, Record<string, Course[]>> = {};
        
        // Sort courses to keep stable order
        const sortedCourses = [...courses].sort((a, b) => a.name.localeCompare(b.name));

        sortedCourses.forEach(c => {
            let d = 'AUTRES BRANCHES';
            let sd = 'Branches Générales';
            
            if (isMaternelle) {
                const normName = normalize(c.name);
                d = MATERNELLE_OFFICIAL_MAP[normName] || 'AUTRES BRANCHES';
                sd = 'Branches Générales'; // No subdomains in Maternelle groups for simplicity
            } else {
                d = c.domaine ? c.domaine.toUpperCase() : 'AUTRES BRANCHES';
                sd = c.sousDomaine || 'Branches Générales';
            }

            if (!domains[d]) domains[d] = {};
            if (!domains[d][sd]) domains[d][sd] = [];
            domains[d][sd].push(c);
        });

        return domains;
    }, [courses, isMaternelle]);

    // Format Course Score Helper
    const formatScore = (courseName: string, identifier: string) => {
        const scores = performanceData[courseName] || [];
        // Match by identifier ("p1", "p2", "t1_e")
        const target = scores.find(s => {
            if (s.periodId && s.periodId.includes(identifier)) return true;
            return normalize(s.periodName).includes(identifier);
        });
        
        if (!target || target.score === null || target.score === -999) return "";
        if (target.score === -888) return "ABS";
        
        const isFailure = target.score < (target.max / 2);
        const formatted = Number.isInteger(target.score) ? target.score.toString() : target.score.toFixed(1);
        
        return isFailure ? <span className="text-red-600 font-bold">{formatted}</span> : formatted;
    };

    // Calculate row total helper
    const calculateRowTotal = (courseName: string, identifiers: string[], maxPossibleOverride?: number) => {
        const scores = performanceData[courseName] || [];
        let total = 0;
        let totalMax = 0;
        let hasValue = false;
        let hasAbsent = false;

        identifiers.forEach(id => {
            const target = scores.find(s => {
                if (s.periodId && s.periodId.includes(id)) return true;
                return normalize(s.periodName).includes(id);
            });
            if (target && target.score !== null && target.score !== -999) {
                if (target.score === -888) {
                    hasAbsent = true;
                } else {
                    total += target.score;
                    totalMax += target.max;
                    hasValue = true;
                }
            }
        });

        if (hasAbsent && !config.isSimulationMode) return "ABS";
        if (!hasValue) return "";

        const effectiveMax = maxPossibleOverride || totalMax;
        const isFailure = effectiveMax > 0 && total < (effectiveMax / 2);
        const formatted = Number.isInteger(total) ? total.toString() : total.toFixed(1);

        return isFailure ? <span className="text-red-600 font-bold">{formatted}</span> : formatted;
    };

    // Column total helper for footer
    const calculateColumnTotal = (identifiers: string[], maxPossible?: number) => {
        let grandTotal = 0;
        let hasAnyValue = false;

        courses.forEach(course => {
            // Recalculate raw values to avoid parsing JSX
            let rawTotal = 0;
            let hasVal = false;
            
            identifiers.forEach(id => {
                const sList = performanceData[course.name] || [];
                const t = sList.find(s => (s.periodId && s.periodId.includes(id)) || normalize(s.periodName).includes(id));
                if (t && t.score !== null && t.score !== -999 && t.score !== -888) {
                    rawTotal += t.score;
                    hasVal = true;
                }
            });

            if (hasVal) {
                grandTotal += rawTotal;
                hasAnyValue = true;
            }
        });

        if (!hasAnyValue) return "";
        const formatted = Number.isInteger(grandTotal) ? grandTotal.toString() : grandTotal.toFixed(1);
        
        const isFailure = maxPossible && maxPossible > 0 && grandTotal < (maxPossible / 2);
        return isFailure ? <span className="text-red-600 font-bold">{formatted}</span> : formatted;
    };

    const calculateColumnPercentage = (identifiers: string[], maxPossible: number) => {
        let totalSum = 0;
        let hasVal = false;
        courses.forEach(course => {
            identifiers.forEach(id => {
                const sList = performanceData[course.name] || [];
                const t = sList.find(s => (s.periodId && s.periodId.includes(id)) || normalize(s.periodName).includes(id));
                if (t && t.score !== null && t.score !== -999 && t.score !== -888) {
                    totalSum += t.score;
                    hasVal = true;
                }
            });
        });

        if (!hasVal || maxPossible === 0) return "";
        const pc = (totalSum / maxPossible) * 100;
        const formatted = pc.toFixed(1) + "%";
        
        return pc < 50 ? <span className="text-red-600 font-black">{formatted}</span> : formatted;
    };

    const getQualitative = (score: number, max: number) => {
        if (!max || max === 0) return { qual: "", color: "", colorClass: "" };
        const percent = (score / max) * 100;
        if (percent >= 80) return { qual: "E", color: "JAUNE", colorClass: "text-yellow-600 font-black" };
        if (percent >= 60) return { qual: "TB", color: "BLEU", colorClass: "text-blue-600 font-black" };
        if (percent >= 50) return { qual: "B", color: "VERT", colorClass: "text-green-600 font-black" };
        if (percent >= 40) return { qual: "AB", color: "NOIR", colorClass: "text-black font-black" };
        return { qual: "M", color: "ROUGE", colorClass: "text-red-600 font-black" };
    };

    const getQualitativeForColumn = (identifiers: string[], maxPossible: number) => {
        let totalSum = 0;
        let hasVal = false;
        courses.forEach(course => {
            identifiers.forEach(id => {
                const sList = performanceData[course.name] || [];
                const t = sList.find(s => (s.periodId && s.periodId.includes(id)) || normalize(s.periodName).includes(id));
                if (t && t.score !== null && t.score !== -999 && t.score !== -888) {
                    totalSum += t.score;
                    hasVal = true;
                }
            });
        });
        if (!hasVal || maxPossible === 0) return { qual: "", color: "", colorClass: "" };
        return getQualitative(totalSum, maxPossible);
    };

    // Constants for headers
    const primaryHeaders = [
        { label: "PREMIER TRIMESTRE", cols: ["1ère P.", "2ème P.", "MAX EX.", "PTS OBT.", "MAX TR.", "PTS OBT."] },
        { label: "DEUXIEME TRIMESTRE", cols: ["3ème P.", "4ème P.", "MAX EX.", "PTS OBT.", "MAX TR.", "PTS OBT."] },
        { label: "TROISIEME TRIMESTRE", cols: ["5ème P.", "6ème P.", "MAX EX.", "PTS OBT.", "MAX TR.", "PTS OBT."] },
        { label: "TOTAL", cols: ["MAX", "PTS OBT"] }
    ];

    const getFinalPercentageNumber = () => {
        const identifiers = isSecondary ? ["p1", "p2", "s1_e", "p3", "p4", "s2_e"] : ["p1", "p2", "t1_e", "p3", "p4", "t2_e", "p5", "p6", "t3_e"];
        const maxPossible = courses.reduce((sum, c) => sum + (c.max * (isSecondary ? 8 : 12)), 0);
        let totalSum = 0;
        courses.forEach(course => {
            identifiers.forEach(id => {
                const sList = performanceData[course.name] || [];
                const t = sList.find(s => (s.periodId && s.periodId.includes(id)) || normalize(s.periodName).includes(id));
                if (t && t.score !== null && t.score !== -999 && t.score !== -888) {
                    totalSum += t.score;
                }
            });
        });
        if (maxPossible === 0) return 0;
        return (totalSum / maxPossible) * 100;
    };

    return (
        <div className="bulletin-page font-sans bg-white text-black p-4 md:p-8 print:p-0 mx-auto w-full max-w-[210mm] relative">
            {/* ODSM Watermark */}
            <div className="print-watermark opacity-[0.05] grayscale flex justify-center w-full pointer-events-none">
                <OdsmLogo variant="icon" size="xl" className="scale-[8] opacity-10" />
            </div>

            {/* Header Section */}
            <div className="flex justify-between items-start mb-6 print:mb-2 border-b-2 border-black pb-4 print:pb-2 z-10 relative">
                <div className="flex items-start gap-4">
                    {schoolData.logo && (
                        <div className="w-16 h-16 relative">
                            <Image src={schoolData.logo} alt="School Logo" fill className="object-contain" />
                        </div>
                    )}
                    <div>
                        <h2 className="font-extrabold text-lg uppercase tracking-wider">{schoolData.name}</h2>
                        <h3 className="font-bold text-sm text-gray-700">ORION DIGITAL SCHOOL MANAGER</h3>
                        <p className="text-xs mt-1">Ville: {schoolData.city || "---"} • Province: {schoolData.province || "---"}</p>
                        <p className="text-xs">ID National / Matricule: {schoolData.matricule}</p>
                    </div>
                </div>
                <div className="text-right">
                    <h1 className="font-black text-xl border-2 border-black p-2 inline-block shadow-[4px_4px_0_0_rgba(0,0,0,1)] uppercase">
                        BULLETIN DE L'ELEVE
                    </h1>
                    <p className="font-bold mt-2 uppercase">{classroomName}</p>
                    <p className="text-sm font-semibold">Année Scolaire {schoolYear}</p>
                </div>
            </div>

            {/* Student Info */}
            <div className="flex justify-between items-center bg-gray-100 border-2 border-black p-3 print:p-2 mb-6 print:mb-2 z-10 relative">
                <div>
                    <p className="text-sm print:text-xs"><span className="font-bold">Nom, Postnom et Prénom :</span> <span className="uppercase font-extrabold text-base print:text-sm">{student.lastName} {student.middleName || ""} {student.firstName}</span></p>
                    <p className="text-sm print:text-xs mt-1 print:mt-0"><span className="font-bold">N° Matricule :</span> {student.matricule}</p>
                </div>
                {config.title && (
                    <div className="bg-black text-white px-3 py-1 font-bold text-xs uppercase tracking-widest">
                        {config.title}
                    </div>
                )}
            </div>

            {/* Grades Table */}
            <div className="overflow-x-auto z-10 relative">
                <table className="bulletin-table">
                    <thead>
                        {isMaternelle ? (
                            <>
                                <tr>
                                    <th rowSpan={2} className="w-8 text-center text-xs font-bold border-r border-black border-b-0">*</th>
                                    <th className="w-[180px] text-left uppercase text-xs border-r border-black border-b-0">TRIMESTRES</th>
                                    <th className="text-[10px] w-12 uppercase font-bold text-center border-b-0">TRIM 1</th>
                                    <th className="text-[10px] w-12 uppercase font-bold text-center border-b-0">TRIM 2</th>
                                    <th className="text-[10px] w-12 uppercase font-bold text-center border-b-0">TRIM 3</th>
                                    <th className="text-[10px] w-14 uppercase font-bold text-center border-b-0 bg-gray-100">TOTAL</th>
                                    <th className="text-[10px] w-12 uppercase font-bold text-center border-b-0">QUAL.</th>
                                    <th className="text-[10px] w-14 uppercase font-bold text-center border-b-0 border-r-0">COUL.</th>
                                </tr>
                                <tr>
                                    <th className="text-[10px] text-left uppercase font-bold border-t-0 p-1 bg-gray-50 border-r border-black">MAXIMA</th>
                                    <th className="text-[10px] text-center font-bold border-t-0 p-1 bg-gray-50">4</th>
                                    <th className="text-[10px] text-center font-bold border-t-0 p-1 bg-gray-50">4</th>
                                    <th className="text-[10px] text-center font-bold border-t-0 p-1 bg-gray-50">4</th>
                                    <th className="text-[10px] text-center font-bold bg-gray-100 border-t-0 p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">12</th>
                                    <th className="text-[10px] border-t-0 p-1"></th>
                                    <th className="text-[10px] border-t-0 border-r-0 p-1"></th>
                                </tr>
                            </>
                        ) : !isSecondary ? (
                            <>
                                <tr>
                                    <th rowSpan={2} className="w-[180px] text-left uppercase text-xs" style={{ width: '25%' }}>BRANCHES</th>
                                    <th rowSpan={2} className="text-[10px] w-10">MAX<br/>Période</th>
                                    {primaryHeaders.map((h, i) => (
                                        <th key={i} colSpan={h.cols.length} className="text-[10px] uppercase">{h.label}</th>
                                    ))}
                                </tr>
                                <tr>
                                    {primaryHeaders.flatMap((h, i) => 
                                        h.cols.map((col, j) => <th key={`${i}-${j}`} className="text-[9px] font-normal">{col}</th>)
                                    )}
                                </tr>
                            </>
                        ) : (
                            <>
                                <tr>
                                    <th rowSpan={3} className="w-[180px] text-left uppercase text-xs" style={{ width: '25%' }}>BRANCHES</th>
                                    <th colSpan={5} className="text-[10px] uppercase">PREMIER SEMESTRE</th>
                                    <th colSpan={5} className="text-[10px] uppercase">SECOND SEMESTRE</th>
                                    <th rowSpan={3} className="text-[10px] uppercase w-16">TOTAL<br/>GENERAL</th>
                                    <th colSpan={2} className="text-[10px] uppercase">EXAMEN DE<br/>REPECHAGE</th>
                                </tr>
                                <tr>
                                    <th rowSpan={2} className="text-[10px] uppercase w-8">MAX.</th>
                                    <th colSpan={2} className="text-[10px] uppercase">TRAVAUX<br/>JOURNAL.</th>
                                    <th rowSpan={2} className="text-[10px] uppercase w-12">MAX.<br/>EXAM.</th>
                                    <th rowSpan={2} className="text-[10px] uppercase w-12">TOTAL</th>
                                    
                                    <th rowSpan={2} className="text-[10px] uppercase w-8">MAX.</th>
                                    <th colSpan={2} className="text-[10px] uppercase">TRAVAUX<br/>JOURNAL.</th>
                                    <th rowSpan={2} className="text-[10px] uppercase w-12">MAX.<br/>EXAM.</th>
                                    <th rowSpan={2} className="text-[10px] uppercase w-12">TOTAL</th>

                                    <th rowSpan={2} className="text-[9px] font-normal w-10">%</th>
                                    <th rowSpan={2} className="text-[9px] font-normal w-16">Sign. Prof.</th>
                                </tr>
                                <tr>
                                    <th className="text-[9px] font-normal w-10">1<sup>ère</sup> P</th>
                                    <th className="text-[9px] font-normal w-10">2<sup>ème</sup> P</th>
                                    
                                    <th className="text-[9px] font-normal w-10">3<sup>ème</sup> P</th>
                                    <th className="text-[9px] font-normal w-10">4<sup>ème</sup> P</th>
                                </tr>
                            </>
                        )}
                    </thead>
                    <tbody>
                        {(() => {
                            let maternelleCourseIndex = 1;
                            return Object.entries(groupedCourses).map(([domain, subDomains]) => (
                            <React.Fragment key={domain}>
                                {/* Domain Header */}
                                <tr className="bg-gray-200 border-t-2 border-b-2 border-black">
                                    {isMaternelle && <td className="text-center font-black text-[12px] border-r border-black border-y-0 py-1">*</td>}
                                    <td colSpan={100} className={cn("font-extrabold text-xs print:text-[10px] uppercase tracking-wide py-1 print:py-0", isMaternelle ? "text-left pl-2" : "text-center")}>
                                        {domain}
                                    </td>
                                </tr>

                                {Object.entries(subDomains).map(([subDomain, domainCourses]) => (
                                    <React.Fragment key={subDomain}>
                                        {/* Subdomain Header */}
                                        {subDomain !== 'Branches Générales' && (
                                            <tr className="bg-gray-50">
                                                {isMaternelle && <td className="border-r border-black border-y-0 text-center text-[10px] font-bold text-gray-400">*</td>}
                                                <td colSpan={100} className="font-bold text-left italic text-[10px] print:text-[9px] bg-gray-100 pl-2 print:py-0">Sous-domaine : {subDomain}</td>
                                            </tr>
                                        )}

                                        {/* Courses Rows */}
                                        {domainCourses.map((course) => {
                                            const mIndex = isMaternelle ? maternelleCourseIndex++ : 0;
                                            return (
                                            <tr key={course.name}>
                                                {isMaternelle && <td className="text-center font-bold text-[10px] print:text-[9px] border-r border-black border-y-0 text-gray-500">{mIndex}</td>}
                                                <td className="text-left font-medium text-[10px] print:text-[9px] pl-2 print:py-[1px]">{course.name}</td>
                                                
                                                {isMaternelle ? (
                                                    // Maternelle Structure
                                                    <>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "m_t1")}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "m_t2")}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "m_t3")}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-100">{calculateRowTotal(course.name, ["m_t1", "m_t2", "m_t3"])}</td>
                                                        <td className="text-center text-[10px] font-bold">
                                                            {(() => {
                                                                const total = parseFloat(calculateRowTotal(course.name, ["m_t1", "m_t2", "m_t3"])?.toString() || "0");
                                                                return <span className={getQualitative(total, course.max * 3).colorClass}>{getQualitative(total, course.max * 3).qual}</span>;
                                                            })()}
                                                        </td>
                                                        <td className="text-center text-[8px] border-r-0 font-bold">
                                                            {(() => {
                                                                const total = parseFloat(calculateRowTotal(course.name, ["m_t1", "m_t2", "m_t3"])?.toString() || "0");
                                                                return <span className={getQualitative(total, course.max * 3).colorClass}>{getQualitative(total, course.max * 3).color}</span>;
                                                            })()}
                                                        </td>
                                                    </>
                                                ) : !isSecondary ? (
                                                    // Primary Structure
                                                    <>
                                                        <td className="text-center font-bold text-[10px] bg-gray-50">{course.max}</td>
                                                        {/* TRIM 1 */}
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p1")}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p2")}</td>
                                                        <td className="text-center font-semibold text-[10px] bg-gray-50">{course.max * 2}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-100">{formatScore(course.name, "t1_e")}</td>
                                                        <td className="text-center font-semibold text-[10px] bg-gray-50">{course.max * 4}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-200">{calculateRowTotal(course.name, ["p1", "p2", "t1_e"])}</td>
                                                        
                                                        {/* TRIM 2 */}
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p3")}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p4")}</td>
                                                        <td className="text-center font-semibold text-[10px] bg-gray-50">{course.max * 2}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-100">{formatScore(course.name, "t2_e")}</td>
                                                        <td className="text-center font-semibold text-[10px] bg-gray-50">{course.max * 4}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-200">{calculateRowTotal(course.name, ["p3", "p4", "t2_e"])}</td>
                                                        
                                                        {/* TRIM 3 */}
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p5")}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p6")}</td>
                                                        <td className="text-center font-semibold text-[10px] bg-gray-50">{course.max * 2}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-100">{formatScore(course.name, "t3_e")}</td>
                                                        <td className="text-center font-semibold text-[10px] bg-gray-50">{course.max * 4}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-200">{calculateRowTotal(course.name, ["p5", "p6", "t3_e"])}</td>
                                                        
                                                        {/* TOTAL ANNEE */}
                                                        <td className="text-center font-extrabold text-[10px] bg-gray-50">{course.max * 12}</td>
                                                        <td className="text-center font-extrabold text-[10px] bg-gray-300">{calculateRowTotal(course.name, ["p1", "p2", "t1_e", "p3", "p4", "t2_e", "p5", "p6", "t3_e"])}</td>
                                                    </>
                                                ) : (
                                                    // Secondary Structure
                                                    <>
                                                        {/* SEM 1 */}
                                                        <td className="text-center font-bold text-[10px] bg-gray-50">{course.max}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p1")}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p2")}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-100">{formatScore(course.name, "s1_e")}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-200">{calculateRowTotal(course.name, ["p1", "p2", "s1_e"])}</td>
                                                        
                                                        {/* SEM 2 */}
                                                        <td className="text-center font-bold text-[10px] bg-gray-50">{course.max}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p3")}</td>
                                                        <td className="text-center text-[10px]">{formatScore(course.name, "p4")}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-100">{formatScore(course.name, "s2_e")}</td>
                                                        <td className="text-center font-bold text-[10px] bg-gray-200">{calculateRowTotal(course.name, ["p3", "p4", "s2_e"])}</td>
                                                        
                                                        {/* TOTAL GENERAL */}
                                                        <td className="text-center font-extrabold text-[10px] bg-gray-300">{calculateRowTotal(course.name, ["p1", "p2", "s1_e", "p3", "p4", "s2_e"])}</td>

                                                        {/* REPECHAGE */}
                                                        <td className="text-center text-[10px] font-bold">{formatScore(course.name, "rep")}</td>
                                                        <td className="text-center text-[10px]"></td>
                                                    </>
                                                )}
                                            </tr>
                                        )})}

                                        {/* Subdomain Total */}
                                        <tr className="bg-gray-100 border-t border-black font-bold">
                                            {isMaternelle && <td className="text-center font-black text-[12px] border-r border-black border-y-0 text-gray-800">*</td>}
                                            <td className={cn("text-right pr-2 text-[10px] uppercase", isMaternelle && "text-left pl-2 font-black")}>Sous - Total</td>
                                            {isMaternelle ? (
                                                <>
                                                    <td className="text-center text-[10px] bg-gray-200">
                                                        {calculateSubdomainTotal(domainCourses, ["m_t1"])} <span className="text-[8px] text-gray-500 font-normal">/{domainCourses.reduce((s,c)=>s+c.max,0)}</span>
                                                    </td>
                                                    <td className="text-center text-[10px] bg-gray-200">
                                                        {calculateSubdomainTotal(domainCourses, ["m_t2"])} <span className="text-[8px] text-gray-500 font-normal">/{domainCourses.reduce((s,c)=>s+c.max,0)}</span>
                                                    </td>
                                                    <td className="text-center text-[10px] bg-gray-200">
                                                        {calculateSubdomainTotal(domainCourses, ["m_t3"])} <span className="text-[8px] text-gray-500 font-normal">/{domainCourses.reduce((s,c)=>s+c.max,0)}</span>
                                                    </td>
                                                    <td className="text-center text-[10px] bg-gray-300 font-bold">
                                                        {calculateSubdomainTotal(domainCourses, ["m_t1", "m_t2", "m_t3"])} <span className="text-[8px] text-gray-600 font-normal">/{domainCourses.reduce((s,c)=>s+(c.max*3),0)}</span>
                                                    </td>
                                                    <td className="text-center text-[10px] bg-gray-200"></td>
                                                    <td className="text-center text-[10px] bg-gray-200 border-r-0"></td>
                                                </>
                                            ) : !isSecondary ? (
                                                <>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + c.max, 0)}</td>
                                                    <td colSpan={2}></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                                    <td></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                                    <td></td>
                                                    <td colSpan={2}></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                                    <td></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                                    <td></td>
                                                    <td colSpan={2}></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                                    <td></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                                    <td></td>
                                                    <td className="text-center text-[10px] bg-gray-300 font-extrabold">{domainCourses.reduce((sum, c) => sum + (c.max * 12), 0)}</td>
                                                    <td></td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + c.max, 0)}</td>
                                                    <td colSpan={2}></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                                    <td className="text-center text-[10px] bg-gray-300 font-extrabold">{domainCourses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + c.max, 0)}</td>
                                                    <td colSpan={2}></td>
                                                    <td className="text-center text-[10px] bg-gray-200">{domainCourses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                                    <td className="text-center text-[10px] bg-gray-300 font-extrabold">{domainCourses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                                    <td className="text-center text-[10px] bg-gray-400 font-extrabold">{domainCourses.reduce((sum, c) => sum + (c.max * 8), 0)}</td>
                                                    <td colSpan={2}></td>
                                                </>
                                            )}
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </React.Fragment>
                        ))})()}
                    </tbody>
                    
                    {/* Grand Totals */}
                    <tfoot>
                        {isMaternelle && (
                            <>
                                <tr className="border-t-2 border-black font-extrabold bg-gray-100">
                                    <td colSpan={2} rowSpan={3} className="text-center uppercase font-black text-sm border-r-2 border-black bg-white align-middle tracking-wider shadow-[inset_0_4px_6px_rgba(0,0,0,0.05)]">
                                        APPRECIATION<br/>GENERALE
                                    </td>
                                    <td className="text-right pr-2 uppercase pb-1 pt-1 text-[10px]">TOTAL</td>
                                    <td className="text-center text-[10px]">
                                        {calculateColumnTotal(["m_t1"], courses.reduce((sum, c) => sum + c.max, 0))} <span className="text-[8px] text-gray-500 font-normal">/{courses.reduce((sum, c) => sum + c.max, 0)}</span>
                                    </td>
                                    <td className="text-center text-[10px]">
                                        {calculateColumnTotal(["m_t2"], courses.reduce((sum, c) => sum + c.max, 0))} <span className="text-[8px] text-gray-500 font-normal">/{courses.reduce((sum, c) => sum + c.max, 0)}</span>
                                    </td>
                                    <td className="text-center text-[10px]">
                                        {calculateColumnTotal(["m_t3"], courses.reduce((sum, c) => sum + c.max, 0))} <span className="text-[8px] text-gray-500 font-normal">/{courses.reduce((sum, c) => sum + c.max, 0)}</span>
                                    </td>
                                    <td className="text-center text-[10px] bg-gray-300 font-extrabold">
                                        {calculateColumnTotal(["m_t1", "m_t2", "m_t3"], courses.reduce((sum, c) => sum + (c.max * 3), 0))} <span className="text-[8px] text-gray-500 font-normal">/{courses.reduce((sum, c) => sum + (c.max * 3), 0)}</span>
                                    </td>
                                    <td className="text-center text-[10px] bg-white"></td>
                                    <td className="text-center text-[10px] bg-white border-r-0"></td>
                                </tr>
                                <tr className="border-t border-black bg-gray-50 font-extrabold">
                                    <td className="text-right pr-2 uppercase pb-1 pt-1 text-[9px]">CONVERSION QUALITATIVE</td>
                                    <td className="text-center text-[10px]"><span className={getQualitativeForColumn(["m_t1"], courses.reduce((sum, c) => sum + c.max, 0)).colorClass}>{getQualitativeForColumn(["m_t1"], courses.reduce((sum, c) => sum + c.max, 0)).qual}</span></td>
                                    <td className="text-center text-[10px]"><span className={getQualitativeForColumn(["m_t2"], courses.reduce((sum, c) => sum + c.max, 0)).colorClass}>{getQualitativeForColumn(["m_t2"], courses.reduce((sum, c) => sum + c.max, 0)).qual}</span></td>
                                    <td className="text-center text-[10px]"><span className={getQualitativeForColumn(["m_t3"], courses.reduce((sum, c) => sum + c.max, 0)).colorClass}>{getQualitativeForColumn(["m_t3"], courses.reduce((sum, c) => sum + c.max, 0)).qual}</span></td>
                                    <td className="text-center text-[10px] bg-gray-200"><span className={getQualitativeForColumn(["m_t1", "m_t2", "m_t3"], courses.reduce((sum, c) => sum + (c.max * 3), 0)).colorClass}>{getQualitativeForColumn(["m_t1", "m_t2", "m_t3"], courses.reduce((sum, c) => sum + (c.max * 3), 0)).qual}</span></td>
                                    <td className="text-center text-[10px] bg-white"></td>
                                    <td className="text-center text-[10px] bg-white border-r-0"></td>
                                </tr>
                                <tr className="border-t border-black font-extrabold">
                                    <td className="text-right pr-2 uppercase pb-1 pt-1 text-[10px]">COULEURS</td>
                                    <td className="text-center text-[8px]"><span className={getQualitativeForColumn(["m_t1"], courses.reduce((sum, c) => sum + c.max, 0)).colorClass}>{getQualitativeForColumn(["m_t1"], courses.reduce((sum, c) => sum + c.max, 0)).color}</span></td>
                                    <td className="text-center text-[8px]"><span className={getQualitativeForColumn(["m_t2"], courses.reduce((sum, c) => sum + c.max, 0)).colorClass}>{getQualitativeForColumn(["m_t2"], courses.reduce((sum, c) => sum + c.max, 0)).color}</span></td>
                                    <td className="text-center text-[8px]"><span className={getQualitativeForColumn(["m_t3"], courses.reduce((sum, c) => sum + c.max, 0)).colorClass}>{getQualitativeForColumn(["m_t3"], courses.reduce((sum, c) => sum + c.max, 0)).color}</span></td>
                                    <td className="text-center text-[8px] bg-gray-100"><span className={getQualitativeForColumn(["m_t1", "m_t2", "m_t3"], courses.reduce((sum, c) => sum + (c.max * 3), 0)).colorClass}>{getQualitativeForColumn(["m_t1", "m_t2", "m_t3"], courses.reduce((sum, c) => sum + (c.max * 3), 0)).color}</span></td>
                                    <td className="text-center text-[10px] bg-white"></td>
                                    <td className="text-center text-[10px] bg-white border-r-0"></td>
                                </tr>
                            </>
                        )}

                        {!isMaternelle && <tr className="bg-black text-white font-extrabold border-2 border-black">
                            <td className="text-right pr-2 uppercase pb-1 pt-1 text-xs">MAXIMA GENERAUX</td>
                            {!isSecondary ? (
                                <>
                                    <td className="text-center text-[10px]">{courses.reduce((sum, c) => sum + c.max, 0)}</td>
                                    {/* Trim 1 */}
                                    <td colSpan={2}></td><td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                    <td></td><td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                    <td></td>
                                    {/* Trim 2 */}
                                    <td colSpan={2}></td><td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                    <td></td><td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                    <td></td>
                                    {/* Trim 3 */}
                                    <td colSpan={2}></td><td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                    <td></td><td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                    <td></td><td className="text-center font-extrabold">{courses.reduce((sum, c) => sum + (c.max * 12), 0)}</td>
                                    <td></td>
                                </>
                            ) : (
                                <>
                                    <td className="text-center">{courses.reduce((sum, c) => sum + c.max, 0)}</td>
                                    <td colSpan={2}></td>
                                    <td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                    <td className="text-center font-extrabold">{courses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                    <td className="text-center">{courses.reduce((sum, c) => sum + c.max, 0)}</td>
                                    <td colSpan={2}></td>
                                    <td className="text-center">{courses.reduce((sum, c) => sum + (c.max * 2), 0)}</td>
                                    <td className="text-center font-extrabold">{courses.reduce((sum, c) => sum + (c.max * 4), 0)}</td>
                                    <td className="text-center font-extrabold bg-gray-400">{courses.reduce((sum, c) => sum + (c.max * 8), 0)}</td>
                                    <td colSpan={2}></td>
                                </>
                            )}
                        </tr>}
                        
                        {!isMaternelle && <tr className="border-b-2 border-black font-extrabold bg-gray-100">
                            <td className="text-right pr-2 uppercase pb-1 pt-1 text-[10px]">TOTAUX OBTENUS</td>
                            {!isSecondary ? (
                                <>
                                    <td className="bg-gray-200"></td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p1"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p2"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["t1_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{calculateColumnTotal(["p1", "p2", "t1_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p3"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p4"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["t2_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{calculateColumnTotal(["p3", "p4", "t2_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>

                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p5"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p6"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["t3_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{calculateColumnTotal(["p5", "p6", "t3_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td className="text-center text-[10px] font-extrabold"></td>
                                    <td className="text-center text-[10px] bg-gray-300">
                                        {calculateColumnTotal(
                                            ["p1", "p2", "t1_e", "p3", "p4", "t2_e", "p5", "p6", "t3_e"],
                                            courses.reduce((sum, c) => sum + (c.max * 12), 0)
                                        )}
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="bg-gray-200"></td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p1"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p2"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["s1_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td className="text-center text-[10px] bg-gray-200">{calculateColumnTotal(["p1", "p2", "s1_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td className="bg-gray-200"></td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p3"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["p4"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[10px]">{calculateColumnTotal(["s2_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td className="text-center text-[10px] bg-gray-200">{calculateColumnTotal(["p3", "p4", "s2_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td className="text-center text-[10px] bg-gray-300">
                                        {calculateColumnTotal(
                                            ["p1", "p2", "s1_e", "p3", "p4", "s2_e"],
                                            courses.reduce((sum, c) => sum + (c.max * 8), 0)
                                        )}
                                    </td>
                                    <td colSpan={2}></td>
                                </>
                            )}
                        </tr>}

                        {!isMaternelle && <tr className="border-b-2 border-black font-extrabold">
                            <td className="text-right pr-2 uppercase pb-1 pt-1 text-[10px]">POURCENTAGE</td>
                            {!isSecondary ? (
                                <>
                                    <td className="bg-gray-50"></td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p1"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p2"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["t1_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-100">{calculateColumnPercentage(["p1", "p2", "t1_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p3"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p4"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["t2_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-100">{calculateColumnPercentage(["p3", "p4", "t2_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>

                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p5"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p6"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["t3_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-100">{calculateColumnPercentage(["p5", "p6", "t3_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-300 font-black">{calculateColumnPercentage(["p1", "p2", "t1_e", "p3", "p4", "t2_e", "p5", "p6", "t3_e"], courses.reduce((sum, c) => sum + (c.max * 12), 0))}</td>
                                </>
                            ) : (
                                <>
                                    <td className="bg-gray-50"></td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p1"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p2"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["s1_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td className="text-center text-[10px] bg-gray-100">{calculateColumnPercentage(["p1", "p2", "s1_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td className="bg-gray-50"></td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p3"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["p4"], courses.reduce((sum, c) => sum + c.max, 0))}</td>
                                    <td className="text-center text-[9px]">{calculateColumnPercentage(["s2_e"], courses.reduce((sum, c) => sum + (c.max * 2), 0))}</td>
                                    <td className="text-center text-[10px] bg-gray-100">{calculateColumnPercentage(["p3", "p4", "s2_e"], courses.reduce((sum, c) => sum + (c.max * 4), 0))}</td>
                                    
                                    <td className="text-center text-[10px] bg-gray-300 font-black">{calculateColumnPercentage(["p1", "p2", "s1_e", "p3", "p4", "s2_e"], courses.reduce((sum, c) => sum + (c.max * 8), 0))}</td>
                                    <td colSpan={2}></td>
                                </>
                            )}
                        </tr>}

                        {!isMaternelle && <tr className="border-b-2 border-black font-extrabold bg-gray-50">
                            <td className="text-right pr-2 uppercase pb-1 pt-1 text-[10px]">PLACE</td>
                            {!isSecondary ? (
                                <>
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p1']?.rank ? `${config.ranks['p1'].rank}${config.ranks['p1'].rank === 1 ? 'er' : 'e'}/${config.ranks['p1'].total}` : ""}</td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p2']?.rank ? `${config.ranks['p2'].rank}${config.ranks['p2'].rank === 1 ? 'er' : 'e'}/${config.ranks['p2'].total}` : ""}</td>
                                    <td></td>
                                    <td className="text-center text-[9px]">{config.ranks?.['t1_e']?.rank ? `${config.ranks['t1_e'].rank}${config.ranks['t1_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['t1_e'].total}` : ""}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{config.ranks?.['p1,p2,t1_e']?.rank ? `${config.ranks['p1,p2,t1_e'].rank}${config.ranks['p1,p2,t1_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['p1,p2,t1_e'].total}` : ""}</td>
                                    
                                    <td className="text-center text-[9px]">{config.ranks?.['p3']?.rank ? `${config.ranks['p3'].rank}${config.ranks['p3'].rank === 1 ? 'er' : 'e'}/${config.ranks['p3'].total}` : ""}</td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p4']?.rank ? `${config.ranks['p4'].rank}${config.ranks['p4'].rank === 1 ? 'er' : 'e'}/${config.ranks['p4'].total}` : ""}</td>
                                    <td></td>
                                    <td className="text-center text-[9px]">{config.ranks?.['t2_e']?.rank ? `${config.ranks['t2_e'].rank}${config.ranks['t2_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['t2_e'].total}` : ""}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{config.ranks?.['p3,p4,t2_e']?.rank ? `${config.ranks['p3,p4,t2_e'].rank}${config.ranks['p3,p4,t2_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['p3,p4,t2_e'].total}` : ""}</td>

                                    <td className="text-center text-[9px]">{config.ranks?.['p5']?.rank ? `${config.ranks['p5'].rank}${config.ranks['p5'].rank === 1 ? 'er' : 'e'}/${config.ranks['p5'].total}` : ""}</td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p6']?.rank ? `${config.ranks['p6'].rank}${config.ranks['p6'].rank === 1 ? 'er' : 'e'}/${config.ranks['p6'].total}` : ""}</td>
                                    <td></td>
                                    <td className="text-center text-[9px]">{config.ranks?.['t3_e']?.rank ? `${config.ranks['t3_e'].rank}${config.ranks['t3_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['t3_e'].total}` : ""}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{config.ranks?.['p5,p6,t3_e']?.rank ? `${config.ranks['p5,p6,t3_e'].rank}${config.ranks['p5,p6,t3_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['p5,p6,t3_e'].total}` : ""}</td>
                                    
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-400 font-extrabold">{config.ranks?.['p1,p2,t1_e,p3,p4,t2_e,p5,p6,t3_e']?.rank ? `${config.ranks['p1,p2,t1_e,p3,p4,t2_e,p5,p6,t3_e'].rank}${config.ranks['p1,p2,t1_e,p3,p4,t2_e,p5,p6,t3_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['p1,p2,t1_e,p3,p4,t2_e,p5,p6,t3_e'].total}` : ""}</td>
                                </>
                            ) : (
                                <>
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p1']?.rank ? `${config.ranks['p1'].rank}${config.ranks['p1'].rank === 1 ? 'er' : 'e'}/${config.ranks['p1'].total}` : ""}</td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p2']?.rank ? `${config.ranks['p2'].rank}${config.ranks['p2'].rank === 1 ? 'er' : 'e'}/${config.ranks['p2'].total}` : ""}</td>
                                    <td className="text-center text-[9px]">{config.ranks?.['s1_e']?.rank ? `${config.ranks['s1_e'].rank}${config.ranks['s1_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['s1_e'].total}` : ""}</td>
                                    <td className="text-center text-[10px] bg-gray-200">{config.ranks?.['p1,p2,s1_e']?.rank ? `${config.ranks['p1,p2,s1_e'].rank}${config.ranks['p1,p2,s1_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['p1,p2,s1_e'].total}` : ""}</td>
                                    
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p3']?.rank ? `${config.ranks['p3'].rank}${config.ranks['p3'].rank === 1 ? 'er' : 'e'}/${config.ranks['p3'].total}` : ""}</td>
                                    <td className="text-center text-[9px]">{config.ranks?.['p4']?.rank ? `${config.ranks['p4'].rank}${config.ranks['p4'].rank === 1 ? 'er' : 'e'}/${config.ranks['p4'].total}` : ""}</td>
                                    <td className="text-center text-[9px]">{config.ranks?.['s2_e']?.rank ? `${config.ranks['s2_e'].rank}${config.ranks['s2_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['s2_e'].total}` : ""}</td>
                                    <td className="text-center text-[10px] bg-gray-200">{config.ranks?.['p3,p4,s2_e']?.rank ? `${config.ranks['p3,p4,s2_e'].rank}${config.ranks['p3,p4,s2_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['p3,p4,s2_e'].total}` : ""}</td>
                                    
                                    <td className="text-center text-[10px] bg-gray-400 font-extrabold">{config.ranks?.['p1,p2,s1_e,p3,p4,s2_e']?.rank ? `${config.ranks['p1,p2,s1_e,p3,p4,s2_e'].rank}${config.ranks['p1,p2,s1_e,p3,p4,s2_e'].rank === 1 ? 'er' : 'e'}/${config.ranks['p1,p2,s1_e,p3,p4,s2_e'].total}` : ""}</td>
                                    <td colSpan={2}></td>
                                </>
                            )}
                        </tr>}

                        {/* APPLICATION AND CONDUCT ROWS */}
                        {!isMaternelle && <tr className="border-b-2 border-black font-extrabold text-blue-900">
                            <td className="text-right pr-2 uppercase pb-1 pt-1 text-[10px]">APPLICATION</td>
                            {!isSecondary ? (
                                <>
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{student.application}</td>
                                    
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{student.application}</td>

                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{student.application}</td>
                                    
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-400"></td>
                                </>
                            ) : (
                                <>
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td className="text-center text-[10px]"></td>
                                    <td className="text-center text-[10px] bg-gray-200"></td>
                                    
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td className="text-center text-[10px]">{student.application}</td>
                                    <td className="text-center text-[10px]"></td>
                                    <td className="text-center text-[10px] bg-gray-200"></td>
                                    
                                    <td className="text-center text-[10px] bg-gray-400"></td>
                                    <td colSpan={2}></td>
                                </>
                            )}
                        </tr>}
                        {!isMaternelle && <tr className="border-b-2 border-black font-extrabold text-blue-900">
                            <td className="text-right pr-2 uppercase pb-1 pt-1 text-[10px]">CONDUITE</td>
                            {!isSecondary ? (
                                <>
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{student.conduct}</td>
                                    
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{student.conduct}</td>

                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td></td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-200">{student.conduct}</td>
                                    
                                    <td></td>
                                    <td className="text-center text-[10px] bg-gray-400"></td>
                                </>
                            ) : (
                                <>
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td className="text-center text-[10px]"></td>
                                    <td className="text-center text-[10px] bg-gray-200"></td>
                                    
                                    <td className="bg-gray-100"></td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td className="text-center text-[10px]">{student.conduct}</td>
                                    <td className="text-center text-[10px]"></td>
                                    <td className="text-center text-[10px] bg-gray-200"></td>
                                    
                                    <td className="text-center text-[10px] bg-gray-400"></td>
                                    <td colSpan={2}></td>
                                </>
                            )}
                        </tr>}
                    </tfoot>
                </table>
            </div>

            {/* Terminal Endings Boxes */}
            {classroomName.includes("6e Primaire") || classroomName.includes("6ème Primaire") || classroomName.includes("6eme Primaire") ? (
                <div className="mt-4 flex justify-end pr-8 z-10 relative">
                    <table className="border-2 border-black font-bold text-[10px] bg-gray-50">
                        <tbody>
                            <tr>
                                <td className="border border-black p-2 uppercase">Moyenne École</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">{getFinalPercentageNumber() > 0 ? (getFinalPercentageNumber() / 2).toFixed(1) : ""} / 50</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 uppercase">ENAFEP</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">{student.enafepScore ? (student.enafepScore / 2).toFixed(1) : ""} / 50</td>
                            </tr>
                            <tr className="bg-gray-200 font-black">
                                <td className="border border-black p-2 uppercase">TOTAL FINAL</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">
                                    {student.enafepScore ? ((getFinalPercentageNumber() / 2) + (student.enafepScore / 2)).toFixed(1) : ""} / 100
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : null}

            {classroomName.includes("4ème Humanité") || classroomName.includes("4e Humanité") || classroomName.includes("4eme Humanite") ? (
                <div className="mt-4 flex justify-end pr-8 z-10 relative gap-4">
                    <table className="border-2 border-black font-bold text-[10px] bg-gray-50">
                        <tbody>
                            <tr className="bg-gray-200">
                                <td className="border border-black p-2 uppercase">EXAMEN D'ÉTAT</td>
                                <td className="border border-black p-2 text-center w-24 text-blue-900">{student.stateExamScore ? `${student.stateExamScore} %` : ""}</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 uppercase">Résultat Final</td>
                                <td className="border border-black p-2 text-center w-24 text-blue-900">
                                    {student.stateExamScore && student.stateExamScore >= 50 ? "DIPLÔMÉ(E)" : student.stateExamScore ? "AJOURNÉ(E)" : ""}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : null}

            {classroomName.includes("2ème Pro") || classroomName.includes("2e Pro") || classroomName.includes("2eme Pro") ? (
                <div className="mt-4 flex justify-end pr-8 z-10 relative gap-4">
                    <table className="border-2 border-black font-bold text-[10px] bg-gray-50">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2 uppercase text-center" colSpan={2}>JURY DE FIN D'ANNÉE</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-2 uppercase">Leçon 1</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">{student.juryLesson1 || ""} / 50</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 uppercase">Leçon 2</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">{student.juryLesson2 || ""} / 50</td>
                            </tr>
                            <tr className="bg-gray-200 font-black">
                                <td className="border border-black p-2 uppercase">TOTAL JURY</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">
                                    {student.juryLesson1 || student.juryLesson2 ? (student.juryLesson1 || 0) + (student.juryLesson2 || 0) : ""} / 100
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    
                    <table className="border-2 border-black font-bold text-[10px] bg-gray-50">
                        <thead>
                            <tr className="bg-gray-200">
                                <th className="border border-black p-2 uppercase text-center" colSpan={2}>RÉSULTAT FINAL</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-2 uppercase">École</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">{student.jurySchoolScore || ""} / 50</td>
                            </tr>
                            <tr>
                                <td className="border border-black p-2 uppercase">Jury</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">{student.juryExamScore || ""} / 50</td>
                            </tr>
                            <tr className="bg-gray-200 font-black">
                                <td className="border border-black p-2 uppercase">TOTAL FINAL</td>
                                <td className="border border-black p-2 text-center w-16 text-blue-900">
                                    {student.jurySchoolScore || student.juryExamScore ? (student.jurySchoolScore || 0) + (student.juryExamScore || 0) : ""} / 100
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            ) : null}

            {!isMaternelle ? (
                <div className="mt-8 print:mt-2 flex justify-between px-8 text-xs font-bold text-gray-800 z-10 relative">
                    <div className="text-center">
                        <p>Le Titulaire</p>
                        <div className="mt-12 print:mt-8 border-b border-black w-32 mx-auto"></div>
                    </div>
                    <div className="text-center">
                        <p>Le Chef d'Établissement</p>
                        <p className="font-normal italic mt-1">(Sceau et signature)</p>
                        <div className="mt-8 print:mt-4 border-b border-black w-40 mx-auto"></div>
                    </div>
                </div>
            ) : (
                <div className="mt-4 print:mt-2 flex gap-4 w-full text-[10px] font-bold text-black z-10 relative items-start">
                    {/* Left Column: Signatures & Legend */}
                    <div className="w-[60%] flex flex-col gap-2">
                        {/* Signatures Table */}
                        <table className="w-full border-collapse border-2 border-black">
                            <thead>
                                <tr>
                                    <th className="border border-black text-left pl-2 p-1 uppercase text-[9px]" colSpan={3}>* SIGNATURES</th>
                                </tr>
                                <tr className="bg-gray-100 text-[9px]">
                                    <th className="border border-black text-center p-1 w-1/3">TRIMESTRES</th>
                                    <th className="border border-black text-center p-1 w-1/3">INSTITUTEUR (TRICE)</th>
                                    <th className="border border-black text-center p-1 w-1/3">PARENT</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 pl-2 text-center">1<sup className="text-[7px]">er</sup> TRIMESTRE</td>
                                    <td className="border border-black p-1 h-6"></td>
                                    <td className="border border-black p-1 h-6"></td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 pl-2 text-center">2<sup className="text-[7px]">e</sup> TRIMESTRE</td>
                                    <td className="border border-black p-1 h-6"></td>
                                    <td className="border border-black p-1 h-6"></td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 pl-2 text-center">3<sup className="text-[7px]">e</sup> TRIMESTRE</td>
                                    <td className="border border-black p-1 h-6"></td>
                                    <td className="border border-black p-1 h-6"></td>
                                </tr>
                            </tbody>
                        </table>
                        
                        {/* Legend Table */}
                        <table className="w-full border-collapse border-2 border-black mt-2">
                            <tbody>
                                <tr className="bg-gray-100">
                                    <td rowSpan={3} className="border border-black font-extrabold text-center uppercase p-1 w-16">LEGENDE</td>
                                    <td className="border border-black p-1 pl-2 font-bold bg-white text-[9px]">Pourcentages</td>
                                    <td className="border border-black text-center p-1 text-[8px] bg-white">100-80</td>
                                    <td className="border border-black text-center p-1 text-[8px] bg-white">79-60</td>
                                    <td className="border border-black text-center p-1 text-[8px] bg-white">59-50</td>
                                    <td className="border border-black text-center p-1 text-[8px] bg-white">49-40</td>
                                    <td className="border border-black text-center p-1 text-[8px] bg-white">39-0</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 pl-2 font-bold text-[9px] bg-white">Qualité</td>
                                    <td className="border border-black text-center p-1 font-black text-[10px] bg-white">E</td>
                                    <td className="border border-black text-center p-1 font-black text-[10px] bg-white">TB</td>
                                    <td className="border border-black text-center p-1 font-black text-[10px] bg-white">B</td>
                                    <td className="border border-black text-center p-1 font-black text-[10px] bg-white">AB</td>
                                    <td className="border border-black text-center p-1 font-black text-[10px] bg-white">M</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 pl-2 font-bold text-[9px] bg-white">Couleurs</td>
                                    <td className="border border-black text-center p-1 font-bold text-yellow-600 text-[8px] bg-white uppercase">JAUNE</td>
                                    <td className="border border-black text-center p-1 font-bold text-blue-600 text-[8px] bg-white uppercase">BLEU</td>
                                    <td className="border border-black text-center p-1 font-bold text-green-600 text-[8px] bg-white uppercase">VERT</td>
                                    <td className="border border-black text-center p-1 font-bold text-[8px] bg-white uppercase">NOIR</td>
                                    <td className="border border-black text-center p-1 font-bold text-red-600 text-[8px] bg-white uppercase">ROUGE</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Right Column: Direction & Observations */}
                    <div className="w-[40%] flex flex-col h-full pl-4 pt-1">
                        <div className="text-right text-[9px] font-normal italic">
                            Fait à ...................................... , le ......./......./20.......
                        </div>
                        <div className="text-center font-bold mt-4 flex flex-col items-center flex-1 justify-center">
                            <p>Sceau de l'Ecole</p>
                            <p className="mt-8 mb-4">Le (la) Directeur (trice)</p>
                        </div>
                    </div>
                </div>
            )}
            
            {isMaternelle && (
                <div className="mt-2 w-full border-2 border-black p-2 min-h-[50px] flex items-start gap-2 text-[9px] z-10 relative">
                    <span className="font-extrabold whitespace-nowrap">Observations :</span>
                    <div className="flex-1 flex flex-col border-r-2 border-black pr-2">
                        <div className="border-b border-dotted border-gray-400 mt-4 w-full h-[1px]"></div>
                        <div className="border-b border-dotted border-gray-400 mt-4 w-full h-[1px]"></div>
                        <div className="mt-auto text-[7px] text-gray-500 font-normal italic pt-1 leading-tight">
                            (1) Biffer la mention inutile<br/>
                            Note importante : le bulletin est sans valeur s'il est raturé ou surchargé.<br/>
                        </div>
                    </div>
                    <div className="w-[160px] flex flex-col items-center justify-between text-center font-bold mt-1">
                        <p className="mb-8">Sceau de l'Ecole</p>
                        <p>Le (la) Directeur (trice)</p>
                    </div>
                </div>
            )}
            {isMaternelle && (
                <div className="w-full text-center mt-0.5 z-10 relative bg-black text-white py-[2px] font-bold text-[7px] tracking-widest uppercase">
                    Interdiction formelle de reproduire ce bulletin sous peine des sanctions prévues par la loi. <span className="float-right mr-2 font-mono">IGE/PS.001</span>
                </div>
            )}
            
            <div className="text-center mt-6 print:mt-2 text-[9px] text-gray-500 font-mono z-10 relative">
                Généré par ORION DIGITAL SCHOOL MANAGER - {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}
            </div>
        </div>
    );
}
