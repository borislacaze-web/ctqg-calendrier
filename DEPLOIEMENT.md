# Guide de déploiement — CTQG Calendrier Général

## Ce que vous aurez à la fin

Une application web accessible à l'URL `calendrier.ctqg-basket.fr` (ou équivalent) :
- Base de données PostgreSQL chez Supabase (gratuit jusqu'à 500 Mo)
- Application Next.js hébergée chez Vercel (gratuit)
- Stockage des fichiers PDF chez Supabase Storage (gratuit jusqu'à 1 Go)

---

## ÉTAPE 1 — Créer le projet Supabase

1. Aller sur **https://supabase.com** → cliquer **Start your project**
2. Créer un compte (ou se connecter avec GitHub)
3. Cliquer **New project**
4. Remplir :
   - **Name** : `ctqg-calendrier`
   - **Database Password** : choisir un mot de passe fort et le noter
   - **Region** : `West EU (Paris)` ← important pour la latence
5. Cliquer **Create new project** → attendre ~2 minutes

---

## ÉTAPE 2 — Créer le schéma de la base de données

1. Dans votre projet Supabase, aller dans **SQL Editor** (menu gauche)
2. Cliquer **New query**
3. Copier-coller le contenu du fichier `supabase_schema.sql`
4. Cliquer **Run** (▶)
5. Vérifier que le message "Success" s'affiche en bas

Puis faire de même avec `supabase_storage.sql` :
1. **New query**
2. Copier-coller `supabase_storage.sql`
3. **Run**

> ✅ Si vous voyez des erreurs sur `auth.users`, c'est normal : Supabase gère cette table en interne. Re-essayez sans la ligne concernée.

---

## ÉTAPE 3 — Récupérer les clés API Supabase

1. Dans votre projet Supabase → **Settings** (engrenage en bas à gauche) → **API**
2. Noter :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon public** key : `eyJhbGc...` (longue chaîne)

Ces deux valeurs seront nécessaires à l'étape 5.

---

## ÉTAPE 4 — Créer le compte administrateur

1. Dans Supabase → **Authentication** → **Users**
2. Cliquer **Add user** → **Create new user**
3. Remplir l'email et un mot de passe sécurisé
4. Après création, noter l'**UUID** de l'utilisateur (colonne "UID")
5. Aller dans **SQL Editor** → exécuter :

```sql
UPDATE user_profiles
SET role = 'admin'
WHERE id = 'COLLER_L_UUID_ICI';
```

> ⚠️ L'UUID ressemble à : `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

---

## ÉTAPE 5 — Déployer l'application sur Vercel

### 5a. Héberger le code sur GitHub

1. Créer un compte GitHub si besoin : https://github.com
2. Créer un nouveau dépôt (bouton **+** → **New repository**)
   - Nom : `ctqg-calendrier`
   - Visibilité : **Private** (recommandé)
3. Sur votre ordinateur, dans le dossier `ctqg-calendrier` :

```bash
# Si Git n'est pas installé, télécharger sur https://git-scm.com
git init
git add .
git commit -m "Initial commit — CTQG Calendrier"
git remote add origin https://github.com/VOTRE_NOM/ctqg-calendrier.git
git push -u origin main
```

### 5b. Déployer sur Vercel

1. Aller sur **https://vercel.com** → créer un compte (avec GitHub)
2. Cliquer **Add New Project**
3. Sélectionner votre dépôt `ctqg-calendrier`
4. Dans la section **Environment Variables**, ajouter :

| Nom | Valeur |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Votre URL Supabase (étape 3) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Votre clé anon (étape 3) |

5. Cliquer **Deploy** → attendre ~3 minutes
6. Votre application est disponible sur `ctqg-calendrier.vercel.app`

---

## ÉTAPE 6 — (Optionnel) Domaine personnalisé

Pour accéder via `calendrier.ctqg-basket.fr` :

1. Dans Vercel → votre projet → **Settings** → **Domains**
2. Ajouter `calendrier.ctqg-basket.fr`
3. Vercel vous donne un enregistrement DNS à ajouter chez votre registrar (OVH, Gandi, etc.)
4. Dans votre interface DNS, ajouter l'enregistrement CNAME indiqué
5. Attendre 5–30 minutes pour la propagation DNS

---

## ÉTAPE 7 — Vérification finale

1. Ouvrir votre URL (ex: `ctqg-calendrier.vercel.app`)
2. Le calendrier vide de la saison 2026/2027 doit s'afficher
3. Aller sur `/login`, se connecter avec le compte admin (étape 4)
4. Le bouton **Admin** doit apparaître dans la barre de navigation
5. Aller dans **Admin → Tableau de bord** pour vérifier les stats
6. Créer un premier événement test

---

## Mises à jour futures

Pour mettre à jour l'application après modification du code :

```bash
git add .
git commit -m "Description de la modification"
git push
```

Vercel détecte automatiquement le push et redéploie en ~2 minutes.

---

## Résolution de problèmes courants

**"RLS policy error" dans Supabase**
→ Vérifier que l'utilisateur a bien le rôle `admin` dans `user_profiles`

**Les événements ne s'affichent pas**
→ Vérifier dans Supabase → Table Editor → `events` que des données existent
→ Vérifier que la saison est bien `is_active = true`

**"Unauthorized" lors de l'upload de documents**
→ Vérifier que le bucket `event-documents` existe dans Storage
→ Re-exécuter `supabase_storage.sql`

**L'application ne démarre pas (erreur Vercel)**
→ Vérifier les variables d'environnement dans Vercel Settings
→ Vérifier les logs de build dans Vercel → votre projet → Deployments

---

## Sauvegardes

Supabase inclut des sauvegardes automatiques quotidiennes (plan gratuit : 7 jours).

Pour une sauvegarde manuelle :
- Dans Supabase → **Settings** → **Database** → **Backups**

En complément, l'export Excel de l'application sert de sauvegarde fonctionnelle
des événements, réimportable directement.
