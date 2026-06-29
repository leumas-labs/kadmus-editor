# 🚀 Rétrospective Technique & Exploits : Kadmus Editor

Ce document retrace l'épopée de conception, les choix techniques stratégiques, et les exploits d'ingénierie accomplis lors de la création de **Kadmus Editor**. Il sert de mémoire technique pour guider tout développeur ou assistant IA (comme Claude) qui reprendra ce projet.

---

## 🌟 La Vision Originelle : Tuer l'Obésité Logicielle (Electron)
Aujourd'hui, pour afficher un éditeur de texte et un terminal, des logiciels comme VS Code ou Slack embarquent **Electron** (qui contient tout Chromium et Node.js), consommant plus de 300 Mo de RAM au repos et pesant des centaines de mégaoctets.

**L'objectif de Kadmus Editor** : Créer un éditeur de code moderne, fluide, sécurisé, extensible et doté d'une IA, en divisant l'empreinte mémoire par 5 et la taille du binaire par 1000.

---

## 🏗️ L'Évolution de la Stack : Les Grandes Transitions

### Étape 1 : Le Rendu Vectoriel Bas Niveau (Cairo + X11)
Nous avons commencé par explorer un rendu graphique vectoriel dessiné pixel par pixel en C++ avec **Cairo** et **X11**. 
* *Le Résultat* : Une maquette d'interface de 57 Ko hyper-rapide.
* *La Réflexion* : Recréer à la main la physique du défilement (scrolling), le double-clic pour sélectionner du texte, et la saisie multilingue (IME) aurait nécessité des années de développement.

### Étape 2 : Le Modèle Hybride WebView Système (Type Tauri)
Pour rester maintenable sans réinventer la roue graphique, nous avons pivoté vers une architecture hybride :
1. **L'Interface Graphique** : Écrite en **HTML/CSS/TypeScript** (compilée avec Vite), exploitant la puissance d'**Monaco Editor** (le cœur de VS Code) et d'**xterm.js**.
2. **Le Moteur de Rendu** : La **WebView native déjà intégrée au système d'exploitation** (Edge/WebView2 sous Windows, WebKitGTK sous Linux, Safari/WKWebView sous macOS).
3. **Le Backend** : Un moteur système écrit en **C++20** pur.

---

## 💎 Les Exploits Majeurs d'Ingénierie C++

### 1. Le Binaire Unique de 486 Ko
Nous avons fusionné le backend C++ (WebSocket, PTY, Git) et le lanceur de fenêtre WebKitGTK en **un seul binaire exécutable de 486 Ko** nommé `kadmus`. Un double-clic dessus lance le serveur et affiche l'interface instantanément.

### 2. Le Protocole WebSocket "Zéro Dépendance" (RFC 6455)
Le backend C++ implémente manuellement l'échange de clés HTTP (handshake SHA-1 + Base64) et le décodage par masquage XOR des trames réseau WebSocket. Aucun framework réseau lourd (comme Boost.Asio) n'a été utilisé.

### 3. La Résolution du Bug UTF-8 (IOT instruction / Core Dump)
Lors de l'exécution de la commande `tree` dans le terminal, les caractères Unicode de trame coupés aux frontières de blocs provoquaient un crash de sérialisation JSON. Nous avons configuré un mécanisme de remplacement automatique (U+FFFD ``) pour garantir une stabilité totale sans crash.

### 4. Git et Extensions en C++ Natif
* Intégration de la bibliothèque **`libgit2`** en C++ pour lister le statut des fichiers, indexer (`stage`) et commiter directement.
* Intégration d'un **`ExtensionService`** capable de décompresser des archives ZIP d'extensions VS Code `.vsix` pour lire leurs manifestes déclaratifs de thèmes.

---

## ⚡ Le Fait le Plus Excitant du Projet
**L'IDE complet tourne dans moins de 80 Mo de mémoire vive avec un binaire unifié de 486 Ko !**
Nous avons réconcilié deux mondes : la productivité infinie du Web (possibilité d'importer n'importe quel thème ou extension de VS Code dans Monaco Editor) avec l'efficacité brute et la légèreté absolue du C++.
