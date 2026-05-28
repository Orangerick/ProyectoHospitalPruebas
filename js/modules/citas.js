// js/modules/citas.js
import DB from '../core/db.js';
import { generarID } from '../core/utils.js';

/**
 * Gestión de Citas Automatizadas (Regla 6)
 */
const CitasModulo = {
    /**
     * Verifica si hay disponibilidad para una cita (HU27)
     * Regla: Ni el médico ni el paciente pueden tener otra cita confirmada en el mismo bloque.
     */
    validarDisponibilidad(medicoId, pacienteId, fecha, hora, citaIdOmitir = null) {
        return !DB.state.citas.some(c => 
            c.id !== citaIdOmitir &&
            c.fecha === fecha && 
            c.hora === hora &&
            c.estado !== 'cancelada' &&
            (c.medicoId === medicoId || c.pacienteId === pacienteId)
        );
    },

    /**
     * Agendamiento Directo (HU16, HU27)
     */
    agendarCita(datos) {
        // 1. Validar que la fecha no sea pasada (HU16)
        const hoy = new Date().toISOString().split('T')[0];
        if (datos.fecha < hoy) {
            throw new Error("No puedes agendar citas en fechas pasadas.");
        }
        
        // 2. Validar disponibilidad de ambos (HU27)
        if (!this.validarDisponibilidad(datos.medicoId, datos.pacienteId, datos.fecha, datos.hora)) {
            throw new Error("Horario no disponible: El médico o tú ya tienen una cita programada para esta hora.");
        }

        // 3. Crear la cita
        const nuevaCita = {
            id: generarID('cit'),
            pacienteId: datos.pacienteId,
            medicoId: datos.medicoId,
            fecha: datos.fecha,
            hora: datos.hora,
            motivo: datos.motivo,
            estado: 'confirmada',
            fechaCreacion: new Date().toISOString()
        };

        DB.add('citas', nuevaCita);
        DB.registrarLog('Cita Agendada', `Cita ${nuevaCita.id} creada para el ${datos.fecha}`);
        
        return nuevaCita;
    },

    /**
     * Reprogramar cita existente (HU19)
     */
    reprogramarCita(citaId, nuevaFecha, nuevaHora) {
        const hoy = new Date().toISOString().split('T')[0];
        if (nuevaFecha < hoy) {
            throw new Error("No puedes reprogramar citas para fechas pasadas.");
        }

        const cita = DB.state.citas.find(c => c.id === citaId);
        if (!cita) throw new Error("Cita no encontrada.");

        // Validar disponibilidad omitiendo la cita actual
        if (!this.validarDisponibilidad(cita.medicoId, cita.pacienteId, nuevaFecha, nuevaHora, citaId)) {
            throw new Error("El nuevo horario seleccionado no está disponible.");
        }

        DB.update('citas', citaId, { 
            fecha: nuevaFecha, 
            hora: nuevaHora,
            estado: 'confirmada' // Por si estaba en otro estado
        });

        DB.registrarLog('Cita Reprogramada', `Cita ${citaId} movida al ${nuevaFecha} ${nuevaHora}`);
    },

    /**
     * Cancelar cita (HU18)
     */
    cancelarCita(citaId) {
        DB.update('citas', citaId, { estado: 'cancelada' });
        DB.registrarLog('Cita Cancelada', `Se canceló la cita ID: ${citaId}`);
    }
};

export default CitasModulo;
