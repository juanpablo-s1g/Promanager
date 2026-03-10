# Public Assets

Esta carpeta contiene los recursos estáticos que se sirven directamente desde la raíz de la aplicación.

## Logo S1

**Archivo**: `s1_logo.png`
- **Ubicación**: `/public/s1_logo.png`
- **Uso**: 
  - Favicon de la aplicación (en `<head>`)
  - Logo principal en el header/sidebar
  - Accesible desde la aplicación en `/s1_logo.png`

### Implementado en:
- ✅ **Favicon**: `index.html` - `<link rel="icon" type="image/png" href="/s1_logo.png" />`
- ✅ **Header principal**: `src/App.tsx` - `<img src="/s1_logo.png" alt="S1 Logo" className="w-6 h-6 object-contain" />`

### Características técnicas:
- **Formato**: PNG con transparencia
- **Tamaño de visualización**: 24x24px (w-6 h-6 en Tailwind)
- **Clase CSS**: `object-contain` para mantener proporciones
- **Accesibilidad**: Alt text "S1 Logo"

Para actualizar el logo, simplemente reemplaza el archivo `s1_logo.png` con la nueva versión manteniendo el mismo nombre.