// js/modules/medicos.js
import DB from '../core/db.js';
import { generarID, hashPwd, validarCedula } from '../core/utils.js';

/**
 * Lógica de Negocio para Médicos (Exclusivo Admin)
 */
const MedicosModulo = {
    /**
     * Registro Integral (Regla 4)
     */
    registrarMedico(datos) {
        if (!validarCedula(datos.cedula)) throw new Error("Cédula profesional inválida.");
        
        // Verificar si el usuario ya existe
        if (DB.state.usuarios.find(u => u.user === datos.user)) throw new Error("El nombre de usuario ya existe.");

        const userId = generarID('doc_u');
        
        // 1. Crear la cuenta de acceso
        const nuevoUsuario = {
            id: userId,
            user: datos.user,
            pass: hashPwd(datos.pass),
            rol: 'medico',
            nombre: datos.nombre,
            activo: true
        };

        // 2. Crear el perfil profesional (Regla 4)
        const nuevoPerfil = {
            id: generarID('med_p'),
            usuarioId: userId,
            cedula: datos.cedula,
            especialidadId: parseInt(datos.especialidadId),
            email: datos.email,
            activo: true
        };

        DB.add('usuarios', nuevoUsuario);
        DB.add('medicos', nuevoPerfil);
        DB.registrarLog('Alta Médico', `Admin creó médico: ${datos.nombre} [Cédula: ${datos.cedula}]`);
        
        return true;
    },

    /**
     * Actualización de Información (HU14 / Regla 5)
     */
    actualizarMedico(medicoId, nuevosDatos) {
        const medico = DB.state.medicos.find(m => m.id === medicoId);
        if (!medico) return false;

        // Actualizar perfil
        DB.update('medicos', medicoId, {
            especialidadId: parseInt(nuevosDatos.especialidadId),
            cedula: nuevosDatos.cedula,
            email: nuevosDatos.email
        });

        // Actualizar nombre en la tabla de usuarios si cambió
        DB.update('usuarios', medico.usuarioId, { nombre: nuevosDatos.nombre });

        DB.registrarLog('Edición Médico', `Se actualizó información del médico ID: ${medicoId}`);
        return true;
    },

    /**
     * Desactivación de disponibilidad (Regla 5)
     */
    toggleEstado(medicoId) {
        const medico = DB.state.medicos.find(m => m.id === medicoId);
        if (!medico) return;
        const nuevoEstado = !medico.activo;
        
        DB.update('medicos', medicoId, { activo: nuevoEstado });
        // También desactivamos su acceso al sistema
        DB.update('usuarios', medico.usuarioId, { activo: nuevoEstado });

        DB.registrarLog('Cambio Estado Médico', `Médico ${medicoId} marcado como ${nuevoEstado ? 'Activo' : 'Inactivo'}`);
    }
};

export default MedicosModulo;
