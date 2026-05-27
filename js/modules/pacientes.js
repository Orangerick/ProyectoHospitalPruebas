// js/modules/pacientes.js
import DB from '../core/db.js';

const PacientesModulo = {
    /**
     * HU9: Actualizar información del paciente
     */
    actualizarPaciente(pacienteId, datos) {
        const paciente = DB.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return false;
        
        DB.update('pacientes', pacienteId, {
            nombre: datos.nombre,
            email: datos.email,
            telefono: datos.telefono,
            direccion: datos.direccion,
            edad: datos.edad
        });

        // Sincronizar nombre en la cuenta de usuario
        DB.update('usuarios', paciente.usuarioId, { nombre: datos.nombre });

        DB.registrarLog('Edición Paciente', `Información actualizada para: ${datos.nombre}`);
        return true;
    },

    /**
     * Regla 5: Desactivar paciente sin borrar historial
     */
    toggleEstado(pacienteId) {
        const paciente = DB.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return;
        const nuevoEstado = !paciente.activo;

        DB.update('pacientes', pacienteId, { activo: nuevoEstado });
        DB.update('usuarios', paciente.usuarioId, { activo: nuevoEstado });

        DB.registrarLog('Cambio Estado Paciente', `Paciente ${paciente.nombre} ${nuevoEstado ? 'Activado' : 'Desactivado'}`);
    }
};

export default PacientesModulo;
