# Amigos Invisibles · Familia Tarruella

Página familiar para registrar las 14 respuestas y sortear una sola vez los tres destinatarios que queden sin elegir.

## Publicar

El sitio se publica desde el repositorio conectado a Netlify. La raíz contiene `index.html`, `package.json` y `netlify.toml`; la función está en `netlify/functions/gifts.mjs`.

## Configuración de Netlify

En las variables de entorno del proyecto, configura `AMIGO_ADMIN_PASSWORD` con la contraseña maestra `REGALO`. No hace falta configurar PIN individuales. La contraseña se guarda en Netlify y no en el repositorio. Después, vuelve a desplegar el proyecto.

## Funcionamiento

- Las 11 personas que conocen a quién regalan guardan su respuesta. No pueden elegirse a sí mismas ni repetir destinatario.
- Abuelo Rafa, Abuela Pepa y Tío Miguel eligen «No sé a quién regalo».
- La lista pública muestra quién ha rellenado su parte y deja borrosa la columna de destinatarios. El orden es aleatorio.
- La contraseña maestra `REGALO` permite ver la lista completa ordenada y habilita el sorteo cuando están las 14 respuestas.
- El sorteo asigna los tres destinatarios restantes a esas tres personas, sin autorregalos, y queda guardado una sola vez.
- Al guardar una respuesta conocida, el destinatario se muestra durante cinco segundos y después se oculta. Las tres personas pendientes pueden consultar su asignación con «¿Yo a quién regalo?» después del sorteo; también se oculta a los cinco segundos.
- Antes del sorteo, cada persona puede corregir o borrar su propia respuesta desde el mismo navegador en el que la guardó. Después del sorteo las respuestas quedan bloqueadas.
