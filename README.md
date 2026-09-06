[README.md](https://github.com/user-attachments/files/31879894/README.md)
# Scolaire — PWA personnelle

Application web progressive (PWA) personnelle pour le suivi scolaire :
devoirs de la semaine, emploi du temps, activités Thrive, évaluations,
notes personnelles. 100 % HTML/CSS/JS natif, aucune dépendance, aucun
serveur — tout est fait pour être hébergé gratuitement sur **GitHub
Pages**.

## Structure du projet

```
index.html          → les 3 écrans (Accueil, Emploi du temps, Réglages)
css/style.css        → tous les styles (thème sombre/clair inclus)
js/i18n.js           → dictionnaire de traduction FR/EN
js/app.js            → toute la logique (état, navigation, actions)
manifest.json        → configuration PWA (icône, nom, couleurs)
sw.js                → service worker (fonctionnement hors-ligne)
assets/icons/        → icônes générées à partir de ton logo
```

## Comment fonctionnent les données

Tout ce que tu ajoutes (devoirs, notes, évaluations, activités Thrive,
photos d'emploi du temps) est stocké **directement dans le navigateur**
de ton téléphone (`localStorage`), pas sur un serveur. Concrètement :

- pas besoin de compte, pas de connexion internet requise après le
  premier chargement (grâce au service worker) ;
- les données restent **propres à cet appareil et à ce navigateur** —
  si tu changes de téléphone ou effaces les données de site, elles
  disparaissent (il n'y a pas de synchronisation entre appareils,
  ce n'était pas demandé dans la version actuelle) ;
- les photos d'emploi du temps sont automatiquement compressées avant
  d'être enregistrées, pour ne pas saturer l'espace de stockage.

## Déploiement sur GitHub Pages

1. Crée un nouveau dépôt GitHub (public), par exemple `scolaire-app`.
2. Colle tous les fichiers de ce zip **à la racine** du dépôt (pas
   dans un sous-dossier), en conservant l'arborescence telle quelle.
3. Commit puis push.
4. Sur GitHub : **Settings → Pages**.
   - Source : `Deploy from a branch`
   - Branch : `main` (ou `master`), dossier `/ (root)`
   - Enregistre.
5. Après une minute ou deux, ton app est en ligne à l'adresse
   `https://<ton-nom-utilisateur>.github.io/<nom-du-depot>/`.

GitHub Pages sert le site en HTTPS par défaut, ce qui est **obligatoire**
pour qu'une PWA fonctionne (installation, mode hors-ligne).

## Installer l'app sur ton téléphone

- **iPhone (Safari)** : ouvre le lien → bouton Partager → *Sur l'écran
  d'accueil*.
- **Android (Chrome)** : ouvre le lien → menu ⋮ → *Installer
  l'application* (ou une bannière d'installation apparaît
  automatiquement).

Une fois installée, l'icône (ton logo) apparaît comme une vraie app,
sans barre d'adresse.

## Mettre à jour l'app après modification du code

Le service worker garde une copie hors-ligne des fichiers. Si tu
modifies le code plus tard et que l'app installée n'affiche pas les
changements :

1. Ouvre `sw.js`.
2. Change le numéro de version en haut du fichier, par exemple
   `scolaire-cache-v1` → `scolaire-cache-v2`.
3. Repush sur GitHub.

Cela force les téléphones à retélécharger les nouveaux fichiers au
prochain lancement de l'app.

## Ce qui est géré (et ce qui ne l'est pas)

Géré : les 3 menus décrits, navigation par le logo et la barre du bas,
appui long pour valider un devoir, mode "semaine prochaine", photos
d'emploi du temps, activités Thrive par jour, évaluations avec moyenne
automatique, notes personnelles, thème sombre/clair, changement de
langue FR/EN.

Non géré volontairement (pour rester simple, comme demandé) :
synchronisation multi-appareils, comptes utilisateurs, notifications,
export/sauvegarde des données. Si tu veux ces fonctionnalités plus
tard, elles peuvent s'ajouter sans tout reconstruire — n'hésite pas à
demander.
