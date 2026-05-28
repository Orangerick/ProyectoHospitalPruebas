// js/modules/historial.js
import DB from '../core/db.js';
import { generarID } from '../core/utils.js';

/**
 * Gestión de Historial Clínico (Regla 7)
 */
const HistorialModulo = {
    /**
     * Registrar nueva entrada al historial
     */
    agregarRegistro(pacienteId, datos) {
        // datos: { tipo, titulo, detalle, citaId? }
        
        // Obtener ID del médico desde la sesión actual (Regla 7)
        const sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
        if (!sesion || sesion.rol !== 'medico') {
            throw new Error("Acceso denegado. Solo médicos pueden registrar historial.");
        }

        // Buscamos el perfil de médico asociado al usuario logueado
        const perfilMedico = DB.state.medicos.find(m => m.usuarioId === sesion.id);
        if (!perfilMedico) throw new Error("No se encontró el perfil profesional del médico.");

        const nuevoRegistro = {
            id: generarID('hc'),
            pacienteId: pacienteId,
            medicoId: perfilMedico.id, // ID automático de la sesión
            citaId: datos.citaId || null,
            tipo: datos.tipo, // Consulta, Diagnóstico, Tratamiento, etc.
            titulo: datos.titulo,
            detalle: datos.detalle,
            fecha: new Date().toISOString()
        };

        DB.add('historiales', nuevoRegistro);
        
        // Si hay una cita asociada, marcarla como 'atendida'
        if (datos.citaId) {
            DB.update('citas', datos.citaId, { estado: 'atendida' });
        }

        DB.registrarLog('Historial Creado', `Médico ${perfilMedico.id} registró atención para paciente ${pacienteId}`);
        
        return nuevoRegistro;
    },

    /**
     * Editar una entrada existente del historial clínico
     */
    editarRegistro(registroId, nuevosDatos) {
        const registro = DB.state.historiales.find(h => h.id === registroId);
        if (!registro) throw new Error("No se encontró el registro clínico.");

        // Actualizamos los campos
        if (nuevosDatos.tipo) registro.tipo = nuevosDatos.tipo;
        if (nuevosDatos.titulo) registro.titulo = nuevosDatos.titulo;
        if (nuevosDatos.detalle) registro.detalle = nuevosDatos.detalle;

        // Sobreescribimos en la base de datos
        DB.update('historiales', registroId, registro);
        
        // Log de auditoría para saber que alguien modificó un expediente
        DB.registrarLog('Historial Editado', `Se modificó el registro ${registroId}`);
        
        return registro;
    },

    /**
     * Obtener historial completo de un paciente
     */
    obtenerHistorialPaciente(pacienteId) {
        return DB.state.historiales
            .filter(h => h.pacienteId === pacienteId)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    }
};

export default HistorialModulo;
