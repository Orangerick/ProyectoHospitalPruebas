// backend/server.js
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import citasRoutes from './routes/citas.js';

const app = express();
app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/citas', citasRoutes);

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'conectado' : 'desconectado' }));

// Conexión a MongoDB Atlas
const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error('❌ ERROR: Falta MONGODB_URI en el archivo .env');
    process.exit(1);
}

mongoose.connect(MONGO_URI)
    .then(() => {
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
            console.log(`✅ MongoDB Atlas conectado`);
        });
    })
    .catch(err => {
        console.error('❌ Error conectando a MongoDB:', err.message);
        process.exit(1);
    });
