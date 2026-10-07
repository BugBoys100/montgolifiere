# Montgolfière — Simulation physique 3D

Simulation interactive de montgolfière (Three.js + moteur thermo-mécanique) avec HUD, time-warp et autopilote PID.

## Lancer

```bash
npm install
npm run dev
```

Ouvrir l’URL affichée par Vite (souvent `http://localhost:5173`).

## Contrôles

- **Espace** ou bouton **Brûleur** : chauffer manuellement (désactivé en mode autopilote).
- **Slider temps** : ×1, ×2, ×5, ×10 sur le pas de simulation.
- **Autopilote** : altitude cible en mètres, toggle IA.
- **Caméra** : orbite autour de la nacelle (souris).

## Architecture

- `src/PhysicsEngine.js` — forces, thermique, intégration, PID
- `src/Scene3D.js` — rendu Three.js
- `src/UIController.js` — overlay HUD
- `src/config.js` — constantes et `Environment` (prévu pour `windVector`)
