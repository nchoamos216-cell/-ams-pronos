# AMS Pronos

Plateforme 100% gratuite de pronostics statistiques football basée sur
l'historique des confrontations directes (H2H) et la détection d'anomalies.

## Stack

- **Frontend/Backend** : Next.js 14 (App Router, TypeScript, Tailwind)
- **Hébergement** : Vercel (tier gratuit)
- **Base de données** : Supabase / PostgreSQL (tier gratuit)
- **Collecte de données** : Python + GitHub Actions (cron quotidien gratuit)

## Mise en route — pas à pas

### 1. Supabase

1. Crée un projet gratuit sur [supabase.com](https://supabase.com).
2. Ouvre **SQL Editor** et exécute le contenu de `supabase/schema.sql`.
3. Récupère dans **Project Settings → API** :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ à garder secrète, jamais côté client)

### 2. Source de données (script Python)

1. Crée une clé gratuite sur [football-data.org](https://www.football-data.org/client/register)
   (tier gratuit : compétitions majeures, 10 req/min).
2. Dans les paramètres du dépôt GitHub : **Settings → Secrets and variables → Actions**,
   ajoute :
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `FOOTBALL_DATA_API_KEY`
3. Le workflow `.github/workflows/cron.yml` s'exécute automatiquement chaque nuit
   à 03h00 UTC, et peut aussi être lancé manuellement depuis l'onglet **Actions**
   (bouton "Run workflow").
4. Teste-le en local avant de déployer :
   ```bash
   cd scripts
   pip install -r requirements.txt
   export SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... FOOTBALL_DATA_API_KEY=...
   python scraper.py
   ```

### 3. Génération des pronostics

La route `app/api/generate-predictions/route.ts` lit `h2h_history` + `team_form`,
exécute l'algorithme (`lib/pronostic-algorithm.ts`) et écrit dans `predictions`.

- En production, elle est déclenchée automatiquement par le **Vercel Cron**
  défini dans `vercel.json` (tous les jours à 03h30 UTC, juste après le scraping).
- Le plan gratuit Vercel Hobby autorise les Cron Jobs avec une fréquence
  minimale d'une fois par jour — le fichier `vercel.json` respecte cette limite.
- Tu peux aussi la déclencher manuellement : `curl https://ton-app.vercel.app/api/generate-predictions`

### 4. Déploiement Next.js sur Vercel

1. Pousse le dépôt sur GitHub.
2. Sur [vercel.com](https://vercel.com), importe le dépôt.
3. Ajoute les variables d'environnement (Project Settings → Environment Variables) :
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
4. Déploie — Vercel détecte automatiquement Next.js.

### 5. En local

```bash
npm install
cp .env.example .env.local   # puis renseigne les valeurs
npm run dev
```

## Structure du projet

```
ams-pronos/
├── app/
│   ├── page.tsx                        # Dashboard principal (matchs du jour + filtres)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/generate-predictions/route.ts
├── components/
│   ├── MatchCard.tsx                   # Carte de match détaillée
│   └── DashboardFilters.tsx            # Filtres compétition / date / type
├── lib/
│   ├── pronostic-algorithm.ts          # Moteur de détection d'anomalies + Poisson
│   └── supabase.ts
├── types/index.ts
├── scripts/
│   ├── scraper.py                      # Collecte + peuplement Supabase
│   └── requirements.txt
├── supabase/schema.sql
├── .github/workflows/cron.yml
└── vercel.json
```

## Logique de l'algorithme (résumé)

1. **Détection de série (streak)** : pour chaque marché (BTTS, +2.5 buts,
   victoire domicile, carton rouge), on compte le nombre de confrontations
   H2H consécutives (les plus récentes en premier) où l'événement ne s'est
   **pas** produit.
2. **Seuil de suggestion** : dès que la série atteint 2 matchs consécutifs,
   le marché est proposé comme pronostic.
3. **Modèle de Poisson** : à partir des moyennes de buts marqués/encaissés
   à domicile/extérieur (table `team_form`), on estime λ_domicile et λ_extérieur,
   puis on calcule par grille de Poisson bivariée les probabilités de BTTS,
   +2.5 buts et victoire à domicile.
4. **Score de confiance** : combinaison pondérée (60% série H2H / 40%
   probabilité Poisson), normalisée sur 100.

## Limites du tier gratuit à connaître

- **football-data.org (free)** : ~10 requêtes/minute, compétitions limitées.
  Remplaçable par du scraping Playwright si besoin de plus de couverture.
- **Supabase free** : 500 Mo de base de données, projet mis en pause après
  7 jours d'inactivité (une requête suffit à le réactiver).
- **GitHub Actions** : 2000 minutes/mois gratuites sur dépôt privé (illimité
  sur dépôt public) — un run quotidien de ce script consomme quelques minutes.
- **Vercel Hobby Cron** : fréquence minimale d'un run par jour.
