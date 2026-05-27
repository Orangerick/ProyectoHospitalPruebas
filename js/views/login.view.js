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
        sections.recover.classList.add('hidden');
        sections.login.classList.remove('hidden');
    };

    // --- Acciones de Auth ---
    document.getElementById('btn-login').onclick = () => {
        const u = document.getElementById('login-user').value;
        const p = document.getElementById('login-pass').value;
        if (!u || !p) return showMsg("Ingresa usuario y contraseña.");
        try {
            Auth.login(u, p);
        } catch (e) {
            showMsg(e.message);
        }
    };

    document.getElementById('btn-register-confirm').onclick = () => {
        const datos = {
            nombre: document.getElementById('reg-nombre').value,
            email: document.getElementById('reg-email').value,
            user: document.getElementById('reg-user').value,
            pass: document.getElementById('reg-pass').value
        };

        if (!datos.nombre || !datos.user || !datos.pass) {
            return showMsg("Completa todos los campos obligatorios.");
        }

        try {
            Auth.registerPaciente(datos);
            showMsg("¡Cuenta creada! Ya puedes iniciar sesión.", "success");
            setTimeout(() => document.getElementById('back-to-login').click(), 2000);
        } catch (e) {
            showMsg("Error al registrar: " + e.message);
        }
    };

    document.getElementById('btn-recover-send').onclick = () => {
        const email = document.getElementById('recover-email').value;
        if (!email) return showMsg("Ingresa un correo electrónico.");
        try {
            const res = Auth.recuperarPassword(email);
            showMsg(res, "success");
        } catch (e) {
            showMsg(e.message);
        }
    };
});
