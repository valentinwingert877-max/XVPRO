# 🚀 Déployer XVPRO — Guide pas à pas

Durée estimée : **20-30 minutes**
Coût : **0€** (free tiers suffisants pour démarrer)

---

## Étape 1 — Créer le projet Supabase (10 min)

### 1.1 Créer le projet

1. Va sur **https://supabase.com** → "Start your project"
2. Connecte-toi avec GitHub
3. Clique **"New project"**
4. Remplis :
   - Name : `xvpro`
   - Database Password : note-le quelque part
   - Region : **West EU (Ireland)**
5. Clique **"Create new project"** (prend ~2 min)

### 1.2 Créer le schéma DB

1. Dans le dashboard Supabase → **SQL Editor** (icône base de données à gauche)
2. Clique **"New query"**
3. Copie-colle le contenu de `supabase/schema.sql`
4. Clique **"Run"** ✅

### 1.3 Créer le bucket Storage (pour les vidéos)

1. Dans Supabase → **Storage** → **New bucket**
2. Name : `match-videos`
3. Coche **"Public bucket"** → Save
4. Dans le bucket → **Policies** → **New policy** → "Allow full access for authenticated users"

### 1.4 Récupérer les clés API

1. Dans Supabase → **Settings** (engrenage) → **API**
2. Note :
   - **Project URL** : `https://xxxxx.supabase.co`
   - **anon public** key : `eyJhbGciO...`

---

## Étape 2 — Déployer sur Vercel (10 min)

### 2.1 Pousser le code sur GitHub

```bash
# Dans le dossier XVPRO/apps/web
git init
git add .
git commit -m "XVPRO initial"
gh repo create xvpro --public --push
# (ou créer le repo manuellement sur github.com et faire git remote add + push)
```

### 2.2 Déployer sur Vercel

1. Va sur **https://vercel.com** → "Add New Project"
2. Connecte ton compte GitHub
3. Importe le repo `xvpro`
4. Configure :
   - **Framework Preset** : Next.js
   - **Root Directory** : `apps/web`
5. Dans **Environment Variables**, ajoute :
   ```
   NEXT_PUBLIC_SUPABASE_URL    = https://xxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciO...
   ```
6. Clique **Deploy** 🎉

Vercel te donne une URL du type : `https://xvpro-xxx.vercel.app`

---

## Étape 3 — Configurer l'auth Supabase

1. Dans Supabase → **Authentication** → **URL Configuration**
2. **Site URL** : `https://xvpro-xxx.vercel.app`
3. **Redirect URLs** : `https://xvpro-xxx.vercel.app/**`
4. Save

---

## ✅ C'est prêt !

Ton site est en ligne avec :
- ✅ Landing page publique
- ✅ Inscription / Connexion réelle (Supabase Auth)
- ✅ Dashboard avec vraies données
- ✅ Création de matchs en DB
- ✅ Upload de vidéos (Supabase Storage)
- ⏳ Analyse IA → prochaine étape (nécessite Anthropic API + worker GPU)

---

## Étape suivante — Ajouter l'IA

Une fois le site en ligne et validé :
1. Créer un compte **Modal.com** (GPU serverless)
2. Créer un compte **Anthropic** → obtenir une clé API
3. Déployer le worker `apps/worker/` sur Modal
4. Connecter le webhook Supabase → worker

→ Me demander et je génère tout ça automatiquement.
