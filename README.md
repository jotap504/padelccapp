# PádelCC - Sistema de Gestión de Pádel

Sistema multi-tenant de ranking y gestión de partidos para clubes de pádel, con soporte para 8 categorías, importación CSV, y sistema de validación semi-manual.

## 🚀 Características Principales

- **🏛️ Multi-tenant**: Soporte para múltiples clubes con aislamiento completo de datos
- **📊 Ranking ELO**: Sistema de 8 categorías (1ra-8va) con varianza leve y cálculo por equipo
- **🔐 Autenticación dual**: Login con UUID del sistema o número de socio
- **📥 Importación CSV**: Carga masiva de jugadores desde archivo CSV
- **🎾 Drive/Revés**: Registro de posición preferida y lado jugado por partido
- **✅ Validación ágil**: Semi-manual (1 confirmación por equipo = 2 total)
- **📱 Notificaciones**: Soporte para WhatsApp, Push y Email
- **🏆 Intercountry**: Gestión de torneos entre clubes (6-8 equipos, round-robin)

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Frontend** | Next.js 14 + TypeScript + TailwindCSS |
| **UI Components** | shadcn/ui |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |
| **Estado** | TanStack Query |
| **Auth** | JWT custom con bcrypt |
| **Deploy** | Vercel |

## 📋 Requisitos Previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)
- npm

## 🚀 Instalación Rápida

### 1. Clonar y configurar

```bash
# Instalar dependencias
npm install
```

### 2. Configurar Supabase

1. Crear proyecto en [Supabase Dashboard](https://app.supabase.com)
2. Ir a **Project Settings > API**
3. Copiar:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `Project API keys > anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Crear archivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Ejecutar Schema SQL

1. Ir a **SQL Editor** en Supabase Dashboard
2. Crear nueva query
3. Copiar y ejecutar todo el contenido de `supabase/migrations/001_initial_schema.sql`
4. Verificar que las tablas se crearon correctamente

### 4. Crear club de ejemplo

```sql
INSERT INTO public.clubs (name, slug) 
VALUES ('Club Demo', 'demo-club');
```

### 5. Ejecutar localmente

```bash
npm run dev
```

Abrir [http://localhost:3000/login](http://localhost:3000/login)

## 📖 Guía de Uso

### Importar jugadores (Admin)

1. Ir a `/admin/import`
2. Ingresar `demo-club` como ID del club
3. Subir archivo CSV con formato:
   ```csv
   nombre,sexo,numero_socio
   Juan Perez,M,12345
   Maria Garcia,F,12346
   ```
4. Validar y confirmar importación

**Notas:**
- Contraseña por defecto para todos: `100`
- Los jugadores deben elegir su categoría (1ra-8va) en el primer login
- Sexo: `M` (masculino) o `F` (femenino)

### Login de jugadores

- **Página**: `/login`
- **Club**: `demo-club`
- **Usuario**: Número de socio (ej: `12345`) o UUID
- **Contraseña**: `100` (por defecto)

### Completar perfil (Primer login)

1. Elegir categoría inicial (1ra a 8va)
2. Opcional: completar email, teléfono, preferencia de lado (drive/revés), diestro/zurdo
3. Guardar y acceder al dashboard

## 🗄️ Estructura del Proyecto

```
padelcc/
├── app/
│   ├── login/              # Página de login
│   ├── dashboard/          # Dashboard principal
│   ├── admin/import/       # Panel de importación CSV
│   ├── ranking/            # Ranking general
│   ├── matches/            # Gestión de partidos
│   └── profile/            # Perfil del jugador
├── lib/
│   ├── auth/               # Autenticación y contexto
│   │   ├── AuthContext.tsx
│   │   └── password.ts
│   └── supabase/           # Cliente Supabase
│       ├── client.ts
│       └── middleware.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Schema completo
├── components/             # Componentes UI (shadcn)
└── README.md
```

## 🗃️ Modelo de Datos Principal

### Características Técnicas del Jugador

- `handedness`: diestro / zurdo
- `preferred_side`: drive / revés / ambos
- `category`: 1-8 (derivado del rating)
- `rating`: ELO score
- `ranking_confidence`: partidos jugados (estabilidad del ranking)

## 🧮 Sistema de Ranking

### Rating Inicial por Categoría

| Categoría | Rating Inicial | Rango Estable |
|-----------|----------------|---------------|
| 1ra | 1400 | ≥1300 |
| 2da | 1250 | 1150-1299 |
| 3ra | 1100 | 1000-1149 |
| 4ta | 950 | 875-999 |
| 5ta | 850 | 775-874 |
| 6ta | 750 | 675-774 |
| 7ma | 650 | 575-674 |
| 8va | 550 | <575 |

## 🔐 Sistema de Autenticación

### Login Dual

Los jugadores pueden iniciar sesión con:
1. **ID único del sistema** (UUID)
2. **Número de socio** (importado desde CSV)

### Seguridad

- Contraseñas hasheadas con bcrypt (10 rounds)
- Sesiones JWT en localStorage
- RLS para aislamiento multi-tenant

## 🚀 Deploy en Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

## 📄 Licencia

MIT © 2024

