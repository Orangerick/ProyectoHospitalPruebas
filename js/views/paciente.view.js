// js/views/paciente.view.js
import Auth from '../core/auth.js';
import DB from '../core/db.js';
import CitasModulo from '../modules/citas.js';
import PacientesModulo from '../modules/pacientes.js';

document.addEventListener('DOMContentLoaded', () => {
    Auth.checkGuard();
    const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
    const miPerfil = DB.state.pacientes.find(p => p.usuarioId === sesion.id);

    if(!miPerfil) {
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

    const renderCitas = () => {
        const body = document.getElementById('table-citas-body');
        const misCitas = DB.state.citas.filter(c => c.pacienteId === miPerfil.id);
        
        if (misCitas.length === 0) {
            body.innerHTML = '<tr><td colspan="5" style="text-align:center;">No tienes citas programadas.</td></tr>';
            return;
        }

        body.innerHTML = misCitas.map(c => {
            const med = DB.state.medicos.find(m => m.id === c.medicoId);
            const medUser = med ? DB.state.usuarios.find(u => u.id === med.usuarioId) : null;
            return `
                <tr>
                    <td>${c.fecha}</td>
                    <td>${c.hora}</td>
                    <td>Dr. ${medUser ? medUser.nombre : 'N/A'}</td>
                    <td><span class="badge ${c.estado === 'cancelada' ? 'badge-danger' : 'badge-success'}">${c.estado}</span></td>
                    <td>
                        ${c.estado === 'confirmada' ? `<button class="btn-danger btn-small" onclick="alert('Cancelar cita en desarrollo')">Cancelar</button>` : ''}
                    </td>
                </tr>
            `;
        }).join('');
    };

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
    };

    // Modal Citas
    const modal = document.getElementById('modal-cita');
    document.getElementById('btn-nueva-cita').onclick = () => {
        const select = document.getElementById('c-medico');
        select.innerHTML = DB.state.medicos.filter(m => m.activo).map(m => {
            const u = DB.state.usuarios.find(user => user.id === m.usuarioId);
            const e = DB.state.especialidades.find(esp => esp.id === m.especialidadId);
            return `<option value="${m.id}">Dr. ${u ? u.nombre : 'N/A'} (${e ? e.nombre : 'N/A'})</option>`;
        }).join('');
        modal.classList.remove('hidden');
    };

    document.getElementById('btn-close-cita').onclick = () => modal.classList.add('hidden');

    document.getElementById('btn-confirmar-cita').onclick = () => {
        const datos = {
            pacienteId: miPerfil.id,
            medicoId: document.getElementById('c-medico').value,
            fecha: document.getElementById('c-fecha').value,
            hora: document.getElementById('c-hora').value,
            motivo: document.getElementById('c-motivo').value
        };

        if(!datos.medicoId || !datos.fecha || !datos.motivo) {
            alert("Completa los campos obligatorios.");
            return;
        }

        try {
            CitasModulo.agendarCita(datos);
            modal.classList.add('hidden');
            renderCitas();
            alert("¡Cita agendada con éxito!");
            
            //Limpiar form
            document.getElementById('c-fecha').value = '';
            document.getElementById('c-motivo').value = '';

        } catch (e) {
            alert(e.message);
        }
    };

    document.getElementById('btn-save-perfil').onclick = () => {
        const datos = {
            nombre: document.getElementById('p-nombre').value,
            email: document.getElementById('p-email').value,
            telefono: document.getElementById('p-tel').value
        };
        PacientesModulo.actualizarPaciente(miPerfil.id, datos);
        alert("Perfil actualizado.");
    };

    document.getElementById('btn-logout').onclick = () => Auth.logout();
    
    renderCitas();
});
