// backend/seed.js — Poblar la BD con datos iniciales
import 'dotenv/config';
import mongoose from 'mongoose';
import Usuario from './models/Usuario.js';
import Paciente from './models/Paciente.js';
import Medico from './models/Medico.js';

// Mismo hash que usa el frontend (hosp_salt_2026)
const hashPwd = (pwd, sal = 'hosp_salt_2026') => {
    const txt = sal + pwd + sal;
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = (h * 16777619) >>> 0; }
    let h2 = 5381;
    for (let i = 0; i < txt.length; i++) h2 = ((h2 << 5) + h2 + txt.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0');
};

await mongoose.connect(process.env.MONGODB_URI);
console.log('✅ Conectado a MongoDB Atlas');

// Limpiar colecciones
await Promise.all([Usuario.deleteMany(), Paciente.deleteMany(), Medico.deleteMany()]);

// Usuarios base
const admin = await Usuario.create({
    email: 'admin@hospital.mx', pass: hashPwd('Admin123!'),
    rol: 'admin', nombre: 'Administrador General'
});
const usrDoc = await Usuario.create({
    email: 'doctor@hospital.mx', pass: hashPwd('Doctor123!'),
    rol: 'medico', nombre: 'Dr. García (Prueba)', telefono: '5559876543'
});
const usrPac = await Usuario.create({
    email: 'paciente@hospital.mx', pass: hashPwd('Paciente123!'),
    rol: 'paciente', nombre: 'Juan Prueba', telefono: '5551234567'
});

// Perfil médico
await Medico.create({
    usuarioId: usrDoc._id, cedula: '12345678',
    especialidad: 'Medicina General',
    email: usrDoc.email, telefono: usrDoc.telefono
});

// Perfil paciente
await Paciente.create({
    usuarioId: usrPac._id, nombre: usrPac.nombre,
    email: usrPac.email, telefono: usrPac.telefono
});

console.log('✅ Base de datos poblada con éxito');
console.log('   admin@hospital.mx     / Admin123!');
console.log('   doctor@hospital.mx    / Doctor123!');
console.log('   paciente@hospital.mx  / Paciente123!');
await mongoose.disconnect();
