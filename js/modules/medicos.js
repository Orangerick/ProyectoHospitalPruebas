// js/modules/medicos.js
import DB from '../core/db.js';
import { generarID, hashPwd, validarCedula } from '../core/utils.js';

/**
 * Lógica de Negocio para Médicos (Exclusivo Admin)
 */
const MedicosModulo = {
    /**
     * Registro Integral (Regla 4 y HU11)
     * HU11: Fuera la casilla de usuario, pedir teléfono y usar correo para el login.
     */
    registrarMedico(datos) {
        if (!validarCedula(datos.cedula)) throw new Error("Cédula profesional inválida.");

        // HU11: Verificar si el correo ya existe en lugar del 'user'
        if (DB.state.usuarios.find(u => u.email === datos.email)) {
            throw new Error("El correo electrónico ya está registrado.");
        }

        const userId = generarID('doc_u');

        // 1. Crear la cuenta de acceso (Se elimina 'user', usamos 'email')
        const nuevoUsuario = {
            id: userId,
            email: datos.email, // Ahora el email es el identificador de acceso
            pass: hashPwd(datos.pass),
            rol: 'medico',
            nombre: datos.nombre,
            activo: true
        };

        // 2. Crear el perfil profesional (Se agrega 'telefono')
        const nuevoPerfil = {
            id: generarID('med_p'),
            usuarioId: userId,
            cedula: datos.cedula,
            especialidadId: parseInt(datos.especialidadId),
            email: datos.email,
            telefono: datos.telefono, // NUEVO CAMPO
            activo: true
        };

        DB.add('usuarios', nuevoUsuario);
        DB.add('medicos', nuevoPerfil);
        DB.registrarLog('Alta Médico', `Admin creó médico: ${datos.nombre} [Cédula: ${datos.cedula}]`);

        return true;
    },

    /**
     * Obtener datos de un médico para la vista de edición (HU13)
     */
    obtenerMedico(medicoId) {
        const medico = DB.state.medicos.find(m => m.id === medicoId);
        if (!medico) return null;

        const usuario = DB.state.usuarios.find(u => u.id === medico.usuarioId);

        // Devolvemos un objeto combinado para que la vista lo pinte fácil en el formulario
        return {
            ...medico,
            nombre: usuario ? usuario.nombre : 'Sin Nombre'
        };
    },

    /**
     * Actualización de Información (HU14 y HU33)
     */
    actualizarMedico(medicoId, nuevosDatos) {
        const medico = DB.state.medicos.find(m => m.id === medicoId);
        if (!medico) return false;

        const usuario = DB.state.usuarios.find(u => u.id === medico.usuarioId);

        // Validar que si cambia el correo, no choque con otro existente
        if (nuevosDatos.email && nuevosDatos.email !== medico.email) {
            if (DB.state.usuarios.find(u => u.email === nuevosDatos.email && u.id !== medico.usuarioId)) {
                throw new Error("El nuevo correo ya está en uso por otra cuenta.");
            }
        }

        // HU33: Detectar si hay un cambio de especialidad para registrarlo en el log
        const nuevaEspecialidadId = parseInt(nuevosDatos.especialidadId);
        if (medico.especialidadId !== nuevaEspecialidadId) {
            DB.registrarLog('Reasignación Especialidad', `Médico ${medicoId} reasignado a especialidad ID: ${nuevaEspecialidadId}`);
        }

        // Actualizar perfil en tabla 'medicos' (incluyendo el teléfono)
        DB.update('medicos', medicoId, {
            especialidadId: nuevaEspecialidadId,
            cedula: nuevosDatos.cedula,
            email: nuevosDatos.email,
            telefono: nuevosDatos.telefono
        });

        // Actualizar datos en tabla 'usuarios' (Nombre y el Email que ahora es su login)
        if (usuario) {
            DB.update('usuarios', medico.usuarioId, {
                nombre: nuevosDatos.nombre,
                email: nuevosDatos.email
            });
        }

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
    },

    /**
     * Utilidad para obtener la lista de especialidades (HU33)
     * Necesario para llenar los <select> dinámicos en los modales.
     */
    obtenerEspecialidades() {
        return DB.state.especialidades;
    }
};

export default MedicosModulo;