# 🚀 Guía de Deploy — CajaChica Flow

## Pre-requisitos
- Cuenta Google (lyanezliu2005@gmail.com) ✅
- Git instalado ✅
- Node.js instalado ✅

---

## PASO 1 — Crear proyecto Firebase (5 min)

1. Ve a https://console.firebase.google.com
2. Click **"Agregar proyecto"**
3. Nombre: `cajachica-flow`
4. Desactiva Google Analytics (no es necesario)
5. Click **"Crear proyecto"**

### Activar servicios:
- **Authentication**: Build → Authentication → Comenzar → Email/contraseña → Habilitar
- **Firestore**: Build → Firestore Database → Crear base de datos → Modo producción → us-central1
- **Storage**: Build → Storage → Comenzar → Modo producción
- **Functions**: Build → Functions → Comenzar (requiere plan Blaze — es gratis hasta límites altos)

### Obtener config web:
- Configuración del proyecto (⚙️) → Tus apps → Agregar app → Web
- Copia los valores de `firebaseConfig`

---

## PASO 2 — Crear repositorio GitHub (3 min)

1. Ve a https://github.com/new
2. Nombre: `cajachica-flow`
3. Privado o público (tú decides)
4. **NO** inicialices con README
5. Click **"Create repository"**

---

## PASO 3 — Subir código (desde Git Bash)

```bash
cd cajachica-flow
git init
git add .
git commit -m "feat: CajaChica Flow inicial"
git branch -M main
git remote add origin https://github.com/lyanezliu2005/cajachica-flow.git
git push -u origin main
```

---

## PASO 4 — Configurar GitHub Secrets

En GitHub → tu repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor |
|--------|-------|
| `FIREBASE_API_KEY` | Tu apiKey de Firebase |
| `FIREBASE_AUTH_DOMAIN` | cajachica-flow.firebaseapp.com |
| `FIREBASE_PROJECT_ID` | cajachica-flow |
| `FIREBASE_STORAGE_BUCKET` | cajachica-flow.appspot.com |
| `FIREBASE_MESSAGING_SENDER_ID` | Tu messagingSenderId |
| `FIREBASE_APP_ID` | Tu appId |
| `FIREBASE_SERVICE_ACCOUNT` | Ver paso 4b |

### 4b — Obtener Service Account JSON:
1. Firebase Console → Configuración del proyecto → Cuentas de servicio
2. Click **"Generar nueva clave privada"**
3. Copia todo el contenido del JSON descargado
4. Pégalo como valor del secret `FIREBASE_SERVICE_ACCOUNT`

---

## PASO 5 — Deploy automático ✅

Cada vez que hagas `git push origin main`, GitHub Actions:
1. Construye el frontend Next.js (PWA)
2. Compila las Cloud Functions
3. Hace deploy a Firebase automáticamente

Tu app estará en: **https://cajachica-flow.web.app**

---

## PASO 6 — Registrar primera empresa

1. Ve a https://cajachica-flow.web.app/auth/register
2. Ingresa los datos de tu empresa
3. ¡Listo! Ya puedes invitar usuarios desde el panel de administración

---

## Estructura de roles

| Rol | Puede hacer |
|-----|-------------|
| `employee` | Crear y ver sus propias solicitudes |
| `approver` | Aprobar/rechazar solicitudes de su área |
| `finance` | Aprobar etapa financiera + reportes |
| `admin` | Todo lo anterior + gestión de usuarios y configuración |
| `superadmin` | Gestión de todos los tenants |

---

## URLs de la app
- **Login**: /auth/login
- **Registro empresa**: /auth/register  
- **Dashboard**: /dashboard
- **Mis gastos**: /expenses
- **Nueva solicitud**: /expenses/nueva
- **Administración**: /admin
