# CTQG — Calendrier Général

Application web de gestion du calendrier sportif du Comité Territorial Quercy Garonne.

## Stack technique

- **Frontend** : Next.js 14 (App Router) + React + TailwindCSS
- **Base de données** : Supabase (PostgreSQL)
- **Authentification** : Supabase Auth
- **Stockage fichiers** : Supabase Storage
- **Hébergement** : Vercel

## Structure du projet

```
ctqg-calendrier/
├── app/                    # Pages Next.js (App Router)
│   ├── page.tsx            # Vue Planning (page d'accueil)
│   ├── login/              # Page de connexion
│   ├── list/               # Vue Liste
│   ├── calendar/           # Vue Calendrier
│   └── admin/
│       ├── dashboard/      # Tableau de bord admin
│       ├── categories/     # Gestion catégories
│       ├── seasons/        # Gestion saisons
│       └── import/         # Import Excel
├── components/
│   ├── layout/             # Navbar, SeasonSelector
│   ├── planning/           # PlanningView, ListView
│   ├── events/             # EventModal, EventForm
│   └── filters/            # FilterBar
├── hooks/
│   └── useCalendarData.ts  # Hooks Supabase
├── lib/
│   ├── supabase/           # Clients Supabase (client + serveur)
│   ├── week-utils.ts       # Calcul semaines sportives
│   ├── excel-utils.ts      # Export/import Excel
│   └── pdf-utils.ts        # Export PDF
├── types/
│   └── index.ts            # Types TypeScript
├── supabase_schema.sql     # Schéma base de données
├── supabase_storage.sql    # Configuration Storage
└── DEPLOIEMENT.md          # Guide de déploiement pas à pas
```

## Installation locale (développement)

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env.local
# Remplir les valeurs Supabase dans .env.local

# 3. Lancer le serveur de développement
npm run dev
```

Ouvrir http://localhost:3000

## Fonctionnalités

### Public (sans connexion)
- Vue Planning (grille semaines × catégories, fidèle à l'Excel existant)
- Vue Liste chronologique
- Recherche et filtres (catégorie, mois, mot-clé)
- Export PDF et Excel
- Sélection de saison

### Administrateur CTQG
- Créer, modifier, supprimer des événements
- Gérer les catégories et sous-catégories
- Gérer les saisons
- Importer un calendrier depuis Excel
- Tableau de bord avec statistiques
- Historique des modifications

## Déploiement

Voir [DEPLOIEMENT.md](./DEPLOIEMENT.md) pour le guide complet pas à pas.

## Évolutions prévues (V2)

- Vue Calendrier (mois/semaine/jour type Google Agenda)
- Synchronisation Google Agenda / Outlook
- Notifications email
- Application mobile
- Gestion des inscriptions
