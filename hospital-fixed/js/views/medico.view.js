// js/views/medico.view.js
import Auth from '../core/auth.js';
import DB from '../core/db.js';
import Api from '../core/api.js';
import HistorialModulo from '../modules/historial.js';
import MedicosModulo from '../modules/medicos.js';
import { formatearFecha } from '../core/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    Auth.checkGuard();

    const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
    const perfilMed = DB.state.medicos.find(m => m.usuarioId === sesion.id);

    if (!perfilMed) {
        alert("Error: No tienes un perfil médico asignado.");
        Auth.logout();
        return;
    }

    const espMed = DB.state.especialidades.find(e => e.id === perfilMed.especialidadId);
    document.getElementById('medico-name').textContent = `Dr. ${sesion.nombre}`;
    const badgeEsp = document.getElementById('medico-esp');
    if (badgeEsp) badgeEsp.textContent = espMed ? espMed.nombre : 'General';

    // Navegación
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
            renderSection(target);
        };
    });

    const renderSection = (id) => {
        if (id === 'sec-agenda') renderAgenda();
        if (id === 'sec-pacientes-med') renderPacientes();
        if (id === 'sec-perfil-med') cargarPerfil();
    };

    // ── AGENDA (ahora desde el backend) ──────────────────
    const renderAgenda = async () => {
        const body = document.getElementById('table-agenda-body');
        body.innerHTML = '<tr><td colspan="6" style="text-align:center;">Cargando agenda...</td></tr>';

        try {
            const misCitas = await Api.getCitas({ medicoId: perfilMed.id });

            if (misCitas.length === 0) {
                body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No tienes citas programadas.</td></tr>';
                return;
            }

            body.innerHTML = misCitas.sort((a, b) => a.fecha.localeCompare(b.fecha)).map(c => {
                const pac = DB.state.pacientes.find(p => p.id === c.pacienteId);
                return `
                    <tr>
                        <td>${c.fecha}</td>
                        <td>${c.hora}</td>
                        <td><b>${pac ? pac.nombre : 'N/A'}</b></td>
                        <td>${c.motivo}</td>
                        <td><span class="badge ${c.estado === 'confirmada' ? 'badge-success' : 'badge-danger'}">${c.estado}</span></td>
                        <td>
                            ${c.estado === 'confirmada' ? `<button class="btn-primary btn-small btn-atender" data-cid="${c._id || c.id}" data-pid="${c.pacienteId}">Atender</button>` : ''}
                            <button class="btn-secondary btn-small btn-hist" data-pid="${c.pacienteId}">Historial</button>
                        </td>
                    </tr>
                `;
            }).join('');

            attachButtons();
        } catch (e) {
            body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:red;">Error: ${e.message}</td></tr>`;
        }
    };

    const renderPacientes = () => {
        const body = document.getElementById('table-pacientes-list-body');
        const searchInput = document.getElementById('search-paciente');
        const search = searchInput ? searchInput.value.toLowerCase() : '';
        const filtrados = DB.state.pacientes.filter(p => p.nombre.toLowerCase().includes(search));

        if (filtrados.length === 0) {
            body.innerHTML = '<tr><td colspan="4" style="text-align:center;">Sin resultados.</td></tr>';
            return;
        }

        body.innerHTML = filtrados.map(p => `
            <tr>
                <td>${p.nombre}</td>
                <td>${p.edad || 'N/A'}</td>
                <td>${p.genero || 'N/A'}</td>
                <td><button class="btn-secondary btn-small btn-hist" data-pid="${p.id}">Ver Historial</button></td>
            </tr>
        `).join('');

        attachButtons();
    };

    const attachButtons = () => {
        document.querySelectorAll('.btn-atender').forEach(btn => {
            btn.onclick = () => abrirModalAtencion(btn.dataset.cid, btn.dataset.pid);
        });
        document.querySelectorAll('.btn-hist').forEach(btn => {
            btn.onclick = () => verHistorial(btn.dataset.pid);
        });
    };

    // Modal atención
    let citaActual = null, pacienteActual = null;

    const abrirModalAtencion = (citaId, pacienteId) => {
        const pac = DB.state.pacientes.find(p => p.id === pacienteId);
        if (!pac) return;
        citaActual = citaId;
        pacienteActual = pacienteId;
        document.getElementById('at-paciente-nombre').textContent = pac.nombre;
        document.getElementById('modal-atencion').classList.remove('hidden');
    };

    document.getElementById('btn-close-atencion').onclick = () =>
        document.getElementById('modal-atencion').classList.add('hidden');

    document.getElementById('btn-save-atencion').onclick = () => {
        const datos = {
            tipo: document.getElementById('at-tipo').value,
            titulo: document.getElementById('at-resumen').value,
            detalle: document.getElementById('at-detalle').value,
            citaId: citaActual
        };
        if (!datos.titulo || !datos.detalle) return alert("Completa el resumen y el detalle.");
        try {
            HistorialModulo.agregarRegistro(pacienteActual, datos);
            document.getElementById('modal-atencion').classList.add('hidden');
            renderAgenda();
            alert("Atención registrada con éxito.");
            document.getElementById('at-resumen').value = '';
            document.getElementById('at-detalle').value = '';
        } catch (e) {
            alert(e.message);
        }
    };

    const verHistorial = (pacienteId) => {
        const pac = DB.state.pacientes.find(p => p.id === pacienteId);
        if (!pac) return;
        const container = document.getElementById('historial-container');
        const historial = HistorialModulo.obtenerHistorialPaciente(pacienteId);
        document.getElementById('hist-paciente-nombre').textContent = pac.nombre;
        container.innerHTML = historial.length === 0
            ? "<p>No hay registros clínicos para este paciente.</p>"
            : historial.map(h => `
                <div class="card" style="margin-bottom:1rem; border-left:4px solid var(--primary);">
                    <div style="display:flex; justify-content:space-between;">
                        <strong>${h.tipo}: ${h.titulo}</strong>
                        <small>${formatearFecha(h.fecha)}</small>
                    </div>
                    <p style="margin-top:0.5rem;">${h.detalle}</p>
                </div>
            `).join('');
        document.getElementById('modal-ver-historial').classList.remove('hidden');
    };

    document.getElementById('btn-close-historial').onclick = () =>
        document.getElementById('modal-ver-historial').classList.add('hidden');

    const cargarPerfil = () => {
        document.getElementById('m-pf-nombre').value = sesion.nombre;
        document.getElementById('m-pf-cedula').value = perfilMed.cedula;
        document.getElementById('m-pf-esp').value = espMed ? espMed.nombre : 'General';
        document.getElementById('m-pf-email').value = perfilMed.email || '';
    };

    document.getElementById('btn-save-pf-med').onclick = () => {
        const email = document.getElementById('m-pf-email').value;
        MedicosModulo.actualizarMedico(perfilMed.id, {
            nombre: sesion.nombre, cedula: perfilMed.cedula,
            especialidadId: perfilMed.especialidadId, email
        });
        alert("Información de contacto actualizada.");
    };

    document.getElementById('btn-logout').onclick = () => Auth.logout();

    const searchInput = document.getElementById('search-paciente');
    if (searchInput) searchInput.oninput = renderPacientes;

    renderAgenda();
});
