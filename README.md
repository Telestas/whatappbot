# WhatsApp Bot

Bot de WhatsApp Web hecho con Node.js y TypeScript usando `whatsapp-web.js`.

## Estructura del proyecto

```
whatappbot/
├── src/                   # Código fuente del bot
│   ├── bot.ts             # Lógica principal y manejo de mensajes
│   ├── contacts.ts        # Utilidades de contactos y admins
│   ├── validate-config.ts # Validación de config.json
│   ├── config.json        # Configuración de contactos y admins
│   ├── package.json
│   ├── package-lock.json
│   └── tsconfig.json
├── .github/workflows/
│   └── build-and-push-image.yml  # Pipeline de CI/CD
├── compose.yaml           # Docker Compose para producción
├── compose-dev.yaml       # Docker Compose para desarrollo
├── Dockerfile             # Multi-stage build (builder + runtime)
└── run.sh                 # Entrypoint del contenedor
```

## Qué hace

- Responde automáticamente a contactos configurados en `config.json` con un mensaje personalizado.
- Envía un mensaje de bienvenida por defecto a cualquier número desconocido.
- Expone comandos de control para administradores vía WhatsApp.

## Configuración (`src/config.json`)

```json
{
  "contacts": [
    {
      "name": "nombre",
      "phone": "5351234567",
      "response": "Mensaje personalizado para este contacto"
    }
  ],
  "admins": ["5351234567"],
  "defaultReply": "Hola, soy Nolan. Estoy disponible 24h para ayudarte."
}
```

- `contacts`: lista de contactos con respuesta personalizada.
- `admins`: números que pueden ejecutar comandos de control.
- `defaultReply`: mensaje enviado a cualquier número que no esté en `contacts`.

El campo `phone` debe incluir código de país. No hace falta agregar `@c.us`.

## Comandos

### Comandos de admin

Solo disponibles para números listados en `admins` dentro de `config.json`.

| Comando | Descripción |
|---|---|
| `apagate` | Pausa las respuestas automáticas. El bot sigue corriendo pero no responde. |
| `enciende` | Reactiva las respuestas automáticas. |
| `estado` | Muestra si el bot está activo o pausado, uptime y cantidad de mensajes procesados. |
| `contactos` | Lista los contactos configurados con sus números. |
| `reinicia` | Reinicia el proceso del bot (Docker lo levanta automáticamente). |

### Comandos disponibles para todos

| Comando | Descripción |
|---|---|
| `ayuda` | Muestra un mensaje de bienvenida explicando que es un asistente virtual. Funciona incluso cuando el bot está pausado. |

## Desarrollo local

```bash
cd src
npm install
cd ..
dc -f compose-dev.yaml up --build
```

El QR sale en los logs. Escanearlo desde WhatsApp > Dispositivos vinculados > Vincular dispositivo.

Para ver logs en vivo:

```bash
dc -f compose-dev.yaml logs -f bot
```

`compose-dev.yaml` monta `src/config.json` como volumen. Los cambios en `config.json` se aplican reiniciando el contenedor:

```bash
dc -f compose-dev.yaml restart bot
```

Para cambios en código `.ts` o dependencias, reconstruir la imagen:

```bash
dc -f compose-dev.yaml up --build
```

## Validar configuración

```bash
cd src && npm test
```

## Producción (servidor)

En el servidor, copiar `compose.yaml` y definir la imagen a usar:

```bash
BOT_IMAGE=tuusuario/whatappbot:1.0.0 docker compose up -d
```

O crear un archivo `.env` junto a `compose.yaml`:

```env
BOT_IMAGE=tuusuario/whatappbot:1.0.0
```

Y levantar:

```bash
docker compose up -d
```

## Despliegue con GitHub Actions

El pipeline en `.github/workflows/build-and-push-image.yml` construye y publica la imagen en DockerHub al pushear un tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Esto genera los tags `1.0.0`, `1.0` y `latest` en DockerHub.

### Secrets requeridos en GitHub

| Secret | Valor |
|---|---|
| `DOCKERHUB_USERNAME` | Tu usuario de DockerHub |
| `DOCKERHUB_TOKEN` | Access token de DockerHub (DockerHub → Account Settings → Security → Access Tokens) |

## Cambiar la cuenta del bot

El número del bot es la cuenta que escanea el QR. Para cambiar de cuenta:

```bash
# Desarrollo
dc -f compose-dev.yaml down -v
dc -f compose-dev.yaml up --build

# Producción
docker compose down -v
docker compose up -d
```

`down -v` borra los volúmenes de sesión (`whatsapp-auth`, `whatsapp-cache`). Al levantar de nuevo aparece el QR para vincular una cuenta nueva.

## Problemas comunes

**El bot detecta mensajes pero no responde (`matched=false`):** WhatsApp a veces entrega el remitente como `@lid`. El bot compara varios identificadores del contacto para encontrar el número real.

**Chromium deja el perfil bloqueado tras un apagado brusco:** `run.sh` elimina automáticamente los archivos `Singleton*` al arrancar, por lo que esto se resuelve solo en el siguiente inicio.
