// js/modules/pacientes.js
import DB from '../core/db.js';
import { generarID, hashPwd } from '../core/utils.js';

const PacientesModulo = {
    /**
     * Registro de Paciente por Administrador
     */
    registrarPaciente(datos) {
        // 1. Validar que el correo sea ÚNICO en el sistema (HU9 / Regla de Negocio)
        const existe = DB.state.usuarios.some(u => u.email === datos.email || u.user === datos.email);
        if (existe) {
            throw new Error("Error: El correo electrónico ya se encuentra registrado con otro usuario.");
        }

        const userId = generarID('usr_p'); // Generación de ID único para el usuario
        
        // 2. Crear Cuenta de Usuario asignando automáticamente el rol 'paciente'
        const nuevoUsuario = {
            id: userId,
            user: datos.email,
            email: datos.email,
            telefono: datos.telefono,
            pass: hashPwd(datos.pass),
            rol: 'paciente', // Asignación automática de rol
            nombre: datos.nombre,
            activo: true
        };

        // 3. Crear Perfil de Paciente vinculado al usuario
        const nuevoPaciente = {
            id: generarID('pac'), // ID único para la entidad paciente
            usuarioId: userId,
            nombre: datos.nombre,
            email: datos.email,
            telefono: datos.telefono,
            fechaRegistro: new Date().toISOString(),
            activo: true
        };

        // Persistir en db.js
        DB.add('usuarios', nuevoUsuario);
        DB.add('pacientes', nuevoPaciente);
        DB.registrarLog('Registro Administrativo', `Alta de paciente exitosa: ${datos.email}`);
        
        return true; // Confirmación de éxito
    },

    /**
     * HU8: Consultar el detalle completo de un paciente
     * Permite la búsqueda mediante el ID único o el correo electrónico registrado.
     */
    obtenerDetallePaciente(identificador) {
        return DB.state.pacientes.find(p => p.id === identificador || p.email === identificador);
    },

    /**
     * HU9: Actualización administrativa del perfil del paciente
     * Valida la unicidad del correo antes de proceder y sincroniza la cuenta de usuario.
     */
    actualizarPacienteAdmin(identificador, nuevosDatos) {
        // 1. Capa de Validación Estricta (Regex)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const telRegex = /^\d{10}$/;

        if (nuevosDatos.email && !emailRegex.test(nuevosDatos.email)) {
            throw new Error("Error: El formato del correo electrónico es inválido.");
        }

        if (nuevosDatos.telefono && !telRegex.test(nuevosDatos.telefono)) {
            throw new Error("Error: El teléfono debe contener única y exactamente 10 dígitos numéricos.");
        }

        // 2. Localizar paciente
        const paciente = this.obtenerDetallePaciente(identificador);
        if (!paciente) {
            throw new Error("No se encontró el paciente en el sistema.");
        }

        // Validación de Correo Único: Solo si se está intentando cambiar el correo actual
        if (nuevosDatos.email && nuevosDatos.email !== paciente.email) {
            const emailExistente = DB.state.usuarios.some(u => u.email === nuevosDatos.email || u.user === nuevosDatos.email);
            if (emailExistente) {
                throw new Error("El correo electrónico ingresado ya pertenece a otro usuario registrado.");
            }
        }

        const infoActualizada = {
            nombre: nuevosDatos.nombre || paciente.nombre,
            email: nuevosDatos.email || paciente.email,
            telefono: nuevosDatos.telefono || paciente.telefono,
            direccion: nuevosDatos.direccion !== undefined ? nuevosDatos.direccion : paciente.direccion
        };

        // 1. Actualizar entidad Paciente
        DB.update('pacientes', paciente.id, infoActualizada);

        // 2. Sincronizar con entidad Usuario asociada (incluye actualización de login/user)
        if (paciente.usuarioId) {
            DB.update('usuarios', paciente.usuarioId, {
                nombre: infoActualizada.nombre,
                email: infoActualizada.email,
                user: infoActualizada.email // El identificador de acceso es el correo
            });
        }

        DB.save();
        DB.registrarLog('HU9 - Edición Admin', `Se actualizaron los datos del paciente: ${paciente.id}`);
        
        return this.obtenerDetallePaciente(paciente.id);
    },

    /**
     * HU9: Actualizar información del paciente
     */
    actualizarPaciente(pacienteId, datos) {
        const pIdx = DB.state.pacientes.findIndex(p => p.id === pacienteId);
        if (pIdx === -1) return false;
        
        const pacienteActual = DB.state.pacientes[pIdx];

        const pacienteActualizado = {
            ...pacienteActual,
            nombre: datos.nombre || pacienteActual.nombre,
            email: datos.email || pacienteActual.email,
            telefono: datos.telefono || pacienteActual.telefono,
            direccion: datos.direccion || pacienteActual.direccion,
        };

        DB.state.pacientes[pIdx] = pacienteActualizado;

        // Nota: Solo sincronizamos email/tel si el usuario existe
        DB.update('usuarios', pacienteActual.usuarioId, { 
            nombre: datos.nombre || pacienteActual.nombre,
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
    },

    /**
     * HU10: Eliminar permanentemente un paciente y su cuenta de usuario
     */
    eliminarPaciente(pacienteId) {
        const paciente = DB.state.pacientes.find(p => p.id === pacienteId);
        if (!paciente) return false;

        // 1. Eliminar perfil de paciente
        DB.delete('pacientes', pacienteId);

        // 2. Eliminar cuenta de usuario vinculada si existe
        if (paciente.usuarioId) {
            DB.delete('usuarios', paciente.usuarioId);
        }

        DB.registrarLog('Baja Permanente (HU10)', `Administrador eliminó al paciente: ${paciente.nombre}`);
        return true;
    },

    /**
     * HU10: Borrado físico solicitado para Administración
     * Busca por ID o Correo y elimina permanentemente usando splice.
     */
    eliminarPacienteAdmin(identificador) {
        // 1. Buscar el índice del paciente mediante ID o correo electrónico
        const index = DB.state.pacientes.findIndex(p => p.id === identificador || p.email === identificador);

        if (index === -1) {
            throw new Error("No se encontró el registro del paciente para proceder con la eliminación física.");
        }

        const paciente = DB.state.pacientes[index];

        // 2. Eliminación física en el arreglo de pacientes mediante splice
        DB.state.pacientes.splice(index, 1);

        // 3. Eliminación física de la cuenta de usuario vinculada para mantener la integridad
        const userIndex = DB.state.usuarios.findIndex(u => u.id === paciente.usuarioId);
        if (userIndex !== -1) {
            DB.state.usuarios.splice(userIndex, 1);
        }

        // 4. Sincronizar cambios y auditar
        DB.save();
        DB.registrarLog('Eliminación Física (HU10)', `Admin borró permanentemente a: ${paciente.nombre} (${paciente.email})`);

        return "Éxito: El paciente y su cuenta han sido removidos físicamente de la base de datos.";
    },

    /**
     * Desbloquea la cuenta de un paciente que excedió los intentos de login
     */
    desbloquearCuenta(usuarioId, email) {
        if (!usuarioId) throw new Error("ID de usuario no proporcionado.");
        
        const success = DB.update('usuarios', usuarioId, { 
            bloqueado: false, 
            intentosFallidos: 0 
        });

        if (success) {
            DB.registrarLog('Cuenta Desbloqueada', `El administrador desbloqueó al paciente ${email}`);
        } else {
            throw new Error("No se pudo desbloquear la cuenta. Usuario no encontrado.");
        }
    }
};

export default PacientesModulo;
