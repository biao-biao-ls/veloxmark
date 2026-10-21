---
title: Mise à jour automatique
description: Comment VeloxMark se met à jour selon la forme d'installation — mise à jour entièrement automatique sur Windows NSIS et Linux AppImage, notification seule ailleurs, repli manuel.
keywords: [mise à jour automatique VeloxMark, electron-updater, mise à jour AppImage, mise à jour NSIS, mise à jour manuelle]
---

# Mise à jour automatique

VeloxMark vérifie [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)
pour les nouvelles versions et route la mise à jour différemment selon la façon dont vous
l'avez installé.

## Comportement par forme d'installation

| Forme d'installation | Comportement de mise à jour |
| --- | --- |
| Installateur NSIS Windows | Vérification complète → téléchargement → invite → installation au redémarrage |
| AppImage Linux | Vérification complète → téléchargement → invite → installation au redémarrage |
| macOS (dmg / zip) | Vérification seule — le build non signé ne peut pas terminer les mises à jour Squirrel.Mac, l'application ouvre donc la page des versions |
| Zip portable / deb / rpm / snap / tar.gz | Notification seule — une nouvelle version est annoncée et liée |
| Mode dev (`npm run dev`) | Notification seule |

Après la fin d'un téléchargement, **l'application demande votre accord avant de quitter
pour installer** — rien ne se passe dans votre dos.

## Vérifier manuellement

Utilisez **Aide → Vérifier les mises à jour** dans le menu de l'application. Sur les
formes d'installation en notification seule, cela ouvre ou vous oriente vers la page des
versions.

## Manifestes de mise à jour

Les assets de version incluent les manifestes electron-updater (`latest.yml`,
`latest-mac.yml`, `latest-linux.yml`, `latest-linux-arm64.yml`) et `SHA256SUMS.txt`. Le
`path` du manifeste Windows pointe vers l'installateur universel
`VeloxMark-Setup-<ver>.exe`.

## Si une mise à jour échoue

1. Vérifiez votre réseau / proxy — les mises à jour proviennent de GitHub Releases.
2. Vérifiez le téléchargement manuellement par rapport à `SHA256SUMS.txt`
   (voir [Installation](./installation#verifier-le-telechargement)).
3. Repartez d'une installation neuve depuis la
   [page des versions](https://github.com/biao-biao-ls/veloxmark/releases) — vos réglages
   et brouillons sont conservés.
