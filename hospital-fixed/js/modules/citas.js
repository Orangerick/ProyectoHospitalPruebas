// js/modules/citas.js
import DB from '../core/db.js';
import { generarID } from '../core/utils.js';

/**
 * Gestión de Citas Automatizadas (Regla 6)
 */
const CitasModulo = {

    /**
     * Verifica si hay disponibilidad para una cita (HU27)
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
        // BUG CRÍTICO CORREGIDO #3: Validación de campos vacíos.
        // Sin esto, se podía crear una cita sin hora, corrompiendo la BD.
        if (!datos.medicoId || !datos.pacienteId || !datos.fecha || !datos.hora || !datos.motivo) {
            throw new Error("Todos los campos son obligatorios para agendar una cita.");
        }

        // 1. Validar que la fecha no sea pasada (HU16)
        const hoy = new Date().toISOString().split('T')[0];
        if (datos.fecha < hoy) {
            throw new Error("No puedes agendar citas en fechas pasadas.");
        }

        // 2. Validar disponibilidad (HU27)
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
        DB.registrarLog('Cita Agendada', `Cita ${nuevaCita.id} creada para el ${datos.fecha} a las ${datos.hora}`);
        return nuevaCita;
    },

    /**
     * Reprogramar cita existente (HU19)
     */
    reprogramarCita(citaId, nuevaFecha, nuevaHora) {
        // BUG CRÍTICO CORREGIDO #3 (mismo patrón): validar hora en reprogramar
        if (!nuevaFecha || !nuevaHora) {
            throw new Error("Debes seleccionar una nueva fecha y hora para reprogramar.");
        }

        const hoy = new Date().toISOString().split('T')[0];
        if (nuevaFecha < hoy) {
            throw new Error("No puedes reprogramar citas para fechas pasadas.");
        }

        const cita = DB.state.citas.find(c => c.id === citaId);
        if (!cita) throw new Error("Cita no encontrada.");

        // BUG CRÍTICO CORREGIDO #4: No se puede reprogramar una cita cancelada
        if (cita.estado === 'cancelada') {
            throw new Error("No se puede reprogramar una cita que ya fue cancelada.");
        }

        if (!this.validarDisponibilidad(cita.medicoId, cita.pacienteId, nuevaFecha, nuevaHora, citaId)) {
            throw new Error("El nuevo horario seleccionado no está disponible.");
        }

        DB.update('citas', citaId, {
            fecha: nuevaFecha,
            hora: nuevaHora,
            estado: 'confirmada'
        });

        DB.registrarLog('Cita Reprogramada', `Cita ${citaId} movida al ${nuevaFecha} ${nuevaHora}`);
    },

    /**
     * Cancelar cita (HU18)
     */
    cancelarCita(citaId) {
        // BUG CRÍTICO CORREGIDO #4: Validar que la cita existe y no está ya cancelada
        const cita = DB.state.citas.find(c => c.id === citaId);
        if (!cita) throw new Error("Cita no encontrada.");
        if (cita.estado === 'cancelada') throw new Error("Esta cita ya fue cancelada anteriormente.");

        DB.update('citas', citaId, { estado: 'cancelada' });
        DB.registrarLog('Cita Cancelada', `Se canceló la cita ID: ${citaId}`);
    }
};

export default CitasModulo;
