// js/views/medico.view.js
import Auth from '../core/auth.js';
import DB from '../core/db.js';
import HistorialModulo from '../modules/historial.js';
import MedicosModulo from '../modules/medicos.js';
import { formatearFecha } from '../core/utils.js';

document.addEventListener('DOMContentLoaded', () => {
    // 1. Proteger ruta (Regla 2)
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

    // 2. Navegación
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

    // 3. Renderizado de Secciones
    const renderSection = (id) => {
        if (id === 'sec-agenda') renderAgenda();
        if (id === 'sec-pacientes-med') renderPacientes();
        if (id === 'sec-perfil-med') cargarPerfil();
    };

    const renderAgenda = () => {
        const body = document.getElementById('table-agenda-body');
        const misCitas = DB.state.citas.filter(c => c.medicoId === perfilMed.id);
        
        if (misCitas.length === 0) {
            body.innerHTML = '<tr><td colspan="6" style="text-align:center;">No tienes citas programadas.</td></tr>';
            return;
        }

        body.innerHTML = misCitas.sort((a,b) => a.fecha.localeCompare(b.fecha)).map(c => {
            const pac = DB.state.pacientes.find(p => p.id === c.pacienteId);
            return `
                <tr>
                    <td>${c.fecha}</td>
                    <td>${c.hora}</td>
                    <td><b>${pac ? pac.nombre : 'N/A'}</b></td>
                    <td>${c.motivo}</td>
                    <td><span class="badge ${c.estado === 'confirmada' ? 'badge-success' : (c.estado === 'atendida' ? 'badge-primary' : 'badge-danger')}">${c.estado}</span></td>
                    <td>
                        ${c.estado === 'confirmada' ? `<button class="btn-primary btn-small btn-atender" data-cid="${c.id}" data-pid="${c.pacienteId}">Atender</button>` : ''}
                        <button class="btn-secondary btn-small btn-hist" data-pid="${c.pacienteId}">Historial</button>
                    </td>
                </tr>
            `;
        }).join('');

        attachButtons();
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
                <td>
                    <button class="btn-secondary btn-small btn-hist" data-pid="${p.id}">Ver Historial</button>
                </td>
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

    // 4. Lógica de Atención (Regla 7)
    let citaActual = null;
    let pacienteActual = null;

    const abrirModalAtencion = (citaId, pacienteId) => {
        const pac = DB.state.pacientes.find(p => p.id === pacienteId);
        if(!pac) return;
        citaActual = citaId;
        pacienteActual = pacienteId;
        document.getElementById('at-paciente-nombre').textContent = pac.nombre;
        document.getElementById('modal-atencion').classList.remove('hidden');
    };

    document.getElementById('btn-close-atencion').onclick = () => {
        document.getElementById('modal-atencion').classList.add('hidden');
    };

    document.getElementById('btn-save-atencion').onclick = () => {
        const datos = {
            tipo: document.getElementById('at-tipo').value,
            titulo: document.getElementById('at-resumen').value,
            detalle: document.getElementById('at-detalle').value,
            citaId: citaActual
        };

        if (!datos.titulo || !datos.detalle) return alert("Completa el resumen y el detalle.");

        try {
            // El módulo detecta automáticamente al médico de la sesión (Regla 7)
            HistorialModulo.agregarRegistro(pacienteActual, datos);
            document.getElementById('modal-atencion').classList.add('hidden');
            renderAgenda();
            alert("Atención registrada con éxito.");
            // Limpiar campos
            document.getElementById('at-resumen').value = '';
            document.getElementById('at-detalle').value = '';
        } catch (e) {
            alert(e.message);
        }
    };

// 5. Historial Clínico
    const verHistorial = (pacienteId) => {
        const pac = DB.state.pacientes.find(p => p.id === pacienteId);
        if(!pac) return;
        const container = document.getElementById('historial-container');
        const historial = HistorialModulo.obtenerHistorialPaciente(pacienteId);

        document.getElementById('hist-paciente-nombre').textContent = pac.nombre;
        
        if (historial.length === 0) {
            container.innerHTML = "<p>No hay registros clínicos para este paciente.</p>";
        } else {
            // AQUÍ AGREGAMOS EL BOTÓN DE EDITAR A CADA TARJETA
            container.innerHTML = historial.map(h => `
                <div class="card" style="margin-bottom: 1rem; border-left: 4px solid var(--primary);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <strong>${h.tipo}: ${h.titulo}</strong>
                        <div style="text-align: right;">
                            <small>${formatearFecha(h.fecha)}</small><br>
                            <button class="btn-warning btn-small" onclick="abrirEdicionHistorial('${h.id}')" style="margin-top: 5px;">✏️ Editar</button>
                        </div>
                    </div>
                    <p style="margin-top:0.5rem; font-size: 0.9rem; color:#334155;">${h.detalle}</p>
                    <div style="font-size:0.7rem; color:#64748b; margin-top:0.5rem; text-align:right;">
                        Médico ID: ${h.medicoId}
                    </div>
                </div>
            `).join('');
        }
        document.getElementById('modal-ver-historial').classList.remove('hidden');
    };

    document.getElementById('btn-close-historial').onclick = () => {
        document.getElementById('modal-ver-historial').classList.add('hidden');
    };

    // --- NUEVA LÓGICA DE EDICIÓN ---
    window.abrirEdicionHistorial = (registroId) => {
        const registro = DB.state.historiales.find(h => h.id === registroId);
        if (!registro) return;
        
        document.getElementById('edit-hist-id').value = registro.id;
        document.getElementById('edit-hist-tipo').value = registro.tipo;
        document.getElementById('edit-hist-titulo').value = registro.titulo;
        document.getElementById('edit-hist-detalle').value = registro.detalle;
        
        // Ocultamos la vista de historial y abrimos el modal de edición
        document.getElementById('modal-ver-historial').classList.add('hidden');
        document.getElementById('modal-editar-historial').classList.remove('hidden');
    };

    document.getElementById('btn-close-edit-hist').onclick = () => {
        document.getElementById('modal-editar-historial').classList.add('hidden');
        document.getElementById('modal-ver-historial').classList.remove('hidden'); // Volvemos a la vista anterior
    };

    document.getElementById('btn-save-edit-hist').onclick = () => {
        const id = document.getElementById('edit-hist-id').value;
        const nuevosDatos = {
            tipo: document.getElementById('edit-hist-tipo').value,
            titulo: document.getElementById('edit-hist-titulo').value,
            detalle: document.getElementById('edit-hist-detalle').value
        };

        try {
            HistorialModulo.editarRegistro(id, nuevosDatos);
            alert("Registro actualizado correctamente.");
            
            document.getElementById('modal-editar-historial').classList.add('hidden');
            
            // Recargamos el historial para ver los cambios reflejados inmediatamente
            const registroActualizado = DB.state.historiales.find(h => h.id === id);
            verHistorial(registroActualizado.pacienteId);
        } catch (e) {
            alert(e.message);
        }
    };

    // 6. Perfil Médico
    const cargarPerfil = () => {
        document.getElementById('m-pf-nombre').value = sesion.nombre;
        document.getElementById('m-pf-cedula').value = perfilMed.cedula;
        document.getElementById('m-pf-esp').value = espMed ? espMed.nombre : 'General';
        document.getElementById('m-pf-email').value = perfilMed.email || '';
    };

    document.getElementById('btn-save-pf-med').onclick = () => {
        const email = document.getElementById('m-pf-email').value;
        MedicosModulo.actualizarMedico(perfilMed.id, { 
            nombre: sesion.nombre, 
            cedula: perfilMed.cedula, 
            especialidadId: perfilMed.especialidadId, 
            email 
        });
        alert("Información de contacto actualizada.");
    };

    document.getElementById('btn-logout').onclick = () => Auth.logout();
    
    const searchInput = document.getElementById('search-paciente');
    if (searchInput) searchInput.oninput = renderPacientes;

    // Inicio
    renderAgenda();
});
