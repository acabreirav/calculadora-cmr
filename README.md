# Calculadora CMR

App web de una sola pantalla que ayuda a un usuario de **CMR Falabella (Chile)**
a decidir si le conviene **canjear una gift card hoy** o **esperar el cambio del
sistema de puntos**.

Tras la actualización, cada punto valdrá **$1 CLP multiplicado por un ponderador
personalizado** (según el consumo de cada usuario). La calculadora compara ese
valor futuro contra el valor de canjear una gift card ahora, y recomienda la
opción que maximiza el valor total de tus puntos.

## Cómo correrla

Requiere [Node.js](https://nodejs.org/) 18 o superior.

```bash
npm install   # instala las dependencias
npm run dev   # levanta el servidor de desarrollo (Vite)
```

Luego abre la URL que muestra la terminal (por defecto http://localhost:5173).

Para generar la versión de producción:

```bash
npm run build     # compila a la carpeta dist/
npm run preview   # sirve localmente el build de dist/
```

## Cómo funciona el cálculo

- **Gift cards disponibles** (puntos → valor CLP): desde 12.000 puntos ($20.000)
  hasta 210.000 puntos ($1.050.000). Las tarjetas grandes rinden más por punto.
- **Ponderador:** de ×1 a ×5, en saltos de 0,25. Es el valor que tendrá cada
  punto guardado tras el cambio.
- **Motor "valor total":** una gift card solo conviene si su rendimiento
  ($/punto) supera el ponderador. Un optimizador (unbounded knapsack) maximiza
  `valor en gift cards + puntos guardados × ponderador`, de modo que nunca
  sugiere un canje que te haga perder valor.
- **Punto de equilibrio:** el mejor rendimiento ($/punto) entre las tarjetas que
  tu saldo alcanza a pagar. Bajo ese ponderador conviene comprar; sobre él,
  esperar.

## Nota

Los datos de las gift cards y el funcionamiento del ponderador son **supuestos**
según lo publicado por el banco y pueden no coincidir con las condiciones
finales. Esta calculadora es una herramienta orientativa, no un consejo
financiero oficial.

## Despliegue

La app está pensada para publicarse en [Vercel](https://vercel.com) (framework
preset **Vite**, build `npm run build`, output `dist`). Cada push a `main`
redesplega automáticamente.

<!-- URL de producción (Vercel): pendiente de configurar por el usuario -->
