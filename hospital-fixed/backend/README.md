# Backend — Hospital Motor de Citas

## Requisitos
- Node.js 18+
- Cuenta en MongoDB Atlas (gratis en mongodb.com)

## Setup en 3 pasos

### 1. Instalar dependencias
```bash
cd backend
npm install
```

### 2. Configurar MongoDB Atlas
1. Entra a https://cloud.mongodb.com → crea un cluster gratis
2. Ve a **Database Access** → crea usuario con contraseña
3. Ve a **Network Access** → agrega tu IP (o 0.0.0.0/0 para desarrollo)
4. Ve a **Connect** → elige "Compass" → copia la URI
5. Copia `.env.example` como `.env` y pega la URI:
```
MONGODB_URI=mongodb+srv://tu_usuario:tu_password@cluster0.xxxxx.mongodb.net/hospital_db
```

### 3. Poblar la BD y arrancar
```bash
npm run seed    # Crea usuarios y datos de prueba
npm run dev     # Servidor en http://localhost:3000
```

## Endpoints disponibles

| Método | Ruta | Historia |
|--------|------|---------|
| POST   | /api/citas | HU16 + HU27 Agendar con validaciones |
| GET    | /api/citas?pacienteId=X | Listar citas |
| PATCH  | /api/citas/:id/cancelar | HU18 Cancelar |
| PATCH  | /api/citas/:id/reprogramar | HU19 Reprogramar |
| GET    | /api/health | Estado del servidor |
