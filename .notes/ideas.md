# 💡 Idées d'Ingénierie Full-Stack — Kadmus Editor

Ce document liste nos idées de conception et les prochains défis techniques pour poursuivre le développement de **Kadmus Editor**.

---

## 1. Runtime de l'Extension Host (Exécution JavaScript)

### Concept
VS Code exécute les extensions dans un processus séparé appelé l'**Extension Host**. Pour Kadmus, nous pouvons réutiliser cette idée en C++ :
* **Approche processus externe** : Lancer un micro-runtime JS (comme **Bun** ou **Node.js**) dans un processus fils supervisé par notre backend. Ce processus se connecte à notre serveur WebSocket local (`ws://localhost:9888`) pour interagir avec le système de fichiers, l'éditeur et le terminal.
* **Avantage** : Permet de faire tourner 100 % des extensions JS/TS de VS Code de manière isolée sans alourdir le binaire C++ `kadmus`.

---

## 2. Service de Coloration Syntaxique & Thèmes (TextMate)

### Concept
L'intégrateur d'extensions (`ExtensionService`) charge les manifestes `package.json`. 
Nous pouvons aller plus loin en lisant les fichiers de thèmes (`.json` / `.tmTheme`) et de syntaxes (`.tmLanguage` ou TextMate grammars) inclus dans les extensions installées et :
* Les envoyer au frontend via l'API WebSocket.
* Configurer **Monaco Editor** dynamiquement (`monaco.editor.defineTheme` et register tokenizers) pour appliquer instantanément les thèmes importés depuis l'écosystème VS Code.

---

## 3. Serveur d'Assets HTTP Intégré en C++

### Concept
Bien que le chargement local par `file://` fonctionne grâce aux permissions de sécurité WebKit, il présente des limitations (par exemple, impossibilité d'enregistrer des Service Workers dans certains navigateurs).
* **Idée** : Ajouter un micro-serveur HTTP de fichiers statiques directement dans notre `WebSocketServer.cpp` (sur le même port, par exemple, en distinguant les requêtes HTTP standard des demandes de protocole WebSocket `Upgrade`).
* **Avantage** : L'interface se chargerait sur `http://localhost:9888/` de manière standard, garantissant une sécurité d'origine 100 % propre et une compatibilité absolue avec toutes les API web locales.

---

## 4. Pipeline de Redimensionnement du Terminal (PTY Resize)

### Concept
* **Idée** : Raccorder l'événement `term.onResize` d'xterm.js sur le frontend pour envoyer un message JSON-RPC `term_resize` (que nous avons déjà écrit dans notre routeur).
* Le backend appelle `TerminalSession::resize(cols, rows)` qui utilise l'appel système `ioctl(pty_master_fd, TIOCSWINSZ, &ws)` pour ajuster la grille de caractères du shell en temps réel lors du redimensionnement de la fenêtre GTK de l'éditeur.

---

## 5. Intégration Native de Llama.cpp (IA Locale Privée)

### Concept
Pour faire de Kadmus un éditeur "AI-First" entièrement privé et fonctionnel hors-ligne, nous pouvons intégrer directement **`llama.cpp`** :
* **Liaison statique** : Compiler `llama.cpp` sous forme de bibliothèque statique (`libllama.a`) et la lier directement à notre binaire unique `kadmus`.
* **Modèle léger** : Charger des modèles GGUF ultra-légers et optimisés pour le code (comme *Qwen-2.5-Coder-1.5B* ou *DeepSeek-Coder-1.5B*). Ces modèles font moins de 1,5 Go, consomment peu de RAM et s'exécutent très vite sur CPU (via AVX2) ou GPU (via CUDA/Vulkan).
* **Streaming asynchrone** :
  1. L'utilisateur pose une question dans le panneau de chat ou demande une autocomplétion (Tab).
  2. Le backend C++ reçoit la requête, la pousse dans une file d'attente d'inférence, et génère les tokens en tâche de fond dans un thread dédié pour ne pas bloquer l'UI.
  3. Les morceaux de texte générés sont poussés en temps réel vers le frontend via WebSocket au format JSON-RPC.
* **Avantage** : Confidentialité absolue (aucun code ne quitte la machine de l'utilisateur), coûts d'API nuls, et indépendance totale vis-à-vis des connexions réseau.

---

## 6. Opérations Fichiers Sécurisées & Backups (Inspiré de BISSI)

### Concept
En s'inspirant de la logique du module **`SafeOperator`** développé pour **BISSI** (`~/Dev/Hackathons/gemma4good/bissi/functions/`), nous pouvons implémenter un gardien de fichiers robuste dans notre C++ `FileSystemService` :
* **Sauvegardes automatiques (Backups)** : Avant chaque écriture destructive (`fs_write`, modification, renommage, suppression), le backend effectue automatiquement une copie de sauvegarde horodatée dans un dossier masqué `.kadmus_backups/` local au fichier d'origine.
* **Historique d'audit (Audit Trail)** : Tenir un journal JSON local des opérations réussies et échouées, utile pour les audits de sécurité et la traçabilité.
* **Rollback natif** : Exposer un endpoint JSON-RPC `fs_rollback` permettant de restaurer instantanément un fichier à sa version de sauvegarde précédente en un clic depuis l'UI.
* **Confirmation par Dialogue** : Pour toute opération destructive (comme supprimer un fichier du workspace), le backend renvoie une demande de confirmation intermédiaire qui bloque l'action jusqu'à ce que l'utilisateur clique sur "Confirmer" sur l'interface graphique.
* **Avantage** : Sécurité maximale contre les pertes accidentelles de données, protection contre les modifications erronées d'un agent IA autonome, et historique d'annulation (Undo) persistant hors-mémoire.
