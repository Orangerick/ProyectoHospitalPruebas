// ============ CAPA DE PERSISTENCIA (Firebase o local) ============
window.storage = {
    async get(key) {
      const val = localStorage.getItem(key);
      return val ? { key, value: val } : null;
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true };
    }
  };
  // Usa window.fbStorage si Firebase está listo; si no, window.storage local.
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
  // Modelo según diagrama ER:
  //   USUARIOS(id PK, nombre, email, rol, activo, ...)
  //   ESPECIALIDADES(id PK, nombre_especialidad)
  //   MEDICOS(usuario_id PK,FK → USUARIOS, cedula_professional UK, especialidad_id FK → ESPECIALIDADES)
  //   PACIENTES → ahora también vinculados a USUARIOS por usuario_id (rol 'paciente')
  let datos = {
    usuarios: [
      { user:'admin', pass:hashPwd('Admin123'), rol:'admin', nombre:'Administrador', email:'admin@hospital.mx', telefono:'', direccion:'', foto:'', activo:true, creado:Date.now() },
      { user:'doctor', pass:hashPwd('Doctor123'), rol:'doctor', nombre:'Dr. Genérico', email:'doctor@hospital.mx', telefono:'', direccion:'', foto:'', activo:true, creado:Date.now() },
      { user:'recepcion', pass:hashPwd('Recep123'), rol:'recepcion', nombre:'Recepcionista', email:'recepcion@hospital.mx', telefono:'', direccion:'', foto:'', activo:true, creado:Date.now() },
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
        // Migración: si no existe la tabla especialidades, se crea con valores por defecto.
        if (!Array.isArray(d.especialidades)) d.especialidades = datos.especialidades;
        // Migración: asegurar usuario paciente demo
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
    if (el) el.innerHTML = `⏱️ Tiempo de sesión: <b>${min}m ${seg}s</b>`;
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
    guardarSesion(); guardar(); mostrarSistema(); aplicarPermisos();
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
    const user = document.getElementById('r_user').value.trim();
    const nombre = document.getElementById('r_nombre').value.trim();
    const email = document.getElementById('r_email').value.trim();
    const p1 = document.getElementById('r_pass').value;
    const p2 = document.getElementById('r_pass2').value;
    const rol = document.getElementById('r_rol').value;
    const err = document.getElementById('errReg'); const ok = document.getElementById('okReg');
    err.textContent = ''; ok.textContent = '';
    if (user.length < 4) { err.textContent = 'Usuario mínimo 4 caracteres'; return; }
    if (!nombre) { err.textContent = 'Nombre requerido'; return; }
    if (!validarEmail(email)) { err.textContent = 'Correo inválido'; return; }
    const pv = validarPwd(p1);
    if (!pv.ok) { err.textContent = pv.msg; return; }
    if (p1 !== p2) { err.textContent = 'Las contraseñas no coinciden'; return; }
    if (!rol) { err.textContent = 'Selecciona un rol'; return; }
    if (datos.usuarios.some(u => u.user === user)) { err.textContent = 'Ese usuario ya existe'; return; }
    datos.usuarios.push({ user, nombre, email, rol, pass: hashPwd(p1), telefono:'', direccion:'', foto:'', activo: true, creado: Date.now() });
    log('Registro de usuario', user, 'Rol: ' + rol);
    guardar();
    ok.textContent = 'Cuenta creada. Ya puedes iniciar sesión.';
    ['r_user','r_nombre','r_email','r_pass','r_pass2','r_rol'].forEach(id => document.getElementById(id).value = '');
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

function showTab(s) {
    // Escudo de Seguridad contra pacientes curiosos en la consola
    if (sesion && sesion.rol === 'paciente') {
        const bloqueadasParaPaciente = ['pacientes', 'especialidades', 'historial', 'usuarios', 'supervision', 'esquema'];
        if (bloqueadasParaPaciente.includes(s)) {
            console.warn("Acceso denegado a la sección: " + s);
            // Si intenta forzar la entrada a 'pacientes', lo mandamos al dashboard
            s = 'dashboard'; 
        }
    }

    // Código original de navegación...
    ['dashboard','pacientes','medicos','especialidades','citas','historial','perfil','usuarios','supervision','esquema'].forEach(x => {
      const el = document.getElementById('sec-' + x);
      if (el) el.classList.add('hidden');
    });
    
    document.getElementById('sec-' + s).classList.remove('hidden');
    
    // Quitar la clase active de todas y ponérsela a la seleccionada
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    const tabActiva = document.querySelector(`.tab[data-section="${s}"]`);
    if (tabActiva) tabActiva.classList.add('active');

    // Renderizar contenidos según la sección
    if (s === 'dashboard') renderDashboard();
    if (s === 'supervision') renderSupervision();
    if (s === 'historial') renderSelectHistorial();
    if (s === 'esquema') renderEsquema();
    if (s === 'medicos') renderSelectsMedico();
    if (s === 'especialidades') renderEspecialidades();
    if (s === 'citas') renderCitas();
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
    datos.citas = datos.citas.filter(c => c.pid !== id); // ON DELETE CASCADE
    if (p) log('Baja de paciente', sesion.user, p.nombre + ' (cascada)');
    guardar(); renderTodo();
  }

  // MEDICOS = { usuario_id PK,FK, cedula_professional UK, especialidad_id FK }
  function renderSelectsMedico() {
    // Llena selects del formulario "Promover usuario a médico"
    const su = document.getElementById('m_usuario_id');
    const se = document.getElementById('m_especialidad_id');
    if (!su || !se) return;
    const yaMedicos = new Set(datos.medicos.map(m => m.usuario_id));
    const candidatos = datos.usuarios.filter(u => u.rol === 'doctor' && u.activo && !yaMedicos.has(u.user));
    su.innerHTML = '<option value="">Selecciona usuario (rol doctor)</option>' +
      candidatos.map(u => `<option value="${u.user}">${u.nombre} (${u.user})</option>`).join('');
    se.innerHTML = '<option value="">Selecciona especialidad</option>' +
      datos.especialidades.map(e => `<option value="${e.id}">${e.nombre_especialidad}</option>`).join('');
  }
  function addMedico() {
    const usuario_id = document.getElementById('m_usuario_id').value;
    const cedula = document.getElementById('m_cedula').value.trim();
    const especialidad_id = +document.getElementById('m_especialidad_id').value;
    if (!usuario_id || !cedula || !especialidad_id) { alert('Completa usuario, cédula y especialidad'); return; }
    // UK: cédula única
    if (datos.medicos.some(m => m.cedula_professional === cedula)) { alert('Ya existe un médico con esa cédula'); return; }
    // PK: usuario solo puede ser médico una vez
    if (datos.medicos.some(m => m.usuario_id === usuario_id)) { alert('Ese usuario ya está registrado como médico'); return; }
    datos.medicos.push({ usuario_id, cedula_professional: cedula, especialidad_id });
    const u = datos.usuarios.find(x => x.user === usuario_id);
    log('Alta de médico', sesion.user, (u ? u.nombre : usuario_id) + ' [cédula: ' + cedula + ']');
    document.getElementById('m_cedula').value = '';
    guardar(); renderTodo();
  }
  function delMedico(usuario_id) {
    if (!confirm('¿Eliminar registro de médico? El usuario seguirá existiendo, solo se quita del listado de médicos.')) return;
    const m = datos.medicos.find(x => x.usuario_id === usuario_id);
    datos.medicos = datos.medicos.filter(x => x.usuario_id !== usuario_id);
    if (m) {
      const u = datos.usuarios.find(x => x.user === m.usuario_id);
      log('Baja de médico', sesion.user, u ? u.nombre : m.usuario_id);
    }
    guardar(); renderTodo();
  }
  // Helpers para consultas que antes usaban m.nombre / m.esp
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

  // ============ ESPECIALIDADES (CRUD) ============
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
  function addCita() {
    const pid = document.getElementById('c_paciente').value;
    const mid = document.getElementById('c_medico').value; // ahora es usuario_id (string)
    const fecha = document.getElementById('c_fecha').value;
    const hora = document.getElementById('c_hora').value;
    const motivo = document.getElementById('c_motivo').value.trim();
    if (!pid || !mid || !fecha || !hora || !motivo) { alert('Completa todos los campos'); return; }
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
    guardar(); renderTodo();
  }
  function delCita(id) {
    if (!confirm('¿Eliminar cita?')) return;
    datos.citas = datos.citas.filter(x => x.id !== id);
    guardar(); renderTodo();
  }
  // Función para que el paciente solicite la cita
async function solicitarCita() {
    const fecha = document.getElementById('solicitud_fecha').value;
    const especialidad = document.getElementById('solicitud_especialidad').value;
    const motivo = document.getElementById('solicitud_motivo').value.trim();

    if (!fecha || !motivo) {
        alert("Por favor, ingresa la fecha y el motivo de tu solicitud.");
        return;
    }

    const pacienteVinculado = datos.pacientes.find(p => p.usuario_id === sesion.user);
    if (!pacienteVinculado) {
        alert("Tu cuenta de usuario no tiene un expediente de paciente vinculado. Solicita tu alta en recepción.");
        return;
    }

    const nuevaCita = {
        id: Date.now(),
        pid: pacienteVinculado.id, // Alineado al esquema original (Paciente ID)
        mid: null,                 // Sin médico asignado aún
        fecha: fecha,
        hora: "Por definir",
        motivo: motivo + (especialidad ? ` [Especialidad solicitada: ${especialidad}]` : ''),
        estado: "pendiente"
    };

    datos.citas.push(nuevaCita);
    log('Solicitud de cita', sesion.user, `Fecha: ${fecha}`);
    await guardar();
    alert("Tu solicitud ha sido enviada al personal de recepción.");
    
    document.getElementById('solicitud_fecha').value = '';
    document.getElementById('solicitud_motivo').value = '';
    renderCitas();
}

async function aprobarCitaPendiente(citaId) {
    const medicoId = prompt("Ingresa el identificador de usuario (user) del médico asignado:");
    const hora = prompt("Asigna la hora para la consulta (ej. 14:15):");

    if (!medicoId || !hora) {
        alert("Validación cancelada. Es obligatorio asignar médico y hora.");
        return;
    }

    const medicoExiste = datos.medicos.some(m => m.usuario_id === medicoId);
    if (!medicoExiste) {
        alert("Error: El identificador de médico ingresado no existe en el catálogo.");
        return;
    }

    const cita = datos.citas.find(c => c.id === citaId);
    if (cita) {
        cita.mid = medicoId; // Alineado al esquema original
        cita.hora = hora;
        cita.estado = "confirmada";
        log('Aprobación de cita', sesion.user, `Cita ID: ${citaId} asignada a ${medicoId}`);
        await guardar();
        alert("La cita ha sido validada, calendarizada y notificada al paciente.");
        renderCitas();
    }
}
  // ============ HISTORIAL (HU25 con relaciones) ============
  function renderSelectHistorial() {
    const sel = document.getElementById('h_paciente');
    const valor = sel.value;
    sel.innerHTML = '<option value="">Selecciona un paciente</option>';
    datos.pacientes.forEach(p => sel.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
    sel.value = valor;
    const sm = document.getElementById('h_medico');
    sm.innerHTML = '<option value="">Médico responsable</option>';
    datos.medicos.forEach(m => sm.innerHTML += `<option value="${m.usuario_id}">${nombreMedico(m)} (${especialidadDe(m)})</option>`);
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
          👨‍⚕️ ${med ? nombreMedico(med) : '(sin médico)'} ·
          ${cita ? '📅 ' + cita.fecha + ' ' + cita.hora : ''} ·
          Por: ${r.autor}
        </small>
      </div>`;
    }).join('');
  }
  function addHistorial() {
    const pid = document.getElementById('h_paciente').value;
    const mid = document.getElementById('h_medico').value; // usuario_id (string)
    const citaId = document.getElementById('h_cita').value;
    const tipo = document.getElementById('h_tipo').value;
    const titulo = document.getElementById('h_titulo').value.trim();
    const detalle = document.getElementById('h_detalle').value.trim();
    if (!pid || !mid || !titulo || !detalle) { alert('Completa paciente, médico, título y detalle'); return; }
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

  // ============ PERFIL (HU14 - Sincronización) ============
  function cargarPerfil() {
    const u = datos.usuarios.find(x => x.user === sesion.user);
    if (!u) return;
    document.getElementById('pf_user').value = u.user;
    document.getElementById('pf_rol').value = u.rol;
    document.getElementById('pf_nombre').value = u.nombre || '';
    document.getElementById('pf_email').value = u.email || '';
    document.getElementById('pf_tel').value = u.telefono || '';
    document.getElementById('pf_direccion').value = u.direccion || '';
    // Si el usuario es médico, mostramos su info de la tabla MEDICOS (solo lectura aquí)
    const med = datos.medicos.find(m => m.usuario_id === u.user);
    document.getElementById('pf_esp').value = med ? especialidadDe(med) : '';
    document.getElementById('pf_cedula').value = med ? med.cedula_professional : '';
    document.getElementById('rowEspecialidad').style.display = u.rol === 'doctor' ? 'grid' : 'none';
    // Como ahora la info vive en MEDICOS, deshabilitamos edición directa aquí
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
    // HU14: actualiza cabecera y todos los lugares donde aparece el usuario
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
    // Nota: especialidad y cédula viven en MEDICOS, no se editan desde el perfil.
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

  // ============ USUARIOS (HU7 - filtrado) ============
  function addUsuario() {
    const user = document.getElementById('u_user').value.trim();
    const pass = document.getElementById('u_pass').value;
    const rol = document.getElementById('u_rol').value;
    if (!user || !pass || !rol) { alert('Completa todos los campos'); return; }
    const v = validarPwd(pass);
    if (!v.ok) { alert(v.msg); return; }
    if (datos.usuarios.some(u => u.user === user)) { alert('Ese usuario ya existe'); return; }
    datos.usuarios.push({ user, pass: hashPwd(pass), rol, nombre: user, email: '', telefono:'', direccion:'', foto:'', activo: true, creado: Date.now() });
    // SI EL USUARIO CREADO ES UN PACIENTE, LE CREAMOS SU EXPEDIENTE AUTOMÁTICAMENTE
if (u_rol === 'paciente') {
    const nuevoExpedientePaciente = {
        id: Date.now() + 1, // Un ID único para la tabla pacientes
        nombre: u_nombre,   // Mismo nombre que la cuenta
        edad: "Por definir",
        genero: "Otro",
        diag: "Ninguno (Registro automático)",
        tel: "Por definir",
        usuario_id: u_user // ¡Aquí se hace el vínculo mágico!
    };
    datos.pacientes.push(nuevoExpedientePaciente);
}
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
    // Cascada FK: si era médico, removerlo de MEDICOS
    datos.medicos = datos.medicos.filter(m => m.usuario_id !== user);
    // Si era paciente vinculado, desvincular (no eliminamos el registro clínico)
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

    // Verificación de integridad referencial
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
  
  t.innerHTML = '';
  
  const filtrados = datos.pacientes.filter(p => !buscar || p.nombre.toLowerCase().includes(buscar) || p.diag.toLowerCase().includes(buscar));
  
  if (!filtrados.length) { 
    v.style.display = 'block'; 
    v.textContent = datos.pacientes.length ? 'Sin resultados.' : 'No hay pacientes registrados.'; 
    return; 
  }
  v.style.display = 'none';

  filtrados.forEach((p, i) => {
    let botonEliminar = '';
    // Condicionamos el botón según el rol
    if (sesion && sesion.rol !== 'paciente') {
        botonEliminar = `<button class="btn-danger btn-small" onclick="delPaciente(${p.id})">Eliminar</button>`;
    } else {
        botonEliminar = `<span class="hint">Sin permisos</span>`;
    }

    // Aquí usamos t.innerHTML += y respetamos tus columnas originales
    t.innerHTML += `<tr>
      <td>${i+1}</td>
      <td>${p.nombre}</td>
      <td>${p.edad}</td>
      <td>${p.genero}</td>
      <td>${p.diag}</td>
      <td>${p.tel}</td>
      <td>${botonEliminar}</td>
    </tr>`;
  });
}
function renderMedicos() {
  const t = document.getElementById('tablaMedicos'); 
  const v = document.getElementById('vacioMedicos');
  
  t.innerHTML = '';
  
  if (!datos.medicos.length) { 
    v.style.display = 'block'; 
    return; 
  }
  v.style.display = 'none';
  
  datos.medicos.forEach((m, i) => {
    let botonEliminarMed = '';
    // Condicionamos el botón según el rol
    if (sesion && sesion.rol !== 'paciente') {
        botonEliminarMed = `<button class="btn-danger btn-small" onclick="delMedico('${m.usuario_id}')">Eliminar</button>`;
    } else {
        botonEliminarMed = `<span class="hint">Sin permisos</span>`;
    }

    // Aquí usamos t.innerHTML += y respetamos tus columnas originales
    t.innerHTML += `<tr>
      <td>${i+1}</td>
      <td>${nombreMedico(m)}</td>
      <td>${emailMedico(m)}</td>
      <td>${especialidadDe(m)}</td>
      <td>${m.cedula_professional}</td>
      <td>${botonEliminarMed}</td>
    </tr>`;
  });
}
function renderCitas() {
  // 1. Captura segura de los contenedores de las tablas
  const tCitas = document.getElementById('tablaCitas');
  const tMisCitas = document.getElementById('tablaMisCitas');
  const tCitasPendientes = document.getElementById('tablaCitasPendientes');
  const vCitas = document.getElementById('vacioCitas');

  // Limpiamos los contenidos antiguos de forma segura si existen en la pantalla actual
  if (tCitas) tCitas.innerHTML = '';
  if (tMisCitas) tMisCitas.innerHTML = '';
  if (tCitasPendientes) tCitasPendientes.innerHTML = '';
  if (vCitas) vCitas.style.display = 'none';

  if (!sesion) return;

  // Encontramos el expediente del paciente logueado (si aplica)
  const pacienteVinculado = datos.pacientes.find(p => p.usuario_id === sesion.user);
  let contadorConfirmadas = 0;

  datos.citas.forEach((c, i) => {
    // Soportamos tanto 'pid'/'mid' tradicionales como los nuevos objetos
    const idPaciente = c.pid || c.paciente_id;
    const idMedico = c.mid || c.medico_id;

    const p = datos.pacientes.find(x => x.id === idPaciente);
    const m = datos.medicos.find(x => x.usuario_id === idMedico);
    
    const nombreMed = m ? nombreMedico(m) : 'Por asignar';
    const nombrePac = p ? p.nombre : '(Paciente eliminado)';
    const estadoActual = c.estado || 'Pendiente';

    // Asignación de colores según el estado de la cita
    let colorEstado = '#ff9800'; // Naranja para pendientes
    if (estadoActual.toLowerCase() === 'atendida' || estadoActual.toLowerCase() === 'confirmada') colorEstado = '#4caf50'; // Verde
    if (estadoActual.toLowerCase() === 'cancelada' || estadoActual.toLowerCase() === 'rechazada') colorEstado = '#d32f2f'; // Rojo

// CASO A: Si el usuario es un PACIENTE, validamos su ID de forma segura (forzando String)
    if (sesion.rol === 'paciente' && pacienteVinculado && String(idPaciente) === String(pacienteVinculado.id)) {
      if (tMisCitas) {
        tMisCitas.innerHTML += `<tr>
          <td>${c.fecha}</td>
          <td>${c.motivo}</td>
          <td><b>${nombreMed}</b> (${c.hora || 'Por definir'})</td>
          <td><span style="background:${colorEstado};color:white;padding:3px 8px;border-radius:3px;font-size:11px;">${estadoActual}</span></td>
        </tr>`;
      }
    }

    // CASO B: Si es ADMIN o RECEPCIÓN, gestionamos las bandejas globales
    if (sesion.rol !== 'paciente') {
      if (estadoActual.toLowerCase() === 'pendiente') {
        // Solicitudes que necesitan aprobación y asignación de médico
        if (tCitasPendientes) {
          tCitasPendientes.innerHTML += `<tr>
            <td><b>${nombrePac}</b></td>
            <td>${c.fecha}</td>
            <td>${c.motivo}</td>
            <td>
              <button class="btn-success btn-small" onclick="aprobarCitaPendiente(${c.id})">Validar y Asignar</button>
            </td>
          </tr>`;
        }
      } else {
        // Historial de citas confirmadas o procesadas
        contadorConfirmadas++;
        if (tCitas) {
          tCitas.innerHTML += `<tr>
            <td>${contadorConfirmadas}</td>
            <td>${nombrePac}</td>
            <td>${nombreMed}</td>
            <td>${c.fecha} - ${c.hora}</td>
            <td>${c.motivo}</td>
            <td>
              <span style="background:${colorEstado};color:white;padding:3px 8px;border-radius:3px;font-size:11px;cursor:pointer;" onclick="cambiarEstadoCita(${c.id})">
                ${estadoActual}
              </span>
            </td>
          </tr>`;
        }
      }
    }
  });

  // Si no hay citas confirmadas en la vista de administración, mostramos el aviso (si existe)
  if (sesion.rol !== 'paciente' && contadorConfirmadas === 0 && vCitas) {
    vCitas.style.display = 'block';
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

    // ordenamiento
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
    const selEsp = document.getElementById('solicitud_especialidad');
    if (selEsp) {
        selEsp.innerHTML = '<option value="">¿De qué especialidad? (Opcional)</option>' +
            datos.especialidades.map(e => `<option value="${e.nombre_especialidad}">${e.nombre_especialidad}</option>`).join('');
    }
    const sp = document.getElementById('c_paciente');
    const sm = document.getElementById('c_medico');
    sp.innerHTML = '<option value="">Selecciona paciente</option>';
    sm.innerHTML = '<option value="">Selecciona médico</option>';
    datos.pacientes.forEach(p => sp.innerHTML += `<option value="${p.id}">${p.nombre}</option>`);
    datos.medicos.forEach(m => sm.innerHTML += `<option value="${m.usuario_id}">${nombreMedico(m)} (${especialidadDe(m)})</option>`);

    // Select de usuarios-paciente disponibles para vincular
    const sup = document.getElementById('p_usuario_id');
    if (sup) {
      const yaVinculados = new Set(datos.pacientes.map(p => p.usuario_id).filter(Boolean));
      const disponibles = datos.usuarios.filter(u => u.rol === 'paciente' && u.activo && !yaVinculados.has(u.user));
      sup.innerHTML = '<option value="">Vincular a usuario (opcional)</option>' +
        disponibles.map(u => `<option value="${u.user}">${u.nombre} (${u.user})</option>`).join('');
    }
  }

  // wire para que al cambiar paciente en historial se actualicen citas
  document.addEventListener('change', (e) => {
    if (e.target.id === 'h_paciente') actualizarCitasDelPaciente();
  });
// APLICAR PERMISOS :)
 function aplicarPermisos() {
    if (!sesion) return;

    const rol = sesion.rol; // Puede ser 'admin', 'doctor', 'recepcion', 'paciente'

    // Seleccionamos TODAS las pestañas usando la clase correcta (.tab)
    const tabs = document.querySelectorAll('.tab');

    // Seleccionamos las tarjetas (formularios) que queremos ocultar a los pacientes
    // Como no tienen ID, seleccionamos el primer <div class="card"> dentro de las secciones correspondientes
    const formCrearPaciente = document.querySelector('#sec-pacientes .card:first-child');
    const formCrearMedico = document.querySelector('#sec-medicos .card:first-child');

    // Reiniciamos todas las pestañas a visibles por defecto (útil si cambian de cuenta)
    tabs.forEach(tab => tab.style.display = 'inline-block');

    // RESTRICCIONES PARA EL PACIENTE
    if (rol === 'paciente') {
        // 1. Ocultar Pestañas que no deben ver
        const seccionesBloqueadas = [
            'pacientes',      // <-- Bloquea la vista de todos los pacientes
            'especialidades',  
            'historial', 
            'usuarios', 
            'supervision', 
            'esquema'
        ];

        tabs.forEach(tab => {
            const seccionDestino = tab.getAttribute('data-section');
            if (seccionesBloqueadas.includes(seccionDestino)) {
                tab.style.display = 'none'; // Oculta la pestaña del menú superior
            }
            // Control de zonas dentro de la pestaña Citas
    const zonaPacienteCitas = document.getElementById('zona-paciente-citas');
    const zonaAdminCitas = document.getElementById('zona-admin-citas');

    if (rol === 'paciente') {
        if (zonaAdminCitas) zonaAdminCitas.style.display = 'none';
        if (zonaPacienteCitas) zonaPacienteCitas.style.display = 'block';
    } else if (rol === 'doctor') {
        if (zonaPacienteCitas) zonaPacienteCitas.style.display = 'none';
        if (zonaAdminCitas) zonaAdminCitas.style.display = 'block';
        // Opcional: Ocultar los formularios de creación al doctor para que solo vea sus citas
    } else { // Admin o Recepcion
        if (zonaPacienteCitas) zonaPacienteCitas.style.display = 'none';
        if (zonaAdminCitas) zonaAdminCitas.style.display = 'block';
    }
        });

        // 2. Ocultar Formularios de Creación (si intentaran entrar forzando la URL/consola)
        if (formCrearPaciente) formCrearPaciente.style.display = 'none';
        if (formCrearMedico) formCrearMedico.style.display = 'none';

    } else {
        // Si es Admin, Recepción o Doctor, nos aseguramos que vean los formularios de registro
        if (formCrearPaciente) formCrearPaciente.style.display = 'block';
        if (formCrearMedico) formCrearMedico.style.display = 'block';
    }

    // Regla especial de tu sistema base: Usuarios, Supervisión y Esquema solo las ve el Admin
    if (rol !== 'admin') {
        const tabUsuarios = document.querySelector('.tab[data-section="usuarios"]');
        const tabSupervision = document.querySelector('.tab[data-section="supervision"]');
        const tabEsquema = document.querySelector('.tab[data-section="esquema"]');
        
        if (tabUsuarios) tabUsuarios.style.display = 'none';
        if (tabSupervision) tabSupervision.style.display = 'none';
        if (tabEsquema) tabEsquema.style.display = 'none';
    }
}
  // ============ INICIO ============
  // Esperamos a que Firebase termine su fase async (o falle) antes de cargar.
  function arrancar() {
    (async () => {
      await cargar();
      await cargarSesion();
      if (sesion) {
      mostrarSistema();
      aplicarPermisos();
      }
      iniciarVigilanciaSesion();
    })();
  }
  if (window.__FB_READY__ !== undefined) {
    arrancar();
  } else {
    window.addEventListener('fb-ready', arrancar, { once: true });
    // Timeout de seguridad por si el evento nunca llega
    setTimeout(() => { if (window.__FB_READY__ === undefined) { window.__FB_READY__ = false; arrancar(); } }, 1000);
  }
  