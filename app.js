// ============ CAPA DE PERSISTENCIA (Firebase o local) ============
  function store() {
    return window.__FB_READY__ && window.fbStorage ? window.fbStorage : window.storage;
  }

  // ============ CIFRADO Y VALIDACIÓN ============
  function hashPwd(pwd, sal = 'hosp_salt_2026') {
    const txt = sal + pwd + sal;
    let h = 2166136261;
    for (let i = 0; i < txt.length; i++) { h ^= txt.charCodeAt(i); h = (h * 16777619) >>> 0; }
    let h2 = 5381;
    for (let i = 0; i < txt.length; i++) h2 = ((h2 << 5) + h2 + txt.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0');
  }
  function validarPwd(pwd) {
    if (pwd.length < 6) return { ok:false, msg:'Mínimo 6 caracteres', nivel:1 };
    let nivel = 1;
    if (pwd.length >= 8) nivel++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) nivel++;
    if (/[0-9]/.test(pwd)) nivel++;
    if (/[^A-Za-z0-9]/.test(pwd)) nivel++;
    if (nivel < 3) return { ok:false, msg:'Débil: usa mayúsculas, minúsculas y números', nivel };
    return { ok:true, msg: nivel >= 4 ? 'Fuerte ✓' : 'Aceptable ✓', nivel };
  }
  function validarEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function genToken() { return 'tk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10); }
  function iniciales(n) { return (n||'?').split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(); }

  // ============ DATOS ============
  let datos = {
    usuarios: [
      { user:'admin', pass:hashPwd('Admin123'), rol:'admin', nombre:'Administrador', email:'admin@hospital.mx', telefono:'', direccion:'', foto:'', activo:true, creado:Date.now() },
      { user:'doctor', pass:hashPwd('Doctor123'), rol:'doctor', nombre:'Dr. Genérico', email:'doctor@hospital.mx', telefono:'', direccion:'', foto:'', activo:true, creado:Date.now() },
      { user:'paciente', pass:hashPwd('Paciente123'), rol:'paciente', nombre:'Paciente Demo', email:'paciente@hospital.mx', telefono:'', direccion:'', foto:'', activo:true, creado:Date.now() }
    ],
    especialidades: [
      { id: 1, nombre_especialidad: 'Medicina General' },
      { id: 2, nombre_especialidad: 'Cardiología' },
      { id: 3, nombre_especialidad: 'Pediatría' },
      { id: 4, nombre_especialidad: 'Ginecología' },
      { id: 5, nombre_especialidad: 'Traumatología' }
    ],
    pacientes: [], medicos: [], citas: [],
    historiales: {}, log: [], sesiones: []
  };
  let sesion = null;
  let ordenUsuarios = { campo: 'user', asc: true };
  const SESSION_DURATION = 30 * 60 * 1000;

  async function guardar() {
    try { await store().set('hospital_v3', JSON.stringify(datos)); } catch(e) { console.warn('guardar() falló', e); }
  }
  async function cargar() {
    try {
      const r = await store().get('hospital_v3');
      if (r && r.value) {
        const d = JSON.parse(r.value);
        if (!Array.isArray(d.especialidades)) d.especialidades = datos.especialidades;
        if (!d.usuarios.some(u => u.rol === 'paciente')) {
          d.usuarios.push({ user:'paciente', pass:hashPwd('Paciente123'), rol:'paciente', nombre:'Paciente Demo', email:'paciente@hospital.mx', telefono:'', direccion:'', foto:'', activo:true, creado:Date.now() });
        }
        datos = d;
      }
    } catch(e) { console.warn('cargar() falló', e); }
  }
  async function guardarSesion() {
    try {
      if (sesion) await store().set('hospital_sesion_v3', JSON.stringify(sesion));
      else await store().delete('hospital_sesion_v3');
    } catch(e) {}
  }
  async function cargarSesion() {
    try {
      const r = await store().get('hospital_sesion_v3');
      if (r && r.value) {
        const s = JSON.parse(r.value);
        if (s.expira > Date.now() && datos.sesiones.find(x => x.token === s.token)) sesion = s;
        else { await store().delete('hospital_sesion_v3'); datos.sesiones = datos.sesiones.filter(x => x.token !== s.token); }
      }
    } catch(e) {}
  }

  function destruirToken() {
    if (!sesion) return;
    datos.sesiones = datos.sesiones.filter(s => s.token !== sesion.token);
    log('Cierre de sesión', sesion.user, 'Token destruido: ' + sesion.token.slice(0, 12) + '...');
    sesion = null;
    guardarSesion(); guardar();
  }
  function renovarSesion() {
    if (!sesion) return;
    sesion.expira = Date.now() + SESSION_DURATION;
    const s = datos.sesiones.find(x => x.token === sesion.token);
    if (s) s.expira = sesion.expira;
    guardarSesion(); guardar(); actualizarSessionInfo();
  }
  function iniciarVigilanciaSesion() {
    ['click','keydown','mousemove'].forEach(ev => document.addEventListener(ev, () => { if (sesion) renovarSesion(); }, { passive: true }));
    setInterval(() => {
      if (sesion && sesion.expira < Date.now()) { alert('Tu sesión ha expirado por inactividad.'); logout(); }
      actualizarSessionInfo();
    }, 30000);
  }
  function actualizarSessionInfo() {
    if (!sesion) return;
    const restante = Math.max(0, sesion.expira - Date.now());
    const min = Math.floor(restante / 60000);
    const seg = Math.floor((restante % 60000) / 1000);
    const el = document.getElementById('sessionInfo');
    if (el) el.innerHTML = `🔑 Token: <code>${sesion.token.slice(0,16)}...</code> &nbsp;|&nbsp; ⏱️ Sesión expira en: <b>${min}m ${seg}s</b>`;
  }

  function log(accion, usuario, detalle = '') {
    datos.log.unshift({ fecha: new Date().toISOString(), usuario, accion, detalle });
    if (datos.log.length > 200) datos.log = datos.log.slice(0, 200);
    guardar();
  }

  // ============ AUTH ============
  function switchAuth(t) {
    document.getElementById('formLogin').classList.toggle('hidden', t !== 'login');
    document.getElementById('formRegister').classList.toggle('hidden', t !== 'register');
    document.getElementById('tabLogin').classList.toggle('active', t === 'login');
    document.getElementById('tabRegister').classList.toggle('active', t === 'register');
  }
  function login() {
    const u = document.getElementById('user').value.trim();
    const p = document.getElementById('pass').value;
    if (!u || !p) { document.getElementById('err').textContent = 'Ingresa usuario y contraseña'; return; }
    const usr = datos.usuarios.find(x => x.user === u && x.pass === hashPwd(p));
    if (!usr) { document.getElementById('err').textContent = 'Usuario o contraseña incorrectos'; log('Intento fallido de login', u, 'Credenciales inválidas'); return; }
    if (!usr.activo) { document.getElementById('err').textContent = 'Usuario deshabilitado'; return; }
    const token = genToken();
    sesion = { user: usr.user, rol: usr.rol, token, inicio: Date.now(), expira: Date.now() + SESSION_DURATION };
    datos.sesiones.push({ ...sesion });
    log('Inicio de sesión', usr.user, 'Token: ' + token.slice(0, 12) + '...');
    guardarSesion(); guardar(); mostrarSistema();
  }
  function checkPwd() {
    const p = document.getElementById('r_pass').value;
    const v = validarPwd(p);
    const bar = document.getElementById('pwdBar');
    const msg = document.getElementById('pwdMsg');
    const colors = ['#d32f2f','#ff9800','#fbc02d','#7cb342','#4caf50'];
    bar.style.width = (v.nivel * 20) + '%';
    bar.style.background = colors[Math.min(v.nivel-1, 4)] || '#ccc';
    msg.textContent = v.msg;
    msg.style.color = v.ok ? '#4caf50' : '#d32f2f';
  }
  
   function registrar() {
    // 1. Capturamos los campos del formulario actualizado
    const nombre = document.getElementById('r_nombre').value.trim();
    const email = document.getElementById('r_email').value.trim();
    const tel = document.getElementById('r_tel').value.trim();
    const curp = document.getElementById('r_curp').value.trim().toUpperCase();
    const pregunta = document.getElementById('r_pregunta').value;
    const respuesta = document.getElementById('r_respuesta').value.trim().toLowerCase();
    const p1 = document.getElementById('r_pass').value;
    const p2 = document.getElementById('r_pass2').value;
    
    const rol = 'paciente'; 
    const err = document.getElementById('errReg'); 
    const ok = document.getElementById('okReg');
    err.textContent = ''; ok.textContent = '';
    
    // 2. Validaciones
    if (!nombre || !email || !tel || !curp || !pregunta || !respuesta) { 
        err.textContent = 'Todos los campos son obligatorios'; return; 
    }
    if (!validarEmail(email)) { err.textContent = 'Correo inválido'; return; }
    if (tel.length < 10) { err.textContent = 'Teléfono inválido'; return; }
    
    const pv = validarPwd(p1);
    if (!pv.ok) { err.textContent = pv.msg; return; }
    if (p1 !== p2) { err.textContent = 'Las contraseñas no coinciden'; return; }
    if (datos.usuarios.some(u => u.user === email)) { err.textContent = 'Ese correo ya está registrado'; return; }
    
    // 3. Crear cuenta de usuario (el email es el user)
    datos.usuarios.push({ 
        user: email, 
        nombre, 
        email, 
        rol, 
        pass: hashPwd(p1), 
        telefono: tel, 
        seguridad: { pregunta, respuesta },
        direccion:'', foto:'', activo: true, creado: Date.now() 
    });
    
    // 4. Alta en lista de pacientes
    const idPaciente = Date.now();
    datos.pacientes.push({ 
        id: idPaciente, 
        usuario_id: email, 
        nombre: nombre, 
        edad: null, 
        genero: 'O', 
        diag: 'Pendiente de diagnóstico', 
        tel: tel, 
        curp: curp,
        alergias: '' 
    });
    datos.historiales[idPaciente] = [];
    
    log('Registro de nuevo paciente', email, 'Alta automática con seguridad H5');
    guardar();
    
    ok.textContent = 'Cuenta creada. Ya puedes iniciar sesión.';
    // Limpieza de campos (r_user ya no existe)
    ['r_nombre','r_email','r_tel','r_curp','r_pregunta','r_respuesta','r_pass','r_pass2'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    document.getElementById('pwdBar').style.width = '0%';
    document.getElementById('pwdMsg').textContent = '';
    setTimeout(() => switchAuth('login'), 1500);
}

  function logout() {
    destruirToken();
    document.getElementById('sistema').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    document.getElementById('user').value = ''; document.getElementById('pass').value = '';
    document.getElementById('err').textContent = ''; switchAuth('login');
  }
  function mostrarSistema() {
    document.getElementById('login').classList.add('hidden');
    document.getElementById('sistema').classList.remove('hidden');
    const esAdmin = sesion.rol === 'admin';
    document.getElementById('tabUsuarios').style.display = esAdmin ? 'inline-block' : 'none';
    document.getElementById('tabSupervision').style.display = esAdmin ? 'inline-block' : 'none';
    document.getElementById('tabEsquema').style.display = esAdmin ? 'inline-block' : 'none';
    showTab('dashboard');
    sincronizarPerfil();
    cargarPerfil();
    renderTodo();
    actualizarSessionInfo();
  }

  function logout() {
    destruirToken();
    document.getElementById('sistema').classList.add('hidden');
    document.getElementById('login').classList.remove('hidden');
    document.getElementById('user').value = ''; document.getElementById('pass').value = '';
    document.getElementById('err').textContent = ''; switchAuth('login');
  }
  function mostrarSistema() {
    document.getElementById('login').classList.add('hidden');
    document.getElementById('sistema').classList.remove('hidden');
    const esAdmin = sesion.rol === 'admin';
    document.getElementById('tabUsuarios').style.display = esAdmin ? 'inline-block' : 'none';
    document.getElementById('tabSupervision').style.display = esAdmin ? 'inline-block' : 'none';
    document.getElementById('tabEsquema').style.display = esAdmin ? 'inline-block' : 'none';
    showTab('dashboard');
    sincronizarPerfil();
    cargarPerfil();
    renderTodo();
    actualizarSessionInfo();
  }

  function showTab(s) {
    ['dashboard','pacientes','medicos','especialidades','citas','historial','perfil','usuarios','supervision','esquema'].forEach(x => {
      const el = document.getElementById('sec-' + x);
      if (el) el.classList.add('hidden');
    });
    document.getElementById('sec-' + s).classList.remove('hidden');
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.tab[data-section="${s}"]`).classList.add('active');
    if (s === 'dashboard') renderDashboard();
    if (s === 'supervision') renderSupervision();
    if (s === 'historial') renderSelectHistorial();
    if (s === 'esquema') renderEsquema();
    if (s === 'medicos') renderSelectsMedico();
    if (s === 'especialidades') renderEspecialidades();
  }

  // ============ PACIENTES ============
  function addPaciente() {
    const nombre = document.getElementById('p_nombre').value.trim();
    const edad = document.getElementById('p_edad').value;
    const genero = document.getElementById('p_genero').value;
    const diag = document.getElementById('p_diag').value.trim();
    const tel = document.getElementById('p_tel').value.trim();
    const alergias = document.getElementById('p_alergias').value.trim();
    const usuario_id = document.getElementById('p_usuario_id') ? document.getElementById('p_usuario_id').value : '';
    if (!nombre || !edad || !genero || !diag || !tel) { alert('Completa los campos obligatorios'); return; }
    const id = Date.now();
    datos.pacientes.push({ id, usuario_id: usuario_id || null, nombre, edad, genero, diag, tel, alergias });
    datos.historiales[id] = [];
    log('Alta de paciente', sesion.user, nombre + (usuario_id ? ' (vinculado a usuario ' + usuario_id + ')' : ''));
    ['p_nombre','p_edad','p_genero','p_diag','p_tel','p_alergias'].forEach(i => document.getElementById(i).value='');
    if (document.getElementById('p_usuario_id')) document.getElementById('p_usuario_id').value = '';
    guardar(); renderTodo();
  }
  function delPaciente(id) {
    if (!confirm('¿Eliminar paciente y su historial (cascada)?')) return;
    const p = datos.pacientes.find(x => x.id === id);
    datos.pacientes = datos.pacientes.filter(x => x.id !== id);
    delete datos.historiales[id];
    datos.citas = datos.citas.filter(c => c.pid !== id); 
    
    // NUEVO: Registro de auditoría para HU10
    if (p) log('Baja de paciente', sesion.user, p.nombre + ' (cascada)');
    
    guardar(); renderTodo();
  }

  // ============ MÉDICOS ============
  function renderSelectsMedico() {
    const se = document.getElementById('m_especialidad_id');
    const re_med = document.getElementById('re_medico');
    const re_esp = document.getElementById('re_especialidad');
    
    if (se) se.innerHTML = '<option value="">Selecciona especialidad</option>' + datos.especialidades.map(e => `<option value="${e.id}">${e.nombre_especialidad}</option>`).join('');
    if (re_esp) re_esp.innerHTML = '<option value="">Nueva Especialidad</option>' + datos.especialidades.map(e => `<option value="${e.id}">${e.nombre_especialidad}</option>`).join('');
    if (re_med) re_med.innerHTML = '<option value="">Selecciona Médico</option>' + datos.medicos.map(m => `<option value="${m.usuario_id}">${nombreMedico(m)} (${m.usuario_id})</option>`).join('');
  }

  function addMedico() {
    const user = document.getElementById('m_user').value.trim();
    const nombre = document.getElementById('m_nombre').value.trim();
    const pass = document.getElementById('m_pass').value;
    const cedula = document.getElementById('m_cedula').value.trim();
    const especialidad_id = +document.getElementById('m_especialidad_id').value;
    
    if (!user || !nombre || !pass || !cedula || !especialidad_id) { alert('Completa todos los campos'); return; }
    if (datos.usuarios.some(u => u.user === user)) { alert('El usuario ya existe. Elige otro.'); return; }
    if (datos.medicos.some(m => m.cedula_professional === cedula)) { alert('Ya existe un médico con esa cédula'); return; }
    
    // 1. Crea la cuenta de usuario (login) y rol 'doctor' automáticamente
    datos.usuarios.push({ user, nombre, email: '', rol: 'doctor', pass: hashPwd(pass), telefono:'', direccion:'', foto:'', activo: true, creado: Date.now() });
    
    // 2. Crea su registro en la tabla de médicos
    datos.medicos.push({ usuario_id: user, cedula_professional: cedula, especialidad_id });
    
    log('Alta directa de médico', sesion.user, nombre + ' [cédula: ' + cedula + ']');
    ['m_user','m_nombre','m_pass','m_cedula','m_especialidad_id'].forEach(id => document.getElementById(id).value = '');
    guardar(); renderTodo();
  }

  function delMedico(usuario_id) {
    if (!confirm('¿Eliminar registro de médico? Esto también eliminará su cuenta de usuario del sistema.')) return;
    const m = datos.medicos.find(x => x.usuario_id === usuario_id);
    
    // Borrar de médicos y de usuarios al mismo tiempo
    datos.medicos = datos.medicos.filter(x => x.usuario_id !== usuario_id);
    datos.usuarios = datos.usuarios.filter(x => x.user !== usuario_id);
    datos.sesiones = datos.sesiones.filter(s => s.user !== usuario_id);
    
    if (m) log('Baja de médico y usuario', sesion.user, m.usuario_id);
    guardar(); renderTodo();
  }

  function reasignarEspecialidad() {
    const usuario_id = document.getElementById('re_medico').value;
    const nueva_esp_id = +document.getElementById('re_especialidad').value;
    if (!usuario_id || !nueva_esp_id) { alert('Selecciona un médico y una especialidad'); return; }
    
    const medico = datos.medicos.find(m => m.usuario_id === usuario_id);
    if (medico) {
        medico.especialidad_id = nueva_esp_id;
        log('Especialidad reasignada', sesion.user, `Médico: ${usuario_id}`);
        document.getElementById('re_medico').value = '';
        document.getElementById('re_especialidad').value = '';
        guardar(); renderTodo();
        alert('Especialidad actualizada correctamente.');
    }
  }

  function nombreMedico(m) {
    const u = datos.usuarios.find(x => x.user === m.usuario_id);
    return u ? u.nombre : '(usuario eliminado)';
  }
  function especialidadDe(m) {
    const e = datos.especialidades.find(x => x.id === m.especialidad_id);
    return e ? e.nombre_especialidad : '(sin especialidad)';
  }
  function emailMedico(m) {
    const u = datos.usuarios.find(x => x.user === m.usuario_id);
    return u ? (u.email || '-') : '-';
  }
  // ============ ESPECIALIDADES ============
  function addEspecialidad() {
    const nombre = document.getElementById('esp_nombre').value.trim();
    if (!nombre) { alert('Escribe el nombre de la especialidad'); return; }
    if (datos.especialidades.some(e => e.nombre_especialidad.toLowerCase() === nombre.toLowerCase())) {
      alert('Esa especialidad ya existe'); return;
    }
    const nuevoId = (datos.especialidades.reduce((m, e) => Math.max(m, e.id), 0)) + 1;
    datos.especialidades.push({ id: nuevoId, nombre_especialidad: nombre });
    log('Alta de especialidad', sesion.user, nombre);
    document.getElementById('esp_nombre').value = '';
    guardar(); renderTodo();
  }
  function editEspecialidad(id) {
    const e = datos.especialidades.find(x => x.id === id);
    if (!e) return;
    const nuevo = prompt('Nuevo nombre para la especialidad:', e.nombre_especialidad);
    if (nuevo === null) return;
    const limpio = nuevo.trim();
    if (!limpio) { alert('Nombre vacío'); return; }
    if (datos.especialidades.some(x => x.id !== id && x.nombre_especialidad.toLowerCase() === limpio.toLowerCase())) {
      alert('Ya existe otra especialidad con ese nombre'); return;
    }
    e.nombre_especialidad = limpio;
    log('Especialidad editada', sesion.user, limpio);
    guardar(); renderTodo();
  }
  function delEspecialidad(id) {
    const usados = datos.medicos.filter(m => m.especialidad_id === id).length;
    if (usados > 0) {
      alert(`No puedes eliminar esta especialidad: ${usados} médico(s) la usan. Reasígnalos primero.`);
      return;
    }
    const e = datos.especialidades.find(x => x.id === id);
    if (!confirm('¿Eliminar especialidad "' + (e ? e.nombre_especialidad : '') + '"?')) return;
    datos.especialidades = datos.especialidades.filter(x => x.id !== id);
    if (e) log('Baja de especialidad', sesion.user, e.nombre_especialidad);
    guardar(); renderTodo();
  }
  function renderEspecialidades() {
    const t = document.getElementById('tablaEspecialidades');
    const v = document.getElementById('vacioEspecialidades');
    if (!t) return;
    t.innerHTML = '';
    if (!datos.especialidades.length) { v.style.display = 'block'; return; }
    v.style.display = 'none';
    datos.especialidades.forEach(e => {
      const cuenta = datos.medicos.filter(m => m.especialidad_id === e.id).length;
      t.innerHTML += `<tr>
        <td>${e.id}</td>
        <td>${e.nombre_especialidad}</td>
        <td><span class="pill">${cuenta}</span></td>
        <td>
          <button class="btn-warning btn-small" onclick="editEspecialidad(${e.id})">Editar</button>
          <button class="btn-danger btn-small" onclick="delEspecialidad(${e.id})">Eliminar</button>
        </td>
      </tr>`;
    });
  }

  // ============ CITAS ============

// Validación de disponibilidad (HU27)
function isDisponible(medico_id, fecha, hora) {
  return !datos.citas.some(c => 
    c.mid === medico_id && 
    c.fecha === fecha && 
    c.hora === hora && 
    c.estado !== 'Cancelada'
  );
}

// Validación de fecha futura (HU16)
function isFechaValida(fecha, hora) {
  const citaDateTime = new Date(`${fecha}T${hora}`);
  return citaDateTime > new Date();
}

function addCita() {
  const pid = document.getElementById('c_paciente').value;
  const mid = document.getElementById('c_medico').value; 
  const fecha = document.getElementById('c_fecha').value;
  const hora = document.getElementById('c_hora').value;
  const motivo = document.getElementById('c_motivo').value.trim();
  
  if (!pid || !mid || !fecha || !hora || !motivo) { alert('Completa todos los campos'); return; }
  
  // Aplicamos las validaciones de Chris (H16 y H27)
  if (!isFechaValida(fecha, hora)) {
    alert('Error: La fecha/hora no puede ser anterior al momento actual.');
    return;
  }
  if (!isDisponible(mid, fecha, hora)) {
    alert('Error: El médico ya tiene una cita ocupada en ese horario.');
    return;
  }

  datos.citas.push({ id: Date.now(), pid:+pid, mid, fecha, hora, motivo, estado:'Pendiente' });
  log('Cita agendada', sesion.user, fecha + ' ' + hora);
  ['c_paciente','c_medico','c_fecha','c_hora','c_motivo'].forEach(i => document.getElementById(i).value='');
  guardar(); renderTodo();
}

function cambiarEstadoCita(id) {
  const c = datos.citas.find(x => x.id === id);
  if (!c) return;
  const estados = ['Pendiente','Atendida','Cancelada'];
  c.estado = estados[(estados.indexOf(c.estado)+1) % estados.length];
  log('Estado de cita modificado', sesion.user, `Cita ID: ${id} cambió a ${c.estado}`);
  guardar(); renderTodo();
}

// Función para cancelar cita (HU18)
function cancelarCita(id) {
  const cita = datos.citas.find(c => c.id === id);
  if (cita) {
    cita.estado = 'Cancelada';
    log('Cita cancelada', sesion.user, `Cita ID: ${id}`);
    guardar(); renderTodo();
  }
}
// Función para reprogramar cita (HU19)
function reprogramarCita(id, nuevaFecha, nuevaHora) {
  const cita = datos.citas.find(c => c.id === id);
  if (!cita) return;
  
  // Validamos antes de aplicar el cambio
  if (!isFechaValida(nuevaFecha, nuevaHora)) {
    alert('Error: La fecha/hora nueva es inválida.'); 
    return;
  }
  
  if (!isDisponible(cita.mid, nuevaFecha, nuevaHora)) {
    alert('Error: El médico ya tiene una cita en ese nuevo horario.'); 
    return;
  }
  
  // Si todo está bien, actualizamos
  cita.fecha = nuevaFecha;
  cita.hora = nuevaHora;
  
  log('Cita reprogramada', sesion.user, `Cita ID: ${id} nueva fecha: ${nuevaFecha} ${nuevaHora}`);
  guardar(); 
  renderTodo();
}

function delCita(id) {
  if (!confirm('¿Eliminar cita?')) return;
  datos.citas = datos.citas.filter(x => x.id !== id);
  log('Cita eliminada', sesion.user, `Cita ID: ${id}`);
  guardar(); renderTodo();
}
 // ============ HISTORIAL ============
  function renderSelectHistorial() {
    const sel = document.getElementById('h_paciente');
    const valor = sel.value;
    sel.innerHTML = '<option value="">Selecciona un paciente</option>';
    datos.pacientes.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
    sel.value = valor;
    
    // Ya no rellenamos la lista de médicos porque lo haremos automático
    actualizarCitasDelPaciente();
    renderHistorial();
  }

  function actualizarCitasDelPaciente() {
    const pid = +document.getElementById('h_paciente').value;
    const sc = document.getElementById('h_cita');
    sc.innerHTML = '<option value="">Cita asociada (opcional)</option>';
    datos.citas.filter(c => c.pid === pid).forEach(c => {
      sc.innerHTML += `<option value="${c.id}">${c.fecha} ${c.hora} - ${c.motivo}</option>`;
    });
  }

  function renderHistorial() {
    const id = document.getElementById('h_paciente').value;
    const cont = document.getElementById('historialContenido');
    const lista = document.getElementById('listaHistorial');
    if (!id) { cont.classList.add('hidden'); return; }
    cont.classList.remove('hidden');
    actualizarCitasDelPaciente();
    const reg = datos.historiales[id] || [];
    if (!reg.length) { lista.innerHTML = '<p class="hint">Sin registros para este paciente.</p>'; return; }
    lista.innerHTML = reg.map(r => {
      const med = datos.medicos.find(m => m.usuario_id === r.mid);
      const cita = datos.citas.find(c => c.id === r.citaId);
      return `<div class="historial-item">
        <b>[${r.tipo}]</b> ${r.titulo} <span style="float:right;color:#999;font-size:11px;">${new Date(r.fecha).toLocaleString()}</span><br>
        ${r.detalle}<br>
        <small style="color:#666;">
          👨‍⚕️ ${med ? nombreMedico(med) : r.autor} ·
          ${cita ? '📅 ' + cita.fecha + ' ' + cita.hora : ''} ·
          Por: ${r.autor}
        </small>
      </div>`;
    }).join('');
  }

  function addHistorial() {
    const pid = document.getElementById('h_paciente').value;
    
    // AQUÍ OCURRE LA MAGIA: El sistema detecta automáticamente al doctor
    const mid = sesion.user; 
    
    const citaId = document.getElementById('h_cita').value;
    const tipo = document.getElementById('h_tipo').value;
    const titulo = document.getElementById('h_titulo').value.trim();
    const detalle = document.getElementById('h_detalle').value.trim();
    
    // Quitamos la alerta de "falta médico" porque ya es automático
    if (!pid || !titulo || !detalle) { alert('Completa paciente, título y detalle'); return; }
    
    if (!datos.historiales[pid]) datos.historiales[pid] = [];
    datos.historiales[pid].unshift({
      id: Date.now(), pid:+pid, mid, citaId: citaId ? +citaId : null,
      tipo, titulo, detalle, fecha: new Date().toISOString(), autor: sesion.user
    });
    
    log('Registro clínico agregado', sesion.user, titulo);
    document.getElementById('h_titulo').value = ''; document.getElementById('h_detalle').value = '';
    document.getElementById('h_cita').value = '';
    guardar(); renderHistorial();
  }

  // ============ PERFIL ============
  function cargarPerfil() {
    const u = datos.usuarios.find(x => x.user === sesion.user);
    if (!u) return;
    document.getElementById('pf_user').value = u.user;
    document.getElementById('pf_rol').value = u.rol;
    document.getElementById('pf_nombre').value = u.nombre || '';
    document.getElementById('pf_email').value = u.email || '';
    document.getElementById('pf_tel').value = u.telefono || '';
    document.getElementById('pf_direccion').value = u.direccion || '';
    const med = datos.medicos.find(m => m.usuario_id === u.user);
    document.getElementById('pf_esp').value = med ? especialidadDe(med) : '';
    document.getElementById('pf_cedula').value = med ? med.cedula_professional : '';
    document.getElementById('rowEspecialidad').style.display = u.rol === 'doctor' ? 'grid' : 'none';
    document.getElementById('pf_esp').disabled = true;
    document.getElementById('pf_cedula').disabled = true;
    const hint = document.getElementById('hintMedico');
    if (hint) {
      if (u.rol === 'doctor' && !med) hint.textContent = 'ℹ️ Aún no estás registrado en la tabla MEDICOS. Pídele a un admin que te dé de alta en la sección Médicos.';
      else if (u.rol === 'doctor' && med) hint.textContent = '✅ Estás registrado como médico. Para cambiar tu especialidad o cédula, ve a la sección Médicos.';
      else hint.textContent = '';
    }
    pintarAvatar('avatarPerfil', u);
  }
  function pintarAvatar(elId, u) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (u && u.foto) el.innerHTML = `<img src="${u.foto}" alt="">`;
    else el.innerHTML = iniciales(u ? u.nombre : '?');
  }
  function sincronizarPerfil() {
    const u = datos.usuarios.find(x => x.user === sesion.user);
    if (!u) return;
    document.getElementById('userLabel').textContent = u.nombre || u.user;
    document.getElementById('roleLabel').textContent = u.rol;
    pintarAvatar('avatarTop', u);
  }
  function cargarFoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 1024 * 1024) { alert('Máximo 1MB'); return; }
    const r = new FileReader();
    r.onload = () => {
      const u = datos.usuarios.find(x => x.user === sesion.user);
      if (!u) return;
      u.foto = r.result;
      log('Foto de perfil actualizada', sesion.user, '');
      guardar();
      pintarAvatar('avatarPerfil', u);
      sincronizarPerfil();
    };
    r.readAsDataURL(f);
  }
  function actualizarPerfil() {
    const u = datos.usuarios.find(x => x.user === sesion.user);
    if (!u) return;
    const nombre = document.getElementById('pf_nombre').value.trim();
    const email = document.getElementById('pf_email').value.trim();
    const tel = document.getElementById('pf_tel').value.trim();
    const dir = document.getElementById('pf_direccion').value.trim();
    if (!nombre) { alert('El nombre no puede estar vacío'); return; }
    if (!validarEmail(email)) { alert('Correo inválido'); return; }
    u.nombre = nombre; u.email = email; u.telefono = tel; u.direccion = dir;
    log('Perfil actualizado', sesion.user, '');
    guardar();
    sincronizarPerfil();
    renderTodo();
    document.getElementById('okPerfil').textContent = '✓ Perfil sincronizado en todo el sistema';
    setTimeout(() => document.getElementById('okPerfil').textContent = '', 2500);
  }
  function checkPwdPerfil() {
    const p = document.getElementById('pf_passNueva').value;
    const v = validarPwd(p);
    const bar = document.getElementById('pwdBarPf');
    const colors = ['#d32f2f','#ff9800','#fbc02d','#7cb342','#4caf50'];
    bar.style.width = (v.nivel * 20) + '%';
    bar.style.background = colors[Math.min(v.nivel-1, 4)] || '#ccc';
  }
  function cambiarPassword() {
    const u = datos.usuarios.find(x => x.user === sesion.user);
    const actual = document.getElementById('pf_passActual').value;
    const n1 = document.getElementById('pf_passNueva').value;
    const n2 = document.getElementById('pf_passNueva2').value;
    const err = document.getElementById('errPass'); const ok = document.getElementById('okPass');
    err.textContent = ''; ok.textContent = '';
    if (hashPwd(actual) !== u.pass) { err.textContent = 'Contraseña actual incorrecta'; return; }
    const v = validarPwd(n1);
    if (!v.ok) { err.textContent = v.msg; return; }
    if (n1 !== n2) { err.textContent = 'Las contraseñas no coinciden'; return; }
    u.pass = hashPwd(n1);
    log('Cambio de contraseña', sesion.user, '');
    guardar();
    ok.textContent = '✓ Contraseña actualizada';
    ['pf_passActual','pf_passNueva','pf_passNueva2'].forEach(i => document.getElementById(i).value='');
    document.getElementById('pwdBarPf').style.width = '0%';
  }

  // ============ USUARIOS ============
  function addUsuario() {
    const user = document.getElementById('u_user').value.trim();
    const pass = document.getElementById('u_pass').value;
    const rol = document.getElementById('u_rol').value;
    if (!user || !pass || !rol) { alert('Completa todos los campos'); return; }
    const v = validarPwd(pass);
    if (!v.ok) { alert(v.msg); return; }
    if (datos.usuarios.some(u => u.user === user)) { alert('Ese usuario ya existe'); return; }
    datos.usuarios.push({ user, pass: hashPwd(pass), rol, nombre: user, email: '', telefono:'', direccion:'', foto:'', activo: true, creado: Date.now() });
    log('Usuario creado por admin', sesion.user, user + ' (' + rol + ')');
    ['u_user','u_pass','u_rol'].forEach(i => document.getElementById(i).value='');
    guardar(); renderTodo();
  }
  function toggleUsuario(user) {
    const u = datos.usuarios.find(x => x.user === user);
    if (!u) return;
    if (user === sesion.user) { alert('No puedes deshabilitar tu propia cuenta'); return; }
    u.activo = !u.activo;
    log(u.activo ? 'Usuario habilitado' : 'Usuario deshabilitado', sesion.user, user);
    guardar(); renderTodo();
  }
  function delUsuario(user) {
    if (user === sesion.user) { alert('No puedes eliminar tu propia cuenta'); return; }
    if (!confirm('¿Eliminar usuario ' + user + '?')) return;
    datos.usuarios = datos.usuarios.filter(u => u.user !== user);
    datos.sesiones = datos.sesiones.filter(s => s.user !== user);
    datos.medicos = datos.medicos.filter(m => m.usuario_id !== user);
    datos.pacientes.forEach(p => { if (p.usuario_id === user) p.usuario_id = null; });
    log('Usuario eliminado', sesion.user, user);
    guardar(); renderTodo();
  }
  function ordenarUsuarios(campo) {
    if (ordenUsuarios.campo === campo) ordenUsuarios.asc = !ordenUsuarios.asc;
    else { ordenUsuarios.campo = campo; ordenUsuarios.asc = true; }
    renderUsuarios();
  }
  function limpiarFiltros() {
    document.getElementById('fltBusqueda').value = '';
    document.getElementById('fltRol').value = '';
    document.getElementById('fltEstado').value = '';
    renderUsuarios();
  }

  // ============ SUPERVISIÓN ============
  function renderSupervision() {
    datos.sesiones = datos.sesiones.filter(s => s.expira > Date.now());
    guardar();
    const stats = document.getElementById('statsSup');
    const totalLogins = datos.log.filter(l => l.accion === 'Inicio de sesión').length;
    const fallidos = datos.log.filter(l => l.accion === 'Intento fallido de login').length;
    stats.innerHTML = `
      <div class="stat"><div class="num">${datos.usuarios.length}</div><div class="lbl">Usuarios totales</div></div>
      <div class="stat"><div class="num">${datos.usuarios.filter(u=>u.activo).length}</div><div class="lbl">Usuarios activos</div></div>
      <div class="stat"><div class="num">${datos.sesiones.length}</div><div class="lbl">Sesiones activas</div></div>
      <div class="stat"><div class="num">${totalLogins}</div><div class="lbl">Inicios de sesión</div></div>
      <div class="stat" style="background:linear-gradient(135deg,#d32f2f,#ef5350);"><div class="num">${fallidos}</div><div class="lbl">Intentos fallidos</div></div>
    `;
    const t = document.getElementById('tablaLog'); const v = document.getElementById('vacioLog');
    t.innerHTML = '';
    if (!datos.log.length) v.style.display = 'block';
    else {
      v.style.display = 'none';
      datos.log.slice(0, 100).forEach(l => {
        t.innerHTML += `<tr class="log-row"><td>${new Date(l.fecha).toLocaleString()}</td><td>${l.usuario}</td><td>${l.accion}</td><td>${l.detalle}</td></tr>`;
      });
    }
    const ts = document.getElementById('tablaSesiones'); const vs = document.getElementById('vacioSesiones');
    ts.innerHTML = '';
    if (!datos.sesiones.length) vs.style.display = 'block';
    else {
      vs.style.display = 'none';
      datos.sesiones.forEach(s => {
        ts.innerHTML += `<tr><td>${s.user}</td><td>${s.rol}</td><td><code>${s.token.slice(0,16)}...</code></td><td>${new Date(s.inicio).toLocaleTimeString()}</td><td>${new Date(s.expira).toLocaleTimeString()}</td></tr>`;
      });
    }
  }
  function limpiarLog() {
    if (!confirm('¿Limpiar todo el registro?')) return;
    datos.log = []; guardar(); renderSupervision();
  }

  // ============ ESQUEMA BD ============
  function renderEsquema() {
    const total = (datos.usuarios.length) + (datos.pacientes.length) + (datos.medicos.length) + (datos.citas.length);
    let totalHist = 0;
    Object.values(datos.historiales).forEach(arr => totalHist += arr.length);
    document.getElementById('statsBD').innerHTML = `
      <div class="stat"><div class="num">${datos.usuarios.length}</div><div class="lbl">Tabla USUARIOS</div></div>
      <div class="stat"><div class="num">${datos.especialidades.length}</div><div class="lbl">Tabla ESPECIALIDADES</div></div>
      <div class="stat"><div class="num">${datos.pacientes.length}</div><div class="lbl">Tabla PACIENTES</div></div>
      <div class="stat"><div class="num">${datos.medicos.length}</div><div class="lbl">Tabla MEDICOS</div></div>
      <div class="stat"><div class="num">${datos.citas.length}</div><div class="lbl">Tabla CITAS</div></div>
      <div class="stat"><div class="num">${totalHist}</div><div class="lbl">Tabla HISTORIAL</div></div>
      <div class="stat"><div class="num">${datos.log.length}</div><div class="lbl">Tabla LOG</div></div>
    `;

    const huerfanas = {
      citasSinPaciente: datos.citas.filter(c => !datos.pacientes.find(p => p.id === c.pid)).length,
      citasSinMedico: datos.citas.filter(c => !datos.medicos.find(m => m.usuario_id === c.mid)).length,
      historialSinPaciente: 0,
      historialSinMedico: 0,
      medicosSinUsuario: datos.medicos.filter(m => !datos.usuarios.find(u => u.user === m.usuario_id)).length,
      medicosSinEspecialidad: datos.medicos.filter(m => !datos.especialidades.find(e => e.id === m.especialidad_id)).length
    };
    Object.entries(datos.historiales).forEach(([pid, arr]) => {
      if (!datos.pacientes.find(p => p.id === +pid)) huerfanas.historialSinPaciente += arr.length;
      arr.forEach(r => { if (!datos.medicos.find(m => m.usuario_id === r.mid)) huerfanas.historialSinMedico++; });
    });
    document.getElementById('integridad').innerHTML = `
      <div class="rel-info">
        ✅ Citas con paciente válido: <b>${datos.citas.length - huerfanas.citasSinPaciente}/${datos.citas.length}</b><br>
        ⚠️ Citas con médico inexistente: <b>${huerfanas.citasSinMedico}</b><br>
        ⚠️ Registros clínicos sin médico: <b>${huerfanas.historialSinMedico}</b><br>
        ⚠️ Médicos sin usuario (FK rota a USUARIOS): <b>${huerfanas.medicosSinUsuario}</b><br>
        ⚠️ Médicos sin especialidad (FK rota a ESPECIALIDADES): <b>${huerfanas.medicosSinEspecialidad}</b>
      </div>
    `;
  }

  // ============ DASHBOARD ============
  function renderDashboard() {
    const stats = document.getElementById('stats');
    const hoy = new Date().toISOString().slice(0,10);
    const citasHoy = datos.citas.filter(c => c.fecha === hoy).length;
    stats.innerHTML = `
      <div class="stat"><div class="num">${datos.pacientes.length}</div><div class="lbl">Pacientes</div></div>
      <div class="stat"><div class="num">${datos.medicos.length}</div><div class="lbl">Médicos</div></div>
      <div class="stat"><div class="num">${datos.citas.length}</div><div class="lbl">Citas totales</div></div>
      <div class="stat"><div class="num">${citasHoy}</div><div class="lbl">Citas hoy</div></div>
    `;
    const t = document.getElementById('proxCitas'); const v = document.getElementById('vacioProx');
    t.innerHTML = '';
    const prox = datos.citas
      .filter(c => c.estado === 'Pendiente' && c.fecha >= hoy)
      .sort((a,b) => (a.fecha+a.hora).localeCompare(b.fecha+b.hora))
      .slice(0, 5);
    if (!prox.length) { v.style.display = 'block'; return; }
    v.style.display = 'none';
    prox.forEach(c => {
      const p = datos.pacientes.find(x => x.id === c.pid);
      const m = datos.medicos.find(x => x.usuario_id === c.mid);
      t.innerHTML += `<tr><td>${p ? p.nombre : '-'}</td><td>${m ? nombreMedico(m) : '-'}</td><td>${c.fecha}</td><td>${c.hora}</td></tr>`;
    });
  }

  // ============ RENDER ============
  function renderTodo() {
    renderPacientes(); renderMedicos(); renderCitas();
    renderUsuarios(); actualizarSelects(); renderDashboard();
    renderSelectHistorial(); renderEspecialidades(); renderSelectsMedico();
  }

  function renderPacientes() {
    const t = document.getElementById('tablaPacientes');
    const v = document.getElementById('vacioPacientes');
    const buscar = (document.getElementById('buscarPaciente')?.value || '').toLowerCase();
    
    if (!t) return;
    t.innerHTML = '';
    
    const filtrados = datos.pacientes.filter(p => 
      !buscar || 
      p.nombre.toLowerCase().includes(buscar) || 
      p.diag.toLowerCase().includes(buscar)
    );

    if (!filtrados.length) { 
      v.style.display = 'block'; 
      v.textContent = datos.pacientes.length ? 'Sin resultados.' : 'No hay pacientes registrados.'; 
      return; 
    }
    
    v.style.display = 'none';
    
    filtrados.forEach((p, i) => {
      // Buscamos si tiene usuario vinculado para ver si está activo o inactivo
      const u = datos.usuarios.find(x => x.user === p.usuario_id);
      const estadoStr = u ? (u.activo ? '<span style="color:#4caf50;">Activo</span>' : '<span style="color:#d32f2f;">Inactivo</span>') : '';
      const btnToggle = u ? `<button class="btn-warning btn-small" onclick="toggleUsuario('${u.user}')">${u.activo ? 'Deshabilitar' : 'Habilitar'}</button>` : '';

      t.innerHTML += `<tr>
        <td>${i + 1}</td>
        <td>${p.nombre}<br><small>${estadoStr}</small></td>
        <td>${p.edad || '-'}</td>
        <td>${p.genero}</td>
        <td>${p.diag}</td>
        <td>${p.tel || '-'}</td>
        <td>
          ${btnToggle}
          <button class="btn-danger btn-small" onclick="delPaciente(${p.id})">Eliminar</button>
        </td>
      </tr>`;
    });
  }

  function renderMedicos() {
    const t = document.getElementById('tablaMedicos'); const v = document.getElementById('vacioMedicos');
    t.innerHTML = '';
    if (!datos.medicos.length) { v.style.display = 'block'; return; }
    v.style.display = 'none';
    
    datos.medicos.forEach((m, i) => {
      // Buscamos su usuario para ver el estado
      const u = datos.usuarios.find(x => x.user === m.usuario_id);
      const estadoStr = u ? (u.activo ? '<span style="color:#4caf50;">Activo</span>' : '<span style="color:#d32f2f;">Inactivo</span>') : '';
      const btnToggle = u ? `<button class="btn-warning btn-small" onclick="toggleUsuario('${u.user}')">${u.activo ? 'Deshabilitar' : 'Habilitar'}</button>` : '';

      t.innerHTML += `<tr>
        <td>${i+1}</td>
        <td>${nombreMedico(m)}<br><small>${estadoStr}</small></td>
        <td>${emailMedico(m)}</td>
        <td>${especialidadDe(m)}</td>
        <td>${m.cedula_professional}</td>
        <td>
          ${btnToggle}
          <button class="btn-danger btn-small" onclick="delMedico('${m.usuario_id}')">Eliminar</button>
        </td>
      </tr>`;
    });
  }
 function renderCitas() {
    const t = document.getElementById('tablaCitas'); const v = document.getElementById('vacioCitas');
    t.innerHTML = '';
    if (!datos.citas.length) { v.style.display = 'block'; return; }
    v.style.display = 'none';
    
    datos.citas.forEach((c, i) => {
      const p = datos.pacientes.find(x => x.id === c.pid);
      const m = datos.medicos.find(x => x.usuario_id === c.mid);
      const colorEstado = c.estado === 'Atendida' ? '#4caf50' : c.estado === 'Cancelada' ? '#d32f2f' : '#ff9800';
      
      // Construimos los botones de acción dinámicamente
      let acciones = `<button class="btn-danger btn-small" onclick="delCita(${c.id})">Eliminar</button>`;
      
      if (c.estado !== 'Cancelada') {
        acciones = `
          <button class="btn-small" style="background:#d32f2f; color:white;" onclick="cancelarCita(${c.id})">🚫</button>
          <button class="btn-small" style="background:#1976d2; color:white;" onclick="promptReprogramar(${c.id})">📅</button>
          ${acciones}
        `;
      }

      t.innerHTML += `<tr>
        <td>${i+1}</td>
        <td>${p ? p.nombre : '(eliminado)'}</td>
        <td>${m ? nombreMedico(m) : '(eliminado)'}</td>
        <td>${c.fecha}</td>
        <td>${c.hora}</td>
        <td>${c.motivo}</td>
        <td><span style="background:${colorEstado};color:white;padding:3px 8px;border-radius:3px;font-size:11px;cursor:pointer;" onclick="cambiarEstadoCita(${c.id})">${c.estado}</span></td>
        <td>${acciones}</td>
      </tr>`;
    });
}

// Auxiliar para el prompt de reprogramación
function promptReprogramar(id) {
  const nuevaFecha = prompt("Introduce la nueva fecha (YYYY-MM-DD):");
  const nuevaHora = prompt("Introduce la nueva hora (HH:MM):");
  if (nuevaFecha && nuevaHora) {
    reprogramarCita(id, nuevaFecha, nuevaHora);
  }
}

  function renderUsuarios() {
    const t = document.getElementById('tablaUsuarios');
    const v = document.getElementById('vacioUsuarios');
    const cont = document.getElementById('contadorUsuarios');
    if (!t) return;
    const busq = (document.getElementById('fltBusqueda')?.value || '').toLowerCase();
    const rolF = document.getElementById('fltRol')?.value || '';
    const estF = document.getElementById('fltEstado')?.value || '';

    let lista = datos.usuarios.filter(u => {
      const matchTexto = !busq || u.user.toLowerCase().includes(busq) || (u.nombre||'').toLowerCase().includes(busq) || (u.email||'').toLowerCase().includes(busq);
      const matchRol = !rolF || u.rol === rolF;
      const matchEst = !estF || (estF === 'activo' ? u.activo : !u.activo);
      return matchTexto && matchRol && matchEst;
    });

    lista.sort((a, b) => {
      let va = a[ordenUsuarios.campo] || ''; let vb = b[ordenUsuarios.campo] || '';
      if (typeof va === 'string') { va = va.toLowerCase(); vb = vb.toLowerCase(); }
      if (va < vb) return ordenUsuarios.asc ? -1 : 1;
      if (va > vb) return ordenUsuarios.asc ? 1 : -1;
      return 0;
    });

    cont.textContent = `${lista.length} de ${datos.usuarios.length}`;
    t.innerHTML = '';
    if (!lista.length) { v.classList.remove('hidden'); return; }
    v.classList.add('hidden');
    lista.forEach(u => {
      const av = u.foto ? `<img src="${u.foto}" alt="">` : iniciales(u.nombre);
      t.innerHTML += `<tr>
        <td><div class="avatar" style="background:#1976d2; color:white;">${av}</div></td>
        <td>${u.user}</td>
        <td>${u.nombre || '-'}</td>
        <td>${u.email || '-'}</td>
        <td>${u.rol}</td>
        <td>${u.activo ? '<span style="color:#4caf50;">✓ Activo</span>' : '<span style="color:#d32f2f;">✗ Inactivo</span>'}</td>
        <td>${u.creado ? new Date(u.creado).toLocaleDateString() : '-'}</td>
        <td>
          <button class="btn-warning btn-small" onclick="toggleUsuario('${u.user}')">${u.activo ? 'Deshabilitar' : 'Habilitar'}</button>
          <button class="btn-danger btn-small" onclick="delUsuario('${u.user}')">Eliminar</button>
        </td>
      </tr>`;
    });
  }

  function actualizarSelects() {
    const sp = document.getElementById('c_paciente');
    const sm = document.getElementById('c_medico');
    sp.innerHTML = '<option value="">Selecciona paciente</option>';
    sm.innerHTML = '<option value="">Selecciona médico</option>';
    datos.pacientes.forEach(p => sp.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
    datos.medicos.forEach(m => sm.innerHTML += `<option value="${m.usuario_id}">${nombreMedico(m)} (${especialidadDe(m)})</option>`);

    const sup = document.getElementById('p_usuario_id');
    if (sup) {
      const yaVinculados = new Set(datos.pacientes.map(p => p.usuario_id).filter(Boolean));
      const disponibles = datos.usuarios.filter(u => u.rol === 'paciente' && u.activo && !yaVinculados.has(u.user));
      sup.innerHTML = '<option value="">Vincular a usuario (opcional)</option>' +
        disponibles.map(u => `<option value="${u.user}">${u.nombre} (${u.user})</option>`).join('');
    }
  }

  document.addEventListener('change', (e) => {
    if (e.target.id === 'h_paciente') actualizarCitasDelPaciente();
  });

  // ============ INICIO ============
  function arrancar() {
    (async () => {
      await cargar();
      await cargarSesion();
      if (sesion) mostrarSistema();
      iniciarVigilanciaSesion();
    })();
  }
  if (window.__FB_READY__ !== undefined) {
    arrancar();
  } else {
    window.addEventListener('fb-ready', arrancar, { once: true });
    setTimeout(() => { if (window.__FB_READY__ === undefined) { window.__FB_READY__ = false; arrancar(); } }, 1000);
  }