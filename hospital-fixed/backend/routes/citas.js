// backend/routes/citas.js
import { Router } from 'express';
import Cita from '../models/Cita.js';

const router = Router();

// HU16 + HU27: POST /api/citas
router.post('/', async (req, res) => {
    try {
        const { pacienteId, medicoId, fecha, hora, motivo } = req.body;

        if (!pacienteId || !medicoId || !fecha || !hora || !motivo)
            return res.status(400).json({ error: 'Todos los campos son obligatorios.' });

        // HU16: fecha no puede ser pasada
        const hoy = new Date().toISOString().split('T')[0];
        if (fecha < hoy)
            return res.status(400).json({ error: 'No puedes agendar citas en fechas pasadas.' });

        // HU27: disponibilidad del médico
        const conflictoMedico = await Cita.findOne({ medicoId, fecha, hora, estado: 'confirmada' });
        if (conflictoMedico)
            return res.status(409).json({ error: 'El médico no está disponible en ese horario.' });

        // HU27: disponibilidad del paciente
        const conflictoPaciente = await Cita.findOne({ pacienteId, fecha, hora, estado: 'confirmada' });
        if (conflictoPaciente)
            return res.status(409).json({ error: 'Ya tienes una cita agendada en ese horario.' });

        const nuevaCita = await Cita.create({ pacienteId, medicoId, fecha, hora, motivo });
        res.status(201).json(nuevaCita);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/citas?pacienteId=X&medicoId=Y
router.get('/', async (req, res) => {
    try {
        const filtro = {};
        if (req.query.pacienteId) filtro.pacienteId = req.query.pacienteId;
        if (req.query.medicoId)   filtro.medicoId   = req.query.medicoId;
        const citas = await Cita.find(filtro).sort({ fecha: 1, hora: 1 });
        res.json(citas);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// HU18: PATCH /api/citas/:id/cancelar
router.patch('/:id/cancelar', async (req, res) => {
    try {
        const cita = await Cita.findById(req.params.id);
        if (!cita)                       return res.status(404).json({ error: 'Cita no encontrada.' });
        if (cita.estado === 'cancelada') return res.status(400).json({ error: 'Esta cita ya fue cancelada.' });
        cita.estado = 'cancelada';
        await cita.save();
        res.json({ mensaje: 'Cita cancelada correctamente.', cita });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// HU19: PATCH /api/citas/:id/reprogramar
router.patch('/:id/reprogramar', async (req, res) => {
    try {
        const { nuevaFecha, nuevaHora } = req.body;
        if (!nuevaFecha || !nuevaHora)
            return res.status(400).json({ error: 'Debes enviar nuevaFecha y nuevaHora.' });

        const hoy = new Date().toISOString().split('T')[0];
        if (nuevaFecha < hoy)
            return res.status(400).json({ error: 'No puedes reprogramar para fechas pasadas.' });

        const cita = await Cita.findById(req.params.id);
        if (!cita)                       return res.status(404).json({ error: 'Cita no encontrada.' });
        if (cita.estado === 'cancelada') return res.status(400).json({ error: 'No se puede reprogramar una cita cancelada.' });

        const conflicto = await Cita.findOne({
            medicoId: cita.medicoId, fecha: nuevaFecha, hora: nuevaHora,
            estado: 'confirmada', _id: { $ne: cita._id }
        });
        if (conflicto)
            return res.status(409).json({ error: 'El médico no está disponible en el nuevo horario.' });

        cita.fecha  = nuevaFecha;
        cita.hora   = nuevaHora;
        cita.estado = 'confirmada';
        await cita.save();
        res.json({ mensaje: 'Cita reprogramada correctamente.', cita });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

export default router;
