const firebaseConfig = {
        apiKey: "AIzaSyCjdboZggzbxWxtARb5ej4zxtPxjPsnEuI",
        authDomain: "hospital-24a6a.firebaseapp.com",
        projectId: "hospital-24a6a",
        storageBucket: "hospital-24a6a.firebasestorage.app",
        messagingSenderId: "142075096208",
        appId: "1:142075096208:web:e1b8ada09b180ccbc53c15",
        measurementId: "G-P359XDNZTX"
    };

  // Si projectId está vacío, NO inicializamos Firebase y caemos a storage local.
  if (firebaseConfig.projectId) {
    try {
      const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const {
        getFirestore, doc, setDoc, getDoc, deleteDoc
      } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

      const app = initializeApp(firebaseConfig);
      const db  = getFirestore(app);

      // Adaptador con la misma firma que window.storage (get/set/delete)
      // → toda la app sigue funcionando sin más cambios.
      window.fbStorage = {
        async get(key) {
          const snap = await getDoc(doc(db, "hospital_kv", key));
          return snap.exists() ? { key, value: snap.data().value } : null;
        },
        async set(key, value) {
          await setDoc(doc(db, "hospital_kv", key), { value });
          return { key, value };
        },
        async delete(key) {
          await deleteDoc(doc(db, "hospital_kv", key));
          return { key, deleted: true };
        }
      };
      window.__FB_READY__ = true;
      console.log("✅ Firebase conectado:", firebaseConfig.projectId);
    } catch (err) {
      console.warn("⚠️ No se pudo inicializar Firebase, usando almacenamiento local:", err);
      window.__FB_READY__ = false;
    }
  } else {
    console.log("ℹ️ Firebase no configurado: usando almacenamiento local.");
    window.__FB_READY__ = false;
  }
  // Notificar al script principal que ya terminó la fase async
  window.dispatchEvent(new Event("fb-ready"));