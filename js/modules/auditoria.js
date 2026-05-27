// js/modules/auditoria.js
import DB from '../core/db.js';

const AuditoriaModulo = {
    obtenerLogs() {
        return DB.state.logs;
    },

    filtrarLogs(termino) {
        const busqueda = termino.toLowerCase();
        return DB.state.logs.filter(l => 
            l.accion.toLowerCase().includes(busqueda) || 
            l.detalle.toLowerCase().includes(busqueda) ||
            l.usuario.toLowerCase().includes(busqueda)
        );
    },

    limpiarLogs() {
        // Solo permitido para Admin
        const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
        if (sesion?.rol === 'admin') {
            DB.state.logs = [];
            DB.registrarLog('Limpieza Logs', 'El administrador vació la tabla de auditoría.');
            DB.save();
        }
    }
};

export default AuditoriaModulo;
