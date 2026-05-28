import mongoose from 'mongoose';
const medicoSchema = new mongoose.Schema({
    usuarioId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    cedula:       { type: String, required: true, unique: true },
    especialidad: { type: String, required: true },
    email:        { type: String, required: true },
    telefono:     { type: String },
    activo:       { type: Boolean, default: true }
}, { timestamps: true });
export default mongoose.model('Medico', medicoSchema);
