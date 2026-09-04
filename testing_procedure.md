# Procédure de Test : Système de Publication

Cette procédure permet de vérifier l'intégrité du flux de données entre la saisie des notes et la Vue Panoramique.

## 1. Vérification du Status de Publication
L'erreur la plus courante est qu'une épreuve soit enregistrée mais pas encore **Publiée**.
1. Allez dans le **Cahier des Cotes** de votre cours.
2. Identifiez l'épreuve concernée.
3. Vérifiez la colonne **Statut** :
   - 🟠 **Brouillon** : Les notes ne sont pas encore comptabilisées.
   - 🟢 **Publié** : Les notes devraient apparaître.
   - 🔵 **Modifié** : Les anciennes notes sont affichées, les nouvelles attendent une mise à jour.
4. **Action** : Cliquez sur "Modifier" l'épreuve, puis sur le bouton **Publier** (vert) en haut à droite. Confirmez par "Publier maintenant".

## 2. Vérification du Debugger (Vue Panoramique)
J'ai ajouté un indicateur temporaire sous le titre de la Vue Panoramique.
- Regardez le texte : `Debug: [X] épreuves reçues`.
- **Cas A : Debug: 0**
  - Signifie que le serveur ne trouve aucune épreuve pour cette classe précise (`1e Primaire A`).
  - Cause possible : Le nom de la classe dans votre profil ne correspond pas exactement à celui utilisé lors de la création de l'épreuve.
- **Cas B : Debug: [Nombre > 0]**
  - Signifie que les données arrivent sur votre navigateur, mais qu'elles ne s'affichent pas dans le tableau.
  - Cause possible : Le nom du cours dans l'en-tête du tableau ne correspond pas à celui de l'épreuve (même avec le fuzzy matching).

## 3. Test de Correspondance des Noms (Fuzzy Matching)
Si vous voyez des épreuves dans le Debug mais rien dans le tableau :
1. Notez le nom exact du cours en haut de la colonne vide (ex: `ARTS DRAMA...`).
2. Allez dans l'épreuve et vérifiez son titre ou son ID de cours.
3. **Action** : Essayez de renommer l'épreuve pour inclure le mot clé du cours (ex: "Examen Arts Dramatiques"). Mon système de fuzzy matching devrait alors faire le lien.

## 4. Vérification de la Période
Bien que j'aie temporairement désactivé le filtre de période pour le test :
1. Assurez-vous que l'épreuve appartient bien à la période active (`Trimestre 1 - Période 1`).
2. Si vous changez la période dans le sélecteur en haut de page, vérifiez si les données apparaissent.

---
> [!NOTE]
> Si après avoir publié (bouton vert) et vérifié que le Debug affiche un nombre > 0, le tableau reste vide, merci de me transmettre le nom exact affiché dans la colonne du tableau.
