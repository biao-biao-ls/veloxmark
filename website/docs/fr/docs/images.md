---
title: Images
description: Prise en charge des images dans VeloxMark — chemins relatifs et absolus, URL distantes, taille d'affichage avec =WxH, attributs d'alignement et de retournement, pièces jointes.
keywords: [images Markdown, syntaxe taille image, alignement image, dossier de pièces jointes, images distantes]
---

# Images

VeloxMark résout les images comme un fichier Markdown sur disque le devrait — par rapport
au fichier que vous éditez.

## Chemins pris en charge

| Forme | Exemple | Résolu par rapport à |
| --- | --- | --- |
| Chemin relatif | `![alt](./img/chart.png)` | Répertoire du fichier `.md` courant |
| Chemin absolu | `![alt](C:\pics\a.png)` / `![alt](/home/me/a.png)` | Racine du système de fichiers |
| URL distante | `![alt](https://example.com/a.png)` | Récupérée sur le réseau |
| Data URI | `![alt](data:image/png;base64,…)` | Incorporée en ligne |

Les chemins relatifs sont le choix portable — déplacez le dossier contenant votre `.md`
et ses images ensemble et tout continue de fonctionner.

## Taille et attributs

Un suffixe `=WxH` optionnel après l'URL fixe les dimensions rendues, et les groupes `{…}`
après la parenthèse fermante fixent l'alignement et le retournement :

```markdown
![logo](./logo.png =128x128)
![banner](./banner.png =800x200){align=center}{flip=h}
```

| Attribut | Valeurs | Effet |
| --- | --- | --- |
| `=WxH` | p. ex. `=128x128` | Taille d'affichage en pixels |
| `{align=…}` | `left`, `center`, `right` | Alignement horizontal |
| `{flip=…}` | `h`, `v`, `hv` | Miroir horizontal / vertical / les deux |

Les images rendues peuvent aussi être **redimensionnées à la souris** (émet une largeur
en `%`), et le composant d'image propose aligner, retourner, réinitialiser la taille,
éditer l'URL et « Afficher dans le gestionnaire de fichiers ».

## Cliquer pour éditer

Les images se rendent comme des composants. Cliquez sur l'image pour éditer sa source
Markdown ; quittez le bloc et il se rend à nouveau — même comportement que les blocs de
code, de formule et de diagramme.

## Sécurité locale

Les images locales sont servies via le protocole interne `mdres://` de l'application
plutôt qu'en accès `file://` brut : un document ne peut afficher que les images que
l'application expose délibérément.
