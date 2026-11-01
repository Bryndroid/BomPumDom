# BomPumDom

Prototipo jugable de terror y vigilancia nocturna inspirado en las cámaras fijas de FNAF y FNAF 4. Está hecho únicamente con **HTML, CSS y JavaScript vanilla**; no usa frameworks, librerías, imágenes externas ni archivos de audio externos. Todo el arte es DOM/CSS y todo el sonido se sintetiza con la **Web Audio API**. Este es un proyecto full VibeCoding como parte de una tarea del curso de Kodigo AI for Devs jr

## Cómo ejecutarlo

1. Abre `index.html` con doble clic en cualquier navegador moderno (Chrome, Edge, Firefox).
2. Pulsa **INICIAR TURNO**.
3. Usa audífonos para distinguir las pistas de cada puerta.

También puedes servirlo en local:


Y abrir `http://localhost:8080/`.


## Proceso de creación (Vibe Coding con técnicas de Prompt Engineering)


1. Creación del prompt inicial
Primero, creé el prompt en bruto con la idea general del proyecto, estableciendo las mecánicas principales de cada animatrónico junto con su diseño. También establecí que necesitaba un prompt estructurado con la estrategia One-Shot para mejorar la precisión.

Prompt inicial:
Necesito crear un videojuego de terror de tipo Five Nights at Freddy's 4 (con mecánicas de acercarse a las puertas, escuchar si hay alguien ahí y gestionar las mecánicas de la sala), utilizando HTML, CSS y JavaScript, sin librerías ni otras dependencias (como máximo, el consumo de recursos mediante CDN).

Deben existir tres animatrónicos, que se representarán de la siguiente manera:
- BomBom: morado y azul.
- PumPum: blanco y rosado.
- DomDom: negro con ojos rojos.
BomBom y PumPum aparecerán en las dos puertas laterales. BomBom estará a la derecha y PumPum a la izquierda. Cada uno emitirá un sonido distinto después de un tiempo de espera.

DomDom aparecerá en la habitación cada cierto tiempo. Cuando aparezca, deberás resolver un puzzle; si no lo resuelves, te noqueará. Esto sucederá tres veces: la última vez te matará.

Lo mismo ocurrirá con BomBom y PumPum: si enciendes la luz mientras están frente a sus respectivas puertas, te matarán. Si nunca revisas las puertas y BomBom o PumPum llegan a ellas, también te matarán.

Dame el prompt estructurado con la estrategia One-Shot para que un modelo pueda crear el proyecto.


2. Prompt estructurado con Prompt Cowboy

Con este prompt crudo en mano, lo pasé por Prompt Cowboy, un sitio web que permite transformar prompts genéricos en prompts estructurados. Esto con el fin de convertir mi idea inicial en un prompt que el agente de OpenCode pudiera seguir con la menor cantidad de errores posible.

Prompt generado por Prompt Cowboy:
Eres un desarrollador de videojuegos web senior, con experiencia en juegos de terror de cámara fija y gestión de recursos al estilo de Five Nights at Freddy's. Vas a construir un videojuego completo, jugable en el navegador, usando únicamente HTML, CSS y JavaScript vanilla. No uses frameworks, motores ni librerías; si necesitas una fuente, un ícono o un recurso externo, solo puedes usar un CDN y, preferiblemente, no lo uses. Todo el juego debe funcionar abriendo un único archivo index.html, con el CSS y el JS incluidos en el mismo archivo o en archivos style.css y game.js en la misma carpeta.

OBJETIVO PRINCIPAL:

Que el juego funcione completo y sin errores al primer intento, respetando exactamente las mecánicas descritas abajo. Prioriza la claridad del código y la jugabilidad por encima de los gráficos elaborados. El nivel de acabado es de prototipo jugable: las mecánicas básicas deben funcionar, sin pulir visualmente más allá de lo necesario.

CONCEPTO Y AMBIENTACIÓN:

Una habitación de vigilancia nocturna con dos puertas (izquierda y derecha), una luz controlable y un sistema de cámaras para observar el avance de los animatrónicos. El jugador es un guardia que debe sobrevivir toda la noche (6 horas de juego, divididas en intervalos de tiempo de la noche) con la energía y la atención necesarias. Tono de terror: oscuridad, silencio roto por sonidos, parpadeos y jump scares visuales con animaciones sencillas.

ESCENA Y RENDERIZADO:

La escena se construye con elementos DOM y animaciones CSS (HTML + CSS + JavaScript), no con <canvas>. Los animatrónicos, puertas, luz, cámaras y elementos del puzzle son elementos HTML estilizados con CSS, cuyos estados se modifican desde JavaScript.

PERSONAJES (ANIMATRÓNICOS):

Tres animatrónicos, con estas representaciones visuales:

- BomBom: morado y azul. Aparece en la puerta derecha.
- PumPum: blanco y rosado. Aparece en la puerta izquierda.
- DomDom: negro con ojos rojos. Aparece dentro de la habitación de forma intermitente.

Cada uno debe dibujarse con formas simples mediante CSS, utilizando colores fieles a la descripción.

MECÁNICAS DE BOMBom Y PumPum:

- Cada uno avanza de forma gradual por el sistema de cámaras hasta llegar a su puerta, con un retraso aleatorio entre apariciones.
- Las cámaras solo muestran el avance de BomBom y PumPum por el recorrido; nunca muestran si están frente a la puerta. Para saber si están en la puerta, el jugador debe acercarse a ella, escuchar su sonido y cerrar la puerta (como en Five Nights at Freddy's 4).
- Cada animatrónico emite un sonido distinto frente a la puerta, generado con Web Audio API mediante osciladores (sin archivos externos). El sonido correcto es la única pista de que está ahí.
- Si el jugador cierra la puerta cuando el animatrónico correcto está detrás, este se retira. Cerrar la puerta consume energía.
- Si el jugador enciende la luz mientras BomBom o PumPum están frente a la puerta correspondiente, el animatrónico lo mata (game over con jump scare).
- Si el jugador nunca cierra la puerta y BomBom o PumPum permanecen en ella durante un tiempo límite, lo matan.

MECÁNICAS DE DOMDOM:

- Aparece dentro de la habitación cada cierto tiempo aleatorio.
- Cuando aparece, el jugador debe resolver un puzzle en pantalla (por ejemplo: una secuencia de botones, ordenar símbolos o completar un patrón). Si no lo resuelve a tiempo, DomDom lo noquea (pierde energía o pierde un turno, con una pantalla de aturdimiento).
- Este evento ocurre tres veces durante la noche. La tercera vez, DomDom mata al jugador.

GESTIÓN DE RECURSOS:

Implementa una barra de energía que disminuye con el uso de la luz, las cámaras y las puertas. Si la energía se agota, el juego termina. Incluye un reloj de noche que avance y muestre la hora (12 AM a 6 AM) y avance al completar el turno.

REQUISITOS TÉCNICOS:

- Un único punto de entrada index.html que funcione con doble clic.
- Controles con teclado y ratón (por ejemplo, A/D o flechas para cambiar de puerta, L para la luz, C para las cámaras y clic en los botones del puzzle).
- Bucle de juego con requestAnimationFrame y temporizadores controlados (sin depender de setInterval sin limpiar).
- Limpieza de todos los temporizadores al terminar una partida, para evitar errores al reiniciar.
- Pantallas de: menú de inicio, juego, aturdimiento, jump scare de muerte (por cada animatrónico) y victoria a las 6 AM.
- Código comentado en español, organizado en funciones pequeñas: estado del juego, animatrónicos, puzzle, energía, reloj, audio y renderizado.

ENTREGABLE:

Entrega el proyecto completo: el código de index.html (o index.html, style.css y game.js), en bloques de código listos para copiar, seguido de una breve lista de cómo ejecutarlo y cómo jugar. No omitas partes del código con comentarios como "resto del código aquí": el proyecto debe estar completo y ejecutable tal cual.

....

Me tomé el tiempo de analizar este prompt y verificar que estuvieran todas las integraciones que había redactado en el prompt inicial, junto con las aclaraciones técnicas (no utilizar librerías) y las mecánicas de los animatrónicos.

Una vez verificada esta información, abrí OpenCode y elegí el modelo DeepSeek V4.1 Free, un modelo gratuito que nos proporciona OpenCode.

La elección del modelo es algo importante, así que previamente hice mi investigación y encontré que esta versión de DeepSeek es potente en su modo Max. Una vez hecho esto, creé el directorio del proyecto y le envié el prompt.

El modelo tardó exactamente 40 minutos y 20 segundos en completar el proyecto, con una ventana de contexto que ya superaba el 65 %.

### Testing y corrección de errores

La primera fase del proyecto fue un éxito. El juego funcionaba excelente: los animatrónicos tenían un diseño espectacular y también se había conseguido una atmósfera genial.

Ciertamente, hubo aspectos que no me gustaron o que consideré errores directos:
- Demasiada información innecesaria que solamente confundía al usuario.
- Las cámaras no tenían un rol funcional (un error de mecánicas que, en realidad, fue responsabilidad mía).
- La IA de BomBom y PumPum era increíblemente difícil, mientras que DomDom prácticamente no aparecía.
- No había un sistema de niveles (noche 1, noche 2, etc.).
- Los sonidos no eran tan acertados para representar a un animatrónico.
Estos errores los encontré jugando varias veces.

Antes de enviarle al modelo el prompt para corregir los errores y agregar nuevas mecánicas, quería revisar cómo estaba estructurando el código.

Para mi sorpresa, y aunque no se lo había especificado, había declarado constantes globales y un estado global mediante objetos de JavaScript para controlar el comportamiento de la IA de los animatrónicos, la duración de las noches y la aleatoriedad de DomDom. Esto me gustó mucho, ya que facilita considerablemente la tarea de balanceo.

Ejemplo de configuración:
const CONFIG = Object.freeze({
    HOUR_MS: 36000,                 // 36 s reales por hora -> 3:36 por noche
    HOURS: 6,
    NIGHT_MS: 36000 * 6,
    START_POWER: 100,

    BASE_DRAIN: 0.09,               // Energía por segundo solo por existir
    CAMERA_DRAIN: 0.48,
    DOOR_DRAIN: 0.62,
    LIGHT_DRAIN: 1.05,

    DOOR_PATIENCE_MIN: 9.0,
    DOOR_PATIENCE_MAX: 12.0,
    DOOR_BLOCK_TIME: 0.9,           // Segundos con la puerta cerrada para ahuyentar

    PUZZLE_TIMES: [14, 13, 12],     // Segundos para resolver cada visita
    PUZZLE_PENALTIES: [8, 12],      // Energía perdida al fallar las dos primeras
    STUN_TIME: 3.1,

    SCARE_TIME: 1850,               // ms de jump scare antes de la pantalla de muerte
    BLACKOUT_TIME: 2.8,
    TOAST_TIME: 2400, ...
});


También verifiqué cómo accedía al DOM y observé que estaba utilizando una simulación de jQuery mediante la API nativa de JavaScript para acceder al DOM. Curioso.

Ejemplo:
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];


Con esto en mente, mejoré los siguientes prompts para que tuvieran una estructura similar a la anterior. Sin embargo, como tenía varias tareas y cada una era distinta, decidí separarlas en dos responsabilidades:
- Ajustes UI/UX: aquí irían todos los arreglos visuales, de música y algunos errores puntuales.
- Creación de mecánicas y balanceo de IA: aquí irían las correcciones a nivel técnico del proyecto.

1. Prompt de ajustes UI/UX
Vamos a hacer cambios de UI/UX en el diseño y la música:

- Hay mucha información en la oficina. Elimina la cantidad de texto que no ofrece información crucial y deja únicamente los botones.
- Las dos puertas deben tener un icono de Danger grande por encima del marco.
- Cuando te acerques a una puerta, deben aparecer dos pósteres del animatrónico que aparece en dicha puerta.
- Agrega una música misteriosa y de terror en el menú.
- Los sonidos de los animatrónicos BomBom y PumPum deben ser como rugidos. Cada uno debe tener un sonido distinto.

RESTRICCIONES:

- No elimines código funcional antiguo.
- Las restricciones anteriores deben seguirse estrictamente.
- Debes cambiar únicamente lo que se te pide y no agregar otras cosas.
- No ejecutes comandos de consola para correr ningún servidor Python ni nada por el estilo.
- Resuélvelo con la menor complejidad posible.


2. Prompt para mecánicas y balanceo
Vamos a agregar y mejorar el apartado técnico del juego.

APARTADO TÉCNICO Y MECÁNICAS:

- Agregarás una mecánica a las cámaras. Cada sala tendrá un apartado de fusibles que esporádicamente se sobrecalentarán. Tú, como guardia, debes repararlos.
- Para repararlos, debes retirarlos y colocar uno nuevo. Cada fusible tiene una polaridad, y ese es el truco técnico que el usuario debe resolver: insertar el fusible de acuerdo con la polaridad que se muestra en el hueco donde va colocado.
- Si el usuario arregla los fusibles correctamente, aumenta la electricidad; de lo contrario, la electricidad irá disminuyendo.
- Insertar un sistema de niveles, donde se empiece por la noche 1 y se termine por la noche 3. Cada noche irá aumentando la dificultad: la noche 1 será fácil, la noche 2 intermedia y la noche 3 difícil.
- En la oficina, en la pared de enfrente, agrega un marco con los tres animatrónicos felices.
- Cuando se comience la noche 1 por primera vez, muestra un modal con diseño de contrato en el que se mencione que hemos sido contratados para ese trabajo y que hoy empezamos. Esto es para darle contexto al usuario sobre lo que hace.

RESTRICCIONES:

- No elimines código funcional antiguo.
- Las restricciones anteriores deben seguirse estrictamente.
- Debes cambiar únicamente lo que se te pide y no agregar otras cosas.
- No ejecutes comandos de consola para correr ningún servidor Python ni nada por el estilo.
- Resuélvelo con la menor complejidad posible.


Cabe destacar que, con el primer prompt y el segundo de ajustes UI/UX, ya había alcanzado el límite diario de uso.

Una vez que esperé el tiempo necesario (aproximadamente 6 horas), envié el siguiente prompt y realicé la verificación correspondiente.

Cabe destacar que tanto el prompt de UI/UX como el de mecánicas fueron exitosos. Ambos funcionaron correctamente.
 
### Conclusiones
Este es mi primer proyecto de Vibe Coding con OpenCode y me gustó mucho. El hecho de tener a nuestra disposición una herramienta que puede hacer realidad nuestras ideas en poco tiempo es increíblemente genial. También entendí mucho mejor que un prompt estructurado reduce considerablemente las alucinaciones de la IA y mejora el resultado.

Sin embargo, hay cosas que sé que a la IA le tomará tiempo resolver:
- Se nota que está hecho con IA: el diseño, las formas y la tipografía, a mi gusto, hacen evidente que está hecho con IA, y eso le quita identidad.
- Un mantenimiento manual bastante difícil: al final, el código quedó con 2300 líneas de JavaScript, lo cual es una barbaridad. Aunque comprendí la estructura general, me tomaría mucho tiempo llegar a comprender el flujo real del proyecto. No porque no sepa JavaScript, sino porque se trata de un flujo inmenso.
El uso de la IA para crear un juego me parece adecuado, pero integrar un proyecto desarrollado mediante Vibe Coding en un sistema ERP sería algo que nunca haría. Por más técnicas de prompts, agentes, etc., no tendría la confianza suficiente para mirar a mi cliente y decirle que su sistema funciona perfectamente solo porque la IA me lo diga.

La aplicación de la IA mediante agentes para el desarrollo es increíble. Todavía me hace falta cambiar el chip y entender que esto es parte del futuro, ya que considero que trae muchas ventajas.

Pero, como todo en la vida, uno siempre tiene que saber qué está haciendo, sin importar que otra persona o herramienta lo haga por uno. Es como llevar el carro a un mecánico y decirle: «No funciona, arréglamelo». Si el mecánico se da cuenta de que uno no sabe exactamente dónde está el problema, puede aprovecharse de la situación o hacer un trabajo deficiente.