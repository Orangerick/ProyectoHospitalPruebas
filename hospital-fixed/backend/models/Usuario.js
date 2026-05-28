import mongoose from 'mongoose';
const usuarioSchema = new mongoose.Schema({
    email:           { type: String, required: true, unique: true, lowercase: true },
    pass:            { type: String, required: true },
    rol:             { type: String, enum: ['admin', 'medico', 'paciente'], required: true },
    nombre:          { type: String, required: true },
    telefono:        { type: String },
    activo:          { type: Boolean, default: true },
    intentosFallidos:{ type: Number, default: 0 },
    bloqueado:       { type: Boolean, default: false }
}, { timestamps: true });
export default mongoose.model('Usuario', usuarioSchema);
