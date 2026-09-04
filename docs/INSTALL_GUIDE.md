# Guide d'Installation ODSM v2

Ce guide détaille les étapes techniques pour installer l'application ODSM v2 chez un client.

---

## 1. Préparation du Package (Depuis l'environnement de Dev)

Avant de vous rendre chez le client, préparez un dossier contenant les fichiers suivants :

- **src/** (Code source)
- **public/** (Assets et uploads)
- **prisma/** (Schéma de la base de données)
- **scripts/** (Contient `install.ps1` et `backup.ps1`)
- **package.json** & **package-lock.json**
- **next.config.ts**
- **tsconfig.json**
- **.env.example** (À renommer en `.env` chez le client)

---

## 2. Installation chez le client

### Étape A : Pré-requis
Assurez-vous que la machine du client possède :
1. **Node.js LTS** (Télécharger sur nodejs.org)
2. **SQLite3** installé.

### Étape B : Exécution du script
1. Copiez le dossier de l'application sur le disque dur du client (ex: `C:\ODSM`).
2. Ouvrez **PowerShell** en tant qu'administrateur.
3. Allez dans le dossier des scripts : `cd C:\ODSM\scripts`.
4. Lancez l'installation automatique :
   ```powershell
   .\install.ps1
   ```
   *Ce script installe les dépendances, configure la base de données et effectue le build de production.*

---

## 3. Premier Lancement et Test
1. Renommez `.env.example` en `.env` et configurez les variables de base.
2. Dans le dossier racine (`C:\ODSM`), lancez :
   ```bash
   npm run start
   ```
3. Vérifiez l'accès à l'interface de login.

---

## 4. Support technique
En cas d'erreur lors du build ou de l'installation, vérifiez que le port 3000 est libre et que les permissions d'écriture sur le dossier `C:\ODSM` sont accordées.
