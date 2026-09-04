# Protection des années archivées et migration des paramètres par année — Plan d'action

Date: 2026-07-09

Ce document rassemble les recommandations détaillées fournies pour :
- interdiction des opérations CRUD sur les données appartenant à des années scolaires archivées,
- conception et migration des paramètres de l'école (calendar, financeSettings, configuration, etc.) vers un modèle par année scolaire,
- UI/UX pour la sélection d'année, drafts et migration sélective.

Résumé du contexte
- Objectif principal : rendre toutes les opérations de modification/suppression (CRUD) inapplicables pour des données appartenant à une année scolaire différente de l'année active, et stocker/présenter les paramètres (calendar, financeSettings, configuration, etc.) par année scolaire.
- Etat actuel : protections serveur partielles appliquées pour les élèves (guards serveur + désactivation des boutons Edit/Delete/Pay sur la page Élèves). La prochaine étape est la formalisation du schéma des paramètres par année et la migration des données.

1) Choix de conception (haut niveau)
- Créer un modèle Prisma distinct `SchoolYearSettings` lié à `schoolMatricule + schoolYear`. Chaque enregistrement contient les configurations pour cette année (calendar, financeSettings, configuration, structure, courses, timeSlots, timetables, etc.) en JSON, plus flags (`isDraft`, `createdBy`, timestamps).
- Pendant la transition, conserver les champs legacy dans `School` et introduire des helpers pour lire/écrire en priorité depuis `SchoolYearSettings` (fallback vers `School` si absent).
- Décider si `transactionCounter` (compteur de transactions) est global ou par année. Si la comptabilité doit être par année, migrer ce champ vers `SchoolYearSettings`.

2) Proposition de modèle Prisma

Ajouter dans `prisma/schema.prisma` (extrait) :

model SchoolYearSettings {
  id              String   @id @default(uuid())
  schoolMatricule String
  schoolYear      String
  isDraft         Boolean  @default(false)
  calendar        String   @default("{}")       // JSON
  financeSettings String   @default("{}")       // JSON
  configuration   String   @default("{}")       // JSON (divers)
  structure       String   @default("{}")
  courses         String   @default("{}")
  timeSlots       String   @default("{}")
  timetables      String   @default("{}")
  activityLog     String   @default("[]")
  users           String   @default("[]")
  createdBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  school School @relation(fields: [schoolMatricule], references: [matricule])
  @@index([schoolMatricule, schoolYear])
  @@unique([schoolMatricule, schoolYear])
}

Remarques :
- Utiliser des champs JSON (String) pour garder la compatibilité et éviter une grosse restructuration immédiate.
- Ajouter `transactionCounter` dans ce modèle si vous souhaitez un compteur par année.

3) Script de migration (concept & étapes)

But : copier pour chaque école les configurations actuelles depuis `School` vers `SchoolYearSettings` pour l'année active.

Étapes recommandées :
- Sauvegarde : dump complet de la base (backup indispensable).
- Générer la migration via `prisma migrate` après ajout du modèle.
- Script Node (`scripts/migrate-settings-to-year.ts`) : parcourir toutes les écoles, déterminer `activeYear` depuis `School.calendar`, puis `upsert` un `SchoolYearSettings` pour cette année avec les JSON existants.
- Tests manuels : vérifier le contenu de `SchoolYearSettings` pour quelques écoles.

Exemple de pseudo-script (voir fichier script réel à générer si nécessaire) :

```js
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const schools = await prisma.school.findMany({ select: { matricule: true, calendar: true, financeSettings: true, configuration: true, structure: true, courses: true, timeSlots: true, timetables: true, activityLog: true, users: true, transactionCounter: true } });
  for (const s of schools) {
    const calendar = JSON.parse(s.calendar || '{}');
    const activeYear = calendar.schoolYear || null;
    if (!activeYear) { console.warn(`School ${s.matricule} has no activeYear; skipping`); continue; }
    await prisma.schoolYearSettings.upsert({
      where: { schoolMatricule_schoolYear: { schoolMatricule: s.matricule, schoolYear: activeYear } },
      update: { calendar: s.calendar || '{}', financeSettings: s.financeSettings || '{}', configuration: s.configuration || '{}', structure: s.structure || '{}', courses: s.courses || '{}', timeSlots: s.timeSlots || '{}', timetables: s.timetables || '{}', activityLog: s.activityLog || '[]', users: s.users || '[]' },
      create: { schoolMatricule: s.matricule, schoolYear: activeYear, calendar: s.calendar || '{}', financeSettings: s.financeSettings || '{}', configuration: s.configuration || '{}', structure: s.structure || '{}', courses: s.courses || '{}', timeSlots: s.timeSlots || '{}', timetables: s.timetables || '{}', activityLog: s.activityLog || '[]', users: s.users || '[]' }
    });
  }
  await prisma.$disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
```

4) Modifications de code à effectuer (liste & priorités)

Stratégie : introduire un helper central `src/lib/school-settings.ts` qui fournit :
- `getSettingsForYear(matricule, schoolYear?)` — retourne les objets parsés pour l'année demandée (fallback vers School)
- `upsertSettingsForYear(matricule, schoolYear, payload)` — écriture contrôlée

Remplacer les lectures/écritures directes de `school.calendar`, `school.financeSettings`, `school.configuration`, `transactionCounter`, etc. par des appels au helper.

Priorité d'adaptation :
1. Lectures d'affichage (UI) — faible risque.
2. Actions serveur qui créent/écrasent des settings — forte prudence + tests.
3. Paiements/transactionCounter — décider si migrer per-year ou garder global.

Fichiers/locaux à vérifier (exemples) :
- `src/lib/activity-logger.ts`
- `src/app/(main)/students/actions.ts` (déjà partiellement modifié)
- `src/app/(main)/settings/...` pages
- `src/components/finance/*`
- `src/components/*` qui utilisent `school.calendar`, `financeSettings`, etc.

5) UI / UX : comportements attendus

- Sélecteur d'année (global) — dans le header admin ou le `SchoolDataProvider`
  - Lorsqu'une année différente de l'année active est sélectionnée, l'application passe en lecture seule (désactive tous les boutons de création/édition/suppression).
  - Badge visible : `Année 2024-2025 (Lecture seule)` avec tooltip explicatif.

- Page Paramètres de l'école :
  - Lister les paramètres par année avec possibilité de `Voir`, `Créer draft`, `Copier depuis autre année`.
  - Pour la création d'une nouvelle année : modal de copie sélective (cases à cocher pour sous-paramètres).

- Modal migration :
  - Cases pour `calendar`, `financeSettings`, `configuration`, `structure`, `courses`, `timeSlots`, `timetables`, `fees`, etc.
  - Option `Créer comme draft` (editable before activation)
  - Audit log pour qui a copié quoi

6) Politique de protection et exceptions

- Par défaut : toutes modifications sur des entités liées à une année différente de l'année active doivent être rejetées côté serveur (erreur explicite en français).
- Possibilité d'exception : endpoint / procédure superadmin qui permet de corriger des archives (audit obligatoire, justification, et peut être limité par un feature flag).

7) Tests & QA

- Tests unitaires pour `getSettingsForYear` et `assertStudentInActiveYear`.
- Tests d'intégration pour :
  - tentative de modification/suppression d'un élève archivé (doit échouer)
  - tentative d'enregistrement d'un paiement pour un élève archivé (doit échouer)
  - migration script : vérifier contenu exact après copie
- Tests manuels de l'UI : sélectionner année archivée -> vérifier disabling des boutons + lecture seule partout.

8) Rollout / stratégie de déploiement

- Phase 0 : backups complets
- Phase 1 : déployer Prisma model + migration script sur staging
- Phase 2 : exécuter script de migration sur staging, QA
- Phase 3 : déployer helper et lecture via SchoolYearSettings en feature flag
- Phase 4 : adapter actions critiques (students/payments/guardians) avec asserts
- Phase 5 : production (avec backup et plan rollback)

9) Checklist d'actions concrètes (ordre conseillé)
- [ ] Ajouter Prisma model `SchoolYearSettings` et créer migration
- [ ] Écrire script de migration (copie des `School.*` vers `SchoolYearSettings` pour l'année active)
- [ ] Créer helper `src/lib/school-settings.ts` (getSettingsForYear, upsertSettingsForYear)
- [ ] Adapter pages de lecture pour utiliser `getSettingsForYear` (UI)
- [ ] Adapter actions serveur critiques (students, payments, guardians, enrollments, results, assessments) : ajouter assertions d'année active
- [ ] Mettre à jour `SchoolDataProvider` / contexte global pour inclure `selectedYear` et `readOnly`
- [ ] Implémenter modal de migration (copy settings) + endpoint serveur
- [ ] Tests unitaires & intégration
- [ ] Déploiement progressif (staging → prod)

10) Estimations (ordre de grandeur)
- Migration Prisma + script : 1–2 jours
- Helpers & lecture UI adaptation : 0.5–1 jour
- Adapter actions critiques : 1–2 jours
- Modal migration + UI : 1–2 jours
- Tests & QA : 1–2 jours
Total approximatif : 4–8 jours-homme selon profondeur.

11) Risques & pièges
- Champs JSON hétérogènes dans `financeSettings` et autres ; vérifier structure avant copie.
- Décision sur `transactionCounter` (global vs par année) impacte génération de `transactionNo`.
- Backup indispensable avant toute migration irréversible.

12) Artefacts livrables (sur demande)
- PR avec Prisma model + migration
- Script Node de migration
- Helper `src/lib/school-settings.ts`
- Exemples d'adaptations (students/actions déjà partiellement couvert)
- UI modal de migration + endpoints

---

Si vous voulez, je peux maintenant :
- générer le PR initial (Prisma model + migration script), ou
- générer le script Node réel et le commit dans `scripts/`, ou
- simplement laisser ce document ici pour que vous le consultiez et validiez la stratégie.

Fin du document.
