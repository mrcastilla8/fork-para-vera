# EventosFISI — Documentación de API

Bienvenido a la documentación de la API de **EventosFISI**, la plataforma de gestión de eventos académicos universitarios.

## Descripción general

Esta especificación OpenAPI define el contrato REST correspondiente a las entidades y flujos implementados en el frontend (`src/data/mockData.js` y `src/context/AppContext.jsx`):

- **Eventos**: Listado con filtros (`category`, `status`, `isFree`, `search`) y detalle completo con agenda por sesiones.
- **Categorías**: Catálogo de categorías académicas (`Tecnología`, `Ciencias`, `Negocios`, `Humanidades`, `Salud`, `Arte y Cultura`).
- **Estudiantes e Inscripciones**: Registro/identificación de estudiante (`@unmsm.edu.pe` o `@universidad.edu.pe`) y gestión de inscripciones a eventos próximos con control de cupos.

## Cómo usar la documentación

- **Portal Scalar Docs (CLI)**: Ejecuta `npm run docs:preview` para previsualizar esta guía junto con la referencia interactiva de la API.
- **Visor embebido en la app**: Ejecuta `npm run dev` y visita `/api-docs` en tu navegador.
