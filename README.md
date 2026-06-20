# 📝 Memo - Projet ComptaTVA-Auto

Ce document sert de manuel d'utilisation et de survie pour l'application **ComptaTVA-Auto**, afin de pouvoir la redéployer, la modifier ou la mettre à jour facilement, même dans plusieurs mois.

Cette application a été créée et assistée par l'IA **Antigravity**.

## 📂 Architecture et Fichiers

Le projet est hébergé localement sur votre PC dans :
`D:\OneDrive\Documents\1. Projets & Création\3DMatch\01 - Administration\Docker_compta\ComptaTVA-Auto`

### Ce qui est sauvegardé sur GitHub (Le code source)
Ces fichiers sont versionnés sur GitHub et peuvent être retéléchargés de n'importe où sans risque :
* **Code React / Frontend** : `App.tsx`, `index.html`, `index.tsx`, `components/`, `utils/`, `types.ts`
* **Serveur Node.js** : `server.js` (gère la communication avec l'API Gemini)
* **Configuration Docker** : `Dockerfile`, `docker-compose.yml`
* **Dépendances** : `package.json`

### ⚠️ Fichiers SENSIBLES et NON SAUVEGARDÉS sur Git
Ces fichiers sont volontairement exclus de GitHub via le fichier `.gitignore` pour des raisons de sécurité ou de personnalisation. **Si vous changez de PC, il faudra les recréer ou les copier manuellement !**

1. **`.env`** : Fichier contenant votre clé secrète Google Gemini. 
   *(Format : `GEMINI_API_KEY=AQ.Ab8RN6...`)*
2. **`data/rules.json`** : C'est votre base de données personnelle contenant toutes vos règles de catégorisation mémorisées. **Il ne faut pas le perdre !**
3. **`node_modules/`** et **`dist/`** : Dossiers très lourds regénérés automatiquement par Docker. Ne jamais s'en soucier.

---

## 🚀 Mise en place sur le NAS Synology

L'application tourne sur votre NAS via **Container Manager** (anciennement Docker).

### 1. Installation Initiale (ou après réinstallation totale)
1. Copiez les fichiers du projet sur le NAS (ex: dans `/volume1/@appdata/ContainerManager/all_shares/docker/ComptaTVA-Auto`).
2. **CRUCIAL** : Assurez-vous de copier manuellement le fichier `.env` et le dossier `data/` depuis votre PC vers ce dossier NAS (Git ne les a pas copiés).
3. Connectez-vous en SSH au NAS et tapez :
   ```bash
   cd /volume1/@appdata/ContainerManager/all_shares/docker/ComptaTVA-Auto
   sudo docker compose build
   sudo docker compose up -d
   ```
4. L'application est alors dispo sur `http://IP_DU_NAS:3030` (Le port externe configuré dans le `docker-compose.yml`).

### 2. Procédure de Mise à Jour via Git (Le plus fréquent)
Si vous modifiez le code depuis votre PC (ou avec une IA) et que vous l'envoyez sur GitHub (`git push`), voici comment mettre à jour le NAS sans perdre vos données :

Connectez-vous en SSH au NAS et tapez :
```bash
cd /volume1/@appdata/ContainerManager/all_shares/docker/ComptaTVA-Auto
git pull origin master
sudo docker compose build
sudo docker compose up -d
```
> **Note** : Vos règles personnalisées sont dans le dossier `data/` qui n'est pas touché par `git pull`. Vos données sont donc préservées à chaque mise à jour !

---

## 🛠️ Aide-mémoire Git (Sur votre PC Windows)

Si vous faites des modifications dans le code sur votre PC et que vous voulez les "sauvegarder" dans l'historique et sur le cloud GitHub :

Ouvrez un terminal PowerShell dans le dossier du projet et tapez :
```bash
git add .
git commit -m "Description de ce que vous avez modifié"
git push
```

## 🔄 Revenir en arrière sur le PC (Annuler des bêtises)
Si vous avez cassé le code sur votre PC et que vous voulez tout remettre comme lors de la dernière sauvegarde fonctionnelle (dernier Commit) :
```bash
git reset --hard
```
*(Attention, cela effacera toutes les modifications non sauvegardées par un commit).*
