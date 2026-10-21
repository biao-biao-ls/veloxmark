---
title: Préférences
description: Tous les réglages VeloxMark avec leurs valeurs par défaut — thème, polices de l'éditeur, aides à la saisie, enregistrement automatique et récupération après incident, images et pièces jointes, langue.
keywords: [réglages VeloxMark, préférences éditeur, enregistrement automatique, récupération après incident, taille de police, dossier de pièces jointes]
---

# Préférences

Ouvrez les préférences avec `Ctrl+,` (`Cmd+,` sur macOS) ou via le menu **Fichier →
Préférences**. Les réglages sont conservés d'une session à l'autre.

## Apparence

| Réglage | Défaut | Description |
| --- | --- | --- |
| Thème | Système | `clair` / `sombre` / suivre le système. Basculé dans le menu Affichage. |
| Police de l'éditeur | Pile système | Famille de polices de la zone d'écriture. |
| Taille de police | 16 | Taille de police de l'éditeur en pixels. |
| Hauteur de ligne | 1.6 | Hauteur de ligne de l'éditeur. |
| Largeur de la colonne de contenu | 0 (auto) | Largeur de ligne maximale de la colonne d'écriture ; `0` laisse l'application choisir. |
| Afficher la barre d'état | Activé | Position du curseur, compteurs et indicateurs de mode. |
| Barre latérale ouverte par défaut | Activé | Quand aucune session précédente n'est mémorisée. |

## Éditeur

| Réglage | Défaut | Description |
| --- | --- | --- |
| Aides à la saisie | Activé | Poursuite de liste, promotion de titre, transformations au collage. |
| Envelopper les URL nues au collage | Activé | Transformer une URL nue collée en lien Markdown. |
| Convertir le HTML au collage | Activé | Convertir le texte enrichi collé en Markdown propre. |
| Formater à l'enregistrement | Désactivé | Normaliser le Markdown (espacement, marqueurs de liste, alignement des tableaux) avant l'écriture. |
| Afficher les numéros de ligne | Désactivé | Gouttière de numéros de ligne dans l'éditeur. |
| Numéros de ligne dans les blocs de code | Désactivé | Rendre les numéros de ligne dans les composants de bloc de code. |
| Retour à la ligne doux dans les blocs de code | Activé | Remplacer les longues lignes dans les blocs de code. |
| Seuil de pliage des blocs de code | 20 lignes | Les blocs plus longs se replient avec un contrôle de dépliage ; `0` désactive. |
| Mode focus | Désactivé | Atténuer tout sauf la région courante. |
| Mode machine à écrire | Désactivé | Garder la ligne du curseur verrouillée sur le centre vertical. |
| Mode source | Désactivé | Toujours afficher le Markdown brut. |

## Fichiers

| Réglage | Défaut | Description |
| --- | --- | --- |
| Enregistrement automatique | Anti-rebond (3 s) | `désactivé` / `anti-rebond` (quand la frappe s'arrête) / `intervalle` (toutes les N minutes). |
| Délai d'enregistrement automatique | 3 s | Délai anti-rebond pour le mode anti-rebond. |
| Intervalle d'enregistrement automatique | 5 min | Intervalle pour le mode intervalle. |
| Brouillons de récupération après incident | Activé | Conserver des brouillons des modifications non enregistrées et proposer une récupération après un incident. |
| Restaurer la dernière session | Activé | Rouvrir les onglets, dossiers et position du curseur au démarrage. |
| Afficher les fichiers cachés | Désactivé | Afficher les fichiers à point dans l'arborescence. |
| Noms ignorés | `node_modules`, `.git`, … | Noms masqués dans l'arborescence. |

## Images et pièces jointes

| Réglage | Défaut | Description |
| --- | --- | --- |
| Dossier de pièces jointes | `assets` | Dossier (relatif au document) pour les images collées/insérées. |
| Nommage des fichiers image | Horodatage | Noms horodatés, ou conserver le nom de fichier d'origine. |
| Copier les images externes | Activé | Copier les images hors du dossier du document dans les pièces jointes. |
| Télécharger les images distantes | Désactivé | Récupérer les URL d'images distantes dans les pièces jointes. |

## Langue

| Réglage | Défaut | Description |
| --- | --- | --- |
| Langue de l'interface | Système | Suivre la langue du système ou en fixer une parmi neuf. Voir [Langue et localisation](./language). |

## Liens

| Réglage | Défaut | Description |
| --- | --- | --- |
| Confirmer les liens externes | Activé | Demander avant d'ouvrir un lien dans le navigateur. |
