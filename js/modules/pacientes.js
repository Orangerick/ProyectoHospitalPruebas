// js/modules/pacientes.js
import DB from '../core/db.js';

const PacientesModulo = {
    /**
     * HU9: Actualizar información del paciente
     */
    actualizarPaciente(pacienteId, datos) {
        const pIdx = DB.state.pacientes.findIndex(p => p.id === pacienteId);
        if (pIdx === -1) return false;
        
        const pacienteActual = DB.state.pacientes[pIdx];

        // Actualizamos el paciente ignorando el campo 'nombre' recibido en 'datos'
        // Actualizamos el paciente protegiendo el campo 'nombre' original
        const pacienteActualizado = {
            ...pacienteActual,
            email: datos.email || pacienteActual.email,
            telefono: datos.telefono || pacienteActual.telefono,
            direccion: datos.direccion || pacienteActual.direccion,
        };

        DB.state.pacientes[pIdx] = pacienteActualizado;

        // Sincronizar nombre en la cuenta de usuario
        // Nota: Solo sincronizamos email/tel si el usuario existe
        DB.update('usuarios', pacienteActual.usuarioId, { 
            email: datos.email,
            telefono: datos.telefono 
        });

        DB.save();
        DB.registrarLog('Edición Paciente', `Información actualizada para: ${pacienteActualizado.nombre}`);
        
        return pacienteActualizado;
    },

    /**
     * HU4: Actualizar específicamente la dirección del paciente
     * Garantiza que el nombre no sea modificado.
     */
    actualizarDireccion(pacienteId, nuevaDireccion) {
        const paciente = DB.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return false;

        // 1. Actualizar en colección de pacientes
        DB.update('pacientes', pacienteId, { direccion: nuevaDireccion });

        // 2. Sincronizar con la cuenta de usuario vinculada
        if (paciente.usuarioId) {
            DB.update('usuarios', paciente.usuarioId, { direccion: nuevaDireccion });
        }

        DB.save();
        DB.registrarLog('Edición Perfil (HU4)', `Dirección actualizada para: ${paciente.nombre}`);
        
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
