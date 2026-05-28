// js/views/admin.view.js
import Auth from '../core/auth.js';
import DB from '../core/db.js';
import MedicosModulo from '../modules/medicos.js';
import PacientesModulo from '../modules/pacientes.js';
import AuditoriaModulo from '../modules/auditoria.js';
import { formatearFecha } from '../core/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Proteger ruta
    Auth.checkGuard();
    
    const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
    document.getElementById('admin-name').textContent = sesion.nombre;

    // 2. Navegación de secciones
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');

    navItems.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const target = item.dataset.section;
            
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            
            sections.forEach(s => s.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');
            
            document.getElementById('section-title').textContent = item.textContent;
            renderSection(target);
        };
    });

    // 3. Renderizado de secciones
    const renderSection = (sectionId) => {
        switch(sectionId) {
            case 'sec-stats': renderStats(); break;
            case 'sec-pacientes': renderPacientes(); break;
            case 'sec-medicos': renderMedicos(); break;
            case 'sec-especialidades': renderEspecialidades(); break;
            case 'sec-auditoria': renderAuditoria(); break;
        }
    };

    const renderStats = () => {
        document.getElementById('stat-pacientes').textContent = DB.state.pacientes.length;
        document.getElementById('stat-medicos').textContent = DB.state.medicos.length;
        document.getElementById('stat-citas').textContent = DB.state.citas.filter(c => c.fecha === new Date().toISOString().split('T')[0]).length;
    };

    const renderPacientes = () => {
        const body = document.getElementById('table-pacientes-body');
        body.innerHTML = DB.state.pacientes.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.email}</td>
                <td>${p.telefono}</td>
                <td><span class="badge ${p.activo ? 'badge-success' : 'badge-danger'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
                <td>
                    <button class="btn-primary btn-small btn-edit-p" data-id="${p.id}">Editar</button>
                    <button class="btn-warning btn-small btn-toggle-p" data-id="${p.id}">${p.activo ? 'Desactivar' : 'Activar'}</button>
                    <button class="btn-danger btn-small btn-delete-p" data-id="${p.id}">Eliminar</button>
                </td>
            </tr>
        `).join('');

        // Eventos de la lista
        document.querySelectorAll('.btn-toggle-p').forEach(btn => {
            btn.onclick = () => {
                PacientesModulo.toggleEstado(btn.dataset.id);
                renderPacientes();
            };
        });

        document.querySelectorAll('.btn-edit-p').forEach(btn => {
            btn.onclick = () => abrirModalEdicion(btn.dataset.id);
        });

        document.querySelectorAll('.btn-delete-p').forEach(btn => {
            btn.onclick = () => {
                if (confirm('¿Estás seguro de que deseas eliminar permanentemente a este paciente?')) {
                    PacientesModulo.eliminarPaciente(btn.dataset.id);
                    renderPacientes();
                    renderStats();
                }
            };
        });
    };

    const renderMedicos = () => {
        const body = document.getElementById('table-medicos-body');
        body.innerHTML = DB.state.medicos.map(m => {
            const user = DB.state.usuarios.find(u => u.id === m.usuarioId);
            const esp = DB.state.especialidades.find(e => e.id === m.especialidadId);
            return `
                <tr>
                    <td>${user ? user.nombre : 'N/A'}</td>
                    <td>${esp ? esp.nombre : 'N/A'}</td>
                    <td>${m.cedula}</td>
                    <td><span class="badge ${m.activo ? 'badge-success' : 'badge-danger'}">${m.activo ? 'Activo' : 'Inactivo'}</span></td>
                    <td>
                        <button class="btn-primary btn-small btn-edit-m" data-id="${m.id}">Editar</button>
                        <button class="btn-warning btn-small btn-toggle-m" data-id="${m.id}">${m.activo ? 'Desactivar' : 'Activar'}</button>
                    </td>
                </tr>
            `;
        }).join('');

        // Eventos
        document.querySelectorAll('.btn-toggle-m').forEach(btn => {
            btn.onclick = () => {
                MedicosModulo.toggleEstado(btn.dataset.id);
                renderMedicos();
            };
        });

        // Evento para abrir modal de edición
        document.querySelectorAll('.btn-edit-m').forEach(btn => {
            btn.onclick = () => abrirModalEdicionMedico(btn.dataset.id);
        });
    };

    const renderEspecialidades = () => {
        const list = document.getElementById('list-especialidades');
        list.innerHTML = DB.state.especialidades.map(e => `
            <li>
                ${e.nombre}
                <button class="btn-danger btn-small" onclick="alert('Funcionalidad de borrado en desarrollo')">Eliminar</button>
            </li>
        `).join('');
    };

    const renderAuditoria = () => {
        const body = document.getElementById('table-logs-body');
        body.innerHTML = AuditoriaModulo.obtenerLogs().map(l => `
            <tr>
                <td>${formatearFecha(l.fecha)}</td>
                <td><b>${l.usuario}</b> (${l.rol})</td>
                <td>${l.accion}</td>
                <td>${l.detalle}</td>
            </tr>
        `).join('');
    };

    // 4. Modal de Médicos (Regla 4 y HU11)
    const modal = document.getElementById('modal-medico');
    document.getElementById('btn-open-medico-modal').onclick = () => {
        // Cargar especialidades en el select
        const select = document.getElementById('m-especialidad');
        select.innerHTML = MedicosModulo.obtenerEspecialidades().map(e => `<option value="${e.id}">${e.nombre}</option>`).join('');
        modal.classList.remove('hidden');
    };

    document.getElementById('btn-close-medico').onclick = () => modal.classList.add('hidden');

    document.getElementById('btn-save-medico').onclick = () => {
        const telRegex = /^\d{10}$/;
        const datos = {
            nombre: document.getElementById('m-nombre').value.trim(),
            // Se eliminó m-user, se agregó m-tel
            telefono: document.getElementById('m-tel').value.trim(),
            pass: document.getElementById('m-pass').value,
            email: document.getElementById('m-email').value.trim(),
            cedula: document.getElementById('m-cedula').value.trim(),
            especialidadId: document.getElementById('m-especialidad').value
        };

        if (!telRegex.test(datos.telefono)) {
            return alert("El teléfono debe contener exactamente 10 dígitos.");
        }

        try {
            MedicosModulo.registrarMedico(datos);
            modal.classList.add('hidden');
            renderMedicos();
            // Limpiar campos actualizados
            ['m-nombre','m-tel','m-pass','m-email','m-cedula'].forEach(id => document.getElementById(id).value = '');
        } catch (e) {
            alert(e.message);
        }
    };

    // --- Lógica de Edición de Médicos (HU13, HU14 y HU33) ---
    const modalEdicionMedico = document.getElementById('modal-detalle-medico');

    const abrirModalEdicionMedico = (id) => {
        const m = MedicosModulo.obtenerMedico(id);
        if (!m) return;

        // Llenar datos de texto
        document.getElementById('edit-m-id').value = m.id;
        document.getElementById('edit-m-nombre').value = m.nombre;
        document.getElementById('edit-m-email').value = m.email;
        document.getElementById('edit-m-tel').value = m.telefono || '';
        document.getElementById('edit-m-cedula').value = m.cedula;

        // HU33: Cargar especialidades y pre-seleccionar la del médico
        const selectEsp = document.getElementById('edit-m-especialidad');
        const especialidades = MedicosModulo.obtenerEspecialidades();

        selectEsp.innerHTML = especialidades.map(e =>
            `<option value="${e.id}" ${e.id === m.especialidadId ? 'selected' : ''}>${e.nombre}</option>`
        ).join('');

        modalEdicionMedico.classList.remove('hidden');
    };

    document.getElementById('btn-close-edit-medico').onclick = () => modalEdicionMedico.classList.add('hidden');

    document.getElementById('btn-update-medico').onclick = () => {
        const id = document.getElementById('edit-m-id').value;
        const telRegex = /^\d{10}$/;

        const datos = {
            nombre: document.getElementById('edit-m-nombre').value.trim(),
            email: document.getElementById('edit-m-email').value.trim(),
            telefono: document.getElementById('edit-m-tel').value.trim(),
            cedula: document.getElementById('edit-m-cedula').value.trim(),
            especialidadId: document.getElementById('edit-m-especialidad').value
        };

        if (!datos.nombre || !datos.email || !datos.telefono || !datos.cedula) {
            return alert("Todos los campos son obligatorios.");
        }

        if (!telRegex.test(datos.telefono)) {
            return alert("El teléfono debe contener exactamente 10 dígitos.");
        }

        try {
            MedicosModulo.actualizarMedico(id, datos);
            alert("Información del médico actualizada correctamente.");
            modalEdicionMedico.classList.add('hidden');
            renderMedicos();
        } catch (e) {
            alert(e.message); // Mostrará el error si el correo ya existe
        }
    };

    // 5. Modal de Pacientes
    const modalPaciente = document.getElementById('modal-paciente');
    document.getElementById('btn-open-paciente-modal').onclick = () => {
        modalPaciente.classList.remove('hidden');
    };

    document.getElementById('btn-close-paciente').onclick = () => modalPaciente.classList.add('hidden');

    document.getElementById('btn-save-paciente').onclick = () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const telRegex = /^\d{10}$/;

        const datos = {
            nombre: document.getElementById('ap-nombre').value.trim(),
            email: document.getElementById('ap-email').value.trim(),
            telefono: document.getElementById('ap-tel').value.trim(),
            pass: document.getElementById('ap-pass').value
        };

        if (!datos.nombre || !datos.email || !datos.telefono || !datos.pass) {
            return alert("Todos los campos son obligatorios.");
        }

        if (!emailRegex.test(datos.email)) {
            return alert("Formato de correo electrónico inválido.");
        }

        if (!telRegex.test(datos.telefono)) {
            return alert("El teléfono debe contener exactamente 10 dígitos.");
        }

        try {
            PacientesModulo.registrarPaciente(datos);
            modalPaciente.classList.add('hidden');
            renderPacientes();
            // Limpiar
            ['ap-nombre','ap-email','ap-tel','ap-pass'].forEach(id => document.getElementById(id).value = '');
        } catch (e) {
            alert(e.message);
        }
    };

    // --- Lógica de Edición de Pacientes (HU8 y HU9) ---
    const modalEdicion = document.getElementById('modal-detalle-paciente');

    const abrirModalEdicion = (id) => {
        const p = DB.state.pacientes.find(x => x.id === id);
        if (!p) return;

        document.getElementById('edit-p-id').value = p.id;
        document.getElementById('edit-p-nombre').value = p.nombre;
        document.getElementById('edit-p-email').value = p.email;
        document.getElementById('edit-p-tel').value = p.telefono;
        document.getElementById('edit-p-direccion').value = p.direccion || '';

        modalEdicion.classList.remove('hidden');
    };

    document.getElementById('btn-close-edit-paciente').onclick = () => modalEdicion.classList.add('hidden');

    document.getElementById('btn-update-paciente').onclick = () => {
        const id = document.getElementById('edit-p-id').value;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const telRegex = /^\d{10}$/;

        const datos = {
            nombre: document.getElementById('edit-p-nombre').value.trim(),
            email: document.getElementById('edit-p-email').value.trim(),
            telefono: document.getElementById('edit-p-tel').value.trim(),
            direccion: document.getElementById('edit-p-direccion').value.trim()
        };

        if (!datos.nombre || !datos.email || !datos.telefono) {
            return alert("Nombre, Email y Teléfono son obligatorios.");
        }

        if (!emailRegex.test(datos.email)) {
            return alert("Error: El formato del correo electrónico es inválido.");
        }

        if (!telRegex.test(datos.telefono)) {
            return alert("Error: El teléfono debe contener única y exactamente 10 dígitos numéricos.");
        }

        const actualizado = PacientesModulo.actualizarPaciente(id, datos);
        if (actualizado) {
            alert("Paciente actualizado correctamente.");
            modalEdicion.classList.add('hidden');
            renderPacientes();
        }
    };

    document.getElementById('btn-delete-paciente-modal').onclick = () => {
        const id = document.getElementById('edit-p-id').value;
        if (confirm('¿Estás seguro de que deseas eliminar permanentemente a este paciente?')) {
            PacientesModulo.eliminarPaciente(id);
            modalEdicion.classList.add('hidden');
            renderPacientes();
            renderStats();
        }
    };

    // 5. Otras acciones
    document.getElementById('btn-logout').onclick = () => Auth.logout();

    document.getElementById('btn-add-especialidad').onclick = () => {
        const input = document.getElementById('new-esp-name');
        if (!input.value) return;
        DB.add('especialidades', { id: Date.now(), nombre: input.value });
        input.value = '';
        renderEspecialidades();
    };

    document.getElementById('btn-clear-logs').onclick = () => {
        if (confirm("¿Estás seguro de limpiar todos los registros de auditoría?")) {
            AuditoriaModulo.limpiarLogs();
            renderAuditoria();
        }
    };

    // Inicializar vista
    renderStats();
});
