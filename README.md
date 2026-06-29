# IS - Interface Studio Backend (CEBackend)

Ce dossier contient le prototype de backend natif en C++20 pour **Interface Studio (IS)**.

## Fonctionnalités implémentées

1. **Réseau (WebSocket Server)** :
   * Serveur TCP brut gérant le protocole WebSocket (RFC 6455).
   * Handshake avec calcul d'empreinte SHA-1 et encodage Base64 natif.
   * Décodage et encodage des trames (XOR mask).
2. **Système de fichiers (FileSystem Service)** :
   * Exploration et lecture/écriture des fichiers via `std::filesystem`.
   * **Sécurité** : Protection anti-traversée de dossiers (Directory Traversal Protection) limitant les lectures/écritures au dossier du Workspace.
3. **Terminaux (Terminal Manager)** :
   * Allocation asynchrone de pseudoterminaux (PTY) sous Linux/macOS via `forkpty`.
   * Stubs d'architecture prévus pour l'intégration de ConPTY (Windows).
4. **Agent d'IA (Agent Service)** :
   * Simulation asynchrone multithreadée de l'assistant d'IA de Kadmus.
5. **JSON-RPC 2.0 Router** :
   * Aiguillage des messages entrés et formatage des réponses JSON sécurisées.

---

## Compiler & Executer
```bash
make
./ce-backend
```
