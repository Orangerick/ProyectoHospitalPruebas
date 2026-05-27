// js/modules/citas.js
import DB from '../core/db.js';
import { generarID } from '../core/utils.js';

/**
 * Gestión de Citas Automatizadas (Regla 6)
 */
const CitasModulo = {
    /**
     * Verifica si un médico tiene espacio en una fecha y hora específica
     */
    validarDisponibilidad(medicoId, fecha, hora) {
        return !DB.state.citas.some(c => 
            c.medicoId === medicoId && 
            c.fecha === fecha && 
            c.hora === hora &&
            c.estado !== 'cancelada'
        );
    },

    /**
     * Agendamiento Directo (Sin aprobación - Regla 6)
     */
    agendarCita(datos) {
        // datos: { pacienteId, medicoId, fecha, hora, motivo }
        
        // 1. Validar disponibilidad real
        if (!this.validarDisponibilidad(datos.medicoId, datos.fecha, datos.hora)) {
            throw new Error("El médico no está disponible en el horario seleccionado.");
        }

        // 2. Crear la cita
        const nuevaCita = {
            id: generarID('cit'),
            pacienteId: datos.pacienteId,
            medicoId: datos.medicoId,
            fecha: datos.fecha,
            hora: datos.hora,
            motivo: datos.motivo,
            estado: 'confirmada', // Automáticamente confirmada (Regla 6)
            fechaCreacion: new Date().toISOString()
        };

        DB.add('citas', nuevaCita);
        DB.registrarLog('Cita Agendada', `Paciente ${datos.pacienteId} agendó con Médico ${datos.medicoId} para el ${datos.fecha}`);
        
        return nuevaCita;
    },

    cancelarCita(citaId) {
        DB.update('citas', citaId, { estado: 'cancelada' });
        DB.registrarLog('Cita Cancelada', `Se canceló la cita ID: ${citaId}`);
    }
};

export default CitasModulo;
