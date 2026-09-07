# Conectar PrintB con Firebase

1. Entra a https://console.firebase.google.com/ y crea un proyecto llamado `printb-ventas`.
2. Agrega una aplicación web (`</>`).
3. Copia la configuración que Firebase muestra en `firebase-config.js`.
4. En **Authentication > Sign-in method**, activa `Email/Password`.
5. En **Firestore Database**, crea una base de datos en modo producción.
6. Configura las reglas para permitir acceso únicamente a usuarios autenticados.

La configuración web de Firebase no es una contraseña. Nunca compartas claves privadas de servidores ni archivos de cuentas de servicio.