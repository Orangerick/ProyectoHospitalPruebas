// js/core/db.js

/**
 * Motor de Persistencia y Auditoría
 * Maneja el estado global del sistema y sincroniza con LocalStorage/Firebase.
 */
const DB = {
    // Estado inicial del sistema
    state: {
        usuarios: [
            { id: 'admin_1', user: 'admin', pass: '88d43d772945d8b8', rol: 'admin', nombre: 'Administrador General', activo: true }
        ],
        pacientes: [],
        medicos: [],
        especialidades: [
            { id: 1, nombre: 'Medicina General' },
            { id: 2, nombre: 'Cardiología' },
            { id: 3, nombre: 'Pediatría' }
        ],
        citas: [],
        historiales: [],
        logs: []
    },

    /**
     * Carga los datos desde el almacenamiento
     */
    async init() {
        const localData = localStorage.getItem('hospital_db');
        if (localData) {
            this.state = JSON.parse(localData);
        } else {
            this.save(); // Inicializar con admin por defecto
        }
    },

    /**
     * Guarda el estado actual y sincroniza
     */
    save() {
        localStorage.setItem('hospital_db', JSON.stringify(this.state));
    },

    /**
     * Registro de Auditoría Avanzada (HU29 / Regla 8)
     */
    registrarLog(accion, detalle) {
        let sesion = null;
        try {
            sesion = JSON.parse(sessionStorage.getItem('hospital_sesion'));
        } catch(e) {}
        
        const log = {
            id: Date.now(),
            fecha: new Date().toISOString(),
            usuario: sesion ? sesion.user : 'Sistema/Anonimo',
            rol: sesion ? sesion.rol : 'N/A',
            accion: accion,
            detalle: detalle
        };
        this.state.logs.unshift(log);
        if (this.state.logs.length > 500) this.state.logs.pop();
        this.save();
    },

    // --- Helpers CRUD Genéricos ---
    
    add(coleccion, item) {
        this.state[coleccion].push(item);
        this.save();
    },

    update(coleccion, id, newData, idKey = 'id') {
        const index = this.state[coleccion].findIndex(x => x[idKey] === id);
        if (index !== -1) {
            this.state[coleccion][index] = { ...this.state[coleccion][index], ...newData };
            this.save();
            return true;
        }
        return false;
    },

    delete(coleccion, id, idKey = 'id') {
        this.state[coleccion] = this.state[coleccion].filter(x => x[idKey] !== id);
        this.save();
    }
};

// Inicialización inmediata
DB.init();
export default DB;
