// js/core/api.js
// Capa de comunicación con el backend en http://localhost:3000

const API_URL = 'http://localhost:3000/api';

const Api = {

    async request(method, endpoint, body = null) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) opts.body = JSON.stringify(body);

        const res = await fetch(`${API_URL}${endpoint}`, opts);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Error en el servidor');
        return data;
    },

    // ── CITAS ──────────────────────────────────────────────

    // HU16 + HU27: Agendar cita con validaciones en el backend
    agendarCita(datos) {
        return this.request('POST', '/citas', datos);
    },

    // Obtener citas (filtrar por pacienteId o medicoId)
    getCitas(filtros = {}) {
        const params = new URLSearchParams(filtros).toString();
        return this.request('GET', `/citas${params ? '?' + params : ''}`);
    },

    // HU18: Cancelar cita
    cancelarCita(citaId) {
        return this.request('PATCH', `/citas/${citaId}/cancelar`);
    },

    // HU19: Reprogramar cita
    reprogramarCita(citaId, nuevaFecha, nuevaHora) {
        return this.request('PATCH', `/citas/${citaId}/reprogramar`, { nuevaFecha, nuevaHora });
    }
};

export default Api;
