# Qué Hay BA — Atlas Cartográfico y Cartelera Cultural en Tiempo Real de CABA

> **Producción en vivo:** [https://que-hay-ba.vercel.app](https://que-hay-ba.vercel.app)

---

## 1. ¿Qué es Qué Hay BA?

**Qué Hay BA** es una aplicación web interactiva de cartografía cultural diseñada para responder una pregunta cotidiana de residentes y visitantes de la **Ciudad Autónoma de Buenos Aires (CABA)**: _«¿Qué hay para hacer hoy, este fin de semana o cerca de donde estoy, y cuánto cuesta?»_

En lugar de obligar al usuario a revisar decenas de agendas fragmentadas, portales estatales, ticketeras privadas y carteleras teatrales independientes, **Qué Hay BA** unifica, normaliza, deduplica y geolocaliza más de **2.200 actividades reales y próximas** sobre un único mapa interactivo de alta velocidad.

---

## 2. ¿Qué hace el sistema? (Arquitectura e Ingeniería de Datos)

### 2.1. Ingesta Multi-Fuente Automatizada

El motor de ingesta (`src/ingest/`) recolecta y actualiza diariamente eventos reales desde tres grandes ecosistemas culturales de Buenos Aires:

1. **Agenda Cultural Oficial del Gobierno de la Ciudad de Buenos Aires (GCBA)** (`src/ingest/sources/gcba.ts`)
   - Conecta con la API de actividades públicas de la Ciudad (`linda.buenosaires.gob.ar`).
   - Captura conciertos en centros culturales, museos, visitas guiadas, ciclos de cine, festivales barriales y actividades al aire libre.
2. **Alternativa Teatral — Cartelera Escénica de CABA** (`src/ingest/sources/alternativa.ts`)
   - Procesa la cartelera teatral y musical porteña (circuitos comercial, oficial e independiente/off).
   - Enriquecimiento automático de fichas para extraer **precios reales de entradas en pesos argentinos (ARS)**, sinopsis, horarios de funciones múltiples y dirección exacta de cada sala.
3. **Eventbrite CABA** (`src/ingest/sources/eventbrite.ts`)
   - Extrae eventos presenciales publicados en la Ciudad de Buenos Aires junto con su disponibilidad de tickets, rango de precios y coordenadas.

### 2.2. Pipeline de Geocodificación de Precisión en 4 Capas (`src/ingest/geocode.ts`)

Para garantizar que cada evento aparezca exactamente en su esquina o sala real dentro del perímetro de CABA (`-34.705` a `-34.525` latitud, `-58.535` a `-58.330` longitud), el sistema aplica una cascada determinística:

1. **Catálogo Curado de Sedes Emblemáticas (`src/ingest/venues-seed.ts`):** Coordenadas verificadas al metro para más de 60 salas, teatros, estadios, centros culturales y parques de Buenos Aires (Teatro Colón, Teatro San Martín, CC Recoleta, Usina del Arte, CC Konex, MALBA, Planetario, Niceto Club, Movistar Arena, etc.).
2. **Caché Persistente en Base de Datos (`geocode_cache`):** Evita consultas repetidas sobre direcciones ya resueltas.
3. **Normalizador Oficial USIG GCBA (`servicios.usig.buenosaires.gob.ar/normalizar`):** Geocodificador oficial del Gobierno de la Ciudad de Buenos Aires para calles, avenidas e intersecciones porteñas.
4. **Fallback Nominatim OpenStreetMap acotado a CABA:** Con validación estricta de polígono urbano.

### 2.3. Clasificación Semántica y Normalización Tarifaria (`src/ingest/normalise.ts`)

- **Taxonomía Automática:** Analiza título, descripción y etiquetas de origen para clasificar cada experiencia en una de las 6 categorías temáticas.
- **Detección de Gratuidad y Rango de Precios:** Identifica explícitamente eventos gratuitos (_«entrada libre y gratuita»_, _«sin cargo»_, _«a la gorra»_, `$0`) y estructura los arancelados en rangos claros en pesos argentinos (`ARS`).
- **Dispersión Espacial en Sedes Compartidas (Golden-Angle Jitter):** Cuando un mismo complejo cultural (como el Centro Cultural Recoleta o el Teatro San Martín) aloja múltiples actividades simultáneas, la API aplica un micro-desplazamiento espiral de ángulo áureo (`~18 metros`) para que todos los iconos sean individualmente clicables al acercar el mapa.

---

## 3. ¿Qué muestra la interfaz? (Experiencia de Usuario y Cartografía)

### 3.1. Pines Iconográficos por Categoría en el Mapa (`src/components/MapView.tsx`)

Cada experiencia se representa sobre el mapa mediante un **pin iconográfico de alta definición (WebGL a 2x DPI)** diseñado con el color y el símbolo vectorial propio de su disciplina cultural, más una insignia verde **`$0`** en la esquina superior derecha cuando la actividad es **gratuita**:

| Categoría                 |      Icono en el Mapa       |     Color Identitario     | Qué incluye                                                                         |
| :------------------------ | :-------------------------: | :-----------------------: | :---------------------------------------------------------------------------------- |
| **Música**                | 🎵 Corcheas musicales (`♫`) |    Violeta (`#7c3aed`)    | Recitales, jazz, tango, orquestas, milongas, DJs y peñas.                           |
| **Teatro y Espectáculos** |     🎭 Máscara escénica     | Carmesí Telón (`#e11d48`) | Teatro comercial (Av. Corrientes), circuito off, danza, stand-up y musicales.       |
| **Arte y Cultura**        |      🎨 Paleta y museo      |   Terracota (`#ea580c`)   | Exposiciones en museos, muestras fotográficas, cine arte, galerías y literatura.    |
| **Gastronomía y Ferias**  |       🍔 Copa / Feria       |  Ocre Dorado (`#d97706`)  | Ferias barriales, mercados gastronómicos, degustaciones, catas y patios cerveceros. |
| **Aire Libre y Deportes** |      🌳 Árbol botánico      |   Esmeralda (`#16a34a`)   | Caminatas urbanas, reservas ecológicas, parques, ciclismo y actividades al sol.     |
| **Talleres y Charlas**    |     🎓 Birrete / Libro      | Azul Cobalto (`#0284c7`)  | Cursos, workshops creativos, conferencias, seminarios y visitas pedagógicas.        |

### 3.2. Cuatro Capas Cartográficas Sin Marca de Agua

El usuario puede alternar en un clic entre cuatro mapas base libres de marcas de agua:

- **Urbano CABA:** Cartografía topográfica limpia de calles, avenidas y barrios.
- **GCBA (USIG Oficial):** Mapa oficial del Gobierno de la Ciudad de Buenos Aires.
- **Nocturno:** Modo oscuro de alto contraste para exploración nocturna.
- **Callejero:** Plano urbano tradicional con sentido y nomenclatura detallada de arterias.

### 3.3. Filtros en Tiempo Real y Atajos Barriales (`src/components/FilterBar.tsx`)

- **Búsqueda Instantánea:** Filtra por nombre de espectáculo, artista, sala, museo o barrio.
- **Filtro Temporal:** _Ahora_, _Hoy_, _Este finde_ o selección de **fecha exacta en calendario**.
- **Filtro Económico:** Botón directo **$0 Gratis** o tramos de presupuesto (_Hasta $10.000_, _$10.000 – $30.000_, _Más de $30.000_).
- **Corredores Culturales y Barrios:** Salto cartográfico instantáneo a _Av. Corrientes · Centro_, _Palermo_, _Recoleta_, _San Telmo · La Boca_, _Chacarita · Villa Crespo_, _Abasto · Almagro_, _Belgrano · Núñez_ y _Caballito_.
- **Geolocalización («Cerca mío»):** Calcula en vivo la distancia en kilómetros desde la ubicación del usuario hasta cada evento y ordena la cartelera por cercanía.

### 3.4. Cartelera Lateral Sincronizada y Ficha de Experiencia (`src/components/EventSheet.tsx`)

- **Sincronización Bidireccional:** Al pasar el cursor sobre una tarjeta en la cartelera lateral, su pin correspondiente se ilumina en el mapa; al pasar el cursor sobre cualquier pin del mapa, emerge una vista previa instantánea.
- **Ficha Completa estilo Ticket Editorial:** Muestra imagen o portada temática, precio, sede, barrio, distancia, **próximas funciones**, reseña completa, botón para **agendar en Google Calendar**, ruta en transporte público (**Cómo llegar en Subte/Colectivo**), enlace directo a **entradas/web oficial** y guardado en **Mi Agenda (`localStorage`)**.

---

## 4. Stack Tecnológico

- **Frontend & SSR:** Next.js 16.4 (App Router, TypeScript), Tailwind CSS v4, tipografía editorial _Fraunces_ + _Plus Jakarta Sans_ + _JetBrains Mono_.
- **Motor Cartográfico:** MapLibre GL JS con generación procedural de iconos en Canvas 2D (`pixelRatio: 2`), clustering dinámico y capas USIG GCBA / Esri.
- **Base de Datos:** Supabase PostgreSQL (`sa-east-1`) con **Row-Level Security (RLS)** habilitado en todas las tablas (`venues`, `events`, `detail_cache`, `geocode_cache`, `ingest_runs`) y conexión segura vía Transaction Pooler.
- **Infraestructura y Actualización Continua:** Desplegado en Vercel con tareas programadas (`Vercel Cron`) que sincronizan las fuentes culturales diariamente.
