# Dashboard Astro - Análisis de Rutas Marítimas

Esta es la migración de la aplicación Next.js a Astro para el análisis de rutas marítimas.

## Características

- ✅ **Procesamiento de archivos CSV** con datos GPS de barcos
- ✅ **Análisis de intervalos de navegación** (atracado, maniobrando, en tránsito)
- ✅ **Cálculo de distancias a puertos** (Algeciras, Ceuta, Tanger Med)
- ✅ **Gráficos interactivos** con Recharts
- ✅ **Componentes UI** con Radix UI + Tailwind CSS
- ✅ **Drag & Drop** para subir archivos
- ✅ **Análisis de rutas completas** entre puertos

## Instalación

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Construir para producción
npm run build
```

## Uso

1. Arrastra archivos CSV con datos GPS o haz clic para seleccionarlos
2. Haz clic en "Procesar Datos" para analizar los archivos
3. Explora los gráficos interactivos y análisis de navegación

## Estructura del Proyecto

```
src/
├── components/
│   ├── ui/           # Componentes UI básicos
│   ├── FileUploader.tsx
│   ├── LineChart.tsx
│   ├── NavigationAnalysis.tsx
│   └── CSVAnalyzer.tsx
├── hooks/
│   └── useCSVProcessor.ts
├── layouts/
│   └── Layout.astro
└── pages/
    └── index.astro
```

## Migración de Next.js

Esta aplicación fue migrada desde Next.js a Astro manteniendo:

- ✅ Toda la funcionalidad original
- ✅ Componentes React como "Astro Islands"
- ✅ Hooks y lógica de estado
- ✅ Estilos y diseño
- ✅ Gráficos interactivos

## Tecnologías

- **Astro** - Framework base
- **React** - Componentes interactivos
- **Recharts** - Gráficos
- **Radix UI** - Componentes UI
- **Tailwind CSS** - Estilos
- **TypeScript** - Tipado
