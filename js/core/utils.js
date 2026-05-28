// js/core/utils.js

/**
 * Utilidades Globales
 */
export const hashPwd = (pwd, sal = 'hosp_salt_2026') => {
    const txt = sal + pwd + sal;
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { 
        h ^= txt.charCodeAt(i); 
        h = (h * 16777619) >>> 0; 
    }
    let h2 = 5381;
    for (let i = 0; i < txt.length; i++) h2 = ((h2 << 5) + h2 + txt.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0');
};

export const generarID = (prefijo) => prefijo + '_' + Math.random().toString(36).substr(2, 9);

export const formatearFecha = (isoString) => {
    return new Date(isoString).toLocaleString('es-MX', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

export const validarCedula = (cedula) => {
    // Validación genérica: al menos 7 u 8 dígitos numéricos
    return /^[0-9]{7,10}$/.test(cedula);
};

export const validarEmail = (email) => {
    // Validación flexible: Requiere texto, un arroba (@) y texto después. No fuerza el .com
    return /^[^\s@]+@[^\s@]+$/.test(email);
};
