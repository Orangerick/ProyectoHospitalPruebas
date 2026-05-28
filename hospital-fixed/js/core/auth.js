// js/core/auth.js
import DB from './db.js';
import { hashPwd, validarEmail } from './utils.js';

/**
 * Gestión de Autenticación y RBAC (Regla 2)
 */
const Auth = {
    login(email, password) {
        const usuario = DB.state.usuarios.find(u => u.email === email);
        if (!usuario) throw new Error("Credenciales incorrectas");

        if (usuario.rol !== 'admin' && usuario.bloqueado) {
            throw new Error("Tu cuenta está bloqueada por múltiples intentos fallidos. Contacta al administrador.");
        }
        if (!usuario.activo) throw new Error("Tu cuenta está desactivada. Contacta al administrador.");

        if (usuario.pass !== hashPwd(password)) {
            if (usuario.rol !== 'admin') {
                const nuevosIntentos = (usuario.intentosFallidos || 0) + 1;
                let mensajeError = "Credenciales incorrectas";
                if (nuevosIntentos >= 3) {
                    DB.update('usuarios', usuario.id, { intentosFallidos: nuevosIntentos, bloqueado: true });
                    DB.registrarLog('Cuenta Bloqueada', `El usuario ${email} ha sido bloqueado tras 3 intentos fallidos.`);
                    throw new Error("Tu cuenta ha sido bloqueada tras 3 intentos fallidos. Contacta al administrador.");
                } else {
                    DB.update('usuarios', usuario.id, { intentosFallidos: nuevosIntentos });
                    mensajeError += `. Intentos restantes: ${3 - nuevosIntentos}`;
                }
                throw new Error(mensajeError);
            } else {
                throw new Error("Credenciales incorrectas");
            }
        }

        if (usuario.intentosFallidos > 0) {
            DB.update('usuarios', usuario.id, { intentosFallidos: 0 });
        }

        // BUG CRÍTICO CORREGIDO #1: Se añadió el campo 'email' a la sesión.
        // Antes, solo existía 'user', por lo que registrarLog() mostraba
        // "Sistema/Anonimo" en TODOS los logs de auditoría.
        const sesion = {
            id: usuario.id,
            user: usuario.email,
            email: usuario.email, // <-- FIX: campo necesario para los logs de auditoría
            rol: usuario.rol,
            nombre: usuario.nombre,
            token: 'tk_' + Math.random().toString(36).substr(2),
            expira: Date.now() + (60 * 60 * 1000)
        };

        sessionStorage.setItem('hospital_sesion', JSON.stringify(sesion));
        DB.registrarLog('Inicio de Sesión', `Usuario ${usuario.email} accedió al sistema.`);
        this.redirectByRol(usuario.rol);
    },

    registerPaciente(datos) {
        const regexTelefono = /^\d{10}$/;
        if (!datos.telefono || !regexTelefono.test(datos.telefono)) {
            throw new Error("El teléfono debe contener exactamente 10 dígitos numéricos.");
        }
        if (!validarEmail(datos.email)) {
            throw new Error("Formato de correo electrónico inválido (falta el símbolo @).");
        }
        const correoExiste = DB.state.usuarios.some(u => u.email === datos.email);
        if (correoExiste) {
            throw new Error("Error: El correo electrónico ya se encuentra registrado.");
        }

        const userId = 'usr_' + Date.now();
        const nuevoUsuario = {
            id: userId,
            email: datos.email,
            telefono: datos.telefono,
            pass: hashPwd(datos.pass),
            rol: 'paciente',
            nombre: datos.nombre,
            activo: true,
            intentosFallidos: 0,
            bloqueado: false
        };

        const nuevoPaciente = {
            id: 'pac_' + Date.now(),
            usuarioId: userId,
            nombre: datos.nombre,
            email: datos.email,
            telefono: datos.telefono,
            fechaRegistro: new Date().toISOString(),
            activo: true
        };

        DB.add('usuarios', nuevoUsuario);
        DB.add('pacientes', nuevoPaciente);

        // BUG CRÍTICO CORREGIDO #2: datos.user no existe. El campo correcto es datos.email.
        DB.registrarLog('Auto-Registro', `Nuevo paciente registrado: ${datos.email}`); // <-- FIX
    },

    checkGuard() {
        const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
        const path = window.location.pathname;

        if (!sesion && !path.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }

        if (sesion) {
            // Verificar expiración de sesión
            if (Date.now() > sesion.expira) {
                this.logout();
                return;
            }

            const esAdminPage = path.includes('admin.html');
            const esMedicoPage = path.includes('medico.html');
            const esPacientePage = path.includes('paciente.html');

            if (esAdminPage && sesion.rol !== 'admin') this.logout();
            if (esMedicoPage && sesion.rol !== 'medico') this.logout();
            if (esPacientePage && sesion.rol !== 'paciente') this.logout();
        }
    },

    redirectByRol(rol) {
        const rutas = { admin: 'admin.html', medico: 'medico.html', paciente: 'paciente.html' };
        window.location.href = rutas[rol] || 'login.html';
    },

    logout() {
        DB.registrarLog('Cierre de Sesión', 'El usuario salió del sistema.');
        sessionStorage.removeItem('hospital_sesion');
        window.location.href = 'login.html';
    },

    obtenerCorreoOculto(telefono) {
        const usuario = DB.state.usuarios.find(u => u.telefono === telefono);
        if (!usuario) throw new Error("No se encontró ninguna cuenta asociada a este número de teléfono.");
        const [nombre, dominio] = usuario.email.split('@');
        const ofuscado = nombre[0] + '*' + nombre[nombre.length - 1];
        return `${ofuscado}@${dominio}`;
    },

    validarYCambiarPassword(telefono, correoIngresado, nuevaPassword) {
        const usuario = DB.state.usuarios.find(u => u.telefono === telefono);
        if (!usuario) throw new Error("No se encontró ninguna cuenta asociada a este teléfono.");
        if (usuario.email !== correoIngresado) throw new Error("El correo electrónico ingresado no coincide con nuestros registros.");
        DB.update('usuarios', usuario.id, { pass: hashPwd(nuevaPassword) });
        DB.registrarLog('Recuperación Exitosa', `Contraseña restablecida para: ${usuario.email}`);
        return true;
    },

    recuperarPassword(email) {
        const usuario = DB.state.usuarios.find(u => u.email === email);
        if (usuario) {
            DB.registrarLog('Recuperación Contraseña', `Solicitud enviada para ${email}`);
            return "Se ha enviado un código a tu correo (Simulado).";
        }
        throw new Error("El correo no está registrado.");
    }
};

export default Auth;
