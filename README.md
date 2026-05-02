# WhatsApp bot

Bot sencillo de WhatsApp Web hecho con Node.js y `whatsapp-web.js`.

## Que hace

Cuando recibe un mensaje de un numero configurado en `config.json`, responde con el texto asociado.

Contactos actuales:

- `5355374126`: `Llegue vivo`
- `5356068661`: `Gei`
- `5358170750`: `Dame la mita de tu salario`
- `5350932259`: `Hola`

## Bibliotecas principales

- `whatsapp-web.js`: cliente de WhatsApp Web.
- `puppeteer`: controla Chromium por debajo de `whatsapp-web.js`.
- `qrcode-terminal`: imprime el QR en los logs.

## Configurar respuestas

Edita `config.json`:

```json
{
  "name": "flaco",
  "phone": "5356068661",
  "response": "Gei"
}
```

El campo `phone` debe incluir codigo de pais. No hace falta agregar `@c.us`; el bot lo agrega automaticamente.

Despues de cambiar `config.json`, reinicia el contenedor:

```bash
docker compose restart bot
```

Si usas alias `dc`:

```bash
dc restart bot
```

## Ejecutar con Docker

Primera vez o despues de cambiar dependencias/Dockerfile:

```bash
docker compose up --build
```

Con alias:

```bash
dc up --build
```

El QR sale en los logs del contenedor. Si arrancas en segundo plano:

```bash
docker compose up -d --build
docker compose logs -f bot
```

Escanea el QR desde:

```text
WhatsApp > Dispositivos vinculados > Vincular dispositivo
```

La sesion de WhatsApp se guarda en volumenes de Docker, asi que no deberia pedir QR en cada arranque.

## Desarrollo sin reconstruir

`compose.yaml` monta el codigo como volumen. Si cambias `bot.js`, `contacts.js`, `config.json`, `validate-config.js` o `package.json`, normalmente basta con:

```bash
docker compose restart bot
docker compose logs -f bot
```

Solo necesitas reconstruir la imagen cuando cambien:

- `Dockerfile`
- `package-lock.json`
- dependencias de Node
- paquetes del sistema

En esos casos:

```bash
docker compose up --build
```

## Cambiar la cuenta que actua como bot

El numero del bot no esta en el codigo. La cuenta del bot es la cuenta de WhatsApp que escanea el QR.

Para usar otra cuenta, borra la sesion anterior y vuelve a iniciar:

```bash
docker compose down -v
docker compose up --build
```

Con alias:

```bash
dc down -v
dc up --build
```

`down -v` borra los volumenes `whatsapp-auth` y `whatsapp-cache`, pero no borra el codigo ni `config.json`. Al volver a levantar, saldra un QR nuevo en los logs para escanearlo con la cuenta nueva.

## Validar configuracion

```bash
npm test
```

## Ejecutar local

```bash
npm install
npm start
```

La primera vez se imprime un QR en la terminal. Escanealo con WhatsApp para vincular la cuenta que actuara como bot.

## Logs utiles

Ver logs en vivo:

```bash
docker compose logs -f bot
```

Cuando esta listo deberias ver:

```text
Bot initialized. Configured contacts: 4
Known phones: 5355374126, 5356068661, 5358170750, 5350932259
```

Cuando entra un mensaje de un contacto configurado deberias ver:

```text
matched=true
Replied to ...
```

## Problemas comunes

Si el bot detecta mensajes pero no responde, revisa si el log dice `matched=false`. WhatsApp a veces entrega el remitente como `@lid`; el bot compara varios identificadores del contacto para encontrar el numero real.

Si Chromium deja el perfil bloqueado por un apagado brusco, detiene el bot y borra solo los locks `Singleton*` dentro del volumen de sesion antes de arrancar de nuevo.
