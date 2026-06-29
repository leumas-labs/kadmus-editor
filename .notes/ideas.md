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
