# StackA2A — Auditoria SEO y Plan de Ejecucion

**Fecha:** 2026-02-23
**Estado:** Sitio recien desplegado en produccion
**Objetivo:** Posicionar lo mas arriba posible en busquedas relacionadas con A2A

---

## 1. RESUMEN DE AUDITORIA

Se han auditado tres areas: SEO tecnico, contenido, y rendimiento.

| Area | Puntuacion | Veredicto |
|------|-----------|-----------|
| SEO Tecnico | 82/100 | Muy buena base, faltan detalles criticos |
| Contenido SEO | 75/100 | Buen contenido, falta consistencia en metadatos |
| Rendimiento (CWV) | 80/100 | Bien optimizado, mejoras menores |

**Score global: 79/100** — Base solida con oportunidades claras de mejora.

---

## 2. HALLAZGOS CRITICOS (BLOQUEAN RANKING)

### FAIL-01: No existe pagina 404 personalizada
- **Impacto:** UX degradada, senal negativa para Google
- **Archivo faltante:** `src/app/not-found.tsx`
- **Nota:** Las rutas usan `notFound()` pero no hay pagina que lo maneje

### FAIL-02: Home page sin metadata propia
- **Impacto:** La pagina mas importante depende solo del layout global. Sin OG especifico, sin meta description optimizada para home
- **Archivo:** `src/app/page.tsx` — no exporta `metadata`

### FAIL-03: Titulo de /blog es "Blog"
- **Impacto:** Pierde oportunidad de keyword en la pagina de listado de blog
- **Archivo:** `src/app/blog/page.tsx`
- **Actual:** `title: "Blog"`
- **Deberia ser:** `title: "A2A Protocol Blog — Guides, Tutorials & Best Practices"`

### FAIL-04: Titulos dinamicos sin branding consistente
- **Impacto:** Titulos de agentes, stacks y blog posts no llevan "| StackA2A" — pierden brand recognition en SERPs
- **Archivos afectados:**
  - `src/app/agents/[slug]/page.tsx` → titulo: `${agent.name} — A2A Agent`
  - `src/app/stacks/[slug]/page.tsx` → titulo: `data.stack.name` (sin sufijo)
  - `src/app/blog/[slug]/page.tsx` → titulo: `result.post.title` (sin sufijo)
- **Nota:** El layout tiene template `%s | StackA2A` que deberia aplicar automaticamente. Verificar que los titulos de pagina NO sobreescriben el template.

### FAIL-05: next.config.ts casi vacio
- **Impacto:** Sin headers de seguridad, sin cache de assets estaticos, sin compresion configurada
- **Archivo:** `src/app/next.config.ts`
- **Contenido actual:** Solo `reactCompiler: true`

---

## 3. HALLAZGOS IMPORTANTES (AFECTAN RANKING)

### WARN-01: Skills de agentes vacios
- **Impacto:** Todas las fichas de agente tienen `skills: []` — las Agent Cards carecen de descripciones de capacidades
- **Alcance:** TODOS los JSON en `src/data/agents/`
- **Efecto SEO:** Contenido thin en paginas de agente, menos keywords indexables

### WARN-02: Descripciones de agentes sin validacion de longitud
- **Impacto:** Algunas descripciones son de 44 chars (muy cortas), otras de 286 chars (exceden SERP)
- **Ejemplos:**
  - `a2a.json`: "Azure-native A2A Technology Demonstrator" (44 chars — demasiado corta)
  - `swarm.json`: 286 chars (se trunca en Google)
- **Ideal:** 120-155 caracteres

### WARN-03: relatedAgents vacio en blog posts
- **Impacto:** Los posts mencionan agentes especificos pero el campo `relatedAgents` esta vacio en ~32 de 37 posts
- **Efecto:** Se pierde internal linking automatico de blog → agente

### WARN-04: No hay linking de agente → blog
- **Impacto:** Las paginas de agente no enlazan a blog posts que los mencionan
- **Efecto:** Se pierde internal linking bidireccional y tiempo de sesion

### WARN-05: Falta Organization schema en home/layout
- **Impacto:** Google no reconoce la entidad "StackA2A" como organizacion
- **Archivo:** `src/app/layout.tsx` — solo tiene WebSite schema

### WARN-06: Compare pages sin schema de comparacion
- **Impacto:** Las ~100 paginas de comparacion solo tienen BreadcrumbList, les falta Product comparison schema
- **Archivo:** `src/app/compare/[slugs]/page.tsx`

### WARN-07: Falta viewport meta export
- **Impacto:** Mobile indexing puede verse afectado
- **Archivo:** `src/app/layout.tsx` — no exporta `viewport`

### WARN-08: Header image sin priority
- **Impacto:** Above-the-fold image sin preload hint
- **Archivo:** `src/components/layout/header.tsx:30`

---

## 4. OPORTUNIDADES DE CONTENIDO

### Categorias sin blog post dedicado

| Categoria | Agentes existentes | Blog post | Estado |
|-----------|-------------------|-----------|--------|
| healthcare | Pocos | Ninguno | Oportunidad |
| supply-chain | Pocos | Ninguno | Oportunidad |
| customer-service | Pocos | Ninguno | Oportunidad |
| devops | Algunos | Ninguno | Oportunidad |
| finance | Algunos | Ninguno | Oportunidad |

### Posts de alto valor no escritos

| Post propuesto | Keyword target | Competencia |
|---------------|---------------|-------------|
| "A2A Agent Card JSON Schema: Complete Reference" | a2a agent card schema | Baja |
| "A2A Protocol Specification Explained" | a2a protocol spec | Baja |
| "Google ADK vs CrewAI vs LangGraph: Full Comparison 2026" | a2a framework comparison | Baja |
| "A2A Agents for Healthcare: Use Cases & Examples" | a2a healthcare | Ninguna |
| "How to Deploy A2A Agents on Kubernetes" | deploy a2a agent kubernetes | Baja |

### Paginas existentes que necesitan contenido mas rico

| Pagina | Problema | Solucion |
|--------|----------|----------|
| /agents/[slug] | Contenido thin si README no carga | Añadir seccion de FAQ auto-generada por agente |
| /stacks/[slug] | Sin `agentNotes` contextuales | Popular campo agentNotes en cada stack |
| /compare/[slugs] | Solo datos, sin analisis textual | Añadir parrafos de analisis comparativo |

---

## 5. PLAN DE EJECUCION

### SPRINT 1: Fixes criticos (1-2 dias)

Cambios de codigo pequenos con maximo impacto SEO.

| # | Tarea | Archivo | Tipo | Tiempo est. |
|---|-------|---------|------|-------------|
| 1.1 | Crear pagina 404 personalizada | `src/app/not-found.tsx` (nuevo) | Crear | 15 min |
| 1.2 | Añadir metadata al home page | `src/app/page.tsx` | Editar | 10 min |
| 1.3 | Mejorar titulo de /blog | `src/app/blog/page.tsx` | Editar | 5 min |
| 1.4 | Verificar que template de titulo `%s \| StackA2A` aplica en paginas dinamicas | Todos los [slug]/page.tsx | Verificar | 15 min |
| 1.5 | Añadir Organization schema | `src/app/layout.tsx` | Editar | 10 min |
| 1.6 | Añadir viewport export | `src/app/layout.tsx` | Editar | 5 min |
| 1.7 | Añadir priority a header image | `src/components/layout/header.tsx` | Editar | 2 min |
| 1.8 | Mejorar next.config.ts (headers seguridad + cache) | `next.config.ts` | Editar | 20 min |

**Tiempo total Sprint 1: ~1.5 horas**

#### Detalle de cambios Sprint 1:

**1.1 — not-found.tsx**
```tsx
// Pagina 404 con navegacion al home, agentes, y blog
// Incluir enlaces internos para que Google no pierda link equity
```

**1.2 — Home metadata**
```tsx
export const metadata = {
  title: "StackA2A — The Best A2A Agents, Scored & Ready to Connect",
  description: "Discover 250+ A2A protocol agents with quality scores, connection snippets in 5 languages, and curated stacks. The definitive directory for Agent-to-Agent protocol.",
  openGraph: {
    title: "StackA2A — The Best A2A Agents, Scored & Ready to Connect",
    description: "Discover 250+ A2A protocol agents...",
    url: "https://stacka2a.dev",
    type: "website",
  },
};
```

**1.3 — Blog titulo**
```tsx
title: "A2A Protocol Blog — Guides, Tutorials & Best Practices"
description: "Technical guides, framework tutorials, and best practices for building with the A2A (Agent-to-Agent) protocol. From beginner to production."
```

**1.5 — Organization schema**
```json
{
  "@type": "Organization",
  "name": "StackA2A",
  "url": "https://stacka2a.dev",
  "logo": "https://stacka2a.dev/icon.png",
  "sameAs": []
}
```

**1.8 — next.config.ts headers**
```typescript
headers: async () => [
  {
    source: "/(.*)",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ],
  },
  {
    source: "/(.*)\\.(js|css|woff2|png|jpg|svg|ico)",
    headers: [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ],
  },
],
```

---

### SPRINT 2: Contenido y metadatos (2-3 dias)

Mejoras de contenido que incrementan keywords indexables y internal linking.

| # | Tarea | Alcance | Tipo | Tiempo est. |
|---|-------|---------|------|-------------|
| 2.1 | Popular relatedAgents en blog posts | 37 posts en `src/content/blog/` | Editar | 2 horas |
| 2.2 | Crear funcion getPostsForAgent() | `src/lib/data.ts` | Codigo | 30 min |
| 2.3 | Mostrar blog posts relacionados en paginas de agente | `src/app/agents/[slug]/page.tsx` | Codigo | 30 min |
| 2.4 | Añadir comparison schema a paginas /compare | `src/app/compare/[slugs]/page.tsx` | Codigo | 30 min |
| 2.5 | Popular agentNotes en los 15 stacks | `src/data/stacks/*.json` | Editar | 1 hora |
| 2.6 | Auditar y normalizar descripciones de agentes (120-155 chars) | `src/data/agents/*.json` | Editar | 3 horas |

**Tiempo total Sprint 2: ~7.5 horas**

#### Detalle de cambios Sprint 2:

**2.1 — relatedAgents en blog posts**
- Abrir cada post "Best A2A Agents for X" y añadir los slugs de agentes mencionados
- Ejemplo para `best-a2a-agents-code-generation.md`:
  ```yaml
  relatedAgents: ["a2a-sample-github-agent", "code-agent", "ag2", "semantic-kernel-agent"]
  ```

**2.2 — getPostsForAgent()**
```typescript
export function getPostsForAgent(agentSlug: string): BlogPost[] {
  return getAllPosts().filter(post =>
    post.relatedAgents?.includes(agentSlug)
  );
}
```

**2.3 — Blog posts en pagina de agente**
- Seccion "Related Articles" debajo del README
- Enlace a cada post con titulo y fecha

**2.6 — Normalizacion de descripciones**
- Objetivo: todas entre 80-155 caracteres
- Demasiado cortas (<80): expandir con valor diferenciador
- Demasiado largas (>155): truncar preservando keywords

---

### SPRINT 3: Contenido nuevo (1 semana)

Posts nuevos apuntando a keywords sin competencia.

| # | Post | Keyword target | Prioridad |
|---|------|---------------|-----------|
| 3.1 | "Best A2A Agents for DevOps & Infrastructure" | a2a devops agents | Alta |
| 3.2 | "Best A2A Agents for Customer Service" | a2a customer service agents | Alta |
| 3.3 | "A2A Agent Card JSON Schema: Complete Reference 2026" | a2a agent card json schema | Alta |
| 3.4 | "Google ADK vs CrewAI vs LangGraph: Complete Comparison" | adk vs crewai vs langgraph a2a | Media |
| 3.5 | "How to Deploy A2A Agents on AWS (ECS + Fargate)" | deploy a2a agent aws | Media |

**Cada post: 2.000-3.000 palabras, 5+ code examples, internal links a 3+ agentes y 1+ stack**

---

### SPRINT 4: SEO avanzado (semana 2-3)

| # | Tarea | Impacto | Tiempo est. |
|---|-------|---------|-------------|
| 4.1 | Crear paginas /blog/tags/[tag] (tag landing pages) | +15 paginas indexables con keywords de cola larga | 2 horas |
| 4.2 | Popular campo skills en todos los agentes | Contenido rich en 250+ paginas de agente | 4-6 horas |
| 4.3 | Añadir FAQ schema a paginas de agente (auto-generado) | Rich snippets en Google para preguntas comunes | 2 horas |
| 4.4 | Crear pagina /glossary con terminos A2A | Posicionar en "a2a glossary", "agent card definition", etc. | 3 horas |
| 4.5 | Implementar badge "Listed on StackA2A" para repos de GitHub | Backlinks permanentes desde repos | 1 hora |
| 4.6 | Añadir parrafos de analisis textual a paginas /compare | Contenido unico vs solo datos tabulares | 3 horas |

---

## 6. KEYWORDS OBJETIVO Y PAGINAS ASIGNADAS

### Tier 1: Alta intencion (BOFU)

| Keyword | Pagina asignada | Estado |
|---------|----------------|--------|
| a2a agents | /agents | Existente |
| a2a agents list | /agents | Existente |
| a2a agent directory | /agents | Existente |
| best a2a agents | /agents (+ blog posts "best of") | Existente |
| a2a agent comparison | /compare | Existente |
| [agente] vs [agente] | /compare/[slugs] | ~100 paginas |

### Tier 2: Solucion (MOFU)

| Keyword | Pagina asignada | Estado |
|---------|----------------|--------|
| build a2a agent [framework] | /blog/build-a2a-agent-[framework] | 4 posts existentes |
| a2a agent card | /blog/a2a-agent-card-explained | Existente |
| a2a authentication oauth2 | /blog/secure-a2a-agents-oauth2 | Existente |
| a2a streaming | /blog/a2a-streaming-protocol-guide | Existente |
| a2a python sdk | /blog/a2a-python-sdk-guide | Existente |
| a2a typescript sdk | /blog/a2a-typescript-sdk-guide | Existente |
| crewai vs langgraph | /blog/a2a-crewai-vs-langgraph | Existente |
| a2a vs mcp | /blog/a2a-vs-mcp-comparison | Existente |

### Tier 3: Problema (TOFU)

| Keyword | Pagina asignada | Estado |
|---------|----------------|--------|
| what is a2a protocol | /blog/what-is-a2a-protocol | Existente |
| agent to agent protocol | /blog/what-is-a2a-protocol + /learn | Existente |
| a2a protocol tutorial | /blog/a2a-protocol-tutorial-beginners | Existente |
| multi agent systems | /blog/multi-agent-system-a2a | Existente |
| a2a protocol google | Multiples paginas | Existente |

### Tier 4: Sin competencia (oportunidad inmediata)

| Keyword | Pagina asignada | Estado |
|---------|----------------|--------|
| a2a agent card json schema | Sprint 3.3 | Por crear |
| a2a devops agents | Sprint 3.1 | Por crear |
| a2a customer service agents | Sprint 3.2 | Por crear |
| deploy a2a agent production | /blog/deploy-a2a-agent-production | Existente |
| a2a error handling | /blog/a2a-error-handling-patterns | Existente |

---

## 7. CHECKLIST POST-DESPLIEGUE (HOY)

Acciones inmediatas para que Google empiece a indexar:

- [ ] Submit sitemap.xml a Google Search Console
- [ ] Verificar propiedad del dominio en Search Console
- [ ] Ejecutar "Inspect URL" en las 5 paginas mas importantes
- [ ] Verificar structured data con Google Rich Results Test
- [ ] Comprobar que robots.txt es accesible en https://stacka2a.dev/robots.txt
- [ ] Comprobar que sitemap.xml es accesible en https://stacka2a.dev/sitemap.xml
- [ ] Verificar que canonical URLs resuelven correctamente
- [ ] Test de mobile-friendliness en Google Search Console
- [ ] Registrar en Bing Webmaster Tools (trafico adicional)

---

## 8. METRICAS DE SEGUIMIENTO

### Semana 1-2 (indexacion)
- Paginas indexadas en Google Search Console
- Errores de rastreo
- Core Web Vitals (field data cuando haya trafico)

### Mes 1 (posicionamiento inicial)
- Impresiones por keyword en Search Console
- Posicion media por keyword target
- CTR de SERPs por pagina
- Paginas que aparecen en resultados

### Mes 2-3 (crecimiento)
- Trafico organico semanal
- Keywords en top 10 / top 20 / top 50
- Nuevas keywords descubiertas
- Backlinks adquiridos

---

## 9. RESUMEN EJECUTIVO

**Lo que esta bien:**
- 300+ paginas indexables con contenido tecnico de calidad
- Structured data (WebSite, SoftwareApplication, BlogPosting, BreadcrumbList, FAQPage, ItemList)
- Canonical URLs en todas las paginas
- Static generation completa
- Bundle lean (~96KB), CWV deberian pasar
- Sitemap completo, robots.txt correcto

**Lo que hay que arreglar (Sprint 1, hoy):**
- Pagina 404
- Metadata del home
- Titulo de /blog
- Headers de seguridad y cache
- Organization schema
- Viewport meta

**Lo que hay que mejorar (Sprint 2, esta semana):**
- Internal linking bidireccional (blog <-> agentes)
- Normalizacion de descripciones de agentes
- Comparison schema
- agentNotes en stacks

**Lo que hay que crear (Sprint 3-4, semanas 2-3):**
- 5 blog posts nuevos apuntando a keywords sin competencia
- Tag landing pages
- Skills de agentes populados
- FAQ schema en paginas de agente
- Badge para repos de GitHub

---

*Ultima actualizacion: 2026-02-23*
