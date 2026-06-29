# 🌌 Kadmus Editor — Native Hybrid IDE Engine

**Kadmus Editor** est une réinvention moderne et ultra-légère de l'environnement de développement de bureau. En remplaçant l'architecture lourde d'Electron (qui embarque tout Chromium et Node.js) par un binaire C++20 unifié combiné à une **WebView système**, Kadmus concilie le confort du développement Web (Monaco Editor, CSS, TypeScript) avec les performances brutes du bas niveau.

* **Taille du binaire unifié (`kadmus`)** : **486 Ko** (Backend + Serveur WebSocket + Lanceur graphique).
* **Consommation RAM (Idle)** : **< 80 Mo** (contre 300 Mo+ pour Electron/VS Code).
* **Vitesse de démarrage** : **Instantanée** (< 200 ms).

---

## 🏗️ Architecture du Projet

```
                     ┌────────────────────────────────┐
                     │     System WebView Window      │ (Windows: WebView2, Linux: WebKitGTK)
                     │ (HTML/CSS/JS Frontend Client)  │ (Monaco Editor, xterm.js, Lucide)
                     └──────────────┬─────────────────┘
                                    │
                                    │ JSON-RPC 2.0 sur WebSockets (Port 9888)
                                    ▼
                     ┌────────────────────────────────┐
                     │     Binaire Unique C++20       │ (Contrôle d'accès & Services natifs)
                     └─────┬───────────┬───────────┬──┘
                           │           │           │
                           ▼           ▼           ▼
                     ┌───────────┐ ┌───────────┐ ┌───────────┐
                     │ Filesystem│ │ Terminal  │ │    Git    │
                     │ (Protection│ │  (forkpty │ │ (libgit2  │
                     │  anti-    │ │  POSIX)   │ │  native)  │
                     │ traversal)│ │           │ │           │
                     └───────────┘ └───────────┘ └───────────┘
```

---

## ⚙️ Fonctionnalités Implémentées

1. **Binaire Unique & Autonome** : Lancement conjoint du serveur backend multithread et de l'interface WebView système en un seul processus.
2. **Terminal Virtuel `xterm.js`** : Véritable émulateur raccordé à des pseudoterminaux POSIX (`forkpty`), décodant nativement les codes d'échappement couleur ANSI.
3. **Sécurité d'Accès** : Génération de jetons d'accès cryptographiques jetables pour sécuriser la liaison WebSocket et protection intégrée contre la traversée de répertoires (`../`).
4. **Versioning Git Natif** : Intégration directe de la bibliothèque C **`libgit2`** permettant de lister le statut des fichiers, de faire du staging et de commiter localement.
5. **Intégration d'Extensions (VSIX)** : Scanner d'extensions de fichiers `.vsix` (ZIP) avec extraction automatique et lecture déclarative des contributions thématiques (`package.json`).
6. **IA Intégrée (Mock Asynchrone)** : Service d'assistant de chat piloté sur un thread secondaire d'exécution.

---

## 🚀 Installation & Lancement

### Prérequis (Linux)
Installez les bibliothèques de développement système :
```bash
sudo apt-get install -y libgit2-dev libgtk-3-dev libwebkit2gtk-4.1-dev unzip
```

### 1. Compilation du C++
Compilez le binaire unique à la racine du projet :
```bash
make
```

### 2. Compilation du Frontend (Vite)
Installez les modules et compilez les ressources statiques :
```bash
cd frontend
npm install
npm run build
cd ..
```

### 3. Exécution

* **Mode Application (WebView locale automatique)** :
  ```bash
  ./kadmus
  ```
  *(Le binaire lance le serveur de fond et ouvre l'interface compilée de manière transparente).*

* **Mode Développement (Hot-Reload)** :
  Lancez le serveur Vite de rafraîchissement à chaud :
  ```bash
  cd frontend && npm run dev
  ```
  Puis lancez Kadmus dans un autre terminal. Le binaire détectera l'absence de build de production ou chargera le port de dev :
  ```bash
  ./kadmus
  ```

* **Mode Headless (Serveur distant seul)** :
  Pour utiliser Kadmus sur un serveur distant sans interface graphique locale :
  ```bash
  ./kadmus --server-only --port 9000
  ```

---

## 🛠️ Options de la ligne de commande

```text
Options:
  --port <port>                 Port d'écoute du serveur WebSocket (par défaut: 9888)
  --workspace <chemin>          Dossier de travail ouvert dans l'éditeur
  --server-data-dir <chemin>    Dossier de stockage des extensions et logs (~/.interface-studio)
  --extensions-dir <chemin>     Dossier des extensions
  --connection-token <token>    Fixe le jeton de sécurité d'accès réseau
  --without-connection-token    Désactive la sécurité (déconseillé)
  -s, --server-only             Lance uniquement le serveur en arrière-plan sans UI
  -h, --help                    Affiche l'aide
```
