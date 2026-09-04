# Guide de Sauvegarde & Restauration ODSM v2

Ce guide détaille le fonctionnement du système de sauvegarde et restauration mis en place pour protéger les données des établissements.

---

## 1. Sauvegarde via l'Application (Recommandé)

### Pour l'Administrateur Système (Admin de l'école)
1. Allez dans **Paramètres > Sauvegardes & Restauration**.
2. Cliquez sur **"Sauvegarder Maintenant"**.
3. Un fichier `.odsm` chiffré sera créé dans `C:\ODSM_Backups\` avec le format :
   `{MATRICULE}_{date}.odsm` (ex: `A7B9XC_2026-05-16T04-30.odsm`)
4. Seuls les fichiers de votre établissement vous sont accessibles.

### Pour le Superadmin
1. Accédez au **Dashboard Superadmin > Système & Sauvegardes**.
2. **Backup Global** : Sauvegarde complète de tout le système (toutes les écoles).
   Format : `ODSM_GLOBAL_{date}.odsm`
3. **Backup par École** : Dans l'onglet **Gestion des Tenants**, cliquez sur une école puis utilisez le bouton "Sauvegarder" dans la section Backup & Restauration.
   Format : `{MATRICULE}_{date}.odsm`

---

## 2. Restauration via l'Application

### Pour l'Administrateur Système
1. Allez dans **Paramètres > Sauvegardes & Restauration**.
2. La liste de vos fichiers de backup apparaît automatiquement.
3. Sélectionnez le fichier à restaurer et cliquez sur **"Restaurer"**.
4. **Important** : Vous ne pouvez restaurer que les fichiers de votre propre établissement.
5. Un backup de sécurité est automatiquement créé avant chaque restauration.

### Pour le Superadmin
1. Deux points d'accès pour la restauration :
   - **Système & Sauvegardes** : Liste tous les fichiers (globaux et par école).
   - **Gestion des Tenants** : Dans le panneau détaillé d'une école, section Backup.
2. Le superadmin peut restaurer n'importe quel fichier (global ou spécifique).

### Messages d'erreur possibles
- **"Accès refusé : ce fichier appartient à l'établissement [MATRICULE]"** → Vous tentez de restaurer un backup qui ne vous appartient pas.
- **"Les sauvegardes globales sont réservées au superadmin"** → Seul le superadmin peut restaurer des backups globaux.
- **"Fichier corrompu ou clé invalide"** → Le fichier est endommagé ou provient d'une autre installation.

---

## 3. Restauration Manuelle (Secours)

En cas de défaillance de l'interface, suivez ces étapes manuelles :

### Étape 1 : Arrêter l'application
```powershell
# Arrêtez le serveur ODSM
Ctrl+C dans la console ou :
taskkill /F /IM node.exe
```

### Étape 2 : Localiser le fichier de backup
Les fichiers `.odsm` sont stockés dans `C:\ODSM_Backups\`.
Note : Ces fichiers sont chiffrés et ne peuvent pas être ouverts directement.

### Étape 3 : Restaurer la base de données manuellement
Si vous disposez d'un fichier `PRE_RESTORE_*.db` (créé automatiquement avant chaque restauration) :
```powershell
# Depuis le dossier d'installation ODSM
cd C:\Users\<utilisateur>\Documents\ODSM\odsm-v2

# Remplacer la base de données
copy C:\ODSM_Backups\PRE_RESTORE_xxxxx.db .\dev.db
```

### Étape 4 : Redémarrer l'application
```powershell
npm run dev
```

---

## 4. Bonnes Pratiques

1. **Sauvegardez régulièrement** : Après chaque saisie importante (notes, paiements).
2. **Conservez les backups USB** : Branchez une clé USB avec le dossier `ODSM_USB_BACKUP` pour les copies externes.
3. **Vérifiez les backups** : Consultez la liste des fichiers dans l'interface pour vous assurer que les sauvegardes sont bien créées.
4. **Contactez le superadmin** si vous ne parvenez pas à restaurer un backup.

---

## 5. Règles de Propriété des Backups

| Rôle | Peut sauvegarder | Peut restaurer |
|------|-----------------|----------------|
| Admin Système | Son école uniquement | Fichiers de son école uniquement |
| Superadmin | Global + Par école | Tout fichier (global ou par école) |

> **Note** : Un établissement peut avoir plusieurs admins système. Les fichiers de backup de l'établissement sont accessibles à tous ses admins.
