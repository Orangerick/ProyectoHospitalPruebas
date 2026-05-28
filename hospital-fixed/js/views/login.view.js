// js/views/login.view.js
import Auth from '../core/auth.js';

document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
    const sections = {
        login: document.getElementById('login-section'),
        register: document.getElementById('register-section'),
        recover: document.getElementById('recover-section')
    };
    const msgBox = document.getElementById('auth-msg');

    const showMsg = (text, type = 'error') => {
        msgBox.textContent = text;
        msgBox.className = `alert alert-${type}`;
        msgBox.classList.remove('hidden');
        setTimeout(() => msgBox.classList.add('hidden'), 4000);
    };

    // --- Navegación entre formularios ---
    document.getElementById('go-register').onclick = (e) => {
        e.preventDefault();
        sections.login.classList.add('hidden');
        sections.register.classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = 'Registro de Paciente';
    };

    document.getElementById('back-to-login').onclick = (e) => {
        e.preventDefault();
        sections.register.classList.add('hidden');
        sections.login.classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = 'Inicia sesión para continuar';
    };

    document.getElementById('go-recover').onclick = (e) => {
        e.preventDefault();
        sections.login.classList.add('hidden');
        sections.recover.classList.remove('hidden');
    };

    document.getElementById('recover-back').onclick = (e) => {
        e.preventDefault();
        // Resetear el estado de los pasos al volver
        document.getElementById('recover-step-1').classList.remove('hidden');
        document.getElementById('recover-step-2').classList.add('hidden');
        sections.recover.classList.add('hidden');
        sections.login.classList.remove('hidden');
        document.getElementById('auth-subtitle').textContent = 'Inicia sesión para continuar';
    };

    // --- Acciones de Auth ---
    document.getElementById('btn-login').onclick = () => {
        const email = document.getElementById('login-email').value.trim();
        const p = document.getElementById('login-pass').value;
        if (!email || !p) return showMsg("Ingresa tu correo y contraseña.");
        try {
            Auth.login(email, p);
        } catch (e) {
            showMsg(e.message);
        }
    };

    document.getElementById('btn-register-confirm').onclick = () => {
        const datos = {
            nombre: document.getElementById('reg-nombre').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            telefono: document.getElementById('reg-tel').value.trim(),
            user: document.getElementById('reg-email').value.trim(), // Asignamos el email como "usuario" interno
            pass: document.getElementById('reg-pass').value
        };

        if (!datos.nombre || !datos.email || !datos.telefono || !datos.pass) {
            return showMsg("Completa todos los campos obligatorios.");
        }

        const regexTelefono = /^\d{10}$/;
        if (!regexTelefono.test(datos.telefono)) {
            return showMsg("El teléfono debe contener exactamente 10 dígitos numéricos.");
        }

        try {
            Auth.registerPaciente(datos);
            showMsg("¡Cuenta creada! Ya puedes iniciar sesión.", "success");
            setTimeout(() => document.getElementById('back-to-login').click(), 2000);
        } catch (e) {
            showMsg("Error al registrar: " + e.message);
        }
    };

    // --- Lógica de Recuperación en 2 Pasos (HU5) ---
    document.getElementById('btn-recover-next').onclick = () => {
        const tel = document.getElementById('recover-tel').value.trim();
        if (!tel) return showMsg("Ingresa tu número de teléfono.");

        try {
            const correoOculto = Auth.obtenerCorreoOculto(tel);
            // Inyectar correo ofuscado y cambiar de paso
            document.getElementById('recover-hint').textContent = `Confirma tu correo: ${correoOculto}`;
            document.getElementById('recover-step-1').classList.add('hidden');
            document.getElementById('recover-step-2').classList.remove('hidden');
        } catch (e) {
            showMsg(e.message);
        }
    };

    document.getElementById('btn-recover-save').onclick = () => {
        const tel = document.getElementById('recover-tel').value.trim();
        const email = document.getElementById('recover-email-full').value.trim();
        const pass = document.getElementById('recover-new-pass').value;

        if (!email || !pass) return showMsg("Completa todos los campos obligatorios.");

        try {
            Auth.validarYCambiarPassword(tel, email, pass);
            showMsg("¡Contraseña actualizada con éxito! Redirigiendo...", "success");
            
            // Volver al login tras un breve retraso
            setTimeout(() => {
                document.getElementById('recover-back').click();
            }, 2000);
        } catch (e) {
            showMsg(e.message);
        }
    };
});
