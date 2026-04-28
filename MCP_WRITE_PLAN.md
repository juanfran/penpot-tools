# MCP write-mode — Plan de implementación

Plan para extender `@penpot-tools/mcp` con capacidad de **crear y modificar diseños en Penpot** vía API REST. Basado en las decisiones tomadas en la sesión 2026-04-28.

## 1. Decisiones tomadas

| Decisión                                                                  | Implicación                                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Solo REST (`update-file`), sin plugin runtime                             | Funciona con el editor cerrado; hay que hablar el lenguaje de `changes`   |
| Soporte de tokens **y** components/variants                               | El paquete debe modelar `add-token`, `add-component`, `variant-id`, etc.  |
| Casos de uso prioritarios: (a) crear desde prompt + (b) editar selección  | El workflow markdown queda fuera; el agente decide qué tocar              |
| Capa de autoría = **HTML+CSS**, paridad con lo que ya soporta el converter | El subset CSS válido está acotado por el converter; documentarlo al LLM   |
| **Rebuild** del subtree afectado por defecto en edits (más simple)         | Surgical solo en una tool puntual `modify_shape` para cambios triviales   |
| Imágenes desde rutas absolutas/relativas locales                          | Tool dedicada de upload; nada de URLs remotas en v1                       |
| Refresh del viewer manual                                                 | No polling/websocket; el usuario recarga                                  |
| Conflicto de `revn` → fallo limpio                                        | Sin reintentos; el agente decide al recibir el error                      |

## 2. Estrategia: HTML como capa de autoría + rebuild headless

```
                              ┌──────────────┐
prompt ──▶ LLM ─── HTML+CSS ─▶│ html-to-     │── Penpot Shape[] ─┐
                              │  penpot      │                    │
                              │  (nuevo pkg) │                    │
                              └──────▲───────┘                    │
                                     │ measure                    ▼
                              ┌──────┴───────┐             ┌──────────────┐
                              │  headless    │             │ changes[]    │
                              │  Chromium    │             │ builder      │
                              │ (reutiliza   │             └──────┬───────┘
                              │  screenshot) │                    │
                              └──────────────┘                    ▼
                                                            update-file
                                                            (REST)
```

**Por qué HTML y no un DSL JSON propio:**
- Los LLMs producen mejor diseño en HTML+CSS que en JSON propietario; menos prompt engineering.
- El converter actual ya define el mapping Penpot ↔ HTML; el inverso reutiliza esas mismas reglas, no inventa nada.
- El navegador **mide** posiciones, tamaños y estilos computados — Penpot necesita `selrect`/`points` exactos y eso es lo que mejor sabe calcular un browser.
- Coherencia: el converter y el inverso tienen el mismo subset de CSS soportado, definido en un único sitio.

**Por qué rebuild y no diff surgical en updates:**
- Más simple de implementar y razonar.
- Menos estado que sincronizar entre la HTML editada y el árbol Penpot existente.
- Para cambios triviales (color, radius, un texto) tenemos `modify_shape` aparte que sí es surgical.

## 3. Arquitectura

### 3.1 Nuevo paquete: `packages/html-to-penpot`

Mirror invertido de `packages/converter`. Misma estructura, lógica complementaria.

```
packages/html-to-penpot/src/
  index.ts                — htmlToChanges(html, ctx) → ChangeBundle
  types.ts                — MeasuredNode, BuildContext, ChangeBundle

  measure/
    headless.ts           — Lanza Chromium, monta HTML, walk del DOM con evaluate
    walk.ts               — Snapshot in-page de cada elemento (rect + computed style)
    types.ts              — MeasuredNode

  build/
    tree.ts               — MeasuredNode[] → Shape[] (tipados de @penpot-tools/converter)
    selrect.ts            — Computa selrect, points, transform desde rect+CSS transform
    shape-id.ts           — UUID v7 (con seed para tests reproducibles)
    text-content.ts       — DOM text nodes/spans → estructura content de Penpot text

  shapes/                 — frame.ts, rect.ts, text.ts, image.ts, circle.ts, path.ts, group.ts
  visual/                 — fills.ts, strokes.ts, radius.ts, shadows.ts, blur.ts, blend.ts
  layout/                 — flex.ts, grid.ts, layout-item.ts (lectura de display + flex-*)

  tokens/
    extract.ts            — Detecta var(--name, fallback) en computed styles
    diff.ts               — Tokens nuevos vs existentes en el file → changes a emitir
    types.ts

  changes/
    builder.ts            — addObj(), modObj(ops), delObj(), movObjects(), regObjects()
    operations.ts         — Helpers para los `operations` de mod-obj
    media.ts              — Sube binarios via upload-file-media-object
    types.ts              — Tipos de Change y Operation (espejo del backend)
```

### 3.2 Nuevas tools en `apps/mcp/src/tools/`

```
apps/mcp/src/tools/
  write/
    create-from-html.ts       — create_design_from_html
    update-selection.ts       — update_selection_from_html
    modify-shape.ts           — modify_shape (surgical)
    apply-token.ts            — apply_token
    create-token-set.ts       — create_token_set
    upload-media.ts           — upload_media
    create-component.ts       — create_component_from_shape (v2)
```

### 3.3 Cambios en `apps/mcp/src/penpot-api.ts`

Añadir:

```ts
export async function getFileMeta(token, fileId): Promise<{ revn: number, sessionId: string }>
export async function updateFile(token, body: UpdateFileBody): Promise<UpdateFileResult>
export async function uploadFileMedia(token, fileId, file: { path, name, mediaType }): Promise<MediaRef>
```

Todas con las mismas `features` que ya usa el converter (`design-tokens/v1`, `variants/v1`, `components/v2`, `styles/v2`, `fdata/objects-map`, etc.).

## 4. Pipeline detallado

### 4.1 Render + measure (headless)

Reutilizar la infra de `apps/mcp/src/screenshot.ts`:

1. Lanzar Playwright Chromium (singleton ya existente).
2. Inyectar `:root { ... }` con tokens si vienen del contexto del file.
3. Cargar `@font-face` igual que el screenshot.
4. `await document.fonts.ready` + esperar `<img onload>`.
5. `page.evaluate(...)` ejecuta in-page un walker que devuelve para cada `Element`:

```ts
type MeasuredNode = {
  domPath: string                      // selector único para debug
  semanticTag: string                  // 'div'|'header'|'h1'|'button'|'img'|'svg'|...
  rect: { x, y, width, height }        // bounding rect, ya ajustado al origen del root
  computedStyle: PickedComputedStyle    // solo las propiedades que nos interesan
  textContent?: string                 // si es leaf de texto
  textRuns?: TextRun[]                 // si tiene <span> con estilos diferentes
  imageSrc?: string                    // si es <img>
  imageMediaId?: string                // de data-penpot-media-id si lo puso el LLM
  svgInner?: string                    // si es <svg>: outerHTML
  parentDomPath: string | null
  childIds: string[]                   // domPaths de hijos
  zOrder: number                       // index entre hermanos
  dataAttrs: Record<string, string>    // data-id, data-penpot-*, data-name
  preserveId?: string                  // de data-id si existe
}

type PickedComputedStyle = {
  display, position, transform, opacity, mixBlendMode, filter,
  backgroundColor, backgroundImage,
  border, borderTop/Right/Bottom/Left, borderRadius (+ per-corner),
  boxShadow,
  flexDirection, justifyContent, alignItems, gap, padding/Top/Right/Bottom/Left,
  gridTemplateColumns, gridTemplateRows, gridRowStart, gridColumnStart,
  fontFamily, fontSize, fontWeight, fontStyle, lineHeight, letterSpacing,
  color, textAlign,
  // ... el subset exacto coincide con lo que el converter sabe emitir
}
```

### 4.2 Build del árbol Penpot

Cada `MeasuredNode` se traduce a una `Shape` aplicando el inverso del converter:

| HTML / CSS                                            | Penpot shape                         |
| ----------------------------------------------------- | ------------------------------------ |
| Tiene `display: flex` con hijos                       | `frame` con `layout: 'flex'`         |
| Tiene `display: grid` con hijos                       | `frame` con `layout: 'grid'`         |
| `<header>/<section>/<div>/<button>/<form>/...`        | `frame`                              |
| `<img>`                                               | `image` (con `metadata.id`)          |
| `<p>/<h1..6>/<span>/<a>` con texto                    | `text`                               |
| `border-radius: 50%` y `width === height`             | `circle`                             |
| `<svg>` inline                                        | `svg-raw` (preservar paths tal cual) |
| Container que solo agrupa, sin estilos visuales       | `group` (si data-type lo indica)     |

Reglas:

- **Posición**: para top-level del board, `x/y` del rect. Para flex/grid children Penpot recoloca solo, pero igual emitimos `selrect` real (el browser ya lo midió).
- **selrect / points**: del `getBoundingClientRect()` ajustado al origen del root.
- **transform**: solo si la matriz CSS no es identidad.
- **Fills**:
  - `background-color: rgba/...` → solid fill
  - `background-image: linear-gradient(...)` / `radial-gradient(...)` → gradient fill
  - `background-image: url(...)` → image fill (requiere media-id, ver §4.4)
  - `var(--token, fallback)` detectado → `applied-tokens.fill = 'token.name'`
- **Strokes**: `border: Npx solid color` → stroke `inner` o `center`. `box-shadow: 0 0 0 Npx color` → stroke `outer`. (Mismo criterio que el converter pero invertido.)
- **Radius**: `border-radius` per-corner.
- **Shadows**: parsea la lista de `box-shadow`, ignora los que reconozcamos como strokes outer.
- **Texto**: árbol `content` de Penpot (`root → paragraph-set → paragraph → text-leaf`). Cada `<span>` con estilos distintos = un leaf nuevo. `<br>` = paragraph break.
- **Layout flex**: `flex-direction`, `justify-content`, `align-items`, `gap`, `padding`. Hijos con `flex: 1` → `layout-item-h-sizing: 'fill'`. Width fijo px → `'fix'`. Width auto → `'auto'`.
- **Layout grid**: `grid-template-columns/rows` (parseo de `repeat(...)`, `fr`, `px`, `auto`), `grid-row/column-start` per-child.

### 4.3 Tokens

1. Mientras se walks el computed style, regex sobre cada valor: `var\(--([a-zA-Z0-9_.-]+)(?:,\s*([^)]+))?\)`.
2. Para cada token referenciado:
   - Si ya existe en el file (consulta a `data.tokens-lib` del file traído al principio) → solo aplicar `applied-tokens` al shape.
   - Si no existe → emitir `add-token-set` (si el set tampoco existe) + `add-token` con value = el fallback CSS.
3. Tokens de tipo `color` solo en v1; `spacing`/`sizing`/`border-radius`/`opacity` en Fase 3.

### 4.4 Upload de imágenes

`upload_media` se llama **antes** de `create_design_from_html`. El LLM:

1. Llama `upload_media({ paths: ['./hero.png', '/tmp/logo.svg'] })`.
2. Recibe `[{ path, id, mediaType, width, height }, ...]`.
3. En el HTML que genera, marca cada `<img>` con `data-penpot-media-id="<id>"` (sigue poniendo `src` para que el render headless las muestre).
4. El builder lee `data-penpot-media-id` del DOM en lugar de inventar uno.

Si una imagen no tiene `data-penpot-media-id`: error claro al LLM ("sube primero el media con `upload_media`").

Endpoint:

```
POST /api/rpc/command/upload-file-media-object
Content-Type: multipart/form-data

file-id=<uuid>
name=<filename>
is-local=true
content=<binary>
```

Devuelve `{ id, name, mtype, width, height }`.

### 4.5 Construcción de la lista de `changes`

Tipos de change relevantes:

```ts
type Change =
  | { type: 'add-obj', id, parent-id, frame-id, page-id, obj: Shape, index? }
  | { type: 'mod-obj', id, page-id, operations: Operation[] }
  | { type: 'del-obj', id, page-id, ignore-touched? }
  | { type: 'mov-objects', page-id, parent-id, shapes: string[], index? }
  | { type: 'reg-objects', page-id, shapes: string[] }
  | { type: 'add-token-set', set: TokenSet }
  | { type: 'mod-token-set', set-id, ... }
  | { type: 'add-token', set-id, token: Token }
  | { type: 'mod-token', set-id, token-name, value }
  | { type: 'add-component', component-id, ... }
  | { type: 'mod-component', component-id, operations: Operation[] }

type Operation =
  | { type: 'set', attr: string, val: any, ignore-touched? }
  | { type: 'set-touched', touched: string[] }
  | { type: 'set-applied-tokens', tokens: { fill?, strokeColor?, ... } }
  // … los que use mod-obj
```

Pipeline de creación (board nuevo):

```
1. Si hay imágenes: subirlas via uploadFileMedia (no es change)
2. Si hay tokens nuevos: add-token-set + add-token[]
3. add-obj del board top-level
4. Walk top-down: por cada nodo emite add-obj con parent-id + frame-id correctos
5. reg-objects con [boardId] al final → recompute selrects
```

Llamada:

```
POST /api/rpc/command/update-file
{
  id: fileId,
  revn: <fresh>,
  session-id: <stable per MCP session>,
  changes: [...]
}
```

Si 409 / `:conflict-on-update-file` → error tal cual al LLM, sin reintentar.

## 5. Tools del MCP — superficie pública

Mismo patrón que las tools existentes (`registerXxxTool(server)` en `tools/*.ts`).

### 5.1 `create_design_from_html`

```ts
input: {
  html: string,                      // HTML completo, con <style> inline
  parentBoardId?: uuid,              // si no, board nuevo en la page actual
  position?: { x: number, y: number }, // si no, junto al último board
  name?: string,                     // nombre del board creado
}
output: {
  boardId: uuid,
  createdShapeIds: uuid[],
  createdTokens: string[],
  uploadedMediaCount: number,
  warnings: string[],                // CSS no soportado, etc.
}
```

Implementación: render headless → measure → tree → changes → updateFile.
Lee `fileId/pageId` de la selección actual del viewer (`requireSelection()`).

### 5.2 `update_selection_from_html`

```ts
input: {
  html: string,                      // HTML reemplazo del subtree
  preserveId?: boolean,              // default true (mantiene el id raíz)
}
output: { rebuiltShapeId: uuid, deletedShapeIds: uuid[], createdShapeIds: uuid[] }
```

Pipeline: requireSelection → la shape actual es la raíz a reemplazar → `del-obj[]` para todos sus children → recrear desde HTML como children del mismo padre. Con `preserveId: true` preservamos el id del shape raíz y solo rehacemos su contenido (`mod-obj` de props + del-obj/add-obj de children).

### 5.3 `modify_shape` (surgical)

```ts
input: {
  shapeId: uuid,
  ops: {
    fill?: { color: string, opacity?: number } | { tokenName: string },
    stroke?: {
      color?: string, width?: number, alignment?: 'inner'|'center'|'outer',
      tokenName?: string,
    },
    radius?: number | { tl: number, tr: number, br: number, bl: number },
    layout?: {
      type?: 'flex'|'grid'|'none',
      direction?: 'row'|'column',
      gap?: number,
      padding?: number | [number, number, number, number],
      justify?: string, align?: string,
    },
    text?: string,                  // reemplaza el texto plano (si es text shape)
    name?: string,
    visible?: boolean,
    locked?: boolean,
  }
}
output: { shapeId: uuid, appliedOps: string[] }
```

Genera 1 solo `mod-obj` con todas las operations. No pasa por HTML headless. Cubre el caso "aplica token primary al bg, aumenta radius".

### 5.4 `apply_token`

```ts
input: {
  shapeId: uuid,
  attribute: 'fill'|'stroke-color'|'border-radius-top-left'|'... per attr',
  tokenName: string,
}
```

Conveniencia sobre `modify_shape`. Una operation `set-applied-tokens`.

### 5.5 `create_token_set`

```ts
input: {
  setName: string,
  tokens: Array<{
    name: string,
    type: 'color'|'spacing'|'sizing'|'border-radius'|'opacity'|'typography',
    value: string | number | TypographyValue,
    description?: string,
  }>,
}
output: { setId: uuid, createdTokens: string[] }
```

Para "create design system con primary, accent, fg, fg-light".

### 5.6 `upload_media`

```ts
input: { paths: string[] }            // absolutas o relativas al cwd del MCP
output: Array<{
  path: string,
  id: uuid,
  mediaType: string,
  width: number,
  height: number,
}>
```

### 5.7 `create_component_from_shape` (Fase 5)

```ts
input: { shapeId: uuid, name?: string, path?: string }
output: { componentId: uuid }
```

Variants en una iteración posterior: `add_variant_to_component({ componentId, variantProperties })`.

## 6. Subset de CSS soportado

Definido por **paridad con el converter**. El LLM debe ceñirse a este subset; el system prompt del MCP lo documenta:

**Soportado:**
- `position: absolute|relative|fixed`, `top/left/width/height`
- `transform: translate/scale/rotate/matrix` (lo demás se ignora)
- `display: flex|grid|block`
- `flex-direction`, `justify-content`, `align-items`, `gap`, `padding[-*]`
- `grid-template-columns/rows` (con `repeat`, `fr`, px, auto), `grid-row/column-start`
- `background-color`, `background: linear-gradient|radial-gradient`, `background-image: url(...)`
- `border` (con `solid` único), `border-radius` (incluyendo per-corner)
- `box-shadow` (múltiples)
- `opacity`, `mix-blend-mode`, `filter: blur(Npx)`
- `font-family`, `font-size`, `font-weight`, `font-style`, `line-height`, `letter-spacing`
- `color`, `text-align`
- `var(--token-name, fallback)` en cualquier propiedad

**No soportado (warning si aparece):**
- `position: sticky`
- `transition`, `animation`
- `clip-path`, `mask`
- `display: table*`, `inline-flex`, `inline-grid`
- Pseudo-elementos `::before`, `::after`
- Pseudo-clases `:hover`, `:focus` (solo importa el estado base)

## 7. Manejo de IDs y estabilidad

- Shapes nuevos: UUID v7 generado en cliente (`build/shape-id.ts`).
- En `update_selection_from_html` con `preserveId: true`: heurística simple — reusamos el id raíz; los children siempre son nuevos. Ampliable a "match por estructura" en una iteración futura (hoy no compensa la complejidad).
- En `modify_shape`: el id viene como input, no se genera nada.

## 8. Concurrencia (revn)

Cada tool de escritura, internamente:

```ts
const { revn } = await getFileMeta(token, fileId)
const changes = build(...)
const result = await updateFile(token, { id: fileId, revn, sessionId, changes })
// Si 409 → throw; el agente decide
```

Sin cache de `revn` entre tools. Coste extra: una RPC por operación. Aceptable para el uso interactivo.

`sessionId` estable por proceso del MCP — Penpot lo usa para descartar tus propios eventos en el WS, no afecta a nuestro caso (estamos en REST puro).

## 9. Workflow examples

### "Créame un diseño para una tienda"

1. LLM llama `get_current_selection` → `{ fileId, pageId }`.
2. LLM diseña HTML+CSS:
   ```html
   <style>:root { --color-primary: #2e51c4; }</style>
   <header style="display: flex; padding: 16px; background: var(--color-primary, #2e51c4)">
     <img data-penpot-media-id="..." src="./logo.png" style="width: 32px; height: 32px"/>
     <h1 style="color: white; font: 700 24px Inter">Acme</h1>
   </header>
   ```
3. Si tiene imágenes locales: `upload_media({ paths: ['./logo.png'] })` → recibe IDs → los inserta como `data-penpot-media-id`.
4. Llama `create_design_from_html({ html, name: 'Store homepage' })`.
5. MCP renderiza, mide, sube tokens nuevos (`primary`), genera `add-obj[]`, manda `update-file`.
6. Usuario refresca el viewer en `localhost:3000`.

### "Modifica la cabecera seleccionada, aplica token primary al bg, aumenta el radius a 16"

1. LLM llama `get_current_selection` → `shapeId`.
2. LLM llama `modify_shape({ shapeId, ops: { fill: { tokenName: 'primary' }, radius: 16 } })`.
3. MCP envía 1 `mod-obj` con dos operations.

### "Créame un design system theme con primary, accent, fg, fg-light"

1. LLM llama `create_token_set({ setName: 'theme', tokens: [...] })`.
2. MCP envía `add-token-set` + `add-token[]`.

### "Cambia el copy del título a 'Hola Mundo'"

Si seleccionado un text shape: `modify_shape({ shapeId, ops: { text: 'Hola Mundo' } })` — el MCP genera el árbol `content` correcto preservando los estilos del primer leaf.

Si seleccionado el header completo: el LLM puede hacer `update_selection_from_html` con el HTML modificado, **o** detectar el text child y llamar `modify_shape` apuntando a él (preferido — más rápido y preserva el resto).

## 10. Plan por fases

| Fase | Alcance                                                                                                 | Tiempo estimado |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------- |
| 1    | Skeleton del paquete + measure pipeline + builder mínimo (frame+text+rect, sin layouts ni tokens) + tool `create_design_from_html` mínima + helpers REST (`getFileMeta`, `updateFile`) | 1-2 días        |
| 2    | Visual completo: fills (solid+gradient+image), strokes (3 alignments), radius per-corner, shadows múltiples, layout flex completo, layout grid, image upload + image shapes, `update_selection_from_html` | 2-3 días        |
| 3    | Tokens: extracción de `var()`, `create_token_set`, `apply_token`, persistencia en file (`add-token-set`+`add-token`), inyección de `:root` antes del headless render | 1-2 días        |
| 4    | Surgical: `modify_shape` con catálogo de ops mapeadas a `mod-obj`                                       | 1 día           |
| 5    | Components + variants (opcional v1)                                                                     | 2-3 días        |
| 6    | Pulido: round-trip tests, anonimización de fixtures, README, system prompt del MCP con el subset CSS    | 1-2 días        |

## 11. Tests

### Unit
- Cada `shapes/*` y `visual/*` del nuevo paquete con tests directos sobre `MeasuredNode` mockeado.
- `changes/builder.ts` con casos: añadir un frame, modificar fill, borrar subtree.

### Round-trip
- Fixture HTML simple → `htmlToChanges` → aplicar a una `Page` en memoria → `convertPage` (converter actual) → HTML resultante.
- Comparar **estructura DOM** (no pixel-exacto): mismo árbol semántico, mismos colores resueltos, mismos tokens aplicados.
- Esto valida que el subset CSS está alineado en ambos sentidos.

### Integration mock
- Servidor mock que valida la forma de los `changes` (schemas + ids consistentes + revn). Sin Penpot real.

### Smoke real
- `apps/mcp/scripts/smoke-write.mts`: crea un board minimal en un file de pruebas real con el token del usuario. Manual, no en CI.

### Anonimización
- Como pide el repo: si un test reproduce un bug de un diseño concreto, anonimizar (cambiar nombres, colores, textos).

## 12. Riesgos y open questions

- **Mapeo flex CSS ↔ Penpot auto-layout**: hay sutilezas (`align-self: stretch`, `flex: 1` con `min-width`, etc.). Necesita tests dedicados con fixtures que cubran las combinaciones que ya cubre el converter.
- **selrect/points exactos**: si el browser y Penpot redondean fracciones distinto, el preview puede diferir 1-2px. No bloqueante, pero documentar.
- **Texto con runs heterogéneos**: el modelo `content` de Penpot text es un árbol particular. Extraer desde DOM (con spans anidados, `<br>`, listas) no es trivial. Probable que necesite varias iteraciones — empezar con texto monocolor monofont y crecer.
- **Features flags en `update-file`**: usar las mismas que el converter (`design-tokens/v1`, `variants/v1`, `components/v2`, `styles/v2`, `fdata/objects-map`). Si Penpot espera un flag distinto en write, validarlo antes de Fase 1.
- **Components v2 + variants**: la estructura concreta de changes está documentada de forma dispersa (hay que leer el código Clojure). Bloquear hasta Fase 5 y dedicar investigación.
- **Token types más allá de `color`**: spacing/sizing/typography requieren resolución por atributo distinta al fill; v1 cubre solo color con seguridad.
- **Manejo de errores en upload de media**: si una imagen falla a mitad, ya hay otras subidas. v1 acepta media "huérfanos" en el file (Penpot los limpia con GC); en v2 podríamos rollback.

## 13. Cambios concretos al repo

```
NEW   packages/html-to-penpot/                        — todo el paquete nuevo
NEW   apps/mcp/src/tools/write/*                      — tools nuevas
EDIT  apps/mcp/src/penpot-api.ts                      — getFileMeta, updateFile, uploadFileMedia
EDIT  apps/mcp/src/index.ts                           — registerXxxTool() de las 7 nuevas tools
EDIT  apps/mcp/src/index.ts SERVER_INSTRUCTIONS       — añadir sección con el subset CSS y workflow de write
EDIT  pnpm-workspace.yaml                             — incluir html-to-penpot
EDIT  apps/mcp/README.md                              — documentar las write-tools
NEW   packages/html-to-penpot/CLAUDE.md               — arquitectura del paquete
EDIT  CLAUDE.md (root)                                — link al nuevo paquete
```

## 14. Definición de "hecho" para v1

- [ ] `create_design_from_html` crea un board con frames + texto + imágenes + tokens en un file real.
- [ ] `update_selection_from_html` reemplaza el subtree de la selección sin corromper el file.
- [ ] `modify_shape` cambia fill/radius/layout/text con un solo `mod-obj`.
- [ ] `create_token_set` + `apply_token` permiten crear y aplicar tokens de color.
- [ ] `upload_media` sube imágenes locales y devuelve IDs reusables.
- [ ] El `SERVER_INSTRUCTIONS` del MCP documenta el subset CSS y los workflows.
- [ ] Round-trip test pasa para 5+ fixtures (board simple, flex, grid, texto multilinea, tokens aplicados).
- [ ] Smoke real ejecutado contra design.penpot.app con el token del usuario.
