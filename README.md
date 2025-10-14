# Dashboard Project

Dashboard interactivo para análisis de datos de navegación marítima mediante archivos CSV.

## 📋 Descripción

Este proyecto es una aplicación web desarrollada con Astro que permite cargar, procesar y visualizar datos de navegación marítima a través de archivos CSV. Ofrece análisis detallados de rutas, actividades portuarias y estadísticas de navegación mediante gráficos interactivos.

## ✨ Características

- **Carga de archivos CSV**: Sistema de drag & drop para cargar múltiples archivos CSV
- **Análisis de navegación**: Visualización de rutas completas entre puertos
- **Gráficos interactivos**: Gráficos de líneas y de tarta para análisis visual
- **Estadísticas detalladas**: Análisis por trayectos y actividades portuarias
- **Cálculo de distancias**: Distancias automáticas a puertos (Algeciras, Ceuta, Tánger Med)
- **Análisis de intervalos**: Clasificación de estados (atracado, maniobrando, en tránsito)
- **Interfaz responsiva**: Diseño adaptable a diferentes dispositivos
- **Tema oscuro**: Interfaz moderna con paleta de colores oscura

## 🚀 Tecnologías

- **[Astro 5](https://astro.build/)** - Framework web moderno
- **[React 18](https://react.dev/)** - Componentes interactivos
- **[TypeScript](https://www.typescriptlang.org/)** - Tipado estático
- **[Tailwind CSS](https://tailwindcss.com/)** - Framework de CSS
- **[Recharts](https://recharts.org/)** - Biblioteca de gráficos
- **[Radix UI](https://www.radix-ui.com/)** - Componentes de UI accesibles
- **[Lucide React](https://lucide.dev/)** - Iconos
- **[Vercel Adapter](https://docs.astro.build/en/guides/integrations-guide/vercel/)** - Despliegue en Vercel

## 📦 Instalación

1. Clona el repositorio:
```bash
git clone https://github.com/Drossi97/Dashboard-Project.git
cd Dashboard-Project
```

2. Instala las dependencias (usando pnpm):
```bash
pnpm install
```

3. Ejecuta el servidor de desarrollo:
```bash
pnpm dev
```

4. Abre [http://localhost:4321](http://localhost:4321) en tu navegador.

## 🎯 Uso

1. **Cargar archivos CSV**: Arrastra y suelta archivos CSV en la zona de carga o haz clic para seleccionarlos
2. **Procesar datos**: Haz clic en "Procesar Datos" para analizar los archivos
3. **Visualizar**: Explora los diferentes paneles de análisis:
   - **Gráfico de líneas**: Visualiza datos temporales con zoom interactivo
   - **Estadísticas de navegación completa**: Análisis global de todas las actividades
   - **Estadísticas por trayectos**: Análisis detallado de cada ruta individual

## 📝 Formato de archivos CSV

Los archivos CSV deben contener las siguientes columnas:
- Información de fecha y hora
- Coordenadas de ubicación (latitud, longitud)
- Estado de navegación
- Información de puertos
- Velocidad y duración

## 🏗️ Estructura del Proyecto

```
src/
├── components/
│   ├── ui/                      # Componentes UI básicos (Radix UI)
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   └── scroll-area.tsx
│   ├── FileUploader.tsx         # Componente de carga de archivos
│   ├── LineChart.tsx            # Gráfico de líneas interactivo
│   ├── NavigationAnalysis.tsx   # Análisis de navegación
│   └── CSVAnalyzer.tsx          # Procesador principal de CSV
├── hooks/
│   └── useCSVProcessor.ts       # Hook para procesamiento de datos
├── layouts/
│   └── Layout.astro             # Layout principal
├── lib/
│   └── utils.ts                 # Utilidades
└── pages/
    └── index.astro              # Página principal
```

## 📜 Scripts disponibles

- `pnpm dev` - Inicia el servidor de desarrollo en http://localhost:4321
- `pnpm build` - Genera el build de producción
- `pnpm preview` - Previsualiza el build de producción
- `pnpm astro` - Ejecuta comandos de Astro CLI

## 🌐 Despliegue

Este proyecto está configurado para desplegarse en [Vercel](https://vercel.com/) con el adaptador oficial de Astro.

### Despliegue automático

1. Conecta tu repositorio de GitHub a Vercel
2. Vercel detectará automáticamente que es un proyecto Astro
3. El despliegue se realizará automáticamente en cada push a la rama `main`

### Variables de entorno

No se requieren variables de entorno especiales para este proyecto.

## 🔄 Migración desde Next.js

Esta aplicación fue originalmente desarrollada en Next.js y posteriormente migrada a Astro manteniendo:

- ✅ Toda la funcionalidad original
- ✅ Componentes React como "Astro Islands"
- ✅ Hooks y lógica de estado
- ✅ Estilos y diseño
- ✅ Gráficos interactivos

## 📄 Licencias de Terceros

Este proyecto utiliza las siguientes bibliotecas de código abierto:

### Recharts

Este proyecto utiliza [Recharts](https://recharts.org/), una biblioteca de gráficos construida con React y D3.

**The MIT License (MIT)**

Copyright (c) 2015-2024 Recharts Group

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Otras bibliotecas

Este proyecto también utiliza otras bibliotecas de código abierto bajo licencia MIT:
- Astro (Copyright © Astro Technology Company)
- React (Copyright © Meta Platforms, Inc.)
- Tailwind CSS (Copyright © Tailwind Labs, Inc.)
- Radix UI (Copyright © WorkOS)
- Lucide Icons (Copyright © Lucide Contributors)

Todas las licencias completas se pueden encontrar en sus respectivos paquetes en `node_modules`.

## 👨‍💻 Autor

**David Rossi** - [Drossi97](https://github.com/Drossi97)

## 🔗 Enlaces

- **Repositorio**: [https://github.com/Drossi97/Dashboard-Project](https://github.com/Drossi97/Dashboard-Project)
- **Documentación de Astro**: [https://docs.astro.build](https://docs.astro.build)

## ⚠️ Estado del Proyecto

Este proyecto está en fase de desarrollo activo. Algunas características pueden estar en pruebas o sujetas a cambios.

---

Desarrollado con ❤️ usando Astro y React