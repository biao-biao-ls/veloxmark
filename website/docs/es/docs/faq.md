---
title: Preguntas frecuentes
description: Preguntas frecuentes de VeloxMark — plataformas compatibles, licencia, cómo funciona la vista previa en vivo, ida y vuelta de archivos, ubicación de los datos, Gatekeeper de macOS y comportamiento de actualización.
keywords: [preguntas frecuentes de VeloxMark, FAQ del editor de Markdown, preguntas sobre la vista previa en vivo, solución de problemas de VeloxMark]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"¿Qué plataformas son compatibles?","acceptedAnswer":{"@type":"Answer","text":"macOS (Apple Silicon e Intel), Windows 10/11 (x64 y ARM64) y Linux (x64 y arm64 — AppImage, deb, rpm, tar.gz; snap solo x64)."}},{"@type":"Question","name":"¿VeloxMark es gratuito?","acceptedAnswer":{"@type":"Answer","text":"Sí. VeloxMark es de código abierto bajo la licencia MIT. Sin cuenta, sin suscripción, sin telemetría."}},{"@type":"Question","name":"¿Qué es la vista previa en vivo y en qué se diferencia de una vista dividida?","acceptedAnswer":{"@type":"Answer","text":"No hay panel de vista previa. El editor renderiza Markdown en su lugar: cuando el cursor deja una línea, los marcadores de sintaxis se ocultan y la línea muestra su forma final. La línea del cursor siempre permanece en forma de código fuente, y al hacer clic en cualquier bloque renderizado se recupera su Markdown original para editarlo. El código fuente Markdown es la única fuente de datos: al guardar se escribe un .md plano con pérdida cero de ida y vuelta."}},{"@type":"Question","name":"¿VeloxMark modifica mis archivos Markdown al guardar?","acceptedAnswer":{"@type":"Answer","text":"No. Al guardar se escribe el texto fuente sin cambios. Todo el renderizado es decoración."}},{"@type":"Question","name":"¿Qué sintaxis de Markdown es compatible?","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM (tablas, listas de tareas, tachado), además de matemáticas KaTeX, diagramas Mermaid, notas destacadas, notas al pie y texto resaltado."}},{"@type":"Question","name":"¿Puedo usar VeloxMark para gestionar mis notas?","acceptedAnswer":{"@type":"Answer","text":"VeloxMark es un lector/editor de Markdown centrado: abre carpetas y archivos, usa el esquema y la búsqueda, pero no hay una capa de gestión del conocimiento. Tus archivos siguen siendo .md planos en disco, así que cualquier otra herramienta puede recogerlos."}},{"@type":"Question","name":"¿Cómo reporto un error?","acceptedAnswer":{"@type":"Answer","text":"Abre un issue en GitHub con la versión de la aplicación (menú Ayuda), tu sistema operativo, los pasos para reproducirlo y el Markdown que se comporta mal."}},{"@type":"Question","name":"¿Dónde se guardan mis borradores y ajustes?","acceptedAnswer":{"@type":"Answer","text":"Las preferencias, los borradores y el estado de la sesión viven en el directorio estándar de datos de aplicación por usuario (userData de Electron): Windows %APPDATA%\\VeloxMark, macOS ~/Library/Application Support/VeloxMark, Linux ~/.config/VeloxMark. Los documentos en sí nunca se mueven ni se copian."}},{"@type":"Question","name":"¿Por qué macOS dice que la aplicación es de un desarrollador no identificado?","acceptedAnswer":{"@type":"Answer","text":"Las compilaciones de publicación están actualmente sin firmar. Ejecuta xattr -d com.apple.quarantine /Applications/VeloxMark.app una vez después de instalar."}},{"@type":"Question","name":"La aplicación no se actualiza automáticamente en mi plataforma — ¿es normal?","acceptedAnswer":{"@type":"Answer","text":"Sí. La actualización automática completa está habilitada en las instalaciones NSIS de Windows y en AppImage de Linux; las demás formas de instalación solo notifican, y macOS recurre actualmente a abrir la página de releases porque las compilaciones están sin firmar."}}]}'
---

# Preguntas frecuentes (FAQ)

### ¿Qué plataformas son compatibles?

macOS (Apple Silicon e Intel), Windows 10/11 (x64 y ARM64) y Linux
(x64 y arm64 — AppImage, deb, rpm, tar.gz; snap solo x64).
Consulta [Instalación](./installation).

### ¿VeloxMark es gratuito?

Sí. VeloxMark es de código abierto bajo la
[licencia MIT](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE).
Sin cuenta, sin suscripción, sin telemetría.

### ¿Qué es la «vista previa en vivo» y en qué se diferencia de una vista dividida?

No hay panel de vista previa. El editor renderiza tu Markdown **en su lugar**: cuando el
cursor deja una línea, marcadores de sintaxis como `#`, `**` y `` ` `` se ocultan y la
línea muestra su forma final. La línea del cursor siempre permanece en forma de código
fuente, y al hacer clic en cualquier bloque renderizado (código, fórmula, diagrama,
tabla, imagen) se recupera su Markdown original para editarlo. El código fuente Markdown
es la única fuente de datos: al guardar se escribe un `.md` plano con pérdida cero de ida
y vuelta.

### ¿VeloxMark modifica mis archivos Markdown al guardar?

No. Al guardar se escribe el texto fuente sin cambios. Todo el renderizado es decoración.

### ¿Qué sintaxis de Markdown es compatible?

CommonMark + GFM (tablas, listas de tareas, tachado), además de matemáticas KaTeX,
diagramas Mermaid, notas destacadas, notas al pie y `==resaltados==`. Referencia completa:
[Sintaxis de Markdown](./markdown-syntax).

### ¿Puedo usar VeloxMark para gestionar mis notas?

VeloxMark es un lector/editor de Markdown centrado: abre carpetas y archivos, usa el
esquema y la búsqueda, pero no hay una capa de gestión del conocimiento (sin etiquetas,
enlaces de retorno ni base de datos). Tus archivos siguen siendo `.md` planos en disco,
así que cualquier otra herramienta puede recogerlos.

### ¿Cómo reporto un error?

Abre un issue en [GitHub](https://github.com/biao-biao-ls/veloxmark/issues) con la
versión de la aplicación (menú Ayuda), tu sistema operativo, los pasos para reproducirlo
y el Markdown que se comporta mal.

### ¿Dónde se guardan mis borradores y ajustes?

Las preferencias, los borradores y el estado de la sesión viven en el directorio estándar
de datos de aplicación por usuario (Electron `userData`): Windows `%APPDATA%\VeloxMark`,
macOS `~/Library/Application Support/VeloxMark`, Linux `~/.config/VeloxMark`. Los
documentos en sí nunca se mueven ni se copian — editas los archivos donde están.

### ¿Por qué macOS dice que la aplicación es de un desarrollador no identificado?

Las compilaciones de publicación están actualmente sin firmar. Ejecuta
`xattr -d com.apple.quarantine /Applications/VeloxMark.app` una vez después de instalar —
consulta [Instalación](./installation#macos).

### La aplicación no se actualiza automáticamente en mi plataforma — ¿es normal?

Sí. La actualización automática completa está habilitada en las instalaciones NSIS de
Windows y en AppImage de Linux; las demás formas de instalación solo notifican, y macOS
recurre actualmente a abrir la página de releases porque las compilaciones están sin
firmar. Detalles: [Actualización automática](./updates).
