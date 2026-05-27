// js/core/auth.js
import DB from './db.js';
import { hashPwd } from './utils.js';

/**
 * Gestión de Autenticación y RBAC (Regla 2)
 */
const Auth = {
    /**
     * Intenta iniciar sesión
     */
    login(username, password) {
        const usuario = DB.state.usuarios.find(u => u.user === username && u.pass === hashPwd(password));
        
        if (!usuario) throw new Error("Credenciales incorrectas");
        if (!usuario.activo) throw new Error("Tu cuenta está desactivada. Contacta al administrador.");

        const sesion = {
            id: usuario.id,
            user: usuario.user,
            rol: usuario.rol,
            nombre: usuario.nombre,
            token: 'tk_' + Math.random().toString(36).substr(2),
            expira: Date.now() + (60 * 60 * 1000) // 1 hora
        };

        sessionStorage.setItem('hospital_sesion', JSON.stringify(sesion));
        DB.registrarLog('Inicio de Sesión', `Usuario ${usuario.user} accedió al sistema.`);
        
        this.redirectByRol(usuario.rol);
    },

    /**
     * Registro Exclusivo para Pacientes (Regla 3)
     */
    registerPaciente(datos) {
        // 1. Crear Usuario
        const userId = 'usr_' + Date.now();
        const nuevoUsuario = {
            id: userId,
            user: datos.user,
            pass: hashPwd(datos.pass),
            rol: 'paciente',
            nombre: datos.nombre,
            activo: true
        };

        // 2. Crear Entidad Paciente automáticamente
        const nuevoPaciente = {
            id: 'pac_' + Date.now(),
            usuarioId: userId,
            nombre: datos.nombre,
            email: datos.email,
            telefono: datos.telefono || '',
            fechaRegistro: new Date().toISOString(),
            activo: true
        };

        DB.add('usuarios', nuevoUsuario);
        DB.add('pacientes', nuevoPaciente);
        DB.registrarLog('Auto-Registro', `Nuevo paciente registrado: ${datos.user}`);
    },

    /**
     * Auth Guard: Protege las rutas (Regla 2)
     */
    checkGuard() {
        const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
        const path = window.location.pathname;

        if (!sesion && !path.includes('login.html')) {
            window.location.href = 'login.html';
            return;
        }

        if (sesion) {
            // Verificar si el rol tiene permiso para esta página
            const esAdminPage = path.includes('admin.html');
            const esMedicoPage = path.includes('medico.html');
            const esPacientePage = path.includes('paciente.html');

            if (esAdminPage && sesion.rol !== 'admin') this.logout();
            if (esMedicoPage && sesion.rol !== 'medico') this.logout();
            if (esPacientePage && sesion.rol !== 'paciente') this.logout();
        }
    },

    redirectByRol(rol) {
        const rutas = {
            admin: 'admin.html',
            medico: 'medico.html',
            paciente: 'paciente.html'
        };
        window.location.href = rutas[rol] || 'login.html';
    },

    logout() {
        DB.registrarLog('Cierre de Sesión', 'El usuario salió del sistema.');
        sessionStorage.removeItem('hospital_sesion');
        window.location.href = 'login.html';
    },

    /**
     * Simulación de Recuperación (HU5)
     */
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
