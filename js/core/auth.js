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
    login(email, password) {
        const usuario = DB.state.usuarios.find(u => u.email === email && u.pass === hashPwd(password));
        
        if (!usuario) throw new Error("Credenciales incorrectas");
        if (!usuario.activo) throw new Error("Tu cuenta está desactivada. Contacta al administrador.");

        const sesion = {
            id: usuario.id,
            user: usuario.email,
            rol: usuario.rol,
            nombre: usuario.nombre,
            token: 'tk_' + Math.random().toString(36).substr(2),
            expira: Date.now() + (60 * 60 * 1000) // 1 hora
        };

        sessionStorage.setItem('hospital_sesion', JSON.stringify(sesion));
        DB.registrarLog('Inicio de Sesión', `Usuario ${usuario.email} accedió al sistema.`);
        
        this.redirectByRol(usuario.rol);
    },

    /**
     * Registro Exclusivo para Pacientes (Regla 3)
     */
    registerPaciente(datos) {
        // Validación del teléfono (exactamente 10 dígitos)
        const regexTelefono = /^\d{10}$/;
        if (!datos.telefono || !regexTelefono.test(datos.telefono)) {
            throw new Error("El teléfono debe contener exactamente 10 dígitos numéricos.");
        }

        // Simulación de restricción UNIQUE de la base de datos
        const correoExiste = DB.state.usuarios.some(u => u.email === datos.email || u.user === datos.email);
        if (correoExiste) {
            throw new Error("Error: El correo electrónico ya se encuentra registrado.");
        }

        // 1. Crear Usuario
        const userId = 'usr_' + Date.now();
        const nuevoUsuario = {
            id: userId,
            user: datos.email, // El acceso ahora usa el email
            email: datos.email,
            telefono: datos.telefono, // Insertamos el teléfono en el objeto
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
            telefono: datos.telefono,
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
     * Obtiene el correo ofuscado filtrando por teléfono (HU5)
     * Ejemplo: usuario@gmail.com -> u*o@gmail.com
     */
    obtenerCorreoOculto(telefono) {
        const usuario = DB.state.usuarios.find(u => u.telefono === telefono);
        if (!usuario) {
            throw new Error("No se encontró ninguna cuenta asociada a este número de teléfono.");
        }

        const [nombre, dominio] = usuario.email.split('@');
        // Ofuscación: primer carácter + '*' + último carácter antes del @
        const ofuscado = nombre[0] + '*' + nombre[nombre.length - 1];
        return `${ofuscado}@${dominio}`;
    },

    /**
     * Valida la identidad mediante correo y actualiza la contraseña (HU5)
     */
    validarYCambiarPassword(telefono, correoIngresado, nuevaPassword) {
        const usuario = DB.state.usuarios.find(u => u.telefono === telefono);
        
        if (!usuario) {
            throw new Error("No se encontró ninguna cuenta asociada a este teléfono.");
        }

        // Validación estricta de correo electrónico
        if (usuario.email !== correoIngresado) {
            throw new Error("El correo electrónico ingresado no coincide con nuestros registros.");
        }

        // Actualización de contraseña usando el motor de DB y el helper de cifrado
        DB.update('usuarios', usuario.id, { pass: hashPwd(nuevaPassword) });
        DB.registrarLog('Recuperación Exitosa', `Contraseña restablecida vía validación telefónica para: ${usuario.email}`);
        
        return true;
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
