# S1 Projects - Manual de Usuario

## Descripción General

S1 Projects es una aplicación completa de gestión de proyectos que se integra directamente con S1 Analytics para proporcionar un seguimiento comprehensivo de casos omnicanal, organización de equipos, y generación automatizada de reportes.

## Características Principales

### 📋 Gestión de Proyectos
- **Creación y edición** de proyectos con descripciones detalladas
- **Asignación de equipos** con códigos de color personalizados
- **Seguimiento de progreso** con métricas automáticas
- **Filtrado avanzado** por equipos, estado y prioridad

### 👥 Gestión de Equipos
- **Equipos personalizables** con colores distintivos
- **Estadísticas por equipo** (proyectos totales, tareas completadas)
- **Vista de dashboard** con métricas de rendimiento
- **Asignación flexible** de proyectos y tareas

### ✅ Gestión de Tareas
- **Estados configurables**: Todo, In Progress, Done
- **Niveles de prioridad**: Low, Medium, High
- **Asignación individual** de responsables
- **Auto-completado** basado en resolución de casos S1

### 📊 Integración S1 Analytics
- **Sincronización automática** con casos de S1 Analytics
- **Filtrado avanzado** por 7 dimensiones:
  - Grupo (nombres reales, no IDs)
  - Asignado a
  - Clasificación
  - Canal
  - Quarter
  - Estado del caso
  - Estado de tarea
- **Creación automática** de tareas desde casos S1
- **Auto-completado inteligente** cuando casos se resuelven
- **Reportes exportables** (PDF, Word, Excel)

## Guía de Uso

### 1. Configuración Inicial

#### Variables de Entorno
Crea un archivo `.env` en el directorio raíz con:
```
S1_API_URL=https://tu-instancia-s1.com
S1_API_USER=tu_usuario
S1_API_PASSWORD=tu_contraseña
```

#### Instalación
```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:4100`

### 2. Gestión de Proyectos

#### Crear Nuevo Proyecto
1. Clic en **"New Project"**
2. Completar información:
   - **Name**: Nombre descriptivo del proyecto
   - **Description**: Descripción detallada (opcional)
   - **Team**: Seleccionar equipo del dropdown
3. Clic en **"Create Project"**

#### Editar Proyecto
1. Clic en el **ícono de editar** en la tarjeta del proyecto
2. Modificar información necesaria
3. **Guardar cambios**

#### Eliminar Proyecto
1. Clic en el **ícono de eliminar** (⚠️ acción irreversible)
2. Confirmar eliminación

### 3. Gestión de Equipos

#### Crear Equipo
1. Navegar a la pestaña **"Teams"**
2. Clic en **"New Team"**
3. Completar:
   - **Name**: Nombre del equipo
   - **Description**: Descripción (opcional)
   - **Color**: Seleccionar color identificativo
4. **Guardar**

#### Estadísticas de Equipos
Las métricas se calculan automáticamente:
- **Total Projects**: Proyectos asignados al equipo
- **Total Tasks**: Suma de todas las tareas
- **Completed Tasks**: Tareas finalizadas
- **Completion Rate**: Porcentaje de finalización

### 4. Gestión de Tareas

#### Crear Tarea Manual
1. Dentro de un proyecto, clic **"Add Task"**
2. Completar información:
   - **Title**: Título descriptivo
   - **Description**: Detalles de la tarea
   - **Assignee**: Responsable
   - **Priority**: Low/Medium/High
   - **Status**: Todo/In Progress/Done
3. **Crear tarea**

#### Crear Tarea desde Caso S1
1. Ir a **"S1 Analytics"**
2. Filtrar y encontrar el caso deseado
3. Clic en **"Add as Task"** junto al caso
4. Seleccionar proyecto destino
5. La tarea se crea automáticamente con información del caso

### 5. Integración S1 Analytics

#### Configuración de Conexión
1. En la pestaña **"S1 Analytics"**
2. Configurar parámetros de consulta:
   - **Date From**: Fecha inicio (obligatorio)
   - **Date To**: Fecha fin (opcional)
   - **Campaigns**: ID de campaña (por defecto: 8322880)
3. Clic **"Load S1 Cases"**

#### Uso de Filtros
La aplicación ofrece 7 filtros simultáneos:

**Filtros de Datos S1:**
- **Group**: Nombres de grupos (obtenidos vía group_cat API)
- **Assigned To**: Persona asignada al caso
- **Classification**: Clasificación del caso
- **Channel**: Canal de comunicación
- **Quarter**: Quarter fiscal
- **Case Status**: Estado del caso (obtenido vía cases_status_detail API)

**Filtros de Gestión de Tareas:**
- **Task Status**: Estado de la tarea asociada (Todo/In Progress/Done)
- **Subject**: Búsqueda en el asunto del caso

#### Auto-completado Inteligente
Cuando un caso en S1 Analytics cambia a estado resuelto:
1. El sistema **detecta automáticamente** el cambio
2. **Busca la tarea asociada** (creada previamente desde ese caso)
3. **Marca la tarea como "Done"** automáticamente
4. **Actualiza las métricas** de proyecto y equipo

Esto mantiene sincronizados los estados entre S1 Analytics y S1 Projects.

### 6. Generación de Reportes

#### Exportar Datos
1. Aplicar filtros deseados en S1 Analytics
2. Clic en **"Export Report"**
3. Seleccionar formato:
   - **PDF**: Reporte formateado para impresión
   - **Word**: Documento editable
   - **Excel**: Datos tabulares para análisis

#### Contenido de Reportes
Los reportes incluyen:
- **Resumen ejecutivo** con métricas clave
- **Tabla completa** de casos filtrados
- **Estadísticas por equipo** y clasificación
- **Gráficos de rendimiento** (solo PDF)
- **Fecha y hora** de generación

### 7. Navegación y UI

#### Sidebar Colapsible
- **Clic en hamburger menu** para contraer/expandir
- **Responsive**: Se adapta automáticamente en móviles
- **Persistente**: Recuerda estado entre sesiones

#### Estados Visuales
- **Badges de prioridad**: Low (gris), Medium (amarillo), High (rojo)
- **Estados de tarea**: Todo (gris), In Progress (azul), Done (verde)
- **Colores de equipo**: Personalizables por equipo
- **Indicadores de progreso**: Barras de progreso automáticas

#### Contadores Inteligentes
- **Casos activos**: Excluye casos resueltos de la vista
- **Total de casos**: Incluye todos para sincronización
- **Filtros avanzados**: "X of Y active cases" en tiempo real

## Aspectos Técnicos

### Arquitectura
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **Backend**: Express.js + SQLite (better-sqlite3)
- **Integración**: S1 Analytics API con autenticación Bearer
- **Build**: Vite con plugins optimizados

### APIs S1 Analytics Utilizadas
- **cases_detail**: Datos básicos de casos
- **case_tags_detail**: Tags y clasificaciones
- **group_cat**: Nombres de grupos (requiere parámetro campaigns)
- **cases_status_detail**: Estados de casos

### Flujo de Sincronización
1. **Obtención de datos**: Múltiples APIs S1 en paralelo
2. **Cruce de información**: Mapeo de IDs a nombres descriptivos
3. **Filtrado inteligente**: Backend mantiene todos, frontend filtra vista
4. **Auto-completado**: Detecta cambios de estado y actualiza tareas
5. **Persistencia**: SQLite para datos locales y asociaciones

## Solución de Problemas

### Problemas Comunes

**No aparecen casos de S1 Analytics:**
- Verificar credenciales en archivo `.env`
- Confirmar conectividad con instancia S1
- Revisar formato de fechas (YYYY-MM-DD HH:mm:ss)
- Asegurar que parámetro `campaigns` es correcto

**Los nombres de grupos aparecen como números:**
- Confirmar que parámetro `campaigns` está configurado
- Verificar permisos para acceder a group_cat API
- Revisar logs del servidor para errores de API

**Auto-completado no funciona:**
- Confirmar que la tarea se creó desde un caso S1
- Verificar que el caso realmente cambió a estado resuelto
- Revisar conexión con cases_status_detail API

**Problemas de rendimiento:**
- Reducir rango de fechas en consultas
- Usar paginación para grandes volúmenes
- Optimizar filtros para reducir datos procesados

### Logs de Debug
Los logs del servidor proporcionan información detallada sobre:
- Llamadas a APIs S1 Analytics
- Mapeo de grupos y estados
- Proceso de auto-completado
- Errores de conectividad

## Contacto y Soporte

Para soporte técnico o consultas sobre funcionalidades, contactar al equipo de desarrollo S1.

---

**Versión**: v2026.3.1.0  
**Última actualización**: Marzo 2026  
**Compatibilidad**: S1 Platform v2026.x