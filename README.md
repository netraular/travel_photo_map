# Travel Photo Map

Visualiza las fotos y videos de un album de Immich en un **mapa** (con agrupacion
por zoom) y una **timeline** inferior. Al pulsar una foto se abre un visor a pantalla
grande con un mini-mapa en overlay y navegacion entre fotos / slideshow.

## Requisitos

- Node.js 18 o superior.
- Una instancia de Immich y una **API key** con permisos de lectura.

## Configuracion

1. Copia `.env.example` a `.env` y rellena:

   ```env
   IMMICH_URL=https://immich.raular.com
   IMMICH_API_KEY=tu_api_key
   ALBUM_ID=a6abb843-165a-4ff2-8ec7-132c0c5f0fae
   PORT=3000
   ```

2. La API key (Immich -> Account Settings -> API Keys) necesita estos permisos:
   - `album.read`
   - `asset.read`
   - `asset.view`

   > Opcional: `asset.download` solo si quieres servir las imagenes a resolucion
   > original. Por defecto la app usa la version *preview* (mas rapida y suficiente
   > para la web), asi que no es necesario.

## Uso

```bash
npm install
npm start
```

Abre http://localhost:3000

## Caracteristicas

- Mapa principal con marcadores agrupados (clusters) segun el zoom.
- Timeline inferior ordenada por fecha, con slideshow (play/pausa) y navegacion.
- Visor a pantalla grande al pulsar una foto/video, con mini-mapa en overlay y
  botones anterior / siguiente / cerrar (tambien con teclado: flechas y Esc).
- Las fotos **sin GPS** se ubican usando las coordenadas de la foto con fecha mas
  cercana que si las tenga; si ninguna del album tiene GPS, aparecen solo en la timeline.
- La API key nunca se expone al navegador: un pequeno backend en Node hace de proxy.

## Estructura

```
server.js          Backend proxy (Express) + sirve los estaticos
public/
  index.html
  css/styles.css
  js/api.js         Acceso a los endpoints del backend
  js/geo.js         Inferencia de coordenadas por cercania temporal
  js/map.js         Mapa Leaflet + clustering + mini-mapa
  js/timeline.js    Timeline + slideshow
  js/viewer.js      Visor a pantalla grande
  js/app.js         Orquestacion
```