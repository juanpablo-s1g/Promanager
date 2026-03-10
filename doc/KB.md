# S1 Projects

Aplicación integral de gestión de proyectos con integración perfecta a S1 Analytics para seguimiento de casos omnicanal y colaboración de equipos.

## Funcionalidades

### **Gestión de Proyectos**
- Crear, editar y eliminar proyectos con asignación a equipos
- Seguimiento de estadísticas y progreso de proyectos en tiempo real
- Organización y filtrado de proyectos por equipos
- Métricas de finalización de proyectos y analíticas

### **Gestión de Tareas**
- Creación avanzada de tareas con gestión de estados (Pendiente, En Progreso, Finalizada)
- Asignación de tareas a proyectos específicos y equipos
- Finalización automática de tareas basada en resolución de casos de S1 Analytics
- Reportes de distribución de estados de tareas

### **Integración con S1 Analytics**
- **Sincronización en tiempo real** de casos con la plataforma S1 Analytics
- **Filtrado automático** de casos resueltos/eliminados usando API `case_state`
- **Configuración por defecto de CPG ID** (8322880) para acceso transparente a datos
- **Auto-finalización de tareas** cuando los casos S1 se resuelven
- **Sistema de filtrado avanzado** con 7 categorías de filtros:
  - Asunto (búsqueda de texto)
  - Nombre de Grupo
  - Asignado A
  - Clasificación
  - Trimestre
  - Estado del Caso
  - Estado de Tarea

### **Gestión de Equipos**
- **4 equipos preconfigurados**: Development, QA, DevOps, Frontend
- Organización de proyectos y tareas específica por equipos
- Analíticas y estadísticas de rendimiento por equipos
- Secciones de equipos colapsables para mejor organización

### **Reportes y Exportación**
- **Exportación a múltiples formatos**: Excel (XLSX), PDF, Word (DOCX)
- **Reportes integrales** que incluyen:
  - Resúmenes de proyectos con tasas de finalización
  - Métricas de rendimiento por equipos
  - Resúmenes de casos de S1 Analytics
  - Analíticas de distribución de tareas
- **Panel en tiempo real** con estadísticas interactivas

### **Experiencia de Usuario**
- **Interfaz moderna** con soporte para temas oscuro y claro
- **Diseño responsivo** para todos los tamaños de dispositivos
- **Barra lateral colapsible** para mejorar el espacio de trabajo
- **Actualizaciones en tiempo real** y componentes interactivos
- **Iconografía consistente** con Lucide React

## Limitaciones y Consideraciones

- **Conectividad requerida**: La integración con S1 Analytics requiere acceso a internet y clave API válida
- **Límites de exportación**: Los reportes muy extensos pueden tomar tiempo adicional para generar
- **Sincronización**: Los cambios en S1 Analytics pueden tardar hasta 30 segundos en reflejarse en la aplicación
- **Navegadores soportados**: Chrome, Firefox, Safari y Edge en versiones recientes
- **Base de datos local**: Utiliza SQLite para almacenamiento local, adecuado para equipos pequeños a medianos