/**
 * ODSM — Script de migration des données existantes
 * 
 * Ce script :
 * 1. Attribue le schoolYear de l'année active (depuis le calendrier) à toutes les
 *    épreuves (Assessment) et périodes (Period) existantes qui n'ont pas de schoolYear.
 * 2. Génère un rapport de diagnostic détaillé pour l'école VCX51U.
 * 
 * Usage : node scripts/migrate-school-year.mjs
 */

import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', 'dev.db');
const dbUrl = `file:${dbPath.replace(/\\/g, '/')}`;

const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

/** Extraire l'année scolaire active depuis le JSON calendrier */
function resolveActiveYear(calendar) {
    if (!calendar) return null;
    if (calendar.schoolYear) return calendar.schoolYear;
    for (const levelKey of ['secondaire', 'primaire', 'maternelle']) {
        if (calendar[levelKey]?.schoolYear) return calendar[levelKey].schoolYear;
    }
    return null;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   ODSM — Migration schoolYear + Diagnostic VCX51U       ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // ─────────────────────────────────────────────────────────────
    // PARTIE 1 : Migration globale de toutes les écoles
    // ─────────────────────────────────────────────────────────────
    console.log('━━━ PARTIE 1 : Migration schoolYear globale ━━━\n');

    const schools = await prisma.school.findMany({
        select: { matricule: true, name: true, calendar: true }
    });

    console.log(`Écoles trouvées : ${schools.length}\n`);

    let totalAssessmentsMigrated = 0;
    let totalPeriodsMigrated = 0;

    for (const school of schools) {
        let calendar = null;
        try {
            calendar = school.calendar ? JSON.parse(school.calendar) : null;
        } catch (e) {
            console.warn(`  ⚠️  [${school.matricule}] Impossible de parser le calendrier`);
        }

        const activeYear = resolveActiveYear(calendar);

        if (!activeYear) {
            console.log(`  ⚠️  [${school.matricule}] ${school.name} — Aucune année active trouvée dans le calendrier. Ignoré.`);
            continue;
        }

        console.log(`  📅 [${school.matricule}] ${school.name} — Année active : ${activeYear}`);

        // Migrer les Assessment sans schoolYear
        const assessmentsToMigrate = await prisma.assessment.findMany({
            where: {
                schoolMatricule: school.matricule,
                schoolYear: null
            },
            select: { id: true }
        });

        if (assessmentsToMigrate.length > 0) {
            const result = await prisma.assessment.updateMany({
                where: {
                    schoolMatricule: school.matricule,
                    schoolYear: null
                },
                data: { schoolYear: activeYear }
            });
            totalAssessmentsMigrated += result.count;
            console.log(`     ✅ ${result.count} épreuve(s) migrée(s) → schoolYear="${activeYear}"`);
        } else {
            console.log(`     ✓  Aucune épreuve à migrer`);
        }

        // Migrer les Period sans schoolYear
        const periodsToMigrate = await prisma.period.findMany({
            where: {
                schoolMatricule: school.matricule,
                schoolYear: null
            },
            select: { id: true }
        });

        if (periodsToMigrate.length > 0) {
            const result = await prisma.period.updateMany({
                where: {
                    schoolMatricule: school.matricule,
                    schoolYear: null
                },
                data: { schoolYear: activeYear }
            });
            totalPeriodsMigrated += result.count;
            console.log(`     ✅ ${result.count} période(s) migrée(s) → schoolYear="${activeYear}"`);
        } else {
            console.log(`     ✓  Aucune période à migrer`);
        }

        console.log('');
    }

    console.log(`\n━━━ Résumé migration ━━━`);
    console.log(`   Épreuves migrées  : ${totalAssessmentsMigrated}`);
    console.log(`   Périodes migrées  : ${totalPeriodsMigrated}`);

    // ─────────────────────────────────────────────────────────────
    // PARTIE 2 : Diagnostic spécifique VCX51U
    // ─────────────────────────────────────────────────────────────
    console.log('\n\n━━━ PARTIE 2 : Diagnostic VCX51U ━━━\n');

    const TARGET_MATRICULE = 'VCX51U';

    const school = await prisma.school.findUnique({
        where: { matricule: TARGET_MATRICULE },
        include: {
            students: {
                select: { id: true, firstName: true, lastName: true, gradeName: true, schoolYear: true, status: true }
            },
            periods: {
                select: { id: true, name: true, type: true, level: true, schoolYear: true }
            },
            assessments: {
                select: { id: true, title: true, schoolYear: true, classroomId: true, courseId: true, periodId: true, createdAt: true }
            }
        }
    });

    if (!school) {
        console.log(`❌ École ${TARGET_MATRICULE} introuvable dans la base de données.`);
    } else {
        let calendar = null;
        try {
            calendar = school.calendar ? JSON.parse(school.calendar) : null;
        } catch (e) { /* ignore */ }

        const activeYear = resolveActiveYear(calendar);

        console.log(`École : ${school.name} (${TARGET_MATRICULE})`);
        console.log(`Année active : ${activeYear || 'NON DÉFINIE'}\n`);

        // --- Élèves ---
        console.log(`📋 Élèves (${school.students.length} total) :`);
        const studentsByYear = {};
        for (const s of school.students) {
            const yr = s.schoolYear || 'sans_annee';
            if (!studentsByYear[yr]) studentsByYear[yr] = [];
            studentsByYear[yr].push(s);
        }
        for (const [yr, list] of Object.entries(studentsByYear)) {
            console.log(`   Année "${yr}" : ${list.length} élève(s)`);
            if (yr !== activeYear && yr !== 'sans_annee') {
                console.log(`   ⚠️  ATTENTION: Ces élèves appartiennent à une autre année que l'année active "${activeYear}"!`);
                list.slice(0, 5).forEach(s => {
                    console.log(`       - ${s.firstName} ${s.lastName} (${s.gradeName}) [${s.status}]`);
                });
                if (list.length > 5) console.log(`       ... et ${list.length - 5} autres`);
            }
        }

        // --- Périodes ---
        console.log(`\n📅 Périodes (${school.periods.length} total) :`);
        const periodsByYear = {};
        for (const p of school.periods) {
            const yr = p.schoolYear || 'sans_annee';
            if (!periodsByYear[yr]) periodsByYear[yr] = [];
            periodsByYear[yr].push(p);
        }
        for (const [yr, list] of Object.entries(periodsByYear)) {
            console.log(`   Année "${yr}" : ${list.length} période(s) — ${list.map(p => p.name).join(', ')}`);
        }

        // --- Épreuves ---
        console.log(`\n📝 Épreuves (${school.assessments.length} total) :`);
        const assessmentsByYear = {};
        for (const a of school.assessments) {
            const yr = a.schoolYear || 'sans_annee';
            if (!assessmentsByYear[yr]) assessmentsByYear[yr] = [];
            assessmentsByYear[yr].push(a);
        }
        for (const [yr, list] of Object.entries(assessmentsByYear)) {
            const flag = yr !== activeYear && yr !== 'sans_annee' ? '⚠️  AUTRE ANNEE' : '';
            console.log(`   Année "${yr}" : ${list.length} épreuve(s) ${flag}`);
            list.slice(0, 3).forEach(a => {
                console.log(`       - [${a.createdAt.toLocaleDateString('fr-FR')}] ${a.title}`);
            });
            if (list.length > 3) console.log(`       ... et ${list.length - 3} autres`);
        }

        // --- Incohérences détectées ---
        console.log('\n🔍 Analyse des incohérences :');
        
        const activeStudents = school.students.filter(s => s.schoolYear === activeYear);
        const otherYearStudents = school.students.filter(s => s.schoolYear && s.schoolYear !== activeYear);
        const noYearStudents = school.students.filter(s => !s.schoolYear);
        
        if (otherYearStudents.length > 0) {
            console.log(`   ❌ ${otherYearStudents.length} élève(s) avec une année différente de l'année active`);
            console.log(`      → Ces élèves n'apparaissent plus dans l'année active.`);
            console.log(`      → Si certains doivent être dans l'année active, leurs données student.schoolYear doivent être mises à jour.`);
        }

        if (noYearStudents.length > 0) {
            console.log(`   ⚠️  ${noYearStudents.length} élève(s) sans schoolYear (ancienne inscription)`);
        }

        if (activeStudents.length === 0 && school.students.length > 0) {
            console.log(`   ❌ PROBLÈME CRITIQUE : Aucun élève pour l'année active "${activeYear}" !`);
            console.log(`      → Vérifiez que les élèves ont bien été inscrits avec l'année scolaire correcte.`);
        } else {
            console.log(`   ✅ ${activeStudents.length} élève(s) actifs pour l'année "${activeYear}"`);
        }

        // Proposer des correctifs si nécessaire
        const assessmentsInOtherYears = school.assessments.filter(a => a.schoolYear && a.schoolYear !== activeYear);
        if (assessmentsInOtherYears.length > 0) {
            console.log(`\n   ⚠️  ${assessmentsInOtherYears.length} épreuve(s) d'une autre année scolaire détectée(s).`);
            console.log(`      Ces épreuves ne s'afficheront plus dans l'année active.`);
            console.log(`      Si des épreuves doivent être corrigées (ex: mal assignées), mettez à jour leur schoolYear manuellement.`);
        }
    }

    console.log('\n\n✅ Script terminé.\n');
}

main()
    .catch((e) => {
        console.error('Erreur lors de l\'exécution du script :', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
