// js/views/paciente.view.js
import Auth from '../core/auth.js';
import DB from '../core/db.js';
import Api from '../core/api.js';
import PacientesModulo from '../modules/pacientes.js';

document.addEventListener('DOMContentLoaded', async () => {
    Auth.checkGuard();
    const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
    const miPerfil = DB.state.pacientes.find(p => p.usuarioId === sesion.id);

    if (!miPerfil) {
        alert("Error de integridad: No se encontró tu perfil de paciente.");
        Auth.logout();
        return;
    }

    document.getElementById('paciente-name').textContent = sesion.nombre;

    // Navegación
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.onclick = (e) => {
            e.preventDefault();
            const target = item.dataset.section;
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
            document.getElementById(target).classList.remove('hidden');
            renderSection(target);
        };
    });

    const renderSection = (id) => {
        if (id === 'sec-mis-citas') renderCitas();
        if (id === 'sec-historial') renderHistorial();
        if (id === 'sec-perfil') cargarDatosPerfil();
    };

    // ── CITAS (ahora usando el backend) ──────────────────
    const renderCitas = async () => {
        const body = document.getElementById('table-citas-body');
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;">Cargando...</td></tr>';

        try {
            // Obtener citas del backend usando el ID del paciente en MongoDB
            // Primero buscamos el _id de MongoDB del paciente via sesión
            const misCitas = await Api.getCitas({ pacienteId: miPerfil.id });

            if (misCitas.length === 0) {
                body.innerHTML = '<tr><td colspan="5" style="text-align:center;">No tienes citas programadas.</td></tr>';
                return;
            }

            body.innerHTML = misCitas.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(c => {
                const med = DB.state.medicos.find(m => m.id === c.medicoId);
                const medUser = med ? DB.state.usuarios.find(u => u.id === med.usuarioId) : null;
                return `
                    <tr>
                        <td>${c.fecha}</td>
                        <td>${c.hora}</td>
                        <td>Dr. ${medUser ? medUser.nombre : 'N/A'}</td>
                        <td><span class="badge ${c.estado === 'cancelada' ? 'badge-danger' : 'badge-success'}">${c.estado}</span></td>
                        <td>
                            ${c.estado === 'confirmada' ? `
                                <button class="btn-warning btn-small btn-repro-cita" data-id="${c._id || c.id}">Reprogramar</button>
                                <button class="btn-danger btn-small btn-cancel-cita" data-id="${c._id || c.id}">Cancelar</button>
                            ` : ''}
                        </td>
                    </tr>
                `;
            }).join('');

            // Evento cancelar
            document.querySelectorAll('.btn-cancel-cita').forEach(btn => {
                btn.onclick = async () => {
                    if (confirm("¿Estás seguro de que deseas cancelar esta cita?")) {
                        try {
                            await Api.cancelarCita(btn.dataset.id);
                            renderCitas();
                        } catch (e) {
                            alert(e.message);
                        }
                    }
                };
            });

            // Evento reprogramar — abrir modal
            document.querySelectorAll('.btn-repro-cita').forEach(btn => {
                btn.onclick = () => {
                    document.getElementById('repro-cita-id').value = btn.dataset.id;
                    document.getElementById('repro-fecha').min = new Date().toISOString().split('T')[0];
                    document.getElementById('modal-reprogramar').classList.remove('hidden');
                };
            });

        } catch (e) {
            body.innerHTML = `<tr><td colspan="5" style="text-align:center;color:red;">Error al cargar citas: ${e.message}</td></tr>`;
        }
    };

    // Modal reprogramar
    document.getElementById('btn-close-repro').onclick = () =>
        document.getElementById('modal-reprogramar').classList.add('hidden');

    document.getElementById('btn-save-repro').onclick = async () => {
        const id = document.getElementById('repro-cita-id').value;
        const fecha = document.getElementById('repro-fecha').value;
        const hora = document.getElementById('repro-hora').value;
        try {
            await Api.reprogramarCita(id, fecha, hora);
            document.getElementById('modal-reprogramar').classList.add('hidden');
            renderCitas();
            alert("Cita reprogramada con éxito.");
        } catch (e) {
            alert(e.message);
        }
    };

    // ── HISTORIAL (sigue en localStorage) ──────────────────
    const renderHistorial = () => {
        const container = document.getElementById('historial-timeline');
        const regs = DB.state.historiales.filter(h => h.pacienteId === miPerfil.id);
        if (regs.length === 0) {
            container.innerHTML = "<p>Aún no tienes registros médicos.</p>";
            return;
        }
        container.innerHTML = regs.map(h => `
            <div class="card" style="margin-bottom:1rem; border-left: 4px solid var(--primary);">
                <h4>${h.tipo}: ${h.titulo}</h4>
                <small>${new Date(h.fecha).toLocaleString()} | Médico ID: ${h.medicoId}</small>
                <p style="margin-top: 10px;">${h.detalle}</p>
            </div>
        `).join('');
    };

    const cargarDatosPerfil = () => {
        document.getElementById('p-nombre').value = miPerfil.nombre;
        document.getElementById('p-email').value = miPerfil.email;
        document.getElementById('p-tel').value = miPerfil.telefono;
        document.getElementById('p-direccion').value = miPerfil.direccion || '';
    };

    // ── MODAL NUEVA CITA ──────────────────────────────────
    const modal = document.getElementById('modal-cita');
    document.getElementById('btn-nueva-cita').onclick = () => {
        const select = document.getElementById('c-medico');
        select.innerHTML = DB.state.medicos.filter(m => m.activo).map(m => {
            const u = DB.state.usuarios.find(user => user.id === m.usuarioId);
            const e = DB.state.especialidades.find(esp => esp.id === m.especialidadId);
            return `<option value="${m.id}">Dr. ${u ? u.nombre : 'N/A'} (${e ? e.nombre : 'N/A'})</option>`;
        }).join('');
        document.getElementById('c-fecha').min = new Date().toISOString().split('T')[0];
        modal.classList.remove('hidden');
    };

    document.getElementById('btn-close-cita').onclick = () => modal.classList.add('hidden');

    document.getElementById('btn-confirmar-cita').onclick = async () => {
        const datos = {
            pacienteId: miPerfil.id,
            medicoId: document.getElementById('c-medico').value,
            fecha: document.getElementById('c-fecha').value,
            hora: document.getElementById('c-hora').value,
            motivo: document.getElementById('c-motivo').value
        };

        if (!datos.medicoId || !datos.fecha || !datos.hora || !datos.motivo) {
            alert("Completa todos los campos obligatorios.");
            return;
        }

        try {
            await Api.agendarCita(datos);
            modal.classList.add('hidden');
            renderCitas();
            alert("¡Cita agendada con éxito!");
            document.getElementById('c-fecha').value = '';
            document.getElementById('c-motivo').value = '';
        } catch (e) {
            alert(e.message);
        }
    };

    document.getElementById('btn-save-perfil').onclick = () => {
        const nuevaDir = document.getElementById('p-direccion').value.trim();
        if (!nuevaDir) { alert("Por favor, ingresa una dirección válida."); return; }
        const exito = PacientesModulo.actualizarDireccion(miPerfil.id, nuevaDir);
        if (exito) alert("¡Perfil actualizado con éxito!");
    };

    document.getElementById('btn-logout').onclick = () => Auth.logout();

    // Cargar citas al iniciar
    renderCitas();
});
