import mongoose from 'mongoose';
const citaSchema = new mongoose.Schema({
    // Usamos String para compatibilidad con los IDs del frontend (ej: 'pac_test', 'med_test')
    pacienteId: { type: String, required: true },
    medicoId:   { type: String, required: true },
    fecha:      { type: String, required: true },
    hora:       { type: String, required: true },
    motivo:     { type: String, required: true },
    estado:     { type: String, enum: ['confirmada', 'cancelada'], default: 'confirmada' }
}, { timestamps: true });
citaSchema.index({ medicoId: 1, fecha: 1, hora: 1 });
export default mongoose.model('Cita', citaSchema);
