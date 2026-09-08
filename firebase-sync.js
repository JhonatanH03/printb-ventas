(function () {
  const config = window.PRINTB_FIREBASE_CONFIG;
  const authBackdrop = document.getElementById('auth-backdrop');
  const authForm = document.getElementById('auth-form');
  const authToggle = document.getElementById('auth-toggle');
  const authTitle = document.getElementById('auth-title');
  const authSubmit = document.getElementById('auth-submit');
  const authError = document.getElementById('auth-error');
  const logoutButton = document.getElementById('logout');
  let creating = false;

  if (!config?.apiKey || !window.firebase) { authBackdrop.style.display = 'none'; logoutButton.style.display = 'none'; return; }

  const app = firebase.initializeApp(config);
  const auth = firebase.auth();
  const cloud = firebase.firestore();
  logoutButton.onclick = () => auth.signOut();

  const accountRef = () => cloud.collection('accounts').doc(auth.currentUser.uid);
  const readCollection = async collectionName => {
    const collection = accountRef().collection(collectionName);
    const snapshot = collectionName === 'clients'
      ? await collection.get()
      : await collection.orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  const saveRemoteData = async value => {
    if (!auth.currentUser) return;

    const base = accountRef();
    const batch = firebase.firestore().batch();

    (value.sales || []).forEach(sale => {
      batch.set(base.collection('sales').doc(sale.id), { ...sale });
    });

    (value.clients || []).forEach(client => {
      batch.set(base.collection('clients').doc(client.id), { ...client });
    });

    (value.payments || []).forEach(payment => {
      batch.set(base.collection('payments').doc(payment.id), { ...payment });
    });

    await batch.commit();
    await base.set({ updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  };

  const mergeRecords = (remote, local) => [
    ...remote,
    ...local.filter(localRecord => !remote.some(remoteRecord => remoteRecord.id === localRecord.id))
  ];

  window.PRINTB_CLOUD_SAVE = value => {
    if (auth.currentUser) return saveRemoteData(value);
    return Promise.resolve();
  };

  window.PRINTB_CLOUD_DELETE = async (collectionName, recordId) => {
    if (!auth.currentUser) return;
    await accountRef().collection(collectionName).doc(recordId).delete();
  };

  const setLoginMode = () => { creating = false; authTitle.textContent = 'Iniciar sesión'; authSubmit.textContent = 'Entrar'; authSubmit.style.display = ''; authToggle.textContent = 'Crear una cuenta'; authToggle.style.display = ''; authError.textContent = ''; };
  const showError = error => { authError.textContent = error.code === 'auth/email-already-in-use' ? 'Ese correo ya tiene una cuenta.' : error.code === 'auth/invalid-credential' ? 'Correo o contraseña incorrectos.' : error.code === 'auth/weak-password' ? 'Usa una contraseña de al menos 6 caracteres.' : 'No se pudo completar la operación.'; };

  authToggle.onclick = () => { creating = !creating; authTitle.textContent = creating ? 'Crear cuenta' : 'Iniciar sesión'; authSubmit.textContent = creating ? 'Registrarme' : 'Entrar'; authToggle.textContent = creating ? 'Ya tengo una cuenta' : 'Crear una cuenta'; authError.textContent = ''; };

  authForm.onsubmit = async event => {
    event.preventDefault();
    const form = new FormData(authForm);
    authError.textContent = '';
    try {
      if (creating) {
        const result = await auth.createUserWithEmailAndPassword(form.get('email'), form.get('password'));
        await result.user.sendEmailVerification();
        await auth.signOut();
        authError.textContent = 'Te enviamos un correo. Confirma tu cuenta antes de entrar.';
      } else {
        await auth.signInWithEmailAndPassword(form.get('email'), form.get('password'));
      }
    } catch (error) {
      showError(error);
    }
  };

  auth.onAuthStateChanged(async user => {
    if (!user) {
      authBackdrop.style.display = 'flex';
      setLoginMode();
      return;
    }

    if (!user.emailVerified) {
      authBackdrop.style.display = 'flex';
      authTitle.textContent = 'Revisa tu correo';
      authSubmit.style.display = 'none';
      authToggle.textContent = 'Usar otra cuenta';
      authToggle.onclick = () => auth.signOut();
      authError.innerHTML = '<span class="verification-icon">✉</span><strong class="verification-title">Confirma tu cuenta PrintB</strong><span class="verification-copy">Enviamos un enlace de confirmación a tu correo. Abre el mensaje y pulsa el enlace para activar tu acceso.</span><button type="button" id="resend-verification" class="primary-button verification-button">Reenviar correo</button><span class="verification-hint">¿No lo encuentras? Revisa Spam o Promociones.</span>';
      document.getElementById('resend-verification').onclick = async () => {
        const button = document.getElementById('resend-verification');
        button.disabled = true;
        await user.sendEmailVerification();
        button.textContent = 'Correo reenviado';
        setTimeout(() => {
          button.disabled = false;
          button.textContent = 'Reenviar correo';
        }, 3000);
      };
      return;
    }

    authBackdrop.style.display = 'none';

    const accountDoc = await accountRef().get();
    const [sales, clients, payments] = await Promise.all([
      readCollection('sales'),
      readCollection('clients'),
      readCollection('payments')
    ]);

    const remoteData = { sales, clients, payments };
    const mergedData = {
      sales: mergeRecords(sales, data.sales),
      clients: mergeRecords(clients, data.clients),
      payments: mergeRecords(payments, data.payments)
    };
    const hasLocalRecordsToUpload = Object.keys(mergedData).some(collectionName => mergedData[collectionName].length > remoteData[collectionName].length);

    if (sales.length || clients.length || payments.length || accountDoc.exists) {
      data = mergedData;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      if (hasLocalRecordsToUpload) await saveRemoteData(data);
      renderAll();
    } else if (data.sales.length || data.clients.length || data.payments.length) {
      await saveRemoteData(data);
    }
  });
}());