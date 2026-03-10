# S1 Projects - TODO

## Funcionalidades Pendientes

### Integraciones
- [ ] Integración con más APIs de S1 (mensajes, notificaciones)
- [ ] Soporte para múltiples CPG IDs simultáneos
- [ ] Autenticación de usuarios con S1 Gateway

### Mejoras de UI/UX
- [ ] Drag & drop para reorganizar tareas
- [ ] Notificaciones push para cambios en casos S1
- [ ] Vista de calendario para fechas de vencimiento de proyectos
- [ ] Modo offline con sincronización posterior

### Reportes y Analíticas
- [ ] Gráficos avanzados con Chart.js o D3
- [ ] Exportación programada (scheduler)
- [ ] Dashboards personalizables por usuario
- [ ] Métricas de productividad por tiempo

### Rendimiento y Escalabilidad
- [ ] Migración a PostgreSQL para equipos grandes
- [ ] Implementación de caché Redis
- [ ] Optimización de consultas grandes de S1 Analytics
- [ ] Lazy loading para tablas extensas

### Seguridad
- [ ] Autenticación basada en roles
- [ ] Audit logs para cambios críticos
- [ ] Encriptación de datos sensibles
- [ ] Rate limiting para APIs

### DevOps y Deployment
- [ ] Dockerfile para contenedorización
- [ ] Pipeline CI/CD con GitHub Actions
- [ ] Tests automatizados (Jest/Vitest)
- [ ] Monitoreo y logging estructura

## Bugs Conocidos

- [ ] Las exportaciones muy grandes pueden causar timeout
- [ ] Filtros múltiples no se persisten al recargar página
- [ ] El tema oscuro no se aplica correctamente en algunos modales

## Mejoras Técnicas

- [ ] Refactor del servidor a arquitectura modular
- [ ] Implementar TypeScript estricto en backend
- [ ] Migrar de SQLite a ORM (Prisma/TypeORM)
- [ ] Implementar testing unitario y de integración