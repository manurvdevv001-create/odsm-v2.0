/**
 * Contenu d'aide contextuelle pour chaque page du portail enseignant.
 * Utilisé par le composant PageHelp pour afficher l'aide spécifique à chaque page.
 */

export interface HelpSection {
    title: string;
    description: string;
    features: { label: string; detail: string }[];
    howTo: { step: string; description: string }[];
    tips?: string[];
}

export const helpContent: Record<string, HelpSection> = {
    "panoramic": {
        title: "Vue Panoramique — Palmarès Général",
        description:
            "La Vue Panoramique affiche un tableau croisé de tous les élèves et leurs résultats par matière pour la période active. Elle utilise un total FIXE : le dénominateur est la somme des BaseMax de TOUS les cours, qu'ils soient clôturés ou non.",
        features: [
            {
                label: "Total Fixe",
                detail: "Le pourcentage est calculé sur le total de tous les cours de la classe, même ceux dont le cahier de cotes n'a pas encore été soumis. Cela montre la progression réelle de l'élève."
            },
            {
                label: "Badge « Ouvert »",
                detail: "Indique que le cahier de cotes de ce cours n'a pas encore été clôturé par l'enseignant. Aucun score n'est disponible."
            },
            {
                label: "Badge « Vide »",
                detail: "Le cahier de cotes est clôturé mais l'élève a un manque de cotes (absence non résolue). Le résultat ne peut pas être compilé."
            },
            {
                label: "Mode Simulation",
                detail: "Traite les absences comme des zéros pour estimer la performance de l'élève. L'astérisque (*) reste visible pour signaler le litige."
            },
            {
                label: "Tri des colonnes",
                detail: "Cliquez sur les en-têtes de colonnes pour trier les élèves par score dans une matière, par total, ou par moyenne."
            },
            {
                label: "Libérer un cahier",
                detail: "L'icône de cadenas à côté d'un cours clôturé permet au Titulaire de libérer le cahier de cotes pour permettre à l'enseignant de le modifier."
            }
        ],
        howTo: [
            { step: "Consulter les résultats", description: "Les résultats apparaissent automatiquement dès qu'un enseignant clôture son cahier de cotes." },
            { step: "Identifier les déficits", description: "Les cours affichant « Ouvert » n'ont pas encore été soumis. Le pourcentage de l'élève est délibérément bas pour refléter ce manque." },
            { step: "Gérer un manque de cotes", description: "Si un cours affiche « Vide », l'élève a une absence non résolue. Utilisez le Mode Simulation pour évaluer l'impact, ou libérez le cahier pour que l'enseignant puisse intervenir." }
        ],
        tips: [
            "Le Palmarès converge avec le Rendement Actuel lorsque tous les cahiers sont clôturés.",
            "Utilisez le tri par « MOY % » pour identifier rapidement les élèves en difficulté."
        ]
    },

    "performance": {
        title: "Vue Consolidée — Rendement Actuel",
        description:
            "La Vue Consolidée affiche le classement des élèves basé uniquement sur les cours dont les cahiers de cotes ont été clôturés. Elle utilise un total FLEXIBLE : le dénominateur est la somme des BaseMax des seuls cours clôturés.",
        features: [
            {
                label: "Total Flexible",
                detail: "Le pourcentage est calculé uniquement sur les cours clôturés. Cela reflète la performance réelle de l'élève sans pénaliser pour les cours non encore soumis."
            },
            {
                label: "Classement par rang",
                detail: "Les élèves sont automatiquement triés par pourcentage décroissant, avec le rang affiché."
            },
            {
                label: "Badge « Complet / Vide »",
                detail: "Indique si l'élève a tous ses résultats compilés (Complet) ou s'il y a un manque de cotes (Vide)."
            },
            {
                label: "Mode Simulation",
                detail: "En simulation, les absences sont traitées comme 0. Le total flexible reste le même, mais le numérateur inclut le 0 du cours litigieux."
            },
            {
                label: "Mention",
                detail: "Affiche « Réussite » (≥ 50%) ou « Échec » (< 50%) pour chaque élève."
            }
        ],
        howTo: [
            { step: "Lire le rendement", description: "Chaque élève est classé par sa performance sur les cours dont les résultats sont disponibles." },
            { step: "Comparer avec le Palmarès", description: "Si un élève a 63% en Rendement mais 42% en Palmarès, cela signifie qu'il performe bien sur les cours disponibles mais que beaucoup de résultats manquent encore." },
            { step: "Exporter les données", description: "Utilisez le bouton Exporter pour générer un fichier des résultats consolidés." }
        ],
        tips: [
            "Le badge « COURS CLÔTURÉS (MAX X) » en haut indique le total flexible actuel.",
            "L'astérisque (*) signale un litige à résoudre avant la clôture de la période."
        ]
    },

    "bulletins": {
        title: "Génération des Bulletins",
        description:
            "Cette page génère les bulletins scolaires pour chaque élève de la classe. Les boutons en haut permettent de contrôler le mode de calcul et l'étendue temporelle des résultats affichés.",
        features: [
            {
                label: "Palmarès Général",
                detail: "Remplit le bulletin avec les résultats de la Vue Panoramique (total fixe). Les scores reflètent la progression de l'élève par rapport au total attendu de la période."
            },
            {
                label: "Rendement Actuel",
                detail: "Remplit le bulletin avec les résultats de la Vue Consolidée (total flexible). Seuls les cours clôturés apparaissent."
            },
            {
                label: "Mode Simulation",
                detail: "Traite les absences comme des zéros. Peut être combiné avec Palmarès ou Rendement."
            },
            {
                label: "Résultats Cumulés",
                detail: "OFF : affiche uniquement la période active. ON : affiche la période active plus toutes les périodes précédentes de l'année scolaire."
            },
            {
                label: "Imprimer",
                detail: "Génère une version imprimable de tous les bulletins, optimisée pour le format A4."
            },
            {
                label: "Clôturer Période",
                detail: "Transmet officiellement les résultats de la classe à l'administration. Après clôture, les résultats ne peuvent plus être modifiés sans intervention de l'administration."
            }
        ],
        howTo: [
            { step: "Générer un bulletin vierge", description: "Accédez à la page sans activer aucun mode. Les bulletins s'affichent avec la structure (en-têtes, cours, maxima) sans données." },
            { step: "Remplir avec le Palmarès", description: "Activez « Palmarès Général ». Tous les scores des cahiers clôturés s'affichent. Le total est calculé sur le maximum complet de la période." },
            { step: "Remplir avec le Rendement", description: "Activez « Rendement Actuel ». Seuls les scores des cours clôturés apparaissent. Le total est calculé sur le maximum des seuls cours clôturés." },
            { step: "Voir l'année complète", description: "Activez « Résultats Cumulés » pour afficher les colonnes de toutes les périodes précédentes en plus de la période active." },
            { step: "Imprimer", description: "Cliquez sur « Imprimer ». Le système ouvre la boîte de dialogue d'impression avec une mise en page A4 optimisée." }
        ],
        tips: [
            "Palmarès Général et Rendement Actuel sont mutuellement exclusifs : activer l'un désactive l'autre.",
            "Le Mode Simulation peut être activé en même temps que n'importe quel mode.",
            "Vérifiez toujours les résultats avant de cliquez sur « Clôturer Période » — cette action est irréversible sans intervention de l'administration."
        ]
    },

    "titulaire": {
        title: "Tableau de Bord du Titulaire",
        description:
            "Le tableau de bord du Titulaire donne une vue d'ensemble de l'état des cahiers de cotes pour la classe assignée. Il permet de naviguer rapidement vers les différents outils d'évaluation.",
        features: [
            {
                label: "Suivi des clôtures",
                detail: "Affiche le nombre de cahiers de cotes clôturés vs ouverts pour la période active."
            },
            {
                label: "Vue Panoramique",
                detail: "Accès direct au tableau croisé des résultats (Palmarès Général)."
            },
            {
                label: "Consolidation",
                detail: "Accès direct au classement par rendement (Rendement Actuel)."
            },
            {
                label: "Bulletins",
                detail: "Accès direct à la génération des bulletins."
            },
            {
                label: "Libérer un cours",
                detail: "Permet de rendre accessible un cahier de cotes clôturé pour qu'un enseignant puisse le modifier."
            }
        ],
        howTo: [
            { step: "Vérifier l'état des cours", description: "Le tableau liste tous les cours avec leur statut (Clôturé / Ouvert). Un cours clôturé signifie que l'enseignant a terminé la saisie." },
            { step: "Libérer un cours", description: "Si un enseignant a besoin de modifier les résultats après clôture, cliquez sur le bouton « Libérer » à côté du cours concerné." },
            { step: "Naviguer", description: "Utilisez les cartes de navigation pour accéder rapidement à la Vue Panoramique, la Consolidation ou les Bulletins." }
        ]
    },

    "courses": {
        title: "Mes Cours",
        description:
            "Affiche la liste des cours assignés à l'enseignant pour la période active. Chaque cours mène aux détails des évaluations, à la grille de cotes et à la gestion des notes.",
        features: [
            {
                label: "Liste des cours",
                detail: "Tous les cours assignés à l'enseignant sont affichés avec le nombre d'évaluations et d'élèves."
            },
            {
                label: "Accès au cahier de cotes",
                detail: "Cliquez sur un cours pour accéder à la grille de cotes, créer des évaluations et saisir les résultats."
            },
            {
                label: "Statut de clôture",
                detail: "Indique si le cahier de cotes a été clôturé pour la période active."
            }
        ],
        howTo: [
            { step: "Ouvrir un cours", description: "Cliquez sur le nom du cours pour accéder à ses détails." },
            { step: "Créer une évaluation", description: "Depuis la page du cours, utilisez le bouton « Nouvelle Évaluation » pour ajouter une épreuve." },
            { step: "Clôturer le cahier", description: "Quand toutes les évaluations sont complètes, utilisez le bouton « Clôturer » pour soumettre les résultats au Titulaire." }
        ]
    },

    "planning": {
        title: "Planification des Évaluations",
        description:
            "Permet de planifier et visualiser les évaluations à venir sur un calendrier. Aide à coordonner les dates d'épreuves pour éviter les conflits.",
        features: [
            {
                label: "Vue calendrier",
                detail: "Visualisez toutes les évaluations planifiées sur un calendrier mensuel."
            },
            {
                label: "Nouvelle évaluation",
                detail: "Créez une nouvelle évaluation en spécifiant le cours, la date, le type et le barème."
            }
        ],
        howTo: [
            { step: "Planifier une évaluation", description: "Cliquez sur « Nouvelle » pour créer une évaluation. Remplissez le formulaire avec le cours, la date et le barème." },
            { step: "Vérifier les conflits", description: "Le calendrier affiche toutes les évaluations de la classe pour éviter de programmer plusieurs épreuves le même jour." }
        ]
    }
};

/**
 * Contenu complet du guide d'utilisateur pour la page dédiée /teacher/help
 */
export const fullGuideContent = {
    title: "Guide d'Évaluation ODSM",
    subtitle: "Système de Bulletins et Performance",
    sections: [
        {
            id: "philosophy",
            title: "Philosophie de l'évaluation",
            icon: "🎯",
            content: `Toutes les données visibles par le Titulaire proviennent exclusivement des cahiers de cotes clôturés par les enseignants. Aucune donnée "en cours de saisie" ne remonte au niveau du Titulaire.`,
            details: [
                "L'Enseignant saisit les résultats dans son cahier de cotes, puis le clôture quand il est complet.",
                "Le Titulaire reçoit les cahiers clôturés et interprète les résultats pour générer les bulletins.",
                "Ce cloisonnement garantit que seuls les résultats finaux et validés par l'enseignant sont utilisés dans les bulletins."
            ]
        },
        {
            id: "lifecycle",
            title: "Cycle de vie des données",
            icon: "🔄",
            content: "Le parcours d'un résultat suit un flux strict, de la saisie par l'enseignant jusqu'à l'impression du bulletin.",
            details: [
                "1. L'enseignant crée une évaluation (épreuve) pour un cours et une période.",
                "2. Les élèves passent l'épreuve.",
                "3. L'enseignant saisit les scores dans la grille de cotes.",
                "4. Quand toutes les épreuves de la période sont complètes, l'enseignant clôture le cahier de cotes.",
                "5. Les résultats remontent automatiquement chez le Titulaire.",
                "6. Le Titulaire interprète les résultats via les deux vues (Palmarès et Rendement).",
                "7. Le Titulaire génère et imprime les bulletins."
            ]
        },
        {
            id: "palmares",
            title: "Palmarès Général — Total Fixe",
            icon: "📊",
            content: "Le Palmarès Général répond à la question : « Où en est l'élève par rapport au total attendu pour la période ? »",
            details: [
                "Formule : Pourcentage = (x / y) × 100",
                "x = Somme des scores transposés des cahiers clôturés",
                "y = Somme des BaseMax de TOUS les cours de la classe (clôturés ou non)",
                "",
                "Le Palmarès est intentionnellement « pessimiste » : le pourcentage est bas tant que des cours n'ont pas été soumis. C'est un outil de suivi de PROGRESSION."
            ],
            example: {
                title: "Exemple",
                rows: [
                    { course: "Algèbre", baseMax: 20, status: "Clôturé", score: "14.0" },
                    { course: "Anatomie", baseMax: 10, status: "Ouvert", score: "—" },
                    { course: "Anglais", baseMax: 10, status: "Ouvert", score: "—" },
                    { course: "Bonus", baseMax: 10, status: "Clôturé", score: "5.8" },
                    { course: "Botanique", baseMax: 10, status: "Clôturé", score: "5.4" }
                ],
                result: "x = 25.2 | y = 60 (tous les cours) | Pourcentage = 42.0%"
            }
        },
        {
            id: "rendement",
            title: "Rendement Actuel — Total Flexible",
            icon: "📈",
            content: "Le Rendement Actuel répond à la question : « Comment performe l'élève sur les résultats disponibles ? »",
            details: [
                "Formule : Pourcentage = (x / y) × 100",
                "x = Somme des scores transposés des cahiers clôturés (IDENTIQUE au Palmarès)",
                "y = Somme des BaseMax des cours dont les cahiers sont CLÔTURÉS uniquement",
                "",
                "Le Rendement Actuel est « optimiste » : il se focalise sur la performance réelle sans pénaliser les cours manquants. C'est un outil de mesure de PERFORMANCE."
            ],
            example: {
                title: "Exemple (mêmes données)",
                rows: [],
                result: "x = 25.2 | y = 40 (cours clôturés seuls) | Pourcentage = 63.0%"
            }
        },
        {
            id: "absences",
            title: "Le Manque de Cotes",
            icon: "⚠️",
            content: "ODSM ne dispose pas d'un mécanisme automatique pour la prise en charge des absences. Les raisons d'une absence varient d'un cas à un autre et nécessitent un traitement humain.",
            details: [
                "Un manque de cotes survient lorsqu'un élève est absent à une épreuve et que l'enseignant clôture son cahier sans résolution.",
                "En mode Standard : le cours est marqué « Vide » et ne contribue PAS au total de l'élève.",
                "L'astérisque (*) à côté du nom de l'élève signale un litige à résoudre.",
                "Le Titulaire peut : (1) libérer le cahier pour que l'enseignant intervienne, ou (2) utiliser la Simulation pour évaluer l'impact."
            ]
        },
        {
            id: "simulation",
            title: "Le Mode Simulation",
            icon: "🧪",
            content: "Le mode Simulation traite les absences comme des zéros pour permettre une projection. C'est un outil d'aide à la décision, pas un résultat officiel.",
            details: [
                "En Simulation, un élève absent obtient 0 points pour les épreuves manquées.",
                "Le total est calculé en incluant le 0 (au lieu d'exclure le cours).",
                "Le (*) reste visible pour rappeler que le litige n'est pas résolu.",
                "La Simulation peut être combinée avec le Palmarès ou le Rendement.",
                "",
                "Exemple : Épreuve manquée sur 10, BaseMax 20 → Score simulé = (7+0+6)/30 × 20 = 8.7/20"
            ]
        },
        {
            id: "cumules",
            title: "Les Résultats Cumulés",
            icon: "📚",
            content: "Le toggle Résultats Cumulés contrôle l'étendue temporelle des résultats affichés dans le bulletin.",
            details: [
                "OFF : Affiche uniquement les résultats de la période active.",
                "ON : Affiche les résultats de la période active PLUS toutes les périodes précédentes.",
                "Exemple : Si la période active est « Période 2 », les colonnes Période 1 + Examen 1 + Période 2 apparaissent."
            ]
        },
        {
            id: "cloture",
            title: "La Clôture de Période",
            icon: "🔒",
            content: "La clôture de période est l'acte par lequel le Titulaire transmet officiellement les résultats consolidés de sa classe à l'administration.",
            details: [
                "Vérifiez que tous les cahiers de cotes sont clôturés.",
                "Vérifiez que tous les litiges (manques de cotes) sont résolus.",
                "Cliquez sur « Clôturer Période ».",
                "Les résultats sont transmis et verrouillés.",
                "Seule l'administration peut déverrouiller une période clôturée."
            ]
        }
    ],
    glossary: [
        { term: "BaseMax", definition: "Le maximum de points attribué à un cours pour une période (ex: 20, 10, 40)." },
        { term: "Cahier de Cotes", definition: "L'ensemble des évaluations d'un enseignant pour un cours et une période." },
        { term: "Clôture", definition: "Action de verrouiller un cahier (enseignant) ou une période (titulaire)." },
        { term: "Litige", definition: "Situation non résolue (manque de cotes) signalée par le badge (*)." },
        { term: "Manque de Cotes", definition: "Absence non résolue dans un cahier de cotes clôturé." },
        { term: "Palmarès Général", definition: "Vue à total fixe : score ÷ total de TOUS les cours. Mesure la progression." },
        { term: "Rendement Actuel", definition: "Vue à total flexible : score ÷ total des cours clôturés. Mesure la performance." },
        { term: "Score Transposé", definition: "Score brut ramené au BaseMax (ex: 21/30 → 14.0/20)." },
        { term: "Simulation", definition: "Mode qui traite les absences comme des zéros. Outil d'aide à la décision." },
        { term: "Titulaire", definition: "Enseignant responsable d'un local (classe)." }
    ]
};
