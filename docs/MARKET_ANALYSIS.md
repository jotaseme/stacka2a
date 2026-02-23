# StackA2A - Analisis de Mercado y Gap Analysis

**Fecha:** 2026-02-23
**Estado actual:** 256 agentes, 12 stacks

---

## 1. RESUMEN EJECUTIVO

El protocolo A2A (Agent-to-Agent) tiene 22,000+ stars en GitHub, gobernanza bajo Linux Foundation, SDKs oficiales en 5 lenguajes, y soporte de Google, AWS, Microsoft, Salesforce, Cisco, SAP y ServiceNow. El mercado proyecta $2.3B en tecnologias A2A para 2026.

**Nuestro directorio tiene 256 agentes, pero el analisis revela problemas criticos:**

1. **79 agentes (31%) son "utility" genericos** — muchos de baja calidad que diluyen el directorio
2. **Categorias enteras de alta demanda estan vacias:** Healthcare (0), Supply Chain (0), Customer Service (0)
3. **Seguridad esta criticamente subrepresentada:** solo 8 agentes vs. demanda altisima
4. **Faltan agentes de alto perfil** que ya existen en GitHub y no tenemos
5. **Stacks importantes sin representacion:** PydanticAI, AWS Strands, .NET/Semantic Kernel

---

## 2. COMPETENCIA DIRECTA

| Competidor | Agentes | Fortaleza | Debilidad |
|---|---|---|---|
| **a2a.ac** | Grande | Bien categorizado | Sin quality scores |
| **a2aagentlist.com** | Medio | UI limpia | Contenido thin |
| **a2aregistry.org** | 15+ live | Agentes verificados y hosteados | Catalogo tiny |
| **a2apro.ai** | Medio | Marketplace + experimentacion | No curado |
| **a2acatalog.com** | Medio | Cubre A2A + MCP | Breadth over depth |
| **awesome-a2a (GitHub)** | 40+ | Community-curated | Lista plana, sin busqueda/filtros |

**Nuestra ventaja competitiva:**
- Quality scores con breakdown
- Recomendaciones por stack (que agentes trabajan juntos)
- Filtrado por framework/lenguaje
- Guias getting started por agente
- Blog content SEO
- 256 agentes — probablemente el mas grande curado

**Riesgo:** Si no mejoramos calidad, la ventaja de "mas agentes" se vuelve una desventaja (ruido).

---

## 3. DEMANDA DEL MERCADO POR CATEGORIA

### Tier 1 — Demanda Altisima (enterprise-driven)

| Categoria | Nuestro Count | Demanda | Gap |
|---|---|---|---|
| Multi-agent orchestration | 31 | Muy Alta | OK, seguir creciendo |
| Code generation | 22 | Muy Alta | Necesita mas enterprise-grade |
| Data analytics | 14 | Muy Alta | **SUBREPRESENTADO — necesita 25+** |
| Enterprise workflow | 25 | Muy Alta | OK |

### Tier 2 — Demanda Alta (crecimiento rapido)

| Categoria | Nuestro Count | Demanda | Gap |
|---|---|---|---|
| Security & Auth | 8 | Muy Alta | **CRITICAMENTE SUBREPRESENTADO** |
| Supply Chain & Logistics | 0 | Alta | **FALTA POR COMPLETO** |
| Healthcare | 0 | Alta | **FALTA POR COMPLETO** |
| Finance & Payments | 9 | Alta | Razonable pero creciendo |
| Customer Service | 0 (parcial en conversational) | Alta | **FALTA COMO CATEGORIA** |

### Tier 3 — Demanda Emergente

| Categoria | Nuestro Count | Demanda | Gap |
|---|---|---|---|
| Content creation | 7 | Media-Alta | Necesita crecimiento |
| DevOps / Infrastructure | 23 | Alta | Buena cobertura |
| Conversational | 13 | Media | Adecuado |

### Problema del "Utility"

79 agentes (31%) estan en "utility" — la categoria cajón de sastre. Esto:
- Diluye la calidad percibida del directorio
- Hace dificil encontrar agentes relevantes
- Incluye muchos agentes con 0 stars y poca actividad

**Recomendacion:** Subcategorizar o elevar thresholds de calidad.

---

## 4. AGENTES DE ALTO PERFIL QUE NOS FALTAN

### A. Plataformas/Frameworks (deben estar si o si)

| Proyecto | Stars | Que es | Por que importa |
|---|---|---|---|
| **pydantic/fasta2a** | 171 | Framework A2A de PydanticAI — `agent.to_a2a()` one-liner | Pydantic es ENORME en Python; su framework A2A es referencia |
| **NapthaAI/autoa2a** | — | CLI para convertir cualquier agente a A2A ("Vercel for A2A") | Herramienta clave para adopcion |
| **hybroai/a2a-adapter** | — | Wrapper A2A para CrewAI/LangGraph/n8n en 3 lineas | Enabler de interoperabilidad |
| **cisco-ai-defense/a2a-scanner** | 120 | Scanner de seguridad A2A de Cisco (5 motores de deteccion) | El unico tool de security scanning A2A. De Cisco. |
| **anneschuth/pinchwork** | — | Marketplace live de agentes A2A en pinchwork.dev | Unico marketplace A2A funcional |
| **aircodelabs/grasp** | — | Browser agent self-hosted con A2A + MCP | Nicho unico: browser automation |
| **pjawz/n8n-nodes-agent2agent** | — | Nodos n8n para A2A | Conecta A2A con el ecosistema no-code |

### B. SDKs Comunitarios de Alta Calidad

| Proyecto | Stars | Que es | Tenemos? |
|---|---|---|---|
| **themanojdesai/python-a2a** | 980 | Libreria Python A2A con integrations OpenAI/Anthropic/Bedrock/Ollama, MCP, registry | NO |
| **trpc-group/trpc-a2a-go** | 221 | Implementacion Go de Tencent con JWT/OAuth2/Redis | NO |
| **EmilLindfors/a2a-rs** | 78 | SDK Rust con arquitectura hexagonal, HTTP + WebSocket | NO (tenemos ra2a de qntx) |
| **a2a-4k/a2a-4k** | 38 | SDK Kotlin con Redis task storage | NO |
| **vishalmysore/a2ajava** | 94 | Spring Boot A2A + MCP dual-protocol, auto-expone beans | NO (tenemos a2ajava diferente?) |
| **wilsonsilva/a2a** | 10 | SDK Ruby para A2A | NO |
| **aurimasbutkus/a2a-php** | 0 | SDK PHP para A2A | NO |

### C. Herramientas Oficiales

| Proyecto | Stars | Que es | Tenemos? |
|---|---|---|---|
| **a2aproject/a2a-inspector** | 348 | Herramienta de validacion A2A oficial | NO — deberiamos tenerla |
| **a2aproject/a2a-tck** | 31 | Kit de compatibilidad de testing | NO |
| **llmx-de/a2a-validation-tool** | 10 | App desktop para validar implementaciones A2A | NO |

### D. Agentes Funcionales Reales

| Proyecto | Que hace | Status |
|---|---|---|
| **pab1it0/google-maps-a2a** | Geocoding, direcciones, busqueda de lugares via A2A | Funcional |
| **inference-gateway/documentation-agent** | Retrieval de docs via Context7 + A2A | Funcional |
| **opspawn/a2a-x402-gateway** | Gateway A2A con micropagos crypto | Funcional |
| **tanaikech/A2AApp** | Red A2A sobre Google Apps Script | Funcional |
| **k-jarzyna/adk-modular-architecture** | Sistema multi-agente de presales | Funcional |
| **maeste/multi-agent-a2a** | Multi-framework: ADK + LangGraph + CrewAI via A2A | Demo avanzado |

---

## 5. STACKS QUE DEBERIAMOS CREAR

### Stacks Nuevos Necesarios

| Stack | Justificacion | Agentes Potenciales |
|---|---|---|
| **PydanticAI Stack** | 4 agentes ya usan pydantic-ai + fasta2a es referencia | code-agent, planning-agent, data-agent, research-agent + fasta2a |
| **AWS / Strands Stack** | AWS tiene Bedrock AgentCore con A2A nativo | aws-samples/sample-agentic-frameworks-on-aws, strands agents |
| **.NET / Semantic Kernel Stack** | Microsoft tiene soporte first-class A2A | a2a-dotnet agents, semantic kernel samples |
| **Security Tools Stack** | Categoria mas demandada vs. mas subrepresentada | cisco a2a-scanner, auth agents, signing agents |
| **Healthcare Stack** | Demanda alta, 0 agentes | Necesita investigacion de repos especificos |
| **Customer Service Stack** | Demanda alta, 0 dedicado | Chatbot coordinators, ticket routing agents |
| **n8n / No-Code Stack** | Puente entre A2A y el mundo no-code | n8n-nodes-agent2agent, adaptors |

### Stacks Existentes que Necesitan Mejora

| Stack | Agentes Actuales | Que Falta |
|---|---|---|
| **Security & Auth** | 5 | Cisco a2a-scanner, mas auth patterns, vulnerability scanning |
| **Data Analytics** | 5 | Necesita el doble; agentes de ML pipelines, anomaly detection |
| **CrewAI** | 3 | Deberia tener mas; CrewAI tiene soporte A2A nativo |

---

## 6. FRAMEWORKS: COBERTURA ACTUAL vs. MERCADO

| Framework | Nuestros Agentes | Soporte A2A | Gap |
|---|---|---|---|
| Custom | 162 (63%) | N/A | Demasiado generico; muchos deberian reclasificarse |
| Google ADK | 36 (14%) | Nativo, first-party | Buena cobertura |
| LangGraph | 18 (7%) | Via LangSmith/community | OK |
| LangChain | 6 (2%) | A2A endpoint en Agent Server | Podria crecer |
| CrewAI | 6 (2%) | Nativo, first-class delegation | **Subrepresentado** |
| FastAPI | 5 (2%) | Framework web, no A2A-native | N/A |
| Semantic Kernel | 4 (2%) | Nativo, Microsoft first-class | **Subrepresentado** — enterprise demanda |
| Pydantic AI | 4 (2%) | Nativo via FastA2A | **Subrepresentado** — muy popular en Python |
| Spring Boot | 3 (1%) | Via spring-ai-a2a community | **Subrepresentado** — critico para enterprise Java |
| AutoGen/AG2 | 3 (1%) | Nativo (A2aAgentServer) | **Subrepresentado** — Microsoft-backed |
| OpenAI Agents | 2 (1%) | PR abierto, sin soporte oficial | Emerging |
| AWS Strands | 1 (0.4%) | Nativo, GA en Bedrock | **Criticamente subrepresentado** |
| .NET | 0 | SDK oficial + Microsoft support | **FALTA** |

---

## 7. LENGUAJES: COBERTURA vs. ECOSISTEMA

GitHub topics para `a2a-protocol`:
- Python: 81 repos → Tenemos 138 agentes (bueno)
- TypeScript: 35 repos → Tenemos 56 agentes (bueno)
- Go: 14 repos → Tenemos 12 agentes (OK)
- Java: 13 repos → Tenemos 13 agentes (OK)
- Rust: 7 repos → Tenemos 8 agentes (bueno)
- C#: 6 repos → Tenemos 7 agentes (bueno)
- Kotlin: — → Tenemos 1 agente (debil)
- Ruby: — → Tenemos 1 agente (debil)
- PHP: — → Tenemos 1 agente (debil)

---

## 8. PROBLEMAS DE CALIDAD DETECTADOS

### Agentes Dudosos (0 stars, sin actividad, o no claramente A2A)

El directorio incluye agentes que probablemente no deberian estar:
- Agentes con 0 stars y sin actualizacion en meses
- Repos que no implementan realmente el protocolo A2A (solo mencionan "agent")
- Repos que son forks sin modificaciones
- Agentes cuyas URLs ya no existen

**Recomendacion:** Audit de calidad con criterios minimos:
1. Repo debe existir y ser accesible
2. Debe implementar alguna parte del protocolo A2A (agent card, JSON-RPC, etc.)
3. Debe tener algun nivel de documentacion
4. Threshold minimo: al menos 1 commit en los ultimos 6 meses O >10 stars

---

## 9. CONTENIDO/SEO: OPORTUNIDADES NO CUBIERTAS

Topicos con alta demanda de busqueda que NO tenemos como blog posts:

| Topico | Demanda | Estado |
|---|---|---|
| "a2a agent registry" / "how to register an a2a agent" | Alta | No cubierto |
| "a2a gRPC support" (v0.3 feature) | Alta | No cubierto |
| "a2a + kubernetes" / "a2a agents on kubernetes" | Alta | No cubierto |
| "a2a spring ai tutorial" | Alta | No cubierto |
| "a2a .NET SDK guide" | Alta | No cubierto |
| "a2a agent card validator" / "validate a2a agent" | Media | No cubierto |
| "a2a pydantic ai tutorial" | Media | No cubierto |
| "a2a aws strands tutorial" | Media | No cubierto |
| "a2a vs langchain" | Media | No cubierto |

Ya tenemos blog posts sobre: a2a-vs-mcp, crewai, langgraph, spring-boot, google-adk, oauth2, agent-card, streaming, testing, error-handling, multi-turn, python-sdk, typescript-sdk, monitoring.

---

## 10. PLAN DE ACCION PRIORIZADO

### Prioridad 1: Calidad (semana 1)

1. **Audit de los 79 agentes "utility"** — subcategorizar o eliminar los de baja calidad
2. **Verificar que todos los repos existen** y son accesibles
3. **Reclasificar agentes "custom" framework** donde sea posible
4. **Eliminar agentes que no implementan A2A realmente**

### Prioridad 2: Agentes de Alto Perfil (semana 1-2)

1. Agregar **python-a2a** (980 stars — el SDK community mas popular)
2. Agregar **pydantic/fasta2a** (171 stars — framework de referencia)
3. Agregar **cisco-ai-defense/a2a-scanner** (120 stars — unico security scanner)
4. Agregar **trpc-group/trpc-a2a-go** (221 stars — Tencent)
5. Agregar **a2aproject/a2a-inspector** (348 stars — herramienta oficial)
6. Agregar **NapthaAI/autoa2a**, **hybroai/a2a-adapter**
7. Agregar **pab1it0/google-maps-a2a**, **pinchwork**

### Prioridad 3: Nuevos Stacks (semana 2-3)

1. Crear **PydanticAI Stack** (ya tenemos 4+ agentes)
2. Crear **Security Tools Stack** (expandir de 5 a 10+ agentes)
3. Crear **AWS/Strands Stack**
4. Crear **.NET/Semantic Kernel Stack**

### Prioridad 4: Categorias Nuevas (semana 3-4)

1. Investigar y agregar agentes de **Healthcare**
2. Investigar y agregar agentes de **Supply Chain**
3. Crear categoria formal de **Customer Service**
4. Crear categoria formal de **DevOps/CI-CD**

### Prioridad 5: Contenido SEO (ongoing)

1. Post: "A2A Agent Registry — How to Discover and Register Agents"
2. Post: "A2A + Kubernetes: Deploying Agents at Scale"
3. Post: "PydanticAI + A2A: Build Production Agents in 5 Minutes"
4. Post: "A2A .NET SDK Guide: Build Enterprise Agents with C#"
5. Post: "AWS Strands + A2A: Deploy Agents on Bedrock"

---

## 11. METRICAS DE EXITO

| Metrica | Actual | Objetivo 30 dias |
|---|---|---|
| Total agentes | 256 | 280+ (pero con mejor calidad) |
| Agentes "utility" sin clasificar | 79 | <30 |
| Categorias cubiertas | 13 | 17+ |
| Stacks | 12 | 16+ |
| Agentes con >100 stars | ~15 | 25+ |
| Frameworks representados | 15 | 18+ |
| Blog posts | ~24 | 30+ |

---

## 12. EMPRESAS CON ADOPCION CONFIRMADA DE A2A

Para validar la importancia del directorio:

| Empresa | Uso | Fuente |
|---|---|---|
| **Google** | Creador, ADK nativo, Agent Engine, Vertex AI | Official |
| **AWS** | Bedrock AgentCore con A2A runtime | AWS Blog |
| **Microsoft** | Semantic Kernel, Agent Framework, Teams SDK | MS Blog |
| **Salesforce** | Agentforce + A2A | a2a-samples |
| **Cisco** | A2A Security Scanner open-source | GitHub |
| **SAP** | Joule via A2A | Official |
| **ServiceNow** | Soporte A2A v0.3 desde Dec 2025 | Release notes |
| **Coinbase** | A2A x402 crypto payments con Google | GitHub |
| **Adobe** | Content creation workflows via A2A | Google Blog |
| **Tyson Foods** | Supply chain via A2A | Google Cloud Blog |
| **UiPath** | Medical record summarization | Marketplace |
| **Dynatrace** | Observability + incident response | Marketplace |

Consulting partners: Accenture, BCG, Capgemini, Cognizant, Deloitte, HCLTech, Infosys, KPMG, McKinsey, PwC, TCS, Wipro.

---

## 13. RESUMEN FINAL

**Lo bueno:**
- 256 agentes es probablemente el directorio curado mas grande
- Quality scores son un diferenciador unico
- Stack-based recommendations no las tiene nadie mas
- Blog content cubre bien las queries principales

**Lo malo:**
- Demasiado "utility" generico (31% del directorio)
- Categorias de alta demanda vacias (Healthcare, Supply Chain, Customer Service)
- Faltan agentes emblematicos (python-a2a con 980 stars no esta!)
- Frameworks enterprise subrepresentados (AWS Strands, .NET, Semantic Kernel)

**Lo urgente:**
- Limpiar calidad antes de agregar mas
- Agregar los 10-15 agentes de alto perfil que faltan
- Crear stacks para PydanticAI, Security Tools, AWS
- Blog posts para gRPC, Kubernetes, .NET — temas con demanda sin contenido

---

*Este analisis se basa en investigacion real de GitHub, web search, y cruce contra nuestros datos actuales. Febrero 2026.*
