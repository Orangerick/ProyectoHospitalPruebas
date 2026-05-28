import mongoose from 'mongoose';
const pacienteSchema = new mongoose.Schema({
    usuarioId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    nombre:     { type: String, required: true },
    email:      { type: String, required: true },
    telefono:   { type: String },
    direccion:  { type: String },
    activo:     { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('Paciente', pacienteSchema);
