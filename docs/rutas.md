# Rutas CD: mapa 3D y kilometraje

Herramienta para el área de **coordinación de transporte**. Muestra en un mapa 3D de El Salvador las
tiendas **Walmart, Despensa Familiar, Maxi Despensa y Despensa de Don Juan**, junto con los Centros
de Distribución, y calcula los **kilómetros por carretera** de cada ruta.

- Dirección: `https://<tu-proyecto>.web.app/rutas/`. Es una página aparte y no pide iniciar sesión.
- También funciona si abres el archivo `public/rutas/index.html` directamente en el navegador.
- Está hecha para PC, pero también se puede usar desde el teléfono.

## Cómo se usa

1. **Ruta**: elige el punto de salida (un CD o una tienda), busca tiendas y agrégalas como paradas,
   o toca una tienda en el mapa y pulsa *Agregar a la ruta*.
2. La ruta se traza sola. Verás:
   - el **total de km** y el tiempo de manejo;
   - una tabla con los km de cada tramo y los km acumulados;
   - la etiqueta de km de cada tramo dibujada sobre el mapa;
   - una estimación de combustible a partir del rendimiento (km/galón) y del precio del galón.
3. **Optimizar orden** reordena las paradas para recorrer menos km. Respeta la casilla *Regresar al
   punto de salida*.
4. **Recorrido 3D** mueve la cámara a lo largo de la ruta.
5. **Exportar CSV** genera un archivo con los km por tramo que abre en Excel. **Copiar resumen**
   copia el texto para pegarlo en WhatsApp o en un correo.
6. **Guardar** deja la ruta en la pestaña *Guardadas* para abrirla otro día.

En el mapa: **3D / 2D** (relieve y edificios), **Satélite**, **Ver ruta** y **El Salvador**.

## De dónde salen los datos

| Dato | Fuente |
|---|---|
| Tiendas | OpenStreetMap (Overpass). Se descargan la primera vez que abres la página; para actualizarlas, usa *Tiendas → Actualizar desde OpenStreetMap*. |
| Kilometraje y tiempo | OSRM (`router.project-osrm.org`), por carretera y con datos de OpenStreetMap. El tiempo es de un auto sin tráfico, así que un camión tarda más. |
| Mapa y edificios 3D | OpenFreeMap. Si falla, la página usa el mapa básico de OpenStreetMap. |
| Relieve 3D | Modelos de elevación Terrarium (AWS Open Data). |
| Satélite | Esri World Imagery. |

Todo es gratis y no necesita llaves. Los servidores públicos de OSRM y Overpass tienen límites de
uso. Si OSRM no responde, la página muestra km **estimados** (línea recta × 1.3), los marca en
naranja y lo avisa.

**Importante:** OpenStreetMap puede no tener todas las tiendas, o tenerlas con otro nombre. Revisa la
lista y completa las que falten:

- **+ Agregar tienda**: llenas el formulario y tocas el mapa (o escribes las coordenadas). El
  marcador se puede arrastrar.
- **Importar CSV** con las columnas `cadena,nombre,municipio,lat,lng`. La cadena puede ir como
  `Walmart`, `Despensa Familiar`, `Maxi Despensa`, `Despensa de Don Juan` o `Centro de
  distribución`. Si una tienda ya existe con el mismo nombre y cadena, se actualiza.
- **Editar** o **Eliminar** cualquier tienda. Las que borras no regresan al actualizar desde OSM.

```csv
cadena,nombre,municipio,lat,lng
Despensa Familiar,Despensa Familiar Lourdes,Colón,13.7231,-89.3654
Walmart,Walmart Santa Elena,Antiguo Cuscatlán,13.6745,-89.2501
```

(Las coordenadas del ejemplo solo ilustran el formato.)

## Dónde se guarda

Las tiendas que agregues o edites y las rutas guardadas quedan en **el navegador de ese equipo**
(`localStorage`). Para pasarlas a otra PC, usa *Exportar CSV* en una e *Importar CSV* en la otra.
Los CD de la app (Hortifruti, Apopa y San Juan Opico) siempre aparecen.
