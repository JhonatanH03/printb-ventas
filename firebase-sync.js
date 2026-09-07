(function () {
  const config = window.PRINTB_FIREBASE_CONFIG;
  const authBackdrop = document.getElementById('auth-backdrop');
  const authForm = document.getElementById('auth-form');
  const authToggle = document.getElementById('auth-toggle');
  const authTitle = document.getElementById('auth-title');
  const authSubmit = document.getElementById('auth-submit');
  const authError = document.getElementById('auth-error');
  let creating = false;
  if (!config?.apiKey || !window.firebase) { authBackdrop.style.display = 'none'; return; }
  const app = firebase.initializeApp(config);
  const auth = firebase.auth();
  const cloud = firebase.firestore();
  const cloudDoc = () => cloud.collection('accounts').doc(auth.currentUser.uid);
  window.PRINTB_CLOUD_SAVE = value => { if (auth.currentUser) cloudDoc().set({ ...value, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); };
  const setLoginMode = () => { creating = false; authTitle.textContent = 'Iniciar sesión'; authSubmit.textContent = 'Entrar'; authSubmit.style.display = ''; authToggle.textContent = 'Crear una cuenta'; authToggle.style.display = ''; authError.textContent = ''; };
  const showError = error => { authError.textContent = error.code === 'auth/email-already-in-use' ? 'Ese correo ya tiene una cuenta.' : error.code === 'auth/invalid-credential' ? 'Correo o contraseña incorrectos.' : error.code === 'auth/weak-password' ? 'Usa una contraseña de al menos 6 caracteres.' : 'No se pudo completar la operación.'; };
  authToggle.onclick = () => { creating = !creating; authTitle.textContent = creating ? 'Crear cuenta' : 'Iniciar sesión'; authSubmit.textContent = creating ? 'Registrarme' : 'Entrar'; authToggle.textContent = creating ? 'Ya tengo una cuenta' : 'Crear una cuenta'; authError.textContent = ''; };
  authForm.onsubmit = async event => { event.preventDefault(); const form = new FormData(authForm); authError.textContent = ''; try { if (creating) { const result = await auth.createUserWithEmailAndPassword(form.get('email'), form.get('password')); await result.user.sendEmailVerification(); await auth.signOut(); authError.textContent = 'Te enviamos un correo. Confirma tu cuenta antes de entrar.'; } else await auth.signInWithEmailAndPassword(form.get('email'), form.get('password')); } catch (error) { showError(error); } };
  auth.onAuthStateChanged(async user => { if (!user) { authBackdrop.style.display = 'flex'; setLoginMode(); return; } if (!user.emailVerified) { authBackdrop.style.display = 'flex'; authTitle.textContent = 'Confirma tu correo'; authSubmit.style.display = 'none'; authToggle.textContent = 'Cerrar sesión'; authToggle.onclick = () => auth.signOut(); authError.innerHTML = 'Revisa tu bandeja de entrada y confirma tu cuenta.<br><button type="button" id="resend-verification" class="text-button">Reenviar correo</button>'; document.getElementById('resend-verification').onclick = async () => { await user.sendEmailVerification(); authError.textContent = 'Correo de verificación reenviado.'; }; return; } authBackdrop.style.display = 'none'; const snapshot = await cloudDoc().get(); if (snapshot.exists) { const remote = snapshot.data(); data = { sales: remote.sales || [], clients: remote.clients || [], payments: remote.payments || [] }; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); renderAll(); } else if (data.sales.length || data.clients.length || data.payments.length) { await cloudDoc().set({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }); } });
}());