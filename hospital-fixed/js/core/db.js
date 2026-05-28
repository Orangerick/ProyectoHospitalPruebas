// js/core/db.js

/**
 * Motor de Persistencia y Auditoría
 * Maneja el estado global del sistema y sincroniza con LocalStorage/Firebase.
 */
const DB = {
    // Estado inicial del sistema
    state: {
        usuarios: [
            { id: 'admin_1', email: 'admin@hospital.mx', pass: '87614448187757d0', rol: 'admin', nombre: 'Administrador General', activo: true, intentosFallidos: 0, bloqueado: false },
            { id: 'usr_doc_test', email: 'doctor@hospital.mx', pass: 'b86a2ac8d76e9392', rol: 'medico', nombre: 'Dr. Casa (Prueba)', activo: true, intentosFallidos: 0, bloqueado: false },
            { id: 'usr_pac_test', email: 'paciente@hospital.mx', pass: '6fa0c2042b5c4dd0', rol: 'paciente', nombre: 'Juan Prueba', activo: true, intentosFallidos: 0, bloqueado: false }
        ],
        pacientes: [
            { id: 'pac_test', usuarioId: 'usr_pac_test', nombre: 'Juan Prueba', email: 'juan@prueba.com', telefono: '555-1234', fechaRegistro: new Date().toISOString(), activo: true }
        ],
        medicos: [
            // Agregamos el campo 'telefono' y alineamos el email con el usuario
            { id: 'med_test', usuarioId: 'usr_doc_test', cedula: '12345678', especialidadId: 1, email: 'doctor@hospital.mx', telefono: '555-9876543', activo: true }
        ],
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

            // Asegurar que los usuarios de prueba existan/se actualicen (solo para desarrollo)
            const testUsers = [
                { id: 'admin_1', email: 'admin@hospital.mx', pass: '87614448187757d0', rol: 'admin', nombre: 'Administrador General', activo: true, intentosFallidos: 0, bloqueado: false },
                { id: 'usr_doc_test', email: 'doctor@hospital.mx', pass: 'b86a2ac8d76e9392', rol: 'medico', nombre: 'Dr. Casa (Prueba)', activo: true, intentosFallidos: 0, bloqueado: false },
                { id: 'usr_pac_test', email: 'paciente@hospital.mx', pass: '6fa0c2042b5c4dd0', rol: 'paciente', nombre: 'Juan Prueba', activo: true, intentosFallidos: 0, bloqueado: false }
            ];

            testUsers.forEach(tu => {
                // Ahora validamos la existencia del usuario usando el email en lugar de 'user'
                const idx = this.state.usuarios.findIndex(u => u.email === tu.email);
                if (idx !== -1) {
                    // Actualizamos para limpiar rastros de la propiedad 'user' antigua
                    this.state.usuarios[idx] = tu;
                } else {
                    this.state.usuarios.push(tu);
                }
            });

            // Asegurar perfiles de prueba
            if (!this.state.medicos.some(m => m.id === 'med_test')) {
                this.state.medicos.push({ id: 'med_test', usuarioId: 'usr_doc_test', cedula: '12345678', especialidadId: 1, email: 'doctor@hospital.mx', telefono: '555-9876543', activo: true });
            }
            if (!this.state.pacientes.some(p => p.id === 'pac_test')) {
                this.state.pacientes.push({ id: 'pac_test', usuarioId: 'usr_pac_test', nombre: 'Juan Prueba', email: 'juan@prueba.com', telefono: '555-1234', fechaRegistro: new Date().toISOString(), activo: true });
            }

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
            // Cambiamos sesion.user a sesion.email porque el campo user ya no existe
            usuario: sesion ? sesion.email : 'Sistema/Anonimo',
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